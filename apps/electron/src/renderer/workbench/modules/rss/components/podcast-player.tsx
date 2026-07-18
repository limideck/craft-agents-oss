import { useEffect, useRef, useState } from 'react'
import { Pause, Play, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Episode = {
  id: string
  title: string
  feedName?: string
  audioUrl: string
}

type Props = {
  episode: Episode
  onClose: () => void
}

function fmt(s: number) {
  if (!s || Number.isNaN(s) || !Number.isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

/**
 * Bottom podcast bar — play/pause, seek, skip, speed. Grose styling.
 */
export function PodcastPlayer({ episode, onClose }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setSpeed(1)
    audio.playbackRate = 1
    audio.load()
    void audio.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    )
  }, [episode.id, episode.audioUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setCurrentTime(audio.currentTime)
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    const onEnded = () => setPlaying(false)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('durationchange', onMeta)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('durationchange', onMeta)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      void audio.play().then(() => setPlaying(true))
    } else {
      audio.pause()
      setPlaying(false)
    }
  }

  const skip = (sec: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + sec, audio.duration || 0))
  }

  const cycleSpeed = () => {
    const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1
    setSpeed(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-t border-border bg-card/95 px-3">
      <audio ref={audioRef} src={episode.audioUrl} preload="metadata" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={toggle}
        title={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div className="min-w-0 w-36 shrink-0">
        <div className="truncate text-xs font-medium leading-snug">{episode.title}</div>
        {episode.feedName ? (
          <div className="truncate text-[10px] text-muted-foreground leading-snug">
            {episode.feedName}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
        onClick={() => skip(-15)}
        title="-15s"
      >
        -15
      </button>
      <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
        {fmt(currentTime)}
      </span>
      <input
        type="range"
        min={0}
        max={duration || 100}
        value={currentTime}
        step={1}
        aria-label="Seek"
        className={cn(
          'h-1 flex-1 cursor-pointer appearance-none rounded-full bg-muted',
          '[&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none',
          '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground',
        )}
        onChange={(e) => {
          const t = parseFloat(e.target.value)
          if (audioRef.current) audioRef.current.currentTime = t
          setCurrentTime(t)
        }}
      />
      <span className="w-8 shrink-0 text-[11px] tabular-nums text-muted-foreground">
        {fmt(duration)}
      </span>
      <button
        type="button"
        className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
        onClick={() => skip(15)}
        title="+15s"
      >
        +15
      </button>
      <button
        type="button"
        className="min-w-[2rem] shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold text-foreground/80 hover:bg-muted"
        onClick={cycleSpeed}
        title="Playback speed"
      >
        {speed}×
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={onClose}
        title="Close player"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
