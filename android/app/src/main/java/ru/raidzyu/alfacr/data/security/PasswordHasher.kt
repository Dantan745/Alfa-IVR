package ru.raidzyu.alfacr.data.security

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Arrays
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

/** PBKDF2-HMAC-SHA1: на API 24 нет варианта SHA256. 12 тысяч итераций, чтобы вход не подвисал. */
object PasswordHasher {
    private const val ITERATIONS = 12_000
    private const val KEY_BITS = 256

    data class HashResult(val hash: String, val salt: String)

    fun hashPassword(password: String): HashResult {
        val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
        return HashResult(hash(password, toHex(salt)), toHex(salt))
    }

    fun hash(password: String, saltHex: String): String {
        val salt = fromHex(saltHex)
        val spec = PBEKeySpec(password.toCharArray(), salt, ITERATIONS, KEY_BITS)
        val factory = try {
            SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        } catch (_: Exception) {
            SecretKeyFactory.getInstance("PBKDF2WithHmacSHA1")
        }
        val encoded = factory.generateSecret(spec).encoded
        spec.clearPassword()
        return toHex(encoded)
    }

    fun verify(password: String, saltHex: String, expectedHex: String): Boolean {
        val actual = fromHex(hash(password, saltHex))
        val expected = fromHex(expectedHex)
        return MessageDigest.isEqual(actual, expected).also {
            Arrays.fill(actual, 0)
            Arrays.fill(expected, 0)
        }
    }

    private fun toHex(bytes: ByteArray) = bytes.joinToString("") { "%02x".format(it) }

    private fun fromHex(hex: String): ByteArray {
        val clean = if (hex.length % 2 == 0) hex else "0$hex"
        return ByteArray(clean.length / 2) { i ->
            clean.substring(i * 2, i * 2 + 2).toInt(16).toByte()
        }
    }
}
