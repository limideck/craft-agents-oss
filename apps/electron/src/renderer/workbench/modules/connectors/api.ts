/**
 * OpenConnector API client for the Electron renderer.
 * Uses `@craft-agent/open-connector-client` with an IPC-backed fetch so the
 * Vite origin can talk to the local sidecar without CORS.
 */

import { ApiError, OpenConnectorClient } from '@craft-agent/open-connector-client'
import type {
  AuthSession,
  ConnectionRecord,
  OAuthConfig,
  ProviderDefinition,
  RunLogPage,
  RuntimeTokenCreation,
  RuntimeTokenSummary,
  RuntimeActionResponse,
} from './model'
import type { AppData } from './model'

export interface OpenConnectorConfig {
  baseUrl: string
  adminToken: string
  runtimeToken?: string
}

export type ClientLike = OpenConnectorClient

function headersToRecord(headers: HeadersInit | undefined): Record<string, string> {
  const record: Record<string, string> = {}
  if (!headers) return record
  new Headers(headers).forEach((value, key) => {
    record[key] = value
  })
  return record
}

/**
 * fetch() that routes through Electron main → sidecar.
 * Falls back to global fetch when IPC is unavailable (tests / non-Electron).
 */
export function createIpcFetch(baseUrl: string): typeof fetch {
  const normalizedBase = baseUrl.replace(/\/+$/, '')

  const ipcFetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const api = window.electronAPI
    if (!api?.openConnectorFetch) {
      return fetch(input, init)
    }

    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    if (!url.startsWith(normalizedBase)) {
      return fetch(input, init)
    }

    const pathWithQuery = url.slice(normalizedBase.length) || '/'
    const method = (init?.method ?? 'GET').toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE'
    if (method !== 'GET' && method !== 'POST' && method !== 'PUT' && method !== 'DELETE') {
      throw new Error(`Unsupported OpenConnector method: ${method}`)
    }

    const headerRecord = headersToRecord(init?.headers)
    const auth = headerRecord.authorization ?? headerRecord.Authorization
    const bearerToken = auth?.replace(/^Bearer\s+/i, '').trim()
    const body =
      typeof init?.body === 'string'
        ? init.body
        : init?.body != null
          ? String(init.body)
          : undefined

    const proxied = await api.openConnectorFetch({
      method,
      path: pathWithQuery,
      body,
      bearerToken,
      headers: headerRecord,
    })

    return new Response(proxied.body, {
      status: proxied.status,
      headers: proxied.contentType ? { 'content-type': proxied.contentType } : undefined,
    })
  }) as typeof fetch

  return ipcFetch
}

export function createOpenConnectorClient(config: OpenConnectorConfig): ClientLike {
  return new OpenConnectorClient({
    baseUrl: config.baseUrl,
    bearerToken: config.adminToken,
    fetch: createIpcFetch(config.baseUrl),
  })
}

export async function loadOpenConnectorData(client: ClientLike, adminToken: string): Promise<AppData> {
  const authSession = await client.get<AuthSession>('/api/auth/session', { bearerToken: adminToken })
  if (!authSession.authenticated) {
    throw new ApiError(401, 'OpenConnector admin session is not authenticated')
  }

  const [providers, connections, oauthConfigs, runtimeTokens, runPage] = await Promise.all([
    client.get<ProviderDefinition[]>('/api/providers', { bearerToken: adminToken }),
    client.get<ConnectionRecord[]>('/api/connections', { bearerToken: adminToken }),
    client.get<OAuthConfig[]>('/api/oauth/configs', { bearerToken: adminToken }),
    client.get<RuntimeTokenSummary[]>('/api/runtime-tokens', { bearerToken: adminToken }),
    client.get<RunLogPage>('/api/runs', { bearerToken: adminToken }),
  ])

  if (!Array.isArray(providers)) {
    throw new Error('OpenConnector /api/providers returned an unexpected payload')
  }

  return {
    providers,
    connections: Array.isArray(connections) ? connections : [],
    oauthConfigs: Array.isArray(oauthConfigs) ? oauthConfigs : [],
    runtimeTokens: Array.isArray(runtimeTokens) ? runtimeTokens : [],
    runs: runPage?.items ?? [],
    runsNextCursor: runPage?.nextCursor,
  }
}

export async function putConnection(
  client: ClientLike,
  service: string,
  body: unknown,
  adminToken: string,
): Promise<void> {
  await client.put(`/api/connections/${service}`, body, { bearerToken: adminToken })
}

export async function deleteConnection(client: ClientLike, service: string, adminToken: string): Promise<void> {
  await client.delete(`/api/connections/${service}`, { bearerToken: adminToken })
}

export async function startOAuthAuthorization(
  client: ClientLike,
  service: string,
  adminToken: string,
): Promise<{ authorizationUrl?: string }> {
  return client.post<{ authorizationUrl?: string }>(
    '/api/oauth/authorizations',
    { service },
    { bearerToken: adminToken },
  )
}

export async function putOAuthConfig(
  client: ClientLike,
  service: string,
  body: { clientId: string; clientSecret: string; extra: Record<string, unknown> },
  adminToken: string,
): Promise<void> {
  await client.put(`/api/oauth/configs/${service}`, body, { bearerToken: adminToken })
}

export async function deleteOAuthConfig(client: ClientLike, service: string, adminToken: string): Promise<void> {
  await client.delete(`/api/oauth/configs/${service}`, { bearerToken: adminToken })
}

export async function createRuntimeToken(
  client: ClientLike,
  name: string,
  adminToken: string,
): Promise<RuntimeTokenCreation> {
  return client.post<RuntimeTokenCreation>('/api/runtime-tokens', { name }, { bearerToken: adminToken })
}

export async function revokeRuntimeToken(client: ClientLike, id: string, adminToken: string): Promise<void> {
  await client.delete(`/api/runtime-tokens/${id}`, { bearerToken: adminToken })
}

export async function fetchRunsPage(
  client: ClientLike,
  adminToken: string,
  input: { cursor?: string; service?: string | null; limit?: number } = {},
): Promise<RunLogPage> {
  const query = new URLSearchParams({ limit: String(input.limit ?? 50) })
  if (input.cursor) query.set('cursor', input.cursor)
  if (input.service) query.set('service', input.service)
  return client.get<RunLogPage>(`/api/runs?${query}`, { bearerToken: adminToken })
}

export async function executeAction(
  client: ClientLike,
  actionId: string,
  input: unknown,
  runtimeToken?: string,
): Promise<RuntimeActionResponse> {
  return client.post<RuntimeActionResponse>(
    `/v1/actions/${actionId}`,
    { input },
    runtimeToken ? { bearerToken: runtimeToken } : {},
  )
}
