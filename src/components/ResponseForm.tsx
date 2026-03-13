import React, { useState, useEffect } from "react";
import { Send, ArrowLeft, AlertCircle } from "lucide-react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import type { Question, Response, FollowUpQuestion } from "../types";
import QuestionRenderer from "./QuestionRenderer";
import { useQuestionLogic } from "../hooks/useQuestionLogic";
import ThankYouMessage from "./ThankYouMessage";
import { responsesApi } from "../api/storage";
import ParentResponseSelector from "./ParentResponseSelector";
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
    case "slider-feedback":
      return "7";
    case "emoji-star-feedback":
      return "4";
    case "emoji-reaction-feedback":
      return "4";
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

const isValidFileInput = (value: any): boolean => {
  if (!value) return false;
  
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && parsed.url && parsed.location) {
        return !!parsed.url;
      }
    } catch {
    }
    return value.trim().length > 0;
  }
  
  return false;
};

interface ResponseFormProps {
  questions?: Question[];
  onSubmit?: (response: Response) => void;
}

export default function ResponseForm({
  questions: propQuestions,
  onSubmit,
}: ResponseFormProps) {
  const { id, tenantSlug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [selectedParentResponse, setSelectedParentResponse] =
    useState<Response | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getOrderedVisibleQuestions } = useQuestionLogic();
  const [showDuplicateMessage, setShowDuplicateMessage] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{ isDuplicate: boolean; email: string }>({
    isDuplicate: false,
    email: ''
  });

  // Derived sections logic
  const allFormSections = React.useMemo(() => {
    const rawSections =
      form?.sections && form.sections.length > 0
        ? form.sections
        : [
            {
              id: "default",
              title: form?.title || "",
              description: form?.description || "",
              questions: form?.followUpQuestions || [],
            },
          ];

    // Flatten sections to handle nested follow-up questions
    return rawSections.map((section: any) => {
      const allQuestions: any[] = [];

      const flattenQuestions = (questions: any[], parentId?: string) => {
        questions.forEach((question: any) => {
          const { followUpQuestions, ...mainQuestion } = question;
          
          if (parentId && !mainQuestion.showWhen) {
            mainQuestion.showWhen = {
              questionId: parentId,
              value: "", 
            };
          }
          
          allQuestions.push(mainQuestion);

          if (followUpQuestions && followUpQuestions.length > 0) {
            flattenQuestions(followUpQuestions, question.id);
          }
        });
      };

      flattenQuestions(section.questions || []);

      return {
        ...section,
        id: section.id || section._id,
        questions: allQuestions,
      };
    });
  }, [form]);

  const getAvailableSections = () => {
    if (!allFormSections || !Array.isArray(allFormSections)) {
      return [];
    }

    const baseSections: typeof allFormSections = [];
    const linkedSections: typeof allFormSections = [];

    for (const section of allFormSections) {
      if (!section) continue;

      if (!section.linkedToOption && !section.linkedToQuestionId) {
        baseSections.push(section);
      } else {
        const allQuestions = allFormSections
          .flatMap((s) => s?.questions || [])
          .filter((q) => q && !q.showWhen);

        for (const question of allQuestions) {
          const answer = answers[question.id];
          if (
            answer &&
            question.followUpConfig?.[answer]?.linkedSectionId === section.id
          ) {
            linkedSections.push(section);
            break;
          }
        }
      }
    }

    const result: typeof allFormSections = [];
    const addedSectionIds = new Set<string>();

    for (const baseSection of baseSections) {
      result.push(baseSection);
      addedSectionIds.add(baseSection.id);

      const questionsInSection = (baseSection.questions || []).filter(
        (q) => q && !q.showWhen
      );

      for (const question of questionsInSection) {
        const answer = answers[question.id];
        if (answer && question.followUpConfig?.[answer]?.linkedSectionId) {
          const linkedSectionId = question.followUpConfig[answer].linkedSectionId;
          const linkedSection = linkedSections.find(
            (s) => s && s.id === linkedSectionId && !addedSectionIds.has(s.id)
          );
          if (linkedSection) {
            result.push(linkedSection);
            addedSectionIds.add(linkedSection.id);
          }
        }
      }
    }

    // Add any linked sections that were not added sequentially
    for (const linkedSection of linkedSections) {
      if (!addedSectionIds.has(linkedSection.id)) {
        result.push(linkedSection);
        addedSectionIds.add(linkedSection.id);
      }
    }

    // Group subsections into their parent sections
    const sectionsMap = new Map<string, any>();
    const rootSections: any[] = [];

    // Initialize map
    result.forEach((section) => {
      sectionsMap.set(section.id, { ...section, subsections: [] });
    });

    // Build hierarchy
    result.forEach((section) => {
      const mappedSection = sectionsMap.get(section.id);
      
      // Robust check for subsection
      const isSub = section.isSubsection === true || 
                   section.isSubsection === 'true' || 
                   (section.parentSectionId && section.parentSectionId !== '');

      if (
        isSub &&
        section.parentSectionId &&
        sectionsMap.has(section.parentSectionId)
      ) {
        const parent = sectionsMap.get(section.parentSectionId);
        parent.subsections.push(mappedSection);
      } else {
        rootSections.push(mappedSection);
      }
    });

    const finalResult = rootSections;

    // If viewType is question-wise, split each section into multiple virtual sections (one per question)
    if (form?.viewType === "question-wise") {
      const virtualSections: any[] = [];
      finalResult.forEach((section, sIdx) => {
        // Collect all questions including from subsections
        const allQuestions = [...(section.questions || [])];
        if (section.subsections && Array.isArray(section.subsections)) {
          section.subsections.forEach((sub: any) => {
            allQuestions.push(...(sub.questions || []));
          });
        }

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
            totalOriginalSections: finalResult.length,
            questionIndex: 0,
            totalQuestionsInSection: 0,
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
              totalOriginalSections: finalResult.length,
              questionIndex: qIdx,
              totalQuestionsInSection: visibleQuestions.length,
            });
          });
        }
      });
      return virtualSections;
    }

    return finalResult;
  };

  const formSections = getAvailableSections();

  // Fetch form from backend
  useEffect(() => {
    const fetchForm = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const inviteId = searchParams.get('inviteId');
        
        let response;
        if (inviteId) {
          response = await apiClient.getPublicForm(id, tenantSlug);
          setForm(response.form || response);
        } else {
          response = await apiClient.getFormById(id);
          setForm(response.form);
        }
        
        setError(null);
      } catch (err: any) {
        console.error("Error fetching form:", err);
        setError(err.message || "Failed to load form");
      } finally {
        setLoading(false);
      }
    };

    fetchForm();
  }, [id, searchParams, tenantSlug]);

  useEffect(() => {
    if (selectedParentResponse) {
      setAnswers({});
    }
  }, [selectedParentResponse]);
  
  useEffect(() => {
    if (!form || !formSections) return;
    
    if (currentSectionIndex >= formSections.length && formSections.length > 0) {
      setCurrentSectionIndex(formSections.length - 1);
    }
  }, [formSections.length, currentSectionIndex]);

  const question = form;
  const isChildForm = question?.parentFormId !== undefined;
  const parentForm = null;

  const findLinkedFormInAnswers = (): string | null => {
    const checkQuestionRecursively = (
      q: any,
      answers: Record<string, any>
    ): string | null => {
      const answer = answers[q.id];
      
      if (answer && q.followUpConfig?.[answer]?.linkedFormId) {
        return q.followUpConfig[answer].linkedFormId;
      }

      if (
        q.followUpQuestions &&
        Array.isArray(q.followUpQuestions) &&
        answer
      ) {
        for (const followUp of q.followUpQuestions) {
          if (
            followUp.showWhen?.questionId === q.id &&
            followUp.showWhen?.value === answer
          ) {
            const result = checkQuestionRecursively(followUp, answers);
            if (result) return result;
          }
        }
      }

      return null;
    };

    for (const section of allFormSections) {
      for (const q of section.questions) {
        if (!q.showWhen) {
          const result = checkQuestionRecursively(q, answers);
          if (result) return result;
        }
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let isValid = true;
    formSections.forEach((section) => {
      // Collect all questions including from subsections
      const allQuestions = [...(section.questions || [])];
      if (section.subsections && Array.isArray(section.subsections)) {
        section.subsections.forEach((sub: any) => {
          allQuestions.push(...(sub.questions || []));
        });
      }

      const visibleQuestions = getOrderedVisibleQuestions(
        allQuestions,
        answers
      );
      const hasRequiredAnswers = visibleQuestions.every((q) => {
        if (!q.required) return true;
        
        if (q.type === "file") {
          return isValidFileInput(answers[q.id]);
        }
        
        return answers[q.id];
      });
      if (!hasRequiredAnswers) {
        isValid = false;
      }
    });

    if (!isValid) {
      alert(
        "Please fill in all required fields in all sections before submitting."
      );
      return;
    }

    const response: Response = {
      id: crypto.randomUUID(),
      questionId: question.id,
      answers,
      timestamp: new Date().toISOString(),
      parentResponseId: selectedParentResponse?.id,
      submissionMetadata: {
        source: 'internal'
      }
    };

    try {
      const submitData: any = { ...response };

      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 5000,
              maximumAge: 0
            });
          });

          submitData.location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            source: 'browser'
          };
        } catch (geoErr) {
          console.warn("Geolocation not available:", geoErr);
        }
      }

      const inviteId = searchParams.get('inviteId');
      
      if (inviteId) {
        try {
          await apiClient.submitPublicResponse(question.id, {
            inviteId,
            answers: submitData.answers,
            location: submitData.location
          });
          setSubmitted(true);
        } catch (err: any) {
          console.error("Error submitting response:", err);
          if (err.response?.message === 'ALREADY_SUBMITTED' || err.message?.includes('already been used')) {
            const email = err.response?.data?.email || '';
            setDuplicateInfo({
              isDuplicate: true,
              email: email
            });
            setShowDuplicateMessage(true);
          } else {
            alert("Failed to submit response. Please try again.");
          }
        }
      } else {
        await apiClient.submitResponse(question.id, submitData);
        
        const linkedFormId = findLinkedFormInAnswers();
        if (linkedFormId) {
          setTimeout(() => {
            navigate(`/forms/${linkedFormId}/respond?parentResponse=${response.id}`);
          }, 500);
          return;
        }

        if (onSubmit) {
          onSubmit(response);
        }
        setSubmitted(true);
      }
    } catch (err: any) {
      console.error("Error submitting response:", err);
      if (!err.response?.message?.includes('ALREADY_SUBMITTED')) {
        alert("Failed to submit response. Please try again.");
      }
    }
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleNext = () => {
    const currentSection = formSections[currentSectionIndex];
    if (!currentSection) return;

    // Collect all questions including from subsections
    const allQuestions = [...(currentSection.questions || [])];
    if (currentSection.subsections && Array.isArray(currentSection.subsections)) {
      currentSection.subsections.forEach((sub: any) => {
        allQuestions.push(...(sub.questions || []));
      });
    }

    const visibleQuestions = getOrderedVisibleQuestions(
      allQuestions,
      answers
    );
    const hasRequiredAnswers = visibleQuestions.every(
      (q) => !q.required || answers[q.id]
    );

    if (!hasRequiredAnswers) {
      alert(
        "Please fill in all required fields in this section before proceeding."
      );
      return;
    }

    if (currentSectionIndex + 1 < formSections.length) {
      setCurrentSectionIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrevious = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleLoadSampleAnswers = () => {
    const allQuestions: FollowUpQuestion[] = [];
    formSections.forEach((section) => {
      (section.questions || []).forEach((item) => {
        allQuestions.push(item);
      });
      if (section.subsections) {
        section.subsections.forEach((sub: any) => {
          (sub.questions || []).forEach((item: any) => {
            allQuestions.push(item);
          });
        });
      }
    });

    const questionMap = new Map<string, FollowUpQuestion>();
    allQuestions.forEach((item) => {
      questionMap.set(item.id, item);
    });

    const sampleAnswers: Record<string, any> = {};
    allQuestions.forEach((item) => {
      sampleAnswers[item.id] = createSampleAnswer(item);
    });

    setAnswers(sampleAnswers);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 p-12">
            <div className="flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600 mb-4"></div>
              <span className="text-primary-600 font-medium">Loading form...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-6">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-primary-800 mb-4">Form Not Found</h2>
            <p className="text-primary-600 mb-8 max-w-md mx-auto">
              {error || "The form you're looking for doesn't exist or has been removed."}
            </p>
            <button onClick={() => navigate("/forms")} className="btn-primary">
              Return to Forms
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return <ThankYouMessage />;
  }

  if (showDuplicateMessage) {
    return <ThankYouMessage isDuplicate={true} email={duplicateInfo.email} />;
  }

  const currentSection = formSections[currentSectionIndex];
  const isLastSection = currentSectionIndex === formSections.length - 1;
  const isFirstSection = currentSectionIndex === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="group flex items-center text-primary-600 hover:text-primary-800 mb-8 transition-colors font-medium"
        >
          <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Forms
        </button>

        <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
          <div className="p-8 border-b border-neutral-100 bg-white/50 backdrop-blur-sm">
            <h1 className="text-3xl font-bold text-primary-900 mb-4">
              {question.title}
            </h1>
            {question.description && (
              <p className="text-primary-600 text-lg leading-relaxed">
                {question.description}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-8">
            {/* Progress Bar */}
            {formSections.length > 1 && (
              <div className="mb-12 pb-6 border-b border-neutral-100">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold text-primary-700">
                    Section {currentSectionIndex + 1} of {formSections.length}
                  </span>
                  <span className="text-sm font-bold text-primary-600">
                    {Math.round(((currentSectionIndex + 1) / formSections.length) * 100)}% Complete
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {formSections.map((_, idx) => (
                    <div
                      key={idx}
                      className="flex-1 h-2.5 rounded-full overflow-hidden bg-neutral-100 border border-neutral-200"
                    >
                      <div
                        className={`h-full transition-all duration-500 ${
                          idx === currentSectionIndex
                            ? "bg-primary-600 animate-pulse"
                            : idx < currentSectionIndex
                            ? "bg-green-500"
                            : "bg-transparent"
                        }`}
                      />
                    </div>
                  ))}
                </div>
                {formSections.length > 1 && (
                  <p className="text-xs text-primary-500 mt-3 font-medium italic">
                    Note: Subsections are grouped within their parent sections for a better experience.
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end mb-8">
              <button
                type="button"
                onClick={handleLoadSampleAnswers}
                className="inline-flex items-center px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors font-medium text-sm border border-primary-200"
              >
                Load Sample Answers
              </button>
            </div>

            {/* Current Section Content */}
            <div className="space-y-12">
              {/* Section Header */}
              {currentSection.title !== question.title && (
                <div className="mb-8 pb-6 border-b border-neutral-100">
                  <h2 className="text-2xl font-bold text-primary-800 mb-2">
                    {currentSection.title}
                  </h2>
                  {currentSection.description && (
                    <p className="text-primary-600 leading-relaxed">
                      {currentSection.description}
                    </p>
                  )}
                </div>
              )}

              {/* Main Section Questions */}
              <div className="space-y-8">
                {getOrderedVisibleQuestions(currentSection.questions, answers).map((q) => (
                  <div
                    key={q.id}
                    className={`${
                      q.showWhen
                        ? "ml-6 pl-6 border-l-4 border-primary-200 bg-primary-50/30 py-4 rounded-r-lg"
                        : ""
                    }`}
                  >
                    <QuestionRenderer
                      question={q}
                      value={answers[q.id]}
                      onChange={(value) => handleAnswerChange(q.id, value)}
                    />
                  </div>
                ))}
              </div>

              {/* Subsections Rendering */}
              {currentSection.subsections &&
                currentSection.subsections.length > 0 &&
                currentSection.subsections.map((sub: any) => (
                  <div key={sub.id} className="mt-12 pt-8 border-t border-neutral-200">
                    <div className="mb-8">
                      <h3 className="text-xl font-bold text-primary-800 mb-2">
                        {sub.title}
                      </h3>
                      {sub.description && (
                        <p className="text-primary-600 text-sm leading-relaxed">
                          {sub.description}
                        </p>
                      )}
                    </div>
                    <div className="space-y-8">
                      {getOrderedVisibleQuestions(sub.questions, answers).map((q) => (
                        <div
                          key={q.id}
                          className={`${
                            q.showWhen
                              ? "ml-6 pl-6 border-l-4 border-primary-200 bg-primary-50/30 py-4 rounded-r-lg"
                              : ""
                          }`}
                        >
                          <QuestionRenderer
                            question={q}
                            value={answers[q.id]}
                            onChange={(value) => handleAnswerChange(q.id, value)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-neutral-100">
              {!isFirstSection ? (
                <button
                  type="button"
                  onClick={handlePrevious}
                  className="flex items-center px-6 py-3 bg-neutral-100 text-primary-700 rounded-xl hover:bg-neutral-200 transition-colors font-medium border border-neutral-200"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Previous
                </button>
              ) : (
                <div />
              )}

              {!isLastSection ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex items-center px-8 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all font-bold shadow-lg shadow-primary-600/30 hover:shadow-primary-600/40 active:scale-95"
                >
                  Next Section
                  <ArrowLeft className="w-5 h-5 ml-2 rotate-180" />
                </button>
              ) : (
                <button
                  type="submit"
                  className="flex items-center px-10 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-bold shadow-lg shadow-green-600/30 hover:shadow-green-600/40 active:scale-95"
                >
                  <Send className="w-5 h-5 mr-2" />
                  Submit Response
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
