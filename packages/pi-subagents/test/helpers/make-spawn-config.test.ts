import { describe, expect, it } from "vitest";
import { createResolvedSpawnConfig } from "#test/helpers/make-spawn-config";

describe("createResolvedSpawnConfig", () => {
  it("produces a foreground-shaped config by default", () => {
    expect(createResolvedSpawnConfig()).toEqual({
      identity: {
        subagentType: "general-purpose",
        rawType: "general-purpose",
        displayName: "Agent",
      },
      notes: [],
      execution: {
        prompt: "do the task",
        description: "task",
        model: undefined,
        effectiveMaxTurns: undefined,
        thinking: undefined,
        inheritContext: false,
        runInBackground: false,
        agentInvocation: {
          modelName: undefined,
          thinking: undefined,
          maxTurns: undefined,
          inheritContext: false,
          runInBackground: false,
        },
      },
      presentation: {
        modelName: undefined,
        agentTags: [],
        detailBase: {
          displayName: "Agent",
          description: "task",
          subagentType: "general-purpose",
          modelName: undefined,
          tags: undefined,
        },
      },
    });
  });

  it("applies the scalar overrides", () => {
    const config = createResolvedSpawnConfig({
      displayName: "General-purpose",
      prompt: "do something",
      description: "bg task",
      runInBackground: true,
    });
    expect(config.identity.displayName).toBe("General-purpose");
    expect(config.execution.prompt).toBe("do something");
    expect(config.execution.description).toBe("bg task");
  });

  it("mirrors runInBackground into agentInvocation", () => {
    const config = createResolvedSpawnConfig({ runInBackground: true });
    expect(config.execution.runInBackground).toBe(true);
    expect(config.execution.agentInvocation.runInBackground).toBe(true);
  });





  it("mirrors displayName, description, subagentType, and model into presentation.detailBase", () => {
    const config = createResolvedSpawnConfig({
      subagentType: "Explore",
      displayName: "Explore",
      description: "scan repo",
      model: "haiku",
    });
    expect(config.presentation.modelName).toBe("haiku");
    expect(config.presentation.detailBase).toEqual({
      displayName: "Explore",
      description: "scan repo",
      subagentType: "Explore",
      modelName: "haiku",
      tags: undefined,
    });
  });
});
