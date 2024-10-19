import type { statusCode } from "./utils";

type Status = keyof typeof statusCode;

export class APIError extends Error {
	status: Status;
	headers: Headers;
	body: Record<string, any>;
	constructor(status: Status, body?: Record<string, any>, headers?: Headers) {
		super(`API Error: ${status} ${body?.message ?? ""}`, {
			cause: body,
		});
		this.status = status;
		this.body = body ?? {};
		this.stack = "";
		this.headers = headers || new Headers();
		this.name = "BetterCallAPIError";
	}
}
