use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use std::sync::RwLock;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct NetworkStatus {
    pub air_gap_enabled: bool,
    pub status_text: String,
    pub last_changed: u64,
    pub in_flight_operations: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "error", content = "details")]
pub enum NetworkPolicyError {
    NetworkAccessBlockedByAirGap { operation: String, reason: String },
    PolicyLoadError(String),
    InFlightCancelled(String),
}

impl std::fmt::Display for NetworkPolicyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NetworkAccessBlockedByAirGap { operation, reason } => {
                write!(
                    f,
                    "NetworkAccessBlockedByAirGap: Operation '{}' blocked: {}",
                    operation, reason
                )
            }
            Self::PolicyLoadError(msg) => write!(f, "PolicyLoadError: {}", msg),
            Self::InFlightCancelled(msg) => write!(f, "InFlightCancelled: {}", msg),
        }
    }
}

impl std::error::Error for NetworkPolicyError {}

#[derive(Debug, Serialize, Deserialize)]
struct StoredPolicy {
    air_gap_enabled: bool,
    last_changed: u64,
}

/// RAII Guard representing an actively authorized in-flight network operation.
/// Decrements the active operation counter on drop and provides cancellation checking.
pub struct OperationToken {
    policy: Arc<NetworkPolicyServiceInner>,
    epoch_at_start: u64,
    operation_name: String,
}

impl std::fmt::Debug for OperationToken {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("OperationToken")
            .field("operation_name", &self.operation_name)
            .field("epoch_at_start", &self.epoch_at_start)
            .field("is_cancelled", &self.is_cancelled())
            .finish()
    }
}

impl OperationToken {
    /// Returns true if this in-flight operation was cancelled by an Air-Gap mode activation.
    pub fn is_cancelled(&self) -> bool {
        self.policy.air_gap_enabled.load(Ordering::SeqCst)
            || self.policy.cancellation_epoch.load(Ordering::SeqCst) != self.epoch_at_start
    }

    /// Checks if operation remains authorized. Returns Err if cancelled.
    pub fn check_active(&self) -> Result<(), NetworkPolicyError> {
        if self.is_cancelled() {
            Err(NetworkPolicyError::InFlightCancelled(format!(
                "Operation '{}' aborted because Air-Gap Mode was enabled.",
                self.operation_name
            )))
        } else {
            Ok(())
        }
    }
}

impl Drop for OperationToken {
    fn drop(&mut self) {
        self.policy.in_flight_count.fetch_sub(1, Ordering::SeqCst);
    }
}

pub struct NetworkPolicyServiceInner {
    app_dir: PathBuf,
    air_gap_enabled: AtomicBool,
    last_changed: AtomicU64,
    in_flight_count: AtomicUsize,
    cancellation_epoch: AtomicU64,
    write_lock: RwLock<()>,
}

#[derive(Clone)]
pub struct NetworkPolicyService {
    inner: Arc<NetworkPolicyServiceInner>,
}

