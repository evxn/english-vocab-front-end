const getElementById = ((context) => (id: string) => {
  const elem = context.getElementById(id);

  if (!elem) {
    throw new Error(`document must have the #${id} element`);
  }

  return elem;
})(document);

const createTextNode = ((context) => context.createTextNode.bind(context))(
  document,
);

const createElementFromTemplate = (template: HTMLTemplateElement) =>
  template.content.cloneNode(true) as DocumentFragment;

const appendChild = (container: HTMLElement, node: Node) =>
  container.appendChild(node);

const createLetterElem = (letter: string) => {
  const template = getElementById("letters-template") as HTMLTemplateElement;

  const clone = createElementFromTemplate(template);

  const contentRoot = clone.querySelector("div");
  if (!contentRoot) {
    throw new Error("template must contain a root div element");
  }
  contentRoot.dataset.letter = letter;
  const text = createTextNode(letter);
  appendChild(contentRoot, text);

  return clone;
};

import { shuffle, takeFirst } from "./utils";
import type { WithOptional } from "./utils";
import { allWords } from "./words-list";

// ----------- GAME STATE ------------

export interface GameState {
  currentQuestionIndex: number;
  maxWrongInputs: number; // default: 3
  shuffledLetters: string[];
  words: string[]; // invariant: unique words with at least 2 distinct letters
  wrongInputs: Map<string, number>; // ("apple", 2)
  // eventsQueue: unknown[]; // to abstract from DOM input events
}

export const isGameInProgress: (state: GameState) => boolean = ({
  currentQuestionIndex,
  maxWrongInputs,
  wrongInputs,
  words,
  shuffledLetters,
}) =>
  currentQuestionIndex < words.length - 1 ||
  shuffledLetters.length > 0 &&
  (wrongInputs.get(words[currentQuestionIndex]) ?? 0) < maxWrongInputs;

// safety: state.words.length > 0
// returns the passed state mutated in-place
export const nextQuestion: (
  state: WithOptional<GameState, "currentQuestionIndex" | "shuffledLetters">,
) => GameState = (state) => {
  const { currentQuestionIndex: previousQuestionIndex, words } = state;

  // if not the last question
  if (previousQuestionIndex !== words.length - 1) {
    const currentQuestionIndex =
      previousQuestionIndex === undefined ? 0 : previousQuestionIndex + 1;
    // array indexing is safe if ensured state.words.length > 0
    const word = words[currentQuestionIndex];
    const letters = word.split("");
    let shuffledLetters: string[];

    // re-shuffle when after the shuffle we end up with the same word
    // safety: ensure that all the words have a non trivial shuffle
    // shuffling ["a"] or ["b", "b"] for example, will result in an infinite loop
    do {
      shuffledLetters = shuffle(letters);
    } while (shuffledLetters.join("") === word); // ignore a noop shuffle

    state.currentQuestionIndex = currentQuestionIndex;
    state.shuffledLetters = shuffledLetters;
  }

  // cast is safe if ensured state.words.length > 0
  return state as GameState;
};

// TODO remove
window["nextQuestion"] = nextQuestion;
window["isGameInProgress"] = isGameInProgress;

// ------------- GLOBALS -------------

enum CustomEvents {
  INPUT_LETTER = "input_letter",
}

type InputLetterEventDetail = string;

declare global {
  interface GlobalEventHandlersEventMap {
    [CustomEvents.INPUT_LETTER]: CustomEvent<InputLetterEventDetail>;
  }
}

// -----------------------------------

(function main() {
  const shuffledWords = shuffle(allWords);
  const words = takeFirst(6, shuffledWords);

  const state: GameState = nextQuestion({
    words,
    wrongInputs: new Map(),
    maxWrongInputs: 3,
  });

  // TODO remove
  window["state"] = state;

  document.addEventListener(CustomEvents.INPUT_LETTER, ({ detail: letter }) => {
    console.log(letter.toLowerCase());
    // TODO update game state on input:
    // early return if game is not in progress
    //
    // if a letter.toLower() != expected letter
    // - update word's wrong inputs count
    // - if word's wrong inputs count >= max
    // - - if game in progress
    // - - - next level
    // - - else
    // - - - display statistics
    // - else
    // - - - if the letter is in shuffled letters make it red
    // else
    // - remove the letter from the shuffled letters
    // - move the element to answer section
  });

  const answerContainer = getElementById("answer");
  const lettersContainer = getElementById("letters");

  lettersContainer.addEventListener("click", (evt) => {
    if (!evt.target) {
      return;
    }

    const letter = (evt.target as HTMLElement).dataset?.letter;

    if (!letter) {
      return;
    }

    // console.log(letter );

    document.dispatchEvent(
      new CustomEvent(CustomEvents.INPUT_LETTER, {
        detail: letter,
      }),
    );
  });

  for (const letter of state.shuffledLetters) {
    const elem = createLetterElem(letter);
    appendChild(lettersContainer, elem);
  }

  document.addEventListener("keydown", ({ key }) => {
    // TODO early return when CTRL, META or ALT is also pressed

    // console.log(key);

    const latinRegex = /^[a-zA-Z]$/;
    if (!latinRegex.test(key)) {
      return; // key is not latin
    }

    document.dispatchEvent(
      new CustomEvent(CustomEvents.INPUT_LETTER, {
        detail: key,
      }),
    );
  });

  console.log(state);
})();
