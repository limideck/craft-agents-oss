/**
 * Resolve a chat markdown file-link target to an absolute (or home-relative) path.
 *
 * - Absolute / `~/` paths are returned as-is
 * - `mydata/...` paths are workspace-root-relative (Files panel / AI table convention)
 * - Other relative paths join against session cwd, else workspace root
 */
export function resolveChatFilePath(
  path: string,
  options: {
    workingDirectory?: string | null
    workspaceRootPath?: string | null
  },
): string {
  if (path.startsWith('/') || path.startsWith('~/')) return path

  const cleanedPath = path.replace(/^\.\//, '')
  const workspaceRoot = options.workspaceRootPath?.replace(/\/+$/, '') || null

  if (
    workspaceRoot &&
    (cleanedPath === 'mydata' ||
      cleanedPath.startsWith('mydata/') ||
      cleanedPath.startsWith('mydata\\'))
  ) {
    return `${workspaceRoot}/${cleanedPath}`
  }

  const baseDir = options.workingDirectory || options.workspaceRootPath
  if (!baseDir) return path

  const cleanedBase = baseDir.replace(/\/+$/, '')
  return `${cleanedBase}/${cleanedPath}`
}
