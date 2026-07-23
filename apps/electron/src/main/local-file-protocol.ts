/**
 * Local File Protocol Handler
 *
 * Registers a custom `local-file://` protocol that serves local files
 * directly to the renderer without loading them into V8 memory.
 *
 * Used primarily for video playback — <video src="local-file://path">
 * streams from disk via Chromium's network stack, avoiding the OOM
 * crash that occurs when large files are read into a Blob via IPC.
 *
 * URL format: local-file://<encodeURIComponent(absolutePath)>
 *
 * Supports:
 * - Range requests (required for video seeking)
 * - Proper MIME type detection from extension
 * - Path validation (must be absolute)
 */

import { protocol } from 'electron'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { isAbsolute, extname } from 'path'
import { mainLog } from './logger'

const MIME_MAP: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.ogg': 'video/ogg',
  '.ogv': 'video/ogg',
  '.m4v': 'video/mp4',
  '.3gp': 'video/3gpp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
}

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  return MIME_MAP[ext] ?? 'application/octet-stream'
}

/**
 * Register the local-file:// custom protocol scheme.
 * MUST be called before app.whenReady().
 */
export function registerLocalFileScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'local-file',
      privileges: {
        supportFetchAPI: true,
        standard: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ])
}

/**
 * Register the local-file:// protocol handler.
 * Must be called after app.whenReady().
 */
export function registerLocalFileHandler(): void {
  protocol.handle('local-file', async (request) => {
    try {
      const url = new URL(request.url)
      const filePath = decodeURIComponent(url.pathname)

      if (!filePath || !isAbsolute(filePath)) {
        return new Response(null, { status: 400, statusText: 'Invalid path' })
      }

      let fileStat
      try {
        fileStat = await stat(filePath)
      } catch {
        return new Response(null, { status: 404, statusText: 'File not found' })
      }

      if (!fileStat.isFile()) {
        return new Response(null, { status: 400, statusText: 'Not a file' })
      }

      const contentType = getMimeType(filePath)
      const totalSize = fileStat.size

      // Handle Range requests for video seeking
      const rangeHeader = request.headers.get('range')
      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
        if (match) {
          const start = parseInt(match[1], 10)
          const end = match[2] ? parseInt(match[2], 10) : totalSize - 1
          const chunkSize = end - start + 1

          if (start >= totalSize || end >= totalSize) {
            return new Response(null, {
              status: 416,
              headers: {
                'Content-Range': `bytes */${totalSize}`,
              },
            })
          }

          const stream = createReadStream(filePath, { start, end })
          const webStream = new ReadableStream({
            start(controller) {
              stream.on('data', (chunk: Buffer) => {
                controller.enqueue(new Uint8Array(chunk))
              })
              stream.on('end', () => controller.close())
              stream.on('error', (err) => controller.error(err))
            },
            cancel() {
              stream.destroy()
            },
          })

          return new Response(webStream, {
            status: 206,
            headers: {
              'Content-Type': contentType,
              'Content-Range': `bytes ${start}-${end}/${totalSize}`,
              'Content-Length': String(chunkSize),
              'Accept-Ranges': 'bytes',
            },
          })
        }
      }

      // Full file response (no Range)
      const stream = createReadStream(filePath)
      const webStream = new ReadableStream({
        start(controller) {
          stream.on('data', (chunk: Buffer) => {
            controller.enqueue(new Uint8Array(chunk))
          })
          stream.on('end', () => controller.close())
          stream.on('error', (err) => controller.error(err))
        },
        cancel() {
          stream.destroy()
        },
      })

      return new Response(webStream, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(totalSize),
          'Accept-Ranges': 'bytes',
        },
      })
    } catch (error) {
      mainLog.error('Local file protocol error:', error)
      return new Response(null, { status: 500 })
    }
  })

  mainLog.info('Registered local-file:// protocol handler')
}
