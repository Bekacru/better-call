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
    "Created": 201,
    "Accepted": 202,
    "No Content": 204,
    "Multiple Choices": 300,
    "Moved Permanently": 301,
    "Found": 302,
    "See Other": 303,
    "Not Modified": 304,
    "Temporary Redirect": 307,
    "Bad Request": 400,
    "Unauthorized": 401,
    "Payment Required": 402,
    "Forbidden": 403,
    "Not Found": 404,
    "Method Not Allowed": 405,
    "Not Acceptable": 406,
    "Proxy Authentication Required": 407,
    "Request Timeout": 408,
    "Conflict": 409,
    "Gone": 410,
    "Length Required": 411,
    "Precondition Failed": 412,
    "Payload Too Large": 413,
    "URI Too Long": 414,
    "Unsupported Media Type": 415,
    "Range Not Satisfiable": 416,
    "Expectation Failed": 417,
    "I'm a teapot": 418,
    "Misdirected Request": 421,
    "Unprocessable Entity": 422,
    "Locked": 423,
    "Failed Dependency": 424,
    "Too Early": 425,
    "Upgrade Required": 426,
    "Precondition Required": 428,
    "Too Many Requests": 429,
    "Request Header Fields Too Large": 431,
    "Unavailable For Legal Reasons": 451,
    "Internal Server Error": 500,
    "Not Implemented": 501,
    "Bad Gateway": 502,
    "Service Unavailable": 503,
    "Gateway Timeout": 504,
    "HTTP Version Not Supported": 505,
    "Variant Also Negotiates": 506,
    "Insufficient Storage": 507,
    "Loop Detected": 508,
    "Not Extended": 510,
    "Network Authentication Required": 511,
}