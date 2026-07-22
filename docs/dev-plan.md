---
name: Workbench development plan
overview: 基于代码现状的全面开发计划：4 阶段（债清理 → 壳层一致性+Terminal/Changes → 垂直闭环 → 架构债+测试网），从 P0 债清理开始执行。
isProject: false
---

# 开发计划：Workbench 优化、重构与功能补齐

> 配套审计见 [docs/newtask.md](docs/newtask.md)。本文档为可执行计划，按 90 天 / 4 阶段推进。
> 代码现状已逐项验证（grep + 文件读取），非纸上推演。

---

## 阶段总览

| 阶段 | 周次 | 主题 | 对应优先级 | 产出 |
|------|------|------|-----------|------|
| 1 | W1–2 | 债清理 + 文档修正 | P0 | 壳可信、文档不骗人、typecheck/lint/test 全绿 |
| 2 | W3–6 | 壳层一致性 + Changes/Terminal | P1 + P2 | Agents/Sites「能改能跑」 |
| 3 | W7–10 | 垂直闭环（Workflow runner **或** Knowledge MVP，择一深挖） | P2 | 一个新垂直真正闭环 |
| 4 | W11–12 | 架构债 + 测试网 | P3 | 可维护、可演进 |

每阶段独立可合、可回滚；结束门槛统一为 `typecheck + lint + test` 全绿。

---

## 阶段 1 — 债清理 + 文档修正（P0，约 2 周）

目标：无行为变更的删除 / 修正，让代码与文档一致、CI 全绿。

### 1.1 删死代码
- [x] 删 `apps/electron/src/renderer/workbench/modules/rss/mock/`（types.ts/data.ts 零引用）
- [x] 删 `packages/shared/src/feature-flags.ts` 的 `isWorkbenchShellEnabled()` + `FEATURE_FLAGS.workbenchShell`，并删其测试 `packages/shared/src/__tests__/feature-flags.test.ts` 中对应用例（renderer 已有恒 `true` 的 `workbench/feature.ts` shim，shared 版仅被自身测试引用）
- [x] 删 `App.tsx` 传给 `WorkbenchShell` 的 `menuNewChatTrigger` / `isFocusedMode` 死 props（`WorkbenchShellProps` 中仅被声明、未使用）；保留 `TopBar` 共享 `onToggleFocusMode` 契约
- [x] Focus mode 死路径收口：`WorkbenchTopBar` 的 `onToggleFocusMode` noop 改为真实切换 ActivitySidebar 可见性；`App.tsx` 菜单 New Chat 改走 `handleCreateSession`（write-only state 已删）

### 1.2 文档漂移修正
- [x] 8 个 `workbench-*.md` 删除 `GROSE_FEATURE_WORKBENCH_SHELL` 启用流程（flag 已删）：`workbench-architecture.md` `workbench-rss-ui.md` `workbench-sites-ui.md` `workbench-workflows-ui.md` `workbench-automations-ui.md` `workbench-tables-ui.md` `grose-tables-sidecar.md` `grose-modules-sidecar.md`
- [x] 修 `workbench-architecture.md` 的 "RSS | UI mock (no RPC)" → 标注为 live（接 sidecar），与 `workbench-rss-ui.md` 自洽
- [x] 修 `grose-modules-sidecar.md`：删除 "RSS UI mock" / "editor shell (mock until RPC)" 等过时措辞；更新 Sites/Workflows 已实现状态；修正 Knowledge 表述（仅规划、无实现）
- [x] 更新 `README.md` 架构章节：补 `services/grose-modules`、`packages/domain-*`、`packages/server-core`、Workbench 壳说明

### 1.3 完成 remove-app-shell DoD
- [x] `bun run typecheck`（apps/electron）→ **0 errors**（含修掉 3 处预存 typecheck 错误：AppearanceSettingsPage、VoiceSettingsPage、sites 测试路径；以及 datagrid `column-form.tsx` 的 RHF TS2589 深度实例化根因——`CellSelectOption.icon?: React.FC` 触发，改用 `Omit<CellSelectOption,'icon'>` 后消除）
- [ ] `bun run lint`（apps/electron）→ 16 errors **全部为预存**（shadow 类 / no-direct-file-open），不在本次改动文件；留待独立的 shadow 清理 PR，不阻塞 P0
- [x] `bun test` → 修复的 `feature-flags.test.ts` / `site-data-api.test.ts` 全绿

