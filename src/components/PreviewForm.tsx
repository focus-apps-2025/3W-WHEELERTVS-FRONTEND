import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import type { Question, Response, Section } from "../types";
import { useQuestionLogic } from "../hooks/useQuestionLogic";
import ThankYouMessage from "./ThankYouMessage";
import FormHeader from "./preview/FormHeader";
import SectionProgress from "./preview/SectionProgress";
import SectionContent from "./preview/SectionContent";
import NavigationButtons from "./preview/NavigationButtons";
import { apiClient } from "../api/client";

interface PreviewFormProps {
  questions: Question[];
  onSubmit: (response: Response) => void;
  branchingRules?: any[];
}

export default function PreviewForm({ questions, onSubmit, branchingRules: propBranchingRules = [] }: PreviewFormProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [branchingAlert, setBranchingAlert] = useState<string | null>(null);
  const [visitedSectionIndices, setVisitedSectionIndices] = useState<Set<number>>(new Set([0]));
  const { getOrderedVisibleQuestions } = useQuestionLogic();
  
  const branchingRules = propBranchingRules;
  const question = questions.find((q) => q.id === id);

  useEffect(() => {
    console.log('=== PreviewForm Debug ===');
    console.log('Branching rules received:', branchingRules);
    console.log('Number of branching rules:', branchingRules.length);
    if (branchingRules.length > 0) {
      console.log('First rule:', branchingRules[0]);
    }
  }, [branchingRules]);

  if (!question) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Form Preview</h1>
        <p className="text-gray-600 mb-6">
          See how your form will appear to users
        </p>
        <div className="max-w-md mx-auto bg-red-50 border border-red-200 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-red-800">Form Not Found</h2>
          <p className="text-sm text-red-600">
            The form you're looking for doesn't exist or may have been removed.
          </p>
          <button
            onClick={() => navigate("/forms")}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Return to Forms
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return <ThankYouMessage />;
  }

  // Initialize sections if they don't exist
  const sections: Section[] =
    question.sections?.length > 0
      ? question.sections
      : [
          {
            id: "default",
            title: question.title,
            description: question.description,
            questions: question.followUpQuestions,
          },
        ];

  const checkForBranching = (sectionId: string, questionId: string, answerValue: any) => {
    const matchingRules = branchingRules.filter(
      rule => rule.sectionId === sectionId && rule.questionId === questionId
    );
    
    console.log(`  Checking: sectionId=${sectionId}, questionId=${questionId}`);
    console.log(`  Matching rules found: ${matchingRules.length}`);
    if (matchingRules.length > 0) {
      console.log('  Rules:', matchingRules);
    }

    for (const rule of matchingRules) {
      console.log(`  Evaluating rule: optionLabel="${rule.optionLabel}", isOther=${rule.isOtherOption}, answer="${answerValue}"`);
      
      if (rule.isOtherOption && answerValue && typeof answerValue === 'string') {
        const exactMatchExists = branchingRules.some(r => 
          r.sectionId === sectionId && 
          r.questionId === questionId && 
          !r.isOtherOption && 
          (answerValue === r.optionLabel || answerValue.toLowerCase() === r.optionLabel.toLowerCase())
        );
        console.log(`    "Other" option, exact match exists: ${exactMatchExists}`);
        if (!exactMatchExists) {
          console.log('    ✓ Returning Other rule');
          return rule;
        }
      } else if (answerValue === rule.optionLabel || (typeof answerValue === 'string' && answerValue.toLowerCase() === rule.optionLabel.toLowerCase())) {
        console.log('    ✓ Match found!');
        return rule;
      }
    }
    console.log('  No matching rule');
    return null;
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();

    // Only validate sections that were actually visited (not skipped by branching)
    let isValid = true;
    visitedSectionIndices.forEach((sectionIndex) => {
      const section = sections[sectionIndex];
      if (!section) return;
      
      const visibleQuestions = getOrderedVisibleQuestions(
        section.questions,
        answers
      );
      const hasRequiredAnswers = visibleQuestions.every(
        (q) => !q.required || answers[q.id]
      );
      if (!hasRequiredAnswers) {
        isValid = false;
      }
    });

    if (!isValid) {
      alert("Please fill in all required fields before submitting.");
      return;
    }

    const response: Response = {
      id: crypto.randomUUID(),
      questionId: question.id,
      answers,
      timestamp: new Date().toISOString(),
    };
    onSubmit(response);
    setSubmitted(true);
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleNext = () => {
    const currentSection = sections[currentSectionIndex];
    const visibleQuestions = getOrderedVisibleQuestions(
      currentSection.questions,
      answers
    );

    console.log('=== handleNext Debug ===');
    console.log('Current section ID:', currentSection.id);
    console.log('Current section title:', currentSection.title);
    console.log('Visible questions:', visibleQuestions.map(q => ({ id: q.id, text: q.text })));
    console.log('Answers:', answers);
    console.log('Branching rules available:', branchingRules.length);

    for (const question of visibleQuestions) {
      const answerValue = answers[question.id];
      console.log(`Checking question: ${question.id} (${question.text}) with answer: ${answerValue}`);
      
      const branchingRule = checkForBranching(currentSection.id, question.id, answerValue);
      console.log(`Branching rule found: `, branchingRule);
      
      if (branchingRule) {
        const targetSectionIndex = sections.findIndex(s => s.id === branchingRule.targetSectionId);
        console.log(`Target section index: ${targetSectionIndex}, Target ID: ${branchingRule.targetSectionId}`);
        
        if (targetSectionIndex !== -1) {
          const targetSectionTitle = sections[targetSectionIndex]?.title || 'Next Section';
          console.log(`Navigating to section: ${targetSectionTitle} (index: ${targetSectionIndex})`);
          setBranchingAlert(`Navigating to: ${targetSectionTitle}`);
          setTimeout(() => {
            setCurrentSectionIndex(targetSectionIndex);
            setVisitedSectionIndices(prev => new Set(prev).add(targetSectionIndex));
            setBranchingAlert(null);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }, 500);
          return;
        }
      }
    }

    console.log('No branching rule matched, proceeding to next section normally');
    if (currentSectionIndex + 1 < sections.length) {
      const nextIndex = currentSectionIndex + 1;
      setCurrentSectionIndex(nextIndex);
      setVisitedSectionIndices(prev => new Set(prev).add(nextIndex));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrevious = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(currentSectionIndex - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const currentSection = sections[currentSectionIndex];
  const isLastSection = currentSectionIndex === sections.length - 1;
  const isFirstSection = currentSectionIndex === 0;

  return (
    <div className="min-h-screen bg-white py-12">
      <div className="max-w-3xl mx-auto px-6">
        {branchingAlert && (
          <div className="mb-6 flex items-center space-x-2 text-green-600 bg-green-50 border border-green-200 px-4 py-3 rounded-lg">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">{branchingAlert}</span>
          </div>
        )}

        <FormHeader
          title={question.title}
          description={question.description}
          imageUrl={question.imageUrl}
        />

        <form onSubmit={handleSubmit} className="mt-12 space-y-10">
          {sections.length > 1 && (
            <SectionProgress
              currentSection={Array.from(visitedSectionIndices).sort().indexOf(currentSectionIndex)}
              totalSections={visitedSectionIndices.size}
              visitedCount={visitedSectionIndices.size}
              totalCount={sections.length}
            />
          )}

          <SectionContent
            section={currentSection}
            formTitle={question.title}
            answers={answers}
            onAnswerChange={handleAnswerChange}
          />

          <NavigationButtons
            isFirstSection={isFirstSection}
            isLastSection={isLastSection}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onSubmit={handleSubmit}
          />
        </form>
      </div>
    </div>
  );
}
