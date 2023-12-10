// https://stackoverflow.com/questions/380438/what-is-the-zipper-data-structure-and-should-i-be-using-it
// Example usage:
// const arr = [1, 2, 3, 4, 5];
// let zipper = init(arr);
// console.log(zipper.current); // Output: 1
// zipper = next(zipper);
// console.log(zipper.current); // Output: 2
// zipper = prev(zipper);
// console.log(zipper.current); // Output: 1
export interface Type<T> {
  current: T;
  prev: T[];
  next: T[];
}

// safety: initialize with a non-empty array
export const init: <T>(array: T[]) => Type<T> = (nonEmprtArray) => ({
  current: nonEmprtArray[0],
  prev: [],
  next: nonEmprtArray.slice(1),
});

export const length: <T>(zipper: Type<T>) => number = ({ prev, next }) =>
  prev.length + next.length + 1;

export const indexOfCurrent: <T>(zipper: Type<T>) => number = ({ prev }) =>
  prev.length;

export const prev: <T>(zipper: Type<T>) => Type<T> = (zipper) => {
  const { current, prev, next } = zipper;

  if (prev.length === 0) {
    return zipper; // Can't go prev from the start
  }

  const prevIndex = prev.length - 1;
  const newCurrent = prev[prevIndex];
  return {
    current: newCurrent,
    prev: prev.slice(0, prevIndex),
    next: [current, ...next],
  };
};

export const next: <T>(zipper: Type<T>) => Type<T> = (zipper) => {
  const { current, prev, next } = zipper;

  if (next.length === 0) {
    return zipper; // Can't go next from the end
  }

  const newCurrent = next[0];
  return {
    current: newCurrent,
    prev: [...prev, current],
    next: next.slice(1),
  };
};

// iterates over all the values in natural order
export const values = function* <T>(
  zipper: Type<T>,
): IterableIterator<T> {
  for (const item of zipper.prev.values()) {
    yield item;
  }
  yield zipper.current;
  for (const item of zipper.next.values()) {
    yield item;
  }
};

