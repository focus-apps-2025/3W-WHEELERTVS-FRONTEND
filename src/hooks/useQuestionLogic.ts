import type { FollowUpQuestion } from "../types";

export function useQuestionLogic() {
  const getOrderedVisibleQuestions = (
    questions: FollowUpQuestion[],
    answers: Record<string, any>
  ): FollowUpQuestion[] => {
    console.log("=== getOrderedVisibleQuestions called ===");
    console.log("Total questions:", questions.length);
    console.log("Current answers:", answers);

    const orderedQuestions: FollowUpQuestion[] = [];
    const mainQuestions = questions.filter((q) => !q.showWhen);

    console.log("Main questions (no showWhen):", mainQuestions.length);
    console.log(
      "Follow-up questions (with showWhen):",
      questions.filter((q) => q.showWhen).length
    );

    // Process each main question and its follow-ups
    mainQuestions.forEach((question) => {
      orderedQuestions.push(question);

      // If this question has an answer that might trigger follow-ups
      if (answers[question.id]) {
        const followUps = questions.filter(
          (q) => q.showWhen && q.showWhen.questionId === question.id
        );

        console.log(
          `Question "${question.text}" (${question.id}) has answer:`,
          answers[question.id]
        );
        console.log(
          `Found ${followUps.length} potential follow-ups for this question`
        );

        followUps.forEach((followUp) => {
          const shouldShow = evaluateCondition(
            answers[question.id],
            followUp.showWhen?.value
          );
          console.log(
            `Follow-up "${followUp.text}" - showWhen value: "${followUp.showWhen?.value}", shouldShow: ${shouldShow}`
          );

          if (shouldShow) {
            orderedQuestions.push(followUp);
          }
        });
      }
    });

    console.log("Final ordered questions:", orderedQuestions.length);
    return orderedQuestions;
  };

  const evaluateCondition = (answer: any, condition: any): boolean => {
    if (!answer) return false;

    if (Array.isArray(answer)) {
      return answer.includes(condition);
    }

    if (typeof answer === "object") {
      return Object.values(answer).includes(condition);
    }

    return answer === condition;
  };

  const getFollowUpQuestions = (
    questions: FollowUpQuestion[],
    parentId: string
  ): FollowUpQuestion[] => {
    return questions.filter(
      (q) => q.showWhen && q.showWhen.questionId === parentId
    );
  };

  return {
    getOrderedVisibleQuestions,
    getFollowUpQuestions,
    evaluateCondition,
  };
}
