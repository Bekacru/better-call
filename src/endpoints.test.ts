import { z } from "zod";
import { createEndpoint } from "./endpoints";
import { describe, it, expectTypeOf, expect } from "vitest";
import { createMiddleware } from "./middleware";

describe("types", async () => {
  it("body", async () => {
    createEndpoint(
      "/test",
      {
        method: "GET",
        body: z.object({
          name: z.string(),
        }),
      },
      async (ctx) => {
        expectTypeOf(ctx.body).toEqualTypeOf<{ name: string }>();
      }
    );

    createEndpoint(
      "/test",
      {
        method: "GET",
        body: z.object({
          name: z.string().optional(),
        }),
      },
      async (ctx) => {
        expectTypeOf(ctx.body).toEqualTypeOf<{ name?: string }>();
      }
    );

    createEndpoint(
      "/test",
      {
        method: "GET",
        body: z
          .object({
            name: z.string(),
          })
          .optional(),
      },
      async (ctx) => {
        expectTypeOf(ctx.body).toEqualTypeOf<{ name: string } | undefined>();
      }
    );
  });

  it("query", async () => {
    createEndpoint(
      "/test",
      {
        method: "GET",
        query: z.object({
          name: z.string(),
        }),
      },
      async (ctx) => {
        expectTypeOf(ctx.query).toEqualTypeOf<{ name: string }>();
      }
    );

    createEndpoint(
      "/test",
      {
        method: "GET",
        query: z.object({
          name: z.string().optional(),
        }),
      },
      async (ctx) => {
        expectTypeOf(ctx.query).toEqualTypeOf<{ name?: string }>();
      }
    );

    createEndpoint(
      "/test",
      {
        method: "GET",
        query: z.optional(
          z.object({
            name: z.string(),
          })
        ),
      },
      async (ctx) => {
        expectTypeOf(ctx.query).toEqualTypeOf<{ name: string } | undefined>();
      }
    );
  });

  it("params", async () => {
    createEndpoint(
      "/:id",
      {
        method: "GET",
      },
      async (ctx) => {
        expectTypeOf(ctx.params).toEqualTypeOf<{ id: string }>();
      }
    );

    createEndpoint(
      "/leading-path/:id",
      {
        method: "GET",
      },
      async (ctx) => {
        expectTypeOf(ctx.params).toEqualTypeOf<{ id: string }>();
      }
    );

    createEndpoint(
      "/leading-path/:id/:name",
      {
        method: "GET",
      },
      async (ctx) => {
        ctx.params;
        expectTypeOf(ctx.params).toEqualTypeOf<{ id: string; name: string }>();
      }
    );
  });

  it("wildcard params", async () => {
    createEndpoint(
      "/api/*",
      {
        method: "GET",
      },
      async (ctx) => {
        expectTypeOf(ctx.params).toEqualTypeOf<{ _: string }>();
      }
    );

    createEndpoint(
      "/api/:id/*",
      {
        method: "GET",
      },
      async (ctx) => {
        expectTypeOf(ctx.params).toEqualTypeOf<{ _: string; id: string }>();
      }
    );
  });

  it("method", async () => {
    createEndpoint(
      "/test",
      {
        method: "GET",
      },
      async (ctx) => {
        expectTypeOf(ctx.method).toEqualTypeOf<"GET">();
      }
    );

    createEndpoint(
      "/test",
      {
        method: ["POST", "GET"],
      },
      async (ctx) => {
        expectTypeOf(ctx.method).toEqualTypeOf<"POST" | "GET">();
      }
    );
  });

  it("response", async () => {
    const endpoint1 = createEndpoint(
      "/test",
      {
        method: "GET",
      },
      async (ctx) => {
        return ctx.json({ name: "test" });
      }
    );
    const jsonResponse1 = await endpoint1();
    expectTypeOf(jsonResponse1).toEqualTypeOf<{ name: string }>();
    const objResponse1 = await endpoint1({ asResponse: true });
    expectTypeOf(objResponse1).toEqualTypeOf<Response>();
  });
});

