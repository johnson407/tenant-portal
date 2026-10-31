// Vitest resolves the Next.js `server-only` marker to this empty module. The
// production build still uses Next's own resolution, and the boundary tests
// assert that server-only modules keep the import.
export {};
