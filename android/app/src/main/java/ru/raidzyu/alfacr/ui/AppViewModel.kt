package ru.raidzyu.alfacr.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.withContext
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.transform
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import androidx.paging.cachedIn
import androidx.paging.PagingData
import ru.raidzyu.alfacr.AlfaCrApp
import ru.raidzyu.alfacr.domain.TransferResult
import ru.raidzyu.alfacr.data.local.ContactEntity
import ru.raidzyu.alfacr.data.local.LimitEntity
import ru.raidzyu.alfacr.data.local.SmartContractEntity
import ru.raidzyu.alfacr.data.local.UserEntity

@OptIn(ExperimentalCoroutinesApi::class)
class AppViewModel(app: Application) : AndroidViewModel(app) {
    private val a = app as AlfaCrApp
    val repo get() = a.repo
    val store get() = a.store

    val toast = MutableStateFlow<String?>(null)
    val userId = MutableStateFlow(if (store.hasFreshSession()) store.userId else -1L)
    val locked = MutableStateFlow(store.hasFreshSession())

    val user: StateFlow<UserEntity?> = userId.flatMapLatest { id ->
        if (id > 0) repo.user(id) else flowOf(null)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    val account = userId.flatMapLatest { id ->
        if (id > 0) repo.account(id) else flowOf(null)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    val txs = userId.flatMapLatest { id ->
        if (id > 0) repo.txs(id) else flowOf(emptyList())
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val contacts = userId.flatMapLatest { id ->
        if (id > 0) repo.contacts(id) else flowOf(emptyList())
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val limits = userId.flatMapLatest { id ->
        if (id > 0) repo.limits(id) else flowOf(emptyList())
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val contracts = userId.flatMapLatest { id ->
        if (id > 0) repo.contracts(id) else flowOf(emptyList())
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val alerts = userId.flatMapLatest { id ->
        if (id > 0) repo.alerts(id) else flowOf(emptyList())
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val historySearch = MutableStateFlow("")
    val historyFilter = MutableStateFlow("Все")
    val txPaging = combine(userId, historySearch, historyFilter) { id, q, f -> Triple(id, q, f) }
        .flatMapLatest { (id, q, f) ->
            if (id > 0) repo.pagedTxs(id, q, f) else flowOf(PagingData.empty())
        }
        .cachedIn(viewModelScope)

    val spent = MutableStateFlow(0L)
    val income = MutableStateFlow(0L)
    val forecast = MutableStateFlow(0L)
    val online = MutableStateFlow(true)

    init {
        viewModelScope.launch(Dispatchers.IO) {
            repo.ensureDemo()
            userId.flatMapLatest { id ->
                if (id <= 0) {
                    flowOf(Triple(0L, 0L, 0L))
                } else {
                    repo.txs(id).transform {
                        emit(Triple(repo.monthSpent(id), repo.monthIncome(id), repo.forecast(id)))
                    }
                }
            }.collect { (monthSpent, monthIncome, monthForecast) ->
                spent.value = monthSpent
                income.value = monthIncome
                forecast.value = monthForecast
            }
        }
    }

    fun refreshStats() {
        val id = userId.value
        if (id <= 0) return
        viewModelScope.launch(Dispatchers.IO) {
            spent.value = repo.monthSpent(id)
            income.value = repo.monthIncome(id)
            forecast.value = repo.forecast(id)
        }
    }

    fun login(email: String, password: String, onOk: () -> Unit) {
        viewModelScope.launch {
            val result = withContext(Dispatchers.IO) {
                repo.ensureDemo()
                val mail = email.ifBlank { "ivan@alfa.demo" }
                val pass = password.ifBlank { "Demo1234" }
                repo.login(mail, pass)
            }
            result.onSuccess {
                store.startSession(it.id)
                userId.value = it.id
                locked.value = false
                refreshStats()
                onOk()
            }.onFailure { toast.value = it.message }
        }
    }

    fun register(
        last: String, first: String, middle: String, passport: String,
        phone: String, email: String, password: String, onOk: () -> Unit,
    ) {
        viewModelScope.launch {
            val result = withContext(Dispatchers.IO) {
                repo.register(
                    last.ifBlank { "Иванов" },
                    first.ifBlank { "Иван" },
                    middle.ifBlank { "Иванович" },
                    passport.ifBlank { "0000 000000" },
                    phone.ifBlank { "+7 (900) 123-45-67" },
                    email.ifBlank { "user${System.currentTimeMillis()}@alfa.demo" },
                    if (password.length >= 6) password else "Demo1234",
                )
            }
            result.onSuccess {
                store.startSession(it.id)
                userId.value = it.id
                locked.value = false
                refreshStats()
                onOk()
            }.onFailure { toast.value = it.message }
        }
    }

    fun unlockWithBiometric() {
        locked.value = false
        val id = store.userId
        if (id > 0) {
            store.startSession(id)
            userId.value = id
            refreshStats()
        }
    }

    fun unlockPin(pin: String, onOk: () -> Unit) {
        viewModelScope.launch {
            val id = store.userId
            val ok = withContext(Dispatchers.IO) { repo.verifyPin(id, pin) }
            if (ok) {
                store.startSession(id)
                userId.value = id
                locked.value = false
                onOk()
            } else toast.value = "Неверный PIN"
        }
    }

    fun logout() {
        store.clearSession()
        userId.value = -1
        locked.value = false
    }

    fun transfer(payee: String, amount: Double, comment: String, isNew: Boolean, onOk: () -> Unit) {
        viewModelScope.launch {
            val r = withContext(Dispatchers.IO) { repo.transfer(userId.value, payee, amount, comment, isNew) }
            when (r) {
                is TransferResult.Ok -> {
                    refreshStats()
                    onOk()
                    if (r.anomaly.score >= 0.4f) toast.value = "ML: ${r.anomaly.explanation}"
                }
                is TransferResult.Fail -> toast.value = r.message
            }
        }
    }

    fun topUp(amount: Double, onOk: () -> Unit) {
        viewModelScope.launch {
            val result = withContext(Dispatchers.IO) { repo.topUp(userId.value, amount) }
            result.onSuccess {
                refreshStats()
                onOk()
            }.onFailure { toast.value = it.message }
        }
    }

    fun addContact(name: String, phone: String) {
        viewModelScope.launch(Dispatchers.IO) { repo.addContact(userId.value, name, phone) }
    }

    fun toggleFav(c: ContactEntity) {
        viewModelScope.launch(Dispatchers.IO) { repo.toggleFavorite(c) }
    }

    fun saveLimit(l: LimitEntity) {
        viewModelScope.launch(Dispatchers.IO) { repo.updateLimit(l) }
    }

    fun addContract(name: String, trigger: String, amount: Long, rec: String) {
        viewModelScope.launch(Dispatchers.IO) { repo.addContract(userId.value, name, trigger, amount, rec) }
    }

    fun toggleContract(c: SmartContractEntity) {
        viewModelScope.launch(Dispatchers.IO) { repo.toggleContract(c) }
    }
}
