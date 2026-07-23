# Workbench Local Reader (RSS)

Live reading library for the Grose workbench shell. Backend is the **grose-modules** Go sidecar (RSS feeds / articles / star). UI follows a Local Reader layout: ActivityBar nav (全部 / 未读 / 收藏 / 历史 · 标签 · 订阅源) + Articles + Reader, with **AI Chat** docked via `openAgentChat({ placement: 'right' })`.

See [grose-modules-sidecar.md](./grose-modules-sidecar.md) for process / API / MCP boundaries.

## Packaging (A5)

```bash
# Host arch → services/grose-modules/bin + apps/electron/resources/grose-modules/
bun run build:grose-modules

# All Electron targets (darwin/linux/windows × amd64/arm64)
bun run build:grose-modules:all
```

`electron:build` / `electron:dist*` run `build:grose-modules` first and ship the binary via `extraResources` → `Grose Agents.app/.../Resources/grose-modules/`.

## How to open

1. Build once: `bun run build:grose-modules`
2. Start Electron (`bun run electron:dev`). Main process spawns `grose-modules` (or attach with `GROSE_MODULES_URL`).
3. ActivityBar → **Reader**. Dock preset: **Articles | Reader**.

If you previously hit `database is locked`, quit Grose and kill stale sidecars (`pkill -f grose-modules`) then restart so only one process holds the SQLite file.

## Regions

| Region | Panel | Role |
|--------|--------|------|
| Nav | `activityView` (FeedsPanel) | 全部 / 未读 / 收藏 / 历史, tags (local), subscriptions |
| Articles | `rss-article-list` | List with type filter, search, Latest/Digest |
| Reader | `rss-reader` | Body, 全文, favorite, unread/read, tags, AI summary, **划线点评** popup, analysis chips |
| AI | shared `chat` panel + Reader result panel (Actions) | Chat via **AI Chat** / ⌘K / escalate; chips & translate/rewrite → Module Action → result panel (see § AI) |

### Status model (local overlay)

| Dimension | Values | Notes |
|-----------|--------|-------|
| Read status | `unread` / `read` | Default `unread`. Opening an article marks `read`. |
| Favorite | starred (server) | Via `isStarred` / `rssToggleStar`. Independent of read status. |
| History | `lastViewedAt` | Auto browse history — articles the user has opened. |
| Underlines | `annotations[]` | Local 划线 / 点评 (quote + optional note), amber marks in body. |

Tags, status/history, and underlines live in `localStorage` (`grose-rss-local-reader-v3`) keyed by article id.

### Manage feeds

Feeds header **gear** opens Manage feeds: rename, delete, copy URL, and **Export** OPML (downloads `feeds.opml`). After rename/delete the UI calls `refreshRssData()`.

### Add feed / OPML import

Add (+) opens a dialog with tabs **RSS URL** | **OPML** | Markdown / File / Social (UI stubs until ingest APIs exist). OPML accepts file drop/picker or pasted XML.

### AI

Target model: **Module Actions** (silent UI tasks) on the shared Runtime + `grose-modules` MCP — not a separate Reader Agent stack. See [grose-modules-agent-routing.md](./grose-modules-agent-routing.md) §13. Renderer calls `window.electronAPI.moduleActionsRun(workspaceId, request)` → channel `moduleActions:run`.

**UX (current contract)**

- **Analysis chips** — 总结要点 / 结构拆解 / 事实清单 / 待验证点 / 反方观点 / 翻译 (+ more) → `moduleActionsRun` with action ids (`rss.translate`, `rss.summarize_bullets`, …) and `articleId` / `url` / title. **Auto-run**; hidden instruction stays off the Composer. Agent loads body via MCP (`rss_get_article`, then `rss_fetch_article_content` if truncated) — **never** paste the full article into the Action prompt when an id is available.
- **Result panel** — loading → markdown result → **复制** / **发给 AI · 继续讨论** (only then `openAgentChat` with a **short** reference — title, action, brief excerpt — not the internal MCP playbook).
- **Selection popup (划线)** — select body text → quote preview, optional note, **复制 / 发给AI / 划线/点评**; 翻译 / 中文改写 are selection-scoped Actions → same result panel. Underlines / 点评 stay local (amber marks); they do not force opening Chat. **发给AI** escalates a short quote seed only.
- **AI Chat** — docks the shared chat panel for open-ended questions or post-Action escalate, with `rss-article` / `activeModuleId: 'rss'` context.
- **选中文本 card** — after 发给AI / selection Action, a dismissible quote card may appear above the body.
- **⌘K** — Reader command palette (add, navigate, triage, summarize); **AI 总结** runs `rss.summarize_bullets` into the same result panel.
- **AI Summary** — “生成 AI 摘要” runs the summarize Action → result panel (and caches a short local summary card).

Action registry: `packages/shared/src/grose-modules/module-actions.ts`. Chip task ids map in `reading-assistant/reading-tasks.ts`.

### Podcast player

When an article has `audioUrl`, Reader shows a Play chip; the bottom bar supports play/pause, seek, ±15s, and speed.

### Full text (全文)

Reader toolbar **全文** calls `rssFetchArticleContent` → Go readability (`GET /api/rss/articles/fetch-content?url=`). Extracted HTML is shown in-session (not persisted); toggle restores RSS body. Local **Edit Markdown** can store a body override in the local overlay.

## Data path

`{rootPath}/modules/rss/rss.db` — see [workspace-storage.md](./workspace-storage.md).

Local reader meta: browser `localStorage` key `grose-rss-local-reader-v3`.

Pass `X-Grose-Workspace-Id` (+ optional `X-Grose-Workspace-Root`) on every request. Never assume `basename(rootPath) === workspaceId`.

## Dev attach (optional)

```bash
cd services/grose-modules
PORT=4711 GROSE_MODULES_TOKEN=dev make run
GROSE_MODULES_URL=http://127.0.0.1:4711 bun run electron:dev
```

## Design prototype

Hi-fi clickable mock: `designs/local-reader/Local Reader.html` (serve `designs/` on port 4311).
