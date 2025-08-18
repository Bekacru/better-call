import { describe, expect, it, vi } from "vitest";
import { getRequest } from "./request";
import { IncomingMessage } from "node:http";
import { Socket } from "node:net";

describe("getRequest", () => {
	it("should handle Express pre-parsed body", async () => {
		// Mock an Express request with pre-parsed body
		const socket = new Socket();
		const req = new IncomingMessage(socket) as any;
		
		// Set up the request properties
		req.url = "/api/test";
		req.method = "POST";
		req.headers = {
			"host": "localhost:3000",
			"content-type": "application/json"
		};
		
		// Simulate Express body-parser already parsed the body
		req.body = { message: "Hello World", id: 123 };
		
		// Call getRequest
		const request = getRequest({
			request: req,
			base: "http://localhost:3000"
		});
		
		// Verify the request was created successfully
		expect(request).toBeInstanceOf(Request);
		expect(request.url).toBe("http://localhost:3000/api/test");
		expect(request.method).toBe("POST");
		
		// Verify the body can be read
		const bodyText = await request.text();
		expect(bodyText).toBe(JSON.stringify({ message: "Hello World", id: 123 }));
	});

	it("should handle Express pre-parsed string body", async () => {
		const socket = new Socket();
		const req = new IncomingMessage(socket) as any;
		
		req.url = "/api/test";
		req.method = "POST";
		req.headers = {
			"host": "localhost:3000",
			"content-type": "text/plain"
		};
		
		// Simulate Express body-parser parsed a string body
		req.body = "Plain text body";
		
		const request = getRequest({
			request: req,
			base: "http://localhost:3000"
		});
		
		expect(request).toBeInstanceOf(Request);
		const bodyText = await request.text();
		expect(bodyText).toBe("Plain text body");
	});

	it("should handle Express subrouter with baseUrl", async () => {
		const socket = new Socket();
		const req = new IncomingMessage(socket) as any;
		
		// Simulate Express subrouter where baseUrl is the mount path
		req.baseUrl = "/api/v1";
		req.url = "/users/123";
		req.method = "GET";
		req.headers = {
			"host": "localhost:3000"
		};
		
		const request = getRequest({
			request: req,
			base: "http://localhost:3000"
		});
		
		// Should combine baseUrl + url
		expect(request.url).toBe("http://localhost:3000/api/v1/users/123");
	});

	it("should handle raw body stream when no Express body parser", async () => {
		const socket = new Socket();
		const req = new IncomingMessage(socket) as any;
		
		req.url = "/api/test";
		req.method = "POST";
		req.headers = {
			"host": "localhost:3000",
			"content-type": "application/json",
			"content-length": "20"
		};
		req.httpVersionMajor = 1;
		
		// No req.body property - raw stream should be used
		expect(req.body).toBeUndefined();
		
		// Mock the stream events
		req.on = vi.fn();
		req.pause = vi.fn();
		req.resume = vi.fn();
		req.destroy = vi.fn();
		req.destroyed = false;
		
		const request = getRequest({
			request: req,
			base: "http://localhost:3000"
		});
		
		expect(request).toBeInstanceOf(Request);
		expect(request.url).toBe("http://localhost:3000/api/test");
		
		// Verify stream handlers were set up
		expect(req.on).toHaveBeenCalledWith("error", expect.any(Function));
		expect(req.on).toHaveBeenCalledWith("end", expect.any(Function));
		expect(req.on).toHaveBeenCalledWith("data", expect.any(Function));
	});

	it("should handle both baseUrl and pre-parsed body together", async () => {
		const socket = new Socket();
		const req = new IncomingMessage(socket) as any;
		
		// Express subrouter with body parser
		req.baseUrl = "/api";
		req.url = "/webhook";
		req.method = "POST";
		req.headers = {
			"host": "example.com",
			"content-type": "application/json"
		};
		req.body = { event: "user.created", data: { id: 1, name: "Test" } };
		
		const request = getRequest({
			request: req,
			base: "https://example.com"
		});
		
		expect(request.url).toBe("https://example.com/api/webhook");
		
		const bodyText = await request.text();
		expect(bodyText).toBe(JSON.stringify({ event: "user.created", data: { id: 1, name: "Test" } }));
	});
});