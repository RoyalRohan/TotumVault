# Changelog

All notable changes to TotumVault are documented here.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [2.0.2] — 2026-11-26

TotumVault v2.0.2 is a comprehensive security and reliability hardening release addressing 10 vulnerabilities and edge cases identified during a full-stack audit across the Rust cryptographic engine, SQLite storage layer, Tauri IPC boundary, OS reminder scheduler, Android native bridge, and offline document preview engine.

### Security
- **Vault Initialization Overwrite Guard (`VaultManager::create_vault`)**: Blocked `create_vault` when an existing vault is already initialized and wrapped metadata initialization inside an atomic SQLite transaction, preventing duplicate or locked-state IPC calls from overwriting `wrapped_vek_ciphertext` and rendering stored data undecryptable.
- **OS Reminder Scheduler Injection Hardening (`reminders::scheduler`)**:
  - Eliminated `sh -c` and `powershell -Command` string interpolation for delayed test timers via pure Rust background process spawning (`CREATE_NO_WINDOW` on Windows).
  - Passed Windows PowerShell and macOS `osascript` notification titles/bodies via environment variables (`TOTUM_NOTIF_TITLE`, `TOTUM_NOTIF_BODY`) rather than inline script interpolation.
  - Added `--` option termination for Linux `notify-send`, systemd/autostart argument quoting (`format_systemd_exec_arg`), and XML entity escaping (`escape_plist_xml`) for macOS LaunchAgent plists.
- **Locked-Vault IPC Access Controls & Backend Biometric Lockout**:
  - Enforced backend `ensure_unlocked` / `ensure_unlocked_or_uninitialized` checks prior to local file reads and state mutations across `read_source_file`, `read_binary_source_file`, `import_vault_backup`, `analyze_import`, `commit_import`, `import_plaintext_csv`, `set_auto_lock_timer`, `setup_biometric_unlock`, `disable_biometric_unlock`, `set_air_gap_mode`, and document reminder commands.
  - Enforced persistent 3-strike biometric lockout (`MAX_BIOMETRIC_ATTEMPTS = 3`) in Rust inside `unlock_vault_biometric` rather than relying solely on frontend React state.
- **Android Backup Exfiltration & `@JavascriptInterface` Hardening (`scripts/patch-android-manifest.js`)**:
  - Enforced `android:allowBackup="false"` and `android:fullBackupContent="false"` in `AndroidManifest.xml` to block cloud Auto-Backup and `adb backup` extraction of `vault.sqlite` and biometric keystore files.
  - Escaped `callbackId` via `JSONObject.quote(callbackId)` before `webView.evaluateJavascript(...)` in `AndroidBiometricsBridge` and `AndroidNotificationBridge`, and zeroized raw `ByteArray` secrets immediately after Keystore cipher operations.
- **Bounded ZIP / DEFLATE Extraction in Offline Document Preview (`documentPreviewEngine.ts`)**:
  - Enforced archive entry count (`2,000` max), per-entry (`16 MB`), and cumulative (`48 MB`) streaming inflate limits across `.docx`, `.xlsx`, `.ods`, `.odt`, and `.pptx` previews—aborting decompression mid-stream to prevent ZIP/media bombs from crashing the WebView.
- **Memory Zeroization, SQLite `secure_delete`, Air-Gap Link Enforcement & CSV Formula Neutralization**:
  - Enabled `PRAGMA secure_delete = ON;` on SQLite connections so deleted rows and freelist pages are overwritten with zeroes on disk.
  - Zeroized sensitive IPC `String` inputs, decrypted export/import byte buffers, and OS clipboard verification reads (`current_text`) immediately after use.
  - Blocked external browser link launches in `EntryDetail` and `LockScreen` while Air-Gap Mode is active and separated strict `http:`/`https:` URL parsing from fallback link opening.
  - Extended CSV formula neutralization (`escape_csv` / `clean_csv_field`) to cover leading-whitespace and pipe (`|`) command triggers.

### Fixed
- **Atomic SQLite Transactions & WAL-Safe Import Rollback (`VaultManager`)**: Wrapped `change_master_password`, `import_backup`, `setup_biometric_unlock`, and `disable_biometric_unlock` in atomic SQLite transactions, and added `PRAGMA wal_checkpoint(TRUNCATE)` plus `-wal`/`-shm` sidecar cleanup during `commit_import` snapshotting and rollback.
- **Biometric Enrollment Sync After Password Rotation or Restore (`VaultContext`)**: Automatically cleared Android Keystore biometric enrollment and local tokens upon master password rotation or `.tvault` backup restore, and verified backend `is_biometric_enabled` status on startup.

