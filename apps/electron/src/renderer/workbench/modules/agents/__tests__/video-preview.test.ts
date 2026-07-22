import { afterEach, describe, expect, it } from 'bun:test'
import {
  createVideoObjectUrl,
  getExtension,
  isVideoPath,
  videoMime,
} from '../video-preview'

describe('video-preview helpers', () => {
  const createdUrls: string[] = []

  afterEach(() => {
    for (const url of createdUrls) URL.revokeObjectURL(url)
    createdUrls.length = 0
  })

  it('parses extensions from dotted filenames', () => {
    expect(getExtension('/a/b/final.standard.mp4')).toBe('mp4')
    expect(getExtension('clip.WEBM')).toBe('webm')
    expect(getExtension('C:\\renders\\out.MOV')).toBe('mov')
    expect(getExtension('noext')).toBe('')
    expect(getExtension('.gitignore')).toBe('')
  })

  it('detects video paths', () => {
    expect(isVideoPath('/ws/mydata/jobs/final.standard.mp4')).toBe(true)
    expect(isVideoPath('preview.webm')).toBe(true)
    expect(isVideoPath('still.png')).toBe(false)
  })

  it('maps extensions to playable video MIME types', () => {
    expect(videoMime('mp4')).toBe('video/mp4')
    expect(videoMime('webm')).toBe('video/webm')
    expect(videoMime('mov')).toBe('video/quicktime')
  })

  it('creates a blob: URL with the given MIME type', async () => {
    const bytes = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70])
    const url = createVideoObjectUrl(bytes, 'video/mp4')
    createdUrls.push(url)
    expect(url.startsWith('blob:')).toBe(true)
    const blob = await fetch(url).then((r) => r.blob())
    expect(blob.type).toBe('video/mp4')
    expect(blob.size).toBe(bytes.byteLength)
  })
})
