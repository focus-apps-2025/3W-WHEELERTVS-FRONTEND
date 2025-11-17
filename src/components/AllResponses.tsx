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
} from "lucide-react";
import { Bar, Line } from "react-chartjs-2";
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
  const [viewMode, setViewMode] = useState<"dashboard" | "responses">("dashboard");
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(null);

  const [exportingExcel, setExportingExcel] = useState(false);
  const [deletingResponseId, setDeletingResponseId] = useState<string | null>(null);
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
      setSelectedForm(formData.form);
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
      setEditingForm(formData.form);
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
      await apiClient.updateResponse(responseId, { answers: updated.answers, status: updated.status, notes: updated.notes });
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
      await generateAndDownloadPDF({
        filename: `${selectedForm.title}_Report.pdf`,
        formTitle: selectedForm.title,
        submittedDate: formatTimestamp(selectedResponse.createdAt),
        sectionStats: filteredSectionStats,
        sectionSummaryRows: sectionSummaryRows,
        form: selectedForm,
        response: selectedResponse,
      });
      showSuccess("PDF downloaded successfully.");
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      showError("Failed to generate PDF. Please try again.");
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleEditWeightage = (sectionId: string, currentWeightage: number) => {
    setEditingWeightage(sectionId);
    setWeightageValue(currentWeightage.toString());
  };

  const handleCancelWeightageEdit = () => {
    setEditingWeightage(null);
    setWeightageValue("");
  };

  const handleSaveWeightage = async (sectionId: string) => {
    if (!selectedForm) return;

    const newWeightage = parseFloat(weightageValue);
    if (isNaN(newWeightage) || newWeightage < 0 || newWeightage > 100) {
      showError("Weightage must be a number between 0 and 100");
      return;
    }

    setSavingWeightage(true);
    try {
      // Find the current section being edited
      const currentSection = selectedForm.sections?.find((section: any) => section.id === sectionId);
      if (!currentSection) {
        showError("Section not found");
        return;
      }

      const currentWeightage = currentSection.weightage || 0;
      const weightageDifference = newWeightage - currentWeightage;

      // If there's no change, just exit
      if (Math.abs(weightageDifference) < 0.01) {
        setEditingWeightage(null);
        setWeightageValue("");
        return;
      }

      // Redistribute the weightage difference among other sections
      const otherSections = selectedForm.sections?.filter((section: any) => section.id !== sectionId) || [];
      const totalOtherWeightage = otherSections.reduce((sum, section) => sum + (section.weightage || 0), 0);

      let updatedSections;
      if (totalOtherWeightage > 0) {
        // Distribute the difference proportionally among other sections
        const adjustmentFactor = (totalOtherWeightage - weightageDifference) / totalOtherWeightage;

        updatedSections = selectedForm.sections?.map((section: any) => {
          if (section.id === sectionId) {
            return { ...section, weightage: newWeightage };
          } else {
            const adjustedWeightage = (section.weightage || 0) * adjustmentFactor;
            return { ...section, weightage: Math.max(0, Math.round(adjustedWeightage * 10) / 10) }; // Round to 1 decimal place
          }
        });
      } else {
        // If no other sections have weightage, just set this section and leave others as is
        updatedSections = selectedForm.sections?.map((section: any) =>
          section.id === sectionId ? { ...section, weightage: newWeightage } : section
        );
      }

      // Ensure total adds up to 100% by adjusting the last section if needed
      const totalWeightage = updatedSections?.reduce((sum, section) => sum + (section.weightage || 0), 0) || 0;
      if (Math.abs(totalWeightage - 100) > 0.1) {
        const adjustment = 100 - totalWeightage;
        if (updatedSections && updatedSections.length > 0) {
          const lastSection = updatedSections[updatedSections.length - 1];
          lastSection.weightage = Math.max(0, (lastSection.weightage || 0) + adjustment);
        }
      }

      // Update the form via API
      await apiClient.updateForm(selectedForm._id || selectedForm.id, {
        sections: updatedSections
      });

      // Update local state
      setSelectedForm({
        ...selectedForm,
        sections: updatedSections
      });

      setEditingWeightage(null);
      setWeightageValue("");
      showSuccess("Weightage updated successfully");
    } catch (error) {
      console.error("Failed to update weightage:", error);
      showError("Failed to update weightage. Please try again.");
    } finally {
      setSavingWeightage(false);
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

  const sectionStats = useMemo(() => {
    if (!selectedForm || !selectedResponse) {
      return [] as SectionStat[];
    }
    return getSectionYesNoStats(selectedForm, selectedResponse.answers);
  }, [selectedForm, selectedResponse]);

  const filteredSectionStats = useMemo(
    () => sectionStats.filter((stat) => stat.yes > 0 || stat.no > 0 || stat.na > 0 || stat.weightage > 0),
    [sectionStats]
  );

  const sectionChartData = useMemo(() => {
    const calculatePercentage = (value: number, total: number) =>
      total ? parseFloat(((value / total) * 100).toFixed(1)) : 0;

    return {
      labels: filteredSectionStats.map((stat) => formatSectionLabel(stat.title)),
      datasets: [
        {
          label: "Yes",
          data: filteredSectionStats.map((stat) => calculatePercentage(stat.yes, stat.total)),
          backgroundColor: "#1d4ed8",
          borderRadius: 4,
        },
        {
          label: "No",
          data: filteredSectionStats.map((stat) => calculatePercentage(stat.no, stat.total)),
          backgroundColor: "#3b82f6",
          borderRadius: 4,
        },
        {
          label: "N/A",
          data: filteredSectionStats.map((stat) => calculatePercentage(stat.na, stat.total)),
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
              const labels = ChartJS.defaults.plugins.legend.labels.generateLabels(chart);
              labels.forEach((label: any) => {
                label.color = document.documentElement.classList.contains('dark') ? '#d1d5db' : '#374151';
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
          data: sectionSummaryRows.map((row) => parseFloat(row.yesWeighted.toFixed(1))),
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
          data: sectionSummaryRows.map((row) => parseFloat(row.noWeighted.toFixed(1))),
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
          data: sectionSummaryRows.map((row) => parseFloat(row.naWeighted.toFixed(1))),
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
              const labels = ChartJS.defaults.plugins.legend.labels.generateLabels(chart);
              labels.forEach((label: any) => {
                label.color = document.documentElement.classList.contains('dark') ? '#d1d5db' : '#374151';
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
        const weightage = Number.isFinite(weightageNumber) ? weightageNumber : 0;

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
      const candidate = Array.isArray(input) && input.length === 1 ? input[0] : input;
      if (typeof candidate === "string") {
        if (candidate.startsWith("data:")) {
          return { data: candidate, fileName: question?.fileName || question?.name };
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
              question?.fileName || question?.name || extractFileName(candidate),
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
          candidate.fileName || candidate.filename || candidate.name || question?.fileName || question?.name;
        if (typeof dataValue === "string" && dataValue.startsWith("data:")) {
          return { data: dataValue, fileName: nameValue };
        }
        if (typeof dataValue === "string") {
          const absolute = ensureAbsoluteFileSource(dataValue);
          return { url: absolute, fileName: nameValue || extractFileName(dataValue) };
        }
        if (typeof candidate.url === "string") {
          const absolute = ensureAbsoluteFileSource(candidate.url);
          return { url: absolute, fileName: nameValue || extractFileName(candidate.url) };
        }
      }
      return null;
    };

    if (question?.type === "file" || question?.type === "radio-image") {
      const fileData = resolveFileData(value);
      if (fileData?.data) {
        return <FilePreview data={fileData.data} fileName={fileData.fileName} />;
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
        return <FilePreview data={value} fileName={question?.fileName || question?.name} />;
      }
      if (
        question?.type === "file" ||
        question?.type === "radio-image"
      ) {
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
              fileName={question?.fileName || question?.name || extractFileName(value)}
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
      return trimmed ? trimmed : <span className="text-primary-400">No response</span>;
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
        return <FilePreview data={first} fileName={question?.fileName || question?.name} />;
      }
      return value.join(", ");
    }

    if (typeof value === "object") {
      const fileData = resolveFileData(value);
      if (fileData?.data) {
        return <FilePreview data={fileData.data} fileName={fileData.fileName} />;
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
                <div key={question.id} className="p-6 bg-white dark:bg-gray-800 rounded-xl border-2 border-slate-200 dark:border-slate-600 shadow-lg">
                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center text-lg">
                    <span className="w-3 h-3 bg-slate-600 rounded-full mr-4 flex-shrink-0"></span>
                    {question.text || question.id}
                  </div>
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
                        <div className={`font-medium ${
                          hasAnswer
                            ? "text-blue-800 dark:text-blue-200"
                            : "text-gray-700 dark:text-gray-300"
                        } flex items-center`}>
                          <span className={`mr-3 text-lg ${
                            hasAnswer ? "text-blue-600" : "text-gray-500"
                          }`}>↳</span>
                          {followUp.text || followUp.id}
                        </div>
                        <div className={`mt-2 ml-6 ${
                          hasAnswer
                            ? "text-blue-700 dark:text-blue-300"
                            : "text-gray-600 dark:text-gray-400"
                        }`}>
                          {hasAnswer ? renderAnswerDisplay(followAnswer, followUp) : <span className="italic font-light">Not answered</span>}
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
                <div key={followUp.id} className={`p-6 ml-12 border-l-4 rounded-r-xl shadow-sm hover:transition-colors duration-200 ${
                  hasAnswer
                    ? "bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                    : "bg-gray-50 dark:bg-gray-900/30 border-gray-400 dark:border-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900/40"
                }`}>
                  <div className={`font-medium flex items-center text-lg ${
                    hasAnswer
                      ? "text-blue-800 dark:text-blue-200"
                      : "text-gray-700 dark:text-gray-300"
                  }`}>
                    <span className={`mr-4 text-xl ${
                      hasAnswer ? "text-blue-600" : "text-gray-500"
                    }`}>↳</span>
                    {followUp.text || followUp.id}
                  </div>
                  <div className={`mt-3 ml-8 ${
                    hasAnswer
                      ? "text-blue-700 dark:text-blue-300"
                      : "text-gray-600 dark:text-gray-400"
                  } text-base`}>
                    {hasAnswer ? renderAnswerDisplay(answer, followUp) : <span className="italic font-light">Not answered</span>}
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
                        <div className={`p-2 rounded-lg ${isFollowUp ? "bg-blue-100 dark:bg-blue-900/40" : "bg-white dark:bg-gray-900"}`}>
                          {isFollowUp ? (
                            <div className="w-5 h-5 flex items-center justify-center">
                              <span className="text-blue-600 dark:text-blue-300 text-xs font-bold">↳</span>
                            </div>
                          ) : (
                            <FileText className="w-5 h-5 text-primary-600" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className={`font-medium ${isFollowUp ? "text-blue-700 dark:text-blue-300" : "text-primary-700"}`}>
                              {response.formTitle}
                              {isFollowUp && (
                                <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold text-blue-700 bg-blue-100 border border-blue-200 dark:text-blue-300 dark:bg-blue-900/40 dark:border-blue-700">
                                  Follow-up
                                </span>
                              )}
                            </h4>
                            {response.yesNoScore && response.yesNoScore.total > 0 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold text-green-700 bg-green-50 border border-green-100 dark:text-green-300 dark:bg-green-900/30 dark:border-green-800">
                                {response.yesNoScore.yes}/{response.yesNoScore.total}
                              </span>
                            )}
                          </div>
                          <div className={`flex items-center text-sm mt-1 ${isFollowUp ? "text-blue-600 dark:text-blue-400" : "text-primary-500"}`}>
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
                          className={`btn-secondary flex items-center ${isFollowUp ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
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
                          {deletingResponseId === response.id ? "Deleting..." : "Delete"}
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

                    {viewMode === "dashboard" && filteredSectionStats.length > 0 && (
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
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                            <div>
                              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                {selectedForm?.title || "Response Dashboard"}
                              </h1>
                              <p className="text-gray-600 dark:text-gray-300 mt-1">
                                Comprehensive analysis and insights
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="text-right">
                              <p className="text-sm text-gray-500 dark:text-gray-400">Submitted</p>
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {formatTimestamp(selectedResponse?.createdAt || "")}
                              </p>
                            </div>
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                              <FileCheck className="w-6 h-6 text-white" />
                            </div>
                          </div>
                        </div>

                        {/* Quick Stats Row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 backdrop-blur-sm p-6 rounded-2xl border border-yellow-200/50 dark:border-yellow-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-300 mb-1">Overall Score</p>
                                <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">
                                  {(() => {
                                    const totalQuestions = filteredSectionStats.reduce((sum, stat) => sum + stat.total, 0);
                                    const totalYes = filteredSectionStats.reduce((sum, stat) => sum + stat.yes, 0);
                                    return totalQuestions > 0 ? ((totalYes / totalQuestions) * 100).toFixed(1) : "0.0";
                                  })()}%
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
                                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1">Total Sections</p>
                                <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                                  {filteredSectionStats.length}
                                </p>
                              </div>
                              <div className="p-3 bg-blue-500/20 rounded-full">
                                <Target className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                              </div>
                            </div>
                          </div>

                          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 backdrop-blur-sm p-6 rounded-2xl border border-green-200/50 dark:border-green-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold text-green-700 dark:text-green-300 mb-1">Response Rate</p>
                                <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                                  {(() => {
                                    const totalQuestions = filteredSectionStats.reduce((sum, stat) => sum + stat.total, 0);
                                    const totalAnswered = filteredSectionStats.reduce((sum, stat) => sum + stat.yes + stat.no + stat.na, 0);
                                    return totalQuestions > 0 ? ((totalAnswered / totalQuestions) * 100).toFixed(1) : "0.0";
                                  })()}%
                                </p>
                              </div>
                              <div className="p-3 bg-green-500/20 rounded-full">
                                <Activity className="w-8 h-8 text-green-600 dark:text-green-400" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

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
                          <div className="w-full" style={{ height: sectionChartHeight }}>
                            <Bar
                              data={sectionChartData}
                              options={{
                                ...sectionChartOptions,
                                plugins: {
                                  ...sectionChartOptions.plugins,
                                  legend: {
                                    ...sectionChartOptions.plugins.legend,
                                    labels: {
                                      ...sectionChartOptions.plugins.legend.labels,
                                      font: {
                                        size: 12,
                                        weight: 'bold'
                                      }
                                    }
                                  }
                                },
                                onClick: (_event, elements) => {
                                  const firstElement = elements[0] as ActiveElement | undefined;
                                  if (!firstElement) {
                                    return;
                                  }
                                  const sectionId = filteredSectionStats[firstElement.index]?.id;
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
                            <Line
                              data={weightedPercentageChartData}
                              options={{
                                ...weightedPercentageChartOptions,
                                plugins: {
                                  ...weightedPercentageChartOptions.plugins,
                                  legend: {
                                    ...weightedPercentageChartOptions.plugins.legend,
                                    labels: {
                                      ...weightedPercentageChartOptions.plugins.legend,
                                      font: {
                                        size: 12,
                                        weight: 'bold'
                                      }
                                    }
                                  }
                                }
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
                          <p className="text-blue-100 mt-1">Detailed performance analysis by section with weightage calculations</p>
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
                                  <td className="px-6 py-5 text-gray-700 dark:text-gray-300 font-medium">
                                    {editingWeightage === row.id ? (
                                      <div className="flex items-center space-x-2">
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          step="0.1"
                                          value={weightageValue}
                                          onChange={(e) => setWeightageValue(e.target.value)}
                                          className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                                          disabled={savingWeightage}
                                        />
                                        <button
                                          onClick={() => handleSaveWeightage(row.id)}
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
                                          onClick={handleCancelWeightageEdit}
                                          disabled={savingWeightage}
                                          className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                                          title="Cancel editing"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-between">
                                        <span>{row.weightage.toFixed(1)}%</span>
                                        <button
                                          onClick={() => handleEditWeightage(row.id, row.weightage)}
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

                      {/* Main Parameters and Subparameters Table */}
                      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden transform hover:scale-[1.01] transition-all duration-500 hover:shadow-3xl">
                        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-6">
                          <h3 className="text-2xl font-bold text-white flex items-center">
                            <BarChart3 className="w-7 h-7 mr-3" />
                            Main Parameters & Subparameters
                          </h3>
                          <p className="text-emerald-100 mt-1">Main questions with their follow-up answers organized by subparameters</p>
                        </div>
                        <div className="overflow-x-auto">
                          {(() => {
                            // Debug: Log form structure
                            console.log('Selected Form:', selectedForm);
                            console.log('Form sections:', selectedForm?.sections);
                            console.log('Form followUpQuestions:', selectedForm?.followUpQuestions);

                            // Collect main questions that have follow-up questions
                            const mainQuestionsWithFollowUps: any[] = [];

                            // Process sections to group main questions with their follow-ups
                            selectedForm?.sections?.forEach((section: any) => {
                              console.log('Processing section:', section.title, section.questions, section.followUpQuestions);
                              const questions = section.questions || [];
                              let i = 0;
                              while (i < questions.length) {
                                const question = questions[i];
                                console.log('Processing question:', question.text, question.followUpQuestions);
                                console.log('Full question object:', JSON.stringify(question, null, 2));
                                if (question.type !== 'text') {
                                  // This is a main question (non-text type)
                                  const mainQuestion = {
                                    ...question,
                                    sectionTitle: section.title,
                                    followUpQuestions: []
                                  };
                                  i++;
                                  // Collect follow-ups (text type) until next main
                                  while (i < questions.length && questions[i].type === 'text') {
                                    mainQuestion.followUpQuestions.push(questions[i]);
                                    i++;
                                  }
                                  if (mainQuestion.followUpQuestions.length > 0) {
                                    mainQuestionsWithFollowUps.push(mainQuestion);
                                  }
                                } else {
                                  // Skip orphaned follow-up
                                  i++;
                                }
                              }
                              // Check if section has followUpQuestions (legacy support)
                              if (section.followUpQuestions && section.followUpQuestions.length > 0) {
                                console.log('Found section-level followUpQuestions:', section.followUpQuestions);
                                mainQuestionsWithFollowUps.push({
                                  id: `section-${section.id}-followups`,
                                  text: `${section.title} Follow-up Questions`,
                                  followUpQuestions: section.followUpQuestions,
                                  sectionTitle: section.title
                                });
                              }
                            });

                            console.log('Main questions with follow-ups:', mainQuestionsWithFollowUps);
                            console.log('Selected Response answers:', selectedResponse?.answers);

                            // For imported forms, treat form-level followUpQuestions as main questions (legacy support)
                            if (mainQuestionsWithFollowUps.length === 0 && selectedForm?.followUpQuestions?.length > 0) {
                              console.log('Using form-level follow-up questions');
                              // Create a synthetic main question for form-level follow-ups
                              mainQuestionsWithFollowUps.push({
                                id: 'form-followups',
                                text: 'Form Follow-up Questions',
                                followUpQuestions: selectedForm.followUpQuestions,
                                sectionTitle: 'Form Level'
                              });
                            }

                            // Collect all unique follow-up questions as columns
                            const allFollowUpColumns: any[] = [];
                            const followUpMap = new Map();

                            mainQuestionsWithFollowUps.forEach((mainQuestion) => {
                              mainQuestion.followUpQuestions?.forEach((followUp: any) => {
                                if (!followUpMap.has(followUp.id)) {
                                  followUpMap.set(followUp.id, followUp);
                                  allFollowUpColumns.push(followUp);
                                }
                              });
                            });

                            if (mainQuestionsWithFollowUps.length === 0) {
                              return (
                                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                  No main questions with follow-up questions found in this form.
                                </div>
                              );
                            }

                            return (
                              <table className="w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 sticky top-0">
                                  <tr>
                                    <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-48">
                                      Main Parameter
                                    </th>
                                    {allFollowUpColumns.map((followUp) => (
                                      <th key={followUp.id} className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-32">
                                        {followUp.subParam1 || followUp.subParam2 || followUp.text || followUp.id}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                                  {mainQuestionsWithFollowUps.map((mainQuestion, index) => (
                                    <tr key={mainQuestion.id} className={`hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50 dark:hover:from-gray-700 dark:hover:to-gray-600 transition-all duration-300 ${index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}`}>
                                      <td className="px-6 py-5 font-bold text-gray-900 dark:text-gray-100 flex items-center">
                                        <div className="w-3 h-3 bg-emerald-500 rounded-full mr-3"></div>
                                        <div className="flex flex-col">
                                          <span>{mainQuestion.subParam1 || mainQuestion.subParam2 || mainQuestion.text || mainQuestion.id}</span>
                                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            ({mainQuestion.sectionTitle})
                                          </span>
                                        </div>
                                      </td>
                                      {allFollowUpColumns.map((followUp) => {
                                        const isFollowUpOfMain = mainQuestion.followUpQuestions?.some((fu: any) => fu.id === followUp.id);
                                        const answer = isFollowUpOfMain ? selectedResponse?.answers?.[followUp.id] : null;
                                        return (
                                          <td key={followUp.id} className="px-6 py-5 text-gray-700 dark:text-gray-300">
                                            {isFollowUpOfMain ? renderAnswerDisplay(answer, followUp) : '-'}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            );
                          })()}
                        </div>
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
                            {exportingExcel ? 'Exporting...' : 'Export Excel'}
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
                            {generatingPDF ? 'Generating PDF...' : 'Download PDF'}
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
            <div className="text-primary-600 font-medium">Loading form details...</div>
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
