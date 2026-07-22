import { useMemo, useState, type ReactNode } from 'react'
import { Rss } from 'lucide-react'
import { cn } from '@/lib/utils'

/** In-memory cache for resolved favicon URLs (session-scoped). */
const faviconCache = new Map<string, string | null>()

/**
 * Favicon URL from a feed or site URL hostname.
 * Uses favicon.im (accessible in China) as primary, falls back to Google Favicon V2.
 */
export function faviconUrlFromFeedUrl(feedUrl: string | undefined, size = 32): string | undefined {
  if (!feedUrl?.trim()) return undefined
  try {
    const hostname = new URL(feedUrl).hostname
    if (!hostname) return undefined
    return `https://favicon.im/${encodeURIComponent(hostname)}`
  } catch {
    return undefined
  }
}

function resolveFaviconSrc(feedUrl: string | undefined, size: number): string | null {
  if (!feedUrl?.trim()) return null
  const cacheKey = `${feedUrl}:${size}`

  const cached = faviconCache.get(cacheKey)
  if (cached !== undefined) return cached

  const primarySrc = faviconUrlFromFeedUrl(feedUrl, size)
  if (primarySrc) {
    faviconCache.set(cacheKey, primarySrc)
    return primarySrc
  }
  return null
}

function googleFallbackSrc(feedUrl: string, size: number): string | null {
  try {
    const hostname = new URL(feedUrl).hostname
    return `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=${size}&url=https://${encodeURIComponent(hostname)}`
  } catch {
    return null
  }
}

/**
 * 16×16 feed logo — favicon.im from feed URL hostname, with Google fallback, Rss icon on error.
 */
export function FeedFavicon({
  feedUrl,
  className,
  size = 16,
}: {
  feedUrl?: string
  className?: string
  size?: number
}): ReactNode {
  const imgSize = Math.max(size * 2, 32)
  const primarySrc = useMemo(() => resolveFaviconSrc(feedUrl, imgSize), [feedUrl, imgSize])
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState(false)

  if (failed || !primarySrc) {
    return <Rss className={cn('shrink-0 text-muted-foreground', className)} style={{ width: size, height: size }} />
  }

  let src = primarySrc
  if (attempt === 1 && feedUrl) {
    const fallback = googleFallbackSrc(feedUrl, imgSize)
    if (fallback) {
      src = fallback
    } else {
      setFailed(true)
      return <Rss className={cn('shrink-0 text-muted-foreground', className)} style={{ width: size, height: size }} />
    }
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={cn('shrink-0 object-contain', className)}
      style={{ width: size, height: size }}
      onError={() => {
        if (attempt === 0) setAttempt(1)
        else setFailed(true)
      }}
    />
  )
}
