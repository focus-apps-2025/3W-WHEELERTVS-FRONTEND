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

    // Recursive function to process a question and all its nested follow-ups
    const processQuestionAndFollowUps = (questionId: string) => {
      // Find all direct follow-ups for this question
      const followUps = questions.filter(
        (q) => q.showWhen && q.showWhen.questionId === questionId
      );

      console.log(
        `Processing follow-ups for question ${questionId}, found ${followUps.length} potential follow-ups`
      );

      followUps.forEach((followUp) => {
        // Check if this follow-up should be shown based on the answer
        const parentAnswer = answers[questionId];
        const shouldShow = evaluateCondition(
          parentAnswer,
          followUp.showWhen?.value
        );

        console.log(
          `Follow-up "${followUp.text}" - parent answer: "${parentAnswer}", showWhen value: "${followUp.showWhen?.value}", shouldShow: ${shouldShow}`
        );

        if (shouldShow) {
          orderedQuestions.push(followUp);

          // Recursively process nested follow-ups if this follow-up has an answer
          if (answers[followUp.id]) {
            console.log(
              `Follow-up "${followUp.text}" has an answer, checking for nested follow-ups...`
            );
            processQuestionAndFollowUps(followUp.id);
          }
        }
      });
    };

    // Process each main question and its follow-ups recursively
    mainQuestions.forEach((question) => {
      orderedQuestions.push(question);

      // If this question has an answer that might trigger follow-ups
      if (answers[question.id]) {
        console.log(
          `Question "${question.text}" (${question.id}) has answer:`,
          answers[question.id]
        );
        processQuestionAndFollowUps(question.id);
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
