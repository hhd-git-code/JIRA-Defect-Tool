# JIRA 测试工具

车载信息娱乐系统测试团队使用的 Tauri v2 桌面工具。核心功能：中文填写缺陷 → 自动翻译 → 一键创建 JIRA Issue；PRD 文档 → AI 生成测试点 → 创建 Xray 测试用例。

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri v2 (Rust 后端) |
| 前端 | React 19 + TypeScript (strict) |
| UI | Ant Design 6 |
| 状态管理 | Zustand (持久化到 localStorage) |
| 构建 | Vite 8 |
| 路径别名 | `@/*` → `src/*` |

## 开发命令

```bash
npm run tauri dev      # 开发模式（Vite :1420 + Tauri 窗口）
npm run tauri build    # 生产构建（产物在 src-tauri/target/release/bundle/）
npm run dev            # 仅前端 Vite 开发服务器
```

没有测试命令。改完代码用 `npm run tauri dev` 手动验证。

## 项目结构

```
src/                          # React 前端
├── pages/                    # 页面：defect-form, batch-guide, prd-test-case, settings
├── components/               # 可复用组件（15个）
├── stores/                   # Zustand stores：config-store, defect-store, batch-store, prd-store
├── services/                 # 业务逻辑
│   ├── jira-api.ts           # JIRA/Xray REST API 调用
│   ├── translate-engine.ts   # 三层翻译引擎（词典→在线API→回退标记）
│   ├── ai-service.ts         # AI 服务（Claude/OpenAI/DeepSeek）
│   ├── document-parser.ts    # 文档解析（Word/PDF/MD）
│   ├── table-parser.ts       # Excel/CSV 解析
│   └── ...
├── types/                    # 类型定义：config, defect, jira, template, test-case
├── constants/                # 常量映射：priority, reproduce-rate, column-mapping
├── hooks/                    # use-tauri-drag-drop
└── utils/                    # format-description, file-helper 等

src-tauri/                    # Rust 后端
├── src/
│   ├── lib.rs                # Tauri 命令注册入口
│   ├── commands/
│   │   ├── jira.rs           # JIRA REST API（创建/附件/连接测试）
│   │   ├── ai.rs             # AI 流式/非流式调用
│   │   └── crypto.rs         # AES-256-GCM 加解密
│   └── utils/
│       └── html.rs           # HTML 内容提取（Confluence 感知）
├── tauri.conf.json           # 窗口 1200×800、CSP、插件配置
└── capabilities/default.json # 权限声明
```

## 代码规范

- 注释用中文，变量/函数名用英文
- store 文件命名：`*-store.ts`
- 使用 Ant Design 组件，保持 UI 一致
- 敏感凭证：前端通过 Tauri command 调用 Rust 侧 `crypto.rs` 加解密，不直接操作密钥
- 翻译引擎三层优先级不可随意调整：词典→在线API→回退标记

## 架构要点

**前后端分工：**
- 前端负责 UI、状态管理、翻译引擎调度、JIRA API 调用（通过 Tauri HTTP plugin）、文档解析
- Rust 后端负责：加密解密（crypto.rs）、AI 流式调用（ai.rs）、JIRA 附件上传（jira.rs）、HTML 内容提取（html.rs）
- 所有需要绕过 CSP 的网络请求走 Tauri command，不走前端 fetch

**翻译引擎（translate-engine.ts）：**
1. 自定义词典最长匹配优先
2. 百度/有道在线翻译
3. 未翻译部分标记 `[未翻译: {原文}]`

**JIRA 描述格式（不可改）：**
```
h2. Timestamp / Precondition / Steps / Expected Result / Actual Result / Reproduce Rate / Recover Steps
```

## 功能验证要点

1. 单条创建：填写全字段 → 创建 → JIRA Issue 生成 + 附件上传 + 表单清空
2. 必填校验：留空 → 红色提示缺失项
3. 翻译链路：词典→在线→回退标记，三层都走一遍
4. 批量导入：xlsx/csv 上传 → 解析 → 批量创建 → 支持取消和重试
5. 配置管理：JIRA 连接测试 → Token 加密存储 → 页面刷新后恢复
6. PRD 转测试用例：上传文档/URL → AI 生成测试点 → 翻译 → 创建 Xray 用例

## PRD

完整产品需求文档在 `JIRA-缺陷自动创建工具-PRD.md`（16 个功能 F1-F16，18 个验收场景）。
