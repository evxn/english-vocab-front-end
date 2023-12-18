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

  const defaultState = GameState.init({
    status: emptyVariant("READY_FOR_INPUT"),
    words,
    wrongInputs: new Map(),
    maxWrongInputs: 3,
    // note: if you want to easily deserialize taskQueue you should use it in a blocking way: no state changes outside of queue are allowed while queue is not empty. this guaranties that you can restore the task queue state in just one iteration of game loop. starting with the previous game state (except you init it with an empty taskQueue) and the last recorded event and passing them to the game loop. after the call you'll get the last state with a restored TaskQueue
    taskQueue: new TaskQueue(),
  });

  let state: GameState.Type = defaultState;

  const onQuestionCompleted = () => {
    if (GameState.isInProgress(state)) {
      state = GameState.nextQuestion(state);

      localStorage.removeItem(GameState.PREV_STATE);
      localStorage.removeItem(GameState.LAST_INPUT);
      localStorage.setItem(GameState.CURRENT_STATE, GameState.serialize(state));
    } else {
      state = GameState.finishGame(state);

      localStorage.clear();
    }
  };

  const onInput: (event: GameState.InputLetterEvent) => void = (event) => {
    if (!GameState.isInProgress(state)) {
      return;
    }

    const { letter, letterExactIndex } = event;

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

    if (lowerCaseLetter === expectedLetter) {
      // case: expected letter
      localStorage.setItem(GameState.LAST_INPUT, JSON.stringify(event));
      localStorage.setItem(GameState.PREV_STATE, GameState.serialize(state));

      state.shuffledLetters.splice(letterIndex, 1); // remove letter from shuffled letters
      state = GameState.letterMatched(state, letterIndex);

      // last letter in the word
      if (shuffledLetters.length === 0) {
        state = GameState.answerCorrect(state);
        state.taskQueue.push(onQuestionCompleted, 800);
      }

      localStorage.setItem(GameState.CURRENT_STATE, GameState.serialize(state));
      return;
    }

    // case: not expected letter
    const wrongInputsCount = (wrongInputs.get(word) ?? 0) + 1;

    if (wrongInputsCount > maxWrongInputs) {
      return;
    }

    localStorage.setItem(GameState.LAST_INPUT, JSON.stringify(event));
    localStorage.setItem(GameState.PREV_STATE, GameState.serialize(state));

    state.wrongInputs.set(word, wrongInputsCount);

    if (wrongInputsCount === maxWrongInputs) {
      state.shuffledLetters.splice(0); // clear array
      state = GameState.answerFailed(state);
      state.taskQueue.push(onQuestionCompleted, 800);
    } else {
      // here: wrongInputsCount < maxWrongInputs
      if (letterFoundInShuffled) {
        state = GameState.letterError(state, letterIndex);
      }
    }

    localStorage.setItem(GameState.CURRENT_STATE, GameState.serialize(state));
  };

  // ---  RESTORE STATE FROM LOCAL STORAGE ---

  const lastInput = GameState.parseInputLetterEvent(
    localStorage.getItem(GameState.LAST_INPUT),
  );

  const prevStateConfig = GameState.parseStateConfig(
    localStorage.getItem(GameState.PREV_STATE),
  );

  const stateConfig = GameState.parseStateConfig(
    localStorage.getItem(GameState.CURRENT_STATE),
  );

  if (stateConfig) {
    if (prevStateConfig && lastInput) {
      // we cannot serialize/deserialize TaskQueue but we can re-generate it
      // we start with prev state and an empty task queue and replay the last recorded event to initialize current state with the right taskQueue
      const prevState = {
        ...prevStateConfig,
        taskQueue: new TaskQueue(),
      };
      state = prevState;
      onInput(lastInput);
      // here state contains deterministically initialized taskQueue
      const { taskQueue } = state;

      // combine deserialized state with a generated taskQueue
      state = {
        ...stateConfig,
        taskQueue,
      };

      if (taskQueue.length > 0) {
        taskQueue.executeImmediately();
      }
    } else {
      state = {
        ...stateConfig,
        taskQueue: new TaskQueue(),
      };
    }

    // FIXME how to ask user in render without giving up readonly access?
    // ask user if we should keep the state initialized from localStorage 
    if (!confirm("Continue previously started training?")) {
      state = defaultState;
    }
  } else {
    localStorage.clear();
  }

  // ------------- RENDERING -------------

  const readonlyState = state as Readonly<GameState.Type>;
  const renderState = Render.init(onInput, readonlyState);

  const render = () => {
    while (renderState.gameStateStatusChangesQueue.length > 0) {
      // cast is cafe because queue is not empty
      const status = renderState.gameStateStatusChangesQueue.shift()!;

      // check depends on status being immutably updated
      if (renderState.lastProcessedStatus !== status) {
        // first render
        const isFirstRender =
          renderState.lettersContainer.children.length === 0 &&
          renderState.answerContainer.children.length === 0;

        // subsequent renders
        switch (status.kind) {
          case "READY_FOR_INPUT": {
            if (renderState.lettersContainer.children.length === 0) {
              Render.renderQuestion(renderState, readonlyState);
            }
            break;
          }
          case "GAME_FINISHED_ANSWER_CORRECT": {
            if (isFirstRender) {
              Render.renderQuestion(renderState, readonlyState);
            }
            const stats = GameState.calcStats(readonlyState);
            Render.renderStats(renderState, stats);
            return;
          }
          case "GAME_FINISHED_ANSWER_FAILED": {
            if (isFirstRender) {
              const { words } = readonlyState;

              Render.renderQuestion(renderState, readonlyState);
              Render.renderFailedAnswer(renderState, words.current);
              renderState.animationQueue.executeImmediately();
            }
            const stats = GameState.calcStats(readonlyState);
            Render.renderStats(renderState, stats);
            return;
          }
          case "ANSWER_CORRECT": {
            if (isFirstRender) {
              Render.renderQuestion(renderState, readonlyState);
            } else if (renderState.lettersContainer.children.length > 0) {
              // move the last matched letter to answers
              Render.renderLetterMatched(renderState, 0);
            }
            break;
          }
          case "ANSWER_FAILED": {
            const { words } = readonlyState;

            if (isFirstRender) {
              Render.renderQuestion(renderState, readonlyState);
              Render.renderFailedAnswer(renderState, words.current);
              renderState.animationQueue.executeImmediately();
            } else if (renderState.lettersContainer.children.length > 0) {
              Render.renderFailedAnswer(renderState, words.current);
            }

            break;
          }
          case "LETTER_MATCHED": {
            if (isFirstRender) {
              Render.renderQuestion(renderState, readonlyState);
            } else {
              Render.renderLetterMatched(renderState, status.letterIndex);
            }
            break;
          }
          case "LETTER_ERROR": {
            if (isFirstRender) {
              Render.renderQuestion(renderState, readonlyState);
            } else {
              Render.renderLetterError(renderState, status.letterIndex);
            }
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
