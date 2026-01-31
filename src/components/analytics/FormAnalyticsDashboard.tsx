import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { exportDashboardToPDF, exportFormAnalyticsToPDF } from '../../utils/formanalyticsexport';
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


} from "lucide-react";
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
  RadialLinearScale
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


ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
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
const getSectionQualityBreakdown = (section: Section, responses: Response[]): Array<{
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
  const parameterGroups = new Map<string, {
    parameterName: string;
    yes: number;
    no: number;
    na: number;
    total: number;
    questions: Question[];
    isRealParameter: boolean;
  }>();

  // Process all main questions in the section
  section.questions.forEach((q: any) => {
    // Only process main questions (not follow-ups)
    if (!q.parentId && !q.showWhen?.questionId) {
      // Check if this has a real parameter name
      const hasRealParameter = !!q.subParam1 || !!q.parameter;

      // Get parameter name (prefer subParam1 or parameter over question text)
      const paramName = q.subParam1 ||
        q.parameter ||
        (hasRealParameter ? null : q.text?.substring(0, 30) + (q.text?.length > 30 ? "..." : "")) ||
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
          isRealParameter: hasRealParameter
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
        total: group.total
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

  qualityBreakdown.forEach(item => {
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
    }
  };
};

// Add getSectionStats function
const getSectionStats = (section: Section, responses: Response[]) => {
  // Filter for main questions only (not follow-ups)
  const mainQuestionsOnly = section.questions.filter(
    (q: any) => !q.parentId && !q.showWhen?.questionId
  );

  console.log('Main questions found:', mainQuestionsOnly.length);
  console.log('All questions in section:', section.questions.length);

  const mainQuestionCount = mainQuestionsOnly.length;
  let totalFollowUpCount = 0;
  let answeredMainQuestions = 0;
  let answeredFollowUpQuestions = 0;
  let mainQuestionResponses = 0;
  let followUpResponses = 0;

  // Count follow-up questions
  const followUpQuestionsInSection = section.questions.filter(
    (q: any) => q.parentId || q.showWhen?.questionId
  );
  totalFollowUpCount = followUpQuestionsInSection.length;

  // Process follow-up questions
  followUpQuestionsInSection.forEach((followUp: any) => {
    const followUpResponders = responses.filter(
      (r) => r.answers && r.answers[followUp.id]
    ).length;
    if (followUpResponders > 0) {
      answeredFollowUpQuestions++;
      followUpResponses += followUpResponders;
    }
  });

  // Process main questions
  const questionsDetail = mainQuestionsOnly.map((q: any) => {
    const mainQuestionResponders = responses.filter(
      (r) => r.answers && r.answers[q.id]
    ).length;

    if (mainQuestionResponders > 0) {
      answeredMainQuestions++;
      mainQuestionResponses += mainQuestionResponders;
    }

    const relatedFollowUps = section.questions.filter(
      (fq: any) => fq.parentId === q.id || fq.showWhen?.questionId === q.id
    );

    return {
      id: q.id,
      text: q.text || 'Unnamed Question',
      followUpCount: relatedFollowUps.length,
      responses: mainQuestionResponders,
      followUpDetails: relatedFollowUps.map((fq: any) => ({
        id: fq.id,
        text: fq.text || 'Unnamed Follow-up',
        responses: responses.filter((r) => r.answers && r.answers[fq.id]).length,
      })),
    };
  });

  const totalAnswered = answeredMainQuestions + answeredFollowUpQuestions;
  const totalQuestions = mainQuestionCount + totalFollowUpCount;
  const totalResponses = mainQuestionResponses + followUpResponses;

  const completionRate = totalQuestions > 0
    ? ((totalAnswered / totalQuestions) * 100).toFixed(1)
    : "0.0";

  const avgResponsesPerQuestion = totalQuestions > 0
    ? (totalResponses / totalQuestions).toFixed(1)
    : "0.0";

  console.log('Processed questionsDetail:', questionsDetail);

  return {
    mainQuestionCount,
    totalFollowUpCount,
    answeredMainQuestions,
    answeredFollowUpQuestions,
    totalAnswered,
    totalResponses,
    completionRate,
    avgResponsesPerQuestion,
    questionsDetail // Make sure this is returned
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

const computeSectionPerformanceStats = (
  form: Form | null,
  responses: Response[]
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
                recognizedYesNoValues.includes(value)
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
  answers: Record<string, any>
): SectionStat[] => {
  const stats =
    form.sections?.map((section: any) => {
      const counts = { yes: 0, no: 0, na: 0, total: 0 };
      const weightageNumber = Number(section.weightage);
      const weightage = Number.isFinite(weightageNumber)
        ? weightageNumber
        : 0;

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
            ["yes", "no", "n/a", "na", "not applicable"].includes(value)
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

export default function FormAnalyticsDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [responses, setResponses] = useState<Response[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoOpenSectionId, setAutoOpenSectionId] = useState<string | null>(null);
  const [analyticsView, setAnalyticsView] = useState<"question" | "section" | "table" | "responses" | "dashboard" | "comparison">(
    "section"
  );
  const [tableViewType, setTableViewType] = useState<"question" | "section">("question");
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
  const [weightageValues, setWeightageValues] = useState<Record<string, string>>({});

  const [redistributionMode, setRedistributionMode] = useState(false);
  const [tempWeightageValues, setTempWeightageValues] = useState<Record<string, string>>({});
  const [weightageBalance, setWeightageBalance] = useState(0);

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSectionSelector, setShowSectionSelector] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<Array<{ id: string; label: string; value: string }>>([]);
  const [cascadingFilters, setCascadingFilters] = useState<Record<string, string[]>>({});
  const [dateFilter, setDateFilter] = useState<{
    type: 'all' | 'single' | 'range';
    startDate: string;
    endDate: string;
  }>({ type: 'all', startDate: '', endDate: '' });
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[] | null>>({});
  const [selectedResponsesSectionIds, setSelectedResponsesSectionIds] = useState<string[]>([]);
  const [showResponsesFilter, setShowResponsesFilter] = useState(false);
  const [editingResponseId, setEditingResponseId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingResponseId, setDeletingResponseId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; id: string } | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<Response | null>(null);
  const [selectedFormForModal, setSelectedFormForModal] = useState<Form | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [comparisonViewMode, setComparisonViewMode] = useState<"dashboard" | "responses">("dashboard");

  const complianceLabels = useMemo(() => {
    const defaultLabels = { yes: "Yes", no: "No", na: "N/A" };
    let labels = { ...defaultLabels };
    
    if (form?.sections) {
      for (const section of form.sections) {
        if (section.questions) {
          for (const question of section.questions) {
            if (question.type === "yesNoNA" && question.options && question.options.length >= 2) {
              const hasCustomLabels = 
                question.options[0] !== "Yes" || 
                question.options[1] !== "No" || 
                (question.options[2] && question.options[2] !== "N/A");
              
              if (hasCustomLabels) {
                return {
                  yes: question.options[0] || "Yes",
                  no: question.options[1] || "No",
                  na: question.options[2] || "N/A"
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

      try {
        setLoading(true);
        setError(null);

        // Fetch form details
        const formData = await apiClient.getForm(id);
        setForm(formData.form);

        // Initialize selected sections for responses view - select all by default
        if (formData.form?.sections && formData.form.sections.length > 0) {
          setSelectedResponsesSectionIds(formData.form.sections.map((s: Section) => s.id));
        }

        // Fetch responses for this form
        const responsesData = await apiClient.getFormResponses(id);
        setResponses(responsesData.responses || []);
      } catch (err) {
        console.error("Error fetching analytics data:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load analytics"
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
    const firstSection = form.sections[0];
    const foundQuestion = firstSection.questions?.find(
      (q: any) => q.id === selectedQuestionId
    );

    console.log('Found question:', foundQuestion); // For debugging
    console.log('Question options:', foundQuestion?.options); // For debugging

    setSelectedQuestion(foundQuestion || null);
  }, [selectedQuestionId, form]);




  const availableLocations = useMemo(() => {
    const locations = new Set<string>();
    responses.forEach(r => {
      const meta = r.submissionMetadata?.location;
      if (meta) {
        const city = meta.city || '';
        const country = meta.country || '';
        const locationStr = city && country ? `${city}, ${country}` : country || 'Unknown';
        if (locationStr !== 'Unknown') {
          locations.add(locationStr);
        }
      }
    });
    return Array.from(locations).sort();
  }, [responses]);

  const filteredResponses = useMemo(() => {
    let result = responses;

    // 1. Date Filter
    if (dateFilter.type !== 'all') {
      result = result.filter((response) => {
        const timestamp = getResponseTimestamp(response);
        if (!timestamp) return false;
        const responseDate = new Date(timestamp).toISOString().split('T')[0];

        if (dateFilter.type === 'single' && dateFilter.startDate) {
          return responseDate === dateFilter.startDate;
        } else if (dateFilter.type === 'range' && dateFilter.startDate && dateFilter.endDate) {
          return responseDate >= dateFilter.startDate && responseDate <= dateFilter.endDate;
        }
        return true;
      });
    }

    // 2. Location Filter
    if (locationFilter.length > 0) {
      result = result.filter((response) => {
        const meta = response.submissionMetadata?.location;
        if (!meta) return false;
        
        const city = meta.city || '';
        const country = meta.country || '';
        const locationStr = city && country ? `${city}, ${country}` : country || 'Unknown';
        
        return locationFilter.includes(locationStr);
      });
    }

    // 3. Cascading Question Filters
    const cascadingFiltersArray = Object.entries(cascadingFilters).filter(
      ([_, answers]) => answers.length > 0
    );

    if (cascadingFiltersArray.length > 0) {
      result = result.filter((response) => {
        return cascadingFiltersArray.every(([questionId, selectedAnswers]) => {
          const answer = response.answers[questionId];
          if (!answer) return false;

          // Handle different answer types
          if (Array.isArray(answer)) {
            return answer.some((item) => 
              selectedAnswers.some((selectedAnswer) => 
                String(item).toLowerCase() === selectedAnswer.toLowerCase()
              )
            );
          }
          return selectedAnswers.some((selectedAnswer) => 
            String(answer).toLowerCase() === selectedAnswer.toLowerCase()
          );
        });
      });
    }

    // 4. Column Filters (Excel-like filtering)
    const columnFiltersArray = Object.entries(columnFilters).filter(
      ([_, values]) => values !== null && values.length > 0
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
              selectedValues.some((selectedValue) => 
                String(item).trim().toLowerCase() === selectedValue.toLowerCase()
              )
            );
          }
          
          return selectedValues.some((selectedValue) => 
            String(answer).trim().toLowerCase() === selectedValue.toLowerCase()
          );
        });
      });
    }

    return result;
  }, [responses, cascadingFilters, dateFilter, locationFilter, columnFilters]);

  const analytics = useMemo(() => {
    const total = filteredResponses.length;
    const pending = filteredResponses.filter(
      (r) => r.status === "pending" || !r.status
    ).length;
    const verified = filteredResponses.filter((r) => r.status === "verified").length;
    const rejected = filteredResponses.filter((r) => r.status === "rejected").length;

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
      {}
    );

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split("T")[0];
    }).reverse();

    const maxCount = Math.max(
      ...last7Days.map((date) => responseTrend[date] || 0),
      1
    );
    const percentageData = last7Days.map((date) =>
      Math.round(((responseTrend[date] || 0) / maxCount) * 100)
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
    [form, filteredResponses]
  );

  const filteredSectionStats = useMemo(
    () =>
      sectionPerformanceStats.filter(
        (stat) =>
          stat.yes > 0 || stat.no > 0 || stat.na > 0 || stat.weightage > 0
      ),
    [sectionPerformanceStats]
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
        selectedSectionIds.includes(stat.id)
      ),
    [filteredSectionStats, selectedSectionIds]
  );

  const getUniqueColumnValues = (questionId: string, responses: Response[]): string[] => {
    const values = new Set<string>();
    responses.forEach(response => {
      const answer = response.answers?.[questionId];
      if (answer !== null && answer !== undefined) {
        if (Array.isArray(answer)) {
          answer.forEach(item => {
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

    if (question?.type === "file" || question?.type === "radio-image") {
      const fileData = resolveFileData(value);
      if (fileData?.data) {
        return (
          <FilePreview data={fileData.data} fileName={fileData.fileName} />
        );
      }
      if (fileData?.url) {
        return <FilePreview url={fileData.url} fileName={fileData.fileName} />;
      }
    }

    if (value === null || value === undefined) {
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
      if (question?.type === "file" || question?.type === "radio-image") {
        if (
          value.startsWith("http") ||
          value.startsWith("//") ||
          value.startsWith("/") ||
          value.startsWith("uploads/")
        ) {
          const absolute = ensureAbsoluteFileSource(value);
          return (
            <FilePreview
              url={absolute}
              fileName={
                question?.fileName || question?.name || extractFileName(value)
              }
            />
          );
        }
      }
      if (value.startsWith("http://") || value.startsWith("https://")) {
        if (isImageUrl(value)) {
          return <ImageLink text={value} />;
        }
        return (
          <a
            href={value}
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
      if (question?.type === "file" || question?.type === "radio-image") {
        const previews = value
          .map((entry: any, index: number) => {
            const fileData = resolveFileData(entry);
            if (!fileData) {
              return null;
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
          return <div className="space-y-3">{previews}</div>;
        }
      }
      const first = value[0];
      if (typeof first === "string" && first.startsWith("data:")) {
        return (
          <FilePreview
            data={first}
            fileName={question?.fileName || question?.name}
          />
        );
      }
      return (
        <div className="flex flex-wrap gap-2">
          {value.map((item: any, index: number) => {
            const itemStr = String(item);
            if (isImageUrl(itemStr)) {
              return (
                <div key={index} className="inline-block">
                  <ImageLink text={itemStr} />
                </div>
              );
            }
            return <span key={index} className="text-sm">{itemStr}</span>;
          })}
        </div>
      );
    }

    if (typeof value === "object") {
      const fileData = resolveFileData(value);
      if (fileData?.data) {
        return (
          <FilePreview data={fileData.data} fileName={fileData.fileName} />
        );
      }
      if (fileData?.url) {
        return <FilePreview url={fileData.url} fileName={fileData.fileName} />;
      }
      if (!Object.keys(value).length) {
        return <span className="text-gray-400">No response</span>;
      }
      return (
        <pre className="whitespace-pre-wrap text-gray-600 text-sm">
          {JSON.stringify(value, null, 2)}
        </pre>
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
      labels: visibleSectionStats.map((stat) =>
        formatSectionLabel(stat.title)
      ),
      datasets: [
        {
          label: complianceLabels.yes,
          data: visibleSectionStats.map((stat) =>
            calculatePercentage(stat.yes, stat.total)
          ),
          backgroundColor: "#1d4ed8",
          borderRadius: 4,
        },
        {
          label: complianceLabels.no,
          data: visibleSectionStats.map((stat) =>
            calculatePercentage(stat.no, stat.total)
          ),
          backgroundColor: "#3b82f6",
          borderRadius: 4,
        },
        {
          label: complianceLabels.na,
          data: visibleSectionStats.map((stat) =>
            calculatePercentage(stat.na, stat.total)
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
                  "dark"
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
    [visibleSectionStats]
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
    [visibleSectionStats]
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
      { total: 0, yesCount: 0, noCount: 0, naCount: 0, weightage: 0, yesWeighted: 0, noWeighted: 0, naWeighted: 0 }
    );
  }, [sectionSummaryRows]);

  useEffect(() => {
    if (sectionSummaryRows.length > 0) {
      // Check if ALL sections have weightage = 0
      const allZero = sectionSummaryRows.every(row => row.weightage === 0);

      // Check if ANY section has weightage > 0
      const hasWeightage = sectionSummaryRows.some(row => row.weightage > 0);

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
      const updatedSections = form.sections?.map((section: any) =>
        section.id === sectionId
          ? { ...section, weightage: numericValue }
          : section
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
        counts: { yes: 0, no: 0, na: 0, total: 0 } // Ensure counts exists
      };
    }


    let totalYes = 0;
    let totalNo = 0;
    let totalNA = 0;
    let totalResponses = 0;

    sectionSummaryRows.forEach(row => {
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
        total: total
      }
    };
  }, [sectionSummaryRows]);

  const weightedPercentageChartData = useMemo(() => {
    return {
      labels: sectionSummaryRows.map((row) => formatSectionLabel(row.title)),
      datasets: [
        {
          label: "Yes % × Weightage",
          data: sectionSummaryRows.map((row) =>
            parseFloat(row.yesWeighted.toFixed(1))
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
            parseFloat(row.noWeighted.toFixed(1))
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
            parseFloat(row.naWeighted.toFixed(1))
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
                  "dark"
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
    []
  );

  const sectionChartHeight = Math.max(320, visibleSectionStats.length * 56);
  const weightedChartHeight = Math.max(320, sectionSummaryRows.length * 32);

  const sectionsStats = useMemo(() => {
    if (!form?.sections) return [];

    return form.sections.map((section) => ({
      section,
      stats: getSectionStats(section, responses),
    }));
  }, [form, responses]);

  const filteredSectionsStats = useMemo(() => {
    if (!form?.sections) return [];

    return form.sections.map((section) => ({
      section,
      stats: getSectionStats(section, filteredResponses),
    }));
  }, [form, filteredResponses]);

  const OverallQualityPieChart = () => {
    const data = {

      datasets: [
        {
          data: [totalPieChartData.yes, totalPieChartData.no, totalPieChartData.na],
          backgroundColor: [
            'rgba(34, 197, 94)', // Green for Yes
            'rgba(239, 68, 68, 0.8)', // Red for No
            'rgba(156, 163, 175, 0.8)' // Gray for N/A
          ],
          borderColor: [
            'rgb(34, 197, 94)',
            'rgb(239, 68, 68)',
            'rgb(156, 163, 175)'
          ],
          borderWidth: 2,
          hoverOffset: 15
        }
      ]
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        datalabels: {
          color: 'white'
        },
        legend: {
          position: 'bottom',
          labels: {
            color: document.documentElement.classList.contains("dark")
              ? "#e5e7eb"
              : "#374151",
            font: {
              size: 10
            },
            padding: 10
          }
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.label || '';
              const value = context.raw || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${label}: ${value}% (${totalPieChartData.counts[label.toLowerCase()]} responses)`;
            }
          }
        }
      },
      // DONUT CHART SPECIFIC OPTIONS
      cutout: '60%', // This creates the donut hole - adjust percentage for thicker/thinner donut
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
              <div style={{ height: "220px" }} >
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
                    {dynamicComplianceLabels.yes}
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
                    {dynamicComplianceLabels.no}
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
                    {dynamicComplianceLabels.na}
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

    return form.sections.map((section) => {
      const stats = getSectionStats(section, responses);
      const qualityBreakdown = getSectionQualityBreakdown(section, responses);
      const overallQuality = calculateOverallQuality(qualityBreakdown);

      // Debug log to see what we're getting
      console.log('Section Data for PDF:', {
        sectionId: section.id,
        sectionTitle: section.title,
        questionsCount: section.questions?.length || 0,
        questions: section.questions?.map(q => ({
          id: q.id,
          text: q.text,
          type: q.type
        })),
        statsQuestionsDetail: stats.questionsDetail?.length || 0
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
          questionsDetail: stats.questionsDetail || [] // Make sure this is not empty
        },
        qualityBreakdown,
        overallQuality
      };
    }).filter(section => section.stats.questionsDetail.length > 0); // Only include sections with questions
  };

  const handleDownloadPDF = async () => {
    try {
      // Show loading state
      const button = document.querySelector('button[title="Download as PDF"]');
      const originalText = button?.textContent || 'Download PDF';
      if (button) {
        button.innerHTML = '<span class="animate-spin">⏳</span> Generating PDF...';
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
        totalPieChartData: totalPieChartData
      };

      // Define chart IDs to capture
      const chartElementIds = [
        'response-trend-chart',
        'overall-quality-chart',
        'location-heatmap'
      ].filter(id => document.getElementById(id));


      // Add main dashboard charts
      ['response-trend-chart', 'overall-quality-chart', 'section-performance-chart', 'weighted-trends-chart', 'location-heatmap']
        .forEach(id => {
          if (document.getElementById(id)) chartElementIds.push(id);
        });

      // Add section-specific charts
      sectionAnalyticsData.forEach(section => {
        const pieChartId = `section-pie-chart-${section.sectionId}`;
        const visChartId = `section-visualization-${section.sectionId}`;

        if (document.getElementById(pieChartId)) chartElementIds.push(pieChartId);
        if (document.getElementById(visChartId)) chartElementIds.push(visChartId);
      });

      // Generate PDF with section data
      await exportFormAnalyticsToPDF({
        filename: `${form?.title?.replace(/\s+/g, '_') || 'Form'}_Analytics_${new Date().toISOString().split('T')[0]}.pdf`,
        formTitle: form?.title || 'Form Analytics',
        generatedDate: new Date().toLocaleString(),
        totalResponses: analytics.total,
        sectionSummaryRows: sectionSummaryRows,
        totalPieChartData: totalPieChartData,
        chartElementIds: chartElementIds,
        includeSectionAnalytics: true,
        sectionAnalyticsData: getSectionAnalyticsData()
      });

      // Restore button state
      if (button) {
        button.innerHTML = originalText;
        button.disabled = false;
      }

      if (success) {
        console.log('PDF generated successfully');
      } else {
        alert('Failed to generate PDF. Please try again.');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to generate PDF. Please try again.');

      // Restore button state on error
      const button = document.querySelector('button[title="Download as PDF"]');
      if (button) {
        button.innerHTML = 'Download PDF';
        button.disabled = false;
      }
    }
  };

  const handleExportToExcel = () => {
    try {
      const headerRow: any[] = ["Timestamp"];
      const columnInfo: Array<{ questionId: string; isFollowUp: boolean }> = [];

      form?.sections?.forEach((section: Section) => {
        if (selectedResponsesSectionIds.includes(section.id)) {
          section.questions?.forEach((q: any) => {
            const isFollowUp = q.parentId || q.showWhen?.questionId;
            headerRow.push(q.text || "Question");
            columnInfo.push({
              questionId: q.id,
              isFollowUp: !!isFollowUp
            });
          });
        }
      });

      const wsData: any[][] = [headerRow];
      
      responses.forEach((response: Response) => {
        const rowData: any[] = [
          getResponseTimestamp(response) ? new Date(getResponseTimestamp(response)!).toLocaleString() : "-"
        ];

        columnInfo.forEach(({ questionId }) => {
          rowData.push(response.answers?.[questionId] ? String(response.answers[questionId]) : "-");
        });

        wsData.push(rowData);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      const headerFill = { fgColor: { rgb: "FF4F46E5" } };
      const headerFont = { color: { rgb: "FFFFFFFF" }, bold: true };
      
      for (let i = 0; i < headerRow.length; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
        ws[cellRef].s = { fill: headerFill, font: headerFont, alignment: { horizontal: "center", vertical: "center", wrapText: true } };
      }

      for (let rowIdx = 1; rowIdx < wsData.length; rowIdx++) {
        for (let colIdx = 0; colIdx < columnInfo.length; colIdx++) {
          const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx + 1 });
          const isFollowUp = columnInfo[colIdx]?.isFollowUp;
          const bgColor = isFollowUp ? "FFE9D5FF" : "FFF3F4F6";
          
          ws[cellRef].s = {
            fill: { fgColor: { rgb: bgColor } },
            border: {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" }
            }
          };
        }

        const timestampRef = XLSX.utils.encode_cell({ r: rowIdx, c: 0 });
        ws[timestampRef].s = {
          fill: { fgColor: { rgb: "FFF9FAFB" } },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" }
          }
        };
      }

      ws['!cols'] = [{ wch: 20 }, ...columnInfo.map(() => ({ wch: 25 }))];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Responses");
      XLSX.writeFile(wb, `${form?.title || "responses"}-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      alert("Failed to export to Excel. Please try again.");
    }
  };

  const handleViewDetails = (response: Response) => {
    const responseId = response._id || response.id;
    console.log('Navigating to response:', responseId);
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
      await apiClient.updateResponse(editingResponseId, { answers: editFormData });
      
      setResponses(responses.map(r => 
        r.id === editingResponseId 
          ? { ...r, answers: editFormData }
          : r
      ));
      
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

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
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
      
      setResponses(responses.filter(r => r.id !== deletingResponseId));
      
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
          <button onClick={() => navigate(-1)} className="mt-4 btn-primary">
            Go Back
          </button>
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
            className={`p-1.5 rounded transition-colors relative ${
              appliedFilters.length > 0 
                ? "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 bg-indigo-50 dark:bg-indigo-900/20" 
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
            title="Advanced Filters"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            {appliedFilters.length > 0 && (
              <span className="absolute top-0 right-0 flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-red-500 rounded-full -translate-y-1 translate-x-1">
                {appliedFilters.length}
              </span>
            )}
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-2 py-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Download as PDF"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
      </div>
      )}



      {/* Dashboard View */}
      {analyticsView === "dashboard" && (
        <>
          <div className="flex items-center justify-center min-h-screen px-4 py-24" id="summary-cards">
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
                        })
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
            title="Response Locations Heatmap" id="location-heatmap"
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
                <ResponseQuestion question={form} responses={filteredResponses} />
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
                            onClick={() => setShowSectionSelector(!showSectionSelector)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-700 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13l-7 7-7-7m0-6l7-7 7 7" />
                            </svg>
                            Sections ({selectedSectionIds.length}/{filteredSectionStats.length})
                          </button>

                          {showSectionSelector && (
                            <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10 min-w-max max-h-64 overflow-y-auto">
                              {/* Select All Option */}
                              <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700">
                                <input
                                  type="checkbox"
                                  checked={selectedSectionIds.length === filteredSectionStats.length && filteredSectionStats.length > 0}
                                  onChange={handleSelectAllSections}
                                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                                />
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">Select All</span>
                              </label>

                              {/* Section Checkboxes */}
                              {filteredSectionStats.map((stat) => {
                                const selected = selectedSectionIds.includes(stat.id);
                                return (
                                  <label
                                    key={stat.id}
                                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-0 text-sm"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() => toggleSectionSelection(stat.id)}
                                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                                    />
                                    <span className="text-gray-900 dark:text-gray-300 truncate">{stat.title}</span>
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
                          <span className="text-gray-600 dark:text-gray-400">{complianceLabels.yes}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-red-500 rounded"></div>
                          <span className="text-gray-600 dark:text-gray-400">{complianceLabels.no}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded"></div>
                          <span className="text-gray-600 dark:text-gray-400">{complianceLabels.na}</span>
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
                            <span className="text-gray-700 dark:text-gray-300">Add Weight</span>
                          </label>
                        )}

                        {/* Show Weightage Toggle */}
                        {totalWeightage > 0 && (
                          <button
                            onClick={() => setShowWeightageColumns(!showWeightageColumns)}
                            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                              showWeightageColumns
                                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-700'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                          >
                            {showWeightageColumns ? 'Hide' : 'Show'} Weight
                          </button>
                        )}

                        {/* Edit Weightage Button */}
                        {showWeightageColumns && !redistributionMode && (
                          <button
                            onClick={() => {
                              setRedistributionMode(true);
                              const initialValues: Record<string, string> = {};
                              sectionSummaryRows.forEach(row => {
                                initialValues[row.id] = row.weightage.toString();
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
                                <th className="text-center px-3 py-3">{complianceLabels.yes}</th>
                                <th className="text-center px-3 py-3">{complianceLabels.no}</th>
                                <th className="text-center px-3 py-3">{complianceLabels.na}</th>

                                {/* Conditionally show weightage columns */}
                                {showWeightageColumns && (
                                  <>
                                    <th className="text-center px-3 py-3">W</th>
                                    <th className="text-center px-3 py-3">Y×W</th>
                                    <th className="text-center px-3 py-3">N×W</th>
                                    <th className="text-center px-3 py-3">NA×W</th>
                                  </>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {sectionSummaryRows.map((row, index) => {
                                const rowBgColor = index % 2 === 0
                                  ? "bg-white dark:bg-gray-900"
                                  : "bg-gray-50 dark:bg-gray-800/50";

                                const generateTableBarChart = (yesPercent: number, noPercent: number, naPercent: number) => {
                                  const totalWidth = 160;
                                  const yesWidth = (yesPercent / 100) * totalWidth;
                                  const noWidth = (noPercent / 100) * totalWidth;
                                  const naWidth = (naPercent / 100) * totalWidth;

                                  return (
                                    <div className="relative" style={{ width: `${totalWidth}px`, height: "20px" }}>
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
                                              <span className="text-xs font-bold text-white" style={{ textShadow: '0 0 2px rgba(0,0,0,0.5)' }}>
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
                                          style={{ left: `${yesWidth}px`, width: `${noWidth}px` }}
                                        >
                                          {noPercent >= 10 && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                              <span className="text-xs font-bold text-white" style={{ textShadow: '0 0 2px rgba(0,0,0,0.5)' }}>
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
                                          style={{ left: `${yesWidth + noWidth}px`, width: `${naWidth}px` }}
                                        >
                                          {naPercent >= 10 && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                              <span className="text-xs font-bold text-white" style={{ textShadow: '0 0 2px rgba(0,0,0,0.5)' }}>
                                                {naPercent.toFixed(0)}%
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* Fallback labels for small segments */}
                                      {yesPercent > 0 && yesPercent < 10 && (
                                        <div className="absolute" style={{ left: '2px', top: '1px' }}>
                                          <span className="text-[9px] font-bold text-green-700 bg-white/80 px-0.5 rounded">
                                            {yesPercent.toFixed(0)}%
                                          </span>
                                        </div>
                                      )}
                                      {noPercent > 0 && noPercent < 10 && (
                                        <div className="absolute" style={{ left: `${yesWidth + 2}px`, top: '1px' }}>
                                          <span className="text-[9px] font-bold text-red-700 bg-white/80 px-0.5 rounded">
                                            {noPercent.toFixed(0)}%
                                          </span>
                                        </div>
                                      )}
                                      {naPercent > 0 && naPercent < 10 && (
                                        <div className="absolute" style={{ left: `${yesWidth + noWidth + 2}px`, top: '1px' }}>
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
                                        setTimeout(() => setAutoOpenSectionId(row.id), 10);
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
                                            setTimeout(() => setAutoOpenSectionId(row.id), 10);
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
                                        {row.yesCount} <span className="text-gray-600 dark:text-gray-400">({Number.isFinite(row.yesPercent) ? row.yesPercent.toFixed(0) : "0"}%)</span>
                                      </div>
                                    </td>

                                    {/* No Column */}
                                    <td className="text-center px-3 py-2.5">
                                      <div className="font-semibold text-red-600 dark:text-red-400 text-sm">
                                        {row.noCount} <span className="text-gray-600 dark:text-gray-400">({Number.isFinite(row.noPercent) ? row.noPercent.toFixed(0) : "0"}%)</span>
                                      </div>
                                    </td>

                                    {/* N/A Column */}
                                    <td className="text-center px-3 py-2.5">
                                      <div className="font-semibold text-slate-600 dark:text-slate-400 text-sm">
                                        {row.naCount} <span className="text-gray-600 dark:text-gray-400">({Number.isFinite(row.naPercent) ? row.naPercent.toFixed(0) : "0"}%)</span>
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
                                              value={tempWeightageValues[row.id] || row.weightage.toString()}
                                              onChange={(e) => {
                                                const newValue = e.target.value;
                                                const oldValue = parseFloat(tempWeightageValues[row.id] || row.weightage.toString()) || 0;
                                                const newNumericValue = parseFloat(newValue) || 0;
                                                const updatedTempValues = {
                                                  ...tempWeightageValues,
                                                  [row.id]: newValue
                                                };
                                                setTempWeightageValues(updatedTempValues);
                                                const total = Object.values(updatedTempValues).reduce((sum, val) => {
                                                  return sum + (parseFloat(val) || 0);
                                                }, 0);
                                                setWeightageBalance(100 - total);
                                              }}
                                              className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded text-center dark:bg-gray-700 dark:text-gray-100"
                                            />
                                          ) : (
                                            <span className="font-semibold text-indigo-600 dark:text-indigo-400 text-sm">
                                              {Number.isFinite(row.weightage) ? row.weightage.toFixed(1) : "0.0"}%
                                            </span>
                                          )}
                                        </td>

                                        {/* Yes × Weightage */}
                                        <td className="text-center px-3 py-2.5">
                                          <span className="font-semibold text-green-700 dark:text-green-300 text-sm">
                                            {Number.isFinite(row.yesWeighted) ? row.yesWeighted.toFixed(1) : "0.0"}
                                          </span>
                                        </td>

                                        {/* No × Weightage */}
                                        <td className="text-center px-3 py-2.5">
                                          <span className="font-semibold text-red-700 dark:text-red-300 text-sm">
                                            {Number.isFinite(row.noWeighted) ? row.noWeighted.toFixed(1) : "0.0"}
                                          </span>
                                        </td>

                                        {/* N/A × Weightage */}
                                        <td className="text-center px-3 py-2.5">
                                          <span className="font-semibold text-slate-700 dark:text-slate-400 text-sm">
                                            {Number.isFinite(row.naWeighted) ? row.naWeighted.toFixed(1) : "0.0"}
                                          </span>
                                        </td>
                                      </>
                                    )}
                                    {/* Batch Edit Controls - Only show when in addWeightMode */}
                                    {addWeightMode && editingAllWeightages && showWeightageColumns && (
                                      <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <h4 className="font-medium text-gray-900 dark:text-white">Batch Weightage Edit</h4>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Total: {totalWeightage.toFixed(1)}% / 100%</p>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={() => {
                                                // Distribute remaining weightage evenly
                                                const remaining = 100 - totalWeightage;
                                                const perSection = remaining / sectionSummaryRows.length;

                                                // Update all sections
                                                sectionSummaryRows.forEach(row => {
                                                  const newWeightage = (row.weightage + perSection).toFixed(1);
                                                  // You would update your weightageValues state here
                                                });
                                              }}
                                              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                            >
                                              Distribute Evenly
                                            </button>
                                            <button
                                              onClick={() => {
                                                setAddWeightMode(false);
                                                setEditingAllWeightages(false);
                                                if (totalWeightage === 0) {
                                                  setShowWeightageColumns(false);
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
                                  {summaryTotals.yesCount} ({summaryTotals.total > 0 ? ((summaryTotals.yesCount / summaryTotals.total) * 100).toFixed(0) : 0}%)
                                </td>
                                <td className="text-center px-3 py-2.5 text-red-600 dark:text-red-400 font-bold">
                                  {summaryTotals.noCount} ({summaryTotals.total > 0 ? ((summaryTotals.noCount / summaryTotals.total) * 100).toFixed(0) : 0}%)
                                </td>
                                <td className="text-center px-3 py-2.5 text-slate-600 dark:text-slate-400 font-bold">
                                  {summaryTotals.naCount} ({summaryTotals.total > 0 ? ((summaryTotals.naCount / summaryTotals.total) * 100).toFixed(0) : 0}%)
                                </td>
                                {showWeightageColumns && (
                                  <>
                                    <td className="text-center px-3 py-2.5">
                                      <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full font-bold ${redistributionMode ?
                                        (Math.abs(weightageBalance) < 0.1 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400') :
                                        (Math.abs(summaryTotals.weightage - 100) < 0.1 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400')
                                        }`}>
                                        {redistributionMode ? `${weightageBalance.toFixed(1)}%` : `${summaryTotals.weightage.toFixed(1)}%`}
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
                                  <td colSpan={showWeightageColumns ? 9 : 5} className="px-6 py-4">
                                    <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                                      {/* Status Message */}
                                      <div className="flex items-center gap-2">
                                        <span className={`text-sm font-medium ${Math.abs(weightageBalance) < 0.1 ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"}`}>
                                          {Math.abs(weightageBalance) < 0.1 ?
                                            '✓ Ready to save' :
                                            `Adjust by ${Math.abs(weightageBalance).toFixed(1)}% to reach 100%`}
                                        </span>
                                      </div>

                                      {/* Action Buttons */}
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => {
                                            const originalValues: Record<string, string> = {};
                                            sectionSummaryRows.forEach(row => {
                                              originalValues[row.id] = row.weightage.toString();
                                            });
                                            setTempWeightageValues(originalValues);
                                            setWeightageBalance(0);
                                          }}
                                          className="px-3 py-1.5 text-xs bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-1"
                                          title="Reset to original values"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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
                                            if (Math.abs(weightageBalance) >= 0.1) {
                                              console.error(`Cannot save: Balance must be 0%. Current: ${weightageBalance.toFixed(1)}%`);
                                              return;
                                            }

                                            setSavingWeightage(true);
                                            try {
                                              const formId = form?._id || form?.id;
                                              if (!formId) throw new Error("Form ID not found");

                                              const updatedSections = form?.sections?.map((section: any) => {
                                                const row = sectionSummaryRows.find(r => r.id === section.id);
                                                if (row && tempWeightageValues[row.id] !== undefined) {
                                                  return {
                                                    ...section,
                                                    weightage: parseFloat(tempWeightageValues[row.id]) || 0
                                                  };
                                                }
                                                return section;
                                              }) || [];

                                              const formDataToUpdate = { ...form, sections: updatedSections };
                                              delete formDataToUpdate._id;
                                              delete formDataToUpdate.__v;
                                              delete formDataToUpdate.createdAt;
                                              delete formDataToUpdate.updatedAt;

                                              await apiClient.updateForm(formId, formDataToUpdate);

                                              setForm({ ...form, sections: updatedSections });
                                              setRedistributionMode(false);
                                              setTempWeightageValues({});
                                              setWeightageBalance(0);
                                            } catch (error) {
                                              console.error("Failed to save weightages:", error);
                                            } finally {
                                              setSavingWeightage(false);
                                            }
                                          }}
                                          disabled={Math.abs(weightageBalance) >= 0.1 || savingWeightage}
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
                                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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
                                <span className="text-xs text-gray-600 dark:text-gray-400">Yes</span>
                                <div className="w-2 h-2 bg-red-500 rounded-full ml-2"></div>
                                <span className="text-xs text-gray-600 dark:text-gray-400">No</span>
                                <div className="w-2 h-2 bg-gray-400 rounded-full ml-2"></div>
                                <span className="text-xs text-gray-600 dark:text-gray-400">N/A</span>
                              </div>
                            </div>

                            {/* Radar Chart Container */}
                            <div className="h-96">
                              {/* Prepare data for radar chart */}
                              {(() => {
                                // Prepare radar chart data
                                const radarChartData = {
                                  labels: visibleSectionStats.map(stat =>
                                    stat.title.length > 15 ? stat.title.substring(0, 15) + '...' : stat.title
                                  ),

                                  datasets: [
                                    {
                                      label: 'Yes %',
                                      data: visibleSectionStats.map(stat =>
                                        stat.total > 0 ? (stat.yes / stat.total) * 100 : 0
                                      ),
                                      backgroundColor: 'rgba(34, 197, 94, 0.2)',
                                      borderColor: 'rgba(34, 197, 94, 1)',
                                      borderWidth: 2,
                                      pointBackgroundColor: 'rgba(34, 197, 94, 1)',
                                      pointBorderColor: '#fff',
                                      pointHoverBackgroundColor: '#fff',
                                      pointHoverBorderColor: 'rgba(34, 197, 94, 1)',
                                    },
                                    {
                                      label: 'No %',
                                      data: visibleSectionStats.map(stat =>
                                        stat.total > 0 ? (stat.no / stat.total) * 100 : 0
                                      ),
                                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                      borderColor: 'rgba(239, 68, 68, 1)',
                                      borderWidth: 2,
                                      pointBackgroundColor: 'rgba(239, 68, 68, 1)',
                                      pointBorderColor: '#fff',
                                      pointHoverBackgroundColor: '#fff',
                                      pointHoverBorderColor: 'rgba(239, 68, 68, 1)',
                                    },
                                    {
                                      label: 'N/A %',
                                      data: visibleSectionStats.map(stat =>
                                        stat.total > 0 ? (stat.na / stat.total) * 100 : 0
                                      ),
                                      backgroundColor: 'rgba(156, 163, 175, 0.2)',
                                      borderColor: 'rgba(156, 163, 175, 1)',
                                      borderWidth: 2,
                                      pointBackgroundColor: 'rgba(156, 163, 175, 1)',
                                      pointBorderColor: '#fff',
                                      pointHoverBackgroundColor: '#fff',
                                      pointHoverBorderColor: 'rgba(156, 163, 175, 1)',
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
                                        color: document.documentElement.classList.contains("dark")
                                          ? 'rgba(147, 197, 253, 0.4)'
                                          : 'rgba(59, 130, 246, 0.4)',
                                        lineWidth: 1.5,
                                      },
                                      grid: {
                                        color: document.documentElement.classList.contains("dark")
                                          ? 'rgba(147, 197, 253, 0.3)'
                                          : 'rgba(59, 130, 246, 0.3)',
                                        lineWidth: 1.5,
                                      },
                                      pointLabels: {
                                        font: {
                                          size: 10,
                                        },
                                        color: document.documentElement.classList.contains("dark")
                                          ? "#e5e7eb"
                                          : "#374151",
                                      },
                                      ticks: {
                                        backdropColor: 'transparent',
                                        color: document.documentElement.classList.contains("dark")
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
                                      display: false
                                    },
                                    legend: {
                                      position: 'bottom',
                                      labels: {
                                        color: document.documentElement.classList.contains("dark")
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
                                        }
                                      }
                                    }
                                  },
                                };

                                return (
                                  <Radar data={radarChartData} options={radarOptions} />
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
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">View Type:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTableViewType("question")}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      tableViewType === "question"
                        ? "bg-indigo-600 text-white shadow-md"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-300 hover:bg-gray-300"
                    }`}
                  >
                    Question Based
                  </button>
                  <button
                    onClick={() => setTableViewType("section")}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      tableViewType === "section"
                        ? "bg-indigo-600 text-white shadow-md"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-300 hover:bg-gray-300"
                    }`}
                  >
                    Section Based
                  </button>
                </div>
              </div>

              {/* Question Based Table - All Questions from All Sections */}
              {tableViewType === "question" && form?.sections && form.sections.length > 0 && (
                <div className="card p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-600" />
                      All Questions Analytics - Table View
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Showing all questions from all sections including follow-ups</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-gray-700 dark:to-gray-600 border-b-2 border-indigo-200 dark:border-indigo-700">
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white border-r border-indigo-200 dark:border-indigo-700">Question</th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white border-r border-indigo-200 dark:border-indigo-700">Total Responses</th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white border-r border-indigo-200 dark:border-indigo-700">{complianceLabels.yes}</th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white border-r border-indigo-200 dark:border-indigo-700">{complianceLabels.no}</th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white border-r border-indigo-200 dark:border-indigo-700">{complianceLabels.na}</th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white">Yes %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {form.sections.map((section: Section, sectionIdx: number) => {
                          const allQuestionsInSection = section.questions || [];
                          
                          return (
                            <React.Fragment key={`section-${section.id}`}>
                              <tr className="bg-indigo-100 dark:bg-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40">
                                <td colSpan={6} className="px-6 py-4 text-center text-sm font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wide">
                                  {section.title}
                                </td>
                              </tr>
                              {allQuestionsInSection.map((question: any, qIdx: number) => {
                                const questionResponses = filteredResponses.filter((r) => r.answers && r.answers[question.id]);
                                const yesCount = questionResponses.filter((r) => {
                                  const answer = String(r.answers[question.id]).toLowerCase().trim();
                                  return answer.includes("yes") || answer === "y";
                                }).length;
                                const noCount = questionResponses.filter((r) => {
                                  const answer = String(r.answers[question.id]).toLowerCase().trim();
                                  return answer.includes("no") || answer === "n";
                                }).length;
                                const naCount = questionResponses.filter((r) => {
                                  const answer = String(r.answers[question.id]).toLowerCase().trim();
                                  return answer.includes("na") || answer.includes("n/a") || answer.includes("not applicable");
                                }).length;
                                const total = questionResponses.length;
                                const yesPercentage = total > 0 ? ((yesCount / total) * 100).toFixed(1) : "0.0";
                                
                                const isFollowUp = question.parentId || question.showWhen?.questionId;

                                return (
                                  <tr key={question.id} className={`hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors ${
                                    isFollowUp 
                                      ? "bg-purple-50 dark:bg-purple-900/20" 
                                      : "bg-white dark:bg-gray-800"
                                  }`}>
                                    <td className={`px-6 py-4 text-sm text-gray-900 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 font-medium max-w-sm ${
                                      isFollowUp ? "pl-12" : ""
                                    }`}>
                                      <div className="truncate" title={question.text || "Unnamed Question"}>
                                        {question.text || "Unnamed Question"}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">
                                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300 px-3 py-1 rounded-full text-xs">{total}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center text-sm text-gray-900 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 font-medium">
                                      <span className="bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-300 px-3 py-1 rounded-full text-xs">{yesCount}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center text-sm text-gray-900 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 font-medium">
                                      <span className="bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-300 px-3 py-1 rounded-full text-xs">{noCount}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center text-sm text-gray-900 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 font-medium">
                                      <span className="bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-gray-200 px-3 py-1 rounded-full text-xs">{naCount}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center text-sm font-semibold text-indigo-600 dark:text-indigo-400">{yesPercentage}%</td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Section Based Table */}
              {tableViewType === "section" && filteredSectionStats.length > 0 && (
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
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white border-r border-indigo-200 dark:border-indigo-700">Section Name</th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white border-r border-indigo-200 dark:border-indigo-700">Total</th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white border-r border-indigo-200 dark:border-indigo-700">{complianceLabels.yes}</th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white border-r border-indigo-200 dark:border-indigo-700">{complianceLabels.no}</th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white">{complianceLabels.na}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredSectionStats.map((stat: SectionPerformanceStat, index: number) => {
                          const yesPercentage = stat.total > 0 ? ((stat.yes / stat.total) * 100).toFixed(1) : "0.0";
                          const noPercentage = stat.total > 0 ? ((stat.no / stat.total) * 100).toFixed(1) : "0.0";
                          const naPercentage = stat.total > 0 ? ((stat.na / stat.total) * 100).toFixed(1) : "0.0";

                          return (
                            <tr key={stat.id} className={`${index % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50 dark:bg-gray-750"} hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors`}>
                              <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 font-medium">
                                {stat.title}
                              </td>
                              <td className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">
                                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300 px-3 py-1 rounded-full text-xs">{stat.total}</span>
                              </td>
                              <td className="px-6 py-4 text-center text-sm text-gray-900 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 font-medium">
                                <span className="bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-300 px-3 py-1 rounded-full text-xs">{stat.yes} ({yesPercentage}%)</span>
                              </td>
                              <td className="px-6 py-4 text-center text-sm text-gray-900 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 font-medium">
                                <span className="bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-300 px-3 py-1 rounded-full text-xs">{stat.no} ({noPercentage}%)</span>
                              </td>
                              <td className="px-6 py-4 text-center text-sm text-gray-900 dark:text-gray-300 font-medium">
                                <span className="bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-gray-200 px-3 py-1 rounded-full text-xs">{stat.na} ({naPercentage}%)</span>
                              </td>
                            </tr>
                          );
                        })}
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
                    <p className="text-sm text-gray-600 dark:text-gray-400">Viewing {filteredResponses.length} responses</p>
                  </div>
                  <div className="flex gap-2 items-center relative">
                    <button
                      onClick={() => setShowResponsesFilter(!showResponsesFilter)}
                      className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 ${showResponsesFilter ? 'ring-2 ring-indigo-400 ring-offset-2 dark:ring-offset-gray-900' : ''}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                      Filter Sections ({selectedResponsesSectionIds.length}/{form?.sections?.length})
                    </button>
                    <button
                      onClick={() => handleExportToExcel()}
                      disabled={selectedResponsesSectionIds.length === 0}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download as Excel
                    </button>

                    {showResponsesFilter && (
                      <div className="absolute top-full left-0 mt-2 p-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 min-w-80 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="sticky top-0 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                              <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                              </svg>
                              Select Sections
                            </h4>
                            <button
                              onClick={() => setShowResponsesFilter(false)}
                              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                            >
                              <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSelectedResponsesSectionIds(form?.sections?.map((s: Section) => s.id) || [])}
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
                            form.sections.map((section: Section) => (
                              <label key={section.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer transition-colors group">
                                <div className="relative flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedResponsesSectionIds.includes(section.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedResponsesSectionIds([...selectedResponsesSectionIds, section.id]);
                                      } else {
                                        setSelectedResponsesSectionIds(selectedResponsesSectionIds.filter(id => id !== section.id));
                                      }
                                    }}
                                    className="w-5 h-5 text-indigo-600 border-gray-300 dark:border-gray-600 rounded cursor-pointer accent-indigo-600"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium text-gray-900 dark:text-gray-200 block truncate">{section.title}</span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">{section.questions?.length || 0} questions</span>
                                </div>
                                <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                              </label>
                            ))
                          ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No sections available</p>
                          )}
                        </div>
                        
                        <div className="sticky bottom-0 px-4 py-3 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                            {selectedResponsesSectionIds.length} of {form?.sections?.length || 0} sections selected
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {selectedResponsesSectionIds.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="text-sm border-collapse">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-indigo-50 dark:bg-indigo-900/20">
                          <td className="px-6 py-3"></td>
                          {form?.sections?.map((section: Section) => {
                            const sectionQuestionsCount = section.questions?.length || 0;
                            return (
                              selectedResponsesSectionIds.includes(section.id) && (
                                <td key={`header-${section.id}`} colSpan={sectionQuestionsCount} className="px-6 py-3 text-center font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
                                  {section.title}
                                </td>
                              )
                            );
                          })}
                        </tr>
                        
                        <tr className="bg-gray-100 dark:bg-gray-800">
                          <th className="sticky left-0 z-20 text-left px-6 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-700 min-w-32 whitespace-nowrap bg-gray-100 dark:bg-gray-800">Actions</th>
                          <th className="text-left px-6 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-700 min-w-40 whitespace-nowrap">Timestamp</th>
                          {form?.sections?.map((section: Section) => (
                            selectedResponsesSectionIds.includes(section.id) && (
                              section.questions?.map((q: any) => {
                                const isFollowUp = q.parentId || q.showWhen?.questionId;
                                const columnOptions = getUniqueColumnValues(q.id, responses);
                                
                                return (
                                  <th key={q.id} className={`text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider border border-gray-200 dark:border-gray-700 max-w-xs ${isFollowUp ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="line-clamp-2 overflow-hidden text-ellipsis flex-1">{q.text || "Question"}</div>
                                      <TableColumnFilter
                                        columnId={q.id}
                                        title={q.text || "Question"}
                                        options={columnOptions}
                                        selectedValues={columnFilters[q.id] || null}
                                        onFilterChange={(columnId, values) => {
                                          setColumnFilters(prev => ({
                                            ...prev,
                                            [columnId]: values
                                          }));
                                        }}
                                      />
                                    </div>
                                  </th>
                                );
                              })
                            )
                          ))}
                        </tr>
                      </thead>
                      
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredResponses.length > 0 ? (
                          filteredResponses.map((response: Response, idx: number) => (
                            <tr key={response.id} className={`${editingResponseId === response.id ? 'bg-blue-50 dark:bg-blue-900/20' : idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
                              <td className={`px-6 py-3 text-sm text-gray-600 dark:text-gray-400 font-medium border border-gray-200 dark:border-gray-700 whitespace-nowrap sticky left-0 z-20 ${editingResponseId === response.id ? 'bg-blue-50 dark:bg-blue-900/20' : idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
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
                                      <button
                                        onClick={() => handleEditStart(response)}
                                        title="Edit Response"
                                        className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          setDeletingResponseId(response.id);
                                          setShowDeleteConfirm(true);
                                        }}
                                        title="Delete Response"
                                        className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
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
                                      </div>
                                    </>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400 font-medium border border-gray-200 dark:border-gray-700 min-w-40 whitespace-nowrap">
                                {getResponseTimestamp(response) ? new Date(getResponseTimestamp(response)!).toLocaleString() : "-"}
                              </td>
                              {form?.sections?.map((section: Section) => (
                                selectedResponsesSectionIds.includes(section.id) && (
                                  section.questions?.map((q: any) => {
                                    const isFollowUp = q.parentId || q.showWhen?.questionId;
                                    const isEditing = editingResponseId === response.id;
                                    return (
                                      <td key={`${response.id}-${q.id}`} className={`px-6 py-3 text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 min-w-64 break-words ${isFollowUp ? 'bg-purple-50 dark:bg-purple-900/10' : ''}`}>
                                        {isEditing ? (
                                          <input
                                            type="text"
                                            value={editFormData[q.id] || ""}
                                            onChange={(e) => setEditFormData({ ...editFormData, [q.id]: e.target.value })}
                                            className="w-full px-2 py-1 border border-blue-400 dark:border-blue-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Enter answer"
                                          />
                                        ) : (
                                          <div>
                                            {response.answers?.[q.id] ? (
                                              isImageUrl(String(response.answers[q.id])) ? (
                                                <div className="w-32 h-32 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 hover:shadow-lg transition-shadow">
                                                  <img
                                                    src={String(response.answers[q.id])}
                                                    alt={q.text || "Image"}
                                                    className="w-full h-full object-cover cursor-pointer"
                                                    onClick={() => window.open(String(response.answers[q.id]), '_blank')}
                                                    title="Click to open in new tab"
                                                  />
                                                </div>
                                              ) : (
                                                <span title={String(response.answers[q.id])}>
                                                  {String(response.answers[q.id])}
                                                </span>
                                              )
                                            ) : (
                                              <span>-</span>
                                            )}
                                          </div>
                                        )}
                                      </td>
                                    );
                                  })
                                )
                              ))}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={1 + (form?.sections?.reduce((acc: number, sec: Section) => (selectedResponsesSectionIds.includes(sec.id) ? acc + (sec.questions?.length || 0) : acc), 0) || 0)} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                              No responses yet
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
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
            (q: any) => !q.parentId && !q.showWhen?.questionId
          ) || []
        }
        responses={responses}
        onApplyFilters={(filters) => {
          const { dates, locations, ...questionFilters } = filters as any;
          setCascadingFilters(questionFilters);
          if (dates) {
            setDateFilter({
              type: dates.startDate || dates.endDate ? 'range' : 'all',
              startDate: dates.startDate || '',
              endDate: dates.endDate || '',
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
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Response Details</h2>
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
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Form</p>
                  <p className="text-gray-900 dark:text-white">{selectedFormForModal?.title || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Submitted</p>
                  <p className="text-gray-900 dark:text-white">
                    {getResponseTimestamp(selectedResponse) 
                      ? new Date(getResponseTimestamp(selectedResponse)!).toLocaleString() 
                      : "N/A"}
                  </p>
                </div>
              </div>

              {selectedFormForModal?.sections?.map((section: Section) => (
                <div key={section.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-4">{section.title}</h3>
                  <div className="space-y-4">
                    {section.questions?.map((question: any) => {
                      const answer = selectedResponse.answers?.[question.id];
                      return (
                        <div key={question.id} className="border-l-4 border-blue-300 dark:border-blue-700 pl-4">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{question.text}</p>
                          <div className="text-gray-900 dark:text-gray-100">
                            {hasAnswerValue(answer) ? renderAnswerDisplay(answer, question) : <span className="text-gray-400">No response</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {selectedFormForModal?.followUpQuestions?.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-4">Follow-up Questions</h3>
                  <div className="space-y-4">
                    {selectedFormForModal.followUpQuestions.map((question: any) => {
                      const answer = selectedResponse.answers?.[question.id];
                      return (
                        <div key={question.id} className="border-l-4 border-purple-300 dark:border-purple-700 pl-4">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{question.text}</p>
                          <div className="text-gray-900 dark:text-gray-100">
                            {hasAnswerValue(answer) ? renderAnswerDisplay(answer, question) : <span className="text-gray-400">No response</span>}
                          </div>
                        </div>
                      );
                    })}
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

      {/* Old Modal Code - Kept for reference, will be removed after testing */}
      {false && showFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl h-[75vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-300 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Filters</h2>
              <button
                onClick={() => {
                  setShowFilterModal(false);
                }}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden gap-0">
              {/* Left - Questions Dropdown */}
              <div className="w-72 border-r border-gray-300 p-4 flex flex-col">
                <div className="relative flex-1 flex flex-col">
                  <button
                    onClick={() => setShowSectionDropdown(!showSectionDropdown)}
                    className="w-full p-2.5 border-2 border-gray-400 bg-white text-gray-900 text-xs font-medium rounded flex items-center justify-between hover:bg-gray-50"
                  >
                    <span className="truncate">
                      {selectedFilterQuestion ? selectedFilterQuestion.text?.substring(0, 30) + (selectedFilterQuestion.text?.length > 30 ? '...' : '') : 'Select Question'}
                    </span>
                    <svg className={`w-4 h-4 transition-transform ${showSectionDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </button>

                  {showSectionDropdown && (
                    <div className="absolute top-12 left-0 right-0 bg-white border-2 border-gray-400 rounded shadow-lg z-10 max-h-64 overflow-y-auto">
                      {form?.sections?.[0]?.questions
                        ?.filter((q: any) => !q.parentId && !q.showWhen?.questionId)
                        .map((q: any) => (
                          <label
                            key={q.id}
                            className="flex items-start gap-2 cursor-pointer hover:bg-blue-50 p-2.5 border-b border-gray-200 last:border-b-0 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedFilterQuestion?.id === q.id}
                              onChange={() => {
                                setSelectedFilterQuestion(q);
                                const existingFilter = activeFilters.find(f => f.questionId === q.id);
                                if (existingFilter) {
                                  setSelectedAnswers(existingFilter.answers);
                                } else {
                                  setSelectedAnswers([]);
                                }
                                setShowSectionDropdown(false);
                              }}
                              className="w-4 h-4 rounded border-gray-400 cursor-pointer mt-0.5 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-900 line-clamp-2">{q.text || 'Unnamed'}</p>
                            </div>
                          </label>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Middle - Answer Dropdown */}
              <div className="w-72 border-r border-gray-300 p-4 flex flex-col">
                {selectedFilterQuestion ? (
                  <>
                    <div className="relative flex-1 flex flex-col">
                      <button
                        onClick={() => setShowAnswerDropdown(!showAnswerDropdown)}
                        className="w-full p-2.5 border-2 border-gray-400 bg-white text-gray-900 text-xs font-medium rounded flex items-center justify-between hover:bg-gray-50"
                      >
                        <span className="truncate">
                          {selectedAnswers.length > 0 ? `${selectedAnswers.length} selected` : 'Select Answers'}
                        </span>
                        <svg className={`w-4 h-4 transition-transform ${showAnswerDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                      </button>

                      {showAnswerDropdown && (
                        <div className="absolute top-12 left-0 right-0 bg-white border-2 border-gray-400 rounded shadow-lg z-10 max-h-64 overflow-y-auto">
                          {(() => {
                            const otherFilters = activeFilters.filter(f => f.questionId !== selectedFilterQuestion.id);
                            const relevantResponses = otherFilters.length === 0 ? responses : responses.filter(r => 
                              otherFilters.every(f => {
                                const answer = r.answers[f.questionId];
                                if (!answer) return false;
                                if (Array.isArray(answer)) {
                                  return answer.some(item => f.answers.some(selectedAnswer => String(item).toLowerCase() === selectedAnswer.toLowerCase()));
                                }
                                return f.answers.some(selectedAnswer => String(answer).toLowerCase() === selectedAnswer.toLowerCase());
                              })
                            );

                            return Array.from(
                              new Set(
                                relevantResponses
                                  .map(r => r.answers?.[selectedFilterQuestion.id])
                                  .filter(a => a !== null && a !== undefined && a !== '')
                                  .map(a => String(a).trim())
                              )
                            )
                              .sort()
                              .map((answer) => {
                                const answerCount = relevantResponses.filter(r => {
                                  const ans = r.answers?.[selectedFilterQuestion.id];
                                  if (Array.isArray(ans)) {
                                    return ans.some(item => String(item).toLowerCase() === answer.toLowerCase());
                                  }
                                  return String(ans).toLowerCase() === answer.toLowerCase();
                                }).length;
                                
                                const isSelected = selectedAnswers.includes(answer);
                                
                                return (
                                  <label key={answer} className="flex items-start gap-2 cursor-pointer hover:bg-blue-50 p-2.5 border-b border-gray-200 last:border-b-0 transition-colors">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        let updatedAnswers;
                                        if (e.target.checked) {
                                          updatedAnswers = [...selectedAnswers, answer];
                                        } else {
                                          updatedAnswers = selectedAnswers.filter(a => a !== answer);
                                        }
                                        setSelectedAnswers(updatedAnswers);
                                        
                                        setActiveFilters(prev => {
                                          if (updatedAnswers.length === 0) {
                                            return prev.filter(f => f.questionId !== selectedFilterQuestion.id);
                                          }
                                          const newFilters = prev.filter(f => f.questionId !== selectedFilterQuestion.id);
                                          return [...newFilters, {
                                            questionId: selectedFilterQuestion.id,
                                            answers: updatedAnswers,
                                            questionText: selectedFilterQuestion.text
                                          }];
                                        });
                                      }}
                                      className="w-4 h-4 rounded border-gray-400 cursor-pointer mt-0.5 flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs text-gray-900 truncate">{answer}</p>
                                      <p className="text-xs text-gray-500">{answerCount}</p>
                                    </div>
                                  </label>
                                );
                              });
                          })()}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-gray-600 text-center">Not Selected</p>
                  </div>
                )}
              </div>

              {/* Right - Common Filters & Summary */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col bg-gray-50">
                <p className="text-sm font-bold text-gray-900 mb-3">Common Filters</p>
                
                {/* Date Range Dropdown */}
                <div className="mb-4 relative">
                  <button
                    onClick={() => setShowDateDropdown(!showDateDropdown)}
                    className="w-full p-2.5 border-2 border-gray-400 bg-white text-gray-900 text-xs font-medium rounded flex items-center justify-between hover:bg-gray-50"
                  >
                    <span className="truncate">
                      {dateFilter.type === 'all' ? 'All Time' : 
                       dateFilter.type === 'single' ? (dateFilter.startDate || 'Select Date') : 
                       (dateFilter.startDate && dateFilter.endDate ? `${dateFilter.startDate} - ${dateFilter.endDate}` : 'Select Range')}
                    </span>
                    <svg className={`w-4 h-4 transition-transform ${showDateDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </button>

                  {showDateDropdown && (
                    <div className="absolute top-12 left-0 right-0 bg-white border-2 border-gray-400 rounded shadow-lg z-10 overflow-hidden">
                      {/* All Time Option */}
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-blue-50 p-2.5 border-b border-gray-200 transition-colors">
                        <input
                          type="radio"
                          name="dateFilterType"
                          checked={dateFilter.type === 'all'}
                          onChange={() => setDateFilter({ ...dateFilter, type: 'all' })}
                          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-xs font-medium text-gray-900">All Time</span>
                      </label>

                      {/* Specific Date Option */}
                      <div className="border-b border-gray-200 last:border-b-0">
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-blue-50 p-2.5 transition-colors">
                          <input
                            type="radio"
                            name="dateFilterType"
                            checked={dateFilter.type === 'single'}
                            onChange={() => setDateFilter({ ...dateFilter, type: 'single' })}
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                          />
                          <span className="text-xs font-medium text-gray-900">Specific Date</span>
                        </label>
                        {dateFilter.type === 'single' && (
                          <div className="px-2.5 pb-2.5 pl-8">
                            <input
                              type="date"
                              value={dateFilter.startDate}
                              onChange={(e) => setDateFilter({ ...dateFilter, startDate: e.target.value })}
                              className="w-full p-2 border border-gray-400 bg-white text-gray-900 text-xs rounded"
                            />
                          </div>
                        )}
                      </div>

                      {/* Date Range Option */}
                      <div className="border-b border-gray-200 last:border-b-0">
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-blue-50 p-2.5 transition-colors">
                          <input
                            type="radio"
                            name="dateFilterType"
                            checked={dateFilter.type === 'range'}
                            onChange={() => setDateFilter({ ...dateFilter, type: 'range' })}
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                          />
                          <span className="text-xs font-medium text-gray-900">Date Range</span>
                        </label>
                        {dateFilter.type === 'range' && (
                          <div className="px-2.5 pb-2.5 pl-8 space-y-2">
                            <input
                              type="date"
                              value={dateFilter.startDate}
                              onChange={(e) => setDateFilter({ ...dateFilter, startDate: e.target.value })}
                              className="w-full p-2 border border-gray-400 bg-white text-gray-900 text-xs rounded"
                              placeholder="Start Date"
                            />
                            <input
                              type="date"
                              value={dateFilter.endDate}
                              onChange={(e) => setDateFilter({ ...dateFilter, endDate: e.target.value })}
                              className="w-full p-2 border border-gray-400 bg-white text-gray-900 text-xs rounded"
                              placeholder="End Date"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Locations Dropdown */}
                <div className="mb-4 relative">
                  <button
                    onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                    className="w-full p-2.5 border-2 border-gray-400 bg-white text-gray-900 text-xs font-medium rounded flex items-center justify-between hover:bg-gray-50"
                  >
                    <span className="truncate">
                      {locationFilter.length > 0 ? `${locationFilter.length} selected` : 'Select Locations'}
                    </span>
                    <svg className={`w-4 h-4 transition-transform ${showLocationDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </button>

                  {showLocationDropdown && (
                    <div className="absolute top-12 left-0 right-0 bg-white border-2 border-gray-400 rounded shadow-lg z-10 max-h-64 overflow-y-auto p-2">
                      {availableLocations.length > 0 ? (
                        availableLocations.map(loc => (
                          <label key={loc} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 rounded text-xs border-b border-gray-100 last:border-0">
                            <input
                              type="checkbox"
                              checked={locationFilter.includes(loc)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setLocationFilter([...locationFilter, loc]);
                                } else {
                                  setLocationFilter(locationFilter.filter(l => l !== loc));
                                }
                              }}
                              className="w-3.5 h-3.5 rounded border-gray-400 cursor-pointer"
                            />
                            <span className="text-gray-900 truncate" title={loc}>{loc}</span>
                          </label>
                        ))
                      ) : (
                        <p className="text-xs text-gray-500 italic p-2">No location data</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Applied Filters Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowAppliedFiltersDropdown(!showAppliedFiltersDropdown)}
                    className="w-full p-2.5 border-2 border-gray-400 bg-white text-gray-900 text-xs font-medium rounded flex items-center justify-between hover:bg-gray-50"
                  >
                    <span className="truncate">
                      Applied Filters ({activeFilters.length + (dateFilter.type !== 'all' ? 1 : 0) + (locationFilter.length > 0 ? 1 : 0)})
                    </span>
                    <svg className={`w-4 h-4 transition-transform ${showAppliedFiltersDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </button>

                  {showAppliedFiltersDropdown && (
                    <div className="absolute top-12 left-0 right-0 bg-white border-2 border-gray-400 rounded shadow-lg z-10 max-h-64 overflow-y-auto p-2">
                      <div className="space-y-1.5">
                        {activeFilters.map((filter, idx) => (
                          <div key={`${filter.questionId}-${idx}`} className="p-2 bg-white border border-gray-300 rounded text-xs">
                            <div className="flex justify-between items-start gap-1">
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-gray-900 line-clamp-2 text-[11px]">{filter.questionText}</p>
                                <p className="text-gray-600 mt-0.5 text-[11px]">{filter.answers.join(', ')}</p>
                              </div>
                              <button
                                onClick={() => {
                                  setActiveFilters(prev => prev.filter(f => f.questionId !== filter.questionId));
                                  if (selectedFilterQuestion?.id === filter.questionId) {
                                    setSelectedAnswers([]);
                                  }
                                }}
                                className="text-gray-600 hover:text-gray-900 flex-shrink-0"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))}
                        
                        {dateFilter.type !== 'all' && (
                          <div className="p-2 bg-white border border-gray-300 rounded text-xs">
                            <p className="font-bold text-gray-900 text-[11px]">Date</p>
                            <p className="text-gray-600 mt-0.5 text-[11px]">
                              {dateFilter.type === 'single' ? dateFilter.startDate : `${dateFilter.startDate} to ${dateFilter.endDate}`}
                            </p>
                          </div>
                        )}

                        {locationFilter.length > 0 && (
                          <div className="p-2 bg-white border border-gray-300 rounded text-xs">
                            <p className="font-bold text-gray-900 text-[11px]">Locations</p>
                            <p className="text-gray-600 mt-0.5 text-[11px]">{locationFilter.join(', ')}</p>
                          </div>
                        )}
                        
                        {activeFilters.length === 0 && dateFilter.type === 'all' && locationFilter.length === 0 && (
                          <p className="text-gray-500 italic text-[11px] text-center py-2">No filters applied</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-100 px-6 py-3 border-t border-gray-300 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  setActiveFilters([]);
                  setSelectedFilterQuestion(null);
                  setSelectedAnswers([]);
                  setSelectedQuestionId('');
                  setDateFilter({ type: 'all', startDate: '', endDate: '' });
                  setLocationFilter([]);
                  setShowSectionDropdown(false);
                  setShowAnswerDropdown(false);
                  setShowDateDropdown(false);
                  setShowLocationDropdown(false);
                  setShowAppliedFiltersDropdown(false);
                }}
                className="px-4 py-2 text-gray-900 bg-white border border-gray-400 hover:bg-gray-50 text-sm"
              >
                Clear All
              </button>
              <button
                onClick={() => {
                  setShowFilterModal(false);
                  setShowSectionDropdown(false);
                  setShowAnswerDropdown(false);
                  setShowDateDropdown(false);
                  setShowLocationDropdown(false);
                  setShowAppliedFiltersDropdown(false);
                }}
                className="px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 text-sm"
              >
                Done
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
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                    comparisonViewMode === "dashboard"
                      ? "text-white shadow-sm"
                      : "text-gray-900 dark:text-gray-100 hover:text-black dark:hover:text-white"
                  }`}
                  style={{ backgroundColor: comparisonViewMode === "dashboard" ? "#1e3a8a" : "transparent" }}
                >
                  <BarChart3 className="w-4 h-4" />
                  Dashboard
                </button>
                <button
                  onClick={() => setComparisonViewMode("responses")}
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                    comparisonViewMode === "responses"
                      ? "text-white shadow-sm"
                      : "text-gray-900 dark:text-gray-100 hover:text-black dark:hover:text-white"
                  }`}
                  style={{ backgroundColor: comparisonViewMode === "responses" ? "#1e3a8a" : "transparent" }}
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
                  const last5 = filteredResponses.filter(r => getResponseTimestamp(r)).sort((a, b) => {
                    const dateA = new Date(getResponseTimestamp(a)!).getTime();
                    const dateB = new Date(getResponseTimestamp(b)!).getTime();
                    return dateB - dateA;
                  }).slice(0, 5);

                  if (last5.length === 0) {
                    return (
                      <div className="col-span-full flex flex-col items-center justify-center min-h-64 py-12">
                        <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                        <p className="text-gray-600 dark:text-gray-400 font-medium">No responses to compare</p>
                      </div>
                    );
                  }

                  return last5.map((response, idx) => {
                    const sectionStats = getSectionYesNoStats(form, response.answers || {});
                    const filteredSectionStats = sectionStats.filter(
                      (stat) => stat.yes > 0 || stat.no > 0 || stat.na > 0 || stat.weightage > 0
                    );
                    
                    const totalQuestions = filteredSectionStats.reduce((sum, stat) => sum + stat.total, 0);
                    const totalYes = filteredSectionStats.reduce((sum, stat) => sum + stat.yes, 0);
                    const totalNo = filteredSectionStats.reduce((sum, stat) => sum + stat.no, 0);
                    const totalNA = filteredSectionStats.reduce((sum, stat) => sum + stat.na, 0);
                    const totalAnswered = totalYes + totalNo + totalNA;
                    
                    const overallScore = totalQuestions > 0 ? ((totalYes / totalQuestions) * 100).toFixed(1) : "0.0";
                    const responseRate = totalQuestions > 0 ? ((totalAnswered / totalQuestions) * 100).toFixed(1) : "0.0";
                    const yesPercent = totalAnswered > 0 ? ((totalYes / totalAnswered) * 100).toFixed(1) : "0.0";
                    const noPercent = totalAnswered > 0 ? ((totalNo / totalAnswered) * 100).toFixed(1) : "0.0";
                    const naPercent = totalAnswered > 0 ? ((totalNA / totalAnswered) * 100).toFixed(1) : "0.0";

                    return (
                      <div key={response.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-gray-800 flex flex-col h-full">
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                          <div className="flex flex-col items-center text-center">
                            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase mb-1">Submission #{idx + 1}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {getResponseTimestamp(response) 
                                ? new Date(getResponseTimestamp(response)!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                : "N/A"
                              }
                            </p>
                            <p className="text-2xl font-bold text-blue-900 dark:text-blue-300 mt-2">{overallScore}%</p>
                            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase mt-1">Overall Score</p>
                          </div>
                        </div>

                        <div className="p-4 space-y-3 flex-1">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded border border-indigo-200 dark:border-indigo-700 text-center">
                              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase">Sections</p>
                              <p className="text-xl font-bold text-indigo-900 dark:text-indigo-300">{filteredSectionStats.length}</p>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-200 dark:border-green-700 text-center">
                              <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase">Rate</p>
                              <p className="text-xl font-bold text-green-900 dark:text-green-300">{responseRate}%</p>
                            </div>
                            <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded border border-purple-200 dark:border-purple-700 text-center">
                              <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase">Questions</p>
                              <p className="text-xl font-bold text-purple-900 dark:text-purple-300">{totalQuestions}</p>
                            </div>
                          </div>

                          <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                            <p className="text-xs font-semibold text-gray-900 dark:text-white mb-2 text-center">Distribution</p>
                            <div className="space-y-1">
                              <div className="text-center p-2 bg-green-100/60 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-700">
                                <p className="text-xs font-semibold text-green-700 dark:text-green-400">Yes</p>
                                <p className="text-sm font-bold text-green-800 dark:text-green-300">{totalYes} ({yesPercent}%)</p>
                              </div>
                              <div className="text-center p-2 bg-red-100/60 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-700">
                                <p className="text-xs font-semibold text-red-700 dark:text-red-400">No</p>
                                <p className="text-sm font-bold text-red-800 dark:text-red-300">{totalNo} ({noPercent}%)</p>
                              </div>
                              <div className="text-center p-2 bg-yellow-100/60 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-700">
                                <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">N/A</p>
                                <p className="text-sm font-bold text-yellow-800 dark:text-yellow-300">{totalNA} ({naPercent}%)</p>
                              </div>
                            </div>
                          </div>

                          {filteredSectionStats.length > 0 && (
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                              <p className="text-xs font-semibold text-gray-900 dark:text-white mb-3">Sections</p>
                              <div className="space-y-4">
                                {filteredSectionStats.map((row) => {
                                  const total = row.yes + row.no + row.na;
                                  const yesPercent = total > 0 ? ((row.yes / total) * 100).toFixed(1) : 0;
                                  const noPercent = total > 0 ? ((row.no / total) * 100).toFixed(1) : 0;
                                  const naPercent = total > 0 ? ((row.na / total) * 100).toFixed(1) : 0;
                                  
                                  const chartData = {
                                    labels: [`Yes (${yesPercent}%)`, `No (${noPercent}%)`, `N/A (${naPercent}%)`],
                                    datasets: [
                                      {
                                        data: [row.yes, row.no, row.na],
                                        backgroundColor: ['#1e3a8a', '#3b82f6', '#93c5fd'],
                                        borderColor: ['#1e3a8a', '#3b82f6', '#93c5fd'],
                                        borderWidth: 2,
                                        borderRadius: 4
                                      }
                                    ]
                                  };
                                  
                                  return (
                                    <div key={row.id} className="p-3 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/40 dark:to-gray-800/40 rounded-lg border border-gray-200 dark:border-gray-600">
                                      <p className="font-semibold text-gray-900 dark:text-white text-[11px] mb-3">{row.title}</p>
                                      
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
                                                    display: false
                                                  },
                                                  tooltip: {
                                                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                                    titleColor: '#ffffff',
                                                    bodyColor: '#ffffff',
                                                    borderColor: '#ffffff',
                                                    borderWidth: 1,
                                                    callbacks: {
                                                      label: (context) => {
                                                        return `${context.label}: ${context.parsed}`;
                                                      }
                                                    }
                                                  },
                                                  datalabels: {
                                                    color: '#ffffff',
                                                    font: {
                                                      weight: 'bold',
                                                      size: 10
                                                    },
                                                    formatter: (value, context) => {
                                                      const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                                      const percentage = ((value / total) * 100).toFixed(0);
                                                      return `${percentage}%`;
                                                    }
                                                  }
                                                }
                                              }}
                                            />
                                          </div>
                                        </div>
                                        
                                        <div className="flex-1 flex flex-col justify-center gap-2 text-xs">
                                          <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#1e3a8a' }}></div>
                                            <span className="text-gray-700 dark:text-gray-300">Yes: <span className="font-bold">{row.yes}</span> ({yesPercent}%)</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3b82f6' }}></div>
                                            <span className="text-gray-700 dark:text-gray-300">No: <span className="font-bold">{row.no}</span> ({noPercent}%)</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#93c5fd' }}></div>
                                            <span className="text-gray-700 dark:text-gray-300">N/A: <span className="font-bold">{row.na}</span> ({naPercent}%)</span>
                                          </div>
                                          <div className="border-t border-gray-300 dark:border-gray-500 mt-2 pt-2">
                                            <p className="font-semibold text-gray-900 dark:text-white">Total: <span>{total}</span></p>
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
                              <p className="text-xs font-semibold text-gray-900 dark:text-white mb-1">Location</p>
                              <p className="text-xs text-gray-700 dark:text-gray-300 truncate">
                                {response.submissionMetadata.location.city || response.submissionMetadata.location.region || response.submissionMetadata.location.country || 'N/A'}
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
                    <p className="text-gray-600 dark:text-gray-400 font-medium">No responses to compare</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-indigo-50 dark:bg-indigo-900/20">
                          <th className="sticky left-0 z-20 text-left px-4 py-3 font-semibold text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 min-w-40 bg-indigo-50 dark:bg-indigo-900/20">
                            Question
                          </th>
                          {filteredResponses.filter(r => getResponseTimestamp(r)).sort((a, b) => {
                            const dateA = new Date(getResponseTimestamp(a)!).getTime();
                            const dateB = new Date(getResponseTimestamp(b)!).getTime();
                            return dateB - dateA;
                          }).slice(0, 5).map((response, idx) => (
                            <th key={response.id} className="text-center px-3 py-2 font-semibold text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 min-w-28 bg-gradient-to-b from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs text-gray-600 dark:text-gray-400 leading-tight font-medium">Sub #{idx + 1}</span>
                                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 leading-tight">
                                  {getResponseTimestamp(response) 
                                    ? new Date(getResponseTimestamp(response)!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                    : "N/A"
                                  }
                                </span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {form?.sections?.flatMap((section) =>
                          section.questions?.map((question, qIdx) => {
                            const last5Responses = filteredResponses.filter(r => getResponseTimestamp(r)).sort((a, b) => {
                              const dateA = new Date(getResponseTimestamp(a)!).getTime();
                              const dateB = new Date(getResponseTimestamp(b)!).getTime();
                              return dateB - dateA;
                            }).slice(0, 5);
                            
                            return (
                              <tr key={question.id} className={qIdx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/50'}>
                                <td className="sticky left-0 z-10 px-4 py-3 font-medium text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 min-w-60">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-semibold break-words whitespace-normal">{question.text || "Question"}</span>
                                    {question.description && (
                                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-words whitespace-normal">{question.description}</span>
                                    )}
                                  </div>
                                </td>
                                {last5Responses.map((response) => {
                                  const answer = response.answers?.[question.id];
                                  const hasAnswer = answer !== null && answer !== undefined && answer !== '';
                                  
                                  return (
                                    <td key={`${response.id}-${question.id}`} className="text-center px-3 py-2 border border-gray-200 dark:border-gray-700">
                                      {hasAnswer ? (
                                        <div className="flex items-center justify-center">
                                          {Array.isArray(answer) ? (
                                            <div className="space-y-1 text-left">
                                              {answer.map((item, idx) => (
                                                <div key={idx} className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 px-2 py-1 rounded whitespace-nowrap">
                                                  {isImageUrl(String(item)) ? (
                                                    <ImageLink text={String(item)} />
                                                  ) : (
                                                    String(item)
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          ) : typeof answer === 'object' ? (
                                            <div className="text-xs text-gray-700 dark:text-gray-300 max-w-32 overflow-auto max-h-32">
                                              <pre className="text-left text-[10px]">{JSON.stringify(answer, null, 1)}</pre>
                                            </div>
                                          ) : (
                                            <div className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded inline-block max-w-24 truncate">
                                              {isImageUrl(String(answer)) ? (
                                                <ImageLink text={String(answer)} />
                                              ) : (
                                                String(answer)
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })
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
                Are you sure you want to delete this response? This action cannot be undone.
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

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white font-medium z-50 ${
          toast.type === 'success' 
            ? 'bg-green-500 dark:bg-green-600' 
            : 'bg-red-500 dark:bg-red-600'
        }`}>
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
