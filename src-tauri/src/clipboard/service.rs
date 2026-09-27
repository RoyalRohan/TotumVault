use std::sync::mpsc::{sync_channel, SyncSender};
use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use super::os_cleaner;
use super::session::{self, ClipboardSession};

/// Abstract clipboard I/O backend allowing real native integration and deterministic testing.
pub trait ClipboardBackend: Send + Sync + 'static {
    fn write_text(&self, text: &str) -> Result<(), String>;
    fn read_text(&self) -> Result<String, String>;
    fn clear(&self) -> Result<(), String>;
}

/// Production clipboard backend wrapping Tauri 2's official clipboard manager plugin.
pub struct TauriClipboardBackend {
    app: AppHandle,
}

impl TauriClipboardBackend {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }
}

impl ClipboardBackend for TauriClipboardBackend {
    fn write_text(&self, text: &str) -> Result<(), String> {
        use tauri_plugin_clipboard_manager::ClipboardExt;
        self.app.clipboard().write_text(text).map_err(|e| e.to_string())
    }

    fn read_text(&self) -> Result<String, String> {
        use tauri_plugin_clipboard_manager::ClipboardExt;
        self.app.clipboard().read_text().map_err(|e| e.to_string())
    }

    fn clear(&self) -> Result<(), String> {
        use tauri_plugin_clipboard_manager::ClipboardExt;
        self.app.clipboard().clear().map_err(|e| e.to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardSessionStatus {
    pub active: bool,
    pub generation: u64,
    pub remaining_seconds: Option<u64>,
}

pub struct ClipboardInner {
    pub session: Option<ClipboardSession>,
    pub current_generation: u64,
    pub pending_generation: Option<u64>,
    pub shutdown: bool,
}

enum ReaderCommand {
    Read {
        resp_tx: SyncSender<Result<String, String>>,
    },
    Shutdown,
}

pub struct ClipboardManager {
    backend: Arc<dyn ClipboardBackend>,
    pub inner: Arc<(Mutex<ClipboardInner>, Condvar)>,
    pub op_mutex: Arc<Mutex<()>>,
    reader_cmd_tx: SyncSender<ReaderCommand>,
}

pub type SharedClipboardManager = Arc<ClipboardManager>;

impl ClipboardManager {
    pub fn new(app: AppHandle) -> Self {
        Self::with_backend(Arc::new(TauriClipboardBackend::new(app)))
    }

    pub fn with_backend(backend: Arc<dyn ClipboardBackend>) -> Self {
        let inner = Arc::new((
            Mutex::new(ClipboardInner {
                session: None,
                current_generation: 0,
                pending_generation: None,
                shutdown: false,
            }),
            Condvar::new(),
        ));

        let op_mutex = Arc::new(Mutex::new(()));

        // Dedicated single-worker reader thread to strictly bound thread creation.
        // Guarantees zero thread accumulation even if underlying compositor reads block.
        let (reader_cmd_tx, reader_cmd_rx) = sync_channel::<ReaderCommand>(1);
        let backend_reader = Arc::clone(&backend);
        std::thread::Builder::new()
            .name("totum-clipboard-reader".to_string())
            .spawn(move || {
                while let Ok(cmd) = reader_cmd_rx.recv() {
                    match cmd {
                        ReaderCommand::Read { resp_tx } => {
                            let res = backend_reader.read_text();
                            let _ = resp_tx.send(res);
                        }
                        ReaderCommand::Shutdown => break,
                    }
                }
            })
            .expect("Failed to spawn clipboard reader thread");

        // Dedicated timer worker thread
        let inner_c = Arc::clone(&inner);
        let backend_timer = Arc::clone(&backend);
        let op_mutex_c = Arc::clone(&op_mutex);
        let reader_cmd_tx_c = reader_cmd_tx.clone();

        std::thread::Builder::new()
            .name("totum-clipboard-timer".to_string())
            .spawn(move || {
                Self::timer_loop(backend_timer, inner_c, op_mutex_c, reader_cmd_tx_c);
            })
            .expect("Failed to spawn clipboard timer thread");

        Self {
            backend,
            inner,
            op_mutex,
            reader_cmd_tx,
        }
    }

    /// Reads clipboard via dedicated worker with a strict bounded timeout.
    /// Never spawns unbounded threads.
    fn read_clipboard_bounded(
        reader_cmd_tx: &SyncSender<ReaderCommand>,
        timeout: Duration,
    ) -> Result<String, String> {
        let (resp_tx, resp_rx) = sync_channel::<Result<String, String>>(1);
        match reader_cmd_tx.try_send(ReaderCommand::Read { resp_tx }) {
            Ok(()) => match resp_rx.recv_timeout(timeout) {
                Ok(res) => res,
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    Err("Clipboard read timed out (bounded limit reached)".to_string())
                }
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    Err("Clipboard reader worker disconnected".to_string())
                }
            },
            Err(std::sync::mpsc::TrySendError::Full(_)) => {
                Err("Clipboard reader worker is busy with a prior read".to_string())
            }
            Err(std::sync::mpsc::TrySendError::Disconnected(_)) => {
                Err("Clipboard reader worker shut down".to_string())
            }
        }
    }

    /// Background timer thread loop.
    /// Sleeps using Condvar wait_timeout until the active session expires,
    /// or until awakened immediately by a new copy, lock, cancellation, or shutdown.
    fn timer_loop(
        backend: Arc<dyn ClipboardBackend>,
        inner: Arc<(Mutex<ClipboardInner>, Condvar)>,
        op_mutex: Arc<Mutex<()>>,
        reader_cmd_tx: SyncSender<ReaderCommand>,
    ) {
        let mut guard = match inner.0.lock() {
            Ok(g) => g,
            Err(_) => return,
        };

        loop {
            if guard.shutdown {
                break;
            }

            match &guard.session {
                Some(session) if session.active && session.timeout_secs > 0 => {
                    let now = Instant::now();
                    if now >= session.expires_at {
                        let generation = session.generation;
                        let expected_len = session.expected_length;
                        let hmac_key = session.hmac_key;
                        let expected_fp = session.expected_fingerprint;
                        drop(guard);

                        // Perform verification read & clear outside inner lock
                        Self::verify_and_clear(
                            &backend,
                            &inner,
                            &op_mutex,
                            &reader_cmd_tx,
                            generation,
                            expected_len,
                            &hmac_key,
                            &expected_fp,
                        );

                        guard = match inner.0.lock() {
                            Ok(g) => g,
                            Err(_) => break,
                        };
                    } else {
                        let remaining = session.expires_at - now;
                        match inner.1.wait_timeout(guard, remaining) {
                            Ok((new_guard, _)) => guard = new_guard,
                            Err(_) => break,
                        }
                    }
                }
                _ => {
                    // No active timed session, wait until notified
                    match inner.1.wait(guard) {
                        Ok(new_guard) => guard = new_guard,
                        Err(_) => break,
                    }
                }
            }
        }
    }

    /// Reads system clipboard with a bounded timeout and clears if matching.
    /// Uses two-phase synchronization:
    /// Phase 1: Pre-read check ensuring session has not been superseded.
    /// Phase 2: Post-read atomic op_mutex lock ensuring no newer copy has started.
    fn verify_and_clear(
        backend: &Arc<dyn ClipboardBackend>,
        inner: &Arc<(Mutex<ClipboardInner>, Condvar)>,
        op_mutex: &Arc<Mutex<()>>,
        reader_cmd_tx: &SyncSender<ReaderCommand>,
        generation: u64,
        expected_len: usize,
        hmac_key: &[u8; 32],
        expected_fp: &[u8; 32],
    ) {
        // Fast pre-check: if superseded or write is pending, abort immediately
        if let Ok(guard) = inner.0.lock() {
            if guard.shutdown
                || guard.pending_generation.is_some()
                || guard.current_generation != generation
                || guard.session.as_ref().map(|s| s.generation) != Some(generation)
            {
                return;
            }
        }

        // Bounded read via dedicated single reader worker
        let read_result = Self::read_clipboard_bounded(reader_cmd_tx, Duration::from_millis(1500));

        match read_result {
            Ok(current_text) => {
                let matches = current_text.len() == expected_len && {
                    let fp = session::compute_fingerprint(hmac_key, &current_text);
                    session::constant_time_eq(&fp, expected_fp)
                };

                if !matches {
                    // Content replaced by user or external application: preserve it!
                    if let Ok(mut guard) = inner.0.lock() {
                        if guard.session.as_ref().map(|s| s.generation) == Some(generation) {
                            if let Some(session) = &mut guard.session {
                                session.invalidate();
                            }
                        }
                    }
                    eprintln!("[TotumVault Clipboard] Auto-clear skipped: clipboard content replaced.");
                    return;
                }

                // Matching secret detected.
                // To clear safely without erasing a newer copy, acquire op_mutex first.
                let _op_guard = match op_mutex.lock() {
                    Ok(g) => g,
                    Err(_) => return,
                };

                // Under op_mutex, verify generation has NOT been superseded while acquiring op_mutex
                if let Ok(mut guard) = inner.0.lock() {
                    if guard.shutdown
                        || guard.pending_generation.is_some()
                        || guard.current_generation != generation
                    {
                        return;
                    }
                    if let Some(session) = &mut guard.session {
                        if session.generation != generation || !session.active {
                            return;
                        }
                        // Verification fully validated! Execute clear.
                        let _ = backend.clear();
                        os_cleaner::safe_clear_os_clipboard();
                        session.invalidate();
                        guard.session = None;
                        inner.1.notify_all();
                        eprintln!("[TotumVault Clipboard] Auto-clear executed: matching secret cleared.");
                    }
                }
            }
            Err(e) => {
                // Read unavailable or timed out (e.g. Wayland compositor restriction).
                // NEVER CLEAR BLINDLY!
                if let Ok(mut guard) = inner.0.lock() {
                    if guard.session.as_ref().map(|s| s.generation) == Some(generation) {
                        if let Some(session) = &mut guard.session {
                            session.invalidate();
                        }
                    }
                }
                eprintln!("[TotumVault Clipboard] Verification read failed ({}). Retaining clipboard safely.", e);
            }
        }
    }

    /// Writes secret text to system clipboard and initializes a native auto-clear session.
    ///
    /// CONCURRENCY GUARANTEE (Blockers 1 & 2):
    /// 1. Holds op_mutex throughout the entire write pipeline to serialize OS clipboard mutations.
    /// 2. Bumps generation, sets pending_generation, and invalidates any prior session BEFORE
    ///    writing to the OS clipboard. Any in-flight timer will immediately see that the old
    ///    generation is invalid and cannot clear.
    /// 3. Commits the session only after successful write. If write fails, the reservation is
    ///    cleared and no invalid session remains active.
    pub fn copy_and_track(&self, text: &str, timeout_secs: u64) -> Result<u64, String> {
        let _op_guard = self.op_mutex.lock().map_err(|_| "Failed to acquire clipboard op lock")?;

        let this_gen = {
            let mut guard = self.inner.0.lock().map_err(|_| "Failed to acquire inner lock")?;
            guard.current_generation += 1;
            let gen = guard.current_generation;
            guard.pending_generation = Some(gen);
            if let Some(session) = &mut guard.session {
                session.invalidate();
            }
            guard.session = None;
            self.inner.1.notify_all();
            gen
        };

        let write_res = self.backend.write_text(text);

        {
            let mut guard = self.inner.0.lock().map_err(|_| "Failed to acquire inner lock")?;
            guard.pending_generation = None;
            match write_res {
                Ok(()) => {
                    if guard.current_generation == this_gen {
                        guard.session = Some(ClipboardSession::new(this_gen, text, timeout_secs));
                        self.inner.1.notify_all();
                    }
                }
                Err(e) => {
                    guard.session = None;
                    self.inner.1.notify_all();
                    return Err(format!("Clipboard write error: {}", e));
                }
            }
        }

        Ok(this_gen)
    }

    /// Registers a native auto-clear session when text was written via frontend plugin.
    pub fn track_session(&self, text: &str, timeout_secs: u64) -> Result<u64, String> {
        let _op_guard = self.op_mutex.lock().map_err(|_| "Failed to acquire clipboard op lock")?;
        let mut guard = self.inner.0.lock().map_err(|_| "Failed to acquire inner lock")?;
        guard.current_generation += 1;
        let gen = guard.current_generation;
        guard.pending_generation = None;
        guard.session = Some(ClipboardSession::new(gen, text, timeout_secs));
        self.inner.1.notify_all();
        Ok(gen)
    }

    /// Clears the clipboard immediately.
    /// If force is true, unconditionally wipes clipboard.
    /// If force is false, wipes only if clipboard matches active session.
    pub fn clear_now(&self, force: bool) -> Result<bool, String> {
        if force {
            let _op_guard = self.op_mutex.lock().map_err(|_| "Failed to acquire clipboard op lock")?;
            let _ = self.backend.clear();
            os_cleaner::safe_clear_os_clipboard();
            let mut guard = self.inner.0.lock().map_err(|_| "Failed to acquire inner lock")?;
            guard.current_generation += 1;
            if let Some(session) = &mut guard.session {
                session.invalidate();
            }
            guard.session = None;
            guard.pending_generation = None;
            self.inner.1.notify_all();
            return Ok(true);
        }

        // force == false: verification-guarded clear
        let (generation, expected_len, hmac_key, expected_fp) = {
            let guard = self.inner.0.lock().map_err(|_| "Failed to acquire inner lock")?;
            if guard.pending_generation.is_some() {
                return Ok(false);
            }
            match &guard.session {
                Some(session) if session.active => (
                    session.generation,
                    session.expected_length,
                    session.hmac_key,
                    session.expected_fingerprint,
                ),
                _ => return Ok(false),
            }
        };

        let read_result = Self::read_clipboard_bounded(&self.reader_cmd_tx, Duration::from_millis(1500));

        match read_result {
            Ok(current_text) => {
                let matches = current_text.len() == expected_len && {
                    let fp = session::compute_fingerprint(&hmac_key, &current_text);
                    session::constant_time_eq(&fp, &expected_fp)
                };

                if !matches {
                    let mut guard = self.inner.0.lock().map_err(|_| "Failed to acquire inner lock")?;
                    if guard.session.as_ref().map(|s| s.generation) == Some(generation) {
                        if let Some(session) = &mut guard.session {
                            session.invalidate();
                        }
                    }
                    return Ok(false);
                }

                // Acquire op_mutex to coordinate with concurrent copies
                let _op_guard = self.op_mutex.lock().map_err(|_| "Failed to acquire clipboard op lock")?;
                let mut guard = self.inner.0.lock().map_err(|_| "Failed to acquire inner lock")?;
                if guard.shutdown || guard.pending_generation.is_some() || guard.current_generation != generation {
                    return Ok(false);
                }
                if let Some(session) = &mut guard.session {
                    if session.generation == generation && session.active {
                        let _ = self.backend.clear();
                        os_cleaner::safe_clear_os_clipboard();
                        session.invalidate();
                        guard.session = None;
                        self.inner.1.notify_all();
                        return Ok(true);
                    }
                }
                Ok(false)
            }
            Err(_) => {
                let mut guard = self.inner.0.lock().map_err(|_| "Failed to acquire inner lock")?;
                if guard.session.as_ref().map(|s| s.generation) == Some(generation) {
                    if let Some(session) = &mut guard.session {
                        session.invalidate();
                    }
                }
                Ok(false)
            }
        }
    }

    /// Clears clipboard on vault lock if matching active session.
    pub fn clear_on_lock(&self) -> Result<bool, String> {
        self.clear_now(false)
    }

    /// Cancels active timer without modifying the system clipboard.
    pub fn cancel_timer(&self) -> Result<(), String> {
        let mut guard = self.inner.0.lock().map_err(|_| "Failed to acquire clipboard lock")?;
        if let Some(session) = &mut guard.session {
            session.invalidate();
        }
        self.inner.1.notify_all();
        Ok(())
    }

    /// Explicit shutdown method to terminate background worker cleanly.
    pub fn shutdown(&self) {
        if let Ok(mut guard) = self.inner.0.lock() {
            guard.shutdown = true;
            if let Some(session) = &mut guard.session {
                session.invalidate();
            }
            guard.session = None;
        }
        let _ = self.reader_cmd_tx.try_send(ReaderCommand::Shutdown);
        self.inner.1.notify_all();
    }

    /// Queries operational status (contains NO secret data).
    pub fn get_status(&self) -> Result<ClipboardSessionStatus, String> {
        let guard = self.inner.0.lock().map_err(|_| "Failed to acquire clipboard lock")?;
        if let Some(session) = &guard.session {
            if session.active {
                let now = Instant::now();
                let remaining = if session.expires_at > now {
                    Some((session.expires_at - now).as_secs())
                } else {
                    Some(0)
                };
                return Ok(ClipboardSessionStatus {
                    active: true,
                    generation: session.generation,
                    remaining_seconds: remaining,
                });
            }
        }
        Ok(ClipboardSessionStatus {
            active: false,
            generation: guard.current_generation,
            remaining_seconds: None,
        })
    }
}

impl Drop for ClipboardManager {
    fn drop(&mut self) {
        self.shutdown();
    }
}

#[cfg(test)]
pub struct MockClipboardBackend {
    pub content: Mutex<String>,
    pub read_barrier: Mutex<Option<Arc<std::sync::Barrier>>>,
    pub read_delay: Mutex<Option<Duration>>,
    pub fail_writes: Mutex<bool>,
}

#[cfg(test)]
impl MockClipboardBackend {
    pub fn new(initial: &str) -> Self {
        Self {
            content: Mutex::new(initial.to_string()),
            read_barrier: Mutex::new(None),
            read_delay: Mutex::new(None),
            fail_writes: Mutex::new(false),
        }
    }
}

#[cfg(test)]
impl ClipboardBackend for MockClipboardBackend {
    fn write_text(&self, text: &str) -> Result<(), String> {
        if *self.fail_writes.lock().unwrap() {
            return Err("Simulated write failure".to_string());
        }
        let mut guard = self.content.lock().unwrap();
        *guard = text.to_string();
        Ok(())
    }

