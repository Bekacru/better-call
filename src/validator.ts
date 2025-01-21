import type { ZodError } from "zod";
import type { EndpointContext, EndpointOptions, InputContext } from "./endpoint";

type ValidationResponse =
	| {
			data: {
				body: any;
				query: any;
			};
			error: null;
	  }
	| {
			data: null;
			error: {
				message: string;
			};
	  };

/**
 * Runs validation on body and query
 * @returns error and data object
 */
export function runValidation(
	options: EndpointOptions,
	context: InputContext<any, any> = {},
): ValidationResponse {
	let request = {
		body: context.body,
		query: context.query,
	} as {
		body: any;
		query: any;
	};
	if (options.body) {
		const result = options.body.safeParse(context.body);
		if (result.error) {
			return {
				data: null,
				error: fromError(result.error),
			};
		}
		request.body = result.data;
	}
	if (options.query) {
		const result = options.query.safeParse(context.query);
		if (result.error) {
			return {
				data: null,
				error: fromError(result.error),
			};
		}
		request.query = result.data;
	}
	if (options.requireHeaders && !(context.headers instanceof Headers)) {
		return {
			data: null,
			error: { message: "Validation Error: Headers are required" },
		};
	}
	if (options.requireRequest && !context.request) {
		return {
			data: null,
			error: { message: "Validation Error: Request is required" },
		};
	}
	return {
		data: request,
		error: null,
	};
}

export function fromError(error: ZodError) {
	const errorMessages: string[] = [];

	for (const issue of error.issues) {
		const path = issue.path.join(".");
		const message = issue.message;

		if (path) {
			errorMessages.push(`${message} at "${path}"`);
		} else {
			errorMessages.push(message);
		}
	}
	return {
		message: `Validation error: ${errorMessages.join(", ")}`,
	};
}
