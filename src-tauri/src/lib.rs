use std::sync::{Arc, Mutex};
use tauri::Manager;

pub mod calendar;
pub mod clipboard;
pub mod commands;
pub mod crypto;
pub mod db;
pub mod network;
pub mod reminders;
pub mod security;
pub mod totp;
pub mod vault;

use vault::manager::{SharedVaultManager, VaultManager};

pub fn resolve_app_dir() -> std::path::PathBuf {
    if let Ok(custom) = std::env::var("TOTUMVAULT_DATA_DIR") {
        return std::path::PathBuf::from(custom);
    }
    let modern = std::path::PathBuf::from("./totumvault_data");
    let legacy = std::path::PathBuf::from("./veylock_data");
    if modern.exists() {
        return modern;
    }
    if legacy.exists() {
        return legacy;
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(home) = std::env::var("HOME") {
            return std::path::PathBuf::from(home).join(".local/share/com.royalrohan.veylock");
        }
    }
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            return std::path::PathBuf::from(appdata).join("com.royalrohan.veylock");
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            return std::path::PathBuf::from(home).join("Library/Application Support/com.royalrohan.veylock");
        }
    }

    modern
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().collect();

    // Headless CLI check for background reminder scheduling without launching GUI
    if args.iter().any(|a| a == "--check-document-reminders") {
        let app_dir = if let Some(pos) = args.iter().position(|a| a == "--data-dir") {
            args.get(pos + 1).map(std::path::PathBuf::from).unwrap_or_else(resolve_app_dir)
        } else {
            resolve_app_dir()
        };
        let db_path = app_dir.join("vault.sqlite");
        if db_path.exists() {
            match reminders::service::run_headless_check(&db_path) {
                Ok(sent) => {
                    println!("TotumVault document reminder check complete. Sent: {}", sent);
                    std::process::exit(0);
                }
                Err(e) => {
                    eprintln!("TotumVault document reminder check failed: {}", e);
                    std::process::exit(1);
                }
            }
        } else {
            eprintln!("TotumVault database not found at {}", db_path.display());
            std::process::exit(0);
        }
    }

    // Development test command: schedules a near-future reminder check using native OS scheduler pipeline
    if let Some(pos) = args.iter().position(|a| a == "--schedule-test-reminder") {
        let secs = args.get(pos + 1).and_then(|s| s.parse::<u64>().ok()).unwrap_or(30);
        let app_dir = if let Some(p) = args.iter().position(|a| a == "--data-dir") {
            args.get(p + 1).map(std::path::PathBuf::from).unwrap_or_else(resolve_app_dir)
        } else {
            resolve_app_dir()
        };
        let db_path = app_dir.join("vault.sqlite");
        let service = reminders::service::DocumentReminderService::new(db_path);
        let extra_args = if args.iter().any(|a| a == "--data-dir") {
            Some(format!("--data-dir {}", app_dir.display()))
        } else {
            None
        };
        match service.schedule_test_timer_with_args(secs, extra_args.as_deref()) {
            Ok(()) => {
                println!("TotumVault test reminder scheduled successfully for {}s in the future.", secs);
                std::process::exit(0);
            }
            Err(e) => {
                eprintln!("Failed to schedule test reminder: {}", e);
                std::process::exit(1);
            }
        }
    }

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init());

    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }

    builder
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| {
                    let modern = std::path::PathBuf::from("./totumvault_data");
                    let legacy = std::path::PathBuf::from("./veylock_data");
                    if legacy.exists() && !modern.exists() {
                        legacy
                    } else {
                        modern
                    }
                });

            let network_policy = Arc::new(network::policy::NetworkPolicyService::init(app_dir.clone()));
            app.manage(network_policy);

            let manager = VaultManager::new(app_dir.clone());
            let shared_manager: SharedVaultManager = Arc::new(Mutex::new(manager));
            app.manage(shared_manager);

            let clipboard_manager = Arc::new(clipboard::service::ClipboardManager::new(app.handle().clone()));
            app.manage(clipboard_manager);

            let reminder_service = Arc::new(reminders::service::DocumentReminderService::new(app_dir.join("vault.sqlite")));
            app.manage(reminder_service.clone());
            reminders::service::DocumentReminderService::start_in_process_worker(reminder_service);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_vault_status,
            commands::create_vault,
            commands::unlock_vault,
            commands::lock_vault,
            commands::set_auto_lock_timer,
            commands::touch_user_activity,
            commands::get_entries,
            commands::save_entry,
            commands::delete_entry,
            commands::generate_password,
            commands::generate_totp_code,
            commands::validate_totp,
            commands::get_vault_health,
            commands::export_vault_backup,
            commands::export_vault_backup_string,
            commands::import_vault_backup,
            commands::analyze_import,
            commands::commit_import,
            commands::change_master_password,
            commands::export_plaintext_csv,
            commands::export_plaintext_csv_string,
            commands::import_plaintext_csv,
            commands::list_documents,
            commands::get_document,
            commands::get_document_page_data,
            commands::save_document,
            commands::add_document_page,
            commands::delete_document,
            commands::delete_document_page,
            commands::reorder_document_pages,
            commands::toggle_document_favorite,
            commands::get_document_reminder_settings,
            commands::set_document_reminder_settings,
            commands::sync_document_reminders,
            commands::test_document_reminder,
            commands::schedule_test_document_reminder,
            commands::read_source_file,
            commands::get_app_version,
            commands::get_login_folders,
            commands::create_login_folder,
            commands::rename_login_folder,
            commands::delete_login_folder,
            commands::move_entry_to_folder,
            commands::move_login_folder,
            commands::reorder_login_folders,
            commands::reorder_login_entries,
            commands::setup_biometric_unlock,
            commands::unlock_vault_biometric,
            commands::disable_biometric_unlock,
            commands::is_biometric_enabled,
            commands::check_biometric_capability,
            commands::set_screen_protection,
            commands::clear_clipboard,
            commands::clear_clipboard_if_matches,
            commands::copy_to_clipboard_secure,
            commands::track_clipboard_session,
            commands::clear_clipboard_now,
            commands::cancel_clipboard_timer,
            commands::get_clipboard_status,
            commands::get_network_policy_status,
            commands::set_air_gap_mode,
            commands::check_network_allowed,
            commands::require_network_access_command,
            commands::test_air_gap_blocking,
            commands::convert_ad_to_bs_command,
            commands::convert_bs_to_ad_command,
            commands::get_bs_month_days_command,
            commands::get_dual_date_info,
            commands::get_today_dual_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
