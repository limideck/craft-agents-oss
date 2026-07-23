/**
 * Shared silent agent turn — used by workflow agent nodes and Module Actions.
 *
 * Creates (or uses) a mini session, sends a prompt, waits for completion, returns text.
 */

import type { CreateSessionOptions, SendMessageOptions } from '@grose-agent/shared/protocol'
import type { SessionCompletionEvent } from './SessionManager'

export type SilentAgentHost = {
  createSession(
    workspaceId: string,
    options?: CreateSessionOptions,
    internal?: { emitCreatedEvent?: boolean },
  ): Promise<{ id: string }>
  sendMessage(
    sessionId: string,
    message: string,
    attachments?: undefined,
    storedAttachments?: undefined,
    options?: SendMessageOptions,
  ): Promise<void>
  onSessionComplete(listener: (evt: SessionCompletionEvent) => void): () => void
  getSessionFinalText(sessionId: string): string | undefined
}

export type RunSilentAgentTurnOptions = {
  host: SilentAgentHost
  workspaceId: string
  prompt: string
  /** Session create options (mini + sources + hidden, etc.). */
  sessionOptions: CreateSessionOptions
  /** Send-message options (skillSlugs, activeModuleId, hidden). */
  sendOptions?: SendMessageOptions
  timeoutMs: number
  /** Optional session name prefix for createSession.name */
  sessionName?: string
}

/**
 * Subscribe to completion before sending so a fast turn cannot race past us.
 * Falls back to getSessionFinalText when the event carries no text.
 */
export function waitForAgentTurn(
  host: SilentAgentHost,
  sessionId: string,
  prompt: string,
  timeoutMs: number,
  sendOptions?: SendMessageOptions,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let settled = false
    let off: (() => void) | undefined
    let timer: ReturnType<typeof setTimeout> | undefined

    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      off?.()
      if (timer) clearTimeout(timer)
      fn()
    }

    off = host.onSessionComplete((evt) => {
      if (evt.sessionId !== sessionId) return
      if (evt.reason === 'error' || evt.reason === 'timeout') {
        finish(() =>
          reject(new Error(evt.reason === 'timeout' ? 'Agent turn timed out' : 'Agent turn failed')),
        )
        return
      }
      if (evt.reason === 'interrupted') {
        finish(() => reject(new Error('Agent turn was interrupted')))
        return
      }
      const text = evt.finalText ?? host.getSessionFinalText(sessionId) ?? ''
      finish(() => resolve(text))
    })

    timer = setTimeout(() => {
      finish(() => reject(new Error(`Agent step timed out after ${timeoutMs}ms`)))
    }, timeoutMs)

    void Promise.resolve(host.sendMessage(sessionId, prompt, undefined, undefined, sendOptions))
      .then(() => {
        // sendMessage awaits the full turn; use as a backstop if the completion
        // seam already fired (finish is idempotent) or somehow missed.
        const text = host.getSessionFinalText(sessionId) ?? ''
        finish(() => resolve(text))
      })
      .catch((err: unknown) =>
        finish(() => reject(err instanceof Error ? err : new Error(String(err)))),
      )
  })
}

/**
 * Create an ephemeral mini session, send the prompt, wait, return final assistant text.
 */
export async function runSilentAgentTurn(
  opts: RunSilentAgentTurnOptions,
): Promise<{ sessionId: string; text: string }> {
  const session = await opts.host.createSession(
    opts.workspaceId,
    {
      ...opts.sessionOptions,
      ...(opts.sessionName ? { name: opts.sessionName } : {}),
    },
    { emitCreatedEvent: false },
  )
  const text = await waitForAgentTurn(
    opts.host,
    session.id,
    opts.prompt,
    opts.timeoutMs,
    opts.sendOptions,
  )
  return { sessionId: session.id, text }
}
