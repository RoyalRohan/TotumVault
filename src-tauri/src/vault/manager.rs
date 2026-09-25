use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::Utc;
use uuid::Uuid;
use zeroize::Zeroize;

use crate::crypto::aes_gcm::{decrypt_bytes, encrypt_bytes};
use crate::crypto::argon2_kdf::{derive_kek, generate_random_salt, DerivedKey};
use crate::crypto::key_wrap::{generate_vault_key, unwrap_vault_key, wrap_vault_key, VaultKey};
use crate::db::sqlite::{
    delete_document_page_record, delete_document_record, delete_entry_record,
    get_all_documents, get_all_encrypted_entries, get_document_page_record,
    get_document_pages_by_doc_id, get_document_record, get_metadata, init_db,
    reorder_pages_record, save_document_page_record, save_document_record,
    save_encrypted_entry, save_metadata, toggle_document_favorite_record,
    wipe_all_documents, wipe_all_entries,
};

use rand::RngCore;

use super::importer::{
    analyze_import_data, find_matching_entry, parse_backup_content, parse_csv_to_entries,
};
use super::models::{
    BackupDocumentItem, BackupEntryItem, BackupPageItem, DecryptedEntry, DocumentDetail,
    DocumentMetadata, DocumentPage, ImportCommitOptions, ImportPreview, ImportResultSummary,
    LoginFolder, PortableVaultBackup, SaveDocumentInput, SavePageInput,
};

pub struct VaultManager {
    db_path: PathBuf,
    active_key: Option<VaultKey>,
    auto_lock_minutes: u32,
    last_activity: u64,
}


impl VaultManager {
    pub fn new(app_dir: PathBuf) -> Self {
        let db_path = app_dir.join("vault.sqlite");
        Self {
            db_path,
            active_key: None,
            auto_lock_minutes: 5,
            last_activity: Self::current_timestamp(),
        }
    }

