/**
 * Voice input IPC handlers — local speech-to-text via sherpa-onnx (SenseVoice).
 *
 * Model lifecycle (download / status / delete) plus on-device transcription.
 * Mirrors the standalone test/voiceinput prototype, adapted to the RPC server
 * transport used by the Electron app. Download progress is pushed to all
 * renderer clients via server.push().
 */

import * as path from 'path'
import * as fs from 'fs'
import { app, systemPreferences, shell } from 'electron'
import { RPC_CHANNELS } from '@grose-agent/shared/protocol'
import type { RpcServer } from '@grose-agent/server-core/transport'
import type { HandlerDeps } from './handler-deps'

// ====== CONFIGURATION ======
const MODEL_DIR_NAME = 'sensevoice-small'
const MODEL_FILES = [
  {
    name: 'model.int8.onnx',
    url: 'https://hf-mirror.com/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/main/model.int8.onnx',
    size: 0xe4e1c00,
  },
  {
    name: 'tokens.txt',
    url: 'https://hf-mirror.com/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/main/tokens.txt',
    size: 0x493e0,
  },
]

export interface VoiceModelStatus {
  installed: boolean
  modelDir: string
  modelSize?: number
  missingFiles?: string[]
}

export interface VoiceDownloadProgress {
  percent: number
  downloaded: number
  total: number
  speed: number
  currentFile: string
  fileIndex: number
  totalFiles: number
}

function getModelDir(): string {
  return path.join(app.getPath('userData'), 'models', MODEL_DIR_NAME)
}

function getModelStatus(): VoiceModelStatus {
  const modelDir = getModelDir()
  const missingFiles: string[] = []
  let totalSize = 0
  for (const file of MODEL_FILES) {
    const fp = path.join(modelDir, file.name)
    if (fs.existsSync(fp)) {
      try {
        const s = fs.statSync(fp).size
        if (s < file.size * 0.5) missingFiles.push(file.name)
        else totalSize += s
      } catch {
        missingFiles.push(file.name)
      }
    } else {
      missingFiles.push(file.name)
    }
  }
  return {
    installed: missingFiles.length === 0,
    modelDir,
    modelSize: totalSize > 0 ? totalSize : undefined,
    missingFiles: missingFiles.length > 0 ? missingFiles : undefined,
  }
}

// ====== Download logic ======
const http = require('http')
const https = require('https')

function downloadFile(
  url: string,
  destPath: string,
  onProgress: (downloaded: number, total: number) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let done = false
    const ok = () => {
      if (!done) {
        done = true
        resolve()
      }
    }
    const fail = (e: Error) => {
      if (!done) {
        done = true
        reject(e)
      }
    }
    if (signal.aborted) {
      fail(new Error('Cancelled'))
      return
    }
    const go = (u: string, redirects: number) => {
      if (redirects > 5) {
        fail(new Error('Too many redirects'))
        return
      }
      const mod = u.startsWith('https') ? https : http
      const req = mod.get(u, (res: any) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.destroy()
          go(new URL(res.headers.location, u).href, redirects + 1)
          return
        }
        if (res.statusCode !== 200) {
          res.destroy()
          fail(new Error('HTTP ' + res.statusCode))
          return
        }
        const total = parseInt(res.headers['content-length'] || '0', 10)
        let downloaded = 0
        const ws = fs.createWriteStream(destPath)
        res.on('data', (chunk: Buffer) => {
          if (signal.aborted) {
            res.destroy()
            ws.destroy()
            try {
              fs.unlinkSync(destPath)
            } catch {}
            fail(new Error('Cancelled'))
            return
          }
          downloaded += chunk.length
          ws.write(chunk)
          onProgress(downloaded, total)
        })
        res.on('end', () => ws.end(() => ok()))
        ws.on('error', (e: Error) => {
          res.destroy()
          try {
            fs.unlinkSync(destPath)
          } catch {}
          fail(e)
        })
        res.on('error', (e: Error) => {
          ws.destroy()
          try {
            fs.unlinkSync(destPath)
          } catch {}
          fail(e)
        })
      })
      req.on('error', (e: Error) => fail(e))
      signal.addEventListener(
        'abort',
        () => {
          req.destroy()
          try {
            fs.unlinkSync(destPath)
          } catch {}
          fail(new Error('Cancelled'))
        },
        { once: true },
      )
    }
    go(url, 0)
  })
}

let activeCtrl: AbortController | null = null

// ====== ASR engine ======
let cachedRec: any = null
let cachedDir: string | null = null

function getSherpa(): any {
  // Native module — kept external so esbuild does not bundle it.
  return require('sherpa-onnx-node')
}

