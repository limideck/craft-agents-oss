/**
 * Unit tests for ensureTablesMcpSource.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  ensureTablesMcpSource,
  TABLES_SOURCE_SLUG,
  TABLES_SOURCE_NAME,
} from '../tables-source.ts'
import { loadSourceConfig } from '../storage.ts'

describe('ensureTablesMcpSource', () => {
  let workspaceRoot: string

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'tables-source-'))
  })

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true })
  })

  it('creates tables MCP source with bearer auth', async () => {
    const result = await ensureTablesMcpSource({
      workspaceRootPath: workspaceRoot,
      baseUrl: 'http://127.0.0.1:3911',
      token: 'tables-token-1',
    })

    expect(result.slug).toBe(TABLES_SOURCE_SLUG)
    expect(result.created).toBe(true)
    expect(result.mcpUrl).toBe('http://127.0.0.1:3911/mcp')
    expect(existsSync(join(workspaceRoot, 'sources', TABLES_SOURCE_SLUG, 'config.json'))).toBe(true)

    const config = loadSourceConfig(workspaceRoot, TABLES_SOURCE_SLUG)
    expect(config?.name).toBe(TABLES_SOURCE_NAME)
    expect(config?.mcp?.url).toBe('http://127.0.0.1:3911/mcp')
    expect(config?.mcp?.authType).toBe('bearer')
    expect(config?.mcp?.transport).toBe('http')
    expect(config?.isAuthenticated).toBe(true)
  })

  it('updates URL when port changes (idempotent)', async () => {
    await ensureTablesMcpSource({
      workspaceRootPath: workspaceRoot,
      baseUrl: 'http://127.0.0.1:3911',
      token: 'tables-token-1',
    })

    const result = await ensureTablesMcpSource({
      workspaceRootPath: workspaceRoot,
      baseUrl: 'http://127.0.0.1:9999',
      token: 'tables-token-1',
    })

    expect(result.created).toBe(false)
    expect(result.updated).toBe(true)
    expect(result.mcpUrl).toBe('http://127.0.0.1:9999/mcp')

    const config = loadSourceConfig(workspaceRoot, TABLES_SOURCE_SLUG)
    expect(config?.mcp?.url).toBe('http://127.0.0.1:9999/mcp')

    const raw = readFileSync(join(workspaceRoot, 'sources', TABLES_SOURCE_SLUG, 'config.json'), 'utf8')
    expect(JSON.parse(raw).slug).toBe(TABLES_SOURCE_SLUG)
  })
})
