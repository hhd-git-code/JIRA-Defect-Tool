mod commands;
mod utils;

use commands::{adb, ai, crypto, jira};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .manage(adb::RunningProcesses::default())
        .invoke_handler(tauri::generate_handler![
            crypto::encrypt_token,
            crypto::decrypt_token,
            jira::jira_test_connection,
            jira::jira_create_issue,
            jira::jira_get_priorities,
            jira::jira_upload_attachments,
            jira::jira_create_issue_with_fields,
            jira::xray_authenticate,
            jira::xray_resolve_project_info,
            jira::xray_create_test_with_details,
            ai::ai_chat_completion,
            ai::ai_stream_chat,
            ai::fetch_url_content,
            ai::fetch_confluence_content,
            adb::adb_devices,
            adb::adb_connect,
            adb::adb_root,
            adb::adb_screenshot,
            adb::adb_start_recording,
            adb::adb_stop_recording,
            adb::adb_key_back,
            adb::adb_start_scrcpy,
            adb::adb_start_logcat,
            adb::adb_stop_logcat,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
