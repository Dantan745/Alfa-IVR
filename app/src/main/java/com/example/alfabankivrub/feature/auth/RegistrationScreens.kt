package com.example.alfabankivrub.feature.auth

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
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.example.alfabankivrub.domain.model.RegistrationDraft
import com.example.alfabankivrub.ui.components.ScreenBackground
import com.example.alfabankivrub.ui.components.neonButtonColors
import com.example.alfabankivrub.ui.components.neonTextFieldColors

@Composable
fun RegistrationStep1Screen(
    draft: RegistrationDraft,
    error: String?,
    onDraftChange: (RegistrationDraft) -> Unit,
    onNext: () -> Unit,
    onBackToLogin: () -> Unit
) {
    RegistrationTemplate(
        title = "Регистрация",
        subtitle = "ФИО"
    ) {
        OutlinedTextField(
            value = draft.lastName,
            onValueChange = { onDraftChange(draft.copy(lastName = it)) },
            label = { Text("Фамилия") },
            colors = neonTextFieldColors(),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(
            value = draft.firstName,
            onValueChange = { onDraftChange(draft.copy(firstName = it)) },
            label = { Text("Имя") },
            colors = neonTextFieldColors(),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(
            value = draft.middleName,
            onValueChange = { onDraftChange(draft.copy(middleName = it)) },
            label = { Text("Отчество") },
            colors = neonTextFieldColors(),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        error?.let {
            Spacer(modifier = Modifier.height(10.dp))
            Text(it, color = Color(0xFFFF8888))
        }
        Spacer(modifier = Modifier.height(16.dp))
        Button(onClick = onNext, colors = neonButtonColors(), modifier = Modifier.fillMaxWidth()) {
            Text("Далее")
        }
        Spacer(modifier = Modifier.height(8.dp))
        Button(onClick = onBackToLogin, modifier = Modifier.fillMaxWidth()) { Text("Уже есть аккаунт? Войти") }
    }
}

@Composable
fun RegistrationStep2Screen(
    draft: RegistrationDraft,
    error: String?,
    onDraftChange: (RegistrationDraft) -> Unit,
    onNext: () -> Unit,
    onBack: () -> Unit
) {
    RegistrationTemplate(
        title = "Регистрация",
        subtitle = "Паспортные данные"
    ) {
        OutlinedTextField(
            value = draft.passportNumber,
            onValueChange = { onDraftChange(draft.copy(passportNumber = it.filter(Char::isDigit))) },
            label = { Text("Серия и номер паспорта") },
            colors = neonTextFieldColors(),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(
            value = draft.passportDate,
            onValueChange = { onDraftChange(draft.copy(passportDate = it)) },
            label = { Text("Дата выдачи") },
            placeholder = { Text("ДД.ММ.ГГГГ") },
            colors = neonTextFieldColors(),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(
            value = draft.passportDepartmentCode,
            onValueChange = { onDraftChange(draft.copy(passportDepartmentCode = it)) },
            label = { Text("Код подразделения") },
            placeholder = { Text("000-000") },
            colors = neonTextFieldColors(),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        error?.let {
            Spacer(modifier = Modifier.height(10.dp))
            Text(it, color = Color(0xFFFF8888))
        }
        Spacer(modifier = Modifier.height(16.dp))
        Row {
            Button(onClick = onBack, modifier = Modifier.weight(1f)) { Text("Назад") }
            Spacer(modifier = Modifier.width(12.dp))
            Button(onClick = onNext, colors = neonButtonColors(), modifier = Modifier.weight(1f)) { Text("Далее") }
        }
    }
}

@Composable
fun RegistrationStep3Screen(
    state: AuthUiState,
    onDraftChange: (RegistrationDraft) -> Unit,
    onBack: () -> Unit,
    onRegister: () -> Unit
) {
    val draft = state.registrationDraft
    RegistrationTemplate(
        title = "Регистрация",
        subtitle = "Вход в систему"
    ) {
        OutlinedTextField(
            value = draft.phone,
            onValueChange = { onDraftChange(draft.copy(phone = it.filter { ch -> ch.isDigit() || ch == '+' })) },
            label = { Text("Номер телефона") },
            colors = neonTextFieldColors(),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(
            value = draft.email,
            onValueChange = { onDraftChange(draft.copy(email = it)) },
            label = { Text("Почта") },
            colors = neonTextFieldColors(),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(
            value = draft.password,
            onValueChange = { onDraftChange(draft.copy(password = it)) },
            label = { Text("Пароль") },
            visualTransformation = PasswordVisualTransformation(),
            colors = neonTextFieldColors(),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(8.dp))
        Row(modifier = Modifier.fillMaxWidth()) {
            Checkbox(
                checked = draft.acceptedPolicy,
                onCheckedChange = { onDraftChange(draft.copy(acceptedPolicy = it)) }
            )
            Text(
                text = "Я даю согласие на обработку персональных данных",
                color = Color.White,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(top = 12.dp)
            )
        }
        state.error?.let {
            Spacer(modifier = Modifier.height(6.dp))
            Text(it, color = Color(0xFFFF8888))
        }
        Spacer(modifier = Modifier.height(16.dp))
        Row {
            Button(onClick = onBack, modifier = Modifier.weight(1f), enabled = !state.loading) { Text("Назад") }
            Spacer(modifier = Modifier.width(12.dp))
            Button(
                onClick = onRegister,
                modifier = Modifier.weight(1f),
                enabled = !state.loading,
                colors = neonButtonColors()
            ) {
                Text("Завершить")
            }
        }
    }
}

@Composable
private fun RegistrationTemplate(
    title: String,
    subtitle: String,
    content: @Composable () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBackground)
            .padding(20.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Text(title, style = MaterialTheme.typography.headlineMedium, color = Color.White)
        Spacer(modifier = Modifier.height(10.dp))
        Text(subtitle, style = MaterialTheme.typography.titleMedium, color = Color(0xFFDDE8EF))
        Spacer(modifier = Modifier.height(20.dp))
        content()
    }
}