    fn current_timestamp() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    }

    pub fn touch_activity(&mut self) {
        self.last_activity = Self::current_timestamp();
    }

    pub fn set_auto_lock_minutes(&mut self, mins: u32) {
        self.auto_lock_minutes = mins;
        self.touch_activity();
    }

    pub fn check_auto_lock(&mut self) -> bool {
        if self.active_key.is_none() || self.auto_lock_minutes == 0 {
            return false;
        }

        let now = Self::current_timestamp();
        let elapsed_mins = (now.saturating_sub(self.last_activity)) / 60;
        if elapsed_mins >= self.auto_lock_minutes as u64 {
            self.lock_vault();
            true
        } else {
            false
        }
    }

    pub fn is_initialized(&self) -> bool {
        if !self.db_path.exists() {
            return false;
        }
        if let Ok(conn) = init_db(&self.db_path) {
            matches!(get_metadata(&conn, "wrapped_vek_ciphertext"), Ok(Some(_)))
        } else {
            false
        }
    }

    pub fn is_unlocked(&self) -> bool {
        self.active_key.is_some()
    }

    pub fn auto_lock_minutes(&self) -> u32 {
        self.auto_lock_minutes
    }

    pub fn create_vault(&mut self, master_password: &str) -> Result<(), String> {
        if master_password.trim().len() < 8 {
            return Err("Master password must be at least 8 characters long.".to_string());
        }

        let conn = init_db(&self.db_path)?;
        let salt = generate_random_salt();
        let kek = derive_kek(master_password, &salt)?;
        let vek = generate_vault_key();
        let wrapped_vek = wrap_vault_key(&vek, &kek)?;

        save_metadata(&conn, "kdf_salt", &salt)?;
        save_metadata(&conn, "kdf_algorithm", "argon2id")?;
        save_metadata(&conn, "wrapped_vek_nonce", &wrapped_vek.nonce_b64)?;
        save_metadata(&conn, "wrapped_vek_ciphertext", &wrapped_vek.ciphertext_b64)?;

        self.active_key = Some(vek);
        self.touch_activity();
        Ok(())
    }

    pub fn unlock_vault(&mut self, master_password: &str) -> Result<bool, String> {
        let conn = init_db(&self.db_path)?;

        let salt = get_metadata(&conn, "kdf_salt")?
            .ok_or_else(|| "Vault metadata corrupt: missing KDF salt".to_string())?;
        let nonce_b64 = get_metadata(&conn, "wrapped_vek_nonce")?
            .ok_or_else(|| "Vault metadata corrupt: missing VEK nonce".to_string())?;
        let ciphertext_b64 = get_metadata(&conn, "wrapped_vek_ciphertext")?
            .ok_or_else(|| "Vault metadata corrupt: missing VEK ciphertext".to_string())?;

        let kek = derive_kek(master_password, &salt)?;
        match unwrap_vault_key(&kek, &nonce_b64, &ciphertext_b64) {
            Ok(vek) => {
                self.active_key = Some(vek);
                self.touch_activity();
                Ok(true)
            }
            Err(_) => Ok(false),
        }
    }

    pub fn lock_vault(&mut self) {
        if let Some(mut key) = self.active_key.take() {
            key.0.zeroize();
        }
    }

    pub fn get_entries(&mut self) -> Result<Vec<DecryptedEntry>, String> {
        self.check_auto_lock();
        let key = self
            .active_key
            .as_ref()
            .ok_or_else(|| "Vault is locked".to_string())?;

        let conn = init_db(&self.db_path)?;
        let raw_records = get_all_encrypted_entries(&conn)?;

        let mut decrypted_list = Vec::new();
        for rec in raw_records {
            if let Ok(payload_bytes) = decrypt_bytes(&key.0, &rec.nonce_b64, &rec.encrypted_payload_b64) {
                if let Ok(entry) = serde_json::from_slice::<DecryptedEntry>(&payload_bytes) {
                    decrypted_list.push(entry);
                }
            }
        }

        self.touch_activity();
        Ok(decrypted_list)
    }

    pub fn save_entry(&mut self, mut entry: DecryptedEntry) -> Result<String, String> {
        self.check_auto_lock();
        let key = self
            .active_key
            .as_ref()
            .ok_or_else(|| "Vault is locked".to_string())?;

        let conn = init_db(&self.db_path)?;

        if entry.id.trim().is_empty() {
            entry.id = Uuid::new_v4().to_string();
            entry.created_at = Utc::now().to_rfc3339();
        }
        entry.updated_at = Utc::now().to_rfc3339();

        let json_bytes = serde_json::to_vec(&entry)
            .map_err(|e| format!("Failed to serialize entry JSON: {}", e))?;

        let encrypted = encrypt_bytes(&key.0, &json_bytes)?;

        save_encrypted_entry(
            &conn,
            &entry.id,
            &entry.category,
            entry.favorite,
            &entry.created_at,
            &entry.updated_at,
            entry.last_used_at.as_deref(),
            &encrypted.nonce_b64,
            &encrypted.ciphertext_b64,
        )?;

        self.touch_activity();
        Ok(entry.id)
    }

    pub fn delete_entry(&mut self, id: &str) -> Result<(), String> {
        self.check_auto_lock();
        if self.active_key.is_none() {
            return Err("Vault is locked".to_string());
        }

        let conn = init_db(&self.db_path)?;
        delete_entry_record(&conn, id)?;

        self.touch_activity();
        Ok(())
    }

    // ==========================================
    // LOGIN SUBFOLDERS
    // ==========================================

    pub fn get_login_folders(&mut self) -> Result<Vec<LoginFolder>, String> {
        self.check_auto_lock();
        if self.active_key.is_none() {
            return Err("Vault is locked".to_string());
        }

        let conn = init_db(&self.db_path)?;
        if let Some(json_str) = get_metadata(&conn, "login_folders")? {
            let folders: Vec<LoginFolder> = serde_json::from_str(&json_str)
                .unwrap_or_default();
            Ok(folders)
        } else {
            Ok(Vec::new())
        }
    }

    pub fn save_login_folders(&mut self, folders: &[LoginFolder]) -> Result<(), String> {
        self.check_auto_lock();
        if self.active_key.is_none() {
            return Err("Vault is locked".to_string());
        }

        let conn = init_db(&self.db_path)?;
        let json_str = serde_json::to_string(folders)
            .map_err(|e| format!("Failed to serialize login folders: {}", e))?;
        save_metadata(&conn, "login_folders", &json_str)?;
        self.touch_activity();
        Ok(())
    }

    pub fn create_login_folder(&mut self, name: &str, parent_id: Option<String>) -> Result<LoginFolder, String> {
        let clean_name = name.trim();
        if clean_name.is_empty() {
            return Err("Folder name cannot be empty".to_string());
        }

        let mut folders = self.get_login_folders()?;
        if folders.iter().any(|f| f.name.eq_ignore_ascii_case(clean_name) && f.parent_id == parent_id) {
            return Err(format!("A folder named '{}' already exists in this location", clean_name));
        }

        let new_folder = LoginFolder {
            id: Uuid::new_v4().to_string(),
            name: clean_name.to_string(),
            parent_id,
            created_at: Utc::now().to_rfc3339(),
        };

        folders.push(new_folder.clone());
        self.save_login_folders(&folders)?;
        Ok(new_folder)
    }

    pub fn rename_login_folder(&mut self, id: &str, new_name: &str) -> Result<(), String> {
        let clean_name = new_name.trim();
        if clean_name.is_empty() {
            return Err("Folder name cannot be empty".to_string());
        }

        let mut folders = self.get_login_folders()?;
        let folder_idx = folders.iter().position(|f| f.id == id)
            .ok_or_else(|| "Folder not found".to_string())?;

        let parent_id = folders[folder_idx].parent_id.clone();
        if folders.iter().any(|f| f.id != id && f.name.eq_ignore_ascii_case(clean_name) && f.parent_id == parent_id) {
            return Err(format!("A folder named '{}' already exists in this location", clean_name));
        }

        folders[folder_idx].name = clean_name.to_string();
        self.save_login_folders(&folders)?;
        Ok(())
    }

    pub fn delete_login_folder(&mut self, id: &str, delete_contents: bool) -> Result<(), String> {
        let mut folders = self.get_login_folders()?;
        
        let mut target_ids = std::collections::HashSet::new();
        target_ids.insert(id.to_string());

        let mut changed = true;
        while changed {
            changed = false;
            for f in &folders {
                if let Some(ref pid) = f.parent_id {
                    if target_ids.contains(pid) && !target_ids.contains(&f.id) {
                        target_ids.insert(f.id.clone());
                        changed = true;
                    }
                }
            }
        }

        let entries = self.get_entries()?;
        for mut entry in entries {
            if let Some(ref fid) = entry.folder_id {
                if target_ids.contains(fid) {
                    if delete_contents {
                        self.delete_entry(&entry.id)?;
                    } else {
                        entry.folder_id = None;
                        self.save_entry(entry)?;
                    }
                }
            }
        }

        folders.retain(|f| !target_ids.contains(&f.id));
        self.save_login_folders(&folders)?;
        Ok(())
    }

    pub fn move_entry_to_folder(&mut self, entry_id: &str, folder_id: Option<String>) -> Result<(), String> {
        let entries = self.get_entries()?;
        let mut target_entry = entries.into_iter().find(|e| e.id == entry_id)
            .ok_or_else(|| "Entry not found".to_string())?;

        target_entry.folder_id = folder_id;
        self.save_entry(target_entry)?;
        Ok(())
    }

    // ==========================================
    // BIOMETRIC (STRONG) KEY BINDING - Class 3 Hardware Keystore Authorization
    // ==========================================

    pub fn setup_biometric_unlock(&mut self, master_password: &str) -> Result<String, String> {
        self.check_auto_lock();
        let conn = init_db(&self.db_path)?;

        let salt = get_metadata(&conn, "kdf_salt")?
            .ok_or_else(|| "Vault metadata corrupt: missing KDF salt".to_string())?;
        let nonce_b64 = get_metadata(&conn, "wrapped_vek_nonce")?
            .ok_or_else(|| "Vault metadata corrupt: missing VEK nonce".to_string())?;
        let ciphertext_b64 = get_metadata(&conn, "wrapped_vek_ciphertext")?
            .ok_or_else(|| "Vault metadata corrupt: missing VEK ciphertext".to_string())?;

        let kek = derive_kek(master_password, &salt)?;
        let vek = unwrap_vault_key(&kek, &nonce_b64, &ciphertext_b64)
            .map_err(|_| "Invalid master password".to_string())?;

        let mut token_bytes = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut token_bytes);
        let bio_token_b64 = BASE64.encode(&token_bytes);

        let bio_kek = DerivedKey(token_bytes);
        let wrapped_bio = wrap_vault_key(&vek, &bio_kek)?;
        token_bytes.zeroize();

        save_metadata(&conn, "biometric_vek_nonce", &wrapped_bio.nonce_b64)?;
        save_metadata(&conn, "biometric_vek_ciphertext", &wrapped_bio.ciphertext_b64)?;
        save_metadata(&conn, "biometric_enabled", "true")?;

        Ok(bio_token_b64)
    }

    pub fn unlock_vault_biometric(&mut self, bio_token_b64: &str) -> Result<bool, String> {
        let conn = init_db(&self.db_path)?;
        let enabled = get_metadata(&conn, "biometric_enabled")?.unwrap_or_default();
        if enabled != "true" {
            return Err("Biometric unlock is not enabled".to_string());
        }

        let nonce_b64 = get_metadata(&conn, "biometric_vek_nonce")?
            .ok_or_else(|| "Missing biometric key nonce".to_string())?;
        let ciphertext_b64 = get_metadata(&conn, "biometric_vek_ciphertext")?
            .ok_or_else(|| "Missing biometric key ciphertext".to_string())?;

        let mut token_bytes = BASE64.decode(bio_token_b64)
            .map_err(|_| "Invalid biometric token encoding".to_string())?;

        if token_bytes.len() != 32 {
            token_bytes.zeroize();
            return Err("Invalid biometric key length".to_string());
        }

        let mut key_arr = [0u8; 32];
        key_arr.copy_from_slice(&token_bytes);
        token_bytes.zeroize();
        let bio_kek = DerivedKey(key_arr);

        match unwrap_vault_key(&bio_kek, &nonce_b64, &ciphertext_b64) {
            Ok(vek) => {
                self.active_key = Some(vek);
                self.touch_activity();
                Ok(true)
            }
            Err(_) => Ok(false),
        }
    }

    pub fn disable_biometric_unlock(&mut self) -> Result<(), String> {
        let conn = init_db(&self.db_path)?;
        save_metadata(&conn, "biometric_enabled", "false")?;
        save_metadata(&conn, "biometric_vek_nonce", "")?;
        save_metadata(&conn, "biometric_vek_ciphertext", "")?;
        Ok(())
    }

    pub fn is_biometric_enabled(&self) -> bool {
        if let Ok(conn) = init_db(&self.db_path) {
            if let Ok(Some(val)) = get_metadata(&conn, "biometric_enabled") {
                return val == "true";
            }
        }
        false
    }

    pub fn change_master_password(&mut self, old_pass: &str, new_pass: &str) -> Result<(), String> {
        self.check_auto_lock();
        if new_pass.trim().len() < 8 {
            return Err("New master password must be at least 8 characters.".to_string());
        }

        let current_key = self
            .active_key
            .as_ref()
            .ok_or_else(|| "Vault is locked".to_string())?
            .clone();

        let conn = init_db(&self.db_path)?;
        let salt = get_metadata(&conn, "kdf_salt")?
            .ok_or_else(|| "Missing salt".to_string())?;
        let nonce_b64 = get_metadata(&conn, "wrapped_vek_nonce")?
            .ok_or_else(|| "Missing nonce".to_string())?;
        let ciphertext_b64 = get_metadata(&conn, "wrapped_vek_ciphertext")?
            .ok_or_else(|| "Missing ciphertext".to_string())?;

        let old_kek = derive_kek(old_pass, &salt)?;
        if unwrap_vault_key(&old_kek, &nonce_b64, &ciphertext_b64).is_err() {
            return Err("Current master password is incorrect.".to_string());
        }

        // Generate new salt and new KEK
        let new_salt = generate_random_salt();
        let new_kek = derive_kek(new_pass, &new_salt)?;

        // Re-wrap existing VEK (no need to re-encrypt individual entries!)
        let rewrapped = wrap_vault_key(&current_key, &new_kek)?;

        save_metadata(&conn, "kdf_salt", &new_salt)?;
        save_metadata(&conn, "wrapped_vek_nonce", &rewrapped.nonce_b64)?;
        save_metadata(&conn, "wrapped_vek_ciphertext", &rewrapped.ciphertext_b64)?;

        // Automatically revoke any prior biometric enrollment on password change
        let _ = save_metadata(&conn, "biometric_enabled", "false");
        let _ = save_metadata(&conn, "biometric_vek_nonce", "");
        let _ = save_metadata(&conn, "biometric_vek_ciphertext", "");

        self.touch_activity();
        Ok(())
    }

    pub fn export_backup_string(&mut self) -> Result<String, String> {
        self.check_auto_lock();
        if self.active_key.is_none() {
            return Err("Vault is locked".to_string());
        }

        let conn = init_db(&self.db_path)?;
        let salt = get_metadata(&conn, "kdf_salt")?.unwrap_or_default();
        let nonce_b64 = get_metadata(&conn, "wrapped_vek_nonce")?.unwrap_or_default();
        let ciphertext_b64 = get_metadata(&conn, "wrapped_vek_ciphertext")?.unwrap_or_default();

        let raw_records = get_all_encrypted_entries(&conn)?;
        let items: Vec<BackupEntryItem> = raw_records
            .into_iter()
            .map(|r| BackupEntryItem {
                id: r.id,
                category: r.category,
                favorite: r.is_favorite,
                created_at: r.created_at,
                updated_at: r.updated_at,
                last_used_at: r.last_used_at,
                nonce_b64: r.nonce_b64,
                encrypted_payload_b64: r.encrypted_payload_b64,
            })
            .collect();

        // Export documents and their encrypted pages
        let raw_docs = get_all_documents(&conn)?;
        let mut backup_docs = Vec::new();
        for doc in raw_docs {
            let raw_pages = get_document_pages_by_doc_id(&conn, &doc.id)?;
            let tags_vec: Vec<String> = serde_json::from_str(&doc.tags).unwrap_or_default();
            let pages: Vec<BackupPageItem> = raw_pages
                .into_iter()
                .map(|p| BackupPageItem {
                    id: p.id,
                    document_id: p.document_id,
                    page_number: p.page_number,
                    mime_type: p.mime_type,
                    width: p.width,
                    height: p.height,
                    file_size: p.file_size,
                    nonce_b64: p.nonce_b64,
                    encrypted_blob_b64: p.encrypted_blob_b64,
                    thumbnail_nonce_b64: p.thumbnail_nonce_b64,
                    thumbnail_blob_b64: p.thumbnail_blob_b64,
                    created_at: p.created_at,
                })
                .collect();

            backup_docs.push(BackupDocumentItem {
                id: doc.id,
                title: doc.title,
                doc_type: doc.doc_type,
                description: doc.description,
                tags: tags_vec,
                document_date: doc.document_date,
                expiry_date: doc.expiry_date,
                favorite: doc.is_favorite,
                created_at: doc.created_at,
                updated_at: doc.updated_at,
                pages,
            });
        }

        let backup = PortableVaultBackup {
            version: 1,
            magic: "TOTUMVAULT_VAULT_V1".to_string(),
            created_at: Utc::now().to_rfc3339(),
            kdf_salt_b64: salt,
            wrapped_vek_nonce_b64: nonce_b64,
            wrapped_vek_ciphertext_b64: ciphertext_b64,
            entries: items,
            documents: backup_docs,
        };

        let json_str = serde_json::to_string_pretty(&backup)
            .map_err(|e| format!("Failed to build backup JSON: {}", e))?;

        self.touch_activity();
        Ok(json_str)
    }

    pub fn export_backup(&mut self, dest_path: &str) -> Result<(), String> {
        let json_str = self.export_backup_string()?;

        if let Some(parent) = std::path::Path::new(dest_path).parent() {
            if !parent.as_os_str().is_empty() {
                let _ = fs::create_dir_all(parent);
            }
        }

        fs::write(dest_path, json_str)
            .map_err(|e| format!("Failed to write backup file to disk: {}", e))?;

        self.touch_activity();
        Ok(())
    }

    pub fn import_backup(&mut self, src_path_or_content: &str, master_password: &str) -> Result<(), String> {
        let json_str = if src_path_or_content.trim().starts_with('{') {
            src_path_or_content.to_string()
        } else {
            fs::read_to_string(src_path_or_content)
                .map_err(|e| format!("Failed to read backup file: {}", e))?
        };

        let backup: PortableVaultBackup = serde_json::from_str(&json_str)
            .map_err(|e| format!("Invalid TotumVault backup file format: {}", e))?;

        if backup.magic != "TOTUMVAULT_VAULT_V1" && backup.magic != "VEYLOCK_VAULT_V1" {
            return Err("Incompatible vault magic header.".to_string());
        }

        let kek = derive_kek(master_password, &backup.kdf_salt_b64)?;
        let vek = unwrap_vault_key(&kek, &backup.wrapped_vek_nonce_b64, &backup.wrapped_vek_ciphertext_b64)
            .map_err(|_| "Incorrect master password for backup file.".to_string())?;

        let conn = init_db(&self.db_path)?;
        wipe_all_entries(&conn)?;
        wipe_all_documents(&conn)?;

        save_metadata(&conn, "kdf_salt", &backup.kdf_salt_b64)?;
        save_metadata(&conn, "wrapped_vek_nonce", &backup.wrapped_vek_nonce_b64)?;
        save_metadata(&conn, "wrapped_vek_ciphertext", &backup.wrapped_vek_ciphertext_b64)?;

        for item in backup.entries {
            save_encrypted_entry(
                &conn,
                &item.id,
                &item.category,
                item.favorite,
                &item.created_at,
                &item.updated_at,
                item.last_used_at.as_deref(),
                &item.nonce_b64,
                &item.encrypted_payload_b64,
            )?;
        }

        for doc in backup.documents {
            let tags_json = serde_json::to_string(&doc.tags).unwrap_or_else(|_| "[]".to_string());
            save_document_record(
                &conn,
                &doc.id,
                &doc.title,
                &doc.doc_type,
                &doc.description,
                &tags_json,
                doc.document_date.as_deref(),
                doc.expiry_date.as_deref(),
                doc.favorite,
                &doc.created_at,
                &doc.updated_at,
            )?;

            for page in doc.pages {
                save_document_page_record(
                    &conn,
                    &page.id,
                    &page.document_id,
                    page.page_number,
                    &page.mime_type,
                    page.width,
                    page.height,
                    page.file_size,
                    &page.nonce_b64,
                    &page.encrypted_blob_b64,
                    page.thumbnail_nonce_b64.as_deref(),
                    page.thumbnail_blob_b64.as_deref(),
                    &page.created_at,
                )?;
            }
        }

        self.active_key = Some(vek);
        self.touch_activity();
        Ok(())
    }

    // ======================== Safe Import Operations ========================

    pub fn analyze_import(
        &mut self,
        content: &str,
        master_password: Option<&str>,
    ) -> Result<ImportPreview, String> {
        self.check_auto_lock();
        let existing = if self.is_unlocked() {
            self.get_entries()?
        } else {
            Vec::new()
        };

        let preview = analyze_import_data(content, master_password, &existing)?;
        self.touch_activity();
        Ok(preview)
    }

    pub fn commit_import(&mut self, options: ImportCommitOptions) -> Result<ImportResultSummary, String> {
        self.check_auto_lock();
        if self.active_key.is_none() {
            return Err("Vault must be unlocked to import credentials.".to_string());
        }

        let content = options.src_path.trim();
        let is_encrypted_backup = content.starts_with('{')
            && content.contains("\"magic\"")
            && (content.contains("TOTUMVAULT_VAULT_V1") || content.contains("VEYLOCK_VAULT_V1"));

        // Dual-layer safety: snapshot backup on disk before any modification
        let backup_path = self.db_path.with_extension("sqlite.import_backup");
        if self.db_path.exists() {
            let _ = fs::copy(&self.db_path, &backup_path);
        }

        let result = self.execute_commit_import_inner(&options, is_encrypted_backup);

        if result.is_err() {
            // Roll back database file to pre-import snapshot
            if backup_path.exists() {
                let _ = fs::copy(&backup_path, &self.db_path);
                let _ = fs::remove_file(&backup_path);
            }
        } else if backup_path.exists() {
            let _ = fs::remove_file(&backup_path);
        }

        self.touch_activity();
        result
    }

    fn execute_commit_import_inner(
        &mut self,
        options: &ImportCommitOptions,
        is_encrypted_backup: bool,
    ) -> Result<ImportResultSummary, String> {
        let active_key = self
            .active_key
            .as_ref()
            .ok_or_else(|| "Vault is locked".to_string())?
            .clone();

        let (imported_entries, backup_vek, imported_docs) = if is_encrypted_backup {
            let pass = options
                .master_password
                .as_deref()
                .filter(|p| !p.trim().is_empty())
                .ok_or_else(|| "Backup master password is required to decrypt this backup file.".to_string())?;
            let (vek, entries, docs) = parse_backup_content(&options.src_path, pass)?;
            (entries, Some(vek), docs)
        } else {
            if options.src_path.trim().starts_with('{') {
                return Err("The selected file appears to be JSON but is not a valid TotumVault (.tvault) or legacy (.vlock) backup.".to_string());
            }
            let entries = parse_csv_to_entries(&options.src_path);
            if entries.is_empty() {
                return Err("No valid entries found to import.".to_string());
            }
            (entries, None, Vec::new())
        };

        let conn = init_db(&self.db_path)?;
        let mut summary = ImportResultSummary {
            added: 0,
            skipped: 0,
            replaced: 0,
            duplicates: 0,
            failed: 0,
            documents_imported: 0,
        };

        if options.mode == "replace" {
            let existing_count = self.get_entries().map(|e| e.len()).unwrap_or(0);
            wipe_all_entries(&conn)?;

            if is_encrypted_backup {
                wipe_all_documents(&conn)?;
                let b_vek = backup_vek.as_ref().unwrap();

                // Re-wrap backup VEK with current active vault key or adopt imported backup VEK
                // To keep master password unchanged for user, re-encrypt entries using current active VEK!
                for mut entry in imported_entries {
                    if entry.id.trim().is_empty() {
                        entry.id = Uuid::new_v4().to_string();
                    }
                    if self.save_entry(entry).is_ok() {
                        summary.added += 1;
                    } else {
                        summary.failed += 1;
                    }
                }

                // Re-encrypt documents into current vault
                for doc in imported_docs {
                    let mut re_encrypted_pages = Vec::new();
                    for page in doc.pages {
                        if let Ok(raw_image) = decrypt_bytes(&b_vek.0, &page.nonce_b64, &page.encrypted_blob_b64) {
                            let thumb = if let (Some(t_nonce), Some(t_blob)) = (&page.thumbnail_nonce_b64, &page.thumbnail_blob_b64) {
                                decrypt_bytes(&b_vek.0, t_nonce, t_blob).ok().map(|tb| format!("data:image/jpeg;base64,{}", BASE64.encode(tb)))
                            } else {
                                None
                            };

                            re_encrypted_pages.push(SavePageInput {
                                id: Some(page.id),
                                page_number: page.page_number,
                                mime_type: page.mime_type,
                                width: page.width,
                                height: page.height,
                                file_size: page.file_size,
                                image_data: format!("data:{};base64,{}", "image/jpeg", BASE64.encode(raw_image)),
                                thumbnail_data: thumb,
                            });
                        }
                    }

                    let save_input = SaveDocumentInput {
                        id: Some(doc.id),
                        title: doc.title,
                        doc_type: doc.doc_type,
                        description: doc.description,
                        tags: doc.tags,
                        document_date: doc.document_date,
                        expiry_date: doc.expiry_date,
                        favorite: doc.favorite,
                        pages: re_encrypted_pages,
                    };

                    if self.save_document(save_input).is_ok() {
                        summary.documents_imported += 1;
                    }
                }
            } else {
                for mut entry in imported_entries {
                    if entry.id.trim().is_empty() {
                        entry.id = Uuid::new_v4().to_string();
                    }
                    if self.save_entry(entry).is_ok() {
                        summary.added += 1;
                    } else {
                        summary.failed += 1;
                    }
                }
            }

            summary.replaced = existing_count;
        } else {
            // Mode: "add" to existing vault
            let existing = self.get_entries()?;

            for mut candidate in imported_entries {
                let duplicate_match = find_matching_entry(&candidate, &existing);

                if let Some((matching, _reason)) = duplicate_match {
                    summary.duplicates += 1;
                    match options.duplicate_strategy.as_str() {
                        "replace_existing" => {
                            candidate.id = matching.id.clone();
                            if self.save_entry(candidate).is_ok() {
                                summary.replaced += 1;
                            } else {
                                summary.failed += 1;
                            }
                        }
                        "import_both" => {
                            candidate.id = Uuid::new_v4().to_string();
                            if self.save_entry(candidate).is_ok() {
                                summary.added += 1;
                            } else {
                                summary.failed += 1;
                            }
                        }
                        _ => {
                            // "keep_existing" (default)
                            summary.skipped += 1;
                        }
                    }
                } else {
                    candidate.id = Uuid::new_v4().to_string();
                    if self.save_entry(candidate).is_ok() {
                        summary.added += 1;
                    } else {
                        summary.failed += 1;
                    }
                }
            }

            // If backup contains documents, re-encrypt and add them
            if let Some(b_vek) = backup_vek {
                for doc in imported_docs {
                    let mut re_encrypted_pages = Vec::new();
                    for page in doc.pages {
                        if let Ok(raw_image) = decrypt_bytes(&b_vek.0, &page.nonce_b64, &page.encrypted_blob_b64) {
                            let thumb = if let (Some(t_nonce), Some(t_blob)) = (&page.thumbnail_nonce_b64, &page.thumbnail_blob_b64) {
                                decrypt_bytes(&b_vek.0, t_nonce, t_blob).ok().map(|tb| format!("data:image/jpeg;base64,{}", BASE64.encode(tb)))
                            } else {
                                None
                            };

                            re_encrypted_pages.push(SavePageInput {
                                id: None, // fresh ID to avoid conflict
                                page_number: page.page_number,
                                mime_type: page.mime_type,
                                width: page.width,
                                height: page.height,
                                file_size: page.file_size,
                                image_data: format!("data:{};base64,{}", "image/jpeg", BASE64.encode(raw_image)),
                                thumbnail_data: thumb,
                            });
                        }
                    }

                    let save_input = SaveDocumentInput {
                        id: None,
                        title: doc.title,
                        doc_type: doc.doc_type,
                        description: doc.description,
                        tags: doc.tags,
                        document_date: doc.document_date,
                        expiry_date: doc.expiry_date,
                        favorite: doc.favorite,
                        pages: re_encrypted_pages,
                    };

                    if self.save_document(save_input).is_ok() {
                        summary.documents_imported += 1;
                    }
                }
            }
        }

        self.active_key = Some(active_key);
        Ok(summary)
    }

    // ======================== Document Vault Operations ========================

    pub fn list_documents(&mut self) -> Result<Vec<DocumentMetadata>, String> {
        self.check_auto_lock();
        let key = self
            .active_key
            .as_ref()
            .ok_or_else(|| "Vault is locked".to_string())?;

        let conn = init_db(&self.db_path)?;
        let raw_docs = get_all_documents(&conn)?;

        let mut list = Vec::new();
        for d in raw_docs {
            let tags: Vec<String> = serde_json::from_str(&d.tags).unwrap_or_default();

            // Decrypt first-page thumbnail if available for fast preview in grid
            let thumbnail_data = if let (Some(nonce), Some(blob)) = (d.first_page_thumbnail_nonce, d.first_page_thumbnail_blob) {
                if let Ok(bytes) = decrypt_bytes(&key.0, &nonce, &blob) {
                    Some(format!("data:image/jpeg;base64,{}", BASE64.encode(bytes)))
                } else {
                    None
                }
            } else {
                None
            };

            list.push(DocumentMetadata {
                id: d.id,
                title: d.title,
                doc_type: d.doc_type,
                description: d.description,
                tags,
                document_date: d.document_date,
                expiry_date: d.expiry_date,
                favorite: d.is_favorite,
                page_count: d.page_count,
                created_at: d.created_at,
                updated_at: d.updated_at,
                thumbnail_data,
            });
        }

        self.touch_activity();
        Ok(list)
    }

    pub fn get_document(&mut self, id: &str) -> Result<DocumentDetail, String> {
        self.check_auto_lock();
        let key = self
            .active_key
            .as_ref()
            .ok_or_else(|| "Vault is locked".to_string())?;

        let conn = init_db(&self.db_path)?;
        let d = get_document_record(&conn, id)?
            .ok_or_else(|| "Document not found".to_string())?;

        let tags: Vec<String> = serde_json::from_str(&d.tags).unwrap_or_default();
        let raw_pages = get_document_pages_by_doc_id(&conn, id)?;

        let mut pages = Vec::new();
        for p in raw_pages {
            let thumbnail_data = if let (Some(nonce), Some(blob)) = (&p.thumbnail_nonce_b64, &p.thumbnail_blob_b64) {
                if let Ok(bytes) = decrypt_bytes(&key.0, nonce, blob) {
                    Some(format!("data:image/jpeg;base64,{}", BASE64.encode(bytes)))
                } else {
                    None
                }
            } else {
                None
            };

            pages.push(DocumentPage {
                id: p.id,
                document_id: p.document_id,
                page_number: p.page_number,
                mime_type: p.mime_type,
                width: p.width,
                height: p.height,
                file_size: p.file_size,
                created_at: p.created_at,
                image_data: None, // full image data loaded on-demand per page
                thumbnail_data,
            });
        }

        let first_thumb = pages.first().and_then(|p| p.thumbnail_data.clone());
        let metadata = DocumentMetadata {
            id: d.id,
            title: d.title,
            doc_type: d.doc_type,
            description: d.description,
            tags,
            document_date: d.document_date,
            expiry_date: d.expiry_date,
            favorite: d.is_favorite,
            page_count: pages.len(),
            created_at: d.created_at,
            updated_at: d.updated_at,
            thumbnail_data: first_thumb,
        };

        self.touch_activity();
        Ok(DocumentDetail { metadata, pages })
    }

    pub fn get_document_page_data(&mut self, page_id: &str) -> Result<String, String> {
        self.check_auto_lock();
        let key = self
            .active_key
            .as_ref()
            .ok_or_else(|| "Vault is locked".to_string())?;

        let conn = init_db(&self.db_path)?;
        let page = get_document_page_record(&conn, page_id)?
            .ok_or_else(|| "Document page not found".to_string())?;

        let bytes = decrypt_bytes(&key.0, &page.nonce_b64, &page.encrypted_blob_b64)?;
        self.touch_activity();
        Ok(format!("data:{};base64,{}", page.mime_type, BASE64.encode(bytes)))
    }

    pub fn save_document(&mut self, input: SaveDocumentInput) -> Result<String, String> {
        self.check_auto_lock();
        let key = self
            .active_key
            .as_ref()
            .ok_or_else(|| "Vault is locked".to_string())?;

        let conn = init_db(&self.db_path)?;

        let doc_id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let now = Utc::now().to_rfc3339();
        let tags_json = serde_json::to_string(&input.tags).unwrap_or_else(|_| "[]".to_string());

        // Check if document already exists to preserve created_at
        let existing = get_document_record(&conn, &doc_id)?;
        let created_at = existing
            .as_ref()
            .map(|e| e.created_at.clone())
            .unwrap_or_else(|| now.clone());

        save_document_record(
            &conn,
            &doc_id,
            input.title.trim(),
            input.doc_type.trim(),
            input.description.trim(),
            &tags_json,
            input.document_date.as_deref(),
            input.expiry_date.as_deref(),
            input.favorite,
            &created_at,
            &now,
        )?;

        // If pages provided, save / encrypt pages
        for (idx, page_input) in input.pages.into_iter().enumerate() {
            let page_id = page_input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
            let (mime, raw_bytes) = decode_image_payload(&page_input.image_data, &page_input.mime_type)?;

            let encrypted_page = encrypt_bytes(&key.0, &raw_bytes)?;

            let (thumb_nonce, thumb_blob) = if let Some(ref thumb_data) = page_input.thumbnail_data {
                let (_, thumb_bytes) = decode_image_payload(thumb_data, "image/jpeg")?;
                let enc_thumb = encrypt_bytes(&key.0, &thumb_bytes)?;
                (Some(enc_thumb.nonce_b64), Some(enc_thumb.ciphertext_b64))
            } else {
                (None, None)
            };

            let page_num = if page_input.page_number > 0 {
                page_input.page_number
            } else {
                idx + 1
            };

            save_document_page_record(
                &conn,
                &page_id,
                &doc_id,
                page_num,
                &mime,
                page_input.width,
                page_input.height,
                raw_bytes.len(),
                &encrypted_page.nonce_b64,
                &encrypted_page.ciphertext_b64,
                thumb_nonce.as_deref(),
                thumb_blob.as_deref(),
                &now,
            )?;
        }

        self.touch_activity();
        Ok(doc_id)
    }

    pub fn add_document_page(&mut self, document_id: &str, page_input: SavePageInput) -> Result<String, String> {
        self.check_auto_lock();
        let key = self
            .active_key
            .as_ref()
            .ok_or_else(|| "Vault is locked".to_string())?;

        let conn = init_db(&self.db_path)?;
        let existing_pages = get_document_pages_by_doc_id(&conn, document_id)?;
        let next_page_num = existing_pages.len() + 1;

        let page_id = page_input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let now = Utc::now().to_rfc3339();
        let (mime, raw_bytes) = decode_image_payload(&page_input.image_data, &page_input.mime_type)?;

        let encrypted_page = encrypt_bytes(&key.0, &raw_bytes)?;

        let (thumb_nonce, thumb_blob) = if let Some(ref thumb_data) = page_input.thumbnail_data {
            let (_, thumb_bytes) = decode_image_payload(thumb_data, "image/jpeg")?;
            let enc_thumb = encrypt_bytes(&key.0, &thumb_bytes)?;
            (Some(enc_thumb.nonce_b64), Some(enc_thumb.ciphertext_b64))
        } else {
            (None, None)
        };

        save_document_page_record(
            &conn,
            &page_id,
            document_id,
            next_page_num,
            &mime,
            page_input.width,
            page_input.height,
            raw_bytes.len(),
            &encrypted_page.nonce_b64,
            &encrypted_page.ciphertext_b64,
            thumb_nonce.as_deref(),
            thumb_blob.as_deref(),
            &now,
        )?;

        // Update document updated_at
        conn.execute(
            "UPDATE documents SET updated_at = ?1 WHERE id = ?2",
            rusqlite::params![now, document_id],
        )
        .map_err(|e| format!("Failed to update document: {}", e))?;

        self.touch_activity();
        Ok(page_id)
    }

    pub fn delete_document(&mut self, id: &str) -> Result<(), String> {
        self.check_auto_lock();
        if self.active_key.is_none() {
            return Err("Vault is locked".to_string());
        }

        let conn = init_db(&self.db_path)?;
        delete_document_record(&conn, id)?;

        self.touch_activity();
        Ok(())
    }

    pub fn delete_document_page(&mut self, page_id: &str) -> Result<String, String> {
        self.check_auto_lock();
        if self.active_key.is_none() {
            return Err("Vault is locked".to_string());
        }

        let conn = init_db(&self.db_path)?;
        let doc_id = delete_document_page_record(&conn, page_id)?;

        self.touch_activity();
        Ok(doc_id)
    }

    pub fn reorder_document_pages(&mut self, document_id: &str, page_ids: Vec<String>) -> Result<(), String> {
        self.check_auto_lock();
        if self.active_key.is_none() {
            return Err("Vault is locked".to_string());
        }

        let conn = init_db(&self.db_path)?;
        reorder_pages_record(&conn, document_id, &page_ids)?;

        self.touch_activity();
        Ok(())
    }

    pub fn toggle_document_favorite(&mut self, id: &str) -> Result<bool, String> {
        self.check_auto_lock();
        if self.active_key.is_none() {
            return Err("Vault is locked".to_string());
        }

        let conn = init_db(&self.db_path)?;
        let fav = toggle_document_favorite_record(&conn, id)?;

        self.touch_activity();
        Ok(fav)
    }
}

