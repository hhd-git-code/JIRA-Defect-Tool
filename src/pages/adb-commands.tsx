import { useState, useEffect, useRef, useCallback } from "react";
import {
  Button,
  Input,
  InputNumber,
  Card,
  Space,
  message,
  Typography,
} from "antd";
import {
  LinkOutlined,
  CrownOutlined,
  CameraOutlined,
  VideoCameraOutlined,
  LeftOutlined,
  DesktopOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  StopOutlined,
  ReloadOutlined,
  UsbOutlined,
} from "@ant-design/icons";
import { open } from "@tauri-apps/plugin-dialog";
import {
  adbDevices,
  adbConnect,
  adbRoot,
  adbScreenshot,
  adbStartRecording,
  adbStopRecording,
  adbKeyBack,
  adbStartScrcpy,
  adbStartLogcat,
  adbStopLogcat,
  listenLogcat,
} from "../services/adb-service";
import type { UnlistenFn } from "@tauri-apps/api/event";

const { Text } = Typography;

export default function AdbCommands() {
  const [host, setHost] = useState("127.0.0.1");
  const [port, setPort] = useState(5555);
  const [loading, setLoading] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [logcatId, setLogcatId] = useState<string | null>(null);
  const [logcatFilter, setLogcatFilter] = useState("");
  const [logcatLines, setLogcatLines] = useState<string[]>([]);
  const [saveDir, setSaveDir] = useState("~/Desktop/adb-output");
  const [devices, setDevices] = useState<string[]>([]);

  const logcatEndRef = useRef<HTMLDivElement>(null);
  const logcatUnlistenRef = useRef<UnlistenFn | null>(null);

  // Auto-scroll logcat output
  useEffect(() => {
    logcatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logcatLines]);

  // Cleanup logcat listener on unmount
  useEffect(() => {
    return () => {
      logcatUnlistenRef.current?.();
    };
  }, []);

  // Refresh device list
  const refreshDevices = useCallback(async () => {
    setLoading("devices");
    try {
      const list = await adbDevices();
      setDevices(list);
    } catch (e: any) {
      message.error(String(e));
    } finally {
      setLoading(null);
    }
  }, []);

  // Load devices on mount
  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  const exec = useCallback(
    async (op: string, fn: () => Promise<string>, onSuccess?: (r: string) => void) => {
      setLoading(op);
      try {
        const result = await fn();
        message.success(result);
        onSuccess?.(result);
      } catch (e: any) {
        message.error(String(e));
      } finally {
        setLoading(null);
      }
    },
    [],
  );

  const handleConnect = () =>
    exec("connect", () => adbConnect(host, port), () => refreshDevices());

  const handleRoot = () => exec("root", () => adbRoot());

  const handleScreenshot = () =>
    exec("screenshot", () => adbScreenshot(saveDir));

  const handleStartRecording = () =>
    exec("recStart", () => adbStartRecording(saveDir), (id) => {
      setRecordingId(id);
    });

  const handleStopRecording = () => {
    if (!recordingId) return;
    const rid = recordingId;
    setRecordingId(null);
    exec("recStop", () => adbStopRecording(rid));
  };

  const handleKeyBack = () => exec("back", () => adbKeyBack());

  const handleScrcpy = () => exec("scrcpy", () => adbStartScrcpy());

  const handleStartLogcat = async () => {
    setLoading("logStart");
    try {
      // 确保先清理旧监听器
      logcatUnlistenRef.current?.();
      logcatUnlistenRef.current = null;

      const id = await adbStartLogcat(saveDir, logcatFilter || undefined);
      setLogcatId(id);
      setLogcatLines([]);
      const unlisten = await listenLogcat(id, (line) => {
        setLogcatLines((prev) => [...prev.slice(-499), line]);
      });
      logcatUnlistenRef.current = unlisten;
      message.success("logcat 已开始抓取");
    } catch (e: any) {
      message.error(String(e));
    } finally {
      setLoading(null);
    }
  };

  const handleStopLogcat = () => {
    if (!logcatId) return;
    const rid = logcatId;
    setLogcatId(null);
    setLogcatLines([]);
    logcatUnlistenRef.current?.();
    logcatUnlistenRef.current = null;
    exec("logStop", () => adbStopLogcat(rid));
  };

  const handleChooseDir = async () => {
    const selected = await open({ directory: true, title: "选择保存目录" });
    if (selected) {
      setSaveDir(selected);
    }
  };

  const isLoading = (op: string) => loading === op;
  const isAnyLoading = loading !== null;

  return (
    <div style={{ padding: "20px 24px", maxWidth: 960, margin: "0 auto" }}>
      {/* Save directory */}
      <Card
        size="small"
        title="保存目录"
        style={{ marginBottom: 16 }}
      >
        <Space.Compact style={{ width: "100%" }}>
          <Input
            value={saveDir}
            onChange={(e) => setSaveDir(e.target.value)}
            placeholder="文件保存路径"
          />
          <Button icon={<FolderOpenOutlined />} onClick={handleChooseDir}>
            选择目录
          </Button>
        </Space.Compact>
      </Card>

      {/* Device connection */}
      <Card
        size="small"
        title={
          <Space>
            <span>设备连接</span>
            <Button
              size="small"
              type="text"
              icon={<ReloadOutlined spin={isLoading("devices")} />}
              loading={isLoading("devices")}
              onClick={refreshDevices}
            />
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Space wrap>
            {devices.length > 0 ? (
              <>
                <UsbOutlined style={{ color: "#52c41a" }} />
                <Text strong style={{ color: "#52c41a" }}>
                  已连接 {devices.length} 台设备: {devices.join(", ")}
                </Text>
              </>
            ) : (
              <Text type="secondary">暂无设备连接，请通过 USB 或网络连接设备</Text>
            )}
            <Button
              icon={<CrownOutlined />}
              loading={isLoading("root")}
              disabled={isAnyLoading || devices.length === 0}
              onClick={handleRoot}
            >
              Root
            </Button>
          </Space>
          <Space>
            <Text type="secondary">网络连接:</Text>
            <Input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="IP 地址"
              style={{ width: 130 }}
            />
            <InputNumber
              value={port}
              onChange={(v) => setPort(v ?? 5555)}
              min={1}
              max={65535}
              style={{ width: 80 }}
            />
            <Button
              icon={<LinkOutlined />}
              loading={isLoading("connect")}
              disabled={isAnyLoading}
              onClick={handleConnect}
            >
              连接
            </Button>
          </Space>
        </Space>
      </Card>

      {/* Quick actions grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
          marginBottom: 16,
        }}
      >
        {/* Screenshot */}
        <Card size="small" title="一键截屏">
          <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
            截取设备屏幕并保存到本地
          </Text>
          <Button
            type="primary"
            icon={<CameraOutlined />}
            size="large"
            block
            loading={isLoading("screenshot")}
            disabled={isAnyLoading}
            onClick={handleScreenshot}
          >
            截屏
          </Button>
        </Card>

        {/* Recording */}
        <Card size="small" title="一键录屏">
          <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
            {recordingId ? "正在录制中..." : "录制设备屏幕并保存"}
          </Text>
          {recordingId ? (
            <Button
              danger
              icon={<StopOutlined />}
              size="large"
              block
              loading={isLoading("recStop")}
              disabled={isAnyLoading}
              onClick={handleStopRecording}
            >
              停止录屏
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<VideoCameraOutlined />}
              size="large"
              block
              loading={isLoading("recStart")}
              disabled={isAnyLoading}
              onClick={handleStartRecording}
            >
              开始录屏
            </Button>
          )}
        </Card>

        {/* Back key */}
        <Card size="small" title="一键返回">
          <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
            模拟按下返回键
          </Text>
          <Button
            type="primary"
            icon={<LeftOutlined />}
            size="large"
            block
            loading={isLoading("back")}
            disabled={isAnyLoading}
            onClick={handleKeyBack}
          >
            返回
          </Button>
        </Card>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr",
          gap: 16,
        }}
      >
        {/* Scrcpy */}
        <Card size="small" title="一键投屏">
          <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
            启动 scrcpy 实时投屏
          </Text>
          <Button
            type="primary"
            icon={<DesktopOutlined />}
            size="large"
            block
            loading={isLoading("scrcpy")}
            disabled={isAnyLoading}
            onClick={handleScrcpy}
          >
            投屏
          </Button>
        </Card>

        {/* Logcat */}
        <Card size="small" title="一键取 Logcat">
          <Space style={{ marginBottom: 12 }} wrap>
            <Text>Filter:</Text>
            <Input
              value={logcatFilter}
              onChange={(e) => setLogcatFilter(e.target.value)}
              placeholder="如 ActivityManager 或留空"
              style={{ width: 250 }}
              disabled={!!logcatId}
            />
            {logcatId ? (
              <Button
                danger
                icon={<StopOutlined />}
                loading={isLoading("logStop")}
                disabled={isAnyLoading}
                onClick={handleStopLogcat}
              >
                停止抓取
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<FileTextOutlined />}
                loading={isLoading("logStart")}
                disabled={isAnyLoading}
                onClick={handleStartLogcat}
              >
                开始抓取
              </Button>
            )}
          </Space>
          <div
            style={{
              backgroundColor: "#1e1e1e",
              color: "#4ec9b0",
              fontFamily: "Menlo, Monaco, 'Courier New', monospace",
              fontSize: 12,
              lineHeight: 1.5,
              padding: 12,
              borderRadius: 6,
              maxHeight: 300,
              overflowY: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {logcatLines.length === 0 ? (
              <Text style={{ color: "#666" }}>
                {logcatId ? "等待 log 输出..." : "点击\"开始抓取\"获取 logcat"}
              </Text>
            ) : (
              logcatLines.map((line, i) => <div key={i}>{line}</div>)
            )}
            <div ref={logcatEndRef} />
          </div>
        </Card>
      </div>
    </div>
  );
}
