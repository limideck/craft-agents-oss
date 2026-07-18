const LOCAL_STORAGE_KEY = 'grose-feature-workbench-shell'

// Workbench is now the sole UI shell. The legacy app-shell was removed
// (see docs/refactor-remove-app-shell.md). This flag is retained only as a
// stable API and always reports enabled.
export function isWorkbenchShellEnabled(): boolean {
  return true
}

export function setWorkbenchShellEnabled(_enabled: boolean): void {
  localStorage.setItem(LOCAL_STORAGE_KEY, _enabled ? '1' : '0')
}
