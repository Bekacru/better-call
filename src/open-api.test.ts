import { describe, expect, it } from "vitest";
import { createEndpoint } from "./endpoints";
import { z } from "zod";
import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";

describe("openapi", async () => {
  it("should infer open api types", async () => {
    const endpoint = createEndpoint(
      "/item/:id",
      {
        method: "POST",
        body: z
          .object({
            hello: z.string(),
          })
          .openapi({ description: "something" }),
        openAPI: {
          responses: {
            200: {
              content: {
                "application/json": {
                  schema: z.object({
                    hello: z.string(),
                  }),
                },
              },
              description: "ok",
            },
          },
        },
      },
      async (ctx) => {
        return ctx.json({
          we: "roll",
        });
      }
    );
    const def = endpoint.openAPI.definitions;
    const openAPI = new OpenApiGeneratorV3([...def]);
    const docs = openAPI.generateDocument({
      openapi: "3.0.0",
      info: {
        version: "1.0.0",
        title: "My API",
        description: "This is the API",
      },
      servers: [{ url: "v1" }],
    });
    expect(docs).toMatchSnapshot();
  });
});
