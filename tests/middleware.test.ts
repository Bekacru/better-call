import { describe, expect, expectTypeOf, it } from "vitest";
import { createEndpoint } from "../src/endpoints";
import { createMiddleware } from "../src/middleware";
import { APIError } from "../src/api-error";

describe("type", async () => {
  it("should infer context", () => {
    const middleware = createMiddleware(async (ctx) => {
      return {
        session: 1,
      };
    });
    createEndpoint(
      "/path",
      {
        method: "GET",
        use: [middleware],
      },
      async (ctx) => {
        expectTypeOf(ctx.context.session).toEqualTypeOf<number>();
      }
    );
  });

  it("should infer context with multiple middleware", () => {
    const middleware = createMiddleware(async (ctx) => {
      return {
        session: 1,
      };
    });
    const middleware2 = createMiddleware(async (ctx) => {
      return {
        user: "test",
      };
    });
    createEndpoint(
      "/path",
      {
        method: "GET",
        use: [middleware, middleware2],
      },
      async (ctx) => {
        expectTypeOf(ctx.context.session).toEqualTypeOf<number>();
        expectTypeOf(ctx.context.user).toEqualTypeOf<string>();
      }
    );
  });
});

describe("runtime", () => {
  it("should run middleware", async () => {
    const middleware = createMiddleware(async (ctx) => {
      return {
        session: 1,
      };
    });
    const endpoint = createEndpoint(
      "/path",
      {
        method: "GET",
        use: [middleware],
      },
      async (ctx) => {
        return ctx.context;
      }
    );
    const result = await endpoint();
    expect(result).toEqual({ session: 1 });
  });

  it("should run multiple middleware", async () => {
    const middleware = createMiddleware(async (ctx) => {
      return {
        session: 1,
      };
    });
    const middleware2 = createMiddleware(async (ctx) => {
      return {
        user: "test",
      };
    });
    const endpoint = createEndpoint(
      "/path",
      {
        method: "GET",
        use: [middleware, middleware2],
      },
      async (ctx) => {
        return ctx.context;
      }
    );
    const result = await endpoint();
    expect(result).toEqual({ session: 1, user: "test" });
  });

  it("should throw error", async () => {
    const middleware = createMiddleware(async (ctx) => {
      throw new APIError("test", 400);
    });
    const endpoint = createEndpoint(
      "/path",
      {
        method: "GET",
        use: [middleware],
      },
      async (ctx) => {
        return ctx.context;
      }
    );
    expect(endpoint()).rejects.toThrowError("test");
  });
});

describe("creator", () => {
  it("should infer from custom creator", async () => {
    const middleware = createMiddleware(async () => {
      return {
        something: "",
      };
    });

    const createCustomMiddleware = createMiddleware.creator({
      use: [middleware],
    });
    const customMiddleware = createCustomMiddleware(async (ctx) => {
      expectTypeOf(ctx.context.something).toEqualTypeOf<string>();
      return ctx.context;
    });
    //@ts-expect-error
    const result = await customMiddleware({
      context: {
        something: "test",
      },
    });
    expectTypeOf(result).toEqualTypeOf<{ something: string }>();
  });
});
