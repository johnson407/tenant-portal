# Proposal

## Why

Every production build with Next.js 16.4.3 prints:

> The "middleware" file convention is deprecated. Please use "proxy" instead.

The build succeeds, but the warning is noise that hides future real warnings, and the current convention is no longer the supported one. Next.js 16 renamed `middleware.ts` to `proxy.ts` and the `middleware` export to `proxy`; the migration is name-only, so it can be done now without changing routing, auth, or session behavior.

## What Changes

- Rename the root `middleware.ts` to `proxy.ts` and the exported `middleware` function to `proxy`, keeping the matcher, locale normalization, tenant/admin guards, redirects, and `Cache-Control: no-store` behavior byte-for-byte equivalent.
- Rename `tests/middleware.test.ts` to `tests/proxy.test.ts` and update its import, function references, and describe labels to the new name. Test assertions about behavior and response headers stay unchanged.
- Update `AGENTS.md` to refer to `proxy.ts` and remove the note that the deprecation warning is expected.
- Verify the build no longer prints the deprecation warning, the full Vitest suite still passes, TypeScript still typechecks, and the real request flow still redirects and guards as before.
- No route, URL, cookie, session, environment, dependency, or copy changes.

## Capabilities

### New Capabilities

None. This is a pure framework-convention rename with no spec-level behavior change, so `.openspec.yaml` sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

- Affected files: `middleware.ts` → `proxy.ts`, `tests/middleware.test.ts` → `tests/proxy.test.ts`, and `AGENTS.md`.
- Not changed: `lib/`, `app/`, `next.config.ts`, `package.json`, environment variables, Redis keys, and every existing OpenSpec requirement. Historical references inside `openspec/changes/archive/**` are left as history.
- Risk is low: the runtime behavior is preserved, and the existing middleware test suite becomes the regression check under its new name.
