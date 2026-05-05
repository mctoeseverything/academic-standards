/**
 * Teacher dashboards, courses, tests, students, and question bank endpoints.
 */
'use strict';

const express = require('express');
const { query, withTransaction } = require('../db');
const { getTestWithQuestions } = require('../services/tests');

const router = express.Router();

router.get('/dashboard', async (req, res) => {
  const teacherId = req.auth.sub;
  const [counts, activity] = await Promise.all([
    query(
      `
        SELECT
          COUNT(DISTINCT c.id)::int AS active_courses,
          COUNT(DISTINCT ce.student_id)::int AS total_students,
          COUNT(DISTINCT ct.test_id)::int AS tests_assigned
        FROM courses c
        LEFT JOIN course_enrollments ce ON ce.course_id = c.id
        LEFT JOIN course_tests ct ON ct.course_id = c.id
        WHERE c.teacher_id = $1 AND c.archived_at IS NULL
      `,
      [teacherId]
    ),
    query(
      `
        SELECT
          sa.submitted_at,
          u.name AS student_name,
          t.name AS test_name,
          sa.score_percent
        FROM student_attempts sa
        JOIN tests t ON t.id = sa.test_id
        JOIN users u ON u.id = sa.student_id
        WHERE t.creator_id = $1 AND sa.status = 'submitted'
        ORDER BY sa.submitted_at DESC
        LIMIT 8
      `,
      [teacherId]
    ),
  ]);

  return res.json({
    overview: counts.rows[0] || { active_courses: 0, total_students: 0, tests_assigned: 0 },
    activity: activity.rows,
  });
});

router.get('/courses', async (req, res) => {
  const result = await query(
    `
      SELECT
        c.*,
        COUNT(DISTINCT ce.student_id)::int AS student_count,
        COUNT(DISTINCT ct.test_id)::int AS test_count
      FROM courses c
      LEFT JOIN course_enrollments ce ON ce.course_id = c.id
      LEFT JOIN course_tests ct ON ct.course_id = c.id
      WHERE c.teacher_id = $1
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `,
    [req.auth.sub]
  );
  return res.json({ courses: result.rows });
});

