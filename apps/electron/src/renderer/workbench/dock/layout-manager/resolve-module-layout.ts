/** Shared helpers for resolving module default layouts (no React). */
import { getLayoutPreset } from './presets'
import type { LayoutPresetId, LayoutState } from '../../registry/types'

export function resolveModuleLayout(
  defaultLayout: LayoutPresetId | LayoutState | undefined,
): LayoutState | null {
  if (!defaultLayout) return null
  if (typeof defaultLayout === 'string') return getLayoutPreset(defaultLayout)
  return defaultLayout
}
