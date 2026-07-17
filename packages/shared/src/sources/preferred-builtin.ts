/**
 * Merge preferred-builtin Sources into a session / workspace enabled-slug list.
 *
 * Prefer-builtin MCP sources (today: craft-modules) are real on-disk Sources.
 * Tools only load when the slug is in the session's `enabledSourceSlugs`.
 * This helper adds usable preferred builtins so agents do not see
 * "configured but inactive" and ask the user to activate manually.
 */

import { listPreferredBuiltinSourceSlugs } from './builtin-sources.ts'
import { isSourceUsable, loadSource } from './storage.ts'

/**
 * Return `enabledSlugs` plus any preferred-builtin slugs that exist on disk
 * and are usable (enabled + authenticated when required).
 * Preserves existing order; appends missing preferred slugs at the end.
 */
export function mergePreferredBuiltinSourceSlugs(
  workspaceRootPath: string,
  enabledSlugs: string[] | undefined,
): string[] {
  const result = [...(enabledSlugs ?? [])]
  const present = new Set(result)

  for (const slug of listPreferredBuiltinSourceSlugs()) {
    if (present.has(slug)) continue
    const source = loadSource(workspaceRootPath, slug)
    if (source && isSourceUsable(source)) {
      result.push(slug)
      present.add(slug)
    }
  }

  return result
}

/**
 * Whether `after` added any preferred-builtin slug that was missing in `before`.
 */
export function preferredBuiltinSlugsAdded(
  before: string[] | undefined,
  after: string[],
): string[] {
  const prev = new Set(before ?? [])
  return after.filter((slug) => listPreferredBuiltinSourceSlugs().includes(slug) && !prev.has(slug))
}
