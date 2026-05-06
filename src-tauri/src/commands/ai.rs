use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use crate::utils::html::extract_prd_content;
use crate::commands::jira::{JiraConfigRust, shared_client, build_basic_auth};

type Client = reqwest::Client;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConfigRust {
    pub provider: String,
    pub api_key: String,
    pub model: String,
    pub base_url: Option<String>,
}

/// 根据 provider 类型返回默认 API URL
fn default_api_url(provider: &str) -> &str {
    match provider {
        "claude" => "https://api.anthropic.com/v1/messages",
        "openai" => "https://api.openai.com/v1/chat/completions",
        "deepseek" => "https://api.deepseek.com/v1/chat/completions",
        _ => "",
    }
}

fn api_url(config: &AiConfigRust) -> &str {
    config.base_url.as_deref().unwrap_or_else(|| default_api_url(&config.provider))
}

#[tauri::command]
pub async fn ai_chat_completion(
    config: AiConfigRust,
    system_prompt: String,
    user_message: String,
) -> Result<String, String> {
    let client = shared_client();
    let url = api_url(&config);

    match config.provider.as_str() {
        "claude" => call_claude(&client, &config, url, &system_prompt, &user_message).await,
        "openai" | "deepseek" => {
            call_openai_compatible(&client, &config, url, &system_prompt, &user_message).await
        }
        _ => Err(format!("不支持的 AI 服务: {}", config.provider)),
    }
}

async fn call_claude(
    client: &Client,
    config: &AiConfigRust,
    url: &str,
    system_prompt: &str,
    user_message: &str,
) -> Result<String, String> {
    let body = serde_json::json!({
        "model": config.model,
        "max_tokens": 8192,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_message}]
    });

    let resp = client
        .post(url)
        .header("x-api-key", &config.api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Claude API 请求失败: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Claude API 错误 ({}): {}", status, text));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Claude 响应解析失败: {}", e))?;

    data["content"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|item| item["text"].as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Claude 响应格式异常".to_string())
}

