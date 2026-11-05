package ru.raidzyu.alfacr.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/** Паспорт хранится только как хэш. */
@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val lastName: String,
    val firstName: String,
    val middleName: String,
    val phone: String,
    val email: String,
    val walletId: String,
    val passportHash: String,
    val verified: Boolean = true,
)

@Entity(tableName = "credentials")
data class CredentialEntity(
    @PrimaryKey val userId: Long,
    val passwordHash: String,
    val saltHex: String,
    val pinHash: String? = null,
    val pinSaltHex: String? = null,
)

@Entity(tableName = "accounts")
data class AccountEntity(
    @PrimaryKey val userId: Long,
    /** Баланс в копейках — без float, чтобы не терять деньги на округлении. */
    val balanceKopecks: Long,
)

@Entity(
    tableName = "transactions",
    indices = [Index("userId"), Index("createdAt"), Index("category")],
)
data class TransactionEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val userId: Long,
    val counterpart: String,
    val amountKopecks: Long,
    val type: String,
    val category: String,
    val icon: String,
    val comment: String,
    val createdAt: Long,
    val status: String,
    val riskScore: Float,
)

@Entity(tableName = "contacts")
data class ContactEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val userId: Long,
    val name: String,
    val phone: String,
    val wallet: String,
    val initials: String,
    val colorArgb: Long,
    val favorite: Boolean,
)

@Entity(tableName = "spend_limits")
data class LimitEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val userId: Long,
    val name: String,
    val kind: String,
    val maxKopecks: Long,
    val alertPercent: Int,
    val unitLabel: String,
)

@Entity(tableName = "smart_contracts")
data class SmartContractEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val userId: Long,
    val name: String,
    val triggerLabel: String,
    val amountKopecks: Long,
    val recipient: String,
    val active: Boolean,
    val nextRunLabel: String,
)

@Entity(tableName = "ml_alerts")
data class MlAlertEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val userId: Long,
    val title: String,
    val body: String,
    val score: Float,
    val createdAt: Long,
    val read: Boolean = false,
)

@Entity(tableName = "outbox")
data class OutboxEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val userId: Long,
    val payload: String,
    val createdAt: Long,
    val synced: Boolean = false,
)
