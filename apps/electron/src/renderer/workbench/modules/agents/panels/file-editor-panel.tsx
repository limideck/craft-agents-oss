import { useCallback, useEffect, useMemo, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { Code2, ExternalLink, Eye, FileWarning, Loader2 } from 'lucide-react'
import { classifyFile, Markdown, Spinner } from '@grose-agent/ui'
import { ShikiCodeViewer } from '@/components/shiki'
import { getLanguageFromPath } from '@/lib/file-utils'
import { getFileManagerName } from '@/lib/platform'
import { PanelRoot, PanelBody, PanelHeaderBarSplit } from '../../../dock/panel-primitives'
import { baseName } from '../../../components/file-tree-utils'
import { cn } from '@/lib/utils'
import {
  getExtension,
  isVideoPath,
  localFileUrl,
  videoMime,
} from '../video-preview'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker

type HtmlMode = 'render' | 'source'

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; kind: 'text' | 'markdown' | 'code' | 'json'; content: string }
  | { status: 'ready'; kind: 'html'; content: string }
  | { status: 'ready'; kind: 'image'; dataUrl: string }
  | { status: 'ready'; kind: 'pdf'; data: Uint8Array }
  | { status: 'ready'; kind: 'video'; objectUrl: string; mime: string }
  | { status: 'ready'; kind: 'binary'; message: string }

const HTML_EXTENSIONS = new Set(['html', 'htm', 'xhtml'])

function isHtmlPath(filePath: string): boolean {
  return HTML_EXTENSIONS.has(getExtension(filePath))
}

/** Inject `<base target="_top">` so link clicks reach Electron's will-navigate. */
function injectBaseTarget(html: string): string {
  if (/<base\s/i.test(html)) return html
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/(<head[^>]*>)/i, '$1<base target="_top">')
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/(<html[^>]*>)/i, '$1<head><base target="_top"></head>')
  }
  return `<head><base target="_top"></head>${html}`
}

function PdfInlineViewer({ data }: { data: Uint8Array }) {
  const [numPages, setNumPages] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileObj = useMemo(() => ({ data }), [data])

  return (
    <div className="flex-1 overflow-auto flex flex-col items-center gap-3 p-4 bg-foreground-3">
      {error && (
        <div className="text-sm text-destructive py-6">{error}</div>
      )}
      <Document
        file={fileObj}
        onLoadSuccess={({ numPages: n }) => setNumPages(n)}
        onLoadError={(err) => setError(err.message)}
        loading={
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Spinner className="h-3.5 w-3.5" />
            渲染 PDF…
          </div>
        }
      >
        {Array.from({ length: numPages }, (_, i) => (
          <Page
            key={i + 1}
            pageNumber={i + 1}
            renderTextLayer
            renderAnnotationLayer
            className="pdf-page mb-3 shadow-sm"
          />
        ))}
      </Document>
    </div>
  )
}

