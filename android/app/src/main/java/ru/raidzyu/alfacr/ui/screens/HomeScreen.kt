package ru.raidzyu.alfacr.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.SyncAlt
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.raidzyu.alfacr.ui.AppViewModel
import ru.raidzyu.alfacr.ui.toRub
import ru.raidzyu.alfacr.ui.toRubSigned
import ru.raidzyu.alfacr.ui.txIcon
import ru.raidzyu.alfacr.ui.theme.Cr
import ru.raidzyu.alfacr.ui.theme.RobotoFamily
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Главная, сверстана по макету. */
@Composable
fun HomeScreen(vm: AppViewModel, onNavigate: (String) -> Unit) {
    val user by vm.user.collectAsState()
    val acc by vm.account.collectAsState()
    val txs by vm.txs.collectAsState()
    val alerts by vm.alerts.collectAsState()
    val spent by vm.spent.collectAsState()
    val income by vm.income.collectAsState()
    val forecast by vm.forecast.collectAsState()
    val name = user?.firstName?.ifBlank { "Иван" } ?: "Иван"
    val date = SimpleDateFormat("EEE, d MMMM yyyy", Locale("ru")).format(Date())
        .replaceFirstChar { it.uppercase() }

    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(0.dp),
    ) {
        item {
            Row(
                Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(Brush.verticalGradient(listOf(Color(0xFF2A3A3C), Color(0xFF1A2426)))),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(name.take(1), color = Cr.Text, fontSize = 18.sp, fontWeight = FontWeight.Medium, fontFamily = RobotoFamily)
                }
                Column(Modifier.padding(start = 12.dp).weight(1f)) {
                    Text("Привет, $name", color = Cr.Text, fontSize = 20.sp, fontWeight = FontWeight.Medium, fontFamily = RobotoFamily)
                    Text(date, color = Cr.Text2.copy(0.6f), fontSize = 12.sp, fontFamily = RobotoFamily)
                }
                Box(Modifier.size(44.dp).clip(CircleShape).background(Cr.Card), contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.Notifications, null, tint = Cr.Accent, modifier = Modifier.size(22.dp))
                }
            }
        }
        item {
            Box(
                Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp)
                    .shadow(20.dp, RoundedCornerShape(28.dp), ambientColor = Color(0x1A00F2FF), spotColor = Color(0x1A00F2FF))
                    .clip(RoundedCornerShape(28.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFF282A2A), Color(0xFF191C1C))))
                    .padding(horizontal = 24.dp, vertical = 20.dp),
            ) {
                Column {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        Row(
                            Modifier
                                .clip(RoundedCornerShape(20.dp))
                                .background(Color(0x1A00F2FF))
                                .border(1.dp, Color(0x3300F2FF), RoundedCornerShape(20.dp))
                                .padding(horizontal = 10.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(Modifier.size(6.dp).clip(CircleShape).background(Cr.Accent))
                            Text("  Онлайн", color = Cr.Accent, fontSize = 11.sp, fontFamily = RobotoFamily, fontWeight = FontWeight.Medium)
                        }
                    }
                    Text("Общий баланс", color = Cr.Text2, fontSize = 15.sp, fontFamily = RobotoFamily, fontWeight = FontWeight.Medium)
                    Row(verticalAlignment = Alignment.Bottom, modifier = Modifier.padding(top = 4.dp)) {
                        Text(
                            (acc?.balanceKopecks ?: 0).toRub(),
                            color = Cr.Text,
                            fontSize = 34.sp,
                            fontWeight = FontWeight.Medium,
                            fontFamily = RobotoFamily,
                        )
                        Text("  ₽", color = Cr.Accent, fontSize = 18.sp, modifier = Modifier.padding(bottom = 4.dp))
                    }
                    Text("Цифровой рубль · ЦР кошелёк", color = Cr.Text2.copy(0.5f), fontSize = 12.sp, fontFamily = RobotoFamily)
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth().padding(bottom = 20.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                QuickFigma("Перевод", Icons.Default.SyncAlt) { onNavigate("transfer") }
                QuickFigma("Оплата QR", Icons.Default.QrCodeScanner) { onNavigate("qr") }
                QuickFigma("Пополнить", Icons.Default.AddCircle) { onNavigate("topup") }
                QuickFigma("Лимиты", Icons.Default.Tune) { onNavigate("limits") }
            }
        }
        item {
            val a = alerts.firstOrNull()
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color(0x14FFB4AB))
                    .border(1.dp, Color(0x33FFB4AB), RoundedCornerShape(20.dp))
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Default.Warning, null, tint = Cr.Danger, modifier = Modifier.size(22.dp))
                Column(Modifier.padding(start = 12.dp).weight(1f)) {
                    Text(a?.title ?: "Обнаружена аномалия", color = Cr.Danger, fontSize = 13.sp, fontWeight = FontWeight.Medium, fontFamily = RobotoFamily)
                    Text(
                        a?.body ?: "Необычная транзакция с незнакомого устройства",
                        color = Cr.Text2.copy(0.7f),
                        fontSize = 12.sp,
                        fontFamily = RobotoFamily,
                    )
                }
                Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = Cr.Text2.copy(0.4f), modifier = Modifier.size(18.dp))
            }
        }
        item {
            Column(Modifier.padding(bottom = 20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    StatFigma("Расходы", Cr.Danger, "Текущие расходы в месяце", Modifier.weight(1f), spent)
                    StatFigma("Доходы", Cr.Income, "Текущий доход в месяце", Modifier.weight(1f), income)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    StatFigma("Прогноз", Cr.Danger, "Ожидаемые расходы до конца месяца", Modifier.weight(1f), forecast, asExpense = true)
                    Box(Modifier.weight(1f).clip(RoundedCornerShape(28.dp)).background(Cr.Card).padding(16.dp)) {
                        Column {
                            Text("БЕЗОПАСНОСТЬ", color = Cr.Text2.copy(0.6f), fontSize = 10.sp, letterSpacing = 1.sp, fontFamily = RobotoFamily, fontWeight = FontWeight.Medium)
                            Icon(Icons.Default.Security, null, tint = Cr.Accent, modifier = Modifier.padding(top = 8.dp).size(22.dp))
                            Text("Проверка биометрии рекомендована", color = Cr.Text2, fontSize = 11.sp, fontFamily = RobotoFamily, modifier = Modifier.padding(top = 8.dp))
                        }
                    }
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth().padding(bottom = 12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Последние операции", color = Cr.Text, fontSize = 17.sp, fontWeight = FontWeight.Medium, fontFamily = RobotoFamily)
                Text("Все →", color = Cr.Accent, fontSize = 13.sp, fontFamily = RobotoFamily, fontWeight = FontWeight.Medium, modifier = Modifier.clickable { onNavigate("history") })
            }
        }
        item {
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp)
                    .clip(RoundedCornerShape(28.dp))
                    .background(Cr.Card),
            ) {
                val list = txs.take(5)
                list.forEachIndexed { i, tx ->
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(Modifier.size(40.dp).clip(CircleShape).background(Cr.Elevated), contentAlignment = Alignment.Center) {
                            Icon(txIcon(tx.icon), null, tint = Cr.Accent, modifier = Modifier.size(18.dp))
                        }
                        Column(Modifier.padding(start = 12.dp).weight(1f)) {
                            Text(tx.counterpart, color = Cr.Text, fontSize = 14.sp, fontWeight = FontWeight.Medium, fontFamily = RobotoFamily)
                            Text(
                                SimpleDateFormat("d MMM, HH:mm", Locale("ru")).format(Date(tx.createdAt)),
                                color = Cr.Text2.copy(0.6f),
                                fontSize = 12.sp,
                                fontFamily = RobotoFamily,
                            )
                        }
                        Text(
                            tx.amountKopecks.toRubSigned(),
                            color = if (tx.amountKopecks >= 0) Cr.Income else Cr.Danger,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium,
                            fontFamily = RobotoFamily,
                        )
                    }
                    if (i < list.lastIndex) {
                        Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0x0AFFFFFF)))
                    }
                }
            }
        }
        item {
            Text("Копилки", color = Cr.Text, fontSize = 17.sp, fontWeight = FontWeight.Medium, fontFamily = RobotoFamily, modifier = Modifier.padding(bottom = 12.dp))
        }
        itemsIndexed(listOf("Копилка 1" to "200,00", "Копилка 2" to "100,00")) { _, s ->
            Box(
                Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp)
                    .shadow(16.dp, RoundedCornerShape(28.dp), ambientColor = Color(0x1400F2FF), spotColor = Color(0x1400F2FF))
                    .clip(RoundedCornerShape(28.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFF282A2A), Color(0xFF191C1C))))
                    .padding(horizontal = 24.dp, vertical = 20.dp),
            ) {
                Column {
                    Text(s.first, color = Cr.Text2, fontSize = 15.sp, fontFamily = RobotoFamily, fontWeight = FontWeight.Medium)
                    Row(verticalAlignment = Alignment.Bottom, modifier = Modifier.padding(top = 4.dp)) {
                        Text(s.second, color = Cr.Text, fontSize = 30.sp, fontWeight = FontWeight.Medium, fontFamily = RobotoFamily)
                        Text("  ₽", color = Cr.Accent, fontSize = 16.sp, modifier = Modifier.padding(bottom = 4.dp))
                    }
                }
            }
        }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

