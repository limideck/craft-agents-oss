/**
 * Tables (plydb fork) sidecar lifecycle for Craft Agents Electron.
 *
 * Spawns `plydb serve` with a **per-workspace** data dir:
 *   `{workspaceRootPath}/modules/tables`
 *
 * Process secrets stay global under `~/.craft-agent/tables/sidecar-secrets.json`.
 * Uploads/catalog must never land in that global folder.
 *
 * Set CRAFT_TABLES_URL to attach to an already-running instance
 * (skips spawn — useful when iterating on test/plydb).
 */

import { spawn, type ChildProcess } from 'child_process'
import { createServer } from 'net'
import { randomBytes } from 'crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { CONFIG_DIR, getActiveWorkspace } from '@craft-agent/shared/config'
import {
  ensureWorkspaceModuleDirs,
  getWorkspaceTablesDataPath,
} from '@craft-agent/shared/workspaces'
import type {
  TablesFetchRequest,
  TablesFetchResponse,
  TablesSidecarConfig,
  TablesSidecarStatus,
} from '../shared/tables'

export type {
  TablesFetchRequest,
  TablesFetchResponse,
  TablesSidecarConfig,
  TablesSidecarStatus,
}
export { TABLES_SOURCE_SLUG } from '../shared/tables'

interface PersistedSecrets {
  token: string
}

const SECRETS_FILENAME = 'sidecar-secrets.json'
const HEALTH_POLL_MS = 400
const HEALTH_TIMEOUT_MS = 60_000
const STOP_TIMEOUT_MS = 3_000

let proc: ChildProcess | null = null
let starting = false
let ready = false
let external = false
let baseUrl: string | null = null
let port: number | null = null
let lastError: string | null = null
let secrets: PersistedSecrets | null = null
let startPromise: Promise<TablesSidecarConfig> | null = null
/** Absolute `{rootPath}/modules/tables` currently bound to the process. */
let boundDataDir: string | null = null

/** Global process secrets only — not workspace uploads/catalog. */
function secretsDir(): string {
  return join(CONFIG_DIR, 'tables')
}

function secretsPath(): string {
  return join(secretsDir(), SECRETS_FILENAME)
}

function generateToken(): string {
  return randomBytes(32).toString('hex')
}

function loadOrCreateSecrets(): PersistedSecrets {
  mkdirSync(secretsDir(), { recursive: true })
  const path = secretsPath()
  if (existsSync(path)) {
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<PersistedSecrets>
      if (parsed.token) return { token: parsed.token }
    } catch {
      // regenerate below
    }
  }
  const created: PersistedSecrets = { token: generateToken() }
  writeFileSync(path, JSON.stringify(created, null, 2), { mode: 0o600 })
  return created
}

function resolveWorkspaceTablesDir(workspaceRootPath?: string | null): string {
  const root =
    workspaceRootPath?.trim() ||
    getActiveWorkspace()?.rootPath?.trim() ||
    null
  if (!root) {
    throw new Error(
      'Tables sidecar requires an active workspace rootPath (see docs/workspace-storage.md)',
    )
  }
  ensureWorkspaceModuleDirs(root)
  return getWorkspaceTablesDataPath(root)
}

async function allocateEphemeralPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Failed to allocate ephemeral port'))
        return
      }
      const allocated = address.port
      server.close((err) => {
        if (err) reject(err)
        else resolve(allocated)
      })
    })
    server.on('error', reject)
  })
}

function binaryName(): string {
  return process.platform === 'win32' ? 'plydb.exe' : 'plydb'
}

function platformArchDir(): string {
  const plat = process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'darwin' : 'linux'
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  return `${plat}-${arch}`
}

