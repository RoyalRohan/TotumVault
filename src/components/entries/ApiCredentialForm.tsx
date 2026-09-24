import React, { useState } from 'react';
import { Globe, Key, Shield } from 'lucide-react';
import { DecryptedEntry, CustomField, CategoryType } from '../../types';
import { EntryFormShell } from './shared/EntryFormShell';
import { SecretInput } from './shared/SecretInput';
import { TagEditor } from './shared/TagEditor';
import { CustomFieldsEditor } from './shared/CustomFieldsEditor';
import { FormSection } from './shared/FormSection';

interface ApiCredentialFormProps {
  initialData: DecryptedEntry | null;
  onSave: (entry: DecryptedEntry) => void;
  onClose: () => void;
  onCategoryChange: (cat: CategoryType) => void;
}

export const ApiCredentialForm: React.FC<ApiCredentialFormProps> = ({
  initialData,
  onSave,
  onClose,
  onCategoryChange,
}) => {
  const [serviceName, setServiceName] = useState(initialData?.title || '');
  const [endpoint, setEndpoint] = useState(initialData?.url || '');
  const [apiKey, setApiKey] = useState(initialData?.api_key || initialData?.username || '');
  const [apiSecret, setApiSecret] = useState(initialData?.api_secret || initialData?.password || '');
  const [clientId, setClientId] = useState(initialData?.api_client_id || '');
  const [clientSecret, setClientSecret] = useState(initialData?.api_client_secret || '');
  const [environment, setEnvironment] = useState(initialData?.api_environment || 'Production');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [favorite, setFavorite] = useState(initialData?.favorite || false);
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [customFields, setCustomFields] = useState<CustomField[]>(initialData?.custom_fields || []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName.trim()) return;

    const entryToSave: DecryptedEntry = {
      id: initialData ? initialData.id : '',
      title: serviceName.trim(),
      username: apiKey.trim(),
      email: '',
      password: apiSecret,
      url: endpoint.trim(),
      notes: notes.trim(),
      category: 'api_credentials',
      favorite,
      tags,
      custom_fields: customFields.filter((f) => f.name.trim()),
      api_key: apiKey.trim(),
      api_secret: apiSecret,
      api_client_id: clientId.trim(),
      api_client_secret: clientSecret,
      api_environment: environment,
      created_at: initialData ? initialData.created_at : '',
      updated_at: '',
    };

    onSave(entryToSave);
  };

  return (
    <EntryFormShell
      title={serviceName || 'API Credential'}
      isEditing={Boolean(initialData)}
      category="api_credentials"
      onCategoryChange={onCategoryChange}
      favorite={favorite}
      onFavoriteToggle={() => setFavorite(!favorite)}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitDisabled={!serviceName.trim()}
    >
      {/* Service Name & Environment */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1.5">
            Service / API Name <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            placeholder="e.g. Stripe, OpenAI, Twilio, AWS IAM..."
            required
            autoFocus
            className="w-full input-themed rounded-xl px-3.5 py-2.5 text-sm placeholder-slate-400 focus:outline-none font-medium"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1.5">
            Environment
          </label>
          <select
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            className="w-full input-themed rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none"
          >
            <option value="Production">Production</option>
            <option value="Sandbox">Sandbox / Test</option>
            <option value="Staging">Staging</option>
            <option value="Development">Development</option>
          </select>
        </div>
      </div>

      {/* Base Endpoint */}
      <div>
        <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-purple-400" />
          <span>Base Endpoint URL</span>
        </label>
        <input
          type="text"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder="https://api.service.com/v1"
          className="w-full input-themed rounded-xl px-3.5 py-2.5 text-sm placeholder-slate-400 focus:outline-none font-mono"
        />
      </div>

      {/* API Key & Token Group */}
      <FormSection title="API Keys & Tokens" icon={<Key className="w-3.5 h-3.5 text-rose-400" />}>
        <SecretInput
          label="API Key / Public Token"
          value={apiKey}
          onChange={setApiKey}
          placeholder="pk_live_... or API key"
          copyLabel="API Key"
        />

        <SecretInput
          label="API Secret / Bearer Token"
          value={apiSecret}
          onChange={setApiSecret}
          placeholder="sk_live_... or Secret token"
          copyLabel="API Secret"
        />
      </FormSection>

      {/* OAuth / Client Credentials */}
      <FormSection title="OAuth 2.0 / Client Credentials (Optional)" icon={<Shield className="w-3.5 h-3.5 text-rose-500" />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SecretInput
            label="Client ID"
            value={clientId}
            onChange={setClientId}
            placeholder="client_id_..."
            copyLabel="Client ID"
          />

          <SecretInput
            label="Client Secret"
            value={clientSecret}
            onChange={setClientSecret}
            placeholder="client_secret_..."
            copyLabel="Client Secret"
          />
        </div>
      </FormSection>

      {/* Tags */}
      <TagEditor tags={tags} onChange={setTags} />

      {/* Custom Fields */}
      <CustomFieldsEditor fields={customFields} onChange={setCustomFields} />

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block">
          Usage Notes & Rate Limits
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Header formats, scopes granted, rate limit quotas..."
          className="w-full input-themed rounded-xl px-3.5 py-2 text-sm placeholder-slate-400 focus:outline-none font-mono resize-y"
        />
      </div>
    </EntryFormShell>
  );
};
