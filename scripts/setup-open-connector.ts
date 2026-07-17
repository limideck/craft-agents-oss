/**
 * Bootstrap the nested open-connector clone for local Craft Agents development.
 *
 * Usage (from repo root):
 *   bun run scripts/setup-open-connector.ts
 *
 * Runs `npm install` and `npm run generate:catalog` inside ./open-connector.
 * Does not add open-connector to craft bun workspaces.
 */

import { existsSync } from 'fs'
import { join } from 'path'
import { spawn } from 'bun'

const ROOT = join(import.meta.dir, '..')
const OPEN_CONNECTOR_DIR = join(ROOT, 'open-connector')

async function run(cmd: string[], cwd: string): Promise<void> {
  console.log(`$ ${cmd.join(' ')}`)
  const proc = spawn({
    cmd,
    cwd,
    stdout: 'inherit',
    stderr: 'inherit',
    env: process.env,
  })
  const code = await proc.exited
  if (code !== 0) {
    throw new Error(`Command failed (${code}): ${cmd.join(' ')}`)
  }
}

async function main(): Promise<void> {
  if (!existsSync(OPEN_CONNECTOR_DIR)) {
    console.error(`open-connector not found at ${OPEN_CONNECTOR_DIR}`)
    console.error('Clone it first, e.g.:')
    console.error('  git clone <open-connector-url> open-connector')
    process.exit(1)
  }

  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  await run([npm, 'install'], OPEN_CONNECTOR_DIR)
  await run([npm, 'run', 'generate:catalog'], OPEN_CONNECTOR_DIR)
  console.log('✅ open-connector ready (deps installed, catalog generated)')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
