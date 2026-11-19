package expo.modules.docsavesecurity

import android.os.Build
import android.os.Debug
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class DocsaveSecurityModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DocsaveSecurity")

    // Android backups are disabled application-wide (allowBackup=false and
    // dataExtractionRules via the withAndroidNoBackup config plugin).
    Function("excludeFromBackup") { _: String -> true }

    // Heuristic root / instrumentation detection. No check is bulletproof:
    // root-hiding tools (e.g. Magisk DenyList) can conceal these indicators.
    Function("checkIntegrity") {
      val reasons = mutableListOf<String>()

      val suPaths = listOf(
        "/system/bin/su", "/system/xbin/su", "/sbin/su", "/su/bin/su",
        "/system/sd/xbin/su", "/system/bin/failsafe/su", "/data/local/su",
        "/data/local/bin/su", "/data/local/xbin/su", "/system/app/Superuser.apk",
        "/data/adb/magisk", "/sbin/.magisk", "/data/adb/ksu", "/data/adb/ap"
      )
      for (path in suPaths) {
        if (File(path).exists()) reasons.add("path:$path")
      }

      val tags = Build.TAGS
      if (tags != null && tags.contains("test-keys")) reasons.add("test-keys")

      if (canExecuteSu()) reasons.add("su-executable")

      if (Debug.isDebuggerConnected() || Debug.waitingForDebugger()) reasons.add("debugger-attached")

      if (hasFridaMapping()) reasons.add("frida")

      mapOf(
        "compromised" to reasons.isNotEmpty(),
        "emulator" to isEmulator(),
        "reasons" to reasons
      )
    }
  }

  private fun canExecuteSu(): Boolean {
    var process: Process? = null
    return try {
      process = Runtime.getRuntime().exec(arrayOf("/system/xbin/which", "su"))
      process.inputStream.bufferedReader().use { it.readLine() } != null
    } catch (_: Throwable) {
      false
    } finally {
      process?.destroy()
    }
  }

  private fun hasFridaMapping(): Boolean = try {
    File("/proc/self/maps").useLines { lines ->
      lines.any { it.contains("frida", ignoreCase = true) || it.contains("gum-js", ignoreCase = true) }
    }
  } catch (_: Throwable) {
    false
  }

  private fun isEmulator(): Boolean {
    val fp = Build.FINGERPRINT ?: ""
    return fp.startsWith("generic") || fp.contains("emulator") ||
      Build.MODEL.contains("Emulator") || Build.MODEL.contains("Android SDK built for") ||
      Build.HARDWARE.contains("goldfish") || Build.HARDWARE.contains("ranchu") ||
      Build.PRODUCT.contains("sdk")
  }
}
