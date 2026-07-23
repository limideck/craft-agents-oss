/**
 * Module Action runner — silent task execution for Reader chips / workbench UI.
 *
 * Reuses the workflow mini-session pattern (systemPromptPreset: 'mini' + waitForAgentTurn).
 */

import {
  GROSE_MODULES_SOURCE_SLUG,
  buildModuleActionInstruction,
  getModuleAction,
  instructionLooksLikeFullBodyPaste,
  type ModuleActionId,
  type ModuleActionParams,
} from '@grose-agent/shared/grose-modules'
import type { PermissionMode } from '@grose-agent/shared/agent/mode-types'
import {
  runSilentAgentTurn,
  type SilentAgentHost,
} from '../sessions/silent-agent-turn'

const AUTONOMOUS_MODE: PermissionMode = 'allow-all'
/** Cap a single action turn so a hung model cannot block the Reader forever. */
export const MODULE_ACTION_TIMEOUT_MS = 5 * 60_000

export type ModuleActionRunHost = SilentAgentHost

export type RunModuleActionInput = {
  workspaceId: string
  actionId: ModuleActionId | string
  params: ModuleActionParams
  /** Optional model override (omit / 'default' → workspace default). */
  model?: string
  timeoutMs?: number
  host: ModuleActionRunHost
}

export type RunModuleActionResult = {
  ok: true
  actionId: string
  moduleId: string
  resultMarkdown: string
  sessionId: string
  durationMs: number
}

export type RunModuleActionError = {
  ok: false
  actionId: string
  error: string
  sessionId?: string
  durationMs: number
}

export async function runModuleAction(
  input: RunModuleActionInput,
): Promise<RunModuleActionResult | RunModuleActionError> {
  const started = Date.now()
  const action = getModuleAction(input.actionId)
  if (!action) {
    return {
      ok: false,
      actionId: input.actionId,
      error: `Unknown module action: ${input.actionId}`,
      durationMs: Date.now() - started,
    }
  }

  const scope = action.scope
  const hasSelection = Boolean(input.params.selection?.trim())
  const hasArticleId = Boolean(input.params.articleId?.trim())

  if (scope === 'article' && !hasArticleId) {
    return {
      ok: false,
      actionId: action.id,
      error: `Action ${action.id} requires params.articleId`,
      durationMs: Date.now() - started,
    }
  }
  if (scope === 'selection' && !hasSelection) {
    return {
      ok: false,
      actionId: action.id,
      error: `Action ${action.id} requires params.selection`,
      durationMs: Date.now() - started,
    }
  }
  if (scope === 'article_or_selection' && !hasArticleId && !hasSelection) {
    return {
      ok: false,
      actionId: action.id,
      error: `Action ${action.id} requires params.articleId or params.selection`,
      durationMs: Date.now() - started,
    }
  }

  const instruction = buildModuleActionInstruction(action, input.params)
  if (instructionLooksLikeFullBodyPaste(instruction)) {
    return {
      ok: false,
      actionId: action.id,
      error: 'Refusing to run action whose instruction embeds a full article body paste',
      durationMs: Date.now() - started,
    }
  }

  const modelRaw = input.model?.trim()
  const model = modelRaw && modelRaw !== 'default' ? modelRaw : undefined
  const timeoutMs = input.timeoutMs ?? MODULE_ACTION_TIMEOUT_MS
  const skillSlugs = action.skillSlug ? [action.skillSlug] : undefined

  let sessionId: string | undefined
  try {
    const { sessionId: sid, text } = await runSilentAgentTurn({
      host: input.host,
      workspaceId: input.workspaceId,
      prompt: instruction,
      timeoutMs,
      sessionName: `Action · ${action.title}`,
      sessionOptions: {
        permissionMode: AUTONOMOUS_MODE,
        systemPromptPreset: 'mini',
        hidden: true,
        enabledSourceSlugs: [GROSE_MODULES_SOURCE_SLUG],
        ...(model ? { model } : {}),
      },
      sendOptions: {
        hidden: true,
        activeModuleId: String(action.moduleId),
        ...(skillSlugs ? { skillSlugs } : {}),
      },
    })
    sessionId = sid
    const resultMarkdown = text.trim()
    if (!resultMarkdown) {
      return {
        ok: false,
        actionId: action.id,
        error: 'Action completed without producing a reply',
        sessionId,
        durationMs: Date.now() - started,
      }
    }
    return {
      ok: true,
      actionId: action.id,
      moduleId: String(action.moduleId),
      resultMarkdown,
      sessionId,
      durationMs: Date.now() - started,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      actionId: action.id,
      error: message,
      ...(sessionId ? { sessionId } : {}),
      durationMs: Date.now() - started,
    }
  }
}
