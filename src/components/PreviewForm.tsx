import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import type { Question, Response, Section, FollowUpQuestion } from "../types";
import { useQuestionLogic } from "../hooks/useQuestionLogic";
import ThankYouMessage from "./ThankYouMessage";
import FormHeader from "./preview/FormHeader";
import SectionProgress from "./preview/SectionProgress";
import SectionContent from "./preview/SectionContent";
import NavigationButtons from "./preview/NavigationButtons";
import { apiClient } from "../api/client";

const SAMPLE_IMAGE_DATA =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==";

const getSampleText = (question: FollowUpQuestion) => {
  const cleaned = question.text?.replace(/[*:]/g, "").trim();
  return cleaned ? `Sample ${cleaned}` : "Sample answer";
};

const createSampleAnswer = (question: FollowUpQuestion): any => {
  const sampleText = getSampleText(question);

  switch (question.type) {
    case "text":
    case "paragraph":
      return sampleText;
    case "email":
      return "sample@example.com";
    case "url":
      return "https://example.com";
    case "tel":
      return "+1234567890";
    case "yesNoNA":
    case "radio":
      return question.options?.[0] ?? sampleText;
    case "checkbox":
      if (question.options?.length) {
        const values = question.options.slice(
          0,
          Math.min(2, question.options.length)
        );
        return values.length ? values : [sampleText];
      }
      return [sampleText];
    case "search-select":
      return question.options?.[0] ?? sampleText;
    case "date":
      return new Date().toISOString().split("T")[0];
    case "time":
      return "12:00";
    case "file":
      if (question.allowedFileTypes?.includes("image")) {
        return SAMPLE_IMAGE_DATA;
      }
      return "Sample file uploaded";
    case "range": {
      const min = question.min ?? 0;
      const max = question.max ?? min + 10;
      const step = question.step && question.step > 0 ? question.step : 1;
      const steps = Math.floor((max - min) / step);
      const value = min + step * Math.floor(steps / 2);
      return Math.min(max, value).toString();
    }
    case "rating": {
      const min = question.min ?? 1;
      const max = question.max ?? Math.max(min, 5);
      const value = Math.max(min, Math.min(max, min === max ? min : min + 1));
      return value.toString();
    }
    case "scale": {
      const min = question.min ?? 0;
      const max = question.max ?? 10;
      const step = question.step && question.step > 0 ? question.step : 1;
      const steps = Math.floor((max - min) / step);
      const value = min + step * Math.floor(steps / 2);
      return Math.min(max, value).toString();
    }
    case "radio-grid": {
      const value: Record<string, string> = {};
      const rows = question.gridOptions?.rows ?? [];
      const column = question.gridOptions?.columns?.[0] ?? "";
      rows.forEach((row) => {
        value[row] = column;
      });
      return value;
    }
    case "checkbox-grid": {
      const value: Record<string, string[]> = {};
      const rows = question.gridOptions?.rows ?? [];
      const column = question.gridOptions?.columns?.[0];
      rows.forEach((row) => {
        value[row] = column ? [column] : [];
      });
      return value;
    }
    case "radio-image":
      return question.options?.[0] ?? "";
    default:
      return sampleText;
  }
};

const normalizeTriggerValue = (
  question: FollowUpQuestion | undefined,
  value: any
) => {
  if (value === undefined || value === null) {
    return value;
  }
  if (!question) {
    return value;
  }
  if (question.type === "checkbox") {
    return Array.isArray(value) ? value : [value];
  }
  return value;
};

interface PreviewFormProps {
  questions: Question[];
  onSubmit: (response: Response) => void;
  branchingRules?: any[];
}

