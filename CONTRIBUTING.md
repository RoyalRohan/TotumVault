# Contributing to TotumVault

Thank you for taking the time to improve TotumVault.

TotumVault is a security-sensitive application. A small change to a form, storage layer, IPC command, or clipboard path can have consequences beyond the visible UI. Please keep changes focused, test them thoroughly, and favor simple, reviewable code.

## Before you start

For larger changes, open an issue first so the approach can be discussed before implementation. For small fixes, documentation improvements, accessibility work, and straightforward maintenance, a pull request is usually enough.

Before working on cryptography or vault storage, read:

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [SECURITY.md](./SECURITY.md)
- [THREAT_MODEL.md](./THREAT_MODEL.md)

## Development standards

### Security first

Never log, print, persist, or expose plaintext passwords, master passwords, encryption keys, TOTP secrets, API secrets, or other sensitive vault values. Security-sensitive changes should include tests and a clear explanation of the security impact.

### Rust

Use `rustfmt` and keep Clippy warnings under control. Avoid unnecessary unsafe code and keep cryptographic operations inside the established Rust security boundary.

### TypeScript / React

Use strict types, small focused components, predictable state management, and semantic HTML. Avoid duplicating business logic between views.

### Data compatibility

TotumVault is intended to preserve existing vaults and backups. Changes to serialized entry data must be additive or include a migration strategy. New Rust fields should use sensible defaults when backward-compatible deserialization requires them. The architecture deliberately uses optional item fields and Serde defaults to protect existing data.

### Dependencies

Do not add a dependency without a reason. Avoid packages that add telemetry, unnecessary remote services, or unreviewed cryptographic primitives.

## Local setup

Prerequisites:

- Node.js 20+
- npm
- Rust and Cargo 1.75+
- Tauri platform dependencies

Install frontend dependencies:

```bash
npm install
```

Run the frontend:

```bash
npm run dev
```

Run the desktop app:

```bash
npm run tauri dev
```

## Checks before opening a pull request

Run the checks relevant to your change:

```bash
npx tsc --noEmit
npm run build
cd src-tauri && cargo test
```

For security-sensitive Rust changes, also run the project's normal formatting and lint checks.

## Pull requests

1. Create a focused feature branch.
2. Keep the change set small enough to review.
3. Explain what changed and why.
4. Include screenshots for meaningful UI changes.
5. Include tests or a clear manual verification path for functional changes.
6. Call out data-model, migration, IPC, or security implications explicitly.
7. Do not include real credentials, vault files, private keys, or user data in commits or pull requests.

## Security reports

Do not use a public issue for an unverified security vulnerability. Follow the private reporting process in [SECURITY.md](./SECURITY.md).

## Contributions and distribution

Pull requests are welcome, but the project license controls how source code and official releases may be distributed. Read [LICENSE](./LICENSE) before publishing forks, packages, installers, or other redistributions.
