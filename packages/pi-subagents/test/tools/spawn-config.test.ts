import { describe, expect, it, vi } from "vitest";
import { AgentTypeRegistry } from "#src/config/agent-types";
import { resolveSpawnConfig } from "#src/tools/spawn-config";
import { makeModel } from "#test/helpers/make-model";

/** Registry with a caller-defined replace-mode agent. */
const testRegistry = new AgentTypeRegistry(() => new Map([["Explore", {
  name: "Explore", description: "Custom search agent", displayName: "Explore",
  systemPrompt: "", promptMode: "replace" as const,
}]]));

/** Shorthand for building ModelInfo. */
function makeModelInfo(overrides: Partial<Parameters<typeof resolveSpawnConfig>[2]> = {}) {
  return {
    parentModel: makeModel({ id: "claude-sonnet", name: "Claude Sonnet" }),
    modelRegistry: { find: () => undefined, getAll: () => [], getAvailable: () => [] },
    ...overrides,
  };
}

const defaultSettings = { defaultMaxTurns: undefined as number | undefined };

describe("resolveSpawnConfig — type resolution", () => {
  it("resolves a known agent type", () => {
    const result = resolveSpawnConfig(
      { subagent_type: "general-purpose", prompt: "test", description: "d" },
      testRegistry,
      makeModelInfo(),
      defaultSettings,
    );
    expect("error" in result && result.error).toBeFalsy();
    if ("error" in result) return;
    expect(result.identity.subagentType).toBe("general-purpose");
  });

  it.for(["sol", "unknown-type"])("rejects unknown profile %s before model resolution", (type) => {
    const resolveModel = vi.fn(() => "Model must not be resolved");
    const result = resolveSpawnConfig(
      { subagent_type: type, prompt: "test", description: "d", model: "sol" },
      testRegistry, makeModelInfo(), defaultSettings, resolveModel,
    );
    expect(resolveModel).not.toHaveBeenCalled();
    expect(result).toEqual({ error: `Unknown agent type "${type}". Available types: general-purpose, Explore. subagent_type selects an agent profile, not a model. To choose a model use model, e.g. "provider/modelId".` });
  });

  it("sets displayName from registry", () => {
    const result = resolveSpawnConfig(
      { subagent_type: "Explore", prompt: "test", description: "d" },
      testRegistry,
      makeModelInfo(),
      defaultSettings,
    );
    if ("error" in result) return;
    expect(result.identity.displayName).toBe("Explore");
  });

  it("uses displayName from agent config when available", () => {
    const result = resolveSpawnConfig(
      { subagent_type: "general-purpose", prompt: "test", description: "d" },
      testRegistry,
      makeModelInfo(),
      defaultSettings,
    );
    if ("error" in result) return;
    // general-purpose config has displayName: "Agent"
    expect(result.identity.displayName).toBe("Agent");
  });
});

describe("resolveSpawnConfig — model resolution", () => {
  it("rejects an explicitly empty hosted model selector", () => {
    const result = resolveSpawnConfig(
      { subagent_type: "general-purpose", prompt: "test", description: "d", model: "" },
      testRegistry, makeModelInfo(), defaultSettings, () => 'Model not found: "".',
    );
    expect(result).toEqual({ error: 'Model not found: "".' });
  });

  it("inherits parent model when no model specified", () => {
    const parentModel = makeModel({ id: "claude-sonnet", name: "Claude Sonnet" });
    const result = resolveSpawnConfig(
      { subagent_type: "general-purpose", prompt: "test", description: "d" },
      testRegistry,
      makeModelInfo({ parentModel }),
      defaultSettings,
    );
    if ("error" in result) return;
    expect(result.execution.model).toBe(parentModel);
    // modelName is undefined when same as parent
    expect(result.presentation.modelName).toBeUndefined();
  });

  it("returns error when user-specified model cannot be resolved", () => {
    const result = resolveSpawnConfig(
      { subagent_type: "general-purpose", prompt: "test", description: "d", model: "nonexistent-xyz" },
      testRegistry,
      makeModelInfo({ modelRegistry: { find: () => undefined, getAll: () => [], getAvailable: () => [] } }),
      defaultSettings,
    );
    expect("error" in result && result.error).toBeTruthy();
  });
});

