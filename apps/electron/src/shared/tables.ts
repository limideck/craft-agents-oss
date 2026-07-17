/**
 * Tables sidecar IPC types (shared by main + renderer).
 */

export const TABLES_SOURCE_SLUG = 'tables'

export interface TablesSidecarStatus {
  ready: boolean
  starting: boolean
  external: boolean
  baseUrl: string | null
  token: string | null
  port: number | null
  error: string | null
  pid: number | null
  /** Absolute `{rootPath}/modules/tables` when bound. */
  dataDir?: string | null
}

export interface TablesSidecarConfig {
  baseUrl: string
  token: string
  ready: boolean
  /** Absolute `{rootPath}/modules/tables` for the bound workspace. */
  dataDir?: string | null
}

/** Multipart file part for Admin upload — main reads path or base64 into FormData. */
export interface TablesFetchMultipartFile {
  /** Form field name; defaults to `file`. */
  fieldName?: string
  fileName: string
  mimeType?: string
  /** Absolute path on disk (preferred for large files). */
  filePath?: string
  /** Base64 payload when the file originated in the renderer File API. */
  dataBase64?: string
}

export interface TablesFetchMultipart {
  fields?: Record<string, string>
  file: TablesFetchMultipartFile
}

/** Renderer → main proxy request for sidecar HTTP (avoids CORS). */
export interface TablesFetchRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  /** JSON string body (ignored when `multipart` is set). */
  body?: string
  bearerToken?: string
  headers?: Record<string, string>
  /** When set, main builds multipart/form-data (do not set Content-Type). */
  multipart?: TablesFetchMultipart
  /** Optional workspace rootPath; defaults to active workspace. */
  workspaceRootPath?: string
}

export interface TablesFetchResponse {
  status: number
  body: string
  contentType: string | null
}
