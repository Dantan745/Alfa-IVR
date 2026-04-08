package ru.raidzyu.alfacr.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material.icons.outlined.Contacts
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.SmartToy
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material.icons.outlined.UploadFile
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.raidzyu.alfacr.ui.AppViewModel
import ru.raidzyu.alfacr.ui.theme.Cr
import ru.raidzyu.alfacr.ui.theme.ManropeFamily
import ru.raidzyu.alfacr.ui.theme.RobotoFamily

@Composable
fun ProfileScreen(vm: AppViewModel, onNavigate: (String) -> Unit) {
    val user by vm.user.collectAsState()
    val ctx = LocalContext.current
    val fio = listOfNotNull(user?.lastName, user?.firstName, user?.middleName).joinToString(" ").ifBlank { "Иванов Иван Иванович" }
    val initials = ((user?.firstName?.take(1) ?: "И") + (user?.lastName?.take(1) ?: "И"))

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 20.dp)) {
        Text("Профиль", color = Cr.Text, fontSize = 22.sp, fontWeight = FontWeight.Medium, fontFamily = RobotoFamily)
        Spacer(Modifier.height(20.dp))
        Row(
            Modifier
                .fillMaxWidth()
                .shadow(16.dp, RoundedCornerShape(28.dp), ambientColor = Color(0x1400F2FF), spotColor = Color(0x1400F2FF))
                .clip(RoundedCornerShape(28.dp))
                .background(Brush.linearGradient(listOf(Color(0xFF282A2A), Color(0xFF191C1C))))
                .padding(20.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier.size(64.dp).clip(CircleShape).background(Brush.linearGradient(listOf(Cr.Accent, Cr.AccentMint))),
                contentAlignment = Alignment.Center,
            ) {
                Text(initials, color = Cr.OnCta, fontSize = 26.sp, fontWeight = FontWeight.Bold, fontFamily = RobotoFamily)
            }
            Column(Modifier.padding(start = 16.dp)) {
                Text(fio, color = Cr.Text, fontSize = 19.sp, fontWeight = FontWeight.Medium, fontFamily = RobotoFamily)
                Text(user?.phone ?: "+7 (900) 123-45-67", color = Cr.Text2.copy(0.6f), fontSize = 13.sp, fontFamily = RobotoFamily)
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 6.dp)) {
                    Icon(Icons.Default.Verified, null, tint = Cr.Accent, modifier = Modifier.size(14.dp))
                    Text("  Верифицирован", color = Cr.Accent, fontSize = 12.sp, fontFamily = RobotoFamily, fontWeight = FontWeight.Medium)
                }
            }
        }
        Spacer(Modifier.height(20.dp))
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Cr.Card).padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text("ID КОШЕЛЬКА ЦР", color = Cr.Text2.copy(0.5f), fontSize = 11.sp, letterSpacing = 1.sp, fontFamily = RobotoFamily, fontWeight = FontWeight.Medium)
                Text(user?.walletId ?: "WLT-00123456-ЦР", color = Cr.Text, fontSize = 15.sp, fontFamily = ManropeFamily, modifier = Modifier.padding(top = 2.dp))
            }
            Box(
                Modifier.size(36.dp).clip(CircleShape).background(Cr.Elevated).clickable {
                    val cm = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    cm.setPrimaryClip(ClipData.newPlainText("wallet", user?.walletId ?: "WLT-00123456-ЦР"))
                    vm.toast.value = "ID скопирован"
                },
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.Default.ContentCopy, null, tint = Cr.Accent, modifier = Modifier.size(16.dp)) }
        }
        Spacer(Modifier.height(20.dp))
        Row(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color(0x14FFB4AB))
                .border(1.dp, Color(0x33FFB4AB), RoundedCornerShape(20.dp))
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Default.Security, null, tint = Cr.Danger, modifier = Modifier.size(22.dp))
            Column(Modifier.padding(start = 12.dp).weight(1f)) {
                Text("Аномалия ML: подозрительный вход", color = Cr.Danger, fontSize = 13.sp, fontWeight = FontWeight.Medium, fontFamily = RobotoFamily)
                Text("Незнакомое устройство · Сегодня 02:14", color = Cr.Text2.copy(0.6f), fontSize = 12.sp, fontFamily = RobotoFamily)
            }
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = Cr.Text2.copy(0.4f), modifier = Modifier.size(18.dp))
        }
        Spacer(Modifier.height(20.dp))
        val items = listOf(
            Triple("Адресная книга", Icons.Outlined.Contacts, "address"),
            Triple("Лимиты и безопасность", Icons.Outlined.Tune, "limits"),
            Triple("История операций", Icons.Outlined.ReceiptLong, "history"),
            Triple("Смарт-контракты", Icons.Outlined.SmartToy, "smart"),
            Triple("Массовые платежи", Icons.Outlined.UploadFile, "bulk"),
            Triple("Уведомления", Icons.Default.Notifications, ""),
            Triple("Биометрия и безопасность", Icons.Default.Fingerprint, ""),
            Triple("Поддержка", Icons.Default.HelpOutline, ""),
        )
        Column(Modifier.clip(RoundedCornerShape(24.dp)).background(Cr.Card)) {
            items.forEachIndexed { i, (label, icon, page) ->
                MenuRow(label, icon) {
                    when (page) {
                        "history" -> onNavigate("history")
                        "" -> vm.toast.value = "Раздел в MVP: заглушка"
                        else -> onNavigate(page)
                    }
                }
                if (i < items.lastIndex) Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0x0AFFFFFF)))
            }
        }
        Spacer(Modifier.height(20.dp))
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Cr.Card).padding(horizontal = 16.dp, vertical = 12.dp)) {
            InfoLine("Версия приложения", "1.0.0")
            InfoLine("Платформа", "RuStore")
        }
        Spacer(Modifier.height(20.dp))
        Row(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color(0x14FFB4AB))
                .border(1.dp, Color(0x33FFB4AB), RoundedCornerShape(20.dp))
                .clickable { vm.logout() }
                .padding(vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = androidx.compose.foundation.layout.Arrangement.Center,
        ) {
            Icon(Icons.Default.Logout, null, tint = Cr.Danger, modifier = Modifier.size(20.dp))
            Text("  Выйти из аккаунта", color = Cr.Danger, fontSize = 15.sp, fontWeight = FontWeight.Medium, fontFamily = RobotoFamily)
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun InfoLine(left: String, right: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = androidx.compose.foundation.layout.Arrangement.SpaceBetween) {
        Text(left, color = Cr.Text2.copy(0.5f), fontSize = 13.sp, fontFamily = RobotoFamily)
        Text(right, color = Cr.Text2.copy(0.7f), fontSize = 13.sp, fontFamily = RobotoFamily, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun MenuRow(label: String, icon: ImageVector, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(36.dp).clip(CircleShape).background(Color(0x1400D2D3)), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = Cr.Accent, modifier = Modifier.size(18.dp))
        }
        Text(label, color = Cr.Text, fontSize = 15.sp, fontFamily = RobotoFamily, fontWeight = FontWeight.Medium, modifier = Modifier.padding(start = 12.dp).weight(1f))
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = Cr.Text2.copy(0.3f), modifier = Modifier.size(18.dp))
    }
}
