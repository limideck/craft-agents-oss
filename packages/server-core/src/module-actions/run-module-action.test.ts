import { describe, expect, it } from 'bun:test'
import type { SessionCompletionEvent } from '../sessions/SessionManager'
import { GROSE_MODULES_SOURCE_SLUG } from '@grose-agent/shared/grose-modules'
import { runModuleAction, type ModuleActionRunHost } from './run-module-action'

function makeHost(opts?: {
  finalText?: string
  failSend?: boolean
}): ModuleActionRunHost & {
  created: { workspaceId: string; options: Record<string, unknown> }[]
  sent: { sessionId: string; message: string; options?: Record<string, unknown> }[]
} {
  const listeners = new Set<(evt: SessionCompletionEvent) => void>()
  const created: { workspaceId: string; options: Record<string, unknown> }[] = []
  const sent: { sessionId: string; message: string; options?: Record<string, unknown> }[] = []
  let seq = 0

  return {
    created,
    sent,
    async createSession(workspaceId, options) {
      seq += 1
      const id = `sess-${seq}`
      created.push({ workspaceId, options: { ...(options ?? {}) } })
      return { id }
    },
    async sendMessage(sessionId, message, _a, _b, options) {
      sent.push({ sessionId, message, options: { ...(options ?? {}) } })
      if (opts?.failSend) throw new Error('send failed')
      queueMicrotask(() => {
        for (const l of listeners) {
          l({
            sessionId,
            workspaceId: 'ws-1',
            reason: 'complete',
            finalText: opts?.finalText ?? '## 要点\n- one',
          })
        }
      })
    },
    onSessionComplete(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSessionFinalText(sessionId) {
      void sessionId
      return opts?.finalText ?? '## 要点\n- one'
    },
  }
}

describe('runModuleAction', () => {
  it('creates mini session with grose-modules + activeModuleId and returns markdown', async () => {
    const host = makeHost({ finalText: '## 总结\n- A\n- B' })
    const result = await runModuleAction({
      workspaceId: 'ws-1',
      actionId: 'rss.summarize_bullets',
      params: { articleId: 'art-1', url: 'https://example.com/a', title: 'T' },
      host,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.resultMarkdown).toContain('总结')
    expect(result.moduleId).toBe('rss')
    expect(host.created[0]!.options.systemPromptPreset).toBe('mini')
    expect(host.created[0]!.options.hidden).toBe(true)
    expect(host.created[0]!.options.enabledSourceSlugs).toEqual([GROSE_MODULES_SOURCE_SLUG])
    expect(host.sent[0]!.options?.activeModuleId).toBe('rss')
    expect(host.sent[0]!.options?.hidden).toBe(true)
    expect(host.sent[0]!.message).toContain('article_id: art-1')
    expect(host.sent[0]!.message).toContain('rss_get_article')
    expect(host.sent[0]!.message).not.toContain('文章正文：')
  })

  it('rejects unknown action ids', async () => {
    const host = makeHost()
    const result = await runModuleAction({
      workspaceId: 'ws-1',
      actionId: 'rss.nope',
      params: { articleId: 'x' },
      host,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/Unknown module action/)
    expect(host.created).toHaveLength(0)
  })

  it('requires articleId for article-scoped actions', async () => {
    const host = makeHost()
    const result = await runModuleAction({
      workspaceId: 'ws-1',
      actionId: 'rss.structure',
      params: {},
      host,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/articleId/)
  })

  it('runs selection translate without article id', async () => {
    const host = makeHost({ finalText: '译文' })
    const result = await runModuleAction({
      workspaceId: 'ws-1',
      actionId: 'rss.translate',
      params: { selection: 'Hello world' },
      host,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.resultMarkdown).toBe('译文')
    expect(host.sent[0]!.message).toContain('Hello world')
    expect(host.sent[0]!.message).not.toContain('rss_get_article')
  })
})
