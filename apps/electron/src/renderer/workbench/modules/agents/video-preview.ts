/** Extensions previewed inline with an HTML5 <video> element. */
export const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov'])

export function getExtension(filePath: string): string {
  const basename = filePath.split(/[/\\]/).pop() ?? filePath
  const dotIndex = basename.lastIndexOf('.')
  if (dotIndex === -1 || dotIndex === 0) return ''
  return basename.slice(dotIndex + 1).toLowerCase()
}

export function isVideoPath(filePath: string): boolean {
  return VIDEO_EXTENSIONS.has(getExtension(filePath))
}

export function videoMime(ext: string): string {
  if (ext === 'webm') return 'video/webm'
  if (ext === 'mov') return 'video/quicktime'
  return 'video/mp4'
}

/**
 * Build a blob: URL for <video src>. Chromium will not play media from
 * data: URLs (especially with application/octet-stream), and seeking needs
 * a real blob/resource URL.
 */
export function createVideoObjectUrl(bytes: Uint8Array, mime: string): string {
  // Copy into a fresh Uint8Array so Blob always gets a contiguous ArrayBuffer
  // (IPC may hand back a view over a larger transfer buffer).
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return URL.createObjectURL(new Blob([copy], { type: mime }))
}

/**
 * Build a local-file:// URL for <video src>. Streams directly from disk
 * via Electron's custom protocol — avoids loading the entire file into
 * V8 memory (which causes OOM for large videos).
 */
export function localFileUrl(filePath: string): string {
  return `local-file://${encodeURIComponent(filePath)}`
}
