/**
 * Skill files browser — list + preview/edit for files in a skill directory.
 * Uses skills:getFiles, file:read, fs:createFile, fs:writeFile.
 */

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  Loader2,
  Pencil,
  Plus,
  Save,
} from 'lucide-react'
import { toast } from 'sonner'
import type { SkillFile } from '../../../../shared/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@grose-agent/ui'
import { ShikiCodeViewer } from '@/components/shiki'
import { Info_Markdown } from '@/components/info'
import { EditPopover, getEditConfig } from '@/components/ui/EditPopover'
import { cn } from '@/lib/utils'
import { joinPath } from '../../components/file-tree-utils'

function countFiles(nodes: SkillFile[]): number {
  let n = 0
  for (const node of nodes) {
    if (node.type === 'file') n += 1
    else if (node.children) n += countFiles(node.children)
  }
  return n
}

function flattenFiles(nodes: SkillFile[], prefix = ''): string[] {
  const out: string[] = []
  for (const node of nodes) {
    const rel = prefix ? `${prefix}/${node.name}` : node.name
    if (node.type === 'file') out.push(rel)
    else if (node.children) out.push(...flattenFiles(node.children, rel))
  }
  return out
}

function FileTreeNode({
  node,
  depth,
  prefix,
  selectedRel,
  onSelect,
}: {
  node: SkillFile
  depth: number
  prefix: string
  selectedRel: string | null
  onSelect: (rel: string) => void
}) {
  const [open, setOpen] = React.useState(depth < 2)
  const rel = prefix ? `${prefix}/${node.name}` : node.name
  const isDir = node.type === 'directory'
  const active = !isDir && selectedRel === rel

  return (
    <div>
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-1 py-0.5 pr-2 text-left text-xs',
          'hover:bg-muted/60 focus-visible:outline-none focus-visible:bg-muted/60',
          active && 'bg-muted',
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={() => {
          if (isDir) setOpen((v) => !v)
          else onSelect(rel)
        }}
      >
        {isDir ? (
          open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="inline-block h-3.5 w-3.5 shrink-0" />
        )}
        {isDir ? (
          open ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )
        ) : (
          <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {isDir && open && node.children?.length
        ? node.children.map((child) => (
            <FileTreeNode
              key={`${rel}/${child.name}`}
              node={child}
              depth={depth + 1}
              prefix={rel}
              selectedRel={selectedRel}
              onSelect={onSelect}
            />
          ))
        : null}
    </div>
  )
}

export interface SkillFilesPanelProps {
  skillPath: string
  skillSlug: string
  workspaceId: string
  workingDirectory?: string
  /** When false, hide add/save and show read-only hint (e.g. remote reveal unavailable). */
  canWrite: boolean
  /** Non-workspace skills are still editable on disk; show a soft hint. */
  sourceHint?: string | null
}

export function SkillFilesPanel({
  skillPath,
  skillSlug,
  workspaceId,
  workingDirectory,
  canWrite,
  sourceHint,
}: SkillFilesPanelProps) {
  const { t } = useTranslation()
  const [tree, setTree] = React.useState<SkillFile[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedRel, setSelectedRel] = React.useState<string | null>(null)
  const [content, setContent] = React.useState<string>('')
  const [original, setOriginal] = React.useState<string>('')
  const [fileLoading, setFileLoading] = React.useState(false)
  const [mode, setMode] = React.useState<'preview' | 'edit'>('preview')
  const [saving, setSaving] = React.useState(false)
  const [adding, setAdding] = React.useState(false)
  const [newName, setNewName] = React.useState('')
  const [creating, setCreating] = React.useState(false)

  const fileCount = countFiles(tree)
  const dirty = content !== original
  const absPath = selectedRel ? joinPath(skillPath, selectedRel) : null
  const isMarkdown = selectedRel?.toLowerCase().endsWith('.md') ?? false

  const loadTree = React.useCallback(async (): Promise<SkillFile[]> => {
    if (!window.electronAPI.getSkillFiles) {
      setTree([])
      setLoading(false)
      return []
    }
    setLoading(true)
    try {
      const files = await window.electronAPI.getSkillFiles(workspaceId, skillSlug, workingDirectory)
      const next = files || []
      setTree(next)
      return next
    } catch (err) {
      console.error('[SkillFiles] Failed to list files:', err)
      toast.error(t('skillInfo.failedToLoadFiles'))
      setTree([])
      return []
    } finally {
      setLoading(false)
    }
  }, [workspaceId, skillSlug, workingDirectory, t])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const files = await loadTree()
      if (cancelled) return
      const flat = flattenFiles(files)
      const initial = flat.includes('SKILL.md') ? 'SKILL.md' : flat[0] ?? null
      setSelectedRel(initial)
    })()
    return () => {
      cancelled = true
    }
  }, [loadTree])

  React.useEffect(() => {
    if (!selectedRel || !absPath) {
      setContent('')
      setOriginal('')
      return
    }
    let cancelled = false
    setFileLoading(true)
    setMode('preview')
    void (async () => {
      try {
        const text = await window.electronAPI.readFile(absPath)
        if (cancelled) return
        setContent(text)
        setOriginal(text)
      } catch (err) {
        if (cancelled) return
        toast.error(err instanceof Error ? err.message : t('skillInfo.failedToLoadFiles'))
        setContent('')
        setOriginal('')
      } finally {
        if (!cancelled) setFileLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedRel, absPath, t])

  const handleSelect = React.useCallback(
    (rel: string) => {
      if (dirty && selectedRel && selectedRel !== rel) {
        const ok = window.confirm(t('skillInfo.unsavedDiscard'))
        if (!ok) return
      }
      setSelectedRel(rel)
    },
    [dirty, selectedRel, t],
  )

  const handleSave = React.useCallback(async () => {
    if (!absPath || !canWrite || !dirty) return
    setSaving(true)
    try {
      await window.electronAPI.writeServerFile(absPath, content)
      setOriginal(content)
      toast.success(t('skillInfo.fileSaved'))
      void loadTree()
    } catch (err) {
      toast.error(t('skillInfo.failedToSaveFile'), {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSaving(false)
    }
  }, [absPath, canWrite, dirty, content, t, loadTree])

  const handleCreate = React.useCallback(async () => {
    const name = newName.trim().replace(/^\/+/, '')
    if (!name || !canWrite) return
    if (name.includes('..') || name.startsWith('/')) {
      toast.error(t('skillInfo.invalidFileName'))
      return
    }
    setCreating(true)
    try {
      const target = joinPath(skillPath, name)
      await window.electronAPI.createServerFile(target)
      const stub = name.toLowerCase().endsWith('.md')
        ? `# ${name.replace(/\.md$/i, '')}\n\n`
        : ''
      if (stub) {
        await window.electronAPI.writeServerFile(target, stub)
      }
      setAdding(false)
      setNewName('')
      await loadTree()
      setSelectedRel(name)
      setMode('edit')
      toast.success(t('skillInfo.fileCreated', { name }))
    } catch (err) {
      toast.error(t('skillInfo.failedToCreateFile'), {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setCreating(false)
    }
  }, [newName, canWrite, skillPath, loadTree, t])

  return (
    <div className="flex min-h-[280px] h-[min(520px,55vh)]">
      {/* File list */}
      <div className="w-44 shrink-0 border-r border-border/50 flex flex-col min-h-0 bg-background/40">
        <div className="flex h-8 items-center justify-between gap-1 border-b border-border/40 px-2">
          <span className="truncate text-[11px] font-medium text-muted-foreground">
            {t('skillInfo.filesCount', { count: fileCount })}
          </span>
          {canWrite ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              title={t('skillInfo.addFile')}
              onClick={() => setAdding((v) => !v)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          ) : null}
        </div>
        {sourceHint ? (
          <p className="px-2 py-1 text-[10px] leading-snug text-muted-foreground/80 border-b border-border/30">
            {sourceHint}
          </p>
        ) : null}
        {adding ? (
          <div className="flex gap-1 border-b border-border/40 p-1.5">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('skillInfo.fileNamePlaceholder')}
              className="h-6 text-[11px] px-1.5"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreate()
                if (e.key === 'Escape') {
                  setAdding(false)
                  setNewName('')
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-1.5 text-[10px]"
              disabled={!newName.trim() || creating}
              onClick={() => void handleCreate()}
            >
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : t('common.create')}
            </Button>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto py-1">
          {loading ? (
            <div className="flex items-center gap-1.5 px-2 py-2 text-xs text-muted-foreground">
              <Spinner className="h-3 w-3" /> {t('common.loading')}
            </div>
          ) : tree.length === 0 ? (
            <div className="px-2 py-2 text-[11px] text-muted-foreground">{t('skillInfo.noFiles')}</div>
          ) : (
            tree.map((node) => (
              <FileTreeNode
                key={node.name}
                node={node}
                depth={0}
                prefix=""
                selectedRel={selectedRel}
                onSelect={handleSelect}
              />
            ))
          )}
        </div>
      </div>

      {/* Content viewer / editor */}
      <div className="min-w-0 flex-1 flex flex-col min-h-0">
        <div className="flex h-8 items-center justify-between gap-2 border-b border-border/40 px-2">
          <span className="truncate text-xs font-medium">
            {selectedRel ?? t('skillInfo.selectFile')}
            {dirty ? <span className="ml-1 text-[10px] text-amber-600">●</span> : null}
          </span>
          {selectedRel && absPath ? (
            <div className="flex shrink-0 items-center gap-0.5">
              {canWrite ? (
                <>
                  <EditPopover
                    trigger={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title={t('common.edit')}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    }
                    {...(selectedRel === 'SKILL.md'
                      ? getEditConfig('skill-instructions', skillPath)
                      : {
                          context: {
                            label: 'Skill File',
                            filePath: absPath,
                            context:
                              'The user is editing a supporting file inside a skill directory. ' +
                              'Preserve useful structure and keep changes focused. Confirm clearly when done.',
                          },
                          permissionMode: 'allow-all' as const,
                          workingDirectory: 'none' as const,
                          model: 'fast' as const,
                          systemPromptPreset: 'mini' as const,
                          displayLabel: selectedRel,
                        })}
                    secondaryAction={{
                      label: t('common.editFile'),
                      filePath: absPath,
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5 text-[11px]"
                    onClick={() => setMode((m) => (m === 'edit' ? 'preview' : 'edit'))}
                  >
                    {mode === 'edit' ? t('skillInfo.preview') : t('skillInfo.editContent')}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    title={t('common.save')}
                    disabled={!dirty || saving}
                    onClick={() => void handleSave()}
                  >
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  </Button>
                </>
              ) : (
                <span className="text-[10px] text-muted-foreground">{t('skillInfo.readOnly')}</span>
              )}
            </div>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {!selectedRel ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground px-3">
              {t('skillInfo.selectFile')}
            </div>
          ) : fileLoading ? (
            <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
              <Spinner className="h-3.5 w-3.5" /> {t('common.loading')}
            </div>
          ) : mode === 'edit' && canWrite ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              className={cn(
                'h-full w-full resize-none border-0 bg-transparent',
                'p-3 font-mono text-[12px] leading-relaxed text-foreground',
                'focus-visible:outline-none',
              )}
              aria-label={selectedRel}
            />
          ) : isMarkdown ? (
            <Info_Markdown maxHeight={undefined} fullscreen>
              {content || t('skillInfo.noInstructions')}
            </Info_Markdown>
          ) : (
            <ShikiCodeViewer code={content} filePath={absPath ?? selectedRel} className="h-full" />
          )}
        </div>
      </div>
    </div>
  )
}