async fn call_openai_compatible(
    client: &Client,
    config: &AiConfigRust,
    url: &str,
    system_prompt: &str,
    user_message: &str,
) -> Result<String, String> {
    let body = serde_json::json!({
        "model": config.model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        "max_tokens": 8192
    });

    let resp = client
        .post(url)
        .header("Authorization", format!("Bearer {}", config.api_key))
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("AI API 请求失败: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("AI API 错误 ({}): {}", status, text));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("AI 响应解析失败: {}", e))?;

    data["choices"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|choice| choice["message"]["content"].as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "AI 响应格式异常".to_string())
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct StreamChunk {
    request_id: String,
    chunk: String,
    done: bool,
}

#[tauri::command]
pub async fn ai_stream_chat(
    app_handle: AppHandle,
    config: AiConfigRust,
    system_prompt: String,
    user_message: String,
    request_id: String,
) -> Result<(), String> {
    let client = shared_client();
    let url = api_url(&config);

    let result = match config.provider.as_str() {
        "claude" => {
            stream_claude(&client, &app_handle, &config, url, &system_prompt, &user_message, &request_id).await
        }
        "openai" | "deepseek" => {
            stream_openai_compatible(&client, &app_handle, &config, url, &system_prompt, &user_message, &request_id).await
        }
        _ => Err(format!("不支持的 AI 服务: {}", config.provider)),
    };

    if let Err(e) = result {
        let _ = app_handle.emit(
            "ai-stream",
            StreamChunk {
                request_id: request_id.to_string(),
                chunk: format!("__ERROR__:{e}"),
                done: true,
            },
        );
    }

    Ok(())
}

async fn stream_openai_compatible(
    client: &Client,
    app_handle: &AppHandle,
    config: &AiConfigRust,
    url: &str,
    system_prompt: &str,
    user_message: &str,
    request_id: &str,
) -> Result<(), String> {
    let body = serde_json::json!({
        "model": config.model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        "max_tokens": 8192,
        "stream": true
    });

    let resp = client
        .post(url)
        .header("Authorization", format!("Bearer {}", config.api_key))
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("AI API 请求失败: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("AI API 错误 ({}): {}", status, text));
    }

    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();
    let mut done_emitted = false;

    while let Some(chunk_result) = stream.next().await {
        if let Ok(bytes) = chunk_result {
            buffer.push_str(&String::from_utf8_lossy(&bytes));

            while let Some(pos) = buffer.find('\n') {
                let line = buffer[..pos].to_string();
                buffer = buffer[pos + 1..].to_string();

                let line = line.trim();
                if line.is_empty() || line.starts_with(':') {
                    continue;
                }

                if line == "data: [DONE]" {
                    emit_done(app_handle, request_id)?;
                    done_emitted = true;
                    return Ok(());
                }

                if let Some(data) = line.strip_prefix("data: ") {
                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                        if let Some(content) = parsed["choices"][0]["delta"]["content"].as_str() {
                            emit_chunk(app_handle, request_id, content)?;
                        }
                    }
                }
            }
        }
    }

    if !done_emitted {
        emit_done(app_handle, request_id)?;
    }

    Ok(())
}

async fn stream_claude(
    client: &Client,
    app_handle: &AppHandle,
    config: &AiConfigRust,
    url: &str,
    system_prompt: &str,
    user_message: &str,
    request_id: &str,
) -> Result<(), String> {
    let body = serde_json::json!({
        "model": config.model,
        "max_tokens": 8192,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_message}],
        "stream": true
    });

    let resp = client
        .post(url)
        .header("x-api-key", &config.api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Claude API 请求失败: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Claude API 错误 ({}): {}", status, text));
    }

    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();
    let mut current_event = String::new();
    let mut done_emitted = false;

    while let Some(chunk_result) = stream.next().await {
        if let Ok(bytes) = chunk_result {
            buffer.push_str(&String::from_utf8_lossy(&bytes));

            while let Some(pos) = buffer.find('\n') {
                let line = buffer[..pos].to_string();
                buffer = buffer[pos + 1..].to_string();

                let line = line.trim();

                if line.starts_with("event: ") {
                    current_event = line[7..].to_string();
                    continue;
                }

                if line.is_empty() {
                    current_event.clear();
                    continue;
                }

                if let Some(data) = line.strip_prefix("data: ") {
                    match current_event.as_str() {
                        "content_block_delta" => {
                            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                                if let Some(text) = parsed["delta"]["text"].as_str() {
                                    emit_chunk(app_handle, request_id, text)?;
                                }
                            }
                        }
                        "message_stop" => {
                            emit_done(app_handle, request_id)?;
                            done_emitted = true;
                            return Ok(());
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    if !done_emitted {
        emit_done(app_handle, request_id)?;
    }

    Ok(())
}

fn emit_chunk(app_handle: &AppHandle, request_id: &str, chunk: &str) -> Result<(), String> {
    app_handle
        .emit(
            "ai-stream",
            StreamChunk {
                request_id: request_id.to_string(),
                chunk: chunk.to_string(),
                done: false,
            },
        )
        .map_err(|e| format!("emit failed: {}", e))
}

fn emit_done(app_handle: &AppHandle, request_id: &str) -> Result<(), String> {
    app_handle
        .emit(
            "ai-stream",
            StreamChunk {
                request_id: request_id.to_string(),
                chunk: String::new(),
                done: true,
            },
        )
        .map_err(|e| format!("emit failed: {}", e))
}

#[tauri::command]
pub async fn fetch_url_content(url: String) -> Result<String, String> {
    let client = shared_client();
    let resp = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0")
        .send()
        .await
        .map_err(|e| format!("请求 URL 失败: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP 错误: {}", resp.status()));
    }

    let html = resp
        .text()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;

    Ok(extract_prd_content(&html))
}

/// 从 Confluence URL 提取页面 ID
fn extract_confluence_page_id(url: &str) -> Option<String> {
    // Confluence Cloud: https://domain.atlassian.net/wiki/spaces/XXX/pages/12345/Title
    // Confluence Server: https://confluence.company.com/pages/viewpage.action?pageId=12345

    // 1. Query 参数：?pageId=12345
    if let Some(query) = url.split('?').nth(1) {
        for pair in query.split('&') {
            if let Some(val) = pair.strip_prefix("pageId=") {
                let page_id = val.split('&').next().unwrap_or(val);
                if page_id.parse::<u64>().is_ok() {
                    return Some(page_id.to_string());
                }
            }
        }
    }

    // 2. 路径匹配：/pages/{pageId}/...
    let path = url.split('?').next().unwrap_or(url);
    let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();

    if let Some(pages_idx) = segments.iter().position(|s| *s == "pages") {
        if pages_idx + 1 < segments.len() {
            let candidate = segments[pages_idx + 1];
            if candidate.parse::<u64>().is_ok() {
                return Some(candidate.to_string());
            }
        }
    }

    None
}

#[tauri::command]
pub async fn fetch_confluence_content(
    url: String,
    config: JiraConfigRust,
) -> Result<String, String> {
    let client = shared_client();
    let auth = build_basic_auth(&config);

    // 尝试从 URL 提取 pageId
    if let Some(page_id) = extract_confluence_page_id(&url) {
        let api_url = format!(
            "{}/wiki/rest/api/content/{}?expand=body.storage",
            config.server_url.trim_end_matches('/'),
            page_id
        );

        let resp = client
            .get(&api_url)
            .header("Authorization", &auth)
            .header("Accept", "application/json")
            .timeout(std::time::Duration::from_secs(15))
            .send()
            .await
            .map_err(|e| format!("请求 Confluence API 失败: {}", e))?;

        if resp.status().is_success() {
            let data: serde_json::Value = resp
                .json()
                .await
                .map_err(|e| format!("解析 Confluence 响应失败: {}", e))?;

            if let Some(html) = data["body"]["storage"]["value"].as_str() {
                return Ok(extract_prd_content(html));
            } else {
                return Err("Confluence 响应中缺少页面内容".to_string());
            }
        } else {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("Confluence API 错误 ({}): {}", status, text));
        }
    }

    // 非 Confluence 格式 URL：回退到带认证的 HTML 抓取
    let resp = client
        .get(&url)
        .header("Authorization", &auth)
        .header("User-Agent", "Mozilla/5.0")
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("请求 URL 失败: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("HTTP 错误 ({}): {}", status, text));
    }

    let html = resp
        .text()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;

    Ok(extract_prd_content(&html))
}
