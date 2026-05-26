---
name: Clerk React v6 compatibility
description: Version pinning rules and API differences for @clerk/react v5→v6 in this monorepo.
---

## Rule
Pin `@clerk/react` to `^6.7.1` and add a `pnpm-workspace.yaml` override `"@clerk/shared": "^4.13.1"`.

**Why:** @clerk/react@5.54.x imports `loadClerkUiScript` from @clerk/shared which only exists in @clerk/shared@4.x. Without the override pnpm resolves @clerk/shared@3.47.6 (which doesn't have it) and Vite fails with a bundling error. @clerk/react@6.7.1 declares its peer correctly as @clerk/shared@^4.13.1.

**How to apply:** Any time Clerk is added to a new frontend artifact, install `@clerk/react@^6.7.1 @clerk/themes@^2.4.57` and ensure the workspace override is present.

## API differences (v6 vs v5)
- `Show` is exported from `@clerk/react` (replaces `SignedIn`/`SignedOut` for conditional rendering).
- `publishableKeyFromHost` does NOT exist in `@clerk/react/internal` in either v5 or v6. Use `import.meta.env.VITE_CLERK_PUBLISHABLE_KEY` directly on the frontend.
- `SignIn`, `SignUp`, `ClerkProvider`, `useClerk`, `useUser`, `useAuth` all work the same as v5.
