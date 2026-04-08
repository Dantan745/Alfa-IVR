package ru.raidzyu.alfacr.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import ru.raidzyu.alfacr.ui.components.BottomNav
import ru.raidzyu.alfacr.ui.components.DeviceShell
import ru.raidzyu.alfacr.ui.components.SecureWindow
import ru.raidzyu.alfacr.ui.screens.AddressBookScreen
import ru.raidzyu.alfacr.ui.screens.AuthScreen
import ru.raidzyu.alfacr.ui.screens.BulkScreen
import ru.raidzyu.alfacr.ui.screens.HistoryScreen
import ru.raidzyu.alfacr.ui.screens.HomeScreen
import ru.raidzyu.alfacr.ui.screens.LimitsScreen
import ru.raidzyu.alfacr.ui.screens.PaymentsScreen
import ru.raidzyu.alfacr.ui.screens.PinScreen
import ru.raidzyu.alfacr.ui.screens.ProfileScreen
import ru.raidzyu.alfacr.ui.screens.QrScreen
import ru.raidzyu.alfacr.ui.screens.SmartScreen
import ru.raidzyu.alfacr.ui.screens.TopUpScreen
import ru.raidzyu.alfacr.ui.screens.TransferScreen

@Composable
fun AppRoot(vm: AppViewModel) {
    val userId by vm.userId.collectAsState()
    val locked by vm.locked.collectAsState()
    val toast by vm.toast.collectAsState()
    val snack = remember { SnackbarHostState() }

    LaunchedEffect(toast) {
        toast?.let {
            snack.showSnackbar(it)
            vm.toast.value = null
        }
    }

    DeviceShell {
        Box(Modifier.fillMaxSize()) {
            SecureWindow(enabled = userId <= 0 || locked)
            when {
                userId <= 0 -> AuthScreen(vm)
                locked -> PinScreen(vm)
                else -> MainGraph(vm)
            }
            SnackbarHost(snack, Modifier.align(Alignment.BottomCenter))
        }
    }
}

@Composable
private fun MainGraph(vm: AppViewModel) {
    val nav = rememberNavController()
    val back by nav.currentBackStackEntryAsState()
    val route = back?.destination?.route ?: "home"
    val tabs = setOf("home", "payments", "history", "profile")
    val showBar = route in tabs

    Column(Modifier.fillMaxSize()) {
        NavHost(
            navController = nav,
            startDestination = "home",
            modifier = Modifier.weight(1f),
        ) {
            composable("home") { HomeScreen(vm) { nav.navigate(it) } }
            composable("payments") { PaymentsScreen(vm) { nav.navigate(it) } }
            composable("history") { HistoryScreen(vm) }
            composable("profile") { ProfileScreen(vm) { r ->
                if (r == "history") {
                    nav.navigate("history") {
                        popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                        launchSingleTop = true
                        restoreState = true
                    }
                } else nav.navigate(r)
            } }
            composable("transfer") { TransferScreen(vm, { nav.popBackStack() }) { nav.navigate(it) } }
            composable("qr") { QrScreen(vm) { nav.popBackStack() } }
            composable("limits") { LimitsScreen(vm) { nav.popBackStack() } }
            composable("address") { AddressBookScreen(vm) { nav.popBackStack() } }
            composable("bulk") { BulkScreen(vm) { nav.popBackStack() } }
            composable("smart") { SmartScreen(vm) { nav.popBackStack() } }
            composable("topup") { TopUpScreen(vm) { nav.popBackStack() } }
        }
        if (showBar) {
            BottomNav(if (route in tabs) route else "home") { tab ->
                nav.navigate(tab) {
                    popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                    launchSingleTop = true
                    restoreState = true
                }
            }
        }
    }
}