/** Resolve plydb / tables binary for spawn. */
export function resolveTablesBinary(): string | null {
  const fromEnv = process.env.CRAFT_TABLES_BIN?.trim()
  if (fromEnv && existsSync(fromEnv)) return fromEnv

  const name = binaryName()
  const resourcesPath =
    typeof (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath === 'string'
      ? (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath!
      : ''

  const candidates = [
    // Packaged flat + arch
    resourcesPath ? join(resourcesPath, 'tables', name) : '',
    resourcesPath ? join(resourcesPath, 'tables', platformArchDir(), name) : '',
    // Dev: staged electron resources
    join(process.cwd(), 'apps/electron/resources/tables', name),
    join(process.cwd(), 'apps/electron/resources/tables', platformArchDir(), name),
    join(app.getAppPath(), 'resources/tables', name),
    // Dev: build in nested fork
    join(process.cwd(), 'test/plydb', name),
    join(process.cwd(), 'test/plydb', binaryName()),
  ].filter(Boolean)

  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  return null
}

async function waitForHealth(url: string, token?: string): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS
  let lastErr: unknown
  while (Date.now() < deadline) {
    try {
      const headers: Record<string, string> = {}
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch(`${url}/health`, { headers })
      if (res.ok) {
        const body = (await res.json()) as { ok?: boolean; service?: string }
        if (body.ok) return
      }
      lastErr = new Error(`health status ${res.status}`)
    } catch (err) {
      lastErr = err
    }
    await new Promise((r) => setTimeout(r, HEALTH_POLL_MS))
  }
  throw new Error(
    `Tables health check timed out after ${HEALTH_TIMEOUT_MS}ms` +
      (lastErr ? `: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}` : ''),
  )
}

function buildStatus(): TablesSidecarStatus {
  return {
    ready,
    starting,
    external,
    baseUrl,
    token: secrets?.token ?? null,
    port,
    error: lastError,
    pid: proc?.pid ?? null,
    dataDir: boundDataDir,
  }
}

function buildConfig(): TablesSidecarConfig | null {
  if (!ready || !baseUrl || !secrets) return null
  return {
    baseUrl,
    token: secrets.token,
    ready: true,
    dataDir: boundDataDir,
  }
}

export type StartTablesSidecarOptions = {
  /** Absolute workspace rootPath; defaults to active workspace from registry. */
  workspaceRootPath?: string | null
}

/**
 * Start the sidecar (or attach to CRAFT_TABLES_URL). Idempotent for the same
 * workspace data dir; restarts when the active workspace data dir changes.
 */
export async function startTablesSidecar(
  options?: StartTablesSidecarOptions,
): Promise<TablesSidecarConfig> {
  const tablesDir = resolveWorkspaceTablesDir(options?.workspaceRootPath)

  if (ready && baseUrl && secrets && boundDataDir === tablesDir) {
    return { baseUrl, token: secrets.token, ready: true, dataDir: tablesDir }
  }
  if (startPromise) return startPromise

  if (ready && boundDataDir && boundDataDir !== tablesDir) {
    await stopTablesSidecar()
  }

  startPromise = (async () => {
    starting = true
    lastError = null
    secrets = loadOrCreateSecrets()
    mkdirSync(tablesDir, { recursive: true })

    const externalUrl = process.env.CRAFT_TABLES_URL?.trim()
    if (externalUrl) {
      external = true
      baseUrl = externalUrl.replace(/\/+$/, '')
      boundDataDir = tablesDir
      try {
        const parsed = new URL(baseUrl)
        port = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80
      } catch {
        port = null
      }
      await waitForHealth(baseUrl)
      ready = true
      starting = false
      return { baseUrl, token: secrets.token, ready: true, dataDir: tablesDir }
    }

    external = false
    const bin = resolveTablesBinary()
    if (!bin) {
      throw new Error(
        'Tables (plydb) binary not found. Run `bun run setup:tables` or set CRAFT_TABLES_URL / CRAFT_TABLES_BIN.',
      )
    }

    try {
      chmodSync(bin, 0o755)
    } catch {
      // ignore on Windows / non-owner
    }

    port = await allocateEphemeralPort()
    baseUrl = `http://127.0.0.1:${port}`

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      TABLES_TOKEN: secrets.token,
      TABLES_DATA_DIR: tablesDir,
      TABLES_ADDR: `127.0.0.1:${port}`,
    }

    proc = spawn(bin, ['serve', '--addr', `127.0.0.1:${port}`, '--data-dir', tablesDir, '--token', secrets.token], {
      cwd: tablesDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    proc.stdout?.setEncoding('utf8')
    proc.stdout?.on('data', (chunk: string) => {
      for (const line of chunk.split('\n').filter(Boolean)) {
        console.log(`[tables] ${line}`)
      }
    })
    proc.stderr?.setEncoding('utf8')
    proc.stderr?.on('data', (chunk: string) => {
      for (const line of chunk.split('\n').filter(Boolean)) {
        console.warn(`[tables] ${line}`)
      }
    })
    proc.on('exit', (code, signal) => {
      const wasReady = ready
      ready = false
      starting = false
      proc = null
      boundDataDir = null
      if (wasReady || code !== 0) {
        lastError = `sidecar exited code=${code ?? 'null'} signal=${signal ?? 'null'}`
        console.warn(`[tables] ${lastError}`)
      }
    })

    try {
      await waitForHealth(baseUrl)
      ready = true
      starting = false
      boundDataDir = tablesDir
      return { baseUrl, token: secrets.token, ready: true, dataDir: tablesDir }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      starting = false
      await stopTablesSidecar()
      throw err
    }
  })()

  try {
    return await startPromise
  } finally {
    startPromise = null
  }
}

export async function stopTablesSidecar(): Promise<void> {
  ready = false
  starting = false
  boundDataDir = null
  if (external) {
    external = false
    baseUrl = null
    port = null
    return
  }
  const child = proc
  proc = null
  if (!child) return

  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL')
      } catch {
        // ignore
      }
      resolve()
    }, STOP_TIMEOUT_MS)

    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })

    try {
      child.kill('SIGTERM')
    } catch {
      clearTimeout(timer)
      resolve()
    }
  })
}

