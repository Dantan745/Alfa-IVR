package com.example.alfabankivrub

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.alfabankivrub.core.di.AppContainer
import com.example.alfabankivrub.feature.auth.AuthViewModel
import com.example.alfabankivrub.feature.auth.AuthViewModelFactory
import com.example.alfabankivrub.feature.auth.LoginScreen
import com.example.alfabankivrub.feature.auth.RegistrationStep1Screen
import com.example.alfabankivrub.feature.auth.RegistrationStep2Screen
import com.example.alfabankivrub.feature.auth.RegistrationStep3Screen
import com.example.alfabankivrub.feature.home.HomeScreen
import com.example.alfabankivrub.feature.home.HomeViewModel
import com.example.alfabankivrub.feature.home.HomeViewModelFactory
import com.example.alfabankivrub.navigation.Routes
import com.example.alfabankivrub.ui.theme.AlfaBankIvRubTheme

class MainActivity : ComponentActivity() {
    private val container by lazy { AppContainer(applicationContext) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            AlfaBankIvRubTheme {
                AppNavHost(container)
            }
        }
    }
}

@Composable
fun AppNavHost(container: AppContainer) {
    val navController = rememberNavController()
    val authViewModel: AuthViewModel = viewModel(
        factory = AuthViewModelFactory(
            registerUserUseCase = container.registerUserUseCase,
            loginUseCase = container.loginUseCase,
            getActiveSessionUseCase = container.getActiveSessionUseCase
        )
    )
    val homeViewModel: HomeViewModel = viewModel(
        factory = HomeViewModelFactory(
            getActiveSessionUseCase = container.getActiveSessionUseCase,
            logoutUseCase = container.logoutUseCase
        )
    )
    val authState by authViewModel.state.collectAsState()
    val homeState by homeViewModel.state.collectAsState()

    if (!authState.sessionChecked) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    val startDestination = if (authState.activeUser != null) Routes.Home else Routes.Login

    NavHost(navController = navController, startDestination = startDestination) {
        composable(Routes.Login) {
            LoginScreen(
                state = authState,
                onEmailChange = authViewModel::updateLoginEmail,
                onPasswordChange = authViewModel::updateLoginPassword,
                onLogin = {
                    authViewModel.login {
                        homeViewModel.refresh()
                        navController.navigate(Routes.Home) {
                            popUpTo(Routes.Login) { inclusive = true }
                        }
                    }
                },
                onRegisterClick = {
                    authViewModel.clearError()
                    navController.navigate(Routes.RegisterStep1)
                }
            )
        }

        composable(Routes.RegisterStep1) {
            RegistrationStep1Screen(
                draft = authState.registrationDraft,
                error = authState.error,
                onDraftChange = { newDraft -> authViewModel.updateRegistration { newDraft } },
                onNext = {
                    val error = authViewModel.validateStep1()
                    if (error != null) {
                        authViewModel.setError(error)
                    } else {
                        authViewModel.clearError()
                        navController.navigate(Routes.RegisterStep2)
                    }
                },
                onBackToLogin = { navController.popBackStack() }
            )
        }

        composable(Routes.RegisterStep2) {
            RegistrationStep2Screen(
                draft = authState.registrationDraft,
                error = authState.error,
                onDraftChange = { newDraft -> authViewModel.updateRegistration { newDraft } },
                onBack = { navController.popBackStack() },
                onNext = {
                    val error = authViewModel.validateStep2()
                    if (error == null) {
                        authViewModel.clearError()
                        navController.navigate(Routes.RegisterStep3)
                    } else {
                        authViewModel.setError(error)
                    }
                }
            )
        }

        composable(Routes.RegisterStep3) {
            RegistrationStep3Screen(
                state = authState,
                onDraftChange = { newDraft -> authViewModel.updateRegistration { newDraft } },
                onBack = { navController.popBackStack() },
                onRegister = {
                    authViewModel.register {
                        homeViewModel.refresh()
                        navController.navigate(Routes.Home) {
                            popUpTo(Routes.Login) { inclusive = true }
                        }
                    }
                }
            )
        }

        composable(Routes.Home) {
            HomeScreen(
                user = homeState.user,
                onLogout = {
                    homeViewModel.logout {
                        navController.navigate(Routes.Login) {
                            popUpTo(Routes.Home) { inclusive = true }
                        }
                    }
                }
            )
        }
    }
}

@Preview(showBackground = true)
@Composable
fun GreetingPreview() {
    AlfaBankIvRubTheme {
        // Preview is intentionally minimal for this screen-based app.
    }
}