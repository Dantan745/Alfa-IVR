package com.example.alfabankivrub.data.remote.dto

data class RegisterRequestDto(
    val lastName: String,
    val firstName: String,
    val middleName: String,
    val passportNumber: String,
    val passportDate: String,
    val passportDepartmentCode: String,
    val phone: String,
    val email: String,
    val password: String
)

data class AuthRequestDto(
    val email: String,
    val password: String
)

data class AuthResponseDto(
    val userId: Long,
    val displayName: String,
    val email: String,
    val phone: String,
    val accessToken: String
)
