package ru.raidzyu.alfacr.data.security

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys

/**
 * Сессия в EncryptedSharedPreferences (API 1.0.0 — MasterKeys, работает с minSdk 24).
 * Если Keystore недоступен — fallback, чтобы не падать на чужом эмуляторе.
 */
class SecureStore(context: Context) {
    private val prefs: SharedPreferences = try {
        val alias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
        EncryptedSharedPreferences.create(
            "alfa_cr_secure",
            alias,
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    } catch (_: Exception) {
        context.getSharedPreferences("alfa_cr_secure_fallback", Context.MODE_PRIVATE)
    }

    var userId: Long
        get() = prefs.getLong(KEY_USER, -1L)
        set(value) = prefs.edit().putLong(KEY_USER, value).apply()

    var sessionUntil: Long
        get() = prefs.getLong(KEY_UNTIL, 0L)
        set(value) = prefs.edit().putLong(KEY_UNTIL, value).apply()

    var biometricEnabled: Boolean
        get() = prefs.getBoolean(KEY_BIO, false)
        set(value) = prefs.edit().putBoolean(KEY_BIO, value).apply()

    var apiToken: String
        get() = prefs.getString(KEY_TOKEN, "") ?: ""
        set(value) = prefs.edit().putString(KEY_TOKEN, value).apply()

    fun hasFreshSession(): Boolean = userId > 0 && System.currentTimeMillis() < sessionUntil

    fun startSession(id: Long, durationMs: Long = 15 * 60 * 1000L) {
        userId = id
        sessionUntil = System.currentTimeMillis() + durationMs
    }

    fun clearSession() {
        prefs.edit().remove(KEY_USER).remove(KEY_UNTIL).remove(KEY_TOKEN).apply()
    }

    private companion object {
        const val KEY_USER = "user_id"
        const val KEY_UNTIL = "session_until"
        const val KEY_BIO = "bio"
        const val KEY_TOKEN = "api_token"
    }
}
