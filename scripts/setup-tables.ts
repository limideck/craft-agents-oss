/**
 * Bootstrap the nested plydb fork for Grose Tables sidecar development.
 *
 * Usage (from repo root):
 *   bun run scripts/setup-tables.ts
 *
 * Builds test/plydb and stages apps/electron/resources/tables/.
 */

import { existsSync } from 'fs'
import { join } from 'path'
import { spawn } from 'bun'

const ROOT = join(import.meta.dir, '..')
const PLYDB_DIR = join(ROOT, 'test', 'plydb')

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
  if (!existsSync(PLYDB_DIR)) {
    console.error(`plydb fork not found at ${PLYDB_DIR}`)
    console.error('Clone it first, e.g.:')
    console.error('  git clone git@github.com:limideck/plydb.git test/plydb')
    process.exit(1)
  }

  await run(['bun', 'run', 'scripts/build-tables.ts'], ROOT)
  console.log('✅ tables sidecar ready (plydb built + staged to apps/electron/resources/tables)')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
