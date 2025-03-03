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

export function isAPIError(error: any) {
	return error instanceof APIError || error.name === "APIError";
}
