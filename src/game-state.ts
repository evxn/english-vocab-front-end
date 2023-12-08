import type { WithOptional } from "./utils";
import { shuffle } from "./utils";
import * as Zipper from "./zipper";

export interface Type {
  maxWrongInputs: number; // default: 3
  shuffledLetters: string[];
  words: Zipper.Type<string>; // ensure invariant: each word is unique and has at least 2 distinct letters
  wrongInputs: Map<string, number>; // ("apple", 2)
}

export const isInProgress: (state: Type) => boolean = ({
  maxWrongInputs,
  wrongInputs,
  words,
  shuffledLetters,
}) =>
  Zipper.indexOfCurrent(words) < Zipper.length(words) - 1 ||
  (shuffledLetters.length > 0 &&
    (wrongInputs.get(words.current) ?? 0) < maxWrongInputs);

// safety: ensure that all the words have a non trivial shuffle
// returns the passed state mutated in-place
export const init: (state: WithOptional<Type, "shuffledLetters">) => Type = (
  state,
) => {
  const { words } = state;

  const word = words.current;
  const letters = word.split("");

  let shuffledLetters: string[];
  // re-shuffle when after the shuffle we end up with the same word
  // safety: loop is safe when all the words have a non trivial shuffle
  // shuffling ["a"] or ["b", "b"] for example will result in an infinite loop
  do {
    shuffledLetters = shuffle(letters);
  } while (shuffledLetters.join("") === word); // ignore a noop shuffle

  state.shuffledLetters = shuffledLetters;

  // cast is safe cause shuffledLetters was initialized
  return state as Type;
};

// safety: ensure that all the words have a non trivial shuffle
// returns the passed state mutated in-place
export const nextQuestion: (state: Type) => Type = (state) => {
  const { words } = state;

  state.words = Zipper.next(words);
  state = init(state); // initialize shuffled letters for a new word

  return state;
};
