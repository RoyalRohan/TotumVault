import React, { useState } from 'react';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';

interface SecretInputProps {
  label?: string;
  value: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  required?: boolean;
  autoComplete?: string;
  copyLabel?: string;
  onCopy?: (text: string, label: string) => void;
  className?: string;
  isSecret?: boolean;
}

export const SecretInput: React.FC<SecretInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  readOnly = false,
  required = false,
  autoComplete = 'off',
  copyLabel = 'Secret',
  onCopy,
  className = '',
  isSecret = true,
}) => {
  const [revealed, setRevealed] = useState(!isSecret);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!value) return;
    if (onCopy) {
      onCopy(value, copyLabel);
    } else {
      navigator.clipboard.writeText(value);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block">
          {label} {required && <span className="text-rose-400">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        <input
          type={revealed ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          required={required}
          autoComplete={autoComplete}
          className="w-full input-themed rounded-xl pl-3.5 pr-20 py-2.5 text-sm font-mono placeholder-slate-400 focus:outline-none"
        />
        <div className="absolute right-2 flex items-center gap-1">
          {isSecret && (
            <button
              type="button"
              onClick={() => setRevealed(!revealed)}
              className="p-1.5 rounded-lg text-theme-text-muted hover:text-theme-text hover:bg-theme-hover transition-colors cursor-pointer"
              title={revealed ? 'Hide Secret' : 'Reveal Secret'}
            >
              {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
          {value && (
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-theme-text-muted hover:text-theme-text hover:bg-theme-hover transition-colors cursor-pointer"
              title={`Copy ${copyLabel}`}
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
