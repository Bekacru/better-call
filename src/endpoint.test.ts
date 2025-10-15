import { describe, expect, expectTypeOf, it } from "vitest";
import { createEndpoint } from "./endpoint";
import { z } from "zod";
import { APIError } from "./error";
import { createMiddleware } from "./middleware";
import * as v from "valibot";

describe("validation", (it) => {
	it("should validate body and throw validation error", async () => {
		const endpoint = createEndpoint(
			"/test",
			{
				method: "GET",
				body: v.object({
					name: v.string(),
				}),
			},
			async (ctx) => {
				ctx.body;
				ctx.headers;
				return ctx.body;
			},
		);

		await expect(
			endpoint({
				//@ts-expect-error
				body: { name: 1 },
			}),
		).rejects.toThrowError("Invalid body parameters");
	});

	it("should validate query and throw validation error", async () => {
		const endpoint = createEndpoint(
			"/test",
			{
				method: "GET",
				query: v.object({
					name: v.string(),
				}),
			},
			async (ctx) => {
				return ctx.query;
			},
		);

		await expect(
			endpoint({
				//@ts-expect-error
				query: { name: 1 },
			}),
		).rejects.toThrowError(`Invalid query parameters`);
	});

	it("should validate the body and return the body", async () => {
		const endpoint = createEndpoint(
			"/test",
			{
				method: "GET",
				body: z.object({
					name: z.string().transform((val) => `${val}-validated`),
				}),
			},
			async (ctx) => {
				return ctx.body;
			},
		);
		const response = await endpoint({
			body: {
				name: "test",
			},
		});

		expect(response.name).toBe("test-validated");
	});

	it("should validate the body and return the query", async () => {
		const endpoint = createEndpoint(
			"/test",
			{
				method: "GET",
				query: z.object({
					name: z.string().transform((val) => `${val}-validated`),
				}),
			},
			async (ctx) => {
				return ctx.query;
			},
		);
		const response = await endpoint({
			query: {
				name: "test",
			},
		});
		expect(response.name).toBe("test-validated");
	});
});

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
			},
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
			},
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
			},
		);

		createEndpoint(
			"/path",
			{
				method: "POST",
				body: z.record(z.string(), z.string()),
				metadata: {
					$Infer: {
						body: {} as {
							hello: "world";
						},
					},
				},
			},
			async (c) => {
				expectTypeOf(c.body).toMatchTypeOf<{
					hello: "world";
				}>();
			},
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
			},
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
			},
		);

		createEndpoint(
			"/test",
			{
				method: "GET",
				query: z.optional(
					z.object({
						name: z.string(),
					}),
				),
			},
			async (ctx) => {
				expectTypeOf(ctx.query).toEqualTypeOf<{ name: string } | undefined>();
			},
		);

		createEndpoint(
			"/path",
			{
				method: "POST",
				body: z.record(z.string(), z.string()),
				metadata: {
					$Infer: {
						query: {} as {
							hello: "world";
						},
					},
				},
			},
			async (c) => {
				expectTypeOf(c.query).toMatchTypeOf<{
					hello: "world";
				}>();
			},
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
			},
		);

		createEndpoint(
			"/leading-path/:id",
			{
				method: "GET",
			},
			async (ctx) => {
				expectTypeOf(ctx.params).toEqualTypeOf<{ id: string }>();
			},
		);

		createEndpoint(
			"/leading-path/:id/:name",
			{
				method: "GET",
			},
			async (ctx) => {
				ctx.params;
				expectTypeOf(ctx.params).toEqualTypeOf<{ id: string; name: string }>();
			},
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
			},
		);

		createEndpoint(
			"/api/:id/*",
			{
				method: "GET",
			},
			async (ctx) => {
				expectTypeOf(ctx.params).toEqualTypeOf<{ _: string; id: string }>();
			},
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
			},
		);

		const endpoint = createEndpoint(
			"/test",
			{
				method: ["POST", "GET"],
			},
			async (ctx) => {
				expectTypeOf(ctx.method).toEqualTypeOf<"POST" | "GET">();
			},
		);
		//@ts-expect-error - method should be required
		endpoint({});
		const wildCardMethodEndpoint = createEndpoint(
			"/test",
			{
				method: "*",
			},
			async (ctx) => {
				expectTypeOf(ctx.method).toEqualTypeOf<
					"POST" | "GET" | "DELETE" | "PUT" | "PATCH"
				>();
			},
		);
		//@ts-expect-error -
		wildCardMethodEndpoint({});
	});
	it("response", async () => {
		const endpoint1 = createEndpoint(
			"/test",
			{
				method: "GET",
			},
			async (ctx) => {
				return { name: "test" };
			},
		);
		const jsonResponse1 = await endpoint1();
		expectTypeOf(jsonResponse1).toEqualTypeOf<{ name: string }>();
		const objResponse1 = await endpoint1({ asResponse: true });
		expectTypeOf(objResponse1).toEqualTypeOf<Response>();
	});
});

