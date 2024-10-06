import { describe, expect, expectTypeOf, it } from "vitest";
import { createEndpoint, createRouter } from "../src";
import { z } from "zod";
import { json } from "../src/helper";

describe("Endpoint", () => {
	it("should return handler response", async () => {
		const endpoint = createEndpoint(
			"/",
			{
				method: "GET",
			},
			async (ctx) => {
				return {
					message: "hello world",
				};
			},
		);
		const res = await endpoint();
		expect(res).toEqual({
			message: "hello world",
		});
		expectTypeOf(res).toMatchTypeOf<{
			message: string;
		}>();
	});

	it("should infer body on ctx", async () => {
		const endpoint = createEndpoint(
			"/",
			{
				method: "GET",
				body: z.object({
					name: z.string(),
				}),
			},
			async (ctx) => {
				expectTypeOf(ctx.body).toMatchTypeOf<{
					name: string;
				}>();
				return {
					message: ctx.method,
				};
			},
		);
	});

	it("should infer query on ctx", async () => {
		const endpoint = createEndpoint(
			"/",
			{
				method: "GET",
				query: z.object({
					name: z.string(),
				}),
			},
			async (ctx) => {
				expectTypeOf(ctx.query).toMatchTypeOf<{
					name: string;
				}>();
				return {
					message: ctx.method,
				};
			},
		);
	});

	it("should infer params on ctx", async () => {
		const endpoint = createEndpoint(
			"/:id",
			{
				method: "GET",
				params: z.object({
					id: z.string(),
				}),
			},
			async (ctx) => {
				expectTypeOf(ctx.params).toMatchTypeOf<{
					id: string;
				}>();
				return {
					message: ctx.method,
				};
			},
		);
	});

	it("should infer headers on ctx", async () => {
		const endpoint = createEndpoint(
			"/",
			{
				method: "GET",
				requireHeaders: true,
			},
			async (ctx) => {
				expectTypeOf(ctx.headers).toMatchTypeOf<Headers>();
				return {
					message: ctx.method,
				};
			},
		);
	});

	it("should infer request on ctx", async () => {
		const endpoint = createEndpoint(
			"/",
			{
				method: "GET",
				requireRequest: true,
			},
			async (ctx) => {
				expectTypeOf(ctx.request).toMatchTypeOf<Request>();
				return {
					message: ctx.method,
				};
			},
		);
	});

	it("should infer method on ctx", async () => {
		createEndpoint(
			"/",
			{
				method: "GET",
			},
			async (ctx) => {
				expectTypeOf(ctx.method).toMatchTypeOf<"GET" | undefined>();
				return {
					message: ctx.method,
				};
			},
		);
		const endpoint = createEndpoint(
			"/",
			{
				method: ["GET"],
			},
			async (ctx) => {
				expectTypeOf(ctx.method).toMatchTypeOf<"GET">();
				return {
					message: ctx.method,
				};
			},
		);
		expectTypeOf(endpoint).parameter(0).toMatchTypeOf<{
			method: "GET";
		}>();
	});

	it("should work with json", async () => {
		const endpoint = createEndpoint(
			"/test",
			{
				method: "GET",
			},
			async (ctx) => {
				return json({
					hello: "world",
				});
			},
		);
		const res = await endpoint();
		expect(res).toMatchObject({
			hello: "world",
		});
		const router = createRouter({
			endpoint,
		});
		const response = await router.handler(new Request("http://localhost/test"));
		const j = await response.json();
		expect(j).toMatchObject({
			hello: "world",
		});
	});

	it("should return response object from handler", async () => {
		const endpoint = createEndpoint(
			"/",
			{
				method: "GET",
			},
			async (ctx) => {
				return ctx.json({
					message: "hello world",
				});
			},
		);
		const res = await endpoint({
			asResponse: true,
		});
		expect(res).toBeInstanceOf(Response);
	});
});