---

## 阶段 2 — 壳层一致性 + Changes/Terminal（P1 + P2，约 4 周）

### 2.1 布局单一真相
- [x] 统一 Agents 默认布局：删 `presets.ts` 的 `agentsDefaultLayout()` + `LayoutPresetId 'agents-default'` + `AGENTS_DEFAULT_RATIOS`，Agents 模块改用自身 inline 2 列布局（session-list 在 activityView）；`DockviewHost` 回退改 `agentsFocusLayout()`；`index.ts`/`constants.ts` 已去除死导出
- [x] 废弃 `constants.ts` 的 `rss-feeds` 遗留列：移 `PANEL_DEFS['rss-feeds']`、`rss/index.tsx` 冗余 `rss-feeds` 面板注册、`persistence.ts` rss markers、`DockviewHost` 回退、`persistence.test.ts` 用例（feeds 已在 activityView，dock 无需重复）

### 2.2 壳层能力回填
- [x] **Git RPC 全链路**：加 `git:getStatus` / `git:getDiff` / `git:getFileContents`（channels.ts → system.ts handler+CORE_HANDLED_CHANNELS → channel-map.ts → types.ts）
- [x] **Shell RPC 全链路**：加 `shell:runCommand`（channels.ts → system.ts handler+CORE_HANDLED_CHANNELS → channel-map.ts `runCommand` → types.ts `runShellCommand(cwd,command)`）
- [x] **共享 Changes + Terminal 面板**：新建 `modules/agents/panels/changes-panel.tsx`（`ChangesPanel({cwd})`，列文件+选文件看 diff）、`terminal-panel.tsx`（`TerminalPanel({cwd,initialCommand?})` 非交互 run-console）；Agents `changes`/`terminal` 与 Sites `sites-changes`/`sites-terminal` 接真实组件（cwd 分别取 `useAppShellContext.rootPath` 与 `selectedSiteAtom.path`），`sites-vscode` 走 `code .`
- [x] **Focus mode 落地**：`view.toggleFocusMode`（`mod+.`）真实隐藏 ActivityBar + ActivitySidebar（`workbench-store.ts` 新增独立 `focusModeAtom` 持久化到 `focusModeEnabled`；`WorkbenchTopBar` 接 `toggleFocusMode`，`WorkbenchShell` 按 `focusModeAtom` 隐藏左右栏）。不与模块侧栏偏好冲突。
- [x] **SessionList 能力回填**：`session-list-panel.tsx` 复用共享 `SessionList` 组件，接入 `sessionMetaMapAtom` + `AppShellContext` 回调，支持搜索 / 分组(date|status|unread) / 标签筛选 / 状态筛选 / 归档·取消归档 / 多选 / 重命名 / 删除 / 标记未读。archived 视图切换按钮 + 搜索按钮置于 ActivityShell 头。

### 2.3 契约决策
- [x] `WorkbenchModule.commands?: CommandContribution[]`（`registry/types.ts`）：零实现零读取 → 已删除契约收窄面（无模块提供 `commands`；`CommandContribution` 类型保留备用）

---

## 阶段 3 — 垂直闭环（P2，择一深挖，约 4 周）

### 路线 A：Workflow runner 最小可用
- [x] 打通 Go `wf_run`（stub）→ 委托 `server-core` Grose 执行器跑 agent 节点（真实执行路径）：`right-panel.tsx` Run → `runWorkflowViaRpc` → `window.electronAPI.workflowsRun` → `workflows-run.ts` → `execute-workflow-run.ts`（真实 agent 执行）；`normalizeRunSteps` 有真值走真值否则回退合成。
- [x] schedule / webhook trigger 真正开火（当前仅「武装」不跑）：
  - Electron main 进程新增 `apps/electron/src/main/workflow-trigger-scheduler.ts`（`createWorkflowTriggerScheduler`），含最小 5 字段 cron matcher、schedule 轮询（默认 30s，按分钟去重防双发）、webhook `handleWebhook`（`/hooks/*` 按 path+method 匹配）；`arm` 仅收集 `status:'deployed'` 的 schedule/webhook 节点。
  - `SessionManager` 新增 `getRpcServer()` getter（`packages/server-core/src/sessions/SessionManager.ts`），调度器经 `opts.getRpcServer()?.invoke('workflows:run', wsId, wfId)` 进程内触发，复用既有 `workflows:run` handler 真实执行。
  - 在 `apps/electron/src/main/index.ts` 接入：bootstrap 前创建 scheduler（惰性 `getRpcServer`）、将其 `handleWebhook` 作为 `httpHandler`（`/hooks/*` 路由）挂在 `bootstrapServer` 的 HTTP 表面、bootstrap 后 `start()`、`before-quit` 时 `stop()`。
  - `WsRpcServer`（`packages/server-core/src/transport/server.ts`）补 `invoke` 方法 + `RpcServer` 接口加 `invoke`，供进程内直接派发已注册 handler（合成 root ctx）。
  - 单测 `apps/electron/src/main/__tests__/workflow-trigger-scheduler.test.ts`（4 pass：armed 收集 / cron 命中 / 同一分钟不双发 / webhook 匹配+404）。
