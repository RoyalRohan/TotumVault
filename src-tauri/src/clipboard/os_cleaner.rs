/// Best-effort auxiliary OS-level clipboard purge.
///
/// PRIMARY INVARIANT:
/// Official Tauri clipboard manager (`app.clipboard().clear()`) is the
/// authoritative, primary clipboard clearing implementation across all platforms.
///
/// Auxiliary cleaners provide secondary, best-effort sanitization (e.g. flushing
/// desktop clipboard history applets or retrying busy OS locks).
/// They are never required for functional correctness, never claim false success,
/// never block Tokio runtimes, and never accumulate zombie child processes.

#[cfg(any(target_os = "linux", target_os = "macos"))]
fn spawn_and_reap(mut cmd: std::process::Command) {
    if let Ok(mut child) = cmd
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
    {
        // Reap in background thread with a strict 300ms deadline to prevent zombie accumulation
        std::thread::spawn(move || {
            let start = std::time::Instant::now();
            loop {
                match child.try_wait() {
                    Ok(Some(_status)) => break, // Reaped successfully
                    Ok(None) => {
                        if start.elapsed() > std::time::Duration::from_millis(300) {
                            let _ = child.kill();
                            let _ = child.wait();
                            break;
                        }
                        std::thread::sleep(std::time::Duration::from_millis(25));
                    }
                    Err(_) => break,
                }
            }
        });
    }
}

pub fn safe_clear_os_clipboard() {
    #[cfg(target_os = "windows")]
    {
        #[link(name = "user32")]
        extern "system" {
            fn OpenClipboard(hwnd: *mut std::ffi::c_void) -> i32;
            fn EmptyClipboard() -> i32;
            fn CloseClipboard() -> i32;
        }

        // Bounded retry with exponential backoff (10ms, 20ms, 40ms, 80ms, 160ms = max ~310ms)
        // in case another process (e.g. Office or clipboard history) transiently holds the lock.
        for attempt in 0..5 {
            unsafe {
                if OpenClipboard(std::ptr::null_mut()) != 0 {
                    let _ = EmptyClipboard();
                    let _ = CloseClipboard();
                    break;
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(10 * (1 << attempt)));
        }
    }

    #[cfg(target_os = "macos")]
    {
        // Spawns pbcopy with null stdin and reaps child process
        let cmd = std::process::Command::new("pbcopy");
        spawn_and_reap(cmd);
    }

    #[cfg(target_os = "linux")]
    {
        // Linux Wayland: best-effort selection & primary clear if wl-copy is present
        if std::env::var("WAYLAND_DISPLAY").is_ok() {
            let mut cmd_c = std::process::Command::new("wl-copy");
            cmd_c.arg("-c");
            spawn_and_reap(cmd_c);

            let mut cmd_empty = std::process::Command::new("wl-copy");
            cmd_empty.arg("");
            spawn_and_reap(cmd_empty);
        } else if std::env::var("DISPLAY").is_ok() {
            // Linux X11: best-effort clipboard purge if xclip is present
            let mut cmd = std::process::Command::new("xclip");
            cmd.args(["-selection", "clipboard", "/dev/null"]);
            spawn_and_reap(cmd);
        }
    }

    #[cfg(target_os = "android")]
    {
        // Android clipboard is handled exclusively through Android's native
        // android.content.ClipboardManager via tauri-plugin-clipboard-manager.
        // Desktop shell processes must NEVER be spawned on Android.
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos", target_os = "android")))]
    {
        // Platform unsupported for auxiliary OS commands
    }
}
