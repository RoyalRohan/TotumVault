# TotumVault Architecture

This document describes the main boundaries, cryptographic foundations, and data flows of TotumVault. It is intentionally implementation-oriented so contributors can understand where UI, IPC, storage, and cryptography meet.

## 1. System overview

```text
┌──────────────────────────────────────────────────────────────┐
│                    React / TypeScript UI                    │
│                                                              │
│  Lock Screen · Vault · Theme Context                         │
│  7 Item Editors · Detail Views · Generator · Health          │
│  Document Scanner (Camera/Upload/Crop) · Document Viewer     │
│  Safe Import Wizard (Preview · Conflict Resolution)          │
└────────────────────────────┬─────────────────────────────────┘
                             │ Tauri IPC
┌────────────────────────────▼─────────────────────────────────┐
│                       Rust / Tauri                           │
│                                                              │
│  Vault session · Crypto · SQLite · Clipboard · TOTP          │
│  Document Manager · Safe Importer · Backup / restore         │
└────────────────────────────┬─────────────────────────────────┘
                             │ encrypted payloads & blobs
┌────────────────────────────▼─────────────────────────────────┐
│                    Local persistence                          │
│  vault.sqlite (entries, documents, pages)                    │
│  encrypted .tvault / .vlock backups · snapshot rollback files │
└──────────────────────────────────────────────────────────────┘
```

The renderer contains the lock/setup flow, theme engine, seven specialized credential editors, dedicated detail renderers, password generator, security-health views, Document Scanner with interactive perspective cropping, Document Viewer with multi-page carousel, and Safe Import 4-step wizard.

## 2. Item & Document model

TotumVault uses an additive data model to ensure backward and forward compatibility:

1. **Vault Entries (`entries` table)**:
   - Stores logins, TOTP, cards, licenses, servers, API credentials, and secure notes.
   - Sensitive fields are serialized to JSON and encrypted as an authenticated AES-256-GCM ciphertext payload.
   - Unencrypted columns are limited to record ID, category, favorite flag, and timestamps for efficient indexing.

2. **Documents & Pages (`documents` and `document_pages` tables)**:
   - Logical documents represent multi-page records (bills, receipts, IDs, certificates, insurance, contracts, warranties, invoices, other).
   - `documents` stores metadata: title, doc_type, description, tags (JSON array), document_date, expiry_date, and favorite flag.
   - `document_pages` stores individual pages belonging to a document: page number, MIME type, dimensions (width/height), file size, AES-256-GCM encrypted image binary blob, and an optional encrypted miniature thumbnail (~200px JPEG) for instant list/grid rendering.
   - Cascading foreign keys (`ON DELETE CASCADE`) guarantee that deleting a document automatically wipes all associated encrypted pages and thumbnails.

## 3. Storage

The application stores all data locally in SQLite (`vault.sqlite`).

- **Entries**: Encrypted JSON payloads stored as text ciphertext with random 96-bit nonces.
- **Document Pages**: Encrypted binary image blobs and thumbnail blobs stored with independent random 96-bit nonces.
- **Indexes**: Added on `entries(category)`, `documents(favorite)`, `documents(created_at)`, and `document_pages(document_id, page_number)`.
- **Portable Backups (`.tvault`)**: A portable archive encrypted with the user's master password containing both credential entries and full multi-page document payloads with backward compatibility (`#[serde(default)]`), along with support for importing legacy `.vlock` archives.

## 4. Key hierarchy

```text
Master password + random salt (16 bytes)
           │
           ▼
        Argon2id (64 MB, time 3, parallelism 4)
           │
           ▼
  Key Encryption Key (KEK)
           │
           ▼
    unwrap random VEK (32 bytes)
           │
           ▼
  Vault Encryption Key (VEK)
           │
           ├─── AES-256-GCM ───► encrypted credential entries
           │
           └─── AES-256-GCM ───► encrypted document pages & thumbnails
```

Parameters:
- **Argon2id**: 64 MB memory, time cost 3, parallelism 4, 16-byte random salt.
- **AES-256-GCM**: 256-bit key, 96-bit unique random nonce per operation, 128-bit authentication tag.

## 5. Runtime security boundary

The React renderer communicates with the Rust core through Tauri IPC. Rust owns vault state, key material, SQLite operations, TOTP generation, clipboard protection, document encryption, and backup operations.

- The active Vault Encryption Key (VEK) is kept in memory only while the vault is unlocked and is zeroized during lock or application shutdown.
- Decrypted document images and thumbnails in the frontend state are immediately zeroized and purged when the vault locks.

