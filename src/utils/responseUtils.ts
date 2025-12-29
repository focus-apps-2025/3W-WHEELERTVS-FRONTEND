import type { Question, Response } from "../types";

export function getResponseSummary(
  response: Response,
  question: Question
): string {
  return (
    Object.entries(response.answers)
      .slice(0, 2)
      .map(([id, answer]) => {
        const questionItem = question.followUpQuestions.find(
          (q) => q.id === id
        );
        return questionItem
          ? `${questionItem.text}: ${
              Array.isArray(answer) ? answer.join(", ") : answer
            }`
          : "";
      })
      .filter(Boolean)
      .join(" | ") + (Object.keys(response.answers).length > 2 ? "..." : "")
  );
}
