import React, { useState } from 'react';
import { Tag as TagIcon, X } from 'lucide-react';

interface TagEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  className?: string;
}

export const TagEditor: React.FC<TagEditorProps> = ({ tags, onChange, className = '' }) => {
  const [input, setInput] = useState('');

  const addTag = (text: string) => {
    const clean = text.trim().toLowerCase().replace(/^#/, '');
    if (clean && !tags.includes(clean)) {
      onChange([...tags, clean]);
    }
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter((t) => t !== tagToRemove));
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider flex items-center gap-1.5">
        <TagIcon className="w-3.5 h-3.5 text-theme-text-muted" />
        <span>Tags</span>
      </label>

      <div className="w-full input-themed rounded-xl p-2 flex flex-wrap items-center gap-1.5 min-h-[42px] focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-medium shrink-0 animate-scale-up"
          >
            <span>#{tag}</span>
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-rose-400 p-0.5 rounded transition-colors cursor-pointer"
              title="Remove tag"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(input)}
          placeholder={tags.length === 0 ? 'Type tag and press Enter or comma...' : 'Add tag...'}
          className="flex-1 min-w-[120px] bg-transparent border-none text-sm text-theme-text placeholder-slate-400 focus:outline-none px-1.5 py-0.5"
        />
      </div>
    </div>
  );
};
