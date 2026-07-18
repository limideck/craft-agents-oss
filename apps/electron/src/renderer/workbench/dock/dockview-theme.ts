import { themeAbyss, type DockviewTheme } from 'dockview-react'

/** Grose dockview theme — abyss base + Grose CSS chrome class. */
export const themeGrose: DockviewTheme = {
  ...themeAbyss,
  className: `${themeAbyss.className} dockview-theme-grose`,
  gap: 0,
}
