import React, { useState, useEffect } from 'react';
import { useVault } from '../context/VaultContext';
import { CategoryType, DecryptedEntry } from '../types';
import { LoginForm } from './entries/LoginForm';
import { SecureNoteForm } from './entries/SecureNoteForm';
import { AuthenticatorForm } from './entries/AuthenticatorForm';
import { CardForm } from './entries/CardForm';
import { LicenseForm } from './entries/LicenseForm';
import { ServerForm } from './entries/ServerForm';
import { ApiCredentialForm } from './entries/ApiCredentialForm';

export const EntryEditorModal: React.FC = () => {
  const {
    isEditorOpen,
    closeEditor,
    editingEntry,
    initialEditorCategory,
    saveEntry,
    generatePassword,
    activeCategory,
  } = useVault();

  const [currentCategory, setCurrentCategory] = useState<CategoryType>('logins');

  useEffect(() => {
    if (editingEntry) {
      const cat = (editingEntry.category as CategoryType) || 'logins';
      setCurrentCategory(cat);
    } else if (initialEditorCategory) {
      setCurrentCategory(initialEditorCategory);
    } else {
      if (
        activeCategory === 'secure_notes' ||
        activeCategory === 'totp' ||
        activeCategory === 'cards' ||
        activeCategory === 'licenses' ||
        activeCategory === 'servers' ||
        activeCategory === 'api_credentials'
      ) {
        setCurrentCategory(activeCategory);
      } else {
        setCurrentCategory('logins');
      }
    }
  }, [editingEntry, initialEditorCategory, activeCategory, isEditorOpen]);

  if (!isEditorOpen) return null;

  const handleSave = (entry: DecryptedEntry) => {
    saveEntry(entry);
  };

  const handleGeneratePw = async (): Promise<string> => {
    return await generatePassword({
      length: 18,
      use_uppercase: true,
      use_lowercase: true,
      use_numbers: true,
      use_symbols: true,
      exclude_ambiguous: true,
      passphrase_mode: false,
      word_count: 4,
      separator: '-',
    });
  };

  switch (currentCategory) {
    case 'secure_notes':
      return (
        <SecureNoteForm
          initialData={editingEntry}
          onSave={handleSave}
          onClose={closeEditor}
          onCategoryChange={setCurrentCategory}
        />
      );

    case 'totp':
      return (
        <AuthenticatorForm
          initialData={editingEntry}
          onSave={handleSave}
          onClose={closeEditor}
          onCategoryChange={setCurrentCategory}
        />
      );

    case 'cards':
      return (
        <CardForm
          initialData={editingEntry}
          onSave={handleSave}
          onClose={closeEditor}
          onCategoryChange={setCurrentCategory}
        />
      );

    case 'licenses':
      return (
        <LicenseForm
          initialData={editingEntry}
          onSave={handleSave}
          onClose={closeEditor}
          onCategoryChange={setCurrentCategory}
        />
      );

    case 'servers':
      return (
        <ServerForm
          initialData={editingEntry}
          onSave={handleSave}
          onClose={closeEditor}
          onCategoryChange={setCurrentCategory}
          onGeneratePassword={handleGeneratePw}
        />
      );

    case 'api_credentials':
      return (
        <ApiCredentialForm
          initialData={editingEntry}
          onSave={handleSave}
          onClose={closeEditor}
          onCategoryChange={setCurrentCategory}
        />
      );

    case 'logins':
    default:
      return (
        <LoginForm
          initialData={editingEntry}
          onSave={handleSave}
          onClose={closeEditor}
          onCategoryChange={setCurrentCategory}
          onGeneratePassword={handleGeneratePw}
        />
      );
  }
};
