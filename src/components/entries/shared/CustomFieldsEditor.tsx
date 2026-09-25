import React from 'react';
import { Plus, Trash2, Shield, FileText } from 'lucide-react';
import { CustomField } from '../../../types';

interface CustomFieldsEditorProps {
  fields: CustomField[];
  onChange: (fields: CustomField[]) => void;
  className?: string;
}

export const CustomFieldsEditor: React.FC<CustomFieldsEditorProps> = ({
  fields,
  onChange,
  className = '',
}) => {
  const handleAdd = (type: 'text' | 'sensitive') => {
    const newField: CustomField = {
      id: Date.now().toString(),
      name: '',
      value: '',
      fieldType: type,
    };
    onChange([...fields, newField]);
  };

  const handleUpdate = (id: string, updates: Partial<CustomField>) => {
    onChange(
      fields.map((f) => {
        if (f.id === id) {
          return { ...f, ...updates };
        }
        return f;
      })
    );
  };

  const handleRemove = (id: string) => {
    onChange(fields.filter((f) => f.id !== id));
  };

  return (
    <div className={`space-y-2.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block">
          Custom Fields
        </label>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleAdd('text')}
            className="text-xs text-theme-text-muted hover:text-theme-text flex items-center gap-1 font-medium px-2 py-1 rounded-lg hover:bg-theme-elevated transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Text</span>
          </button>
          <span className="text-theme-text-dim text-xs">•</span>
          <button
            type="button"
            onClick={() => handleAdd('sensitive')}
            className="text-xs text-theme-text-muted hover:text-theme-text flex items-center gap-1 font-medium px-2 py-1 rounded-lg hover:bg-theme-elevated transition-colors cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 stroke-[1.75] text-purple-600 dark:text-purple-400" />
            <span>Hidden</span>
          </button>
        </div>
      </div>

      {fields.length === 0 ? (
        <p className="text-xs text-theme-text-muted italic bg-theme-surface border border-theme-border rounded-xl p-3 text-center">
          No custom fields. Add extra metadata like PINs, security questions, or backup emails.
        </p>
      ) : (
        <div className="space-y-2">
          {fields.map((field) => {
            const isSensitive = field.fieldType === 'sensitive' || field.field_type === 'sensitive';
            return (
              <div
                key={field.id}
                className="flex items-center gap-2 p-2 rounded-xl bg-theme-surface border border-theme-border animate-scale-up"
              >
                <div className="w-32 shrink-0">
                  <input
                    type="text"
                    value={field.name}
                    onChange={(e) => handleUpdate(field.id, { name: e.target.value })}
                    placeholder="Field name..."
                    className="w-full input-themed rounded-lg px-2.5 py-1.5 text-xs font-semibold placeholder-slate-400 focus:outline-none"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <input
                    type={isSensitive ? 'password' : 'text'}
                    value={field.value}
                    onChange={(e) => handleUpdate(field.id, { value: e.target.value })}
                    placeholder={isSensitive ? 'Secret value...' : 'Field value...'}
                    className="w-full input-themed rounded-lg px-2.5 py-1.5 text-xs font-mono placeholder-slate-400 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleUpdate(field.id, {
                      fieldType: isSensitive ? 'text' : 'sensitive',
                    })
                  }
                  className="p-1.5 rounded-lg text-theme-text-muted hover:text-theme-text hover:bg-theme-hover transition-colors cursor-pointer shrink-0"
                  title={isSensitive ? 'Convert to regular text' : 'Convert to hidden/masked secret'}
                >
                  {isSensitive ? (
                    <Shield className="w-3.5 h-3.5 stroke-[1.75] text-purple-600 dark:text-purple-400" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 stroke-[1.75]" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleRemove(field.id)}
                  className="p-1.5 rounded-lg text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-500/15 transition-colors cursor-pointer shrink-0"
                  title="Remove field"
                >
                  <Trash2 className="w-3.5 h-3.5 stroke-[1.75]" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
