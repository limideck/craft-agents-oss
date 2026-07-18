/**
 * useVoiceInput
 *
 * Renderer-side voice capture for the chat composer. Records from the
 * microphone, slices speech via a lightweight VAD, and transcribes each
 * segment locally through the main-process sherpa-onnx engine
 * (window.electronAPI.transcribeVoiceInterim / transcribeVoiceAudio).
 *
 * Adapted from the test/voiceinput prototype renderer.
 */

import * as React from 'react'

const TARGET_SAMPLE_RATE = 16000
const MIN_RECORDING_MS = 300
const VAD_RMS_THRESHOLD = 0.015
const VAD_SILENCE_DURATION_MS = 600
const VAD_MIN_SPEECH_MS = 300
const SCRIPT_PROCESSOR_BUFFER = 4096

export type VoiceStatus = 'idle' | 'recording' | 'transcribing' | 'error'

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const nc = 1
  const bps = 16
  const bpsb = bps / 8
  const dataSize = samples.length * bpsb
  const buf = new ArrayBuffer(44 + dataSize)
  const v = new DataView(buf)
  writeString(v, 0, 'RIFF')
  v.setUint32(4, 36 + dataSize, true)
  writeString(v, 8, 'WAVE')
  writeString(v, 12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, nc, true)
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * nc * bpsb, true)
  v.setUint16(32, nc * bpsb, true)
  v.setUint16(34, bps, true)
  writeString(v, 36, 'data')
  v.setUint32(40, dataSize, true)
  let off = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    v.setInt16(off, s < 0 ? s * 32768 : s * 32767, true)
    off += 2
  }
  return new Blob([buf], { type: 'audio/wav' })
}

function concatFloat32Arrays(arrays: Float32Array[]): Float32Array {
  const tl = arrays.reduce((s, a) => s + a.length, 0)
  const r = new Float32Array(tl)
  let o = 0
  for (const a of arrays) {
    r.set(a, o)
    o += a.length
  }
  return r
}

function computeRms(samples: Float32Array): number {
  let s = 0
  for (let i = 0; i < samples.length; i++) s += samples[i] * samples[i]
  return Math.sqrt(s / samples.length)
}

async function blobToBase64(blob: Blob): Promise<string> {
  const ab = await blob.arrayBuffer()
  const bytes = new Uint8Array(ab)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(bin)
}

function formatSize(b: number): string {
  if (b < 1024) return `${b}B`
  if (b < 1 << 20) return `${(b / 1024).toFixed(1)}KB`
  return `${(b / (1 << 20)).toFixed(1)}MB`
}

export interface UseVoiceInputOptions {
  /** Called with finalized transcript text (appended to the composer). */
  onResult: (text: string) => void
  /** Called with live partial transcript while recording (optional). */
  onInterim?: (text: string) => void
  /** Called when the user must download the model first. */
  onModelMissing?: () => void
  /** Called with an error code when recording/transcription fails. */
  onError?: (code: string) => void
}

export interface UseVoiceInput {
  status: VoiceStatus
  rms: number
  elapsedMs: number
  error: string | null
  isSupported: boolean
  start: () => Promise<void>
  stop: () => void
  cancel: () => void
}

