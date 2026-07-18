import type { WorkflowNodeType } from '../mock/types'
import type { BlockCategory, BlockConfig } from './types'

const HTTP_METHODS = [
  { id: 'GET', label: 'GET' },
  { id: 'POST', label: 'POST' },
  { id: 'PUT', label: 'PUT' },
  { id: 'PATCH', label: 'PATCH' },
  { id: 'DELETE', label: 'DELETE' },
]

const TIMEZONES = [
  { id: 'UTC', label: 'UTC' },
  { id: 'Asia/Shanghai', label: 'Asia/Shanghai' },
  { id: 'America/New_York', label: 'America/New_York' },
  { id: 'Europe/London', label: 'Europe/London' },
]

const MODEL_OPTIONS = [
  { id: 'default', label: 'Default' },
  { id: 'fast', label: 'Fast' },
]

const WAIT_UNITS = [
  { id: 'seconds', label: 'Seconds' },
  { id: 'minutes', label: 'Minutes' },
  { id: 'hours', label: 'Hours' },
  { id: 'days', label: 'Days' },
]

const MERGE_MODES = [
  { id: 'wait-all', label: 'Wait all' },
  { id: 'first', label: 'First wins' },
]

const LOOP_MODES = [
  { id: 'foreach', label: 'For each' },
  { id: 'while', label: 'While' },
]

const JSON_MODES = [
  { id: 'parse', label: 'Parse' },
  { id: 'stringify', label: 'Stringify' },
]

const IMAGE_SIZES = [
  { id: '1024x1024', label: '1024×1024' },
  { id: '1792x1024', label: '1792×1024' },
  { id: '1024x1792', label: '1024×1792' },
]

const APPROVAL_TIMEOUT = [
  { id: 'approved', label: 'Approve' },
  { id: 'rejected', label: 'Reject' },
]

const CSV_MODES = [
  { id: 'parse', label: 'Parse' },
  { id: 'stringify', label: 'Stringify' },
]

const AGGREGATE_OPS = [
  { id: 'count', label: 'Count' },
  { id: 'sum', label: 'Sum' },
  { id: 'avg', label: 'Average' },
  { id: 'min', label: 'Min' },
  { id: 'max', label: 'Max' },
]

const SANITIZE_STRATEGIES = [
  { id: 'mask', label: 'Mask' },
  { id: 'remove', label: 'Remove' },
  { id: 'hash', label: 'Hash' },
]

const DEBUG_OUTPUT = [
  { id: 'full', label: 'Full payload' },
  { id: 'keys', label: 'Keys only' },
  { id: 'summary', label: 'Summary' },
]

const SPLIT_STRATEGIES = [
  { id: 'fixed', label: 'Fixed size' },
  { id: 'separator', label: 'Separator' },
  { id: 'paragraph', label: 'Paragraph' },
]

const ACCENT: Record<BlockCategory, string> = {
  triggers: 'sky',
  ai: 'teal',
  flow: 'amber',
  data: 'emerald',
  action: 'orange',
}