describe("resolveSpawnConfig — max turns normalization", () => {
  it("normalizes max_turns from params", () => {
    const result = resolveSpawnConfig(
      { subagent_type: "general-purpose", prompt: "test", description: "d", max_turns: 10 },
      testRegistry,
      makeModelInfo(),
      defaultSettings,
    );
    if ("error" in result) return;
    expect(result.execution.effectiveMaxTurns).toBe(10);
  });

  it("uses settings defaultMaxTurns when no max_turns in params", () => {
    const result = resolveSpawnConfig(
      { subagent_type: "general-purpose", prompt: "test", description: "d" },
      testRegistry,
      makeModelInfo(),
      { defaultMaxTurns: 25 },
    );
    if ("error" in result) return;
    expect(result.execution.effectiveMaxTurns).toBe(25);
  });

  it("returns undefined effectiveMaxTurns when neither params nor settings specify", () => {
    const result = resolveSpawnConfig(
      { subagent_type: "general-purpose", prompt: "test", description: "d" },
      testRegistry,
      makeModelInfo(),
      defaultSettings,
    );
    if ("error" in result) return;
    expect(result.execution.effectiveMaxTurns).toBeUndefined();
  });
});

describe("resolveSpawnConfig — invocation fields", () => {
  it("sets runInBackground from params", () => {
    const result = resolveSpawnConfig(
      { subagent_type: "general-purpose", prompt: "test", description: "d", run_in_background: true },
      testRegistry,
      makeModelInfo(),
      defaultSettings,
    );
    if ("error" in result) return;
    expect(result.execution.runInBackground).toBe(true);
  });

  it("builds agentInvocation snapshot", () => {
    const result = resolveSpawnConfig(
      { subagent_type: "general-purpose", prompt: "test", description: "d", thinking: "high" },
      testRegistry,
      makeModelInfo(),
      defaultSettings,
    );
    if ("error" in result) return;
    expect(result.execution.agentInvocation).toEqual({
      modelName: undefined,
      thinking: "high",
      maxTurns: undefined,
      inheritContext: false,
      runInBackground: false,
    });
  });
});

describe("resolveSpawnConfig — detailBase and tags", () => {
  it("builds detailBase with description from params", () => {
    const result = resolveSpawnConfig(
      { subagent_type: "general-purpose", prompt: "test", description: "my task" },
      testRegistry,
      makeModelInfo(),
      defaultSettings,
    );
    if ("error" in result) return;
    expect(result.presentation.detailBase.description).toBe("my task");
    expect(result.presentation.detailBase.subagentType).toBe("general-purpose");
    expect(result.presentation.detailBase.displayName).toBe("Agent");
  });

  it("includes thinking tag when thinking is set", () => {
    const result = resolveSpawnConfig(
      { subagent_type: "general-purpose", prompt: "test", description: "d", thinking: "high" },
      testRegistry,
      makeModelInfo(),
      defaultSettings,
    );
    if ("error" in result) return;
    expect(result.presentation.agentTags).toContain("thinking: high");
  });

  it("omits mode label for replace-mode agents", () => {
    const result = resolveSpawnConfig(
      { subagent_type: "Explore", prompt: "test", description: "d" },
      testRegistry,
      makeModelInfo(),
      defaultSettings,
    );
    if ("error" in result) return;
    // Replace mode has no mode label or invocation overrides.
    expect(result.presentation.agentTags).toEqual([]);
  });

  it("includes twin tag for append-mode agents like general-purpose", () => {
    const result = resolveSpawnConfig(
      { subagent_type: "general-purpose", prompt: "test", description: "d" },
      testRegistry,
      makeModelInfo(),
      defaultSettings,
    );
    if ("error" in result) return;
    // general-purpose has promptMode: "append" → gets "twin" label
    expect(result.presentation.agentTags).toContain("twin");
  });

  it("sets tags to undefined on detailBase for replace-mode agents with no invocation overrides", () => {
    const result = resolveSpawnConfig(
      { subagent_type: "Explore", prompt: "test", description: "d" },
      testRegistry,
      makeModelInfo(),
      defaultSettings,
    );
    if ("error" in result) return;
    // Replace mode with no invocation overrides has no tags.
    expect(result.presentation.detailBase.tags).toBeUndefined();
  });
});

