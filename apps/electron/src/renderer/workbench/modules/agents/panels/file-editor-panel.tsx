import { useEffect, useState } from 'react'
import { ExternalLink, FileWarning, Loader2 } from 'lucide-react'
import { classifyFile, Markdown, Spinner } from '@craft-agent/ui'
import { ShikiCodeViewer } from '@/components/shiki'
import { getLanguageFromPath } from '@/lib/file-utils'
import { getFileManagerName } from '@/lib/platform'
import { PanelRoot, PanelBody, PanelHeaderBarSplit } from '../../../dock/panel-primitives'
import { baseName } from '../../../components/file-tree-utils'
import { cn } from '@/lib/utils'

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; kind: 'text' | 'markdown' | 'code' | 'json'; content: string }
  | { status: 'ready'; kind: 'image'; dataUrl: string }
  | { status: 'ready'; kind: 'binary'; message: string }

/**
 * Center dock panel — read-only file preview (kandev file-editor slot).
 * Params: `{ path: string }`. Reuses Craft Shiki / Markdown / image readers.
 */
export function FileEditorPanel({ params }: { params: Record<string, unknown> }) {
  const path = typeof params.path === 'string' ? params.path : null
  const [state, setState] = useState<LoadState>({ status: 'idle' })

  useEffect(() => {
    if (!path) {
      setState({ status: 'idle' })
      return
    }

    let cancelled = false
    setState({ status: 'loading' })

    void (async () => {
      try {
        const classification = classifyFile(path)
        if (classification.type === 'image') {
          const dataUrl = await window.electronAPI.readFileDataUrl(path)
          if (cancelled) return
          setState({ status: 'ready', kind: 'image', dataUrl })
          return
        }
        if (classification.type === 'pdf') {
          if (cancelled) return
          setState({
            status: 'ready',
            kind: 'binary',
            message: 'PDF preview is available via Reveal / Open externally.',
          })
          return
        }
        if (!classification.canPreview && classification.type === null) {
          // Try reading as text anyway for extensionless / unknown text files.
          try {
            const content = await window.electronAPI.readFile(path)
            if (cancelled) return
            setState({ status: 'ready', kind: 'text', content })
          } catch {
            if (cancelled) return
            setState({
              status: 'ready',
              kind: 'binary',
              message: 'This file type cannot be previewed in-app.',
            })
          }
          return
        }

        const content = await window.electronAPI.readFile(path)
        if (cancelled) return
        if (classification.type === 'markdown') {
          setState({ status: 'ready', kind: 'markdown', content })
        } else if (classification.type === 'json') {
          setState({ status: 'ready', kind: 'json', content })
        } else if (classification.type === 'code') {
          setState({ status: 'ready', kind: 'code', content })
        } else {
          setState({ status: 'ready', kind: 'text', content })
        }
      } catch (err) {
        if (cancelled) return
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Failed to open file',
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [path])

  if (!path) {
    return (
      <PanelRoot>
        <PanelHeaderBarSplit left={<span className="font-medium truncate">Preview</span>} />
        <PanelBody className="flex items-center justify-center text-sm text-muted-foreground">
          Select a file to preview
        </PanelBody>
      </PanelRoot>
    )
  }

  const name = baseName(path)

  return (
    <PanelRoot>
      <PanelHeaderBarSplit
        left={
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium truncate">{name}</span>
            <span className="text-muted-foreground truncate hidden sm:inline">{path}</span>
          </div>
        }
        right={
          <button
            type="button"
            title={`Reveal in ${getFileManagerName()}`}
            className="p-1 rounded hover:bg-foreground-5 text-muted-foreground hover:text-foreground"
            onClick={() => void window.electronAPI.showInFolder(path)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        }
      />
      <PanelBody padding={false} scroll={false} className="flex flex-col bg-card">
        {state.status === 'loading' && (
          <div className="flex-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner className="h-3.5 w-3.5" />
            Loading…
          </div>
        )}
        {state.status === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-sm text-destructive">
            <FileWarning className="h-5 w-5" />
            {state.message}
          </div>
        )}
        {state.status === 'ready' && state.kind === 'image' && (
          <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-foreground-3">
            <img
              src={state.dataUrl}
              alt={name}
              className="max-w-full max-h-full object-contain rounded shadow-sm"
            />
          </div>
        )}
        {state.status === 'ready' && state.kind === 'binary' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-sm text-muted-foreground">
            <FileWarning className="h-5 w-5" />
            <p>{state.message}</p>
            <button
              type="button"
              className="text-xs underline hover:text-foreground"
              onClick={() => void window.electronAPI.showInFolder(path)}
            >
              Reveal in {getFileManagerName()}
            </button>
          </div>
        )}
        {state.status === 'ready' && state.kind === 'markdown' && (
          <div className="flex-1 overflow-auto px-6 py-4">
            <div className="max-w-[850px] mx-auto prose prose-sm dark:prose-invert">
              <Markdown>{state.content}</Markdown>
            </div>
          </div>
        )}
        {state.status === 'ready' &&
          (state.kind === 'code' || state.kind === 'json' || state.kind === 'text') && (
            <div className={cn('flex-1 overflow-auto')}>
              <ShikiCodeViewer
                code={state.content}
                filePath={path}
                language={
                  state.kind === 'text' ? 'text' : getLanguageFromPath(path)
                }
              />
            </div>
          )}
        {state.status === 'idle' && (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
            Waiting…
          </div>
        )}
      </PanelBody>
    </PanelRoot>
  )
}
