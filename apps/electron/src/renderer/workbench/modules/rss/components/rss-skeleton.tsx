import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { rssMockReadyAtom } from '../store'

const MOCK_DELAY_MS = 450

/** One-shot mock "loading" delay shared by RSS panels. */
export function useRssMockReady(): void {
  const setReady = useSetAtom(rssMockReadyAtom)
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), MOCK_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [setReady])
}

export function RssSkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5 animate-pulse">
          <div className="h-3.5 rounded bg-foreground-10 w-[88%]" />
          <div className="h-2.5 rounded bg-foreground-5 w-[55%]" />
        </div>
      ))}
    </div>
  )
}
