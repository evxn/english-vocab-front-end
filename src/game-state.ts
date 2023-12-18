import { TaskQueue } from "./task-queue";
import type { EmptyVariant, Variant, WithOptional } from "./utils";
import { emptyVariant, shuffle, variant } from "./utils";
import * as Zipper from "./zipper";

export const LAST_INPUT = "LAST_INPUT";
export const PREV_STATE = "PREV_STATE";
export const CURRENT_STATE = "CURRENT_STATE";

export type Config = WithOptional<Type, "shuffledLetters">;

export type GameStatus =
  | EmptyVariant<"READY_FOR_INPUT">
  | EmptyVariant<"GAME_FINISHED_ANSWER_CORRECT">
  | EmptyVariant<"GAME_FINISHED_ANSWER_FAILED">
  | EmptyVariant<"ANSWER_CORRECT">
  | EmptyVariant<"ANSWER_FAILED">
  | Variant<"LETTER_MATCHED", { letterIndex: number }>
  | Variant<"LETTER_ERROR", { letterIndex: number }>;

export interface Type {
  status: GameStatus; // safety: to use in referential equality ensure all property updates are immutable
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
  letterExactIndex?: number; // is used to make the right elem red on click if there're duplicate letters in the word
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
export const init: (state: Config) => Type = (state) => {
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

const finishStatus: (
  status: EmptyVariant<"ANSWER_CORRECT"> | EmptyVariant<"ANSWER_FAILED">,
) =>
  | EmptyVariant<"GAME_FINISHED_ANSWER_CORRECT">
  | EmptyVariant<"GAME_FINISHED_ANSWER_FAILED"> = ({ kind }) =>
  emptyVariant(
    kind === "ANSWER_CORRECT"
      ? "GAME_FINISHED_ANSWER_CORRECT"
      : "GAME_FINISHED_ANSWER_FAILED",
  );

export const finishGame: (state: Type) => Type = (state) => {
  if (
    state.status.kind === "ANSWER_CORRECT" ||
    state.status.kind === "ANSWER_FAILED"
  ) {
    state.status = finishStatus(state.status);
  }
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

export const parseInputLetterEvent = (
  localStorageItem: string | null,
): InputLetterEvent | null => {
  if (localStorageItem === null) {
    return null;
  }

  try {
    const { letter, letterExactIndex } = JSON.parse(localStorageItem);

    if (
      typeof letter === "string" &&
      letter.length === 1 &&
      (letterExactIndex === undefined ||
        (typeof letterExactIndex === "number" &&
          Number.isSafeInteger(letterExactIndex) &&
          letterExactIndex >= 0))
    ) {
      return {
        letter,
        letterExactIndex,
      };
    }
  } catch (e) {}

  return null;
};

export const parseStateConfig = (
  localStorageItem: string | null,
): Omit<Type, "taskQueue"> | null => {
  if (localStorageItem === null) {
    return null;
  }

  try {
    const {
      status: { kind, letterIndex },
      words: { current, prev, next },
      shuffledLetters,
      maxWrongInputs,
      wrongInputs: entries,
    } = JSON.parse(localStorageItem);

    if (
      !(
        typeof kind === "string" &&
        ((letterIndex === undefined &&
          (kind === "READY_FOR_INPUT" ||
            kind === "GAME_FINISHED" ||
            kind === "ANSWER_CORRECT" ||
            kind === "ANSWER_FAILED")) ||
          ((kind === "LETTER_MATCHED" || kind === "LETTER_ERROR") &&
            typeof letterIndex === "number" &&
            Number.isSafeInteger(letterIndex) &&
            letterIndex >= 0))
      )
    ) {
      return null;
    }

    const status = { kind, letterIndex } as GameStatus;

    if (
      !(
        typeof maxWrongInputs === "number" &&
        Number.isSafeInteger(maxWrongInputs) &&
        maxWrongInputs >= 0
      )
    ) {
      return null;
    }

    if (
      !(
        Array.isArray(entries) &&
        entries.every(
          (item) =>
            Array.isArray(item) &&
            item.length == 2 &&
            typeof item[0] === "string" &&
            typeof item[1] === "number" &&
            Number.isSafeInteger(item[1]) &&
            item[1] >= 0,
        )
      )
    ) {
      return null;
    }

    const wrongInputs = new Map(entries as [string, number][]);

    if (
      !(
        Array.isArray(prev) &&
        Array.isArray(next) &&
        typeof current === "string" &&
        prev.every((item: unknown) => typeof item === "string") &&
        next.every((item: unknown) => typeof item === "string")
      )
    ) {
      return null;
    }

    const words = {
      current,
      prev,
      next,
    } as Zipper.Type<string>;

    if (
      !(
        Array.isArray(shuffledLetters) &&
        shuffledLetters.every(
          (item) => typeof item === "string" && item.length === 1,
        )
      )
    ) {
      return null;
    }

    return {
      status,
      words,
      shuffledLetters,
      maxWrongInputs,
      wrongInputs,
    };
  } catch (e) {}

  return null;
};

export const serialize = ({
  status,
  words,
  shuffledLetters,
  maxWrongInputs,
  wrongInputs,
}: Omit<Type, "taskQueue">): string => {
  const entries = Array.from(wrongInputs);

  const serializableConfig = {
    status,
    words,
    shuffledLetters,
    maxWrongInputs,
    wrongInputs: entries,
  };

  return JSON.stringify(serializableConfig);
};
