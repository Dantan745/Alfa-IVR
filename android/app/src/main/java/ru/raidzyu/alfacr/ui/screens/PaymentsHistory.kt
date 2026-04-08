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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Contacts
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.SyncAlt
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.paging.compose.collectAsLazyPagingItems
import androidx.paging.compose.itemKey
import ru.raidzyu.alfacr.ui.AppViewModel
import ru.raidzyu.alfacr.ui.components.CrField
import ru.raidzyu.alfacr.ui.toRub
import ru.raidzyu.alfacr.ui.toRubSigned
import ru.raidzyu.alfacr.ui.theme.Cr
import ru.raidzyu.alfacr.ui.theme.RobotoFamily
import ru.raidzyu.alfacr.ui.txIcon
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun PaymentsScreen(vm: AppViewModel, onNavigate: (String) -> Unit) {
    val txs by vm.txs.collectAsState()
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 16.dp)) {
        Text("Платежи", color = Cr.Text, fontSize = 22.sp, fontWeight = FontWeight.Medium, fontFamily = RobotoFamily)
        Row(
            Modifier
                .fillMaxWidth()
                .padding(top = 20.dp, bottom = 20.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(Color(0x1200D2D3))
                .border(1.dp, Color(0x3300D2D3), RoundedCornerShape(18.dp))
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Default.WifiOff, null, tint = Cr.Accent, modifier = Modifier.size(20.dp))
            Column(Modifier.padding(start = 12.dp).weight(1f)) {
                Text("Офлайн-режим доступен", color = Cr.Text, fontSize = 13.sp, fontWeight = FontWeight.Medium, fontFamily = RobotoFamily)
                Text("Просмотр истории и подготовка платежей", color = Cr.Text2.copy(0.5f), fontSize = 12.sp, fontFamily = RobotoFamily)
            }
            Box(Modifier.size(8.dp).clip(CircleShape).background(Cr.Income))
        }
        val services = listOf(
            Triple("Перевод по телефону", "P2P мгновенно", "transfer") to Icons.Default.SyncAlt,
            Triple("QR-оплата", "Сканировать или показать", "qr") to Icons.Default.QrCodeScanner,
            Triple("Массовый платёж", "CSV загрузка", "bulk") to Icons.Default.UploadFile,
            Triple("Смарт-контракт", "Автоплатежи", "smart") to Icons.Default.SmartToy,
            Triple("Адресная книга", "Частые получатели", "address") to Icons.Default.Contacts,
            Triple("Лимиты", "Настройка ограничений", "limits") to Icons.Default.Tune,
        )
        services.chunked(2).forEach { row ->
            Row(Modifier.fillMaxWidth().padding(bottom = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                row.forEach { (info, icon) ->
                    val (title, desc, page) = info
                    ServiceCard(title, desc, icon, Modifier.weight(1f).height(128.dp)) { onNavigate(page) }
                }
            }
        }
        Text(
            "Последние платежи",
            color = Cr.Text,
            fontSize = 17.sp,
            fontWeight = FontWeight.Medium,
            fontFamily = RobotoFamily,
            modifier = Modifier.padding(top = 12.dp, bottom = 12.dp),
        )
        Column(Modifier.clip(RoundedCornerShape(24.dp)).background(Cr.Card)) {
            txs.take(3).forEachIndexed { i, tx ->
                Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(40.dp).clip(CircleShape).background(Cr.Elevated), contentAlignment = Alignment.Center) {
                        Icon(txIcon(tx.icon), null, tint = Cr.Accent, modifier = Modifier.size(18.dp))
                    }
                    Column(Modifier.padding(start = 12.dp).weight(1f)) {
                        Text(tx.counterpart, color = Cr.Text, fontSize = 14.sp, fontWeight = FontWeight.Medium, fontFamily = RobotoFamily)
                        Text(
                            SimpleDateFormat("d MMM", Locale("ru")).format(Date(tx.createdAt)),
                            color = Cr.Text2.copy(0.5f),
                            fontSize = 12.sp,
                            fontFamily = RobotoFamily,
                        )
                    }
                    Text(tx.amountKopecks.toRubSigned(), color = if (tx.amountKopecks >= 0) Cr.Income else Cr.Danger, fontWeight = FontWeight.Medium, fontFamily = RobotoFamily)
                }
                if (i < txs.take(3).lastIndex) Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0x0AFFFFFF)))
            }
        }
    }
}

@Composable
private fun ServiceCard(title: String, desc: String, icon: ImageVector, modifier: Modifier, onClick: () -> Unit) {
    Column(
        modifier
            .clip(RoundedCornerShape(24.dp))
            .background(Cr.Card)
            .clickable(onClick = onClick)
            .padding(16.dp),
    ) {
        Box(Modifier.size(44.dp).clip(CircleShape).background(Color(0x1A00D2D3)), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = Cr.Accent, modifier = Modifier.size(22.dp))
        }
        Spacer(Modifier.weight(1f))
        Text(title, color = Cr.Text, fontSize = 13.sp, fontWeight = FontWeight.Medium, fontFamily = RobotoFamily, lineHeight = 16.sp)
        Text(desc, color = Cr.Text2.copy(0.45f), fontSize = 11.sp, fontFamily = RobotoFamily, modifier = Modifier.padding(top = 4.dp))
    }
}

