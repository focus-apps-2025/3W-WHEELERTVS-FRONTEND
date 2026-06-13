import React, { useState, useEffect, useMemo } from "react";
import { useTheme } from "../context/ThemeContext";
import html2pdf from "html2pdf.js";
import { Filter } from "lucide-react";
import {
  BarChart2,
  FileText,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Activity,
  Award,
  Target,
  Zap,
  Calendar,
  RefreshCw,
  Download,
  AlertTriangle,
  PieChart,
  BarChart3,
  ChevronDown,
  MapPin,
  List,
  Mail,
  MessageCircle,
  MessageSquare,
  User,
  Eye,
  Edit2,
  Trash2,
} from "lucide-react";
import { Bar, Line, Doughnut, Radar } from "react-chartjs-2";
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
  ArcElement,
  RadialLinearScale,
} from "chart.js";
import { apiClient } from "../api/client";
import { formatTimestamp } from "../utils/dateUtils";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  generateOverallPDF,
  downloadPDF,
  getCoverPageData,
  buildOverallPDFHTML,
  getOverallComplianceHTML,
  getDefectDistributionHTML,
  getNoResponsesHTML, getSectionSummaryHTML

  // Add this
} from '../utils/pdfGenerator';

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
  ArcElement,
  RadialLinearScale,
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface Form {
  _id: string;
  id?: string;
  title: string;
  sections?: any[];
}

interface LocationData {
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
}

interface SubmissionMetadata {
  location?: LocationData;
  source?: string;
  ipAddress?: string;
}

interface ResponseStats {
  yes: number;
  no: number;
  na: number;
  accepted: number;
  rejected: number;
  rework: number;
}

interface Response {
  _id: string;
  id: string;
  questionId: string;  // This is the FORM ID
  formId?: string;
  parentResponseId?: string;
  answers: Record<string, any>;  // Keys here are QUESTION IDs
  responseRanks?: Record<string, number>;
  createdAt: string;
  updatedAt: string;
  status?: string;
  yesNoScore?: { yes: number; total: number };
  stats?: ResponseStats;
  submissionMetadata?: SubmissionMetadata;
  dealerName?: string;
  dealerRank?: number;
  formTitle: string;
  firstQuestionText?: string;
  firstAnswerValue?: string;
  actualFormId?: string;  // Add this to store the actual form ID
}
interface GroupedByFormAndDate {
  [formTitle: string]: {
    [date: string]: Response[];
  };
}

interface ActualSectionStats {
  id: string;           // Combined key: formId_sectionId
  formId: string;
  formTitle: string;
  sectionId: string;
  sectionTitle: string;
  yes: number;
  no: number;
  na: number;
  accepted: number;
  rejected: number;
  rework: number;
  total: number;
}

interface FormSectionStats {
  formId: string;
  formTitle: string;
  sections: Array<{
    sectionId: string;
    sectionTitle: string;
    yesCount: number;      // For Yes/Accepted
    noCount: number;       // For No/Rejected  
    naCount: number;       // For NA/Rework
    total: number;
    // Raw counts for debugging
    rawYes: number;
    rawNo: number;
    rawNa: number;
    rawAccepted: number;
    rawRejected: number;
    rawRework: number;
  }>;
  // Overall form totals
  totalYes: number;
  totalNo: number;
  totalNa: number;
  totalResponses: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractYesNoValues(value: any): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "string") {
    const n = value.trim().toLowerCase();
    return n ? [n] : [];
  }
  if (typeof value === "boolean") return [value ? "yes" : "no"];
  if (Array.isArray(value)) return value.flatMap(extractYesNoValues);
  if (typeof value === "object")
    return Object.values(value).flatMap(extractYesNoValues);
  return [];
}

function computeResponseStats(answers: Record<string, any>): ResponseStats {
  let yes = 0,
    no = 0,
    na = 0,
    accepted = 0,
    rejected = 0,
    rework = 0;
  const values = extractYesNoValues(answers);
  values.forEach((val) => {
    if (val === "yes") yes++;
    else if (val === "no") no++;
    else if (val === "na" || val === "n/a" || val === "n.a" || val === "n.a.")
      na++;
    else if (val === "accepted" || val === "accept") accepted++;
    else if (val === "rejected" || val === "reject") rejected++;
    else if (val === "rework") rework++;
  });
  return { yes, no, na, accepted, rejected, rework };
}

function collectYesNoQuestionIds(form: Form): string[] {
  const ids = new Set<string>();
  const processQuestion = (q: any) => {
    if (!q) return;
    if (q.type === "yesNoNA" && q.id) ids.add(q.id);
    q.followUpQuestions?.forEach(processQuestion);
  };
  form.sections?.forEach((s) => s.questions?.forEach(processQuestion));
  return Array.from(ids);
}

function computeYesNoScore(answers: Record<string, any>, form: Form) {
  const ids = collectYesNoQuestionIds(form);
  if (!ids.length) return undefined;
  let yes = 0;
  ids.forEach((id) => {
    if (extractYesNoValues(answers?.[id]).includes("yes")) yes++;
  });
  return { yes, total: ids.length };
}

function hasAnswerValue(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function renderAnswerDisplay(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value))
    return value.map(renderAnswerDisplay).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const s = value.value || value.text || value.label || "";
    return s ? String(s) : "";
  }
  return String(value);
}

function getComplianceColumns(form: Form | undefined, responses: Response[]) {
  if (!form || !form.sections) {
    return { useInspectionLabels: false, columns: ["yes", "no", "na"] };
  }
  let hasInspectionQuestions = false;

  const checkFormTitle = form.title?.toLowerCase() || "";
  if (
    checkFormTitle.includes("inspection") ||
    checkFormTitle.includes("chassis") ||
    checkFormTitle.includes("pdi") ||
    checkFormTitle.includes("rework") ||
    checkFormTitle.includes("accepted") ||
    checkFormTitle.includes("rejected") ||
    checkFormTitle.includes("verified") ||
    checkFormTitle.includes("audit") ||
    checkFormTitle.includes("workshop") ||
    checkFormTitle.includes("process audit")
  ) {
    hasInspectionQuestions = true;
  }

  if (!hasInspectionQuestions) {
    for (const section of form.sections) {
      const sectionTitle = section.title?.toLowerCase() || "";
      if (
        sectionTitle.includes("inspection") ||
        sectionTitle.includes("chassis") ||
        sectionTitle.includes("rework") ||
        sectionTitle.includes("accepted") ||
        sectionTitle.includes("rejected") ||
        sectionTitle.includes("verified") ||
        sectionTitle.includes("audit")
      ) {
        hasInspectionQuestions = true;
        break;
      }
      for (const q of section.questions || []) {
        const qType = (q.type || "").toLowerCase();
        const qText = (q.text || "").toLowerCase();
        if (
          qType.includes("chassis") ||
          qType.includes("zone") ||
          qType.includes("inspection") ||
          qText.includes("inspection") ||
          qText.includes("accepted") ||
          qText.includes("rejected") ||
          qText.includes("rework") ||
          (q.options &&
            q.options.some(
              (opt) =>
                String(opt).toLowerCase().includes("accepted") ||
                String(opt).toLowerCase().includes("rejected") ||
                String(opt).toLowerCase().includes("rework"),
            ))
        ) {
          hasInspectionQuestions = true;
          break;
        }
      }
      if (hasInspectionQuestions) break;
    }
  }

  if (hasInspectionQuestions) {
    let hasAcceptedRejectedRework = false;
    for (const r of responses) {
      const answers = r.answers || {};
      Object.values(answers).forEach((val) => {
        const vals = extractYesNoValues(val);
        if (vals.some((v) => ["accepted", "rejected", "rework"].includes(v))) {
          hasAcceptedRejectedRework = true;
        }
      });
      if (hasAcceptedRejectedRework) break;
    }
    if (hasAcceptedRejectedRework) {
      return {
        useInspectionLabels: true,
        columns: ["accepted", "rejected", "rework"],
      };
    }
  }

  return { useInspectionLabels: false, columns: ["yes", "no", "na"] };
}

function getComplianceLabel(
  columnType: string,
  useInspectionLabels: boolean,
): string {
  if (useInspectionLabels) {
    switch (columnType) {
      case "accepted":
        return "Accepted";
      case "rejected":
        return "Rejected";
      case "rework":
        return "Rework";
      default:
        return columnType;
    }
  }
  switch (columnType) {
    case "yes":
      return "Yes";
    case "no":
      return "No";
    case "na":
      return "N/A";
    default:
      return columnType;
  }
}

function getComplianceColor(columnType: string): string {
  switch (columnType) {
    case "yes":
      return "text-green-700 dark:text-green-400";
    case "no":
      return "text-red-700 dark:text-red-400";
    case "na":
      return "text-slate-600 dark:text-slate-400";
    case "accepted":
      return "text-emerald-700 dark:text-emerald-400";
    case "rejected":
      return "text-red-700 dark:text-red-400";
    case "rework":
      return "text-amber-700 dark:text-amber-400";
    default:
      return "text-gray-700 dark:text-gray-300";
  }
}

function getComplianceCount(stats: ResponseStats, columnType: string): number {
  switch (columnType) {
    case "yes":
      return stats.yes;
    case "no":
      return stats.no;
    case "na":
      return stats.na;
    case "accepted":
      return stats.accepted;
    case "rejected":
      return stats.rejected;
    case "rework":
      return stats.rework;
    default:
      return 0;
  }
}

