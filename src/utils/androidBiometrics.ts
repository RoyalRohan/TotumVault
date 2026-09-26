// Android Biometrics Native Bridge Helper
// Connects frontend to MainActivity.kt AndroidBiometricsBridge via @JavascriptInterface

declare global {
  interface Window {
    AndroidBiometrics?: {
      canAuthenticate: () => string;
      isEnrolled: () => boolean;
      clearEnrolledKey: () => void;
      encryptSecret: (secretB64: string, callbackId: string) => void;
      decryptSecret: (callbackId: string) => void;
    };
    __bioCallbacks?: Record<
      string,
      {
        resolve: (val: string) => void;
        reject: (err: any) => void;
      }
    >;
  }
}

export type AndroidBiometricStatus =
  | 'SUCCESS'
  | 'NONE_ENROLLED'
  | 'NO_HARDWARE'
  | 'UNAVAILABLE'
  | 'UNSUPPORTED';

/**
 * Returns true if the native AndroidBiometrics bridge is injected into the WebView.
 */
export function isAndroidBiometricsAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.AndroidBiometrics !== 'undefined' &&
    typeof window.AndroidBiometrics.canAuthenticate === 'function'
  );
}

/**
 * Queries Android Keystore / BiometricManager hardware and enrollment status.
 */
export function checkAndroidBiometricHardware(): AndroidBiometricStatus {
  if (!isAndroidBiometricsAvailable()) {
    return 'UNSUPPORTED';
  }
  try {
    const res = window.AndroidBiometrics!.canAuthenticate();
    switch (res) {
      case 'SUCCESS':
        return 'SUCCESS';
      case 'NONE_ENROLLED':
        return 'NONE_ENROLLED';
      case 'NO_HARDWARE':
        return 'NO_HARDWARE';
      case 'UNAVAILABLE':
        return 'UNAVAILABLE';
      default:
        return 'UNSUPPORTED';
    }
  } catch {
    return 'UNSUPPORTED';
  }
}

/**
 * Checks if a biometric unlock key is already enrolled in the Keystore and private app storage.
 */
export function isAndroidBiometricEnrolled(): boolean {
  if (!isAndroidBiometricsAvailable()) {
    return false;
  }
  try {
    return window.AndroidBiometrics!.isEnrolled();
  } catch {
    return false;
  }
}

/**
 * Wipes the biometric key from Android Keystore and deletes the encrypted key file.
 */
export function androidClearEnrolledKey(): void {
  if (isAndroidBiometricsAvailable()) {
    try {
      window.AndroidBiometrics!.clearEnrolledKey();
    } catch {
      // ignore
    }
  }
}

/**
 * Encrypts a sensitive secret (such as the 32-byte biometric unlock token) using a hardware-backed
 * Android Keystore key with BIOMETRIC_STRONG policy.
 */
export function androidEncryptSecret(secretB64: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isAndroidBiometricsAvailable()) {
      return reject(new Error('Android Biometrics bridge not available'));
    }

    if (typeof window.__bioCallbacks === 'undefined') {
      window.__bioCallbacks = {};
    }

    const callbackId = 'bio_enc_' + Math.random().toString(36).substring(2) + Date.now().toString(36);

    window.__bioCallbacks[callbackId] = {
      resolve: (val: string) => resolve(val),
      reject: (err: any) => reject(new Error(typeof err === 'string' ? err : 'Biometric enrollment failed')),
    };

    try {
      window.AndroidBiometrics!.encryptSecret(secretB64, callbackId);
    } catch (err: any) {
      delete window.__bioCallbacks[callbackId];
      reject(err);
    }
  });
}

/**
 * Prompts native Android BiometricPrompt with BIOMETRIC_STRONG authentication.
 * Upon successful authentication, decrypts and returns the biometric unlock token.
 * Throws on 3 failed attempts (lockout), user cancellation, or invalidation.
 */
export function androidDecryptSecret(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isAndroidBiometricsAvailable()) {
      return reject(new Error('Android Biometrics bridge not available'));
    }

    if (typeof window.__bioCallbacks === 'undefined') {
      window.__bioCallbacks = {};
    }

    const callbackId = 'bio_dec_' + Math.random().toString(36).substring(2) + Date.now().toString(36);

    window.__bioCallbacks[callbackId] = {
      resolve: (decryptedSecret: string) => resolve(decryptedSecret),
      reject: (err: any) => {
        const errMsg = typeof err === 'string' ? err : 'Biometric authentication failed';
        reject(new Error(errMsg));
      },
    };

    try {
      window.AndroidBiometrics!.decryptSecret(callbackId);
    } catch (err: any) {
      delete window.__bioCallbacks[callbackId];
      reject(err);
    }
  });
}
