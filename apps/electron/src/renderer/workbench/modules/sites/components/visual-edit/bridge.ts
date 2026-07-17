/** postMessage protocol between preview iframe and Sites visual-edit toolbar. */

export const VISUAL_EDIT_MESSAGE_TYPE = 'craft-sites-visual-edit' as const

export type VisualEditPayload = {
  filePath?: string
  selector?: string
  line?: number
  column?: number
  oldValue?: string
  newValue?: string
  property?: string
  editType?: 'text' | 'style'
}

export type VisualEditMessage = {
  type: typeof VISUAL_EDIT_MESSAGE_TYPE
  payload: VisualEditPayload
}

export function isVisualEditMessage(data: unknown): data is VisualEditMessage {
  if (!data || typeof data !== 'object') return false
  const msg = data as { type?: unknown; payload?: unknown }
  return msg.type === VISUAL_EDIT_MESSAGE_TYPE && typeof msg.payload === 'object' && msg.payload != null
}

/** Ask the iframe to enter/exit pick mode (no-op if preview has no listener). */
export function postVisualEditCommand(
  iframe: HTMLIFrameElement | null,
  command: 'enable' | 'disable',
): void {
  try {
    iframe?.contentWindow?.postMessage(
      { type: 'craft-sites-visual-edit-command', command },
      '*',
    )
  } catch {
    // Cross-origin or unloaded iframe — ignore
  }
}
