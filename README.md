# JIRA 测试工具

一款面向车载信息娱乐系统（IVI）测试团队的桌面工具。三大核心能力：**缺陷录入**（中文填写→自动翻译→一键创建 JIRA 缺陷）、**PRD 转测试用例**（AI 生成测试点→翻译→创建 JIRA/Xray 测试用例）、**ADB 测试命令**（截图/录屏/投屏/Logcat 日志抓取，一站式证据收集）。

## 功能特性

### 缺陷录入

- **中文填写，自动翻译** — 表单全中文输入，三层翻译架构（自定义词典→在线翻译→回退标记）自动翻译为英文
- **一键创建 JIRA 缺陷** — 对接 JIRA REST API v2，支持 JIRA Cloud 和 JIRA Data Center
- **批量导入** — 支持 Excel (.xlsx) 和 CSV 文件导入，向导式批量创建，支持取消和部分重试
- **附件上传** — 支持图片（PNG/JPG）、视频（MP4/MOV）、日志文件（TXT/LOG/ZIP）上传
- **翻译预览与编辑** — 提交前可预览翻译结果，支持手动修改
- **缺陷模板** — 预设常用缺陷模板（crash、功能异常、性能问题），快速填充字段
- **草稿自动保存** — 每秒自动保存表单内容，意外关闭不丢失

### PRD 转测试用例

- **多来源 PRD 输入** — 支持上传 Word/PDF/Markdown/文本文件，或输入 URL 抓取页面内容
- **Confluence 认证抓取** — 自动识别 Confluence 页面，使用 JIRA 凭证认证获取完整内容
- **AI 生成测试点** — 支持 Claude/OpenAI/DeepSeek 多模型，流式输出实时查看生成过程
- **结构化测试点** — AI 输出含标题、描述、前置条件、测试步骤（操作+预期结果）、优先级
- **测试点可编辑** — AI 生成后可增删改调整，确保准确性和完整性
- **Xray 测试用例创建** — 集成 Xray Cloud API，创建带测试步骤和前置条件的结构化测试用例
- **4 步向导引导** — 上传 PRD → AI 生成 → 翻译 → 创建，流程清晰

### ADB 命令集成

- **设备连接管理** — 列出已连接 ADB 设备，支持 IP:Port 网络连接，一键 Root
- **一键截屏** — 截取设备屏幕并保存为 PNG（自动时间戳命名）
- **一键录屏** — 基于 scrcpy 录制设备屏幕为 MP4，支持开始/停止控制
- **一键投屏** — 启动 scrcpy 实时投屏窗口
- **Logcat 日志抓取** — 实时显示日志（终端风格深色界面），支持标签过滤，自动保存为 .txt 文件
- **按键模拟** — 一键发送 Back 按键事件
- **输出目录可配置** — 截图、录屏、日志文件保存目录自定义，默认 `~/Desktop/adb-output`

### 缺陷模板管理

- **保存当前表单为模板** — 将缺陷表单 9 个字段一键保存为可复用模板
- **模板管理** — 新建、编辑、删除模板，列表显示已填充字段数和前 3 字段预览
- **快速应用** — 通过模板管理器一键填充表单，已有内容时弹出覆盖确认
- **持久化存储** — 模板数据通过 Zustand + localStorage 持久化，跨会话保留

### 通用特性

- **安全加密** — JIRA Token、AI API Key、Xray Secret 等所有敏感凭据使用 AES-256-GCM 加密存储
- **跨平台** — 支持 Windows 10+ 和 macOS 12+
- **外部工具集成** — ADB 和 scrcpy 系统命令集成，未安装时给出明确提示

## 技术栈

| 层 | 技术 |
|---|------|
| 桌面框架 | Tauri v2 (Rust 后端) |
| 前端框架 | React 19 + TypeScript |
| UI 组件库 | Ant Design 6 |
| 状态管理 | Zustand |
| 构建工具 | Vite 8 |

## 系统要求

