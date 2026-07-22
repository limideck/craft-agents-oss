/**
 * Workflow trigger scheduler - fires deployed workflows on their
 * schedule (cron) and webhook triggers.
 *
 * The Go sidecar "arms" triggers on deploy (records them in the live graph)
 * but does not run a scheduler. This module owns that in the Electron main
 * process, which already talks to both the Go sidecar (via the RPC server)
 * and server-core (the workflows:run handler executes agent nodes).
 *
 * Cron matching is delegated to `croner` (via the shared `matchesCron` helper)
 * so schedule triggers here and Automations Rules stay consistent: same
 * library, same timezone-aware 5-field semantics.
 */

import { RPC_CHANNELS } from '@grose-agent/shared/protocol'
import type { GroseModulesWorkflow } from '@grose-agent/shared/grose-modules'
import type { Workspace } from '@grose-agent/core/types'
import type { RpcServer } from '@grose-agent/server-core/transport'
import { Cron } from 'croner'

export interface WorkflowTriggerScheduler {
  start(): void
  stop(): void
  /** Handle an inbound webhook HTTP request. */
  handleWebhook(req: {
    url?: string | null
    method?: string
  }): { handled: boolean; statusCode: number; body?: string }
  /** Snapshot of currently armed triggers (for debugging / tests). */
  getArmedTriggers(): ArmedTrigger[]
}

/**
 * An armed trigger derived from a deployed workflow's trigger node. Mirrors the
 * shared `ScheduleTrigger` / `WebhookTrigger` shapes plus the workflow locator.
 */
export interface ArmedTrigger {
  workspaceId: string
  workflowId: string
  workflowName: string
  nodeId: string
  type: 'schedule' | 'webhook'
  /** Present for schedule triggers (see `ScheduleTrigger.cron`). */
  cron?: string
  /** IANA timezone for schedule triggers (see `ScheduleTrigger.timezone`). */
  timezone?: string
  /** Present for webhook triggers; suffix under the `/hooks` mount. */
  path?: string
  /** Present for webhook triggers (see `WebhookTrigger.method`). */
  method?: string
}

export interface CreateSchedulerOptions {
  /** Lazily resolved so the scheduler can be created before the RPC server exists. */
  getRpcServer: () => RpcServer | null
  getWorkspaces: () => Workspace[]
  /** Cron poll interval (ms). Default 30s. */
  pollIntervalMs?: number
  /** Suppress logging (tests). */
  silent?: boolean
  /** Overridable clock for tests. */
  now?: () => Date
}

const DEFAULT_POLL_MS = 30_000

function log(silent: boolean, msg: string): void {
  if (!silent) console.log(`[workflow-triggers] ${msg}`)
}
function warn(silent: boolean, msg: string): void {
  if (!silent) console.warn(`[workflow-triggers] ${msg}`)
}

/** Derive armed triggers from currently-deployed workflows. */
async function collectArmedTriggers(
  opts: CreateSchedulerOptions,
): Promise<ArmedTrigger[]> {
  const rpcServer = opts.getRpcServer()
  if (!rpcServer) return []
  const out: ArmedTrigger[] = []
  for (const ws of opts.getWorkspaces()) {
    let workflows: GroseModulesWorkflow[] = []
    try {
      workflows = (await rpcServer.invoke(
        RPC_CHANNELS.workflows.LIST,
        ws.id,
      )) as GroseModulesWorkflow[]
    } catch (err) {
      warn(opts.silent ?? false, `list failed for workspace ${ws.id}: ${String(err)}`)
      continue
    }
    for (const wf of workflows) {
      if (wf.status !== 'deployed') continue
      for (const node of wf.nodes) {
        if (node.type === 'schedule') {
          const cron = String(node.config?.cron ?? '').trim()
          if (!cron) continue
          const timezone = String(node.config?.timezone ?? '').trim() || undefined
          out.push({
            workspaceId: ws.id,
            workflowId: wf.id,
            workflowName: wf.name,
            nodeId: node.id,
            type: 'schedule',
            cron,
            timezone,
          })
        } else if (node.type === 'webhook') {
          let path = String(node.config?.path ?? '').trim()
          if (!path) continue
          // Triggers are addressed under the /hooks mount; normalize the
          // stored path to its suffix so it matches the inbound URL suffix.
          path = path.replace(/^\/hooks/, '') || '/'
          out.push({
            workspaceId: ws.id,
            workflowId: wf.id,
            workflowName: wf.name,
            nodeId: node.id,
            type: 'webhook',
            path,
            method: String(node.config?.method ?? 'POST').toUpperCase(),
          })
        }
      }
    }
  }
  return out
}

