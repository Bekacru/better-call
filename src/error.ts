import type { statusCode } from "./utils";

type Status = keyof typeof statusCode;

export class APIError extends Error {
	status: Status;
	headers: Headers;
	body: {
		code?: string;
		message?: string;
		[key: string]: any;
	};
	constructor(status: Status, body?: Record<string, any>, headers?: Headers) {
		super(`API Error: ${status} ${body?.message ?? ""}`, {
			cause: body,
		});

		this.status = status;
		this.body = body ?? {};
		this.body.code = body?.message
			? body.message
					.toUpperCase()
					.replace(/ /g, "_")
					.replace(/[^A-Z0-9_]/g, "")
			: status;
		this.stack = "";

		this.headers = headers ?? new Headers();
		if (!this.headers.has("Content-Type")) {
			this.headers.set("Content-Type", "application/json");
		}
		this.name = "BetterCallAPIError";
	}
}
