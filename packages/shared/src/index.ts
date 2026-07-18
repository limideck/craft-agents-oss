/**
 * @grose-agent/shared
 *
 * Shared business logic for Grose Agent.
 * Used by the Electron app.
 *
 * Import specific modules via subpath exports:
 *   import { GroseAgent } from '@grose-agent/shared/agent';
 *   import { loadStoredConfig } from '@grose-agent/shared/config';
 *   import { getCredentialManager } from '@grose-agent/shared/credentials';
 *   import { GroseMcpClient } from '@grose-agent/shared/mcp';
 *   import { debug } from '@grose-agent/shared/utils';
 *   import { loadSource, createSource, getSourceCredentialManager } from '@grose-agent/shared/sources';
 *   import { createWorkspace, loadWorkspace } from '@grose-agent/shared/workspaces';
 *
 * Available modules:
 *   - agent: GroseAgent SDK wrapper, plan tools
 *   - auth: OAuth, token management, auth state
 *   - clients: Grose API client
 *   - config: Storage, models, preferences
 *   - credentials: Encrypted credential storage
 *   - mcp: MCP client, connection validation
 *   - prompts: System prompt generation
 *   - sources: Workspace-scoped source management (MCP, API, local)
 *   - utils: Debug logging, file handling, summarization
 *   - validation: URL validation
 *   - version: Version and installation management
 *   - workspaces: Workspace management (top-level organizational unit)
 */

// Export branding (standalone, no dependencies)
export * from './branding.ts';
