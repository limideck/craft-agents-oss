import { atom } from 'jotai'
import type { SourceFilter } from '../../../shared/types'
import type { SettingsSubpage } from '../../../shared/types'

/** Selected source slug in the Sources workbench module. */
export const selectedSourceSlugAtom = atom<string | null>(null)

/** Sources list type filter (API / MCP / Local). */
export const sourceFilterAtom = atom<SourceFilter | null>(null)

/** Selected skill slug in the Skills workbench module. */
export const selectedSkillSlugAtom = atom<string | null>(null)

/** Selected settings subpage in the Settings workbench module. */
export const settingsSubpageAtom = atom<SettingsSubpage>('app')
