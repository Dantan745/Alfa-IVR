package ru.raidzyu.alfacr.data.security

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

/** Опциональный вход по биометрии. На устройствах без сенсора кнопка скрыта. */
object BiometricUnlock {
    fun available(activity: FragmentActivity): Boolean {
        val m = BiometricManager.from(activity)
        return m.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK) ==
            BiometricManager.BIOMETRIC_SUCCESS
    }

    fun prompt(activity: FragmentActivity, onOk: () -> Unit, onFail: (String) -> Unit) {
        val prompt = BiometricPrompt(
            activity,
            ContextCompat.getMainExecutor(activity),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    onOk()
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    if (errorCode != BiometricPrompt.ERROR_USER_CANCELED &&
                        errorCode != BiometricPrompt.ERROR_NEGATIVE_BUTTON
                    ) {
                        onFail(errString.toString())
                    }
                }
            },
        )
        prompt.authenticate(
            BiometricPrompt.PromptInfo.Builder()
                .setTitle("Вход в Alfa Кошелёк ЦР")
                .setSubtitle("Подтвердите личность")
                .setNegativeButtonText("PIN")
                .build(),
        )
    }
}
