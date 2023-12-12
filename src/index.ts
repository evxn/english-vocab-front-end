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

const isElement = (node: Node | ChildNode): node is Element =>
  node.nodeType === Node.ELEMENT_NODE;

const createElementFromTemplate = (template: HTMLTemplateElement) =>
  template.content.cloneNode(true) as DocumentFragment;

const appendChild = (container: Element, node: Node) =>
  container.appendChild(node);

// safety: ensure container element has children
const replaceLastChild = (container: Element, node: Node) =>
  container.replaceChild(node, container.lastChild!);

const updateLetterValue = (letter: string, elem: Element) => {
  elem.setAttribute("data-letter", letter);

  const text = createTextNode(letter);

  if (elem.lastChild === null) {
    appendChild(elem, text);
  } else {
    replaceLastChild(elem, text);
  }

  console.dir(elem);
};

const elemEntries = function* <T extends ChildNode>(
  childNodes: NodeListOf<T>,
): IterableIterator<[number, Element]> {
  let elemIndex: number = -1;
  for (const node of childNodes.values()) {
    if (isElement(node)) {
      elemIndex += 1;
      yield [elemIndex, node];
    }
  }
};

const findElemIndex = (
  container: Element,
  target: Element,
): number | undefined => {
  for (const [elemIndex, node] of elemEntries(container.childNodes)) {
    if (node === target) {
      return elemIndex;
    }
  }
  return undefined;
};

const createLetterElem = (letter: string) => {
  const template = getElementById("letters-template") as HTMLTemplateElement;

  const clone = createElementFromTemplate(template);

  const contentRoot = clone.querySelector("div");
  if (!contentRoot) {
    throw new Error("template must contain a root div element");
  }

  updateLetterValue(letter, contentRoot);

  return clone;
};

// -----------------------------------

import { shuffle, takeFirst } from "./utils";
import { allWords } from "./words-list";
import * as Zipper from "./zipper";
import * as GameState from "./game-state";
import { TaskQueue } from "./task-queue";

// TODO remove
window["GameState"] = GameState;

// ------------- EVENTS -------------

enum EventTypes {
  INPUT_LETTER = "INPUT_LETTER",
}

interface InputLetterEventDetail {
  letter: string;
  letterElemIndex?: number; // is used to make the right elem red on click if there're duplicate letters
}

