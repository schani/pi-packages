# Explicit working directory for embedded hosts

An embedded session's checkout can differ from the process working directory.
The default extension factory in `src/index.ts` accepts an optional second argument with `cwd`, so project discovery does not depend on changing a process-wide global.

```typescript
subagentsExtension(pi, { cwd: sessionCheckout });
```

The supplied directory is used to discover custom agent profiles, load project settings, and provide the base directory to workspace preparation.
Pass the parent session's actual checkout directory; the option does not replace the SDK's session context or override a workspace provider's returned child directory.
It does not call `process.chdir()`.
Omitting it preserves the process-working-directory default.
Existing filesystem/loading error behavior is unchanged.
