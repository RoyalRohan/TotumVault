#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const manifestPath = path.resolve(
  __dirname,
  '../src-tauri/gen/android/app/src/main/AndroidManifest.xml'
);

if (!fs.existsSync(manifestPath)) {
  console.log(`[patch-android-manifest] AndroidManifest.xml not found at ${manifestPath}. Skipping.`);
  process.exit(0);
}

let content = fs.readFileSync(manifestPath, 'utf8');

const permissionsToInject = [
  '    <uses-permission android:name="android.permission.CAMERA" />',
  '    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />',
  '    <uses-permission android:name="android.permission.USE_BIOMETRIC" />',
  '    <uses-permission android:name="android.permission.USE_FINGERPRINT" />',
  '    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />',
  '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
  '    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />',
  '    <uses-feature android:name="android.hardware.camera" android:required="false" />',
  '    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />',
  '    <uses-feature android:name="android.hardware.fingerprint" android:required="false" />',
  '    <uses-feature android:name="android.hardware.biometrics.face" android:required="false" />',
  '    <uses-feature android:name="android.hardware.biometrics.iris" android:required="false" />',
];

let modified = false;

for (const line of permissionsToInject) {
  const permNameMatch = line.match(/android:name="([^"]+)"/);
  if (permNameMatch && !content.includes(permNameMatch[1])) {
    if (content.includes('android.permission.INTERNET')) {
      content = content.replace(
        /(<uses-permission\s+android:name="android\.permission\.INTERNET"\s*\/>)/,
        `$1\n${line}`
      );
      modified = true;
    } else if (content.includes('<application')) {
      content = content.replace(
        /<application/,
        `${line}\n    <application`
      );
      modified = true;
    }
  }
}

if (modified) {
  fs.writeFileSync(manifestPath, content, 'utf8');
  console.log('[patch-android-manifest] Successfully injected Camera and Biometric permissions into AndroidManifest.xml');
} else {
  console.log('[patch-android-manifest] All permissions already present in AndroidManifest.xml');
}

// Inject DocumentReminderReceiver into AndroidManifest.xml if not present
if (!content.includes('DocumentReminderReceiver')) {
  const receiverSnippet = `        <receiver
            android:name="com.royalrohan.veylock.DocumentReminderReceiver"
            android:exported="false">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
                <action android:name="android.intent.action.TIMEZONE_CHANGED" />
                <action android:name="android.intent.action.TIME_SET" />
                <action android:name="android.intent.action.DATE_CHANGED" />
                <action android:name="com.royalrohan.veylock.CHECK_DOCUMENT_REMINDERS" />
            </intent-filter>
        </receiver>`;
  if (content.includes('</application>')) {
    content = content.replace('</application>', `${receiverSnippet}\n    </application>`);
    fs.writeFileSync(manifestPath, content, 'utf8');
    console.log('[patch-android-manifest] Successfully injected DocumentReminderReceiver into AndroidManifest.xml');
  }
} else {
  // Ensure all required intent actions are present inside the receiver's intent-filter
  const requiredActions = [
    '<action android:name="android.intent.action.TIMEZONE_CHANGED" />',
    '<action android:name="android.intent.action.TIME_SET" />',
    '<action android:name="android.intent.action.DATE_CHANGED" />'
  ];
  let updatedContent = content;
  for (const actLine of requiredActions) {
    const actMatch = actLine.match(/android:name="([^"]+)"/);
    if (actMatch && !updatedContent.includes(actMatch[1])) {
      updatedContent = updatedContent.replace(
        '<action android:name="com.royalrohan.veylock.CHECK_DOCUMENT_REMINDERS" />',
        `${actLine}\n                <action android:name="com.royalrohan.veylock.CHECK_DOCUMENT_REMINDERS" />`
      );
    }
  }
  if (updatedContent !== content) {
    content = updatedContent;
    fs.writeFileSync(manifestPath, content, 'utf8');
    console.log('[patch-android-manifest] Added missing time/date actions to DocumentReminderReceiver in AndroidManifest.xml');
  }
}

