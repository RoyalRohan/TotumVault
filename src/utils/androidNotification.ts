// Android Notification Native Bridge Helper
// Connects frontend to MainActivity.kt AndroidNotificationBridge via @JavascriptInterface

declare global {
  interface Window {
    AndroidNotification?: {
      isNotificationPermissionGranted: () => boolean;
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
 * Requests notification permission from Android (API 33+ runtime dialog).
 * Returns true if granted, false if denied.
 */
export function requestAndroidNotificationPermission(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (!isAndroidNotificationAvailable()) {
      resolve(true);
      return;
    }

    const callbackId = 'notif_perm_' + Math.random().toString(36).substring(2, 11);
    if (!window.__notificationCallbacks) {
      window.__notificationCallbacks = {};
    }

    const timeout = setTimeout(() => {
      if (window.__notificationCallbacks && window.__notificationCallbacks[callbackId]) {
        delete window.__notificationCallbacks[callbackId];
        resolve(isAndroidNotificationGranted());
      }
    }, 60000);

    window.__notificationCallbacks[callbackId] = {
      resolve: (status: string) => {
        clearTimeout(timeout);
        resolve(status === 'GRANTED');
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
