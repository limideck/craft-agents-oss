# Grose Tables sidecar (plydb fork)

Independent Go sidecar (fork of [plydb](https://github.com/kineticloom/plydb), origin `limideck/plydb`) that Grose Agents hosts like Open Connector: spawn locally, register as one HTTP MCP Source (`tables`), and proxy Admin HTTP for the Workbench UI.

**Repo layout today:** nested clone at `test/plydb/` (gitignored under `test/`). Later: publish as its own git project; Grose only vendors the binary + thin lifecycle glue.

## Contract

| Surface | Path | Auth | Consumer |
|---------|------|------|----------|
| Health | `GET /health` | none | Electron lifecycle |
| MCP | `/mcp` | Bearer `TABLES_TOKEN` | Grose Agent (MCP Source) |
| Admin | `/api/*` | Bearer | Workbench UI via `tablesFetch` |

### Health

```json
{ "ok": true, "service": "tables", "version": "dev", "sources": 1 }
```

### Admin HTTP

| Method | Path | Body / notes |
|--------|------|----------------|
| `GET` | `/api/sources` | List sources |
| `POST` | `/api/sources` | JSON register path under data dir |
| `POST` | `/api/sources/upload` | multipart `file` (+ optional `id`,`name`,`type`,`format`,`access`) |
| `GET` | `/api/sources/{id}` | Source detail |
| `PATCH` | `/api/sources/{id}` | `{ "access": "read\|append\|read_write\|full_dml" }` |
| `DELETE` | `/api/sources/{id}?delete_files=1` | Remove source (+ uploaded files) |
| `GET` | `/api/sources/{id}/tables` | Discovered tables + columns |
| `GET` | `/api/sources/{id}/tables/{table}/rows?schema=default&limit=100` | Preview rows (`schema=main` for duckdb/sqlite) |
| `POST` | `/api/catalog/tables` | Create table in writable catalog (same as MCP `create_table`) |
| `POST` | `/api/sources/{id}/tables/{table}/rows` | Insert rows `{ "schema"?, "rows": [...] }` |
| `POST` | `/api/reload` | Rebuild DuckDB engine from disk |

Upload accepts **csv / json / parquet / xlsx / sqlite / duckdb** (by extension or `type`/`format`). Files land in `{dataDir}/files/{id}/`. Paths outside `dataDir` are rejected.

`POST /api/sources` example:

```json
{
  "id": "customers",
  "type": "file",
  "path": "files/customers/customers.csv",
  "format": "csv",
  "name": "Customers",
  "access": "read"
}
```

`POST /api/catalog/tables` example:

```json
{
  "table_name": "tasks",
  "columns": [
    { "name": "id", "type": "INTEGER" },
    { "name": "title", "type": "VARCHAR" }
  ],
  "if_not_exists": true
}
```

### MCP tools

| Tool | Role |
|------|------|
| `query` | SQL (`catalog.schema.table`); access policy from `access.json` |
| `get_semantic_context` | Live OSI YAML (refreshed on registry reload / after DDL) |
| `list_sources` | Same source list as Admin (includes writable `catalog`) |
| `list_tables` | Tables + columns for a source id |
| `create_table` | `CREATE TABLE` in writable duckdb/sqlite (default source `catalog`) |
| `insert_rows` | Insert row objects into a catalog table |
| `update_rows` | Update by structured `filter` or simple `where` (required; no unbounded updates) |
| `delete_rows` | Delete by `filter` / `where` (required) |
| `import_file_to_catalog` | `CREATE TABLE … AS SELECT *` from an uploaded file source into `catalog` |

### Workspace catalog

On Runtime start the sidecar ensures a writable DuckDB file:

```text
{dataDir}/catalog/workspace.duckdb
```

It is auto-registered as source id **`catalog`** with `access: read_write` in `config.json` + `access.json` when missing. DuckDB/SQLite tables use schema **`main`** (file sources keep schema `default`).

### Access & write semantics

| Source type | Stored `access` | Effective DML | ATTACH |
|-------------|-----------------|---------------|--------|
| `sqlite`, `duckdb` | `read` | SELECT only | `READ_ONLY` |
| `sqlite`, `duckdb` | `append` / `read_write` / `full_dml` | Per sqlwalk level; `read_write`/`full_dml` also allow DDL | Writable (no `READ_ONLY`) |
| `file` (csv/json/parquet/xlsx) | any (UI may store `read_write`) | Always **read** (policy clamp) | N/A — DuckDB scans files; cannot mutate in place |
| `postgresql` / `mysql` | writable levels | Policy allows DML; ATTACH without `READ_ONLY` when writable | Verify credentials allow writes |

Changing `PATCH /api/sources/{id}` between read-only and writable reloads the engine so ATTACH mode updates before the next query.

`create_table` / row mutations reject file-type sources with a clear error — use `import_file_to_catalog` to copy CSV data into `catalog` first.

## AI chat: create & edit data

With the `tables` MCP source attached to a session:

1. **Create a table** — call `create_table` with `table_name` + `columns` (defaults to source `catalog`).
2. **Insert** — `insert_rows` with `table_name` + `rows: [{…}]`.
3. **Query / verify** — `query` with `SELECT * FROM catalog.main.<table>` or `list_tables` / Workbench preview (`schema=main`).
4. **Update / delete** — `update_rows` / `delete_rows` with a `filter` like `{ "column": "id", "op": "=", "value": 1 }`.
5. **From an upload** — upload via Workbench, then `import_file_to_catalog` with `file_source_id` + new `table_name`.

Prefer the structured tools over hand-written DDL/DML when possible; fall back to `query` for joins and analytics.

Grid cell edit in the Workbench remains **Phase B** (preview is still readonly in the UI).

## Dev setup

```bash
bun run setup:tables
bun run electron:dev
```

Manual:

```bash
cd test/plydb && go build -o plydb .
./plydb serve --data-dir ~/.grose-agent/workspaces/my-slug/modules/tables --addr 127.0.0.1:3911 --token dev
GROSE_TABLES_URL=http://127.0.0.1:3911 bun run electron:dev
```

## IPC (Workbench)

| Method | Channel |
|--------|---------|
| `getTablesStatus()` | `tables:getStatus` |
| `getTablesConfig()` | `tables:getConfig` |
| `restartTables()` | `tables:restart` |
| `tablesFetch(req)` | `tables:fetch` |

### `tablesFetch` body shapes

- **JSON** — `body` string + optional `Content-Type: application/json` (default when `body` is set).
- **Multipart upload** — set `multipart: { fields?, file: { fileName, filePath? | dataBase64? } }` instead of `body`. Main builds `FormData` (field `file` by default). Prefer `filePath` so large files stay on disk.

`method` may be `GET` | `POST` | `PUT` | `PATCH` | `DELETE`.

### Workbench UI

Module: `apps/electron/src/renderer/workbench/modules/tables/`.

| Region | Role |
|--------|------|
| Activity list | Source list — upload (native dialog → multipart), select, delete |
| Dock `tables-grid` | Breadcrumb + table chips + `@grose-agent/datagrid` readonly preview |

On mount the activity list calls `getTablesConfig()` (starts sidecar + ensures MCP source), then `GET /api/sources` via `tablesFetch`. Selecting a source loads `/tables` and `/tables/{name}/rows`. Grid is **preview-only** in Phase 1 (no cell edits yet).

How to try:

```bash
bun run setup:tables
bun run electron:dev
```

ActivityBar → **Tables**. See also [workbench-tables-ui.md](./workbench-tables-ui.md).

## Data layout

```text
{rootPath}/modules/tables/          # per-workspace data (uploads, catalog, config)
  config.json
  access.json
  catalog/workspace.duckdb
  files/{sourceId}/…

~/.grose-agent/tables/
  sidecar-secrets.json              # process token only (global)
```

See [workspace-storage.md](./workspace-storage.md). Env: `GROSE_TABLES_URL`, `GROSE_TABLES_BIN`, `TABLES_TOKEN`, `TABLES_DATA_DIR`, `TABLES_ADDR`.

Manual serve (point `--data-dir` at a workspace modules/tables folder):

```bash
./plydb serve --data-dir /path/to/workspace/modules/tables --addr 127.0.0.1:3911 --token dev
```

## Product split

| Plane | Protocol | Role |
|-------|----------|------|
| Agent | MCP | Discover, query, create tables, mutate rows |
| Workbench | Admin HTTP via IPC | Upload, list, preview, access toggle; thin create/insert Admin for later UI |

Writable DuckDB ATTACH + sqlwalk DML/DDL policy are wired for sqlite/duckdb (and attachable DB types). File sources remain read-only at the policy layer even if `access.json` stores a writable level.

## Roadmap

1. ~~Dynamic source registry + upload CSV/JSON/SQLite/DuckDB~~
2. ~~Wire `sqlwalk` read-write + writable catalog ATTACH~~
3. ~~Workspace `catalog` + MCP management tools (`create_table`, row DML, `import_file_to_catalog`)~~
4. Workbench grid cell edit (Phase B) via Admin DML
5. Split git + multi-arch release CI
6. Harden Postgres/MySQL RW ATTACH in production; optional `can_drop` UX
