import React, { useState } from 'react';
import { Eye, EyeOff, Sparkles, Copy, Check } from 'lucide-react';
import { calculatePasswordStrength, calculateEntropy } from '../../../utils/cryptoUtils';
import { useVault } from '../../../context/VaultContext';

interface PasswordFieldProps {
  value: string;
  onChange: (val: string) => void;
  onGenerate?: () => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  onCopy?: (text: string, label: string) => void;
}

export const PasswordField: React.FC<PasswordFieldProps> = ({
  value,
  onChange,
  onGenerate,
  label = 'Password',
  placeholder = 'Enter or generate password...',
  required = false,
  className = '',
  onCopy,
}) => {
  const { copyToClipboard } = useVault();
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  const strength = calculatePasswordStrength(value);
  const entropy = calculateEntropy(value);

  const handleCopy = () => {
    if (!value) return;
    if (onCopy) {
      onCopy(value, label);
    } else {
      copyToClipboard(value, label);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block">
          {label} {required && <span className="text-rose-400">*</span>}
        </label>
        {onGenerate && (
          <button
            type="button"
            onClick={onGenerate}
            className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-bold transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate</span>
          </button>
        )}
      </div>

      <div className="relative flex items-center">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="w-full input-themed rounded-xl pl-3.5 pr-20 py-2.5 text-sm font-mono placeholder-slate-400 focus:outline-none"
        />
        <div className="absolute right-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="p-1.5 rounded-lg text-theme-text-muted hover:text-theme-text hover:bg-theme-hover transition-colors cursor-pointer"
            title={show ? 'Hide Password' : 'Show Password'}
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          {value && (
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-theme-text-muted hover:text-theme-text hover:bg-theme-hover transition-colors cursor-pointer"
              title="Copy Password"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Live Strength & Entropy Meter */}
      {value && (
        <div className="p-3 rounded-xl bg-theme-elevated border border-theme-border space-y-2 animate-scale-up">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-theme-text-muted font-medium">Complexity:</span>
              <span className={`px-2 py-0.5 rounded font-bold text-white text-xs ${strength.color}`}>
                {strength.label}
              </span>
            </div>
            <span className="font-mono text-xs text-theme-text-muted">
              {entropy.bits} bits • {entropy.crackTimeDisplay}
            </span>
          </div>
          <div className="h-1.5 w-full bg-theme-hover rounded-full overflow-hidden flex gap-1">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`h-full flex-1 rounded-full transition-all ${
                  idx <= strength.score ? strength.color : 'bg-slate-700/30'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
