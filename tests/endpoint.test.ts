import { describe, expect, expectTypeOf, it } from "vitest";
import { createEndpoint } from "../src";
import { z } from "zod";

describe("Endpoint", () => {
    it("should return handler response", async () => {
        const endpoint = createEndpoint("/", {
            method: "GET",
        }, async (ctx) => {
            return {
                message: "hello world"
            }
        })
        const res = await endpoint()
        expect(res).toEqual({
            message: "hello world"
        })
        expectTypeOf(res).toMatchTypeOf<{
            message: string
        }>()
    })

    it("should infer body on ctx", async () => {
        const endpoint = createEndpoint("/", {
            method: "GET",
            body: z.object({
                name: z.string()
            })
        }, async (ctx) => {
            expectTypeOf(ctx.body).toMatchTypeOf<{
                name: string
            }>()
            return {
                message: ctx.method
            }
        })
    })

    it("should infer query on ctx", async () => {
        const endpoint = createEndpoint("/", {
            method: "GET",
            query: z.object({
                name: z.string()
            })
        }, async (ctx) => {
            expectTypeOf(ctx.query).toMatchTypeOf<{
                name: string
            }>()
            return {
                message: ctx.method
            }
        })
    })

    it("should infer params on ctx", async () => {
        const endpoint = createEndpoint("/:id", {
            method: "GET",
            params: z.object({
                id: z.string()
            })
        }, async (ctx) => {
            expectTypeOf(ctx.params).toMatchTypeOf<{
                id: string
            }>()
            return {
                message: ctx.method
            }
        })
    })

    it("should infer headers on ctx", async () => {
        const endpoint = createEndpoint("/", {
            method: "GET",
            requireHeaders: true
        }, async (ctx) => {
            expectTypeOf(ctx.headers).toMatchTypeOf<Headers>()
            return {
                message: ctx.method
            }
        })
    })

    it("should infer request on ctx", async () => {
        const endpoint = createEndpoint("/", {
            method: "GET",
            requireRequest: true
        }, async (ctx) => {
            expectTypeOf(ctx.request).toMatchTypeOf<Request>()
            return {
                message: ctx.method
            }
        })
    })

    it("should infer method on ctx", async () => {
        createEndpoint("/", {
            method: "GET"
        }, async (ctx) => {
            expectTypeOf(ctx.method).toMatchTypeOf<"GET" | undefined>()
            return {
                message: ctx.method
            }
        })
        const endpoint = createEndpoint("/", {
            method: ["GET"]
        }, async (ctx) => {
            expectTypeOf(ctx.method).toMatchTypeOf<"GET">()
            return {
                message: ctx.method
            }
        })
        expectTypeOf(endpoint).parameter(0).toMatchTypeOf<{
            method: "GET"
        }>()
    })
})



