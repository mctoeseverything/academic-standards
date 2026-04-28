const questions = [
  {
    text: "Which expression is equivalent to 3(2x - 5) + 4x?",
    choices: ["10x - 15", "10x - 5", "6x - 15", "6x - 5"]
  },
  {
    text: "Solve for x: 2x + 3 = 7",
    choices: ["x = 2", "x = 3", "x = 1", "x = 5"]
  },
  {
    text: "Which expression is equivalent to 5(x + 2) - 3x?",
    choices: ["2x + 10", "8x + 2", "2x - 10", "5x - 6"]
  },
  {
    text: "Solve for y: 4y - 8 = 20",
    choices: ["y = 7", "y = 6", "y = 8", "y = 5"]
  },
  {
    text: "What is the slope of the line passing through (1, 3) and (5, 11)?",
    choices: ["1", "2", "3", "4"]
  },
  {
    text: "Which value of x makes x/3 + 4 = 9 true?",
    choices: ["9", "12", "15", "18"]
  },
  {
    text: "Simplify: 7a - 2a + 9",
    choices: ["5a + 9", "9a - 2", "5a - 9", "7a + 7"]
  },
  {
    text: "What is the solution to 3x = 24?",
    choices: ["6", "7", "8", "9"]
  },
  {
    text: "Which point lies on the line y = 2x + 1?",
    choices: ["(1, 1)", "(2, 5)", "(3, 5)", "(4, 7)"]
  },
  {
    text: "Factor: x^2 + 7x + 12",
    choices: ["(x + 3)(x + 4)", "(x + 2)(x + 6)", "(x - 3)(x - 4)", "(x + 1)(x + 12)"]
  },
  {
    text: "Solve: 5x - 9 = 16",
    choices: ["x = 5", "x = 6", "x = 7", "x = 8"]
  },
  {
    text: "Which inequality represents numbers greater than or equal to 12?",
    choices: ["x > 12", "x < 12", "x >= 12", "x <= 12"]
  },
  {
    text: "What is the value of 2^4?",
    choices: ["8", "12", "16", "24"]
  },
  {
    text: "Simplify: 6m + 3 - 2m",
    choices: ["4m + 3", "8m", "4m - 3", "6m + 1"]
  },
  {
    text: "Solve for x: 9 + x = 14",
    choices: ["3", "4", "5", "6"]
  },
  {
    text: "Which graph has a y-intercept of -2?",
    choices: ["y = x - 2", "y = x + 2", "y = 2x", "y = -2x + 2"]
  },
  {
    text: "Evaluate 3n - 1 when n = 4.",
    choices: ["9", "10", "11", "12"]
  },
  {
    text: "What is the solution to x - 7 = 15?",
    choices: ["18", "20", "21", "22"]
  },
  {
    text: "Simplify: 4(p + 6)",
    choices: ["4p + 6", "4p + 24", "p + 24", "8p + 6"]
  },
  {
    text: "Which expression is equivalent to 12 - 3(2 - x)?",
    choices: ["6 + 3x", "6 - 3x", "18 - 3x", "12 + 6x"]
  },
  {
    text: "Solve: 7x + 5 = 26",
    choices: ["x = 2", "x = 3", "x = 4", "x = 5"]
  },
  {
    text: "What is the domain of the relation {(1,2), (3,4), (5,6)}?",
    choices: ["{2,4,6}", "{1,3,5}", "{1,2,3}", "{4,5,6}"]
  },
  {
    text: "Simplify: 10 - (3 + x)",
    choices: ["7 + x", "13 - x", "7 - x", "10 - 3x"]
  },
  {
    text: "Which equation has the solution x = -4?",
    choices: ["x + 4 = 0", "x - 4 = 0", "4x = -1", "x/4 = 4"]
  },
  {
    text: "Solve for z: 2z + 11 = 19",
    choices: ["z = 3", "z = 4", "z = 5", "z = 6"]
  }
];

let current = 0;
const answers = {};
const markedQuestions = new Set();
let time = 5400;

const questionText = document.getElementById("questionText");
const choicesDiv = document.getElementById("choices");
const questionGrid = document.getElementById("questionGrid");
const questionNumberBadge = document.getElementById("questionNumberBadge");
const markToggle = document.getElementById("markToggle");
const markToggleLabel = markToggle.querySelector("span:last-child");
const markedCount = document.getElementById("markedCount");
const reviewMarkedButton = document.getElementById("reviewMarkedButton");
const reviewNextButton = document.getElementById("reviewNextButton");
const examShell = document.querySelector(".exam-shell");
const leftSidebar = document.getElementById("leftSidebar");
const rightSidebar = document.getElementById("rightSidebar");

function renderQuestion() {
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

    button.innerHTML = `
      <span class="choice-letter">${String.fromCharCode(65 + index)}</span>
      <span class="choice-text">${choice}</span>
    `;

    button.onclick = () => {
      answers[current] = index;
      renderQuestion();
    };

    choicesDiv.appendChild(button);
  });

  markToggle.classList.toggle("active", markedQuestions.has(current));
  markToggleLabel.textContent = markedQuestions.has(current) ? "Marked for Review" : "Mark for Review";

  renderGrid();
  updateMarkedCount();
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
    button.onclick = () => {
      current = index;
      renderQuestion();
    };
    questionGrid.appendChild(button);
  });
}

function updateMarkedCount() {
  markedCount.textContent = markedQuestions.size;
}

function nextQuestion() {
  if (current < questions.length - 1) {
    current += 1;
    renderQuestion();
  }
}

function prevQuestion() {
  if (current > 0) {
    current -= 1;
    renderQuestion();
  }
}

function toggleMarked() {
  if (markedQuestions.has(current)) {
    markedQuestions.delete(current);
  } else {
    markedQuestions.add(current);
  }

  renderQuestion();
}

function goToNextMarkedOrUnanswered() {
  const upcomingMarked = questions.findIndex((_, index) => index > current && markedQuestions.has(index));
  if (upcomingMarked !== -1) {
    current = upcomingMarked;
    renderQuestion();
    return;
  }

  const upcomingUnanswered = questions.findIndex((_, index) => index > current && !Object.hasOwn(answers, index));
  if (upcomingUnanswered !== -1) {
    current = upcomingUnanswered;
    renderQuestion();
    return;
  }

  nextQuestion();
}

function openModal(id) {
  document.getElementById(id).style.display = "flex";
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
  if (time > 0) {
    time -= 1;
  }

  const h = String(Math.floor(time / 3600)).padStart(2, "0");
  const m = String(Math.floor((time % 3600) / 60)).padStart(2, "0");
  const s = String(time % 60).padStart(2, "0");

  document.getElementById("time").textContent = `${h}:${m}:${s}`;
}

markToggle.addEventListener("click", toggleMarked);
reviewMarkedButton.addEventListener("click", () => {
  const firstMarked = [...markedQuestions].sort((a, b) => a - b)[0];
  if (firstMarked !== undefined) {
    current = firstMarked;
    renderQuestion();
  }
});
reviewNextButton.addEventListener("click", goToNextMarkedOrUnanswered);

setInterval(updateTimer, 1000);
renderQuestion();
