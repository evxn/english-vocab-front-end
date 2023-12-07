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

// -----------------------------------

import { shuffle, takeFirst } from "./utils";
import { allWords } from "./words-list";
import * as Zipper from "./zipper";
import * as GameState from "./game-state";

// TODO remove
window["GameState"] = GameState;

// ------------- EVENTS -------------

enum EventTypes {
  INPUT_LETTER = "INPUT_LETTER",
}

declare global {
  interface GlobalEventHandlersEventMap {
    [EventTypes.INPUT_LETTER]: CustomEvent<string>;
  }
}

// -----------------------------------

(function main() {
  if (allWords.length === 0) {
    return;
  }

  const shuffledWords = shuffle(allWords);

  // Zipper.init is safe because of the check that allWords is non-empty
  const words = Zipper.init(takeFirst(6, shuffledWords));

  const state = GameState.init({
    words,
    wrongInputs: new Map(),
    maxWrongInputs: 3,
  });

  // TODO remove
  window["state"] = state;

  document.addEventListener(EventTypes.INPUT_LETTER, ({ detail: letter }) => {
    console.log(letter.toLowerCase());
    // TODO update game state on input:
    // early return if game is not in progress
    //
    // if a letter.toLower() != expected letter
    // - update word's wrong inputs count
    // - if word's wrong inputs count >= max
    // - - if game in progress
    // - - - schedule display next question
    // - - else
    // - - - schedule display statistics
    // - else
    // - - - if the letter is in shuffled letters then toggle red animation
    // else
    // - remove the letter from the shuffled letters
    // - move the element to answer section
    // - if shuffled letters is empty
    // - - if game in progress
    // - - - schedule display next question
    // - - else
    // - - - schedule display statistics
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

    // TODO remove
    // console.log(letter);

    document.dispatchEvent(
      new CustomEvent(EventTypes.INPUT_LETTER, {
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

    // TODO remove
    // console.log(key);

    const latinRegex = /^[a-zA-Z]$/;
    if (!latinRegex.test(key)) {
      return; // key is not latin
    }

    document.dispatchEvent(
      new CustomEvent(EventTypes.INPUT_LETTER, {
        detail: key,
      }),
    );
  });
  
  // TODO remove
  console.log(state);
})();
