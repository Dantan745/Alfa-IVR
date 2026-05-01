package com.example.alfabankivrub.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "users",
    indices = [Index(value = ["email"], unique = true), Index(value = ["phone"], unique = true)]
)
data class UserEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0L,
    val lastName: String,
    val firstName: String,
    val middleName: String,
    val passportNumber: String,
    val passportDate: String,
    val passportDepartmentCode: String,
    val phone: String,
    val email: String,
    val passwordHash: String
)
