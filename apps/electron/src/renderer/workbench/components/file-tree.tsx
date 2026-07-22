import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  ContextMenu,
  ContextMenuTrigger,
  StyledContextMenuContent,
  StyledContextMenuItem,
  StyledContextMenuSeparator,
} from '@/components/ui/styled-context-menu'
import { useTree, type VisibleRow } from './use-tree'
import {
  type FileTreeNode,
  baseName,
  compareTreeNodes,
  computeMoveTargets,
  entriesToNodes,
  findNodeByPath,
  insertNodeInTree,
  joinPath,
  moveNodesInTree,
  parentDir,
  patchNodeChildren,
  removeNodeFromTree,
  renameNodeInTree,
} from './file-tree-utils'

export type { FileTreeNode }

const GET_PATH = (n: FileTreeNode) => n.path
const GET_CHILDREN = (n: FileTreeNode) =>
  n.children ? [...n.children].sort(compareTreeNodes) : undefined
const IS_DIR = (n: FileTreeNode) => n.isDir

type CreatingKind = 'file' | 'folder'

interface FileTreeProps {
  nodes: FileTreeNode[]
  selectedPath?: string | null
  onSelectPath?: (path: string) => void
  onToggleFolder?: (node: FileTreeNode) => void | Promise<void>
  loadingPaths?: ReadonlySet<string>
  creating?: { parentPath: string; kind: CreatingKind } | null
  onSubmitCreate?: (parentPath: string, name: string, kind: CreatingKind) => void
  onCancelCreate?: () => void
  onStartCreate?: (parentPath: string, kind: CreatingKind) => void
  onRename?: (oldPath: string, newPath: string) => Promise<boolean>
  onDelete?: (path: string) => Promise<boolean>
  onMove?: (sources: string[], targetDir: string) => Promise<boolean>
  /** Called when a file row is activated (single click). Opens preview. */
  onOpenFile?: (path: string) => void
  /** Called on file double-click — pin a dedicated editor tab. */
  onPinFile?: (path: string) => void
  rootPath?: string | null
  revealLabel?: string
  defaultExpanded?: boolean
  renderExtra?: (node: FileTreeNode) => ReactNode
}

