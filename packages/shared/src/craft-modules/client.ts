/**
 * Loopback HTTP client for craft-modules RSS + Workflows + Sites APIs.
 *
 * Persistence resolves workspaceId → absolute rootPath (registry), then
 * reads/writes under `{rootPath}/modules/...`. Always send both
 * X-Craft-Workspace-Id and X-Craft-Workspace-Root when root is known.
 */

import { resolveWorkspaceRootPath } from '../config/storage.ts'
import { requireCraftModulesEndpoint } from './endpoint.ts'
import type {
  CraftModulesRssArticle,
  CraftModulesRssFeed,
  CraftModulesRssListMode,
  CraftModulesRssView,
  CraftModulesSite,
  CraftModulesSiteCreateInput,
  CraftModulesSiteFileNode,
  CraftModulesSitePreviewResult,
  CraftModulesSiteUpdateInput,
  CraftModulesVisualEditSaveInput,
  CraftModulesWorkflow,
  CraftModulesWorkflowCreateInput,
  CraftModulesWorkflowDeployResult,
  CraftModulesWorkflowRunResult,
  CraftModulesWorkflowUpdateInput,
} from './types.ts'

export class CraftModulesHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message)
    this.name = 'CraftModulesHttpError'
  }
}

function workspaceHeaders(workspaceId: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Craft-Workspace-Id': workspaceId,
  }
  const root = resolveWorkspaceRootPath(workspaceId)
  if (root) {
    headers['X-Craft-Workspace-Root'] = root
  }
  return headers
}

