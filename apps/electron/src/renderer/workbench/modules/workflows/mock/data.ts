/**
 * Sample workflow graphs for local UI demos / Storybook only.
 * Production UI loads from craft-modules via `workflows:*` RPC — do not seed the store from here.
 */
import type { WorkflowLogLine, WorkflowSummary } from './types'

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()
const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000).toISOString()

/** @deprecated Prefer empty list + RPC. Kept for offline demos only. */
export const INITIAL_MOCK_WORKFLOWS: WorkflowSummary[] = [
  {
    id: 'wf-onboarding',
    name: 'Onboarding digest',
    description: 'Daily summary → agent → Slack (sample)',
    updatedAt: hoursAgo(3),
    nodes: [
      {
        id: 'n-start',
        type: 'start',
        name: 'Start',
        position: { x: 48, y: 80 },
        config: {},
      },
      {
        id: 'n-schedule',
        type: 'schedule',
        name: 'Daily 9am',
        position: { x: 220, y: 80 },
        config: { cron: '0 9 * * *', timezone: 'Asia/Shanghai' },
      },
      {
        id: 'n-agent',
        type: 'agent',
        name: 'Summarize inbox',
        position: { x: 400, y: 80 },
        config: { agent: 'inbox-helper', model: 'default' },
      },
      {
        id: 'n-http',
        type: 'http',
        name: 'Post to Slack',
        position: { x: 580, y: 80 },
        config: {
          method: 'POST',
          url: 'https://hooks.slack.com/…',
          timeoutMs: 30000,
        },
      },
      {
        id: 'n-response',
        type: 'response',
        name: 'Done',
        position: { x: 760, y: 80 },
        config: { status: 200, body: { ok: true } },
      },
    ],
    edges: [
      { id: 'e-start-schedule', source: 'n-start', target: 'n-schedule' },
      { id: 'e-schedule-agent', source: 'n-schedule', target: 'n-agent' },
      { id: 'e-agent-http', source: 'n-agent', target: 'n-http' },
      { id: 'e-http-response', source: 'n-http', target: 'n-response' },
    ],
  },
  {
    id: 'wf-webhook-triage',
    name: 'Webhook triage',
    description: 'Inbound webhook → condition → agent',
    updatedAt: daysAgo(1),
    nodes: [
      {
        id: 'n-wh',
        type: 'webhook',
        name: 'Inbound webhook',
        position: { x: 64, y: 100 },
        config: { path: '/hooks/triage', method: 'POST' },
      },
      {
        id: 'n-cond',
        type: 'condition',
        name: 'Priority?',
        position: { x: 280, y: 100 },
        config: { expression: 'payload.priority === "high"' },
      },
      {
        id: 'n-agent-hi',
        type: 'agent',
        name: 'Escalate',
        position: { x: 500, y: 40 },
        config: { agent: 'pager', model: 'default' },
      },
      {
        id: 'n-agent-lo',
        type: 'agent',
        name: 'Queue note',
        position: { x: 500, y: 160 },
        config: { agent: 'scribe', model: 'fast' },
      },
    ],
    edges: [
      { id: 'e-wh-cond', source: 'n-wh', target: 'n-cond' },
      {
        id: 'e-cond-hi',
        source: 'n-cond',
        target: 'n-agent-hi',
        sourceHandle: 'true',
      },
      {
        id: 'e-cond-lo',
        source: 'n-cond',
        target: 'n-agent-lo',
        sourceHandle: 'false',
      },
    ],
  },
  {
    id: 'wf-intake-router',
    name: 'Intake router',
    description: 'Classify → switch → approve → respond (Phase 2.5 sample)',
    updatedAt: hoursAgo(1),
    nodes: [
      {
        id: 'n-start',
        type: 'start',
        name: 'Start',
        position: { x: 40, y: 120 },
        config: {},
      },
      {
        id: 'n-classify',
        type: 'question-classifier',
        name: 'Classify ticket',
        position: { x: 220, y: 120 },
        config: {
          source: 'payload.text',
          categories: [
            { id: 'billing', label: 'Billing' },
            { id: 'support', label: 'Support' },
            { id: 'other', label: 'Other' },
          ],
        },
      },
      {
        id: 'n-extract',
        type: 'parameter-extractor',
        name: 'Extract fields',
        position: { x: 420, y: 40 },
        config: {
          source: 'payload.text',
          schema: [{ key: 'amount', type: 'number' }],
        },
      },
      {
        id: 'n-approve',
        type: 'human-approval',
        name: 'Manager approve',
        position: { x: 620, y: 40 },
        config: { title: 'Refund over $100?', onTimeout: 'rejected' },
      },
      {
        id: 'n-template',
        type: 'template',
        name: 'Ack message',
        position: { x: 420, y: 200 },
        config: {
          template: 'Thanks — we queued your {{payload.topic}} request.',
          outputMode: 'text',
        },
      },
      {
        id: 'n-response',
        type: 'response',
        name: 'Done',
        position: { x: 820, y: 120 },
        config: { status: 200, body: { ok: true } },
      },
    ],
    edges: [
      { id: 'e-start-clf', source: 'n-start', target: 'n-classify' },
      {
        id: 'e-clf-billing',
        source: 'n-classify',
        target: 'n-extract',
        sourceHandle: 'billing',
      },
      {
        id: 'e-clf-support',
        source: 'n-classify',
        target: 'n-template',
        sourceHandle: 'support',
      },
      {
        id: 'e-clf-other',
        source: 'n-classify',
        target: 'n-template',
        sourceHandle: 'other',
      },
      { id: 'e-extract-approve', source: 'n-extract', target: 'n-approve' },
      {
        id: 'e-approve-ok',
        source: 'n-approve',
        target: 'n-response',
        sourceHandle: 'approved',
      },
      { id: 'e-template-resp', source: 'n-template', target: 'n-response' },
    ],
  },
  {
    id: 'wf-empty',
    name: 'Blank canvas',
    description: 'Empty workflow for create/edit demos',
    updatedAt: hoursAgo(12),
    nodes: [],
    edges: [],
  },
]

/** @deprecated Logs start empty; session lines come from Deploy / Run / persist. */
export const INITIAL_MOCK_LOGS: WorkflowLogLine[] = []
