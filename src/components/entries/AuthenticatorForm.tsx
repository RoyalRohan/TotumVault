import React, { useState, useEffect } from 'react';
import { Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { DecryptedEntry, CustomField, CategoryType, TotpResult } from '../../types';
import { EntryFormShell } from './shared/EntryFormShell';
import { SecretInput } from './shared/SecretInput';
import { TagEditor } from './shared/TagEditor';
import { CustomFieldsEditor } from './shared/CustomFieldsEditor';
import { FormSection } from './shared/FormSection';

interface AuthenticatorFormProps {
  initialData: DecryptedEntry | null;
  onSave: (entry: DecryptedEntry) => void;
  onClose: () => void;
  onCategoryChange: (cat: CategoryType) => void;
}

export const AuthenticatorForm: React.FC<AuthenticatorFormProps> = ({
  initialData,
  onSave,
  onClose,
  onCategoryChange,
}) => {
  const [accountName, setAccountName] = useState(initialData?.title || '');
  const [issuer, setIssuer] = useState(initialData?.totp_issuer || '');
  const [accountIdentifier, setAccountIdentifier] = useState(initialData?.username || '');
  const [secret, setSecret] = useState(initialData?.totp_secret || '');
  const [algorithm, setAlgorithm] = useState<'SHA1' | 'SHA256' | 'SHA512'>(
    (initialData?.totp_algorithm as any) || 'SHA1'
  );
  const [digits, setDigits] = useState<number>(initialData?.totp_digits || 6);
  const [period, setPeriod] = useState<number>(initialData?.totp_period || 30);
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [favorite, setFavorite] = useState(initialData?.favorite || false);
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [customFields, setCustomFields] = useState<CustomField[]>(initialData?.custom_fields || []);

  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [previewRemaining, setPreviewRemaining] = useState<number>(30);
  const [secretError, setSecretError] = useState<string | null>(null);

  // Live preview tester
  useEffect(() => {
    let active = true;
    if (!secret.trim()) {
      setPreviewCode(null);
      setSecretError(null);
      return;
    }

    const testSecret = async () => {
      try {
        const res = await invoke<TotpResult>('generate_totp_code', {
          secret: secret.trim(),
          digits,
          period,
        });
        if (active) {
          setPreviewCode(res.code);
          setPreviewRemaining(res.time_remaining);
          setSecretError(null);
        }
      } catch (err: any) {
        if (active) {
          setPreviewCode(null);
          setSecretError('Invalid secret format. Expecting Base32 (e.g. JBSWY3DPEHPK3PXP) or otpauth:// URL');
        }
      }
    };

    testSecret();
    const interval = setInterval(testSecret, 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [secret, digits, period]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim() || !secret.trim()) return;

    const entryToSave: DecryptedEntry = {
      id: initialData ? initialData.id : '',
      title: accountName.trim(),
      username: accountIdentifier.trim(),
      email: '',
      password: '',
      url: '',
      notes: notes.trim(),
      category: 'totp',
      favorite,
      tags,
      custom_fields: customFields.filter((f) => f.name.trim()),
      totp_secret: secret.trim(),
      totp_issuer: issuer.trim() || undefined,
      totp_algorithm: algorithm,
      totp_digits: digits,
      totp_period: period,
      created_at: initialData ? initialData.created_at : '',
      updated_at: '',
    };

    onSave(entryToSave);
  };

  return (
    <EntryFormShell
      title={accountName || 'Authenticator'}
      isEditing={Boolean(initialData)}
      category="totp"
      onCategoryChange={onCategoryChange}
      favorite={favorite}
      onFavoriteToggle={() => setFavorite(!favorite)}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitDisabled={!accountName.trim() || !secret.trim() || Boolean(secretError)}
    >
      {/* Account Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1.5">
            Account / Service Name <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="e.g. GitHub, AWS, Discord, Proton..."
            required
            autoFocus
            className="w-full input-themed rounded-xl px-3.5 py-2.5 text-sm placeholder-slate-400 focus:outline-none font-medium"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1.5">
            Service Issuer
          </label>
          <input
            type="text"
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            placeholder="e.g. GitHub Inc, Amazon Web Services..."
            className="w-full input-themed rounded-xl px-3.5 py-2.5 text-sm placeholder-slate-400 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1.5">
          Account Identifier (Username or Email)
        </label>
        <input
          type="text"
          value={accountIdentifier}
          onChange={(e) => setAccountIdentifier(e.target.value)}
          placeholder="e.g. user@domain.com or @handle"
          className="w-full input-themed rounded-xl px-3.5 py-2.5 text-sm placeholder-slate-400 focus:outline-none"
        />
      </div>

      {/* Secret Key with Validation */}
      <FormSection title="Secret Key & Algorithm" icon={<Clock className="w-3.5 h-3.5 text-teal-500" />}>
        <SecretInput
          label="Base32 Secret Key"
          value={secret}
          onChange={setSecret}
          placeholder="Paste Base32 key or otpauth://totp/..."
          required
          copyLabel="2FA Secret"
        />

        {secretError && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium animate-scale-up">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{secretError}</span>
          </div>
        )}

        {/* Live Code Preview Verification */}
        {previewCode && !secretError && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 animate-scale-up">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-xs text-emerald-300 font-semibold block">Valid Key Verified:</span>
                <span className="text-base font-mono font-bold tracking-widest text-white">
                  {previewCode.slice(0, 3)} {previewCode.slice(3)}
                </span>
              </div>
            </div>
            <span className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-1 rounded-lg border border-emerald-500/30">
              {previewRemaining}s
            </span>
          </div>
        )}

        {/* Advanced Algorithm Parameters */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          <div>
            <label className="text-[11px] font-bold text-theme-text-muted uppercase tracking-wider block mb-1">
              Algorithm
            </label>
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value as any)}
              className="w-full input-themed rounded-xl px-2.5 py-2 text-xs font-medium focus:outline-none"
            >
              <option value="SHA1">SHA1 (Standard)</option>
              <option value="SHA256">SHA256</option>
              <option value="SHA512">SHA512</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-theme-text-muted uppercase tracking-wider block mb-1">
              Digits
            </label>
            <select
              value={digits}
              onChange={(e) => setDigits(Number(e.target.value))}
              className="w-full input-themed rounded-xl px-2.5 py-2 text-xs font-medium focus:outline-none"
            >
              <option value={6}>6 Digits</option>
              <option value={8}>8 Digits</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-theme-text-muted uppercase tracking-wider block mb-1">
              Period
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
              className="w-full input-themed rounded-xl px-2.5 py-2 text-xs font-medium focus:outline-none"
            >
              <option value={30}>30 Seconds</option>
              <option value={60}>60 Seconds</option>
            </select>
          </div>
        </div>
      </FormSection>

      {/* Tags */}
      <TagEditor tags={tags} onChange={setTags} />

      {/* Custom Fields */}
      <CustomFieldsEditor fields={customFields} onChange={setCustomFields} />

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block">
          Recovery Notes / Emergency Codes
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Store backup recovery codes generated alongside this 2FA secret..."
          className="w-full input-themed rounded-xl px-3.5 py-2.5 text-sm placeholder-slate-400 focus:outline-none font-mono resize-y"
        />
      </div>
    </EntryFormShell>
  );
};
