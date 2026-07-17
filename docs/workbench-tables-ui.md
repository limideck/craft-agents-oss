# Workbench Tables UI

Spreadsheet browse/upload/preview for the Craft workbench shell. Backend is the **Tables** (plydb fork) sidecar; UI uses `@craft-agent/datagrid` and Admin HTTP via Electron IPC only (never direct `fetch` from the renderer).

See [craft-tables-sidecar.md](./craft-tables-sidecar.md) for process / Admin / MCP contracts.

## How to open

1. Build the binary once: `bun run setup:tables` (or `bun run build:tables`)
2. Enable the workbench shell:
   - DevTools: `localStorage.setItem('craft-feature-workbench-shell', '1')` then reload, **or**
   - Env: `CRAFT_FEATURE_WORKBENCH_SHELL=1`
3. Start Electron (`bun run electron:dev`). Main spawns `plydb serve` (or attach with `CRAFT_TABLES_URL`).
4. ActivityBar → **Tables**.

## Regions

| Region | Component | Role |
|--------|-----------|------|
| Sources | `activity/source-list-view` | List / upload / delete sources |
| Grid | `panels/grid-panel` | Breadcrumb, multi-table chips, datagrid preview |

## Data path (renderer)

```text
getTablesConfig()  → start sidecar + ensure MCP source `tables`
tablesFetch GET /api/sources
tablesFetch GET /api/sources/{id}/tables
tablesFetch GET /api/sources/{id}/tables/{table}/rows?schema=&limit=100
tablesFetch POST /api/sources/upload  (multipart via filePath)
tablesFetch DELETE /api/sources/{id}
```

Upload uses the native file dialog (`openFileDialog`) then `tablesFetch` with `multipart.file.filePath` so main reads the file and posts FormData.

## On-disk layout

`{rootPath}/modules/tables/` — see [workspace-storage.md](./workspace-storage.md) and [craft-tables-sidecar.md](./craft-tables-sidecar.md).

## Phase 1 scope

- Readonly grid preview (filter/sort/view menus from datagrid toolbar).
- File sources and DB sources both preview the same way.
- Inline cell edits are deferred (**Phase B**). Agent create/mutate goes through MCP (`create_table`, `insert_rows`, …) on the writable `catalog` source; Admin also exposes `POST /api/catalog/tables` and row insert for later UI.

## Layout

Dock preset: single center panel `tables-grid`. Sources live in the ActivityBar side rail (`activityView`), matching Workflows.
