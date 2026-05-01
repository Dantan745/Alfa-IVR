package com.example.alfabankivrub.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

val ScreenBackground = Brush.verticalGradient(
    colors = listOf(
        Color(0xFF05070B),
        Color(0xFF07161A),
        Color(0xFF03060A)
    )
)

@Composable
fun neonTextFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = Color(0xFF25DCE7),
    unfocusedBorderColor = Color(0xFF42535D),
    focusedTextColor = Color.White,
    unfocusedTextColor = Color(0xFFEAF7FF),
    focusedContainerColor = Color(0x220F2C33),
    unfocusedContainerColor = Color(0x220F2C33),
    focusedLabelColor = Color(0xFF8CA4AE),
    unfocusedLabelColor = Color(0xFF5F7078),
    focusedPlaceholderColor = Color(0xFF50616B),
    unfocusedPlaceholderColor = Color(0xFF50616B)
)

fun neonCardModifier(): Modifier = Modifier
    .fillMaxWidth()
    .background(
        brush = Brush.horizontalGradient(
            listOf(Color(0x303E4A52), Color(0x301B2329))
        ),
        shape = RoundedCornerShape(16.dp)
    )

@Composable
fun neonButtonColors() = ButtonDefaults.buttonColors(
    containerColor = Color(0xFF1AD5DD),
    contentColor = Color(0xFFECFFFF)
)