export async function restartTablesSidecar(
  options?: StartTablesSidecarOptions,
): Promise<TablesSidecarConfig> {
  await stopTablesSidecar()
  return startTablesSidecar(options)
}

export function getTablesSidecarStatus(): TablesSidecarStatus {
  return buildStatus()
}

export function getTablesSidecarConfig(): TablesSidecarConfig | null {
  return buildConfig()
}

export async function ensureTablesSidecar(
  options?: StartTablesSidecarOptions,
): Promise<TablesSidecarConfig> {
  return startTablesSidecar(options)
}

/**
 * Build a multipart body for Admin upload. Prefers reading `filePath` from disk.
 */
async function buildMultipartBody(
  multipart: NonNullable<TablesFetchRequest['multipart']>,
): Promise<FormData> {
  const form = new FormData()
  for (const [key, value] of Object.entries(multipart.fields ?? {})) {
    if (value != null && value !== '') form.append(key, value)
  }

  const file = multipart.file
  const fieldName = file.fieldName ?? 'file'
  const mime = file.mimeType || 'application/octet-stream'

  let bytes: Uint8Array
  if (file.filePath) {
    if (!existsSync(file.filePath)) {
      throw new Error(`Upload file not found: ${file.filePath}`)
    }
    bytes = readFileSync(file.filePath)
  } else if (file.dataBase64) {
    bytes = Buffer.from(file.dataBase64, 'base64')
  } else {
    throw new Error('multipart.file requires filePath or dataBase64')
  }

  form.append(
    fieldName,
    new File([Buffer.from(bytes)], file.fileName, { type: mime }),
  )
  return form
}

/**
 * Proxy an HTTP request to the local sidecar from the main process.
 * Rebinds `--data-dir` to the active workspace when it changed.
 */
export async function fetchTablesViaMain(request: TablesFetchRequest): Promise<TablesFetchResponse> {
  const config = await ensureTablesSidecar({
    workspaceRootPath: request.workspaceRootPath,
  })
  const path = request.path.startsWith('/') ? request.path : `/${request.path}`
  const url = `${config.baseUrl}${path}`

  const headers = new Headers(request.headers ?? {})
  const token = (request.bearerToken ?? config.token)?.trim()
  if (token && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${token}`)
  }

  let body: string | FormData | undefined
  if (request.multipart) {
    // Let fetch set multipart boundary — strip any caller Content-Type.
    headers.delete('content-type')
    body = await buildMultipartBody(request.multipart)
  } else if (request.body != null) {
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json')
    }
    body = request.body
  }

  const response = await fetch(url, {
    method: request.method,
    headers,
    body,
  })
  const text = await response.text()
  return {
    status: response.status,
    body: text,
    contentType: response.headers.get('content-type'),
  }
}
