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
import { allWords } from "./words-list";

interface GameState {
  awaitingLetterAtIndex: number;
  currentQuestionIndex: number;
  maxWrongInputs: number; // default: 3
  shuffledLetters: string[];
  words: string[]; // invariant: unique words with at least 2 distinct letters
  wrongInputs: Map<string, number>; // ("apple", 2)
  // eventsQueue: unknown[]; // to abstract from DOM input events
}

enum CustomEvents {
  INPUT_LETTER = "input_letter",
}

type InputLetterEventDetail = string;

declare global {
  interface GlobalEventHandlersEventMap {
    [CustomEvents.INPUT_LETTER]: CustomEvent<InputLetterEventDetail>;
  }
}

(function main() {
  const shuffledWords = shuffle(allWords);
  const words = takeFirst(6, shuffledWords);

  let currentQuestionIndex = 0;
  if (currentQuestionIndex === words.length) {
    // TODO finish game
    return;
  }

  let word = words[currentQuestionIndex];

  const letters = word.split("");

  // ensure invariant: all the words have a non trivial shuffle
  // "a" or "bb", for example, will result in an infinite loop
  let shuffledLetters: string[];
  do {
    shuffledLetters = shuffle(letters);
  } while (shuffledLetters.join("") === word); // ignore a noop shuffle

  const state: GameState = {
    words,
    wrongInputs: new Map(),
    maxWrongInputs: 3,
    currentQuestionIndex,
    shuffledLetters,
    awaitingLetterAtIndex: 0,
  };

  document.addEventListener(CustomEvents.INPUT_LETTER, ({detail: letter}) => {
    console.log(letter.toLowerCase());   
  });

  const answerContainer = getElementById("answer");
  const lettersContainer = getElementById("letters");

  lettersContainer.addEventListener("click", (evt) => {
    if (!evt.target) {
      return;
    }

    const letter = (evt.target as HTMLElement).dataset?.letter;

    if (!letter ) {
      return;
    }

    // console.log(letter );

    document.dispatchEvent(
      new CustomEvent(CustomEvents.INPUT_LETTER, {
        detail: letter ,
      }),
    );
  });

  for (const letter of shuffledLetters) {
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
