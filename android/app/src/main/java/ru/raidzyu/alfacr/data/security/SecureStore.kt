package ru.raidzyu.alfacr.data.security

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys

/** Сессия в EncryptedSharedPreferences. Если Keystore недоступен — обычные prefs, чтобы не падать. */
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

    var deviceId: String
        get() {
            val existing = prefs.getString(KEY_DEVICE, "") ?: ""
            if (existing.isNotBlank()) return existing
            val fresh = java.util.UUID.randomUUID().toString()
            prefs.edit().putString(KEY_DEVICE, fresh).apply()
            return fresh
        }
        set(value) = prefs.edit().putString(KEY_DEVICE, value).apply()

    var loginAttempts: Int
        get() = prefs.getInt(KEY_ATTEMPTS, 1).coerceAtLeast(1)
        set(value) = prefs.edit().putInt(KEY_ATTEMPTS, value.coerceAtLeast(1)).apply()

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
        const val KEY_DEVICE = "device_id"
        const val KEY_ATTEMPTS = "login_attempts"
    }
}
