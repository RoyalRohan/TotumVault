#[allow(unused_imports)]
use std::process::{Command, Stdio};
use zeroize::{Zeroize, Zeroizing};

pub fn copy_secret_to_clipboard(text: Zeroizing<String>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::System::DataExchange::{OpenClipboard, EmptyClipboard, SetClipboardData, CloseClipboard, RegisterClipboardFormatA};
        use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE, GHND};
        use windows::core::PCSTR;
        use std::ptr;
        
        unsafe {
            if OpenClipboard(None).is_err() {
                return Err("Failed to open clipboard".into());
            }
            let _ = EmptyClipboard();

            let mut utf16: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
            let size = utf16.len() * std::mem::size_of::<u16>();
            if let Ok(hglobal) = GlobalAlloc(GMEM_MOVEABLE, size) {
                let locked = GlobalLock(hglobal);
                if !locked.is_null() {
                    ptr::copy_nonoverlapping(utf16.as_ptr() as *const u8, locked as *mut u8, size);
                    let _ = GlobalUnlock(hglobal);
                    let handle: windows::Win32::Foundation::HANDLE = std::mem::transmute(hglobal);
                    let _ = SetClipboardData(13, handle); // 13 is CF_UNICODETEXT
                }
            }
            utf16.zeroize();

            let format_ignore = RegisterClipboardFormatA(PCSTR("Clipboard Viewer Ignore\0".as_ptr()));
            let format_exclude = RegisterClipboardFormatA(PCSTR("ExcludeClipboardContentFromMonitorProcessing\0".as_ptr()));
            let format_history = RegisterClipboardFormatA(PCSTR("CanIncludeInClipboardHistory\0".as_ptr()));
            let format_cloud = RegisterClipboardFormatA(PCSTR("CanUploadToCloudClipboard\0".as_ptr()));

            if format_ignore != 0 {
                let _ = SetClipboardData(format_ignore, windows::Win32::Foundation::HANDLE::default());
            }
            if format_exclude != 0 {
                let _ = SetClipboardData(format_exclude, windows::Win32::Foundation::HANDLE::default());
            }
            
            if format_history != 0 {
                if let Ok(h) = GlobalAlloc(GHND, 4) {
                    let locked = GlobalLock(h);
                    if !locked.is_null() {
                        *(locked as *mut u32) = 0;
                        let _ = GlobalUnlock(h);
                        let handle: windows::Win32::Foundation::HANDLE = std::mem::transmute(h);
                        let _ = SetClipboardData(format_history, handle);
                    }
                }
            }
            
            if format_cloud != 0 {
                if let Ok(h) = GlobalAlloc(GHND, 4) {
                    let locked = GlobalLock(h);
                    if !locked.is_null() {
                        *(locked as *mut u32) = 0;
                        let _ = GlobalUnlock(h);
                        let handle: windows::Win32::Foundation::HANDLE = std::mem::transmute(h);
                        let _ = SetClipboardData(format_cloud, handle);
                    }
                }
            }
            let _ = CloseClipboard();
        }
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        // Simple fallback for linux
        if std::env::var("WAYLAND_DISPLAY").is_ok() {
            let mut opts = wl_clipboard_rs::copy::Options::new();
            let _ = opts.copy(wl_clipboard_rs::copy::Source::Bytes(text.as_bytes().into()), wl_clipboard_rs::copy::MimeType::Text);
        } else {
            let _ = Command::new("xclip").args(["-selection", "clipboard", "-in"])
                .stdin(Stdio::piped())
                .spawn()
                .and_then(|mut child| {
                    use std::io::Write;
                    if let Some(mut stdin) = child.stdin.take() {
                        let _ = stdin.write_all(text.as_bytes());
                    }
                    child.wait()
                });
        }
        return Ok(());
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        return Err("Not implemented natively".into());
    }
}

/// Purges OS-level system clipboard using native window/compositor commands
pub fn clear_os_clipboard() -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        if std::env::var("WAYLAND_DISPLAY").is_ok() {
            use wl_clipboard_rs::copy::{Options, MimeType, Source};
            let mut opts = Options::new();
            if opts.copy(Source::Bytes([].into()), MimeType::Text).is_err() {
                return Err("Failed to clear clipboard due to Wayland focus constraints".into());
            }
        } else {
            let _ = Command::new("xclip").args(["-selection", "clipboard", "/dev/null"]).spawn();
            let _ = Command::new("xsel").args(["--clipboard", "--clear"]).spawn();
        }
    }

    #[cfg(target_os = "windows")]
    {
        use windows::Win32::System::DataExchange::{OpenClipboard, EmptyClipboard, CloseClipboard};
        unsafe {
            if OpenClipboard(None).is_ok() {
                let _ = EmptyClipboard();
                let _ = CloseClipboard();
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("pbcopy")
            .stdin(Stdio::null())
            .spawn();
    }

    Ok(())
}
