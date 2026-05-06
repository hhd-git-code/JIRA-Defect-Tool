# JIRA 测试工具

车载信息娱乐系统（IVI）测试团队使用的 Tauri v2 桌面工具。三大核心功能：中文填写缺陷 → 自动翻译 → 一键创建 JIRA Issue；PRD 文档 → AI 生成测试点 → 创建 Xray 测试用例；ADB 测试命令（截图/录屏/投屏/Logcat 一站式证据收集）。

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
├── pages/                    # 页面
│   ├── defect-form.tsx       # 缺陷录入
│   ├── batch-guide.tsx       # 批量创建向导
│   ├── prd-test-case.tsx     # PRD 转测试用例
│   ├── adb-commands.tsx      # ADB 命令（设备/截图/录屏/投屏/Logcat）
│   └── settings.tsx          # 设置页（JIRA/翻译/AI/Xray 配置）
├── components/               # 可复用组件
│   ├── defect-fields.tsx     # 缺陷表单字段
│   ├── attachment-upload.tsx # 附件上传
│   ├── import-upload.tsx     # Excel/CSV 导入
│   ├── translate-preview.tsx # 翻译预览弹窗
│   ├── batch-progress.tsx    # 批量创建进度
│   ├── result-panel.tsx      # 创建结果展示
│   ├── jira-config-form.tsx  # JIRA 配置表单
│   ├── save-template-modal.tsx  # 缺陷模板保存弹窗
│   ├── template-manager.tsx  # 缺陷模板管理组件
│   ├── prd-upload.tsx        # PRD 文档上传
│   ├── test-point-editor.tsx # 测试点编辑器
│   ├── test-case-translate.tsx # 测试用例翻译
│   └── test-case-create.tsx  # 测试用例创建
├── stores/                   # Zustand stores
│   ├── config-store.ts       # 全局配置（JIRA/翻译/AI/Xray）
│   ├── defect-store.ts       # 缺陷表单状态
│   ├── batch-store.ts        # 批量创建状态
│   └── prd-store.ts          # PRD 转测试用例状态
├── services/                 # 业务逻辑
│   ├── jira-api.ts           # JIRA/Xray REST API 调用
│   ├── translate-engine.ts   # 三层翻译引擎（词典→在线API→回退标记）
│   ├── ai-service.ts         # AI 服务（Claude/OpenAI/DeepSeek）
│   ├── ai-parser.ts          # AI 响应解析
│   ├── document-parser.ts    # 文档解析（Word/PDF/MD）
│   ├── table-parser.ts       # Excel/CSV 解析
│   ├── adb-service.ts        # ADB 命令封装（设备/截图/录屏/Logcat）
│   ├── test-case-translate.ts # 测试用例翻译服务
│   ├── dict-service.ts       # 自定义词典服务
│   └── validation.ts         # 表单校验
├── types/                    # 类型定义：config, defect, jira, template, test-case
├── constants/                # 常量映射：priority, reproduce-rate, column-mapping
├── hooks/                    # use-tauri-drag-drop
└── utils/                    # format-description, format-test-case-description, file-helper 等

src-tauri/                    # Rust 后端
├── src/
│   ├── lib.rs                # Tauri 命令注册入口 + RunningProcesses 状态管理
│   ├── commands/
│   │   ├── jira.rs           # JIRA REST API（创建/附件/连接测试/Xray）
│   │   ├── ai.rs             # AI 流式/非流式调用 + URL/Confluence 抓取
│   │   ├── adb.rs            # ADB 命令（设备/截图/录屏/投屏/Logcat/按键）
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
- Rust 后端负责：加密解密（crypto.rs）、AI 流式调用（ai.rs）、JIRA 附件上传（jira.rs）、ADB 进程管理（adb.rs）、HTML 内容提取（html.rs）
- 所有需要绕过 CSP 的网络请求走 Tauri command，不走前端 fetch

**ADB 进程管理（adb.rs）：**
- `RunningProcesses` 用 `Mutex<HashMap<String, Child>>` 管理录屏/logcat 子进程
- record_id 格式带文件路径，停止时自动回收进程并返回文件路径
- Logcat 通过 Tauri event `adb-logcat` 流式推送行数据到前端
- 录屏停止用 SIGINT（Unix）让 scrcpy 正常收尾写入 mp4

**缺陷模板（Zustand + localStorage）：**
- 缺陷表单 9 个字段可保存为模板，快速复用
- 模板数据通过 Zustand persist middleware 持久化

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
7. ADB 命令：设备列表/连接/Root → 截屏→录屏→投屏→Logcat 抓取→按键模拟
8. 缺陷模板：保存表单为模板 → 模板管理（CRUD）→ 一键应用填充表单

## PRD

完整产品需求文档在 `JIRA测试工具-PRD.md`（F1-F18 共 18 个功能，含 ADB 命令 F17 和模板管理 F18）。
