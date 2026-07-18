# 重构计划：移除 `app-shell`，以 `workbench` 为唯一 UI 主线

> 目标：确认 `workbench` 为产品方向后，清理老的 `components/app-shell` 三栏 chat shell，
> 把其中真正被复用的"共享组件"迁移到合理的目录，删除只服务于旧 shell 的"框架残骸"，
> 并最终移除 `GROSE_FEATURE_WORKBENCH_SHELL` 双 shell 开关与死代码。

---

## 0. 背景与现状（关键发现）

经代码分析，`apps/electron/src/renderer` 当前有 **两套 UI 主线并存**：

- **老主线（待清理）**：`components/app-shell/AppShell.tsx`（3911 行）+ `App.tsx`（2282 行）
  构成的三栏 chat IDE。
- **新主线（方向）**：`workbench/`（`WorkbenchShell` + `modules/*` + `registry`），
  dock 式可拖拽面板，由 `isWorkbenchShellEnabled()` 开关控制。

`App.tsx:2096-2109` 当前仍按开关二选一渲染：

```tsx
) : isWorkbenchShellEnabled() ? (
  <WorkbenchShell contextValue={appShellContextValue} ... />
) : (
  <AppShell contextValue={appShellContextValue} ... />
)}
```

### 关键认知：`app-shell` 是「框架」与「共享组件」的混合体

`app-shell` 并不仅是旧 shell 的框架。经依赖图扫描（见下），**workbench 模块与多个页面已经在复用 `app-shell` 里的组件**：

- `workbench/modules/skills/index.tsx` → `SkillsListPanel`
- `workbench/modules/sources/index.tsx` → `SourcesListPanel`
- `workbench/shell/WorkbenchTopBar.tsx` → `TopBar`
- `pages/ChatPage.tsx` → `ChatDisplay` / `SessionMenu` / `CompactSessionMenu` / `SessionInfoPopover` / `PanelHeader`
- 12+ 个 settings / info 页面 → `PanelHeader`
- `App.tsx` → `TransportConnectionBanner`
- `components/automations/AutomationsListPanel.tsx` → `SessionSearchHeader` / `SendResourceToWorkspaceDialog`
- `playground/registry/*` → `ChatDisplay` / `SessionList` / `kanban/*` / `input/*` 等

因此 **"清理 app-shell" ≠ "删除 app-shell 目录"**。真正的任务分两步：
1. 把被复用的共享组件**迁到合理目录**；
2. 删除仅服务于旧三栏布局的**框架残骸**。

### 依赖图结论（107 个文件中）

- **有外部引用、必须保留/重定位的**：37 个文件（含其测试）。
- **仅 `app-shell` 内部互相引用、可删除的**：约 70 个文件（含 `__tests__`）。
- `WorkbenchShell` **确实使用** `contextValue`（透传给 `WorkspaceDataProvider`），
  故 `appShellContextValue` 这一"应用级上下文"不能删，只能改名去 `AppShell` 前缀。

---

## 1. 风险与回滚策略

- **每阶段独立可合、可回滚**：Phase 1 仅切换默认开关，旧 shell 代码仍在，出问题可瞬间切回。
- **保留 `localStorage` / env 覆盖**：`isWorkbenchShellEnabled()` 的 localStorage 与
  `GROSE_FEATURE_WORKBENCH_SHELL` 覆盖在 Phase 5 之前**全部保留**，便于灰度与回退。
- **不删测试**：随组件一起迁移测试，保证覆盖率不降。
- **验收门槛**：每个 Phase 结束后必须 `typecheck + lint + test` 全绿。

---

## 2. 分阶段实施计划

> **实施记录（已执行）**：以下 Phase 0–5 已全部执行（2026-07-17）。
> 与原始计划的两处偏差已在文末「实施偏差」说明。

### Phase 0 — 准备与命名约定（无行为变更）
- 确认落点：`components/chat/`（仅 2 文件）、新建 `components/kanban/`、`components/sessions/`、
  `components/composer/`、`components/lists/`、`components/shell/`。
- 命名约定：**保留 `context/AppShellContext` 及其类型名**（见实施偏差 D-A）；
  其它仅做文件级迁移，不做大规模重命名（`appShellContextValue` 等保留原命名，
  避免 ~40 处无谓改动与风险）。

### Phase 1 — 翻转默认 shell（保留旧代码，仅切换入口） ✅ 完成
- `workbench/feature.ts`：`isWorkbenchShellEnabled()` 默认返回 `true`
  （localStorage/env 覆盖逻辑在 Phase 5 前保留）。
- `vite.config.ts`：`GROSE_FEATURE_WORKBENCH_SHELL` define 默认由 `''` 改为 `'1'`。
- 暂不删除 `AppShell` 分支。

### Phase 2 — 迁移共享组件（重定位 + 更新引用） ✅ 完成
通过脚本（`git mv` 保留历史）+ 全量 import 重写执行：
- `PanelHeader.tsx` → `components/ui/panel-header.tsx`
- `ChatDisplay*` / `Session*` / `branching` / `error-message-actions` / `plan-approval-message`
  / `ActiveOptionBadges` / `ActiveTasksBar` / `AttachmentPreview` / `SetupAuthBanner`
  → `components/sessions/`
