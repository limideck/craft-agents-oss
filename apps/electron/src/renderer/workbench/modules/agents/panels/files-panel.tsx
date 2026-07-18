import { useCallback, useMemo, useState } from 'react'
import { useAppShellContext } from '@/context/AppShellContext'
import {
  FileTree,
  FileTreeToolbar,
  useWorkspaceFileTree,
} from '../../../components/file-tree'
import { joinPath } from '../../../components/file-tree-utils'
import { PanelRoot, PanelBody, PanelHeaderBarSplit } from '../../../dock/panel-primitives'
import { Spinner } from '@grose-agent/ui'
import { getFileManagerName } from '@/lib/platform'
import { useOpenFileEditor } from '../open-file-editor'

/**
 * Files panel — workspace file tree with lazy expand, create, rename, delete, and drag-move.
 * Clicking a file opens the center preview panel (kandev-style); double-click pins a tab.
 */
export function FilesPanel() {
  const { workspaces, activeWorkspaceId } = useAppShellContext()
  const openFile = useOpenFileEditor()
  const workspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId),
    [workspaces, activeWorkspaceId],
  )
  const rootPath = workspace?.rootPath ?? null
  const tree = useWorkspaceFileTree(rootPath)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [creating, setCreating] = useState<{
    parentPath: string
    kind: 'file' | 'folder'
  } | null>(null)

  const activeFolderPath = useMemo(() => {
    if (!selectedPath || !tree.root) return rootPath
    const node = tree.findNode(selectedPath)
    if (node?.isDir) return node.path
    if (selectedPath.includes('/') || selectedPath.includes('\\')) {
      const sep = selectedPath.includes('\\') ? '\\' : '/'
      const i = selectedPath.lastIndexOf(sep)
      return i > 0 ? selectedPath.slice(0, i) : rootPath
    }
    return rootPath
  }, [selectedPath, tree, rootPath])

  const startCreate = useCallback(
    (kind: 'file' | 'folder') => {
      const parent = activeFolderPath || rootPath
      if (!parent) return
      setCreating({ parentPath: parent, kind })
    },
    [activeFolderPath, rootPath],
  )

  const handleSubmitCreate = useCallback(
    (parentPath: string, name: string, kind: 'file' | 'folder') => {
      setCreating(null)
      void tree.createItem(parentPath, name, kind).then((ok) => {
        if (!ok) return
        const newPath = joinPath(parentPath, name)
        setSelectedPath(newPath)
        if (kind === 'file') openFile(newPath)
      })
    },
    [tree, openFile],
  )

  const handleSelectPath = useCallback(
    (path: string) => {
      setSelectedPath(path)
    },
    [],
  )

  return (
    <PanelRoot>
      <PanelHeaderBarSplit
        left={<span className="font-medium truncate">Files</span>}
        right={
          <FileTreeToolbar
            disabled={!rootPath || !!tree.loading || !!tree.error}
            onNewFile={() => startCreate('file')}
            onNewFolder={() => startCreate('folder')}
          />
        }
      />
      <PanelBody padding={false}>
        {!rootPath && (
          <div className="p-3 text-sm text-muted-foreground">No workspace directory.</div>
        )}
        {rootPath && tree.loading && (
          <div className="p-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="h-3.5 w-3.5" /> Loading…
          </div>
        )}
        {rootPath && tree.error && (
          <div className="p-3 text-sm text-destructive">{tree.error}</div>
        )}
        {rootPath && !tree.loading && !tree.error && (
          <FileTree
            nodes={tree.nodes}
            selectedPath={selectedPath}
            onSelectPath={handleSelectPath}
            onOpenFile={(path) => openFile(path)}
            onPinFile={(path) => openFile(path, { pin: true })}
            onToggleFolder={tree.loadChildren}
            loadingPaths={tree.loadingPaths}
            creating={creating}
            onSubmitCreate={handleSubmitCreate}
            onCancelCreate={() => setCreating(null)}
            onStartCreate={(parentPath, kind) => setCreating({ parentPath, kind })}
            onRename={tree.renameItem}
            onDelete={tree.deleteItem}
            onMove={tree.moveItems}
            rootPath={tree.root?.path ?? rootPath}
            revealLabel={`Reveal in ${getFileManagerName()}`}
            defaultExpanded
          />
        )}
      </PanelBody>
    </PanelRoot>
  )
}
