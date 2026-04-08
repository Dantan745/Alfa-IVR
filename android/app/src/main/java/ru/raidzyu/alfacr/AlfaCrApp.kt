package ru.raidzyu.alfacr

import android.app.Application
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import ru.raidzyu.alfacr.data.WalletRepository
import ru.raidzyu.alfacr.data.local.AppDatabase
import ru.raidzyu.alfacr.data.remote.HttpBankApi
import ru.raidzyu.alfacr.data.security.SecureStore

class AlfaCrApp : Application() {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    lateinit var db: AppDatabase
        private set
    lateinit var store: SecureStore
        private set
    lateinit var repo: WalletRepository
        private set

    override fun onCreate() {
        super.onCreate()
        db = AppDatabase.get(this)
        store = SecureStore(this)
        val apiBase = getString(R.string.api_base)
        repo = WalletRepository(db, store, remote = HttpBankApi(apiBase))
        scope.launch { repo.ensureDemo() }
    }
}
