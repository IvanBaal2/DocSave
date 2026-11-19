package expo.modules.docsavesecurity

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.os.Build
import android.os.Debug
import android.util.Base64
import android.util.Log
import androidx.exifinterface.media.ExifInterface
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.security.SecureRandom
import java.util.Date
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

private val MAGIC = byteArrayOf(0x44, 0x53, 0x56, 0x31) // "DSV1"
private const val NONCE_BYTES = 12
private const val HEADER_BYTES = 16 // magic + nonce
private const val TAG_BYTES = 16

private class DocsaveCrashHandler(
  private val file: File,
  private val previous: Thread.UncaughtExceptionHandler?
) : Thread.UncaughtExceptionHandler {
  override fun uncaughtException(t: Thread, e: Throwable) {
    try {
      file.writeText("${Date()}\nthread: ${t.name}\nandroid: ${Build.VERSION.RELEASE} (${Build.MANUFACTURER} ${Build.MODEL})\n\n${Log.getStackTraceString(e)}".take(12000))
    } catch (_: Throwable) {
    }
    previous?.uncaughtException(t, e)
  }
}

class DocsaveSecurityModule : Module() {
  private val random = SecureRandom()

  override fun definition() = ModuleDefinition {
    Name("DocsaveSecurity")

    // Crash recorder: keeps the technical stack trace of a native crash in the
    // app's private storage so it can be shown on the next launch. It never
    // contains document content.
    OnCreate {
      val dir = appContext.reactContext?.filesDir ?: return@OnCreate
      val file = File(dir, "docsave_last_crash.txt")
      val previous = Thread.getDefaultUncaughtExceptionHandler()
      if (previous !is DocsaveCrashHandler) {
        Thread.setDefaultUncaughtExceptionHandler(DocsaveCrashHandler(file, previous))
      }
    }

    Function("readLastCrash") {
      val dir = appContext.reactContext?.filesDir ?: return@Function null
      val file = File(dir, "docsave_last_crash.txt")
      if (file.exists()) file.readText().take(6000) else null
    }

    Function("clearLastCrash") {
      val dir = appContext.reactContext?.filesDir ?: return@Function false
      File(dir, "docsave_last_crash.txt").delete()
    }

    // Android backups are disabled application-wide (allowBackup=false and
    // dataExtractionRules via the withAndroidNoBackup config plugin).
    Function("excludeFromBackup") { _: String -> true }

    // Heuristic root / instrumentation detection using file and property checks
    // only (no shell commands). Root-hiding tools can conceal these indicators.
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
      if (Debug.isDebuggerConnected() || Debug.waitingForDebugger()) reasons.add("debugger-attached")
      if (hasFridaMapping()) reasons.add("frida")
      mapOf(
        "compromised" to reasons.isNotEmpty(),
        "emulator" to isEmulator(),
        "reasons" to reasons
      )
    }

    // ── Cryptography (platform crypto: Conscrypt / BoringSSL) ────────────────

    AsyncFunction("pbkdf2Sha256") { password: String, saltB64: String, iterations: Int, length: Int ->
      val spec = PBEKeySpec(password.toCharArray(), b64d(saltB64), iterations, length * 8)
      try {
        val key = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
        b64e(key)
      } finally {
        spec.clearPassword()
      }
    }

    AsyncFunction("sealToFile") { keyB64: String, aad: String, dataB64: String, path: String ->
      val sealed = seal(b64d(keyB64), aad.toByteArray(Charsets.UTF_8), b64d(dataB64))
      writeAtomic(path, sealed)
      sealed.size
    }

    AsyncFunction("sealFileToFile") { keyB64: String, aad: String, inPath: String, outPath: String ->
      val plain = File(stripScheme(inPath)).readBytes()
      try {
        val sealed = seal(b64d(keyB64), aad.toByteArray(Charsets.UTF_8), plain)
        writeAtomic(outPath, sealed)
        mapOf("size" to plain.size, "head" to b64e(plain.copyOfRange(0, minOf(16, plain.size))))
      } finally {
        plain.fill(0)
      }
    }

    AsyncFunction("openFile") { keyB64: String, aad: String, path: String ->
      val file = File(stripScheme(path))
      if (!file.exists()) throw CodedException("ERR_MISSING", "Encrypted file is missing", null)
      val plain = open(b64d(keyB64), aad.toByteArray(Charsets.UTF_8), file.readBytes())
      try {
        b64e(plain)
      } finally {
        plain.fill(0)
      }
    }

    // ── On-device text recognition (ML Kit, bundled model, no network) ───────

    // maxDim: images are downscaled before recognition. Modern phone photos
    // (50+ MP) are otherwise too large to decode reliably and slow to analyse.
    AsyncFunction("recognizeText") { imageB64: String, maxDim: Int, rotation: Int, promise: Promise ->
      val bitmap = try {
        decodeUpright(b64d(imageB64), maxDim)
      } catch (e: Throwable) {
        promise.reject(CodedException("ERR_IMAGE", "Image decode failed: ${e.javaClass.simpleName} ${e.message ?: ""}", e))
        return@AsyncFunction
      }
      if (bitmap == null) {
        promise.reject(CodedException("ERR_IMAGE", "The image could not be decoded", null))
        return@AsyncFunction
      }
      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      // rotation (0/90/180/270): lets ML Kit read cards photographed sideways.
      recognizer.process(InputImage.fromBitmap(bitmap, ((rotation % 360) + 360) % 360))
        .addOnSuccessListener { result ->
          val lines = result.textBlocks.flatMap { it.lines }.map { line ->
            val box = line.boundingBox
            mapOf(
              "text" to line.text,
              "x" to (box?.left ?: 0),
              "y" to (box?.top ?: 0),
              "w" to (box?.width() ?: 0),
              "h" to (box?.height() ?: 0)
            )
          }
          promise.resolve(mapOf("width" to bitmap.width, "height" to bitmap.height, "lines" to lines))
          recognizer.close()
          bitmap.recycle()
        }
        .addOnFailureListener { e ->
          promise.reject(CodedException("ERR_OCR", e.message ?: "Text recognition failed", e))
          recognizer.close()
          bitmap.recycle()
        }
    }

