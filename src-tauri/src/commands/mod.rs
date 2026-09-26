use std::fs;
#[cfg(not(target_os = "android"))]
use tauri::Manager;
use tauri::State;
use uuid::Uuid;

use crate::totp::generator::{generate_totp_code as calc_totp, validate_totp_secret};
use crate::vault::health::evaluate_vault_health;
use crate::vault::manager::SharedVaultManager;
use crate::security::{apply_screen_protection, ScreenProtectionStatus};
use crate::vault::models::{
    DecryptedEntry, DocumentDetail, DocumentMetadata, ImportCommitOptions, ImportPreview,
    ImportResultSummary, LoginFolder, PwGenConfig, SaveDocumentInput, SavePageInput, TotpResult,
    VaultHealthReport, VaultStatus,
};

use crate::vault::password_gen::generate_password_csprng;

#[tauri::command]
pub fn get_vault_status(state: State<'_, SharedVaultManager>) -> Result<VaultStatus, String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.check_auto_lock();

    let entry_count = if manager.is_unlocked() {
        manager.get_entries().map(|e| e.len()).unwrap_or(0)
    } else {
        0
    };

    Ok(VaultStatus {
        exists: manager.is_initialized(),
        unlocked: manager.is_unlocked(),
        auto_lock_minutes: manager.auto_lock_minutes(),
        entry_count,
    })
}

#[tauri::command]
pub fn create_vault(
    state: State<'_, SharedVaultManager>,
    master_password: String,
) -> Result<VaultStatus, String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.create_vault(&master_password)?;

    Ok(VaultStatus {
        exists: true,
        unlocked: true,
        auto_lock_minutes: manager.auto_lock_minutes(),
        entry_count: 0,
    })
}

#[tauri::command]
pub fn unlock_vault(
    state: State<'_, SharedVaultManager>,
    master_password: String,
) -> Result<bool, String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.unlock_vault(&master_password)
}

#[tauri::command]
pub fn lock_vault(state: State<'_, SharedVaultManager>) -> Result<(), String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.lock_vault();
    Ok(())
}

#[tauri::command]
pub fn set_auto_lock_timer(state: State<'_, SharedVaultManager>, minutes: u32) -> Result<(), String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.set_auto_lock_minutes(minutes);
    Ok(())
}

#[tauri::command]
pub fn touch_user_activity(state: State<'_, SharedVaultManager>) -> Result<(), String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.touch_activity();
    Ok(())
}

#[tauri::command]
pub fn get_entries(state: State<'_, SharedVaultManager>) -> Result<Vec<DecryptedEntry>, String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.get_entries()
}

#[tauri::command]
pub fn save_entry(
    state: State<'_, SharedVaultManager>,
    entry: DecryptedEntry,
) -> Result<String, String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.save_entry(entry)
}

#[tauri::command]
pub fn delete_entry(state: State<'_, SharedVaultManager>, id: String) -> Result<(), String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.delete_entry(&id)
}

#[tauri::command]
pub fn generate_password(config: PwGenConfig) -> Result<String, String> {
    generate_password_csprng(&config)
}

#[tauri::command]
pub fn generate_totp_code(
    secret: String,
    digits: Option<u32>,
    period: Option<u64>,
) -> Result<TotpResult, String> {
    if secret.trim().is_empty() {
        return Err("Secret is empty".to_string());
    }
    let (code, time_remaining) = calc_totp(&secret, digits, period)?;
    Ok(TotpResult { code, time_remaining })
}

#[tauri::command]
pub fn validate_totp(secret: String) -> Result<bool, String> {
    if secret.trim().is_empty() {
        return Ok(false);
    }
    validate_totp_secret(&secret)
}

#[tauri::command]
pub fn get_vault_health(state: State<'_, SharedVaultManager>) -> Result<VaultHealthReport, String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    let entries = manager.get_entries()?;
    Ok(evaluate_vault_health(&entries))
}