export function FileTree({
  nodes,
  selectedPath,
  onSelectPath,
  onToggleFolder,
  loadingPaths,
  creating,
  onSubmitCreate,
  onCancelCreate,
  onStartCreate,
  onRename,
  onDelete,
  onMove,
  onOpenFile,
  onPinFile,
  rootPath,
  revealLabel = 'Reveal in Finder',
  defaultExpanded = false,
  renderExtra,
}: FileTreeProps) {
  const tree = useTree<FileTreeNode>({
    nodes,
    getPath: GET_PATH,
    getChildren: GET_CHILDREN,
    isDir: IS_DIR,
    chainCollapse: false,
    defaultExpanded: defaultExpanded ? 'all' : undefined,
  })
  const { visibleRows, toggle, expand, isExpanded, setExpanded } = tree

  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [dragOverPath, setDragOverPath] = useState<string | null>(null)
  const [draggingPath, setDraggingPath] = useState<string | null>(null)
  const dragPathRef = useRef<string | null>(null)

  // Lazy-load children for any expanded folder that hasn't been fetched yet
  // (covers defaultExpanded seeding and expand-on-create).
  useEffect(() => {
    if (!onToggleFolder) return
    for (const row of visibleRows) {
      if (
        row.isDir &&
        row.isExpanded &&
        row.node.children === undefined &&
        !loadingPaths?.has(row.path)
      ) {
        void onToggleFolder(row.node)
      }
    }
  }, [visibleRows, onToggleFolder, loadingPaths])

  const handleRowActivate = useCallback(
    async (row: VisibleRow<FileTreeNode>) => {
      if (row.isDir) {
        const wasExpanded = isExpanded(row.path)
        toggle(row.path)
        if (!wasExpanded) {
          await onToggleFolder?.(row.node)
        }
        onSelectPath?.(row.path)
        return
      }
      onSelectPath?.(row.path)
      onOpenFile?.(row.path)
    },
    [isExpanded, toggle, onToggleFolder, onSelectPath, onOpenFile],
  )

  const handleRenameSubmit = useCallback(
    async (oldPath: string, nextName: string) => {
      setRenamingPath(null)
      const trimmed = nextName.trim()
      if (!trimmed || trimmed === baseName(oldPath) || !onRename) return
      const parent = parentDir(oldPath)
      const newPath = parent ? joinPath(parent, trimmed) : trimmed
      await onRename(oldPath, newPath)
    },
    [onRename],
  )

  const isDropInvalid = useCallback((source: string, target: string) => {
    if (source === target) return true
    const sep = source.includes('\\') ? '\\' : '/'
    return target.startsWith(`${source}${sep}`)
  }, [])

  const handleDragStart = useCallback((path: string, e: DragEvent) => {
    e.stopPropagation()
    dragPathRef.current = path
    setDraggingPath(path)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', path)
  }, [])

  const handleDragEnd = useCallback(() => {
    dragPathRef.current = null
    setDraggingPath(null)
    setDragOverPath(null)
  }, [])

  const handleDragOver = useCallback(
    (targetPath: string, e: DragEvent) => {
      e.stopPropagation()
      const source = dragPathRef.current
      if (!source || isDropInvalid(source, targetPath)) return
      if (parentDir(source) === targetPath) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (dragOverPath !== targetPath) setDragOverPath(targetPath)
    },
    [isDropInvalid, dragOverPath],
  )

  const handleDrop = useCallback(
    async (targetPath: string, e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOverPath(null)
      const source = dragPathRef.current || e.dataTransfer.getData('text/plain')
      setDraggingPath(null)
      dragPathRef.current = null
      if (!source || !onMove || isDropInvalid(source, targetPath)) return
      if (parentDir(source) === targetPath) return
      expand(targetPath)
      await onMove([source], targetPath)
    },
    [onMove, isDropInvalid, expand],
  )

  const ROOT_DROP = '__root__'
  const effectiveRootPath = rootPath ?? nodes[0]?.path ?? null

  const handleRootDragOver = useCallback(
    (e: DragEvent) => {
      if (!effectiveRootPath || !draggingPath) return
      const source = dragPathRef.current
      if (!source) return
      // Already under root — no-op highlight
      if (parentDir(source) === effectiveRootPath) return
      if (isDropInvalid(source, effectiveRootPath)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setDragOverPath(ROOT_DROP)
    },
    [effectiveRootPath, draggingPath, isDropInvalid],
  )

  const handleRootDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault()
      if (!effectiveRootPath) return
      setDragOverPath(null)
      const source = dragPathRef.current || e.dataTransfer.getData('text/plain')
      setDraggingPath(null)
      dragPathRef.current = null
      if (!source || !onMove) return
      if (parentDir(source) === effectiveRootPath) return
      if (isDropInvalid(source, effectiveRootPath)) return
      expand(effectiveRootPath)
      await onMove([source], effectiveRootPath)
    },
    [effectiveRootPath, onMove, isDropInvalid, expand],
  )

  // Ensure creating parent is expanded
  useEffect(() => {
    if (creating?.parentPath) {
      setExpanded((prev) => {
        if (prev.has(creating.parentPath)) return prev
        const next = new Set(prev)
        next.add(creating.parentPath)
        return next
      })
    }
  }, [creating, setExpanded])

  const creatingDepth = useMemo(() => {
    if (!creating) return 0
    const parentRow = visibleRows.find((r) => r.path === creating.parentPath)
    return parentRow ? parentRow.depth + 1 : 1
  }, [creating, visibleRows])

  const isRootDropTarget = dragOverPath === ROOT_DROP

  return (
    <div
      className={cn(
        'h-full min-h-[120px] overflow-y-auto py-1 outline-none transition-colors',
        isRootDropTarget && 'bg-accent/10',
      )}
      tabIndex={0}
      role="tree"
      onDragOver={handleRootDragOver}
      onDragLeave={() => {
        if (dragOverPath === ROOT_DROP) setDragOverPath(null)
      }}
      onDrop={(e) => void handleRootDrop(e)}
    >
      {visibleRows.map((row) => {
        const showInlineCreate =
          creating &&
          creating.parentPath === row.path &&
          row.isDir &&
          row.isExpanded

        return (
          <div key={row.path}>
            <FileTreeRow
              row={row}
              isActive={selectedPath === row.path}
              isLoading={loadingPaths?.has(row.path) ?? false}
              isDropTarget={dragOverPath === row.path}
              isDragging={draggingPath === row.path}
              isRenaming={renamingPath === row.path}
              rootPath={rootPath}
              onActivate={() => void handleRowActivate(row)}
              onDoubleActivate={() => {
                if (!row.isDir) onPinFile?.(row.path)
              }}
              onSelect={() => onSelectPath?.(row.path)}
              onStartRename={() => setRenamingPath(row.path)}
              onSubmitRename={(name) => void handleRenameSubmit(row.path, name)}
              onCancelRename={() => setRenamingPath(null)}
              onDelete={onDelete ? () => void onDelete(row.path) : undefined}
              onStartCreateFile={
                row.isDir && onStartCreate
                  ? () => onStartCreate(row.path, 'file')
                  : undefined
              }
              onStartCreateFolder={
                row.isDir && onStartCreate
                  ? () => onStartCreate(row.path, 'folder')
                  : undefined
              }
              onReveal={() => void window.electronAPI.showInFolder(row.path)}
              revealLabel={revealLabel}
              onDragStart={(e) => handleDragStart(row.path, e)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => {
                if (row.isDir) handleDragOver(row.path, e)
              }}
              onDragLeave={() => {
                if (dragOverPath === row.path) setDragOverPath(null)
              }}
              onDrop={(e) => {
                if (row.isDir) void handleDrop(row.path, e)
              }}
              renderExtra={renderExtra}
            />
            {showInlineCreate && (
              <InlineNameInput
                depth={creatingDepth}
                kind={creating.kind}
                onSubmit={(name) => onSubmitCreate?.(creating.parentPath, name, creating.kind)}
                onCancel={() => onCancelCreate?.()}
              />
            )}
          </div>
        )
      })}
      {creating &&
        creating.parentPath === rootPath &&
        !visibleRows.some((r) => r.path === rootPath && r.isExpanded) && (
          <InlineNameInput
            depth={1}
            kind={creating.kind}
            onSubmit={(name) => onSubmitCreate?.(creating.parentPath, name, creating.kind)}
            onCancel={() => onCancelCreate?.()}
          />
        )}
    </div>
  )
}

