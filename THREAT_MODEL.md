# TotumVault Threat Model

> **Security philosophy:** local-first, zero-trust boundaries, explicit user control.

This document describes the threats the application is designed to address and the environmental threats it cannot reasonably eliminate.

## 1. Trust boundaries

```text
┌──────────────────────────────────────────────────────────────┐
│                         TRUSTED CORE                         │
│  React / TypeScript  ── Tauri IPC ──  Rust security core   │
│                                      │                       │
│                         Crypto / Vault / SQLite / Docs       │
└──────────────────────────────────────┼───────────────────────┘
                                       │ encrypted data & blobs
┌──────────────────────────────────────▼───────────────────────┐
│                    LOCAL FILE SYSTEM / OS                    │
│        vault.sqlite · encrypted .tvault / .vlock files       │
└──────────────────────────────────────────────────────────────┘
```

The documented architecture places React/TypeScript on one side of the IPC boundary and the Rust security/storage core on the other.

## 2. In-scope threats

### T1 — Theft of an encrypted vault file or backup

**Threat:** An attacker obtains `vault.sqlite` or a `.tvault` (or legacy `.vlock`) backup file containing sensitive credentials or document images.

**Mitigation:** Sensitive entry payloads and document page image blobs are protected with AES-256-GCM with unique random nonces. The vault encryption key is wrapped by a key derived via Argon2id.

### T2 — Database tampering

**Threat:** An attacker modifies encrypted database content or swaps ciphertext bytes.

**Mitigation:** AES-GCM 128-bit authentication tags cause modified ciphertext or tampered tags to fail verification immediately rather than silently producing corrupt or attacker-controlled plaintext.

### T3 — Accidental vault overwrite during import

**Threat:** An imported backup file or CSV replaces existing vault items without the user realizing existing entries will be lost.

**Mitigation:** The Safe Import flow analyzes import content beforehand, surfaces duplicate conflicts, defaults to a non-destructive merge ("Add to Existing Vault"), requires explicit modal confirmation for replacement, and uses a dual-layer snapshot rollback file (`vault.sqlite.import_backup`) to prevent database corruption.

### T4 — Master-password disclosure through storage

**Threat:** The master password is recovered from files, configuration, or logs.

**Mitigation:** The design never persists the master password to the vault database, configuration files, or local storage.

### T5 — Residual key material or decrypted images in memory

**Threat:** Sensitive key material or decrypted document photos remain available in process memory after locking.

**Mitigation:** Rust key buffers use `zeroize`. In the frontend, all decrypted document image URLs and page data are immediately cleared from state whenever the vault locks.

### T6 — Clipboard leakage

**Threat:** A copied secret remains in the OS clipboard indefinitely.

**Mitigation:** TotumVault uses a timed clipboard-clearing countdown (configurable, 30s default) that wipes the system clipboard automatically.

## 3. Out-of-scope environmental threats

### U1 — Compromised operating system

A keylogger, screen scraper, malicious browser extension, kernel-level malware, or process running with sufficient privileges can observe secrets while the vault is unlocked. TotumVault does not claim to defeat a fully compromised host OS.

### U2 — Cold-boot or direct RAM extraction

Decrypted credentials and document images necessarily exist in memory while the user is actively viewing them. Automatic locking reduces exposure but cannot eliminate physical-memory hardware attacks.

### U3 — Physical storage remanence

Deleting a database record does not guarantee physical sanitization of underlying SSD or flash cells. Storage controllers and OS file systems determine how blocks are reclaimed.

## 4. Cryptographic summary

| Function | Primitive | Parameters |
|---|---|---|
| Key derivation | Argon2id | 64 MB memory, time cost 3, parallelism 4, 16-byte random salt |
| Vault encryption | AES-256-GCM | 256-bit key, 96-bit random nonce per operation, 128-bit auth tag |
| Document encryption | AES-256-GCM | Encrypted binary image blobs and thumbnails with independent nonces |
| Randomness | OS CSPRNG | `rand::rngs::OsRng` |
| TOTP | HMAC-SHA1 / HMAC-SHA256 | RFC 6238, Base32 validation, 6/8 digits, 30/60s period |
| Memory sanitization | `zeroize` / State purge | Key buffers zeroized on lock; decrypted image buffers purged |
