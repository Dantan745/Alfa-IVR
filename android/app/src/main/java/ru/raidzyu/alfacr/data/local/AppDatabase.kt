package ru.raidzyu.alfacr.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        UserEntity::class,
        CredentialEntity::class,
        AccountEntity::class,
        TransactionEntity::class,
        ContactEntity::class,
        LimitEntity::class,
        SmartContractEntity::class,
        MlAlertEntity::class,
        OutboxEntity::class,
    ],
    version = 1,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun users(): UserDao
    abstract fun credentials(): CredentialDao
    abstract fun accounts(): AccountDao
    abstract fun transactions(): TransactionDao
    abstract fun contacts(): ContactDao
    abstract fun limits(): LimitDao
    abstract fun contracts(): SmartContractDao
    abstract fun alerts(): MlAlertDao
    abstract fun outbox(): OutboxDao
    abstract fun ledger(): LedgerDao
    abstract fun pagingTx(): PagingTxDao

    companion object {
        @Volatile
        private var instance: AppDatabase? = null

        fun get(context: Context): AppDatabase {
            return instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "alfa_cr.db",
                )
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { instance = it }
            }
        }
    }
}
