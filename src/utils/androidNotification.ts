// Android Notification Native Bridge Helper
// Connects frontend to MainActivity.kt AndroidNotificationBridge via @JavascriptInterface

declare global {
  interface Window {
    AndroidNotification?: {
      getAndroidSdkVersion?: () => number;
      isNotificationPermissionGranted: () => boolean;
      canRequestRuntimePermission?: () => boolean;
      requestNotificationPermission: (callbackId: string) => void;
      openNotificationSettings: () => void;
      isExactAlarmPermissionGranted: () => boolean;
      openExactAlarmSettings: () => void;
      reconcileReminders: (callbackId: string) => void;
      cancelReminders: () => void;
      sendTestNotification: (callbackId: string) => void;
    };
    __notificationCallbacks?: Record<
      string,
      {
        resolve: (val: any) => void;
        reject: (err: any) => void;
      }
    >;
  }
}

/**
 * Returns true if the native AndroidNotification bridge is injected into the WebView.
 */
export function isAndroidNotificationAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.AndroidNotification !== 'undefined' &&
    typeof window.AndroidNotification.isNotificationPermissionGranted === 'function'
  );
}

/**
 * Returns Android SDK version (e.g. 33 for Android 13), or 0 if not on Android.
 */
export function getAndroidSdkVersion(): number {
  if (!isAndroidNotificationAvailable()) {
    return 0;
  }
  try {
    if (typeof window.AndroidNotification?.getAndroidSdkVersion === 'function') {
      return window.AndroidNotification.getAndroidSdkVersion();
    }
    const match = navigator.userAgent.match(/Android\s+([0-9]+)/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    return 33;
  } catch {
    return 0;
  }
}

/**
 * Returns true if running on Android 13 (API 33) or higher where POST_NOTIFICATIONS is a runtime permission.
 */
export function isAndroid13OrHigher(): boolean {
  return getAndroidSdkVersion() >= 33;
}

/**
 * Checks whether system notification permission is granted on Android.
 * For non-Android platforms, returns true.
 */
export function isAndroidNotificationGranted(): boolean {
  if (!isAndroidNotificationAvailable()) {
    return true;
  }
  try {
    return Boolean(window.AndroidNotification!.isNotificationPermissionGranted());
  } catch {
    return false;
  }
}

/**
 * Checks whether Android can show the system runtime permission dialog
 * (i.e. Android 13+ and not permanently denied with "Don't ask again").
 */
export function canRequestAndroidNotificationPermission(): boolean {
  if (!isAndroidNotificationAvailable()) {
    return false;
  }
  if (!isAndroid13OrHigher()) {
    return false;
  }
  try {
    if (typeof window.AndroidNotification?.canRequestRuntimePermission === 'function') {
      return Boolean(window.AndroidNotification.canRequestRuntimePermission());
    }
    return !isAndroidNotificationGranted();
  } catch {
    return false;
  }
}

export type NotificationPermissionResult = 'GRANTED' | 'DENIED' | 'PERMANENTLY_DENIED';

/**
 * Requests notification permission from Android (API 33+ runtime dialog).
 * Returns 'GRANTED', 'DENIED', or 'PERMANENTLY_DENIED'.
 */
export function requestAndroidNotificationPermission(): Promise<NotificationPermissionResult> {
  return new Promise((resolve, reject) => {
    if (!isAndroidNotificationAvailable()) {
      resolve('GRANTED');
      return;
    }

    // On Android below 13, do not request POST_NOTIFICATIONS runtime permission
    if (!isAndroid13OrHigher()) {
      const granted = isAndroidNotificationGranted();
      resolve(granted ? 'GRANTED' : 'PERMANENTLY_DENIED');
      return;
    }

    const callbackId = 'notif_perm_' + Math.random().toString(36).substring(2, 11);
    if (!window.__notificationCallbacks) {
      window.__notificationCallbacks = {};
    }

    const timeout = setTimeout(() => {
      if (window.__notificationCallbacks && window.__notificationCallbacks[callbackId]) {
        delete window.__notificationCallbacks[callbackId];
        resolve(isAndroidNotificationGranted() ? 'GRANTED' : 'DENIED');
      }
    }, 60000);

    window.__notificationCallbacks[callbackId] = {
      resolve: (status: string) => {
        clearTimeout(timeout);
        if (status === 'GRANTED') {
          resolve('GRANTED');
        } else if (status === 'PERMANENTLY_DENIED') {
          resolve('PERMANENTLY_DENIED');
        } else {
          resolve('DENIED');
        }
      },
      reject: (err: any) => {
        clearTimeout(timeout);
        reject(err);
      },
    };

    try {
      window.AndroidNotification!.requestNotificationPermission(callbackId);
    } catch (e) {
      clearTimeout(timeout);
      if (window.__notificationCallbacks) {
        delete window.__notificationCallbacks[callbackId];
      }
      reject(e);
    }
  });
}

/**
 * Opens system notification settings for TotumVault on Android.
 */
export function openAndroidNotificationSettings(): void {
  if (isAndroidNotificationAvailable()) {
    try {
      window.AndroidNotification!.openNotificationSettings();
    } catch {}
  }
}

/**
 * Tells the native Android scheduler to immediately evaluate due reminders and reset the daily alarm.
 */
export function reconcileAndroidReminders(): Promise<number> {
  return new Promise((resolve) => {
    if (!isAndroidNotificationAvailable()) {
      resolve(0);
      return;
    }

    const callbackId = 'notif_reconcile_' + Math.random().toString(36).substring(2, 11);
    if (!window.__notificationCallbacks) {
      window.__notificationCallbacks = {};
    }

    const timeout = setTimeout(() => {
      if (window.__notificationCallbacks && window.__notificationCallbacks[callbackId]) {
        delete window.__notificationCallbacks[callbackId];
        resolve(0);
      }
    }, 10000);

    window.__notificationCallbacks[callbackId] = {
      resolve: (count: number) => {
        clearTimeout(timeout);
        resolve(typeof count === 'number' ? count : 0);
      },
      reject: () => {
        clearTimeout(timeout);
        resolve(0);
      },
    };

    try {
      window.AndroidNotification!.reconcileReminders(callbackId);
    } catch {
      clearTimeout(timeout);
      if (window.__notificationCallbacks) {
        delete window.__notificationCallbacks[callbackId];
      }
      resolve(0);
    }
  });
}

/**
 * Tells native Android scheduler to cancel scheduled daily alarms (when reminders are disabled).
 */
export function cancelAndroidReminders(): void {
  if (isAndroidNotificationAvailable()) {
    try {
      window.AndroidNotification!.cancelReminders();
    } catch {}
  }
}

/**
 * Sends a safe, developer-friendly sample notification on Android to verify notification delivery.
 */
export function sendAndroidTestNotification(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!isAndroidNotificationAvailable()) {
      resolve(false);
      return;
    }

    const callbackId = 'notif_test_' + Math.random().toString(36).substring(2, 11);
    if (!window.__notificationCallbacks) {
      window.__notificationCallbacks = {};
    }

    const timeout = setTimeout(() => {
      if (window.__notificationCallbacks && window.__notificationCallbacks[callbackId]) {
        delete window.__notificationCallbacks[callbackId];
        resolve(false);
      }
    }, 10000);

    window.__notificationCallbacks[callbackId] = {
      resolve: () => {
        clearTimeout(timeout);
        resolve(true);
      },
      reject: () => {
        clearTimeout(timeout);
        resolve(false);
      },
    };

    try {
      window.AndroidNotification!.sendTestNotification(callbackId);
    } catch {
      clearTimeout(timeout);
      if (window.__notificationCallbacks) {
        delete window.__notificationCallbacks[callbackId];
      }
      resolve(false);
    }
  });
}

/**
 * Checks whether SCHEDULE_EXACT_ALARM permission is granted on Android 12+ (API 31+).
 */
export function isExactAlarmPermissionGranted(): boolean {
  if (!isAndroidNotificationAvailable()) {
    return true;
  }
  try {
    if (typeof window.AndroidNotification?.isExactAlarmPermissionGranted === 'function') {
      return Boolean(window.AndroidNotification.isExactAlarmPermissionGranted());
    }
    return true;
  } catch {
    return true;
  }
}

/**
 * Opens Android Special App Access settings for Alarms & Reminders (API 31+).
 */
export function openAndroidExactAlarmSettings(): void {
  if (isAndroidNotificationAvailable()) {
    try {
      window.AndroidNotification?.openExactAlarmSettings();
    } catch {}
  }
}
