use reqwest::multipart;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JiraConfigRust {
    pub server_url: String,
    pub username: String,
    pub api_token: String,
    pub project_key: String,
    pub issue_type: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JiraCreateResponse {
    pub id: String,
    pub key: String,
}

fn build_basic_auth(config: &JiraConfigRust) -> String {
    let credentials = format!("{}:{}", config.username, config.api_token);
    format!("Basic {}", BASE64.encode(credentials.as_bytes()))
}

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};

#[tauri::command]
pub async fn jira_test_connection(config: JiraConfigRust) -> Result<bool, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/rest/api/2/myself", config.server_url.trim_end_matches('/'));

    let resp = client
        .get(&url)
        .header("Authorization", build_basic_auth(&config))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| format!("网络错误: {}", e))?;

    if resp.status().is_success() {
        Ok(true)
    } else {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        Err(format!("连接失败 ({}): {}", status, body))
    }
}

async fn resolve_priority_id(client: &reqwest::Client, config: &JiraConfigRust, priority: &str) -> Result<String, String> {
    let url = format!(
        "{}/rest/api/2/priority",
        config.server_url.trim_end_matches('/')
    );
    let resp = client
        .get(&url)
        .header("Authorization", build_basic_auth(config))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| format!("获取优先级列表网络错误: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("获取优先级列表失败 ({})", resp.status()));
    }

    let data: Vec<serde_json::Value> = resp
        .json()
        .await
        .map_err(|e| format!("解析优先级列表失败: {}", e))?;

    for v in &data {
        if let Some(name) = v["name"].as_str() {
            if name == priority {
                if let Some(id) = v["id"].as_str() {
                    return Ok(id.to_string());
                }
            }
        }
    }

    Err(format!("在 JIRA 优先级列表中未找到 '{}'", priority))
}

#[tauri::command]
pub async fn jira_create_issue(
    config: JiraConfigRust,
    summary: String,
    description: String,
    priority: String,
) -> Result<JiraCreateResponse, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "{}/rest/api/2/issue",
        config.server_url.trim_end_matches('/')
    );

    let mut fields = serde_json::json!({
        "project": { "key": config.project_key },
        "summary": summary,
        "description": description,
        "issuetype": { "name": config.issue_type }
    });

    if !priority.is_empty() {
        let priority_id = if priority.parse::<u64>().is_ok() {
            priority.clone()
        } else {
            resolve_priority_id(&client, &config, &priority).await?
        };
        fields.as_object_mut().unwrap().insert(
            "priority".to_string(),
            serde_json::json!({ "id": priority_id }),
        );
    }

    let body = serde_json::json!({ "fields": fields });

    let resp = client
        .post(&url)
        .header("Authorization", build_basic_auth(&config))
        .header("Content-Type", "application/json")
        .timeout(std::time::Duration::from_secs(10))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("网络错误: {}", e))?;

    if resp.status().is_success() {
        let data: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))?;
        Ok(JiraCreateResponse {
            id: data["id"].as_str().unwrap_or_default().to_string(),
            key: data["key"].as_str().unwrap_or_default().to_string(),
        })
    } else {
        let status = resp.status();
        let err_body: serde_json::Value = resp.json().await.unwrap_or_default();
        let messages = err_body["errorMessages"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .collect::<Vec<_>>()
                    .join("; ")
            })
            .unwrap_or_default();
        let errors = err_body["errors"]
            .as_object()
            .map(|obj| {
                obj.values()
                    .filter_map(|v| v.as_str())
                    .collect::<Vec<_>>()
                    .join("; ")
            })
            .unwrap_or_default();
        Err(format!("创建失败 ({}): {} {}", status, messages, errors).trim().to_string())
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JiraPriority {
    pub id: String,
    pub name: String,
}

#[tauri::command]
pub async fn jira_get_priorities(config: JiraConfigRust) -> Result<Vec<JiraPriority>, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "{}/rest/api/2/priority",
        config.server_url.trim_end_matches('/')
    );

    let resp = client
        .get(&url)
        .header("Authorization", build_basic_auth(&config))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| format!("网络错误: {}", e))?;

    if resp.status().is_success() {
        let data: Vec<serde_json::Value> = resp
            .json()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))?;
        let priorities = data
            .iter()
            .filter_map(|v| {
                let id = v["id"].as_str()?.to_string();
                let name = v["name"].as_str()?.to_string();
                Some(JiraPriority { id, name })
            })
            .collect();
        Ok(priorities)
    } else {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        Err(format!("获取优先级失败 ({}): {}", status, body))
    }
}

#[tauri::command]
pub async fn jira_upload_attachments(
    config: JiraConfigRust,
    issue_key: String,
    file_paths: Vec<String>,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let url = format!(
        "{}/rest/api/2/issue/{}/attachments",
        config.server_url.trim_end_matches('/'),
        issue_key
    );

    // JIRA 支持单次请求上传多个文件
    let mut form = multipart::Form::new();
    for path in &file_paths {
        let file = std::fs::read(path).map_err(|e| format!("读取文件失败 {}: {}", path, e))?;
        let file_name = std::path::Path::new(path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "attachment".into());
        let part = multipart::Part::bytes(file)
            .file_name(file_name)
            .mime_str("application/octet-stream")
            .map_err(|e| e.to_string())?;
        form = form.part("file", part);
    }

    let resp = client
        .post(&url)
        .header("Authorization", build_basic_auth(&config))
        .header("X-Atlassian-Token", "no-check")
        .multipart(form)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("上传附件网络错误: {}", e))?;

    if resp.status().is_success() {
        Ok(())
    } else {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        Err(format!("上传附件失败 ({}): {}", status, body))
    }
}