function FileTreeRow({
  row,
  isActive,
  isLoading,
  isDropTarget,
  isDragging,
  isRenaming,
  rootPath,
  onActivate,
  onDoubleActivate,
  onSelect,
  onStartRename,
  onSubmitRename,
  onCancelRename,
  onDelete,
  onStartCreateFile,
  onStartCreateFolder,
  onReveal,
  revealLabel,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  renderExtra,
}: {
  row: VisibleRow<FileTreeNode>
  isActive: boolean
  isLoading: boolean
  isDropTarget: boolean
  isDragging: boolean
  isRenaming: boolean
  rootPath?: string | null
  onActivate: () => void
  onDoubleActivate?: () => void
  onSelect: () => void
  onStartRename: () => void
  onSubmitRename: (name: string) => void
  onCancelRename: () => void
  onDelete?: () => void
  onStartCreateFile?: () => void
  onStartCreateFolder?: () => void
  onReveal: () => void
  revealLabel: string
  onDragStart: (e: DragEvent) => void
  onDragEnd: () => void
  onDragOver: (e: DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: DragEvent) => void
  renderExtra?: (node: FileTreeNode) => ReactNode
}) {
  const FolderIcon = row.isExpanded ? FolderOpen : Folder
  const ChevronIcon = row.isExpanded ? ChevronDown : ChevronRight
  const isRoot = rootPath != null && row.path === rootPath

  const rowEl = (
    <div
      className={cn(
        'group flex items-center gap-1 px-2 py-[3px] text-[13px] cursor-pointer select-none transition-colors',
        'hover:bg-foreground-5',
        isActive && 'bg-foreground-10',
        isDropTarget && 'bg-accent/20 outline outline-1 outline-accent',
        isDragging && 'opacity-50',
      )}
      style={{ paddingLeft: `${8 + row.depth * 12}px` }}
      onClick={(e) => {
        if (e.button === 2) return
        onActivate()
      }}
      onDoubleClick={(e) => {
        if (e.button === 2 || row.isDir) return
        e.preventDefault()
        onDoubleActivate?.()
      }}
      role="treeitem"
      aria-expanded={row.isDir ? row.isExpanded : undefined}
      data-path={row.path}
      data-is-dir={row.isDir ? 'true' : 'false'}
      draggable={!isRenaming && !isRoot}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={(e) => {
        e.stopPropagation()
        onDragLeave()
      }}
      onDrop={onDrop}
    >
      {row.isDir ? (
        <span className="shrink-0">
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (
            <ChevronIcon className="h-3 w-3 text-muted-foreground" />
          )}
        </span>
      ) : (
        <span className="w-3 shrink-0" />
      )}
      {row.isDir ? (
        <FolderIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      ) : (
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}
      {isRenaming ? (
        <InlineRenameInput
          initialValue={row.displayName}
          onSubmit={onSubmitRename}
          onCancel={onCancelRename}
        />
      ) : (
        <span className="truncate flex-1">{row.displayName}</span>
      )}
      {renderExtra?.(row.node)}
    </div>
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{rowEl}</ContextMenuTrigger>
      <StyledContextMenuContent>
        <StyledContextMenuItem
          onSelect={() => {
            onSelect()
            onActivate()
          }}
        >
          {row.isDir ? 'Open' : 'Select'}
        </StyledContextMenuItem>
        {onStartCreateFile && (
          <StyledContextMenuItem onSelect={onStartCreateFile}>
            <FilePlus />
            New File
          </StyledContextMenuItem>
        )}
        {onStartCreateFolder && (
          <StyledContextMenuItem onSelect={onStartCreateFolder}>
            <FolderPlus />
            New Folder
          </StyledContextMenuItem>
        )}
        {!isRoot && (
          <StyledContextMenuItem onSelect={onStartRename}>
            <Pencil />
            Rename
          </StyledContextMenuItem>
        )}
        <StyledContextMenuItem onSelect={onReveal}>
          <ExternalLink />
          {revealLabel}
        </StyledContextMenuItem>
        {!isRoot && onDelete && (
          <>
            <StyledContextMenuSeparator />
            <StyledContextMenuItem
              variant="destructive"
              onSelect={() => {
                if (window.confirm(`Delete “${row.displayName}”? This cannot be undone.`)) {
                  onDelete()
                }
              }}
            >
              <Trash2 />
              Delete
            </StyledContextMenuItem>
          </>
        )}
      </StyledContextMenuContent>
    </ContextMenu>
  )
}

