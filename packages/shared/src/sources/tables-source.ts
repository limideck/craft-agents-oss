/**
 * Idempotently ensure a Tables (plydb) HTTP MCP source exists in a workspace.
 *
 * Creates `sources/tables` with bearer auth pointing at the sidecar `/mcp`
 * endpoint. Updates URL + credential when the sidecar port/token changes.
 */

import {
  createSource,
  loadSource,
  loadSourceConfig,
  markSourceAuthenticated,
  saveSourceConfig,
} from './storage.ts'
import { getSourceCredentialManager } from './credential-manager.ts'

export const TABLES_SOURCE_SLUG = 'tables'
export const TABLES_SOURCE_NAME = 'Tables'
export const TABLES_PROVIDER = 'tables'
/** Shown in <sources> when the source is first introduced this session */
export const TABLES_TAGLINE =
  'Query and mutate workspace data (CSV, JSON, SQLite, DuckDB) — create_table, insert/update/delete_rows, query, list_sources'

export interface EnsureTablesSourceInput {
  workspaceRootPath: string
  baseUrl: string
  token: string
}

export interface EnsureTablesSourceResult {
  slug: string
  created: boolean
  updated: boolean
  mcpUrl: string
}

function mcpUrlFor(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/mcp`
}

export async function ensureTablesMcpSource(
  input: EnsureTablesSourceInput,
): Promise<EnsureTablesSourceResult> {
  const mcpUrl = mcpUrlFor(input.baseUrl)
  const existing = loadSource(input.workspaceRootPath, TABLES_SOURCE_SLUG)
  let created = false
  let updated = false

  if (!existing) {
    await createSource(input.workspaceRootPath, {
      name: TABLES_SOURCE_SLUG,
      provider: TABLES_PROVIDER,
      type: 'mcp',
      enabled: true,
      mcp: {
        transport: 'http',
        url: mcpUrl,
        authType: 'bearer',
      },
    })
    const createdConfig = loadSourceConfig(input.workspaceRootPath, TABLES_SOURCE_SLUG)
    if (createdConfig) {
      createdConfig.name = TABLES_SOURCE_NAME
      saveSourceConfig(input.workspaceRootPath, createdConfig)
    }
    created = true
  } else {
    const config = loadSourceConfig(input.workspaceRootPath, TABLES_SOURCE_SLUG)
    if (config) {
      const needsUpdate =
        config.mcp?.url !== mcpUrl ||
        config.mcp?.transport !== 'http' ||
        config.mcp?.authType !== 'bearer' ||
        config.provider !== TABLES_PROVIDER ||
        config.type !== 'mcp'

      if (needsUpdate) {
        config.mcp = {
          ...config.mcp,
          transport: 'http',
          url: mcpUrl,
          authType: 'bearer',
        }
        config.provider = TABLES_PROVIDER
        config.type = 'mcp'
        config.updatedAt = Date.now()
        saveSourceConfig(input.workspaceRootPath, config)
        updated = true
      }
    }
  }

  const source = loadSource(input.workspaceRootPath, TABLES_SOURCE_SLUG)
  if (!source) {
    throw new Error(`Failed to load Tables source after create/update: ${TABLES_SOURCE_SLUG}`)
  }

  const credManager = getSourceCredentialManager()
  const existingCred = await credManager.load(source)
  if (existingCred?.value !== input.token) {
    await credManager.save(source, { value: input.token })
    updated = true
  }
  markSourceAuthenticated(input.workspaceRootPath, TABLES_SOURCE_SLUG)

  return { slug: TABLES_SOURCE_SLUG, created, updated, mcpUrl }
}
