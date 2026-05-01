package com.example.alfabankivrub.domain.repository

import com.example.alfabankivrub.domain.model.AuthUser
import com.example.alfabankivrub.domain.model.RegistrationDraft

interface AuthRepository {
    suspend fun register(draft: RegistrationDraft): Result<AuthUser>
    suspend fun login(email: String, password: String): Result<AuthUser>
    suspend fun getActiveUser(): AuthUser?
    suspend fun logout()
}
