#!/usr/bin/env bun
/**
 * Build plydb (Tables sidecar fork) and stage for Electron packaging.
 *
 * Usage:
 *   bun run scripts/build-tables.ts           # host platform → resources/tables
 *   bun run scripts/build-tables.ts --stage-only
 */

import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')
const svc = join(root, 'test', 'plydb')
const resourcesRoot = join(root, 'apps', 'electron', 'resources', 'tables')

function goEnv(key: string): string {
  const r = spawnSync('go', ['env', key], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`go env ${key} failed: ${r.stderr}`)
  return r.stdout.trim()
}

function platformArchDir(goos: string, goarch: string): string {
  const plat = goos === 'windows' ? 'win' : goos === 'darwin' ? 'darwin' : 'linux'
  const arch = goarch === 'arm64' ? 'arm64' : 'x64'
  return `${plat}-${arch}`
}

function binaryName(goos: string): string {
  return goos === 'windows' ? 'plydb.exe' : 'plydb'
}

function buildHost(): void {
  if (!existsSync(svc)) {
    throw new Error(
      `plydb fork not found at ${svc}. Clone limideck/plydb into test/plydb first.`,
    )
  }
  const goos = goEnv('GOOS')
  const name = binaryName(goos)
  const out = join(svc, name)
  const r = spawnSync('go', ['build', '-o', out, '.'], {
    cwd: svc,
    stdio: 'inherit',
    env: process.env,
  })
  if (r.status !== 0) throw new Error('go build plydb failed')
}

function stageHost(): void {
  const goos = goEnv('GOOS')
  const goarch = goEnv('GOARCH')
  const dir = platformArchDir(goos, goarch)
  const name = binaryName(goos)
  const from = join(svc, name)
  if (!existsSync(from)) {
    throw new Error(`plydb binary not found at ${from}. Run without --stage-only first.`)
  }

  mkdirSync(resourcesRoot, { recursive: true })
  const flatDest = join(resourcesRoot, name)
  const archDir = join(resourcesRoot, dir)
  mkdirSync(archDir, { recursive: true })
  const archDest = join(archDir, name)

  copyFileSync(from, flatDest)
  copyFileSync(from, archDest)
  console.log(`[tables] staged ${from} → ${flatDest}`)
  console.log(`[tables] staged ${from} → ${archDest}`)
}

function main(): void {
  const args = new Set(process.argv.slice(2))
  if (args.has('--clean')) {
    rmSync(resourcesRoot, { recursive: true, force: true })
    const name = binaryName(goEnv('GOOS'))
    rmSync(join(svc, name), { force: true })
  }

  if (!args.has('--stage-only')) {
    buildHost()
  }

  stageHost()
}

main()
