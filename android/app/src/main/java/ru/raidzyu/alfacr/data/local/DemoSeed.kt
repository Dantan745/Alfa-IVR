package ru.raidzyu.alfacr.data.local

import ru.raidzyu.alfacr.data.security.PasswordHasher

private data class TxSeed(
    val name: String,
    val amount: Long,
    val type: String,
    val cat: String,
    val icon: String,
)

/** DEMO: тестовый Иван + операции как в Figma. */
object DemoSeed {
    const val DEMO_EMAIL = "ivan@alfa.demo"
    const val DEMO_PASSWORD = "Demo1234"
    const val DEMO_PIN = "1234"

    suspend fun populate(db: AppDatabase) {
        if (db.users().byEmail(DEMO_EMAIL) != null) return

        val userId = db.users().insert(
            UserEntity(
                lastName = "Иванов",
                firstName = "Иван",
                middleName = "Иванович",
                phone = "+7 (900) 123-45-67",
                email = DEMO_EMAIL,
                walletId = "WLT-00123456-ЦР",
                passportHash = PasswordHasher.hash("0000 000000", "seed-passport"),
            ),
        )
        val pwd = PasswordHasher.hashPassword(DEMO_PASSWORD)
        val pin = PasswordHasher.hashPassword(DEMO_PIN)
        db.credentials().upsert(
            CredentialEntity(
                userId = userId,
                passwordHash = pwd.hash,
                saltHex = pwd.salt,
                pinHash = pin.hash,
                pinSaltHex = pin.salt,
            ),
        )
        db.accounts().upsert(AccountEntity(userId, 5000_00))

        val now = System.currentTimeMillis()
        val day = 86_400_000L
        val seedTx = listOf(
            TxSeed("Кофейня «Прим»", -320_00L, "expense", "Кафе", "local_cafe"),
            TxSeed("Петров А.С.", 5000_00L, "income", "Переводы", "person"),
            TxSeed("Пятёрочка", -1240_00L, "expense", "Продукты", "shopping_cart"),
            TxSeed("Зарплата", 65000_00L, "income", "Доходы", "work"),
            TxSeed("Яндекс.Такси", -480_00L, "expense", "Транспорт", "directions_car"),
            TxSeed("Аптека 36,6", -890_00L, "expense", "Здоровье", "local_pharmacy"),
            TxSeed("Смирнова О.В.", 2500_00L, "income", "Переводы", "person"),
            TxSeed("Связной", -3200_00L, "expense", "Электроника", "phone_android"),
            TxSeed("Оплата QR", -150_00L, "expense", "Прочее", "qr_code"),
            TxSeed("Возврат", 750_00L, "income", "Переводы", "undo"),
        )
        seedTx.forEachIndexed { i, t ->
            db.transactions().insert(
                TransactionEntity(
                    userId = userId,
                    counterpart = t.name,
                    amountKopecks = t.amount,
                    type = t.type,
                    category = t.cat,
                    icon = t.icon,
                    comment = "",
                    createdAt = now - i * day / 3,
                    status = "done",
                    riskScore = if (i == 0) 0.72f else 0.08f,
                ),
            )
        }

        listOf(
            ContactEntity(0, userId, "Петров Александр Сергеевич", "+7 (900) 123-45-67", "WLT-00123456", "П", 0xFF00D2D3, true),
            ContactEntity(0, userId, "Смирнова Ольга Владимировна", "+7 (915) 234-56-78", "WLT-00234567", "С", 0xFF228D57, true),
            ContactEntity(0, userId, "Козлов Дмитрий Романович", "+7 (926) 345-67-89", "WLT-00345678", "К", 0xFFFFB4AB, false),
            ContactEntity(0, userId, "Новикова Мария Андреевна", "+7 (977) 456-78-90", "WLT-00456789", "Н", 0xFF48FFD5, false),
            ContactEntity(0, userId, "Федоров Игорь Петрович", "+7 (985) 567-89-01", "WLT-00567890", "Ф", 0xFF00D2D3, false),
        ).forEach { db.contacts().insert(it) }

        db.limits().insert(LimitEntity(0, userId, "Дневной лимит переводов", "day_transfer", 50_000_00, 80, "₽/день"))
        db.limits().insert(LimitEntity(0, userId, "Месячный лимит расходов", "month_spend", 100_000_00, 70, "₽/мес"))
        db.limits().insert(LimitEntity(0, userId, "Лимит одной операции", "single", 30_000_00, 90, "₽"))
        db.limits().insert(LimitEntity(0, userId, "Лимит переводов за рубеж", "abroad", 10_000_00, 100, "₽/день"))

        db.contracts().insert(SmartContractEntity(0, userId, "Аренда квартиры", "1 число месяца", 25_000_00, "Петров А.С.", true, "1 окт 2026"))
        db.contracts().insert(SmartContractEntity(0, userId, "Пополнение копилки", "Каждую пятницу", 2_000_00, "Копилка 1", true, "19 сен 2026"))
        db.contracts().insert(SmartContractEntity(0, userId, "Страховой взнос", "15 числа", 5_500_00, "Страховая СК", false, "Пауза"))

        db.alerts().insert(
            MlAlertEntity(
                userId = userId,
                title = "Обнаружена аномалия",
                body = "Необычная транзакция с незнакомого устройства",
                score = 0.72f,
                createdAt = now,
            ),
        )
    }
}
