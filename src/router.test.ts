import { describe, expect, it } from "vitest";
import { createEndpoint } from "./endpoints";
import { z } from "zod";
import { createRouter } from "./router";

describe("router", async () => {
  it("should route", async () => {
    const db = {
      item: [] as {
        id: string;
      }[],
    };
    const createItem = createEndpoint(
      "/",
      {
        body: z.object({
          id: z.string(),
        }),
        method: "POST",
      },
      async (ctx) => {
        db.item.push({
          id: ctx.body.id,
        });
        return {
          item: {
            id: ctx.body.id,
          },
        };
      }
    );

    const getItem = createEndpoint(
      "/item/:id",
      {
        params: z.object({
          id: z.string(),
        }),
        method: "GET",
      },
      async (ctx) => {
        const item = db.item.find((item) => item.id === ctx.params.id);
        ctx.setCookie("hello", "world");
        return {
          item,
        };
      }
    );

    const router = createRouter(
      {
        createItem,
        getItem,
      },
      {
        throwError: true,
      }
    );
    const request = new Request("http://localhost:3000", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: "1",
      }),
    });
    const res = await router.handler(request);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { item: { id: string } };
    expect(json.item.id).toBe("1");
    const request2 = new Request("http://localhost:3000/item/1");
    const res2 = await router.handler(request2);
    expect(res2.status).toBe(200);
    expect(res2.headers.get("Set-Cookie")).toBe("hello=world; Path=/");
    const json2 = (await res2.json()) as { item: { id: string } };
    expect(json2.item.id).toBe("1");
  });
});
