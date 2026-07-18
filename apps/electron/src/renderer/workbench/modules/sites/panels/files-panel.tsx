import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  Loader2,
  RefreshCw,
  Save,
} from 'lucide-react'
import { toast } from 'sonner'
import type { GroseModulesSiteFileNode } from '@grose-agent/shared/grose-modules'
import { PanelRoot, PanelBody, PanelHeaderBar } from '../../../dock/panel-primitives'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Button } from '@/components/ui/button'
import { Spinner } from '@grose-agent/ui'
import { ShikiCodeViewer } from '@/components/shiki'
import { cn } from '@/lib/utils'
import { useAppShellContext } from '@/context/AppShellContext'
import {
  selectedSiteAtom,
  selectedSiteIdAtom,
  sitesFileContentAtom,
  sitesFileOriginalContentAtom,
  sitesFileDirtyAtom,
  sitesFileOpeningPathAtom,
  sitesFileTreeAtom,
  sitesFilesLoadingAtom,
  sitesSelectedFilePathAtom,
} from '../store'
import { useSitesFilesData } from '../use-sites-data'

function FileTreeNode({
  node,
  depth,
  selectedPath,
  openingPath,
  onSelect,
}: {
  node: GroseModulesSiteFileNode
  depth: number
  selectedPath: string | null
  openingPath: string | null
  onSelect: (path: string) => void
}) {
  const [open, setOpen] = useState(depth < 2)
  const isDir = node.type === 'directory'
  const active = !isDir && selectedPath === node.path
  const isOpening = !isDir && openingPath === node.path

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
          else onSelect(node.path)
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
        {isOpening ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : isDir ? (
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
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              openingPath={openingPath}
              onSelect={onSelect}
            />
          ))
        : null}
    </div>
  )
}

function SitesFileTree({
  selectedPath,
  openingPath,
  onOpenFile,
  onRefresh,
}: {
  selectedPath: string | null
  openingPath: string | null
  onOpenFile: (path: string) => void
  onRefresh: () => void
}) {
  const { t } = useTranslation()
  const site = useAtomValue(selectedSiteAtom)
  const tree = useAtomValue(sitesFileTreeAtom)
  const loading = useAtomValue(sitesFilesLoadingAtom)

  return (
    <PanelRoot className="h-full min-h-0">
      <PanelHeaderBar className="justify-between border-b border-border px-2">
        <span className="truncate text-xs text-muted-foreground">
          {site?.name ?? t('workbench.sites.files')}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          title={t('common.refresh', { defaultValue: 'Refresh' })}
          onClick={onRefresh}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </PanelHeaderBar>
      <PanelBody padding={false} scroll className="min-h-0">
        {loading && tree.length === 0 ? (
          <div className="p-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="h-3.5 w-3.5" /> {t('common.loading')}
          </div>
        ) : tree.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground">{t('workbench.sites.noFiles')}</div>
        ) : (
          <div className="pb-2">
            {tree.map((node) => (
              <FileTreeNode
                key={node.path}
                node={node}
                depth={0}
                selectedPath={selectedPath}
                openingPath={openingPath}
                onSelect={onOpenFile}
              />
            ))}
          </div>
        )}
      </PanelBody>
    </PanelRoot>
  )
}

function SitesFileEditor({
  path,
  content,
  originalContent,
  dirty,
  saving,
  onChange,
  onSave,
}: {
  path: string
  content: string
  originalContent: string
  dirty: boolean
  saving: boolean
  onChange: (value: string) => void
  onSave: () => void
}) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const fileName = useMemo(() => path.split('/').pop() || path, [path])

  useEffect(() => {
    setMode('edit')
  }, [path])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (dirty && !saving) onSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dirty, saving, onSave])

  return (
    <PanelRoot className="h-full min-h-0">
      <PanelHeaderBar className="justify-between gap-2 min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-medium">{fileName}</span>
          {dirty ? <span className="shrink-0 text-[10px] text-amber-600">●</span> : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            onClick={() => setMode((m) => (m === 'edit' ? 'preview' : 'edit'))}
          >
            {mode === 'edit'
              ? t('workbench.sites.preview', { defaultValue: 'Preview' })
              : t('workbench.sites.editFile', { defaultValue: 'Edit' })}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            title={t('workbench.sites.saveFile', { defaultValue: 'Save' })}
            disabled={!dirty || saving}
            onClick={onSave}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </PanelHeaderBar>
      <PanelBody padding={false} scroll={false} className="min-h-0 flex flex-col">
        {mode === 'preview' ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <ShikiCodeViewer code={content || originalContent} filePath={path} className="h-full" />
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            className={cn(
              'min-h-0 flex-1 w-full resize-none border-0 bg-transparent',
              'p-3 font-mono text-[12px] leading-relaxed text-foreground',
              'focus-visible:outline-none',
            )}
            aria-label={fileName}
          />
        )}
      </PanelBody>
    </PanelRoot>
  )
}