@Composable
private fun QuickFigma(label: String, icon: ImageVector, onClick: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.clickable(onClick = onClick)) {
        Box(
            Modifier
                .size(56.dp)
                .shadow(8.dp, CircleShape, ambientColor = Color(0x1400F2FF), spotColor = Color(0x1400F2FF))
                .clip(CircleShape)
                .background(Cr.Elevated),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, label, tint = Cr.Accent, modifier = Modifier.size(24.dp))
        }
        Text(
            label,
            color = Cr.Text2.copy(0.9f),
            fontSize = 11.sp,
            fontFamily = RobotoFamily,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}

@Composable
private fun StatFigma(
    title: String,
    color: Color,
    sub: String,
    modifier: Modifier,
    live: Long,
    asExpense: Boolean = false,
) {
    val value = if (live == 0L) {
        "0,00 ₽"
    } else {
        (if (asExpense) "−" else "") + kotlin.math.abs(live).toRub() + " ₽"
    }
    Column(modifier.clip(RoundedCornerShape(28.dp)).background(Cr.Card).padding(16.dp).height(110.dp)) {
        Text(title.uppercase(), color = Cr.Text2.copy(0.6f), fontSize = 10.sp, letterSpacing = 1.sp, fontFamily = RobotoFamily, fontWeight = FontWeight.Medium)
        Text(
            value,
            color = color,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = RobotoFamily,
            modifier = Modifier.padding(top = 12.dp),
        )
        Text(sub, color = Cr.Text2, fontSize = 11.sp, fontFamily = RobotoFamily, modifier = Modifier.padding(top = 4.dp))
    }
}