### 基础环境
- **Node.js**: 20+
- **Rust**: 最新稳定版（[安装指南](https://www.rust-lang.org/tools/install)）
- **操作系统**: Windows 10+ / macOS 12+

### 平台特定依赖

**macOS:**
```bash
xcode-select --install
```

**Windows:**
安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（C++ 桌面开发工作负载）。

## 安装指南

### 1. 克隆项目
```bash
git clone https://github.com/<your-username>/jira-defect-tool.git
cd jira-defect-tool
```

### 2. 安装前端依赖
```bash
npm install
```

### 3. 开发模式运行
```bash
npm run tauri dev
```

### 4. 构建发布包
```bash
npm run tauri build
```

构建产物位于 `src-tauri/target/release/bundle/` 目录。

## 使用方法

### 首次使用：配置

1. 打开应用，进入 **设置** 页面
2. 填写 JIRA 服务器地址、用户名、API Token
3. 点击 **测试连接** 确认配置正确
4. 选择默认项目和问题类型

> **获取 JIRA API Token:**
> - JIRA Cloud: 前往 [Atlassian API Token](https://id.atlassian.com/manage-profile/security/api-tokens) 创建
> - JIRA Data Center: 在个人设置中生成 Personal Access Token

### 单条创建缺陷

1. 在 **缺陷录入** 页面填写缺陷信息（标题、优先级、前提条件、步骤、预期/实际结果、复现率、recover 步骤等）
2. 可选：上传截图/视频、trace 文件
3. 点击 **翻译预览** 查看英文翻译结果，可手动修改
4. 点击 **提交** 创建 JIRA 缺陷单

### 批量导入

1. 准备 Excel 或 CSV 文件，包含缺陷信息列（支持中英文列名）
2. 在缺陷录入页面拖拽或点击导入文件
3. 进入批量创建向导，逐条确认信息
4. 一键批量提交，支持中途取消和失败重试

### PRD 转测试用例

1. 进入 **PRD 转测试用例** 页面
2. 上传 PRD 文档（.docx/.pdf/.md/.txt）或输入 URL
3. AI 自动分析 PRD 并生成测试点（流式输出）
4. 编辑/调整测试点
5. 翻译为英文
6. 创建到 JIRA（启用 Xray 时创建为 Xray 测试用例）

### 配置 AI 服务

1. 在 **设置** 页面找到 **AI 服务配置**
2. 选择 AI 提供商（Claude / OpenAI / DeepSeek）
3. 填写 API Key，选择模型（如 `claude-sonnet-4-20250514`、`gpt-4o`、`deepseek-chat`）
4. 可选：配置自定义 Base URL（用于第三方代理或私有部署）

### 配置 Xray

1. 在 **设置** 页面找到 **Xray 配置**
2. 启用 Xray 集成
3. 填写 Client ID 和 Client Secret
4. 点击 **测试 Xray 连接** 确认配置正确

> **获取 Xray 凭证:** 前往 Xray Cloud Settings → API Keys 生成 Client ID 和 Client Secret

### ADB 命令

1. 进入 **测试常用命令** 页面
2. 选择文件保存目录（截图、录屏、日志输出的位置）
3. **设备连接**：USB 连接后自动识别设备；也可输入 IP:Port 网络连接
4. **截屏**：点击"截屏"按钮，自动截取设备屏幕并保存为 PNG
5. **录屏**：点击"开始录屏"启动录制，再点击"停止录屏"保存为 MP4
6. **投屏**：点击"投屏"启动 scrcpy 实时镜像窗口
7. **Logcat**：输入过滤标签（可选），点击"开始抓取"实时查看日志，点击"停止抓取"保存日志为 .txt
8. **按键模拟**：点击"返回"发送 Back 按键事件

> **前提条件：** 需要系统已安装 `adb`（Android SDK Platform-Tools）；录屏和投屏功能需要额外安装 [scrcpy](https://github.com/Genymobile/scrcpy)。未安装时会给出明确提示。

### 缺陷模板

1. 在缺陷录入页面填写常用字段组合后，点击 **保存为模板** 按钮
2. 输入模板名称，确认保存
3. 需要复用时，点击 **模板管理** 按钮，查看所有模板（显示已填充字段数和预览）
4. 点击"应用"将模板数据填入表单，表单已有内容时需确认覆盖
5. 支持在模板管理器中新建、编辑、删除模板

### 配置在线翻译

1. 在 **设置** 页面找到 **在线翻译配置**
2. 启用在线翻译
3. 选择翻译服务（百度翻译 / 有道智云）
4. 填写对应 API 凭证

### Excel/CSV 列名映射

| 字段 | 中文列名 | 英文列名 |
|------|---------|---------|
| 标题 | 标题 | Title / Summary |
| 优先级 | 优先级 | Priority |
| 时间点 | 时间点 | Timestamp |
| 前提条件 | 前提条件 | Precondition |
| 步骤 | 步骤 | Steps |
| 预期结果 | 预期结果 | Expected Result |
| 实际结果 | 实际结果 | Actual Result |
| 复现率 | 复现率 | Reproduce Rate |
| 恢复步骤 | Recover步骤 | Recover Steps |

## 翻译架构

工具采用三层翻译管道，确保中文内容尽可能完整翻译为英文：

```
中文输入 → [1. 自定义词典] → [2. 在线翻译API] → [3. 兜底标记] → 英文输出
```

1. **自定义词典** — 最长匹配优先替换，可自行添加车载测试领域术语
2. **在线翻译 API** — 可选接入百度翻译或有道云翻译，批量提交未命中词典的文本
3. **兜底标记** — 未翻译的中文文本标记为 `[未翻译: 原文]`，确保不遗漏

该翻译架构同时用于缺陷描述翻译和测试用例翻译。

## 项目结构

```
jira-defect-tool/
├── src/                              # 前端源码 (React + TypeScript)
│   ├── pages/
│   │   ├── defect-form.tsx           # 缺陷录入页
│   │   ├── batch-guide.tsx           # 批量创建向导
│   │   ├── prd-test-case.tsx         # PRD 转测试用例页
│   │   ├── adb-commands.tsx          # ADB 命令页（设备管理/截图/录屏/投屏/Logcat）
│   │   └── settings.tsx              # 设置页（JIRA/翻译/AI/Xray 配置）
│   ├── components/
│   │   ├── defect-fields.tsx         # 缺陷表单字段
│   │   ├── attachment-upload.tsx     # 附件上传组件
│   │   ├── import-upload.tsx         # Excel/CSV 导入组件
│   │   ├── translate-preview.tsx     # 翻译预览弹窗
│   │   ├── batch-progress.tsx        # 批量创建进度
│   │   ├── result-panel.tsx          # 创建结果展示
│   │   ├── jira-config-form.tsx      # JIRA 配置表单
│   │   ├── save-template-modal.tsx   # 缺陷模板保存弹窗
│   │   ├── template-manager.tsx      # 缺陷模板管理组件
│   │   ├── prd-upload.tsx            # PRD 文档上传组件
│   │   ├── test-point-editor.tsx     # 测试点编辑器
│   │   ├── test-case-translate.tsx   # 测试用例翻译组件
│   │   └── test-case-create.tsx      # 测试用例创建组件
│   ├── services/
│   │   ├── translate-engine.ts       # 三层翻译引擎
│   │   ├── jira-api.ts               # JIRA/Xray API 封装
│   │   ├── ai-service.ts             # AI 服务调用
│   │   ├── ai-parser.ts              # AI 响应解析
│   │   ├── document-parser.ts        # Word/PDF/MD 文档解析
│   │   ├── adb-service.ts            # ADB 命令封装（设备/截图/录屏/Logcat）
│   │   ├── test-case-translate.ts    # 测试用例翻译服务
│   │   ├── dict-service.ts           # 自定义词典服务
│   │   ├── table-parser.ts           # Excel/CSV 解析
│   │   └── validation.ts             # 表单校验
│   ├── stores/
│   │   ├── config-store.ts           # 全局配置（JIRA/翻译/AI/Xray）
│   │   ├── defect-store.ts           # 缺陷表单状态
│   │   ├── batch-store.ts            # 批量创建状态
│   │   └── prd-store.ts              # PRD 转测试用例状态
│   ├── types/
│   │   ├── config.ts                 # 配置类型
│   │   ├── defect.ts                 # 缺陷类型
│   │   ├── jira.ts                   # JIRA 类型
│   │   ├── template.ts               # 模板类型
│   │   └── test-case.ts              # 测试用例类型
│   ├── constants/
│   │   ├── column-mapping.ts         # 列名映射
│   │   ├── priority.ts               # 优先级映射
│   │   └── reproduce-rate.ts         # 复现率映射
│   ├── hooks/
│   │   └── use-tauri-drag-drop.ts    # Tauri 拖拽 hook
│   └── utils/
│       ├── file-helper.ts            # 文件工具
│       ├── format-description.ts     # 缺陷描述格式化
│       └── format-test-case-description.ts  # 测试用例描述格式化
├── src-tauri/                        # Rust 后端 (Tauri v2)
│   └── src/
│       ├── commands/
│       │   ├── jira.rs               # JIRA REST API + 附件上传
│       │   ├── ai.rs                 # AI API 调用（Claude/OpenAI/DeepSeek）
│       │   ├── adb.rs                # ADB 命令（设备/截图/录屏/Logcat/按键）
│       │   ├── crypto.rs             # AES-256-GCM 加解密
│       │   └── mod.rs
│       ├── utils/
│       │   ├── html.rs               # HTML 解析与正文提取
│       │   └── mod.rs
│       ├── lib.rs                    # 插件与命令注册
│       └── main.rs                   # 入口
├── JIRA-缺陷自动创建工具-PRD.md      # 产品需求文档
├── package.json
├── vite.config.ts
└── tauri.conf.json
```

## 安全说明

- JIRA API Token、在线翻译 API 凭证、AI API Key、Xray Client Secret 均使用 **AES-256-GCM** 加密后存储在本地
- 加密密钥基于主机名 + 用户名派生，绑定当前设备
- AI API 调用通过 Rust 后端执行，API Key 不暴露到前端
- 所有凭据仅存储在本地文件系统，不会上传到任何服务器

## 注意事项

1. **网络要求** — 需要能访问目标 JIRA 服务器；使用在线翻译/AI 服务时需外网连接；离线时翻译降级为词典+回退标记
2. **JIRA 权限** — 确保使用的 JIRA 账号有创建 Issue 和上传附件的权限
3. **翻译质量** — 自定义词典覆盖率越高，翻译质量越好；建议针对团队常用的车载测试术语建立词典
4. **AI 配置** — PRD 转测试用例功能需要先配置 AI 服务，推荐使用 Claude 或 GPT-4o 模型
5. **Xray 集成** — 需要在 Xray Cloud 中生成 API 凭证；未启用 Xray 时测试用例创建为普通 JIRA Issue
6. **批量创建** — 建议先小批量测试，确认无误后再大批量提交
7. **ADB 依赖** — ADB 功能需要系统已安装 `adb`（Android SDK Platform-Tools）；录屏和投屏需要额外安装 [scrcpy](https://github.com/Genymobile/scrcpy)
8. **合法使用** — 请遵守所在组织的 JIRA 使用规范

## 许可证

本项目仅供学习和研究使用。
