use std::collections::HashMap;
use uuid::Uuid;

use crate::crypto::aes_gcm::decrypt_bytes;
use crate::crypto::argon2_kdf::derive_kek;
use crate::crypto::key_wrap::{unwrap_vault_key, VaultKey};
use super::models::{
    BackupDocumentItem, DecryptedEntry, DuplicateItemPreview, ImportPreview, PortableVaultBackup,
};

pub fn normalize_url(raw: &str) -> String {
    let trimmed = raw.trim().to_lowercase();
    let without_scheme = trimmed
        .trim_start_matches("https://")
        .trim_start_matches("http://");
    let domain = without_scheme.split('/').next().unwrap_or("");
    let without_port = domain.split(':').next().unwrap_or("");
    without_port.trim_start_matches("www.").to_string()
}

pub fn find_matching_entry<'a>(
    candidate: &DecryptedEntry,
    existing: &'a [DecryptedEntry],
) -> Option<(&'a DecryptedEntry, &'static str)> {
    for ex in existing {
        // 1. Exact ID match (e.g. from same-vault backup)
        if !candidate.id.trim().is_empty() && candidate.id == ex.id {
            return Some((ex, "Identical item ID"));
        }

        let cat_cand = candidate.category.trim().to_lowercase();
        let cat_ex = ex.category.trim().to_lowercase();
        let same_category = cat_cand == cat_ex;

        let cand_title = candidate.title.trim().to_lowercase();
        let ex_title = ex.title.trim().to_lowercase();
        let titles_match = !cand_title.is_empty() && cand_title == ex_title;

        if same_category {
            match cat_cand.as_str() {
                "logins" => {
                    let cand_user = candidate.username.trim().to_lowercase();
                    let ex_user = ex.username.trim().to_lowercase();
                    let cand_email = candidate.email.trim().to_lowercase();
                    let ex_email = ex.email.trim().to_lowercase();
                    let cand_domain = normalize_url(&candidate.url);
                    let ex_domain = normalize_url(&ex.url);

                    let users_match = (!cand_user.is_empty() && cand_user == ex_user)
                        || (!cand_email.is_empty() && cand_email == ex_email);
                    let domains_match = !cand_domain.is_empty() && cand_domain == ex_domain;

                    if titles_match && users_match {
                        return Some((ex, "Matching title and username/email"));
                    }
                    if domains_match && users_match {
                        return Some((ex, "Matching website and username"));
                    }
                    if titles_match && domains_match {
                        return Some((ex, "Matching title and website"));
                    }
                    if titles_match && cand_user.is_empty() && ex_user.is_empty() && cand_email.is_empty() && ex_email.is_empty() {
                        return Some((ex, "Matching title"));
                    }
                }
                "totp" => {
                    let cand_issuer = candidate.totp_issuer.as_deref().unwrap_or("").trim().to_lowercase();
                    let ex_issuer = ex.totp_issuer.as_deref().unwrap_or("").trim().to_lowercase();
                    let cand_user = candidate.username.trim().to_lowercase();
                    let ex_user = ex.username.trim().to_lowercase();

                    if !cand_issuer.is_empty() && cand_issuer == ex_issuer && !cand_user.is_empty() && cand_user == ex_user {
                        return Some((ex, "Matching 2FA issuer and account"));
                    }
                    if titles_match && !cand_user.is_empty() && cand_user == ex_user {
                        return Some((ex, "Matching 2FA title and account"));
                    }
                    if titles_match && cand_user.is_empty() && ex_user.is_empty() {
                        return Some((ex, "Matching 2FA title"));
                    }
                }
                "cards" => {
                    let cand_num = candidate.card_number.as_deref().unwrap_or("").replace(|c: char| c.is_whitespace() || c == '-', "");
                    let ex_num = ex.card_number.as_deref().unwrap_or("").replace(|c: char| c.is_whitespace() || c == '-', "");
                    if !cand_num.is_empty() && cand_num == ex_num {
                        return Some((ex, "Matching card number"));
                    }
                    if titles_match {
                        return Some((ex, "Matching card title"));
                    }
                }
                "servers" => {
                    let cand_host = candidate.server_host.as_deref().unwrap_or("").trim().to_lowercase();
                    let ex_host = ex.server_host.as_deref().unwrap_or("").trim().to_lowercase();
                    let cand_user = candidate.username.trim().to_lowercase();
                    let ex_user = ex.username.trim().to_lowercase();
                    let cand_port = candidate.server_port.as_deref().unwrap_or("22").trim();
                    let ex_port = ex.server_port.as_deref().unwrap_or("22").trim();

                    if !cand_host.is_empty() && cand_host == ex_host && ((!cand_user.is_empty() && cand_user == ex_user) || cand_port == ex_port) {
                        return Some((ex, "Matching server host and user/port"));
                    }
                    if titles_match {
                        return Some((ex, "Matching server title"));
                    }
                }
                "api_credentials" => {
                    let cand_key = candidate.api_key.as_deref().unwrap_or("").trim();
                    let ex_key = ex.api_key.as_deref().unwrap_or("").trim();
                    if !cand_key.is_empty() && cand_key == ex_key {
                        return Some((ex, "Matching API key"));
                    }
                    if titles_match {
                        return Some((ex, "Matching API credential title"));
                    }
                }
                "secure_notes" | "licenses" => {
                    if titles_match {
                        return Some((ex, "Matching title"));
                    }
                }
                _ => {
                    if titles_match {
                        return Some((ex, "Matching title"));
                    }
                }

            }
        }
    }
    None
}

