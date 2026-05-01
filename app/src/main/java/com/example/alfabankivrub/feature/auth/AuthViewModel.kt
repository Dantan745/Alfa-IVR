package com.example.alfabankivrub.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.alfabankivrub.domain.model.AuthUser
import com.example.alfabankivrub.domain.model.RegistrationDraft
import com.example.alfabankivrub.domain.usecase.GetActiveSessionUseCase
import com.example.alfabankivrub.domain.usecase.LoginUseCase
import com.example.alfabankivrub.domain.usecase.RegisterUserUseCase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AuthUiState(
    val sessionChecked: Boolean = false,
    val loading: Boolean = false,
    val error: String? = null,
    val activeUser: AuthUser? = null,
    val loginEmail: String = "",
    val loginPassword: String = "",
    val registrationDraft: RegistrationDraft = RegistrationDraft()
)

class AuthViewModel(
    private val registerUserUseCase: RegisterUserUseCase,
    private val loginUseCase: LoginUseCase,
    private val getActiveSessionUseCase: GetActiveSessionUseCase
) : ViewModel() {
    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state.asStateFlow()

    init {
        checkActiveSession()
    }

    fun updateLoginEmail(value: String) = _state.update { it.copy(loginEmail = value, error = null) }
    fun updateLoginPassword(value: String) = _state.update { it.copy(loginPassword = value, error = null) }

    fun updateRegistration(update: (RegistrationDraft) -> RegistrationDraft) {
        _state.update { it.copy(registrationDraft = update(it.registrationDraft), error = null) }
    }

    fun login(onSuccess: () -> Unit) {
        val email = state.value.loginEmail.trim()
        val password = state.value.loginPassword
        if (email.isBlank() || password.isBlank()) {
            _state.update { it.copy(error = "Введите email и пароль") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            val result = loginUseCase(email, password)
            result.onSuccess { user ->
                _state.update { it.copy(loading = false, activeUser = user) }
                onSuccess()
            }.onFailure { e ->
                _state.update { it.copy(loading = false, error = e.message ?: "Ошибка авторизации") }
            }
        }
    }

    fun validateStep1(): String? {
        val d = state.value.registrationDraft
        return when {
            d.lastName.isBlank() -> "Введите фамилию"
            d.firstName.isBlank() -> "Введите имя"
            d.middleName.isBlank() -> "Введите отчество"
            else -> null
        }
    }

    fun validateStep2(): String? {
        val d = state.value.registrationDraft
        return when {
            d.passportNumber.length < 10 -> "Серия и номер паспорта должны содержать минимум 10 цифр"
            d.passportDate.isBlank() -> "Введите дату выдачи"
            d.passportDepartmentCode.length < 6 -> "Введите код подразделения"
            else -> null
        }
    }

    fun register(onSuccess: () -> Unit) {
        val d = state.value.registrationDraft
        val step2Error = validateStep2()
        if (step2Error != null) {
            _state.update { it.copy(error = step2Error) }
            return
        }
        val error = when {
            d.phone.length < 11 -> "Введите корректный номер телефона"
            !d.email.contains("@") -> "Введите корректную почту"
            d.password.length < 6 -> "Пароль должен быть не короче 6 символов"
            !d.acceptedPolicy -> "Нужно принять правила обработки данных"
            else -> null
        }
        if (error != null) {
            _state.update { it.copy(error = error) }
            return
        }

        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            val result = registerUserUseCase(d)
            result.onSuccess { user ->
                _state.update {
                    it.copy(
                        loading = false,
                        activeUser = user,
                        loginEmail = user.email,
                        loginPassword = ""
                    )
                }
                onSuccess()
            }.onFailure { e ->
                _state.update { it.copy(loading = false, error = e.message ?: "Ошибка регистрации") }
            }
        }
    }

    fun clearError() = _state.update { it.copy(error = null) }
    fun setError(message: String) = _state.update { it.copy(error = message) }

    private fun checkActiveSession() {
        viewModelScope.launch {
            val user = getActiveSessionUseCase()
            _state.update { it.copy(activeUser = user, sessionChecked = true) }
        }
    }
}

class AuthViewModelFactory(
    private val registerUserUseCase: RegisterUserUseCase,
    private val loginUseCase: LoginUseCase,
    private val getActiveSessionUseCase: GetActiveSessionUseCase
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(AuthViewModel::class.java)) {
            return AuthViewModel(registerUserUseCase, loginUseCase, getActiveSessionUseCase) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
