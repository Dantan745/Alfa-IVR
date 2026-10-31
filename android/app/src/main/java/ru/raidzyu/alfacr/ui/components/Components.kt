package ru.raidzyu.alfacr.ui.components

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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.raidzyu.alfacr.ui.theme.Cr
import ru.raidzyu.alfacr.ui.theme.ManropeFamily
import ru.raidzyu.alfacr.ui.theme.RobotoFamily

/** На телефоне на весь экран, на планшете — колонка как макет 393dp по центру. */
@Composable
fun DeviceShell(content: @Composable () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Cr.Chrome),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .widthIn(max = 480.dp)
                .background(Cr.Bg)
                .statusBarsPadding()
                .imePadding(),
        ) {
            // Как в Figma App.tsx: верхнее и нижнее cyan-свечение.
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(120.dp)
                    .align(Alignment.TopCenter)
                    .background(Brush.verticalGradient(listOf(Color(0x0D00F2FF), Color.Transparent))),
            )
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(96.dp)
                    .align(Alignment.BottomCenter)
                    .background(Brush.verticalGradient(listOf(Color.Transparent, Color(0x0A00F2FF)))),
            )
            content()
        }
    }
}

@Composable
fun PrimaryButton(label: String, enabled: Boolean = true, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp)
            .then(
                if (enabled) Modifier.shadow(18.dp, RoundedCornerShape(17.dp), ambientColor = Color(0x6648FFD5), spotColor = Color(0x6648FFD5))
                else Modifier,
            )
            .clip(RoundedCornerShape(17.dp))
            .then(
                if (enabled) Modifier.background(Cr.Cta)
                else Modifier.background(Color(0xFF1E2525)),
            )
            .clickable(enabled) { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            color = if (enabled) Cr.OnCta else Cr.Muted,
            fontSize = 18.sp,
            fontWeight = FontWeight.Medium,
            fontFamily = RobotoFamily,
        )
    }
}

@Composable
fun CrField(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    placeholder: String,
    leading: ImageVector? = null,
    visual: VisualTransformation = VisualTransformation.None,
    keyboard: KeyboardOptions = KeyboardOptions.Default,
) {
    Column(Modifier.fillMaxWidth().padding(bottom = 16.dp)) {
        Text(
            label.uppercase(),
            color = Cr.Text2.copy(0.7f),
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            letterSpacing = 1.sp,
            fontFamily = RobotoFamily,
            modifier = Modifier.padding(bottom = 8.dp),
        )
        TextField(
            value = value,
            onValueChange = onChange,
            placeholder = { Text(placeholder, color = Cr.Muted) },
            leadingIcon = leading?.let { { Icon(it, null, tint = Cr.AccentBright, modifier = Modifier.size(20.dp)) } },
            visualTransformation = visual,
            keyboardOptions = keyboard,
            singleLine = true,
            textStyle = androidx.compose.ui.text.TextStyle(fontFamily = ManropeFamily, color = Cr.Text, fontSize = 16.sp),
            modifier = Modifier
                .fillMaxWidth()
                .border(2.dp, Cr.Border, RoundedCornerShape(17.dp)),
            shape = RoundedCornerShape(17.dp),
            colors = TextFieldDefaults.colors(
                focusedContainerColor = Cr.InputFill,
                unfocusedContainerColor = Cr.InputFill,
                focusedTextColor = Cr.Text,
                unfocusedTextColor = Cr.Text,
                cursorColor = Cr.Accent,
                focusedIndicatorColor = Color.Transparent,
                unfocusedIndicatorColor = Color.Transparent,
            ),
        )
    }
}

@Composable
fun PageHeader(title: String, onBack: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(Cr.Card)
                .clickable(onClick = onBack),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = Cr.Accent)
        }
        Text(title, color = Cr.Text, fontSize = 20.sp, fontWeight = FontWeight.Medium, fontFamily = RobotoFamily, modifier = Modifier.padding(start = 12.dp))
    }
}

data class TabItem(val route: String, val label: String, val icon: ImageVector)

@Composable
fun BottomNav(current: String, onTab: (String) -> Unit) {
    val tabs = listOf(
        TabItem("home", "Главная", Icons.Default.Home),
        TabItem("payments", "Платежи", Icons.Default.Payments),
        TabItem("history", "История", Icons.Default.History),
        TabItem("profile", "Профиль", Icons.Default.Person),
    )
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .shadow(16.dp, RoundedCornerShape(topStart = 30.dp, topEnd = 30.dp), ambientColor = Color(0x3300D2D3), spotColor = Color.Transparent)
            .clip(RoundedCornerShape(topStart = 30.dp, topEnd = 30.dp))
            .background(Color(0xEB191C1C))
            .border(1.dp, Color(0x1A00D2D3), RoundedCornerShape(topStart = 30.dp, topEnd = 30.dp))
            .navigationBarsPadding()
            .padding(top = 16.dp, bottom = 12.dp, start = 8.dp, end = 8.dp),
        horizontalArrangement = Arrangement.SpaceAround,
    ) {
        tabs.forEach { t ->
            val active = current == t.route
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.clickable { onTab(t.route) }.padding(horizontal = 8.dp),
            ) {
                Icon(t.icon, t.label, tint = if (active) Cr.Accent else Cr.Text2.copy(0.6f), modifier = Modifier.size(26.dp))
                Spacer(Modifier.height(4.dp))
                Text(t.label, color = if (active) Cr.Accent else Cr.Text2.copy(0.7f), fontSize = 11.sp, fontWeight = FontWeight.Medium, fontFamily = RobotoFamily)
            }
        }
    }
}
