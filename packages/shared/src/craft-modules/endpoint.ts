import type { CraftModulesEndpoint } from './types.ts'

let endpoint: CraftModulesEndpoint | null = null

/** Set by Electron / headless after sidecar health succeeds. */
export function setCraftModulesEndpoint(next: CraftModulesEndpoint | null): void {
  endpoint = next
}

export function getCraftModulesEndpoint(): CraftModulesEndpoint | null {
  return endpoint
}

export function requireCraftModulesEndpoint(): CraftModulesEndpoint {
  if (!endpoint?.ready || !endpoint.baseUrl) {
    throw new Error('craft-modules sidecar is not ready')
  }
  return endpoint
}
