import { describe, expect, it } from "vitest";
import { createEndpoint } from "./endpoint";
import { z } from "zod";
import { signCookieValue } from "./crypto";
import { extractSetCookes, parseCookies, parseSetCookie } from "./cookies";

describe("parseCookies", () => {
	it("should parse cookies", () => {
		const cookies = parseCookies("test=test; test2=test 2");
		expect(cookies.get("test")).toBe("test");
		expect(cookies.get("test2")).toBe("test 2");
	});

	it("should parse cookies with encoded values", () => {
		const cookies = parseCookies("test=test; test2=test%202");
		expect(cookies.get("test")).toBe("test");
		expect(cookies.get("test2")).toBe("test 2");
	});
});

describe("parseSetCookie", () => {
	it("should parse a simple Set-Cookie header", () => {
		const header = "test=test; Path=/; HttpOnly; Secure";
		const cookie = parseSetCookie(header);
		expect(cookie.name).toBe("test");
		expect(cookie.value).toBe("test");
		expect(cookie.path).toBe("/");
		expect(cookie.httpOnly).toBe(true);
		expect(cookie.secure).toBe(true);
	});

	it("should parse multiple attributes", () => {
		const header =
			"sessionId=abc123; Path=/; Domain=example.com; HttpOnly; Secure; Max-Age=3600; Expires=Wed, 21 Oct 2025 07:28:00 GMT; SameSite=Lax";
		const cookie = parseSetCookie(header);

		expect(cookie.name).toBe("sessionId");
		expect(cookie.value).toBe("abc123");
		expect(cookie.path).toBe("/");
		expect(cookie.domain).toBe("example.com");
		expect(cookie.httpOnly).toBe(true);
		expect(cookie.secure).toBe(true);
		expect(cookie.maxAge).toBe(3600);
		expect(cookie.expires?.toISOString()).toBe("2025-10-21T07:28:00.000Z");
		expect(cookie.sameSite).toBe("Lax");
	});

	it("should parse Set-Cookie with prefix and partitioned flag", () => {
		const header = "__Host-test=value; Path=/; Secure; Partitioned; Prefix=__Host";
		const cookie = parseSetCookie(header);
		expect(cookie.prefix).toBe("__Host");
		expect(cookie.partitioned).toBe(true);
		expect(cookie.secure).toBe(true);
	});
});

describe("extractSetCookies", () => {
	it("should extract multiple Set-Cookie headers", () => {
		const headers = new Headers();
		headers.append("Set-Cookie", "a=1; Path=/");
		headers.append("Set-Cookie", "b=2; HttpOnly");
		const cookies = extractSetCookes(headers);
		expect(cookies).toHaveLength(2);
		expect(cookies[0].name).toBe("a");
		expect(cookies[0].value).toBe("1");
		expect(cookies[0].path).toBe("/");
		expect(cookies[1].name).toBe("b");
		expect(cookies[1].value).toBe("2");
		expect(cookies[1].httpOnly).toBe(true);
	});
});

describe("get-cookies", () => {
	it("should get cookies", async () => {
		const endpoint = createEndpoint(
			"/",
			{
				method: "POST",
				body: z.object({
					cookieName: z.string(),
				}),
				requireHeaders: true,
			},
			async (c) => {
				return c.getCookie(c.body.cookieName);
			},
		);
		const response = await endpoint({
			body: {
				cookieName: "test",
			},
			headers: {
				cookie: "test=test",
			},
		});
		expect(response).toBe("test");
	});

	it("should get signed cookies", async () => {
		const secret = "test";
		const endpoint = createEndpoint(
			"/",
			{
				method: "POST",
				body: z.object({
					cookieName: z.string(),
				}),
				requireHeaders: true,
			},
			async (c) => {
				return c.getSignedCookie(c.body.cookieName, secret);
			},
		);
		const response = await endpoint({
			body: {
				cookieName: "test",
			},
			headers: {
				cookie: `test=${await signCookieValue("test", secret)}`,
			},
		});
		expect(response).toBe("test");
	});

	it("should return null if signature is invalid", async () => {
		const secret = "test";
		const endpoint = createEndpoint(
			"/",
			{
				method: "POST",
				body: z.object({
					cookieName: z.string(),
				}),
				requireHeaders: true,
			},
			async (c) => {
				return c.getSignedCookie(c.body.cookieName, secret);
			},
		);
		const response = await endpoint({
			body: {
				cookieName: "test",
			},
			headers: {
				cookie: `test=invalid_signature`,
			},
		});
		expect(response).toBe(null);
	});

	it("should return false if secret is invalid", async () => {
		const secret = "test";
		const endpoint = createEndpoint(
			"/",
			{
				method: "POST",
				body: z.object({
					cookieName: z.string(),
				}),
				requireHeaders: true,
			},
			async (c) => {
				return c.getSignedCookie(c.body.cookieName, "invalid_secret");
			},
		);
		const response = await endpoint({
			body: {
				cookieName: "test",
			},
			headers: {
				cookie: `test=${await signCookieValue("test", secret)}`,
			},
		});
		expect(response).toBe(false);
	});
});