describe("validation", async () => {
  it("should validate body", async () => {
    const endpoint = createEndpoint(
      "/test",
      {
        method: "GET",
        body: z.object({
          name: z.string(),
        }),
      },
      async (ctx) => {
        return ctx.json({ name: ctx.body.name });
      }
    );

    expect(
      endpoint({
        //@ts-expect-error
        body: { name: 1 },
      })
    ).rejects.toThrowError(
      `Validation error: Expected string, received number at "name"`
    );
  });

  it("should validate query", async () => {
    const endpoint = createEndpoint(
      "/test",
      {
        method: "GET",
        query: z.object({
          name: z.string(),
        }),
      },
      async (ctx) => {
        return ctx.json({ name: ctx.query.name });
      }
    );

    expect(
      endpoint({
        //@ts-expect-error
        query: { name: 1 },
      })
    ).rejects.toThrowError(
      `Validation error: Expected string, received number at "name"`
    );
  });

  it("should require headers", async () => {
    const endpoint = createEndpoint(
      "/test",
      {
        method: "GET",
        body: z.object({
          name: z.string(),
        }),
        requireHeaders: true,
      },
      async (ctx) => {
        return ctx.json({ name: ctx.body.name });
      }
    );
    expect(
      //@ts-expect-error
      endpoint({
        body: { name: "test" },
      })
    ).rejects.toThrowError("Validation Error: Headers are required");
  });
  it("should require request", async () => {
    const endpoint = createEndpoint(
      "/test",
      {
        method: "GET",
        body: z.object({
          name: z.string(),
        }),
        requireHeaders: true,
      },
      async (ctx) => {
        return ctx.json({ name: ctx.body.name });
      }
    );
    expect(
      //@ts-expect-error
      endpoint({
        body: { name: "test" },
      })
    ).rejects.toThrowError("Validation Error: Headers are required");
  });
});

describe("request", () => {
  it("should get headers", async () => {
    const endpoint = createEndpoint(
      "/test",
      {
        method: "GET",
      },
      async (ctx) => {
        return ctx.json({ name: ctx.getHeader("x-test") });
      }
    );
    expect(
      endpoint({
        headers: new Headers({ "x-test": "test" }),
      })
    ).resolves.toEqual({ name: "test" });
  });
});

describe("response", async () => {
  it("should return json", async () => {
    const endpoint = createEndpoint(
      "/test",
      {
        method: "GET",
      },
      async (ctx) => {
        return ctx.json({ name: "test" });
      }
    );
    const jsonResponse = await endpoint();
    expect(jsonResponse).toEqual({ name: "test" });
  });

  it("should return response", async () => {
    const endpoint = createEndpoint(
      "/test",
      {
        method: "GET",
      },
      async (ctx) => {
        return ctx.json({
          name: "test",
        });
      }
    );
    const response = await endpoint({ asResponse: true });
    const json = await response.json();
    expect(response).toBeInstanceOf(Response);
    expect(json).toEqual({ name: "test" });
  });

  it("should return response with status", async () => {
    const endpoint = createEndpoint(
      "/test",
      {
        method: "GET",
      },
      async (ctx) => {
        return ctx.json(
          {
            name: "test",
          },
          { status: 201 }
        );
      }
    );
    const response = await endpoint({ asResponse: true });
    expect(response.status).toBe(201);
  });

  it("should return response with headers", async () => {
    const endpoint = createEndpoint(
      "/test",
      {
        method: "GET",
      },
      async (ctx) => {
        ctx.setHeader("x-test", "test");
      }
    );
    const response = await endpoint({ asResponse: true });
    expect(response.headers.get("x-test")).toBe("test");
  });
});

describe("cookies", async () => {
  it("should set cookie", async () => {
    const endpoint = createEndpoint(
      "/test",
      {
        method: "GET",
      },
      async (ctx) => {
        ctx.setCookie("test", "value");
      }
    );
    const response = await endpoint({ asResponse: true });
    expect(response.headers.get("set-cookie")).includes("test=value");
  });

  it("should set cookie", async () => {
    const endpoint = createEndpoint(
      "/test",
      {
        method: "GET",
      },
      async (ctx) => {
        await ctx.setSignedCookie("test", "value", "secret");
      }
    );
    const response = await endpoint({ asResponse: true });
    expect(response.headers.get("set-cookie")).includes("test=value.");
  });
});

describe("redirect", () => {
  it("should redirect", async () => {
    const endpoint = createEndpoint(
      "/test",
      {
        method: "GET",
      },
      async (ctx) => {
        throw ctx.redirect("/new-url");
      }
    );
    const response = await endpoint({ asResponse: true });
    expect(response.headers.get("location")).toBe("/new-url");
  });

  it("should throw redirect if asResponse is false", async () => {
    const endpoint = createEndpoint(
      "/test",
      {
        method: "GET",
      },
      async (ctx) => {
        throw ctx.redirect("/new-url");
      }
    );
    expect(endpoint()).rejects.toThrowError("Redirecting");
  });
});

describe("creator", () => {
  it("should infer from custom creator", async () => {
    const middleware = createMiddleware(async () => {
      return {
        something: "",
      };
    });

    const createCustomEndpoint = createEndpoint.creator({
      use: [middleware],
    });

    const endpoint = createCustomEndpoint(
      "/",
      {
        method: "GET",
      },
      async (ctx) => {
        expectTypeOf(ctx.context.something).toMatchTypeOf<string>();
        return ctx.json({ name: "test" });
      }
    );
    const res = await endpoint();
    expectTypeOf(res).toEqualTypeOf<{ name: string }>();
  });
});
