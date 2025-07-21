import type { EndpointOptions } from "./endpoint";
import type { InputContext } from "./context";
import type { StandardSchemaV1 } from "./standard-schema";

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
				issues: readonly StandardSchemaV1.Issue[];
			};
	  };

/**
 * Runs validation on body and query
 * @returns error and data object
 */
export async function runValidation(
	options: EndpointOptions,
	context: InputContext<any, any> = {},
): Promise<ValidationResponse> {
	let request = {
		body: context.body,
		query: context.query,
	} as {
		body: any;
		query: any;
	};
	if (options.body) {
		const result = await options.body["~standard"].validate(context.body);
		if (result.issues) {
			return {
				data: null,
				error: fromError(result.issues, "body"),
			};
		}
		request.body = result.value;
	}

	if (options.query) {
		const result = await options.query["~standard"].validate(context.query);
		if (result.issues) {
			return {
				data: null,
				error: fromError(result.issues, "query"),
			};
		}
		request.query = result.value;
	}
	if (options.requireHeaders && !context.headers) {
		return {
			data: null,
			error: { message: "Headers is required", issues: [] },
		};
	}
	if (options.requireRequest && !context.request) {
		return {
			data: null,
			error: { message: "Request is required", issues: [] },
		};
	}
	return {
		data: request,
		error: null,
	};
}

export function fromError(error: readonly StandardSchemaV1.Issue[], validating: string) {
	return {
		message: `Invalid ${validating} parameters`,
		issues: error,
	};
}