- `input/*`（含 `structured/`）→ `components/composer/`
- `kanban/*` → `components/kanban/`
- `SkillsListPanel` / `SourcesListPanel` → `components/lists/`
- `SkillMenu` / `SourceMenu` → `components/info/`
- `TopBar.tsx` → `components/shell/top-bar.tsx`
- `TransportConnectionBanner.tsx` → `components/TransportConnectionBanner.tsx`
- `SendResourceToWorkspaceDialog.tsx` → `components/automations/`
- `panel-constants.ts` → `components/sessions/panel-constants.ts`
- 相应 `__tests__` 一并迁移到新目录。
- 全量重写 `@/components/app-shell/...` 别名引用（含相对 `../app-shell/...` 引用），
  并修复 `playground`、`components/ui` 中的相对引用。

### Phase 3 — 删除旧 shell 框架残骸 ✅ 完成
- `git rm -r components/app-shell`（删除 AppShell.tsx、LeftSidebar、MainContentPanel、
  NavigatorPanel、PanelStackContainer、Panel*、FabNewChat、SidebarMenu、WorkspaceSwitcher、
  ProjectsListPanel、BatchSessionMenu、Compact*、SendToWorkspaceDialog、sidebar-types、
  BackgroundFinishedChip 等所有仅旧壳使用的文件）。
- `App.tsx`：删除 `import { AppShell }` 与 `AppShell` 渲染分支，仅保留 `WorkbenchShell`。
- **保留 `context/AppShellContext.tsx`**（它是应用级 context，被 ~40 个组件使用，非壳专属）。

### Phase 4 — 清理 playground 对旧壳的引用 ✅ 完成（重定向方案）
- 采用「保留并重定向」：Phase 2 的 import 重写已把 playground 的引用指向
  `components/sessions`、`components/composer`、`components/kanban` 等新位置。
- 若后续决定删除 playground，再移除 `playground.html` 入口与 `vite.config.ts` 对应 input。

### Phase 5 — 移除 feature flag 与死代码 ✅ 完成
- `workbench/feature.ts`：`isWorkbenchShellEnabled()` 直接 `return true`，
  删除 env/localStorage 双路径逻辑（保留 `setWorkbenchShellEnabled` 导出以稳定 API）。
- `vite.config.ts`：移除 `GROSE_FEATURE_WORKBENCH_SHELL` define。
- `App.tsx`：`activeModuleId` 调用由三目简化为 `store.get(activeModuleIdAtom)`，
  删除未使用的 `isWorkbenchShellEnabled` import。

---

## 实施偏差（与原计划的重要差异）

- **D-A（关键）**：原计划 Phase 0/3 要将 `context/AppShellContext.tsx` 改名并删除
  `AppShellProvider`/`useAppShellContext`。**执行中发现该 context 是应用级 context**，
  被 `pages/ChatPage`、`workbench/modules/*`、`components/ui/panel-header`、`playground`
  等约 40 个组件通过 `useAppShellContext()` 使用（提供 `activeWorkspaceId`、
  `onCreateSession`、`workspaces` 等）。**它并非旧壳专属，必须保留**。
  因此保留 `context/AppShellContext.tsx` 及其命名；是否后续重命名为 `AppContext`
  属可选 cosmetic，不阻塞本次清理。
- **D-B**：Phase 2 的 import 重写覆盖了相对路径（`../app-shell/...`），原计划只考虑了
  `@/` 别名；已补修 `components/ui/EditPopover.tsx`、
  `components/ui/CompactWorkingDirectorySelector.tsx`、`playground/registry/edit-popover.tsx`。
- **D-C**：`panel-constants.ts` 被 `playground/registry/planner.tsx` 引用，原 Phase 2.7
  清单遗漏；已补迁至 `components/sessions/panel-constants.ts`。
- **D-D**：`app-shell/input/structured/` 子目录在首次脚本中未被递归移动，已补迁至
  `components/composer/structured/`。

---

## 3. 验收标准（Definition of Done）

- [x] `grep -rn "components/app-shell" src/renderer` 无结果（仅 `workbench/feature.ts` 注释）。
- [x] `GROSE_FEATURE_WORKBENCH_SHELL` 已从 `vite.config.ts` 移除；`isWorkbenchShellEnabled` 已简化为 `return true`。
- [x] `App.tsx` 只渲染 `WorkbenchShell`，无 `AppShell` 分支。
- [ ] `bun run typecheck`（apps/electron）通过 —— **待运行验证**（后台进行中）。
- [ ] `bun run lint`（apps/electron）通过 —— 待运行。
- [ ] `bun test`（apps/electron renderer 相关）通过，且测试数量不降 —— 待运行。
- [ ] `bun run dev` 与 `bun run build:renderer` 均成功，workbench 为唯一界面。
- [x] 共享组件（ChatDisplay、SessionList、kanban、composer、lists、PanelHeader 等）
      位于语义化目录，被 workbench / 页面 / playground 正确引用。

---

## 4. 开放决策点

- **D1（Phase 4）**：playground 保留并重定向，还是整体删除？
- **D2（Phase 2.2）**：会话/聊天气泡放 `components/sessions/` 还是并入现有 `components/chat/`？
  （当前 `components/chat/` 仅 2 个文件，建议新开 `components/sessions/` 保持清晰。）
- **D3（Phase 5）**：是否同步删除 `app-shell` 相关的 i18n key（仅旧壳文案）？
  建议保留未使用 key 由 lint:i18n 工具后续统一清理，本计划不处理。

---

## 5. 执行顺序建议

Phase 0 → 1（先切默认，快速见效、低风险）→ 2（分 2.1~2.7 小步迁移，每步绿）→
3（删框架）→ 4（playground）→ 5（去 flag）。

每个 Phase 单独 PR / commit，便于 review 与回滚。
