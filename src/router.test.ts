import { describe, expect, it, assert } from "vitest";
import { createEndpoint, type Endpoint } from "./endpoint";
import { createRouter } from "./router";
import { z } from "zod";
import { APIError } from "./error";
import { getRequest } from "./adapters/node/request";
import { toResponse } from "./to-response";

describe("router", () => {
	it("should be able to return simple response", async () => {
		const endpoint = createEndpoint(
			"/",
			{
				method: "GET",
			},
			async () => {
				return "hello world";
			},
		);
		const router = createRouter({
			endpoint,
		});
		const request = new Request("http://localhost:3000");
		const response = await router.handler(request);
		const text = await response.text();
		expect(text).toBe("hello world");
	});
	it("should be able to router properly", async () => {
		const routes: {
			path: string;
			method: string;
			body?: any;
		}[] = [
			{
				path: "/",
				method: "GET",
			},
			{
				path: "/post",
				method: "POST",
			},
			{
				path: "/patch",
				method: "PATCH",
			},
			{
				path: "/delete",
				method: "DELETE",
			},
			{
				path: "/put",
				method: "PUT",
			},
		];
		const endpoints: Record<string, Endpoint> = {};
		for (const route of routes) {
			const endpoint = createEndpoint(
				route.path,
				{
					method: route.method as "GET",
				},
				async () => {
					return route.path;
				},
			);
			endpoints[route.path] = endpoint;
		}

		const router = createRouter(endpoints);
		for (const route of routes) {
			const request = new Request(`http://localhost:3000${route.path}`, {
				method: route.method,
			});
			const response = await router.handler(request).then((res) => res.text());
			expect(response).toBe(route.path);
		}
	});

	it("requests with a body", async () => {
		const endpoint = createEndpoint(
			"/post",
			{
				method: "POST",
				body: z.object({
					name: z.string(),
				}),
			},
			async (c) => {
				return c.body;
			},
		);
		const router = createRouter({
			endpoint,
		});
		const request = new Request("http://localhost/post", {
			body: JSON.stringify({
				name: "hello",
			}),
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
		});
		const response = await router.handler(request).then((res) => res.json());
		expect(response).toMatchObject({ name: "hello" });
	});

	it("should work with request with a query param", async () => {
		const endpoint = createEndpoint(
			"/post",
			{
				method: "POST",
				query: z.object({
					name: z.string(),
				}),
			},
			async (c) => {
				return c.query;
			},
		);
		const router = createRouter({
			endpoint,
		});
		const request = new Request("http://localhost/post?name=hello", {
			method: "POST",
		});
		const response = await router.handler(request).then((res) => res.json());
		expect(response).toMatchObject({ name: "hello" });
	});

	it("should work with request with a query param with multiple values", async () => {
		const endpoint = createEndpoint(
			"/post",
			{
				method: "POST",
				query: z.object({
					name: z.array(z.string()),
				}),
			},
			async (c) => {
				return c.query;
			},
		);
		const router = createRouter({
			endpoint,
		});
		const request = new Request("http://localhost/post?name=hello&name=world", {
			method: "POST",
		});
		const response = await router.handler(request).then((res) => res.json());
		expect(response).toMatchObject({ name: ["hello", "world"] });
	});

	it("should work with request with dynamic param", async () => {
		const endpoint = createEndpoint(
			"/post/:id",
			{
				method: "POST",
			},
			async (c) => {
				return c.params;
			},
		);
		const router = createRouter({
			endpoint,
		});
		const request = new Request("http://localhost/post/1", {
			method: "POST",
		});
		const response = await router.handler(request).then((res) => res.json());
		expect(response).toMatchObject({ id: "1" });
	});

	it("should handle API Errors", async () => {
		const endpoint = createEndpoint(
			"/",
			{
				method: "GET",
			},
			async () => {
				throw new APIError("FORBIDDEN");
			},
		);
		const router = createRouter({ endpoint });
		const response = await router.handler(new Request("http://localhost"));
		expect(response.status).toBe(403);
	});

	it("should work with duplicate base path", async () => {
		const endpoint = createEndpoint(
			"/test/api/v1/test",
			{
				method: "GET",
			},
			async (c) => {
				return c.path;
			},
		);
		const router = createRouter({ endpoint }, { basePath: "/api/v1" });
		const response = await router.handler(
			new Request("http://localhost/api/v1/test/api/v1/test"),
		);
		expect(response.status).toBe(200);
		const text = await response.text();
		expect(text).toBe("/test/api/v1/test");
	});

	it("node adapter getRequest should include Express baseUrl when present", async () => {
		const base = "http://localhost:3000";
		const fakeReq: any = {
			headers: { host: "localhost:3000" },
			method: "GET",
			url: "/auth/callback",
			baseUrl: "/api",
			httpVersionMajor: 1,
			destroyed: false,
		};
		const req = getRequest({ base, request: fakeReq });
		expect(new URL(req.url).href).toBe("http://localhost:3000/api/auth/callback");
	});

	it("node adapter getRequest should fall back to url when baseUrl is missing", async () => {
		const base = "http://localhost:3000";
		const fakeReq: any = {
			headers: { host: "localhost:3000" },
			method: "GET",
			url: "/auth/callback",
			httpVersionMajor: 1,
			destroyed: false,
		};
		const req = getRequest({ base, request: fakeReq });
		expect(new URL(req.url).href).toBe("http://localhost:3000/auth/callback");
	});
});

