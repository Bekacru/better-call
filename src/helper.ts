/**
 * Improve this type if possible
 */
export type Input<T> = Prettify<
  {
    [K in keyof T as T[K] extends never
      ? never
      : undefined extends T[K]
      ? never
      : K]: T[K];
  } & {
    [K in keyof T as undefined extends T[K] ? K : never]?: T[K];
  }
>;

export type RequiredKeysOf<BaseType extends object> = Exclude<
  {
    [Key in keyof BaseType]: BaseType extends Record<Key, BaseType[Key]>
      ? Key
      : never;
  }[keyof BaseType],
  undefined
>;

export type HasRequiredKeys<BaseType extends object> =
  RequiredKeysOf<BaseType> extends never ? false : true;

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type IsEmptyObject<T> = keyof T extends never ? true : false;
