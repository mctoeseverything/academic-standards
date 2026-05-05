/**
 * Shared page behavior for the ASB web platform.
 */
'use strict';

(function bootstrap() {
  const page = document.body.dataset.page;
  const role = document.body.dataset.role;

  const state = {
    user: null,
    selectedTestQuestions: [],
  };

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (_error) {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(payload?.error || 'Request failed.');
    }

    return payload;
  }

  function setMessage(id, message, type = 'error') {
    const element = document.getElementById(id);
    if (!element) return;
    element.hidden = !message;
    element.textContent = message || '';
    element.className = `message${message ? ` is-${type}` : ''}`;
  }

  function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString();
  }

  function formatDateTime(value) {
    if (!value) return '—';
    return new Date(value).toLocaleString();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function getPathId(segmentIndexFromEnd = 0) {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1 - segmentIndexFromEnd];
  }

  function renderProgressBar(completed, total) {
    const percent = total ? Math.min(100, Math.round((completed / total) * 100)) : 0;
    return `
      <div class="progress-track">
        <div class="progress-fill" style="width:${percent}%"></div>
      </div>
      <div class="muted" style="margin-top:8px;">${completed} of ${total} tests completed</div>
    `;
  }

  function renderBarChart(targetId, distribution) {
    const container = document.getElementById(targetId);
    if (!container) return;
    const buckets = ['0-20', '21-40', '41-60', '61-80', '81-100'];
    const counts = buckets.map((_, index) => {
      const match = distribution.find((entry) => Number(entry.bucket) === index + 1);
      return match ? Number(match.count) : 0;
    });
    const max = Math.max(...counts, 1);
    const barWidth = 92;
    const height = 220;
    const chart = buckets.map((label, index) => {
      const value = counts[index];
      const scaled = Math.round((value / max) * 140);
      const x = 32 + index * 108;
      const y = 170 - scaled;
      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${scaled}" fill="#3b4bc8"></rect>
        <text x="${x + barWidth / 2}" y="${y - 10}" text-anchor="middle" font-family="Inter" font-size="11" fill="#333340">${value}</text>
        <text x="${x + barWidth / 2}" y="194" text-anchor="middle" font-family="Inter" font-size="11" fill="#6b6e80">${label}</text>
      `;
    }).join('');

    container.innerHTML = `
      <svg class="svg-chart" viewBox="0 0 620 220" aria-label="Score distribution">
        <line x1="22" y1="170" x2="590" y2="170" stroke="#d9dbe0" stroke-width="1"></line>
        ${chart}
      </svg>
    `;
  }

  function enableSortableTables() {
    document.querySelectorAll('table[data-sortable]').forEach((table) => {
      table.querySelectorAll('th[data-key]').forEach((header) => {
        header.addEventListener('click', () => {
          const tbody = table.querySelector('tbody');
          const rows = Array.from(tbody.querySelectorAll('tr'));
          const key = header.dataset.key;
          const type = header.dataset.type || 'text';
          const desc = header.dataset.order === 'desc';

          rows.sort((a, b) => {
            const av = a.querySelector(`[data-${key}]`)?.dataset[key] ?? a.querySelector(`[data-${key}]`)?.textContent ?? '';
            const bv = b.querySelector(`[data-${key}]`)?.dataset[key] ?? b.querySelector(`[data-${key}]`)?.textContent ?? '';
            if (type === 'number') {
              return (Number(av) - Number(bv)) * (desc ? -1 : 1);
            }
            return String(av).localeCompare(String(bv)) * (desc ? -1 : 1);
          });

          header.dataset.order = desc ? 'asc' : 'desc';
          tbody.innerHTML = '';
          rows.forEach((row) => tbody.appendChild(row));
        });
      });
    });
  }

  function bindLogout() {
    document.querySelectorAll('[data-action="logout"]').forEach((button) => {
      button.addEventListener('click', async () => {
        await fetchJson('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
      });
    });
  }

  async function loadLoginPage() {
    const tabs = Array.from(document.querySelectorAll('[data-role-tab]'));
    const emailStep = document.getElementById('emailStep');
    const passwordStep = document.getElementById('passwordStep');
    const continueButton = document.getElementById('continueLogin');
    const backButton = document.getElementById('backToEmail');
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const loginForm = document.getElementById('loginForm');
    let currentRole = 'student';

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        currentRole = tab.dataset.roleTab;
        tabs.forEach((node) => node.classList.toggle('is-active', node === tab));
      });
    });

    continueButton.addEventListener('click', () => {
      if (!emailInput.value.trim()) {
        setMessage('loginMessage', 'Enter your email address.');
        return;
      }
      setMessage('loginMessage', '');
      emailStep.hidden = true;
      passwordStep.hidden = false;
      passwordInput.focus();
    });

    backButton.addEventListener('click', () => {
      passwordStep.hidden = true;
      emailStep.hidden = false;
      passwordInput.value = '';
    });

    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!emailInput.value.trim() || !passwordInput.value.trim()) {
        setMessage('loginMessage', 'Email and password are required.');
        return;
      }

      try {
        const payload = await fetchJson('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: emailInput.value.trim(),
            password: passwordInput.value,
            role: currentRole,
          }),
        });
        window.location.href = payload.user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard';
      } catch (error) {
        setMessage('loginMessage', error.message);
      }
    });
  }

  async function loadRegisterPage() {
    const tabs = Array.from(document.querySelectorAll('[data-register-tab]'));
    const studentFields = document.getElementById('studentFields');
    const teacherFields = document.getElementById('teacherFields');
    const form = document.getElementById('registerForm');
    let currentRole = 'student';

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        currentRole = tab.dataset.registerTab;
        tabs.forEach((node) => node.classList.toggle('is-active', node === tab));
        studentFields.hidden = currentRole !== 'student';
        teacherFields.hidden = currentRole !== 'teacher';
      });
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const name = document.getElementById('registerName').value.trim();
      const email = document.getElementById('registerEmail').value.trim();
      const password = document.getElementById('registerPassword').value;
      if (!name || !email || !password) {
        setMessage('registerMessage', 'Name, email, and password are required.');
        return;
      }

      const body = {
        role: currentRole,
        name,
        email,
        password,
      };

      if (currentRole === 'student') {
        body.dateOfBirth = document.getElementById('registerDob').value;
        body.studentId = document.getElementById('registerStudentId').value.trim();
      } else {
        body.institution = document.getElementById('registerInstitution').value.trim();
        body.subjectArea = document.getElementById('registerSubjectArea').value.trim();
      }

      try {
        const payload = await fetchJson('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        window.location.href = payload.user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard';
      } catch (error) {
        setMessage('registerMessage', error.message);
      }
    });
  }

  async function loadStudentDashboard() {
    const payload = await fetchJson('/api/student/dashboard');
    document.getElementById('studentGreeting').textContent = `Welcome, ${payload.user.name}`;
    document.getElementById('assignedTests').innerHTML = payload.assignedTests.map((test) => `
      <div class="list-item">
        <div class="eyebrow">${escapeHtml(test.course_name || 'Assigned test')}</div>
        <h3 style="margin:0 0 8px;color:#1a1a1a;">${escapeHtml(test.name)}</h3>
        <p class="muted" style="margin:0 0 12px;">Due ${formatDate(test.due_date)}</p>
        <a class="outline-button" href="/student/test/${test.id}">Open Test</a>
      </div>
    `).join('') || '<div class="empty-state">No tests are assigned right now.</div>';

    document.getElementById('recentResults').innerHTML = payload.recentResults.map((item) => `
      <div class="list-item">
        <div style="display:flex;justify-content:space-between;gap:10px;">
          <strong style="color:#1a1a1a;">${escapeHtml(item.test_name)}</strong>
          <span class="status-badge is-answered">${item.score_percent}%</span>
        </div>
        <p class="muted" style="margin:10px 0 0;">Submitted ${formatDateTime(item.submitted_at)}</p>
      </div>
    `).join('') || '<div class="empty-state">No submitted attempts yet.</div>';

    document.getElementById('courseCards').innerHTML = payload.courses.map((course) => `
      <div class="card">
        <div class="eyebrow">${escapeHtml(course.subject_area || 'Course')}</div>
        <h3>${escapeHtml(course.name)}</h3>
        <p class="muted" style="margin:0;">Teacher: ${escapeHtml(course.teacher_name)}</p>
      </div>
    `).join('');

    document.getElementById('testsTaken').textContent = payload.progress.tests_taken;
    document.getElementById('averageScore').textContent = `${payload.progress.average_score}%`;
    document.getElementById('coursesActive').textContent = payload.progress.courses_active;
  }

  async function loadStudentCourses() {
    const payload = await fetchJson('/api/student/courses');
    document.getElementById('studentCourseGrid').innerHTML = payload.courses.map((course) => `
      <div class="card">
        <div class="eyebrow">${escapeHtml(course.subject_area)}</div>
        <h3>${escapeHtml(course.name)}</h3>
        <p class="muted">Teacher: ${escapeHtml(course.teacher_name)}</p>
        <div style="margin-top:14px;">${renderProgressBar(course.completed_tests, course.test_count)}</div>
      </div>
    `).join('');
  }

  async function loadStudentHistory() {
    const payload = await fetchJson('/api/student/history');
    const tbody = document.getElementById('studentHistoryRows');
    tbody.innerHTML = payload.attempts.map((attempt) => {
      const timeTaken = Number(attempt.time_limit_seconds) - Number(attempt.time_remaining_seconds);
      return `
        <tr class="row-link" data-href="/student/results/${attempt.id}">
          <td data-test_name="${escapeHtml(attempt.test_name)}">${escapeHtml(attempt.test_name)}</td>
          <td data-course_name="${escapeHtml(attempt.course_name || '')}">${escapeHtml(attempt.course_name || '—')}</td>
          <td data-submitted_at="${attempt.submitted_at}">${formatDateTime(attempt.submitted_at)}</td>
          <td data-score_percent="${attempt.score_percent}">${attempt.score_percent}%</td>
          <td data-time_taken="${timeTaken}">${Math.round(timeTaken / 60)} min</td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('tr[data-href]').forEach((row) => {
      row.addEventListener('click', () => {
        window.location.href = row.dataset.href;
      });
    });
  }

  async function loadStudentResults() {
    const attemptId = getPathId();
    const payload = await fetchJson(`/api/student/attempts/${attemptId}`);
    document.getElementById('resultTitle').textContent = payload.test.name;
    document.getElementById('resultScore').textContent = `${payload.attempt.score_percent}%`;
    document.getElementById('resultBreakdown').textContent = `${payload.attempt.correct_count}/${payload.attempt.total_questions} correct`;
    document.getElementById('resultMeta').innerHTML = `
      <div class="metric"><h3>Course</h3><p class="metric-value" style="font-size:1.1rem;">${escapeHtml(payload.attempt.course_name || 'Independent')}</p></div>
      <div class="metric"><h3>Submitted</h3><p class="metric-value" style="font-size:1.1rem;">${formatDateTime(payload.attempt.submitted_at)}</p></div>
      <div class="metric"><h3>Answered</h3><p class="metric-value" style="font-size:1.1rem;">${payload.attempt.answered_count}</p></div>
    `;

    const answerMap = new Map(payload.answers.map((entry) => [Number(entry.question_position), entry]));
    document.getElementById('questionReviewList').innerHTML = payload.test.questions.map((question, index) => {
      const answer = answerMap.get(index);
      return `
        <div class="question-review-card">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
            <strong style="color:#1a1a1a;">Question ${index + 1}</strong>
            <span class="status-badge ${answer?.is_correct ? 'is-correct' : 'is-incorrect'}">${answer?.is_correct ? 'Correct' : 'Incorrect'}</span>
          </div>
          <div class="prompt">${question.prompt}</div>
          <div class="message" style="margin-top:10px;">Your answer: ${escapeHtml(JSON.stringify(answer?.answer_payload ?? null))}</div>
          <div class="message" style="margin-top:10px;">Correct answer: ${escapeHtml(JSON.stringify(question.correct ?? null))}</div>
          ${question.explanation ? `<div class="message" style="margin-top:10px;">Explanation: ${question.explanation}</div>` : ''}
        </div>
      `;
    }).join('');

    if (window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise();
    }
  }

  async function loadTeacherDashboard() {
    const payload = await fetchJson('/api/teacher/dashboard');
    document.getElementById('activeCourses').textContent = payload.overview.active_courses;
    document.getElementById('totalStudents').textContent = payload.overview.total_students;
    document.getElementById('testsAssigned').textContent = payload.overview.tests_assigned;
    document.getElementById('teacherActivity').innerHTML = payload.activity.map((item) => `
      <div class="list-item">
        <strong style="color:#1a1a1a;">${escapeHtml(item.student_name)}</strong>
        <p class="muted" style="margin:8px 0 0;">Submitted ${escapeHtml(item.test_name)} with ${item.score_percent}% on ${formatDateTime(item.submitted_at)}</p>
      </div>
    `).join('') || '<div class="empty-state">No recent activity yet.</div>';
  }

  async function loadTeacherCourses() {
    const payload = await fetchJson('/api/teacher/courses');
    document.getElementById('teacherCourseGrid').innerHTML = payload.courses.map((course) => `
      <div class="card">
        <div class="eyebrow">${escapeHtml(course.subject_area)}</div>
        <h3>${escapeHtml(course.name)}</h3>
        <p class="muted">${course.student_count} students • ${course.test_count} tests</p>
        <div class="button-row" style="margin-top:14px;">
          <a class="outline-button" href="/teacher/courses/${course.id}">Open Course</a>
        </div>
      </div>
    `).join('');

    document.getElementById('createCourseForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await fetchJson('/api/teacher/courses', {
          method: 'POST',
          body: JSON.stringify({
            name: document.getElementById('courseName').value.trim(),
            subjectArea: document.getElementById('courseSubject').value.trim(),
            description: document.getElementById('courseDescription').value.trim(),
          }),
        });
        window.location.reload();
      } catch (error) {
        setMessage('courseMessage', error.message);
      }
    });
  }

  async function loadTeacherCourseDetail() {
    const courseId = getPathId();
    const payload = await fetchJson(`/api/teacher/courses/${courseId}/students`);
    document.getElementById('courseDetailTitle').textContent = payload.course.name;
    document.getElementById('courseDetailCopy').textContent = payload.course.description || 'Course detail, roster, and assigned assessments.';
    document.getElementById('courseRosterRows').innerHTML = payload.students.map((student) => `
      <tr>
        <td data-name="${escapeHtml(student.name)}">${escapeHtml(student.name)}</td>
        <td data-email="${escapeHtml(student.email)}">${escapeHtml(student.email)}</td>
        <td data-student_id="${escapeHtml(student.student_id || '')}">${escapeHtml(student.student_id || '—')}</td>
        <td data-average_score="${student.average_score || 0}">${student.average_score || 0}%</td>
      </tr>
    `).join('');
    document.getElementById('courseAssignedTests').innerHTML = payload.tests.map((test) => `
      <div class="list-item">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
          <strong style="color:#1a1a1a;">${escapeHtml(test.name)}</strong>
          <span class="status-badge ${test.status === 'published' ? 'is-published' : 'is-draft'}">${escapeHtml(test.status)}</span>
        </div>
        <p class="muted" style="margin:8px 0 0;">Due ${formatDate(test.due_date)}</p>
      </div>
    `).join('') || '<div class="empty-state">No tests assigned yet.</div>';

    document.getElementById('enrollForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await fetchJson(`/api/teacher/courses/${courseId}/enroll`, {
          method: 'POST',
          body: JSON.stringify({ studentEmail: document.getElementById('enrollEmail').value.trim() }),
        });
        window.location.reload();
      } catch (error) {
        setMessage('courseDetailMessage', error.message);
      }
    });
  }

  async function loadQuestionBank() {
    async function refresh() {
      const params = new URLSearchParams();
      ['qbSubject', 'qbType', 'qbDifficulty', 'qbSearch'].forEach((id) => {
        const value = document.getElementById(id)?.value.trim();
        if (value) params.set(id.replace('qb', '').toLowerCase(), value);
      });

      const payload = await fetchJson(`/api/teacher/questions?${params.toString()}`);
      document.getElementById('questionBankList').innerHTML = payload.questions.map((question) => `
        <div class="drag-item" draggable="true" data-question-id="${question.id}">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
            <strong style="color:#1a1a1a;">${escapeHtml(question.topic)}</strong>
            <span class="status-badge is-draft">Difficulty ${question.difficulty}</span>
          </div>
          <div class="body-copy" style="margin-top:10px;">${question.prompt}</div>
        </div>
      `).join('');

      if (window.MathJax?.typesetPromise) {
        window.MathJax.typesetPromise();
      }
    }

    document.getElementById('questionFilterForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      await refresh();
    });

    document.getElementById('questionCreateForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const rawChoices = document.getElementById('questionChoices').value.trim();
      const rawTags = document.getElementById('questionTags').value.trim();
      try {
        await fetchJson('/api/teacher/questions', {
          method: 'POST',
          body: JSON.stringify({
            type: document.getElementById('questionType').value,
            prompt: document.getElementById('questionPrompt').value.trim(),
            choices: rawChoices ? rawChoices.split('\n').map((item) => item.trim()).filter(Boolean) : null,
            correct: JSON.parse(document.getElementById('questionCorrect').value),
            explanation: document.getElementById('questionExplanation').value.trim(),
            subject: document.getElementById('questionSubject').value.trim(),
            topic: document.getElementById('questionTopic').value.trim(),
            difficulty: Number(document.getElementById('questionDifficulty').value),
            tags: rawTags ? rawTags.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
          }),
        });
        event.target.reset();
        setMessage('questionBankMessage', 'Question saved.', 'success');
        await refresh();
      } catch (error) {
        setMessage('questionBankMessage', error.message);
      }
    });

    await refresh();
  }

  async function loadTestsPage() {
    const [testsPayload, coursesPayload, questionsPayload] = await Promise.all([
      fetchJson('/api/teacher/tests'),
      fetchJson('/api/teacher/courses'),
      fetchJson('/api/teacher/questions'),
    ]);

    state.selectedTestQuestions = [];

    document.getElementById('teacherTestsList').innerHTML = testsPayload.tests.map((test) => `
      <div class="card">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
          <div>
            <div class="eyebrow">${escapeHtml(test.course_name || 'Independent test')}</div>
            <h3>${escapeHtml(test.name)}</h3>
          </div>
          <span class="status-badge ${test.status === 'published' ? 'is-published' : 'is-draft'}">${escapeHtml(test.status)}</span>
        </div>
        <p class="muted">${test.question_count} questions • ${Math.round(test.time_limit_seconds / 60)} minutes</p>
        <div class="button-row" style="margin-top:14px;">
          <a class="outline-button" href="/teacher/tests/${test.id}/results">View Results</a>
        </div>
      </div>
    `).join('');

    document.getElementById('testCourse').innerHTML = `<option value="">Select a course</option>` + coursesPayload.courses.map((course) => `
      <option value="${course.id}">${escapeHtml(course.name)}</option>
    `).join('');

    const bank = document.getElementById('testBuilderBank');
    const selected = document.getElementById('selectedQuestions');

    function renderSelectedQuestions() {
      selected.innerHTML = state.selectedTestQuestions.map((question, index) => `
        <div class="drag-item" draggable="true" data-selected-index="${index}">
          <div style="display:flex;justify-content:space-between;gap:10px;">
            <strong style="color:#1a1a1a;">${index + 1}. ${escapeHtml(question.topic)}</strong>
            <button type="button" class="secondary-button" data-remove-question="${question.id}">Remove</button>
          </div>
          <div class="body-copy" style="margin-top:8px;">${question.prompt}</div>
        </div>
      `).join('');

      selected.querySelectorAll('[data-remove-question]').forEach((button) => {
        button.addEventListener('click', () => {
          state.selectedTestQuestions = state.selectedTestQuestions.filter((question) => question.id !== button.dataset.removeQuestion);
          renderSelectedQuestions();
        });
      });

      if (window.MathJax?.typesetPromise) {
        window.MathJax.typesetPromise();
      }
    }

    bank.innerHTML = questionsPayload.questions.map((question) => `
      <div class="drag-item" draggable="true" data-bank-question="${question.id}">
        <strong style="color:#1a1a1a;">${escapeHtml(question.topic)}</strong>
        <div class="body-copy" style="margin-top:8px;">${question.prompt}</div>
      </div>
    `).join('');

    bank.querySelectorAll('[data-bank-question]').forEach((element) => {
      element.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/question-id', element.dataset.bankQuestion);
      });
      element.addEventListener('dblclick', () => {
        const question = questionsPayload.questions.find((item) => item.id === element.dataset.bankQuestion);
        if (question && !state.selectedTestQuestions.some((entry) => entry.id === question.id)) {
          state.selectedTestQuestions.push(question);
          renderSelectedQuestions();
        }
      });
    });

    selected.addEventListener('dragover', (event) => event.preventDefault());
    selected.addEventListener('drop', (event) => {
      event.preventDefault();
      const questionId = event.dataTransfer.getData('text/question-id');
      const question = questionsPayload.questions.find((item) => item.id === questionId);
      if (question && !state.selectedTestQuestions.some((entry) => entry.id === question.id)) {
        state.selectedTestQuestions.push(question);
        renderSelectedQuestions();
      }
    });

    document.getElementById('testCreateForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await fetchJson('/api/teacher/tests', {
          method: 'POST',
          body: JSON.stringify({
            name: document.getElementById('testName').value.trim(),
            courseId: document.getElementById('testCourse').value,
            description: document.getElementById('testDescription').value.trim(),
            timeLimitSeconds: Number(document.getElementById('testTimeLimit').value) * 60,
            dueDate: document.getElementById('testDueDate').value || null,
            questionIds: state.selectedTestQuestions.map((question) => question.id),
          }),
        });
        window.location.reload();
      } catch (error) {
        setMessage('testsMessage', error.message);
      }
    });

    renderSelectedQuestions();
    if (window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise();
    }
  }

  async function loadTeacherTestResults() {
    const testId = getPathId(1);
    const payload = await fetchJson(`/api/teacher/tests/${testId}/results`);
    document.getElementById('testResultsTitle').textContent = payload.test?.name || 'Test Results';
    renderBarChart('scoreDistributionChart', payload.distribution);
    document.getElementById('questionDifficultyRows').innerHTML = payload.perQuestion.map((item) => `
      <tr>
        <td data-question_position="${item.question_position}">Question ${Number(item.question_position) + 1}</td>
        <td data-correct_rate="${item.correct_rate}">${item.correct_rate}%</td>
      </tr>
    `).join('');
    document.getElementById('studentScoresRows').innerHTML = payload.students.map((student) => `
      <tr>
        <td data-student_name="${escapeHtml(student.student_name)}">${escapeHtml(student.student_name)}</td>
        <td data-email="${escapeHtml(student.email)}">${escapeHtml(student.email)}</td>
        <td data-score_percent="${student.score_percent}">${student.score_percent}%</td>
        <td data-submitted_at="${student.submitted_at}">${formatDateTime(student.submitted_at)}</td>
      </tr>
    `).join('');
  }

  async function loadTeacherStudents() {
    async function refresh(search = '') {
      const payload = await fetchJson(`/api/teacher/students?search=${encodeURIComponent(search)}`);
      const list = document.getElementById('teacherStudentsList');
      list.innerHTML = payload.students.map((student) => `
        <div class="list-item" data-student-id="${student.id}">
          <div style="display:flex;justify-content:space-between;gap:10px;">
            <div>
              <strong style="color:#1a1a1a;">${escapeHtml(student.name)}</strong>
              <p class="muted" style="margin:6px 0 0;">${escapeHtml(student.email)}</p>
            </div>
            <span class="status-badge is-answered">${student.course_count} courses</span>
          </div>
          <div class="history-slot" id="history-${student.id}" hidden style="margin-top:14px;"></div>
        </div>
      `).join('');

      list.querySelectorAll('[data-student-id]').forEach((item) => {
        item.addEventListener('click', async () => {
          const history = await fetchJson(`/api/teacher/students/${item.dataset.studentId}/history`);
          const slot = document.getElementById(`history-${item.dataset.studentId}`);
          slot.hidden = false;
          slot.innerHTML = history.attempts.map((attempt) => `
            <div class="message" style="margin-top:8px;">
              ${escapeHtml(attempt.test_name)} • ${attempt.score_percent}% • ${formatDateTime(attempt.submitted_at)}
            </div>
          `).join('') || '<div class="message" style="margin-top:8px;">No submitted attempts yet.</div>';
        });
      });
    }

    document.getElementById('studentSearchForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      await refresh(document.getElementById('studentSearchInput').value.trim());
    });

    await refresh();
  }

  bindLogout();
  enableSortableTables();

  const loaders = {
    login: loadLoginPage,
    register: loadRegisterPage,
    'student-dashboard': loadStudentDashboard,
    'student-courses': loadStudentCourses,
    'student-history': loadStudentHistory,
    'student-results': loadStudentResults,
    'teacher-dashboard': loadTeacherDashboard,
    'teacher-courses': loadTeacherCourses,
    'teacher-course-detail': loadTeacherCourseDetail,
    'teacher-question-bank': loadQuestionBank,
    'teacher-tests': loadTestsPage,
    'teacher-test-results': loadTeacherTestResults,
    'teacher-students': loadTeacherStudents,
  };

  if (loaders[page]) {
    loaders[page]().catch((error) => {
      const fallbackId = role === 'teacher' ? 'teacherPageMessage' : role === 'student' ? 'studentPageMessage' : `${page}Message`;
      setMessage(fallbackId, error.message);
      console.error(error);
    });
  }
})();
