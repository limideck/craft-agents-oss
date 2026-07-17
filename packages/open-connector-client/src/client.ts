/**
 * Typed fetch client for OpenConnector sidecar APIs.
 * Adapted from open-connector/web/src/api.ts with explicit baseUrl + bearerToken.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface OpenConnectorClientOptions {
  /** Sidecar origin, e.g. http://127.0.0.1:3847 (no trailing slash required) */
  baseUrl: string
  /** Default bearer token (admin for /api/*, runtime for /v1/* and /mcp) */
  bearerToken?: string
  /**
   * Optional fetch implementation (defaults to global fetch).
   * Electron renderer should pass an IPC-backed fetch to avoid CORS against the sidecar.
   */
  fetch?: typeof fetch
}

export interface RequestOptions {
  bearerToken?: string
  signal?: AbortSignal
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function joinUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizeBaseUrl(baseUrl)}${normalizedPath}`
}

function headersFor(options: RequestOptions, json = false): Headers {
  const headers = new Headers()
  if (json) {
    headers.set('content-type', 'application/json')
  }
  const token = options.bearerToken?.trim()
  if (token) {
    headers.set('authorization', `Bearer ${token}`)
  }
  return headers
}

function errorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined
  }
  if ('errorMessage' in payload && typeof payload.errorMessage === 'string') {
    return payload.errorMessage
  }
  if ('message' in payload && typeof payload.message === 'string') {
    return payload.message
  }
  if ('error' in payload && payload.error && typeof payload.error === 'object') {
    const error = payload.error as { message?: unknown }
    return typeof error.message === 'string' ? error.message : undefined
  }
  return undefined
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as unknown
  if (!response.ok) {
    throw new ApiError(response.status, errorMessage(payload) ?? `Request failed with ${response.status}`)
  }
  return payload as T
}

export class OpenConnectorClient {
  readonly baseUrl: string
  private readonly defaultBearerToken?: string
  private readonly fetchImpl: typeof fetch

  constructor(options: OpenConnectorClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl)
    this.defaultBearerToken = options.bearerToken
    this.fetchImpl = options.fetch ?? fetch.bind(globalThis)
  }

  withBearerToken(bearerToken: string): OpenConnectorClient {
    return new OpenConnectorClient({
      baseUrl: this.baseUrl,
      bearerToken,
      fetch: this.fetchImpl,
    })
  }

  private resolveToken(options: RequestOptions): string | undefined {
    return options.bearerToken ?? this.defaultBearerToken
  }

  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return readJson<T>(
      await this.fetchImpl(joinUrl(this.baseUrl, path), {
        headers: headersFor({ bearerToken: this.resolveToken(options) }),
        credentials: 'omit',
        signal: options.signal,
      }),
    )
  }

  async post<T = unknown>(path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
    return readJson<T>(
      await this.fetchImpl(joinUrl(this.baseUrl, path), {
        method: 'POST',
        headers: headersFor({ bearerToken: this.resolveToken(options) }, true),
        credentials: 'omit',
        body: JSON.stringify(body),
        signal: options.signal,
      }),
    )
  }

  async put<T = unknown>(path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
    return readJson<T>(
      await this.fetchImpl(joinUrl(this.baseUrl, path), {
        method: 'PUT',
        headers: headersFor({ bearerToken: this.resolveToken(options) }, true),
        credentials: 'omit',
        body: JSON.stringify(body),
        signal: options.signal,
      }),
    )
  }

  async delete<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    return readJson<T>(
      await this.fetchImpl(joinUrl(this.baseUrl, path), {
        method: 'DELETE',
        headers: headersFor({ bearerToken: this.resolveToken(options) }),
        credentials: 'omit',
        signal: options.signal,
      }),
    )
  }
}

/** Standalone helpers matching open-connector/web/src/api.ts shape, with required baseUrl. */
export async function apiGet<T>(
  baseUrl: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  return new OpenConnectorClient({ baseUrl, bearerToken: options.bearerToken }).get<T>(path, options)
}

export async function apiPost<T = unknown>(
  baseUrl: string,
  path: string,
  body: unknown,
  options: RequestOptions = {},
): Promise<T> {
  return new OpenConnectorClient({ baseUrl, bearerToken: options.bearerToken }).post<T>(path, body, options)
}

export async function apiPut<T = unknown>(
  baseUrl: string,
  path: string,
  body: unknown,
  options: RequestOptions = {},
): Promise<T> {
  return new OpenConnectorClient({ baseUrl, bearerToken: options.bearerToken }).put<T>(path, body, options)
}

export async function apiDelete<T = unknown>(
  baseUrl: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  return new OpenConnectorClient({ baseUrl, bearerToken: options.bearerToken }).delete<T>(path, options)
}
