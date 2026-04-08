package ru.raidzyu.alfacr.ui

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.LocalCafe
import androidx.compose.material.icons.filled.LocalPharmacy
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Undo
import androidx.compose.material.icons.filled.Work
import androidx.compose.ui.graphics.vector.ImageVector

fun txIcon(key: String): ImageVector = when (key) {
    "local_cafe" -> Icons.Default.LocalCafe
    "person" -> Icons.Default.Person
    "shopping_cart" -> Icons.Default.ShoppingCart
    "work" -> Icons.Default.Work
    "directions_car" -> Icons.Default.DirectionsCar
    "local_pharmacy" -> Icons.Default.LocalPharmacy
    "phone_android" -> Icons.Default.PhoneAndroid
    "qr_code" -> Icons.Default.QrCode
    "undo" -> Icons.Default.Undo
    else -> Icons.Default.Person
}
