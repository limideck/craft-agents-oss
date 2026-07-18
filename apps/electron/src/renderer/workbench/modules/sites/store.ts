import { atom } from 'jotai'
import type {
  GroseModulesSite,
  GroseModulesSiteFileNode,
  GroseModulesSiteStatus,
} from '@grose-agent/shared/grose-modules'

export const sitesAtom = atom<GroseModulesSite[]>([])

export const selectedSiteIdAtom = atom<string | null>(null)

export const sitesLoadingAtom = atom(true)

export const sitesErrorAtom = atom<string | null>(null)

export const sitesCreateOpenAtom = atom(false)

export const sitesPreviewUrlAtom = atom<string | null>(null)

export const sitesPreviewStatusAtom = atom<GroseModulesSiteStatus | string | null>(null)

export const sitesVisualEditEnabledAtom = atom(false)

export const sitesSelectedFilePathAtom = atom<string | null>(null)

export const sitesFileContentAtom = atom<string | null>(null)

export const sitesFileTreeAtom = atom<GroseModulesSiteFileNode[]>([])

export const sitesFilesLoadingAtom = atom(false)

export const selectedSiteAtom = atom((get) => {
  const id = get(selectedSiteIdAtom)
  if (!id) return null
  return get(sitesAtom).find((s) => s.id === id) ?? null
})
