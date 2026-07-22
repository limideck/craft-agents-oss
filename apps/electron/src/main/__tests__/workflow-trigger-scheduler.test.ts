import { describe, it, expect, vi } from 'bun:test'
import { createWorkflowTriggerScheduler, type ArmedTrigger } from '../workflow-trigger-scheduler'
import type { GroseModulesWorkflow } from '@grose-agent/shared/grose-modules'

function makeRpcServer(workflows: GroseModulesWorkflow[]) {
  const fired: Array<{ channel: string; args: unknown[] }> = []
  const server = {
    handle() {},
    async invoke(channel: string, ...args: unknown[]) {
      fired.push({ channel, args })
      if (channel === 'workflows:list') return workflows
      return undefined
    },
    push() {},
    invokeClient() {
      return Promise.resolve(undefined)
    },
    hasClientCapability() {
      return false
    },
    findClientsWithCapability() {
      return []
    },
  }
  return { server, fired }
}

const deployedWorkflow = (id: string, nodes: GroseModulesWorkflow['nodes']): GroseModulesWorkflow =>
  ({
    id,
    name: `wf-${id}`,
    status: 'deployed',
    version: '1',
    nodes,
    edges: [],
    updatedAt: '2024-01-01T00:00:00Z',
  }) as unknown as GroseModulesWorkflow

