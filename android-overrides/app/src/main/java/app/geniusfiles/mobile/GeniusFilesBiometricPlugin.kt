package app.geniusfiles.mobile

import android.os.Build
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * GeniusFilesBiometric — pont natif AndroidX Biometric pour le coffre-fort.
 *
 * L'ancienne implémentation web interrogeait un plugin tiers absent de
 * l'APK (`NativeBiometric`), donc la biométrie était TOUJOURS annoncée
 * comme « non disponible », même avec un lecteur d'empreintes fonctionnel.
 *
 * Ici on interroge `BiometricManager` avec BIOMETRIC_STRONG puis, en
 * repli, BIOMETRIC_WEAK : les capteurs d'empreintes classés « weak » par
 * le constructeur restent donc utilisables. Chaque cas d'échec renvoie un
 * statut distinct pour que l'UI affiche le bon message :
 *   available | none_enrolled | no_hardware | hw_unavailable |
 *   security_update_required | unsupported | unknown
 */
@CapacitorPlugin(name = "GeniusFilesBiometric")
class GeniusFilesBiometricPlugin : Plugin() {

    private val strong = BiometricManager.Authenticators.BIOMETRIC_STRONG
    private val weak = BiometricManager.Authenticators.BIOMETRIC_WEAK

    private fun manager() = BiometricManager.from(context)

    /** Le meilleur niveau réellement exploitable sur cet appareil. */
    private fun resolve(): Pair<Int, Int> {
        val m = manager()
        val strongResult = m.canAuthenticate(strong)
        if (strongResult == BiometricManager.BIOMETRIC_SUCCESS) return strong to strongResult
        val weakResult = m.canAuthenticate(weak)
        if (weakResult == BiometricManager.BIOMETRIC_SUCCESS) return weak to weakResult
        // Aucun des deux n'est prêt : on remonte le code le plus « réparable »
        // (empreinte non enregistrée > matériel absent).
        return if (weakResult == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED ||
            strongResult == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED
        ) {
            weak to BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED
        } else {
            weak to weakResult
        }
    }

    private fun statusOf(code: Int): String = when (code) {
        BiometricManager.BIOMETRIC_SUCCESS -> "available"
        BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> "none_enrolled"
        BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> "no_hardware"
        BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> "hw_unavailable"
        BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED -> "security_update_required"
        BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED -> "unsupported"
        else -> "unknown"
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        try {
            val (authenticators, code) = resolve()
            val status = statusOf(code)
            val result = JSObject()
            result.put("isAvailable", status == "available")
            result.put("status", status)
            result.put("strong", authenticators == strong && status == "available")
            result.put(
                "hasFingerprintFeature",
                context.packageManager.hasSystemFeature("android.hardware.fingerprint"),
            )
            result.put("sdk", Build.VERSION.SDK_INT)
            call.resolve(result)
        } catch (e: Throwable) {
            val result = JSObject()
            result.put("isAvailable", false)
            result.put("status", "unknown")
            result.put("message", e.message ?: "")
            call.resolve(result)
        }
    }

    @PluginMethod
    fun verify(call: PluginCall) {
        val activity = this.activity as? FragmentActivity
        if (activity == null) {
            call.resolve(failure("unknown", "Activité indisponible"))
            return
        }
        val (authenticators, code) = resolve()
        if (code != BiometricManager.BIOMETRIC_SUCCESS) {
            call.resolve(failure(statusOf(code), null))
            return
        }
        val title = call.getString("title") ?: "GeniusFiles"
        val reason = call.getString("reason") ?: "Déverrouiller le coffre-fort"
        val cancelLabel = call.getString("cancelLabel") ?: "Utiliser le code"

        activity.runOnUiThread {
            try {
                val executor = ContextCompat.getMainExecutor(activity)
                val prompt = BiometricPrompt(
                    activity,
                    executor,
                    object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationSucceeded(
                            result: BiometricPrompt.AuthenticationResult,
                        ) {
                            val out = JSObject()
                            out.put("verified", true)
                            out.put("status", "success")
                            call.resolve(out)
                        }

                        override fun onAuthenticationError(
                            errorCode: Int,
                            errString: CharSequence,
                        ) {
                            val status = when (errorCode) {
                                BiometricPrompt.ERROR_LOCKOUT,
                                BiometricPrompt.ERROR_LOCKOUT_PERMANENT,
                                -> "lockout"
                                BiometricPrompt.ERROR_USER_CANCELED,
                                BiometricPrompt.ERROR_NEGATIVE_BUTTON,
                                BiometricPrompt.ERROR_CANCELED,
                                -> "cancelled"
                                BiometricPrompt.ERROR_NO_BIOMETRICS -> "none_enrolled"
                                BiometricPrompt.ERROR_HW_NOT_PRESENT -> "no_hardware"
                                BiometricPrompt.ERROR_HW_UNAVAILABLE -> "hw_unavailable"
                                else -> "failed"
                            }
                            call.resolve(failure(status, errString.toString()))
                        }
                    },
                )
                val info = BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title)
                    .setSubtitle(reason)
                    .setAllowedAuthenticators(authenticators)
                    .setNegativeButtonText(cancelLabel)
                    .setConfirmationRequired(false)
                    .build()
                prompt.authenticate(info)
            } catch (e: Throwable) {
                call.resolve(failure("failed", e.message))
            }
        }
    }

    private fun failure(status: String, message: String?): JSObject {
        val out = JSObject()
        out.put("verified", false)
        out.put("status", status)
        if (message != null) out.put("message", message)
        return out
    }
}