fn write_to_destination(app: &tauri::AppHandle, path: &str, data: &str) -> Result<(), String> {
    if path.starts_with("content://") {
        #[cfg(target_os = "android")]
        {
            use std::io::Write;
            use std::str::FromStr;
            use tauri_plugin_fs::{FilePath, FsExt, OpenOptions};

            let mut opts = OpenOptions::new();
            opts.write(true).truncate(true).create(true);

            let target = FilePath::from_str(path)
                .map_err(|e| format!("Failed to parse destination URI: {}", e))?;

            let mut file = app
                .fs()
                .open(target, opts)
                .map_err(|e| format!("Failed to open destination URI: {}", e))?;
            file.write_all(data.as_bytes())
                .map_err(|e| format!("Failed to write data: {}", e))?;
            file.flush()
                .map_err(|e| format!("Failed to flush data: {}", e))?;
            return Ok(());
        }
        #[cfg(not(target_os = "android"))]
        {
            let _ = app;
            return Err("Content URIs are only supported on Android".to_string());
        }
    }

    let p = std::path::Path::new(path);
    if let Some(parent) = p.parent() {
        if !parent.as_os_str().is_empty() {
            let _ = fs::create_dir_all(parent);
        }
    }
    fs::write(p, data).map_err(|e| format!("Failed to write file to disk ({}): {}", path, e))
}

fn read_from_source(app: &tauri::AppHandle, src: &str) -> Result<String, String> {
    if src.trim().starts_with('{') || src.contains('\n') || src.starts_with("title") || src.starts_with("Title") {
        return Ok(src.to_string());
    }

    if src.starts_with("content://") {
        #[cfg(target_os = "android")]
        {
            use std::io::Read;
            use std::str::FromStr;
            use tauri_plugin_fs::{FilePath, FsExt, OpenOptions};

            let mut opts = OpenOptions::new();
            opts.read(true);

            let source = FilePath::from_str(src)
                .map_err(|e| format!("Failed to parse source URI: {}", e))?;

            let mut file = app
                .fs()
                .open(source, opts)
                .map_err(|e| format!("Failed to open source URI: {}", e))?;
            let mut buf = String::new();
            file.read_to_string(&mut buf)
                .map_err(|e| format!("Failed to read source URI: {}", e))?;
            return Ok(buf);
        }
        #[cfg(not(target_os = "android"))]
        {
            let _ = app;
            return Err("Content URIs are only supported on Android".to_string());
        }
    }

    fs::read_to_string(src).map_err(|e| format!("Failed to read file from {}: {}", src, e))
}

#[tauri::command]
pub fn read_source_file(app: tauri::AppHandle, path: String) -> Result<String, String> {
    read_from_source(&app, &path)
}

fn resolve_save_path(app: &tauri::AppHandle, custom_path: Option<&str>, ext: &str) -> Result<String, String> {
    if let Some(p) = custom_path {
        let p = p.trim();
        if !p.is_empty() {
            if p.starts_with("content://") {
                return Ok(p.to_string());
            }
            let path = std::path::Path::new(p);
            if path.is_absolute() {
                return Ok(p.to_string());
            }
        }
    }

    #[cfg(target_os = "android")]
    {
        let _ = (app, ext);
        return Err("Please choose a location to save your backup using the system file picker.".to_string());
    }

    #[cfg(not(target_os = "android"))]
    {
        let date = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let filename = format!("totumvault_backup_{}.{}", date, ext);

        // Try Tauri download_dir()
        if let Ok(dl) = app.path().download_dir() {
            return Ok(dl.join(&filename).to_string_lossy().to_string());
        }

        // Try Tauri document_dir()
        if let Ok(doc) = app.path().document_dir() {
            return Ok(doc.join(&filename).to_string_lossy().to_string());
        }

        // Try home directory Downloads
        if let Ok(home) = app.path().home_dir() {
            let downloads = home.join("Downloads");
            if downloads.exists() {
                return Ok(downloads.join(&filename).to_string_lossy().to_string());
            }
            return Ok(home.join(&filename).to_string_lossy().to_string());
        }

        Err("Could not automatically determine downloads directory. Please specify a file path.".to_string())
    }
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct ExportResult {
    pub path: String,
    pub content: String,
}

#[tauri::command]
pub fn export_vault_backup_string(
    state: State<'_, SharedVaultManager>,
) -> Result<String, String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.export_backup_string()
}

