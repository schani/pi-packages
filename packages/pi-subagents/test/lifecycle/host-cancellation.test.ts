import { expect, it, vi } from "vitest";
import { Subagent } from "#src/lifecycle/subagent";
import { makeStubExecution } from "#test/helpers/make-subagent";
import { createSubagentSessionStub, toSubagentSession } from "#test/helpers/mock-session";

function gate<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }

for (const boundary of ["prepare", "session"] as const) {
  it(`does not execute after cancellation during ${boundary}, and cleans up before terminal`, async () => {
    const entered = gate<void>();
    const release = gate<void>();
    const order: string[] = [];
    const stub = createSubagentSessionStub();
    const factory = vi.fn(async () => {
      if (boundary === "session") { entered.resolve(); await release.promise; }
      return toSubagentSession(stub);
    });
    const agent = new Subagent({ id: "a", type: "general-purpose", description: "test", isBackground: true,
      execution: makeStubExecution({ createSubagentSession: factory,
        getWorkspaceProvider: () => ({ prepare: async () => {
          if (boundary === "prepare") { entered.resolve(); await release.promise; }
          return { cwd: "/test", dispose: () => { order.push("cleanup"); } };
        } }),
        observer: { onRunFinished: () => { order.push("terminal"); } },
      }),
    });
    agent.start();
    await entered.promise;
    expect(agent.abort()).toBe(true);
    expect(order).toEqual([]);
    release.resolve();
    await agent.promise;
    expect(stub.runTurnLoop).not.toHaveBeenCalled();
    expect(order).toEqual(["cleanup", "terminal"]);
    if (boundary === "prepare") expect(factory).not.toHaveBeenCalled();
    expect(agent.status).toBe("stopped");
  });
}

it("does not acquire a session for an already-aborted initial signal", async () => {
  const signal = new AbortController(); signal.abort();
  const factory = vi.fn(async () => toSubagentSession(createSubagentSessionStub()));
  const agent = new Subagent({ id: "a", type: "general-purpose", description: "test", isBackground: true,
    execution: makeStubExecution({ signal: signal.signal, createSubagentSession: factory }) });
  await agent.run();
  expect(factory).not.toHaveBeenCalled();
  expect(agent.status).toBe("stopped");
});

it("owns a fresh abort signal for every resumed run", async () => {
  const stub = createSubagentSessionStub();
  const signals: AbortSignal[] = [];
  let entered = gate<void>();
  let release = gate<void>();
  stub.resumeTurnLoop.mockImplementation(async (_prompt, signal) => {
    signals.push(signal!); entered.resolve(); await release.promise; return "done";
  });
  const agent = new Subagent({ id: "a", type: "general-purpose", description: "test", isBackground: true,
    execution: makeStubExecution({ createSubagentSession: async () => toSubagentSession(stub) }) });
  await agent.run();
  for (let run = 0; run < 2; run++) {
    entered = gate<void>(); release = gate<void>();
    const done = agent.resume("again");
    await entered.promise;
    expect(signals[run]?.aborted).toBe(false);
    expect(agent.abort()).toBe(true);
    expect(signals[run]?.aborted).toBe(true);
    release.resolve(); await done;
    expect(agent.status).toBe("stopped");
  }
  expect(signals[0]).not.toBe(signals[1]);
});
