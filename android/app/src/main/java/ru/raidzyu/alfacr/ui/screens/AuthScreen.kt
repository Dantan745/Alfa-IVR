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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Mail
import androidx.compose.material.icons.filled.Sms
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.raidzyu.alfacr.ui.AppViewModel
import ru.raidzyu.alfacr.ui.components.CrField
import ru.raidzyu.alfacr.ui.components.PrimaryButton
import ru.raidzyu.alfacr.ui.theme.Cr

@Composable
fun AuthScreen(vm: AppViewModel) {
    var step by remember { mutableIntStateOf(0) }
    var last by remember { mutableStateOf("") }
    var first by remember { mutableStateOf("") }
    var middle by remember { mutableStateOf("") }
    var passport by remember { mutableStateOf("") }
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(bottom = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        GlowLogo()
        when (step) {
            0 -> LoginBlock(vm) { step = 1 }
            1 -> RegName(last, first, middle, { last = it }, { first = it }, { middle = it }, { step = 0 }) { step = 2 }
            2 -> RegPass(passport, { passport = it }, { step = 1 }) { step = 3 }
            else -> RegPhone(vm, last, first, middle, passport, { step = 2 }, { step = 0 })
        }
    }
}

@Composable
private fun GlowLogo() {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(top = 48.dp, bottom = 16.dp)) {
        Box(Modifier.size(100.dp), contentAlignment = Alignment.Center) {
            Box(
                Modifier
                    .size(100.dp)
                    .clip(CircleShape)
                    .background(Brush.radialGradient(listOf(Color(0x3300D2D3), Color.Transparent))),
            )
            Box(
                Modifier
                    .size(100.dp)
                    .clip(CircleShape)
                    .border(2.dp, Cr.LogoRing, CircleShape)
                    .background(Brush.radialGradient(listOf(Color(0xFF1A2F2F), Cr.Chrome))),
            )
            Text("ЦР", color = Cr.Accent, fontWeight = FontWeight.Bold, fontSize = 22.sp)
        }
        Text("Alfa Кошелёк ЦР", color = Cr.Text, fontSize = 22.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(top = 16.dp))
        Text("ЦИФРОВОЙ РУБЛЬ", color = Cr.Text2.copy(0.6f), fontSize = 12.sp, letterSpacing = 3.sp, modifier = Modifier.padding(top = 4.dp))
    }
}

