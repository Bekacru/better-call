//https://github.com/honojs/hono/blob/main/src/helper/cookie/index.ts

import type { BufferSource } from "stream/web";
import {
  parse,
  parseSigned,
  serialize,
  serializeSigned,
  type CookieOptions,
  type CookiePrefixOptions,
} from "./cookie-utils";

export const getCookie = (
  cookie: string,
  key: string,
  prefix?: CookiePrefixOptions
) => {
  if (!cookie) {
    return undefined;
  }
  let finalKey = key;
  if (prefix) {
    if (prefix === "secure") {
      finalKey = "__Secure-" + key;
    } else if (prefix === "host") {
      finalKey = "__Host-" + key;
    } else {
      return undefined;
    }
  }
  const obj = parse(cookie, finalKey);
  return obj[finalKey];
};

export const setCookie = (
  header: Headers,
  name: string,
  value: string,
  opt?: CookieOptions
): void => {
  const existingCookies = header.get("Set-Cookie");
  if (existingCookies) {
    const cookies = existingCookies.split(", ");
    const updatedCookies = cookies.filter(
      (cookie) => !cookie.startsWith(`${name}=`)
    );
    header.delete("Set-Cookie");
    updatedCookies.forEach((cookie) => header.append("Set-Cookie", cookie));
  }

  let cookie;
  if (opt?.prefix === "secure") {
    cookie = serialize("__Secure-" + name, value, {
      path: "/",
      ...opt,
      secure: true,
    });
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
  opt?: CookieOptions
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
  prefix?: CookiePrefixOptions
) => {
  const cookie = header.get("cookie");
  if (!cookie) {
    return undefined;
  }
  let finalKey = key;
  if (prefix) {
    if (prefix === "secure") {
      finalKey = "__Secure-" + key;
    } else if (prefix === "host") {
      finalKey = "__Host-" + key;
    }
  }
  const obj = await parseSigned(cookie, secret, finalKey);
  return obj[finalKey];
};
