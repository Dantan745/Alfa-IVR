package ru.raidzyu.alfacr.data.remote

import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

data class RemoteSnap(
    val token: String?,
    val email: String,
    val lastName: String,
    val firstName: String,
    val middleName: String,
    val phone: String,
    val walletId: String,
    val balance: Double,
    val pin: String,
    val hideBalance: Boolean,
    val txs: List<RemoteTx>,
    val contacts: List<RemoteContact>,
    val notes: List<RemoteNote>,
)

data class RemoteTx(
    val id: String,
    val name: String,
    val amount: Double,
    val type: String,
    val icon: String,
    val category: String,
    val comment: String,
    val createdAt: Long,
    val status: String,
)

data class RemoteContact(
    val id: String,
    val name: String,
    val phone: String,
    val wallet: String,
    val initials: String,
    val color: String,
    val favorite: Boolean,
)

data class RemoteNote(
    val title: String,
    val body: String,
    val createdAt: Long,
    val read: Boolean,
)

class HttpBankApi(private val baseUrl: String) : RemoteBankApi {
    override suspend fun login(email: String, password: String): Result<RemoteSnap> =
        request("/api/auth/login", "POST", JSONObject().put("email", email).put("password", password))

    override suspend fun register(payload: Map<String, String>): Result<RemoteSnap> {
        val body = JSONObject()
        payload.forEach { (k, v) -> body.put(k, v) }
        return request("/api/auth/register", "POST", body)
    }

    override suspend fun me(token: String): Result<RemoteSnap> = request("/api/me", "GET", null, token)

    override suspend fun transfer(token: String, payee: String, amount: Double, comment: String): Result<RemoteSnap> =
        request("/api/transfer", "POST", JSONObject().put("payee", payee).put("amount", amount).put("comment", comment), token)

    override suspend fun topUp(token: String, amount: Double): Result<RemoteSnap> =
        request("/api/topup", "POST", JSONObject().put("amount", amount), token)

    private fun request(path: String, method: String, body: JSONObject?, token: String? = null): Result<RemoteSnap> {
        return try {
            val conn = (URL(baseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = 8000
                readTimeout = 8000
                setRequestProperty("Accept", "application/json")
                if (!token.isNullOrBlank()) setRequestProperty("Authorization", "Bearer $token")
                if (body != null) {
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=utf-8")
                    OutputStreamWriter(outputStream, Charsets.UTF_8).use { it.write(body.toString()) }
                }
            }
            val code = conn.responseCode
            val text = (if (code in 200..299) conn.inputStream else conn.errorStream)
                ?.bufferedReader(Charsets.UTF_8)?.readText().orEmpty()
            val json = if (text.isBlank()) JSONObject() else JSONObject(text)
            if (code !in 200..299) {
                Result.failure(IllegalArgumentException(json.optString("error", "Ошибка сервера ($code)")))
            } else {
                Result.success(parseSnap(json))
            }
        } catch (e: Exception) {
            Result.failure(IllegalStateException("Нет связи с сервером (${baseUrl}): ${e.message}"))
        }
    }

    private fun parseSnap(json: JSONObject): RemoteSnap {
        val user = json.optJSONObject("user") ?: JSONObject()
        val wallet = json.optJSONObject("wallet") ?: JSONObject()
        return RemoteSnap(
            token = json.optString("token").ifBlank { null },
            email = user.optString("email"),
            lastName = user.optString("lastName"),
            firstName = user.optString("firstName"),
            middleName = user.optString("middleName"),
            phone = user.optString("phone"),
            walletId = user.optString("walletId"),
            balance = wallet.optDouble("balance", 0.0),
            pin = wallet.optString("pin", "1234"),
            hideBalance = wallet.optBoolean("hideBalance", false),
            txs = jsonArray(json.optJSONArray("txs")).map {
                RemoteTx(
                    id = it.optString("id"),
                    name = it.optString("name"),
                    amount = it.optDouble("amount"),
                    type = it.optString("type"),
                    icon = it.optString("icon"),
                    category = it.optString("category"),
                    comment = it.optString("comment"),
                    createdAt = it.optLong("createdAt"),
                    status = it.optString("status", "done"),
                )
            },
            contacts = jsonArray(json.optJSONArray("contacts")).map {
                RemoteContact(
                    id = it.optString("id"),
                    name = it.optString("name"),
                    phone = it.optString("phone"),
                    wallet = it.optString("wallet"),
                    initials = it.optString("initials"),
                    color = it.optString("color"),
                    favorite = it.optBoolean("favorite"),
                )
            },
            notes = jsonArray(json.optJSONArray("notes")).map {
                RemoteNote(
                    title = it.optString("title"),
                    body = it.optString("body"),
                    createdAt = it.optLong("createdAt"),
                    read = it.optBoolean("read"),
                )
            },
        )
    }

    private fun jsonArray(arr: JSONArray?): List<JSONObject> {
        if (arr == null) return emptyList()
        return (0 until arr.length()).map { arr.getJSONObject(it) }
    }
}
