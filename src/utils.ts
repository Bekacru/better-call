export async function getBody(request: Request) {
    const contentType = request.headers.get('content-type') || '';

    if (!request.body) {
        return undefined
    }

    if (contentType.includes('application/json')) {
        return await request.json();
    }

    if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await request.formData();
        const result: Record<string, string> = {};
        formData.forEach((value, key) => {
            result[key] = value.toString();
        });
        return result;
    }

    if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        const result: Record<string, any> = {};
        formData.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }

    if (contentType.includes('text/plain')) {
        return await request.text();
    }

    if (contentType.includes('application/octet-stream')) {
        return await request.arrayBuffer();
    }

    if (contentType.includes('application/pdf') || contentType.includes('image/') || contentType.includes('video/')) {
        const blob = await request.blob();
        return blob;
    }

    if (contentType.includes('application/stream') || request.body instanceof ReadableStream) {
        return request.body;
    }

    return await request.text();
}


export function shouldSerialize(body: any) {
    return typeof body === "object" && body !== null && !(body instanceof Blob) && !(body instanceof FormData)
}

export const statusCode = {
    "OK": 200,
    "CREATED": 201,
    "ACCEPTED": 202,
    "NO_CONTENT": 204,
    "MULTIPLE_CHOICES": 300,
    "MOVED_PERMANENTLY": 301,
    "FOUND": 302,
    "SEE_OTHER": 303,
    "NOT_MODIFIED": 304,
    "TEMPORARY_REDIRECT": 307,
    "BAD_REQUEST": 400,
    "UNAUTHORIZED": 401,
    "PAYMENT_REQUIRED": 402,
    "FORBIDDEN": 403,
    "NOT_FOUND": 404,
    "METHOD_NOT_ALLOWED": 405,
    "NOT_ACCEPTABLE": 406,
    "PROXY_AUTHENTICATION_REQUIRED": 407,
    "REQUEST_TIMEOUT": 408,
    "CONFLICT": 409,
    "GONE": 410,
    "LENGTH_REQUIRED": 411,
    "PRECONDITION_FAILED": 412,
    "PAYLOAD_TOO_LARGE": 413,
    "URI_TOO_LONG": 414,
    "UNSUPPORTED_MEDIA_TYPE": 415,
    "RANGE_NOT_SATISFIABLE": 416,
    "EXPECTATION_FAILED": 417,
    "I'M_A_TEAPOT": 418,
    "MISDIRECTED_REQUEST": 421,
    "UNPROCESSABLE_ENTITY": 422,
    "LOCKED": 423,
    "FAILED_DEPENDENCY": 424,
    "TOO_EARLY": 425,
    "UPGRADE_REQUIRED": 426,
    "PRECONDITION_REQUIRED": 428,
    "TOO_MANY_REQUESTS": 429,
    "REQUEST_HEADER_FIELDS_TOO_LARGE": 431,
    "UNAVAILABLE_FOR_LEGAL_REASONS": 451,
    "INTERNAL_SERVER_ERROR": 500,
    "NOT_IMPLEMENTED": 501,
    "BAD_GATEWAY": 502,
    "SERVICE_UNAVAILABLE": 503,
    "GATEWAY_TIMEOUT": 504,
    "HTTP_VERSION_NOT_SUPPORTED": 505,
    "VARIANT_ALSO_NEGOTIATES": 506,
    "INSUFFICIENT_STORAGE": 507,
    "LOOP_DETECTED": 508,
    "NOT_EXTENDED": 510,
    "NETWORK_AUTHENTICATION_REQUIRED": 511,
}
