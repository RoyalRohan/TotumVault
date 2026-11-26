use std::path::Path;

pub trait DocumentReminderScheduler: Send + Sync {
    fn send_notification(&self, title: &str, body: &str) -> Result<(), String>;
    fn setup_platform_schedule(&self, exec_path: &Path) -> Result<(), String>;
    fn teardown_platform_schedule(&self) -> Result<(), String>;
    fn schedule_test_timer(&self, exec_path: &Path, delay_secs: u64, extra_args: Option<&str>) -> Result<(), String>;
}

/// Safely quotes an executable path or argument for systemd `ExecStart=` / XDG `.desktop` `Exec=`,
/// stripping newlines/control characters and escaping backslashes, double quotes, and `$`.
pub(crate) fn format_systemd_exec_arg(raw: &str) -> String {
    let sanitized: String = raw
        .chars()
        .filter(|&c| c != '\n' && c != '\r' && c != '\0')
        .collect();
    let escaped = sanitized
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('$', "$$");
    format!("\"{}\"", escaped)
}

/// Escapes special XML characters before embedding strings inside macOS LaunchAgent `.plist` files.
pub(crate) fn escape_plist_xml(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    for c in raw.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            '\0' => {}
            _ => out.push(c),
        }
    }
    out
}

/// Spawns a detached pure-Rust timer thread that invokes `exec_path --check-document-reminders`
/// directly via OS `execve` / `CreateProcessW` without invoking `sh -c` or `powershell -Command`.
#[allow(dead_code)]
fn spawn_delayed_reminder_check(
    exec_path: &Path,
    delay_secs: u64,
    extra_args: Option<&str>,
) -> Result<(), String> {
    let exe = exec_path.to_path_buf();
    let parsed_extra: Vec<String> = extra_args
        .unwrap_or("")
        .split_whitespace()
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect();
    let bounded_delay = delay_secs.min(86_400);

    std::thread::Builder::new()
        .name("totum-reminder-test-timer".to_string())
        .spawn(move || {
            std::thread::sleep(std::time::Duration::from_secs(bounded_delay));
            let mut cmd = std::process::Command::new(&exe);
            cmd.arg("--check-document-reminders");
            for arg in &parsed_extra {
                cmd.arg(arg);
            }
            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                const CREATE_NO_WINDOW: u32 = 0x0800_0000;
                cmd.creation_flags(CREATE_NO_WINDOW);
            }
            let _ = cmd.output();
        })
        .map(|_| ())
        .map_err(|e| format!("Failed to spawn test timer thread: {}", e))
}

// ======================== Linux Implementation ========================

#[derive(Default)]
pub struct LinuxReminderScheduler;

impl DocumentReminderScheduler for LinuxReminderScheduler {
    fn send_notification(&self, title: &str, body: &str) -> Result<(), String> {
        let output = std::process::Command::new("notify-send")
            .arg("-a")
            .arg("TotumVault")
            .arg("-u")
            .arg("normal")
            .arg("-i")
            .arg("dialog-warning")
            .arg("--")
            .arg(title)
            .arg(body)
            .output();

        match output {
            Ok(out) if out.status.success() => Ok(()),
            Ok(out) => Err(format!(
                "notify-send exited with status {}: {}",
                out.status,
                String::from_utf8_lossy(&out.stderr)
            )),
            Err(e) => Err(format!("Failed to execute notify-send: {}", e)),
        }
    }

