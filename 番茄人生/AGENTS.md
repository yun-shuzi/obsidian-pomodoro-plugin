# 番茄人生 (Tomato Life) — Agent Guide

## 项目定位

GTD 思维框架 × 番茄钟 — Obsidian 插件。四列看板（CAPTURE → CLARIFY → NEXT ACTIONS → DOING）引导认知加工，番茄钟执行，Session 日志直接写入 vault .md 文件供 Agent 读取分析。

## 当前架构

```
product/
├── pomofocus.html              ← 独立 HTML 原型（功能完整，保留维护）
└── obsidian-plugin/            ← ★ 当前主产品：Obsidian 插件
    ├── src/
    │   ├── main.ts             ← 插件入口（注册视图、Ribbon 图标、设置面板）
    │   ├── view.ts             ← 主视图：计时器 + GTD + Tasks（~500行）
    │   ├── data.ts             ← 数据层：vault .md 文件读写
    │   └── types.ts            ← 类型定义 + 预设配置
    ├── styles.css              ← 全部样式（.tomato-life-view 作用域隔离）
    ├── manifest.json           ← Obsidian 插件清单
    └── esbuild.config.mjs      ← 构建脚本

packages/                       ← ⚠️ v1.0 遗留（AI 角色养成），已废弃但保留
├── server/          Fastify + Drizzle + PostgreSQL + DeepSeek LLM
└── client/          Expo React Native（空壳）

docs/
├── PRD.md                   ← v2.0 产品需求文档
├── api/                     ← Bruno 请求文件（v1.0）
└── 历史/                   ← v1.0 原始 PRD、测试记录
```

## 插件开发

### 构建 & 部署

```powershell
# 1. 构建（在插件目录执行）
cd product\obsidian-plugin
npm run build

# 2. 部署到 Obsidian vault
Copy-Item "main.js","styles.css","manifest.json" "D:\obsidian\云枢的铃铛\.obsidian\plugins\tomato-life\" -Force
```

每次改代码后只需 `npm run build` + 复制 `main.js`（CSS 和 manifest 一般不改）。

### 插件架构要点

- **视图位置**：主编辑区标签页（像笔记一样），通过 `workspace.getLeaf('tab')` 打开
- **Ribbon 图标**：左侧竖条上的 `timer` 图标，点击 `activateView()`
- **设置面板**：日志导出路径（默认 `Pomodoro Logs/`），在 Obsidian 设置 → 番茄人生中修改
- **启动行为**：`onLayoutReady` 时自动 `detachLeavesOfType` 清残留 → `activateView` 新开

### 数据持久化（方案 A：vault .md）

| 数据类型 | 文件 | 写入时机 |
|---------|------|---------|
| Session 日志 | `{exportPath}/YYYY-MM-DD.md` | 每次 focus 完成自动追加 |
| GTD Board | `{exportPath}/GTD Board.md` | 每次操作全量覆写 |
| Tasks | `{exportPath}/Tasks.md` | 每次操作全量覆写 |
| 插件设置 | `.obsidian/plugins/tomato-life/data.json` | Obsidian 原生 API |

### CSS 规则

- 所有选择器必须以 `.tomato-life-view` 为根作用域（`styles.css`）
- CSS 变量：`--tl-accent` 动态切换主题色（红/青/蓝/紫）
- 主编辑区宽度 580px（非原版 480px——主编辑区更宽）

### 计时器引擎（view.ts）

状态变量与 `pomofocus.html` 完全对应：

| 属性 | 用途 |
|------|------|
| `preset` | `'25/5'` / `'52/17'` / `'90'` / `'custom'` |
| `subMode` | `'focus'` / `'break'` / `'break-long'` |
| `sec` | 剩余秒数 |
| `run` | 计时器运行中？ |
| `round` | 25/5 四轮计数（%4===0 → long-break） |
| `pomodoroCount` | 当日番茄数（驱动点阵，独立于 round） |
| `pomodoroItems` | GTD 条目 `{id, text, col}` → vault `GTD Board.md` |
| `tasks` | 任务 `{id, text, est, done}` → vault `Tasks.md` |
| `sessions` | Session `{start, end, duration, preset, task}` → vault 每日日志 |

### 关键约束

- **`onClose()` 必须 `clearInterval(this.iv)`**，否则计时器泄漏
- **GTD 输入行是列体兄弟元素**，`renderGtd()` 只改 `innerHTML` 绝不触碰输入行 DOM
- **GTD 跳转约束**：只有 NEXT ACTIONS 的 [Do] 才能进入 DOING
- **构建产物是 CJS**（`format: "cjs"`），`external: ["obsidian"]`
- **`containerEl.children[1]`** 是 Obsidian 视图的实际内容容器

## v1.0 遗留代码（不要碰）

- `packages/server/` — 后端 API（25 端点，角色养成系统）
- `packages/client/` — Expo App（角色创建流程）
- `docs/api/` — Bruno 测试文件
- `docker-compose.yml` — PostgreSQL + Redis + MinIO

**除非用户明确说要改 v1.0 的代码，否则永远无视这些目录。** 当前只在 `product/` 下工作。

## pomofocus.html 修改原则

此文件极易因编辑而损坏。**每次修改只动三处**：HTML 对应区域、CSS 样式块、JS 逻辑。不要多改。
