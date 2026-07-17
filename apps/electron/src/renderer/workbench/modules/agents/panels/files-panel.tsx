import { useMemo, useState } from 'react'
import { useAppShellContext } from '@/context/AppShellContext'
import { FileTree, useWorkspaceFileTree } from '../../../components/file-tree'
import { PanelRoot, PanelBody, PanelHeaderBar } from '../../../dock/panel-primitives'
import { Spinner } from '@craft-agent/ui'

/**
 * Files panel shell — file-tree primitive + thin Craft fs adapter.
 * Lazy-loads one directory level; nested expand is Phase 3+.
 */
export function FilesPanel() {
  const { workspaces, activeWorkspaceId } = useAppShellContext()
  const workspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId),
    [workspaces, activeWorkspaceId],
  )
  const rootPath = workspace?.rootPath ?? null
  const { nodes, loading, error } = useWorkspaceFileTree(rootPath)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  return (
    <PanelRoot>
      <PanelHeaderBar>
        <span className="font-medium truncate">Files</span>
      </PanelHeaderBar>
      <PanelBody padding={false}>
        {!rootPath && (
          <div className="p-3 text-sm text-muted-foreground">No workspace directory.</div>
        )}
        {rootPath && loading && (
          <div className="p-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="h-3.5 w-3.5" /> Loading…
          </div>
        )}
        {rootPath && error && (
          <div className="p-3 text-sm text-destructive">{error}</div>
        )}
        {rootPath && !loading && !error && (
          <FileTree
            nodes={nodes}
            selectedPath={selectedPath}
            onSelectPath={setSelectedPath}
            defaultExpanded
          />
        )}
      </PanelBody>
    </PanelRoot>
  )
}
