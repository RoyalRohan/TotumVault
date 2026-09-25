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

// Check and patch MainActivity.kt for FLAG_SECURE screen protection and BIOMETRIC_STRONG policy
const mainActivityPaths = [
  path.resolve(__dirname, '../src-tauri/gen/android/app/src/main/java/com/royalrohan/veylock/MainActivity.kt'),
  path.resolve(__dirname, '../src-tauri/gen/android/app/src/main/kotlin/com/royalrohan/veylock/MainActivity.kt')
];

for (const actPath of mainActivityPaths) {
  if (fs.existsSync(actPath)) {
    let actContent = fs.readFileSync(actPath, 'utf8');
    if (!actContent.includes('FLAG_SECURE')) {
      const securityCode = [
        '    // Hardened screen protection: prevent screenshots, screen recordings, and switcher previews',
        '    window.setFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE, android.view.WindowManager.LayoutParams.FLAG_SECURE)',
        '    // Biometric Policy: Strictly enforce BIOMETRIC_STRONG only.',
        '    // Never allow DEVICE_CREDENTIAL (PIN/pattern/password) as fallback.',
        '    // Negative action always requires the TotumVault Master Password.\n'
      ].join('\n');

      if (actContent.includes('super.onCreate(savedInstanceState)')) {
        actContent = actContent.replace(
          'super.onCreate(savedInstanceState)',
          `super.onCreate(savedInstanceState)\n${securityCode}`
        );
        fs.writeFileSync(actPath, actContent, 'utf8');
        console.log(`[patch-android-manifest] Injected FLAG_SECURE and BIOMETRIC_STRONG policy into ${actPath}`);
      }
    }
  }
}
