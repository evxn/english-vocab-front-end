import * as Zipper from "./zipper";
import * as GameState from "./game-state";
import { TaskQueue } from "./task-queue";

export interface RenderState {
  animationQueue: TaskQueue;
  waiting: boolean;
  answerContainer: HTMLElement;
  lettersContainer: HTMLElement;
  currentQuestionContainer: HTMLElement;
  totalQuestionsContainer: HTMLElement;
  statsContainer: HTMLElement;
  perfectWordsElem: HTMLElement;
  totalWrongInputsElem: HTMLElement;
  worstWordContainer: HTMLElement;
  worstWordElem: HTMLElement;
}

export const init = (): RenderState => ({
  waiting: false,
  animationQueue: new TaskQueue(),
  answerContainer: getElementById("answer"),
  lettersContainer: getElementById("letters"),
  currentQuestionContainer: getElementById("current_question"),
  totalQuestionsContainer: getElementById("total_questions"),
  statsContainer: getElementById("stats"),
  perfectWordsElem: getElementById("perfect_words"),
  totalWrongInputsElem: getElementById("total_wrong_inputs"),
  worstWordContainer: getElementById("worst_word_container"),
  worstWordElem: getElementById("worst_word"),
});

export const isWaiting = ({ waiting }: RenderState): boolean => waiting;

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
  state: GameState.Type,
) => {
  const { currentQuestionContainer, totalQuestionsContainer } = renderState;
  const { words } = state;

  currentQuestionContainer.textContent = `${Zipper.indexOfCurrent(words) + 1}`;
  totalQuestionsContainer.textContent = `${Zipper.length(words)}`;
};

export const renderShuffledLetters = (
  renderState: RenderState,
  state: GameState.Type,
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
  delay: number,
) => {
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
  }, delay);

  letterElem.setAttribute("data-task-id", String(taskId));
};

const triggerLetterSuccessAnimation = (
  letterElem: Element,
  animationQueue: TaskQueue,
  delay: number,
) => {
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
  }, delay);

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
      elem.classList.remove("bg-info");
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
  triggerLetterSuccessAnimation(letterElem, animationQueue, 150);
  // move the element to the answer section
  appendChild(answerContainer, letterElem);
};

export const renderQuestion = (
  renderState: RenderState,
  state: GameState.Type,
) => {
  clearContainer(renderState.answerContainer); // clear old nodes
  renderCounters(renderState, state);
  renderShuffledLetters(renderState, state);
};

export const waitAndRenderQuestion = (
  renderState: RenderState,
  state: GameState.Type,
) => {
  const {
    animationQueue,
    answerContainer,
    totalQuestionsContainer,
    currentQuestionContainer,
    lettersContainer,
  } = renderState;

  renderState.waiting = true; // wait before next question

  // Schedule display next question
  animationQueue.push(() => {
    renderState.waiting = false;

    animationQueue.clear();
    renderQuestion(renderState, state);
  }, 800);
};

export const renderLetterError = (
  renderState: RenderState,
  letterIndex: number,
) => {
  const { lettersContainer, animationQueue } = renderState;
  // Trigger error animation if the letter is in shuffled letters
  let letterElem = getShuffledLetterElem(lettersContainer, letterIndex);
  triggerLetterErrorAnimation(letterElem, animationQueue, 400);
};
