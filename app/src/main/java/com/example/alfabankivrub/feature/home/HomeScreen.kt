package com.example.alfabankivrub.feature.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.example.alfabankivrub.domain.model.AuthUser
import com.example.alfabankivrub.ui.components.ScreenBackground
import com.example.alfabankivrub.ui.components.neonButtonColors

@Composable
fun HomeScreen(
    user: AuthUser?,
    onLogout: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBackground)
            .padding(16.dp)
    ) {
        Text(
            text = "Привет, ${user?.displayName ?: "Пользователь"}",
            style = MaterialTheme.typography.headlineSmall,
            color = Color.White
        )
        Spacer(modifier = Modifier.height(18.dp))
        BalanceCard()
        Spacer(modifier = Modifier.height(16.dp))
        QuickActions()
        Spacer(modifier = Modifier.height(16.dp))
        MetricsGrid()
        Spacer(modifier = Modifier.weight(1f))
        Button(onClick = onLogout, colors = neonButtonColors(), modifier = Modifier.fillMaxWidth()) {
            Text("Выйти")
        }
    }
}

@Composable
private fun BalanceCard() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                brush = Brush.horizontalGradient(listOf(Color(0xFF252C35), Color(0xFF18232A))),
                shape = RoundedCornerShape(22.dp)
            )
            .padding(20.dp)
    ) {
        Text("Общий баланс", color = Color(0xFFA6BAC7), style = MaterialTheme.typography.bodyMedium)
        Spacer(modifier = Modifier.height(8.dp))
        Text("5000,00 ₽", color = Color(0xFFE3F8FF), style = MaterialTheme.typography.headlineMedium)
    }
}

@Composable
private fun QuickActions() {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        listOf("Перевод", "Оплата QR", "Пополнить", "Лимиты").forEach { title ->
            Column(
                modifier = Modifier
                    .width(78.dp)
                    .background(Color(0x302A3640), RoundedCornerShape(14.dp))
                    .padding(vertical = 14.dp, horizontal = 6.dp)
            ) {
                Text("•", color = Color(0xFF20DAE6), style = MaterialTheme.typography.titleLarge)
                Spacer(modifier = Modifier.height(6.dp))
                Text(title, color = Color(0xFFCFE8EF), style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun MetricsGrid() {
    Column {
        Row(modifier = Modifier.fillMaxWidth()) {
            MetricCard("Прогноз", "-42,000 ₽", "Ожидаемые расходы", Color(0xFFFFB6AA), Modifier.weight(1f))
            Spacer(modifier = Modifier.width(10.dp))
            MetricCard("Безопасность", "Проверка", "Биометрии рекомендована", Color(0xFFB9E9FF), Modifier.weight(1f))
        }
        Spacer(modifier = Modifier.height(10.dp))
        Row(modifier = Modifier.fillMaxWidth()) {
            MetricCard("Расходы", "20,000 ₽", "Текущие расходы", Color(0xFFFFD2C5), Modifier.weight(1f))
            Spacer(modifier = Modifier.width(10.dp))
            MetricCard("Доходы", "15,000 ₽", "Текущий доход", Color(0xFF95EBC4), Modifier.weight(1f))
        }
    }
}

@Composable
private fun MetricCard(
    title: String,
    value: String,
    subtitle: String,
    valueColor: Color,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .background(Color(0x262B3440), RoundedCornerShape(16.dp))
            .padding(12.dp)
    ) {
        Text(title, color = Color(0xFF94A7B3), style = MaterialTheme.typography.bodySmall)
        Spacer(modifier = Modifier.height(4.dp))
        Text(value, color = valueColor, style = MaterialTheme.typography.titleMedium)
        Spacer(modifier = Modifier.height(2.dp))
        Text(subtitle, color = Color(0xFFD8E5EC), style = MaterialTheme.typography.bodySmall)
    }
}
