import { describe, expect, it } from "vitest";
import { getRequest } from "./request";

describe("router", () => {
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
		expect(new URL(req.url).href).toBe(
			"http://localhost:3000/api/auth/callback",
		);
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