export function useVoiceInput(opts: UseVoiceInputOptions): UseVoiceInput {
  const { onResult, onInterim, onModelMissing, onError } = opts

  const [status, setStatus] = React.useState<VoiceStatus>('idle')
  const [rms, setRms] = React.useState(0)
  const [elapsedMs, setElapsedMs] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)

  const isSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

  // Refs to keep state across the audio callback closures.
  const audioCtxRef = React.useRef<AudioContext | null>(null)
  const srcNodeRef = React.useRef<AudioNode | null>(null)
  const procNodeRef = React.useRef<any>(null)
  const micStreamRef = React.useRef<MediaStream | null>(null)
  const pcmChunksRef = React.useRef<Float32Array[]>([])
  const recIdRef = React.useRef('')
  const statusRef = React.useRef<VoiceStatus>('idle')
  const rmsRef = React.useRef(0)
  const lastSpeechRef = React.useRef(0)
  const isSpeakingRef = React.useRef(false)
  const segStartRef = React.useRef(0)
  const accumTextRef = React.useRef<string[]>([])
  const vadActiveRef = React.useRef(false)
  const stopTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const waveformTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const pendingStopRef = React.useRef(false)
  const onResultRef = React.useRef(onResult)
  const onInterimRef = React.useRef(onInterim)
  const onModelMissingRef = React.useRef(onModelMissing)
  const onErrorRef = React.useRef(onError)

  React.useEffect(() => {
    onResultRef.current = onResult
    onInterimRef.current = onInterim
    onModelMissingRef.current = onModelMissing
    onErrorRef.current = onError
  }, [onResult, onInterim, onModelMissing, onError])

  const setStatusBoth = React.useCallback((s: VoiceStatus) => {
    statusRef.current = s
    setStatus(s)
  }, [])

  const cleanup = React.useCallback(() => {
    vadActiveRef.current = false
    if (waveformTimerRef.current) {
      clearInterval(waveformTimerRef.current)
      waveformTimerRef.current = null
    }
    setRms(0)
    rmsRef.current = 0
    if (procNodeRef.current) {
      try {
        procNodeRef.current.disconnect()
      } catch {}
      procNodeRef.current = null
    }
    if (srcNodeRef.current) {
      try {
        srcNodeRef.current.disconnect()
      } catch {}
      srcNodeRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop())
      micStreamRef.current = null
    }
    if (stopTimerRef.current) {
      clearInterval(stopTimerRef.current)
      stopTimerRef.current = null
    }
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current)
      elapsedTimerRef.current = null
    }
  }, [])

  const transcribeSegment = React.useCallback(async (chunks: Float32Array[]) => {
    if (chunks.length === 0) return
    const samps = concatFloat32Arrays(chunks)
    if ((samps.length / TARGET_SAMPLE_RATE) * 1000 < VAD_MIN_SPEECH_MS) return
    try {
      const b64 = await blobToBase64(encodeWav(samps, TARGET_SAMPLE_RATE))
      const r = await window.electronAPI.transcribeVoiceInterim(b64)
      if (r.success && r.text) {
        accumTextRef.current.push(r.text)
        onInterimRef.current?.(accumTextRef.current.join(''))
      }
    } catch {
      // swallow interim errors — final transcription will report.
    }
  }, [])

  const handleVad = React.useCallback(
    (r: number, idx: number) => {
      const now = Date.now()
      if (r > VAD_RMS_THRESHOLD) {
        lastSpeechRef.current = now
        isSpeakingRef.current = true
      } else if (isSpeakingRef.current) {
        if (now - lastSpeechRef.current >= VAD_SILENCE_DURATION_MS) {
          isSpeakingRef.current = false
          const ss = segStartRef.current
          const sc = pcmChunksRef.current.slice(ss, idx + 1)
          segStartRef.current = idx + 1
          void transcribeSegment(sc)
        }
      }
    },
    [transcribeSegment],
  )

  const start = React.useCallback(async () => {
    if (statusRef.current !== 'idle' || !isSupported) return
    pendingStopRef.current = false
    setError(null)
    setStatusBoth('recording')
    setElapsedMs(0)
    accumTextRef.current = []
    segStartRef.current = 0
    isSpeakingRef.current = false
    lastSpeechRef.current = Date.now()
    pcmChunksRef.current = []

    try {
      const st = await window.electronAPI.getVoiceModelStatus()
      if (!st.installed) {
        setStatusBoth('idle')
        setError('Model not installed')
        onModelMissingRef.current?.()
        return
      }
      const { granted } = await window.electronAPI.requestMicPermission()
      if (!granted) {
        setStatusBoth('idle')
        setError('mic-permission')
        onErrorRef.current?.('mic-permission')
        return
      }
      if (pendingStopRef.current) {
        setStatusBoth('idle')
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (pendingStopRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        setStatusBoth('idle')
        return
      }
      micStreamRef.current = stream
      const ctx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE })
      audioCtxRef.current = ctx
      const src = ctx.createMediaStreamSource(stream)
      srcNodeRef.current = src
      const proc = ctx.createScriptProcessor(SCRIPT_PROCESSOR_BUFFER, 1, 1)
      procNodeRef.current = proc
      recIdRef.current = Date.now().toString(36)
      vadActiveRef.current = true

      const actualSR = ctx.sampleRate
      const needDS = actualSR !== TARGET_SAMPLE_RATE
      const dsR = needDS ? actualSR / TARGET_SAMPLE_RATE : 1

      proc.onaudioprocess = (e: AudioProcessingEvent) => {
        const inp = e.inputBuffer.getChannelData(0)
        let pcm: Float32Array
        if (needDS) {
          const ol = Math.floor(inp.length / dsR)
          const ds = new Float32Array(ol)
          for (let i = 0; i < ol; i++) ds[i] = inp[Math.floor(i * dsR)]
          pcm = ds
        } else {
          pcm = new Float32Array(inp)
        }
        pcmChunksRef.current.push(pcm)
        const r = computeRms(pcm)
        rmsRef.current = r
        setRms(r)
        if (vadActiveRef.current) handleVad(r, pcmChunksRef.current.length - 1)
        e.outputBuffer.getChannelData(0).fill(0)
      }

      src.connect(proc)
      proc.connect(ctx.destination)

      elapsedTimerRef.current = setInterval(() => setElapsedMs((p) => p + 1000), 1000)
      waveformTimerRef.current = setInterval(() => setRms(rmsRef.current), 80)
    } catch (err) {
      cleanup()
      setStatusBoth('idle')
      const nm = err instanceof DOMException ? err.name : ''
      if (nm === 'NotAllowedError') {
        setError('mic-permission')
        onErrorRef.current?.('mic-permission')
      } else if (nm === 'NotFoundError') {
        setError('no-mic')
        onErrorRef.current?.('no-mic')
      } else {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        onErrorRef.current?.(msg)
      }
    }
  }, [isSupported, setStatusBoth, handleVad, cleanup])

  const stop = React.useCallback(() => {
    if (statusRef.current !== 'recording') return
    if (!audioCtxRef.current) return
    vadActiveRef.current = false
    cleanup()
    if (pcmChunksRef.current.length === 0) {
      setStatusBoth('idle')
      return
    }
    const all = concatFloat32Arrays(pcmChunksRef.current)
    pcmChunksRef.current = []
    if ((all.length / TARGET_SAMPLE_RATE) * 1000 < MIN_RECORDING_MS) {
      setStatusBoth('idle')
      return
    }

    if (accumTextRef.current.length > 0) {
      const txt = accumTextRef.current.join('')
      if (txt) {
        onResultRef.current(txt)
        onInterimRef.current?.('')
      }
      setStatusBoth('idle')
      return
    }

    setStatusBoth('transcribing')
    ;(async () => {
      try {
        const b64 = await blobToBase64(encodeWav(all, TARGET_SAMPLE_RATE))
        const r = await window.electronAPI.transcribeVoiceAudio(b64)
        if (r.success && r.text) onResultRef.current(r.text)
        else if (r.success && !r.text) {
          setError('no-speech')
          onErrorRef.current?.('no-speech')
        } else {
          const msg = r.error ?? 'transcribe-failed'
          setError(msg)
          onErrorRef.current?.(msg)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
        onErrorRef.current?.(msg)
      } finally {
        setStatusBoth('idle')
      }
    })()
  }, [cleanup, setStatusBoth])

  const cancel = React.useCallback(() => {
    pendingStopRef.current = true
    vadActiveRef.current = false
    cleanup()
    pcmChunksRef.current = []
    accumTextRef.current = []
    setStatusBoth('idle')
    setElapsedMs(0)
  }, [cleanup, setStatusBoth])

  React.useEffect(() => () => cleanup(), [cleanup])

  return {
    status,
    rms,
    elapsedMs,
    error,
    isSupported,
    start,
    stop,
    cancel,
  }
}

export { formatSize }
