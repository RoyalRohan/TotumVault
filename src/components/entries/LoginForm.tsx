import React, { useState } from 'react';
import { Globe, User, Mail, Clock, FileText } from 'lucide-react';
import { DecryptedEntry, CustomField, CategoryType } from '../../types';
import { EntryFormShell } from './shared/EntryFormShell';
import { PasswordField } from './shared/PasswordField';
import { SecretInput } from './shared/SecretInput';
import { TagEditor } from './shared/TagEditor';
import { CustomFieldsEditor } from './shared/CustomFieldsEditor';
import { FormSection } from './shared/FormSection';

interface LoginFormProps {
  initialData: DecryptedEntry | null;
  onSave: (entry: DecryptedEntry) => void;
  onClose: () => void;
  onCategoryChange: (cat: CategoryType) => void;
  onGeneratePassword: () => Promise<string>;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  initialData,
  onSave,
  onClose,
  onCategoryChange,
  onGeneratePassword,
}) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [username, setUsername] = useState(initialData?.username || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [password, setPassword] = useState(initialData?.password || '');
  const [url, setUrl] = useState(initialData?.url || '');
  const [totpSecret, setTotpSecret] = useState(initialData?.totp_secret || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [favorite, setFavorite] = useState(initialData?.favorite || false);
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [customFields, setCustomFields] = useState<CustomField[]>(initialData?.custom_fields || []);

  const handleGenerate = async () => {
    const pw = await onGeneratePassword();
    if (pw) setPassword(pw);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const entryToSave: DecryptedEntry = {
      id: initialData ? initialData.id : '',
      title: title.trim(),
      username: username.trim(),
      email: email.trim(),
      password,
      url: url.trim(),
      notes: notes.trim(),
      category: 'logins',
      favorite,
      tags,
      custom_fields: customFields.filter((f) => f.name.trim()),
      totp_secret: totpSecret.trim() || undefined,
      created_at: initialData ? initialData.created_at : '',
      updated_at: '',
    };

    onSave(entryToSave);
  };

  return (
    <EntryFormShell
      title={title || 'Login'}
      isEditing={Boolean(initialData)}
      category="logins"
      onCategoryChange={onCategoryChange}
      favorite={favorite}
      onFavoriteToggle={() => setFavorite(!favorite)}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitDisabled={!title.trim()}
    >
      {/* Title & Website */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1.5">
            Title / Service <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. GitHub, Google, Netflix..."
            required
            autoFocus
            className="w-full input-themed rounded-xl px-3.5 py-2.5 text-sm placeholder-slate-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-purple-400" />
            <span>Website URL</span>
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/login"
            className="w-full input-themed rounded-xl px-3.5 py-2.5 text-sm font-mono placeholder-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Account Credentials */}
      <FormSection title="Account Credentials" icon={<User className="w-3.5 h-3.5 text-purple-400" />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username or handle..."
              className="w-full input-themed rounded-xl px-3.5 py-2.5 text-sm placeholder-slate-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-theme-text-muted" />
              <span>Email</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full input-themed rounded-xl px-3.5 py-2.5 text-sm placeholder-slate-400 focus:outline-none"
            />
          </div>
        </div>

        <PasswordField
          value={password}
          onChange={setPassword}
          onGenerate={handleGenerate}
          placeholder="Password..."
        />
      </FormSection>

      {/* Two-Factor Authentication */}
      <FormSection title="Two-Factor Authentication" icon={<Clock className="w-3.5 h-3.5 text-teal-500" />}>
        <SecretInput
          label="TOTP / 2FA Secret Key"
          value={totpSecret}
          onChange={setTotpSecret}
          placeholder="Base32 key (e.g. JBSWY3DPEHPK3PXP) or otpauth:// URL"
          copyLabel="2FA Secret"
        />
      </FormSection>

      {/* Tags */}
      <TagEditor tags={tags} onChange={setTags} />

      {/* Custom Fields */}
      <CustomFieldsEditor fields={customFields} onChange={setCustomFields} />

      {/* Secure Notes */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-emerald-400" />
          <span>Notes</span>
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional private notes, security recovery codes, or answers..."
          className="w-full input-themed rounded-xl px-3.5 py-2.5 text-sm placeholder-slate-400 focus:outline-none font-mono resize-y"
        />
      </div>
    </EntryFormShell>
  );
};
