const STORAGE_KEY = "standards-institute-algebra-1-state";
const NOTES_KEY = "standards-institute-algebra-1-notes";
const DEFAULT_TIME = 5400;

let questions = [];
let current = 0;
let answers = {};
let markedQuestions = new Set();
let time = DEFAULT_TIME;
let timerId = null;
let submitted = false;

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
let graphingCalculator = null;

function getAnsweredCount() {
  return Object.keys(answers).length;
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
    time = typeof state.time === "number" ? state.time : DEFAULT_TIME;
    submitted = Boolean(state.submitted);
  } catch {
    current = 0;
    answers = {};
    markedQuestions = new Set();
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
  prevButton.disabled = current === 0 || submitted;
  nextButton.disabled = current === questions.length - 1 || submitted;
  submitButton.disabled = submitted;
  markToggle.disabled = submitted;
  submitButton.hidden = current !== questions.length - 1;
}

function renderQuestion() {
  if (!questions.length) return;

  const q = questions[current];
  questionNumberBadge.textContent = current + 1;
  questionText.textContent = q.text;
  choicesDiv.innerHTML = "";

  q.choices.forEach((choice, index) => {
    const button = document.createElement("button");
    button.className = "choice";
    button.type = "button";

    if (answers[current] === index) {
      button.classList.add("selected");
    }

    if (submitted) {
      button.disabled = true;
      if (index === q.correct) {
        button.classList.add("correct");
      } else if (answers[current] === index) {
        button.classList.add("incorrect");
      }
    }

    button.innerHTML = `
      <span class="choice-letter">${String.fromCharCode(65 + index)}</span>
      <span class="choice-text">${choice}</span>
    `;

    button.onclick = () => {
      answers[current] = index;
      saveState();
      renderQuestion();
    };

    choicesDiv.appendChild(button);
  });

  markToggle.classList.toggle("active", markedQuestions.has(current));
  markToggleLabel.textContent = markedQuestions.has(current) ? "Marked for Review" : "Mark for Review";

  renderGrid();
  updateHeaderStats();
  updateNavigationState();
}

function getQuestionState(index) {
  if (index === current) return "current";
  if (markedQuestions.has(index)) return "marked";
  if (Object.hasOwn(answers, index)) return "answered";
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
    projectorMode: false,
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
    if (answers[index] === question.correct) correct += 1;

    const row = document.createElement("div");
    row.className = "review-row";

    const userAnswer = Object.hasOwn(answers, index) ? String.fromCharCode(65 + answers[index]) : "Unanswered";
    const correctAnswer = String.fromCharCode(65 + question.correct);

    row.innerHTML = `
      <div class="review-row-top">
        <strong>Question ${index + 1}</strong>
        <span class="${answers[index] === question.correct ? "review-good" : "review-bad"}">
          ${answers[index] === question.correct ? "Correct" : "Check"}
        </span>
      </div>
      <p>${question.text}</p>
      <div class="review-meta">
        <span>Your answer: ${userAnswer}</span>
        <span>Correct answer: ${correctAnswer}</span>
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
  time = DEFAULT_TIME;
  submitted = false;
  closeModal("resultsModal");
  localStorage.removeItem(STORAGE_KEY);
  startTimer();
  renderQuestion();
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
