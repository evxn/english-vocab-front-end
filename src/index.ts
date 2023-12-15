import { shuffle, takeFirst } from "./utils";
import { allWords } from "./words-list";
import * as Zipper from "./zipper";
import * as GameState from "./game-state";
import type { RenderState } from "./render-state";
import * as Render from "./render-state";

// ------------- EVENTS -------------

enum EventTypes {
  INPUT_LETTER = "INPUT_LETTER",
}

interface InputLetterEventDetail {
  letter: string;
  letterElemIndex?: number; // is used to make the right elem red on click if there're duplicate letters in the word
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

  const renderState = Render.init();

  Render.renderQuestion(renderState, state);

  document.addEventListener(
    EventTypes.INPUT_LETTER,
    ({ detail: { letter, letterElemIndex } }) => {
      if (!GameState.isInProgress(state) || Render.isWaiting(renderState)) {
        return;
      }

      const { words, shuffledLetters, maxWrongInputs, wrongInputs } = state;

      if (shuffledLetters.length === 0) {
        return;
      }

      const word = words.current;
      const expectedLetter = word[word.length - shuffledLetters.length];
      const lowerCaseLetter = letter.toLowerCase();
      const letterIndex =
        letterElemIndex ?? state.shuffledLetters.indexOf(lowerCaseLetter);
      const letterFoundInShuffled = letterIndex !== -1;

      // case: expected letter
      if (lowerCaseLetter === expectedLetter) {
        // remove letter from shuffled letters
        shuffledLetters.splice(letterIndex, 1);

        Render.renderLetterMatched(renderState, letterIndex);

        // last letter in the word
        if (shuffledLetters.length === 0) {
          if (GameState.isInProgress(state)) {
            state = GameState.nextQuestion(state);
            Render.waitAndRenderQuestion(renderState, state);
          } else {
            const stats = GameState.calcStats(state);
            Render.renderStats(renderState, stats);
          }
        }
        return;
      }

      // case: not expected letter
      const wrongInputsCount = (wrongInputs.get(word) ?? 0) + 1;

      if (wrongInputsCount > maxWrongInputs) {
        return;
      }

      wrongInputs.set(word, wrongInputsCount);

      if (wrongInputsCount === maxWrongInputs) {
        shuffledLetters.splice(0); // clear array

        Render.renderFailedAnswer(renderState, word);

        if (GameState.isInProgress(state)) {
          state = GameState.nextQuestion(state);
          Render.waitAndRenderQuestion(renderState, state);
        } else {
          const stats = GameState.calcStats(state);
          Render.renderStats(renderState, stats);
        }
        return;
      }

      // here: wrongInputsCount < maxWrongInputs
      if (letterFoundInShuffled) {
        Render.renderLetterError(renderState, letterIndex);
      }
    },
  );

  renderState.lettersContainer.addEventListener("click", ({ target, pageX, pageY }) => {
    if (!target || !Render.isElement(target as Node)) {
      return;
    }

    const elem = target as HTMLElement;
    const letter = elem.dataset?.letter;

    if (!letter) {
      return;
    }

    // TODO it's possible to find elem index by pageX, pageY universally for DOM and canvas using document.elementsFromPoint()
    const letterElemIndex = Render.findElemIndex(
      renderState.lettersContainer,
      elem,
    );

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
})();
