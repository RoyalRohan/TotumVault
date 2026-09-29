#[cfg(windows)]
use std::time::Duration;
use tauri::AppHandle;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReadTextError {
    RestrictedBackground,
    VerificationUnavailable(String),
    Empty,
    ClipboardBusy,
    PlatformError(String),
}

impl std::fmt::Display for ReadTextError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::RestrictedBackground => write!(f, "Clipboard read restricted while in background"),
            Self::VerificationUnavailable(msg) => write!(f, "Clipboard verification unavailable: {}", msg),
            Self::Empty => write!(f, "Clipboard is empty"),
            Self::ClipboardBusy => write!(f, "Clipboard busy or locked by another process"),
            Self::PlatformError(msg) => write!(f, "Platform clipboard error: {}", msg),
        }
    }
}

pub struct NativeClipboard;

impl NativeClipboard {
    /// Writes text to the platform clipboard with sensitive exclusion flags:
    /// - Linux KDE: `x-kde-passwordManagerHint = secret`
    /// - Windows: `ExcludeClipboardContentFromMonitorProcessing`, `CanIncludeInClipboardHistory = 0`, `CanUploadToCloudClipboard = 0`
    /// - macOS: `application/x-nspasteboard-concealed-type` and `application/x-nspasteboard-auto-generated-type`
    /// - Android: Plain text with label
    #[allow(unused_variables)]
    pub fn write_sensitive(app: &AppHandle, text: &str) -> Result<(), String> {

        #[cfg(not(any(target_os = "android", target_os = "ios")))]
        {
            let mut clipboard = arboard::Clipboard::new().map_err(|e| format!("Failed to open clipboard: {}", e))?;

            #[cfg(all(
                unix,
                not(any(target_os = "macos", target_os = "android", target_os = "emscripten"))
            ))]
            {
                use arboard::SetExtLinux;
                match clipboard.set().exclude_from_history().text(text) {
                    Ok(()) => return Ok(()),
                    Err(e) => {
                        if std::env::var("WAYLAND_DISPLAY").is_ok() {
                            if let Ok(mut child) = std::process::Command::new("wl-copy")
                                .args(["--sensitive", text])
                                .spawn()
                            {
                                let _ = child.wait();
                                return Ok(());
                            }
                        }
                        return Err(format!("Linux clipboard set error: {}", e));
                    }
                }

            }

            #[cfg(windows)]
            {
                use arboard::SetExtWindows;
                // arboard automatically sets:
                // ExcludeClipboardContentFromMonitorProcessing
                // CanIncludeInClipboardHistory = 0
                // CanUploadToCloudClipboard = 0
                match clipboard.set().exclude_from_history().text(text) {
                    Ok(()) => return Ok(()),
                    Err(_) => {
                        // Fallback with retry for busy Win32 lock
                        return Self::windows_write_with_retry(text);
                    }
                }
            }

            #[cfg(target_os = "macos")]
            {
                use arboard::SetExtApple;
                clipboard
                    .set()
                    .exclude_from_history()
                    .text(text)
                    .map_err(|e| format!("macOS pasteboard set error: {}", e))?;
                return Ok(());
            }
        }

        #[cfg(target_os = "android")]
        {
            use tauri_plugin_clipboard_manager::ClipboardExt;
            app.clipboard().write_text(text).map_err(|e| e.to_string())?;
            return Ok(());
        }

        #[allow(unreachable_code)]
        {
            use tauri_plugin_clipboard_manager::ClipboardExt;
            app.clipboard().write_text(text).map_err(|e| e.to_string())
        }
    }

    /// Reads clipboard text without requiring application window focus where supported by the OS.
    ///
    /// - Linux Wayland: uses data-control protocol (`ext-data-control-v1` with `zwlr_data_control_v1` fallback) via arboard / wl-clipboard.
    /// - Linux X11: reads CLIPBOARD selection.
    /// - Windows: reads with exponential backoff retry in case of lock contention.
    /// - macOS: reads NSPasteboard (always permitted in background).
    /// - Android: returns `RestrictedBackground` if app is backgrounded.
    #[allow(unused_variables)]
    pub fn read_text(app: &AppHandle) -> Result<String, ReadTextError> {
        #[cfg(not(any(target_os = "android", target_os = "ios")))]
        {
            let mut clipboard = match arboard::Clipboard::new() {
                Ok(cb) => cb,
                Err(e) => {
                    #[cfg(target_os = "linux")]
                    {
                        // Check if wl-paste is available on Wayland as an auxiliary focusless reader
                        if std::env::var("WAYLAND_DISPLAY").is_ok() {
                            if let Ok(output) = std::process::Command::new("wl-paste")
                                .args(["-n", "--type", "text/plain"])
                                .output()
                            {
                                if output.status.success() {
                                    let s = String::from_utf8_lossy(&output.stdout).to_string();
                                    if !s.is_empty() {
                                        return Ok(s);
                                    }
                                    return Err(ReadTextError::Empty);
                                }
                            }
                        }

                    }
                    return Err(ReadTextError::VerificationUnavailable(e.to_string()));
                }
            };

            #[cfg(windows)]
            {
                // Bounded retry with exponential backoff (10, 20, 40, 80, 160ms) for Windows lock contention
                for attempt in 0..5 {
                    match clipboard.get_text() {
                        Ok(text) => return Ok(text),
                        Err(arboard::Error::ClipboardOccupied) => {
                            std::thread::sleep(Duration::from_millis(10 * (1 << attempt)));
                        }
                        Err(arboard::Error::ContentNotAvailable) => return Err(ReadTextError::Empty),
                        Err(e) => {
                            if attempt == 4 {
                                return Err(ReadTextError::PlatformError(e.to_string()));
                            }
                            std::thread::sleep(Duration::from_millis(10 * (1 << attempt)));
                        }
                    }
                }
                return Err(ReadTextError::ClipboardBusy);
            }

            #[cfg(not(windows))]
            {
                match clipboard.get_text() {
                    Ok(text) => Ok(text),
                    Err(arboard::Error::ContentNotAvailable) => Err(ReadTextError::Empty),
                    Err(arboard::Error::ClipboardOccupied) => Err(ReadTextError::ClipboardBusy),
                    Err(e) => {
                        #[cfg(target_os = "linux")]
                        {
                            // Auxiliary check via wl-paste on Wayland
                            if std::env::var("WAYLAND_DISPLAY").is_ok() {
                                if let Ok(output) = std::process::Command::new("wl-paste")
                                    .args(["-n", "--type", "text/plain"])
                                    .output()
                                {
                                    if output.status.success() {
                                        let s = String::from_utf8_lossy(&output.stdout).to_string();
                                        if !s.is_empty() {
                                            return Ok(s);
                                        }
                                        return Err(ReadTextError::Empty);
                                    }
                                }
                            }

                        }
                        Err(ReadTextError::VerificationUnavailable(e.to_string()))
                    }
                }
            }
        }

        #[cfg(target_os = "android")]
        {
            use tauri_plugin_clipboard_manager::ClipboardExt;
            match app.clipboard().read_text() {
                Ok(text) => Ok(text),
                Err(e) => {
                    // Android 10+ background restriction
                    let err_str = e.to_string();
                    if err_str.contains("empty") || err_str.contains("Empty") {
                        Err(ReadTextError::Empty)
                    } else {
                        Err(ReadTextError::RestrictedBackground)
                    }
                }
            }
        }
    }

    /// Clears the platform clipboard.
    ///
    /// - Linux: clears via arboard + wl-copy -c / xclip
    /// - Windows: clears via Win32 EmptyClipboard with exponential backoff
    /// - macOS: clears via NSPasteboard clearContents
    /// - Android: clears via native clearPrimaryClip()
    pub fn clear(app: &AppHandle) -> Result<(), String> {
        #[cfg(not(any(target_os = "android", target_os = "ios")))]
        {
            let mut errors = Vec::new();

            // 1. Primary clear via arboard
            if let Ok(mut cb) = arboard::Clipboard::new() {
                if let Err(e) = cb.clear() {
                    errors.push(format!("arboard clear: {}", e));
                }
            }

            // 2. Platform-specific auxiliary clear
            #[cfg(windows)]
            {
                if let Err(e) = Self::windows_clear_with_retry() {
                    errors.push(format!("win32 clear: {}", e));
                }
            }

            #[cfg(target_os = "linux")]
            {
                if std::env::var("WAYLAND_DISPLAY").is_ok() {
                    let _ = std::process::Command::new("wl-copy").arg("-c").spawn();
                } else if std::env::var("DISPLAY").is_ok() {
                    let _ = std::process::Command::new("xclip")
                        .args(["-selection", "clipboard", "/dev/null"])
                        .spawn();
                }
            }

            #[cfg(target_os = "macos")]
            {
                let _ = std::process::Command::new("pbcopy")
                    .stdin(std::process::Stdio::null())
                    .spawn();
            }

            // Also invoke tauri-plugin-clipboard-manager as secondary
            use tauri_plugin_clipboard_manager::ClipboardExt;
            let _ = app.clipboard().clear();

            Ok(())
        }

        #[cfg(target_os = "android")]
        {
            use tauri_plugin_clipboard_manager::ClipboardExt;
            app.clipboard().clear().map_err(|e| e.to_string())
        }
    }

    #[cfg(windows)]
    fn windows_clear_with_retry() -> Result<(), String> {
        #[link(name = "user32")]
        extern "system" {
            fn OpenClipboard(hwnd: *mut std::ffi::c_void) -> i32;
            fn EmptyClipboard() -> i32;
            fn CloseClipboard() -> i32;
        }

        // Bounded retry with exponential backoff (10, 20, 40, 80, 160ms = ~310ms total)
        for attempt in 0..5 {
            unsafe {
                if OpenClipboard(std::ptr::null_mut()) != 0 {
                    let _ = EmptyClipboard();
                    let _ = CloseClipboard();
                    return Ok(());
                }
            }
            std::thread::sleep(Duration::from_millis(10 * (1 << attempt)));
        }
        Err("Win32 OpenClipboard timed out after 5 retry attempts".to_string())
    }

    #[cfg(windows)]
    fn windows_write_with_retry(text: &str) -> Result<(), String> {
        #[link(name = "user32")]
        extern "system" {
            fn OpenClipboard(hwnd: *mut std::ffi::c_void) -> i32;
            fn EmptyClipboard() -> i32;
            fn CloseClipboard() -> i32;
            fn SetClipboardData(uFormat: u32, hMem: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
            fn RegisterClipboardFormatW(lpszFormat: *const u16) -> u32;
        }

        #[link(name = "kernel32")]
        extern "system" {
            fn GlobalAlloc(uFlags: u32, dwBytes: usize) -> *mut std::ffi::c_void;
            fn GlobalLock(hMem: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
            fn GlobalUnlock(hMem: *mut std::ffi::c_void) -> i32;
        }

        const CF_UNICODETEXT: u32 = 13;
        const GMEM_MOVEABLE: u32 = 0x0002;

        let wide: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
        let bytes = wide.len() * std::mem::size_of::<u16>();

        for attempt in 0..5 {
            unsafe {
                if OpenClipboard(std::ptr::null_mut()) != 0 {
                    let _ = EmptyClipboard();

                    let h_mem = GlobalAlloc(GMEM_MOVEABLE, bytes);
                    if !h_mem.is_null() {
                        let ptr = GlobalLock(h_mem) as *mut u16;
                        if !ptr.is_null() {
                            std::ptr::copy_nonoverlapping(wide.as_ptr(), ptr, wide.len());
                            GlobalUnlock(h_mem);
                            SetClipboardData(CF_UNICODETEXT, h_mem);
                        }
                    }

                    // Register and set sensitive exclusion formats (DWORD 0)
                    fn to_wide(s: &str) -> Vec<u16> {
                        s.encode_utf16().chain(std::iter::once(0)).collect()
                    }

                    let formats = [
                        "ExcludeClipboardContentFromMonitorProcessing",
                        "CanIncludeInClipboardHistory",
                        "CanUploadToCloudClipboard",
                    ];

                    for fmt_name in formats {
                        let w_fmt = to_wide(fmt_name);
                        let fmt_id = RegisterClipboardFormatW(w_fmt.as_ptr());
                        if fmt_id != 0 {
                            let h_data = GlobalAlloc(GMEM_MOVEABLE, 4);
                            if !h_data.is_null() {
                                let ptr = GlobalLock(h_data) as *mut u32;
                                if !ptr.is_null() {
                                    *ptr = 0;
                                    GlobalUnlock(h_data);
                                    SetClipboardData(fmt_id, h_data);
                                }
                            }
                        }
                    }

                    let _ = CloseClipboard();
                    return Ok(());
                }
            }
            std::thread::sleep(Duration::from_millis(10 * (1 << attempt)));
        }

        Err("Failed to write to Windows clipboard after retries".to_string())
    }
}
