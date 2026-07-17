# Workbench RSS reader (UI mock)

Mock-only RSS reader module for the Craft workbench shell. No network, XML parsing, or `domain-rss` RPC.

## How to open

1. Enable the workbench shell:
   - DevTools console: `localStorage.setItem('craft-feature-workbench-shell', '1')` then reload, **or**
   - Env: `CRAFT_FEATURE_WORKBENCH_SHELL=1`
2. Start Electron (`apps/electron` → `bun run dev` / usual app entry).
3. In the ActivityBar (far left), click **RSS**.
4. Dock applies the `rss-reading` preset: **Feeds | Articles | Reader**.

## Regions

| Region | Panel / component | Role |
|--------|-------------------|------|
| Feeds | `rss-feeds` → `FeedsPanel` | Subscriptions, folders, unread counts, Add feed (UI only) |
| Article list | `rss-article-list` → `ArticleListPanel` | Title, source, relative time, unread dot; search filter |
| Reader | `rss-reader` → `ReaderPanel` | Title, meta, static HTML body; mark read / unread |

Selecting a feed filters the list. Selecting an article opens it in the reader and marks it read in local state. Mark read/unread toggles are Jotai-only overrides over mock defaults.

## Interactions (mock)

- **Add feed** — button present; no network.
- **Open original** — button present; no navigation.
- **Search** — client-side filter on title / summary / feed name.
- **Loading** — ~450ms skeleton on first paint (`rssMockReadyAtom`).

## Mock data shape

```ts
RssFolder { id, name, feedIds[] }
RssFeed   { id, title, url, siteUrl?, folderId?, description? }
RssArticle {
  id, feedId, title, author?, publishedAt (ISO),
  summary, contentHtml (static sanitized HTML), url, unread
}
```

Sample content mixes English and Chinese. Source: `workbench/modules/rss/mock/`.

## UI state (Jotai)

- `rssSelectedFeedIdAtom` — `'all' | 'unread' | feedId`
- `rssSelectedArticleIdAtom`
- `rssSearchQueryAtom`
- `rssReadOverridesAtom` — `Record<articleId, forceRead>`
- `rssMockReadyAtom`

## Craft styling

Uses existing electron / Craft tokens (`bg-card`, `border-border`, `text-muted-foreground`, `foreground-5/10`, panel primitives). Does **not** use frontend `--ide-*` tokens.

## Out of scope

Phase 3+ backend: real fetch, persistence, `packages/domain-rss`, RPC channels.
