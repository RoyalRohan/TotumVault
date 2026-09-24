import React, { useState, useEffect, useCallback } from 'react';
import { X, RefreshCw, Copy, Check, Sparkles } from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { PwGenConfig } from '../types';
import { calculatePasswordStrength, calculateEntropy } from '../utils/cryptoUtils';

export const PasswordGeneratorModal: React.FC = () => {
  const { isGeneratorOpen, setIsGeneratorOpen, generatePassword, copyToClipboard } = useVault();

  const [generatedPw, setGeneratedPw] = useState('');
  const [copied, setCopied] = useState(false);

  const [config, setConfig] = useState<PwGenConfig>({
    length: 20,
    use_uppercase: true,
    use_lowercase: true,
    use_numbers: true,
    use_symbols: true,
    exclude_ambiguous: true,
    passphrase_mode: false,
    word_count: 4,
    separator: '-',
  });

  const handleGenerate = useCallback(async () => {
    const pw = await generatePassword(config);
    setGeneratedPw(pw);
  }, [config, generatePassword]);

  useEffect(() => {
    if (isGeneratorOpen) {
      handleGenerate();
    }
  }, [isGeneratorOpen, handleGenerate]);

  if (!isGeneratorOpen) return null;

  const strength = calculatePasswordStrength(generatedPw);
  const entropy = calculateEntropy(generatedPw);

  const handleCopy = () => {
    copyToClipboard(generatedPw, 'Generated Password');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleCharSet = (key: 'use_uppercase' | 'use_lowercase' | 'use_numbers' | 'use_symbols', val: boolean) => {
    if (!val) {
      const activeCount = [
        key === 'use_uppercase' ? false : config.use_uppercase,
        key === 'use_lowercase' ? false : config.use_lowercase,
        key === 'use_numbers' ? false : config.use_numbers,
        key === 'use_symbols' ? false : config.use_symbols,
      ].filter(Boolean).length;

      if (activeCount === 0) {
        return; // Disallow unchecking all character sets
      }
    }
    setConfig({ ...config, [key]: val });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-md select-none">
      <div className="w-full max-w-lg glass-panel rounded-2xl p-4 sm:p-6 shadow-2xl border border-theme-border animate-scale-up max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-theme-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-theme-surface border border-theme-border text-purple-400 flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-theme-text tracking-tight">Password Generator</h2>
              <p className="text-xs text-theme-text-muted">Generate strong, unique passwords</p>
            </div>
          </div>
          <button
            onClick={() => setIsGeneratorOpen(false)}
            className="p-2 rounded-xl hover:bg-theme-surface text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Generated Password Box */}
        <div className="my-5 space-y-2.5">
          <div className="p-4 rounded-xl bg-theme-surface border border-theme-border flex items-center justify-between group gap-2 shadow-sm">
            <span className="font-mono text-base font-semibold text-purple-400 dark:text-purple-300 break-all select-all tracking-wider">
              {generatedPw || 'Generating...'}
            </span>

            <div className="flex items-center gap-1.5 shrink-0 pl-2">
              <button
                onClick={handleGenerate}
                className="p-2 rounded-xl bg-theme-bg hover:bg-theme-surface text-theme-text-muted hover:text-theme-text border border-theme-border transition-colors cursor-pointer"
                title="Regenerate"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={handleCopy}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white transition-colors flex items-center gap-1.5 text-xs font-medium shadow-sm cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Strength Meter */}
          <div className="flex items-center justify-between text-xs px-1 flex-wrap gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-theme-text-muted">Security Score:</span>
              <span className={`px-2 py-0.5 rounded font-bold text-white text-xs ${strength.color}`}>{strength.label}</span>
            </div>
            <span className="font-mono text-xs text-theme-text-muted bg-theme-elevated px-2.5 py-0.5 rounded border border-theme-border font-medium">
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

        {/* Options / Controls */}
        <div className="space-y-4 pt-2">
          {/* Mode Switcher */}
          <div className="flex bg-theme-surface p-1.5 rounded-xl border border-theme-border text-xs">
            <button
              onClick={() => setConfig({ ...config, passphrase_mode: false })}
              className={`flex-1 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
                !config.passphrase_mode ? 'bg-purple-600 text-white shadow-sm' : 'text-theme-text-muted hover:text-theme-text'
              }`}
            >
              Random Password
            </button>
            <button
              onClick={() => setConfig({ ...config, passphrase_mode: true })}
              className={`flex-1 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
                config.passphrase_mode ? 'bg-purple-600 text-white shadow-sm' : 'text-theme-text-muted hover:text-theme-text'
              }`}
            >
              Passphrase
            </button>
          </div>

          {!config.passphrase_mode ? (
            <>
              {/* Length Slider & Presets */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-theme-text-muted">
                  <span>Password Length</span>
                  <span className="font-mono font-bold text-purple-500 dark:text-purple-400">{config.length} characters</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="64"
                  value={config.length}
                  onChange={(e) => setConfig({ ...config, length: parseInt(e.target.value) })}
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                  <span className="text-xs text-theme-text-muted uppercase font-bold tracking-wider mr-1">Presets:</span>
                  {[16, 20, 24, 32, 48].map((len) => (
                    <button
                      key={len}
                      type="button"
                      onClick={() => setConfig({ ...config, length: len })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
                        config.length === len
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-theme-surface text-theme-text-muted hover:text-theme-text border border-theme-border'
                      }`}
                    >
                      {len}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-theme-surface border border-theme-border cursor-pointer text-theme-text">
                  <input
                    type="checkbox"
                    checked={config.use_uppercase}
                    onChange={(e) => toggleCharSet('use_uppercase', e.target.checked)}
                    className="rounded text-purple-500 accent-purple-500"
                  />
                  <span>Uppercase (A-Z)</span>
                </label>
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-theme-surface border border-theme-border cursor-pointer text-theme-text">
                  <input
                    type="checkbox"
                    checked={config.use_lowercase}
                    onChange={(e) => toggleCharSet('use_lowercase', e.target.checked)}
                    className="rounded text-purple-500 accent-purple-500"
                  />
                  <span>Lowercase (a-z)</span>
                </label>
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-theme-surface border border-theme-border cursor-pointer text-theme-text">
                  <input
                    type="checkbox"
                    checked={config.use_numbers}
                    onChange={(e) => toggleCharSet('use_numbers', e.target.checked)}
                    className="rounded text-purple-500 accent-purple-500"
                  />
                  <span>Numbers (0-9)</span>
                </label>
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-theme-surface border border-theme-border cursor-pointer text-theme-text">
                  <input
                    type="checkbox"
                    checked={config.use_symbols}
                    onChange={(e) => toggleCharSet('use_symbols', e.target.checked)}
                    className="rounded text-purple-500 accent-purple-500"
                  />
                  <span>Symbols (!@#$)</span>
                </label>
              </div>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-theme-surface border border-theme-border text-xs cursor-pointer text-theme-text">
                <input
                  type="checkbox"
                  checked={config.exclude_ambiguous}
                  onChange={(e) => setConfig({ ...config, exclude_ambiguous: e.target.checked })}
                  className="rounded text-purple-500 accent-purple-500"
                />
                <span>Exclude Ambiguous Characters (1, l, I, 0, O, 8)</span>
              </label>
            </>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-theme-text-muted">
                  <span>Word Count</span>
                  <span className="font-mono font-bold text-purple-500 dark:text-purple-400">{config.word_count} words</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="8"
                  value={config.word_count}
                  onChange={(e) => setConfig({ ...config, word_count: parseInt(e.target.value) })}
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-xs text-theme-text-muted uppercase font-bold tracking-wider mr-1">Presets:</span>
                  {[3, 4, 5, 6].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setConfig({ ...config, word_count: cnt })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
                        config.word_count === cnt
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-theme-surface text-theme-text-muted hover:text-theme-text border border-theme-border'
                      }`}
                    >
                      {cnt} words
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5 block">Word Separator</label>
                <input
                  type="text"
                  value={config.separator}
                  onChange={(e) => setConfig({ ...config, separator: e.target.value })}
                  maxLength={3}
                  className="w-24 input-themed rounded-xl px-3 py-2 font-mono text-center text-sm"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
