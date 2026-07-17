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
