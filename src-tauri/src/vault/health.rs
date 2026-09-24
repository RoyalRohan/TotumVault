use std::collections::HashMap;
use super::models::{DecryptedEntry, VaultHealthReport};

pub fn evaluate_vault_health(entries: &[DecryptedEntry]) -> VaultHealthReport {
    let total_entries = entries.len();
    if total_entries == 0 {
        return VaultHealthReport {
            total_entries: 0,
            weak_passwords: 0,
            reused_passwords: 0,
            missing_totp: 0,
            total_score: 100,
        };
    }

    let mut weak_count = 0;
    let mut missing_totp_count = 0;
    let mut password_counts: HashMap<String, usize> = HashMap::new();

    for entry in entries {
        let pwd = entry.password.trim();
        let is_login_item = entry.category == "logins" || entry.category.is_empty();

        // Password weakness check (only for login items or entries with a password)
        if (is_login_item && pwd.is_empty()) || (!pwd.is_empty() && is_weak_password(pwd)) {
            weak_count += 1;
        }

        // Count password occurrences for reuse detection
        if !pwd.is_empty() {
            *password_counts.entry(pwd.to_string()).or_insert(0) += 1;
        }

        // Missing TOTP check for login items
        if is_login_item && entry.totp_secret.as_deref().unwrap_or("").trim().is_empty() {
            missing_totp_count += 1;
        }
    }

    let reused_count: usize = password_counts.values().filter(|&&c| c > 1).sum();

    // Calculate score
    let mut score: i32 = 100;
    score -= (weak_count * 15) as i32;
    score -= (reused_count * 20) as i32;
    score -= (missing_totp_count * 3) as i32;

    let final_score = score.clamp(0, 100) as u32;

    VaultHealthReport {
        total_entries,
        weak_passwords: weak_count,
        reused_passwords: reused_count,
        missing_totp: missing_totp_count,
        total_score: final_score,
    }
}

pub fn is_weak_password(password: &str) -> bool {
    if password.len() < 8 {
        return true;
    }
    let has_upper = password.chars().any(|c| c.is_ascii_uppercase());
    let has_lower = password.chars().any(|c| c.is_ascii_lowercase());
    let has_digit = password.chars().any(|c| c.is_ascii_digit());
    let has_symbol = password.chars().any(|c| !c.is_alphanumeric());

    let classes_count = [has_upper, has_lower, has_digit, has_symbol]
        .iter()
        .filter(|&&b| b)
        .count();

    if password.len() < 12 && classes_count < 3 {
        return true;
    }
    if classes_count < 2 {
        return true;
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_weak_password() {
        assert!(is_weak_password("short"));
        assert!(is_weak_password("lowercase"));
        assert!(is_weak_password("lower12345"));
        assert!(!is_weak_password("Str0ng!Passw0rd2026"));
    }

    #[test]
    fn test_evaluate_vault_health_empty() {
        let report = evaluate_vault_health(&[]);
        assert_eq!(report.total_entries, 0);
        assert_eq!(report.total_score, 100);
    }
}