function getRecognizer(modelDir: string): any {
  if (cachedRec && cachedDir === modelDir) return cachedRec
  const s = getSherpa()
  const cfg = {
    modelConfig: {
      senseVoice: {
        model: path.join(modelDir, 'model.int8.onnx'),
        language: '',
        useInverseTextNormalization: 1,
      },
      tokens: path.join(modelDir, 'tokens.txt'),
      numThreads: 4,
      debug: 0,
    },
  }
  cachedRec = new s.OfflineRecognizer(cfg)
  cachedDir = modelDir
  return cachedRec
}

function releaseRec(): void {
  cachedRec = null
  cachedDir = null
}

interface WavHeader {
  sampleRate: number
  numChannels: number
  bitsPerSample: number
  dataStart: number
  dataSize: number
}

function readWavHeader(fp: string): WavHeader {
  const fd = fs.openSync(fp, 'r')
  try {
    const h = Buffer.alloc(128)
    fs.readSync(fd, h, 0, 128, 0)
    if (h.toString('ascii', 0, 4) !== 'RIFF') throw new Error('Not WAV')
    let off = 12
    let sr = 16000
    let bps = 16
    let nc = 1
    const sz = fs.statSync(fp).size
    let buf = h
    while (off < sz - 8) {
      if (off + 8 > buf.length) {
        const nb = Buffer.alloc(Math.min(off + 1024, sz))
        buf.copy(nb)
        fs.readSync(fd, nb, buf.length, 0, nb.length - buf.length)
        buf = nb
      }
      const id = buf.toString('ascii', off, off + 4)
      const cs = buf.readUInt32LE(off + 4)
      if (id === 'fmt ') {
        if (off + 24 > buf.length) {
          const nb = Buffer.alloc(off + 1024)
          buf.copy(nb)
          fs.readSync(fd, nb, buf.length, 0, nb.length - buf.length)
          buf = nb
        }
        nc = buf.readUInt16LE(off + 10)
        sr = buf.readUInt32LE(off + 12)
        bps = buf.readUInt16LE(off + 22)
      } else if (id === 'data') {
        return { sampleRate: sr, numChannels: nc, bitsPerSample: bps, dataStart: off + 8, dataSize: cs }
      }
      off += 8 + cs
      if (cs % 2 !== 0) off++
    }
    throw new Error('No data chunk')
  } finally {
    fs.closeSync(fd)
  }
}

function readWavChunk(fp: string, hdr: WavHeader, start: number, num: number): Float32Array {
  const bpf = (hdr.bitsPerSample / 8) * hdr.numChannels
  const maxB = Math.min(num * bpf, hdr.dataSize - start)
  const ns = Math.floor(maxB / bpf)
  const buf = Buffer.alloc(ns * bpf)
  const fd = fs.openSync(fp, 'r')
  try {
    fs.readSync(fd, buf, 0, buf.length, hdr.dataStart + start)
  } finally {
    fs.closeSync(fd)
  }
  const r = new Float32Array(ns)
  for (let i = 0; i < ns; i++) {
    const o = i * bpf
    if (hdr.bitsPerSample === 16) {
      let s = 0
      for (let c = 0; c < hdr.numChannels; c++) s += buf.readInt16LE(o + c * 2)
      r[i] = s / hdr.numChannels / 32768
    } else if (hdr.bitsPerSample === 32) {
      let s = 0
      for (let c = 0; c < hdr.numChannels; c++) s += buf.readInt32LE(o + c * 4)
      r[i] = s / hdr.numChannels / 2147483648
    } else {
      let s = 0
      for (let c = 0; c < hdr.numChannels; c++) s += buf.readUInt8(o + c)
      r[i] = (s / hdr.numChannels - 128) / 128
    }
  }
  return r
}

