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
let paused = false;

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
const calculatorFrame = document.getElementById("calculatorFrame");
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
const pauseButton = document.querySelector(".pause-button");

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getQuestionPromptMarkup(index) {
  return stemMarkup[index] || questions[index].prompt;
}

function normalizeText(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)")
    .replace(/\\left\|([^|]+)\|/g, "|$1|")
    .replace(/\\sqrt\{([^}]+)\}/g, "sqrt($1)")
    .replace(/\\pi/g, "pi")
    .replace(/\\cdot/g, "*")
    .replace(/\\times/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\le/g, "<=")
    .replace(/\\ge/g, ">=")
    .replace(/\\neq/g, "!=")
    .replace(/\\/g, "")
    .replace(/\{|\}/g, "")
    .replace(/\s+/g, "");
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
  if (question.type === "select_multiple") return Array.isArray(answer) && answer.length > 0;
  if (question.type === "numeric" || question.type === "short_response") return typeof answer === "string" && answer.trim().length > 0;
  if (question.type === "graph_point" || question.type === "graph_line") return typeof answer === "string" && answer.length > 0;
  return Number.isInteger(answer);
}

function formatTime(totalSeconds) {
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function saveState() {
  const state = { current, answers, markedQuestions: [...markedQuestions], eliminatedChoices, stemMarkup, time, submitted };
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
    current = 0; answers = {}; markedQuestions = new Set();
    eliminatedChoices = {}; stemMarkup = {}; time = DEFAULT_TIME; submitted = false;
  }
}

function loadNotes() { notesField.value = localStorage.getItem(NOTES_KEY) || ""; }
function saveNotes() { localStorage.setItem(NOTES_KEY, notesField.value); }

function updateHeaderStats() {
  answeredCount.textContent = getAnsweredCount();
  totalQuestions.textContent = questions.length;
  markedCount.textContent = markedQuestions.size;
}

function updateNavigationState() {
  const supportsElimination = ["multiple_choice", "select_multiple"].includes(questions[current]?.type);
  if (!supportsElimination) eliminateMode = false;
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
    button.onclick = () => { current = index; saveState(); renderQuestion(); };
    questionGrid.appendChild(button);
  });
}

function getEliminatedChoices(index) {
  return Array.isArray(eliminatedChoices[index]) ? eliminatedChoices[index] : [];
}

function toggleEliminatedChoice(questionIndex, choiceIndex) {
  const list = new Set(getEliminatedChoices(questionIndex));
  if (list.has(choiceIndex)) { list.delete(choiceIndex); } else { list.add(choiceIndex); }
  eliminatedChoices[questionIndex] = [...list];
}

// ── INFO BOX ─────────────────────────────────────────────
// Renders the gray context panel shown in the docx (like a system of equations, table, or step list)

function renderInfoBox(lines) {
  const box = document.createElement("div");
  box.className = "info-box";
  lines.forEach(line => {
    const row = document.createElement("div");
    row.className = "info-box-row";
    row.innerHTML = line; // LaTeX inline — typeset later
    box.appendChild(row);
  });
  return box;
}

// ── CHOICE BUTTONS ───────────────────────────────────────

function renderChoiceButton(question, choice, index) {
  const button = document.createElement("button");
  button.className = "choice";
  button.type = "button";

  const isMulti = question.type === "select_multiple";
  const eliminated = getEliminatedChoices(current).includes(index);
  const letter = String.fromCharCode(65 + index);

  if (isMulti) button.classList.add("choice-multi");
  if (eliminated) button.classList.add("eliminated");

  const isSelected = isMulti
    ? Array.isArray(answers[current]) && answers[current].includes(index)
    : answers[current] === index;

  if (isSelected) button.classList.add("selected");

  if (submitted) {
    button.disabled = true;
    if (isMulti) {
      const correct = question.correct.includes(index);
      if (correct) button.classList.add("correct");
      if (isSelected && !correct) button.classList.add("incorrect");
    } else if (index === question.correct) {
      button.classList.add("correct");
    } else if (answers[current] === index) {
      button.classList.add("incorrect");
    }
  }

  const radioEl = document.createElement("span");
  radioEl.className = "choice-letter";

  const textWrapper = document.createElement("span");
  textWrapper.className = "choice-text-wrapper";

  const alphaEl = document.createElement("span");
  alphaEl.className = "choice-alpha";
  alphaEl.textContent = letter;

  const textEl = document.createElement("span");
  textEl.className = "choice-text";
  textEl.innerHTML = choice;

  textWrapper.appendChild(alphaEl);
  textWrapper.appendChild(textEl);

  button.appendChild(radioEl);
  button.appendChild(textWrapper);

  button.onclick = () => {
    if (submitted) return;
    if (eliminateMode) {
      toggleEliminatedChoice(current, index);
      saveState(); renderQuestion(); return;
    }
    if (isMulti) {
      const selected = new Set(Array.isArray(answers[current]) ? answers[current] : []);
      if (selected.has(index)) { selected.delete(index); } else { selected.add(index); }
      answers[current] = [...selected].sort((a, b) => a - b);
    } else {
      answers[current] = index;
    }
    saveState(); renderQuestion();
  };

  return button;
}

