package ru.raidzyu.alfacr.ui.theme

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

/** Цвета макета: акцент #00D2D3, фон #121212. */
object Cr {
    val Chrome = Color(0xFF0B0E14)
    val Bg = Color(0xFF121212)
    val Card = Color(0xFF191C1C)
    val Elevated = Color(0xFF282A2A)
    val Accent = Color(0xFF00D2D3)
    val AccentBright = Color(0xFF00F2FF)
    val AccentMint = Color(0xFF48FFD5)
    val LogoRing = Color(0xFF348997)
    val Text = Color(0xFFE0E0E0)
    val Text2 = Color(0xFFB9CACB)
    val Muted = Color(0xFF445456)
    val OnCta = Color(0xFF0B1A1A)
    val Income = Color(0xFF228D57)
    val Danger = Color(0xFFFFB4AB)
    val Border = Color(0xB33F4E4F)
    val InputFill = Color(0x0DFFFFFF)

    val Cta = Brush.linearGradient(listOf(Accent, AccentMint, Accent))
    val Balance = Brush.linearGradient(listOf(Elevated, Card))
}
