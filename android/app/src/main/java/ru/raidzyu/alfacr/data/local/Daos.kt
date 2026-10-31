package ru.raidzyu.alfacr.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface UserDao {
    @Insert
    suspend fun insert(user: UserEntity): Long

    @Query("SELECT * FROM users WHERE email = :email LIMIT 1")
    suspend fun byEmail(email: String): UserEntity?

    @Query("SELECT * FROM users WHERE phone = :phone LIMIT 1")
    suspend fun byPhone(phone: String): UserEntity?

    @Query("SELECT * FROM users WHERE id = :id LIMIT 1")
    suspend fun byId(id: Long): UserEntity?

    @Query("SELECT * FROM users WHERE id = :id LIMIT 1")
    fun observe(id: Long): Flow<UserEntity?>

    @Update
    suspend fun update(user: UserEntity)
}

@Dao
interface CredentialDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: CredentialEntity)

    @Query("SELECT * FROM credentials WHERE userId = :userId LIMIT 1")
    suspend fun byUser(userId: Long): CredentialEntity?
}

@Dao
interface AccountDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: AccountEntity)

    @Query("SELECT * FROM accounts WHERE userId = :userId LIMIT 1")
    suspend fun byUser(userId: Long): AccountEntity?

    @Query("SELECT * FROM accounts WHERE userId = :userId LIMIT 1")
    fun observe(userId: Long): Flow<AccountEntity?>

    @Query("UPDATE accounts SET balanceKopecks = :balance WHERE userId = :userId")
    suspend fun setBalance(userId: Long, balance: Long)
}

@Dao
interface TransactionDao {
    @Insert
    suspend fun insert(entity: TransactionEntity): Long

    @Query(
        """
        SELECT * FROM transactions
        WHERE userId = :userId
        ORDER BY createdAt DESC
        LIMIT :limit
        """,
    )
    fun observeRecent(userId: Long, limit: Int = 80): Flow<List<TransactionEntity>>

    @Query(
        """
        SELECT COALESCE(SUM(CASE WHEN amountKopecks < 0 THEN -amountKopecks ELSE 0 END), 0)
        FROM transactions WHERE userId = :userId AND createdAt >= :from AND type = 'expense'
        """,
    )
    suspend fun spentSince(userId: Long, from: Long): Long

    @Query(
        """
        SELECT COALESCE(SUM(CASE WHEN amountKopecks < 0 THEN -amountKopecks ELSE 0 END), 0)
        FROM transactions WHERE userId = :userId AND createdAt >= :from AND type = 'expense' AND category = 'Переводы'
        """,
    )
    suspend fun transferSpentSince(userId: Long, from: Long): Long

    @Query(
        """
        SELECT COALESCE(SUM(CASE WHEN amountKopecks > 0 THEN amountKopecks ELSE 0 END), 0)
        FROM transactions WHERE userId = :userId AND createdAt >= :from
        """,
    )
    suspend fun incomeSince(userId: Long, from: Long): Long

    @Query("DELETE FROM transactions WHERE userId = :userId")
    suspend fun deleteForUser(userId: Long)
}

@Dao
interface ContactDao {
    @Insert
    suspend fun insert(entity: ContactEntity): Long

    @Update
    suspend fun update(entity: ContactEntity)

    @Query("SELECT * FROM contacts WHERE userId = :userId ORDER BY favorite DESC, name ASC")
    fun observe(userId: Long): Flow<List<ContactEntity>>

    @Query("DELETE FROM contacts WHERE userId = :userId")
    suspend fun deleteForUser(userId: Long)
}

@Dao
interface LimitDao {
    @Insert
    suspend fun insert(entity: LimitEntity): Long

    @Update
    suspend fun update(entity: LimitEntity)

    @Query("SELECT * FROM spend_limits WHERE userId = :userId")
    fun observe(userId: Long): Flow<List<LimitEntity>>

    @Query("SELECT * FROM spend_limits WHERE userId = :userId")
    suspend fun all(userId: Long): List<LimitEntity>
}

@Dao
interface SmartContractDao {
    @Insert
    suspend fun insert(entity: SmartContractEntity): Long

    @Update
    suspend fun update(entity: SmartContractEntity)

    @Query("SELECT * FROM smart_contracts WHERE userId = :userId ORDER BY id DESC")
    fun observe(userId: Long): Flow<List<SmartContractEntity>>
}

@Dao
interface MlAlertDao {
    @Insert
    suspend fun insert(entity: MlAlertEntity): Long

    @Query("SELECT * FROM ml_alerts WHERE userId = :userId AND read = 0 ORDER BY createdAt DESC LIMIT 5")
    fun observeUnread(userId: Long): Flow<List<MlAlertEntity>>

    @Query("DELETE FROM ml_alerts WHERE userId = :userId")
    suspend fun deleteForUser(userId: Long)
}

@Dao
interface OutboxDao {
    @Insert
    suspend fun insert(entity: OutboxEntity): Long

    @Query("SELECT * FROM outbox WHERE userId = :userId AND synced = 0")
    fun observePending(userId: Long): Flow<List<OutboxEntity>>
}