- [x] 统一 Automations Rules 与 Flows 调度双轨（共享触发抽象 + cron 一致，见 `workbench-automations-ui.md`）：
  - 新增共享触发类型 `packages/shared/src/automations/trigger-types.ts`：`Trigger`/`ScheduleTrigger`/`WebhookTrigger`/`TriggerKind`/`HttpMethod` + `toScheduleTrigger(matcher)`（把 Rules 的 `AutomationMatcher.cron/timezone/enabled` 投影成 `ScheduleTrigger`，非 schedule 返回 `null`）；从 `packages/shared/src/automations/index.ts` 导出。
  - **cron 一致**：Flows 调度器原本自带 UTC-only 的 `cronMatches`（`getUTC*` 硬编码），Rules 走 `croner`（时区感知）。现已删除 Flow 的重复 matcher，改用 `croner` 的 `Cron(expr,{timezone}).match(date)`（接受注入时钟，单测友好），两轨统一为同一 cron 库 + 同一时区语义。`ArmedTrigger` 新增 `timezone?`，从 schedule 节点 `config.timezone`（默认 UTC）读取。
  - `ArmedTrigger` 字段（`cron`/`timezone`/`path`/`method`）与共享 `ScheduleTrigger`/`WebhookTrigger` 对齐；`AutomationMatcher.cron/timezone` 注明即 Rules 侧的 `ScheduleTrigger` 表示。
  - 单测补 `honors the schedule node timezone` 一条（9:00 America/New_York == 14:00 UTC 命中、同样 UTC 瞬时在 UTC 时区不命中），共 5 pass。`shared` 与 `electron` typecheck 均 0 errors。
- [x] 共享 Runs 历史（后端持久化 + 读取 RPC + 渲染面板）：
  - 新增 `workflows:getHistory` 通道（`packages/shared/src/protocol/channels.ts`），`domain-rpc.ts` 的 `HANDLED_CHANNELS` 同步登记（无 sidecar 时转发）。
  - 复用 Automations Rules 的同一份 `automations-history.jsonl` 存储：`workflows-run.ts` 的 `workflows:run` handler 在成功/失败分支各写一条 `kind:'flow'` 历史条目（`createFlowHistoryEntry`，含 `id=workflowId`/`runId`/`ok`/`summary`/`stepCount`/`error`），经 `getWorkspaceByNameOrId(wsId).rootPath` 落盘；自动开火（schedule/webhook 也走 `workflows:run`）天然入库，调度器无需改动。
  - 新增 `workflows:getHistory` handler（镜像 `automations:GET_HISTORY`），按 `id===workflowId` 过滤并只认 `kind:'flow'`，返回最近 N 条（默认 20，受 `AUTOMATION_HISTORY_MAX_RUNS_PER_MATCHER` 约束）。
  - 渲染侧：ElectronAPI 新增 `getWorkflowHistory`（`channel-map.ts` + `shared/types.ts`），`use-workflow-data.ts` 新增 `getWorkflowHistoryViaRpc` + `toFlowRunEntries`；`right-panel.tsx` 新增 `Runs` 标签页（icon `History`），渲染新组件 `flow-runs-timeline.tsx`（`FlowRunsTimeline`，状态图标 + 相对时间 + summary + runId + error）。手动/自动触发的 Runs 都在此汇聚。
  - 后端单测 `workflows-run.test.ts`（4 pass：成功写条目 / 失败写条目 / getHistory 命中 / getHistory 隔离其他 id）。`shared`/`server-core`/`electron` typecheck 均 0 errors（server-core 仅余预存 `execute-workflow-run.test.ts` 缺字段一处）。

