import React, { useState, useEffect, useMemo, useRef } from "react";
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
  TrendingUp,
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
} from "lucide-react";
import { Bar, Line, Pie } from "react-chartjs-2";
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
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
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
import LocationHeatmap from "./analytics/LocationHeatmap";

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
  ChartDataLabels
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
}

interface GroupedResponses {
  [date: string]: (Response & { formTitle: string })[];
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

export default function AllResponses() {
  const { showSuccess, showError, showConfirm } = useNotification();
  const { logo } = useLogo();
  const [responses, setResponses] = useState<
    (Response & { formTitle: string })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<
    (Response & { formTitle: string }) | null
  >(null);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);
  const [viewMode, setViewMode] = useState<"dashboard" | "responses">(
    "dashboard"
  );
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(null);

  const [exportingExcel, setExportingExcel] = useState(false);
  const [deletingResponseId, setDeletingResponseId] = useState<string | null>(
    null
  );
  const [editingResponse, setEditingResponse] = useState<
    (Response & { formTitle: string }) | null
  >(null);
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editingFormLoading, setEditingFormLoading] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [editingWeightage, setEditingWeightage] = useState<string | null>(null);
  const [weightageValue, setWeightageValue] = useState<string>("");
  const [savingWeightage, setSavingWeightage] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null
  );
  const [sectionResponsesMap, setSectionResponsesMap] = useState<
    Record<string, (Response & { formTitle: string })[]>
  >({});
  const [sectionChartTypes, setSectionChartTypes] = useState<
    Record<string, "pie" | "bar">
  >({});
  const [expandResponseRateBreakdown, setExpandResponseRateBreakdown] =
    useState(false);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (viewMode !== "responses" || !pendingSectionId) {
      return;
    }
    const target = sectionRefs.current[pendingSectionId];
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setPendingSectionId(null);
    }
  }, [viewMode, pendingSectionId]);

  const handleViewDetails = async (
    response: Response & { formTitle: string }
  ) => {
    setSelectedResponse(response);
    setViewMode("dashboard");
    setPendingSectionId(null);
    sectionRefs.current = {};
    setFormLoading(true);
    try {
      const formIdentifier = response.questionId || response.formId;
      if (!formIdentifier) {
        throw new Error("Missing form identifier for response");
      }
      const formData = await apiClient.getForm(formIdentifier);
      const form = formData.form;

      // Ensure nested followUpQuestions are properly populated
      if (form?.sections) {
        form.sections.forEach((section: any) => {
          if (section.questions) {
            section.questions.forEach((question: any) => {
              // Ensure followUpQuestions is an array
              if (!Array.isArray(question.followUpQuestions)) {
                question.followUpQuestions = [];
              }
            });
          }
        });
      }

      // Ensure followUpQuestions array exists at form level
      if (!Array.isArray(form.followUpQuestions)) {
        form.followUpQuestions = [];
      }

      setSelectedForm(form);
    } catch (err) {
      console.error("Failed to load form details:", err);
      setSelectedForm(null);
    } finally {
      setFormLoading(false);
    }
  };

  const handleStatusUpdate = async (responseId: string, newStatus: string) => {
    setUpdatingStatus(true);
    try {
      await apiClient.updateResponse(responseId, { status: newStatus });
      setResponses((prev) =>
        prev.map((r) =>
          r._id === responseId ? { ...r, status: newStatus } : r
        )
      );
      if (selectedResponse && selectedResponse._id === responseId) {
        setSelectedResponse({ ...selectedResponse, status: newStatus });
        setShowStatusUpdate(false);
      }
      showSuccess(`Status updated to ${getStatusInfo(newStatus).label}`);
    } catch (err) {
      console.error("Failed to update status:", err);
      showError("Failed to update status. Please try again.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeleteResponse = (response: Response & { formTitle: string }) => {
    showConfirm(
      "Are you sure you want to delete this request? This action cannot be undone.",
      async () => {
        setDeletingResponseId(response.id);
        try {
          await apiClient.deleteResponse(response.id);
          setResponses((prev) => prev.filter((r) => r.id !== response.id));
          if (selectedResponse && selectedResponse.id === response.id) {
            setSelectedResponse(null);
            setSelectedForm(null);
          }
          showSuccess("Request deleted successfully.");
        } catch (err) {
          console.error("Failed to delete response:", err);
          showError("Failed to delete request. Please try again.");
        } finally {
          setDeletingResponseId(null);
        }
      },
      "Delete Request",
      "Delete",
      "Cancel"
    );
  };

  const handleEditResponse = async (
    response: Response & { formTitle: string }
  ) => {
    setEditingResponse(response);
    setEditingForm(null);
    setEditingFormLoading(true);
    try {
      const formIdentifier = response.questionId || response.formId;
      if (!formIdentifier) {
        throw new Error("Missing form identifier for response");
      }
      const formData = await apiClient.getForm(formIdentifier);
      const form = formData.form;

      // Ensure nested followUpQuestions are properly populated
      if (form?.sections) {
        form.sections.forEach((section: any) => {
          if (section.questions) {
            section.questions.forEach((question: any) => {
              // Ensure followUpQuestions is an array
              if (!Array.isArray(question.followUpQuestions)) {
                question.followUpQuestions = [];
              }
            });
          }
        });
      }

      // Ensure followUpQuestions array exists at form level
      if (!Array.isArray(form.followUpQuestions)) {
        form.followUpQuestions = [];
      }

      setEditingForm(form);
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
    if (savingEdit) {
      return;
    }
    const responseId = updated?.id;
    if (!responseId) {
      showError("Missing response identifier. Please try again.");
      return;
    }
    setSavingEdit(true);
    const updatedTimestamp = updated.timestamp || new Date().toISOString();
    const updatedScore = editingForm
      ? computeYesNoScore(updated.answers, editingForm)
      : undefined;
    try {
      await apiClient.updateResponse(responseId, {
        answers: updated.answers,
        status: updated.status,
        notes: updated.notes,
      });
      setResponses((prev) =>
        prev.map((r) =>
          r.id === responseId
            ? {
                ...r,
                answers: updated.answers,
                updatedAt: updatedTimestamp,
                yesNoScore:
                  updatedScore !== undefined ? updatedScore : r.yesNoScore,
              }
            : r
        )
      );
      if (selectedResponse && selectedResponse.id === responseId) {
        const nextSelected = {
          ...selectedResponse,
          answers: updated.answers,
          updatedAt: updatedTimestamp,
        };
        if (updatedScore !== undefined) {
          nextSelected.yesNoScore = updatedScore;
        }
        setSelectedResponse(nextSelected);
      }
      setEditingResponse(null);
      setEditingForm(null);
      showSuccess("Request updated successfully.");
    } catch (err) {
      console.error("Failed to update response:", err);
      showError("Failed to update request. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleExportExcel = () => {
    if (exportingExcel) {
      return;
    }

    if (!selectedResponse || !selectedForm) {
      showError("Missing required data for export.");
      return;
    }

    setExportingExcel(true);
    try {
      generateResponseExcelReport(
        selectedResponse,
        selectedForm,
        sectionSummaryRows
      );
      showSuccess("Excel exported successfully.");
    } catch (error) {
      console.error("Failed to export Excel:", error);
      showError("Failed to export Excel. Please try again.");
    } finally {
      setExportingExcel(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (generatingPDF || !selectedResponse || !selectedForm) {
      return;
    }

    setGeneratingPDF(true);
    try {
      const sectionQuestionStats: Record<string, any[]> = {};
      const sectionMainParameters: Record<string, any[]> = {};

      if (selectedForm.sections) {
        selectedForm.sections.forEach((section: any) => {
          sectionQuestionStats[section.id] = getSectionYesNoQuestionStats(
            section.id
          );

          const sectionQuestions = getSectionQuestionsWithFollowUps(section.id);
          const mainParamsData: any[] = [];

          sectionQuestions.forEach((q: any) => {
            q.followUpQuestions?.forEach((fq: any) => {
              const answer = fq.answer;
              if (
                answer &&
                (typeof answer === "object" || typeof answer === "string")
              ) {
                const answerObj =
                  typeof answer === "string" ? { text: answer } : answer;
                mainParamsData.push({
                  subParam1: q.subParam1 || fq.subParam1 || "N/A",
                  remarks: answerObj.remarks || "Sample Remarks",
                  actionInitiated:
                    answerObj.actionInitiated || "Sample Action Initiated",
                  reasonForNotOK:
                    answerObj.reasonForNotOK || "Sample Reason fo Not OK",
                  responsiblePerson:
                    answerObj.responsiblePerson || "Sample Responsible person",
                  review: answerObj.review || "Sample Review",
                  files: answerObj.files || [],
                });
              }
            });
          });

          sectionMainParameters[section.id] = mainParamsData;
        });
      }

      // Add chart element IDs for capturing
      const chartElementIds = [
        "section-performance-chart",
        ...availableSections.map((section) => `section-chart-${section.id}`),
      ];

      await generateAndDownloadPDF({
        filename: `${selectedForm.title}_Report.pdf`,
        formTitle: selectedForm.title,
        submittedDate: formatTimestamp(selectedResponse.createdAt),
        sectionStats: filteredSectionStats,
        sectionSummaryRows: sectionSummaryRows,
        form: selectedForm,
        response: selectedResponse,
        sectionQuestionStats: sectionQuestionStats,
        sectionMainParameters: sectionMainParameters,
        availableSections: availableSections,
        chartElementIds: chartElementIds,
      } as any);
      showSuccess("PDF downloaded successfully.");
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      showError("Failed to generate PDF. Please try again.");
    } finally {
      setGeneratingPDF(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [responsesData, formsData] = await Promise.all([
        apiClient.getResponses(),
        apiClient.getForms(),
      ]);

      const formsMap = formsData.forms.reduce(
        (map: Record<string, Form>, form: any) => {
          if (form?._id) map[form._id] = form as Form;
          if (form?.id) map[form.id] = form as Form;
          return map;
        },
        {}
      );

      const responsesWithTitles = responsesData.responses.map(
        (response: Response) => {
          const form = formsMap[response.questionId];
          return {
            ...response,
            formTitle: form?.title || "Unknown Form",
            yesNoScore: form
              ? computeYesNoScore(response.answers, form)
              : undefined,
          };
        }
      );

      setResponses(responsesWithTitles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load responses");
    } finally {
      setLoading(false);
    }
  };

  const groupResponsesByDate = (
    responses: (Response & { formTitle: string })[]
  ): GroupedResponses => {
    return responses.reduce((groups, response) => {
      const date = new Date(response.createdAt).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(response);
      return groups;
    }, {} as GroupedResponses);
  };

  const groupedResponses = groupResponsesByDate(responses);

  const groupResponsesBySection = useMemo(() => {
    if (!selectedForm?.sections) return {};

    const map: Record<string, (Response & { formTitle: string })[]> = {};
    selectedForm.sections.forEach((section: any) => {
      map[section.id] = [];
    });

    responses.forEach((response) => {
      const answerKeys = Object.keys(response.answers || {});
      answerKeys.forEach((key) => {
        const question = selectedForm?.sections
          ?.flatMap((s: any) => s.questions || [])
          .find((q: any) => q.id === key);
        if (question) {
          const sectionId = selectedForm.sections?.find((s: any) =>
            s.questions?.some((q: any) => q.id === key)
          )?.id;
          if (sectionId && !map[sectionId].find((r) => r.id === response.id)) {
            map[sectionId].push(response);
          }
        }
      });
    });

    return map;
  }, [responses, selectedForm]);

  const availableSections = selectedForm?.sections || [];

  useEffect(() => {
    if (availableSections.length > 0 && !selectedSectionId) {
      setSelectedSectionId(availableSections[0].id);
    }
  }, [availableSections, selectedSectionId]);

  const sectionStats = useMemo(() => {
    if (!selectedForm || !selectedResponse) {
      return [] as SectionStat[];
    }
    return getSectionYesNoStats(selectedForm, selectedResponse.answers);
  }, [selectedForm, selectedResponse]);

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
          backgroundColor: "#1d4ed8",
          borderRadius: 4,
        },
        {
          label: "No",
          data: filteredSectionStats.map((stat) =>
            calculatePercentage(stat.no, stat.total)
          ),
          backgroundColor: "#3b82f6",
          borderRadius: 4,
        },
        {
          label: "N/A",
          data: filteredSectionStats.map((stat) =>
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
              return filteredSectionStats[index]?.title || "";
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
    [filteredSectionStats]
  );

  const sectionChartHeight = Math.max(320, filteredSectionStats.length * 56);

  const formatPercentageValue = (value: number) =>
    `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;

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

  const weightedChartHeight = Math.max(320, sectionSummaryRows.length * 32);

  const getSectionQuestionsWithFollowUps = (sectionId: string) => {
    if (!selectedForm || !selectedResponse) return [];

    const section = selectedForm.sections?.find((s: any) => s.id === sectionId);
    if (!section) return [];

    const mainQuestionsWithFollowUps: any[] = [];
    const questionIds = collectYesNoQuestionIds({
      ...selectedForm,
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
        const answers = selectedResponse.answers?.[question.id];
        const yesNoValues = extractYesNoValues(answers);

        const followUpQuestionsForThis = [
          ...(selectedForm.followUpQuestions?.filter(
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
              answer: selectedResponse.answers?.[fq.id || fq._id],
            })),
          };

          mainQuestionsWithFollowUps.push(mainQuestion);
        }
      }
    });

    return mainQuestionsWithFollowUps;
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

  function computeYesNoScore(
    answers: Record<string, any>,
    form: Form
  ): { yes: number; total: number } | undefined {
    const questionIds = collectYesNoQuestionIds(form);
    if (!questionIds.length) {
      return undefined;
    }

    let yesCount = 0;

    questionIds.forEach((questionId) => {
      const normalizedValues = extractYesNoValues(answers?.[questionId]);
      if (normalizedValues.includes("yes")) {
        yesCount += 1;
      }
    });

    return {
      yes: yesCount,
      total: questionIds.length,
    };
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
      return <span className="text-primary-400">No response</span>;
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
        <span className="text-primary-400">No response</span>
      );
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-primary-400">No response</span>;
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
      return value.join(", ");
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
        return <span className="text-primary-400">No response</span>;
      }
      return (
        <pre className="whitespace-pre-wrap text-primary-600 text-sm">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }

    return String(value);
  };

  const renderSectionTabs = (): React.ReactNode => {
    if (!availableSections.length || !selectedForm) return null;

    return (
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-primary-200 shadow-sm mb-6">
        <div className="flex items-center gap-2 overflow-x-auto p-4">
          {availableSections.map((section: any) => {
            const sectionResponseCount =
              groupResponsesBySection[section.id]?.length || 0;
            const isSelected = selectedSectionId === section.id;

            return (
              <button
                key={section.id}
                onClick={() => setSelectedSectionId(section.id)}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-2 ${
                  isSelected
                    ? "bg-blue-500 text-white shadow-lg"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                <span className="truncate">
                  {formatSectionLabel(
                    section.name || section.label || `Section ${section.id}`
                  )}
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    isSelected
                      ? "bg-blue-600 text-white"
                      : "bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200"
                  }`}
                >
                  {sectionResponseCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const getSectionYesNoQuestionStats = (sectionId: string) => {
    if (!selectedForm || !selectedResponse) return [];

    const section = selectedForm.sections?.find((s: any) => s.id === sectionId);
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
          selectedResponse.answers?.[question.id]
        );
        const counts = { yes: 0, no: 0, na: 0, total: 0 };

        if (normalizedValues.length > 0) {
          counts.total = 1; // Each question counts as 1 response
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

      // Process follow-up questions if they are yesNoNA type
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
  };

  const renderSectionYesNoTable = (sectionId: string): React.ReactNode => {
    const questionStats = getSectionYesNoQuestionStats(sectionId);
    const section = selectedForm?.sections?.find(
      (s: any) => s.id === sectionId
    );

    if (questionStats.length === 0) {
      return null;
    }

    // Calculate totals for the section
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

    // Chart data for the section
    const chartData = {
      labels: ["Yes", "No", "N/A"],
      datasets: [
        {
          data: [sectionTotals.yes, sectionTotals.no, sectionTotals.na],
          backgroundColor: ["#1d4ed8", "#3b82f6", "#93c5fd"],
          borderColor: ["#1e40af", "#2563eb", "#60a5fa"],
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
              const total =
                sectionTotals.yes + sectionTotals.no + sectionTotals.na;
              const value =
                typeof context.parsed === "number"
                  ? context.parsed
                  : context.parsed?.r || 0;
              const percentage =
                total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${context.label}: ${value} (${percentage}%)`;
            },
          },
        },
        datalabels: {
          color: document.documentElement.classList.contains("dark")
            ? "#f3f4f6"
            : "#0f172a",
          font: {
            weight: "600",
          },
          formatter: (value: number, context: any) => {
            const dataset = context.chart?.data?.datasets?.[0];
            const data = Array.isArray(dataset?.data) ? dataset.data : [];
            const total = data.reduce(
              (sum: number, current: any) =>
                typeof current === "number" ? sum + current : sum,
              0
            );
            const numericValue =
              typeof value === "number" ? value : Number(value) || 0;
            const percentage =
              total > 0 ? ((numericValue / total) * 100).toFixed(1) : 0;
            return `${percentage}% (${numericValue})`;
          },
        },
      },
    };

    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-8 rounded-3xl shadow-xl border border-blue-200 dark:border-blue-800 mt-8">
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-blue-900 dark:text-blue-100 flex items-center gap-3">
            <div className="w-1 h-8 bg-blue-600 rounded-full"></div>
            {section?.name || section?.label || `Section`} - Yes/No/N/A Analysis
          </h3>
          <p className="text-blue-700 dark:text-blue-300 mt-2">
            Question-wise breakdown of yes/no/n/a responses with overall section
            summary
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
            <div className="w-full h-64" id={`section-chart-${section.id}`}>
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
                      tooltip: {
                        callbacks: {
                          label: (context: any) => {
                            const dataIndex = context.dataIndex;
                            const datasets = context.chart?.data?.datasets || [];
                            const total = datasets.reduce(
                              (sum: number, dataset: any) => {
                                const value = Array.isArray(dataset.data)
                                  ? dataset.data[dataIndex]
                                  : 0;
                                const numericValue =
                                  typeof value === "number"
                                    ? value
                                    : Number(value) || 0;
                                return sum + numericValue;
                              },
                              0
                            );
                            const barValue =
                              typeof context.raw === "number"
                                ? context.raw
                                : typeof context.parsed?.y === "number"
                                ? context.parsed.y
                                : 0;
                            const percentage =
                              total > 0 ? ((barValue / total) * 100).toFixed(1) : 0;
                            return `${context.dataset.label}: ${barValue} (${percentage}%)`;
                          },
                        },
                      },
                      datalabels: {
                        anchor: "end",
                        align: "start",
                        offset: -6,
                        color: document.documentElement.classList.contains(
                          "dark"
                        )
                          ? "#f3f4f6"
                          : "#0f172a",
                        font: {
                          size: 10,
                          weight: "600",
                        },
                        formatter: (value: number, context: any) => {
                          const dataIndex = context.dataIndex;
                          const datasets = context.chart?.data?.datasets || [];
                          const total = datasets.reduce(
                            (sum: number, dataset: any) => {
                              const datasetValue = Array.isArray(dataset.data)
                                ? dataset.data[dataIndex]
                                : 0;
                              const numericValue =
                                typeof datasetValue === "number"
                                  ? datasetValue
                                  : Number(datasetValue) || 0;
                              return sum + numericValue;
                            },
                            0
                          );
                          const numericValue =
                            typeof value === "number" ? value : Number(value) || 0;
                          if (total === 0) {
                            return "0";
                          }
                          const percentage = ((numericValue / total) * 100).toFixed(1);
                          return `${numericValue} (${percentage}%)`;
                        },
                      },
                    },
                    scales: {
                      x: {
                        stacked: false,
                        ticks: {
                          color: document.documentElement.classList.contains(
                            "dark"
                          )
                            ? "#d1d5db"
                            : "#374151",
                          font: { size: 12 },
                        },
                        grid: {
                          color: document.documentElement.classList.contains(
                            "dark"
                          )
                            ? "#374151"
                            : "#e5e7eb",
                        },
                      },
                      y: {
                        stacked: false,
                        ticks: {
                          color: document.documentElement.classList.contains(
                            "dark"
                          )
                            ? "#d1d5db"
                            : "#374151",
                          beginAtZero: true,
                        },
                        grid: {
                          color: document.documentElement.classList.contains(
                            "dark"
                          )
                            ? "#374151"
                            : "#e5e7eb",
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

          {/* Table */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-blue-200 dark:border-blue-700 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4">
              <h4 className="text-lg font-bold text-white flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Question Breakdown
              </h4>
            </div>
            <div className="overflow-x-auto max-h-64">
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
                    <th className="px-4 py-3 text-center font-bold text-blue-900 dark:text-blue-100 uppercase tracking-wider min-w-16">
                      Total
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
                        <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300 font-bold">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            {total}
                          </span>
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
                    <td className="px-4 py-3 text-center font-bold text-blue-900 dark:text-blue-100">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-100">
                        {sectionTotals.total}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSectionWiseMainParameters = (): React.ReactNode => {
    if (!selectedForm || !selectedResponse || !availableSections.length) {
      return (
        <div className="text-center py-8 text-gray-500">
          No sections available
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {availableSections.map((section: any) => {
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

          // Group follow-ups by their subParam1 values to avoid duplicate headers
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
            <div key={section.id}>
              {/* Yes/No/N/A Table and Chart */}
              {renderSectionYesNoTable(section.id)}

              {/* Main Parameters Table */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-8 rounded-3xl shadow-xl border border-emerald-200 dark:border-emerald-800">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 flex items-center gap-3">
                    <div className="w-1 h-8 bg-emerald-600 rounded-full"></div>
                    {section.name || section.label || `Section`} - Main
                    Parameters
                  </h3>
                  {/* <p className="text-emerald-700 dark:text-emerald-300 mt-2">
                    Main questions with their follow-up answers organized by subparameters
                  </p> */}
                  {/* {allFollowUpIds.size > 0 && (
                    <div className="mt-3 p-3 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 rounded text-sm text-blue-800 dark:text-blue-200">
                      <strong>Found {allFollowUpIds.size} follow-up question(s)</strong> • {Array.from(allFollowUpIds).join(', ')}
                    </div>
                  )} */}
                  {allFollowUpIds.size === 0 && sectionQuestions.length > 0 && (
                    <div className="mt-3 p-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 rounded text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>⚠️ No follow-up questions found</strong> for{" "}
                      {sectionQuestions.length} main question(s)
                    </div>
                  )}
                </div>

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
            </div>
          );
        })}
      </div>
    );
  };

  const renderFormContent = (): React.ReactNode => {
    if (!selectedResponse) {
      return null;
    }

    const answeredKeys = new Set<string>();
    const content: React.ReactNode[] = [];

    if (!selectedForm) {
      return (
        <div className="space-y-4">
          {Object.entries(selectedResponse.answers).map(([key, value]) => (
            <div key={key} className="border-b border-primary-100 pb-2">
              <div className="font-medium text-primary-700">{key}</div>
              <div className="text-primary-600 mt-1">
                {renderAnswerDisplay(value)}
              </div>
            </div>
          ))}
        </div>
      );
    }

    selectedForm.sections?.forEach((section) => {
      const sectionQuestions = section.questions || [];
      if (!sectionQuestions.length) {
        return;
      }
      const sectionTitle = section.title || "Untitled Section";
      const formattedSectionTitle =
        formatSectionLabel(sectionTitle) || sectionTitle;

      content.push(
        <div
          key={section.id}
          ref={(element) => {
            sectionRefs.current[section.id] = element;
          }}
          className="border border-primary-100 rounded-lg overflow-hidden"
        >
          <div className="px-4 py-3 bg-primary-50">
            <div
              className="text-base font-semibold text-primary-700"
              title={sectionTitle}
            >
              {formattedSectionTitle}
            </div>
            {section.description ? (
              <div className="text-sm text-primary-500 mt-1">
                {section.description}
              </div>
            ) : null}
          </div>
          <div className="divide-y divide-primary-100">
            {sectionQuestions.map((question: any) => {
              answeredKeys.add(question.id);
              const answer = selectedResponse.answers[question.id];

              return (
                <div
                  key={question.id}
                  className="p-6 bg-white dark:bg-gray-800 rounded-xl border-2 border-slate-200 dark:border-slate-600 shadow-lg"
                >
                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center text-lg">
                    <span className="w-3 h-3 bg-slate-600 rounded-full mr-4 flex-shrink-0"></span>
                    {question.text || question.id}
                  </div>
                  {question.subParam1 && (
                    <div className="mt-2 ml-7 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-700 font-medium">
                      <span className="font-semibold">Main Parameter:</span>{" "}
                      {question.subParam1}
                    </div>
                  )}
                  <div className="mt-3 text-slate-700 dark:text-slate-300 ml-7 text-base">
                    {renderAnswerDisplay(answer, question)}
                  </div>
                  {question.followUpQuestions?.map((followUp: any) => {
                    const followAnswer = selectedResponse.answers[followUp.id];
                    const hasAnswer = hasAnswerValue(followAnswer);
                    if (hasAnswer) {
                      answeredKeys.add(followUp.id);
                    }
                    return (
                      <div
                        key={followUp.id}
                        className={`mt-4 ml-12 p-4 border-l-4 rounded-r-xl shadow-sm ${
                          hasAnswer
                            ? "bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-500"
                            : "bg-gray-50 dark:bg-gray-900/30 border-gray-400 dark:border-gray-500"
                        }`}
                      >
                        <div
                          className={`font-medium ${
                            hasAnswer
                              ? "text-blue-800 dark:text-blue-200"
                              : "text-gray-700 dark:text-gray-300"
                          } flex items-center`}
                        >
                          <span
                            className={`mr-3 text-lg ${
                              hasAnswer ? "text-blue-600" : "text-gray-500"
                            }`}
                          >
                            ↳
                          </span>
                          {followUp.text || followUp.id}
                        </div>
                        {followUp.subParam1 && (
                          <div className="mt-2 ml-6 text-xs bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-700 font-medium w-fit">
                            <span className="font-semibold">
                              Follow-up Parameter:
                            </span>{" "}
                            {followUp.subParam1}
                          </div>
                        )}
                        <div
                          className={`mt-2 ml-6 ${
                            hasAnswer
                              ? "text-blue-700 dark:text-blue-300"
                              : "text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {hasAnswer ? (
                            renderAnswerDisplay(followAnswer, followUp)
                          ) : (
                            <span className="italic font-light">
                              Not answered
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      );
    });

    if (selectedForm.followUpQuestions?.length) {
      content.push(
        <div
          key="form-follow-ups"
          className="border-2 border-blue-200 dark:border-blue-700 rounded-xl overflow-hidden shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20"
        >
          <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600">
            <div className="text-lg font-bold text-white flex items-center">
              <div className="w-3 h-3 bg-white rounded-full mr-3 animate-pulse"></div>
              Form Follow-up Questions
            </div>
          </div>
          <div className="divide-y divide-blue-200 dark:divide-blue-700">
            {selectedForm.followUpQuestions.map((followUp: any) => {
              const answer = selectedResponse.answers[followUp.id];
              const hasAnswer = hasAnswerValue(answer);
              if (hasAnswer) {
                answeredKeys.add(followUp.id);
              }

              return (
                <div
                  key={followUp.id}
                  className={`p-6 ml-12 border-l-4 rounded-r-xl shadow-sm hover:transition-colors duration-200 ${
                    hasAnswer
                      ? "bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                      : "bg-gray-50 dark:bg-gray-900/30 border-gray-400 dark:border-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900/40"
                  }`}
                >
                  <div
                    className={`font-medium flex items-center text-lg ${
                      hasAnswer
                        ? "text-blue-800 dark:text-blue-200"
                        : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <span
                      className={`mr-4 text-xl ${
                        hasAnswer ? "text-blue-600" : "text-gray-500"
                      }`}
                    >
                      ↳
                    </span>
                    {followUp.text || followUp.id}
                  </div>
                  {followUp.subParam1 && (
                    <div className="mt-2 ml-8 text-xs bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-700 font-medium w-fit">
                      <span className="font-semibold">
                        Follow-up Parameter:
                      </span>{" "}
                      {followUp.subParam1}
                    </div>
                  )}
                  <div
                    className={`mt-3 ml-8 ${
                      hasAnswer
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-gray-600 dark:text-gray-400"
                    } text-base`}
                  >
                    {hasAnswer ? (
                      renderAnswerDisplay(answer, followUp)
                    ) : (
                      <span className="italic font-light">Not answered</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    const extraEntries = Object.entries(selectedResponse.answers).filter(
      ([key]) => !answeredKeys.has(key)
    );

    if (extraEntries.length) {
      content.push(
        <div
          key="additional-answers"
          className="border border-primary-100 rounded-lg overflow-hidden"
        >
          <div className="px-4 py-3 bg-primary-50">
            <div className="text-base font-semibold text-primary-700">
              Additional Responses
            </div>
          </div>
          <div className="divide-y divide-primary-100">
            {extraEntries.map(([key, value]) => (
              <div key={key} className="p-4">
                <div className="font-medium text-primary-700">{key}</div>
                <div className="mt-1 text-primary-600">
                  {renderAnswerDisplay(value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (!content.length) {
      return (
        <div className="space-y-6">
          {Object.entries(selectedResponse.answers).map(([key, value]) => (
            <div key={key} className="border-b border-primary-100 pb-2">
              <div className="font-medium text-primary-700">{key}</div>
              <div className="text-primary-600 mt-1">
                {renderAnswerDisplay(value)}
              </div>
            </div>
          ))}
        </div>
      );
    }

    return <div className="space-y-6">{content}</div>;
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
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

  const editingResponsePayload = editingResponse
    ? {
        id: editingResponse.id,
        questionId: editingResponse.questionId || editingResponse.formId || "",
        answers: editingResponse.answers,
        timestamp:
          editingResponse.updatedAt ||
          editingResponse.createdAt ||
          new Date().toISOString(),
        parentResponseId: editingResponse.parentResponseId,
        assignedTo: editingResponse.assignedTo,
        status: editingResponse.status,
      }
    : null;

  const editingQuestionPayload = editingForm
    ? {
        id:
          editingForm._id ||
          editingForm.id ||
          editingResponse?.questionId ||
          editingResponse?.formId ||
          "",
        title: editingForm.title,
        description: editingForm.description || "",
        sections: editingForm.sections || [],
        followUpQuestions: editingForm.followUpQuestions || [],
        parentFormId: editingForm.parentFormId,
      }
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="text-red-600 mb-2">Error loading responses</div>
        <div className="text-primary-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-primary-600 mb-2">
          Customer Requests
        </h1>
        <p className="text-primary-500">
          View all customer service requests and responses
        </p>
      </div>

      {/* Responses by Date */}
      <div className="space-y-6">
        {Object.keys(groupedResponses)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
          .map((date) => (
            <div key={date} className="card p-6">
              {/* Date Header */}
              <div className="flex items-center mb-4 pb-2 border-b border-primary-100">
                <Calendar className="w-5 h-5 text-primary-600 mr-2" />
                <h3 className="text-lg font-medium text-primary-600">{date}</h3>
                <span className="ml-2 text-sm text-primary-500">
                  ({groupedResponses[date].length} requests)
                </span>
              </div>

              {/* Responses List */}
              <div className="space-y-3">
                {groupedResponses[date].map((response) => {
                  const isFollowUp = !!response.parentResponseId;
                  return (
                    <div
                      key={response._id}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                        isFollowUp
                          ? "ml-8 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                          : "bg-primary-50 dark:bg-gray-800 border-primary-100 dark:border-gray-700 hover:bg-primary-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        <div
                          className={`p-2 rounded-lg ${
                            isFollowUp
                              ? "bg-blue-100 dark:bg-blue-900/40"
                              : "bg-white dark:bg-gray-900"
                          }`}
                        >
                          {isFollowUp ? (
                            <div className="w-5 h-5 flex items-center justify-center">
                              <span className="text-blue-600 dark:text-blue-300 text-xs font-bold">
                                ↳
                              </span>
                            </div>
                          ) : (
                            <FileText className="w-5 h-5 text-primary-600" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4
                              className={`font-medium ${
                                isFollowUp
                                  ? "text-blue-700 dark:text-blue-300"
                                  : "text-primary-700"
                              }`}
                            >
                              {response.formTitle}
                              {isFollowUp && (
                                <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold text-blue-700 bg-blue-100 border border-blue-200 dark:text-blue-300 dark:bg-blue-900/40 dark:border-blue-700">
                                  Follow-up
                                </span>
                              )}
                            </h4>
                            {response.yesNoScore &&
                              response.yesNoScore.total > 0 && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold text-green-700 bg-green-50 border border-green-100 dark:text-green-300 dark:bg-green-900/30 dark:border-green-800">
                                  {response.yesNoScore.yes}/
                                  {response.yesNoScore.total}
                                </span>
                              )}
                          </div>
                          <div
                            className={`flex items-center text-sm mt-1 ${
                              isFollowUp
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-primary-500"
                            }`}
                          >
                            <User className="w-4 h-4 mr-1" />
                            <span>
                              Submitted {formatTimestamp(response.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewDetails(response)}
                          className={`btn-secondary flex items-center ${
                            isFollowUp
                              ? "bg-blue-600 hover:bg-blue-700 text-white"
                              : ""
                          }`}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </button>
                        <button
                          onClick={() => handleEditResponse(response)}
                          disabled={
                            !!editingResponse &&
                            editingResponse.id === response.id &&
                            (editingFormLoading || savingEdit)
                          }
                          className="flex items-center px-3 py-2 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-60 dark:text-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-900/60"
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteResponse(response)}
                          disabled={deletingResponseId === response.id}
                          className="flex items-center px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-60 dark:text-red-300 dark:bg-red-900/40 dark:hover:bg-red-900/60"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {deletingResponseId === response.id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

        {responses.length === 0 && (
          <div className="text-center py-16 card">
            <div className="p-4 bg-primary-50 dark:bg-gray-800 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <FileText className="w-10 h-10 text-primary-600 dark:text-primary-300" />
            </div>
            <h3 className="text-lg font-medium text-primary-600 mb-2">
              No Customer Requests
            </h3>
            <p className="text-primary-500 max-w-md mx-auto">
              There are currently no customer service requests. Requests will
              appear here once customers submit forms.
            </p>
          </div>
        )}
      </div>

      {/* Response Preview Modal */}
      {selectedResponse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-6xl w-full m-4 max-h-[90vh] flex flex-col">
            <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 px-6 py-4 border-b border-primary-200 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-semibold text-primary-700">
                  {selectedResponse.formTitle}
                </h3>
                <p className="text-sm text-primary-500">
                  Submitted on {formatTimestamp(selectedResponse.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {viewMode === "dashboard" ? (
                  <button
                    onClick={handleDownloadPDF}
                    disabled={generatingPDF}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-cyan-700 bg-cyan-50 rounded-lg hover:bg-cyan-100 transition-colors disabled:opacity-60"
                    title="Download PDF"
                  >
                    {generatingPDF ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                    Download PDF
                  </button>
                ) : (
                  <button
                    onClick={handleExportExcel}
                    disabled={exportingExcel}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-60"
                    title="Export Excel"
                  >
                    {exportingExcel ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-green-400 border-t-transparent" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    Export Excel
                  </button>
                )}

                <button
                  onClick={() => {
                    setSelectedResponse(null);
                    setSelectedForm(null);
                    setViewMode("dashboard");
                    setPendingSectionId(null);
                    sectionRefs.current = {};
                  }}
                  className="text-primary-500 hover:text-primary-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              <div className="p-6">
                {formLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 flex items-center gap-1 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 rounded-xl p-1 mb-6 shadow-lg border border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => setViewMode("dashboard")}
                        className={`px-6 py-3 text-sm font-semibold rounded-lg transition-all duration-300 flex items-center gap-2 ${
                          viewMode === "dashboard"
                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md transform scale-105"
                            : "text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        <BarChart3 className="w-4 h-4" />
                        Dashboard
                      </button>
                      <button
                        onClick={() => setViewMode("responses")}
                        className={`px-6 py-3 text-sm font-semibold rounded-lg transition-all duration-300 flex items-center gap-2 ${
                          viewMode === "responses"
                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md transform scale-105"
                            : "text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        <FileText className="w-4 h-4" />
                        Responses
                      </button>
                    </div>

                    {viewMode === "dashboard" &&
                      filteredSectionStats.length > 0 && (
                        <div className="space-y-8">
                          {/* Dashboard Header with Logo */}
                          <div className="bg-gradient-to-br from-white via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20 p-8 rounded-3xl shadow-2xl border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center justify-between mb-6">
                              <div className="flex items-center space-x-4">
                                {logo && (
                                  <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg border-2 border-white dark:border-gray-700">
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
                                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                    {selectedForm?.title ||
                                      "Response Dashboard"}
                                  </h1>
                                  <p className="text-gray-600 dark:text-gray-300 mt-1">
                                    Comprehensive analysis and insights
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-3">
                                <div className="text-right">
                                  <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Submitted
                                  </p>
                                  <p className="font-semibold text-gray-900 dark:text-white">
                                    {formatTimestamp(
                                      selectedResponse?.createdAt || ""
                                    )}
                                  </p>
                                </div>
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                                  <FileCheck className="w-6 h-6 text-white" />
                                </div>
                              </div>
                            </div>

                            {/* Quick Stats Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 backdrop-blur-sm p-6 rounded-2xl border border-yellow-200/50 dark:border-yellow-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-300 mb-1">
                                      Overall Score
                                    </p>
                                    <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">
                                      {(() => {
                                        const totalQuestions =
                                          filteredSectionStats.reduce(
                                            (sum, stat) => sum + stat.total,
                                            0
                                          );
                                        const totalYes =
                                          filteredSectionStats.reduce(
                                            (sum, stat) => sum + stat.yes,
                                            0
                                          );
                                        return totalQuestions > 0
                                          ? (
                                              (totalYes / totalQuestions) *
                                              100
                                            ).toFixed(1)
                                          : "0.0";
                                      })()}
                                      %
                                    </p>
                                  </div>
                                  <div className="p-3 bg-yellow-500/20 rounded-full">
                                    <Award className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                                  </div>
                                </div>
                              </div>

                              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 backdrop-blur-sm p-6 rounded-2xl border border-blue-200/50 dark:border-blue-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1">
                                      Total Sections
                                    </p>
                                    <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                                      {filteredSectionStats.length}
                                    </p>
                                  </div>
                                  <div className="p-3 bg-blue-500/20 rounded-full">
                                    <Target className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                                  </div>
                                </div>
                              </div>

                              <div
                                className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 backdrop-blur-sm p-6 rounded-2xl border border-green-200/50 dark:border-green-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 cursor-pointer"
                                onClick={() =>
                                  setExpandResponseRateBreakdown(
                                    !expandResponseRateBreakdown
                                  )
                                }
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-semibold text-green-700 dark:text-green-300 mb-1">
                                        Response Rate
                                      </p>
                                      <ChevronDown
                                        className={`w-4 h-4 text-green-700 dark:text-green-300 transition-transform duration-300 ${
                                          expandResponseRateBreakdown
                                            ? "rotate-180"
                                            : ""
                                        }`}
                                      />
                                    </div>
                                    <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                                      {(() => {
                                        const totalQuestions =
                                          filteredSectionStats.reduce(
                                            (sum, stat) => sum + stat.total,
                                            0
                                          );
                                        const totalAnswered =
                                          filteredSectionStats.reduce(
                                            (sum, stat) =>
                                              sum +
                                              stat.yes +
                                              stat.no +
                                              stat.na,
                                            0
                                          );
                                        return totalQuestions > 0
                                          ? (
                                              (totalAnswered / totalQuestions) *
                                              100
                                            ).toFixed(1)
                                          : "0.0";
                                      })()}
                                      %
                                    </p>
                                  </div>
                                  <div className="p-3 bg-green-500/20 rounded-full">
                                    <Activity className="w-8 h-8 text-green-600 dark:text-green-400" />
                                  </div>
                                </div>

                                {expandResponseRateBreakdown && (
                                  <div className="mt-6 pt-6 border-t border-green-300/50 dark:border-green-600/50">
                                    <div className="grid grid-cols-3 gap-4">
                                      {(() => {
                                        const totalYes =
                                          filteredSectionStats.reduce(
                                            (sum, stat) => sum + stat.yes,
                                            0
                                          );
                                        const totalNo =
                                          filteredSectionStats.reduce(
                                            (sum, stat) => sum + stat.no,
                                            0
                                          );
                                        const totalNA =
                                          filteredSectionStats.reduce(
                                            (sum, stat) => sum + stat.na,
                                            0
                                          );
                                        const totalAnswered =
                                          totalYes + totalNo + totalNA;

                                        const yesPercent =
                                          totalAnswered > 0
                                            ? (
                                                (totalYes / totalAnswered) *
                                                100
                                              ).toFixed(1)
                                            : "0.0";
                                        const noPercent =
                                          totalAnswered > 0
                                            ? (
                                                (totalNo / totalAnswered) *
                                                100
                                              ).toFixed(1)
                                            : "0.0";
                                        const naPercent =
                                          totalAnswered > 0
                                            ? (
                                                (totalNA / totalAnswered) *
                                                100
                                              ).toFixed(1)
                                            : "0.0";

                                        return (
                                          <>
                                            <div className="text-center p-3 bg-white/50 dark:bg-green-900/20 rounded-lg">
                                              <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1 uppercase">
                                                Yes
                                              </p>
                                              <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                                                {yesPercent}%
                                              </p>
                                            </div>
                                            <div className="text-center p-3 bg-white/50 dark:bg-red-900/20 rounded-lg">
                                              <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1 uppercase">
                                                No
                                              </p>
                                              <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                                                {noPercent}%
                                              </p>
                                            </div>
                                            <div className="text-center p-3 bg-white/50 dark:bg-yellow-900/20 rounded-lg">
                                              <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 mb-1 uppercase">
                                                N/A
                                              </p>
                                              <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                                                {naPercent}%
                                              </p>
                                            </div>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Location Card */}
                              <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 backdrop-blur-sm p-6 rounded-2xl border border-purple-200/50 dark:border-purple-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-1">
                                      Location
                                    </p>
                                    <p className="text-lg font-bold text-purple-900 dark:text-purple-100">
                                      {selectedForm?.locationEnabled !== false
                                        ? (() => {
                                            const capturedLoc =
                                              selectedResponse?.submissionMetadata?.capturedLocation;
                                            const ipLoc =
                                              selectedResponse?.submissionMetadata?.location;

                                            let locationToUse = null;
                                            
                                            if (capturedLoc?.city || capturedLoc?.region || capturedLoc?.country) {
                                              locationToUse = capturedLoc;
                                            } else if (ipLoc?.city || ipLoc?.region || ipLoc?.country) {
                                              locationToUse = ipLoc;
                                            }

                                            if (locationToUse) {
                                              const parts = [];
                                              if (locationToUse.city)
                                                parts.push(locationToUse.city);
                                              if (locationToUse.region)
                                                parts.push(locationToUse.region);
                                              if (locationToUse.country)
                                                parts.push(locationToUse.country);
                                              return parts.length > 0
                                                ? parts.join(", ")
                                                : "Location data unavailable";
                                            }
                                            return "Location data unavailable";
                                          })()
                                        : "Location disabled"}
                                    </p>
                                  </div>
                                  <div className="p-3 bg-purple-500/20 rounded-full">
                                    <MapPin className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Location Heatmap Section 
                          {responses && responses.length > 0 && (
                            <LocationHeatmap responses={responses} />
                          )}*/}

                          {/* Charts Section */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/30 dark:from-gray-800 dark:via-blue-900/10 dark:to-indigo-900/10 p-8 rounded-3xl shadow-2xl border border-blue-200/50 dark:border-blue-700/50 transform hover:scale-[1.02] transition-all duration-500 hover:shadow-3xl backdrop-blur-sm">
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
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      Yes
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      No
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <div className="w-3 h-3 bg-blue-300 rounded-full"></div>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      N/A
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div
                                className="w-full"
                                style={{ height: sectionChartHeight }}
                                id="section-performance-chart"
                              >
                                <Bar
                                  data={sectionChartData}
                                  options={{
                                    ...sectionChartOptions,
                                    plugins: {
                                      ...sectionChartOptions.plugins,
                                      legend: {
                                        ...sectionChartOptions.plugins.legend,
                                        labels: {
                                          ...sectionChartOptions.plugins.legend
                                            .labels,
                                          font: {
                                            size: 12,
                                            weight: "bold",
                                          },
                                        },
                                      },
                                    },
                                    onClick: (_event, elements) => {
                                      const firstElement = elements[0] as
                                        | ActiveElement
                                        | undefined;
                                      if (!firstElement) {
                                        return;
                                      }
                                      const sectionId =
                                        filteredSectionStats[firstElement.index]
                                          ?.id;
                                      if (sectionId) {
                                        setPendingSectionId(sectionId);
                                        setViewMode("responses");
                                      }
                                    },
                                  }}
                                />
                              </div>
                            </div>

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
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      Yes × Weight
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      No × Weight
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      N/A × Weight
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div
                                className="w-full"
                                style={{ height: weightedChartHeight }}
                              >
                                <Line
                                  data={weightedPercentageChartData}
                                  options={{
                                    ...weightedPercentageChartOptions,
                                    plugins: {
                                      ...weightedPercentageChartOptions.plugins,
                                      legend: {
                                        ...weightedPercentageChartOptions
                                          .plugins.legend,
                                        labels: {
                                          ...weightedPercentageChartOptions
                                            .plugins.legend,
                                          font: {
                                            size: 12,
                                            weight: "bold",
                                          },
                                        },
                                      },
                                    },
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Section-wise Breakdown Table */}
                          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden transform hover:scale-[1.01] transition-all duration-500 hover:shadow-3xl">
                            <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-6">
                              <h3 className="text-2xl font-bold text-white flex items-center">
                                <BarChart3 className="w-7 h-7 mr-3" />
                                Section-wise Breakdown
                              </h3>
                              <p className="text-blue-100 mt-1">
                                Detailed performance analysis by section with
                                weightage calculations
                              </p>
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
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                                  {sectionSummaryRows.map((row) => (
                                    <tr
                                      key={row.id}
                                      className="group hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-600 transition-all duration-300 bg-white dark:bg-gray-900"
                                    >
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
                                      <td className="px-6 py-5 text-gray-700 dark:text-gray-300 font-medium">
                                        {editingWeightage === row.id ? (
                                          <div className="flex items-center space-x-2">
                                            <input
                                              type="number"
                                              min="0"
                                              max="100"
                                              step="0.1"
                                              value={weightageValue}
                                              onChange={(e) =>
                                                setWeightageValue(
                                                  e.target.value
                                                )
                                              }
                                              className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                                              disabled={savingWeightage}
                                            />
                                            <button
                                              onClick={() =>
                                                handleSaveWeightage(row.id)
                                              }
                                              disabled={savingWeightage}
                                              className="p-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50"
                                              title="Save weightage"
                                            >
                                              {savingWeightage ? (
                                                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                                              ) : (
                                                <Save className="w-4 h-4" />
                                              )}
                                            </button>
                                            <button
                                              onClick={
                                                handleCancelWeightageEdit
                                              }
                                              disabled={savingWeightage}
                                              className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                                              title="Cancel editing"
                                            >
                                              <X className="w-4 h-4" />
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center justify-between">
                                            <span>
                                              {row.weightage.toFixed(1)}%
                                            </span>
                                            <button
                                              onClick={() =>
                                                handleEditWeightage(
                                                  row.id,
                                                  row.weightage
                                                )
                                              }
                                              className="ml-2 p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                              title="Edit weightage"
                                            >
                                              <Edit2 className="w-4 h-4" />
                                            </button>
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
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Main Parameters and Subparameters - Section Wise */}
                          <div className="space-y-0">
                            {renderSectionWiseMainParameters()}
                          </div>

                          {/* Quick Actions */}
                          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 p-6 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                              <Zap className="w-6 h-6 mr-3 text-yellow-500" />
                              Quick Actions
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <button
                                onClick={handleExportExcel}
                                disabled={exportingExcel}
                                className="flex items-center justify-center p-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50"
                              >
                                {exportingExcel ? (
                                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3" />
                                ) : (
                                  <Download className="w-5 h-5 mr-3" />
                                )}
                                {exportingExcel
                                  ? "Exporting..."
                                  : "Export Excel"}
                              </button>

                              <button
                                onClick={() => {
                                  setViewMode("responses");
                                }}
                                className="flex items-center justify-center p-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
                              >
                                <Eye className="w-5 h-5 mr-3" />
                                View Details
                              </button>

                              <button
                                onClick={handleDownloadPDF}
                                disabled={generatingPDF}
                                className="flex items-center justify-center p-4 bg-gradient-to-r from-cyan-500 to-teal-600 text-white rounded-xl hover:from-cyan-600 hover:to-teal-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed group"
                              >
                                {generatingPDF ? (
                                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3" />
                                ) : (
                                  <FileText className="w-5 h-5 mr-3 group-hover:animate-pulse" />
                                )}
                                {generatingPDF
                                  ? "Generating PDF..."
                                  : "Download PDF"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                    {viewMode === "responses" && renderFormContent()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {editingResponse && editingFormLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl px-6 py-4 flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
            <div className="text-primary-600 font-medium">
              Loading form details...
            </div>
          </div>
        </div>
      )}

      {editingResponse &&
        editingResponsePayload &&
        editingQuestionPayload &&
        !editingFormLoading && (
          <ResponseEdit
            response={editingResponsePayload as any}
            question={editingQuestionPayload as any}
            onSave={handleSaveEditedResponse}
            onCancel={handleCloseEdit}
          />
        )}
    </div>
  );
}
