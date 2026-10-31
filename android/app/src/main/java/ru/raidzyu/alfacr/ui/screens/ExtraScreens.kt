package ru.raidzyu.alfacr.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.StarBorder
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.raidzyu.alfacr.data.local.LimitEntity
import ru.raidzyu.alfacr.ui.AppViewModel
import ru.raidzyu.alfacr.ui.components.CrField
import ru.raidzyu.alfacr.ui.components.PageHeader
import ru.raidzyu.alfacr.ui.components.PrimaryButton
import ru.raidzyu.alfacr.ui.toRub
import ru.raidzyu.alfacr.ui.theme.Cr
import kotlin.math.abs
import kotlin.math.sin

@Composable
fun QrScreen(vm: AppViewModel, onBack: () -> Unit) {
    val user by vm.user.collectAsState()
    var tab by remember { mutableStateOf(0) }
    var amount by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        PageHeader("QR-код", onBack)
        Row(Modifier.padding(16.dp).clip(RoundedCornerShape(16.dp)).background(Cr.Card).padding(4.dp)) {
            listOf("Мой QR", "Сканировать").forEachIndexed { i, l ->
                Text(
                    l,
                    color = if (tab == i) Cr.Accent else Cr.Text2.copy(0.6f),
                    modifier = Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(if (tab == i) Cr.Elevated else Cr.Card).clickable { tab = i }.padding(10.dp),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                )
            }
        }
        if (tab == 0) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(28.dp))
                        .background(Brush.linearGradient(listOf(Color(0xFF282A2A), Color(0xFF191C1C))))
                        .padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    QrCanvas(user?.walletId ?: "WLT-00123456-ЦР")
                    Text(
                        "${user?.firstName ?: "Иван"} ${user?.lastName ?: "Иванов"} · ЦР кошелёк",
                        color = Cr.Text2,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 16.dp),
                    )
                    Text(user?.phone ?: "+7 (900) 123-45-67", color = Cr.Text2.copy(0.5f), fontSize = 11.sp)
                }
                Spacer(Modifier.height(16.dp))
                CrField("Указать сумму (необязательно)", amount, { amount = it }, "0,00 ₽", keyboard = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(17.dp))
                        .background(Color(0x0D00D2D3))
                        .clickable { vm.toast.value = "Поделиться QR (демо)" }
                        .padding(vertical = 14.dp),
                    horizontalArrangement = androidx.compose.foundation.layout.Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Поделиться QR", color = Cr.Accent, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                }
            }
        } else {
            Column(Modifier.padding(16.dp)) {
                Text("Камера не обязательна: на устройствах без неё вставьте payload вручную.", color = Cr.Text2, fontSize = 13.sp)
                var payload by remember { mutableStateOf("") }
                CrField("Код / ID", payload, { payload = it }, "WLT-...")
                PrimaryButton("Распознать") {
                    vm.toast.value = "Получатель: ${payload.ifBlank { "демо QR" }}"
                }
            }
        }
    }
}

@Composable
private fun QrCanvas(seed: String) {
    Canvas(Modifier.size(220.dp).clip(RoundedCornerShape(12.dp)).background(Color(0xFF1A2426))) {
        val cells = 21
        val cell = size.minDimension / cells
        for (r in 0 until cells) {
            for (c in 0 until cells) {
                val finder = (r < 7 && c < 7) || (r < 7 && c >= cells - 7) || (r >= cells - 7 && c < 7)
                val filled = finder || abs(sin((r * 3.7 + c * 2.1 + seed.length))) > 0.45
                if (filled) {
                    drawRect(Cr.Accent, topLeft = Offset(c * cell + 1, r * cell + 1), size = Size(cell - 2, cell - 2))
                }
            }
        }
    }
}

@Composable
fun LimitsScreen(vm: AppViewModel, onBack: () -> Unit) {
    val limits by vm.limits.collectAsState()
    val spent by vm.spent.collectAsState()
    var editing by remember { mutableStateOf<LimitEntity?>(null) }
    var value by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        PageHeader("Лимиты", onBack)
        limits.forEach { lim ->
            val current = when (lim.kind) {
                "month_spend" -> spent
                else -> (lim.maxKopecks * 0.24).toLong()
            }
            val pct = if (lim.maxKopecks == 0L) 0f else (current.toFloat() / lim.maxKopecks).coerceIn(0f, 1f)
            val warn = pct * 100 >= lim.alertPercent
            Column(
                Modifier
                    .padding(horizontal = 16.dp, vertical = 6.dp)
                    .clip(RoundedCornerShape(24.dp))
                    .background(Cr.Card)
                    .padding(16.dp),
            ) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(lim.name, color = Cr.Text, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                        Text(lim.unitLabel, color = Cr.Text2.copy(0.5f), fontSize = 12.sp)
                    }
                    Text("изм.", color = Cr.Accent, fontSize = 12.sp, modifier = Modifier.clickable {
                        editing = lim
                        value = (lim.maxKopecks / 100).toString()
                    })
                }
                Spacer(Modifier.height(8.dp))
                LinearProgressIndicator(
                    progress = { pct },
                    modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(8.dp)),
                    color = if (warn) Cr.Danger else Cr.Accent,
                    trackColor = Cr.Elevated,
                )
                Text("${current.toRub()} из ${lim.maxKopecks.toRub()} ₽", color = if (warn) Cr.Danger else Cr.Text2, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
            }
        }
        editing?.let { lim ->
            Column(Modifier.padding(16.dp)) {
                CrField("Новый максимум, ₽", value, { value = it }, "50000")
                PrimaryButton("Сохранить") {
                    val n = value.toLongOrNull() ?: return@PrimaryButton
                    vm.saveLimit(lim.copy(maxKopecks = n * 100))
                    editing = null
                }
            }
        }
    }
}