fn decode_image_payload(input: &str, default_mime: &str) -> Result<(String, Vec<u8>), String> {
    let mut mime = default_mime.to_string();
    let base64_str = if let Some(stripped) = input.strip_prefix("data:") {
        if let Some(comma_pos) = stripped.find(',') {
            let meta = &stripped[..comma_pos];
            if let Some(semi_pos) = meta.find(';') {
                mime = meta[..semi_pos].to_string();
            } else {
                mime = meta.to_string();
            }
            &stripped[comma_pos + 1..]
        } else {
            stripped
        }
    } else {
        input
    };

    let cleaned: String = base64_str.chars().filter(|c| !c.is_whitespace()).collect();
    let bytes = BASE64.decode(&cleaned).map_err(|e| format!("Invalid base64 image data: {}", e))?;
    Ok((mime, bytes))
}

pub type SharedVaultManager = Arc<Mutex<VaultManager>>;

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn get_test_dir(name: &str) -> PathBuf {
        let dir = env::temp_dir().join(format!("totumvault_test_{}_{}", name, Uuid::new_v4()));
        let _ = fs::create_dir_all(&dir);
        dir
    }

    #[test]
    fn test_document_lifecycle() {
        let test_dir = get_test_dir("doc_lifecycle");
        let mut mgr = VaultManager::new(test_dir.clone());
        mgr.create_vault("masterpass123!").expect("vault creation failed");

        let doc_input = SaveDocumentInput {
            id: None,
            title: "Passport".to_string(),
            doc_type: "identification".to_string(),
            description: "My personal passport".to_string(),
            tags: vec!["travel".to_string(), "id".to_string()],
            document_date: Some("2026-01-01".to_string()),
            expiry_date: Some("2036-01-01".to_string()),
            favorite: true,
            pages: vec![
                SavePageInput {
                    id: None,
                    page_number: 1,
                    mime_type: "image/jpeg".to_string(),
                    width: 800,
                    height: 600,
                    file_size: 1234,
                    image_data: format!("data:image/jpeg;base64,{}", BASE64.encode(b"fake jpeg page 1")),
                    thumbnail_data: Some(format!("data:image/jpeg;base64,{}", BASE64.encode(b"thumb 1"))),
                },
                SavePageInput {
                    id: None,
                    page_number: 2,
                    mime_type: "image/jpeg".to_string(),
                    width: 800,
                    height: 600,
                    file_size: 1234,
                    image_data: format!("data:image/jpeg;base64,{}", BASE64.encode(b"fake jpeg page 2")),
                    thumbnail_data: None,
                },
            ],
        };

        let doc_id = mgr.save_document(doc_input).expect("save_document failed");
        assert!(!doc_id.is_empty());

        let docs = mgr.list_documents().expect("list_documents failed");
        assert_eq!(docs.len(), 1);
        assert_eq!(docs[0].title, "Passport");
        assert_eq!(docs[0].page_count, 2);
        assert!(docs[0].favorite);
        assert!(docs[0].thumbnail_data.is_some());

        let detail = mgr.get_document(&doc_id).expect("get_document failed");
        assert_eq!(detail.pages.len(), 2);
        let page1_id = &detail.pages[0].id;

        let page1_data = mgr.get_document_page_data(page1_id).expect("get_page_data failed");
        assert!(page1_data.starts_with("data:image/jpeg;base64,"));
        let decoded = decode_image_payload(&page1_data, "image/jpeg").unwrap();
        assert_eq!(decoded.1, b"fake jpeg page 1");

        // Toggle favorite
        let fav = mgr.toggle_document_favorite(&doc_id).expect("toggle fav failed");
        assert!(!fav); // was true, now false

        // Delete page 1
        mgr.delete_document_page(page1_id).expect("delete page failed");
        let detail_after = mgr.get_document(&doc_id).expect("get doc after del page");
        assert_eq!(detail_after.pages.len(), 1);
        assert_eq!(detail_after.pages[0].page_number, 1);

        // Delete document
        mgr.delete_document(&doc_id).expect("delete doc failed");
        let docs_empty = mgr.list_documents().expect("list after delete");
        assert_eq!(docs_empty.len(), 0);

        let _ = fs::remove_dir_all(test_dir);
    }

    #[test]
    fn test_safe_import_add_and_duplicate_strategies() {
        let test_dir = get_test_dir("safe_import");
        let mut mgr = VaultManager::new(test_dir.clone());
        mgr.create_vault("masterpass123!").expect("vault creation failed");

        let initial_entry = DecryptedEntry {
            id: "initial_1".to_string(),
            title: "GitHub".to_string(),
            username: "alice".to_string(),
            email: "alice@example.com".to_string(),
            password: "oldpassword".to_string(),
            url: "https://github.com".to_string(),
            category: "logins".to_string(),
            ..Default::default()
        };
        mgr.save_entry(initial_entry).expect("initial save failed");

        let csv_data = "title,username,password,url\r\nGitHub,alice,newpassword,https://github.com\r\nGoogle,bob,googpass,https://google.com\r\n";

        // 1. Analyze import
        let preview = mgr.analyze_import(csv_data, None).expect("analyze failed");
        assert_eq!(preview.total_imported, 2);
        assert_eq!(preview.existing_count, 1);
        assert_eq!(preview.duplicate_count, 1);
        assert_eq!(preview.duplicates[0].imported_title, "GitHub");

        // 2. Commit import with "keep_existing"
        let res_keep = mgr.commit_import(ImportCommitOptions {
            src_path: csv_data.to_string(),
            master_password: None,
            mode: "add".to_string(),
            duplicate_strategy: "keep_existing".to_string(),
        }).expect("commit keep failed");

        assert_eq!(res_keep.added, 1); // Google added
        assert_eq!(res_keep.skipped, 1); // GitHub duplicate skipped
        assert_eq!(res_keep.duplicates, 1);

        let entries = mgr.get_entries().expect("get entries");
        assert_eq!(entries.len(), 2);
        let github = entries.iter().find(|e| e.title == "GitHub").unwrap();
        assert_eq!(github.password, "oldpassword"); // untouched!

        // 3. Commit import with "replace_existing"
        let res_replace = mgr.commit_import(ImportCommitOptions {
            src_path: csv_data.to_string(),
            master_password: None,
            mode: "add".to_string(),
            duplicate_strategy: "replace_existing".to_string(),
        }).expect("commit replace failed");

        // Both GitHub and Google are now in the vault from step 2, so both are replaced
        assert_eq!(res_replace.replaced, 2);
        assert_eq!(res_replace.duplicates, 2);
        let entries_after = mgr.get_entries().expect("get entries after replace");
        let github_replaced = entries_after.iter().find(|e| e.title == "GitHub").unwrap();
        assert_eq!(github_replaced.password, "newpassword");

        let _ = fs::remove_dir_all(test_dir);
    }

    #[test]
    fn test_backup_with_documents_roundtrip() {
        let test_dir1 = get_test_dir("roundtrip_1");
        let mut mgr1 = VaultManager::new(test_dir1.clone());
        mgr1.create_vault("mypassword123").expect("vault 1 create");

        let entry = DecryptedEntry {
            id: "e1".to_string(),
            title: "ProtonMail".to_string(),
            username: "user@pm.me".to_string(),
            category: "logins".to_string(),
            ..Default::default()
        };
        mgr1.save_entry(entry).unwrap();

        let doc = SaveDocumentInput {
            id: None,
            title: "House Deed".to_string(),
            doc_type: "contract".to_string(),
            description: "Important paperwork".to_string(),
            tags: vec!["legal".to_string()],
            document_date: Some("2026-05-01".to_string()),
            expiry_date: None,
            favorite: true,
            pages: vec![
                SavePageInput {
                    id: None,
                    page_number: 1,
                    mime_type: "image/jpeg".to_string(),
                    width: 1000,
                    height: 1000,
                    file_size: 200,
                    image_data: format!("data:image/jpeg;base64,{}", BASE64.encode(b"deed page 1")),
                    thumbnail_data: None,
                },
            ],
        };
        mgr1.save_document(doc).unwrap();

        let backup_json = mgr1.export_backup_string().expect("export backup failed");
        assert!(backup_json.contains("TOTUMVAULT_VAULT_V1"));

        // Restore into new vault manager
        let test_dir2 = get_test_dir("roundtrip_2");
        let mut mgr2 = VaultManager::new(test_dir2.clone());
        mgr2.import_backup(&backup_json, "mypassword123").expect("import backup failed");

        let entries2 = mgr2.get_entries().expect("mgr2 entries");
        assert_eq!(entries2.len(), 1);
        assert_eq!(entries2[0].title, "ProtonMail");

        let docs2 = mgr2.list_documents().expect("mgr2 docs");
        assert_eq!(docs2.len(), 1);
        assert_eq!(docs2[0].title, "House Deed");
        assert_eq!(docs2[0].page_count, 1);

        // Also test backwards compatibility with legacy VEYLOCK_VAULT_V1 backup
        let legacy_backup_json = backup_json.replace("TOTUMVAULT_VAULT_V1", "VEYLOCK_VAULT_V1");
        let test_dir3 = get_test_dir("roundtrip_3");
        let mut mgr3 = VaultManager::new(test_dir3.clone());
        mgr3.import_backup(&legacy_backup_json, "mypassword123").expect("import legacy backup failed");
        let entries3 = mgr3.get_entries().expect("mgr3 entries");
        assert_eq!(entries3.len(), 1);
        assert_eq!(entries3[0].title, "ProtonMail");

        let _ = fs::remove_dir_all(test_dir1);
        let _ = fs::remove_dir_all(test_dir2);
        let _ = fs::remove_dir_all(test_dir3);
    }

    #[test]
    fn test_login_folders_hierarchy_and_cascade() {
        let test_dir = get_test_dir("login_folders");
        let mut mgr = VaultManager::new(test_dir.clone());
        mgr.create_vault("Password123!").unwrap();

        // Create folders
        let f1 = mgr.create_login_folder("Work", None).unwrap();
        let f2 = mgr.create_login_folder("Clients", Some(f1.id.clone())).unwrap();

        let folders = mgr.get_login_folders().unwrap();
        assert_eq!(folders.len(), 2);
        assert_eq!(folders[1].parent_id, Some(f1.id.clone()));

        // Create entry in f2
        let entry = DecryptedEntry {
            id: "work_client_1".to_string(),
            title: "Client Portal".to_string(),
            username: "admin".to_string(),
            category: "logins".to_string(),
            folder_id: Some(f2.id.clone()),
            ..Default::default()
        };
        mgr.save_entry(entry).unwrap();

        // Move entry to f1
        mgr.move_entry_to_folder("work_client_1", Some(f1.id.clone())).unwrap();
        let entries = mgr.get_entries().unwrap();
        let e = entries.iter().find(|x| x.id == "work_client_1").unwrap();
        assert_eq!(e.folder_id, Some(f1.id.clone()));

        // Delete f1 unfiling contents
        mgr.delete_login_folder(&f1.id, false).unwrap();
        let folders_after = mgr.get_login_folders().unwrap();
        assert_eq!(folders_after.len(), 0); // f1 and child f2 removed

        let entries_after = mgr.get_entries().unwrap();
        let e_after = entries_after.iter().find(|x| x.id == "work_client_1").unwrap();
        assert_eq!(e_after.folder_id, None); // Unfiled to root

        let _ = fs::remove_dir_all(test_dir);
    }

    #[test]
    fn test_biometric_wrapping_lifecycle() {
        let test_dir = get_test_dir("bio_lifecycle");
        let mut mgr = VaultManager::new(test_dir.clone());
        mgr.create_vault("Password123!").unwrap();

        assert!(!mgr.is_biometric_enabled());

        // Setup biometric unlock
        let token = mgr.setup_biometric_unlock("Password123!").unwrap();
        assert!(mgr.is_biometric_enabled());

        // Lock vault
        mgr.lock_vault();
        assert!(!mgr.is_unlocked());

        // Fail unlock with wrong token
        let wrong_token = BASE64.encode([99u8; 32]);
        let unlocked = mgr.unlock_vault_biometric(&wrong_token).unwrap();
        assert!(!unlocked);
        assert!(!mgr.is_unlocked());

        // Successfully unlock with correct token
        let unlocked = mgr.unlock_vault_biometric(&token).unwrap();
        assert!(unlocked);
        assert!(mgr.is_unlocked());

        // Disable biometric unlock
        mgr.disable_biometric_unlock().unwrap();
        assert!(!mgr.is_biometric_enabled());

        // Re-enable and test password change revocation
        let _token2 = mgr.setup_biometric_unlock("Password123!").unwrap();
        assert!(mgr.is_biometric_enabled());

        mgr.change_master_password("Password123!", "NewPassword456!").unwrap();
        assert!(!mgr.is_biometric_enabled()); // Revoked on password change

        let _ = fs::remove_dir_all(test_dir);
    }
}



