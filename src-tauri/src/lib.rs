use std::sync::{Arc, Mutex};
use tauri::Manager;

pub mod clipboard;
pub mod commands;
pub mod crypto;
pub mod db;
pub mod security;
pub mod totp;
pub mod vault;

use vault::manager::{SharedVaultManager, VaultManager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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

            let manager = VaultManager::new(app_dir);
            let shared_manager: SharedVaultManager = Arc::new(Mutex::new(manager));

            app.manage(shared_manager);
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
            commands::read_source_file,
            commands::get_app_version,
            commands::get_login_folders,
            commands::create_login_folder,
            commands::rename_login_folder,
            commands::delete_login_folder,
            commands::move_entry_to_folder,
            commands::setup_biometric_unlock,
            commands::unlock_vault_biometric,
            commands::disable_biometric_unlock,
            commands::is_biometric_enabled,
            commands::check_biometric_capability,
            commands::set_screen_protection,
            commands::clear_clipboard,
            commands::clear_clipboard_if_matches,
        ])

        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
