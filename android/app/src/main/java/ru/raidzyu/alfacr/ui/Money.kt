package ru.raidzyu.alfacr.ui

import java.text.NumberFormat
import java.util.Locale

private val ru = Locale("ru", "RU")

fun Long.toRub(): String {
    val nf = NumberFormat.getNumberInstance(ru)
    nf.minimumFractionDigits = 2
    nf.maximumFractionDigits = 2
    return nf.format(this / 100.0)
}

fun Long.toRubSigned(): String {
    val sign = if (this >= 0) "+" else "−"
    return sign + kotlin.math.abs(this).toRub() + " ₽"
}

fun Long.toRubPlain(): String = this.toRub() + " ₽"