// Copy DocumentReminderReceiver.kt to Android source tree if directory exists
const receiverSrc = path.resolve(__dirname, 'android/DocumentReminderReceiver.kt');
if (fs.existsSync(receiverSrc)) {
  const possibleTargetDirs = [
    path.resolve(__dirname, '../src-tauri/gen/android/app/src/main/java/com/royalrohan/veylock'),
    path.resolve(__dirname, '../src-tauri/gen/android/app/src/main/kotlin/com/royalrohan/veylock')
  ];
  for (const tDir of possibleTargetDirs) {
    if (fs.existsSync(tDir)) {
      const dest = path.join(tDir, 'DocumentReminderReceiver.kt');
      fs.copyFileSync(receiverSrc, dest);
      console.log(`[patch-android-manifest] Copied DocumentReminderReceiver.kt to ${dest}`);
    }
  }
}

// Extract app version and calculate Android versionCode
const tauriConfPath = path.resolve(__dirname, '../src-tauri/tauri.conf.json');
let appVersion = '2.0.0';
if (fs.existsSync(tauriConfPath)) {
  try {
    const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
    if (tauriConf.version) {
      appVersion = tauriConf.version;
    }
  } catch (e) {
    console.warn(`[patch-android-manifest] Failed to read tauri.conf.json version: ${e.message}`);
  }
}

const semverParts = appVersion.split('.').map(n => parseInt(n, 10) || 0);
const major = semverParts[0] || 1;
const minor = semverParts[1] || 0;
const patch = semverParts[2] || 0;
// Standard Android versionCode: major * 1000000 + minor * 1000 + patch (e.g. 2.0.0 -> 2000000)
const calculatedVersionCode = major * 1000000 + minor * 1000 + patch;

// Patch build.gradle.kts / build.gradle to ensure androidx.biometric dependency, versionCode, and versionName are updated
const gradlePaths = [
  path.resolve(__dirname, '../src-tauri/gen/android/app/build.gradle.kts'),
  path.resolve(__dirname, '../src-tauri/gen/android/app/build.gradle'),
];

for (const gPath of gradlePaths) {
  if (fs.existsSync(gPath)) {
    let gContent = fs.readFileSync(gPath, 'utf8');
    let gradleModified = false;

    // Ensure versionCode is up-to-date and monotonically increasing
    if (/versionCode\s*=\s*\d+/.test(gContent)) {
      gContent = gContent.replace(/versionCode\s*=\s*\d+/, `versionCode = ${calculatedVersionCode}`);
      gradleModified = true;
    } else if (/versionCode\s+\d+/.test(gContent)) {
      gContent = gContent.replace(/versionCode\s+\d+/, `versionCode ${calculatedVersionCode}`);
      gradleModified = true;
    }

    // Ensure versionName matches tauri.conf.json
    if (/versionName\s*=\s*"[^"]*"/.test(gContent)) {
      gContent = gContent.replace(/versionName\s*=\s*"[^"]*"/, `versionName = "${appVersion}"`);
      gradleModified = true;
    } else if (/versionName\s+"[^"]*"/.test(gContent)) {
      gContent = gContent.replace(/versionName\s+"[^"]*"/, `versionName "${appVersion}"`);
      gradleModified = true;
    }

    if (!gContent.includes('androidx.biometric:biometric')) {
      if (gContent.includes('dependencies {')) {
        const depLine = gPath.endsWith('.kts')
          ? '    implementation("androidx.biometric:biometric:1.2.0-alpha05")'
          : "    implementation 'androidx.biometric:biometric:1.2.0-alpha05'";
        gContent = gContent.replace('dependencies {', `dependencies {\n${depLine}`);
        gradleModified = true;
      }
    }

    if (gradleModified) {
      fs.writeFileSync(gPath, gContent, 'utf8');
      console.log(`[patch-android-manifest] Updated Gradle build configuration (versionCode=${calculatedVersionCode}, versionName="${appVersion}") in ${gPath}`);
    }
  }
}

