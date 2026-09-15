import { expect, it, vi } from "vitest";
import { NotificationManager } from "#src/observation/notification";
import { SubagentEventsObserver } from "#src/observation/subagent-events-observer";
import { createTestSubagent } from "#test/helpers/make-subagent";

for (const withheld of [false, true]) {
  it(`checks host permission at actual delivery (withheld=${withheld}) without losing terminal persistence`, () => {
    const send = vi.fn(); const append = vi.fn();
    let allowed = true;
    const notifications = new NotificationManager(send, () => allowed);
    const observer = new SubagentEventsObserver({ emit: vi.fn(), appendEntry: append, notifications });
    const record = createTestSubagent();
    if (withheld) notifications.onParentAgentStart();
    else allowed = false;
    observer.onSubagentCompleted(record);
    allowed = false;
    notifications.onParentAgentSettled();
    expect(append).toHaveBeenCalledWith("subagents:record", expect.objectContaining({ id: record.id }));
    expect(send).not.toHaveBeenCalled();
    // A cancelled operation must not suppress later legitimate work.
    allowed = true;
    observer.onSubagentCompleted(createTestSubagent({ id: "later" }));
    expect(send).toHaveBeenCalledTimes(1);
  });
}

it("checks each queued update and completion independently", () => {
  const send = vi.fn();
  const notifications = new NotificationManager(send, (record) => record.id !== "cancelled");
  notifications.onParentAgentStart();
  notifications.sendUpdate(createTestSubagent({ id: "cancelled" }), "update");
  notifications.sendCompletion(createTestSubagent({ id: "cancelled" }));
  notifications.sendCompletion(createTestSubagent({ id: "other" }));
  notifications.onParentAgentSettled();
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0][0].details.id).toBe("other");
});