function renderMultipleChoice(question) {
  choicesDiv.className = "choices";
  question.choices.forEach((choice, index) => choicesDiv.appendChild(renderChoiceButton(question, choice, index)));
}

// ── MATH INPUT / KEYPAD ──────────────────────────────────

const KEYPAD_DEF = [
  [ {l:"x",i:"x"}, {l:"y",i:"y"}, {l:"(",i:"("}, {l:")",i:")"}, {l:"x²",i:"^{2}"}, {l:"xⁿ",i:"^{"}, {l:"√",i:"\\sqrt{"}, {l:"=",i:"="} ],
  [ {l:"7",i:"7"}, {l:"8",i:"8"}, {l:"9",i:"9"}, {l:"÷",i:"\\div"}, {l:"≤",i:"\\le"}, {l:"≥",i:"\\ge"}, {l:"←",a:"left",c:"key-nav"}, {l:"→",a:"right",c:"key-nav"} ],
  [ {l:"4",i:"4"}, {l:"5",i:"5"}, {l:"6",i:"6"}, {l:"×",i:"\\times"}, {l:"−",i:"-"}, {l:"+",i:"+"}, {l:"⌫",a:"backspace",c:"key-action"}, {l:"✕",a:"clear",c:"key-action"} ],
  [ {l:"1",i:"1"}, {l:"2",i:"2"}, {l:"3",i:"3"}, {l:"0",i:"0"}, {l:".",i:"."}, {l:"π",i:"\\pi"}, {l:"a/b",i:"\\frac{",c:"key-wide"}, {l:"±",i:"-"} ]
];

let keypadsVisible = {};
const mqFields = {};

function buildKeypad(mqField) {
  const keypad = document.createElement("div");
  keypad.className = "math-keypad";
  KEYPAD_DEF.forEach(row => {
    const rowEl = document.createElement("div");
    rowEl.className = "keypad-row";
    row.forEach(key => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "keypad-key" + (key.c ? ` ${key.c}` : "");
      btn.textContent = key.l;
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        if (!mqField) return;
        if (key.a === "backspace") {
          mqField.keystroke("Backspace");
        } else if (key.a === "clear") {
          mqField.select();
          mqField.keystroke("Backspace");
        } else if (key.a === "left") {
          mqField.keystroke("Left");
        } else if (key.a === "right") {
          mqField.keystroke("Right");
        } else if (key.i) {
          mqField.write(key.i);
        }
        mqField.focus();
      });
      rowEl.appendChild(btn);
    });
    keypad.appendChild(rowEl);
  });
  return keypad;
}