## [2.0.1] — 2026-11-20

TotumVault v2.0.1 introduces encrypted multi-format document storage and offline in-app viewing across desktop and Android, enabling users to securely upload, organize, preview, and export PDFs, Word documents, spreadsheets, presentations, text files, and arbitrary attachments alongside camera scans.

### Added
- **Multi-Format Encrypted Document Vault (`Documents`)**:
  - **Upload PDF, Office, Text & Arbitrary Files**: Support for uploading PDF (`.pdf`), Word (`.docx`, `.doc`, `.odt`, `.rtf`), spreadsheets (`.xlsx`, `.ods`, `.csv`, `.tsv`), presentations (`.pptx`), plain text/code/config (`.txt`, `.md`, `.json`, `.xml`), and any general binary attachment alongside existing JPEG/PNG/WebP/HEIC scans.
  - **Mixed Batch Staging & Smart Metadata**: Select multiple heterogeneous files and images via an unrestricted file picker (omitting `accept` filters for full WebKitGTK/WKWebView/WebView2/Android file manager visibility) plus native desktop dialog and Tauri drag-and-drop support (`read_binary_source_file`), automatically infer document titles from the first filename, display format badges on cards/list rows/page strips, and search documents by original filename or format badge.
  - **100% Offline In-App Reader & Preview Engine**:
    - **PDF Viewer**: Bundled offline `pdfjs-dist` page-by-page canvas renderer running in-process without external workers or network calls, plus automatic Page 1 thumbnail generation on upload.
    - **Word & Text Reader**: Offline `.docx` conversion (`mammoth`) rendered through a strict DOM allowlist HTML sanitizer with light/dark paper mode toggle, font zoom, word count, and one-click copy, plus dedicated `.odt`, `.rtf`, Markdown, JSON, XML, and plain-text viewers.
    - **Spreadsheet & Slide Viewers**: Offline multi-sheet interactive table viewer for `.xlsx`, `.ods`, `.csv`, and `.tsv` files, slide-card reader for `.pptx` presentations, and encrypted file metadata/download cards for generic binaries.
  - **Format-Aware Native Export (`export_document_page`)**: Save decrypted document pages and binary files directly with their original filenames and extensions on both desktop and Android (`content://` URIs).

### Changed
- **Encrypted Page Schema & Metadata**: Extended SQLite `document_pages` with backward-compatible `file_name` migration and enriched `DocumentMetadata` with `primary_mime_type`, `primary_file_name`, and `total_file_size`.
- **Mobile Viewer Touch Scrolling**: Scoped canvas pinch/pan touch locking (`touch-none`) strictly to image and PDF canvases so Word, spreadsheet, slide, and text readers scroll natively on Android phones and tablets.

### Fixed
- **Encrypted Backup (`.tvault`) Multi-Format Roundtrip**: Fixed backup import re-encryption overwriting non-image page MIME types as `image/jpeg` and dropping `file_name`; imported `.tvault` archives now preserve exact document MIME types and filenames across backup/restore.

## [2.0.0] — 2026-10-03

TotumVault v2.0.0 is a milestone release delivering robust offline capabilities, local background notifications, dual-calendar support, strict air-gap isolation, and comprehensive system hardening. This release consolidates all major features developed from v1.3.2 through v2.0.0 into a unified, production-grade local-first security platform.

### Added

- **Real Offline Android Document Expiry Notification Pipeline**:
  - Full native background scheduling via Android `AlarmManager` and `DocumentReminderReceiver` with persistent broadcast receiver filters (`BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`, `TIMEZONE_CHANGED`, `TIME_SET`, `DATE_CHANGED`).
  - Resilient multi-path SQLite database resolution discovering `vault.sqlite` across `context.dataDir` (Tauri v2 Android app data directory), `applicationInfo.dataDir`, subdirectories, and shallow recursive fallback.
  - Concurrent SQLite WAL mode support (`OPEN_READWRITE or ENABLE_WRITE_AHEAD_LOGGING`) eliminating lock contention against the Rust backend.
  - DST-safe day-difference calculation (`Math.round`) ensuring exact milestone countdown delivery (5, 4, 3, 2, 1 days before, expiry day, and post-expiry single alert).
  - End-to-end 30-second scheduled test alarm (`Test 30s Alarm`) in Document Settings to verify background wakeups and receiver delivery on physical devices and emulators.
  - Contextual in-app notification permission explanation modal (`NotificationPermissionPrompt`) triggered immediately upon setting document expiry or enabling reminders.
  - Safe technical diagnostic logging (`REMINDER:` prefix) with zero sensitive data or credential leakage.

