import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("app module global scope behavior", () => {
  it("does not call crypto.randomUUID during module initialization", async () => {
    const webCrypto = (globalThis as typeof globalThis & {
      crypto: { randomUUID: () => string };
    }).crypto;
    const randomUuidSpy = vi.spyOn(webCrypto, "randomUUID").mockImplementation(() => {
      throw new Error("randomUUID should not be called during module initialization");
    });

    await expect(import("./app")).resolves.toHaveProperty("app");
    expect(randomUuidSpy).not.toHaveBeenCalled();
  });
});