    fn setup_platform_schedule(&self, exec_path: &Path) -> Result<(), String> {
        let home = std::env::var("HOME").map_err(|_| "HOME environment variable not set".to_string())?;
        let user_systemd_dir = std::path::PathBuf::from(&home).join(".config/systemd/user");
        let _ = std::fs::create_dir_all(&user_systemd_dir);

        let quoted_exec = format_systemd_exec_arg(&exec_path.to_string_lossy());

        let service_content = format!(
            "[Unit]\nDescription=TotumVault Document Renewal Reminders Check\n\n[Service]\nType=oneshot\nPassEnvironment=DBUS_SESSION_BUS_ADDRESS WAYLAND_DISPLAY DISPLAY XDG_RUNTIME_DIR\nExecStart={} --check-document-reminders\n",
            quoted_exec
        );
        let timer_content = "[Unit]\nDescription=Daily TotumVault Document Renewal Reminders Check\n\n[Timer]\nOnCalendar=*-*-* 09:00:00\nPersistent=true\n\n[Install]\nWantedBy=timers.target\n";

        let service_file = user_systemd_dir.join("totumvault-reminders.service");
        let timer_file = user_systemd_dir.join("totumvault-reminders.timer");

        let _ = std::fs::write(&service_file, service_content);
        let _ = std::fs::write(&timer_file, timer_content);

        // Attempt systemctl daemon-reload and enable timer
        let _ = std::process::Command::new("systemctl")
            .args(["--user", "daemon-reload"])
            .output();
        let _ = std::process::Command::new("systemctl")
            .args(["--user", "enable", "--now", "totumvault-reminders.timer"])
            .output();

        // Also add XDG autostart entry as universal fallback
        let autostart_dir = std::path::PathBuf::from(&home).join(".config/autostart");
        let _ = std::fs::create_dir_all(&autostart_dir);
        let desktop_content = format!(
            "[Desktop Entry]\nType=Application\nName=TotumVault Document Reminders\nExec={} --check-document-reminders\nHidden=false\nNoDisplay=true\nX-GNOME-Autostart-enabled=true\n",
            quoted_exec
        );
        let _ = std::fs::write(autostart_dir.join("totumvault-reminders.desktop"), desktop_content);

        Ok(())
    }

    fn teardown_platform_schedule(&self) -> Result<(), String> {
        let home = std::env::var("HOME").map_err(|_| "HOME not set".to_string())?;
        let _ = std::process::Command::new("systemctl")
            .args(["--user", "disable", "--now", "totumvault-reminders.timer"])
            .output();
        let _ = std::process::Command::new("systemctl")
            .args(["--user", "stop", "totumvault-reminders-test.timer"])
            .output();

        let user_systemd_dir = std::path::PathBuf::from(&home).join(".config/systemd/user");
        let _ = std::fs::remove_file(user_systemd_dir.join("totumvault-reminders.service"));
        let _ = std::fs::remove_file(user_systemd_dir.join("totumvault-reminders.timer"));
        let _ = std::fs::remove_file(user_systemd_dir.join("totumvault-reminders-test.timer"));

        let autostart_file = std::path::PathBuf::from(&home).join(".config/autostart/totumvault-reminders.desktop");
        let _ = std::fs::remove_file(autostart_file);

        let _ = std::process::Command::new("systemctl")
            .args(["--user", "daemon-reload"])
            .output();

        Ok(())
    }

    fn schedule_test_timer(&self, exec_path: &Path, delay_secs: u64, extra_args: Option<&str>) -> Result<(), String> {
        let home = std::env::var("HOME").map_err(|_| "HOME environment variable not set".to_string())?;
        let user_systemd_dir = std::path::PathBuf::from(&home).join(".config/systemd/user");
        let _ = std::fs::create_dir_all(&user_systemd_dir);

        let quoted_exec = format_systemd_exec_arg(&exec_path.to_string_lossy());
        let quoted_extra: Vec<String> = extra_args
            .unwrap_or("")
            .split_whitespace()
            .filter(|s| !s.is_empty())
            .map(format_systemd_exec_arg)
            .collect();
        let cmd = if quoted_extra.is_empty() {
            format!("{} --check-document-reminders", quoted_exec)
        } else {
            format!("{} --check-document-reminders {}", quoted_exec, quoted_extra.join(" "))
        };

        let service_content = format!(
            "[Unit]\nDescription=TotumVault Document Renewal Reminders Check\n\n[Service]\nType=oneshot\nPassEnvironment=DBUS_SESSION_BUS_ADDRESS WAYLAND_DISPLAY DISPLAY XDG_RUNTIME_DIR\nExecStart={}\n",
            cmd
        );
        let test_timer_content = format!(
            "[Unit]\nDescription=TotumVault Document Renewal Reminders Test Timer\n\n[Timer]\nOnActiveSec={}s\nAccuracySec=1s\nUnit=totumvault-reminders.service\n\n[Install]\nWantedBy=timers.target\n",
            delay_secs.min(86_400)
        );

        let service_file = user_systemd_dir.join("totumvault-reminders.service");
        let timer_file = user_systemd_dir.join("totumvault-reminders-test.timer");

        let _ = std::fs::write(&service_file, service_content);
        let _ = std::fs::write(&timer_file, test_timer_content);

        let _ = std::process::Command::new("systemctl")
            .args(["--user", "daemon-reload"])
            .output();
        let out = std::process::Command::new("systemctl")
            .args(["--user", "start", "totumvault-reminders-test.timer"])
            .output()
            .map_err(|e| format!("Failed to start test timer: {}", e))?;

        if !out.status.success() {
            return Err(format!("systemctl start totumvault-reminders-test.timer failed: {}", String::from_utf8_lossy(&out.stderr)));
        }

        Ok(())
    }
}