impl NetworkPolicyService {
    fn current_timestamp() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    }

    /// Reconciles state from JSON configuration and SQLite metadata.
    ///
    /// Precedence & Reconciliation Rules:
    /// 1. Corruption Safety (Fail-Closed): If either source is present but corrupt/unreadable,
    ///    fail closed to Air-Gap = ON (`true`) to prevent unauthorized network access.
    /// 2. Fresh Installation: If both sources are absent (no policy file and no SQLite DB/metadata),
    ///    default to Air-Gap = OFF (`false`).
    /// 3. Security Bias (Fail-Closed Precedence): If either valid source indicates Air-Gap = ON (`true`),
    ///    reconcile to Air-Gap = ON (`true`). This ensures an explicit security setting is never
    ///    silently lost or disabled if one store was reset or corrupted.
    /// 4. Agreement on OFF: Reconciles to OFF (`false`) only if all present valid sources explicitly
    ///    indicate OFF (`false`).
    pub fn reconcile_state(
        json_state: Option<Result<bool, String>>,
        sqlite_state: Option<Result<bool, String>>,
    ) -> bool {
        // 1. Any corruption detected -> FAIL CLOSED (true)
        if matches!(json_state, Some(Err(_))) || matches!(sqlite_state, Some(Err(_))) {
            return true;
        }

        // 2. Both missing -> Fresh install default is OFF (false)
        if json_state.is_none() && sqlite_state.is_none() {
            return false;
        }

        // 3. Either source indicates ON -> Security bias to ON (true)
        let json_on = matches!(json_state, Some(Ok(true)));
        let sqlite_on = matches!(sqlite_state, Some(Ok(true)));
        if json_on || sqlite_on {
            return true;
        }

        // 4. Otherwise (all present valid sources are false) -> OFF (false)
        false
    }

    /// Initializes NetworkPolicyService restoring persistent state from app directory.
    /// Follows a strict FAIL-CLOSED policy: if existing configuration cannot be read
    /// or is corrupted, Air-Gap Mode defaults to ON (true) to prevent unauthorized network access.
    pub fn init(app_dir: PathBuf) -> Self {
        let policy_file = app_dir.join("network_policy.json");
        let mut last_changed = Self::current_timestamp();

        let json_state = if policy_file.exists() {
            match fs::read_to_string(&policy_file) {
                Ok(content) => match serde_json::from_str::<StoredPolicy>(&content) {
                    Ok(stored) => {
                        last_changed = stored.last_changed;
                        Some(Ok(stored.air_gap_enabled))
                    }
                    Err(e) => {
                        eprintln!(
                            "[NetworkPolicy] Corrupt policy file detected ({}). FAILING CLOSED to Air-Gap = ON.",
                            e
                        );
                        Some(Err(format!("Corrupt policy JSON: {}", e)))
                    }
                },
                Err(e) => {
                    eprintln!(
                        "[NetworkPolicy] Error reading policy file ({}). FAILING CLOSED to Air-Gap = ON.",
                        e
                    );
                    Some(Err(format!("IO error reading policy file: {}", e)))
                }
            }
        } else {
            None
        };

        let db_file = app_dir.join("vault.sqlite");
        let sqlite_state = if db_file.exists() {
            match rusqlite::Connection::open(&db_file) {
                Ok(conn) => {
                    match crate::db::sqlite::get_metadata(&conn, "totumvault_air_gap_mode") {
                        Ok(Some(val)) => {
                            let val_trim = val.trim().to_lowercase();
                            if val_trim == "true" {
                                Some(Ok(true))
                            } else if val_trim == "false" {
                                Some(Ok(false))
                            } else {
                                eprintln!(
                                    "[NetworkPolicy] Corrupt SQLite metadata value ('{}'). FAILING CLOSED to Air-Gap = ON.",
                                    val
                                );
                                Some(Err(format!("Invalid metadata value: {}", val)))
                            }
                        }
                        Ok(None) => None,
                        Err(e) => {
                            eprintln!(
                                "[NetworkPolicy] Error querying SQLite metadata ({}). FAILING CLOSED to Air-Gap = ON.",
                                e
                            );
                            Some(Err(format!("SQLite query error: {}", e)))
                        }
                    }
                }
                Err(e) => {
                    eprintln!(
                        "[NetworkPolicy] Error opening SQLite database ({}). FAILING CLOSED to Air-Gap = ON.",
                        e
                    );
                    Some(Err(format!("SQLite open error: {}", e)))
                }
            }
        } else {
            None
        };

        let air_gap = Self::reconcile_state(json_state.clone(), sqlite_state.clone());

        // Self-healing: synchronize both sources if there was discrepancy or one was missing/corrupt
        let should_sync_json = match &json_state {
            Some(Ok(val)) => *val != air_gap,
            _ => true,
        };
        if should_sync_json {
            let stored = StoredPolicy {
                air_gap_enabled: air_gap,
                last_changed,
            };
            if let Ok(json) = serde_json::to_string_pretty(&stored) {
                let _ = fs::create_dir_all(&app_dir);
                let _ = fs::write(&policy_file, json);
            }
        }

        let should_sync_sqlite = match &sqlite_state {
            Some(Ok(val)) => *val != air_gap,
            _ => db_file.exists(),
        };
        if should_sync_sqlite {
            if let Ok(conn) = rusqlite::Connection::open(&db_file) {
                let _ = crate::db::sqlite::save_metadata(
                    &conn,
                    "totumvault_air_gap_mode",
                    if air_gap { "true" } else { "false" },
                );
            }
        }

        let inner = Arc::new(NetworkPolicyServiceInner {
            app_dir,
            air_gap_enabled: AtomicBool::new(air_gap),
            last_changed: AtomicU64::new(last_changed),
            in_flight_count: AtomicUsize::new(0),
            cancellation_epoch: AtomicU64::new(0),
            write_lock: RwLock::new(()),
        });

        Self { inner }
    }

    /// Instantiates an in-memory NetworkPolicyService with a specific initial state.
    pub fn new_with_state(app_dir: PathBuf, initial_air_gap: bool) -> Self {
        let inner = Arc::new(NetworkPolicyServiceInner {
            app_dir,
            air_gap_enabled: AtomicBool::new(initial_air_gap),
            last_changed: AtomicU64::new(Self::current_timestamp()),
            in_flight_count: AtomicUsize::new(0),
            cancellation_epoch: AtomicU64::new(0),
            write_lock: RwLock::new(()),
        });
        Self { inner }
    }

    /// Returns whether Air-Gap Mode is currently enabled.
    #[inline]
    pub fn is_air_gap_enabled(&self) -> bool {
        self.inner.air_gap_enabled.load(Ordering::SeqCst)
    }

    /// Returns whether application network operations are allowed.
    #[inline]
    pub fn is_network_allowed(&self, _operation: &str) -> bool {
        !self.is_air_gap_enabled()
    }

    /// Checks network policy for an operation and registers an active in-flight operation token.
    /// If Air-Gap Mode is active, immediately returns NetworkAccessBlockedByAirGap error.
    pub fn require_network_access(
        &self,
        operation: &str,
    ) -> Result<OperationToken, NetworkPolicyError> {
        let _guard = self.inner.write_lock.read().unwrap();
        if self.is_air_gap_enabled() {
            return Err(NetworkPolicyError::NetworkAccessBlockedByAirGap {
                operation: operation.to_string(),
                reason: "TotumVault Air-Gap Mode is enabled. Network operations are blocked to ensure vault isolation."
                    .to_string(),
            });
        }

        self.inner.in_flight_count.fetch_add(1, Ordering::SeqCst);
        let epoch = self.inner.cancellation_epoch.load(Ordering::SeqCst);

        Ok(OperationToken {
            policy: self.inner.clone(),
            epoch_at_start: epoch,
            operation_name: operation.to_string(),
        })
    }

    /// Atomically toggles Air-Gap Mode, cancels in-flight operations, and persists state.
    pub fn set_air_gap_enabled(&self, enabled: bool) -> Result<NetworkStatus, String> {
        let _guard = self
            .inner
            .write_lock
            .write()
            .map_err(|_| "Failed to acquire policy write lock".to_string())?;

        let now = Self::current_timestamp();
        self.inner.air_gap_enabled.store(enabled, Ordering::SeqCst);
        self.inner.last_changed.store(now, Ordering::SeqCst);
        self.inner.cancellation_epoch.fetch_add(1, Ordering::SeqCst);

        // 1. Persist to network_policy.json
        let stored = StoredPolicy {
            air_gap_enabled: enabled,
            last_changed: now,
        };
        let policy_file = self.inner.app_dir.join("network_policy.json");
        if let Ok(json) = serde_json::to_string_pretty(&stored) {
            let _ = fs::create_dir_all(&self.inner.app_dir);
            let _ = fs::write(&policy_file, json);
        }

        // 2. Synchronize to SQLite vault_metadata if vault database is present
        let db_file = self.inner.app_dir.join("vault.sqlite");
        if db_file.exists() {
            if let Ok(conn) = rusqlite::Connection::open(&db_file) {
                let _ = crate::db::sqlite::save_metadata(
                    &conn,
                    "totumvault_air_gap_mode",
                    if enabled { "true" } else { "false" },
                );
            }
        }

        Ok(self.get_network_status())
    }

    /// Returns structured network status.
    pub fn get_network_status(&self) -> NetworkStatus {
        let enabled = self.is_air_gap_enabled();
        NetworkStatus {
            air_gap_enabled: enabled,
            status_text: if enabled {
                "Network access blocked".to_string()
            } else {
                "Network access allowed".to_string()
            },
            last_changed: self.inner.last_changed.load(Ordering::SeqCst),
            in_flight_operations: self.inner.in_flight_count.load(Ordering::SeqCst),
        }
    }

    /// Harmless controlled verification probe without contacting external public hosts.
    pub fn test_network_access(&self) -> Result<String, NetworkPolicyError> {
        let _token = self.require_network_access("controlled_test_probe")?;
        Ok("Allowed: TotumVault network access is permitted by current policy.".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::net::TcpListener;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_air_gap_default_state_is_false() {
        let temp_dir = std::env::temp_dir().join(format!("tv_test_ag_{}", uuid::Uuid::new_v4()));
        let service = NetworkPolicyService::init(temp_dir.clone());
        assert!(!service.is_air_gap_enabled());
        assert!(service.is_network_allowed("updater"));
        let status = service.get_network_status();
        assert!(!status.air_gap_enabled);
        assert_eq!(status.status_text, "Network access allowed");
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_enable_air_gap_and_persist() {
        let temp_dir = std::env::temp_dir().join(format!("tv_test_ag_{}", uuid::Uuid::new_v4()));
        let service = NetworkPolicyService::init(temp_dir.clone());

        let res = service.set_air_gap_enabled(true).unwrap();
        assert!(res.air_gap_enabled);
        assert_eq!(res.status_text, "Network access blocked");
        assert!(service.is_air_gap_enabled());
        assert!(!service.is_network_allowed("updater"));

        // Restart simulation: re-init from same directory
        let restored_service = NetworkPolicyService::init(temp_dir.clone());
        assert!(restored_service.is_air_gap_enabled());
        assert_eq!(
            restored_service.get_network_status().status_text,
            "Network access blocked"
        );

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_fail_closed_on_corrupt_config() {
        let temp_dir = std::env::temp_dir().join(format!("tv_test_ag_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).unwrap();
        let policy_file = temp_dir.join("network_policy.json");
        fs::write(&policy_file, "{ corrupted_non_json: [[[").unwrap();

        let service = NetworkPolicyService::init(temp_dir.clone());
        // Must FAIL CLOSED to true
        assert!(
            service.is_air_gap_enabled(),
            "Corrupt config MUST fail closed to Air-Gap = true"
        );
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_require_network_access_blocked_when_air_gap_on() {
        let temp_dir = std::env::temp_dir().join(format!("tv_test_ag_{}", uuid::Uuid::new_v4()));
        let service = NetworkPolicyService::init(temp_dir.clone());

        // 1. With Air-Gap OFF -> Allowed
        let token = service.require_network_access("updater:check").unwrap();
        assert_eq!(service.get_network_status().in_flight_operations, 1);
        drop(token);
        assert_eq!(service.get_network_status().in_flight_operations, 0);

        // 2. Enable Air-Gap
        service.set_air_gap_enabled(true).unwrap();

        // 3. With Air-Gap ON -> Blocked before connection
        let err = service.require_network_access("updater:check").unwrap_err();
        match err {
            NetworkPolicyError::NetworkAccessBlockedByAirGap { operation, .. } => {
                assert_eq!(operation, "updater:check");
            }
            _ => panic!("Expected NetworkAccessBlockedByAirGap"),
        }

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_in_flight_operation_cancelled_on_air_gap_activation() {
        let temp_dir = std::env::temp_dir().join(format!("tv_test_ag_{}", uuid::Uuid::new_v4()));
        let service = NetworkPolicyService::init(temp_dir.clone());

        let token = service.require_network_access("download_update").unwrap();
        assert!(!token.is_cancelled());
        assert!(token.check_active().is_ok());

        // Air-Gap enabled while operation is in-flight
        service.set_air_gap_enabled(true).unwrap();

        assert!(token.is_cancelled());
        assert!(token.check_active().is_err());
        drop(token);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_controlled_network_test_probe() {
        let temp_dir = std::env::temp_dir().join(format!("tv_test_ag_{}", uuid::Uuid::new_v4()));
        let service = NetworkPolicyService::init(temp_dir.clone());

        // When OFF
        let res_off = service.test_network_access().unwrap();
        assert!(res_off.contains("Allowed"));

        // When ON
        service.set_air_gap_enabled(true).unwrap();
        let res_on = service.test_network_access().unwrap_err();
        match res_on {
            NetworkPolicyError::NetworkAccessBlockedByAirGap { .. } => {}
            _ => panic!("Expected NetworkAccessBlockedByAirGap"),
        }

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_mock_server_leak_proof() {
        // Mock TCP server to verify zero network bytes leave TotumVault when Air-Gap is ON
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();

        let temp_dir = std::env::temp_dir().join(format!("tv_test_ag_{}", uuid::Uuid::new_v4()));
        let service = NetworkPolicyService::init(temp_dir.clone());
        service.set_air_gap_enabled(true).unwrap();

        let received_any = Arc::new(AtomicBool::new(false));
        let received_clone = received_any.clone();

        let server_thread = thread::spawn(move || {
            listener
                .set_nonblocking(true)
                .expect("set nonblocking must succeed");
            let start = SystemTime::now();
            while start.elapsed().unwrap() < Duration::from_millis(300) {
                if let Ok((mut stream, _)) = listener.accept() {
                    let _ = stream.write_all(b"OK");
                    received_clone.store(true, Ordering::SeqCst);
                    break;
                }
                thread::sleep(Duration::from_millis(10));
            }
        });

        // Application code strictly performs policy check before opening connection
        let connection_attempt_result = service
            .require_network_access("mock_server_request")
            .map(|_token| {
                // Should never execute because policy blocks first
                let _stream = std::net::TcpStream::connect(format!("127.0.0.1:{}", port));
            });

        assert!(
            connection_attempt_result.is_err(),
            "Must be blocked by policy before connection"
        );
        server_thread.join().unwrap();
        assert!(
            !received_any.load(Ordering::SeqCst),
            "Zero network requests must reach mock server when Air-Gap is ON"
        );

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_concurrent_toggle_thread_safety() {
        let temp_dir = std::env::temp_dir().join(format!("tv_test_ag_{}", uuid::Uuid::new_v4()));
        let service = Arc::new(NetworkPolicyService::init(temp_dir.clone()));

        let mut handles = Vec::new();
        for i in 0..10 {
            let s = service.clone();
            handles.push(thread::spawn(move || {
                for j in 0..50 {
                    let _ = s.set_air_gap_enabled((i + j) % 2 == 0);
                    let _ = s.is_air_gap_enabled();
                    let _ = s.get_network_status();
                }
            }));
        }

        for h in handles {
            h.join().unwrap();
        }

        // Final state is valid and non-corrupt
        let status = service.get_network_status();
        assert!(
            status.status_text == "Network access blocked"
                || status.status_text == "Network access allowed"
        );

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_two_source_reconciliation_all_combinations() {
        // Combination 1: JSON ON / SQLite ON -> ON (true)
        assert!(NetworkPolicyService::reconcile_state(
            Some(Ok(true)),
            Some(Ok(true))
        ));

        // Combination 2: JSON ON / SQLite OFF -> ON (true) [Security bias]
        assert!(NetworkPolicyService::reconcile_state(
            Some(Ok(true)),
            Some(Ok(false))
        ));

        // Combination 3: JSON OFF / SQLite ON -> ON (true) [Security bias]
        assert!(NetworkPolicyService::reconcile_state(
            Some(Ok(false)),
            Some(Ok(true))
        ));

        // Combination 4: JSON OFF / SQLite OFF -> OFF (false) [Unanimous OFF]
        assert!(!NetworkPolicyService::reconcile_state(
            Some(Ok(false)),
            Some(Ok(false))
        ));

        // Combination 5: JSON missing / SQLite ON -> ON (true)
        assert!(NetworkPolicyService::reconcile_state(
            None,
            Some(Ok(true))
        ));

        // Combination 6: JSON missing / SQLite OFF -> OFF (false)
        assert!(!NetworkPolicyService::reconcile_state(
            None,
            Some(Ok(false))
        ));

        // Combination 7: SQLite missing / JSON ON -> ON (true)
        assert!(NetworkPolicyService::reconcile_state(
            Some(Ok(true)),
            None
        ));

        // Combination 8: SQLite missing / JSON OFF -> OFF (false)
        assert!(!NetworkPolicyService::reconcile_state(
            Some(Ok(false)),
            None
        ));

        // Combination 9: Both corrupted -> ON (true) [Fail-Closed]
        assert!(NetworkPolicyService::reconcile_state(
            Some(Err("corrupt json".to_string())),
            Some(Err("corrupt sqlite".to_string()))
        ));

        // Combination 10: JSON corrupted / SQLite OFF -> ON (true) [Fail-Closed]
        assert!(NetworkPolicyService::reconcile_state(
            Some(Err("corrupt json".to_string())),
            Some(Ok(false))
        ));

        // Combination 11: JSON OFF / SQLite corrupted -> ON (true) [Fail-Closed]
        assert!(NetworkPolicyService::reconcile_state(
            Some(Ok(false)),
            Some(Err("corrupt sqlite".to_string()))
        ));

        // Combination 12: Both missing (Brand new install) -> OFF (false)
        assert!(!NetworkPolicyService::reconcile_state(
            None,
            None
        ));
    }

    #[test]
    fn test_first_run_fresh_install_lifecycle() {
        let temp_dir = std::env::temp_dir().join(format!("tv_test_fresh_{}", uuid::Uuid::new_v4()));
        assert!(!temp_dir.exists());

        // First run boot
        let service = NetworkPolicyService::init(temp_dir.clone());
        assert!(!service.is_air_gap_enabled(), "Fresh install must default to Air-Gap = OFF");
        assert_eq!(service.get_network_status().status_text, "Network access allowed");

        // Verify network_policy.json was created with air_gap_enabled: false
        let policy_file = temp_dir.join("network_policy.json");
        assert!(policy_file.exists());
        let content = fs::read_to_string(&policy_file).unwrap();
        assert!(content.contains("\"air_gap_enabled\": false"));

        // Second boot (restart simulation)
        let restarted = NetworkPolicyService::init(temp_dir.clone());
        assert!(!restarted.is_air_gap_enabled(), "State must remain OFF after restart");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_two_source_filesystem_and_sqlite_reconciliation() {
        let temp_dir = std::env::temp_dir().join(format!("tv_test_sync_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).unwrap();

        // 1. Create a SQLite database with totumvault_air_gap_mode = 'true'
        let db_file = temp_dir.join("vault.sqlite");
        let conn = rusqlite::Connection::open(&db_file).unwrap();
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS vault_metadata (key TEXT PRIMARY KEY, value TEXT);
             INSERT INTO vault_metadata (key, value) VALUES ('totumvault_air_gap_mode', 'true');"
        ).unwrap();
        drop(conn);

        // 2. Put network_policy.json with air_gap_enabled = false (disagreement simulation)
        let policy_file = temp_dir.join("network_policy.json");
        fs::write(&policy_file, r#"{"air_gap_enabled": false, "last_changed": 1000}"#).unwrap();

        // 3. Init service: should reconcile to TRUE (security bias) and self-heal JSON
        let service = NetworkPolicyService::init(temp_dir.clone());
        assert!(service.is_air_gap_enabled(), "Must reconcile to true when SQLite is true");

        // 4. Verify self-healing writeback synchronized network_policy.json to true
        let updated_json = fs::read_to_string(&policy_file).unwrap();
        assert!(updated_json.contains("\"air_gap_enabled\": true"), "Self-healing must update JSON");

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
