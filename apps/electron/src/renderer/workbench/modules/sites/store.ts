import { atom } from 'jotai'
import type {
  CraftModulesSite,
  CraftModulesSiteFileNode,
  CraftModulesSiteStatus,
} from '@craft-agent/shared/craft-modules'

export const sitesAtom = atom<CraftModulesSite[]>([])

export const selectedSiteIdAtom = atom<string | null>(null)

export const sitesLoadingAtom = atom(true)

export const sitesErrorAtom = atom<string | null>(null)

export const sitesCreateOpenAtom = atom(false)

export const sitesPreviewUrlAtom = atom<string | null>(null)

export const sitesPreviewStatusAtom = atom<CraftModulesSiteStatus | string | null>(null)

export const sitesVisualEditEnabledAtom = atom(false)

export const sitesSelectedFilePathAtom = atom<string | null>(null)

export const sitesFileContentAtom = atom<string | null>(null)

export const sitesFileTreeAtom = atom<CraftModulesSiteFileNode[]>([])

export const sitesFilesLoadingAtom = atom(false)

export const selectedSiteAtom = atom((get) => {
  const id = get(selectedSiteIdAtom)
  if (!id) return null
  return get(sitesAtom).find((s) => s.id === id) ?? null
})