#[tauri::command]
pub fn export_vault_backup(
    app: tauri::AppHandle,
    state: State<'_, SharedVaultManager>,
    dest_path: Option<String>,
) -> Result<ExportResult, String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    let json_str = manager.export_backup_string()?;

    let target_path = resolve_save_path(&app, dest_path.as_deref(), "tvault")?;
    write_to_destination(&app, &target_path, &json_str)?;

    Ok(ExportResult {
        path: target_path,
        content: json_str,
    })
}

#[tauri::command]
pub fn import_vault_backup(
    app: tauri::AppHandle,
    state: State<'_, SharedVaultManager>,
    src_path: String,
    master_password: String,
) -> Result<(), String> {
    let content = read_from_source(&app, &src_path)?;
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.import_backup(&content, &master_password)
}

#[tauri::command]
pub fn analyze_import(
    app: tauri::AppHandle,
    state: State<'_, SharedVaultManager>,
    src_path: String,
    master_password: Option<String>,
) -> Result<ImportPreview, String> {
    let content = read_from_source(&app, &src_path)?;
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.analyze_import(&content, master_password.as_deref())
}

#[tauri::command]
pub fn commit_import(
    app: tauri::AppHandle,
    state: State<'_, SharedVaultManager>,
    mut options: ImportCommitOptions,
) -> Result<ImportResultSummary, String> {
    let content = read_from_source(&app, &options.src_path)?;
    options.src_path = content;
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.commit_import(options)
}

#[tauri::command]
pub fn list_documents(
    state: State<'_, SharedVaultManager>,
) -> Result<Vec<DocumentMetadata>, String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.list_documents()
}

#[tauri::command]
pub fn get_document(
    state: State<'_, SharedVaultManager>,
    id: String,
) -> Result<DocumentDetail, String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.get_document(&id)
}

#[tauri::command]
pub fn get_document_page_data(
    state: State<'_, SharedVaultManager>,
    page_id: String,
) -> Result<String, String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.get_document_page_data(&page_id)
}

#[tauri::command]
pub fn save_document(
    state: State<'_, SharedVaultManager>,
    document: SaveDocumentInput,
) -> Result<String, String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.save_document(document)
}

#[tauri::command]
pub fn add_document_page(
    state: State<'_, SharedVaultManager>,
    document_id: String,
    page: SavePageInput,
) -> Result<String, String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.add_document_page(&document_id, page)
}

#[tauri::command]
pub fn delete_document(
    state: State<'_, SharedVaultManager>,
    id: String,
) -> Result<(), String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.delete_document(&id)
}

#[tauri::command]
pub fn delete_document_page(
    state: State<'_, SharedVaultManager>,
    page_id: String,
) -> Result<String, String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.delete_document_page(&page_id)
}

#[tauri::command]
pub fn reorder_document_pages(
    state: State<'_, SharedVaultManager>,
    document_id: String,
    page_ids: Vec<String>,
) -> Result<(), String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.reorder_document_pages(&document_id, page_ids)
}

#[tauri::command]
pub fn toggle_document_favorite(
    state: State<'_, SharedVaultManager>,
    id: String,
) -> Result<bool, String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.toggle_document_favorite(&id)
}


#[tauri::command]
pub fn change_master_password(
    state: State<'_, SharedVaultManager>,
    old_password: String,
    new_password: String,
) -> Result<(), String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.change_master_password(&old_password, &new_password)
}

#[tauri::command]
pub fn export_plaintext_csv_string(
    state: State<'_, SharedVaultManager>,
) -> Result<String, String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    let entries = manager.get_entries()?;

    let mut csv_out = String::from("title,username,email,password,url,category,notes,totp_secret\r\n");
    for e in entries {
        let title = escape_csv(&e.title);
        let user = escape_csv(&e.username);
        let email = escape_csv(&e.email);
        let pass = escape_csv(&e.password);
        let url = escape_csv(&e.url);
        let cat = escape_csv(&e.category);
        let notes = escape_csv(&e.notes);
        let totp = escape_csv(e.totp_secret.as_deref().unwrap_or(""));

        csv_out.push_str(&format!(
            "{},{},{},{},{},{},{},{}\r\n",
            title, user, email, pass, url, cat, notes, totp
        ));
    }
    Ok(csv_out)
}

