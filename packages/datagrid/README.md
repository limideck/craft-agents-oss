# `@grose-agent/datagrid`

Airtable-like spreadsheet grid extracted from [`test/ai-datagrid`](../../test/ai-datagrid) for reuse in Electron / web hosts (same packaging style as `@grose-agent/ui`).

## Install

Workspace package — already available via `packages/*` workspaces:

```ts
import {
  DataGridContainer,
  DatagridToaster,
  getFilterFn,
  useDataGrid,
} from '@grose-agent/datagrid'
```

## Styles

The grid uses Tailwind utility classes and shadcn-style CSS variables. In the host CSS:

```css
@import "tailwindcss";
@import "@grose-agent/datagrid/styles";

/* Ensure Tailwind scans the package source */
@source "../../../packages/datagrid/src/**/*.{ts,tsx}";
```

If the host already defines the same CSS variables (e.g. via `@grose-agent/ui/styles`), you can omit the datagrid `:root` tokens and only keep the `@source` line.

Mount `DatagridToaster` once near the app root for copy/paste / undo toasts.

## Quick usage

```tsx
import type { ColumnDef } from '@tanstack/react-table'
import { DataGridContainer, DatagridToaster, getFilterFn } from '@grose-agent/datagrid'

type Row = { id: string; name: string }

const columns: ColumnDef<Row>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Name',
    filterFn: getFilterFn(),
    meta: { label: 'Name', cell: { variant: 'short-text' } },
  },
]

export function MyTable() {
  return (
    <>
      <DatagridToaster />
      <DataGridContainer<Row>
        initialData={[{ id: '1', name: 'Ada' }]}
        initialColumns={columns}
        getRowId={(row) => row.id}
        createNewRow={() => ({ id: crypto.randomUUID(), name: '' })}
        createNewRows={(n) =>
          Array.from({ length: n }, () => ({ id: crypto.randomUUID(), name: '' }))
        }
        defaultColumnId="name"
        height={480}
      />
    </>
  )
}
```

## Scope

**Included:** virtualized grid, cell editors (text/number/date/select/…), filter/sort/view menus, keyboard shortcuts, undo/redo hooks, zustand UI store, AI column-mapping helpers (`assistant-schemas`, `columnDefinitionToColumnDef`).

**Excluded:** Next.js pages, eve agent / chat UI from the template. Pass custom UI via `DataGridContainer` `children` when you wire an agent later.

## Lower-level API

For full control, compose `useDataGrid` + `DataGrid` + toolbar menus yourself (see `DataGridContainer` source).
