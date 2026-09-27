use serde::{Deserialize, Serialize};
#[allow(unused_imports)]
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ScreenProtectionStatus {
    pub supported: bool,
    pub platform: String,
    pub active: bool,
    pub description: String,
    #[serde(default)]
    pub native_exclusion: bool,
    #[serde(default)]
    pub status_code: String, // "active", "partial", "unsupported", "failed", "disabled"
}

/// Helper to classify Windows display affinity results into an accurate capability model.
/// WDA_EXCLUDEFROMCAPTURE (0x11) provides true capture exclusion.
/// WDA_MONITOR (0x1) provides visual blanking in captures, but is NOT true exclusion.
pub fn classify_windows_protection(
    enabled: bool,
    exclusion_success: bool,
    monitor_fallback: bool,
    last_error: Option<u32>,
) -> ScreenProtectionStatus {
    if !enabled {
        return ScreenProtectionStatus {
            supported: true,
            platform: "windows".to_string(),
            active: false,
            native_exclusion: false,
            status_code: "disabled".to_string(),
            description: "Windows screen capture protection is disabled.".to_string(),
        };
    }

    if exclusion_success {
        ScreenProtectionStatus {
            supported: true,
            platform: "windows".to_string(),
            active: true,
            native_exclusion: true,
            status_code: "active".to_string(),
            description: "Windows Display Affinity (WDA_EXCLUDEFROMCAPTURE) active. Excludes window from supported capture APIs (OBS window capture, Snipping Tool, screen sharing).".to_string(),
        }
    } else if monitor_fallback {
        ScreenProtectionStatus {
            supported: true,
            platform: "windows".to_string(),
            active: true,
            native_exclusion: false,
            status_code: "partial".to_string(),
            description: "Windows Display Affinity (WDA_MONITOR) active (legacy capture blanking). Window appears black in captures, but true capture exclusion is not supported on this Windows build.".to_string(),
        }
    } else {
        let err_msg = match last_error {
            Some(code) => format!(" (Win32 error: {})", code),
            None => String::new(),
        };
        ScreenProtectionStatus {
            supported: true,
            platform: "windows".to_string(),
            active: false,
            native_exclusion: false,
            status_code: "failed".to_string(),
            description: format!("Failed to apply Windows Display Affinity{}. Native window capture protection unavailable.", err_msg),
        }
    }
}

