import { APIError } from "./error";

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

export function toResponse(data?: any, init?: ResponseInit): Response {
	if (data instanceof Response) {
		if (init?.headers instanceof Headers) {
			init.headers.forEach((value, key) => {
				data.headers.set(key, value);
			});
		}
		return data;
	}
	if (data?._flag === "json") {
		const routerResponse = data.routerResponse;
		if (routerResponse instanceof Response) {
			return routerResponse;
		}
		return toResponse(data.body, {
			headers: data.headers,
			status: data.status,
		});
	}
	if (data instanceof APIError) {
		return toResponse(data.body, {
			status: data.statusCode,
			statusText: data.status.toString(),
			headers: {
				...(data.headers instanceof Headers
					? Object.fromEntries(data.headers.entries())
					: data?.headers),
				...(init?.headers instanceof Headers
					? Object.fromEntries(init.headers.entries())
					: init?.headers),
			},
		});
	}
	let body: BodyInit;
	let headers = new Headers(init?.headers);

	if (typeof data === "string") {
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
	} else if (data === null || data === undefined) {
		body = "";
		headers.set("Content-Type", "text/plain");
	} else if (isJSONSerializable(data)) {
		body = JSON.stringify(data);
		headers.set("Content-Type", "application/json");
	} else {
		body = data;
	}

	return new Response(body, {
		...init,
		headers,
	});
}
