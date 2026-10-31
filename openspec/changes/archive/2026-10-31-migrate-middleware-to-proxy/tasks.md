# Tasks

## 1. Rename the request pipeline

- [x] 1.1 Rename `middleware.ts` to `proxy.ts` with `git mv`, rename the exported `middleware` function to `proxy`, and leave the imports, matcher, helper functions, redirect order, and `no-store` behavior unchanged. Verify with `grep -n "export async function proxy" proxy.ts` and confirm `git diff --stat` shows the file as a rename with no logic hunks.
- [x] 1.2 Rename `tests/middleware.test.ts` to `tests/proxy.test.ts` with `git mv`, change the import to `{ config, proxy } from "@/proxy"`, update the `middleware(...)` calls and describe labels, and leave the behavioral assertions and `x-middleware-next` header checks unchanged. Verify with `npx vitest run tests/proxy.test.ts` passing every existing case.

## 2. Update live documentation

- [x] 2.1 In `AGENTS.md`, describe `proxy.ts` as the locale-normalization and route-guard layer and remove the sentence saying the `middleware` deprecation warning is expected. Verify with `grep -n "proxy.ts" AGENTS.md` and `grep -n "warning is expected" AGENTS.md` (the second must find nothing).
- [x] 2.2 Confirm no live code, test, or config file still imports or names the old module: run `grep -rn "@/middleware\|from \"@/middleware\"\|middleware.ts" app lib tests e2e scripts next.config.ts` and confirm only `openspec/changes/archive/**` still contains historical references.

## 3. Integration verification

- [x] 3.1 Verify the warning is gone with a clean build: `rm -rf .next && npm run build`. Confirm the output contains no `"middleware" file convention is deprecated` line and the route table still lists `ƒ Proxy (Middleware)`.
- [x] 3.2 Run the full suite and typecheck: `npm test` and `npx tsc --noEmit`. Confirm all tests pass and there are no type errors.
- [x] 3.3 Smoke-test the real request pipeline on the production build: run `npm start`, then confirm `curl -sI http://127.0.0.1:3000/login` returns `307` with `location: /zh-TW/login`, `curl -sI http://127.0.0.1:3000/zh-TW/rooms/a` returns `307` with `location: /zh-TW/login` and `cache-control: no-store`, and `curl -sI http://127.0.0.1:3000/en/admin` returns `307` with `location: /en/admin/login`. Stop the server afterwards.

## Workflow follow-up

- Run `openspec validate migrate-middleware-to-proxy --strict` after the tasks are complete.
- Archive the change once review requirements are satisfied and the build warning is confirmed absent.
