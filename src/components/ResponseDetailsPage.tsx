import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Eye,
  Calendar,
  FileText,
  User,
  X,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  Trash2,
  Edit2,
  BarChart3,
  PieChart,
  Activity,
  Zap,
  Target,
  Award,
  Users,
  FileCheck,
  AlertTriangle,
  Save,
  ChevronDown,
  MapPin,
  ArrowLeft,
  TrendingUp,
} from "lucide-react";
import { Bar, Line, Pie, Radar } from "react-chartjs-2";
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
import type { ActiveElement } from "chart.js";
import { apiClient } from "../api/client";
import { formatTimestamp } from "../utils/dateUtils";
import { useNotification } from "../context/NotificationContext";
import { useLogo } from "../context/LogoContext";
import { generateResponseExcelReport } from "../utils/responseExportUtils";
import { generateAndDownloadPDF } from "../utils/pdfExportUtils";
import FilePreview from "./FilePreview";
import ResponseEdit from "./ResponseEdit";
import DashboardSummaryCard from "./DashboardSummaryCard";
import { isImageUrl } from "../utils/answerTemplateUtils";
import ImageLink from "./ImageLink";

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
  RadialLinearScale
);

function formatSectionLabel(label: string, maxLength = 20): string {
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
}

interface Form {
  _id: string;
  id?: string;
  title: string;
  description?: string;
  parentFormId?: string;
  sections?: any[];
  followUpQuestions?: any[];
}

interface LocationData {
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  isp?: string;
}

interface SubmissionMetadata {
  ipAddress?: string;
  userAgent?: string;
  browser?: string;
  device?: string;
  os?: string;
  location?: LocationData;
  submittedAt?: string;
}

interface Response {
  _id: string;
  id: string;
  questionId: string;
  formId?: string;
  parentResponseId?: string;
  answers: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  status?: string;
  yesNoScore?: {
    yes: number;
    total: number;
  };
  submissionMetadata?: SubmissionMetadata;
  dealerName?: string;
}

type SectionStat = {
  id: string;
  title: string;
  yes: number;
  no: number;
  na: number;
  total: number;
  weightage: number;
};

