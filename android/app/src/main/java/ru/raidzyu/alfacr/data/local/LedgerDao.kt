package ru.raidzyu.alfacr.data.local

import androidx.paging.PagingSource
import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Transaction

/** Атомарное списание + запись операции (план: @Transaction). */
@Dao
abstract class LedgerDao {
    @Query("UPDATE accounts SET balanceKopecks = :balance WHERE userId = :userId")
    abstract suspend fun setBalance(userId: Long, balance: Long)

    @Insert
    abstract suspend fun insertTx(entity: TransactionEntity): Long

    @Insert
    abstract suspend fun insertAlert(entity: MlAlertEntity): Long

    @Transaction
    open suspend fun commitTransfer(
        userId: Long,
        newBalance: Long,
        tx: TransactionEntity,
        alert: MlAlertEntity?,
    ): Long {
        setBalance(userId, newBalance)
        val id = insertTx(tx)
        if (alert != null) insertAlert(alert)
        return id
    }

    @Transaction
    open suspend fun commitTopUp(userId: Long, newBalance: Long, tx: TransactionEntity) {
        setBalance(userId, newBalance)
        insertTx(tx)
    }
}

@Dao
interface PagingTxDao {
    @Query(
        """
        SELECT * FROM transactions
        WHERE userId = :userId
          AND (:q = '' OR counterpart LIKE '%' || :q || '%')
          AND (
            :filter = 'Все'
            OR (:filter = 'Расходы' AND type = 'expense')
            OR (:filter = 'Доходы' AND type = 'income')
            OR (:filter = 'Переводы' AND category = 'Переводы')
          )
        ORDER BY createdAt DESC
        """,
    )
    fun paging(userId: Long, q: String, filter: String): PagingSource<Int, TransactionEntity>
}