router.post('/courses', async (req, res) => {
  const { name, subjectArea, description } = req.body || {};
  if (!name || !subjectArea) {
    return res.status(400).json({ error: 'Course name and subject area are required.' });
  }

  const inserted = await query(
    `
      INSERT INTO courses (teacher_id, name, subject_area, description)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [req.auth.sub, name, subjectArea, description || null]
  );

  return res.status(201).json({ course: inserted.rows[0] });
});

router.put('/courses/:id', async (req, res) => {
  const { name, subjectArea, description, archived } = req.body || {};
  const updated = await query(
    `
      UPDATE courses
      SET
        name = COALESCE($3, name),
        subject_area = COALESCE($4, subject_area),
        description = COALESCE($5, description),
        archived_at = CASE WHEN $6::boolean THEN NOW() ELSE NULL END
      WHERE id = $1 AND teacher_id = $2
      RETURNING *
    `,
    [req.params.id, req.auth.sub, name || null, subjectArea || null, description || null, Boolean(archived)]
  );

  if (!updated.rows.length) {
    return res.status(404).json({ error: 'Course not found.' });
  }

  return res.json({ course: updated.rows[0] });
});

router.get('/courses/:id/students', async (req, res) => {
  const [course, students, tests] = await Promise.all([
    query('SELECT * FROM courses WHERE id = $1 AND teacher_id = $2', [req.params.id, req.auth.sub]),
    query(
      `
        SELECT
          u.id,
          u.name,
          u.email,
          u.student_id,
          AVG(sa.score_percent)::int AS average_score
        FROM course_enrollments ce
        JOIN users u ON u.id = ce.student_id
        LEFT JOIN student_attempts sa ON sa.student_id = u.id AND sa.course_id = ce.course_id AND sa.status = 'submitted'
        WHERE ce.course_id = $1
        GROUP BY u.id
        ORDER BY u.name
      `,
      [req.params.id]
    ),
    query(
      `
        SELECT t.id, t.name, t.status, t.due_date
        FROM course_tests ct
        JOIN tests t ON t.id = ct.test_id
        WHERE ct.course_id = $1
        ORDER BY t.created_at DESC
      `,
      [req.params.id]
    ),
  ]);

  if (!course.rows.length) {
    return res.status(404).json({ error: 'Course not found.' });
  }

  return res.json({
    course: course.rows[0],
    students: students.rows,
    tests: tests.rows,
  });
});

router.post('/courses/:id/enroll', async (req, res) => {
  const { studentEmail } = req.body || {};
  if (!studentEmail) {
    return res.status(400).json({ error: 'studentEmail is required.' });
  }

  const student = await query(
    'SELECT id FROM users WHERE email = $1 AND role = $2',
    [String(studentEmail).trim().toLowerCase(), 'student']
  );
  if (!student.rows.length) {
    return res.status(404).json({ error: 'Student not found.' });
  }

  await query(
    `
      INSERT INTO course_enrollments (course_id, student_id)
      VALUES ($1, $2)
      ON CONFLICT (course_id, student_id) DO NOTHING
    `,
    [req.params.id, student.rows[0].id]
  );

  return res.status(201).json({ ok: true });
});

router.get('/questions', async (req, res) => {
  const { subject, type, difficulty, search } = req.query;
  const result = await query(
    `
      SELECT *
      FROM question_bank
      WHERE creator_id = $1
        AND ($2::text IS NULL OR subject = $2)
        AND ($3::text IS NULL OR type = $3)
        AND ($4::int IS NULL OR difficulty = $4)
        AND (
          $5::text IS NULL
          OR prompt ILIKE '%' || $5 || '%'
          OR topic ILIKE '%' || $5 || '%'
        )
      ORDER BY created_at DESC
    `,
    [
      req.auth.sub,
      subject || null,
      type || null,
      difficulty ? Number(difficulty) : null,
      search || null,
    ]
  );

  return res.json({ questions: result.rows });
});

router.post('/questions', async (req, res) => {
  const {
    type,
    prompt,
    choices,
    correct,
    explanation,
    subject,
    topic,
    difficulty,
    tags,
    infoBox,
    graph,
    orderingItems,
    acceptedAnswers,
    placeholderText,
    blankDefinitions,
    blankTemplate,
    matchingPairs,
  } = req.body || {};

  if (!type || !prompt || !subject || !topic || !difficulty) {
    return res.status(400).json({ error: 'type, prompt, subject, topic, and difficulty are required.' });
  }

  const inserted = await query(
    `
      INSERT INTO question_bank (
        creator_id, type, prompt, choices, correct_answer, explanation, subject, topic, difficulty, tags,
        info_box, graph, ordering_items, accepted_answers, placeholder_text, blank_definitions, blank_template, matching_pairs
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *
    `,
    [
      req.auth.sub,
      type,
      prompt,
      choices ? JSON.stringify(choices) : null,
      JSON.stringify(correct ?? null),
      explanation || null,
      subject,
      topic,
      Number(difficulty),
      tags || [],
      infoBox ? JSON.stringify(infoBox) : null,
      graph ? JSON.stringify(graph) : null,
      orderingItems ? JSON.stringify(orderingItems) : null,
      acceptedAnswers ? JSON.stringify(acceptedAnswers) : null,
      placeholderText || null,
      blankDefinitions ? JSON.stringify(blankDefinitions) : null,
      blankTemplate || null,
      matchingPairs ? JSON.stringify(matchingPairs) : null,
    ]
  );

  return res.status(201).json({ question: inserted.rows[0] });
});

router.put('/questions/:id', async (req, res) => {
  const payload = req.body || {};
  const updated = await query(
    `
      UPDATE question_bank
      SET
        type = COALESCE($3, type),
        prompt = COALESCE($4, prompt),
        choices = COALESCE($5, choices),
        correct_answer = COALESCE($6, correct_answer),
        explanation = COALESCE($7, explanation),
        subject = COALESCE($8, subject),
        topic = COALESCE($9, topic),
        difficulty = COALESCE($10, difficulty),
        tags = COALESCE($11, tags),
        info_box = COALESCE($12, info_box),
        graph = COALESCE($13, graph),
        ordering_items = COALESCE($14, ordering_items),
        accepted_answers = COALESCE($15, accepted_answers),
        placeholder_text = COALESCE($16, placeholder_text),
        blank_definitions = COALESCE($17, blank_definitions),
        blank_template = COALESCE($18, blank_template),
        matching_pairs = COALESCE($19, matching_pairs),
        updated_at = NOW()
      WHERE id = $1 AND creator_id = $2
      RETURNING *
    `,
    [
      req.params.id,
      req.auth.sub,
      payload.type || null,
      payload.prompt || null,
      payload.choices ? JSON.stringify(payload.choices) : null,
      payload.correct !== undefined ? JSON.stringify(payload.correct) : null,
      payload.explanation || null,
      payload.subject || null,
      payload.topic || null,
      payload.difficulty ? Number(payload.difficulty) : null,
      payload.tags || null,
      payload.infoBox ? JSON.stringify(payload.infoBox) : null,
      payload.graph ? JSON.stringify(payload.graph) : null,
      payload.orderingItems ? JSON.stringify(payload.orderingItems) : null,
      payload.acceptedAnswers ? JSON.stringify(payload.acceptedAnswers) : null,
      payload.placeholderText || null,
      payload.blankDefinitions ? JSON.stringify(payload.blankDefinitions) : null,
      payload.blankTemplate || null,
      payload.matchingPairs ? JSON.stringify(payload.matchingPairs) : null,
    ]
  );

  if (!updated.rows.length) {
    return res.status(404).json({ error: 'Question not found.' });
  }

  return res.json({ question: updated.rows[0] });
});

router.delete('/questions/:id', async (req, res) => {
  await query('DELETE FROM question_bank WHERE id = $1 AND creator_id = $2', [req.params.id, req.auth.sub]);
  return res.json({ ok: true });
});

router.get('/tests', async (req, res) => {
  const result = await query(
    `
      SELECT
        t.*,
        c.name AS course_name,
        COUNT(tq.id)::int AS question_count
      FROM tests t
      LEFT JOIN courses c ON c.id = t.course_id
      LEFT JOIN test_questions tq ON tq.test_id = t.id
      WHERE t.creator_id = $1
      GROUP BY t.id, c.name
      ORDER BY t.created_at DESC
    `,
    [req.auth.sub]
  );
  return res.json({ tests: result.rows });
});

router.post('/tests', async (req, res) => {
  const { name, courseId, description, timeLimitSeconds, questionIds, dueDate } = req.body || {};
  if (!name || !courseId || !timeLimitSeconds) {
    return res.status(400).json({ error: 'name, courseId, and timeLimitSeconds are required.' });
  }

  const created = await withTransaction(async (client) => {
    const testInsert = await client.query(
      `
        INSERT INTO tests (creator_id, course_id, name, description, time_limit_seconds, due_date)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [req.auth.sub, courseId, name, description || null, Number(timeLimitSeconds), dueDate || null]
    );

    const test = testInsert.rows[0];
    const ids = Array.isArray(questionIds) ? questionIds : [];
    for (const [index, questionId] of ids.entries()) {
      const questionRow = await client.query('SELECT id, subject FROM question_bank WHERE id = $1', [questionId]);
      if (!questionRow.rows.length) continue;
      await client.query(
        `
          INSERT INTO test_questions (test_id, question_id, position, section_number, section_title)
          VALUES ($1, $2, $3, 1, $4)
        `,
        [test.id, questionId, index, questionRow.rows[0].subject]
      );
    }

    await client.query(
      `
        INSERT INTO course_tests (course_id, test_id)
        VALUES ($1, $2)
        ON CONFLICT (course_id, test_id) DO NOTHING
      `,
      [courseId, test.id]
    );

    return test;
  });

  return res.status(201).json({ test: created });
});

