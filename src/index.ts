import { emptyVariant, shuffle, takeFirst } from "./utils";
import { allWords } from "./words-list";
import * as Zipper from "./zipper";
import * as GameState from "./game-state";
import * as Render from "./render-state";
import { TaskQueue } from "./task-queue";

interface InputLetterEventDetail {
  letter: string;
  letterElemIndex?: number; // is used to make the right elem red on click if there're duplicate letters in the word
}

(function main() {
  // ------------- GAME LOGIC -------------
  
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

  const onInput: (eventDetail: InputLetterEventDetail) => void = ({
    letter,
    letterElemIndex,
  }) => {
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
  };

  // ------------- RENDERING -------------

  const renderState = Render.init();

  const render = () => {
    const { status } = state;

    if (renderState.lastProcessedStatus !== status) {
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
          return;
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
          break;
        }
        case "LETTER_ERROR": {
          Render.renderLetterError(renderState, status.letterIndex);
          break;
        }
      }

      renderState.lastProcessedStatus = status;
    }

    requestAnimationFrame(render);
  };

  // Start the render loop
  requestAnimationFrame(render);

  // ------------- INPUT -------------

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

      onInput({ letter, letterElemIndex });
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

      onInput({ letter: key });
    },
  );
})();
