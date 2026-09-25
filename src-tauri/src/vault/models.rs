use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Default, PartialEq, Eq)]
pub struct CustomField {
    pub id: String,
    pub name: String,
    pub value: String,
    #[serde(rename = "fieldType")]
    pub field_type: String, // "text" | "sensitive"
}

#[derive(Deserialize)]
struct CustomFieldRaw {
    #[serde(default)]
    id: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    value: String,
    #[serde(default)]
    #[serde(rename = "fieldType")]
    field_type_camel: Option<String>,
    #[serde(default)]
    field_type: Option<String>,
}

impl<'de> Deserialize<'de> for CustomField {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let raw = CustomFieldRaw::deserialize(deserializer)?;
        let ft = raw
            .field_type_camel
            .or(raw.field_type)
            .unwrap_or_else(|| "text".to_string());
        Ok(CustomField {
            id: raw.id,
            name: raw.name,
            value: raw.value,
            field_type: ft,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DecryptedEntry {
    pub id: String,
    pub title: String,
    pub username: String,
    pub email: String,
    pub password: String,
    pub url: String,
    pub notes: String,
    pub category: String, // "logins" | "secure_notes" | "cards" | "identity" | "servers"
    pub favorite: bool,
    pub tags: Vec<String>,
    pub custom_fields: Vec<CustomField>,
    pub totp_secret: Option<String>,
    pub totp_issuer: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub last_used_at: Option<String>,
    #[serde(default)]
    pub folder_id: Option<String>,

    // Authenticator extensions
    #[serde(default)]
    pub totp_algorithm: Option<String>, // "SHA1" | "SHA256" | "SHA512"
    #[serde(default)]
    pub totp_digits: Option<u32>, // 6 | 8
    #[serde(default)]
    pub totp_period: Option<u64>, // 30 | 60

    // Card extensions
    #[serde(default)]
    pub cardholder_name: Option<String>,
    #[serde(default)]
    pub card_number: Option<String>,
    #[serde(default)]
    pub card_exp_month: Option<String>,
    #[serde(default)]
    pub card_exp_year: Option<String>,
    #[serde(default)]
    pub card_cvv: Option<String>,
    #[serde(default)]
    pub card_pin: Option<String>,
    #[serde(default)]
    pub card_type: Option<String>,
    #[serde(default)]
    pub card_billing_address: Option<String>,

    // License extensions
    #[serde(default)]
    pub license_key: Option<String>,
    #[serde(default)]
    pub license_vendor: Option<String>,
    #[serde(default)]
    pub license_version: Option<String>,
    #[serde(default)]
    pub license_purchase_date: Option<String>,
    #[serde(default)]
    pub license_expires_at: Option<String>,

    // Server extensions
    #[serde(default)]
    pub server_host: Option<String>,
    #[serde(default)]
    pub server_port: Option<String>,
    #[serde(default)]
    pub server_protocol: Option<String>,
    #[serde(default)]
    pub server_key: Option<String>,
    #[serde(default)]
    pub server_environment: Option<String>,

    // API Credential extensions
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default)]
    pub api_secret: Option<String>,
    #[serde(default)]
    pub api_client_id: Option<String>,
    #[serde(default)]
    pub api_client_secret: Option<String>,
    #[serde(default)]
    pub api_environment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecryptedEntryHeader {
    pub id: String,
    pub title: String,
    pub username: String,
    pub email: String,
    pub url: String,
    pub category: String,
    pub favorite: bool,
    pub tags: Vec<String>,
    pub has_totp: bool,
    pub updated_at: String,
    #[serde(default)]
    pub folder_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct LoginFolder {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub parent_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultStatus {
    pub exists: bool,
    pub unlocked: bool,
    pub auto_lock_minutes: u32,
    pub entry_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PwGenConfig {
    pub length: u32,
    pub use_uppercase: bool,
    pub use_lowercase: bool,
    pub use_numbers: bool,
    pub use_symbols: bool,
    pub exclude_ambiguous: bool,
    pub passphrase_mode: bool,
    pub word_count: u32,
    pub separator: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TotpResult {
    pub code: String,
    pub time_remaining: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultHealthReport {
    pub total_entries: usize,
    pub weak_passwords: usize,
    pub reused_passwords: usize,
    pub missing_totp: usize,
    pub total_score: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortableVaultBackup {
    pub version: u32,
    pub magic: String,
    pub created_at: String,
    pub kdf_salt_b64: String,
    pub wrapped_vek_nonce_b64: String,
    pub wrapped_vek_ciphertext_b64: String,
    pub entries: Vec<BackupEntryItem>,
    #[serde(default)]
    pub documents: Vec<BackupDocumentItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupEntryItem {
    pub id: String,
    pub category: String,
    pub favorite: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_used_at: Option<String>,
    pub nonce_b64: String,
    pub encrypted_payload_b64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupDocumentItem {
    pub id: String,
    pub title: String,
    pub doc_type: String,
    pub description: String,
    pub tags: Vec<String>,
    pub document_date: Option<String>,
    pub expiry_date: Option<String>,
    pub favorite: bool,
    pub created_at: String,
    pub updated_at: String,
    pub pages: Vec<BackupPageItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupPageItem {
    pub id: String,
    pub document_id: String,
    pub page_number: usize,
    pub mime_type: String,
    pub width: u32,
    pub height: u32,
    pub file_size: usize,
    pub nonce_b64: String,
    pub encrypted_blob_b64: String,
    pub thumbnail_nonce_b64: Option<String>,
    pub thumbnail_blob_b64: Option<String>,
    pub created_at: String,
}

// ======================== Safe Import Models ========================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateItemPreview {
    pub imported_title: String,
    pub existing_title: String,
    pub category: String,
    pub reason: String,
    pub existing_id: String,
    pub imported_index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportPreview {
    pub total_imported: usize,
    pub existing_count: usize,
    pub duplicate_count: usize,
    pub duplicates: Vec<DuplicateItemPreview>,
    pub categories_breakdown: std::collections::HashMap<String, usize>,
    pub format: String,
    pub has_documents: bool,
    pub documents_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportCommitOptions {
    pub src_path: String,
    pub master_password: Option<String>,
    pub mode: String, // "add" | "replace"
    pub duplicate_strategy: String, // "keep_existing" | "import_both" | "replace_existing"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResultSummary {
    pub added: usize,
    pub skipped: usize,
    pub replaced: usize,
    pub duplicates: usize,
    pub failed: usize,
    pub documents_imported: usize,
}

// ======================== Document Vault Models ========================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentMetadata {
    pub id: String,
    pub title: String,
    pub doc_type: String,
    pub description: String,
    pub tags: Vec<String>,
    pub document_date: Option<String>,
    pub expiry_date: Option<String>,
    pub favorite: bool,
    pub page_count: usize,
    pub created_at: String,
    pub updated_at: String,
    pub thumbnail_data: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentPage {
    pub id: String,
    pub document_id: String,
    pub page_number: usize,
    pub mime_type: String,
    pub width: u32,
    pub height: u32,
    pub file_size: usize,
    pub created_at: String,
    pub image_data: Option<String>,
    pub thumbnail_data: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentDetail {
    pub metadata: DocumentMetadata,
    pub pages: Vec<DocumentPage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavePageInput {
    pub id: Option<String>,
    pub page_number: usize,
    pub mime_type: String,
    pub width: u32,
    pub height: u32,
    pub file_size: usize,
    pub image_data: String,
    pub thumbnail_data: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveDocumentInput {
    pub id: Option<String>,
    pub title: String,
    pub doc_type: String,
    pub description: String,
    pub tags: Vec<String>,
    pub document_date: Option<String>,
    pub expiry_date: Option<String>,
    pub favorite: bool,
    #[serde(default)]
    pub pages: Vec<SavePageInput>,
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_custom_field_deserialization_both_fields() {
        let json = r#"{"id":"1","name":"PIN","value":"1234","fieldType":"sensitive","field_type":"sensitive"}"#;
        let cf: CustomField = serde_json::from_str(json).expect("should deserialize when both fieldType and field_type are present");
        assert_eq!(cf.id, "1");
        assert_eq!(cf.name, "PIN");
        assert_eq!(cf.value, "1234");
        assert_eq!(cf.field_type, "sensitive");
    }

    #[test]
    fn test_custom_field_deserialization_camel_only() {
        let json = r#"{"id":"2","name":"Secret","value":"abc","fieldType":"text"}"#;
        let cf: CustomField = serde_json::from_str(json).expect("should deserialize camelCase");
        assert_eq!(cf.field_type, "text");
    }

    #[test]
    fn test_custom_field_deserialization_snake_only() {
        let json = r#"{"id":"3","name":"Secret","value":"abc","field_type":"sensitive"}"#;
        let cf: CustomField = serde_json::from_str(json).expect("should deserialize snake_case");
        assert_eq!(cf.field_type, "sensitive");
    }

    #[test]
    fn test_custom_field_deserialization_defaults_to_text() {
        let json = r#"{"id":"4","name":"Note","value":"abc"}"#;
        let cf: CustomField = serde_json::from_str(json).expect("should default field_type");
        assert_eq!(cf.field_type, "text");
    }
}