export const BLOCK_REGISTRY: Record<WorkflowNodeType, BlockConfig> = {
  // ── Triggers ──────────────────────────────────────────────────────────
  start: {
    type: 'start',
    category: 'triggers',
    label: 'Start',
    description: 'Manual / chat / API entry',
    accent: ACCENT.triggers,
    handles: { source: ['source'] },
    fields: [
      {
        key: 'inputSchema',
        label: 'Input schema',
        type: 'json',
        placeholder: '{ }',
        default: {},
      },
    ],
  },
  schedule: {
    type: 'schedule',
    category: 'triggers',
    label: 'Schedule',
    description: 'Cron / interval trigger',
    accent: ACCENT.triggers,
    handles: { source: ['source'] },
    fields: [
      {
        key: 'cron',
        label: 'Cron',
        type: 'cron',
        required: true,
        placeholder: '0 9 * * *',
        default: '0 9 * * *',
      },
      {
        key: 'timezone',
        label: 'Timezone',
        type: 'select',
        options: TIMEZONES,
        default: 'UTC',
      },
    ],
  },
  webhook: {
    type: 'webhook',
    category: 'triggers',
    label: 'Webhook',
    description: 'Inbound HTTP webhook trigger',
    accent: ACCENT.triggers,
    handles: { source: ['source'] },
    fields: [
      {
        key: 'path',
        label: 'Path',
        type: 'string',
        required: true,
        placeholder: '/hooks/…',
        default: '/hooks/webhook',
      },
      {
        key: 'method',
        label: 'Method',
        type: 'select',
        required: true,
        options: HTTP_METHODS,
        default: 'POST',
      },
      {
        key: 'secret',
        label: 'Secret',
        type: 'string',
        placeholder: 'Optional shared secret',
      },
    ],
  },

  // ── AI ────────────────────────────────────────────────────────────────
  agent: {
    type: 'agent',
    category: 'ai',
    label: 'Agent',
    description: 'Grose agent / LLM turn',
    accent: ACCENT.ai,
    handles: { target: ['target'], source: ['source'] },
    fields: [
      {
        key: 'agent',
        label: 'Agent',
        type: 'string',
        required: true,
        placeholder: 'skill-slug or default',
        default: 'default',
      },
      {
        key: 'model',
        label: 'Model',
        type: 'select',
        options: MODEL_OPTIONS,
        default: 'default',
      },
      {
        key: 'prompt',
        label: 'Prompt',
        type: 'textarea',
        placeholder: 'Instruction for this turn',
      },
      {
        key: 'requireHitl',
        label: 'Require human approval',
        type: 'switch',
        default: false,
      },
    ],
  },
  'generate-image': {
    type: 'generate-image',
    category: 'ai',
    label: 'Generate image',
    description: 'Text-to-image generation',
    accent: ACCENT.ai,
    handles: { target: ['target'], source: ['source'] },
    fields: [
      {
        key: 'prompt',
        label: 'Prompt',
        type: 'textarea',
        required: true,
        placeholder: 'Describe the image…',
        default: '',
      },
      {
        key: 'model',
        label: 'Model',
        type: 'select',
        options: MODEL_OPTIONS,
        default: 'default',
      },
      {
        key: 'size',
        label: 'Size',
        type: 'select',
        options: IMAGE_SIZES,
        default: '1024x1024',
      },
    ],
  },
  'parameter-extractor': {
    type: 'parameter-extractor',
    category: 'ai',
    label: 'Parameter extractor',
    description: 'Extract structured fields via LLM',
    accent: ACCENT.ai,
    handles: { target: ['target'], source: ['source'] },
    fields: [
      {
        key: 'source',
        label: 'Source expression',
        type: 'string',
        placeholder: 'payload.text',
        default: 'payload',
      },
      {
        key: 'instruction',
        label: 'Instruction',
        type: 'textarea',
        placeholder: 'What to extract…',
        default: '',
      },
      {
        key: 'schema',
        label: 'Field schema',
        type: 'json',
        required: true,
        placeholder: '[{ "key": "name", "type": "string" }]',
        default: [],
      },
      {
        key: 'model',
        label: 'Model',
        type: 'select',
        options: MODEL_OPTIONS,
        default: 'default',
      },
    ],
  },
  'question-classifier': {
    type: 'question-classifier',
    category: 'ai',
    label: 'Question classifier',
    description: 'Route by LLM classification',
    accent: ACCENT.ai,
    handles: {
      target: ['target'],
      source: ['billing', 'support', 'other'],
    },
    fields: [
      {
        key: 'source',
        label: 'Source expression',
        type: 'string',
        placeholder: 'payload.text',
        default: 'payload',
      },
      {
        key: 'instruction',
        label: 'Instruction',
        type: 'textarea',
        placeholder: 'Classify the input…',
        default: '',
      },
      {
        key: 'categories',
        label: 'Categories',
        type: 'json',
        required: true,
        placeholder: '[{ "id": "billing", "label": "Billing" }]',
        default: [
          { id: 'billing', label: 'Billing' },
          { id: 'support', label: 'Support' },
          { id: 'other', label: 'Other' },
        ],
      },
      {
        key: 'model',
        label: 'Model',
        type: 'select',
        options: MODEL_OPTIONS,
        default: 'default',
      },
    ],
  },
  'text-splitter': {
    type: 'text-splitter',
    category: 'ai',
    label: 'Text splitter',
    description: 'Chunk text for RAG pipelines',
    accent: ACCENT.ai,
    handles: { target: ['target'], source: ['source'] },
    fields: [
      {
        key: 'source',
        label: 'Source expression',
        type: 'string',
        placeholder: 'payload.text',
        default: 'payload',
      },
      {
        key: 'strategy',
        label: 'Strategy',
        type: 'select',
        required: true,
        options: SPLIT_STRATEGIES,
        default: 'fixed',
      },
      {
        key: 'chunkSize',
        label: 'Chunk size',
        type: 'number',
        default: 512,
      },
      {
        key: 'overlap',
        label: 'Overlap',
        type: 'number',
        default: 50,
      },
      {
        key: 'separator',
        label: 'Separator',
        type: 'string',
        placeholder: 'Optional custom separator',
        default: '',
      },
    ],
  },

  // ── Flow ──────────────────────────────────────────────────────────────
  condition: {
    type: 'condition',
    category: 'flow',
    label: 'Condition',
    description: 'Boolean branch',
    accent: ACCENT.flow,
    handles: { target: ['target'], source: ['true', 'false'] },
    fields: [
      {
        key: 'expression',
        label: 'Expression',
        type: 'textarea',
        required: true,
        placeholder: 'payload.priority === "high"',
        default: 'true',
      },
    ],
  },
  switch: {
    type: 'switch',
    category: 'flow',
    label: 'Switch',
    description: 'Multi-case branch',
    accent: ACCENT.flow,
    handles: { target: ['target'], source: ['case0', 'case1', 'default'] },
    fields: [
      {
        key: 'expression',
        label: 'Match expression',
        type: 'textarea',
        required: true,
        placeholder: 'payload.status',
        default: 'payload.status',
      },
      {
        key: 'cases',
        label: 'Cases',
        type: 'json',
        required: true,
        placeholder: '[{ "id": "case0", "value": "open" }]',
        default: [
          { id: 'case0', value: 'open' },
          { id: 'case1', value: 'closed' },
        ],
      },
    ],
  },
  filter: {
    type: 'filter',
    category: 'flow',
    label: 'Filter',
    description: 'Pass or drop by expression',
    accent: ACCENT.flow,
    handles: { target: ['target'], source: ['pass', 'drop'] },
    fields: [
      {
        key: 'expression',
        label: 'Expression',
        type: 'textarea',
        required: true,
        placeholder: 'payload.active === true',
        default: 'true',
      },
    ],
  },
  merge: {
    type: 'merge',
    category: 'flow',
    label: 'Merge',
    description: 'Join parallel branches',
    accent: ACCENT.flow,
    handles: { target: ['target'], source: ['source'] },
    fields: [
      {
        key: 'mode',
        label: 'Mode',
        type: 'select',
        required: true,
        options: MERGE_MODES,
        default: 'wait-all',
      },
    ],
  },
  loop: {
    type: 'loop',
    category: 'flow',
    label: 'Loop',
    description: 'Iterate over items or while condition',
    accent: ACCENT.flow,
    handles: { target: ['target'], source: ['item', 'done'] },
    fields: [
      {
        key: 'mode',
        label: 'Mode',
        type: 'select',
        required: true,
        options: LOOP_MODES,
        default: 'foreach',
      },
      {
        key: 'items',
        label: 'Items expression',
        type: 'string',
        placeholder: 'payload.items',
        default: 'payload.items',
      },
      {
        key: 'maxIterations',
        label: 'Max iterations',
        type: 'number',
        default: 100,
      },
    ],
  },
  'human-approval': {
    type: 'human-approval',
    category: 'flow',
    label: 'Human approval',
    description: 'Pause for approve / reject',
    accent: ACCENT.flow,
    handles: { target: ['target'], source: ['approved', 'rejected'] },
    fields: [
      {
        key: 'title',
        label: 'Title',
        type: 'string',
        required: true,
        placeholder: 'Approve this step?',
        default: 'Approval required',
      },
      {
        key: 'instruction',
        label: 'Instruction',
        type: 'textarea',
        placeholder: 'Context shown to the reviewer',
        default: '',
      },
      {
        key: 'timeoutMs',
        label: 'Timeout (ms)',
        type: 'number',
        default: 86400000,
      },
      {
        key: 'onTimeout',
        label: 'On timeout',
        type: 'select',
        options: APPROVAL_TIMEOUT,
        default: 'rejected',
      },
    ],
  },

  // ── Data ──────────────────────────────────────────────────────────────
  variables: {
    type: 'variables',
    category: 'data',
    label: 'Variables',
    description: 'Set workflow-scoped vars',
    accent: ACCENT.data,
    handles: { target: ['target'], source: ['source'] },
    fields: [
      {
        key: 'assignments',
        label: 'Assignments',
        type: 'json',
        required: true,
        placeholder: '[{ "name": "x", "value": 1 }]',
        default: [],
      },
    ],
  },
  'set-fields': {
    type: 'set-fields',
    category: 'data',
    label: 'Set fields',
    description: 'Write fields onto the payload',
    accent: ACCENT.data,
    handles: { target: ['target'], source: ['source'] },
    fields: [
      {
        key: 'fields',
        label: 'Fields',
        type: 'json',
        required: true,
        placeholder: '[{ "key": "name", "value": "…" }]',
        default: [],
      },
      {
        key: 'keepIncoming',
        label: 'Keep incoming',
        type: 'switch',
        default: true,
      },
    ],
  },
  template: {
    type: 'template',
    category: 'data',
    label: 'Template',
    description: 'Render a text / JSON template',
    accent: ACCENT.data,
    handles: { target: ['target'], source: ['source'] },
    fields: [
      {
        key: 'template',
        label: 'Template',
        type: 'textarea',
        required: true,
        placeholder: 'Hello {{payload.name}}',
        default: '',
      },
      {
        key: 'outputMode',
        label: 'Output mode',
        type: 'select',
        options: [
          { id: 'text', label: 'Text' },
          { id: 'json', label: 'JSON' },
        ],
        default: 'text',
      },
    ],
  },
  json: {
    type: 'json',
    category: 'data',
    label: 'JSON',
    description: 'Parse or stringify JSON',
    accent: ACCENT.data,
    handles: { target: ['target'], source: ['source'] },
    fields: [
      {
        key: 'mode',
        label: 'Mode',
        type: 'select',
        required: true,
        options: JSON_MODES,
        default: 'parse',
      },
      {
        key: 'path',
        label: 'Source path',
        type: 'string',
        placeholder: 'payload.body',
        default: 'payload',
      },
      {
        key: 'strict',
        label: 'Strict',
        type: 'switch',
        default: true,
      },
    ],
  },
  transform: {
    type: 'transform',
    category: 'data',
    label: 'Transform',
    description: 'Map / reshape payload',
    accent: ACCENT.data,
    handles: { target: ['target'], source: ['source'] },
    fields: [
      {
        key: 'mapping',
        label: 'Mapping',
        type: 'json',
        required: true,
        placeholder: '{ }',
        default: {},
      },
      {
        key: 'expression',
        label: 'Expression',
        type: 'textarea',
        placeholder: 'Optional expression',
      },
    ],
  },
  function: {
    type: 'function',
    category: 'data',
    label: 'Function',
    description: 'Sandboxed JS snippet',
    accent: ACCENT.data,
    handles: { target: ['target'], source: ['source'] },
    fields: [
      {
        key: 'code',
        label: 'Code',
        type: 'textarea',
        required: true,
        placeholder: 'return input',
        default: 'return input',
      },
      {
        key: 'timeoutMs',
        label: 'Timeout (ms)',
        type: 'number',
        default: 5000,
      },
    ],
  },
  batch: {
    type: 'batch',
    category: 'data',
    label: 'Batch',
    description: 'Split arrays into chunks',
    accent: ACCENT.data,
    handles: { target: ['target'], source: ['source'] },
    fields: [
      {
        key: 'field',
        label: 'Array field',
        type: 'string',
        placeholder: 'payload.items',
        default: 'payload.items',
      },
      {
        key: 'size',
        label: 'Batch size',
        type: 'number',
        required: true,
        default: 100,
      },
    ],
  },
  aggregator: {
    type: 'aggregator',
    category: 'data',
    label: 'Aggregator',
    description: 'Count, sum, avg, min, max, group by',
    accent: ACCENT.data,
    handles: { target: ['target'], source: ['source'] },
    fields: [
      {
        key: 'operation',
        label: 'Operation',
        type: 'select',
        required: true,
        options: AGGREGATE_OPS,
        default: 'count',
      },
      {
        key: 'field',
        label: 'Field',
        type: 'string',
        placeholder: 'payload.value',
        default: '',
      },
      {
        key: 'groupBy',
        label: 'Group by',
        type: 'string',
        placeholder: 'Optional group key',
        default: '',
      },
    ],
  },
  csv: {
    type: 'csv',
    category: 'data',
    label: 'CSV',
    description: 'Parse CSV ↔ JSON',
    accent: ACCENT.data,
    handles: { target: ['target'], source: ['source'] },
    fields: [
      {
        key: 'mode',
        label: 'Mode',
        type: 'select',
        required: true,
        options: CSV_MODES,
        default: 'parse',
      },
      {
        key: 'delimiter',
        label: 'Delimiter',
        type: 'string',
        default: ',',
      },
      {
        key: 'hasHeaders',
        label: 'Has headers',
        type: 'switch',
        default: true,
      },
      {
        key: 'path',
        label: 'Source path',
        type: 'string',
        placeholder: 'payload.body',
        default: 'payload',
      },
    ],
  },
  sanitize: {
    type: 'sanitize',
    category: 'data',
    label: 'Sanitize',
    description: 'Mask or remove sensitive fields',
    accent: ACCENT.data,
    handles: { target: ['target'], source: ['source'] },
    fields: [
      {
        key: 'fields',
        label: 'Fields',
        type: 'string',
        placeholder: 'email,token,ssn',
        default: '',
      },
      {
        key: 'strategy',
        label: 'Strategy',
        type: 'select',
        required: true,
        options: SANITIZE_STRATEGIES,
        default: 'mask',
      },
      {
        key: 'detectPatterns',
        label: 'Detect common patterns',
        type: 'switch',
        default: true,
      },
    ],
  },

  // ── Action ────────────────────────────────────────────────────────────
  http: {
    type: 'http',
    category: 'action',
    label: 'HTTP',
    description: 'Outbound HTTP request',
    accent: ACCENT.action,
    handles: { target: ['target'], source: ['source'] },
    fields: [
      {
        key: 'url',
        label: 'URL',
        type: 'string',
        required: true,
        placeholder: 'https://…',
        default: '',
      },
      {
        key: 'method',
        label: 'Method',
        type: 'select',
        required: true,
        options: HTTP_METHODS,
        default: 'GET',
      },
      {
        key: 'headers',
        label: 'Headers',
        type: 'json',
        placeholder: '{ }',
        default: {},
      },
      {
        key: 'body',
        label: 'Body',
        type: 'json',
        placeholder: '{ }',
      },
      {
        key: 'timeoutMs',
        label: 'Timeout (ms)',
        type: 'number',
        default: 30000,
      },
    ],
  },
  wait: {
    type: 'wait',
    category: 'action',
    label: 'Wait',
    description: 'Delay before continuing',
    accent: ACCENT.action,
    handles: { target: ['target'], source: ['source'] },
    fields: [
      {
        key: 'duration',
        label: 'Duration',
        type: 'number',
        required: true,
        default: 1,
      },
      {
        key: 'unit',
        label: 'Unit',
        type: 'select',
        required: true,
        options: WAIT_UNITS,
        default: 'seconds',
      },
    ],
  },
  response: {
    type: 'response',
    category: 'action',
    label: 'Response',
    description: 'Terminal structured reply',
    accent: ACCENT.action,
    handles: { target: ['target'], source: [] },
    fields: [
      {
        key: 'status',
        label: 'Status',
        type: 'number',
        default: 200,
      },
      {
        key: 'body',
        label: 'Body',
        type: 'json',
        placeholder: '{ }',
        default: {},
      },
      {
        key: 'headers',
        label: 'Headers',
        type: 'json',
        placeholder: '{ }',
      },
    ],
  },
  debug: {
    type: 'debug',
    category: 'action',
    label: 'Debug',
    description: 'Log payload to the debug / logs panel',
    accent: ACCENT.action,
    handles: { target: ['target'], source: ['source'] },
    fields: [
      {
        key: 'output',
        label: 'Log shape',
        type: 'select',
        options: DEBUG_OUTPUT,
        default: 'full',
      },
      {
        key: 'label',
        label: 'Label',
        type: 'string',
        placeholder: 'Optional log label',
        default: '',
      },
      {
        key: 'console',
        label: 'Also console.log',
        type: 'switch',
        default: false,
      },
    ],
  },
  subworkflow: {
    type: 'subworkflow',
    category: 'action',
    label: 'Subworkflow',
    description: 'Invoke another workflow',
    accent: ACCENT.action,
    handles: { target: ['target'], source: ['source'] },
    fields: [
      {
        key: 'workflowId',
        label: 'Workflow ID',
        type: 'string',
        required: true,
        placeholder: 'wf-…',
        default: '',
      },
      {
        key: 'input',
        label: 'Input mapping',
        type: 'json',
        placeholder: '{ }',
        default: {},
      },
    ],
  },
}