function InlineRenameInput({
  initialValue,
  onSubmit,
  onCancel,
}: {
  initialValue: string
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    requestAnimationFrame(() => {
      ref.current?.focus()
      ref.current?.select()
    })
  }, [])

  return (
    <input
      ref={ref}
      type="text"
      defaultValue={initialValue}
      className="h-5 flex-1 min-w-0 text-xs px-1 py-0 rounded border border-border bg-background"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') onSubmit(ref.current?.value ?? '')
        if (e.key === 'Escape') onCancel()
      }}
      onBlur={() => {
        const value = ref.current?.value.trim()
        if (value) onSubmit(value)
        else onCancel()
      }}
    />
  )
}

function InlineNameInput({
  depth,
  kind,
  onSubmit,
  onCancel,
}: {
  depth: number
  kind: CreatingKind
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    requestAnimationFrame(() => ref.current?.focus())
  }, [])

  return (
    <div
      className="flex items-center gap-1 px-2 py-[3px]"
      style={{ paddingLeft: `${8 + depth * 12}px` }}
    >
      <span className="w-3 shrink-0" />
      {kind === 'folder' ? (
        <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      ) : (
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}
      <input
        ref={ref}
        type="text"
        className="h-5 flex-1 min-w-0 text-[13px] px-1 py-0 rounded border border-border bg-background"
        placeholder={kind === 'folder' ? 'folder name…' : 'filename…'}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const value = ref.current?.value.trim()
            if (value) onSubmit(value)
            else onCancel()
          } else if (e.key === 'Escape') {
            onCancel()
          }
        }}
        onBlur={() => {
          const value = ref.current?.value.trim()
          if (value) onSubmit(value)
          else onCancel()
        }}
      />
    </div>
  )
}

