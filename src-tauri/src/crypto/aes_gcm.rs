use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::RngCore;
use zeroize::Zeroize;

pub const NONCE_LEN: usize = 12; // 96-bit nonce for AES-256-GCM

/// Container for encrypted ciphertext payload and nonce
#[derive(Debug, Clone)]
pub struct EncryptedPayload {
    pub nonce_b64: String,
    pub ciphertext_b64: String,
}

/// Encrypts plaintext bytes using AES-256-GCM with a 256-bit key and random 96-bit nonce
pub fn encrypt_bytes(key: &[u8; 32], plaintext: &[u8]) -> Result<EncryptedPayload, String> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| format!("Failed to create AES-256-GCM cipher: {}", e))?;

    let mut nonce_bytes = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|_| "Encryption failed".to_string())?;

    Ok(EncryptedPayload {
        nonce_b64: BASE64.encode(nonce_bytes),
        ciphertext_b64: BASE64.encode(ciphertext),
    })
}

/// Decrypts Base64-encoded ciphertext payload using AES-256-GCM
pub fn decrypt_bytes(
    key: &[u8; 32],
    nonce_b64: &str,
    ciphertext_b64: &str,
) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| format!("Failed to create AES-256-GCM cipher: {}", e))?;

    let nonce_bytes = BASE64
        .decode(nonce_b64)
        .map_err(|_| "Invalid Base64 nonce".to_string())?;

    if nonce_bytes.len() != NONCE_LEN {
        return Err("Invalid nonce length".to_string());
    }

    let ciphertext = BASE64
        .decode(ciphertext_b64)
        .map_err(|_| "Invalid Base64 ciphertext".to_string())?;

    let nonce = Nonce::from_slice(&nonce_bytes);

    let mut plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| "Decryption failed (Invalid key, password, or tampered ciphertext)".to_string())?;

    // Zeroize intermediate memory if needed
    let result = plaintext.clone();
    plaintext.zeroize();

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_aes_gcm_encrypt_decrypt_roundtrip() {
        let mut key = [0u8; 32];
        OsRng.fill_bytes(&mut key);

        let secret_data = b"My Super Secret Password 123! @#$%";
        let encrypted = encrypt_bytes(&key, secret_data).unwrap();

        let decrypted = decrypt_bytes(&key, &encrypted.nonce_b64, &encrypted.ciphertext_b64).unwrap();
        assert_eq!(decrypted, secret_data);
    }

    #[test]
    fn test_aes_gcm_tampered_ciphertext_fails() {
        let mut key = [0u8; 32];
        OsRng.fill_bytes(&mut key);

        let secret_data = b"Secret Payload";
        let mut encrypted = encrypt_bytes(&key, secret_data).unwrap();

        // Tamper with ciphertext Base64 string
        let mut raw_ciphertext = BASE64.decode(&encrypted.ciphertext_b64).unwrap();
        raw_ciphertext[0] ^= 0xFF; // Flip bits
        encrypted.ciphertext_b64 = BASE64.encode(raw_ciphertext);

        let result = decrypt_bytes(&key, &encrypted.nonce_b64, &encrypted.ciphertext_b64);
        assert!(result.is_err());
    }
}
