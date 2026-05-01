import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  Target,
  Activity,
  Zap,
  ChevronDown,
  X,
  Eye,
  User,
  Calendar,
  FileText,
  BarChart,
} from "lucide-react";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  ArcElement,
  Title,
  BarElement,
} from "chart.js";
import { Radar, Pie, Bar } from "react-chartjs-2";
import type { Question, Response } from "../../types";
import { isImageUrl } from "../../utils/answerTemplateUtils";
import ImageLink from "../ImageLink";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
);

interface Response {
  id: string;
  answers: Record<string, any>;
  timestamp?: string;
  createdAt?: string;
  assignedAt?: string;
  status?: string;
}

interface Question {
  id: string;
  text: string;
  type?: string;
  parentId?: string;
  showWhen?: {
    questionId: string;
  };
  followUpQuestions?: Question[];
}

interface Section {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
}

export interface SectionAnalyticsData {
  sectionId: string;
  sectionTitle: string;
  description?: string;
  stats: {
    mainQuestionCount: number;
    totalFollowUpCount: number;
    answeredMainQuestions: number;
    answeredFollowUpQuestions: number;
    totalAnswered: number;
    totalResponses: number;
    completionRate: string;
    avgResponsesPerQuestion: string;
    questionsDetail: Array<{
      id: string;
      text: string;
      followUpCount: number;
      responses: number;
      followUpDetails?: Array<{
        id: string;
        text: string;
        responses: number;
      }>;
    }>;
  };
  qualityBreakdown: Array<{
    parameterName: string;
    yes: number;
    no: number;
    na: number;
    total: number;
  }>;
  overallQuality: {
    totalYes: number;
    totalNo: number;
    totalNA: number;
    totalResponses: number;
    percentages: {
      yes: string;
      no: string;
      na: string;
    };
  };
}

interface SectionAnalyticsProps {
  question: {
    sections?: Section[];
  };
  responses: Response[];
  openSectionId?: string | null;
  complianceLabels?: {
    yes: string;
    no: string;
    na: string;
  };
}
interface QuestionDetailsModalProps {
  question: any;
  responses: Response[];
  sectionTitle: string;
  formData?: any;
  onClose: () => void;
  complianceLabels: {
    yes: string;
    no: string;
    na: string;
  };
}

