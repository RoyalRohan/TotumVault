export type SettingsCategory =
  | 'general'
  | 'appearance'
  | 'security'
  | 'privacy'
  | 'documents'
  | 'updates';

export interface CategoryMeta {
  id: SettingsCategory;
  label: string;
}

export const SETTINGS_CATEGORIES: CategoryMeta[] = [
  { id: 'general', label: 'General' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'security', label: 'Security' },
  { id: 'privacy', label: 'Privacy & Network' },
  { id: 'documents', label: 'Documents' },
  { id: 'updates', label: 'Updates' },
];