// Copy permanent release keystore into Android project if present
const permanentKeystoreSrc = path.resolve(__dirname, 'android/totumvault-release.jks');
const genAndroidDir = path.resolve(__dirname, '../src-tauri/gen/android');
if (fs.existsSync(permanentKeystoreSrc) && fs.existsSync(genAndroidDir)) {
  const destKeystore = path.join(genAndroidDir, 'release.keystore');
  fs.copyFileSync(permanentKeystoreSrc, destKeystore);
  console.log(`[patch-android-manifest] Copied permanent release keystore to ${destKeystore}`);
}

// Check and patch MainActivity.kt for FLAG_SECURE screen protection and native AndroidBiometricsBridge
const mainActivityPaths = [
  path.resolve(__dirname, '../src-tauri/gen/android/app/src/main/java/com/royalrohan/veylock/MainActivity.kt'),
  path.resolve(__dirname, '../src-tauri/gen/android/app/src/main/kotlin/com/royalrohan/veylock/MainActivity.kt')
];

const kotlinImports = [
  'android.os.Bundle',
  'android.content.ClipData',
  'android.content.ClipDescription',
  'android.content.ClipboardManager',
  'android.content.Context',
  'android.content.Intent',
  'android.content.pm.PackageManager',
  'android.app.AlarmManager',
  'android.app.NotificationChannel',
  'android.app.NotificationManager',
  'android.app.PendingIntent',
  'android.net.Uri',
  'android.os.Build',
  'android.os.PersistableBundle',
  'android.provider.Settings',
  'android.util.Log',
  'android.webkit.JavascriptInterface',
  'android.webkit.WebView',
  'androidx.biometric.BiometricManager',
  'androidx.biometric.BiometricPrompt',
  'androidx.core.app.ActivityCompat',
  'androidx.core.app.NotificationCompat',
  'androidx.core.app.NotificationManagerCompat',
  'androidx.core.content.ContextCompat',
  'java.io.File',
  'java.io.FileInputStream',
  'java.io.FileOutputStream',
  'java.security.KeyStore',
  'javax.crypto.Cipher',
  'javax.crypto.KeyGenerator',
  'javax.crypto.spec.GCMParameterSpec',
  'android.security.keystore.KeyGenParameterSpec',
  'android.security.keystore.KeyProperties',
  'android.security.keystore.KeyPermanentlyInvalidatedException',
  'org.json.JSONObject'
];