pub fn parse_csv_to_entries(content: &str) -> Vec<DecryptedEntry> {
    let records = parse_rfc4180_csv(content);
    if records.is_empty() {
        return Vec::new();
    }

    let mut title_idx = 0;
    let mut user_idx = 1;
    let mut email_idx = 2;
    let mut pass_idx = 3;
    let mut url_idx = 4;
    let mut cat_idx = 5;
    let mut notes_idx = 6;
    let mut totp_idx = 7;
    let mut start_row = 0;

    if let Some(first_row) = records.first() {
        let is_header = first_row.iter().any(|h| {
            let lh = h.trim().to_lowercase();
            lh == "title" || lh == "password" || lh == "username" || lh == "user"
        });

        if is_header {
            start_row = 1;
            for (idx, col) in first_row.iter().enumerate() {
                let name = col.trim().to_lowercase();
                match name.as_str() {
                    "title" | "name" => title_idx = idx,
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

    let mut entries = Vec::new();
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

        if pass.is_empty() && user.is_empty() && email.is_empty() && notes.is_empty() && totp_secret.is_none() {
            continue;
        }

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

        entries.push(entry);
    }

    entries
}

pub fn parse_backup_content(
    content: &str,
    master_password: &str,
) -> Result<(VaultKey, Vec<DecryptedEntry>, Vec<BackupDocumentItem>), String> {
    let backup: PortableVaultBackup = serde_json::from_str(content)
        .map_err(|e| format!("Invalid TotumVault backup file format: {}", e))?;

    if backup.magic != "TOTUMVAULT_VAULT_V1" && backup.magic != "VEYLOCK_VAULT_V1" {
        return Err("Incompatible vault magic header.".to_string());
    }

    let kek = derive_kek(master_password, &backup.kdf_salt_b64)?;
    let vek = unwrap_vault_key(&kek, &backup.wrapped_vek_nonce_b64, &backup.wrapped_vek_ciphertext_b64)
        .map_err(|_| "Incorrect master password for backup file.".to_string())?;

    let mut decrypted_entries = Vec::new();
    for item in backup.entries {
        if let Ok(bytes) = decrypt_bytes(&vek.0, &item.nonce_b64, &item.encrypted_payload_b64) {
            if let Ok(entry) = serde_json::from_slice::<DecryptedEntry>(&bytes) {
                decrypted_entries.push(entry);
            }
        }
    }

    Ok((vek, decrypted_entries, backup.documents))
}

pub fn analyze_import_data(
    content: &str,
    master_password: Option<&str>,
    existing_entries: &[DecryptedEntry],
) -> Result<ImportPreview, String> {
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return Err("The selected file is empty. Please select a valid .tvault encrypted backup or CSV export.".to_string());
    }
    let is_encrypted_backup = trimmed.starts_with('{')
        && trimmed.contains("\"magic\"")
        && (trimmed.contains("TOTUMVAULT_VAULT_V1") || trimmed.contains("VEYLOCK_VAULT_V1"));

    let (entries, docs_count, format_name) = if is_encrypted_backup {
        let pass = master_password
            .filter(|p| !p.trim().is_empty())
            .ok_or_else(|| "Backup master password is required to decrypt this backup file.".to_string())?;
        let (_vek, dec_entries, docs) = parse_backup_content(trimmed, pass)?;
        (dec_entries, docs.len(), "tvault".to_string())
    } else {
        if trimmed.starts_with('{') {
            return Err("The selected file appears to be JSON but is not a valid TotumVault (.tvault) or legacy (.vlock) backup.".to_string());
        }
        let dec_entries = parse_csv_to_entries(trimmed);
        if dec_entries.is_empty() {
            return Err("No valid entries found in the selected file. Please verify the file is a valid .tvault encrypted backup or CSV export.".to_string());
        }
        (dec_entries, 0, "csv".to_string())
    };

    let mut duplicates = Vec::new();
    let mut categories_breakdown: HashMap<String, usize> = HashMap::new();

    for (idx, item) in entries.iter().enumerate() {
        *categories_breakdown.entry(item.category.clone()).or_insert(0) += 1;

        if let Some((matching, reason)) = find_matching_entry(item, existing_entries) {
            duplicates.push(DuplicateItemPreview {
                imported_title: item.title.clone(),
                existing_title: matching.title.clone(),
                category: item.category.clone(),
                reason: reason.to_string(),
                existing_id: matching.id.clone(),
                imported_index: idx,
            });
        }
    }

    Ok(ImportPreview {
        total_imported: entries.len(),
        existing_count: existing_entries.len(),
        duplicate_count: duplicates.len(),
        duplicates,
        categories_breakdown,
        format: format_name,
        has_documents: docs_count > 0,
        documents_count: docs_count,
    })
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
                    chars.next();
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_duplicate_matching_logins() {
        let existing = vec![
            DecryptedEntry {
                id: "e1".to_string(),
                title: "GitHub".to_string(),
                username: "alice".to_string(),
                email: "alice@example.com".to_string(),
                url: "https://github.com/login".to_string(),
                category: "logins".to_string(),
                ..Default::default()
            },
        ];

        let candidate_dup = DecryptedEntry {
            id: "cand1".to_string(),
            title: "GitHub".to_string(),
            username: "alice".to_string(),
            url: "https://github.com".to_string(),
            category: "logins".to_string(),
            ..Default::default()
        };

        let result = find_matching_entry(&candidate_dup, &existing);
        assert!(result.is_some());
        assert_eq!(result.unwrap().0.id, "e1");

        let candidate_different = DecryptedEntry {
            id: "cand2".to_string(),
            title: "GitLab".to_string(),
            username: "bob".to_string(),
            url: "https://gitlab.com".to_string(),
            category: "logins".to_string(),
            ..Default::default()
        };

        let result2 = find_matching_entry(&candidate_different, &existing);
        assert!(result2.is_none());
    }

    #[test]
    fn test_duplicate_matching_totp() {
        let existing = vec![
            DecryptedEntry {
                id: "t1".to_string(),
                title: "Google 2FA".to_string(),
                username: "user@gmail.com".to_string(),
                totp_issuer: Some("Google".to_string()),
                category: "totp".to_string(),
                ..Default::default()
            },
        ];

        let candidate_dup = DecryptedEntry {
            id: "cand_t".to_string(),
            title: "Google Auth".to_string(),
            username: "user@gmail.com".to_string(),
            totp_issuer: Some("Google".to_string()),
            category: "totp".to_string(),
            ..Default::default()
        };

        let result = find_matching_entry(&candidate_dup, &existing);
        assert!(result.is_some());
    }

    #[test]
    fn test_analyze_import_invalid_json_fails() {
        let bad_json = r#"{"some_random_key": "some_value"}"#;
        let res = analyze_import_data(bad_json, Some("pass"), &[]);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("not a valid TotumVault (.tvault) or legacy (.vlock) backup"));
    }

    #[test]
    fn test_analyze_import_corrupted_empty_fails() {
        let empty_res = analyze_import_data("", None, &[]);
        assert!(empty_res.is_err());
        assert!(empty_res.unwrap_err().contains("empty"));

        let single_col_garbage = "random text without any credentials";
        let res = analyze_import_data(single_col_garbage, None, &[]);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("No valid entries found"));
    }
}