export function FileTreeToolbar({
  onNewFile,
  onNewFolder,
  disabled,
}: {
  onNewFile: () => void
  onNewFolder: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        title="New File"
        disabled={disabled}
        onClick={onNewFile}
        className="p-1 rounded hover:bg-foreground-5 text-muted-foreground hover:text-foreground disabled:opacity-40"
      >
        <FilePlus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="New Folder"
        disabled={disabled}
        onClick={onNewFolder}
        className="p-1 rounded hover:bg-foreground-5 text-muted-foreground hover:text-foreground disabled:opacity-40"
      >
        <FolderPlus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/** Thin adapter: lazy-load workspace entries + mutations via Grose fs RPC. */
export function useWorkspaceFileTree(rootPath: string | null) {
  const [root, setRoot] = useState<FileTreeNode | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(() => new Set())
  const inFlightRef = useRef<Set<string>>(new Set())
  const rootRef = useRef<FileTreeNode | null>(null)
  rootRef.current = root

  const mapEntries = useCallback(
    (entries: Array<{ name: string; path: string; isDir: boolean }>) => entriesToNodes(entries),
    [],
  )

  const reload = useCallback(async () => {
    if (!rootPath) {
      setRoot(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      // mkdir -p so listing works when mydata (or another root) was just ensured/created.
      await window.electronAPI.createServerDirectory(rootPath)
      const listing = await window.electronAPI.listServerEntries(rootPath)
      const children = mapEntries(listing.entries ?? [])
      setRoot({
        name: baseName(listing.currentPath || rootPath),
        path: listing.currentPath || rootPath,
        isDir: true,
        children,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list directory')
      setRoot(null)
    } finally {
      setLoading(false)
    }
  }, [rootPath, mapEntries])

  useEffect(() => {
    void reload()
  }, [reload])

  const loadChildren = useCallback(
    async (node: FileTreeNode) => {
      if (!node.isDir) return
      const latest = rootRef.current ? findNodeByPath(rootRef.current, node.path) : node
      if (latest?.children !== undefined) return
      if (inFlightRef.current.has(node.path)) return
      inFlightRef.current.add(node.path)
      setLoadingPaths((prev) => new Set(prev).add(node.path))
      try {
        const listing = await window.electronAPI.listServerEntries(node.path)
        const children = mapEntries(listing.entries ?? [])
        setRoot((prev) => (prev ? patchNodeChildren(prev, node.path, children) : prev))
      } catch (err) {
        // Mark as loaded (empty) so the expand effect does not retry forever.
        setRoot((prev) => (prev ? patchNodeChildren(prev, node.path, []) : prev))
        toast.error(err instanceof Error ? err.message : 'Failed to load folder')
      } finally {
        inFlightRef.current.delete(node.path)
        setLoadingPaths((prev) => {
          const next = new Set(prev)
          next.delete(node.path)
          return next
        })
      }
    },
    [mapEntries],
  )

  const ensureDirLoaded = useCallback(
    async (dirPath: string) => {
      const node = rootRef.current ? findNodeByPath(rootRef.current, dirPath) : null
      if (!node?.isDir || node.children !== undefined) return
      await loadChildren(node)
    },
    [loadChildren],
  )

  const createItem = useCallback(
    async (parentPath: string, name: string, kind: CreatingKind): Promise<boolean> => {
      await ensureDirLoaded(parentPath)
      const newPath = joinPath(parentPath, name)
      const optimistic: FileTreeNode = {
        name,
        path: newPath,
        isDir: kind === 'folder',
        children: kind === 'folder' ? [] : undefined,
      }
      const snapshot = rootRef.current
      setRoot((prev) => (prev ? insertNodeInTree(prev, parentPath, optimistic) : prev))
      try {
        if (kind === 'folder') {
          await window.electronAPI.createServerDirectory(newPath)
        } else {
          await window.electronAPI.createServerFile(newPath)
        }
        return true
      } catch (err) {
        setRoot(snapshot)
        toast.error(err instanceof Error ? err.message : `Failed to create ${kind}`)
        return false
      }
    },
    [ensureDirLoaded],
  )

  const renameItem = useCallback(async (oldPath: string, newPath: string): Promise<boolean> => {
    const snapshot = rootRef.current
    setRoot((prev) => (prev ? renameNodeInTree(prev, oldPath, newPath) : prev))
    try {
      await window.electronAPI.renameServerPath(oldPath, newPath)
      return true
    } catch (err) {
      setRoot(snapshot)
      toast.error(err instanceof Error ? err.message : 'Failed to rename')
      return false
    }
  }, [])

  const deleteItem = useCallback(async (path: string): Promise<boolean> => {
    const snapshot = rootRef.current
    setRoot((prev) => (prev ? removeNodeFromTree(prev, path) : prev))
    try {
      await window.electronAPI.deleteServerPath(path)
      return true
    } catch (err) {
      setRoot(snapshot)
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
      return false
    }
  }, [])

  const moveItems = useCallback(
    async (sources: string[], targetDir: string): Promise<boolean> => {
      await ensureDirLoaded(targetDir)
      const snapshot = rootRef.current
      if (!snapshot) return false
      const targets = computeMoveTargets(snapshot, sources, targetDir)
      setRoot((prev) => (prev ? moveNodesInTree(prev, sources, targetDir) : prev))
      try {
        await Promise.all(
          targets.map(({ oldPath, newPath }) =>
            window.electronAPI.renameServerPath(oldPath, newPath),
          ),
        )
        return true
      } catch (err) {
        setRoot(snapshot)
        toast.error(err instanceof Error ? err.message : 'Failed to move')
        return false
      }
    },
    [ensureDirLoaded],
  )

  const nodes = useMemo(() => (root ? [root] : []), [root])

  return useMemo(
    () => ({
      nodes,
      root,
      loading,
      error,
      loadingPaths,
      reload,
      loadChildren,
      createItem,
      renameItem,
      deleteItem,
      moveItems,
      findNode: (path: string) => (root ? findNodeByPath(root, path) : null),
    }),
    [
      nodes,
      root,
      loading,
      error,
      loadingPaths,
      reload,
      loadChildren,
      createItem,
      renameItem,
      deleteItem,
      moveItems,
    ],
  )
}
