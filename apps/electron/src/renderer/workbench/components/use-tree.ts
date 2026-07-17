import React, { useCallback, useEffect, useMemo, useState } from 'react'

export type SearchMode = 'hide' | 'collapse' | 'expand'

export interface UseTreeOptions<N> {
  nodes: N[]
  getPath: (node: N) => string
  getChildren: (node: N) => N[] | undefined
  isDir: (node: N) => boolean
  defaultExpanded?: 'all' | Iterable<string>
  search?: string
  searchMode?: SearchMode
  chainCollapse?: boolean
}

export interface VisibleRow<N> {
  node: N
  chainRoot: N
  displayName: string
  path: string
  depth: number
  isExpanded: boolean
  isDir: boolean
}

export interface UseTreeResult<N> {
  visibleRows: VisibleRow<N>[]
  expanded: ReadonlySet<string>
  isExpanded: (path: string) => boolean
  toggle: (path: string) => void
  expand: (path: string) => void
  collapse: (path: string) => void
  expandAll: () => void
  collapseAll: () => void
  expandAncestorsOf: (path: string) => void
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>
}

function lastSegment(p: string): string {
  const i = p.lastIndexOf('/')
  return i < 0 ? p : p.slice(i + 1)
}

function collectAllDirPaths<N>(
  nodes: N[],
  isDir: (n: N) => boolean,
  getPath: (n: N) => string,
  getChildren: (n: N) => N[] | undefined,
): string[] {
  const out: string[] = []
  const stack = [...nodes]
  while (stack.length) {
    const n = stack.pop() as N
    if (isDir(n)) {
      out.push(getPath(n))
      const ch = getChildren(n)
      if (ch && ch.length) stack.push(...ch)
    }
  }
  return out
}

function ancestorPaths(path: string): string[] {
  const parts = path.split('/')
  const out: string[] = []
  for (let i = 1; i < parts.length; i++) {
    out.push(parts.slice(0, i).join('/'))
  }
  return out
}

export function useTree<N>(options: UseTreeOptions<N>): UseTreeResult<N> {
  const {
    nodes,
    getPath,
    getChildren,
    isDir,
    defaultExpanded,
    search,
    searchMode = 'hide',
    chainCollapse = false,
  } = options

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (defaultExpanded === 'all') {
      return new Set(collectAllDirPaths(nodes, isDir, getPath, getChildren))
    }
    if (defaultExpanded) return new Set(defaultExpanded)
    return new Set()
  })

  useEffect(() => {
    if (defaultExpanded === 'all') {
      setExpanded(new Set(collectAllDirPaths(nodes, isDir, getPath, getChildren)))
    }
    // Only seed once when nodes first arrive with 'all'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length === 0])

  const isExpanded = useCallback((path: string) => expanded.has(path), [expanded])

  const toggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const expand = useCallback((path: string) => {
    setExpanded((prev) => {
      if (prev.has(path)) return prev
      const next = new Set(prev)
      next.add(path)
      return next
    })
  }, [])

  const collapse = useCallback((path: string) => {
    setExpanded((prev) => {
      if (!prev.has(path)) return prev
      const next = new Set(prev)
      next.delete(path)
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    setExpanded(new Set(collectAllDirPaths(nodes, isDir, getPath, getChildren)))
  }, [nodes, isDir, getPath, getChildren])

  const collapseAll = useCallback(() => {
    setExpanded(new Set())
  }, [])

  const expandAncestorsOf = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      for (const a of ancestorPaths(path)) next.add(a)
      return next
    })
  }, [])

  const visibleRows = useMemo(() => {
    const rows: VisibleRow<N>[] = []
    const needle = search?.trim().toLowerCase()

    const walk = (list: N[], depth: number) => {
      for (const node of list) {
        const path = getPath(node)
        const dir = isDir(node)
        let displayName = lastSegment(path)
        let effective = node
        let chainRoot = node

        if (chainCollapse && dir) {
          let cur = node
          const parts = [lastSegment(getPath(cur))]
          while (true) {
            const ch = getChildren(cur)
            if (!ch || ch.length !== 1 || !isDir(ch[0])) break
            cur = ch[0]
            parts.push(lastSegment(getPath(cur)))
          }
          if (parts.length > 1) {
            displayName = parts.join('/')
            effective = cur
            chainRoot = node
          }
        }

        const effectivePath = getPath(effective)
        const nameMatch = !needle || displayName.toLowerCase().includes(needle) || effectivePath.toLowerCase().includes(needle)

        if (needle && searchMode === 'hide' && !nameMatch && dir) {
          // Keep ancestors of matches — check descendants
          const hasMatchDescendant = (n: N): boolean => {
            const ch = getChildren(n)
            if (!ch) return false
            for (const c of ch) {
              const p = getPath(c)
              if (p.toLowerCase().includes(needle) || lastSegment(p).toLowerCase().includes(needle)) return true
              if (isDir(c) && hasMatchDescendant(c)) return true
            }
            return false
          }
          if (!hasMatchDescendant(effective)) continue
        } else if (needle && searchMode === 'hide' && !nameMatch && !dir) {
          continue
        }

        const exp = expanded.has(effectivePath) || (Boolean(needle) && searchMode !== 'collapse')
        rows.push({
          node: effective,
          chainRoot,
          displayName,
          path: effectivePath,
          depth,
          isExpanded: exp,
          isDir: isDir(effective),
        })

        if (isDir(effective) && exp) {
          const ch = getChildren(effective)
          if (ch) walk(ch, depth + 1)
        }
      }
    }

    walk(nodes, 0)
    return rows
  }, [nodes, getPath, getChildren, isDir, expanded, search, searchMode, chainCollapse])

  return {
    visibleRows,
    expanded,
    isExpanded,
    toggle,
    expand,
    collapse,
    expandAll,
    collapseAll,
    expandAncestorsOf,
    setExpanded,
  }
}
