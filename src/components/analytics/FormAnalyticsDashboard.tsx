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
          responses.forEach((response) => {
            const normalizedValues = extractYesNoValues(
              response.answers?.[question.id]
            );
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

export default function FormAnalyticsDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [responses, setResponses] = useState<Response[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsView, setAnalyticsView] = useState<"question" | "section">(
    "section"
  );
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);

  // Add this state to your component
  const [showRadarChart, setShowRadarChart] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");
  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
  const [filterValues, setFilterValues] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");


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


  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch form details
        const formData = await apiClient.getForm(id);
        setForm(formData.form);

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




  const analytics = useMemo(() => {
    const total = responses.length;
    const pending = responses.filter(
      (r) => r.status === "pending" || !r.status
    ).length;
    const verified = responses.filter((r) => r.status === "verified").length;
    const rejected = responses.filter((r) => r.status === "rejected").length;

    const recentResponses = responses
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

    const responseTrend = responses.reduce(
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
  }, [responses]);

  const sectionPerformanceStats = useMemo(
    () => computeSectionPerformanceStats(form, responses),
    [form, responses]
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
  const filteredResponses = useMemo(() => {
    if (!selectedQuestionId || !selectedAnswer) {
      return responses;
    }

    return responses.filter((response) => {
      const answer = response.answers[selectedQuestionId];
      if (!answer) return false;

      // Handle different answer types
      if (Array.isArray(answer)) {
        return answer.some((item) => String(item).toLowerCase() === selectedAnswer.toLowerCase());
      }
      return String(answer).toLowerCase() === selectedAnswer.toLowerCase();
    });
  }, [responses, selectedQuestionId, selectedAnswer]);

  const visibleSectionStats = useMemo(
    () =>
      filteredSectionStats.filter((stat) =>
        selectedSectionIds.includes(stat.id)
      ),
    [filteredSectionStats, selectedSectionIds]
  );

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
          label: "Yes",
          data: visibleSectionStats.map((stat) =>
            calculatePercentage(stat.yes, stat.total)
          ),
          backgroundColor: "#1d4ed8",
          borderRadius: 4,
        },
        {
          label: "No",
          data: visibleSectionStats.map((stat) =>
            calculatePercentage(stat.no, stat.total)
          ),
          backgroundColor: "#3b82f6",
          borderRadius: 4,
        },
        {
          label: "N/A",
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
      <div className="card p-6 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 flex flex-col h-full">
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
              <div className="mt-0 grid grid-cols-3 gap-1">
                {/* Yes */}
                <div className="text-center p-0.5 bg-green-50 dark:bg-green-900/10 rounded">
                  <div className="text-sm font-bold text-green-600 dark:text-green-400">
                    {totalPieChartData.yes}%
                  </div>
                  <div className="text-[11px] font-medium text-green-700 dark:text-green-300">
                    Yes
                  </div>
                  <div className="text-[9px] text-green-600 dark:text-green-500">
                    {totalPieChartData.counts.yes} responses
                  </div>
                </div>

                {/* No */}
                <div className="text-center p-0.5 bg-red-50 dark:bg-red-900/10 rounded">
                  <div className="text-sm font-bold text-red-600 dark:text-red-400">
                    {totalPieChartData.no}%
                  </div>
                  <div className="text-[11px] font-medium text-red-700 dark:text-red-300">
                    No
                  </div>
                  <div className="text-[9px] text-red-600 dark:text-red-500">
                    {totalPieChartData.counts.no} responses
                  </div>
                </div>

                {/* N/A */}
                <div className="text-center p-0.5 bg-gray-50 dark:bg-gray-900/10 rounded">
                  <div className="text-sm font-bold text-gray-600 dark:text-gray-400">
                    {totalPieChartData.na}%
                  </div>
                  <div className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
                    N/A
                  </div>
                  <div className="text-[9px] text-gray-600 dark:text-gray-500">
                    {totalPieChartData.counts.na} responses
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


    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-primary-800">
              Form Analytics
            </h1>
            <p className="text-primary-600">
              {form?.title || "Form"} - Response Analytics,
            </p>
            <p className="text-[10px] font-bold text-primary-500">Last updated: {new Date().toLocaleString()}</p>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-4">
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl font-medium"
              title="Download as PDF"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>

            <div className="p-3 bg-blue-50 rounded-lg mr-4">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-primary-600">
                {analytics.total}
              </div>
              <div className="text-xs text-primary-500">Total Responses</div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}


      {/* Response Trend and Location Heatmap - 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Location Heatmap */}
        <div className="h-[380px]">
          <LocationHeatmap
            responses={responses}
            title="Response Locations Heatmap" id="location-heatmap"
          />
        </div>

        {/* Response Trend Chart - COMPACT */}
        <div className="card p-4 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 flex flex-col"  >
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

        {/* Pie Chart - COMPACT */}
        <div className="h-[380px]">
          <OverallQualityPieChart />
        </div>
      </div>

      {/* Analytics View Toggle */}
      {form && (
        <>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setAnalyticsView("question")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${analyticsView === "question"
                ? "bg-indigo-600 text-white shadow-lg"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
            >
              <BarChart3 className="w-4 h-4" />
              Question Based Analytics
            </button>
            <button
              onClick={() => setAnalyticsView("section")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${analyticsView === "section"
                ? "bg-indigo-600 text-white shadow-lg"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
            >
              <FileText className="w-4 h-4" />
              Section Based Analytics
            </button>
          </div>

          {/* Question-wise Analytics */}
          {analyticsView === "question" && (
            <div className="card p-6">
              <ResponseQuestion question={form} responses={responses} />
            </div>
          )}
          {/* Section-wise Analytics */}
          {analyticsView === "section" && (
            <div className="space-y-6">
              {filteredSectionStats.length > 0 ? (
                <>
                  <div className="card p-6 space-y-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <PieChart className="w-5 h-5 text-indigo-600" />
                          Section Summary with Visualization
                          {filterValues.length > 0 && (
                            <span className="text-sm font-normal text-blue-600 dark:text-blue-400 ml-2">
                              (Filtered: {filteredResponses.length}/{responses.length} responses)
                            </span>
                          )}
                        </h3>
                        {/* ADD THIS: Question & Answer Filter Section - Side by Side */}
                        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-blue-100 dark:border-gray-700">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                              <h4 className="text-md font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                Response Distribution by Question
                              </h4>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                Select a question and filter by answer
                              </p>
                            </div>

                            {/* BOTH DROPDOWNS SIDE BY SIDE */}
                            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full md:w-auto">
                              {/* Question Dropdown - Always visible */}
                              <div className="relative w-full md:min-w-[280px]">
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Select Question
                                </label>
                                <select
                                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-600 dark:focus:border-blue-600 appearance-none cursor-pointer"
                                  value={selectedQuestionId || ""}
                                  onChange={(e) => {
                                    const questionId = e.target.value;
                                    setSelectedQuestionId(questionId || "");
                                    // Reset answer when question changes
                                    setSelectedAnswer("");
                                  }}
                                >
                                  <option value="">All Questions</option>
                                  <option value="" disabled>──────────────────</option>

                                  {/* Only show questions from the first section */}
                                  {form?.sections?.[0]?.questions
                                    ?.filter((q: any) => !q.parentId && !q.showWhen?.questionId) // Only main questions
                                    .map((question: any, index: number) => (
                                      <option
                                        key={question.id}
                                        value={question.id}
                                        className="py-1"
                                      >
                                        Q{index + 1}: {question.text?.substring(0, 45) || 'Unnamed Question'}
                                        {question.text?.length > 45 ? '...' : ''}
                                      </option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300 top-7">
                                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                  </svg>
                                </div>
                              </div>

                              {/* Answer Dropdown - Always visible but options change based on question */}
                              <div className="relative w-full md:min-w-[200px]">
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Filter by Answer
                                </label>
                                <select
                                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-600 dark:focus:border-blue-600 appearance-none cursor-pointer"
                                  value={selectedAnswer}
                                  onChange={(e) => setSelectedAnswer(e.target.value)}
                                  disabled={!selectedQuestionId}
                                >
                                  <option value="">All Answers</option>
                                  {selectedQuestionId ? (
                                    (() => {
                                      // Check for question type first
                                      const questionType = selectedQuestion?.type || '';

                                      // Handle different question types
                                      if (questionType === 'yesNoNA') {
                                        return (
                                          <>
                                            <option value="" disabled>──────────────────</option>
                                            <option value="Yes">Yes</option>
                                            <option value="No">No</option>
                                            <option value="N/A">N/A</option>
                                            <option value="yes">yes (lowercase)</option>
                                            <option value="no">no (lowercase)</option>
                                            <option value="na">na (lowercase)</option>
                                          </>
                                        );
                                      }

                                      // Handle multiple choice questions
                                      if (selectedQuestion?.options && Array.isArray(selectedQuestion.options)) {
                                        const validOptions = selectedQuestion.options.filter(
                                          (opt: any) => opt && String(opt).trim() !== ''
                                        );

                                        if (validOptions.length > 0) {
                                          return (
                                            <>
                                              <option value="" disabled>──────────────────</option>
                                              {validOptions.map((option: any) => (
                                                <option key={String(option)} value={String(option)}>
                                                  {String(option).length > 35
                                                    ? `${String(option).substring(0, 35)}...`
                                                    : String(option)}
                                                </option>
                                              ))}
                                            </>
                                          );
                                        }
                                      }

                                      // For other question types, show available answers from actual responses
                                      if (responses.length > 0) {
                                        // Collect unique answers for this question from responses
                                        const uniqueAnswers = new Set<string>();

                                        responses.forEach(response => {
                                          const answer = response.answers[selectedQuestionId];
                                          if (answer !== undefined && answer !== null && answer !== '') {
                                            if (Array.isArray(answer)) {
                                              answer.forEach(item => {
                                                if (item !== null && item !== undefined && item !== '') {
                                                  uniqueAnswers.add(String(item).trim());
                                                }
                                              });
                                            } else {
                                              uniqueAnswers.add(String(answer).trim());
                                            }
                                          }
                                        });

                                        const uniqueAnswersArray = Array.from(uniqueAnswers);

                                        if (uniqueAnswersArray.length > 0) {
                                          return (
                                            <>
                                              <option value="" disabled>──────────────────</option>
                                              {uniqueAnswersArray.slice(0, 20).map((answer) => (
                                                <option key={answer} value={answer}>
                                                  {answer.length > 40 ? `${answer.substring(0, 40)}...` : answer}
                                                </option>
                                              ))}
                                              {uniqueAnswersArray.length > 20 && (
                                                <option value="" disabled>
                                                  ... {uniqueAnswersArray.length - 20} more
                                                </option>
                                              )}
                                            </>
                                          );
                                        }
                                      }

                                      // Default fallback
                                      return (
                                        <>
                                          <option value="" disabled>──────────────────</option>
                                          <option value="Other">Other/Text Answer</option>
                                        </>
                                      );
                                    })()
                                  ) : (
                                    <option value="" disabled>
                                      Select a question first
                                    </option>
                                  )}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300 top-7">
                                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                  </svg>
                                </div>
                              </div>

                              {/* Clear Button */}
                              {(selectedQuestionId || selectedAnswer) && (
                                <div className="w-full md:w-auto md:mt-6">
                                  <button
                                    onClick={() => {
                                      setSelectedQuestionId("");
                                      setSelectedAnswer("");
                                    }}
                                    className="w-full md:w-auto px-4 py-2.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Clear Filters
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Show filter status */}
                          {(selectedQuestionId || selectedAnswer) && (
                            <div className="mt-3 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-blue-100 dark:border-gray-700">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="space-y-1">
                                  {selectedQuestionId && (
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                      <span className="font-medium">Question:</span>{" "}
                                      <span className="text-blue-600 dark:text-blue-400">
                                        {selectedQuestion?.text || 'Selected Question'}
                                      </span>
                                    </p>
                                  )}
                                  {selectedAnswer && (
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                      <span className="font-medium">Answer Filter:</span>{" "}
                                      <span className="text-green-600 dark:text-green-400">
                                        {selectedAnswer}
                                      </span>
                                    </p>
                                  )}
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Showing {filteredResponses.length} of {responses.length} responses
                                  </p>
                                </div>

                                {selectedQuestion && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                      {selectedQuestion.type}
                                    </span>
                                    {selectedQuestion.required && (
                                      <span className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                                        Required
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Help text when no filters are applied */}
                          {!selectedQuestionId && !selectedAnswer && (
                            <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                              <p className="text-xs text-blue-700 dark:text-blue-400">
                                <span className="font-medium">How to use:</span>
                                1. Select a question from the first dropdown
                                2. Filter by specific answer in the second dropdown
                                3. View filtered analytics below
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={handleSelectAllSections}
                        className="px-4 py-2 rounded-full text-sm font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-200 dark:border-indigo-700"
                      >
                        Select All Sections
                      </button>

                    </div>

                    <div className="flex flex-wrap gap-2">
                      {filteredSectionStats.map((stat) => {
                        const selected = selectedSectionIds.includes(stat.id);
                        return (
                          <label
                            key={stat.id}
                            className={`flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-medium cursor-pointer transition-colors ${selected
                              ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-700 dark:text-indigo-100"
                              : "bg-white border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
                              }`}
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                              checked={selected}
                              onChange={() => toggleSectionSelection(stat.id)}
                            />
                            <span className="truncate max-w-[160px]">{stat.title}</span>
                          </label>
                        );
                      })}
                    </div>

                    {/* Color Legend with Radar Chart Toggle */}
                    <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Color Legend:
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">Yes</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">No</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-gray-400 rounded-sm"></div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">N/A</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Add Weight Checkbox - Only show when all weightages are 0 */}
                        {showWeightageCheckbox && (
                          <div className="flex items-center gap-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg p-2 border border-gray-300 dark:border-gray-700">
                            <label className="flex items-center cursor-pointer">
                              <div className="relative">
                                <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={addWeightMode}
                                  onChange={(e) => {
                                    setAddWeightMode(e.target.checked);
                                    if (e.target.checked) {
                                      setShowWeightageColumns(true);
                                    }
                                  }}
                                />
                                <div className={`block w-10 h-5 rounded-full transition-colors duration-200 ${addWeightMode ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'}`}></div>
                                <div className={`absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 ${addWeightMode ? 'transform translate-x-5' : ''}`}></div>
                              </div>
                              <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                Add Weight
                              </span>
                            </label>

                            {addWeightMode && (
                              <div className="ml-2 text-xs text-gray-600 dark:text-gray-400 bg-black/10 px-2 py-1 rounded">
                                Total: {totalWeightage.toFixed(1)}%
                              </div>
                            )}
                          </div>
                        )}

                        {/* Radar Chart Toggle Checkbox */}
                        <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          <input
                            type="checkbox"
                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            checked={showRadarChart}
                            onChange={() => setShowRadarChart(!showRadarChart)}
                          />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Show Radar Chart
                          </span>
                        </label>
                        {/* Add this in the color legend/controls section, after the radar chart toggle */}
                         {showWeightageColumns && !redistributionMode && (
    <button
      onClick={() => {
        setRedistributionMode(true);
        // Initialize temp values with current weightages
        const initialValues: Record<string, string> = {};
        sectionSummaryRows.forEach(row => {
          initialValues[row.id] = row.weightage.toString();
        });
        setTempWeightageValues(initialValues);
        setWeightageBalance(0);
      }}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
      Edit Weightage
    </button>
  )}
                      </div>
                    </div>

                    {/* Combined Table with Visualization and Radar Chart */}
                    <div className={`flex ${showRadarChart ? 'gap-6' : ''}`}>
                      {/* Table Container - Shrinks when radar chart is shown */}
                      <div className={`${showRadarChart ? 'flex-1' : 'w-full'}`}>
                        <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg">
                          <table className="min-w-full text-sm">
                            <thead className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 sticky top-0">
                              <tr>
                                <th className={`text-left ${showRadarChart ? 'px-4 py-3' : 'px-6 py-4'}`}>Section</th>
                                <th className={`text-center ${showRadarChart ? 'px-3 py-3' : 'px-6 py-4'}`}>Total</th>
                                <th className={`text-center ${showRadarChart ? 'px-3 py-3' : 'px-6 py-4'}`}>Yes</th>
                                <th className={`text-center ${showRadarChart ? 'px-3 py-3' : 'px-6 py-4'}`}>No</th>
                                <th className={`text-center ${showRadarChart ? 'px-3 py-3' : 'px-6 py-4'}`}>N/A</th>

                                {/* Conditionally show weightage columns */}
                                {showWeightageColumns && (
                                  <>
                                    <th className={`text-center ${showRadarChart ? 'px-3 py-3' : 'px-6 py-4'}`}>Weightage</th>
                                    <th className={`text-center ${showRadarChart ? 'px-3 py-3' : 'px-6 py-4'}`}>Yes × W</th>
                                    <th className={`text-center ${showRadarChart ? 'px-3 py-3' : 'px-6 py-4'}`}>No × W</th>
                                    <th className={`text-center ${showRadarChart ? 'px-3 py-3' : 'px-6 py-4'}`}>N/A × W</th>
                                  </>
                                )}

                                {!showRadarChart && (
                                  <th className="text-center px-6 py-4">Visualization</th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {sectionSummaryRows.map((row, index) => {
                                const rowBgColor = index % 2 === 0
                                  ? "bg-white dark:bg-gray-900"
                                  : "bg-gray-50 dark:bg-gray-800/50";

                                // Helper function to generate the exact bar chart from your example
                                const generateTableBarChart = (yesPercent: number, noPercent: number, naPercent: number) => {
                                  const totalWidth = 200;
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
                                    className={`border-t border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors duration-150 ${rowBgColor}`}
                                  >
                                    {/* Section Column */}
                                    <td className={showRadarChart ? "px-4 py-3" : "px-6 py-4"}>
                                      <div className={`font-bold text-gray-900 dark:text-white ${showRadarChart ? 'text-sm' : ''}`}>
                                        {showRadarChart ? (
                                          <span className="truncate max-w-[180px] block">{row.title}</span>
                                        ) : (
                                          row.title
                                        )}
                                      </div>
                                      {showWeightageColumns && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                                          Weightage: {Number.isFinite(row.weightage) ? row.weightage.toFixed(1) : "0.0"}%
                                        </div>
                                      )}
                                    </td>

                                    {/* Total Column */}
                                    <td className={`text-center ${showRadarChart ? 'px-3 py-3' : 'px-6 py-4'}`}>
                                      <div className="font-bold text-blue-600 dark:text-blue-400">
                                        {row.total}
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-semibold">
                                        Responses
                                      </div>
                                    </td>

                                    {/* Yes Column */}
                                    <td className={`text-center ${showRadarChart ? 'px-3 py-3' : 'px-6 py-4'}`}>
                                      <div className="font-bold text-green-600 dark:text-green-400">
                                        {row.yesCount}
                                      </div>
                                      <div className="text-xs text-green-700 dark:text-green-300 mt-1 font-semibold">
                                        {Number.isFinite(row.yesPercent) ? row.yesPercent.toFixed(1) : "0.0"}%
                                      </div>
                                    </td>

                                    {/* No Column */}
                                    <td className={`text-center ${showRadarChart ? 'px-3 py-3' : 'px-6 py-4'}`}>
                                      <div className="font-bold text-red-500 dark:text-red-400">
                                        {row.noCount}
                                      </div>
                                      <div className="text-xs text-red-600 dark:text-red-300 mt-1 font-semibold">
                                        {Number.isFinite(row.noPercent) ? row.noPercent.toFixed(1) : "0.0"}%
                                      </div>
                                    </td>

                                    {/* N/A Column */}
                                    <td className={`text-center ${showRadarChart ? 'px-3 py-3' : 'px-6 py-4'}`}>
                                      <div className="font-bold text-slate-500 dark:text-slate-300">
                                        {row.naCount}
                                      </div>
                                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-semibold">
                                        {Number.isFinite(row.naPercent) ? row.naPercent.toFixed(1) : "0.0"}%
                                      </div>
                                    </td>

                                    {/* Conditionally render weightage columns */}
                                    {showWeightageColumns && (
                                      <>

                                        {/* Weightage Column */}
                                        {/* Weightage Column */}
                                        <td className={`text-center ${showRadarChart ? 'px-3 py-3' : 'px-6 py-4'}`}>
                                          {redistributionMode ? (
                                            // Redistribution mode - all cells editable with input fields only
                                            <div className="flex flex-col items-center">
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

                                                  // Update temp values
                                                  const updatedTempValues = {
                                                    ...tempWeightageValues,
                                                    [row.id]: newValue
                                                  };
                                                  setTempWeightageValues(updatedTempValues);

                                                  // Calculate balance
                                                  const total = Object.values(updatedTempValues).reduce((sum, val) => {
                                                    return sum + (parseFloat(val) || 0);
                                                  }, 0);
                                                  const balance = 100 - total;
                                                  setWeightageBalance(balance);

                                                  // Show helpful message
                                                  const difference = newNumericValue - oldValue;
                                                  if (difference > 0) {
                                                    console.log(`Increased by ${difference.toFixed(1)}%, balance: ${balance.toFixed(1)}%`);
                                                  } else if (difference < 0) {
                                                    console.log(`Decreased by ${Math.abs(difference).toFixed(1)}%, balance: ${balance.toFixed(1)}%`);
                                                  }
                                                }}
                                                className="w-20 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 text-center"
                                              />
                                              {/* Show difference indicator */}
                                              <div className="text-xs mt-1">
                                                {(() => {
                                                  const currentVal = parseFloat(tempWeightageValues[row.id] || row.weightage.toString()) || 0;
                                                  const originalVal = row.weightage;
                                                  const diff = currentVal - originalVal;

                                                  if (diff > 0.1) {
                                                    return <span className="text-green-600 font-medium">+{diff.toFixed(1)}</span>;
                                                  } else if (diff < -0.1) {
                                                    return <span className="text-red-600 font-medium">{diff.toFixed(1)}</span>;
                                                  }
                                                  return null;
                                                })()}
                                              </div>
                                            </div>
                                          ) : (
                                            // Display mode - just show the value (no edit icon)
                                            <div className="flex items-center justify-center">
                                              <span className="font-bold text-indigo-600 dark:text-indigo-400 text-lg">
                                                {Number.isFinite(row.weightage) ? row.weightage.toFixed(1) : "0.0"}%
                                              </span>
                                            </div>
                                          )}
                                        </td>

                                        {/* Yes × Weightage Column */}
                                        <td className={`text-center ${showRadarChart ? 'px-3 py-3' : 'px-6 py-4'}`}>
                                          <div className="font-bold text-green-700 dark:text-green-300">
                                            {Number.isFinite(row.yesWeighted) ? row.yesWeighted.toFixed(1) : "0.0"}
                                          </div>
                                        </td>

                                        {/* No × Weightage Column */}
                                        <td className={`text-center ${showRadarChart ? 'px-3 py-3' : 'px-6 py-4'}`}>
                                          <div className="font-bold text-red-700 dark:text-red-300">
                                            {Number.isFinite(row.noWeighted) ? row.noWeighted.toFixed(1) : "0.0"}
                                          </div>
                                        </td>

                                        {/* N/A × Weightage Column */}
                                        <td className={`text-center ${showRadarChart ? 'px-3 py-3' : 'px-6 py-4'}`}>
                                          <div className="font-bold text-slate-700 dark:text-slate-400">
                                            {Number.isFinite(row.naWeighted) ? row.naWeighted.toFixed(1) : "0.0"}
                                          </div>
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
                                    {/* Visualization Column with Bar Chart - Hidden when radar chart is shown */}
                                    {!showRadarChart && (
                                      <td className="px-6 py-4">
                                        <div className="flex justify-center">
                                          {generateTableBarChart(
                                            Number.isFinite(row.yesPercent) ? row.yesPercent : 0,
                                            Number.isFinite(row.noPercent) ? row.noPercent : 0,
                                            Number.isFinite(row.naPercent) ? row.naPercent : 0
                                          )}
                                        </div>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}


                              {/* Total Weightage Row - Only show when weightage columns are visible */}
                              {showWeightageColumns && (
                                <tr className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-t-2 border-blue-200 dark:border-blue-700">
                                  <td colSpan={4} className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100 text-right">
                                    {redistributionMode ? "Current Balance:" : "Total Weightage:"}
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full font-bold ${redistributionMode ?
                                      (Math.abs(weightageBalance) < 0.1 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400') :
                                      (Math.abs(totalWeightage - 100) < 0.1 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400')
                                      }`}>
                                      {redistributionMode ? `${weightageBalance.toFixed(1)}%` : `${totalWeightage.toFixed(1)}%`}
                                      {redistributionMode && Math.abs(weightageBalance) >= 0.1 && (
                                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                        </svg>
                                      )}
                                    </span>
                                  </td>

                                  {/* Status Message Column - Takes up remaining space */}
                                  <td colSpan={showWeightageColumns ? (showRadarChart ? 3 : 3) : 0} className="px-6 py-4">
                                    <div className="flex items-center justify-between">
                                      <span className={redistributionMode ?
                                        (Math.abs(weightageBalance) < 0.1 ? "text-green-600 dark:text-green-400 font-medium" : "text-yellow-600 dark:text-yellow-400 font-medium") :
                                        (Math.abs(totalWeightage - 100) < 0.1 ? "text-green-600 dark:text-green-400 font-medium" : "text-yellow-600 dark:text-yellow-400 font-medium")
                                      }>
                                        {redistributionMode ? (
                                          Math.abs(weightageBalance) < 0.1 ?
                                            '✓ Ready to save' :
                                            `Adjust by ${Math.abs(weightageBalance).toFixed(1)}% to reach 100%`
                                        ) : (
                                          Math.abs(totalWeightage - 100) < 0.1 ?
                                            '✓ Weightage distribution complete' :
                                            (addWeightMode ?
                                              `⚠️ Need ${(100 - totalWeightage).toFixed(1)}% more to reach 100%` :
                                              'Weightage not fully distributed')
                                        )}
                                      </span>

                                      {/* Action Buttons - Only show in redistribution mode */}
                                      {redistributionMode && (
                                        <div className="flex items-center gap-2 ml-4">
                                          {/* Reset Button */}
                                          <button
                                            onClick={() => {
                                              const originalValues: Record<string, string> = {};
                                              sectionSummaryRows.forEach(row => {
                                                originalValues[row.id] = row.weightage.toString();
                                              });
                                              setTempWeightageValues(originalValues);
                                              setWeightageBalance(0);
                                            }}
                                            className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-1"
                                            title="Reset to original values"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            Reset
                                          </button>

                                          {/* Cancel Button */}
                                          <button
                                            onClick={() => {
                                              setRedistributionMode(false);
                                              setTempWeightageValues({});
                                              setWeightageBalance(0);
                                            }}
                                            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                            title="Cancel redistribution"
                                          >
                                            Cancel
                                          </button>

                                          {/* Save Changes Button */}
                                          <button
                                            onClick={async () => {
                                              if (Math.abs(weightageBalance) >= 0.1) {
                                                console.error(`Cannot save: Balance must be 0%. Current: ${weightageBalance.toFixed(1)}%`);
                                                return;
                                              }

                                              setSavingWeightage(true);
                                              try {
                                                // Save all weightages
                                                const formId = form?._id || form?.id;
                                                if (!formId) throw new Error("Form ID not found");

                                                // Create updated sections with new weightages
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

                                                // Update local state
                                                setForm({ ...form, sections: updatedSections });
                                                setRedistributionMode(false);
                                                setTempWeightageValues({});
                                                setWeightageBalance(0);

                                                console.log("Weightages redistributed successfully!");
                                              } catch (error) {
                                                console.error("Failed to save weightages:", error);
                                              } finally {
                                                setSavingWeightage(false);
                                              }
                                            }}
                                            disabled={Math.abs(weightageBalance) >= 0.1 || savingWeightage}
                                            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
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
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Radar Chart - Appears on right side when toggled */}
                      {showRadarChart && (
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
                                        color: 'rgba(0, 0, 0, 0.1)',
                                      },
                                      grid: {
                                        color: 'rgba(0, 0, 0, 0.1)',
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
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="card p-6 text-center text-primary-500">
                  No section performance data available yet
                </div>
              )}

              <div className="card p-6">
                <SectionAnalytics question={form} responses={responses} sectionsStats={sectionsStats} />
              </div>
            </div>
          )}
        </>
      )}

      {/* Form Details */}
      {form && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-primary-800 mb-4 flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Form Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-primary-800 mb-2">
                Form Information
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-primary-600">Title:</span>
                  <span className="font-medium">{form.title}</span>
                </div>
                {form.description && (
                  <div className="flex justify-between">
                    <span className="text-primary-600">Description:</span>
                    <span className="font-medium">{form.description}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-primary-600">Status:</span>
                  <span
                    className={`font-medium ${form.isVisible ? "text-green-600" : "text-yellow-600"
                      }`}
                  >
                    {form.isVisible ? "Public" : "Private"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-600">Created:</span>
                  <span className="font-medium">
                    {form.createdAt
                      ? new Date(form.createdAt).toLocaleDateString()
                      : "Unknown"}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-primary-800 mb-2">
                Response Summary
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-primary-600">Total Responses:</span>
                  <span className="font-medium">{analytics.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-600">Completion Rate:</span>
                  <span className="font-medium">
                    {analytics.total > 0
                      ? Math.round((analytics.verified / analytics.total) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-600">Average per Day:</span>
                  <span className="font-medium">
                    {analytics.total > 0
                      ? (analytics.total / 7).toFixed(1)
                      : "0"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
