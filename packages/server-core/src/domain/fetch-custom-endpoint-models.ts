/**
 * Fetch available models from a custom OpenAI/Anthropic-compatible endpoint.
 *
 * Primary path: GET {baseUrl}/models with Bearer auth (OpenAI-compatible).
 * Anthropic-compatible endpoints may expose /v1/models with x-api-key.
 */

import type { CustomEndpointApi } from '@grose-agent/shared/config'

export interface CustomEndpointModelInfo {
  id: string
  name: string
}

export interface FetchCustomEndpointModelsParams {
  baseUrl: string
  apiKey?: string
  /** Protocol hint — defaults to openai-completions */
  api?: CustomEndpointApi
  timeoutMs?: number
  /** Injected for tests */
  fetchImpl?: typeof fetch
}

export interface FetchCustomEndpointModelsResult {
  models: CustomEndpointModelInfo[]
  /** Which URL succeeded (useful for diagnostics) */
  fetchedFrom: string
}

/** Build candidate model-list URLs for a custom endpoint. */
export function resolveCustomEndpointModelsUrls(
  baseUrl: string,
  api: CustomEndpointApi = 'openai-completions',
): string[] {
  const base = baseUrl.trim().replace(/\/+$/, '')
  if (!base) return []

  const endsWithV1 = /\/v\d+$/i.test(base)
  const withModels = `${base}/models`
  const withV1Models = endsWithV1 ? withModels : `${base}/v1/models`

  if (api === 'anthropic-messages') {
    // Official Anthropic: base without /v1 → /v1/models first
    return endsWithV1 ? [withModels] : [withV1Models, withModels]
  }

  // OpenAI-compatible: base usually already includes /v1
  return endsWithV1 ? [withModels] : [withModels, withV1Models]
}

/**
 * Prepare an API key for HTTP headers.
 *
 * - Trims whitespace
 * - Treats empty / masked placeholder keys (••••) as absent — many local
 *   OpenAI-compatible servers are keyless
 * - Rejects other non-Latin1 characters that would crash undici/fetch with a
 *   ByteString error (e.g. pasted Unicode bullets or smart quotes)
 */
export function sanitizeApiKeyForHeaders(apiKey: string | undefined): string | undefined {
  const key = apiKey?.trim()
  if (!key) return undefined

  // Masked placeholders from GET_API_KEY (e.g. "sk-ant-••••••••abcd") must never
  // be sent — HTTP headers require ByteString (code points ≤ 255).
  if (key.includes('•')) return undefined

  for (let i = 0; i < key.length; i++) {
    if (key.charCodeAt(i) > 255) {
      throw new Error(
        'API key contains invalid characters. Re-paste the key (masked placeholders cannot be used) or leave it blank for local keyless servers.',
      )
    }
  }

  return key
}

function buildAuthHeaders(api: CustomEndpointApi, apiKey: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  const key = sanitizeApiKeyForHeaders(apiKey)
  if (!key) return headers

  if (api === 'anthropic-messages') {
    headers['x-api-key'] = key
    headers['anthropic-version'] = '2023-06-01'
    headers.Authorization = `Bearer ${key}`
  } else {
    headers.Authorization = `Bearer ${key}`
  }
  return headers
}

/** Parse OpenAI-style `{ data: [...] }` or `{ models: [...] }` payloads. */
export function parseCustomEndpointModelsResponse(payload: unknown): CustomEndpointModelInfo[] {
  if (!payload || typeof payload !== 'object') return []

  const root = payload as Record<string, unknown>
  const rawList = (Array.isArray(root.data) ? root.data
    : Array.isArray(root.models) ? root.models
      : Array.isArray(payload) ? payload
        : []) as unknown[]

  const seen = new Set<string>()
  const models: CustomEndpointModelInfo[] = []

  for (const entry of rawList) {
    if (typeof entry === 'string') {
      const id = entry.trim()
      if (!id || seen.has(id)) continue
      seen.add(id)
      models.push({ id, name: id })
      continue
    }
    if (!entry || typeof entry !== 'object') continue
    const obj = entry as Record<string, unknown>
    // Skip non-model objects when the OpenAI `object` discriminator is present
    if (typeof obj.object === 'string' && obj.object !== 'model') continue
    const id = typeof obj.id === 'string' ? obj.id.trim()
      : typeof obj.name === 'string' ? obj.name.trim()
        : ''
    if (!id || seen.has(id)) continue
    seen.add(id)
    const name = typeof obj.display_name === 'string' && obj.display_name.trim()
      ? obj.display_name.trim()
      : typeof obj.name === 'string' && obj.name.trim() && obj.name !== id
        ? obj.name.trim()
        : id
    models.push({ id, name })
  }

  return models
}

function formatHttpError(status: number, statusText: string, body: string): string {
  const snippet = body.replace(/\s+/g, ' ').trim().slice(0, 200)
  if (status === 401 || status === 403) {
    return 'Invalid API key or unauthorized to list models.'
  }
  if (status === 404) {
    return 'This endpoint does not expose a model list (404). Enter model IDs manually.'
  }
  return `Failed to fetch models (${status} ${statusText})${snippet ? `: ${snippet}` : ''}`
}

/**
 * Fetch models from a custom endpoint.
 * Tries candidate URLs (with 404 fallback). Throws a user-facing Error on failure.
 */
export async function fetchCustomEndpointModels(
  params: FetchCustomEndpointModelsParams,
): Promise<FetchCustomEndpointModelsResult> {
  const api = params.api ?? 'openai-completions'
  const urls = resolveCustomEndpointModelsUrls(params.baseUrl, api)
  if (urls.length === 0) {
    throw new Error('Base URL is required to fetch models.')
  }

  const fetchImpl = params.fetchImpl ?? fetch
  const timeoutMs = params.timeoutMs ?? 15_000
  const headers = buildAuthHeaders(api, params.apiKey)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let lastNotFound: string | null = null
  let lastError: Error | null = null

  try {
    for (const url of urls) {
      let response: Response
      try {
        response = await fetchImpl(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
        })
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          throw new Error('Timed out while fetching models. Check the URL and try again.')
        }
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('fetch failed')) {
          throw new Error('Cannot connect to API server. Check the URL and ensure the server is running.')
        }
        throw new Error(msg || 'Failed to fetch models.')
      }

      if (response.status === 404) {
        lastNotFound = url
        continue
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(formatHttpError(response.status, response.statusText, body))
      }

      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw new Error('Endpoint returned a non-JSON response when listing models.')
      }

      const models = parseCustomEndpointModelsResponse(payload)
      if (models.length === 0) {
        throw new Error('No models returned by this endpoint.')
      }

      return { models, fetchedFrom: url }
    }

    if (lastNotFound) {
      throw new Error('This endpoint does not expose a model list (404). Enter model IDs manually.')
    }
    throw lastError ?? new Error('Failed to fetch models.')
  } finally {
    clearTimeout(timer)
  }
}
