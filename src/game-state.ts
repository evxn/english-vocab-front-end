import { TaskQueue } from "./task-queue";
import type { EmptyVariant, Variant, WithOptional } from "./utils";
import { emptyVariant, shuffle, variant } from "./utils";
import * as Zipper from "./zipper";

export type GameStatus =
  | EmptyVariant<"READY_FOR_INPUT">
  | EmptyVariant<"GAME_FINISHED">
  | EmptyVariant<"ANSWER_CORRECT">
  | EmptyVariant<"ANSWER_FAILED">
  | Variant<"LETTER_MATCHED", { letterIndex: number }>
  | Variant<"LETTER_ERROR", { letterIndex: number }>;

export interface Type {
  status: GameStatus;
  taskQueue: TaskQueue; // used to schedule async state updates
  maxWrongInputs: number; // default: 3
  shuffledLetters: string[];
  words: Zipper.Type<string>; // ensure invariant: each word is unique and has at least 2 distinct letters
  wrongInputs: Map<string, number>; // ("apple", 2)
}

export interface Stats {
  perfectWords: number;
  totalWrongInputs: number;
  worstWord?: string;
}

export interface InputLetterEvent {
  letter: string;
  letterElemIndex?: number; // is used to make the right elem red on click if there're duplicate letters in the word
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
  state.status = emptyVariant("READY_FOR_INPUT");
  state = init(state); // initialize shuffled letters for a new word

  return state;
};

export const finishGame: (state: Type) => Type = (state) => {
  state.status = emptyVariant("GAME_FINISHED");
  return state;
};

export const answerCorrect: (state: Type) => Type = (state) => {
  state.status = emptyVariant("ANSWER_CORRECT");
  return state;
};

export const answerFailed: (state: Type) => Type = (state) => {
  state.status = emptyVariant("ANSWER_FAILED");
  return state;
};

export const letterMatched: (state: Type, letterIndex: number) => Type = (
  state,
  letterIndex,
) => {
  state.status = variant("LETTER_MATCHED", { letterIndex });
  return state;
};

export const letterError: (state: Type, letterIndex: number) => Type = (
  state,
  letterIndex,
) => {
  state.status = variant("LETTER_ERROR", { letterIndex });
  return state;
};

export const calcStats: (state: Type) => Stats = ({ words, wrongInputs }) => {
  let totalWrongInputs = 0;
  let perfectWords = 0;
  let worstWord,
    maxFails = 0;

  for (const word of Zipper.values(words)) {
    const fails = wrongInputs.get(word) ?? 0;
    totalWrongInputs += fails;

    if (fails === 0) {
      perfectWords += 1;
    }

    if (fails > maxFails) {
      maxFails = fails;
      worstWord = word;
    }
  }

  return {
    perfectWords,
    totalWrongInputs,
    worstWord, // returns worstWord: undefined on no fails
  };
};
