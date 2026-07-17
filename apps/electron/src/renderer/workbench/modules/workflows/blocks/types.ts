import type { WorkflowNodeType } from '../mock/types'

export type FieldType =
  | 'string'
  | 'textarea'
  | 'number'
  | 'select'
  | 'switch'
  | 'cron'
  | 'json'

export type BlockCategory = 'triggers' | 'ai' | 'flow' | 'data' | 'action'

export type BlockField = {
  key: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  /** For `select` */
  options?: { id: string; label: string }[]
  default?: unknown
}

export type BlockConfig = {
  type: WorkflowNodeType
  category: BlockCategory
  label: string
  description: string
  /** Accent token for canvas chrome (category-aligned). */
  accent: string
  handles: { target?: string[]; source: string[] }
  fields: BlockField[]
}
