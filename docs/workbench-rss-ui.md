# Workbench RSS reader

Live RSS module for the Craft workbench shell. Backend is the **craft-modules** Go sidecar; UI follows feedoverflow’s 3-pane pattern (Today / All / Starred / Podcasts + flat feeds).

See [craft-modules-sidecar.md](./craft-modules-sidecar.md) for process / API / MCP boundaries.

## Packaging (A5)

```bash
# Host arch → services/craft-modules/bin + apps/electron/resources/craft-modules/
bun run build:craft-modules

# All Electron targets (darwin/linux/windows × amd64/arm64)
bun run build:craft-modules:all
```

`electron:build` / `electron:dist*` run `build:craft-modules` first and ship the binary via `extraResources` → `Craft Agents.app/.../Resources/craft-modules/`.

## How to open

1. Build once: `bun run build:craft-modules`
2. Enable the workbench shell:
   - DevTools: `localStorage.setItem('craft-feature-workbench-shell', '1')` then reload, **or**
   - Env: `CRAFT_FEATURE_WORKBENCH_SHELL=1`
3. Start Electron (`bun run electron:dev`). Main process spawns `craft-modules` (or attach with `CRAFT_MODULES_URL`).
4. ActivityBar → **RSS**. Dock preset: **Feeds | Articles | Reader**.

If you previously hit `database is locked`, quit Craft and kill stale sidecars (`pkill -f craft-modules`) then restart so only one process holds the SQLite file.

## Regions

| Region | Panel | Role |
|--------|--------|------|
| Feeds | `rss-feeds` | Smart views + subscriptions; add / manage / refresh / OPML export |
| Articles | `rss-article-list` | List with Latest/Digest for Today/All; search |
| Reader | `rss-reader` | HTML body, 全文, star, open original, Ask AI, podcast player |

Article state is **star-only** (no unread), matching feedoverflow.

### Manage feeds

Feeds header **gear** opens Manage feeds: rename, delete, copy URL, and **Export** OPML (downloads `feeds.opml`). After rename/delete the UI calls `refreshRssData()`.

### Add feed / OPML import

Add (+) opens a dialog with tabs **URL** | **OPML**. OPML accepts file drop/picker or pasted XML; success shows imported/skipped counts via `rssImportOpml`.

### Podcast player

When an article has `audioUrl`, Reader shows a Play chip; the bottom bar supports play/pause, seek, ±15s, and speed.

### Full text (全文)

Reader toolbar **全文** calls `rssFetchArticleContent` → Go readability (`GET /api/rss/articles/fetch-content?url=`). Extracted HTML is shown in-session (not persisted); toggle restores RSS body.

## Data path

`{rootPath}/modules/rss/rss.db` — see [workspace-storage.md](./workspace-storage.md).

Pass `X-Craft-Workspace-Id` (+ optional `X-Craft-Workspace-Root`) on every request. Never assume `basename(rootPath) === workspaceId`.

## Dev attach (optional)

```bash
cd services/craft-modules
PORT=4711 CRAFT_MODULES_TOKEN=dev make run
CRAFT_MODULES_URL=http://127.0.0.1:4711 CRAFT_FEATURE_WORKBENCH_SHELL=1 bun run electron:dev
```
