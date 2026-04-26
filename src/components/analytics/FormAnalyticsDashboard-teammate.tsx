import React, { useState, useEffect, useMemo,useRef } from "react";
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import CameraCapture from "../forms/CameraCapture";
import {exportDashboardToPDF,exportFormAnalyticsToPDF,} from "../../utils/formanalyticsexport";
import {
  Users,
  CheckCircle,
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
  X,
  Share2,
  MessageCircle,
  ChevronRight,
  Filter,
  Reply,
  Upload,
  ChevronDown,
  Camera,
  Loader2
} from "lucide-react";
import { createPortal } from "react-dom";
import { Pie, Doughnut, Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  RadialLinearScale,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { apiClient } from "../../api/client";
import ResponseQuestion from "./ResponseQuestion";
import SectionAnalytics from "./SectionAnalytics";
import LocationHeatmap from "./LocationHeatmap";
import CascadingFilterModal from "./CascadingFilterModal";
import * as XLSX from "xlsx-js-style";
import { isImageUrl } from "../../utils/answerTemplateUtils";
import ImageLink from "../ImageLink";
import FilePreview from "../FilePreview";
import TableColumnFilter from "./TableColumnFilter";
import ShareAnalyticsModal from "./ShareAnalyticsModal";

import { useTheme } from "../../context/ThemeContext";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

interface Response {
  _id?: string;
  id: string;
  questionId: string;
  answers: Record<string, any>;
  timestamp?: string;
  createdAt?: string; // MongoDB timestamp field
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
}

// Helper function to get the timestamp from response (handles both timestamp and createdAt)
const getResponseTimestamp = (response: Response): string | undefined => {
  return response.timestamp || response.createdAt;
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
}

type SectionPerformanceStat = {
  id: string;
  title: string;
  yes: number;
  no: number;
  na: number;
  total: number;
  weightage: number;
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

  // Group questions by parameter/subParam1
  const parameterGroups = new Map<
    string,
    {
      parameterName: string;
      yes: number;
      no: number;
      na: number;
      total: number;
      questions: FollowUpQuestion[];
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

          const answerStr = String(answer).toLowerCase().trim();
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
      });
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

// Add getSectionStats function
const getSectionStats = (section: Section, responses: Response[]) => {
  // Filter for main questions only (not follow-ups)
  const mainQuestionsOnly = section.questions.filter(
    (q: any) => !q.parentId && !q.showWhen?.questionId,
  );

  console.log("Main questions found:", mainQuestionsOnly.length);
  console.log("All questions in section:", section.questions.length);

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

  // Process follow-up questions
  followUpQuestionsInSection.forEach((followUp: any) => {
    const followUpResponders = responses.filter(
      (r) => r.answers && r.answers[followUp.id],
    ).length;
    if (followUpResponders > 0) {
      answeredFollowUpQuestions++;
      followUpResponses += followUpResponders;
    }
  });

  // Process main questions
  const questionsDetail = mainQuestionsOnly.map((q: any) => {
    const mainQuestionResponders = responses.filter(
      (r) => r.answers && r.answers[q.id],
    ).length;

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
        responses: responses.filter((r) => r.answers && r.answers[fq.id])
          .length,
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

  console.log("Processed questionsDetail:", questionsDetail);

  return {
    mainQuestionCount,
    totalFollowUpCount,
    answeredMainQuestions,
    answeredFollowUpQuestions,
    totalAnswered,
    totalResponses,
    completionRate,
    avgResponsesPerQuestion,
    questionsDetail, // Make sure this is returned
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

const recognizedYesNoValues = ["yes", "no", "n/a", "na", "not applicable"];

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

const computeSectionPerformanceStats = (
  form: Form | null,
  responses: Response[],
): SectionPerformanceStat[] => {
  if (!form?.sections || !responses.length) {
    return [];
  }

  const stats =
    form.sections?.map((section) => {
      const counts = { yes: 0, no: 0, na: 0, total: 0 };
      const weightageNumber = Number(section.weightage) || 0;
      const weightage = Number.isFinite(weightageNumber) ? weightageNumber : 0;

      const processQuestion = (question: any) => {
        if (!question) {
          return;
        }
        if (question.type === "yesNoNA" && question.id) {
          const options = question.options || [];
          responses.forEach((response) => {
            const answer = response.answers?.[question.id];
            if (answer === null || answer === undefined || answer === "") {
              return;
            }

            const normalizedValues = extractYesNoValues(answer);

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
              // Fallback to recognized values if options are not available
              const hasRecognizedValue = normalizedValues.some((value) =>
                recognizedYesNoValues.includes(value),
              );
              if (!hasRecognizedValue) {
                return;
              }
              counts.total += 1;
              if (normalizedValues.includes("yes")) {
                counts.yes += 1;
              }
              if (normalizedValues.includes("no")) {
                counts.no += 1;
              }
              if (
                normalizedValues.includes("n/a") ||
                normalizedValues.includes("na") ||
                normalizedValues.includes("not applicable")
              ) {
                counts.na += 1;
              }
            }
          });
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
        total: counts.total,
        weightage,
      };
    }) ?? [];

  return stats.filter((stat): stat is SectionPerformanceStat => Boolean(stat));
};

interface SectionStat {
  id: string;
  title: string;
  yes: number;
  no: number;
  na: number;
  total: number;
  weightage: number;
}

const getSectionYesNoStats = (
  form: any,
  answers: Record<string, any>,
): SectionStat[] => {
  const stats =
    form.sections?.map((section: any) => {
      const counts = { yes: 0, no: 0, na: 0, total: 0 };
      const weightageNumber = Number(section.weightage);
      const weightage = Number.isFinite(weightageNumber) ? weightageNumber : 0;

      const processQuestion = (question: any) => {
        if (!question) {
          return;
        }
        if (question.type !== "yesNoNA" || !question.id) {
          question.followUpQuestions?.forEach(processQuestion);
          return;
        }

        const answer = answers?.[question.id];
        if (answer === null || answer === undefined || answer === "") {
          question.followUpQuestions?.forEach(processQuestion);
          return;
        }

        const normalizedValues = extractYesNoValues(answer);
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
            ["yes", "no", "n/a", "na", "not applicable"].includes(value),
          );
          if (!hasRecognizedValue) {
            question.followUpQuestions?.forEach(processQuestion);
            return;
          }

          counts.total += 1;
          if (normalizedValues.includes("yes")) {
            counts.yes += 1;
          }
          if (normalizedValues.includes("no")) {
            counts.no += 1;
          }
          if (
            normalizedValues.includes("n/a") ||
            normalizedValues.includes("na") ||
            normalizedValues.includes("not applicable")
          ) {
            counts.na += 1;
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
        total: counts.total,
        weightage,
      };
    }) ?? [];

  return stats.filter((stat): stat is SectionStat => Boolean(stat));
};

const QuestionSuggestionRenderer = ({
  question,
  value,
  onChange,
  currentAnswer
}: {
  question: any,
  value: any,
  onChange: (val: any) => void,
  currentAnswer?: any
}) => {
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [expandedZone, setExpandedZone] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<Record<string, boolean>>({});
  const [showCamera, setShowCamera] = useState<{ zone?: string; category?: string; defect?: string; isMain?: boolean } | null>(null);

  // Check tracking types
  const isTrackRankOnly = question.trackResponseRank === true && question.trackResponseQuestion !== true;
  const isTrackQuestion = question.trackResponseQuestion === true;

  const handleOptionSelect = (opt: string) => {
    const newValue = typeof value === 'object' && value !== null 
      ? { ...value, selected: opt } 
      : { selected: opt };
    onChange(newValue);
  };

  const handleFollowUpChange = (fqId: string, fv: any) => {
    onChange({ ...(value || {}), [fqId]: fv });
  };

  const currentSelection = value?.selected || value?.status;
  const selectedStatus = currentSelection;
  const needsFollowUp = selectedStatus === 'Rework' || 
    selectedStatus === 'Rejected' || 
    selectedStatus === 'No';

  // Helper: Upload file
  const handleFileUpload = async (file: File, path: string[]) => {
    const uploadKey = path.join('-');
    try {
      console.log("[FILE UPLOAD] Starting - path:", path);
      console.log("[FILE UPLOAD] Current value structure:", JSON.stringify(value, null, 2));
      
      setUploading(prev => ({ ...prev, [uploadKey]: true }));
      
      const result = await apiClient.uploadFile(file, "form");
      console.log("[FILE UPLOAD] API result:", result);
      
      const uploadedUrl = apiClient.resolveUploadedFileUrl(result);
      console.log("[FILE UPLOAD] Resolved URL:", uploadedUrl);
      
      if (uploadedUrl && uploadedUrl !== "uploading") {
        // Create a deep copy of the current value
        let newValue = JSON.parse(JSON.stringify(value || {}));
        
        console.log("[FILE UPLOAD] Fixing to categories structure. Path:", path);
        
        // path = [zone, category, defectName, 'fileUrl']
        const zone = path[0];
        const categoryName = path[1];
        const defectName = path[2];
        
        // Initialize zonesData if needed
        if (!newValue.zonesData) newValue.zonesData = {};
        if (!newValue.zonesData[zone]) newValue.zonesData[zone] = { categories: [] };
        
        const zoneData = newValue.zonesData[zone];
        if (!zoneData.categories) zoneData.categories = [];
        
        // Find or create the category
        let category = zoneData.categories.find((c: any) => c.name === categoryName);
        if (!category) {
          category = { name: categoryName, defects: [] };
          zoneData.categories.push(category);
        }
        if (!category.defects) category.defects = [];
        
        // Find or create the defect
        let defect = category.defects.find((d: any) => d.name === defectName);
        if (!defect) {
          defect = { name: defectName, details: { remark: "", fileUrl: "" } };
          category.defects.push(defect);
        }
        if (!defect.details) defect.details = { remark: "", fileUrl: "" };
        
        // Set the fileUrl
        defect.details.fileUrl = uploadedUrl;
        
        console.log("[FILE UPLOAD] FINAL newValue:", JSON.stringify(newValue, null, 2));
        
        // Update the state
        onChange(newValue);
      } else {
        console.warn("[FILE UPLOAD] No URL returned from API");
      }
    } catch (err) {
      console.error("[FILE UPLOAD] ERROR:", err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(prev => ({ ...prev, [uploadKey]: false }));
    }
  };

  // Helper: Update defect details (preserves existing fileUrl)
  const updateDefectDetails = (zone: string, category: string, defect: string, updates: { remark?: string; fileUrl?: string }) => {
    // Create a deep copy
    let newValue = JSON.parse(JSON.stringify(value || {}));
    
    if (!newValue.zonesData) newValue.zonesData = {};
    if (!newValue.zonesData[zone]) newValue.zonesData[zone] = { categories: [] };
    
    if (!Array.isArray(newValue.zonesData[zone].categories)) {
      newValue.zonesData[zone].categories = [];
    }
    
    const categoryIndex = newValue.zonesData[zone].categories.findIndex((c: any) => c?.name === category);
    if (categoryIndex === -1) {
      newValue.zonesData[zone].categories.push({ name: category, defects: [] });
    }
    
    const actualCategoryIndex = categoryIndex === -1 ? newValue.zonesData[zone].categories.length - 1 : categoryIndex;
    
    if (!Array.isArray(newValue.zonesData[zone].categories[actualCategoryIndex].defects)) {
      newValue.zonesData[zone].categories[actualCategoryIndex].defects = [];
    }
    
    const defectIndex = newValue.zonesData[zone].categories[actualCategoryIndex].defects.findIndex((d: any) => d?.name === defect);
    
    if (defectIndex === -1) {
      newValue.zonesData[zone].categories[actualCategoryIndex].defects.push({ 
        name: defect, 
        details: { remark: "", fileUrl: "" } 
      });
    }
    
    const actualDefectIndex = defectIndex === -1 
      ? newValue.zonesData[zone].categories[actualCategoryIndex].defects.length - 1 
      : defectIndex;
    
    // Preserve existing details
    const existingDetails = newValue.zonesData[zone].categories[actualCategoryIndex].defects[actualDefectIndex].details || { remark: "", fileUrl: "" };
    
    newValue.zonesData[zone].categories[actualCategoryIndex].defects[actualDefectIndex].details = {
      ...existingDetails,
      ...updates
    };
    
    onChange({ ...newValue, status: selectedStatus });
  };

  // Defect data for categories
  const DEFECT_DATA: Record<string, string[]> = {
    "Painting defects": [
      "Paint uncover", "Low DFT", "Colour missmatch", "Cissing mark", 
      "Paint rundown", "Orange peel", "Dry spray", "Rough finish", 
      "High DFT", "Dirt inclusion", "Blisters", "Bubbling"
    ],
    "Welding defects": [
      "Porosity", "Pin hole", "Spatters", "Burnthrough", "crack", 
      "Unfill", "Undercut", "Excess weld", "Chipping mark", "Sharp edge", 
      "Spot missing", "Spot welding shift", "Edge spot", "Edge spot burr", 
      "Weld shift", "No nugget formation", "Welding stick", 
      "Plug welding missing", "Plug welding burn through", "Spot failure"
    ],
    "Fitment defects": [
      "Hole misalignment", "Bracket misalignment", "Gap issue", "Interference", 
      "Bolt not assembling", "Part not assembly", "Thread damage", 
      "Mouting point shift", "Weld bead interference", "Clearance issue", 
      "Nut missing", "Nut offset", "Bolt missing", "Bolt lossen", 
      "Assembly not seating", "Bracket tilt"
    ],
    "Sealant defects": [
      "Sealant missing", "Incomplete sealant", "Uneven bead", "Excess sealant", 
      "Selant overflow", "Sealant lifting", "Sealant gap", 
      "Discontinuous sealant", "Sealant crack", "Water leakage", "Sealant peeling"
    ],
    "Handling defects": [
      "Dent", "Bend", "Paint damage", "Scratch", "Rust due to storage", 
      "Packing damage", "Transit damage", "Part rubbing damage"
    ]
  };

  const ZONES = ["Zone A+", "Zone A", "Zone B", "Zone C"];

  // Multi-Select Dropdown Component
  const MultiSelectDropdown = ({ options, selectedValues, onChange: onSelectChange, placeholder, label }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
            buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (option: string) => {
      if (selectedValues.includes(option)) {
        onSelectChange(selectedValues.filter((v: string) => v !== option));
      } else {
        onSelectChange([...selectedValues, option]);
      }
    };

    return (
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        {label && <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</label>}
        <button
          ref={buttonRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-[11px] font-medium flex items-center justify-between"
        >
          <span className="truncate">
            {selectedValues.length === 0 ? placeholder : `${selectedValues.length} selected`}
          </span>
          <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'absolute',
              top: buttonRef.current?.getBoundingClientRect().bottom + window.scrollY,
              left: buttonRef.current?.getBoundingClientRect().left + window.scrollX,
              width: buttonRef.current?.offsetWidth,
              zIndex: 99999,
            }}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {(options || []).map((opt: string) => (
              <label 
                key={opt} 
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <input 
                  type="checkbox" 
                  checked={selectedValues.includes(opt)} 
                  onChange={() => toggleOption(opt)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-3.5 h-3.5 rounded" 
                />
                <span className="text-[11px]">{opt}</span>
              </label>
            ))}
          </div>,
          document.body
        )}
      </div>
    );
  };

  // ── CHASSIS WITH ZONE / WITHOUT ZONE (Full UI) ──────────────────────────
  if (question.type === 'chassis-with-zone' || question.type === 'chassis-without-zone') {
    const currentStatus = value?.status || '';
    const isWithZone = question.type === 'chassis-with-zone';
    const selectedZones = Array.isArray(value?.zone) ? value.zone : [];
    const zonesData = value?.zonesData || {};
    const evidenceUrl = value?.evidenceUrl || '';
    
    // Get chassis number from currentAnswer (auto-filled from suggestion)
    const autoFilledChassis = currentAnswer?.chassisNumber || '';

    console.log("[RENDER CHASSIS-WITH-ZONE] value:", JSON.stringify(value, null, 2));

    // Render Defect Details function
    const renderDefectDetails = (zone: string, category: string, defect: any) => {
      if (!defect) return null;
      
      // Get the fileUrl from the defect details - check multiple paths
      const fileUrl = defect?.details?.fileUrl || defect?.fileUrl || '';
      const hasFileUploaded = !!fileUrl && fileUrl !== "uploading" && fileUrl !== "";
      
      console.log(`[RENDER DEFECT] zone="${zone}" category="${category}" defect.name="${defect.name}"`, defect);
      console.log(`[RENDER DEFECT] defect.details=${JSON.stringify(defect.details)}`);
      console.log(`[RENDER DEFECT] final fileUrl="${fileUrl}", hasFileUploaded=${hasFileUploaded}`);
      
      return (
        <div 
          key={defect.name} 
          className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{defect.name}</span>
            {hasFileUploaded && (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500 ml-auto" />
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-gray-400">Remark</label>
              <textarea
                value={defect?.details?.remark || defect?.remark || ''}
                onChange={(e) => {
                  e.stopPropagation();
                  updateDefectDetails(zone, category, defect.name, { remark: e.target.value });
                }}
                onKeyDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                placeholder="Add remark..."
                className="w-full px-2 py-1.5 text-[10px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                rows={2}
              />
            </div>
            <div className="space-y-1">
<label className="text-[9px] font-bold text-gray-400">Evidence ({hasFileUploaded ? 'UPLOADED' : 'EMPTY'})</label>
               
              {hasFileUploaded ? (
                // Show uploaded image inline when file is uploaded
                <div className="flex gap-1">
                  <label className="flex-1 cursor-pointer group relative">
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*" 
                      onClick={(e) => e.stopPropagation()}
                      onChange={async (e) => {
                        e.stopPropagation();
                        alert("FILE SELECTED! Uploading...");
                        const file = e.target.files?.[0];
                        if (file) {
                          await handleFileUpload(file, [zone, category, defect.name, 'fileUrl']);
                          alert("UPLOAD COMPLETE! Check image should appear");
                        }
                      }} 
                    />
                    {/* Show thumbnail when uploaded */}
                    <img 
                      src={fileUrl} 
                      alt="Evidence" 
                      className="w-full h-full object-cover rounded-lg border-2 border-emerald-400"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                      <span className="text-[9px] text-white font-bold">Change</span>
                    </div>
                  </label>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCamera({ zone, category, defect: defect.name });
                    }}
                    className="flex flex-col items-center justify-center gap-0.5 p-2 border-2 rounded-lg transition-all flex-1 border-gray-200 dark:border-gray-700 hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10"
                  >
                    <Camera className="w-3 h-3 text-gray-400" />
                    <span className="text-[8px] text-gray-400">Camera</span>
                  </button>
                </div>
              ) : (
                // Show Upload and Camera buttons when no file uploaded
                <div className="flex gap-1">
<label className="flex-1 cursor-pointer group">
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*" 
                      onChange={async (e) => {
                        e.stopPropagation();
                        const file = e.target.files?.[0];
                        if (file) {
                          await handleFileUpload(file, [zone, category, defect.name, 'fileUrl']);
                        }
                      }} 
                    />
                    <div className="flex flex-col items-center justify-center gap-0.5 p-2 border-2 rounded-lg transition-all h-full border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10">
                      <Upload className="w-3 h-3 text-gray-400 group-hover:text-blue-500" />
                      <span className="text-[8px] text-gray-400 group-hover:text-blue-500">Upload</span>
                    </div>
                  </label>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCamera({ zone, category, defect: defect.name });
                    }}
                    className="flex flex-col items-center justify-center gap-0.5 p-2 border-2 rounded-lg transition-all flex-1 border-gray-200 dark:border-gray-700 hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10"
                  >
                    <Camera className="w-3 h-3 text-gray-400" />
                    <span className="text-[8px] text-gray-400">Camera</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    };
    const handleStatusChange = (status: string) => {
      if (status === 'Accepted') {
        onChange({ 
          chassisNumber: autoFilledChassis,
          status, 
          zone: [], 
          zonesData: {}, 
          evidenceUrl: '' 
        });
      } else {
        onChange({ 
          ...(value || {}), 
          status,
          chassisNumber: autoFilledChassis
        });
      }
    };

    const handleChassisChange = (val: string) => {
      onChange({ 
        ...(value || {}), 
        chassisNumber: val,
        status: currentStatus
      });
    };

    const handleZoneToggle = (zone: string) => {
      let nextZones: string[] = [...selectedZones];
      let nextZonesData = { ...zonesData };
      
      if (nextZones.includes(zone)) {
        nextZones = nextZones.filter((z: string) => z !== zone);
        delete nextZonesData[zone];
      } else {
        nextZones = [...nextZones, zone];
        if (!nextZonesData[zone]) {
          nextZonesData[zone] = { categories: [] };
        }
      }
      
      onChange({ ...(value || {}), zone: nextZones, zonesData: nextZonesData, status: currentStatus, chassisNumber: autoFilledChassis });
    };

    const handleCategoriesChange = (zone: string, selectedCategories: string[]) => {
      const zoneData = zonesData[zone] || { categories: [] };
      const existingCategories = (zoneData.categories || []).map((cat: any) => cat?.name);
      const categoriesToAdd = selectedCategories.filter((cat: string) => !existingCategories.includes(cat));
      const categoriesToRemove = existingCategories.filter((cat: string) => !selectedCategories.includes(cat));
      
      let updatedCategories = [...(zoneData.categories || [])];
      categoriesToAdd.forEach(category => updatedCategories.push({ name: category, defects: [] }));
      categoriesToRemove.forEach(category => updatedCategories = updatedCategories.filter((cat: any) => cat?.name !== category));
      
      onChange({
        ...(value || {}),
        zonesData: { ...zonesData, [zone]: { categories: updatedCategories } },
        status: currentStatus,
        chassisNumber: autoFilledChassis
      });
    };

    const handleDefectsChange = (zone: string, categoryName: string, selectedDefects: string[]) => {
      const zoneData = zonesData[zone];
      if (!zoneData || !zoneData.categories) return;
      
      const categoryIndex = zoneData.categories.findIndex((cat: any) => cat?.name === categoryName);
      if (categoryIndex === -1) return;
      
      const existingDefects = (zoneData.categories[categoryIndex].defects || []).map((d: any) => d?.name);
      const defectsToAdd = selectedDefects.filter((d: string) => !existingDefects.includes(d));
      const defectsToRemove = existingDefects.filter((d: string) => !selectedDefects.includes(d));
      
      let updatedDefects = [...(zoneData.categories[categoryIndex].defects || [])];
      defectsToAdd.forEach(defect => updatedDefects.push({ name: defect, details: { remark: "", fileUrl: "" } }));
      defectsToRemove.forEach(defect => updatedDefects = updatedDefects.filter((d: any) => d?.name !== defect));
      
      const updatedCategories = [...zoneData.categories];
      updatedCategories[categoryIndex] = { ...updatedCategories[categoryIndex], defects: updatedDefects };
      
      onChange({
        ...(value || {}),
        zonesData: { ...zonesData, [zone]: { categories: updatedCategories } },
        status: currentStatus,
        chassisNumber: autoFilledChassis
      });
    };

    const handleEvidenceUpload = async (file: File) => {
      try {
        setUploading(prev => ({ ...prev, mainEvidence: true }));
        const result = await apiClient.uploadFile(file, "form");
        const uploadedUrl = apiClient.resolveUploadedFileUrl(result);
        if (uploadedUrl) {
          onChange({ ...(value || {}), evidenceUrl: uploadedUrl, status: currentStatus, chassisNumber: autoFilledChassis });
        }
      } finally {
        setUploading(prev => ({ ...prev, mainEvidence: false }));
      }
    };

    return (
      <div className="space-y-4 mt-2" onClick={e => e.stopPropagation()}>
        {/* Chassis Number Input - ONLY show if trackResponseQuestion is true */}
        {isTrackQuestion && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-1.5">
              Chassis Number *
            </label>
            <input
              type="text"
              value={autoFilledChassis}
              onChange={(e) => handleChassisChange(e.target.value)}
              placeholder="Enter Chassis Number..."
              className="w-full p-2.5 text-xs bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
            />
            {autoFilledChassis && (
              <p className="text-[9px] text-blue-500 mt-1">Auto-filled from previous record</p>
            )}
          </div>
        )}

        {/* Status Selection - ALWAYS show */}
        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
          <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block mb-2">
            Inspection Status (Select Manually)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {['Accepted', 'Rework', 'Rejected'].map((opt) => {
              const lc = opt.toLowerCase();
              const isSelected = currentStatus === opt;
              const colors = lc === 'accepted'
                ? { active: 'bg-green-600 border-green-600 text-white', icon: '✓' }
                : lc === 'rejected'
                ? { active: 'bg-red-600 border-red-600 text-white', icon: '✗' }
                : { active: 'bg-amber-500 border-amber-500 text-white', icon: '↺' };
              return (
                <button
                  key={opt}
                  onClick={() => handleStatusChange(opt)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all text-[10px] font-black
                    ${isSelected ? colors.active : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500'}`}
                >
                  <span className="text-base">{colors.icon}</span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Accepted: Just evidence upload */}
        {currentStatus === 'Accepted' && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl" onClick={(e) => e.stopPropagation()}>
            <label className="text-[10px] font-bold text-gray-500 mb-1 block">Evidence Photo</label>
            {evidenceUrl ? (
              <div className="flex gap-2">
                <label className="flex-1 cursor-pointer group relative">
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleEvidenceUpload(file);
                  }} />
                  <img 
                    src={evidenceUrl} 
                    alt="Evidence" 
                    className="w-full h-32 object-cover rounded-lg border-2 border-emerald-400" 
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                    <span className="text-[10px] text-white font-bold">Change</span>
                  </div>
                </label>
                <button onClick={() => setShowCamera({ isMain: true })} className="flex-1 flex flex-col items-center justify-center gap-1 p-3 border-2 border-dashed rounded-lg hover:border-purple-400">
                  <Camera className="w-4 h-4" />
                  <span className="text-[9px]">Camera</span>
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <label className="flex-1 cursor-pointer">
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleEvidenceUpload(file);
                  }} />
                  <div className="flex flex-col items-center justify-center gap-1 p-3 border-2 border-dashed rounded-lg hover:border-blue-400">
                    {uploading.mainEvidence ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <span className="text-[9px]">Upload</span>
                  </div>
                </label>
                <button onClick={() => setShowCamera({ isMain: true })} className="flex-1 flex flex-col items-center justify-center gap-1 p-3 border-2 border-dashed rounded-lg">
                  <Camera className="w-4 h-4" />
                  <span className="text-[9px]">Camera</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Rework/Rejected: Full defect selection UI - use the renderDefectDetails function defined above */}
        {(currentStatus === 'Rework' || currentStatus === 'Rejected') && (
          <div className="space-y-4">
            {/* Zone Selection */}
            {isWithZone && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Zone Clarification</label>
                <div className="grid grid-cols-2 gap-2">
                  {ZONES.map((zone) => (
                    <button
                      key={zone}
                      type="button"
                      onClick={() => handleZoneToggle(zone)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-[10px] font-medium transition-all
                        ${selectedZones.includes(zone)
                          ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700"
                          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600"}`}
                    >
                      <div className={`w-3 h-3 rounded-sm border flex items-center justify-center ${selectedZones.includes(zone) ? "bg-blue-500 border-blue-500" : "border-gray-300"}`}>
                        {selectedZones.includes(zone) && <CheckCircle className="w-2 h-2 text-white" />}
                      </div>
                      {zone}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Without Zone */}
            {!isWithZone && (
              <div className="space-y-4">
                {(() => {
                  const zone = "Default";
                  const zoneData = zonesData[zone] || { categories: [] };
                  const selectedCategories = (zoneData.categories || []).map((c: any) => c?.name).filter(Boolean);
                  return (
                    <div className="space-y-3">
                      <MultiSelectDropdown
                        options={Object.keys(DEFECT_DATA)}
                        selectedValues={selectedCategories}
                        onChange={(selected: string[]) => {
                          const existing = (zoneData.categories || []).map((c: any) => c?.name);
                          const toAdd = selected.filter((s: string) => !existing.includes(s));
                          const toRemove = existing.filter((e: string) => !selected.includes(e));
                          let updated = [...(zoneData.categories || [])];
                          toAdd.forEach(cat => updated.push({ name: cat, defects: [] }));
                          toRemove.forEach(cat => updated = updated.filter((c: any) => c?.name !== cat));
                          onChange({ ...(value || {}), zonesData: { ...zonesData, [zone]: { categories: updated } }, status: currentStatus, chassisNumber: autoFilledChassis });
                        }}
                        placeholder="Select defect categories..."
                        label="Defect Categories"
                      />
                      {(zoneData.categories || []).map((category: any) => (
                        <div key={category.name} className="ml-3 pl-3 border-l-2 border-gray-200 dark:border-gray-700 space-y-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedCategory(prev => ({ ...prev, [category.name]: !prev[category.name] }));
                              }}
                              className="flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-800 px-1 py-0.5 rounded"
                            >
                              <ChevronRight className={`w-3 h-3 transition-transform ${expandedCategory[category.name] ? 'rotate-90' : ''}`} />
                              <span className="text-[11px] font-semibold">{category.name}</span>
                            </button>
                          </div>
                          {expandedCategory[category.name] && (
                            <div className="ml-4 space-y-2">
                              <MultiSelectDropdown
                                options={DEFECT_DATA[category.name] || []}
                                selectedValues={(category.defects || []).map((d: any) => d?.name).filter(Boolean)}
                                onChange={(selected: string[]) => {
                                  const existing = (category.defects || []).map((d: any) => d?.name);
                                  const toAdd = selected.filter((s: string) => !existing.includes(s));
                                  const toRemove = existing.filter((e: string) => !selected.includes(e));
                                  let updated = [...(category.defects || [])];
                                  toAdd.forEach(def => updated.push({ name: def, details: { remark: "", fileUrl: "" } }));
                                  toRemove.forEach(def => updated = updated.filter((d: any) => d?.name !== def));
                                  const updatedCategories = [...(zoneData.categories || [])];
                                  const catIdx = updatedCategories.findIndex((c: any) => c?.name === category.name);
                                  if (catIdx !== -1) {
                                    updatedCategories[catIdx] = { ...category, defects: updated };
                                  }
                                  onChange({ ...(value || {}), zonesData: { ...zonesData, [zone]: { categories: updatedCategories } }, status: currentStatus, chassisNumber: autoFilledChassis });
                                }}
                                placeholder="Select specific defects..."
                                label="Specific Defects"
                              />
                              {(category.defects || []).map((defect: any) => renderDefectDetails(zone, category.name, defect))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* With Zone - Render each selected zone */}
            {isWithZone && selectedZones.map((zone: string) => {
              const zoneData = zonesData[zone] || { categories: [] };
              const selectedCategories = (zoneData.categories || []).map((c: any) => c?.name).filter(Boolean);
              const isExpanded = expandedZone === zone;
              return (
                <div key={zone} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedZone(isExpanded ? null : zone)}
                    className="w-full flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      <span className="text-[11px] font-bold">{zone}</span>
                      {(zoneData.categories || []).length > 0 && (
                        <span className="text-[9px] text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full">
                          {(zoneData.categories || []).length}
                        </span>
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="p-3 space-y-3 border-t border-gray-100 dark:border-gray-800">
                      <MultiSelectDropdown
                        options={Object.keys(DEFECT_DATA)}
                        selectedValues={selectedCategories}
                        onChange={(selected: string[]) => handleCategoriesChange(zone, selected)}
                        placeholder="Select defect categories..."
                        label="Defect Categories"
                      />
                      {(zoneData.categories || []).map((category: any) => (
                        <div key={category.name} className="ml-3 pl-3 border-l-2 border-gray-200 dark:border-gray-700 space-y-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedCategory(prev => ({ ...prev, [`${zone}-${category.name}`]: !prev[`${zone}-${category.name}`] }));
                              }}
                              className="flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-800 px-1 py-0.5 rounded"
                            >
                              <ChevronRight className={`w-3 h-3 transition-transform ${expandedCategory[`${zone}-${category.name}`] ? 'rotate-90' : ''}`} />
                              <span className="text-[10px] font-semibold">{category.name}</span>
                            </button>
                          </div>
                          {expandedCategory[`${zone}-${category.name}`] && (
                            <div className="ml-4 space-y-2">
                              <MultiSelectDropdown
                                options={DEFECT_DATA[category.name] || []}
                                selectedValues={(category.defects || []).map((d: any) => d?.name).filter(Boolean)}
                                onChange={(selected: string[]) => handleDefectsChange(zone, category.name, selected)}
                                placeholder="Select specific defects..."
                                label="Specific Defects"
                              />
                              {(category.defects || []).map((defect: any) => renderDefectDetails(zone, category.name, defect))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* General Remarks */}
        {(currentStatus === 'Rework' || currentStatus === 'Rejected') && (
          <div 
            className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800"
            onClick={(e) => e.stopPropagation()}
          >
            <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest block mb-1">
              General Remarks
            </label>
            <textarea
              rows={2}
              value={value?.remark || ''}
              onChange={(e) => {
                e.stopPropagation();
                onChange({ ...(value || {}), remark: e.target.value, status: currentStatus, chassisNumber: autoFilledChassis });
              }}
              onKeyDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              placeholder="Enter general remarks..."
              className="w-full p-2 text-xs bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-700 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none resize-y"
            />
          </div>
        )}

        {/* Camera Modal */}
        {showCamera && createPortal(
          <CameraCapture
            onCapture={async (file, remark) => {
              if (showCamera.isMain) {
                await handleEvidenceUpload(file);
              } else if (showCamera.zone && showCamera.category && showCamera.defect) {
                await handleFileUpload(file, [showCamera.zone, showCamera.category, showCamera.defect, 'fileUrl']);
              }
              setShowCamera(null);
            }}
            onClose={() => setShowCamera(null)}
          />,
          document.body
        )}
      </div>
    );
  }

  // ── RADIO / SELECT / CHECKBOX ────────────────────────────────
  if (['radio', 'select', 'checkbox-group', 'multiselect'].includes(question.type) 
      && question.options?.length > 0) {
    const isMulti = question.type === 'checkbox-group' || 
                    question.type === 'multiselect';
    const selectedArr: string[] = isMulti
      ? (Array.isArray(value?.selected) ? value.selected : [])
      : [];

    return (
      <div className="space-y-2 mt-2" onClick={e => e.stopPropagation()}>
        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
          <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block mb-2">
            {question.subParam1 || question.text}
          </label>
          <div className="flex flex-wrap gap-2">
            {question.options?.map((opt: string) => {
              const isSelected = isMulti
                ? selectedArr.includes(opt)
                : currentSelection === opt;

              return (
                <button
                  key={opt}
                  onClick={() => {
                    if (isMulti) {
                      const next = isSelected
                        ? selectedArr.filter(s => s !== opt)
                        : [...selectedArr, opt];
                      onChange({ ...(value || {}), selected: next });
                    } else {
                      handleOptionSelect(opt);
                    }
                  }}
                  className={`px-3 py-1.5 text-[10px] font-black rounded-lg border-2 transition-all
                    ${isSelected
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-indigo-300'
                    }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── NUMBER ───────────────────────────────────────────────────
  if (question.type === 'number') {
    return (
      <div className="mt-2" onClick={e => e.stopPropagation()}>
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">
            {question.subParam1 || question.text}
          </label>
          <input
            type="number"
            value={value?.suggestion ?? (typeof value === 'number' ? value : '')}
            onChange={e => onChange(
              typeof value === 'object' && value !== null
                ? { ...value, suggestion: e.target.value }
                : e.target.value
            )}
            placeholder="0.00"
            className="w-full p-2.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>
    );
  }

  // ── TEXTAREA ─────────────────────────────────────────────────
  if (question.type === 'textarea' || question.type === 'long-text') {
    return (
      <div className="mt-2" onClick={e => e.stopPropagation()}>
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">
            {question.subParam1 || question.text}
          </label>
          <textarea
            rows={3}
            value={value?.suggestion || (typeof value === 'string' ? value : '')}
            onChange={e => onChange(
              typeof value === 'object' && value !== null
                ? { ...value, suggestion: e.target.value }
                : e.target.value
            )}
            placeholder={question.placeholder || "Enter text..."}
            className="w-full p-2.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
          />
        </div>
      </div>
    );
  }

  // ── DEFAULT: text input ──────────────────────────────────────
  return (
    <div className="mt-2" onClick={e => e.stopPropagation()}>
      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">
          {question.subParam1 || question.text}
        </label>
        <input
          type="text"
          value={value?.suggestion || (typeof value === 'string' ? value : '')}
          onChange={e => onChange(
            typeof value === 'object' && value !== null
              ? { ...value, suggestion: e.target.value }
              : e.target.value
          )}
          placeholder={question.placeholder || "Enter correction..."}
          className="w-full p-2.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>
    </div>
  );
};
export default function FormAnalyticsDashboard() {
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const isInspector = user?.role === "inspector";
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Guest mode detection
  const isGuest = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get("guest") === "true" || !!localStorage.getItem("guest_auth_token");
  }, [location.search]);

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
      setShareAnalyticsModal({ open: true, formId: id });
    }
  };

  const [responses, setResponses] = useState<Response[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoOpenSectionId, setAutoOpenSectionId] = useState<string | null>(
    null,
  );
  const [analyticsView, setAnalyticsView] = useState<
    "question" | "section" | "table" | "responses" | "dashboard" | "comparison"
  >(isGuest ? "dashboard" : user?.role === "inspector" ? "responses" : "section");
  const [tableViewType, setTableViewType] = useState<"question" | "section">(
    "question",
  );
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);

  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");
  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
  const [filterValues, setFilterValues] = useState<string[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);

  const [showWeightageColumns, setShowWeightageColumns] = useState(false);
  const [addWeightMode, setAddWeightMode] = useState(false);
  const [showWeightageCheckbox, setShowWeightageCheckbox] = useState(true);
  const [editingWeightage, setEditingWeightage] = useState<string | null>(null);
  const [weightageValue, setWeightageValue] = useState<string>("");
  const [savingWeightage, setSavingWeightage] = useState(false);
  const [editingAllWeightages, setEditingAllWeightages] = useState(false);
  const [weightageValues, setWeightageValues] = useState<
    Record<string, string>
  >({});

  const [redistributionMode, setRedistributionMode] = useState(false);
  const [tempWeightageValues, setTempWeightageValues] = useState<
    Record<string, string>
  >({});
  const [weightageBalance, setWeightageBalance] = useState(0);

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSectionSelector, setShowSectionSelector] = useState(false);
  const [shareAnalyticsModal, setShareAnalyticsModal] = useState<{
    open: boolean;
    formId: string;
  }>({ open: false, formId: "" });
  const [appliedFilters, setAppliedFilters] = useState<
    Array<{ id: string; label: string; value: string }>
  >([]);
  const [cascadingFilters, setCascadingFilters] = useState<
    Record<string, string[]>
  >({});
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatResponse, setChatResponse] = useState<Response | null>(null);
  const [chatFilters, setChatFilters] = useState({
    chassisNumber: "",
    location: "",
    questions: [] as string[],
    selectedCategories: {} as Record<string, string[]>,
    suggestedAnswers: {} as Record<string, any>,
    zoneType: "both" as "with" | "without" | "both",
  });
  const [searchParams] = useSearchParams();
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [dateFilter, setDateFilter] = useState<{
    type: "all" | "single" | "range";
    startDate: string;
    endDate: string;
  }>({ type: "all", startDate: "", endDate: "" });
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [columnFilters, setColumnFilters] = useState<
    Record<string, string[] | null>
  >({});
  const [selectedResponsesSectionIds, setSelectedResponsesSectionIds] =
    useState<string[]>([]);
  const [showResponsesFilter, setShowResponsesFilter] = useState(false);
  const [editingResponseId, setEditingResponseId] = useState<string | null>(
    null,
  );
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingResponseId, setDeletingResponseId] = useState<string | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedResponseIds, setSelectedResponseIds] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
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

  const complianceLabels = useMemo(() => {
    const defaultLabels = { yes: "Yes", no: "No", na: "N/A" };
    let labels = { ...defaultLabels };

    if (form?.sections) {
      for (const section of form?.sections) {
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
  }, [form]);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      // Guest access check
      if (isGuest) {
        const guestToken = localStorage.getItem("guest_auth_token");
        const guestFormId = localStorage.getItem("guest_form_id");
        const guestExpiresAt = localStorage.getItem("guest_expires_at");

        const isExpired = guestExpiresAt ? new Date() > new Date(guestExpiresAt) : true;

        if (!guestToken || guestFormId !== id || isExpired) {
          // Clear expired or invalid guest session
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
        setError(null);

        console.log("[ANALYTICS DEBUG] Fetching form:", id);

        // Fetch form details
        const formData = await apiClient.getForm(id);
        setForm(formData.form);

        console.log("[ANALYTICS DEBUG] Form fetched:", formData.form?.title);

        // Initialize selected sections for responses view - select all by default
        if (formData.form?.sections && formData.form?.sections.length > 0) {
          setSelectedResponsesSectionIds(
            formData.form?.sections?.map((s: Section) => s.id),
          );
        }

        // Fetch responses for this form
        console.log("[ANALYTICS DEBUG] Fetching responses for form:", id);
        const responsesData = await apiClient.getFormResponses(id);
        console.log(
          "[ANALYTICS DEBUG] Responses fetched:",
          responsesData.responses?.length || 0,
        );
        setResponses(responsesData.responses || []);
      } catch (err) {
        console.error("Error fetching analytics data:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load analytics",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // Add this useEffect to update selectedQuestion
  useEffect(() => {
    if (!selectedQuestionId || !form?.sections?.[0]) {
      setSelectedQuestion(null);
      return;
    }

    // Find the selected question from the FIRST section only
    const firstSection = form?.sections?.[0];
    if (!firstSection?.questions) {
      setSelectedQuestion(null);
      return;
    }
    const foundQuestion = firstSection.questions.find(
      (q: any) => q.id === selectedQuestionId,
    );

    console.log("Found question:", foundQuestion); // For debugging
    console.log("Question options:", foundQuestion?.options); // For debugging

    setSelectedQuestion(foundQuestion || null);
  }, [selectedQuestionId, form]);

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
    form?.sections?.forEach((section) => {
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

  const filteredResponses = useMemo(() => {
    let result = responses;

    // 0. Role-based Filter (Inspector sees their own responses only)
    if (user?.role === "inspector") {
      const userEmail = user.email || "";
      const userUsername = user.username || "";
      const userId = user._id || user.id;

      result = result.filter((r) => {
        // Match by createdBy (strict - only if not null)
        const creatorId =
          typeof r.createdBy === "object"
            ? (r.createdBy as any)?._id || (r.createdBy as any)?.id
            : r.createdBy;
        const creatorIdStr = creatorId ? String(creatorId) : null;
        const userIdStr = String(userId);

        // Match by submittedBy (username or email) - only if NOT "Anonymous"
        const submittedBy = r.submittedBy || "";

        // Match by submitterContact.email
        const submitterEmail = r.submitterContact?.email || "";

        // Return true ONLY if we have a strict match (not null createdBy)
        // This ensures inspectors only see their OWN responses
        return (
          creatorIdStr === userIdStr ||
          (submittedBy !== "Anonymous" &&
            submittedBy !== "" &&
            (submittedBy === userEmail ||
              submittedBy === userUsername ||
              submitterEmail === userEmail))
        );
      });
    }

    // 1. Date Filter
    if (dateFilter.type !== "all") {
      result = result.filter((response) => {
        const timestamp = getResponseTimestamp(response);
        if (!timestamp) return false;
        const responseDate = new Date(timestamp).toISOString().split("T")[0];

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
      // Create a map of all questions for quick lookup
      const allQuestionsMap = new Map();
      form?.sections?.forEach(section => {
        section.questions?.forEach(q => {
          allQuestionsMap.set(q.id, q);
        });
      });
      form?.followUpQuestions?.forEach(q => {
        allQuestionsMap.set(q.id, q);
      });

      result = result.filter((response) => {
        return cascadingFiltersArray.every(([questionId, selectedAnswers]) => {
          const answer = response.answers[questionId];
          if (!answer) return false;

          const question = allQuestionsMap.get(questionId);

          if (question?.type === 'chassis-with-zone') {
            const zones = Array.isArray(answer.zone) ? answer.zone : [answer.zone];
            return zones.some((z: string) =>
              selectedAnswers.some(sel => String(z || '').toLowerCase() === String(sel || '').toLowerCase())
            );
          } else if (question?.type === 'chassis-without-zone') {
            return selectedAnswers.some(sel => String(answer.chassisNumber || '').toLowerCase() === String(sel || '').toLowerCase());
          }

          // Handle different answer types
          if (Array.isArray(answer)) {
            return answer.some((item) =>
              selectedAnswers.some(
                (selectedAnswer) =>
                  String(item).toLowerCase() === selectedAnswer.toLowerCase(),
              ),
            );
          }
          return selectedAnswers.some(
            (selectedAnswer) =>
              String(answer).toLowerCase() === selectedAnswer.toLowerCase(),
          );
        });
      });
    }

    // 4. Column Filters (Excel-like filtering)
    const columnFiltersArray = Object.entries(columnFilters).filter(
      ([_, values]) => values !== null && values.length > 0,
    );

    if (columnFiltersArray.length > 0) {
      result = result.filter((response) => {
        return columnFiltersArray.every(([questionId, selectedValues]) => {
          const answer = response.answers[questionId];

          if (selectedValues === null || selectedValues.length === 0) {
            return true;
          }

          if (answer === null || answer === undefined) {
            return selectedValues.includes("");
          }

          // Handle different answer types
          if (Array.isArray(answer)) {
            return answer.some((item) =>
              selectedValues.some(
                (selectedValue) =>
                  String(item).trim().toLowerCase() ===
                  selectedValue.toLowerCase(),
              ),
            );
          }

          return selectedValues.some(
            (selectedValue) =>
              String(answer).trim().toLowerCase() ===
              selectedValue.toLowerCase(),
          );
        });
      });
    }

    return result;
  }, [responses, cascadingFilters, dateFilter, locationFilter, columnFilters]);

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

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split("T")[0];
    }).reverse();

    const maxCount = Math.max(
      ...last7Days.map((date) => responseTrend[date] || 0),
      1,
    );
    const percentageData = last7Days.map((date) =>
      Math.round(((responseTrend[date] || 0) / maxCount) * 100),
    );

    return {
      total,
      pending,
      verified,
      rejected,
      recentResponses,
      responseTrend,
      last7Days,
      percentageData,
    };
  }, [filteredResponses]);

  const sectionPerformanceStats = useMemo(
    () => computeSectionPerformanceStats(form, filteredResponses),
    [form, filteredResponses],
  );

  const filteredSectionStats = useMemo(
    () =>
      sectionPerformanceStats.filter(
        (stat) =>
          stat.yes > 0 || stat.no > 0 || stat.na > 0 || stat.weightage > 0,
      ),
    [sectionPerformanceStats],
  );

  useEffect(() => {
    const availableIds = filteredSectionStats.map((stat) => stat.id);
    setSelectedSectionIds((prev) => {
      if (!availableIds.length) {
        return [];
      }
      if (!prev.length) {
        return availableIds;
      }
      const next = prev.filter((id) => availableIds.includes(id));
      return next.length ? next : availableIds;
    });
  }, [filteredSectionStats]);

  const visibleSectionStats = useMemo(
    () =>
      filteredSectionStats.filter((stat) =>
        selectedSectionIds.includes(stat.id),
      ),
    [filteredSectionStats, selectedSectionIds],
  );

  const fetchChatHistory = async (responseId: string) => {
    try {
      const response = await apiClient.get<any[]>(`/messages/response/${responseId}`);
      if (response.success) {
        setChatMessages(response.data);
      }
    } catch (err) {
      console.error("Error fetching chat history:", err);
    }
  };

  useEffect(() => {
    if (showChatModal && chatResponse) {
      fetchChatHistory(chatResponse.id);
    }
  }, [showChatModal, chatResponse]);

  // Auto-open chat modal if responseId is in URL
  useEffect(() => {
    const responseId = searchParams.get('responseId');
    if (responseId && responses.length > 0) {
      const response = responses.find(r => r.id === responseId || r._id === responseId);
      if (response && !showChatModal) {
        setChatResponse(response);
        setShowChatModal(true);
      }
    }
  }, [searchParams, responses, showChatModal]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !chatResponse) return;

    setIsSendingMessage(true);
    try {
      const questionContexts: any[] = [];
      const selectedQuestionTitles: string[] = [];
      chatFilters.questions.forEach(qid => {
        form?.sections?.forEach(section => {
          const q = section.questions?.find(q => q.id === qid);
          if (q) {
            const rawAnswer = chatResponse.answers?.[qid];
            let filteredAnswer = rawAnswer;

            // Apply category filtering if selections exist
            if (rawAnswer && typeof rawAnswer === 'object' && rawAnswer.categories && chatFilters.selectedCategories[qid]) {
              const selectedNames = chatFilters.selectedCategories[qid];
              if (selectedNames.length > 0) {
                filteredAnswer = {
                  ...rawAnswer,
                  categories: rawAnswer.categories.filter((cat: any) => selectedNames.includes(cat.name))
                };
              }
            }

            // Parse flat array into structured object for chassis-with-zone questions
            let structuredAnswer = filteredAnswer;
            if (q.type === 'chassis-with-zone' || q.type === 'chassis-without-zone') {
              // Always use chatFilters.suggestedAnswers for current values (they have the latest changes including uploads)
              const currentValue = chatFilters.suggestedAnswers?.[qid];
              if (currentValue) {
                // Use the suggestedAnswers which has the latest data
                structuredAnswer = {
                  status: currentValue.status || '',
                  chassisNumber: currentValue.chassisNumber || '',
                  zones: Array.isArray(currentValue.zone) ? currentValue.zone.join(', ') : (currentValue.zone || ''),
                  zonesData: currentValue.zonesData,
                  evidenceUrl: currentValue.evidenceUrl || ''
                };
                // Add categories from zonesData
                if (currentValue.zonesData) {
                  const cats: any[] = [];
                  Object.entries(currentValue.zonesData).forEach(([zoneName, zoneData]: [string, any]) => {
                    if (zoneData?.categories) {
                      zoneData.categories.forEach((cat: any) => {
                        const defectsArr = (cat.defects || []).map((d: any) => ({
                          name: d.name,
                          details: d.details || { remark: '', fileUrl: '' }
                        }));
                        cats.push({ name: cat.name, defects: defectsArr });
                      });
                    }
                  });
                  if (cats.length > 0) structuredAnswer.categories = cats;
                }
              } else if (Array.isArray(filteredAnswer) && filteredAnswer.length >= 7) {
                // Fallback to array parsing
                structuredAnswer = {
                  status: filteredAnswer[1] || '',
                  chassisNumber: filteredAnswer[0] || '',
                  zones: filteredAnswer[2] || '',
                  categories: filteredAnswer[3] ? [{ name: filteredAnswer[3], defects: filteredAnswer[4] ? [{ name: filteredAnswer[4], details: { remark: filteredAnswer[5] || '', fileUrl: filteredAnswer[6] || '' }}] : [] }] : []
                };
              } else if (filteredAnswer?.zonesData) {
                structuredAnswer = filteredAnswer;
              }
            }
            
            questionContexts.push({
              questionId: qid,
              title: q.text || 'Question',
              answer: structuredAnswer,
              suggestion: chatFilters.suggestedAnswers[qid]
            });
            selectedQuestionTitles.push(q.text || 'Question');
          }
        });
      });

      // Extract email from createdBy object or string
      const createdByObj = chatResponse.createdBy;
      const createdByEmail = (createdByObj && typeof createdByObj === 'object') 
        ? (createdByObj.email || createdByObj._id?.toString()) 
        : (typeof createdByObj === 'string' ? createdByObj : 'inspector@focus.com');
      
      console.log("[handleSendMessage] createdBy:", createdByObj);
      console.log("[handleSendMessage] toEmail:", createdByEmail);

      await apiClient.post("/messages/send", {
        toEmail: createdByEmail,
        message: newMessage,
        responseId: chatResponse.id,
        formId: id,
        questionIds: chatFilters.questions,
        questionTitles: selectedQuestionTitles,
        questionContexts: questionContexts,
        tenantId: form?.tenantId || (user?.tenantId as any)?._id || user?.tenantId
      });

      setNewMessage("");
      fetchChatHistory(chatResponse.id);
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const getQuestionStats = (questionId: string) => {
    const questionResponses = responses.filter(r => r.answers && r.answers[questionId]);
    const accepted = questionResponses.filter(r => r.status === "verified").length;
    const rejected = questionResponses.filter(r => r.status === "rejected").length;
    const pending = questionResponses.filter(r => !r.status || r.status === "pending").length;

    return { accepted, rejected, pending, total: questionResponses.length };
  };

  const renderSuggestion = (suggestion: any) => {
  if (!suggestion || Object.keys(suggestion).length === 0) return null;

  // Check if this is a chassis-with-zone or chassis-without-zone structure
  const isChassisStructure = suggestion.status !== undefined || 
                              suggestion.chassisNumber !== undefined || 
                              suggestion.zonesData !== undefined ||
                              suggestion.zone !== undefined;

  if (isChassisStructure) {
    // Format chassis structure with proper headings
    const sections: JSX.Element[] = [];

    // Status
    if (suggestion.status && suggestion.status.trim()) {
      const statusColor = 
        suggestion.status.toLowerCase() === 'accepted' ? 'text-green-600 bg-green-50 border-green-200' :
        suggestion.status.toLowerCase() === 'rejected' ? 'text-red-600 bg-red-50 border-red-200' :
        'text-amber-600 bg-amber-50 border-amber-200';
      
      sections.push(
        <div key="status" className="flex items-center gap-2 p-2 rounded-lg border" style={{ backgroundColor: 'rgba(var(--status-bg), 0.1)' }}>
          <span className={`px-2 py-1 rounded-md text-[11px] font-black uppercase ${statusColor} border shadow-sm`}>
            Status: {suggestion.status}
          </span>
        </div>
      );
    }

    // Chassis Number
    if (suggestion.chassisNumber && suggestion.chassisNumber.trim()) {
      sections.push(
        <div key="chassis" className="p-2 rounded-lg border border-gray-200 dark:border-gray-700">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Chassis Number</span>
          <span className="text-[11px] font-mono font-bold text-gray-700 dark:text-gray-300">{suggestion.chassisNumber}</span>
        </div>
      );
    }

    // Handle zonesData (with zones)
    if (suggestion.zonesData && typeof suggestion.zonesData === 'object') {
      Object.entries(suggestion.zonesData).forEach(([zoneName, zoneData]: [string, any]) => {
        if (zoneData?.categories && Array.isArray(zoneData.categories)) {
          zoneData.categories.forEach((category: any) => {
            const categoryName = category.name;
            const defects = category.defects || [];
            
            defects.forEach((defect: any) => {
              const defectName = defect.name;
              const remark = defect.details?.remark || defect.remark || '';
              const fileUrl = defect.details?.fileUrl || defect.fileUrl || '';
              
              sections.push(
                <div key={`${zoneName}-${categoryName}-${defectName}`} className="p-3 rounded-lg border-l-4 border-indigo-400 bg-indigo-50/30 dark:bg-indigo-900/20 space-y-2">
                  <div className="grid grid-cols-1 gap-2">
                    {zoneName && (
                      <div>
                        <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wider">Zone</span>
                        <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{zoneName}</p>
                      </div>
                    )}
                    {categoryName && (
                      <div>
                        <span className="text-[9px] font-bold text-purple-500 uppercase tracking-wider">Category</span>
                        <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{categoryName}</p>
                      </div>
                    )}
                    {defectName && (
                      <div>
                        <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">Defect</span>
                        <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{defectName}</p>
                      </div>
                    )}
                    {remark && remark.trim() && (
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Remark</span>
                        <p className="text-[10px] italic text-gray-600 dark:text-gray-400">"{remark}"</p>
                      </div>
                    )}
                    {fileUrl && fileUrl.trim() && (
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Evidence :</span>
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
                </div>
              );
            });
          });
        }
      });
    }

    // Handle zone array (for chassis-with-zone without full zonesData)
    if (suggestion.zone && !suggestion.zonesData) {
      const zones = Array.isArray(suggestion.zone) ? suggestion.zone : [suggestion.zone];
      if (zones.length > 0) {
        sections.push(
          <div key="zones" className="p-2 rounded-lg border border-gray-200 dark:border-gray-700">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Zone(s)</span>
            <div className="flex flex-wrap gap-1">
              {zones.filter(z => z && z.trim()).map((zone, idx) => (
                <span key={idx} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-[10px] font-bold">
                  {zone}
                </span>
              ))}
            </div>
          </div>
        );
      }
    }

    // Handle categories array (for chassis-without-zone)
    if (suggestion.categories && Array.isArray(suggestion.categories)) {
      suggestion.categories.forEach((category: any) => {
        const categoryName = category.name;
        const defects = category.defects || [];
        
        defects.forEach((defect: any) => {
          const defectName = defect.name;
          const remark = defect.details?.remark || defect.remark || '';
          const fileUrl = defect.details?.fileUrl || defect.fileUrl || '';
          
          sections.push(
            <div key={`${categoryName}-${defectName}`} className="p-3 rounded-lg border-l-4 border-purple-400 bg-purple-50/30 dark:bg-purple-900/20 space-y-2">
              <div className="grid grid-cols-1 gap-2">
                {categoryName && (
                  <div>
                    <span className="text-[9px] font-bold text-purple-500 uppercase tracking-wider">Category</span>
                    <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{categoryName}</p>
                  </div>
                )}
                {defectName && (
                  <div>
                    <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">Defect</span>
                    <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{defectName}</p>
                  </div>
                )}
                {remark && remark.trim() && (
                  <div>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Remark</span>
                    <p className="text-[10px] italic text-gray-600 dark:text-gray-400">"{remark}"</p>
                  </div>
                )}
                {fileUrl && fileUrl.trim() && (
                  <div>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Evidence</span>
                    <a 
                      href={fileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline mt-1"
                    >
                      <Eye className="w-3 h-3" />
                      View Evidence
                    </a>
                  </div>
                )}
              </div>
            </div>
          );
        });
      });
    }

    // Evidence URL
    if (suggestion.evidenceUrl && suggestion.evidenceUrl.trim()) {
      sections.push(
        <div key="evidence" className="p-2 rounded-lg border border-gray-200 dark:border-gray-700">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">General Evidence</span>
          <a 
            href={suggestion.evidenceUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline"
          >
            <Eye className="w-3 h-3" />
            View Evidence
          </a>
        </div>
      );
    }

    if (sections.length === 0) return null;

    return (
      <div className="mt-1 p-2 bg-indigo-50 dark:bg-indigo-900/40 rounded-xl border border-indigo-100 dark:border-indigo-800 shadow-sm">
        <div className="space-y-2">
          {sections}
        </div>
      </div>
    );
  }

  // Original flat rendering for non-chassis structures (kept as fallback)
  const renderNested = (data: any, depth = 0) => {
    return Object.entries(data).map(([key, val]: [string, any], idx) => {
      if (key === 'selected') {
        return (
          <div key={idx} className="flex items-center gap-1.5 mb-1">
            <span className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-black uppercase">
              Suggested: {String(val)}
            </span>
          </div>
        );
      }

      return (
        <div key={idx} className="pl-3 border-l border-indigo-200 dark:border-indigo-800 mt-1">
          {typeof val === 'object' ? renderNested(val, depth + 1) : (
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-gray-400">Response:</span>
              <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 italic">"{String(val)}"</span>
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="mt-2 p-2 bg-indigo-50 dark:bg-indigo-900/40 rounded-xl border border-indigo-100 dark:border-indigo-800 shadow-sm animate-pulse-slow">
      <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
        <Edit className="w-2.5 h-2.5" />
        Admin Instructions
      </p>
      {renderNested(suggestion)}
    </div>
  );
};

 

  const renderFormattedAnswer = (answer: any, qId?: string, isSelectable?: boolean): React.ReactNode => {
    if (answer === undefined || answer === null || answer === '') return <span className="text-gray-400 italic font-medium">No answer provided</span>;

    // Handle complex Chassis/Inspection object (Standard structure for defects)
    if (typeof answer === 'object' && !Array.isArray(answer) && (answer.chassisNumber || answer.status || answer.categories)) {
      const status = answer.status || 'Unknown';
      const statusColor =
        status.toLowerCase() === 'accepted' || status.toLowerCase() === 'verified' ? 'text-green-600 bg-green-50 border-green-100' :
          status.toLowerCase() === 'rejected' ? 'text-red-600 bg-red-50 border-red-100' :
            'text-amber-600 bg-amber-50 border-amber-100';

      return (
        <div className="space-y-3 mt-2">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase border-2 ${statusColor} shadow-sm`}>
              {status}
            </span>
            {answer.chassisNumber && (
              <span className="text-[11px] font-extrabold text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">
                VIN: {answer.chassisNumber}
              </span>
            )}
          </div>

          {(answer.categories || []).length > 0 && (
            <div className="space-y-4 relative pl-3 ml-1 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-indigo-200 before:to-transparent dark:before:from-indigo-900/50">
              {(answer.categories || []).map((cat: any, idx: number) => {
                const isCatSelected = !isSelectable || !qId || (chatFilters.selectedCategories[qId]?.includes(cat.name) ?? true);

                return (
                  <div key={idx} className={`space-y-2 transition-opacity ${!isCatSelected ? 'opacity-40' : 'opacity-100'}`}>
                    <div className="flex items-center gap-2">
                      {isSelectable && qId && (
                        <input
                          type="checkbox"
                          checked={isCatSelected}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setChatFilters(prev => {
                              const current = prev.selectedCategories[qId] || (answer.categories || []).map((c: any) => c.name);
                              const next = checked
                                ? [...current, cat.name]
                                : current.filter(n => n !== cat.name);
                              return {
                                ...prev,
                                selectedCategories: { ...prev.selectedCategories, [qId]: next }
                              };
                            });
                          }}
                          className="w-3 h-3 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                        />
                      )}
                      <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                        {!isSelectable && <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />}
                        {cat.name}
                      </p>
                    </div>

                    <div className="space-y-2 pl-3">
                      {cat.defects?.map((defect: any, dIdx: number) => (
                        <div key={dIdx} className="bg-white dark:bg-gray-800/50 p-2 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
                          <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1">
                            {defect.name}
                          </span>
                          {defect.details?.remark && (
                            <div className="flex items-start gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-1.5 rounded-lg border-l-2 border-indigo-400">
                              <MessageCircle className="w-3 h-3 mt-0.5 shrink-0" />
                              <span className="italic leading-relaxed">"{defect.details.remark}"</span>
                            </div>
                          )}
                          {defect.details?.fileUrl && (
                            <a
                              href={defect.details.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold text-indigo-600 hover:underline"
                            >
                              View Evidence
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {answer.evidenceUrl && (
            <div className={`pt-2 transition-opacity ${isSelectable && qId && chatFilters.selectedCategories[qId]?.length > 0 ? 'opacity-40' : 'opacity-100'}`}>
              <a
                href={answer.evidenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-[10px] font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200"
              >
                <Eye className="w-3.5 h-3.5" />
                General Evidence
              </a>
            </div>
          )}
        </div>
      );
    }

    // Handle generic objects (that don't match the specific chassis structure)
    if (typeof answer === 'object' && !Array.isArray(answer)) {
      return (
        <div className="grid grid-cols-1 gap-1.5 mt-1 border-l-2 border-indigo-100 pl-3">
          {Object.entries(answer).filter(([_, v]) => v !== null && v !== undefined && v !== '').map(([key, val], idx) => (
            <div key={idx} className="flex flex-col">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{String(val)}</span>
            </div>
          ))}
        </div>
      );
    }

    // Handle array of values
    if (Array.isArray(answer)) {
      return (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {answer.map((val, idx) => (
            <span key={idx} className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg text-[10px] font-black border border-indigo-100 dark:border-indigo-800/50 shadow-sm">
              {String(val)}
            </span>
          ))}
        </div>
      );
    }

    // Handle simple value
    return <span className="text-sm font-black text-gray-800 dark:text-gray-100">{String(answer)}</span>;
  };

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
      if (a === "") return 1;
      if (b === "") return -1;
      return a.localeCompare(b);
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
    const ensureAbsoluteFileSource = (input: string) => {
      if (!input) {
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

    const extractFileName = (input: string | undefined) => {
      if (!input) {
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
        if (value.zone) {
          const zoneVal = Array.isArray(value.zone)
            ? value.zone.join(", ")
            : String(value.zone);
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
                    : cat?.name || cat?.category || "-";
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

        // Handle evidenceUrl
        if (
          value.evidenceUrl &&
          String(value.evidenceUrl).toLowerCase() !== "no response" &&
          String(value.evidenceUrl).trim()
        ) {
          parts.push({
            label: "Evidence",
            value: String(value.evidenceUrl),
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
                    {part.isImage ? (
                      <ImageLink text={part.value} />
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

    return String(value);
  };

  const handleSelectAllSections = () => {
    setSelectedSectionIds(filteredSectionStats.map((stat) => stat.id));
  };

  const toggleSectionSelection = (sectionId: string) => {
    setSelectedSectionIds((prev) => {
      if (prev.includes(sectionId)) {
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter((id) => id !== sectionId);
      }
      return [...prev, sectionId];
    });
  };

  const sectionChartData = useMemo(() => {
    const calculatePercentage = (value: number, total: number) =>
      total ? parseFloat(((value / total) * 100).toFixed(1)) : 0;

    return {
      labels: visibleSectionStats.map((stat) => formatSectionLabel(stat.title)),
      datasets: [
        {
          label: complianceLabels.yes,
          data: visibleSectionStats.map((stat) =>
            calculatePercentage(stat.yes, stat.total),
          ),
          backgroundColor: "#1d4ed8",
          borderRadius: 4,
        },
        {
          label: complianceLabels.no,
          data: visibleSectionStats.map((stat) =>
            calculatePercentage(stat.no, stat.total),
          ),
          backgroundColor: "#3b82f6",
          borderRadius: 4,
        },
        {
          label: complianceLabels.na,
          data: visibleSectionStats.map((stat) =>
            calculatePercentage(stat.na, stat.total),
          ),
          backgroundColor: "#93c5fd",
          borderRadius: 4,
        },
      ],
    };
  }, [filteredSectionStats]);

  const sectionChartOptions = useMemo(
    () => ({
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 16, right: 32, bottom: 16, left: 8 },
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#374151",
            generateLabels: (chart: any) => {
              const labels =
                ChartJS.defaults.plugins.legend.labels.generateLabels(chart);
              labels.forEach((label: any) => {
                label.color = document.documentElement.classList.contains(
                  "dark",
                )
                  ? "#d1d5db"
                  : "#374151";
              });
              return labels;
            },
          },
        },
        tooltip: {
          callbacks: {
            title: (items: any[]) => {
              const index = items?.[0]?.dataIndex;
              if (index === undefined) {
                return "";
              }
              return visibleSectionStats[index]?.title || "";
            },
            label: (context: any) => {
              const value = context.parsed?.x ?? 0;
              return `${context.dataset.label}: ${value.toFixed(1)}%`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          stacked: true,
          ticks: {
            callback: (value: any) => `${value}%`,
            color: "#374151",
          },
          title: {
            display: true,
            text: "Percentage",
            color: "#374151",
          },
          grid: {
            color: "#e5e7eb",
          },
        },
        y: {
          stacked: true,
          ticks: {
            autoSkip: false,
            color: "#374151",
          },
          title: {
            display: true,
            text: "Sections",
            color: "#374151",
          },
          grid: {
            color: "#e5e7eb",
          },
        },
      },
    }),
    [visibleSectionStats],
  );

  const sectionSummaryRows = useMemo(
    () =>
      visibleSectionStats
        .map((stat) => {
          let weightage = stat.weightage;
          if (weightage > 0 && weightage <= 1) {
            weightage = weightage * 100;
          }

          const yesPercent = stat.total ? (stat.yes / stat.total) * 100 : 0;
          const noPercent = stat.total ? (stat.no / stat.total) * 100 : 0;
          const naPercent = stat.total ? (stat.na / stat.total) * 100 : 0;
          const yesWeighted = (yesPercent * weightage) / 100;
          const noWeighted = (noPercent * weightage) / 100;
          const naWeighted = (naPercent * weightage) / 100;

          return {
            id: stat.id,
            title: stat.title,
            weightage,
            yesPercent,
            yesWeighted,
            yesCount: stat.yes,
            noPercent,
            noWeighted,
            noCount: stat.no,
            naPercent,
            naWeighted,
            naCount: stat.na,
            total: stat.total,
          };
        })
        // Sort by Yes percentage in descending order
        .sort((a, b) => b.yesPercent - a.yesPercent),
    [visibleSectionStats],
  );

  const summaryTotals = useMemo(() => {
    return sectionSummaryRows.reduce(
      (acc, row) => ({
        total: acc.total + row.total,
        yesCount: acc.yesCount + (row.yesCount || 0),
        noCount: acc.noCount + (row.noCount || 0),
        naCount: acc.naCount + (row.naCount || 0),
        weightage: acc.weightage + row.weightage,
        yesWeighted: acc.yesWeighted + row.yesWeighted,
        noWeighted: acc.noWeighted + row.noWeighted,
        naWeighted: acc.naWeighted + row.naWeighted,
      }),
      {
        total: 0,
        yesCount: 0,
        noCount: 0,
        naCount: 0,
        weightage: 0,
        yesWeighted: 0,
        noWeighted: 0,
        naWeighted: 0,
      },
    );
  }, [sectionSummaryRows]);

  useEffect(() => {
    if (sectionSummaryRows.length > 0) {
      // Check if ALL sections have weightage = 0
      const allZero = sectionSummaryRows.every((row) => row.weightage === 0);

      // Check if ANY section has weightage > 0
      const hasWeightage = sectionSummaryRows.some((row) => row.weightage > 0);

      // Auto-detect whether to show weightage columns
      if (hasWeightage) {
        setShowWeightageColumns(true);
        setShowWeightageCheckbox(false); // Hide checkbox when weightage exists
        setAddWeightMode(false); // Exit add weight mode
      } else {
        setShowWeightageColumns(false);
        setShowWeightageCheckbox(true); // Show checkbox when no weightage
      }
    }
  }, [sectionSummaryRows]);

  // Weightage Edit Functions
  const handleEditWeightage = (sectionId: string, currentWeightage: number) => {
    setEditingWeightage(sectionId);
    setWeightageValue(currentWeightage.toString());
  };

  const handleSaveWeightage = async (sectionId: string) => {
    if (savingWeightage || !form || !weightageValue.trim()) {
      return;
    }

    const numericValue = parseFloat(weightageValue);
    if (isNaN(numericValue) || numericValue < 0 || numericValue > 100) {
      // Show error using your notification system or console
      console.error("Please enter a valid weightage between 0 and 100");
      return;
    }

    setSavingWeightage(true);
    try {
      // Get the form ID
      const formId = form._id || form.id;
      if (!formId) {
        throw new Error("Form ID not found");
      }

      // Create updated sections with new weightage
      const updatedSections =
        form.sections?.map((section: any) =>
          section.id === sectionId
            ? { ...section, weightage: numericValue }
            : section,
        ) || [];

      // Prepare the form data to update
      const formDataToUpdate = {
        ...form,
        sections: updatedSections,
      };

      // Remove MongoDB-specific fields if they exist
      delete formDataToUpdate._id;
      delete formDataToUpdate.__v;
      delete formDataToUpdate.createdAt;
      delete formDataToUpdate.updatedAt;

      console.log("Updating form with ID:", formId);
      console.log("Updated sections:", updatedSections);

      // Call the updateForm API
      const response = await apiClient.updateForm(formId, formDataToUpdate);

      // Update local state with the response
      if (response.form) {
        setForm(response.form);
      } else {
        // Fallback to local update if response doesn't have form
        setForm({
          ...form,
          sections: updatedSections,
        });
      }

      console.log(`Weightage updated to ${numericValue}%`);
      setEditingWeightage(null);
      setWeightageValue("");
    } catch (error) {
      console.error("Failed to update weightage:", error);
    } finally {
      setSavingWeightage(false);
    }
  };

  const handleCancelWeightageEdit = () => {
    setEditingWeightage(null);
    setWeightageValue("");
  };

  // Calculate total weightage
  const totalWeightage = useMemo(() => {
    return sectionSummaryRows.reduce((total, row) => total + row.weightage, 0);
  }, [sectionSummaryRows]);

  // Add this after sectionSummaryRows calculation
  const totalPieChartData = useMemo(() => {
    if (sectionSummaryRows.length === 0) {
      return {
        yes: 0,
        no: 0,
        na: 0,
        counts: { yes: 0, no: 0, na: 0, total: 0 }, // Ensure counts exists
      };
    }

    let totalYes = 0;
    let totalNo = 0;
    let totalNA = 0;
    let totalResponses = 0;

    sectionSummaryRows.forEach((row) => {
      totalYes += row.yesCount;
      totalNo += row.noCount;
      totalNA += row.naCount;
      totalResponses += row.total;
    });

    // Calculate percentages
    const total = totalYes + totalNo + totalNA;
    const yesPercent = total > 0 ? (totalYes / total) * 100 : 0;
    const noPercent = total > 0 ? (totalNo / total) * 100 : 0;
    const naPercent = total > 0 ? (totalNA / total) * 100 : 0;

    return {
      yes: Number(yesPercent.toFixed(1)),
      no: Number(noPercent.toFixed(1)),
      na: Number(naPercent.toFixed(1)),
      counts: {
        yes: totalYes,
        no: totalNo,
        na: totalNA,
        total: total,
      },
    };
  }, [sectionSummaryRows]);

  const weightedPercentageChartData = useMemo(() => {
    return {
      labels: sectionSummaryRows.map((row) => formatSectionLabel(row.title)),
      datasets: [
        {
          label: "Yes % × Weightage",
          data: sectionSummaryRows.map((row) =>
            parseFloat(row.yesWeighted.toFixed(1)),
          ),
          borderColor: "#1d4ed8",
          backgroundColor: "rgba(29, 78, 216, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#1d4ed8",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
        },
        {
          label: "No % × Weightage",
          data: sectionSummaryRows.map((row) =>
            parseFloat(row.noWeighted.toFixed(1)),
          ),
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#3b82f6",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
        },
        {
          label: "N/A % × Weightage",
          data: sectionSummaryRows.map((row) =>
            parseFloat(row.naWeighted.toFixed(1)),
          ),
          borderColor: "#93c5fd",
          backgroundColor: "rgba(147, 197, 253, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#93c5fd",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
        },
      ],
    };
  }, [sectionSummaryRows]);

  const weightedPercentageChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 16, right: 32, bottom: 16, left: 8 },
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#374151",
            generateLabels: (chart: any) => {
              const labels =
                ChartJS.defaults.plugins.legend.labels.generateLabels(chart);
              labels.forEach((label: any) => {
                label.color = document.documentElement.classList.contains(
                  "dark",
                )
                  ? "#d1d5db"
                  : "#374151";
              });
              return labels;
            },
          },
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const value = context.parsed?.y ?? 0;
              return `${context.dataset.label}: ${value.toFixed(1)}%`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value: any) => `${value}%`,
            color: "#374151",
          },
          title: {
            display: true,
            text: "Weighted Percentage",
            color: "#374151",
          },
          grid: {
            color: "#e5e7eb",
          },
        },
        x: {
          ticks: {
            autoSkip: false,
            color: "#374151",
          },
          title: {
            display: true,
            text: "Sections",
            color: "#374151",
          },
          grid: {
            color: "#e5e7eb",
          },
        },
      },
    }),
    [],
  );

  const sectionChartHeight = Math.max(320, visibleSectionStats.length * 56);
  const weightedChartHeight = Math.max(320, sectionSummaryRows.length * 32);

  const sectionsStats = useMemo(() => {
    if (!form?.sections) return [];

    return form?.sections.map((section) => ({
      section,
      stats: getSectionStats(section, responses),
    }));
  }, [form, responses]);

  const filteredSectionsStats = useMemo(() => {
    if (!form?.sections) return [];

    return form?.sections.map((section) => ({
      section,
      stats: getSectionStats(section, filteredResponses),
    }));
  }, [form, filteredResponses]);

  const OverallQualityPieChart = () => {
    const data = {
      datasets: [
        {
          data: [
            totalPieChartData.yes,
            totalPieChartData.no,
            totalPieChartData.na,
          ],
          backgroundColor: [
            "rgba(34, 197, 94)", // Green for Yes
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
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        datalabels: {
          color: "white",
        },
        legend: {
          position: "bottom",

          labels: {
            color: document.documentElement.classList.contains("dark")
              ? "#e5e7eb"
              : "#374151",
            font: {
              size: 10,
            },
            padding: 10,
          },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.label || "";
              const value = context.raw || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage =
                total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${label}: ${value}% (${totalPieChartData.counts[label.toLowerCase()]} responses)`;
            },
          },
        },
      },
      // DONUT CHART SPECIFIC OPTIONS
      cutout: "60%", // This creates the donut hole - adjust percentage for thicker/thinner donut
    };

    return (
      <div className="p-6 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 flex flex-col h-full rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg mr-1.5">
              <PieChart className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-primary-900 dark:text-white">
                Overall Response Quality
              </h2>
              <p className="text-xs text-primary-500 dark:text-primary-400">
                Yes/No/N/A Distribution
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col" id="overall-quality-chart">
          {totalPieChartData.counts.total === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <PieChart className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-primary-500 dark:text-primary-400 font-medium">
                  No quality data available
                </p>
                <p className="text-xs text-primary-400 dark:text-primary-500 mt-1">
                  Will appear when sections have Yes/No/N/A questions
                </p>
              </div>
            </div>
          ) : (
            <>
              <div style={{ height: "220px" }}>
                {/* Only change needed here - use Doughnut instead of Pie */}
                <Doughnut data={data} options={options} />
              </div>

              {/* Stats summary */}
              <div className="mt-4 grid grid-cols-3 gap-4">
                {/* Yes */}
                <div className="text-center">
                  <div className="text-sm font-bold text-green-600 dark:text-green-400">
                    {totalPieChartData.yes}%
                  </div>
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {complianceLabels.yes}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-500">
                    ({totalPieChartData.counts.yes})
                  </div>
                </div>

                {/* No */}
                <div className="text-center">
                  <div className="text-sm font-bold text-red-600 dark:text-red-400">
                    {totalPieChartData.no}%
                  </div>
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {complianceLabels.no}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-500">
                    ({totalPieChartData.counts.no})
                  </div>
                </div>

                {/* N/A */}
                <div className="text-center">
                  <div className="text-sm font-bold text-gray-600 dark:text-gray-400">
                    {totalPieChartData.na}%
                  </div>
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {complianceLabels.na}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-500">
                    ({totalPieChartData.counts.na})
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const getSectionAnalyticsData = (): SectionAnalyticsData[] => {
    if (!form?.sections || !form.sections.length) {
      return [];
    }

    return form.sections
      .map((section) => {
        const stats = getSectionStats(section, responses);
        const qualityBreakdown = getSectionQualityBreakdown(section, responses);
        const overallQuality = calculateOverallQuality(qualityBreakdown);

        // Debug log to see what we're getting
        console.log("Section Data for PDF:", {
          sectionId: section.id,
          sectionTitle: section.title,
          questionsCount: section.questions?.length || 0,
          questions: section.questions?.map((q) => ({
            id: q.id,
            text: q.text,
            type: q.type,
          })),
          statsQuestionsDetail: stats.questionsDetail?.length || 0,
        });

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
            questionsDetail: stats.questionsDetail || [], // Make sure this is not empty
          },
          qualityBreakdown,
          overallQuality,
        };
      })
      .filter((section) => section.stats.questionsDetail.length > 0); // Only include sections with questions
  };

  const handleDownloadPDF = async () => {
    try {
      // Show loading state
      const button = document.querySelector('button[title="Download as PDF"]');
      const originalText = button?.textContent || "Download PDF";
      if (button) {
        button.innerHTML =
          '<span class="animate-spin">⏳</span> Generating PDF...';
        button.disabled = true;
      }

      // Get section analytics data
      const sectionAnalyticsData = getSectionAnalyticsData();

      // Prepare analytics data for PDF
      const analyticsData = {
        total: analytics.total,
        pending: analytics.pending,
        verified: analytics.verified,
        rejected: analytics.rejected,
        sectionSummaryRows: sectionSummaryRows,
        totalPieChartData: totalPieChartData,
      };

      // Define chart IDs to capture
      const chartElementIds = [
        "response-trend-chart",
        "overall-quality-chart",
        "location-heatmap",
      ].filter((id) => document.getElementById(id));

      // Add main dashboard charts
      [
        "response-trend-chart",
        "overall-quality-chart",
        "section-performance-chart",
        "weighted-trends-chart",
        "location-heatmap",
      ].forEach((id) => {
        if (document.getElementById(id)) chartElementIds.push(id);
      });

      // Add section-specific charts
      sectionAnalyticsData.forEach((section) => {
        const pieChartId = `section-pie-chart-${section.sectionId}`;
        const visChartId = `section-visualization-${section.sectionId}`;

        if (document.getElementById(pieChartId))
          chartElementIds.push(pieChartId);
        if (document.getElementById(visChartId))
          chartElementIds.push(visChartId);
      });

      // Generate PDF with section data
      await exportFormAnalyticsToPDF({
        filename: `${form?.title?.replace(/\s+/g, "_") || "Form"}_Analytics_${new Date().toISOString().split("T")[0]}.pdf`,
        formTitle: form?.title || "Form Analytics",
        generatedDate: new Date().toLocaleString(),
        totalResponses: analytics.total,
        sectionSummaryRows: sectionSummaryRows,
        totalPieChartData: totalPieChartData,
        chartElementIds: chartElementIds,
        includeSectionAnalytics: true,
        sectionAnalyticsData: getSectionAnalyticsData(),
      });

      // Restore button state
      if (button) {
        button.innerHTML = originalText;
        button.disabled = false;
      }

      console.log("PDF generated successfully");
    } catch (error) {
      console.error("Error downloading PDF:", error);
      alert("Failed to generate PDF. Please try again.");

      // Restore button state on error
      const button = document.querySelector('button[title="Download as PDF"]');
      if (button) {
        button.innerHTML = "Download PDF";
        button.disabled = false;
      }
    }
  };

  const inspectionStats = useMemo(() => {
    let accepted = 0;
    let rejected = 0;
    let reworked = 0;

    filteredResponses.forEach((response) => {
      // Find the inspection status from answers
      if (!response.answers) return;

      Object.values(response.answers).forEach((val) => {
        if (val && typeof val === "object" && val.status) {
          const status = String(val.status).toLowerCase();
          if (status === "accepted") accepted++;
          else if (status === "rejected") rejected++;
          else if (status === "rework" || status === "reworked") reworked++;
        }
      });
    });

    return { accepted, rejected, reworked };
  }, [filteredResponses]);

  const handleExportToExcel = () => {
    try {
      const headerRow: any[] = ["Timestamp"];
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

      responses.forEach((response: Response) => {
        const rowData: any[] = [
          getResponseTimestamp(response)
            ? new Date(getResponseTimestamp(response)!).toLocaleString()
            : "-",
        ];

        columnInfo.forEach(({ questionId }) => {
          const answer = response.answers?.[questionId];
          // For complex objects like chassis, stringify appropriately using JSON.stringify for now
          // or just standard string if it's simpler
          let answerStr = "-";
          if (answer !== undefined && answer !== null) {
            if (typeof answer === "object") {
              // Special handling for objects to make them readable in Excel
              if (answer.status) {
                answerStr = answer.status; // just show the status for inspection fields
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

      // Style Common Answer Row
      for (let i = 0; i < headerRow.length; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: 1, c: i });
        ws[cellRef].s = {
          fill: { fgColor: { rgb: "FFF3F4F6" } }, // Light gray background
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

      // Style response rows
      const lastResponseRowIdx = responses.length + 1;
      for (let rowIdx = 1; rowIdx < lastResponseRowIdx; rowIdx++) {
        const response = responses[rowIdx - 1];

        // Style Timestamp column
        const timeCellRef = XLSX.utils.encode_cell({ r: rowIdx, c: 0 });
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

        // Style Question columns
        for (let colIdx = 0; colIdx < columnInfo.length; colIdx++) {
          const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx + 1 });
          const info = columnInfo[colIdx];
          const answer = response.answers?.[info.questionId];

          let bgColor = info.isFollowUp ? "FFE9D5FF" : "FFFFFFFF";

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

      // Style Stats Header Row
      for (let i = 0; i < 4; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: statsHeaderIdx, c: i });
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

      // Style Stats Data Row
      for (let i = 0; i < 4; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: statsDataIdx, c: i });
        ws[cellRef].s = {
          fill: { fgColor: { rgb: "FFE0E7FF" } }, // Indigo 100
          font: { bold: true, color: { rgb: "FF3730A3" } }, // Indigo 800
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "medium" },
            right: { style: "thin" },
          },
        };
      }

      ws["!cols"] = [{ wch: 22 }, ...columnInfo.map(() => ({ wch: 35 }))];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Responses");
      XLSX.writeFile(
        wb,
        `${form?.title || "responses"}-${new Date().toISOString().split("T")[0]}.xlsx`,
      );
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      alert("Failed to export to Excel. Please try again.");
    }
  };

  const handleViewDetails = (response: Response) => {
    const responseId = response._id || response.id;
    console.log("Navigating to response:", responseId);
    navigate(`/responses/${responseId}`);
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
  };

  const handleSaveEdit = async () => {
    if (!editingResponseId) return;

    try {
      setIsSaving(true);
      await apiClient.updateResponse(editingResponseId, {
        answers: editFormData,
      });

      setResponses(
        responses.map((r) =>
          r.id === editingResponseId ? { ...r, answers: editFormData } : r,
        ),
      );

      setEditingResponseId(null);
      setEditFormData({});
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
  };

  const showToast = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    const id = Date.now().toString();
    setToast({ message, type, id });
    setTimeout(() => {
      setToast(null);
    }, 3000);
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

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-primary-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-600">Error loading analytics: {error}</p>
          {!isGuest && (
            <button onClick={() => navigate(-1)} className="mt-4 btn-primary">
              Go Back
            </button>
          )}
          {isGuest && (
            <button onClick={handleLogout} className="mt-4 btn-primary bg-red-600 hover:bg-red-700">
              Log out
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-3" id="analytics-scroll-container">
      {/* Header with Tabs - Single Row */}
      {form && (
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {form?.title || "Form"}
            </h1>
          </div>

          {/* Tabs - Center */}
          <div className="flex items-center gap-1 flex-1 justify-center overflow-x-auto px-4">
            {!isInspector && (
              <>
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
                <button
                  onClick={() => setAnalyticsView("question")}
                  className={`px-3 py-2.5 font-semibold transition-all duration-200 flex items-center gap-2 border-b-2 whitespace-nowrap text-sm ${analyticsView === "question"
                    ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                    : "text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-200"
                    }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Questions
                </button>
                <button
                  onClick={() => setAnalyticsView("section")}
                  className={`px-3 py-2.5 font-semibold transition-all duration-200 flex items-center gap-2 border-b-2 whitespace-nowrap text-sm ${analyticsView === "section"
                    ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                    : "text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-200"
                    }`}
                >
                  <FileText className="w-4 h-4" />
                  Sections
                </button>
                <button
                  onClick={() => setAnalyticsView("table")}
                  className={`px-3 py-2.5 font-semibold transition-all duration-200 flex items-center gap-2 border-b-2 whitespace-nowrap text-sm ${analyticsView === "table"
                    ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                    : "text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-200"
                    }`}
                >
                  <Table className="w-4 h-4" />
                  Table
                </button>
              </>
            )}
            <button
              onClick={() => setAnalyticsView("responses")}
              className={`px-3 py-2.5 font-semibold transition-all duration-200 flex items-center gap-2 border-b-2 whitespace-nowrap text-sm ${analyticsView === "responses"
                ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                : "text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-200"
                }`}
            >
              <Users className="w-4 h-4" />
              Responses
            </button>
            {!isInspector && !isGuest && (
              <button
                onClick={() => setAnalyticsView("comparison")}
                className={`px-3 py-2.5 font-semibold transition-all duration-200 flex items-center gap-2 border-b-2 whitespace-nowrap text-sm ${analyticsView === "comparison"
                  ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                  : "text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-200"
                  }`}
              >
                <Users className="w-4 h-4" />
                Comparison
              </button>
            )}
          </div>

          {/* Right Side - Count and Actions */}
          <div className="flex items-center gap-3 whitespace-nowrap">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <div className="text-right">
                <div className="text-base font-bold text-gray-900 dark:text-white">
                  {analytics.total}
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowFilterModal(true)}
              className={`p-1.5 rounded transition-colors relative ${appliedFilters.length > 0
                ? "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 bg-indigo-50 dark:bg-indigo-900/20"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              title="Advanced Filters"
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
              {appliedFilters.length > 0 && (
                <span className="absolute top-0 right-0 flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-red-500 rounded-full -translate-y-1 translate-x-1">
                  {appliedFilters.length}
                </span>
              )}
            </button>
            {!isGuest && (
              <button
                onClick={handleShareAnalytics}
                className="flex items-center gap-2 px-2 py-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                title="Share Analytics"
              >
                <Share2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-2 py-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Download as PDF"
            >
              <Download className="w-4 h-4" />
            </button>
            {!isGuest && (
              <button
                onClick={() => navigate(-1)}
                className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
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

      {/* Dashboard View */}
      {analyticsView === "dashboard" && (
        <>
          <div
            className="flex items-center justify-center min-h-screen px-4 py-24"
            id="summary-cards"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full">
              {/* Response Trend Chart - COMPACT */}
              <div className="p-6 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow">
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
                        Last 7 days
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
                  <div className="flex-1 flex flex-col">
                    <div style={{ height: "293px" }} id="response-trend-chart">
                      <Line
                        data={{
                          labels: analytics.last7Days.map((date) =>
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
                                label: function (context) {
                                  return `${context.parsed.y}%`;
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
                              },
                            },
                          },
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Location Heatmap - Self-contained component */}
              <LocationHeatmap
                responses={filteredResponses}
                title="Response Locations Heatmap"
                id="location-heatmap"
              />

              {/* Pie Chart - COMPACT */}
              <OverallQualityPieChart />
            </div>
          </div>
        </>
      )}

      {form && (
        <>
          {/* Question-wise Analytics */}
          {analyticsView === "question" && (
            <div className="space-y-6">
              <div className="card p-6">
                <ResponseQuestion
                  question={form}
                  responses={filteredResponses}
                />
              </div>
            </div>
          )}
          {/* Section-wise Analytics */}
          {analyticsView === "section" && (
            <div className="space-y-6">
              {filteredSectionStats.length > 0 ? (
                <>
                  <div className="card p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-indigo-600" />
                        Section Summary with Visualization
                      </h3>
                      <div className="flex items-center gap-2">
                        {/* Section Selection Dropdown */}
                        <div className="relative">
                          <button
                            onClick={() =>
                              setShowSectionSelector(!showSectionSelector)
                            }
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-700 transition-colors"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 13l-7 7-7-7m0-6l7-7 7 7"
                              />
                            </svg>
                            Sections ({selectedSectionIds.length}/
                            {filteredSectionStats.length})
                          </button>

                          {showSectionSelector && (
                            <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10 min-w-max max-h-64 overflow-y-auto">
                              {/* Select All Option */}
                              <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700">
                                <input
                                  type="checkbox"
                                  checked={
                                    selectedSectionIds.length ===
                                    filteredSectionStats.length &&
                                    filteredSectionStats.length > 0
                                  }
                                  onChange={handleSelectAllSections}
                                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                                />
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                  Select All
                                </span>
                              </label>

                              {/* Section Checkboxes */}
                              {filteredSectionStats.map((stat) => {
                                const selected = selectedSectionIds.includes(
                                  stat.id,
                                );
                                return (
                                  <label
                                    key={stat.id}
                                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-0 text-sm"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() =>
                                        toggleSectionSelection(stat.id)
                                      }
                                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                                    />
                                    <span className="text-gray-900 dark:text-gray-300 truncate">
                                      {stat.title}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Color Legend with Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-500 rounded"></div>
                          <span className="text-gray-600 dark:text-gray-400">
                            {complianceLabels.yes}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-red-500 rounded"></div>
                          <span className="text-gray-600 dark:text-gray-400">
                            {complianceLabels.no}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded"></div>
                          <span className="text-gray-600 dark:text-gray-400">
                            {complianceLabels.na}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Add Weight Toggle */}
                        {showWeightageCheckbox && (
                          <label className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                            <input
                              type="checkbox"
                              checked={addWeightMode}
                              onChange={(e) => {
                                setAddWeightMode(e.target.checked);
                                if (e.target.checked) {
                                  setShowWeightageColumns(true);
                                }
                              }}
                              className="w-3 h-3 text-indigo-600 border-gray-300 rounded cursor-pointer"
                            />
                            <span className="text-gray-700 dark:text-gray-300">
                              Add Weight
                            </span>
                          </label>
                        )}

                        {/* Show Weightage Toggle */}
                        {totalWeightage > 0 && (
                          <button
                            onClick={() =>
                              setShowWeightageColumns(!showWeightageColumns)
                            }
                            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${showWeightageColumns
                              ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-700"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700"
                              }`}
                          >
                            {showWeightageColumns ? "Hide" : "Show"} Weight
                          </button>
                        )}

                        {/* Edit Weightage Button */}
                        {showWeightageColumns && !redistributionMode && (
                          <button
                            onClick={() => {
                              setRedistributionMode(true);
                              const initialValues: Record<string, string> = {};
                              sectionSummaryRows.forEach((row) => {
                                initialValues[row.id] =
                                  row.weightage.toString();
                              });
                              setTempWeightageValues(initialValues);
                              setWeightageBalance(0);
                            }}
                            className="px-2 py-1 text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                          >
                            Edit Weight
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Combined Table with Visualization and Radar Chart */}
                    <div className="flex gap-4">
                      {/* Table Container - Always shrinks for radar chart */}
                      <div className="flex-1">
                        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                          <table className="min-w-full text-sm">
                            <thead className="uppercase tracking-wider text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 sticky top-0">
                              <tr>
                                <th className="text-left px-4 py-3">Section</th>
                                <th className="text-center px-3 py-3">Total</th>
                                <th className="text-center px-3 py-3">
                                  {complianceLabels.yes}
                                </th>
                                <th className="text-center px-3 py-3">
                                  {complianceLabels.no}
                                </th>
                                <th className="text-center px-3 py-3">
                                  {complianceLabels.na}
                                </th>

                                {/* Conditionally show weightage columns */}
                                {showWeightageColumns && (
                                  <>
                                    <th className="text-center px-3 py-3">W</th>
                                    <th className="text-center px-3 py-3">
                                      Y×W
                                    </th>
                                    <th className="text-center px-3 py-3">
                                      N×W
                                    </th>
                                    <th className="text-center px-3 py-3">
                                      NA×W
                                    </th>
                                  </>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {sectionSummaryRows.map((row, index) => {
                                const rowBgColor =
                                  index % 2 === 0
                                    ? "bg-white dark:bg-gray-900"
                                    : "bg-gray-50 dark:bg-gray-800/50";

                                const generateTableBarChart = (
                                  yesPercent: number,
                                  noPercent: number,
                                  naPercent: number,
                                ) => {
                                  const totalWidth = 160;
                                  const yesWidth =
                                    (yesPercent / 100) * totalWidth;
                                  const noWidth =
                                    (noPercent / 100) * totalWidth;
                                  const naWidth =
                                    (naPercent / 100) * totalWidth;

                                  return (
                                    <div
                                      className="relative"
                                      style={{
                                        width: `${totalWidth}px`,
                                        height: "20px",
                                      }}
                                    >
                                      {/* Background bar */}
                                      <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700 rounded-sm border border-gray-300 dark:border-gray-600"></div>

                                      {/* Yes segment */}
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
                                                  textShadow:
                                                    "0 0 2px rgba(0,0,0,0.5)",
                                                }}
                                              >
                                                {yesPercent.toFixed(0)}%
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* No segment */}
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
                                                  textShadow:
                                                    "0 0 2px rgba(0,0,0,0.5)",
                                                }}
                                              >
                                                {noPercent.toFixed(0)}%
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* N/A segment */}
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
                                                  textShadow:
                                                    "0 0 2px rgba(0,0,0,0.5)",
                                                }}
                                              >
                                                {naPercent.toFixed(0)}%
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* Fallback labels for small segments */}
                                      {yesPercent > 0 && yesPercent < 10 && (
                                        <div
                                          className="absolute"
                                          style={{ left: "2px", top: "1px" }}
                                        >
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

                                return (
                                  <tr
                                    key={row.id}
                                    onClick={() => {
                                      if (!redistributionMode) {
                                        setAutoOpenSectionId(null);
                                        setTimeout(
                                          () => setAutoOpenSectionId(row.id),
                                          10,
                                        );
                                      }
                                    }}
                                    className={`border-t border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer ${rowBgColor}`}
                                  >
                                    {/* Section Column */}
                                    <td className="px-4 py-2.5 cursor-pointer">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (!redistributionMode) {
                                            setAutoOpenSectionId(null);
                                            setTimeout(
                                              () =>
                                                setAutoOpenSectionId(row.id),
                                              10,
                                            );
                                          }
                                        }}
                                        className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm truncate max-w-[150px] transition-colors text-left"
                                      >
                                        {row.title}
                                      </button>
                                    </td>

                                    {/* Total Column */}
                                    <td className="text-center px-3 py-2.5">
                                      <div className="font-semibold text-blue-600 dark:text-blue-400 text-sm">
                                        {row.total}
                                      </div>
                                    </td>

                                    {/* Yes Column */}
                                    <td className="text-center px-3 py-2.5">
                                      <div className="font-semibold text-green-600 dark:text-green-400 text-sm">
                                        {row.yesCount}{" "}
                                        <span className="text-gray-600 dark:text-gray-400">
                                          (
                                          {Number.isFinite(row.yesPercent)
                                            ? row.yesPercent.toFixed(0)
                                            : "0"}
                                          %)
                                        </span>
                                      </div>
                                    </td>

                                    {/* No Column */}
                                    <td className="text-center px-3 py-2.5">
                                      <div className="font-semibold text-red-600 dark:text-red-400 text-sm">
                                        {row.noCount}{" "}
                                        <span className="text-gray-600 dark:text-gray-400">
                                          (
                                          {Number.isFinite(row.noPercent)
                                            ? row.noPercent.toFixed(0)
                                            : "0"}
                                          %)
                                        </span>
                                      </div>
                                    </td>

                                    {/* N/A Column */}
                                    <td className="text-center px-3 py-2.5">
                                      <div className="font-semibold text-slate-600 dark:text-slate-400 text-sm">
                                        {row.naCount}{" "}
                                        <span className="text-gray-600 dark:text-gray-400">
                                          (
                                          {Number.isFinite(row.naPercent)
                                            ? row.naPercent.toFixed(0)
                                            : "0"}
                                          %)
                                        </span>
                                      </div>
                                    </td>

                                    {/* Conditionally render weightage columns */}
                                    {showWeightageColumns && (
                                      <>
                                        {/* Weightage Column */}
                                        <td className="text-center px-3 py-2.5">
                                          {redistributionMode ? (
                                            <input
                                              type="number"
                                              min="0"
                                              max="100"
                                              step="0.1"
                                              value={
                                                tempWeightageValues[row.id] ||
                                                row.weightage.toString()
                                              }
                                              onChange={(e) => {
                                                const newValue = e.target.value;
                                                const oldValue =
                                                  parseFloat(
                                                    tempWeightageValues[
                                                    row.id
                                                    ] ||
                                                    row.weightage.toString(),
                                                  ) || 0;
                                                const newNumericValue =
                                                  parseFloat(newValue) || 0;
                                                const updatedTempValues = {
                                                  ...tempWeightageValues,
                                                  [row.id]: newValue,
                                                };
                                                setTempWeightageValues(
                                                  updatedTempValues,
                                                );
                                                const total = Object.values(
                                                  updatedTempValues,
                                                ).reduce((sum, val) => {
                                                  return (
                                                    sum + (parseFloat(val) || 0)
                                                  );
                                                }, 0);
                                                setWeightageBalance(
                                                  100 - total,
                                                );
                                              }}
                                              className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded text-center dark:bg-gray-700 dark:text-gray-100"
                                            />
                                          ) : (
                                            <span className="font-semibold text-indigo-600 dark:text-indigo-400 text-sm">
                                              {Number.isFinite(row.weightage)
                                                ? row.weightage.toFixed(1)
                                                : "0.0"}
                                              %
                                            </span>
                                          )}
                                        </td>

                                        {/* Yes × Weightage */}
                                        <td className="text-center px-3 py-2.5">
                                          <span className="font-semibold text-green-700 dark:text-green-300 text-sm">
                                            {Number.isFinite(row.yesWeighted)
                                              ? row.yesWeighted.toFixed(1)
                                              : "0.0"}
                                          </span>
                                        </td>

                                        {/* No × Weightage */}
                                        <td className="text-center px-3 py-2.5">
                                          <span className="font-semibold text-red-700 dark:text-red-300 text-sm">
                                            {Number.isFinite(row.noWeighted)
                                              ? row.noWeighted.toFixed(1)
                                              : "0.0"}
                                          </span>
                                        </td>

                                        {/* N/A × Weightage */}
                                        <td className="text-center px-3 py-2.5">
                                          <span className="font-semibold text-slate-700 dark:text-slate-400 text-sm">
                                            {Number.isFinite(row.naWeighted)
                                              ? row.naWeighted.toFixed(1)
                                              : "0.0"}
                                          </span>
                                        </td>
                                      </>
                                    )}
                                    {/* Batch Edit Controls - Only show when in addWeightMode */}
                                    {addWeightMode &&
                                      editingAllWeightages &&
                                      showWeightageColumns && (
                                        <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                                          <div className="flex items-center justify-between">
                                            <div>
                                              <h4 className="font-medium text-gray-900 dark:text-white">
                                                Batch Weightage Edit
                                              </h4>
                                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                                Total:{" "}
                                                {totalWeightage.toFixed(1)}% /
                                                100%
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <button
                                                onClick={() => {
                                                  // Distribute remaining weightage evenly
                                                  const remaining =
                                                    100 - totalWeightage;
                                                  const perSection =
                                                    remaining /
                                                    sectionSummaryRows.length;

                                                  // Update all sections
                                                  sectionSummaryRows.forEach(
                                                    (row) => {
                                                      const newWeightage = (
                                                        row.weightage +
                                                        perSection
                                                      ).toFixed(1);
                                                      // You would update your weightageValues state here
                                                    },
                                                  );
                                                }}
                                                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                              >
                                                Distribute Evenly
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setAddWeightMode(false);
                                                  setEditingAllWeightages(
                                                    false,
                                                  );
                                                  if (totalWeightage === 0) {
                                                    setShowWeightageColumns(
                                                      false,
                                                    );
                                                  }
                                                }}
                                                className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                  </tr>
                                );
                              })}

                              {/* Comprehensive Total Row */}
                              <tr className="bg-gray-100 dark:bg-gray-800 font-bold border-t-2 border-gray-300 dark:border-gray-600">
                                <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100 flex items-center">
                                  <div className="w-3 h-3 bg-indigo-600 rounded-full mr-3"></div>
                                  <span>TOTAL</span>
                                </td>
                                <td className="text-center px-3 py-2.5 text-gray-900 dark:text-gray-100 font-bold">
                                  {summaryTotals.total}
                                </td>
                                <td className="text-center px-3 py-2.5 text-green-600 dark:text-green-400 font-bold">
                                  {summaryTotals.yesCount} (
                                  {summaryTotals.total > 0
                                    ? (
                                      (summaryTotals.yesCount /
                                        summaryTotals.total) *
                                      100
                                    ).toFixed(0)
                                    : 0}
                                  %)
                                </td>
                                <td className="text-center px-3 py-2.5 text-red-600 dark:text-red-400 font-bold">
                                  {summaryTotals.noCount} (
                                  {summaryTotals.total > 0
                                    ? (
                                      (summaryTotals.noCount /
                                        summaryTotals.total) *
                                      100
                                    ).toFixed(0)
                                    : 0}
                                  %)
                                </td>
                                <td className="text-center px-3 py-2.5 text-slate-600 dark:text-slate-400 font-bold">
                                  {summaryTotals.naCount} (
                                  {summaryTotals.total > 0
                                    ? (
                                      (summaryTotals.naCount /
                                        summaryTotals.total) *
                                      100
                                    ).toFixed(0)
                                    : 0}
                                  %)
                                </td>
                                {showWeightageColumns && (
                                  <>
                                    <td className="text-center px-3 py-2.5">
                                      <span
                                        className={`inline-flex items-center justify-center px-3 py-1 rounded-full font-bold ${redistributionMode
                                          ? Math.abs(weightageBalance) < 0.1
                                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                          : Math.abs(
                                            summaryTotals.weightage - 100,
                                          ) < 0.1
                                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                          }`}
                                      >
                                        {redistributionMode
                                          ? `${weightageBalance.toFixed(1)}%`
                                          : `${summaryTotals.weightage.toFixed(1)}%`}
                                      </span>
                                    </td>
                                    <td className="text-center px-3 py-2.5 text-green-700 dark:text-green-300 font-bold">
                                      {summaryTotals.yesWeighted.toFixed(1)}
                                    </td>
                                    <td className="text-center px-3 py-2.5 text-red-700 dark:text-red-300 font-bold">
                                      {summaryTotals.noWeighted.toFixed(1)}
                                    </td>
                                    <td className="text-center px-3 py-2.5 text-slate-700 dark:text-slate-400 font-bold">
                                      {summaryTotals.naWeighted.toFixed(1)}
                                    </td>
                                  </>
                                )}
                              </tr>

                              {/* Status Message and Action Buttons Row - Only show in redistribution mode */}
                              {redistributionMode && (
                                <tr className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                                  <td
                                    colSpan={showWeightageColumns ? 9 : 5}
                                    className="px-6 py-4"
                                  >
                                    <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                                      {/* Status Message */}
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`text-sm font-medium ${Math.abs(weightageBalance) < 0.1 ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"}`}
                                        >
                                          {Math.abs(weightageBalance) < 0.1
                                            ? "✓ Ready to save"
                                            : `Adjust by ${Math.abs(weightageBalance).toFixed(1)}% to reach 100%`}
                                        </span>
                                      </div>

                                      {/* Action Buttons */}
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => {
                                            const originalValues: Record<
                                              string,
                                              string
                                            > = {};
                                            sectionSummaryRows.forEach(
                                              (row) => {
                                                originalValues[row.id] =
                                                  row.weightage.toString();
                                              },
                                            );
                                            setTempWeightageValues(
                                              originalValues,
                                            );
                                            setWeightageBalance(0);
                                          }}
                                          className="px-3 py-1.5 text-xs bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-1"
                                          title="Reset to original values"
                                        >
                                          <svg
                                            className="w-3.5 h-3.5"
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
                                          Reset
                                        </button>

                                        <button
                                          onClick={() => {
                                            setRedistributionMode(false);
                                            setTempWeightageValues({});
                                            setWeightageBalance(0);
                                          }}
                                          className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                          title="Cancel redistribution"
                                        >
                                          Cancel
                                        </button>

                                        <button
                                          onClick={async () => {
                                            if (
                                              Math.abs(weightageBalance) >= 0.1
                                            ) {
                                              console.error(
                                                `Cannot save: Balance must be 0%. Current: ${weightageBalance.toFixed(1)}%`,
                                              );
                                              return;
                                            }

                                            setSavingWeightage(true);
                                            try {
                                              const formId =
                                                form?._id || form?.id;
                                              if (!formId)
                                                throw new Error(
                                                  "Form ID not found",
                                                );

                                              const updatedSections =
                                                form?.sections?.map(
                                                  (section: any) => {
                                                    const row =
                                                      sectionSummaryRows.find(
                                                        (r) =>
                                                          r.id === section.id,
                                                      );
                                                    if (
                                                      row &&
                                                      tempWeightageValues[
                                                      row.id
                                                      ] !== undefined
                                                    ) {
                                                      return {
                                                        ...section,
                                                        weightage:
                                                          parseFloat(
                                                            tempWeightageValues[
                                                            row.id
                                                            ],
                                                          ) || 0,
                                                      };
                                                    }
                                                    return section;
                                                  },
                                                ) || [];

                                              const formDataToUpdate = {
                                                ...form,
                                                sections: updatedSections,
                                              };
                                              delete formDataToUpdate._id;
                                              delete formDataToUpdate.__v;
                                              delete formDataToUpdate.createdAt;
                                              delete formDataToUpdate.updatedAt;

                                              await apiClient.updateForm(
                                                formId,
                                                formDataToUpdate,
                                              );

                                              setForm({
                                                ...form,
                                                sections: updatedSections,
                                              });
                                              setRedistributionMode(false);
                                              setTempWeightageValues({});
                                              setWeightageBalance(0);
                                            } catch (error) {
                                              console.error(
                                                "Failed to save weightages:",
                                                error,
                                              );
                                            } finally {
                                              setSavingWeightage(false);
                                            }
                                          }}
                                          disabled={
                                            Math.abs(weightageBalance) >= 0.1 ||
                                            savingWeightage
                                          }
                                          className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                          title="Save all weightage changes"
                                        >
                                          {savingWeightage ? (
                                            <>
                                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                              Saving...
                                            </>
                                          ) : (
                                            <>
                                              <svg
                                                className="w-3.5 h-3.5"
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
                                              Save
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Radar Chart - Always displayed on right side */}
                      <div className="w-96 flex-shrink-0">
                        <div className="card p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg h-full">
                          <div className="flex items-center justify-between mb-6">
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                              Section Performance Radar
                            </h4>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                Yes
                              </span>
                              <div className="w-2 h-2 bg-red-500 rounded-full ml-2"></div>
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                No
                              </span>
                              <div className="w-2 h-2 bg-gray-400 rounded-full ml-2"></div>
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                N/A
                              </span>
                            </div>
                          </div>

                          {/* Radar Chart Container */}
                          <div className="h-96">
                            {/* Prepare data for radar chart */}
                            {(() => {
                              // Prepare radar chart data
                              const radarChartData = {
                                labels: visibleSectionStats.map((stat) =>
                                  stat.title.length > 15
                                    ? stat.title.substring(0, 15) + "..."
                                    : stat.title,
                                ),

                                datasets: [
                                  {
                                    label: "Yes %",
                                    data: visibleSectionStats.map((stat) =>
                                      stat.total > 0
                                        ? (stat.yes / stat.total) * 100
                                        : 0,
                                    ),
                                    backgroundColor: "rgba(34, 197, 94, 0.2)",
                                    borderColor: "rgba(34, 197, 94, 1)",
                                    borderWidth: 2,
                                    pointBackgroundColor:
                                      "rgba(34, 197, 94, 1)",
                                    pointBorderColor: "#fff",
                                    pointHoverBackgroundColor: "#fff",
                                    pointHoverBorderColor:
                                      "rgba(34, 197, 94, 1)",
                                  },
                                  {
                                    label: "No %",
                                    data: visibleSectionStats.map((stat) =>
                                      stat.total > 0
                                        ? (stat.no / stat.total) * 100
                                        : 0,
                                    ),
                                    backgroundColor: "rgba(239, 68, 68, 0.2)",
                                    borderColor: "rgba(239, 68, 68, 1)",
                                    borderWidth: 2,
                                    pointBackgroundColor:
                                      "rgba(239, 68, 68, 1)",
                                    pointBorderColor: "#fff",
                                    pointHoverBackgroundColor: "#fff",
                                    pointHoverBorderColor:
                                      "rgba(239, 68, 68, 1)",
                                  },
                                  {
                                    label: "N/A %",
                                    data: visibleSectionStats.map((stat) =>
                                      stat.total > 0
                                        ? (stat.na / stat.total) * 100
                                        : 0,
                                    ),
                                    backgroundColor: "rgba(156, 163, 175, 0.2)",
                                    borderColor: "rgba(156, 163, 175, 1)",
                                    borderWidth: 2,
                                    pointBackgroundColor:
                                      "rgba(156, 163, 175, 1)",
                                    pointBorderColor: "#fff",
                                    pointHoverBackgroundColor: "#fff",
                                    pointHoverBorderColor:
                                      "rgba(156, 163, 175, 1)",
                                  },
                                ],
                              };

                              const radarOptions = {
                                responsive: true,
                                maintainAspectRatio: false,
                                scales: {
                                  r: {
                                    angleLines: {
                                      display: true,
                                      color:
                                        document.documentElement.classList.contains(
                                          "dark",
                                        )
                                          ? "rgba(147, 197, 253, 0.4)"
                                          : "rgba(59, 130, 246, 0.4)",
                                      lineWidth: 1.5,
                                    },
                                    grid: {
                                      color:
                                        document.documentElement.classList.contains(
                                          "dark",
                                        )
                                          ? "rgba(147, 197, 253, 0.3)"
                                          : "rgba(59, 130, 246, 0.3)",
                                      lineWidth: 1.5,
                                    },
                                    pointLabels: {
                                      font: {
                                        size: 10,
                                      },
                                      color:
                                        document.documentElement.classList.contains(
                                          "dark",
                                        )
                                          ? "#e5e7eb"
                                          : "#374151",
                                    },
                                    ticks: {
                                      backdropColor: "transparent",
                                      color:
                                        document.documentElement.classList.contains(
                                          "dark",
                                        )
                                          ? "#9ca3af"
                                          : "#6b7280",
                                      font: {
                                        size: 11,
                                      },
                                    },
                                    suggestedMin: 0,
                                    suggestedMax: 100,
                                  },
                                },
                                plugins: {
                                  datalabels: {
                                    display: false,
                                  },
                                  legend: {
                                    position: "bottom",
                                    labels: {
                                      color:
                                        document.documentElement.classList.contains(
                                          "dark",
                                        )
                                          ? "#e5e7eb"
                                          : "#374151",
                                      font: {
                                        size: 10,
                                      },
                                      padding: 15,
                                    },
                                  },
                                  tooltip: {
                                    callbacks: {
                                      label: function (context) {
                                        return `${context.dataset.label}: ${context.raw.toFixed(1)}%`;
                                      },
                                    },
                                  },
                                },
                              };

                              return (
                                <Radar
                                  data={radarChartData}
                                  options={radarOptions}
                                />
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="card p-6 text-center text-primary-500">
                  No section performance data available yet
                </div>
              )}

              <div className="card p-6">
                <SectionAnalytics
                  question={form}
                  responses={filteredResponses}
                  sectionsStats={filteredSectionsStats}
                  openSectionId={autoOpenSectionId}
                  complianceLabels={complianceLabels}
                />
              </div>
            </div>
          )}

          {/* Table View */}
          {analyticsView === "table" && (
            <div className="space-y-6">
              {/* Table View Type Selector */}
              <div className="card p-4 flex gap-3 items-center">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  View Type:
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTableViewType("question")}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${tableViewType === "question"
                      ? "bg-indigo-600 text-white shadow-md"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-300 hover:bg-gray-300"
                      }`}
                  >
                    Question Based
                  </button>
                  <button
                    onClick={() => setTableViewType("section")}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${tableViewType === "section"
                      ? "bg-indigo-600 text-white shadow-md"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-300 hover:bg-gray-300"
                      }`}
                  >
                    Section Based
                  </button>
                </div>
              </div>

              {/* Question Based Table - All Questions from All Sections */}
              {tableViewType === "question" &&
                form?.sections &&
                form.sections.length > 0 && (
                  <div className="card p-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-indigo-600" />
                        All Questions Analytics - Table View
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Showing all questions from all sections including
                        follow-ups
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-gray-700 dark:to-gray-600 border-b-2 border-indigo-200 dark:border-indigo-700">
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white border-r border-indigo-200 dark:border-indigo-700">
                              Question
                            </th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white border-r border-indigo-200 dark:border-indigo-700">
                              Total Responses
                            </th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white border-r border-indigo-200 dark:border-indigo-700">
                              {complianceLabels.yes}
                            </th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white border-r border-indigo-200 dark:border-indigo-700">
                              {complianceLabels.no}
                            </th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white border-r border-indigo-200 dark:border-indigo-700">
                              {complianceLabels.na}
                            </th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white">
                              Yes %
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {form?.sections?.map(
                            (section: Section, sectionIdx: number) => {
                              const allQuestionsInSection =
                                section.questions || [];

                              return (
                                <React.Fragment key={`section-${section.id}`}>
                                  <tr className="bg-indigo-100 dark:bg-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40">
                                    <td
                                      colSpan={6}
                                      className="px-6 py-4 text-center text-sm font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wide"
                                    >
                                      {section.title}
                                    </td>
                                  </tr>
                                  {allQuestionsInSection.map(
                                    (question: any, qIdx: number) => {
                                      const questionResponses =
                                        filteredResponses.filter(
                                          (r) =>
                                            r.answers && r.answers[question.id],
                                        );
                                      const yesCount = questionResponses.filter(
                                        (r) => {
                                          const answer = String(
                                            r.answers[question.id],
                                          )
                                            .toLowerCase()
                                            .trim();
                                          return (
                                            answer.includes("yes") ||
                                            answer === "y"
                                          );
                                        },
                                      ).length;
                                      const noCount = questionResponses.filter(
                                        (r) => {
                                          const answer = String(
                                            r.answers[question.id],
                                          )
                                            .toLowerCase()
                                            .trim();
                                          return (
                                            answer.includes("no") ||
                                            answer === "n"
                                          );
                                        },
                                      ).length;
                                      const naCount = questionResponses.filter(
                                        (r) => {
                                          const answer = String(
                                            r.answers[question.id],
                                          )
                                            .toLowerCase()
                                            .trim();
                                          return (
                                            answer.includes("na") ||
                                            answer.includes("n/a") ||
                                            answer.includes("not applicable")
                                          );
                                        },
                                      ).length;
                                      const total = questionResponses.length;
                                      const yesPercentage =
                                        total > 0
                                          ? ((yesCount / total) * 100).toFixed(
                                            1,
                                          )
                                          : "0.0";

                                      const isFollowUp =
                                        question.parentId ||
                                        question.showWhen?.questionId;

                                      return (
                                        <tr
                                          key={question.id}
                                          className={`hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors ${isFollowUp
                                            ? "bg-purple-50 dark:bg-purple-900/20"
                                            : "bg-white dark:bg-gray-800"
                                            }`}
                                        >
                                          <td
                                            className={`px-6 py-4 text-sm text-gray-900 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 font-medium max-w-sm ${isFollowUp ? "pl-12" : ""
                                              }`}
                                          >
                                            <div
                                              className="truncate"
                                              title={
                                                question.text ||
                                                "Unnamed Question"
                                              }
                                            >
                                              {question.text ||
                                                "Unnamed Question"}
                                            </div>
                                          </td>
                                          <td className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">
                                            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300 px-3 py-1 rounded-full text-xs">
                                              {total}
                                            </span>
                                          </td>
                                          <td className="px-6 py-4 text-center text-sm text-gray-900 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 font-medium">
                                            <span className="bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-300 px-3 py-1 rounded-full text-xs">
                                              {yesCount}
                                            </span>
                                          </td>
                                          <td className="px-6 py-4 text-center text-sm text-gray-900 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 font-medium">
                                            <span className="bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-300 px-3 py-1 rounded-full text-xs">
                                              {noCount}
                                            </span>
                                          </td>
                                          <td className="px-6 py-4 text-center text-sm text-gray-900 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 font-medium">
                                            <span className="bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-gray-200 px-3 py-1 rounded-full text-xs">
                                              {naCount}
                                            </span>
                                          </td>
                                          <td className="px-6 py-4 text-center text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                                            {yesPercentage}%
                                          </td>
                                        </tr>
                                      );
                                    },
                                  )}
                                </React.Fragment>
                              );
                            },
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              {/* Section Based Table */}
              {tableViewType === "section" &&
                filteredSectionStats.length > 0 && (
                  <div className="card p-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <FileText className="w-5 h-5 text-indigo-600" />
                        Section Analytics - Table View
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-gray-700 dark:to-gray-600 border-b-2 border-indigo-200 dark:border-indigo-700">
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white border-r border-indigo-200 dark:border-indigo-700">
                              Section Name
                            </th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white border-r border-indigo-200 dark:border-indigo-700">
                              Total
                            </th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white border-r border-indigo-200 dark:border-indigo-700">
                              {complianceLabels.yes}
                            </th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white border-r border-indigo-200 dark:border-indigo-700">
                              {complianceLabels.no}
                            </th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white">
                              {complianceLabels.na}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {filteredSectionStats.map(
                            (stat: SectionPerformanceStat, index: number) => {
                              const yesPercentage =
                                stat.total > 0
                                  ? ((stat.yes / stat.total) * 100).toFixed(1)
                                  : "0.0";
                              const noPercentage =
                                stat.total > 0
                                  ? ((stat.no / stat.total) * 100).toFixed(1)
                                  : "0.0";
                              const naPercentage =
                                stat.total > 0
                                  ? ((stat.na / stat.total) * 100).toFixed(1)
                                  : "0.0";

                              return (
                                <tr
                                  key={stat.id}
                                  className={`${index % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50 dark:bg-gray-750"} hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors`}
                                >
                                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 font-medium">
                                    {stat.title}
                                  </td>
                                  <td className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">
                                    <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300 px-3 py-1 rounded-full text-xs">
                                      {stat.total}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-center text-sm text-gray-900 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 font-medium">
                                    <span className="bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-300 px-3 py-1 rounded-full text-xs">
                                      {stat.yes} ({yesPercentage}%)
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-center text-sm text-gray-900 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 font-medium">
                                    <span className="bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-300 px-3 py-1 rounded-full text-xs">
                                      {stat.no} ({noPercentage}%)
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-center text-sm text-gray-900 dark:text-gray-300 font-medium">
                                    <span className="bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-gray-200 px-3 py-1 rounded-full text-xs">
                                      {stat.na} ({naPercentage}%)
                                    </span>
                                  </td>
                                </tr>
                              );
                            },
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* Responses as Table */}
          {analyticsView === "responses" && (
            <div className="space-y-6">
              <div className="card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Table className="w-5 h-5 text-indigo-600" />
                      All Responses - Table View
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Viewing {filteredResponses.length} responses
                    </p>
                  </div>
                  <div className="flex gap-2 items-center relative">
                    <button
                      onClick={() =>
                        setShowResponsesFilter(!showResponsesFilter)
                      }
                      className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 ${showResponsesFilter ? "ring-2 ring-indigo-400 ring-offset-2 dark:ring-offset-gray-900" : ""}`}
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
                      Filter Sections ({selectedResponsesSectionIds.length}/
                      {form?.sections?.length})
                    </button>
                    <button
                      onClick={() => handleExportToExcel()}
                      disabled={selectedResponsesSectionIds.length === 0}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download as Excel
                    </button>
                    {selectedResponseIds.length > 0 && !isGuest && (
                      <button
                        onClick={() => setShowBulkDeleteConfirm(true)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Selected ({selectedResponseIds.length})
                      </button>
                    )}

                    {showResponsesFilter && (
                      <div className="absolute top-full left-0 mt-2 p-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 min-w-80 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="sticky top-0 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                              <svg
                                className="w-5 h-5 text-indigo-600"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                <path
                                  fillRule="evenodd"
                                  d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
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
                              className="flex-1 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 rounded transition-colors"
                            >
                              Select All
                            </button>
                            <button
                              onClick={() => setSelectedResponsesSectionIds([])}
                              className="flex-1 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                            >
                              Clear All
                            </button>
                          </div>
                        </div>

                        <div className="p-4 max-h-96 overflow-y-auto space-y-2">
                          {form?.sections && form.sections.length > 0 ? (
                            form?.sections?.map((section: Section) => (
                              <label
                                key={section.id}
                                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer transition-colors group"
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
                                    className="w-5 h-5 text-indigo-600 border-gray-300 dark:border-gray-600 rounded cursor-pointer accent-indigo-600"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium text-gray-900 dark:text-gray-200 block truncate">
                                    {section.title}
                                  </span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {section.questions?.length || 0} questions
                                  </span>
                                </div>
                                <svg
                                  className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                                  />
                                </svg>
                              </label>
                            ))
                          ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                              No sections available
                            </p>
                          )}
                        </div>

                        <div className="sticky bottom-0 px-4 py-3 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                            {selectedResponsesSectionIds.length} of{" "}
                            {form?.sections?.length || 0} sections selected
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {selectedResponsesSectionIds.length > 0 ? (
                  <>
                    {/* Overall Inspection Statistics Summary Bar */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                            <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Overall Inspection
                            </p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">
                              Form Performance
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-8">
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                              Total Accepted
                            </span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-xl font-bold text-green-600 dark:text-green-400">
                                {inspectionStats.accepted}
                              </span>
                              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                            </div>
                          </div>

                          <div className="h-10 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block"></div>

                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                              Total Rejected
                            </span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-xl font-bold text-red-600 dark:text-red-400">
                                {inspectionStats.rejected}
                              </span>
                              <XCircle className="w-3.5 h-3.5 text-red-500" />
                            </div>
                          </div>

                          <div className="h-10 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block"></div>

                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                              Total Reworked
                            </span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-xl font-bold text-amber-500 dark:text-amber-400">
                                {inspectionStats.reworked}
                              </span>
                              <span className="text-amber-500">⚠</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                      <table className="text-sm border-collapse">
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-indigo-50 dark:bg-indigo-900/20">
                            <td className="px-3 py-3 border border-indigo-200 dark:border-indigo-700"></td>
                            <td className="px-6 py-3 border border-indigo-200 dark:border-indigo-700"></td>
                            <td className="px-6 py-3 border border-indigo-200 dark:border-indigo-700"></td>
                            <td className="px-6 py-3 border border-indigo-200 dark:border-indigo-700"></td>
                            <td className="px-6 py-3 border border-indigo-200 dark:border-indigo-700"></td>
                            {form?.sections?.map((section: Section) => {
                              const sectionQuestionsCount =
                                section.questions?.length || 0;
                              return (
                                selectedResponsesSectionIds.includes(
                                  section.id,
                                ) && (
                                  <td
                                    key={`header-${section.id}`}
                                    colSpan={sectionQuestionsCount}
                                    className="px-6 py-3 text-center font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700"
                                  >
                                    {section.title}
                                  </td>
                                )
                              );
                            })}
                          </tr>

                          <tr className="bg-gray-100 dark:bg-gray-800">
                            <th className="sticky left-0 z-20 text-center px-3 py-3 font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                              <input
                                type="checkbox"
                                checked={
                                  selectedResponseIds.length > 0 &&
                                  selectedResponseIds.length ===
                                  filteredResponses.length
                                }
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedResponseIds(
                                      filteredResponses.map((r) => r.id),
                                    );
                                  } else {
                                    setSelectedResponseIds([]);
                                  }
                                }}
                                className="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded cursor-pointer accent-indigo-600"
                              />
                            </th>
                            <th className="sticky left-12 z-20 text-left px-6 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-700 min-w-32 whitespace-nowrap bg-gray-100 dark:bg-gray-800">
                              Actions
                            </th>
                            <th className="text-left px-6 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-700 min-w-48 whitespace-nowrap bg-gray-50 dark:bg-gray-800/50">
                              Submitted by
                            </th>
                            <th className="text-left px-6 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-700 min-w-40 whitespace-nowrap">
                              Timestamp
                            </th>
                            <th className="text-center px-4 py-3 font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider border border-gray-200 dark:border-gray-700 whitespace-nowrap bg-gray-50 dark:bg-gray-800/50">
                              Time Taken
                            </th>
                            {form?.sections?.map(
                              (section: Section) =>
                                selectedResponsesSectionIds.includes(
                                  section.id,
                                ) &&
                                section.questions?.map((q: any) => {
                                  const isFollowUp =
                                    q.parentId || q.showWhen?.questionId;
                                  const columnOptions = getUniqueColumnValues(
                                    q.id,
                                    responses,
                                  );

                                  return (
                                    <th
                                      key={q.id}
                                      className={`text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider border border-gray-200 dark:border-gray-700 max-w-xs ${isFollowUp ? "bg-purple-100 dark:bg-purple-900/30" : "bg-gray-100 dark:bg-gray-800"}`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="line-clamp-2 overflow-hidden text-ellipsis flex-1">
                                          {q.text || "Question"}
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
                                            setColumnFilters((prev) => ({
                                              ...prev,
                                              [columnId]: values,
                                            }));
                                          }}
                                        />
                                      </div>
                                    </th>
                                  );
                                }),
                            )}
                          </tr>

                          {/* Common Answer Row */}
                          <tr className="bg-amber-50 dark:bg-amber-900/20 border-b-2 border-amber-200 dark:border-amber-800">
                            <td className="px-3 py-3 border border-gray-200 dark:border-gray-700 bg-amber-50/50 dark:bg-amber-900/10"></td>
                            <td className="px-6 py-3 border border-gray-200 dark:border-gray-700 sticky left-12 z-20 bg-amber-50 dark:bg-amber-900/20 font-bold text-amber-800 dark:text-amber-200 text-xs uppercase">
                              Correct Answer
                            </td>
                            <td className="px-6 py-3 border border-gray-200 dark:border-gray-700 bg-amber-50/50 dark:bg-amber-900/10"></td>
                            <td className="px-6 py-3 border border-gray-200 dark:border-gray-700 bg-amber-50/50 dark:bg-amber-900/10"></td>
                            <td className="px-4 py-3 border border-gray-200 dark:border-gray-700 bg-amber-50/50 dark:bg-amber-900/10"></td>
                            {form?.sections?.map(
                              (section: Section) =>
                                selectedResponsesSectionIds.includes(
                                  section.id,
                                ) &&
                                section.questions?.map((q: any) => {
                                  const isFollowUp =
                                    q.parentId || q.showWhen?.questionId;
                                  const hasCorrectAnswer =
                                    q.correctAnswer !== undefined;
                                  return (
                                    <td
                                      key={`correct-${q.id}`}
                                      className={`px-4 py-3 text-xs font-bold border border-gray-200 dark:border-gray-700 ${isFollowUp ? "bg-purple-50 dark:bg-purple-900/10" : ""} ${hasCorrectAnswer ? "text-green-700 dark:text-green-400" : "text-gray-400 italic"}`}
                                    >
                                      {hasCorrectAnswer ? (
                                        <div className="flex flex-col gap-1">
                                          <span className="text-[10px] uppercase text-gray-500 opacity-70">
                                            Correct Answer:
                                          </span>
                                          <span>
                                            {Array.isArray(q.correctAnswer)
                                              ? q.correctAnswer.join(", ")
                                              : String(q.correctAnswer)}
                                          </span>
                                        </div>
                                      ) : (
                                        "-"
                                      )}
                                    </td>
                                  );
                                }),
                            )}
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {filteredResponses.length > 0 ? (
                            filteredResponses.map(
                              (response: Response, idx: number) => (
                                <tr
                                  key={response.id}
                                  className={`${editingResponseId === response.id ? "bg-blue-50 dark:bg-blue-900/20" : idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/50"}`}
                                >
                                  <td
                                    className={`px-3 py-3 text-center border border-gray-200 dark:border-gray-700 whitespace-nowrap sticky left-0 z-20 ${editingResponseId === response.id ? "bg-blue-50 dark:bg-blue-900/20" : idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/50"}`}
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
                                    className={`px-6 py-3 text-sm text-gray-600 dark:text-gray-400 font-medium border border-gray-200 dark:border-gray-700 whitespace-nowrap sticky left-12 z-20 ${editingResponseId === response.id ? "bg-blue-50 dark:bg-blue-900/20" : idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/50"}`}
                                  >
                                    {/* Actions cell content */}
                                    <div className="flex items-center gap-2">
                                      {editingResponseId === response.id ? (
                                        <>
                                          <button
                                            onClick={handleSaveEdit}
                                            disabled={isSaving}
                                            title="Save Response"
                                            className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors disabled:opacity-50"
                                          >
                                            <CheckCircle className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={handleCancelEdit}
                                            disabled={isSaving}
                                            title="Cancel"
                                            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                                          >
                                            <XCircle className="w-4 h-4" />
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          {!isGuest && (user?.role === "superadmin" ||
                                            !form?.tenantId ||
                                            (typeof form.tenantId === "object"
                                              ? form.tenantId?._id
                                              : form.tenantId) ===
                                            user?.tenantId) && (
                                              <>
                                                <button
                                                  onClick={() =>
                                                    handleEditStart(response)
                                                  }
                                                  title="Edit Response"
                                                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                                                >
                                                  <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                  onClick={() => {
                                                    setDeletingResponseId(
                                                      response.id,
                                                    );
                                                    setShowDeleteConfirm(true);
                                                  }}
                                                  title="Delete Response"
                                                  className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                                >
                                                  <Trash2 className="w-4 h-4" />
                                                </button>
                                              </>
                                            )}
                                          {!isGuest && (
                                            <div className="relative z-30">
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleViewDetails(response);
                                                }}
                                                className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-all duration-200"
                                                title="View Details"
                                              >
                                                <Eye className="w-4 h-4" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setChatResponse(response);
                                                  setShowChatModal(true);
                                                }}
                                                className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-all duration-200"
                                                title="Open Chat"
                                              >
                                                <MessageCircle className="w-4 h-4" />
                                              </button>
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-3 text-sm text-gray-900 dark:text-white font-bold border border-gray-200 dark:border-gray-700 min-w-48 whitespace-nowrap bg-gray-50/50 dark:bg-gray-800/30">
                                    {response.submittedBy ||
                                      response.createdBy ||
                                      "Anonymous"}
                                  </td>
                                  <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400 font-medium border border-gray-200 dark:border-gray-700 min-w-40 whitespace-nowrap">
                                    {getResponseTimestamp(response)
                                      ? new Date(
                                        getResponseTimestamp(response)!,
                                      ).toLocaleString()
                                      : "-"}
                                  </td>
                                  <td className="px-6 py-3 text-sm text-center font-bold text-blue-600 dark:text-blue-400 border border-gray-200 dark:border-gray-700 whitespace-nowrap">
                                    {(() => {
                                      // Check both timeSpent (backend) and totalTimeSpent (frontend type)
                                      const timeSpent =
                                        response.timeSpent ??
                                        response.totalTimeSpent;
                                      return timeSpent !== undefined &&
                                        timeSpent !== null &&
                                        timeSpent > 0 ? (
                                        <div className="flex items-center justify-center gap-1">
                                          <Clock className="w-3.5 h-3.5" />
                                          {timeSpent > 60
                                            ? `${Math.floor(timeSpent / 60)}m ${timeSpent % 60}s`
                                            : `${timeSpent}s`}
                                        </div>
                                      ) : (
                                        "-"
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
                                                value={editFormData[q.id] || ""}
                                                onChange={(e) =>
                                                  setEditFormData({
                                                    ...editFormData,
                                                    [q.id]: e.target.value,
                                                  })
                                                }
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
                          ) : (
                            <tr>
                              <td
                                colSpan={
                                  4 +
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
      <CascadingFilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        questions={
          form?.sections?.[0]?.questions?.filter(
            (q: any) => !q.parentId && !q.showWhen?.questionId,
          ) || []
        }
        responses={responses}
        onApplyFilters={(filters) => {
          const { dates, locations, ...questionFilters } = filters as any;
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
                      ? new Date(
                        getResponseTimestamp(selectedResponse)!,
                      ).toLocaleString()
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
                    {selectedFormForModal?.followUpQuestions?.map(
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
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
          <div className="px-6 md:px-8 py-6">
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
                        <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
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
                        stat.weightage > 0,
                    );

                    const totalQuestions = filteredSectionStats.reduce(
                      (sum, stat) => sum + stat.total,
                      0,
                    );
                    const totalYes = filteredSectionStats.reduce(
                      (sum, stat) => sum + stat.yes,
                      0,
                    );
                    const totalNo = filteredSectionStats.reduce(
                      (sum, stat) => sum + stat.no,
                      0,
                    );
                    const totalNA = filteredSectionStats.reduce(
                      (sum, stat) => sum + stat.na,
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
                                ? new Date(
                                  getResponseTimestamp(response)!,
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
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
                                  Yes
                                </p>
                                <p className="text-sm font-bold text-green-800 dark:text-green-300">
                                  {totalYes} ({yesPercent}%)
                                </p>
                              </div>
                              <div className="text-center p-2 bg-red-100/60 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-700">
                                <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                                  No
                                </p>
                                <p className="text-sm font-bold text-red-800 dark:text-red-300">
                                  {totalNo} ({noPercent}%)
                                </p>
                              </div>
                              <div className="text-center p-2 bg-yellow-100/60 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-700">
                                <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">
                                  N/A
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
                                  const total = row.yes + row.no + row.na;
                                  const yesPercent =
                                    total > 0
                                      ? ((row.yes / total) * 100).toFixed(1)
                                      : 0;
                                  const noPercent =
                                    total > 0
                                      ? ((row.no / total) * 100).toFixed(1)
                                      : 0;
                                  const naPercent =
                                    total > 0
                                      ? ((row.na / total) * 100).toFixed(1)
                                      : 0;

                                  const chartData = {
                                    labels: [
                                      `Yes (${yesPercent}%)`,
                                      `No (${noPercent}%)`,
                                      `N/A (${naPercent}%)`,
                                    ],
                                    datasets: [
                                      {
                                        data: [row.yes, row.no, row.na],
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
                                                          (a, b) => a + b,
                                                          0,
                                                        );
                                                      const percentage = (
                                                        (value / total) *
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
                                              Yes:{" "}
                                              <span className="font-bold">
                                                {row.yes}
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
                                              No:{" "}
                                              <span className="font-bold">
                                                {row.no}
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
                                              N/A:{" "}
                                              <span className="font-bold">
                                                {row.na}
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
                    <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
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
                                      ? new Date(
                                        getResponseTimestamp(response)!,
                                      ).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                      })
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

      {/* Share Analytics Modal */}
      <ShareAnalyticsModal
        isOpen={shareAnalyticsModal.open}
        onClose={() =>
          setShareAnalyticsModal((prev) => ({ ...prev, open: false }))
        }
        formId={shareAnalyticsModal.formId}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white font-medium z-50 ${toast.type === "success"
            ? "bg-green-500 dark:bg-green-600"
            : "bg-red-500 dark:bg-red-600"
            }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === "success" ? (
              <CheckCircle className="w-5 h-5" />
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
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-indigo-600">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Question Filter: {chatResponse.submittedBy || 'Inspector'}
                  </h2>
                  <p className="text-xs text-white/70">Chassis: {(() => {
                    const chassisQ = form?.sections?.flatMap(s => s.questions || []).find(q => q.type === 'chassisNumber' || q.type === 'chassis-with-zone' || q.type === 'chassis-without-zone');
                    const chassisVal = chatResponse.answers?.[chassisQ?.id || ''];
                    return typeof chassisVal === 'object' ? chassisVal.chassisNumber : chassisVal || 'N/A';
                  })()}</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/inspector/chat')}
                className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
                title="Close & Go to Chat"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2">
              {/* Left Column: Filters */}
              <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-r border-gray-200 dark:border-gray-700 overflow-y-auto space-y-6">
                <div>
                  {/* <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">
                    Filter Options
                  </h3> */}

                  <div className="space-y-4">
                    <p className="text-xl text-gray-700 dark:text-gray-300">Chassis Number : {(() => {
                      const chassisQ = form?.sections?.flatMap(s => s.questions || []).find(q => q.type === 'chassisNumber' || q.type === 'chassis-with-zone' || q.type === 'chassis-without-zone');
                      const chassisVal = chatResponse.answers?.[chassisQ?.id || ''];
                      return typeof chassisVal === 'object' ? chassisVal.chassisNumber : chassisVal || 'N/A';
                    })()}</p>

                    {/* <div className="space-y-1 p-3 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                      <p className="text-[10px] uppercase font-black text-indigo-500 dark:text-indigo-400 mb-2 flex items-center gap-1">
                        <BarChart3 className="w-2.5 h-2.5" />
                        Chassis Overall Stats
                      </p>
                      {(() => {
                        const chassisQ = form?.sections?.flatMap(s => s.questions || []).find(q => q.type === 'chassisNumber' || q.type === 'chassis-with-zone' || q.type === 'chassis-without-zone');
                        const chassisVal = chatResponse.answers?.[chassisQ?.id || ''];
                        const currentChassis = typeof chassisVal === 'object' ? chassisVal.chassisNumber : chassisVal;
                        
                        const chassisResponses = responses.filter(r => {
                          const rVal = r.answers?.[chassisQ?.id || ''];
                          const rNum = typeof rVal === 'object' ? rVal.chassisNumber : rVal;
                          return rNum === currentChassis;
                        });

                        const stats = {
                          accepted: chassisResponses.filter(r => r.status === 'verified').length,
                          rejected: chassisResponses.filter(r => r.status === 'rejected').length,
                          rework: chassisResponses.filter(r => r.status === 'pending' || !r.status).length
                        };

                        return (
                          <div className="grid grid-cols-3 gap-2">
                            <div className="text-center">
                              <p className="text-[10px] font-bold text-green-600 dark:text-green-400">Accepted</p>
                              <p className="text-sm font-black text-green-700 dark:text-green-300">{stats.accepted}</p>
                            </div>
                            <div className="text-center border-x border-indigo-100 dark:border-indigo-800/50">
                              <p className="text-[10px] font-bold text-red-600 dark:text-red-400">Rejected</p>
                              <p className="text-sm font-black text-red-700 dark:text-red-300">{stats.rejected}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Rework</p>
                              <p className="text-sm font-black text-amber-700 dark:text-amber-300">{stats.rework}</p>
                            </div>
                          </div>
                        );
                      })()}
                    </div> */}

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1">
                        Select Questions
                      </label>
                      <div className="max-h-[500px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-inner scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 height-[900px]">
                        {form?.sections?.flatMap(s => s.questions || []).map(q => (
                          <div key={q.id} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                            <div className="flex items-start gap-3 p-3 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 cursor-default transition-colors group">
                              <label className="mt-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={chatFilters.questions.includes(q.id)}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setChatFilters(prev => ({
                                      ...prev,
                                      questions: checked
                                        ? [...prev.questions, q.id]
                                        : prev.questions.filter(id => id !== q.id)
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
                                    {/* Suggested Answer/Correction UI */}
                                    <QuestionSuggestionRenderer
                                      question={q}
                                      currentAnswer={responses.find(r => r.id === chatResponse.id)?.answers?.[q.id]}
                                      value={chatFilters.suggestedAnswers?.[q.id] || responses.find(r => r.id === chatResponse.id)?.answers?.[q.id] || {}}
                                      onChange={(val) => setChatFilters(prev => ({
                                        ...prev,
                                        suggestedAnswers: { ...prev.suggestedAnswers, [q.id]: val }
                                      }))}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  <div className="pt-6 flex items-center justify-between">
                    <button
                      onClick={() => setChatFilters({ chassisNumber: "", location: "", questions: [], selectedCategories: {}, zoneType: "both" })}
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
                      <button className="px-4 py-2 text-xs font-extrabold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95">
                        Apply Filters
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Chat history and input */}
              <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-t md:border-t-0 p-6 overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    Message Center
                  </h3>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 rounded-full border border-green-200 dark:border-green-800">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold text-green-700 dark:text-green-400">Live Context</span>
                  </div>
                </div>

                <div className="flex-1 bg-gray-50 dark:bg-gray-800/20 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 mb-4 overflow-y-auto space-y-4 flex flex-col scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                  {chatMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3 opacity-50">
                      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full ring-8 ring-gray-50 dark:ring-gray-900/50">
                        <MessageCircle className="w-10 h-10" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-gray-600 dark:text-gray-300">No active conversation</p>
                        <p className="text-xs">Send a message to start the thread.</p>
                      </div>
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div key={i} className={`flex flex-col ${String(msg.from?._id || msg.from) === String(user?._id || (user as any)?.id) ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                        <div className={`max-w-[90%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${String(msg.from?._id || msg.from) === String(user?._id || (user as any)?.id)
                          ? 'bg-[#dcf8c6] text-gray-900 rounded-br-lg rounded-tr-lg rounded-tl-sm'
                          : 'bg-white dark:bg-gray-100 text-gray-900 border border-gray-100 dark:border-gray-700 rounded-bl-lg rounded-tl-lg rounded-tr-sm'
                          }`}>
                         {msg.questionContexts && msg.questionContexts.length > 0 ? (
  <div className="space-y-3">
    {msg.questionContexts.map((ctx: any, idx: number) => (
      <div key={idx} className="space-y-2">
        {/* Keep the question title */}
        <p className="text-[12px] font-bold text-white-500 dark:text-white-400 border-b border-indigo-100 dark:border-indigo-800/50 pb-0.5">
          {ctx.title}
        </p>
        {/* Only show the suggestion (Admin Instructions), NOT the formatted answer */}
        {renderSuggestion(ctx.suggestion)}
      </div>
    ))}
  </div>
) : msg.questionTitles && msg.questionTitles.length > 0 && (
  <div className="mb-2 p-2 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100/50 dark:border-indigo-800/30">
    <p className="text-[10px] uppercase font-black text-indigo-500 dark:text-indigo-400 mb-1.5 flex items-center gap-1">
      <Filter className="w-2.5 h-2.5" />
      Linked Questions
    </p>
    <div className="flex flex-wrap gap-1">
      {msg.questionTitles.map((title: string, idx: number) => (
        <span key={idx} className="px-1.5 py-0.5 bg-white dark:bg-gray-700 text-[9px] font-bold text-indigo-600 dark:text-indigo-300 rounded-md border border-indigo-100 dark:border-indigo-800">
          {title}
        </span>
      ))}
    </div>
  </div>
)}
                          {msg.message}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5 px-1 opacity-60">
                          <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400">
                            {String(msg.from?._id || msg.from) === String(user?._id || (user as any)?.id) ? 'You' : (msg.from?.name || 'Inspector')} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {String(msg.from?._id || msg.from) !== String(user?._id || (user as any)?.id) && (
                            <button
                              onClick={() => {
                                setNewMessage(`Replying to: "${msg.message.substring(0, 30)}..." \n`);
                                const textarea = document.querySelector('textarea');
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

                <div className="space-y-3">
                  <div className="relative">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your feedback to the inspector..."
                      className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-indigo-500 dark:focus:border-indigo-400 rounded-2xl text-sm focus:ring-0 transition-all resize-none shadow-inner text-gray-800 dark:text-gray-200"
                      rows={3}
                    />
                    <div className="absolute top-0 right-0 p-2 opacity-50">
                      <div className="flex gap-1">
                        <div className="w-1 h-1 bg-gray-400 rounded-full" />
                        <div className="w-1 h-1 bg-gray-400 rounded-full" />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleSendMessage}
                    disabled={isSendingMessage || !newMessage.trim()}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 text-white text-sm font-black rounded-2xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-xl shadow-indigo-200 dark:shadow-none"
                  >
                    {isSendingMessage ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Send Feedback</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-center text-gray-400 font-medium">
                    Message will be sent to <b>{chatResponse.submittedBy || 'the submitter'}</b>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
