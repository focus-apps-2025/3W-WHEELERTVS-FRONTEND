import React, { useState, useEffect, useMemo } from "react";
import {
  Eye,
  Calendar,
  FileText,
  User,
  TrendingUp,
  BarChart3,
  PieChart,
  Activity,
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
import { apiClient } from "../../api/client";
import { formatTimestamp } from "../../utils/dateUtils";
import { useNotification } from "../../context/NotificationContext";

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
  ArcElement
);

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

type SectionStat = {
  id: string;
  title: string;
  yes: number;
  no: number;
  na: number;
  total: number;
};

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

export default function Section1Responses() {
  const { showError } = useNotification();
  const [responses, setResponses] = useState<
    (Response & { formTitle: string })[]
  >([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSection1Data();
  }, []);

  const fetchSection1Data = async () => {
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
      setForms(formsData.forms);
    } catch (err) {
      console.error("Failed to load section 1 data:", err);
      setError(err instanceof Error ? err.message : "Failed to load responses");
      showError("Failed to load section 1 responses");
    } finally {
      setLoading(false);
    }
  };

  // Filter responses that have section 1 data
  const section1Responses = useMemo(() => {
    return responses.filter((response) => {
      // Find the form for this response
      const form = forms.find((f) => f._id === response.questionId || f.id === response.questionId);
      if (!form?.sections || form.sections.length === 0) return false;

      // Check if section 1 (index 0) has any answers
      const section1 = form.sections[0];
      const section1Questions = section1.questions || [];
      const hasSection1Answers = section1Questions.some((q: any) =>
        response.answers.hasOwnProperty(q.id)
      );

      return hasSection1Answers;
    });
  }, [responses, forms]);

  const section1Stats = useMemo(() => {
    if (section1Responses.length === 0) return null;

    let totalResponses = 0;
    let totalYes = 0;
    let totalNo = 0;
    let totalNA = 0;

    section1Responses.forEach((response) => {
      const form = forms.find((f) => f._id === response.questionId || f.id === response.questionId);
      if (!form?.sections || form.sections.length === 0) return;

      const section1 = form.sections[0];
      const stats = getSectionYesNoStats(form, response.answers);
      const section1Stat = stats.find((stat) => stat.id === section1.id);

      if (section1Stat) {
        totalResponses++;
        totalYes += section1Stat.yes;
        totalNo += section1Stat.no;
        totalNA += section1Stat.na;
      }
    });

    return {
      totalResponses,
      totalYes,
      totalNo,
      totalNA,
      avgYes: totalResponses > 0 ? (totalYes / totalResponses).toFixed(1) : "0",
      avgNo: totalResponses > 0 ? (totalNo / totalResponses).toFixed(1) : "0",
      avgNA: totalResponses > 0 ? (totalNA / totalResponses).toFixed(1) : "0",
    };
  }, [section1Responses, forms]);

  const chartData = useMemo(() => {
    if (!section1Stats) return null;

    return {
      labels: ['Yes', 'No', 'N/A'],
      datasets: [{
        data: [section1Stats.totalYes, section1Stats.totalNo, section1Stats.totalNA],
        backgroundColor: ['#1d4ed8', '#3b82f6', '#93c5fd'],
        borderColor: ['#1e40af', '#2563eb', '#60a5fa'],
        borderWidth: 2,
      }],
    };
  }, [section1Stats]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: {
            color: document.documentElement.classList.contains('dark') ? '#d1d5db' : '#374151',
          },
        },
        tooltip: {
          callbacks: {
            label: (context: any) => `${context.label}: ${context.parsed}%`
          }
        }
      },
    }),
    []
  );

  function collectYesNoQuestions(form: Form): any[] {
    const questions: any[] = [];

    const processQuestion = (question: any) => {
      if (!question) {
        return;
      }
      if (question.type === "yesNoNA" && question.id) {
        questions.push(question);
      }
      question.followUpQuestions?.forEach(processQuestion);
    };

    form.sections?.forEach((section) => {
      section.questions?.forEach(processQuestion);
    });

    form.followUpQuestions?.forEach(processQuestion);

    return questions;
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
    const questions = collectYesNoQuestions(form);
    if (!questions.length) {
      return undefined;
    }

    let yesCount = 0;

    questions.forEach((q) => {
      const answer = answers?.[q.id];
      if (answer === null || answer === undefined || answer === "") {
        return;
      }

      const normalizedValues = extractYesNoValues(answer);
      const options = q.options || [];

      if (options.length >= 3) {
        const yesOption = String(options[0]).toLowerCase().trim();
        if (normalizedValues.includes(yesOption)) {
          yesCount += 1;
        }
      } else {
        if (normalizedValues.includes("yes")) {
          yesCount += 1;
        }
      }
    });

    return {
      yes: yesCount,
      total: questions.length,
    };
  }

  function getSectionYesNoStats(
    form: Form,
    answers: Record<string, any>
  ): SectionStat[] {
    const stats =
      form.sections?.map((section: any) => {
        const counts = { yes: 0, no: 0, na: 0, total: 0 };

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
        };
      }) ?? [];

    return stats.filter((stat): stat is SectionStat => Boolean(stat));
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mx-auto mb-4">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Loading Section 1 Responses
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Fetching your latest data...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-50 dark:bg-red-900/30 rounded-lg flex items-center justify-center mx-auto mb-4">
              <div className="w-6 h-6 text-red-500">⚠️</div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Error Loading Data
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!section1Stats || section1Responses.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              No Section 1 Responses Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Section 1 responses will appear here once customers start submitting forms.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Section 1 Responses Overview
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Complete analysis of all responses for section 1 across all forms
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {section1Stats.totalResponses}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wide">
            Total Responses
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-300">Average Yes</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">{section1Stats.avgYes}</p>
            </div>
            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-300">Average No</p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-100">{section1Stats.avgNo}</p>
            </div>
            <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Average N/A</p>
              <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{section1Stats.avgNA}</p>
            </div>
            <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
              <PieChart className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Chart and Recent Responses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
            <PieChart className="w-5 h-5 mr-2" />
            Response Distribution
          </h3>
          <div className="w-full h-64">
            {chartData && <Pie data={chartData} options={chartOptions} />}
          </div>
        </div>

        {/* Recent Responses */}
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Recent Section 1 Responses
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {section1Responses.slice(0, 5).map((response) => (
              <div
                key={response.id}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                    {response.formTitle}
                  </h4>
                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-500 mt-1">
                    <Calendar className="w-3 h-3 mr-1" />
                    {formatTimestamp(response.createdAt)}
                  </div>
                </div>
                <div className="text-right">
                  {response.yesNoScore && (
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {response.yesNoScore.yes}/{response.yesNoScore.total} Yes
                    </div>
                  )}
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    Score
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}