import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export async function adbDevices(): Promise<string[]> {
  return invoke<string[]>("adb_devices");
}

export async function adbConnect(host: string, port: number): Promise<string> {
  return invoke<string>("adb_connect", { host, port });
}

export async function adbRoot(): Promise<string> {
  return invoke<string>("adb_root");
}

export async function adbScreenshot(saveDir: string): Promise<string> {
  return invoke<string>("adb_screenshot", { saveDir });
}

export async function adbStartRecording(saveDir: string): Promise<string> {
  return invoke<string>("adb_start_recording", { saveDir });
}

export async function adbStopRecording(recordId: string): Promise<string> {
  return invoke<string>("adb_stop_recording", { recordId });
}

export async function adbKeyBack(): Promise<string> {
  return invoke<string>("adb_key_back");
}

export async function adbStartScrcpy(): Promise<string> {
  return invoke<string>("adb_start_scrcpy");
}

export async function adbStartLogcat(
  saveDir: string,
  filter?: string,
): Promise<string> {
  return invoke<string>("adb_start_logcat", {
    saveDir,
    filter: filter ?? null,
  });
}

export async function adbStopLogcat(recordId: string): Promise<string> {
  return invoke<string>("adb_stop_logcat", { recordId });
}

export function listenLogcat(
  recordId: string,
  onLine: (line: string) => void,
): Promise<UnlistenFn> {
  return listen<{ recordId: string; line: string }>(
    "adb-logcat",
    (event) => {
      if (event.payload.recordId === recordId) {
        onLine(event.payload.line);
      }
    },
  );
}
