export const shuffle = <T>(array: Array<T>) =>
  array
    .map((item) => [Math.random(), item] as [number, T])
    .sort(([a], [b]) => a - b)
    .map(([_rand, item]) => item);

export const takeFirst = <T>(n: number, array: Array<T>) => array.slice(0, n);
