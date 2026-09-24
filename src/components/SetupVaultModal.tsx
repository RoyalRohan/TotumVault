import React, { useState } from 'react';
import { Eye, EyeOff, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { calculatePasswordStrength, calculateEntropy } from '../utils/cryptoUtils';
import logoImg from '../assets/logo.png';

interface SetupVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SetupVaultModal: React.FC<SetupVaultModalProps> = ({ isOpen, onClose }) => {
  const { createVault } = useVault();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  if (!isOpen) return null;

  const strength = calculatePasswordStrength(password);
  const entropy = calculateEntropy(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Master password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await createVault(password);
      setPassword('');
      setConfirmPassword('');
      onClose();
    } catch (err: any) {
      setError(err.toString());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-md">
      <div className="w-full max-w-lg glass-panel rounded-2xl p-4 sm:p-6 shadow-2xl border border-theme-border animate-scale-up max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-theme-border">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center p-1 border border-theme-border bg-theme-surface shrink-0 shadow-sm">
            <img src={logoImg} alt="TotumVault" className="w-full h-full object-cover rounded-[10px]" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-theme-text tracking-tight">Create Local Vault</h2>
            <p className="text-xs text-theme-text-muted">Secure your database using a local master password</p>
          </div>
        </div>

        {/* Security Alert Warning */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-200/90 text-xs mb-5 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-amber-500">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Important Offline Notice</span>
          </div>
          <p className="leading-relaxed text-xs text-amber-700 dark:text-amber-200/80">
            TotumVault is 100% offline. There is no cloud recovery or password reset. If you lose your master password, your vault cannot be recovered.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-theme-text-muted block uppercase tracking-wider">
                Choose Master Password <span className="text-rose-500">*</span>
              </label>
              {capsLockOn && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-500 animate-scale-up">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Caps Lock ON</span>
                </div>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                onKeyUp={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                placeholder="Choose a strong password (min. 8 characters)..."
                required
                className="input-themed w-full rounded-xl pl-4 pr-11 py-3 text-sm sm:text-base font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-text-muted hover:text-theme-text p-1.5 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password Strength Visualizer */}
            {password && (
              <div className="mt-2.5 p-3 rounded-xl bg-theme-surface border border-theme-border space-y-2 animate-scale-up">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-theme-text-muted font-medium">Complexity:</span>
                    <span className={`px-2 py-0.5 rounded font-bold text-white text-xs ${strength.color}`}>
                      {strength.label}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-theme-text-muted font-medium">
                    {entropy.bits} bits • {entropy.crackTimeDisplay}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 dark:bg-[#21262d] rounded-full overflow-hidden flex gap-1">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`h-full flex-1 rounded-full transition-all ${
                        idx <= strength.score ? strength.color : 'bg-transparent'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-theme-text-muted mb-1.5 block uppercase tracking-wider">
              Confirm Master Password <span className="text-rose-500">*</span>
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
              onKeyUp={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
              placeholder="Confirm master password..."
              required
              className="input-themed w-full rounded-xl px-4 py-3 text-sm sm:text-base font-mono"
            />
          </div>

          {error && <p className="text-xs text-rose-500 font-medium leading-tight">{error}</p>}

          <div className="flex items-center gap-3 pt-4 border-t border-theme-border">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-theme-border hover:bg-theme-surface text-theme-text text-sm font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !password || password !== confirmPassword}
              className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Initialize Vault</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
