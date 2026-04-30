const STORAGE_KEY = "standards-institute-algebra-1-state";
const NOTES_KEY = "standards-institute-algebra-1-notes";
const DEFAULT_TIME = 5400;

let questions = [];
let current = 0;
let answers = {};
let markedQuestions = new Set();
let eliminatedChoices = {};
let stemMarkup = {};
let time = DEFAULT_TIME;
let timerId = null;
let submitted = false;
let eliminateMode = false;
let highlightMode = false;
let graphingCalculator = null;

const questionText = document.getElementById("questionText");
const choicesDiv = document.getElementById("choices");
const questionGrid = document.getElementById("questionGrid");
const questionNumberBadge = document.getElementById("questionNumberBadge");
const markToggle = document.getElementById("markToggle");
const markToggleLabel = markToggle.querySelector("span:last-child");
const answeredCount = document.getElementById("answeredCount");
const totalQuestions = document.getElementById("totalQuestions");
const markedCount = document.getElementById("markedCount");
const prevButton = document.getElementById("prevButton");
const nextButton = document.getElementById("nextButton");
const submitButton = document.getElementById("submitButton");
const eliminateModeButton = document.getElementById("eliminateModeButton");
const highlightModeButton = document.getElementById("highlightModeButton");
const examShell = document.querySelector(".exam-shell");
const leftSidebar = document.getElementById("leftSidebar");
const rightSidebar = document.getElementById("rightSidebar");
const calculatorButton = document.getElementById("calculatorButton");
const graphingButton = document.getElementById("graphingButton");
const notesButton = document.getElementById("notesButton");
const notesField = document.getElementById("notesField");
const graphingContainer = document.getElementById("desmosGraphingCalculator");
const submitSummary = document.getElementById("submitSummary");
const submitChecklist = document.getElementById("submitChecklist");
const confirmSubmitButton = document.getElementById("confirmSubmitButton");
const restartButton = document.getElementById("restartButton");
const resultsScore = document.getElementById("resultsScore");
const resultsBreakdown = document.getElementById("resultsBreakdown");
const resultsAnswered = document.getElementById("resultsAnswered");
const resultsCorrect = document.getElementById("resultsCorrect");
const resultsMarked = document.getElementById("resultsMarked");
const resultsTime = document.getElementById("resultsTime");
const resultsReview = document.getElementById("resultsReview");

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getQuestionPromptMarkup(index) {
  return stemMarkup[index] || escapeHtml(questions[index].prompt);
}

function normalizeText(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, "");
}

function normalizeNumeric(value) {
  const trimmed = String(value).trim();
  if (!trimmed) return "";

  if (trimmed.includes("/")) {
    const [numerator, denominator] = trimmed.split("/");
    const top = Number(numerator);
    const bottom = Number(denominator);
    if (!Number.isNaN(top) && !Number.isNaN(bottom) && bottom !== 0) {
      return String(top / bottom);
    }
  }

  const numeric = Number(trimmed);
  return Number.isNaN(numeric) ? normalizeText(trimmed) : String(numeric);
}

function getAnsweredCount() {
  return questions.filter((_, index) => hasAnswer(index)).length;
}

function hasAnswer(index) {
  const question = questions[index];
  const answer = answers[index];

  if (question.type === "select_multiple") {
    return Array.isArray(answer) && answer.length > 0;
  }

  if (question.type === "numeric" || question.type === "short_response") {
    return typeof answer === "string" && answer.trim().length > 0;
  }

  if (question.type === "graph_point") {
    return typeof answer === "string" && answer.length > 0;
  }

  return Number.isInteger(answer);
}

