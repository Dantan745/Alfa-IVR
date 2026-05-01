package com.example.alfabankivrub.core.di

import android.content.Context
import com.example.alfabankivrub.data.local.AppDatabase
import com.example.alfabankivrub.data.repository.AuthRepositoryImpl
import com.example.alfabankivrub.domain.repository.AuthRepository
import com.example.alfabankivrub.domain.usecase.GetActiveSessionUseCase
import com.example.alfabankivrub.domain.usecase.LoginUseCase
import com.example.alfabankivrub.domain.usecase.LogoutUseCase
import com.example.alfabankivrub.domain.usecase.RegisterUserUseCase

class AppContainer(context: Context) {
    private val database = AppDatabase.getInstance(context)
    private val authRepository: AuthRepository = AuthRepositoryImpl(
        userDao = database.userDao(),
        sessionDao = database.sessionDao()
    )

    val registerUserUseCase = RegisterUserUseCase(authRepository)
    val loginUseCase = LoginUseCase(authRepository)
    val getActiveSessionUseCase = GetActiveSessionUseCase(authRepository)
    val logoutUseCase = LogoutUseCase(authRepository)
}
