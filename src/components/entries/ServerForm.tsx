import React, { useState } from 'react';
import { Network, Key, Terminal } from 'lucide-react';
import { DecryptedEntry, CustomField, CategoryType } from '../../types';
import { EntryFormShell } from './shared/EntryFormShell';
import { PasswordField } from './shared/PasswordField';
import { TagEditor } from './shared/TagEditor';
import { CustomFieldsEditor } from './shared/CustomFieldsEditor';
import { FormSection } from './shared/FormSection';

interface ServerFormProps {
  initialData: DecryptedEntry | null;
  onSave: (entry: DecryptedEntry) => void;
  onClose: () => void;
  onCategoryChange: (cat: CategoryType) => void;
  onGeneratePassword: () => Promise<string>;
}

export const ServerForm: React.FC<ServerFormProps> = ({
  initialData,
  onSave,
  onClose,
  onCategoryChange,
  onGeneratePassword,
}) => {
  const [name, setName] = useState(initialData?.title || '');
  const [host, setHost] = useState(initialData?.server_host || initialData?.url || '');
  const [port, setPort] = useState(initialData?.server_port || '22');
  const [protocol, setProtocol] = useState(initialData?.server_protocol || 'ssh');
  const [username, setUsername] = useState(initialData?.username || 'root');
  const [password, setPassword] = useState(initialData?.password || '');
  const [sshKey, setSshKey] = useState(initialData?.server_key || '');
  const [environment, setEnvironment] = useState(initialData?.server_environment || 'Production');
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
    if (!name.trim()) return;

    const entryToSave: DecryptedEntry = {
      id: initialData ? initialData.id : '',
      title: name.trim(),
      username: username.trim(),
      email: '',
      password,
      url: host.trim(),
      notes: notes.trim(),
      category: 'servers',
      favorite,
      tags,
      custom_fields: customFields.filter((f) => f.name.trim()),
      server_host: host.trim(),
      server_port: port.trim(),
      server_protocol: protocol,
      server_key: sshKey.trim(),
      server_environment: environment,
      created_at: initialData ? initialData.created_at : '',
      updated_at: '',
    };

    onSave(entryToSave);
  };

  return (
    <EntryFormShell
      title={name || 'Server'}
      isEditing={Boolean(initialData)}
      category="servers"
      onCategoryChange={onCategoryChange}
      favorite={favorite}
      onFavoriteToggle={() => setFavorite(!favorite)}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitDisabled={!name.trim()}
    >
      {/* Name & Environment */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1.5">
            Server Name <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Prod Bastion, US-East K8s Node, Database Primary..."
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
            <option value="Staging">Staging</option>
            <option value="Development">Development</option>
            <option value="Testing">Testing</option>
          </select>
        </div>
      </div>

      {/* Connection Group */}
      <FormSection title="Connection" icon={<Network className="w-3.5 h-3.5 text-purple-400" />}>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-1">
            <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1.5">
              Protocol
            </label>
            <select
              value={protocol}
              onChange={(e) => setProtocol(e.target.value)}
              className="w-full input-themed rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none uppercase font-mono"
            >
              <option value="ssh">SSH</option>
              <option value="sftp">SFTP</option>
              <option value="https">HTTPS</option>
              <option value="rdp">RDP</option>
              <option value="vnc">VNC</option>
              <option value="mysql">MySQL</option>
              <option value="postgres">PostgreSQL</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1.5">
              Hostname / IP Address
            </label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="192.168.1.100 or server.company.internal"
              className="w-full input-themed rounded-xl px-3.5 py-2.5 text-sm placeholder-slate-400 focus:outline-none font-mono"
            />
          </div>

          <div className="sm:col-span-1">
            <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1.5">
              Port
            </label>
            <input
              type="text"
              value={port}
              onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))}
              placeholder="22"
              className="w-full input-themed rounded-xl px-3 py-2.5 text-sm placeholder-slate-400 focus:outline-none font-mono text-center"
            />
          </div>
        </div>
      </FormSection>

      {/* Authentication Group */}
      <FormSection title="Authentication" icon={<Key className="w-3.5 h-3.5 text-purple-500" />}>
        <div>
          <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1.5">
            Username / Login
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="root, ubuntu, admin..."
            className="w-full input-themed rounded-xl px-3.5 py-2.5 text-sm placeholder-slate-400 focus:outline-none font-mono"
          />
        </div>

        <PasswordField
          value={password}
          onChange={setPassword}
          onGenerate={handleGenerate}
          label="Server Password / Passphrase"
          placeholder="Server password..."
        />

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-purple-400" />
            <span>SSH Private Key or Key Path</span>
          </label>
          <textarea
            rows={3}
            value={sshKey}
            onChange={(e) => setSshKey(e.target.value)}
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY----- or ~/.ssh/id_ed25519"
            className="w-full input-themed rounded-xl px-3.5 py-2.5 text-xs font-mono placeholder-slate-400 focus:outline-none resize-y"
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
          Server Notes & Access Instructions
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Firewall rules, VPN required, jumpbox configuration..."
          className="w-full input-themed rounded-xl px-3.5 py-2 text-sm placeholder-slate-400 focus:outline-none font-mono resize-y"
        />
      </div>
    </EntryFormShell>
  );
};