router.put('/tests/:id', async (req, res) => {
  const { name, description, timeLimitSeconds, status, questionIds, dueDate } = req.body || {};
  const updated = await withTransaction(async (client) => {
    const testUpdate = await client.query(
      `
        UPDATE tests
        SET
          name = COALESCE($3, name),
          description = COALESCE($4, description),
          time_limit_seconds = COALESCE($5, time_limit_seconds),
          status = COALESCE($6, status),
          due_date = COALESCE($7, due_date),
          updated_at = NOW()
        WHERE id = $1 AND creator_id = $2
        RETURNING *
      `,
      [req.params.id, req.auth.sub, name || null, description || null, timeLimitSeconds ? Number(timeLimitSeconds) : null, status || null, dueDate || null]
    );

    if (!testUpdate.rows.length) return null;

    if (Array.isArray(questionIds)) {
      await client.query('DELETE FROM test_questions WHERE test_id = $1', [req.params.id]);
      for (const [index, questionId] of questionIds.entries()) {
        const questionRow = await client.query('SELECT id, subject FROM question_bank WHERE id = $1', [questionId]);
        if (!questionRow.rows.length) continue;
        await client.query(
          `
            INSERT INTO test_questions (test_id, question_id, position, section_number, section_title)
            VALUES ($1, $2, $3, 1, $4)
          `,
          [req.params.id, questionId, index, questionRow.rows[0].subject]
        );
      }
    }

    return testUpdate.rows[0];
  });

  if (!updated) {
    return res.status(404).json({ error: 'Test not found.' });
  }

  return res.json({ test: updated });
});

