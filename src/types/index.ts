export type CategoryType =
  | 'all'
  | 'favorites'
  | 'logins'
  | 'secure_notes'
  | 'totp'
  | 'cards'
  | 'licenses'
  | 'servers'
  | 'api_credentials'
  | 'documents'
  | 'health';


export interface CustomField {
  id: string;
  name: string;
  value: string;
  fieldType: 'text' | 'sensitive';
  field_type?: 'text' | 'sensitive';
}

export interface EntryBase {
  id: string;
  title: string;
  notes: string;
  category: string;
  favorite: boolean;
  tags: string[];
  custom_fields: CustomField[];
  created_at: string;
  updated_at: string;
  last_used_at?: string;
}

export interface LoginFolder {
  id: string;
  name: string;
  parent_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoginEntry extends EntryBase {
  category: 'logins';
  username: string;
  email: string;
  password: string;
  url: string;
  folder_id?: string | null;
  totp_secret?: string;
  totp_issuer?: string;
}

export interface SecureNoteEntry extends EntryBase {
  category: 'secure_notes';
}

export interface AuthenticatorEntry extends EntryBase {
  category: 'totp';
  username: string; // account identifier
  totp_secret: string;
  totp_issuer: string;
  totp_algorithm?: 'SHA1' | 'SHA256' | 'SHA512';
  totp_digits?: number; // 6 | 8
  totp_period?: number; // 30 | 60
}

export interface CardEntry extends EntryBase {
  category: 'cards';
  cardholder_name?: string;
  card_number?: string;
  card_exp_month?: string;
  card_exp_year?: string;
  card_cvv?: string;
  card_pin?: string;
  card_type?: string;
  card_billing_address?: string;
}

export interface LicenseEntry extends EntryBase {
  category: 'licenses';
  license_key?: string;
  license_vendor?: string;
  license_version?: string;
  license_purchase_date?: string;
  license_expires_at?: string;
  url?: string;
}

export interface ServerEntry extends EntryBase {
  category: 'servers';
  server_host?: string;
  server_port?: string;
  server_protocol?: string;
  username?: string;
  password?: string;
  server_key?: string;
  server_environment?: string;
}

export interface ApiCredentialEntry extends EntryBase {
  category: 'api_credentials';
  url?: string;
  api_key?: string;
  api_secret?: string;
  api_client_id?: string;
  api_client_secret?: string;
  api_environment?: string;
}

export type VaultEntry =
  | LoginEntry
  | SecureNoteEntry
  | AuthenticatorEntry
  | CardEntry
  | LicenseEntry
  | ServerEntry
  | ApiCredentialEntry;

export interface DecryptedEntry {
  id: string;
  title: string;
  username: string;
  email: string;
  password: string;
  url: string;
  notes: string;
  category: string;
  favorite: boolean;
  folder_id?: string | null;
  tags: string[];
  custom_fields: CustomField[];
  totp_secret?: string;
  totp_issuer?: string;
  created_at: string;
  updated_at: string;
  last_used_at?: string;

  // Authenticator extensions
  totp_algorithm?: string;
  totp_digits?: number;
  totp_period?: number;

  // Card extensions
  cardholder_name?: string;
  card_number?: string;
  card_exp_month?: string;
  card_exp_year?: string;
  card_cvv?: string;
  card_pin?: string;
  card_type?: string;
  card_billing_address?: string;

  // License extensions
  license_key?: string;
  license_vendor?: string;
  license_version?: string;
  license_purchase_date?: string;
  license_expires_at?: string;

  // Server extensions
  server_host?: string;
  server_port?: string;
  server_protocol?: string;
  server_key?: string;
  server_environment?: string;

  // API Credential extensions
  api_key?: string;
  api_secret?: string;
  api_client_id?: string;
  api_client_secret?: string;
  api_environment?: string;
}

export interface VaultStatus {
  exists: boolean;
  unlocked: boolean;
  auto_lock_minutes: number;
  entry_count: number;
}

export interface PwGenConfig {
  length: number;
  use_uppercase: boolean;
  use_lowercase: boolean;
  use_numbers: boolean;
  use_symbols: boolean;
  exclude_ambiguous: boolean;
  passphrase_mode: boolean;
  word_count: number;
  separator: string;
}

export interface TotpResult {
  code: string;
  time_remaining: number;
}

export interface VaultHealthReport {
  total_entries: number;
  weak_passwords: number;
  reused_passwords: number;
  missing_totp: number;
  total_score: number;
}

// ======================== Safe Import Types ========================

export interface DuplicateItemPreview {
  imported_title: string;
  existing_title: string;
  category: string;
  reason: string;
  existing_id: string;
  imported_index: number;
}

export interface ImportPreview {
  total_imported: number;
  existing_count: number;
  duplicate_count: number;
  duplicates: DuplicateItemPreview[];
  categories_breakdown: Record<string, number>;
  format: 'vlock' | 'csv';
  has_documents: boolean;
  documents_count: number;
}

export interface ImportCommitOptions {
  src_path: string;
  master_password?: string;
  mode: 'add' | 'replace';
  duplicate_strategy: 'keep_existing' | 'import_both' | 'replace_existing';
}

export interface ImportResultSummary {
  added: number;
  skipped: number;
  replaced: number;
  duplicates: number;
  failed: number;
  documents_imported: number;
}

// ======================== Document Vault Types ========================

export type DocumentCategoryType =
  | 'bill'
  | 'receipt'
  | 'identification'
  | 'certificate'
  | 'insurance'
  | 'contract'
  | 'warranty'
  | 'invoice'
  | 'other';

export interface DocumentMetadata {
  id: string;
  title: string;
  doc_type: DocumentCategoryType | string;
  description: string;
  tags: string[];
  document_date?: string;
  expiry_date?: string;
  favorite: boolean;
  page_count: number;
  created_at: string;
  updated_at: string;
  thumbnail_data?: string;
}

export interface DocumentPage {
  id: string;
  document_id: string;
  page_number: number;
  mime_type: string;
  width: number;
  height: number;
  file_size: number;
  created_at: string;
  image_data?: string;
  thumbnail_data?: string;
}

export interface DocumentDetail {
  metadata: DocumentMetadata;
  pages: DocumentPage[];
}

export interface SavePageInput {
  id?: string;
  page_number: number;
  mime_type: string;
  width: number;
  height: number;
  file_size: number;
  image_data: string;
  thumbnail_data?: string;
}

export interface SaveDocumentInput {
  id?: string;
  title: string;
  doc_type: string;
  description: string;
  tags: string[];
  document_date?: string;
  expiry_date?: string;
  favorite: boolean;
  pages: SavePageInput[];
}

export interface ScreenProtectionStatus {
  supported: boolean;
  platform: string;
  active: boolean;
  description: string;
}

export interface BiometricCapability {
  supported: boolean;
  platform: string;
  description: string;
}

export interface AppVersionInfo {
  version: string;
  os: string;
  arch: string;
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseTitle: string;
  releaseNotes: string;
  publishedAt: string;
  htmlUrl: string;
  assetName?: string;
  assetDownloadUrl?: string;
  assetSize?: number;
  updateObject?: any;
  isDesktopUpdater?: boolean;
}

