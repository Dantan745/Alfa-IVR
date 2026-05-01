package com.example.alfabankivrub.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.example.alfabankivrub.data.local.entity.SessionEntity

@Dao
interface SessionDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(session: SessionEntity)

    @Query("SELECT * FROM session WHERE id = 0 LIMIT 1")
    suspend fun getActiveSession(): SessionEntity?

    @Query("DELETE FROM session WHERE id = 0")
    suspend fun clear()
}
