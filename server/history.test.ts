import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock user for testing
const mockUser = {
  id: 1,
  openId: "test-user-123",
  name: "Test User",
  email: "test@example.com",
  role: "user" as const,
  loginMethod: "oauth",
  lastSignedIn: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("History Router", () => {
  it("should return empty list for unauthenticated user", async () => {
    const ctx: TrpcContext = {
      req: {} as any,
      res: {} as any,
      user: null,
    };

    const caller = appRouter.createCaller(ctx);
    const result = await caller.history.list({ limit: 10, offset: 0 });

    expect(result).toEqual({ items: [], total: 0 });
  });

  it("should require authentication for delete", async () => {
    const ctx: TrpcContext = {
      req: {} as any,
      res: {} as any,
      user: null,
    };

    const caller = appRouter.createCaller(ctx);

    await expect(caller.history.delete({ id: 1 })).rejects.toThrow();
  });

  it("should allow authenticated user to access list", async () => {
    const ctx: TrpcContext = {
      req: {} as any,
      res: {} as any,
      user: mockUser,
    };

    const caller = appRouter.createCaller(ctx);
    const result = await caller.history.list({ limit: 10, offset: 0 });

    // Should return array (may be empty if no data)
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.items)).toBe(true);
  });
});
