/**
 * Canonical trigger abstraction shared by the two automation tracks:
 *
 * - **Rules** (classic `automations.json`): a `SchedulerTick` matcher with
 *   `cron` + `timezone` fields (and webhook as an *action*, not a trigger).
 * - **Flows** (workflow canvas): `schedule` / `webhook` trigger *nodes* whose
 *   `config` carries the same `cron` / `timezone` / `path` / `method` fields.
 *
 * Both tracks describe the same two trigger kinds. This module is the single
 * source of truth for that shape so schedulers and editors stay consistent.
 */

export type TriggerKind = 'schedule' | 'webhook'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ScheduleTrigger {
  kind: 'schedule'
  /** 5-field cron (min hour dom month dow). */
  cron: string
  /** IANA timezone (e.g. "Europe/Budapest"). Defaults to UTC when omitted. */
  timezone?: string
  enabled?: boolean
}

export interface WebhookTrigger {
  kind: 'webhook'
  /** Path suffix under the `/hooks` mount, e.g. "/deploy". */
  path: string
  method?: HttpMethod
  /** Optional shared secret for request validation (out of scope for firing). */
  secret?: string
  enabled?: boolean
}

export type Trigger = ScheduleTrigger | WebhookTrigger

/**
 * Project an Automations Rules matcher into the shared `ScheduleTrigger`
 * shape. Returns `null` when the matcher has no `cron` (i.e. it is not a
 * schedule trigger — e.g. an event/app matcher). This lets Rules and Flows
 * scheduling code operate on one trigger abstraction.
 */
export function toScheduleTrigger(matcher: {
  cron?: string
  timezone?: string
  enabled?: boolean
}): ScheduleTrigger | null {
  if (!matcher.cron) return null
  return {
    kind: 'schedule',
    cron: matcher.cron,
    timezone: matcher.timezone,
    enabled: matcher.enabled,
  }
}
