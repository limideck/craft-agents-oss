/**
 * Unit tests for ensureOpenConnectorMcpSource.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  ensureOpenConnectorMcpSource,
  OPEN_CONNECTOR_SOURCE_SLUG,
  OPEN_CONNECTOR_SOURCE_NAME,
} from '../open-connector-source.ts'
import { loadSourceConfig } from '../storage.ts'

describe('ensureOpenConnectorMcpSource', () => {
  let workspaceRoot: string

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'oc-source-'))
  })

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true })
  })

  it('creates open-connector MCP source with bearer auth', async () => {
    const result = await ensureOpenConnectorMcpSource({
      workspaceRootPath: workspaceRoot,
      baseUrl: 'http://127.0.0.1:3847',
      runtimeToken: 'runtime-token-1',
    })

    expect(result.slug).toBe(OPEN_CONNECTOR_SOURCE_SLUG)
    expect(result.created).toBe(true)
    expect(result.mcpUrl).toBe('http://127.0.0.1:3847/mcp')
    expect(existsSync(join(workspaceRoot, 'sources', OPEN_CONNECTOR_SOURCE_SLUG, 'config.json'))).toBe(true)

    const config = loadSourceConfig(workspaceRoot, OPEN_CONNECTOR_SOURCE_SLUG)
    expect(config?.name).toBe(OPEN_CONNECTOR_SOURCE_NAME)
    expect(config?.mcp?.url).toBe('http://127.0.0.1:3847/mcp')
    expect(config?.mcp?.authType).toBe('bearer')
    expect(config?.mcp?.transport).toBe('http')
    expect(config?.isAuthenticated).toBe(true)
  })

  it('updates URL when port changes (idempotent)', async () => {
    await ensureOpenConnectorMcpSource({
      workspaceRootPath: workspaceRoot,
      baseUrl: 'http://127.0.0.1:3847',
      runtimeToken: 'runtime-token-1',
    })

    const result = await ensureOpenConnectorMcpSource({
      workspaceRootPath: workspaceRoot,
      baseUrl: 'http://127.0.0.1:9999',
      runtimeToken: 'runtime-token-1',
    })

    expect(result.created).toBe(false)
    expect(result.updated).toBe(true)
    expect(result.mcpUrl).toBe('http://127.0.0.1:9999/mcp')

    const config = loadSourceConfig(workspaceRoot, OPEN_CONNECTOR_SOURCE_SLUG)
    expect(config?.mcp?.url).toBe('http://127.0.0.1:9999/mcp')

    // Still a single source directory
    const raw = readFileSync(join(workspaceRoot, 'sources', OPEN_CONNECTOR_SOURCE_SLUG, 'config.json'), 'utf8')
    expect(JSON.parse(raw).slug).toBe(OPEN_CONNECTOR_SOURCE_SLUG)
  })
})
