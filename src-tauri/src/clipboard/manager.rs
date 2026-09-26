use std::process::{Command, Stdio};

/// Purges OS-level system clipboard using native window/compositor commands
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
        #[link(name = "user32")]
        extern "system" {
            fn OpenClipboard(hwnd: *mut std::ffi::c_void) -> i32;
            fn EmptyClipboard() -> i32;
            fn CloseClipboard() -> i32;
        }
        unsafe {
            if OpenClipboard(std::ptr::null_mut()) != 0 {
                EmptyClipboard();
                CloseClipboard();
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("pbcopy")
            .stdin(Stdio::null())
            .spawn();
    }

    #[cfg(target_os = "android")]
    {
        // Handled via native Android ClipboardManager and WebView lifecycle
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos", target_os = "android")))]
    {
        // Platform unsupported for direct OS clipboard commands
    }
}