declare global {
  interface GlobalEventHandlersEventMap {
    [EventTypes.INPUT_LETTER]: CustomEvent<InputLetterEventDetail>;
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

  let state = GameState.init({
    words,
    wrongInputs: new Map(),
    maxWrongInputs: 3,
  });

  // TODO remove
  window["state"] = state;

  const answerContainer = getElementById("answer");
  const lettersContainer = getElementById("letters");
  const currentQuestionContainer = getElementById("current_question");
  const totalQuestionsContainer = getElementById("total_questions");

  const statsContainer = getElementById("stats");
  const perfectWordsElem = getElementById("perfect_words");
  const totalWrongInputsElem = getElementById("total_wrong_inputs");
  const worstWordContainer = getElementById("worst_word_container");
  const worstWordElem = getElementById("worst_word");

  const animationQueue = new TaskQueue();

  document.addEventListener(
    EventTypes.INPUT_LETTER,
    ({ detail: { letter, letterElemIndex } }) => {
      if (!GameState.isInProgress(state)) {
        return;
      }

      const { words, shuffledLetters, maxWrongInputs } = state;

      if (shuffledLetters.length === 0) {
        return;
      }

      const word = words.current;
      const expectedLetter = word[word.length - shuffledLetters.length];
      const lowerCaseLetter = letter.toLowerCase();
      const letterIndex =
        letterElemIndex ?? state.shuffledLetters.indexOf(lowerCaseLetter);
      const letterFoundInShuffled = letterIndex !== -1;

      if (lowerCaseLetter === expectedLetter) {
        // remove the letter from the shuffled letters
        if (letterFoundInShuffled) {
          state.shuffledLetters.splice(letterIndex, 1);

          // safety: non-null assertion assumes that shuffledLetters state one to one syncronized with the DOM elements
          const letterElem = lettersContainer.children.item(letterIndex)!;
          // cancel previosly queued animation
          const oldTaskId = letterElem.getAttribute("data-task-id");
          if (oldTaskId !== null) {
            // cancel previosly queued animation
            animationQueue.remove(parseInt(oldTaskId, 10));
          }

          const taskId = animationQueue.push(() => {
            letterElem.classList.remove("bg-info");
            letterElem.classList.remove("bg-danger");
            letterElem.classList.add("bg-success");
            letterElem.removeAttribute("data-task-id");
          }, 150);

          letterElem.setAttribute("data-task-id", String(taskId));

          // move the element to the answer section
          answerContainer.appendChild(letterElem);

          if (state.shuffledLetters.length === 0) {
            if (GameState.isInProgress(state)) {
              // Schedule display next question
              animationQueue.push(() => {
                // clear old nodes
                animationQueue.clear();
                answerContainer.innerHTML = "";
                // generate and append new nodes
                state = GameState.nextQuestion(state);
                for (const letter of state.shuffledLetters) {
                  const elem = createLetterElem(letter);
                  appendChild(lettersContainer, elem);
                }

                currentQuestionContainer.textContent = `${
                  Zipper.indexOfCurrent(state.words) + 1
                }`;
              }, 800);
            } else {
              const { perfectWords, totalWrongInputs, worstWord } =
                GameState.calcStats(state);

              perfectWordsElem.textContent = String(perfectWords);
              totalWrongInputsElem.textContent = String(totalWrongInputs);

              if (worstWord) {
                worstWordElem.textContent = worstWord;
              } else {
                worstWordContainer.classList.add("d-none");
              }

              statsContainer.classList.remove("d-none");
            }
          }
        }
      } else {
        const wrongInputsCount = (state.wrongInputs.get(word) ?? 0) + 1;

        if (wrongInputsCount <= state.maxWrongInputs) {
          state.wrongInputs.set(word, wrongInputsCount);

          if (wrongInputsCount === state.maxWrongInputs) {
            animationQueue.clear();
            // move nodes from #letters to #answer container
            answerContainer.append(...lettersContainer.childNodes);

            for (const [answerElemIndex, elem] of elemEntries(
              answerContainer.childNodes,
            )) {
              // owerwrite element's letter
              updateLetterValue(word[answerElemIndex], elem);

              // cancel previosly queued animation
              const oldTaskId = elem.getAttribute("data-task-id");
              if (oldTaskId !== null) {
                // cancel previosly queued animation
                animationQueue.remove(parseInt(oldTaskId, 10));
              }

              // make bg red
              const taskId = animationQueue.push(() => {
                elem.classList.remove("bg-info");
                elem.classList.add("bg-danger");
                elem.removeAttribute("data-task-id");
              }, 50);

              elem.setAttribute("data-task-id", String(taskId));
            }
          } else {
            if (letterFoundInShuffled) {
              // Toggle error animation if the letter is in shuffled letters
              // safety: non-null assertion assumes that shuffledLetters state one to one syncronized with the DOM elements
              const letterElem = lettersContainer.children.item(letterIndex)!;
              letterElem.classList.remove("bg-info");
              letterElem.classList.add("bg-danger");

              const oldTaskId = letterElem.getAttribute("data-task-id");
              if (oldTaskId !== null) {
                // cancel previosly queued animation
                animationQueue.remove(parseInt(oldTaskId, 10));
              }

              const taskId = animationQueue.push(() => {
                letterElem.classList.remove("bg-danger");
                letterElem.classList.add("bg-info");
                letterElem.removeAttribute("data-task-id");
              }, 400);

              letterElem.setAttribute("data-task-id", String(taskId));
            }
          }
        } else {
          if (GameState.isInProgress(state)) {
            // Schedule display next question
            animationQueue.push(() => {
              // clear old nodes
              animationQueue.clear();
              answerContainer.innerHTML = "";
              // generate and append new nodes
              state = GameState.nextQuestion(state);
              for (const letter of state.shuffledLetters) {
                const elem = createLetterElem(letter);
                appendChild(lettersContainer, elem);
              }

              currentQuestionContainer.textContent = `${
                Zipper.indexOfCurrent(state.words) + 1
              }`;
            }, 800);
          } else {
            const { perfectWords, totalWrongInputs, worstWord } =
              GameState.calcStats(state);

            perfectWordsElem.textContent = String(perfectWords);
            totalWrongInputsElem.textContent = String(totalWrongInputs);

            if (worstWord) {
              worstWordElem.textContent = worstWord;
            } else {
              worstWordContainer.classList.add("d-none");
            }

            statsContainer.classList.remove("d-none");
          }
        }
      }
    },
  );

  lettersContainer.addEventListener("click", ({ target }): void => {
    if (!target || !isElement(target as Node)) {
      return;
    }

    const elem = target as HTMLElement;
    const letter = elem.dataset?.letter;

    if (!letter) {
      return;
    }

    const letterElemIndex = findElemIndex(lettersContainer, elem);

    document.dispatchEvent(
      new CustomEvent(EventTypes.INPUT_LETTER, {
        detail: {
          letter,
          letterElemIndex,
        },
      }),
    );
  });

  document.addEventListener(
    "keydown",
    ({ key, ctrlKey, metaKey, altKey, repeat }) => {
      if (ctrlKey || metaKey || altKey || repeat) {
        return;
      }

      const latinRegex = /^[a-zA-Z]$/;
      if (!latinRegex.test(key)) {
        return; // key is not latin
      }

      document.dispatchEvent(
        new CustomEvent(EventTypes.INPUT_LETTER, {
          detail: { letter: key },
        }),
      );
    },
  );

  for (const letter of state.shuffledLetters) {
    const elem = createLetterElem(letter);
    appendChild(lettersContainer, elem);
  }

  currentQuestionContainer.textContent = `${
    Zipper.indexOfCurrent(state.words) + 1
  }`;
  totalQuestionsContainer.textContent = `${Zipper.length(state.words)}`;

  // TODO remove
  console.log(state);
})();
