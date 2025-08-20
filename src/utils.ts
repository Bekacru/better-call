import { APIError } from "./error";

export async function getBody(request: Request) {
	const contentType = request.headers.get("content-type") || "";

	if (!request.body) {
		return undefined;
	}

	if (contentType.includes("application/json")) {
		return await request.json();
	}

	if (contentType.includes("application/x-www-form-urlencoded")) {
		const formData = await request.formData();
		const result: Record<string, string> = {};
		formData.forEach((value, key) => {
			result[key] = value.toString();
		});
		return result;
	}

	if (contentType.includes("multipart/form-data")) {
		const formData = await request.formData();
		const result: Record<string, any> = {};
		formData.forEach((value, key) => {
			result[key] = value;
		});
		return result;
	}

	if (contentType.includes("text/plain")) {
		return await request.text();
	}

	if (contentType.includes("application/octet-stream")) {
		return await request.arrayBuffer();
	}

	if (
		contentType.includes("application/pdf") ||
		contentType.includes("image/") ||
		contentType.includes("video/")
	) {
		const blob = await request.blob();
		return blob;
	}

	if (contentType.includes("application/stream") || request.body instanceof ReadableStream) {
		return request.body;
	}

	return await request.text();
}

export function isAPIError(error: any): error is APIError {
	return error instanceof APIError || error?.name === "APIError";
}

export function tryDecode(str: string) {
	try {
		return str.includes("%") ? decodeURIComponent(str) : str;
	} catch {
		return str;
	}
}

type Success<T> = {
	data: T;
	error: null;
};

type Failure<E> = {
	data: null;
	error: E;
};

export type Result<T, E = Error> = Success<T> | Failure<E>;

export async function tryCatch<T, E = Error>(promise: Promise<T>): Promise<Result<T, E>> {
	try {
		const data = await promise;
		return { data, error: null };
	} catch (error) {
		return { data: null, error: error as E };
	}
}
