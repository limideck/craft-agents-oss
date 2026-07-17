/**
 * Idempotently ensure an OpenConnector HTTP MCP source exists in a workspace.
 *
 * Creates `sources/open-connector` with bearer auth pointing at the sidecar
 * `/mcp` endpoint, and stores the runtime token via SourceCredentialManager.
 * Updates URL + credential when the sidecar port/token changes.
 */

import {
  createSource,
  loadSource,
  loadSourceConfig,
  markSourceAuthenticated,
  saveSourceConfig,
} from './storage.ts'
import { getSourceCredentialManager } from './credential-manager.ts'

export const OPEN_CONNECTOR_SOURCE_SLUG = 'open-connector'
export const OPEN_CONNECTOR_SOURCE_NAME = 'OpenConnector'
export const OPEN_CONNECTOR_PROVIDER = 'open-connector'

export interface EnsureOpenConnectorSourceInput {
  workspaceRootPath: string
  baseUrl: string
  runtimeToken: string
}

export interface EnsureOpenConnectorSourceResult {
  slug: string
  created: boolean
  updated: boolean
  mcpUrl: string
}

function mcpUrlFor(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/mcp`
}

export async function ensureOpenConnectorMcpSource(
  input: EnsureOpenConnectorSourceInput,
): Promise<EnsureOpenConnectorSourceResult> {
  const mcpUrl = mcpUrlFor(input.baseUrl)
  const existing = loadSource(input.workspaceRootPath, OPEN_CONNECTOR_SOURCE_SLUG)
  let created = false
  let updated = false

  if (!existing) {
    await createSource(input.workspaceRootPath, {
      // Name slugifies to OPEN_CONNECTOR_SOURCE_SLUG (ASCII slug chars).
      name: OPEN_CONNECTOR_SOURCE_SLUG,
      provider: OPEN_CONNECTOR_PROVIDER,
      type: 'mcp',
      enabled: true,
      mcp: {
        transport: 'http',
        url: mcpUrl,
        authType: 'bearer',
      },
    })
    // Restore friendly display name while keeping the folder slug.
    const createdConfig = loadSourceConfig(input.workspaceRootPath, OPEN_CONNECTOR_SOURCE_SLUG)
    if (createdConfig) {
      createdConfig.name = OPEN_CONNECTOR_SOURCE_NAME
      saveSourceConfig(input.workspaceRootPath, createdConfig)
    }
    created = true
  } else {
    const config = loadSourceConfig(input.workspaceRootPath, OPEN_CONNECTOR_SOURCE_SLUG)
    if (config) {
      const needsUpdate =
        config.mcp?.url !== mcpUrl ||
        config.mcp?.transport !== 'http' ||
        config.mcp?.authType !== 'bearer' ||
        config.provider !== OPEN_CONNECTOR_PROVIDER ||
        config.type !== 'mcp'

      if (needsUpdate) {
        config.mcp = {
          ...config.mcp,
          transport: 'http',
          url: mcpUrl,
          authType: 'bearer',
        }
        config.provider = OPEN_CONNECTOR_PROVIDER
        config.type = 'mcp'
        config.updatedAt = Date.now()
        saveSourceConfig(input.workspaceRootPath, config)
        updated = true
      }
    }
  }

  const source = loadSource(input.workspaceRootPath, OPEN_CONNECTOR_SOURCE_SLUG)
  if (!source) {
    throw new Error(`Failed to load OpenConnector source after create/update: ${OPEN_CONNECTOR_SOURCE_SLUG}`)
  }

  const credManager = getSourceCredentialManager()
  const existingCred = await credManager.load(source)
  if (existingCred?.value !== input.runtimeToken) {
    await credManager.save(source, { value: input.runtimeToken })
    updated = true
  }
  markSourceAuthenticated(input.workspaceRootPath, OPEN_CONNECTOR_SOURCE_SLUG)

  return {
    slug: OPEN_CONNECTOR_SOURCE_SLUG,
    created,
    updated,
    mcpUrl,
  }
}
