# Host-controlled automatic wakes

An embedded host can outlive or cancel the operation that owns a child while the child's notification is waiting for the parent to settle.
The default extension factory in `src/index.ts` accepts an optional second argument with a synchronous `shouldWake({ id })` predicate.
It is evaluated at actual automatic update/completion delivery, including previously withheld notifications, rather than only when they are queued.

```typescript
subagentsExtension(pi, {
  shouldWake: ({ id }) => hostMayWakeParent(id),
});
```

Returning `false` declines that automatic send; it does not cancel the child, erase its persisted terminal record, or prevent explicit result retrieval.
Declined sends are not automatically retried when the predicate later changes.
Omitting the predicate preserves normal delivery.
The callback must not throw, and the host owns any diagnostic record explaining its decision.
