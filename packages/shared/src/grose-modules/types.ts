/** Wire types for grose-modules RSS + Workflows APIs. */

/** Known builtin module ids; open string union for future modules. */
export type GroseBuiltinModuleId = 'rss' | 'knowledge' | 'workflows' | 'sites' | (string & {})

export type GroseModulesRssFeed = {
  id: string
  name: string
  url: string
  last_fetched_at: number | null
}

export type GroseModulesRssArticle = {
  id: string
  feedId: string
  feedName: string
  title: string
  summary: string
  content: string
  link: string
  pubDate: string
  author: string
  audioUrl: string
  audioDuration: string
  isStarred: boolean
  updatedAt: number | null
}

export type GroseModulesRssView = 'all' | 'today' | 'starred' | 'podcast' | 'feed' | 'search'

export type GroseModulesRssListMode = 'latest' | 'digest'

export type GroseModulesEndpoint = {
  baseUrl: string
  token: string
  ready: boolean
}

export type GroseModulesSidecarStatus = {
  ready: boolean
  starting: boolean
  external: boolean
  baseUrl: string | null
  token: string | null
  port: number | null
  error: string | null
  pid: number | null
}

export type GroseModulesSidecarConfig = {
  baseUrl: string
  token: string
  ready: boolean
}

/** Workflow graph types — docs/workbench-workflows-contract.md */

export type GroseModulesWorkflowNodeType =
  | 'start'
  | 'schedule'
  | 'webhook'
  | 'agent'
  | 'generate-image'
  | 'parameter-extractor'
  | 'question-classifier'
  | 'text-splitter'
  | 'condition'
  | 'switch'
  | 'filter'
  | 'merge'
  | 'loop'
  | 'human-approval'
  | 'variables'
  | 'set-fields'
  | 'template'
  | 'json'
  | 'transform'
  | 'function'
  | 'batch'
  | 'aggregator'
  | 'csv'
  | 'sanitize'
  | 'http'
  | 'wait'
  | 'response'
  | 'debug'
  | 'subworkflow'

export type GroseModulesWorkflowNode = {
  id: string
  type: GroseModulesWorkflowNodeType | string
  name: string
  position: { x: number; y: number }
  config: Record<string, unknown>
}

export type GroseModulesWorkflowEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

export type GroseModulesWorkflow = {
  id: string
  name: string
  description?: string
  nodes: GroseModulesWorkflowNode[]
  edges: GroseModulesWorkflowEdge[]
  /** ISO-8601 */
  updatedAt: string
  /** draft until Deploy publishes a live snapshot. */
  status: 'draft' | 'deployed'
  /** deployed_version; 0 if never deployed. */
  version: number
  /** ISO-8601; set when deployed (or last deploy after undeploy). */
  deployedAt?: string
  /** Present when deployed and the live graph has schedule/webhook nodes. */
  triggersArmed?: GroseModulesWorkflowTriggersArmed
}

export type GroseModulesWorkflowArmedTrigger = {
  nodeId: string
  type: 'schedule' | 'webhook' | string
  name?: string
  cron?: string
  path?: string
  method?: string
}

export type GroseModulesWorkflowTriggersArmed = {
  /** True when live graph has at least one schedule or webhook node. */
  armed: boolean
  /** Documents that schedule/webhook runners are stub. */
  note?: string
  triggers: GroseModulesWorkflowArmedTrigger[]
}

export type GroseModulesWorkflowCreateInput = {
  name: string
  description?: string
  nodes?: GroseModulesWorkflowNode[]
  edges?: GroseModulesWorkflowEdge[]
}

export type GroseModulesWorkflowUpdateInput = {
  name?: string
  description?: string
  nodes?: GroseModulesWorkflowNode[]
  edges?: GroseModulesWorkflowEdge[]
}

export type GroseModulesWorkflowRunStep = {
  id: string
  nodeId: string
  name: string
  /** Node type discriminator (same as graph Node.type). */
  nodeType: string
  status: 'success' | 'error' | 'running' | 'skipped'
  durationMs: number
  input: unknown
  output: unknown
  error?: string
}

export type GroseModulesWorkflowRunResult = {
  accepted: true
  runId?: string
  /**
   * Per-node steps. Grose (`workflows:run` in server-core) executes `agent`
   * nodes via SessionManager; other types may still be lightweight stubs.
   */
  steps?: GroseModulesWorkflowRunStep[]
}

/** POST /api/workflows/:id/deploy (and undeploy) response. */
export type GroseModulesWorkflowDeployResult = {
  id: string
  version: number
  deployedAt?: string
  status: 'draft' | 'deployed'
  triggersArmed?: GroseModulesWorkflowTriggersArmed
}

/** Sites (建站) — agent-driven site builder */

export type GroseModulesSiteTemplate = 'blank' | 'landing' | 'website'
export type GroseModulesSiteStatus = 'idle' | 'installing' | 'ready' | 'previewing' | 'error'

export type GroseModulesSite = {
  id: string
  name: string
  slug: string
  template: GroseModulesSiteTemplate
  /** Absolute project directory */
  path: string
  previewPort: number | null
  previewUrl: string | null
  status: GroseModulesSiteStatus
  sessionId: string | null
  /** Unix ms */
  createdAt: number
  updatedAt: number
}

export type GroseModulesSiteFileNode = {
  name: string
  /** Relative to site root */
  path: string
  type: 'file' | 'directory'
  children?: GroseModulesSiteFileNode[]
}

export type GroseModulesSiteCreateInput = {
  name: string
  template?: GroseModulesSiteTemplate
  sessionId?: string
}

export type GroseModulesSiteUpdateInput = {
  name?: string
  sessionId?: string | null
}

export type GroseModulesVisualEdit = {
  type: 'text' | 'style'
  selector?: string
  line?: number
  column?: number
  oldValue?: string
  newValue: string
  /** For style, e.g. color, fontSize */
  property?: string
}

export type GroseModulesVisualEditSaveInput = {
  siteId: string
  /** Relative to site root */
  filePath: string
  edits: GroseModulesVisualEdit[]
}

export type GroseModulesSitePreviewResult = {
  previewUrl: string | null
  previewPort: number | null
  status: GroseModulesSiteStatus
}