/** Files panel — kandev Design parity: tree-only until click, then horizontal split + editor. */
export function SitesFilesPanel() {
  const { t } = useTranslation()
  const { activeWorkspaceId } = useAppShellContext()
  const { loadTree } = useSitesFilesData()
  const site = useAtomValue(selectedSiteAtom)
  const siteId = useAtomValue(selectedSiteIdAtom)
  const [selectedPath, setSelectedPath] = useAtom(sitesSelectedFilePathAtom)
  const content = useAtomValue(sitesFileContentAtom)
  const original = useAtomValue(sitesFileOriginalContentAtom)
  const dirty = useAtomValue(sitesFileDirtyAtom)
  const openingPath = useAtomValue(sitesFileOpeningPathAtom)
  const setContent = useSetAtom(sitesFileContentAtom)
  const setOriginal = useSetAtom(sitesFileOriginalContentAtom)
  const setDirty = useSetAtom(sitesFileDirtyAtom)
  const setOpeningPath = useSetAtom(sitesFileOpeningPathAtom)
  const [saving, setSaving] = useState(false)

  const openFile = useCallback(
    async (path: string) => {
      if (!activeWorkspaceId || !siteId) return
      if (dirty && selectedPath && selectedPath !== path) {
        const ok = window.confirm(t('workbench.sites.unsavedDiscard', {
          defaultValue: 'Discard unsaved changes?',
        }))
        if (!ok) return
      }
      setSelectedPath(path)
      setOpeningPath(path)
      setContent(null)
      setOriginal(null)
      setDirty(false)
      try {
        const res = await window.electronAPI.sitesReadFile(activeWorkspaceId, siteId, path)
        setContent(res.content)
        setOriginal(res.content)
        setDirty(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err))
        setSelectedPath(null)
        setContent(null)
        setOriginal(null)
      } finally {
        setOpeningPath(null)
      }
    },
    [
      activeWorkspaceId,
      siteId,
      dirty,
      selectedPath,
      setSelectedPath,
      setOpeningPath,
      setContent,
      setOriginal,
      setDirty,
      t,
    ],
  )

  const onChange = useCallback(
    (value: string) => {
      setContent(value)
      setDirty(value !== (original ?? ''))
    },
    [setContent, setDirty, original],
  )

  const onSave = useCallback(async () => {
    if (!activeWorkspaceId || !siteId || !selectedPath || content == null) return
    setSaving(true)
    try {
      await window.electronAPI.sitesWriteFile(activeWorkspaceId, siteId, {
        path: selectedPath,
        content,
      })
      setOriginal(content)
      setDirty(false)
      toast.success(t('workbench.sites.fileSaved', { defaultValue: 'File saved' }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [
    activeWorkspaceId,
    siteId,
    selectedPath,
    content,
    setOriginal,
    setDirty,
    t,
  ])

  if (!site) {
    return (
      <PanelRoot>
        <PanelBody className="flex items-center justify-center text-sm text-muted-foreground">
          {t('workbench.sites.selectSite')}
        </PanelBody>
      </PanelRoot>
    )
  }

  const treePane = (
    <SitesFileTree
      selectedPath={selectedPath}
      openingPath={openingPath}
      onOpenFile={(path) => void openFile(path)}
      onRefresh={() => void loadTree()}
    />
  )

  // kandev: no active file → tree fills the panel
  if (!selectedPath) {
    return treePane
  }

  return (
    <PanelRoot className="h-full min-h-0">
      <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize={28} minSize={20} maxSize={45} className="min-w-0">
          {treePane}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={72} minSize={40} className="min-w-0">
          {content == null && openingPath ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Spinner className="h-3.5 w-3.5" /> {t('common.loading')}
            </div>
          ) : content == null ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              {t('workbench.sites.selectFile')}
            </div>
          ) : (
            <SitesFileEditor
              path={selectedPath}
              content={content}
              originalContent={original ?? content}
              dirty={dirty}
              saving={saving}
              onChange={onChange}
              onSave={() => void onSave()}
            />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </PanelRoot>
  )
}
