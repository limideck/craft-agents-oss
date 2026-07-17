/**
 * Sync workbench active-module context from send-message options onto the
 * agent's PromptBuilder for the upcoming turn.
 *
 * Always sets (or clears) so a prior turn's module id cannot stick when the
 * UI omits `activeModuleId` (CLI, automations, classic shell).
 */
export function syncActiveCraftModuleFromSendOptions(
  agent: {
    getPromptBuilder(): {
      setActiveCraftModuleId(id: string | null | undefined): void
    }
  },
  options?: { activeModuleId?: string } | null,
): void {
  agent.getPromptBuilder().setActiveCraftModuleId(options?.activeModuleId ?? null)
}
