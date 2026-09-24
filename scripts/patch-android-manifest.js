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
  '    <uses-feature android:name="android.hardware.camera" android:required="false" />',
  '    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />',
];

if (content.includes('android.permission.CAMERA')) {
  console.log('[patch-android-manifest] CAMERA permission already declared in AndroidManifest.xml.');
  process.exit(0);
}

// Inject after INTERNET permission or before <application
if (content.includes('android.permission.INTERNET')) {
  content = content.replace(
    /(<uses-permission\s+android:name="android\.permission\.INTERNET"\s*\/>)/,
    `$1\n${permissionsToInject.join('\n')}`
  );
} else if (content.includes('<application')) {
  content = content.replace(
    /<application/,
    `${permissionsToInject.join('\n')}\n    <application`
  );
} else {
  content = content.replace(
    /<\/manifest>/,
    `${permissionsToInject.join('\n')}\n</manifest>`
  );
}

fs.writeFileSync(manifestPath, content, 'utf8');
console.log('[patch-android-manifest] Successfully injected CAMERA permissions and features into AndroidManifest.xml');
