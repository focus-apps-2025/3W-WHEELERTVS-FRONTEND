import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Save, ArrowLeft, ChevronRight, ChevronLeft, FileText } from "lucide-react";
import { apiClient } from "../api/client";
import type { Response, Question } from "../types";
import QuestionRenderer from "../components/QuestionRenderer";

export default function EditResponseFormPage() {
  const { responseId } = useParams<{ responseId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [response, setResponse] = useState<Response | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialSectionId = searchParams.get("section") || undefined;
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!responseId) return;

        const responseWrapper = await apiClient.getResponse(responseId);
        const responseData = responseWrapper.response;
        setResponse(responseData as Response);
        setAnswers(responseData?.answers || {});

        const formIdentifier = responseData?.questionId || responseData?.formId;
        if (!formIdentifier) {
          throw new Error("Missing form identifier for response");
        }

        const formData = await apiClient.getForm(formIdentifier);
        setQuestion(formData?.form ?? formData);
      } catch (err: any) {
        console.error("Failed to fetch data:", err);
        setError(err.message || "Failed to load response for editing.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [responseId]);

  useEffect(() => {
    if (initialSectionId && question?.sections) {
      const idx = question.sections.findIndex((s) => s.id === initialSectionId);
      if (idx >= 0) setCurrentSectionIndex(idx);
    }
  }, [initialSectionId, question]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!responseId || !response) return;

    setSaving(true);
    try {
      const updatedResponse: Response = {
        ...response,
        answers,
        timestamp: new Date().toISOString(),
      };

      await apiClient.updateResponse(responseId, updatedResponse);
      navigate(`/responses/${responseId}`);
    } catch (err) {
      console.error("Failed to save response:", err);
      alert("Failed to save response. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const isFollowUpVisible = (fq: any, answers: Record<string, any>): boolean => {
    if (!fq.triggerValue && !fq.showWhen && !fq.condition) return true;

    const parentId = fq.parentId ?? fq.parent_id ?? fq.parentQuestionId ?? fq.showWhen?.questionId;
    if (!parentId) return true;

    const parentAnswer = answers[parentId];
    const trigger = fq.triggerValue ?? fq.showWhen?.value ?? fq.condition?.value;

    if (trigger === undefined) return true;

    if (Array.isArray(trigger)) {
      return trigger.includes(parentAnswer);
    }

    return String(parentAnswer).toLowerCase() === String(trigger).toLowerCase();
  };

  const renderSectionQuestions = (section: any): React.ReactNode => {
    const nodes: React.ReactNode[] = [];
    const mainQuestions = section.questions || [];
    let qCounter = 0;

    for (const q of mainQuestions) {
      const followUps = (q.followUpQuestions || []).filter((fq: any) =>
        isFollowUpVisible(fq, answers),
      );

      if (followUps.length > 0) {
        nodes.push(
          <div key={q.id ?? q._id} className="mb-6">
            <div className="flex items-start space-x-4 p-5 border border-gray-200 dark:border-gray-700 rounded-2xl">
              <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 font-semibold text-sm">
                {qCounter + 1}
              </div>
              <div className="flex-1 min-w-0">
                <QuestionRenderer
                  question={q}
                  value={answers[q.id ?? q._id]}
                  trackingValue={answers[`${q.id ?? q._id}_tracking`]}
                  onChange={(value) => setAnswers({ ...answers, [q.id ?? q._id]: value })}
                  onTrackingChange={(value) =>
                    setAnswers({ ...answers, [`${q.id ?? q._id}_tracking`]: value })
                  }
                  isFollowUp={false}
                />
              </div>
            </div>

            <div className="mt-4 ml-8 space-y-4 border-l-4 border-primary-200 dark:border-primary-800 pl-6">
              {followUps.map((fq: any) => {
                const nestedFollowUps = (fq.followUpQuestions || []).filter((nfq: any) =>
                  isFollowUpVisible(nfq, answers),
                );
                const fqId = fq.id ?? fq._id;

                qCounter++;

                return (
                  <div key={fqId}>
                    <div className="flex items-start space-x-3 p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/30 dark:bg-gray-800/10">
                      <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary-50 dark:bg-primary-900/50 text-primary-500 dark:text-primary-400 text-xs font-bold">
                        {qCounter}
                      </div>
                      <div className="flex-1 min-w-0">
                        <QuestionRenderer
                          question={fq}
                          value={answers[fqId]}
                          trackingValue={answers[`${fqId}_tracking`]}
                          onChange={(value) => setAnswers({ ...answers, [fqId]: value })}
                          onTrackingChange={(value) =>
                            setAnswers({ ...answers, [`${fqId}_tracking`]: value })
                          }
                          isFollowUp={true}
                        />
                      </div>
                    </div>

                    {nestedFollowUps.length > 0 && (
                      <div className="mt-3 ml-6 space-y-3 border-l-2 border-gray-200 dark:border-gray-600 pl-4">
                        {nestedFollowUps.map((nfq: any) => {
                          const nfqId = nfq.id ?? nfq._id;
                          qCounter++;

                          return (
                            <div key={nfqId}>
                              <div className="flex items-start space-x-3 p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/20 dark:bg-gray-800/5">
                                <div className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-bold">
                                  {qCounter}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <QuestionRenderer
                                    question={nfq}
                                    value={answers[nfqId]}
                                    trackingValue={answers[`${nfqId}_tracking`]}
                                    onChange={(value) => setAnswers({ ...answers, [nfqId]: value })}
                                    onTrackingChange={(value) =>
                                      setAnswers({ ...answers, [`${nfqId}_tracking`]: value })
                                    }
                                    isFollowUp={true}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>,
        );
      } else {
        nodes.push(
          <div key={q.id ?? q._id} className="mb-6">
            <div className="flex items-start space-x-4 p-5 border border-gray-200 dark:border-gray-700 rounded-2xl">
              <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 font-semibold text-sm">
                {qCounter + 1}
              </div>
              <div className="flex-1 min-w-0">
                <QuestionRenderer
                  question={q}
                  value={answers[q.id ?? q._id]}
                  trackingValue={answers[`${q.id ?? q._id}_tracking`]}
                  onChange={(value) => setAnswers({ ...answers, [q.id ?? q._id]: value })}
                  onTrackingChange={(value) =>
                    setAnswers({ ...answers, [`${q.id ?? q._id}_tracking`]: value })
                  }
                  isFollowUp={false}
                />
              </div>
            </div>
          </div>,
        );
        qCounter++;
      }
    }

    if ((section.subsections || []).length > 0) {
      for (const sub of section.subsections) {
        nodes.push(
          <div key={sub.id} className="ml-4">
            {sub.title && (
              <div className="mb-4 px-4 py-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border-l-4 border-primary-400 dark:border-primary-600">
                <h4 className="text-sm font-semibold text-primary-800 dark:text-primary-300 uppercase tracking-wide">
                  {sub.title}
                </h4>
                {sub.description && (
                  <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                    {sub.description}
                  </p>
                )}
              </div>
            )}
            {renderSectionQuestions(sub)}
          </div>,
        );
      }
    }

    return <div className="space-y-0">{nodes}</div>;
  };

  const renderFullWidthSection = (section: any, index: number): React.ReactNode => {
    const content = renderSectionQuestions(section);

    return (
      <div key={section.id} className="space-y-6">
        <div className="pb-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-primary-600 text-white font-bold text-sm">
              {index + 1}
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {section.title || `Section ${index + 1}`}
              </h3>
              {section.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {section.description}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="py-2">
          {content}
        </div>
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  // Error state
  if (error || !response || !question) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="p-6 text-center text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            {error || "Failed to load data"}
          </div>
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate(responseId ? `/responses/${responseId}` : "/responses/all")}
              className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
            >
              Back to Responses
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sections = question?.sections && question.sections.length > 0 ? question.sections : [];
  const standaloneFollowUps = question.followUpQuestions || [];
  const totalSections = sections.length + (standaloneFollowUps.length > 0 && sections.length === 0 ? 1 : 0);

  const handlePrev = () => {
    setCurrentSectionIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentSectionIndex((prev) => Math.min(totalSections - 1, prev + 1));
  };

  const goToSection = (index: number) => {
    setCurrentSectionIndex(index);
  };

  const isFirst = currentSectionIndex === 0;
  const isLast = currentSectionIndex === totalSections - 1;

  const currentContent = (() => {
    if (sections.length > 0 && currentSectionIndex < sections.length) {
      return renderFullWidthSection(sections[currentSectionIndex], currentSectionIndex);
    }
    if (sections.length === 0 && standaloneFollowUps.length > 0) {
      return (
        <div className="space-y-6">
          <div className="pb-5 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-primary-600 text-white font-bold text-sm">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Additional Questions
                </h3>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {standaloneFollowUps.map((q: any, idx: number) => {
              const qId = q.id ?? q._id;
              return (
                <div key={qId} className="flex items-start space-x-4">
                  <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 font-semibold text-sm">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <QuestionRenderer
                      question={q}
                      value={answers[qId]}
                      trackingValue={answers[`${qId}_tracking`]}
                      onChange={(value) => setAnswers({ ...answers, [qId]: value })}
                      onTrackingChange={(value) =>
                        setAnswers({ ...answers, [`${qId}_tracking`]: value })
                      }
                      isFollowUp={false}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="p-12 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            No questions found for this response.
          </p>
        </div>
      </div>
    );
  })();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6">
      <div className="pb-6 border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => navigate(`/responses/${responseId}`)}
              className="inline-flex items-center justify-center p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                Edit Response
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Review and update your answers
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center space-x-3">
            <button
              type="button"
              onClick={() => navigate(`/responses/${responseId}`)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="response-edit-form"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Full Width */}
      <div className="w-full">
        <div className="flex gap-6">
          {/* Section Sidebar */}
          {totalSections > 1 && (
            <div className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-24 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
                  Form Sections
                </h3>
                <nav className="space-y-2">
                  {sections.map((section: any, idx: number) => (
                    <button
                      key={section.id}
                      onClick={() => goToSection(idx)}
                      className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                        currentSectionIndex === idx
                          ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-l-4 border-primary-600 dark:border-primary-400"
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          currentSectionIndex === idx
                            ? "bg-primary-600 text-white"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                        }`}>
                          {idx + 1}
                        </div>
                        <span className="truncate">{section.title || `Section ${idx + 1}`}</span>
                      </div>
                    </button>
                  ))}
                  {standaloneFollowUps.length > 0 && sections.length === 0 && (
                    <button
                      onClick={() => goToSection(0)}
                      className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                        currentSectionIndex === 0
                          ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-l-4 border-primary-600 dark:border-primary-400"
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <FileText className="w-5 h-5" />
                        <span>Additional Questions</span>
                      </div>
                    </button>
                  )}
                </nav>
              </div>
            </div>
          )}

          {/* Main Section Content - Full Width */}
          <div className="flex-1 min-w-0">
            <form id="response-edit-form" onSubmit={handleSubmit} className="space-y-6">
              {currentContent}

              {/* Navigation Buttons */}
              {totalSections > 1 && (
                <div className="flex items-center justify-between pt-6">
                  <button
                    type="button"
                    onClick={handlePrev}
                    disabled={isFirst}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                      isFirst
                        ? "text-gray-400 bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
                        : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous Section
                  </button>

                  <div className="flex items-center gap-2">
                    {sections.map((_: any, idx: number) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => goToSection(idx)}
                        className={`w-2.5 h-2.5 rounded-full transition-colors ${
                          currentSectionIndex === idx
                            ? "bg-primary-600 dark:bg-primary-400"
                            : "bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500"
                        }`}
                        aria-label={`Go to section ${idx + 1}`}
                      />
                    ))}
                  </div>

                  {!isLast ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      Next Section
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? "Saving…" : "Save Changes"}
                    </button>
                  )}
                </div>
              )}

              {/* Mobile Action Buttons */}
              <div className="sm:hidden mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => navigate(`/responses/${responseId}`)}
                  className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