const kotlinBridgeCode = `
class AndroidBiometricsBridge(private val activity: MainActivity, private val webView: WebView) {
    private val keyAlias = "TotumVault_Biometric_Key"
    private val keyStoreType = "AndroidKeyStore"
    private val bioFileName = "totumvault_bio.dat"

    private fun getKeyStore(): KeyStore {
        val ks = KeyStore.getInstance(keyStoreType)
        ks.load(null)
        return ks
    }

    private fun getBioFile(): File {
        return File(activity.filesDir, bioFileName)
    }

    private fun callbackSuccess(callbackId: String, data: String) {
        activity.runOnUiThread {
            webView.requestFocus()
            val quoted = JSONObject.quote(data)
            webView.evaluateJavascript("if (typeof window !== 'undefined') { window.__totumBioPromptActive = false; window.dispatchEvent(new CustomEvent('totum-bio-prompt-end')); window.dispatchEvent(new Event('focus')); if (typeof window.__totumOnWindowFocus === 'function') { window.__totumOnWindowFocus(true); } if (window.__bioCallbacks && window.__bioCallbacks['$callbackId']) { window.__bioCallbacks['$callbackId'].resolve($quoted); delete window.__bioCallbacks['$callbackId']; } }", null)
        }
    }

    private fun callbackError(callbackId: String, err: String) {
        activity.runOnUiThread {
            webView.requestFocus()
            val quoted = JSONObject.quote(err)
            webView.evaluateJavascript("if (typeof window !== 'undefined') { window.__totumBioPromptActive = false; window.dispatchEvent(new CustomEvent('totum-bio-prompt-end')); window.dispatchEvent(new Event('focus')); if (typeof window.__totumOnWindowFocus === 'function') { window.__totumOnWindowFocus(true); } if (window.__bioCallbacks && window.__bioCallbacks['$callbackId']) { window.__bioCallbacks['$callbackId'].reject($quoted); delete window.__bioCallbacks['$callbackId']; } }", null)
        }
    }

    @JavascriptInterface
    fun canAuthenticate(): String {
        val bm = BiometricManager.from(activity)
        return when (bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)) {
            BiometricManager.BIOMETRIC_SUCCESS -> "SUCCESS"
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> "NONE_ENROLLED"
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> "NO_HARDWARE"
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> "UNAVAILABLE"
            else -> "UNSUPPORTED"
        }
    }

    @JavascriptInterface
    fun isEnrolled(): Boolean {
        try {
            val ks = getKeyStore()
            val file = getBioFile()
            return file.exists() && ks.containsAlias(keyAlias)
        } catch (e: Exception) {
            return false
        }
    }

    @JavascriptInterface
    fun clearEnrolledKey() {
        try {
            val ks = getKeyStore()
            if (ks.containsAlias(keyAlias)) {
                ks.deleteEntry(keyAlias)
            }
            val file = getBioFile()
            if (file.exists()) {
                file.delete()
            }
        } catch (e: Exception) {}
    }

    @JavascriptInterface
    fun encryptSecret(secretB64: String, callbackId: String) {
        activity.runOnUiThread {
            webView.evaluateJavascript("if (typeof window !== 'undefined') { window.__totumBioPromptActive = true; window.dispatchEvent(new CustomEvent('totum-bio-prompt-start')); }", null)
            try {
                val ks = getKeyStore()
                if (ks.containsAlias(keyAlias)) {
                    ks.deleteEntry(keyAlias)
                }

                val keyGen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, keyStoreType)
                val builder = KeyGenParameterSpec.Builder(
                    keyAlias,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .setUserAuthenticationRequired(true)
                    .setInvalidatedByBiometricEnrollment(true)

                keyGen.init(builder.build())
                val secretKey = keyGen.generateKey()

                val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                cipher.init(Cipher.ENCRYPT_MODE, secretKey)

                val cryptoObject = BiometricPrompt.CryptoObject(cipher)
                val promptInfo = BiometricPrompt.PromptInfo.Builder()
                    .setTitle("Enroll Biometric Unlock")
                    .setSubtitle("Confirm your biometric to link this vault")
                    .setNegativeButtonText("Cancel")
                    .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                    .build()

                val prompt = BiometricPrompt(activity, ContextCompat.getMainExecutor(activity), object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        try {
                            val c = result.cryptoObject?.cipher ?: run {
                                callbackError(callbackId, "CIPHER_UNAVAILABLE")
                                return
                            }
                            val rawBytes = secretB64.toByteArray(Charsets.UTF_8)
                            val ciphertext = c.doFinal(rawBytes)
                            val iv = c.iv

                            val file = getBioFile()
                            FileOutputStream(file).use { fos ->
                                fos.write(iv.size)
                                fos.write(iv)
                                fos.write(ciphertext)
                            }
                            callbackSuccess(callbackId, "ENROLLED")
                        } catch (e: Exception) {
                            callbackError(callbackId, e.message ?: "ENCRYPT_FAILED")
                        }
                    }

                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                        if (errorCode == BiometricPrompt.ERROR_USER_CANCELED || errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON) {
                            callbackError(callbackId, "USER_CANCELED")
                        } else {
                            callbackError(callbackId, errString.toString())
                        }
                    }
                })

                prompt.authenticate(promptInfo, cryptoObject)
            } catch (e: Exception) {
                callbackError(callbackId, e.message ?: "ENROLL_FAILED")
            }
        }
    }

    @JavascriptInterface
    fun decryptSecret(callbackId: String) {
        activity.runOnUiThread {
            webView.evaluateJavascript("if (typeof window !== 'undefined') { window.__totumBioPromptActive = true; window.dispatchEvent(new CustomEvent('totum-bio-prompt-start')); }", null)
            try {
                val file = getBioFile()
                if (!file.exists()) {
                    callbackError(callbackId, "NOT_ENROLLED")
                    return@runOnUiThread
                }

                val bytes = FileInputStream(file).use { it.readBytes() }
                if (bytes.size < 13) {
                    callbackError(callbackId, "CORRUPT_BIO_DATA")
                    return@runOnUiThread
                }

                val ivLen = bytes[0].toInt() and 0xFF
                val iv = bytes.copyOfRange(1, 1 + ivLen)
                val ciphertext = bytes.copyOfRange(1 + ivLen, bytes.size)

                val ks = getKeyStore()
                if (!ks.containsAlias(keyAlias)) {
                    callbackError(callbackId, "KEY_NOT_FOUND")
                    return@runOnUiThread
                }

                val secretKey = ks.getKey(keyAlias, null)
                val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                cipher.init(Cipher.DECRYPT_MODE, secretKey, GCMParameterSpec(128, iv))

                val cryptoObject = BiometricPrompt.CryptoObject(cipher)
                val promptInfo = BiometricPrompt.PromptInfo.Builder()
                    .setTitle("Biometric Unlock")
                    .setSubtitle("Confirm your biometric to access your vault")
                    .setNegativeButtonText("Use Master Password")
                    .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                    .build()

                val prompt = BiometricPrompt(activity, ContextCompat.getMainExecutor(activity), object : BiometricPrompt.AuthenticationCallback() {
                    var failures = 0

                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        try {
                            val c = result.cryptoObject?.cipher ?: run {
                                callbackError(callbackId, "CIPHER_UNAVAILABLE")
                                return
                            }
                            val decrypted = c.doFinal(ciphertext)
                            callbackSuccess(callbackId, String(decrypted, Charsets.UTF_8))
                        } catch (e: Exception) {
                            callbackError(callbackId, e.message ?: "DECRYPT_FAILED")
                        }
                    }

                    override fun onAuthenticationFailed() {
                        failures++
                        if (failures >= 3) {
                            callbackError(callbackId, "LOCKOUT")
                        }
                    }

                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                        if (errorCode == BiometricPrompt.ERROR_USER_CANCELED || errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON) {
                            callbackError(callbackId, "USER_CANCELED")
                        } else if (errorCode == BiometricPrompt.ERROR_LOCKOUT || errorCode == BiometricPrompt.ERROR_LOCKOUT_PERMANENT) {
                            callbackError(callbackId, "LOCKOUT")
                        } else {
                            callbackError(callbackId, errString.toString())
                        }
                    }
                })

                prompt.authenticate(promptInfo, cryptoObject)
            } catch (e: KeyPermanentlyInvalidatedException) {
                clearEnrolledKey()
                callbackError(callbackId, "INVALIDATED")
            } catch (e: Exception) {
                callbackError(callbackId, e.message ?: "AUTH_ERROR")
            }
        }
    }
}

class AndroidClipboardBridge(private val activity: MainActivity) {
    @JavascriptInterface
    fun copySecure(text: String, label: String): Boolean {
        activity.runOnUiThread {
            try {
                val cm = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                val clip = ClipData.newPlainText(label, text)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    val bundle = PersistableBundle()
                    bundle.putBoolean(ClipDescription.EXTRA_IS_SENSITIVE, true)
                    clip.description.extras = bundle
                }
                cm.setPrimaryClip(clip)
            } catch (e: Exception) {}
        }
        return true
    }

    @JavascriptInterface
    fun clearPrimaryClip(): Boolean {
        activity.runOnUiThread {
            try {
                val cm = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    cm.clearPrimaryClip()
                } else {
                    cm.setPrimaryClip(ClipData.newPlainText("", ""))
                }
            } catch (e: Exception) {}
        }
        return true
    }
}

class AndroidNotificationBridge(private val activity: MainActivity, private val webView: WebView) {
    companion object {
        const val NOTIFICATION_PERMISSION_REQUEST_CODE = 2001
        var pendingNotificationCallbackId: String? = null
        private const val PREFS_NAME = "totumvault_notif_prefs"
        private const val KEY_REQUESTED = "post_notifications_requested"
    }

    private fun callbackSuccess(callbackId: String, data: Any) {
        activity.runOnUiThread {
            webView.requestFocus()
            val jsArg = if (data is String) JSONObject.quote(data) else data.toString()
            webView.evaluateJavascript(
                "if (typeof window !== 'undefined' && window.__notificationCallbacks && window.__notificationCallbacks['$callbackId']) { window.__notificationCallbacks['$callbackId'].resolve($jsArg); delete window.__notificationCallbacks['$callbackId']; }",
                null
            )
        }
    }

    private fun callbackError(callbackId: String, err: String) {
        activity.runOnUiThread {
            webView.requestFocus()
            val quoted = JSONObject.quote(err)
            webView.evaluateJavascript(
                "if (typeof window !== 'undefined' && window.__notificationCallbacks && window.__notificationCallbacks['$callbackId']) { window.__notificationCallbacks['$callbackId'].reject($quoted); delete window.__notificationCallbacks['$callbackId']; }",
                null
            )
        }
    }

    @JavascriptInterface
    fun getAndroidSdkVersion(): Int {
        return Build.VERSION.SDK_INT
    }

    @JavascriptInterface
    fun isNotificationPermissionGranted(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                activity,
                android.Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            NotificationManagerCompat.from(activity).areNotificationsEnabled()
        }
    }

    @JavascriptInterface
    fun canRequestRuntimePermission(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return false
        }
        val granted = ContextCompat.checkSelfPermission(
            activity,
            android.Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
        if (granted) return false

        val prefs = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val alreadyRequested = prefs.getBoolean(KEY_REQUESTED, false)
        val showRationale = ActivityCompat.shouldShowRequestPermissionRationale(
            activity,
            android.Manifest.permission.POST_NOTIFICATIONS
        )

        return !(alreadyRequested && !showRationale)
    }

    @JavascriptInterface
    fun requestNotificationPermission(callbackId: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                activity,
                android.Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (granted) {
                callbackSuccess(callbackId, "GRANTED")
                return
            }

            val prefs = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val alreadyRequested = prefs.getBoolean(KEY_REQUESTED, false)
            val showRationale = ActivityCompat.shouldShowRequestPermissionRationale(
                activity,
                android.Manifest.permission.POST_NOTIFICATIONS
            )

            if (alreadyRequested && !showRationale) {
                callbackSuccess(callbackId, "PERMANENTLY_DENIED")
                return
            }

            prefs.edit().putBoolean(KEY_REQUESTED, true).apply()
            pendingNotificationCallbackId = callbackId
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(android.Manifest.permission.POST_NOTIFICATIONS),
                NOTIFICATION_PERMISSION_REQUEST_CODE
            )
        } else {
            val enabled = NotificationManagerCompat.from(activity).areNotificationsEnabled()
            callbackSuccess(callbackId, if (enabled) "GRANTED" else "DENIED")
        }
    }

    @JavascriptInterface
    fun openNotificationSettings() {
        try {
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                    putExtra(Settings.EXTRA_APP_PACKAGE, activity.packageName)
                }
            } else {
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:\${activity.packageName}")
                }
            }
            activity.startActivity(intent)
        } catch (e: Exception) {
            Log.w("DocumentReminder", "Failed to open notification settings: \${e.message}")
        }
    }

    @JavascriptInterface
    fun isExactAlarmPermissionGranted(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val am = activity.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            am?.canScheduleExactAlarms() ?: true
        } else {
            true
        }
    }

    @JavascriptInterface
    fun openExactAlarmSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                    data = Uri.parse("package:\${activity.packageName}")
                }
                activity.startActivity(intent)
            } catch (e: Exception) {
                Log.w("DocumentReminder", "Failed to open exact alarm settings: \${e.message}")
            }
        }
    }

    @JavascriptInterface
    fun reconcileReminders(callbackId: String) {
        Thread {
            try {
                Log.d("DocumentReminder", "REMINDER: Bridge reconcileReminders called")
                DocumentReminderReceiver.createNotificationChannel(activity)
                val count = DocumentReminderReceiver.checkAndDeliver(activity)
                DocumentReminderReceiver.scheduleDailyAlarm(activity)
                callbackSuccess(callbackId, count)
            } catch (e: Exception) {
                Log.w("DocumentReminder", "REMINDER: Bridge reconcileReminders error: \${e.message}")
                callbackSuccess(callbackId, 0)
            }
        }.start()
    }

    @JavascriptInterface
    fun cancelReminders() {
        try {
            Log.d("DocumentReminder", "REMINDER: Bridge cancelReminders called")
            DocumentReminderReceiver.cancelDailyAlarm(activity)
        } catch (e: Exception) {
            Log.w("DocumentReminder", "REMINDER: Failed to cancel reminders: \${e.message}")
        }
    }

    @JavascriptInterface
    fun scheduleTestAlarm(delaySeconds: Int, callbackId: String) {
        try {
            Log.d("DocumentReminder", "REMINDER: Bridge scheduleTestAlarm called for \${delaySeconds}s")
            DocumentReminderReceiver.createNotificationChannel(activity)
            DocumentReminderReceiver.scheduleTestAlarm(activity, delaySeconds)
            callbackSuccess(callbackId, "SCHEDULED")
        } catch (e: Exception) {
            Log.w("DocumentReminder", "REMINDER: Bridge scheduleTestAlarm failed: \${e.message}")
            callbackError(callbackId, e.message ?: "FAILED_TO_SCHEDULE")
        }
    }

    @JavascriptInterface
    fun sendTestNotification(callbackId: String) {
        try {
            Log.d("DocumentReminder", "REMINDER: Bridge sendTestNotification called (foreground immediate test)")
            DocumentReminderReceiver.createNotificationChannel(activity)
            val nm = activity.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            val launchIntent = activity.packageManager.getLaunchIntentForPackage(activity.packageName)?.apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val contentPendingIntent = if (launchIntent != null) {
                PendingIntent.getActivity(activity, 9999, launchIntent, flags)
            } else null

            val notif = NotificationCompat.Builder(activity, DocumentReminderReceiver.CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("TotumVault")
                .setContentText("Document renewal reminders are active and functioning.")
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true)
                .apply {
                    if (contentPendingIntent != null) {
                        setContentIntent(contentPendingIntent)
                    }
                }
                .build()

            nm?.notify(9999, notif)
            callbackSuccess(callbackId, "SENT")
        } catch (e: Exception) {
            Log.w("DocumentReminder", "REMINDER: Bridge sendTestNotification failed: \${e.message}")
            callbackError(callbackId, e.message ?: "FAILED_TO_SEND")
        }
    }

    fun handlePermissionResult(requestCode: Int, grantResults: IntArray) {
        if (requestCode == NOTIFICATION_PERMISSION_REQUEST_CODE) {
            val callbackId = pendingNotificationCallbackId ?: return
            pendingNotificationCallbackId = null
            val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
            if (granted) {
                try {
                    DocumentReminderReceiver.createNotificationChannel(activity)
                    DocumentReminderReceiver.scheduleDailyAlarm(activity)
                } catch (e: Exception) {}
                callbackSuccess(callbackId, "GRANTED")
            } else {
                val showRationale = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    ActivityCompat.shouldShowRequestPermissionRationale(
                        activity,
                        android.Manifest.permission.POST_NOTIFICATIONS
                    )
                } else false
                callbackSuccess(callbackId, if (!showRationale) "PERMANENTLY_DENIED" else "DENIED")
            }
        }
    }
}
`;

