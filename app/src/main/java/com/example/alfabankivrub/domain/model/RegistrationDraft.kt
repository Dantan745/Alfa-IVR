package com.example.alfabankivrub.domain.model

data class RegistrationDraft(
    val lastName: String = "",
    val firstName: String = "",
    val middleName: String = "",
    val passportNumber: String = "",
    val passportDate: String = "",
    val passportDepartmentCode: String = "",
    val phone: String = "",
    val email: String = "",
    val password: String = "",
    val acceptedPolicy: Boolean = false
)
