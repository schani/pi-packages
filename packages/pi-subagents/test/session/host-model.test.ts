import { describe, expect, it } from "vitest";
import { resolveInvocationModel, type ModelRegistry } from "#src/session/model-resolver";
import { makeModel } from "#test/helpers/make-model";

const old = makeModel({ provider: "openai-codex", id: "gpt-6-sol" });
const sol = makeModel({ provider: "openai-codex", id: "gpt-6.1-sol" });
const registry: ModelRegistry = {
  find: (p, id) => [old, sol].find((m) => m.provider === p && m.id === id),
  getAll: () => [old, sol],
  getAvailable: () => [old, sol],
};
const strict = (input: string, models: ModelRegistry) => input.toLowerCase() === "sol" ? models.find("openai-codex", "gpt-6.1-sol")! : `Invalid model: ${input}`;

describe("host model resolver", () => {
  it("uses host resolution rather than fuzzy selection", () => {
    expect(resolveInvocationModel(old, "SOL", true, registry, strict)).toEqual({ model: sol });
    expect(resolveInvocationModel(old, "new-sol", false, registry, strict)).toEqual({ error: "Invalid model: new-sol" });
    expect(resolveInvocationModel(old, undefined, false, registry, strict)).toEqual({ model: old });
  });
});
