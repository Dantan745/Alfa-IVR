package ru.raidzyu.alfacr.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import androidx.fragment.app.FragmentActivity
import ru.raidzyu.alfacr.data.security.BiometricUnlock
import ru.raidzyu.alfacr.ui.AppViewModel
import ru.raidzyu.alfacr.ui.theme.Cr

@Composable
fun PinScreen(vm: AppViewModel) {
    var pin by remember { mutableStateOf("") }
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Код доступа", color = Cr.Text, fontSize = 22.sp, fontWeight = FontWeight.Medium)
        Text("DEMO PIN: 1234", color = Cr.Text2.copy(0.6f), fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp, bottom = 24.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            repeat(4) { i ->
                Box(
                    Modifier
                        .size(16.dp)
                        .clip(CircleShape)
                        .background(if (i < pin.length) Cr.Accent else Cr.Elevated),
                )
            }
        }
        Spacer(Modifier.height(32.dp))
        val keys = listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫")
        keys.chunked(3).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                row.forEach { k ->
                    Box(
                        Modifier
                            .padding(8.dp)
                            .size(72.dp)
                            .clip(RoundedCornerShape(36.dp))
                            .background(if (k.isEmpty()) Cr.Bg else Cr.Card)
                            .clickable(enabled = k.isNotEmpty()) {
                                when (k) {
                                    "⌫" -> if (pin.isNotEmpty()) pin = pin.dropLast(1)
                                    else -> if (pin.length < 4) {
                                        pin += k
                                        if (pin.length == 4) vm.unlockPin(pin) {}
                                    }
                                }
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(k, color = Cr.Text, fontSize = 22.sp)
                    }
                }
            }
        }
        Text("Выйти", color = Cr.Accent, modifier = Modifier.padding(top = 24.dp).clickable { vm.logout() })
        val activity = LocalContext.current as? FragmentActivity
        if (activity != null && BiometricUnlock.available(activity)) {
            Text(
                "Войти по биометрии",
                color = Cr.Accent,
                modifier = Modifier.padding(top = 16.dp).clickable {
                    BiometricUnlock.prompt(
                        activity,
                        onOk = { vm.unlockWithBiometric() },
                        onFail = { vm.toast.value = it },
                    )
                },
            )
        }
    }
}
