const STORAGE_KEY = "standards-institute-algebra-1-state-v3";
const NOTES_KEY   = "standards-institute-algebra-1-notes";
const DEFAULT_TIME = 5400;

let questions = [];
let current   = 0;
let answers   = {};
let markedQuestions    = new Set();
let eliminatedChoices  = {};
let stemMarkup         = {};
let dragOrder          = {};
let matchState         = {};
let hotspotState       = {};
let time      = DEFAULT_TIME;
let timerId   = null;
let submitted = false;
let eliminateMode  = false;
let highlightMode  = false;
let graphingCalculator = null;
let paused = false;

// ── DOM refs ──────────────────────────────────────────────
const questionText        = document.getElementById("questionText");
const choicesDiv          = document.getElementById("choices");
const questionGrid        = document.getElementById("questionGrid");
const questionNumberBadge = document.getElementById("questionNumberBadge");
const markToggle          = document.getElementById("markToggle");
const markToggleLabel     = markToggle.querySelector("span:last-child");
const answeredCount       = document.getElementById("answeredCount");
const totalQuestions      = document.getElementById("totalQuestions");
const markedCount         = document.getElementById("markedCount");
const prevButton          = document.getElementById("prevButton");
const nextButton          = document.getElementById("nextButton");
const submitButton        = document.getElementById("submitButton");
const eliminateModeButton = document.getElementById("eliminateModeButton");
const highlightModeButton = document.getElementById("highlightModeButton");
const calculatorButton    = document.getElementById("calculatorButton");
const graphingButton      = document.getElementById("graphingButton");
const notesButton         = document.getElementById("notesButton");
const notesField          = document.getElementById("notesField");
const graphingContainer   = document.getElementById("desmosGraphingCalculator");
const calculatorFrame     = document.getElementById("calculatorFrame");
const submitSummary       = document.getElementById("submitSummary");
const submitChecklist     = document.getElementById("submitChecklist");
const confirmSubmitButton = document.getElementById("confirmSubmitButton");
const restartButton       = document.getElementById("restartButton");
const resultsScore        = document.getElementById("resultsScore");
const resultsBreakdown    = document.getElementById("resultsBreakdown");
const resultsAnswered     = document.getElementById("resultsAnswered");
const resultsCorrect      = document.getElementById("resultsCorrect");
const resultsMarked       = document.getElementById("resultsMarked");
const resultsTime         = document.getElementById("resultsTime");
const resultsReview       = document.getElementById("resultsReview");
const pauseButton         = document.querySelector(".pause-button");
const qnavLabel           = document.getElementById("qnavLabel");

// ── UTILITIES ─────────────────────────────────────────────
function escapeHtml(t) {
  return String(t).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
}
function getQuestionPromptMarkup(i) { return stemMarkup[i] || questions[i].prompt; }

function normalizeNumeric(value) {
  const t = String(value).trim();
  if (!t) return "";
  if (t.includes("/")) {
    const [n,d] = t.split("/").map(Number);
    if (!isNaN(n) && !isNaN(d) && d !== 0) return String(n/d);
  }
  const n = Number(t);
  return isNaN(n) ? t.toLowerCase().replace(/\s+/g,"") : String(n);
}
function normalizeText(v) {
  return String(v).trim().toLowerCase()
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g,"($1)/($2)")
    .replace(/\\/g,"").replace(/\{|\}/g,"").replace(/\s+/g,"");
}

function hasAnswer(i) {
  const q = questions[i], a = answers[i];
  switch(q.type) {
    case "select_multiple": return Array.isArray(a) && a.length > 0;
    case "numeric":
    case "short_response":  return typeof a === "string" && a.trim().length > 0;
    case "fill_blank":      return a && typeof a === "object" && Object.values(a).some(v => v.trim().length > 0);
    case "ordering":        return Array.isArray(dragOrder[i]) && dragOrder[i].length === q.items.length;
    case "matching":        return matchState[i] && Object.values(matchState[i]).every(v => v !== null);
    case "graph_point":
    case "graph_line":      return typeof a === "string" && a.length > 0;
    case "hotspot":         return hotspotState[i] != null;
    default:                return Number.isInteger(a);
  }
}
function getAnsweredCount() { return questions.filter((_,i) => hasAnswer(i)).length; }
function formatTime(s) {
  return [Math.floor(s/3600), Math.floor((s%3600)/60), s%60].map(n=>String(n).padStart(2,"0")).join(":");
}

// ── PERSIST ───────────────────────────────────────────────
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    current, answers, markedQuestions:[...markedQuestions],
    eliminatedChoices, stemMarkup, dragOrder, matchState, hotspotState, time, submitted
  }));
}
function restoreState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const s = JSON.parse(raw);
    current          = Number.isInteger(s.current) ? s.current : 0;
    answers          = s.answers          || {};
    markedQuestions  = new Set(s.markedQuestions || []);
    eliminatedChoices= s.eliminatedChoices|| {};
    stemMarkup       = s.stemMarkup       || {};
    dragOrder        = s.dragOrder        || {};
    matchState       = s.matchState       || {};
    hotspotState     = s.hotspotState     || {};
    time             = typeof s.time === "number" ? s.time : DEFAULT_TIME;
    submitted        = Boolean(s.submitted);
  } catch { current=0; answers={}; markedQuestions=new Set(); time=DEFAULT_TIME; submitted=false; }
}
function loadNotes()  { notesField.value = localStorage.getItem(NOTES_KEY) || ""; }
function saveNotes()  { localStorage.setItem(NOTES_KEY, notesField.value); }

// ── HEADER STATS ──────────────────────────────────────────
function updateHeaderStats() {
  answeredCount.textContent  = getAnsweredCount();
  totalQuestions.textContent = questions.length;
  markedCount.textContent    = markedQuestions.size;
  if (qnavLabel) qnavLabel.textContent = `Question ${current + 1} of ${questions.length}`;
}
function updateNavigationState() {
  const supportsElim = ["multiple_choice","select_multiple"].includes(questions[current]?.type);
  if (!supportsElim) eliminateMode = false;
  prevButton.disabled = current === 0 || submitted;
  nextButton.disabled = current === questions.length-1 || submitted;
  submitButton.disabled = submitted;
  submitButton.hidden   = current !== questions.length-1 || submitted;
  markToggle.disabled   = submitted;
  eliminateModeButton.disabled = submitted || !supportsElim;
  highlightModeButton.disabled = submitted;
  eliminateModeButton.classList.toggle("mode-active", eliminateMode);
  highlightModeButton.classList.toggle("mode-active", highlightMode);
}

