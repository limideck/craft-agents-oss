import type { ReaderTextAnnotation, SelectionDraft } from './types'

export function normalizeAnnotationText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function createAnnotationId(): string {
  return `ann_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** Extract ±context around a quote within normalized surface text. */
export function quoteNeighborhood(
  surfaceText: string,
  quote: string,
  radius = 120,
): { prefix: string; suffix: string } {
  const normalized = normalizeAnnotationText(surfaceText)
  const q = normalizeAnnotationText(quote)
  const idx = normalized.indexOf(q)
  if (idx < 0) return { prefix: '', suffix: '' }
  const prefix = normalized.slice(Math.max(0, idx - radius), idx)
  const suffix = normalized.slice(idx + q.length, idx + q.length + radius)
  return { prefix, suffix }
}

export type SelectionRect = { top: number; left: number; width: number; height: number }

/**
 * Build a selection draft from the current window selection inside `root`.
 * Returns null when selection is empty / outside root / too short.
 */
export function buildSelectionDraft(
  root: HTMLElement,
  scrollContainer: HTMLElement,
): SelectionDraft | null {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  const common = range.commonAncestorContainer
  const commonEl = common.nodeType === Node.ELEMENT_NODE ? (common as Element) : common.parentElement
  if (!commonEl || !root.contains(commonEl)) return null

  // Ignore selections that are mostly/entirely links (qmreader behavior).
  if (commonEl.closest('a') && range.toString().trim().length < 40) {
    const anchor = commonEl.closest('a')
    if (anchor && selection.containsNode(anchor, true) && range.toString().trim() === (anchor.textContent || '').trim()) {
      return null
    }
  }

  const selectedText = selection.toString()
  const quote = normalizeAnnotationText(selectedText)
  if (quote.length < 2) return null

  const surfaceText = normalizeAnnotationText(root.textContent || '')
  const { prefix, suffix } = quoteNeighborhood(surfaceText, quote)

  const rect = range.getBoundingClientRect()
  const pane = scrollContainer.getBoundingClientRect()
  const popoverWidth = 360
  const top = rect.bottom - pane.top + scrollContainer.scrollTop + 8
  const left = Math.min(
    Math.max(rect.left - pane.left + rect.width / 2 - popoverWidth / 2, 8),
    Math.max(8, pane.width - popoverWidth - 8),
  )

  return { quote, selectedText, prefix, suffix, top, left }
}

export function clearAnnotationMarks(root: HTMLElement): void {
  root.querySelectorAll('.rss-text-annotation-mark').forEach((mark) => {
    const text = document.createTextNode(mark.textContent || '')
    mark.replaceWith(text)
    text.parentNode?.normalize()
  })
}

function annotationTextNodes(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent || !node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT
      if (parent.closest('.rss-text-annotation-mark,script,style,textarea,button,select')) {
        return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  return nodes
}

/** Wrap the first occurrence of annotation.quote in `<mark class="rss-text-annotation-mark">`. */
export function markAnnotationAnchor(annotation: ReaderTextAnnotation, root: HTMLElement): boolean {
  const quote = normalizeAnnotationText(annotation.quote)
  if (!quote) return false

  const nodes = annotationTextNodes(root)
  let normalized = ''
  let inSpace = false
  const map: { nodeIndex: number; offset: number }[] = []

  nodes.forEach((node, nodeIndex) => {
    const raw = node.nodeValue || ''
    for (let offset = 0; offset < raw.length; offset += 1) {
      const ch = raw[offset]!
      if (/\s/.test(ch)) {
        if (!inSpace && normalized) {
          normalized += ' '
          map.push({ nodeIndex, offset })
        }
        inSpace = true
        continue
      }
      inSpace = false
      normalized += ch
      map.push({ nodeIndex, offset })
    }
  })

  normalized = normalized.trim()
  const startIndex = normalized.indexOf(quote)
  if (startIndex < 0) return false

  const startMap = map[startIndex]
  const endMap = map[startIndex + quote.length - 1]
  if (!startMap || !endMap) return false

  const ranges: { node: Text; start: number; end: number }[] = []
  for (let nodeIndex = startMap.nodeIndex; nodeIndex <= endMap.nodeIndex; nodeIndex += 1) {
    const node = nodes[nodeIndex]
    if (!node) continue
    const start = nodeIndex === startMap.nodeIndex ? startMap.offset : 0
    const end = nodeIndex === endMap.nodeIndex ? endMap.offset + 1 : (node.nodeValue || '').length
    if (end > start && node.nodeValue!.slice(start, end).trim()) {
      ranges.push({ node, start, end })
    }
  }
  if (!ranges.length) return false

  for (const { node, start, end } of ranges.reverse()) {
    const before = document.createTextNode(node.nodeValue!.slice(0, start))
    const selected = document.createElement('mark')
    selected.className = 'rss-text-annotation-mark'
    selected.dataset.annotationId = annotation.id
    selected.textContent = node.nodeValue!.slice(start, end)
    selected.title = annotation.body
      ? normalizeAnnotationText(annotation.body).slice(0, 120)
      : '划线'
    const after = document.createTextNode(node.nodeValue!.slice(end))
    node.replaceWith(before, selected, after)
  }
  return true
}

export function applyTextAnnotations(root: HTMLElement, annotations: ReaderTextAnnotation[]): void {
  clearAnnotationMarks(root)
  for (const annotation of annotations) {
    markAnnotationAnchor(annotation, root)
  }
}

export function buildAnnotationFromDraft(
  draft: Pick<SelectionDraft, 'quote' | 'prefix' | 'suffix'>,
  body?: string,
): ReaderTextAnnotation {
  return {
    id: createAnnotationId(),
    quote: normalizeAnnotationText(draft.quote).slice(0, 800),
    prefix: draft.prefix,
    suffix: draft.suffix,
    body: body?.trim() || undefined,
    createdAt: Date.now(),
  }
}
