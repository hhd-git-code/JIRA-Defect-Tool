use aes_gcm::aead::generic_array::typenum::U12;
use aes_gcm::aead::generic_array::GenericArray;
use aes_gcm::{aead::Aead, Aes256Gcm, KeyInit};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use sha2::{Digest, Sha256};
use std::env;

// 密钥由 hostname + username 派生，每台机器不同
fn derive_key() -> [u8; 32] {
    let hostname = env::var("HOSTNAME")
        .or_else(|_| env::var("COMPUTERNAME"))
        .or_else(|_| {
            std::process::Command::new("hostname")
                .output()
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        })
        .unwrap_or_else(|_| "default-host".into());

    let username = env::var("USER")
        .or_else(|_| env::var("USERNAME"))
        .unwrap_or_else(|_| "default-user".into());

    let mut hasher = Sha256::new();
    hasher.update(format!("{}:{}", hostname, username));
    let result = hasher.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&result);
    key
}

fn get_nonce() -> GenericArray<u8, U12> {
    let key = derive_key();
    let nonce_bytes: [u8; 12] = key[..12].try_into().unwrap();
    *GenericArray::from_slice(&nonce_bytes)
}

#[tauri::command]
pub fn encrypt_token(plaintext: String) -> Result<String, String> {
    let key = derive_key();
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = get_nonce();
    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_bytes())
        .map_err(|e| e.to_string())?;
    Ok(BASE64.encode(ciphertext))
}

#[tauri::command]
pub fn decrypt_token(ciphertext: String) -> Result<String, String> {
    let key = derive_key();
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = get_nonce();
    let ciphertext_bytes = BASE64.decode(ciphertext).map_err(|e| e.to_string())?;
    let plaintext = cipher
        .decrypt(&nonce, ciphertext_bytes.as_ref())
        .map_err(|e| e.to_string())?;
    String::from_utf8(plaintext).map_err(|e| e.to_string())
}
