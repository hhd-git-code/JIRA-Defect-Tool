mod commands;

use commands::{crypto, jira};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            crypto::encrypt_token,
            crypto::decrypt_token,
            jira::jira_test_connection,
            jira::jira_create_issue,
            jira::jira_get_priorities,
            jira::jira_upload_attachments,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
