package com.example.alfabankivrub.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.alfabankivrub.domain.model.AuthUser
import com.example.alfabankivrub.domain.usecase.GetActiveSessionUseCase
import com.example.alfabankivrub.domain.usecase.LogoutUseCase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class HomeUiState(
    val user: AuthUser? = null
)

class HomeViewModel(
    private val getActiveSessionUseCase: GetActiveSessionUseCase,
    private val logoutUseCase: LogoutUseCase
) : ViewModel() {
    private val _state = MutableStateFlow(HomeUiState())
    val state: StateFlow<HomeUiState> = _state.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _state.update { it.copy(user = getActiveSessionUseCase()) }
        }
    }

    fun logout(onDone: () -> Unit) {
        viewModelScope.launch {
            logoutUseCase()
            _state.update { it.copy(user = null) }
            onDone()
        }
    }
}

class HomeViewModelFactory(
    private val getActiveSessionUseCase: GetActiveSessionUseCase,
    private val logoutUseCase: LogoutUseCase
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(HomeViewModel::class.java)) {
            return HomeViewModel(getActiveSessionUseCase, logoutUseCase) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
