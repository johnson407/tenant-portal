import { expect, test, type Page } from "@playwright/test";

const roomACode = process.env.ROOM_CODE_A;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!roomACode || !adminPassword) {
  throw new Error("ROOM_CODE_A and ADMIN_PASSWORD are required for the browser checks");
}

async function loginTenant(page: Page, room: string, code: string) {
  await page.goto("/login");
  await page.locator('select[name="room"]').selectOption(room);
  await page.locator('input[name="code"]').fill(code);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`/rooms/${room}$`));
}

async function loginAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.locator('input[name="password"]').fill(adminPassword!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function sessionCookie(page: Page) {
  return (await page.context().cookies()).find((cookie) => cookie.name === "tp_session");
}

async function tabTo(page: Page, label: string) {
  for (let step = 0; step < 25; step += 1) {
    await page.keyboard.press("Tab");
    const activeText = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.textContent?.trim() ?? "",
    );
    if (activeText === label) return;
  }
  throw new Error(`Could not reach "${label}" with Tab`);
}

async function expectVisibleFocus(page: Page) {
  const focus = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    const style = element ? getComputedStyle(element) : null;
    return {
      tag: element?.tagName ?? null,
      boxShadow: style?.boxShadow ?? "none",
      outlineStyle: style?.outlineStyle ?? "none",
      outlineWidth: style?.outlineWidth ?? "0px",
    };
  });
  const hasRing = focus.boxShadow !== "none" && focus.boxShadow !== "";
  const hasOutline = focus.outlineStyle !== "none" && focus.outlineWidth !== "0px";
  expect(focus.tag).toBe("BUTTON");
  expect(hasRing || hasOutline).toBe(true);
}

test.describe("logout in a real browser", () => {
  test("logout, Back, and reload do not expose protected room data", async ({ page }) => {
    await loginTenant(page, "a", roomACode);
    await expect(page.getByRole("heading", { name: "Room A" })).toBeVisible();
    await expect(page.getByText("Rent - current month")).toBeVisible();

    const protectedResponse = await page.request.get("/rooms/a");
    expect(protectedResponse.headers()["cache-control"]).toContain("no-store");

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await sessionCookie(page)).toBeUndefined();

    await page.goBack();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("Rent - current month")).toHaveCount(0);

    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("Rent - current month")).toHaveCount(0);
  });

  test("keyboard focus is visible and Enter logs out from room, denial view, and admin", async ({
    page,
  }) => {
    await loginTenant(page, "a", roomACode);
    await tabTo(page, "Log out");
    await expectVisibleFocus(page);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/login$/);

    await loginTenant(page, "a", roomACode);
    await page.goto("/rooms/b");
    await expect(page.getByRole("heading", { name: "Not authorized" })).toBeVisible();
    await tabTo(page, "Log out");
    await expectVisibleFocus(page);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/login$/);

    await loginAdmin(page);
    await tabTo(page, "Log out");
    await expectVisibleFocus(page);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});

test.describe("logout without client-side JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("room, denial view, and admin forms submit and clear the session", async ({ page }) => {
    await loginTenant(page, "a", roomACode);
    await expect(page.getByText("Rent - current month")).toBeVisible();
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await sessionCookie(page)).toBeUndefined();

    await loginTenant(page, "a", roomACode);
    await page.goto("/rooms/b");
    await expect(page.getByRole("heading", { name: "Not authorized" })).toBeVisible();
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await loginAdmin(page);
    await expect(page.getByRole("heading", { name: "Room access codes" })).toBeVisible();
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    expect(await sessionCookie(page)).toBeUndefined();
  });
});
