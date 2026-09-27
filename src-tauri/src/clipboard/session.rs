use hmac::{Hmac, Mac};
use rand::RngCore;
use sha2::Sha256;
use zeroize::{Zeroize, ZeroizeOnDrop};

type HmacSha256 = Hmac<Sha256>;

/// Short-lived cryptographic equality tracking session for clipboard secrets.
///
/// NOTE: Memory zeroization cannot guarantee removal from every JavaScript/V8
/// runtime copy or OS display compositor buffer, but ensures native tracking
/// keys and comparison fingerprints are purged immediately upon session conclusion.
#[derive(ZeroizeOnDrop)]
pub struct ClipboardSession {
    #[zeroize(skip)]
    pub generation: u64,
    #[zeroize(skip)]
    pub expires_at: std::time::Instant,
    #[zeroize(skip)]
    pub timeout_secs: u64,
    #[zeroize(skip)]
    pub expected_length: usize,
    pub expected_fingerprint: [u8; 32],
    pub hmac_key: [u8; 32],
    #[zeroize(skip)]
    pub active: bool,
}

impl ClipboardSession {
    /// Creates a new verification session.
    /// A fresh 32-byte cryptographic random key is generated using OsRng.
    /// The secret's HMAC-SHA256 fingerprint is calculated and stored.
    /// The raw secret string is NEVER retained in this struct.
    pub fn new(generation: u64, text: &str, timeout_secs: u64) -> Self {
        let mut hmac_key = [0u8; 32];
        rand::rngs::OsRng.fill_bytes(&mut hmac_key);

        let expected_fingerprint = compute_fingerprint(&hmac_key, text);
        let expected_length = text.len();

        let expires_at = if timeout_secs > 0 {
            std::time::Instant::now() + std::time::Duration::from_secs(timeout_secs)
        } else {
            std::time::Instant::now()
        };

        Self {
            generation,
            expires_at,
            timeout_secs,
            expected_length,
            expected_fingerprint,
            hmac_key,
            active: true,
        }
    }

    /// Verifies whether candidate text matches the fingerprinted secret.
    /// 1. Checks that session is active.
    /// 2. Checks exact character/byte length match.
    /// 3. Computes candidate HMAC-SHA256 and compares in constant time.
    pub fn verify(&self, candidate: &str) -> bool {
        if !self.active {
            return false;
        }

        if candidate.len() != self.expected_length {
            return false;
        }

        let candidate_fingerprint = compute_fingerprint(&self.hmac_key, candidate);
        constant_time_eq(&candidate_fingerprint, &self.expected_fingerprint)
    }

    /// Invalidates the session and immediately zeroizes sensitive cryptographic material.
    pub fn invalidate(&mut self) {
        self.active = false;
        self.hmac_key.zeroize();
        self.expected_fingerprint.zeroize();
    }
}

/// Computes HMAC-SHA256 over input text using the provided 32-byte key.
pub fn compute_fingerprint(key: &[u8; 32], text: &str) -> [u8; 32] {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC-SHA256 accepts 32-byte keys");
    mac.update(text.as_bytes());
    let result = mac.finalize();
    let bytes = result.into_bytes();
    let mut out = [0u8; 32];
    out.copy_from_slice(&bytes);
    out
}

/// Constant-time byte array equality comparison to prevent timing side-channels.
pub fn constant_time_eq(a: &[u8; 32], b: &[u8; 32]) -> bool {
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_matching() {
        let secret = "CorrectHorseBatteryStaple!2026";
        let session = ClipboardSession::new(1, secret, 30);
        assert!(session.active);
        assert_eq!(session.expected_length, secret.len());

        // Exact match succeeds
        assert!(session.verify(secret));

        // Different secret fails
        assert!(!session.verify("WrongSecretValue"));

        // Similar but different length fails
        assert!(!session.verify("CorrectHorseBatteryStaple!202"));

        // Similar same length fails
        assert!(!session.verify("CorrectHorseBatteryStaple!2027"));
    }

    #[test]
    fn test_session_invalidation() {
        let secret = "TemporaryPassword#999";
        let mut session = ClipboardSession::new(2, secret, 15);
        assert!(session.verify(secret));

        session.invalidate();
        assert!(!session.active);

        // Once invalidated, verify always returns false even with the identical string
        assert!(!session.verify(secret));

        // Keys should be zeroized
        assert_eq!(session.hmac_key, [0u8; 32]);
        assert_eq!(session.expected_fingerprint, [0u8; 32]);
    }

    #[test]
    fn test_constant_time_eq() {
        let a = [42u8; 32];
        let b = [42u8; 32];
        let mut c = [42u8; 32];
        c[31] = 43;

        assert!(constant_time_eq(&a, &b));
        assert!(!constant_time_eq(&a, &c));
    }
}
