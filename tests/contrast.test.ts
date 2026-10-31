import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Tailwind v4 palette values (hex) for every colour used by the audited views.
const COLOURS = {
  "slate-50": "#f8fafc",
  "slate-100": "#f1f5f9",
  "slate-200": "#e2e8f0",
  "slate-300": "#cbd5e1",
  "slate-400": "#94a3b8",
  "slate-500": "#64748b",
  "slate-600": "#475569",
  "slate-700": "#334155",
  "slate-800": "#1e293b",
  "slate-900": "#0f172a",
  "slate-950": "#020617",
  "amber-50": "#fffbeb",
  "amber-200": "#fde68a",
  "amber-500": "#f59e0b",
  "amber-900": "#78350f",
  "red-400": "#f87171",
  "red-700": "#b91c1c",
  white: "#ffffff",
  // Body foreground values from app/globals.css (not Tailwind palette entries).
  "inherited-dark": "#ededed",
  "inherited-light": "#171717",
} as const;

type Colour = keyof typeof COLOURS;

function channel(hex: string, offset: number): number {
  return Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
}

function linearize(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

// WCAG 2.1 relative luminance: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
function relativeLuminance(colour: Colour): number {
  const hex = COLOURS[colour];
  return (
    0.2126 * linearize(channel(hex, 1)) +
    0.7152 * linearize(channel(hex, 3)) +
    0.0722 * linearize(channel(hex, 5))
  );
}

// WCAG 2.1 contrast ratio: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
function contrastRatio(a: Colour, b: Colour): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

function ratio(a: Colour, b: Colour): number {
  return Math.round(contrastRatio(a, b) * 100) / 100;
}

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

function readSource(file: string): string {
  return readFileSync(join(repoRoot, file), "utf8");
}

function sourceHas(file: string, snippet: string): void {
  expect(readSource(file), `${file} should contain ${JSON.stringify(snippet)}`).toContain(snippet);
}

function sourceLacks(file: string, snippet: string): void {
  expect(readSource(file), `${file} should not contain ${JSON.stringify(snippet)}`).not.toContain(
    snippet,
  );
}

function sourceCount(file: string, snippet: string): number {
  return readSource(file).split(snippet).length - 1;
}

describe("WCAG contrast helpers", () => {
  it("computes the canonical white-on-slate-950 ratio", () => {
    expect(ratio("white", "slate-950")).toBe(20.17);
  });
});

describe("source assertion helpers", () => {
  it("passes for a known present string and a known absent string", () => {
    sourceHas("package.json", '"name": "tenant-portal"');
    sourceLacks("package.json", "this-string-is-not-present-in-this-repo");
  });
});

type TextPair = { label: string; fg: Colour; bg: Colour; expected: number };
type NonTextPair = TextPair;

const LOGIN_TEXT_PAIRS: TextPair[] = [
  { label: "login footer slate-300 on slate-900", fg: "slate-300", bg: "slate-900", expected: 12.02 },
  { label: "login Admin-area hover white on slate-900", fg: "white", bg: "slate-900", expected: 17.85 },
  { label: "login heading slate-100 on slate-900", fg: "slate-100", bg: "slate-900", expected: 16.3 },
  { label: "login subtitle slate-400 on slate-900", fg: "slate-400", bg: "slate-900", expected: 6.96 },
  { label: "login label slate-300 on slate-900", fg: "slate-300", bg: "slate-900", expected: 12.02 },
  { label: "login input text slate-100 on slate-950", fg: "slate-100", bg: "slate-950", expected: 18.41 },
  { label: "login placeholder slate-400 on slate-950", fg: "slate-400", bg: "slate-950", expected: 7.87 },
  { label: "login button slate-950 on slate-100", fg: "slate-950", bg: "slate-100", expected: 18.41 },
  { label: "login error red-400 on slate-900", fg: "red-400", bg: "slate-900", expected: 6.45 },
];

const LOGIN_CONTROL_PAIRS: NonTextPair[] = [
  { label: "login border slate-500 on slate-950", fg: "slate-500", bg: "slate-950", expected: 4.24 },
  { label: "login border slate-500 on slate-900", fg: "slate-500", bg: "slate-900", expected: 3.75 },
  { label: "login focus ring slate-300 on slate-950", fg: "slate-300", bg: "slate-950", expected: 13.59 },
  { label: "login focus ring slate-300 on slate-900", fg: "slate-300", bg: "slate-900", expected: 12.02 },
];

describe("tenant sign-in page", () => {
  it.each(LOGIN_TEXT_PAIRS)("$label meets 4.5:1", ({ fg, bg, expected }) => {
    expect(ratio(fg, bg)).toBe(expected);
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(LOGIN_CONTROL_PAIRS)("$label meets 3:1", ({ fg, bg, expected }) => {
    expect(ratio(fg, bg)).toBe(expected);
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(3);
  });

  it("uses the accessible footer, link hover, and form-control classes", () => {
    sourceHas("app/[lang]/login/page.tsx", "text-xs text-slate-300");
    sourceHas("app/[lang]/login/page.tsx", "underline hover:text-white");
    sourceLacks("app/[lang]/login/page.tsx", "text-xs text-slate-500");
    sourceLacks("app/[lang]/login/page.tsx", "hover:text-slate-300");

    sourceHas("app/[lang]/login/login-form.tsx", "focus:ring-2 focus:ring-slate-300");
    sourceHas("app/[lang]/login/login-form.tsx", "placeholder:text-slate-400");
    sourceHas("app/[lang]/login/login-form.tsx", "focus:border-slate-400");
    sourceLacks("app/[lang]/login/login-form.tsx", "focus:outline-none");
    sourceLacks("app/[lang]/login/login-form.tsx", "border-slate-700");
    expect(sourceCount("app/[lang]/login/login-form.tsx", "border border-slate-500")).toBe(2);
    expect(sourceCount("app/[lang]/login/login-form.tsx", "focus:ring-2 focus:ring-slate-300")).toBe(2);
  });
});

const ROOM_TEXT_PAIRS: TextPair[] = [
  { label: "room heading slate-900 on slate-100", fg: "slate-900", bg: "slate-100", expected: 16.3 },
  { label: "room section heading slate-800 on slate-100", fg: "slate-800", bg: "slate-100", expected: 13.35 },
  { label: "room section heading slate-800 on white", fg: "slate-800", bg: "white", expected: 14.63 },
  { label: "room bill/payment row slate-900 on white", fg: "slate-900", bg: "white", expected: 17.85 },
  { label: "room lease value slate-900 on white", fg: "slate-900", bg: "white", expected: 17.85 },
  { label: "room (sample data) slate-700 on slate-100", fg: "slate-700", bg: "slate-100", expected: 9.45 },
  { label: "room lease label slate-700 on white", fg: "slate-700", bg: "white", expected: 10.35 },
  { label: "room body slate-900 on slate-100", fg: "slate-900", bg: "slate-100", expected: 16.3 },
  { label: "room light-mode inherited #171717 on slate-100", fg: "inherited-light", bg: "slate-100", expected: 16.36 },
  { label: "room light-mode inherited #171717 on white", fg: "inherited-light", bg: "white", expected: 17.93 },
];

const ROOM_INHERITANCE_FAILURES: TextPair[] = [
  { label: "room dark-mode inherited #ededed on white", fg: "inherited-dark", bg: "white", expected: 1.17 },
  { label: "room dark-mode inherited #ededed on slate-100", fg: "inherited-dark", bg: "slate-100", expected: 1.07 },
];

describe("room dashboard", () => {
  it.each(ROOM_TEXT_PAIRS)("$label meets 4.5:1", ({ fg, bg, expected }) => {
    expect(ratio(fg, bg)).toBe(expected);
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(ROOM_INHERITANCE_FAILURES)("$label is why the page declares slate-900", ({ fg, bg, expected }) => {
    expect(ratio(fg, bg)).toBe(expected);
    expect(ratio(fg, bg)).toBeLessThan(4.5);
  });

  it("darkens the decorative card border from slate-200 to slate-300", () => {
    expect(ratio("slate-200", "white")).toBe(1.23);
    expect(ratio("slate-300", "white")).toBe(1.48);
    expect(ratio("slate-300", "white")).toBeGreaterThan(ratio("slate-200", "white"));
  });

  it("declares an explicit foreground on the page and each card", () => {
    const file = "app/[lang]/rooms/[room]/page.tsx";

    sourceHas(file, "min-h-screen bg-slate-100 px-4 py-10 text-slate-900");
    expect(
      sourceCount(
        file,
        "divide-y divide-slate-300 rounded border border-slate-300 bg-white text-slate-900",
      ),
    ).toBe(2);
    sourceHas(file, "rounded border border-slate-300 bg-white p-4 text-slate-900");

    expect(sourceCount(file, "text-sm font-normal text-slate-700")).toBe(3);
    expect(sourceCount(file, "text-xs text-slate-700")).toBe(3);
    sourceLacks(file, "text-slate-500");
    sourceLacks(file, "border-slate-200");
    sourceLacks(file, "divide-slate-200");
  });
});

const ADMIN_LOGIN_TEXT_PAIRS: TextPair[] = [
  { label: "admin login heading slate-100 on slate-900", fg: "slate-100", bg: "slate-900", expected: 16.3 },
  { label: "admin login subtitle slate-400 on slate-900", fg: "slate-400", bg: "slate-900", expected: 6.96 },
  { label: "admin login label slate-300 on slate-900", fg: "slate-300", bg: "slate-900", expected: 12.02 },
  { label: "admin login error red-400 on slate-900", fg: "red-400", bg: "slate-900", expected: 6.45 },
  { label: "admin login button slate-950 on slate-100", fg: "slate-950", bg: "slate-100", expected: 18.41 },
  { label: "admin login input text slate-100 on slate-950", fg: "slate-100", bg: "slate-950", expected: 18.41 },
];

const ADMIN_LOGIN_CONTROL_PAIRS: NonTextPair[] = [
  { label: "admin login border slate-500 on slate-950", fg: "slate-500", bg: "slate-950", expected: 4.24 },
  { label: "admin login border slate-500 on slate-900", fg: "slate-500", bg: "slate-900", expected: 3.75 },
  { label: "admin login focus ring slate-300 on slate-950", fg: "slate-300", bg: "slate-950", expected: 13.59 },
  { label: "admin login focus ring slate-300 on slate-900", fg: "slate-300", bg: "slate-900", expected: 12.02 },
];

describe("admin sign-in page", () => {
  it.each(ADMIN_LOGIN_TEXT_PAIRS)("$label meets 4.5:1", ({ fg, bg, expected }) => {
    expect(ratio(fg, bg)).toBe(expected);
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(ADMIN_LOGIN_CONTROL_PAIRS)("$label meets 3:1", ({ fg, bg, expected }) => {
    expect(ratio(fg, bg)).toBe(expected);
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(3);
  });

  it("uses the accessible password-input classes", () => {
    const file = "app/[lang]/admin/login/admin-login-form.tsx";

    sourceHas(file, "border border-slate-500");
    sourceHas(file, "focus:border-slate-400 focus:ring-2 focus:ring-slate-300");
    sourceLacks(file, "focus:outline-none");
    sourceLacks(file, "border-slate-700");
    expect(sourceCount(file, "border border-slate-500")).toBe(1);
    expect(sourceCount(file, "focus:ring-2 focus:ring-slate-300")).toBe(1);
  });
});

const ADMIN_RESET_TEXT_PAIRS: TextPair[] = [
  { label: "reset label slate-300 on slate-900", fg: "slate-300", bg: "slate-900", expected: 12.02 },
  { label: "reset field text slate-100 on slate-950", fg: "slate-100", bg: "slate-950", expected: 18.41 },
  { label: "reset placeholder slate-400 on slate-950", fg: "slate-400", bg: "slate-950", expected: 7.87 },
  { label: "reset error red-400 on slate-900", fg: "red-400", bg: "slate-900", expected: 6.45 },
  { label: "reset submit button slate-950 on slate-100", fg: "slate-950", bg: "slate-100", expected: 18.41 },
  { label: "reset success panel slate-900 on amber-50", fg: "slate-900", bg: "amber-50", expected: 17.22 },
  { label: "reset success code slate-900 on white", fg: "slate-900", bg: "white", expected: 17.85 },
  { label: "reset success warning red-700 on amber-50", fg: "red-700", bg: "amber-50", expected: 6.24 },
  { label: "reset another-room control slate-600 on amber-50", fg: "slate-600", bg: "amber-50", expected: 7.31 },
  { label: "reset Copy button white on slate-900", fg: "white", bg: "slate-900", expected: 17.85 },
];

const ADMIN_RESET_CONTROL_PAIRS: NonTextPair[] = [
  { label: "reset border slate-500 on slate-950", fg: "slate-500", bg: "slate-950", expected: 4.24 },
  { label: "reset border slate-500 on slate-900", fg: "slate-500", bg: "slate-900", expected: 3.75 },
  { label: "reset focus ring slate-300 on slate-950", fg: "slate-300", bg: "slate-950", expected: 13.59 },
  { label: "reset focus ring slate-300 on slate-900", fg: "slate-300", bg: "slate-900", expected: 12.02 },
];

describe("admin reset page", () => {
  it.each(ADMIN_RESET_TEXT_PAIRS)("$label meets 4.5:1", ({ fg, bg, expected }) => {
    expect(ratio(fg, bg)).toBe(expected);
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(ADMIN_RESET_CONTROL_PAIRS)("$label meets 3:1", ({ fg, bg, expected }) => {
    expect(ratio(fg, bg)).toBe(expected);
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(3);
  });

  it("uses the accessible select and code-input classes", () => {
    const file = "app/[lang]/admin/reset-form.tsx";

    sourceHas(file, "border border-slate-500");
    sourceHas(file, "focus:border-slate-400 focus:ring-2 focus:ring-slate-300");
    sourceHas(file, "placeholder:text-slate-400");
    sourceLacks(file, "focus:outline-none");
    sourceLacks(file, "border-slate-700");
    expect(sourceCount(file, "border border-slate-500")).toBe(2);
    expect(sourceCount(file, "focus:ring-2 focus:ring-slate-300")).toBe(2);
    expect(sourceCount(file, "placeholder:text-slate-400")).toBe(1);
  });

  it("leaves the reset-success panel colours unchanged", () => {
    const file = "app/[lang]/admin/reset-form.tsx";

    sourceHas(file, "rounded-lg border border-amber-500 bg-amber-50 p-6 text-slate-900");
    sourceHas(file, "text-sm font-medium text-red-700");
    sourceHas(file, "text-sm text-slate-600 underline hover:text-slate-900");
    sourceHas(file, "rounded bg-slate-900 px-3 py-2 text-sm text-white");
  });
});

describe("pre-fix ratios documented in the design table", () => {
  it.each([
    { label: "login footer slate-500 on slate-900", fg: "slate-500" as Colour, bg: "slate-900" as Colour, expected: 3.75 },
    { label: "room (sample data) slate-500 on slate-100", fg: "slate-500" as Colour, bg: "slate-100" as Colour, expected: 4.34 },
  ])("$label was below 4.5:1", ({ fg, bg, expected }) => {
    expect(ratio(fg, bg)).toBe(expected);
    expect(ratio(fg, bg)).toBeLessThan(4.5);
  });

  it("room lease label slate-500 on white only just met 4.5:1", () => {
    expect(ratio("slate-500", "white")).toBe(4.76);
  });

  it.each([
    { label: "login/admin input border slate-700 on slate-900", fg: "slate-700" as Colour, bg: "slate-900" as Colour, expected: 1.72 },
    { label: "login/admin input border slate-700 on slate-950", fg: "slate-700" as Colour, bg: "slate-950" as Colour, expected: 1.95 },
  ])("$label was below 3:1", ({ fg, bg, expected }) => {
    expect(ratio(fg, bg)).toBe(expected);
    expect(ratio(fg, bg)).toBeLessThan(3);
  });
});