function HtmlInlineViewer({
  html,
  mode,
  filePath,
}: {
  html: string
  mode: HtmlMode
  filePath: string
}) {
  const processed = useMemo(() => injectBaseTarget(html), [html])

  if (mode === 'source') {
    return (
      <div className="flex-1 overflow-auto">
        <ShikiCodeViewer code={html} filePath={filePath} language="html" />
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 bg-white dark:bg-background">
      <iframe
        sandbox="allow-same-origin allow-top-navigation-by-user-activation"
        srcDoc={processed}
        title="HTML 预览"
        className="w-full h-full border-0 bg-white"
      />
    </div>
  )
}

/**
 * Center dock panel — read-only file preview (kandev file-editor slot).
 * Params: `{ path: string }`. Supports markdown/code/image/pdf/html/video.
 */
export function FileEditorPanel({ params }: { params: Record<string, unknown> }) {
  const path = typeof params.path === 'string' ? params.path : null
  const [state, setState] = useState<LoadState>({ status: 'idle' })
  const [htmlMode, setHtmlMode] = useState<HtmlMode>('render')

  useEffect(() => {
    if (!path) {
      setState({ status: 'idle' })
      return
    }

    let cancelled = false
    setState({ status: 'loading' })
    setHtmlMode('render')

    void (async () => {
      try {
        const ext = getExtension(path)

        if (isVideoPath(path)) {
          // Stream directly from disk via local-file:// protocol.
          // Avoids reading the entire file into V8 memory (which causes OOM
          // for large videos). Chromium handles seeking via Range requests.
          const objectUrl = localFileUrl(path)
          if (cancelled) return
          setState({ status: 'ready', kind: 'video', objectUrl, mime: videoMime(ext) })
          return
        }

        const classification = classifyFile(path)

        if (classification.type === 'image') {
          const dataUrl = await window.electronAPI.readFileDataUrl(path)
          if (cancelled) return
          setState({ status: 'ready', kind: 'image', dataUrl })
          return
        }

        if (classification.type === 'pdf') {
          const data = await window.electronAPI.readFileBinary(path)
          if (cancelled) return
          setState({ status: 'ready', kind: 'pdf', data })
          return
        }

        if (isHtmlPath(path)) {
          const content = await window.electronAPI.readFile(path)
          if (cancelled) return
          setState({ status: 'ready', kind: 'html', content })
          return
        }

        if (!classification.canPreview && classification.type === null) {
          try {
            const content = await window.electronAPI.readFile(path)
            if (cancelled) return
            setState({ status: 'ready', kind: 'text', content })
          } catch {
            if (cancelled) return
            setState({
              status: 'ready',
              kind: 'binary',
              message: '此文件类型无法在应用内预览。',
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
          message: err instanceof Error ? err.message : '打开文件失败',
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [path])

  const openExternal = useCallback(() => {
    if (!path) return
    void window.electronAPI.openFile(path)
  }, [path])

  if (!path) {
    return (
      <PanelRoot>
        <PanelHeaderBarSplit left={<span className="font-medium truncate">预览</span>} />
        <PanelBody className="flex items-center justify-center text-sm text-muted-foreground">
          选择文件
        </PanelBody>
      </PanelRoot>
    )
  }

  const name = baseName(path)
  const showHtmlToggle = state.status === 'ready' && state.kind === 'html'

  return (
    <PanelRoot>
      <PanelHeaderBarSplit
        left={
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium truncate">{name}</span>
            <span className="text-muted-foreground truncate hidden sm:inline text-[11px]">
              {path}
            </span>
          </div>
        }
        right={
          <div className="flex items-center gap-0.5">
            {showHtmlToggle && (
              <>
                <button
                  type="button"
                  title="渲染"
                  className={cn(
                    'p-1 rounded text-muted-foreground hover:text-foreground hover:bg-foreground-5',
                    htmlMode === 'render' && 'bg-foreground-5 text-foreground',
                  )}
                  onClick={() => setHtmlMode('render')}
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="源码"
                  className={cn(
                    'p-1 rounded text-muted-foreground hover:text-foreground hover:bg-foreground-5',
                    htmlMode === 'source' && 'bg-foreground-5 text-foreground',
                  )}
                  onClick={() => setHtmlMode('source')}
                >
                  <Code2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            <button
              type="button"
              title={`在 ${getFileManagerName()} 中显示`}
              className="p-1 rounded hover:bg-foreground-5 text-muted-foreground hover:text-foreground"
              onClick={() => void window.electronAPI.showInFolder(path)}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        }
      />
      <PanelBody padding={false} scroll={false} className="flex flex-col bg-card min-h-0">
        {state.status === 'loading' && (
          <div className="flex-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner className="h-3.5 w-3.5" />
            加载中…
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
        {state.status === 'ready' && state.kind === 'pdf' && (
          <PdfInlineViewer data={state.data} />
        )}
        {state.status === 'ready' && state.kind === 'html' && (
          <HtmlInlineViewer html={state.content} mode={htmlMode} filePath={path} />
        )}
        {state.status === 'ready' && state.kind === 'video' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4 bg-foreground-3 min-h-0">
            <video
              controls
              preload="metadata"
              src={state.objectUrl}
              className="max-w-full max-h-full rounded shadow-sm bg-black"
            >
              <track kind="captions" />
            </video>
            <button
              type="button"
              className="text-xs underline text-muted-foreground hover:text-foreground"
              onClick={openExternal}
            >
              外部打开
            </button>
          </div>
        )}
        {state.status === 'ready' && state.kind === 'binary' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-sm text-muted-foreground">
            <FileWarning className="h-5 w-5" />
            <p>{state.message}</p>
            <button
              type="button"
              className="text-xs underline hover:text-foreground"
              onClick={openExternal}
            >
              外部打开
            </button>
            <button
              type="button"
              className="text-xs underline hover:text-foreground"
              onClick={() => void window.electronAPI.showInFolder(path)}
            >
              在 {getFileManagerName()} 中显示
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
            <div className="flex-1 overflow-auto">
              <ShikiCodeViewer
                code={state.content}
                filePath={path}
                language={state.kind === 'text' ? 'text' : getLanguageFromPath(path)}
              />
            </div>
          )}
        {state.status === 'idle' && (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
            等待…
          </div>
        )}
      </PanelBody>
    </PanelRoot>
  )
}