// ======================== Windows Implementation ========================

#[derive(Default)]
pub struct WindowsReminderScheduler;

impl DocumentReminderScheduler for WindowsReminderScheduler {
    fn send_notification(&self, title: &str, body: &str) -> Result<(), String> {
        const SCRIPT: &str = "\
            [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null; \
            $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); \
            $textNodes = $template.GetElementsByTagName('text'); \
            $textNodes.Item(0).AppendChild($template.CreateTextNode($env:TOTUM_NOTIF_TITLE)) | Out-Null; \
            $textNodes.Item(1).AppendChild($template.CreateTextNode($env:TOTUM_NOTIF_BODY)) | Out-Null; \
            $toast = [Windows.UI.Notifications.ToastNotification]::new($template); \
            [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('TotumVault').Show($toast);";

        let output = std::process::Command::new("powershell")
            .env("TOTUM_NOTIF_TITLE", title)
            .env("TOTUM_NOTIF_BODY", body)
            .args(["-NoProfile", "-NonInteractive", "-Command", SCRIPT])
            .output();

        match output {
            Ok(out) if out.status.success() => Ok(()),
            Ok(out) => Err(format!(
                "PowerShell toast failed with status {}: {}",
                out.status,
                String::from_utf8_lossy(&out.stderr)
            )),
            Err(e) => Err(format!("Failed to execute powershell: {}", e)),
        }
    }

    fn setup_platform_schedule(&self, exec_path: &Path) -> Result<(), String> {
        let exec_str = exec_path.to_string_lossy().replace('"', "");
        let task_cmd = format!("\"{}\" --check-document-reminders", exec_str);

        let output = std::process::Command::new("schtasks")
            .args([
                "/Create",
                "/SC",
                "DAILY",
                "/ST",
                "09:00",
                "/TN",
                "TotumVault\\DocumentReminders",
                "/TR",
                &task_cmd,
                "/F",
            ])
            .output();

        match output {
            Ok(out) if out.status.success() => Ok(()),
            Ok(out) => Err(format!(
                "schtasks failed: {}",
                String::from_utf8_lossy(&out.stderr)
            )),
            Err(e) => Err(format!("Failed to execute schtasks: {}", e)),
        }
    }

    fn teardown_platform_schedule(&self) -> Result<(), String> {
        let output = std::process::Command::new("schtasks")
            .args(["/Delete", "/TN", "TotumVault\\DocumentReminders", "/F"])
            .output();

        match output {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Failed to remove scheduled task: {}", e)),
        }
    }

    fn schedule_test_timer(&self, exec_path: &Path, delay_secs: u64, extra_args: Option<&str>) -> Result<(), String> {
        spawn_delayed_reminder_check(exec_path, delay_secs, extra_args)
    }
}

// ======================== macOS Implementation ========================

#[derive(Default)]
pub struct MacOSReminderScheduler;

impl DocumentReminderScheduler for MacOSReminderScheduler {
    fn send_notification(&self, title: &str, body: &str) -> Result<(), String> {
        const SCRIPT: &str = "display notification (system attribute \"TOTUM_NOTIF_BODY\") with title (system attribute \"TOTUM_NOTIF_TITLE\")";

        let output = std::process::Command::new("osascript")
            .env("TOTUM_NOTIF_TITLE", title)
            .env("TOTUM_NOTIF_BODY", body)
            .args(["-e", SCRIPT])
            .output();

        match output {
            Ok(out) if out.status.success() => Ok(()),
            Ok(out) => Err(format!(
                "osascript failed: {}",
                String::from_utf8_lossy(&out.stderr)
            )),
            Err(e) => Err(format!("Failed to execute osascript: {}", e)),
        }
    }

    fn setup_platform_schedule(&self, exec_path: &Path) -> Result<(), String> {
        let home = std::env::var("HOME").map_err(|_| "HOME not set".to_string())?;
        let agents_dir = std::path::PathBuf::from(&home).join("Library/LaunchAgents");
        let _ = std::fs::create_dir_all(&agents_dir);

        let plist_path = agents_dir.join("com.royalrohan.veylock.documentreminders.plist");
        let escaped_exec = escape_plist_xml(&exec_path.to_string_lossy());

        let plist_content = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.royalrohan.veylock.documentreminders</string>
    <key>ProgramArguments</key>
    <array>
        <string>{}</string>
        <string>--check-document-reminders</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>9</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>"#,
            escaped_exec
        );

