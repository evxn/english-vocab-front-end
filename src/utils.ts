type AllKeyOf<T> = T extends never ? never : keyof T;
type Omit<T, K> = { [P in Exclude<keyof T, K>]: T[P] };
type Optional<T, K> = { [P in Extract<keyof T, K>]?: T[P] };

export type WithOptional<T, K extends AllKeyOf<T>> = T extends never
  ? never
  : Omit<T, K> & Optional<T, K>;

export const shuffle = <T>(array: Array<T>) =>
  array
    .map((item) => [Math.random(), item] as [number, T])
    .sort(([a], [b]) => a - b)
    .map(([_rand, item]) => item);

export const takeFirst = <T>(n: number, array: Array<T>) => array.slice(0, n);

/** Algebraic Data Types */

export type Variant<Kind, Shape> = { kind: Kind } & Shape;

export const variant = <Kind, Shape>(
  kind: Kind,
  shape: Shape,
): Variant<Kind, Shape> => {
  return {
    ...shape,
    kind,
  };
};

export type EmptyVariant<Kind> = Variant<Kind, {}>;

export const emptyVariant = <Kind>(kind: Kind): EmptyVariant<Kind> => {
  return {
    kind,
  };
};