describe("resolveSpawnConfig — thinking level", () => {
  it("returns an error naming the valid levels for an unrecognized thinking param", () => {
    const result = resolveSpawnConfig(
      { subagent_type: "Explore", prompt: "test", description: "d", thinking: "turbo" },
      testRegistry,
      makeModelInfo(),
      defaultSettings,
    );
    expect(result).toEqual({
      error:
        'Invalid thinking level "turbo". Valid levels: off, minimal, low, medium, high, xhigh, max.',
    });
  });

  it("resolves a recognized thinking param", () => {
    const result = resolveSpawnConfig(
      { subagent_type: "Explore", prompt: "test", description: "d", thinking: "xhigh" },
      testRegistry,
      makeModelInfo(),
      defaultSettings,
    );
    if ("error" in result) throw new Error(result.error);
    expect(result.execution.thinking).toBe("xhigh");
  });
});

describe("resolveSpawnConfig — notes", () => {
  it("carries no note for a known agent type", () => {
    const result = resolveSpawnConfig(
      { subagent_type: "Explore", prompt: "test", description: "d" },
      testRegistry,
      makeModelInfo(),
      defaultSettings,
    );
    if ("error" in result) return;
    expect(result.notes).toEqual([]);
  });

  it("carries a lock note naming the discarded parameters", () => {
    const lockedRegistry = new AgentTypeRegistry(
      () =>
        new Map([
          [
            "pinned",
            {
              name: "pinned",
              description: "Pinned",
              systemPrompt: "",
              promptMode: "append" as const,
              model: "provider/pinned",
              maxTurns: 7,
              locked: true as const,
            },
          ],
        ]),
    );
    const result = resolveSpawnConfig(
      {
        subagent_type: "pinned",
        prompt: "test",
        description: "d",
        model: "other",
        max_turns: 3,
      },
      lockedRegistry,
      makeModelInfo(),
      defaultSettings,
    );
    if ("error" in result) throw new Error(result.error);
    expect(result.notes).toEqual([
      'Note: agent "pinned" locks model, max_turns, so those parameters were ignored.',
    ]);
  });

  it("names a single discarded parameter in the singular", () => {
    const lockedRegistry = new AgentTypeRegistry(
      () =>
        new Map([
          [
            "pinned",
            {
              name: "pinned",
              description: "Pinned",
              systemPrompt: "",
              promptMode: "append" as const,
              model: "provider/pinned",
              locked: ["model"] as const,
            },
          ],
        ]),
    );
    const result = resolveSpawnConfig(
      { subagent_type: "pinned", prompt: "test", description: "d", model: "other" },
      lockedRegistry,
      makeModelInfo(),
      defaultSettings,
    );
    if ("error" in result) throw new Error(result.error);
    expect(result.notes).toEqual([
      'Note: agent "pinned" locks model, so the model parameter was ignored.',
    ]);
  });




});

describe("resolveSpawnConfig — prompt and rawType passthrough", () => {
  it("passes through prompt and rawType", () => {
    const result = resolveSpawnConfig(
      { subagent_type: "Explore", prompt: "search for bugs", description: "bug search" },
      testRegistry,
      makeModelInfo(),
      defaultSettings,
    );
    if ("error" in result) return;
    expect(result.execution.prompt).toBe("search for bugs");
    expect(result.identity.rawType).toBe("Explore");
  });
});
