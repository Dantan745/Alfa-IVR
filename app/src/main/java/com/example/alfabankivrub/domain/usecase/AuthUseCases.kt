package com.example.alfabankivrub.domain.usecase

import com.example.alfabankivrub.domain.model.AuthUser
import com.example.alfabankivrub.domain.model.RegistrationDraft
import com.example.alfabankivrub.domain.repository.AuthRepository

class RegisterUserUseCase(private val repository: AuthRepository) {
    suspend operator fun invoke(draft: RegistrationDraft): Result<AuthUser> = repository.register(draft)
}

class LoginUseCase(private val repository: AuthRepository) {
    suspend operator fun invoke(email: String, password: String): Result<AuthUser> =
        repository.login(email, password)
}

class GetActiveSessionUseCase(private val repository: AuthRepository) {
    suspend operator fun invoke(): AuthUser? = repository.getActiveUser()
}

class LogoutUseCase(private val repository: AuthRepository) {
    suspend operator fun invoke() = repository.logout()
}
