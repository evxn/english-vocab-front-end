import { emptyVariant, shuffle, takeFirst } from "./utils";
import { allWords } from "./words-list";
import * as Zipper from "./zipper";
import * as GameState from "./game-state";
import * as Render from "./render-state";
import { TaskQueue } from "./task-queue";

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
    status: emptyVariant("READY_FOR_INPUT"),
    words,
    wrongInputs: new Map(),
    maxWrongInputs: 3,
    taskQueue: new TaskQueue(),
  });

  const renderState = Render.init();

  const render = () => {
    const { status } = state;

    switch (status.kind) {
      case "READY_FOR_INPUT": {
        if (renderState.lettersContainer.children.length === 0) {
          Render.renderQuestion(renderState, state);
        }
        break;
      }
      case "GAME_FINISHED": {
        const stats = GameState.calcStats(state);
        Render.renderStats(renderState, stats);
        break;
      }
      case "ANSWER_CORRECT": {
        if (renderState.lettersContainer.children.length > 0) {
          // move the last matched letter to answers
          Render.renderLetterMatched(renderState, 0);
        }
        break;
      }
      case "ANSWER_FAILED": {
        if (renderState.lettersContainer.children.length > 0) {
          const { words } = state;
          Render.renderFailedAnswer(renderState, words.current);
        }
        break;
      }
      case "LETTER_MATCHED": {
        Render.renderLetterMatched(renderState, status.letterIndex);
        state.status = emptyVariant("READY_FOR_INPUT");
        break;
      }
      case "LETTER_ERROR": {
        Render.renderLetterError(renderState, status.letterIndex);
        state.status = emptyVariant("READY_FOR_INPUT");
        break;
      }
    }

    requestAnimationFrame(render);
  };

  // Start the render loop
  requestAnimationFrame(render);

  const onQuestionCompleted = () => {
    if (GameState.isInProgress(state)) {
      state.taskQueue.push(() => {
        state = GameState.nextQuestion(state);
      }, 800);
    } else {
      state.taskQueue.push(() => {
        state = GameState.finishGame(state);
      }, 800);
    }
  };

  document.addEventListener(
    EventTypes.INPUT_LETTER,
    ({ detail: { letter, letterElemIndex } }) => {
      if (!GameState.isInProgress(state)) {
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

        state = GameState.letterMatched(state, letterIndex);

        // last letter in the word
        if (shuffledLetters.length === 0) {
          state = GameState.answerCorrect(state);
          onQuestionCompleted();
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

        state = GameState.answerFailed(state);
        onQuestionCompleted();
        return;
      }

      // here: wrongInputsCount < maxWrongInputs
      if (letterFoundInShuffled) {
        state = GameState.letterError(state, letterIndex);
      }
    },
  );

  renderState.lettersContainer.addEventListener(
    "click",
    ({ target, pageX, pageY }) => {
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
    },
  );

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