// ── QUESTION GRID ─────────────────────────────────────────
function renderGrid() {
  if (!questionGrid) return;
  questionGrid.innerHTML = "";
  questions.forEach((q, i) => {
    const btn = document.createElement("button");
    const state = i === current ? "current" : markedQuestions.has(i) ? "marked" : hasAnswer(i) ? "answered" : "";
    btn.className = `q-box${state ? " " + state : ""}`;
    btn.type = "button";
    btn.textContent = i + 1;
    btn.disabled = submitted;
    btn.title = `Q${i+1}: ${q.type.replace(/_/g," ")}`;
    btn.onclick = () => {
      current = i;
      saveState();
      renderQuestion();
      document.getElementById('qnavPopup')?.classList.remove('open');
    };
    questionGrid.appendChild(btn);
  });
}

// ── INFO BOX ──────────────────────────────────────────────
function renderInfoBox(lines) {
  const box = document.createElement("div");
  box.className = "info-box";
  lines.forEach(line => {
    const row = document.createElement("div");
    row.className = "info-box-row";
    row.innerHTML = line;
    box.appendChild(row);
  });
  return box;
}

// ── TYPE BADGE ────────────────────────────────────────────
const TYPE_LABELS = {
  multiple_choice: "Multiple Choice",
  select_multiple: "Select All That Apply",
  numeric:         "Numeric Entry",
  short_response:  "Short Response",
  fill_blank:      "Fill in the Blank",
  ordering:        "Drag to Order",
  matching:        "Matching",
  graph_point:     "Graph",
  graph_line:      "Graph",
  hotspot:         "Click on Graph"
};
function typeBadge(type) {
  const badge = document.createElement("span");
  badge.className = "question-type-badge";
  badge.textContent = TYPE_LABELS[type] || type;
  return badge;
}

// ── MULTIPLE CHOICE ───────────────────────────────────────
function getEliminatedChoices(i) { return Array.isArray(eliminatedChoices[i]) ? eliminatedChoices[i] : []; }
function toggleEliminated(qi, ci) {
  const s = new Set(getEliminatedChoices(qi));
  s.has(ci) ? s.delete(ci) : s.add(ci);
  eliminatedChoices[qi] = [...s];
}
function renderChoiceButton(q, choice, ci) {
  const btn = document.createElement("button");
  btn.className = "choice" + (q.type==="select_multiple" ? " choice-multi" : "");
  btn.type = "button";
  const elim = getEliminatedChoices(current).includes(ci);
  if (elim) btn.classList.add("eliminated");
  const isMulti = q.type === "select_multiple";
  const sel = isMulti ? (Array.isArray(answers[current]) && answers[current].includes(ci))
                      : answers[current] === ci;
  if (sel) btn.classList.add("selected");
  if (submitted) {
    btn.disabled = true;
    if (isMulti) {
      if (q.correct.includes(ci)) btn.classList.add("correct");
      if (sel && !q.correct.includes(ci)) btn.classList.add("incorrect");
    } else {
      if (ci === q.correct) btn.classList.add("correct");
      else if (answers[current] === ci) btn.classList.add("incorrect");
    }
  }

  // Letter circle (contains the alpha letter visually)
  const circle = document.createElement("span");
  circle.className = "choice-letter";
  circle.textContent = String.fromCharCode(65 + ci);

  const wrap = document.createElement("span");
  wrap.className = "choice-text-wrapper";
  const text = document.createElement("span");
  text.className = "choice-text";
  text.innerHTML = choice;
  wrap.appendChild(text);

  btn.append(circle, wrap);
  btn.onclick = () => {
    if (submitted) return;
    if (eliminateMode) { toggleEliminated(current,ci); saveState(); renderQuestion(); return; }
    if (isMulti) {
      const s = new Set(Array.isArray(answers[current]) ? answers[current] : []);
      s.has(ci) ? s.delete(ci) : s.add(ci);
      answers[current] = [...s].sort((a,b)=>a-b);
    } else { answers[current] = ci; }
    saveState(); renderQuestion();
  };
  return btn;
}
function renderMultipleChoice(q) {
  const wrap = document.createElement("div"); wrap.className = "choices";
  q.choices.forEach((c,i) => wrap.appendChild(renderChoiceButton(q,c,i)));
  choicesDiv.appendChild(wrap);
}