- **Collision-Aware Dual Calendar System (Gregorian AD + Nepali Bikram Sambat BS)**:
  - Accurate offline bidirectional conversion between Gregorian (AD) and Nepali Bikram Sambat (BS) calendars.
  - Responsive BS and AD calendar date pickers with zero horizontal overflow across 320px–1920px viewports.
  - Full touch-target compliance guaranteeing 44px–48px minimum hit areas on desktop and mobile.
  - Dynamic variable month-length calculation for BS calendar months based on historical and astronomical Nepali calendar tables.
  - Integrated dual AD/BS date presentation across Document & Bill expiry tracking, Software Licenses, and item forms.
  - User preference setting for default calendar format (Gregorian AD or Nepali BS) across the application.

- **Application-Level Air-Gap Mode & Network Isolation**:
  - Strict network policy isolation service blocking outbound network requests when Air-Gap Mode is enabled.
  - Synchronous early fetch gate interception and backend policy verification.
  - Safe air-gap test command (`test_air_gap_blocking`) guaranteeing zero network bytes transmitted.
  - Real-time event notifications (`totumvault://air-gap-changed`) synchronizing network status across desktop and mobile.

- **Production Preferences & Settings Architecture**:
  - Re-architected settings modal into 7 dedicated categories: General, Appearance, Security, Privacy & Network, Documents & Expiry, Data Management, and Updates.
  - Responsive desktop sidebar navigation with instant section switching and status badges.
  - Mobile-optimized segmented tab navigation with compact overview and bottom vault status.
  - Strictly single-source update toggle eliminating duplicate controls.
  - Dynamic authoritative app version resolution bound directly to `get_app_version()`.

- **Unified Single Documents Search & Navigation**:
  - Context-aware global header unmounting in Documents view, establishing a single authoritative search and filter toolbar.
  - Keyboard shortcut navigation (`Ctrl+K` / `⌘K` to focus, `Escape` to clear/blur) and mobile drawer menu integration.

- **Hardened Multi-Tier Secure Clipboard Engine**:
  - Concurrency-safe clipboard auto-clear with atomic operation mutex serialization (`op_mutex`) and monotonic generation reservation (`pending_generation`).
  - Android native bridge support with `EXTRA_IS_SENSITIVE` flag (Android 13+) preventing clipboard previews and cloud sync.
  - Native Tauri secure clipboard pipeline registering cryptographic HMAC session in native Rust with `ZeroizeOnDrop`.
  - Multi-tier fallback pipeline (Android native, Tauri plugin, Web API, DOM execCommand) ensuring reliable clipboard clearing across all environments.

- **Production Codebase Hardening & Official Portal Branding**:
  - Official portal branding: Updated Lock Screen to link directly to `totumvault.app`.
  - Cleaned up redundant placeholder text, verbose comments, TODOs, and vibe-coded commentary across 43 codebase files.
  - Strictly preserved genuine technical, cryptographic, and architectural invariant comments.

### Fixed

- **Android Scheduled Notification Delivery**: Resolved runtime failure where scheduled alarms could not locate `vault.sqlite` in `context.dataDir`.
- **Documents Duplicate Search Input**: Resolved layout defect where global vault search and document library search rendered concurrently.
- **Secure Clipboard Auto-Clear**: Hardened auto-clear timers and generation tracking for atomic clipboard purging.
- **Version Reporting Consistency**: Eliminated hardcoded version fallback strings across all settings and navigation components.

## [1.3.4] — 2026-09-29

### Added

- **Dual Calendar System (Gregorian AD + Nepali Bikram Sambat BS)**:
  - Integrated accurate, offline bidirectional conversion between Gregorian (AD) and Nepali Bikram Sambat (BS) calendars.
  - Responsive BS Calendar date picker modal featuring smooth month and year navigation.
  - Document & Bills expiry and renewal tracking integrated with dual AD/BS date presentation.
  - Calendar preference setting allowing users to select default calendar format across the vault.
