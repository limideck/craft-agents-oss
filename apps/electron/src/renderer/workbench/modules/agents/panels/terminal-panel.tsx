import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Play } from 'lucide-react'
import { PanelRoot, PanelBody, PanelHeaderBarSplit } from '../../../dock/panel-primitives'

/**
 * Shared Terminal panel — a non-interactive run console scoped to a workspace
 * directory. Runs a shell command and shows combined output. Reused by the
 * Agents and Sites modules.
 *
 * Note: a full PTY terminal (xterm + node-pty) is a separate effort; this
 * panel covers the common "build / serve / test" workflow.
 */
export function TerminalPanel({ cwd, initialCommand }: { cwd: string | null; initialCommand?: string }) {
  const { t } = useTranslation()
  const [command, setCommand] = useState(initialCommand ?? '')
  const [output, setOutput] = useState<string>('')
  const [running, setRunning] = useState(false)

  const run = useCallback(async () => {
    const cmd = command.trim()
    if (!cmd || !cwd || running) return
    setRunning(true)
    setOutput((prev) => `${prev}${prev ? '\n' : ''}$ ${cmd}\n`)
    try {
      const res = await window.electronAPI.runCommand(cwd, cmd)
      setOutput((prev) => `${prev}${res.output}\n`)
    } catch (err) {
      setOutput((prev) => `${prev}${err instanceof Error ? err.message : String(err)}\n`)
    } finally {
      setRunning(false)
    }
  }, [command, cwd, running])

  return (
    <PanelRoot className="flex flex-col h-full">
      <PanelHeaderBarSplit
        left={<span className="text-xs font-medium">{t('workbench.terminal.title', 'Terminal')}</span>}
        right={
          <button
            type="button"
            onClick={() => void run()}
            disabled={!cwd || !command.trim() || running}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-xs hover:bg-muted disabled:opacity-40"
          >
            <Play className="h-3 w-3" />
            {t('workbench.terminal.run', 'Run')}
          </button>
        }
      />
      <PanelBody className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b px-2 py-1">
          <span className="text-xs text-muted-foreground">{cwd ?? '—'}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-black/90 p-2 font-mono text-xs text-green-200">
          {output ? (
            <pre className="whitespace-pre-wrap break-words">{output}</pre>
          ) : (
            <span className="text-muted-foreground">{t('workbench.terminal.empty', 'Run a command in the workspace directory.')}</span>
          )}
        </div>
        <div className="flex items-center gap-2 border-t px-2 py-1">
          <span className="text-xs text-muted-foreground">$</span>
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void run()
            }}
            placeholder={t('workbench.terminal.placeholder', 'e.g. npm run build')}
            className="flex-1 bg-transparent text-xs outline-none"
            disabled={!cwd}
          />
        </div>
      </PanelBody>
    </PanelRoot>
  )
}
