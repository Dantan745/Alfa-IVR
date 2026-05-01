package com.example.alfabankivrub.core.util

import java.security.MessageDigest

object PasswordHasher {
    fun hash(raw: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hashBytes = digest.digest(raw.toByteArray())
        return buildString {
            hashBytes.forEach { append("%02x".format(it)) }
        }
    }
}
