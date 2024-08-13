//https://github.com/honojs/hono/blob/main/src/helper/cookie/index.ts

import {
	parse,
	parseSigned,
	serialize,
	serializeSigned,
	type CookieOptions,
	type CookiePrefixOptions,
} from "./cookie";

export const getCookie = (cookie?: string, key?: string, prefix?: CookiePrefixOptions) => {
	if (!cookie) {
		return undefined;
	}
	let finalKey = key;
	if (prefix === "secure") {
		finalKey = "__Secure-" + key;
	} else if (prefix === "host") {
		finalKey = "__Host-" + key;
	} else {
		return undefined;
	}
	const obj = parse(cookie, finalKey);
	return obj[finalKey];
};

export const setCookie = (
	header: Headers,
	name: string,
	value: string,
	opt?: CookieOptions,
): void => {
	// Cookie names prefixed with __Secure- can be used only if they are set with the secure attribute.
	// Cookie names prefixed with __Host- can be used only if they are set with the secure attribute, must have a path of / (meaning any path at the host)
	// and must not have a Domain attribute.
	// Read more at https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#cookie_prefixes'
	let cookie;
	if (opt?.prefix === "secure") {
		cookie = serialize("__Secure-" + name, value, { path: "/", ...opt, secure: true });
	} else if (opt?.prefix === "host") {
		cookie = serialize("__Host-" + name, value, {
			...opt,
			path: "/",
			secure: true,
			domain: undefined,
		});
	} else {
		cookie = serialize(name, value, { path: "/", ...opt });
	}
	header.append("Set-Cookie", cookie);
};

export const setSignedCookie = async (
	header: Headers,
	name: string,
	value: string,
	secret: string | BufferSource,
	opt?: CookieOptions,
): Promise<void> => {
	let cookie;
	if (opt?.prefix === "secure") {
		cookie = await serializeSigned("__Secure-" + name, value, secret, {
			path: "/",
			...opt,
			secure: true,
		});
	} else if (opt?.prefix === "host") {
		cookie = await serializeSigned("__Host-" + name, value, secret, {
			...opt,
			path: "/",
			secure: true,
			domain: undefined,
		});
	} else {
		cookie = await serializeSigned(name, value, secret, { path: "/", ...opt });
	}
	header.append("Set-Cookie", cookie);
};

export const getSignedCookie = async (
	header: Headers,
	secret: string,
	key: string,
	prefix?: CookiePrefixOptions,
) => {
	const cookie = header.get("Cookie");
	if (!cookie) {
		return undefined;
	}
	let finalKey = key;
	if (prefix === "secure") {
		finalKey = "__Secure-" + key;
	} else if (prefix === "host") {
		finalKey = "__Host-" + key;
	}
	const obj = await parseSigned(cookie, secret, finalKey);
	return obj[finalKey];
};
