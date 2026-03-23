import React, { useState, useEffect, useRef } from "react";
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
  onSubmit: (response: Response) => Promise<void> | void;
  branchingRules?: any[];
  viewType?: "section-wise" | "question-wise";
  // NEW props for tracking
  onQuestionChange?: (
    questionId: string,
    questionText: string,
    questionType: string,
    sectionId: string,
    sectionTitle: string,
    answer?: any
  ) => void;
  onSectionComplete?: (
    sectionId: string,
    sectionTitle: string,
    timeSpentSeconds: number,
    questionCount: number
  ) => void;
  formSessionId?: string | null;
}

export default function PreviewForm({
  questions,
  onSubmit,
  branchingRules: propBranchingRules = [],
  viewType = "section-wise",
  // NEW props
  onQuestionChange,
  onSectionComplete,
  formSessionId
}: PreviewFormProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { getOrderedVisibleQuestions } = useQuestionLogic();
  const isMounted = useRef(true);

  const [previousQuestionId, setPreviousQuestionId] = useState<string | null>(null);
  const [sectionStartTime, setSectionStartTime] = useState<Date>(new Date());
  const [sectionQuestionCount, setSectionQuestionCount] = useState(0);

   




  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

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

  // Group subsections into their parent sections
  const groupedSections = React.useMemo(() => {
    // 1. Initial list of sections (flattened)
    const baseSections: Section[] =
      question.sections?.length > 0
        ? question.sections.map((s: any) => ({
            ...s,
            id: s.id || s._id,
            isSubsection: s.isSubsection,
            parentSectionId: s.parentSectionId,
          }))
        : [
            {
              id: "default",
              title: question.title,
              description: question.description,
              questions: question.followUpQuestions || [],
            },
          ];

    // 2. Handle question-wise view
    if (viewType === "question-wise") {
      const virtualSections: any[] = [];
      baseSections.forEach((section, sIdx) => {
        const allQuestions = [...(section.questions || [])];
        // Note: For question-wise, we might want to include questions from subsections too
        // but for now let's keep it simple as the user is using section-wise.
        
        const visibleQuestions = getOrderedVisibleQuestions(
          allQuestions,
          answers
        );

        if (visibleQuestions.length === 0) {
          virtualSections.push({
            ...section,
            questions: [],
            isVirtual: true,
            originalSectionId: section.id,
            originalSectionIndex: sIdx,
            totalOriginalSections: baseSections.length,
            questionIndex: 0,
            totalQuestionsInSection: 0
          });
        } else {
          visibleQuestions.forEach((q, qIdx) => {
            virtualSections.push({
              ...section,
              id: `${section.id}_v${qIdx}`,
              title: section.title,
              description: qIdx === 0 ? section.description : "",
              questions: [q],
              isVirtual: true,
              originalSectionId: section.id,
              originalSectionIndex: sIdx,
              totalOriginalSections: baseSections.length,
              questionIndex: qIdx,
              totalQuestionsInSection: visibleQuestions.length
            });
          });
        }
      });
      return virtualSections;
    }

    // 3. Handle section-wise grouping (hierarchy)
    const sectionsMap = new Map<string, any>();
    const rootSections: any[] = [];

    // Initialize map
    baseSections.forEach((section) => {
      sectionsMap.set(section.id, { ...section, subsections: [] });
    });

    // Build hierarchy
    baseSections.forEach((section) => {
      const mappedSection = sectionsMap.get(section.id);
      
      const parentId = section.parentSectionId;
      const isSub = section.isSubsection === true || 
                   section.isSubsection === 'true' || 
                   (parentId && parentId !== '');

      if (isSub && parentId) {
        // Find parent by ID or _ID
        const parent = sectionsMap.get(parentId) || 
                       Array.from(sectionsMap.values()).find(s => s._id === parentId);
                       
        if (parent) {
          parent.subsections.push(mappedSection);
        } else {
          // Parent not found yet
          rootSections.push(mappedSection);
        }
      } else {
        rootSections.push(mappedSection);
      }
    });

    return rootSections;
  }, [question, viewType, answers]);

  let sections = groupedSections;
  const currentSection = sections[currentSectionIndex];

  // Get sections that are linked in branching rules (section isolation)
  const getLinkedSectionIds = (): Set<string> => {
    const linkedIds = new Set<string>();
    branchingRules.forEach((rule) => {
      linkedIds.add(rule.targetSectionId);
    });
    // Also consider sections linked via section-level direct link
    sections.forEach(section => {
      if (section.nextSectionId && section.nextSectionId !== 'end') {
        linkedIds.add(section.nextSectionId);
      }
      // Also consider sections that are subsections (they should be reached via branching/links)
      if (section.parentSectionId || section.isSubsection) {
        linkedIds.add(section.id);
      }
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

  const checkSectionRequiredAnswers = (section: any): boolean => {
    if (!section) return true;
    
    // Check main questions
    const visibleQuestions = getOrderedVisibleQuestions(
      section.questions || [],
      answers
    );
    const hasRequiredAnswers = visibleQuestions.every(
      (q) => !q.required || answers[q.id || q._id]
    );
    if (!hasRequiredAnswers) return false;

    // Check subsections
    if (section.subsections && section.subsections.length > 0) {
      const allSubsectionsValid = section.subsections.every((sub: any) => 
        checkSectionRequiredAnswers(sub)
      );
      if (!allSubsectionsValid) return false;
    }

    return true;
  };

  const hasMissingRequiredAnswers = () => {
    let missing = false;
    visitedSectionIndices.forEach((sectionIndex) => {
      const section = sections[sectionIndex];
      if (!section) return;
      
      if (!checkSectionRequiredAnswers(section)) {
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

  const handleSubmit = async (e?: React.FormEvent) => {
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

        if (answer && q.followUpConfig) {
          let linkedFormId: string | null = null;
          if (Array.isArray(answer)) {
            for (const val of answer) {
              if (q.followUpConfig[val]?.linkedFormId) {
                linkedFormId = q.followUpConfig[val].linkedFormId;
                break;
              }
            }
          } else if (q.followUpConfig[answer]?.linkedFormId) {
            linkedFormId = q.followUpConfig[answer].linkedFormId;
          }

          if (linkedFormId) {
            console.log(
              `[Follow-up Form] Found! Question: ${q.id}, Answer: ${answer}, Linked Form: ${linkedFormId}`
            );

            // Store the linked form ID to show in the thank you message
            setLinkedFollowUpForm(linkedFormId);

            try {
              setIsSubmitting(true);
              await onSubmit(response);
              if (isMounted.current) setSubmitted(true);
            } catch (error) {
              console.error("Submission failed:", error);
            } finally {
              if (isMounted.current) setIsSubmitting(false);
            }
            return;
          }
        }
      }
    }

    console.log("[Follow-up Form] No linked forms found");
    
    try {
      setIsSubmitting(true);
      await onSubmit(response);
      if (isMounted.current) setSubmitted(true);
    } catch (error) {
      console.error("Submission failed:", error);
      // Don't set submitted(true) if submission failed
    } finally {
      if (isMounted.current) setIsSubmitting(false);
    }
  };

   const handleAnswerChange = (questionId: string, value: any) => {
    // If this is the first time answering this question, track it
    if (!answers[questionId] && value && onQuestionChange && currentSection) {
      const question = currentSection.questions?.find((q: any) => q.id === questionId);
      if (question) {
        onQuestionChange(
          questionId,
          question.text || "Unknown Question",
          question.type || "unknown",
          currentSection.id,
          currentSection.title || "Untitled Section",
          value
        );
      }
    }

    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };


  const transitionToSection = (index: number) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentSectionIndex(index);
      setIsTransitioning(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 400); // Match transition duration
  };

  const handleNext = () => {
    const currentSection = sections[currentSectionIndex];
    
    // Check for required answers in current section and its subsections
    if (!checkSectionRequiredAnswers(currentSection)) {
      alert("Please fill in all required fields before moving to the next section.");
      return;
    }
    if (onSectionComplete && formSessionId) {
      const timeSpentSeconds = Math.floor(
        (new Date().getTime() - sectionStartTime.getTime()) / 1000
      );
      
      // Count questions in this section (including subsections)
      let questionCount = currentSection.questions?.length || 0;
      if (currentSection.subsections) {
        currentSection.subsections.forEach((sub: any) => {
          questionCount += sub.questions?.length || 0;
        });
      }

      onSectionComplete(
        currentSection.id,
        currentSection.title || "Untitled Section",
        timeSpentSeconds,
        questionCount
      );
    }

    // Reset section timer for next section
    setSectionStartTime(new Date());


    // Collect all visible questions from main section and subsections to check branching
    const allQuestionsToProcess = [...(currentSection.questions || [])];
    if (currentSection.subsections) {
      currentSection.subsections.forEach((sub: any) => {
        allQuestionsToProcess.push(...(sub.questions || []));
      });
    }

    const visibleQuestions = getOrderedVisibleQuestions(
      allQuestionsToProcess,
      answers
    );

    console.log("=== handleNext Debug ===");
    console.log("Current section ID:", currentSection.id);
    console.log("Current section title:", currentSection.title);
    console.log(
      "Visible questions (including subsections):",
      visibleQuestions.map((q) => ({ id: q.id, text: q.text }))
    );
    console.log("Answers:", answers);
    console.log("Branching rules available:", branchingRules.length);

    for (const question of visibleQuestions) {
      const answerValue = answers[question.id || question._id];
      if (answerValue === undefined) continue;
      
      console.log(
        `Checking question: ${question.id || question._id} (${question.text}) with answer: ${answerValue}`
      );

      const branchingRule = checkForBranching(
        currentSection.id,
        question.id || question._id,
        answerValue
      );
      
      // Also check if branching rule is associated with a subsection ID but triggered here
      // However, usually branching rules are tied to the main section ID or the specific subsection ID.
      // If we are grouping, we should probably check if any rule matches this questionId regardless of sectionId,
      // or check all sectionIds in the group.
      
      let finalRule = branchingRule;
      if (!finalRule && currentSection.subsections) {
        for (const sub of currentSection.subsections) {
          const subRule = checkForBranching(sub.id, question.id || question._id, answerValue);
          if (subRule) {
            finalRule = subRule;
            break;
          }
        }
      }

      if (finalRule) {
        if (finalRule.targetSectionId === 'end') {
          console.log("Branching set to 'end', submitting");
          handleSubmit(new Event("submit") as any);
          return;
        }

        const targetSectionIndex = sections.findIndex(
          (s) => s.id === finalRule.targetSectionId
        );
        console.log(
          `Target section index: ${targetSectionIndex}, Target ID: ${finalRule.targetSectionId}`
        );

        if (targetSectionIndex !== -1) {
          const targetSectionTitle =
            sections[targetSectionIndex]?.title || "Next Section";
          console.log(
            `Navigating to section: ${targetSectionTitle} (index: ${targetSectionIndex})`
          );
          setBranchingAlert(`Navigating to: ${targetSectionTitle}`);
          setTimeout(() => {
            transitionToSection(targetSectionIndex);
            setVisitedSectionIndices((prev) =>
              new Set(prev).add(targetSectionIndex)
            );
            setSectionNavigationHistory((prev) => [
              ...prev,
              targetSectionIndex,
            ]);
            setParentSectionIndex(currentSectionIndex);
            setBranchingAlert(null);
          }, 500);
          return;
        }
      }
    }

    console.log(
      "No branching rule matched, checking section-level navigation"
    );

    if (currentSection.nextSectionId) {
      if (currentSection.nextSectionId === "end") {
        console.log("Section navigation set to 'end', submitting");
        handleSubmit(new Event("submit") as any);
        return;
      }

      const targetSectionIndex = sections.findIndex(
        (s) => s.id === currentSection.nextSectionId
      );

      if (targetSectionIndex !== -1) {
        console.log(
          `Section-level navigation found! Target section index: ${targetSectionIndex}`
        );
        transitionToSection(targetSectionIndex);
        setVisitedSectionIndices((prev) => new Set(prev).add(targetSectionIndex));
        setSectionNavigationHistory((prev) => [...prev, targetSectionIndex]);
        setParentSectionIndex(currentSectionIndex);
        return;
      } else {
        console.error(
          `Target section ID ${currentSection.nextSectionId} not found`
        );
      }
    }
    
    const nextIndex = getNextSequentialSectionIndex(currentSectionIndex);
    
    if (nextIndex !== -1) {
      console.log(`Moving to next available section (skipping linked sections): index ${nextIndex}`);
      transitionToSection(nextIndex);
      setVisitedSectionIndices((prev) => new Set(prev).add(nextIndex));
      setSectionNavigationHistory((prev) => [...prev, nextIndex]);
      setParentSectionIndex(null);
    }
  };

  useEffect(() => {
    if (viewType === "question-wise" && currentSection && onQuestionChange) {
      const currentQuestion = currentSection.questions?.[0];
      if (currentQuestion && currentQuestion.id !== previousQuestionId) {
        onQuestionChange(
          currentQuestion.id,
          currentQuestion.text || "Unknown Question",
          currentQuestion.type || "unknown",
          currentSection.id,
          currentSection.title || "Untitled Section"
        );
        setPreviousQuestionId(currentQuestion.id);
      }
    }
  }, [currentSectionIndex, viewType, currentSection, onQuestionChange]);
  
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
      transitionToSection(parentSectionIndex);
      setParentSectionIndex(null);
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
      transitionToSection(previousSectionIndex);
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

  const nextAvailableIndex = getNextSequentialSectionIndex(currentSectionIndex);
  // isLastSection is true only if we're at the absolute last section with no more sections after
  const isLastSection = (() => {
    if (!currentSection) return true;

    // 1. Explicitly marked as end
    if (currentSection.nextSectionId && currentSection.nextSectionId.toLowerCase() === 'end') return true;

    // 2. Check if any currently active branching rule for this section points to 'end'
    const allQuestions = [...(currentSection.questions || [])];
    if (currentSection.subsections) {
      currentSection.subsections.forEach((sub: any) => {
        allQuestions.push(...(sub.questions || []));
      });
    }

    const visibleQuestions = getOrderedVisibleQuestions(allQuestions, answers);
    for (const q of visibleQuestions) {
      const qId = q.id || q._id;
      const answer = answers[qId];
      if (answer !== undefined && answer !== null) {
        // Check rules for main section
        let rule = branchingRules.find(r => 
          r.sectionId === currentSection.id && 
          r.questionId === qId && 
          (r.optionLabel === answer || (typeof answer === 'string' && r.optionLabel?.toLowerCase() === answer.toLowerCase()) || (r.isOtherOption && !q.options?.includes(answer)))
        );

        // Check rules for subsections if not found
        if (!rule && currentSection.subsections) {
          for (const sub of currentSection.subsections) {
             rule = branchingRules.find(r => 
              r.sectionId === sub.id && 
              r.questionId === qId && 
              (r.optionLabel === answer || (typeof answer === 'string' && r.optionLabel?.toLowerCase() === answer.toLowerCase()) || (r.isOtherOption && !q.options?.includes(answer)))
            );
            if (rule) break;
          }
        }

        if (rule?.targetSectionId && rule.targetSectionId.toLowerCase() === 'end') return true;
      }
    }

    // 3. Sequential check (if no branching/navigation override)
    const nextSequentialIndex = getNextSequentialSectionIndex(currentSectionIndex);
    const hasNextSequential = nextSequentialIndex !== -1;
    const hasBranchingToSection = allQuestions.some(q => {
      const qId = q.id || q._id;
      return branchingRules.some(rule => 
        (rule.sectionId === currentSection.id || (currentSection.subsections?.some((s:any) => s.id === rule.sectionId))) && 
        rule.questionId === qId && 
        rule.targetSectionId && 
        rule.targetSectionId.toLowerCase() !== 'end'
      );
    });
    const hasDirectLink = !!currentSection.nextSectionId && 
                         currentSection.nextSectionId.toLowerCase() !== 'end' &&
                         sections.some(s => s.id === currentSection.nextSectionId);
    
    return !hasNextSequential && !hasBranchingToSection && !hasDirectLink;
  })();

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
              currentSection={currentSectionIndex}
              totalSections={sections.length}
              visitedCount={visitedSectionIndices.size}
              totalCount={sections.length}
              viewType={viewType}
              sectionTitle={currentSection.title}
              questionIndex={currentSection.questionIndex}
              totalQuestionsInSection={currentSection.totalQuestionsInSection}
              originalSectionIndex={currentSection.originalSectionIndex}
              totalOriginalSections={currentSection.totalOriginalSections}
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

          <div
            className={`transition-all duration-400 transform ${
              isTransitioning ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
            }`}
          >
            <SectionContent
              section={currentSection}
              formTitle={question.title}
              answers={answers}
              onAnswerChange={handleAnswerChange}
            />
          </div>

          <NavigationButtons
            isFirstSection={isFirstSection}
            isLastSection={isLastSection}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onSubmit={handleSubmit}
            submitDisabled={submitDisabled}
            isSubmitting={isSubmitting}
          />
        </form>
      </div>
    </div>
  );
}