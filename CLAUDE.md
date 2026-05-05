# JIRA 缺陷自动创建工具

桌面应用，用于车载信息娱乐系统测试团队填写中文缺陷、自动翻译为英文、一键创建 JIRA Issue。支持 Excel/CSV 批量导入。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Ant Design + Zustand |
| 后端 | Tauri v2 + Rust |
| 构建 | `npm run tauri dev` / `npm run tauri build` |

## 目录结构

```
src/
├── pages/           # 页面组件（defect-form, batch-guide, settings）
├── components/      # 通用组件（attachment-upload, translate-preview 等）
├── stores/          # Zustand 状态管理（config-store, defect-store, batch-store）
├── services/        # 业务逻辑（jira-api, translate-engine, table-parser 等）
├── constants/       # 常量映射（column-mapping, priority, reproduce-rate）
├── types/           # TypeScript 类型定义
├── utils/           # 工具函数
└── hooks/           # 自定义 hooks

src-tauri/src/
├── commands/        # Tauri 命令（jira.rs, crypto.rs）
├── lib.rs           # Tauri 应用入口，注册所有命令
└── main.rs          # Rust main
```

## 核心功能

1. **缺陷表单**：填写标题、优先级、时间戳、前置条件、步骤、预期/实际结果、复现率、恢复步骤
2. **三层翻译**：自定义词典（最长匹配）→ 在线 API（百度/有道）→ 回退标记 `[未翻译: ...]`
3. **附件上传**：媒体文件（png/jpg/mp4/mov）+ Trace 文件（txt/log/zip），通过 JIRA REST API 上传
4. **批量导入**：解析 .xlsx/.csv，列名自动映射，支持中英文字段名和值翻译
5. **JIRA 配置**：服务器 URL、用户名、API Token、项目 Key、Issue Type

## 开发命令

```bash
npm run tauri dev     # 启动开发环境（热重载）
npm run tauri build   # 构建生产安装包
```

## Tauri 命令

| 命令 | 用途 |
|------|------|
| `jira_test_connection` | 测试 JIRA 连接 |
| `jira_get_priorities` | 获取优先级列表 |
| `jira_create_issue` | 创建 Issue |
| `jira_upload_attachments` | 上传附件 |
| `encrypt_value` / `decrypt_value` | AES-256-GCM 加密/解密敏感数据 |

## JIRA Description 格式

使用 Confluence Wiki Markup：

```
h2. 时间戳
{timestamp}

h2. 前置条件
{precondition}

h2. 步骤
{steps}

h2. 预期结果
{expected}

h2. 实际结果
{actual}

h2. 复现率
{reproduceRate}

h2. 恢复步骤
{recoverSteps}
```

## 状态管理

| Store | 用途 |
|-------|------|
| `config-store` | JIRA 配置、翻译配置、词典数据（持久化到 localStorage） |
| `defect-store` | 单条缺陷表单状态、翻译结果、创建状态 |
| `batch-store` | 批量导入列表、当前索引、各项结果、取消标志 |

## 约定

- 代码注释用中文（用户群体为中文用户）
- 变量名、函数名用英文
- 优先级和复现率的中文→英文映射在 `src/constants/` 中维护
- 列名映射在 `src/constants/column-mapping.ts` 中维护
- 使用 Ant Design 的 Tabs 组件作为页面导航
