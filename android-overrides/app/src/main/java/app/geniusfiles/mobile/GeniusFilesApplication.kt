package app.geniusfiles.mobile

import android.app.Application
import androidx.appcompat.app.AppCompatDelegate

/**
 * Applique le mode sauvegardé avant la création de MainActivity.
 * Le thème de la fenêtre de lancement et le splash Android disposent ainsi
 * de la bonne configuration dès la toute première frame du cold start.
 */
class GeniusFilesApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        val mode = getSharedPreferences(MainActivity.THEME_PREFS, MODE_PRIVATE)
            .getString(MainActivity.THEME_MODE, "system") ?: "system"
        AppCompatDelegate.setDefaultNightMode(
            when (mode) {
                "light" -> AppCompatDelegate.MODE_NIGHT_NO
                "dark" -> AppCompatDelegate.MODE_NIGHT_YES
                else -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
            }
        )
    }
}
