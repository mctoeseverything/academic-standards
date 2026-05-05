/**
 * Student dashboard, test, attempt, and history endpoints.
 */
'use strict';

const express = require('express');
const { query, withTransaction } = require('../db');
const { gradeAttempt } = require('../services/grade');
const { getTestQuestions, getTestWithQuestions } = require('../services/tests');

const router = express.Router();

async function getActiveAttempt(studentId, testId) {
  const result = await query(
    `
      SELECT *
      FROM student_attempts
      WHERE student_id = $1 AND test_id = $2 AND status = 'in_progress'
      ORDER BY started_at DESC
      LIMIT 1
    `,
    [studentId, testId]
  );
  return result.rows[0] || null;
}

router.get('/dashboard', async (req, res) => {
  const studentId = req.auth.sub;

  const [assignedTests, recentResults, courseSummary, progress] = await Promise.all([
    query(
      `
        SELECT
          t.id,
          t.name,
          t.status,
          t.due_date,
          c.name AS course_name
        FROM course_enrollments ce
        JOIN courses c ON c.id = ce.course_id
        JOIN course_tests ct ON ct.course_id = c.id
        JOIN tests t ON t.id = ct.test_id
        WHERE ce.student_id = $1 AND t.status = 'published'
        ORDER BY t.due_date NULLS LAST, t.name
      `,
      [studentId]
    ),
    query(
      `
        SELECT
          sa.id,
          sa.score_percent,
          sa.submitted_at,
          t.name AS test_name
        FROM student_attempts sa
        JOIN tests t ON t.id = sa.test_id
        WHERE sa.student_id = $1 AND sa.status = 'submitted'
        ORDER BY sa.submitted_at DESC
        LIMIT 5
      `,
      [studentId]
    ),
    query(
      `
        SELECT
          c.id,
          c.name,
          c.subject_area,
          u.name AS teacher_name
        FROM course_enrollments ce
        JOIN courses c ON c.id = ce.course_id
        JOIN users u ON u.id = c.teacher_id
        WHERE ce.student_id = $1
        ORDER BY c.name
      `,
      [studentId]
    ),
    query(
      `
        SELECT
          COUNT(*) FILTER (WHERE sa.status = 'submitted')::int AS tests_taken,
          COALESCE(ROUND(AVG(sa.score_percent))::int, 0) AS average_score,
          COUNT(DISTINCT ce.course_id)::int AS courses_active
        FROM users u
        LEFT JOIN student_attempts sa ON sa.student_id = u.id
        LEFT JOIN course_enrollments ce ON ce.student_id = u.id
        WHERE u.id = $1
        GROUP BY u.id
      `,
      [studentId]
    ),
  ]);

  return res.json({
    user: req.auth,
    assignedTests: assignedTests.rows,
    recentResults: recentResults.rows,
    courses: courseSummary.rows,
    progress: progress.rows[0] || { tests_taken: 0, average_score: 0, courses_active: 0 },
  });
});

router.get('/courses', async (req, res) => {
  const studentId = req.auth.sub;
  const result = await query(
    `
      SELECT
        c.id,
        c.name,
        c.subject_area,
        u.name AS teacher_name,
        COUNT(DISTINCT ct.test_id)::int AS test_count,
        COUNT(DISTINCT CASE WHEN sa.status = 'submitted' THEN sa.test_id END)::int AS completed_tests
      FROM course_enrollments ce
      JOIN courses c ON c.id = ce.course_id
      JOIN users u ON u.id = c.teacher_id
      LEFT JOIN course_tests ct ON ct.course_id = c.id
      LEFT JOIN student_attempts sa
        ON sa.student_id = ce.student_id
       AND sa.test_id = ct.test_id
       AND sa.status = 'submitted'
      WHERE ce.student_id = $1
      GROUP BY c.id, u.name
      ORDER BY c.name
    `,
    [studentId]
  );

  return res.json({ courses: result.rows });
});

router.get('/tests/:id', async (req, res) => {
  const test = await getTestWithQuestions(req.params.id, true);
  if (!test) {
    return res.status(404).json({ error: 'Test not found.' });
  }

  const activeAttempt = await getActiveAttempt(req.auth.sub, req.params.id);
  return res.json({ test, activeAttempt });
});

