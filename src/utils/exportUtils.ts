import { utils, writeFile } from 'xlsx';
import type { Question, Response } from '../types';

export function exportResponsesToExcel(responses: Response[], question: Question) {
  const data = responses.map((response) => {
    const row: Record<string, string> = {
      Timestamp: new Date(response.timestamp).toLocaleString(),
    };

    // Get all questions from sections or fallback to followUpQuestions
    const allQuestions = question.sections.length > 0
      ? question.sections.flatMap(section => section.questions)
      : question.followUpQuestions;

    allQuestions.forEach((q) => {
      const answer = response.answers[q.id];
      row[q.text] = Array.isArray(answer) ? answer.join(', ') : answer;
    });

    return row;
  });

  const ws = utils.json_to_sheet(data);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Responses');
  writeFile(wb, `responses-${question.id}.xlsx`);
}