function formatTime(totalSeconds) {
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function saveState() {
  const state = {
    current,
    answers,
    markedQuestions: [...markedQuestions],
    eliminatedChoices,
    stemMarkup,
    time,
    submitted
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function restoreState() {
  const rawState = localStorage.getItem(STORAGE_KEY);
  if (!rawState) return;

  try {
    const state = JSON.parse(rawState);
    current = Number.isInteger(state.current) ? state.current : 0;
    answers = state.answers && typeof state.answers === "object" ? state.answers : {};
    markedQuestions = new Set(Array.isArray(state.markedQuestions) ? state.markedQuestions : []);
    eliminatedChoices = state.eliminatedChoices && typeof state.eliminatedChoices === "object" ? state.eliminatedChoices : {};
    stemMarkup = state.stemMarkup && typeof state.stemMarkup === "object" ? state.stemMarkup : {};
    time = typeof state.time === "number" ? state.time : DEFAULT_TIME;
    submitted = Boolean(state.submitted);
  } catch {
    current = 0;
    answers = {};
    markedQuestions = new Set();
    eliminatedChoices = {};
    stemMarkup = {};
    time = DEFAULT_TIME;
    submitted = false;
  }
}

function loadNotes() {
  notesField.value = localStorage.getItem(NOTES_KEY) || "";
}

function saveNotes() {
  localStorage.setItem(NOTES_KEY, notesField.value);
}

function updateHeaderStats() {
  answeredCount.textContent = getAnsweredCount();
  totalQuestions.textContent = questions.length;
  markedCount.textContent = markedQuestions.size;
}

function updateNavigationState() {
  const supportsElimination = ["multiple_choice", "select_multiple"].includes(questions[current]?.type);
  if (!supportsElimination) {
    eliminateMode = false;
  }

  prevButton.disabled = current === 0 || submitted;
  nextButton.disabled = current === questions.length - 1 || submitted;
  submitButton.disabled = submitted;
  submitButton.hidden = current !== questions.length - 1 || submitted;
  markToggle.disabled = submitted;
  eliminateModeButton.disabled = submitted || !supportsElimination;
  highlightModeButton.disabled = submitted;
  eliminateModeButton.classList.toggle("mode-active", eliminateMode);
  highlightModeButton.classList.toggle("mode-active", highlightMode);
}

function getQuestionState(index) {
  if (index === current) return "current";
  if (markedQuestions.has(index)) return "marked";
  if (hasAnswer(index)) return "answered";
  return "unanswered";
}

function renderGrid() {
  questionGrid.innerHTML = "";

  questions.forEach((_, index) => {
    const button = document.createElement("button");
    button.className = `q-box ${getQuestionState(index)}`;
    button.type = "button";
    button.textContent = index + 1;
    button.disabled = submitted;
    button.onclick = () => {
      current = index;
      saveState();
      renderQuestion();
    };
    questionGrid.appendChild(button);
  });
}

function getEliminatedChoices(index) {
  return Array.isArray(eliminatedChoices[index]) ? eliminatedChoices[index] : [];
}

function toggleEliminatedChoice(questionIndex, choiceIndex) {
  const list = new Set(getEliminatedChoices(questionIndex));
  if (list.has(choiceIndex)) {
    list.delete(choiceIndex);
  } else {
    list.add(choiceIndex);
  }
  eliminatedChoices[questionIndex] = [...list];
}

function renderChoiceButton(question, choice, index) {
  const button = document.createElement("button");
  button.className = "choice";
  button.type = "button";

  const isMulti = question.type === "select_multiple";
  const eliminated = getEliminatedChoices(current).includes(index);

  if (isMulti) {
    button.classList.add("choice-multi");
  }

  if (eliminated) {
    button.classList.add("eliminated");
  }

  if (question.type === "select_multiple") {
    const selected = Array.isArray(answers[current]) && answers[current].includes(index);
    if (selected) button.classList.add("selected");
  } else if (answers[current] === index) {
    button.classList.add("selected");
  }

  if (submitted) {
    button.disabled = true;
    if (question.type === "select_multiple") {
      const selected = Array.isArray(answers[current]) && answers[current].includes(index);
      const correct = question.correct.includes(index);
      if (correct) button.classList.add("correct");
      if (selected && !correct) button.classList.add("incorrect");
    } else if (index === question.correct) {
      button.classList.add("correct");
    } else if (answers[current] === index) {
      button.classList.add("incorrect");
    }
  }

  button.innerHTML = `
    <span class="choice-letter">${isMulti ? "&#10003;" : String.fromCharCode(65 + index)}</span>
    <span class="choice-text">${choice}</span>
  `;

  button.onclick = () => {
    if (submitted) return;

    if (eliminateMode) {
      toggleEliminatedChoice(current, index);
      saveState();
      renderQuestion();
      return;
    }

    if (question.type === "select_multiple") {
      const selected = new Set(Array.isArray(answers[current]) ? answers[current] : []);
      if (selected.has(index)) {
        selected.delete(index);
      } else {
        selected.add(index);
      }
      answers[current] = [...selected].sort((a, b) => a - b);
    } else {
      answers[current] = index;
    }

    saveState();
    renderQuestion();
  };

  return button;
}

function renderMultipleChoice(question) {
  choicesDiv.className = "choices";
  question.choices.forEach((choice, index) => {
    choicesDiv.appendChild(renderChoiceButton(question, choice, index));
  });
}

function renderTextResponse(question) {
  choicesDiv.className = "response-panel";
  const value = typeof answers[current] === "string" ? answers[current] : "";
  const wrapper = document.createElement("div");
  wrapper.className = "response-card";

  const input = document.createElement("input");
  input.className = "response-input";
  input.type = "text";
  input.placeholder = question.placeholder || "Enter your response";
  input.value = value;
  input.disabled = submitted;

  input.addEventListener("input", (event) => {
    answers[current] = event.target.value;
    saveState();
    updateHeaderStats();
    renderGrid();
  });

  wrapper.appendChild(input);

  if (submitted) {
    const feedback = document.createElement("div");
    feedback.className = isCorrect(current) ? "response-feedback review-good" : "response-feedback review-bad";
    feedback.textContent = isCorrect(current) ? "Accepted response" : "Check response";
    wrapper.appendChild(feedback);
  }

  choicesDiv.appendChild(wrapper);
}

function renderGraphQuestion(question) {
  choicesDiv.className = "graph-question-panel";
  const wrapper = document.createElement("div");
  wrapper.className = "graph-card";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 360 260");
  svg.setAttribute("class", "graph-plane");

  const { xMin, xMax, yMin, yMax, points } = question.graph;
  const width = 360;
  const height = 260;
  const padding = 28;

  const toSvgX = (x) => padding + ((x - xMin) / (xMax - xMin)) * (width - padding * 2);
  const toSvgY = (y) => height - padding - ((y - yMin) / (yMax - yMin)) * (height - padding * 2);

  for (let x = xMin; x <= xMax; x += 1) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", toSvgX(x));
    line.setAttribute("x2", toSvgX(x));
    line.setAttribute("y1", padding);
    line.setAttribute("y2", height - padding);
    line.setAttribute("class", x === 0 ? "axis-line" : "grid-line");
    svg.appendChild(line);
  }

  for (let y = yMin; y <= yMax; y += 1) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", padding);
    line.setAttribute("x2", width - padding);
    line.setAttribute("y1", toSvgY(y));
    line.setAttribute("y2", toSvgY(y));
    line.setAttribute("class", y === 0 ? "axis-line" : "grid-line");
    svg.appendChild(line);
  }

  points.forEach((point) => {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", "graph-point-group");

    const isSelected = answers[current] === point.id;
    const isCorrectPoint = submitted && point.id === question.correct;
    const isIncorrectPoint = submitted && isSelected && point.id !== question.correct;

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", toSvgX(point.x));
    circle.setAttribute("cy", toSvgY(point.y));
    circle.setAttribute("r", 9);
    circle.setAttribute("class", `graph-point${isSelected ? " selected" : ""}${isCorrectPoint ? " correct" : ""}${isIncorrectPoint ? " incorrect" : ""}`);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", toSvgX(point.x) + 12);
    text.setAttribute("y", toSvgY(point.y) - 10);
    text.setAttribute("class", "graph-point-label");
    text.textContent = `${point.label} (${point.x}, ${point.y})`;

    group.appendChild(circle);
    group.appendChild(text);

    if (!submitted) {
      group.style.cursor = "pointer";
      group.addEventListener("click", () => {
        answers[current] = point.id;
        saveState();
        renderQuestion();
      });
    }

    svg.appendChild(group);
  });

  wrapper.appendChild(svg);
  choicesDiv.appendChild(wrapper);
}

function renderQuestionInput(question) {
  choicesDiv.innerHTML = "";

  if (question.type === "multiple_choice" || question.type === "select_multiple") {
    renderMultipleChoice(question);
    return;
  }

  if (question.type === "numeric" || question.type === "short_response") {
    renderTextResponse(question);
    return;
  }

  if (question.type === "graph_point") {
    renderGraphQuestion(question);
  }
}

function renderQuestion() {
  if (!questions.length) return;

  const question = questions[current];
  questionNumberBadge.textContent = current + 1;
  questionText.innerHTML = getQuestionPromptMarkup(current);

  renderQuestionInput(question);

  markToggle.classList.toggle("active", markedQuestions.has(current));
  markToggleLabel.textContent = markedQuestions.has(current) ? "Marked for Review" : "Mark for Review";

  renderGrid();
  updateHeaderStats();
  updateNavigationState();
}

function nextQuestion() {
  if (current < questions.length - 1) {
    current += 1;
    saveState();
    renderQuestion();
  }
}

function prevQuestion() {
  if (current > 0) {
    current -= 1;
    saveState();
    renderQuestion();
  }
}

function toggleMarked() {
  if (submitted) return;

  if (markedQuestions.has(current)) {
    markedQuestions.delete(current);
  } else {
    markedQuestions.add(current);
  }

  saveState();
  renderQuestion();
}

function toggleEliminateMode() {
  if (submitted) return;
  eliminateMode = !eliminateMode;
  if (eliminateMode) highlightMode = false;
  updateNavigationState();
}

function toggleHighlightMode() {
  if (submitted) return;
  highlightMode = !highlightMode;
  if (highlightMode) eliminateMode = false;
  updateNavigationState();
}

function applyHighlightFromSelection() {
  if (!highlightMode || submitted) return;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

  const range = selection.getRangeAt(0);
  if (!questionText.contains(range.commonAncestorContainer)) return;

  const highlight = document.createElement("span");
  highlight.className = "highlighted-text";

  try {
    const fragment = range.extractContents();
    highlight.appendChild(fragment);
    range.insertNode(highlight);
    selection.removeAllRanges();
    stemMarkup[current] = questionText.innerHTML;
    saveState();
  } catch {
    selection.removeAllRanges();
  }
}

function openModal(id) {
  const modal = document.getElementById(id);
  const windowEl = modal.querySelector(".draggable-window");
  if (windowEl) {
    windowEl.style.left = "";
    windowEl.style.top = "";
    windowEl.style.transform = "";
  }
  modal.style.display = "flex";
}

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

function toggleSidebar(side) {
  const isLeft = side === "left";
  const sidebar = isLeft ? leftSidebar : rightSidebar;
  const variableName = isLeft ? "--left-sidebar-width" : "--right-sidebar-width";
  const expandedWidth = isLeft ? "320px" : "234px";
  const collapsedWidth = "64px";

  sidebar.classList.toggle("collapsed");
  examShell.style.setProperty(
    variableName,
    sidebar.classList.contains("collapsed") ? collapsedWidth : expandedWidth
  );
}

function updateTimer() {
  if (submitted) return;

  if (time > 0) {
    time -= 1;
    document.getElementById("time").textContent = formatTime(time);
    saveState();
    return;
  }

  showSubmitModal(true);
}

function startTimer() {
  if (timerId) clearInterval(timerId);
  document.getElementById("time").textContent = formatTime(time);
  timerId = setInterval(updateTimer, 1000);
}

function showSubmitModal(autoSubmit = false) {
  if (timerId && autoSubmit) {
    clearInterval(timerId);
    timerId = null;
  }

  const unanswered = questions.length - getAnsweredCount();
  submitSummary.textContent = autoSubmit
    ? "Time has expired. Review your counts below and submit your mock exam."
    : "You are about to finish this mock exam. Review your progress before submitting.";

  submitChecklist.innerHTML = `
    <div class="submit-line"><span>Answered questions</span><strong>${getAnsweredCount()} of ${questions.length}</strong></div>
    <div class="submit-line"><span>Unanswered questions</span><strong>${unanswered}</strong></div>
    <div class="submit-line"><span>Marked for review</span><strong>${markedQuestions.size}</strong></div>
    <div class="submit-line"><span>Time remaining</span><strong>${formatTime(time)}</strong></div>
  `;

  openModal("submitModal");
}

function isCorrect(index) {
  const question = questions[index];
  const answer = answers[index];

  if (!hasAnswer(index)) return false;

  if (question.type === "multiple_choice") {
    return answer === question.correct;
  }

  if (question.type === "select_multiple") {
    const actual = Array.isArray(answer) ? [...answer].sort((a, b) => a - b) : [];
    const expected = [...question.correct].sort((a, b) => a - b);
    return JSON.stringify(actual) === JSON.stringify(expected);
  }

  if (question.type === "numeric") {
    const normalizedAnswer = normalizeNumeric(answer);
    return question.acceptedAnswers.some((accepted) => normalizeNumeric(accepted) === normalizedAnswer);
  }

  if (question.type === "short_response") {
    const normalizedAnswer = normalizeText(answer);
    return question.acceptedAnswers.some((accepted) => normalizeText(accepted) === normalizedAnswer);
  }

  if (question.type === "graph_point") {
    return answer === question.correct;
  }

  return false;
}

function describeAnswer(index) {
  const question = questions[index];
  const answer = answers[index];

  if (!hasAnswer(index)) return "Unanswered";

  if (question.type === "multiple_choice") {
    return `${String.fromCharCode(65 + answer)}. ${question.choices[answer]}`;
  }

  if (question.type === "select_multiple") {
    return answer
      .map((choiceIndex) => `${String.fromCharCode(65 + choiceIndex)}. ${question.choices[choiceIndex]}`)
      .join(", ");
  }

  if (question.type === "graph_point") {
    return `Point ${answer}`;
  }

  return String(answer);
}

function describeCorrectAnswer(index) {
  const question = questions[index];

  if (question.type === "multiple_choice") {
    return `${String.fromCharCode(65 + question.correct)}. ${question.choices[question.correct]}`;
  }

  if (question.type === "select_multiple") {
    return question.correct
      .map((choiceIndex) => `${String.fromCharCode(65 + choiceIndex)}. ${question.choices[choiceIndex]}`)
      .join(", ");
  }

  if (question.type === "graph_point") {
    return `Point ${question.correct}`;
  }

  return question.acceptedAnswers.join(" or ");
}

function finalizeSubmission() {
  submitted = true;
  saveState();
  closeModal("submitModal");
  if (timerId) clearInterval(timerId);
  renderQuestion();
  renderResults();
  openModal("resultsModal");
}

function renderResults() {
  let correct = 0;
  resultsReview.innerHTML = "";

  questions.forEach((question, index) => {
    if (isCorrect(index)) correct += 1;

    const row = document.createElement("div");
    row.className = "review-row";
    row.innerHTML = `
      <div class="review-row-top">
        <strong>Question ${index + 1}</strong>
        <span class="${isCorrect(index) ? "review-good" : "review-bad"}">
          ${isCorrect(index) ? "Correct" : "Check"}
        </span>
      </div>
      <p>${escapeHtml(question.prompt)}</p>
      <div class="review-meta">
        <span>Your answer: ${escapeHtml(describeAnswer(index))}</span>
        <span>Correct answer: ${escapeHtml(describeCorrectAnswer(index))}</span>
      </div>
    `;

    resultsReview.appendChild(row);
  });

  const score = Math.round((correct / questions.length) * 100);
  resultsScore.textContent = `${score}%`;
  resultsBreakdown.textContent = `${correct} correct out of ${questions.length} questions`;
  resultsAnswered.textContent = getAnsweredCount();
  resultsCorrect.textContent = correct;
  resultsMarked.textContent = markedQuestions.size;
  resultsTime.textContent = formatTime(time);
}

function restartTest() {
  current = 0;
  answers = {};
  markedQuestions = new Set();
  eliminatedChoices = {};
  stemMarkup = {};
  time = DEFAULT_TIME;
  submitted = false;
  eliminateMode = false;
  highlightMode = false;
  closeModal("resultsModal");
  localStorage.removeItem(STORAGE_KEY);
  startTimer();
  renderQuestion();
}

function initGraphingCalculator() {
  if (graphingCalculator || !window.Desmos || !graphingContainer) return;

  graphingCalculator = Desmos.GraphingCalculator(graphingContainer, {
    expressions: true,
    expressionsTopbar: false,
    settingsMenu: true,
    zoomButtons: true,
    keypad: true,
    border: false,
    expressionsCollapsed: false,
    lockViewport: false,
    pasteGraphLink: false,
    links: false
  });

  graphingCalculator.setExpression({ id: "starter1", latex: "y=x^2" });
  graphingCalculator.setExpression({ id: "starter2", latex: "y=2x+1" });
}

function setupDraggableWindows() {
  document.querySelectorAll(".draggable-window").forEach((windowEl) => {
    const handle = windowEl.querySelector(".drag-handle");
    if (!handle) return;

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    handle.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;

      dragging = true;
      const rect = windowEl.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;

      windowEl.style.left = `${rect.left}px`;
      windowEl.style.top = `${rect.top}px`;
      windowEl.style.transform = "none";
      handle.setPointerCapture(event.pointerId);
    });

    handle.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      windowEl.style.left = `${event.clientX - offsetX}px`;
      windowEl.style.top = `${event.clientY - offsetY}px`;
    });

    const endDrag = (event) => {
      if (!dragging) return;
      dragging = false;
      if (handle.hasPointerCapture(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId);
      }
    };

    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
  });
}