export default function ResponseDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError, showConfirm } = useNotification();
  const { logo } = useLogo();

  const [response, setResponse] = useState<Response | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"dashboard" | "responses">(
    "dashboard"
  );
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [selectedPDFType, setSelectedPDFType] = useState<
    "no-only" | "yes-only" | "both" | null
  >(null);
  const [editingResponse, setEditingResponse] = useState<Response | null>(null);
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editingFormLoading, setEditingFormLoading] = useState(false);
  const [expandResponseRateBreakdown, setExpandResponseRateBreakdown] =
    useState(false);
  const [showWeightageColumns, setShowWeightageColumns] = useState(false);
  const [addWeightMode, setAddWeightMode] = useState(false);
  const [showWeightageCheckbox, setShowWeightageCheckbox] = useState(true);
  const [editingAllWeightages, setEditingAllWeightages] = useState(false);
  const [weightageValues, setWeightageValues] = useState<Record<string, string>>({});
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [showResponseDropdown, setShowResponseDropdown] = useState(false);
  const [savingWeightage, setSavingWeightage] = useState(false);
  const [redistributionMode, setRedistributionMode] = useState(false);
  const [tempWeightageValues, setTempWeightageValues] = useState<Record<string, string>>({});
  const [weightageBalance, setWeightageBalance] = useState(0);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(null);
  const [sectionChartTypes, setSectionChartTypes] = useState<Record<string, "pie" | "bar">>({});

  useEffect(() => {
    fetchResponseDetails();
  }, [id]);

  const fetchResponseDetails = async () => {
    try {
      setLoading(true);
      if (!id) {
        throw new Error("Response ID is required");
      }
      const responsesData = await apiClient.getResponses();
      const selectedResponse = responsesData.responses.find(
        (r: any) => r._id === id || r.id === id || String(r._id) === id || String(r.id) === id
      );

      if (!selectedResponse) {
        console.error("Response not found. Looking for ID:", id);
        console.error("Available response IDs:", responsesData.responses.map((r: any) => ({ _id: r._id, id: r.id })));
        throw new Error(`Response with ID "${id}" not found. Please check if the response exists.`);
      }

      const formsData = await apiClient.getForms();
      const formMap = formsData.forms.reduce((map: Record<string, any>, f: any) => {
        if (f._id) map[f._id] = f;
        if (f.id) map[f.id] = f;
        return map;
      }, {});

      const formIdentifier = selectedResponse.questionId || selectedResponse.formId;
      const selectedForm = formMap[formIdentifier];

      if (selectedForm?.sections) {
        selectedForm.sections.forEach((section: any) => {
          if (section.questions) {
            section.questions.forEach((question: any) => {
              if (!Array.isArray(question.followUpQuestions)) {
                question.followUpQuestions = [];
              }
            });
          }
        });
      }

      if (!Array.isArray(selectedForm.followUpQuestions)) {
        selectedForm.followUpQuestions = [];
      }

      setResponse(selectedResponse);
      setForm(selectedForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load response");
      console.error("Error loading response details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!response) return;

    setUpdatingStatus(true);
    try {
      await apiClient.updateResponse(response._id, { status: newStatus });
      setResponse({ ...response, status: newStatus });
      setShowStatusUpdate(false);
      showSuccess(`Status updated to ${getStatusInfo(newStatus).label}`);
    } catch (err) {
      console.error("Failed to update status:", err);
      showError("Failed to update status. Please try again.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleEditResponse = async () => {
    if (!response) return;

    setEditingResponse(response);
    setEditingForm(null);
    setEditingFormLoading(true);
    try {
      const formIdentifier = response.questionId || response.formId;
      if (!formIdentifier) {
        throw new Error("Missing form identifier for response");
      }
      const formData = await apiClient.getForm(formIdentifier);
      const loadedForm = formData.form;

      if (loadedForm?.sections) {
        loadedForm.sections.forEach((section: any) => {
          if (section.questions) {
            section.questions.forEach((question: any) => {
              if (!Array.isArray(question.followUpQuestions)) {
                question.followUpQuestions = [];
              }
            });
          }
        });
      }

      if (!Array.isArray(loadedForm.followUpQuestions)) {
        loadedForm.followUpQuestions = [];
      }

      setEditingForm(loadedForm);
    } catch (err) {
      console.error("Failed to load form for editing:", err);
      showError("Failed to load form for editing. Please try again.");
      setEditingResponse(null);
    } finally {
      setEditingFormLoading(false);
    }
  };

  const handleCloseEdit = () => {
    setEditingResponse(null);
    setEditingForm(null);
    setSavingEdit(false);
    setEditingFormLoading(false);
  };

  const handleSaveEditedResponse = async (updated: any) => {
    if (savingEdit || !response) return;

    setSavingEdit(true);
    try {
      await apiClient.updateResponse(response._id, {
        answers: updated.answers,
      });
      setResponse(updated);
      handleCloseEdit();
      showSuccess("Response updated successfully.");
    } catch (err) {
      console.error("Failed to save response:", err);
      showError("Failed to save response. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleExportExcel = async () => {
    if (!response || !form) return;

    setExportingExcel(true);
    try {
      const fileName = `${form.title}_${formatTimestamp(
        response.createdAt
      )}.xlsx`;
      await generateResponseExcelReport([response], form, fileName);
      showSuccess("Excel file downloaded successfully.");
    } catch (err) {
      console.error("Failed to export Excel:", err);
      showError("Failed to export Excel. Please try again.");
    } finally {
      setExportingExcel(false);
    }
  };

  const handleDownloadPDF = async (type?: string) => {
    if (!response || !form) return;

    setGeneratingPDF(true);
    try {
      await generateAndDownloadPDF(
        response as any,
        form as any,
        type as any
      );
      showSuccess("PDF downloaded successfully.");
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      showError("Failed to generate PDF. Please try again.");
    } finally {
      setGeneratingPDF(false);
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return {
          color: "text-yellow-600",
          bgColor: "bg-yellow-50",
          icon: Clock,
          label: "Pending",
        };
      case "confirmed":
        return {
          color: "text-blue-600",
          bgColor: "bg-blue-50",
          icon: CheckCircle,
          label: "Confirmed",
        };
      case "verified":
        return {
          color: "text-green-600",
          bgColor: "bg-green-50",
          icon: CheckCircle,
          label: "Verified",
        };
      case "rejected":
        return {
          color: "text-red-600",
          bgColor: "bg-red-50",
          icon: XCircle,
          label: "Rejected",
        };
      default:
        return {
          color: "text-gray-600",
          bgColor: "bg-gray-50",
          icon: Clock,
          label: "Unknown",
        };
    }
  };

  const getAllQuestions = (form: Form) => {
    const questions: Record<string, any> = {};

    form.sections?.forEach((section) => {
      section.questions?.forEach((question: any) => {
        questions[question.id] = question;
        question.followUpQuestions?.forEach((followUp: any) => {
          questions[followUp.id] = followUp;
        });
      });
    });

    form.followUpQuestions?.forEach((question: any) => {
      questions[question.id] = question;
    });

    return questions;
  };

  function collectYesNoQuestionIds(form: Form): string[] {
    const ids = new Set<string>();

    const processQuestion = (question: any) => {
      if (!question) {
        return;
      }
      if (question.type === "yesNoNA" && question.id) {
        ids.add(question.id);
      }
      question.followUpQuestions?.forEach(processQuestion);
    };

    form.sections?.forEach((section) => {
      section.questions?.forEach(processQuestion);
    });

    form.followUpQuestions?.forEach(processQuestion);

    return Array.from(ids);
  }

  function extractYesNoValues(value: any): string[] {
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
  }

  function getSectionYesNoStats(
    form: Form,
    answers: Record<string, any>
  ): SectionStat[] {
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

          const normalizedValues = extractYesNoValues(answers?.[question.id]);
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
  }

  function getSectionYesNoQuestionStats(sectionId: string) {
    if (!form || !response) return [];

    const section = form.sections?.find((s: any) => s.id === sectionId);
    if (!section) return [];

    const questionStats: Array<{
      id: string;
      title: string;
      subParam1?: string;
      yes: number;
      no: number;
      na: number;
      total: number;
    }> = [];

    const processQuestion = (question: any) => {
      if (!question) return;

      if (question.type === "yesNoNA" && question.id) {
        const normalizedValues = extractYesNoValues(
          response.answers?.[question.id]
        );
        const counts = { yes: 0, no: 0, na: 0, total: 0 };

        if (normalizedValues.length > 0) {
          counts.total = 1;
          if (normalizedValues.includes("yes")) counts.yes = 1;
          if (normalizedValues.includes("no")) counts.no = 1;
          if (
            normalizedValues.includes("n/a") ||
            normalizedValues.includes("na") ||
            normalizedValues.includes("not applicable")
          )
            counts.na = 1;
        }

        questionStats.push({
          id: question.id,
          title:
            question.title ||
            question.label ||
            question.text ||
            `Question ${question.id}`,
          subParam1: question.subParam1,
          ...counts,
        });
      }

      question.followUpQuestions?.forEach(processQuestion);
    };

    section.questions?.forEach(processQuestion);

    const groupedStats: Map<
      string,
      {
        id: string;
        title: string;
        subParam1?: string;
        yes: number;
        no: number;
        na: number;
        total: number;
      }
    > = new Map();

    questionStats.forEach((stat) => {
      const key = stat.subParam1 || "No parameter";
      if (groupedStats.has(key)) {
        const existing = groupedStats.get(key)!;
        existing.yes += stat.yes;
        existing.no += stat.no;
        existing.na += stat.na;
        existing.total += stat.total;
      } else {
        groupedStats.set(key, { ...stat });
      }
    });

    return Array.from(groupedStats.values());
  }

  const getSectionQuestionsWithFollowUps = (sectionId: string) => {
    if (!form || !response) return [];

    const section = form.sections?.find((s: any) => s.id === sectionId);
    if (!section) return [];

    const mainQuestionsWithFollowUps: any[] = [];
    const questionIds = collectYesNoQuestionIds({
      ...form,
      sections: [section],
    });

    const mainQuestions: any[] = [];
    const followUpMap = new Map<string, any[]>();

    section.questions?.forEach((question: any) => {
      if (question.showWhen && question.showWhen.questionId) {
        const parentId = question.showWhen.questionId;
        if (!followUpMap.has(parentId)) {
          followUpMap.set(parentId, []);
        }
        followUpMap.get(parentId)!.push(question);
      } else {
        mainQuestions.push(question);
      }
    });

    mainQuestions.forEach((question: any) => {
      if (questionIds.includes(question.id)) {
        const answers = response.answers?.[question.id];
        const yesNoValues = extractYesNoValues(answers);

        const followUpQuestionsForThis = [
          ...(form.followUpQuestions?.filter(
            (fq: any) => fq.parentId === question.id
          ) || []),
          ...(question.followUpQuestions || []),
          ...(followUpMap.get(question.id) || []),
        ];

        if (yesNoValues.length > 0 || followUpQuestionsForThis.length > 0) {
          const mainQuestion = {
            id: question.id,
            title: question.title || question.label,
            subParam1: question.subParam1,
            yesNoValues,
            followUpQuestions: followUpQuestionsForThis.map((fq: any) => ({
              id: fq.id || fq._id,
              title: fq.title || fq.label || fq.text,
              subParam1: fq.subParam1,
              answer: response.answers?.[fq.id || fq._id],
            })),
          };

          mainQuestionsWithFollowUps.push(mainQuestion);
        }
      }
    });

    return mainQuestionsWithFollowUps;
  };

  const sectionStats = useMemo(() => {
    if (!form || !response) {
      return [] as SectionStat[];
    }
    return getSectionYesNoStats(form, response.answers);
  }, [form, response]);

  const filteredSectionStats = useMemo(
    () =>
      sectionStats.filter(
        (stat) =>
          stat.yes > 0 || stat.no > 0 || stat.na > 0 || stat.weightage > 0
      ),
    [sectionStats]
  );

  const sectionChartData = useMemo(() => {
    const calculatePercentage = (value: number, total: number) =>
      total ? parseFloat(((value / total) * 100).toFixed(1)) : 0;

    return {
      labels: filteredSectionStats.map((stat) =>
        formatSectionLabel(stat.title)
      ),
      datasets: [
        {
          label: "Yes",
          data: filteredSectionStats.map((stat) =>
            calculatePercentage(stat.yes, stat.total)
          ),
          borderColor: "#1d4ed8",
          backgroundColor: "rgba(29, 78, 216, 0.25)",
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: "#1d4ed8",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointHoverRadius: 6,
          tension: 0.4,
        },
        {
          label: "No",
          data: filteredSectionStats.map((stat) =>
            calculatePercentage(stat.no, stat.total)
          ),
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.25)",
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: "#3b82f6",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointHoverRadius: 6,
          tension: 0.4,
        },
        {
          label: "N/A",
          data: filteredSectionStats.map((stat) =>
            calculatePercentage(stat.na, stat.total)
          ),
          borderColor: "#93c5fd",
          backgroundColor: "rgba(147, 197, 253, 0.25)",
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: "#93c5fd",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointHoverRadius: 6,
          tension: 0.4,
        },
      ],
    };
  }, [filteredSectionStats]);

  const sectionChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom" as const,
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
              return filteredSectionStats[index]?.title || "";
            },
            label: (context: any) => {
              const value = context.parsed?.r ?? 0;
              return `${context.dataset.label}: ${value.toFixed(1)}%`;
            },
          },
        },
      },
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: (value: any) => `${value}%`,
            color: document.documentElement.classList.contains("dark")
              ? "#d1d5db"
              : "#374151",
            font: {
              size: 11,
            },
          },
          grid: {
            color: document.documentElement.classList.contains("dark")
              ? "rgba(147, 197, 253, 0.3)"
              : "rgba(59, 130, 246, 0.3)",
            lineWidth: 1.5,
          },
          angleLines: {
            display: true,
            color: document.documentElement.classList.contains("dark")
              ? "rgba(147, 197, 253, 0.4)"
              : "rgba(59, 130, 246, 0.4)",
            lineWidth: 1.5,
          },
        },
      },
    }),
    [filteredSectionStats]
  );

  const sectionChartHeight = 450;

  const sectionSummaryRows = useMemo(
    () =>
      filteredSectionStats.map((stat) => {
        let weightage = stat.weightage;
        if (typeof weightage === "string") {
          weightage = parseFloat(weightage);
        }
        weightage = Number.isFinite(weightage) ? weightage : 0;
        if (weightage > 1) {
          weightage = weightage;
        } else if (weightage > 0) {
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
          noPercent,
          noWeighted,
          naPercent,
          naWeighted,
        };
      }),
    [filteredSectionStats]
  );

  const calculateTotalWeightage = useMemo(() => {
    return sectionSummaryRows.reduce((total, row) => total + row.weightage, 0);
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

  useEffect(() => {
    if (sectionSummaryRows.length > 0) {
      const hasWeightage = sectionSummaryRows.some(row => row.weightage > 0);
      if (hasWeightage) {
        setShowWeightageColumns(true);
        setShowWeightageCheckbox(false);
        setAddWeightMode(false);
      } else {
        setShowWeightageColumns(false);
        setShowWeightageCheckbox(true);
      }
    }
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
          position: "bottom" as const,
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

  const weightedChartHeight = Math.max(320, sectionSummaryRows.length * 32);

  const renderFormContent = () => {
    if (!response || !form) return null;

    const questions = getAllQuestions(form);
    return (
      <div className="space-y-4">
        {Object.entries(response.answers).map(([key, value]) => {
          const question = questions[key];
          return (
            <div
              key={key}
              className="border-b border-primary-100 dark:border-gray-700 pb-4 last:border-b-0"
            >
              <div className="font-semibold text-primary-900 dark:text-gray-100 mb-2">
                {question?.text || key}
              </div>
              {question?.description && (
                <p className="text-sm text-primary-600 dark:text-gray-400 mb-2">
                  {question.description}
                </p>
              )}
              <div className="bg-primary-50 dark:bg-gray-800 rounded-lg p-4">
                {Array.isArray(value) ? (
                  <div className="space-y-1">
                    {value.map((v, idx) => (
                      <div
                        key={idx}
                        className="text-primary-700 dark:text-gray-200"
                      >
                        {isImageUrl(String(v)) ? (
                          <ImageLink url={String(v)} />
                        ) : (
                          String(v)
                        )}
                      </div>
                    ))}
                  </div>
                ) : typeof value === "object" ? (
                  <pre className="text-primary-700 dark:text-gray-200 overflow-auto">
                    {JSON.stringify(value, null, 2)}
                  </pre>
                ) : (
                  <div className="text-primary-700 dark:text-gray-200">
                    {isImageUrl(String(value)) ? (
                      <ImageLink url={String(value)} />
                    ) : (
                      String(value)
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4 text-lg">{error}</div>
          <button
            onClick={() => navigate("/responses/all")}
            className="btn-secondary flex items-center gap-2 mx-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Responses
          </button>
        </div>
      </div>
    );
  }

  if (!response || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600 mb-4">Response not found</div>
          <button
            onClick={() => navigate("/responses/all")}
            className="btn-secondary flex items-center gap-2 mx-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Responses
          </button>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(response.status || "pending");
  const StatusIcon = statusInfo.icon;
  const questions = getAllQuestions(form);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Header Section */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border-b border-indigo-200 dark:border-indigo-700/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/responses/all")}
              className="p-2 hover:bg-white/50 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
              title="Back to responses"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 dark:from-indigo-400 dark:to-blue-400 bg-clip-text text-transparent">
                {form.title}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Submitted on {formatTimestamp(response.createdAt)}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleEditResponse}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all duration-200 shadow-sm"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={handleExportExcel}
              disabled={exportingExcel}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
            >
              {exportingExcel ? (
                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {exportingExcel ? "Exporting..." : "Export"}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Status and Details Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Status Card */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Status
                </p>
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${statusInfo.bgColor}`}>
                    <StatusIcon className={`w-5 h-5 ${statusInfo.color}`} />
                  </div>
                  <span className={`text-lg font-bold ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowStatusUpdate(!showStatusUpdate)}
                className="px-3 py-1 text-xs font-semibold text-primary-700 dark:text-primary-300 bg-primary-100 dark:bg-primary-900/30 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
              >
                Update
              </button>
            </div>

            {showStatusUpdate && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
                <button
                  onClick={() => handleStatusUpdate("pending")}
                  disabled={
                    updatingStatus ||
                    response.status?.toLowerCase() === "pending"
                  }
                  className="w-full px-3 py-2 text-xs font-semibold rounded-lg text-yellow-700 bg-yellow-100 hover:bg-yellow-200 dark:text-yellow-300 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Clock className="w-3 h-3 inline mr-1" />
                  Pending
                </button>
                <button
                  onClick={() => handleStatusUpdate("verified")}
                  disabled={
                    updatingStatus ||
                    response.status?.toLowerCase() === "verified"
                  }
                  className="w-full px-3 py-2 text-xs font-semibold rounded-lg text-green-700 bg-green-100 hover:bg-green-200 dark:text-green-300 dark:bg-green-900/30 dark:hover:bg-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <CheckCircle className="w-3 h-3 inline mr-1" />
                  Verified
                </button>
                <button
                  onClick={() => handleStatusUpdate("rejected")}
                  disabled={
                    updatingStatus ||
                    response.status?.toLowerCase() === "rejected"
                  }
                  className="w-full px-3 py-2 text-xs font-semibold rounded-lg text-red-700 bg-red-100 hover:bg-red-200 dark:text-red-300 dark:bg-red-900/30 dark:hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <XCircle className="w-3 h-3 inline mr-1" />
                  Rejected
                </button>
              </div>
            )}
          </div>

          {/* Submitted Date Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl shadow-lg border border-blue-200 dark:border-blue-700/50 p-4 hover:shadow-xl transition-shadow duration-300">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-2">
              Submitted On
            </p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              {formatTimestamp(response.createdAt).split(",")[0]}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {formatTimestamp(response.createdAt).split(",")[1]}
            </p>
          </div>

          {/* Forms Card */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl shadow-lg border border-purple-200 dark:border-purple-700/50 p-4 hover:shadow-xl transition-shadow duration-300">
            <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider mb-2">
              Response Form
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-white truncate">
              {form.title}
            </p>
            {response.submissionMetadata?.location && (
              <div className="flex items-center gap-1 mt-2 text-sm text-gray-600 dark:text-gray-300">
                <MapPin className="w-3 h-3" />
                <span>
                  {response.submissionMetadata.location.city},{" "}
                  {response.submissionMetadata.location.country}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-2 mb-6 bg-white dark:bg-gray-900 rounded-xl p-1 border border-gray-200 dark:border-gray-700 w-fit shadow-lg">
          <button
            onClick={() => setViewMode("dashboard")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 ${
              viewMode === "dashboard"
                ? "bg-gradient-to-r from-indigo-600 to-blue-600 dark:from-indigo-500 dark:to-blue-500 text-white shadow-lg"
                : "text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/60 dark:hover:bg-gray-800/60"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={() => setViewMode("responses")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 ${
              viewMode === "responses"
                ? "bg-gradient-to-r from-indigo-600 to-blue-600 dark:from-indigo-500 dark:to-blue-500 text-white shadow-lg"
                : "text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/60 dark:hover:bg-gray-800/60"
            }`}
          >
            <FileText className="w-4 h-4" />
            Responses
          </button>
        </div>

        {/* Content Area */}
        {viewMode === "dashboard" ? (
          filteredSectionStats.length > 0 ? (
            <div className="space-y-6">
              {/* Dashboard Header with Logo */}
              <div className="bg-gradient-to-br from-white via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20 p-6 rounded-2xl shadow-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    {logo && (
                      <div className="w-16 h-12 rounded-lg overflow-hidden shadow-lg border-2 border-white dark:border-gray-700">
                        <img
                          src={logo}
                          alt="Company Logo"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </div>
                    )}
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {form.title}
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        Comprehensive analysis and insights
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Submitted
                      </p>
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">
                        {formatTimestamp(response.createdAt)}
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                      <FileCheck className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </div>

                {/* Quick Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 backdrop-blur-sm p-3 rounded-xl border border-yellow-200/50 dark:border-yellow-700/50 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 mb-1">
                          Overall Score
                        </p>
                        <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                          {(() => {
                            const totalQuestions = filteredSectionStats.reduce((sum, stat) => sum + stat.total, 0);
                            const totalYes = filteredSectionStats.reduce((sum, stat) => sum + stat.yes, 0);
                            return totalQuestions > 0 ? ((totalYes / totalQuestions) * 100).toFixed(1) : "0.0";
                          })()}%
                        </p>
                      </div>
                      <div className="p-2 bg-yellow-500/20 rounded-full">
                        <Award className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 backdrop-blur-sm p-3 rounded-xl border border-blue-200/50 dark:border-blue-700/50 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">
                          Total Sections
                        </p>
                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                          {filteredSectionStats.length}
                        </p>
                      </div>
                      <div className="p-2 bg-blue-500/20 rounded-full">
                        <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 backdrop-blur-sm p-3 rounded-xl border border-green-200/50 dark:border-green-700/50 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer" onClick={() => setExpandResponseRateBreakdown(!expandResponseRateBreakdown)}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">
                            Response Rate
                          </p>
                          <ChevronDown className={`w-4 h-4 text-green-700 dark:text-green-300 transition-transform duration-300 ${expandResponseRateBreakdown ? "rotate-180" : ""}`} />
                        </div>
                        <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                          {(() => {
                            const totalQuestions = filteredSectionStats.reduce((sum, stat) => sum + stat.total, 0);
                            const totalAnswered = filteredSectionStats.reduce((sum, stat) => sum + stat.yes + stat.no + stat.na, 0);
                            return totalQuestions > 0 ? ((totalAnswered / totalQuestions) * 100).toFixed(1) : "0.0";
                          })()}%
                        </p>
                      </div>
                      <div className="p-2 bg-green-500/20 rounded-full">
                        <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                    </div>

                    {expandResponseRateBreakdown && (
                      <div className="mt-3 pt-3 border-t border-green-300/50 dark:border-green-600/50">
                        <div className="grid grid-cols-3 gap-2">
                          {(() => {
                            const totalYes = filteredSectionStats.reduce((sum, stat) => sum + stat.yes, 0);
                            const totalNo = filteredSectionStats.reduce((sum, stat) => sum + stat.no, 0);
                            const totalNA = filteredSectionStats.reduce((sum, stat) => sum + stat.na, 0);
                            const totalAnswered = totalYes + totalNo + totalNA;
                            const yesPercent = totalAnswered > 0 ? ((totalYes / totalAnswered) * 100).toFixed(1) : "0.0";
                            const noPercent = totalAnswered > 0 ? ((totalNo / totalAnswered) * 100).toFixed(1) : "0.0";
                            const naPercent = totalAnswered > 0 ? ((totalNA / totalAnswered) * 100).toFixed(1) : "0.0";

                            return (
                              <>
                                <div className="text-center p-2 bg-white/50 dark:bg-green-900/20 rounded-lg">
                                  <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-0.5 uppercase">Yes</p>
                                  <p className="text-lg font-bold text-green-700 dark:text-green-300">{yesPercent}%</p>
                                </div>
                                <div className="text-center p-2 bg-white/50 dark:bg-red-900/20 rounded-lg">
                                  <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-0.5 uppercase">No</p>
                                  <p className="text-lg font-bold text-red-700 dark:text-red-300">{noPercent}%</p>
                                </div>
                                <div className="text-center p-2 bg-white/50 dark:bg-yellow-900/20 rounded-lg">
                                  <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 mb-0.5 uppercase">N/A</p>
                                  <p className="text-lg font-bold text-yellow-700 dark:text-yellow-300">{naPercent}%</p>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 backdrop-blur-sm p-3 rounded-xl border border-purple-200/50 dark:border-purple-700/50 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1">
                          Location
                        </p>
                        <p className="text-sm font-bold text-purple-900 dark:text-purple-100">
                          {response.submissionMetadata?.location
                            ? (() => {
                              const loc = response.submissionMetadata.location;
                              const parts = [];
                              if (loc.city) parts.push(loc.city);
                              if (loc.region) parts.push(loc.region);
                              if (loc.country) parts.push(loc.country);
                              return parts.length > 0 ? parts.join(", ") : "Location data unavailable";
                            })()
                            : "Location disabled"
                          }
                        </p>
                      </div>
                      <div className="p-2 bg-purple-500/20 rounded-full">
                        <MapPin className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Basic Information Section */}
              <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                    <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Basic Information
                  </h3>
                </div>
                <div className="space-y-6">
                  {form?.sections && form.sections.length > 0 ? (
                    (() => {
                      const section = form.sections[0];
                      return (
                        <div key={section.id || 0} className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                          <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-gray-200 dark:border-gray-600">
                            <h4 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100">
                              {section.title || "Section 1"}
                            </h4>
                            {section.description && (
                              <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-1">
                                {section.description}
                              </p>
                            )}
                          </div>
                          <div className="divide-y divide-gray-200 dark:divide-gray-600">
                            {section.questions && section.questions.length > 0 ? (
                              section.questions.map((question: any) => {
                                const answer = response.answers?.[question.id];
                                return (
                                  <div key={question.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <p className="font-medium text-gray-900 dark:text-white mb-2">
                                      {question.text || question.id}
                                    </p>
                                    <p className="text-gray-700 dark:text-gray-300">
                                      {answer !== undefined && answer !== null && answer !== '' 
                                        ? (Array.isArray(answer) ? answer.join(', ') : String(answer))
                                        : <span className="text-gray-400 italic">No answer provided</span>
                                      }
                                    </p>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="p-4 text-gray-500 dark:text-gray-400 italic">
                                No questions in this section
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {response.dealerName && (
                        <div className="p-4 bg-white dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                            Dealer Name
                          </p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white break-words">
                            {response.dealerName}
                          </p>
                        </div>
                      )}
                      {response.answers?.dealerCode && (
                        <div className="p-4 bg-white dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                            Dealer Code
                          </p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white break-words">
                            {String(response.answers.dealerCode)}
                          </p>
                        </div>
                      )}
                      {response.answers?.location && (
                        <div className="p-4 bg-white dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                            Location
                          </p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white break-words">
                            {String(response.answers.location)}
                          </p>
                        </div>
                      )}
                      {response.answers?.auditorDate && (
                        <div className="p-4 bg-white dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                            Auditor Date
                          </p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white break-words">
                            {String(response.answers.auditorDate)}
                          </p>
                        </div>
                      )}
                      {response.answers?.auditorName && (
                        <div className="p-4 bg-white dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                            Auditor Name
                          </p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white break-words">
                            {String(response.answers.auditorName)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Section - Yes/No/N/A Analysis for ALL Sections */}
              {form?.sections?.map((section: any) => {
                if (!section) return null;

                const questionStats = getSectionYesNoQuestionStats(section.id);
                if (questionStats.length === 0) return null;

                const sectionTotals = questionStats.reduce(
                  (totals, stat) => ({
                    yes: totals.yes + stat.yes,
                    no: totals.no + stat.no,
                    na: totals.na + stat.na,
                    total: totals.total + stat.total,
                  }),
                  { yes: 0, no: 0, na: 0, total: 0 }
                );

                const sectionPercentages = {
                  yes:
                    sectionTotals.total > 0
                      ? ((sectionTotals.yes / sectionTotals.total) * 100).toFixed(1)
                      : "0.0",
                  no:
                    sectionTotals.total > 0
                      ? ((sectionTotals.no / sectionTotals.total) * 100).toFixed(1)
                      : "0.0",
                  na:
                    sectionTotals.total > 0
                      ? ((sectionTotals.na / sectionTotals.total) * 100).toFixed(1)
                      : "0.0",
                };

                const chartData = {
                  labels: ["Yes", "No", "N/A"],
                  datasets: [
                    {
                      data: [sectionTotals.yes, sectionTotals.no, sectionTotals.na],
                      backgroundColor: ["#10b981", "#ef4444", "#f59e0b"],
                      borderColor: ["#059669", "#dc2626", "#d97706"],
                      borderWidth: 2,
                    },
                  ],
                };

                const chartOptions = {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "bottom" as const,
                      labels: {
                        color: document.documentElement.classList.contains("dark")
                          ? "#d1d5db"
                          : "#374151",
                      },
                    },
                    tooltip: {
                      callbacks: {
                        label: (context: any) => {
                          const total = sectionTotals.yes + sectionTotals.no + sectionTotals.na;
                          const value =
                            typeof context.parsed === "number"
                              ? context.parsed
                              : context.parsed?.y || 0;
                          const percentage =
                            total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                          return `${context.label}: ${value} (${percentage}%)`;
                        },
                      },
                    },
                  },
                };

                return (
                  <div key={section.id} className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-8 rounded-3xl shadow-xl border border-blue-200 dark:border-blue-800">
                    <div className="mb-6">
                      <h3 className="text-2xl font-bold text-blue-900 dark:text-blue-100 flex items-center gap-3">
                        <div className="w-1 h-8 bg-blue-600 rounded-full"></div>
                        {section.title || "Section"} - Yes/No/N/A Analysis
                      </h3>
                      <p className="text-blue-700 dark:text-blue-300 mt-2">
                        Question-wise breakdown of yes/no/n/a responses with overall section summary
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Chart */}
                      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-blue-200 dark:border-blue-700">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 flex items-center">
                            <PieChart className="w-5 h-5 mr-2" />
                            Response Distribution
                          </h4>
                          <select
                            value={sectionChartTypes[section.id] || "pie"}
                            onChange={(e) =>
                              setSectionChartTypes((prev) => ({
                                ...prev,
                                [section.id]: e.target.value as "pie" | "bar",
                              }))
                            }
                            className="px-3 py-1.5 text-sm bg-blue-50 dark:bg-gray-700 border border-blue-200 dark:border-blue-600 rounded-lg text-blue-900 dark:text-blue-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="pie">Pie Chart</option>
                            <option value="bar">Bar Chart</option>
                          </select>
                        </div>
                        <div className="w-full h-64">
                          {sectionChartTypes[section.id] === "bar" ? (
                            <Bar
                              data={{
                                labels: questionStats.map(
                                  (stat) => stat.subParam1 || "No parameter"
                                ),
                                datasets: [
                                  {
                                    label: "Yes",
                                    data: questionStats.map((stat) => stat.yes),
                                    backgroundColor: "#10b981",
                                    borderColor: "#059669",
                                    borderWidth: 1,
                                  },
                                  {
                                    label: "No",
                                    data: questionStats.map((stat) => stat.no),
                                    backgroundColor: "#ef4444",
                                    borderColor: "#dc2626",
                                    borderWidth: 1,
                                  },
                                  {
                                    label: "N/A",
                                    data: questionStats.map((stat) => stat.na),
                                    backgroundColor: "#f59e0b",
                                    borderColor: "#d97706",
                                    borderWidth: 1,
                                  },
                                ],
                              }}
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                  legend: {
                                    position: "top" as const,
                                    labels: {
                                      color: document.documentElement.classList.contains(
                                        "dark"
                                      )
                                        ? "#d1d5db"
                                        : "#374151",
                                    },
                                  },
                                },
                              }}
                            />
                          ) : (
                            <Pie data={chartData} options={chartOptions} />
                          )}
                        </div>
                      </div>

                      {/* Question Breakdown Table */}
                      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-blue-200 dark:border-blue-700 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4">
                          <h4 className="text-lg font-bold text-white flex items-center">
                            <BarChart3 className="w-5 h-5 mr-2" />
                            Question Breakdown
                          </h4>
                        </div>
                        <div className="overflow-x-auto max-h-80">
                          <table className="w-full divide-y divide-blue-200 dark:divide-blue-700 text-sm">
                            <thead className="bg-blue-50 dark:bg-blue-900/50 sticky top-0">
                              <tr>
                                <th className="px-4 py-3 text-left font-bold text-blue-900 dark:text-blue-100 uppercase tracking-wider min-w-48">
                                  Question
                                </th>
                                <th className="px-4 py-3 text-center font-bold text-blue-900 dark:text-blue-100 uppercase tracking-wider min-w-16">
                                  Yes
                                </th>
                                <th className="px-4 py-3 text-center font-bold text-blue-900 dark:text-blue-100 uppercase tracking-wider min-w-16">
                                  No
                                </th>
                                <th className="px-4 py-3 text-center font-bold text-blue-900 dark:text-blue-100 uppercase tracking-wider min-w-16">
                                  N/A
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-blue-200 dark:divide-blue-700 bg-white dark:bg-gray-900">
                              {questionStats.map((stat, index) => {
                                const total = stat.yes + stat.no + stat.na;
                                const yesPercent =
                                  total > 0 ? ((stat.yes / total) * 100).toFixed(1) : 0;
                                const noPercent =
                                  total > 0 ? ((stat.no / total) * 100).toFixed(1) : 0;
                                const naPercent =
                                  total > 0 ? ((stat.na / total) * 100).toFixed(1) : 0;
                                return (
                                  <tr
                                    key={stat.id}
                                    className={`group hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 ${
                                      index % 2 === 0
                                        ? "bg-white dark:bg-gray-900"
                                        : "bg-blue-25 dark:bg-blue-900/5"
                                    }`}
                                  >
                                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                                      <div className="font-semibold">
                                        {stat.subParam1 || "No parameter"}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300 font-medium">
                                      <div className="flex flex-col items-center gap-1">
                                        <span
                                          className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
                                            stat.yes > 0
                                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                              : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500"
                                          }`}
                                        >
                                          {stat.yes}
                                        </span>
                                        <span className="text-xs font-semibold text-green-700 dark:text-green-300">
                                          {yesPercent}%
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300 font-medium">
                                      <div className="flex flex-col items-center gap-1">
                                        <span
                                          className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
                                            stat.no > 0
                                              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                              : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500"
                                          }`}
                                        >
                                          {stat.no}
                                        </span>
                                        <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                                          {noPercent}%
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300 font-medium">
                                      <div className="flex flex-col items-center gap-1">
                                        <span
                                          className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
                                            stat.na > 0
                                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                              : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500"
                                          }`}
                                        >
                                          {stat.na}
                                        </span>
                                        <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">
                                          {naPercent}%
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                              {/* Section Totals Row */}
                              <tr className="bg-blue-100 dark:bg-blue-900/50 border-t-2 border-blue-300 dark:border-blue-600">
                                <td className="px-4 py-3 font-bold text-blue-900 dark:text-blue-100 uppercase tracking-wider">
                                  Section Total
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="text-base font-bold text-green-900 dark:text-green-200">
                                      {sectionTotals.yes}
                                    </span>
                                    <span className="text-xs font-semibold text-green-700 dark:text-green-300">
                                      {sectionPercentages.yes}%
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="text-base font-bold text-red-900 dark:text-red-200">
                                      {sectionTotals.no}
                                    </span>
                                    <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                                      {sectionPercentages.no}%
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="text-base font-bold text-yellow-900 dark:text-yellow-200">
                                      {sectionTotals.na}
                                    </span>
                                    <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">
                                      {sectionPercentages.na}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Main Parameters Table */}
                    {(() => {
                    const sectionQuestions = getSectionQuestionsWithFollowUps(section.id);

                    if (sectionQuestions.length === 0) {
                      return null;
                    }

                    const allFollowUpIds = new Set<string>();
                    const followUpIdAnswerStatus = new Map<string, boolean>();

                    sectionQuestions.forEach((q: any) => {
                      q.followUpQuestions.forEach((fq: any) => {
                        allFollowUpIds.add(fq.id);
                        if (fq.answer && fq.answer !== "N/A" && fq.answer !== "n/a") {
                          followUpIdAnswerStatus.set(fq.id, true);
                        }
                      });
                    });

                    const followUpIdsWithAnswers = Array.from(allFollowUpIds).filter(
                      (id) => followUpIdAnswerStatus.get(id) === true
                    );

                    const followUpsBySubParam: Map<
                      string,
                      Array<{ id: string; subParam1?: string; answer?: any }>
                    > = new Map();

                    followUpIdsWithAnswers.forEach((followUpId) => {
                      const followUpObj = sectionQuestions
                        .flatMap((q: any) => q.followUpQuestions)
                        .find((fq: any) => fq.id === followUpId);

                      const subParamKey = followUpObj?.subParam1 || followUpId;
                      if (!followUpsBySubParam.has(subParamKey)) {
                        followUpsBySubParam.set(subParamKey, []);
                      }
                      followUpsBySubParam.get(subParamKey)!.push({
                        id: followUpId,
                        subParam1: followUpObj?.subParam1,
                        answer: followUpObj?.answer,
                      });
                    });

                    const uniqueSubParams = Array.from(followUpsBySubParam.keys());

                    return (
                      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-8 rounded-3xl shadow-xl border border-emerald-200 dark:border-emerald-800">
                        <div className="mb-6">
                          <h3 className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 flex items-center gap-3">
                            <div className="w-1 h-8 bg-emerald-600 rounded-full"></div>
                            {section.title || "Section"} - Main Parameters
                          </h3>
                        </div>

                        {allFollowUpIds.size === 0 && sectionQuestions.length > 0 && (
                          <div className="mt-3 p-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 rounded text-sm text-yellow-800 dark:text-yellow-200">
                            <strong>⚠️ No follow-up questions found</strong> for{" "}
                            {sectionQuestions.length} main question(s)
                          </div>
                        )}

                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-emerald-200 dark:bg-emerald-800/50">
                                <th className="px-6 py-3 text-left text-emerald-900 dark:text-emerald-100 font-semibold border border-emerald-300 dark:border-emerald-700 min-w-64">
                                  Main Parameters
                                </th>
                                {uniqueSubParams.map((subParam) => (
                                  <th
                                    key={subParam}
                                    className="px-4 py-3 text-left text-emerald-900 dark:text-emerald-100 font-semibold border border-emerald-300 dark:border-emerald-700 min-w-48 bg-emerald-50 dark:bg-emerald-900/30"
                                  >
                                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                                      {subParam}
                                    </span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sectionQuestions.map((mainQuestion, index) => (
                                <tr
                                  key={mainQuestion.id}
                                  className={`border-b border-emerald-200 dark:border-emerald-800 ${
                                    index % 2 === 0
                                      ? "bg-white dark:bg-gray-800/50"
                                      : "bg-emerald-100/30 dark:bg-emerald-900/10"
                                  }`}
                                >
                                  <td className="px-6 py-4 font-medium text-gray-800 dark:text-gray-200 border border-emerald-200 dark:border-emerald-800">
                                    <div className="font-bold text-base">
                                      {mainQuestion.subParam1 || "No parameter set"}
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                      {mainQuestion.title}
                                    </div>
                                  </td>
                                  {uniqueSubParams.map((subParam) => {
                                    const followUpsForParam =
                                      followUpsBySubParam.get(subParam) || [];
                                    const answersForParam = followUpsForParam
                                      .map((followUp) => {
                                        const followUpFromMain =
                                          mainQuestion.followUpQuestions.find(
                                            (fq: any) => fq.id === followUp.id
                                          );
                                        return followUpFromMain?.answer;
                                      })
                                      .filter(
                                        (answer) =>
                                          answer !== undefined &&
                                          answer !== null &&
                                          answer !== ""
                                      );

                                    return (
                                      <td
                                        key={subParam}
                                        className="px-4 py-4 border border-emerald-200 dark:border-emerald-800 text-sm text-gray-700 dark:text-gray-300 bg-emerald-50/40 dark:bg-emerald-900/20"
                                      >
                                        {answersForParam.length > 0 ? (
                                          <div className="space-y-1">
                                            {answersForParam.map((answer, idx) => (
                                              <p key={idx} className="font-medium">
                                                {answer}
                                              </p>
                                            ))}
                                          </div>
                                        ) : (
                                          <span className="text-gray-400 italic">
                                            N/A
                                          </span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                  </div>
                );
              })}

              {/* Charts Section */}
              <div className={`grid gap-8 ${showWeightageColumns ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                <div className={`bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/30 dark:from-gray-800 dark:via-blue-900/10 dark:to-indigo-900/10 p-8 rounded-3xl shadow-2xl border border-blue-200/50 dark:border-blue-700/50 transform hover:scale-[1.02] transition-all duration-500 hover:shadow-3xl backdrop-blur-sm ${!showWeightageColumns ? 'lg:max-w-3xl mx-auto w-full' : ''}`}>
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                      <div className="p-2 bg-blue-500/20 rounded-lg mr-4">
                        <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      Section Performance
                    </h3>
                    <div className="flex items-center space-x-3 bg-white/50 dark:bg-gray-700/50 rounded-full px-4 py-2">
                      <div className="flex items-center space-x-1">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Yes</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">No</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-3 h-3 bg-blue-300 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">N/A</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-full flex items-center justify-center" style={{ height: sectionChartHeight, minHeight: "400px" }}>
                    <Radar data={sectionChartData} options={sectionChartOptions} />
                  </div>
                </div>

                {showWeightageColumns && (
                  <div className="bg-gradient-to-br from-white via-green-50/30 to-emerald-50/30 dark:from-gray-800 dark:via-green-900/10 dark:to-emerald-900/10 p-8 rounded-3xl shadow-2xl border border-green-200/50 dark:border-green-700/50 transform hover:scale-[1.02] transition-all duration-500 hover:shadow-3xl backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                        <div className="p-2 bg-green-500/20 rounded-lg mr-4">
                          <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        Weighted Trends
                      </h3>
                      <div className="flex items-center space-x-3 bg-white/50 dark:bg-gray-700/50 rounded-full px-4 py-2">
                        <div className="flex items-center space-x-1">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Yes × Weight</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">No × Weight</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">N/A × Weight</span>
                        </div>
                      </div>
                    </div>
                    <div className="w-full" style={{ height: weightedChartHeight }}>
                      <Line data={weightedPercentageChartData} options={weightedPercentageChartOptions} />
                    </div>
                  </div>
                )}
              </div>

              {/* Section-wise Breakdown Table */}
              <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden transform hover:scale-[1.01] transition-all duration-500 hover:shadow-3xl">
                <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-white flex items-center">
                        <BarChart3 className="w-7 h-7 mr-3" />
                        Section-wise Breakdown
                      </h3>
                      <p className="text-blue-100 mt-1">
                        Detailed performance analysis by section with {showWeightageColumns ? "weightage calculations" : "out weightage"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {showWeightageCheckbox && (
                        <div className="flex items-center gap-3 bg-white/20 backdrop-blur-sm rounded-lg p-3 border border-white/30">
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
                                    setEditingAllWeightages(true);
                                    const initialValues: Record<string, string> = {};
                                    sectionSummaryRows.forEach(row => {
                                      initialValues[row.id] = row.weightage.toString();
                                    });
                                    setWeightageValues(initialValues);
                                  } else {
                                    setEditingAllWeightages(false);
                                    setWeightageValues({});
                                  }
                                }}
                              />
                              <div className={`block w-12 h-6 rounded-full transition-colors duration-200 ${addWeightMode ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'}`}></div>
                              <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ${addWeightMode ? 'transform translate-x-6' : ''}`}></div>
                            </div>
                            <span className="ml-3 font-semibold text-white flex items-center gap-2">
                              <Target className="w-5 h-5" />
                              Add Weight
                            </span>
                          </label>
                          {addWeightMode && (
                            <div className="ml-3 text-xs text-white/80 bg-black/20 px-2 py-1 rounded">
                              Total must be 100%
                            </div>
                          )}
                        </div>
                      )}
                      
                      {calculateTotalWeightage > 0 && (
                        <button
                          onClick={() => setShowWeightageColumns(!showWeightageColumns)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                            showWeightageColumns
                              ? 'bg-indigo-400 hover:bg-indigo-500 text-white'
                              : 'bg-gray-400 hover:bg-gray-500 text-white'
                          }`}
                          title={showWeightageColumns ? 'Hide weightage columns' : 'Show weightage columns'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-4.803m5.596-3.856a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0M15 12a3 3 0 11-6 0 3 3 0 016 0zm6 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm font-medium">
                            {showWeightageColumns ? 'Hide' : 'Show'} Weightage
                          </span>
                        </button>
                      )}

                      {showWeightageColumns && !redistributionMode && !editingAllWeightages && (
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
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 sticky top-0">
                      <tr>
                        <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-48">
                          Section
                        </th>
                        <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-20">
                          Yes %
                        </th>
                        <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-20">
                          No %
                        </th>
                        <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-20">
                          N/A %
                        </th>
                        {showWeightageColumns && (
                          <>
                            <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-20">
                              Weightage
                            </th>
                            <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-24">
                              Yes % × Weightage
                            </th>
                            <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-24">
                              No % × Weightage
                            </th>
                            <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-24">
                              N/A % × Weightage
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                      {sectionSummaryRows.map((row) => (
                        <tr key={row.id} className="group hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-600 transition-all duration-300 bg-white dark:bg-gray-900">
                          <td className="px-6 py-5 font-bold text-gray-900 dark:text-gray-100 flex items-center">
                            <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                            {row.title}
                          </td>
                          <td className="px-6 py-5 text-gray-700 dark:text-gray-300 font-medium">
                            {row.yesPercent.toFixed(1)}%
                          </td>
                          <td className="px-6 py-5 text-gray-700 dark:text-gray-300 font-medium">
                            {row.noPercent.toFixed(1)}%
                          </td>
                          <td className="px-6 py-5 text-gray-700 dark:text-gray-300 font-medium">
                            {row.naPercent.toFixed(1)}%
                          </td>
                          {showWeightageColumns && (
                            <>
                              <td className="px-6 py-5 text-gray-700 dark:text-gray-300 font-medium">
                                {redistributionMode ? (
                                  <div className="flex flex-col items-center">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.1"
                                      value={tempWeightageValues[row.id] !== undefined ? tempWeightageValues[row.id] : row.weightage.toString()}
                                      onChange={(e) => {
                                        const newValue = e.target.value;
                                        const updatedValues = {
                                          ...tempWeightageValues,
                                          [row.id]: newValue
                                        };
                                        setTempWeightageValues(updatedValues);
                                        
                                        const total = Object.values(updatedValues).reduce((sum, val) => {
                                          return sum + (parseFloat(val) || 0);
                                        }, 0);
                                        
                                        setWeightageBalance(100 - total);
                                      }}
                                      className="w-20 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 text-center"
                                    />
                                    <div className="text-xs mt-1">
                                      {(() => {
                                        const currentVal = parseFloat(tempWeightageValues[row.id] !== undefined ? tempWeightageValues[row.id] : row.weightage.toString()) || 0;
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
                                ) : editingAllWeightages ? (
                                  <div className="flex flex-col items-center">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.1"
                                      value={weightageValues[row.id] !== undefined ? weightageValues[row.id] : row.weightage.toString()}
                                      onChange={(e) => {
                                        const newValue = e.target.value;
                                        const updatedValues = {
                                          ...weightageValues,
                                          [row.id]: newValue
                                        };
                                        setWeightageValues(updatedValues);
                                      }}
                                      className="w-20 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 text-center"
                                    />
                                    <div className="text-xs mt-1">
                                      {(() => {
                                        const currentVal = parseFloat(weightageValues[row.id] !== undefined ? weightageValues[row.id] : row.weightage.toString()) || 0;
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
                                  <div className="flex items-center justify-center">
                                    <span className="font-bold text-indigo-600 dark:text-indigo-400 text-lg">
                                      {Number.isFinite(row.weightage) ? row.weightage.toFixed(1) : "0.0"}%
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-5 text-gray-700 dark:text-gray-300 font-medium">
                                {row.yesWeighted.toFixed(1)}
                              </td>
                              <td className="px-6 py-5 text-gray-700 dark:text-gray-300 font-medium">
                                {row.noWeighted.toFixed(1)}
                              </td>
                              <td className="px-6 py-5 text-gray-700 dark:text-gray-300 font-medium">
                                {row.naWeighted.toFixed(1)}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                      {editingAllWeightages && (
                        <tr>
                          <td colSpan={8} className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={async () => {
                                  setSavingWeightage(true);
                                  try {
                                    const formId = form._id || form.id;
                                    if (!formId) throw new Error("Form ID not found");
                                    
                                    const batchTotal = sectionSummaryRows.reduce((sum, row) => {
                                      const val = parseFloat(weightageValues[row.id] || row.weightage.toString()) || 0;
                                      return sum + val;
                                    }, 0);
                                    
                                    if (Math.abs(batchTotal - 100) > 0.1) {
                                      throw new Error(`Total weightage must be exactly 100%. Current: ${batchTotal.toFixed(1)}%`);
                                    }
                                    
                                    const updatedSections = form.sections?.map((section: any) => {
                                      const row = sectionSummaryRows.find(r => r.id === section.id);
                                      if (row && weightageValues[row.id] !== undefined) {
                                        return { 
                                          ...section, 
                                          weightage: parseFloat(weightageValues[row.id]) || 0 
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
                                    setEditingAllWeightages(false);
                                    setAddWeightMode(false);
                                    setWeightageValues({});
                                    
                                    showSuccess("All weightages saved successfully!");
                                  } catch (error) {
                                    console.error("Failed to save weightages:", error);
                                    showError(error instanceof Error ? error.message : "Failed to save weightages");
                                  } finally {
                                    setSavingWeightage(false);
                                  }
                                }}
                                disabled={savingWeightage}
                                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-1"
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
                                    Save All
                                  </>
                                )}
                              </button>
                              
                              <button
                                onClick={() => {
                                  setEditingAllWeightages(false);
                                  setWeightageValues({});
                                  if (calculateTotalWeightage === 0) {
                                    setAddWeightMode(false);
                                  }
                                }}
                                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                      {showWeightageColumns && (
                        <tr className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-t-2 border-blue-200 dark:border-blue-700">
                          <td colSpan={4} className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100 text-right">
                            {redistributionMode ? "Current Balance:" : "Total Weightage:"}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full font-bold ${redistributionMode ? (Math.abs(weightageBalance) < 0.1 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400') : (Math.abs(calculateTotalWeightage - 100) < 0.1 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400')}`}>
                              {redistributionMode ? `${weightageBalance.toFixed(1)}%` : `${calculateTotalWeightage.toFixed(1)}%`}
                              {redistributionMode && Math.abs(weightageBalance) >= 0.1 && (
                                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                              )}
                            </span>
                          </td>
                          <td colSpan={3} className="px-6 py-4">
                            <div className="flex items-center justify-between">
                              <span className={redistributionMode ? (Math.abs(weightageBalance) < 0.1 ? "text-green-600 dark:text-green-400 font-medium" : "text-yellow-600 dark:text-yellow-400 font-medium") : (Math.abs(calculateTotalWeightage - 100) < 0.1 ? "text-green-600 dark:text-green-400 font-medium" : "text-yellow-600 dark:text-yellow-400 font-medium")}>
                                {redistributionMode ? (
                                  Math.abs(weightageBalance) < 0.1 ?
                                    '✓ Ready to save' :
                                    `Adjust by ${Math.abs(weightageBalance).toFixed(1)}% to reach 100%`
                                ) : (
                                  Math.abs(calculateTotalWeightage - 100) < 0.1 ?
                                    '✓ Weightage distribution complete' :
                                    (addWeightMode ?
                                      `⚠️ Need ${(100 - calculateTotalWeightage).toFixed(1)}% more to reach 100%` :
                                      'Weightage not fully distributed')
                                )}
                              </span>

                              {redistributionMode && (
                                <div className="flex items-center gap-2 ml-4">
                                  <button
                                    onClick={() => {
                                      const resetValues: Record<string, string> = {};
                                      sectionSummaryRows.forEach(row => {
                                        resetValues[row.id] = row.weightage.toString();
                                      });
                                      setTempWeightageValues(resetValues);
                                      const total = sectionSummaryRows.reduce((sum, row) => sum + row.weightage, 0);
                                      setWeightageBalance(100 - total);
                                    }}
                                    className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-1"
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
                                      const originalValues: Record<string, string> = {};
                                      sectionSummaryRows.forEach(row => {
                                        originalValues[row.id] = row.weightage.toString();
                                      });
                                      setTempWeightageValues(originalValues);
                                      setWeightageBalance(0);
                                    }}
                                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                    title="Cancel redistribution"
                                  >
                                    Cancel
                                  </button>

                                  <button
                                    onClick={async () => {
                                      setSavingWeightage(true);
                                      try {
                                        const formId = form._id || form.id;
                                        if (!formId) throw new Error("Form ID not found");
                                        
                                        const total = Object.values(tempWeightageValues).reduce((sum, val) => {
                                          return sum + (parseFloat(val) || 0);
                                        }, 0);
                                        
                                        if (Math.abs(total - 100) > 0.1) {
                                          throw new Error(`Total weightage must be exactly 100%. Current: ${total.toFixed(1)}%`);
                                        }
                                        
                                        const updatedSections = form.sections?.map((section: any) => {
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
                                        
                                        showSuccess("Weightages updated successfully!");
                                      } catch (error) {
                                        console.error("Failed to save weightages:", error);
                                        showError(error instanceof Error ? error.message : "Failed to save weightages");
                                      } finally {
                                        setSavingWeightage(false);
                                      }
                                    }}
                                    disabled={savingWeightage || Math.abs(weightageBalance) >= 0.1}
                                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                                    title={Math.abs(weightageBalance) >= 0.1 ? "Balance weightage to 100% first" : "Save changes"}
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

              {/* Response Summary Card */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Response Summary
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg mt-1">
                      <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                        Form Name
                      </p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                        {form.title}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg mt-1">
                      <Calendar className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                        Submission Date
                      </p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                        {formatTimestamp(response.createdAt)}
                      </p>
                    </div>
                  </div>
                  {response.submissionMetadata?.location && (
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg mt-1">
                        <MapPin className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                          Location
                        </p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                          {response.submissionMetadata.location.city},{" "}
                          {response.submissionMetadata.location.country}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                No section data available for analysis
              </p>
            </div>
          )
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
              Form Responses
            </h3>
            <div className="space-y-6">
              {Object.entries(response.answers).map(([key, value]) => {
                const question = questions[key];
                return (
                  <div
                    key={key}
                    className="border-b border-gray-200 dark:border-gray-700 pb-6 last:border-b-0"
                  >
                    <div className="mb-3">
                      <h4 className="font-semibold text-gray-900 dark:text-white text-lg">
                        {question?.text || key}
                      </h4>
                      {question?.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {question.description}
                        </p>
                      )}
                    </div>
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      {Array.isArray(value) ? (
                        <div className="space-y-2">
                          {value.map((v, idx) => (
                            <div
                              key={idx}
                              className="text-gray-900 dark:text-gray-100 flex items-center gap-2"
                            >
                              <div className="w-1.5 h-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                              {isImageUrl(String(v)) ? (
                                <ImageLink url={String(v)} />
                              ) : (
                                String(v)
                              )}
                            </div>
                          ))}
                        </div>
                      ) : typeof value === "object" ? (
                        <pre className="text-gray-900 dark:text-gray-100 overflow-auto text-sm bg-gray-200 dark:bg-gray-950 p-3 rounded">
                          {JSON.stringify(value, null, 2)}
                        </pre>
                      ) : (
                        <div className="text-gray-900 dark:text-gray-100">
                          {isImageUrl(String(value)) ? (
                            <ImageLink url={String(value)} />
                          ) : (
                            String(value)
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {editingResponse && editingFormLoading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl px-6 py-4 flex items-center gap-3 border border-gray-200 dark:border-gray-700">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
            <div className="text-primary-600 dark:text-primary-400 font-semibold">
              Loading form details...
            </div>
          </div>
        </div>
      )}

      {editingResponse && editingForm && !editingFormLoading && (
        <ResponseEdit
          response={editingResponse as any}
          question={editingForm as any}
          onSave={handleSaveEditedResponse}
          onCancel={handleCloseEdit}
        />
      )}
    </div>
  );
}
