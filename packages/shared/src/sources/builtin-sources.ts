/**
 * Built-in Sources
 *
 * System-level sources that are always available in every workspace.
 * These sources are not shown in the sources list UI but are available
 * for the agent to use.
 *
 * NOTE: craft-agents-docs is now an always-available MCP server configured
 * directly in craft-agent.ts, not a source. This file is kept for backwards
 * compatibility but returns empty results.
 *
 * Prefer-builtin MCP: `craft-modules` is a real on-disk workspace Source
 * (upserted by sidecar lifecycle). It is marked preferred via
 * {@link isPreferredBuiltinSource} — do NOT treat it as a virtual builtin
 * in {@link isBuiltinSource} / {@link getBuiltinSources} or loadSource breaks.
 */

import type { LoadedSource, FolderSourceConfig } from './types.ts';

/** Prefer-builtin MCP source slug (must match craft-modules/mcp-source.ts). Inline to avoid circular import via storage. */
const PREFERRED_BUILTIN_SOURCE_SLUGS = new Set(['craft-modules']);

/**
 * Get all built-in sources for a workspace.
 *
 * Currently returns empty array - craft-agents-docs has been moved to
 * an always-available MCP server in craft-agent.ts.
 *
 * @param _workspaceId - The workspace ID (unused)
 * @param _workspaceRootPath - Absolute path to workspace root folder (unused)
 * @returns Empty array (no built-in sources)
 */
export function getBuiltinSources(_workspaceId: string, _workspaceRootPath: string): LoadedSource[] {
  return [];
}

/**
 * Get the built-in Craft Agents docs source.
 *
 * @deprecated craft-agents-docs is now an always-available MCP server
 * configured directly in craft-agent.ts. This function is kept for
 * backwards compatibility but returns a placeholder.
 */
export function getDocsSource(workspaceId: string, workspaceRootPath: string): LoadedSource {
  // Return a placeholder - this shouldn't be called anymore
  const placeholderConfig: FolderSourceConfig = {
    id: 'builtin-craft-agents-docs',
    name: 'Craft Agents Docs',
    slug: 'craft-agents-docs',
    enabled: false,
    provider: 'mintlify',
    type: 'mcp',
    mcp: {
      transport: 'http',
      url: 'https://agents.craft.do/docs/mcp',
      authType: 'none',
    },
    tagline: 'Search Craft Agents documentation and source setup guides',
    icon: '📚',
    isAuthenticated: true,
    connectionStatus: 'connected',
  };

  return {
    workspaceId,
    workspaceRootPath,
    folderPath: '',
    config: placeholderConfig,
    guide: { raw: '' },
    isBuiltin: true,
  };
}

/**
 * Check if a source slug is a virtual built-in source (not on disk).
 *
 * Returns false - craft-agents-docs is now an always-available MCP server,
 * not a source in the sources system. Prefer-builtin `craft-modules` is a
 * normal disk Source — use {@link isPreferredBuiltinSource} instead.
 *
 * @param _slug - Source slug to check (unused)
 * @returns false (no virtual built-in sources)
 */
export function isBuiltinSource(_slug: string): boolean {
  return false;
}

/**
 * Preferred builtin MCP sources that agents should favor for matching intents
 * (see docs/craft-modules-agent-routing.md). These still live on disk.
 */
export function isPreferredBuiltinSource(slug: string): boolean {
  return PREFERRED_BUILTIN_SOURCE_SLUGS.has(slug);
}