## 6. Safe Import & Conflict Resolution

Importing credentials or backups uses a transactional 4-step workflow:

1. **Inspection**: Pre-parses `.tvault`, legacy `.vlock`, or `.csv` files completely in memory before touching the database.
2. **Duplicate Detection**: Identifies matching entries using normalized domain comparison, username/email matching, and category keys.
3. **Resolution Strategies**:
   - `keep_existing`: Skip importing matching duplicates (preserves current vault data).
   - `import_both`: Imports duplicates as new distinct copies.
   - `replace_existing`: Overwrites matching existing entries with imported data.
4. **User Choice**:
   - `add`: Non-destructive merge combining imported data with the existing vault.
   - `replace`: Destructive overwrite guarded by an explicit user confirmation modal.
5. **Dual-Layer Transaction Safety**:
   - The operation runs inside an SQLite transaction.
   - Prior to execution, a physical database snapshot (`vault.sqlite.import_backup`) is created on disk. If any step fails, the database is restored from the snapshot and the temporary backup is removed.

## 7. Document Scanner & Perspective Warping

Document scanning operates 100% on-device without cloud APIs or external telemetry:

- **Camera Capture**: Live video stream via `navigator.mediaDevices.getUserMedia` with viewfinder guidelines and camera flipping (front/back).
- **Edge Detection**: Local contrast and luminance gradient scanning on an offscreen HTML5 canvas to identify document corners.
- **Perspective Quad Crop**: Interactive 4-corner draggable handles (`tl`, `tr`, `br`, `bl`) allowing user adjustment, 90° rotation, and contrast stretching for document text readability.
- **Thumbnail Optimization**: Generates a low-resolution thumbnail (~200px JPEG) alongside the full-resolution page for rapid encrypted grid/list browsing.

## 8. Theme system

The theme system is implemented through `ThemeContext` and CSS variables. The supported modes are:

- Dark
- Light
- System (synchronizes with OS `prefers-color-scheme`)

The preference is stored in `localStorage` and applied through a root `data-theme` attribute.

## 9. Privacy Screen Protection & Display Affinity

TotumVault protects against window mirroring, OS task-switcher capture, shoulder-surfing, and screenshot recording:

- **OS Display Affinity**: Where supported, native window display flags (`SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` on Windows, native compositor window isolation on Linux Wayland, and `FLAG_SECURE` on Android) prevent external processes and screen recorders from capturing the window.
- **Application Privacy Shield**: A full-screen frosted glass overlay (`PrivacyShieldOverlay`) automatically activates whenever the window blurs (loses focus), the tab is hidden, or screenshot shortcuts are detected (`PrintScreen`, `Win+Shift+S`, `Ctrl+Shift+S`, `Cmd+Shift+3/4/5`, and `Ctrl+P`).
- **Deep Viewport Blur & Print Protection**: The underlying `#root` DOM element receives `filter: blur(36px) grayscale(80%) brightness(0.2); opacity: 0.1` and pointer/selection cancellation while shielded. `@media print` rules completely replace the DOM with an anti-printing notice.

## 10. Multi-Tier Clipboard Sanitization

Clipboard auto-clear prevents sensitive credentials from lingering in memory or in third-party clipboard managers:

- **Tauri Native OS Command**: Rust backend commands execute platform-level wipes (`wl-copy -c` and `wl-copy -c -p` on Linux Wayland, `xclip`/`xsel` on X11, `cmd /c clip` on Windows, `pbcopy` on macOS).
- **Non-Collapsed DOM Overwrite**: Fallback sanitization in the DOM uses a non-collapsed selection range (`' '`) so that `document.execCommand('copy')` reliably overwrites previous clipboard contents.
- **Sticky Gesture-Flushing**: When browser sandbox restrictions prevent background unfocused tabs from clearing the clipboard, a pending flush flag is preserved and executes on the very first user interaction (`pointerdown`, `mousedown`, `keydown`, `focus`).
- **Immediate Purge**: The clipboard is automatically purged when the vault locks, when a screenshot attempt is intercepted, or via the manual "Clear Clipboard Now" action.

## 11. Development principles

When modifying the codebase:

- Preserve existing encrypted data and database backward compatibility.
- Never move cryptographic secrets or unencrypted private keys into persistent storage.
- Prefer additive serialization changes.
- Avoid logging passwords, keys, or image bytes.
- Zeroize sensitive buffers on lock.
- Test backup and restore operations with each data model update.