async function fireRun(
  opts: CreateSchedulerOptions,
  trigger: ArmedTrigger,
): Promise<void> {
  try {
    await opts.getRpcServer()?.invoke(RPC_CHANNELS.workflows.RUN, trigger.workspaceId, trigger.workflowId)
    log(opts.silent ?? false, `fired ${trigger.type} trigger -> ${trigger.workflowName} (${trigger.workflowId})`)
  } catch (err) {
    warn(opts.silent ?? false, `run failed for ${trigger.workflowId}: ${String(err)}`)
  }
}

export function createWorkflowTriggerScheduler(
  opts: CreateSchedulerOptions,
): WorkflowTriggerScheduler {
  const pollMs = opts.pollIntervalMs ?? DEFAULT_POLL_MS
  const now = opts.now ?? (() => new Date())
  let timer: ReturnType<typeof setInterval> | null = null
  let armed: ArmedTrigger[] = []
  // Track last-fire minute per schedule trigger to avoid double-fires.
  const lastFiredKey = new Map<string, string>()

  const keyOf = (t: ArmedTrigger) => `${t.workspaceId}:${t.workflowId}:${t.nodeId}`

  const refresh = async () => {
    armed = await collectArmedTriggers(opts)
  }

  const evaluateSchedules = () => {
    const t = now()
    const minuteKey = `${t.getUTCFullYear()}-${t.getUTCMonth()}-${t.getUTCDate()}-${t.getUTCHours()}-${t.getUTCMinutes()}`
    for (const trigger of armed) {
      if (trigger.type !== 'schedule' || !trigger.cron) continue
      if (!cronMatches(trigger.cron, t, trigger.timezone)) continue
      const k = keyOf(trigger)
      if (lastFiredKey.get(k) === minuteKey) continue
      lastFiredKey.set(k, minuteKey)
      void fireRun(opts, trigger)
    }
  }

  return {
    start() {
      if (timer) return
      void refresh().then(() => {
        evaluateSchedules()
        timer = setInterval(() => {
          void refresh().then(evaluateSchedules)
        }, pollMs)
      })
      log(opts.silent ?? false, 'scheduler started')
    },
    stop() {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
      lastFiredKey.clear()
      log(opts.silent ?? false, 'scheduler stopped')
    },
    handleWebhook(req) {
      const url = req.url ?? ''
      const method = (req.method ?? 'POST').toUpperCase()
      const match = url.match(/\/hooks(\/.*)?$/)
      if (!match) return { handled: false, statusCode: 404 }
      const incomingPath = (match[1] ?? '').replace(/\/$/, '') || '/'
      const trigger = armed.find(
        (t) =>
          t.type === 'webhook' &&
          (t.path ?? '/') === incomingPath &&
          (t.method ?? 'POST') === method,
      )
      if (!trigger) {
        return { handled: true, statusCode: 404, body: 'no matching webhook trigger' }
      }
      void fireRun(opts, trigger)
      return { handled: true, statusCode: 202, body: 'accepted' }
    },
    getArmedTriggers() {
      return armed
    },
  }
}

// --- Cron matching (shared with Automations Rules via croner) ---------------

/**
 * Timezone-aware 5-field cron match for a given instant. Delegates to `croner`
 * so schedule triggers here and Automations Rules (`matchesCron`) share one
 * matcher implementation and identical timezone semantics.
 *
 * @param expr     5-field cron expression.
 * @param date     Instant to test (an injected clock in tests).
 * @param timezone Optional IANA timezone; omitted means UTC.
 */
function cronMatches(expr: string, date: Date, timezone?: string): boolean {
  try {
    const job = new Cron(expr, timezone ? { timezone } : {})
    return job.match(date)
  } catch {
    return false
  }
}
