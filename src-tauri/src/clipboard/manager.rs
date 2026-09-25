use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;

/// Overwrites or purges the OS-level system clipboard immediately
pub fn clear_os_clipboard() {
    #[cfg(target_os = "linux")]
    {
        // On Wayland compositors
        if std::env::var("WAYLAND_DISPLAY").is_ok() {
            let _ = Command::new("wl-copy").arg("-c").spawn();
            let _ = Command::new("wl-copy").args(["-c", "-p"]).spawn();
            if let Ok(mut child) = Command::new("wl-copy").stdin(Stdio::piped()).spawn() {
                drop(child.stdin.take());
            }
        }
        // On X11 / XWayland
        let _ = Command::new("xclip").args(["-selection", "clipboard", "/dev/null"]).spawn();
        let _ = Command::new("xsel").args(["--clipboard", "--clear"]).spawn();
    }

    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("cmd")
            .args(["/c", "clip"])
            .stdin(Stdio::null())
            .spawn();
    }

    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("pbcopy")
            .stdin(Stdio::null())
            .spawn();
    }
}

/// Schedules a background thread to clear the OS clipboard after `clear_after_secs`
pub fn schedule_clipboard_wipe(clear_after_secs: u64) {
    if clear_after_secs == 0 {
        return;
    }

    thread::spawn(move || {
        thread::sleep(Duration::from_secs(clear_after_secs));
        clear_os_clipboard();
    });
}

