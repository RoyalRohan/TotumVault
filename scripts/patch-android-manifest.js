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

// Patch build.gradle.kts / build.gradle to ensure androidx.biometric dependency is added
const gradlePaths = [
  path.resolve(__dirname, '../src-tauri/gen/android/app/build.gradle.kts'),
  path.resolve(__dirname, '../src-tauri/gen/android/app/build.gradle'),
];

for (const gPath of gradlePaths) {
  if (fs.existsSync(gPath)) {
    let gContent = fs.readFileSync(gPath, 'utf8');
    if (!gContent.includes('androidx.biometric:biometric')) {
      if (gContent.includes('dependencies {')) {
        const depLine = gPath.endsWith('.kts')
          ? '    implementation("androidx.biometric:biometric:1.2.0-alpha05")'
          : "    implementation 'androidx.biometric:biometric:1.2.0-alpha05'";
        gContent = gContent.replace('dependencies {', `dependencies {\n${depLine}`);
        fs.writeFileSync(gPath, gContent, 'utf8');
        console.log(`[patch-android-manifest] Added androidx.biometric dependency to ${gPath}`);
      }
    }
  }
}

// Check and patch MainActivity.kt for FLAG_SECURE screen protection and native AndroidBiometricsBridge
const mainActivityPaths = [
  path.resolve(__dirname, '../src-tauri/gen/android/app/src/main/java/com/royalrohan/veylock/MainActivity.kt'),
  path.resolve(__dirname, '../src-tauri/gen/android/app/src/main/kotlin/com/royalrohan/veylock/MainActivity.kt')
];

const kotlinBridgeCode = `
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.spec.GCMParameterSpec
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.security.keystore.KeyPermanentlyInvalidatedException
import org.json.JSONObject

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
            val quoted = JSONObject.quote(data)
            webView.evaluateJavascript("if (window.__bioCallbacks && window.__bioCallbacks['$callbackId']) { window.__bioCallbacks['$callbackId'].resolve($quoted); delete window.__bioCallbacks['$callbackId']; }", null)
        }
    }

    private fun callbackError(callbackId: String, err: String) {
        activity.runOnUiThread {
            val quoted = JSONObject.quote(err)
            webView.evaluateJavascript("if (window.__bioCallbacks && window.__bioCallbacks['$callbackId']) { window.__bioCallbacks['$callbackId'].reject($quoted); delete window.__bioCallbacks['$callbackId']; }", null)
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
        } catch (_: Exception) {
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
        } catch (_: Exception) {}
    }

    @JavascriptInterface
    fun encryptSecret(secretB64: String, callbackId: String) {
        activity.runOnUiThread {
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
`;

for (const actPath of mainActivityPaths) {
  if (fs.existsSync(actPath)) {
    let actContent = fs.readFileSync(actPath, 'utf8');
    if (!actContent.includes('AndroidBiometricsBridge')) {
      const securityCode = [
        '    // Hardened screen protection: prevent screenshots, screen recordings, and switcher previews',
        '    window.setFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE, android.view.WindowManager.LayoutParams.FLAG_SECURE)\n'
      ].join('\n');

      if (actContent.includes('super.onCreate(savedInstanceState)')) {
        actContent = actContent.replace(
          'super.onCreate(savedInstanceState)',
          `super.onCreate(savedInstanceState)\n${securityCode}`
        );
      }

      // Add onWebViewCreate override to attach JavaScriptInterface
      const webViewHook = `
  override fun onWebViewCreate(webView: android.webkit.WebView) {
    super.onWebViewCreate(webView)
    webView.addJavascriptInterface(AndroidBiometricsBridge(this, webView), "AndroidBiometrics")
  }
`;

      if (!actContent.includes('onWebViewCreate')) {
        actContent = actContent.replace(
          /class MainActivity\s*:\s*[^{]+{/,
          `$&\n${webViewHook}`
        );
      }

      // Append bridge class definition
      actContent += '\n' + kotlinBridgeCode;

      fs.writeFileSync(actPath, actContent, 'utf8');
      console.log(`[patch-android-manifest] Successfully injected AndroidBiometricsBridge into ${actPath}`);
    }
  }
}
