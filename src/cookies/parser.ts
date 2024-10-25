//https://github.com/nfriedly/set-cookie-parser/blob/master/lib/set-cookie.js

const defaultParseOptions = {
  decodeValues: true,
  map: false,
  silent: false,
};

function isNonEmptyString(str: string): boolean {
  return typeof str === "string" && !!str.trim();
}

function parseString(setCookieValue: string, options: any): any {
  const parts = setCookieValue.split(";").filter(isNonEmptyString);

  const nameValuePairStr = parts.shift();
  const parsed = parseNameValuePair(nameValuePairStr!);
  const name = parsed.name;
  let value = parsed.value;

  options = options
    ? Object.assign({}, defaultParseOptions, options)
    : defaultParseOptions;

  try {
    value = options.decodeValues ? decodeURIComponent(value) : value; // decode cookie value
  } catch (e) {
    console.error(
      "set-cookie-parser encountered an error while decoding a cookie with value '" +
        value +
        "'. Set options.decodeValues to false to disable this feature.",
      e
    );
  }

  const cookie: any = {
    name: name,
    value: value,
  };

  parts.forEach(function (part) {
    const sides = part.split("=");
    const key = sides.shift()?.trimStart().toLowerCase();
    const value = sides.join("=");
    if (key === "expires") {
      cookie.expires = new Date(value);
    } else if (key === "max-age") {
      cookie.maxAge = parseInt(value, 10);
    } else if (key === "secure") {
      cookie.secure = true;
    } else if (key === "httponly") {
      cookie.httpOnly = true;
    } else if (key === "samesite") {
      cookie.sameSite = value;
    } else if (key === "partitioned") {
      cookie.partitioned = true;
    } else {
      cookie[key as string] = value;
    }
  });

  return cookie;
}

function parseNameValuePair(nameValuePairStr: string): {
  name: string;
  value: string;
} {
  const nameValueArr = nameValuePairStr.split("=");
  let name = "";
  let value = "";
  if (nameValueArr.length > 1) {
    name = nameValueArr.shift() || "";
    value = nameValueArr.join("="); // everything after the first =, joined by a "=" if there was more than one part
  } else {
    value = nameValuePairStr;
  }

  return { name: name, value: value };
}

function parse(input: any, options: any): any {
  options = options
    ? Object.assign({}, defaultParseOptions, options)
    : defaultParseOptions;

  if (!input) {
    return options.map ? {} : [];
  }

  if (input.headers) {
    if (typeof input.headers.getSetCookie === "function") {
      input = input.headers.getSetCookie();
    } else if (input.headers["set-cookie"]) {
      input = input.headers["set-cookie"];
    } else {
      const sch =
        input.headers[
          Object.keys(input.headers).find(function (key) {
            return key.toLowerCase() === "set-cookie";
          }) || ""
        ];
      if (!sch && input.headers.cookie && !options.silent) {
        console.warn(
          "Warning: set-cookie-parser appears to have been called on a request object. It is designed to parse Set-Cookie headers from responses, not Cookie headers from requests. Set the option {silent: true} to suppress this warning."
        );
      }
      input = sch;
    }
  }
  if (!Array.isArray(input)) {
    input = [input];
  }

  if (!options.map) {
    return input.filter(isNonEmptyString).map(function (str: string) {
      return parseString(str, options);
    });
  } else {
    const cookies: any = {};
    return input
      .filter(isNonEmptyString)
      .reduce(function (cookies: Record<string, any>, str: string) {
        const cookie = parseString(str, options);
        cookies[cookie.name] = cookie;
        return cookies;
      }, cookies);
  }
}

function splitCookiesString(cookiesString: string | string[]): string[] {
  if (Array.isArray(cookiesString)) {
    return cookiesString;
  }
  if (typeof cookiesString !== "string") {
    return [];
  }

  const cookiesStrings: string[] = [];
  let pos = 0;
  let start: number;
  let ch: string;
  let lastComma: number;
  let nextStart: number;
  let cookiesSeparatorFound: boolean;

  function skipWhitespace() {
    if (Array.isArray(cookiesString)) {
      return pos < cookiesString.length;
    }
    while (pos < cookiesString.length && /\s/.test(cookiesString.charAt(pos))) {
      pos += 1;
    }
    return pos < cookiesString.length;
  }

  function notSpecialChar() {
    if (Array.isArray(cookiesString)) {
      return pos < cookiesString.length;
    }
    ch = cookiesString.charAt(pos);
    return ch !== "=" && ch !== ";" && ch !== ",";
  }

  while (pos < cookiesString.length) {
    start = pos;
    cookiesSeparatorFound = false;

    while (skipWhitespace()) {
      ch = cookiesString.charAt(pos);
      if (ch === ",") {
        lastComma = pos;
        pos += 1;

        skipWhitespace();
        nextStart = pos;

        while (pos < cookiesString.length && notSpecialChar()) {
          pos += 1;
        }

        if (pos < cookiesString.length && cookiesString.charAt(pos) === "=") {
          cookiesSeparatorFound = true;
          pos = nextStart;
          cookiesStrings.push(cookiesString.substring(start, lastComma));
          start = pos;
        } else {
          pos = lastComma + 1;
        }
      } else {
        pos += 1;
      }
    }

    if (!cookiesSeparatorFound || pos >= cookiesString.length) {
      cookiesStrings.push(cookiesString.substring(start, cookiesString.length));
    }
  }

  return cookiesStrings;
}

export { parse, parseString, splitCookiesString };
