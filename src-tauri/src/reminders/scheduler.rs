use std::path::Path;

pub trait DocumentReminderScheduler: Send + Sync {
    fn send_notification(&self, title: &str, body: &str) -> Result<(), String>;
    fn setup_platform_schedule(&self, exec_path: &Path) -> Result<(), String>;
    fn teardown_platform_schedule(&self) -> Result<(), String>;
    fn schedule_test_timer(&self, exec_path: &Path, delay_secs: u64, extra_args: Option<&str>) -> Result<(), String>;
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

        let exec_str = exec_path.to_string_lossy();

        let service_content = format!(
            "[Unit]\nDescription=TotumVault Document Renewal Reminders Check\n\n[Service]\nType=oneshot\nPassEnvironment=DBUS_SESSION_BUS_ADDRESS WAYLAND_DISPLAY DISPLAY XDG_RUNTIME_DIR\nExecStart={} --check-document-reminders\n",
            exec_str
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
            exec_str
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

        let exec_str = exec_path.to_string_lossy();
        let cmd = if let Some(args) = extra_args {
            format!("{} --check-document-reminders {}", exec_str, args)
        } else {
            format!("{} --check-document-reminders", exec_str)
        };

        let service_content = format!(
            "[Unit]\nDescription=TotumVault Document Renewal Reminders Check\n\n[Service]\nType=oneshot\nPassEnvironment=DBUS_SESSION_BUS_ADDRESS WAYLAND_DISPLAY DISPLAY XDG_RUNTIME_DIR\nExecStart={}\n",
            cmd
        );
        let test_timer_content = format!(
            "[Unit]\nDescription=TotumVault Document Renewal Reminders Test Timer\n\n[Timer]\nOnActiveSec={}s\nAccuracySec=1s\nUnit=totumvault-reminders.service\n\n[Install]\nWantedBy=timers.target\n",
            delay_secs
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
        let escaped_title = title.replace('"', "`\"").replace('\'', "''");
        let escaped_body = body.replace('"', "`\"").replace('\'', "''");

        let script = format!(
            "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null; \
             $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); \
             $textNodes = $template.GetElementsByTagName('text'); \
             $textNodes.Item(0).AppendChild($template.CreateTextNode('{}')) | Out-Null; \
             $textNodes.Item(1).AppendChild($template.CreateTextNode('{}')) | Out-Null; \
             $toast = [Windows.UI.Notifications.ToastNotification]::new($template); \
             [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('TotumVault').Show($toast);",
            escaped_title, escaped_body
        );

        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
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
        let exec_str = exec_path.to_string_lossy();
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
        let args_str = extra_args.unwrap_or("");
        let cmd = format!("Start-Sleep -Seconds {}; & '{}' --check-document-reminders {}", delay_secs, exec_path.to_string_lossy(), args_str);
        let _ = std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", &cmd])
            .spawn()
            .map_err(|e| format!("Failed to spawn test timer process: {}", e))?;
        Ok(())
    }
}

// ======================== macOS Implementation ========================

#[derive(Default)]
pub struct MacOSReminderScheduler;

impl DocumentReminderScheduler for MacOSReminderScheduler {
    fn send_notification(&self, title: &str, body: &str) -> Result<(), String> {
        let escaped_title = title.replace('\\', "\\\\").replace('"', "\\\"");
        let escaped_body = body.replace('\\', "\\\\").replace('"', "\\\"");

        let script = format!(
            "display notification \"{}\" with title \"{}\"",
            escaped_body, escaped_title
        );

        let output = std::process::Command::new("osascript")
            .args(["-e", &script])
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
        let exec_str = exec_path.to_string_lossy();

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
            exec_str
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
        let args_str = extra_args.unwrap_or("");
        let cmd = format!("sleep {}; '{}' --check-document-reminders {}", delay_secs, exec_path.to_string_lossy(), args_str);
        let _ = std::process::Command::new("sh")
            .args(["-c", &cmd])
            .spawn()
            .map_err(|e| format!("Failed to spawn test timer process: {}", e))?;
        Ok(())
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

pub fn create_default_scheduler() -> Box<dyn DocumentReminderScheduler> {
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
    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    {
        Box::new(LinuxReminderScheduler)
    }
}
