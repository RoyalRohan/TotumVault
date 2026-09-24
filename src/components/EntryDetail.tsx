import React, { useState } from 'react';
import {
  Key,
  Star,
  Copy,
  ExternalLink,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  User,
  Mail,
  Globe,
  Shield,
  Calendar,
  Lock,
  Check,
  FileText,
  CreditCard,
  Server,
  Scroll,
  Terminal,
  Clock,
  ChevronLeft,
  Tag,
} from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { TotpViewer } from './TotpViewer';
import { calculatePasswordStrength, calculateEntropy } from '../utils/cryptoUtils';
import { openUrl } from '@tauri-apps/plugin-opener';

export const EntryDetail: React.FC = () => {
  const {
    entries,
    selectedEntryId,
    setSelectedEntryId,
    openEditor,
    deleteEntry,
    copyToClipboard,
    saveEntry,
  } = useVault();

  const [showPassword, setShowPassword] = useState(false);
  const [showCardNumber, setShowCardNumber] = useState(false);
  const [showCvv, setShowCvv] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showLicenseKey, setShowLicenseKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [showSshKey, setShowSshKey] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [visibleCustomFields, setVisibleCustomFields] = useState<Record<string, boolean>>({});

  const entry = entries.find((e) => e.id === selectedEntryId);

  if (!entry) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-theme-bg select-none">
        <div className="w-12 h-12 rounded-2xl bg-theme-surface border border-theme-border flex items-center justify-center mb-3 shadow-sm text-theme-text-muted">
          <Shield className="w-6 h-6 stroke-[1.5]" />
        </div>
        <h3 className="text-sm font-semibold text-theme-text mb-1 tracking-tight">No Item Selected</h3>
        <p className="text-xs text-theme-text-muted max-w-[260px] leading-relaxed">
          Select an entry from the list to view decrypted details or manage credentials.
        </p>
      </div>
    );
  }

  const handleCopy = (text: string, label: string) => {
    copyToClipboard(text, label);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const toggleFavorite = () => {
    saveEntry({ ...entry, favorite: !entry.favorite }, true);
  };

  const handleOpenUrl = async (targetUrl?: string) => {
    const rawUrl = targetUrl || entry.url;
    if (!rawUrl) return;
    let validUrl = rawUrl.trim();
    if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
      validUrl = 'https://' + validUrl;
    }
    try {
      const parsed = new URL(validUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
      await openUrl(validUrl);
    } catch {
      window.open(validUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'secure_notes':
        return <FileText className="w-5 h-5 text-emerald-500" />;
      case 'totp':
        return <Clock className="w-5 h-5 text-teal-500" />;
      case 'cards':
        return <CreditCard className="w-5 h-5 text-indigo-500" />;
      case 'licenses':
        return <Scroll className="w-5 h-5 text-amber-600 dark:text-amber-500" />;
      case 'servers':
        return <Server className="w-5 h-5 text-purple-500" />;
      case 'api_credentials':
        return <Terminal className="w-5 h-5 text-rose-500" />;
      default:
        return <Key className="w-5 h-5 text-purple-400" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'secure_notes': return 'Secure Note';
      case 'totp': return 'Authenticator (2FA)';
      case 'cards': return 'Payment Card';
      case 'licenses': return 'Software License';
      case 'servers': return 'Server Credential';
      case 'api_credentials': return 'API Credential';
      default: return 'Login';
    }
  };

  // Render Custom Fields Section
  const renderCustomFields = () => {
    if (!entry.custom_fields || entry.custom_fields.length === 0) return null;
    return (
      <div className="bg-theme-surface border border-theme-border rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">
          Custom Fields
        </h3>
        {entry.custom_fields.map((field) => {
          const isSensitive = field.fieldType === 'sensitive' || field.field_type === 'sensitive';
          const isRevealed = visibleCustomFields[field.id];
          return (
            <div
              key={field.id}
              className="flex items-center justify-between p-3 rounded-xl bg-theme-elevated border border-theme-border"
            >
              <div className="pl-1 min-w-0 flex-1 pr-3">
                <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block">
                  {field.name}
                </span>
                <span className="text-sm font-mono text-theme-text select-all block truncate">
                  {isSensitive && !isRevealed ? '••••••••••••' : field.value}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {isSensitive && (
                  <button
                    onClick={() =>
                      setVisibleCustomFields((prev) => ({ ...prev, [field.id]: !prev[field.id] }))
                    }
                    className="p-2 rounded-lg hover:bg-theme-hover text-theme-text-muted hover:text-theme-text cursor-pointer"
                    title={isRevealed ? 'Hide Value' : 'Show Value'}
                  >
                    {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
                <button
                  onClick={() => handleCopy(field.value, field.name)}
                  className="p-2 rounded-lg hover:bg-theme-hover text-theme-text-muted hover:text-theme-text cursor-pointer"
                  title="Copy"
                >
                  {copiedField === field.name ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render Metadata Footer
  const renderMetadata = () => (
    <div className="flex items-center gap-5 text-xs text-theme-text-muted font-mono pt-2 flex-wrap">
      <div className="flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5 text-theme-text-dim" />
        <span>Created: {new Date(entry.created_at).toLocaleDateString()}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5 text-theme-text-dim" />
        <span>Updated: {new Date(entry.updated_at || entry.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  );

  /* ----------------------------------------------------
     TYPE-SPECIFIC DETAIL VIEWS
  ---------------------------------------------------- */

  // 1. LOGIN DETAIL
  const renderLoginDetail = () => {
    const strength = calculatePasswordStrength(entry.password);
    const entropy = calculateEntropy(entry.password);

    return (
      <div className="space-y-4">
        {entry.totp_secret && (
          <TotpViewer secret={entry.totp_secret} onCopy={handleCopy} />
        )}

        <div className="bg-theme-surface border border-theme-border rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
          {entry.username && (
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                <User className="w-4.5 h-4.5 text-theme-text-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block mb-0.5">
                    Username
                  </span>
                  <span className="text-sm sm:text-base font-mono text-theme-text font-medium select-all block truncate">
                    {entry.username}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleCopy(entry.username, 'Username')}
                className="p-2 rounded-xl bg-theme-elevated hover:bg-theme-hover text-theme-text-muted hover:text-theme-text border border-theme-border transition-colors cursor-pointer shrink-0"
                title="Copy Username"
              >
                {copiedField === 'Username' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}

          {entry.email && (
            <div className="flex items-center justify-between group pt-3.5 border-t border-theme-border">
              <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                <Mail className="w-4.5 h-4.5 text-theme-text-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block mb-0.5">
                    Email
                  </span>
                  <span className="text-sm sm:text-base font-mono text-theme-text font-medium select-all block truncate">
                    {entry.email}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleCopy(entry.email, 'Email')}
                className="p-2 rounded-xl bg-theme-elevated hover:bg-theme-hover text-theme-text-muted hover:text-theme-text border border-theme-border transition-colors cursor-pointer shrink-0"
                title="Copy Email"
              >
                {copiedField === 'Email' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}

          {entry.password && (
            <div className="pt-3.5 border-t border-theme-border">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <Lock className="w-4.5 h-4.5 text-theme-text-muted shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">Password</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${strength.color} text-white`}>
                        {strength.label}
                      </span>
                      <span className="text-xs font-mono text-theme-text-muted bg-theme-elevated px-2 py-0.5 rounded border border-theme-border font-medium">
                        {entropy.bits} bits • {entropy.crackTimeDisplay}
                      </span>
                    </div>
                    <span className="text-sm sm:text-base font-mono text-theme-text block break-all tracking-wider font-medium select-all">
                      {showPassword ? entry.password : '••••••••••••••••'}
                    </span>
                    <div className="h-1.5 w-36 bg-theme-hover rounded-full overflow-hidden flex gap-1 mt-2.5">
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
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-2 rounded-xl bg-theme-elevated hover:bg-theme-hover text-theme-text-muted hover:text-theme-text border border-theme-border transition-colors cursor-pointer"
                    title={showPassword ? 'Hide Password' : 'Show Password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleCopy(entry.password, 'Password')}
                    className="p-2 rounded-xl bg-theme-elevated hover:bg-theme-hover text-theme-text-muted hover:text-theme-text border border-theme-border transition-colors cursor-pointer"
                    title="Copy Password"
                  >
                    {copiedField === 'Password' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {entry.url && (
            <div className="flex items-center justify-between group pt-3.5 border-t border-theme-border">
              <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                <Globe className="w-4.5 h-4.5 text-purple-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block mb-0.5">Website</span>
                  <span
                    className="text-sm font-mono text-purple-400 truncate block hover:underline cursor-pointer"
                    onClick={() => handleOpenUrl()}
                  >
                    {entry.url}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleOpenUrl()}
                className="p-2 rounded-xl bg-theme-elevated hover:bg-theme-hover text-theme-text border border-theme-border transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer shrink-0"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open</span>
              </button>
            </div>
          )}
        </div>

        {entry.notes && (
          <div className="bg-theme-surface border border-theme-border rounded-2xl p-4 sm:p-5 space-y-2 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">Notes</h3>
            <p className="text-sm text-theme-text whitespace-pre-wrap leading-relaxed bg-theme-elevated p-4 rounded-xl border border-theme-border font-mono">
              {entry.notes}
            </p>
          </div>
        )}

        {renderCustomFields()}
        {renderMetadata()}
      </div>
    );
  };

  // 2. SECURE NOTE DETAIL
  const renderSecureNoteDetail = () => (
    <div className="space-y-4">
      <div className="bg-theme-surface border border-theme-border rounded-2xl p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between border-b border-theme-border pb-2.5">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">
              Private Note Content
            </span>
          </div>
          <button
            onClick={() => handleCopy(entry.notes, 'Note Content')}
            className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 p-1 cursor-pointer"
          >
            {copiedField === 'Note Content' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Copy Full Note</span>
          </button>
        </div>

        <div className="p-4 rounded-xl bg-theme-elevated border border-theme-border font-mono text-sm leading-relaxed text-theme-text whitespace-pre-wrap select-text">
          {entry.notes || <span className="italic text-theme-text-muted">Note is empty.</span>}
        </div>
      </div>

      {renderCustomFields()}
      {renderMetadata()}
    </div>
  );

  // 3. AUTHENTICATOR DETAIL
  const renderAuthenticatorDetail = () => (
    <div className="space-y-4">
      {entry.totp_secret && (
        <TotpViewer secret={entry.totp_secret} onCopy={handleCopy} />
      )}

      <div className="bg-theme-surface border border-theme-border rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
        {entry.totp_issuer && (
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block mb-0.5">
                Service / Issuer
              </span>
              <span className="text-base font-semibold text-theme-text">{entry.totp_issuer}</span>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 font-medium">
              2FA Active
            </span>
          </div>
        )}

        {entry.username && (
          <div className="flex items-center justify-between pt-3 border-t border-theme-border">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block mb-0.5">
                Account
              </span>
              <span className="text-sm font-mono text-theme-text">{entry.username}</span>
            </div>
            <button
              onClick={() => handleCopy(entry.username, 'Account')}
              className="p-2 rounded-xl bg-theme-elevated hover:bg-theme-hover text-theme-text-muted hover:text-theme-text border border-theme-border cursor-pointer"
            >
              {copiedField === 'Account' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        )}

        {entry.totp_secret && (
          <div className="pt-3 border-t border-theme-border">
            <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block mb-1">
              Secret Key
            </span>
            <div className="flex items-center justify-between p-3 rounded-xl bg-theme-elevated border border-theme-border">
              <span className="font-mono text-xs text-theme-text select-all truncate pr-3">
                {showPassword ? entry.totp_secret : '••••••••••••••••••••••••'}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1.5 rounded-lg text-theme-text-muted hover:text-theme-text hover:bg-theme-hover cursor-pointer"
                  title={showPassword ? 'Hide Secret' : 'Reveal Secret'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleCopy(entry.totp_secret!, 'Secret Key')}
                  className="p-1.5 rounded-lg text-theme-text-muted hover:text-theme-text hover:bg-theme-hover cursor-pointer"
                  title="Copy Secret"
                >
                  {copiedField === 'Secret Key' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2 text-xs font-mono text-theme-text-dim">
              <span>Algo: {entry.totp_algorithm || 'SHA1'}</span>
              <span>•</span>
              <span>Digits: {entry.totp_digits || 6}</span>
              <span>•</span>
              <span>Period: {entry.totp_period || 30}s</span>
            </div>
          </div>
        )}
      </div>

      {entry.notes && (
        <div className="bg-theme-surface border border-theme-border rounded-2xl p-4 sm:p-5 space-y-2 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">
            Backup Recovery Codes
          </h3>
          <p className="text-sm text-theme-text whitespace-pre-wrap leading-relaxed bg-theme-elevated p-4 rounded-xl border border-theme-border font-mono">
            {entry.notes}
          </p>
        </div>
      )}

      {renderCustomFields()}
      {renderMetadata()}
    </div>
  );

  // 4. CARD DETAIL
  const renderCardDetail = () => {
    const rawCardNum = entry.card_number || entry.password || '';
    const formattedNum = rawCardNum.replace(/\s+/g, '').replace(/(\d{4})/g, '$1 ').trim();
    const maskedNum = formattedNum
      ? `•••• •••• •••• ${formattedNum.slice(-4)}`
      : '•••• •••• •••• ••••';

    return (
      <div className="space-y-4">
        {/* Visual Realistic Payment Card */}
        <div className="relative rounded-2xl p-5 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-500/30 shadow-xl overflow-hidden min-h-[190px] flex flex-col justify-between select-none">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-indigo-400" />
              <span className="font-bold text-xs uppercase tracking-widest text-indigo-300">
                {entry.card_type || 'Payment Card'}
              </span>
            </div>
            <span className="font-mono text-xs text-slate-400 uppercase tracking-widest">
              TotumVault
            </span>
          </div>

          <div className="my-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-lg sm:text-xl font-bold tracking-widest select-all">
                {showCardNumber ? formattedNum : maskedNum}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowCardNumber(!showCardNumber)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title={showCardNumber ? 'Hide Card Number' : 'Reveal Card Number'}
                >
                  {showCardNumber ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleCopy(rawCardNum.replace(/\s+/g, ''), 'Card Number')}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Copy Card Number"
                >
                  {copiedField === 'Card Number' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-end justify-between text-xs font-mono pt-2 border-t border-white/10">
            <div>
              <span className="text-[10px] text-slate-400 uppercase block tracking-wider">Cardholder</span>
              <span className="font-semibold uppercase tracking-wide">
                {entry.cardholder_name || entry.username || 'Cardholder'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block tracking-wider">Expires</span>
              <span className="font-semibold">
                {entry.card_exp_month ? `${entry.card_exp_month}/${entry.card_exp_year || 'YY'}` : '••/••'}
              </span>
            </div>
          </div>
        </div>

        {/* Security Codes Details */}
        <div className="bg-theme-surface border border-theme-border rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">
            Security Codes
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {entry.card_cvv && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-theme-elevated border border-theme-border">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-theme-text-muted block">
                    CVV / CVC
                  </span>
                  <span className="text-sm font-mono font-bold text-theme-text">
                    {showCvv ? entry.card_cvv : '•••'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowCvv(!showCvv)}
                    className="p-1 rounded text-theme-text-muted hover:text-theme-text cursor-pointer"
                  >
                    {showCvv ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleCopy(entry.card_cvv!, 'CVV')}
                    className="p-1 rounded text-theme-text-muted hover:text-theme-text cursor-pointer"
                  >
                    {copiedField === 'CVV' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {entry.card_pin && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-theme-elevated border border-theme-border">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-theme-text-muted block">
                    Card PIN
                  </span>
                  <span className="text-sm font-mono font-bold text-theme-text">
                    {showPin ? entry.card_pin : '••••'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowPin(!showPin)}
                    className="p-1 rounded text-theme-text-muted hover:text-theme-text cursor-pointer"
                  >
                    {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleCopy(entry.card_pin!, 'PIN')}
                    className="p-1 rounded text-theme-text-muted hover:text-theme-text cursor-pointer"
                  >
                    {copiedField === 'PIN' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {entry.card_billing_address && (
            <div className="pt-3 border-t border-theme-border">
              <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block mb-1">
                Billing Address
              </span>
              <div className="flex items-start justify-between p-3 rounded-xl bg-theme-elevated border border-theme-border">
                <span className="text-sm text-theme-text whitespace-pre-wrap flex-1 pr-3">
                  {entry.card_billing_address}
                </span>
                <button
                  onClick={() => handleCopy(entry.card_billing_address!, 'Billing Address')}
                  className="p-1.5 rounded-lg text-theme-text-muted hover:text-theme-text hover:bg-theme-hover cursor-pointer"
                >
                  {copiedField === 'Billing Address' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {entry.notes && (
          <div className="bg-theme-surface border border-theme-border rounded-2xl p-4 sm:p-5 space-y-2 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">Notes</h3>
            <p className="text-sm text-theme-text whitespace-pre-wrap leading-relaxed bg-theme-elevated p-4 rounded-xl border border-theme-border font-mono">
              {entry.notes}
            </p>
          </div>
        )}

        {renderCustomFields()}
        {renderMetadata()}
      </div>
    );
  };

  // 5. LICENSE DETAIL
  const renderLicenseDetail = () => {
    const key = entry.license_key || entry.password || '';

    return (
      <div className="space-y-4">
        {/* Hero License Key Block */}
        <div className="bg-theme-surface border border-theme-border rounded-2xl p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-theme-border pb-2.5">
            <div className="flex items-center gap-2">
              <Scroll className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">
                Software License Key
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowLicenseKey(!showLicenseKey)}
                className="p-1.5 rounded-lg text-theme-text-muted hover:text-theme-text hover:bg-theme-hover cursor-pointer"
                title={showLicenseKey ? 'Hide Key' : 'Reveal Key'}
              >
                {showLicenseKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                onClick={() => handleCopy(key, 'License Key')}
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-600/15 text-amber-400 border border-amber-500/30 hover:bg-amber-600/25 transition-colors cursor-pointer"
              >
                {copiedField === 'License Key' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy Key</span>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-theme-elevated border border-theme-border font-mono text-sm leading-relaxed text-theme-text select-all break-all">
            {showLicenseKey ? key : '••••••••-••••••••-••••••••-••••••••'}
          </div>
        </div>

        {/* License Metadata */}
        <div className="bg-theme-surface border border-theme-border rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block mb-0.5">
                Publisher / Vendor
              </span>
              <span className="text-sm font-semibold text-theme-text">
                {entry.license_vendor || entry.username || 'Not specified'}
              </span>
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block mb-0.5">
                Version / Edition
              </span>
              <span className="text-sm font-mono text-theme-text">
                {entry.license_version || 'Latest'}
              </span>
            </div>

            {entry.license_purchase_date && (
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block mb-0.5">
                  Purchased
                </span>
                <span className="text-sm font-mono text-theme-text">{entry.license_purchase_date}</span>
              </div>
            )}

            {entry.license_expires_at && (
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block mb-0.5">
                  Expires
                </span>
                <span className="text-sm font-mono text-theme-text">{entry.license_expires_at}</span>
              </div>
            )}
          </div>

          {entry.url && (
            <div className="pt-3 border-t border-theme-border flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block mb-0.5">
                  Vendor Website
                </span>
                <span
                  className="text-sm font-mono text-purple-400 hover:underline cursor-pointer truncate block"
                  onClick={() => handleOpenUrl()}
                >
                  {entry.url}
                </span>
              </div>
              <button
                onClick={() => handleOpenUrl()}
                className="p-2 rounded-xl bg-theme-elevated hover:bg-theme-hover text-theme-text border border-theme-border flex items-center gap-1.5 text-xs font-semibold cursor-pointer shrink-0"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Visit</span>
              </button>
            </div>
          )}
        </div>

        {entry.notes && (
          <div className="bg-theme-surface border border-theme-border rounded-2xl p-4 sm:p-5 space-y-2 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">Notes</h3>
            <p className="text-sm text-theme-text whitespace-pre-wrap leading-relaxed bg-theme-elevated p-4 rounded-xl border border-theme-border font-mono">
              {entry.notes}
            </p>
          </div>
        )}

        {renderCustomFields()}
        {renderMetadata()}
      </div>
    );
  };

  // 6. SERVER DETAIL
  const renderServerDetail = () => {
    const host = entry.server_host || entry.url || '';
    const port = entry.server_port || '22';
    const user = entry.username || 'root';
    const proto = (entry.server_protocol || 'ssh').toUpperCase();
    const connStr = `${user}@${host}${port !== '22' ? ` -p ${port}` : ''}`;

    return (
      <div className="space-y-4">
        {/* Connection Header Card */}
        <div className="bg-theme-surface border border-theme-border rounded-2xl p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-purple-600/15 text-purple-400 border border-purple-500/30 uppercase font-mono">
                {proto}
              </span>
              <span className="font-mono text-base sm:text-lg font-bold text-theme-text">
                {host}:{port}
              </span>
            </div>
            {entry.server_environment && (
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-theme-elevated text-theme-text-muted border border-theme-border">
                {entry.server_environment}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-theme-elevated border border-theme-border font-mono text-xs">
            <span className="text-theme-text truncate pr-2">{connStr}</span>
            <button
              onClick={() => handleCopy(connStr, 'Connection String')}
              className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-theme-hover text-theme-text cursor-pointer shrink-0"
            >
              {copiedField === 'Connection String' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy</span>
            </button>
          </div>
        </div>

        {/* Authentication Card */}
        <div className="bg-theme-surface border border-theme-border rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">
            Authentication
          </h3>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block mb-0.5">
                Username
              </span>
              <span className="text-sm font-mono text-theme-text font-medium">{user}</span>
            </div>
            <button
              onClick={() => handleCopy(user, 'Username')}
              className="p-2 rounded-xl bg-theme-elevated hover:bg-theme-hover text-theme-text-muted hover:text-theme-text border border-theme-border cursor-pointer"
            >
              {copiedField === 'Username' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {entry.password && (
            <div className="pt-3 border-t border-theme-border flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block mb-0.5">
                  Password
                </span>
                <span className="text-sm font-mono text-theme-text font-medium">
                  {showPassword ? entry.password : '••••••••••••••••'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-2 rounded-xl bg-theme-elevated hover:bg-theme-hover text-theme-text-muted hover:text-theme-text border border-theme-border cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleCopy(entry.password, 'Password')}
                  className="p-2 rounded-xl bg-theme-elevated hover:bg-theme-hover text-theme-text-muted hover:text-theme-text border border-theme-border cursor-pointer"
                >
                  {copiedField === 'Password' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {entry.server_key && (
            <div className="pt-3 border-t border-theme-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">
                  SSH Private Key
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowSshKey(!showSshKey)}
                    className="p-1 rounded text-theme-text-muted hover:text-theme-text cursor-pointer"
                  >
                    {showSshKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleCopy(entry.server_key!, 'SSH Key')}
                    className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-purple-600/15 text-purple-400 border border-purple-500/30 cursor-pointer"
                  >
                    {copiedField === 'SSH Key' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy Key</span>
                  </button>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-theme-elevated border border-theme-border font-mono text-xs text-theme-text whitespace-pre-wrap max-h-36 overflow-y-auto">
                {showSshKey ? entry.server_key : '-----BEGIN OPENSSH PRIVATE KEY-----\n••••••••••••••••••••••••••••••••••••••••\n-----END OPENSSH PRIVATE KEY-----'}
              </div>
            </div>
          )}
        </div>

        {entry.notes && (
          <div className="bg-theme-surface border border-theme-border rounded-2xl p-4 sm:p-5 space-y-2 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">Access Notes</h3>
            <p className="text-sm text-theme-text whitespace-pre-wrap leading-relaxed bg-theme-elevated p-4 rounded-xl border border-theme-border font-mono">
              {entry.notes}
            </p>
          </div>
        )}

        {renderCustomFields()}
        {renderMetadata()}
      </div>
    );
  };

  // 7. API CREDENTIAL DETAIL
  const renderApiCredentialDetail = () => {
    const key = entry.api_key || entry.username || '';
    const secret = entry.api_secret || entry.password || '';

    return (
      <div className="space-y-4">
        {/* Service Header */}
        <div className="bg-theme-surface border border-theme-border rounded-2xl p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-rose-400" />
              <span className="text-sm font-semibold text-theme-text">{entry.title}</span>
            </div>
            {entry.api_environment && (
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-rose-600/15 text-rose-400 border border-rose-500/30">
                {entry.api_environment}
              </span>
            )}
          </div>

          {entry.url && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-theme-elevated border border-theme-border font-mono text-xs">
              <span className="text-theme-text truncate pr-2">{entry.url}</span>
              <button
                onClick={() => handleCopy(entry.url, 'Endpoint URL')}
                className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-theme-hover text-theme-text cursor-pointer shrink-0"
              >
                {copiedField === 'Endpoint URL' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy</span>
              </button>
            </div>
          )}
        </div>

        {/* Keys & Tokens */}
        <div className="bg-theme-surface border border-theme-border rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">
            Keys & Tokens
          </h3>

          {key && (
            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block">
                API Key / Public Token
              </span>
              <div className="flex items-center justify-between p-3 rounded-xl bg-theme-elevated border border-theme-border font-mono text-xs">
                <span className="text-theme-text select-all truncate pr-2">
                  {showApiKey ? key : '••••••••••••••••••••••••'}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="p-1 rounded text-theme-text-muted hover:text-theme-text cursor-pointer"
                  >
                    {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleCopy(key, 'API Key')}
                    className="p-1 rounded text-theme-text-muted hover:text-theme-text cursor-pointer"
                  >
                    {copiedField === 'API Key' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {secret && (
            <div className="space-y-1.5 pt-2 border-t border-theme-border">
              <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block">
                API Secret / Token
              </span>
              <div className="flex items-center justify-between p-3 rounded-xl bg-theme-elevated border border-theme-border font-mono text-xs">
                <span className="text-theme-text select-all truncate pr-2">
                  {showApiSecret ? secret : '••••••••••••••••••••••••••••••••'}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setShowApiSecret(!showApiSecret)}
                    className="p-1 rounded text-theme-text-muted hover:text-theme-text cursor-pointer"
                  >
                    {showApiSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleCopy(secret, 'API Secret')}
                    className="p-1 rounded text-theme-text-muted hover:text-theme-text cursor-pointer"
                  >
                    {copiedField === 'API Secret' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {entry.api_client_id && (
            <div className="space-y-1.5 pt-2 border-t border-theme-border">
              <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block">
                OAuth Client ID
              </span>
              <div className="flex items-center justify-between p-3 rounded-xl bg-theme-elevated border border-theme-border font-mono text-xs">
                <span className="text-theme-text select-all truncate pr-2">{entry.api_client_id}</span>
                <button
                  onClick={() => handleCopy(entry.api_client_id!, 'Client ID')}
                  className="p-1 rounded text-theme-text-muted hover:text-theme-text cursor-pointer"
                >
                  {copiedField === 'Client ID' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {entry.notes && (
          <div className="bg-theme-surface border border-theme-border rounded-2xl p-4 sm:p-5 space-y-2 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">Usage Notes</h3>
            <p className="text-sm text-theme-text whitespace-pre-wrap leading-relaxed bg-theme-elevated p-4 rounded-xl border border-theme-border font-mono">
              {entry.notes}
            </p>
          </div>
        )}

        {renderCustomFields()}
        {renderMetadata()}
      </div>
    );
  };

  const renderContentByCategory = () => {
    switch (entry.category) {
      case 'secure_notes':
        return renderSecureNoteDetail();
      case 'totp':
        return renderAuthenticatorDetail();
      case 'cards':
        return renderCardDetail();
      case 'licenses':
        return renderLicenseDetail();
      case 'servers':
        return renderServerDetail();
      case 'api_credentials':
        return renderApiCredentialDetail();
      case 'logins':
      default:
        return renderLoginDetail();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-theme-bg overflow-y-auto select-none">
      {/* Top Header */}
      <div className="p-3.5 sm:p-5 border-b border-theme-border flex flex-wrap items-center justify-between gap-3 bg-theme-surface/60 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setSelectedEntryId(null)}
            className="md:hidden flex items-center gap-1 px-3 py-2 rounded-xl bg-theme-elevated hover:bg-theme-hover border border-theme-border text-theme-text transition-colors cursor-pointer shrink-0 shadow-sm"
            title="Back to item list"
          >
            <ChevronLeft className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold">Back</span>
          </button>

          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-theme-elevated border border-theme-border flex items-center justify-center shadow-md shrink-0">
            {getCategoryIcon(entry.category)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-theme-text tracking-wide truncate">
                {entry.title}
              </h2>
              <button
                onClick={toggleFavorite}
                className="p-1 rounded-lg hover:bg-theme-hover text-theme-text-muted transition-colors cursor-pointer shrink-0"
                title={entry.favorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star
                  className={`w-4 h-4 ${
                    entry.favorite ? 'fill-amber-400 text-amber-400' : 'text-slate-400'
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-theme-text-muted font-medium">
                {getCategoryLabel(entry.category)}
              </span>
              {entry.tags && entry.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {entry.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-theme-elevated border border-theme-border text-theme-text-muted font-medium"
                    >
                      <Tag className="w-3 h-3 text-theme-text-dim" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button
            onClick={() => openEditor(entry)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-theme-surface hover:bg-theme-hover border border-theme-border text-theme-text text-xs font-semibold transition-colors cursor-pointer"
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit</span>
          </button>
          <button
            onClick={() => {
              if (confirm(`Are you sure you want to delete '${entry.title}'?`)) {
                deleteEntry(entry.id);
                setSelectedEntryId(null);
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 sm:p-6 max-w-3xl pb-28 md:pb-8">
        {renderContentByCategory()}
      </div>
    </div>
  );
};
