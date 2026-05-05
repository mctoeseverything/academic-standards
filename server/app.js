/**
 * Express entrypoint for the ASB platform. Serves pages and the JSON API.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { query } = require('./db');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');
const teacherRoutes = require('./routes/teacher');
const { requireAuth, requireRole } = require('./middleware/auth');
const { getTestWithQuestions } = require('./services/tests');

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/assets', express.static(path.join(config.paths.root, 'assets')));
app.use('/pages', express.static(config.paths.pages));
app.use('/style.css', express.static(path.join(config.paths.root, 'style.css')));
app.use('/script.js', express.static(path.join(config.paths.root, 'script.js')));
app.use('/questions.json', express.static(path.join(config.paths.root, 'questions.json')));

app.use('/api/auth', authRoutes);
app.use('/api/student', requireAuth, requireRole('student'), studentRoutes);
app.use('/api/teacher', requireAuth, requireRole('teacher'), teacherRoutes);

function sendPage(res, relativePath) {
  return res.sendFile(path.join(config.paths.pages, relativePath));
}

app.get('/', (_req, res) => sendPage(res, 'index.html'));
app.get('/login', (_req, res) => sendPage(res, 'login.html'));
app.get('/register', (_req, res) => sendPage(res, 'register.html'));

app.get('/student/dashboard', (_req, res) => sendPage(res, path.join('student', 'dashboard.html')));
app.get('/student/courses', (_req, res) => sendPage(res, path.join('student', 'courses.html')));
app.get('/student/history', (_req, res) => sendPage(res, path.join('student', 'history.html')));
app.get('/student/results/:attemptId', (_req, res) => sendPage(res, path.join('student', 'results.html')));

app.get('/teacher/dashboard', (_req, res) => sendPage(res, path.join('teacher', 'dashboard.html')));
app.get('/teacher/courses', (_req, res) => sendPage(res, path.join('teacher', 'courses.html')));
app.get('/teacher/courses/:id', (_req, res) => sendPage(res, path.join('teacher', 'course-detail.html')));
app.get('/teacher/question-bank', (_req, res) => sendPage(res, path.join('teacher', 'question-bank.html')));
app.get('/teacher/tests', (_req, res) => sendPage(res, path.join('teacher', 'tests.html')));
app.get('/teacher/tests/:id/results', (_req, res) => sendPage(res, path.join('teacher', 'test-results.html')));
app.get('/teacher/students', (_req, res) => sendPage(res, path.join('teacher', 'students.html')));

app.get('/student/test/:id', requireAuth, requireRole('student'), async (req, res, next) => {
  try {
    const test = await getTestWithQuestions(req.params.id, true);
    if (!test) {
      return res.status(404).send('Test not found.');
    }

    let attempt = null;
    const activeAttempt = await query(
      `
        SELECT *
        FROM student_attempts
        WHERE student_id = $1 AND test_id = $2 AND status = 'in_progress'
        ORDER BY started_at DESC
        LIMIT 1
      `,
      [req.auth.sub, req.params.id]
    );

    if (activeAttempt.rows.length) {
      attempt = activeAttempt.rows[0];
    } else {
      const created = await query(
        `
          INSERT INTO student_attempts (
            student_id, test_id, course_id, status, time_limit_seconds, time_remaining_seconds, state
          )
          VALUES ($1, $2, $3, 'in_progress', $4, $4, $5)
          RETURNING *
        `,
        [
          req.auth.sub,
          req.params.id,
          test.course_id,
          test.time_limit_seconds,
          JSON.stringify({
            current: 0,
            answers: {},
            markedQuestions: [],
            eliminatedChoices: {},
            stemMarkup: {},
            dragOrder: {},
            matchState: {},
            hotspotState: {},
            time: test.time_limit_seconds,
            submitted: false,
          }),
        ]
      );
      attempt = created.rows[0];
    }

    const examHtml = fs.readFileSync(config.paths.examHtml, 'utf8')
      .replaceAll('./style.css', '/style.css')
      .replaceAll('./script.js', '/script.js')
      .replace(
        '</body>',
        `
          <script>
            window.ASB_TEST_CONTEXT = ${JSON.stringify({
              apiBase: '/api/student',
              testId: test.id,
              test,
              attempt,
              student: {
                id: req.auth.sub,
                fullName: req.auth.name,
                email: req.auth.email,
              },
            })};
          </script>
        </body>
        `
      );

    res.type('html').send(examHtml);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = error.status || 500;
  return res.status(status).json({ error: error.message || 'Unexpected server error.' });
});

app.listen(config.port, () => {
  console.log(`ASB server listening on http://localhost:${config.port}`);
});
