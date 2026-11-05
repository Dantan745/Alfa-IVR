package ru.raidzyu.alfacr.ml

/** Фичи операции для скоринга. Подключение модели описано в docs/ml-contract.md. */
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
    suspend fun monthForecastKopecks(spentSoFar: Long, dayOfMonth: Int): Long
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

class LinearForecaster : PaymentForecaster {
    override suspend fun monthForecastKopecks(spentSoFar: Long, dayOfMonth: Int): Long {
        if (spentSoFar <= 0) return 0
        val day = dayOfMonth.coerceAtLeast(1)
        val daysInMonth = java.util.Calendar.getInstance().getActualMaximum(java.util.Calendar.DAY_OF_MONTH)
        val left = (daysInMonth - day).coerceAtLeast(0)
        return kotlin.math.round(spentSoFar.toDouble() * left / day).toLong()
    }
}
