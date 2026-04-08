package ru.raidzyu.alfacr.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.raidzyu.alfacr.ui.AppViewModel
import ru.raidzyu.alfacr.ui.components.CrField
import ru.raidzyu.alfacr.ui.components.PageHeader
import ru.raidzyu.alfacr.ui.components.PrimaryButton
import ru.raidzyu.alfacr.ui.toRub
import ru.raidzyu.alfacr.ui.theme.Cr
import ru.raidzyu.alfacr.ui.theme.RobotoFamily

@Composable
fun TransferScreen(vm: AppViewModel, onBack: () -> Unit, onNavigate: (String) -> Unit) {
    val acc by vm.account.collectAsState()
    val contacts by vm.contacts.collectAsState()
    var tab by remember { mutableIntStateOf(0) }
    var phone by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var comment by remember { mutableStateOf("") }
    var sent by remember { mutableStateOf(false) }

    if (sent) {
        Column(Modifier.fillMaxSize()) {
            PageHeader("Перевод", { sent = false })
            Column(
                Modifier.weight(1f).fillMaxWidth().padding(horizontal = 20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Box(
                    Modifier
                        .size(80.dp)
                        .clip(CircleShape)
                        .background(Color(0x2600D2D3))
                        .border(2.dp, Cr.Accent, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Default.CheckCircle, null, tint = Cr.Accent, modifier = Modifier.size(40.dp))
                }
                Text("Перевод выполнен", color = Cr.Text, fontSize = 24.sp, fontWeight = FontWeight.Medium, fontFamily = RobotoFamily, modifier = Modifier.padding(top = 16.dp), textAlign = TextAlign.Center)
                Text("${amount.ifBlank { "0" }} ₽", color = Cr.Accent, fontSize = 32.sp, fontWeight = FontWeight.Bold, fontFamily = RobotoFamily, modifier = Modifier.padding(top = 8.dp))
                Text("Средства переведены на номер $phone", color = Cr.Text2.copy(0.7f), fontSize = 14.sp, fontFamily = RobotoFamily, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp))
            }
            Box(Modifier.padding(20.dp)) { PrimaryButton("Готово") { onBack() } }
        }
        return
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        PageHeader("Перевод", onBack)
        Row(Modifier.padding(horizontal = 16.dp).clip(RoundedCornerShape(16.dp)).background(Cr.Card).padding(4.dp)) {
            listOf("По номеру телефона", "По ID кошелька").forEachIndexed { i, l ->
                Text(
                    l,
                    color = if (tab == i) Cr.Accent else Cr.Text2.copy(0.6f),
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (tab == i) Cr.Elevated else Color.Transparent)
                        .clickable { tab = i }
                        .padding(vertical = 10.dp, horizontal = 4.dp),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    fontFamily = RobotoFamily,
                    textAlign = TextAlign.Center,
                )
            }
        }
        Text(
            "ЧАСТЫЕ ПОЛУЧАТЕЛИ",
            color = Cr.Text2.copy(0.6f),
            fontSize = 12.sp,
            letterSpacing = 1.sp,
            fontFamily = RobotoFamily,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(start = 16.dp, top = 20.dp, bottom = 12.dp),
        )
        Row(Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 4.dp)) {
            contacts.take(4).forEach { c ->
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(end = 16.dp).clickable { phone = c.phone },
                ) {
                    Box(
                        Modifier
                            .size(48.dp)
                            .clip(CircleShape)
                            .background(Brush.verticalGradient(listOf(Color(0xFF2A3A3C), Color(0xFF1A2426)))),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(c.initials, color = Cr.Accent, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    }
                    Text(c.name.split(" ").first(), color = Cr.Text2.copy(0.8f), fontSize = 11.sp, fontFamily = RobotoFamily, modifier = Modifier.padding(top = 6.dp))
                }
            }
        }
        Column(Modifier.padding(16.dp)) {
            CrField(if (tab == 0) "Номер телефона" else "ID кошелька", phone, { phone = it }, if (tab == 0) "+7 (___) ___-__-__" else "Введите ID получателя")
            CrField("Сумма (₽)", amount, { amount = it }, "0,00", keyboard = KeyboardOptions(keyboardType = KeyboardType.Decimal))
            CrField("Комментарий (необязательно)", comment, { comment = it }, "За что платёж?")
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(bottom = 20.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color(0x0D00D2D3))
                    .border(1.dp, Color(0x2600D2D3), RoundedCornerShape(16.dp))
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("Доступно", color = Cr.Text2.copy(0.7f), fontSize = 13.sp, fontFamily = RobotoFamily)
                Text("${(acc?.balanceKopecks ?: 0).toRub()} ₽", color = Cr.Accent, fontSize = 15.sp, fontWeight = FontWeight.Medium, fontFamily = RobotoFamily)
            }
            PrimaryButton("Перевести", enabled = phone.isNotBlank() && amount.isNotBlank()) {
                val v = amount.replace(",", ".").toDoubleOrNull() ?: 0.0
                val known = contacts.any { it.phone == phone || it.wallet == phone }
                vm.transfer(phone, v, comment, !known) { sent = true }
            }
            Row(Modifier.padding(top = 16.dp, bottom = 24.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                GhostBtn("Массовый платёж", Icons.Default.UploadFile, Modifier.weight(1f)) { onNavigate("bulk") }
                GhostBtn("Смарт-контракт", Icons.Default.SmartToy, Modifier.weight(1f)) { onNavigate("smart") }
            }
        }
    }
}

@Composable
private fun GhostBtn(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, modifier: Modifier, onClick: () -> Unit) {
    Row(
        modifier
            .clip(RoundedCornerShape(17.dp))
            .background(Color(0x0D00D2D3))
            .border(1.dp, Color(0x4D00D2D3), RoundedCornerShape(17.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = Cr.Accent, modifier = Modifier.size(18.dp))
        Text(label, color = Cr.Accent, fontSize = 13.sp, fontFamily = RobotoFamily, fontWeight = FontWeight.Medium, modifier = Modifier.padding(start = 6.dp))
    }
}

@Composable
fun TopUpScreen(vm: AppViewModel, onBack: () -> Unit) {
    var amount by remember { mutableStateOf("1000") }
    Column(Modifier.fillMaxSize()) {
        PageHeader("Пополнить", onBack)
        Column(Modifier.padding(16.dp)) {
            Text("Тестовое пополнение кошелька ЦР (локальная БД, без эквайринга).", color = Cr.Text2, fontSize = 13.sp, fontFamily = RobotoFamily)
            Spacer(Modifier.height(16.dp))
            CrField("Сумма", amount, { amount = it }, "1000", keyboard = KeyboardOptions(keyboardType = KeyboardType.Decimal))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(bottom = 16.dp)) {
                listOf("500", "1000", "5000").forEach { v ->
                    Text(
                        "$v ₽",
                        color = Cr.Accent,
                        fontFamily = RobotoFamily,
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(Cr.Card)
                            .clickable { amount = v }
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                    )
                }
            }
            PrimaryButton("Зачислить") {
                vm.topUp(amount.replace(",", ".").toDoubleOrNull() ?: 0.0) { onBack() }
            }
        }
    }
}