function renderTextResponse(question) {
  choicesDiv.className = "response-panel";
  const value = typeof answers[current] === "string" ? answers[current] : "";
  const qIndex = current;

  const wrapper = document.createElement("div");
  wrapper.className = "response-card math-response-card";

  const fieldRow = document.createElement("div");
  fieldRow.className = "math-input-row";

  const inputLabel = document.createElement("span");
  inputLabel.className = "math-input-label";
  inputLabel.textContent = "Answer:";

  const mqSpan = document.createElement("span");
  mqSpan.className = "mq-field-wrap" + (submitted ? " mq-disabled" : "");

  const keypadToggle = document.createElement("button");
  keypadToggle.type = "button";
  keypadToggle.className = "keypad-toggle-btn";
  keypadToggle.title = "Toggle keypad";
  keypadToggle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M7 8h2M11 8h2M15 8h2M7 12h2M11 12h2M15 12h2M7 16h10"/></svg>`;

  fieldRow.appendChild(inputLabel);
  fieldRow.appendChild(mqSpan);
  if (!submitted) fieldRow.appendChild(keypadToggle);
  wrapper.appendChild(fieldRow);

  const keypadWrap = document.createElement("div");
  keypadWrap.className = "keypad-wrap";
  keypadWrap.style.display = keypadsVisible[qIndex] ? "block" : "none";
  wrapper.appendChild(keypadWrap);

  if (submitted) {
    const feedback = document.createElement("div");
    feedback.className = isCorrect(current) ? "response-feedback review-good" : "response-feedback review-bad";
    feedback.textContent = isCorrect(current) ? "Accepted response" : "Check response";
    wrapper.appendChild(feedback);
  }

  choicesDiv.appendChild(wrapper);

  if (window.MathQuill) {
    const MQ = window.MathQuill.getInterface(2);
    const config = {
      spaceBehavesLikeTab: false,
      leftRightIntoCmdGoes: "up",
      restrictMismatchedBrackets: false,
      handlers: {
        edit: (field) => {
          const latex = field.latex();
          answers[qIndex] = latex;
          saveState(); updateHeaderStats(); renderGrid();
        }
      }
    };

    let mf;
    if (submitted) {
      mf = MQ.StaticMath(mqSpan);
      mf.latex(value);
    } else {
      mf = MQ.MathField(mqSpan, config);
      if (value) mf.latex(value);
      mqFields[qIndex] = mf;

      const keypad = buildKeypad(mf);
      keypadWrap.appendChild(keypad);

      keypadToggle.addEventListener("click", () => {
        const isVisible = keypadWrap.style.display !== "none";
        keypadWrap.style.display = isVisible ? "none" : "block";
        keypadsVisible[qIndex] = !isVisible;
        keypadToggle.classList.toggle("keypad-toggle-active", !isVisible);
        if (!isVisible) mf.focus();
      });

      if (keypadsVisible[qIndex]) keypadToggle.classList.add("keypad-toggle-active");
      setTimeout(() => mf.focus(), 0);
    }
  } else {
    const input = document.createElement("input");
    input.className = "response-input";
    input.type = "text";
    input.placeholder = question.placeholder || "Type your answer";
    input.value = value;
    input.disabled = submitted;
    input.addEventListener("input", (e) => {
      answers[qIndex] = e.target.value;
      saveState(); updateHeaderStats(); renderGrid();
    });
    mqSpan.replaceWith(input);
  }
}

// ── GRAPH POINT ──────────────────────────────────────────

function renderGraphQuestion(question) {
  choicesDiv.className = "graph-question-panel";
  const wrapper = document.createElement("div");
  wrapper.className = "graph-card";
  const svg = buildGraphSVG(question, "graph_point");
  wrapper.appendChild(svg);
  choicesDiv.appendChild(wrapper);
}

// ── GRAPH LINE ───────────────────────────────────────────
// Student sees the line drawn and must identify the correct labeled point (e.g. y-intercept)

function renderGraphLine(question) {
  choicesDiv.className = "graph-question-panel";
  const wrapper = document.createElement("div");
  wrapper.className = "graph-card";

  const typeLabel = document.createElement("div");
  typeLabel.className = "graph-type-label";
  typeLabel.textContent = "Graph Question — Select the correct labeled point";
  wrapper.appendChild(typeLabel);

  const svg = buildGraphSVG(question, "graph_line");
  wrapper.appendChild(svg);
  choicesDiv.appendChild(wrapper);
}

