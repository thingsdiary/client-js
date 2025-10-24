import { describe, it, expect } from "vitest";
import { USER_AGENT } from "@/user-agent";

describe("USER_AGENT", () => {
  it("should have correct format", () => {
    expect(USER_AGENT).toMatch(/^thingsdiary-client\/\d+\.\d+\.\d+/);
  });

  it("should include version", () => {
    expect(USER_AGENT).toContain(__VERSION__);
  });

  it("should detect Node.js environment in tests", () => {
    expect(USER_AGENT).toMatch(/node\/v\d+\.\d+\.\d+/);
    expect(USER_AGENT).toContain("(node/");
  });

  it("should include platform and architecture", () => {
    expect(USER_AGENT).toContain(process.platform);
    expect(USER_AGENT).toContain(process.arch);
  });

  it("should be computed once (same reference)", () => {
    const ua1 = USER_AGENT;
    const ua2 = USER_AGENT;
    expect(ua1).toBe(ua2);
  });
});