describe('workflow trigger scheduler', () => {
  it('collects only deployed schedule/webhook triggers', async () => {
    const { server } = makeRpcServer([
      deployedWorkflow('a', [
        { id: 'n1', type: 'schedule', name: 's', position: { x: 0, y: 0 }, config: { cron: '*/5 * * * *' } },
        { id: 'n2', type: 'webhook', name: 'w', position: { x: 0, y: 0 }, config: { path: '/hooks/a', method: 'POST' } },
      ]),
      // draft workflow -> ignored
      { ...deployedWorkflow('b', [{ id: 'n3', type: 'schedule', name: 's', position: { x: 0, y: 0 }, config: { cron: '* * * * *' } }]), status: 'draft' },
    ])

    const scheduler = createWorkflowTriggerScheduler({
      getRpcServer: () => server as any,
      getWorkspaces: () => [{ id: 'ws1' } as any],
      silent: true,
    })
    // Force a refresh by starting then immediately reading armed triggers.
    scheduler.start()
    // give the async refresh a tick
    await new Promise((r) => setTimeout(r, 10))
    const armed = scheduler.getArmedTriggers()
    scheduler.stop()

    expect(armed).toHaveLength(2)
    const types = armed.map((t) => t.type).sort()
    expect(types).toEqual(['schedule', 'webhook'])
    const schedule = armed.find((t) => t.type === 'schedule')!
    expect(schedule.cron).toBe('*/5 * * * *')
    expect(schedule.workspaceId).toBe('ws1')
  })

  it('fires a schedule trigger when the cron matches the clock', async () => {
    const { server, fired } = makeRpcServer([
      deployedWorkflow('a', [
        { id: 'n1', type: 'schedule', name: 's', position: { x: 0, y: 0 }, config: { cron: '* * * * *' } },
      ]),
    ])

    const scheduler = createWorkflowTriggerScheduler({
      getRpcServer: () => server as any,
      getWorkspaces: () => [{ id: 'ws1' } as any],
      silent: true,
      now: () => new Date(Date.UTC(2024, 0, 1, 12, 30, 0)),
      pollIntervalMs: 1000,
    })
    scheduler.start()
    await new Promise((r) => setTimeout(r, 20))
    scheduler.stop()

    expect(fired.some((f) => f.channel === 'workflows:run' && f.args[0] === 'ws1' && f.args[1] === 'a')).toBe(true)
  })

  it('honors the schedule node timezone (croner, consistent with Rules)', async () => {
    // 9:00 AM America/New_York == 14:00 UTC on 2024-01-01.
    const nyNineAmUtc = Date.UTC(2024, 0, 1, 14, 0, 0)
    const { server: serverHit, fired: firedHit } = makeRpcServer([
      deployedWorkflow('a', [
        { id: 'n1', type: 'schedule', name: 's', position: { x: 0, y: 0 }, config: { cron: '0 9 * * *', timezone: 'America/New_York' } },
      ]),
    ])
    const schedulerHit = createWorkflowTriggerScheduler({
      getRpcServer: () => serverHit as any,
      getWorkspaces: () => [{ id: 'ws1' } as any],
      silent: true,
      now: () => new Date(nyNineAmUtc),
      pollIntervalMs: 1000,
    })
    schedulerHit.start()
    await new Promise((r) => setTimeout(r, 20))
    schedulerHit.stop()
    expect(firedHit.some((f) => f.channel === 'workflows:run')).toBe(true)

    // Same UTC instant but cron evaluated in UTC would be 14:00 -> no match.
    const { server: serverMiss, fired: firedMiss } = makeRpcServer([
      deployedWorkflow('a', [
        { id: 'n1', type: 'schedule', name: 's', position: { x: 0, y: 0 }, config: { cron: '0 9 * * *', timezone: 'UTC' } },
      ]),
    ])
    const schedulerMiss = createWorkflowTriggerScheduler({
      getRpcServer: () => serverMiss as any,
      getWorkspaces: () => [{ id: 'ws1' } as any],
      silent: true,
      now: () => new Date(nyNineAmUtc),
      pollIntervalMs: 1000,
    })
    schedulerMiss.start()
    await new Promise((r) => setTimeout(r, 20))
    schedulerMiss.stop()
    expect(firedMiss.some((f) => f.channel === 'workflows:run')).toBe(false)
  })

  it('does not double-fire the same schedule minute', async () => {
    const { server, fired } = makeRpcServer([
      deployedWorkflow('a', [
        { id: 'n1', type: 'schedule', name: 's', position: { x: 0, y: 0 }, config: { cron: '* * * * *' } },
      ]),
    ])
    const clock = { t: Date.UTC(2024, 0, 1, 12, 30, 0) }

    const scheduler = createWorkflowTriggerScheduler({
      getRpcServer: () => server as any,
      getWorkspaces: () => [{ id: 'ws1' } as any],
      silent: true,
      now: () => new Date(clock.t),
      pollIntervalMs: 5,
    })
    scheduler.start()
    await new Promise((r) => setTimeout(r, 60))
    scheduler.stop()

    const runs = fired.filter((f) => f.channel === 'workflows:run')
    expect(runs.length).toBe(1)
  })

  it('matches a webhook by path and method and fires the run', async () => {
    const { server, fired } = makeRpcServer([
      deployedWorkflow('a', [
        { id: 'n1', type: 'webhook', name: 'w', position: { x: 0, y: 0 }, config: { path: '/deploy', method: 'POST' } },
      ]),
    ])
    const scheduler = createWorkflowTriggerScheduler({
      getRpcServer: () => server as any,
      getWorkspaces: () => [{ id: 'ws1' } as any],
      silent: true,
    })
    scheduler.start()
    await new Promise((r) => setTimeout(r, 10))

    const hit = scheduler.handleWebhook({ url: '/hooks/deploy', method: 'POST' })
    expect(hit.handled).toBe(true)
    expect(hit.statusCode).toBe(202)
    expect(fired.some((f) => f.channel === 'workflows:run' && f.args[1] === 'a')).toBe(true)

    const miss = scheduler.handleWebhook({ url: '/hooks/unknown', method: 'POST' })
    expect(miss.handled).toBe(true)
    expect(miss.statusCode).toBe(404)

    const wrongMethod = scheduler.handleWebhook({ url: '/hooks/deploy', method: 'GET' })
    expect(wrongMethod.statusCode).toBe(404)

    const nonHook = scheduler.handleWebhook({ url: '/health', method: 'GET' })
    expect(nonHook.handled).toBe(false)
    scheduler.stop()
  })
})