function transcribeFile(wavPath: string): { success: boolean; text?: string; error?: string } {
  const st = getModelStatus()
  if (!st.installed) return { success: false, error: 'Model not installed' }
  try {
    const hdr = readWavHeader(wavPath)
    const rec = getRecognizer(st.modelDir)
    const stream = rec.createStream()
    const spc = hdr.sampleRate * 30
    const bpf = (hdr.bitsPerSample / 8) * hdr.numChannels
    let off = 0
    const texts: string[] = []
    while (off < hdr.dataSize) {
      const ns = Math.min(spc, Math.floor((hdr.dataSize - off) / bpf))
      const samps = readWavChunk(wavPath, hdr, off, ns)
      stream.acceptWaveform({ samples: samps, sampleRate: hdr.sampleRate })
      off += ns * bpf
    }
    rec.decode(stream)
    const result = rec.getResult(stream)
    if (result && result.text) texts.push(result.text)
    return { success: true, text: texts.join('') }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export const GUI_HANDLED_CHANNELS = [
  RPC_CHANNELS.voice.GET_STATUS,
  RPC_CHANNELS.voice.DOWNLOAD,
  RPC_CHANNELS.voice.CANCEL_DOWNLOAD,
  RPC_CHANNELS.voice.DELETE,
  RPC_CHANNELS.voice.TRANSCRIBE,
  RPC_CHANNELS.voice.TRANSCRIBE_INTERIM,
  RPC_CHANNELS.voice.REQUEST_MIC_PERMISSION,
  RPC_CHANNELS.voice.OPEN_MIC_SETTINGS,
] as const

export function registerVoiceHandlers(server: RpcServer, _deps: HandlerDeps): void {
  const pushProgress = (progress: number) => {
    try {
      server.push(RPC_CHANNELS.voice.DOWNLOAD_PROGRESS, { to: 'all' }, progress)
    } catch {
      // ignore push failures (no clients connected, etc.)
    }
  }

  server.handle(RPC_CHANNELS.voice.GET_STATUS, async () => getModelStatus())

  server.handle(RPC_CHANNELS.voice.DOWNLOAD, async () => {
    const dir = getModelDir()
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    if (activeCtrl) {
      activeCtrl.abort()
      activeCtrl = null
    }
    const ctrl = new AbortController()
    activeCtrl = ctrl
    const sig = ctrl.signal
    const total = MODEL_FILES.reduce((s, f) => s + f.size, 0)
    let cum = 0
    let lt = Date.now()
    let lb = 0
    try {
      for (let i = 0; i < MODEL_FILES.length; i++) {
        const f = MODEL_FILES[i]
        const dp = path.join(dir, f.name)
        if (fs.existsSync(dp) && fs.statSync(dp).size >= f.size * 0.5) {
          cum += fs.statSync(dp).size
          pushProgress(Math.floor((cum / total) * 100))
          continue
        }
        const fStart = cum
        await downloadFile(
          f.url,
          dp,
          (_d, _) => {
            const n = Date.now()
            const el = (n - lt) / 1000
            const ct = fStart + _d
            if (el < 0.3) return
            const spd = (ct - lb) / el
            lt = n
            lb = ct
            pushProgress(Math.min(99, Math.floor((ct / total) * 100)))
          },
          sig,
        )
        cum = fStart + fs.statSync(dp).size
      }
      activeCtrl = null
      pushProgress(100)
      return { success: true, message: 'downloadComplete' }
    } catch (e) {
      activeCtrl = null
      const m = e instanceof Error ? e.message : String(e)
      if (m.includes('Cancelled')) return { success: false, message: 'downloadCancelled' }
      return { success: false, message: 'downloadFailed', error: m }
    }
  })

  server.handle(RPC_CHANNELS.voice.CANCEL_DOWNLOAD, () => {
    if (activeCtrl) {
      activeCtrl.abort()
      activeCtrl = null
    }
    return { success: true }
  })

  server.handle(RPC_CHANNELS.voice.DELETE, () => {
    const dir = getModelDir()
    if (!fs.existsSync(dir)) return { success: true }
    try {
      releaseRec()
      fs.rmSync(dir, { recursive: true, force: true })
      return { success: true }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  server.handle(RPC_CHANNELS.voice.TRANSCRIBE, async (_ctx, b64: string) => {
    const st = getModelStatus()
    if (!st.installed) return { success: false, error: 'Model not installed' }
    try {
      const buf = Buffer.from(b64, 'base64')
      const tmp = path.join(app.getPath('temp'), `voice_${Date.now()}.wav`)
      fs.writeFileSync(tmp, buf)
      const r = transcribeFile(tmp)
      try {
        fs.unlinkSync(tmp)
      } catch {}
      return r
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  server.handle(RPC_CHANNELS.voice.TRANSCRIBE_INTERIM, async (_ctx, b64: string) => {
    const st = getModelStatus()
    if (!st.installed) return { success: false, error: 'Model not installed' }
    try {
      const buf = Buffer.from(b64, 'base64')
      const tmp = path.join(app.getPath('temp'), `vad_${Date.now()}.wav`)
      fs.writeFileSync(tmp, buf)
      const r = transcribeFile(tmp)
      try {
        fs.unlinkSync(tmp)
      } catch {}
      return r
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  server.handle(RPC_CHANNELS.voice.REQUEST_MIC_PERMISSION, async () => {
    if (process.platform !== 'darwin') return { granted: true }
    try {
      const s = systemPreferences.getMediaAccessStatus('microphone')
      if (s === 'not-determined') {
        const g = await systemPreferences.askForMediaAccess('microphone')
        return { granted: g }
      }
      return { granted: s === 'granted' }
    } catch {
      return { granted: true }
    }
  })

  server.handle(RPC_CHANNELS.voice.OPEN_MIC_SETTINGS, () => {
    try {
      if (process.platform === 'darwin') {
        void shell.openExternal(
          'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
        )
      } else if (process.platform === 'win32') {
        void shell.openExternal('ms-settings:privacy-microphone')
      }
    } catch {}
    return { success: true }
  })
}
