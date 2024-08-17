import type { statusCode } from "./utils";

type Status = keyof typeof statusCode;

export class APIError extends Error {
	status: Status;
	body: Record<string, any>;
	constructor(status: Status, body?: Record<string, any>) {
		super(`API Error: ${status} ${body?.message ?? ""}`, {
			cause: body,
		});
		this.status = status;
		this.body = body ?? {};
		this.stack = "";
		this.name = "BetterCallAPIError";
	}
}
