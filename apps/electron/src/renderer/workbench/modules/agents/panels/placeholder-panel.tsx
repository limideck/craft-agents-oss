import { PanelRoot, PanelBody, PanelHeaderBar } from '../../../dock/panel-primitives'

/** Generic placeholder for Changes / Terminal / future panels. */
export function PlaceholderPanel({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <PanelRoot>
      <PanelHeaderBar>
        <span className="font-medium truncate">{title}</span>
      </PanelHeaderBar>
      <PanelBody className="flex items-center justify-center text-muted-foreground text-sm">
        <div className="text-center max-w-xs space-y-1">
          <p>{description ?? `${title} panel — coming soon.`}</p>
        </div>
      </PanelBody>
    </PanelRoot>
  )
}
