use reqwest::multipart;
use serde::{Deserialize, Serialize};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};

/// 共享 HTTP 客户端，复用连接池和 TLS 会话
pub fn shared_client() -> reqwest::Client {
    // reqwest::Client 内部使用 Arc<Connector>，多次调用 new() 共享同一连接池
    // 但显式创建单例可保证所有请求使用同一个 Client 实例
    use std::sync::OnceLock;
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| reqwest::Client::new()).clone()
}

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

pub fn build_basic_auth(config: &JiraConfigRust) -> String {
    let credentials = format!("{}:{}", config.username, config.api_token);
    format!("Basic {}", BASE64.encode(credentials.as_bytes()))
}

async fn post_create_issue(
    client: reqwest::Client,
    config: &JiraConfigRust,
    body: &serde_json::Value,
) -> Result<JiraCreateResponse, String> {
    let url = format!(
        "{}/rest/api/2/issue",
        config.server_url.trim_end_matches('/')
    );

    let resp = client
        .post(&url)
        .header("Authorization", build_basic_auth(config))
        .header("Content-Type", "application/json")
        .timeout(std::time::Duration::from_secs(10))
        .json(body)
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

#[tauri::command]
pub async fn jira_test_connection(config: JiraConfigRust) -> Result<bool, String> {
    let client = shared_client();
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
    let client = shared_client();

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
    post_create_issue(client, &config, &body).await
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JiraPriority {
    pub id: String,
    pub name: String,
}

#[tauri::command]
pub async fn jira_get_priorities(config: JiraConfigRust) -> Result<Vec<JiraPriority>, String> {
    let client = shared_client();
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
    let client = shared_client();
    let url = format!(
        "{}/rest/api/2/issue/{}/attachments",
        config.server_url.trim_end_matches('/'),
        issue_key
    );

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

#[tauri::command]
pub async fn jira_create_issue_with_fields(
    config: JiraConfigRust,
    fields: serde_json::Value,
) -> Result<JiraCreateResponse, String> {
    let client = shared_client();
    let body = serde_json::json!({ "fields": fields });
    post_create_issue(client, &config, &body).await
}

// ========== Xray Cloud API 命令 ==========

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct XrayTestStep {
    pub action: String,
    pub result: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct XrayCreateTestResponse {
    pub issue_key: String,
    pub precondition_keys: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct XrayProjectInfo {
    pub project_id: String,
    pub test_issue_type_id: String,
    pub precondition_issue_type_id: String,
}

/// Xray Cloud 认证，返回 Bearer token
#[tauri::command]
pub async fn xray_authenticate(
    client_id: String,
    client_secret: String,
) -> Result<String, String> {
    let client = shared_client();
    let url = "https://xray.cloud.getxray.app/api/v1/authenticate";

    let resp = client
        .post(url)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "client_id": client_id,
            "client_secret": client_secret,
        }))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Xray 认证网络错误: {}", e))?;

    if resp.status().is_success() {
        let token: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("解析 Xray 认证响应失败: {}", e))?;
        token
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| "Xray 认证响应格式异常".to_string())
    } else {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        Err(format!("Xray 认证失败 ({}): {}", status, body))
    }
}

