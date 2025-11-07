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
  Mail,
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
import { sendResponseExcelViaEmail } from "../utils/responseExportUtils";

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
  sections?: any[];
  followUpQuestions?: any[];
}

interface Response {
  _id: string;
  id: string;
  questionId: string;
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
  const { showSuccess, showError, showInfo } = useNotification();
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
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
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
      const formData = await apiClient.getForm(response.questionId);
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
      // Update the local state
      setResponses((prev) =>
        prev.map((r) =>
          r._id === responseId ? { ...r, status: newStatus } : r
        )
      );
      if (selectedResponse && selectedResponse._id === responseId) {
        setSelectedResponse({ ...selectedResponse, status: newStatus });
        setShowStatusUpdate(false); // Hide the update options after successful update
      }
      showSuccess(`Status updated to ${getStatusInfo(newStatus).label}`);
    } catch (err) {
      console.error("Failed to update status:", err);
      showError("Failed to update status. Please try again.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSendToMail = () => {
    setShowEmailDialog(true);
    setEmailInput("");
  };

  const handleSendEmailReport = async () => {
    if (!emailInput.trim()) {
      showError("Please enter an email address");
      return;
    }

    if (!selectedResponse || !selectedForm || sectionSummaryRows.length === 0) {
      showError("Missing required data for report generation");
      return;
    }

    setSendingEmail(true);
    try {
      const result = await sendResponseExcelViaEmail(
        selectedResponse,
        selectedForm,
        sectionSummaryRows,
        emailInput.trim()
      );

      if (result.success) {
        showSuccess("Report sent successfully to " + emailInput);
        setShowEmailDialog(false);
        setEmailInput("");
      } else if (result.fallback) {
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${selectedForm.title}_Report.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const mailtoLink = `mailto:${emailInput}?subject=Response Report: ${selectedForm.title}&body=Please find the attached response report.`;
        window.open(mailtoLink);

        showSuccess("Report downloaded. Opening your mail client...");
        setShowEmailDialog(false);
        setEmailInput("");
      }
    } catch (err) {
      console.error("Failed to send email:", err);
      showError("Failed to send email. Please try again.");
    } finally {
      setSendingEmail(false);
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
            color: "#0f172a",
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
            color: "#0f172a",
          },
          title: {
            display: true,
            text: "Percentage",
            color: "#0f172a",
          },
        },
        y: {
          stacked: true,
          ticks: {
            autoSkip: false,
            color: "#0f172a",
          },
          title: {
            display: true,
            text: "Sections",
            color: "#0f172a",
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
            color: "#0f172a",
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
            color: "#0f172a",
          },
          title: {
            display: true,
            text: "Weighted Percentage",
            color: "#0f172a",
          },
        },
        x: {
          ticks: {
            autoSkip: false,
            color: "#0f172a",
          },
          title: {
            display: true,
            text: "Sections",
            color: "#0f172a",
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

  const renderAnswerDisplay = (value: any): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-primary-400">No response</span>;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? trimmed : <span className="text-primary-400">No response</span>;
    }
    if (Array.isArray(value)) {
      return value.length
        ? value.join(", ")
        : <span className="text-primary-400">No response</span>;
    }
    if (typeof value === "object") {
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
                <div key={question.id} className="p-4">
                  <div className="font-medium text-primary-700">
                    {question.text || question.id}
                  </div>
                  <div className="mt-1 text-primary-600">
                    {renderAnswerDisplay(answer)}
                  </div>
                  {question.followUpQuestions?.map((followUp: any) => {
                    const followAnswer = selectedResponse.answers[followUp.id];
                    if (!hasAnswerValue(followAnswer)) {
                      return null;
                    }
                    answeredKeys.add(followUp.id);
                    return (
                      <div
                        key={followUp.id}
                        className="mt-3 pl-4 border-l border-primary-100"
                      >
                        <div className="text-sm font-medium text-primary-600">
                          {followUp.text || followUp.id}
                        </div>
                        <div className="mt-1 text-sm text-primary-600">
                          {renderAnswerDisplay(followAnswer)}
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
          className="border border-primary-100 rounded-lg overflow-hidden"
        >
          <div className="px-4 py-3 bg-primary-50">
            <div className="text-base font-semibold text-primary-700">
              Form Follow-up Questions
            </div>
          </div>
          <div className="divide-y divide-primary-100">
            {selectedForm.followUpQuestions.map((followUp: any) => {
              answeredKeys.add(followUp.id);
              const answer = selectedResponse.answers[followUp.id];

              return (
                <div key={followUp.id} className="p-4">
                  <div className="font-medium text-primary-700">
                    {followUp.text || followUp.id}
                  </div>
                  <div className="mt-1 text-primary-600">
                    {renderAnswerDisplay(answer)}
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
                {groupedResponses[date].map((response) => (
                  <div
                    key={response._id}
                    className="flex items-center justify-between p-4 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-white rounded-lg">
                        <FileText className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-primary-700">
                            {response.formTitle}
                          </h4>
                          {response.yesNoScore && response.yesNoScore.total > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold text-green-700 bg-green-50 border border-green-100">
                              {response.yesNoScore.yes}/{response.yesNoScore.total}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center text-sm text-primary-500 mt-1">
                          <User className="w-4 h-4 mr-1" />
                          <span>
                            Submitted {formatTimestamp(response.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleViewDetails(response)}
                      className="btn-secondary flex items-center"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

        {responses.length === 0 && (
          <div className="text-center py-16 card">
            <div className="p-4 bg-primary-50 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <FileText className="w-10 h-10 text-primary-600" />
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
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[80vh] flex flex-col">
            <div className="sticky top-0 z-10 bg-white px-6 py-4 border-b border-primary-200 flex justify-between items-center">
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
                  onClick={handleSendToMail}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  title="Send to Mail"
                >
                  <Mail className="w-4 h-4" />
                  Send to Mail
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
                    <div className="sticky top-0 z-20 bg-white flex items-center gap-2 bg-primary-50 rounded-lg p-2 mb-4">
                      <button
                        onClick={() => setViewMode("dashboard")}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                          viewMode === "dashboard"
                            ? "bg-primary-600 text-white"
                            : "text-primary-600 hover:bg-primary-100"
                        }`}
                      >
                        Dashboard
                      </button>
                      <button
                        onClick={() => setViewMode("responses")}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                          viewMode === "responses"
                            ? "bg-primary-600 text-white"
                            : "text-primary-600 hover:bg-primary-100"
                        }`}
                      >
                        Responses
                      </button>
                    </div>

                    {viewMode === "dashboard" && filteredSectionStats.length > 0 && (
                    <div className="space-y-6">
                      <div className="w-full" style={{ height: sectionChartHeight }}>
                        <Bar
                          data={sectionChartData}
                          options={{
                            ...sectionChartOptions,
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
                      <div className="overflow-x-auto rounded-lg border border-primary-100">
                        <table className="w-full divide-y divide-primary-100 text-sm table-fixed">
                          <thead className="bg-primary-50 sticky top-0">
                            <tr>
                              <th className="px-4 py-3 text-left font-medium text-primary-600 w-32">
                                Section
                              </th>
                              <th className="px-4 py-3 text-center font-medium text-primary-600 w-20">
                                Yes %
                              </th>
                              <th className="px-4 py-3 text-center font-medium text-primary-600 w-20">
                                No %
                              </th>
                              <th className="px-4 py-3 text-center font-medium text-primary-600 w-20">
                                N/A %
                              </th>
                              <th className="px-4 py-3 text-center font-medium text-primary-600 w-24">
                                Weightage
                              </th>
                              <th className="px-4 py-3 text-center font-medium text-primary-600 w-28">
                                Yes % × Weightage
                              </th>
                              <th className="px-4 py-3 text-center font-medium text-primary-600 w-28">
                                No % × Weightage
                              </th>
                              <th className="px-4 py-3 text-center font-medium text-primary-600 w-28">
                                N/A % × Weightage
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-primary-100 bg-white">
                            {sectionSummaryRows.map((row) => (
                              <tr key={row.id} className="hover:bg-primary-50">
                                <td className="px-4 py-3 font-medium text-primary-700 w-32">
                                  {row.title}
                                </td>
                                <td className="px-4 py-3 text-center text-primary-600 w-20">
                                  {formatPercentageValue(row.yesPercent)}
                                </td>
                                <td className="px-4 py-3 text-center text-primary-600 w-20">
                                  {formatPercentageValue(row.noPercent)}
                                </td>
                                <td className="px-4 py-3 text-center text-primary-600 w-20">
                                  {formatPercentageValue(row.naPercent)}
                                </td>
                                <td className="px-4 py-3 text-center text-primary-600 w-24">
                                  {formatPercentageValue(row.weightage)}
                                </td>
                                <td className="px-4 py-3 text-center text-primary-600 w-28">
                                  {formatPercentageValue(row.yesWeighted)}
                                </td>
                                <td className="px-4 py-3 text-center text-primary-600 w-28">
                                  {formatPercentageValue(row.noWeighted)}
                                </td>
                                <td className="px-4 py-3 text-center text-primary-600 w-28">
                                  {formatPercentageValue(row.naWeighted)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-8">
                        <h3 className="text-lg font-semibold text-primary-700 mb-4">
                          Section-wise Weighted Percentages
                        </h3>
                        <div className="w-full" style={{ height: weightedChartHeight }}>
                          <Line
                            data={weightedPercentageChartData}
                            options={weightedPercentageChartOptions}
                          />
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

      {showEmailDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full m-4">
            <div className="px-6 py-4 border-b border-primary-200">
              <h3 className="text-lg font-semibold text-primary-700">
                Send Report via Email
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>From:</strong> priyaraj@focusengineering.in (System Email)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  Recipient Email Address
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full px-3 py-2 border border-primary-200 rounded-lg text-primary-700 placeholder-primary-400 focus:outline-none focus:border-primary-600"
                  disabled={sendingEmail}
                />
              </div>
              <div className="bg-primary-50 p-3 rounded-lg">
                <p className="text-sm text-primary-600">
                  An Excel file with dashboard data and response details will be sent.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-primary-200 flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowEmailDialog(false);
                  setEmailInput("");
                }}
                disabled={sendingEmail}
                className="px-4 py-2 text-sm font-medium text-primary-700 bg-primary-100 rounded-lg hover:bg-primary-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmailReport}
                disabled={sendingEmail || !emailInput.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
              >
                {sendingEmail ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Send Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
