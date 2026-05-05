/**
 * Query helpers that shape tests and attempts into exam-engine payloads.
 */
'use strict';

const { query } = require('../db');

function normalizeQuestionRow(row) {
  return {
    id: row.question_id,
    section: row.section_number,
    sectionTitle: row.section_title,
    type: row.type,
    prompt: row.prompt,
    choices: row.choices,
    correct: row.correct_answer,
    explanation: row.explanation,
    subject: row.subject,
    topic: row.topic,
    difficulty: row.difficulty,
    tags: row.tags || [],
    info_box: row.info_box || [],
    graph: row.graph,
    items: row.ordering_items,
    acceptedAnswers: row.accepted_answers,
    placeholder: row.placeholder_text,
    blanks: row.blank_definitions,
    template: row.blank_template,
    pairs: row.matching_pairs,
  };
}

async function getTestQuestions(testId, forStudent = false) {
  const result = await query(
    `
      SELECT
        tq.position,
        qb.id AS question_id,
        tq.section_number,
        tq.section_title,
        qb.type,
        qb.prompt,
        qb.choices,
        CASE WHEN $2::boolean THEN qb.correct_answer ELSE qb.correct_answer END AS correct_answer,
        qb.explanation,
        qb.subject,
        qb.topic,
        qb.difficulty,
        qb.tags,
        qb.info_box,
        qb.graph,
        qb.ordering_items,
        qb.accepted_answers,
        qb.placeholder_text,
        qb.blank_definitions,
        qb.blank_template,
        qb.matching_pairs
      FROM test_questions tq
      JOIN question_bank qb ON qb.id = tq.question_id
      WHERE tq.test_id = $1
      ORDER BY tq.position ASC
    `,
    [testId, forStudent]
  );

  return result.rows.map(normalizeQuestionRow);
}

async function getTestWithQuestions(testId, forStudent = false) {
  const testResult = await query(
    `
      SELECT
        t.id,
        t.name,
        t.description,
        t.time_limit_seconds,
        t.shuffle_questions,
        t.status,
        c.id AS course_id,
        c.name AS course_name
      FROM tests t
      LEFT JOIN courses c ON c.id = t.course_id
      WHERE t.id = $1
    `,
    [testId]
  );

  if (!testResult.rows.length) return null;

  return {
    ...testResult.rows[0],
    questions: await getTestQuestions(testId, forStudent),
  };
}

module.exports = {
  getTestQuestions,
  getTestWithQuestions,
};
