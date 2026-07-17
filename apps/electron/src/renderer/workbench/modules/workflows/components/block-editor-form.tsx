import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { BlockField } from '../blocks'
import { getBlockConfig } from '../blocks'
import type { WorkflowNode } from '../mock/types'

type Props = {
  node: WorkflowNode
  onNameChange: (name: string) => void
  onConfigChange: (key: string, value: unknown) => void
}

function JsonField({
  field,
  value,
  onChange,
}: {
  field: BlockField
  value: unknown
  onChange: (v: unknown) => void
}) {
  const serialized = useMemo(() => {
    try {
      return JSON.stringify(value ?? (field.default ?? {}), null, 2)
    } catch {
      return ''
    }
  }, [value, field.default])

  const [text, setText] = useState(serialized)
  const [error, setError] = useState<string | null>(null)

  // Sync when external value changes (node switch)
  const [prevSerialized, setPrevSerialized] = useState(serialized)
  if (serialized !== prevSerialized) {
    setPrevSerialized(serialized)
    setText(serialized)
    setError(null)
  }

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={`field-${field.key}`} className="text-[11px] text-muted-foreground">
        {field.label}
        {field.required ? ' *' : ''}
      </Label>
      <Textarea
        id={`field-${field.key}`}
        className={cn('font-mono text-xs min-h-[88px]', error && 'border-red-500/60')}
        value={text}
        placeholder={field.placeholder}
        onChange={(e) => {
          const next = e.target.value
          setText(next)
          try {
            const parsed = next.trim() === '' ? (field.default ?? {}) : JSON.parse(next)
            setError(null)
            onChange(parsed)
          } catch {
            setError('Invalid JSON')
          }
        }}
      />
      {error ? <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  )
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: BlockField
  value: unknown
  onChange: (v: unknown) => void
}) {
  const id = `field-${field.key}`

  switch (field.type) {
    case 'string':
    case 'cron':
      return (
        <div className="grid gap-1.5">
          <Label htmlFor={id} className="text-[11px] text-muted-foreground">
            {field.label}
            {field.required ? ' *' : ''}
          </Label>
          <Input
            id={id}
            value={typeof value === 'string' ? value : ''}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )
    case 'textarea':
      return (
        <div className="grid gap-1.5">
          <Label htmlFor={id} className="text-[11px] text-muted-foreground">
            {field.label}
            {field.required ? ' *' : ''}
          </Label>
          <Textarea
            id={id}
            className="min-h-[72px] text-xs"
            value={typeof value === 'string' ? value : ''}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )
    case 'number':
      return (
        <div className="grid gap-1.5">
          <Label htmlFor={id} className="text-[11px] text-muted-foreground">
            {field.label}
            {field.required ? ' *' : ''}
          </Label>
          <Input
            id={id}
            type="number"
            value={typeof value === 'number' ? value : (value as string) ?? ''}
            onChange={(e) => {
              const n = e.target.valueAsNumber
              onChange(Number.isFinite(n) ? n : e.target.value)
            }}
          />
        </div>
      )
    case 'select':
      return (
        <div className="grid gap-1.5">
          <Label className="text-[11px] text-muted-foreground">
            {field.label}
            {field.required ? ' *' : ''}
          </Label>
          <Select
            value={typeof value === 'string' ? value : String(field.default ?? '')}
            onValueChange={onChange}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )
    case 'switch':
      return (
        <div className="flex items-center justify-between gap-3 py-1">
          <Label htmlFor={id} className="text-[11px] text-muted-foreground">
            {field.label}
          </Label>
          <Switch
            id={id}
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(checked)}
          />
        </div>
      )
    case 'json':
      return <JsonField field={field} value={value} onChange={onChange} />
    default:
      return null
  }
}

/**
 * Writable Editor form driven by BlockConfig.fields.
 */
export function BlockEditorForm({ node, onNameChange, onConfigChange }: Props) {
  const block = getBlockConfig(node.type)

  return (
    <div className="space-y-3">
      <div className="grid gap-1.5">
        <Label htmlFor="node-name" className="text-[11px] text-muted-foreground">
          Name
        </Label>
        <Input
          id="node-name"
          value={node.name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>
      {block.fields.map((field) => (
        <FieldControl
          key={field.key}
          field={field}
          value={node.config[field.key]}
          onChange={(v) => onConfigChange(field.key, v)}
        />
      ))}
    </div>
  )
}