#[tauri::command]
pub fn export_plaintext_csv(
    app: tauri::AppHandle,
    state: State<'_, SharedVaultManager>,
    dest_path: Option<String>,
) -> Result<ExportResult, String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    let entries = manager.get_entries()?;

    let mut csv_out = String::from("title,username,email,password,url,category,notes,totp_secret\r\n");
    for e in entries {
        let title = escape_csv(&e.title);
        let user = escape_csv(&e.username);
        let email = escape_csv(&e.email);
        let pass = escape_csv(&e.password);
        let url = escape_csv(&e.url);
        let cat = escape_csv(&e.category);
        let notes = escape_csv(&e.notes);
        let totp = escape_csv(e.totp_secret.as_deref().unwrap_or(""));

        csv_out.push_str(&format!(
            "{},{},{},{},{},{},{},{}\r\n",
            title, user, email, pass, url, cat, notes, totp
        ));
    }

    let target_path = resolve_save_path(&app, dest_path.as_deref(), "csv")?;
    write_to_destination(&app, &target_path, &csv_out)?;

    Ok(ExportResult {
        path: target_path,
        content: csv_out,
    })
}

fn escape_csv(val: &str) -> String {
    let mut sanitized = val.to_string();
    // Neutralize formula injection in spreadsheet software (Excel, LibreOffice)
    if let Some(first) = sanitized.chars().next() {
        if matches!(first, '=' | '+' | '-' | '@' | '\t' | '\r') {
            sanitized = format!("'{}", sanitized);
        }
    }

    if sanitized.contains(',')
        || sanitized.contains('"')
        || sanitized.contains('\n')
        || sanitized.contains('\r')
        || sanitized.starts_with('\'')
    {
        format!("\"{}\"", sanitized.replace('"', "\"\""))
    } else {
        sanitized
    }
}

fn clean_csv_field(val: &str) -> String {
    let trimmed = val.trim();
    if let Some(stripped) = trimmed.strip_prefix('\'') {
        if let Some(first) = stripped.chars().next() {
            if matches!(first, '=' | '+' | '-' | '@' | '\t' | '\r') {
                return stripped.to_string();
            }
        }
    }
    trimmed.to_string()
}

fn parse_rfc4180_csv(input: &str) -> Vec<Vec<String>> {
    let mut records = Vec::new();
    let mut current_record = Vec::new();
    let mut current_field = String::new();
    let mut in_quotes = false;
    let mut chars = input.chars().peekable();

    while let Some(c) = chars.next() {
        if in_quotes {
            if c == '"' {
                if chars.peek() == Some(&'"') {
                    chars.next(); // consume escaped quote
                    current_field.push('"');
                } else {
                    in_quotes = false;
                }
            } else {
                current_field.push(c);
            }
        } else {
            match c {
                '"' => {
                    in_quotes = true;
                }
                ',' => {
                    current_record.push(std::mem::take(&mut current_field));
                }
                '\r' => {
                    if chars.peek() == Some(&'\n') {
                        chars.next();
                    }
                    current_record.push(std::mem::take(&mut current_field));
                    if !current_record.iter().all(|f| f.trim().is_empty()) {
                        records.push(std::mem::take(&mut current_record));
                    } else {
                        current_record.clear();
                    }
                }
                '\n' => {
                    current_record.push(std::mem::take(&mut current_field));
                    if !current_record.iter().all(|f| f.trim().is_empty()) {
                        records.push(std::mem::take(&mut current_record));
                    } else {
                        current_record.clear();
                    }
                }
                _ => {
                    current_field.push(c);
                }
            }
        }
    }

    if !current_field.is_empty() || !current_record.is_empty() {
        current_record.push(current_field);
        if !current_record.iter().all(|f| f.trim().is_empty()) {
            records.push(current_record);
        }
    }

    records
}

