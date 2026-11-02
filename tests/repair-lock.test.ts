import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  set: vi.fn(),
  createScript: vi.fn(),
  evalScript: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: class {
    set(...args: unknown[]) {
      return mocks.set(...args);
    }

    createScript(script: string) {
      mocks.createScript(script);
      return {
        eval: (...args: unknown[]) => mocks.evalScript(...args),
      };
    }
  },
}));

import { acquireRepairLock } from "@/lib/appfeed/repair-lock";

describe("acquireRepairLock", () => {
  beforeEach(() => {
    vi.stubEnv("KV_REST_API_URL", "https://kv.example.test");
    vi.stubEnv("KV_REST_API_TOKEN", "test-token");
    mocks.set.mockReset();
    mocks.createScript.mockReset();
    mocks.evalScript.mockReset();
  });

  it("uses a per-owner token, a bounded lease, and compare-and-delete release", async () => {
    mocks.set.mockResolvedValue("OK");
    mocks.evalScript.mockResolvedValue(1);

    const release = await acquireRepairLock("0123456789abcdef");

    expect(release).not.toBeNull();
    const [key, token, options] = mocks.set.mock.calls[0];
    expect(key).toBe("repair:update:0123456789abcdef");
    expect(token).toMatch(/^[0-9a-f-]{36}$/);
    expect(options).toEqual({ nx: true, ex: 120 });

    await release?.();

    expect(mocks.createScript.mock.calls[0][0]).toContain(
      "redis.call('get', KEYS[1]) == ARGV[1]",
    );
    expect(mocks.evalScript).toHaveBeenCalledWith(
      [key],
      [token],
    );
  });

  it("does not create a release action when another update owns the lock", async () => {
    mocks.set.mockResolvedValue(null);

    await expect(acquireRepairLock("0123456789abcdef")).resolves.toBeNull();
    expect(mocks.createScript).not.toHaveBeenCalled();
  });
});
