package ru.raidzyu.alfacr.ml

/** Фичи операции для скоринга. */
data class TxFeatures(
    val amountKopecks: Long,
    val hourOfDay: Int,
    val isNewPayee: Boolean,
    val dailySpendKopecks: Long,
    val avgAbsAmountKopecks: Long,
    val category: String,
    val loginAttempts: Int = 1,
    val timeSinceLastTxSec: Long = 0,
    val isNewDevice: Boolean = false,
) {
    val isNight: Boolean get() = hourOfDay >= 23 || hourOfDay < 6
    val amountToAvgRatio: Float
        get() = if (avgAbsAmountKopecks <= 0) 1f else amountKopecks.toFloat() / avgAbsAmountKopecks.toFloat()
}

data class AnomalyResult(
    val score: Float,
    val label: String,
    val explanation: String,
    val shouldBlock: Boolean,
)

fun interface AnomalyDetector {
    suspend fun score(features: TxFeatures): AnomalyResult
}

fun interface PaymentForecaster {
    suspend fun monthForecastKopecks(points: List<Pair<Long, Long>>, now: Long = System.currentTimeMillis()): Long
}

class HeuristicAnomalyDetector : AnomalyDetector {
    override suspend fun score(features: TxFeatures): AnomalyResult {
        var score = 0f
        if (features.isNewPayee) score += 0.25f
        if (features.isNight) score += 0.2f
        if (features.amountToAvgRatio >= 4f) score += 0.25f
        if (features.loginAttempts >= 4) score += 0.1f
        if (features.isNewDevice) score += 0.15f
        if (features.amountKopecks > 15_000_00) score += 0.1f
        score = score.coerceIn(0f, 1f)
        val block = score >= 0.85f
        val label = when {
            score >= 0.7f -> "high"
            score >= 0.4f -> "medium"
            else -> "low"
        }
        val text = when {
            features.isNewPayee && score >= 0.4f -> "Перевод новому получателю — проверьте номер"
            score >= 0.7f -> "Необычная транзакция с незнакомого устройства"
            else -> "Операция в пределах привычного поведения"
        }
        return AnomalyResult(score, label, text, block)
    }
}

class MonthForecaster : PaymentForecaster {
    override suspend fun monthForecastKopecks(points: List<Pair<Long, Long>>, now: Long): Long {
        val zone = java.util.TimeZone.getTimeZone("Europe/Moscow")
        fun cal(ts: Long) = java.util.Calendar.getInstance(zone).apply { timeInMillis = ts }
        val today = cal(now)
        val next = cal(now).apply {
            add(java.util.Calendar.MONTH, 1)
            set(java.util.Calendar.DAY_OF_MONTH, 1)
        }
        val daysNext = next.getActualMaximum(java.util.Calendar.DAY_OF_MONTH)
        val byDay = HashMap<String, Long>()
        for ((ts, amount) in points) {
            if (amount <= 0L) continue
            val c = cal(ts)
            val key = "${c.get(java.util.Calendar.YEAR)}-${c.get(java.util.Calendar.MONTH)}-${c.get(java.util.Calendar.DAY_OF_MONTH)}"
            byDay[key] = (byDay[key] ?: 0L) + amount
        }
        val series = ArrayList<Pair<Int, Long>>(84)
        for (i in 83 downTo 0) {
            val c = cal(now - i * 86_400_000L)
            val key = "${c.get(java.util.Calendar.YEAR)}-${c.get(java.util.Calendar.MONTH)}-${c.get(java.util.Calendar.DAY_OF_MONTH)}"
            series.add(c.get(java.util.Calendar.DAY_OF_WEEK) to (byDay[key] ?: 0L))
        }
        val buckets = Array(8) { ArrayList<Long>() }
        for ((wd, amount) in series) buckets[wd].add(amount)
        fun median(values: List<Long>): Double {
            if (values.isEmpty()) return 0.0
            val sorted = values.sorted()
            val mid = sorted.size / 2
            return if (sorted.size % 2 == 1) sorted[mid].toDouble() else (sorted[mid - 1] + sorted[mid]) / 2.0
        }
        val typical = DoubleArray(8)
        for (wd in 1..7) {
            val values = buckets[wd]
            val spent = values.filter { it > 0L }
            if (spent.isNotEmpty() && values.isNotEmpty()) {
                typical[wd] = spent.size.toDouble() / values.size * median(spent)
            }
        }
        val recent = series.takeLast(28).sumOf { it.second }
        val older = series.drop((series.size - 56).coerceAtLeast(0)).take(28).sumOf { it.second }
        val active = series.count { it.second > 0L }
        val trend = if (older > 0L && active >= 8) (recent.toDouble() / older).coerceIn(0.75, 1.35) else 1.0
        var total = 0.0
        if (active < 4) {
            val seen = ArrayList<Long>()
            val day = today.get(java.util.Calendar.DAY_OF_MONTH)
            for (d in 1..day) {
                val key = "${today.get(java.util.Calendar.YEAR)}-${today.get(java.util.Calendar.MONTH)}-$d"
                seen.add(byDay[key] ?: 0L)
            }
            val spentDays = seen.filter { it > 0L }
            total = median(spentDays) * daysNext * (spentDays.size.toDouble() / seen.size.coerceAtLeast(1))
        } else {
            for (d in 1..daysNext) {
                val c = cal(next.timeInMillis).apply { set(java.util.Calendar.DAY_OF_MONTH, d) }
                total += typical[c.get(java.util.Calendar.DAY_OF_WEEK)] * trend
            }
        }
        return total.toLong().coerceAtLeast(0L)
    }
}
