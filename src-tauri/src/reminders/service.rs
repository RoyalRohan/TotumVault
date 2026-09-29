use std::path::{Path, PathBuf};
use std::sync::Arc;
use chrono::Local;

use crate::db::sqlite::{
    get_document_record, get_documents_for_reminder_check, get_metadata, init_db, save_metadata,
    update_document_reminder_state,
};
use crate::vault::models::DocumentReminderSettings;

use super::calc::evaluate_reminder;
use super::scheduler::{create_default_scheduler, DocumentReminderScheduler};

pub struct DocumentReminderService {
    db_path: PathBuf,
    scheduler: Box<dyn DocumentReminderScheduler>,
}

impl DocumentReminderService {
    pub fn new(db_path: PathBuf) -> Self {
        Self {
            db_path,
            scheduler: create_default_scheduler(),
        }
    }

    pub fn with_scheduler(db_path: PathBuf, scheduler: Box<dyn DocumentReminderScheduler>) -> Self {
        Self { db_path, scheduler }
    }

    pub fn is_globally_enabled(&self) -> bool {
        if let Ok(conn) = init_db(&self.db_path) {
            match get_metadata(&conn, "document_reminders_enabled") {
                Ok(Some(val)) => val.trim() != "0",
                _ => true, // default: enabled
            }
        } else {
            true
        }
    }

    pub fn set_globally_enabled(&self, enabled: bool) -> Result<(), String> {
        let conn = init_db(&self.db_path)?;
        let val = if enabled { "1" } else { "0" };
        save_metadata(&conn, "document_reminders_enabled", val)?;

        if enabled {
            if let Ok(exec_path) = std::env::current_exe() {
                let _ = self.scheduler.setup_platform_schedule(&exec_path);
            }
            let _ = self.check_and_deliver_reminders();
        } else {
            let _ = self.scheduler.teardown_platform_schedule();
        }

        Ok(())
    }

    pub fn get_settings(&self) -> Result<DocumentReminderSettings, String> {
        let enabled = self.is_globally_enabled();
        Ok(DocumentReminderSettings {
            enabled,
            default_delivery_time: "09:00".to_string(),
        })
    }

    pub fn check_and_deliver_reminders(&self) -> Result<usize, String> {
        if !self.is_globally_enabled() {
            return Ok(0);
        }

        let conn = init_db(&self.db_path)?;
        let targets = get_documents_for_reminder_check(&conn)?;
        let today = Local::now().date_naive();

        let mut sent_count = 0;

        for target in targets {
            let due = evaluate_reminder(
                &target.id,
                &target.title,
                &target.expiry_date,
                target.reminder_enabled,
                target.last_reminder_milestone,
                target.last_reminder_date.as_deref(),
                today,
            );

            if let Some(reminder) = due {
                // Dispatch native OS notification
                let send_res = self.scheduler.send_notification("TotumVault Document Reminder", &reminder.message);
                if let Err(e) = send_res {
                    eprintln!("Failed to dispatch OS notification for {}: {}", reminder.document_id, e);
                }

                // Update state in SQLite
                if let Err(e) = update_document_reminder_state(
                    &conn,
                    &reminder.document_id,
                    reminder.milestone.value(),
                    &reminder.target_date,
                ) {
                    eprintln!("Failed to update reminder state in DB for {}: {}", reminder.document_id, e);
                } else {
                    sent_count += 1;
                }
            }
        }

        Ok(sent_count)
    }

    pub fn test_document_reminder(&self, doc_id: &str) -> Result<String, String> {
        let conn = init_db(&self.db_path)?;
        let doc = get_document_record(&conn, doc_id)?
            .ok_or_else(|| format!("Document with ID '{}' not found", doc_id))?;

        let body = if let Some(ref exp) = doc.expiry_date {
            let today = Local::now().date_naive();
            if let Some(due) = evaluate_reminder(
                &doc.id,
                &doc.title,
                exp,
                true,
                None,
                None,
                today,
            ) {
                due.message
            } else {
                format!("{} expires on {}.", doc.title, exp)
            }
        } else {
            format!("{} has no configured expiry date.", doc.title)
        };

        self.scheduler
            .send_notification("TotumVault Document Reminder", &body)?;

        Ok(format!("Test notification sent for '{}'", doc.title))
    }

    pub fn schedule_test_timer(&self, delay_secs: u64) -> Result<(), String> {
        let exec_path = std::env::current_exe().map_err(|e| format!("Failed to get current executable path: {}", e))?;
        self.scheduler.schedule_test_timer(&exec_path, delay_secs, None)
    }