describe("set-cookies", () => {
	it("should set cookie", async () => {
		const endpoint = createEndpoint(
			"/",
			{
				method: "POST",
			},
			async (c) => {
				c.setCookie("test", "test");
			},
		);
		const response = await endpoint({
			returnHeaders: true,
		});
		expect(response.headers.get("set-cookie")).toBe("test=test");
	});

	it("should set multiple cookies", async () => {
		const endpoint = createEndpoint(
			"/",
			{
				method: "POST",
			},
			async (c) => {
				c.setCookie("test", "test");
				c.setCookie("test2", "test2");
				c.setCookie("test3", "test3");
			},
		);
		const response = await endpoint({
			returnHeaders: true,
		});
		expect(response.headers.get("set-cookie")).toBe("test=test, test2=test2, test3=test3");
	});

	it("should apply options", async () => {
		const endpoint = createEndpoint(
			"/",
			{
				method: "POST",
			},
			async (c) => {
				c.setCookie("test", "test", {
					secure: true,
					httpOnly: true,
					path: "/",
				});
			},
		);
		const response = await endpoint({
			returnHeaders: true,
		});

		expect(response.headers.get("Set-Cookie")).toBe("test=test; Path=/; HttpOnly; Secure");
	});

	it("should apply multiple cookies with options", async () => {
		const endpoint = createEndpoint(
			"/",
			{
				method: "POST",
			},
			async (c) => {
				c.setCookie("test", "test", {
					secure: true,
					httpOnly: true,
					path: "/",
				});
				c.setCookie("test2", "test2", {
					secure: true,
					httpOnly: true,
					path: "/",
				});
			},
		);
		const response = await endpoint({
			returnHeaders: true,
		});
		expect(response.headers.get("Set-Cookie")).toBe(
			"test=test; Path=/; HttpOnly; Secure, test2=test2; Path=/; HttpOnly; Secure",
		);
	});

	it("should set signed cookie", async () => {
		const endpoint = createEndpoint(
			"/",
			{
				method: "POST",
			},
			async (c) => {
				await c.setSignedCookie("test", "test", "test");
			},
		);
		const response = await endpoint({
			returnHeaders: true,
		});
		const setCookie = response.headers.get("set-cookie");
		const signature = setCookie?.split(".")[1];
		expect(setCookie).toContain("test=test.");
		expect(signature?.length).toBeGreaterThan(10);
	});

	it("should properly sign cookies", async () => {
		const endpoint = createEndpoint(
			"/",
			{
				method: "POST",
			},
			async (c) => {
				await c.setSignedCookie("test", "test", "test");
			},
		);
		const response = await endpoint({
			returnHeaders: true,
		});
		const setCookie = response.headers.get("set-cookie");
		const endpoint2 = createEndpoint(
			"/",
			{
				method: "POST",
				requireHeaders: true,
			},
			async (c) => {
				return await c.getSignedCookie("test", "test");
			},
		);
		const response2 = await endpoint2({
			headers: {
				cookie: setCookie!,
			},
		});
		expect(response2).toBe("test");
	});
});

describe("return-cookies", () => {
	it("should return cookies when returnCookies is true", async () => {
		const endpoint = createEndpoint("/", { method: "POST" }, async (c) => {
			c.setCookie("test", "test");
		});

		const response = await endpoint({ returnCookies: true });
		expect(response.cookies).toHaveLength(1);
		expect(response.cookies?.[0].name).toBe("test");
		expect(response.cookies?.[0].value).toBe("test");
	});

	it("should return multiple cookies when returnCookies is true", async () => {
		const endpoint = createEndpoint("/", { method: "POST" }, async (c) => {
			c.setCookie("test", "test");
			c.setCookie("test2", "test2");
			c.setCookie("test3", "test3");
		});

		const response = await endpoint({ returnCookies: true });
		expect(response.cookies).toHaveLength(3);
		const names = response.cookies?.map((c) => c.name);
		expect(names).toContain("test");
		expect(names).toContain("test2");
		expect(names).toContain("test3");
	});

	it("should return cookies with options applied", async () => {
		const endpoint = createEndpoint("/", { method: "POST" }, async (c) => {
			c.setCookie("test", "test", {
				secure: true,
				httpOnly: true,
				path: "/",
			});
		});

		const response = await endpoint({ returnCookies: true });
		const cookie = response.cookies?.[0];
		expect(cookie?.name).toBe("test");
		expect(cookie?.value).toBe("test");
		expect(cookie?.path).toBe("/");
		expect(cookie?.secure).toBe(true);
		expect(cookie?.httpOnly).toBe(true);
	});

	it("should return headers and cookies when both returnHeaders and returnCookies are true", async () => {
		const endpoint = createEndpoint("/", { method: "POST" }, async (c) => {
			c.setCookie("test", "test");
			c.setCookie("test2", "test2");
		});

		const response = await endpoint({ returnHeaders: true, returnCookies: true });
		expect(response.headers.get("set-cookie")).toBe("test=test, test2=test2");
		expect(response.cookies).toHaveLength(2);
		const names = response.cookies?.map((c) => c.name);
		expect(names).toContain("test");
		expect(names).toContain("test2");
	});

	it("should set a signed cookie and return it via returnCookies", async () => {
		const secret = "test-secret";

		const endpoint = createEndpoint("/", { method: "POST" }, async (c) => {
			await c.setSignedCookie("session", "abc123", secret);
		});

		const response = await endpoint({ returnCookies: true });

		expect(response.cookies).toHaveLength(1);
		const cookie = response.cookies?.[0];
		expect(cookie?.name).toBe("session");
		expect(cookie?.value).toContain("abc123.");

		const signature = cookie?.value.split(".")[1];
		expect(signature?.length).toBeGreaterThan(10);
	});
});
