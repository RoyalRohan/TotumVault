use rand::{rngs::OsRng, RngCore};
use zeroize::Zeroize;

use super::aes_gcm::{decrypt_bytes, encrypt_bytes, EncryptedPayload};
use super::argon2_kdf::DerivedKey;

pub const VEK_LEN: usize = 32; // 256-bit Vault Encryption Key

/// In-memory Vault Encryption Key with zeroize-on-drop
#[derive(Clone)]
pub struct VaultKey(pub [u8; VEK_LEN]);

impl Drop for VaultKey {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}

/// Generates a random 256-bit Vault Encryption Key (VEK)
pub fn generate_vault_key() -> VaultKey {
    let mut key = [0u8; VEK_LEN];
    OsRng.fill_bytes(&mut key);
    VaultKey(key)
}

/// Wraps (encrypts) the Vault Encryption Key (VEK) using the Argon2id Key Encryption Key (KEK)
pub fn wrap_vault_key(vek: &VaultKey, kek: &DerivedKey) -> Result<EncryptedPayload, String> {
    encrypt_bytes(&kek.0, &vek.0)
}

/// Unwraps (decrypts) the Vault Encryption Key (VEK) using the Argon2id Key Encryption Key (KEK)
pub fn unwrap_vault_key(
    kek: &DerivedKey,
    nonce_b64: &str,
    ciphertext_b64: &str,
) -> Result<VaultKey, String> {
    let mut decrypted = decrypt_bytes(&kek.0, nonce_b64, ciphertext_b64)?;
    if decrypted.len() != VEK_LEN {
        decrypted.zeroize();
        return Err("Invalid unwrapped key length".to_string());
    }

    let mut vek = [0u8; VEK_LEN];
    vek.copy_from_slice(&decrypted);
    decrypted.zeroize();
    Ok(VaultKey(vek))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::argon2_kdf::{derive_kek, generate_random_salt};

    #[test]
    fn test_key_wrapping_and_unwrapping() {
        let master_pass = "MyMasterPassWord#2026";
        let salt = generate_random_salt();
        let kek = derive_kek(master_pass, &salt).unwrap();

        let vek = generate_vault_key();
        let wrapped = wrap_vault_key(&vek, &kek).unwrap();

        let unwrapped_vek = unwrap_vault_key(&kek, &wrapped.nonce_b64, &wrapped.ciphertext_b64).unwrap();
        assert_eq!(vek.0, unwrapped_vek.0);
    }
}