/// 解析 JIRA 项目信息，获取 project ID 和 Xray Issue Type IDs
#[tauri::command]
pub async fn xray_resolve_project_info(
    config: JiraConfigRust,
) -> Result<XrayProjectInfo, String> {
    let client = shared_client();
    let url = format!(
        "{}/rest/api/2/project/{}",
        config.server_url.trim_end_matches('/'),
        config.project_key
    );

    let resp = client
        .get(&url)
        .header("Authorization", build_basic_auth(&config))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("获取项目信息网络错误: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("获取项目信息失败 ({}): {}", status, body));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("解析项目信息失败: {}", e))?;

    let project_id = data["id"]
        .as_str()
        .ok_or_else(|| "项目信息中缺少 id 字段".to_string())?
        .to_string();

    let issue_types = data["issueTypes"]
        .as_array()
        .ok_or_else(|| "项目信息中缺少 issueTypes 字段".to_string())?;

    let mut test_issue_type_id = String::new();
    let mut precondition_issue_type_id = String::new();

    for it in issue_types {
        let name = it["name"].as_str().unwrap_or("").to_string();
        let id = it["id"].as_str().unwrap_or("").to_string();
        if name == "Test" {
            test_issue_type_id = id.clone();
        }
        if name == "Precondition" {
            precondition_issue_type_id = id;
        }
    }

    if test_issue_type_id.is_empty() {
        return Err(
            "项目中未找到 'Test' Issue 类型。请确认 Xray 插件已安装并启用于该项目。".to_string(),
        );
    }

    Ok(XrayProjectInfo {
        project_id,
        test_issue_type_id,
        precondition_issue_type_id,
    })
}

async fn xray_graphql_request(
    client: &reqwest::Client,
    token: &str,
    query: &str,
    variables: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let url = "https://xray.cloud.getxray.app/api/v2/graphql";

    let request_body = serde_json::json!({
        "query": query,
        "variables": variables,
    });

    let resp = client
        .post(url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("Xray GraphQL 请求网络错误: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Xray GraphQL 请求失败 ({}): {}", status, body));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("解析 Xray GraphQL 响应失败: {}", e))?;

    if let Some(errors) = data.get("errors").and_then(|e| e.as_array()) {
        if !errors.is_empty() {
            let msg = errors
                .iter()
                .filter_map(|e| e["message"].as_str())
                .collect::<Vec<_>>()
                .join("; ");
            return Err(format!("Xray GraphQL 错误: {}", msg));
        }
    }

    Ok(data)
}