- **Complete Production Preferences Redesign**:
  - Re-architected settings modal into 7 dedicated categories: General, Appearance, Security, Privacy & Network, Documents & Expiry, Data Management, and Updates.
  - Responsive desktop sidebar navigation with instant section switching and status badges.
  - Mobile-optimized segmented tab navigation with compact overview and bottom vault status.
  - Strictly single-source update toggle eliminating duplicate controls.
  - Dynamic authoritative app version resolution bound directly to `get_app_version()`.

### Improved

- **Version Consistency & UI Integrity**:
  - Eliminated hardcoded version fallback strings across all settings and navigation components.
  - Guaranteed truthful version reporting backed by Cargo and runtime metadata.

## [1.3.3] — 2026-09-29

### Added

- **Application-Level Air-Gap Mode**:
  - Strict network policy isolation service blocking outbound network requests when air-gap mode is active.
- **Document Renewal & Expiry Reminders**:
  - Local document expiry alerts (5, 4, 3, 2, 1 days before, expiry day, and day after) with zero cloud dependency.

### Fixed

- **Secure Clipboard Concurrency**:
  - Hardened auto-clear timers and generation tracking for atomic clipboard purging.

## [1.3.2] — 2026-09-26

### Added

- **Production Cryptographic Automatic Updates**:
  - Integrated official Tauri 2 in-process updater with Ed25519 Minisign cryptographic signature verification for desktop platforms (Windows, macOS, Linux).
  - Configured `createUpdaterArtifacts` and automated multi-platform release signing in GitHub Actions workflow.
  - Interactive dashboard update modal (`UpdateDialog`) with download progress tracking, automatic application restart, and version-skip support.
  - Architecture-aware Android APK update installer matching `arm64-v8a`, `armeabi-v7a`, and universal APKs.
  - Dedicated "Application & Updates" section in Settings with startup check preference toggle and manual check status.
- **Hardware-Backed Android Biometric Unlock**:
  - Native `AndroidKeyStore` AES-256-GCM hardware key encryption bound to `BIOMETRIC_STRONG` policy.
  - Key invalidation upon new biometric enrollment (`setInvalidatedByBiometricEnrollment`).
  - Strictly no PIN, pattern, or device credential fallback.
  - Enforced 3-attempt biometric lockout falling back to master password.
  - Automatic biometric unlock prompt on app launch for locked vaults.
- **VS Code-Style Hierarchical Login Tree**:
  - Interactive hierarchical drag-and-drop tree system exclusively for the "Logins" category.
  - Supports dragging entries into nested subfolders or root/unfiled, dragging folders to re-parent or re-order, visual drop position indicators, and expand/collapse state persistence.
  - Zero side effects on Documents, Cards, Notes, Licenses, Servers, or Authenticator categories.
- **Desktop Native Window Capture Protection Redesign**:
  - Redesigned desktop screen protection from intrusive focus-loss blur to native OS window display exclusion (`SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` on Windows, `FLAG_SECURE` on Android).
  - Users can now use TotumVault normally alongside recording tools (OBS Studio, Discord, Teams), while recording software captures an excluded blank window surface.
  - Added `get_screen_protection_status` IPC command providing honest, platform-aware protection capability reporting.
- **Mobile Long-Press & Context Menu Safety**:
  - Resolved false-positive privacy blackout triggered during mobile long-press/tap-and-hold (native text-selection magnifier or action mode) and desktop right-clicks.
  - Precision pointer event session tracking (`pointerType === 'touch'`) distinguishes internal interaction focus shifts from external window blurring.
- **Production Concurrency-Safe Clipboard Auto-Clear**:
  - Re-architected clipboard auto-clear with atomic operation mutex serialization (`op_mutex`) and monotonic generation reservation (`pending_generation`), eliminating race conditions between expiring timers and newer copies.
  - Integrated dedicated single-worker reader (`totum-clipboard-reader`) with bounded 1500ms timeout, preventing thread leaks or compositor lockups.
  - Ephemeral HMAC-SHA256 fingerprinting with `ZeroizeOnDrop` ensuring zero plaintext secret retention in memory.
  - Smart overwrite protection: clears the clipboard on timeout expiry or vault lock only if the content still matches the copied secret, preserving external clipboard data.
  - Bounded OS auxiliary cleaners with child process reaping and a 300ms watchdog deadline to eliminate zombie processes.
  - Configurable timeout settings (15s, 30s default, 60s, 120s, Never) and immediate purge on vault lock or screenshot detection.

### Security

