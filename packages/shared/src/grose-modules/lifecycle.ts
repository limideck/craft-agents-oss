/**
 * grose-modules sidecar lifecycle (Electron + headless).
 * No Electron `app` dependency — resolve binary via env / cwd / resourcesPath.
 */

import { spawn, type ChildProcess } from 'child_process'
import { createServer } from 'net'
import { randomBytes } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { CONFIG_DIR } from '../config/paths.ts'
import { setGroseModulesEndpoint } from './endpoint.ts'
import type { GroseModulesSidecarConfig, GroseModulesSidecarStatus } from './types.ts'

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
let startPromise: Promise<GroseModulesSidecarConfig> | null = null

function dataDir(): string {
  return join(CONFIG_DIR, 'grose-modules')
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
      if (parsed.token) return { token: parsed.token }
    } catch {
      // regenerate
    }
  }
  const created: PersistedSecrets = { token: generateToken() }
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

function binaryName(): string {
  return process.platform === 'win32' ? 'grose-modules.exe' : 'grose-modules'
}

function platformArchDir(): string {
  const plat = process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'darwin' : 'linux'
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  return `${plat}-${arch}`
}

/** Resolve grose-modules binary for spawn. */
export function resolveGroseModulesBinary(): string | null {
  const fromEnv = process.env.GROSE_MODULES_BIN?.trim()
  if (fromEnv && existsSync(fromEnv)) return fromEnv

  const name = binaryName()
  const resourcesPath =
    typeof (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath === 'string'
      ? (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath!
      : null

  const candidates = [
    resourcesPath ? join(resourcesPath, 'grose-modules', platformArchDir(), name) : null,
    resourcesPath ? join(resourcesPath, 'grose-modules', name) : null,
    // Dev staged copy (scripts/build-grose-modules.ts)
    join(process.cwd(), 'apps', 'electron', 'resources', 'grose-modules', platformArchDir(), name),
    join(process.cwd(), 'apps', 'electron', 'resources', 'grose-modules', name),
    join(process.cwd(), 'services', 'grose-modules', 'bin', name),
    join(process.cwd(), '..', '..', 'services', 'grose-modules', 'bin', name),
    join(process.cwd(), 'bin', name),
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

function workspacesRoot(): string {
  return process.env.GROSE_WORKSPACES_ROOT?.trim() || join(CONFIG_DIR, 'workspaces')
}

function groseConfigPath(): string {
  return process.env.GROSE_CONFIG_PATH?.trim() || join(CONFIG_DIR, 'config.json')
}

async function waitForHealth(url: string, timeoutMs = HEALTH_TIMEOUT_MS): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastErr: unknown
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url.replace(/\/+$/, '')}/health`)
      if (res.ok) {
        const data = (await res.json()) as { ok?: boolean }
        if (data.ok) return
      }
    } catch (err) {
      lastErr = err
    }
    await new Promise((r) => setTimeout(r, HEALTH_POLL_MS))
  }
  throw new Error(
    `grose-modules health check timed out after ${timeoutMs}ms` +
      (lastErr instanceof Error ? `: ${lastErr.message}` : ''),
  )
}

function applyEndpoint(): void {
  if (ready && baseUrl && secrets) {
    setGroseModulesEndpoint({ baseUrl, token: secrets.token, ready: true })
  } else {
    setGroseModulesEndpoint(null)
  }
}

export function getGroseModulesSidecarStatus(): GroseModulesSidecarStatus {
  return {
    ready,
    starting,
    external,
    baseUrl,
    token: secrets?.token ?? null,
    port,
    error: lastError,
    pid: proc?.pid ?? null,
  }
}

export function getGroseModulesSidecarConfig(): GroseModulesSidecarConfig | null {
  if (!ready || !baseUrl || !secrets) return null
  return { baseUrl, token: secrets.token, ready: true }
}

export async function startGroseModulesSidecar(options?: {
  /** Active/default workspace id for MCP tools that omit workspace_id */
  defaultWorkspaceId?: string | null
}): Promise<GroseModulesSidecarConfig> {
  if (ready && baseUrl && secrets) {
    return { baseUrl, token: secrets.token, ready: true }
  }
  if (startPromise) return startPromise

  const defaultWorkspaceId = options?.defaultWorkspaceId?.trim() || undefined

  startPromise = (async () => {
    starting = true
    lastError = null
    secrets = loadOrCreateSecrets()

    const externalUrl = process.env.GROSE_MODULES_URL?.trim()
    if (externalUrl) {
      external = true
      baseUrl = externalUrl.replace(/\/+$/, '')
      try {
        const parsed = new URL(baseUrl)
        port = parsed.port ? Number(parsed.port) : 80
      } catch {
        port = null
      }
      await waitForHealth(baseUrl)
      ready = true
      starting = false
      applyEndpoint()
      return { baseUrl, token: secrets.token, ready: true }
    }

    external = false
    const bin = resolveGroseModulesBinary()
    if (!bin) {
      throw new Error(
        'grose-modules binary not found. Run `cd services/grose-modules && make build` ' +
          'or set GROSE_MODULES_BIN / GROSE_MODULES_URL.',
      )
    }

    port = await allocateEphemeralPort()
    baseUrl = `http://127.0.0.1:${port}`

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PORT: String(port),
      GROSE_WORKSPACES_ROOT: workspacesRoot(),
      GROSE_CONFIG_PATH: groseConfigPath(),
      GROSE_MODULES_TOKEN: secrets.token,
      HOME: process.env.HOME || homedir(),
    }
    if (defaultWorkspaceId) {
      env.GROSE_DEFAULT_WORKSPACE_ID = defaultWorkspaceId
    }

    proc = spawn(bin, ['--port', String(port)], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    proc.stdout?.on('data', (buf: Buffer) => {
      const line = buf.toString().trim()
      if (line) console.info('[grose-modules]', line)
    })
    proc.stderr?.on('data', (buf: Buffer) => {
      const line = buf.toString().trim()
      if (line) console.info('[grose-modules]', line)
    })
    proc.on('exit', (code, signal) => {
      if (!external) {
        ready = false
        applyEndpoint()
        if (!starting) {
          lastError = `grose-modules exited (code=${code}, signal=${signal})`
        }
      }
      proc = null
    })

    try {
      await waitForHealth(baseUrl)
      ready = true
      starting = false
      applyEndpoint()
      return { baseUrl, token: secrets.token, ready: true }
    } catch (err) {
      starting = false
      lastError = err instanceof Error ? err.message : String(err)
      await stopGroseModulesSidecar()
      throw err
    }
  })()

  try {
    return await startPromise
  } finally {
    startPromise = null
  }
}

export async function stopGroseModulesSidecar(): Promise<void> {
  setGroseModulesEndpoint(null)
  ready = false
  starting = false
  baseUrl = null
  port = null

  if (external) {
    external = false
    return
  }

  const child = proc
  proc = null
  if (!child || child.killed) return

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

export async function restartGroseModulesSidecar(options?: {
  defaultWorkspaceId?: string | null
}): Promise<GroseModulesSidecarConfig> {
  await stopGroseModulesSidecar()
  return startGroseModulesSidecar(options)
}

export async function ensureGroseModulesSidecar(options?: {
  defaultWorkspaceId?: string | null
}): Promise<GroseModulesSidecarConfig> {
  return startGroseModulesSidecar(options)
}
