import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, EyeOff } from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { isBiometricPromptActive } from '../utils/androidBiometrics';

export const PrivacyShieldOverlay: React.FC = () => {
  const { screenProtection, isPrivacyShieldTest, dismissPrivacyShieldTest, clearClipboard } = useVault();
  const [screenshotDetected, setScreenshotDetected] = useState<boolean>(false);
  const [bioPromptActive, setBioPromptActive] = useState<boolean>(false);
  const screenshotTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleBioPromptStart = () => {
      setBioPromptActive(true);
    };

    const handleBioPromptEnd = () => {
      setBioPromptActive(false);
      if (typeof window !== 'undefined') {
        window.focus();
      }
    };

    // Register native bridge focus hook for biometrics
    if (typeof window !== 'undefined') {
      window.__totumOnWindowFocus = (focused: boolean) => {
        if (focused) {
          setBioPromptActive(false);
        }
      };
    }

    const triggerScreenshotShield = () => {
      setScreenshotDetected(true);
      // Immediately wipe clipboard on screenshot attempt so credentials cannot be captured or leaked
      clearClipboard(false, true);

      if (screenshotTimeoutRef.current) {
        clearTimeout(screenshotTimeoutRef.current);
      }
      // Hold screen shield active for 6 seconds to prevent capture utilities from grabbing clear view
      screenshotTimeoutRef.current = setTimeout(() => {
        setScreenshotDetected(false);
        screenshotTimeoutRef.current = null;
      }, 6000);
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
      // Prevent default browser context menu when screen protection is active
      // to avoid exposing browser-level tools, but NEVER trigger the privacy shield!
      if (screenProtection?.active) {
        e.preventDefault();
      }
    };

    window.addEventListener('totum-bio-prompt-start', handleBioPromptStart);
    window.addEventListener('totum-bio-prompt-end', handleBioPromptEnd);
    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyDown, { capture: true });
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('contextmenu', onContextMenu);

    return () => {
      window.removeEventListener('totum-bio-prompt-start', handleBioPromptStart);
      window.removeEventListener('totum-bio-prompt-end', handleBioPromptEnd);
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyDown, { capture: true });
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('contextmenu', onContextMenu);
      if (typeof window !== 'undefined' && window.__totumOnWindowFocus) {
        window.__totumOnWindowFocus = undefined;
      }
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
      (Boolean(screenProtection?.active) && screenshotDetected));

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
          ? 'Screenshot or screen capture shortcut detected! TotumVault content was obscured and clipboard cleared to protect your sensitive credentials.'
          : 'Privacy Screen Shield preview active. Window content is obscured to prevent unauthorized capture.'}
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