for (const actPath of mainActivityPaths) {
  if (fs.existsSync(actPath)) {
    let actContent = fs.readFileSync(actPath, 'utf8');
    if (!actContent.includes('AndroidBiometricsBridge')) {
      const securityCode = [
        '    // Hardened screen protection: prevent screenshots, screen recordings, and switcher previews',
        '    window.setFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE, android.view.WindowManager.LayoutParams.FLAG_SECURE)',
        '    // Initialize document reminder notification channel and scheduled daily alarm',
        '    DocumentReminderReceiver.createNotificationChannel(this)',
        '    DocumentReminderReceiver.scheduleDailyAlarm(this)\n'
      ].join('\n');

      if (actContent.includes('super.onCreate(savedInstanceState)')) {
        actContent = actContent.replace(
          'super.onCreate(savedInstanceState)',
          `super.onCreate(savedInstanceState)\n${securityCode}`
        );
      }

      // Add onWebViewCreate override to attach JavaScriptInterface
      const webViewHook = `
  private var webViewRef: android.webkit.WebView? = null
  private var notificationBridgeRef: AndroidNotificationBridge? = null

  override fun onWebViewCreate(webView: android.webkit.WebView) {
    super.onWebViewCreate(webView)
    this.webViewRef = webView
    webView.addJavascriptInterface(AndroidBiometricsBridge(this, webView), "AndroidBiometrics")
    webView.addJavascriptInterface(AndroidClipboardBridge(this), "AndroidClipboard")
    val notifBridge = AndroidNotificationBridge(this, webView)
    this.notificationBridgeRef = notifBridge
    webView.addJavascriptInterface(notifBridge, "AndroidNotification")
  }

  override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    notificationBridgeRef?.handlePermissionResult(requestCode, grantResults)
  }


  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      webViewRef?.let { wv ->
        wv.post {
          wv.requestFocus()
          wv.evaluateJavascript("if (typeof window !== 'undefined') { window.__totumBioPromptActive = false; window.dispatchEvent(new Event('focus')); if (typeof window.__totumOnWindowFocus === 'function') { window.__totumOnWindowFocus(true); } }", null)
        }
      }
    }
  }

  override fun onResume() {
    super.onResume()
    webViewRef?.let { wv ->
      wv.post {
        wv.requestFocus()
        wv.evaluateJavascript("if (typeof window !== 'undefined') { window.dispatchEvent(new Event('focus')); if (typeof window.__totumOnWindowFocus === 'function') { window.__totumOnWindowFocus(true); } }", null)
      }
    }
  }
`;

      if (!actContent.includes('onWebViewCreate')) {
        actContent = actContent.replace(
          /class MainActivity\s*:\s*[^{]+{/,
          `$&\n${webViewHook}`
        );
      }

      // Insert Kotlin imports without duplicate or ambiguous conflicts
      const existingImportLines = actContent.match(/^\s*import\s+[^\r\n]+/gm) || [];
      const existingImportedNames = new Set();
      for (const line of existingImportLines) {
        const match = line.match(/^\s*import\s+(?:static\s+)?([^\s;]+)/);
        if (match) {
          const fullName = match[1];
          existingImportedNames.add(fullName);
          const simpleName = fullName.split('.').pop();
          if (simpleName && simpleName !== '*') {
            existingImportedNames.add(simpleName);
          }
        }
      }

      const importsToAdd = kotlinImports.filter(imp => {
        const simpleName = imp.split('.').pop();
        return !existingImportedNames.has(imp) && !existingImportedNames.has(simpleName);
      });

      if (importsToAdd.length > 0) {
        const importBlock = importsToAdd.map(imp => `import ${imp}`).join('\n');
        if (existingImportLines.length > 0) {
          const lastImport = existingImportLines[existingImportLines.length - 1];
          const lastIndex = actContent.lastIndexOf(lastImport);
          if (lastIndex !== -1) {
            actContent =
              actContent.slice(0, lastIndex + lastImport.length) +
              '\n' + importBlock +
              actContent.slice(lastIndex + lastImport.length);
          }
        } else if (/package\s+[^\n]*\r?\n/.test(actContent)) {
          actContent = actContent.replace(
            /package\s+[^\n]*\r?\n/,
            `$&\n${importBlock}\n`
          );
        }
      }

      // Append bridge class definition
      actContent += '\n' + kotlinBridgeCode;

      fs.writeFileSync(actPath, actContent, 'utf8');
      console.log(`[patch-android-manifest] Successfully injected AndroidBiometricsBridge into ${actPath}`);
    }
  }
}
