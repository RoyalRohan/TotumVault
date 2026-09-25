import React, { useState } from 'react';
import { Globe, Key } from 'lucide-react';
import { DecryptedEntry, CustomField, CategoryType } from '../../types';
import { EntryFormShell } from './shared/EntryFormShell';
import { SecretInput } from './shared/SecretInput';
import { TagEditor } from './shared/TagEditor';
import { CustomFieldsEditor } from './shared/CustomFieldsEditor';
import { FormSection } from './shared/FormSection';

interface LicenseFormProps {
  initialData: DecryptedEntry | null;
  onSave: (entry: DecryptedEntry) => void;
  onClose: () => void;
  onCategoryChange: (cat: CategoryType) => void;
}

export const LicenseForm: React.FC<LicenseFormProps> = ({
  initialData,
  onSave,
  onClose,
  onCategoryChange,
}) => {
  const [productName, setProductName] = useState(initialData?.title || '');
  const [licenseKey, setLicenseKey] = useState(initialData?.license_key || initialData?.password || '');
  const [vendor, setVendor] = useState(initialData?.license_vendor || initialData?.username || '');
  const [version, setVersion] = useState(initialData?.license_version || '');
  const [purchaseDate, setPurchaseDate] = useState(initialData?.license_purchase_date || '');
  const [expiresAt, setExpiresAt] = useState(initialData?.license_expires_at || '');
  const [vendorUrl, setVendorUrl] = useState(initialData?.url || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [favorite, setFavorite] = useState(initialData?.favorite || false);
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [customFields, setCustomFields] = useState<CustomField[]>(initialData?.custom_fields || []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) return;

    const entryToSave: DecryptedEntry = {
      id: initialData ? initialData.id : '',
      title: productName.trim(),
      username: vendor.trim(),
      email: '',
      password: '',
      url: vendorUrl.trim(),
      notes: notes.trim(),
      category: 'licenses',
      favorite,
      tags,
      custom_fields: customFields.filter((f) => f.name.trim()),
      license_key: licenseKey.trim(),
      license_vendor: vendor.trim(),
      license_version: version.trim(),
      license_purchase_date: purchaseDate.trim(),
      license_expires_at: expiresAt.trim(),
      created_at: initialData ? initialData.created_at : '',
      updated_at: '',
    };

    onSave(entryToSave);
  };

  return (
    <EntryFormShell
      title={productName || 'Software License'}
      isEditing={Boolean(initialData)}
      category="licenses"
      onCategoryChange={onCategoryChange}
      favorite={favorite}
      onFavoriteToggle={() => setFavorite(!favorite)}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitDisabled={!productName.trim()}
    >
      {/* Product Name & Vendor */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1.5">
            Software / Product Name <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="e.g. JetBrains All Products, Windows 11 Pro, Figma..."
            required
            autoFocus
            className="w-full input-themed rounded-xl px-3.5 py-2.5 text-sm placeholder-slate-400 focus:outline-none font-medium"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1.5">
            Publisher / Vendor
          </label>
          <input
            type="text"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="e.g. Microsoft, JetBrains, Adobe..."
            className="w-full input-themed rounded-xl px-3.5 py-2.5 text-sm placeholder-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {/* License Key Hero Field */}
      <FormSection title="Activation Details" icon={<Key className="w-3.5 h-3.5 stroke-[1.75] text-purple-600 dark:text-purple-400" />}>
        <SecretInput
          label="License Key / Serial Number"
          value={licenseKey}
          onChange={setLicenseKey}
          placeholder="XXXXX-XXXXX-XXXXX-XXXXX or activation code..."
          copyLabel="License Key"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1.5">
              Version / Edition
            </label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g. v2024.1, Enterprise"
              className="w-full input-themed rounded-xl px-3.5 py-2 text-sm placeholder-slate-400 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1.5">
              Purchase Date
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full input-themed rounded-xl px-3.5 py-2 text-sm placeholder-slate-400 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1.5">
              Expiration Date
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full input-themed rounded-xl px-3.5 py-2 text-sm placeholder-slate-400 focus:outline-none font-mono"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 stroke-[1.75] text-purple-600 dark:text-purple-400" />
            <span>Vendor Website / Download URL</span>
          </label>
          <input
            type="text"
            value={vendorUrl}
            onChange={(e) => setVendorUrl(e.target.value)}
            placeholder="https://vendor.com/download or portal"
            className="w-full input-themed rounded-xl px-3.5 py-2 text-sm placeholder-slate-400 focus:outline-none font-mono"
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
          Registration & Activation Notes
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Registered email, activation instructions, seat limit..."
          className="w-full input-themed rounded-xl px-3.5 py-2.5 text-sm placeholder-slate-400 focus:outline-none font-mono resize-y"
        />
      </div>
    </EntryFormShell>
  );
};
