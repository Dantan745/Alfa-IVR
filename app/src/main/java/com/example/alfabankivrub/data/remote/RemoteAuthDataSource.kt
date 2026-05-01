package com.example.alfabankivrub.data.remote

import com.example.alfabankivrub.data.remote.dto.AuthRequestDto
import com.example.alfabankivrub.data.remote.dto.AuthResponseDto
import com.example.alfabankivrub.data.remote.dto.RegisterRequestDto

interface RemoteAuthDataSource {
    suspend fun register(request: RegisterRequestDto): AuthResponseDto
    suspend fun login(request: AuthRequestDto): AuthResponseDto
    suspend fun getProfile(accessToken: String): AuthResponseDto
}
