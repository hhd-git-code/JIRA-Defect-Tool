use aes_gcm::aead::generic_array::GenericArray;
use aes_gcm::aead::Aead;
use aes_gcm::{Aes256Gcm, KeyInit};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::RngCore;
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::sync::OnceLock;

const SALT_LEN: usize = 32;

fn salt_path() -> PathBuf {
    let mut dir = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push("jira-test-tool");
    let _ = std::fs::create_dir_all(&dir);
    dir.push("crypto.salt");
    dir
}

fn load_or_create_salt() -> [u8; SALT_LEN] {
    let path = salt_path();
    if let Ok(data) = std::fs::read(&path) {
        if data.len() == SALT_LEN {
            let mut salt = [0u8; SALT_LEN];
            salt.copy_from_slice(&data);
            return salt;
        }
    }
    let mut salt = [0u8; SALT_LEN];
    rand::thread_rng().fill_bytes(&mut salt);
    let _ = std::fs::write(&path, &salt);
    salt
}

fn derive_key() -> [u8; 32] {
    static KEY: OnceLock<[u8; 32]> = OnceLock::new();
    *KEY.get_or_init(|| {
        let salt = load_or_create_salt();
        let mut hasher = Sha256::new();
        hasher.update(&salt);
        let result = hasher.finalize();
        let mut key = [0u8; 32];
        key.copy_from_slice(&result);
        key
    })
}

/// 加密：随机 nonce(12字节) + ciphertext，Base64 编码
#[tauri::command]
pub fn encrypt_token(plaintext: String) -> Result<String, String> {
    let key = derive_key();
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;

    // 每次加密生成随机 nonce
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = GenericArray::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| e.to_string())?;

    // nonce(12) + ciphertext 拼接后 Base64
    let mut combined = Vec::with_capacity(12 + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);
    Ok(BASE64.encode(combined))
}

/// 解密：取出前 12 字节作为 nonce，余下作为 ciphertext
#[tauri::command]
pub fn decrypt_token(ciphertext: String) -> Result<String, String> {
    let key = derive_key();
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;

    let combined = BASE64.decode(ciphertext).map_err(|e| e.to_string())?;
    if combined.len() < 13 {
        return Err("密文格式错误：长度不足".to_string());
    }

    let (nonce_bytes, ciphertext_bytes) = combined.split_at(12);
    let nonce = GenericArray::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext_bytes)
        .map_err(|e| e.to_string())?;
    String::from_utf8(plaintext).map_err(|e| e.to_string())
}
