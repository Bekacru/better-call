import { describe, it } from "vitest";
import { createEndpoint } from "../src";
import { z } from "zod";



describe("Type", () => {
    it("should infer use", async () => {

        const middleware = createEndpoint("*", {
            body: z.object({
                id: z.string()
            }),
            method: "POST"
        }, async (ctx) => {
            return {
                item: {
                    id: ctx.body
                }
            }
        })

        const endpoint2 = createEndpoint("/", {
            body: z.object({
                name: z.string()
            }),
            method: "POST",
            use: [middleware]
        }, async (ctx) => {

        })

        endpoint2({
            body: {
                id: "123",
                name: "hello"
            }
        })
    })
})