#[tauri::command]
pub fn import_plaintext_csv(
    app: tauri::AppHandle,
    state: State<'_, SharedVaultManager>,
    src_path: String,
) -> Result<usize, String> {
    let content = read_from_source(&app, &src_path)?;

    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    if !manager.is_unlocked() {
        return Err("Vault is locked".to_string());
    }

    let records = parse_rfc4180_csv(&content);
    if records.is_empty() {
        return Ok(0);
    }

    let mut count = 0;
    let mut title_idx = 0;
    let mut user_idx = 1;
    let mut email_idx = 2;
    let mut pass_idx = 3;
    let mut url_idx = 4;
    let mut cat_idx = 5;
    let mut notes_idx = 6;
    let mut totp_idx = 7;
    let mut start_row = 0;

    // Check if first row is header
    if let Some(first_row) = records.first() {
        let is_header = first_row.iter().any(|h| {
            let lh = h.trim().to_lowercase();
            lh == "title" || lh == "password" || lh == "username"
        });

        if is_header {
            start_row = 1;
            for (idx, col) in first_row.iter().enumerate() {
                let name = col.trim().to_lowercase();
                match name.as_str() {
                    "title" => title_idx = idx,
                    "username" | "user" | "login" => user_idx = idx,
                    "email" => email_idx = idx,
                    "password" | "pass" => pass_idx = idx,
                    "url" | "website" => url_idx = idx,
                    "category" => cat_idx = idx,
                    "notes" | "note" => notes_idx = idx,
                    "totp_secret" | "totp" | "otp" => totp_idx = idx,
                    _ => {}
                }
            }
        }
    }

    for row in records.into_iter().skip(start_row) {
        if row.is_empty() {
            continue;
        }

        let title = row.get(title_idx).map(|s| clean_csv_field(s)).unwrap_or_default();
        let pass = row.get(pass_idx).map(|s| clean_csv_field(s)).unwrap_or_default();
        if title.is_empty() && pass.is_empty() {
            continue;
        }

        let user = row.get(user_idx).map(|s| clean_csv_field(s)).unwrap_or_default();
        let email = row.get(email_idx).map(|s| clean_csv_field(s)).unwrap_or_default();
        let url = row.get(url_idx).map(|s| clean_csv_field(s)).unwrap_or_default();
        let mut category = row.get(cat_idx).map(|s| clean_csv_field(s)).unwrap_or_else(|| "logins".to_string());
        if category.is_empty() {
            category = "logins".to_string();
        }
        let notes = row.get(notes_idx).map(|s| clean_csv_field(s)).unwrap_or_default();
        let totp_secret = row.get(totp_idx).map(|s| clean_csv_field(s)).filter(|s| !s.is_empty());

        let entry = DecryptedEntry {
            id: Uuid::new_v4().to_string(),
            title: if title.is_empty() { "Imported Credential".to_string() } else { title },
            username: user,
            email,
            password: pass,
            url,
            category,
            notes,
            favorite: false,
            tags: vec![],
            custom_fields: vec![],
            totp_secret,
            totp_issuer: None,
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
            last_used_at: None,
            ..Default::default()
        };

        if manager.save_entry(entry).is_ok() {
            count += 1;
        }
    }

    Ok(count)
}

#[derive(serde::Serialize)]
pub struct AppVersionInfo {
    pub version: String,
    pub os: String,
    pub arch: String,
}

#[tauri::command]
pub fn get_app_version() -> AppVersionInfo {
    AppVersionInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    }
}

#[tauri::command]
pub fn get_login_folders(state: State<'_, SharedVaultManager>) -> Result<Vec<LoginFolder>, String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.get_login_folders()
}

#[tauri::command]
pub fn create_login_folder(
    state: State<'_, SharedVaultManager>,
    name: String,
    parent_id: Option<String>,
) -> Result<LoginFolder, String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.create_login_folder(&name, parent_id)
}

#[tauri::command]
pub fn rename_login_folder(
    state: State<'_, SharedVaultManager>,
    id: String,
    name: String,
) -> Result<(), String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.rename_login_folder(&id, &name)
}

#[tauri::command]
pub fn delete_login_folder(
    state: State<'_, SharedVaultManager>,
    id: String,
    delete_contents: bool,
) -> Result<(), String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.delete_login_folder(&id, delete_contents)
}

#[tauri::command]
pub fn move_entry_to_folder(
    state: State<'_, SharedVaultManager>,
    entry_id: String,
    folder_id: Option<String>,
) -> Result<(), String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.move_entry_to_folder(&entry_id, folder_id)
}

