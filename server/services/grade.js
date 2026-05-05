/**
 * Shared grading helpers that mirror the existing exam engine formats.
 */
'use strict';

function normalizeNumeric(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (text.includes('/')) {
    const [numerator, denominator] = text.split('/').map(Number);
    if (!Number.isNaN(numerator) && !Number.isNaN(denominator) && denominator !== 0) {
      return String(numerator / denominator);
    }
  }

  const numeric = Number(text);
  return Number.isNaN(numeric) ? text.toLowerCase().replace(/\s+/g, '') : String(numeric);
}

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\/g, '')
    .replace(/\{|\}/g, '')
    .replace(/\s+/g, '');
}

function stableArray(value) {
  return Array.isArray(value) ? [...value].sort((a, b) => String(a).localeCompare(String(b))) : [];
}

function isQuestionCorrect(question, answer) {
  switch (question.type) {
    case 'multiple_choice':
    case 'graph_line':
      return answer === question.correct;
    case 'select_multiple':
    case 'ordering':
      return JSON.stringify(stableArray(answer)) === JSON.stringify(stableArray(question.correct));
    case 'numeric':
    case 'short_response':
      return (question.acceptedAnswers || []).some((expected) => normalizeNumeric(expected) === normalizeNumeric(answer));
    case 'fill_blank':
      return (question.blanks || []).every((blank) =>
        (blank.acceptedAnswers || []).some((expected) => normalizeText(expected) === normalizeText(answer?.[blank.id]))
      );
    case 'matching': {
      const normalized = stableArray(Object.entries(answer || {}).map(([key, value]) => `${key}:${value}`));
      const expected = stableArray((question.correct || []).map((value, index) => `${index}:${value}`));
      return JSON.stringify(normalized) === JSON.stringify(expected);
    }
    case 'hotspot': {
      const point = answer || {};
      if (typeof point.x !== 'number' || typeof point.y !== 'number' || !question.graph) return false;
      const tolerance = question.graph.tolerance || 0.75;
      return (
        Math.abs(point.x - Number(question.graph.correctX)) <= tolerance &&
        Math.abs(point.y - Number(question.graph.correctY)) <= tolerance
      );
    }
    default:
      return false;
  }
}

function gradeAttempt(questions, answersByPosition) {
  let correct = 0;
  let answered = 0;

  const perQuestion = questions.map((question, index) => {
    const answer = answersByPosition[index];
    const hasAnswer = answer !== undefined && answer !== null && !(typeof answer === 'string' && !answer.trim());
    const isCorrect = hasAnswer ? isQuestionCorrect(question, answer) : false;
    if (hasAnswer) answered += 1;
    if (isCorrect) correct += 1;

    return {
      position: index,
      questionId: question.id,
      answer,
      isCorrect,
      explanation: question.explanation || '',
    };
  });

  return {
    correct,
    answered,
    total: questions.length,
    scorePercent: questions.length ? Math.round((correct / questions.length) * 100) : 0,
    perQuestion,
  };
}

module.exports = {
  gradeAttempt,
  isQuestionCorrect,
};