// ── NUMERIC / SHORT RESPONSE ──────────────────────────────
let keypadsVisible = {};
const mqFields = {};
const KEYPAD_DEF = [
  [{l:"x",i:"x"},{l:"y",i:"y"},{l:"(",i:"("},{l:")",i:")"},{l:"x²",i:"^{2}"},{l:"xⁿ",i:"^{"},{l:"√",i:"\\sqrt{"},{l:"=",i:"="}],
  [{l:"7",i:"7"},{l:"8",i:"8"},{l:"9",i:"9"},{l:"÷",i:"\\div"},{l:"≤",i:"\\le"},{l:"≥",i:"\\ge"},{l:"←",a:"left",c:"key-nav"},{l:"→",a:"right",c:"key-nav"}],
  [{l:"4",i:"4"},{l:"5",i:"5"},{l:"6",i:"6"},{l:"×",i:"\\times"},{l:"−",i:"-"},{l:"+",i:"+"},{l:"⌫",a:"backspace",c:"key-action"},{l:"✕",a:"clear",c:"key-action"}],
  [{l:"1",i:"1"},{l:"2",i:"2"},{l:"3",i:"3"},{l:"0",i:"0"},{l:".",i:"."},{l:"π",i:"\\pi"},{l:"a/b",i:"\\frac{",c:"key-wide"},{l:"±",i:"-"}]
];
function buildKeypad(mf) {
  const kp = document.createElement("div"); kp.className = "math-keypad";
  KEYPAD_DEF.forEach(row => {
    const r = document.createElement("div"); r.className = "keypad-row";
    row.forEach(k => {
      const b = document.createElement("button"); b.type="button";
      b.className = "keypad-key"+(k.c?" "+k.c:""); b.textContent=k.l;
      b.addEventListener("mousedown",e=>{ e.preventDefault(); if(!mf)return;
        if(k.a==="backspace") mf.keystroke("Backspace");
        else if(k.a==="clear"){ mf.select(); mf.keystroke("Backspace"); }
        else if(k.a==="left")  mf.keystroke("Left");
        else if(k.a==="right") mf.keystroke("Right");
        else if(k.i) mf.write(k.i);
        mf.focus();
      }); r.appendChild(b);
    }); kp.appendChild(r);
  }); return kp;
}
function renderTextResponse(q) {
  const qi = current;
  const value = typeof answers[qi]==="string" ? answers[qi] : "";
  const wrapper = document.createElement("div"); wrapper.className="math-response-card";
  const row = document.createElement("div"); row.className="math-input-row";
  const lbl = document.createElement("span"); lbl.className="math-input-label"; lbl.textContent="Answer:";
  const mqSpan = document.createElement("span"); mqSpan.className="mq-field-wrap"+(submitted?" mq-disabled":"");
  const kbtn = document.createElement("button"); kbtn.type="button"; kbtn.className="keypad-toggle-btn"; kbtn.title="Toggle keypad";
  kbtn.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M7 8h2M11 8h2M15 8h2M7 12h2M11 12h2M15 12h2M7 16h10"/></svg>`;
  row.append(lbl, mqSpan); if(!submitted) row.append(kbtn);
  wrapper.appendChild(row);
  const kpWrap = document.createElement("div"); kpWrap.className="keypad-wrap";
  kpWrap.style.display = keypadsVisible[qi]?"block":"none";
  wrapper.appendChild(kpWrap);
  if (submitted) {
    const fb = document.createElement("div");
    fb.className = isCorrect(qi)?"response-feedback review-good":"response-feedback review-bad";
    fb.textContent = isCorrect(qi)?"Accepted":"Incorrect";
    wrapper.appendChild(fb);
  }
  choicesDiv.appendChild(wrapper);
  if (window.MathQuill) {
    const MQ = window.MathQuill.getInterface(2);
    const cfg = { spaceBehavesLikeTab:false, leftRightIntoCmdGoes:"up", restrictMismatchedBrackets:false,
      handlers:{ edit(f){ answers[qi]=f.latex(); saveState(); updateHeaderStats(); renderGrid(); } }
    };
    if (submitted) { const mf=MQ.StaticMath(mqSpan); mf.latex(value); }
    else {
      const mf=MQ.MathField(mqSpan,cfg); if(value) mf.latex(value); mqFields[qi]=mf;
      const kp=buildKeypad(mf); kpWrap.appendChild(kp);
      kbtn.addEventListener("click",()=>{
        const v=kpWrap.style.display!=="none";
        kpWrap.style.display=v?"none":"block"; keypadsVisible[qi]=!v;
        kbtn.classList.toggle("keypad-toggle-active",!v); if(!v) mf.focus();
      });
      if(keypadsVisible[qi]) kbtn.classList.add("keypad-toggle-active");
      setTimeout(()=>mf.focus(),0);
    }
  } else {
    const inp=document.createElement("input"); inp.className="response-input"; inp.type="text";
    inp.placeholder=q.placeholder||"Enter answer"; inp.value=value; inp.disabled=submitted;
    inp.addEventListener("input",e=>{ answers[qi]=e.target.value; saveState(); updateHeaderStats(); renderGrid(); });
    mqSpan.replaceWith(inp);
  }
}

// ── FILL IN THE BLANK ─────────────────────────────────────
function renderFillBlank(q) {
  const qi = current;
  if (!answers[qi] || typeof answers[qi] !== "object") answers[qi] = {};
  const card = document.createElement("div"); card.className = "fill-blank-card";
  const tpl = q.template;
  const parts = tpl.split(/\[([^\]]+)\]/g);
  const templateRow = document.createElement("div"); templateRow.className = "fill-blank-template";
  q.blanks.forEach(b => { if (!answers[qi][b.id]) answers[qi][b.id] = ""; });
  parts.forEach((part, pi) => {
    if (pi % 2 === 0) {
      if (part) { const s = document.createElement("span"); s.className="fill-blank-text"; s.innerHTML=part; templateRow.appendChild(s); }
    } else {
      const blankDef = q.blanks.find(b => b.label === part || b.id === part);
      const inp = document.createElement("input");
      inp.type = "text"; inp.className = "fill-blank-input";
      inp.placeholder = blankDef ? blankDef.label : part;
      inp.value = blankDef ? (answers[qi][blankDef.id]||"") : "";
      inp.disabled = submitted;
      if (submitted && blankDef) {
        const correct = blankDef.acceptedAnswers.some(a => normalizeNumeric(answers[qi][blankDef.id]) === normalizeNumeric(a) || normalizeText(answers[qi][blankDef.id]) === normalizeText(a));
        inp.classList.add(correct ? "fill-input-correct" : "fill-input-incorrect");
      }
      if (blankDef) {
        inp.addEventListener("input", e => { answers[qi][blankDef.id] = e.target.value; saveState(); updateHeaderStats(); renderGrid(); });
      }
      templateRow.appendChild(inp);
    }
  });
  card.appendChild(templateRow);
  choicesDiv.appendChild(card);
}

