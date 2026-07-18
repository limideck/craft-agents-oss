import type { GroseModulesEndpoint } from './types.ts'

let endpoint: GroseModulesEndpoint | null = null

/** Set by Electron / headless after sidecar health succeeds. */
export function setGroseModulesEndpoint(next: GroseModulesEndpoint | null): void {
  endpoint = next
}

export function getGroseModulesEndpoint(): GroseModulesEndpoint | null {
  return endpoint
}

export function requireGroseModulesEndpoint(): GroseModulesEndpoint {
  if (!endpoint?.ready || !endpoint.baseUrl) {
    throw new Error('grose-modules sidecar is not ready')
  }
  return endpoint
}