/// 通过 Xray Cloud GraphQL 创建 Test（含 Steps 和可选 Precondition）
#[tauri::command]
pub async fn xray_create_test_with_details(
    _jira_config: JiraConfigRust,
    xray_token: String,
    project_id: String,
    test_issue_type_id: String,
    precondition_issue_type_id: String,
    summary: String,
    description: String,
    steps: Vec<XrayTestStep>,
    precondition: Option<String>,
) -> Result<XrayCreateTestResponse, String> {
    let client = shared_client();
    let mut warnings: Vec<String> = Vec::new();

    let steps_data: Vec<serde_json::Value> = steps
        .iter()
        .map(|s| {
            serde_json::json!({
                "action": s.action,
                "result": s.result,
            })
        })
        .collect();

    let jira_fields = serde_json::json!({
        "summary": summary,
        "project": { "id": project_id },
        "issuetype": { "id": test_issue_type_id },
    });

    let mut jira_fields = jira_fields;
    if !description.is_empty() {
        jira_fields["description"] = serde_json::Value::String(description);
    }

    let create_test_query = r#"
        mutation createTest($jira: JSON!, $steps: [CreateStepInput]) {
            createTest(
                testType: { name: "Manual" },
                steps: $steps,
                jira: $jira
            ) {
                test {
                    issueId
                    jira(fields: ["key"])
                }
                warnings
            }
        }
    "#;

    let create_test_vars = serde_json::json!({
        "jira": { "fields": jira_fields },
        "steps": steps_data,
    });

    let test_resp = xray_graphql_request(&client, &xray_token, create_test_query, create_test_vars).await?;

    if let Some(w) = test_resp["data"]["createTest"]["warnings"].as_array() {
        for warn in w {
            if let Some(s) = warn.as_str() {
                warnings.push(s.to_string());
            }
        }
    }

    let test_data = test_resp["data"]["createTest"]["test"]
        .as_object()
        .ok_or_else(|| "创建 Test 后响应格式异常".to_string())?;

    let issue_id = test_data["issueId"]
        .as_str()
        .ok_or_else(|| "创建 Test 后缺少 issueId".to_string())?
        .to_string();

    let issue_key = test_data["jira"]["key"]
        .as_str()
        .unwrap_or(&issue_id)
        .to_string();

    let mut precondition_keys: Vec<String> = Vec::new();

    if let Some(precond_text) = &precondition {
        if !precond_text.trim().is_empty() {
            if precondition_issue_type_id.is_empty() {
                warnings.push("项目中未启用 Precondition Issue 类型，跳过前置条件创建".to_string());
            } else {
                let precond_lines: Vec<&str> = precond_text
                    .lines()
                    .map(|l| l.trim())
                    .filter(|l| !l.is_empty())
                    .collect();

                let mut precond_issue_ids: Vec<String> = Vec::new();

                let create_precond_query = r#"
                    mutation createPrecondition($jira: JSON!, $definition: String) {
                        createPrecondition(
                            preconditionType: { name: "Manual" },
                            definition: $definition,
                            jira: $jira
                        ) {
                            precondition {
                                issueId
                                jira(fields: ["key"])
                            }
                            warnings
                        }
                    }
                "#;

                for line in &precond_lines {
                    let precond_summary = line.replace('\n', " ").replace('\r', "");
                    let precond_jira = serde_json::json!({
                        "fields": {
                            "summary": precond_summary,
                            "project": { "id": project_id },
                            "issuetype": { "id": precondition_issue_type_id },
                        }
                    });

                    let create_precond_vars = serde_json::json!({
                        "jira": precond_jira,
                        "definition": line,
                    });

                    match xray_graphql_request(&client, &xray_token, create_precond_query, create_precond_vars).await {
                        Ok(precond_resp) => {
                            if let Some(precond_data) = precond_resp["data"]["createPrecondition"]["precondition"].as_object() {
                                let precond_key_val = precond_data["jira"]["key"]
                                    .as_str()
                                    .unwrap_or_else(|| precond_data["issueId"].as_str().unwrap_or(""))
                                    .to_string();
                                let precond_issue_id = precond_data["issueId"]
                                    .as_str()
                                    .unwrap_or_default()
                                    .to_string();

                                precondition_keys.push(precond_key_val);

                                if !precond_issue_id.is_empty() {
                                    precond_issue_ids.push(precond_issue_id);
                                }

                                if let Some(w) = precond_resp["data"]["createPrecondition"]["warnings"].as_array() {
                                    for warn in w {
                                        if let Some(s) = warn.as_str() {
                                            warnings.push(s.to_string());
                                        }
                                    }
                                }
                            } else {
                                warnings.push(format!("前置条件 '{}' 创建响应格式异常", line));
                            }
                        }
                        Err(e) => {
                            warnings.push(format!("前置条件 '{}' 创建失败: {}", line, e));
                        }
                    }
                }

                if !precond_issue_ids.is_empty() {
                    let link_query = r#"
                        mutation addPreconditionsToTest($issueId: String!, $preconditionIssueIds: [String]!) {
                            addPreconditionsToTest(
                                issueId: $issueId,
                                preconditionIssueIds: $preconditionIssueIds
                            ) {
                                addedPreconditions
                                warning
                            }
                        }
                    "#;

                    let link_vars = serde_json::json!({
                        "issueId": issue_id,
                        "preconditionIssueIds": precond_issue_ids,
                    });

                    match xray_graphql_request(&client, &xray_token, link_query, link_vars).await {
                        Ok(link_resp) => {
                            if let Some(w) = link_resp["data"]["addPreconditionsToTest"]["warning"].as_str() {
                                if !w.is_empty() {
                                    warnings.push(format!("关联前置条件警告: {}", w));
                                }
                            }
                        }
                        Err(e) => {
                            warnings.push(format!("关联前置条件到测试失败: {}", e));
                        }
                    }
                }
            }
        }
    }

    Ok(XrayCreateTestResponse {
        issue_key,
        precondition_keys,
        warnings,
    })
}