function buildGraphSVG(question, mode) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 400 300");
  svg.setAttribute("class", "graph-plane");

  const { xMin, xMax, yMin, yMax, points } = question.graph;
  const W = 400, H = 300, PAD = 36;
  const toSvgX = x => PAD + ((x - xMin) / (xMax - xMin)) * (W - PAD * 2);
  const toSvgY = y => H - PAD - ((y - yMin) / (yMax - yMin)) * (H - PAD * 2);

  // Grid lines
  for (let x = xMin; x <= xMax; x++) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", toSvgX(x)); line.setAttribute("x2", toSvgX(x));
    line.setAttribute("y1", PAD); line.setAttribute("y2", H - PAD);
    line.setAttribute("class", x === 0 ? "axis-line" : "grid-line");
    svg.appendChild(line);
    // x-axis tick labels
    if (x !== 0) {
      const lbl = document.createElementNS("http://www.w3.org/2000/svg", "text");
      lbl.setAttribute("x", toSvgX(x));
      lbl.setAttribute("y", toSvgY(0) + 14);
      lbl.setAttribute("class", "axis-label");
      lbl.setAttribute("text-anchor", "middle");
      lbl.textContent = x;
      svg.appendChild(lbl);
    }
  }
  for (let y = yMin; y <= yMax; y++) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", PAD); line.setAttribute("x2", W - PAD);
    line.setAttribute("y1", toSvgY(y)); line.setAttribute("y2", toSvgY(y));
    line.setAttribute("class", y === 0 ? "axis-line" : "grid-line");
    svg.appendChild(line);
    // y-axis tick labels
    if (y !== 0) {
      const lbl = document.createElementNS("http://www.w3.org/2000/svg", "text");
      lbl.setAttribute("x", toSvgX(0) - 10);
      lbl.setAttribute("y", toSvgY(y) + 4);
      lbl.setAttribute("class", "axis-label");
      lbl.setAttribute("text-anchor", "end");
      lbl.textContent = y;
      svg.appendChild(lbl);
    }
  }

  // Axis arrow heads
  const arrowHead = (x1, y1, x2, y2) => {
    const arr = document.createElementNS("http://www.w3.org/2000/svg", "line");
    arr.setAttribute("x1", x1); arr.setAttribute("y1", y1);
    arr.setAttribute("x2", x2); arr.setAttribute("y2", y2);
    arr.setAttribute("stroke", "#9ca3af"); arr.setAttribute("stroke-width", "1.5");
    svg.appendChild(arr);
  };

  // For graph_line mode: draw the reference line
  if (mode === "graph_line" && question.graph.line) {
    const { slope, intercept } = question.graph.line;
    // Clamp to graph bounds
    const xL = xMin, xR = xMax;
    const yL = slope * xL + intercept;
    const yR = slope * xR + intercept;

    const linePath = document.createElementNS("http://www.w3.org/2000/svg", "line");
    linePath.setAttribute("x1", toSvgX(xL));
    linePath.setAttribute("y1", toSvgY(yL));
    linePath.setAttribute("x2", toSvgX(xR));
    linePath.setAttribute("y2", toSvgY(yR));
    linePath.setAttribute("class", "graph-drawn-line");
    svg.appendChild(linePath);
  }

  // Points
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

    // Label — position smartly to avoid overlap
    const lx = toSvgX(point.x);
    const ly = toSvgY(point.y);
    const labelOffsetX = lx > W - 60 ? -20 : 14;
    const labelOffsetY = ly < PAD + 20 ? 18 : -12;

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", lx + labelOffsetX);
    text.setAttribute("y", ly + labelOffsetY);
    text.setAttribute("class", "graph-point-label");
    text.textContent = `${point.label} (${point.x}, ${point.y})`;

    group.appendChild(circle);
    group.appendChild(text);

    if (!submitted) {
      group.style.cursor = "pointer";
      group.addEventListener("click", () => {
        answers[current] = point.id;
        saveState(); renderQuestion();
      });
    }
    svg.appendChild(group);
  });

  return svg;
}

// ── QUESTION DISPATCHER ───────────────────────────────────

function renderQuestionInput(question) {
  choicesDiv.innerHTML = "";

  // Render info_box if present (before choices)
  if (question.info_box && question.info_box.length > 0) {
    const box = renderInfoBox(question.info_box);
    choicesDiv.classList.add("has-info-box");
    choicesDiv.appendChild(box);
  }

  if (question.type === "multiple_choice" || question.type === "select_multiple") {
    const choicesContainer = document.createElement("div");
    choicesContainer.className = "choices";
    question.choices.forEach((choice, index) => choicesContainer.appendChild(renderChoiceButton(question, choice, index)));
    choicesDiv.appendChild(choicesContainer);
    return;
  }
  if (question.type === "numeric" || question.type === "short_response") {
    renderTextResponse(question);
    return;
  }
  if (question.type === "graph_point") {
    renderGraphQuestion(question);
    return;
  }
  if (question.type === "graph_line") {
    renderGraphLine(question);
    return;
  }
}

