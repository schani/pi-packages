/**
 * Embedded default agent configurations.
 * User .md files with the same name can override these.
 */

import type { AgentConfig } from "#src/types";

export const DEFAULT_AGENTS: Map<string, AgentConfig> = new Map([
  [
    "general-purpose",
    {
      name: "general-purpose",
      displayName: "Agent",
      description: "General-purpose agent for complex, multi-step tasks",
      toolGuideline: "- Use general-purpose for complex tasks that need file editing.",
      // toolNames omitted — means "all available tools" (resolved at lookup time)
      // inheritContext / runInBackground omitted — strategy fields, callers decide per-call.
      systemPrompt: "",
      promptMode: "append",
      isDefault: true,
    },
  ],
]);
