import * as Zipper from "./zipper";
import * as GameState from "./game-state";
import { TaskQueue } from "./task-queue";

export interface RenderState {
  lastProcessedStatus: GameState.GameStatus | undefined;
  gameStateStatusChangesQueue: GameState.GameStatus[];
  animationQueue: TaskQueue;
  answerContainer: HTMLElement;
  lettersContainer: HTMLElement;
  currentQuestionContainer: HTMLElement;
  totalQuestionsContainer: HTMLElement;
  statsContainer: HTMLElement;
  perfectWordsElem: HTMLElement;
  totalWrongInputsElem: HTMLElement;
  worstWordContainer: HTMLElement;
  worstWordElem: HTMLElement;
  onInput: (event: GameState.InputLetterEvent) => void;
}

export const init = (
  onInput: (event: GameState.InputLetterEvent) => void,
  gameStateRef: Readonly<GameState.Type>,
): RenderState => {
  const gameStateStatusChangesQueue: GameState.GameStatus[] = [
    gameStateRef.status,
  ];

  const lettersContainer = getElementById("letters");
  lettersContainer.addEventListener("click", ({ target }) => {
    if (!target || !isElement(target as Node)) {
      return;
    }

    const elem = target as HTMLElement;
    const letter = elem.dataset?.letter;

    if (!letter) {
      return;
    }

    const letterExactIndex = findElemIndex(lettersContainer, elem);

    // there can be more than one status update per one requestAnimationFrame call
    // so we have to keep this changes in queue to consume later
    onInput({ letter, letterExactIndex });
    gameStateStatusChangesQueue.push(gameStateRef.status);
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

      onInput({ letter: key });
      gameStateStatusChangesQueue.push(gameStateRef.status);
    },
  );

  // we also have to observe possible state changes made in async task queue as well
  gameStateRef.taskQueue.onExecute(() => {
    const lastIdx = gameStateStatusChangesQueue.length - 1;
    // check depends on status being immutably updated
    if (gameStateStatusChangesQueue[lastIdx] !== gameStateRef.status) {
      gameStateStatusChangesQueue.push(gameStateRef.status);
    }
  });

  return {
    lastProcessedStatus: undefined,
    gameStateStatusChangesQueue,
    animationQueue: new TaskQueue(),
    answerContainer: getElementById("answer"),
    lettersContainer,
    currentQuestionContainer: getElementById("current_question"),
    totalQuestionsContainer: getElementById("total_questions"),
    statsContainer: getElementById("stats"),
    perfectWordsElem: getElementById("perfect_words"),
    totalWrongInputsElem: getElementById("total_wrong_inputs"),
    worstWordContainer: getElementById("worst_word_container"),
    worstWordElem: getElementById("worst_word"),
    onInput,
  };
};

export const getElementById = ((context) => (id: string) => {
  const elem = context.getElementById(id);

  if (!elem) {
    throw new Error(`document must have the #${id} element`);
  }

  return elem;
})(document);

const createTextNode = ((context) => context.createTextNode.bind(context))(
  document,
);

export const isElement = (node: Node | ChildNode): node is Element =>
  node.nodeType === Node.ELEMENT_NODE;

const createElementFromTemplate = (template: HTMLTemplateElement) =>
  template.content.cloneNode(true) as DocumentFragment;

const appendChild = (container: Element, node: Node) =>
  container.appendChild(node);

// safety: ensure container element has children
const replaceLastChild = (container: Element, node: Node) =>
  container.replaceChild(node, container.lastChild!);

const clearContainer = (container: Element) => {
  container.innerHTML = "";
};

