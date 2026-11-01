import { describe, expect, it } from "vitest";
import { maskBankLast5 } from "@/lib/mask";

describe("maskBankLast5", () => {
  it("keeps only the last two digits for the tenant view", () => {
    expect(maskBankLast5("01234")).toBe("•••34");
    expect(maskBankLast5("06789")).toBe("•••89");
  });
});
