/**
 * Workspace module path helpers — rootPath-only storage contract.
 * See docs/workspace-storage.md.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  createWorkspaceAtPath,
  ensureWorkspaceModuleDirs,
  getWorkspaceModulePath,
  getWorkspaceRssDbPath,
  getWorkspaceTablesDataPath,
  getWorkspaceWorkflowsDbPath,
  getWorkspaceWorkflowsDefinitionsPath,
} from '../storage.ts'

describe('workspace module paths', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ws-modules-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('builds module paths under rootPath, not under workspace id', () => {
    const id = '9ab64bb1-5cd9-61c6-b79a-00ae1cda2b1d'
    expect(getWorkspaceRssDbPath(root)).toBe(join(root, 'modules', 'rss', 'rss.db'))
    expect(getWorkspaceWorkflowsDbPath(root)).toBe(
      join(root, 'modules', 'workflows', 'workflows.db'),
    )
    expect(getWorkspaceTablesDataPath(root)).toBe(join(root, 'modules', 'tables'))
    expect(getWorkspaceModulePath(root, 'knowledge')).toBe(join(root, 'modules', 'knowledge'))
    expect(getWorkspaceRssDbPath(root)).not.toContain(id)
  })

  it('ensureWorkspaceModuleDirs creates reserved tree', () => {
    ensureWorkspaceModuleDirs(root)
    expect(existsSync(join(root, 'modules', 'rss'))).toBe(true)
    expect(existsSync(join(root, 'modules', 'tables'))).toBe(true)
    expect(existsSync(join(root, 'modules', 'workflows'))).toBe(true)
    expect(existsSync(getWorkspaceWorkflowsDefinitionsPath(root))).toBe(true)
    expect(existsSync(join(root, 'modules', 'knowledge', 'docs'))).toBe(true)
    expect(existsSync(join(root, 'modules', 'knowledge', 'index'))).toBe(true)
  })

  it('createWorkspaceAtPath ensures modules dirs', () => {
    const wsRoot = join(root, 'acme-slug')
    createWorkspaceAtPath(wsRoot, 'Acme', undefined, 'uuid-workspace-1')
    expect(existsSync(join(wsRoot, 'modules', 'rss'))).toBe(true)
    expect(existsSync(join(wsRoot, 'modules', 'tables'))).toBe(true)
    expect(existsSync(join(wsRoot, 'modules', 'workflows', 'definitions'))).toBe(true)
  })
})