describe("response", () => {
	describe("flat", () => {
		it("should return primitive values", async () => {
			for (const value of [1, "hello", true]) {
				const endpoint = createEndpoint(
					"/path",
					{
						method: "POST",
					},
					async (ctx) => {
						return value;
					},
				);
				const response = await endpoint();
				expect(response).toBe(value);
			}
		});
	});

	describe("json", () => {
		it("should return a js object response on direct call", async () => {
			const endpoint = createEndpoint(
				"/path",
				{
					method: "POST",
				},
				async (ctx) => {
					return ctx.json({ test: "response" });
				},
			);
			const response = await endpoint();
			expect(response).toMatchObject({
				test: "response",
			});
		});

		it("should return a js object response with 201 status", async () => {
			const endpoint = createEndpoint(
				"/path",
				{
					method: "POST",
					status: 201,
				},
				async (ctx) => {
					return ctx.json(
						{ test: "response" },
						{
							status: 201,
						},
					);
				},
			);
			const response = await endpoint({
				asResponse: true,
			});
			await expect(response.json()).resolves.toMatchObject({
				test: "response",
			});
			expect(response.status).toBe(201);
		});
	});

	it("should return a js object response (asResponse)", async () => {
		const endpoint = createEndpoint(
			"/path",
			{
				method: "POST",
				status: 200,
			},
			async (ctx) => {
				return ctx.json({ test: "response" });
			},
		);
		const response = await endpoint({
			asResponse: true,
		});
		await expect(response.json()).resolves.toMatchObject({
			test: "response",
		});
		expect(response.status).toBe(200);
	});

	describe("as-response", () => {
		it("should return a response object", async () => {
			const responses = [
				{
					type: "number",
					value: 1,
				},
				{
					type: "string",
					value: "hello world!",
				},
				{
					type: "object",
					value: {
						hello: "world",
					},
				},
				{
					type: "object",
					value: ["1", "2", "3"],
				},
			];
			for (const value of responses) {
				const endpoint = createEndpoint(
					"/path",
					{
						method: "POST",
					},
					async () => {
						return value.value;
					},
				);
				const response = await endpoint({
					asResponse: true,
				});
				const body = await response.text();
				if (value.type !== "object") {
					expect(body).toBe(value.value.toString());
				} else {
					expect(body).toMatch(JSON.stringify(value.value));
				}
			}
		});
	});

	describe("redirect", () => {
		it("should return redirect response", async () => {
			const endpoint = createEndpoint(
				"/endpoint",
				{
					method: "POST",
				},
				async (c) => {
					return c.redirect("/");
				},
			);
			const response = await endpoint();
			expect(response).instanceOf(APIError);
			expect(response.status).toBe("FOUND");
			expect(response.statusCode).toBe(302);
		});
	});

	describe("set-headers", () => {
		it("should set headers", async () => {
			const endpoint = createEndpoint(
				"/endpoint",
				{
					method: "POST",
				},
				async (c) => {
					c.setHeader("hello", "world");
				},
			);
			const response = await endpoint({
				asResponse: true,
			});
			expect(response.headers.get("hello")).toBe("world");

			const response2 = await endpoint({
				returnHeaders: true,
			});
			expect(response2.headers.get("hello")).toBe("world");
		});
	});

	describe("API Error", () => {
		it("should throw API Error", async () => {
			const endpoint = createEndpoint(
				"/endpoint",
				{
					method: "POST",
				},
				async (c) => {
					throw c.error("NOT_FOUND");
				},
			);
			await expect(endpoint()).rejects.toThrowError(APIError);
		});

		it("should return error Response", async () => {
			const endpoint = createEndpoint(
				"/endpoint",
				{
					method: "POST",
				},
				async (c) => {
					throw c.error("NOT_FOUND");
				},
			);
			const response = await endpoint({
				asResponse: true,
			});
			expect(response.status).toBe(404);
		});

		it("should return error Response with it's body", async () => {
			const endpoint = createEndpoint(
				"/endpoint",
				{
					method: "POST",
				},
				async (c) => {
					throw c.error("BAD_REQUEST", {
						message: "error message",
					});
				},
			);
			const response = await endpoint({
				asResponse: true,
			});
			const body = await response.json();
			expect(response.status).toBe(400);
			expect(body).toMatchObject({
				message: "error message",
			});
		});
	});
	describe("json", async () => {
		it("should return the json directly", async () => {
			const endpoint = createEndpoint(
				"/",
				{
					method: "GET",
				},
				async (c) => {
					return c.json(
						{ name: "hello" },
						new Response(
							JSON.stringify({
								client: "hello",
							}),
						),
					);
				},
			);
			const response = await endpoint();
			expect(response).toMatchObject({
				name: "hello",
			});
		});
	});
});

