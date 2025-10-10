import React from 'react';
import type { FollowUpQuestion } from '../../types';
import { useQuestionLogic } from '../../hooks/useQuestionLogic';

interface ConditionalQuestionProps {
  question: FollowUpQuestion;
  parentAnswer: any;
  renderQuestion: (question: FollowUpQuestion) => React.ReactNode;
}

export default function ConditionalQuestion({
  question,
  parentAnswer,
  renderQuestion,
}: ConditionalQuestionProps) {
  const { evaluateCondition } = useQuestionLogic();

  if (!question.showWhen) return null;

  const shouldShow = evaluateCondition(parentAnswer, question.showWhen.value);

  if (!shouldShow) return null;

  return (
    <div className="ml-6 mt-4 pl-4 border-l-2 border-blue-200 dark:border-blue-800">
      {renderQuestion(question)}
    </div>
  );
}