function getRankStyle(answer: any): string {
  const str =
    typeof answer === "object"
      ? JSON.stringify(answer)
      : String(answer).trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const colors = [
    "bg-blue-50 text-blue-700 border-blue-200",
    "bg-emerald-50 text-emerald-700 border-emerald-200",
    "bg-amber-50 text-amber-700 border-amber-200",
    "bg-orange-50 text-orange-700 border-orange-200",
    "bg-rose-50 text-rose-700 border-rose-200",
    "bg-purple-50 text-purple-700 border-purple-200",
    "bg-teal-50 text-teal-700 border-teal-200",
  ];
  return colors[Math.abs(hash) % colors.length];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Overall() {
  const { darkMode } = useTheme();
  const { tenant } = useAuth();
  const navigate = useNavigate();
  const formFilterRef = React.useRef<HTMLDivElement>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>([]);
  const [showFormFilter, setShowFormFilter] = useState(false);
  const [expandScore, setExpandScore] = useState(false);
  const [expandRate, setExpandRate] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "requests">("summary");
  const [expandedForms, setExpandedForms] = useState<string[]>([]);
  const [showSectionSelector, setShowSectionSelector] = useState(false);
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [expandedNoResponsesForms, setExpandedNoResponsesForms] = useState<Set<string>>(new Set());

  const toggleFormExpansion = (formTitle: string) => {
    setExpandedNoResponsesForms((prev) => {
      const next = new Set(prev);
      if (next.has(formTitle)) {
        next.delete(formTitle);
      } else {
        next.add(formTitle);
      }
      return next;
    });
  };



  const toggleFormFilter = () => {
    setShowFormFilter((prev) => !prev);
  };

  const closeFormFilter = () => {
    setShowFormFilter(false);
  };

  React.useEffect(() => {
    if (!showFormFilter) return;
    const onDocClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (formFilterRef.current && !formFilterRef.current.contains(target)) {
        setShowFormFilter(false);
      }
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onDocClick);
      document.addEventListener("touchstart", onDocClick);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("touchstart", onDocClick);
    };
  }, [showFormFilter]);

  const toggleForm = (formTitle: string) => {
    setExpandedForms((prev) =>
      prev.includes(formTitle)
        ? prev.filter((t) => t !== formTitle)
        : [...prev, formTitle],
    );
  };

  // Add these with your other useState declarations
  const [chartOrientation, setChartOrientation] = useState<"v" | "h">("v");
  const [chartSortOrder, setChartSortOrder] = useState<"default" | "percentage">("percentage");
  const [defectDateFilter, setDefectDateFilter] = useState<{
    type: "all" | "single" | "range";
    startDate: string;
    endDate: string;
  }>({ type: "all", startDate: "", endDate: "" });
  const [showDefectFilter, setShowDefectFilter] = useState(false);
  // Defect Distribution Chart Data - Add this after summaryTotals
  const filteredResponses = useMemo(() => {
    return responses.filter((r) => {
      const matchSearch =
        r.formTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (typeof r.dealerName === "string" &&
          r.dealerName.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchForm =
        selectedFormIds.length === 0 ||
        selectedFormIds.includes("NONE_SELECTED") ||
        selectedFormIds.includes(r.questionId || r.formId || r.actualFormId || "") ||
        selectedFormIds.some((id) => id === r.formTitle);
      return matchSearch && matchForm;
    });
  }, [responses, searchQuery, selectedFormIds]);
  // Defect Distribution Chart Data - FIXED (no form dependency)
  const defectChartResponses = useMemo(() => {
    let result = [...filteredResponses];

    if (defectDateFilter.type !== "all") {
      result = result.filter((response) => {
        const timestamp = response.createdAt;
        if (!timestamp) return false;
        const responseDate = new Date(timestamp).toISOString().split("T")[0];

        if (defectDateFilter.type === "single" && defectDateFilter.startDate) {
          return responseDate === defectDateFilter.startDate;
        } else if (
          defectDateFilter.type === "range" &&
          defectDateFilter.startDate &&
          defectDateFilter.endDate
        ) {
          return (
            responseDate >= defectDateFilter.startDate &&
            responseDate <= defectDateFilter.endDate
          );
        }
        return true;
      });
    }

    return result;
  }, [filteredResponses, defectDateFilter]);


  const [formsMap, setFormsMap] = useState<Map<string, Form>>(new Map());



  // Update defectQuestionStats to use formsMap
  const defectQuestionStats = useMemo(() => {
    const questionStats = new Map<
      string,
      { text: string; rejected: number; rework: number; total: number; formTitle: string }
    >();

    defectChartResponses.forEach((response) => {
      const answers = response.answers || {};
      const questionTexts = (response as any).questionTexts || {};
      const formTitle = response.formTitle;

      Object.entries(answers).forEach(([qId, answer]) => {
        // Skip empty answers
        if (answer === undefined || answer === null || answer === "") return;

        // Check if this answer indicates a defect (No/Rejected or Rework/NA)
        let isDefect = false;
        let defectType = '';

        const answerStr = String(answer).toLowerCase().trim();

        // Check for No/Rejected
        if (answerStr === "no" || answerStr === "rejected" || answerStr === "reject") {
          isDefect = true;
          defectType = 'rejected';
        }
        // Check for Rework/NA
        else if (answerStr === "rework" || answerStr === "reworked" || answerStr === "na" || answerStr === "n/a") {
          isDefect = true;
          defectType = 'rework';
        }
        // Check object format for inspection forms
        else if (typeof answer === "object" && answer !== null) {
          const status = String(answer.status || "").toLowerCase().trim();
          if (status === "rejected" || status === "no") {
            isDefect = true;
            defectType = 'rejected';
          } else if (status === "rework" || status === "reworked" || status === "na") {
            isDefect = true;
            defectType = 'rework';
          }
        }

        // Only track defects
        if (!isDefect) return;

        // Get the actual question text
        let questionText = questionTexts[qId];

        // If not found in the map, try to create a meaningful label
        if (!questionText || questionText === qId) {
          // Check if this is a chassis/inspection question
          if (typeof answer === 'object' && answer.chassisNumber) {
            questionText = `Chassis: ${answer.chassisNumber}`;
          } else if (typeof answer === 'object' && answer.status) {
            questionText = `Inspection Status`;
          } else {
            // Don't use IDs, try to infer from the answer
            const answerValue = String(answer);
            if (answerValue === "no" || answerValue === "rejected") {
              questionText = "Rejection Question";
            } else if (answerValue === "rework" || answerValue === "na") {
              questionText = "Rework Question";
            } else {
              questionText = "Defect Question";
            }
          }
        }

        // Use question ID as key (not combined with form)
        if (!questionStats.has(qId)) {
          questionStats.set(qId, {
            text: questionText,  // Just the question text, no form prefix
            rejected: 0,
            rework: 0,
            total: 0,
            formTitle: formTitle,
          });
        } else {
          // If same question ID appears in different forms, we keep the first one
          // Or you could append form name only if needed
          const existing = questionStats.get(qId)!;
          if (existing.text === qId || existing.text.includes("Question")) {
            // Update with better text if we found it
            if (questionText && !questionText.includes(qId)) {
              existing.text = questionText;
            }
          }
        }

        const stats = questionStats.get(qId)!;
        stats.total++;

        if (defectType === 'rejected') {
          stats.rejected++;
        } else if (defectType === 'rework') {
          stats.rework++;
        }
      });
    });

    const result = Array.from(questionStats.values()).filter(
      (q) => q.rejected > 0 || q.rework > 0
    );

    // Sort by total defects (rejected + rework) descending
    result.sort((a, b) => (b.rejected + b.rework) - (a.rejected + a.rework));

    console.log('Defect chart questions (actual text):', result.map(r => ({
      text: r.text,
      rejected: r.rejected,
      rework: r.rework,
      form: r.formTitle
    })));

    return result;
  }, [defectChartResponses]);// Add formsMap to dependencies

  // Process questions for chart (sorting, filtering top 20)
  const processedDefectQuestions = useMemo(() => {
    let filtered = [...defectQuestionStats];

    if (chartSortOrder === "percentage") {
      filtered = [...filtered].sort((a, b) => {
        const percentA = ((a.rejected + a.rework) / a.total) * 100;
        const percentB = ((b.rejected + b.rework) / b.total) * 100;
        return percentB - percentA;
      });
    }

    return filtered.slice(0, 20);
  }, [defectQuestionStats, chartSortOrder]);

  // Date range label for defect chart
  const defectDateRangeLabel = useMemo(() => {
    if (defectChartResponses.length === 0) return "";
    const timestamps = defectChartResponses.map((r) =>
      new Date(r.createdAt).getTime()
    );
    const minDate = new Date(Math.min(...timestamps));
    const maxDate = new Date(Math.max(...timestamps));

    const format = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    if (format(minDate) === format(maxDate)) return format(minDate);
    return `${format(minDate)} - ${format(maxDate)}`;
  }, [defectChartResponses]);

  // Defect Chart Data
  const defectChartData = {
    labels: processedDefectQuestions.map((q) =>
      q.text.length > 25 ? q.text.substring(0, 25) + "..." : q.text
    ),
    datasets: [
      {
        label: "No / Rejected",
        data: processedDefectQuestions.map((q) => q.rejected),
        backgroundColor: "rgba(220, 38, 38, 0.85)",
        borderColor: "rgb(185, 28, 28)",
        borderWidth: 1,
        barPercentage: processedDefectQuestions.length <= 2 ? 0.3 : 0.7,
        categoryPercentage: 0.8,
      },
      {
        label: "N/A / Rework",
        data: processedDefectQuestions.map((q) => q.rework),
        backgroundColor: "rgba(245, 158, 11, 0.85)",
        borderColor: "rgb(217, 119, 6)",
        borderWidth: 1,
        barPercentage: processedDefectQuestions.length <= 2 ? 0.3 : 0.7,
        categoryPercentage: 0.8,
      },
    ],
  };

  const defectChartOptions = {
    indexAxis: chartOrientation === "h" ? ("y" as const) : ("x" as const),
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: darkMode ? "#e5e7eb" : "#374151",
          font: { size: 11, weight: "bold" as const },
          padding: 20,
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          title: (tooltipItems: any) => {
            const index = tooltipItems[0].dataIndex;
            const question = processedDefectQuestions[index];
            // Show full text in tooltip
            return question?.text || tooltipItems[0].label;
          },
          label: function (context: any) {
            const value = context.raw;
            const datasetLabel = context.dataset.label;
            const question = processedDefectQuestions[context.dataIndex];
            const total = question?.total || 0;
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            return `${datasetLabel}: ${value} (${percentage}%)`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        ticks: {
          color: darkMode ? "#e5e7eb" : "#374151",
          font: { size: 10, weight: "600" as const },
          maxRotation: chartOrientation === "v" ? 45 : 0,
          minRotation: 0,
          // Truncate long labels
          callback: function (val: any, index: number) {
            const label = this.getLabelForValue(val);
            if (label && label.length > 30) {
              return label.substring(0, 27) + '...';
            }
            return label;
          }
        },
        grid: { display: false },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          color: darkMode ? "#9ca3af" : "#6b7280",
          font: { size: 10 },
        },
        grid: {
          color: darkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)",
        },
      },
    },
    interaction: {
      mode: "nearest" as const,
      intersect: true,
    },
  };


  // Add this state for expanded forms
  const [expandedSummaryForms, setExpandedSummaryForms] = useState<Set<string>>(new Set());

  const toggleFormSummary = (formId: string) => {
    setExpandedSummaryForms((prev) => {
      const next = new Set(prev);
      if (next.has(formId)) {
        next.delete(formId);
      } else {
        next.add(formId);
      }
      return next;
    });
  };

  const FormRadarChart = ({ formStats, columnConfig }: {
    formStats: FormSectionStats;
    columnConfig: {
      type: "yesNoNa" | "acceptedRejectedRework";
      positiveLabel: string;
      negativeLabel: string;
      neutralLabel: string;
      positiveColor: string;
      negativeColor: string;
      neutralColor: string;
    };
  }) => {
    const sections = formStats.sections.filter(s => s.total > 0);

    if (sections.length === 0) {
      return (
        <div className="h-80 flex items-center justify-center">
          <p className="text-gray-400 text-sm">No data available for radar chart</p>
        </div>
      );
    }

    // Helper function to round to 1 decimal place
    const roundTo1Decimal = (value: number): number => {
      return Math.round(value * 10) / 10;
    };

    const radarData = {
      labels: sections.map(s => s.sectionTitle.length > 20 ? s.sectionTitle.slice(0, 18) + "…" : s.sectionTitle),
      datasets: [
        {
          label: `${columnConfig.positiveLabel} %`,
          data: sections.map(s => {
            const value = s.total > 0 ? (s.yesCount / s.total) * 100 : 0;
            return roundTo1Decimal(value);
          }),
          backgroundColor: columnConfig.type === "acceptedRejectedRework"
            ? "rgba(34, 197, 94, 0.2)"  // Emerald for Accepted
            : "rgba(34, 197, 94, 0.2)",  // Green for Yes
          borderColor: columnConfig.type === "acceptedRejectedRework" ? "#22c55e" : "#22c55e",
          borderWidth: 2,
          pointBackgroundColor: columnConfig.type === "acceptedRejectedRework" ? "#22c55e" : "#22c55e",
          pointBorderColor: "#fff",
          pointHoverBackgroundColor: "#fff",
          pointHoverBorderColor: columnConfig.type === "acceptedRejectedRework" ? "#22c55e" : "#22c55e",
        },
        {
          label: `${columnConfig.negativeLabel} %`,
          data: sections.map(s => {
            const value = s.total > 0 ? (s.noCount / s.total) * 100 : 0;
            return roundTo1Decimal(value);
          }),
          backgroundColor: "rgba(239, 68, 68, 0.2)",
          borderColor: "#ef4444",
          borderWidth: 2,
          pointBackgroundColor: "#ef4444",
          pointBorderColor: "#fff",
          pointHoverBackgroundColor: "#fff",
          pointHoverBorderColor: "#ef4444",
        },
        {
          label: `${columnConfig.neutralLabel} %`,
          data: sections.map(s => {
            const value = s.total > 0 ? (s.naCount / s.total) * 100 : 0;
            return roundTo1Decimal(value);
          }),
          backgroundColor: columnConfig.type === "acceptedRejectedRework"
            ? "rgba(245, 158, 11, 0.2)"  // Amber for Rework
            : "rgba(156, 163, 175, 0.2)", // Gray for N/A
          borderColor: columnConfig.type === "acceptedRejectedRework" ? "#f59e0b" : "#9ca3af",
          borderWidth: 2,
          pointBackgroundColor: columnConfig.type === "acceptedRejectedRework" ? "#f59e0b" : "#9ca3af",
          pointBorderColor: "#fff",
          pointHoverBackgroundColor: "#fff",
          pointHoverBorderColor: columnConfig.type === "acceptedRejectedRework" ? "#f59e0b" : "#9ca3af",
        },
      ],
    };

    const radarOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          suggestedMin: 0,
          suggestedMax: 100,
          angleLines: { display: true, color: "rgba(59,130,246,0.2)", lineWidth: 1 },
          grid: { color: "rgba(59,130,246,0.1)", lineWidth: 1 },
          pointLabels: { font: { size: 10 }, color: "#6b7280" },
          ticks: {
            backdropColor: "transparent",
            color: "#6b7280",
            font: { size: 10 },
            stepSize: 25,
            callback: (value: any) => `${value}%`
          },
        },
      },

      plugins: {
        datalabels: {
          display: false,
        },
        tooltip: {
          // callbacks: {
          //   label: (context: any) => {
          //     const label = context.dataset.label || '';
          //     const value = context.raw;
          //     // Value is already rounded, but ensure it shows with 1 decimal
          //     const formattedValue = typeof value === 'number' ? value.toFixed(1) : value;
          //     return `${label}: ${formattedValue}%`;
          //   }
          // }
        },
        legend: {
          // position: "bottom" as const,
          // labels: {
          //   font: { size: 10 },
          //   padding: 10,
          //   usePointStyle: true,
          //   generateLabels: (chart: any) => {
          //     const labels = ChartJS.defaults.plugins.legend.labels.generateLabels(chart);
          //     return labels.map((label: any) => ({
          //       ...label,
          //       text: label.text.replace(' %', '%') // Clean up label text if needed
          //     }));
          //   }
          // }
        },
      },
    };

    return (
      <div className="bg-white dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">
              Performance Radar
            </h4>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
              Section comparison for {formStats.formTitle}
            </p>
          </div>

        </div>
        <div className="h-80">
          <Radar data={radarData} options={radarOptions} />
        </div>
        {sections.length > 8 && (
          <p className="text-center text-[9px] text-gray-400 mt-3">
            Showing all {sections.length} sections
          </p>
        )}
      </div>
    );
  };

  // ─── Cover Page Generator (Overall version) ────────────────────────────────

  const formWiseSectionStats = useMemo(() => {
    const formMap = new Map<string, FormSectionStats>();

    filteredResponses.forEach((response) => {
      const formId = response.questionId || response.formId || "";
      const form = formsMap.get(formId);
      const formTitle = response.formTitle;
      const answers = response.answers || {};

      // Initialize form in map if not exists
      if (!formMap.has(formId)) {
        formMap.set(formId, {
          formId,
          formTitle,
          sections: [],
          totalYes: 0,
          totalNo: 0,
          totalNa: 0,
          totalResponses: 0,
        });
      }

      const formStats = formMap.get(formId)!;
      formStats.totalResponses++;

      if (!form?.sections || form.sections.length === 0) {
        // If no sections, create a default "General" section
        let generalSection = formStats.sections.find(s => s.sectionId === "general");
        if (!generalSection) {
          generalSection = {
            sectionId: "general",
            sectionTitle: "General Questions",
            yesCount: 0,
            noCount: 0,
            naCount: 0,
            total: 0,
            rawYes: 0,
            rawNo: 0,
            rawNa: 0,
            rawAccepted: 0,
            rawRejected: 0,
            rawRework: 0,
          };
          formStats.sections.push(generalSection);
        }

        // Process all answers for this response
        Object.values(answers).forEach((answer) => {
          if (answer === undefined || answer === null || answer === "") return;

          const answerStr = String(answer).toLowerCase().trim();

          // Check for Accepted/Rejected/Rework
          if (answerStr === "accepted" || answerStr === "rework completed" || answerStr === "verified") {
            generalSection.rawAccepted++;
            generalSection.yesCount++;
            formStats.totalYes++;
          } else if (answerStr === "rejected") {
            generalSection.rawRejected++;
            generalSection.noCount++;
            formStats.totalNo++;
          } else if (answerStr === "rework" || answerStr === "reworked" || answerStr.includes("re-rework")) {
            generalSection.rawRework++;
            generalSection.naCount++;
            formStats.totalNa++;
          }
          // Check for Yes/No/NA
          else if (answerStr === "yes" || answerStr === "y") {
            generalSection.rawYes++;
            generalSection.yesCount++;
            formStats.totalYes++;
          } else if (answerStr === "no" || answerStr === "n") {
            generalSection.rawNo++;
            generalSection.noCount++;
            formStats.totalNo++;
          } else if (answerStr === "na" || answerStr === "n/a" || answerStr === "not applicable") {
            generalSection.rawNa++;
            generalSection.naCount++;
            formStats.totalNa++;
          }
          // Handle object answers
          else if (typeof answer === "object" && answer !== null) {
            const status = String(answer.status || "").toLowerCase().trim();
            if (status === "accepted" || status === "rework completed" || status === "verified") {
              generalSection.rawAccepted++;
              generalSection.yesCount++;
              formStats.totalYes++;
            } else if (status === "rejected") {
              generalSection.rawRejected++;
              generalSection.noCount++;
              formStats.totalNo++;
            } else if (status === "rework" || status === "reworked" || status.includes("re-rework")) {
              generalSection.rawRework++;
              generalSection.naCount++;
              formStats.totalNa++;
            }
          }
        });
        generalSection.total = generalSection.yesCount + generalSection.noCount + generalSection.naCount;
        return;
      }

      // Process each actual section in the form
      form.sections.forEach((section: any) => {
        const sectionId = section.id || section._id || section.title;
        let sectionStats = formStats.sections.find(s => s.sectionId === sectionId);

        if (!sectionStats) {
          sectionStats = {
            sectionId,
            sectionTitle: section.title || "Untitled Section",
            yesCount: 0,
            noCount: 0,
            naCount: 0,
            total: 0,
            rawYes: 0,
            rawNo: 0,
            rawNa: 0,
            rawAccepted: 0,
            rawRejected: 0,
            rawRework: 0,
          };
          formStats.sections.push(sectionStats);
        }

        // Get questions for this section only
        const sectionQuestions = section.questions || [];

        sectionQuestions.forEach((question: any) => {
          const answer = answers[question.id];
          if (answer === undefined || answer === null || answer === "") return;

          const answerStr = String(answer).toLowerCase().trim();

          // Check for Accepted/Rejected/Rework (inspection style)
          if (typeof answer === "object" && answer.status) {
            const status = String(answer.status).toLowerCase().trim();
            if (status === "accepted" || status === "rework completed" || status === "verified") {
              sectionStats!.rawAccepted++;
              sectionStats!.yesCount++;
              formStats.totalYes++;
            } else if (status === "rejected") {
              sectionStats!.rawRejected++;
              sectionStats!.noCount++;
              formStats.totalNo++;
            } else if (status === "rework" || status === "reworked" || status.includes("re-rework")) {
              sectionStats!.rawRework++;
              sectionStats!.naCount++;
              formStats.totalNa++;
            }
          }
          // Check for Yes/No/NA answers
          else if (answerStr === "accepted" || answerStr === "rework completed" || answerStr === "verified") {
            sectionStats!.rawAccepted++;
            sectionStats!.yesCount++;
            formStats.totalYes++;
          } else if (answerStr === "rejected") {
            sectionStats!.rawRejected++;
            sectionStats!.noCount++;
            formStats.totalNo++;
          } else if (answerStr === "rework" || answerStr === "reworked" || answerStr.includes("re-rework")) {
            sectionStats!.rawRework++;
            sectionStats!.naCount++;
            formStats.totalNa++;
          } else if (answerStr === "yes" || answerStr === "y") {
            sectionStats!.rawYes++;
            sectionStats!.yesCount++;
            formStats.totalYes++;
          } else if (answerStr === "no" || answerStr === "n") {
            sectionStats!.rawNo++;
            sectionStats!.noCount++;
            formStats.totalNo++;
          } else if (answerStr === "na" || answerStr === "n/a" || answerStr === "not applicable") {
            sectionStats!.rawNa++;
            sectionStats!.naCount++;
            formStats.totalNa++;
          }
        });
      });
    });

    // Calculate totals for each section
    formMap.forEach((formStats) => {
      formStats.sections.forEach((section) => {
        section.total = section.yesCount + section.noCount + section.naCount;
      });
      // Sort sections by total responses (highest first)
      formStats.sections.sort((a, b) => b.total - a.total);
    });

    return Array.from(formMap.values()).sort((a, b) => b.totalResponses - a.totalResponses);
  }, [filteredResponses, formsMap]);
  const detectColumnTypeForForm = (formStats: FormSectionStats): {
    type: "yesNoNa" | "acceptedRejectedRework";
    positiveLabel: string;
    negativeLabel: string;
    neutralLabel: string;
    positiveColor: string;
    negativeColor: string;
    neutralColor: string;
  } => {
    // Check if any section has Accepted/Rejected/Rework values
    let hasAcceptedRework = false;
    for (const section of formStats.sections) {
      if (section.rawAccepted > 0 || section.rawRejected > 0 || section.rawRework > 0) {
        hasAcceptedRework = true;
        break;
      }
    }

    if (hasAcceptedRework) {
      return {
        type: "acceptedRejectedRework",
        positiveLabel: "Accepted",
        negativeLabel: "Rejected",
        neutralLabel: "Rework",
        positiveColor: "text-emerald-700 dark:text-emerald-400",
        negativeColor: "text-red-700 dark:text-red-400",
        neutralColor: "text-amber-700 dark:text-amber-400",
      };
    }

    return {
      type: "yesNoNa",
      positiveLabel: "Yes",
      negativeLabel: "No",
      neutralLabel: "N/A",
      positiveColor: "text-green-700 dark:text-green-400",
      negativeColor: "text-red-700 dark:text-red-400",
      neutralColor: "text-slate-600 dark:text-slate-400",
    };
  };


  // ─── handleDownloadPdf ────────────────────────────────────────────────────────
  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      // Calculate Yes score
      // In handleDownloadPdf - Fix the calculation
      let yesTotal = 0;
      let questionsTotal = 0;

      filteredResponses.forEach((response) => {
        const stats = response.stats;
        if (stats) {
          yesTotal += (stats.yes || 0) + (stats.accepted || 0);
          const totalForThisResponse = (stats.yes || 0) + (stats.no || 0) + (stats.na || 0) +
            (stats.accepted || 0) + (stats.rejected || 0) + (stats.rework || 0);
          questionsTotal += totalForThisResponse;
        }
      });

      // Fallback if no stats found
      if (questionsTotal === 0) {
        yesTotal = filteredResponses.reduce((s, r) => s + (r.yesNoScore?.yes || 0), 0);
        questionsTotal = filteredResponses.reduce((s, r) => s + (r.yesNoScore?.total || 0), 0);
      }

      console.log('PDF Stats:', { yesTotal, questionsTotal, percentage: (yesTotal / questionsTotal) * 100 });
      const allFormTitles = Array.from(new Set(filteredResponses.map((r) => r.formTitle).filter(Boolean))).sort();

      const tenantName = tenant?.companyName || tenant?.name || "";

      let logoBase64: string | null = null;
      let templateBase64: string | null = null;
      let otherTemplateBase64: string | null = null;

      const loadImageAsBase64 = async (imgPath: string): Promise<string | null> => {
        try {
          return await new Promise<string>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              canvas.getContext('2d')?.drawImage(img, 0, 0);
              const dataUrl = canvas.toDataURL('image/png');
              resolve(dataUrl);
            };
            img.onerror = () => resolve(null);
            img.src = imgPath;
          });
        } catch {
          return null;
        }
      };

      try {
        const logoRes = await fetch("/assets/roundlogo.jpeg");
        if (logoRes.ok) {
          const blob = await logoRes.blob();
          logoBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
          });
        }
      } catch (err) {
        console.warn("Could not load logo image:", err);
      }

      templateBase64 = await loadImageAsBase64('/assets/template.png');
      otherTemplateBase64 = await loadImageAsBase64('/assets/othertemplate.png');

      const coverPage = getCoverPageData(yesTotal, questionsTotal, allFormTitles, tenantName);
      console.log('Logo Base64 length:', logoBase64?.length);
      console.log('Template Base64 length:', templateBase64?.length);
      console.log('Other Template Base64 length:', otherTemplateBase64?.length);

      // Generate First Question Table HTML

      let firstQuestionHTML = '';
      const groupedFirstQuestions = filteredResponses.reduce((acc, r) => {
        const title = r.formTitle || "Unknown Form";
        if (!acc[title]) acc[title] = [];
        acc[title].push(r);
        return acc;
      }, {} as Record<string, typeof filteredResponses>);

      for (const [formTitle, rows] of Object.entries(groupedFirstQuestions)) {
        const displayRows = rows.slice(0, 100);

        // Check what columns to show based on data
        const hasInspection = displayRows.some(r =>
          (r.stats?.accepted ?? 0) > 0 ||
          (r.stats?.rejected ?? 0) > 0 ||
          (r.stats?.rework ?? 0) > 0
        );
        const hasNA = !hasInspection && displayRows.some(r => (r.stats?.na ?? 0) > 0);

        // Define columns - NOW INCLUDING REWORK
        let columns: string[] = [];
        if (hasInspection) {
          columns = ['accepted', 'rejected', 'rework'];
        } else if (hasNA) {
          columns = ['yes', 'no', 'na'];
        } else {
          columns = ['yes', 'no'];
        }

        const primaryCol = hasInspection ? 'accepted' : 'yes';
        const secondaryCol = hasInspection ? 'rejected' : 'no';

        // Column labels
        const colLabels: Record<string, string> = {
          yes: 'Yes', no: 'No', na: 'N/A',
          accepted: 'Accepted', rejected: 'Rejected', rework: 'Rework'
        };

        firstQuestionHTML += `<div style="margin-bottom: 30px;">
    <h3 style="font-size: 12px; font-weight: bold; margin-bottom: 10px; color: #1e40af; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">
      ${formTitle} (${rows.length} responses)
    </h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 8px;">
      <thead>
  <tr>
    <th style="
      border: 1px solid #1e3a8a;
      padding: 6px;
      text-align: left;
      color: white;
      font-weight: bold;
      background: linear-gradient(to bottom, #2948b8 0%, #1e3a8a 100%);
    ">
      Response Date
    </th>

    <th style="
      border: 1px solid #1e3a8a;
      padding: 6px;
      text-align: left;
      color: white;
      font-weight: bold;
      background: linear-gradient(to bottom, #2948b8 0%, #1e3a8a 100%)
    ">
      Question
    </th>

    <th style="
      border: 1px solid #1e3a8a;
      padding: 6px;
      text-align: left;
      color: white;
      font-weight: bold;
      background: linear-gradient(to bottom, #2948b8 0%, #1e3a8a 100%)
    ">
      Answer
    </th>`;

        for (const col of columns) {
          firstQuestionHTML += `
    <th style="
      border: 1px solid #1e3a8a;
      padding: 6px;
      text-align: center;
      color: white;
      font-weight: bold;
      background: linear-gradient(to bottom, #2948b8 0%, #1e3a8a 100%);
    ">
      ${colLabels[col]}
    </th>`;
        }

        firstQuestionHTML += `
<th style="
  border: 1px solid #1e3a8a;
  padding: 6px;
  text-align: center;
  color: white;
  font-weight: bold;
  background: linear-gradient(to bottom, #2948b8 0%, #1e3a8a 100%)
">
  ${hasInspection ? 'Acc/Rej/Rew' : (hasNA ? 'Yes/No/NA' : 'Yes/No')}
</th>          </tr>
        </thead>
        <tbody>`;

        for (const row of displayRows) {
          const stats = row.stats || { yes: 0, no: 0, na: 0, accepted: 0, rejected: 0, rework: 0 };
          const total = columns.reduce((s, c) => s + (stats[c] || 0), 0);

          firstQuestionHTML += `<tr>
      <td style="border: 1px solid #ddd; padding: 6px;">${formatTimestamp(row.createdAt)}</td>
      <td style="border: 1px solid #ddd; padding: 6px;">${row.firstQuestionText || ''}</td>
      <td style="border: 1px solid #ddd; padding: 6px; font-weight: bold; color: #2563eb;">${row.firstAnswerValue || ''}</td>`;

          for (const col of columns) {
            const count = stats[col] || 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            let colorClass = '';
            if (col === 'yes' || col === 'accepted') colorClass = 'text-green';
            else if (col === 'no' || col === 'rejected') colorClass = 'text-red';
            else if (col === 'rework') colorClass = 'text-amber';
            else colorClass = 'text-gray';

            firstQuestionHTML += `<td style="border: 1px solid #ddd; padding: 6px; text-align: center; font-weight: bold;" class="${colorClass}">
        ${count} ${pct > 0 ? `(${pct}%)` : ''}
      </td>`;
          }

          // Calculate percentages for visual bar
          const primaryCount = stats[primaryCol] || 0;
          const secondaryCount = stats[secondaryCol] || 0;
          const reworkCount = hasInspection ? (stats.rework || 0) : (hasNA ? (stats.na || 0) : 0);
          const barTotal = primaryCount + secondaryCount + reworkCount;
          const primaryPct = barTotal > 0 ? Math.round((primaryCount / barTotal) * 100) : 0;
          const secondaryPct = barTotal > 0 ? Math.round((secondaryCount / barTotal) * 100) : 0;
          const reworkPct = barTotal > 0 ? Math.round((reworkCount / barTotal) * 100) : 0;

          firstQuestionHTML += `<td style="border: 1px solid #ddd; padding: 6px; text-align: center;">
      <div style="display: inline-block;">
        <div class="compliance-bar" style="display: flex; height: 12px; width: 100px; border-radius: 3px; overflow: hidden; background: #e5e7eb;">
          ${primaryPct > 0 ? `<div class="bar-green" style="width: ${primaryPct}%; height: 100%; background: #22c55e;"></div>` : ''}
          ${secondaryPct > 0 ? `<div class="bar-red" style="width: ${secondaryPct}%; height: 100%; background: #ef4444;"></div>` : ''}
          ${reworkPct > 0 && hasInspection ? `<div class="bar-amber" style="width: ${reworkPct}%; height: 100%; background: #f59e0b;"></div>` : ''}
          ${reworkPct > 0 && hasNA ? `<div class="bar-gray" style="width: ${reworkPct}%; height: 100%; background: #9ca3af;"></div>` : ''}
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 7px; margin-top: 2px; width: 100px;">
          <span class="text-green" style="color: #16a34a;">${primaryPct}%</span>
          <span class="text-red" style="color: #dc2626;">${secondaryPct}%</span>
          ${reworkPct > 0 ? `<span class="${hasInspection ? 'text-amber' : 'text-gray'}" style="${hasInspection ? 'color: #d97706;' : 'color: #6b7280;'}">${reworkPct}%</span>` : ''}
        </div>
      </div>
    </td>
    </tr>`;
        }

        // Add footer totals row
        const colTotals: Record<string, number> = { yes: 0, no: 0, na: 0, accepted: 0, rejected: 0, rework: 0 };
        for (const row of displayRows) {
          const stats = row.stats || {};
          colTotals.yes += stats.yes || 0;
          colTotals.no += stats.no || 0;
          colTotals.na += stats.na || 0;
          colTotals.accepted += stats.accepted || 0;
          colTotals.rejected += stats.rejected || 0;
          colTotals.rework += stats.rework || 0;
        }

        const grandTotal = columns.reduce((s, c) => s + (colTotals[c] || 0), 0);
        const primaryTotal = colTotals[primaryCol] || 0;
        const secondaryTotal = colTotals[secondaryCol] || 0;
        const reworkTotal = hasInspection ? (colTotals.rework || 0) : (hasNA ? (colTotals.na || 0) : 0);
        const footerPrimaryPct = grandTotal > 0 ? Math.round((primaryTotal / grandTotal) * 100) : 0;
        const footerSecondaryPct = grandTotal > 0 ? Math.round((secondaryTotal / grandTotal) * 100) : 0;
        const footerReworkPct = grandTotal > 0 ? Math.round((reworkTotal / grandTotal) * 100) : 0;

        firstQuestionHTML += `<tr style="background: #dbeafe; font-weight: bold;">
    <td colspan="3" style="border: 1px solid #ddd; padding: 6px;">TOTAL (${Math.min(rows.length, 100)} shown)</td>`;

        for (const col of columns) {
          const total = colTotals[col] || 0;
          const pct = grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0;
          firstQuestionHTML += `<td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${total} (${pct}%)</td>`;
        }

        firstQuestionHTML += `<td style="border: 1px solid #ddd; padding: 6px; text-align: center;">
    <div style="display: inline-block;">
      <div class="compliance-bar" style="display: flex; height: 12px; width: 100px; border-radius: 3px; overflow: hidden; background: #e5e7eb;">
        ${footerPrimaryPct > 0 ? `<div style="width: ${footerPrimaryPct}%; height: 100%; background: #22c55e;"></div>` : ''}
        ${footerSecondaryPct > 0 ? `<div style="width: ${footerSecondaryPct}%; height: 100%; background: #ef4444;"></div>` : ''}
        ${footerReworkPct > 0 && hasInspection ? `<div style="width: ${footerReworkPct}%; height: 100%; background: #f59e0b;"></div>` : ''}
        ${footerReworkPct > 0 && hasNA ? `<div style="width: ${footerReworkPct}%; height: 100%; background: #9ca3af;"></div>` : ''}
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 7px; margin-top: 2px; width: 100px;">
        <span style="color: #16a34a;">${footerPrimaryPct}%</span>
        <span style="color: #dc2626;">${footerSecondaryPct}%</span>
        ${footerReworkPct > 0 ? `<span style="${hasInspection ? 'color: #d97706;' : 'color: #6b7280;'}">${footerReworkPct}%</span>` : ''}
      </div>
    </div>
  </td>
  </tr>`;

        firstQuestionHTML += `</tbody>
    </table>`;

        if (rows.length > 100) {
          firstQuestionHTML += `<div style="font-size: 8px; color: #888; margin-top: 5px;">Showing first 100 of ${rows.length} responses</div>`;
        }
        firstQuestionHTML += `</div>`;
      }
      // Generate Section Summary HTML (with Rework column)
      let sectionSummaryHTML = '<div style="text-align: center; padding: 40px;">No data available</div>';
      if (sectionSummaryRows.length > 0) {
        // Check what columns to show
        const hasInspection = sectionSummaryRows.some(r => r.accepted > 0 || r.rejected > 0 || r.rework > 0);
        const hasNA = !hasInspection && sectionSummaryRows.some(r => r.naCount > 0);

        // Define columns - INCLUDING REWORK
        let columns: string[] = [];
        if (hasInspection) {
          columns = ['accepted', 'rejected', 'rework'];
        } else if (hasNA) {
          columns = ['yes', 'no', 'na'];
        } else {
          columns = ['yes', 'no'];
        }

        const primaryCol = hasInspection ? 'accepted' : 'yes';
        const secondaryCol = hasInspection ? 'rejected' : 'no';
        const reworkCol = hasInspection ? 'rework' : (hasNA ? 'na' : null);

        // Column labels
        const colLabels: Record<string, string> = {
          yes: 'Yes', no: 'No', na: 'N/A',
          accepted: 'Accepted', rejected: 'Rejected', rework: 'Rework'
        };

        // Column colors
        const colColors: Record<string, string> = {
          yes: '#16a34a', no: '#dc2626', na: '#6b7280',
          accepted: '#16a34a', rejected: '#dc2626', rework: '#d97706'
        };

        // Calculate footer totals
        let footerTotals: any = { yes: 0, no: 0, na: 0, accepted: 0, rejected: 0, rework: 0 };
        sectionSummaryRows.forEach(r => {
          footerTotals.yes += r.yesCount || 0;
          footerTotals.no += r.noCount || 0;
          footerTotals.na += r.naCount || 0;
          footerTotals.accepted += r.accepted || 0;
          footerTotals.rejected += r.rejected || 0;
          footerTotals.rework += r.rework || 0;
        });

        const footerGrand = columns.reduce((s, col) => s + (footerTotals[col] || 0), 0);

        sectionSummaryHTML = `
    <div class="legend" style="display: flex; gap: 15px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb;">
      ${columns.map(col => `
        <div style="display: flex; align-items: center; gap: 5px;">
          <div style="width: 10px; height: 10px; border-radius: 2px; background: ${colColors[col]};"></div>
          <span style="font-size: 9px; font-weight: bold;">${colLabels[col]}</span>
        </div>
      `).join('')}
    </div>
    <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Section</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Total</th>
          ${columns.map(col => `<th style="border: 1px solid #ddd; padding: 8px; text-align: center; color: ${colColors[col]};">${colLabels[col]}</th>`).join('')}
          <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Visual</th>
        </tr>
      </thead>
      <tbody>`;

        for (const row of sectionSummaryRows) {
          const primaryCount = row[primaryCol === 'accepted' ? 'accepted' : (primaryCol === 'yes' ? 'yesCount' : 0)] || 0;
          const secondaryCount = row[secondaryCol === 'rejected' ? 'rejected' : (secondaryCol === 'no' ? 'noCount' : 0)] || 0;
          const reworkCount = reworkCol ? (reworkCol === 'rework' ? (row.rework || 0) : (reworkCol === 'na' ? (row.naCount || 0) : 0)) : 0;
          const barTotal = primaryCount + secondaryCount + reworkCount;

          const primaryPct = barTotal > 0 ? Math.round((primaryCount / barTotal) * 100) : 0;
          const secondaryPct = barTotal > 0 ? Math.round((secondaryCount / barTotal) * 100) : 0;
          const reworkPct = barTotal > 0 ? Math.round((reworkCount / barTotal) * 100) : 0;

          sectionSummaryHTML += `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold; color: #2563eb;">${row.title}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;">${row.total}</td>`;

          for (const col of columns) {
            let count = 0;
            if (col === 'yes') count = row.yesCount || 0;
            else if (col === 'no') count = row.noCount || 0;
            else if (col === 'na') count = row.naCount || 0;
            else if (col === 'accepted') count = row.accepted || 0;
            else if (col === 'rejected') count = row.rejected || 0;
            else if (col === 'rework') count = row.rework || 0;

            const pct = row.total > 0 ? Math.round((count / row.total) * 100) : 0;
            sectionSummaryHTML += `<td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: ${colColors[col]};">${count} (${pct}%)</td>`;
          }

          sectionSummaryHTML += `
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
          <div style="display: inline-block;">
            <div style="display: flex; height: 16px; width: 100px; border-radius: 4px; overflow: hidden; background: #e5e7eb;">
              ${primaryPct > 0 ? `<div style="background: ${primaryCol === 'accepted' ? '#22c55e' : '#22c55e'}; width: ${primaryPct}%; height: 100%;"></div>` : ''}
              ${secondaryPct > 0 ? `<div style="background: ${secondaryCol === 'rejected' ? '#ef4444' : '#ef4444'}; width: ${secondaryPct}%; height: 100%;"></div>` : ''}
              ${reworkPct > 0 && reworkCol ? `<div style="background: ${reworkCol === 'rework' ? '#f59e0b' : '#9ca3af'}; width: ${reworkPct}%; height: 100%;"></div>` : ''}
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 7px; margin-top: 2px; width: 100px;">
              <span style="color: #16a34a;">${primaryPct}%</span>
              <span style="color: #dc2626;">${secondaryPct}%</span>
              ${reworkPct > 0 && reworkCol ? `<span style="color: ${reworkCol === 'rework' ? '#d97706' : '#6b7280'};">${reworkPct}%</span>` : ''}
            </div>
          </div>
        </td>
      </tr>`;
        }

        // Footer row
        const footerPrimaryTotal = footerTotals[primaryCol] || 0;
        const footerSecondaryTotal = footerTotals[secondaryCol] || 0;
        const footerReworkTotal = reworkCol ? (footerTotals[reworkCol] || 0) : 0;
        const footerBarTotal = footerPrimaryTotal + footerSecondaryTotal + footerReworkTotal;
        const footerPrimaryPct = footerBarTotal > 0 ? Math.round((footerPrimaryTotal / footerBarTotal) * 100) : 0;
        const footerSecondaryPct = footerBarTotal > 0 ? Math.round((footerSecondaryTotal / footerBarTotal) * 100) : 0;
        const footerReworkPct = footerBarTotal > 0 ? Math.round((footerReworkTotal / footerBarTotal) * 100) : 0;

        sectionSummaryHTML += `
      <tr style="background: #dbeafe; font-weight: bold;">
        <td style="border: 1px solid #ddd; padding: 8px;">TOTAL</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${summaryTotals.total}</td>
        ${columns.map(col => {
          const total = footerTotals[col] || 0;
          const pct = footerGrand > 0 ? Math.round((total / footerGrand) * 100) : 0;
          return `<td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: ${colColors[col]};">${total} (${pct}%)</td>`;
        }).join('')}
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
          <div style="display: inline-block;">
            <div style="display: flex; height: 16px; width: 100px; border-radius: 4px; overflow: hidden; background: #e5e7eb;">
              ${footerPrimaryPct > 0 ? `<div style="background: ${primaryCol === 'accepted' ? '#22c55e' : '#22c55e'}; width: ${footerPrimaryPct}%; height: 100%;"></div>` : ''}
              ${footerSecondaryPct > 0 ? `<div style="background: ${secondaryCol === 'rejected' ? '#ef4444' : '#ef4444'}; width: ${footerSecondaryPct}%; height: 100%;"></div>` : ''}
              ${footerReworkPct > 0 && reworkCol ? `<div style="background: ${reworkCol === 'rework' ? '#f59e0b' : '#9ca3af'}; width: ${footerReworkPct}%; height: 100%;"></div>` : ''}
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 7px; margin-top: 2px; width: 100px;">
              <span style="color: #16a34a;">${footerPrimaryPct}%</span>
              <span style="color: #dc2626;">${footerSecondaryPct}%</span>
              ${footerReworkPct > 0 && reworkCol ? `<span style="color: ${reworkCol === 'rework' ? '#d97706' : '#6b7280'};">${footerReworkPct}%</span>` : ''}
            </div>
          </div>
        </td>
      </tr>`;

        sectionSummaryHTML += `</tbody></table>`;
      } const yesPercentage = summaryTotals.total > 0 ? Math.round((summaryTotals.yesCount / summaryTotals.total) * 100) : 0;
      const noPercentage = summaryTotals.total > 0 ? Math.round((summaryTotals.noCount / summaryTotals.total) * 100) : 0;
      const naPercentage = summaryTotals.total > 0 ? Math.round((summaryTotals.naCount / summaryTotals.total) * 100) : 0;

      const overallComplianceHTML = getOverallComplianceHTML(
        summaryTotals.yesCount,
        summaryTotals.noCount,
        summaryTotals.naCount,
        summaryTotals.total,
        yesPercentage,
        noPercentage,
        naPercentage
      );
      const defectDistributionHTML = getDefectDistributionHTML(processedDefectQuestions, defectDateRangeLabel);
      // Inside handleDownloadPdf, before generating the PDF, collect No Responses data
      const collectNoResponsesForPDF = () => {
        // Helper to recursively collect only relevant follow-up questions based on parent answer
        const collectFollowUpAnswersForPDF = (
          followUpQuestions: any[],
          answers: Record<string, any>,
          parentAnswer: any,
          level: number = 0
        ): Array<{ questionText: string; answer: string; level: number }> => {
          const result: Array<{ questionText: string; answer: string; level: number }> = [];

          for (const followUp of followUpQuestions) {
            // Check if this follow-up question should be shown based on parent answer
            let shouldShow = true;

            if (followUp.showWhen) {
              const conditionValue = followUp.showWhen.value;
              const parentAnswerStr = String(parentAnswer).toLowerCase().trim();
              const conditionValueStr = String(conditionValue).toLowerCase().trim();
              shouldShow = parentAnswerStr === conditionValueStr;
            }

            // Also check if the follow-up has a parentId reference
            if (followUp.parentId && !followUp.showWhen) {
              shouldShow = true;
            }

            if (shouldShow) {
              const answer = answers[followUp.id];
              if (answer !== undefined && answer !== null && answer !== "") {
                // Format answer for display
                let formattedAnswer = "";
                if (typeof answer === 'object' && answer !== null) {
                  if (answer.remark) formattedAnswer = answer.remark;
                  else if (answer.status) formattedAnswer = `Status: ${answer.status}`;
                  else if (answer.actionInitiated) formattedAnswer = `Action: ${answer.actionInitiated}`;
                  else if (answer.reasonForNotOK) formattedAnswer = `Reason: ${answer.reasonForNotOK}`;
                  else if (answer.responsiblePerson) formattedAnswer = `Responsible: ${answer.responsiblePerson}`;
                  else if (answer.review) formattedAnswer = `Review: ${answer.review}`;
                  else if (answer.fileUrl || answer.imageUrl) {
                    // Handle image URLs
                    const imgUrl = answer.fileUrl || answer.imageUrl;
                    formattedAnswer = `<img src="${imgUrl}" style="max-width: 350px; max-height: 250px; border-radius: 8px; margin-top: 8px;" /><br/><a href="${imgUrl}" target="_blank" style="font-size: 10px; color: #2563eb;">Open image ↗</a>`;
                  } else {
                    formattedAnswer = JSON.stringify(answer);
                  }
                } else if (typeof answer === 'string') {
                  // Check if it's an image URL
                  if (answer.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i) || answer.includes('cloudfront.net')) {
                    formattedAnswer = `<img src="${answer}" style="max-width: 350px; max-height: 250px; border-radius: 8px; margin-top: 8px;" /><br/><a href="${answer}" target="_blank" style="font-size: 10px; color: #2563eb;">Open image ↗</a>`;
                  } else {
                    formattedAnswer = answer;
                  }
                } else {
                  formattedAnswer = String(answer);
                }

                result.push({
                  questionText: followUp.text || followUp.label || followUp.id,
                  answer: formattedAnswer,
                  level
                });
              }

              // Recursively check for nested follow-ups
              if (followUp.followUpQuestions && followUp.followUpQuestions.length > 0) {
                const nestedAnswer = answers[followUp.id];
                if (nestedAnswer !== undefined && nestedAnswer !== null && nestedAnswer !== "") {
                  const nested = collectFollowUpAnswersForPDF(
                    followUp.followUpQuestions,
                    answers,
                    nestedAnswer,
                    level + 1
                  );
                  result.push(...nested);
                }
              }
            }
          }
          return result;
        };

        // Helper to find a question and its follow-ups in the form structure
        const findQuestionWithFollowUpsForPDF = (
          form: Form | undefined,
          questionId: string
        ): { question: any; followUps: any[] } | null => {
          if (!form?.sections) return null;

          for (const section of form.sections) {
            for (const question of section.questions || []) {
              if (question.id === questionId) {
                return { question, followUps: question.followUpQuestions || [] };
              }
              // Check follow-up questions
              if (question.followUpQuestions) {
                for (const fq of question.followUpQuestions) {
                  if (fq.id === questionId) {
                    return { question: fq, followUps: fq.followUpQuestions || [] };
                  }
                }
              }
            }
          }
          return null;
        };

        const noResponsesData: any[] = [];

        filteredResponses.forEach((response) => {
          const answers = response.answers || {};
          const formId = response.questionId || response.formId || "";
          const form = formsMap.get(formId);
          const dealerName = response.dealerName || "Unknown Dealer";

          Object.entries(answers).forEach(([qId, answer]) => {
            if (answer === undefined || answer === null || answer === "") return;

            // Check if this is a No/Rejected answer
            let isNoResponse = false;
            let answerValue = "";

            const answerStr = String(answer).toLowerCase().trim();

            if (answerStr === "no" || answerStr === "rejected" || answerStr === "reject") {
              isNoResponse = true;
              answerValue = String(answer);
            } else if (typeof answer === "object" && answer !== null) {
              const status = String(answer.status || "").toLowerCase().trim();
              if (status === "rejected" || status === "no") {
                isNoResponse = true;
                answerValue = answer.status || "Rejected";
              }
            }

            if (!isNoResponse) return;

            // Get question text and follow-ups
            let questionText = qId;
            let followUpData: Array<{ questionText: string; answer: string; level: number }> = [];

            if (form) {
              const found = findQuestionWithFollowUpsForPDF(form, qId);
              if (found) {
                questionText = found.question.text || found.question.label || qId;
                // Pass the current answer (which is "No") as the parent answer to filter follow-ups
                followUpData = collectFollowUpAnswersForPDF(found.followUps, answers, answerValue, 0);
              }
            } else {
              // Fallback to stored question texts
              questionText = (response as any).questionTexts?.[qId] || qId;
            }

            noResponsesData.push({
              formTitle: response.formTitle,
              dealerName: dealerName,
              questionText: questionText,
              answer: answerValue,
              responseDate: formatTimestamp(response.createdAt),
              responseId: response._id || response.id,
              followUpData: followUpData,
            });
          });
        });

        return noResponsesData;
      };
      const totalAnsweredByForm = new Map<string, number>();

      filteredResponses.forEach(response => {
        const formTitle = response.formTitle;
        const stats = response.stats || { yes: 0, no: 0, na: 0, accepted: 0, rejected: 0, rework: 0 };

        // Calculate total answered for this response (sum of all answers)
        let responseTotal = 0;

        // Check if using Yes/No/NA system
        if (stats.yes > 0 || stats.no > 0 || stats.na > 0) {
          responseTotal = (stats.yes || 0) + (stats.no || 0) + (stats.na || 0);
        }
        // Check if using Accepted/Rejected/Rework system
        else if (stats.accepted > 0 || stats.rejected > 0 || stats.rework > 0) {
          responseTotal = (stats.accepted || 0) + (stats.rejected || 0) + (stats.rework || 0);
        }

        totalAnsweredByForm.set(formTitle, (totalAnsweredByForm.get(formTitle) || 0) + responseTotal);
      });

      // Now pass this to getNoResponsesHTML
      const noResponsesData = collectNoResponsesForPDF(); // Your existing function
      const noResponsesHTML = getNoResponsesHTML(noResponsesData, totalAnsweredByForm);

      const formWiseSectionsForPDF = formWiseSectionStats.map(form => {
        const detectionType = detectColumnTypeForForm(form);
        return {
          formId: form.formId,
          formTitle: form.formTitle,
          totalResponses: form.totalResponses,
          totalYes: form.totalYes,
          totalNo: form.totalNo,
          totalNa: form.totalNa,
          detectionType: detectionType.type,
          sections: form.sections.map(section => ({
            sectionTitle: section.sectionTitle,
            yesCount: section.yesCount,
            noCount: section.noCount,
            naCount: section.naCount,
            total: section.total,
            yesPercent: section.total > 0 ? (section.yesCount / section.total) * 100 : 0,
            noPercent: section.total > 0 ? (section.noCount / section.total) * 100 : 0,
            naPercent: section.total > 0 ? (section.naCount / section.total) * 100 : 0,
          }))
        };
      });

      const Sectionsummary = getSectionSummaryHTML(formWiseSectionsForPDF);


      // Build complete HTML and generate PDF
      const pdfHTML = buildOverallPDFHTML(
        coverPage,
        overallComplianceHTML,
        firstQuestionHTML || '<div>No responses found</div>',
        sectionSummaryHTML, defectDistributionHTML, noResponsesHTML,
        Sectionsummary, logoBase64, templateBase64, otherTemplateBase64
      ); const filename = `Overall_Analytics_${new Date().toISOString().split("T")[0]}.pdf`;
      const pdfBlob = await generateOverallPDF(pdfHTML, filename);
      downloadPDF(pdfBlob, filename);

    } catch (err) {
      console.error("PDF generation failed", err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  // ─── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [responsesData, formsData] = await Promise.all([
        apiClient.getResponses(),
        apiClient.getForms(),
      ]);

      const formsMapObj = formsData.forms.reduce((map: Record<string, Form>, form: any) => {
        if (form?._id) map[form._id] = form;
        if (form?.id) map[form.id] = form;
        return map;
      }, {});

      // ✅ ADD THIS LINE - Populate formsMap state
      setFormsMap(new Map(Object.entries(formsMapObj)));
      const dealerQuestionMap = new Map<string, string>();
      Object.values(formsMapObj).forEach((form: any) => {
        const fid = form._id || form.id;
        if (!fid) return;
        if (form.sections?.length > 0) {
          const first = form.sections[0];
          if (first.questions?.length > 0) {
            for (const q of first.questions) {
              const txt = (q.text || q.label || "").toLowerCase();
              if (
                txt.includes("dealer") ||
                txt.includes("distributor") ||
                txt.includes("store") ||
                txt.includes("business")
              ) {
                dealerQuestionMap.set(fid, q.id);
                break;
              }
            }
          }
        }
      });

      const extractDealer = (response: any, form: Form | undefined) => {
        if (!form || !response.answers) return { name: null, rank: null };
        const fid = form._id || form.id;
        if (!fid) return { name: null, rank: null };
        const dqid = dealerQuestionMap.get(fid);
        if (dqid) {
          const ans = response.answers[dqid];
          if (ans && hasAnswerValue(ans)) {
            return {
              name: renderAnswerDisplay(ans),
              rank: response.responseRanks?.[dqid] || null,
            };
          }
        }
        if (form.sections?.length > 0) {
          const first = form.sections[0];
          if (first.questions?.length > 0) {
            for (const q of first.questions) {
              const ans = response.answers[q.id];
              if (ans && hasAnswerValue(ans)) {
                return {
                  name: renderAnswerDisplay(ans),
                  rank: response.responseRanks?.[q.id] || null,
                };
              }
            }
          }
        }
        return { name: null, rank: null };
      };

      const withTitles = responsesData.responses.map((r: any) => {
        const actualFormId = r.questionId || r.formId;
        const form = formsMapObj[actualFormId];
        const dealer = extractDealer(r, form);

        let firstQ = "Unknown Question";
        let firstA = "N/A";
        const questionTexts: Record<string, string> = {};

        if (form && form.sections?.length > 0) {
          // IMPORTANT: Loop through ALL sections and questions
          for (const section of form.sections) {
            if (section.questions?.length > 0) {
              for (const q of section.questions) {
                // Store the mapping using the question's actual ID from the form
                if (q.id) {
                  questionTexts[q.id] = q.text || q.label || `Question: ${q.id.substring(0, 8)}`;
                  console.log(`Mapping: ${q.id} -> "${q.text}"`);
                }

                // Also handle follow-up questions
                if (q.followUpQuestions) {
                  for (const fq of q.followUpQuestions) {
                    if (fq.id) {
                      questionTexts[fq.id] = fq.text || fq.label || `Follow-up: ${fq.id.substring(0, 8)}`;
                      console.log(`Mapping follow-up: ${fq.id} -> "${fq.text}"`);
                    }
                  }
                }
              }
            }
          }

          // Get first question for display
          if (form.sections[0]?.questions?.[0]) {
            const q = form.sections[0].questions[0];
            firstQ = q.text || q.label || q.id || "Unknown Question";
            firstA = renderAnswerDisplay(r.answers?.[q.id]) || "N/A";
          }
        }

        // Log what we're storing for this response
        console.log(`Response ${r._id} (${form?.title}) has ${Object.keys(questionTexts).length} question mappings`);

        return {
          ...r,
          actualFormId: actualFormId,
          formTitle: form?.title || "Unknown Form",
          yesNoScore: form ? computeYesNoScore(r.answers, form) : undefined,
          stats: computeResponseStats(r.answers),
          dealerName: dealer.name || "Unknown",
          dealerRank: dealer.rank,
          firstQuestionText: firstQ,
          firstAnswerValue: firstA,
          questionTexts: questionTexts,
        };
      });

      setResponses(withTitles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load responses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const actualSectionStats = useMemo(() => {
    const map = new Map<string, ActualSectionStats>();

    filteredResponses.forEach((response) => {
      const formId = response.questionId || response.formId || "";
      const form = formsMap.get(formId);
      const formTitle = response.formTitle;
      const answers = response.answers || {};
      const stats = response.stats || { yes: 0, no: 0, na: 0, accepted: 0, rejected: 0, rework: 0 };

      if (!form?.sections) {
        // If no sections in form, create a default "General" section
        const key = `${formId}_general`;
        if (!map.has(key)) {
          map.set(key, {
            id: key,
            formId,
            formTitle,
            sectionId: "general",
            sectionTitle: `${formTitle} - General`,
            yes: 0,
            no: 0,
            na: 0,
            accepted: 0,
            rejected: 0,
            rework: 0,
            total: 0,
          });
        }
        const sectionStat = map.get(key)!;
        sectionStat.yes += stats.yes;
        sectionStat.no += stats.no;
        sectionStat.na += stats.na;
        sectionStat.accepted += stats.accepted;
        sectionStat.rejected += stats.rejected;
        sectionStat.rework += stats.rework;
        sectionStat.total += stats.yes + stats.no + stats.na + stats.accepted + stats.rejected + stats.rework;
        return;
      }

      // Process each actual section in the form
      form.sections.forEach((section: any) => {
        const sectionId = section.id || section._id || section.title;
        const key = `${formId}_${sectionId}`;

        if (!map.has(key)) {
          map.set(key, {
            id: key,
            formId,
            formTitle,
            sectionId,
            sectionTitle: section.title || "Untitled Section",
            yes: 0,
            no: 0,
            na: 0,
            accepted: 0,
            rejected: 0,
            rework: 0,
            total: 0,
          });
        }

        const sectionStat = map.get(key)!;

        // Get questions for this section only
        const sectionQuestions = section.questions || [];

        // Count responses for this specific section
        let sectionYes = 0, sectionNo = 0, sectionNa = 0;
        let sectionAccepted = 0, sectionRejected = 0, sectionRework = 0;

        sectionQuestions.forEach((question: any) => {
          const answer = answers[question.id];
          if (answer === undefined || answer === null || answer === "") return;

          const answerStr = String(answer).toLowerCase().trim();

          // Check for inspection status (Accepted/Rejected/Rework)
          if (typeof answer === "object" && answer.status) {
            const status = String(answer.status).toLowerCase().trim();
            if (status === "accepted" || status === "rework completed" || status === "verified") {
              sectionAccepted++;
            } else if (status === "rejected") {
              sectionRejected++;
            } else if (status === "rework" || status === "reworked" || status.includes("re-rework")) {
              sectionRework++;
            }
          }
          // Check for Yes/No/NA answers
          else if (question.type === "yesNoNA" || question.options?.length >= 2) {
            if (answerStr === "yes" || answerStr === "y") {
              sectionYes++;
            } else if (answerStr === "no" || answerStr === "n") {
              sectionNo++;
            } else if (answerStr === "na" || answerStr === "n/a" || answerStr === "not applicable") {
              sectionNa++;
            }
          }
          // Handle string answers that might be inspection statuses
          else if (answerStr === "accepted" || answerStr === "rework completed" || answerStr === "verified") {
            sectionAccepted++;
          } else if (answerStr === "rejected") {
            sectionRejected++;
          } else if (answerStr === "rework" || answerStr === "reworked" || answerStr.includes("re-rework")) {
            sectionRework++;
          } else if (answerStr === "yes") {
            sectionYes++;
          } else if (answerStr === "no") {
            sectionNo++;
          } else if (answerStr === "na" || answerStr === "n/a") {
            sectionNa++;
          }
        });

        sectionStat.yes += sectionYes;
        sectionStat.no += sectionNo;
        sectionStat.na += sectionNa;
        sectionStat.accepted += sectionAccepted;
        sectionStat.rejected += sectionRejected;
        sectionStat.rework += sectionRework;
        sectionStat.total += sectionYes + sectionNo + sectionNa + sectionAccepted + sectionRejected + sectionRework;
      });
    });

    return Array.from(map.values()).filter(stat => stat.total > 0);
  }, [responses, formsMap]);

  const uniqueSections = useMemo(() => {
    return actualSectionStats.map(s => ({
      id: s.id,
      title: s.sectionTitle,
      formTitle: s.formTitle
    }));
  }, [actualSectionStats]);

  // Filter sections based on selection (show all if none selected)
  const visibleActualSectionStats = useMemo(() => {
    if (selectedSectionIds.length === 0) return actualSectionStats;
    return actualSectionStats.filter(s => selectedSectionIds.includes(s.id));
  }, [actualSectionStats, selectedSectionIds]);

  // Section summary rows with percentages
  const actualSectionSummaryRows = useMemo(() => {
    return visibleActualSectionStats.map((s) => {
      const totalYes = s.yes + s.accepted;
      const totalNo = s.no + s.rejected;
      const totalNA = s.na + s.rework;
      const total = s.total;

      return {
        id: s.id,
        formId: s.formId,
        formTitle: s.formTitle,
        title: s.sectionTitle,
        total,
        yesCount: totalYes,
        noCount: totalNo,
        naCount: totalNA,
        accepted: s.accepted,
        rejected: s.rejected,
        rework: s.rework,
        yes: s.yes,
        no: s.no,
        na: s.na,
        yesPercent: total > 0 ? (totalYes / total) * 100 : 0,
        noPercent: total > 0 ? (totalNo / total) * 100 : 0,
        naPercent: total > 0 ? (totalNA / total) * 100 : 0,
      };
    }).sort((a, b) => b.total - a.total);
  }, [visibleActualSectionStats]);

  // Summary totals
  const actualSummaryTotals = useMemo(() => {
    return actualSectionSummaryRows.reduce(
      (acc, r) => ({
        total: acc.total + r.total,
        yesCount: acc.yesCount + r.yesCount,
        noCount: acc.noCount + r.noCount,
        naCount: acc.naCount + r.naCount,
      }),
      { total: 0, yesCount: 0, noCount: 0, naCount: 0 }
    );
  }, [actualSectionSummaryRows]);

  // Detect column types from actual sections
  const getSectionColumns = (rows: typeof actualSectionSummaryRows) => {
    const hasInspection = rows.some(r => (r.accepted || 0) > 0 || (r.rejected || 0) > 0 || (r.rework || 0) > 0);
    const hasNA = !hasInspection && rows.some(r => (r.naCount || 0) > 0);

    if (hasInspection) {
      return { columns: ["accepted", "rejected", "rework"] as const, hasInspection, hasNA: false };
    }
    if (hasNA) {
      return { columns: ["yes", "no", "na"] as const, hasInspection: false, hasNA: true };
    }
    return { columns: ["yes", "no"] as const, hasInspection: false, hasNA: false };
  };
  // ─── Derived ───────────────────────────────────────────────────────────────

  const uniqueForms = useMemo(() => {
    const map = new Map<string, { id: string; title: string }>();
    responses.forEach((r) => {
      const key = r.questionId || r.formId || "";
      if (key && !map.has(key)) map.set(key, { id: key, title: r.formTitle });
    });
    return Array.from(map.values()).sort((a, b) =>
      a.title.localeCompare(b.title),
    );
  }, [responses]);



  const groupedResponses: GroupedByFormAndDate = useMemo(() => {
    return filteredResponses.reduce((groups, r) => {
      const formTitle = r.formTitle || "Unknown Form";
      if (!groups[formTitle]) groups[formTitle] = {};
      const date = new Date(r.createdAt).toDateString();
      if (!groups[formTitle][date]) groups[formTitle][date] = [];
      groups[formTitle][date].push(r);
      return groups;
    }, {} as GroupedByFormAndDate);
  }, [filteredResponses]);

  // ─── Stats ─────────────────────────────────────────────────────────────────

  const totalResponses = filteredResponses.length;
  const totalYes = filteredResponses.reduce((s, r) => s + (r.yesNoScore?.yes || 0), 0);
  const totalQuestions = filteredResponses.reduce(
    (s, r) => s + (r.yesNoScore?.total || 0),
    0,
  );
  const totalNo = totalQuestions - totalYes;
  const overallScore =
    totalQuestions > 0 ? ((totalYes / totalQuestions) * 100).toFixed(1) : "0.0";
  const yesPercent =
    totalQuestions > 0 ? ((totalYes / totalQuestions) * 100).toFixed(1) : "0.0";
  const noPercent =
    totalQuestions > 0 ? ((totalNo / totalQuestions) * 100).toFixed(1) : "0.0";

  // Form-level aggregation
  const formStats = useMemo(() => {
    const map = new Map<
      string,
      { title: string; count: number; yes: number; total: number }
    >();
    filteredResponses.forEach((r) => {
      const key = r.questionId || r.formId || "";
      if (!key) return;
      if (!map.has(key))
        map.set(key, { title: r.formTitle, count: 0, yes: 0, total: 0 });
      const s = map.get(key)!;
      s.count++;
      s.yes += r.yesNoScore?.yes || 0;
      s.total += r.yesNoScore?.total || 0;
    });
    return Array.from(map.values());
  }, [filteredResponses]);

  // Section-level stats aggregated from all responses
  const sectionStats = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        title: string;
        yes: number;
        no: number;
        na: number;
        accepted: number;
        rejected: number;
        rework: number;
        total: number;
      }
    >();
    filteredResponses.forEach((r) => {
      if (!r.stats) return;
      const key = r.questionId || r.formId || "";
      const title = r.formTitle;
      if (!key) return;
      if (!map.has(key))
        map.set(key, {
          id: key,
          title,
          yes: 0,
          no: 0,
          na: 0,
          accepted: 0,
          rejected: 0,
          rework: 0,
          total: 0,
        });
      const s = map.get(key)!;
      s.yes += r.stats.yes;
      s.no += r.stats.no;
      s.na += r.stats.na;
      s.accepted += r.stats.accepted;
      s.rejected += r.stats.rejected;
      s.rework += r.stats.rework;
      s.total +=
        r.stats.yes +
        r.stats.no +
        r.stats.na +
        r.stats.accepted +
        r.stats.rejected +
        r.stats.rework;
    });
    return Array.from(map.values());
  }, [filteredResponses, formsMap]);

  const visibleSectionStats = useMemo(() => {
    if (selectedSectionIds.length === 0) return sectionStats;
    return sectionStats.filter((s) => selectedSectionIds.includes(s.id));
  }, [sectionStats, selectedSectionIds]);

  const sectionSummaryRows = useMemo(
    () =>
      visibleSectionStats.map((s) => ({
        ...s,
        yesPercent: s.total > 0 ? ((s.yes + s.accepted) / s.total) * 100 : 0,
        noPercent: s.total > 0 ? ((s.no + s.rejected) / s.total) * 100 : 0,
        naPercent: s.total > 0 ? ((s.na + s.rework) / s.total) * 100 : 0,
        yesCount: s.yes + s.accepted,
        noCount: s.no + s.rejected,
        naCount: s.na + s.rework,
      })),
    [visibleSectionStats],
  );

  const summaryTotals = useMemo(
    () =>
      sectionSummaryRows.reduce(
        (acc, r) => ({
          total: acc.total + r.total,
          yesCount: acc.yesCount + r.yesCount,
          noCount: acc.noCount + r.noCount,
          naCount: acc.naCount + r.naCount,
        }),
        { total: 0, yesCount: 0, noCount: 0, naCount: 0 },
      ),
    [sectionSummaryRows],
  );

  const generateTableBarChart = (
    yesPct: number,
    noPct: number,
    naPct: number,
  ) => {
    const y = Math.round(yesPct),
      n = Math.round(noPct),
      na = Math.round(naPct);
    return (
      <div className="flex h-4 w-32 rounded overflow-hidden bg-gray-100 dark:bg-gray-700">
        {y > 0 && (
          <div
            className="bg-green-500"
            style={{ width: `${y}%` }}
            title={`Yes ${y}%`}
          />
        )}
        {n > 0 && (
          <div
            className="bg-red-500"
            style={{ width: `${n}%` }}
            title={`No ${n}%`}
          />
        )}
        {na > 0 && (
          <div
            className="bg-gray-400"
            style={{ width: `${na}%` }}
            title={`N/A ${na}%`}
          />
        )}
      </div>
    );
  };

  // Daily trend (last 7 days)
  const dailyTrend = useMemo(() => {
    const days: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const dateStr = d.toDateString();
      const count = filteredResponses.filter(
        (r) => new Date(r.createdAt).toDateString() === dateStr,
      ).length;
      days.push({ date: label, count });
    }
    return days;
  }, [filteredResponses]);

  // ─── Chart Data ────────────────────────────────────────────────────────────

  const lineData = {
    labels: dailyTrend.map((d) => d.date),
    datasets: [
      {
        label: "Responses",
        data: dailyTrend.map((d) => d.count),
        borderColor: "#1d4ed8",
        backgroundColor: "rgba(29,78,216,0.12)",
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: "#1d4ed8",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
      },
    ],
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: "#374151" }, grid: { color: "#e5e7eb" } },
      y: {
        ticks: { color: "#374151" },
        grid: { color: "#e5e7eb" },
        beginAtZero: true,
      },
    },
  };

  const radarData = {
    labels: visibleSectionStats.map((s) =>
      s.title.length > 14 ? s.title.slice(0, 14) + "…" : s.title,
    ),
    datasets: [
      {
        label: "Yes %",
        data: visibleSectionStats.map((s) =>
          s.total > 0 ? ((s.yes + s.accepted) / s.total) * 100 : 0,
        ),
        backgroundColor: "rgba(34,197,94,0.2)",
        borderColor: "rgba(34,197,94,1)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(34,197,94,1)",
        pointBorderColor: "#fff",
        pointHoverBackgroundColor: "#fff",
        pointHoverBorderColor: "rgba(34,197,94,1)",
      },
      {
        label: "No %",
        data: visibleSectionStats.map((s) =>
          s.total > 0 ? ((s.no + s.rejected) / s.total) * 100 : 0,
        ),
        backgroundColor: "rgba(239,68,68,0.2)",
        borderColor: "rgba(239,68,68,1)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(239,68,68,1)",
        pointBorderColor: "#fff",
        pointHoverBackgroundColor: "#fff",
        pointHoverBorderColor: "rgba(239,68,68,1)",
      },
      {
        label: "N/A %",
        data: visibleSectionStats.map((s) =>
          s.total > 0 ? ((s.na + s.rework) / s.total) * 100 : 0,
        ),
        backgroundColor: "rgba(156,163,175,0.2)",
        borderColor: "rgba(156,163,175,1)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(156,163,175,1)",
        pointBorderColor: "#fff",
        pointHoverBackgroundColor: "#fff",
        pointHoverBorderColor: "rgba(156,163,175,1)",
      },
    ],
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        suggestedMin: 0,
        suggestedMax: 100,
        angleLines: {
          display: true,
          color: "rgba(59,130,246,0.3)",
          lineWidth: 1.5,
        },
        grid: { color: "rgba(59,130,246,0.2)", lineWidth: 1.5 },
        pointLabels: { font: { size: 10 }, color: "#374151" },
        ticks: {
          backdropColor: "transparent",
          color: "#6b7280",
          font: { size: 11 },
        },
      },
    },
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: { font: { size: 10 }, padding: 12, color: "#374151" },
      },
      tooltip: {
        callbacks: {
          label: (c: any) => `${c.dataset.label}: ${c.raw.toFixed(1)}%`,
        },
      },
    },
  };

  const donutData = {
    labels: [
      "Yes / Accepted",
      "No / Rejected",
      ...(summaryTotals.naCount > 0 ? ["N/A / Rework"] : []),
    ],
    datasets: [
      {
        data: [
          summaryTotals.yesCount,
          summaryTotals.noCount,
          ...(summaryTotals.naCount > 0 ? [summaryTotals.naCount] : []),
        ],
        backgroundColor: [
          "#22c55e",
          "#ef4444",
          ...(summaryTotals.naCount > 0 ? ["#9ca3af"] : []),
        ],
        borderWidth: 0,
      },
    ],
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "70%",
    plugins: {
      legend: {
        position: "right" as const,
        labels: { font: { size: 12 }, color: "#374151", padding: 20 },
      },
      tooltip: {
        callbacks: {
          label: (c: any) => {
            const val = c.raw;
            const total = summaryTotals.total;
            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
            return ` ${c.label}: ${val} (${pct}%)`;
          },
        },
      },
    },
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="text-red-600 mb-2">Error loading data</div>
        <div className="text-gray-500">{error}</div>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-blue-100/50 dark:from-gray-900 dark:to-gray-800 p-4 sm:p-6 md:p-8">
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="mb-6 sm:mb-8 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-900/10 dark:to-indigo-900/10 p-4 sm:p-5 rounded-2xl border border-blue-100 dark:border-blue-800/20 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-xl shadow-inner flex-shrink-0">
              <BarChart2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                Overall Statistics
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium mt-0.5">
                Customer request data summary
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:flex-1 lg:max-w-2xl lg:justify-end">
            {/* Search */}
            <div className="relative flex-1 sm:max-w-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-4 w-4 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800/50 border border-blue-200 dark:border-blue-700/50 rounded-xl text-gray-900 dark:text-white placeholder-blue-300 dark:placeholder-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Download PDF */}
              <button
                onClick={handleDownloadPdf}
                disabled={isDownloading || loading}
                className="px-4 py-2.5 text-white rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap shadow-md hover:shadow-lg text-sm active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: "#1e3a8a" }}
              >
                <Download className={`w-4 h-4 ${isDownloading ? "animate-bounce" : ""}`} />
                <span>{isDownloading ? "Generating..." : "PDF"}</span>
              </button>

              {/* Refresh */}
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2.5 text-gray-500 hover:text-blue-600 bg-white dark:bg-gray-800/50 border border-blue-100 dark:border-blue-700/50 rounded-xl transition-all hover:shadow-md disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw
                  className={`w-5 h-5 ${loading ? "animate-spin" : ""}`}
                />
              </button>

              {/* Form Filter */}
              <div className="relative" ref={formFilterRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFormFilter();
                  }}
                  className={`px-4 py-2.5 text-white rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap shadow-md hover:shadow-lg text-sm active:scale-95 ${showFormFilter ? "ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-gray-900" : ""}`}
                  style={{ backgroundColor: "#1e3a8a" }}
                >
                  <List className="w-4 h-4" />
                  <span>
                    Forms (
                    {selectedFormIds.length === 0
                      ? uniqueForms.length
                      : selectedFormIds.includes("NONE_SELECTED")
                        ? 0
                        : selectedFormIds.length}
                    )
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${showFormFilter ? "rotate-180" : ""}`}
                  />
                </button>

                {showFormFilter && (
                  <div className="absolute top-full right-0 mt-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-[999] w-72 sm:w-80 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 px-4 py-4 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                          Filter by Form
                        </h4>
                        <button
                          onClick={closeFormFilter}
                          className="p-1.5 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <XCircle className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedFormIds([])}
                          className="flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white rounded-lg hover:opacity-90"
                          style={{ backgroundColor: "#1e3a8a" }}
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => setSelectedFormIds(["NONE_SELECTED"])}
                          className="flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto py-2">
                      {uniqueForms.map((form) => {
                        const isChecked =
                          selectedFormIds.length === 0 ||
                          (selectedFormIds.includes(form.id) &&
                            !selectedFormIds.includes("NONE_SELECTED"));

                        return (
                          <label
                            key={form.id}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                const allIds = uniqueForms.map((f) => f.id);

                                if (selectedFormIds.length === 0) {
                                  if (checked) return;
                                  setSelectedFormIds(allIds.filter((id) => id !== form.id));
                                } else if (selectedFormIds.includes("NONE_SELECTED")) {
                                  if (checked) setSelectedFormIds([form.id]);
                                } else {
                                  if (checked) {
                                    const next = [...selectedFormIds, form.id];
                                    setSelectedFormIds(
                                      next.length === allIds.length ? [] : next,
                                    );
                                  } else {
                                    const next = selectedFormIds.filter(
                                      (id) => id !== form.id,
                                    );
                                    setSelectedFormIds(
                                      next.length === 0 ? ["NONE_SELECTED"] : next,
                                    );
                                  }
                                }
                              }}
                              className="w-4 h-4 rounded cursor-pointer"
                              style={{ accentColor: "#1e3a8a" }}
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 block truncate">
                                {form.title}
                              </span>
                              <span className="text-[10px] text-gray-500">
                                {
                                  responses.filter(
                                    (r) => (r.questionId || r.formId) === form.id,
                                  ).length
                                }{" "}
                                responses
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">
                        {selectedFormIds.length === 0
                          ? uniqueForms.length
                          : selectedFormIds.includes("NONE_SELECTED")
                            ? 0
                            : selectedFormIds.length}{" "}
                        of {uniqueForms.length} selected
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 mb-6 rounded-xl overflow-hidden shadow-sm border border-blue-100 dark:border-blue-800/30">
        <div className="flex">
          {(
            [
              { key: "summary", label: "Summary & Analytics" },
              { key: "requests", label: "Customer Requests" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all duration-200 ${activeTab === tab.key
                ? "text-white"
                : "text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/10"
                }`}
              style={
                activeTab === tab.key ? { backgroundColor: "#1e3a8a" } : {}
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          SUMMARY TAB
      ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "summary" && (
        <div className="space-y-6" id="pdf-content-container">
          {/*   liance Donut Chart */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-800/30 flex flex-col sm:flex-row items-start gap-8">
            <div className="flex-1 w-full">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3 mb-2">
                <PieChart className="w-6 h-6 text-blue-600 dark:text-blue-400" /> Overall Compliancesss
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Yes and No percentages in overall responses
              </p>

              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800/30">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="font-semibold text-green-900 dark:text-green-100">Yes / Accepted</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-lg text-green-700 dark:text-green-300">{summaryTotals.yesCount}</span>
                    <span className="text-xs font-bold text-green-600/70 ml-2">
                      ({summaryTotals.total > 0 ? Math.round((summaryTotals.yesCount / summaryTotals.total) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800/30">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="font-semibold text-red-900 dark:text-red-100">No / Rejected</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-lg text-red-700 dark:text-red-300">{summaryTotals.noCount}</span>
                    <span className="text-xs font-bold text-red-600/70 ml-2">
                      ({summaryTotals.total > 0 ? Math.round((summaryTotals.noCount / summaryTotals.total) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                {summaryTotals.naCount > 0 && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">N/A / Rework</span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-lg text-gray-700 dark:text-gray-300">{summaryTotals.naCount}</span>
                      <span className="text-xs font-bold text-gray-500 ml-2">
                        ({summaryTotals.total > 0 ? Math.round((summaryTotals.naCount / summaryTotals.total) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Chart on the RIGHT side */}
            <div className="w-full sm:w-[320px] md:w-[380px] flex-shrink-0 flex justify-end items-center h-[280px]">
              <Doughnut data={donutData} options={donutOptions} />
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-pdf">
            {/* Total Responses */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-xl border border-blue-200/50 dark:border-blue-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1 uppercase tracking-wider">
                    Total Requests
                  </p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {totalResponses}
                  </p>
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
                    Across {uniqueForms.length} forms
                  </p>
                </div>
                <div className="p-2.5 bg-blue-500/20 rounded-full">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>

            {/* Active Forms */}
            <div className="bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 p-4 rounded-xl border border-sky-200/50 dark:border-sky-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-sky-700 dark:text-sky-300 mb-1 uppercase tracking-wider">
                    Active Forms
                  </p>
                  <p className="text-2xl font-bold text-sky-900 dark:text-sky-100">
                    {uniqueForms.length}
                  </p>
                  <p className="text-[10px] text-sky-600 dark:text-sky-400 mt-1">
                    Collecting responses
                  </p>
                </div>
                <div className="p-2.5 bg-sky-500/20 rounded-full">
                  <Target className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                </div>
              </div>
            </div>

            {/* Yes Total */}
            <div
              className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-xl border border-green-200/50 dark:border-green-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer"
              onClick={() => setExpandRate(!expandRate)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1 uppercase tracking-wider">
                      Yes Total
                    </p>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-green-600 transition-transform duration-300 ${expandRate ? "rotate-180" : ""}`}
                    />
                  </div>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {totalYes}
                  </p>
                  <p className="text-[10px] text-green-600 dark:text-green-400 mt-1">
                    of {totalQuestions} questions
                  </p>
                </div>
                <div className="p-2.5 bg-green-500/20 rounded-full">
                  <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
              {expandRate && (
                <div className="mt-3 pt-3 border-t border-green-300/50 grid grid-cols-2 gap-2">
                  <div className="bg-white/50 dark:bg-green-900/20 p-2 rounded-lg">
                    <p className="text-[10px] font-bold text-green-600 uppercase mb-0.5">
                      Yes
                    </p>
                    <p className="text-lg font-black text-green-700 dark:text-green-300">
                      {totalYes}
                    </p>
                  </div>
                  <div className="bg-white/50 dark:bg-red-900/20 p-2 rounded-lg">
                    <p className="text-[10px] font-bold text-red-600 uppercase mb-0.5">
                      No
                    </p>
                    <p className="text-lg font-black text-red-700 dark:text-red-300">
                      {totalNo}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 7-day trend */}
          <div className="bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/30 dark:from-gray-800 dark:via-blue-900/10 dark:to-indigo-900/10 p-6 rounded-3xl shadow-xl border border-blue-200/50 dark:border-blue-700/50 no-pdf">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-7 bg-blue-600 rounded-full" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5" /> Response Volume – Last 7 Days
              </h3>
            </div>
            <div className="h-64">
              <Line data={lineData} options={lineOptions} />
            </div>
          </div>

          {/* ── Response-wise First Question Analytics ─────────────────────── */}

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-800/30 overflow-hidden mb-6">
            <div className="p-6 border-b border-blue-100 dark:border-gray-700 bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-900/10">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <List className="w-6 h-6 text-blue-600 dark:text-blue-400" />{" "}
                First Question Responses
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                Response-wise first question, answer, and compliance breakdown
              </p>
            </div>

            <div className="p-5">
              {(() => {
                // ── group by form title ──────────────────────────────────────────────
                const grouped = filteredResponses.reduce(
                  (acc, r) => {
                    const title = r.formTitle || "Unknown Form";
                    if (!acc[title]) acc[title] = [];
                    acc[title].push(r);
                    return acc;
                  },
                  {} as Record<string, typeof filteredResponses>,
                );

                const formTitles = Object.keys(grouped).sort();

                if (formTitles.length === 0) {
                  return (
                    <div className="text-center py-6 text-gray-500">
                      No responses found.
                    </div>
                  );
                }

                // ── helper: visual bar (green = yes/accepted, red = no/rejected) ─────
                const ComplianceBar = ({
                  yesCount,
                  noCount,
                  total,
                }: {
                  yesCount: number;
                  noCount: number;
                  total: number;
                }) => {
                  if (total === 0)
                    return (
                      <span className="text-gray-300 dark:text-gray-600 text-xs">
                        —
                      </span>
                    );
                  const yesPct = Math.round((yesCount / total) * 100);
                  const noPct = Math.round((noCount / total) * 100);
                  return (
                    <div className="flex flex-col items-center gap-1 min-w-[80px]">
                      {/* bar */}
                      <div className="flex h-3 w-full rounded overflow-hidden bg-gray-100 dark:bg-gray-700">
                        {yesPct > 0 && (
                          <div
                            className="bg-green-500 transition-all"
                            style={{ width: `${yesPct}%` }}
                            title={`Yes ${yesPct}%`}
                          />
                        )}
                        {noPct > 0 && (
                          <div
                            className="bg-red-500 transition-all"
                            style={{ width: `${noPct}%` }}
                            title={`No ${noPct}%`}
                          />
                        )}
                      </div>
                      {/* labels */}
                      <div className="flex justify-between w-full text-[10px] font-bold leading-none">
                        <span className="text-green-600 dark:text-green-400">
                          {yesPct}%
                        </span>
                        <span className="text-red-600 dark:text-red-400">
                          {noPct}%
                        </span>
                      </div>
                    </div>
                  );
                };

                return (
                  <div className="space-y-8">
                    {formTitles.map((formTitle) => {
                      const rows = grouped[formTitle];
                      const displayRows = rows.slice(0, 100);

                      // ── decide columns: scan actual stats to see what's present ────
                      // Check if ANY response has accepted/rejected/rework values
                      const hasInspection = displayRows.some(
                        (r) =>
                          (r.stats?.accepted ?? 0) > 0 ||
                          (r.stats?.rejected ?? 0) > 0 ||
                          (r.stats?.rework ?? 0) > 0,
                      );
                      // Check if N/A values actually exist (only show if they do)
                      const hasNA =
                        !hasInspection &&
                        displayRows.some((r) => (r.stats?.na ?? 0) > 0);

                      // Build column list based on what actually exists in the data
                      const columns: Array<
                        "yes" | "no" | "na" | "accepted" | "rejected" | "rework"
                      > = hasInspection
                          ? ["accepted", "rejected", "rework"]
                          : hasNA
                            ? ["yes", "no", "na"]
                            : ["yes", "no"]; // ← pure yes/no form: no N/A column at all

                      const primaryCol = hasInspection ? "accepted" : "yes";
                      const secondaryCol = hasInspection ? "rejected" : "no";

                      // Column display config
                      const colConfig: Record<
                        string,
                        { label: string; color: string }
                      > = {
                        yes: {
                          label: "Yes",
                          color: "text-green-700 dark:text-green-400",
                        },
                        no: {
                          label: "No",
                          color: "text-red-700 dark:text-red-400",
                        },
                        na: {
                          label: "N/A",
                          color: "text-slate-600 dark:text-slate-400",
                        },
                        accepted: {
                          label: "Accepted",
                          color: "text-emerald-700 dark:text-emerald-400",
                        },
                        rejected: {
                          label: "Rejected",
                          color: "text-red-700 dark:text-red-400",
                        },
                        rework: {
                          label: "Rework",
                          color: "text-amber-700 dark:text-amber-400",
                        },
                      };

                      // Per-row data
                      const rowsData = displayRows.map((r) => {
                        const stats = r.stats ?? {
                          yes: 0,
                          no: 0,
                          na: 0,
                          accepted: 0,
                          rejected: 0,
                          rework: 0,
                        };
                        const colTotal = columns.reduce(
                          (s, c) => s + (stats[c] ?? 0),
                          0,
                        );
                        return { r, stats, colTotal };
                      });

                      // Column totals for footer
                      const colTotals = columns.reduce(
                        (acc, col) => {
                          acc[col] = rowsData.reduce(
                            (s, { stats }) => s + (stats[col] ?? 0),
                            0,
                          );
                          return acc;
                        },
                        {} as Record<string, number>,
                      );
                      const grandTotal = Object.values(colTotals).reduce(
                        (a, b) => a + b,
                        0,
                      );

                      return (
                        <div key={formTitle}>
                          <h4 className="text-md font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-500" />
                            {formTitle}
                            <span className="text-xs font-normal text-gray-500 ml-1">
                              ({rows.length} response
                              {rows.length !== 1 ? "s" : ""})
                            </span>
                          </h4>

                          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                            <table className="min-w-full text-xs border-collapse">
                              <thead className="bg-gray-100 dark:bg-gray-800">
                                <tr>
                                  <th className="text-left px-4 py-3 border border-gray-300 dark:border-gray-600 font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200 whitespace-nowrap w-36">
                                    Response Date
                                  </th>
                                  <th colSpan={2} className="text-left px-4 py-3 border border-gray-300 dark:border-gray-600 font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">
                                    Basic Informations
                                  </th>
                                  {/* Dynamic compliance columns */}
                                  {columns.map((col) => (
                                    <th
                                      key={col}
                                      className={`text-center px-3 py-3 border border-gray-300 dark:border-gray-600 font-bold uppercase tracking-wider whitespace-nowrap ${colConfig[col].color}`}
                                    >
                                      {colConfig[col].label}
                                    </th>
                                  ))}
                                  {/* Visual bar column */}
                                  <th className="text-center px-4 py-3 border border-gray-300 dark:border-gray-600 font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200 whitespace-nowrap w-28">
                                    {hasInspection ? "Acc / Rej" : "Yes / No"}
                                  </th>
                                </tr>
                              </thead>

                              <tbody>
                                {rowsData.map(({ r, stats, colTotal }, i) => (
                                  <tr
                                    key={r._id || i}
                                    className={`border-b border-gray-200 dark:border-gray-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors ${i % 2 === 0
                                      ? "bg-white dark:bg-gray-900"
                                      : "bg-gray-50/50 dark:bg-gray-800/50"
                                      }`}
                                  >
                                    {/* Date */}
                                    <td className="px-4 py-3 border border-gray-200 dark:border-gray-700 whitespace-nowrap text-gray-700 dark:text-gray-300">
                                      {formatTimestamp(r.createdAt)}
                                    </td>
                                    {/* First Question */}
                                    <td className="px-4 py-3 border border-gray-200 dark:border-gray-700 break-words whitespace-normal text-gray-800 dark:text-gray-200">
                                      {r.firstQuestionText}
                                    </td>
                                    {/* Answer */}
                                    <td
                                      className="px-4 py-3 font-bold border border-gray-200 dark:border-gray-700 break-words whitespace-normal text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
                                      onClick={() => navigate(`/responses/${r._id || r.id}`)}
                                    >
                                      {r.firstAnswerValue}
                                    </td>
                                    {/* Compliance counts */}
                                    {columns.map((col) => {
                                      const count = stats[col] ?? 0;
                                      const pct =
                                        colTotal > 0
                                          ? Math.round((count / colTotal) * 100)
                                          : null;
                                      return (
                                        <td
                                          key={col}
                                          className={`text-center px-3 py-3 border border-gray-200 dark:border-gray-700 font-bold ${colConfig[col].color}`}
                                        >
                                          {colTotal === 0 ? (
                                            <span className="text-gray-300 dark:text-gray-600">
                                              —
                                            </span>
                                          ) : (
                                            <>
                                              {count}
                                              {pct !== null && (
                                                <span className="text-gray-400 dark:text-gray-500 font-medium ml-1">
                                                  ({pct}%)
                                                </span>
                                              )}
                                            </>
                                          )}
                                        </td>
                                      );
                                    })}
                                    {/* Visual bar */}
                                    <td className="px-3 py-3 border border-gray-200 dark:border-gray-700">
                                      <div className="flex justify-center">
                                        <ComplianceBar
                                          yesCount={stats[primaryCol] ?? 0}
                                          noCount={stats[secondaryCol] ?? 0}
                                          total={colTotal}
                                        />
                                      </div>
                                    </td>
                                  </tr>
                                ))}

                                {/* ── Footer totals row ────────────────────────────── */}
                                <tr className="bg-blue-100/80 dark:bg-blue-900/40 font-extrabold border-t-2 border-blue-300 dark:border-blue-600">
                                  <td
                                    colSpan={3}
                                    className="px-4 py-3 text-blue-900 dark:text-blue-100 border border-gray-300 dark:border-gray-600 uppercase tracking-wider"
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="w-2.5 h-2.5 bg-blue-700 rounded-full" />
                                      Total ({Math.min(rows.length, 100)} shown)
                                    </div>
                                  </td>
                                  {columns.map((col) => {
                                    const total = colTotals[col] ?? 0;
                                    const pct =
                                      grandTotal > 0
                                        ? Math.round((total / grandTotal) * 100)
                                        : null;
                                    return (
                                      <td
                                        key={col}
                                        className={`text-center px-3 py-3 border border-gray-300 dark:border-gray-600 ${colConfig[col].color}`}
                                      >
                                        {total}
                                        {pct !== null && (
                                          <span className="text-gray-500 dark:text-gray-400 font-medium ml-1">
                                            ({pct}%)
                                          </span>
                                        )}
                                      </td>
                                    );
                                  })}
                                  {/* Footer visual bar */}
                                  <td className="px-3 py-3 border border-gray-300 dark:border-gray-600">
                                    <div className="flex justify-center">
                                      <ComplianceBar
                                        yesCount={colTotals[primaryCol] ?? 0}
                                        noCount={colTotals[secondaryCol] ?? 0}
                                        total={grandTotal}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {rows.length > 100 && (
                            <div className="text-right mt-2 text-[10px] text-gray-500">
                              Showing first 100 of {rows.length} responses for
                              this form.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── Section-wise Analytics ─────────────────────────────────────── */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-800/30 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-blue-100 dark:border-gray-700 bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-900/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <PieChart className="w-6 h-6 text-blue-600 dark:text-blue-400" />{" "}
                    Section Summary
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                    Section-wise performance breakdown
                  </p>
                </div>

                {/* Section filter */}
                <div className="relative">
                  <button
                    onClick={() => setShowSectionSelector(!showSectionSelector)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm"
                  >
                    Sections (
                    {selectedSectionIds.length === 0
                      ? sectionStats.length
                      : selectedSectionIds.length}
                    )
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${showSectionSelector ? "rotate-180" : ""}`}
                    />
                  </button>
                  {showSectionSelector && (
                    <div className="absolute top-full right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-[60] min-w-[240px] max-h-80 overflow-y-auto">
                      <div className="sticky top-0 bg-gray-50 dark:bg-gray-900 p-2 border-b border-gray-100 dark:border-gray-800">
                        <label className="flex items-center gap-3 px-3 py-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedSectionIds.length === 0}
                            onChange={() => setSelectedSectionIds([])}
                            className="w-4 h-4 rounded"
                          />
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            Select All
                          </span>
                        </label>
                      </div>
                      <div className="p-1">
                        {sectionStats.map((stat) => (
                          <label
                            key={stat.id}
                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={
                                selectedSectionIds.length === 0 ||
                                selectedSectionIds.includes(stat.id)
                              }
                              onChange={() => {
                                setSelectedSectionIds((prev) => {
                                  if (prev.length === 0)
                                    return sectionStats
                                      .map((s) => s.id)
                                      .filter((id) => id !== stat.id);
                                  const has = prev.includes(stat.id);
                                  const next = has
                                    ? prev.filter((id) => id !== stat.id)
                                    : [...prev, stat.id];
                                  return next.length === sectionStats.length
                                    ? []
                                    : next;
                                });
                              }}
                              className="w-4 h-4 rounded"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {stat.title}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {(() => {
                // ── Decide columns by scanning actual data ──────────────────────────
                const hasInspection = sectionSummaryRows.some(
                  (r) => r.accepted > 0 || r.rejected > 0 || r.rework > 0,
                );
                const hasNA =
                  !hasInspection &&
                  sectionSummaryRows.some((r) => r.naCount > 0);

                // columns to render
                type ColKey =
                  | "yes"
                  | "no"
                  | "na"
                  | "accepted"
                  | "rejected"
                  | "rework";
                const columns: ColKey[] = hasInspection
                  ? ["accepted", "rejected", "rework"]
                  : hasNA
                    ? ["yes", "no", "na"]
                    : ["yes", "no"];

                const colConfig: Record<
                  ColKey,
                  {
                    label: string;
                    header: string;
                    color: string;
                    countKey: keyof (typeof sectionSummaryRows)[0];
                  }
                > = {
                  yes: {
                    label: "Yes",
                    header: "Yes",
                    color: "text-green-700 dark:text-green-400",
                    countKey: "yesCount",
                  },
                  no: {
                    label: "No",
                    header: "No",
                    color: "text-red-700 dark:text-red-400",
                    countKey: "noCount",
                  },
                  na: {
                    label: "N/A",
                    header: "N/A",
                    color: "text-slate-600 dark:text-slate-400",
                    countKey: "naCount",
                  },
                  accepted: {
                    label: "Accepted",
                    header: "Accepted",
                    color: "text-emerald-700 dark:text-emerald-400",
                    countKey: "yesCount",
                  },
                  rejected: {
                    label: "Rejected",
                    header: "Rejected",
                    color: "text-red-700 dark:text-red-400",
                    countKey: "noCount",
                  },
                  rework: {
                    label: "Rework",
                    header: "Rework",
                    color: "text-amber-700 dark:text-amber-400",
                    countKey: "naCount",
                  },
                };

                // Color legend — only show what's in use
                const legendItems: [string, string][] = hasInspection
                  ? [
                    ["bg-emerald-500", "Accepted"],
                    ["bg-red-500", "Rejected"],
                    ["bg-amber-400", "Rework"],
                  ]
                  : hasNA
                    ? [
                      ["bg-green-500", "Yes"],
                      ["bg-red-500", "No"],
                      ["bg-gray-400", "N/A"],
                    ]
                    : [
                      ["bg-green-500", "Yes"],
                      ["bg-red-500", "No"],
                    ];

                // recomputed totals for visible columns only
                const footerTotals = columns.reduce(
                  (acc, col) => {
                    acc[col] = sectionSummaryRows.reduce(
                      (s, r) => s + (Number(r[colConfig[col].countKey]) || 0),
                      0,
                    );
                    return acc;
                  },
                  {} as Record<string, number>,
                );
                const footerGrand = Object.values(footerTotals).reduce(
                  (a, b) => a + b,
                  0,
                );

                const primaryCol = hasInspection ? "accepted" : "yes";
                const secondaryCol = hasInspection ? "rejected" : "no";

                return (
                  <>
                    {/* Color legend */}
                    <div className="flex flex-wrap items-center gap-6 pb-4 border-b border-gray-100 dark:border-gray-800">
                      {legendItems.map(([c, l]) => (
                        <div key={l} className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${c}`} />
                          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {l}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Table + Radar side by side */}
                    <div className="flex flex-col lg:flex-row gap-6">
                      {/* Table */}
                      <div className="flex-1 min-w-0 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                        <table className="min-w-full text-xs border-collapse">
                          <thead className="bg-gray-100 dark:bg-gray-800">
                            <tr>
                              <th
                                rowSpan={2}
                                className="text-left px-4 py-3 border border-gray-300 dark:border-gray-600 min-w-[200px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200"
                              >
                                Section
                              </th>
                              <th
                                rowSpan={2}
                                className="text-center px-3 py-3 border border-gray-300 dark:border-gray-600 font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200"
                              >
                                Total
                              </th>
                              <th
                                colSpan={columns.length}
                                className="text-center px-3 py-2 border border-gray-300 dark:border-gray-600 font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200"
                              >
                                Performance Breakdown
                              </th>
                              <th
                                rowSpan={2}
                                className="text-center px-4 py-3 border border-gray-300 dark:border-gray-600 font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200 w-28"
                              >
                                Visual
                              </th>
                            </tr>
                            <tr className="bg-gray-50 dark:bg-gray-700/50">
                              {columns.map((col) => (
                                <th
                                  key={col}
                                  className={`text-center px-3 py-2 border border-gray-300 dark:border-gray-600 font-bold ${colConfig[col].color}`}
                                >
                                  {colConfig[col].header}
                                </th>
                              ))}
                            </tr>
                          </thead>

                          <tbody>
                            {sectionSummaryRows.map((row, i) => {
                              const primaryCount =
                                Number(row[colConfig[primaryCol].countKey]) ||
                                0;
                              const secondaryCount =
                                Number(row[colConfig[secondaryCol].countKey]) ||
                                0;
                              const barTotal =
                                primaryCount +
                                secondaryCount +
                                (hasInspection || hasNA
                                  ? Number(
                                    row[
                                    colConfig[
                                      hasInspection ? "rework" : "na"
                                    ].countKey
                                    ],
                                  ) || 0
                                  : 0);

                              return (
                                <tr
                                  key={row.id}
                                  className={`border-b border-gray-200 dark:border-gray-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors ${i % 2 === 0
                                    ? "bg-white dark:bg-gray-900"
                                    : "bg-gray-50/50 dark:bg-gray-800/50"
                                    }`}
                                >
                                  <td
                                    className="px-4 py-3 font-semibold text-blue-600 dark:text-blue-400 border border-gray-200 dark:border-gray-700 text-sm truncate max-w-[200px]"
                                    title={row.title}
                                  >
                                    {row.title}
                                  </td>
                                  <td className="text-center px-3 py-3 border border-gray-200 dark:border-gray-700 font-bold text-gray-900 dark:text-white">
                                    {row.total}
                                  </td>
                                  {columns.map((col) => {
                                    const count =
                                      Number(row[colConfig[col].countKey]) || 0;
                                    const pct =
                                      row.total > 0
                                        ? Math.round((count / row.total) * 100)
                                        : 0;
                                    return (
                                      <td
                                        key={col}
                                        className={`text-center px-3 py-3 border border-gray-200 dark:border-gray-700 font-bold ${colConfig[col].color}`}
                                      >
                                        {count}{" "}
                                        <span className="text-gray-400 dark:text-gray-500 font-medium">
                                          ({pct}%)
                                        </span>
                                      </td>
                                    );
                                  })}
                                  {/* Visual bar */}
                                  <td className="px-3 py-3 border border-gray-200 dark:border-gray-700">
                                    <div className="flex flex-col items-center gap-1">
                                      <div className="flex h-4 w-full rounded overflow-hidden bg-gray-100 dark:bg-gray-700">
                                        {barTotal > 0 && primaryCount > 0 && (
                                          <div
                                            className="bg-green-500"
                                            style={{
                                              width: `${Math.round((primaryCount / barTotal) * 100)}%`,
                                            }}
                                            title={`${colConfig[primaryCol].label} ${Math.round((primaryCount / barTotal) * 100)}%`}
                                          />
                                        )}
                                        {barTotal > 0 && secondaryCount > 0 && (
                                          <div
                                            className="bg-red-500"
                                            style={{
                                              width: `${Math.round((secondaryCount / barTotal) * 100)}%`,
                                            }}
                                            title={`${colConfig[secondaryCol].label} ${Math.round((secondaryCount / barTotal) * 100)}%`}
                                          />
                                        )}
                                        {(hasInspection || hasNA) &&
                                          barTotal > 0 &&
                                          (() => {
                                            const naCol = hasInspection
                                              ? "rework"
                                              : "na";
                                            const naCount =
                                              Number(
                                                row[colConfig[naCol].countKey],
                                              ) || 0;
                                            return naCount > 0 ? (
                                              <div
                                                className={
                                                  hasInspection
                                                    ? "bg-amber-400"
                                                    : "bg-gray-400"
                                                }
                                                style={{
                                                  width: `${Math.round((naCount / barTotal) * 100)}%`,
                                                }}
                                                title={`${colConfig[naCol].label} ${Math.round((naCount / barTotal) * 100)}%`}
                                              />
                                            ) : null;
                                          })()}
                                      </div>
                                      {barTotal > 0 && (
                                        <div className="flex justify-between w-full text-[10px] font-bold">
                                          <span className="text-green-600 dark:text-green-400">
                                            {Math.round(
                                              (primaryCount / barTotal) * 100,
                                            )}
                                            %
                                          </span>
                                          <span className="text-red-600 dark:text-red-400">
                                            {Math.round(
                                              (secondaryCount / barTotal) * 100,
                                            )}
                                            %
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}

                            {/* Total footer row */}
                            <tr className="bg-blue-100/80 dark:bg-blue-900/40 font-extrabold border-t-2 border-blue-300 dark:border-blue-600">
                              <td className="px-4 py-3 text-blue-900 dark:text-blue-100 border border-gray-300 dark:border-gray-600 uppercase tracking-wider">
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 bg-blue-700 rounded-full" />{" "}
                                  Total
                                </div>
                              </td>
                              <td className="text-center px-3 py-3 border border-gray-300 dark:border-gray-600 text-blue-900 dark:text-blue-100 text-base">
                                {summaryTotals.total}
                              </td>
                              {columns.map((col) => {
                                const total = footerTotals[col] ?? 0;
                                const pct =
                                  footerGrand > 0
                                    ? Math.round((total / footerGrand) * 100)
                                    : 0;
                                return (
                                  <td
                                    key={col}
                                    className={`text-center px-3 py-3 border border-gray-300 dark:border-gray-600 ${colConfig[col].color}`}
                                  >
                                    {total}{" "}
                                    <span className="text-gray-500 dark:text-gray-400 font-medium">
                                      ({pct}%)
                                    </span>
                                  </td>
                                );
                              })}
                              {/* Footer visual bar */}
                              <td className="px-3 py-3 border border-gray-300 dark:border-gray-600">
                                <div className="flex flex-col items-center gap-1">
                                  <div className="flex h-4 w-full rounded overflow-hidden bg-gray-100 dark:bg-gray-700">
                                    {footerGrand > 0 &&
                                      (footerTotals[primaryCol] ?? 0) > 0 && (
                                        <div
                                          className="bg-green-500"
                                          style={{
                                            width: `${Math.round(((footerTotals[primaryCol] ?? 0) / footerGrand) * 100)}%`,
                                          }}
                                        />
                                      )}
                                    {footerGrand > 0 &&
                                      (footerTotals[secondaryCol] ?? 0) > 0 && (
                                        <div
                                          className="bg-red-500"
                                          style={{
                                            width: `${Math.round(((footerTotals[secondaryCol] ?? 0) / footerGrand) * 100)}%`,
                                          }}
                                        />
                                      )}
                                  </div>
                                  {footerGrand > 0 && (
                                    <div className="flex justify-between w-full text-[10px] font-bold">
                                      <span className="text-green-600 dark:text-green-400">
                                        {Math.round(
                                          ((footerTotals[primaryCol] ?? 0) /
                                            footerGrand) *
                                          100,
                                        )}
                                        %
                                      </span>
                                      <span className="text-red-600 dark:text-red-400">
                                        {Math.round(
                                          ((footerTotals[secondaryCol] ?? 0) /
                                            footerGrand) *
                                          100,
                                        )}
                                        %
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Radar Chart — unchanged */}
                      <div className="w-full lg:w-[420px] flex-shrink-0">
                        <div className="bg-white dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md h-full">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                            <div>
                              <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                                Performance Radar
                              </h4>
                              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                                Comparative section analysis
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                              {legendItems.map(([c, l]) => (
                                <div
                                  key={l}
                                  className="flex items-center gap-1"
                                >
                                  <div
                                    className={`w-1.5 h-1.5 rounded-full ${c}`}
                                  />
                                  <span className="text-[9px] font-bold text-gray-500 uppercase">
                                    {l}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="h-80">
                            <Radar data={radarData} options={radarOptions} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Empty state */}
                    {sectionSummaryRows.length === 0 && (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        No section performance data available yet.
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
          {/* Defect Distribution Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-800/30 overflow-hidden mt-6">
            <div className="p-6 border-b border-blue-100 dark:border-gray-700 bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-900/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      Defect Distribution
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No/Rejected & Rework volume by question {defectDateRangeLabel ? `(${defectDateRangeLabel})` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Sort Toggle */}
                  <div className="flex items-center bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                    <button
                      onClick={() => setChartSortOrder("default")}
                      className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${chartSortOrder === "default"
                        ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                        : "text-gray-500"
                        }`}
                    >
                      DEFAULT
                    </button>
                    <button
                      onClick={() => setChartSortOrder("percentage")}
                      className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${chartSortOrder === "percentage"
                        ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                        : "text-gray-500"
                        }`}
                    >
                      ISSUE %
                    </button>
                  </div>

                  {/* Orientation Toggle */}
                  <div className="flex items-center bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                    <button
                      onClick={() => setChartOrientation("v")}
                      title="Vertical View"
                      className={`p-1.5 rounded transition-all ${chartOrientation === "v"
                        ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                        : "text-gray-500"
                        }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setChartOrientation("h")}
                      title="Horizontal View"
                      className={`p-1.5 rounded transition-all ${chartOrientation === "h"
                        ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                        : "text-gray-500"
                        }`}
                    >
                      <svg className="w-4 h-4 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2" />
                      </svg>
                    </button>
                  </div>

                  {/* Date Filter */}
                  <div className="relative">
                    <button
                      onClick={() => setShowDefectFilter(!showDefectFilter)}
                      className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${defectDateFilter.type !== "all"
                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-600"
                        : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600"
                        }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      {defectDateFilter.type === "all" ? "All Time" :
                        defectDateFilter.type === "single" ? defectDateFilter.startDate :
                          `${defectDateFilter.startDate} to ${defectDateFilter.endDate}`}
                    </button>

                    {showDefectFilter && (
                      <div className="absolute top-full right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 p-4 w-64">
                        <div className="space-y-3">
                          <button
                            onClick={() => {
                              setDefectDateFilter({ type: "all", startDate: "", endDate: "" });
                              setShowDefectFilter(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                          >
                            All Time
                          </button>
                          <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
                            <label className="text-xs font-bold text-gray-500">Start Date</label>
                            <input
                              type="date"
                              value={defectDateFilter.startDate}
                              onChange={(e) =>
                                setDefectDateFilter((prev) => ({ ...prev, startDate: e.target.value, type: e.target.value ? "range" : "all" }))
                              }
                              className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-gray-500">End Date</label>
                            <input
                              type="date"
                              value={defectDateFilter.endDate}
                              onChange={(e) =>
                                setDefectDateFilter((prev) => ({ ...prev, endDate: e.target.value, type: e.target.value ? "range" : "all" }))
                              }
                              className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                            />
                          </div>
                          <button
                            onClick={() => setShowDefectFilter(false)}
                            className="w-full px-3 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              {processedDefectQuestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                    <CheckCircle className="w-12 h-12 text-green-500 opacity-50" />
                  </div>
                  <h4 className="text-gray-900 dark:text-white font-bold mb-1">No Defects Found</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                    No rejected or rework responses were found for your current selection.
                  </p>
                </div>
              ) : (
                <div className={chartOrientation === "h" ? "overflow-y-auto" : "w-full"} style={{ height: chartOrientation === "h" ? "auto" : "450px" }}>
                  <div style={{ height: chartOrientation === "h" ? `${Math.max(400, processedDefectQuestions.length * 40)}px` : "400px", position: "relative" }}>
                    <Bar data={defectChartData} options={defectChartOptions} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-800/30 overflow-hidden mt-6">
            <div className="p-6 border-b border-blue-100 dark:border-gray-700 bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-900/10">
              <div className="flex items-center gap-3">
                <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    No / Rejected Responses
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    All questions with No/Rejected answers grouped by dealer (including follow-up questions)
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5">
              {(() => {
                // State for expanded forms - using useState
                // Build a map of form ID to form object for quick lookup
                const formMap = new Map<string, Form>();
                filteredResponses.forEach(response => {
                  const formId = response.questionId || response.formId;
                  if (formId && !formMap.has(formId)) {
                    // You need to fetch or have the form data available
                    // For now, we'll use the formsMap you should have
                  }
                });

                const getTotalAnsweredForForm = (formTitle: string): number => {
                  let totalAnswered = 0;
                  filteredResponses.forEach(response => {
                    if (response.formTitle === formTitle) {
                      const stats = response.stats || { yes: 0, no: 0, na: 0, accepted: 0, rejected: 0, rework: 0 };
                      // Check if using Yes/No/NA system
                      if (stats.yes > 0 || stats.no > 0 || stats.na > 0) {
                        totalAnswered += (stats.yes || 0) + (stats.no || 0) + (stats.na || 0);
                      }
                      // Check if using Accepted/Rejected/Rework system
                      else if (stats.accepted > 0 || stats.rejected > 0 || stats.rework > 0) {
                        totalAnswered += (stats.accepted || 0) + (stats.rejected || 0) + (stats.rework || 0);
                      }
                    }
                  });
                  return totalAnswered;
                };

                // Helper to recursively collect all follow-up questions and their answers
                const collectFollowUpAnswers = (
                  followUpQuestions: any[],
                  answers: Record<string, any>,
                  parentAnswer: any,
                  level: number = 0
                ): Array<{ question: any; answer: any; level: number }> => {
                  const result: Array<{ question: any; answer: any; level: number }> = [];

                  for (const followUp of followUpQuestions) {
                    // Check if this follow-up question should be shown based on parent answer
                    let shouldShow = true;

                    if (followUp.showWhen) {
                      const conditionValue = followUp.showWhen.value;
                      const parentAnswerStr = String(parentAnswer).toLowerCase().trim();
                      const conditionValueStr = String(conditionValue).toLowerCase().trim();
                      shouldShow = parentAnswerStr === conditionValueStr;
                    }

                    // Also check if the follow-up has a parentId reference
                    if (followUp.parentId && !followUp.showWhen) {
                      // If no showWhen but has parentId, assume it should show
                      shouldShow = true;
                    }

                    if (shouldShow) {
                      const answer = answers[followUp.id];
                      if (answer !== undefined && answer !== null && answer !== "") {
                        result.push({ question: followUp, answer, level });
                      }

                      // Recursively check for nested follow-ups (pass the same parentAnswer for consistency)
                      if (followUp.followUpQuestions && followUp.followUpQuestions.length > 0) {
                        // For nested follow-ups, pass the answer of THIS follow-up as the parent answer
                        const nestedAnswer = answers[followUp.id];
                        if (nestedAnswer !== undefined && nestedAnswer !== null && nestedAnswer !== "") {
                          const nested = collectFollowUpAnswers(
                            followUp.followUpQuestions,
                            answers,
                            nestedAnswer,  // Pass the follow-up's own answer for its children
                            level + 1
                          );
                          result.push(...nested);
                        }
                      }
                    }
                  }
                  return result;
                };

                // Helper to find a question and its follow-ups in the form structure
                const findQuestionWithFollowUps = (
                  form: Form | undefined,
                  questionId: string
                ): { question: any; followUps: any[] } | null => {
                  if (!form?.sections) return null;

                  for (const section of form.sections) {
                    for (const question of section.questions || []) {
                      if (question.id === questionId) {
                        return { question, followUps: question.followUpQuestions || [] };
                      }
                      // Check follow-up questions
                      if (question.followUpQuestions) {
                        for (const fq of question.followUpQuestions) {
                          if (fq.id === questionId) {
                            return { question: fq, followUps: fq.followUpQuestions || [] };
                          }
                        }
                      }
                    }
                  }
                  return null;
                };

                interface NoResponseItem {
                  formTitle: string;
                  formId: string;
                  questionId: string;
                  questionText: string;
                  answer: string;
                  responseDate: string;
                  responseId: string;
                  dealerName: string;
                  followUpData: Array<{ question: any; answer: any; level: number }>;
                }

                const noResponsesList: NoResponseItem[] = [];

                // Collect all No/Rejected responses
                filteredResponses.forEach((response) => {
                  const answers = response.answers || {};
                  const formId = response.questionId || response.formId || "";
                  const form = formsMap.get(formId);
                  const dealerName = response.dealerName || "Unknown Dealer";

                  Object.entries(answers).forEach(([qId, answer]) => {
                    if (answer === undefined || answer === null || answer === "") return;

                    // Check if this is a No/Rejected answer
                    let isNoResponse = false;
                    let answerValue = "";

                    const answerStr = String(answer).toLowerCase().trim();

                    if (answerStr === "no" || answerStr === "rejected" || answerStr === "reject") {
                      isNoResponse = true;
                      answerValue = String(answer);
                    } else if (typeof answer === "object" && answer !== null) {
                      const status = String(answer.status || "").toLowerCase().trim();
                      if (status === "rejected" || status === "no") {
                        isNoResponse = true;
                        answerValue = answer.status || "Rejected";
                      }
                    }

                    if (!isNoResponse) return;

                    // Find the question and its follow-ups from the form structure
                    let questionText = qId;
                    let followUpData: Array<{ question: any; answer: any; level: number }> = [];

                    if (form) {
                      const found = findQuestionWithFollowUps(form, qId);
                      if (found) {
                        questionText = found.question.text || found.question.label || qId;
                        // Pass the current answer (which is "No") as the parent answer to filter follow-ups
                        followUpData = collectFollowUpAnswers(found.followUps, answers, answerValue, 0);
                      }
                    } else {
                      // Fallback to stored question texts
                      questionText = (response as any).questionTexts?.[qId] || qId;
                    }

                    noResponsesList.push({
                      formTitle: response.formTitle,
                      formId: formId,
                      questionId: qId,
                      questionText: questionText,
                      answer: answerValue,
                      responseDate: formatTimestamp(response.createdAt),
                      responseId: response._id || response.id,
                      dealerName: dealerName,
                      followUpData,
                    });
                  });
                });

                // Group by form title, then by dealer name
                const groupedByFormAndDealer = noResponsesList.reduce((acc, item) => {
                  if (!acc[item.formTitle]) {
                    acc[item.formTitle] = {};
                  }
                  if (!acc[item.formTitle][item.dealerName]) {
                    acc[item.formTitle][item.dealerName] = [];
                  }
                  acc[item.formTitle][item.dealerName].push(item);
                  return acc;
                }, {} as Record<string, Record<string, NoResponseItem[]>>);

                if (Object.keys(groupedByFormAndDealer).length === 0) {
                  return (
                    <div className="text-center py-12">
                      <div className="p-4 bg-green-100 dark:bg-green-900/20 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 font-medium">
                        No "No/Rejected" responses found
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        All questions have been answered with Yes/Accepted
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {Object.entries(groupedByFormAndDealer).map(([formTitle, dealerGroups]) => {
                      const totalNoCount = noResponsesList.filter(item => item.formTitle === formTitle).length;
                      const totalAnswered = getTotalAnsweredForForm(formTitle);
                      const noPercentage = totalAnswered > 0 ? ((totalNoCount / totalAnswered) * 100).toFixed(1) : 0;
                      const isExpanded = expandedNoResponsesForms.has(formTitle);

                      return (
                        <div key={formTitle} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                          {/* Form Header - Clickable Accordion */}
                          <button
                            onClick={() => toggleFormExpansion(formTitle)}
                            className="w-full bg-blue-600 dark:bg-blue-800 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-blue-700 dark:hover:bg-blue-700 transition-all duration-200 group"
                          >
                            <div className="text-left">
                              <div className="flex items-center gap-3">
                                <ChevronDown
                                  className={`w-5 h-5 text-white transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                                />
                                <h4 className="text-white font-bold text-lg">{formTitle}</h4>
                              </div>
                              <p className="text-blue-100 text-xs mt-1 ml-8">No/Rejected Responses by Dealer</p>
                            </div>
                            <div className="mt-2 sm:mt-0">
                              <span className="bg-white/20 text-white px-3 py-1 rounded-full text-sm font-bold">
                                {totalNoCount} / {totalAnswered} No ({noPercentage}%)
                              </span>
                            </div>
                          </button>

                          {/* Expanded Content */}
                          {isExpanded && (
                            <div className="animate-in slide-in-from-top-2 duration-200">
                              {/* Dealer Groups */}
                              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                {Object.entries(dealerGroups).map(([dealerName, items]) => {
                                  const dealerNoCount = items.length;
                                  const dealerPercentage = totalAnswered > 0 ? ((dealerNoCount / totalAnswered) * 100).toFixed(1) : 0;

                                  return (
                                    <div key={dealerName} className="bg-white dark:bg-gray-900">
                                      {/* Dealer Header */}
                                      <div className="bg-gray-100 dark:bg-gray-800 px-6 py-3 flex flex-wrap items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                            <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                          </div>
                                          <div>
                                            <h5 className="font-bold text-gray-900 dark:text-white">
                                              {dealerName}
                                            </h5>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                              {items.length} No/Rejected response{items.length !== 1 ? 's' : ''} ({dealerPercentage}% of total answered)
                                            </p>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Questions List */}
                                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {items.map((item, idx) => (
                                          <div key={`${item.questionId}-${idx}`} className="p-5 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                                            {/* Main Question Card */}
                                            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                                              <div className="flex-1">
                                                {/* Date and badge */}
                                                <div className="flex flex-wrap items-center gap-2 mb-3">
                                                  <span className="text-xs text-gray-400 flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {item.responseDate}
                                                  </span>
                                                </div>

                                                {/* Question text */}
                                                <div className="font-bold text-gray-900 dark:text-white flex items-center text-base mb-3">
                                                  <span className="w-2 h-2 bg-red-600 rounded-full mr-3 flex-shrink-0"></span>
                                                  {item.questionText}
                                                </div>

                                                {/* Answer */}
                                                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm font-semibold">
                                                  <XCircle className="w-4 h-4" />
                                                  Answer: {item.answer}
                                                </div>
                                              </div>

                                              {/* View button */}
                                              <button
                                                onClick={() => navigate(`/responses/${item.responseId}`)}
                                                className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors self-start"
                                                title="View Full Response"
                                              >
                                                <Eye className="w-5 h-5" />
                                              </button>
                                            </div>

                                            {/* Follow-up Questions */}
                                            {item.followUpData.length > 0 && (
                                              <div className="mt-5 space-y-3">
                                                {item.followUpData.map((fq, fqIdx) => {
                                                  const indentLevel = fq.level + 1;
                                                  const marginLeft = indentLevel * 16;

                                                  // Render answer with image support
                                                  const renderAnswerContent = (answer: any): React.ReactNode => {
                                                    if (typeof answer === 'string') {
                                                      if (answer.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i) || answer.includes('cloudfront.net')) {
                                                        return (
                                                          <div className="mt-2">
                                                            <img
                                                              src={answer}
                                                              alt="Evidence"
                                                              className="max-w-full h-auto max-h-48 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
                                                              onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                              }}
                                                            />
                                                            <a
                                                              href={answer}
                                                              target="_blank"
                                                              rel="noopener noreferrer"
                                                              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 mt-1 inline-block"
                                                            >
                                                              Open in new tab ↗
                                                            </a>
                                                          </div>
                                                        );
                                                      }
                                                      return <span>{answer}</span>;
                                                    }

                                                    if (typeof answer === 'object' && answer !== null) {
                                                      const fileUrl = answer.fileUrl || answer.imageUrl || answer.url;
                                                      if (fileUrl && (fileUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i) || fileUrl.includes('cloudfront.net'))) {
                                                        return (
                                                          <div className="mt-2">
                                                            <img
                                                              src={fileUrl}
                                                              alt="Evidence"
                                                              className="max-w-full h-auto max-h-48 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
                                                              onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                              }}
                                                            />
                                                            <a
                                                              href={fileUrl}
                                                              target="_blank"
                                                              rel="noopener noreferrer"
                                                              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 mt-1 inline-block"
                                                            >
                                                              Open in new tab ↗
                                                            </a>
                                                          </div>
                                                        );
                                                      }
                                                      if (answer.remark) return <span>{answer.remark}</span>;
                                                      if (answer.status) return <span>Status: {answer.status}</span>;
                                                      if (answer.actionInitiated) return <span>Action: {answer.actionInitiated}</span>;
                                                      if (answer.reasonForNotOK) return <span>Reason: {answer.reasonForNotOK}</span>;
                                                      if (answer.responsiblePerson) return <span>Responsible: {answer.responsiblePerson}</span>;
                                                      if (answer.review) return <span>Review: {answer.review}</span>;
                                                      return <span>{JSON.stringify(answer)}</span>;
                                                    }

                                                    return <span>{String(answer)}</span>;
                                                  };

                                                  return (
                                                    <div
                                                      key={fqIdx}
                                                      className={`pl-4 border-l-4 rounded-r-xl shadow-sm ${fq.answer
                                                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-500"
                                                        : "bg-gray-50 dark:bg-gray-900/30 border-gray-400 dark:border-gray-500"
                                                        }`}
                                                      style={{ marginLeft: `${marginLeft}px` }}
                                                    >
                                                      <div className="p-3">
                                                        <div className="font-medium text-blue-800 dark:text-blue-200 flex items-center text-sm mb-2">
                                                          <span className="mr-2 text-base">↳</span>
                                                          {fq.question.text || fq.question.label || fq.question.id}
                                                        </div>
                                                        <div className="text-blue-700 dark:text-blue-300 text-sm pl-6">
                                                          {renderAnswerContent(fq.answer)}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Form Footer */}
                              <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-3 border-t border-gray-200 dark:border-gray-700">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Total {totalNoCount} No/Rejected response{totalNoCount !== 1 ? 's' : ''} across {Object.keys(dealerGroups).length} dealer{Object.keys(dealerGroups).length !== 1 ? 's' : ''} ({noPercentage}% of total answered questions)
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── Section Summary with Accordion (Form-wise) ──────────────────────────── */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-800/30 overflow-hidden">
            <div className="p-6 border-b border-blue-100 dark:border-gray-700 bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-900/10">
              <div className="flex items-center gap-3">
                <PieChart className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    Section Summary
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                    Form-wise section performance breakdown with visualizations
                  </p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {formWiseSectionStats.map((formStats) => {
                const columnConfig = detectColumnTypeForForm(formStats);
                const isExpanded = expandedSummaryForms.has(formStats.formId);
                const formTotal = formStats.totalYes + formStats.totalNo + formStats.totalNa;
                const overallScore = formTotal > 0 ? Math.round((formStats.totalYes / formTotal) * 100) : 0;

                // Determine score color
                let scoreColor = "text-red-600 dark:text-red-400";
                if (overallScore >= 75) scoreColor = "text-green-600 dark:text-green-400";
                else if (overallScore >= 50) scoreColor = "text-yellow-600 dark:text-yellow-400";

                return (
                  <div key={formStats.formId} className="bg-white dark:bg-gray-800">
                    {/* Form Header - Clickable Accordion */}
                    <button
                      onClick={() => toggleFormSummary(formStats.formId)}
                      className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-200 group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl group-hover:scale-105 transition-transform">
                          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="text-left">
                          <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            {formStats.formTitle}
                            <span className="text-xs font-normal bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-300">
                              {formStats.sections.length} section{formStats.sections.length !== 1 ? 's' : ''}
                            </span>
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {formStats.totalResponses} response{formStats.totalResponses !== 1 ? 's' : ''} • {formTotal} total answers
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        {/* Overall Score Badge */}
                        <div className="hidden sm:block text-right">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Overall Score</p>
                          <p className={`text-xl font-bold ${scoreColor}`}>{overallScore}%</p>
                        </div>

                        {/* Expand/Collapse Icon */}
                        <div className={`transform transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        </div>
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="px-6 pb-6 space-y-6 animate-in slide-in-from-top-2 duration-200">
                        {/* Color Legend */}
                        <div className="flex flex-wrap items-center gap-4 pt-2 pb-3 border-b border-gray-100 dark:border-gray-800">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${columnConfig.type === "acceptedRejectedRework" ? "bg-emerald-500" : "bg-green-500"}`} />
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${columnConfig.positiveColor}`}>
                              {columnConfig.positiveLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${columnConfig.negativeColor}`}>
                              {columnConfig.negativeLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${columnConfig.type === "acceptedRejectedRework" ? "bg-amber-400" : "bg-gray-400"}`} />
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${columnConfig.neutralColor}`}>
                              {columnConfig.neutralLabel}
                            </span>
                          </div>
                          {formTotal > 0 && (
                            <div className="ml-auto flex items-center gap-2">
                              <div className="text-right">
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Form Score</p>
                                <p className={`text-sm font-bold ${scoreColor}`}>{overallScore}%</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Table + Radar Side by Side */}
                        <div className="flex flex-col xl:flex-row gap-6">
                          {/* Sections Table */}
                          <div className="flex-1 min-w-0 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                            {formStats.sections.length === 0 ? (
                              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                No sections available for this form
                              </div>
                            ) : (
                              <table className="min-w-full text-xs border-collapse">
                                <thead className="bg-gray-100 dark:bg-gray-800">
                                  <tr>
                                    <th className="text-left px-4 py-3 border border-gray-300 dark:border-gray-600 min-w-[200px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">
                                      Section
                                    </th>
                                    <th className="text-center px-3 py-3 border border-gray-300 dark:border-gray-600 font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">
                                      Total
                                    </th>
                                    <th className={`text-center px-3 py-2 border border-gray-300 dark:border-gray-600 font-bold ${columnConfig.positiveColor}`}>
                                      {columnConfig.positiveLabel}
                                    </th>
                                    <th className={`text-center px-3 py-2 border border-gray-300 dark:border-gray-600 font-bold ${columnConfig.negativeColor}`}>
                                      {columnConfig.negativeLabel}
                                    </th>
                                    <th className={`text-center px-3 py-2 border border-gray-300 dark:border-gray-600 font-bold ${columnConfig.neutralColor}`}>
                                      {columnConfig.neutralLabel}
                                    </th>
                                    <th className="text-center px-4 py-3 border border-gray-300 dark:border-gray-600 font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200 w-32">
                                      Visualization
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {formStats.sections.map((section, idx) => {
                                    const yesPct = section.total > 0 ? Math.round((section.yesCount / section.total) * 100) : 0;
                                    const noPct = section.total > 0 ? Math.round((section.noCount / section.total) * 100) : 0;
                                    const naPct = section.total > 0 ? Math.round((section.naCount / section.total) * 100) : 0;

                                    return (
                                      <tr
                                        key={section.sectionId}
                                        className={`border-b border-gray-200 dark:border-gray-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors ${idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50/50 dark:bg-gray-800/50"}`}
                                      >
                                        <td className="px-4 py-3 font-semibold text-blue-600 dark:text-blue-400 border border-gray-200 dark:border-gray-700 text-sm">
                                          {section.sectionTitle}
                                        </td>
                                        <td className="text-center px-3 py-3 border border-gray-200 dark:border-gray-700 font-bold text-gray-900 dark:text-white">
                                          {section.total}
                                        </td>
                                        <td className={`text-center px-3 py-3 border border-gray-200 dark:border-gray-700 font-bold ${columnConfig.positiveColor}`}>
                                          {section.yesCount} <span className="text-gray-400 dark:text-gray-500 font-medium">({yesPct}%)</span>
                                        </td>
                                        <td className={`text-center px-3 py-3 border border-gray-200 dark:border-gray-700 font-bold ${columnConfig.negativeColor}`}>
                                          {section.noCount} <span className="text-gray-400 dark:text-gray-500 font-medium">({noPct}%)</span>
                                        </td>
                                        <td className={`text-center px-3 py-3 border border-gray-200 dark:border-gray-700 font-bold ${columnConfig.neutralColor}`}>
                                          {section.naCount} <span className="text-gray-400 dark:text-gray-500 font-medium">({naPct}%)</span>
                                        </td>
                                        <td className="px-3 py-3 border border-gray-200 dark:border-gray-700">
                                          <div className="flex justify-center">
                                            <div className="relative" style={{ width: "120px", height: "24px" }}>
                                              <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700 rounded-sm overflow-hidden flex">
                                                {yesPct > 0 && (
                                                  <div
                                                    className="h-full transition-all"
                                                    style={{
                                                      width: `${yesPct}%`,
                                                      backgroundColor: columnConfig.type === "acceptedRejectedRework" ? "#22c55e" : "#22c55e"
                                                    }}
                                                    title={`${columnConfig.positiveLabel}: ${yesPct}%`}
                                                  />
                                                )}
                                                {noPct > 0 && (
                                                  <div
                                                    className="h-full transition-all"
                                                    style={{ width: `${noPct}%`, backgroundColor: "#ef4444" }}
                                                    title={`${columnConfig.negativeLabel}: ${noPct}%`}
                                                  />
                                                )}
                                                {naPct > 0 && (
                                                  <div
                                                    className="h-full transition-all"
                                                    style={{
                                                      width: `${naPct}%`,
                                                      backgroundColor: columnConfig.type === "acceptedRejectedRework" ? "#f59e0b" : "#9ca3af"
                                                    }}
                                                    title={`${columnConfig.neutralLabel}: ${naPct}%`}
                                                  />
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex justify-center gap-3 mt-1 text-[9px] font-bold">
                                            <span className="text-green-600 dark:text-green-400">{yesPct}%</span>
                                            <span className="text-red-600 dark:text-red-400">{noPct}%</span>
                                            <span className={columnConfig.type === "acceptedRejectedRework" ? "text-amber-600 dark:text-amber-400" : "text-gray-500"}>
                                              {naPct}%
                                            </span>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}

                                  {/* Form Footer Totals */}
                                  <tr className="bg-blue-100/80 dark:bg-blue-900/40 font-extrabold border-t-2 border-blue-300 dark:border-blue-600">
                                    <td className="px-4 py-3 text-blue-900 dark:text-blue-100 border border-gray-300 dark:border-gray-600 uppercase tracking-wider">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 bg-blue-700 rounded-full" /> FORM TOTAL
                                      </div>
                                    </td>
                                    <td className="text-center px-3 py-3 border border-gray-300 dark:border-gray-600 text-blue-900 dark:text-blue-100 text-base font-bold">
                                      {formTotal}
                                    </td>
                                    <td className={`text-center px-3 py-3 border border-gray-300 dark:border-gray-600 font-bold ${columnConfig.positiveColor}`}>
                                      {formStats.totalYes} <span className="text-gray-500 dark:text-gray-400 font-medium">
                                        ({formTotal > 0 ? Math.round((formStats.totalYes / formTotal) * 100) : 0}%)
                                      </span>
                                    </td>
                                    <td className={`text-center px-3 py-3 border border-gray-300 dark:border-gray-600 font-bold ${columnConfig.negativeColor}`}>
                                      {formStats.totalNo} <span className="text-gray-500 dark:text-gray-400 font-medium">
                                        ({formTotal > 0 ? Math.round((formStats.totalNo / formTotal) * 100) : 0}%)
                                      </span>
                                    </td>
                                    <td className={`text-center px-3 py-3 border border-gray-300 dark:border-gray-600 font-bold ${columnConfig.neutralColor}`}>
                                      {formStats.totalNa} <span className="text-gray-500 dark:text-gray-400 font-medium">
                                        ({formTotal > 0 ? Math.round((formStats.totalNa / formTotal) * 100) : 0}%)
                                      </span>
                                    </td>
                                    <td className="px-3 py-3 border border-gray-300 dark:border-gray-600">
                                      <div className="flex justify-center">
                                        <div className="relative" style={{ width: "120px", height: "24px" }}>
                                          <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700 rounded-sm overflow-hidden flex">
                                            {formTotal > 0 && formStats.totalYes > 0 && (
                                              <div
                                                className="h-full transition-all"
                                                style={{
                                                  width: `${Math.round((formStats.totalYes / formTotal) * 100)}%`,
                                                  backgroundColor: columnConfig.type === "acceptedRejectedRework" ? "#22c55e" : "#22c55e"
                                                }}
                                              />
                                            )}
                                            {formTotal > 0 && formStats.totalNo > 0 && (
                                              <div
                                                className="h-full transition-all"
                                                style={{ width: `${Math.round((formStats.totalNo / formTotal) * 100)}%`, backgroundColor: "#ef4444" }}
                                              />
                                            )}
                                            {formTotal > 0 && formStats.totalNa > 0 && (
                                              <div
                                                className="h-full transition-all"
                                                style={{
                                                  width: `${Math.round((formStats.totalNa / formTotal) * 100)}%`,
                                                  backgroundColor: columnConfig.type === "acceptedRejectedRework" ? "#f59e0b" : "#9ca3af"
                                                }}
                                              />
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex justify-center gap-3 mt-1 text-[9px] font-bold">
                                        <span className="text-green-600 dark:text-green-400">
                                          {formTotal > 0 ? Math.round((formStats.totalYes / formTotal) * 100) : 0}%
                                        </span>
                                        <span className="text-red-600 dark:text-red-400">
                                          {formTotal > 0 ? Math.round((formStats.totalNo / formTotal) * 100) : 0}%
                                        </span>
                                        <span className={columnConfig.type === "acceptedRejectedRework" ? "text-amber-600 dark:text-amber-400" : "text-gray-500"}>
                                          {formTotal > 0 ? Math.round((formStats.totalNa / formTotal) * 100) : 0}%
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            )}
                          </div>

                          {/* Radar Chart */}
                          {formStats.sections.filter(s => s.total > 0).length > 0 && (
                            <div className="w-full xl:w-[450px] flex-shrink-0">
                              <FormRadarChart formStats={formStats} columnConfig={columnConfig} />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {formWiseSectionStats.length === 0 && (
                <div className="p-12 text-center">
                  <PieChart className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No section data available</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Add sections to your forms to see section-wise analytics</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-br from-blue-50 via-white to-indigo-50/50 dark:from-blue-900/20 dark:via-gray-800 dark:to-indigo-900/15 p-6 rounded-2xl shadow-2xl border border-blue-200 dark:border-blue-800/50 no-pdf">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
              <Zap className="w-6 h-6 text-yellow-500" /> Quick Actions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setActiveTab("requests")}
                className="flex items-center justify-center p-4 text-white rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:opacity-90"
                style={{ backgroundColor: "#1e3a8a" }}
              >
                <FileText className="w-5 h-5 mr-3" /> View All Requests
              </button>
              <button
                onClick={fetchData}
                className="flex items-center justify-center p-4 text-white rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
              >
                <RefreshCw className="w-5 h-5 mr-3" /> Refresh Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          CUSTOMER REQUESTS TAB
      ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "requests" && (
        <div className="space-y-6">
          {Object.keys(groupedResponses)
            .sort((a, b) => a.localeCompare(b))
            .map((formTitle) => {
              const formGroups = groupedResponses[formTitle];
              const isExpanded = expandedForms.includes(formTitle);
              const totalFormResponses = Object.values(formGroups).reduce(
                (sum, responses) => sum + responses.length,
                0,
              );

              return (
                <div
                  key={formTitle}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-800/30 overflow-hidden"
                >
                  <div
                    className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    onClick={() => toggleForm(formTitle)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                        <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                          {formTitle}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {totalFormResponses} request
                          {totalFormResponses !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-6 h-6 text-gray-400 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </div>

                  {isExpanded && (
                    <div className="p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 space-y-6">
                      {Object.keys(formGroups)
                        .sort(
                          (a, b) =>
                            new Date(b).getTime() - new Date(a).getTime(),
                        )
                        .map((date) => (
                          <div key={date} className="space-y-3">
                            <h4 className="text-sm font-bold text-gray-600 dark:text-gray-300 flex items-center gap-2">
                              <Calendar className="w-4 h-4" /> {date}
                              <span className="text-xs font-normal text-gray-500">
                                ({formGroups[date].length})
                              </span>
                            </h4>
                            <div className="space-y-3">
                              {formGroups[date].map((response) => {
                                const isFollowUp = !!response.parentResponseId;
                                return (
                                  <div
                                    key={response._id}
                                    className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl border transition-all duration-200 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md ${isFollowUp ? "sm:ml-8" : ""}`}
                                  >
                                    <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
                                      <div className="p-2.5 rounded-lg flex-shrink-0 bg-blue-50 dark:bg-blue-900/20">
                                        {isFollowUp ? (
                                          <span className="text-blue-600 dark:text-blue-400 text-xs font-bold">
                                            ↳
                                          </span>
                                        ) : (
                                          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                          {isFollowUp && (
                                            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                              Follow-up
                                            </span>
                                          )}
                                          {response.submissionMetadata
                                            ?.source === "internal" && (
                                              <span className="text-xs font-semibold px-2 py-1 rounded-md bg-purple-200 dark:bg-purple-900/40 text-purple-900 dark:text-purple-300">
                                                Internal
                                              </span>
                                            )}
                                          {response.submissionMetadata
                                            ?.source === "whatsapp" && (
                                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                                                <MessageCircle className="w-3 h-3" />{" "}
                                                WhatsApp
                                              </span>
                                            )}
                                          {response.submissionMetadata
                                            ?.source === "email" && (
                                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                                <Mail className="w-3 h-3" /> Email
                                              </span>
                                            )}
                                          {response.submissionMetadata
                                            ?.source === "sms" && (
                                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                                                <MessageSquare className="w-3 h-3" />{" "}
                                                SMS
                                              </span>
                                            )}
                                        </div>

                                        <div className="flex flex-col sm:flex-row sm:items-center text-xs gap-2 sm:gap-3">
                                          {(() => {
                                            const stats = response.stats;
                                            if (!stats) return null;
                                            const total =
                                              stats.yes +
                                              stats.no +
                                              stats.na +
                                              stats.accepted +
                                              stats.rejected +
                                              stats.rework;
                                            if (total === 0) return null;
                                            return (
                                              <div className="flex flex-wrap items-center gap-1.5 mr-2">
                                                {stats.yes > 0 && (
                                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                                                    Yes{" "}
                                                    {Math.round(
                                                      (stats.yes / total) * 100,
                                                    )}
                                                    %
                                                  </span>
                                                )}
                                                {stats.no > 0 && (
                                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                                                    No{" "}
                                                    {Math.round(
                                                      (stats.no / total) * 100,
                                                    )}
                                                    %
                                                  </span>
                                                )}
                                                {stats.na > 0 && (
                                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                                    N/A{" "}
                                                    {Math.round(
                                                      (stats.na / total) * 100,
                                                    )}
                                                    %
                                                  </span>
                                                )}
                                                {stats.accepted > 0 && (
                                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                                                    Acc{" "}
                                                    {Math.round(
                                                      (stats.accepted / total) *
                                                      100,
                                                    )}
                                                    %
                                                  </span>
                                                )}
                                                {stats.rejected > 0 && (
                                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
                                                    Rej{" "}
                                                    {Math.round(
                                                      (stats.rejected / total) *
                                                      100,
                                                    )}
                                                    %
                                                  </span>
                                                )}
                                                {stats.rework > 0 && (
                                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                                                    Rew{" "}
                                                    {Math.round(
                                                      (stats.rework / total) *
                                                      100,
                                                    )}
                                                    %
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          })()}
                                          {response.dealerName &&
                                            response.dealerName !==
                                            "Unknown" && (
                                              <div className="inline-flex items-center text-gray-600 dark:text-gray-400">
                                                <User className="w-4 h-4 mr-1.5 flex-shrink-0" />
                                                <span
                                                  className="font-medium truncate"
                                                  title={response.dealerName}
                                                >
                                                  {response.dealerName}
                                                  {response.dealerRank && (
                                                    <span
                                                      className={`ml-2 text-[10px] font-bold min-w-[24px] h-5 px-1.5 rounded-full inline-flex items-center justify-center border shadow-sm ${getRankStyle(response.dealerName)}`}
                                                    >
                                                      #{response.dealerRank}
                                                    </span>
                                                  )}
                                                </span>
                                              </div>
                                            )}
                                          {response.submissionMetadata
                                            ?.location && (
                                              <div className="inline-flex items-center text-gray-600 dark:text-gray-400">
                                                <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0" />
                                                <span className="truncate">
                                                  {[
                                                    response.submissionMetadata
                                                      .location.city,
                                                    response.submissionMetadata
                                                      .location.region,
                                                    response.submissionMetadata
                                                      .location.country,
                                                  ]
                                                    .filter(Boolean)
                                                    .join(", ")}
                                                </span>
                                              </div>
                                            )}
                                          <div className="inline-flex items-center text-gray-600 dark:text-gray-400">
                                            <Calendar className="w-4 h-4 mr-1.5 flex-shrink-0" />
                                            <span>
                                              {formatTimestamp(
                                                response.createdAt,
                                              )}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0 mt-4 sm:mt-0 sm:ml-4">
                                      <button
                                        onClick={() =>
                                          navigate(
                                            `/responses/${response._id || response.id}`,
                                          )
                                        }
                                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
                                        title="View details"
                                      >
                                        <Eye className="w-5 h-5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}

          {Object.keys(groupedResponses).length === 0 && (
            <div className="text-center py-16 bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-2xl border border-blue-100 dark:border-blue-800/30">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Customer Requests
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                {selectedFormIds.length === 0
                  ? "There are currently no customer service requests."
                  : "No requests match your current filters."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
