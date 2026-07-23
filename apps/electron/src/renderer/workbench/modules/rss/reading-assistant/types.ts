/** Local underline / annotation persisted in reader meta. */
export type ReaderTextAnnotation = {
  id: string
  quote: string
  /** ± context for disambiguation when re-anchoring. */
  prefix?: string
  suffix?: string
  /** Optional reader note / 点评. */
  body?: string
  createdAt: number
}

export type SelectionDraft = {
  quote: string
  selectedText: string
  prefix: string
  suffix: string
  /** Position relative to the scroll container. */
  top: number
  left: number
}

/** Active selection shown as a dismissible card (图一). */
export type ActiveSelectionContext = {
  quote: string
  /** e.g. 翻译 · 读者 · timestamp label */
  metaLabel: string
  note?: string
}