    pub fn schedule_test_timer_with_args(&self, delay_secs: u64, extra_args: Option<&str>) -> Result<(), String> {
        let exec_path = std::env::current_exe().map_err(|e| format!("Failed to get current executable path: {}", e))?;
        self.scheduler.schedule_test_timer(&exec_path, delay_secs, extra_args)
    }

    pub fn reconcile_all(&self) -> Result<(), String> {
        if self.is_globally_enabled() {
            if let Ok(exec_path) = std::env::current_exe() {
                let _ = self.scheduler.setup_platform_schedule(&exec_path);
            }
            let _ = self.check_and_deliver_reminders();
        } else {
            let _ = self.scheduler.teardown_platform_schedule();
        }
        Ok(())
    }

    pub fn start_in_process_worker(service: Arc<DocumentReminderService>) {
        std::thread::spawn(move || {
            // Initial check on app startup (slight delay so UI finishes initializing)
            std::thread::sleep(std::time::Duration::from_secs(3));
            let _ = service.check_and_deliver_reminders();

            // Periodic monitoring loop: wake up every 1 hour to check
            loop {
                std::thread::sleep(std::time::Duration::from_secs(3600));
                let _ = service.check_and_deliver_reminders();
            }
        });
    }
}

/// Headless entrypoint invoked when CLI argument `--check-document-reminders` is passed.
pub fn run_headless_check(db_path: &Path) -> Result<usize, String> {
    let service = DocumentReminderService::new(db_path.to_path_buf());
    service.check_and_deliver_reminders()
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::scheduler::MockReminderScheduler;
    use crate::db::sqlite::save_document_record;
    use std::fs;
    use uuid::Uuid;

    fn get_test_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("totumvault_test_rem_{}_{}", name, Uuid::new_v4()));
        let _ = fs::create_dir_all(&dir);
        dir
    }

    #[test]
    fn test_service_reminders_delivery_and_idempotency() {
        let dir = get_test_dir("delivery_idempotency");
        let db_path = dir.join("test_vault.sqlite");

        let mock_scheduler = Box::new(MockReminderScheduler::default());
        let sent_list = mock_scheduler.sent_notifications.clone();

        let service = DocumentReminderService::with_scheduler(db_path.clone(), mock_scheduler);

        // Populate test document expiring in 3 days
        let today = Local::now().date_naive();
        let expiry = today + chrono::Duration::days(3);
        let expiry_str = expiry.format("%Y-%m-%d").to_string();

        let conn = init_db(&db_path).unwrap();
        save_document_record(
            &conn,
            "doc-123",
            "Driving License",
            "identification",
            "Personal license",
            "[]",
            None,
            Some(&expiry_str),
            false,
            true,
            None,
            None,
            "2026-01-01T00:00:00Z",
            "2026-01-01T00:00:00Z",
        )
        .unwrap();

        // 1. First run: should deliver milestone 3
        let sent = service.check_and_deliver_reminders().unwrap();
        assert_eq!(sent, 1);

        {
            let list = sent_list.lock().unwrap();
            assert_eq!(list.len(), 1);
            assert_eq!(list[0].0, "TotumVault Document Reminder");
            assert_eq!(list[0].1, "Driving License expires in 3 days.");
        }

        // Verify SQLite state
        let doc_rec = get_document_record(&conn, "doc-123").unwrap().unwrap();
        assert_eq!(doc_rec.last_reminder_milestone, Some(3));
        assert_eq!(doc_rec.last_reminder_date, Some(today.format("%Y-%m-%d").to_string()));

        // 2. Second run on same day: should deliver 0
        let sent_second = service.check_and_deliver_reminders().unwrap();
        assert_eq!(sent_second, 0);
        {
            let list = sent_list.lock().unwrap();
            assert_eq!(list.len(), 1); // no new notification sent
        }

        // 3. Test global disable
        service.set_globally_enabled(false).unwrap();
        assert!(!service.is_globally_enabled());

        // Reset milestone to test disabled check
        save_document_record(
            &conn,
            "doc-123",
            "Driving License",
            "identification",
            "Personal license",
            "[]",
            None,
            Some(&expiry_str),
            false,
            true,
            None,
            None,
            "2026-01-01T00:00:00Z",
            "2026-01-01T00:00:00Z",
        )
        .unwrap();

        let sent_disabled = service.check_and_deliver_reminders().unwrap();
        assert_eq!(sent_disabled, 0);
    }
}
