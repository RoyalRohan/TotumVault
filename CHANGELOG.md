# Changelog

All notable changes to TotumVault are documented here.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

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
