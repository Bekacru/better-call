import { describe, expect, expectTypeOf, it } from "vitest";
import { APIError, createEndpoint, createMiddleware, createRouter } from "../src";
import { z } from "zod";
import { parseSigned } from "../src/cookie";

describe("Router", () => {
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
			},
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
			},
		);

		const router = createRouter(
			{
				createItem,
				getItem,
			},
			{
				throwError: true,
			},
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
		const json = await res.json();
		expect(json.item.id).toBe("1");
		const request2 = new Request("http://localhost:3000/item/1");
		const res2 = await router.handler(request2);
		expect(res2.status).toBe(200);
		expect(res2.headers.get("Set-Cookie")).toBe("hello=world; Path=/");
		const json2 = await res2.json();
		expect(json2.item.id).toBe("1");
	});

	it("with middleware", async () => {});

	it("should handle base path", async () => {
		const getItem = createEndpoint(
			"/item",
			{
				method: "GET",
			},
			async (ctx) => {
				return {
					item: "item",
				};
			},
		);
		const router = createRouter(
			{
				getItem,
			},
			{
				basePath: "/api",
			},
		);
		const request = new Request("http://localhost:3000/api/item");
		const re = await router.handler(request);
		const json = await re.json();
		expect(json.item).toBe("item");
	});

	it("query", async () => {
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
				expect(ctx.query.name).toBe("hello");
				return {
					message: ctx.method,
				};
			},
		);

		const router = createRouter(
			{
				endpoint,
			},
			{
				throwError: true,
			},
		);
		const request = new Request("http://localhost:3000?name=hello");
		await router.handler(request);
	});

	it("router middleware", async () => {
		let isCalled = false;
		const endpoint = createEndpoint(
			"/item",
			{
				method: "GET",
			},
			async (ctx) => {},
		);
		const middleware = createMiddleware(async (ctx) => {
			isCalled = true;
		});
		const router = createRouter(
			{
				endpoint,
			},
			{
				throwError: true,
				routerMiddleware: [
					{
						path: "/*",
						middleware,
					},
				],
			},
		);
		const request = new Request("http://localhost:3000/item");
		const res = await router.handler(request);
		expect(isCalled).toBe(true);
	});

	it("should support extra context", async () => {
		const endpoint = createEndpoint(
			"/item",
			{
				method: "GET",
			},
			async (ctx) => {
				const options = (ctx as any).options;
				expect("name" in options).toBe(true);
			},
		);

		const router = createRouter(
			{
				endpoint,
			},
			{
				extraContext: {
					options: {
						name: "test",
					},
				},
			},
		);
		const request = new Request("http://localhost:3000/item");
		await router.handler(request);
	});

	it("should include headers on throw", async () => {
		const endpoint = createEndpoint(
			"/item",
			{
				method: "GET",
			},
			async (ctx) => {
				ctx.setHeader("test", "test");
				throw new APIError("FOUND");
			},
		);
		const router = createRouter(
			{
				endpoint,
			},
			{
				throwError: true,
			},
		);
		const request = new Request("http://localhost:3000/item");
		const res = await router.handler(request);
		expect(res.headers.get("test")).toBe("test");
	});

	it("should redirect", async () => {
		const endpoint = createEndpoint(
			"/item",
			{
				method: "GET",
			},
			async (ctx) => {
				throw ctx.redirect("http://localhost:3000/item");
			},
		);
		const router = createRouter({
			endpoint,
		});
		const request = new Request("http://localhost:3000/item");
		const res = await router.handler(request);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("http://localhost:3000/item");
	});

	it("should return 404", async () => {
		const endpoint = createEndpoint(
			"/item",
			{
				method: "GET",
			},
			async () => {},
		);
		const router = createRouter(
			{
				endpoint,
			},
			{
				basePath: "/path",
			},
		);
		const request = new Request("http://localhost:3000/item");
		const res = await router.handler(request);
		expect(res.status).toBe(404);
	});
});

describe("Cookie", () => {
	it("should sign cookie", async () => {
		const endpoint = createEndpoint(
			"/test",
			{
				method: "GET",
			},
			async (ctx) => {
				await ctx.setSignedCookie("hello", "world", "secret");
				const cookie = ctx.getCookie("hello");
				expect(cookie).toBe("world");
				return {
					message: ctx.method,
				};
			},
		);
		const router = createRouter(
			{
				endpoint,
			},
			{
				throwError: true,
			},
		);
		const request = new Request("http://localhost:3000/test", {
			headers: {
				cookie: "hello=world",
			},
		});
		const res = await router.handler(request);
		const cookie = await parseSigned(res.headers.get("Set-Cookie") || "", "secret");
		expect(cookie.hello).toBe("world");
	});
});
