use serde::Serialize;
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Mutex;
use tauri::{Emitter, State};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogcatChunk {
    pub record_id: String,
    pub line: String,
}

pub struct RunningProcesses(pub Mutex<HashMap<String, tokio::process::Child> >);

impl Default for RunningProcesses {
    fn default() -> Self {
        RunningProcesses(Mutex::new(HashMap::new()))
    }
}

fn expand_dir(dir: &str) -> Result<String, String> {
    let expanded = if dir.starts_with("~/") {
        let home = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .map_err(|_| "无法获取用户主目录".to_string())?;
        format!("{}{}", home, &dir[1..])
    } else {
        dir.to_string()
    };
    // Ensure directory exists
    std::fs::create_dir_all(&expanded)
        .map_err(|e| format!("创建目录失败: {}", e))?;
    Ok(expanded)
}

fn run_adb(args: &[&str]) -> Result<String, String> {
    let output = std::process::Command::new("adb")
        .args(args)
        .output()
        .map_err(|e| format!("执行 adb 失败: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !output.status.success() {
        Err(if stderr.is_empty() { stdout } else { stderr })
    } else {
        Ok(if stdout.is_empty() { stderr } else { stdout })
    }
}

fn now_millis() -> u128 {
    use std::time::SystemTime;
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

// --- Simple commands ---

#[tauri::command]
pub async fn adb_devices() -> Result<Vec<String>, String> {
    let output = run_adb(&["devices", "-l"])?;
    let lines: Vec<&str> = output.lines().collect();
    let devices: Vec<String> = lines
        .into_iter()
        .skip(1)
        .filter_map(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.is_empty() {
                None
            } else {
                Some(parts[0].to_string())
            }
        })
        .collect();
    Ok(devices)
}

#[tauri::command]
pub async fn adb_connect(host: String, port: u16) -> Result<String, String> {
    run_adb(&["connect", &format!("{}:{}", host, port)])
}

#[tauri::command]
pub async fn adb_root() -> Result<String, String> {
    run_adb(&["root"])
}

#[tauri::command]
pub async fn adb_key_back() -> Result<String, String> {
    run_adb(&["shell", "input", "keyevent", "BACK"])?;
    Ok("已发送返回键".to_string())
}

// --- Screenshot ---

#[tauri::command]
pub async fn adb_screenshot(save_dir: String) -> Result<String, String> {
    let save_dir = expand_dir(&save_dir)?;
    let ts = now_millis();
    let device_path = format!("/sdcard/screenshot_{}.png", ts);
    let local_name = format!("screenshot_{}.png", ts);

    run_adb(&["shell", "screencap", "-p", &device_path])?;
    let result = run_adb(&["pull", &device_path, &save_dir]);
    let _ = run_adb(&["shell", "rm", &device_path]);
    result.map(|_| format!("{}/{}", save_dir, local_name))
}

// --- Recording ---

#[tauri::command]
pub async fn adb_start_recording(
    save_dir: String,
    processes: State<'_, RunningProcesses>,
) -> Result<String, String> {
    // 先检查 scrcpy 是否可用
    let check = std::process::Command::new("scrcpy")
        .arg("--version")
        .output();
    if check.is_err() {
        return Err("录屏依赖 scrcpy，请先安装: brew install scrcpy".to_string());
    }

    let save_dir = expand_dir(&save_dir)?;
    let ts = now_millis();
    let local_name = format!("record_{}.mp4", ts);
    let file_path = format!("{}/{}", save_dir, local_name);
    // composite_id: "rec_<ts>|<file_path>"
    let composite_id = format!("rec_{}|{}", ts, file_path);

    let child = tokio::process::Command::new("scrcpy")
        .args(["--no-playback", "--record", &file_path])
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("启动录屏失败: {}（请确认已安装 scrcpy）", e))?;

    {
        let mut map = processes.0.lock().map_err(|e| format!("锁错误: {}", e))?;
        map.insert(composite_id.clone(), child);
    }

    Ok(composite_id)
}

