import { emptyVariant, shuffle, takeFirst } from "./utils";
import { allWords } from "./words-list";
import * as Zipper from "./zipper";
import * as GameState from "./game-state";
import * as Render from "./render-state";
import { TaskQueue } from "./task-queue";

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
    // note: if you want to easily deserialize taskQueue you should use it in a blocking way: no state changes outside of queue are allowed while queue is not empty. this guaranties that you can restore the task queue state in just one iteration of game loop. starting with the previous game state (except you init it with an empty taskQueue) and the last recorded event and passing them to the game loop. after the call you'll get the last state with a restored TaskQueue
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

  const onInput: (event: GameState.InputLetterEvent) => void = ({
    letter,
    letterExactIndex,
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
      letterExactIndex ?? state.shuffledLetters.indexOf(lowerCaseLetter);
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

  const readonlyState = state as Readonly<GameState.Type>;
  const renderState = Render.init(onInput, readonlyState);

  const render = () => {
    while (renderState.gameStateStatusChangesQueue.length > 0) {
      // cast is cafe because queue is not empty
      const status = renderState.gameStateStatusChangesQueue.shift()!;

      // check depends on status being immutably updated
      if (renderState.lastProcessedStatus !== status) {
        switch (status.kind) {
          case "READY_FOR_INPUT": {
            if (renderState.lettersContainer.children.length === 0) {
              Render.renderQuestion(renderState, readonlyState);
            }
            break;
          }
          case "GAME_FINISHED": {
            const stats = GameState.calcStats(readonlyState);
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
              const { words } = readonlyState;
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
    }

    requestAnimationFrame(render);
  };

  // Start the render loop
  requestAnimationFrame(render);
})();
