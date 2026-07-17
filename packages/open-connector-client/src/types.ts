/**
 * Shared OpenConnector console / API types.
 * Adapted from open-connector/web/src/model.ts for use outside that app.
 */

export type AuthDefinition =
  | { type: 'no_auth' }
  | {
      type: 'api_key'
      label?: string
      placeholder?: string
      description?: string
      extraFields?: CredentialField[]
    }
  | { type: 'custom_credential'; fields: CredentialField[] }
  | {
      type: 'oauth2'
      scopes: string[]
      clientConfigFields?: CredentialField[]
    }

export interface CredentialField {
  key: string
  label: string
  inputType: 'text' | 'password' | 'textarea' | 'json'
  required: boolean
  secret: boolean
  placeholder?: string
  description?: string
}

export type JsonSchema = Record<string, unknown>

export interface ActionDefinition {
  id: string
  service: string
  name: string
  description: string
  requiredScopes: string[]
  inputSchema: JsonSchema
  outputSchema: JsonSchema
  execution: {
    locallyExecutable: boolean
    catalogOnly: boolean
    requiredAuthTypes: string[]
    noAuthRunnable: boolean
    needsCredential: boolean
  }
}

export interface ProviderDefinition {
  service: string
  displayName: string
  description?: string
  categories: string[]
  authTypes: string[]
  auth: AuthDefinition[]
  homepageUrl?: string
  iconUrl?: string
  actions: ActionDefinition[]
}

export interface ConnectionRecord {
  id?: string
  service: string
  connectionName?: string
  authType: string
  configured?: boolean
  virtual?: boolean
  default?: boolean
  profile?: Record<string, unknown> | null
  metadata: Record<string, unknown>
}

export interface OAuthConfig {
  service: string
  configured: boolean
  clientId: string | null
  expectedRedirectUri?: string
  auth?: Extract<AuthDefinition, { type: 'oauth2' }>
}

export interface RuntimeTokenSummary {
  id: string
  name: string
  createdAt: string
  lastUsedAt?: string
}

export interface RuntimeTokenCreation {
  token: string
  record: RuntimeTokenSummary
}

export interface RunLog {
  id: string
  service: string
  actionId: string
  caller: 'http' | 'mcp' | 'web'
  startedAt: string
  completedAt: string
  durationMs: number
  ok: boolean
  inputSummary?: unknown
  errorCode?: string
  errorMessage?: string
}

export interface RunLogPage {
  items: RunLog[]
  nextCursor?: string
}

export interface ExecutionResult {
  ok: boolean
  output?: unknown
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

export interface RuntimeActionResponse {
  success: boolean
  message?: string
  data?: unknown
  errorCode?: string
}

export interface HealthResponse {
  ok: boolean
}

export interface AuthSession {
  authenticated: boolean
  [key: string]: unknown
}