- **Tauri Updater Signing Key Rotation**:
  - Generated and deployed a new high-entropy, passphrase-protected Minisign updater keypair.
  - Isolated private signing credentials strictly to protected GitHub Actions repository secrets.

## [1.3.1] — 2026-09-25

### Fixed

- **Automatic Startup Update Check**: Automatically checks GitHub releases upon launch and displays an interactive update banner and notification toast with a direct download button.
- **Android Biometric Unlock**: Resolved hardware detection bug on Android devices, enabled fingerprint authentication without false warnings, and persisted the biometric vault key in `localStorage` across app restarts.
- **True Empty Clipboard Purge**: Eliminated the plain-text space bug (`' '`) that created unwanted entries in clipboard history; now performs true empty buffer clearing (`""`) and native Win32 `EmptyClipboard()`.
- **Default Auto-Clear Timer**: Updated the default clipboard auto-clear timeout to **60s**.

## [1.3.0] — 2026-09-25

### Added

- **Privacy Screen Shield & Capture Defense**:
  - Application-level Privacy Screen Shield (`PrivacyShieldOverlay`) automatically obscuring the window with frosted glass (`blur(36px)`) when unfocused, minimized, or when switching applications.
  - Hardware capture blocking on supported platforms (`WDA_EXCLUDEFROMCAPTURE` on Windows, native compositor window isolation on Linux Wayland, and `FLAG_SECURE` on Android).
  - Proactive screenshot hotkey interception (`PrintScreen`, `Print`, `keyCode: 44`, `Win+Shift+S`, `Ctrl+Shift+S`, `Cmd+Shift+3/4/5`, and `Ctrl+P`) with an 8-second hold and immediate clipboard purge.
  - Context menu protection to block browser "Take Screenshot" commands.
  - `@media print` style protection blanking out sensitive vault contents upon print attempts.
  - Interactive "Test Screen Shield" preview button in Settings.
- **Multi-Tier Smart Clipboard Protection**:
  - OS-level clipboard purging via Tauri Rust backend (`wl-copy -c` & `wl-copy -c -p` on Linux Wayland, `xclip`/`xsel` on X11, `clip` on Windows, `pbcopy` on macOS).
  - Non-collapsed DOM range replacement (`' '`), eliminating browser zero-selection copy failures.
  - Sticky return-to-window gesture flushing (`clipboardPendingFlushRef`) to guarantee clipboard wiping upon refocus even if background tab execution was restricted.
  - Configurable clipboard timers (`5s` quick test, `15s`, `30s`, `60s`, `Never`).
  - Manual "Clear Clipboard Now" action in Settings.
  - Immediate clipboard purging when the vault locks or when a screen capture attempt is detected.
- **Secure Notes — Hide / Reveal Privacy Control**:
  - Eye / Eye-Off visibility button for private notes.
  - Note body is masked by default in protected view (`••••••••••••••••`) while keeping the title legible.
  - Auto-resets visibility state when an entry is closed or the vault locks.
- **Software License Dynamic Organization & Expiry Engine**:
  - Distinguishes calendar-date licenses (`YYYY-MM-DD`) from timestamp values.
  - Evaluates calendar dates using local time remaining active through 23:59:59.999 to prevent premature expiration due to UTC conversion.
  - Dynamic categorization into *Active*, *Expires Soon* (<30 days), *Expired*, and *Lifetime / No Expiry* sections.
  - Dedicated Copy Key button with eye-toggle masking.
- **Curated Typography Selection**:
  - Font picker with 5 developer-grade fonts: **Inter**, **Geist Sans**, **IBM Plex Sans**, **JetBrains Mono**, and **Fira Code**.
  - Cleaned up font preview labels to display crisp font names only.
- **Hierarchical Login Subfolders**:
  - Nested folder creation, renaming, and safe cascade deletion.
  - Move entries between folders.
  - Seamless search and filtering across all subfolders.
- **Horizontal Mouse Scroll & Pan**:
  - Mouse wheel horizontal scrolling translation on category chips and document thumbnail strips.
  - Smooth click-and-drag panning.
  - Left/right chevron navigation controls.
- **Document Favorites Count Isolation**:
  - Document favorites badge correctly isolates document items and hides when 0.
- **Android Class 3 Biometric Unlock**:
  - Native biometric authentication (`BIOMETRIC_STRONG`) with hardware Keystore binding and 3-attempt lockout.
- **Auto Update Checker**:
  - Background and manual update check against GitHub releases API with direct release links.

