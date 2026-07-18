import {
  Bot,
  Braces,
  Bug,
  Calculator,
  Clock,
  Code2,
  FileJson,
  FileSpreadsheet,
  Filter,
  FormInput,
  GitBranch,
  GitMerge,
  Globe,
  Hourglass,
  ImageIcon,
  Layers,
  ListTree,
  MessageSquareQuote,
  Play,
  Radio,
  Repeat,
  Scissors,
  ShieldCheck,
  Split,
  TextCursorInput,
  UserCheck,
  Variable,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { BlockCategory } from './types'
import type { WorkflowNodeType } from '../mock/types'

/** Shared icons for Toolbar rows, canvas chrome, and Logs steps. */
export const NODE_ICONS: Record<WorkflowNodeType, LucideIcon> = {
  start: Play,
  schedule: Clock,
  webhook: Radio,
  agent: Bot,
  'generate-image': ImageIcon,
  'parameter-extractor': FormInput,
  'question-classifier': MessageSquareQuote,
  'text-splitter': Scissors,
  condition: GitBranch,
  switch: Split,
  filter: Filter,
  merge: GitMerge,
  loop: Repeat,
  'human-approval': UserCheck,
  variables: Variable,
  'set-fields': TextCursorInput,
  template: ListTree,
  json: FileJson,
  transform: Braces,
  function: Code2,
  batch: Layers,
  aggregator: Calculator,
  csv: FileSpreadsheet,
  sanitize: ShieldCheck,
  http: Globe,
  wait: Hourglass,
  response: Zap,
  debug: Bug,
  subworkflow: Workflow,
}

/** Category → accent token (matches registry ACCENT). */
export const CATEGORY_ACCENT: Record<BlockCategory, string> = {
  triggers: 'sky',
  ai: 'teal',
  flow: 'amber',
  data: 'emerald',
  action: 'orange',
}

export const CATEGORY_SECTIONS: { id: BlockCategory; label: string }[] = [
  { id: 'triggers', label: 'Triggers' },
  { id: 'ai', label: 'AI' },
  { id: 'flow', label: 'Flow' },
  { id: 'data', label: 'Data' },
  { id: 'action', label: 'Action' },
]

/** Dot next to section headers (z8run-style, Grose light colors). */
export const ACCENT_DOT: Record<string, string> = {
  sky: 'bg-sky-500',
  teal: 'bg-teal-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  orange: 'bg-orange-500',
}

/** Rounded icon tile behind lucide glyphs. */
export const ACCENT_TILE: Record<string, string> = {
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
}

export const ACCENT_ICON: Record<string, string> = {
  sky: 'text-sky-600 dark:text-sky-400',
  teal: 'text-teal-600 dark:text-teal-400',
  amber: 'text-amber-600 dark:text-amber-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  orange: 'text-orange-600 dark:text-orange-400',
}

export const ACCENT_BORDER: Record<string, string> = {
  sky: 'border-l-sky-500',
  teal: 'border-l-teal-500',
  amber: 'border-l-amber-500',
  emerald: 'border-l-emerald-500',
  orange: 'border-l-orange-500',
}

export function getNodeIcon(type: string): LucideIcon {
  return NODE_ICONS[type as WorkflowNodeType] ?? Play
}