function typeset(...els) {
  if (window.MathJax && window.MathJax.typesetPromise) {
    els.forEach(el => { if (window.MathJax.typesetClear) window.MathJax.typesetClear([el]); });
    window.MathJax.typesetPromise(els).catch(() => {});
  }
}

function renderQuestion() {
  if (!questions.length) return;
  const question = questions[current];
  questionNumberBadge.textContent = current + 1;
  questionText.innerHTML = getQuestionPromptMarkup(current);
  choicesDiv.className = "";
  renderQuestionInput(question);
  typeset(questionText, choicesDiv);
  markToggle.classList.toggle("active", markedQuestions.has(current));
  markToggleLabel.textContent = markedQuestions.has(current) ? "Marked for Review" : "Mark for Review";
  renderGrid(); updateHeaderStats(); updateNavigationState();
}

function nextQuestion() {
  if (current < questions.length - 1) { current++; saveState(); renderQuestion(); }
}

function prevQuestion() {
  if (current > 0) { current--; saveState(); renderQuestion(); }
}

function toggleMarked() {
  if (submitted) return;
  if (markedQuestions.has(current)) { markedQuestions.delete(current); } else { markedQuestions.add(current); }
  saveState(); renderQuestion();
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
  } catch { selection.removeAllRanges(); }
}

// ── PAUSE ─────────────────────────────────────────────────

function togglePause() {
  if (submitted) return;
  paused = !paused;
  const pauseOverlay = document.getElementById("pauseOverlay");
  if (paused) {
    if (timerId) { clearInterval(timerId); timerId = null; }
    pauseOverlay.style.display = "flex";
    pauseButton.innerHTML = `<svg class="inline-icon pause-icon"><use href="#icon-chevron-right"></use></svg>Resume`;
  } else {
    pauseOverlay.style.display = "none";
    startTimer();
    pauseButton.innerHTML = `<svg class="inline-icon pause-icon"><use href="#icon-pause"></use></svg>Pause`;
  }
}

// ── MODALS ─────────────────────────────────────────────────

function openModal(id) {
  const modal = document.getElementById(id);
  const windowEl = modal.querySelector(".draggable-window");
  if (windowEl) { windowEl.style.left = ""; windowEl.style.top = ""; windowEl.style.transform = ""; }
  modal.style.display = "flex";
  typeset(modal);
}

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

function toggleSidebar(side) {
  const isLeft = side === "left";
  const sidebar = isLeft ? leftSidebar : rightSidebar;
  const variableName = isLeft ? "--left-sidebar-width" : "--right-sidebar-width";
  const expandedWidth = isLeft ? "248px" : "210px";
  const collapsedWidth = "56px";
  sidebar.classList.toggle("collapsed");
  examShell.style.setProperty(variableName, sidebar.classList.contains("collapsed") ? collapsedWidth : expandedWidth);
}

function updateTimer() {
  if (submitted || paused) return;
  if (time > 0) { time--; document.getElementById("time").textContent = formatTime(time); saveState(); return; }
  showSubmitModal(true);
}

function startTimer() {
  if (timerId) clearInterval(timerId);
  document.getElementById("time").textContent = formatTime(time);
  timerId = setInterval(updateTimer, 1000);
}

function showSubmitModal(autoSubmit = false) {
  if (timerId && autoSubmit) { clearInterval(timerId); timerId = null; }
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
  if (question.type === "multiple_choice") return answer === question.correct;
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
  if (question.type === "graph_point" || question.type === "graph_line") return answer === question.correct;
  return false;
}

function describeAnswer(index) {
  const question = questions[index];
  const answer = answers[index];
  if (!hasAnswer(index)) return "Unanswered";
  if (question.type === "multiple_choice") return `${String.fromCharCode(65 + answer)}. ${question.choices[answer]}`;
  if (question.type === "select_multiple") return answer.map((i) => `${String.fromCharCode(65 + i)}. ${question.choices[i]}`).join(", ");
  if (question.type === "graph_point" || question.type === "graph_line") return `Point ${answer}`;
  return String(answer);
}