@Composable
fun HistoryScreen(vm: AppViewModel) {
    val paging = vm.txPaging.collectAsLazyPagingItems()
    val spent by vm.spent.collectAsState()
    val income by vm.income.collectAsState()
    var filter by remember { mutableStateOf("Все") }
    var dateFilter by remember { mutableStateOf("Месяц") }
    var search by remember { mutableStateOf("") }
    LaunchedEffect(search) { vm.historySearch.value = search }
    LaunchedEffect(filter) { vm.historyFilter.value = filter }

    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        item {
            Text("История операций", color = Cr.Text, fontSize = 22.sp, fontWeight = FontWeight.Medium, fontFamily = RobotoFamily, modifier = Modifier.padding(top = 16.dp, bottom = 16.dp))
            CrField("Поиск", search, { search = it }, "Поиск")
            Row(Modifier.horizontalScroll(rememberScrollState()).padding(bottom = 12.dp)) {
                listOf("Сегодня", "Неделя", "Месяц", "Всё время").forEach { d ->
                    val on = dateFilter == d
                    Text(
                        d,
                        color = if (on) Cr.Accent else Cr.Text2.copy(0.7f),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        fontFamily = RobotoFamily,
                        modifier = Modifier
                            .padding(end = 8.dp)
                            .clip(RoundedCornerShape(20.dp))
                            .background(if (on) Color(0x2600D2D3) else Color(0x0AFFFFFF))
                            .border(1.dp, if (on) Color(0x8000D2D3) else Color(0x14FFFFFF), RoundedCornerShape(20.dp))
                            .clickable { dateFilter = d }
                            .padding(horizontal = 16.dp, vertical = 6.dp),
                    )
                }
            }
            Row(Modifier.horizontalScroll(rememberScrollState()).padding(bottom = 16.dp)) {
                listOf("Все", "Расходы", "Доходы", "Переводы").forEach { f ->
                    val on = filter == f
                    Text(
                        f,
                        color = if (on) Cr.OnCta else Cr.Text2.copy(0.7f),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        fontFamily = RobotoFamily,
                        modifier = Modifier
                            .padding(end = 8.dp)
                            .clip(RoundedCornerShape(20.dp))
                            .background(if (on) Cr.Accent else Color(0x0AFFFFFF))
                            .then(if (on) Modifier else Modifier.border(1.dp, Color(0x14FFFFFF), RoundedCornerShape(20.dp)))
                            .clickable { filter = f }
                            .padding(horizontal = 16.dp, vertical = 6.dp),
                    )
                }
            }
            Row(Modifier.fillMaxWidth().padding(bottom = 20.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(
                    Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color(0x1A228D57))
                        .border(1.dp, Color(0x33228D57), RoundedCornerShape(16.dp))
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                ) {
                    Text("ПОСТУПЛЕНИЯ", color = Cr.Text2.copy(0.6f), fontSize = 10.sp, letterSpacing = 1.sp, fontFamily = RobotoFamily, fontWeight = FontWeight.Medium)
                    Text("+" + income.toRub() + " ₽", color = Cr.Income, fontSize = 16.sp, fontWeight = FontWeight.Bold, fontFamily = RobotoFamily)
                }
                Column(
                    Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color(0x1AFFB4AB))
                        .border(1.dp, Color(0x33FFB4AB), RoundedCornerShape(16.dp))
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                ) {
                    Text("РАСХОДЫ", color = Cr.Text2.copy(0.6f), fontSize = 10.sp, letterSpacing = 1.sp, fontFamily = RobotoFamily, fontWeight = FontWeight.Medium)
                    Text("−" + spent.toRub() + " ₽", color = Cr.Danger, fontSize = 16.sp, fontWeight = FontWeight.Bold, fontFamily = RobotoFamily)
                }
            }
        }
        items(count = paging.itemCount, key = paging.itemKey { it.id }) { index ->
            val tx = paging[index] ?: return@items
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(Cr.Card)
                    .padding(horizontal = 16.dp, vertical = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(44.dp).clip(CircleShape).background(Cr.Elevated), contentAlignment = Alignment.Center) {
                    Icon(txIcon(tx.icon), null, tint = Cr.Accent, modifier = Modifier.size(20.dp))
                }
                Column(Modifier.padding(start = 12.dp).weight(1f)) {
                    Text(tx.counterpart, color = Cr.Text, fontSize = 14.sp, fontWeight = FontWeight.Medium, fontFamily = RobotoFamily)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            SimpleDateFormat("d MMM, HH:mm", Locale("ru")).format(Date(tx.createdAt)),
                            color = Cr.Text2.copy(0.5f),
                            fontSize = 11.sp,
                            fontFamily = RobotoFamily,
                        )
                        Text(
                            tx.category,
                            color = Color(0xB300D2D3),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Medium,
                            fontFamily = RobotoFamily,
                            modifier = Modifier
                                .padding(start = 8.dp)
                                .clip(RoundedCornerShape(20.dp))
                                .background(Color(0x1400D2D3))
                                .padding(horizontal = 6.dp, vertical = 2.dp),
                        )
                    }
                }
                Text(tx.amountKopecks.toRubSigned(), color = if (tx.amountKopecks >= 0) Cr.Income else Cr.Danger, fontWeight = FontWeight.Medium, fontFamily = RobotoFamily, fontSize = 14.sp)
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}
