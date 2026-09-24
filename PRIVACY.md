# TotumVault Privacy

TotumVault is designed around local control: your vault and sensitive documents should remain exclusively on your device unless you deliberately export them.

## No account required

TotumVault does not require an account, subscription, phone number, email address, or registration for normal vault use.

## Local storage

All vault data—including passwords, credentials, notes, bills, and document photos—is stored strictly on the local device. Sensitive payloads are encrypted with AES-256-GCM in the local SQLite vault (`vault.sqlite`) or in encrypted `.tvault` (or legacy `.vlock`) backup files selected by the user. The application never sends vault data to any remote server or cloud service.

## On-device camera & document processing

The Document Scanner functions 100% on-device. Camera capture, edge detection, perspective warping, rotation, and thumbnail generation run entirely within local client memory. Photos, scanned documents, and bill receipts are encrypted before being written to disk and never leave your hardware.

## Telemetry and analytics

The project is designed without usage analytics, tracking scripts, crash-report uploads, or background telemetry. TotumVault contains zero advertising SDKs and zero telemetry pings.

## Network behavior

TotumVault does not require an internet connection to create, unlock, view, edit, search, or manage a vault. External-link actions (such as clicking an item's URL to open a browser) use the operating system's default browser handler.

Release downloads, GitHub repository pages, and external websites are outside the vault's local storage boundary.

## Backups

Backups are encrypted `.tvault` files (with legacy support for `.vlock`) intended to be kept under your direct custody. Keep backup files in a location that survives application removal and device changes (such as an external encrypted drive); do not treat an application's internal app data folder as the only backup location.

## Privacy boundaries

Local-first does not mean the host operating system is trusted unconditionally. Malware, keyloggers, compromised OS utilities, or unauthorized physical access to an unlocked device can still expose data. See [THREAT_MODEL.md](./THREAT_MODEL.md).

## Verification

Source availability allows independent review of the implementation and the claims made in this document. Security and privacy claims should be understood together with the implementation, release build, and threat model.