### 路线 B：Knowledge MVP
- [ ] Go sidecar 新增 `internal/knowledge`（存储 + 索引）
- [ ] `domain-knowledge` 补全 RPC 通道（browse / search / ingest），摆脱仅 ping
- [ ] Workbench `knowledge/` 三面板（kb-browse / kb-doc / kb-search）从 Placeholder 接真实数据
- [ ] 若暂不深挖：从 ActivityBar 隐藏空壳避免噪音

> 阶段 3 开始时二选一，避免两条半截。

---

## 阶段 4 — 架构债 + 测试网（P3，约 2 周）

### 4.1 命名与抽取
- [x] 重命名 `packages/server-core/src/handlers/rpc/domain-stubs.ts` → `domain-rpc.ts`（实际挂载全部 domain RPC handler，非仅 stub，命名误导）；同步改名导出函数 `registerDomainStubHandlers` → `registerDomainRpcHandlers`；更新 `rpc/index.ts`、`domain-workflows/src/index.ts` 注释、`apps/electron` 两处注册测试的动态 import 路径；删除残留空目录 `domain-stubs/`。`server-core` typecheck 无新增错误。
- [ ] 抽 `packages/shared/src/interceptor-common.ts` → `server-core`：**取消**。原计划"仅 `server-core/SessionManager.ts` 单消费者"的前提已不成立——实际 `interceptor-common.ts` 不被 server-core 引用，反而被 `packages/shared` 内 ~10 个模块消费（`unified-network-interceptor`、`agent/*`、`validation/url-validator` 等）。抽到 server-core 会破坏整个 shared 的 agent/interceptor 层。文件留在 `shared` 位置合理。

### 4.2 测试网
- [x] 四大 domain 包补 smoke 测试（每通道断言注册 / 转发）：`packages/{domain-rss,domain-sites,domain-workflows,domain-knowledge}/src/__tests__/rpc.test.ts`（共 12 pass）。断言：① 每个 `RPC_CHANNELS.<domain>` 通道都注册为 function 且齐全（重构漏通道立即红）；② ping 走 sidecar 包裹（无 sidecar 时 catch 返回 `{ok:false,domain}`，knowledge 骨架返回 `{ok:true}`）；③ 代表性代理通道（rss.listFeeds / sites.list / workflows.list）调用即转发到 grose-modules（无 sidecar 时 reject，证明转发接线）。避开 `mock.module`（bun 跨文件泄漏），改用「无 sidecar 下的 catch / reject」信号验证转发。各包补 `"test": "bun test src"` 脚本。`typecheck` 四包均绿。
- [ ] `packages/core`、`open-connector-client`、`session-mcp-server` 补基础测试（当前 0 测试）

### 4.3 对称与去留
- [ ] Claude / Pi 能力对称：interceptor / rich tool intent（Claude 侧因 native binary 丢失，需 hooks / 代理路径）
- [ ] Playground 去留（refactor 文档 D1）：删或收尾重定向
- [ ] `packages/shared` 拆分预案文档（113k LOC，`agent` 占 38%；等大拆成本高，先出设计再等 KB/Workflow 边界清晰）

---

## 不建议现在做
- 再引入第二套 UI 壳或回退 AppShell
- 把导航列表全部塞回 dock（失去稳定 chrome）
- 大拆 `shared` 包（等阶段 3 边界清晰后再切）

## 关键文件锚点
- 壳：`WorkbenchShell.tsx` `ActivitySidebar.tsx` `ActivityShell.tsx` `WorkbenchTopBar.tsx`
- 注册：`modules/index.ts` `registry/types.ts` `registry/module-registry.ts`
- 布局：`dock/layout-manager/`（presets.ts / constants.ts / persistence.ts）
- 迁移记录：`docs/refactor-remove-app-shell.md`
- Sidecar：`services/grose-modules`（httpapi.go / workflows/handler.go / sites/handler.go）
- 文档漂移：`docs/workbench-*.md` `docs/grose-modules-sidecar.md` `README.md`
