package com.example.alfabankivrub.feature.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.example.alfabankivrub.ui.components.ScreenBackground
import com.example.alfabankivrub.ui.components.neonButtonColors
import com.example.alfabankivrub.ui.components.neonTextFieldColors

@Composable
fun LoginScreen(
    state: AuthUiState,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onLogin: () -> Unit,
    onRegisterClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBackground)
            .padding(20.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Text("Авторизация", style = MaterialTheme.typography.headlineMedium, color = Color.White)
        Spacer(modifier = Modifier.height(24.dp))
        OutlinedTextField(
            value = state.loginEmail,
            onValueChange = onEmailChange,
            label = { Text("Электронная почта") },
            placeholder = { Text("name@example.com") },
            colors = neonTextFieldColors(),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(12.dp))
        OutlinedTextField(
            value = state.loginPassword,
            onValueChange = onPasswordChange,
            label = { Text("Пароль") },
            visualTransformation = PasswordVisualTransformation(),
            colors = neonTextFieldColors(),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        state.error?.let {
            Spacer(modifier = Modifier.height(8.dp))
            Text(text = it, color = Color(0xFFFF8888))
        }
        Spacer(modifier = Modifier.height(20.dp))
        Button(
            onClick = onLogin,
            enabled = !state.loading,
            colors = neonButtonColors(),
            modifier = Modifier.fillMaxWidth()
        ) {
            if (state.loading) {
                CircularProgressIndicator(
                    color = Color.White,
                    strokeWidth = 2.dp,
                    modifier = Modifier
                        .padding(vertical = 2.dp)
                        .height(18.dp)
                        .align(Alignment.CenterVertically)
                )
            } else {
                Text("Войти")
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
        Button(
            onClick = onRegisterClick,
            enabled = !state.loading,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Зарегистрироваться")
        }
    }
}