#[allow(unused_variables)]
pub fn apply_screen_protection(_app: &AppHandle, enabled: bool) -> Result<ScreenProtectionStatus, String> {
    #[cfg(target_os = "windows")]
    {
        #[link(name = "user32")]
        extern "system" {
            fn SetWindowDisplayAffinity(hwnd: *mut std::ffi::c_void, dw_affinity: u32) -> i32;
            fn GetLastError() -> u32;
        }

        // WDA_NONE = 0x00000000
        // WDA_MONITOR = 0x00000001 (blackout in captures, supported since Win7)
        // WDA_EXCLUDEFROMCAPTURE = 0x00000011 (complete exclusion, supported since Win10 2004 / build 19041)
        let primary_affinity: u32 = if enabled { 0x00000011 } else { 0x00000000 };
        let fallback_affinity: u32 = if enabled { 0x00000001 } else { 0x00000000 };

        let windows = _app.webview_windows();
        let mut exclusion_success = false;
        let mut monitor_fallback = false;
        let mut last_error: Option<u32> = None;

        for (_label, window) in windows {
            // Invoke Tauri's built-in set_content_protected
            let _ = window.set_content_protected(enabled);

            if let Ok(hwnd) = window.hwnd() {
                let hwnd_ptr = hwnd.0 as *mut std::ffi::c_void;
                if enabled {
                    let res = unsafe { SetWindowDisplayAffinity(hwnd_ptr, primary_affinity) };
                    if res != 0 {
                        exclusion_success = true;
                    } else {
                        let err = unsafe { GetLastError() };
                        last_error = Some(err);
                        // Fallback attempt to WDA_MONITOR on older Windows 10 / 8.1 / 7 builds
                        let fallback_res = unsafe { SetWindowDisplayAffinity(hwnd_ptr, fallback_affinity) };
                        if fallback_res != 0 {
                            monitor_fallback = true;
                        } else {
                            last_error = Some(unsafe { GetLastError() });
                        }
                    }
                } else {
                    let _ = unsafe { SetWindowDisplayAffinity(hwnd_ptr, 0x00000000) };
                }
            }
        }

        return Ok(classify_windows_protection(enabled, exclusion_success, monitor_fallback, last_error));
    }

    #[cfg(target_os = "android")]
    {
        return Ok(ScreenProtectionStatus {
            supported: true,
            platform: "android".to_string(),
            active: enabled,
            native_exclusion: enabled,
            status_code: if enabled { "active".to_string() } else { "disabled".to_string() },
            description: "Android FLAG_SECURE active on application window. Prevents screenshots, screen recordings, and recent app switcher previews at OS level.".to_string(),
        });
    }

    #[cfg(target_os = "macos")]
    {
        let windows = _app.webview_windows();
        let mut any_success = false;
        for (_label, window) in windows {
            if window.set_content_protected(enabled).is_ok() {
                any_success = true;
            }
        }
        return Ok(ScreenProtectionStatus {
            supported: true,
            platform: "macos".to_string(),
            active: enabled && any_success,
            native_exclusion: false, // Truthful: modern ScreenCaptureKit tools bypass NSWindowSharingNone on macOS 15+
            status_code: if enabled { "partial".to_string() } else { "disabled".to_string() },
            description: if enabled {
                "macOS WindowServer isolation configured (legacy CoreGraphics capture excluded). Note: modern ScreenCaptureKit tools can capture visible windows because macOS does not provide an application-initiated exclusion API.".to_string()
            } else {
                "macOS screen protection disabled.".to_string()
            },
        });
    }

    #[cfg(target_os = "linux")]
    {
        let is_wayland = std::env::var("WAYLAND_DISPLAY").is_ok();
        let platform_name = if is_wayland { "linux-wayland" } else { "linux-x11" };
        let desc = if is_wayland {
            "Linux (Wayland): Native window-level capture exclusion is not supported by Wayland compositors. Wayland relies on user-consented desktop portal permissions.".to_string()
        } else {
            "Linux (X11): The X11 display protocol does not support native window-level capture exclusion.".to_string()
        };
        return Ok(ScreenProtectionStatus {
            supported: false,
            platform: platform_name.to_string(),
            active: false,
            native_exclusion: false,
            status_code: "unsupported".to_string(),
            description: desc,
        });
    }

    #[cfg(not(any(target_os = "windows", target_os = "android", target_os = "macos", target_os = "linux")))]
    {
        return Ok(ScreenProtectionStatus {
            supported: false,
            platform: "unknown".to_string(),
            active: false,
            native_exclusion: false,
            status_code: "unsupported".to_string(),
            description: "Platform does not support native window screen capture protection.".to_string(),
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_classify_windows_protection_active() {
        let status = classify_windows_protection(true, true, false, None);
        assert!(status.supported);
        assert!(status.active);
        assert!(status.native_exclusion);
        assert_eq!(status.status_code, "active");
        assert!(status.description.contains("WDA_EXCLUDEFROMCAPTURE"));
    }

    #[test]
    fn test_classify_windows_protection_partial_monitor_fallback() {
        let status = classify_windows_protection(true, false, true, Some(87));
        assert!(status.supported);
        assert!(status.active);
        assert!(!status.native_exclusion); // WDA_MONITOR is NOT true exclusion
        assert_eq!(status.status_code, "partial");
        assert!(status.description.contains("WDA_MONITOR"));
    }

    #[test]
    fn test_classify_windows_protection_failed() {
        let status = classify_windows_protection(true, false, false, Some(5));
        assert!(status.supported);
        assert!(!status.active);
        assert!(!status.native_exclusion);
        assert_eq!(status.status_code, "failed");
        assert!(status.description.contains("Win32 error: 5"));
    }

    #[test]
    fn test_classify_windows_protection_disabled() {
        let status = classify_windows_protection(false, false, false, None);
        assert!(status.supported);
        assert!(!status.active);
        assert!(!status.native_exclusion);
        assert_eq!(status.status_code, "disabled");
    }

    #[test]
    fn test_screen_protection_status_serialization_roundtrip() {
        let original = ScreenProtectionStatus {
            supported: true,
            platform: "windows".to_string(),
            active: true,
            description: "Protected".to_string(),
            native_exclusion: true,
            status_code: "active".to_string(),
        };

        let json = serde_json::to_string(&original).unwrap();
        let parsed: ScreenProtectionStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(original, parsed);
    }
}
