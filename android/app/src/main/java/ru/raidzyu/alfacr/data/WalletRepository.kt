package ru.raidzyu.alfacr.data

import androidx.paging.Pager
import androidx.paging.PagingConfig
import ru.raidzyu.alfacr.BuildConfig
import ru.raidzyu.alfacr.data.local.AccountEntity
import ru.raidzyu.alfacr.data.local.AppDatabase
import ru.raidzyu.alfacr.data.local.ContactEntity
import ru.raidzyu.alfacr.data.local.CredentialEntity
import ru.raidzyu.alfacr.data.local.DemoSeed
import ru.raidzyu.alfacr.data.local.LimitEntity
import ru.raidzyu.alfacr.data.local.MlAlertEntity
import ru.raidzyu.alfacr.data.local.OutboxEntity
import ru.raidzyu.alfacr.data.local.SmartContractEntity
import ru.raidzyu.alfacr.data.local.TransactionEntity
import ru.raidzyu.alfacr.data.local.UserEntity
import ru.raidzyu.alfacr.data.remote.OfflineRemoteApi
import ru.raidzyu.alfacr.data.remote.RemoteBankApi
import ru.raidzyu.alfacr.data.remote.RemoteSnap
import ru.raidzyu.alfacr.data.security.PasswordHasher
import ru.raidzyu.alfacr.domain.TransferResult
import ru.raidzyu.alfacr.ml.AnomalyDetector
import ru.raidzyu.alfacr.ml.HeuristicAnomalyDetector
import ru.raidzyu.alfacr.ml.LinearForecaster
import ru.raidzyu.alfacr.ml.PaymentForecaster
import ru.raidzyu.alfacr.ml.TxFeatures
import java.util.Calendar
import java.util.UUID

