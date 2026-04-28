const questions = [
  {
    text: "Which expression is equivalent to 3(2x − 5) + 4x?",
    choices: ["10x − 15", "10x − 5", "6x − 15", "6x − 5"],
    correct: 1
  },
  {
    text: "Solve: 2x + 3 = 7",
    choices: ["x = 2", "x = 3", "x = 1", "x = 5"],
    correct: 0
  }
];

let current = 0;
let answers = {};

function renderQuestion() {
  const q = questions[current];

  document.getElementById("questionTitle").innerText = `Question ${current + 1}`;
  document.getElementById("questionText").innerText = q.text;

  const choicesDiv = document.getElementById("choices");
  choicesDiv.innerHTML = "";

  q.choices.forEach((c, i) => {
    const div = document.createElement("div");
    div.className = "choice";

    if (answers[current] === i) {
      div.classList.add("selected");
    }

    div.innerText = `${String.fromCharCode(65 + i)}. ${c}`;

    div.onclick = () => {
      answers[current] = i;
      renderQuestion();
    };

    choicesDiv.appendChild(div);
  });

  renderGrid();
}

function renderGrid() {
  const grid = document.getElementById("questionGrid");
  grid.innerHTML = "";

  questions.forEach((_, i) => {
    const box = document.createElement("div");
    box.className = "q-box";

    if (i === current) box.classList.add("active");

    box.innerText = i + 1;

    box.onclick = () => {
      current = i;
      renderQuestion();
    };

    grid.appendChild(box);
  });
}

function nextQuestion() {
  if (current < questions.length - 1) {
    current++;
    renderQuestion();
  }
}

function prevQuestion() {
  if (current > 0) {
    current--;
    renderQuestion();
  }
}

function toggleSidebar(side) {
  document.getElementById(side + "Sidebar").classList.toggle("collapsed");
}

function openModal(id) {
  document.getElementById(id).style.display = "flex";
}

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

// Timer
let time = 5400;

setInterval(() => {
  if (time > 0) time--;

  const h = String(Math.floor(time / 3600)).padStart(2, "0");
  const m = String(Math.floor((time % 3600) / 60)).padStart(2, "0");
  const s = String(time % 60).padStart(2, "0");

  document.getElementById("time").innerText = `${h}:${m}:${s}`;
}, 1000);

// init
renderQuestion();