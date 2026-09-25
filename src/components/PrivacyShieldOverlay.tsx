import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, EyeOff } from 'lucide-react';
import { useVault } from '../context/VaultContext';

export const PrivacyShieldOverlay: React.FC = () => {
  const { screenProtection, isPrivacyShieldTest, dismissPrivacyShieldTest, clearClipboard } = useVault();
  const [isWindowFocused, setIsWindowFocused] = useState<boolean>(true);
  const [isTabHidden, setIsTabHidden] = useState<boolean>(false);
  const [screenshotDetected, setScreenshotDetected] = useState<boolean>(false);
  const screenshotTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onFocus = () => {
      setIsWindowFocused(true);
    };

    const onBlur = () => {
      setIsWindowFocused(false);
    };

    const onVisibilityChange = () => {
      setIsTabHidden(document.visibilityState === 'hidden');
    };

    const triggerScreenshotShield = () => {
      setScreenshotDetected(true);
      // Immediately wipe clipboard on screenshot attempt so credentials cannot be captured or leaked
      clearClipboard(false);

      if (screenshotTimeoutRef.current) {
        clearTimeout(screenshotTimeoutRef.current);
      }
      // Hold screen shield active for at least 8 seconds to prevent capture utilities from grabbing clear view
      screenshotTimeoutRef.current = setTimeout(() => {
        setScreenshotDetected(false);
        screenshotTimeoutRef.current = null;
      }, 8000);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const code = e.code;
      const keyCode = e.keyCode;

      // 1. Dedicated PrintScreen / Print keys (Linux GNOME, X11, Wayland, Windows)
      if (key === 'PrintScreen' || code === 'PrintScreen' || key === 'Print' || keyCode === 44) {
        e.preventDefault?.();
        triggerScreenshotShield();
        return;
      }

      // 2. Windows Snipping Tool (Win + Shift + S) or Linux / Browser shortcuts (Ctrl + Shift + S)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === 'S' || key === 's' || code === 'KeyS')) {
        e.preventDefault?.();
        triggerScreenshotShield();
        return;
      }

      // 3. macOS Screenshot shortcuts (Cmd + Shift + 3 / 4 / 5)
      if (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(key)) {
        e.preventDefault?.();
        triggerScreenshotShield();
        return;
      }

      // 4. Print shortcuts (Ctrl + P / Cmd + P)
      if ((e.ctrlKey || e.metaKey) && (key === 'p' || key === 'P' || code === 'KeyP')) {
        e.preventDefault?.();
        triggerScreenshotShield();
        return;
      }
    };

    const onBeforePrint = () => {
      triggerScreenshotShield();
    };

    const onContextMenu = (e: MouseEvent) => {
      // If screen protection is active, prevent default browser context menu
      // which contains "Take Screenshot" in Firefox and Chromium
      if (screenProtection?.active) {
        e.preventDefault();
        triggerScreenshotShield();
      }
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyDown, { capture: true });
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('contextmenu', onContextMenu);

    // Initial check
    if (typeof document !== 'undefined') {
      setIsWindowFocused(document.hasFocus ? document.hasFocus() : true);
      setIsTabHidden(document.visibilityState === 'hidden');
    }

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyDown, { capture: true });
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('contextmenu', onContextMenu);
      if (screenshotTimeoutRef.current) {
        clearTimeout(screenshotTimeoutRef.current);
      }
    };
  }, [screenProtection?.active, clearClipboard]);

  const isShieldActive =
    isPrivacyShieldTest ||
    (Boolean(screenProtection?.active) &&
      (!isWindowFocused || isTabHidden || screenshotDetected));

  // Apply CSS class to document.body when screen shield is actively obscuring
  useEffect(() => {
    if (isShieldActive) {
      document.body.classList.add('totum-privacy-shield-active');
    } else {
      document.body.classList.remove('totum-privacy-shield-active');
    }
    return () => {
      document.body.classList.remove('totum-privacy-shield-active');
    };
  }, [isShieldActive]);

  if (!isShieldActive) return null;

  const dismiss = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    dismissPrivacyShieldTest();
    setScreenshotDetected(false);
    if (screenshotTimeoutRef.current) {
      clearTimeout(screenshotTimeoutRef.current);
      screenshotTimeoutRef.current = null;
    }
    window.focus();
  };

  return (
    <div
      onClick={dismiss}
      className="fixed inset-0 z-[999999] backdrop-blur-3xl bg-zinc-950/95 flex flex-col items-center justify-center p-6 text-center select-none cursor-pointer animate-fade-in"
      role="alert"
      aria-label="Privacy Screen Shield Active"
    >
      <div className="w-16 h-16 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4 shadow-xl shadow-purple-500/10">
        <ShieldAlert className="w-8 h-8 stroke-[1.75]" />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-2">
        <EyeOff className="w-3.5 h-3.5" />
        <span>Privacy Screen Shield Active</span>
      </div>

      <h2 className="text-xl font-bold text-white tracking-tight mb-2">
        Window Content Protected
      </h2>

      <p className="text-xs sm:text-sm text-zinc-400 max-w-md mb-6 leading-relaxed">
        {screenshotDetected
          ? 'Screenshot or screen capture shortcut detected! TotumVault content is actively obscured to protect your passwords and private data.'
          : 'TotumVault is actively obscured to prevent shoulder-surfing, window mirroring, and background screen capture.'}
      </p>

      <button
        type="button"
        onClick={dismiss}
        className="py-2.5 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-bold shadow-lg shadow-purple-600/25 transition-all cursor-pointer hover:scale-105 active:scale-95"
      >
        Resume Viewing
      </button>

      <p className="text-[11px] text-zinc-500 mt-4">
        Click anywhere or focus this window to resume
      </p>
    </div>
  );
};
