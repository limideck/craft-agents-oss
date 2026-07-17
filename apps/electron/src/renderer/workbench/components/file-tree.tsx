import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTree, type VisibleRow } from './use-tree'

export interface FileTreeNode {
  name: string
  path: string
  isDir: boolean
  children: FileTreeNode[]
}

const GET_PATH = (n: FileTreeNode) => n.path
const GET_CHILDREN = (n: FileTreeNode) => n.children
const IS_DIR = (n: FileTreeNode) => n.isDir

interface FileTreeProps {
  nodes: FileTreeNode[]
  selectedPath?: string | null
  onSelectPath?: (path: string) => void
  renderExtra?: (node: FileTreeNode) => ReactNode
  defaultExpanded?: boolean
}

export function FileTree({
  nodes,
  selectedPath,
  onSelectPath,
  renderExtra,
  defaultExpanded = false,
}: FileTreeProps) {
  const tree = useTree<FileTreeNode>({
    nodes,
    getPath: GET_PATH,
    getChildren: GET_CHILDREN,
    isDir: IS_DIR,
    chainCollapse: true,
    defaultExpanded: defaultExpanded ? 'all' : undefined,
  })
  const { visibleRows, toggle } = tree

  return (
    <div className="overflow-y-auto py-1 outline-none" tabIndex={0} role="tree">
      {visibleRows.map((row) => (
        <FileTreeRow
          key={row.path}
          row={row}
          isActive={!row.isDir && selectedPath === row.path}
          onClick={() => {
            if (row.isDir) toggle(row.path)
            else onSelectPath?.(row.path)
          }}
          renderExtra={renderExtra}
        />
      ))}
    </div>
  )
}

function FileTreeRow({
  row,
  isActive,
  onClick,
  renderExtra,
}: {
  row: VisibleRow<FileTreeNode>
  isActive: boolean
  onClick: () => void
  renderExtra?: (node: FileTreeNode) => ReactNode
}) {
  const FolderIcon = row.isExpanded ? FolderOpen : Folder
  const ChevronIcon = row.isExpanded ? ChevronDown : ChevronRight

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 text-sm cursor-pointer hover:bg-foreground-5',
        isActive && 'bg-foreground-10',
      )}
      style={{ paddingLeft: `${row.depth * 16 + 8}px` }}
      onClick={onClick}
      role="treeitem"
      aria-expanded={row.isDir ? row.isExpanded : undefined}
    >
      {row.isDir && <ChevronIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      {row.isDir ? (
        <FolderIcon className="h-4 w-4 text-muted-foreground shrink-0" />
      ) : (
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
      <span className="truncate">{row.displayName}</span>
      {renderExtra?.(row.node)}
    </div>
  )
}

/** Thin adapter: load a directory listing via Craft fs RPC into FileTreeNodes. */
export function useWorkspaceFileTree(rootPath: string | null) {
  const [nodes, setNodes] = useState<FileTreeNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!rootPath) {
      setNodes([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      // listServerDirectory returns directories only (remote browse API).
      const listing = await window.electronAPI.listServerDirectory(rootPath)
      const children: FileTreeNode[] = (listing.entries ?? []).map((entry) => ({
        name: entry.name,
        path: entry.path,
        isDir: true,
        children: [],
      }))
      setNodes([
        {
          name: rootPath.split('/').pop() || rootPath,
          path: listing.currentPath || rootPath,
          isDir: true,
          children,
        },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list directory')
      setNodes([])
    } finally {
      setLoading(false)
    }
  }, [rootPath])

  useEffect(() => {
    void reload()
  }, [reload])

  return useMemo(() => ({ nodes, loading, error, reload }), [nodes, loading, error, reload])
}