@Composable
fun AddressBookScreen(vm: AppViewModel, onBack: () -> Unit) {
    val contacts by vm.contacts.collectAsState()
    var search by remember { mutableStateOf("") }
    var adding by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    val filtered = contacts.filter { it.name.contains(search, true) || it.phone.contains(search) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        PageHeader("Адресная книга", onBack)
        Column(Modifier.padding(16.dp)) {
            CrField("Поиск", search, { search = it }, "Имя или телефон")
            PrimaryButton("Добавить") { adding = true }
            if (adding) {
                CrField("Имя", name, { name = it }, "ФИО")
                CrField("Телефон", phone, { phone = it }, "+7")
                PrimaryButton("Сохранить") {
                    vm.addContact(name, phone)
                    adding = false
                    name = ""
                    phone = ""
                }
            }
            Spacer(Modifier.height(12.dp))
            filtered.forEach { c ->
                Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(44.dp).clip(CircleShape).background(Cr.Accent), contentAlignment = Alignment.Center) {
                        Text(c.initials, color = Cr.OnCta, fontWeight = FontWeight.Bold)
                    }
                    Column(Modifier.padding(start = 12.dp).weight(1f)) {
                        Text(c.name, color = Cr.Text, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                        Text(c.phone, color = Cr.Text2.copy(0.5f), fontSize = 12.sp)
                    }
                    Icon(
                        if (c.favorite) Icons.Default.Star else Icons.Default.StarBorder,
                        null,
                        tint = Cr.Accent,
                        modifier = Modifier.clickable { vm.toggleFav(c) },
                    )
                }
            }
        }
    }
}

@Composable
fun BulkScreen(vm: AppViewModel, onBack: () -> Unit) {
    data class RowItem(val phone: String, val name: String, val amount: Long, var ok: Boolean)
    var rows by remember {
        mutableStateOf(
            listOf(
                RowItem("+7 (900) 123-45-67", "Петров А.С.", 5000_00, true),
                RowItem("+7 (915) 234-56-78", "Смирнова О.В.", 3200_00, true),
                RowItem("+7 (926) 345-67-89", "Козлов Д.Р.", 8750_00, true),
                RowItem("+7 (977) 456-78-90", "Новикова М.А.", 1500_00, true),
                RowItem("+7 (985) 567-89-01", "Федоров И.П.", 6000_00, false),
            ),
        )
    }
    val total = rows.filter { it.ok }.sumOf { it.amount }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        PageHeader("Массовые платежи", onBack)
        Column(Modifier.padding(16.dp)) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .background(Color(0x05FFFFFF))
                    .padding(24.dp),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        Modifier
                            .size(56.dp)
                            .clip(CircleShape)
                            .background(Color(0x1A00D2D3)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("CSV", color = Cr.Accent, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                    Spacer(Modifier.height(12.dp))
                    Text("Загрузите CSV-файл", color = Cr.Text, fontWeight = FontWeight.Medium)
                    Text("phone;name;amount — демо-строки уже подставлены", color = Cr.Text2.copy(0.5f), fontSize = 12.sp)
                }
            }
            Spacer(Modifier.height(12.dp))
            rows.forEach { r ->
                Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(r.name, color = Cr.Text, fontSize = 14.sp)
                        Text(r.phone, color = Cr.Text2.copy(0.5f), fontSize = 12.sp)
                    }
                    Text(r.amount.toRub() + " ₽", color = if (r.ok) Cr.Text else Cr.Danger)
                }
            }
            Text("Итого к отправке: ${total.toRub()} ₽", color = Cr.Accent, modifier = Modifier.padding(vertical = 12.dp))
            PrimaryButton("Отправить валидные") {
                rows.filter { it.ok }.forEach {
                    vm.transfer(it.name, it.amount / 100.0, "массовый", false) {}
                }
                vm.toast.value = "Пачка поставлена в локальную книгу"
            }
        }
    }
}

@Composable
fun SmartScreen(vm: AppViewModel, onBack: () -> Unit) {
    val contracts by vm.contracts.collectAsState()
    var creating by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var rec by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        PageHeader(if (creating) "Новый смарт-контракт" else "Смарт-контракты", { if (creating) creating = false else onBack() })
        if (creating) {
            Column(Modifier.padding(16.dp)) {
                CrField("Название", name, { name = it }, "Аренда")
                CrField("Получатель", rec, { rec = it }, "Петров А.С.")
                CrField("Сумма", amount, { amount = it }, "25000")
                PrimaryButton("Создать") {
                    val k = (amount.toLongOrNull() ?: 0) * 100
                    vm.addContract(name, "ежемесячно", k, rec)
                    creating = false
                }
            }
        } else {
            Column(Modifier.padding(16.dp)) {
                PrimaryButton("Новый контракт") { creating = true }
                Spacer(Modifier.height(12.dp))
                contracts.forEach { c ->
                    Column(
                        Modifier
                            .padding(bottom = 12.dp)
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(24.dp))
                            .background(Cr.Card)
                            .padding(16.dp),
                    ) {
                        Text(c.name, color = Cr.Text, fontWeight = FontWeight.Medium)
                        Text("${c.triggerLabel} · ${c.recipient}", color = Cr.Text2.copy(0.6f), fontSize = 12.sp)
                        Text(c.amountKopecks.toRub() + " ₽", color = Cr.Accent, modifier = Modifier.padding(top = 4.dp))
                        Text(if (c.active) "Активен · ${c.nextRunLabel}" else "Пауза", color = if (c.active) Cr.Income else Cr.Text2, fontSize = 12.sp, modifier = Modifier.clickable { vm.toggleContract(c) }.padding(top = 8.dp))
                    }
                }
            }
        }
    }
}