const updateLetterValue = (letter: string, elem: Element) => {
  elem.setAttribute("data-letter", letter);

  const text = createTextNode(letter);

  if (elem.lastChild === null) {
    appendChild(elem, text);
  } else {
    replaceLastChild(elem, text);
  }
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

export const findElemIndex = (
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

export const renderStats = (
  renderState: RenderState,
  stats: GameState.Stats,
) => {
  const {
    perfectWordsElem,
    totalWrongInputsElem,
    worstWordElem,
    worstWordContainer,
    statsContainer,
  } = renderState;
  const { perfectWords, totalWrongInputs, worstWord } = stats;

  perfectWordsElem.textContent = String(perfectWords);
  totalWrongInputsElem.textContent = String(totalWrongInputs);

  if (worstWord) {
    worstWordElem.textContent = worstWord;
  } else {
    worstWordContainer.classList.add("d-none");
  }

  statsContainer.classList.remove("d-none");
};

export const renderCounters = (
  renderState: RenderState,
  state: Readonly<GameState.Type>,
) => {
  const { currentQuestionContainer, totalQuestionsContainer } = renderState;
  const { words } = state;

  currentQuestionContainer.textContent = `${Zipper.indexOfCurrent(words) + 1}`;
  totalQuestionsContainer.textContent = `${Zipper.length(words)}`;
};

export const renderShuffledLetters = (
  renderState: RenderState,
  state: Readonly<GameState.Type>,
) => {
  const { lettersContainer } = renderState;
  const { shuffledLetters } = state;

  for (const letter of shuffledLetters) {
    const elem = createLetterElem(letter);
    appendChild(lettersContainer, elem);
  }
};

// safety: non-null assertion assumes that shuffledLetters state one to one syncronized with the DOM elements
const getShuffledLetterElem = (
  lettersContainer: HTMLElement,
  letterIndex: number,
): Element => lettersContainer.children.item(letterIndex)!;

const triggerLetterErrorAnimation = (
  letterElem: Element,
  animationQueue: TaskQueue,
) => {
  letterElem.classList.remove("bg-primary");
  letterElem.classList.add("bg-danger");
  letterElem.classList.add("thick-border");

  const oldTaskId = letterElem.getAttribute("data-task-id");
  if (oldTaskId !== null) {
    // cancel previosly queued animation
    animationQueue.remove(parseInt(oldTaskId, 10));
  }

  const taskId = animationQueue.push(() => {
    letterElem.classList.remove("bg-danger");
    letterElem.classList.add("bg-primary");
    letterElem.removeAttribute("data-task-id");

    const taskId = animationQueue.push(() => {
      letterElem.classList.remove("thick-border");
      letterElem.removeAttribute("data-task-id");
    }, 900);

    letterElem.setAttribute("data-task-id", String(taskId));
  }, 400);

  letterElem.setAttribute("data-task-id", String(taskId));
};

const triggerLetterSuccessAnimation = (
  letterElem: Element,
  animationQueue: TaskQueue,
) => {
  // cancel previosly queued animation
  const oldTaskId = letterElem.getAttribute("data-task-id");
  if (oldTaskId !== null) {
    // cancel previosly queued animation
    animationQueue.remove(parseInt(oldTaskId, 10));
  }

  const taskId = animationQueue.push(() => {
    letterElem.classList.remove("bg-primary");
    letterElem.classList.remove("bg-danger");
    letterElem.classList.remove("thick-border");
    letterElem.classList.add("bg-success");
    letterElem.removeAttribute("data-task-id");
  }, 150);

  letterElem.setAttribute("data-task-id", String(taskId));
};

export const renderFailedAnswer = (renderState: RenderState, word: string) => {
  const { answerContainer, lettersContainer, animationQueue } = renderState;
  animationQueue.clear();

  // move nodes from #letters to #answer container
  answerContainer.append(...lettersContainer.childNodes);

  for (const [answerElemIndex, elem] of elemEntries(
    answerContainer.childNodes,
  )) {
    // owerwrite element's letter
    updateLetterValue(word[answerElemIndex], elem);

    // make bg red
    const taskId = animationQueue.push(() => {
      elem.classList.remove("bg-primary");
      elem.classList.remove("thick-border");
      elem.classList.add("bg-danger");
      elem.removeAttribute("data-task-id");
    }, 50);

    elem.setAttribute("data-task-id", String(taskId));
  }
};

export const renderLetterMatched = (
  renderState: RenderState,
  letterIndex: number,
) => {
  const { lettersContainer, animationQueue, answerContainer } = renderState;
  const letterElem = getShuffledLetterElem(lettersContainer, letterIndex);
  triggerLetterSuccessAnimation(letterElem, animationQueue);
  // move the element to the answer section
  appendChild(answerContainer, letterElem);
};

export const renderQuestion = (
  renderState: RenderState,
  state: Readonly<GameState.Type>,
) => {
  clearContainer(renderState.answerContainer); // clear old nodes, generates a bit of garbage
  renderCounters(renderState, state);
  renderShuffledLetters(renderState, state);
};

export const renderLetterError = (
  renderState: RenderState,
  letterIndex: number,
) => {
  const { lettersContainer, animationQueue } = renderState;
  // Trigger error animation if the letter is in shuffled letters
  let letterElem = getShuffledLetterElem(lettersContainer, letterIndex);
  triggerLetterErrorAnimation(letterElem, animationQueue);
};
