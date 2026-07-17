/**
 * OpenConnector sidecar IPC types (shared by main + renderer).
 */

export const OPEN_CONNECTOR_SOURCE_SLUG = 'open-connector'

export interface OpenConnectorSidecarStatus {
  ready: boolean
  starting: boolean
  external: boolean
  baseUrl: string | null
  adminToken: string | null
  runtimeToken: string | null
  port: number | null
  error: string | null
  pid: number | null
}

export interface OpenConnectorSidecarConfig {
  baseUrl: string
  adminToken: string
  runtimeToken: string
  ready: boolean
}

/** Renderer → main proxy request for sidecar HTTP (avoids CORS). */
export interface OpenConnectorFetchRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  body?: string
  bearerToken?: string
  headers?: Record<string, string>
}

export interface OpenConnectorFetchResponse {
  status: number
  body: string
  contentType: string | null
}