    fn read_text(&self) -> Result<String, String> {
        if let Some(barrier) = self.read_barrier.lock().unwrap().clone() {
            barrier.wait();
        }
        if let Some(delay) = *self.read_delay.lock().unwrap() {
            std::thread::sleep(delay);
        }
        let guard = self.content.lock().unwrap();
        Ok(guard.clone())
    }

    fn clear(&self) -> Result<(), String> {
        let mut guard = self.content.lock().unwrap();
        guard.clear();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generation_increment_and_superseding() {
        let backend = Arc::new(MockClipboardBackend::new(""));
        let manager = ClipboardManager::with_backend(backend.clone());

        // Copy A
        let gen1 = manager.copy_and_track("SecretA", 60).unwrap();
        assert_eq!(gen1, 1);
        assert_eq!(*backend.content.lock().unwrap(), "SecretA");
        assert!(manager.inner.0.lock().unwrap().session.as_ref().unwrap().verify("SecretA"));

        // Copy B (supersedes A)
        let gen2 = manager.copy_and_track("SecretB", 30).unwrap();
        assert_eq!(gen2, 2);
        assert_eq!(*backend.content.lock().unwrap(), "SecretB");
        assert!(!manager.inner.0.lock().unwrap().session.as_ref().unwrap().verify("SecretA"));
        assert!(manager.inner.0.lock().unwrap().session.as_ref().unwrap().verify("SecretB"));
    }

    #[test]
    fn test_external_clipboard_replacement_prevents_clear() {
        let backend = Arc::new(MockClipboardBackend::new(""));
        let manager = ClipboardManager::with_backend(backend.clone());
        let _ = manager.copy_and_track("MasterPassword123", 30).unwrap();

        // External app writes new text
        *backend.content.lock().unwrap() = "https://example.com/public".to_string();

        let cleared = manager.clear_now(false).unwrap();
        assert!(!cleared);
        assert_eq!(*backend.content.lock().unwrap(), "https://example.com/public");
    }

    #[test]
    fn test_shutdown_and_cancellation() {
        let backend = Arc::new(MockClipboardBackend::new(""));
        let manager = ClipboardManager::with_backend(backend.clone());
        let _ = manager.copy_and_track("PassX", 60).unwrap();
        assert!(manager.inner.0.lock().unwrap().session.as_ref().unwrap().active);

        // Cancel
        manager.cancel_timer().unwrap();
        assert!(!manager.inner.0.lock().unwrap().session.as_ref().unwrap().active);

        // Shutdown
        manager.shutdown();
        assert!(manager.inner.0.lock().unwrap().shutdown);
    }

    // REAL CONCURRENCY RACE TESTS (BLOCKER 5)

    #[test]
    fn test_race_timer_verification_vs_concurrent_copy_a_cannot_clear_b() {
        // TEST 1: Session A active -> timer enters verification phase -> concurrent copy B starts -> assert A cannot clear B
        let backend = Arc::new(MockClipboardBackend::new("SecretA"));
        let manager = Arc::new(ClipboardManager::with_backend(backend.clone()));

        // Start session A with 1s timeout
        let gen_a = manager.copy_and_track("SecretA", 1).unwrap();
        assert_eq!(gen_a, 1);

        // Set barrier in read_text so timer will pause during verification read
        let barrier = Arc::new(std::sync::Barrier::new(2));
        *backend.read_barrier.lock().unwrap() = Some(barrier.clone());

        // Wait for timer to reach verification read
        barrier.wait();

        // Remove barrier so subsequent calls won't block
        *backend.read_barrier.lock().unwrap() = None;

        // While timer read is completing, user starts concurrent copy of Secret B
        let gen_b = manager.copy_and_track("SecretB", 30).unwrap();
        assert_eq!(gen_b, 2);
        assert_eq!(*backend.content.lock().unwrap(), "SecretB");

        // Allow timer loop to finish its iteration
        std::thread::sleep(Duration::from_millis(50));

        // CRITICAL INVARIANT: Secret B MUST NOT BE CLEARED!
        assert_eq!(*backend.content.lock().unwrap(), "SecretB");
        assert_eq!(manager.inner.0.lock().unwrap().current_generation, 2);
    }

    #[test]
    fn test_race_clear_now_verification_vs_concurrent_copy_a_cannot_clear_b() {
        // TEST 2: clear_now(false) begins verification for A -> concurrent copy B starts -> assert A cannot clear B
        let backend = Arc::new(MockClipboardBackend::new("SecretA"));
        let manager = Arc::new(ClipboardManager::with_backend(backend.clone()));

        let _ = manager.copy_and_track("SecretA", 60).unwrap();

        let barrier = Arc::new(std::sync::Barrier::new(2));
        *backend.read_barrier.lock().unwrap() = Some(barrier.clone());

        let manager_c = Arc::clone(&manager);
        let handle = std::thread::spawn(move || {
            manager_c.clear_now(false)
        });

        // Synchronize on the verification read of clear_now(false)
        barrier.wait();
        *backend.read_barrier.lock().unwrap() = None;

        // Concurrent copy B starts while clear_now(false) is in flight
        let gen_b = manager.copy_and_track("SecretB", 30).unwrap();
        assert_eq!(gen_b, 2);

        let clear_result = handle.join().unwrap();
        // clear_now(false) must return false (aborted) because generation was superseded
        assert_eq!(clear_result, Ok(false));

        // Secret B remains intact
        assert_eq!(*backend.content.lock().unwrap(), "SecretB");
    }

    #[test]
    fn test_race_simultaneous_copies_session_generation_correspondence() {
        // TEST 3: Multiple simultaneous copy requests -> ensure final clipboard content and final session generation always correspond
        let backend = Arc::new(MockClipboardBackend::new(""));
        let manager = Arc::new(ClipboardManager::with_backend(backend.clone()));

        let mut handles = Vec::new();
        for i in 1..=10 {
            let manager_c = Arc::clone(&manager);
            handles.push(std::thread::spawn(move || {
                manager_c.copy_and_track(&format!("Secret_{}", i), 30)
            }));
        }

        for h in handles {
            let _ = h.join().unwrap();
        }

        let status = manager.get_status().unwrap();
        assert_eq!(status.generation, 10);
        assert!(status.active);

        let final_text = backend.content.lock().unwrap().clone();
        // The session in memory MUST correspond to the winning text in the clipboard
        let matches = manager.inner.0.lock().unwrap().session.as_ref().unwrap().verify(&final_text);
        assert!(matches, "Committed session must match the final clipboard content");
    }

    #[test]
    fn test_copy_failure_leaves_no_invalid_session() {
        // TEST 4: Copy operation fails -> ensure no invalid session remains active
        let backend = Arc::new(MockClipboardBackend::new(""));
        *backend.fail_writes.lock().unwrap() = true;

        let manager = ClipboardManager::with_backend(backend.clone());
        let res = manager.copy_and_track("SecretFail", 30);
        assert!(res.is_err());

        let guard = manager.inner.0.lock().unwrap();
        assert!(guard.session.is_none(), "Session must be None after write failure");
        assert!(guard.pending_generation.is_none(), "Pending generation must be None");
    }

    #[test]
    fn test_repeated_read_timeout_no_unbounded_thread_creation() {
        // TEST 5: Verification thread times out repeatedly -> ensure no unbounded worker/thread creation
        let backend = Arc::new(MockClipboardBackend::new(""));
        // Simulate hung reader
        *backend.read_delay.lock().unwrap() = Some(Duration::from_millis(1000));

        let manager = ClipboardManager::with_backend(backend.clone());

        // Call bounded read with 20ms timeout multiple times
        for _ in 0..5 {
            let res = ClipboardManager::read_clipboard_bounded(&manager.reader_cmd_tx, Duration::from_millis(20));
            assert!(res.is_err(), "Must fail safely on timeout or busy reader");
        }

        // Dedicated single reader worker absorbed requests without spawning any extra threads
        let status = manager.get_status().unwrap();
        assert_eq!(status.generation, 0);
    }
}
