#!/usr/bin/env bun

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getGroseAgentReadOnlyBashPatterns } from './cli-domains.ts'

interface AllowedBashEntry {
  pattern: string
  comment?: string
}

interface PermissionsConfig {
  version?: string
  allowedBashPatterns?: AllowedBashEntry[]
  [key: string]: unknown
}

function isGroseAgentPattern(entry: AllowedBashEntry): boolean {
  return typeof entry.pattern === 'string' && entry.pattern.startsWith('^grose-agent\\s')
}

function syncGroseAgentPatterns(config: PermissionsConfig): PermissionsConfig {
  const patterns = config.allowedBashPatterns ?? []
  const firstGroseIndex = patterns.findIndex(isGroseAgentPattern)

  const withoutGrose = patterns.filter(entry => !isGroseAgentPattern(entry))
  const generated = getGroseAgentReadOnlyBashPatterns()

  const insertAt = firstGroseIndex >= 0 ? firstGroseIndex : withoutGrose.length
  const nextAllowedBashPatterns = [
    ...withoutGrose.slice(0, insertAt),
    ...generated,
    ...withoutGrose.slice(insertAt),
  ]

  return {
    ...config,
    allowedBashPatterns: nextAllowedBashPatterns,
  }
}

function main() {
  const targetPath = process.argv[2]
    ? resolve(process.argv[2])
    : resolve(process.cwd(), 'apps/electron/resources/permissions/default.json')

  const config = JSON.parse(readFileSync(targetPath, 'utf-8')) as PermissionsConfig
  const nextConfig = syncGroseAgentPatterns(config)

  writeFileSync(targetPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf-8')
  process.stdout.write(`Synced grose-agent bash patterns in ${targetPath}\n`)
}

if (import.meta.main) {
  main()
}
