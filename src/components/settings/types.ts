export type SettingsCategory =
  | 'general'
  | 'appearance'
  | 'security'
  | 'privacy'
  | 'documents'
  | 'data'
  | 'updates';

export interface CategoryMeta {
  id: SettingsCategory;
  label: string;
  description: string;
}

export const SETTINGS_CATEGORIES: CategoryMeta[] = [
  {
    id: 'general',
    label: 'General',
    description: 'Vault overview, status indicators, and general preferences.',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Theme customization, typography, and interface density.',
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Master password, auto-lock, biometrics, and screen protection.',
  },
  {
    id: 'privacy',
    label: 'Privacy & Network',
    description: 'Air-Gap firewall and application network isolation.',
  },
  {
    id: 'documents',
    label: 'Documents',
    description: 'Renewal reminders and dual calendar localization.',
  },
  {
    id: 'data',
    label: 'Data',
    description: 'Encrypted backups, CSV export, and safe data migration.',
  },
  {
    id: 'updates',
    label: 'Updates',
    description: 'Software release tracking and automatic update checks.',
  },
];