async function loadQuestions() {
  try {
    const response = await fetch("./questions.json");
    if (!response.ok) {
      throw new Error("Unable to load questions.json");
    }

    questions = await response.json();
  } catch {
    const fallback = document.getElementById("questionsFallback");
    questions = JSON.parse(fallback.textContent);
  }
}

calculatorButton.addEventListener("click", () => openModal("calculatorModal"));
graphingButton.addEventListener("click", () => {
  initGraphingCalculator();
  openModal("graphingModal");
});
notesButton.addEventListener("click", () => openModal("notesModal"));
notesField.addEventListener("input", saveNotes);
markToggle.addEventListener("click", toggleMarked);
submitButton.addEventListener("click", () => showSubmitModal(false));
confirmSubmitButton.addEventListener("click", finalizeSubmission);
restartButton.addEventListener("click", restartTest);
eliminateModeButton.addEventListener("click", toggleEliminateMode);
highlightModeButton.addEventListener("click", toggleHighlightMode);
questionText.addEventListener("mouseup", applyHighlightFromSelection);

window.nextQuestion = nextQuestion;
window.prevQuestion = prevQuestion;
window.toggleSidebar = toggleSidebar;
window.openModal = openModal;
window.closeModal = closeModal;

async function init() {
  loadNotes();
  restoreState();
  await loadQuestions();
  setupDraggableWindows();

  if (current > questions.length - 1) {
    current = 0;
  }

  startTimer();
  renderQuestion();

  if (submitted) {
    if (timerId) clearInterval(timerId);
    renderResults();
    openModal("resultsModal");
  }
}

init().catch(() => {
  questionText.textContent = "There was a problem loading the Algebra I question set.";
});