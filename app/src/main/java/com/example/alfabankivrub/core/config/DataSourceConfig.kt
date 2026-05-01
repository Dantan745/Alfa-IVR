package com.example.alfabankivrub.core.config

enum class AuthDataSourceMode {
    LOCAL_ONLY,
    HYBRID_LOCAL_FIRST
}

object DataSourceConfig {
    // Prepared for server API switch (PostgreSQL backend).
    const val BASE_URL = "https://api.example.com/"
    val authMode: AuthDataSourceMode = AuthDataSourceMode.HYBRID_LOCAL_FIRST
}
