package com.example.alfabankivrub.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "session")
data class SessionEntity(
    @PrimaryKey val id: Int = 0,
    val userId: Long
)