function describeCorrectAnswer(index) {
  const question = questions[index];
  if (question.type === "multiple_choice") return `${String.fromCharCode(65 + question.correct)}. ${question.choices[question.correct]}`;
  if (question.type === "select_multiple") return question.correct.map((i) => `${String.fromCharCode(65 + i)}. ${question.choices[i]}`).join(", ");
  if (question.type === "graph_point" || question.type === "graph_line") return `Point ${question.correct}`;
  return question.acceptedAnswers.join(" or ");
}

function resetCalculator() {
  if (calculatorFrame) {
    calculatorFrame.src = "about:blank";
    setTimeout(() => { calculatorFrame.src = "https://www.desmos.com/scientific"; }, 50);
  }
}

function resetGraphingCalculator() {
  if (graphingCalculator) {
    try { graphingCalculator.destroy(); } catch (e) { /* ignore */ }
    graphingCalculator = null;
  }
  if (graphingContainer) {
    graphingContainer.innerHTML = "";
  }
}

function finalizeSubmission() {
  submitted = true;
  saveState();
  closeModal("submitModal");
  if (timerId) clearInterval(timerId);
  resetCalculator();
  resetGraphingCalculator();
  renderQuestion();
  renderResults();
  openModal("resultsModal");
}

function renderResults() {
  let correct = 0;
  resultsReview.innerHTML = "";
  questions.forEach((question, index) => {
    if (isCorrect(index)) correct++;
    const row = document.createElement("div");
    row.className = "review-row";
    row.innerHTML = `
      <div class="review-row-top">
        <strong>Question ${index + 1}</strong>
        <span class="${isCorrect(index) ? "review-good" : "review-bad"}">${isCorrect(index) ? "Correct" : "Check"}</span>
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
  current = 0; answers = {}; markedQuestions = new Set();
  eliminatedChoices = {}; stemMarkup = {}; time = DEFAULT_TIME;
  submitted = false; eliminateMode = false; highlightMode = false;
  paused = false; keypadsVisible = {};
  closeModal("resultsModal");
  localStorage.removeItem(STORAGE_KEY);
  resetCalculator();
  resetGraphingCalculator();
  pauseButton.innerHTML = `<svg class="inline-icon pause-icon"><use href="#icon-pause"></use></svg>Pause`;
  document.getElementById("pauseOverlay").style.display = "none";
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
}

function setupDraggableWindows() {
  document.querySelectorAll(".draggable-window").forEach((windowEl) => {
    const handle = windowEl.querySelector(".drag-handle");
    if (!handle) return;
    let dragging = false, offsetX = 0, offsetY = 0;
    handle.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      dragging = true;
      const rect = windowEl.getBoundingClientRect();
      offsetX = event.clientX - rect.left; offsetY = event.clientY - rect.top;
      windowEl.style.left = `${rect.left}px`; windowEl.style.top = `${rect.top}px`;
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
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    };
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
  });
}

async function loadQuestions() {
  try {
    const response = await fetch("./questions.json");
    if (!response.ok) throw new Error("Unable to load questions.json");
    questions = await response.json();
  } catch {
    const fallback = document.getElementById("questionsFallback");
    questions = JSON.parse(fallback.textContent);
  }
}

window.addEventListener("load", () => {
  if (calculatorFrame) {
    calculatorFrame.src = "https://www.desmos.com/scientific";
  }
});

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
pauseButton.addEventListener("click", togglePause);

window.nextQuestion = nextQuestion;
window.prevQuestion = prevQuestion;
window.toggleSidebar = toggleSidebar;
window.openModal = openModal;
window.closeModal = closeModal;
window.togglePause = togglePause;

async function init() {
  loadNotes();
  restoreState();
  await loadQuestions();
  setupDraggableWindows();
  if (current > questions.length - 1) current = 0;
  startTimer();
  if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
    await window.MathJax.startup.promise;
  } else {
    await new Promise(resolve => {
      const check = setInterval(() => {
        if (window.MathJax && window.MathJax.typesetPromise) {
          clearInterval(check);
          resolve();
        }
      }, 50);
      setTimeout(() => { clearInterval(check); resolve(); }, 4000);
    });
  }
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