class WalletRepository(
    private val db: AppDatabase,
    private val store: ru.raidzyu.alfacr.data.security.SecureStore? = null,
    // ML: подмени на TFLite/API, UI не трогай.
    private val detector: AnomalyDetector = HeuristicAnomalyDetector(),
    private val forecaster: PaymentForecaster = LinearForecaster(),
    private val remote: RemoteBankApi = OfflineRemoteApi(),
) {
    private var lastLoginAttempts: Int = 1
    private val seenAccountDevices = mutableSetOf<String>()
    suspend fun ensureDemo() = DemoSeed.populate(db)

    fun user(id: Long) = db.users().observe(id)
    fun account(id: Long) = db.accounts().observe(id)
    fun txs(id: Long) = db.transactions().observeRecent(id)

    fun pagedTxs(userId: Long, query: String, filter: String) = Pager(
        config = PagingConfig(pageSize = 20, prefetchDistance = 8, maxSize = 80),
        pagingSourceFactory = { db.pagingTx().paging(userId, query, filter) },
    ).flow

    fun contacts(id: Long) = db.contacts().observe(id)
    fun limits(id: Long) = db.limits().observe(id)
    fun contracts(id: Long) = db.contracts().observe(id)
    fun alerts(id: Long) = db.alerts().observeUnread(id)
    fun outbox(id: Long) = db.outbox().observePending(id)

    suspend fun login(email: String, password: String): Result<UserEntity> {
        if (BuildConfig.USE_REMOTE) {
            val remoteResult = remote.login(email.trim(), password)
            remoteResult.onSuccess { snap ->
                return Result.success(applyRemote(snap))
            }
            remoteResult.onFailure { err ->
                if (err.message?.contains("REMOTE_DISABLED") != true) return Result.failure(err)
            }
        }
        val user = db.users().byEmail(email.trim().lowercase())
            ?: db.users().byEmail(email.trim())
            ?: return Result.failure(IllegalArgumentException("Пользователь не найден"))
        val cred = db.credentials().byUser(user.id)
            ?: return Result.failure(IllegalArgumentException("Нет учётных данных"))
        if (!PasswordHasher.verify(password, cred.saltHex, cred.passwordHash)) {
            store?.let { it.loginAttempts = it.loginAttempts + 1 }
            return Result.failure(IllegalArgumentException("Неверный пароль"))
        }
        lastLoginAttempts = store?.loginAttempts ?: 1
        store?.loginAttempts = 1
        return Result.success(user)
    }

    suspend fun verifyPin(userId: Long, pin: String): Boolean {
        val cred = db.credentials().byUser(userId) ?: return false
        val salt = cred.pinSaltHex ?: return false
        val hash = cred.pinHash ?: return false
        return PasswordHasher.verify(pin, salt, hash)
    }

    suspend fun register(
        last: String,
        first: String,
        middle: String,
        passport: String,
        phone: String,
        email: String,
        password: String,
    ): Result<UserEntity> {
        if (last.isBlank() || first.isBlank() || email.isBlank() || password.length < 6) {
            return Result.failure(IllegalArgumentException("Заполните обязательные поля"))
        }
        if (BuildConfig.USE_REMOTE) {
            val remoteResult = remote.register(
                mapOf(
                    "lastName" to last.trim(),
                    "firstName" to first.trim(),
                    "middleName" to middle.trim(),
                    "passport" to passport,
                    "phone" to phone.trim(),
                    "email" to email.trim(),
                    "password" to password,
                ),
            )
            remoteResult.onSuccess { snap -> return Result.success(applyRemote(snap)) }
            remoteResult.onFailure { err ->
                if (err.message?.contains("REMOTE_DISABLED") != true) return Result.failure(err)
            }
        }
        if (db.users().byEmail(email) != null) {
            return Result.failure(IllegalArgumentException("Email уже занят"))
        }
        val userId = db.users().insert(
            UserEntity(
                lastName = last.trim(),
                firstName = first.trim(),
                middleName = middle.trim(),
                phone = phone.trim(),
                email = email.trim(),
                walletId = "WLT-" + UUID.randomUUID().toString().take(8).uppercase() + "-ЦР",
                passportHash = PasswordHasher.hash(passport.ifBlank { "none" }, "passport"),
            ),
        )
        val pwd = PasswordHasher.hashPassword(password)
        val pin = PasswordHasher.hashPassword("1234")
        db.credentials().upsert(
            CredentialEntity(userId, pwd.hash, pwd.salt, pin.hash, pin.salt),
        )
        db.accounts().upsert(AccountEntity(userId, 0))
        db.limits().insert(LimitEntity(0, userId, "Дневной лимит переводов", "day_transfer", 50_000_00, 80, "₽/день"))
        db.limits().insert(LimitEntity(0, userId, "Месячный лимит расходов", "month_spend", 100_000_00, 70, "₽/мес"))
        db.limits().insert(LimitEntity(0, userId, "Лимит одной операции", "single", 30_000_00, 90, "₽"))
        db.limits().insert(LimitEntity(0, userId, "Лимит переводов за рубеж", "abroad", 10_000_00, 100, "₽/день"))
        return Result.success(db.users().byId(userId)!!)
    }

    suspend fun transfer(
        userId: Long,
        payee: String,
        amountRub: Double,
        comment: String,
        isNewPayee: Boolean,
        force: Boolean = false,
    ): TransferResult {
        val kopecks = (amountRub * 100).toLong()
        if (kopecks <= 0) return TransferResult.Fail("Введите сумму")
        val token = store?.apiToken.orEmpty()
        if (BuildConfig.USE_REMOTE && token.isNotBlank()) {
            val remoteResult = remote.transfer(token, payee, amountRub, comment)
            remoteResult.onSuccess { snap ->
                applyRemote(snap)
                return TransferResult.Ok(0L, detector.score(TxFeatures(kopecks, 12, isNewPayee, kopecks, 2_000_00, "Переводы")))
            }
            remoteResult.onFailure { return TransferResult.Fail(it.message ?: "Ошибка сервера") }
        }
        val acc = db.accounts().byUser(userId) ?: return TransferResult.Fail("Счёт не найден")
        if (acc.balanceKopecks < kopecks) return TransferResult.Fail("Недостаточно средств")

        val cal = Calendar.getInstance()
        val startDay = startOfDay(cal.timeInMillis)
        val startMonth = startOfMonth(cal.timeInMillis)
        val limits = db.limits().all(userId)
        val dayTransfers = db.transactions().transferSpentSince(userId, startDay) + kopecks
        val monthSpend = db.transactions().spentSince(userId, startMonth) + kopecks
        limits.find { it.kind == "single" }?.let {
            if (kopecks > it.maxKopecks) return TransferResult.Fail("Превышен лимит одной операции")
        }
        limits.find { it.kind == "day_transfer" }?.let {
            if (dayTransfers > it.maxKopecks) return TransferResult.Fail("Превышен дневной лимит переводов")
        }
        limits.find { it.kind == "month_spend" }?.let {
            if (monthSpend > it.maxKopecks) return TransferResult.Fail("Превышен месячный лимит")
        }

        val hour = cal.get(Calendar.HOUR_OF_DAY)
        val avg = db.transactions().avgAbsOut(userId).toLong().coerceAtLeast(1)
        val lastAt = db.transactions().lastCreatedAt(userId)
        val device = store?.deviceId.orEmpty()
        val pair = "$userId:$device"
        val isNewDevice = device.isNotBlank() && seenAccountDevices.add(pair)
        val anomaly = detector.score(
            TxFeatures(
                amountKopecks = kopecks,
                hourOfDay = hour,
                isNewPayee = isNewPayee,
                dailySpendKopecks = dayTransfers,
                avgAbsAmountKopecks = if (avg > 0) avg else 2_000_00,
                category = "Переводы",
                loginAttempts = lastLoginAttempts,
                timeSinceLastTxSec = if (lastAt > 0) (System.currentTimeMillis() - lastAt) / 1000 else 0,
                isNewDevice = isNewDevice,
            ),
        )
        if (anomaly.shouldBlock && !force) {
            return TransferResult.Fail(anomaly.explanation, anomaly)
        }
        val alert = if (anomaly.score >= 0.4f) {
            MlAlertEntity(0, userId, "Проверка перевода", anomaly.explanation, anomaly.score, System.currentTimeMillis())
        } else {
            null
        }
        val tx = TransactionEntity(
            userId = userId,
            counterpart = payee,
            amountKopecks = -kopecks,
            type = "expense",
            category = "Переводы",
            icon = "person",
            comment = comment,
            createdAt = System.currentTimeMillis(),
            status = "done",
            riskScore = anomaly.score,
        )
        val txId = db.ledger().commitTransfer(userId, acc.balanceKopecks - kopecks, tx, alert)
        return TransferResult.Ok(txId, anomaly)
    }

    suspend fun topUp(userId: Long, amountRub: Double): Result<Unit> {
        val k = (amountRub * 100).toLong()
        if (k <= 0) return Result.failure(IllegalArgumentException("Сумма"))
        val token = store?.apiToken.orEmpty()
        if (BuildConfig.USE_REMOTE && token.isNotBlank()) {
            val remoteResult = remote.topUp(token, amountRub)
            remoteResult.onSuccess { applyRemote(it); return Result.success(Unit) }
            remoteResult.onFailure { return Result.failure(it) }
        }
        val acc = db.accounts().byUser(userId) ?: return Result.failure(IllegalStateException("Счёт"))
        db.ledger().commitTopUp(
            userId,
            acc.balanceKopecks + k,
            TransactionEntity(
                userId = userId,
                counterpart = "Пополнение ЦР",
                amountKopecks = k,
                type = "income",
                category = "Доходы",
                icon = "add_circle",
                comment = "Тестовое пополнение",
                createdAt = System.currentTimeMillis(),
                status = "done",
                riskScore = 0f,
            ),
        )
        return Result.success(Unit)
    }

    suspend fun addContact(userId: Long, name: String, phone: String) {
        val colors = longArrayOf(0xFF00D2D3, 0xFF228D57, 0xFF48FFD5, 0xFFFFB4AB)
        db.contacts().insert(
            ContactEntity(
                userId = userId,
                name = name,
                phone = phone,
                wallet = "WLT-" + (1000000..9999999).random(),
                initials = name.first().uppercase(),
                colorArgb = colors.random(),
                favorite = false,
            ),
        )
    }

    suspend fun toggleFavorite(contact: ContactEntity) {
        db.contacts().update(contact.copy(favorite = !contact.favorite))
    }

    suspend fun updateLimit(limit: LimitEntity) = db.limits().update(limit)

    suspend fun addContract(userId: Long, name: String, trigger: String, amount: Long, recipient: String) {
        db.contracts().insert(
            SmartContractEntity(0, userId, name, trigger, amount, recipient, true, "скоро"),
        )
    }

    suspend fun toggleContract(c: SmartContractEntity) {
        db.contracts().update(c.copy(active = !c.active, nextRunLabel = if (c.active) "Пауза" else "скоро"))
    }

    suspend fun queueOutbox(userId: Long, payload: String) {
        db.outbox().insert(OutboxEntity(0, userId, payload, System.currentTimeMillis()))
    }

    suspend fun forecast(userId: Long): Long {
        val spent = db.transactions().spentSince(userId, startOfMonth(System.currentTimeMillis()))
        val day = Calendar.getInstance().get(Calendar.DAY_OF_MONTH)
        return forecaster.monthForecastKopecks(spent, day)
    }

    suspend fun monthSpent(userId: Long) =
        db.transactions().spentSince(userId, startOfMonth(System.currentTimeMillis()))

    suspend fun monthIncome(userId: Long) =
        db.transactions().incomeSince(userId, startOfMonth(System.currentTimeMillis()))

    private suspend fun applyRemote(snap: RemoteSnap): UserEntity {
        if (!snap.token.isNullOrBlank()) store?.apiToken = snap.token
        var user = db.users().byEmail(snap.email)
        if (user == null) {
            val id = db.users().insert(
                UserEntity(
                    lastName = snap.lastName,
                    firstName = snap.firstName,
                    middleName = snap.middleName,
                    phone = snap.phone,
                    email = snap.email,
                    walletId = snap.walletId,
                    passportHash = PasswordHasher.hash("remote", "aabbccddeeff00112233445566778899"),
                ),
            )
            val pin = PasswordHasher.hashPassword(snap.pin.ifBlank { "1234" })
            db.credentials().upsert(CredentialEntity(id, pin.hash, pin.salt, pin.hash, pin.salt))
            user = db.users().byId(id)!!
        } else {
            db.users().update(
                user.copy(
                    lastName = snap.lastName,
                    firstName = snap.firstName,
                    middleName = snap.middleName,
                    phone = snap.phone,
                    walletId = snap.walletId,
                ),
            )
            user = db.users().byId(user.id)!!
        }
        db.accounts().upsert(AccountEntity(user.id, (snap.balance * 100).toLong()))
        db.transactions().deleteForUser(user.id)
        snap.txs.forEach { tx ->
            db.transactions().insert(
                TransactionEntity(
                    userId = user.id,
                    counterpart = tx.name,
                    amountKopecks = (tx.amount * 100).toLong(),
                    type = tx.type,
                    category = tx.category,
                    icon = tx.icon,
                    comment = tx.comment,
                    createdAt = tx.createdAt,
                    status = tx.status,
                    riskScore = 0f,
                ),
            )
        }
        db.contacts().deleteForUser(user.id)
        snap.contacts.forEach { c ->
            db.contacts().insert(
                ContactEntity(
                    userId = user.id,
                    name = c.name,
                    phone = c.phone,
                    wallet = c.wallet,
                    initials = c.initials.ifBlank { c.name.take(1) },
                    colorArgb = parseColor(c.color),
                    favorite = c.favorite,
                ),
            )
        }
        db.alerts().deleteForUser(user.id)
        snap.notes.filter { !it.read }.forEach { n ->
            db.alerts().insert(MlAlertEntity(0, user.id, n.title, n.body, 0.2f, n.createdAt, false))
        }
        return user
    }

    private fun parseColor(hex: String): Long {
        val clean = hex.removePrefix("#")
        return try {
            ("FF$clean").toLong(16)
        } catch (_: Exception) {
            0xFF00D2D3
        }
    }

    private fun startOfDay(now: Long): Long {
        val c = Calendar.getInstance()
        c.timeInMillis = now
        c.set(Calendar.HOUR_OF_DAY, 0)
        c.set(Calendar.MINUTE, 0)
        c.set(Calendar.SECOND, 0)
        c.set(Calendar.MILLISECOND, 0)
        return c.timeInMillis
    }

    private fun startOfMonth(now: Long): Long {
        val c = Calendar.getInstance()
        c.timeInMillis = now
        c.set(Calendar.DAY_OF_MONTH, 1)
        c.set(Calendar.HOUR_OF_DAY, 0)
        c.set(Calendar.MINUTE, 0)
        c.set(Calendar.SECOND, 0)
        c.set(Calendar.MILLISECOND, 0)
        return c.timeInMillis
    }
}
