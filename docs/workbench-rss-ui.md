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
| Reader | `rss-reader` | Body, 全文, favorite, unread/read, tags, AI summary, selection toolbar |
| AI | shared `chat` panel | Opened via **AI Chat** / ⌘K / selection actions |

### Status model (local overlay)

| Dimension | Values | Notes |
|-----------|--------|-------|
| Read status | `unread` / `read` | Default `unread`. Opening an article marks `read`. |
| Favorite | starred (server) | Via `isStarred` / `rssToggleStar`. Independent of read status. |
| History | `lastViewedAt` | Auto browse history — articles the user has opened. |

Tags and status/history meta live in `localStorage` (`grose-rss-local-reader-v3`) keyed by article id.

### Manage feeds

Feeds header **gear** opens Manage feeds: rename, delete, copy URL, and **Export** OPML (downloads `feeds.opml`). After rename/delete the UI calls `refreshRssData()`.

### Add feed / OPML import

Add (+) opens a dialog with tabs **RSS URL** | **OPML** | Markdown / File / Social (UI stubs until ingest APIs exist). OPML accepts file drop/picker or pasted XML.

### AI

- **AI Chat** — docks the shared chat panel with `rss-article` context.
- **Selection toolbar** — translate / polish / explain / ask / continue → `selection` context.
- **⌘K** — Reader command palette (add, navigate, triage, summarize).
- **AI Summary** — caches a local summary card; “Generate” also seeds chat.

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
