# Changelog

All notable changes to TotumVault are documented here.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

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
