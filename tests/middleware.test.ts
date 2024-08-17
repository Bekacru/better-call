import { describe, expect, expectTypeOf, it } from "vitest";
import { createEndpoint, createMiddleware } from "../src";
import { z } from "zod";

describe.only("Middleware", () => {
	it("should apply middleware context", async () => {
		const middleware = createMiddleware(async (ctx) => {
			return {
				name: "hello",
			};
		});
		const endpoint = createEndpoint(
			"/",
			{
				method: "GET",
				use: [middleware],
			},
			async (ctx) => {
				expectTypeOf(ctx.context).toMatchTypeOf<{
					name: string;
				}>();
				expect(ctx.context.name).toBe("hello");
			},
		);
		endpoint();
	});

	it("should merge body", async () => {
		const middleware = createMiddleware(
			{
				body: z.object({
					a: z.string(),
				}),
			},
			async (ctx) => {
				expect(ctx.body.a).toBe("1");
				return {
					name: "hello",
				};
			},
		);
		const middleware2 = createMiddleware(
			{
				body: z.object({
					b: z.string(),
				}),
			},
			async (ctx) => {
				expect(ctx.body.b).toBe("2");
				return {
					name: "hello",
				};
			},
		);
		const endpoint = createEndpoint(
			"/",
			{
				body: z.object({
					c: z.string(),
				}),
				method: "GET",
				use: [middleware, middleware2],
			},
			async (ctx) => {
				expectTypeOf(ctx.body).toMatchTypeOf<{
					a: string;
					b: string;
					c: string;
				}>();
				expect(ctx.body.a).toBe("1");
				expect(ctx.body.b).toBe("2");
				expect(ctx.body.c).toBe("3");
			},
		);
		endpoint({
			body: {
				a: "1",
				b: "2",
				c: "3",
			},
		});
	});
});