---

## [1.2.0] — 2026-09-24

### Added

- **Safe Import with Conflict Resolution**:
  - Interactive 4-step import wizard (`select`, `preview`, `confirm_replace`, `summary`).
  - Pre-inspection preview of encrypted `.tvault` backups, legacy `.vlock` backups, and unencrypted `.csv` spreadsheets before modifying local vault state.
  - Intelligent duplicate detection across all entry categories using normalized domain/URL matching, username/email matching, and category keys.
  - User-configurable duplicate resolution strategies: **Keep Existing** (skip duplicates), **Import Both** (import as new copies), or **Replace Existing** (update existing entries).
  - Clear user choice between non-destructive **"Add to Existing Vault"** (safe merge) and destructive **"Replace Existing Vault"**.
  - Explicit confirmation modal for vault replacement (*"This will permanently remove the existing vault entries after import. Continue?"*).
  - Dual-layer transaction safety: SQLite atomic transactions combined with physical snapshot backup and automatic rollback on failure (`vault.sqlite.import_backup`).
  - Complete post-import summary breakdown showing added, skipped, replaced, duplicates resolved, documents restored, and failed items.
- **Secure Document & Bill Vault ("Documents")**:
  - Encrypted SQLite document storage with `documents` and `document_pages` tables, cascading foreign keys, and indexes.
  - Multi-page document model for bills, receipts, IDs, passports, certificates, insurance cards, contracts, warranties, and invoices.
  - Live camera scanner with real-time viewfinder, front/back camera toggling, and fallback to system gallery/file picker (JPG, PNG, WEBP).
  - On-device local edge detection, interactive 4-corner perspective quad cropping, 90° rotation, and document text contrast enhancement.
  - High-resolution multi-page viewer modal with zoom, pan, bottom thumbnail carousel, page reordering, page deletion, decrypted JPEG export, and metadata editing.
  - Document library with responsive Grid and List views, category filtering chips, instant search, tag organization, and favorites.
  - Encrypted miniature thumbnails (~200px) for zero-latency browsing without pulling multi-megabyte images into memory.
  - Immediate zeroization and memory clearance of decrypted document images and thumbnails whenever the vault locks.
  - Full `.tvault` portable backup export and import compatibility with backward compatibility for legacy `.vlock` archives (`#[serde(default)]`).
- **Packaging & Documentation**:
  - Added Arch Linux (`.pkg.tar.zst`) package installation guide to documentation.
  - Cleaned up citation artifacts across project markdown files.

---

## [1.1.0] — 2026-09-04

### Added

- Seven specialized item editors: Login, Secure Note, Authenticator, Card, License, Server, and API Credential.
- Seven item-specific detail renderers.
- Reusable secret, copy, password, tagging, form-section, and form-shell UI primitives.
- Dark, Light, and System theme support with persisted preference.
- Stronger TOTP validation and configurable token generation.
- Shannon-entropy scoring and crack-time estimates for passwords.
- Encrypted `.vlock` backup export and restore improvements.
- Interactive tags and security-health filtering.
- Caps Lock detection and improved master-password error feedback.
- Activity keepalive to reduce unintended auto-locks while the user is active.
- Responsive mobile navigation, touch-friendly targets, and mobile drill-down flows.
- Fedora RPM and Android APK release packaging.
- Keyboard shortcut hints in the desktop interface.

### Fixed

- Replaced the monolithic generic entry editor with type-specific forms.
- Preserved compatibility with existing vaults and backups through additive deserialization.
- Fixed premature auto-lock while browsing entries.
- Fixed category filter state being lost during saves.
- Added CSV formula-injection sanitization.
- Improved export directory creation and path handling.
- Preserved tags when editing entries.
- Added required Tauri path capability for reliable directory resolution.
- Prevented invalid empty character pools in the password generator.
- Resolved TypeScript compilation errors in affected UI and crypto utilities.

---

## [1.0.0] — 2026-08-14

### Added

- Local-first vault architecture with Argon2id and AES-256-GCM.
- Tauri 2 desktop application.
- Encrypted SQLite persistence.
- Manual and automatic vault locking.
- Password and passphrase generation.
- Offline RFC 6238 TOTP generation.
- Timed clipboard clearing.
- Vault security health checks.
- Encrypted `.vlock` backups and CSV import/export.
- Custom fields, categories, favorites, and tags.
- Desktop keyboard shortcuts.
