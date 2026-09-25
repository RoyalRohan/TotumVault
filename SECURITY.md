# TotumVault Security Policy

TotumVault is a security-sensitive application. If you discover a vulnerability, please report it privately so it can be investigated before public disclosure.

## Reporting a vulnerability

Do not publish an unverified security vulnerability in a public GitHub issue.

Send a private report to:

**royalfga69@gmail.com**

Please include, when available:

1. A clear description of the issue and its impact.
2. Reproduction steps or a proof of concept.
3. The TotumVault version and affected platform.
4. Relevant logs or configuration details with all user secrets removed.
5. Whether the issue affects the vault, backup format, document encryption, authentication, IPC, or another boundary.

Never attach a real vault database, real `.tvault` / `.vlock` backup, private key, password, document image, or other sensitive user data to a report.

## Security design

TotumVault's design uses a Rust/Tauri security boundary, Argon2id key derivation, AES-256-GCM authenticated encryption, local SQLite persistence, TOTP validation/generation, local perspective document scanning, and memory zeroization for sensitive key material and decrypted image buffers.

The threat model and architecture documents describe the project's assumptions and boundaries in detail.

## What the application is designed to protect

The current implementation is designed to protect against, among other things:

- theft of the local encrypted vault database or an encrypted `.tvault` / `.vlock` backup without the master password;
- tampering with encrypted payloads or document image blobs, where authenticated AES-256-GCM decryption will fail;
- accidental deletion or overwriting during import through pre-inspection, conflict detection, explicit confirmation, and transactional snapshot rollback;
- storing the master password directly on disk;
- residual key material and decrypted image bytes after the vault is locked through systematic memory zeroization;
- accidental long-term clipboard exposure through multi-tier background OS wiping, non-collapsed range sanitization, and return-to-window gesture flushing;
- casual shoulder-surfing, app-switcher previews, and desktop screenshots through active frosted window shielding (`blur(36px)`), screenshot key interception, print blocking, and platform display affinity (`WDA_EXCLUDEFROMCAPTURE`, Wayland isolation, `FLAG_SECURE`).

## What TotumVault cannot guarantee

TotumVault cannot protect a user from a fully compromised operating system, kernel-level malware, hardware keyloggers, or physical attacks against an unlocked device. The project threat model explicitly treats these as environmental limits. While the Privacy Screen Shield proactively blocks shortcuts, app-switcher views, and external capture utilities that blur the window, kernel-level or elevated OS drivers can bypass display affinities on certain platforms.

No password or document manager should be presented as invulnerable. Security claims should be evaluated against the actual release, source code, platform, and threat model.

## Security-focused development

Security-sensitive changes should be reviewed carefully and tested. Do not introduce plaintext secret logging, unnecessary network communication, unsafe serialization, or unreviewed cryptographic dependencies. Contribution guidance is documented in [CONTRIBUTING.md](./CONTRIBUTING.md).

## Disclosure

When a confirmed vulnerability is resolved, the project may publish a release note describing the impact and the fix without exposing sensitive reproduction material.