router.delete('/tests/:id', async (req, res) => {
  await query('DELETE FROM tests WHERE id = $1 AND creator_id = $2', [req.params.id, req.auth.sub]);
  return res.json({ ok: true });
});

router.post('/tests/:id/publish', async (req, res) => {
  const result = await query(
    `
      UPDATE tests
      SET status = 'published', published_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND creator_id = $2
      RETURNING *
    `,
    [req.params.id, req.auth.sub]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: 'Test not found.' });
  }

  return res.json({ test: result.rows[0] });
});

router.get('/tests/:id/results', async (req, res) => {
  const [test, distribution, perQuestion, students] = await Promise.all([
    getTestWithQuestions(req.params.id, false),
    query(
      `
        SELECT
          width_bucket(score_percent, 0, 100, 5) AS bucket,
          COUNT(*)::int AS count
        FROM student_attempts
        WHERE test_id = $1 AND status = 'submitted'
        GROUP BY bucket
        ORDER BY bucket
      `,
      [req.params.id]
    ),
    query(
      `
        SELECT
          sa.question_position,
          ROUND(AVG(CASE WHEN sa.is_correct THEN 1 ELSE 0 END) * 100)::int AS correct_rate
        FROM student_answers sa
        JOIN student_attempts a ON a.id = sa.attempt_id
        WHERE a.test_id = $1 AND a.status = 'submitted'
        GROUP BY sa.question_position
        ORDER BY sa.question_position
      `,
      [req.params.id]
    ),
    query(
      `
        SELECT
          a.id AS attempt_id,
          u.name AS student_name,
          u.email,
          a.score_percent,
          a.submitted_at
        FROM student_attempts a
        JOIN users u ON u.id = a.student_id
        WHERE a.test_id = $1 AND a.status = 'submitted'
        ORDER BY a.score_percent DESC, u.name
      `,
      [req.params.id]
    ),
  ]);

  return res.json({
    test,
    distribution: distribution.rows,
    perQuestion: perQuestion.rows,
    students: students.rows,
  });
});

router.get('/students', async (req, res) => {
  const search = req.query.search || null;
  const result = await query(
    `
      SELECT DISTINCT
        u.id,
        u.name,
        u.email,
        u.student_id,
        COUNT(DISTINCT ce.course_id)::int AS course_count
      FROM users u
      JOIN course_enrollments ce ON ce.student_id = u.id
      JOIN courses c ON c.id = ce.course_id
      WHERE c.teacher_id = $1
        AND ($2::text IS NULL OR u.name ILIKE '%' || $2 || '%')
      GROUP BY u.id
      ORDER BY u.name
    `,
    [req.auth.sub, search]
  );
  return res.json({ students: result.rows });
});

router.get('/students/:id/history', async (req, res) => {
  const result = await query(
    `
      SELECT
        sa.id,
        sa.score_percent,
        sa.submitted_at,
        t.name AS test_name,
        c.name AS course_name
      FROM student_attempts sa
      JOIN tests t ON t.id = sa.test_id
      LEFT JOIN courses c ON c.id = sa.course_id
      WHERE sa.student_id = $1 AND sa.status = 'submitted'
      ORDER BY sa.submitted_at DESC
    `,
    [req.params.id]
  );

  return res.json({ attempts: result.rows });
});

module.exports = router;
