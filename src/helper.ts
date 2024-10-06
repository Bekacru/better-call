export type UnionToIntersection<Union> = (
	Union extends unknown
		? (distributedUnion: Union) => void
		: never
) extends (mergedIntersection: infer Intersection) => void
	? Intersection & Union
	: never;

export type RequiredKeysOf<BaseType extends object> = Exclude<
	{
		[Key in keyof BaseType]: BaseType extends Record<Key, BaseType[Key]> ? Key : never;
	}[keyof BaseType],
	undefined
>;

export type HasRequiredKeys<BaseType extends object> = RequiredKeysOf<BaseType> extends never
	? false
	: true;

/**
 * this function will return a json response and
 * infers the type of the body
 */
export const json = <T>(
	body: T,
	option?: {
		status?: number;
		statusText?: string;
		headers?: Record<string, string>;
		/**
		 * this body will take precedence over the body in the options if both are provided.
		 * This is useful if you want to return body without inferring the type.
		 */
		body?: any;
	},
) => {
	return {
		response: {
			body: option?.body ?? body,
			status: option?.status ?? 200,
			statusText: option?.statusText ?? "OK",
			headers: option?.headers,
		},
		body,
		flag: "json" as const,
	};
};
