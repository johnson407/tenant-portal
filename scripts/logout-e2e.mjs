#!/usr/bin/env node
/**
 * End-to-end logout check against a running local server.
 *
 * The portal uses Server Actions, so this script drives the same progressive-
 * enhancement form POSTs a browser without JavaScript would send: it reads the
 * hidden action fields from the rendered form, posts them with a cookie jar,
 * and checks the resulting redirects and Set-Cookie headers.
 *
 * Usage:
 *   ROOM_CODE_A=... ROOM_CODE_B=... ADMIN_PASSWORD=... \
 *     BASE_URL=http://localhost:3000 node scripts/logout-e2e.mjs
 *
 * The target server must be configured with KV_REST_API_URL/KV_REST_API_TOKEN,
 * SESSION_SECRET, the room code hashes, and ADMIN_PASSWORD. Passwords/codes are
 * read from the environment and never logged.
 */

const base = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(2);
  }
  return value;
}

const roomACode = required("ROOM_CODE_A");
const roomBCode = required("ROOM_CODE_B");
const adminPassword = required("ADMIN_PASSWORD");

let checks = 0;

function check(name, condition, detail = "") {
  if (!condition) {
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
    process.exit(1);
  }
  checks += 1;
  console.log(`✓ ${name}`);
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  has(name) {
    return this.cookies.has(name);
  }

  value(name) {
    return this.cookies.get(name) ?? null;
  }

  set(name, value) {
    this.cookies.set(name, value);
  }

  header() {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  capture(response) {
    const headers = response.headers;
    const setCookies = typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [headers.get("set-cookie")].filter(Boolean);
    for (const setCookie of setCookies) {
      const [pair, ...attributes] = setCookie.split(";");
      const separator = pair.indexOf("=");
      if (separator < 0) continue;
      const name = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      const maxAge = attributes
        .map((attribute) => attribute.trim())
        .find((attribute) => attribute.toLowerCase().startsWith("max-age="));
      const expired = maxAge ? Number(maxAge.split("=")[1]) <= 0 : false;
      if (expired || value === "") {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
    return setCookies.join("\n");
  }
}

function decodeHtml(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`));
  return match ? decodeHtml(match[1]) : null;
}

function formContaining(html, marker) {
  const forms = html.match(/<form[\s\S]*?<\/form>/g) ?? [];
  const form = forms.find((candidate) => candidate.includes(marker));
  if (!form) throw new Error(`No form containing ${marker} was rendered`);
  return form;
}

function hiddenFields(form) {
  return [...form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)]
    .map((match) => {
      const name = attribute(match[0], "name");
      if (!name) return null;
      return [name, attribute(match[0], "value") ?? ""];
    })
    .filter(Boolean);
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${base}/login`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not become ready at ${base}`);
}

async function kvGet(key) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return { available: false, value: undefined };
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(["get", key]),
  });
  const body = await response.json();
  return { available: true, value: body.result };
}

async function get(jar, path) {
  const response = await fetch(`${base}${path}`, {
    headers: jar.header() ? { cookie: jar.header() } : {},
    redirect: "manual",
  });
  jar.capture(response);
  return response;
}

async function submit(path, fields, jar) {
  const body = new FormData();
  for (const [name, value] of fields) body.set(name, value);
  const headers = { origin: base };
  if (jar.header()) headers.cookie = jar.header();
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers,
    body,
    redirect: "manual",
  });
  jar.capture(response);
  return response;
}

async function login(jar, room, code) {
  const page = await get(jar, "/en/login");
  const form = formContaining(await page.text(), 'name="room"');
  const fields = [...hiddenFields(form), ["room", room], ["code", code]];
  return submit("/en/login", fields, jar);
}

async function loginAdmin(jar) {
  const page = await get(jar, "/en/admin/login");
  const form = formContaining(await page.text(), 'name="password"');
  const fields = [...hiddenFields(form), ["password", adminPassword]];
  return submit("/en/admin/login", fields, jar);
}

function locationOf(response) {
  const location = response.headers.get("location");
  return location ? new URL(location, base).pathname : null;
}

function assertExpiry(setCookie, label) {
  check(`${label}: expires tp_session`, /(?:^|\n)tp_session=;/.test(setCookie) || setCookie.includes("tp_session=;"));
  check(`${label}: sets Max-Age=0`, /Max-Age=0/i.test(setCookie));
  check(`${label}: keeps Path=/`, /Path=\//i.test(setCookie));
  check(`${label}: keeps HttpOnly`, /HttpOnly/i.test(setCookie));
  check(`${label}: keeps SameSite=lax`, /SameSite=lax/i.test(setCookie));
}

const tenantJar = new CookieJar();

await waitForServer();

// Locale routing smoke checks: bare paths default to zh-TW, /en is explicit.
let localeResponse = await fetch(`${base}/login`, { redirect: "manual" });
check(
  "bare /login redirects to the default locale",
  localeResponse.status === 307 && locationOf(localeResponse) === "/zh-TW/login",
);
localeResponse = await fetch(`${base}/zh-TW/login`, { redirect: "manual" });
check(
  "zh-TW login renders Traditional Chinese",
  localeResponse.status === 200 && (await localeResponse.text()).includes("租客登入"),
);
localeResponse = await fetch(`${base}/en/login`, { redirect: "manual" });
check(
  "en login renders English",
  localeResponse.status === 200 && (await localeResponse.text()).includes("Tenant sign in"),
);

// Tenant A signs in and sees the control.
let response = await login(tenantJar, "a", roomACode);
check("tenant A login redirects to /rooms/a", response.status === 303 && locationOf(response) === "/en/rooms/a");
check("tenant A receives a session cookie", tenantJar.has("tp_session"));

response = await get(tenantJar, "/en/rooms/a");
let html = await response.text();
check("tenant A dashboard is served", response.status === 200 && !html.includes("Not authorized"));
check("authorized dashboard renders Log out", html.includes("Log out"));
check(
  "authorized dashboard is not cacheable",
  (response.headers.get("cache-control") ?? "").includes("no-store"),
);

const preLogoutToken = tenantJar.value("tp_session");
const versionBefore = await kvGet("room:a:session-version");
const hashBefore = await kvGet("room:a");
check("KV access is available for the state assertions", versionBefore.available && hashBefore.available);
check("pre-logout tenant token was captured", Boolean(preLogoutToken));

// Tenant A logs out.
let fields = hiddenFields(formContaining(html, "Log out"));
response = await submit("/en/rooms/a", fields, tenantJar);
let setCookie = response.headers.getSetCookie?.().join("\n") ?? response.headers.get("set-cookie") ?? "";
check("tenant logout redirects to /login", response.status === 303 && locationOf(response) === "/en/login");
if (!setCookie.includes("tp_session=")) throw new Error("Logout response did not set tp_session");
assertExpiry(setCookie, "tenant logout");
check("tenant cookie was removed from the browser", !tenantJar.has("tp_session"));
check(
  "tenant logout redirect is not cacheable",
  (response.headers.get("cache-control") ?? "").includes("no-store"),
);

response = await get(tenantJar, "/en/rooms/a");
check(
  "room page redirects to /login after logout",
  response.status === 307 && locationOf(response) === "/en/login",
);

const versionAfter = await kvGet("room:a:session-version");
const hashAfter = await kvGet("room:a");
check(
  "logout leaves the room session version unchanged",
  JSON.stringify(versionAfter.value) === JSON.stringify(versionBefore.value),
  `${JSON.stringify(versionBefore.value)} -> ${JSON.stringify(versionAfter.value)}`,
);
check(
  "logout leaves the stored room code hash unchanged",
  JSON.stringify(hashAfter.value) === JSON.stringify(hashBefore.value),
);

// A token copied before logout stays valid: logout is browser-local.
const copiedJar = new CookieJar();
copiedJar.set("tp_session", preLogoutToken);
response = await get(copiedJar, "/en/rooms/a");
html = await response.text();
check(
  "a copied pre-logout token still reaches /rooms/a",
  response.status === 200 && !html.includes("Not authorized"),
);

// Admin signs in and logs out.
const adminJar = new CookieJar();
response = await loginAdmin(adminJar);
check("admin login redirects to /admin", response.status === 303 && locationOf(response) === "/en/admin");
check("admin receives a session cookie", adminJar.has("tp_session"));

response = await get(adminJar, "/en/admin");
html = await response.text();
check("admin page is served", response.status === 200);
check("admin page renders heading and Log out", html.includes("Room access codes") && html.includes("Log out"));
check("admin page is not cacheable", (response.headers.get("cache-control") ?? "").includes("no-store"));

fields = hiddenFields(formContaining(html, "Log out"));
response = await submit("/en/admin", fields, adminJar);
setCookie = response.headers.getSetCookie?.().join("\n") ?? response.headers.get("set-cookie") ?? "";
check(
  "admin logout redirects to /admin/login",
  response.status === 303 && locationOf(response) === "/en/admin/login",
);
assertExpiry(setCookie, "admin logout");
check("admin cookie was removed from the browser", !adminJar.has("tp_session"));
check(
  "admin logout redirect is not cacheable",
  (response.headers.get("cache-control") ?? "").includes("no-store"),
);

response = await get(adminJar, "/en/admin");
check(
  "admin page redirects to /admin/login after logout",
  response.status === 307 && locationOf(response) === "/en/admin/login",
);

// Room B signs in on the same browser after room A logged out.
response = await login(tenantJar, "b", roomBCode);
check("room B login redirects to /rooms/b", response.status === 303 && locationOf(response) === "/en/rooms/b");
check("room B receives a fresh session cookie", tenantJar.has("tp_session"));

response = await get(tenantJar, "/en/rooms/b");
html = await response.text();
check("room B dashboard is served", response.status === 200 && !html.includes("Not authorized"));
check("room B dashboard shows room B data only", html.includes("$700.00") && !html.includes("$750.00"));

response = await get(tenantJar, "/en/rooms/a");
html = await response.text();
check(
  "room B cannot view room A",
  html.includes("Not authorized") && !html.includes("$750.00"),
);

// GET /en/logout is not a route and must not clear the current cookie.
const logoutGet = await get(tenantJar, "/en/logout");
const logoutGetCookie = logoutGet.headers.getSetCookie?.().join("\n") ?? logoutGet.headers.get("set-cookie") ?? "";
check("GET /en/logout returns 404", logoutGet.status === 404);
check("GET /en/logout does not clear tp_session", !logoutGetCookie.includes("tp_session="));
check("GET /en/logout leaves the room B session intact", tenantJar.has("tp_session"));

console.log(`\nLogout E2E passed: ${checks} checks.`);
