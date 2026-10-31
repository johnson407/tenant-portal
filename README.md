# Tenant Portal

Room-number login (A-E plus a code). No tenant personal info stored.

The portal is locale-prefixed: Traditional Chinese (`/zh-TW/...`) is the
default and English (`/en/...`) is also available. Bare paths such as `/login`
redirect to the default locale. UI copy and formatting live in `lib/i18n/`.

## Local development

```bash
cp .env.example .env.local   # then fill in the values
npm run dev:kv               # in-memory Upstash-compatible KV on 127.0.0.1:8081
npm run dev                  # http://localhost:3000
```

For local previews without an Upstash account, point `KV_REST_API_URL` at the
mock (`http://127.0.0.1:8081`) and set `KV_REST_API_TOKEN` to any non-empty
value. The mock keeps everything in memory and has no auth or persistence, so
never use it outside local development. Set `LOCAL_KV_PORT` to change the port.

If you generate hashes with `node scripts/hash-codes.mjs`, escape the `$` in
`.env` values (`\$2b\$12\$...`). Next.js expands `$NAME`, which otherwise
mangles the hash.
