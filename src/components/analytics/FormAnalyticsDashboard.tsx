import React, { useState, useEffect, useMemo, useRef, useCallback, useTransition, useDeferredValue } from "react";
import {
  useParams,
  useNavigate,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import CameraCapture from "../forms/CameraCapture";
import {
  exportDashboardToPDF,
  exportFormAnalyticsToPDF,
} from "../../utils/formanalyticsexport";
import {
  Users as UsersIcon,
  Search,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  Link2,
  Clock,
  XCircle,
  BarChart3,
  Calendar,
  FileText,
  ArrowLeft,
  TrendingUp,
  PieChart,
  Download,
  Table,
  Edit,
  Trash2,
  Eye,
  MoreHorizontal,
  X,
  Share2,
  Mail,
  Send,
  MessageCircle,
  Info,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Filter,
  Reply,
  Upload,
  Camera,
  Loader2,
  Maximize,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { createPortal } from "react-dom";
import { Pie, Doughnut, Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  RadialLinearScale,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { apiClient } from "../../api/client";
import ResponseQuestion from "./ResponseQuestion";
import SectionAnalytics from "./SectionAnalytics";
import CascadingFilterModal from "./CascadingFilterModal";
import * as XLSX from "xlsx-js-style";
import { isImageUrl, formatToDDMMYYYY } from "../../utils/answerTemplateUtils";
import ImageLink from "../ImageLink";
import FilePreview from "../FilePreview";
import TableColumnFilter from "./TableColumnFilter";
import ShareAnalyticsModal from "./ShareAnalyticsModal";
import AutoSendModal from "../forms/AutoSendModal";

import { useTheme } from "../../context/ThemeContext";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  RadialLinearScale,
  ChartDataLabels,
);

interface Response {
  _id?: string;
  id: string;
  questionId: string;
  answers: Record<string, any>;
  timestamp?: string;
  createdAt?: string; // MongoDB timestamp field
  submittedAt?: string;
  parentResponseId?: string;
  assignedTo?: string;
  assignedAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  status?: "pending" | "verified" | "rejected";
  notes?: string;
  submissionMetadata?: {
    location?: {
      city?: string;
      country?: string;
      region?: string;
      latitude?: number;
      longitude?: number;
    };
    capturedLocation?: {
      latitude?: number;
      longitude?: number;
    };
  };
  questionTimings?: Array<{ questionId: string; timeSpent: number }>;
  totalTimeSpent?: number;
  responseRanks?: Record<string, number>;
  createdBy?: string;
  isDispatched?: boolean;
  dispatchedAt?: string;
  dispatchedBy?: string;
  dispatchedByName?: string;
  tenantId?: string;
  submittedBy?: string;
  timeSpent?: number;
  submitterContact?: {
    email?: string;
  };
  biwReview?: {
    status: "Accepted" | "Rejected" | "Reworked";
    remark?: string | null;
    evidenceUrl?: string | null;
    flaggedQuestions?: { questionId: string; questionText: string }[];
    reviewedBy?: string;
    reviewedByName?: string;
    reviewedAt?: string;
  };
}

// Helper function to extract a valid, verified timestamp from response with year-format check
const getResponseTimestamp = (response: Response): string | undefined => {
  if (!response) return undefined;

  const currentYear = new Date().getFullYear();
  const isValidYear = (d: Date | null): boolean => {
    if (!d || isNaN(d.getTime())) return false;
    const y = d.getFullYear();
    // Valid manufacturing inspection year: 2020 through next year (currentYear + 1)
    return y >= 2020 && y <= currentYear + 1;
  };

  const toDate = (val: any): Date | null => {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const rawCandidates = [
    response.submittedAt,
    response.createdAt,
    response.timestamp,
    (response as any).submissionMetadata?.submittedAt,
    (response as any).submissionMetadata?.capturedLocation?.capturedAt,
    (response as any).updatedAt,
    (response as any).dispatchedAt,
  ];

  // 1. Return first candidate that parses with a valid realistic year
  for (const c of rawCandidates) {
    if (!c) continue;
    const d = toDate(c);
    if (d && isValidYear(d)) {
      return d.toISOString();
    }
  }

  // 2. If all candidates have an unrealistic year (e.g. > currentYear + 1), check metadata or clamp
  const fallback =
    response.submittedAt ||
    response.createdAt ||
    response.timestamp ||
    (response as any).submissionMetadata?.submittedAt ||
    (response as any).submissionMetadata?.capturedLocation?.capturedAt;
  if (fallback) {
    const d = toDate(fallback);
    if (d) {
      if (d.getFullYear() > currentYear + 1) {
        d.setFullYear(currentYear);
      }
      return d.toISOString();
    }
  }

  return undefined;
};

// Formats timestamp into YYYY-MM-DD in the local timezone (preventing UTC shifts for shift/morning inspections)
const toLocalDateString = (timestamp: any): string => {
  if (!timestamp) return "";
  if (typeof timestamp === "string" && /^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
    return timestamp;
  }
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

interface Section {
  weightage(weightage: any): unknown;
  id: string;
  title: string;
  description?: string;
  questions: FollowUpQuestion[];
}

interface FollowUpQuestion {
  id: string;
  text: string;
  type: string;
  required?: boolean;
  options?: string[];
  description?: string;
  followUpQuestions?: FollowUpQuestion[];
  correctAnswer?: any;
  trackResponseRank?: boolean;
  trackResponseQuestion?: boolean;
}
interface ChassisNumberEntry {
  _id?: string;
  chassisNumber: string;
  partDescription?: string;
}

interface Form {
  _id: string;
  id?: string;
  title: string;
  description?: string;
  createdAt?: string;
  isVisible?: boolean;
  logoUrl?: string;
  imageUrl?: string;
  sections?: Section[];
  followUpQuestions?: FollowUpQuestion[];
  parentFormId?: string;
  parentFormTitle?: string;
  chassisNumbers?: ChassisNumberEntry[];
  tenantId?: string | { _id?: string; toString?: () => string };
}

type SectionPerformanceStat = {
  id: string;
  title: string;
  yes: number;
  no: number;
  na: number;
  accepted?: number;
  rejected?: number;
  rework?: number;
  total: number;
  weightage: number;
};

type QuestionPerformanceStat = {
  id: string;
  text: string;
  sectionTitle: string;
  accepted: number;
  rejected: number;
  rework: number;
  total: number;
};

// Add this interface
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

export interface ZoneAnalyticsData {
  inspectionStatus: {
    accepted: number;
    rework: number;
    rejected: number;
    total: number;
  };
  zoneBreakdown: Array<{
    zone: string;
    categories: Array<{
      category: string;
      count: number;
      defects: Array<{
        name: string;
        count: number;
        reworkCount: number;
        rejectedCount: number;
      }>;
    }>;
  }>;
}

// Add helper functions
const getSectionQualityBreakdown = (
  section: Section,
  responses: Response[],
): Array<{
  parameterName: string;
  yes: number;
  no: number;
  na: number;
  total: number;
}> => {
  const qualityData: Array<{
    parameterName: string;
    yes: number;
    no: number;
    na: number;
    total: number;
  }> = [];

  const parameterGroups = new Map<
    string,
    {
      parameterName: string;
      yes: number;
      no: number;
      na: number;
      total: number;
      isRealParameter: boolean;
    }
  >();

  const questionIdToGroup = new Map<string, any>();

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
          isRealParameter: hasRealParameter,
        });
      }

      const group = parameterGroups.get(paramName)!;
      questionIdToGroup.set(q.id, group);
    }
  });

  // Count responses for these questions in one single pass over responses
  responses.forEach((response) => {
    if (!response.answers) return;
    for (const [qId, answer] of Object.entries(response.answers)) {
      if (answer === null || answer === undefined || answer === "") {
        continue;
      }
      const group = questionIdToGroup.get(qId);
      if (!group) continue;

      group.total++;

      // Check if it's an inspection status object (like from ChassisWithZone)
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
      } else {
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
        } else if (answerStr.includes("yes") || answerStr === "y") {
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

  // Convert map to array and filter out groups that don't have real parameters
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

// Add calculateOverallQuality function
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

const getZoneAnalytics = (responses: Response[]): ZoneAnalyticsData => {
  const stats: ZoneAnalyticsData = {
    inspectionStatus: { accepted: 0, rework: 0, rejected: 0, total: 0 },
    zoneBreakdown: [],
  };

  const zoneMap = new Map<
    string,
    Map<
      string,
      {
        count: number;
        defects: Map<
          string,
          { total: number; rework: number; rejected: number }
        >;
      }
    >
  >();

  responses.forEach((response) => {
    if (!response.answers) return;

    Object.values(response.answers).forEach((answer) => {
      if (
        typeof answer === "object" &&
        answer !== null &&
        (answer.chassisNumber ||
          answer.status ||
          answer.zonesData ||
          answer.zones)
      ) {
        // This looks like a ChassisWithZone or ZoneIn/Out answer
        const statusVal = (answer.status || "").toLowerCase().trim();
        const isAccepted =
          statusVal === "accepted" ||
          statusVal === "rework completed" ||
          statusVal === "verified";
        const isRework =
          statusVal === "rework" ||
          statusVal === "reworked" ||
          statusVal.includes("re-rework");
        const isRejected = statusVal === "rejected";

        if (isAccepted) stats.inspectionStatus.accepted++;
        else if (isRework) stats.inspectionStatus.rework++;
        else if (isRejected) stats.inspectionStatus.rejected++;

        if (statusVal) stats.inspectionStatus.total++;

        // Handle hierarchical zonesData (ChassisWithZone)
        if (answer.zonesData) {
          Object.entries(answer.zonesData).forEach(
            ([zoneName, zoneContent]: [string, any]) => {
              if (!zoneMap.has(zoneName)) {
                zoneMap.set(zoneName, new Map());
              }
              const catMap = zoneMap.get(zoneName)!;

              if (
                zoneContent.categories &&
                Array.isArray(zoneContent.categories)
              ) {
                zoneContent.categories.forEach((cat: any) => {
                  if (!catMap.has(cat.name)) {
                    catMap.set(cat.name, { count: 0, defects: new Map() });
                  }
                  const catData = catMap.get(cat.name)!;
                  catData.count++;

                  if (cat.defects && Array.isArray(cat.defects)) {
                    cat.defects.forEach((defect: any) => {
                      const defectStats = catData.defects.get(defect.name) || {
                        total: 0,
                        rework: 0,
                        rejected: 0,
                      };
                      defectStats.total++;
                      if (isRework) defectStats.rework++;
                      else if (isRejected) defectStats.rejected++;
                      catData.defects.set(defect.name, defectStats);
                    });
                  }
                });
              }
            },
          );
        }

        // Handle simple zones array (ZoneIn/ZoneOut)
        if (answer.zones && Array.isArray(answer.zones)) {
          answer.zones.forEach((zoneName: string) => {
            if (!zoneMap.has(zoneName)) {
              zoneMap.set(zoneName, new Map());
            }
            const catMap = zoneMap.get(zoneName)!;

            // For simple zones, we might use a generic "Defect" category if it's a rework/rejected
            if (isRework || isRejected) {
              const catName = "Unspecified Defects";
              if (!catMap.has(catName)) {
                catMap.set(catName, { count: 0, defects: new Map() });
              }
              const catData = catMap.get(catName)!;
              catData.count++;

              const defectName = answer.remark || "Generic Defect";
              const defectStats = catData.defects.get(defectName) || {
                total: 0,
                rework: 0,
                rejected: 0,
              };
              defectStats.total++;
              if (isRework) defectStats.rework++;
              else if (isRejected) defectStats.rejected++;
              catData.defects.set(defectName, defectStats);
            }
          });
        }
      }
    });
  });

  // Convert map to array structure
  zoneMap.forEach((catMap, zoneName) => {
    const categories: any[] = [];
    catMap.forEach((catData, catName) => {
      const defects: any[] = [];
      catData.defects.forEach((dStats, defectName) => {
        defects.push({
          name: defectName,
          count: dStats.total,
          reworkCount: dStats.rework,
          rejectedCount: dStats.rejected,
        });
      });
      categories.push({ category: catName, count: catData.count, defects });
    });
    stats.zoneBreakdown.push({ zone: zoneName, categories });
  });

  return stats;
};

// Add getSectionStats function
const getSectionStats = (
  section: Section,
  responses: Response[],
  questionResponseCounts?: Map<string, number>,
) => {
  // Filter for main questions only (not follow-ups)
  const mainQuestionsOnly = section.questions.filter(
    (q: any) => !q.parentId && !q.showWhen?.questionId,
  );

  const mainQuestionCount = mainQuestionsOnly.length;
  let totalFollowUpCount = 0;
  let answeredMainQuestions = 0;
  let answeredFollowUpQuestions = 0;
  let mainQuestionResponses = 0;
  let followUpResponses = 0;

  // Count follow-up questions
  const followUpQuestionsInSection = section.questions.filter(
    (q: any) => q.parentId || q.showWhen?.questionId,
  );
  totalFollowUpCount = followUpQuestionsInSection.length;

  const countsMap = questionResponseCounts || (() => {
    const map = new Map<string, number>();
    responses.forEach((response) => {
      if (response.answers) {
        Object.keys(response.answers).forEach((qId) => {
          const answer = response.answers[qId];
          if (answer !== null && answer !== undefined && answer !== "") {
            map.set(qId, (map.get(qId) || 0) + 1);
          }
        });
      }
    });
    return map;
  })();

  // Process follow-up questions
  followUpQuestionsInSection.forEach((followUp: any) => {
    const followUpResponders = countsMap.get(followUp.id) || 0;
    if (followUpResponders > 0) {
      answeredFollowUpQuestions++;
      followUpResponses += followUpResponders;
    }
  });

  // Process main questions
  const questionsDetail = mainQuestionsOnly.map((q: any) => {
    const mainQuestionResponders = countsMap.get(q.id) || 0;

    if (mainQuestionResponders > 0) {
      answeredMainQuestions++;
      mainQuestionResponses += mainQuestionResponders;
    }

    const relatedFollowUps = section.questions.filter(
      (fq: any) => fq.parentId === q.id || fq.showWhen?.questionId === q.id,
    );

    return {
      id: q.id,
      text: q.text || "Unnamed Question",
      followUpCount: relatedFollowUps.length,
      responses: mainQuestionResponders,
      followUpDetails: relatedFollowUps.map((fq: any) => ({
        id: fq.id,
        text: fq.text || "Unnamed Follow-up",
        responses: countsMap.get(fq.id) || 0,
      })),
    };
  });

  const totalAnswered = answeredMainQuestions + answeredFollowUpQuestions;
  const totalQuestions = mainQuestionCount + totalFollowUpCount;
  const totalResponses = mainQuestionResponses + followUpResponses;

  const completionRate =
    totalQuestions > 0
      ? ((totalAnswered / totalQuestions) * 100).toFixed(1)
      : "0.0";

  const avgResponsesPerQuestion =
    totalQuestions > 0 ? (totalResponses / totalQuestions).toFixed(1) : "0.0";

  return {
    mainQuestionCount,
    totalFollowUpCount,
    answeredMainQuestions,
    answeredFollowUpQuestions,
    totalAnswered,
    totalResponses,
    completionRate,
    avgResponsesPerQuestion,
    questionsDetail,
  };
};

const formatSectionLabel = (label: string, maxLength = 20): string => {
  if (!label) {
    return "";
  }
  const parts = label.match(/[A-Za-z0-9]+/g) || [];
  if (!parts.length) {
    return "";
  }
  const camel = parts
    .map((part, index) => {
      const lower = part.toLowerCase();
      if (index === 0) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
  if (!camel) {
    return "";
  }
  const formatted = camel.charAt(0).toUpperCase() + camel.slice(1);
  return formatted.length > maxLength
    ? `${formatted.slice(0, maxLength - 3)}...`
    : formatted;
};

const extractYesNoValues = (value: any): string[] => {
  if (value === null || value === undefined) {
    return [];
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized ? [normalized] : [];
  }
  if (typeof value === "boolean") {
    return [value ? "yes" : "no"];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractYesNoValues(item));
  }
  if (typeof value === "object") {
    return Object.values(value).flatMap((item) => extractYesNoValues(item));
  }
  return [];
};

const recognizedYesNoValues = [
  "yes",
  "no",
  "n/a",
  "na",
  "not applicable",
  "accepted",
  "rejected",
  "rework",
  "reworked",
  "verified",
  "rework completed",
];

const getRankStyle = (answer: any, darkMode: boolean = false) => {
  if (answer === null || answer === undefined) return "";
  // Ensure we stringify object/array answers for consistent hashing
  const str =
    typeof answer === "object"
      ? JSON.stringify(answer)
      : String(answer).trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    {
      l: "bg-blue-50 text-blue-700 border-blue-200",
      d: "bg-blue-900/30 text-blue-300 border-blue-800",
    },
    {
      l: "bg-emerald-50 text-emerald-700 border-emerald-200",
      d: "bg-emerald-900/30 text-emerald-300 border-emerald-800",
    },
    {
      l: "bg-amber-50 text-amber-700 border-amber-200",
      d: "bg-amber-900/30 text-amber-300 border-amber-800",
    },
    {
      l: "bg-orange-50 text-orange-700 border-orange-200",
      d: "bg-orange-900/30 text-orange-300 border-orange-800",
    },
    {
      l: "bg-rose-50 text-rose-700 border-rose-200",
      d: "bg-rose-900/30 text-rose-300 border-rose-800",
    },
    {
      l: "bg-purple-50 text-purple-700 border-purple-200",
      d: "bg-purple-900/30 text-purple-300 border-purple-800",
    },
    {
      l: "bg-pink-50 text-pink-700 border-pink-200",
      d: "bg-pink-900/30 text-pink-300 border-pink-800",
    },
    {
      l: "bg-indigo-50 text-indigo-700 border-indigo-200",
      d: "bg-indigo-900/30 text-indigo-300 border-indigo-800",
    },
    {
      l: "bg-teal-50 text-teal-700 border-teal-200",
      d: "bg-teal-900/30 text-teal-300 border-teal-800",
    },
    {
      l: "bg-cyan-50 text-cyan-700 border-cyan-200",
      d: "bg-cyan-900/30 text-cyan-300 border-cyan-800",
    },
  ];
  const color = colors[Math.abs(hash) % colors.length];
  return darkMode ? color.d : color.l;
};
const getBiwPerformanceLabel = (score: number) => {
  if (score < 60) {
    return {
      label: "Not Met Performer",
      className:
        "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    };
  } else if (score < 70) {
    return {
      label: "Partially Met Performer",
      className:
        "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
    };
  } else if (score < 80) {
    return {
      label: "Met Expectation",
      className:
        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
    };
  } else if (score < 90) {
    return {
      label: "Exceeded Performance",
      className:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    };
  } else {
    return {
      label: "Exemplary Performer",
      className:
        "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
    };
  }
};

const computeSectionPerformanceStats = (
  form: Form | null,
  responses: Response[],
): SectionPerformanceStat[] => {
  if (!form?.sections || !responses.length) {
    return [];
  }

  // Pre-build section list and a mapping of questionId -> section's counts and question configuration
  const sectionList: Array<{
    section: Section;
    counts: {
      yes: number;
      no: number;
      na: number;
      accepted: number;
      rejected: number;
      rework: number;
      total: number;
    };
  }> = [];

  const questionMap = new Map<string, {
    question: any;
    counts: typeof sectionList[0]["counts"];
  }>();

  form.sections.forEach((section) => {
    const counts = {
      yes: 0,
      no: 0,
      na: 0,
      accepted: 0,
      rejected: 0,
      rework: 0,
      total: 0,
    };
    sectionList.push({ section, counts });

    const registerQuestions = (q: any) => {
      if (!q) return;
      questionMap.set(q.id, { question: q, counts });
      q.followUpQuestions?.forEach(registerQuestions);
    };

    section.questions?.forEach(registerQuestions);
  });

  // Now process responses in a single loop
  responses.forEach((response) => {
    if (!response.answers) return;
    for (const [qId, answer] of Object.entries(response.answers)) {
      if (answer === null || answer === undefined || answer === "") {
        continue;
      }
      const match = questionMap.get(qId);
      if (!match) continue;

      const { question, counts } = match;

      // Check if it's an inspection status object (like from ChassisWithZone)
      if (typeof answer === "object" && answer.status) {
        const status = String(answer.status).toLowerCase().trim();
        if (
          status === "accepted" ||
          status === "rework completed" ||
          status === "verified"
        ) {
          counts.accepted += 1;
          counts.total += 1;
        } else if (status === "rejected") {
          counts.rejected += 1;
          counts.total += 1;
        } else if (
          status === "rework" ||
          status === "reworked" ||
          status.includes("re-rework")
        ) {
          counts.rework += 1;
          counts.total += 1;
        }
      } else {
        const answerStr = String(answer).toLowerCase().trim();
        const normalizedValues = extractYesNoValues(answer);

        if (
          answerStr === "accepted" ||
          answerStr === "rework completed" ||
          answerStr === "verified"
        ) {
          counts.accepted += 1;
          counts.total += 1;
        } else if (answerStr === "rejected") {
          counts.rejected += 1;
          counts.total += 1;
        } else if (
          answerStr === "rework" ||
          answerStr === "reworked" ||
          answerStr.includes("re-rework")
        ) {
          counts.rework += 1;
          counts.total += 1;
        } else if (
          question.type === "yesNoNA" ||
          question.type === "chassisWithZone" ||
          question.type === "chassisWithoutZone" ||
          question.type === "chassis" ||
          question.type === "zone-in" ||
          question.type === "zone-out" ||
          question.text?.toLowerCase().includes("chassis")
        ) {
          const options = question.options || [];

          if (options.length >= 3) {
            const yesOption = String(options[0]).toLowerCase().trim();
            const noOption = String(options[1]).toLowerCase().trim();
            const naOption = String(options[2]).toLowerCase().trim();

            normalizedValues.forEach((val) => {
              if (val === yesOption) {
                counts.yes += 1;
                counts.total += 1;
              } else if (val === noOption) {
                counts.no += 1;
                counts.total += 1;
              } else if (val === naOption) {
                counts.na += 1;
                counts.total += 1;
              }
            });
          } else {
            // Fallback to recognized values
            const hasRecognizedValue = normalizedValues.some((value) =>
              recognizedYesNoValues.includes(value),
            );
            if (hasRecognizedValue) {
              counts.total += 1;
              if (
                normalizedValues.includes("yes") ||
                normalizedValues.includes("accepted") ||
                normalizedValues.includes("verified")
              ) {
                counts.yes += 1;
              }
              if (
                normalizedValues.includes("no") ||
                normalizedValues.includes("rejected")
              ) {
                counts.no += 1;
              }
              if (
                normalizedValues.includes("n/a") ||
                normalizedValues.includes("na") ||
                normalizedValues.includes("not applicable") ||
                normalizedValues.includes("rework") ||
                normalizedValues.includes("reworked") ||
                normalizedValues.some((v) => v.includes("re-rework"))
              ) {
                counts.na += 1;
              }
            }
          }
        }
      }
    }
  });

  // Map result back to SectionPerformanceStat format
  return sectionList
    .map(({ section, counts }) => {
      if (!counts.total) {
        return null;
      }
      return {
        id: section.id,
        title: section.title || "Untitled Section",
        yes: counts.yes,
        no: counts.no,
        na: counts.na,
        accepted: counts.accepted,
        rejected: counts.rejected,
        rework: counts.rework,
        total: counts.total,
        weightage: typeof section.weightage === "number" ? section.weightage : 0,
      } as SectionPerformanceStat;
    })
    .filter((s): s is SectionPerformanceStat => s !== null);
};

const computeQuestionPerformanceStats = (
  form: Form | null,
  responses: Response[],
): QuestionPerformanceStat[] => {
  if (!form?.sections || !responses.length) {
    return [];
  }

  // Pre-build list of question info and mapping from questionId -> question info
  const questionList: Array<{
    id: string;
    text: string;
    sectionTitle: string;
    counts: {
      accepted: number;
      rejected: number;
      rework: number;
      total: number;
    };
    question: any;
  }> = [];

  const questionMap = new Map<string, typeof questionList[0]>();

  form.sections.forEach((section) => {
    section.questions.forEach((question: any) => {
      const entry = {
        id: question.id,
        text: question.text,
        sectionTitle: section.title,
        counts: {
          accepted: 0,
          rejected: 0,
          rework: 0,
          total: 0,
        },
        question,
      };
      questionList.push(entry);
      questionMap.set(question.id, entry);
    });
  });

  // Now process responses in a single loop
  responses.forEach((response) => {
    if (!response.answers) return;
    for (const [qId, answer] of Object.entries(response.answers)) {
      if (answer === null || answer === undefined || answer === "") {
        continue;
      }
      const match = questionMap.get(qId);
      if (!match) continue;

      const { question, counts } = match;

      if (typeof answer === "object" && answer.status) {
        const status = String(answer.status).toLowerCase().trim();
        if (
          status === "accepted" ||
          status === "rework completed" ||
          status === "verified"
        ) {
          counts.accepted += 1;
          counts.total += 1;
        } else if (status === "rejected") {
          counts.rejected += 1;
          counts.total += 1;
        } else if (
          status === "rework" ||
          status === "reworked" ||
          status.includes("re-rework")
        ) {
          counts.rework += 1;
          counts.total += 1;
        }
      } else {
        const answerStr = String(answer).toLowerCase().trim();
        const normalizedValues = extractYesNoValues(answer);

        if (
          answerStr === "accepted" ||
          answerStr === "rework completed" ||
          answerStr === "verified"
        ) {
          counts.accepted += 1;
          counts.total += 1;
        } else if (answerStr === "rejected") {
          counts.rejected += 1;
          counts.total += 1;
        } else if (
          answerStr === "rework" ||
          answerStr === "reworked" ||
          answerStr.includes("re-rework")
        ) {
          counts.rework += 1;
          counts.total += 1;
        } else if (
          question.type === "yesNoNA" ||
          question.type === "chassisWithZone" ||
          question.type === "chassisWithoutZone" ||
          question.type === "chassis" ||
          question.type === "zone-in" ||
          question.type === "zone-out" ||
          question.text?.toLowerCase().includes("chassis")
        ) {
          const options = question.options || [];
          if (options.length >= 3) {
            const yesOption = String(options[0]).toLowerCase().trim();
            const noOption = String(options[1]).toLowerCase().trim();
            const naOption = String(options[2]).toLowerCase().trim();

            normalizedValues.forEach((val) => {
              if (val === yesOption) {
                counts.accepted += 1;
                counts.total += 1;
              } else if (val === noOption) {
                counts.rejected += 1;
                counts.total += 1;
              } else if (val === naOption) {
                counts.rework += 1;
                counts.total += 1;
              }
            });
          } else {
            const hasRecognizedValue = normalizedValues.some((value) =>
              recognizedYesNoValues.includes(value),
            );
            if (hasRecognizedValue) {
              counts.total += 1;
              if (
                normalizedValues.includes("yes") ||
                normalizedValues.includes("accepted") ||
                normalizedValues.includes("verified")
              ) {
                counts.accepted += 1;
              }
              if (
                normalizedValues.includes("no") ||
                normalizedValues.includes("rejected")
              ) {
                counts.rejected += 1;
              }
              if (
                normalizedValues.includes("n/a") ||
                normalizedValues.includes("na") ||
                normalizedValues.includes("not applicable") ||
                normalizedValues.includes("rework") ||
                normalizedValues.includes("reworked") ||
                normalizedValues.some((v) => v.includes("re-rework"))
              ) {
                counts.rework += 1;
              }
            }
          }
        }
      }
    }
  });

  // Map result back to QuestionPerformanceStat format
  return questionList
    .filter((q) => q.counts.total > 0)
    .map((q) => ({
      id: q.id,
      text: q.text,
      sectionTitle: q.sectionTitle,
      accepted: q.counts.accepted,
      rejected: q.counts.rejected,
      rework: q.counts.rework,
      total: q.counts.total,
    }));
};

type DailyPerformanceStat = {
  date: string;
  dateKey: string;
  totalResponses: number;
  reworkCount: number;
  acceptedCount: number;
};

const computeDailyPerformanceStats = (
  responses: Response[],
  statuses: Record<string, string>,
  startDate?: string,
  endDate?: string,
): DailyPerformanceStat[] => {
  const dailyMap = new Map<
    string,
    { total: number; rework: number; accepted: number }
  >();

  let start: Date | null = null;
  let end: Date | null = null;

  if (startDate) {
    start = new Date(startDate);
  } else {
    // Default to start of current month if no start date provided
    start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  if (endDate) {
    end = new Date(endDate);
  } else {
    // Default to today if no end date provided
    end = new Date();
    end.setHours(23, 59, 59, 999);
  }

  if (responses.length > 0 && !startDate && !endDate) {
    const timestamps = responses.map((r) =>
      new Date(getResponseTimestamp(r) || 0).getTime(),
    );
    const minTS = Math.min(...timestamps);
    const maxTS = Math.max(...timestamps);

    // Expand range to include responses if they are outside current month
    if (minTS < start.getTime()) start = new Date(minTS);
    if (maxTS > end.getTime()) end = new Date(maxTS);
  }

  if (start && end) {
    const curr = new Date(start);
    curr.setHours(0, 0, 0, 0);
    const last = new Date(end);
    last.setHours(0, 0, 0, 0);

    while (curr <= last) {
      const dKey = toLocalDateString(curr);
      dailyMap.set(dKey, { total: 0, rework: 0, accepted: 0 });
      curr.setDate(curr.getDate() + 1);
    }
  }

  responses.forEach((response) => {
    const timestamp = getResponseTimestamp(response);
    if (!timestamp) return;

    const dateKey = toLocalDateString(timestamp);
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, { total: 0, rework: 0, accepted: 0 });
    }

    const dayStats = dailyMap.get(dateKey)!;
    dayStats.total += 1;

    const status = statuses[response.id];
    if (status && typeof status === "string") {
      if (status.startsWith("Rework") || status === "Rework Accepted") {
        dayStats.rework += 1;
      } else if (status === "Direct Ok" || status === "Accepted") {
        dayStats.accepted += 1;
      }
    }
  });

  return Array.from(dailyMap.entries())
    .map(([dateKey, stats]) => {
      const dateObj = new Date(dateKey);
      const formattedDate = dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      return {
        date: formattedDate,
        dateKey,
        totalResponses: stats.total,
        reworkCount: stats.rework,
        acceptedCount: stats.accepted,
      };
    })
    .sort((a, b) => (a.dateKey > b.dateKey ? 1 : -1));
};

const computeMonthlyPerformanceStats = (
  responses: Response[],
  statuses: Record<string, string>,
  startDate?: string,
  endDate?: string,
): DailyPerformanceStat[] => {
  const monthMap = new Map<
    string,
    { total: number; rework: number; accepted: number }
  >();

  let start: Date | null = null;
  let end: Date | null = null;

  if (startDate) {
    start = new Date(startDate);
  } else {
    // Default to start of current month if no start date provided
    start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  if (endDate) {
    end = new Date(endDate);
  } else {
    // Default to today if no end date provided
    end = new Date();
    end.setHours(23, 59, 59, 999);
  }

  if (responses.length > 0 && !startDate && !endDate) {
    const timestamps = responses.map((r) =>
      new Date(getResponseTimestamp(r) || 0).getTime(),
    );
    const minTS = Math.min(...timestamps);
    const maxTS = Math.max(...timestamps);

    // Expand range to include responses if they are outside current month
    if (minTS < start.getTime()) start = new Date(minTS);
    if (maxTS > end.getTime()) end = new Date(maxTS);
  }

  if (start && end) {
    const curr = new Date(start);
    curr.setDate(1);
    const last = new Date(end);
    last.setDate(1);

    while (curr <= last) {
      const monthKey = `${curr.getFullYear()}-${String(
        curr.getMonth() + 1,
      ).padStart(2, "0")}`;
      monthMap.set(monthKey, { total: 0, rework: 0, accepted: 0 });
      curr.setMonth(curr.getMonth() + 1);
    }
  }

  responses.forEach((response) => {
    const timestamp = getResponseTimestamp(response);
    if (!timestamp) return;

    const dateObj = new Date(timestamp);
    const monthKey = `${dateObj.getFullYear()}-${String(
      dateObj.getMonth() + 1,
    ).padStart(2, "0")}`;

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { total: 0, rework: 0, accepted: 0 });
    }

    const monthStats = monthMap.get(monthKey)!;
    monthStats.total += 1;

    const status = statuses[response.id];
    if (status && typeof status === "string") {
      if (status.startsWith("Rework") || status === "Rework Accepted") {
        monthStats.rework += 1;
      } else if (status === "Direct Ok" || status === "Accepted") {
        monthStats.accepted += 1;
      }
    }
  });

  return Array.from(monthMap.entries())
    .map(([monthKey, stats]) => {
      const [year, month] = monthKey.split("-");
      const dateObj = new Date(parseInt(year), parseInt(month) - 1);
      const formattedMonth = dateObj.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      return {
        date: formattedMonth,
        dateKey: monthKey,
        totalResponses: stats.total,
        reworkCount: stats.rework,
        acceptedCount: stats.accepted,
      };
    })
    .sort((a, b) => (a.dateKey > b.dateKey ? 1 : -1));
};

const computeDirectAcceptedDailyStats = (
  responses: Response[],
  statuses: Record<string, string>,
  startDate?: string,
  endDate?: string,
): {
  date: string;
  dateKey: string;
  directCount: number;
  reworkCount: number;
  rejectedCount: number;
  total: number;
  questionReworkCount: number;
  reworkCompletedCount: number;
}[] => {
  const dailyMap = new Map<
    string,
    {
      total: number;
      direct: number;
      rework: number;
      rejected: number;
      questionRework: number;
      reworkCompleted: number;
    }
  >();

  let start: Date | null = null;
  let end: Date | null = null;

  if (startDate) {
    start = new Date(startDate);
  } else {
    start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  if (endDate) {
    end = new Date(endDate);
  } else {
    end = new Date();
    end.setHours(23, 59, 59, 999);
  }

  if (start && end) {
    const curr = new Date(start);
    curr.setHours(0, 0, 0, 0);
    const last = new Date(end);
    last.setHours(0, 0, 0, 0);

    while (curr <= last) {
      const dKey = toLocalDateString(curr);
      dailyMap.set(dKey, {
        total: 0,
        direct: 0,
        rework: 0,
        rejected: 0,
        questionRework: 0,
        reworkCompleted: 0,
      });
      curr.setDate(curr.getDate() + 1);
    }
  }

  responses.forEach((response) => {
    const timestamp = getResponseTimestamp(response);
    if (!timestamp) return;

    const dateKey = toLocalDateString(timestamp);
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, {
        total: 0,
        direct: 0,
        rework: 0,
        rejected: 0,
        questionRework: 0,
        reworkCompleted: 0,
      });
    }

    const dayStats = dailyMap.get(dateKey)!;
    dayStats.total += 1;

    // Calculate rework count based on individual questions
    let formReworkQuestionsCount = 0;
    if (response.answers) {
      Object.values(response.answers).forEach((ans) => {
        if (typeof ans === "object" && ans !== null && (ans as any).status) {
          const s = String((ans as any).status)
            .toLowerCase()
            .trim();
          if (s === "rework" || s === "reworked" || s.includes("re-rework")) {
            formReworkQuestionsCount++;
          }
        } else if (typeof ans === "string") {
          const s = ans.toLowerCase().trim();
          if (s === "rework" || s === "reworked" || s.includes("re-rework")) {
            formReworkQuestionsCount++;
          }
        }
      });
    }
    dayStats.questionRework += formReworkQuestionsCount;

    const status = statuses[response.id];
    if (status === "Direct Ok" || status === "Accepted") {
      dayStats.direct += 1;
    } else if (
      status &&
      (status.startsWith("Rework Accepted") ||
        status.startsWith("Rework Completed"))
    ) {
      dayStats.reworkCompleted += 1;
    } else if (status && status.startsWith("Rework")) {
      dayStats.rework += 1;
    } else if (status === "Rejected") {
      dayStats.rejected += 1;
    }
  });

  return Array.from(dailyMap.entries())
    .map(([dateKey, stats]) => {
      const dateObj = new Date(dateKey);
      const formattedDate = dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      return {
        date: formattedDate,
        dateKey,
        directCount: stats.direct,
        reworkCount: stats.rework,
        rejectedCount: stats.rejected,
        total: stats.total,
        questionReworkCount: stats.questionRework,
        reworkCompletedCount: stats.reworkCompleted,
      };
    })
    .sort((a, b) => (a.dateKey > b.dateKey ? 1 : -1));
};

const computeDailyReworkVolumeStats = (
  form: Form | null,
  responses: Response[],
  startDate?: string,
  endDate?: string,
): { date: string; dateKey: string; reworkCount: number }[] => {
  const dailyMap = new Map<string, { rework: number }>();

  let start: Date | null = null;
  let end: Date | null = null;

  if (startDate) {
    start = new Date(startDate);
  } else {
    start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  if (endDate) {
    end = new Date(endDate);
  } else {
    end = new Date();
    end.setHours(23, 59, 59, 999);
  }

  if (start && end) {
    const curr = new Date(start);
    curr.setHours(0, 0, 0, 0);
    const last = new Date(end);
    last.setHours(0, 0, 0, 0);

    while (curr <= last) {
      const dKey = toLocalDateString(curr);
      dailyMap.set(dKey, { rework: 0 });
      curr.setDate(curr.getDate() + 1);
    }
  }

  if (!form?.sections) return [];

  responses.forEach((response) => {
    const timestamp = getResponseTimestamp(response);
    if (!timestamp) return;

    const dateKey = toLocalDateString(timestamp);
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, { rework: 0 });
    }

    const dayStats = dailyMap.get(dateKey)!;

    form.sections.forEach((section) => {
      section.questions.forEach((question: any) => {
        const answer = response.answers?.[question.id];
        if (answer === null || answer === undefined || answer === "") return;

        if (typeof answer === "object" && answer.status) {
          const status = String(answer.status).toLowerCase().trim();
          if (
            status === "rework" ||
            status === "reworked" ||
            status.includes("re-rework")
          ) {
            dayStats.rework += 1;
          }
        } else {
          const answerStr = String(answer).toLowerCase().trim();
          if (
            answerStr === "rework" ||
            answerStr === "reworked" ||
            answerStr.includes("re-rework")
          ) {
            dayStats.rework += 1;
          } else if (
            question.type === "yesNoNA" ||
            question.type === "chassisWithZone" ||
            question.type === "chassisWithoutZone" ||
            question.type === "chassis" ||
            question.type === "zone-in" ||
            question.type === "zone-out" ||
            question.text?.toLowerCase().includes("chassis")
          ) {
            const options = question.options || [];
            if (options.length >= 3) {
              const naOption = String(options[2]).toLowerCase().trim();
              const normalizedValues = extractYesNoValues(answer);
              normalizedValues.forEach((val) => {
                if (val === naOption) {
                  dayStats.rework += 1;
                }
              });
            }
          }
        }
      });
    });
  });

  return Array.from(dailyMap.entries())
    .map(([dateKey, stats]) => {
      const dateObj = new Date(dateKey);
      const formattedDate = dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      return {
        date: formattedDate,
        dateKey,
        reworkCount: stats.rework,
      };
    })
    .sort((a, b) => (a.dateKey > b.dateKey ? 1 : -1));
};

interface SectionStat {
  id: string;
  title: string;
  yes: number;
  no: number;
  na: number;
  accepted?: number;
  rejected?: number;
  rework?: number;
  total: number;
}

const getSectionYesNoStats = (
  form: any,
  answers: Record<string, any>,
): SectionStat[] => {
  const stats =
    form.sections?.map((section: any) => {
      const counts = {
        yes: 0,
        no: 0,
        na: 0,
        accepted: 0,
        rejected: 0,
        rework: 0,
        total: 0,
      };

      const processQuestion = (question: any) => {
        if (!question) {
          return;
        }

        const answer = answers?.[question.id];
        if (answer !== null && answer !== undefined && answer !== "") {
          // Check if it's an inspection status object
          if (typeof answer === "object" && answer.status) {
            const status = String(answer.status).toLowerCase().trim();
            if (
              status === "accepted" ||
              status === "rework completed" ||
              status === "verified"
            ) {
              counts.accepted += 1;
              counts.total += 1;
            } else if (status === "rejected") {
              counts.rejected += 1;
              counts.total += 1;
            } else if (
              status === "rework" ||
              status === "reworked" ||
              status.includes("re-rework")
            ) {
              counts.rework += 1;
              counts.total += 1;
            }
          } else {
            // Handle string answers that might be inspection statuses
            const answerStr = String(answer).toLowerCase().trim();
            const normalizedValues = extractYesNoValues(answer);

            if (
              answerStr === "accepted" ||
              answerStr === "rework completed" ||
              answerStr === "verified"
            ) {
              counts.accepted += 1;
              counts.total += 1;
            } else if (answerStr === "rejected") {
              counts.rejected += 1;
              counts.total += 1;
            } else if (
              answerStr === "rework" ||
              answerStr === "reworked" ||
              answerStr.includes("re-rework")
            ) {
              counts.rework += 1;
              counts.total += 1;
            } else if (
              question.type === "yesNoNA" ||
              question.type === "chassisWithZone" ||
              question.type === "chassisWithoutZone" ||
              question.type === "chassis" ||
              question.type === "zone-in" ||
              question.type === "zone-out" ||
              question.text?.toLowerCase().includes("chassis")
            ) {
              const options = question.options || [];

              if (options.length >= 3) {
                const yesOption = String(options[0]).toLowerCase().trim();
                const noOption = String(options[1]).toLowerCase().trim();
                const naOption = String(options[2]).toLowerCase().trim();

                normalizedValues.forEach((val) => {
                  if (val === yesOption) {
                    counts.yes += 1;
                    counts.total += 1;
                  } else if (val === noOption) {
                    counts.no += 1;
                    counts.total += 1;
                  } else if (val === naOption) {
                    counts.na += 1;
                    counts.total += 1;
                  }
                });
              } else {
                const hasRecognizedValue = normalizedValues.some((value) =>
                  recognizedYesNoValues.includes(value),
                );
                if (hasRecognizedValue) {
                  counts.total += 1;
                  if (
                    normalizedValues.includes("yes") ||
                    normalizedValues.includes("accepted") ||
                    normalizedValues.includes("verified")
                  ) {
                    counts.yes += 1;
                  }
                  if (
                    normalizedValues.includes("no") ||
                    normalizedValues.includes("rejected")
                  ) {
                    counts.no += 1;
                  }
                  if (
                    normalizedValues.includes("n/a") ||
                    normalizedValues.includes("na") ||
                    normalizedValues.includes("not applicable") ||
                    normalizedValues.includes("rework") ||
                    normalizedValues.includes("reworked") ||
                    normalizedValues.some((v) => v.includes("re-rework"))
                  ) {
                    counts.na += 1;
                  }
                }
              }
            }
          }
        }

        question.followUpQuestions?.forEach(processQuestion);
      };

      section.questions?.forEach(processQuestion);

      if (!counts.total) {
        return null;
      }

      return {
        id: section.id,
        title: section.title || "Untitled Section",
        yes: counts.yes,
        no: counts.no,
        na: counts.na,
        accepted: counts.accepted,
        rejected: counts.rejected,
        rework: counts.rework,
        total: counts.total,
      };
    }) ?? [];

  return stats.filter((stat): stat is SectionStat => Boolean(stat));
};

const QuestionSuggestionRenderer = ({
  question,
  value,
  onChange,
  currentAnswer,
}: {
  question: any;
  value: any;
  onChange: (val: any) => void;
  currentAnswer?: any;
}) => {
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // All values stored flat in the value object
  const safeValue = typeof value === "object" && value !== null ? value : {};
  const status = safeValue.inspectionStatus || "";
  const remark = safeValue.inspectionRemark || "";
  const fileUrl = safeValue.inspectionFileUrl || "";

  const update = (patch: Record<string, any>) => {
    onChange({ ...safeValue, ...patch });
  };

  const handleFileUpload = async (file: File) => {
    try {
      setUploading(true);
      const result = await apiClient.uploadFile(file, "form");
      const url = apiClient.resolveUploadedFileUrl(result);
      if (url) {
        update({ inspectionFileUrl: url });
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // Render the current answer as read-only context

  return (
    <div className="space-y-3 mt-2" onClick={(e) => e.stopPropagation()}>
      {/* Remark */}
      <div
        className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800"
        onClick={(e) => e.stopPropagation()}
      >
        <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest block mb-1">
          Remark
        </label>
        <textarea
          rows={2}
          value={remark}
          onChange={(e) => {
            e.stopPropagation();
            update({ inspectionRemark: e.target.value });
          }}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          placeholder="Enter remark..."
          className="w-full p-2 text-xs bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-700 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none resize-none"
        />
      </div>

      {/* File Upload + Camera */}
      <div
        className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800"
        onClick={(e) => e.stopPropagation()}
      >
        <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-1.5">
          Evidence Photo
        </label>

        {fileUrl ? (
          /* Uploaded — show thumbnail + change/camera */
          <div className="flex gap-2">
            <label className="flex-1 cursor-pointer group relative">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onClick={(e) => e.stopPropagation()}
                onChange={async (e) => {
                  e.stopPropagation();
                  const file = e.target.files?.[0];
                  if (file) await handleFileUpload(file);
                }}
              />
              <img
                src={fileUrl}
                alt="Evidence"
                className="w-full h-28 object-cover rounded-lg border-2 border-emerald-400"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(fileUrl, "_blank");
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none">
                <span className="text-[10px] text-white font-bold">Change</span>
              </div>
            </label>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowCamera(true);
              }}
              className="flex-1 flex flex-col items-center justify-center gap-1 p-3 border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-lg hover:border-purple-500 transition-colors"
            >
              <Camera className="w-4 h-4 text-purple-500" />
              <span className="text-[9px] text-purple-500 font-bold">
                Camera
              </span>
            </button>
          </div>
        ) : uploading ? (
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span className="text-xs text-blue-600 dark:text-blue-400">
              Uploading...
            </span>
          </div>
        ) : (
          /* Empty — show upload + camera side by side */
          <div className="flex gap-2">
            <label className="flex-1 cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onClick={(e) => e.stopPropagation()}
                onChange={async (e) => {
                  e.stopPropagation();
                  const file = e.target.files?.[0];
                  if (file) await handleFileUpload(file);
                }}
              />
              <div className="flex flex-col items-center justify-center gap-1 p-3 border-2 border-dashed border-blue-200 dark:border-blue-700 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all">
                <Upload className="w-4 h-4 text-blue-400" />
                <span className="text-[9px] text-blue-500 dark:text-blue-400 font-bold">
                  Upload Photo
                </span>
              </div>
            </label>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowCamera(true);
              }}
              className="flex-1 flex flex-col items-center justify-center gap-1 p-3 border-2 border-dashed border-purple-200 dark:border-purple-700 rounded-lg hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-colors"
            >
              <Camera className="w-4 h-4 text-purple-400" />
              <span className="text-[9px] text-purple-500 dark:text-purple-400 font-bold">
                Camera
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Camera modal */}
      {showCamera &&
        createPortal(
          <CameraCapture
            onCapture={async (file: File) => {
              await handleFileUpload(file);
              setShowCamera(false);
            }}
            onClose={() => setShowCamera(false)}
          />,
          document.body,
        )}
    </div>
  );
};

// Function to render message with images
const renderMessageWithImages = (message: string) => {
  if (!message) return null;

  console.log("renderMessageWithImages called with:", message);

  // Split message by image markdown syntax
  const parts = message.split(/(!\[.*?\]\(.*?\))/g);
  console.log("Message parts:", parts);

  return (
    <div className="space-y-2">
      {parts.map((part, index) => {
        // Check if this part is an image markdown
        const imageMatch = part.match(/!\[.*?\]\((.*?)\)/);
        if (imageMatch) {
          const imageUrl = imageMatch[1];
          console.log("Found image URL:", imageUrl);
          return (
            <div key={index} className="inline-block">
              <img
                src={imageUrl}
                alt="Evidence"
                className="max-w-32 max-h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(imageUrl, "_blank")}
                onError={(e) => {
                  console.error("Image failed to load:", imageUrl);
                  e.currentTarget.style.display = "none";
                  // Show fallback text
                  const fallback = document.createElement("div");
                  fallback.className = "text-xs text-red-500 mt-1";
                  fallback.textContent = "Image failed to load";
                  e.currentTarget.parentNode?.appendChild(fallback);
                }}
                onLoad={() =>
                  console.log("Image loaded successfully:", imageUrl)
                }
              />
            </div>
          );
        }
        // Regular text part
        return part.trim() ? (
          <span key={index} className="whitespace-pre-wrap">
            {part}
          </span>
        ) : null;
      })}
    </div>
  );
};

export default function FormAnalyticsDashboard() {
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);

  const generateTableBarChart = (
    yesPercent: number,
    noPercent: number,
    naPercent: number,
  ) => {
    const totalWidth = 160;
    const yesWidth = (yesPercent / 100) * totalWidth;
    const noWidth = (noPercent / 100) * totalWidth;
    const naWidth = (naPercent / 100) * totalWidth;

    return (
      <div
        className="relative"
        style={{
          width: `${totalWidth}px`,
          height: "20px",
        }}
      >
        <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700 rounded-sm border border-gray-300 dark:border-gray-600"></div>

        {yesPercent > 0 && (
          <div
            className="absolute left-0 h-full bg-green-500"
            style={{ width: `${yesWidth}px` }}
          >
            {yesPercent >= 10 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="text-xs font-bold text-white"
                  style={{
                    textShadow: "0 0 2px rgba(0,0,0,0.5)",
                  }}
                >
                  {yesPercent.toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        )}

        {noPercent > 0 && (
          <div
            className="absolute h-full bg-red-500"
            style={{
              left: `${yesWidth}px`,
              width: `${noWidth}px`,
            }}
          >
            {noPercent >= 10 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="text-xs font-bold text-white"
                  style={{
                    textShadow: "0 0 2px rgba(0,0,0,0.5)",
                  }}
                >
                  {noPercent.toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        )}

        {naPercent > 0 && (
          <div
            className="absolute h-full bg-gray-400"
            style={{
              left: `${yesWidth + noWidth}px`,
              width: `${naWidth}px`,
            }}
          >
            {naPercent >= 10 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="text-xs font-bold text-white"
                  style={{
                    textShadow: "0 0 2px rgba(0,0,0,0.5)",
                  }}
                >
                  {naPercent.toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        )}

        {yesPercent > 0 && yesPercent < 10 && (
          <div className="absolute" style={{ left: "2px", top: "1px" }}>
            <span className="text-[9px] font-bold text-green-700 bg-white/80 px-0.5 rounded">
              {yesPercent.toFixed(0)}%
            </span>
          </div>
        )}
        {noPercent > 0 && noPercent < 10 && (
          <div
            className="absolute"
            style={{
              left: `${yesWidth + 2}px`,
              top: "1px",
            }}
          >
            <span className="text-[9px] font-bold text-red-700 bg-white/80 px-0.5 rounded">
              {noPercent.toFixed(0)}%
            </span>
          </div>
        )}
        {naPercent > 0 && naPercent < 10 && (
          <div
            className="absolute"
            style={{
              left: `${yesWidth + noWidth + 2}px`,
              top: "1px",
            }}
          >
            <span className="text-[9px] font-bold text-gray-700 bg-white/80 px-0.5 rounded">
              {naPercent.toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    );
  };
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<
    number | null
  >(null);
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const isInspector = user?.role === "inspector";

  // Guest mode detection
  const isGuest = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return (
      searchParams.get("guest") === "true" ||
      !!localStorage.getItem("guest_auth_token")
    );
  }, []);

  const canBulkSelectResponses =
    !isGuest && (user?.role === "superadmin" || user?.role === "admin");


  const renderSuggestion = (suggestion: any) => {
    if (!suggestion || Object.keys(suggestion).length === 0) return null;

    // Check if this is a chassis-with-zone or chassis-without-zone structure
    const isChassisStructure =
      suggestion.status !== undefined ||
      suggestion.chassisNumber !== undefined ||
      suggestion.zonesData !== undefined ||
      suggestion.zone !== undefined;

    if (isChassisStructure) {
      // Format chassis structure with proper headings
      const sections: JSX.Element[] = [];

      // Status
      if (suggestion.status && suggestion.status.trim()) {
        const statusColor =
          suggestion.status.toLowerCase() === "accepted"
            ? "text-green-600 bg-green-50 border-green-200"
            : suggestion.status.toLowerCase() === "rejected"
              ? "text-red-600 bg-red-50 border-red-200"
              : "text-amber-600 bg-amber-50 border-amber-200";

        sections.push(
          <div
            key="status"
            className="flex items-center gap-2 p-2 rounded-lg border"
            style={{ backgroundColor: "rgba(var(--status-bg), 0.1)" }}
          >
            <span
              className={`px-2 py-1 rounded-md text-[11px] font-black uppercase ${statusColor} border shadow-sm`}
            >
              Status: {suggestion.status}
            </span>
          </div>,
        );
      }

      // Chassis Number
      if (suggestion.chassisNumber && suggestion.chassisNumber.trim()) {
        sections.push(
          <div
            key="chassis"
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Chassis Number
            </span>
            <span className="text-[11px] font-mono font-bold text-gray-700 dark:text-gray-300">
              {suggestion.chassisNumber}
            </span>
          </div>,
        );
      }

      // Handle zonesData (with zones)
      if (suggestion.zonesData && typeof suggestion.zonesData === "object") {
        Object.entries(suggestion.zonesData).forEach(
          ([zoneName, zoneData]: [string, any]) => {
            if (zoneData?.categories && Array.isArray(zoneData.categories)) {
              zoneData.categories.forEach((category: any) => {
                const categoryName = category.name;
                const defects = category.defects || [];

                defects.forEach((defect: any) => {
                  const defectName = defect.name;
                  const remark = defect.details?.remark || defect.remark || "";
                  const fileUrl =
                    defect.details?.fileUrl || defect.fileUrl || "";

                  sections.push(
                    <div
                      key={`${zoneName}-${categoryName}-${defectName}`}
                      className="p-3 rounded-lg border-l-4 border-indigo-400 bg-indigo-50/30 dark:bg-indigo-900/20 space-y-2"
                    >
                      <div className="grid grid-cols-1 gap-2">
                        {zoneName && (
                          <div>
                            <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wider">
                              Zone
                            </span>
                            <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                              {zoneName}
                            </p>
                          </div>
                        )}
                        {categoryName && (
                          <div>
                            <span className="text-[9px] font-bold text-purple-500 uppercase tracking-wider">
                              Category
                            </span>
                            <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                              {categoryName}
                            </p>
                          </div>
                        )}
                        {defectName && (
                          <div>
                            <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">
                              Defect
                            </span>
                            <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                              {defectName}
                            </p>
                          </div>
                        )}
                        {remark && remark.trim() && (
                          <div>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                              Remark
                            </span>
                            <p className="text-[10px] italic text-gray-600 dark:text-gray-400">
                              "{remark}"
                            </p>
                          </div>
                        )}
                        {fileUrl && fileUrl.trim() && (
                          <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                              Evidence :
                            </span>
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline mt-0 "
                            >
                              <Eye className="w-4 h-2 mt-1 " />
                              View Evidence
                            </a>
                          </div>
                        )}
                      </div>
                    </div>,
                  );
                });
              });
            }
          },
        );
      }

      return <div className="space-y-2">{sections}</div>;
    }

    // Default: for simple fields like text, select, radio
    return (
      <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
        <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block mb-1">
          Revised Answer
        </span>
        <div className="text-[11px] font-bold text-gray-800 dark:text-gray-200">
          {renderAnswerDisplay(suggestion, { type: "text" } as any)}
        </div>
      </div>
    );
  };

  // In-memory cache to enable 0ms instant dashboard switching between forms
  const formAnalyticsMemoryCache = new Map<string, {
    form: any;
    responses: any[];
    tableResponses: any[];
    timestamp: number;
  }>();

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Permission check for analytics tabs
  const hasTabPermission = (tabName: string): boolean => {
    // Admin bypass - see all tabs
    if (user?.role === "admin" || user?.role === "superadmin" || user?.role === "tenant_admin") {
      return true;
    }

    // Non-admin / non-superadmin users need explicit permissions
    if (!id || !form) return false;

    // Map the component's tab name to the permission tree suffix.
    // The permission tree (permissionTree.ts) uses: dashboard, response,
    // overall, questions, sections
    const suffixMap: Record<string, string> = {
      dashboard: "dashboard",
      question: "questions",
      section: "sections",
      overall: "overall",
      responses: "response",
      preview: "preview",
    };
    const suffix = suffixMap[tabName];
    if (!suffix) return false;

    // Preview tab is available by default for all users
    if (suffix === "preview") {
      return true;
    }

    const perms = user?.permissions;
    if (!perms || !Array.isArray(perms) || perms.length === 0) return false;

    // Try both URL param id and form's actual _id to handle MongoDB _id mismatch
    const formIdsToCheck = [id];
    if (form._id && form._id !== id) {
      formIdsToCheck.push(form._id);
    }
    if (form.id && form.id !== id && form.id !== form._id) {
      formIdsToCheck.push(form.id);
    }

    // Check if user has permission for ANY of the possible form IDs
    return formIdsToCheck.some((formId) => {
      const leafPermission = `analytics:form:${formId}:${suffix}`;
      const parentPermission = `analytics:form:${formId}`;
      const wildcardPermission = "analytics:*";

      return (
        perms.includes(leafPermission) ||
        perms.includes(parentPermission) ||
        perms.includes(wildcardPermission) ||
        perms.includes("analytics:view")
      );
    });
  };




  const handleLogout = () => {
    if (isGuest) {
      localStorage.removeItem("guest_auth_token");
      localStorage.removeItem("guest_email");
      localStorage.removeItem("guest_form_id");
      localStorage.removeItem("guest_expires_at");
      navigate(`/forms/${id}/analytics/login`);
    }
  };

  const handleShareAnalytics = () => {
    if (id) {
      setShareAnalyticsModal({
        open: true,
        formId: id,
        formTitle: form?.title || "Form Analytics",
      });
    }
  };

  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleAutoSendSetup = () => {
    if (id) {
      setAutoSendModal({
        open: true,
        formId: id,
        formTitle: form?.title || "Form Analytics",
      });
    }
  };

  const [responses, setResponses] = useState<Response[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isBulkDispatching, setIsBulkDispatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoOpenSectionId, setAutoOpenSectionId] = useState<string | null>(
    null,
  );

  const [showParentMatchColumn, setShowParentMatchColumn] = useState<boolean>(false);

  const [tvsReviews, setTvsReviews] = useState<any[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [analyticsView, setAnalyticsView] = useState<"responses" | "dashboard">(() => {
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    if (tabParam && ["responses", "dashboard"].includes(tabParam)) {
      return tabParam as any;
    }
    return "dashboard";
  });

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && ["responses", "dashboard"].includes(tabParam)) {
      setAnalyticsView(tabParam as any);
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);

  const fetchedBulkReviewsKeyRef = useRef<string>("");

  useEffect(() => {
    // Only fetch TVS reviews when in dashboard view or overall view and responses exist
    if (responses.length === 0 || (analyticsView !== "dashboard")) return;

    const currentKey = `${id}-${responses.length}`;
    if (fetchedBulkReviewsKeyRef.current === currentKey) return;
    fetchedBulkReviewsKeyRef.current = currentKey;

    const fetchBulkReviews = async () => {
      try {
        setIsLoadingReviews(true);
        const responseIds = responses.map((r) => r.id || r._id).filter(Boolean);
        if (responseIds.length === 0) {
          setIsLoadingReviews(false);
          return;
        }

        const data = await apiClient.request<{ success: boolean; data: any[] }>("/responses/reviews/bulk", {
          method: "POST",
          body: JSON.stringify({ responseIds }),
        });

        if (data && data.success) {
          setTvsReviews(data.data || []);
        }
      } catch (err) {
        console.error("Error fetching bulk TVS reviews:", err);
      } finally {
        setIsLoadingReviews(false);
      }
    };

    fetchBulkReviews();
  }, [responses.length, analyticsView, id]);

  const getChassisDisplayValue = (value: any): string => {
    if (!value) return "-";
    if (typeof value === "object") {
      if (value.chassisNumber !== undefined && value.chassisNumber !== null) {
        return value.partDescription
          ? `${value.chassisNumber} — ${value.partDescription}`
          : String(value.chassisNumber);
      }
      if (value.value !== undefined && value.value !== null && typeof value.value !== "object") {
        return String(value.value);
      }
      // If it's a defect inspection object (with status, remark, evidenceUrl), it's NOT a chassis!
      if (value.status !== undefined || value.remark !== undefined || value.evidenceUrl !== undefined || value.defect !== undefined) {
        return "-";
      }
      return "-";
    }
    const str = String(value).trim();
    if (str.startsWith("{") && str.endsWith("}")) {
      try {
        const parsed = JSON.parse(str);
        if (parsed.chassisNumber) return String(parsed.chassisNumber);
        if (parsed.value) return String(parsed.value);
        if (parsed.status !== undefined) return "-";
      } catch {}
    }
    return str;
  };

  const chassisQuestionId = useMemo(() => {
    if (!form?.sections) {
      return null;
    }
    // Priority 1: Explicit tracking flag (exclude defect inspection questions like zone-in / zone-out)
    for (const section of form.sections) {
      if (section.questions) {
        for (const q of section.questions) {
          if (
            (q.trackResponseRank === true ||
              q.trackResponseRank === "true" ||
              q.trackResponseQuestion === true ||
              q.trackResponseQuestion === "true") &&
            q.type !== "zone-in" &&
            q.type !== "zone-out"
          ) {
            return q.id;
          }
        }
      }
    }
    // Priority 2: Question title/text explicitly mentioning Chassis or VIN (exclude defect inspection questions)
    for (const section of form.sections) {
      if (section.questions) {
        for (const q of section.questions) {
          const t = q.text?.toLowerCase() || "";
          if (
            (t.includes("chassis number") ||
              t.includes("chassis no") ||
              t.includes("chassis_number") ||
              t.includes("vin") ||
              t.trim() === "chassis") &&
            q.type !== "zone-in" &&
            q.type !== "zone-out"
          ) {
            return q.id;
          }
        }
      }
    }
    // Priority 3: Specific dedicated chassis question types
    for (const section of form.sections) {
      if (section.questions) {
        for (const q of section.questions) {
          if (
            q.type === "chassis" ||
            q.type === "chassisWithZone" ||
            q.type === "chassisWithoutZone"
          ) {
            return q.id;
          }
        }
      }
    }
    // Priority 4: Other questions mentioning chassis (exclude zone-in/out)
    for (const section of form.sections) {
      if (section.questions) {
        for (const q of section.questions) {
          const t = q.text?.toLowerCase() || "";
          if (t.includes("chassis") && !t.includes("selected") && q.type !== "zone-in" && q.type !== "zone-out") {
            return q.id;
          }
        }
      }
    }
    // Priority 5: ID Number / VIN / Serial Number / Vehicle Number questions
    for (const section of form.sections) {
      if (section.questions) {
        for (const q of section.questions) {
          const t = q.text?.toLowerCase() || "";
          if (
            (t.includes("id number") ||
              t.includes("id_number") ||
              t.includes("id no") ||
              t.includes("identification") ||
              t.includes("vin") ||
              t.includes("serial") ||
              t.includes("vehicle")) &&
            q.type !== "zone-in" &&
            q.type !== "zone-out"
          ) {
            return q.id;
          }
        }
      }
    }
    return null;
  }, [form]);

  const getResponseChassisValue = useCallback((r: Response | any): string => {
    if (!r) return "-";

    // Build master list of configured chassis options from form
    const masterOptions: { chassisNumber: string; partDescription?: string }[] = [];
    if (form?.chassisNumbers && Array.isArray(form.chassisNumbers)) {
      form.chassisNumbers.forEach((cn: any) => {
        if (typeof cn === "string" && cn.trim()) {
          masterOptions.push({ chassisNumber: cn.trim() });
        } else if (cn && typeof cn === "object" && cn.chassisNumber) {
          masterOptions.push({
            chassisNumber: String(cn.chassisNumber).trim(),
            partDescription: cn.partDescription ? String(cn.partDescription).trim() : undefined,
          });
        }
      });
    }

    const formatMasterMatch = (val: string): string => {
      const match = masterOptions.find(
        (m) => m.chassisNumber.toLowerCase() === val.toLowerCase()
      );
      if (match) {
        return match.partDescription
          ? `${match.chassisNumber} — ${match.partDescription}`
          : match.chassisNumber;
      }
      return val;
    };

    // 1. Direct top-level r.chassisNumber
    if (r.chassisNumber && typeof r.chassisNumber === "string" && r.chassisNumber.trim() !== "" && r.chassisNumber !== "N/A" && r.chassisNumber !== "-") {
      return formatMasterMatch(r.chassisNumber.trim());
    }

    // 2. Question-level chassisQuestionId from form template (e.g. "Chassis Number" question)
    if (chassisQuestionId && r.answers) {
      if (r.answers[chassisQuestionId] !== undefined && r.answers[chassisQuestionId] !== null && r.answers[chassisQuestionId] !== "") {
        const val = getChassisDisplayValue(r.answers[chassisQuestionId]);
        if (val && val !== "-" && val !== "N/A" && val !== "None") return formatMasterMatch(val);
      }
      const trackingKey = `${chassisQuestionId}_tracking`;
      if (r.answers[trackingKey] !== undefined && r.answers[trackingKey] !== null && r.answers[trackingKey] !== "") {
        const val = getChassisDisplayValue(r.answers[trackingKey]);
        if (val && val !== "-" && val !== "N/A" && val !== "None") return formatMasterMatch(val);
      }
    }

    // 3. Check explicit "Selected Chassis" / "Chassis Number" answer keys
    const selectedKeys = [
      "chassis_number",
      "chassisNumber",
      "selected_chassis",
      "selectedChassis",
      "Selected Chassis",
      "SELECTED CHASSIS",
      "selected_chassis_number",
      "Chassis Number",
      "CHASSIS NUMBER",
      "Chassis / VIN",
      "VIN",
      "vin",
      "chassis",
      "Chassis",
      "id_number",
      "idNumber",
      "ID NUMBER",
      "ID Number",
      "Serial Number",
      "serialNumber"
    ];
    if (r.answers) {
      for (const k of selectedKeys) {
        const raw = r.answers[k];
        if (raw !== undefined && raw !== null && raw !== "") {
          const val = getChassisDisplayValue(raw);
          if (val && val !== "-" && val !== "N/A" && val !== "None") {
            return formatMasterMatch(val);
          }
        }
      }
    }

    // 4. Check if ANY answer in r.answers matches one of form.chassisNumbers (e.g. "Saify")
    if (masterOptions.length > 0 && r.answers && typeof r.answers === "object") {
      for (const val of Object.values(r.answers)) {
        if (typeof val === "string" && val.trim()) {
          const matched = masterOptions.find(
            (m) => m.chassisNumber.toLowerCase() === val.trim().toLowerCase()
          );
          if (matched) {
            return matched.partDescription
              ? `${matched.chassisNumber} — ${matched.partDescription}`
              : matched.chassisNumber;
          }
        } else if (val && typeof val === "object" && (val as any).chassisNumber) {
          const cn = String((val as any).chassisNumber).trim();
          const matched = masterOptions.find(
            (m) => m.chassisNumber.toLowerCase() === cn.toLowerCase()
          );
          if (matched) {
            return matched.partDescription
              ? `${matched.chassisNumber} — ${matched.partDescription}`
              : matched.chassisNumber;
          }
        }
      }
      // If form only has 1 chassis configuration (e.g. "Saify"), use it ONLY IF no specific chassis question exists
      if (masterOptions.length === 1 && !chassisQuestionId) {
        const single = masterOptions[0];
        return single.partDescription
          ? `${single.chassisNumber} — ${single.partDescription}`
          : single.chassisNumber;
      }
    }

    return "-";
  }, [chassisQuestionId, form]);

  const [editingChassisResponseId, setEditingChassisResponseId] = useState<string | null>(null);
  const [chassisEditValue, setChassisEditValue] = useState<string>("");
  const [isSavingChassis, setIsSavingChassis] = useState(false);
  const [updatingUserResponseId, setUpdatingUserResponseId] = useState<string | null>(null);
  const chassisMasterOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const seen = new Set<string>();

    if (Array.isArray(form?.chassisNumbers)) {
      form!.chassisNumbers!.forEach((entry: any) => {
        const num = entry?.chassisNumber;
        if (num && !seen.has(String(num))) {
          seen.add(String(num));
          opts.push({
            value: String(num),
            label: entry.partDescription
              ? `${num} — ${entry.partDescription}`
              : String(num),
          });
        }
      });
    }

    responses.forEach((r) => {
      const num = getResponseChassisValue(r);
      if (num && num !== "-" && num !== "N/A" && !seen.has(String(num))) {
        seen.add(String(num));
        opts.push({ value: String(num), label: String(num) });
      }
    });

    return opts.sort((a, b) => String(a?.label ?? "").localeCompare(String(b?.label ?? "")));
  }, [form, responses, getResponseChassisValue]);

  const handleStartChassisEdit = (response: Response) => {
    setEditingChassisResponseId(response.id);
    const val = getResponseChassisValue(response);
    setChassisEditValue(val === "-" || val === "N/A" ? "" : val);
  };

  const handleCancelChassisEdit = () => {
    setEditingChassisResponseId(null);
    setChassisEditValue("");
  };

  const handleSaveChassisEdit = async (response: Response) => {
    try {
      setIsSavingChassis(true);
      const updatedAnswers = {
        ...response.answers,
        chassis_number: chassisEditValue,
        ...(chassisQuestionId ? { [chassisQuestionId]: chassisEditValue } : {})
      };
      const responseIdentifier = response.id || (response as any)._id;
      await apiClient.updateResponse(responseIdentifier, { 
        answers: updatedAnswers,
        chassisNumber: chassisEditValue 
      });

      const updateChassisMatcher = (r: Response) => {
        const rId = r.id || (r as any)._id;
        return rId === responseIdentifier || r.id === response.id || (r as any)._id === responseIdentifier
          ? { ...r, answers: updatedAnswers, chassisNumber: chassisEditValue }
          : r;
      };

      setResponses((prev) => prev.map(updateChassisMatcher));
      setTableResponses((prev) => prev.map(updateChassisMatcher));

      setEditingChassisResponseId(null);
      setChassisEditValue("");
      showToast("Chassis updated successfully!", "success");
    } catch (err) {
      console.error("Error updating chassis:", err);
      showToast("Failed to update chassis. Please try again.", "error");
    } finally {
      setIsSavingChassis(false);
    }
  };

  const handleUpdateResponseUser = async (responseId: string, userId: string) => {
    try {
      setUpdatingUserResponseId(responseId);
      const payload = {
        submittedByUserId: userId || null
      };
      const result = await apiClient.updateResponse(responseId, payload);
      if (result && result.data && result.data.response) {
        const updated = result.data.response;
        setResponses((prev) =>
          prev.map((r) =>
            r.id === responseId
              ? {
                ...r,
                createdBy: updated.createdBy,
                submittedBy: updated.submittedBy,
                submitterContact: updated.submitterContact
              }
              : r
          )
        );

        showToast("Inspector assigned successfully", "success");
      }
    } catch (error: any) {
      console.error("Error updating response user:", error);
      showToast(error?.message || "Failed to assign inspector", "error");
    } finally {
      setUpdatingUserResponseId(null);
    }
  };

  // Whether the currently logged-in user is the one who submitted this
  // response (used to block a submitter from BIW-reviewing their own work —
  // mirrors the same submitter check already used for the Dispatch column).
  // Exceptions: admins/superadmins can review anything (including their own
  // submissions), and "Excel Import" responses have no real submitter, so
  // anyone can review those too.
  const isSubmitterOfResponse = (response: Response) => {
    if (user?.role === "admin" || user?.role === "superadmin") return false;
    if (response.submittedBy === "Excel Import") return false;

    const userEmail = user?.email || "";
    const userUsername = user?.username || "";
    const userIdStr = user?._id
      ? String(user._id)
      : user?.id
        ? String(user.id)
        : "";
    const creatorId =
      typeof response.createdBy === "object"
        ? (response.createdBy as any)?._id || (response.createdBy as any)?.id
        : response.createdBy;
    const creatorIdStr = creatorId ? String(creatorId) : "";

    return (
      response.submittedBy === userEmail ||
      response.submittedBy === userUsername ||
      response.createdBy === userEmail ||
      response.createdBy === userUsername ||
      response.submitterContact?.email === userEmail ||
      (creatorIdStr && creatorIdStr === userIdStr)
    );
  };
  const isOwnTenantResponse = (response: Response) => {
    // Superadmins and Admins have full inspection and dispatch permissions across forms in their dashboard
    if (user?.role === "superadmin" || user?.role === "admin") {
      return true;
    }

    const userTenantId = user?.tenantId;
    if (!userTenantId) {
      return false;
    }

    const responseTenantId = response.tenantId;
    if (!responseTenantId) {
      return true; // legacy data with no tenant — allow
    }

    const userTenantStr = typeof userTenantId === 'object'
      ? String((userTenantId as any)?._id || (userTenantId as any)?.id || userTenantId)
      : String(userTenantId);

    const responseTenantStr = typeof responseTenantId === 'object'
      ? String((responseTenantId as any)?._id || (responseTenantId as any)?.id || responseTenantId)
      : String(responseTenantId);

    // If user's tenant matches the response tenant OR form owner/shared tenant
    if (userTenantStr === responseTenantStr) return true;
    if (form?.tenantId && userTenantStr === String((form.tenantId as any)?._id || form.tenantId)) return true;
    if (form?.sharedWithTenants && Array.isArray(form.sharedWithTenants) && form.sharedWithTenants.some(t => String((t as any)?._id || t) === userTenantStr)) return true;

    return false;
  };

  // BIW Review: any reviewer other than the submitter can mark a response as
  // Accepted / Rejected / Reworked from the Responses table. Selecting one
  // option saves it to the response (biwReview) and unsets the others —
  // acts like a single-select despite being rendered as three checkboxes.
  // The server is authoritative on reviewedBy/reviewedAt and re-checks the
  // "not your own submission" rule, so we only send the status here.
  // NEW - flat list of {id, text} questions that belong to this response's
  // form, used to populate the "which question is this about" checkboxes
  // in the BIW Reject/Rework popup. Falls back to the response's answer
  // keys if the form/sections aren't loaded for some reason.
  const getResponseQuestionOptions = (
    response: Response,
  ): { id: string; text: string }[] => {
    const options: { id: string; text: string }[] = [];
    if (form?.sections?.length) {
      form.sections.forEach((section) => {
        section.questions?.forEach((q: any) => {
          if (response.answers && Object.prototype.hasOwnProperty.call(response.answers, q.id)) {
            options.push({ id: q.id, text: q.text || q.id });
          }
        });
      });
    }
    if (options.length === 0 && response.answers) {
      Object.keys(response.answers).forEach((qId) =>
        options.push({ id: qId, text: qId }),
      );
    }
    return options;
  };

  const handleBiwReviewChange = async (
    response: Response,
    status: "Accepted" | "Rejected" | "Reworked",
  ) => {
    if (isSubmitterOfResponse(response)) {
      showToast("You cannot BIW review your own submission", "error");
      return;
    }

    // Clicking the already-selected option clears the review; otherwise set it.
    const isUnselecting = response.biwReview?.status === status;

    // NEW - Reject/Rework (when not simply clearing an existing selection)
    // needs the question(s) + remark + evidence popup instead of an
    // immediate save.
    if (!isUnselecting && (status === "Rejected" || status === "Reworked")) {
      setBiwActionResponse(response);
      setBiwActionStatus(status);
      setBiwActionSelectedQuestionIds(
        response.biwReview?.flaggedQuestions?.map((q) => q.questionId) || [],
      );
      setBiwActionRemark(response.biwReview?.remark || "");
      setBiwActionEvidenceUrl(response.biwReview?.evidenceUrl || "");
      setShowBiwActionModal(true);
      return;
    }

    const payload = isUnselecting ? null : { status };

    try {
      setBiwSavingResponseId(response.id);
      const result = await apiClient.updateResponse(response.id, {
        biwReview: payload,
      });

      const savedBiwReview =
        (result as any)?.response?.biwReview ??
        (result as any)?.data?.response?.biwReview ??
        (payload
          ? {
              status,
              reviewedBy: user?.id,
              reviewedByName: user?.name,
              reviewedAt: new Date().toISOString(),
            }
          : undefined);

      setResponses((prev) =>
        prev.map((r) =>
          r.id === response.id ? { ...r, biwReview: savedBiwReview } : r,
        ),
      );

      // Also update tableResponses so the table UI reflects the change immediately
      setTableResponses((prev) =>
        prev.map((r) =>
          r.id === response.id ? { ...r, biwReview: savedBiwReview } : r,
        ),
      );


      showToast(
        isUnselecting
          ? "BIW review cleared"
          : `Marked as ${status} (BIW Review)`,
        "success",
      );
    } catch (err: any) {
      console.error("Error saving BIW review:", err);
      const message =
        err?.message || "Failed to save BIW review. Please try again.";
      showToast(message, "error");
    } finally {
      setBiwSavingResponseId(null);
    }
  };

  // NEW - closes and resets the Reject/Rework popup.
  const closeBiwActionModal = () => {
    setShowBiwActionModal(false);
    setBiwActionResponse(null);
    setBiwActionStatus(null);
    setBiwActionSelectedQuestionIds([]);
    setBiwActionRemark("");
    setBiwActionEvidenceUrl("");
  };

  // NEW - evidence upload inside the popup, reusing the same
  // apiClient.uploadFile("form") path used elsewhere in this dashboard.
  const handleBiwEvidenceUpload = async (file: File) => {
    try {
      setBiwActionUploading(true);
      const result = await apiClient.uploadFile(file, "form");
      const url = apiClient.resolveUploadedFileUrl(result);
      if (url) setBiwActionEvidenceUrl(url);
    } catch (err) {
      console.error("BIW evidence upload failed:", err);
      showToast("Evidence upload failed. Please try again.", "error");
    } finally {
      setBiwActionUploading(false);
    }
  };

  const toggleBiwActionQuestion = (questionId: string) => {
    setBiwActionSelectedQuestionIds((prev) =>
      prev.includes(questionId)
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId],
    );
  };

  // NEW - submits the Reject/Rework popup: saves status + remark +
  // evidence + the flagged questions (id snapshotted with its current
  // text) onto the response's biwReview.
  const submitBiwActionModal = async () => {
    if (!biwActionResponse || !biwActionStatus) return;

    if (!biwActionRemark.trim()) {
      showToast("Please add a remark before submitting", "error");
      return;
    }
    if (biwActionSelectedQuestionIds.length === 0) {
      showToast("Please select at least one question", "error");
      return;
    }

    const questionOptions = getResponseQuestionOptions(biwActionResponse);
    const flaggedQuestions = biwActionSelectedQuestionIds.map((id) => ({
      questionId: id,
      questionText:
        questionOptions.find((q) => q.id === id)?.text || id,
    }));

    try {
      setIsBiwActionSubmitting(true);
      const result = await apiClient.updateResponse(biwActionResponse.id, {
        biwReview: {
          status: biwActionStatus,
          remark: biwActionRemark.trim(),
          evidenceUrl: biwActionEvidenceUrl || null,
          flaggedQuestions,
        },
      });

      const savedBiwReview =
        (result as any)?.response?.biwReview ??
        (result as any)?.data?.response?.biwReview ?? {
          status: biwActionStatus,
          remark: biwActionRemark.trim(),
          evidenceUrl: biwActionEvidenceUrl || null,
          flaggedQuestions,
          reviewedBy: user?.id,
          reviewedByName: user?.name,
          reviewedAt: new Date().toISOString(),
        };

      setResponses((prev) =>
        prev.map((r) =>
          r.id === biwActionResponse.id ? { ...r, biwReview: savedBiwReview } : r,
        ),
      );
      setTableResponses((prev) =>
        prev.map((r) =>
          r.id === biwActionResponse.id ? { ...r, biwReview: savedBiwReview } : r,
        ),
      );

      showToast(`Marked as ${biwActionStatus} (BIW Review)`, "success");
      closeBiwActionModal();
    } catch (err: any) {
      console.error("Error saving BIW review:", err);
      showToast(
        err?.message || "Failed to save BIW review. Please try again.",
        "error",
      );
    } finally {
      setIsBiwActionSubmitting(false);
    }
  };

  const executeBulkBiwReviewUpdate = async () => {
    if (biwBulkUpdateTargetIds.length === 0) return;

    try {
      setIsBulkBiwUpdating(true);
      const result = await apiClient.bulkUpdateBiwReview(biwBulkUpdateTargetIds, biwBulkUpdateStatus);

      // Update local state
      const biwReviewUpdate = (r: Response) => {
        const rId = r.id || (r as any)._id;
        if (biwBulkUpdateTargetIds.includes(r.id) || (rId && biwBulkUpdateTargetIds.includes(rId))) {
          return {
            ...r,
            biwReview: biwBulkUpdateStatus === null ? undefined : {
              status: biwBulkUpdateStatus,
              reviewedBy: user?._id || user?.id,
              reviewedByName: user?.username || user?.email || 'Reviewer',
              reviewedAt: new Date().toISOString()
            }
          };
        }
        return r;
      };

      setResponses((prev) => prev.map(biwReviewUpdate));

      // Also update tableResponses so the table UI reflects the change immediately
      setTableResponses((prev) => prev.map(biwReviewUpdate));

      setSelectedResponseIds([]);
      setSelectedBiwIds([]);
      showToast(
        biwBulkUpdateStatus === null
          ? `Cleared BIW review for ${result?.updatedCount ?? biwBulkUpdateTargetIds.length} response(s)`
          : `Marked ${result?.updatedCount ?? biwBulkUpdateTargetIds.length} response(s) as ${biwBulkUpdateStatus} (BIW Review)` +
          ((result?.skippedCount ?? biwBulkUpdateSkippedCount) > 0 ? ` (${result?.skippedCount ?? biwBulkUpdateSkippedCount} skipped)` : ""),
        "success"
      );
    } catch (err: any) {
      console.error("Error bulk updating BIW reviews:", err);
      showToast(err?.message || "Failed to bulk update BIW reviews", "error");
    } finally {
      setIsBulkBiwUpdating(false);
      setShowBiwBulkUpdateModal(false);
    }
  };

  const handleBulkBiwReviewUpdate = (status: "Accepted" | "Rejected" | "Reworked" | null) => {
    if (selectedResponseIds.length === 0) return;

    const validResponseIds: string[] = [];
    let selfSubmissionsCount = 0;

    selectedResponseIds.forEach((id) => {
      // `responses` (the full analytics set) may not be loaded if the user
      // came straight to the Responses tab without visiting another tab
      // first; fall back to the server-paginated `tableResponses`, which
      // always has the rows actually checked on this page.
      const resp =
        responses.find((r) => r.id === id || (r as any)._id === id) ||
        tableResponses.find((r) => r.id === id || (r as any)._id === id) ||
        displayedTableResponses.find((r) => r.id === id || (r as any)._id === id);
      if (resp) {
        if (status !== null && isSubmitterOfResponse(resp)) {
          selfSubmissionsCount++;
        } else {
          validResponseIds.push(id);
        }
      }
    });

    if (validResponseIds.length === 0) {
      showToast(
        "You cannot BIW review your own submissions. All selected items were skipped.",
        "error"
      );
      return;
    }

    setBiwBulkUpdateStatus(status);
    setBiwBulkUpdateTargetIds(validResponseIds);
    setBiwBulkUpdateSkippedCount(selfSubmissionsCount);
    setShowBiwBulkUpdateModal(true);
  };

  const handleBulkBiwReviewUpdateAll = (status: "Accepted" | "Rejected" | "Reworked" | null) => {
    const sourceList = displayedTableResponses.length > 0 ? displayedTableResponses : tableResponses;
    if (sourceList.length === 0) return;

    const allIds = sourceList.map((r) => r.id || (r as any)._id).filter(Boolean);

    const validResponseIds: string[] = [];
    let selfSubmissionsCount = 0;

    allIds.forEach((id) => {
      // Same fallback as above: tableResponses always has these rows since
      // allIds was derived from it directly.
      const resp =
        responses.find((r) => r.id === id || (r as any)._id === id) ||
        tableResponses.find((r) => r.id === id || (r as any)._id === id) ||
        displayedTableResponses.find((r) => r.id === id || (r as any)._id === id);
      if (resp) {
        if (status !== null && isSubmitterOfResponse(resp)) {
          selfSubmissionsCount++;
        } else {
          validResponseIds.push(id);
        }
      }
    });

    if (validResponseIds.length === 0) {
      showToast(
        "You cannot BIW review your own submissions. All items were skipped.",
        "error"
      );
      return;
    }

    setBiwBulkUpdateStatus(status);
    setBiwBulkUpdateTargetIds(validResponseIds);
    setBiwBulkUpdateSkippedCount(selfSubmissionsCount);
    setShowBiwBulkUpdateModal(true);
  };

  // Bulk auto-fill: instead of looping through every response client-side,
  // this calls the backend's single bulk-update endpoint (see
  // apiClient.autoFillChassisNumbers / responseController.autoFillChassisNumbers),
  // which fills every response with no chassis_number using the first
  // configured chassis option, in one database call. Triggered manually via
  // the button in the "Selected Chassis" column header.
  const [isAutoFillingChassis, setIsAutoFillingChassis] = useState(false);

  const handleAutoFillAllChassis = async () => {
    if (!chassisMasterOptions.length) {
      showToast("No chassis numbers are configured for this form.", "error");
      return;
    }
    if (!id) return;

    const confirmed = window.confirm(
      `This will set every response that currently has no chassis number to "${chassisMasterOptions[0].label}". Continue?`,
    );
    if (!confirmed) return;

    try {
      setIsAutoFillingChassis(true);
      const result = await apiClient.autoFillChassisNumbers(id);
      const defaultValue = result.defaultValue ?? chassisMasterOptions[0].value;
      const modifiedCount = result.modifiedCount ?? 0;

      // Reflect the change locally right away instead of waiting on a refetch
      const updateChassisInResponse = (r: Response) => {
        const current = getResponseChassisValue(r);
        const isEmpty = !current || current === "-" || current === "N/A" || current === "None" || String(current).trim() === "";
        if (!isEmpty) return r;
        const newAnswers = { ...(r.answers || {}), chassis_number: defaultValue };
        if (chassisQuestionId) {
          newAnswers[chassisQuestionId] = defaultValue;
        }
        return {
          ...r,
          chassisNumber: defaultValue,
          answers: newAnswers,
        };
      };

      setResponses((prev) => prev.map(updateChassisInResponse));
      setTableResponses((prev) => prev.map(updateChassisInResponse));
      if (typeof fetchResponsesPage === "function" && currentResponsesPage) {
        fetchResponsesPage(currentResponsesPage);
      }

      showToast(
        modifiedCount > 0
          ? `Auto-filled ${modifiedCount} response(s) with "${defaultValue}".`
          : "All responses already have a chassis number.",
        "success",
      );
    } catch (err) {
      console.error("Error auto-filling chassis numbers:", err);
      showToast("Failed to auto-fill chassis numbers. Please try again.", "error");
    } finally {
      setIsAutoFillingChassis(false);
    }
  };



  // Sync tab with URL parameter
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get("tab");
    if (tabParam && ["question", "section", "table", "responses", "dashboard", "comparison", "overall"].includes(tabParam)) {
      if (hasTabPermission(tabParam)) {
        setAnalyticsView(tabParam as any);
      }
    }
  }, [location.search, form]);

  // Sync URL parameter with tab changes
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("tab") !== analyticsView) {
      searchParams.set("tab", analyticsView);
      const searchStr = searchParams.toString();
      navigate({
        pathname: location.pathname,
        search: searchStr ? `?${searchStr}` : ""
      }, { replace: true });
    }
  }, [analyticsView, navigate, location.pathname, location.search]);

  // Set initial tab based on permissions after form loads
  useEffect(() => {
    if (!form) return;

    // If URL has a specific valid tab param, let the sync effect handle it
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get("tab");
    if (tabParam && ["question", "section", "table", "responses", "dashboard", "comparison", "overall"].includes(tabParam)) {
      return;
    }

    // Otherwise, default to first allowed tab
    const tabOrder = ["dashboard", "responses"];
    for (const tab of tabOrder) {
      if (hasTabPermission(tab)) {
        setAnalyticsView(tab as any);
        break;
      }
    }
  }, [form]);
  const [tableViewType, setTableViewType] = useState<"question" | "section">(
    "question",
  );
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);

  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");
  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
  const [filterValues, setFilterValues] = useState<string[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSectionSelector, setShowSectionSelector] = useState(false);
  const [shareAnalyticsModal, setShareAnalyticsModal] = useState<{
    open: boolean;
    formId: string;
    formTitle: string;
  }>({ open: false, formId: "", formTitle: "" });
  const [autoSendModal, setAutoSendModal] = useState<{
    open: boolean;
    formId: string;
    formTitle: string;
  }>({ open: false, formId: "", formTitle: "" });
  const [appliedFilters, setAppliedFilters] = useState<
    Array<{ id: string; label: string; value: string }>
  >([]);
  const [cascadingFilters, setCascadingFilters] = useState<
    Record<string, string[]>
  >({});
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatResponse, setChatResponse] = useState<Response | null>(null);
  const [chatFilters, setChatFilters] = useState(() => {
    // Load from localStorage to persist suggestedAnswers between modal opens
    try {
      const saved = localStorage.getItem("chatFilters");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          chassisNumber: "",
          location: "",
          questions: [] as string[],
          selectedCategories: {} as Record<string, string[]>,
          suggestedAnswers: parsed.suggestedAnswers || {},
          zoneType: "both" as "with" | "without" | "both",
        };
      }
    } catch (error) {
      console.error("Failed to load chatFilters from localStorage:", error);
    }

    return {
      chassisNumber: "",
      location: "",
      questions: [] as string[],
      selectedCategories: {} as Record<string, string[]>,
      suggestedAnswers: {} as Record<string, any>,
      zoneType: "both" as "with" | "without" | "both",
    };
  });
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [selectedInspectorForTrend, setSelectedInspectorForTrend] =
    useState<string>("Overall");
  const [localFilterName, setLocalFilterName] = useState<string>("All");

  // BIW Review Table data — computed client-side from the full `responses`
  // dataset (not the server-paginated `tableResponses`), grouped by
  // submitter, the same way the User Name rows are read in the Performance
  // Table. Accepted/Rejected/Reworked/Total Reviewed here only count BIW
  // review clicks, not the regular review flow.
  const biwReviewTableData = useMemo(() => {
    const byUser = new Map<
      string,
      {
        name: string;
        totalSubmitted: number;
        dispatched: number;
        accepted: number;
        rejected: number;
        rework: number;
      }
    >();

    responses.forEach((response) => {
      const name =
        response.submittedBy || response.createdBy || "Anonymous";
      if (!byUser.has(name)) {
        byUser.set(name, {
          name,
          totalSubmitted: 0,
          dispatched: 0,
          accepted: 0,
          rejected: 0,
          rework: 0,
        });
      }
      const stats = byUser.get(name)!;
      stats.totalSubmitted += 1;
      if (response.isDispatched) stats.dispatched += 1;

      const biwStatus = response.biwReview?.status;
      if (biwStatus === "Accepted") stats.accepted += 1;
      else if (biwStatus === "Rejected") stats.rejected += 1;
      else if (biwStatus === "Reworked") stats.rework += 1;
    });

    return Array.from(byUser.values()).map((stats) => {
      const totalReviewed = stats.accepted + stats.rejected + stats.rework;
      const performanceScore =
        totalReviewed > 0
          ? Math.round((stats.accepted / totalReviewed) * 100)
          : 0;
      return { ...stats, totalReviewed, performanceScore };
    });
  }, [responses]);
  const [localFilterShift, setLocalFilterShift] = useState<string>("All");
  const [localFilterDate, setLocalFilterDate] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<{
    type: "all" | "single" | "range";
    startDate: string;
    endDate: string;
  }>({ type: "all", startDate: "", endDate: "" });

  const commonDateRangeLabel = useMemo(() => {
    if (dateFilter.startDate && dateFilter.endDate) {
      return `${new Date(dateFilter.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${new Date(dateFilter.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    } else if (dateFilter.startDate) {
      return `From ${new Date(dateFilter.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    } else if (dateFilter.endDate) {
      return `Until ${new Date(dateFilter.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    }
    return "All Time";
  }, [dateFilter.startDate, dateFilter.endDate]);

  const [hasUserAppliedDateFilter, setHasUserAppliedDateFilter] =
    useState(false);

  useEffect(() => {
    if (hasUserAppliedDateFilter) return; // user is in control now, don't override

    if (analyticsView === "dashboard") {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 29); // last 30 days, inclusive of today
      setDateFilter({
        type: "range",
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      });
    } else {
      setDateFilter({ type: "all", startDate: "", endDate: "" });
    }
  }, [analyticsView, hasUserAppliedDateFilter]);






  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [columnFilters, setColumnFilters] = useState<
    Record<string, string[] | null>
  >({});

  // ── Performance: keep filter/sort updates non-blocking ──────────────────────
  // startFilterTransition wraps setColumnFilters / setTableSort calls so React
  // can keep the current rendered frame interactive while it re-calculates the
  // filtered table in the background. `isFilterPending` drives a subtle
  // opacity pulse on the table so the user sees work is in progress.
  const [isFilterPending, startFilterTransition] = useTransition();
  const [tableSort, setTableSort] = useState<{
    columnId: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [selectedResponsesSectionIds, setSelectedResponsesSectionIds] =
    useState<string[]>([]);
  const [showResponsesFilter, setShowResponsesFilter] = useState(false);
  const [editingResponseId, setEditingResponseId] = useState<string | null>(
    null,
  );
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});
  const [editFormStatus, setEditFormStatus] = useState<string>("Accepted");
  const [editFormNotes, setEditFormNotes] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingResponseId, setDeletingResponseId] = useState<string | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedResponseIds, setSelectedResponseIds] = useState<string[]>([]);
  const [selectedDispatchIds, setSelectedDispatchIds] = useState<string[]>([]);
  const [selectedBiwIds, setSelectedBiwIds] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showBulkDispatchConfirm, setShowBulkDispatchConfirm] = useState(false);
  const [showActionMenuModal, setShowActionMenuModal] = useState(false);
  const [actionResponse, setActionResponse] = useState<Response | null>(null);

  // Performance scoring system
  const [performanceScores, setPerformanceScores] = useState<
    Record<string, number>
  >({});

  const [performanceTableData, setPerformanceTableData] = useState<any[]>([]);
  const [performanceTableLoading, setPerformanceTableLoading] = useState(false);
  const [performancePage, setPerformancePage] = useState(1);
  const [performancePageSize, setPerformancePageSize] = useState(10);
  // Server-side pagination metadata for the performance table. The backend
  // now paginates the underlying responses query (skip/limit) rather than
  // returning the entire dataset, so `hasMore` drives whether "Next" is
  // enabled instead of a locally-computed page count.
  const [performanceHasMore, setPerformanceHasMore] = useState(false);
  const [responsesPage, setResponsesPage] = useState(1);
  const [responsesPageSize, setResponsesPageSize] = useState(20);
  const [responsesSearchTerm, setResponsesSearchTerm] = useState("");
  // Deferred value: lets the input update immediately while the expensive
  // filter computation (filteredResponses useMemo) only re-runs after the
  // browser has had a chance to paint the new input character.
  const deferredSearchTerm = useDeferredValue(responsesSearchTerm);

  // Lazy-loading-by-tab state. Nothing in `loadedTabs` fires on mount —
  // each tab's data is fetched the first time the user actually views it.
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "question" | "section" | "overall" | "responses"
  >("dashboard");
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set());
  // Server-side paginated data for the Responses tab (replaces the old
  // client-side slice of the full `responses` array).
  const [tableResponses, setTableResponses] = useState<Response[]>([]);
  const [totalResponsesCount, setTotalResponsesCount] = useState(0);
  const [loadingTable, setLoadingTable] = useState(false);
  // Drives the dashboard's single loading spinner. True until the full
  // analytics response set (used by the trend chart, quality pie chart,
  // defect chart, etc.) has finished its first fetch. Starts true so the
  // spinner shows immediately on the default "dashboard" tab instead of a
  // flash of "No data" while the lazy fetch is still in flight.
  const [analyticsResponsesLoading, setAnalyticsResponsesLoading] = useState(true);



  // BIW Review — a second, independent accept/reject/rework check that any
  // reviewer (other than the response's own submitter) can apply from the
  // Responses table. Saved to the response via biwReview and rolled up into
  // its own "BIW Review Table" (mirrors the main Performance Table).
  const [biwSavingResponseId, setBiwSavingResponseId] = useState<string | null>(
    null,
  );
  const [biwReviewPage, setBiwReviewPage] = useState(1);
  const [biwReviewPageSize, setBiwReviewPageSize] = useState(10);
  const [isBulkBiwUpdating, setIsBulkBiwUpdating] = useState(false);
  const [showBiwBulkUpdateModal, setShowBiwBulkUpdateModal] = useState(false);
  const [biwBulkUpdateStatus, setBiwBulkUpdateStatus] = useState<"Accepted" | "Rejected" | "Reworked" | null>(null);
  const [biwBulkUpdateTargetIds, setBiwBulkUpdateTargetIds] = useState<string[]>([]);
  const [biwBulkUpdateSkippedCount, setBiwBulkUpdateSkippedCount] = useState(0);

  // NEW - BIW Review action popup (opens for Reject/Rework instead of
  // saving immediately): lets the reviewer pick which question(s) the
  // decision is about, add a remark, and attach evidence.
  const [showBiwActionModal, setShowBiwActionModal] = useState(false);
  const [biwActionResponse, setBiwActionResponse] = useState<Response | null>(null);
  const [biwActionStatus, setBiwActionStatus] = useState<"Rejected" | "Reworked" | null>(null);
  const [biwActionSelectedQuestionIds, setBiwActionSelectedQuestionIds] = useState<string[]>([]);
  const [biwActionRemark, setBiwActionRemark] = useState("");
  const [biwActionEvidenceUrl, setBiwActionEvidenceUrl] = useState("");
  const [biwActionUploading, setBiwActionUploading] = useState(false);
  const [isBiwActionSubmitting, setIsBiwActionSubmitting] = useState(false);

  // NEW - Eye icon "view" modal: read-only look at a saved BIW review
  // (status, flagged questions, remark, evidence).
  const [showBiwViewModal, setShowBiwViewModal] = useState(false);
  const [biwViewResponse, setBiwViewResponse] = useState<Response | null>(null);


  // Server-side pagination for the "Responses" table tab: fetches only the
  // current page directly from the backend instead of slicing an
  // already-loaded full dataset in memory (see fetchResponsesPage below).
  //
  // NOTE: the existing date/inspector/location/column/cascading filters
  // below are computed against the full in-memory `responses` array for the
  // charts and other analytics tabs. They are NOT (yet) sent to the backend,
  // so they won't filter this server-paginated table — only pagination
  // (page + page size) is server-side for now.
  const isLoadingTableResponses = loadingTable;

  // Gates the entire Dashboard tab behind a single spinner instead of
  // letting each chart/table independently render its own "No data yet"
  // state while the full analytics response set is still in flight.
  // Deliberately NOT tied to the top-level `loading` flag: that only
  // covers the initial form-details fetch (see fetchData), which now
  // resolves well before the dashboard's own lazy data finishes loading —
  // wiring it to `loading` would let the empty states flash through
  // exactly as before.
  const isChartLoading = analyticsResponsesLoading;

  // fetchPerformanceTable and fetchSummary are now plain functions (not
  // auto-firing effects) — they're invoked lazily from the tab-loading
  // effects further down, the first time the Dashboard tab is opened.
  const fetchPerformanceTable = async () => {
    if (!id || (user?.role !== "admin" && user?.role !== "superadmin"))
      return;

    setPerformanceTableLoading(true);
    try {
      const response = await apiClient.getPerformanceTable({
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
        formId: id,
        page: performancePage,
        limit: performancePageSize,
      });
      if (response.success) {
        setPerformanceTableData(response.data || []);
        setPerformanceHasMore(!!response.pagination?.hasMore);
      }
    } catch (error) {
      console.error("Error fetching performance table:", error);
      // Don't show error toast for performance table - it's not critical
      if (error instanceof Error && !error.message?.includes('timeout')) {
        showToast("Failed to load performance data", "error");
      }
    } finally {
      setPerformanceTableLoading(false);
    }
  };

  // Re-fetch on page/page-size/filter changes, but only once the Dashboard
  // tab has already been loaded at least once — the initial load is
  // triggered by the lazy-tab effect instead, so this avoids a duplicate
  // fetch racing it on first mount.
  useEffect(() => {
    if (loadedTabs.has("dashboard")) {
      fetchPerformanceTable();
    }
    // performancePage/performancePageSize are included so paging or
    // changing page size re-fetches from the server instead of slicing an
    // already-loaded full dataset in memory.
  }, [id, dateFilter.startDate, dateFilter.endDate, user?.role, performancePage, performancePageSize]);

  // Reset back to page 1 whenever the filters that change the underlying
  // dataset change, so the user isn't stranded on a page that no longer
  // exists for the new filter set.
  useEffect(() => {
    setPerformancePage(1);
  }, [id, dateFilter.startDate, dateFilter.endDate]);

  // Load performance scores from API
  useEffect(() => {
    const loadScores = async () => {
      try {
        const response = await apiClient.getPerformanceScores();
        if (response && response.data) {
          setPerformanceScores(response.data);
        }
      } catch (error) {
        console.error("Failed to load performance scores:", error);
        // Fallback to empty scores
        setPerformanceScores({});
      }
    };
    loadScores();
  }, []);

  // Initialize performance score for current user if not exists
  useEffect(() => {
    if (user?._id && !performanceScores[user._id]) {
      setPerformanceScores((prev) => ({
        ...prev,
        [user._id]: 100, // Start with 100%
      }));
    }
  }, [user?._id, performanceScores]);

  // Review system for peer evaluation
  const [selectedReviewOptions, setSelectedReviewOptions] = useState<
    Record<string, string>
  >(() => {
    try {
      const saved = localStorage.getItem("selectedReviewOptions");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [reviewedBy, setReviewedBy] = useState<
    Record<string, { id: string; name: string; email: string } | null>
  >(() => {
    try {
      const saved = localStorage.getItem("reviewedBy");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [reviewSubmitted, setReviewSubmitted] = useState<
    Record<string, boolean>
  >(() => {
    try {
      const saved = localStorage.getItem("reviewSubmitted");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [forceUpdate, setForceUpdate] = useState(0);
  const [pendingReviewOption, setPendingReviewOption] = useState<string | null>(
    null,
  ); // for Rejected/Rework question-selection flow

  // Save chatFilters suggestedAnswers to localStorage
  useEffect(() => {
    console.log(
      "suggestedAnswers changed:",
      Object.keys(chatFilters.suggestedAnswers || {}),
    );
    try {
      const filtersToSave = {
        suggestedAnswers: chatFilters.suggestedAnswers,
      };
      localStorage.setItem("chatFilters", JSON.stringify(filtersToSave));
    } catch (error) {
      console.error("Failed to save chatFilters:", error);
    }
  }, [chatFilters.suggestedAnswers]);

  // Save review states to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        "selectedReviewOptions",
        JSON.stringify(selectedReviewOptions),
      );
    } catch (error) {
      console.error("Failed to save selectedReviewOptions:", error);
    }
  }, [selectedReviewOptions]);

  useEffect(() => {
    try {
      localStorage.setItem("reviewedBy", JSON.stringify(reviewedBy));
    } catch (error) {
      console.error("Failed to save reviewedBy:", error);
    }
  }, [reviewedBy]);

  useEffect(() => {
    try {
      localStorage.setItem("reviewSubmitted", JSON.stringify(reviewSubmitted));
    } catch (error) {
      console.error("Failed to save reviewSubmitted:", error);
    }
  }, [reviewSubmitted]);

  const tenantId = useMemo(() => {
    // Get from form
    if (form?.tenantId) {
      return typeof form.tenantId === "object"
        ? form.tenantId._id
        : form.tenantId;
    }
    // Or from user
    if (user?.tenantId) {
      return typeof user.tenantId === "object"
        ? user.tenantId._id
        : user.tenantId;
    }
    return null;
  }, [form, user]);

  // Check if the current user belongs to the same tenant as the form.
  // Dispatch enable (bulk select) should only be available for own-tenant users,
  // not for cross-tenant users viewing shared/cross-tenant forms.
  const isOwnTenantForm = useMemo(() => {
    if (user?.role === "superadmin") return true;
    const formTenantId = form?.tenantId
      ? typeof form.tenantId === "object"
        ? (form.tenantId as { _id?: string })._id
        : form.tenantId
      : null;
    const userTenantIdRaw = user?.tenantId as any;
    const userTenantId = userTenantIdRaw
      ? typeof userTenantIdRaw === "object"
        ? userTenantIdRaw._id
        : userTenantIdRaw
      : null;
    // If the form has no tenant, treat as own tenant (legacy behavior).
    return !formTenantId || (userTenantId && formTenantId.toString() === userTenantId.toString());
  }, [form, user]);

  // Dispatch bulk-select is allowed for superadmins and same-tenant admins.
  const canBulkDispatchResponses = canBulkSelectResponses && (user?.role === "superadmin" || isOwnTenantForm);
  const handleReviewSubmit = async (
    responseId: string,
    reviewOption: string,
  ) => {
    console.log("=== HANDLE REVIEW SUBMIT START ===");
    console.log("responseId:", responseId);
    console.log("reviewOption:", reviewOption);

    // Get reviewerId properly
    let reviewerId = user?._id || user?.id;
    if (!reviewerId) {
      try {
        const token = localStorage.getItem("auth_token");
        if (token) {
          const payload = JSON.parse(atob(token.split(".")[1]));
          reviewerId = payload.userId || payload.id;
        }
      } catch (e) {
        console.error("Failed to parse token:", e);
      }
    }

    if (!reviewerId) {
      showToast("Cannot submit review. User ID not found.", "error");
      return;
    }

    if (!chatResponse) return;

    let submitterId = (chatResponse as any).submittedBy;

    if (!submitterId && chatResponse.createdBy) {
      if (typeof chatResponse.createdBy === "object") {
        submitterId =
          (chatResponse.createdBy as any)._id ||
          (chatResponse.createdBy as any).id;
      } else {
        submitterId = chatResponse.createdBy;
      }
    }

    if (!submitterId) {
      showToast(
        "Cannot submit review. Missing submitter information.",
        "error",
      );
      return;
    }

    // Don't allow self-review
    if (submitterId && reviewerId === submitterId) {
      showToast("You cannot review your own submissions", "error");
      return;
    }

    // Only allow reviews for valid response statuses
    const responseStatus = responseStatuses[responseId];
    const validStatusesForReview = [
      "Direct Ok",
      "Rework Accepted",
      "Accepted",
      "Pending Review",
      "Rework Completed",
    ];
    if (!validStatusesForReview.includes(responseStatus)) {
      showToast("This response status cannot be reviewed", "error");
      return;
    }

    try {
      setPendingReviewOption(null);

      const reviewData = {
        responseId,
        reviewerId: reviewerId,
        submitterId: submitterId,
        reviewOption,
        tenantId: tenantId,
      };

      console.log("📤 Submitting review with data:", reviewData);

      const result = await apiClient.submitReview(reviewData);

      console.log("📥 Review API response:", result);

      // ✅ Check if successful
      if (result && result.success) {
        console.log("✅ Review submitted successfully!");

        // Clear local state to force refresh from API
        setSelectedReviewOptions((prev) => {
          const newState = { ...prev };
          delete newState[responseId];
          return newState;
        });
        setReviewedBy((prev) => {
          const newState = { ...prev };
          delete newState[responseId];
          return newState;
        });
        setReviewSubmitted((prev) => {
          const newState = { ...prev };
          delete newState[`${reviewerId}-${responseId}`];
          return newState;
        });

        // Refresh chat history to get the new review
        await fetchChatHistory(responseId);
        setForceUpdate((prev) => prev + 1);

        showToast(
          result.message || `Review submitted: ${reviewOption}`,
          "success",
        );
      } else {
        console.error("❌ Review submission failed:", result);
        showToast(result?.message || "Failed to submit review", "error");
      }
    } catch (error: any) {
      console.error("❌ Review submission error:", error);
      showToast(error.message || "Failed to submit review", "error");
    }
  };

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    id: string;
  } | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<Response | null>(
    null,
  );
  const [selectedFormForModal, setSelectedFormForModal] = useState<Form | null>(
    null,
  );
  const [formLoading, setFormLoading] = useState(false);
  const [comparisonViewMode, setComparisonViewMode] = useState<
    "dashboard" | "responses"
  >("dashboard");
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [inspectorSummary, setInspectorSummary] = useState<any[]>([]);
  const [expandedInspectorForms, setExpandedInspectorForms] = useState<
    Set<string>
  >(new Set());
  const [allInspectors, setAllInspectors] = useState<any[]>([]);
  const [summaryStatuses, setSummaryStatuses] = useState<string[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [chartOrientation, setChartOrientation] = useState<"v" | "h">("v");
  const [timeSeriesView, setTimeSeriesView] = useState<"daily" | "monthly">(
    "daily",
  );
  const [chartSortOrder, setChartSortOrder] = useState<
    "default" | "percentage"
  >("percentage");

  const activeGlobalFilterCount = useMemo(() => {
    let count = 0;
    Object.values(cascadingFilters).forEach((answers) => {
      if (answers && answers.length > 0) count++;
    });
    if (locationFilter && locationFilter.length > 0) count++;
    if (
      dateFilter.type !== "all" &&
      (dateFilter.startDate || dateFilter.endDate)
    )
      count++;
    Object.values(columnFilters).forEach((values) => {
      if (values && values.length > 0) count++;
    });
    return count;
  }, [cascadingFilters, locationFilter, dateFilter, columnFilters]);

  const complianceLabels = useMemo(() => {
    const defaultLabels = { yes: "Yes", no: "No", na: "N/A" };
    const labels = { ...defaultLabels };

    // Check if the form has any inspection status based questions
    let hasInspectionQuestions = false;

    // Check form title for inspection keywords
    if (
      form?.title?.toLowerCase().includes("inspection") ||
      form?.title?.toLowerCase().includes("chassis") ||
      form?.title?.toLowerCase().includes("pdi") ||
      form?.title?.toLowerCase().includes("rework") ||
      form?.title?.toLowerCase().includes("accepted") ||
      form?.title?.toLowerCase().includes("rejected") ||
      form?.title?.toLowerCase().includes("verified")
    ) {
      hasInspectionQuestions = true;
    }

    if (!hasInspectionQuestions && form?.sections) {
      for (const section of form.sections) {
        // Check section title
        const sectionTitle = section.title?.toLowerCase() || "";
        if (
          sectionTitle.includes("inspection") ||
          sectionTitle.includes("chassis") ||
          sectionTitle.includes("rework") ||
          sectionTitle.includes("accepted") ||
          sectionTitle.includes("rejected") ||
          sectionTitle.includes("verified")
        ) {
          hasInspectionQuestions = true;
          break;
        }

        if (section.questions) {
          for (const question of section.questions) {
            // Check for ChassisWithZone or similar that might not have a specific type but we handle as status objects
            if (
              question.type === "chassisWithZone" ||
              question.type === "chassisWithoutZone" ||
              question.type === "chassis" ||
              question.type === "zone-in" ||
              question.type === "zone-out" ||
              question.text?.toLowerCase().includes("chassis") ||
              question.text?.toLowerCase().includes("inspection") ||
              question.text?.toLowerCase().includes("accepted") ||
              question.text?.toLowerCase().includes("rework") ||
              question.options?.some((opt) => {
                const o = String(opt).toLowerCase();
                return (
                  o.includes("accepted") ||
                  o.includes("rejected") ||
                  o.includes("rework") ||
                  o.includes("re-rework")
                );
              })
            ) {
              hasInspectionQuestions = true;
              break;
            }
          }
        }
        if (hasInspectionQuestions) break;
      }
    }

    if (hasInspectionQuestions) {
      return { yes: "Accepted", no: "Rejected", na: "Rework" };
    }

    // Check if the responses contain any inspection status objects
    if (!hasInspectionQuestions && responses && responses.length > 0) {
      for (const response of responses) {
        if (response.answers) {
          for (const answer of Object.values(response.answers)) {
            if (
              typeof answer === "object" &&
              answer !== null &&
              (answer as any).status
            ) {
              const status = String((answer as any).status)
                .toLowerCase()
                .trim();
              if (
                [
                  "accepted",
                  "rejected",
                  "rework",
                  "reworked",
                  "verified",
                  "rework completed",
                ].includes(status) ||
                status.includes("re-rework")
              ) {
                hasInspectionQuestions = true;
                break;
              }
            }
          }
        }
        if (hasInspectionQuestions) break;
      }
    }

    if (hasInspectionQuestions) {
      return { yes: "Accepted", no: "Rejected", na: "Rework" };
    }

    if (form?.sections) {
      for (const section of form.sections) {
        if (section.questions) {
          for (const question of section.questions) {
            if (
              question.type === "yesNoNA" &&
              question.options &&
              question.options.length >= 2
            ) {
              const hasCustomLabels =
                question.options[0] !== "Yes" ||
                question.options[1] !== "No" ||
                (question.options[2] && question.options[2] !== "N/A");

              if (hasCustomLabels) {
                return {
                  yes: question.options[0] || "Yes",
                  no: question.options[1] || "No",
                  na: question.options[2] || "N/A",
                };
              }

              if (labels.yes === "Yes") {
                labels.yes = question.options[0] || "Yes";
                labels.no = question.options[1] || "No";
                labels.na = question.options[2] || "N/A";
              }
            }
          }
        }
      }
    }
    return labels;
  }, [form, responses]);

  // Was an auto-firing useEffect keyed on [user, id]; now a plain function
  // invoked lazily the first time the Dashboard tab is opened (see the
  // tab-loading effects below), so it no longer fires on mount regardless
  // of which tab the user lands on.
  const fetchSummary = async () => {
    if (!user) return;
    setSummaryLoading(true);
    try {
      let url = "/analytics/inspector-summary";
      if (id) {
        url += `?formId=${id}`;
      }

      const hierarchyPromise = apiClient.getCachedData<any>("/users/hierarchy?role=Inspector")
        ? Promise.resolve(apiClient.getCachedData<any>("/users/hierarchy?role=Inspector"))
        : apiClient.getUsersHierarchy({ role: "Inspector" }).then(res => {
          return res;
        }).catch(() => ({ users: [] }));

      const [summaryRes, hierarchyRes] = await Promise.all([
        apiClient.get<any>(url),
        hierarchyPromise,
      ]);

      if (summaryRes.data) {
        setInspectorSummary(summaryRes.data.summary || []);
        setSummaryStatuses(summaryRes.data.allStatuses || []);
      }

      if (hierarchyRes?.users) {
        setAllInspectors(hierarchyRes.users);
      }
    } catch (error) {
      console.error("Error fetching inspector data:", error);
    } finally {
      setSummaryLoading(false);
    }
  };

  const filteredInspectorSummary = useMemo(() => {
    let result = [...inspectorSummary];

    if (dateFilter.startDate || dateFilter.endDate) {
      result = result.filter((item) => {
        if (!item.date) return true;
        try {
          const itemDate = toLocalDateString(item.date);
          if (!itemDate) return true;
          if (dateFilter.startDate && dateFilter.endDate) {
            return (
              itemDate >= dateFilter.startDate && itemDate <= dateFilter.endDate
            );
          } else if (dateFilter.startDate) {
            return itemDate >= dateFilter.startDate;
          } else if (dateFilter.endDate) {
            return itemDate <= dateFilter.endDate;
          }
        } catch (e) {
          return true;
        }
        return true;
      });
    }

    if (selectedInspectorForTrend !== "Overall") {
      result = result.filter(
        (item) =>
          item.qcInspector === selectedInspectorForTrend ||
          item.submittedBy === selectedInspectorForTrend,
      );
    }

    return result;
  }, [
    inspectorSummary,
    dateFilter.startDate,
    dateFilter.endDate,
    selectedInspectorForTrend,
  ]);

  const groupedInspectorSummary = useMemo(() => {
    const groups: Record<string, any> = {};
    filteredInspectorSummary.forEach((item) => {
      const title = item.formTitle || "N/A";
      if (!groups[title]) {
        groups[title] = {
          formTitle: title,
          tenantName: item.tenantName,
          totalInspection: 0,
          statusCounts: {},
          subItems: [],
        };
      }
      groups[title].totalInspection += item.totalInspection;
      Object.entries(item.statusCounts || {}).forEach(([status, count]) => {
        groups[title].statusCounts[status] =
          (groups[title].statusCounts[status] || 0) + (count as number);
      });
      groups[title].subItems.push(item);
    });
    return Object.values(groups);
  }, [filteredInspectorSummary]);





  const fetchData = async () => {
    console.log(
      "[ANALYTICS] fetchData called with ID:",
      id,
      "isGuest:",
      isGuest,
    );
    if (!id) return;

    // Guest access check
    if (isGuest) {
      const guestToken = localStorage.getItem("guest_auth_token");
      const guestFormId = localStorage.getItem("guest_form_id");
      const guestExpiresAt = localStorage.getItem("guest_expires_at");

      const isExpired = guestExpiresAt
        ? new Date() > new Date(guestExpiresAt)
        : true;

      if (!guestToken || guestFormId !== id || isExpired) {
        localStorage.removeItem("guest_auth_token");
        localStorage.removeItem("guest_email");
        localStorage.removeItem("guest_form_id");
        localStorage.removeItem("guest_expires_at");
        navigate(`/forms/${id}/analytics/login`);
        return;
      }
    }

    try {
      setLoading(true);
      setError(null); // Clear any previous errors

      const formCacheKey = `/forms/${id}`;
      console.log("[ANALYTICS DEBUG] Fetching form details:", id);

      // Fetch form details
      const formData = await apiClient.request<{ form: any }>(formCacheKey, {
        forceNetwork: true,
        timeout: 60000, // 60 seconds for form data
      });

      if (formData && formData.form) {
        setForm(formData.form);
        console.log("[ANALYTICS DEBUG] Form fetched:", formData.form?.title);

        if (formData.form?.sections && formData.form.sections.length > 0) {
          setSelectedResponsesSectionIds(
            formData.form.sections.map((s: Section) => s.id),
          );
        }
      }

      // Reset retry count on success
      setRetryCount(0);

    } catch (err) {
      console.error("Error fetching analytics data:", err);

      // Better error messaging for timeouts
      let errorMessage = "Failed to load analytics";
      if (err instanceof Error) {
        if (err.message?.includes('timeout') || err.name === 'AbortError') {
          errorMessage = 'The data is taking too long to load. This might be due to a large dataset or server load. Please try again.';
        } else {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    // SWR: Check if we have recent analytics data for this form to display instantly
    const cached = formAnalyticsMemoryCache.get(id);
    if (cached && Date.now() - cached.timestamp < 180000) {
      setForm(cached.form);
      setResponses(cached.responses);
      setTableResponses(cached.tableResponses);
      setLoading(false);
      setAnalyticsResponsesLoading(false);
      if (cached.form?.sections && cached.form.sections.length > 0) {
        setSelectedResponsesSectionIds(
          cached.form.sections.map((s: Section) => s.id),
        );
      }
      // Revalidate in background
      fetchData();
    } else {
      // Reset all form-specific state when switching to a non-cached form
      setForm(null);
      setResponses([]);
      setTableResponses([]);
      setTvsReviews([]);
      setLoadedTabs(new Set());
      setPerformanceTableData([]);
      setInspectorSummary([]);
      fetchedBulkReviewsKeyRef.current = "";
      fetchData();
    }
  }, [id]);

  // Update memory cache whenever form data or responses finish loading
  useEffect(() => {
    if (id && form) {
      formAnalyticsMemoryCache.set(id, {
        form,
        responses,
        tableResponses,
        timestamp: Date.now(),
      });
    }
  }, [id, form, responses, tableResponses]);

  // ── Lazy loading by tab ──────────────────────────────────────────────
  // Fetches the FULL analytics response set (used by Dashboard/Question/
  // Section/Overall for charts, status calc, exports, BIW review, etc).
  // The backend now paginates analytics requests (500 rows/page) instead
  // of returning a form's entire history in one unbounded query, and this
  // streams each page into `responses` as it lands via onPage - so on a
  // large form, the Status column and charts start filling in after the
  // first page (a couple seconds) instead of everything staying blank/
  // "Loading…" until the last page of a multi-minute single request.
  //
  // Note: responseStatuses groups responses by tracked item (e.g. chassis
  // number) to compute sequential rework status, which needs every page
  // to be in for a group to be 100% correct - so a row's status can
  // shift slightly as later pages arrive if its sibling responses land in
  // a subsequent page. It settles once analyticsResponsesLoading goes
  // false. This is still strictly better than the old all-or-nothing
  // wait, and most forms will have all of an item's responses within the
  // same page anyway since pages are sorted by createdAt.
  const fetchFullAnalyticsResponses = async () => {
    if (!id) return;
    setAnalyticsResponsesLoading(true);
    let accumulator: any[] = [];
    try {
      const responsesData = await apiClient.getAllFormResponses(id, {
        analytics: true,
        forceNetwork: true,
        onPage: ({ responses: pageResponses, pageNumber, totalPages, totalResponses, isLast }: {
          responses: any[];
          pageNumber: number;
          totalPages: number;
          totalResponses?: number;
          isLast: boolean;
        }) => {
          accumulator = accumulator.concat(pageResponses);
          setResponses([...accumulator]);
          if (totalResponses && totalResponses > 0) {
            setTotalResponsesCount(totalResponses);
          } else if (accumulator.length > 0) {
            setTotalResponsesCount((prev) => Math.max(prev, accumulator.length));
          }
          if (isLast) {
            setAnalyticsResponsesLoading(false);
          }
        },
      });
      if (responsesData.responses && responsesData.responses.length > 0) {
        setResponses(responsesData.responses);
        setTotalResponsesCount(responsesData.responses.length);
      }
    } catch (err) {
      console.error("Error fetching full analytics responses:", err);
      showToast("Failed to load analytics data. Please try again.", "error");
    } finally {
      setAnalyticsResponsesLoading(false);
    }
  };

  // Fetches a single page of responses directly from the backend for the
  // Responses tab, instead of slicing an already-loaded full dataset in
  // memory. This is the server-side pagination required for large
  // (2000+) response forms.
  const fetchResponsesPage = async (page: number) => {
    if (!id) return;
    setLoadingTable(true);
    try {
      const data = await apiClient.getFormResponses(id, {
        page: page,
        limit: responsesPageSize,
        analytics: false,
        forceNetwork: true,
      });
      setTableResponses(data.responses || []);
      setTotalResponsesCount(data.pagination?.totalResponses || 0);
    } catch (err) {
      console.error("Error fetching responses page:", err);
      showToast("Failed to load responses. Please try again.", "error");
    } finally {
      setLoadingTable(false);
    }
  };

  // Keep activeTab in sync with analyticsView (existing tab buttons already
  // set analyticsView; this propagates that choice into the lazy-loading
  // tab tracker below without needing to touch every button's onClick).
  useEffect(() => {
    const knownTabs = ["dashboard", "responses"] as const;
    const tab = (knownTabs as readonly string[]).includes(analyticsView)
      ? (analyticsView as typeof activeTab)
      : "dashboard";
    setActiveTab(tab);
  }, [analyticsView]);

  // Dashboard tab: inspector summary + performance table + the full
  // analytics response set, loaded once, the first time this tab is shown.
  useEffect(() => {
    if (activeTab === "dashboard" && !loadedTabs.has("dashboard") && id) {
      fetchSummary();
      fetchPerformanceTable();
      fetchFullAnalyticsResponses();
      setLoadedTabs((prev) => new Set(prev).add("dashboard"));
    }
  }, [activeTab, id, loadedTabs]);

  // Question / Section / Overall tabs also derive their charts and stats
  // from the full `responses` array. If the user lands directly on one of
  // these without visiting Dashboard first, load the full set once here.


  // Responses tab: server-side paginated fetch for the table rows, loaded
  // once on first visit. The Status column, however, is computed from the
  // separate full-dataset `responses` array (see responseStatuses above) -
  // if the user lands here directly (skipping Dashboard/Question/Section/
  // Overall), that full set was never requested and the Status column
  // would spin on "Loading…" forever. Kick it off here too, the same way
  // the other tabs already do.
  useEffect(() => {
    if (activeTab === "responses" && !loadedTabs.has("responses") && id) {
      fetchResponsesPage(1);
      if (!loadedTabs.has("dashboard") && (responses.length === 0 || (totalResponsesCount > 0 && responses.length < totalResponsesCount))) {
        fetchFullAnalyticsResponses();
      }
      setLoadedTabs((prev) => new Set(prev).add("responses"));
    }
  }, [activeTab, id, loadedTabs, responses.length, totalResponsesCount]);

  // Page / page-size changes on an already-loaded Responses tab re-fetch
  // from the server instead of re-slicing an in-memory array.
  useEffect(() => {
    if (activeTab === "responses" && loadedTabs.has("responses")) {
      fetchResponsesPage(responsesPage);
    }
  }, [responsesPage, responsesPageSize, activeTab]);

  const handleRetry = async () => {
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
    try {
      await fetchData();
      // fetchData only re-fetches the form now; also re-fetch whatever
      // data source the currently active tab depends on.
      if (activeTab === "responses") {
        await fetchResponsesPage(responsesPage);
      } else {
        await fetchFullAnalyticsResponses();
        if (activeTab === "dashboard") {
          await fetchPerformanceTable();
          await fetchSummary();
        }
      }
    } catch (error) {
      console.error("Retry failed:", error);
    } finally {
      setIsRetrying(false);
    }
  };
  // Add this useEffect to update selectedQuestion


  const availableLocations = useMemo(() => {
    const locations = new Set<string>();
    responses.forEach((r) => {
      const meta = r.submissionMetadata?.location;
      if (meta) {
        const city = meta.city || "";
        const country = meta.country || "";
        const locationStr =
          city && country ? `${city}, ${country}` : country || "Unknown";
        if (locationStr !== "Unknown") {
          locations.add(locationStr);
        }
      }
    });
    return Array.from(locations).sort();
  }, [responses]);

  const quizQuestions = useMemo(() => {
    if (!form?.sections) return [];
    const allQs: any[] = [];
    form.sections.forEach((section) => {
      if (section.questions) {
        section.questions.forEach((q) => {
          if (q.correctAnswer !== undefined) {
            allQs.push(q);
          }
          if (q.followUpQuestions) {
            q.followUpQuestions.forEach((fq) => {
              if (fq.correctAnswer !== undefined) {
                allQs.push(fq);
              }
            });
          }
        });
      }
    });
    return allQs;
  }, [form]);

  const calculateScores = (response: Response) => {
    let correct = 0;
    let wrong = 0;

    quizQuestions.forEach((q) => {
      const answer = response.answers?.[q.id];
      if (answer !== undefined && answer !== null && answer !== "") {
        const answerStr = Array.isArray(answer)
          ? answer.join(", ").toLowerCase()
          : String(answer).toLowerCase();
        const correctStr = Array.isArray(q.correctAnswer)
          ? q.correctAnswer.join(", ").toLowerCase()
          : String(q.correctAnswer).toLowerCase();

        if (answerStr === correctStr) {
          correct++;
        } else {
          wrong++;
        }
      }
    });

    return { correct, wrong };
  };
  const extractAnswerValues = (answer: any): string[] => {
    if (answer === null || answer === undefined) return [""];

    // Handle objects with status/chassis properties
    if (typeof answer === "object" && !Array.isArray(answer)) {
      const values: string[] = [];
      if (answer.status && typeof answer.status === "string" && answer.status.trim()) {
        values.push(answer.status.trim());
      }
      if (answer.chassisNumber && typeof answer.chassisNumber === "string" && answer.chassisNumber.trim()) {
        values.push(answer.chassisNumber.trim());
      }
      if (answer.prefix && typeof answer.prefix === "string" && answer.prefix.trim()) {
        values.push(answer.prefix.trim());
      }
      if (answer.serialNumber && typeof answer.serialNumber === "string" && answer.serialNumber.trim()) {
        values.push(answer.serialNumber.trim());
      }
      if (answer.partDescription && typeof answer.partDescription === "string" && answer.partDescription.trim()) {
        values.push(answer.partDescription.trim());
      }
      if (answer.zone && typeof answer.zone === "string" && answer.zone.trim()) {
        values.push(answer.zone.trim());
      }
      if (answer.value && typeof answer.value === "string" && answer.value.trim()) {
        values.push(answer.value.trim());
      }
      if (answer.label && typeof answer.label === "string" && answer.label.trim()) {
        values.push(answer.label.trim());
      }
      if (answer.name && typeof answer.name === "string" && answer.name.trim()) {
        values.push(answer.name.trim());
      }
      if (answer.prefix && answer.chassisNumber) {
        values.push(`${answer.prefix}${answer.chassisNumber}`);
      }
      const displayVal = getChassisDisplayValue(answer);
      if (displayVal && displayVal !== "-" && !values.includes(displayVal)) {
        values.push(displayVal);
      }

      // Fallback: if no specific fields found, use JSON string
      if (values.length === 0) {
        const str = JSON.stringify(answer);
        if (str && str !== "{}") values.push(str);
      }
      return values.length > 0 ? values : [""];
    }

    // Handle arrays
    if (Array.isArray(answer)) {
      if (answer.length === 0) return [""];
      return answer.map(item => {
        if (!item) return "";
        if (typeof item === "object") {
          return String(item.name || item.status || item.chassisNumber || JSON.stringify(item));
        }
        return String(item).trim();
      }).filter(v => typeof v === "string" && v.length > 0);
    }

    // Handle primitives
    const strValue = String(answer).trim();
    return strValue ? [strValue] : [""];
  };

  const baseFilteredResponses = useMemo(() => {
    let result = responses;

    // 0. Role-based Filter (LIFTED: Inspectors can now view and review other tenant/user responses)

    // 2. Location Filter
    if (locationFilter.length > 0) {
      result = result.filter((response) => {
        const meta = response.submissionMetadata?.location;
        if (!meta) return false;
        const city = meta.city || "";
        const country = meta.country || "";
        const locationStr =
          city && country ? `${city}, ${country}` : country || "Unknown";
        return locationFilter.includes(locationStr);
      });
    }

    // 3. Cascading Question Filters
    const cascadingFiltersArray = Object.entries(cascadingFilters).filter(
      ([_, answers]) => answers.length > 0,
    );

    if (cascadingFiltersArray.length > 0) {
      result = result.filter((response) => {
        return cascadingFiltersArray.every(([questionId, selectedAnswers]) => {
          const answer = response.answers?.[questionId];
          if (answer === null || answer === undefined) return false;

          // Use extractAnswerValues to handle all answer types consistently
          const answerValues = extractAnswerValues(answer);
          return answerValues.some(v => selectedAnswers.includes(v));
        });
      });
    }

    // 4. Column Filters (skip __attemptRank here – resolved in filteredResponses to avoid TDZ on chassisAttemptRanks/tableDisplayStatuses/responseStatuses)
    const activeColumnFilters = Object.entries(columnFilters).filter(
      ([_, values]) => values && values.length > 0,
    );

    if (activeColumnFilters.length > 0) {
      result = result.filter((response) => {
        return activeColumnFilters.every(([columnId, allowedValues]) => {
          if (!allowedValues || allowedValues.length === 0) return true;

          // Skip all virtual/custom table columns (__status, __attemptRank, __submittedBy, etc.)
          // These are resolved in filteredResponses after status and ranking maps are populated
          if (columnId.startsWith("__")) return true;

          const answer = response.answers?.[columnId];
          if (answer === null || answer === undefined) {
            return allowedValues.includes("No Response");
          }
          const answerValues = extractAnswerValues(answer);
          return answerValues.some(v => {
            if (!v) return false;
            const vLower = v.toLowerCase();
            return allowedValues.some(av => {
              if (!av) return false;
              const avLower = av.toLowerCase();
              return vLower === avLower || vLower.includes(avLower) || avLower.includes(vLower);
            });
          });
        });
      });
    }

    return result;
  }, [responses, user, locationFilter, cascadingFilters, columnFilters]);

  // Primary chassis question ID is already resolved at top (chassisQuestionId)

  // Robust helper to extract a normalized chassis / vehicle / item identifier from any response
  const getChassisOrItemId = useCallback((r: any, trackingQId: string | null): string => {
    if (!r) return "unknown";

    // 1. Explicit tracking question answer
    if (trackingQId && r.answers && r.answers[trackingQId] !== undefined && r.answers[trackingQId] !== null && r.answers[trackingQId] !== "") {
      const ans = r.answers[trackingQId];
      if (typeof ans === "object") {
        const candidate = ans.chassisNumber || ans.value || ans.label;
        if (candidate) {
          const val = String(candidate).trim();
          if (val && val !== "No response" && val !== "-" && !val.startsWith("data:image")) return val.toLowerCase();
        }
      } else {
        const val = String(ans).trim();
        if (val && val !== "No response" && val !== "-" && !val.startsWith("data:image") && !val.startsWith("{")) return val.toLowerCase();
      }
    }

    // 2. Direct chassis/id properties
    if (r.chassisNumber && typeof r.chassisNumber === "string" && r.chassisNumber.trim() !== "" && r.chassisNumber !== "-" && r.chassisNumber !== "N/A") {
      return r.chassisNumber.trim().toLowerCase();
    }

    // 3. Known answers key variants
    if (r.answers) {
      const directKeys = [
        "chassis_number", "chassisNumber", "chassis", "Chassis", "CHASSIS",
        "id_number", "idNumber", "ID NUMBER", "ID Number", "Id Number", "id_no", "ID No", "ID NO",
        "Chassis / VIN", "Chassis Number", "VIN", "vin", "Serial Number", "serialNumber"
      ];
      for (const k of directKeys) {
        if (r.answers[k] !== undefined && r.answers[k] !== null && r.answers[k] !== "") {
          const v = r.answers[k];
          if (typeof v === "object") {
            const candidate = v.chassisNumber || v.value || v.label;
            if (candidate) {
              const val = String(candidate).trim();
              if (val && val !== "No response" && val !== "-" && !val.startsWith("data:image")) return val.toLowerCase();
            }
          } else {
            const val = String(v).trim();
            if (val && val !== "No response" && val !== "-" && !val.startsWith("data:image") && !val.startsWith("{")) return val.toLowerCase();
          }
        }
      }
    }

    // 4. Scan form questions for any chassis/ID/VIN/tracking question
    if (form?.sections && r.answers) {
      for (const section of form.sections) {
        if (section.questions) {
          for (const q of section.questions) {
            if (q.type === "zone-in" || q.type === "zone-out") continue;
            const t = (q.text || "").toLowerCase();
            const isTrackOrId =
              q.trackResponseRank === true || q.trackResponseRank === "true" ||
              q.type === "chassis" || q.type === "chassisWithZone" || q.type === "chassisWithoutZone" ||
              t.includes("chassis") || t.includes("id number") || t.includes("id_number") || t.includes("id no") || t.includes("vin") || t.includes("serial");

            if (isTrackOrId && r.answers[q.id] !== undefined && r.answers[q.id] !== null && r.answers[q.id] !== "") {
              const ans = r.answers[q.id];
              if (typeof ans === "object") {
                const candidate = ans.chassisNumber || ans.value || ans.label;
                if (candidate) {
                  const val = String(candidate).trim();
                  if (val && val !== "No response" && val !== "-" && !val.startsWith("data:image")) return val.toLowerCase();
                }
              } else {
                const val = String(ans).trim();
                if (val && val !== "No response" && val !== "-" && !val.startsWith("data:image") && !val.startsWith("{")) {
                  return val.toLowerCase();
                }
              }
            }
          }
        }
      }
    }

    // 5. Scan any answer whose key name suggests an ID or chassis
    if (r.answers) {
      for (const [key, val] of Object.entries(r.answers)) {
        if (!val || typeof val === "object" || (typeof val !== "string" && typeof val !== "number")) continue;
        const strVal = String(val).trim();
        if (!strVal || strVal === "No response" || strVal === "-" || strVal.startsWith("data:image") || strVal.length > 60) continue;
        const kLower = key.toLowerCase();
        if (kLower.includes("chassis") || kLower.includes("id") || kLower.includes("vin") || kLower.includes("serial")) {
          return strVal.toLowerCase();
        }
      }
    }

    const fallbackId = r.id || r._id || "unknown";
    return `untracked-${fallbackId}`;
  }, [form]);

  // Fast, single-response status estimate — used ONLY by the Responses tab
  // table so the Status column can render as soon as `tableResponses` (the
  // paginated 20-row fetch) lands, instead of waiting on the full-dataset
  // `responseStatuses` below (which requires every page of
  // fetchFullAnalyticsResponses to stream in on large forms).
  //
  // It leans on `responseRanks`, which the backend already computes and
  // persists on the response document at submission time (a count of prior
  // submissions for the same tracked item, e.g. chassis number) — see
  // responseController.js. Because that count is already stored per-row,
  // this needs no sibling responses at all, just the row itself.
  //
  // Trade-off: in the rare case an item was rejected/skipped outright
  // without ever being flagged "rework" partway through its history, the
  // "Rework N" number here can be off by one from the fully-accurate
  // group-computed value below. That's why `tableDisplayStatuses` (below)
  // prefers the accurate `responseStatuses` value the instant it's
  // available, and only falls back to this estimate until then — so the
  // table starts correct-ish immediately and self-corrects a moment later,
  // the same "settles once loading finishes" behavior already documented
  // for the full-set streaming case above.
  const computeFastRowStatus = (r: Response, trackingQId: string | null) => {
    let isRework = false;
    let isAccepted = false;
    let isRejected = false;

    if (r.answers) {
      Object.values(r.answers).forEach((ans) => {
        if (typeof ans === "object" && ans !== null && (ans as any).status) {
          const s = String((ans as any).status).toLowerCase().trim();
          if (s === "rework" || s === "reworked" || s.includes("re-rework")) {
            isRework = true;
          } else if (
            s === "accepted" ||
            s === "rework completed" ||
            s === "verified" ||
            s === "yes" ||
            s === "y"
          ) {
            isAccepted = true;
          } else if (s === "rejected" || s === "no" || s === "n") {
            isRejected = true;
          }
        } else if (typeof ans === "string") {
          const s = ans.toLowerCase().trim();
          if (s === "rework" || s === "reworked" || s.includes("re-rework")) {
            isRework = true;
          } else if (
            s === "accepted" ||
            s === "rework completed" ||
            s === "verified" ||
            s === "yes" ||
            s === "y"
          ) {
            isAccepted = true;
          } else if (s === "rejected" || s === "no" || s === "n") {
            isRejected = true;
          }
        }
      });
    }

    const rank = trackingQId ? r.responseRanks?.[trackingQId] : null;
    const biwStatus = r.biwReview?.status;
    const rawStatus = (r.status || "").trim();

    // 1. BIW Review decision takes primary precedence
    if (biwStatus === "Rejected") return "Rejected";
    if (biwStatus === "Accepted") {
      if (isRework || (rank && rank > 1) || rawStatus.toLowerCase().includes("rework")) {
        return "Rework Accepted";
      }
      return "Direct Ok";
    }
    if (biwStatus === "Reworked") {
      if (trackingQId && rank && rank > 1) return `Rework ${rank - 1}`;
      if (trackingQId) return "Rework 1";
      return "Rework";
    }

    // 2. Explicit response status check
    if (rawStatus === "Rejected") return "Rejected";
    if (rawStatus === "Rework Accepted" || rawStatus === "Rework Completed") return "Rework Accepted";
    if (rawStatus === "Direct Ok") return "Direct Ok";
    if (rawStatus === "Accepted") {
      if (isRework || (rank && rank > 1)) return "Rework Accepted";
      return "Direct Ok";
    }
    if (rawStatus.startsWith("Rework")) return rawStatus;

    // 3. Fallback based on answers and chronological attempt rank
    if (isRejected) return "Rejected";
    if (isRework) {
      if (trackingQId && rank && rank > 1) return `Rework ${rank - 1}`;
      if (trackingQId) return "Rework 1";
      return "Rework";
    }
    if (isAccepted) {
      if (!trackingQId || rank === 1) return "Direct Ok";
      if (rank && rank > 1) return "Rework Accepted";
      return "Accepted";
    }
    return (rank && rank > 1) ? "Rework Accepted" : "Direct Ok";
  };

  // Calculate sequential status (Direct Ok, Rework 1, Rework 2, etc.)
  const responseStatuses = useMemo(() => {
    if (!baseFilteredResponses.length) {
      return {};
    }

    // Group responses by unique item (e.g., chassis number)
    const itemGroups: Record<string, Response[]> = {};

    // Sort responses by timestamp ascending to determine sequential order
    const sortedResponses = [...baseFilteredResponses].sort((a, b) => {
      const tA = new Date(getResponseTimestamp(a) || 0).getTime();
      const tB = new Date(getResponseTimestamp(b) || 0).getTime();
      return tA - tB;
    });

    sortedResponses.forEach((r) => {
      const itemId = getChassisOrItemId(r, chassisQuestionId);

      if (!itemGroups[itemId]) {
        itemGroups[itemId] = [];
      }
      itemGroups[itemId].push(r);
    });

    const statuses: Record<string, string> = {};

    Object.entries(itemGroups).forEach(([groupId, group]) => {
      let reworkCount = 0;
      let hasBeenReworked = false;

      group.forEach((r, index) => {
        let isRework = false;
        let isAccepted = false;
        let isRejected = false;

        // Check individual answers for inspection status
        if (r.answers) {
          Object.values(r.answers).forEach((ans) => {
            if (
              typeof ans === "object" &&
              ans !== null &&
              (ans as any).status
            ) {
              const s = String((ans as any).status)
                .toLowerCase()
                .trim();
              if (
                s === "rework" ||
                s === "reworked" ||
                s.includes("re-rework")
              ) {
                isRework = true;
              } else if (
                s === "accepted" ||
                s === "rework completed" ||
                s === "verified" ||
                s === "yes" ||
                s === "y"
              ) {
                isAccepted = true;
              } else if (s === "rejected" || s === "no" || s === "n") {
                isRejected = true;
              }
            } else if (typeof ans === "string") {
              const s = ans.toLowerCase().trim();
              if (
                s === "rework" ||
                s === "reworked" ||
                s.includes("re-rework")
              ) {
                isRework = true;
              } else if (
                s === "accepted" ||
                s === "rework completed" ||
                s === "verified" ||
                s === "yes" ||
                s === "y"
              ) {
                isAccepted = true;
              } else if (s === "rejected" || s === "no" || s === "n") {
                isRejected = true;
              }
            }
          });
        }

        const rank = (chassisQuestionId && r.responseRanks?.[chassisQuestionId]) || (index + 1);
        const biwStatus = r.biwReview?.status;
        const rawStatus = (r.status || "").trim();

        let calculatedStatus = (rank && rank > 1) || hasBeenReworked ? "Rework Accepted" : "Direct Ok";

        // 1. BIW Review takes primary precedence
        if (biwStatus === "Rejected") {
          calculatedStatus = "Rejected";
        } else if (biwStatus === "Accepted") {
          if (isRework || hasBeenReworked || (rank && rank > 1) || rawStatus.toLowerCase().includes("rework")) {
            calculatedStatus = "Rework Accepted";
          } else {
            calculatedStatus = "Direct Ok";
          }
        } else if (biwStatus === "Reworked") {
          if (!groupId.startsWith("untracked-")) {
            reworkCount++;
            hasBeenReworked = true;
            calculatedStatus = `Rework ${reworkCount}`;
          } else {
            calculatedStatus = "Rework 1";
          }
        } else if (rawStatus === "Rejected") {
          calculatedStatus = "Rejected";
        } else if (rawStatus === "Rework Accepted" || rawStatus === "Rework Completed") {
          calculatedStatus = "Rework Accepted";
        } else if (rawStatus === "Direct Ok") {
          calculatedStatus = "Direct Ok";
        } else if (rawStatus === "Accepted") {
          if (isRework || hasBeenReworked || (rank && rank > 1)) {
            calculatedStatus = "Rework Accepted";
          } else {
            calculatedStatus = "Direct Ok";
          }
        } else if (rawStatus.startsWith("Rework")) {
          hasBeenReworked = true;
          calculatedStatus = rawStatus;
        } else if (isRejected) {
          calculatedStatus = "Rejected";
        } else if (isRework) {
          if (!groupId.startsWith("untracked-")) {
            reworkCount++;
            hasBeenReworked = true;
            calculatedStatus = `Rework ${reworkCount}`;
          } else {
            calculatedStatus = "Rework 1";
          }
        } else if (isAccepted) {
          if (rank === 1 || (index === 0 && !hasBeenReworked)) {
            calculatedStatus = "Direct Ok";
          } else if ((rank && rank > 1) || hasBeenReworked) {
            calculatedStatus = "Rework Accepted";
          } else {
            calculatedStatus = "Direct Ok";
          }
        }

        if (r.id) statuses[r.id] = calculatedStatus;
        if ((r as any)._id) statuses[(r as any)._id] = calculatedStatus;
      });
    });

    return statuses;
  }, [baseFilteredResponses, chassisQuestionId, getChassisOrItemId]);

  // Status for the Responses tab table only: instant estimate from each
  // row's own persisted rank (computeFastRowStatus, defined above), upgraded
  // to the fully-accurate group-computed value from `responseStatuses` the
  // moment that's ready. Depends only on `tableResponses` (the fast
  // paginated 20-row fetch), so it's available immediately instead of
  // waiting on the full analytics response set.
  const tableDisplayStatuses = useMemo(() => {
    const map: Record<string, string> = {};
    const dataset = responses.length > 0 ? responses : tableResponses;
    dataset.forEach((r) => {
      const respId = r.id || (r as any)._id;
      const status =
        responseStatuses[r.id] ||
        responseStatuses[(r as any)._id] ||
        (respId ? responseStatuses[respId] : null) ||
        computeFastRowStatus(r, chassisQuestionId) ||
        (r.status && r.status !== "pending" ? r.status : "Direct Ok");
      if (r.id) map[r.id] = status;
      if ((r as any)._id) map[(r as any)._id] = status;
      if (respId) map[respId] = status;
    });
    return map;
  }, [tableResponses, responses, responseStatuses, chassisQuestionId]);

  // Chronological attempt rank per chassis (1st inspection = 1, 2nd inspection = 2, etc.)
  const chassisAttemptRanks = useMemo(() => {
    const ranks: Record<string, number> = {};
    const dataset = responses.length > 0 ? responses : tableResponses;
    if (!dataset.length) return ranks;

    // Group responses by unique chassis/item
    const itemGroups: Record<string, typeof dataset> = {};

    // Sort ascending by timestamp (oldest first)
    const sorted = [...dataset].sort((a, b) => {
      const tA = new Date(getResponseTimestamp(a) || 0).getTime();
      const tB = new Date(getResponseTimestamp(b) || 0).getTime();
      return tA - tB;
    });

    sorted.forEach((r) => {
      const itemId = getChassisOrItemId(r, chassisQuestionId);

      if (!itemGroups[itemId]) {
        itemGroups[itemId] = [];
      }
      
      // Keep only previous responses that are within 10 days of the current response
      const rTime = new Date(getResponseTimestamp(r) || 0).getTime();
      const tenDaysMs = 10 * 24 * 60 * 60 * 1000;
      itemGroups[itemId] = itemGroups[itemId].filter(prevR => {
        const prevTime = new Date(getResponseTimestamp(prevR) || 0).getTime();
        return (rTime - prevTime) <= tenDaysMs;
      });

      itemGroups[itemId].push(r);
      const attemptNumber = itemGroups[itemId].length;
      const persistedRank = (chassisQuestionId && r.responseRanks?.[chassisQuestionId]) || (r.responseRanks && typeof r.responseRanks === 'object' ? Object.values(r.responseRanks).find((v: any) => typeof v === 'number' && v > 0) : null);
      const finalRank = (typeof persistedRank === 'number' && persistedRank > 0) ? persistedRank : attemptNumber;
      if (r.id) ranks[r.id] = finalRank;
      if ((r as any)._id) ranks[(r as any)._id] = finalRank;
    });

    return ranks;
  }, [responses, tableResponses, chassisQuestionId, getChassisOrItemId]);

  // Set of chassis / items that have achieved Rework Accepted in any attempt
  const resolvedReworkChassisSet = useMemo(() => {
    const resolved = new Set<string>();
    const dataset = responses.length > 0 ? responses : tableResponses;
    dataset.forEach((r) => {
      const respId = r.id || (r as any)._id;
      const statusVal =
        tableDisplayStatuses[r.id] ||
        tableDisplayStatuses[(r as any)._id] ||
        responseStatuses[r.id] ||
        responseStatuses[(r as any)._id] ||
        (respId ? tableDisplayStatuses[respId] || responseStatuses[respId] : null) ||
        computeFastRowStatus(r, chassisQuestionId) ||
        r.status ||
        "";
      const rawStatus = String(statusVal).trim().toLowerCase();
      if (rawStatus === "rework accepted" || rawStatus === "rework completed") {
        const itemId = getChassisOrItemId(r, chassisQuestionId);
        if (itemId && itemId !== "none" && itemId !== "-") {
          resolved.add(itemId.toLowerCase().trim());
        }
      }
    });
    return resolved;
  }, [responses, tableResponses, tableDisplayStatuses, responseStatuses, chassisQuestionId, getChassisOrItemId]);

  // Distinct filter options for Time Taken attempt rank & status color
  const attemptRankFilterOptions = useMemo(() => {
    const opts = new Set<string>();
    const dataset = responses.length > 0 ? responses : tableResponses;
    dataset.forEach((r) => {
      const respId = r.id || (r as any)._id;
      const rowStatus = tableDisplayStatuses[respId] || responseStatuses[respId] || "Direct Ok";
      const rank = chassisAttemptRanks[respId] || 1;
      
      let label = `Attempt ${rank} (Green - Accepted)`;
      if (rowStatus === "Rejected") {
        label = `Attempt ${rank} (Red - Rejected)`;
      } else if (rowStatus?.includes("Rework") && rowStatus !== "Rework Accepted" && rowStatus !== "Rework Completed") {
        label = `Attempt ${rank} (Yellow - Rework)`;
      } else if (rowStatus === "Direct Ok" || rowStatus === "Rework Accepted" || rowStatus === "Accepted" || rowStatus === "Rework Completed" || rowStatus === "Verified") {
        label = `Attempt ${rank} (Green - Accepted)`;
      }
      opts.add(label);
    });

    if (opts.size === 0) {
      return [
        "Attempt 1 (Green - Accepted)",
        "Attempt 1 (Yellow - Rework)",
        "Attempt 1 (Red - Rejected)"
      ];
    }

    return Array.from(opts).sort((a, b) => String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true }));
  }, [responses, tableResponses, tableDisplayStatuses, responseStatuses, chassisAttemptRanks]);

  // Filter options for Submitted By
  const submittedByFilterOptions = useMemo(() => {
    const opts = new Set<string>();
    const dataset = responses.length > 0 ? responses : tableResponses;
    dataset.forEach((r) => {
      const name = r.submittedBy || (r as any).createdBy?.name || (r as any).createdBy?.email || (typeof (r as any).createdBy === "string" ? (r as any).createdBy : "") || "Anonymous";
      if (name) opts.add(name);
    });
    return Array.from(opts).sort((a, b) => String(a ?? "").localeCompare(String(b ?? "")));
  }, [responses, tableResponses]);

  // Filter options for Status
  const statusFilterOptions = useMemo(() => {
    const opts = new Set<string>();
    [
      "Direct Ok",
      "Accepted",
      "Rework Accepted",
      "Ongoing Rework",
      "Rework",
      "Rejected"
    ].forEach((s) => opts.add(s));

    const dataset = responses.length > 0 ? responses : tableResponses;
    dataset.forEach((r) => {
      const respId = r.id || (r as any)._id;
      const status =
        tableDisplayStatuses[respId] ||
        responseStatuses[respId] ||
        tableDisplayStatuses[r.id] ||
        responseStatuses[r.id] ||
        computeFastRowStatus(r, chassisQuestionId) ||
        r.status;
      const norm = String(status ?? "").toLowerCase().trim();
      if (
        norm &&
        norm !== "-" &&
        norm !== "pending review" &&
        norm !== "pending" &&
        norm !== "undefined" &&
        norm !== "null"
      ) {
        opts.add(status);
      }
    });
    return Array.from(opts).sort((a, b) => String(a ?? "").localeCompare(String(b ?? "")));
  }, [responses, tableResponses, tableDisplayStatuses, responseStatuses, chassisQuestionId]);

  // Filter options for Selected Chassis
  const chassisFilterOptions = useMemo(() => {
    const opts = new Set<string>();
    chassisMasterOptions.forEach((o) => {
      if (o.value) opts.add(o.value);
    });
    const dataset = responses.length > 0 ? responses : tableResponses;
    dataset.forEach((r) => {
      const chassisVal = getResponseChassisValue(r);
      if (chassisVal && chassisVal !== "-" && chassisVal !== "No Chassis") {
        opts.add(chassisVal);
      }
    });
    return Array.from(opts).sort((a, b) => String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true }));
  }, [responses, tableResponses, chassisMasterOptions, getResponseChassisValue]);

  // Filter options for Parent Match
  const parentMatchFilterOptions = useMemo(() => {
    return [
      "✓ Parent Matched",
      "✓ Follow-up Done",
      "⚠ No Parent Match",
      "⏳ Pending Follow-up",
      "✕ Overdue",
      "Main Record"
    ];
  }, []);

  // Filter options for BIW Review
  const biwReviewFilterOptions = useMemo(() => {
    return [
      "Accepted",
      "Rejected",
      "Reworked",
      "No review yet"
    ];
  }, []);

  // Filter options for Dispatch
  const dispatchFilterOptions = useMemo(() => {
    return [
      "Dispatched / Enabled",
      "Pending Dispatch"
    ];
  }, []);

  const fetchChatHistory = async (responseId: string) => {
    try {
      console.log(
        "[ChatModal] Fetching chat history for response:",
        responseId,
      );

      // Fetch messages
      const response = await apiClient.get<any[]>(
        `/messages/response/${responseId}`,
      );
      const messages = Array.isArray(response.data) ? response.data : [];
      setChatMessages(messages);

      // Fetch reviews from API
      try {
        const reviewsResponse =
          await apiClient.getReviewsForResponse(responseId);
        console.log("[ChatModal] Reviews API response:", reviewsResponse);

        if (
          reviewsResponse &&
          reviewsResponse.reviews &&
          reviewsResponse.reviews.length > 0
        ) {
          const latestReview = reviewsResponse.reviews[0];
          console.log("[ChatModal] Latest review from API:", latestReview);

          // Update state from API
          setSelectedReviewOptions((prev) => ({
            ...prev,
            [responseId]: latestReview.option,
          }));

          setReviewedBy((prev) => ({
            ...prev,
            [responseId]: latestReview.reviewer
              ? {
                id: latestReview.reviewer.id,
                name: latestReview.reviewer.name || "Reviewer",
                email: latestReview.reviewer.email || "",
              }
              : null,
          }));

          // Also update chatResponse
          setChatResponse((prev) =>
            prev
              ? {
                ...prev,
                review: latestReview,
              }
              : null,
          );

          console.log("[ChatModal] Review state updated from API");
        } else {
          console.log("[ChatModal] No reviews found");
        }
      } catch (reviewError) {
        console.error("[ChatModal] Error fetching reviews:", reviewError);
      }
    } catch (err) {
      console.error("[ChatModal] Error fetching chat history:", err);
    }
  };
  useEffect(() => {
    if (showChatModal && chatResponse) {
      fetchChatHistory(chatResponse.id);
    }
  }, [showChatModal, chatResponse]);

  // Auto-open chat modal if responseId is in URL
  useEffect(() => {
    const responseId = searchParams.get("responseId");
    if (!responseId) return;
    const response =
      responses.find((r) => r.id === responseId || r._id === responseId) ||
      tableResponses.find((r) => r.id === responseId || r._id === responseId);
    if (response && !showChatModal) {
      setChatResponse(response);
      setShowChatModal(true);
    }
  }, [searchParams, responses, tableResponses, showChatModal]);

  const handleSendMessage = async (messageOverride?: string) => {
    const messageToSend = messageOverride ?? newMessage;
    if (!messageToSend.trim() || !chatResponse) return;

    setIsSendingMessage(true);
    try {
      const questionContexts: any[] = [];
      const selectedQuestionTitles: string[] = [];
      chatFilters.questions.forEach((qid) => {
        form?.sections?.forEach((section) => {
          const q = section.questions?.find((q) => q.id === qid);
          if (q) {
            const rawAnswer = chatResponse.answers?.[qid];
            let filteredAnswer = rawAnswer;

            // Apply category filtering if selections exist
            if (
              rawAnswer &&
              typeof rawAnswer === "object" &&
              rawAnswer.categories &&
              chatFilters.selectedCategories[qid]
            ) {
              const selectedNames = chatFilters.selectedCategories[qid];
              if (selectedNames.length > 0) {
                filteredAnswer = {
                  ...rawAnswer,
                  categories: rawAnswer.categories.filter((cat: any) =>
                    selectedNames.includes(cat.name),
                  ),
                };
              }
            }

            // Parse flat array into structured object for chassis-with-zone questions
            let structuredAnswer = filteredAnswer;
            if (
              q.type === "chassis-with-zone" ||
              q.type === "chassis-without-zone"
            ) {
              // Always use chatFilters.suggestedAnswers for current values (they have the latest changes including uploads)
              const currentValue = chatFilters.suggestedAnswers?.[qid];
              if (currentValue) {
                // Use the suggestedAnswers which has the latest data
                structuredAnswer = {
                  status: currentValue.status || "",
                  chassisNumber: currentValue.chassisNumber || "",
                  zones: Array.isArray(currentValue.zone)
                    ? currentValue.zone.join(", ")
                    : currentValue.zone || "",
                  zonesData: currentValue.zonesData,
                  evidenceUrl: currentValue.evidenceUrl || "",
                };
                // Add categories from zonesData
                if (currentValue.zonesData) {
                  const cats: any[] = [];
                  Object.entries(currentValue.zonesData).forEach(
                    ([zoneName, zoneData]: [string, any]) => {
                      if (zoneData?.categories) {
                        zoneData.categories.forEach((cat: any) => {
                          const defectsArr = (cat.defects || []).map(
                            (d: any) => ({
                              name: d.name,
                              details: d.details || { remark: "", fileUrl: "" },
                            }),
                          );
                          cats.push({ name: cat.name, defects: defectsArr });
                        });
                      }
                    },
                  );
                  if (cats.length > 0) structuredAnswer.categories = cats;
                }
              } else if (
                Array.isArray(filteredAnswer) &&
                filteredAnswer.length >= 7
              ) {
                // Fallback to array parsing
                structuredAnswer = {
                  status: filteredAnswer[1] || "",
                  chassisNumber: filteredAnswer[0] || "",
                  zones: filteredAnswer[2] || "",
                  categories: filteredAnswer[3]
                    ? [
                      {
                        name: filteredAnswer[3],
                        defects: filteredAnswer[4]
                          ? [
                            {
                              name: filteredAnswer[4],
                              details: {
                                remark: filteredAnswer[5] || "",
                                fileUrl: filteredAnswer[6] || "",
                              },
                            },
                          ]
                          : [],
                      },
                    ]
                    : [],
                };
              } else if (filteredAnswer?.zonesData) {
                structuredAnswer = filteredAnswer;
              }
            }

            questionContexts.push({
              questionId: qid,
              title: q.text || "Question",
              answer: structuredAnswer,
              suggestion: chatFilters.suggestedAnswers[qid],
            });
            selectedQuestionTitles.push(q.text || "Question");
          }
        });
      });

      // Extract email from createdBy object or string
      const createdByObj = chatResponse.createdBy;
      const createdByEmail =
        createdByObj && typeof createdByObj === "object"
          ? (createdByObj as any).email || (createdByObj as any)._id?.toString()
          : typeof createdByObj === "string"
            ? createdByObj
            : "inspector@focus.com";

      console.log("[handleSendMessage] createdBy:", createdByObj);
      console.log("[handleSendMessage] toEmail:", createdByEmail);

      console.log("Sending message with data:", {
        toEmail: createdByEmail,
        message: messageToSend,
        responseId: chatResponse.id,
        formId: id,
        questionIds: chatFilters.questions,
        questionTitles: selectedQuestionTitles,
        questionContexts: questionContexts,
        tenantId:
          form?.tenantId || (user?.tenantId as any)?._id || user?.tenantId,
      });

      await apiClient.post("/messages/send", {
        toEmail: createdByEmail,
        message: messageToSend,
        responseId: chatResponse.id,
        formId: id,
        questionIds: chatFilters.questions,
        questionTitles: selectedQuestionTitles,
        questionContexts: questionContexts,
        tenantId:
          form?.tenantId || (user?.tenantId as any)?._id || user?.tenantId,
      });

      setNewMessage("");
      // Clear selected questions after sending
      setChatFilters((prev) => ({
        ...prev,
        questions: [],
        selectedCategories: {},
        suggestedAnswers: {},
      }));
      fetchChatHistory(chatResponse.id);
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Helper to compute Parent/Follow-up matching status and color coding
  const computeParentMatch = (response: any) => {
    // 1. If backend already provided rich followUpStatus, prioritize it
    const fs = response?.followUpStatus;
    if (fs) {
      if (fs.status === "matched") {
        const isParentMatch = fs.matchType === "parent";
        return {
          status: "matched",
          badgeText: isParentMatch ? "✓ Parent Matched" : "✓ Follow-up Done",
          badgeClasses: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100",
          icon: CheckCircle2,
          subText: isParentMatch
            ? (fs.parentStatus ? `Status: ${fs.parentStatus}` : "Linked to Parent")
            : (fs.followUpStatus ? `Status: ${fs.followUpStatus}` : "Follow-up Complete"),
          tooltip: fs.details || (isParentMatch
            ? `Matched parent chassis "${fs.matchedChassis || ""}" (Status: ${fs.parentStatus || "Accepted"}) by ${fs.parentSubmittedBy || "Inspector"}`
            : `Follow-up completed for chassis "${fs.matchedChassis || ""}" by ${fs.followUpSubmittedBy || "Inspector"}`)
        };
      }

      if (fs.status === "unmatched") {
        return {
          status: "unmatched",
          badgeText: "⚠ No Parent Match",
          badgeClasses: "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100",
          icon: AlertTriangle,
          subText: "Standalone Follow-up",
          tooltip: fs.details || `Chassis "${fs.matchedChassis || ""}" has not been inspected in the parent form yet`
        };
      }

      if (fs.status === "pending") {
        return {
          status: "pending",
          badgeText: fs.badgeText || "⏳ Pending Follow-up",
          badgeClasses: "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800 hover:bg-sky-100",
          icon: Clock,
          subText: fs.daysElapsed !== undefined ? `Day ${fs.daysElapsed + 1}/10` : "Active window",
          tooltip: fs.details || "Follow-up inspection is currently pending within active 10-day window"
        };
      }

      if (fs.status === "overdue") {
        return {
          status: "overdue",
          badgeText: fs.badgeText || "✕ Overdue",
          badgeClasses: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 hover:bg-rose-100",
          icon: XCircle,
          subText: `${fs.daysElapsed || 0} days`,
          tooltip: fs.details || `Follow-up overdue by ${fs.daysElapsed || 0} days`
        };
      }
    }

    // 2. Client-side relation checks:
    // If response has parentResponseId, it is a follow-up matched to a parent
    if (response?.parentResponseId) {
      const parentInList = responses?.find(
        (r: any) => (r.id && r.id === response.parentResponseId) || (r._id && r._id === response.parentResponseId)
      );
      if (parentInList) {
        const parentStatus = tableDisplayStatuses[parentInList.id || parentInList._id] || parentInList.status || "Accepted";
        const parentSubmitter = parentInList.submittedBy || "Inspector";
        return {
          status: "matched",
          badgeText: "✓ Parent Matched",
          badgeClasses: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100",
          icon: CheckCircle2,
          subText: `Status: ${parentStatus}`,
          tooltip: `Linked to parent response by ${parentSubmitter} (Status: ${parentStatus})`
        };
      }
      return {
        status: "matched",
        badgeText: "✓ Parent Matched",
        badgeClasses: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100",
        icon: CheckCircle2,
        subText: "Linked to Parent",
        tooltip: `Linked to parent response (${response.parentResponseId.slice(0, 10)}...)`
      };
    }

    // Check if this response is a parent that has a child follow-up response in the list
    const respId = response?.id || response?._id;
    const chassisVal = getResponseChassisValue(response);
    const hasChildMatch = responses?.some(
      (r: any) =>
        (r.parentResponseId && (r.parentResponseId === respId || r.parentResponseId === response?.id)) ||
        (chassisVal && r.parentResponseId && getResponseChassisValue(r) === chassisVal) ||
        (chassisVal && r.id !== respId && getResponseChassisValue(r) === chassisVal && (r.batchId?.includes("-t2") || r.batchId?.includes("-fu-")))
    );

    if (hasChildMatch) {
      return {
        status: "matched",
        badgeText: "✓ Follow-up Done",
        badgeClasses: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100",
        icon: CheckCircle2,
        subText: "Follow-up Complete",
        tooltip: `Follow-up inspection completed for chassis "${chassisVal || ""}"`
      };
    }

    // Check if this form is a child/follow-up form or parent form
    const isChildForm = Boolean(form?.parentFormId);
    const isParentForm = Boolean(form?.childForms && form.childForms.length > 0);

    if (isChildForm) {
      // Child form with no parent matched
      return {
        status: "unmatched",
        badgeText: "⚠ No Parent Match",
        badgeClasses: "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100",
        icon: AlertTriangle,
        subText: "Standalone Follow-up",
        tooltip: `Chassis "${chassisVal || ""}" has not been inspected in the parent form yet`
      };
    }

    if (isParentForm && chassisVal) {
      const createdAtDate = response?.createdAt ? new Date(response.createdAt) : new Date();
      const daysElapsed = Math.floor((Date.now() - createdAtDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysElapsed <= 10) {
        return {
          status: "pending",
          badgeText: `⏳ Day ${daysElapsed + 1}/10`,
          badgeClasses: "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800 hover:bg-sky-100",
          icon: Clock,
          subText: `Day ${daysElapsed + 1}/10`,
          tooltip: `Follow-up inspection is pending within active 10-day window (Day ${daysElapsed + 1} of 10)`
        };
      }
      return {
        status: "overdue",
        badgeText: `✕ Overdue (${daysElapsed}d)`,
        badgeClasses: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 hover:bg-rose-100",
        icon: XCircle,
        subText: `${daysElapsed} days`,
        tooltip: `Follow-up overdue by ${daysElapsed} days`
      };
    }

    return {
      status: "standalone",
      badgeText: "Main Record",
      badgeClasses: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600",
      icon: CheckCircle2,
      subText: "Standard",
      tooltip: "Standard inspection submission"
    };
  };

  // Central column filter matcher for both client-filtered full dataset and paginated table responses
  const matchSingleColumnFilter = (response: any, columnId: string, allowedValues: string[]): boolean => {
    if (!allowedValues || allowedValues.length === 0) return true;
    const respId = response.id || response._id;

    // 1. __attemptRank
    if (columnId === "__attemptRank") {
      const rank = chassisAttemptRanks[respId] || (response.responseRanks && chassisQuestionId ? response.responseRanks[chassisQuestionId] : 1);
      const rowStatus = tableDisplayStatuses[respId] || responseStatuses[respId] || "Pending Review";
      let colorLabel = "Green - Accepted";
      if (rowStatus === "Rejected") {
        colorLabel = "Red - Rejected";
      } else if (rowStatus?.includes("Rework") && rowStatus !== "Rework Accepted" && rowStatus !== "Rework Completed") {
        colorLabel = "Yellow - Rework";
      } else if (rowStatus === "Direct Ok" || rowStatus === "Rework Accepted" || rowStatus === "Accepted" || rowStatus === "Rework Completed" || rowStatus === "Verified") {
        colorLabel = "Green - Accepted";
      } else {
        colorLabel = "Gray - Pending";
      }
      const fullLabel = `Attempt ${rank} (${colorLabel})`;
      return (
        allowedValues.includes(fullLabel) ||
        allowedValues.includes(`Attempt ${rank}`) ||
        allowedValues.some(v => v === `Attempt ${rank}` || v.startsWith(`Attempt ${rank}`))
      );
    }

    // 2. __submittedBy
    if (columnId === "__submittedBy") {
      const submitter = (response.submittedBy || response.createdBy?.name || response.createdBy?.email || (typeof response.createdBy === "string" ? response.createdBy : "") || "Anonymous").toLowerCase().trim();
      return allowedValues.some((av) => {
        const avLower = av.toLowerCase().trim();
        return submitter === avLower || submitter.includes(avLower);
      });
    }

    // 3. __status (ultra-fast O(1) loop)
    if (columnId === "__status") {
      const statusVal =
        (respId ? tableDisplayStatuses[respId] || responseStatuses[respId] : null) ||
        tableDisplayStatuses[response.id] ||
        responseStatuses[response.id] ||
        computeFastRowStatus(response, chassisQuestionId) ||
        response.status ||
        "Direct Ok";
      const rawStatus = String(statusVal).toLowerCase().trim();

      for (let i = 0; i < allowedValues.length; i++) {
        const avLower = allowedValues[i].toLowerCase().trim();
        if (avLower === "rework" || avLower === "ongoing rework") {
          const isReworkStatus = rawStatus.includes("rework") && rawStatus !== "rework accepted" && rawStatus !== "rework completed";
          if (isReworkStatus) {
            const itemId = getChassisOrItemId(response, chassisQuestionId);
            if (!itemId || !resolvedReworkChassisSet.has(itemId.toLowerCase().trim())) {
              return true;
            }
          }
        } else if (avLower === "direct ok" || avLower === "accepted") {
          if (rawStatus === "direct ok" || rawStatus === "accepted" || rawStatus === "verified") return true;
        } else if (avLower === "rework accepted") {
          if (rawStatus === "rework accepted" || rawStatus === "rework completed") return true;
        } else if (avLower === "pending review" || avLower === "pending" || avLower === "-") {
          if (rawStatus === "pending review" || rawStatus === "pending" || rawStatus === "-") return true;
        } else if (rawStatus === avLower || rawStatus.includes(avLower)) {
          return true;
        }
      }
      return false;
    }

    // 4. __chassisNumber
    if (columnId === "__chassisNumber") {
      const chassisVal = (getResponseChassisValue(response) || "").toLowerCase().trim();
      return allowedValues.some((av) => {
        const avLower = av.toLowerCase().trim();
        return chassisVal === avLower || chassisVal.includes(avLower);
      });
    }

    // 5. __parentMatch
    if (columnId === "__parentMatch") {
      const pm = computeParentMatch(response);
      const pmBadge = (pm.badgeText || "").toLowerCase().trim();
      const pmStatus = (pm.status || "").toLowerCase().trim();
      return allowedValues.some((av) => {
        const avLower = av.toLowerCase().trim();
        if (pmBadge === avLower || pmBadge.includes(avLower) || avLower.includes(pmBadge)) return true;
        if (avLower.includes("parent") && (pmBadge.includes("parent") || pmStatus === "matched")) return true;
        if (avLower.includes("follow-up") && (pmBadge.includes("follow-up") || pmStatus === "pending")) return true;
        if (avLower.includes("orphan") && (pmBadge.includes("no parent") || pmStatus === "unmatched")) return true;
        if (avLower.includes("overdue") && (pmBadge.includes("overdue") || pmStatus === "overdue")) return true;
        if (avLower.includes("main") && (pmBadge.includes("main") || pmStatus === "standalone")) return true;
        return false;
      });
    }

    // 6. __biwReview
    if (columnId === "__biwReview") {
      const biwStatus = (response.biwReview?.status || "").toLowerCase().trim();
      return allowedValues.some((av) => {
        const avLower = av.toLowerCase().trim();
        if (avLower === "no review yet" || avLower === "pending review") {
          return !biwStatus || biwStatus === "pending review";
        }
        return biwStatus === avLower;
      });
    }

    // 7. __dispatch
    if (columnId === "__dispatch") {
      const isDispatched = !!response.isDispatched;
      return allowedValues.some((av) => {
        const avLower = av.toLowerCase().trim();
        if (avLower.includes("dispatched") && !avLower.includes("pending")) {
          return isDispatched;
        }
        if (avLower.includes("pending") || avLower.includes("not")) {
          return !isDispatched;
        }
        return true;
      });
    }

    // Dynamic question answer filter
    let answer = response.answers?.[columnId];
    if (answer === null || answer === undefined) {
      if (
        columnId === chassisQuestionId ||
        columnId === "chassis_number" ||
        columnId === "chassisNumber"
      ) {
        answer =
          response.answers?.chassis_number ||
          response.answers?.chassisNumber ||
          response.chassisNumber;
      }
    }
    if (answer === null || answer === undefined) {
      return allowedValues.includes("No Response") || allowedValues.includes("");
    }
    const answerValues = extractAnswerValues(answer);
    return answerValues.some((v) => {
      if (!v) return false;
      const vLower = v.toLowerCase();
      return allowedValues.some((av) => {
        if (!av) return false;
        const avLower = av.toLowerCase();
        return vLower === avLower || vLower.includes(avLower) || avLower.includes(vLower);
      });
    });
  };

  const filteredResponses = useMemo(() => {
    let result = baseFilteredResponses;

    // 1. Global Date Filter
    if (dateFilter.type !== "all") {
      result = result.filter((response) => {
        const timestamp = getResponseTimestamp(response);
        if (!timestamp) return false;
        const responseDate = toLocalDateString(timestamp);

        if (dateFilter.type === "single" && dateFilter.startDate) {
          return responseDate === dateFilter.startDate;
        } else if (
          dateFilter.type === "range" &&
          dateFilter.startDate &&
          dateFilter.endDate
        ) {
          return (
            responseDate >= dateFilter.startDate &&
            responseDate <= dateFilter.endDate
          );
        }
        return true;
      });
    }

    // 2. Global Inspector Filter
    if (selectedInspectorForTrend !== "Overall") {
      result = result.filter(
        (response) => response.submittedBy === selectedInspectorForTrend,
      );
    }

    // 3. Overall search term filter — uses deferredSearchTerm so the input
    //    remains responsive while React batches the expensive filter pass.
    if (deferredSearchTerm.trim() !== "") {
      const term = deferredSearchTerm.toLowerCase().trim();
      result = result.filter((response) => {
        // Match submitter
        const submitter = (response.submittedBy || response.createdBy || "").toLowerCase();
        if (submitter.includes(term)) return true;

        // Match status
        const status = (responseStatuses[response.id] || "").toLowerCase();
        if (status.includes(term)) return true;

        // Match chassis number
        const chVal = response.answers?.chassis_number;
        if (chVal) {
          if (typeof chVal === "object") {
            if (chVal.chassisNumber && String(chVal.chassisNumber).toLowerCase().includes(term)) return true;
            if (chVal.partDescription && String(chVal.partDescription).toLowerCase().includes(term)) return true;
          } else if (String(chVal).toLowerCase().includes(term)) {
            return true;
          }
        }

        // Match any answers in the response
        if (response.answers) {
          for (const [key, val] of Object.entries(response.answers)) {
            if (val === null || val === undefined) continue;

            if (typeof val === "object") {
              const valStr = JSON.stringify(val).toLowerCase();
              if (valStr.includes(term)) return true;
            } else {
              if (String(val).toLowerCase().includes(term)) return true;
            }
          }
        }

        return false;
      });
    }

    // 4. Column filters (supports __attemptRank, __status, __submittedBy, __chassisNumber, __parentMatch, __biwReview, __dispatch, and questions)
    const activeColumnFilters = Object.entries(columnFilters).filter(
      ([_, values]) => values && values.length > 0,
    );
    if (activeColumnFilters.length > 0) {
      result = result.filter((response) => {
        return activeColumnFilters.every(([columnId, allowedValues]) =>
          matchSingleColumnFilter(response, columnId, allowedValues || [])
        );
      });
    }

    return result;
  }, [baseFilteredResponses, dateFilter, selectedInspectorForTrend, deferredSearchTerm, responseStatuses, columnFilters, chassisAttemptRanks, tableDisplayStatuses, chassisQuestionId, resolvedReworkChassisSet]);

  useEffect(() => {
    setResponsesPage(1);
  }, [dateFilter, selectedInspectorForTrend, id, responsesSearchTerm, columnFilters, tableSort]);

  // Check if any client-side filters (column filters, search term, date, or inspector) or sort are active
  const hasActiveFiltersOrSort = useMemo(() => {
    return (
      Object.values(columnFilters).some((v) => v && v.length > 0) ||
      responsesSearchTerm.trim() !== "" ||
      dateFilter.type !== "all" ||
      selectedInspectorForTrend !== "Overall" ||
      tableSort !== null
    );
  }, [columnFilters, responsesSearchTerm, dateFilter, selectedInspectorForTrend, tableSort]);

  // Sort helper function that handles natural alphanumeric sorting
  const sortResponses = (list: Response[]) => {
    if (!tableSort) return list;
    const { columnId, direction } = tableSort;
    const isAsc = direction === "asc";

    return [...list].sort((a, b) => {
      // Chassis sorting
      if (
        columnId === "__chassisNumber" ||
        columnId === "chassis_number" ||
        (chassisQuestionId && columnId === chassisQuestionId)
      ) {
        const valA = String(getResponseChassisValue(a) || "");
        const valB = String(getResponseChassisValue(b) || "");
        const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" });
        return isAsc ? cmp : -cmp;
      }

      // Submitted by sorting
      if (columnId === "__submittedBy") {
        const valA = String(a.submittedBy || (a as any).createdBy?.name || (a as any).createdBy || "");
        const valB = String(b.submittedBy || (b as any).createdBy?.name || (b as any).createdBy || "");
        const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" });
        return isAsc ? cmp : -cmp;
      }

      // Status sorting
      if (columnId === "__status") {
        const valA = String(tableDisplayStatuses[a.id] || responseStatuses[a.id] || a.status || "");
        const valB = String(tableDisplayStatuses[b.id] || responseStatuses[b.id] || b.status || "");
        const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" });
        return isAsc ? cmp : -cmp;
      }

      // Timestamp sorting
      if (columnId === "timestamp" || columnId === "__timestamp") {
        const timeA = getResponseTimestamp(a) || 0;
        const timeB = getResponseTimestamp(b) || 0;
        return isAsc ? timeA - timeB : timeB - timeA;
      }

      // Time Taken sorting
      if (columnId === "__timeSpent" || columnId === "timeSpent") {
        const timeA = a.timeSpent ?? a.totalTimeSpent ?? 0;
        const timeB = b.timeSpent ?? b.totalTimeSpent ?? 0;
        return isAsc ? timeA - timeB : timeB - timeA;
      }

      // Attempt Rank sorting
      if (columnId === "__attemptRank") {
        const rankA = chassisAttemptRanks[a.id] || (a.responseRanks && chassisQuestionId ? a.responseRanks[chassisQuestionId] : 1);
        const rankB = chassisAttemptRanks[b.id] || (b.responseRanks && chassisQuestionId ? b.responseRanks[chassisQuestionId] : 1);
        return isAsc ? rankA - rankB : rankB - rankA;
      }

      // Parent Match sorting
      if (columnId === "__parentMatch") {
        const matchA = computeParentMatch(a).badgeText;
        const matchB = computeParentMatch(b).badgeText;
        const cmp = String(matchA).localeCompare(String(matchB));
        return isAsc ? cmp : -cmp;
      }

      // Generic question answer sorting
      const ansA = a.answers?.[columnId];
      const ansB = b.answers?.[columnId];
      const valA = String(extractAnswerValues(ansA).join(" ") || "");
      const valB = String(extractAnswerValues(ansB).join(" ") || "");
      const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" });
      return isAsc ? cmp : -cmp;
    });
  };

  // Sorted and filtered responses across the entire dataset
  const sortedFilteredResponses = useMemo(() => {
    return sortResponses(filteredResponses);
  }, [filteredResponses, tableSort, chassisQuestionId, chassisAttemptRanks, tableDisplayStatuses, responseStatuses]);

  // When filters/sort are active and full dataset `responses` is in memory, total count is `sortedFilteredResponses.length`.
  // Otherwise, fallback to server count `totalResponsesCount`.
  const activeTotalResponsesCount = (hasActiveFiltersOrSort && responses.length > 0)
    ? sortedFilteredResponses.length
    : totalResponsesCount;

  const totalResponsesPages = Math.max(1, Math.ceil(activeTotalResponsesCount / responsesPageSize));
  const currentResponsesPage = Math.min(responsesPage, totalResponsesPages);
  const responsesStartIndex = activeTotalResponsesCount > 0 ? (currentResponsesPage - 1) * responsesPageSize : 0;
  const responsesEndIndex = (hasActiveFiltersOrSort && responses.length > 0)
    ? Math.min(responsesStartIndex + responsesPageSize, activeTotalResponsesCount)
    : responsesStartIndex + tableResponses.length;

  // Responses displayed in the Responses tab table (supports slicing from sortedFilteredResponses when full dataset is loaded)
  const displayedTableResponses = useMemo(() => {
    if (hasActiveFiltersOrSort && responses.length > 0) {
      const startIndex = (currentResponsesPage - 1) * responsesPageSize;
      return sortedFilteredResponses.slice(startIndex, startIndex + responsesPageSize);
    }

    let result = tableResponses;
    const activeColumnFilters = Object.entries(columnFilters).filter(
      ([_, values]) => values && values.length > 0,
    );

    if (activeColumnFilters.length > 0) {
      result = result.filter((response) => {
        return activeColumnFilters.every(([columnId, allowedValues]) => {
          if (!allowedValues || allowedValues.length === 0) return true;
          return matchSingleColumnFilter(response, columnId, allowedValues);
        });
      });
    }

    if (tableSort) {
      result = sortResponses(result);
    }

    return result;
  }, [hasActiveFiltersOrSort, responses, sortedFilteredResponses, tableResponses, columnFilters, currentResponsesPage, responsesPageSize, chassisAttemptRanks, tableDisplayStatuses, responseStatuses, chassisQuestionId, tableSort]);

  const pageSizesList = useMemo(() => {
    const base = [20, 50, 100];
    if (totalResponsesCount <= 100) {
      return base;
    }



    const sizes = [...base];
    if (totalResponsesCount <= 300) {
      for (let s = 150; s <= Math.min(300, totalResponsesCount + 50); s += 50) {
        sizes.push(s);
      }
    } else {
      const steps = [200, 300, 500, 1000, 2000, 5000];
      for (const step of steps) {
        sizes.push(step);
        if (step >= totalResponsesCount) break;
      }
    }
    return Array.from(new Set(sizes)).sort((a, b) => a - b);
  }, [totalResponsesCount]);

  const analytics = useMemo(() => {
    const total = filteredResponses.length;
    const pending = filteredResponses.filter(
      (r) => r.status === "pending" || !r.status,
    ).length;
    const verified = filteredResponses.filter(
      (r) => r.status === "verified",
    ).length;
    const rejected = filteredResponses.filter(
      (r) => r.status === "rejected",
    ).length;

    const recentResponses = filteredResponses
      .filter((r) => getResponseTimestamp(r))
      .sort((a, b) => {
        const timestampA = getResponseTimestamp(a);
        const timestampB = getResponseTimestamp(b);
        const dateA = timestampA ? new Date(timestampA).getTime() : 0;
        const dateB = timestampB ? new Date(timestampB).getTime() : 0;
        if (isNaN(dateA) && isNaN(dateB)) return 0;
        if (isNaN(dateA)) return 1;
        if (isNaN(dateB)) return -1;
        return dateB - dateA;
      })
      .slice(0, 5);

    // 🔥 FIX: Use filtered responses date range, not today's date
    const responseTrend = filteredResponses.reduce(
      (acc: Record<string, number>, response) => {
        const timestamp = getResponseTimestamp(response);
        if (timestamp) {
          const dateObj = new Date(timestamp);
          if (!isNaN(dateObj.getTime())) {
            const date = dateObj.toISOString().split("T")[0];
            acc[date] = (acc[date] || 0) + 1;
          }
        }
        return acc;
      },
      {},
    );

    // 🔥 FIX: Get dates from the actual filtered responses
    let dateRange: string[] = [];

    if (dateFilter.type !== "all" && dateFilter.startDate && dateFilter.endDate) {
      // Use the filtered date range
      const start = new Date(dateFilter.startDate);
      const end = new Date(dateFilter.endDate);
      const days: string[] = [];
      const current = new Date(start);

      while (current <= end) {
        days.push(current.toISOString().split("T")[0]);
        current.setDate(current.getDate() + 1);
      }
      dateRange = days;
    } else {
      // Fallback to last 30 days if no filter applied
      dateRange = Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split("T")[0];
      }).reverse();
    }

    // Get response counts for each day in the range
    const counts = dateRange.map((date) => responseTrend[date] || 0);
    const maxCount = Math.max(...counts, 1);
    const percentageData = counts.map((count) =>
      Math.round((count / maxCount) * 100),
    );

    return {
      total,
      pending,
      verified,
      rejected,
      recentResponses,
      responseTrend,
      dateRange, // ← Use this instead of last30Days
      percentageData,
    };
  }, [filteredResponses, dateFilter.startDate, dateFilter.endDate, dateFilter.type]);

  // qualityChartResponses and sectionChartResponses used to be computed
  // separately, but they apply the exact same date-filter logic to the same
  // source array, making them identical. They were then each fed into a
  // separate (expensive, O(sections * questions * responses)) call to
  // computeSectionPerformanceStats, tripling that work for no reason. Now
  // computed once and shared.
  const dateFilteredResponses = useMemo(() => {
    let result = [...filteredResponses];
    if (dateFilter.startDate || dateFilter.endDate) {
      result = result.filter((response) => {
        const timestamp = getResponseTimestamp(response);
        if (!timestamp) return false;
        const responseDate = toLocalDateString(timestamp);
        if (dateFilter.startDate && dateFilter.endDate) {
          return (
            responseDate >= dateFilter.startDate &&
            responseDate <= dateFilter.endDate
          );
        } else if (dateFilter.startDate) {
          return responseDate >= dateFilter.startDate;
        } else if (dateFilter.endDate) {
          return responseDate <= dateFilter.endDate;
        }
        return true;
      });
    }
    return result;
  }, [filteredResponses, dateFilter.startDate, dateFilter.endDate]);

  const qualityChartResponses = dateFilteredResponses;
  const sectionChartResponses = dateFilteredResponses;

  const sharedDateFilteredSectionPerformanceStats = useMemo(() => {
    if (analyticsView !== "dashboard" && analyticsView !== "overall") {
      return [];
    }
    return computeSectionPerformanceStats(form, dateFilteredResponses);
  }, [form, dateFilteredResponses, analyticsView]);

  const qualitySectionPerformanceStats =
    sharedDateFilteredSectionPerformanceStats;

  const dashboardSectionPerformanceStats =
    sharedDateFilteredSectionPerformanceStats;





  // Helper to safely extract display values from any answer type


  const uniqueColumnValues = useMemo(() => {
    const map = new Map<string, string[]>();
    const sets = new Map<string, Set<string>>();

    responses.forEach((response) => {
      if (!response.answers) return;
      Object.entries(response.answers).forEach(([qId, answer]) => {
        if (!sets.has(qId)) {
          sets.set(qId, new Set<string>());
        }
        const s = sets.get(qId)!;
        const values = extractAnswerValues(answer);
        values.forEach(v => { if (v) s.add(v); });
      });
    });

    form?.sections?.forEach((section) => {
      section.questions?.forEach((q: any) => {
        if (!sets.has(q.id)) {
          const s = new Set<string>([""]);
          sets.set(q.id, s);
        } else {
          sets.get(q.id)!.add("");
        }
      });
    });

    sets.forEach((set, qId) => {
      const sorted = Array.from(set).sort((a, b) => {
        const strA = String(a ?? "");
        const strB = String(b ?? "");
        if (strA === "") return 1;
        if (strB === "") return -1;
        return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: "base" });
      });
      map.set(qId, sorted);
    });

    return map;
  }, [form, responses]);

  const getUniqueColumnValues = (
    questionId: string,
    responses: Response[],
  ): string[] => {
    const values = new Set<string>();
    responses.forEach((response) => {
      const answer = response.answers?.[questionId];
      if (answer !== null && answer !== undefined) {
        if (Array.isArray(answer)) {
          answer.forEach((item) => {
            const strValue = String(item).trim();
            if (strValue) values.add(strValue);
          });
        } else {
          const strValue = String(answer).trim();
          if (strValue) values.add(strValue);
        }
      } else {
        values.add("");
      }
    });
    return Array.from(values).sort((a, b) => {
      const strA = String(a ?? "");
      const strB = String(b ?? "");
      if (strA === "") return 1;
      if (strB === "") return -1;
      return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: "base" });
    });
  };

  const hasAnswerValue = (value: any) => {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === "string") {
      return value.trim() !== "";
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === "object") {
      return Object.keys(value).length > 0;
    }
    return true;
  };

  const renderAnswerDisplay = (value: any, question?: any): React.ReactNode => {
    const ensureAbsoluteFileSource = (input: any) => {
      if (!input || typeof input !== "string") {
        return "";
      }
      if (input.startsWith("data:")) {
        return input;
      }
      if (input.startsWith("http://") || input.startsWith("https://")) {
        return input;
      }
      if (input.startsWith("//")) {
        if (typeof window !== "undefined" && window.location) {
          return `${window.location.protocol}${input}`;
        }
        return `https:${input}`;
      }
      const normalized = input.startsWith("/") ? input : `/${input}`;
      if (typeof window !== "undefined" && window.location) {
        return `${window.location.origin}${normalized}`;
      }
      return normalized;
    };

    const extractFileName = (input: any) => {
      if (!input || typeof input !== "string") {
        return undefined;
      }
      try {
        const sanitized = input.split("?")[0];
        const parts = sanitized.split("/");
        const name = parts[parts.length - 1] || undefined;
        return name ? decodeURIComponent(name) : undefined;
      } catch {
        return undefined;
      }
    };

    const resolveFileData = (input: any) => {
      if (!input) {
        return null;
      }
      const candidate =
        Array.isArray(input) && input.length === 1 ? input[0] : input;
      if (typeof candidate === "string") {
        if (candidate.startsWith("data:")) {
          return {
            data: candidate,
            fileName: question?.fileName || question?.name,
          };
        }
        if (
          candidate.startsWith("http") ||
          candidate.startsWith("//") ||
          candidate.startsWith("/") ||
          candidate.startsWith("uploads/")
        ) {
          const absolute = ensureAbsoluteFileSource(candidate);
          return {
            url: absolute,
            fileName:
              question?.fileName ||
              question?.name ||
              extractFileName(candidate),
          };
        }
        return null;
      }
      if (typeof candidate === "object") {
        const dataValue =
          candidate.data ||
          candidate.value ||
          candidate.file ||
          candidate.base64 ||
          candidate.url ||
          candidate.answer ||
          candidate.path;
        const nameValue =
          candidate.fileName ||
          candidate.filename ||
          candidate.name ||
          question?.fileName ||
          question?.name;
        if (typeof dataValue === "string" && dataValue.startsWith("data:")) {
          return { data: dataValue, fileName: nameValue };
        }
        if (typeof dataValue === "string") {
          const absolute = ensureAbsoluteFileSource(dataValue);
          return {
            url: absolute,
            fileName: nameValue || extractFileName(dataValue),
          };
        }
        if (typeof candidate.url === "string") {
          const absolute = ensureAbsoluteFileSource(candidate.url);
          return {
            url: absolute,
            fileName: nameValue || extractFileName(candidate.url),
          };
        }
      }
      return null;
    };

    if (value === null || value === undefined || value === "") {
      return <span className="text-gray-400">No response</span>;
    }

    if (question?.type === "date" || (typeof value === "string" && /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(value))) {
      return formatToDDMMYYYY(value);
    }

    if (question?.id === chassisQuestionId || (question?.text && question.text.toLowerCase().includes("chassis"))) {
      const displayVal = getChassisDisplayValue(value);
      if (displayVal && displayVal !== "-" && displayVal !== "No response" && displayVal !== "None" && displayVal !== "N/A") {
        return (
          <span className="text-gray-900 dark:text-gray-100 font-medium text-xs">
            {displayVal}
          </span>
        );
      }
      return <span className="text-gray-400 dark:text-gray-500 text-xs font-medium">None</span>;
    }

    if (typeof value === "string") {
      if (value.startsWith("data:")) {
        return (
          <FilePreview
            data={value}
            fileName={question?.fileName || question?.name}
          />
        );
      }

      if (isImageUrl(value)) {
        return <ImageLink text={value} />;
      }

      if (
        value.startsWith("http") ||
        value.startsWith("//") ||
        value.startsWith("/") ||
        value.startsWith("uploads/")
      ) {
        const absolute = ensureAbsoluteFileSource(value);
        if (isImageUrl(absolute)) {
          return <ImageLink text={absolute} />;
        }
        return (
          <a
            href={absolute}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800"
          >
            {value}
          </a>
        );
      }

      const trimmed = value.trim();
      return trimmed ? (
        trimmed
      ) : (
        <span className="text-gray-400">No response</span>
      );
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-gray-400">No response</span>;
      }

      const previews = value
        .map((entry: any, index: number) => {
          const fileData = resolveFileData(entry);
          if (!fileData) {
            if (typeof entry === "string" && isImageUrl(entry)) {
              return <ImageLink key={index} text={entry} />;
            }
            return (
              <span key={index} className="text-sm">
                {String(entry)}
              </span>
            );
          }
          if (isImageUrl(fileData.url || fileData.data || "")) {
            return (
              <ImageLink
                key={index}
                text={fileData.url || fileData.data || ""}
              />
            );
          }
          return (
            <FilePreview
              key={`${question?.id ?? "file-array"}-${index}`}
              data={fileData.data}
              url={fileData.url}
              fileName={fileData.fileName}
            />
          );
        })
        .filter(Boolean);

      if (previews.length) {
        return <div className="flex flex-wrap gap-2">{previews}</div>;
      }
    }

    if (typeof value === "object") {
      const fileData = resolveFileData(value);
      if (fileData?.url || fileData?.data) {
        const finalUrl = fileData.url || fileData.data;
        if (finalUrl && isImageUrl(finalUrl)) {
          return <ImageLink text={finalUrl} />;
        }
        if (fileData.data) {
          return (
            <FilePreview data={fileData.data} fileName={fileData.fileName} />
          );
        }
        if (fileData.url) {
          return (
            <FilePreview url={fileData.url} fileName={fileData.fileName} />
          );
        }
      }

      if (!Object.keys(value).length) {
        return <span className="text-gray-400">No response</span>;
      }

      const isChassisType =
        value.chassisNumber !== undefined ||
        value.status !== undefined ||
        value.zone !== undefined ||
        value.zones !== undefined ||
        value.categories !== undefined;

      if (isChassisType) {
        const parts: {
          label: string;
          value: string;
          zoneColor?: string;
          isImage?: boolean;
        }[] = [];

        // Get color for zone
        const getZoneColor = (zoneName: string): string => {
          const z = zoneName.toLowerCase().trim();
          if (z.includes("zone a") || z === "a") return "blue";
          if (z.includes("zone b") || z === "b") return "green";
          if (z.includes("zone c") || z === "c") return "purple";
          if (z.includes("zone d") || z === "d") return "orange";
          if (z.includes("zone e") || z === "e") return "pink";
          if (z.includes("zone f") || z === "f") return "cyan";
          return "indigo";
        };

        if (
          value.chassisNumber &&
          String(value.chassisNumber).trim() &&
          String(value.chassisNumber).toLowerCase() !== "no response"
        ) {
          parts.push({
            label: "Chassis",
            value: String(value.chassisNumber),
            zoneColor: "blue",
          });
        }
        if (
          value.status &&
          String(value.status).trim() &&
          String(value.status).toLowerCase() !== "no response"
        ) {
          parts.push({
            label: "Status",
            value: String(value.status),
            zoneColor: "red",
          });
        }
        if (
          (value.remark || value.remarks) &&
          String(value.remark || value.remarks).trim() &&
          String(value.remark || value.remarks).toLowerCase() !== "no response"
        ) {
          parts.push({
            label: "Remark",
            value: String(value.remark || value.remarks),
            zoneColor: "amber",
          });
        }
        const zoneRaw = value.zone || value.zones;
        if (zoneRaw) {
          const zoneVal = Array.isArray(zoneRaw)
            ? zoneRaw.join(", ")
            : String(zoneRaw);
          if (zoneVal.trim()) {
            // If multiple zones, use a mixed color
            if (zoneVal.includes(",")) {
              parts.push({
                label: "Zone",
                value: zoneVal,
                zoneColor: "indigo",
              });
            } else {
              parts.push({
                label: "Zone",
                value: zoneVal,
                zoneColor: getZoneColor(zoneVal),
              });
            }
          }
        }

        // Handle zonesData (categories, defects, remarks) - with zone colors
        if (value.zonesData && typeof value.zonesData === "object") {
          const zoneEntries = Object.entries(value.zonesData);
          for (const [zoneName, zoneVal] of zoneEntries) {
            const zoneColor = getZoneColor(zoneName);
            const colorMap: Record<string, string> = {
              blue: "bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
              green:
                "bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200",
              purple:
                "bg-purple-50 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
              orange:
                "bg-orange-50 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
              pink: "bg-pink-50 dark:bg-pink-900/30 text-pink-800 dark:text-pink-200",
              cyan: "bg-cyan-50 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200",
              red: "bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200",
              amber:
                "bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200",
              indigo:
                "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200",
            };
            const colorClass = colorMap[zoneColor] || colorMap.indigo;

            // Add zone header
            parts.push({ label: "Zone", value: zoneName, zoneColor });

            const categories = (zoneVal as any)?.categories;
            if (categories && Array.isArray(categories)) {
              for (const cat of categories) {
                const catName =
                  typeof cat === "string"
                    ? cat
                    : cat?.name || cat?.category || cat?.categoryName || "-";
                parts.push({
                  label: "Category",
                  value: String(catName),
                  zoneColor,
                });

                const defects = cat?.defects;
                if (defects && Array.isArray(defects)) {
                  for (const defect of defects) {
                    const defectName =
                      typeof defect === "string"
                        ? defect
                        : defect?.name || defect?.defect || "-";
                    const defectDetails =
                      typeof defect === "object" ? defect?.details || {} : {};
                    const remark =
                      defectDetails?.remark || defectDetails?.remarks || "-";
                    parts.push({
                      label: "Defect",
                      value: String(defectName),
                      zoneColor,
                    });
                    if (
                      remark &&
                      String(remark).trim() &&
                      String(remark).toLowerCase() !== "-"
                    ) {
                      parts.push({
                        label: "Remark",
                        value: String(remark),
                        zoneColor,
                      });
                    }
                    const fileUrl =
                      defectDetails?.fileUrl ||
                      defectDetails?.file ||
                      defect?.fileUrl ||
                      defect?.file ||
                      defect?.imageUrl ||
                      "";
                    if (
                      fileUrl &&
                      String(fileUrl).toLowerCase() !== "no response" &&
                      String(fileUrl).trim()
                    ) {
                      parts.push({
                        label: "Evidence",
                        value: String(fileUrl),
                        zoneColor,
                        isImage: true,
                      });
                    }
                  }
                }
              }
            }
          }
        }

        // Handle categories (direct property) - both object and array formats
        if (value.categories) {
          if (Array.isArray(value.categories)) {
            // ChassisWithoutZone format: array of category objects
            for (const cat of value.categories) {
              const catName = cat?.name || cat?.category || "-";
              if (catName !== "-") {
                parts.push({
                  label: "Category",
                  value: String(catName),
                  zoneColor: "purple",
                });

                const defects = cat?.defects;
                if (defects && Array.isArray(defects)) {
                  for (const defect of defects) {
                    const defectName =
                      typeof defect === "string"
                        ? defect
                        : defect?.name || defect?.defect || "-";
                    const defectDetails =
                      typeof defect === "object" ? defect?.details || {} : {};
                    const remark =
                      defectDetails?.remark || defectDetails?.remarks || "-";
                    parts.push({
                      label: "Defect",
                      value: String(defectName),
                      zoneColor: "purple",
                    });
                    if (
                      remark &&
                      String(remark).trim() &&
                      String(remark).toLowerCase() !== "-"
                    ) {
                      parts.push({
                        label: "Remark",
                        value: String(remark),
                        zoneColor: "purple",
                      });
                    }
                    const fileUrl =
                      defectDetails?.fileUrl ||
                      defectDetails?.file ||
                      defect?.fileUrl ||
                      defect?.file ||
                      defect?.imageUrl ||
                      "";
                    if (
                      fileUrl &&
                      String(fileUrl).toLowerCase() !== "no response" &&
                      String(fileUrl).trim()
                    ) {
                      parts.push({
                        label: "Evidence",
                        value: String(fileUrl),
                        zoneColor: "purple",
                        isImage: true,
                      });
                    }
                  }
                }
              }
            }
          } else if (typeof value.categories === "object") {
            // Object format: key-value pairs
            const catEntries = Object.entries(value.categories);
            for (const [catKey, catVal] of catEntries) {
              parts.push({
                label: String(catKey),
                value: String(catVal),
                zoneColor: "amber",
              });
            }
          }
        }

        // Handle evidenceUrl or other direct evidence fields
        const directEvidence =
          value.evidenceUrl ||
          value.fileUrl ||
          value.file ||
          value.imageUrl ||
          value.evidence ||
          value.evidenceImage;

        if (
          directEvidence &&
          String(directEvidence).toLowerCase() !== "no response" &&
          String(directEvidence).trim() &&
          !parts.some((p) => p.label === "Evidence")
        ) {
          parts.push({
            label: "Evidence",
            value: String(directEvidence),
            zoneColor: "indigo",
            isImage: true,
          });
        }

        if (parts.length > 0) {
          return (
            <div className="flex flex-col gap-2">
              {parts.map((part, idx) => {
                const colorMap: Record<string, string> = {
                  blue: "bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
                  green:
                    "bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200",
                  purple:
                    "bg-purple-50 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
                  orange:
                    "bg-orange-50 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
                  pink: "bg-pink-50 dark:bg-pink-900/30 text-pink-800 dark:text-pink-200",
                  cyan: "bg-cyan-50 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200",
                  red: "bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200",
                  amber:
                    "bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200",
                  indigo:
                    "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200",
                };
                const colorClass =
                  colorMap[part.zoneColor || "indigo"] || colorMap.indigo;

                return (
                  <div key={idx} className="flex items-start gap-2">
                    <span
                      className={`px-2 py-1 ${colorClass} text-xs rounded font-medium min-w-[70px]`}
                    >
                      {part.label}
                    </span>
                    {part.isImage || part.label === "Evidence" ? (
                      <ImageLink text={part.value} isImage={true} showImage={true} />
                    ) : (
                      <span
                        className={`px-2 py-1 ${colorClass} text-xs rounded font-medium`}
                      >
                        {part.value}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        }

        return <span className="text-gray-400">No response</span>;
      }

      const entries = Object.entries(value);
      return (
        <div className="flex flex-col gap-2">
          {entries.map(([k, v], i) => (
            <div
              key={i}
              className="flex flex-col gap-0.5 border-l-2 border-gray-100 dark:border-gray-800 pl-2"
            >
              <span className="text-[10px] font-bold opacity-70 uppercase tracking-tighter text-blue-800 dark:text-blue-300">
                {k}
              </span>
              {renderAnswerDisplay(v)}
            </div>
          ))}
        </div>
      );
    }

    return (
      <pre className="text-xs whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  };








  const visibleDashboardSectionStats = useMemo(
    () =>
      dashboardSectionPerformanceStats.filter((stat) =>
        selectedSectionIds.includes(stat.id),
      ),
    [dashboardSectionPerformanceStats, selectedSectionIds],
  );

  const sectionSummaryRows = useMemo(
    () =>
      visibleDashboardSectionStats
        .map((stat) => {
          const rowYesCount = stat.yes + (stat.accepted || 0);
          const rowNoCount = stat.no + (stat.rejected || 0);
          const rowNaCount = stat.na + (stat.rework || 0);

          const yesPercent = stat.total ? (rowYesCount / stat.total) * 100 : 0;
          const noPercent = stat.total ? (rowNoCount / stat.total) * 100 : 0;
          const naPercent = stat.total ? (rowNaCount / stat.total) * 100 : 0;

          return {
            id: stat.id,
            title: stat.title,
            yesPercent,
            yesCount: rowYesCount,
            noPercent,
            noCount: rowNoCount,
            naPercent,
            naCount: rowNaCount,
            total: stat.total,
          };
        })
        // Sort by Yes percentage in descending order
        .sort((a, b) => b.yesPercent - a.yesPercent),
    [visibleDashboardSectionStats],
  );

  const summaryTotals = useMemo(() => {
    return sectionSummaryRows.reduce(
      (acc, row) => ({
        total: acc.total + row.total,
        yesCount: acc.yesCount + (row.yesCount || 0),
        noCount: acc.noCount + (row.noCount || 0),
        naCount: acc.naCount + (row.naCount || 0),
      }),
      {
        total: 0,
        yesCount: 0,
        noCount: 0,
        naCount: 0,
      },
    );
  }, [sectionSummaryRows]);

  const qualitySectionSummaryRows = useMemo(
    () =>
      qualitySectionPerformanceStats.map((stat) => {
        const rowYesCount = stat.yes + (stat.accepted || 0);
        const rowNoCount = stat.no + (stat.rejected || 0);
        const rowNaCount = stat.na + (stat.rework || 0);

        const yesPercent = stat.total ? (rowYesCount / stat.total) * 100 : 0;
        const noPercent = stat.total ? (rowNoCount / stat.total) * 100 : 0;
        const naPercent = stat.total ? (rowNaCount / stat.total) * 100 : 0;

        return {
          id: stat.id,
          title: stat.title,
          yesPercent,
          yesCount: rowYesCount,
          noPercent,
          noCount: rowNoCount,
          naPercent,
          naCount: rowNaCount,
          total: stat.total,
        };
      }),
    [qualitySectionPerformanceStats],
  );

  const uniqueInspectors = useMemo(() => {
    // Combine inspectors from responses, inspectorSummary, and allInspectors (Role-based)
    const inspectors = new Set<string>();

    // From Responses
    baseFilteredResponses.forEach((r) => {
      if (r.submittedBy) inspectors.add(r.submittedBy);
    });

    // From Admin/System Summary
    inspectorSummary.forEach((s) => {
      if (s.qcInspector) inspectors.add(s.qcInspector);
    });

    // From Role-based fetch (All users with Inspector role)
    allInspectors.forEach((i) => {
      if (i.name) inspectors.add(i.name);
      if (i.email) inspectors.add(i.email);
    });

    return Array.from(inspectors).sort();
  }, [baseFilteredResponses, inspectorSummary, allInspectors]);

  const inspectionStats = useMemo(() => {
    let accepted = 0;
    let rejected = 0;
    let rawReworked = 0;
    let reworkCompleted = 0;
    let dispatched = 0;
    let pending = 0;

    // Track active rework per chassis so no pending rework unit is missed
    const activeReworkChassis = new Set<string>();

    filteredResponses.forEach((response) => {
      const respId = response.id || (response as any)._id;
      const statusVal =
        tableDisplayStatuses[response.id] ||
        tableDisplayStatuses[(response as any)._id] ||
        responseStatuses[response.id] ||
        responseStatuses[(response as any)._id] ||
        (respId ? tableDisplayStatuses[respId] || responseStatuses[respId] : null) ||
        computeFastRowStatus(response, chassisQuestionId) ||
        response.status ||
        "";
      const rawStatus = String(statusVal).trim().toLowerCase();

      const isAccepted =
        rawStatus === "direct ok" ||
        rawStatus === "accepted" ||
        rawStatus === "verified" ||
        rawStatus === "ok" ||
        rawStatus === "pass";

      const isReworkAccepted =
        rawStatus === "rework accepted" ||
        rawStatus === "rework completed" ||
        rawStatus === "rework ok" ||
        rawStatus === "reworked accepted";

      const isRework =
        !isReworkAccepted &&
        (rawStatus.startsWith("rework") ||
          rawStatus === "ongoing rework" ||
          rawStatus.includes("rework"));

      const isRejected =
        rawStatus === "rejected" ||
        rawStatus === "reject" ||
        rawStatus === "fail" ||
        rawStatus === "not ok";

      if (isAccepted) {
        accepted++;
      } else if (isReworkAccepted) {
        reworkCompleted++;
      } else if (isRework) {
        rawReworked++;
        const itemId = getChassisOrItemId(response, chassisQuestionId);
        if (itemId && itemId !== "none" && itemId !== "-") {
          // If this chassis has not reached Rework Accepted, it is an active rework
          if (!resolvedReworkChassisSet.has(itemId.toLowerCase().trim())) {
            activeReworkChassis.add(itemId.toLowerCase().trim());
          }
        }
      } else if (isRejected) {
        rejected++;
      } else {
        pending++;
      }

      // Dispatch is tracked independently of status - a response can be
      // Direct Ok (or any other status) AND already dispatched, so this
      // is counted separately rather than as a mutually-exclusive bucket.
      if (response.isDispatched) {
        dispatched++;
      }
    });

    // If chassis tracking is present, active rework equals distinct chassis still waiting for acceptance.
    // If no chassis tracking or chassis-less responses, calculate net active rework (raw - completed).
    const reworked =
      activeReworkChassis.size > 0
        ? activeReworkChassis.size
        : Math.max(0, rawReworked - reworkCompleted);

    return {
      accepted,
      rejected,
      reworked,
      rawReworked,
      reworkCompleted,
      dispatched,
      pending,
    };
  }, [filteredResponses, responseStatuses, tableDisplayStatuses, chassisQuestionId, resolvedReworkChassisSet, getChassisOrItemId]);

  const totalPieChartData = useMemo(() => {
    const directOk = inspectionStats.accepted;
    const reworkCompleted = inspectionStats.reworkCompleted;
    const totalNo = inspectionStats.rejected;
    const totalNA = inspectionStats.reworked;
    const totalDispatched = inspectionStats.dispatched;

    const total = directOk + reworkCompleted + totalNo + totalNA;

    if (total === 0) {
      return {
        directOk: 0,
        reworkCompleted: 0,
        no: 0,
        na: 0,
        dispatched: 0,
        counts: { directOk: 0, reworkCompleted: 0, no: 0, na: 0, dispatched: 0, total: 0 },
      };
    }

    const directOkPercent = (directOk / total) * 100;
    const reworkCompletedPercent = (reworkCompleted / total) * 100;
    const noPercent = (totalNo / total) * 100;
    const naPercent = (totalNA / total) * 100;
    // Dispatched is expressed as a % of the same total responses, but
    // since it overlaps with the status buckets above (a dispatched
    // response is still counted in Direct Ok/Rework/etc.), this slice
    // won't sum to 100% together with the other four - it's a separate
    // "how far along the pipeline" signal, not a disjoint category.
    const dispatchedPercent = (totalDispatched / total) * 100;

    return {
      directOk: Number(directOkPercent.toFixed(1)),
      reworkCompleted: Number(reworkCompletedPercent.toFixed(1)),
      no: Number(noPercent.toFixed(1)),
      na: Number(naPercent.toFixed(1)),
      dispatched: Number(dispatchedPercent.toFixed(1)),
      counts: {
        directOk: directOk,
        reworkCompleted: reworkCompleted,
        no: totalNo,
        na: totalNA,
        dispatched: totalDispatched,
        total: total,
      },
    };
  }, [inspectionStats]);



  const defectChartResponses = useMemo(() => {
    if (analyticsView !== "dashboard" && analyticsView !== "overall") {
      return [];
    }

    console.log("=== defectChartResponses DEBUG ===");
    console.log("filteredResponses count:", filteredResponses.length);

    // Check how many responses have BIW reviews
    const withBiw = filteredResponses.filter(r => r.biwReview?.flaggedQuestions?.length > 0);
    console.log("Responses with BIW in filteredResponses:", withBiw.length);

    let result = [...filteredResponses];

    if (dateFilter.startDate || dateFilter.endDate) {
      result = result.filter((response) => {
        const timestamp = getResponseTimestamp(response);
        if (!timestamp) return false;
        const responseDate = toLocalDateString(timestamp);

        if (dateFilter.startDate && dateFilter.endDate) {
          return (
            responseDate >= dateFilter.startDate &&
            responseDate <= dateFilter.endDate
          );
        } else if (dateFilter.startDate) {
          return responseDate >= dateFilter.startDate;
        } else if (dateFilter.endDate) {
          return responseDate <= dateFilter.endDate;
        }
        return true;
      });
    }

    result.sort((a, b) => {
      const dateA = new Date(getResponseTimestamp(a) || 0).getTime();
      const dateB = new Date(getResponseTimestamp(b) || 0).getTime();
      return dateB - dateA;
    });

    // REMOVE the slice - use ALL responses
    console.log("Final result count:", result.length);
    return result;  // Return ALL responses
  }, [filteredResponses, dateFilter.startDate, dateFilter.endDate]);
  const trendChartResponses = useMemo(() => {
    let result = [...filteredResponses];

    if (dateFilter.startDate || dateFilter.endDate) {
      result = result.filter((response) => {
        const timestamp = getResponseTimestamp(response);
        if (!timestamp) return false;
        const responseDate = toLocalDateString(timestamp);

        if (dateFilter.startDate && dateFilter.endDate) {
          return (
            responseDate >= dateFilter.startDate &&
            responseDate <= dateFilter.endDate
          );
        } else if (dateFilter.startDate) {
          return responseDate >= dateFilter.startDate;
        } else if (dateFilter.endDate) {
          return responseDate <= dateFilter.endDate;
        }
        return true;
      });
    }

    result.sort((a, b) => {
      const dateA = new Date(getResponseTimestamp(a) || 0).getTime();
      const dateB = new Date(getResponseTimestamp(b) || 0).getTime();
      return dateA - dateB; // Sort ascending for trend
    });

    return result;
  }, [filteredResponses, dateFilter.startDate, dateFilter.endDate]);

  const chartQuestionPerformanceStats = useMemo(() => {
    if (analyticsView !== "dashboard" && analyticsView !== "overall") {
      return [];
    }
    return computeQuestionPerformanceStats(form, defectChartResponses);
  }, [form, defectChartResponses, analyticsView]);



  const OverallQualityPieChart = () => {
    // NOTE: Dispatched is intentionally NOT one of the doughnut slices.
    // Direct Ok / Rework Completed / Rejected / Ongoing Rework are
    // mutually exclusive and sum to 100% of responses, so they make a
    // correct pie. Dispatched is a different, overlapping dimension (a
    // response can be "Direct Ok" AND dispatched), so mixing it into the
    // same slices made the chart visually sum past 100% and look wrong.
    // It's rendered as its own progress indicator below the chart instead.
    const centerAcceptedCount =
      (totalPieChartData.counts.directOk || 0) +
      (totalPieChartData.counts.reworkCompleted || 0);


    const data = {
      labels: ["Direct Ok", "Rework Accepted", "Rejected", "Rework"],
      datasets: [
        {
          data: [
            totalPieChartData.directOk,
            totalPieChartData.reworkCompleted,
            totalPieChartData.no,
            totalPieChartData.na,
          ],
          backgroundColor: [
            "rgba(34, 197, 94, 0.85)", // Green for Direct Ok
            "rgba(59, 130, 246, 0.85)", // Blue for Rework Completed / Accepted
            "rgba(239, 68, 68, 0.85)", // Red for Rejected
            "rgba(234, 179, 8, 0.85)", // Yellow for Rework
          ],
          borderColor: [
            "rgb(34, 197, 94)",
            "rgb(59, 130, 246)",
            "rgb(239, 68, 68)",
            "rgb(234, 179, 8)",
          ],
          borderWidth: 2,
          hoverOffset: 15,
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        datalabels: {
          color: "white",
          font: { weight: "bold" as const, size: 10 },
          formatter: (value: number) => (value > 0 ? `${value}%` : ""),
        },
        legend: {
          position: "bottom" as const,
          labels: {
            color: document.documentElement.classList.contains("dark")
              ? "#e5e7eb"
              : "#374151",
            font: { size: 9, weight: "bold" as const },
            padding: 8,
            usePointStyle: true,
          },
        },
        tooltip: {
          callbacks: {
            label: function (context: any) {
              const label = context.label || "";
              const value = context.raw || 0;
              const index = context.dataIndex;

              let count = 0;
              if (index === 0) count = totalPieChartData.counts.directOk;
              else if (index === 1)
                count = totalPieChartData.counts.reworkCompleted;
              else if (index === 2) count = totalPieChartData.counts.no;
              else if (index === 3) count = totalPieChartData.counts.na;

              return `${label}: ${value}% (${count} responses)`;
            },
          },
        },
      },
      cutout: "60%",
      interaction: {
        mode: "nearest" as const,
        intersect: true,
      },
    };

    return (
      <div className="p-4 sm:p-6 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 flex flex-col h-full rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg mr-1.5">
                <PieChart className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-primary-900 dark:text-white">
                  Overall Inspection Trend
                </h2>
                <p className="text-[10px] sm:text-xs text-primary-500 dark:text-primary-400">
                  {selectedInspectorForTrend === "Overall"
                    ? "Accepted/Rejected/Rework Distribution"
                    : `Inspector: ${selectedInspectorForTrend}`}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col" id="overall-quality-chart">
          {totalPieChartData.counts.total === 0 ? (
            <div className="flex-1 flex items-center justify-center min-h-[200px]">
              <div className="text-center p-4">
                <PieChart className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-primary-500 dark:text-primary-400 font-medium text-sm">
                  No inspection data available
                </p>
                <p className="text-[10px] text-primary-400 dark:text-primary-500 mt-1">
                  Will appear when inspection responses are recorded
                </p>
              </div>
            </div>
          ) : (
            <>
              <div style={{ height: "200px", position: "relative" }} className="flex items-center justify-center">
                {/* Doughnut Chart */}
                <Doughnut data={data} options={options} />

                {/* Center count & label overlay - 100% guaranteed visible across all browsers and devices */}
                <div
                  className="absolute pointer-events-none flex flex-col items-center justify-center select-none"
                  style={{
                    top: "calc(50% - 15px)",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <span className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white leading-none tracking-tight">
                    {centerAcceptedCount}
                  </span>
                  <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-wider mt-1">
                    ACCEPTED
                  </span>
                </div>
              </div>

              {/* Stats summary - Total Submissions, Direct Ok, Rework Accepted, Rework, Rejected, and Dispatched */}
              <div className="mt-4 grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2">
                {/* Total Submissions */}
                <div className="text-center p-1.5 bg-purple-50/60 dark:bg-purple-900/15 rounded-lg border border-purple-100/60 dark:border-purple-800/30 shadow-xs">
                  <div className="text-[10px] sm:text-xs font-bold text-purple-600 dark:text-purple-400">
                    100%
                  </div>
                  <div className="text-[9px] font-semibold text-gray-700 dark:text-gray-300 truncate" title="Total Submissions">
                    Total Submissions
                  </div>
                  <div className="text-[8px] text-gray-600 dark:text-gray-400 font-medium">
                    ({totalPieChartData.counts.total})
                  </div>
                </div>

                {/* Direct Ok / Accepted */}
                <div className="text-center p-1.5 bg-green-50/60 dark:bg-green-900/15 rounded-lg border border-green-100/60 dark:border-green-800/30 shadow-xs">
                  <div className="text-[10px] sm:text-xs font-bold text-green-600 dark:text-green-400">
                    {totalPieChartData.directOk}%
                  </div>
                  <div className="text-[9px] font-semibold text-gray-700 dark:text-gray-300 truncate" title="Direct Ok / Accepted">
                    Direct Ok
                  </div>
                  <div className="text-[8px] text-gray-600 dark:text-gray-400 font-medium">
                    ({totalPieChartData.counts.directOk})
                  </div>
                </div>

                {/* Rework Accepted */}
                <div className="text-center p-1.5 bg-blue-50/60 dark:bg-blue-900/15 rounded-lg border border-blue-100/60 dark:border-blue-800/30 shadow-xs">
                  <div className="text-[10px] sm:text-xs font-bold text-blue-600 dark:text-blue-400">
                    {totalPieChartData.reworkCompleted}%
                  </div>
                  <div className="text-[9px] font-semibold text-gray-700 dark:text-gray-300 truncate" title="Rework Accepted">
                    Rework Accepted
                  </div>
                  <div className="text-[8px] text-gray-600 dark:text-gray-400 font-medium">
                    ({totalPieChartData.counts.reworkCompleted})
                  </div>
                </div>

                {/* Ongoing Rework */}
                <div className="text-center p-1.5 bg-amber-50/60 dark:bg-amber-900/15 rounded-lg border border-amber-100/60 dark:border-amber-800/30 shadow-xs">
                  <div className="text-[10px] sm:text-xs font-bold text-amber-600 dark:text-amber-400">
                    {totalPieChartData.na}%
                  </div>
                  <div className="text-[9px] font-semibold text-gray-700 dark:text-gray-300 truncate" title="Ongoing Rework">
                    Rework
                  </div>
                  <div className="text-[8px] text-gray-600 dark:text-gray-400 font-medium">
                    ({totalPieChartData.counts.na})
                  </div>
                </div>

                {/* Rejected */}
                <div className="text-center p-1.5 bg-red-50/60 dark:bg-red-900/15 rounded-lg border border-red-100/60 dark:border-red-800/30 shadow-xs">
                  <div className="text-[10px] sm:text-xs font-bold text-red-600 dark:text-red-400">
                    {totalPieChartData.no}%
                  </div>
                  <div className="text-[9px] font-semibold text-gray-700 dark:text-gray-300 truncate" title="Rejected">
                    Rejected
                  </div>
                  <div className="text-[8px] text-gray-600 dark:text-gray-400 font-medium">
                    ({totalPieChartData.counts.no})
                  </div>
                </div>

                {/* Dispatched */}
                <div className="text-center p-1.5 bg-indigo-50/60 dark:bg-indigo-900/15 rounded-lg border border-indigo-100/60 dark:border-indigo-800/30 shadow-xs">
                  <div className="text-[10px] sm:text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {totalPieChartData.dispatched}%
                  </div>
                  <div className="text-[9px] font-semibold text-gray-700 dark:text-gray-300 truncate" title="Dispatched">
                    Dispatched
                  </div>
                  <div className="text-[8px] text-gray-600 dark:text-gray-400 font-medium">
                    ({totalPieChartData.counts.dispatched})
                  </div>
                </div>
              </div>

              {/* Dispatched - shown separately from the pie/stats-grid
                  above since it's not a disjoint status (a response can
                  be Direct Ok AND dispatched). Plain text summary only,
                  no chart/progress-bar. */}
              {/* <div className="mt-3 text-center text-[10px] sm:text-xs font-semibold text-gray-700 dark:text-gray-300">
                Dispatched{" "}
                <span className="text-purple-600 dark:text-purple-400 font-bold">
                  ({totalPieChartData.dispatched}%, {totalPieChartData.counts.dispatched} of {totalPieChartData.counts.total})
                </span>
              </div> */}
            </>
          )}
        </div>
      </div>
    );
  };

  const QuestionStatusDistributionChart = () => {
    // Filter and Sort questions based on issue volume
    const processedQuestions = useMemo(() => {
      let filtered = chartQuestionPerformanceStats.filter(
        (q) => q.rejected > 0 || q.rework > 0,
      );

      if (chartSortOrder === "percentage") {
        filtered = [...filtered].sort((a, b) => {
          const percentA = ((a.rejected + a.rework) / a.total) * 100;
          const percentB = ((b.rejected + b.rework) / b.total) * 100;
          return percentB - percentA;
        });
      }

      return filtered.slice(0, 20);
    }, [chartQuestionPerformanceStats, chartSortOrder]);



    if (
      !processedQuestions.length &&
      !dateFilter.startDate &&
      !dateFilter.endDate
    )
      return null;

    const data = {
      labels: processedQuestions.map((q) =>
        q.text.length > 25 ? q.text.substring(0, 25) + "..." : q.text,
      ),
      datasets: [
        {
          label: complianceLabels.no,
          data: processedQuestions.map((q) => q.rejected),
          backgroundColor: "rgba(153, 27, 27, 0.85)", // Dark Red
          borderColor: "rgb(127, 29, 29)",
          borderWidth: 1,
          barPercentage: processedQuestions.length <= 2 ? 0.3 : 0.7,
          categoryPercentage: 0.8,
          datalabels: {
            color: "#ffffff",
            font: { weight: "bold" as const, size: 10 },
            formatter: (value: number) => (value > 0 ? value : ""),
            textAlign: "center" as const,
          },
        },
        {
          label: complianceLabels.na,
          data: processedQuestions.map((q) => q.rework),
          backgroundColor: "rgba(55, 65, 81, 0.85)", // Dark Gray
          borderColor: "rgb(31, 41, 55)",
          borderWidth: 1,
          barPercentage: processedQuestions.length <= 2 ? 0.3 : 0.7,
          categoryPercentage: 0.8,
          datalabels: {
            color: "#ffffff",
            font: { weight: "bold" as const, size: 10 },
            formatter: (value: number) => (value > 0 ? value : ""),
            textAlign: "center" as const,
          },
        },
      ],
    };

    const options = {
      indexAxis: chartOrientation === "h" ? ("y" as const) : ("x" as const),
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: {
            color: document.documentElement.classList.contains("dark")
              ? "#e5e7eb"
              : "#374151",
            font: { size: 11, weight: "bold" as const },
            padding: 20,
            usePointStyle: true,
          },
        },
        datalabels: {
          display: (context: any) => {
            return context.dataset.data[context.dataIndex] > 0;
          },
        },
        tooltip: {
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: function (context: any) {
              const value = context.raw;
              return `${context.dataset.label}: ${value}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            color: document.documentElement.classList.contains("dark")
              ? "#e5e7eb"
              : "#374151",
            font: { size: 10, weight: "600" as const },
            maxRotation: chartOrientation === "v" ? 45 : 0,
            minRotation: 0,
          },
          grid: {
            display: false,
          },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            color: document.documentElement.classList.contains("dark")
              ? "#9ca3af"
              : "#6b7280",
            font: { size: 10 },
          },
          grid: {
            color: document.documentElement.classList.contains("dark")
              ? "rgba(255, 255, 255, 0.05)"
              : "rgba(0, 0, 0, 0.03)",
          },
        },
      },
      interaction: {
        mode: "nearest" as const,
        intersect: true,
      },
    };

    const containerStyle =
      chartOrientation === "h"
        ? {
          height: `${Math.max(450, processedQuestions.length * 40)}px`,
          position: "relative" as const,
        }
        : { height: "450px", position: "relative" as const };

    return (
      <div
        id="defect-distribution-chart"
        className="p-4 sm:p-6 bg-gradient-to-br from-white to-slate-50 dark:from-gray-800 dark:to-gray-900 flex flex-col h-full rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow"
      >
        <div
          data-pdf-hide="true"
          className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6"
        >
          <div className="flex items-center">
            <div className="p-2 bg-gradient-to-br from-red-600 to-slate-700 rounded-lg mr-2">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                Defect Distribution
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                {complianceLabels.no} & {complianceLabels.na} volume (
                {commonDateRangeLabel})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Sort Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-gray-700 p-1 rounded-lg">
              <button
                onClick={() => setChartSortOrder("default")}
                className={`px-2 py-1 text-[9px] sm:text-[10px] font-bold rounded transition-all ${chartSortOrder === "default"
                  ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                  : "text-slate-500"
                  }`}
              >
                DEFAULT
              </button>
              <button
                onClick={() => setChartSortOrder("percentage")}
                className={`px-2 py-1 text-[9px] sm:text-[10px] font-bold rounded transition-all ${chartSortOrder === "percentage"
                  ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                  : "text-slate-500"
                  }`}
              >
                ISSUE %
              </button>
            </div>

            {/* Orientation Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-gray-700 p-1 rounded-lg">
              <button
                onClick={() => setChartOrientation("v")}
                title="Vertical View"
                className={`p-1 rounded transition-all ${chartOrientation === "v"
                  ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                  : "text-slate-500"
                  }`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2"
                  />
                </svg>
              </button>
              <button
                onClick={() => setChartOrientation("h")}
                title="Horizontal View"
                className={`p-1 rounded transition-all ${chartOrientation === "h"
                  ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                  : "text-slate-500"
                  }`}
              >
                <svg
                  className="w-4 h-4 rotate-90"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {processedQuestions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] text-center p-8">
            <div className="p-4 bg-slate-50 dark:bg-gray-800/50 rounded-full mb-4">
              <CheckCircle className="w-12 h-12 text-green-500 opacity-50" />
            </div>
            <h4 className="text-slate-900 dark:text-white font-bold mb-1">
              No Defects Found
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
              No rejected or rework responses were found for your current
              selection.
            </p>
          </div>
        ) : (
          <div
            className={chartOrientation === "h" ? "overflow-y-auto" : "w-full"}
          >
            <div style={containerStyle} id="issue-percentage-chart">
              <Bar data={data} options={options} />
            </div>
          </div>
        )}
      </div>
    );
  };

  const BiwDefectDistributionChart = () => {
    const biwProcessedQuestions = useMemo(() => {
      // ✅ STEP 1: Deduplicate responses by ID
      const uniqueResponsesMap = new Map();
      defectChartResponses.forEach((response) => {
        const id = response.id || response._id;
        if (id && !uniqueResponsesMap.has(id)) {
          uniqueResponsesMap.set(id, response);
        }
      });
      const uniqueResponses = Array.from(uniqueResponsesMap.values());

      console.log("=== BIW DEBUG (DEDUPLICATED) ===");
      console.log("Original responses:", defectChartResponses.length);
      console.log("Unique responses:", uniqueResponses.length);

      // ✅ STEP 2: Filter to only responses with BIW reviews
      const responsesWithBiw = uniqueResponses.filter(r => r.biwReview?.flaggedQuestions?.length > 0);
      console.log("Unique responses with BIW reviews:", responsesWithBiw.length);

      // ✅ STEP 3: Log each unique response
      responsesWithBiw.forEach((r, idx) => {
        console.log(`Response ${idx + 1}:`, {
          id: r.id,
          status: r.biwReview?.status,
          flaggedQuestions: r.biwReview?.flaggedQuestions?.map(fq => fq.questionId)
        });
      });

      const qMap = new Map<string, { id: string; text: string; rejected: number; rework: number }>();

      responsesWithBiw.forEach((response) => {
        const status = response.biwReview?.status;
        response.biwReview?.flaggedQuestions?.forEach((fq) => {
          if (!qMap.has(fq.questionId)) {
            console.log(`New question found: ${fq.questionId} - ${fq.questionText}`);
            qMap.set(fq.questionId, {
              id: fq.questionId,
              text: fq.questionText || "Unknown",
              rejected: 0,
              rework: 0
            });
          }
          const stat = qMap.get(fq.questionId)!;
          if (status === "Rejected") {
            stat.rejected++;
            console.log(`  ✅ ${fq.questionId}: Rejected++ (now ${stat.rejected})`);
          } else if (status === "Reworked") {
            stat.rework++;
            console.log(`  🔄 ${fq.questionId}: Rework++ (now ${stat.rework})`);
          }
        });
      });

      console.log("Final counts (deduplicated):");
      qMap.forEach((value, key) => {
        console.log(`  ${key}: Rejected=${value.rejected}, Rework=${value.rework}, Total=${value.rejected + value.rework}`);
      });

      let filtered = Array.from(qMap.values()).map(q => ({
        ...q,
        total: q.rejected + q.rework
      })).filter(q => q.rejected > 0 || q.rework > 0);

      console.log("Chart data (deduplicated):", filtered.map(q => ({
        text: q.text,
        rejected: q.rejected,
        rework: q.rework,
        total: q.total
      })));

      if (chartSortOrder === "percentage") {
        filtered = [...filtered].sort((a, b) => {
          const percentA = ((a.rejected + a.rework) / (a.total || 1)) * 100;
          const percentB = ((b.rejected + b.rework) / (b.total || 1)) * 100;
          return percentB - percentA;
        });
      } else {
        filtered = [...filtered].sort((a, b) => (b.rejected + b.rework) - (a.rejected + a.rework));
      }

      return filtered.slice(0, 20);
    }, [defectChartResponses, chartSortOrder]);

    if (
      !biwProcessedQuestions.length &&
      !dateFilter.startDate &&
      !dateFilter.endDate
    )
      return null;

    const data = {
      labels: biwProcessedQuestions.map((q) =>
        q.text.length > 25 ? q.text.substring(0, 25) + "..." : q.text,
      ),
      datasets: [
        {
          label: "Rejected (BIW)",
          data: biwProcessedQuestions.map((q) => q.rejected),
          backgroundColor: "rgba(153, 27, 27, 0.85)", // Dark Red
          borderColor: "rgb(127, 29, 29)",
          borderWidth: 1,
          barPercentage: biwProcessedQuestions.length <= 2 ? 0.3 : 0.7,
          categoryPercentage: 0.8,
          datalabels: {
            color: "#ffffff",
            font: { weight: "bold" as const, size: 10 },
            formatter: (value: number) => (value > 0 ? value : ""),
            textAlign: "center" as const,
          },
        },
        {
          label: "Rework (BIW)",
          data: biwProcessedQuestions.map((q) => q.rework),
          backgroundColor: "rgba(55, 65, 81, 0.85)", // Dark Gray
          borderColor: "rgb(31, 41, 55)",
          borderWidth: 1,
          barPercentage: biwProcessedQuestions.length <= 2 ? 0.3 : 0.7,
          categoryPercentage: 0.8,
          datalabels: {
            color: "#ffffff",
            font: { weight: "bold" as const, size: 10 },
            formatter: (value: number) => (value > 0 ? value : ""),
            textAlign: "center" as const,
          },
        },
      ],
    };

    const options = {
      indexAxis: chartOrientation === "h" ? ("y" as const) : ("x" as const),
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: {
            color: document.documentElement.classList.contains("dark")
              ? "#e5e7eb"
              : "#374151",
            font: { size: 11, weight: "bold" as const },
            padding: 20,
            usePointStyle: true,
          },
        },
        datalabels: {
          display: (context: any) => {
            return context.dataset.data[context.dataIndex] > 0;
          },
        },
        tooltip: {
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: function (context: any) {
              const value = context.raw;
              return `${context.dataset.label}: ${value}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            color: document.documentElement.classList.contains("dark")
              ? "#e5e7eb"
              : "#374151",
            font: { size: 10, weight: "600" as const },
            maxRotation: chartOrientation === "v" ? 45 : 0,
            minRotation: 0,
          },
          grid: {
            display: false,
          },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            color: document.documentElement.classList.contains("dark")
              ? "#9ca3af"
              : "#6b7280",
            font: { size: 10 },
          },
          grid: {
            color: document.documentElement.classList.contains("dark")
              ? "rgba(255, 255, 255, 0.05)"
              : "rgba(0, 0, 0, 0.03)",
          },
        },
      },
      interaction: {
        mode: "nearest" as const,
        intersect: true,
      },
    };

    const containerStyle =
      chartOrientation === "h"
        ? {
          height: `${Math.max(450, biwProcessedQuestions.length * 40)}px`,
          position: "relative" as const,
        }
        : { height: "450px", position: "relative" as const };

    return (
      <div
        id="biw-defect-distribution-chart"
        className="p-4 sm:p-6 bg-gradient-to-br from-white to-slate-50 dark:from-gray-800 dark:to-gray-900 flex flex-col h-full rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow"
      >
        <div
          data-pdf-hide="true"
          className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6"
        >
          <div className="flex items-center">
            <div className="p-2 bg-gradient-to-br from-red-600 to-slate-700 rounded-lg mr-2">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                BIW Defect Distribution
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                BIW Rejected & Rework volume ({commonDateRangeLabel})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Sort Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-gray-700 p-1 rounded-lg">
              <button
                onClick={() => setChartSortOrder("default")}
                className={`px-2 py-1 text-[9px] sm:text-[10px] font-bold rounded transition-all ${chartSortOrder === "default"
                  ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                  : "text-slate-500"
                  }`}
              >
                DEFAULT
              </button>
              <button
                onClick={() => setChartSortOrder("percentage")}
                className={`px-2 py-1 text-[9px] sm:text-[10px] font-bold rounded transition-all ${chartSortOrder === "percentage"
                  ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                  : "text-slate-500"
                  }`}
              >
                ISSUE %
              </button>
            </div>

            {/* Orientation Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-gray-700 p-1 rounded-lg">
              <button
                onClick={() => setChartOrientation("v")}
                title="Vertical View"
                className={`p-1 rounded transition-all ${chartOrientation === "v"
                  ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                  : "text-slate-500"
                  }`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2"
                  />
                </svg>
              </button>
              <button
                onClick={() => setChartOrientation("h")}
                title="Horizontal View"
                className={`p-1 rounded transition-all ${chartOrientation === "h"
                  ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                  : "text-slate-500"
                  }`}
              >
                <svg
                  className="w-4 h-4 rotate-90"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {biwProcessedQuestions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] text-center p-8">
            <div className="p-4 bg-slate-50 dark:bg-gray-800/50 rounded-full mb-4">
              <CheckCircle className="w-12 h-12 text-green-500 opacity-50" />
            </div>
            <h4 className="text-slate-900 dark:text-white font-bold mb-1">
              No BIW Defects Found
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
              No BIW rejected or rework responses were found for your current
              selection.
            </p>
          </div>
        ) : (
          <div
            className={chartOrientation === "h" ? "overflow-y-auto" : "w-full"}
          >
            <div style={containerStyle} id="biw-issue-percentage-chart">
              <Bar data={data} options={options} />
            </div>
          </div>
        )}
      </div>
    );
  };

  const TvsDefectDistributionChart = () => {
    const tvsProcessedQuestions = useMemo(() => {
      // ✅ STEP 1: Deduplicate tvsReviews by ID
      const uniqueReviewsMap = new Map();
      tvsReviews.forEach((review) => {
        const id = review._id || review.id;
        if (id && !uniqueReviewsMap.has(id)) {
          uniqueReviewsMap.set(id, review);
        }
      });
      const uniqueReviews = Array.from(uniqueReviewsMap.values());

      console.log("=== TVS DEBUG (DEDUPLICATED) ===");
      console.log("Original reviews:", tvsReviews.length);
      console.log("Unique reviews:", uniqueReviews.length);

      const qMap = new Map<string, { id: string; text: string; rejected: number; rework: number; accepted: number }>();

      uniqueReviews.forEach((review) => {  // Use uniqueReviews instead of tvsReviews
        if (review.questionContexts?.length) {
          const status = review.reviewOption;
          review.questionContexts.forEach((qc: any) => {
            if (!qMap.has(qc.questionId)) {
              qMap.set(qc.questionId, {
                id: qc.questionId,
                text: qc.title || "Unknown",
                rejected: 0,
                rework: 0,
                accepted: 0
              });
            }
            const stat = qMap.get(qc.questionId)!;
            if (status === "Rejected") {
              stat.rejected++;
            } else if (status === "Rework") {
              stat.rework++;
            } else if (status === "Accepted") {
              stat.accepted++;
            }
          });
        }
      });

      // Log final counts
      console.log("Final TVS counts (deduplicated):");
      qMap.forEach((value, key) => {
        console.log(`  ${key}: Accepted=${value.accepted}, Rejected=${value.rejected}, Rework=${value.rework}, Total=${value.accepted + value.rejected + value.rework}`);
      });

      let filtered = Array.from(qMap.values()).map(q => ({
        ...q,
        total: q.rejected + q.rework + q.accepted
      })).filter(q => q.rejected > 0 || q.rework > 0 || q.accepted > 0);

      if (chartSortOrder === "percentage") {
        filtered = [...filtered].sort((a, b) => {
          const percentA = ((a.rejected + a.rework) / (a.total || 1)) * 100;
          const percentB = ((b.rejected + b.rework) / (b.total || 1)) * 100;
          return percentB - percentA;
        });
      } else {
        filtered = [...filtered].sort((a, b) => (b.rejected + b.rework + b.accepted) - (a.rejected + a.rework + a.accepted));
      }

      return filtered.slice(0, 20);
    }, [tvsReviews, chartSortOrder]);


    if (
      !tvsProcessedQuestions.length &&
      !dateFilter.startDate &&
      !dateFilter.endDate
    )
      return null;

    const data = {
      labels: tvsProcessedQuestions.map((q) =>
        q.text.length > 25 ? q.text.substring(0, 25) + "..." : q.text,
      ),
      datasets: [
        {
          label: "Rejected (TVS Review)",
          data: tvsProcessedQuestions.map((q) => q.rejected),
          backgroundColor: "rgba(153, 27, 27, 0.85)", // Dark Red
          borderColor: "rgb(127, 29, 29)",
          borderWidth: 1,
          barPercentage: tvsProcessedQuestions.length <= 2 ? 0.3 : 0.7,
          categoryPercentage: 0.8,
          datalabels: {
            color: "#ffffff",
            font: { weight: "bold" as const, size: 10 },
            formatter: (value: number) => (value > 0 ? value : ""),
            textAlign: "center" as const,
          },
        },
        {
          label: "Rework (TVS Review)",
          data: tvsProcessedQuestions.map((q) => q.rework),
          backgroundColor: "rgba(55, 65, 81, 0.85)", // Dark Gray
          borderColor: "rgb(31, 41, 55)",
          borderWidth: 1,
          barPercentage: tvsProcessedQuestions.length <= 2 ? 0.3 : 0.7,
          categoryPercentage: 0.8,
          datalabels: {
            color: "#ffffff",
            font: { weight: "bold" as const, size: 10 },
            formatter: (value: number) => (value > 0 ? value : ""),
            textAlign: "center" as const,
          },
        },
        {
          label: "Accepted (TVS Review)",
          data: tvsProcessedQuestions.map((q) => q.accepted),
          backgroundColor: "rgba(34, 197, 94, 0.85)", // Green
          borderColor: "rgb(21, 128, 61)",
          borderWidth: 1,
          barPercentage: tvsProcessedQuestions.length <= 2 ? 0.3 : 0.7,
          categoryPercentage: 0.8,
          datalabels: {
            color: "#ffffff",
            font: { weight: "bold" as const, size: 10 },
            formatter: (value: number) => (value > 0 ? value : ""),
            textAlign: "center" as const,
          },
        },
      ],
    };

    const options = {
      indexAxis: chartOrientation === "h" ? ("y" as const) : ("x" as const),
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: {
            color: document.documentElement.classList.contains("dark")
              ? "#e5e7eb"
              : "#374151",
            font: { size: 11, weight: "bold" as const },
            padding: 20,
            usePointStyle: true,
          },
        },
        datalabels: {
          display: (context: any) => {
            return context.dataset.data[context.dataIndex] > 0;
          },
        },
        tooltip: {
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: function (context: any) {
              const value = context.raw;
              return `${context.dataset.label}: ${value}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            color: document.documentElement.classList.contains("dark")
              ? "#e5e7eb"
              : "#374151",
            font: { size: 10, weight: "600" as const },
            maxRotation: chartOrientation === "v" ? 45 : 0,
            minRotation: 0,
          },
          grid: {
            display: false,
          },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            color: document.documentElement.classList.contains("dark")
              ? "#9ca3af"
              : "#6b7280",
            font: { size: 10 },
          },
          grid: {
            color: document.documentElement.classList.contains("dark")
              ? "rgba(255, 255, 255, 0.05)"
              : "rgba(0, 0, 0, 0.03)",
          },
        },
      },
      interaction: {
        mode: "nearest" as const,
        intersect: true,
      },
    };

    const containerStyle =
      chartOrientation === "h"
        ? {
          height: `${Math.max(450, tvsProcessedQuestions.length * 40)}px`,
          position: "relative" as const,
        }
        : { height: "450px", position: "relative" as const };

    return (
      <div
        id="tvs-defect-distribution-chart"
        className="p-4 sm:p-6 bg-gradient-to-br from-white to-slate-50 dark:from-gray-800 dark:to-gray-900 flex flex-col h-full rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow"
      >
        <div
          data-pdf-hide="true"
          className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6"
        >
          <div className="flex items-center">
            <div className="p-2 bg-gradient-to-br from-indigo-600 to-slate-700 rounded-lg mr-2">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                TVS Defect Distribution
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                TVS Review volume ({commonDateRangeLabel})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Sort Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-gray-700 p-1 rounded-lg">
              <button
                onClick={() => setChartSortOrder("default")}
                className={`px-2 py-1 text-[9px] sm:text-[10px] font-bold rounded transition-all ${chartSortOrder === "default"
                  ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                  : "text-slate-500"
                  }`}
              >
                DEFAULT
              </button>
              <button
                onClick={() => setChartSortOrder("percentage")}
                className={`px-2 py-1 text-[9px] sm:text-[10px] font-bold rounded transition-all ${chartSortOrder === "percentage"
                  ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                  : "text-slate-500"
                  }`}
              >
                ISSUE %
              </button>
            </div>

            {/* Orientation Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-gray-700 p-1 rounded-lg">
              <button
                onClick={() => setChartOrientation("v")}
                title="Vertical View"
                className={`p-1 rounded transition-all ${chartOrientation === "v"
                  ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                  : "text-slate-500"
                  }`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2"
                  />
                </svg>
              </button>
              <button
                onClick={() => setChartOrientation("h")}
                title="Horizontal View"
                className={`p-1 rounded transition-all ${chartOrientation === "h"
                  ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                  : "text-slate-500"
                  }`}
              >
                <svg
                  className="w-4 h-4 rotate-90"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {tvsProcessedQuestions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] text-center p-8">
            <div className="p-4 bg-slate-50 dark:bg-gray-800/50 rounded-full mb-4">
              <CheckCircle className="w-12 h-12 text-indigo-500 opacity-50" />
            </div>
            <h4 className="text-slate-900 dark:text-white font-bold mb-1">
              No TVS Reviews Found
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
              No TVS performance reviews were found for your current selection.
            </p>
          </div>
        ) : (
          <div
            className={chartOrientation === "h" ? "overflow-y-auto" : "w-full"}
          >
            <div style={containerStyle} id="tvs-issue-percentage-chart">
              <Bar data={data} options={options} />
            </div>
          </div>
        )}
      </div>
    );
  };

  const TimeBasedPerformanceGraph = () => {
    const timeData = useMemo(() => {
      if (timeSeriesView === "monthly") {
        return computeMonthlyPerformanceStats(
          trendChartResponses,
          responseStatuses,
          dateFilter.startDate,
          dateFilter.endDate,
        );
      }
      return computeDailyPerformanceStats(
        trendChartResponses,
        responseStatuses,
        dateFilter.startDate,
        dateFilter.endDate,
      );
    }, [
      trendChartResponses,
      responseStatuses,
      timeSeriesView,
      dateFilter.startDate,
      dateFilter.endDate,
    ]);

    if (timeData.length === 0) return null;

    const data = {
      labels: timeData.map((s) => s.date),
      datasets: [
        {
          label: "Total Responses",
          data: timeData.map((s) => s.totalResponses),
          borderColor: "rgb(55, 65, 81)", // Dark Gray
          backgroundColor: "rgba(55, 65, 81, 0.1)",
          borderWidth: 3,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: "rgb(55, 65, 81)",
          fill: true,
          datalabels: {
            color: darkMode ? "#e5e7eb" : "#374151",
            align: "top" as const,
            offset: 4,
            font: { weight: "bold" as const, size: 10 },
            formatter: (value: number) => (value > 0 ? value : ""),
          },
        },
        {
          label: "Rework Received",
          data: timeData.map((s) => s.reworkCount),
          borderColor: "rgb(153, 27, 27)", // Dark Red
          backgroundColor: "rgba(153, 27, 27, 0.1)",
          borderWidth: 3,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: "rgb(153, 27, 27)",
          fill: true,
          datalabels: {
            color: "rgb(153, 27, 27)",
            align: "bottom" as const,
            offset: 4,
            font: { weight: "bold" as const, size: 10 },
            formatter: (value: number) => (value > 0 ? value : ""),
          },
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: {
            color: darkMode ? "#e5e7eb" : "#374151",
            font: { size: 11, weight: "bold" as const },
            usePointStyle: true,
            padding: 20,
          },
        },
        tooltip: {
          mode: "nearest" as const,
          intersect: true,
          backgroundColor: darkMode ? "#1f2937" : "#ffffff",
          titleColor: darkMode ? "#ffffff" : "#111827",
          bodyColor: darkMode ? "#d1d5db" : "#374151",
          borderColor: darkMode ? "#374151" : "#e5e7eb",
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
        },
        datalabels: {
          display: true,
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: darkMode ? "#e5e7eb" : "#374151",
            font: { size: 10, weight: "500" as const },
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            color: darkMode ? "#9ca3af" : "#6b7280",
            font: { size: 10 },
          },
          grid: {
            color: darkMode
              ? "rgba(255, 255, 255, 0.05)"
              : "rgba(0, 0, 0, 0.03)",
          },
        },
      },
      interaction: {
        mode: "nearest" as const,
        intersect: true,
        axis: "x" as const,
      },
    };

    return (
      <div
        id="performance-trend-chart"
        className="p-6 bg-gradient-to-br from-white to-slate-50 dark:from-gray-800 dark:to-gray-900 flex flex-col h-full rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow w-full mt-6"
      >
        <div
          data-pdf-hide="true"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
        >
          <div className="flex items-center">
            <div className="p-2 bg-gradient-to-br from-slate-700 to-red-600 rounded-lg mr-2">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                Performance Trend
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Total responses received vs total rework received over time
                (Response-wise)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-100 dark:bg-gray-700 p-1 rounded-lg">
              <button
                onClick={() => setTimeSeriesView("daily")}
                className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${timeSeriesView === "daily"
                  ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                  : "text-slate-500"
                  }`}
              >
                DAILY
              </button>
              <button
                onClick={() => setTimeSeriesView("monthly")}
                className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${timeSeriesView === "monthly"
                  ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                  : "text-slate-500"
                  }`}
              >
                MONTHLY
              </button>
            </div>
          </div>
        </div>
        <div style={{ height: "400px", position: "relative" }}>
          <Line data={data} options={options} />
        </div>
      </div>
    );
  };

  const InspectorPerformanceChart = () => {
    const currentUserScore = performanceScores[user?._id || ""] || 100;
    const circumference = 2 * Math.PI * 45; // radius = 45
    const strokeDasharray = circumference;
    const strokeDashoffset =
      circumference - (currentUserScore / 100) * circumference;

    return (
      <div className="card p-6">


      </div>
    );
  };

  const DirectAcceptedPerformanceGraph = () => {
    const timeData = useMemo(() => {
      return computeDirectAcceptedDailyStats(
        dateFilteredResponses,
        responseStatuses,
        dateFilter.startDate,
        dateFilter.endDate,
      );
    }, [
      dateFilteredResponses,
      responseStatuses,
      dateFilter.startDate,
      dateFilter.endDate,
    ]);

    if (timeData.length === 0) return null;

    const data = {
      labels: timeData.map((s) => s.date),
      datasets: [
        {
          label: "Direct",
          data: timeData.map((s) => s.directCount),
          backgroundColor: "rgba(34, 197, 94, 0.7)", // Green-500
          borderColor: "rgb(21, 128, 61)", // Green-700
          borderWidth: 1,
          stack: "stack1",
        },
        {
          label: "Rework",
          data: timeData.map((s) => s.reworkCount),
          backgroundColor: "rgba(234, 179, 8, 0.7)", // Yellow-500
          borderColor: "rgb(161, 98, 7)", // Yellow-700
          borderWidth: 1,
          stack: "stack1",
        },
        {
          label: "Rework Completed",
          data: timeData.map((s) => s.reworkCompletedCount),
          backgroundColor: "rgba(59, 130, 246, 0.7)", // Blue-500
          borderColor: "rgb(29, 78, 216)", // Blue-700
          borderWidth: 1,
          stack: "stack1",
        },
        {
          label: "Rejected",
          data: timeData.map((s) => s.rejectedCount),
          backgroundColor: "rgba(239, 68, 68, 0.7)", // Red-500
          borderColor: "rgb(185, 28, 28)", // Red-700
          borderWidth: 1,
          stack: "stack1",
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,

      plugins: {
        legend: {
          display: true,
          position: "top" as const,
          labels: {
            color: darkMode ? "#e5e7eb" : "#374151",
            font: { size: 10, weight: "bold" as const },
            padding: 10,
            usePointStyle: true,
          },
        },

        tooltip: {
          mode: "nearest" as const,
          intersect: true,
          callbacks: {
            label: (context: any) => {
              const datasetLabel = context.dataset.label;
              const value = context.raw;
              return `${datasetLabel}: ${value}`;
            },
          },
        },

        datalabels: {
          display: (context: any) =>
            context.dataset.data[context.dataIndex] > 0,
          color: "#fff",
          font: { weight: "bold" as const, size: 9 },
          formatter: (value: number) => value,
        },
      },
      scales: {
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            color: darkMode ? "#9ca3af" : "#6b7280",
          },
          grid: {
            color: darkMode
              ? "rgba(255, 255, 255, 0.05)"
              : "rgba(0, 0, 0, 0.03)",
          },
        },
        x: {
          stacked: true,
          ticks: {
            color: darkMode ? "#9ca3af" : "#6b7280",
          },
          grid: {
            display: false,
          },
        },
      },
    };

    return (
      <div
        id="inspection-status-distribution-chart"
        className="p-6 bg-gradient-to-br from-white to-slate-50 dark:from-gray-800 dark:to-gray-900 flex flex-col h-full rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow w-full mt-6"
      >
        <div
          data-pdf-hide="true"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
        >
          <div className="flex items-center">
            <div
              className={`p-2 bg-gradient-to-br from-blue-600 to-indigo-800 rounded-lg mr-2`}
            >
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                Inspection Status Trend
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Daily distribution of inspection outcomes (counts)
              </p>
            </div>
          </div>
        </div>
        <div style={{ height: "400px", position: "relative" }}>
          <Bar data={data} options={options} />
        </div>
      </div>
    );
  };

  const InspectionStatusLineChart = () => {
    const timeData = useMemo(() => {
      return computeDailyReworkVolumeStats(
        form,
        dateFilteredResponses,
        dateFilter.startDate,
        dateFilter.endDate,
      );
    }, [form, dateFilteredResponses, dateFilter.startDate, dateFilter.endDate]);

    if (timeData.length === 0) return null;

    const data = {
      labels: timeData.map((s) => s.date),
      datasets: [
        {
          label: "Rework",
          data: timeData.map((s) => s.reworkCount),
          borderColor: "rgb(234, 179, 8)", // Yellow-500
          backgroundColor: "rgba(234, 179, 8, 0.3)",
          borderWidth: 1,
          fill: true,
          tension: 0,
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          mode: "nearest" as const,
          intersect: true,
          callbacks: {
            label: (context: any) => {
              const label = context.dataset.label;
              const value = context.raw;
              return `${label}: ${value}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            color: darkMode ? "#9ca3af" : "#6b7280",
          },
          grid: {
            color: darkMode
              ? "rgba(255, 255, 255, 0.05)"
              : "rgba(0, 0, 0, 0.03)",
          },
        },
        x: {
          ticks: {
            color: darkMode ? "#9ca3af" : "#6b7280",
          },
          grid: {
            display: false,
          },
        },
      },
    };

    return (
      <div
        id="status-trends-rework-chart"
        className="p-6 bg-gradient-to-br from-white to-slate-50 dark:from-gray-800 dark:to-gray-900 flex flex-col h-full rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow w-full mt-6"
      >
        <div
          data-pdf-hide="true"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
        >
          <div className="flex items-center">
            <div
              className={`p-2 bg-gradient-to-br from-purple-600 to-indigo-800 rounded-lg mr-2`}
            >
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                Inspection Status Trends For REWORK
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Daily Rework Volume (Sum of question-level reworks)
              </p>
            </div>
          </div>
        </div>
        <div style={{ height: "400px", position: "relative" }}>
          <Line data={data} options={options} />
        </div>
      </div>
    );
  };

  const getSectionAnalyticsData = (): SectionAnalyticsData[] => {
    if (!form?.sections || !form.sections.length) {
      return [];
    }

    const map = new Map<string, number>();
    responses.forEach((response) => {
      if (response.answers) {
        Object.keys(response.answers).forEach((qId) => {
          const answer = response.answers[qId];
          if (answer !== null && answer !== undefined && answer !== "") {
            map.set(qId, (map.get(qId) || 0) + 1);
          }
        });
      }
    });

    return form.sections
      .map((section) => {
        const stats = getSectionStats(section, responses, map);
        const qualityBreakdown = getSectionQualityBreakdown(section, responses);
        const overallQuality = calculateOverallQuality(qualityBreakdown);

        return {
          sectionId: section.id,
          sectionTitle: section.title,
          description: section.description,
          stats: {
            mainQuestionCount: stats.mainQuestionCount,
            totalFollowUpCount: stats.totalFollowUpCount,
            answeredMainQuestions: stats.answeredMainQuestions,
            answeredFollowUpQuestions: stats.answeredFollowUpQuestions,
            totalAnswered: stats.totalAnswered,
            totalResponses: stats.totalResponses,
            completionRate: stats.completionRate,
            avgResponsesPerQuestion: stats.avgResponsesPerQuestion,
            questionsDetail: stats.questionsDetail || [],
          },
          qualityBreakdown,
          overallQuality,
        };
      })
      .filter((section) => section.stats.questionsDetail.length > 0);
  };

  const fullAnalyticsData = useMemo(() => {
    if (analyticsView === "responses") {
      return null as any;
    }
    return {
      total: analytics.total,
      pending: analytics.pending,
      verified: analytics.verified,
      rejected: analytics.rejected,
      inspectionStats: inspectionStats,
      sectionSummaryRows: sectionSummaryRows,
      totalPieChartData: totalPieChartData,
      sectionAnalyticsData: getSectionAnalyticsData(),
      inspectorSummary: filteredInspectorSummary,
      summaryStatuses: summaryStatuses,
      performanceTableData: performanceTableData,
      defectStartDate: dateFilter.startDate,
      defectEndDate: dateFilter.endDate,
    };
  }, [
    analytics,
    inspectionStats,
    sectionSummaryRows,
    totalPieChartData,
    inspectorSummary,
    summaryStatuses,
    performanceTableData,
    dateFilter.startDate,
    dateFilter.endDate,
    form,
    responses,
  ]);

  const handleExportToPDF = async () => {
    try {
      setIsExporting(true);
      showToast("Generating PDF report...", "info");

      const success = await exportDashboardToPDF(
        form?.title || "Form Analytics",
        fullAnalyticsData,
        analyticsView === "section",
      );

      if (success) {
        showToast("PDF report generated successfully!", "success");
      } else {
        showToast("Failed to generate PDF. Please try again.", "error");
      }
    } catch (error) {
      console.error("Error downloading PDF:", error);
      showToast("Failed to generate PDF. Please try again.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportToExcel = async () => {
    if (isExporting) return;
    try {
      setIsExporting(true);
      showToast("Preparing Excel report...", "info");

      let rowsToExport: Response[] = [];

      // 1. Check if user has explicitly selected rows via checkboxes
      if (selectedResponseIds.length > 0) {
        const idSet = new Set(selectedResponseIds);
        const pool = [...responses, ...tableResponses];
        const seen = new Set<string>();
        rowsToExport = pool.filter((r) => {
          const rId = r.id || (r as any)._id;
          if (rId && idSet.has(rId) && !seen.has(rId)) {
            seen.add(rId);
            return true;
          }
          return false;
        });
      } else {
        // 2. No explicit selection - check if full background streaming is 100% complete
        const isStreamingComplete =
          responses.length > 0 &&
          totalResponsesCount > 0 &&
          responses.length >= totalResponsesCount &&
          !analyticsResponsesLoading;

        let fullResponses: Response[] = [];

        if (isStreamingComplete) {
          fullResponses = responses;
        } else {
          showToast("Fetching complete response dataset for export...", "info");
          const exportParams: {
            status?: string;
            startDate?: string;
            endDate?: string;
            batchId?: string;
            uploadOnly?: boolean;
            forceNetwork?: boolean;
          } = {
            forceNetwork: true,
          };

          if (dateFilter.type !== "all") {
            if (dateFilter.startDate) exportParams.startDate = dateFilter.startDate;
            if (dateFilter.endDate) exportParams.endDate = dateFilter.endDate;
          }

          if (selectedBatchId) {
            exportParams.batchId = selectedBatchId;
          } else if (isUploadOnlyFiltered) {
            exportParams.uploadOnly = true;
          }

          const fetched = await apiClient.getAllResponsesForExport(id!, exportParams);
          fullResponses = fetched || [];
        }

        // Apply filters
        rowsToExport = fullResponses;

        // Global Date Filter
        if (dateFilter.type !== "all") {
          rowsToExport = rowsToExport.filter((response) => {
            const timestamp = getResponseTimestamp(response);
            if (!timestamp) return false;
            const responseDate = toLocalDateString(timestamp);

            if (dateFilter.type === "single" && dateFilter.startDate) {
              return responseDate === dateFilter.startDate;
            } else if (dateFilter.type === "range") {
              if (dateFilter.startDate && dateFilter.endDate) {
                return (
                  responseDate >= dateFilter.startDate &&
                  responseDate <= dateFilter.endDate
                );
              } else if (dateFilter.startDate) {
                return responseDate >= dateFilter.startDate;
              } else if (dateFilter.endDate) {
                return responseDate <= dateFilter.endDate;
              }
            }
            return true;
          });
        }

        // Upload/Batch Filter
        if (selectedBatchId) {
          rowsToExport = rowsToExport.filter(
            (r) => (r as any).batchId === selectedBatchId
          );
        } else if (isUploadOnlyFiltered) {
          rowsToExport = rowsToExport.filter(
            (r) =>
              (r as any).batchId ||
              r.submittedBy === "Excel Import" ||
              (r as any).submissionMetadata?.source === "excel_import"
          );
        }
      }

      if (!rowsToExport || rowsToExport.length === 0) {
        showToast("No responses found to export.", "warning");
        setIsExporting(false);
        return;
      }

      // Global Inspector Filter
      if (selectedInspectorForTrend !== "Overall") {
        rowsToExport = rowsToExport.filter(
          (response) => response.submittedBy === selectedInspectorForTrend
        );
      }

      // Overall search term filter
      const term = (responsesSearchTerm || deferredSearchTerm).toLowerCase().trim();
      if (term !== "") {
        rowsToExport = rowsToExport.filter((response) => {
          const submitter = (response.submittedBy || response.createdBy || "").toLowerCase();
          if (submitter.includes(term)) return true;

          const status = (responseStatuses[response.id] || "").toLowerCase();
          if (status.includes(term)) return true;

          const chVal = response.answers?.chassis_number;
          if (chVal) {
            if (typeof chVal === "object") {
              if (chVal.chassisNumber && String(chVal.chassisNumber).toLowerCase().includes(term)) return true;
              if (chVal.partDescription && String(chVal.partDescription).toLowerCase().includes(term)) return true;
            } else if (String(chVal).toLowerCase().includes(term)) {
              return true;
            }
          }

          if (response.answers) {
            for (const [key, val] of Object.entries(response.answers)) {
              if (val === null || val === undefined) continue;
              if (typeof val === "object") {
                if (JSON.stringify(val).toLowerCase().includes(term)) return true;
              } else {
                if (String(val).toLowerCase().includes(term)) return true;
              }
            }
          }
          return false;
        });
      }

      // Column filters
      const activeColFilters = Object.entries(columnFilters).filter(
        ([_, values]) => values && values.length > 0
      );
      if (activeColFilters.length > 0) {
        rowsToExport = rowsToExport.filter((response) =>
          activeColFilters.every(([columnId, allowedValues]) =>
            matchSingleColumnFilter(response, columnId, allowedValues || [])
          )
        );
      }

      // Sort
      if (tableSort) {
        rowsToExport = sortResponses(rowsToExport);
      }

      const headerRow: any[] = [
        "Timestamp",
        "Submitted By",
        "Status",
        "Chassis Number",
        "Dispatched",
        "Dispatched At",
      ];
      const columnInfo: Array<{
        questionId: string;
        isFollowUp: boolean;
        correctAnswer?: any;
      }> = [];

      form?.sections?.forEach((section: Section) => {
        if (selectedResponsesSectionIds.includes(section.id)) {
          section.questions?.forEach((q: any) => {
            const isFollowUp = q.parentId || q.showWhen?.questionId;
            headerRow.push(q.text || "Question");
            columnInfo.push({
              questionId: q.id,
              isFollowUp: !!isFollowUp,
              correctAnswer: q.correctAnswer,
            });
          });
        }
      });

      const wsData: any[][] = [headerRow];

      rowsToExport.forEach((response: Response) => {
        let statusVal =
          tableDisplayStatuses[response.id] ||
          responseStatuses[response.id] ||
          responseStatuses[(response as any)._id];

        if (!statusVal || statusVal === "-") {
          if (response.answers) {
            let isRework = false;
            let isAccepted = false;
            let isRejected = false;
            Object.values(response.answers).forEach((ans) => {
              if (typeof ans === "object" && ans !== null && (ans as any).status) {
                const s = String((ans as any).status).toLowerCase().trim();
                if (s === "rework" || s === "reworked" || s.includes("re-rework")) {
                  isRework = true;
                } else if (s === "accepted" || s === "rework completed" || s === "verified" || s === "yes" || s === "y") {
                  isAccepted = true;
                } else if (s === "rejected" || s === "no" || s === "n") {
                  isRejected = true;
                }
              }
            });
            if (isRework) statusVal = "Rework 1";
            else if (isAccepted) statusVal = "Direct Ok";
            else if (isRejected) statusVal = "Rejected";
          }
        }
        if (!statusVal) statusVal = response.status || "-";

        const rowData: any[] = [
          getResponseTimestamp(response)
            ? formatToDDMMYYYY(getResponseTimestamp(response)!)
            : "-",
          response.submittedBy || response.createdBy || "Anonymous",
          statusVal,
          getResponseChassisValue(response),
          response.isDispatched ? "Yes" : "No",
          response.dispatchedAt
            ? formatToDDMMYYYY(response.dispatchedAt, true)
            : "-",
        ];

        columnInfo.forEach(({ questionId }) => {
          const answer = response.answers?.[questionId];
          let answerStr = "-";
          if (answer !== undefined && answer !== null) {
            if (typeof answer === "object") {
              if (answer.status) {
                answerStr = answer.status;
              } else {
                answerStr = JSON.stringify(answer);
              }
            } else {
              answerStr = String(answer);
            }
          }
          rowData.push(answerStr);
        });

        wsData.push(rowData);
      });

      // Add Overall Inspection Statistics Summary Rows
      const statsHeaderRow: any[] = [
        "Overall Inspection Statistics",
        "",
        "",
        "",
      ];
      const statsDataRow: any[] = [
        `Total Accepted: ${inspectionStats.accepted}`,
        `Total Rejected: ${inspectionStats.rejected}`,
        `Total Reworked: ${inspectionStats.reworked}`,
        ``,
      ];

      wsData.push([]); // Empty spacing row
      const statsHeaderIdx = wsData.length;
      wsData.push(statsHeaderRow);
      const statsDataIdx = wsData.length;
      wsData.push(statsDataRow);

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      const headerFill = { fgColor: { rgb: "FF4F46E5" } };
      const headerFont = { color: { rgb: "FFFFFFFF" }, bold: true };

      // Style Header Row
      for (let i = 0; i < headerRow.length; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
        if (ws[cellRef]) {
          ws[cellRef].s = {
            fill: headerFill,
            font: headerFont,
            alignment: {
              horizontal: "center",
              vertical: "center",
              wrapText: true,
            },
            border: {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            },
          };
        }
      }

      // Style Common Answer Row if present
      for (let i = 0; i < headerRow.length; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: 1, c: i });
        if (ws[cellRef]) {
          ws[cellRef].s = {
            fill: { fgColor: { rgb: "FFF3F4F6" } },
            font: { italic: true, bold: i === 0 },
            alignment: {
              horizontal: i === 0 ? "left" : "center",
              vertical: "center",
              wrapText: true,
            },
            border: {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            },
          };
        }
      }

      // Style response rows
      const lastResponseRowIdx = rowsToExport.length + 1;
      for (let rowIdx = 1; rowIdx < lastResponseRowIdx; rowIdx++) {
        const response = rowsToExport[rowIdx - 1];

        // Style Timestamp column
        const timeCellRef = XLSX.utils.encode_cell({ r: rowIdx, c: 0 });
        if (ws[timeCellRef]) {
          ws[timeCellRef].s = {
            fill: { fgColor: { rgb: "FFF9FAFB" } },
            font: { bold: false },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            },
          };
        }

        // Style Submitted By column
        const submittedByCellRef = XLSX.utils.encode_cell({ r: rowIdx, c: 1 });
        if (ws[submittedByCellRef]) {
          ws[submittedByCellRef].s = {
            fill: { fgColor: { rgb: "FFF9FAFB" } },
            font: { bold: false },
            alignment: { horizontal: "left", vertical: "center" },
            border: {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            },
          };
        }

        // Style Status column
        const statusCellRef = XLSX.utils.encode_cell({ r: rowIdx, c: 2 });
        const currentStatus =
          tableDisplayStatuses[response.id] ||
          responseStatuses[response.id] ||
          response.status ||
          "-";
        let statusBgColor = "FFF9FAFB"; // Default

        if (
          currentStatus === "Direct Ok" ||
          currentStatus === "Rework Accepted" ||
          currentStatus === "Accepted"
        ) {
          statusBgColor = "FFDCFCE7"; // green-100
        } else if (currentStatus.includes("Rework")) {
          statusBgColor = "FFFEF3C7"; // amber-100
        } else if (currentStatus === "Rejected") {
          statusBgColor = "FFFEE2E2"; // red-100
        }

        if (ws[statusCellRef]) {
          ws[statusCellRef].s = {
            fill: { fgColor: { rgb: statusBgColor } },
            font: { bold: true },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            },
          };
        }

        // Style Chassis Number column
        const chassisCellRef = XLSX.utils.encode_cell({ r: rowIdx, c: 3 });
        if (ws[chassisCellRef]) {
          ws[chassisCellRef].s = {
            fill: { fgColor: { rgb: "FFF9FAFB" } },
            font: { bold: false },
            alignment: { horizontal: "left", vertical: "center" },
            border: {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            },
          };
        }

        // Style Question columns
        for (let colIdx = 0; colIdx < columnInfo.length; colIdx++) {
          const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx + 4 });
          const info = columnInfo[colIdx];
          const bgColor = info.isFollowUp ? "FFE9D5FF" : "FFFFFFFF";

          if (ws[cellRef]) {
            ws[cellRef].s = {
              fill: { fgColor: { rgb: bgColor } },
              alignment: { vertical: "center", wrapText: true },
              border: {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" },
              },
            };
          }
        }
      }

      // Style Stats Header Row
      for (let i = 0; i < 4; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: statsHeaderIdx, c: i });
        if (ws[cellRef]) {
          ws[cellRef].s = {
            fill: { fgColor: { rgb: "FF4F46E5" } },
            font: { color: { rgb: "FFFFFFFF" }, bold: true },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
              top: { style: "medium" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            },
          };
        }
      }

      // Style Stats Data Row
      for (let i = 0; i < 4; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: statsDataIdx, c: i });
        if (ws[cellRef]) {
          ws[cellRef].s = {
            fill: { fgColor: { rgb: "FFE0E7FF" } },
            font: { bold: true, color: { rgb: "FF3730A3" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "medium" },
              right: { style: "thin" },
            },
          };
        }
      }

      ws["!cols"] = [
        { wch: 22 }, // Timestamp
        { wch: 25 }, // Submitted By
        { wch: 15 }, // Status
        { wch: 18 }, // Chassis Number
        ...columnInfo.map(() => ({ wch: 35 })),
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Responses");
      XLSX.writeFile(
        wb,
        `${form?.title || "responses"}-${new Date().toLocaleDateString("en-CA")}.xlsx`,
      );
      showToast(`Exported ${rowsToExport.length} responses to Excel successfully!`, "success");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      showToast("Failed to export to Excel. Please try again.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleViewDetails = (response: Response) => {
    const responseId = response._id || response.id;
    console.log("Navigating to response:", responseId);
    navigate(`/responses/${responseId}`);
  };



  const handleEditResponse = (response: Response) => {
    const responseId = response.id || response._id;
    navigate(`/responses/${responseId}/edit-form`);
  };

  const handleOpenModal = async (response: Response) => {
    try {
      const formIdentifier = response.questionId;
      if (!formIdentifier) {
        throw new Error("Missing form identifier for response");
      }
      const formData = await apiClient.getForm(formIdentifier);
      const formDetails = formData.form;
      setSelectedResponse(response);
      setSelectedFormForModal(formDetails);
    } catch (err) {
      console.error("Failed to load form for modal:", err);
      showToast("Failed to load form. Please try again.", "error");
    }
  };

  const handleEditStart = (response: Response) => {
    setEditingResponseId(response.id);
    setEditFormData({ ...response.answers });
    setEditFormStatus(response.status || "Accepted");
    setEditFormNotes(response.notes || "");
  };

  const handleSaveEdit = async () => {
    if (!editingResponseId) return;

    try {
      setIsSaving(true);
      await apiClient.updateResponse(editingResponseId, {
        answers: editFormData,
        status: editFormStatus,
        notes: editFormNotes,
      });

      setResponses(
        responses.map((r) =>
          r.id === editingResponseId
            ? {
              ...r,
              answers: editFormData,
              status: editFormStatus,
              notes: editFormNotes,
            }
            : r,
        ),
      );

      setTableResponses((prev) =>
        prev.map((r) =>
          r.id === editingResponseId
            ? {
              ...r,
              answers: editFormData,
              status: editFormStatus,
              notes: editFormNotes,
            }
            : r,
        ),
      );

      setEditingResponseId(null);
      setEditFormData({});
      setEditFormStatus("Accepted");
      setEditFormNotes("");
      showToast("Response updated successfully!", "success");
    } catch (err) {
      console.error("Error updating response:", err);
      showToast("Failed to update response. Please try again.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingResponseId(null);
    setEditFormData({});
    setEditFormStatus("Accepted");
    setEditFormNotes("");
  };

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "success",
  ) => {
    const id = Date.now().toString();
    setToast({ message, type, id });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };
  const [isDashboardRefreshing, setIsDashboardRefreshing] = useState(false);
  const refreshDashboardData = async () => {
    setIsDashboardRefreshing(true);
    try {
      // Clear only the relevant cache entries
      try {
        const cacheKeys = Object.keys(localStorage).filter(key =>
          key.startsWith("api_cache:") && (
            key.includes("/analytics/inspector-summary") ||
            key.includes("/analytics/performance-table") ||
            key.includes("/responses/form/") ||
            key.includes("/responses/reviews/bulk")
          )
        );
        cacheKeys.forEach(key => localStorage.removeItem(key));
      } catch (_) { }

      // Refresh all dashboard data
      await Promise.all([
        fetchFullAnalyticsResponses(),
        fetchPerformanceTable(),
        fetchSummary()
      ]);

      showToast("Dashboard refreshed successfully!", "success");
    } catch (error) {
      console.error("Refresh failed:", error);
      showToast("Failed to refresh dashboard", "error");
    } finally {
      setIsDashboardRefreshing(false);
    }
  };

  const handleDeleteResponse = async () => {
    if (!deletingResponseId) return;

    try {
      setIsDeleting(true);
      await apiClient.deleteResponse(deletingResponseId);

      setResponses(responses.filter((r) => r.id !== deletingResponseId));

      setShowDeleteConfirm(false);
      setDeletingResponseId(null);
      showToast("Response deleted successfully!", "success");
    } catch (err) {
      console.error("Error deleting response:", err);
      showToast("Failed to delete response. Please try again.", "error");
    } finally {
      setIsDeleting(false);
    }
  };
  const PerformanceTableBarChart = () => {
    if (performanceTableData.length === 0) return null;

    // Get the top 10 performers by total submitted
    const sortedData = [...performanceTableData]
      .sort((a, b) => (b.totalSubmitted || 0) - (a.totalSubmitted || 0))
      .slice(0, 10);

    const data = {
      labels: sortedData.map(row => row.name?.length > 15 ? row.name.substring(0, 15) + "..." : row.name),
      datasets: [
        {
          label: "Accepted",
          data: sortedData.map(row => row.accepted || 0),
          backgroundColor: "rgba(34, 197, 94, 0.7)", // Green
          borderColor: "rgb(21, 128, 61)",
          borderWidth: 1,
          stack: "stack1",
        },
        {
          label: "Rejected",
          data: sortedData.map(row => row.rejectedReview || row.rejected || 0),
          backgroundColor: "rgba(239, 68, 68, 0.7)", // Red
          borderColor: "rgb(185, 28, 28)",
          borderWidth: 1,
          stack: "stack1",
        },
        {
          label: "Reworked",
          data: sortedData.map(row => row.reworked || 0),
          backgroundColor: "rgba(234, 179, 8, 0.7)", // Yellow
          borderColor: "rgb(161, 98, 7)",
          borderWidth: 1,
          stack: "stack1",
        },
      ],
    };
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top" as const,
          labels: {
            color: darkMode ? "#e5e7eb" : "#374151",
            font: { size: 10, weight: "bold" as const },
            padding: 10,
            usePointStyle: true,
          },
        },
        tooltip: {
          mode: "nearest" as const,
          intersect: true,
          callbacks: {
            label: (context: any) => {
              const datasetLabel = context.dataset.label;
              const value = context.raw;
              return `${datasetLabel}: ${value}`;
            },
          },
        },
        datalabels: {
          display: (context: any) => context.dataset.data[context.dataIndex] > 0,
          color: "#fff",
          font: { weight: "bold" as const, size: 9 },
          formatter: (value: number) => value,
        },
      },
      scales: {
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            color: darkMode ? "#9ca3af" : "#6b7280",
          },
          grid: {
            color: darkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)",
          },
        },
        x: {
          stacked: true,
          ticks: {
            color: darkMode ? "#9ca3af" : "#6b7280",
            font: { size: 9 },
            maxRotation: 45,
            minRotation: 0,
          },
          grid: {
            display: false,
          },
        },
      },
    };

    return (
      <div
        id="performance-table-chart"
        className="p-6 bg-gradient-to-br from-white to-slate-50 dark:from-gray-800 dark:to-gray-900 flex flex-col h-full rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow w-full mt-6"
      >
        <div
          data-pdf-hide="true"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
        >
          <div className="flex items-center">
            <div className="p-2 bg-gradient-to-br from-emerald-600 to-teal-800 rounded-lg mr-2">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                Performance Table - Inspector Metrics
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Top 10 inspectors by submission volume
              </p>
            </div>
          </div>
        </div>
        <div style={{ height: "400px", position: "relative" }}>
          <Bar data={data} options={options} />
        </div>
      </div>
    );
  };
  const BiwReviewTableBarChart = () => {
    if (biwReviewTableData.length === 0) return null;

    // ✅ STEP 1: Filter out inspectors who have ALL zeros (Accepted, Rejected, Reworked are all 0)
    const filteredData = biwReviewTableData.filter((row) => {
      const accepted = row.accepted || 0;
      const rejected = row.rejected || 0;
      const rework = row.rework || 0;
      // Only keep if at least one value is > 0
      return accepted > 0 || rejected > 0 || rework > 0;
    });

    // ✅ STEP 2: If after filtering there's no data, return null (hide the chart)
    if (filteredData.length === 0) return null;

    // Get the top 10 by total submitted (from filtered data)
    const sortedData = [...filteredData]
      .sort((a, b) => (b.totalSubmitted || 0) - (a.totalSubmitted || 0))
      .slice(0, 10);

    const data = {
      labels: sortedData.map(row => row.name?.length > 15 ? row.name.substring(0, 15) + "..." : row.name),
      datasets: [
        {
          label: "Accepted",
          data: sortedData.map(row => row.accepted || 0),
          backgroundColor: "rgba(34, 197, 94, 0.7)", // Green
          borderColor: "rgb(21, 128, 61)",
          borderWidth: 1,
          stack: "stack1",
          minBarLength: 0,
        },
        {
          label: "Rejected",
          data: sortedData.map(row => row.rejected || 0),
          backgroundColor: "rgba(239, 68, 68, 0.7)", // Red
          borderColor: "rgb(185, 28, 28)",
          borderWidth: 1,
          stack: "stack1",
          minBarLength: 0,
        },
        {
          label: "Reworked",
          data: sortedData.map(row => row.rework || 0),
          backgroundColor: "rgba(234, 179, 8, 0.7)", // Yellow
          borderColor: "rgb(161, 98, 7)",
          borderWidth: 1,
          stack: "stack1",
          minBarLength: 0,
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top" as const,
          labels: {
            color: darkMode ? "#e5e7eb" : "#374151",
            font: { size: 10, weight: "bold" as const },
            padding: 10,
            usePointStyle: true,
          },
        },
        tooltip: {
          mode: "nearest" as const,
          intersect: true,
          callbacks: {
            label: (context: any) => {
              const datasetLabel = context.dataset.label;
              const value = context.raw;
              return `${datasetLabel}: ${value}`;
            },
          },
        },
        datalabels: {
          // ✅ Show 0 values as well (display even when value is 0)
          display: (context: any) => true,
          color: "#fff",
          font: { weight: "bold" as const, size: 9 },
          formatter: (value: number) => value,
        },
      },
      scales: {
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            color: darkMode ? "#9ca3af" : "#6b7280",
          },
          grid: {
            color: darkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)",
          },
        },
        x: {
          stacked: true,
          ticks: {
            color: darkMode ? "#9ca3af" : "#6b7280",
            font: { size: 9 },
            maxRotation: 45,
            minRotation: 0,
          },
          grid: {
            display: false,
          },
        },
      },
    };

    return (
      <div
        id="biw-review-table-chart"
        className="p-6 bg-gradient-to-br from-white to-slate-50 dark:from-gray-800 dark:to-gray-900 flex flex-col h-full rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow w-full mt-6"
      >
        <div
          data-pdf-hide="true"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
        >
          <div className="flex items-center">
            <div className="p-2 bg-gradient-to-br from-purple-600 to-pink-800 rounded-lg mr-2">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                BIW Review Table - Inspector Metrics
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inspectors with BIW review activity
              </p>
            </div>
          </div>
        </div>
        <div style={{ height: "400px", position: "relative" }}>
          <Bar data={data} options={options} />
        </div>
      </div>
    );
  };
  const handleBulkDeleteResponses = async () => {
    if (selectedResponseIds.length === 0) return;

    try {
      setIsDeleting(true);

      for (const responseId of selectedResponseIds) {
        await apiClient.deleteResponse(responseId);
      }

      setResponses(
        responses.filter((r) => !selectedResponseIds.includes(r.id)),
      );
      setSelectedResponseIds([]);
      setShowBulkDeleteConfirm(false);
      showToast(
        `${selectedResponseIds.length} response(s) deleted successfully!`,
        "success",
      );
    } catch (err) {
      console.error("Error deleting responses:", err);
      showToast("Failed to delete some responses. Please try again.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleFormExpansion = (formTitle: string) => {
    setExpandedInspectorForms((prev) => {
      const next = new Set(prev);
      if (next.has(formTitle)) {
        next.delete(formTitle);
      } else {
        next.add(formTitle);
      }
      return next;
    });
  };

  const renderSummaryTable = () => {
    if (summaryLoading) {
      return (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">Loading summary...</p>
        </div>
      );
    }

    if (groupedInspectorSummary.length === 0) {
      return null;
    }

    // Derive unique shifts and inspectors for local filter dropdowns
    const allSummaryInspectors = Array.from(
      new Set(
        groupedInspectorSummary
          .flatMap((g: any) => g.subItems.map((i: any) => i.qcInspector))
          .filter(Boolean),
      ),
    ) as string[];
    const allSummaryShifts = Array.from(
      new Set(
        groupedInspectorSummary
          .flatMap((g: any) => g.subItems.map((i: any) => i.shift || "N/A"))
          .filter(Boolean),
      ),
    ) as string[];

    // Apply local filters to groupedInspectorSummary
    const localFilteredSummary = groupedInspectorSummary
      .map((group: any) => {
        const filteredSubItems = group.subItems.filter((row: any) => {
          const nameMatch =
            localFilterName === "All" || row.qcInspector === localFilterName;
          const shiftMatch =
            localFilterShift === "All" ||
            (row.shift || "N/A") === localFilterShift;
          const dateMatch =
            !localFilterDate ||
            (row.date &&
              new Date(row.date).toISOString().slice(0, 10) ===
              localFilterDate);
          return nameMatch && shiftMatch && dateMatch;
        });
        if (filteredSubItems.length === 0) return null;
        // Recalculate totals for filtered subItems
        const totalInspection = filteredSubItems.reduce(
          (sum: number, r: any) => sum + (r.totalInspection || 0),
          0,
        );
        const statusCounts: Record<string, number> = {};
        filteredSubItems.forEach((r: any) => {
          Object.entries(r.statusCounts || {}).forEach(([k, v]) => {
            statusCounts[k] = (statusCounts[k] || 0) + (v as number);
          });
        });
        return {
          ...group,
          subItems: filteredSubItems,
          totalInspection,
          statusCounts,
        };
      })
      .filter(Boolean);

    return (
      <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-2 h-8 bg-blue-600 rounded-full shadow-sm shadow-blue-500/20"></div>
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white leading-none mb-1">
                Inspection Summary
              </h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Real-time inspection data
                {dateFilter.startDate && dateFilter.endDate
                  ? ` (${new Date(dateFilter.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${new Date(dateFilter.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })})`
                  : dateFilter.startDate
                    ? ` (From ${new Date(dateFilter.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })})`
                    : dateFilter.endDate
                      ? ` (Until ${new Date(dateFilter.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })})`
                      : ""}
              </p>
            </div>
          </div>
          {/* Local filters for Inspection Summary & Performance Table */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={localFilterName}
              onChange={(e) => setLocalFilterName(e.target.value)}
              className="text-[10px] font-bold bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm"
            >
              <option value="All">All Inspectors</option>
              {allSummaryInspectors.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <select
              value={localFilterShift}
              onChange={(e) => setLocalFilterShift(e.target.value)}
              className="text-[10px] font-bold bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm"
            >
              <option value="All">All Shifts</option>
              {allSummaryShifts.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={localFilterDate}
              onChange={(e) => setLocalFilterDate(e.target.value)}
              className="text-[10px] font-bold bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm"
            />
            {(localFilterName !== "All" ||
              localFilterShift !== "All" ||
              localFilterDate) && (
                <button
                  onClick={() => {
                    setLocalFilterName("All");
                    setLocalFilterShift("All");
                    setLocalFilterDate("");
                  }}
                  className="text-[10px] font-bold text-red-500 hover:text-red-700 px-2 py-1.5 rounded-lg border border-red-200 hover:border-red-400 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  Clear
                </button>
              )}
          </div>
        </div>

        {(() => {
          // Flatten all subItems across all groups, then re-group by inspector name
          const allSubItems = localFilteredSummary.flatMap(
            (g: any) => g.subItems,
          );
          const inspectorMap = new Map<string, any[]>();
          allSubItems.forEach((row: any) => {
            const key = row.qcInspector || "Unknown";
            if (!inspectorMap.has(key)) inspectorMap.set(key, []);
            inspectorMap.get(key)!.push(row);
          });

          const inspectorGroups = Array.from(inspectorMap.entries()).map(
            ([inspector, rows]) => {
              const totalInspection = rows.reduce(
                (s: number, r: any) => s + (r.totalInspection || 0),
                0,
              );
              const statusCounts: Record<string, number> = {};
              rows.forEach((r: any) => {
                Object.entries(r.statusCounts || {}).forEach(([k, v]) => {
                  statusCounts[k] = (statusCounts[k] || 0) + (v as number);
                });
              });
              // Sort dates descending
              const sortedRows = [...rows].sort(
                (a: any, b: any) =>
                  new Date(b.date).getTime() - new Date(a.date).getTime(),
              );
              return {
                inspector,
                rows: sortedRows,
                totalInspection,
                statusCounts,
              };
            },
          );

          return (
            <div className="relative bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-none overflow-hidden">
              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-gray-50/80 dark:bg-gray-700/80 backdrop-blur-md sticky top-0 z-10 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-black tracking-[0.15em]">
                    <tr>
                      <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap">
                        QC Inspector
                      </th>
                      <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap">
                        Dates Active
                      </th>
                      <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center">
                        Total
                      </th>
                      {summaryStatuses.map((status) => (
                        <th
                          key={status}
                          className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center"
                        >
                          {status}
                        </th>
                      ))}
                      <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center">
                        History
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                    {inspectorGroups.map((ig, igIdx) => {
                      const expandKey = `inspector-${ig.inspector}`;
                      const isExpanded = expandedInspectorForms.has(expandKey);
                      const dateRange =
                        ig.rows.length > 1
                          ? `${new Date(ig.rows[ig.rows.length - 1].date).toLocaleDateString()} – ${new Date(ig.rows[0].date).toLocaleDateString()}`
                          : new Date(ig.rows[0].date).toLocaleDateString();

                      return (
                        <React.Fragment key={igIdx}>
                          {/* Inspector summary row */}
                          <tr
                            className={`transition-colors cursor-pointer ${isExpanded ? "bg-blue-50/50 dark:bg-blue-900/20" : "hover:bg-blue-50/30 dark:hover:bg-blue-900/10"}`}
                            onClick={() => toggleFormExpansion(expandKey)}
                          >
                            {/* Inspector name */}
                            <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-700 dark:text-blue-300 font-black text-[11px] shrink-0">
                                  {ig.inspector
                                    ?.split(" ")
                                    .map((n: string) => n[0])
                                    .join("")}
                                </div>
                                <span className="font-bold text-gray-800 dark:text-white text-sm">
                                  {ig.inspector}
                                </span>
                              </div>
                            </td>
                            {/* Date range summary */}
                            <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                                  {dateRange}
                                </span>
                                <span className="text-[10px] font-bold text-blue-500 dark:text-blue-400">
                                  {ig.rows.length} day
                                  {ig.rows.length > 1 ? "s" : ""}
                                </span>
                              </div>
                            </td>
                            {/* Total */}
                            <td className="px-4 sm:px-6 py-5 text-center">
                              <span className="text-base font-black text-gray-900 dark:text-white tabular-nums">
                                {ig.totalInspection}
                              </span>
                            </td>
                            {/* Status counts */}
                            {summaryStatuses.map((status) => {
                              const count = ig.statusCounts?.[status] || 0;
                              const isZero = count === 0;
                              return (
                                <td
                                  key={status}
                                  className={`px-4 sm:px-6 py-5 text-center font-black tabular-nums transition-opacity ${isZero
                                    ? "opacity-20 text-gray-400"
                                    : status === "Direct Ok" ||
                                      status === "Rework Accepted"
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : status.startsWith("Rework")
                                        ? "text-amber-600 dark:text-amber-400"
                                        : status === "Rejected"
                                          ? "text-rose-600 dark:text-rose-400"
                                          : "text-blue-600 dark:text-blue-400"
                                    }`}
                                >
                                  {count}
                                </td>
                              );
                            })}
                            {/* Expand toggle */}
                            <td className="px-4 sm:px-6 py-5 text-center">
                              <button className="p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-full transition-colors">
                                {isExpanded ? (
                                  <ChevronUp className="w-5 h-5" />
                                ) : (
                                  <ChevronDown className="w-5 h-5" />
                                )}
                              </button>
                            </td>
                          </tr>

                          {/* Date history rows */}
                          {isExpanded &&
                            ig.rows.map((row: any, rowIdx: number) => (
                              <tr
                                key={`${igIdx}-${rowIdx}`}
                                className="bg-gray-50/40 dark:bg-gray-900/20 border-l-4 border-l-blue-400"
                              >
                                <td className="px-4 sm:px-6 py-3 pl-16 whitespace-nowrap">
                                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                    —
                                  </span>
                                </td>
                                <td className="px-4 sm:px-6 py-3 whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold tabular-nums">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(row.date).toLocaleDateString(
                                      "en-US",
                                      {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      },
                                    )}
                                  </span>
                                </td>
                                <td className="px-4 sm:px-6 py-3 text-center">
                                  <span className="text-sm font-bold text-gray-600 dark:text-gray-300 tabular-nums">
                                    {row.totalInspection}
                                  </span>
                                </td>
                                {summaryStatuses.map((status) => {
                                  const count = row.statusCounts?.[status] || 0;
                                  const isZero = count === 0;
                                  return (
                                    <td
                                      key={status}
                                      className={`px-4 sm:px-6 py-3 text-center font-bold text-xs tabular-nums ${isZero ? "opacity-10 text-gray-400" : "opacity-70"}`}
                                    >
                                      {count}
                                    </td>
                                  );
                                })}
                                <td></td>
                              </tr>
                            ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  const renderPerformanceTable = () => {
    if (user?.role !== "admin" && user?.role !== "superadmin") return null;

    if (performanceTableLoading) {
      return (
        <div className="mt-12 text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">Loading performance data...</p>
        </div>
      );
    }

    if (performanceTableData.length === 0) return null;

    // Apply local name filter (still client-side since it's just a filter
    // over the current page, not a re-page)
    const localFilteredPerformance =
      localFilterName === "All"
        ? performanceTableData
        : performanceTableData.filter(
          (row: any) => row.name === localFilterName,
        );

    // Pagination is now server-side: `performanceTableData` already IS the
    // current page (the backend applies skip/limit), so we just render it
    // directly instead of re-slicing an in-memory array. `performanceHasMore`
    // (from the API response) tells us whether a "Next" page exists.
    const paginatedPerformance = localFilteredPerformance;
    const startIndex = (performancePage - 1) * performancePageSize;
    const endIndex = startIndex + paginatedPerformance.length;

    return (
      <div className="mt-12 border-t border-gray-100 dark:border-gray-700 pt-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-2 h-8 bg-purple-600 rounded-full shadow-sm shadow-purple-500/20"></div>
          <div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white leading-none mb-1">
              Performance Table
            </h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Form-specific inspector performance
            </p>
          </div>
        </div>

        <div className="relative bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-none overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-gray-50/80 dark:bg-gray-700/80 backdrop-blur-md sticky top-0 z-10 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-black tracking-[0.15em]">
                <tr>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap sticky left-0 z-20 bg-gray-50/80 dark:bg-gray-700/80">
                    User Name
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-green-600">
                    Direct Ok
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-blue-600">
                    Rework QC Completed
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-yellow-600">
                    Rework QC Pending
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-red-600">
                    Rejected
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-orange-600">
                    Dispatch Pending
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-purple-600">
                    Dispatched
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center">
                    Total Submitted
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center">
                    Total Reviewed
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center">
                    Review Pending
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-emerald-600">
                    Accepted
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-rose-600">
                    Rejected
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-amber-600">
                    Reworked
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center">
                    Performance Score
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {paginatedPerformance.map((row, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-purple-50/30 dark:hover:bg-purple-900/10 transition-colors"
                  >
                    <td className="px-4 sm:px-6 py-5 font-bold text-gray-900 dark:text-white whitespace-nowrap sticky left-0 z-10 bg-white dark:bg-gray-800">
                      {row.name}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-green-600 tabular-nums">
                      {row.directOk || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-blue-600 tabular-nums">
                      {row.reworkQcCompleted || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-yellow-600 tabular-nums">
                      {row.reworkQcPending || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-red-600 tabular-nums">
                      {row.rejected || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-orange-600 tabular-nums">
                      {row.dispatchPending || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-purple-600 tabular-nums">
                      {row.dispatched || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center tabular-nums">
                      {row.totalSubmitted || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center tabular-nums">
                      {row.totalReviewed || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-gray-500 tabular-nums">
                      {row.reviewPending || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-emerald-600 tabular-nums">
                      {row.accepted || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-rose-600 tabular-nums">
                      {row.rejectedReview || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-amber-600 tabular-nums">
                      {row.reworked || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-black tabular-nums shadow-sm ${row.performanceScore >= 80
                            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                            : row.performanceScore >= 50
                              ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                            }`}
                        >
                          {row.performanceScore || 0}%
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wide whitespace-nowrap ${getBiwPerformanceLabel(row.performanceScore).className
                            }`}
                        >
                          {getBiwPerformanceLabel(row.performanceScore).label}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination controls - server-driven (page/limit sent to the
              API, "Next" enabled by `hasMore` from the response since the
              backend no longer loads the full dataset to know a total). */}
          {(performancePage > 1 || performanceHasMore) && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-50 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Show
                </label>
                <select
                  value={performancePageSize}
                  onChange={(e) => {
                    setPerformancePageSize(Number(e.target.value));
                    setPerformancePage(1);
                  }}
                  className="px-3 py-1.5 text-xs font-bold border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all shadow-sm"
                >
                  {[5, 10, 20, 50].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {startIndex + 1}-{endIndex} · page {performancePage}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setPerformancePage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={performancePage === 1 || performanceTableLoading}
                  className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl disabled:opacity-30 transition-all hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="min-w-[32px] h-8 flex items-center justify-center text-[10px] font-black rounded-xl bg-purple-600 text-white shadow-lg shadow-purple-500/30 px-2">
                  {performancePage}
                </span>

                <button
                  onClick={() => setPerformancePage((prev) => prev + 1)}
                  disabled={!performanceHasMore || performanceTableLoading}
                  className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl disabled:opacity-30 transition-all hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderBiwReviewTable = () => {
    if (user?.role !== "admin" && user?.role !== "superadmin") return null;

    // ✅ STEP 1: Filter out users who have ALL zeros (Accepted, Rejected, Reworked are all 0)
    const filteredBiwData = biwReviewTableData.filter((row) => {
      const accepted = row.accepted || 0;
      const rejected = row.rejected || 0;
      const rework = row.rework || 0;
      // Only keep if at least one value is > 0
      return accepted > 0 || rejected > 0 || rework > 0;
    });

    // ✅ STEP 2: If no data after filtering, hide the entire table
    if (filteredBiwData.length === 0) return null;

    const localFilteredBiw =
      localFilterName === "All"
        ? filteredBiwData
        : filteredBiwData.filter(
          (row: any) => row.name === localFilterName,
        );

    // ✅ STEP 3: Check again after local filter
    if (localFilteredBiw.length === 0) return null;

    const totalBiwItems = localFilteredBiw.length;
    const totalBiwPages = Math.ceil(totalBiwItems / biwReviewPageSize);
    const biwStartIndex = (biwReviewPage - 1) * biwReviewPageSize;
    const biwEndIndex = biwStartIndex + biwReviewPageSize;
    const paginatedBiw = localFilteredBiw.slice(biwStartIndex, biwEndIndex);

    return (
      <div className="mt-12 border-t border-gray-100 dark:border-gray-700 pt-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-2 h-8 bg-purple-600 rounded-full shadow-sm shadow-purple-500/20"></div>
          <div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white leading-none mb-1">
              BIW Review Table
            </h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Performance based on BIW review checkmarks
            </p>
          </div>
        </div>

        <div className="relative bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-none overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-gray-50/80 dark:bg-gray-700/80 backdrop-blur-md sticky top-0 z-10 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-black tracking-[0.15em]">
                <tr>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap">
                    User Name
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center">
                    Total Submitted
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-blue-600">
                    Dispatched
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center">
                    Total Reviewed
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-green-600">
                    Accepted
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-red-600">
                    Rejected
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-orange-600">
                    Reworked
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center">
                    Performance Score
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {paginatedBiw.map((row, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-purple-50/30 dark:hover:bg-purple-900/10 transition-colors"
                  >
                    <td className="px-4 sm:px-6 py-5 font-bold text-gray-900 dark:text-white whitespace-nowrap">
                      {row.name}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center tabular-nums">
                      {row.totalSubmitted}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-blue-600 dark:text-blue-400 tabular-nums">
                      {row.dispatched || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center tabular-nums">
                      {row.totalReviewed}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-green-600 tabular-nums">
                      {row.accepted}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-red-600 tabular-nums">
                      {row.rejected}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-orange-600 tabular-nums">
                      {row.rework}
                    </td>
                    <td className="px-4 sm:px-6 py-5 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-black tabular-nums shadow-sm ${row.performanceScore >= 80
                            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                            : row.performanceScore >= 50
                              ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                            }`}
                        >
                          {row.performanceScore}%
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wide whitespace-nowrap ${getBiwPerformanceLabel(row.performanceScore).className}`}
                        >
                          {getBiwPerformanceLabel(row.performanceScore).label}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalBiwPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-50 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Show
                </label>
                <select
                  value={biwReviewPageSize}
                  onChange={(e) => {
                    setBiwReviewPageSize(Number(e.target.value));
                    setBiwReviewPage(1);
                  }}
                  className="px-3 py-1.5 text-xs font-bold border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all shadow-sm"
                >
                  {[5, 10, 20, 50].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {biwStartIndex + 1}-{Math.min(biwEndIndex, totalBiwItems)} of {totalBiwItems}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setBiwReviewPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={biwReviewPage === 1}
                  className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl disabled:opacity-30 transition-all hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1">
                  {Array.from(
                    { length: totalBiwPages },
                    (_, i) => i + 1,
                  )
                    .filter(
                      (num) =>
                        totalBiwPages <= 5 ||
                        Math.abs(num - biwReviewPage) <= 1 ||
                        num === 1 ||
                        num === totalBiwPages,
                    )
                    .map((pageNum, idx, arr) => (
                      <React.Fragment key={pageNum}>
                        {idx > 0 && arr[idx - 1] !== pageNum - 1 && (
                          <span className="text-gray-300 mx-1">...</span>
                        )}
                        <button
                          onClick={() => setBiwReviewPage(pageNum)}
                          className={`min-w-[32px] h-8 text-[10px] font-black rounded-xl transition-all ${biwReviewPage === pageNum
                            ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
                            : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50"
                            }`}
                        >
                          {pageNum}
                        </button>
                      </React.Fragment>
                    ))}
                </div>

                <button
                  onClick={() =>
                    setBiwReviewPage((prev) =>
                      Math.min(totalBiwPages, prev + 1),
                    )
                  }
                  disabled={biwReviewPage === totalBiwPages}
                  className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl disabled:opacity-30 transition-all hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading && !form) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900 p-4 sm:p-6 md:p-8 space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            <div>
              <div className="w-64 h-7 bg-gray-200 dark:bg-gray-700 rounded-md mb-2"></div>
              <div className="w-40 h-4 bg-gray-100 dark:bg-gray-700/60 rounded-md"></div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-28 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            <div className="w-28 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
          </div>
        </div>

        {/* 2-Column Grid Skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Response Trend Chart Skeleton */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm h-[380px] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-40 h-6 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
              <div className="w-20 h-4 bg-gray-100 dark:bg-gray-700 rounded-md"></div>
            </div>
            <div className="w-full h-56 bg-gradient-to-t from-blue-50 to-transparent dark:from-blue-900/10 rounded-xl"></div>
          </div>

          {/* Overall Inspection Trend Donut Skeleton */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm h-[380px] flex flex-col justify-between items-center">
            <div className="w-full flex items-center justify-between">
              <div className="w-48 h-6 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
            </div>
            <div className="w-48 h-48 rounded-full border-8 border-gray-100 dark:border-gray-700"></div>
            <div className="w-3/4 h-8 bg-gray-100 dark:bg-gray-700 rounded-md"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    const isTimeoutError = error.includes('timeout') || error.includes('too long');

    return (
      <div className="p-6">
        <div className="text-center py-12 max-w-md mx-auto">
          <div className={`rounded-lg p-6 mb-4 ${isTimeoutError ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
            {isTimeoutError ? (
              <Clock className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            ) : (
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            )}
            <p className={`font-medium ${isTimeoutError ? 'text-amber-700 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
              {error}
            </p>
            {isTimeoutError && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                This usually happens when there's a large amount of data to process.
                You can try again or view the data with limited functionality.
              </p>
            )}
          </div>

          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={handleRetry}
              disabled={isRetrying || loading}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {isRetrying || loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Loading...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Retry
                </>
              )}
            </button>

            {!isGuest && (
              <button
                onClick={() => navigate(-1)}
                className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Go Back
              </button>
            )}

            {isGuest && (
              <button
                onClick={handleLogout}
                className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Log out
              </button>
            )}
          </div>

          {retryCount > 2 && (
            <p className="text-xs text-gray-400 mt-4">
              Multiple retry attempts failed. Please refresh the page or contact support.
            </p>
          )}
        </div>
      </div>
    );
  }

  const dispatchableResponses = filteredResponses.filter(response => {
    if (!isOwnTenantResponse(response)) return false; // exclude cross-tenant

    const status = responseStatuses[response.id] || "";
    return status === "Direct Ok" ||
      status === "Rework Accepted" ||
      status === "Rework Completed" ||
      status === "Accepted";
  });
  const pendingDispatchResponses = dispatchableResponses.filter(response => !response.isDispatched);

  const isAllDispatchableSelected = dispatchableResponses.length > 0 && selectedDispatchIds.length === pendingDispatchResponses.length && pendingDispatchResponses.length > 0;

  const handleHeaderDispatchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const selectableIds = pendingDispatchResponses
        .filter(r => isOwnTenantResponse(r))
        .map(r => r.id);
      setSelectedDispatchIds(selectableIds);
    } else {
      setSelectedDispatchIds([]);
    }
  };

  const handleExecuteBulkDispatch = async () => {
    setIsBulkDispatching(true);

    const dispatchedAt = new Date().toISOString();
    const dispatchUpdatePayload = {
      isDispatched: true,
      dispatchedAt,
      dispatchedBy: user?._id || user?.id,
      dispatchedByName: user?.name || user?.username,
    };

    // ── Optimistic update ──────────────────────────────────────────────────────
    // Immediately reflect the dispatched state in the UI before the network
    // round-trip completes. This removes ALL perceived lag from the operation.
    const idsToDispatch = [...selectedDispatchIds];
    const previousResponses = [...(responses as any[])]; // snapshot for rollback

    setResponses((currentResponses: any[]) =>
      currentResponses.map((r: any) =>
        idsToDispatch.includes(r.id) ? { ...r, ...dispatchUpdatePayload } : r
      )
    );
    setSelectedDispatchIds([]);
    setShowBulkDispatchConfirm(false);

    try {
      await Promise.all(
        idsToDispatch.map((id) =>
          apiClient.updateResponse(id, dispatchUpdatePayload)
        )
      );

      showToast(
        `Dispatch enabled for ${idsToDispatch.length} response${idsToDispatch.length === 1 ? "" : "s"}.`,
        "success",
      );
    } catch (error) {
      console.error("Failed to batch enable dispatch:", error);
      // Roll back the optimistic update on failure
      setResponses(previousResponses as any);
      setSelectedDispatchIds(idsToDispatch);
      showToast("Failed to batch enable dispatch. Some responses may not have been updated.", "error");
    } finally {
      setIsBulkDispatching(false);
    }
  };

  return (
    <div
      className="p-2 sm:p-6 space-y-4 sm:space-y-6 bg-gray-50 dark:bg-gray-950 min-h-screen"
      id="analytics-scroll-container"
    >
      {/* Header with Tabs - Single Row */}
      {form && (
        <div className="bg-white dark:bg-gray-900 p-3 sm:p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-4 w-full lg:w-auto">
            {!isGuest && (
              <button
                onClick={() => navigate(-1)}
                className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Go back"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-md">
              {form?.title || "Form"}
            </h1>
          </div>

          {/* Tabs - Center */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 max-w-full no-scrollbar">
            <>
              {hasTabPermission("dashboard") && (
                <button
                  onClick={() => setAnalyticsView("dashboard")}
                  className={`px-3 py-2.5 font-semibold transition-all duration-200 flex items-center gap-2 border-b-2 whitespace-nowrap text-sm ${analyticsView === "dashboard"
                    ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                    : "text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-200"
                    }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Dashboard
                </button>
              )}

              {/* <button
                  onClick={() => setAnalyticsView("table")}
                  className={`px-3 py-2.5 font-semibold transition-all duration-200 flex items-center gap-2 border-b-2 whitespace-nowrap text-sm ${
                    analyticsView === "table"
                      ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                      : "text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-200"
                  }`}
                >
                  <Table className="w-4 h-4" />
                  Table
                </button> */}
            </>

            {hasTabPermission("responses") && (
              <button
                onClick={() => setAnalyticsView("responses")}
                className={`px-3 py-2.5 font-semibold transition-all duration-200 flex items-center gap-2 border-b-2 whitespace-nowrap text-sm ${analyticsView === "responses"
                  ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                  : "text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-200"
                  }`}
              >
                <UsersIcon className="w-4 h-4" />
                Responses
              </button>
            )}
            {/* {!isInspector && !isGuest && (
              <button
                onClick={() => setAnalyticsView("comparison")}
                className={`px-3 py-2.5 font-semibold transition-all duration-200 flex items-center gap-2 border-b-2 whitespace-nowrap text-sm ${
                  analyticsView === "comparison"
                    ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                    : "text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                <UsersIcon className="w-4 h-4" />
                Comparison
              </button>
            )} */}
          </div>

          {/* Refresh Button - Only for Dashboard */}

          {/* Right Side - Count and Actions */}
          <div className="flex items-center gap-2 sm:gap-3 whitespace-nowrap w-full lg:w-auto justify-between lg:justify-end">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Total Responses Count */}
              <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <UsersIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400" />
                <div className="text-right">
                  <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                    {analytics.total}
                  </div>
                </div>
              </div>

              {/* Refresh Button - Only shows on Dashboard tab */}
              {analyticsView === "dashboard" && (
                <button
                  onClick={refreshDashboardData}
                  disabled={isDashboardRefreshing}
                  className={`p-1.5 sm:p-2 rounded-lg transition-colors ${isDashboardRefreshing
                    ? "text-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    }`}
                  title="Refresh Dashboard Data"
                >
                  {isDashboardRefreshing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  )}
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              {uniqueInspectors.length > 0 && (
                <select
                  value={selectedInspectorForTrend}
                  onChange={(e) => setSelectedInspectorForTrend(e.target.value)}
                  className="text-[10px] font-bold bg-white dark:bg-gray-900 text-primary-700 dark:text-primary-300 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-purple-500/50 shadow-sm"
                  title="Filter Performance Trend by Inspector"
                >
                  <option value="Overall">All Inspectors</option>
                  <optgroup label="By Inspector">
                    {uniqueInspectors.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              )}
              <button
                onClick={() => setShowFilterModal(true)}
                className={`p-1.5 sm:p-2 rounded transition-colors relative ${appliedFilters.length > 0
                  ? "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 bg-indigo-50 dark:bg-indigo-900/20"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                title="Advanced Filters"
              >
                <Filter className="w-4 h-4" />
                {appliedFilters.length > 0 && (
                  <span className="absolute top-0 right-0 flex items-center justify-center w-3.5 h-3.5 text-[8px] font-bold text-white bg-red-500 rounded-full -translate-y-1 translate-x-1">
                    {appliedFilters.length}
                  </span>
                )}
              </button>
              {/* Other action buttons */}
              <div className="flex items-center gap-1">
                {!isGuest && (
                  <>
                    <button
                      onClick={handleShareAnalytics}
                      className="p-1.5 sm:p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="Share via WhatsApp/Email"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleAutoSendSetup}
                      className="p-1.5 sm:p-2 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                      title="Email Automation"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button
                  onClick={handleExportToPDF}
                  disabled={isExporting}
                  className="p-1.5 sm:p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                  title="Export to PDF"
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={handleExportToExcel}
                  disabled={isExporting}
                  className="p-1.5 sm:p-2 text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50"
                  title="Export to Excel"
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                  ) : (
                    <Table className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            {isGuest && (
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-red-200 dark:border-red-800"
              >
                Log out
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dashboard View - Always render for PDF export capability, but hide if not active */}
      {(analyticsView === "dashboard" || isExporting) && (
        <div
          className={
            analyticsView === "dashboard"
              ? "space-y-6"
              : "absolute -left-[9999px] top-0 w-full opacity-0 pointer-events-none"
          }
          aria-hidden={analyticsView !== "dashboard"}
        >
          {responses.length === 0 && isChartLoading && !isExporting ? (
            <div className="space-y-6 animate-pulse">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
                <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm min-h-[340px] flex flex-col justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700"></div>
                    <div className="space-y-1.5">
                      <div className="w-28 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      <div className="w-16 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>
                  </div>
                  <div className="h-44 w-full bg-gray-100 dark:bg-gray-700/50 rounded-lg flex items-end justify-between p-4 gap-2">
                    <div className="w-full h-1/3 bg-gray-200 dark:bg-gray-600 rounded"></div>
                    <div className="w-full h-2/3 bg-gray-200 dark:bg-gray-600 rounded"></div>
                    <div className="w-full h-1/2 bg-gray-200 dark:bg-gray-600 rounded"></div>
                    <div className="w-full h-4/5 bg-gray-200 dark:bg-gray-600 rounded"></div>
                    <div className="w-full h-3/5 bg-gray-200 dark:bg-gray-600 rounded"></div>
                  </div>
                </div>
                <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm min-h-[340px] flex flex-col justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700"></div>
                    <div className="space-y-1.5">
                      <div className="w-28 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      <div className="w-20 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>
                  </div>
                  <div className="w-44 h-44 mx-auto rounded-full border-8 border-gray-200 dark:border-gray-600"></div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="w-full" id="summary-cards">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
                  {/* Response Trend Chart - COMPACT */}
                  {/* Response Trend Chart */}
                  <div className="p-6 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow w-full">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg mr-2">
                          <BarChart3 className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <h3 className="text-md font-bold text-primary-900 dark:text-white">
                            Response Trend
                          </h3>
                          <p className="text-xs text-primary-500 dark:text-primary-400">
                            Last 30 days
                          </p>
                        </div>
                      </div>
                    </div>

                    {Object.keys(analytics.responseTrend).length === 0 ? (
                      <div className="flex-1 flex items-center justify-center min-h-[280px]">
                        <div className="text-center">
                          <div className="mb-2">
                            <BarChart3 className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto" />
                          </div>
                          <p className="text-sm text-primary-500 dark:text-primary-400 font-medium">
                            No responses yet
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col w-full">
                        <div
                          style={{ height: "293px", width: "100%", position: "relative" }} // ✅ Added width: 100%
                          id="response-trend-chart"
                        >
                          <Line
                            data={{
                              labels: analytics.dateRange.map((date) =>
                                new Date(date).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                }),
                              ),
                              datasets: [
                                {
                                  label: "Responses %",
                                  data: analytics.percentageData,
                                  borderColor: "rgb(59, 130, 246)",
                                  backgroundColor: "rgba(59, 130, 246, 0.1)",
                                  fill: true,
                                  tension: 0.4,
                                  pointRadius: 4,
                                  pointHoverRadius: 6,
                                  pointBackgroundColor: "rgb(59, 130, 246)",
                                  pointBorderColor: "#fff",
                                  pointBorderWidth: 2,
                                  borderWidth: 2,
                                },
                              ],
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              // ✅ Add these to ensure full width
                              devicePixelRatio: 2,
                              interaction: {
                                mode: "index" as const,
                                axis: "x" as const,
                                intersect: false,
                              },
                              plugins: {
                                legend: {
                                  display: false,
                                },
                                tooltip: {
                                  backgroundColor: "rgba(0, 0, 0, 0.8)",
                                  titleColor: "#fff",
                                  bodyColor: "#fff",
                                  cornerRadius: 6,
                                  padding: 10,
                                  titleFont: { size: 11, weight: "bold" },
                                  bodyFont: { size: 11 },
                                  callbacks: {
                                    title: (context: any) => {
                                      const index = context[0].dataIndex;
                                      const date = analytics.dateRange[index];
                                      if (!date) return "";
                                      const [y, m, d] = date.split("-").map(Number);
                                      return new Date(y, m - 1, d).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      });
                                    },
                                    label: function (context) {
                                      return `Responses: ${context.parsed.y}`;
                                    },
                                  },
                                },
                              },
                              scales: {
                                y: {
                                  beginAtZero: true,
                                  max: 100,
                                  grid: {
                                    color: "rgba(0, 0, 0, 0.05)",
                                    drawBorder: false,
                                  },
                                  ticks: {
                                    color: "rgb(107, 114, 128)",
                                    font: { size: 10 },
                                    callback: function (value) {
                                      return value + "%";
                                    },
                                  },
                                },
                                x: {
                                  grid: {
                                    display: false,
                                    drawBorder: false,
                                  },
                                  ticks: {
                                    color: "rgb(107, 114, 128)",
                                    font: { size: 10 },
                                    maxRotation: 45,
                                    minRotation: 0,
                                    autoSkip: true,
                                    maxTicksLimit: 15,
                                  },
                                },
                              },
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pie Chart - COMPACT */}
                  <OverallQualityPieChart />
                </div>
              </div>

              {/* Question Distribution Chart */}

              {(chartQuestionPerformanceStats.length > 0 ||
                trendChartResponses.length > 0) && (
                  <div className="w-full" id="question-distribution-card">
                    <div className="w-full space-y-6">
                      <InspectionStatusLineChart />
                      <BiwDefectDistributionChart />
                      <TvsDefectDistributionChart />
                      <QuestionStatusDistributionChart />
                      <TimeBasedPerformanceGraph />
                      <DirectAcceptedPerformanceGraph />
                      {renderSummaryTable()}
                      {renderPerformanceTable()}
                      {renderBiwReviewTable()}
                      <InspectorPerformanceChart />

                      <PerformanceTableBarChart />

                      {/* ✅ NEW: BIW Review Table Bar Chart */}
                      <BiwReviewTableBarChart />
                    </div>
                  </div>
                )}
            </>
          )}
        </div>
      )}

      {form && (
        <>
          {/* Responses as Table */}
          {analyticsView === "responses" && (
            <div className="space-y-4 sm:space-y-6">
              <div className="card p-3 sm:p-6">
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Table className="w-5 h-5 text-indigo-600" />
                      All Responses
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      {isLoadingTableResponses
                        ? "Loading…"
                        : `Showing ${activeTotalResponsesCount > 0 ? responsesStartIndex + 1 : 0}-${Math.min(responsesEndIndex, activeTotalResponsesCount)} of ${activeTotalResponsesCount} responses`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center relative">
                    {/* Overall Search Bar */}
                    <div className="relative flex items-center bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 rounded-lg shadow-sm w-full sm:w-60">
                      <Search className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
                      <input
                        type="text"
                        placeholder="Search responses..."
                        value={responsesSearchTerm}
                        onChange={(e) => setResponsesSearchTerm(e.target.value)}
                        className="bg-transparent text-xs text-gray-700 dark:text-gray-200 focus:outline-none w-full font-medium"
                      />
                      {responsesSearchTerm && (
                        <button
                          onClick={() => setResponsesSearchTerm("")}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-205 shrink-0 ml-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 py-1.5 rounded-lg shadow-sm">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Show</span>
                      <select
                        value={responsesPageSize}
                        onChange={(e) => {
                          setResponsesPageSize(Number(e.target.value));
                          setResponsesPage(1);
                        }}
                        className="bg-transparent text-xs font-bold text-gray-700 dark:text-gray-200 focus:outline-none cursor-pointer"
                      >
                        {pageSizesList.map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </div>

                    {totalResponsesPages > 1 && (
                      <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-1 py-1 rounded-lg shadow-sm">
                        <button
                          onClick={() => setResponsesPage((prev) => Math.max(1, prev - 1))}
                          disabled={currentResponsesPage === 1}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 disabled:opacity-30 rounded transition-colors"
                          title="Previous Page"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <div className="flex items-center text-xs font-bold text-gray-700 dark:text-gray-200 px-1">
                          <input
                            type="number"
                            min={1}
                            max={totalResponsesPages}
                            value={responsesPage}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (val >= 1 && val <= totalResponsesPages) {
                                setResponsesPage(val);
                              }
                            }}
                            className="w-11 text-center bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 mr-1 py-0.5 text-xs font-bold"
                          />
                          <span className="text-gray-400 dark:text-gray-500 font-normal">/ {totalResponsesPages}</span>
                        </div>
                        <button
                          onClick={() => setResponsesPage((prev) => Math.min(totalResponsesPages, prev + 1))}
                          disabled={currentResponsesPage === totalResponsesPages}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 disabled:opacity-30 rounded transition-colors"
                          title="Next Page"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => setShowFilterModal(true)}
                      className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 border shadow-xs ${
                        appliedFilters.length > 0 || Object.values(columnFilters).some((v) => v && v.length > 0)
                          ? "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500 ring-2 ring-indigo-400 ring-offset-2 dark:ring-offset-gray-900"
                          : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700"
                      }`}
                      title="Open Filters Dialog"
                    >
                      <Filter className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">Filters</span>
                      {(appliedFilters.length > 0 || Object.values(columnFilters).filter((v) => v && v.length > 0).length > 0) && (
                        <span className="ml-0.5 px-1.5 py-0.2 bg-white dark:bg-gray-900 text-indigo-700 dark:text-indigo-300 font-black rounded-full text-[10px]">
                          {appliedFilters.length + Object.values(columnFilters).filter((v) => v && v.length > 0).length}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() =>
                        setShowResponsesFilter(!showResponsesFilter)
                      }
                      className={`px-3 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${showResponsesFilter ? "ring-2 ring-indigo-400 ring-offset-2 dark:ring-offset-gray-900" : ""}`}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                        />
                      </svg>
                      <span className="hidden xs:inline">Filter Sections</span>
                      <span className="xs:hidden">Filter</span>
                    </button>
                    <button
                      onClick={() => handleExportToExcel()}
                      disabled={selectedResponsesSectionIds.length === 0 || isExporting}
                      className="px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2"
                    >
                      {isExporting ? (
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      <span className="hidden xs:inline">
                        {isExporting ? "Exporting..." : "Export"}
                      </span>
                    </button>
                    {selectedResponseIds.length > 0 && !isGuest && (
                      <>
                        <button
                          onClick={() => handleBulkBiwReviewUpdate("Accepted")}
                          disabled={isBulkBiwUpdating}
                          className="px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150"
                          title="Bulk Accept (BIW Review)"
                        >
                          {isBulkBiwUpdating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          <span className="hidden md:inline">BIW Accept</span>
                          <span className="md:hidden">Accept</span>
                        </button>
                        <button
                          onClick={() => handleBulkBiwReviewUpdate("Rejected")}
                          disabled={isBulkBiwUpdating}
                          className="px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150"
                          title="Bulk Reject (BIW Review)"
                        >
                          {isBulkBiwUpdating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          <span className="hidden md:inline">BIW Reject</span>
                          <span className="md:hidden">Reject</span>
                        </button>
                        <button
                          onClick={() => handleBulkBiwReviewUpdate("Reworked")}
                          disabled={isBulkBiwUpdating}
                          className="px-3 sm:px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150"
                          title="Bulk Rework (BIW Review)"
                        >
                          {isBulkBiwUpdating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RotateCcw className="w-4 h-4" />
                          )}
                          <span className="hidden md:inline">BIW Rework</span>
                          <span className="md:hidden">Rework</span>
                        </button>
                        <button
                          onClick={() => handleBulkBiwReviewUpdate(null)}
                          disabled={isBulkBiwUpdating}
                          className="px-3 sm:px-4 py-2 bg-gray-500 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150"
                          title="Bulk Clear BIW Review"
                        >
                          {isBulkBiwUpdating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          <span className="hidden md:inline">BIW Clear</span>
                          <span className="md:hidden">Clear</span>
                        </button>
                        <button
                          onClick={() => setShowBulkDeleteConfirm(true)}
                          disabled={isBulkBiwUpdating}
                          className="px-3 sm:px-4 py-2 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150"
                          title="Delete selected responses"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="hidden xs:inline">
                            Delete ({selectedResponseIds.length})
                          </span>
                        </button>
                      </>
                    )}

                    {showResponsesFilter && (
                      <div className="absolute top-full right-0 mt-2 p-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 w-[280px] sm:w-80 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="sticky top-0 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 px-3 sm:px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                              Select Sections
                            </h4>
                            <button
                              onClick={() => setShowResponsesFilter(false)}
                              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                            >
                              <svg
                                className="w-4 h-4 text-gray-600 dark:text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                setSelectedResponsesSectionIds(
                                  form?.sections?.map((s: Section) => s.id) ||
                                  [],
                                )
                              }
                              className="flex-1 px-2 py-1.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 rounded transition-colors"
                            >
                              Select All
                            </button>
                            <button
                              onClick={() => setSelectedResponsesSectionIds([])}
                              className="flex-1 px-2 py-1.5 text-[10px] font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                            >
                              Clear All
                            </button>
                          </div>
                        </div>

                        <div className="p-2 sm:p-4 max-h-64 sm:max-h-96 overflow-y-auto space-y-1">
                          {form?.sections && form.sections.length > 0 ? (
                            form.sections.map((section: Section) => (
                              <label
                                key={section.id}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer transition-colors group"
                              >
                                <div className="relative flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedResponsesSectionIds.includes(
                                      section.id,
                                    )}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedResponsesSectionIds([
                                          ...selectedResponsesSectionIds,
                                          section.id,
                                        ]);
                                      } else {
                                        setSelectedResponsesSectionIds(
                                          selectedResponsesSectionIds.filter(
                                            (id) => id !== section.id,
                                          ),
                                        );
                                      }
                                    }}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded cursor-pointer accent-indigo-600"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-xs font-medium text-gray-900 dark:text-gray-200 block truncate">
                                    {section.title}
                                  </span>
                                </div>
                              </label>
                            ))
                          ) : (
                            <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
                              No sections available
                            </p>
                          )}

                          <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                            <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30 cursor-pointer transition-colors group">
                              <input
                                type="checkbox"
                                checked={showParentMatchColumn}
                                onChange={(e) => {
                                  const nextVal = e.target.checked;
                                  setShowParentMatchColumn(nextVal);
                                  try {
                                    const formKey = id || form?._id || "default";
                                    localStorage.setItem(`show_parent_match_${formKey}`, String(nextVal));
                                  } catch (err) {}
                                }}
                                className="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded cursor-pointer accent-indigo-600"
                              />
                              <div className="flex-1 min-w-0 flex items-center gap-1.5">
                                <Link2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                <span className="text-xs font-bold text-gray-900 dark:text-gray-200 block truncate">
                                  Parent Match Column
                                </span>
                              </div>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {selectedResponsesSectionIds.length > 0 ? (
                  <>
                    {/* Active Filters Bar */}
                    {(Object.entries(columnFilters).some(([_, v]) => v && v.length > 0) || responsesSearchTerm.trim() !== "" || appliedFilters.length > 0) && (
                      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 mb-3 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs shadow-2xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1">
                            <Filter className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            Active Filters:
                          </span>
                          {responsesSearchTerm.trim() !== "" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 shadow-2xs">
                              Search: "{responsesSearchTerm}"
                              <button onClick={() => setResponsesSearchTerm("")} className="hover:text-red-500 ml-0.5 cursor-pointer">×</button>
                            </span>
                          )}
                          {Object.entries(columnFilters).map(([colId, vals]) => {
                            if (!vals || vals.length === 0) return null;
                            let colLabel = colId;
                            if (colId === "__status") colLabel = "Status";
                            else if (colId === "__submittedBy") colLabel = "Submitted by";
                            else if (colId === "__chassisNumber") colLabel = "Chassis";
                            else if (colId === "__parentMatch") colLabel = "Parent Match";
                            else if (colId === "__biwReview") colLabel = "BIW Review";
                            else if (colId === "__dispatch") colLabel = "Dispatch";
                            else if (colId === "__attemptRank") colLabel = "Attempt";
                            else {
                              const q = form?.sections?.flatMap((s: any) => s.questions || []).find((q: any) => q.id === colId);
                              if (q) colLabel = q.text || q.label || colId;
                            }

                            return (
                              <span
                                key={colId}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-700 shadow-2xs"
                              >
                                <span className="font-bold">{colLabel}:</span> {vals.slice(0, 2).join(", ")}{vals.length > 2 ? ` +${vals.length - 2}` : ""}
                                <button
                                  onClick={() => {
                                    startFilterTransition(() => {
                                      setColumnFilters((prev) => {
                                        const next = { ...prev };
                                        delete next[colId];
                                        return next;
                                      });
                                    });
                                  }}
                                  className="hover:text-red-600 dark:hover:text-red-400 font-bold ml-1 text-xs cursor-pointer"
                                  title={`Remove ${colLabel} filter`}
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => {
                            startFilterTransition(() => {
                              setColumnFilters({});
                              setAppliedFilters([]);
                            });
                            setResponsesSearchTerm("");
                          }}
                          className="text-[11px] font-bold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 underline cursor-pointer shrink-0 ml-auto"
                        >
                          Clear All Filters
                        </button>
                      </div>
                    )}

                    {/* Overall Inspection Statistics Summary Bar (Clickable Quick-Filters) */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 mb-4">
                      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3 items-center">
                        {/* Total Submissions */}
                        <div
                          onClick={() => {
                            startFilterTransition(() => {
                              setColumnFilters((prev) => {
                                const next = { ...prev };
                                delete next["__status"];
                                delete next["__dispatch"];
                                return next;
                              });
                            });
                          }}
                          className={`flex flex-col p-2.5 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-100 dark:border-purple-900/20 cursor-pointer select-none transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 ${
                            !columnFilters["__status"]?.length && !columnFilters["__dispatch"]?.length
                              ? "ring-2 ring-purple-500 shadow-sm"
                              : "opacity-80 hover:opacity-100"
                          }`}
                          title="Click to show all submissions"
                        >
                          <span className="text-[10px] text-purple-700 dark:text-purple-400 font-bold uppercase truncate" title="Total Submissions">
                            Total Submissions
                          </span>
                          <div className="flex items-baseline justify-between mt-0.5">
                            <span className="text-lg font-black text-purple-600 dark:text-purple-400">
                              {totalPieChartData.counts.total || activeTotalResponsesCount}
                            </span>
                            <BarChart3 className="w-4 h-4 text-purple-500" />
                          </div>
                        </div>

                        {/* Direct Ok / Accepted */}
                        <div
                          onClick={() => {
                            startFilterTransition(() => {
                              setColumnFilters((prev) => {
                                const curr = prev["__status"] || [];
                                const isOnlyDirectOk = curr.length === 2 && curr.includes("Direct Ok") && curr.includes("Accepted");
                                const next = { ...prev };
                                if (isOnlyDirectOk) {
                                  delete next["__status"];
                                } else {
                                  next["__status"] = ["Direct Ok", "Accepted"];
                                }
                                return next;
                              });
                            });
                          }}
                          className={`flex flex-col p-2.5 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-900/20 cursor-pointer select-none transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 ${
                            columnFilters["__status"]?.includes("Direct Ok") || columnFilters["__status"]?.includes("Accepted")
                              ? "ring-2 ring-green-500 shadow-sm"
                              : "opacity-80 hover:opacity-100"
                          }`}
                          title="Click to filter by Accepted / Direct OK"
                        >
                          <span className="text-[10px] text-green-700 dark:text-green-400 font-bold uppercase truncate" title="Accepted / Direct OK">
                            {complianceLabels.yes || "Direct Ok"}
                          </span>
                          <div className="flex items-baseline justify-between mt-0.5">
                            <span className="text-lg font-black text-green-600 dark:text-green-400">
                              {inspectionStats.accepted}
                            </span>
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          </div>
                        </div>

                        {/* Rework Accepted */}
                        <div
                          onClick={() => {
                            startFilterTransition(() => {
                              setColumnFilters((prev) => {
                                const curr = prev["__status"] || [];
                                const isOnlyReworkAccepted = curr.length === 1 && curr.includes("Rework Accepted");
                                const next = { ...prev };
                                if (isOnlyReworkAccepted) {
                                  delete next["__status"];
                                } else {
                                  next["__status"] = ["Rework Accepted"];
                                }
                                return next;
                              });
                            });
                          }}
                          className={`flex flex-col p-2.5 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/20 cursor-pointer select-none transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 ${
                            columnFilters["__status"]?.includes("Rework Accepted")
                              ? "ring-2 ring-blue-500 shadow-sm"
                              : "opacity-80 hover:opacity-100"
                          }`}
                          title="Click to filter by Rework Accepted"
                        >
                          <span className="text-[10px] text-blue-700 dark:text-blue-400 font-bold uppercase truncate" title="Rework Accepted">
                            Rework Accepted
                          </span>
                          <div className="flex items-baseline justify-between mt-0.5">
                            <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                              {inspectionStats.reworkCompleted}
                            </span>
                            <CheckCircle className="w-4 h-4 text-blue-500" />
                          </div>
                        </div>

                        {/* Ongoing Rework */}
                        <div
                          onClick={() => {
                            startFilterTransition(() => {
                              setColumnFilters((prev) => {
                                const curr = prev["__status"] || [];
                                const isOngoingRework = curr.includes("Ongoing Rework") || curr.includes("Rework");
                                const next = { ...prev };
                                if (isOngoingRework) {
                                  delete next["__status"];
                                } else {
                                  next["__status"] = ["Ongoing Rework", "Rework", "Rework 1", "Rework 2"];
                                }
                                return next;
                              });
                            });
                          }}
                          className={`flex flex-col p-2.5 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-100 dark:border-amber-900/20 cursor-pointer select-none transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 ${
                            columnFilters["__status"]?.some(s => s.toLowerCase().includes("rework") && s !== "Rework Accepted")
                              ? "ring-2 ring-amber-500 shadow-sm"
                              : "opacity-80 hover:opacity-100"
                          }`}
                          title="Click to filter by Ongoing Rework"
                        >
                          <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase truncate" title="Ongoing Rework">
                            {complianceLabels.na || "Rework"}
                          </span>
                          <div className="flex items-baseline justify-between mt-0.5">
                            <span className="text-lg font-black text-amber-500 dark:text-amber-400">
                              {inspectionStats.reworked}
                            </span>
                            <RotateCcw className="w-4 h-4 text-amber-500" />
                          </div>
                        </div>

                        {/* Rejected */}
                        <div
                          onClick={() => {
                            startFilterTransition(() => {
                              setColumnFilters((prev) => {
                                const curr = prev["__status"] || [];
                                const isRejected = curr.length === 1 && curr.includes("Rejected");
                                const next = { ...prev };
                                if (isRejected) {
                                  delete next["__status"];
                                } else {
                                  next["__status"] = ["Rejected"];
                                }
                                return next;
                              });
                            });
                          }}
                          className={`flex flex-col p-2.5 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20 cursor-pointer select-none transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 ${
                            columnFilters["__status"]?.includes("Rejected")
                              ? "ring-2 ring-red-500 shadow-sm"
                              : "opacity-80 hover:opacity-100"
                          }`}
                          title="Click to filter by Rejected"
                        >
                          <span className="text-[10px] text-red-700 dark:text-red-400 font-bold uppercase truncate" title="Rejected">
                            {complianceLabels.no || "Rejected"}
                          </span>
                          <div className="flex items-baseline justify-between mt-0.5">
                            <span className="text-lg font-black text-red-600 dark:text-red-400">
                              {inspectionStats.rejected}
                            </span>
                            <XCircle className="w-4 h-4 text-red-500" />
                          </div>
                        </div>

                        {/* Dispatched */}
                        <div
                          onClick={() => {
                            startFilterTransition(() => {
                              setColumnFilters((prev) => {
                                const curr = prev["__dispatch"] || [];
                                const isDispatched = curr.includes("Dispatched / Enabled");
                                const next = { ...prev };
                                if (isDispatched) {
                                  delete next["__dispatch"];
                                } else {
                                  next["__dispatch"] = ["Dispatched / Enabled"];
                                }
                                return next;
                              });
                            });
                          }}
                          className={`flex flex-col p-2.5 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-900/20 cursor-pointer select-none transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 ${
                            columnFilters["__dispatch"]?.includes("Dispatched / Enabled")
                              ? "ring-2 ring-indigo-500 shadow-sm"
                              : "opacity-80 hover:opacity-100"
                          }`}
                          title="Click to filter by Dispatched"
                        >
                          <span className="text-[10px] text-indigo-700 dark:text-indigo-400 font-bold uppercase truncate" title="Dispatched">
                            Dispatched
                          </span>
                          <div className="flex items-baseline justify-between mt-0.5">
                            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                              {inspectionStats.dispatched}
                            </span>
                            <Send className="w-4 h-4 text-indigo-500" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={`overflow-auto no-scrollbar rounded-xl border border-gray-200 dark:border-gray-700 max-h-[90vh] transition-opacity duration-150 ${isFilterPending ? "opacity-60 pointer-events-none" : "opacity-100"}`}>
                      <table className="text-xs border-collapse w-full">
                        <thead className="sticky top-0 z-30">
                          <tr className="bg-gray-100 dark:bg-gray-800">
                            <th className="hidden sm:table-cell sticky left-0 z-30 text-center px-3 py-3 font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                              <input
                                type="checkbox"
                                checked={
                                  selectedResponseIds.length > 0 &&
                                  selectedResponseIds.length ===
                                  tableResponses.length
                                }
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedResponseIds(
                                      tableResponses.map((r) => r.id),
                                    );
                                  } else {
                                    setSelectedResponseIds([]);
                                  }
                                }}
                                className="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded cursor-pointer accent-indigo-600"
                              />
                            </th>
                            <th className="sticky left-0 sm:left-12 z-30 text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-700 whitespace-nowrap bg-gray-100 dark:bg-gray-800 min-w-[120px]">
                              <span>Actions</span>
                            </th>
                            <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-700 whitespace-nowrap bg-gray-50 dark:bg-gray-800">
                              <div className="flex flex-col items-center gap-1.5 justify-center">
                                <div className="flex items-center gap-1">
                                  <span>Dispatch</span>
                                  <TableColumnFilter
                                    columnId="__dispatch"
                                    title="Dispatch Status"
                                    options={dispatchFilterOptions}
                                    selectedValues={columnFilters["__dispatch"] || null}
                                    onFilterChange={(columnId, values) => {
                                      startFilterTransition(() => {
                                        setColumnFilters((prev) => ({
                                          ...prev,
                                          [columnId]: values,
                                        }));
                                      });
                                    }}
                                  />
                                </div>
                                {canBulkSelectResponses && (
                                  <label className="flex items-center gap-1.5 cursor-pointer font-normal text-[10px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 normal-case">
                                    <input
                                      type="checkbox"
                                      checked={isAllDispatchableSelected}
                                      disabled={dispatchableResponses.length === 0 || pendingDispatchResponses.length === 0 || isBulkDispatching}
                                      onChange={handleHeaderDispatchChange}
                                      className="w-3.5 h-3.5 text-green-600 border-gray-300 dark:border-gray-600 rounded cursor-pointer accent-green-600"
                                    />
                                    <span>Select All</span>
                                  </label>
                                )}
                                {selectedDispatchIds.length > 0 && (
                                  <button
                                    onClick={() => setShowBulkDispatchConfirm(true)}
                                    className="mt-1 bg-green-600 hover:bg-green-700 text-white text-[10px] px-2 py-0.5 rounded shadow transition-colors"
                                    title={`Dispatch ${selectedDispatchIds.length} selected items`}
                                  >
                                    Proceed ({selectedDispatchIds.length})
                                  </button>
                                )}
                              </div>
                            </th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-700 min-w-48 whitespace-nowrap bg-gray-50 dark:bg-gray-800">
                              <div className="flex items-center justify-between gap-1.5">
                                <div
                                  onClick={() => {
                                    startFilterTransition(() => {
                                      setTableSort((prev) =>
                                        prev?.columnId === "__submittedBy"
                                          ? prev.direction === "asc"
                                            ? { columnId: "__submittedBy", direction: "desc" }
                                            : null
                                          : { columnId: "__submittedBy", direction: "asc" }
                                      );
                                    });
                                  }}
                                  className="flex items-center gap-1.5 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                  title="Click to sort by Submitter"
                                >
                                  <span>Submitted by</span>
                                  {tableSort?.columnId === "__submittedBy" ? (
                                    tableSort.direction === "asc" ? (
                                      <ArrowUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                    ) : (
                                      <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 shrink-0 opacity-40 hover:opacity-100" />
                                  )}
                                </div>
                                <TableColumnFilter
                                  columnId="__submittedBy"
                                  title="Submitted by"
                                  options={submittedByFilterOptions}
                                  selectedValues={columnFilters["__submittedBy"] || null}
                                  onFilterChange={(columnId, values) => {
                                    startFilterTransition(() => {
                                      setColumnFilters((prev) => ({
                                        ...prev,
                                        [columnId]: values,
                                      }));
                                    });
                                  }}
                                />
                              </div>
                            </th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-700 min-w-36 whitespace-nowrap bg-gray-50 dark:bg-gray-800">
                              <div className="flex items-center justify-between gap-1.5">
                                <div
                                  onClick={() => {
                                    startFilterTransition(() => {
                                      setTableSort((prev) =>
                                        prev?.columnId === "__status"
                                          ? prev.direction === "asc"
                                            ? { columnId: "__status", direction: "desc" }
                                            : null
                                          : { columnId: "__status", direction: "asc" }
                                      );
                                    });
                                  }}
                                  className="flex items-center gap-1.5 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                  title="Click to sort by Status"
                                >
                                  <span>Status</span>
                                  {tableSort?.columnId === "__status" ? (
                                    tableSort.direction === "asc" ? (
                                      <ArrowUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                    ) : (
                                      <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 shrink-0 opacity-40 hover:opacity-100" />
                                  )}
                                </div>
                                <TableColumnFilter
                                  columnId="__status"
                                  title="Status"
                                  options={statusFilterOptions}
                                  selectedValues={columnFilters["__status"] || null}
                                  onFilterChange={(columnId, values) => {
                                    startFilterTransition(() => {
                                      setColumnFilters((prev) => ({
                                        ...prev,
                                        [columnId]: values,
                                      }));
                                    });
                                  }}
                                />
                              </div>
                            </th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-700 min-w-44 whitespace-nowrap bg-gray-50 dark:bg-gray-800">
                              <div className="flex items-center justify-between gap-1.5">
                                <div
                                  onClick={() => {
                                    startFilterTransition(() => {
                                      setTableSort((prev) =>
                                        prev?.columnId === "__chassisNumber"
                                          ? prev.direction === "asc"
                                            ? { columnId: "__chassisNumber", direction: "desc" }
                                            : null
                                          : { columnId: "__chassisNumber", direction: "asc" }
                                      );
                                    });
                                  }}
                                  className="flex items-center gap-1.5 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                  title="Click to sort Chassis Ascending / Descending"
                                >
                                  <span>Selected Chassis</span>
                                  {tableSort?.columnId === "__chassisNumber" ? (
                                    tableSort.direction === "asc" ? (
                                      <ArrowUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                    ) : (
                                      <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 shrink-0 opacity-40 hover:opacity-100" />
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  {canBulkSelectResponses && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAutoFillAllChassis();
                                      }}
                                      disabled={isAutoFillingChassis || !chassisMasterOptions.length}
                                      title="Auto-fill every response with no chassis number using the first option"
                                      className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed normal-case tracking-normal"
                                    >
                                      {isAutoFillingChassis ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <CheckCircle className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  )}
                                  <TableColumnFilter
                                    columnId="__chassisNumber"
                                    title="Selected Chassis"
                                    options={chassisFilterOptions}
                                    selectedValues={columnFilters["__chassisNumber"] || null}
                                    onFilterChange={(columnId, values) => {
                                      startFilterTransition(() => {
                                        setColumnFilters((prev) => ({
                                          ...prev,
                                          [columnId]: values,
                                        }));
                                      });
                                    }}
                                  />
                                </div>
                              </div>
                            </th>
                            {showParentMatchColumn && (
                              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-700 min-w-44 whitespace-nowrap bg-indigo-50/60 dark:bg-indigo-950/20">
                                <div className="flex items-center justify-between gap-1.5">
                                  <div
                                    onClick={() => {
                                      startFilterTransition(() => {
                                        setTableSort((prev) =>
                                          prev?.columnId === "__parentMatch"
                                            ? prev.direction === "asc"
                                              ? { columnId: "__parentMatch", direction: "desc" }
                                              : null
                                            : { columnId: "__parentMatch", direction: "asc" }
                                        );
                                      });
                                    }}
                                    className="flex items-center gap-1.5 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                    title="Click to sort by Parent Match status"
                                  >
                                    <Link2 className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Parent Match</span>
                                    {tableSort?.columnId === "__parentMatch" ? (
                                      tableSort.direction === "asc" ? (
                                        <ArrowUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                      ) : (
                                        <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                      )
                                    ) : (
                                      <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 shrink-0 opacity-40 hover:opacity-100" />
                                    )}
                                  </div>
                                  <TableColumnFilter
                                    columnId="__parentMatch"
                                    title="Parent Match"
                                    options={parentMatchFilterOptions}
                                    selectedValues={columnFilters["__parentMatch"] || null}
                                    onFilterChange={(columnId, values) => {
                                      startFilterTransition(() => {
                                        setColumnFilters((prev) => ({
                                          ...prev,
                                          [columnId]: values,
                                        }));
                                      });
                                    }}
                                  />
                                </div>
                              </th>
                            )}
                            <th className="text-left px-6 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-700 min-w-48 whitespace-nowrap bg-gray-50 dark:bg-gray-800">
                              Review
                            </th>
                            <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-700 min-w-44 whitespace-nowrap bg-purple-50 dark:bg-purple-900/20">
                              <div className="flex flex-col items-center gap-1.5 justify-center">
                                <div className="flex items-center gap-1">
                                  <span>BIW Review</span>
                                  <TableColumnFilter
                                    columnId="__biwReview"
                                    title="BIW Review"
                                    options={biwReviewFilterOptions}
                                    selectedValues={columnFilters["__biwReview"] || null}
                                    onFilterChange={(columnId, values) => {
                                      startFilterTransition(() => {
                                        setColumnFilters((prev) => ({
                                          ...prev,
                                          [columnId]: values,
                                        }));
                                      });
                                    }}
                                  />
                                </div>
                                {canBulkSelectResponses && (
                                  <label className="flex items-center gap-1.5 cursor-pointer font-normal text-[10px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 normal-case">
                                    <input
                                      type="checkbox"
                                      checked={tableResponses.length > 0 && selectedBiwIds.length === tableResponses.length}
                                      disabled={tableResponses.length === 0 || isBulkBiwUpdating}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        console.log('[BIW] Header select all clicked:', e.target.checked);

                                        if (e.target.checked) {
                                          const allIds = tableResponses.map(r => r.id);
                                          console.log('[BIW] Selecting all:', allIds.length, 'items');
                                          setSelectedBiwIds(allIds);
                                        } else {
                                          console.log('[BIW] Clearing all selections');
                                          setSelectedBiwIds([]);
                                        }
                                      }}
                                      className="w-3.5 h-3.5 text-purple-600 border-gray-300 dark:border-gray-600 rounded cursor-pointer accent-purple-600"
                                    />
                                    <span>Select All</span>
                                    {selectedBiwIds.length > 0 && (
                                      <span className="text-[9px] font-bold text-purple-600 bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 rounded ml-1">
                                        {selectedBiwIds.length}
                                      </span>
                                    )}
                                  </label>
                                )}

                                {/* Bulk actions dropdown */}
                                <select
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val) {
                                      const status = val === "Clear" ? null : val as "Accepted" | "Rejected" | "Reworked";

                                      console.log('[BIW] Bulk action:', status, 'for', selectedBiwIds.length, 'items');

                                      if (selectedBiwIds.length === 0) {
                                        showToast("Please select items using the BIW checkboxes first", "error");
                                      } else {
                                        const validResponseIds: string[] = [];
                                        let selfSubmissionsCount = 0;

                                        selectedBiwIds.forEach((id) => {
                                          const resp = responses.find((r) => r.id === id) || tableResponses.find((r) => r.id === id);
                                          if (resp) {
                                            if (status !== null && isSubmitterOfResponse(resp)) {
                                              selfSubmissionsCount++;
                                            } else {
                                              validResponseIds.push(id);
                                            }
                                          }
                                        });

                                        if (validResponseIds.length === 0) {
                                          showToast("You cannot BIW review your own submissions. All selected items were skipped.", "error");
                                        } else {
                                          setBiwBulkUpdateStatus(status);
                                          setBiwBulkUpdateTargetIds(validResponseIds);
                                          setBiwBulkUpdateSkippedCount(selfSubmissionsCount);
                                          setShowBiwBulkUpdateModal(true);
                                        }
                                      }
                                      e.target.value = "";
                                    }
                                  }}
                                  disabled={isBulkBiwUpdating || tableResponses.length === 0}
                                  className="px-2 py-1 text-[10px] font-black border border-purple-200 dark:border-purple-700 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none normal-case tracking-normal cursor-pointer shadow-sm hover:border-purple-400 transition-colors w-full"
                                >
                                  <option value="">Apply to Selected...</option>
                                  <option value="Accepted">✓ Accept Selected</option>
                                  <option value="Rejected">✗ Reject Selected</option>
                                  <option value="Reworked">⟳ Rework Selected</option>
                                  <option value="Clear">✕ Clear Selected</option>
                                </select>
                              </div>
                            </th>
                            <th className="text-left px-6 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-700 min-w-40 whitespace-nowrap">
                              <div
                                onClick={() => {
                                  startFilterTransition(() => {
                                    setTableSort((prev) =>
                                      prev?.columnId === "__timestamp"
                                        ? prev.direction === "asc"
                                          ? { columnId: "__timestamp", direction: "desc" }
                                          : null
                                        : { columnId: "__timestamp", direction: "asc" }
                                    );
                                  });
                                }}
                                className="flex items-center justify-between gap-2 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                title="Click to sort by Timestamp"
                              >
                                <span>Timestamp</span>
                                {tableSort?.columnId === "__timestamp" ? (
                                  tableSort.direction === "asc" ? (
                                    <ArrowUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                  ) : (
                                    <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                  )
                                ) : (
                                  <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-40 hover:opacity-100" />
                                )}
                              </div>
                            </th>

                            <th className="text-center px-4 py-3 font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider border border-gray-200 dark:border-gray-700 whitespace-nowrap bg-gray-50 dark:bg-gray-800">
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  onClick={() => {
                                    startFilterTransition(() => {
                                      setTableSort((prev) =>
                                        prev?.columnId === "__timeSpent"
                                          ? prev.direction === "asc"
                                            ? { columnId: "__timeSpent", direction: "desc" }
                                            : null
                                          : { columnId: "__timeSpent", direction: "asc" }
                                      );
                                    });
                                  }}
                                  className="flex-1 text-center cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center justify-center gap-1"
                                  title="Click to sort by Time Taken"
                                >
                                  <span>Time Taken</span>
                                  {tableSort?.columnId === "__timeSpent" && (
                                    <span className="text-indigo-600 dark:text-indigo-400">
                                      {tableSort.direction === "asc" ? (
                                        <ArrowUp className="w-3.5 h-3.5" />
                                      ) : (
                                        <ArrowDown className="w-3.5 h-3.5" />
                                      )}
                                    </span>
                                  )}
                                </span>
                                <TableColumnFilter
                                  columnId="__attemptRank"
                                  title="Attempt & Status"
                                  options={attemptRankFilterOptions}
                                  selectedValues={
                                    columnFilters["__attemptRank"] || null
                                  }
                                  onFilterChange={(columnId, values) => {
                                    startFilterTransition(() => {
                                      setColumnFilters((prev) => ({
                                        ...prev,
                                        [columnId]: values,
                                      }));
                                    });
                                  }}
                                />
                              </div>
                            </th>
                            {form?.sections?.map(
                              (section: Section) =>
                                selectedResponsesSectionIds.includes(
                                  section.id,
                                ) &&
                                section.questions?.map((q: any) => {
                                  const isFollowUp =
                                    q.parentId || q.showWhen?.questionId;
                                  const columnOptions = uniqueColumnValues.get(q.id) || [];
                                  const isChassisQ =
                                    q.id === chassisQuestionId ||
                                    q.type === "chassis" ||
                                    q.type === "chassisWithZone" ||
                                    q.type === "chassisWithoutZone" ||
                                    q.type === "zone-in" ||
                                    q.type === "zone-out" ||
                                    q.text?.toLowerCase().includes("chassis");

                                  return (
                                    <th
                                      key={q.id}
                                      className={`text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider border border-gray-200 dark:border-gray-700 max-w-xs ${isFollowUp ? "bg-purple-100 dark:bg-purple-900/30" : "bg-gray-100 dark:bg-gray-800"}`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div
                                          onClick={() => {
                                            const sortKey = isChassisQ ? "__chassisNumber" : q.id;
                                            startFilterTransition(() => {
                                              setTableSort((prev) =>
                                                prev?.columnId === sortKey || prev?.columnId === q.id
                                                  ? prev.direction === "asc"
                                                    ? { columnId: sortKey, direction: "desc" }
                                                    : null
                                                  : { columnId: sortKey, direction: "asc" }
                                              );
                                            });
                                          }}
                                          className="line-clamp-2 overflow-hidden text-ellipsis flex-1 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1"
                                          title={`Click to sort by ${q.text || "Question"}`}
                                        >
                                          <span>{q.text || "Question"}</span>
                                          {(tableSort?.columnId === q.id || (isChassisQ && tableSort?.columnId === "__chassisNumber")) && (
                                            <span className="text-indigo-600 dark:text-indigo-400 shrink-0">
                                              {tableSort.direction === "asc" ? (
                                                <ArrowUp className="w-3.5 h-3.5" />
                                              ) : (
                                                <ArrowDown className="w-3.5 h-3.5" />
                                              )}
                                            </span>
                                          )}
                                        </div>
                                        <TableColumnFilter
                                          columnId={q.id}
                                          title={q.text || "Question"}
                                          options={columnOptions}
                                          selectedValues={
                                            columnFilters[q.id] || null
                                          }
                                          onFilterChange={(
                                            columnId,
                                            values,
                                          ) => {
                                            startFilterTransition(() => {
                                              setColumnFilters((prev) => ({
                                                ...prev,
                                                [columnId]: values,
                                              }));
                                            });
                                          }}
                                        />
                                      </div>
                                    </th>
                                  );
                                }),
                            )}
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {displayedTableResponses.length > 0 ? (
                            displayedTableResponses.map(
                              (response: Response, idx: number) => (
                                <tr
                                  key={response.id}
                                  className={`${editingResponseId === response.id ? "bg-blue-50 dark:bg-blue-900/20" : idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800"}`}
                                >
                                  <td
                                    className={`hidden sm:table-cell  px-3 py-3 text-center border border-gray-200 dark:border-gray-700 whitespace-nowrap sticky left-0 z-20 ${editingResponseId === response.id ? "bg-blue-50 dark:bg-blue-900/20" : idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800"}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedResponseIds.includes(
                                        response.id,
                                      )}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedResponseIds([
                                            ...selectedResponseIds,
                                            response.id,
                                          ]);
                                        } else {
                                          setSelectedResponseIds(
                                            selectedResponseIds.filter(
                                              (id) => id !== response.id,
                                            ),
                                          );
                                        }
                                      }}
                                      className="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded cursor-pointer accent-indigo-600"
                                    />
                                  </td>
                                  <td
                                    className={`px-4 py-3 text-center border border-gray-200 dark:border-gray-700 whitespace-nowrap sticky left-0 sm:left-12 z-20 transition-all duration-300 ${editingResponseId === response.id ? "bg-blue-50 dark:bg-blue-900/20" : idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800"}`}
                                  >
                                    <div className="flex items-center gap-1.5 justify-center">
                                      {editingResponseId === response.id ? (
                                        <>
                                          <button
                                            onClick={handleSaveEdit}
                                            disabled={isSaving}
                                            title="Save Response"
                                            className="p-1 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors disabled:opacity-50"
                                          >
                                            <CheckCircle className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={handleCancelEdit}
                                            disabled={isSaving}
                                            title="Cancel"
                                            className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                                          >
                                            <XCircle className="w-4 h-4" />
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          {/* Focus It */}
                                          <button
                                            onClick={() =>
                                              handleOpenModal(response)
                                            }
                                            className="p-1.5 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                                            title="Focus It"
                                          >
                                            <Maximize className="w-4 h-4" />
                                          </button>

                                          {(() => {
                                            const responseTenantId =
                                              response.tenantId;
                                            const currentUserTenantId =
                                              user?.tenantId;
                                            const isActualOwnTenant =
                                              user?.role === "superadmin" ||
                                              !responseTenantId ||
                                              (currentUserTenantId &&
                                                responseTenantId.toString() ===
                                                currentUserTenantId.toString());
                                            const isOwnTenant =
                                              isActualOwnTenant;

                                            return (
                                              <>
                                                {/* View Details */}
                                                {isOwnTenant && (
                                                  <button
                                                    onClick={() =>
                                                      handleViewDetails(
                                                        response,
                                                      )
                                                    }
                                                    className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                                                    title="View Full Details"
                                                  >
                                                    <Eye className="w-4 h-4" />
                                                  </button>
                                                )}

                                                {/* Review & Discussion */}
                                                {response.isDispatched && (
                                                  <button
                                                    onClick={() => {
                                                      setChatResponse(response);
                                                      setShowChatModal(true);
                                                      setSelectedReviewOptions(
                                                        (prev) => ({
                                                          ...prev,
                                                          [response.id]: "",
                                                        }),
                                                      );
                                                      setReviewedBy((prev) => ({
                                                        ...prev,
                                                        [response.id]: null,
                                                      }));
                                                    }}
                                                    className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                                                    title="Review & Discussion"
                                                  >
                                                    <MessageCircle className="w-4 h-4" />
                                                  </button>
                                                )}

                                                {/* Edit & Delete - Admin only */}
                                                {!isGuest &&
                                                  (user?.role ===
                                                    "superadmin" ||
                                                    user?.role === "admin") &&
                                                  isActualOwnTenant && (
                                                    <>
                                                      <button
                                                        onClick={() =>
                                                          handleEditResponse(
                                                            response,
                                                          )
                                                        }
                                                        className="p-1.5 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all"
                                                        title="Edit Response"
                                                      >
                                                        <Edit className="w-4 h-4" />
                                                      </button>
                                                      <button
                                                        onClick={() => {
                                                          setDeletingResponseId(
                                                            response.id,
                                                          );
                                                          setShowDeleteConfirm(
                                                            true,
                                                          );
                                                        }}
                                                        className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                                        title="Delete Response"
                                                      >
                                                        <Trash2 className="w-4 h-4" />
                                                      </button>
                                                    </>
                                                  )}
                                              </>
                                            );
                                          })()}
                                        </>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-center border border-gray-200 dark:border-gray-700 whitespace-nowrap">
                                    {(() => {
                                      const respId = response.id || (response as any)._id;
                                      const status =
                                        tableDisplayStatuses[response.id] ||
                                        tableDisplayStatuses[(response as any)._id] ||
                                        (respId ? tableDisplayStatuses[respId] : null) ||
                                        responseStatuses[response.id] ||
                                        responseStatuses[(response as any)._id] ||
                                        (respId ? responseStatuses[respId] : null) ||
                                        computeFastRowStatus(response, chassisQuestionId) ||
                                        (response.status && response.status !== "pending" ? response.status : "Direct Ok");

                                      // 1️⃣ Check if response is eligible for dispatch based on status
                                      const canShowDispatch = status === "Direct Ok" ||
                                        status === "Rework Accepted" ||
                                        status === "Rework Completed" ||
                                        status === "Accepted";

                                      // 2️⃣ Use the tenant check function
                                      const isSameTenant = isOwnTenantResponse(response);

                                      // ❌ Not eligible based on status
                                      if (!canShowDispatch) {
                                        return <span className="text-gray-400 text-xs">-</span>;
                                      }

                                      // ✅ Already dispatched - show read-only badge
                                      if (response.isDispatched) {
                                        const dispatchDate = response.dispatchedAt ? new Date(response.dispatchedAt) : null;
                                        return (
                                          <div className="flex flex-col items-center justify-center text-xs text-center gap-0.5">
                                            <div className="flex items-center text-green-600 font-medium">
                                              <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                              <span>Enabled</span>
                                            </div>
                                            {response.dispatchedByName ? (
                                              <span className="text-gray-600 dark:text-gray-300 text-[10px] font-semibold whitespace-nowrap">
                                                {response.dispatchedByName}
                                              </span>
                                            ) : (
                                              <span className="text-gray-400 text-[10px] italic">Unknown user</span>
                                            )}
                                            {dispatchDate && (
                                              <span className="text-gray-400 text-[9px] whitespace-nowrap">
                                                {dispatchDate.toLocaleDateString()} · {dispatchDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      }

                                      // 🔒 CROSS-TENANT: Show dash (NO CHECKBOX)
                                      if (!isSameTenant) {
                                        return <span className="text-gray-400 text-xs">-</span>;
                                      }

                                      // ✅ SAME TENANT: Show checkboxa
                                      return (
                                        <input
                                          type="checkbox"
                                          checked={selectedDispatchIds.includes(response.id)}
                                          disabled={isBulkDispatching}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            if (e.target.checked) {
                                              setSelectedDispatchIds(prev => [...prev, response.id]);
                                            } else {
                                              setSelectedDispatchIds(prev => prev.filter(id => id !== response.id));
                                            }
                                          }}
                                          className="w-4 h-4 text-green-600 border-gray-300 dark:border-gray-600 rounded cursor-pointer accent-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                          title="Select for dispatch"
                                        />
                                      );
                                    })()}
                                  </td>
                                  <td className="px-6 py-3 text-sm text-gray-900 dark:text-white font-bold border border-gray-200 dark:border-gray-700 min-w-48 whitespace-nowrap bg-gray-50/50 dark:bg-gray-800/30">
                                    {response.submittedBy ||
                                      response.createdBy ||
                                      "Anonymous"}
                                  </td>
                                  <td className="px-6 py-3 text-sm font-bold border border-gray-200 dark:border-gray-700 min-w-32 whitespace-nowrap bg-gray-50/50 dark:bg-gray-800/30">
                                    {(() => {
                                      const respId = response.id || (response as any)._id;
                                      const rowStatus =
                                        tableDisplayStatuses[response.id] ||
                                        tableDisplayStatuses[(response as any)._id] ||
                                        (respId ? tableDisplayStatuses[respId] : null) ||
                                        responseStatuses[response.id] ||
                                        responseStatuses[(response as any)._id] ||
                                        (respId ? responseStatuses[respId] : null) ||
                                        computeFastRowStatus(response, chassisQuestionId) ||
                                        (response.status && response.status !== "pending" ? response.status : "Direct Ok");

                                      return (
                                        <span
                                          className={`px-2 py-1 rounded-full text-xs ${rowStatus === "Rejected"
                                            ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                                            : rowStatus?.includes("Rework") &&
                                              rowStatus !== "Rework Accepted"
                                              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                                              : rowStatus === "Direct Ok" ||
                                                rowStatus === "Rework Accepted" ||
                                                rowStatus === "Accepted"
                                                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                                : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                            }`}
                                        >
                                          {rowStatus || "Direct Ok"}
                                        </span>
                                      );
                                    })()}
                                  </td>
                                  <td className="px-6 py-3 text-sm text-gray-900 dark:text-white font-medium border border-gray-200 dark:border-gray-700 min-w-40 whitespace-nowrap bg-gray-50/50 dark:bg-gray-800/30">
                                    {editingChassisResponseId === response.id ? (
                                      <div className="flex items-center gap-1.5">
                                        <select
                                          value={chassisEditValue}
                                          onChange={(e) => setChassisEditValue(e.target.value)}
                                          autoFocus
                                          className="flex-1 px-2 py-1 text-xs border border-blue-400 dark:border-blue-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                          <option value="">Select Chassis</option>
                                          {chassisMasterOptions.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                              {opt.label}
                                            </option>
                                          ))}
                                          {chassisEditValue &&
                                            !chassisMasterOptions.some((o) => o.value === chassisEditValue) && (
                                              <option value={chassisEditValue}>
                                                {chassisEditValue} (current)
                                              </option>
                                            )}
                                        </select>
                                        <button
                                          onClick={() => handleSaveChassisEdit(response)}
                                          disabled={isSavingChassis}
                                          title="Save"
                                          className="p-1 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors disabled:opacity-50"
                                        >
                                          <CheckCircle className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={handleCancelChassisEdit}
                                          disabled={isSavingChassis}
                                          title="Cancel"
                                          className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                                        >
                                          <XCircle className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5 group">
                                        {(() => {
                                          const chassisVal = getResponseChassisValue(response);
                                          return chassisVal && chassisVal !== "-" && chassisVal !== "N/A" && chassisVal !== "None" ? (
                                            <span className="text-gray-900 dark:text-gray-100 font-medium text-xs">
                                              {chassisVal}
                                            </span>
                                          ) : (
                                            <span className="text-gray-400 dark:text-gray-500 text-xs font-medium">None</span>
                                          );
                                        })()}
                                        <button
                                          onClick={() => handleStartChassisEdit(response)}
                                          title="Edit Chassis"
                                          className="p-1 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-all opacity-0 group-hover:opacity-100"
                                        >
                                          <Edit className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                  {showParentMatchColumn && (
                                    <td className="px-4 py-3 text-xs border border-gray-200 dark:border-gray-700 min-w-44 whitespace-nowrap bg-indigo-50/20 dark:bg-indigo-950/10">
                                      {(() => {
                                        const pm = computeParentMatch(response);
                                        const Icon = pm.icon || CheckCircle2;
                                        return (
                                          <div className="flex flex-col gap-0.5" title={pm.tooltip}>
                                            <div className="flex items-center gap-1.5">
                                              <span
                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors shadow-2xs ${pm.badgeClasses}`}
                                              >
                                                <Icon className="w-3 h-3 shrink-0" />
                                                <span>{pm.badgeText}</span>
                                              </span>
                                            </div>
                                            {pm.subText && (
                                              <span className="text-xs text-gray-600 dark:text-gray-300 pl-0.5 font-medium truncate max-w-[170px]">
                                                {pm.subText}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </td>
                                  )}
                                  <td className="px-6 py-3 text-sm border border-gray-200 dark:border-gray-700 min-w-48 whitespace-nowrap bg-gray-50/50 dark:bg-gray-800/30">
                                    {(() => {
                                      const localReview = reviewedBy[response.id];
                                      const legacyServerReview = (response as any).review;

                                      let reviewObj: {
                                        status: any;
                                        reviewer: any;
                                        flaggedQuestions: any[];
                                      } | null = null;

                                      if (localReview) {
                                        reviewObj = {
                                          status: localReview.option || localReview.status,
                                          reviewer: localReview.reviewer || localReview.name,
                                          flaggedQuestions: localReview.flaggedQuestions || [],
                                        };
                                      } else if (legacyServerReview) {
                                        reviewObj = {
                                          status: legacyServerReview.status,
                                          reviewer: legacyServerReview.reviewer || legacyServerReview.name,
                                          flaggedQuestions: legacyServerReview.flaggedQuestions || [],
                                        };
                                      }

                                      if (reviewObj && !reviewObj.reviewer) {
                                        reviewObj.reviewer = "Reviewer";
                                      }

                                      return reviewObj ? (

                                        <div className="flex flex-col gap-1">
                                          <div className="flex items-center gap-2">
                                            <span
                                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${String(reviewObj.status)
                                                .toLowerCase()
                                                .trim() === "accepted"
                                                ? "bg-green-500/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
                                                : String(reviewObj.status)
                                                  .toLowerCase()
                                                  .trim() === "rejected"
                                                  ? "bg-red-500/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
                                                  : "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800"
                                                }`}
                                            >
                                              {reviewObj.status}
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                              by{" "}
                                              <span className="font-semibold text-gray-700 dark:text-gray-300">
                                                {reviewObj.reviewer}
                                              </span>
                                            </span>
                                          </div>
                                          {reviewObj.flaggedQuestions &&
                                            reviewObj.flaggedQuestions.length >
                                            0 && (
                                              <div className="mt-1 flex flex-wrap gap-1">
                                                {reviewObj.flaggedQuestions.map(
                                                  (q: any, i: number) => (
                                                    <span
                                                      key={i}
                                                      className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-[10px] text-gray-600 dark:text-gray-400 rounded border border-gray-200 dark:border-gray-700 line-clamp-1"
                                                      title={q}
                                                    >
                                                      {q}
                                                    </span>
                                                  ),
                                                )}
                                              </div>
                                            )}
                                        </div>
                                      ) : (
                                        <span className="text-gray-600 dark:text-gray-300 font-medium text-xs">
                                          No review yet
                                        </span>
                                      );
                                    })()}
                                  </td>
                                  {/* BIW Review Column - Complete Fixed Version */}
                                  <td className="px-4 py-3 border border-gray-200 dark:border-gray-700 min-w-40 bg-purple-50/50 dark:bg-purple-900/10">
                                    {(() => {
                                      const isSubmitter = isSubmitterOfResponse(response);
                                      const currentStatus = response.biwReview?.status;
                                      const isSaving = biwSavingResponseId === response.id;

                                      // 🔥 FIX: Define options here - this is the missing piece!
                                      const biwOptions: {
                                        status: "Accepted" | "Rejected" | "Reworked";
                                        label: string;
                                        icon: any;
                                        activeClass: string;
                                      }[] = [
                                          {
                                            status: "Accepted",
                                            label: "Accept",
                                            icon: CheckCircle,
                                            activeClass: "text-green-600 dark:text-green-400",
                                          },
                                          {
                                            status: "Rejected",
                                            label: "Reject",
                                            icon: XCircle,
                                            activeClass: "text-red-600 dark:text-red-400",
                                          },
                                          {
                                            status: "Reworked",
                                            label: "Rework",
                                            icon: RotateCcw,
                                            activeClass: "text-orange-600 dark:text-orange-400",
                                          },
                                        ];

                                      // Get checked state
                                      const isChecked = selectedBiwIds.includes(response.id);
                                      const rowKey = `biw-${response.id}-${isChecked ? 'selected' : 'unselected'}`;

                                      return (
                                        <div className="flex flex-col gap-1.5" key={rowKey}>
                                          {/* Selection checkbox */}
                                          <div className="flex items-center gap-2 mb-1 border-b border-gray-200 dark:border-gray-700 pb-1">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();

                                                if (e.target.checked) {
                                                  setSelectedBiwIds(prev => [...prev, response.id]);
                                                } else {
                                                  setSelectedBiwIds(prev => prev.filter(id => id !== response.id));
                                                }
                                              }}
                                              className="w-3.5 h-3.5 text-purple-600 border-gray-300 dark:border-gray-600 rounded cursor-pointer accent-purple-600"
                                              title="Select for bulk review"
                                            />
                                            <span className="text-xs text-gray-700 dark:text-gray-300 font-bold uppercase">Select</span>
                                            {isChecked && (
                                              <span className="ml-auto text-[9px] font-bold text-purple-600 bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 rounded">
                                                ✓
                                              </span>
                                            )}
                                          </div>

                                          {/* BIW Review Status Options */}
                                          {biwOptions.map((opt) => {
                                            const Icon = opt.icon;
                                            const checked = currentStatus === opt.status;
                                            return (
                                              <label
                                                key={opt.status}
                                                title={isSubmitter ? "You cannot BIW review your own submission" : opt.label}
                                                className={`flex items-center gap-1.5 text-xs font-medium ${isSubmitter
                                                  ? "opacity-40 cursor-not-allowed"
                                                  : "cursor-pointer"
                                                  } ${checked ? opt.activeClass : "text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"}`}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={checked}
                                                  disabled={isSubmitter || isSaving}
                                                  onChange={() => {
                                                    console.log(`[BIW] Status change for ${response.id}: ${opt.status}`);
                                                    handleBiwReviewChange(response, opt.status);
                                                  }}
                                                  className="w-3.5 h-3.5 rounded cursor-pointer accent-current disabled:cursor-not-allowed"
                                                />
                                                <Icon className="w-3.5 h-3.5" />
                                                <span>{opt.label}</span>
                                              </label>
                                            );
                                          })}

                                          {isSaving && (
                                            <span className="flex items-center gap-1 text-[10px] text-gray-400">
                                              <Loader2 className="w-3 h-3 animate-spin" />
                                              Saving...
                                            </span>
                                          )}

                                          {/* NEW - Eye icon: once a review is saved (any status), open
                                              the read-only view modal showing remark/questions/evidence. */}
                                          {currentStatus && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setBiwViewResponse(response);
                                                setShowBiwViewModal(true);
                                              }}
                                              className="flex items-center gap-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 border-t border-gray-200 dark:border-gray-700 pt-1.5 mt-0.5"
                                              title="View BIW review details"
                                            >
                                              <Eye className="w-3.5 h-3.5" />
                                              <span>View</span>
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </td>
                                  <td className="px-6 py-3 text-xs border border-gray-200 dark:border-gray-700 min-w-44 whitespace-nowrap">
                                    {(() => {
                                      const rawTs = getResponseTimestamp(response);
                                      if (!rawTs) return <span className="text-gray-400 font-normal">-</span>;
                                      const d = new Date(rawTs);
                                      if (isNaN(d.getTime())) {
                                        return (
                                          <span className="text-gray-600 dark:text-gray-300 font-medium">
                                            {formatToDDMMYYYY(rawTs)}
                                          </span>
                                        );
                                      }
                                      const day = String(d.getDate()).padStart(2, "0");
                                      const month = String(d.getMonth() + 1).padStart(2, "0");
                                      const year = d.getFullYear();
                                      const dateFormatted = `${day}/${month}/${year}`;
                                      const timeFormatted = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

                                      return (
                                        <div className="flex flex-col gap-0.5 select-text">
                                          <span className="font-semibold text-gray-800 dark:text-gray-200 tracking-tight">
                                            {dateFormatted}
                                          </span>
                                          <span className="text-[11px] text-gray-500 dark:text-gray-400 font-normal">
                                            {timeFormatted}
                                          </span>
                                        </div>
                                      );
                                    })()}
                                  </td>

                                  <td className="px-4 py-3 text-sm text-center border border-gray-200 dark:border-gray-700 whitespace-nowrap">
                                    {(() => {
                                      const timeSpent =
                                        response.timeSpent ??
                                        response.totalTimeSpent;
                                      const respId = response.id || (response as any)._id;
                                      const rank =
                                        chassisAttemptRanks[respId] ||
                                        (response.responseRanks && typeof response.responseRanks === 'object'
                                          ? (chassisQuestionId && response.responseRanks[chassisQuestionId]) || Object.values(response.responseRanks).find((v: any) => typeof v === 'number' && v > 0)
                                          : null) ||
                                        1;
                                      const rowStatus =
                                        tableDisplayStatuses[respId] ||
                                        responseStatuses[respId] ||
                                        computeFastRowStatus(response, chassisQuestionId) ||
                                        "Direct Ok";

                                      const getRankBadgeClass = (status: string) => {
                                        if (status === "Rejected") {
                                          return "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700";
                                        }
                                        if (
                                          status?.includes("Rework") &&
                                          status !== "Rework Accepted" &&
                                          status !== "Rework Completed"
                                        ) {
                                          return "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700";
                                        }
                                        if (
                                          status === "Direct Ok" ||
                                          status === "Rework Accepted" ||
                                          status === "Accepted" ||
                                          status === "Rework Completed" ||
                                          status === "Verified"
                                        ) {
                                          return "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700";
                                        }
                                        return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600";
                                      };

                                      return (
                                        <div className="flex items-center justify-center gap-2">
                                          {/* Time Taken duration */}
                                          {timeSpent !== undefined &&
                                          timeSpent !== null &&
                                          timeSpent > 0 && (
                                            <div className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 text-xs">
                                              <Clock className="w-3.5 h-3.5 text-blue-500" />
                                              <span>
                                                {timeSpent > 60
                                                  ? `${Math.floor(timeSpent / 60)}m ${timeSpent % 60}s`
                                                  : `${timeSpent}s`}
                                              </span>
                                            </div>
                                          )}

                                          {/* Chassis Attempt Rank Badge (1, 2, etc.) placed AFTER time taken with status-based color */}
                                          <span
                                            title={`Chassis inspection attempt #${rank} (${rowStatus})`}
                                            className={`text-[11px] font-extrabold min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center border shadow-xs ${getRankBadgeClass(rowStatus)}`}
                                          >
                                            {rank}
                                          </span>
                                        </div>
                                      );
                                    })()}
                                  </td>
                                  {form?.sections?.map(
                                    (section: Section) =>
                                      selectedResponsesSectionIds.includes(
                                        section.id,
                                      ) &&
                                      section.questions?.map((q: any) => {
                                        const isFollowUp =
                                          q.parentId || q.showWhen?.questionId;
                                        const isEditing =
                                          editingResponseId === response.id;
                                        const hasCorrectAnswer =
                                          q.correctAnswer !== undefined;
                                        const answer = response.answers?.[q.id];

                                        let isCorrect = false;
                                        if (
                                          hasCorrectAnswer &&
                                          answer !== undefined &&
                                          answer !== null &&
                                          answer !== ""
                                        ) {
                                          const answerStr = Array.isArray(
                                            answer,
                                          )
                                            ? answer.join(", ").toLowerCase()
                                            : String(answer).toLowerCase();
                                          const correctStr = Array.isArray(
                                            q.correctAnswer,
                                          )
                                            ? q.correctAnswer
                                              .join(", ")
                                              .toLowerCase()
                                            : String(
                                              q.correctAnswer,
                                            ).toLowerCase();
                                          isCorrect = answerStr === correctStr;
                                        }

                                        return (
                                          <td
                                            key={`${response.id}-${q.id}`}
                                            className={`px-6 py-3 text-sm border border-gray-200 dark:border-gray-700 min-w-64 break-words ${isFollowUp
                                              ? "bg-purple-50 dark:bg-purple-900/10"
                                              : ""
                                              } ${hasCorrectAnswer && !isEditing
                                                ? isCorrect
                                                  ? "bg-green-100 dark:bg-green-900/30"
                                                  : "bg-red-100 dark:bg-red-900/30"
                                                : ""
                                              }`}
                                          >
                                            {isEditing ? (
                                              <input
                                                type="text"
                                                value={
                                                  typeof editFormData[q.id] ===
                                                    "object" &&
                                                    "status" in editFormData[q.id]
                                                    ? editFormData[q.id].status
                                                    : editFormData[q.id]
                                                      ? typeof editFormData[
                                                        q.id
                                                      ] === "string"
                                                        ? editFormData[q.id]
                                                        : JSON.stringify(
                                                          editFormData[q.id],
                                                          null,
                                                          2,
                                                        )
                                                      : ""
                                                }
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  if (
                                                    editFormData[q.id] &&
                                                    typeof editFormData[
                                                    q.id
                                                    ] === "object" &&
                                                    "status" in
                                                    editFormData[q.id]
                                                  ) {
                                                    setEditFormData({
                                                      ...editFormData,
                                                      [q.id]: {
                                                        ...editFormData[q.id],
                                                        status: val,
                                                      },
                                                    });
                                                  } else {
                                                    let parsed;
                                                    try {
                                                      parsed = JSON.parse(val);
                                                    } catch {
                                                      parsed = val;
                                                    }
                                                    setEditFormData({
                                                      ...editFormData,
                                                      [q.id]: parsed,
                                                    });
                                                  }
                                                }}
                                                className="w-full px-2 py-1 border border-blue-400 dark:border-blue-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Enter answer"
                                              />
                                            ) : (
                                              <div className="flex flex-col gap-1 max-w-[250px] overflow-auto max-h-[250px]">
                                                {renderAnswerDisplay(answer, q)}
                                                {q.trackResponseRank &&
                                                  response.responseRanks?.[
                                                  q.id
                                                  ] && (
                                                    <span
                                                      className={`text-[10px] font-bold min-w-[24px] h-6 px-1.5 rounded-full flex items-center justify-center border shadow-sm w-fit mt-1 ${getRankStyle(answer, darkMode)}`}
                                                    >
                                                      #
                                                      {
                                                        response.responseRanks[
                                                        q.id
                                                        ]
                                                      }
                                                    </span>
                                                  )}
                                              </div>
                                            )}
                                          </td>
                                        );
                                      }),
                                  )}
                                </tr>
                              ),
                            )
                          ) : loadingTable ? (
                            Array.from({ length: 6 }).map((_, rIdx) => (
                              <tr key={`skel-row-${rIdx}`} className="animate-pulse">
                                <td className="hidden sm:table-cell px-3 py-4 border border-gray-200 dark:border-gray-700">
                                  <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded mx-auto"></div>
                                </td>
                                <td className="px-4 py-4 border border-gray-200 dark:border-gray-700">
                                  <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded mx-auto"></div>
                                </td>
                                <td className="px-6 py-4 border border-gray-200 dark:border-gray-700">
                                  <div className="w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                </td>
                                <td className="px-6 py-4 border border-gray-200 dark:border-gray-700">
                                  <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                </td>
                                <td className="px-6 py-4 border border-gray-200 dark:border-gray-700">
                                  <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                </td>
                                <td className="px-6 py-4 border border-gray-200 dark:border-gray-700">
                                  <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                </td>
                                {showParentMatchColumn && (
                                  <td className="px-4 py-4 border border-gray-200 dark:border-gray-700">
                                    <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                  </td>
                                )}
                                <td className="px-4 py-4 border border-gray-200 dark:border-gray-700">
                                  <div className="w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded mx-auto"></div>
                                </td>
                                <td className="px-6 py-4 border border-gray-200 dark:border-gray-700">
                                  <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                </td>
                                <td className="px-4 py-4 border border-gray-200 dark:border-gray-700">
                                  <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded mx-auto"></div>
                                </td>
                                {form?.sections?.map(
                                  (section: Section) =>
                                    selectedResponsesSectionIds.includes(section.id) &&
                                    section.questions?.map((q: any) => (
                                      <td key={`skel-${q.id}`} className="px-4 py-4 border border-gray-200 dark:border-gray-700">
                                        <div className="w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                      </td>
                                    ))
                                )}
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={
                                  (showParentMatchColumn ? 10 : 9) +
                                  (form?.sections?.reduce(
                                    (acc: number, sec: Section) =>
                                      selectedResponsesSectionIds.includes(
                                        sec.id,
                                      )
                                        ? acc + (sec.questions?.length || 0)
                                        : acc,
                                    0,
                                  ) || 0)
                                }
                                className="px-4 py-6 text-center text-gray-500 dark:text-gray-400"
                              >
                                No responses yet
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                    Select at least one section to view responses
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Cascading Filter Modal */}
      {/* Cascading Filter Modal */}
      <CascadingFilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        questions={
          (form?.sections?.flatMap((s: any) => s.questions || []) || []).filter(
            (q: any) => !q.parentId && !q.showWhen?.questionId,
          )
        }
        responses={responses}
        onApplyFilters={(filters) => {
          setHasUserAppliedDateFilter(true); // user has taken explicit control of filtering
          const { dates, locations, ...questionFilters } = filters as any;

          // ✅ Build applied filters array for display
          const newAppliedFilters: Array<{ id: string; label: string; value: string }> = [];

          // Add question filters
          Object.entries(questionFilters).forEach(([questionId, answers]) => {
            if (Array.isArray(answers) && answers.length > 0) {
              // Find the question text from the form
              let questionText = questionId;
              if (form?.sections) {
                for (const section of form.sections) {
                  const found = section.questions?.find((q: any) => q.id === questionId);
                  if (found) {
                    questionText = found.text || found.label || questionId;
                    break;
                  }
                }
              }
              newAppliedFilters.push({
                id: questionId,
                label: questionText,
                value: answers.join(', ')
              });
            }
          });

          // Add location filters
          if (locations && locations.length > 0) {
            newAppliedFilters.push({
              id: 'location',
              label: 'Location',
              value: locations.join(', ')
            });
          }

          // Add date filters
          if (dates && (dates.startDate || dates.endDate)) {
            let dateLabel = 'Date';
            let dateValue = '';
            if (dates.startDate && dates.endDate) {
              dateValue = `${dates.startDate} to ${dates.endDate}`;
            } else if (dates.startDate) {
              dateValue = `From ${dates.startDate}`;
            } else if (dates.endDate) {
              dateValue = `Until ${dates.endDate}`;
            }
            newAppliedFilters.push({
              id: 'date',
              label: dateLabel,
              value: dateValue
            });
          }

          // ✅ Update appliedFilters state
          setAppliedFilters(newAppliedFilters);

          // Update other filter states
          setCascadingFilters(questionFilters);
          if (dates) {
            setDateFilter({
              type: dates.startDate || dates.endDate ? "range" : "all",
              startDate: dates.startDate || "",
              endDate: dates.endDate || "",
            });
          }
          if (locations && locations.length > 0) {
            setLocationFilter(locations);
          }

          // Close the modal
          setShowFilterModal(false);
        }}
      />

      {selectedResponse && selectedFormForModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white dark:bg-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Response Details
              </h2>
              <button
                onClick={() => {
                  setSelectedResponse(null);
                  setSelectedFormForModal(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                    Form
                  </p>
                  <p className="text-gray-900 dark:text-white">
                    {selectedFormForModal?.title || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                    Submitted
                  </p>
                  <p className="text-gray-900 dark:text-white">
                    {getResponseTimestamp(selectedResponse)
                      ? formatToDDMMYYYY(
                        getResponseTimestamp(selectedResponse)!,
                        true
                      )
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                    Time Taken
                  </p>
                  <p className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {(() => {
                      const timeSpent =
                        selectedResponse.timeSpent ??
                        selectedResponse.totalTimeSpent ??
                        0;
                      return timeSpent > 0
                        ? timeSpent > 60
                          ? `${Math.floor(timeSpent / 60)}m ${timeSpent % 60}s`
                          : `${timeSpent}s`
                        : "N/A";
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                    Chassis Number
                  </p>
                  <p className="text-gray-900 dark:text-white font-mono font-bold text-sm">
                    {(() => {
                      const cv = getResponseChassisValue(selectedResponse);
                      return cv && cv !== "-" && cv !== "N/A" ? cv : "None";
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    Parent Match / Status
                  </p>
                  {(() => {
                    const pm = computeParentMatch(selectedResponse);
                    const Icon = pm.icon || CheckCircle2;
                    return (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border shadow-xs ${pm.badgeClasses}`} title={pm.tooltip}>
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span>{pm.badgeText}</span>
                        {pm.subText && <span className="opacity-75 font-normal ml-1">({pm.subText})</span>}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {selectedFormForModal?.sections?.map((section: Section) => (
                <div
                  key={section.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-4">
                    {section.title}
                  </h3>
                  <div className="space-y-4">
                    {section.questions?.map((question: any) => {
                      const answer = selectedResponse.answers?.[question.id];
                      return (
                        <div
                          key={question.id}
                          className="border-l-4 border-blue-300 dark:border-blue-700 pl-4"
                        >
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                            {question.text}
                          </p>
                          <div className="text-gray-900 dark:text-gray-100 flex flex-col gap-1">
                            {hasAnswerValue(answer) ? (
                              renderAnswerDisplay(answer, question)
                            ) : (
                              <span className="text-gray-400">No response</span>
                            )}
                            {question.trackResponseRank &&
                              selectedResponse.responseRanks?.[question.id] && (
                                <span
                                  className={`text-[10px] font-bold min-w-[24px] h-6 px-1.5 rounded-full flex items-center justify-center border shadow-sm ${getRankStyle(answer, darkMode)}`}
                                >
                                  #{selectedResponse.responseRanks[question.id]}
                                </span>
                              )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {selectedFormForModal?.followUpQuestions?.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-4">
                    Follow-up Questions
                  </h3>
                  <div className="space-y-4">
                    {selectedFormForModal.followUpQuestions.map(
                      (question: any) => {
                        const answer = selectedResponse.answers?.[question.id];
                        return (
                          <div
                            key={question.id}
                            className="border-l-4 border-purple-300 dark:border-purple-700 pl-4"
                          >
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                              {question.text}
                            </p>
                            <div className="text-gray-900 dark:text-gray-100 flex flex-col gap-1">
                              {hasAnswerValue(answer) ? (
                                renderAnswerDisplay(answer, question)
                              ) : (
                                <span className="text-gray-400">
                                  No response
                                </span>
                              )}
                              {question.trackResponseRank &&
                                selectedResponse.responseRanks?.[
                                question.id
                                ] && (
                                  <span
                                    className={`text-[10px] font-bold min-w-[24px] h-6 px-1.5 rounded-full flex items-center justify-center border shadow-sm ${getRankStyle(answer, darkMode)}`}
                                  >
                                    #
                                    {
                                      selectedResponse.responseRanks[
                                      question.id
                                      ]
                                    }
                                  </span>
                                )}
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-800 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => {
                  setSelectedResponse(null);
                  setSelectedFormForModal(null);
                }}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comparison View - Last 3 Responses */}
      {analyticsView === "comparison" && (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="p-4 sm:p-6">
            {/* View Mode Tabs */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex gap-1 bg-white dark:bg-gray-700 rounded-lg p-1 w-fit border border-gray-200 dark:border-gray-600">
                <button
                  onClick={() => setComparisonViewMode("dashboard")}
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${comparisonViewMode === "dashboard"
                    ? "text-white shadow-sm"
                    : "text-gray-900 dark:text-gray-100 hover:text-black dark:hover:text-white"
                    }`}
                  style={{
                    backgroundColor:
                      comparisonViewMode === "dashboard"
                        ? "#1e3a8a"
                        : "transparent",
                  }}
                >
                  <BarChart3 className="w-4 h-4" />
                  Dashboard
                </button>
                <button
                  onClick={() => setComparisonViewMode("responses")}
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${comparisonViewMode === "responses"
                    ? "text-white shadow-sm"
                    : "text-gray-900 dark:text-gray-100 hover:text-black dark:hover:text-white"
                    }`}
                  style={{
                    backgroundColor:
                      comparisonViewMode === "responses"
                        ? "#1e3a8a"
                        : "transparent",
                  }}
                >
                  <FileText className="w-4 h-4" />
                  Responses
                </button>
              </div>

              <div className="flex items-center gap-6 mx-4">
                <div className="text-center">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                    {form?.title}
                  </h2>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Last 5 Responses Comparison
                  </p>
                </div>
              </div>
            </div>

            {/* Content Area */}
            {comparisonViewMode === "dashboard" ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-5 gap-4">
                {(() => {
                  const last5 = filteredResponses
                    .filter((r) => getResponseTimestamp(r))
                    .sort((a, b) => {
                      const dateA = new Date(
                        getResponseTimestamp(a)!,
                      ).getTime();
                      const dateB = new Date(
                        getResponseTimestamp(b)!,
                      ).getTime();
                      return dateB - dateA;
                    })
                    .slice(0, 5);

                  if (last5.length === 0) {
                    return (
                      <div className="col-span-full flex flex-col items-center justify-center min-h-64 py-12">
                        <UsersIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                        <p className="text-gray-600 dark:text-gray-400 font-medium">
                          No responses to compare
                        </p>
                      </div>
                    );
                  }

                  return last5.map((response, idx) => {
                    const sectionStats = getSectionYesNoStats(
                      form,
                      response.answers || {},
                    );
                    const filteredSectionStats = sectionStats.filter(
                      (stat) =>
                        stat.yes > 0 ||
                        stat.no > 0 ||
                        stat.na > 0 ||
                        (stat.accepted && stat.accepted > 0) ||
                        (stat.rejected && stat.rejected > 0) ||
                        (stat.rework && stat.rework > 0),
                    );

                    const totalQuestions = filteredSectionStats.reduce(
                      (sum, stat) => sum + stat.total,
                      0,
                    );
                    const totalYes = filteredSectionStats.reduce(
                      (sum, stat) => sum + stat.yes + (stat.accepted || 0),
                      0,
                    );
                    const totalNo = filteredSectionStats.reduce(
                      (sum, stat) => sum + stat.no + (stat.rejected || 0),
                      0,
                    );
                    const totalNA = filteredSectionStats.reduce(
                      (sum, stat) => sum + stat.na + (stat.rework || 0),
                      0,
                    );
                    const totalAnswered = totalYes + totalNo + totalNA;

                    const overallScore =
                      totalQuestions > 0
                        ? ((totalYes / totalQuestions) * 100).toFixed(1)
                        : "0.0";
                    const responseRate =
                      totalQuestions > 0
                        ? ((totalAnswered / totalQuestions) * 100).toFixed(1)
                        : "0.0";
                    const yesPercent =
                      totalAnswered > 0
                        ? ((totalYes / totalAnswered) * 100).toFixed(1)
                        : "0.0";
                    const noPercent =
                      totalAnswered > 0
                        ? ((totalNo / totalAnswered) * 100).toFixed(1)
                        : "0.0";
                    const naPercent =
                      totalAnswered > 0
                        ? ((totalNA / totalAnswered) * 100).toFixed(1)
                        : "0.0";

                    return (
                      <div
                        key={response.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-gray-800 flex flex-col h-full"
                      >
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                          <div className="flex flex-col items-center text-center">
                            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase mb-1">
                              Submission #{idx + 1}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {getResponseTimestamp(response)
                                ? formatToDDMMYYYY(
                                  getResponseTimestamp(response)!,
                                  true
                                )
                                : "N/A"}
                            </p>
                            <p className="text-2xl font-bold text-blue-900 dark:text-blue-300 mt-2">
                              {overallScore}%
                            </p>
                            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase mt-1">
                              Overall Score
                            </p>
                          </div>
                        </div>

                        <div className="p-4 space-y-3 flex-1">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded border border-indigo-200 dark:border-indigo-700 text-center">
                              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase">
                                Sections
                              </p>
                              <p className="text-xl font-bold text-indigo-900 dark:text-indigo-300">
                                {filteredSectionStats.length}
                              </p>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-200 dark:border-green-700 text-center">
                              <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase">
                                Rate
                              </p>
                              <p className="text-xl font-bold text-green-900 dark:text-green-300">
                                {responseRate}%
                              </p>
                            </div>
                            <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded border border-purple-200 dark:border-purple-700 text-center">
                              <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase">
                                Questions
                              </p>
                              <p className="text-xl font-bold text-purple-900 dark:text-purple-300">
                                {totalQuestions}
                              </p>
                            </div>
                          </div>

                          <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                            <p className="text-xs font-semibold text-gray-900 dark:text-white mb-2 text-center">
                              Distribution
                            </p>
                            <div className="space-y-1">
                              <div className="text-center p-2 bg-green-100/60 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-700">
                                <p className="text-xs font-semibold text-green-700 dark:text-green-400">
                                  {complianceLabels.yes}
                                </p>
                                <p className="text-sm font-bold text-green-800 dark:text-green-300">
                                  {totalYes} ({yesPercent}%)
                                </p>
                              </div>
                              <div className="text-center p-2 bg-red-100/60 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-700">
                                <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                                  {complianceLabels.no}
                                </p>
                                <p className="text-sm font-bold text-red-800 dark:text-red-300">
                                  {totalNo} ({noPercent}%)
                                </p>
                              </div>
                              <div className="text-center p-2 bg-yellow-100/60 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-700">
                                <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">
                                  {complianceLabels.na}
                                </p>
                                <p className="text-sm font-bold text-yellow-800 dark:text-yellow-300">
                                  {totalNA} ({naPercent}%)
                                </p>
                              </div>
                            </div>
                          </div>

                          {filteredSectionStats.length > 0 && (
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                              <p className="text-xs font-semibold text-gray-900 dark:text-white mb-3">
                                Sections
                              </p>
                              <div className="space-y-4">
                                {filteredSectionStats.map((row) => {
                                  const rowYes = row.yes + (row.accepted || 0);
                                  const rowNo = row.no + (row.rejected || 0);
                                  const rowNA = row.na + (row.rework || 0);
                                  const total = rowYes + rowNo + rowNA;
                                  const yesPercent =
                                    total > 0
                                      ? ((rowYes / total) * 100).toFixed(1)
                                      : 0;
                                  const noPercent =
                                    total > 0
                                      ? ((rowNo / total) * 100).toFixed(1)
                                      : 0;
                                  const naPercent =
                                    total > 0
                                      ? ((rowNA / total) * 100).toFixed(1)
                                      : 0;

                                  const chartData = {
                                    labels: [
                                      `${complianceLabels.yes} (${yesPercent}%)`,
                                      `${complianceLabels.no} (${noPercent}%)`,
                                      `${complianceLabels.na} (${naPercent}%)`,
                                    ],
                                    datasets: [
                                      {
                                        data: [rowYes, rowNo, rowNA],
                                        backgroundColor: [
                                          "#1e3a8a",
                                          "#3b82f6",
                                          "#93c5fd",
                                        ],
                                        borderColor: [
                                          "#1e3a8a",
                                          "#3b82f6",
                                          "#93c5fd",
                                        ],
                                        borderWidth: 2,
                                        borderRadius: 4,
                                      },
                                    ],
                                  };

                                  return (
                                    <div
                                      key={row.id}
                                      className="p-3 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/40 dark:to-gray-800/40 rounded-lg border border-gray-200 dark:border-gray-600"
                                    >
                                      <p className="font-semibold text-gray-900 dark:text-white text-[11px] mb-3">
                                        {row.title}
                                      </p>

                                      <div className="flex gap-3">
                                        <div className="flex-1 flex items-center justify-center">
                                          <div className="w-24 h-24">
                                            <Doughnut
                                              data={chartData}
                                              options={{
                                                responsive: true,
                                                maintainAspectRatio: true,
                                                plugins: {
                                                  legend: {
                                                    display: false,
                                                  },
                                                  tooltip: {
                                                    backgroundColor:
                                                      "rgba(0, 0, 0, 0.8)",
                                                    titleColor: "#ffffff",
                                                    bodyColor: "#ffffff",
                                                    borderColor: "#ffffff",
                                                    borderWidth: 1,
                                                    callbacks: {
                                                      label: (context) => {
                                                        return `${context.label}: ${context.parsed}`;
                                                      },
                                                    },
                                                  },
                                                  datalabels: {
                                                    color: "#ffffff",
                                                    font: {
                                                      weight: "bold",
                                                      size: 10,
                                                    },
                                                    formatter: (
                                                      value,
                                                      context,
                                                    ) => {
                                                      const total =
                                                        context.dataset.data.reduce(
                                                          (a, b) =>
                                                            (a as number) +
                                                            (b as number),
                                                          0,
                                                        );
                                                      const percentage = (
                                                        ((value as number) /
                                                          (total as number)) *
                                                        100
                                                      ).toFixed(0);
                                                      return `${percentage}%`;
                                                    },
                                                  },
                                                },
                                              }}
                                            />
                                          </div>
                                        </div>

                                        <div className="flex-1 flex flex-col justify-center gap-2 text-xs">
                                          <div className="flex items-center gap-2">
                                            <div
                                              className="w-3 h-3 rounded-full"
                                              style={{
                                                backgroundColor: "#1e3a8a",
                                              }}
                                            ></div>
                                            <span className="text-gray-700 dark:text-gray-300">
                                              {complianceLabels.yes}:{" "}
                                              <span className="font-bold">
                                                {rowYes}
                                              </span>{" "}
                                              ({yesPercent}%)
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <div
                                              className="w-3 h-3 rounded-full"
                                              style={{
                                                backgroundColor: "#3b82f6",
                                              }}
                                            ></div>
                                            <span className="text-gray-700 dark:text-gray-300">
                                              {complianceLabels.no}:{" "}
                                              <span className="font-bold">
                                                {rowNo}
                                              </span>{" "}
                                              ({noPercent}%)
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <div
                                              className="w-3 h-3 rounded-full"
                                              style={{
                                                backgroundColor: "#93c5fd",
                                              }}
                                            ></div>
                                            <span className="text-gray-700 dark:text-gray-300">
                                              {complianceLabels.na}:{" "}
                                              <span className="font-bold">
                                                {rowNA}
                                              </span>{" "}
                                              ({naPercent}%)
                                            </span>
                                          </div>
                                          <div className="border-t border-gray-300 dark:border-gray-500 mt-2 pt-2">
                                            <p className="font-semibold text-gray-900 dark:text-white">
                                              Total: <span>{total}</span>
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {response.submissionMetadata?.location && (
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                              <p className="text-xs font-semibold text-gray-900 dark:text-white mb-1">
                                Location
                              </p>
                              <p className="text-xs text-gray-700 dark:text-gray-300 truncate">
                                {response.submissionMetadata.location.city ||
                                  response.submissionMetadata.location.region ||
                                  response.submissionMetadata.location
                                    .country ||
                                  "N/A"}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              <div className="card p-6">
                {filteredResponses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center min-h-96 py-12">
                    <UsersIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 font-medium">
                      No responses to compare
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-indigo-50 dark:bg-indigo-900/20">
                          <th className="sticky left-0 z-20 text-left px-4 py-3 font-semibold text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 min-w-40 bg-indigo-50 dark:bg-indigo-900/20">
                            Question
                          </th>
                          {filteredResponses
                            .filter((r) => getResponseTimestamp(r))
                            .sort((a, b) => {
                              const dateA = new Date(
                                getResponseTimestamp(a)!,
                              ).getTime();
                              const dateB = new Date(
                                getResponseTimestamp(b)!,
                              ).getTime();
                              return dateB - dateA;
                            })
                            .slice(0, 5)
                            .map((response, idx) => (
                              <th
                                key={response.id}
                                className="text-center px-3 py-2 font-semibold text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 min-w-28 bg-gradient-to-b from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30"
                              >
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs text-gray-600 dark:text-gray-400 leading-tight font-medium">
                                    Sub #{idx + 1}
                                  </span>
                                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 leading-tight">
                                    {getResponseTimestamp(response)
                                      ? formatToDDMMYYYY(
                                        getResponseTimestamp(response)!
                                      )
                                      : "N/A"}
                                  </span>
                                </div>
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {form?.sections?.flatMap((section) =>
                          section.questions?.map((question, qIdx) => {
                            const last5Responses = filteredResponses
                              .filter((r) => getResponseTimestamp(r))
                              .sort((a, b) => {
                                const dateA = new Date(
                                  getResponseTimestamp(a)!,
                                ).getTime();
                                const dateB = new Date(
                                  getResponseTimestamp(b)!,
                                ).getTime();
                                return dateB - dateA;
                              })
                              .slice(0, 5);

                            return (
                              <tr
                                key={question.id}
                                className={
                                  qIdx % 2 === 0
                                    ? "bg-white dark:bg-gray-900"
                                    : "bg-gray-50 dark:bg-gray-800/50"
                                }
                              >
                                <td className="sticky left-0 z-10 px-4 py-3 font-medium text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 min-w-60">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-semibold break-words whitespace-normal">
                                      {question.text || "Question"}
                                    </span>
                                    {question.description && (
                                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-words whitespace-normal">
                                        {question.description}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                {last5Responses.map((response) => {
                                  const answer =
                                    response.answers?.[question.id];
                                  const hasAnswer =
                                    answer !== null &&
                                    answer !== undefined &&
                                    answer !== "";

                                  return (
                                    <td
                                      key={`${response.id}-${question.id}`}
                                      className="text-center px-3 py-2 border border-gray-200 dark:border-gray-700 min-w-[120px]"
                                    >
                                      {hasAnswer ? (
                                        <div className="flex flex-col items-center justify-center max-w-[200px] overflow-auto max-h-[150px] gap-1">
                                          {renderAnswerDisplay(
                                            answer,
                                            question,
                                          )}
                                          {response.responseRanks?.[
                                            question.id
                                          ] && (
                                              <span
                                                className={`text-[10px] font-bold min-w-[24px] h-6 px-1.5 rounded-full flex items-center justify-center border shadow-sm ${getRankStyle(answer, darkMode)}`}
                                              >
                                                #
                                                {
                                                  response.responseRanks[
                                                  question.id
                                                  ]
                                                }
                                              </span>
                                            )}
                                        </div>
                                      ) : (
                                        <span className="text-xs text-gray-400 dark:text-gray-500">
                                          —
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          }),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-sm">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
                Delete Response
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
                Are you sure you want to delete this response? This action
                cannot be undone.
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingResponseId(null);
                  }}
                  disabled={isDeleting}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteResponse}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Deleting...
                    </>
                  ) : (
                    "Delete"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-sm">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
                Delete Selected Responses
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-2">
                Are you sure you want to delete {selectedResponseIds.length}{" "}
                response(s)? This action cannot be undone.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 text-center mb-6">
                This will permanently remove the selected responses from the
                system.
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => {
                    setShowBulkDeleteConfirm(false);
                  }}
                  disabled={isDeleting}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDeleteResponses}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Deleting...
                    </>
                  ) : (
                    <>Delete {selectedResponseIds.length} Response(s)</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk BIW Review Confirmation Modal */}
      {showBiwBulkUpdateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-sm w-full animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className={`flex items-center justify-center w-12 h-12 mx-auto rounded-full mb-4 ${biwBulkUpdateStatus === "Accepted"
                ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                : biwBulkUpdateStatus === "Rejected"
                  ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                  : biwBulkUpdateStatus === "Reworked"
                    ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                    : "bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400"
                }`}>
                {biwBulkUpdateStatus === "Accepted" && <CheckCircle className="w-6 h-6" />}
                {biwBulkUpdateStatus === "Rejected" && <XCircle className="w-6 h-6" />}
                {biwBulkUpdateStatus === "Reworked" && <RotateCcw className="w-6 h-6" />}
                {biwBulkUpdateStatus === null && <Trash2 className="w-6 h-6" />}
              </div>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
                {biwBulkUpdateStatus === null ? "Clear BIW Reviews" : `Mark BIW Reviews as ${biwBulkUpdateStatus}`}
              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
                Are you sure you want to {biwBulkUpdateStatus === null ? "clear the BIW review for" : `mark as ${biwBulkUpdateStatus}`} {biwBulkUpdateTargetIds.length} response(s)?
              </p>

              {biwBulkUpdateSkippedCount > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 text-center bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg mb-4">
                  Note: {biwBulkUpdateSkippedCount} submission(s) will be skipped because you cannot review your own work.
                </p>
              )}

              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => {
                    setShowBiwBulkUpdateModal(false);
                  }}
                  disabled={isBulkBiwUpdating}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium disabled:opacity-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={executeBulkBiwReviewUpdate}
                  disabled={isBulkBiwUpdating}
                  className={`px-4 py-2 text-white rounded-lg transition-colors font-medium disabled:opacity-50 flex items-center gap-2 text-sm ${biwBulkUpdateStatus === "Accepted"
                    ? "bg-green-600 hover:bg-green-700"
                    : biwBulkUpdateStatus === "Rejected"
                      ? "bg-red-600 hover:bg-red-700"
                      : biwBulkUpdateStatus === "Reworked"
                        ? "bg-orange-600 hover:bg-orange-700"
                        : "bg-gray-600 hover:bg-gray-700"
                    }`}
                >
                  {isBulkBiwUpdating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Updating...
                    </>
                  ) : (
                    "Confirm"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW - BIW Review Action Popup (Reject / Rework) */}
      {showBiwActionModal && biwActionResponse && biwActionStatus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full ${biwActionStatus === "Rejected"
                    ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                    : "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                    }`}
                >
                  {biwActionStatus === "Rejected" ? (
                    <XCircle className="w-4 h-4" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  BIW Review — Mark as {biwActionStatus}
                </h3>
              </div>
              <button
                onClick={closeBiwActionModal}
                disabled={isBiwActionSubmitting}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4 overflow-y-auto">
              {/* Question selection */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-2">
                  Which question(s) is this about?
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 border border-gray-200 dark:border-gray-700 rounded-lg p-2">
                  {getResponseQuestionOptions(biwActionResponse).length === 0 ? (
                    <p className="text-xs text-gray-400 italic">
                      No answered questions found on this response.
                    </p>
                  ) : (
                    getResponseQuestionOptions(biwActionResponse).map((q) => (
                      <label
                        key={q.id}
                        className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={biwActionSelectedQuestionIds.includes(q.id)}
                          onChange={() => toggleBiwActionQuestion(q.id)}
                          className="w-3.5 h-3.5 mt-0.5 rounded accent-purple-600 cursor-pointer"
                        />
                        <span>{q.text}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Remark */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-2">
                  Remark
                </label>
                <textarea
                  rows={3}
                  value={biwActionRemark}
                  onChange={(e) => setBiwActionRemark(e.target.value)}
                  placeholder="Explain why this response is being rejected / needs rework..."
                  className="w-full p-2.5 text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-400 outline-none resize-none"
                />
              </div>

              {/* Evidence upload */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-2">
                  Evidence (optional)
                </label>
                {biwActionEvidenceUrl ? (
                  <div className="relative group">
                    <img
                      src={biwActionEvidenceUrl}
                      alt="Evidence"
                      className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer"
                      onClick={() => window.open(biwActionEvidenceUrl, "_blank")}
                    />
                    <button
                      type="button"
                      onClick={() => setBiwActionEvidenceUrl("")}
                      className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove evidence"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : biwActionUploading ? (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                    <span className="text-xs text-gray-500">Uploading...</span>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-1 p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-all">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) await handleBiwEvidenceUpload(file);
                        e.target.value = "";
                      }}
                    />
                    <Upload className="w-4 h-4 text-gray-400" />
                    <span className="text-[10px] text-gray-500 font-semibold">
                      Upload photo evidence
                    </span>
                  </label>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 justify-end px-5 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={closeBiwActionModal}
                disabled={isBiwActionSubmitting}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium disabled:opacity-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={submitBiwActionModal}
                disabled={isBiwActionSubmitting || biwActionUploading}
                className={`px-4 py-2 text-white rounded-lg transition-colors font-medium disabled:opacity-50 flex items-center gap-2 text-sm ${biwActionStatus === "Rejected"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-orange-600 hover:bg-orange-700"
                  }`}
              >
                {isBiwActionSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Submitting...
                  </>
                ) : (
                  "Submit"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW - BIW Review Eye/View Modal (read-only) */}
      {showBiwViewModal && biwViewResponse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                BIW Review Details
              </h3>
              <button
                onClick={() => {
                  setShowBiwViewModal(false);
                  setBiwViewResponse(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 overflow-y-auto">
              {/* Status */}
              <div className="flex items-center gap-2">
                {biwViewResponse.biwReview?.status === "Accepted" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle className="w-3.5 h-3.5" /> Accepted
                  </span>
                )}
                {biwViewResponse.biwReview?.status === "Rejected" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    <XCircle className="w-3.5 h-3.5" /> Rejected
                  </span>
                )}
                {biwViewResponse.biwReview?.status === "Reworked" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                    <RotateCcw className="w-3.5 h-3.5" /> Rework
                  </span>
                )}
              </div>

              {/* Reviewer / date */}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Reviewed by{" "}
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {biwViewResponse.biwReview?.reviewedByName || "Reviewer"}
                </span>
                {biwViewResponse.biwReview?.reviewedAt && (
                  <>
                    {" "}
                    on{" "}
                    {new Date(biwViewResponse.biwReview.reviewedAt).toLocaleString()}
                  </>
                )}
              </p>

              {/* Flagged questions */}
              {biwViewResponse.biwReview?.flaggedQuestions &&
                biwViewResponse.biwReview.flaggedQuestions.length > 0 && (
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1.5">
                      Flagged Question(s)
                    </label>
                    <ul className="space-y-1 list-disc list-inside">
                      {biwViewResponse.biwReview.flaggedQuestions.map((q, idx) => (
                        <li key={`${q.questionId}-${idx}`} className="text-xs text-gray-700 dark:text-gray-300">
                          {q.questionText}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Remark */}
              {biwViewResponse.biwReview?.remark && (
                <div>
                  <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1.5">
                    Remark
                  </label>
                  <p className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/40 p-2.5 rounded-lg whitespace-pre-wrap">
                    {biwViewResponse.biwReview.remark}
                  </p>
                </div>
              )}

              {/* Evidence */}
              {biwViewResponse.biwReview?.evidenceUrl && (
                <div>
                  <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1.5">
                    Evidence
                  </label>
                  <img
                    src={biwViewResponse.biwReview.evidenceUrl}
                    alt="Evidence"
                    className="w-full max-h-64 object-contain rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer"
                    onClick={() =>
                      window.open(biwViewResponse.biwReview!.evidenceUrl!, "_blank")
                    }
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end px-5 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowBiwViewModal(false);
                  setBiwViewResponse(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Dispatch Confirmation Modal */}
      {showBulkDispatchConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-sm w-full">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
                Bulk Dispatch Responses
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-2">
                Are you sure you want to enable dispatch for the {selectedDispatchIds.length} selected response{selectedDispatchIds.length === 1 ? "" : "s"}?
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 text-center mb-6">
                This will enable dispatching only for the response{selectedDispatchIds.length === 1 ? "" : "s"} you selected.
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => {
                    setShowBulkDispatchConfirm(false);
                  }}
                  disabled={isBulkDispatching}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteBulkDispatch}
                  disabled={isBulkDispatching}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {isBulkDispatching ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Dispatching...
                    </>
                  ) : (
                    `Dispatch ${selectedDispatchIds.length} Response${selectedDispatchIds.length === 1 ? "" : "s"}`

                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Menu Modal */}
      {showActionMenuModal && actionResponse && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/75 flex items-center justify-center p-4 z-[120] backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Response Actions
              </h3>
              <button
                onClick={() => {
                  setShowActionMenuModal(false);
                  setActionResponse(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-2">
              <div className="px-2 py-1 mb-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Selected Response
                </p>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300 truncate">
                  {actionResponse.answers?.chassis_number
                    ? getChassisDisplayValue(actionResponse.answers.chassis_number)
                    : actionResponse.submittedBy || "Anonymous"}
                </p>
              </div>

              {(() => {
                const isOwnTenant =
                  user?.role === "superadmin" ||
                  user?.role === "admin" ||
                  user?.role === "subadmin" ||
                  user?.role === "inspector" ||
                  !responseTenantId ||
                  (currentUserTenantId &&
                    responseTenantId.toString() ===
                    currentUserTenantId.toString());

                const isActualOwnTenant =
                  user?.role === "superadmin" ||
                  !responseTenantId ||
                  (currentUserTenantId &&
                    responseTenantId.toString() ===
                    currentUserTenantId.toString());

                return (
                  <>
                    {/* Focus It */}
                    <button
                      onClick={() => {
                        handleOpenModal(actionResponse);
                        setShowActionMenuModal(false);
                      }}
                      className="w-full flex items-center gap-3 p-3.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-200 rounded-xl transition-colors font-semibold text-sm"
                    >
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg text-blue-600 dark:text-blue-400">
                        <Maximize className="w-4 h-4" />
                      </div>
                      FOCUS IT
                    </button>

                    {/* View Details */}
                    {isOwnTenant && (
                      <button
                        onClick={() => {
                          handleViewDetails(actionResponse);
                          setShowActionMenuModal(false);
                        }}
                        className="w-full flex items-center gap-3 p-3.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-700 dark:text-gray-200 rounded-xl transition-colors font-semibold text-sm"
                      >
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-400">
                          <Eye className="w-4 h-4" />
                        </div>
                        View Full Details
                      </button>
                    )}

                    {/* Chat / Review */}
                    {actionResponse.isDispatched && (
                      <button
                        onClick={() => {
                          setChatResponse(actionResponse);
                          setShowChatModal(true);
                          setSelectedReviewOptions((prev) => ({
                            ...prev,
                            [actionResponse.id]: "",
                          }));
                          setReviewedBy((prev) => ({
                            ...prev,
                            [actionResponse.id]: null,
                          }));
                          setShowActionMenuModal(false);
                        }}
                        className="w-full flex items-center gap-3 p-3.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-200 rounded-xl transition-colors font-semibold text-sm"
                      >
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg text-blue-600 dark:text-blue-400">
                          <MessageCircle className="w-4 h-4" />
                        </div>
                        Review & Discussion
                      </button>
                    )}

                    {/* Edit - Admin only */}
                    {!isGuest &&
                      (user?.role === "superadmin" || user?.role === "admin") &&
                      isActualOwnTenant && (
                        <button
                          onClick={() => {
                            handleEditResponse(actionResponse);
                            setShowActionMenuModal(false);
                          }}
                          className="w-full flex items-center gap-3 p-3.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-gray-700 dark:text-gray-200 rounded-xl transition-colors font-semibold text-sm"
                        >
                          <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg text-amber-600 dark:text-amber-400">
                            <Edit className="w-4 h-4" />
                          </div>
                          Edit Response
                        </button>
                      )}

                    {/* Delete - Admin only */}
                    {!isGuest &&
                      (user?.role === "superadmin" || user?.role === "admin") &&
                      isActualOwnTenant && (
                        <button
                          onClick={() => {
                            setDeletingResponseId(actionResponse.id);
                            setShowDeleteConfirm(true);
                            setShowActionMenuModal(false);
                          }}
                          className="w-full flex items-center gap-3 p-3.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl transition-colors font-semibold text-sm"
                        >
                          <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg text-red-600 dark:text-red-400">
                            <Trash2 className="w-4 h-4" />
                          </div>
                          Delete Response
                        </button>
                      )}
                  </>
                );
              })()}
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 text-center">
              <button
                onClick={() => {
                  setShowActionMenuModal(false);
                  setActionResponse(null);
                }}
                className="text-xs font-bold text-gray-500 uppercase tracking-widest hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Close Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Analytics Modal */}
      <ShareAnalyticsModal
        isOpen={shareAnalyticsModal.open}
        onClose={() =>
          setShareAnalyticsModal((prev) => ({ ...prev, open: false }))
        }
        formId={shareAnalyticsModal.formId}
        formTitle={shareAnalyticsModal.formTitle}
        analyticsData={fullAnalyticsData}
      />

      {/* Auto Send Modal */}
      <AutoSendModal
        isOpen={autoSendModal.open}
        onClose={() => setAutoSendModal((prev) => ({ ...prev, open: false }))}
        formId={autoSendModal.formId}
        formTitle={autoSendModal.formTitle}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white font-medium z-50 animate-fadeIn ${toast.type === "success"
            ? "bg-green-500 dark:bg-green-600"
            : toast.type === "info"
              ? "bg-blue-500 dark:bg-blue-600"
              : "bg-red-500 dark:bg-red-600"
            }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === "success" ? (
              <CheckCircle className="w-5 h-5" />
            ) : toast.type === "info" ? (
              <Info className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            {toast.message}
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {showChatModal && chatResponse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-indigo-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      Question Filter: {chatResponse.submittedBy || "Inspector"}
                    </h2>
                    <p className="text-xs text-white/70">
                      Chassis:{" "}
                      {(() => {
                        const chassisQ = form?.sections
                          ?.flatMap((s) => s.questions || [])
                          .find(
                            (q) =>
                              q.type === "chassis" ||
                              q.type === "chassisWithZone" ||
                              q.type === "chassisWithoutZone" ||
                              q.text?.toLowerCase().includes("chassis"),
                          );
                        const chassisVal =
                          chatResponse.answers?.[chassisQ?.id || ""];
                        if (
                          typeof chassisVal === "object" &&
                          chassisVal?.chassisNumber
                        ) {
                          return chassisVal.chassisNumber;
                        }
                        if (
                          typeof chassisVal === "string" &&
                          chassisVal.trim()
                        ) {
                          return chassisVal;
                        }
                        return "N/A";
                      })()}
                    </p>
                  </div>
                </div>

                {/* Review Options - Right side of header */}
                <div className="flex items-center gap-3">
                  {/* === AFTER REVIEW: Show review badge + score === */}
                  {(() => {
                    const responseId = chatResponse?.id || "";

                    // First check if review is directly attached to chatResponse (immediate display)
                    let reviewer = null;
                    let reviewOption = "";

                    if (chatResponse?.review) {
                      reviewer = chatResponse.review.reviewer;
                      reviewOption =
                        chatResponse.review.option ||
                        chatResponse.review.reviewOption;
                    } else {
                      // Fallback to state-based approach
                      reviewer = reviewedBy[responseId];
                      reviewOption = selectedReviewOptions[responseId];
                    }

                    // Accept reviewer object with either .id or ._id field
                    const hasReviewer =
                      reviewer &&
                      (reviewer.id ||
                        (reviewer as any)._id ||
                        reviewer.name ||
                        reviewer.email);
                    const hasOption = reviewOption && reviewOption !== "";

                    if (!hasReviewer || !hasOption) return null;

                    const reviewerName =
                      reviewer.name ||
                      reviewer.email ||
                      user?.name ||
                      user?.email ||
                      "Reviewer";
                    const isAccepted = reviewOption === "Accepted";
                    const isRejected = reviewOption === "Rejected";
                    const emoji = isAccepted ? "✅" : isRejected ? "❌" : "🔄";
                    const badgeClass = isAccepted
                      ? "bg-green-500/20 border-green-400 text-green-100"
                      : isRejected
                        ? "bg-red-500/20 border-red-400 text-red-100"
                        : "bg-yellow-500/20 border-yellow-400 text-yellow-100";

                    const scoreVal =
                      performanceScores[chatResponse?.submittedBy || ""] ??
                      performanceScores[
                      (chatResponse?.createdBy as any)?._id ||
                      (chatResponse?.createdBy as string) ||
                      ""
                      ];

                    return (
                      <div
                        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg border ${badgeClass}`}
                      >
                        <span>
                          <span className="font-bold">Status:</span> {emoji}{" "}
                          {reviewOption} by {reviewerName}
                        </span>
                      </div>
                    );
                  })()}

                  {/* === BEFORE REVIEW: Show 3 buttons or "pending" state === */}
                  {!reviewSubmitted[
                    `${String(user?._id)}-${String(chatResponse?.id)}`
                  ] &&
                    !reviewedBy[chatResponse?.id || ""] &&
                    (responseStatuses[chatResponse?.id] === "Direct Ok" ||
                      responseStatuses[chatResponse?.id] ===
                      "Rework Accepted" ||
                      responseStatuses[chatResponse?.id] === "Accepted" ||
                      responseStatuses[chatResponse?.id] === "Pending Review" ||
                      responseStatuses[chatResponse?.id] ===
                      "Rework Completed") &&
                    (() => {
                      const userEmail = user?.email || "";
                      const userUsername = user?.username || "";
                      const userId = user?._id || user?.id;
                      const userIdStr = userId ? String(userId) : "";
                      const creatorId =
                        typeof chatResponse?.createdBy === "object"
                          ? (chatResponse.createdBy as any)?._id ||
                          (chatResponse.createdBy as any)?.id
                          : chatResponse?.createdBy;
                      const creatorIdStr = creatorId ? String(creatorId) : "";

                      const isSubmitter =
                        chatResponse?.submittedBy === userEmail ||
                        chatResponse?.submittedBy === userUsername ||
                        chatResponse?.submitterContact?.email === userEmail ||
                        (creatorIdStr && creatorIdStr === userIdStr);
                      return !isSubmitter;
                    })() &&
                    (pendingReviewOption ? (
                      /* Pending state: show label + cancel */
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 text-xs font-bold rounded ${pendingReviewOption === "Rejected"
                            ? "bg-red-500/30 text-red-100 border border-red-400"
                            : "bg-yellow-500/30 text-yellow-100 border border-yellow-400"
                            }`}
                        >
                          {pendingReviewOption === "Rejected" ? "❌" : "🔄"}{" "}
                          {pendingReviewOption} — Select questions below
                        </span>
                        <button
                          onClick={() => setPendingReviewOption(null)}
                          className="px-2 py-1 text-xs font-bold rounded bg-white/10 text-white hover:bg-white/20 transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      /* Normal state: 3 review buttons - Only show if user is not the submitter */
                      (() => {
                        const userEmail = user?.email || "";
                        const userUsername = user?.username || "";
                        const userIdStr = user?._id
                          ? String(user._id)
                          : user?.id
                            ? String(user.id)
                            : "";
                        const creatorId =
                          typeof chatResponse?.createdBy === "object"
                            ? (chatResponse.createdBy as any)?._id ||
                            (chatResponse.createdBy as any)?.id
                            : chatResponse?.createdBy;
                        const creatorIdStr = creatorId ? String(creatorId) : "";

                        const isSubmitter =
                          chatResponse?.submittedBy === userEmail ||
                          chatResponse?.submittedBy === userUsername ||
                          chatResponse?.submitterContact?.email === userEmail ||
                          (creatorIdStr && creatorIdStr === userIdStr);

                        return !isSubmitter ? (
                          <div className="flex gap-2">
                            {["Accepted", "Rejected", "Rework"].map(
                              (option) => (
                                <button
                                  key={option}
                                  onClick={() => {
                                    if (option === "Accepted") {
                                      handleReviewSubmit(
                                        chatResponse!.id,
                                        option,
                                      );
                                    } else {
                                      setPendingReviewOption(option);
                                    }
                                  }}
                                  className={`px-3 py-1 text-xs font-bold rounded transition-all border ${option === "Accepted"
                                    ? "bg-green-500/30 border-green-400 text-green-100 hover:bg-green-500/50"
                                    : option === "Rejected"
                                      ? "bg-red-500/30 border-red-400 text-red-100 hover:bg-red-500/50"
                                      : "bg-yellow-500/30 border-yellow-400 text-yellow-100 hover:bg-yellow-500/50"
                                    }`}
                                >
                                  {option === "Accepted"
                                    ? "✅"
                                    : option === "Rejected"
                                      ? "❌"
                                      : "🔄"}{" "}
                                  {option}
                                </button>
                              ),
                            )}
                          </div>
                        ) : null;
                      })()
                    ))}

                  <button
                    onClick={() => {
                      const responseId = searchParams.get("responseId");
                      if (responseId) {
                        navigate("/inspector/chat");
                      } else {
                        setShowChatModal(false);
                        setChatResponse(null);
                        setPendingReviewOption(null);
                        setSelectedReviewOptions((prev) => ({
                          ...prev,
                          [chatResponse?.id || ""]: "",
                        }));
                        setReviewedBy((prev) => ({
                          ...prev,
                          [chatResponse?.id || ""]: null,
                        }));
                      }
                    }}
                    className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
                    title="Close Chat"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2">
              {/* Left Column: Filters */}
              <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-r border-gray-200 dark:border-gray-700 overflow-y-auto space-y-6">
                <div>
                  <div className="space-y-4">
                    <p className="text-xl text-gray-700 dark:text-gray-300">
                      Chassis Number :{" "}
                      {(() => {
                        const chassisQ = form?.sections
                          ?.flatMap((s) => s.questions || [])
                          .find(
                            (q) =>
                              q.type === "chassis" ||
                              q.type === "chassisWithZone" ||
                              q.type === "chassisWithoutZone" ||
                              q.text?.toLowerCase().includes("chassis"),
                          );
                        const chassisVal =
                          chatResponse.answers?.[chassisQ?.id || ""];
                        if (
                          typeof chassisVal === "object" &&
                          chassisVal?.chassisNumber
                        ) {
                          return chassisVal.chassisNumber;
                        }
                        if (
                          typeof chassisVal === "string" &&
                          chassisVal.trim()
                        ) {
                          return chassisVal;
                        }
                        return "N/A";
                      })()}
                    </p>

                    {/* Show question selection panel when Rejected/Rework is pending */}
                    {pendingReviewOption && (
                      <>
                        <div className="space-y-2">
                          <div
                            className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg ${pendingReviewOption === "Rejected" ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800" : "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"}`}
                          >
                            <span className="text-lg">
                              {pendingReviewOption === "Rejected" ? "❌" : "🔄"}
                            </span>
                            <div>
                              <p
                                className={`text-xs font-bold ${pendingReviewOption === "Rejected" ? "text-red-700 dark:text-red-300" : "text-yellow-700 dark:text-yellow-300"}`}
                              >
                                {pendingReviewOption} Review
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Select the questions with issues, fill in
                                corrections, then click "Send & Submit Review"
                              </p>
                            </div>
                          </div>
                          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1">
                            Select Questions to Flag
                          </label>
                          <div className="max-h-[400px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl shadow-inner scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 bg-white dark:bg-gray-800">
                            {form?.sections
                              ?.flatMap((s) =>
                                (s.questions || []).filter(
                                  (q: any) =>
                                    !q.parentId && !q.showWhen?.questionId,
                                ),
                              )
                              .map((q) => (
                                <div
                                  key={q.id}
                                  className="border-b border-gray-100 dark:border-gray-700 last:border-0"
                                >
                                  <div className="flex items-start gap-3 p-3 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 cursor-default transition-colors group">
                                    <label className="mt-1 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={chatFilters.questions.includes(
                                          q.id,
                                        )}
                                        onChange={(e) => {
                                          const checked = e.target.checked;
                                          setChatFilters((prev) => ({
                                            ...prev,
                                            questions: checked
                                              ? [...prev.questions, q.id]
                                              : prev.questions.filter(
                                                (id) => id !== q.id,
                                              ),
                                          }));
                                        }}
                                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                                      />
                                    </label>
                                    <div className="flex-1">
                                      <span className="text-sm text-gray-700 dark:text-gray-300 font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors block mb-1">
                                        {q.text}
                                      </span>
                                      {chatFilters.questions.includes(q.id) && (
                                        <div className="mt-2 space-y-2">
                                          <QuestionSuggestionRenderer
                                            question={q}
                                            currentAnswer={
                                              (
                                                responses.find(
                                                  (r) => r.id === chatResponse.id,
                                                ) ||
                                                tableResponses.find(
                                                  (r) => r.id === chatResponse.id,
                                                ) ||
                                                chatResponse
                                              )?.answers?.[q.id]
                                            }
                                            value={
                                              chatFilters.suggestedAnswers?.[
                                              q.id
                                              ] || {}
                                            }
                                            onChange={(val) =>
                                              setChatFilters((prev) => ({
                                                ...prev,
                                                suggestedAnswers: {
                                                  ...prev.suggestedAnswers,
                                                  [q.id]: val,
                                                },
                                              }))
                                            }
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>

                        <div className="pt-6 flex items-center justify-between">
                          <button
                            onClick={() =>
                              setChatFilters({
                                chassisNumber: "",
                                location: "",
                                questions: [],
                                selectedCategories: {},
                                zoneType: "both",
                                suggestedAnswers: {},
                              })
                            }
                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                          >
                            Clear All Filters
                          </button>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowChatModal(false)}
                              className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => setShowChatModal(false)}
                              className="px-4 py-2 text-xs font-extrabold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95"
                            >
                              Apply Filters
                            </button>
                          </div>
                        </div>
                        <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mt-2">
                          ✏️ Type your message below and click{" "}
                          <b>Send Feedback</b> to submit the review.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {/* Right Column: Chat history and input */}
              <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 border-t md:border-t-0 p-6 overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    Message Center
                  </h3>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 rounded-full border border-green-200 dark:border-green-800">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold text-green-700 dark:text-green-400">
                      Live Context
                    </span>
                  </div>
                </div>

                <div className="flex-1 bg-gray-50 dark:bg-gray-800/20 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 mb-4 overflow-y-auto space-y-4 flex flex-col scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                  {chatMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3 opacity-50">
                      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full ring-8 ring-gray-50 dark:ring-gray-900/50">
                        <MessageCircle className="w-10 h-10" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-gray-600 dark:text-gray-300">
                          No active conversation
                        </p>
                        <p className="text-xs">
                          Send a message to start the thread.
                        </p>
                      </div>
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex flex-col ${String(msg.from?._id || msg.from) === String(user?._id || (user as any)?.id) ? "items-end" : "items-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                      >
                        <div
                          className={`max-w-[90%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${String(msg.from?._id || msg.from) ===
                            String(user?._id || (user as any)?.id)
                            ? "bg-[#dcf8c6] text-gray-900 rounded-br-lg rounded-tr-lg rounded-tl-sm"
                            : "bg-white dark:bg-gray-100 text-gray-900 border border-gray-100 dark:border-gray-700 rounded-bl-lg rounded-tl-lg rounded-tr-sm"
                            }`}
                        >
                          {msg.questionContexts &&
                            msg.questionContexts.length > 0 ? (
                            <div className="space-y-3">
                              {msg.questionContexts.map(
                                (ctx: any, idx: number) => (
                                  <div key={idx} className="space-y-2">
                                    <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400 border-b border-indigo-100 dark:border-indigo-800/50 pb-0.5">
                                      {ctx.title}
                                    </p>

                                    {ctx.suggestion && (
                                      <div className="mt-1 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800">
                                        <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">
                                          Review Feedback:
                                        </p>
                                        {ctx.question ? (
                                          <QuestionSuggestionRenderer
                                            question={ctx.question}
                                            value={ctx.suggestion}
                                            currentAnswer={ctx.answer}
                                            onChange={(newSuggestion) => {
                                              // Update the suggestion in chatFilters
                                              setChatFilters((prev) => ({
                                                ...prev,
                                                suggestedAnswers: {
                                                  ...prev.suggestedAnswers,
                                                  [ctx.question.id]:
                                                    newSuggestion,
                                                },
                                              }));
                                            }}
                                          />
                                        ) : (
                                          // Fallback to read-only display if question data is missing
                                          <div className="text-xs text-gray-600 dark:text-gray-400">
                                            {renderAnswerDisplay(
                                              ctx.suggestion,
                                              { type: "text" } as any,
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ),
                              )}
                            </div>
                          ) : (
                            msg.questionTitles &&
                            msg.questionTitles.length > 0 && (
                              <div className="mb-2 p-2 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100/50 dark:border-indigo-800/30">
                                <p className="text-[10px] uppercase font-black text-indigo-500 dark:text-indigo-400 mb-1.5 flex items-center gap-1">
                                  <Filter className="w-2.5 h-2.5" />
                                  Linked Questions
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {msg.questionTitles.map(
                                    (title: string, idx: number) => (
                                      <span
                                        key={idx}
                                        className="px-1.5 py-0.5 bg-white dark:bg-gray-700 text-[9px] font-bold text-indigo-600 dark:text-indigo-300 rounded-md border border-indigo-100 dark:border-indigo-800"
                                      >
                                        {title}
                                      </span>
                                    ),
                                  )}
                                </div>
                              </div>
                            )
                          )}
                          {renderMessageWithImages(msg.message)}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5 px-1 opacity-60">
                          <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400">
                            {String(msg.from?._id || msg.from) ===
                              String(user?._id || (user as any)?.id)
                              ? "You"
                              : msg.from?.name || "Inspector"}{" "}
                            •{" "}
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {String(msg.from?._id || msg.from) !==
                            String(user?._id || (user as any)?.id) && (
                              <button
                                onClick={() => {
                                  setNewMessage(
                                    `Replying to: "${msg.message.substring(0, 30)}..." \n`,
                                  );
                                  const textarea =
                                    document.querySelector("textarea");
                                  if (textarea) textarea.focus();
                                }}
                                className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline ml-2 pointer-events-auto"
                              >
                                <Reply className="w-3 h-3" />
                                Reply
                              </button>
                            )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {(() => {
                  const userEmail = user?.email || "";
                  const userUsername = user?.username || "";
                  const userIdStr = user?._id
                    ? String(user._id)
                    : user?.id
                      ? String(user.id)
                      : "";
                  const creatorId =
                    typeof chatResponse?.createdBy === "object"
                      ? (chatResponse.createdBy as any)?._id ||
                      (chatResponse.createdBy as any)?.id
                      : chatResponse?.createdBy;
                  const creatorIdStr = creatorId ? String(creatorId) : "";

                  const isSubmitter =
                    chatResponse?.submittedBy === userEmail ||
                    chatResponse?.submittedBy === userUsername ||
                    chatResponse?.submitterContact?.email === userEmail ||
                    (creatorIdStr && creatorIdStr === userIdStr);

                  // For submitters, only show message input if no review option is pending
                  if (isSubmitter && pendingReviewOption) {
                    return null;
                  }

                  return (
                    <div className="space-y-3">
                      <div className="relative">
                        <textarea
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder={
                            isSubmitter
                              ? "Send a message..."
                              : "Type your feedback to the inspector..."
                          }
                          className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-indigo-500 dark:focus:border-indigo-400 rounded-2xl text-sm focus:ring-0 transition-all resize-none shadow-inner text-gray-800 dark:text-gray-200"
                          rows={3}
                        />
                      </div>
                      <button
                        onClick={async () => {
                          // If a Rejected/Rework review is pending and user is not submitter, send message + submit review together
                          if (pendingReviewOption && !isSubmitter) {
                            setPendingReviewOption(null); // Clear pending state immediately
                            const reviewNote =
                              newMessage.trim() ||
                              `Please review and correct the flagged questions (${pendingReviewOption}).`;
                            await handleSendMessage(reviewNote);
                            await handleReviewSubmit(
                              chatResponse!.id,
                              pendingReviewOption,
                            );
                          } else {
                            await handleSendMessage();
                          }
                        }}
                        disabled={isSendingMessage || !newMessage.trim()}
                        className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 text-white text-sm font-black rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-xl ${pendingReviewOption && !isSubmitter
                          ? pendingReviewOption === "Rejected"
                            ? "bg-red-600 hover:bg-red-700 shadow-red-200 dark:shadow-none"
                            : "bg-yellow-600 hover:bg-yellow-700 shadow-yellow-200 dark:shadow-none"
                          : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none"
                          }`}
                      >
                        {isSendingMessage ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <span>
                              {pendingReviewOption && !isSubmitter
                                ? `Send Feedback & Submit ${pendingReviewOption}`
                                : "Send Message"}
                            </span>
                            <ChevronRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                      <div className="flex justify-center gap-2">
                        <p className="text-[10px] text-center text-gray-400 font-medium">
                          Message will be sent to{" "}
                          <b>
                            {isSubmitter
                              ? "the reviewer"
                              : chatResponse.submittedBy || "the submitter"}
                          </b>
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}