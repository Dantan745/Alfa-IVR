package ru.raidzyu.alfacr

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.core.view.WindowCompat
import ru.raidzyu.alfacr.ui.AppRoot
import ru.raidzyu.alfacr.ui.AppViewModel
import ru.raidzyu.alfacr.ui.theme.Cr
import ru.raidzyu.alfacr.ui.theme.CrTypography

class MainActivity : ComponentActivity() {
    private val vm: AppViewModel by viewModels()
    private var leftForeground = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        WindowCompat.setDecorFitsSystemWindows(window, false)
        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(background = Cr.Bg, surface = Cr.Card, primary = Cr.Accent),
                typography = CrTypography,
            ) {
                AppRoot(vm)
            }
        }
    }

    override fun onPause() {
        super.onPause()
        leftForeground = true
    }

    override fun onResume() {
        super.onResume()
        if (leftForeground && vm.userId.value > 0) {
            vm.locked.value = true
        }
    }
}