describe("creator", () => {
	it("should use creator context", async () => {
		const creator = createEndpoint.create({
			use: [
				createMiddleware(async () => {
					return {
						hello: "world",
					};
				}),
			],
		});
		const endpoint = creator(
			"/path",
			{
				method: "POST",
			},
			async (c) => {
				return c.context;
			},
		);
		const response = await endpoint();
		expect(response).toMatchObject({
			hello: "world",
		});
	});

	it("should be able to combine with endpoint middleware", async () => {
		const creator = createEndpoint.create({
			use: [
				createMiddleware(async () => {
					return {
						hello: "world",
					};
				}),
			],
		});
		const endpoint = creator(
			"/path",
			{
				method: "POST",
				use: [
					createMiddleware(async () => {
						return {
							test: "payload",
						};
					}),
				],
			},
			async (c) => {
				return c.context;
			},
		);
		const response = await endpoint();
		expect(response).toMatchObject({
			hello: "world",
			test: "payload",
		});
	});
});

describe("onAPIError", () => {
	it("should call onAPIError", async () => {
		let error: APIError | undefined;
		const endpoint = createEndpoint(
			"/path",
			{
				method: "POST",
				onAPIError: async (e) => {
					console.log("onAPIError", e);
					error = e;
				},
			},
			async (c) => {
				throw c.error("UNAUTHORIZED");
			},
		);
		await endpoint().catch(() => {});
		expect(error).toBeDefined();
		expect(error?.status).toBe("UNAUTHORIZED");
	});
});

