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

## 9. Native Window Capture Protection & Privacy Shield

TotumVault protects against unauthorized screen recording, window mirroring, OS task-switcher previews, and shoulder-surfing while maintaining a clean, uncompromised desktop workflow:

- **Native OS Window Capture Exclusion**:
  - **Windows**: Win32 `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)` is applied to the application window. Recording software (OBS Studio, Discord, Teams, Game Bar) captures a black/blank surface for TotumVault, while the user enjoys a crystal-clear, unblocked desktop experience without disruptive blackout overlays during normal multitasking.
  - **Android**: Window-level `FLAG_SECURE` blocks screenshots, screen recording, and system app-switcher thumbnails.
  - **macOS & Linux**: Native window protection status is classified and reported honestly through the `get_screen_protection_status` IPC command, distinguishing true hardware exclusion from compositor-level isolation.
- **Application Privacy Shield Overlay**:
  - An application-level frosted glass overlay (`PrivacyShieldOverlay`) obscures the window with `blur(36px)` when the application experiences genuine external focus loss or intercepts screenshot shortcuts (`PrintScreen`, `Win+Shift+S`, `Ctrl+Shift+S`, `Cmd+Shift+3/4/5`).
  - **Touch & Long-Press Safety**: Precision pointer tracking (`pointerType === 'touch'`, touch session timestamps, right-click timestamps) distinguishes touch sessions, native text-selection magnifiers, and contextual menus from genuine focus loss, completely preventing accidental blackout during mobile long-press or desktop right-click operations.
  - **Print Protection**: `@media print` CSS rules completely purge and blank the DOM if printing is attempted.

## 10. Production Clipboard Auto-Clear Architecture

TotumVault implements a production-grade, concurrency-safe clipboard management pipeline designed to eliminate secret leakage while preventing data loss:

- **Primary Cross-Platform Engine**:
  - Official Tauri 2 `@tauri-apps/plugin-clipboard-manager` (`tauri_plugin_clipboard_manager`) performs all primary clipboard reads, writes, and clears natively across Windows, Linux, macOS, and Android.
- **Race-Free Operation Serialization**:
  - An atomic `op_mutex` serializes all clipboard write and clear operations.
  - **Pre-Write Reservation & Invalidation**: When a new secret is copied, `copy_and_track` reserves the next monotonic generation, marks `pending_generation`, and invalidates prior sessions *before* writing to the OS clipboard. This guarantees that an expiring background timer for an earlier secret can never erase a newly copied secret.
- **Dedicated Single-Worker Reader**:
  - A dedicated native OS thread (`"totum-clipboard-reader"`) processes all verification reads through a bounded `sync_channel(1)` with a strict 1500ms timeout.
  - If a compositor blocks background reads, the request times out safely without spawning new threads, completely eliminating unbounded thread accumulation.
- **Zero Plaintext Secret Storage**:
  - The native `ClipboardSession` stores **zero plaintext secrets**.
  - Secrets are fingerprinted using HMAC-SHA256 with an ephemeral 32-byte cryptographic key generated via `rand::rngs::OsRng`.
  - Cryptographic keys and fingerprints implement `ZeroizeOnDrop`, purging sensitive material from memory upon session invalidation.
- **Non-Destructive Matching**:
  - Before clearing on timeout or vault lock, TotumVault reads the current clipboard and verifies HMAC equality in constant time (`constant_time_eq`).
  - If the user or another application copied something else in the interim, the external content is preserved untouched.
- **Vault Lock & Threat Integration**:
  - Locking the vault automatically invokes `clear_on_lock` (clearing matching secrets).
  - Screenshot shortcut detection or manual "Clear Clipboard Now" triggers immediate unconditional force-clearing.
- **Bounded OS Auxiliary Cleaners**:
  - Windows: Bounded Win32 `OpenClipboard`/`EmptyClipboard` retry with exponential backoff (max ~310ms).
  - Linux & macOS: Best-effort `wl-copy`/`xclip`/`pbcopy` executions with a 300ms watchdog timer and process reaping to prevent zombie accumulation.
  - Android: Desktop shell execution is strictly guarded and prohibited.

## 11. VS Code-Style Hierarchical Login Tree

The "Logins" category features a specialized, VS Code Explorer-style drag-and-drop hierarchical tree system:

- **Visual Tree Hierarchy**: Supports nested subfolders with recursive child resolution, expand/collapse state persistence, and folder-level count indicators.
- **Drag-and-Drop Operations**:
  - Drag login entries into nested folders or to the root unfiled area.
  - Drag folders into other folders to restructure the hierarchy.
  - Visual drop indicators display before, inside, and after drop targets with subtle highlight outlines.
- **Strict Scope Isolation**: The drag-and-drop tree is strictly scoped to the Logins category, ensuring zero regressions in Documents, Cards, Notes, Licenses, Servers, or Authenticator categories.
- **Unified Instant Search**: Searching from the filter bar seamlessly matches logins across all folder levels without losing folder relationship context.

## 12. Development principles

When modifying the codebase:

- Preserve existing encrypted data and database backward compatibility.
- Never move cryptographic secrets or unencrypted private keys into persistent storage.
- Prefer additive serialization changes.
- Avoid logging passwords, keys, or image bytes.
- Zeroize sensitive buffers on lock.
- Test backup and restore operations with each data model update.