export default function PreviewForm({
  questions,
  onSubmit,
  branchingRules: propBranchingRules = [],
}: PreviewFormProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [branchingAlert, setBranchingAlert] = useState<string | null>(null);
  const [visitedSectionIndices, setVisitedSectionIndices] = useState<
    Set<number>
  >(new Set([0]));
  const [sectionNavigationHistory, setSectionNavigationHistory] = useState<
    number[]
  >([0]);
  const [linkedFollowUpForm, setLinkedFollowUpForm] = useState<string | null>(
    null
  );
  const [parentSectionIndex, setParentSectionIndex] = useState<number | null>(null);
  const { getOrderedVisibleQuestions } = useQuestionLogic();

  const branchingRules = propBranchingRules;
  const question = questions.find((q) => q.id === id);

  useEffect(() => {
    console.log("=== PreviewForm Debug ===");
    console.log("Branching rules received:", branchingRules);
    console.log("Number of branching rules:", branchingRules.length);
    if (branchingRules.length > 0) {
      console.log("First rule:", branchingRules[0]);
    }
  }, [branchingRules]);

  if (!question) {
    return (
      <div className="w-full bg-gradient-to-br from-blue-50 via-white to-blue-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 text-center">
            Form Preview
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6 text-center">
            See how your form will appear to users
          </p>
          <div className="max-w-md mx-auto bg-red-50 border border-red-200 rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-red-800">
              Form Not Found
            </h2>
            <p className="text-sm text-red-600">
              The form you're looking for doesn't exist or may have been
              removed.
            </p>
            <button
              onClick={() => navigate("/forms")}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
            >
              Return to Forms
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    if (linkedFollowUpForm) {
      return (
        <div className="w-full bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center py-6 sm:py-12 px-4 sm:px-6 min-h-screen">
          <div className="max-w-2xl w-full bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Form Submitted!
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Your response has been recorded successfully.
              </p>

              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
                <div className="flex items-start gap-3 mb-4">
                  <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                  <div className="text-left">
                    <h3 className="font-semibold text-blue-900 mb-2">
                      Follow-up Form Detected
                    </h3>
                    <p className="text-sm text-blue-800 mb-4">
                      Based on your answer, there is a linked follow-up form. In
                      the live customer form, users would be automatically
                      redirected to the next form.
                    </p>
                    <div className="bg-white dark:bg-gray-900 rounded-md p-3 border border-blue-200">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Linked Form ID:
                      </p>
                      <p className="font-mono text-sm text-gray-900 dark:text-gray-100">
                        {linkedFollowUpForm}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    console.log(
                      "[Preview Follow-up] Navigating to form ID:",
                      linkedFollowUpForm
                    );
                    navigate(`/forms/${linkedFollowUpForm}/preview`);
                  }}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <span>Preview Follow-up Form</span>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>

              <button
                onClick={() => navigate("/forms")}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:text-gray-200 font-medium transition-colors"
              >
                Back to Forms
              </button>
            </div>
          </div>
        </div>
      );
    }
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

  // Get sections that are linked in branching rules (section isolation)
  const getLinkedSectionIds = (): Set<string> => {
    const linkedIds = new Set<string>();
    branchingRules.forEach((rule) => {
      linkedIds.add(rule.targetSectionId);
    });
    return linkedIds;
  };

  // Get next sequential section (skipping linked sections)
  const getNextSequentialSectionIndex = (currentIndex: number): number => {
    const linkedSectionIds = getLinkedSectionIds();
    let nextIndex = currentIndex + 1;

    while (nextIndex < sections.length) {
      if (!linkedSectionIds.has(sections[nextIndex].id)) {
        return nextIndex;
      }
      nextIndex++;
    }

    return -1;
  };

  const hasMissingRequiredAnswers = () => {
    let missing = false;
    visitedSectionIndices.forEach((sectionIndex) => {
      const section = sections[sectionIndex];
      if (!section) {
        return;
      }
      const visibleQuestions = getOrderedVisibleQuestions(
        section.questions,
        answers
      );
      const hasRequiredAnswers = visibleQuestions.every(
        (q) => !q.required || answers[q.id]
      );
      if (!hasRequiredAnswers) {
        missing = true;
      }
    });
    return missing;
  };

  const checkForBranching = (
    sectionId: string,
    questionId: string,
    answerValue: any
  ) => {
    const matchingRules = branchingRules.filter(
      (rule) => rule.sectionId === sectionId && rule.questionId === questionId
    );

    console.log(`  Checking: sectionId=${sectionId}, questionId=${questionId}`);
    console.log(`  Matching rules found: ${matchingRules.length}`);
    if (matchingRules.length > 0) {
      console.log("  Rules:", matchingRules);
    }

    for (const rule of matchingRules) {
      console.log(
        `  Evaluating rule: optionLabel="${rule.optionLabel}", isOther=${rule.isOtherOption}, answer="${answerValue}"`
      );

      if (
        rule.isOtherOption &&
        answerValue &&
        typeof answerValue === "string"
      ) {
        const exactMatchExists = branchingRules.some(
          (r) =>
            r.sectionId === sectionId &&
            r.questionId === questionId &&
            !r.isOtherOption &&
            (answerValue === r.optionLabel ||
              answerValue.toLowerCase() === r.optionLabel.toLowerCase())
        );
        console.log(
          `    "Other" option, exact match exists: ${exactMatchExists}`
        );
        if (!exactMatchExists) {
          console.log("    ✓ Returning Other rule");
          return rule;
        }
      } else if (
        answerValue === rule.optionLabel ||
        (typeof answerValue === "string" &&
          answerValue.toLowerCase() === rule.optionLabel.toLowerCase())
      ) {
        console.log("    ✓ Match found!");
        return rule;
      }
    }
    console.log("  No matching rule");
    return null;
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();

    if (hasMissingRequiredAnswers()) {
      alert("Please fill in all required fields before submitting.");
      return;
    }

    const response: Response = {
      id: crypto.randomUUID(),
      questionId: question.id,
      answers,
      timestamp: new Date().toISOString(),
    };

    // Check for follow-up forms - works exactly like follow-up sections
    // Loop through all questions and check if any answer has a linkedFormId
    console.log("[Follow-up Form Detection] Checking all questions...");

    for (const section of sections) {
      const questionsInSection = section.questions || [];

      for (const q of questionsInSection) {
        const answer = answers[q.id];

        if (answer && q.followUpConfig?.[answer]?.linkedFormId) {
          const linkedFormId = q.followUpConfig[answer].linkedFormId;
          console.log(
            `[Follow-up Form] Found! Question: ${q.id}, Answer: ${answer}, Linked Form: ${linkedFormId}`
          );

          // Store the linked form ID to show in the thank you message
          setLinkedFollowUpForm(linkedFormId);
          onSubmit(response);
          setSubmitted(true);
          return;
        }
      }
    }

    console.log("[Follow-up Form] No linked forms found");
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

    console.log("=== handleNext Debug ===");
    console.log("Current section ID:", currentSection.id);
    console.log("Current section title:", currentSection.title);
    console.log(
      "Visible questions:",
      visibleQuestions.map((q) => ({ id: q.id, text: q.text }))
    );
    console.log("Answers:", answers);
    console.log("Branching rules available:", branchingRules.length);

    for (const question of visibleQuestions) {
      const answerValue = answers[question.id];
      console.log(
        `Checking question: ${question.id} (${question.text}) with answer: ${answerValue}`
      );

      const branchingRule = checkForBranching(
        currentSection.id,
        question.id,
        answerValue
      );
      console.log(`Branching rule found: `, branchingRule);

      if (branchingRule) {
        const targetSectionIndex = sections.findIndex(
          (s) => s.id === branchingRule.targetSectionId
        );
        console.log(
          `Target section index: ${targetSectionIndex}, Target ID: ${branchingRule.targetSectionId}`
        );

        if (targetSectionIndex !== -1) {
          const targetSectionTitle =
            sections[targetSectionIndex]?.title || "Next Section";
          console.log(
            `Navigating to section: ${targetSectionTitle} (index: ${targetSectionIndex})`
          );
          setBranchingAlert(`Navigating to: ${targetSectionTitle}`);
          setTimeout(() => {
            setCurrentSectionIndex(targetSectionIndex);
            setVisitedSectionIndices((prev) =>
              new Set(prev).add(targetSectionIndex)
            );
            setSectionNavigationHistory((prev) => [
              ...prev,
              targetSectionIndex,
            ]);
            setParentSectionIndex(currentSectionIndex);
            setBranchingAlert(null);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }, 500);
          return;
        }
      }
    }

    console.log(
      "No branching rule matched, proceeding to next section normally"
    );
    
    const nextIndex = getNextSequentialSectionIndex(currentSectionIndex);
    
    if (nextIndex !== -1) {
      console.log(`Moving to next available section (skipping linked sections): index ${nextIndex}`);
      setCurrentSectionIndex(nextIndex);
      setVisitedSectionIndices((prev) => new Set(prev).add(nextIndex));
      setSectionNavigationHistory((prev) => [...prev, nextIndex]);
      setParentSectionIndex(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrevious = () => {
    console.log(
      "[handlePrevious] Current navigation history:",
      sectionNavigationHistory
    );
    console.log("[handlePrevious] Current section index:", currentSectionIndex);
    console.log("[handlePrevious] Parent section index:", parentSectionIndex);

    // If we came from a branched section, go back to the parent
    if (parentSectionIndex !== null) {
      console.log(
        "[handlePrevious] Going back to parent section (branching origin):",
        parentSectionIndex
      );
      setCurrentSectionIndex(parentSectionIndex);
      setParentSectionIndex(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (sectionNavigationHistory.length > 1) {
      const newHistory = [...sectionNavigationHistory];
      newHistory.pop();

      const previousSectionIndex = newHistory[newHistory.length - 1];
      console.log(
        "[handlePrevious] Going back to section index:",
        previousSectionIndex
      );

      setSectionNavigationHistory(newHistory);
      setCurrentSectionIndex(previousSectionIndex);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      console.log("[handlePrevious] Already at first section in history");
    }
  };

  const handleLoadSampleAnswers = () => {
    const allQuestions: FollowUpQuestion[] = [];
    sections.forEach((section) => {
      (section.questions || []).forEach((item) => {
        allQuestions.push(item);
      });
    });

    const questionMap = new Map<string, FollowUpQuestion>();
    allQuestions.forEach((item) => {
      questionMap.set(item.id, item);
    });

    const sampleAnswers: Record<string, any> = {};
    
    // First pass: create sample answers for all questions
    allQuestions.forEach((item) => {
      sampleAnswers[item.id] = createSampleAnswer(item);
    });

    // Second pass: for questions with branching rules, try to select an option that triggers branching
    allQuestions.forEach((item) => {
      if (item.branchingRules && item.branchingRules.length > 0) {
        console.log(`[Sample Data] Question "${item.text}" has ${item.branchingRules.length} branching rule(s)`);
        // Use the first branching rule's option as the sample answer
        const firstRule = item.branchingRules[0];
        sampleAnswers[item.id] = firstRule.optionLabel;
        console.log(`[Sample Data] Set answer to "${firstRule.optionLabel}" to trigger branching`);
      }
    });

    // Third pass: handle follow-up visibility conditions
    allQuestions.forEach((item) => {
      const condition = item.showWhen;
      if (!condition?.questionId) {
        return;
      }
      if (condition.value === undefined || condition.value === null) {
        return;
      }
      const parentQuestion = questionMap.get(condition.questionId);
      const normalizedValue = normalizeTriggerValue(
        parentQuestion,
        condition.value
      );
      if (normalizedValue !== undefined) {
        sampleAnswers[condition.questionId] = normalizedValue;
      }
    });

    console.log("[Sample Data] Final sample answers:", sampleAnswers);
    setAnswers(sampleAnswers);
  };

  const currentSection = sections[currentSectionIndex];
  const nextAvailableIndex = getNextSequentialSectionIndex(currentSectionIndex);
  // isLastSection is true only if we're at the absolute last section with no more sections after
  const isLastSection = currentSectionIndex === sections.length - 1;
  const isFirstSection = sectionNavigationHistory.length <= 1;
  const submitDisabled = hasMissingRequiredAnswers();

  return (
    <div className="w-full bg-gradient-to-br from-blue-50 via-white to-blue-50 py-6 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
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
              currentSection={Array.from(visitedSectionIndices)
                .sort()
                .indexOf(currentSectionIndex)}
              totalSections={visitedSectionIndices.size}
              visitedCount={visitedSectionIndices.size}
              totalCount={sections.length}
            />
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleLoadSampleAnswers}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Load Sample Answers
            </button>
          </div>

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
            submitDisabled={submitDisabled}
          />
        </form>
      </div>
    </div>
  );
}
