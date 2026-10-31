package ru.raidzyu.alfacr.data.remote

interface RemoteBankApi {
    suspend fun login(email: String, password: String): Result<RemoteSnap>
    suspend fun register(payload: Map<String, String>): Result<RemoteSnap>
    suspend fun me(token: String): Result<RemoteSnap>
    suspend fun transfer(token: String, payee: String, amount: Double, comment: String): Result<RemoteSnap>
    suspend fun topUp(token: String, amount: Double): Result<RemoteSnap>
}

class OfflineRemoteApi : RemoteBankApi {
    override suspend fun login(email: String, password: String) =
        Result.failure<RemoteSnap>(IllegalStateException("REMOTE_DISABLED"))

    override suspend fun register(payload: Map<String, String>) =
        Result.failure<RemoteSnap>(IllegalStateException("REMOTE_DISABLED"))

    override suspend fun me(token: String) =
        Result.failure<RemoteSnap>(IllegalStateException("REMOTE_DISABLED"))

    override suspend fun transfer(token: String, payee: String, amount: Double, comment: String) =
        Result.failure<RemoteSnap>(IllegalStateException("REMOTE_DISABLED"))

    override suspend fun topUp(token: String, amount: Double) =
        Result.failure<RemoteSnap>(IllegalStateException("REMOTE_DISABLED"))
}