#[tauri::command]
pub async fn adb_stop_recording(
    record_id: String,
    processes: State<'_, RunningProcesses>,
) -> Result<String, String> {
    // format: "rec_<ts>|<file_path>"
    let parts: Vec<&str> = record_id.splitn(2, '|').collect();
    if parts.len() != 2 {
        return Err("无效的录屏记录 ID".to_string());
    }
    let file_path = parts[1];

    let child = {
        let mut map = processes.0.lock().map_err(|e| format!("锁错误: {}", e))?;
        map.remove(&record_id)
    };

    match child {
        Some(mut c) => {
            // SIGINT 让 scrcpy --record 正常收尾写入 mp4 文件
            #[cfg(unix)]
            unsafe {
                libc::kill(c.id().unwrap() as i32, libc::SIGINT);
            }
            #[cfg(not(unix))]
            {
                let _ = c.kill().await;
            }
            // 超时3秒未退出则强制 kill
            let _ = tokio::time::timeout(
                std::time::Duration::from_secs(3),
                c.wait(),
            ).await;
        }
        None => {
            // 进程可能已意外退出，检查文件是否存在
            if !std::path::Path::new(file_path).exists() {
                return Err("录屏进程不存在且文件未生成".to_string());
            }
        }
    }

    if !std::path::Path::new(file_path).exists() {
        return Err("录屏文件未生成，可能设备连接断开或 scrcpy 启动失败".to_string());
    }

    Ok(file_path.to_string())
}

// --- Scrcpy ---

#[tauri::command]
pub async fn adb_start_scrcpy() -> Result<String, String> {
    tokio::process::Command::new("scrcpy")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("启动 scrcpy 失败: {}（请确认已安装 scrcpy）", e))?;
    Ok("scrcpy 已启动".to_string())
}

// --- Logcat ---

#[tauri::command]
pub async fn adb_start_logcat(
    save_dir: String,
    filter: Option<String>,
    app_handle: tauri::AppHandle,
    processes: State<'_, RunningProcesses>,
) -> Result<String, String> {
    let save_dir = expand_dir(&save_dir)?;
    let ts = now_millis();
    let local_name = format!("logcat_{}.txt", ts);
    let file_path = format!("{}/{}", save_dir, local_name);
    // composite_id: "log_<ts>|<save_dir>|<local_name>"
    let composite_id = format!("log_{}|{}|{}", ts, save_dir, local_name);

    let mut args = vec!["shell", "logcat", "-v", "time"];
    if let Some(ref f) = filter {
        if !f.is_empty() {
            args.push("-s");
            args.push(f);
        }
    }

    let mut child = tokio::process::Command::new("adb")
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("启动 logcat 失败: {}", e))?;

    let stdout = child.stdout.take().ok_or("无法获取 logcat stdout")?;

    {
        let mut map = processes.0.lock().map_err(|e| format!("锁错误: {}", e))?;
        map.insert(composite_id.clone(), child);
    }

    let rid = composite_id.clone();
    let fp = file_path.clone();
    let ah = app_handle.clone();
    tokio::spawn(async move {
        use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        let mut file = tokio::fs::File::create(&fp).await.ok();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = ah.emit(
                "adb-logcat",
                LogcatChunk {
                    record_id: rid.clone(),
                    line: line.clone(),
                },
            );
            if let Some(ref mut f) = file {
                let _ = f.write_all(line.as_bytes()).await;
                let _ = f.write_all(b"\n").await;
            }
        }
        // 进程结束（正常或被 kill），清理工作已完成
    });

    Ok(composite_id)
}

#[tauri::command]
pub async fn adb_stop_logcat(
    record_id: String,
    processes: State<'_, RunningProcesses>,
) -> Result<String, String> {
    // format: "log_<ts>|<save_dir>|<local_name>"
    let parts: Vec<&str> = record_id.splitn(3, '|').collect();
    if parts.len() != 3 {
        return Err("无效的 logcat 记录 ID".to_string());
    }
    let save_dir = parts[1];
    let local_name = parts[2];
    let file_path = format!("{}/{}", save_dir, local_name);

    let child = {
        let mut map = processes.0.lock().map_err(|e| format!("锁错误: {}", e))?;
        map.remove(&record_id)
    };

    if let Some(mut c) = child {
        let _ = c.kill().await;
        let _ = c.wait().await;
    }
    // 进程已不存在说明已停止，直接返回文件路径

    Ok(file_path)
}
