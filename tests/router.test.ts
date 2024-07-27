import { describe, expect, it } from "vitest";
import { createEndpoint, createMiddleware, createRouter } from "../src";
import { z } from "zod";


describe("Router", () => {
    it("should route", async () => {
        const db = {
            item: [] as {
                id: string
            }[]
        }
        const createItem = createEndpoint("/", {
            body: z.object({
                id: z.string()
            }),
            method: "POST"
        }, async (ctx) => {
            db.item.push({
                id: ctx.body.id
            })
            return {
                item: {
                    id: ctx.body.id
                }
            }
        })

        const getItem = createEndpoint("/item/:id", {
            params: z.object({
                id: z.string()
            }),
            method: "GET"
        }, async (ctx) => {
            const item = db.item.find(item => item.id === ctx.params.id)
            ctx.setCookie("hello", "world")
            return {
                item
            }
        })

        const router = createRouter([createItem, getItem], {
            throwError: true
        })
        const request = new Request("http://localhost:3000", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                id: "1"
            })
        })
        const res = await router.handler(request)
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.item.id).toBe("1")
        const request2 = new Request("http://localhost:3000/item/1")
        const res2 = await router.handler(request2)
        expect(res2.status).toBe(200)
        expect(res2.headers.get("Set-Cookie")).toBe("hello=world")
        const json2 = await res2.json()
        expect(json2.item.id).toBe("1")
    })

    it("with middleware", async () => {
        const createProtectedEndpoint = createMiddleware(async (ctx) => {
            return {
                context: {
                    user: {
                        id: "2"
                    }
                }
            }
        })
        const getUser = createProtectedEndpoint("/:id", {
            method: "GET"
        }, async (ctx) => {

            return {
                user: ctx.user
            }
        })
        const router = createRouter([getUser], {
            throwError: true
        })
        const request = new Request("http://localhost:3000/1")
        const re = await router.handler(request)
        const json = await re.json()
        expect(json.user.id).toBe("2")
    })

    it("should handle base path", async () => {
        const getItem = createEndpoint("/item", {
            method: "GET"
        }, async (ctx) => {
            return {
                item: "item"
            }
        })
        const router = createRouter([getItem], {
            basePath: "/api"
        })
        const request = new Request("http://localhost:3000/api/item")
        const re = await router.handler(request)
        const json = await re.json()
        expect(json.item).toBe("item")
    })
})

