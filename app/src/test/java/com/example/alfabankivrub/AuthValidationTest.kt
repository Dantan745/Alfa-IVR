package com.example.alfabankivrub

import com.example.alfabankivrub.core.util.PasswordHasher
import com.example.alfabankivrub.domain.model.AuthUser
import com.example.alfabankivrub.domain.model.RegistrationDraft
import com.example.alfabankivrub.domain.repository.AuthRepository
import com.example.alfabankivrub.domain.usecase.GetActiveSessionUseCase
import com.example.alfabankivrub.domain.usecase.LoginUseCase
import com.example.alfabankivrub.domain.usecase.RegisterUserUseCase
import com.example.alfabankivrub.feature.auth.AuthViewModel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AuthValidationTest {

    private val vm = AuthViewModel(
        registerUserUseCase = RegisterUserUseCase(FakeAuthRepository()),
        loginUseCase = LoginUseCase(FakeAuthRepository()),
        getActiveSessionUseCase = GetActiveSessionUseCase(FakeAuthRepository())
    )

    @Test
    fun `password hash is deterministic and not plain text`() {
        val hash1 = PasswordHasher.hash("password123")
        val hash2 = PasswordHasher.hash("password123")
        assertEquals(hash1, hash2)
        assertNotEquals("password123", hash1)
    }

    @Test
    fun `step1 validation passes on filled fio`() {
        vm.updateRegistration {
            it.copy(lastName = "Иванов", firstName = "Иван", middleName = "Иванович")
        }
        assertNull(vm.validateStep1())
    }

    @Test
    fun `step2 validation returns error on short passport`() {
        vm.updateRegistration { it.copy(passportNumber = "123", passportDate = "", passportDepartmentCode = "12") }
        val error = vm.validateStep2()
        assertEquals("Серия и номер паспорта должны содержать минимум 10 цифр", error)
    }
}

private class FakeAuthRepository : AuthRepository {
    override suspend fun register(draft: RegistrationDraft): Result<AuthUser> {
        return Result.success(AuthUser(1, "Test User", draft.email, draft.phone))
    }

    override suspend fun login(email: String, password: String): Result<AuthUser> {
        return Result.success(AuthUser(1, "Test User", email, "+79999999999"))
    }

    override suspend fun getActiveUser(): AuthUser? = null

    override suspend fun logout() = Unit
}
