import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import * as storage from '@/lib/local-storage'
import { cn } from '@/lib/utils'

/** Matches former Tailwind `w-56` (~14rem at 16px root). */
const DEFAULT_WIDTH = 224
const MIN_WIDTH = 180
const MAX_WIDTH = 360

function clampWidth(value: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(value)))
}

function readStoredWidth(): number {
  const raw = storage.get<number>(storage.KEYS.sidebarWidth, DEFAULT_WIDTH)
  return clampWidth(typeof raw === 'number' && Number.isFinite(raw) ? raw : DEFAULT_WIDTH)
}

type ActivitySidebarProps = {
  children: ReactNode
  className?: string
}

/**
 * Module activity rail (Sessions / Feeds / Sources, etc.) — resizable, width persisted.
 * ActivityBar icon rail stays outside; this sits between the icon rail and the dock.
 */
export function ActivitySidebar({ children, className }: ActivitySidebarProps) {
  const [width, setWidth] = useState(readStoredWidth)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const widthRef = useRef(width)
  widthRef.current = width

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      setWidth(clampWidth(drag.startWidth + (event.clientX - drag.startX)))
    }

    const onUp = () => {
      if (!dragRef.current) return
      dragRef.current = null
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
      storage.set(storage.KEYS.sidebarWidth, widthRef.current)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  const onResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    dragRef.current = { startX: event.clientX, startWidth: widthRef.current }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <aside
      className={cn(
        'relative shrink-0 border-r border-border bg-background overflow-hidden min-h-0',
        className,
      )}
      style={{ width }}
    >
      <div className="h-full min-h-0 overflow-hidden">{children}</div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize activity sidebar"
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        aria-valuenow={width}
        tabIndex={0}
        className={cn(
          'absolute inset-y-0 right-0 z-10 w-1.5 translate-x-1/2',
          'cursor-col-resize touch-none',
          'hover:bg-foreground/10 active:bg-foreground/15',
        )}
        onPointerDown={onResizePointerDown}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 16 : 8
          if (event.key === 'ArrowLeft') {
            event.preventDefault()
            const next = clampWidth(widthRef.current - step)
            setWidth(next)
            storage.set(storage.KEYS.sidebarWidth, next)
          } else if (event.key === 'ArrowRight') {
            event.preventDefault()
            const next = clampWidth(widthRef.current + step)
            setWidth(next)
            storage.set(storage.KEYS.sidebarWidth, next)
          }
        }}
      />
    </aside>
  )
}
