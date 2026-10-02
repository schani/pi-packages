import { describe, expect, it, vi } from "vitest";
import { AgentTypeRegistry } from "#src/config/agent-types";
import type { ServiceRuntimeLike, SubagentManagerLike } from "#src/service/service-adapter";
import { SubagentsServiceAdapter } from "#src/service/service-adapter";
import type { AgentConfig } from "#src/types";
import { makeModel } from "#test/helpers/make-model";
import { STUB_SNAPSHOT } from "#test/helpers/stub-ctx";

const sol = makeModel({ provider: "openai-codex", id: "gpt-6.1-sol" });
const old = makeModel({ provider: "openai-codex", id: "gpt-6-sol" });

function fixture(config: Partial<AgentConfig>) {
  const registry = new AgentTypeRegistry(() => new Map([["probe", {
    name: "probe", description: "probe", systemPrompt: "", promptMode: "append", ...config,
  }]]));
  const spawn = vi.fn<SubagentManagerLike["spawn"]>(() => "child");
  const manager: SubagentManagerLike = {
    spawn, getRecord: () => undefined, listAgents: () => [], abort: () => false,
    waitForAll: async () => {}, hasRunning: () => false,
    registerWorkspaceProvider: () => () => {}, resume: async () => ({ kind: "refused", reason: "unknown-agent" }),
  };
  const runtime: ServiceRuntimeLike = {
    currentCtx: {
      ...STUB_SNAPSHOT, model: old,
      modelRegistry: { getAll: () => [old, sol], find: () => undefined },
      getSystemPrompt: () => "", sessionManager: { getSessionFile: () => undefined, getSessionId: () => "parent", getBranch: () => [] },
    },
    buildSnapshot: () => STUB_SNAPSHOT,
    getSessionInfo: () => ({ parentSessionFile: "/parent.jsonl", parentSessionId: "parent" }),
  };
  const resolve = vi.fn((selector: string) => selector === "Sol" ? sol : `Invalid model: ${selector}`);
  return { service: new SubagentsServiceAdapter(manager, resolve, runtime, registry), spawn, resolve };
}

describe("SDK winning model selector", () => {
  it.each([{ config: {}, options: { model: "" } }, { config: { model: "" }, options: {} }])(
    "rejects an empty winning selector before admission (%j)", ({ config, options }) => {
      const { service, spawn, resolve } = fixture(config);
      expect(() => service.spawn("probe", "task", options)).toThrow("Invalid model: ");
      expect(resolve).toHaveBeenCalledExactlyOnceWith("", expect.anything());
      expect(spawn).not.toHaveBeenCalled();
    },
  );

  it("discards an empty caller selector when the profile locks its model", () => {
    const { service, spawn, resolve } = fixture({ model: "Sol", locked: ["model"] });
    service.spawn("probe", "task", { model: "" });
    expect(resolve).toHaveBeenCalledExactlyOnceWith("Sol", expect.anything());
    expect(spawn.mock.calls[0][3]).toMatchObject({ model: sol, requestedModel: "Sol" });
  });

  it("resolves and preserves an omitted override's profile selector", () => {
    const { service, spawn, resolve } = fixture({ model: "Sol" });
    service.spawn("PROBE", "task");
    expect(resolve).toHaveBeenCalledWith("Sol", expect.anything());
    expect(spawn.mock.calls[0][3]).toMatchObject({ model: sol, requestedModel: "Sol" });
  });

  it.each([{ locked: true }, { locked: ["model"] }] as const)("resolves the locked profile, not the discarded caller (%j)", ({ locked }) => {
    const { service, spawn, resolve } = fixture({ model: "Sol", locked });
    service.spawn("probe", "task", { model: "typo" });
    expect(resolve).toHaveBeenCalledExactlyOnceWith("Sol", expect.anything());
    expect(spawn.mock.calls[0][3]).toMatchObject({ model: sol, requestedModel: "Sol" });
  });

  it("inherits when the profile locks an unset model", () => {
    const { service, spawn, resolve } = fixture({ locked: ["model"] });
    service.spawn("probe", "task", { model: "typo" });
    expect(resolve).not.toHaveBeenCalled();
    expect(spawn.mock.calls[0][3]).toMatchObject({ model: undefined, requestedModel: undefined });
  });

  it("rejects an unavailable profile before admission", () => {
    const { service, spawn } = fixture({ model: "unavailable" });
    expect(() => service.spawn("probe", "task")).toThrow("Invalid model: unavailable");
    expect(spawn).not.toHaveBeenCalled();
  });

  it("lets an unlocked caller win", () => {
    const { service, spawn } = fixture({ model: "unavailable" });
    service.spawn("probe", "task", { model: "Sol" });
    expect(spawn.mock.calls[0][3]).toMatchObject({ model: sol, requestedModel: "Sol" });
  });

  it("inherits with neither caller nor profile selector", () => {
    const { service, spawn, resolve } = fixture({});
    service.spawn("probe", "task");
    expect(resolve).not.toHaveBeenCalled();
    expect(spawn.mock.calls[0][3]).toMatchObject({ model: undefined, requestedModel: undefined });
  });
});