describe("route middleware", () => {
	it("should apply middleware as context", async () => {
		const endpoint = createEndpoint(
			"/",
			{
				method: "GET",
			},
			async (c) => {
				const cx = c.json({ name: "hello" });
				return cx;
			},
		);
		const router = createRouter({ endpoint });
		const response = await router.handler(new Request("http://localhost"));
		const json = await response.json();
		expect(json).toMatchObject({ name: "hello" });
	});
});

describe("error handling", () => {
	it("should use onError callback when provided", async () => {
		const endpoint = createEndpoint(
			"/",
			{
				method: "GET",
			},
			async () => {
				throw new Error("Test error");
			},
		);

		let errorCaught = false;
		const customResponse = new Response("Custom error response", { status: 418 });

		const router = createRouter(
			{ endpoint },
			{
				onError: (e) => {
					errorCaught = true;
					return customResponse;
				},
			},
		);

		const response = await router.handler(new Request("http://localhost"));
		expect(errorCaught).toBe(true);
		expect(response).toBe(customResponse);
		expect(response.status).toBe(418);
	});

	it("should handle APIError converted to Response from onError callback", async () => {
		const endpoint = createEndpoint(
			"/",
			{
				method: "GET",
			},
			async () => {
				throw new Error("Test error");
			},
		);

		let errorCaught = false;
		const apiError = new APIError("BAD_REQUEST", { message: "Custom API error" });

		const router = createRouter(
			{ endpoint },
			{
				onError: (e) => {
					errorCaught = true;
					// Convert APIError to Response
					return toResponse(apiError);
				},
			},
		);

		const response = await router.handler(new Request("http://localhost"));
		expect(errorCaught).toBe(true);
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.message).toBe("Custom API error");
	});

	it("should throw custom error from onError callback", async () => {
		const endpoint = createEndpoint(
			"/",
			{
				method: "GET",
			},
			async () => {
				throw new Error("Original error");
			},
		);

		const newError = new Error("New error from onError");

		const router = createRouter(
			{ endpoint },
			{
				onError: (e) => {
					// Throw the error in the callback
					throw newError;
				},
			},
		);

		await expect(async () => {
			await router.handler(new Request("http://localhost"));
		}).rejects.toThrow(newError);
	});

	it("should re-throw error when throwError is true", async () => {
		const testError = new Error("Test error");
		const endpoint = createEndpoint(
			"/",
			{
				method: "GET",
			},
			async () => {
				throw testError;
			},
		);

		const router = createRouter({ endpoint }, { throwError: true });

		await expect(async () => {
			await router.handler(new Request("http://localhost"));
		}).rejects.toThrow(testError);
	});

	it("should return 500 response when no error handling is provided", async () => {
		const endpoint = createEndpoint(
			"/",
			{
				method: "GET",
			},
			async () => {
				throw new Error("Test error");
			},
		);

		const router = createRouter({ endpoint });
		const response = await router.handler(new Request("http://localhost"));
		expect(response.status).toBe(500);
	});

	it("should handle APIError directly when no onError is provided", async () => {
		const apiError = new APIError("NOT_FOUND", { message: "Resource not found" });
		const endpoint = createEndpoint(
			"/",
			{
				method: "GET",
			},
			async () => {
				throw apiError;
			},
		);

		const router = createRouter({ endpoint });
		const response = await router.handler(new Request("http://localhost"));
		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body.message).toBe("Resource not found");
	});
});

describe("extend", () => {
	it("should extend the router with new endpoints", async () => {
		const initialEndpoint = createEndpoint("/initial", { method: "GET" }, async () => ({}));
		const router = createRouter({ initialEndpoint });
		assert.ok(router.endpoints.initialEndpoint.path === "/initial");

		const dynamicEndpoint = createEndpoint(
			"/dynamic_added",
			{
				method: "POST",
			},
			async (c) => {
				return { message: "dynamically added", body: c.body };
			},
		);

		const extendedRouter = router.extend({ dynamicEndpoint });
		assert.ok(extendedRouter.endpoints.initialEndpoint.path === "/initial");
		assert.ok(extendedRouter.endpoints.dynamicEndpoint.path === "/dynamic_added");

		const dynamicRequest = new Request("http://localhost/dynamic_added", {
			method: "POST",
			body: JSON.stringify({ test: "data" }),
			headers: {
				"Content-Type": "application/json",
			},
		});
		const dynamicResponse = await extendedRouter.handler(dynamicRequest);
		expect(dynamicResponse.status).toBe(200);
		const jsonResponse = await dynamicResponse.json();
		expect(jsonResponse.message).toBe("dynamically added");
		expect(jsonResponse.body).toEqual({ test: "data" });
	});

});
