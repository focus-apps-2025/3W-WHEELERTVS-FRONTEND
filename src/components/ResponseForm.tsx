import React, { useState, useEffect, useRef } from "react";
import { Send, ArrowLeft, AlertCircle, RefreshCw, Sparkles, Zap, AlertTriangle, CheckCircle2, Users, Clipboard } from "lucide-react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import type { Question, Response, FollowUpQuestion } from "../types";
import QuestionRenderer from "./QuestionRenderer";
import { useQuestionLogic } from "../hooks/useQuestionLogic";
import ThankYouMessage from "./ThankYouMessage";
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

export default function ResponseForm({ onSubmit }: ResponseFormProps) {
  const { id, tenantSlug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const parentResponseId = searchParams.get("parentResponseId");

  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { getOrderedVisibleQuestions } = useQuestionLogic();
  const [showDuplicateMessage, setShowDuplicateMessage] = useState(false);
  const [sessionTrackingId, setSessionTrackingId] = useState<string | null>(null);
  const [startedAt] = useState<Date>(new Date());
  const lastInteractionTime = useRef<number>(Date.now());
  const [suggestedAnswers, setSuggestedAnswers] = useState<Record<string, any> | null>(null);
  const [fetchingSuggestionsForId, setFetchingSuggestionsForId] = useState<string | null>(null);
  const [selectedRank, setSelectedRank] = useState<number | null>(null);
  const [lastSuggestionSource, setLastSuggestionSource] = useState<string | null>(null);

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

  const allFormQuestions = React.useMemo(() => {
    const getAllQuestions = (questions: any[]): any[] => {
      let all: any[] = [];
      (questions || []).forEach((q) => {
        all.push(q);
        if (q.followUpQuestions && q.followUpQuestions.length > 0) {
          all = all.concat(getAllQuestions(q.followUpQuestions));
        }
      });
      return all;
    };

    const allQs: any[] = [];
    form?.sections?.forEach((s: any) => {
      allQs.push(...getAllQuestions(s.questions));
      if (s.subsections) {
        s.subsections.forEach((ss: any) => {
          allQs.push(...getAllQuestions(ss.questions));
        });
      }
    });

    if (form?.followUpQuestions) {
      allQs.push(...getAllQuestions(form.followUpQuestions));
    }
    return allQs;
  }, [form]);

  const applySuggestions = (specificAnswers?: Record<string, any>, targetQuestionId?: string, rank?: number) => {
    const suggestionsToApply = specificAnswers || (Array.isArray(suggestedAnswers) ? suggestedAnswers[0]?.answers : suggestedAnswers);
    if (!suggestionsToApply || suggestionsToApply._no_match) return;

    if (rank !== undefined) setSelectedRank(rank);

    const effectiveTargetId = targetQuestionId || 
      (fetchingSuggestionsForId?.split(':')[0]) || 
      (lastSuggestionSource?.split(':')[0]);

    setAnswers((prev) => {
      const newAnswers = { ...prev };
      
      const normalize = (s: string) => 
        String(s || "").toLowerCase().replace(/_tracking$/, "").replace(/^_/, "").trim();

      Object.keys(suggestionsToApply).forEach((key) => {
        if (key.startsWith("_") && !key.includes("tracking")) return;

        const val = suggestionsToApply[key];
        if (val === null || val === undefined || String(val).trim() === "")
          return;

        const normalizedKey = normalize(key);

        const question = allFormQuestions.find((q) => {
          const qId = (q.id || (q as any)._id) as string;
          if (!qId) return false;
          
          return (
            qId === key ||
            qId.toLowerCase() === key.toLowerCase() ||
            normalize(qId) === normalizedKey
          );
        });

        if (question) {
          const qId = question.id || (question as any)._id;
          
          if (effectiveTargetId) {
            const normalizedTarget = normalize(effectiveTargetId);
            if (normalize(qId) !== normalizedTarget) {
              return;
            }
          }

          if (key.endsWith("_tracking")) {
            newAnswers[`${qId}_tracking`] = val;
          } else {
            newAnswers[qId] = val;
          }
        }
      });

      return newAnswers;
    });
  };

  const handleTrackingChange = async (questionId: string, searchValue: string) => {
    if (!searchValue || searchValue.trim().length < 3) {
      setSuggestedAnswers(null);
      setLastSuggestionSource(null);
      return;
    }

    if (fetchingSuggestionsForId === questionId && lastSuggestionSource?.split(':')[1] === searchValue) {
      return;
    }

    try {
      setFetchingSuggestionsForId(questionId);
      
      const result = await apiClient.getSuggestedAnswers(
        id!,
        questionId,
        searchValue,
        tenantSlug!
      );
      
      setLastSuggestionSource(`${questionId}:${searchValue}`);
      
      if (result && result.suggestedAnswers) {
        const suggestions = result.suggestedAnswers;
        const suggestionsArray = Array.isArray(suggestions) ? suggestions : [suggestions];
        const firstRecord = Array.isArray(suggestions) ? suggestions[0]?.answers : suggestions;
        
        const nonEmptyAnswersCount = Object.values(firstRecord || {}).filter(v => 
          v !== null && v !== undefined && String(v).trim() !== ""
        ).length;
        
        setSuggestedAnswers(suggestions);
        if (nonEmptyAnswersCount > 0) {
          setSelectedRank(1);
        }
      } else {
        setSuggestedAnswers({ _no_match: true });
      }
    } catch (err) {
      console.warn("[Suggestions] Failed to fetch suggestions:", err);
    } finally {
      setFetchingSuggestionsForId(null);
    }
  };

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
        const allQs: any[] = allFormSections
          .flatMap((s: any) => s?.questions || [])
          .filter((q: any) => q && !q.showWhen);

        for (const qItem of allQs) {
          const answer = answers[qItem.id];
          if (
            answer &&
            qItem.followUpConfig?.[answer]?.linkedSectionId === section.id
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
        (q: any) => q && !q.showWhen
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

    for (const linkedSection of linkedSections) {
      if (!addedSectionIds.has(linkedSection.id)) {
        result.push(linkedSection);
        addedSectionIds.add(linkedSection.id);
      }
    }

    const sectionsMap = new Map<string, any>();
    const rootSections: any[] = [];

    result.forEach((section) => {
      sectionsMap.set(section.id, { ...section, subsections: [] });
    });

    result.forEach((section) => {
      const mappedSection = sectionsMap.get(section.id);
      
      const isSub = section.isSubsection === true || 
                     section.isSubsection === 'true' || 
                     (section.parentSectionId && section.parentSectionId !== '');

      if (isSub && section.parentSectionId && sectionsMap.has(section.parentSectionId)) {
        const parent = sectionsMap.get(section.parentSectionId);
        if (parent) {
          if (!parent.subsections) parent.subsections = [];
          parent.subsections.push(mappedSection);
        }
      } else {
        rootSections.push(mappedSection);
      }
    });

    const finalResult = rootSections;

    if (form?.viewType === "question-wise") {
      const virtualSections: any[] = [];
      finalResult.forEach((section, sIdx) => {
        const allQuestions = [...(section.questions || [])];
        if (section.subsections && Array.isArray(section.subsections)) {
          section.subsections.forEach((sub: any) => {
            allQuestions.push(...(sub.questions || []));
          });
        }

        const visibleQuestions = getOrderedVisibleQuestions(allQuestions, answers);

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

  useEffect(() => {
    const fetchForm = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const inviteId = searchParams.get('inviteId');
        
        let response: any;
        if (inviteId) {
          response = await apiClient.getPublicForm(id, tenantSlug);
          setForm(response?.form || response);
        } else {
          response = await apiClient.getFormById(id);
          setForm(response?.form);
        }
        
        setError(null);

        try {
          if (response) {
            const formTitle = response.form?.title || response.title || 'Unknown Form';
            const sessionData = await apiClient.startFormSession(id, formTitle);
            if (sessionData?.sessionId) {
              setSessionTrackingId(sessionData.sessionId);
              lastInteractionTime.current = Date.now();
            }
          }
        } catch (trackErr) {
          console.warn("Failed to start tracking session:", trackErr);
        }
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
    if (!form || !formSections) return;
    
    if (currentSectionIndex >= formSections.length && formSections.length > 0) {
      setCurrentSectionIndex(formSections.length - 1);
    }
  }, [formSections.length, currentSectionIndex]);

  const findLinkedFormInAnswers = (): string | null => {
    const checkQuestionRecursively = (
      q: any,
      answers: Record<string, any>
    ): string | null => {
      const answer = answers[q.id];
      
      if (answer && q.followUpConfig?.[answer]?.linkedFormId) {
        return q.followUpConfig[answer].linkedFormId;
      }

      if (q.followUpQuestions && Array.isArray(q.followUpQuestions) && answer) {
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

  const handleAnswerChange = async (questionId: string, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));

    if (sessionTrackingId) {
      const now = Date.now();
      const timeSpent = Math.max(1, Math.floor((now - lastInteractionTime.current) / 1000));
      
      const allQs = formSections.flatMap(s => s.questions || []);
      const q = allQs.find(q => q.id === questionId);

      if (q) {
        apiClient.trackQuestionTime(form.id, {
          sessionId: sessionTrackingId,
          questionId,
          questionText: q.text || q.label || '',
          questionType: q.type,
          timeSpent,
          answer: value
        }).catch(() => {});
      }
      
      lastInteractionTime.current = now;
    }
  };

  const handleNext = () => {
    const currentSection = formSections[currentSectionIndex];
    if (!currentSection) return;

    const allQuestions = [...(currentSection.questions || [])];
    if (currentSection.subsections && Array.isArray(currentSection.subsections)) {
      currentSection.subsections.forEach((sub: any) => {
        allQuestions.push(...(sub.questions || []));
      });
    }

    const visibleQuestions = getOrderedVisibleQuestions(allQuestions, answers);
    const hasRequiredAnswers = visibleQuestions.every((q) => {
      const isMainFilled = !q.required || answers[q.id];
      const isTrackingRequired = q.trackResponseQuestion === true || String(q.trackResponseQuestion) === 'true';
      const isTrackingFilled = !isTrackingRequired || answers[`${q.id}_tracking`];
      return isMainFilled && isTrackingFilled;
    });

    if (!hasRequiredAnswers) {
      alert("Please fill in all required fields in this section before proceeding.");
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
      (section.questions || []).forEach((item: any) => {
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

    const sampleAnswers: Record<string, any> = {};
    allQuestions.forEach((item) => {
      sampleAnswers[item.id] = createSampleAnswer(item);
    });

    setAnswers(sampleAnswers);
  };

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (submitting) return;

  let isValid = true;
  formSections.forEach((section) => {
    const allQuestions = [...(section.questions || [])];
    if (section.subsections && Array.isArray(section.subsections)) {
      section.subsections.forEach((sub: any) => {
        allQuestions.push(...(sub.questions || []));
      });
    }

    const visibleQuestions = getOrderedVisibleQuestions(allQuestions, answers);
    const hasRequiredAnswers = visibleQuestions.every((q) => {
      const isMainFilled = !q.required || answers[q.id];
      const isTrackingRequired = q.trackResponseQuestion === true || String(q.trackResponseQuestion) === 'true';
      const isTrackingFilled = !isTrackingRequired || answers[`${q.id}_tracking`];
      
      if (q.type === "file") {
        return isMainFilled && isValidFileInput(answers[q.id]) && isTrackingFilled;
      }
      
      return isMainFilled && isTrackingFilled;
    });
    if (!hasRequiredAnswers) {
      isValid = false;
    }
  });

  if (!isValid) {
    alert("Please fill in all required fields in all sections before submitting.");
    return;
  }

  try {
    setSubmitting(true);
    setError(null);

    const submitData: any = {
      answers,
      parentResponseId: parentResponseId || undefined,
      submissionMetadata: {
        source: 'internal',
        formSessionId: sessionTrackingId
      },
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      sessionId: sessionTrackingId || undefined  // ✅ Make sure this is included
    };

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
    
    console.log("Submitting response with data:", {
      formId: id,
      inviteId,
      hasSessionId: !!sessionTrackingId,
      hasStartedAt: !!submitData.startedAt,
      hasCompletedAt: !!submitData.completedAt,
      answersCount: Object.keys(submitData.answers).length
    });
    
    if (inviteId) {
      // ✅ Make sure all timing data is included
      const submissionResponse = await apiClient.submitPublicResponse(id!, {
        inviteId,
        answers: submitData.answers,
        location: submitData.location,
        submissionMetadata: submitData.submissionMetadata,
        startedAt: submitData.startedAt,
        completedAt: submitData.completedAt,
        sessionId: sessionTrackingId || undefined  // ✅ Include sessionId here too
      });
      
      console.log("Submission successful, response:", submissionResponse);
    } else {
      await apiClient.submitResponse(id!, {
        ...submitData,
        questionId: form.id
      });
    }
    
    // ✅ Mark the session as complete
    if (sessionTrackingId) {
      try {
        await apiClient.trackFormComplete(id!, {
          sessionId: sessionTrackingId,
          answers: submitData.answers
        });
        console.log("Session marked as complete:", sessionTrackingId);
      } catch (trackErr) {
        console.warn("Failed to mark session complete:", trackErr);
      }
    }

    const linkedFormId = findLinkedFormInAnswers();
    if (linkedFormId) {
      setTimeout(() => {
        navigate(`/forms/${linkedFormId}/respond?parentResponseId=${parentResponseId || ''}`);
      }, 500);
      return;
    }

    if (onSubmit) {
      onSubmit(submitData as Response);
    }
    
    // ✅ Show success message and set submitted state
    setSubmitted(true);
    
  } catch (err: any) {
    console.error("Error submitting response:", err);
    if (err.response?.message === 'ALREADY_SUBMITTED' || err.message?.includes('already been used')) {
      setShowDuplicateMessage(true);
    } else {
      setError(err.message || "Failed to submit response. Please try again.");
    }
  } finally {
    setSubmitting(false);
  }
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

  if (error || !form) {
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
            <button
              onClick={() => navigate(`/${tenantSlug}`)}
              className="px-6 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors"
            >
              Back to Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (submitted || showDuplicateMessage) {
    return <ThankYouMessage tenantSlug={tenantSlug!} formTitle={form.title} />;
  }

  const currentSection = formSections[currentSectionIndex];
  const isLastSection = currentSectionIndex === formSections.length - 1;
  const isFirstSection = currentSectionIndex === 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 gap-8">
      <div className="w-full max-w-[95%] flex flex-col lg:flex-row gap-8 items-start justify-center">
        {/* Sidebar Left */}
        <div className="w-full lg:w-[15%] hidden lg:block sticky top-12 space-y-4">
          <div className="p-6 bg-white rounded-2xl shadow-xl border border-neutral-200">
            <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-6">Form Sections</h3>
            <div className="space-y-2">
              {formSections.map((section, idx) => (
                <div 
                  key={section.id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    idx === currentSectionIndex 
                      ? "bg-primary-50 text-primary-700 shadow-sm" 
                      : "text-neutral-400 hover:bg-neutral-50"
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 ${
                    idx === currentSectionIndex ? "border-primary-500 bg-primary-500 text-white" : "border-neutral-100"
                  }`}>
                    {idx + 1}
                  </div>
                  <span className="text-[11px] font-bold truncate">{section.title}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleLoadSampleAnswers}
            className="w-full p-4 rounded-xl border-2 border-dashed border-neutral-200 text-neutral-400 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50/30 transition-all flex flex-col items-center gap-2 group"
          >
            <RefreshCw className="h-5 w-5 group-hover:rotate-180 transition-transform duration-700" />
            <span className="text-[10px] font-black uppercase tracking-widest">Load Sample Data</span>
          </button>
        </div>

        {/* Main Form Area */}
        <div className="flex-1 w-full max-w-4xl">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden">
            {/* Header */}
            <div className="p-8 border-b border-neutral-100 bg-gradient-to-r from-white to-neutral-50 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full -translate-y-16 translate-x-16" />
              <div className="relative z-10 space-y-2">
                <h1 className="text-2xl font-black text-neutral-900 leading-tight">
                  {form.title}
                </h1>
                <p className="text-neutral-500 font-medium text-sm leading-relaxed max-w-2xl">
                  {form.description}
                </p>
              </div>
            </div>

            {/* Current Section Progress */}
            <div className="px-8 py-4 bg-neutral-50 border-b border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black text-primary-600 uppercase tracking-widest">
                  Section {currentSectionIndex + 1} of {formSections.length}
                </span>
                <div className="h-1.5 w-32 bg-neutral-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary-600 transition-all duration-500"
                    style={{ width: `${((currentSectionIndex + 1) / formSections.length) * 100}%` }}
                  />
                </div>
              </div>
              <span className="text-[10px] font-bold text-neutral-400">
                {currentSection?.title}
              </span>
            </div>

            {/* Chassis Number Selection */}
            {currentSectionIndex === 0 && form.chassisNumbers && form.chassisNumbers.length > 0 && (
              <div className="m-8 p-8 bg-purple-50 rounded-2xl border-2 border-purple-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Clipboard className="w-16 h-16 text-purple-600" />
                </div>
                <h2 className="text-xl font-bold text-purple-900 mb-6 flex items-center gap-2">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  Select Chassis Number *
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {form.chassisNumbers.map((cn: any) => {
                    const chassisNumber = typeof cn === 'string' ? cn : cn.chassisNumber;
                    const partDescription = typeof cn === 'string' ? '' : cn.partDescription;
                    const displayValue = partDescription ? `${chassisNumber}-${partDescription}` : chassisNumber;

                    return (
                      <button
                        key={chassisNumber}
                        type="button"
                        onClick={() => handleAnswerChange('chassis_number', chassisNumber)}
                        className={`p-4 rounded-xl text-left border-2 transition-all duration-200 group relative overflow-hidden ${
                          answers['chassis_number'] === chassisNumber
                            ? 'border-purple-600 bg-white shadow-lg ring-4 ring-purple-100 scale-[1.02]'
                            : 'border-white bg-white/60 hover:border-purple-300 hover:bg-white hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className={`font-bold ${answers['chassis_number'] === chassisNumber ? 'text-purple-700' : 'text-gray-600'}`}>
                              {chassisNumber}
                            </span>
                            {partDescription && (
                              <span className={`text-xs ${answers['chassis_number'] === chassisNumber ? 'text-purple-500' : 'text-gray-500'}`}>
                                {partDescription}
                              </span>
                            )}
                          </div>
                          {answers['chassis_number'] === chassisNumber && (
                            <div className="w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center">
                              <Send className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                        <div className={`mt-1 text-[10px] uppercase tracking-wider font-bold ${answers['chassis_number'] === chassisNumber ? 'text-purple-400' : 'text-gray-400'}`}>
                          {answers['chassis_number'] === chassisNumber ? 'Selected Chassis' : 'Available'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="p-8">
              <form onSubmit={handleSubmit} className="space-y-12">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p className="text-sm font-bold">{error}</p>
                  </div>
                )}

                <div className="space-y-10">
                  {getOrderedVisibleQuestions(currentSection.questions || [], answers).map((question: any) => (
                    <div key={question.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <QuestionRenderer
                        question={question}
                        value={answers[question.id]}
                        trackingValue={answers[`${question.id}_tracking`]}
                        onChange={(val) => handleAnswerChange(question.id, val)}
                        onTrackingChange={(val) => {
                          handleAnswerChange(`${question.id}_tracking`, val);
                          handleTrackingChange(question.id, val);
                        }}
                        readOnly={submitting}
                        suggestedAnswers={suggestedAnswers}
                        lastSuggestionSource={lastSuggestionSource}
                        fetchingSuggestionsForId={fetchingSuggestionsForId}
                        onApplyFullSuggestion={(specific) => applySuggestions(specific, question.id)}
                      />
                    </div>
                  ))}

                  {/* Subsection Support */}
                  {currentSection.subsections?.map((subsection: any) => (
                    <div key={subsection.id} className="space-y-8 pt-8 border-t border-neutral-100 mt-12">
                      <div className="space-y-1">
                        <h4 className="text-lg font-black text-neutral-900">{subsection.title}</h4>
                        {subsection.description && (
                          <p className="text-sm text-neutral-500 font-medium">{subsection.description}</p>
                        )}
                      </div>
                      <div className="space-y-10">
                        {getOrderedVisibleQuestions(subsection.questions || [], answers).map((question: any) => (
                          <div key={question.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <QuestionRenderer
                              question={question}
                              value={answers[question.id]}
                              trackingValue={answers[`${question.id}_tracking`]}
                              onChange={(val) => handleAnswerChange(question.id, val)}
                              onTrackingChange={(val) => {
                                handleAnswerChange(`${question.id}_tracking`, val);
                                handleTrackingChange(question.id, val);
                              }}
                              readOnly={submitting}
                              suggestedAnswers={suggestedAnswers}
                              lastSuggestionSource={lastSuggestionSource}
                              fetchingSuggestionsForId={fetchingSuggestionsForId}
                              onApplyFullSuggestion={(specific) => applySuggestions(specific, question.id)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Navigation Controls */}
                <div className="pt-12 border-t border-neutral-100 flex items-center justify-between">
                  {!isFirstSection && (
                    <button
                      type="button"
                      onClick={handlePrevious}
                      className="flex items-center gap-2 px-6 py-3 text-neutral-500 font-black text-[10px] uppercase tracking-widest hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </button>
                  )}
                  
                  <div className="ml-auto">
                    {!isLastSection ? (
                      <button
                        type="button"
                        onClick={handleNext}
                        disabled={submitting}
                        className="px-8 py-3 bg-primary-600 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-primary-700 shadow-lg shadow-primary-600/20 active:scale-95 transition-all disabled:opacity-50"
                      >
                        Next Section
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex items-center gap-2 px-10 py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 disabled:opacity-50 active:scale-95 transition-all"
                      >
                        {submitting ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Submit Response
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Recommendations Sidebar */}
        <div className="w-full lg:w-[15%] min-w-[320px] shrink-0 sticky top-12 space-y-4">
          <div className="p-6 bg-white rounded-2xl shadow-xl border border-neutral-200 backdrop-blur-sm overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-400 to-primary-600" />
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-primary-50 text-primary-600">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-black text-primary-900 uppercase tracking-widest">Assistant</h3>
            </div>

            {!fetchingSuggestionsForId && !(suggestedAnswers && lastSuggestionSource) ? (
              <div className="py-12 flex flex-col items-center justify-center text-center gap-4 opacity-30">
                <Zap className="h-10 w-10 text-primary-300" />
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary-900">Assistant Ready</p>
                  <p className="text-[9px] font-medium leading-tight text-primary-600">Start typing to see<br/>smart recommendations</p>
                </div>
              </div>
            ) : fetchingSuggestionsForId ? (
              <div className="space-y-6 py-6 text-center">
                <div className="relative inline-flex">
                  <div className="w-12 h-12 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <RefreshCw className="h-4 w-4 text-emerald-600 animate-pulse" />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700">Searching...</p>
                  <p className="text-[9px] font-bold text-emerald-500/60">Checking historical records</p>
                </div>
              </div>
            ) : suggestedAnswers?._no_match ? (
              <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                <div className="p-8 rounded-[2.5rem] bg-white border-2 border-neutral-100 shadow-2xl shadow-neutral-200/50 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-amber-500/10 transition-colors duration-700" />
                  
                  <div className="relative space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-amber-50 text-amber-500">
                          <Zap className="h-6 w-6" />
                        </div>
                        <div>
                          <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-amber-600/50">Assistant</span>
                          <span className="block text-[14px] font-black text-neutral-900">Historical Insight</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 rounded-3xl bg-neutral-50/50 border border-neutral-100 space-y-4">
                      <div className="flex items-center gap-3 text-amber-600">
                        <AlertTriangle className="h-5 w-5" />
                        <span className="text-[11px] font-black uppercase tracking-widest">No Previous Match</span>
                      </div>
                      <p className="text-[12px] font-bold leading-relaxed text-neutral-500">
                        No previous data matches your current entry. Please double check the input or proceed with manual entry.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3">
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest text-center">Suggestions</p>
                      <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100/50 text-center">
                        <p className="text-[11px] font-bold text-blue-600/70">
                          Try adjusting the search criteria or chassis number to find related records.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSuggestedAnswers(null);
                    setLastSuggestionSource(null);
                  }}
                  className="w-full py-4 rounded-2xl border-2 border-neutral-100 text-neutral-400 hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50/30 text-[11px] font-black uppercase tracking-[0.3em] transition-all duration-300 active:scale-[0.98]"
                >
                  Dismiss Assistant
                </button>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                <div className="p-8 rounded-[2.5rem] bg-white border-2 border-emerald-100 shadow-2xl shadow-emerald-500/5 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-emerald-500/10 transition-colors duration-700" />
                  
                  <div className="relative space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-500 shadow-inner">
                          <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <div>
                          <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600/50">Assistant</span>
                          <span className="block text-[14px] font-black text-neutral-900">Found Records!</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 rounded-3xl bg-emerald-50/30 border border-emerald-100/50 space-y-4">
                      <p className="text-[12px] font-bold leading-relaxed text-emerald-700/80">
                        Historical records found for this entry. You can review and apply them below.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-400">Selected Rank:</span>
                        <div className="px-3 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-black">
                          #{selectedRank || 1} Record
                        </div>
                      </div>
  
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Historical versions:</span>
                        </div>
                        <div className="flex flex-wrap gap-2.5">
                          {(Array.isArray(suggestedAnswers) ? suggestedAnswers : []).map((suggestion: any) => (
                            <button
                              key={suggestion.rank}
                              type="button"
                              onClick={() => setSelectedRank(suggestion.rank)}
                              className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center text-[13px] font-black transition-all duration-300 hover:scale-110 active:scale-95 ${
                                selectedRank === suggestion.rank
                                  ? "bg-emerald-600 border-emerald-600 text-white shadow-xl shadow-emerald-500/30 ring-4 ring-emerald-500/10"
                                  : "bg-white border-neutral-100 text-neutral-400 hover:border-emerald-500/50 hover:text-emerald-600 shadow-sm"
                              }`}
                            >
                              {suggestion.rank}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 space-y-4">
                  <div className="flex items-center gap-3 px-2">
                    <div className="h-[1px] flex-1 bg-neutral-100" />
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400">Record Content</span>
                    <div className="h-[1px] flex-1 bg-neutral-100" />
                  </div>
                  
                  <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar pb-4">
                      {(() => {
                        const activeRecord = (Array.isArray(suggestedAnswers) ? suggestedAnswers : []).find(s => s.rank === (selectedRank || 1));
                        if (!activeRecord) return null;

                        const entries = Object.entries(activeRecord.answers);
                        const uniqueEntries = new Map();
                        
                        const normalizeKey = (s: string) => 
                          String(s || "").toLowerCase().replace(/_tracking$/, "").replace(/^_/, "").trim();
                        
                        const activeTargetId = (fetchingSuggestionsForId?.split(':')[0]) || (lastSuggestionSource?.split(':')[0]);
                        const normalizedActiveTarget = activeTargetId ? normalizeKey(activeTargetId) : null;

                        entries.forEach(([key, val]) => {
                          if (key.startsWith('_') || !val || (typeof val === 'string' && val.trim() === '')) return;
                          
                          const baseKey = key.replace('_tracking', '');
                          
                          if (normalizedActiveTarget && normalizeKey(baseKey) !== normalizedActiveTarget) {
                            return;
                          }
                          
                          const isTracking = key.endsWith('_tracking');
                          
                          if (!uniqueEntries.has(baseKey)) {
                            uniqueEntries.set(baseKey, { main: null, tracking: null });
                          }
                          
                          const entry = uniqueEntries.get(baseKey);
                          if (isTracking) entry.tracking = val;
                          else entry.main = val;
                        });

                        const items = Array.from(uniqueEntries.entries());
                        if (items.length === 0) {
                          return (
                            <p className="text-[10px] italic text-neutral-400">
                              No historical record for this specific question.
                            </p>
                          );
                        }

                        return items.map(([baseKey, data]) => {
                          const question = allFormQuestions.find((q: any) => (q.id || q._id) === baseKey);
                          const qText = question?.text || baseKey;
                          
                          const formatVal = (v: any) => {
                            if (!v) return null;
                            if (typeof v === 'object') {
                              if (v.chassisNumber) {
                                const parts = [];
                                if (v.status) parts.push(`Status: ${v.status}`);
                                if (v.zone?.length) parts.push(`Zones: ${v.zone.join(', ')}`);
                                if (v.defectCategory) {
                                  const catText = Array.isArray(v.defectCategory) ? v.defectCategory.join(", ") : v.defectCategory;
                                  parts.push(`Category: ${catText}`);
                                }
                                if (v.defects?.length) parts.push(`Defects: ${v.defects.map((d: any) => typeof d === 'string' ? d : d.name).join(', ')}`);
                                return parts.length ? parts.join(' | ') : v.chassisNumber;
                              }
                              return JSON.stringify(v);
                            }
                            return String(v);
                          };

                          const mainDisplay = formatVal(data.main);
                          const trackingDisplay = formatVal(data.tracking);

                          if (!mainDisplay && !trackingDisplay) return null;

                          return (
                            <div key={baseKey} className="group/item relative p-4 rounded-2xl border bg-white border-neutral-100 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300">
                              <div className="flex flex-col gap-2">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-tight text-neutral-400 mb-1.5 line-clamp-2 leading-relaxed">
                                      {qText}
                                    </p>
                                    <div className="flex flex-col gap-1.5">
                                      {trackingDisplay && (
                                        <div className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-blue-50 text-blue-700">
                                          <span className="text-[8px] font-black uppercase tracking-widest opacity-50">Track</span>
                                          <span className="text-[11px] font-black truncate max-w-[200px]">{trackingDisplay}</span>
                                        </div>
                                      )}
                                      {mainDisplay && (
                                        <div className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700">
                                          <span className="text-[8px] font-black uppercase tracking-widest opacity-50">Value</span>
                                          <span className="text-[11px] font-black truncate max-w-[200px]">{mainDisplay}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => applySuggestions(activeRecord.answers, baseKey, activeRecord.rank)}
                                    className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all duration-300 group-hover/item:scale-110 active:scale-95 shadow-sm"
                                    title="Apply this answer"
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSuggestedAnswers(null);
                    setLastSuggestionSource(null);
                    setSelectedRank(null);
                  }}
                  className="w-full py-4 rounded-2xl border-2 border-neutral-100 text-neutral-400 hover:border-neutral-300 hover:text-neutral-600 hover:bg-neutral-50 text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-300"
                >
                  Ignore Matches
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}