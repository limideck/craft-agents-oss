#!/usr/bin/env bun
/**
 * Build craft-modules Go sidecar and stage it for Electron packaging.
 *
 * Usage:
 *   bun run scripts/build-craft-modules.ts           # host platform → bin + electron resources
 *   bun run scripts/build-craft-modules.ts --all     # cross-compile dist/* for all targets
 *   bun run scripts/build-craft-modules.ts --stage-only  # copy existing dist/host into resources
 */

import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')
const svc = join(root, 'services', 'craft-modules')
const resourcesRoot = join(root, 'apps', 'electron', 'resources', 'craft-modules')

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
  return goos === 'windows' ? 'craft-modules.exe' : 'craft-modules'
}

function runMake(target: string): void {
  const r = spawnSync('make', [target], { cwd: svc, stdio: 'inherit' })
  if (r.status !== 0) throw new Error(`make ${target} failed`)
}

function stageHost(): void {
  const goos = goEnv('GOOS')
  const goarch = goEnv('GOARCH')
  const dir = platformArchDir(goos, goarch)
  const name = binaryName(goos)
  const src = join(svc, 'dist', `${goos}-${goarch}`, name)
  const alt = join(svc, 'bin', name)
  const from = existsSync(src) ? src : alt
  if (!existsSync(from)) {
    throw new Error(`craft-modules binary not found at ${src} or ${alt}. Run make dist-host first.`)
  }

  // Flat path used by packaged resolver + arch subdir for multi-arch trees
  mkdirSync(resourcesRoot, { recursive: true })
  const flatDest = join(resourcesRoot, name)
  const archDir = join(resourcesRoot, dir)
  mkdirSync(archDir, { recursive: true })
  const archDest = join(archDir, name)

  copyFileSync(from, flatDest)
  copyFileSync(from, archDest)
  console.log(`[craft-modules] staged ${from} → ${flatDest}`)
  console.log(`[craft-modules] staged ${from} → ${archDest}`)
}

function main(): void {
  const args = new Set(process.argv.slice(2))
  if (args.has('--clean')) {
    rmSync(join(svc, 'dist'), { recursive: true, force: true })
    rmSync(resourcesRoot, { recursive: true, force: true })
  }

  if (!args.has('--stage-only')) {
    if (args.has('--all')) runMake('dist')
    else runMake('dist-host')
    // Also keep bin/ for local electron:dev resolver
    runMake('build')
  }

  stageHost()
}

main()
