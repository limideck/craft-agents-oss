/**
 * OpenConnector sidecar lifecycle for Craft Agents Electron.
 *
 * Spawns the nested open-connector Node server (system Node in dev;
 * ELECTRON_RUN_AS_NODE fallback / packaged entry), polls GET /health,
 * and exposes config/tokens to the renderer via IPC.
 *
 * Set CRAFT_OPENCONNECTOR_URL to attach to an already-running instance
 * (skips spawn — useful for `cd open-connector && npm run start`).
 */

import { spawn, type ChildProcess } from 'child_process'
import { createServer } from 'net'
import { randomBytes } from 'crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { CONFIG_DIR } from '@craft-agent/shared/config'
import { OpenConnectorClient } from '@craft-agent/open-connector-client'
import type {
  OpenConnectorFetchRequest,
  OpenConnectorFetchResponse,
  OpenConnectorSidecarConfig,
  OpenConnectorSidecarStatus,
} from '../shared/open-connector'

export type {
  OpenConnectorFetchRequest,
  OpenConnectorFetchResponse,
  OpenConnectorSidecarConfig,
  OpenConnectorSidecarStatus,
}
export { OPEN_CONNECTOR_SOURCE_SLUG } from '../shared/open-connector'

interface PersistedSecrets {
  adminToken: string
  runtimeToken: string
  encryptionKey: string
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
let startPromise: Promise<OpenConnectorSidecarConfig> | null = null

function dataDir(): string {
  return join(CONFIG_DIR, 'open-connector')
}

function secretsPath(): string {
  return join(dataDir(), SECRETS_FILENAME)
}

function generateToken(): string {
  return randomBytes(32).toString('hex')
}

function loadOrCreateSecrets(): PersistedSecrets {
  mkdirSync(dataDir(), { recursive: true })
  const path = secretsPath()
  if (existsSync(path)) {
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<PersistedSecrets>
      if (parsed.adminToken && parsed.runtimeToken && parsed.encryptionKey) {
        return {
          adminToken: parsed.adminToken,
          runtimeToken: parsed.runtimeToken,
          encryptionKey: parsed.encryptionKey,
        }
      }
    } catch {
      // regenerate below
    }
  }
  const created: PersistedSecrets = {
    adminToken: generateToken(),
    runtimeToken: generateToken(),
    encryptionKey: generateToken(),
  }
  writeFileSync(path, JSON.stringify(created, null, 2), { mode: 0o600 })
  return created
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

function resolveSystemNode(): string | null {
  const fromEnv = process.env.CRAFT_OPENCONNECTOR_NODE?.trim()
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  // Common PATH locations — avoid relying on shell resolution inside Electron.
  const candidates =
    process.platform === 'win32'
      ? ['C:\\Program Files\\nodejs\\node.exe']
      : ['/usr/local/bin/node', '/opt/homebrew/bin/node', '/usr/bin/node']
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

function resolveServerEntry(): string | null {
  if (app.isPackaged) {
    const packaged = join(process.resourcesPath, 'open-connector', 'server', 'index.js')
    return existsSync(packaged) ? packaged : null
  }

  // Dev: prefer nested clone entry (Node can run TypeScript via --experimental-strip-types
  // on recent Node, but open-connector uses .ts imports — use the package's start path).
  const candidates = [
    join(process.cwd(), 'open-connector', 'src', 'server', 'index.ts'),
    join(app.getAppPath(), 'open-connector', 'src', 'server', 'index.ts'),
    join(process.cwd(), '..', '..', 'open-connector', 'src', 'server', 'index.ts'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

function resolveOpenConnectorCwd(entry: string): string {
  // Entry is .../open-connector/src/server/index.ts → cwd = open-connector root
  if (entry.includes(`${join('open-connector', 'src', 'server')}`) || entry.includes('open-connector/src/server')) {
    return join(entry, '..', '..', '..')
  }
  // Packaged: .../open-connector/server/index.js → cwd = open-connector
  return join(entry, '..', '..')
}

function catalogAppsDir(cwd: string): string {
  return join(cwd, 'catalog', 'apps')
}

/** Count generated provider JSON files; returns 0 if the catalog dir is missing. */
export function countCatalogProviders(cwd: string): number {
  const dir = catalogAppsDir(cwd)
  if (!existsSync(dir)) return 0
  try {
    return readdirSync(dir).filter((name) => name.endsWith('.json')).length
  } catch {
    return 0
  }
}

function assertCatalogPresent(cwd: string): void {
  const count = countCatalogProviders(cwd)
  if (count > 0) return
  throw new Error(
    'OpenConnector provider catalog is empty or missing (catalog/apps/*.json). ' +
      'Run `bun run setup:open-connector` from the repo root, then restart Craft Agents.',
  )
}

async function waitForHealth(url: string, timeoutMs = HEALTH_TIMEOUT_MS): Promise<void> {
  const client = new OpenConnectorClient({ baseUrl: url })
  const deadline = Date.now() + timeoutMs
  let lastErr: unknown
  while (Date.now() < deadline) {
    try {
      const health = await client.get<{ ok?: boolean }>('/health')
      if (health?.ok) return
    } catch (err) {
      lastErr = err
    }
    await new Promise((r) => setTimeout(r, HEALTH_POLL_MS))
  }
  throw new Error(
    `OpenConnector health check timed out after ${timeoutMs}ms` +
      (lastErr instanceof Error ? `: ${lastErr.message}` : ''),
  )
}

function buildStatus(): OpenConnectorSidecarStatus {
  return {
    ready,
    starting,
    external,
    baseUrl,
    adminToken: secrets?.adminToken ?? null,
    runtimeToken: secrets?.runtimeToken ?? null,
    port,
    error: lastError,
    pid: proc?.pid ?? null,
  }
}

function buildConfig(): OpenConnectorSidecarConfig | null {
  if (!ready || !baseUrl || !secrets) return null
  return {
    baseUrl,
    adminToken: secrets.adminToken,
    runtimeToken: secrets.runtimeToken,
    ready: true,
  }
}

/**
 * Start the sidecar (or attach to CRAFT_OPENCONNECTOR_URL). Idempotent.
 */
export async function startOpenConnectorSidecar(): Promise<OpenConnectorSidecarConfig> {
  if (ready && baseUrl && secrets) {
    return {
      baseUrl,
      adminToken: secrets.adminToken,
      runtimeToken: secrets.runtimeToken,
      ready: true,
    }
  }
  if (startPromise) return startPromise

  startPromise = (async () => {
    starting = true
    lastError = null
    secrets = loadOrCreateSecrets()

    const externalUrl = process.env.CRAFT_OPENCONNECTOR_URL?.trim()
    if (externalUrl) {
      external = true
      baseUrl = externalUrl.replace(/\/+$/, '')
      try {
        const parsed = new URL(baseUrl)
        port = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80
      } catch {
        port = null
      }
      await waitForHealth(baseUrl)
      ready = true
      starting = false
      return {
        baseUrl,
        adminToken: secrets.adminToken,
        runtimeToken: secrets.runtimeToken,
        ready: true,
      }
    }

    external = false
    const entry = resolveServerEntry()
    if (!entry) {
      throw new Error(
        'OpenConnector server entry not found. Run `bun run scripts/setup-open-connector.ts` ' +
          'or set CRAFT_OPENCONNECTOR_URL to a running instance.',
      )
    }

    port = await allocateEphemeralPort()
    baseUrl = `http://127.0.0.1:${port}`
    const cwd = resolveOpenConnectorCwd(entry)
    assertCatalogPresent(cwd)

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      OOMOL_CONNECT_DATA_DIR: dataDir(),
      OOMOL_CONNECT_ADMIN_TOKEN: secrets.adminToken,
      OOMOL_CONNECT_RUNTIME_TOKEN: secrets.runtimeToken,
      OOMOL_CONNECT_ENCRYPTION_KEY: secrets.encryptionKey,
      OOMOL_CONNECT_ORIGIN: baseUrl,
    }

    // Prefer system Node (open-connector needs Node 22+ for .ts strip + node:sqlite).
    // Packaged builds should ship a prebuilt JS entry and may use ELECTRON_RUN_AS_NODE.
    const nodeBin =
      process.env.CRAFT_OPENCONNECTOR_NODE ||
      (!app.isPackaged ? resolveSystemNode() : null) ||
      process.execPath

    const spawnEnv: NodeJS.ProcessEnv = { ...env }
    if (nodeBin === process.execPath) {
      spawnEnv.ELECTRON_RUN_AS_NODE = '1'
    } else {
      delete spawnEnv.ELECTRON_RUN_AS_NODE
    }

    proc = spawn(nodeBin, [entry], {
      cwd,
      env: spawnEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    proc.stdout?.setEncoding('utf8')
    proc.stdout?.on('data', (chunk: string) => {
      for (const line of chunk.split('\n').filter(Boolean)) {
        console.log(`[open-connector] ${line}`)
      }
    })
    proc.stderr?.setEncoding('utf8')
    proc.stderr?.on('data', (chunk: string) => {
      for (const line of chunk.split('\n').filter(Boolean)) {
        console.warn(`[open-connector] ${line}`)
      }
    })
    proc.on('exit', (code, signal) => {
      const wasReady = ready
      ready = false
      starting = false
      proc = null
      if (wasReady || code !== 0) {
        lastError = `sidecar exited code=${code ?? 'null'} signal=${signal ?? 'null'}`
        console.warn(`[open-connector] ${lastError}`)
      }
    })

    try {
      await waitForHealth(baseUrl)
      ready = true
      starting = false
      return {
        baseUrl,
        adminToken: secrets.adminToken,
        runtimeToken: secrets.runtimeToken,
        ready: true,
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      starting = false
      await stopOpenConnectorSidecar()
      throw err
    }
  })()

  try {
    return await startPromise
  } finally {
    startPromise = null
  }
}

export async function stopOpenConnectorSidecar(): Promise<void> {
  ready = false
  starting = false
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

export async function restartOpenConnectorSidecar(): Promise<OpenConnectorSidecarConfig> {
  await stopOpenConnectorSidecar()
  return startOpenConnectorSidecar()
}

export function getOpenConnectorSidecarStatus(): OpenConnectorSidecarStatus {
  return buildStatus()
}

export function getOpenConnectorSidecarConfig(): OpenConnectorSidecarConfig | null {
  return buildConfig()
}

/** Ensure started and return config (for IPC getConfig). */
export async function ensureOpenConnectorSidecar(): Promise<OpenConnectorSidecarConfig> {
  return startOpenConnectorSidecar()
}

/**
 * Proxy an HTTP request to the local sidecar from the main process.
 * Renderer cannot call http://127.0.0.1:{port} from the Vite origin (CORS).
 */
export async function fetchOpenConnectorViaMain(
  request: OpenConnectorFetchRequest,
): Promise<OpenConnectorFetchResponse> {
  const config = await ensureOpenConnectorSidecar()
  const path = request.path.startsWith('/') ? request.path : `/${request.path}`
  const url = `${config.baseUrl}${path}`

  const headers = new Headers(request.headers ?? {})
  const token = (request.bearerToken ?? config.adminToken)?.trim()
  if (token && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${token}`)
  }
  if (request.body != null && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  const response = await fetch(url, {
    method: request.method,
    headers,
    body: request.body,
  })
  const body = await response.text()
  return {
    status: response.status,
    body,
    contentType: response.headers.get('content-type'),
  }
}