export const BLOCK_LIST: BlockConfig[] = Object.values(BLOCK_REGISTRY)

export const TRIGGER_BLOCKS = BLOCK_LIST.filter((b) => b.category === 'triggers')
export const AI_BLOCKS = BLOCK_LIST.filter((b) => b.category === 'ai')
export const FLOW_BLOCKS = BLOCK_LIST.filter((b) => b.category === 'flow')
export const DATA_BLOCKS = BLOCK_LIST.filter((b) => b.category === 'data')
export const ACTION_BLOCKS = BLOCK_LIST.filter((b) => b.category === 'action')

/** @deprecated Prefer AI / Flow / Data / Action sections. */
export const CORE_BLOCKS = BLOCK_LIST.filter((b) => b.category !== 'triggers')

export function getBlockConfig(type: WorkflowNodeType): BlockConfig {
  return BLOCK_REGISTRY[type]
}

/** Build default config object from field defaults. */
export function defaultConfigFor(type: WorkflowNodeType): Record<string, unknown> {
  const fields = BLOCK_REGISTRY[type].fields
  const config: Record<string, unknown> = {}
  for (const field of fields) {
    if (field.default !== undefined) {
      config[field.key] = structuredClone(field.default)
    }
  }
  return config
}

export function formatNodeType(type: string): string {
  return getBlockConfig(type as WorkflowNodeType)?.label ?? type.charAt(0).toUpperCase() + type.slice(1)
}

export type { BlockConfig, BlockField, BlockCategory } from './types'
