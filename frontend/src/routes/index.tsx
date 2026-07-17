import { createFileRoute } from "@tanstack/react-router";
import { AgentIDE } from "@/components/agent-ide/AgentIDE";

export const Route = createFileRoute("/")({
  component: AgentIDE,
  head: () => ({
    meta: [
      { title: "Agent IDE" },
      { name: "description", content: "Cursor-style agent IDE workspace" },
    ],
  }),
});