#[tauri::command]
pub fn setup_biometric_unlock(
    state: State<'_, SharedVaultManager>,
    master_password: String,
) -> Result<String, String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.setup_biometric_unlock(&master_password)
}

#[tauri::command]
pub fn unlock_vault_biometric(
    state: State<'_, SharedVaultManager>,
    biometric_token: String,
) -> Result<bool, String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.unlock_vault_biometric(&biometric_token)
}

#[tauri::command]
pub fn disable_biometric_unlock(state: State<'_, SharedVaultManager>) -> Result<(), String> {
    let mut manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    manager.disable_biometric_unlock()
}

#[tauri::command]
pub fn is_biometric_enabled(state: State<'_, SharedVaultManager>) -> Result<bool, String> {
    let manager = state.lock().map_err(|_| "Failed to acquire vault lock")?;
    Ok(manager.is_biometric_enabled())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BiometricCapability {
    pub supported: bool,
    pub platform: String,
    pub description: String,
}

#[tauri::command]
pub fn check_biometric_capability() -> Result<BiometricCapability, String> {
    #[cfg(target_os = "android")]
    {
        Ok(BiometricCapability {
            supported: true,
            platform: "android".to_string(),
            description: "Android BiometricPrompt & Keystore hardware capability".to_string(),
        })
    }
    #[cfg(target_os = "linux")]
    {
        Ok(BiometricCapability {
            supported: false,
            platform: "linux".to_string(),
            description: "Biometric hardware is not available on standard Linux desktop; master password is used".to_string(),
        })
    }
    #[cfg(target_os = "windows")]
    {
        Ok(BiometricCapability {
            supported: false,
            platform: "windows".to_string(),
            description: "Windows Hello biometric integration requires hardware enrollment".to_string(),
        })
    }
    #[cfg(target_os = "macos")]
    {
        Ok(BiometricCapability {
            supported: false,
            platform: "macos".to_string(),
            description: "Touch ID requires local authentication hardware".to_string(),
        })
    }
    #[cfg(not(any(target_os = "android", target_os = "linux", target_os = "windows", target_os = "macos")))]
    {
        Ok(BiometricCapability {
            supported: false,
            platform: "unknown".to_string(),
            description: "Biometric authentication not supported on this platform".to_string(),
        })
    }
}

#[tauri::command]
pub fn set_screen_protection(
    app: tauri::AppHandle,
    enabled: bool,
) -> Result<ScreenProtectionStatus, String> {
    apply_screen_protection(&app, enabled)
}

#[tauri::command]
pub fn clear_clipboard(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    let _ = app.clipboard().clear();
    crate::clipboard::manager::clear_os_clipboard();
    Ok(())
}

#[tauri::command]
pub fn clear_clipboard_if_matches(app: tauri::AppHandle, expected: String) -> Result<bool, String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    if let Ok(current) = app.clipboard().read_text() {
        if current == expected {
            let _ = app.clipboard().clear();
            crate::clipboard::manager::clear_os_clipboard();
            return Ok(true);
        }
    }
    Ok(false)
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_escape_csv_formula_injection() {
        assert_eq!(escape_csv("=SUM(A1:B1)"), "\"'=SUM(A1:B1)\"");
        assert_eq!(escape_csv("+12345"), "\"'+12345\"");
        assert_eq!(escape_csv("-cmd"), "\"'-cmd\"");
        assert_eq!(escape_csv("hello, world"), "\"hello, world\"");
    }

    #[test]
    fn test_clean_csv_field() {
        assert_eq!(clean_csv_field("'=SUM(A1:B1)"), "=SUM(A1:B1)");
        assert_eq!(clean_csv_field("normal_text"), "normal_text");
    }

    #[test]
    fn test_parse_rfc4180_csv() {
        let raw = "title,username,password\r\n\"Google, Inc.\",user@example.com,\"p@ss\"\"word\"\r\n";
        let records = parse_rfc4180_csv(raw);
        assert_eq!(records.len(), 2);
        assert_eq!(records[1][0], "Google, Inc.");
        assert_eq!(records[1][1], "user@example.com");
        assert_eq!(records[1][2], "p@ss\"word");
    }
}
