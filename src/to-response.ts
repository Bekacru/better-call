import { APIError } from "./error";

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
			statusText: data.stack,
			headers: {
				...data.headers,
				...init?.headers,
			},
		});
	}
	let body: BodyInit;
	let headers: HeadersInit = {
		"Content-Type": "application/json",
	};

	if (typeof data === "string") {
		body = data;
		headers["Content-Type"] = "text/plain";
	} else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
		body = data;
		headers["Content-Type"] = "application/octet-stream";
	} else if (data instanceof Blob) {
		body = data;
		headers["Content-Type"] = data.type || "application/octet-stream";
	} else if (data instanceof FormData) {
		body = data;
		headers = {};
	} else if (data instanceof URLSearchParams) {
		body = data;
		headers["Content-Type"] = "application/x-www-form-urlencoded";
	} else if (data instanceof ReadableStream) {
		body = data;
		headers["Content-Type"] = "application/octet-stream";
	} else if (data === null || data === undefined) {
		body = "";
		headers["Content-Type"] = "text/plain";
	} else {
		body = JSON.stringify(data);
		headers["Content-Type"] = "application/json";
	}

	if (init?.headers) {
		headers = { ...headers, ...init.headers };
	}

	return new Response(body, {
		...init,
		headers,
	});
}
