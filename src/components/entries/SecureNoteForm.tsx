import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import { DecryptedEntry, CustomField, CategoryType } from '../../types';
import { EntryFormShell } from './shared/EntryFormShell';
import { TagEditor } from './shared/TagEditor';
import { CustomFieldsEditor } from './shared/CustomFieldsEditor';

interface SecureNoteFormProps {
  initialData: DecryptedEntry | null;
  onSave: (entry: DecryptedEntry) => void;
  onClose: () => void;
  onCategoryChange: (cat: CategoryType) => void;
}

export const SecureNoteForm: React.FC<SecureNoteFormProps> = ({
  initialData,
  onSave,
  onClose,
  onCategoryChange,
}) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [favorite, setFavorite] = useState(initialData?.favorite || false);
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [customFields, setCustomFields] = useState<CustomField[]>(initialData?.custom_fields || []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const entryToSave: DecryptedEntry = {
      id: initialData ? initialData.id : '',
      title: title.trim(),
      username: '',
      email: '',
      password: '',
      url: '',
      notes,
      category: 'secure_notes',
      favorite,
      tags,
      custom_fields: customFields.filter((f) => f.name.trim()),
      created_at: initialData ? initialData.created_at : '',
      updated_at: '',
    };

    onSave(entryToSave);
  };

  return (
    <EntryFormShell
      title={title || 'Secure Note'}
      isEditing={Boolean(initialData)}
      category="secure_notes"
      onCategoryChange={onCategoryChange}
      favorite={favorite}
      onFavoriteToggle={() => setFavorite(!favorite)}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitDisabled={!title.trim()}
    >
      {/* Title */}
      <div>
        <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1.5">
          Note Title <span className="text-rose-400">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. WiFi Passwords, Passport Info, Recovery Phrases..."
          required
          autoFocus
          className="w-full input-themed rounded-xl px-3.5 py-2.5 text-sm placeholder-slate-400 focus:outline-none font-medium"
        />
      </div>

      {/* Large Comfortable Note Area */}
      <div className="space-y-1.5 flex-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>Encrypted Note Content</span>
          </label>
          <span className="text-[11px] text-theme-text-dim font-mono">
            {notes.length} characters
          </span>
        </div>
        <textarea
          rows={9}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Type or paste confidential notes, secrets, cryptographic seed phrases, or private documents here..."
          className="w-full input-themed rounded-xl p-4 text-sm placeholder-slate-400 focus:outline-none font-mono resize-y leading-relaxed"
        />
      </div>

      {/* Tags */}
      <TagEditor tags={tags} onChange={setTags} />

      {/* Optional Metadata / Custom Fields */}
      <CustomFieldsEditor fields={customFields} onChange={setCustomFields} />
    </EntryFormShell>
  );
};
