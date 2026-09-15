# Explicit child extension factories

An embedded host may need children to load selected inline extensions without copying root-only hooks into every child.
The default extension factory in `src/index.ts` accepts an optional second argument with `childExtensions`, an array of Pi SDK `InlineExtension` factories or named factories.

```typescript
subagentsExtension(pi, {
  childExtensions: [approvedChildExtension],
});
```

These factories are supplied to the child's resource loader alongside normal file/package discovery.
The child's tool allowlist still determines which registered tools it can use; the option does not implicitly inherit the parent's inline extensions.
An explicit empty array supplies no inline factories but still opts into strict loading, and does not disable discovered extensions.

When this option is supplied, any reported extension-loading error rejects child creation before the model runtime or agent session is created.
The error includes the failing resource paths and loader messages, so a collision cannot silently leave a child with only part of its intended configuration.
Omitting the option preserves the existing loading policy.