// ── ORDERING ──────────────────────────────────────────────
function renderOrdering(q) {
  const qi = current;
  if (!Array.isArray(dragOrder[qi]) || dragOrder[qi].length !== q.items.length) {
    dragOrder[qi] = q.items.map((_,i)=>i);
  }
  const card = document.createElement("div"); card.className = "ordering-card";
  const hint = document.createElement("p"); hint.className = "ordering-hint";
  hint.textContent = submitted ? "" : "Drag items into the correct order ↕";
  card.appendChild(hint);
  const list = document.createElement("div"); list.className = "ordering-list";
  let dragSrc = null;
  const renderItems = () => {
    list.innerHTML = "";
    dragOrder[qi].forEach((origIdx, pos) => {
      const item = document.createElement("div");
      item.className = "ordering-item";
      item.draggable = !submitted;
      item.dataset.pos = pos;
      if (submitted) {
        item.classList.add(q.correct[pos] === origIdx ? "ordering-correct" : "ordering-incorrect");
      }
      const handle = document.createElement("span"); handle.className = "ordering-handle";
      handle.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><circle cx="9" cy="5" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="5" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="19" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="19" r="1" fill="currentColor" stroke="none"/></svg>`;
      const num = document.createElement("span"); num.className = "ordering-num"; num.textContent = pos+1;
      const text = document.createElement("span"); text.className = "ordering-text"; text.innerHTML = q.items[origIdx];
      item.append(handle, num, text);
      if (!submitted) {
        item.addEventListener("dragstart", e => { dragSrc = pos; item.classList.add("dragging"); e.dataTransfer.effectAllowed="move"; });
        item.addEventListener("dragend",   () => { item.classList.remove("dragging"); dragSrc=null; });
        item.addEventListener("dragover",  e => { e.preventDefault(); e.dataTransfer.dropEffect="move"; item.classList.add("drag-over"); });
        item.addEventListener("dragleave", () => item.classList.remove("drag-over"));
        item.addEventListener("drop", e => {
          e.preventDefault(); item.classList.remove("drag-over");
          if (dragSrc === null || dragSrc === pos) return;
          const arr = [...dragOrder[qi]];
          const [moved] = arr.splice(dragSrc, 1);
          arr.splice(pos, 0, moved);
          dragOrder[qi] = arr;
          saveState(); renderItems(); typeset(list);
        });
      }
      list.appendChild(item);
    });
  };
  renderItems();
  card.appendChild(list);
  choicesDiv.appendChild(card);
}

// ── MATCHING ──────────────────────────────────────────────
function renderMatching(q) {
  const qi = current;
  if (!matchState[qi]) {
    matchState[qi] = {};
    q.pairs.forEach((_, i) => { matchState[qi][i] = null; });
  }
  const n = q.pairs.length;
  const rightDisplayOrder = q.pairs.map((_, i) => i).sort((a, b) => {
    const ha = (a * 7 + qi * 13 + 3) % n;
    const hb = (b * 7 + qi * 13 + 3) % n;
    return ha - hb;
  });
  if (n > 1 && rightDisplayOrder.every((v, i) => v === i)) rightDisplayOrder.reverse();
  let selectedLeft = null;
  const card = document.createElement("div"); card.className = "matching-card";
  const hint = document.createElement("p"); hint.className = "matching-hint";
  hint.textContent = submitted ? "" : "Click a left item to select it, then click the right item it matches.";
  card.appendChild(hint);
  const wrap = document.createElement("div"); wrap.className = "matching-wrap";
  const leftCol  = document.createElement("div"); leftCol.className  = "matching-col matching-col-left";
  const rightCol = document.createElement("div"); rightCol.className = "matching-col matching-col-right";
  const rebuild = () => {
    leftCol.innerHTML = ""; rightCol.innerHTML = "";
    const r2l = {};
    Object.entries(matchState[qi]).forEach(([li, ri]) => { if (ri !== null) r2l[ri] = Number(li); });
    q.pairs.forEach((pair, li) => {
      const cell = document.createElement("div"); cell.className = "match-cell";
      const btn = document.createElement("button"); btn.type = "button"; btn.className = "match-btn match-left";
      const inner = document.createElement("span"); inner.className = "match-btn-inner"; inner.innerHTML = pair.left;
      btn.appendChild(inner);
      const ri = matchState[qi][li];
      if (ri !== null) btn.classList.add("match-selected");
      if (selectedLeft === li) btn.classList.add("match-active");
      if (submitted) {
        btn.disabled = true;
        btn.classList.add(ri === q.correct[li] ? "match-correct" : "match-incorrect");
        if (ri !== null) { const tag = document.createElement("span"); tag.className = "match-paired-label"; tag.innerHTML = " → " + q.pairs[ri].right; btn.appendChild(tag); }
      } else {
        btn.onclick = () => { selectedLeft = (selectedLeft === li) ? null : li; rebuild(); typeset(leftCol, rightCol); };
      }
      cell.appendChild(btn); leftCol.appendChild(cell);
    });
    rightDisplayOrder.forEach(ri => {
      const cell = document.createElement("div"); cell.className = "match-cell";
      const btn = document.createElement("button"); btn.type = "button"; btn.className = "match-btn match-right";
      const inner = document.createElement("span"); inner.className = "match-btn-inner"; inner.innerHTML = q.pairs[ri].right;
      btn.appendChild(inner);
      const assignedLi = r2l[ri];
      if (assignedLi !== undefined) btn.classList.add("match-selected");
      if (submitted) {
        btn.disabled = true;
        const correctLi = q.correct.findIndex((correctRi, li) => correctRi === ri);
        btn.classList.add(assignedLi === correctLi ? "match-correct" : "match-incorrect");
      } else {
        btn.onclick = () => {
          if (selectedLeft === null) return;
          if (matchState[qi][selectedLeft] === ri) { matchState[qi][selectedLeft] = null; }
          else {
            Object.keys(matchState[qi]).forEach(k => { if (matchState[qi][k] === ri) matchState[qi][k] = null; });
            matchState[qi][selectedLeft] = ri;
          }
          selectedLeft = null; saveState(); updateHeaderStats(); renderGrid(); rebuild(); typeset(leftCol, rightCol);
        };
      }
      cell.appendChild(btn); rightCol.appendChild(cell);
    });
  };
  rebuild();
  wrap.append(leftCol, rightCol);
  card.appendChild(wrap);
  choicesDiv.appendChild(card);
}

// ── SVG GRAPH HELPER ──────────────────────────────────────
function buildGraphSVG(q, mode) {
  const W=420, H=320, PAD=40;
  const svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
  svg.setAttribute("class","graph-plane");
  const { xMin,xMax,yMin,yMax } = q.graph;
  const toX = x => PAD + (x-xMin)/(xMax-xMin)*(W-PAD*2);
  const toY = y => H-PAD - (y-yMin)/(yMax-yMin)*(H-PAD*2);
  for(let x=xMin;x<=xMax;x++){
    const l=document.createElementNS("http://www.w3.org/2000/svg","line");
    l.setAttribute("x1",toX(x));l.setAttribute("x2",toX(x));l.setAttribute("y1",PAD);l.setAttribute("y2",H-PAD);
    l.setAttribute("class",x===0?"axis-line":"grid-line"); svg.appendChild(l);
    if(x!==0){const t=document.createElementNS("http://www.w3.org/2000/svg","text");t.setAttribute("x",toX(x));t.setAttribute("y",toY(0)+14);t.setAttribute("class","axis-label");t.setAttribute("text-anchor","middle");t.textContent=x;svg.appendChild(t);}
  }
  for(let y=yMin;y<=yMax;y++){
    const l=document.createElementNS("http://www.w3.org/2000/svg","line");
    l.setAttribute("x1",PAD);l.setAttribute("x2",W-PAD);l.setAttribute("y1",toY(y));l.setAttribute("y2",toY(y));
    l.setAttribute("class",y===0?"axis-line":"grid-line"); svg.appendChild(l);
    if(y!==0){const t=document.createElementNS("http://www.w3.org/2000/svg","text");t.setAttribute("x",toX(0)-8);t.setAttribute("y",toY(y)+4);t.setAttribute("class","axis-label");t.setAttribute("text-anchor","end");t.textContent=y;svg.appendChild(t);}
  }
  if (q.graph.line) {
    const {slope:m, intercept:b} = q.graph.line;
    const x0=xMin, x1=xMax, y0=m*x0+b, y1=m*x1+b;
    const ln=document.createElementNS("http://www.w3.org/2000/svg","line");
    ln.setAttribute("x1",toX(x0));ln.setAttribute("y1",toY(y0));ln.setAttribute("x2",toX(x1));ln.setAttribute("y2",toY(y1));
    ln.setAttribute("class","graph-drawn-line"); svg.appendChild(ln);
  }
  if (q.graph.parabola) {
    const {a,h,k} = q.graph.parabola;
    const pts=[]; const step=(xMax-xMin)/80;
    for(let x=xMin;x<=xMax;x+=step){ const y=a*(x-h)**2+k; if(y>=yMin&&y<=yMax) pts.push(`${toX(x)},${toY(y)}`); }
    if(pts.length>1){const poly=document.createElementNS("http://www.w3.org/2000/svg","polyline");poly.setAttribute("points",pts.join(" "));poly.setAttribute("class","graph-drawn-line");poly.setAttribute("fill","none");svg.appendChild(poly);}
  }
  if (q.graph.shading) {
    const pts = q.graph.shading.vertices.map(([x,y])=>`${toX(x)},${toY(y)}`).join(" ");
    const poly=document.createElementNS("http://www.w3.org/2000/svg","polygon");
    poly.setAttribute("points",pts); poly.setAttribute("class","graph-shading"); svg.appendChild(poly);
  }
  return { svg, toX, toY };
}

// ── GRAPH POINT ───────────────────────────────────────────
function renderGraphQuestion(q) {
  const {svg,toX,toY} = buildGraphSVG(q,"graph_point");
  q.graph.points.forEach(pt => {
    const g=document.createElementNS("http://www.w3.org/2000/svg","g"); g.setAttribute("class","graph-point-group");
    const sel = answers[current]===pt.id;
    const isCorr = submitted && pt.id===q.correct;
    const isWrong= submitted && sel && pt.id!==q.correct;
    const c=document.createElementNS("http://www.w3.org/2000/svg","circle");
    c.setAttribute("cx",toX(pt.x));c.setAttribute("cy",toY(pt.y));c.setAttribute("r",9);
    c.setAttribute("class",`graph-point${sel?" selected":""}${isCorr?" correct":""}${isWrong?" incorrect":""}`);
    const lx=toX(pt.x), ly=toY(pt.y);
    const t=document.createElementNS("http://www.w3.org/2000/svg","text");
    t.setAttribute("x",lx+(lx>370?-20:14));t.setAttribute("y",ly+(ly<50?18:-12));
    t.setAttribute("class","graph-point-label");t.textContent=`${pt.label} (${pt.x},${pt.y})`;
    g.append(c,t);
    if(!submitted){g.style.cursor="pointer";g.addEventListener("click",()=>{answers[current]=pt.id;saveState();renderQuestion();});}
    svg.appendChild(g);
  });
  const wrap=document.createElement("div");wrap.className="graph-card";wrap.appendChild(svg);
  choicesDiv.appendChild(wrap);
}

// ── GRAPH LINE ────────────────────────────────────────────
function renderGraphLine(q) {
  const {svg,toX,toY} = buildGraphSVG(q,"graph_line");
  q.graph.points.forEach(pt => {
    const g=document.createElementNS("http://www.w3.org/2000/svg","g");g.setAttribute("class","graph-point-group");
    const sel=answers[current]===pt.id;
    const isCorr=submitted&&pt.id===q.correct;
    const isWrong=submitted&&sel&&pt.id!==q.correct;
    const c=document.createElementNS("http://www.w3.org/2000/svg","circle");
    c.setAttribute("cx",toX(pt.x));c.setAttribute("cy",toY(pt.y));c.setAttribute("r",9);
    c.setAttribute("class",`graph-point${sel?" selected":""}${isCorr?" correct":""}${isWrong?" incorrect":""}`);
    const lx=toX(pt.x),ly=toY(pt.y);
    const t=document.createElementNS("http://www.w3.org/2000/svg","text");
    t.setAttribute("x",lx+(lx>370?-20:14));t.setAttribute("y",ly+(ly<50?18:-12));
    t.setAttribute("class","graph-point-label");t.textContent=`${pt.label} (${pt.x},${pt.y})`;
    g.append(c,t);
    if(!submitted){g.style.cursor="pointer";g.addEventListener("click",()=>{answers[current]=pt.id;saveState();renderQuestion();});}
    svg.appendChild(g);
  });
  const wrap=document.createElement("div");wrap.className="graph-card";wrap.appendChild(svg);
  choicesDiv.appendChild(wrap);
}

// ── HOTSPOT ───────────────────────────────────────────────
function renderHotspot(q) {
  const qi = current;
  const {svg, toX, toY} = buildGraphSVG(q, "hotspot");
  const { xMin,xMax,yMin,yMax } = q.graph;
  const W=420,H=320,PAD=40;
  const fromSvgX = sx => xMin + (sx-PAD)/(W-PAD*2)*(xMax-xMin);
  const fromSvgY = sy => yMin + (H-PAD-sy)/(H-PAD*2)*(yMax-yMin);
  const snap = q.graph.snapGrid || 1;
  const doSnap = v => Math.round(v/snap)*snap;
  if (hotspotState[qi]) {
    const {x,y} = hotspotState[qi];
    const cx = toX(x), cy = toY(y);
    const circle = document.createElementNS("http://www.w3.org/2000/svg","circle");
    circle.setAttribute("cx",cx);circle.setAttribute("cy",cy);circle.setAttribute("r",10);
    const isCorr = submitted && isCorrect(qi);
    circle.setAttribute("class",`graph-point selected${submitted?(isCorr?" correct":" incorrect"):""}`);
    svg.appendChild(circle);
    const lbl=document.createElementNS("http://www.w3.org/2000/svg","text");
    lbl.setAttribute("x",cx+14);lbl.setAttribute("y",cy-12);lbl.setAttribute("class","graph-point-label");
    lbl.textContent=`(${x}, ${y})`; svg.appendChild(lbl);
  }
  if (!submitted) {
    const ghost = document.createElementNS("http://www.w3.org/2000/svg","circle");
    ghost.setAttribute("r",8); ghost.setAttribute("class","hotspot-ghost"); ghost.style.display="none";
    svg.appendChild(ghost);
    const rect = document.createElementNS("http://www.w3.org/2000/svg","rect");
    rect.setAttribute("x",PAD);rect.setAttribute("y",PAD);
    rect.setAttribute("width",W-PAD*2);rect.setAttribute("height",H-PAD*2);
    rect.setAttribute("fill","transparent");rect.style.cursor="crosshair";
    svg.appendChild(rect);
    rect.addEventListener("mousemove", e => {
      const bbox = svg.getBoundingClientRect();
      const scaleX = W/bbox.width, scaleY = H/bbox.height;
      const rx = (e.clientX-bbox.left)*scaleX, ry = (e.clientY-bbox.top)*scaleY;
      const wx = doSnap(fromSvgX(rx)), wy = doSnap(fromSvgY(ry));
      ghost.setAttribute("cx", toX(wx)); ghost.setAttribute("cy", toY(wy)); ghost.style.display="";
    });
    rect.addEventListener("mouseleave", () => { ghost.style.display="none"; });
    rect.addEventListener("click", e => {
      const bbox = svg.getBoundingClientRect();
      const scaleX = W/bbox.width, scaleY = H/bbox.height;
      const rx = (e.clientX-bbox.left)*scaleX, ry = (e.clientY-bbox.top)*scaleY;
      const wx = doSnap(fromSvgX(rx)), wy = doSnap(fromSvgY(ry));
      hotspotState[qi] = {x:wx, y:wy};
      saveState(); renderQuestion();
    });
  }
  const wrap=document.createElement("div");wrap.className="graph-card";wrap.appendChild(svg);
  if (!submitted && hotspotState[qi]) {
    const clr=document.createElement("button");clr.type="button";clr.className="secondary-button hotspot-clear-btn";
    clr.textContent="Clear selection";
    clr.onclick=()=>{ hotspotState[qi]=null; saveState(); renderQuestion(); };
    wrap.appendChild(clr);
  }
  choicesDiv.appendChild(wrap);
}

// ── QUESTION DISPATCHER ───────────────────────────────────
function renderQuestionInput(q) {
  choicesDiv.innerHTML="";
  if (q.info_box?.length) choicesDiv.appendChild(renderInfoBox(q.info_box));
  switch(q.type) {
    case "multiple_choice":
    case "select_multiple":  renderMultipleChoice(q); break;
    case "numeric":
    case "short_response":   renderTextResponse(q); break;
    case "fill_blank":       renderFillBlank(q); break;
    case "ordering":         renderOrdering(q); break;
    case "matching":         renderMatching(q); break;
    case "graph_point":      renderGraphQuestion(q); break;
    case "graph_line":       renderGraphLine(q); break;
    case "hotspot":          renderHotspot(q); break;
  }
}

// ── TYPESET ───────────────────────────────────────────────
function typeset(...els) {
  if (window.MathJax?.typesetPromise) {
    els.forEach(el=>{ if(MathJax.typesetClear) MathJax.typesetClear([el]); });
    MathJax.typesetPromise(els).catch(()=>{});
  }
}

// ── RENDER QUESTION ───────────────────────────────────────
function renderQuestion() {
  if (!questions.length) return;
  const q = questions[current];
  questionNumberBadge.textContent = current+1;
  questionText.innerHTML = getQuestionPromptMarkup(current);

  const metaLeft = document.querySelector(".question-meta-left");
  const existingBadge = metaLeft.querySelector(".question-type-badge");
  if (existingBadge) existingBadge.remove();
  metaLeft.appendChild(typeBadge(q.type));

  const eyebrow = document.getElementById("sectionEyebrow");
  if (eyebrow && q.sectionTitle) eyebrow.textContent = `§${q.section} · ${q.sectionTitle}`;

  renderQuestionInput(q);
  typeset(questionText, choicesDiv);
  markToggle.classList.toggle("active", markedQuestions.has(current));
  markToggleLabel.textContent = markedQuestions.has(current) ? "Marked" : "Mark for Review";
  renderGrid(); updateHeaderStats(); updateNavigationState();
}

function nextQuestion() { if(current<questions.length-1){current++;saveState();renderQuestion();} }
function prevQuestion() { if(current>0){current--;saveState();renderQuestion();} }
function toggleMarked() { if(submitted)return; markedQuestions.has(current)?markedQuestions.delete(current):markedQuestions.add(current); saveState();renderQuestion(); }
function toggleEliminateMode() { if(submitted)return; eliminateMode=!eliminateMode; if(eliminateMode)highlightMode=false; updateNavigationState(); }
function toggleHighlightMode() { if(submitted)return; highlightMode=!highlightMode; if(highlightMode)eliminateMode=false; updateNavigationState(); }
function applyHighlightFromSelection() {
  if(!highlightMode||submitted)return;
  const sel=window.getSelection(); if(!sel||sel.rangeCount===0||sel.isCollapsed)return;
  const range=sel.getRangeAt(0); if(!questionText.contains(range.commonAncestorContainer))return;
  const span=document.createElement("span");span.className="highlighted-text";
  try{const frag=range.extractContents();span.appendChild(frag);range.insertNode(span);sel.removeAllRanges();stemMarkup[current]=questionText.innerHTML;saveState();}catch{sel.removeAllRanges();}
}

// ── PAUSE ─────────────────────────────────────────────────
function togglePause() {
  if(submitted)return; paused=!paused;
  const overlay=document.getElementById("pauseOverlay");
  if(paused){
    if(timerId){clearInterval(timerId);timerId=null;}
    overlay.style.display="flex";
  } else {
    overlay.style.display="none"; startTimer();
  }
}

// ── MODALS ────────────────────────────────────────────────
function openModal(id){
  const m=document.getElementById(id);
  const w=m.querySelector(".draggable-window");
  if(w){w.style.left="";w.style.top="";w.style.transform="";}
  m.style.display="flex"; typeset(m);
}
function closeModal(id){ document.getElementById(id).style.display="none"; }

// ── TIMER ─────────────────────────────────────────────────
function updateTimer() {
  if(submitted||paused)return;
  if(time>0){time--;document.getElementById("time").textContent=formatTime(time);saveState();}
  else showSubmitModal(true);
}
function startTimer() {
  if(timerId)clearInterval(timerId);
  document.getElementById("time").textContent=formatTime(time);
  timerId=setInterval(updateTimer,1000);
}

// ── SUBMIT ────────────────────────────────────────────────
function showSubmitModal(auto=false) {
  if(timerId&&auto){clearInterval(timerId);timerId=null;}
  const unanswered=questions.length-getAnsweredCount();
  submitSummary.textContent=auto?"Time has expired. Submit your exam.":"Review your progress before submitting.";
  submitChecklist.innerHTML=`
    <div class="submit-line"><span>Answered</span><strong>${getAnsweredCount()} of ${questions.length}</strong></div>
    <div class="submit-line"><span>Unanswered</span><strong>${unanswered}</strong></div>
    <div class="submit-line"><span>Marked for review</span><strong>${markedQuestions.size}</strong></div>
    <div class="submit-line"><span>Time remaining</span><strong>${formatTime(time)}</strong></div>`;
  openModal("submitModal");
}

// ── SCORING ───────────────────────────────────────────────
function isCorrect(i) {
  const q=questions[i]; if(!hasAnswer(i))return false;
  switch(q.type){
    case "multiple_choice": return answers[i]===q.correct;
    case "select_multiple": {
      const ac=[...(answers[i]||[])].sort((a,b)=>a-b);
      const ec=[...q.correct].sort((a,b)=>a-b);
      return JSON.stringify(ac)===JSON.stringify(ec);
    }
    case "numeric": return q.acceptedAnswers.some(a=>normalizeNumeric(a)===normalizeNumeric(answers[i]));
    case "short_response": return q.acceptedAnswers.some(a=>normalizeText(a)===normalizeText(answers[i]));
    case "fill_blank": return q.blanks.every(b=> b.acceptedAnswers.some(a=> normalizeNumeric(a)===normalizeNumeric((answers[i]||{})[b.id]||"") || normalizeText(a)===normalizeText((answers[i]||{})[b.id]||"")));
    case "ordering": return Array.isArray(dragOrder[i]) && dragOrder[i].every((v,j)=>q.correct[j]===v);
    case "matching": return q.pairs.every((_,li)=>matchState[i]&&matchState[i][li]===q.correct[li]);
    case "graph_point":
    case "graph_line": return answers[i]===q.correct;
    case "hotspot": {
      const s=hotspotState[i]; if(!s)return false;
      if(q.graph.checkFn==="feasible_region"){
        return s.y>=(0.5*s.x+1) && s.y<=(-s.x+7) && s.x>=0 && !(s.y===(0.5*s.x+1)||s.y===(-s.x+7)||s.x===0);
      }
      const dx=s.x-q.graph.correctX, dy=s.y-q.graph.correctY;
      return Math.sqrt(dx*dx+dy*dy)<=q.graph.tolerance;
    }
    default: return false;
  }
}
function describeAnswer(i){
  const q=questions[i]; if(!hasAnswer(i))return"Unanswered";
  switch(q.type){
    case "multiple_choice": return `${String.fromCharCode(65+answers[i])}. ${q.choices[answers[i]]}`;
    case "select_multiple": return (answers[i]||[]).map(j=>`${String.fromCharCode(65+j)}. ${q.choices[j]}`).join(", ");
    case "ordering":        return (dragOrder[i]||[]).map((oi,pos)=>`${pos+1}. ${q.items[oi].replace(/<[^>]+>/g,"")}`).join(" → ");
    case "matching":        return q.pairs.map((_,li)=>{ const ri=matchState[i]?.[li]; return ri!=null?`${q.pairs[li].left.replace(/<[^>]+>/g,"")} → ${q.pairs[ri].right.replace(/<[^>]+>/g,"")}`:"-"; }).join(", ");
    case "fill_blank":      return q.blanks.map(b=>`${b.label}: ${(answers[i]||{})[b.id]||"—"}`).join(", ");
    case "hotspot":         return hotspotState[i]?`(${hotspotState[i].x}, ${hotspotState[i].y})`:"No point placed";
    case "graph_point":
    case "graph_line":      return `Point ${answers[i]}`;
    default:                return String(answers[i]);
  }
}
function describeCorrect(i){
  const q=questions[i];
  switch(q.type){
    case "multiple_choice": return `${String.fromCharCode(65+q.correct)}. ${q.choices[q.correct]}`;
    case "select_multiple": return q.correct.map(j=>`${String.fromCharCode(65+j)}. ${q.choices[j]}`).join(", ");
    case "ordering":        return q.correct.map((oi,pos)=>`${pos+1}. ${q.items[oi].replace(/<[^>]+>/g,"")}`).join(" → ");
    case "matching":        return q.pairs.map((_,li)=>`${q.pairs[li].left.replace(/<[^>]+>/g,"")} → ${q.pairs[q.correct[li]].right.replace(/<[^>]+>/g,"")}`).join(", ");
    case "fill_blank":      return q.blanks.map(b=>`${b.label}: ${b.acceptedAnswers[0]}`).join(", ");
    case "hotspot":         return `Near (${q.graph.correctX}, ${q.graph.correctY})`;
    case "graph_point":
    case "graph_line":      return `Point ${q.correct}`;
    default:                return q.acceptedAnswers?.join(" or ")||"—";
  }
}

// ── RESULTS ───────────────────────────────────────────────
function finalizeSubmission(){
  submitted=true; saveState(); closeModal("submitModal");
  if(timerId)clearInterval(timerId);
  resetCalculator(); resetGraphingCalculator();
  renderQuestion(); renderResults(); openModal("resultsModal");
}
function renderResults(){
  let correct=0; resultsReview.innerHTML="";
  questions.forEach((q,i)=>{
    if(isCorrect(i))correct++;
    const row=document.createElement("div");row.className="review-row";
    row.innerHTML=`
      <div class="review-row-top"><strong>Q${i+1} · ${q.sectionTitle||""}</strong>
        <span class="${isCorrect(i)?"review-good":"review-bad"}">${isCorrect(i)?"Correct":"Incorrect"}</span></div>
      <p>${escapeHtml(q.prompt)}</p>
      <div class="review-meta">
        <span>Your answer: ${escapeHtml(describeAnswer(i))}</span>
        <span>Correct: ${escapeHtml(describeCorrect(i))}</span>
      </div>`;
    resultsReview.appendChild(row);
  });
  const pct=Math.round(correct/questions.length*100);
  resultsScore.textContent=`${pct}%`;
  resultsBreakdown.textContent=`${correct} correct out of ${questions.length}`;
  resultsAnswered.textContent=getAnsweredCount();
  resultsCorrect.textContent=correct;
  resultsMarked.textContent=markedQuestions.size;
  resultsTime.textContent=formatTime(time);
}
function restartTest(){
  current=0;answers={};markedQuestions=new Set();eliminatedChoices={};stemMarkup={};
  dragOrder={};matchState={};hotspotState={};
  time=DEFAULT_TIME;submitted=false;eliminateMode=false;highlightMode=false;paused=false;keypadsVisible={};
  closeModal("resultsModal");localStorage.removeItem(STORAGE_KEY);
  resetCalculator();resetGraphingCalculator();
  document.getElementById("pauseOverlay").style.display="none";
  startTimer();renderQuestion();
}

// ── TOOLS ─────────────────────────────────────────────────
function resetCalculator(){ if(calculatorFrame){calculatorFrame.src="about:blank";setTimeout(()=>{calculatorFrame.src="https://www.desmos.com/scientific";},50);} }
function resetGraphingCalculator(){ if(graphingCalculator){try{graphingCalculator.destroy();}catch(e){}graphingCalculator=null;} if(graphingContainer)graphingContainer.innerHTML=""; }
function initGraphingCalculator(){ if(graphingCalculator||!window.Desmos||!graphingContainer)return; graphingCalculator=Desmos.GraphingCalculator(graphingContainer,{expressions:true,expressionsTopbar:false,settingsMenu:true,zoomButtons:true,keypad:true,border:false,lockViewport:false,links:false}); }

function setupDraggableWindows(){
  document.querySelectorAll(".draggable-window").forEach(win=>{
    const handle=win.querySelector(".drag-handle"); if(!handle)return;
    let dragging=false,ox=0,oy=0;
    handle.addEventListener("pointerdown",e=>{ if(e.target.closest("button"))return; dragging=true; const r=win.getBoundingClientRect(); ox=e.clientX-r.left;oy=e.clientY-r.top; win.style.left=`${r.left}px`;win.style.top=`${r.top}px`;win.style.transform="none"; handle.setPointerCapture(e.pointerId); });
    handle.addEventListener("pointermove",e=>{ if(!dragging)return; win.style.left=`${e.clientX-ox}px`;win.style.top=`${e.clientY-oy}px`; });
    const end=e=>{ if(!dragging)return;dragging=false;if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId); };
    handle.addEventListener("pointerup",end);handle.addEventListener("pointercancel",end);
  });
}

async function loadQuestions(){
  try{ const r=await fetch("./questions.json"); if(!r.ok)throw new Error(); questions=await r.json(); }
  catch{ const fb=document.getElementById("questionsFallback"); questions=JSON.parse(fb.textContent); }
}

// ── EVENT LISTENERS ───────────────────────────────────────
window.addEventListener("load",()=>{ if(calculatorFrame)calculatorFrame.src="https://www.desmos.com/scientific"; });
calculatorButton.addEventListener("click",()=>openModal("calculatorModal"));
graphingButton.addEventListener("click",()=>{ initGraphingCalculator(); openModal("graphingModal"); });
notesButton.addEventListener("click",()=>openModal("notesModal"));
notesField.addEventListener("input",saveNotes);
markToggle.addEventListener("click",toggleMarked);
submitButton.addEventListener("click",()=>showSubmitModal(false));
confirmSubmitButton.addEventListener("click",finalizeSubmission);
restartButton.addEventListener("click",restartTest);
eliminateModeButton.addEventListener("click",toggleEliminateMode);
highlightModeButton.addEventListener("click",toggleHighlightMode);
questionText.addEventListener("mouseup",applyHighlightFromSelection);

window.nextQuestion=nextQuestion;
window.prevQuestion=prevQuestion;
window.openModal=openModal;
window.closeModal=closeModal;
window.togglePause=togglePause;
// stub for removed sidebar toggle
window.toggleSidebar=()=>{};

// ── INIT ──────────────────────────────────────────────────
async function init(){
  loadNotes(); restoreState(); await loadQuestions(); setupDraggableWindows();
  if(current>questions.length-1)current=0;
  startTimer();
  if(window.MathJax?.startup?.promise){ await MathJax.startup.promise; }
  else { await new Promise(res=>{ const t=setInterval(()=>{ if(window.MathJax?.typesetPromise){clearInterval(t);res();} },50); setTimeout(()=>{clearInterval(t);res();},4000); }); }
  renderQuestion();
  if(submitted){ if(timerId)clearInterval(timerId); renderResults(); openModal("resultsModal"); }
}
init().catch(()=>{ questionText.textContent="There was a problem loading the question set."; });