async function request<T>(
  workspaceId: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const ep = requireCraftModulesEndpoint()
  const url = `${ep.baseUrl.replace(/\/+$/, '')}${path}`
  const headers = workspaceHeaders(workspaceId)
  if (ep.token) {
    headers.Authorization = `Bearer ${ep.token}`
  }
  let payload: string | undefined
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const res = await fetch(url, { method, headers, body: payload })
  const text = await res.text()
  if (!res.ok) {
    let message = text
    try {
      const parsed = JSON.parse(text) as { error?: string }
      if (parsed.error) message = parsed.error
    } catch {
      // keep raw
    }
    throw new CraftModulesHttpError(message || `HTTP ${res.status}`, res.status, text)
  }
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export async function rssPing(): Promise<{ ok: boolean; domain: 'rss'; version?: string }> {
  const ep = requireCraftModulesEndpoint()
  const res = await fetch(`${ep.baseUrl.replace(/\/+$/, '')}/health`)
  const data = (await res.json()) as { ok?: boolean; version?: string }
  return { ok: Boolean(data.ok), domain: 'rss', version: data.version }
}

export async function listFeeds(workspaceId: string): Promise<CraftModulesRssFeed[]> {
  return request(workspaceId, 'GET', '/api/rss/feeds')
}

export async function addFeed(
  workspaceId: string,
  input: { url: string; name?: string },
): Promise<CraftModulesRssFeed> {
  return request(workspaceId, 'POST', '/api/rss/feeds', input)
}

export async function renameFeed(
  workspaceId: string,
  feedId: string,
  name: string,
): Promise<{ ok: true }> {
  return request(workspaceId, 'PATCH', `/api/rss/feeds/${encodeURIComponent(feedId)}`, { name })
}

export async function deleteFeed(workspaceId: string, feedId: string): Promise<{ ok: true }> {
  return request(workspaceId, 'DELETE', `/api/rss/feeds/${encodeURIComponent(feedId)}`)
}

export async function importOpml(
  workspaceId: string,
  opml: string,
): Promise<{ imported: number; skipped: number; feeds: CraftModulesRssFeed[] }> {
  return request(workspaceId, 'POST', '/api/rss/feeds/import-opml', { opml })
}

export async function exportOpml(workspaceId: string): Promise<string> {
  const ep = requireCraftModulesEndpoint()
  const url = `${ep.baseUrl.replace(/\/+$/, '')}/api/rss/feeds/export-opml`
  const headers: Record<string, string> = {
    Accept: 'application/xml, text/xml, */*',
    'X-Craft-Workspace-Id': workspaceId,
  }
  if (ep.token) {
    headers.Authorization = `Bearer ${ep.token}`
  }
  const res = await fetch(url, { method: 'GET', headers })
  const text = await res.text()
  if (!res.ok) {
    let message = text
    try {
      const parsed = JSON.parse(text) as { error?: string }
      if (parsed.error) message = parsed.error
    } catch {
      // keep raw
    }
    throw new CraftModulesHttpError(message || `HTTP ${res.status}`, res.status, text)
  }
  return text
}

export type FetchArticleContentResult = {
  content: string
  title: string
  byline: string
}

export async function fetchArticleContent(
  workspaceId: string,
  articleUrl: string,
): Promise<FetchArticleContentResult> {
  const params = new URLSearchParams({ url: articleUrl })
  return request(workspaceId, 'GET', `/api/rss/articles/fetch-content?${params}`)
}

export type ListArticlesInput = {
  view?: CraftModulesRssView
  feedId?: string
  mode?: CraftModulesRssListMode
  q?: string
  limit?: number
}

export async function listArticles(
  workspaceId: string,
  input: ListArticlesInput = {},
): Promise<{ articles: CraftModulesRssArticle[]; cacheReady?: boolean; query?: string }> {
  const params = new URLSearchParams()
  if (input.view) params.set('view', input.view)
  if (input.feedId) params.set('feedId', input.feedId)
  if (input.mode) params.set('mode', input.mode)
  if (input.q) params.set('q', input.q)
  if (input.limit != null) params.set('limit', String(input.limit))
  const qs = params.toString()
  return request(workspaceId, 'GET', `/api/rss/articles${qs ? `?${qs}` : ''}`)
}

export async function getArticle(
  workspaceId: string,
  articleId: string,
): Promise<CraftModulesRssArticle> {
  return request(workspaceId, 'GET', `/api/rss/articles/${encodeURIComponent(articleId)}`)
}

export async function toggleStar(
  workspaceId: string,
  article: CraftModulesRssArticle,
  starred: boolean,
): Promise<{ ok: true; isStarred: boolean }> {
  return request(workspaceId, 'POST', '/api/rss/articles/star', { article, starred })
}

export async function starredCount(workspaceId: string): Promise<{ count: number }> {
  return request(workspaceId, 'GET', '/api/rss/starred/count')
}

export async function refreshFeeds(
  workspaceId: string,
  feedId?: string,
): Promise<{ ok: true }> {
  return request(workspaceId, 'POST', '/api/rss/refresh', feedId ? { feedId } : {})
}

export async function getRssSettings(
  workspaceId: string,
): Promise<{ rsshub_base_url: string }> {
  return request(workspaceId, 'GET', '/api/rss/settings')
}

export async function patchRssSettings(
  workspaceId: string,
  input: { rsshub_base_url: string },
): Promise<{ ok: true }> {
  return request(workspaceId, 'PATCH', '/api/rss/settings', input)
}

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------

export async function workflowsPing(): Promise<{
  ok: boolean
  domain: 'workflows'
  version?: string
  modules?: string[]
}> {
  const ep = requireCraftModulesEndpoint()
  const res = await fetch(`${ep.baseUrl.replace(/\/+$/, '')}/health`)
  const data = (await res.json()) as { ok?: boolean; version?: string; modules?: string[] }
  return {
    ok: Boolean(data.ok),
    domain: 'workflows',
    version: data.version,
    modules: data.modules,
  }
}

export async function listWorkflows(workspaceId: string): Promise<CraftModulesWorkflow[]> {
  return request(workspaceId, 'GET', '/api/workflows')
}

export async function getWorkflow(
  workspaceId: string,
  workflowId: string,
): Promise<CraftModulesWorkflow> {
  return request(workspaceId, 'GET', `/api/workflows/${encodeURIComponent(workflowId)}`)
}

export async function createWorkflow(
  workspaceId: string,
  input: CraftModulesWorkflowCreateInput,
): Promise<CraftModulesWorkflow> {
  return request(workspaceId, 'POST', '/api/workflows', input)
}

export async function updateWorkflow(
  workspaceId: string,
  workflowId: string,
  input: CraftModulesWorkflowUpdateInput,
): Promise<CraftModulesWorkflow> {
  return request(workspaceId, 'PATCH', `/api/workflows/${encodeURIComponent(workflowId)}`, input)
}

export async function deleteWorkflow(workspaceId: string, workflowId: string): Promise<void> {
  await request(workspaceId, 'DELETE', `/api/workflows/${encodeURIComponent(workflowId)}`)
}

export async function runWorkflow(
  workspaceId: string,
  workflowId: string,
): Promise<CraftModulesWorkflowRunResult> {
  return request(workspaceId, 'POST', `/api/workflows/${encodeURIComponent(workflowId)}/run`, {})
}

export async function deployWorkflow(
  workspaceId: string,
  workflowId: string,
): Promise<CraftModulesWorkflowDeployResult> {
  return request(workspaceId, 'POST', `/api/workflows/${encodeURIComponent(workflowId)}/deploy`, {})
}

export async function undeployWorkflow(
  workspaceId: string,
  workflowId: string,
): Promise<CraftModulesWorkflowDeployResult> {
  return request(workspaceId, 'POST', `/api/workflows/${encodeURIComponent(workflowId)}/undeploy`, {})
}

// ---------------------------------------------------------------------------
// Sites (建站)
// ---------------------------------------------------------------------------

export async function sitesPing(): Promise<{
  ok: boolean
  domain: 'sites'
  version?: string
  modules?: string[]
}> {
  const ep = requireCraftModulesEndpoint()
  const res = await fetch(`${ep.baseUrl.replace(/\/+$/, '')}/health`)
  const data = (await res.json()) as { ok?: boolean; version?: string; modules?: string[] }
  return {
    ok: Boolean(data.ok),
    domain: 'sites',
    version: data.version,
    modules: data.modules,
  }
}

export async function listSites(workspaceId: string): Promise<CraftModulesSite[]> {
  return request(workspaceId, 'GET', '/api/sites')
}

export async function getSite(workspaceId: string, siteId: string): Promise<CraftModulesSite> {
  return request(workspaceId, 'GET', `/api/sites/${encodeURIComponent(siteId)}`)
}

export async function createSite(
  workspaceId: string,
  input: CraftModulesSiteCreateInput,
): Promise<CraftModulesSite> {
  return request(workspaceId, 'POST', '/api/sites', input)
}

export async function updateSite(
  workspaceId: string,
  siteId: string,
  input: CraftModulesSiteUpdateInput,
): Promise<CraftModulesSite> {
  return request(workspaceId, 'PATCH', `/api/sites/${encodeURIComponent(siteId)}`, input)
}

export async function deleteSite(workspaceId: string, siteId: string): Promise<void> {
  await request(workspaceId, 'DELETE', `/api/sites/${encodeURIComponent(siteId)}`)
}

export async function listSiteFiles(
  workspaceId: string,
  siteId: string,
): Promise<CraftModulesSiteFileNode[]> {
  return request(workspaceId, 'GET', `/api/sites/${encodeURIComponent(siteId)}/files`)
}

export async function readSiteFile(
  workspaceId: string,
  siteId: string,
  path: string,
): Promise<{ path: string; content: string }> {
  const qs = new URLSearchParams({ path })
  return request(
    workspaceId,
    'GET',
    `/api/sites/${encodeURIComponent(siteId)}/files/content?${qs}`,
  )
}

export async function writeSiteFile(
  workspaceId: string,
  siteId: string,
  input: { path: string; content: string },
): Promise<{ ok: true }> {
  return request(workspaceId, 'PUT', `/api/sites/${encodeURIComponent(siteId)}/files/content`, input)
}

export async function startSitePreview(
  workspaceId: string,
  siteId: string,
): Promise<CraftModulesSitePreviewResult> {
  return request(workspaceId, 'POST', `/api/sites/${encodeURIComponent(siteId)}/preview/start`, {})
}

export async function stopSitePreview(
  workspaceId: string,
  siteId: string,
): Promise<{ ok: true }> {
  return request(workspaceId, 'POST', `/api/sites/${encodeURIComponent(siteId)}/preview/stop`, {})
}

export async function getSitePreview(
  workspaceId: string,
  siteId: string,
): Promise<CraftModulesSitePreviewResult> {
  return request(workspaceId, 'GET', `/api/sites/${encodeURIComponent(siteId)}/preview`)
}

export async function saveSiteVisualEdit(
  workspaceId: string,
  input: CraftModulesVisualEditSaveInput,
): Promise<{ ok: true }> {
  return request(
    workspaceId,
    'POST',
    `/api/sites/${encodeURIComponent(input.siteId)}/visual-edit`,
    input,
  )
}

export async function bindSiteSession(
  workspaceId: string,
  siteId: string,
  sessionId: string | null,
): Promise<CraftModulesSite> {
  return updateSite(workspaceId, siteId, { sessionId })
}
