import { APIError } from "./error";
import { isAPIError } from "./utils";

function isJSONSerializable(value: any) {
	if (value === undefined) {
		return false;
	}
	const t = typeof value;
	if (t === "string" || t === "number" || t === "boolean" || t === null) {
		return true;
	}
	if (t !== "object") {
		return false;
	}
	if (Array.isArray(value)) {
		return true;
	}
	if (value.buffer) {
		return false;
	}
	return (
		(value.constructor && value.constructor.name === "Object") ||
		typeof value.toJSON === "function"
	);
}

export type JSONResponse = {
	body: Record<string, any>;
	routerResponse: ResponseInit | undefined;
	_flag: "json";
};

function isJSONResponse(value: any): value is JSONResponse {
	return "_flag" in value && value._flag === "json";
}

export function toResponse(data?: any, init?: ResponseInit): Response {
	if (data instanceof Response) {
		if (init?.headers instanceof Headers) {
			init.headers.forEach((value, key) => {
				data.headers.set(key, value);
			});
		}
		return data;
	}
	if (isJSONResponse(data)) {
		const body = data.body;
		const routerResponse = data.routerResponse;
		if (routerResponse instanceof Response) {
			return routerResponse;
		}
		return toResponse(body, {
			...routerResponse,
			headers: init?.headers ?? routerResponse?.headers,
			status: init?.status ?? routerResponse?.status,
			statusText: init?.statusText ?? routerResponse?.statusText,
		});
	}
	if (isAPIError(data)) {
		return toResponse(data.body, {
			status: init?.status ?? data.statusCode,
			statusText: data.status.toString(),
			headers: init?.headers || data.headers,
		});
	}
	let body = data;
	let headers = new Headers(init?.headers);
	if (!data) {
		if (data === null) {
			body = JSON.stringify(null);
		}
		headers.set("content-type", "application/json");
	} else if (typeof data === "string") {
		body = data;
		headers.set("Content-Type", "text/plain");
	} else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
		body = data;
		headers.set("Content-Type", "application/octet-stream");
	} else if (data instanceof Blob) {
		body = data;
		headers.set("Content-Type", data.type || "application/octet-stream");
	} else if (data instanceof FormData) {
		body = data;
	} else if (data instanceof URLSearchParams) {
		body = data;
		headers.set("Content-Type", "application/x-www-form-urlencoded");
	} else if (data instanceof ReadableStream) {
		body = data;
		headers.set("Content-Type", "application/octet-stream");
	} else if (isJSONSerializable(data)) {
		body = JSON.stringify(data, (key, value) => {
			if (typeof value === "bigint") {
				return value.toString();
			}
			return value;
		});
		headers.set("Content-Type", "application/json");
	}

	return new Response(body, {
		...init,
		headers,
	});
}