router.post('/attempts', async (req, res) => {
  const { testId } = req.body || {};
  if (!testId) {
    return res.status(400).json({ error: 'testId is required.' });
  }

  const test = await getTestWithQuestions(testId, true);
  if (!test) {
    return res.status(404).json({ error: 'Test not found.' });
  }

  const existing = await getActiveAttempt(req.auth.sub, testId);
  if (existing) {
    return res.status(200).json({ attempt: existing });
  }

  const inserted = await query(
    `
      INSERT INTO student_attempts (
        student_id, test_id, course_id, status, time_limit_seconds, time_remaining_seconds, state
      )
      VALUES ($1, $2, $3, 'in_progress', $4, $4, $5)
      RETURNING *
    `,
    [
      req.auth.sub,
      testId,
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

  return res.status(201).json({ attempt: inserted.rows[0] });
});

router.put('/attempts/:id', async (req, res) => {
  const { state, notes } = req.body || {};
  const result = await query(
    `
      UPDATE student_attempts
      SET
        state = COALESCE($3, state),
        notes = COALESCE($4, notes),
        time_remaining_seconds = COALESCE(($3->>'time')::int, time_remaining_seconds),
        updated_at = NOW()
      WHERE id = $1 AND student_id = $2
      RETURNING *
    `,
    [req.params.id, req.auth.sub, state ? JSON.stringify(state) : null, notes || null]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: 'Attempt not found.' });
  }

  return res.json({ attempt: result.rows[0] });
});

router.post('/attempts/:id/submit', async (req, res) => {
  const attemptId = req.params.id;
  const attemptResult = await query(
    'SELECT * FROM student_attempts WHERE id = $1 AND student_id = $2',
    [attemptId, req.auth.sub]
  );

  if (!attemptResult.rows.length) {
    return res.status(404).json({ error: 'Attempt not found.' });
  }

  const attempt = attemptResult.rows[0];
  const testQuestions = await getTestQuestions(attempt.test_id, true);
  const state = attempt.state || {};
  const answersByPosition = state.answers || {};
  const graded = gradeAttempt(testQuestions, answersByPosition);

  await withTransaction(async (client) => {
    await client.query('DELETE FROM student_answers WHERE attempt_id = $1', [attemptId]);

    for (const item of graded.perQuestion) {
      await client.query(
        `
          INSERT INTO student_answers (
            attempt_id, question_id, question_position, answer_payload, is_correct, explanation
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          attemptId,
          item.questionId,
          item.position,
          JSON.stringify(item.answer ?? null),
          item.isCorrect,
          item.explanation,
        ]
      );
    }

    await client.query(
      `
        UPDATE student_attempts
        SET
          status = 'submitted',
          submitted_at = NOW(),
          score_percent = $2,
          correct_count = $3,
          answered_count = $4,
          total_questions = $5,
          state = $6,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        attemptId,
        graded.scorePercent,
        graded.correct,
        graded.answered,
        graded.total,
        JSON.stringify({ ...state, submitted: true }),
      ]
    );
  });

  return res.json({
    attemptId,
    scorePercent: graded.scorePercent,
    correct: graded.correct,
    answered: graded.answered,
    total: graded.total,
  });
});

router.get('/attempts/:id', async (req, res) => {
  const attemptResult = await query(
    `
      SELECT
        sa.*,
        t.name AS test_name,
        c.name AS course_name
      FROM student_attempts sa
      JOIN tests t ON t.id = sa.test_id
      LEFT JOIN courses c ON c.id = sa.course_id
      WHERE sa.id = $1 AND sa.student_id = $2
    `,
    [req.params.id, req.auth.sub]
  );

  if (!attemptResult.rows.length) {
    return res.status(404).json({ error: 'Attempt not found.' });
  }

  const attempt = attemptResult.rows[0];
  const test = await getTestWithQuestions(attempt.test_id, true);
  const answers = await query(
    `
      SELECT question_position, answer_payload, is_correct, explanation
      FROM student_answers
      WHERE attempt_id = $1
      ORDER BY question_position
    `,
    [attempt.id]
  );

  return res.json({
    attempt,
    test,
    answers: answers.rows,
  });
});

router.get('/history', async (req, res) => {
  const result = await query(
    `
      SELECT
        sa.id,
        t.name AS test_name,
        c.name AS course_name,
        sa.submitted_at,
        sa.score_percent,
        sa.time_limit_seconds,
        sa.time_remaining_seconds
      FROM student_attempts sa
      JOIN tests t ON t.id = sa.test_id
      LEFT JOIN courses c ON c.id = sa.course_id
      WHERE sa.student_id = $1 AND sa.status = 'submitted'
      ORDER BY sa.submitted_at DESC
    `,
    [req.auth.sub]
  );

  return res.json({ attempts: result.rows });
});

module.exports = router;