    // Crops a JPEG to a normalised rectangle (0..1) and re-encodes it, in memory.
    AsyncFunction("cropJpeg") { imageB64: String, x: Double, y: Double, w: Double, h: Double, quality: Double, maxDim: Int ->
      val src = decodeUpright(b64d(imageB64), maxDim)
        ?: throw CodedException("ERR_IMAGE", "The image could not be decoded", null)
      val left = (x.coerceIn(0.0, 1.0) * src.width).toInt()
      val top = (y.coerceIn(0.0, 1.0) * src.height).toInt()
      val width = (w.coerceIn(0.0, 1.0) * src.width).toInt().coerceAtMost(src.width - left).coerceAtLeast(1)
      val height = (h.coerceIn(0.0, 1.0) * src.height).toInt().coerceAtMost(src.height - top).coerceAtLeast(1)
      val cropped = Bitmap.createBitmap(src, left, top, width, height)
      val out = ByteArrayOutputStream()
      cropped.compress(Bitmap.CompressFormat.JPEG, (quality * 100).toInt().coerceIn(30, 100), out)
      if (cropped != src) cropped.recycle()
      src.recycle()
      b64e(out.toByteArray())
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private fun seal(key: ByteArray, aad: ByteArray, plain: ByteArray): ByteArray {
    require(key.size == 32) { "Key must be 32 bytes" }
    val nonce = ByteArray(NONCE_BYTES).also { random.nextBytes(it) }
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_BYTES * 8, nonce))
    cipher.updateAAD(aad)
    val ct = cipher.doFinal(plain)
    key.fill(0)
    return MAGIC + nonce + ct
  }

  private fun open(key: ByteArray, aad: ByteArray, blob: ByteArray): ByteArray {
    if (blob.size < HEADER_BYTES + TAG_BYTES || !blob.copyOfRange(0, 4).contentEquals(MAGIC)) {
      throw CodedException("ERR_FORMAT", "Not a Docsave encrypted object", null)
    }
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(
      Cipher.DECRYPT_MODE,
      SecretKeySpec(key, "AES"),
      GCMParameterSpec(TAG_BYTES * 8, blob, 4, NONCE_BYTES)
    )
    cipher.updateAAD(aad)
    try {
      return cipher.doFinal(blob, HEADER_BYTES, blob.size - HEADER_BYTES)
    } catch (e: AEADBadTagException) {
      throw CodedException("ERR_TAMPER", "Integrity check failed", e)
    } finally {
      key.fill(0)
    }
  }

  private fun writeAtomic(path: String, data: ByteArray) {
    val target = File(stripScheme(path))
    target.parentFile?.mkdirs()
    val tmp = File(target.parentFile, target.name + ".tmp")
    tmp.writeBytes(data)
    if (!tmp.renameTo(target)) {
      target.delete()
      if (!tmp.renameTo(target)) throw CodedException("ERR_WRITE", "Could not write encrypted file", null)
    }
  }

  private fun decodeUpright(bytes: ByteArray, maxDim: Int): Bitmap? {
    // Decode at a reduced size (power-of-two subsampling) so huge photos never
    // exhaust memory.
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    var sample = 1
    val longest = maxOf(bounds.outWidth, bounds.outHeight)
    if (maxDim > 0) {
      while (longest / (sample * 2) >= maxDim) sample *= 2
    }
    val opts = BitmapFactory.Options().apply { inSampleSize = sample }
    var bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts) ?: return null
    if (maxDim > 0 && maxOf(bitmap.width, bitmap.height) > maxDim) {
      val scale = maxDim.toFloat() / maxOf(bitmap.width, bitmap.height)
      val scaled = Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).toInt(), (bitmap.height * scale).toInt(), true)
      if (scaled != bitmap) bitmap.recycle()
      bitmap = scaled
    }
    val orientation = try {
      ExifInterface(ByteArrayInputStream(bytes))
        .getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
    } catch (_: Throwable) {
      ExifInterface.ORIENTATION_NORMAL
    }
    val degrees = when (orientation) {
      ExifInterface.ORIENTATION_ROTATE_90 -> 90f
      ExifInterface.ORIENTATION_ROTATE_180 -> 180f
      ExifInterface.ORIENTATION_ROTATE_270 -> 270f
      else -> 0f
    }
    if (degrees == 0f) return bitmap
    val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, Matrix().apply { postRotate(degrees) }, true)
    if (rotated != bitmap) bitmap.recycle()
    return rotated
  }

  private fun stripScheme(path: String) = if (path.startsWith("file://")) path.removePrefix("file://") else path
  private fun b64d(s: String): ByteArray = Base64.decode(s, Base64.DEFAULT)
  private fun b64e(b: ByteArray): String = Base64.encodeToString(b, Base64.NO_WRAP)

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
