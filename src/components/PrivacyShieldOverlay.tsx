import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, EyeOff } from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { isBiometricPromptActive } from '../utils/androidBiometrics';

export const PrivacyShieldOverlay: React.FC = () => {
  const { screenProtection, isPrivacyShieldTest, dismissPrivacyShieldTest, clearClipboard } = useVault();
  const [isWindowFocused, setIsWindowFocused] = useState<boolean>(true);
  const [isTabHidden, setIsTabHidden] = useState<boolean>(false);
  const [screenshotDetected, setScreenshotDetected] = useState<boolean>(false);
  const [bioPromptActive, setBioPromptActive] = useState<boolean>(false);
  const screenshotTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRightClickTimeRef = useRef<number>(0);
  const isTouchingRef = useRef<boolean>(false);
  const lastTouchTimeRef = useRef<number>(0);
  const touchWatchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onFocus = () => {
      setIsWindowFocused(true);
    };

    // Safety watchdog: automatically clears isTouchingRef if touchcancel/touchend was dropped by the OS
    const resetTouchWatchdog = () => {
      if (touchWatchdogTimerRef.current) {
        clearTimeout(touchWatchdogTimerRef.current);
      }
      touchWatchdogTimerRef.current = setTimeout(() => {
        isTouchingRef.current = false;
        touchWatchdogTimerRef.current = null;
      }, 5000);
    };

    const clearTouchWatchdog = () => {
      if (touchWatchdogTimerRef.current) {
        clearTimeout(touchWatchdogTimerRef.current);
        touchWatchdogTimerRef.current = null;
      }
    };

    const onTouchStart = () => {
      isTouchingRef.current = true;
      lastTouchTimeRef.current = Date.now();
      setIsWindowFocused(true);
      resetTouchWatchdog();
    };

    const onTouchMove = () => {
      lastTouchTimeRef.current = Date.now();
      if (isTouchingRef.current) {
        resetTouchWatchdog();
      }
    };

    const onTouchEnd = () => {
      isTouchingRef.current = false;
      lastTouchTimeRef.current = Date.now();
      clearTouchWatchdog();
    };

    const onTouchCancel = () => {
      isTouchingRef.current = false;
      lastTouchTimeRef.current = Date.now();
      clearTouchWatchdog();
    };

    const onPointerDown = (e: MouseEvent | PointerEvent) => {
      if ('pointerType' in e && e.pointerType === 'touch') {
        isTouchingRef.current = true;
        lastTouchTimeRef.current = Date.now();
        resetTouchWatchdog();
      }
      if (e.button === 2) {
        lastRightClickTimeRef.current = Date.now();
      }
      setIsWindowFocused(true);
    };

    const onPointerUp = (e: MouseEvent | PointerEvent) => {
      if ('pointerType' in e && e.pointerType === 'touch') {
        isTouchingRef.current = false;
        lastTouchTimeRef.current = Date.now();
        clearTouchWatchdog();
      }
    };

    const onPointerCancel = (e: MouseEvent | PointerEvent) => {
      if ('pointerType' in e && e.pointerType === 'touch') {
        isTouchingRef.current = false;
        lastTouchTimeRef.current = Date.now();
        clearTouchWatchdog();
      }
    };

    const isRecentInteraction = (): boolean => {
      // 1. User is actively touching/holding the screen
      if (isTouchingRef.current) {
        return true;
      }
      const now = Date.now();
      // 2. Touch ended within bounded grace period (2500ms) for Android magnifier / ActionMode / focus restoration
      if (now - lastTouchTimeRef.current < 2500) {
        return true;
      }
      // 3. Desktop right-click / context menu within bounded grace period (2500ms)
      if (now - lastRightClickTimeRef.current < 2500) {
        return true;
      }
      return false;
    };

    const onBlur = () => {
      // If native BiometricPrompt or system authentication modal is active,
      // do NOT trigger the privacy shield due to the modal taking temporary window focus.
      if (isBiometricPromptActive() || (typeof window !== 'undefined' && Boolean(window.__totumBioPromptActive))) {
        return;
      }
      // If a touch session is active or a touch/right-click occurred recently,
      // ignore transient focus loss (e.g. mobile magnifier, Android ActionMode, or context menu popup)
      if (isRecentInteraction()) {
        return;
      }
      // If the document still reports active focus, do not treat as window blur
      if (typeof document !== 'undefined' && document.hasFocus && document.hasFocus()) {
        return;
      }
      setIsWindowFocused(false);
    };

    const onVisibilityChange = () => {
      // Avoid false-positive hidden state during biometric prompt display or active touch/right-click
      if (isBiometricPromptActive() || (typeof window !== 'undefined' && Boolean(window.__totumBioPromptActive))) {
        return;
      }
      if (isRecentInteraction()) {
        return;
      }
      setIsTabHidden(document.visibilityState === 'hidden');
    };

    const handleBioPromptStart = () => {
      setBioPromptActive(true);
      setIsWindowFocused(true);
      setIsTabHidden(false);
    };

    const handleBioPromptEnd = () => {
      setBioPromptActive(false);
      setIsWindowFocused(true);
      setIsTabHidden(false);
      if (typeof window !== 'undefined') {
        window.focus();
      }
    };

    // Register native bridge focus hook
    if (typeof window !== 'undefined') {
      window.__totumOnWindowFocus = (focused: boolean) => {
        if (focused) {
          setBioPromptActive(false);
          setIsWindowFocused(true);
          setIsTabHidden(false);
        } else if (!isBiometricPromptActive() && !window.__totumBioPromptActive) {
          if (!isRecentInteraction()) {
            setIsWindowFocused(false);
          }
        }
      };
    }

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
      if (key === 'PrintScreen' || code === 'PrintScreen' || key === 'Print' || key === 'Snapshot' || keyCode === 44) {
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
      const now = Date.now();
      lastRightClickTimeRef.current = now;
      lastTouchTimeRef.current = now;
      setIsWindowFocused(true);

      // Prevent default browser context menu when screen protection is active
      // to avoid exposing browser-level tools, but NEVER trigger the privacy shield!
      if (screenProtection?.active) {
        e.preventDefault();
      }
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
    window.addEventListener('pointerup', onPointerUp, { capture: true, passive: true });
    window.addEventListener('pointercancel', onPointerCancel, { capture: true, passive: true });
    window.addEventListener('mousedown', onPointerDown, { capture: true, passive: true });
    window.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    window.addEventListener('touchmove', onTouchMove, { capture: true, passive: true });
    window.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });
    window.addEventListener('touchcancel', onTouchCancel, { capture: true, passive: true });
    window.addEventListener('totum-bio-prompt-start', handleBioPromptStart);
    window.addEventListener('totum-bio-prompt-end', handleBioPromptEnd);
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
      window.removeEventListener('pointerdown', onPointerDown, { capture: true });
      window.removeEventListener('pointerup', onPointerUp, { capture: true });
      window.removeEventListener('pointercancel', onPointerCancel, { capture: true });
      window.removeEventListener('mousedown', onPointerDown, { capture: true });
      window.removeEventListener('touchstart', onTouchStart, { capture: true });
      window.removeEventListener('touchmove', onTouchMove, { capture: true });
      window.removeEventListener('touchend', onTouchEnd, { capture: true });
      window.removeEventListener('touchcancel', onTouchCancel, { capture: true });
      window.removeEventListener('totum-bio-prompt-start', handleBioPromptStart);
      window.removeEventListener('totum-bio-prompt-end', handleBioPromptEnd);
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyDown, { capture: true });
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('contextmenu', onContextMenu);
      if (typeof window !== 'undefined' && window.__totumOnWindowFocus) {
        window.__totumOnWindowFocus = undefined;
      }
      clearTouchWatchdog();
      if (screenshotTimeoutRef.current) {
        clearTimeout(screenshotTimeoutRef.current);
      }
    };
  }, [screenProtection?.active, clearClipboard]);

  const isPromptingBio =
    bioPromptActive ||
    isBiometricPromptActive() ||
    (typeof window !== 'undefined' && Boolean(window.__totumBioPromptActive));

  const isShieldActive =
    !isPromptingBio &&
    (isPrivacyShieldTest ||
      (Boolean(screenProtection?.active) &&
        (!isWindowFocused || isTabHidden || screenshotDetected)));

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
    setIsWindowFocused(true);
    setIsTabHidden(false);
    if (screenshotTimeoutRef.current) {
      clearTimeout(screenshotTimeoutRef.current);
      screenshotTimeoutRef.current = null;
    }
    if (typeof window !== 'undefined') {
      window.focus();
    }
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
