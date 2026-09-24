use argon2::{
    password_hash::SaltString,
    Argon2, Params,
};
use rand::rngs::OsRng;
use zeroize::Zeroize;

pub const ARGON2_MEMORY_KB: u32 = 65536; // 64 MB
pub const ARGON2_TIME_COST: u32 = 3;     // 3 iterations
pub const ARGON2_PARALLELISM: u32 = 4;   // 4 parallel threads
pub const KEK_LEN: usize = 32;          // 256-bit Key Encryption Key

/// Derived Key wrapper that auto-zeroizes memory on drop
pub struct DerivedKey(pub [u8; KEK_LEN]);

impl Drop for DerivedKey {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}

/// Generates a cryptographically random 16-byte Argon2id salt encoded as Base64 String
pub fn generate_random_salt() -> String {
    let salt = SaltString::generate(&mut OsRng);
    salt.to_string()
}

/// Derives a 256-bit Key Encryption Key (KEK) from the master password and salt using Argon2id
pub fn derive_kek(master_password: &str, salt_str: &str) -> Result<DerivedKey, String> {
    let params = Params::new(ARGON2_MEMORY_KB, ARGON2_TIME_COST, ARGON2_PARALLELISM, Some(KEK_LEN))
        .map_err(|e| format!("Invalid Argon2id parameters: {}", e))?;

    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params);

    let salt = SaltString::from_b64(salt_str)
        .or_else(|_| SaltString::encode_b64(salt_str.as_bytes()))
        .map_err(|e| format!("Invalid salt format: {}", e))?;

    let mut key_buf = [0u8; KEK_LEN];
    argon2
        .hash_password_into(master_password.as_bytes(), salt.as_str().as_bytes(), &mut key_buf)
        .map_err(|e| format!("Argon2id derivation failed: {}", e))?;

    Ok(DerivedKey(key_buf))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_argon2id_derivation_deterministic() {
        let salt = generate_random_salt();
        let key1 = derive_kek("SuperSecretPass123!", &salt).unwrap();
        let key2 = derive_kek("SuperSecretPass123!", &salt).unwrap();
        assert_eq!(key1.0, key2.0);

        let key3 = derive_kek("WrongPassword!", &salt).unwrap();
        assert_ne!(key1.0, key3.0);
    }
}
