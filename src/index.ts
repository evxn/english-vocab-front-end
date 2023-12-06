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

const createLetterElem = (char: string) => {
  const template = getElementById(
    "letters-template",
  ) as HTMLTemplateElement;
  
  const clone = createElementFromTemplate(template);

  const contentRoot = clone.querySelector("div");
  if (!contentRoot) {
    throw new Error("template must contain a root div element");
  }
  contentRoot.dataset.char = char;
  const text = createTextNode(char);
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

  const answerContainer = getElementById("answer");
  const lettersContainer = getElementById("letters");

  lettersContainer.addEventListener("click", (evt) => {
    if (!evt.target) {
      return;
    }

    const char = (evt.target as HTMLElement).dataset?.char;

    if (!char) {
      return;
    }

    console.log(char);
  });

  for (const letter of shuffledLetters) {
    const elem = createLetterElem(letter);
    appendChild(lettersContainer, elem);
  }

  console.log(state);
})();