        let _ = std::fs::write(&plist_path, plist_content);
        let _ = std::process::Command::new("launchctl")
            .args(["load", &plist_path.to_string_lossy()])
            .output();

        Ok(())
    }

    fn teardown_platform_schedule(&self) -> Result<(), String> {
        let home = std::env::var("HOME").map_err(|_| "HOME not set".to_string())?;
        let plist_path = std::path::PathBuf::from(&home)
            .join("Library/LaunchAgents/com.royalrohan.veylock.documentreminders.plist");

        let _ = std::process::Command::new("launchctl")
            .args(["unload", &plist_path.to_string_lossy()])
            .output();
        let _ = std::fs::remove_file(plist_path);

        Ok(())
    }

    fn schedule_test_timer(&self, exec_path: &Path, delay_secs: u64, extra_args: Option<&str>) -> Result<(), String> {
        spawn_delayed_reminder_check(exec_path, delay_secs, extra_args)
    }
}

// ======================== Fallback / Test Scheduler ========================

#[derive(Default)]
pub struct MockReminderScheduler {
    pub sent_notifications: std::sync::Arc<std::sync::Mutex<Vec<(String, String)>>>,
}

impl DocumentReminderScheduler for MockReminderScheduler {
    fn send_notification(&self, title: &str, body: &str) -> Result<(), String> {
        let mut list = self.sent_notifications.lock().unwrap();
        list.push((title.to_string(), body.to_string()));
        Ok(())
    }

    fn setup_platform_schedule(&self, _exec_path: &Path) -> Result<(), String> {
        Ok(())
    }

    fn teardown_platform_schedule(&self) -> Result<(), String> {
        Ok(())
    }

    fn schedule_test_timer(&self, _exec_path: &Path, _delay_secs: u64, _extra_args: Option<&str>) -> Result<(), String> {
        Ok(())
    }
}

// ======================== Android Implementation ========================

#[cfg(target_os = "android")]
#[derive(Default)]
pub struct AndroidReminderScheduler;

#[cfg(target_os = "android")]
impl DocumentReminderScheduler for AndroidReminderScheduler {
    fn send_notification(&self, _title: &str, _body: &str) -> Result<(), String> {
        // Handled natively by DocumentReminderReceiver and AndroidNotification bridge
        Ok(())
    }

    fn setup_platform_schedule(&self, _exec_path: &Path) -> Result<(), String> {
        // Native AlarmManager is scheduled via DocumentReminderReceiver / AndroidNotificationBridge
        Ok(())
    }

    fn teardown_platform_schedule(&self) -> Result<(), String> {
        // Native AlarmManager canceled via DocumentReminderReceiver
        Ok(())
    }

    fn schedule_test_timer(&self, _exec_path: &Path, _delay_secs: u64, _extra_args: Option<&str>) -> Result<(), String> {
        Ok(())
    }
}

pub fn create_default_scheduler() -> Box<dyn DocumentReminderScheduler> {
    #[cfg(target_os = "android")]
    {
        Box::new(AndroidReminderScheduler)
    }
    #[cfg(target_os = "linux")]
    {
        Box::new(LinuxReminderScheduler)
    }
    #[cfg(target_os = "windows")]
    {
        Box::new(WindowsReminderScheduler)
    }
    #[cfg(target_os = "macos")]
    {
        Box::new(MacOSReminderScheduler)
    }
    #[cfg(not(any(target_os = "android", target_os = "linux", target_os = "windows", target_os = "macos")))]
    {
        Box::new(MockReminderScheduler::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_systemd_exec_arg_escaping_blocks_injection_and_handles_spaces() {
        let path_with_spaces = "/home/user/My Apps/TotumVault$1\"test\nExecStart=/bin/evil";
        let quoted = format_systemd_exec_arg(path_with_spaces);
        assert!(!quoted.contains('\n'));
        assert_eq!(
            quoted,
            "\"/home/user/My Apps/TotumVault$$1\\\"testExecStart=/bin/evil\""
        );
    }

    #[test]
    fn test_plist_xml_escaping_blocks_tag_breakout() {
        let malicious_path = "/Users/A&B/<script>\"quote'apos/TotumVault";
        let escaped = escape_plist_xml(malicious_path);
        assert_eq!(
            escaped,
            "/Users/A&amp;B/&lt;script&gt;&quot;quote&apos;apos/TotumVault"
        );
    }
}
