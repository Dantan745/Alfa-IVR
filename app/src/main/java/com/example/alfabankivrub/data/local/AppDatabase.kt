package com.example.alfabankivrub.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.example.alfabankivrub.data.local.dao.SessionDao
import com.example.alfabankivrub.data.local.dao.UserDao
import com.example.alfabankivrub.data.local.entity.SessionEntity
import com.example.alfabankivrub.data.local.entity.UserEntity

@Database(
    entities = [UserEntity::class, SessionEntity::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun userDao(): UserDao
    abstract fun sessionDao(): SessionDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "abank.db"
                ).build().also { INSTANCE = it }
            }
        }
    }
}
