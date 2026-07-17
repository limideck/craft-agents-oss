/** Wire types for craft-modules RSS + Workflows APIs. */

export type CraftModulesRssFeed = {
  id: string
  name: string
  url: string
  last_fetched_at: number | null
}

export type CraftModulesRssArticle = {
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

export type CraftModulesRssView = 'all' | 'today' | 'starred' | 'podcast' | 'feed' | 'search'

export type CraftModulesRssListMode = 'latest' | 'digest'

export type CraftModulesEndpoint = {
  baseUrl: string
  token: string
  ready: boolean
}

export type CraftModulesSidecarStatus = {
  ready: boolean
  starting: boolean
  external: boolean
  baseUrl: string | null
  token: string | null
  port: number | null
  error: string | null
  pid: number | null
}

export type CraftModulesSidecarConfig = {
  baseUrl: string
  token: string
  ready: boolean
}

/** Workflow graph types — docs/workbench-workflows-contract.md */

export type CraftModulesWorkflowNodeType =
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

export type CraftModulesWorkflowNode = {
  id: string
  type: CraftModulesWorkflowNodeType | string
  name: string
  position: { x: number; y: number }
  config: Record<string, unknown>
}

export type CraftModulesWorkflowEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

export type CraftModulesWorkflow = {
  id: string
  name: string
  description?: string
  nodes: CraftModulesWorkflowNode[]
  edges: CraftModulesWorkflowEdge[]
  /** ISO-8601 */
  updatedAt: string
  /** draft until Deploy publishes a live snapshot. */
  status: 'draft' | 'deployed'
  /** deployed_version; 0 if never deployed. */
  version: number
  /** ISO-8601; set when deployed (or last deploy after undeploy). */
  deployedAt?: string
  /** Present when deployed and the live graph has schedule/webhook nodes. */
  triggersArmed?: CraftModulesWorkflowTriggersArmed
}

export type CraftModulesWorkflowArmedTrigger = {
  nodeId: string
  type: 'schedule' | 'webhook' | string
  name?: string
  cron?: string
  path?: string
  method?: string
}

export type CraftModulesWorkflowTriggersArmed = {
  /** True when live graph has at least one schedule or webhook node. */
  armed: boolean
  /** Documents that schedule/webhook runners are stub. */
  note?: string
  triggers: CraftModulesWorkflowArmedTrigger[]
}

export type CraftModulesWorkflowCreateInput = {
  name: string
  description?: string
  nodes?: CraftModulesWorkflowNode[]
  edges?: CraftModulesWorkflowEdge[]
}

export type CraftModulesWorkflowUpdateInput = {
  name?: string
  description?: string
  nodes?: CraftModulesWorkflowNode[]
  edges?: CraftModulesWorkflowEdge[]
}

export type CraftModulesWorkflowRunStep = {
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

export type CraftModulesWorkflowRunResult = {
  accepted: true
  runId?: string
  /**
   * Per-node steps. Craft (`workflows:run` in server-core) executes `agent`
   * nodes via SessionManager; other types may still be lightweight stubs.
   */
  steps?: CraftModulesWorkflowRunStep[]
}

/** POST /api/workflows/:id/deploy (and undeploy) response. */
export type CraftModulesWorkflowDeployResult = {
  id: string
  version: number
  deployedAt?: string
  status: 'draft' | 'deployed'
  triggersArmed?: CraftModulesWorkflowTriggersArmed
}

