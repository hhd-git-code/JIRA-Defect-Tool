# JIRA 缺陷自动创建工具

一款面向车载信息娱乐系统（IVI）测试团队的桌面工具。测试人员用中文填写缺陷信息，工具自动翻译为英文并一键创建 JIRA 缺陷单，支持批量导入 Excel/CSV 文件。

## 功能特性

- **中文填写，自动翻译** — 表单全中文输入，自动翻译为英文，三层翻译架构确保覆盖率
- **一键创建 JIRA** — 对接 JIRA REST API v2，支持 JIRA Cloud 和 JIRA Data Center（本地部署）
- **批量导入** — 支持 Excel (.xlsx) 和 CSV 文件导入，向导式批量创建
- **附件上传** — 支持图片（PNG/JPG）、视频（MP4/MOV）、日志文件（TXT/LOG/ZIP）上传
- **翻译预览与编辑** — 提交前可预览翻译结果，支持手动修改
- **草稿自动保存** — 每秒自动保存表单内容，意外关闭不丢失
- **安全加密** — JIRA Token 和翻译 API 密钥使用 AES-256-GCM 加密存储在本地
- **跨平台** — 支持 Windows 10+ 和 macOS 12+

## 技术栈

| 层 | 技术 | 版本 |
|---|------|------|
| 桌面框架 | Tauri | v2 (Rust 后端) |
| 前端框架 | React | v19 |
| 开发语言 | TypeScript | v6 |
| UI 组件库 | Ant Design | v6 |
| 构建工具 | Vite | v8 |
| Excel 解析 | xlsx | v0.18 |
| CSV 解析 | PapaParse | v5.5 |

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

### 首次使用：配置 JIRA 连接

1. 打开应用，进入 **设置** 页面
2. 填写 JIRA 服务器地址、用户名、API Token
3. 点击 **测试连接** 确认配置正确
4. 选择默认项目和问题类型

> **获取 JIRA API Token:**
> - JIRA Cloud: 前往 [Atlassian API Token](https://id.atlassian.com/manage-profile/security/api-tokens) 创建
> - JIRA Data Center: 在个人设置中生成 Personal Access Token

### 单条创建缺陷

1. 在主页面填写缺陷信息（摘要、优先级、复现步骤等）
2. 可选：上传截图、视频、日志文件
3. 点击 **翻译预览** 查看英文翻译结果，可手动修改
4. 点击 **提交** 创建 JIRA 缺陷单

### 批量导入

1. 准备 Excel 或 CSV 文件，包含缺陷信息列（支持中英文列名）
2. 在主页面拖拽或点击导入文件
3. 进入批量创建向导，逐条确认翻译结果
4. 一键批量提交

### Excel/CSV 列名映射

| 字段 | 中文列名 | 英文列名 |
|------|---------|---------|
| 摘要 | 摘要/标题 | Summary/Title |
| 优先级 | 优先级 | Priority |
| 复现步骤 | 复现步骤 | Steps to Reproduce |
| 预期结果 | 预期结果 | Expected Result |
| 实际结果 | 实际结果 | Actual Result |
| 复现率 | 复现率 | Reproduce Rate |
| 恢复步骤 | 恢复步骤 | Recover Steps |

## 翻译架构

工具采用三层翻译管道，确保中文缺陷信息尽可能完整翻译为英文：

```
中文输入 → [1. 自定义词典] → [2. 在线翻译API] → [3. 兜底标记] → 英文输出
```

1. **自定义词典** — 最长匹配优先替换，可自行添加车载测试领域术语
2. **在线翻译 API** — 可选接入百度翻译或有道云翻译，批量提交未命中词典的文本
3. **兜底标记** — 未翻译的中文文本标记为 `[未翻译: 原文]`，确保不遗漏

## 项目结构

```
jira-defect-tool/
├── src/                          # 前端源码 (React + TypeScript)
│   ├── pages/
│   │   ├── defect-form.tsx       # 主页面：缺陷填写与提交
│   │   ├── settings.tsx          # 设置：JIRA 配置、翻译配置、词典管理
│   │   └── batch-guide.tsx       # 批量创建向导
│   ├── components/
│   │   ├── defect-fields.tsx     # 缺陷表单字段
│   │   ├── attachment-upload.tsx # 附件上传组件
│   │   ├── import-upload.tsx     # Excel/CSV 导入组件
│   │   ├── translate-preview.tsx # 翻译预览弹窗
│   │   ├── batch-progress.tsx    # 批量创建进度
│   │   ├── result-panel.tsx      # 创建结果展示
│   │   └── jira-config-form.tsx  # JIRA 配置表单
│   ├── services/
│   │   ├── translate-engine.ts   # 三层翻译引擎
│   │   ├── jira-api.ts           # JIRA API 调用封装
│   │   ├── dict-service.ts       # 自定义词典服务
│   │   ├── table-parser.ts       # Excel/CSV 解析
│   │   └── validation.ts         # 表单校验
│   ├── stores/                   # 状态管理
│   ├── types/                    # TypeScript 类型定义
│   ├── constants/                # 常量（列名映射、优先级等）
│   └── utils/                    # 工具函数
├── src-tauri/                    # Rust 后端 (Tauri v2)
│   └── src/
│       ├── commands/
│       │   ├── jira.rs           # JIRA REST API 命令
│       │   └── crypto.rs         # AES-256-GCM 加解密
│       ├── lib.rs                # 插件与命令注册
│       └── main.rs               # 入口
├── JIRA-缺陷自动创建工具-PRD.md    # 产品需求文档
├── package.json
├── vite.config.ts
└── tauri.conf.json
```

## 安全说明

- JIRA API Token 和翻译 API 密钥使用 **AES-256-GCM** 加密后存储在本地
- 加密密钥基于主机名 + 用户名派生，绑定当前设备
- 所有凭据仅存储在本地文件系统，不会上传到任何服务器

## 注意事项

1. **网络要求** — 需要能访问目标 JIRA 服务器；使用在线翻译时需能访问百度/有道翻译 API
2. **JIRA 权限** — 确保使用的 JIRA 账号有创建 Issue 和上传附件的权限
3. **翻译质量** — 自定义词典覆盖率越高，翻译质量越好；建议针对团队常用的车载测试术语建立词典
4. **批量创建** — 建议先小批量测试，确认无误后再大批量提交
5. **合法使用** — 请遵守所在组织的 JIRA 使用规范

## 许可证

本项目仅供学习和研究使用。
