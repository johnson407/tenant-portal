# Design

## Context

See `proposal.md` for motivation. The current request pipeline is a single root `middleware.ts` exporting `middleware` and a `config.matcher`. It normalizes bare paths to the default locale, verifies the `tp_session` JWT, guards `/{locale}/rooms/*` and `/{locale}/admin/*`, and sets `Cache-Control: no-store`. `tests/middleware.test.ts` imports the function and matcher directly.

Next.js 16.4.3 documents the rename as name-only: `middleware.ts` becomes `proxy.ts`, the export becomes `proxy`, and the runtime is the default Node.js runtime with no configurable `runtime` export. The project never sets an edge runtime and uses only Web APIs, `jose`, and `NextResponse`, so the rename does not require code changes inside the handler.

## Goals / Non-Goals

**Goals:**

- Remove the build's `middleware` deprecation warning.
- Keep every routing, redirect, cache-header, and session decision identical.
- Keep the existing test suite as the regression proof under the new name.

**Non-Goals:**

- Refactoring the guard logic or moving auth checks out of the request pipeline.
- Changing `next.config.ts`, the matcher, routes, cookies, Redis, or environment variables.
- Rewriting historical references in `openspec/changes/archive/**`.

## Decisions

### Rename manually with `git mv` instead of running the codemod

The official codemod (`npx @next/codemod@canary middleware-to-proxy .`) is on a canary channel and may reformat or touch unrelated files. The migration is two identifiers plus a filename, so a manual rename is deterministic, preserves history, and produces the smallest reviewable diff.

### Change only the file name and export name

`proxy.ts` keeps the same matcher, imports, helpers, redirect order, and `no-store` behavior. Keeping the handler untouched means the existing tests describe the same contract, and any behavioral difference in verification points at the rename rather than an unrelated refactor.

### Rename the test file and keep its assertions

`tests/middleware.test.ts` becomes `tests/proxy.test.ts`, importing `{ config, proxy }` from `@/proxy`. The assertions stay as-is, including `x-middleware-next`; that header is produced by `NextResponse.next()` and is unrelated to the file convention name. Renaming the test keeps the suite discoverable by name and still matched by Vitest's `tests/**/*.test.ts` include.

### Rely on the default Node.js runtime and add no runtime export

`proxy` does not support a `runtime` config option, and the project does not need edge APIs. The handler uses `NextRequest`, `NextResponse`, `jose`, and the shared i18n helpers, all valid on the Node.js runtime. Adding a runtime override would either fail the build or reintroduce the deprecated convention.

### Update live documentation only

`AGENTS.md` is the current architecture guide, so it must name `proxy.ts` and drop the "warning expected" note. Archived proposals/designs describe what was true when they were written and stay untouched.

## Risks / Trade-offs

- **Runtime semantics differ in edge cases (Node.js rather than edge)** → The handler uses no edge-only API and the full unit suite plus build exercise every branch; a real request check covers redirects and guards end to end.
- **A stale `.next` directory keeps the old convention and hides the result** → Verify with a clean `.next` (`rm -rf .next && npm run build`) and confirm the warning is absent and the route table still shows the proxy as middleware.
- **Renaming the test file could silently drop coverage** → Keep it under `tests/` with the `.test.ts` suffix and run the full `npm test`, not just the renamed file.
- **The rename looks trivial but touches the auth boundary** → Treat the diff as behavior-preserving and require the existing middleware cases (bare-path redirects, both locales, role separation, tampered cookies, `no-store`) to pass unchanged.

## Migration Plan

Apply the rename and test/doc updates in one commit. Deployment is a normal build; there is no data, schema, cookie, or environment migration. Rollback is `git revert` of the change, which restores `middleware.ts`; the deprecated warning would return but behavior stays intact.