describe("wrap", () => {
	it("should wrap the handler function", async () => {
		const endpoint = createEndpoint(
			"/path",
			{
				method: "POST",
				body: z.object({
					name: z.string(),
				}),
			},
			async (c) => {
				return { message: `Hello ${c.body.name}` };
			},
		);

		const response1 = await endpoint({
			body: { name: "Alice" },
		});
		expect(response1).toMatchObject({
			message: "Hello Alice",
		});

		const wrapped = endpoint.wrap((c) => {
			return { message: `Wrapped: ${c.body.name}` };
		});

		const response2 = await wrapped({
			body: { name: "Bob" },
		});
		expect(response2).toMatchObject({
			message: "Wrapped: Bob",
		});
	});

	it("should preserve validation with wrapped handler", async () => {
		const endpoint = createEndpoint(
			"/test",
			{
				method: "GET",
				body: z.object({
					age: z.number(),
				}),
			},
			async (ctx) => {
				return { age: ctx.body.age };
			},
		);

		const wrapped = endpoint.wrap((ctx) => {
			return { age: ctx.body.age * 2 };
		});
		await expect(
			wrapped({
				//@ts-expect-error
				body: { age: "not a number" },
			}),
		).rejects.toThrowError("Invalid body parameters");
		const response = await wrapped({
			body: { age: 25 },
		});
		expect(response).toMatchObject({
			age: 50,
		});
	});

	it("should work with async wrapped handlers", async () => {
		const endpoint = createEndpoint(
			"/path",
			{
				method: "POST",
			},
			async () => {
				return { original: true };
			},
		);

		const wrapped = endpoint.wrap(async (c) => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return { wrapped: true, path: c.path };
		});

		const response = await wrapped();
		expect(response).toMatchObject({
			wrapped: true,
			path: "/path",
		});
	});

	it("should preserve middleware context in wrapped handler", async () => {
		const endpoint = createEndpoint(
			"/path",
			{
				method: "POST",
				use: [
					createMiddleware(async () => {
						return {
							userId: "123",
						};
					}),
				],
			},
			async (c) => {
				return { userId: c.context.userId };
			},
		);

		const wrapped = endpoint.wrap((c) => {
			return { userId: c.context.userId, wrapped: true };
		});

		const response = await wrapped();
		expect(response).toMatchObject({
			userId: "123",
			wrapped: true,
		});
	});

	it("should work with error handling in wrapped handler", async () => {
		const endpoint = createEndpoint(
			"/path",
			{
				method: "POST",
			},
			async () => {
				return { success: true };
			},
		);

		const wrapped = endpoint.wrap((c) => {
			throw c.error("FORBIDDEN", { message: "Access denied" });
		});

		await expect(wrapped()).rejects.toThrowError(APIError);

		const response = await wrapped({ asResponse: true });
		expect(response.status).toBe(403);
		const body = await response.json();
		expect(body).toMatchObject({
			message: "Access denied",
		});
	});

	it("should preserve onAPIError callback with wrapped handler", async () => {
		let error: APIError | undefined;
		const endpoint = createEndpoint(
			"/path",
			{
				method: "POST",
				onAPIError: async (e) => {
					error = e;
				},
			},
			async (c) => {
				throw c.error("UNAUTHORIZED");
			},
		);

		const wrapped = endpoint.wrap((c) => {
			throw c.error("FORBIDDEN");
		});

		await wrapped().catch(() => {});
		expect(error).toBeDefined();
		expect(error?.status).toBe("FORBIDDEN");
	});

	it("should allow calling original handler from wrapped handler", async () => {
		const endpoint = createEndpoint(
			"/path",
			{
				method: "POST",
				body: z.object({
					value: z.number(),
				}),
			},
			async (c) => {
				return { original: c.body.value };
			},
		);

		const wrapped = endpoint.wrap(async (c, original) => {
			const result = await original(c);
			return { ...result, wrapped: true };
		});

		const response = await wrapped({
			body: { value: 42 },
		});
		expect(response).toMatchObject({
			original: 42,
			wrapped: true,
		});
	});

	it("should support multiple wraps", async () => {
		const endpoint = createEndpoint(
			"/path",
			{
				method: "POST",
			},
			async () => {
				return { value: 1 };
			},
		);

		const wrapped1 = endpoint.wrap(async (c, original) => {
			const result = await original(c);
			return { ...result, wrap1: true };
		});

		const wrapped2 = wrapped1.wrap(async (c, original) => {
			const result = await original(c);
			return { ...result, wrap2: true };
		});

		const response = await wrapped2();
		expect(response).toMatchObject({
			value: 1,
			wrap1: true,
			wrap2: true,
		});
	});

	it("should preserve path and options on wrapped endpoint", async () => {
		const endpoint = createEndpoint(
			"/test-path",
			{
				method: "GET",
				body: z.object({
					name: z.string(),
				}),
			},
			async (c) => {
				return { name: c.body.name };
			},
		);

		const wrapped = endpoint.wrap((c) => {
			return { name: "wrapped" };
		});

		expect(wrapped.path).toBe("/test-path");
		expect(wrapped.options.method).toBe("GET");
		expect(wrapped.options.body).toBe(endpoint.options.body);
	});

	it("should work with asResponse in wrapped handler", async () => {
		const endpoint = createEndpoint(
			"/path",
			{
				method: "POST",
			},
			async () => {
				return { original: true };
			},
		);

		const wrapped = endpoint.wrap((c) => {
			return { wrapped: true };
		});

		const response = await wrapped({ asResponse: true });
		expect(response).toBeInstanceOf(Response);
		const body = await response.json();
		expect(body).toMatchObject({
			wrapped: true,
		});
	});

	it("should allow wrapped handler to access params", async () => {
		const endpoint = createEndpoint(
			"/users/:id",
			{
				method: "GET",
			},
			async (c) => {
				return { id: c.params.id };
			},
		);

		const wrapped = endpoint.wrap((c) => {
			return { id: c.params.id, wrapped: true };
		});

		const response = await wrapped({
			params: { id: "123" },
		});
		expect(response).toMatchObject({
			id: "123",
			wrapped: true,
		});
	});

	it("should allow original handler to be ignored", async () => {
		const endpoint = createEndpoint(
			"/path",
			{
				method: "POST",
			},
			async () => {
				return { original: true };
			},
		);

		const wrapped = endpoint.wrap((c, original) => {
			return { wrapped: true, ignored: "original" };
		});

		const response = await wrapped();
		expect(response).toMatchObject({
			wrapped: true,
			ignored: "original",
		});
		expect(response).not.toHaveProperty("original");
	});

	it("should handle transformation of original result", async () => {
		const endpoint = createEndpoint(
			"/path",
			{
				method: "POST",
				body: z.object({
					count: z.number(),
				}),
			},
			async (c) => {
				return { count: c.body.count };
			},
		);

		const wrapped = endpoint.wrap(async (c, original) => {
			const result = await original(c);
			return {
				...result,
				count: result.count * 2,
				transformed: true,
			};
		});

		const response = await wrapped({
			body: { count: 5 },
		});
		expect(response).toMatchObject({
			count: 10,
			transformed: true,
		});
	});
});
