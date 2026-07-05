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
    │   ├── view.ts             ← 主视图：计时器 + GTD + Tasks（~800行）
    │   ├── data.ts             ← 数据层：vault .md 文件读写
    │   └── types.ts            ← 类型定义 + 预设配置
    ├── main.js                 ← 构建产物（也提交到 git，方便部署）
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
# 1. 构建
cd product\obsidian-plugin
npm run build

# 2. 部署到 Obsidian vault
Copy-Item "main.js","styles.css","manifest.json" "D:\obsidian\云枢的铃铛\.obsidian\plugins\tomato-life\" -Force
```

改代码后 `npm run build` + 复制 `main.js`。CSS 改了也要复制 `styles.css`。

### 插件架构要点

- **视图位置**：主编辑区标签页（像笔记），`workspace.getLeaf('tab')` 打开
- **启动行为**：`onLayoutReady` → `detachLeavesOfType` 清残留 → `activateView` 新开
- **设置面板**：日志导出路径（默认 `Pomodoro Logs/`），Obsidian 设置 → Pomodoro 中修改

### 数据持久化

| 数据类型 | 文件 | 写入时机 |
|---------|------|---------|
| Session 日志 | `{exportPath}/YYYY-MM-DD.md` | Focus 完成自动追加 |
| GTD Board | `{exportPath}/GTD Board.md` | 每次操作全量覆写 |
| Tasks | `{exportPath}/Tasks.md` | 每次操作全量覆写 |
| 已完成任务/GTD | `{exportPath}/YYYY-MM-DD.md` | 完成时追加到当日日志 |
| 插件设置 | `data.json`（Obsidian 原生） | 设置变更时 |

### 双向同步（轮询）

`view.ts` 每 2 秒检查 Tasks.md 和 GTD Board.md 的内容指纹（全文比对），有变化即重新解析刷新界面。`writing` 标志防止插件自身写入时误触发。

**关键**：`onClose()` 不保存——每次用户操作已即时保存，避免覆盖外部编辑（AI/手动）。

### CSS 规则

- 所有选择器 `.tomato-life-view` 根作用域 + `tl-` 前缀
- CSS 变量 `--tl-accent` 动态切换主题色
- 主编辑区宽度 **480px**（与 pomofocus.html 原版一致）
- **必须有按钮全局重置**，否则 Obsidian 主题覆盖样式：

```css
.tomato-life-view button {
  -webkit-appearance: none; box-shadow: none; letter-spacing: normal;
  text-transform: none; background-image: none;
}
```

与 pomofocus.html 的样式必须严格一致：**只改选择器前缀，不改任何 px 值**。

### 关键约束

- **`onClose()` 必须 `clearInterval(this.iv) + stopPolling()`**，否则计时器泄漏
- **`ensureFolder()` 不能删**——所有文件写入依赖它创建目录，删了则全部保存静默失败
- **GTD 输入行是列体兄弟元素**，`renderGtd()` 只改 `innerHTML` 不碰输入行
- **GTD 跳转约束**：只有 NEXT ACTIONS 的 [Do] 可进入 DOING
- **构建产物 CJS**（`format: "cjs"`），`external: ["obsidian"]`
- **`containerEl.children[1]`** 是 Obsidian 视图的实际内容容器
- **任务完成行为**：点 ✓ 立即从 Tasks.md 移除，追加到当日日志 `## Completed Tasks`

### 编辑致命陷阱

**view.ts 极易被 edit 工具截断**——文件 ~800 行且有大量重复模式（`});`、`}\n  }\n\n` 等）。编辑时必须：
1. 用**极短且绝对唯一**的字符串做 oldString（如 `if (this.subMode === 'focus')`）
2. 每次只改一处，改完就构建验证
3. 如果截断了，`git checkout HEAD -- product/obsidian-plugin/src/view.ts` 恢复

## v1.0 遗留代码（不要碰）

- `packages/server/` · `packages/client/` · `docs/api/` · `docker-compose.yml`

**除非用户明确说要改，永远无视这些目录。**
