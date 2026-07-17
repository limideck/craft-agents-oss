export interface FileTreeNode {
  name: string
  path: string
  isDir: boolean
  /** undefined = not loaded yet; [] = loaded empty */
  children?: FileTreeNode[]
}

/** Path helpers that respect the separator used by the absolute path. */
export function pathSep(path: string): '/' | '\\' {
  return path.includes('\\') ? '\\' : '/'
}

export function joinPath(parent: string, name: string): string {
  if (!parent) return name
  const sep = pathSep(parent)
  return parent.endsWith(sep) ? `${parent}${name}` : `${parent}${sep}${name}`
}

export function parentDir(path: string): string {
  const sep = pathSep(path)
  const i = path.lastIndexOf(sep)
  if (i <= 0) return ''
  return path.slice(0, i)
}

export function baseName(path: string): string {
  const sep = pathSep(path)
  const i = path.lastIndexOf(sep)
  return i < 0 ? path : path.slice(i + 1)
}

export function compareTreeNodes(a: FileTreeNode, b: FileTreeNode): number {
  if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

export function findNodeByPath(root: FileTreeNode, targetPath: string): FileTreeNode | null {
  if (root.path === targetPath) return root
  if (!root.children) return null
  for (const child of root.children) {
    const found = findNodeByPath(child, targetPath)
    if (found) return found
  }
  return null
}

export function insertNodeInTree(
  root: FileTreeNode,
  parentPath: string,
  node: FileTreeNode,
): FileTreeNode {
  if (root.path === parentPath) {
    const children = [...(root.children ?? []), node].sort(compareTreeNodes)
    return { ...root, children }
  }
  if (!root.children) return root
  return {
    ...root,
    children: root.children.map((c) => insertNodeInTree(c, parentPath, node)),
  }
}

export function removeNodeFromTree(root: FileTreeNode, targetPath: string): FileTreeNode {
  if (!root.children) return root
  const filtered = root.children.filter((c) => c.path !== targetPath)
  return {
    ...root,
    children: filtered.map((c) => removeNodeFromTree(c, targetPath)),
  }
}

function replacePathPrefix(path: string, oldPrefix: string, newPrefix: string): string {
  if (path === oldPrefix) return newPrefix
  const sep = pathSep(path)
  if (path.startsWith(`${oldPrefix}${sep}`)) {
    return `${newPrefix}${path.slice(oldPrefix.length)}`
  }
  return path
}

function renameSubtree(node: FileTreeNode, oldPath: string, newPath: string): FileTreeNode {
  const nextPath = replacePathPrefix(node.path, oldPath, newPath)
  return {
    ...node,
    name: baseName(nextPath),
    path: nextPath,
    children: node.children?.map((child) => renameSubtree(child, oldPath, newPath)),
  }
}

export function renameNodeInTree(
  root: FileTreeNode,
  oldPath: string,
  newPath: string,
): FileTreeNode {
  if (root.path === oldPath) return renameSubtree(root, oldPath, newPath)
  if (!root.children) return root
  const nextChildren = root.children.map((c) => renameNodeInTree(c, oldPath, newPath))
  return { ...root, children: nextChildren.sort(compareTreeNodes) }
}

function deduplicateName(name: string, usedNames: Set<string>): string {
  if (!usedNames.has(name)) return name
  const dotIndex = name.lastIndexOf('.')
  const base = dotIndex > 0 ? name.slice(0, dotIndex) : name
  const ext = dotIndex > 0 ? name.slice(dotIndex) : ''
  let counter = 1
  let candidate = `${base} (${counter})${ext}`
  while (usedNames.has(candidate)) {
    counter++
    candidate = `${base} (${counter})${ext}`
  }
  return candidate
}

/** Compute old→new absolute path mappings for a move into targetDir. */
export function computeMoveTargets(
  root: FileTreeNode,
  sourcePaths: string[],
  targetDirPath: string,
): { oldPath: string; newPath: string }[] {
  const targetNode = findNodeByPath(root, targetDirPath) ?? root
  const usedNames = new Set((targetNode.children ?? []).map((c) => c.name))
  const results: { oldPath: string; newPath: string }[] = []

  for (const oldPath of sourcePaths) {
    const name = deduplicateName(baseName(oldPath), usedNames)
    usedNames.add(name)
    results.push({ oldPath, newPath: joinPath(targetDirPath, name) })
  }
  return results
}

export function moveNodesInTree(
  root: FileTreeNode,
  sourcePaths: string[],
  targetDirPath: string,
): FileTreeNode {
  const targets = computeMoveTargets(root, sourcePaths, targetDirPath)
  let next = root
  for (const { oldPath, newPath } of targets) {
    const node = findNodeByPath(next, oldPath)
    if (!node) continue
    const moved: FileTreeNode = {
      ...node,
      name: baseName(newPath),
      path: newPath,
      children: node.children?.map((c) => renameSubtree(c, oldPath, newPath)),
    }
    next = removeNodeFromTree(next, oldPath)
    next = insertNodeInTree(next, targetDirPath, moved)
  }
  return next
}

export function patchNodeChildren(
  root: FileTreeNode,
  dirPath: string,
  children: FileTreeNode[],
): FileTreeNode {
  if (root.path === dirPath) {
    return { ...root, children }
  }
  if (!root.children) return root
  return {
    ...root,
    children: root.children.map((c) => patchNodeChildren(c, dirPath, children)),
  }
}

export function entriesToNodes(
  entries: Array<{ name: string; path: string; isDir: boolean }>,
): FileTreeNode[] {
  return entries.map((entry) => ({
    name: entry.name,
    path: entry.path,
    isDir: entry.isDir,
    // Dirs start unloaded; files have no children key.
    ...(entry.isDir ? { children: undefined } : {}),
  }))
}