@Composable
private fun LoginBlock(vm: AppViewModel, toReg: () -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var sms by remember { mutableStateOf(false) }
    var code by remember { mutableStateOf("") }
    Column(Modifier.padding(horizontal = 16.dp)) {
        Text("Авторизация", color = Cr.Text, fontSize = 24.sp, fontWeight = FontWeight.Medium, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
        Spacer(Modifier.height(20.dp))
        CrField("Электронная почта", email, { email = it }, "ivan@alfa.demo", Icons.Default.Mail)
        CrField("Пароль", password, { password = it }, "Demo1234", Icons.Default.Lock, PasswordVisualTransformation())
        Text("Забыли пароль?", color = Cr.Accent, fontSize = 13.sp, modifier = Modifier.align(Alignment.End).padding(bottom = 16.dp))
        if (sms) CrField("Код из СМС", code, { code = it }, "------", Icons.Default.Sms)
        PrimaryButton(if (sms) "Подтвердить" else "Войти") {
            if (!sms) sms = true else vm.login(email.ifBlank { "ivan@alfa.demo" }, password.ifBlank { "Demo1234" }) {}
        }
        OrDivider()
        SocialBtn("Альфа-Банк") { vm.login("ivan@alfa.demo", "Demo1234") {} }
        Spacer(Modifier.height(12.dp))
        SocialBtn("Госуслуги") { vm.login("ivan@alfa.demo", "Demo1234") {} }
        Spacer(Modifier.height(20.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
            Text("Нет аккаунта? ", color = Cr.Text, fontSize = 14.sp)
            Text("Зарегистрироваться", color = Cr.Accent, fontSize = 14.sp, modifier = Modifier.clickable { toReg() })
        }
    }
}

@Composable
private fun OrDivider() {
    Row(Modifier.fillMaxWidth().padding(vertical = 20.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.weight(1f).height(1.dp).background(Cr.Muted.copy(0.3f)))
        Text(" ИЛИ ЧЕРЕЗ ", color = Cr.Text, fontSize = 10.sp, letterSpacing = 2.sp, fontWeight = FontWeight.Bold)
        Box(Modifier.weight(1f).height(1.dp).background(Cr.Muted.copy(0.3f)))
    }
}

@Composable
private fun SocialBtn(label: String, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(52.dp)
            .clip(RoundedCornerShape(40.dp))
            .border(1.dp, Cr.Text.copy(0.3f), RoundedCornerShape(40.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(36.dp).clip(CircleShape).background(Cr.Elevated), contentAlignment = Alignment.Center) {
            Text(label.take(1), color = Cr.Accent, fontWeight = FontWeight.Bold)
        }
        Text(label, color = Cr.Text, fontSize = 16.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
        Spacer(Modifier.size(36.dp))
    }
}

@Composable
private fun RegHeader(step: Int, onBack: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(bottom = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = Cr.Accent, modifier = Modifier.clickable { onBack() })
        Text("Регистрация", color = Cr.Text, fontSize = 22.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(start = 12.dp).weight(1f))
        Row {
            repeat(3) { i ->
                Box(
                    Modifier
                        .padding(start = 6.dp)
                        .size(12.dp)
                        .clip(CircleShape)
                        .background(if (i <= step) Cr.AccentMint else Cr.Elevated),
                )
            }
        }
    }
}

@Composable
private fun RegName(
    last: String, first: String, middle: String,
    setLast: (String) -> Unit, setFirst: (String) -> Unit, setMiddle: (String) -> Unit,
    onBack: () -> Unit, next: () -> Unit,
) {
    Column(Modifier.padding(horizontal = 16.dp)) {
        RegHeader(0, onBack)
        Text("ФИО:", color = Cr.Text, fontSize = 18.sp, modifier = Modifier.padding(bottom = 8.dp))
        CrField("Фамилия", last, setLast, "Иванов")
        CrField("Имя", first, setFirst, "Иван")
        CrField("Отчество", middle, setMiddle, "Иванович")
        PrimaryButton("Далее") { next() }
        LoginHint(onBack)
    }
}

@Composable
private fun RegPass(passport: String, setP: (String) -> Unit, onBack: () -> Unit, next: () -> Unit) {
    var d by remember { mutableStateOf("") }
    var c by remember { mutableStateOf("") }
    Column(Modifier.padding(horizontal = 16.dp)) {
        RegHeader(1, onBack)
        Text("Паспортные данные:", color = Cr.Text, fontSize = 18.sp, modifier = Modifier.padding(bottom = 8.dp))
        CrField("Серия и номер паспорта", passport, setP, "0000 000000")
        CrField("Дата выдачи", d, { d = it }, "ДД.ММ.ГГГГ")
        CrField("Код подразделения", c, { c = it }, "000-000")
        PrimaryButton("Далее") { next() }
        LoginHint(onBack)
    }
}

@Composable
private fun RegPhone(
    vm: AppViewModel,
    last: String,
    first: String,
    middle: String,
    passport: String,
    onBack: () -> Unit,
    toLogin: () -> Unit,
) {
    var phone by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var agreed by remember { mutableStateOf(false) }
    Column(Modifier.padding(horizontal = 16.dp)) {
        RegHeader(2, onBack)
        Text("Контакты и пароль:", color = Cr.Text, fontSize = 18.sp, modifier = Modifier.padding(bottom = 8.dp))
        CrField("Телефон", phone, { phone = it }, "+7 (___) ___-__-__")
        CrField("Email", email, { email = it }, "name@example.com")
        CrField("Пароль", password, { password = it }, "минимум 6 символов", visual = PasswordVisualTransformation())
        Row(Modifier.padding(bottom = 16.dp).clickable { agreed = !agreed }, verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(20.dp)
                    .border(1.dp, Cr.Accent, RoundedCornerShape(4.dp))
                    .background(if (agreed) Cr.Accent else Cr.Bg),
            )
            Text(" Согласен с обработкой данных (учебный прототип)", color = Cr.Text2, fontSize = 12.sp)
        }
        PrimaryButton("Создать кошелёк", enabled = agreed) {
            vm.register(
                last.ifBlank { "Иванов" },
                first.ifBlank { "Иван" },
                middle.ifBlank { "Иванович" },
                passport.ifBlank { "0000 000000" },
                phone.ifBlank { "+7 (900) 123-45-67" },
                email.ifBlank { "new@alfa.demo" },
                password.ifBlank { "Demo1234" },
            ) {}
        }
        LoginHint(toLogin)
    }
}

@Composable
private fun LoginHint(onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(top = 16.dp), horizontalArrangement = Arrangement.Center) {
        Text("Уже есть аккаунт? ", color = Cr.Text, fontSize = 14.sp)
        Text("Войти", color = Cr.Accent, fontSize = 14.sp, modifier = Modifier.clickable { onClick() })
    }
}
