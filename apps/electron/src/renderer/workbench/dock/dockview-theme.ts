import { themeAbyss, type DockviewTheme } from 'dockview-react'

/** Craft dockview theme — abyss base + Craft CSS chrome class. */
export const themeCraft: DockviewTheme = {
  ...themeAbyss,
  className: `${themeAbyss.className} dockview-theme-craft`,
  gap: 0,
}