const QuestionDetailsModal: React.FC<QuestionDetailsModalProps> = ({
  question,
  responses,
  sectionTitle,
  formData,
  onClose,
  complianceLabels,
}) => {
  console.log("=== DEBUG: Modal Data ===");
  console.log("Section Title:", sectionTitle);
  console.log("Question ID:", question.id);
  console.log("Question Text:", question.text);
  console.log("Question object:", question);
  console.log("Question has sections?", !!question.sections);
  const modalRef = useRef<HTMLDivElement>(null);

  const questionResponses = useMemo(() => {
    console.log("=== DEBUG: Modal Data ===");
    console.log("Section Title:", sectionTitle);
    console.log("Form Data has sections?", formData?.sections?.length);
    console.log("Form Data:", formData);

    // Check if we're in Basic Information section
    const isBasicInfoSection =
      sectionTitle?.toLowerCase().includes("basic") ||
      sectionTitle?.toLowerCase().includes("information");

    console.log("Is Basic Info Section:", isBasicInfoSection);

    // Find dealer question ID from formData (which has sections)
    const findDealerQuestionId = () => {
      if (!formData?.sections || formData.sections.length === 0) {
        console.log("No sections found in formData");
        return null;
      }

      // First section should be Basic Information
      const firstSection = formData.sections[0];
      console.log("First section:", firstSection?.title);
      console.log("First section questions:", firstSection?.questions?.length);

      if (!firstSection?.questions) {
        return null;
      }

      // Search for dealer name question
      for (const q of firstSection.questions) {
        const questionText = q.text?.toLowerCase() || "";
        console.log(`Checking question: ${q.text} (${q.id})`);

        if (questionText.includes("dealer")) {
          console.log("Found dealer question:", q);
          return q.id;
        }
      }

      // If no dealer question found, look for any name field
      for (const q of firstSection.questions) {
        const questionText = q.text?.toLowerCase() || "";
        if (questionText.includes("name")) {
          console.log("Found name question as fallback:", q);
          return q.id;
        }
      }

      return null;
    };

    const dealerQuestionId = findDealerQuestionId();
    console.log("Dealer Question ID:", dealerQuestionId);

    return responses
      .filter((response) => {
        const answer = response.answers?.[question.id];
        return answer !== null && answer !== undefined && answer !== "";
      })
      .map((response, index) => {
        console.log(`Response ${index + 1}:`, response.id);
        console.log("Response answers:", response.answers);

        let displayInfo = "";
        let isDealerName = false;

        if (!isBasicInfoSection && dealerQuestionId) {
          // For non-BasicInfo sections: show dealer name
          const dealerName = response.answers?.[dealerQuestionId];
          console.log(`Dealer name for response ${response.id}:`, dealerName);
          displayInfo = dealerName || "Unknown Dealer";
          isDealerName = true;
        } else {
          // For BasicInfo section: show response ID
          displayInfo = response.id?.substring(0, 8) || "N/A";
          isDealerName = false;
        }

        console.log(
          `Will display: ${displayInfo} (isDealerName: ${isDealerName})`
        );

        return {
          response,
          answer: response.answers?.[question.id],
          timestamp:
            response.timestamp ||
            response.createdAt ||
            response.assignedAt ||
            "Unknown",
          status: response.status || "pending",
          displayInfo,
          isDealerName,
        };
      });
  }, [responses, question, sectionTitle, formData]);

  const answerStats = useMemo(() => {
    const stats = {
      totalAnswered: questionResponses.length,
      totalResponses: responses.length,
      percentage: ((questionResponses.length / responses.length) * 100).toFixed(
        1
      ),
    };

    const counts = { yes: 0, no: 0, na: 0 };
    questionResponses.forEach((qr) => {
      const answer = qr.answer;

      // Handle inspection status object
      if (typeof answer === "object" && answer !== null && answer.status) {
        const status = String(answer.status).toLowerCase().trim();
        if (
          status === "accepted" ||
          status === "rework completed" ||
          status === "verified"
        ) {
          counts.yes++;
        } else if (status === "rejected") {
          counts.no++;
        } else if (
          status === "rework" ||
          status === "reworked" ||
          status.includes("re-rework")
        ) {
          counts.na++;
        }
        return;
      }

      if (question.type === "yesNoNA") {
        const answerStr = String(answer).toLowerCase().trim();
        const options = (question as any).options || [];

        // If it's a yesNoNA question, the first option is Yes, second is No, third is N/A
        if (options.length >= 3) {
          if (answerStr === String(options[0]).toLowerCase().trim()) {
            counts.yes++;
          } else if (answerStr === String(options[1]).toLowerCase().trim()) {
            counts.no++;
          } else if (answerStr === String(options[2]).toLowerCase().trim()) {
            counts.na++;
          }
        } else {
          // Fallback to string matching if options are missing
          if (answerStr.includes("yes")) counts.yes++;
          else if (answerStr.includes("no")) counts.no++;
          else if (
            answerStr.includes("na") ||
            answerStr.includes("n/a") ||
            answerStr.includes("not applicable")
          )
            counts.na++;
        }
      }
    });

    if (
      question.type === "yesNoNA" ||
      question.type === "chassisWithZone" ||
      question.type === "chassisWithoutZone" ||
      question.text?.toLowerCase().includes("chassis")
    ) {
      return { ...stats, counts };
    }

    return stats;
  }, [questionResponses, responses.length, question.type, question.text]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "auto";
    };
  }, [onClose]);

  const renderAnswerDisplay = (answer: any): React.ReactNode => {
    const resolveFileData = (input: any) => {
      if (!input) return null;
      const candidate = Array.isArray(input) && input.length === 1 ? input[0] : input;
      if (typeof candidate === "string") {
        if (candidate.startsWith("data:")) return { data: candidate };
        if (candidate.startsWith("http") || candidate.startsWith("//") || candidate.startsWith("/") || candidate.startsWith("uploads/")) {
          return { url: candidate };
        }
        return null;
      }
      if (typeof candidate === "object") {
        const dataValue = candidate.data || candidate.value || candidate.file || candidate.base64 || candidate.url || candidate.answer || candidate.path;
        if (typeof dataValue === "string") {
          if (dataValue.startsWith("data:")) return { data: dataValue };
          return { url: dataValue };
        }
      }
      return null;
    };

    if (answer === null || answer === undefined || answer === "") {
      return <span className="text-gray-400 italic">No response</span>;
    }

    if (typeof answer === "string") {
      if (answer.startsWith("data:")) {
        return (
          <span className="text-blue-600 font-medium">
            {answer.substring(0, 50)}...
          </span>
        );
      }

      if (isImageUrl(answer)) {
        return <ImageLink text={answer} />;
      }

      if (
        answer.startsWith("http") ||
        answer.startsWith("//") ||
        answer.startsWith("/") ||
        answer.startsWith("uploads/")
      ) {
        if (isImageUrl(answer)) {
          return <ImageLink text={answer} />;
        }
        return (
          <a
            href={answer}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            {answer}
          </a>
        );
      }
      return <span className="text-gray-900">{answer}</span>;
    }

    if (Array.isArray(answer)) {
      if (answer.length === 0) {
        return <span className="text-gray-400 italic">No response</span>;
      }
      return (
        <ul className="list-none p-0 space-y-2">
          {answer.map((item, index) => (
            <li key={index} className="text-gray-900">
              {renderAnswerDisplay(item)}
            </li>
          ))}
        </ul>
      );
    }

    if (typeof answer === "object") {
      const fileData = resolveFileData(answer);
      if (fileData?.url || fileData?.data) {
        const finalUrl = fileData.url || fileData.data;
        if (finalUrl && isImageUrl(finalUrl)) {
          return <ImageLink text={finalUrl} />;
        }
      }

      if (answer.status) {
        return (
          <div className="space-y-1">
            <span className="font-bold text-gray-900">{answer.status}</span>
            {answer.chassisNumber && (
              <p className="text-xs text-gray-500">Chassis: {answer.chassisNumber}</p>
            )}
            {answer.remark && (
              <p className="text-xs text-gray-600 italic">Remark: {answer.remark}</p>
            )}
          </div>
        );
      }

      if (Object.keys(answer).length === 0) {
        return <span className="text-gray-400 italic">No response</span>;
      }
      
      const entries = Object.entries(answer);
      return (
        <div className="flex flex-col gap-2">
          {entries.map(([k, v], i) => (
            <div key={i} className="flex flex-col gap-0.5 border-l-2 border-gray-100 dark:border-gray-800 pl-2">
              <span className="text-[10px] font-bold opacity-70 uppercase tracking-tighter text-blue-800 dark:text-blue-300">
                {k}
              </span>
              {renderAnswerDisplay(v)}
            </div>
          ))}
        </div>
      );
    }

    return <span className="text-gray-900">{String(answer)}</span>;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col"
      >
        <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-700 dark:to-blue-800 px-6 py-4 rounded-t-2xl flex justify-between items-center">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white">Question Details</h3>
            <p className="text-blue-100 text-sm mt-1">
              {sectionTitle} • {question.text?.substring(0, 80)}
              {question.text?.length > 80 ? "..." : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-700">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    {question.text}
                  </h4>
                  <div className="flex flex-wrap gap-4 mt-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                        <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Question Type
                        </div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {question.type || "General"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-lg">
                        <User className="w-4 h-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Answered
                        </div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {answerStats.totalAnswered} /{" "}
                          {answerStats.totalResponses} ({answerStats.percentage}
                          %)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Eye className="w-5 h-5 text-blue-600" />
                  Responses ({questionResponses.length})
                </h4>
                {(question.type === "yesNoNA" ||
                  question.type === "chassisWithZone" ||
                  question.type === "chassisWithoutZone" ||
                  question.type === "chassis" ||
                  complianceLabels.yes === "Accepted") &&
                  answerStats.counts && (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {complianceLabels.yes}: {answerStats.counts.yes}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {complianceLabels.no}: {answerStats.counts.no}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {complianceLabels.na}: {answerStats.counts.na}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {questionResponses.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                  <Eye className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 font-medium">
                    No responses yet
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {questionResponses.map((qr, index) => (
                    <div
                      key={`${qr.response.id}-${index}`}
                      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold rounded-full">
                              {index + 1}
                            </div>
                            <div>
                              <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <Calendar className="w-3 h-3" />
                                {new Date(qr.timestamp).toLocaleString()}
                              </div>
                              <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                <div className="flex items-center gap-2">
                                  {qr.isDealerName ? (
                                    // Show dealer icon and name for other sections
                                    <>
                                      <User className="w-3 h-3" />
                                      <span>Dealer: {qr.displayInfo}</span>
                                    </>
                                  ) : (
                                    // Show ID icon and response ID for first section
                                    <>
                                      <FileText className="w-3 h-3" />
                                      <span>
                                        Response ID: {qr.displayInfo}...
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 ml-11">
                            <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Answer:
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
                              {renderAnswerDisplay(qr.answer)}
                            </div>
                          </div>
                        </div>

                        <div className="ml-4 flex-shrink-0">
                          <div
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              qr.status === "verified"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : qr.status === "rejected"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                            }`}
                          >
                            {qr.status || "pending"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900/80 px-6 py-4 rounded-b-2xl border-t border-gray-200 dark:border-gray-700 flex justify-between items-center backdrop-blur-sm">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Showing {questionResponses.length} response
            {questionResponses.length !== 1 ? "s" : ""}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium rounded-lg transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default function SectionAnalytics({
  question,
  responses,
  openSectionId,
  complianceLabels = { yes: "Yes", no: "No", na: "N/A" },
}: SectionAnalyticsProps) {
  const sections: Section[] = question.sections || [];
  const [selectedQuestion, setSelectedQuestion] = useState<{
    question: any;
    sectionTitle: string;
    formData?: any;
  } | null>(null);

  const [visualizationType, setVisualizationType] = useState<"radar" | "bar">(
    "radar"
  );

  const getSectionStats = (section: Section) => {
    const mainQuestionsOnly = section.questions.filter(
      (q: any) => !q.parentId && !q.showWhen?.questionId
    );
    const mainQuestionCount = mainQuestionsOnly.length;
    let totalFollowUpCount = 0;
    let answeredMainQuestions = 0;
    let answeredFollowUpQuestions = 0;
    let mainQuestionResponses = 0;
    let followUpResponses = 0;

    const followUpQuestionsInSection = section.questions.filter(
      (q: any) => q.parentId || q.showWhen?.questionId
    );
    totalFollowUpCount = followUpQuestionsInSection.length;

    followUpQuestionsInSection.forEach((followUp: any) => {
      const followUpResponders = responses.filter(
        (r) => r.answers && r.answers[followUp.id]
      ).length;
      if (followUpResponders > 0) {
        answeredFollowUpQuestions++;
        followUpResponses += followUpResponders;
      }
    });

    mainQuestionsOnly.forEach((q: any) => {
      let followUpCount = 0;
      if (q.followUpQuestions && Array.isArray(q.followUpQuestions)) {
        followUpCount = q.followUpQuestions.length;
      }

      const mainQuestionResponders = responses.filter(
        (r) => r.answers && r.answers[q.id]
      ).length;
      if (mainQuestionResponders > 0) {
        answeredMainQuestions++;
        mainQuestionResponses += mainQuestionResponders;
      }
    });

    const totalAnswered = answeredMainQuestions + answeredFollowUpQuestions;
    const totalQuestions = mainQuestionCount + totalFollowUpCount;
    const totalResponses = mainQuestionResponses + followUpResponses;

    const completionRate =
      totalQuestions > 0
        ? ((totalAnswered / totalQuestions) * 100).toFixed(1)
        : 0;

    const avgResponsesPerQuestion =
      totalQuestions > 0 ? (totalResponses / totalQuestions).toFixed(1) : 0;

    return {
      mainQuestionCount,
      totalFollowUpCount,
      answeredMainQuestions,
      answeredFollowUpQuestions,
      totalAnswered,
      totalResponses,
      completionRate,
      avgResponsesPerQuestion,
      questionsDetail: mainQuestionsOnly.map((q: any) => {
        const relatedFollowUps = section.questions.filter(
          (fq: any) => fq.parentId === q.id || fq.showWhen?.questionId === q.id
        );
        return {
          id: q.id,
          text: q.text,
          followUpCount: relatedFollowUps.length,
          responses: responses.filter((r) => r.answers && r.answers[q.id])
            .length,
          followUpDetails: relatedFollowUps.map((fq: any) => ({
            id: fq.id,
            text: fq.text,
            responses: responses.filter((r) => r.answers && r.answers[fq.id])
              .length,
          })),
        };
      }),
    };
  };
  const getSectionQualityBreakdown = (section: Section) => {
    const qualityData: {
      parameterName: string;
      yes: number;
      no: number;
      na: number;
      total: number;
    }[] = [];

    // Group questions by parameter/subParam1
    const parameterGroups = new Map<
      string,
      {
        parameterName: string;
        yes: number;
        no: number;
        na: number;
        total: number;
        questions: Question[];
        isRealParameter: boolean;
      }
    >();

    // Process all main questions in the section
    section.questions.forEach((q: any) => {
      // Only process main questions (not follow-ups)
      if (!q.parentId && !q.showWhen?.questionId) {
        // Check if this has a real parameter name
        const hasRealParameter = !!q.subParam1 || !!q.parameter;

        // Get parameter name (prefer subParam1 or parameter over question text)
        const paramName =
          q.subParam1 ||
          q.parameter ||
          (hasRealParameter
            ? null
            : q.text?.substring(0, 30) + (q.text?.length > 30 ? "..." : "")) ||
          null;

        // Skip if no parameter name can be extracted
        if (!paramName) return;

        if (!parameterGroups.has(paramName)) {
          parameterGroups.set(paramName, {
            parameterName: paramName,
            yes: 0,
            no: 0,
            na: 0,
            total: 0,
            questions: [],
            isRealParameter: hasRealParameter,
          });
        }

        const group = parameterGroups.get(paramName)!;
        group.questions.push(q);

        // Count responses for this question
        responses.forEach((response) => {
          const answer = response.answers?.[q.id];
          if (answer !== null && answer !== undefined && answer !== "") {
            group.total++;

            // Handle inspection status object
            if (typeof answer === "object" && answer.status) {
              const status = String(answer.status).toLowerCase().trim();
              if (
                status === "accepted" ||
                status === "rework completed" ||
                status === "verified"
              ) {
                group.yes++;
              } else if (status === "rejected") {
                group.no++;
              } else if (
                status === "rework" ||
                status === "reworked" ||
                status.includes("re-rework")
              ) {
                group.na++;
              }
              return;
            }

            const answerStr = String(answer).toLowerCase().trim();
            if (
              answerStr === "accepted" ||
              answerStr === "rework completed" ||
              answerStr === "verified"
            ) {
              group.yes++;
            } else if (answerStr === "rejected") {
              group.no++;
            } else if (
              answerStr === "rework" ||
              answerStr === "reworked" ||
              answerStr.includes("re-rework")
            ) {
              group.na++;
            } else if (q.type === "yesNoNA" && q.options && q.options.length >= 3) {
              if (answerStr === String(q.options[0]).toLowerCase().trim()) {
                group.yes++;
              } else if (
                answerStr === String(q.options[1]).toLowerCase().trim()
              ) {
                group.no++;
              } else if (
                answerStr === String(q.options[2]).toLowerCase().trim()
              ) {
                group.na++;
              }
            } else {
              // Standard behavior or fallback for non-yesNoNA questions
              if (answerStr.includes("yes") || answerStr === "y") {
                group.yes++;
              } else if (answerStr.includes("no") || answerStr === "n") {
                group.no++;
              } else if (
                answerStr.includes("na") ||
                answerStr.includes("n/a") ||
                answerStr.includes("not applicable")
              ) {
                group.na++;
              }
            }
          }
        });
      }
    });

    // Convert map to array and calculate percentages
    // Also filter out groups that don't have real parameters
    parameterGroups.forEach((group) => {
      if (group.total > 0 && group.isRealParameter) {
        qualityData.push({
          parameterName: group.parameterName,
          yes: group.yes,
          no: group.no,
          na: group.na,
          total: group.total,
        });
      }
    });

    return qualityData;
  };
  // Add this function after getSectionQualityBreakdown
  const calculateOverallQuality = (qualityBreakdown: any[]) => {
    let totalYes = 0;
    let totalNo = 0;
    let totalNA = 0;
    let totalResponses = 0;

    qualityBreakdown.forEach((item) => {
      totalYes += item.yes;
      totalNo += item.no;
      totalNA += item.na;
      totalResponses += item.total;
    });

    const total = totalYes + totalNo + totalNA;

    return {
      totalYes,
      totalNo,
      totalNA,
      totalResponses,
      percentages: {
        yes: total > 0 ? ((totalYes / total) * 100).toFixed(1) : "0.0",
        no: total > 0 ? ((totalNo / total) * 100).toFixed(1) : "0.0",
        na: total > 0 ? ((totalNA / total) * 100).toFixed(1) : "0.0",
      },
    };
  };

  const sectionsStats = useMemo(() => {
    return sections.map((section) => ({
      section,
      stats: getSectionStats(section),
    }));
  }, [sections, responses]);

  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedQualityBreakdown, setExpandedQualityBreakdown] = useState<
    Record<string, boolean>
  >({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  useEffect(() => {
    if (openSectionId) {
      // 1. Ensure it's selected if we have a selection filter
      if (
        selectedSectionIds.length > 0 &&
        !selectedSectionIds.includes(openSectionId)
      ) {
        setSelectedSectionIds((prev) => [...prev, openSectionId]);
      }

      // 2. Expand it (only one at a time)
      setExpandedSections({ [openSectionId]: true });

      // 3. Scroll to it
      setTimeout(() => {
        const element = document.getElementById(
          `section-analytics-${openSectionId}`
        );
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  }, [openSectionId, selectedSectionIds.length]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      // If it's already open, close it. If not, open only this one and close others.
      if (prev[sectionId]) {
        return {};
      }
      return { [sectionId]: true };
    });
  };

  const toggleQualityBreakdown = (sectionId: string) => {
    setExpandedQualityBreakdown((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleSelectSection = (sectionId: string) => {
    setSelectedSectionIds((prev) => {
      if (prev.includes(sectionId)) {
        return prev.filter((id) => id !== sectionId);
      } else {
        return [...prev, sectionId];
      }
    });
  };

  const handleClearAll = () => {
    setSelectedSectionIds([]);
  };

  const filteredSectionOptions = sections.filter((section) =>
    section.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displaySections =
    selectedSectionIds.length === 0
      ? sectionsStats
      : sectionsStats.filter((item) =>
          selectedSectionIds.includes(item.section.id)
        );

  if (!sections || sections.length === 0) {
    return (
      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg p-8 text-center border border-gray-100 dark:border-gray-700">
        <BarChart3 className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-gray-600 dark:text-gray-400 font-medium">
          No sections available
        </p>
      </div>
    );
  }

  const totalMetrics = useMemo(() => {
    let totalMainQuestions = 0;
    let totalFollowUpQuestions = 0;
    let totalQuestionsAnswered = 0;
    let totalCompletionRate = 0;

    displaySections.forEach(({ stats }) => {
      totalMainQuestions += stats.mainQuestionCount;
      totalFollowUpQuestions += stats.totalFollowUpCount;
      totalQuestionsAnswered += stats.totalAnswered;
      totalCompletionRate += parseFloat(stats.completionRate as any);
    });

    const avgCompletionRate =
      displaySections.length > 0
        ? (totalCompletionRate / displaySections.length).toFixed(1)
        : 0;

    return {
      totalMainQuestions,
      totalFollowUpQuestions,
      totalQuestionsAnswered,
      avgCompletionRate,
      sections: displaySections.length,
    };
  }, [displaySections]);

  const prepareBarChartData = (qualityBreakdown: any[]) => {
    // Sort by yes percentage descending for better visualization
    const sortedData = [...qualityBreakdown].sort((a, b) => {
      const totalA = a.yes + a.no + a.na;
      const totalB = b.yes + b.no + b.na;
      const percentA = totalA > 0 ? (a.yes / totalA) * 100 : 0;
      const percentB = totalB > 0 ? (b.yes / totalB) * 100 : 0;
      return percentB - percentA;
    });

    return {
      labels: sortedData.map((item) =>
        item.parameterName.length > 20
          ? item.parameterName.substring(0, 20) + "..."
          : item.parameterName
      ),
      datasets: [
        {
          label: `${complianceLabels.yes} %`,
          data: sortedData.map((item) => {
            const total = item.yes + item.no + item.na;
            return total > 0 ? (item.yes / total) * 100 : 0;
          }),
          backgroundColor: "rgba(34, 197, 94, 0.8)",
          borderColor: "rgb(34, 197, 94)",
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: `${complianceLabels.no} %`,
          data: sortedData.map((item) => {
            const total = item.yes + item.no + item.na;
            return total > 0 ? (item.no / total) * 100 : 0;
          }),
          backgroundColor: "rgba(239, 68, 68, 0.8)",
          borderColor: "rgb(239, 68, 68)",
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: `${complianceLabels.na} %`,
          data: sortedData.map((item) => {
            const total = item.yes + item.no + item.na;
            return total > 0 ? (item.na / total) * 100 : 0;
          }),
          backgroundColor: "rgba(156, 163, 175, 0.8)",
          borderColor: "rgb(156, 163, 175)",
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  };

  return (
    <div className="w-full space-y-6" id="section-analytics-dashboard">
      {/* <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-3xl font-bold flex items-center">
              <BarChart3 className="w-8 h-8 mr-3" />
              Section-Based Analytics
            </h3>
            <p className="text-blue-100 text-sm mt-2">Comprehensive overview of questions, follow-ups, and engagement by section</p>
          </div>
        </div>
      </div> */}

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-left flex items-center justify-between hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-gray-900 dark:text-white font-medium">
              {selectedSectionIds.length === 0
                ? "Select Sections (All)"
                : `${selectedSectionIds.length} section${
                    selectedSectionIds.length > 1 ? "s" : ""
                  } selected`}
            </span>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform ${
              isDropdownOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isDropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl z-10">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <input
                type="text"
                placeholder="Search sections..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="max-h-64 overflow-y-auto">
              {filteredSectionOptions.map((section) => (
                <label
                  key={section.id}
                  className="flex items-center px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedSectionIds.includes(section.id)}
                    onChange={() => handleSelectSection(section.id)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="ml-3 text-gray-900 dark:text-white font-medium text-sm">
                    {section.title}
                  </span>
                </label>
              ))}
            </div>

            {selectedSectionIds.length > 0 && (
              <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                <button
                  onClick={handleClearAll}
                  className="flex-1 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2">
        {/* Total Sections: Count of all form sections being displayed */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg p-3 border border-blue-200 dark:border-blue-700/50 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              Sections
            </span>
            <Target className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-200">
            {totalMetrics.sections}
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400">
            Total sections
          </p>
        </div>

        {/* Total Main Questions: Aggregate count of all primary questions across selected sections */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-lg p-3 border border-green-200 dark:border-green-700/50 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-green-600 dark:text-green-400">
              Main Q
            </span>
            <Activity className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-green-900 dark:text-green-200">
            {totalMetrics.totalMainQuestions}
          </div>
          <p className="text-xs text-green-600 dark:text-green-400">Primary</p>
        </div>

        {/* Total Follow-up Questions: Aggregate count of all conditional/dependent questions across selected sections */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-lg p-3 border border-purple-200 dark:border-purple-700/50 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
              Follow-ups
            </span>
            <Zap className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-purple-900 dark:text-purple-200">
            {totalMetrics.totalFollowUpQuestions}
          </div>
          <p className="text-xs text-purple-600 dark:text-purple-400">
            Dependent
          </p>
        </div>

        {/* Total Answered Questions: Aggregate count of all questions (main + follow-ups) that received responses across selected sections */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 rounded-lg p-3 border border-orange-200 dark:border-orange-700/50 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
              Answered
            </span>
            <TrendingUp className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-orange-900 dark:text-orange-200">
            {totalMetrics.totalQuestionsAnswered}
          </div>
          <p className="text-xs text-orange-600 dark:text-orange-400">Total</p>
        </div>

        {/* Average Completion Rate: Mean completion percentage across all selected sections */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 rounded-lg p-3 border border-red-200 dark:border-red-700/50 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-red-600 dark:text-red-400">
              Avg Rate
            </span>
            <BarChart3 className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-900 dark:text-red-200">
            {totalMetrics.avgCompletionRate}%
          </div>
          <p className="text-xs text-red-600 dark:text-red-400">Completion</p>
        </div>
        {/* Visualization Type Toggle: Switch between Spider (radar) and Bar chart views */}
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/30 rounded-lg p-3 border border-indigo-200 dark:border-indigo-700/50 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              View
            </span>
            <BarChart className="w-4 h-4 text-indigo-500" />
          </div>

          <div className="mt-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setVisualizationType("radar")}
                className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-all ${
                  visualizationType === "radar"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                Spider
              </button>
              <button
                onClick={() => setVisualizationType("bar")}
                className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-all ${
                  visualizationType === "bar"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                Bar
              </button>
            </div>
          </div>
        </div>
      </div>

      {displaySections.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center border border-gray-100 dark:border-gray-700">
          <Target className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            No sections selected
          </p>
          <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">
            Select at least one section to view analytics
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {displaySections.map(({ section, stats }, sectionIdx) => {
            const isExpanded = expandedSections[section.id] === true;
            // Add this function inside SectionAnalytics component, before the sectionsStats useMemo
            const qualityBreakdown = getSectionQualityBreakdown(section);

            // Get top 5 parameters for radar (or all if less than 5)
            const radarParameters = qualityBreakdown
              .slice()
              .map((item) =>
                item.parameterName.length > 12
                  ? item.parameterName.substring(0, 12) + "..."
                  : item.parameterName
              );

            // Calculate percentages for radar
            const radarData = radarParameters.map((_, index) => {
              if (index < qualityBreakdown.length) {
                const item = qualityBreakdown[index];
                const total = item.yes + item.no + item.na;
                if (total > 0) {
                  // Return the percentage of "Yes" responses for this parameter
                  return (item.yes / total) * 100;
                }
              }
              return 0;
            });
            const overallQuality = calculateOverallQuality(qualityBreakdown);
            const noParamData = qualityBreakdown.length === 0;

            return (
              <div
                key={section.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-all"
                id={`section-analytics-${section.id}`}
              >
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 text-left hover:from-blue-600 hover:to-blue-700 transition-all flex items-center justify-between group shadow-sm"
                >
                  <div>
                    <h4 className="text-lg font-bold text-white flex items-center gap-1">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-white/20 rounded text-xs">
                        {sectionIdx + 1}
                      </span>
                      {section.title}
                    </h4>
                    {section.description && (
                      <p className="text-blue-100 text-xs mt-0.5">
                        {section.description}
                      </p>
                    )}
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-white transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isExpanded && (
                  <div className="p-4">
                    <div
                      className={`grid grid-cols-1 ${
                        !noParamData ? "lg:grid-cols-3" : ""
                      } gap-4`}
                    >
                      <div className={`${!noParamData ? "lg:col-span-1" : ""}`}>
                        {/* <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                          Main Questions: Count of primary/root level questions in this section
                          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg p-4 border border-blue-200 dark:border-blue-700/50">
                            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">Main Q</p>
                            <p className="text-2xl font-bold text-blue-900 dark:text-blue-200 mt-2">{stats.mainQuestionCount}</p>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Questions</p>
                          </div>

                          Follow-up Questions: Count of conditional/dependent follow-up questions
                          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-lg p-4 border border-purple-200 dark:border-purple-700/50">
                            <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase">Follow-ups</p>
                            <p className="text-2xl font-bold text-purple-900 dark:text-purple-200 mt-2">{stats.totalFollowUpCount}</p>
                            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Questions</p>
                          </div>

                          Answered Questions: Total count of main + follow-up questions that received at least one response
                          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-lg p-4 border border-green-200 dark:border-green-700/50">
                            <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase">Answered</p>
                            <p className="text-2xl font-bold text-green-900 dark:text-green-200 mt-2">{stats.totalAnswered}</p>
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                              {stats.answeredMainQuestions}M + {stats.answeredFollowUpQuestions}F
                            </p>
                          </div>

                          Completion Rate: Percentage of all questions (main + follow-ups) that have been answered
                          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg p-4 border border-blue-200 dark:border-blue-700/50">
                            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">Completion</p>
                            <p className="text-2xl font-bold text-blue-900 dark:text-blue-200 mt-2">{stats.completionRate}%</p>
                            <div className="mt-2 bg-blue-200 dark:bg-blue-700/30 rounded-full h-1.5">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-blue-600 h-1.5 rounded-full transition-all"
                                style={{ width: `${stats.completionRate}%` }}
                              ></div>
                            </div>
                          </div>

                          Average Responses Per Question: Total number of responses divided by total number of questions
                          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg p-4 border border-blue-200 dark:border-blue-700/50">
                            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">Avg Response</p>
                            <p className="text-2xl font-bold text-blue-900 dark:text-blue-200 mt-2">{stats.avgResponsesPerQuestion}</p>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Per question</p>
                          </div>

                          Total Responses: Sum of all responses from all respondents across all questions in this section
                          <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/30 dark:to-cyan-800/30 rounded-lg p-4 border border-cyan-200 dark:border-cyan-700/50">
                            <p className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 uppercase">Total Responses</p>
                            <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-200 mt-2">{stats.totalResponses}</p>
                            <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">All questions</p>
                          </div>
                        </div> */}

                        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                          <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                            <Activity className="w-4 h-4 mr-1.5 text-blue-600" />
                            Question Details
                          </h5>
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {stats.questionsDetail.map(
                              (q: any, idx: number) => (
                                <div key={q.id}>
                                  {/* ========== UPDATE THIS DIV TO BE A BUTTON ========== */}
                                  <button
                                    onClick={() =>
                                      setSelectedQuestion({
                                        question: q,
                                        sectionTitle: section.title,
                                        formData: question,
                                      })
                                    }
                                    className="w-full text-left flex items-start justify-between p-2 bg-white dark:bg-gray-800 rounded border-l-4 border-blue-500 hover:shadow-sm transition-all hover:border-blue-600 group"
                                  >
                                    <div className="flex-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded group-hover:bg-blue-200 group-hover:text-blue-700">
                                          {idx + 1}
                                        </span>
                                        <p className="text-xs font-medium text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                                          {q.text.length > 70
                                            ? q.text.substring(0, 70) + "..."
                                            : q.text}
                                        </p>
                                      </div>
                                      {q.followUpCount > 0 && (
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 ml-7">
                                          {q.followUpCount} follow-up
                                          {q.followUpCount > 1 ? "s" : ""}
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-right ml-2 flex-shrink-0">
                                      <div className="text-base font-bold text-blue-600 dark:text-blue-400 group-hover:text-blue-700">
                                        {q.responses}
                                      </div>
                                      <div className="text-xs text-blue-500 flex items-center justify-end gap-0.5">
                                        <Eye className="w-2.5 h-2.5" />
                                        View
                                      </div>
                                    </div>
                                  </button>
                                  {/* ========== END OF UPDATE ========== */}

                                  {q.followUpDetails &&
                                    q.followUpDetails.length > 0 && (
                                      <div className="ml-6 mt-2 space-y-2">
                                        {q.followUpDetails.map(
                                          (fq: any, fIdx: number) => (
                                            // ========== UPDATE THIS DIV TO BE A BUTTON ==========
                                            <button
                                              key={fq.id}
                                              onClick={() =>
                                                setSelectedQuestion({
                                                  question: fq,
                                                  sectionTitle: section.title,
                                                  formData: question,
                                                })
                                              }
                                              className="w-full text-left flex items-start justify-between p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded border-l-2 border-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:border-blue-500 transition-all group"
                                            >
                                              <div className="flex-1">
                                                <div className="flex items-center gap-1">
                                                  <span className="inline-flex items-center justify-center w-3 h-3 bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-sm">
                                                    •
                                                  </span>
                                                  <p className="text-xs font-medium text-gray-900 dark:text-white group-hover:text-blue-600">
                                                    {fq.text.length > 65
                                                      ? fq.text.substring(
                                                          0,
                                                          65
                                                        ) + "..."
                                                      : fq.text}
                                                  </p>
                                                </div>
                                              </div>
                                              <div className="text-right ml-2 flex-shrink-0">
                                                <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                                  {fq.responses}
                                                </div>
                                                <div className="text-[9px] text-blue-500 flex items-center justify-end gap-0.5">
                                                  <Eye className="w-2 h-2" />
                                                  View
                                                </div>
                                              </div>
                                            </button>
                                            // ========== END OF UPDATE ==========
                                          )
                                        )}
                                      </div>
                                    )}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                      {!noParamData && (
                        <div className="lg:col-span-2 space-y-3">
                          {/* Overall Quality Pie Chart - TOP SECTION */}
                          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                            <div className="flex flex-col lg:flex-row gap-8">
                              {/* Pie Chart */}
                              <div className="lg:w-1/2">
                                <h6 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-4 flex items-center">
                                  <Activity className="w-4 h-4 mr-2" />
                                  Overall Quality Distribution
                                </h6>

                                <div
                                  style={{ width: "100%", height: "200px" }}
                                  id={`section-pie-chart-${section.id}`}
                                >
                                  <Pie
                                    data={{
                                      labels: [complianceLabels.yes, complianceLabels.no, complianceLabels.na],
                                      datasets: [
                                        {
                                          data: [
                                            overallQuality.totalYes,
                                            overallQuality.totalNo,
                                            overallQuality.totalNA,
                                          ],
                                          backgroundColor: [
                                            "rgba(34, 197, 94, 0.8)", // Green for Yes
                                            "rgba(239, 68, 68, 0.8)", // Red for No
                                            "rgba(156, 163, 175, 0.8)", // Gray for N/A
                                          ],
                                          borderColor: [
                                            "rgb(34, 197, 94)",
                                            "rgb(239, 68, 68)",
                                            "rgb(156, 163, 175)",
                                          ],
                                          borderWidth: 2,
                                          hoverOffset: 15,
                                        },
                                      ],
                                    }}
                                    options={{
                                      responsive: true,
                                      maintainAspectRatio: false,
                                      interaction: {
                                        mode: "index" as const,
                                        intersect: false,
                                      },
                                      plugins: {
                                        legend: {
                                          position: "right",
                                          labels: {
                                            color:
                                              document.documentElement.classList.contains(
                                                "dark"
                                              )
                                                ? "#e5e7eb"
                                                : "#374151",
                                            font: {
                                              size: 12,
                                            },
                                            padding: 20,
                                          },
                                        },
                                        tooltip: {
                                          callbacks: {
                                            label: function (context) {
                                              const label = context.label || "";
                                              const value = context.raw || 0;
                                              const total =
                                                context.dataset.data.reduce(
                                                  (a: number, b: number) =>
                                                    a + b,
                                                  0
                                                );
                                              const percentage =
                                                total > 0
                                                  ? (
                                                      (value / total) *
                                                      100
                                                    ).toFixed(1)
                                                  : 0;
                                              return `${label}: ${value} (${percentage}%)`;
                                            },
                                          },
                                        },
                                        datalabels: {
                                          color: "#fff",
                                          font: {
                                            weight: "bold",
                                            size: 12,
                                          },
                                          formatter: (value, context) => {
                                            const total =
                                              context.dataset.data.reduce(
                                                (a, b) => a + b,
                                                0
                                              );
                                            const percentage =
                                              total > 0
                                                ? (value / total) * 100
                                                : 0;

                                            // Hide if percentage is 0 or less than 0.1%
                                            if (percentage < 0.1) return null;

                                            return `${percentage.toFixed(1)}%`;
                                          },
                                        },
                                      },
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Stats Cards */}
                              <div className="lg:w-1/2">
                                <h6 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-4 flex items-center">
                                  <BarChart3 className="w-4 h-4 mr-2" />
                                  Overall Quality Metrics
                                </h6>
                                <div className="grid grid-cols-3 gap-4">
                                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-lg p-4 border border-green-200 dark:border-green-700">
                                    <div className="text-center">
                                      <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                                        {overallQuality.percentages.yes}%
                                      </div>
                                      <div className="text-sm font-semibold text-green-600 dark:text-green-400 mt-1">
                                        {complianceLabels.yes}
                                      </div>
                                      <div className="text-xs text-green-500 dark:text-green-500 mt-1">
                                        {overallQuality.totalYes} responses
                                      </div>
                                    </div>
                                  </div>

                                  <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/30 rounded-lg p-4 border border-red-200 dark:border-red-700">
                                    <div className="text-center">
                                      <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                                        {overallQuality.percentages.no}%
                                      </div>
                                      <div className="text-sm font-semibold text-red-600 dark:text-red-400 mt-1">
                                        {complianceLabels.no}
                                      </div>
                                      <div className="text-xs text-red-500 dark:text-red-500 mt-1">
                                        {overallQuality.totalNo} responses
                                      </div>
                                    </div>
                                  </div>

                                  <div className="bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/30 dark:to-slate-900/30 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                                    <div className="text-center">
                                      <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                                        {overallQuality.percentages.na}%
                                      </div>
                                      <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mt-1">
                                        {complianceLabels.na}
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                        {overallQuality.totalNA} responses
                                      </div>
                                    </div>
                                  </div>

                                  {/* Summary Card */}
                                  <div className="col-span-3 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-lg p-4 border border-blue-200 dark:border-blue-700 mt-2">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <div className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                                          Total Responses
                                        </div>
                                        <div className="text-2xl font-bold text-blue-900 dark:text-blue-200 mt-1">
                                          {overallQuality.totalYes +
                                            overallQuality.totalNo +
                                            overallQuality.totalNA}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-sm text-blue-600 dark:text-blue-400">
                                          {qualityBreakdown.length} Parameters
                                        </div>
                                        <div className="text-xs text-blue-500 dark:text-blue-500">
                                          {overallQuality.totalResponses}{" "}
                                          questions
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Radar Chart - BOTTOM SECTION */}
                          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                              <h6 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center">
                                <Target className="w-4 h-4 mr-2" />
                                Parameter-wise Quality Breakdown
                              </h6>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  View:
                                </span>
                                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                                  <button
                                    onClick={() =>
                                      setVisualizationType("radar")
                                    }
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                                      visualizationType === "radar"
                                        ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                    }`}
                                  >
                                    Spider
                                  </button>
                                  <button
                                    onClick={() => setVisualizationType("bar")}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                                      visualizationType === "bar"
                                        ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                    }`}
                                  >
                                    Bar
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div
                              style={{ width: "100%", height: "300px" }}
                              id={`section-visualization-${section.id}`}
                            >
                              {visualizationType === "radar" ? (
                                <Radar
                                  data={{
                                    labels: qualityBreakdown.map((item) =>
                                      item.parameterName.length > 15
                                        ? item.parameterName.substring(0, 15) +
                                          "..."
                                        : item.parameterName
                                    ),
                                    datasets: [
                                      {
                                        label: `${complianceLabels.yes} %`,
                                        data: qualityBreakdown.map((item) => {
                                          const total =
                                            item.yes + item.no + item.na;
                                          return total > 0
                                            ? (item.yes / total) * 100
                                            : 0;
                                        }),
                                        borderColor: "rgb(34, 197, 94)",
                                        backgroundColor:
                                          "rgba(34, 197, 94, 0.1)",
                                        pointBackgroundColor:
                                          "rgb(34, 197, 94)",
                                        pointBorderColor: "#fff",
                                        pointHoverBackgroundColor: "#fff",
                                        pointHoverBorderColor:
                                          "rgb(34, 197, 94)",
                                        pointRadius: 4,
                                        pointHoverRadius: 6,
                                      },
                                      {
                                        label: `${complianceLabels.no} %`,
                                        data: qualityBreakdown.map((item) => {
                                          const total =
                                            item.yes + item.no + item.na;
                                          return total > 0
                                            ? (item.no / total) * 100
                                            : 0;
                                        }),
                                        borderColor: "rgb(239, 68, 68)",
                                        backgroundColor:
                                          "rgba(239, 68, 68, 0.1)",
                                        pointBackgroundColor:
                                          "rgb(239, 68, 68)",
                                        pointBorderColor: "#fff",
                                        pointHoverBackgroundColor: "#fff",
                                        pointHoverBorderColor:
                                          "rgb(239, 68, 68)",
                                        pointRadius: 4,
                                        pointHoverRadius: 6,
                                      },
                                      {
                                        label: `${complianceLabels.na} %`,
                                        data: qualityBreakdown.map((item) => {
                                          const total =
                                            item.yes + item.no + item.na;
                                          return total > 0
                                            ? (item.na / total) * 100
                                            : 0;
                                        }),
                                        borderColor: "rgb(156, 163, 175)",
                                        backgroundColor:
                                          "rgba(156, 163, 175, 0.1)",
                                        pointBackgroundColor:
                                          "rgb(156, 163, 175)",
                                        pointBorderColor: "#fff",
                                        pointHoverBackgroundColor: "#fff",
                                        pointHoverBorderColor:
                                          "rgb(156, 163, 175)",
                                        pointRadius: 4,
                                        pointHoverRadius: 6,
                                      },
                                    ],
                                  }}
                                  options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    interaction: {
                                      mode: "index" as const,
                                      axis: "r" as const,
                                      intersect: false,
                                    },
                                    plugins: {
                                      datalabels: {
                                        display: false,
                                      },
                                      legend: {
                                        display: true,
                                        position: "bottom",
                                        labels: {
                                          color:
                                            document.documentElement.classList.contains(
                                              "dark"
                                            )
                                              ? "#e5e7eb"
                                              : "#374151",
                                          font: {
                                            size: 11,
                                            weight: "600",
                                          },
                                        },
                                      },
                                      tooltip: {
                                        backgroundColor: "rgba(0, 0, 0, 0.8)",
                                        padding: 10,
                                        titleFont: { size: 12, weight: "bold" },
                                        bodyFont: { size: 11 },
                                        callbacks: {
                                          label: function (context: any) {
                                            const label = context.dataset.label;
                                            const value =
                                              context.parsed.r.toFixed(2);
                                            const paramIndex =
                                              context.dataIndex;

                                            if (
                                              paramIndex <
                                              qualityBreakdown.length
                                            ) {
                                              const item =
                                                qualityBreakdown[paramIndex];
                                              const total =
                                                item.yes + item.no + item.na;

                                              if (label === `${complianceLabels.yes} %`) {
                                                return `${complianceLabels.yes}: ${item.yes}/${total} (${value}%)`;
                                              } else if (label === `${complianceLabels.no} %`) {
                                                return `${complianceLabels.no}: ${item.no}/${total} (${value}%)`;
                                              } else if (label === `${complianceLabels.na} %`) {
                                                return `${complianceLabels.na}: ${item.na}/${total} (${value}%)`;
                                              }
                                            }

                                            return `${label}: ${value}%`;
                                          },
                                          title: function (
                                            tooltipItems: any[]
                                          ) {
                                            const paramIndex =
                                              tooltipItems[0].dataIndex;
                                            if (
                                              paramIndex <
                                              qualityBreakdown.length
                                            ) {
                                              return qualityBreakdown[
                                                paramIndex
                                              ].parameterName;
                                            }
                                            return "";
                                          },
                                        },
                                      },
                                    },
                                    scales: {
                                      r: {
                                        beginAtZero: true,
                                        max: 100,
                                        ticks: {
                                          stepSize: 20,
                                          color:
                                            document.documentElement.classList.contains(
                                              "dark"
                                            )
                                              ? "#9ca3af"
                                              : "#9ca3af",
                                          font: {
                                            size: 10,
                                          },
                                          callback: function (value) {
                                            return value + "%";
                                          },
                                        },
                                        grid: {
                                          color:
                                            document.documentElement.classList.contains(
                                              "dark"
                                            )
                                              ? "rgba(147, 197, 253, 0.3)"
                                              : "rgba(59, 130, 246, 0.3)",
                                          lineWidth: 1.5,
                                        },
                                        pointLabels: {
                                          color:
                                            document.documentElement.classList.contains(
                                              "dark"
                                            )
                                              ? "#e5e7eb"
                                              : "#1f2937",
                                          font: {
                                            size: 9,
                                            weight: "600",
                                          },
                                          padding: 8,
                                        },
                                        angleLines: {
                                          display: true,
                                          color:
                                            document.documentElement.classList.contains(
                                              "dark"
                                            )
                                              ? "rgba(147, 197, 253, 0.4)"
                                              : "rgba(59, 130, 246, 0.4)",
                                          lineWidth: 1.5,
                                        },
                                      },
                                    },
                                  }}
                                />
                              ) : (
                                <Bar
                                  data={prepareBarChartData(qualityBreakdown)}
                                  options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    indexAxis: "y",
                                    interaction: {
                                      mode: "index" as const,
                                      axis: "y" as const,
                                      intersect: false,
                                    },
                                    plugins: {
                                      datalabels: {
                                        display: false,
                                      },
                                      legend: {
                                        display: true,
                                        position: "bottom",
                                        labels: {
                                          color:
                                            document.documentElement.classList.contains(
                                              "dark"
                                            )
                                              ? "#e5e7eb"
                                              : "#374151",
                                          font: {
                                            size: 11,
                                            weight: "600",
                                          },
                                        },
                                      },
                                      tooltip: {
                                        backgroundColor: "rgba(0, 0, 0, 0.8)",
                                        padding: 10,
                                        titleFont: { size: 12, weight: "bold" },
                                        bodyFont: { size: 11 },
                                        callbacks: {
                                          label: function (context: any) {
                                            const label = context.dataset.label;
                                            const value =
                                              context.parsed.x.toFixed(2);
                                            const paramIndex =
                                              context.dataIndex;

                                            if (
                                              paramIndex <
                                              qualityBreakdown.length
                                            ) {
                                              const sortedData = [
                                                ...qualityBreakdown,
                                              ].sort((a, b) => {
                                                const totalA =
                                                  a.yes + a.no + a.na;
                                                const totalB =
                                                  b.yes + b.no + b.na;
                                                const percentA =
                                                  totalA > 0
                                                    ? (a.yes / totalA) * 100
                                                    : 0;
                                                const percentB =
                                                  totalB > 0
                                                    ? (b.yes / totalB) * 100
                                                    : 0;
                                                return percentB - percentA;
                                              });
                                              const item =
                                                sortedData[paramIndex];
                                              const total =
                                                item.yes + item.no + item.na;

                                              if (label === `${complianceLabels.yes} %`) {
                                                return `${complianceLabels.yes}: ${item.yes}/${total} (${value}%)`;
                                              } else if (label === `${complianceLabels.no} %`) {
                                                return `${complianceLabels.no}: ${item.no}/${total} (${value}%)`;
                                              } else if (label === `${complianceLabels.na} %`) {
                                                return `${complianceLabels.na}: ${item.na}/${total} (${value}%)`;
                                              }
                                            }

                                            return `${label}: ${value}%`;
                                          },
                                          title: function (
                                            tooltipItems: any[]
                                          ) {
                                            const paramIndex =
                                              tooltipItems[0].dataIndex;
                                            const sortedData = [
                                              ...qualityBreakdown,
                                            ].sort((a, b) => {
                                              const totalA =
                                                a.yes + a.no + a.na;
                                              const totalB =
                                                b.yes + b.no + b.na;
                                              const percentA =
                                                totalA > 0
                                                  ? (a.yes / totalA) * 100
                                                  : 0;
                                              const percentB =
                                                totalB > 0
                                                  ? (b.yes / totalB) * 100
                                                  : 0;
                                              return percentB - percentA;
                                            });
                                            if (
                                              paramIndex < sortedData.length
                                            ) {
                                              return sortedData[paramIndex]
                                                .parameterName;
                                            }
                                            return "";
                                          },
                                        },
                                      },
                                    },
                                    scales: {
                                      x: {
                                        beginAtZero: true,
                                        max: 100,
                                        ticks: {
                                          stepSize: 20,
                                          color:
                                            document.documentElement.classList.contains(
                                              "dark"
                                            )
                                              ? "#9ca3af"
                                              : "#9ca3af",
                                          font: {
                                            size: 10,
                                          },
                                          callback: function (value) {
                                            return value + "%";
                                          },
                                        },
                                        grid: {
                                          color:
                                            document.documentElement.classList.contains(
                                              "dark"
                                            )
                                              ? "rgba(107, 114, 128, 0.2)"
                                              : "rgba(209, 213, 219, 0.3)",
                                          lineWidth: 1,
                                        },
                                        title: {
                                          display: true,
                                          text: "Percentage",
                                          color:
                                            document.documentElement.classList.contains(
                                              "dark"
                                            )
                                              ? "#e5e7eb"
                                              : "#374151",
                                          font: {
                                            size: 11,
                                            weight: "600",
                                          },
                                        },
                                      },
                                      y: {
                                        ticks: {
                                          color:
                                            document.documentElement.classList.contains(
                                              "dark"
                                            )
                                              ? "#e5e7eb"
                                              : "#1f2937",
                                          font: {
                                            size: 9,
                                            weight: "600",
                                          },
                                          padding: 0, // Remove padding
                                          crossAlign: "near", // Align labels to the near side (left for y-axis)
                                          mirror: false, // Don't mirror
                                        },
                                        grid: {
                                          display: false,
                                        },
                                        afterFit: function (scaleInstance) {
                                          // This ensures the labels are properly positioned
                                          scaleInstance.paddingLeft = 0;
                                        },
                                      },
                                    },
                                    layout: {
                                      padding: {
                                        left: 0, // Remove left padding
                                        right: 10,
                                      },
                                    },
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {selectedQuestion && (
        <QuestionDetailsModal
          question={selectedQuestion.question}
          responses={responses}
          sectionTitle={selectedQuestion.sectionTitle}
          formData={selectedQuestion.formData}
          onClose={() => setSelectedQuestion(null)}
          complianceLabels={complianceLabels}
        />
      )}
    </div>
  );
}
