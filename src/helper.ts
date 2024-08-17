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
