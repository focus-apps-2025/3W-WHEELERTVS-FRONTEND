import React, { useState, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Bar, Pie } from "react-chartjs-2";
import type { Question, Response } from "../../types";
import ChartTypeSelector, { ChartType } from "./ChartTypeSelector";
import MultiSelectDropdown from "./MultiSelectDropdown";

// Add feedback types to supported chart types
const CHART_SUPPORTED_TYPES = new Set([
  "radio",
  "yesNoNA",
  "checkbox",
  "radio-image",
  "search-select",
  "slider-feedback",
  "emoji-star-feedback",
]);

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  ChartDataLabels
);

interface ResponseQuestionProps {
  question: Question;
  responses: Response[];
}

export default function ResponseQuestion({
  question,
  responses,
}: ResponseQuestionProps) {
  const [chartPreferences, setChartPreferences] = useState<
    Record<string, ChartType>
  >({});
  const [filterQuestionId, setFilterQuestionId] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<string[]>([]);
  const [followUpModalData, setFollowUpModalData] = useState<{
    title: string;
    questions: FollowUpQuestion[];
  } | null>(null);

  // Get all questions from sections or fallback to followUpQuestions
  const allQuestions =
    question.sections && question.sections.length > 0
      ? question.sections.flatMap((section) => section.questions)
      : question.followUpQuestions;

  // Group questions by section if sections exist
  const getSectionGroupedQuestions = () => {
    if (!question.sections || question.sections.length === 0) {
      return null;
    }
    return question.sections.map((section) => ({
      sectionId: section.id,
      sectionTitle: section.title,
      questions: section.questions,
    }));
  };

  const sectionGroupedQuestions = getSectionGroupedQuestions();

  // Check if there's a Feedback Section
  const isFeedbackSection = sectionGroupedQuestions?.some(
    (section) => section.sectionTitle === "Feedback Section"
  );

  const getMainQuestions = (questions: any[]) => {
    return questions.filter((q: any) => !q.parentId && !q.showWhen?.questionId);
  };

  const getFollowUpQuestions = (questions: any[], mainQuestionId?: string) => {
    return questions.filter((q: any) => {
      if (mainQuestionId) {
        return (
          q.parentId === mainQuestionId ||
          q.showWhen?.questionId === mainQuestionId
        );
      }
      return q.parentId || q.showWhen?.questionId;
    });
  };

  const openFollowUpModal = (
    questionText: string,
    followUps: FollowUpQuestion[]
  ) => {
    if (followUps.length === 0) return;
    setFollowUpModalData({
      title: questionText,
      questions: followUps,
    });
  };

  const closeFollowUpModal = () => {
    setFollowUpModalData(null);
  };

  // Filter responses based on selected filters (multiple values)
  const filteredResponses = useMemo(() => {
    if (!filterQuestionId || filterValues.length === 0) return responses;
    return responses.filter((response) => {
      const answer = response.answers[filterQuestionId];
      if (Array.isArray(answer)) {
        return answer.some((item) => filterValues.includes(item));
      }
      return filterValues.includes(String(answer));
    });
  }, [responses, filterQuestionId, filterValues]);

  const getValidOptions = (options?: string[]) => {
    if (!Array.isArray(options)) return [];
    return options.filter(
      (opt) =>
        opt &&
        typeof opt === "string" &&
        opt.trim() !== "" &&
        opt.toLowerCase() !== "undefined"
    );
  };

  const primaryFilterQuestions = useMemo(() => {
    if (sectionGroupedQuestions && sectionGroupedQuestions.length > 0) {
      return sectionGroupedQuestions[0].questions;
    }
    return allQuestions || [];
  }, [sectionGroupedQuestions, allQuestions]);

  const filterableQuestions = useMemo(() => {
    return primaryFilterQuestions.filter(
      (q) => Array.isArray(q.options) && getValidOptions(q.options).length > 0
    );
  }, [primaryFilterQuestions]);

  const selectedFilterQuestion = useMemo(() => {
    if (!filterQuestionId) return null;
    return filterableQuestions.find((q) => q.id === filterQuestionId) || null;
  }, [filterQuestionId, filterableQuestions]);

  const availableFilterOptions = selectedFilterQuestion
    ? getValidOptions(selectedFilterQuestion.options)
    : [];

  const handleFilterQuestionChange = (questionId: string) => {
    setFilterQuestionId(questionId || null);
    setFilterValues([]);
  };

  const clearFilters = () => {
    setFilterQuestionId(null);
    setFilterValues([]);
  };

  const getQuestionResponses = (questionId: string) => {
    return filteredResponses
      .map((response) => response.answers[questionId])
      .filter(Boolean);
  };

  const getCorrectWrongStats = (q: Question["followUpQuestions"][0]) => {
    if (
      !q.correctAnswer &&
      (!q.correctAnswers || q.correctAnswers.length === 0)
    ) {
      return null;
    }

    let correctCount = 0;
    let wrongCount = 0;

    filteredResponses.forEach((response) => {
      const answer = response.answers[q.id];
      if (!answer) return;

      let isCorrect = false;

      // Handle multiple correct answers
      if (q.correctAnswers && q.correctAnswers.length > 0) {
        if (Array.isArray(answer)) {
          const normalizedAnswer = answer.map((a: any) =>
            String(a).toLowerCase()
          );
          const normalizedCorrect = q.correctAnswers.map((a) =>
            String(a).toLowerCase()
          );
          isCorrect =
            normalizedAnswer.length === normalizedCorrect.length &&
            normalizedAnswer.every((a) => normalizedCorrect.includes(a));
        } else {
          const normalizedAnswer = String(answer).toLowerCase();
          const normalizedCorrect = q.correctAnswers.map((a) =>
            String(a).toLowerCase()
          );
          isCorrect = normalizedCorrect.includes(normalizedAnswer);
        }
      }
      // Handle single correct answer
      else if (q.correctAnswer) {
        if (Array.isArray(answer)) {
          isCorrect = answer.some(
            (a: any) =>
              String(a).toLowerCase() === String(q.correctAnswer).toLowerCase()
          );
        } else {
          isCorrect =
            String(answer).toLowerCase() ===
            String(q.correctAnswer).toLowerCase();
        }
      }

      if (isCorrect) {
        correctCount++;
      } else {
        wrongCount++;
      }
    });

    return { correctCount, wrongCount, total: correctCount + wrongCount };
  };

  const getResponseDistribution = (questionId: string) => {
    const questionResponses = getQuestionResponses(questionId);
    const distribution: Record<string, number> = {};

    questionResponses.forEach((response) => {
      if (Array.isArray(response)) {
        response.forEach((value) => {
          distribution[value] = (distribution[value] || 0) + 1;
        });
      } else {
        distribution[response] = (distribution[response] || 0) + 1;
      }
    });

    return distribution;
  };

  // Update the categorizeFeedbackResponse function for star ratings:
  const categorizeFeedbackResponse = (
    questionType: string,
    responseValue: any
  ) => {
    if (!responseValue && responseValue !== 0) return null;

    // For slider-feedback (0-10)
    if (questionType === "slider-feedback") {
      const numValue = parseInt(responseValue);
      if (isNaN(numValue)) return null;

      if (numValue >= 9 && numValue <= 10) return "Promoter";
      if (numValue >= 5 && numValue <= 8) return "Passive";
      if (numValue >= 0 && numValue < 5) return "Detractor";
      return null;
    }

    // For emoji-star-feedback (1-5 stars)
    if (questionType === "emoji-star-feedback") {
      // Convert star emojis to numeric count
      let starCount = 0;

      if (typeof responseValue === "string") {
        // Count star emojis
        starCount = (responseValue.match(/⭐/g) || []).length;

        // Also check for numeric strings that might represent star counts
        if (starCount === 0) {
          const numValue = parseInt(responseValue);
          if (!isNaN(numValue) && numValue >= 1 && numValue <= 5) {
            starCount = numValue;
          }
        }
      } else if (typeof responseValue === "number") {
        starCount = responseValue;
      } else {
        starCount = parseInt(responseValue);
      }

      if (starCount === 0 || isNaN(starCount)) return null;

      if (starCount <= 2) return "Poor";
      if (starCount <= 4) return "Good";
      if (starCount === 5) return "Excellent";
      return null;
    }

    return null;
  };

  // Also add a debug function to see what responses are actually being received:
  const debugResponses = (questionId: string, q: any) => {
    const responses = getQuestionResponses(q.id);
    console.log(
      `Debug responses for ${q.type} question "${q.text}":`,
      responses
    );
    console.log(`Total responses: ${responses.length}`);
    console.log(
      `Response values:`,
      responses.map((r) => ({
        raw: r,
        type: typeof r,
        category: categorizeFeedbackResponse(q.type, r),
      }))
    );
  };
  const getFeedbackResponseDistribution = (q: any) => {
    const questionResponses = getQuestionResponses(q.id);
    const distribution: Record<string, number> = {};

    questionResponses.forEach((response) => {
      if (Array.isArray(response)) {
        response.forEach((value) => {
          const category = categorizeFeedbackResponse(q.type, value);
          if (category) {
            distribution[category] = (distribution[category] || 0) + 1;
          }
        });
      } else {
        const category = categorizeFeedbackResponse(q.type, response);
        if (category) {
          distribution[category] = (distribution[category] || 0) + 1;
        }
      }
    });

    return distribution;
  };

  // Calculate NPS Score
  const calculateNPSScore = (questionId: string) => {
    const questionResponses = getQuestionResponses(questionId);
    let promoterCount = 0;
    let detractorCount = 0;
    let totalResponses = 0;

    questionResponses.forEach((response) => {
      const numValue = parseInt(response);
      if (!isNaN(numValue)) {
        totalResponses++;
        if (numValue >= 9 && numValue <= 10) promoterCount++;
        if (numValue >= 0 && numValue <= 6) detractorCount++;
      }
    });

    if (totalResponses === 0) return 0;
    const npsScore = ((promoterCount - detractorCount) / totalResponses) * 100;
    return Math.round(npsScore);
  };

  const chartColors = [
    "rgba(59, 130, 246, 0.8)", // blue-500
    "rgba(16, 185, 129, 0.8)", // green-500
    "rgba(239, 68, 68, 0.8)", // red-500
    "rgba(217, 119, 6, 0.8)", // yellow-600
    "rgba(147, 51, 234, 0.8)", // purple-600
  ];

  // Colors for feedback categories
  const feedbackColors = {
    // NPS categories
    Promoter: "rgba(16, 185, 129, 0.8)", // green
    Passive: "rgba(217, 119, 6, 0.8)", // yellow
    Detractor: "rgba(239, 68, 68, 0.8)", // red

    // Star rating categories
    Excellent: "rgba(16, 185, 129, 0.8)", // green
    Good: "rgba(59, 130, 246, 0.8)", // blue
    Poor: "rgba(239, 68, 68, 0.8)", // red
  };

  const renderFeedbackQuestionChart = (q: any) => {
    const distribution = getFeedbackResponseDistribution(q);

    // Determine labels based on question type
    let labels = [];
    if (q.type === "slider-feedback") {
      labels = ["Promoter", "Passive", "Detractor"];
    } else if (q.type === "emoji-star-feedback") {
      labels = ["Poor", "Good", "Excellent"];
    }

    // Get data for each label
    const dataValues = labels.map((label) => distribution[label] || 0);

    // Check if we have any data to show
    const totalResponses = dataValues.reduce((a, b) => a + b, 0);

    if (totalResponses === 0) {
      // No responses in any category, show a message
      return (
        <div className="h-[200px] flex items-center justify-center">
          <div className="text-center">
            <svg
              className="w-12 h-12 mx-auto text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              No categorized responses available
            </p>
          </div>
        </div>
      );
    }

    const data = {
      labels: labels,
      datasets: [
        {
          data: dataValues,
          backgroundColor: labels.map(
            (label) => feedbackColors[label as keyof typeof feedbackColors]
          ),
          borderColor: "rgba(255, 255, 255, 0.1)",
          borderWidth: 1,
        },
      ],
    };

    const chartType = chartPreferences[q.id] || "bar";

    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: {
            padding: 15,
            font: {
              size: 11,
            },
            color: "rgb(107, 114, 128)",
          },
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const value = context.raw;
              const total = dataValues.reduce((a, b) => a + b, 0);
              const percentage =
                total > 0 ? ((value / total) * 100).toFixed(1) : "0";
              return `${value} responses (${percentage}%)`;
            },
          },
        },
      },
    };

    const options =
      chartType === "pie"
        ? {
            ...baseOptions,
            plugins: {
              ...baseOptions.plugins,
              datalabels: {
                formatter: (value: number, ctx: any) => {
                  // FIX: Don't show label if value is 0
                  if (value === 0) return "";

                  const total = ctx.chart.data.datasets[0].data.reduce(
                    (a: number, b: number) => a + b,
                    0
                  );
                  const percentage =
                    total > 0 ? ((value / total) * 100).toFixed(1) : "0";
                  return `${percentage}% (${value})`;
                },
                color: "white",
                font: { size: 10 },
              },
            },
          }
        : {
            ...baseOptions,
            indexAxis: "y" as const,
            plugins: {
              ...baseOptions.plugins,
              legend: {
                display: false,
              },
              datalabels: {
                anchor: "center",
                align: "center",
                formatter: (value: number, ctx: any) => {
                  // FIX: Don't show label if value is 0
                  if (value === 0) return "";

                  const total = ctx.chart.data.datasets[0].data.reduce(
                    (a: number, b: number) => a + b,
                    0
                  );
                  const percentage =
                    total > 0 ? ((value / total) * 100).toFixed(1) : "0";
                  return `${percentage}% (${value})`;
                },
                color: "white",
                font: { size: 10 },
              },
            },
            layout: {
              padding: {
                right: 40,
              },
            },
            scales: {
              x: {
                beginAtZero: true,
                grid: {
                  color: "rgba(107, 114, 128, 0.1)",
                },
                ticks: {
                  color: "rgb(107, 114, 128)",
                  font: {
                    size: 10,
                  },
                  // FIX: Remove decimal values by using integer step size
                  stepSize: 1,
                  callback: function (value: any) {
                    // Return integer values only
                    if (Number.isInteger(value)) {
                      return value;
                    }
                    return "";
                  },
                },
              },
              y: {
                grid: {
                  display: false,
                },
                ticks: {
                  color: "rgb(107, 114, 128)",
                  font: {
                    size: 10,
                  },
                },
              },
            },
          };

    return (
      <div className="h-[200px]">
        {chartType === "pie" ? (
          <Pie data={data} options={options} />
        ) : (
          <Bar data={data} options={options} />
        )}
      </div>
    );
  };

  // Also update the regular renderQuestionChart function to remove zero labels:
  const renderQuestionChart = (q: any) => {
    // If it's a feedback question in Feedback Section, use special rendering
    if (
      isFeedbackSection &&
      ["slider-feedback", "emoji-star-feedback"].includes(q.type)
    ) {
      return renderFeedbackQuestionChart(q);
    }

    // Regular chart rendering for other questions
    if (!q.options || !CHART_SUPPORTED_TYPES.has(q.type)) return null;

    const distribution = getResponseDistribution(q.id);
    const validOptions = getValidOptions(q.options);
    const correctIndex = validOptions.indexOf(q.correctAnswer);
    const data = {
      labels: validOptions,
      datasets: [
        {
          data: validOptions.map((option) => distribution[option] || 0),
          backgroundColor: validOptions.map((_, idx) =>
            idx === correctIndex
              ? "rgba(16, 185, 129, 0.8)" // green-500 for correct answer
              : chartColors[idx % chartColors.length]
          ),
          borderColor: "rgba(255, 255, 255, 0.1)",
          borderWidth: 1,
        },
      ],
    };

    const chartType = chartPreferences[q.id] || "bar";

    const baseOptions = {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: {
            padding: 15,
            font: {
              size: 11,
            },
            color: "rgb(107, 114, 128)",
          },
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const value = context.raw;
              const total = Object.values(distribution).reduce(
                (a: number, b: number) => a + b,
                0
              );
              const percentage =
                total > 0 ? ((value / total) * 100).toFixed(1) : "0";
              return `${value} responses (${percentage}%)`;
            },
          },
        },
      },
    };

    const options =
      chartType === "pie"
        ? {
            ...baseOptions,
            plugins: {
              ...baseOptions.plugins,
              datalabels: {
                formatter: (value: number, ctx: any) => {
                  // FIX: Don't show label if value is 0
                  if (value === 0) return "";

                  const total = ctx.chart.data.datasets[0].data.reduce(
                    (a: number, b: number) => a + b,
                    0
                  );
                  const percentage =
                    total > 0 ? ((value / total) * 100).toFixed(1) : "0";
                  return `${percentage}% (${value})`;
                },
                color: "white",
                font: { size: 10 },
              },
            },
          }
        : {
            ...baseOptions,
            indexAxis: "y" as const,
            plugins: {
              ...baseOptions.plugins,
              legend: {
                display: false,
              },
              datalabels: {
                anchor: "center",
                align: "center",
                formatter: (value: number, ctx: any) => {
                  // FIX: Don't show label if value is 0
                  if (value === 0) return "";

                  const total = ctx.chart.data.datasets[0].data.reduce(
                    (a: number, b: number) => a + b,
                    0
                  );
                  const percentage =
                    total > 0 ? ((value / total) * 100).toFixed(1) : "0";
                  return `${percentage}% (${value})`;
                },
                color: "white",
                font: { size: 10 },
              },
            },
            layout: {
              padding: {
                right: 40,
              },
            },
            scales: {
              x: {
                beginAtZero: true,
                grid: {
                  color: "rgba(107, 114, 128, 0.1)",
                },
                ticks: {
                  color: "rgb(107, 114, 128)",
                  font: {
                    size: 10,
                  },
                  // FIX: Remove decimal values for regular charts too
                  stepSize: 1,
                  callback: function (value: any) {
                    // Return integer values only
                    if (Number.isInteger(value)) {
                      return value;
                    }
                    return "";
                  },
                },
              },
              y: {
                grid: {
                  display: false,
                },
                ticks: {
                  color: "rgb(107, 114, 128)",
                  font: {
                    size: 10,
                  },
                },
              },
            },
          };

    return (
      <div className="h-[200px]">
        {chartType === "pie" ? (
          <Pie data={data} options={options} />
        ) : (
          <Bar data={data} options={options} />
        )}
      </div>
    );
  };

  // Also update the regular renderQuestionChart function to remove decimals:

  const handleChartTypeChange = (questionId: string, type: ChartType) => {
    setChartPreferences((prev) => ({
      ...prev,
      [questionId]: type,
    }));
  };

  const renderTextQuestionSummary = (q: any) => {
    const responses = getQuestionResponses(q.id);
    const responseCount = responses.length;

    return (
      <div className="mt-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
          Total Responses: {responseCount}
        </span>
      </div>
    );
  };

  // Calculate overall statistics
  const getOverallStats = () => {
    let totalCorrect = 0;
    let totalWrong = 0;
    let questionsWithAnswers = 0;

    allQuestions.forEach((q) => {
      const stats = getCorrectWrongStats(q);
      if (stats) {
        totalCorrect += stats.correctCount;
        totalWrong += stats.wrongCount;
        questionsWithAnswers++;
      }
    });

    const total = totalCorrect + totalWrong;
    const averageAccuracy = total > 0 ? (totalCorrect / total) * 100 : 0;

    return {
      totalCorrect,
      totalWrong,
      total,
      averageAccuracy,
      questionsWithAnswers,
    };
  };

  const overallStats = useMemo(
    () => getOverallStats(),
    [allQuestions, filteredResponses]
  );

  // Render overview chart showing all questions
  const renderOverviewChart = () => {
    const questionsWithStats = allQuestions
      .map((q) => ({
        question: q,
        stats: getCorrectWrongStats(q),
      }))
      .filter((item) => item.stats && item.stats.total > 0);

    if (questionsWithStats.length === 0) return null;

    const labels = questionsWithStats.map(
      (item, index) =>
        `Q${index + 1}: ${
          item.question.text.length > 50
            ? item.question.text.substring(0, 50) + "..."
            : item.question.text
        }`
    );

    const correctData = questionsWithStats.map(
      (item) => (item.stats!.correctCount / item.stats!.total) * 100
    );

    const wrongData = questionsWithStats.map(
      (item) => (item.stats!.wrongCount / item.stats!.total) * 100
    );

    const data = {
      labels,
      datasets: [
        {
          label: "Correct",
          data: correctData,
          backgroundColor: "rgba(16, 185, 129, 0.9)", // green
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 1,
        },
        {
          label: "Wrong",
          data: wrongData,
          backgroundColor: "rgba(239, 68, 68, 0.9)", // red
          borderColor: "rgba(239, 68, 68, 1)",
          borderWidth: 1,
        },
      ],
    };

    const options = {
      indexAxis: "y" as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "bottom" as const,
          labels: {
            padding: 15,
            font: {
              size: 12,
            },
            color: "rgb(107, 114, 128)",
            usePointStyle: true,
            pointStyle: "circle",
          },
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const label = context.dataset.label || "";
              const value = context.parsed.x.toFixed(1);
              const questionIndex = context.dataIndex;
              const stats = questionsWithStats[questionIndex].stats!;
              const count =
                label === "Correct" ? stats.correctCount : stats.wrongCount;
              return `${label}: ${value}% (${count} responses)`;
            },
            title: (context: any) => {
              const questionIndex = context[0].dataIndex;
              return questionsWithStats[questionIndex].question.text;
            },
          },
        },
        datalabels: {
          formatter: (value: number, ctx: any) => {
            if (value < 8) return ""; // Don't show label if too small
            return `${value.toFixed(1)}%`;
          },
          color: "white",
          font: {
            size: 11,
            weight: "bold" as const,
          },
          anchor: "center" as const,
          align: "center" as const,
        },
      },
      scales: {
        x: {
          stacked: true,
          beginAtZero: true,
          max: 100,
          grid: {
            color: "rgba(107, 114, 128, 0.1)",
          },
          ticks: {
            color: "rgb(107, 114, 128)",
            callback: (value: any) => `${value}%`,
          },
        },
        y: {
          stacked: true,
          grid: {
            display: false,
          },
          ticks: {
            color: "rgb(107, 114, 128)",
            font: {
              size: 11,
            },
          },
        },
      },
    };

    const chartHeight = Math.max(400, questionsWithStats.length * 40);

    return (
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
        <h5 className="text-md font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <svg
            className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
          </svg>
          Questions Overview - Correct vs Wrong Answers
        </h5>
        <div style={{ height: `${chartHeight}px` }}>
          <Bar data={data} options={options} />
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
          Response Distribution by Question
        </h4>
        {filterValues.length > 0 && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {filteredResponses.length} of {responses.length} responses
          </div>
        )}
      </div>

      {false && filterableQuestions.length > 0 && (
        <div className="mb-6 bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Question
              </label>
              <select
                value={filterQuestionId || ""}
                onChange={(e) => handleFilterQuestionChange(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Questions</option>
                {filterableQuestions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.text}
                  </option>
                ))}
              </select>
            </div>
            <div>
              {selectedFilterQuestion ? (
                <MultiSelectDropdown
                  options={availableFilterOptions}
                  selectedValues={filterValues}
                  onChange={(values) => {
                    setFilterQuestionId(selectedFilterQuestion.id);
                    setFilterValues(values);
                  }}
                  placeholder={`Filter by ${selectedFilterQuestion.text}...`}
                  label="Filter Options"
                />
              ) : (
                <div className="h-full flex items-center justify-center px-4 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-500 dark:text-gray-400">
                  Select a question to enable filters
                </div>
              )}
            </div>
          </div>
          {(filterQuestionId || filterValues.length > 0) && (
            <div className="flex flex-wrap items-center gap-3">
              {filterQuestionId && selectedFilterQuestion && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Filtering by{" "}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {selectedFilterQuestion.text}
                  </span>
                </span>
              )}
              {filterValues.length > 0 && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-1 text-sm bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50"
                >
                  Clear Filter
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Overall Statistics Summary */}
      {overallStats.questionsWithAnswers > 0 && (
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600 rounded-lg p-6 border border-blue-200 dark:border-gray-600">
          <h5 className="text-md font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <svg
              className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
            Overall Quiz Statistics
          </h5>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {overallStats.questionsWithAnswers}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Quiz Questions
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {overallStats.totalCorrect}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Total Correct
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {overallStats.totalWrong}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Total Wrong
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {overallStats.averageAccuracy.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Average Accuracy
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overview Chart */}
      {renderOverviewChart()}

      {sectionGroupedQuestions ? (
        <div className="space-y-8">
          {sectionGroupedQuestions.map((section, sectionIndex) => {
            const isThisFeedbackSection =
              section.sectionTitle === "Feedback Section";

            return (
              <div key={section.sectionId} className="space-y-4">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-4 shadow-md">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xl font-bold text-white flex items-center">
                      <svg
                        className="w-6 h-6 mr-2"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6z" />
                      </svg>
                      {section.sectionTitle}
                    </h4>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {getMainQuestions(section.questions).map((q) => {
                      // For Feedback Section questions, check if they are feedback types
                      // For other sections, check regular chart support
                      const shouldRenderChart = isThisFeedbackSection
                        ? ["slider-feedback", "emoji-star-feedback"].includes(
                            q.type
                          )
                        : Array.isArray(q.options) &&
                          q.options.length > 0 &&
                          CHART_SUPPORTED_TYPES.has(q.type);

                      const responses = getQuestionResponses(q.id);
                      const responseCount = responses.length;
                      const stats = getCorrectWrongStats(q);
                      const followUps = getFollowUpQuestions(
                        section.questions,
                        q.id
                      );

                      return (
                        <div
                          key={q.id}
                          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 flex flex-col h-full"
                        >
                          <div className="flex justify-between items-start mb-4 gap-4">
                            <div className="flex-1">
                              <h5 className="text-lg font-medium text-gray-900 dark:text-white">
                                {q.text}
                              </h5>
                              {q.description && (
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                  {q.description}
                                </p>
                              )}

                              {/* Show NPS Score for slider-feedback in Feedback Section */}
                              {isThisFeedbackSection &&
                                q.type === "slider-feedback" && (
                                  <div className="mt-2">
                                    <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                                      NPS Score: {calculateNPSScore(q.id)}
                                    </p>
                                  </div>
                                )}

                              {(q.correctAnswer ||
                                (q.correctAnswers &&
                                  q.correctAnswers.length > 0)) && (
                                <div className="mt-2">
                                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                                    Correct Answer
                                    {q.correctAnswers &&
                                    q.correctAnswers.length > 1
                                      ? "s"
                                      : ""}
                                    :{" "}
                                    {q.correctAnswers &&
                                    q.correctAnswers.length > 0
                                      ? q.correctAnswers.join(", ")
                                      : q.correctAnswer}
                                  </p>
                                </div>
                              )}

                              {stats && (
                                <div className="mt-3 flex items-center space-x-4">
                                  <div className="flex items-center space-x-2">
                                    <div className="flex items-center bg-green-100 dark:bg-green-900 px-3 py-1 rounded-full">
                                      <svg
                                        className="w-4 h-4 text-green-600 dark:text-green-400 mr-1"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                      <span className="text-sm font-semibold text-green-700 dark:text-green-300">
                                        {stats.correctCount} Correct
                                      </span>
                                    </div>
                                    <div className="flex items-center bg-red-100 dark:bg-red-900 px-3 py-1 rounded-full">
                                      <svg
                                        className="w-4 h-4 text-red-600 dark:text-red-400 mr-1"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                      <span className="text-sm font-semibold text-red-700 dark:text-red-300">
                                        {stats.wrongCount} Wrong
                                      </span>
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                      (
                                      {(
                                        (stats.correctCount / stats.total) *
                                        100
                                      ).toFixed(1)}
                                      % accuracy)
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center space-x-4">
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                {responseCount} responses
                              </span>
                              {shouldRenderChart && (
                                <ChartTypeSelector
                                  value={chartPreferences[q.id] || "bar"}
                                  onChange={(type) =>
                                    handleChartTypeChange(q.id, type)
                                  }
                                />
                              )}
                            </div>
                          </div>

                          <div className="flex-1">
                            {shouldRenderChart
                              ? renderQuestionChart(q)
                              : renderTextQuestionSummary(q)}
                          </div>

                          {followUps.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                              <button
                                onClick={() =>
                                  openFollowUpModal(q.text, followUps)
                                }
                                className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
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
                                    d="M12 5v14m7-7H5"
                                  />
                                </svg>
                                View Follow-ups ({followUps.length})
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {getMainQuestions(allQuestions).map((q) => {
              const shouldRenderChart =
                Array.isArray(q.options) &&
                q.options.length > 0 &&
                CHART_SUPPORTED_TYPES.has(q.type);
              const responses = getQuestionResponses(q.id);
              const responseCount = responses.length;
              const stats = getCorrectWrongStats(q);
              const followUps = getFollowUpQuestions(allQuestions, q.id);

              return (
                <div
                  key={q.id}
                  className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 flex flex-col h-full"
                >
                  <div className="flex justify-between items-start mb-4 gap-4">
                    <div className="flex-1">
                      <h5 className="text-lg font-medium text-gray-900 dark:text-white">
                        {q.text}
                      </h5>
                      {q.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {q.description}
                        </p>
                      )}

                      {(q.correctAnswer ||
                        (q.correctAnswers && q.correctAnswers.length > 0)) && (
                        <div className="mt-2">
                          <p className="text-sm font-medium text-green-600 dark:text-green-400">
                            Correct Answer
                            {q.correctAnswers && q.correctAnswers.length > 1
                              ? "s"
                              : ""}
                            :{" "}
                            {q.correctAnswers && q.correctAnswers.length > 0
                              ? q.correctAnswers.join(", ")
                              : q.correctAnswer}
                          </p>
                        </div>
                      )}

                      {stats && (
                        <div className="mt-3 flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center bg-green-100 dark:bg-green-900 px-3 py-1 rounded-full">
                              <svg
                                className="w-4 h-4 text-green-600 dark:text-green-400 mr-1"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <span className="text-sm font-semibold text-green-700 dark:text-green-300">
                                {stats.correctCount} Correct
                              </span>
                            </div>
                            <div className="flex items-center bg-red-100 dark:bg-red-900 px-3 py-1 rounded-full">
                              <svg
                                className="w-4 h-4 text-red-600 dark:text-red-400 mr-1"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <span className="text-sm font-semibold text-red-700 dark:text-red-300">
                                {stats.wrongCount} Wrong
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              (
                              {(
                                (stats.correctCount / stats.total) *
                                100
                              ).toFixed(1)}
                              % accuracy)
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {responseCount} responses
                      </span>
                      {shouldRenderChart && (
                        <ChartTypeSelector
                          value={chartPreferences[q.id] || "bar"}
                          onChange={(type) => handleChartTypeChange(q.id, type)}
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex-1">
                    {shouldRenderChart
                      ? renderQuestionChart(q)
                      : renderTextQuestionSummary(q)}
                  </div>

                  {followUps.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => openFollowUpModal(q.text, followUps)}
                        className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
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
                            d="M12 5v14m7-7H5"
                          />
                        </svg>
                        View Follow-ups ({followUps.length})
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {getMainQuestions(allQuestions).length === 0 && (
            <p className="lg:col-span-2 text-center text-gray-500 dark:text-gray-400 py-4">
              No questions available for analysis
            </p>
          )}
        </div>
      )}

      {followUpModalData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={closeFollowUpModal}
        >
          <div
            className="w-full max-w-6xl max-h-[90vh] overflow-hidden bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h5 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Follow-up Questions
                </h5>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Parent Question: {followUpModalData.title}
                </p>
              </div>
              <button
                onClick={closeFollowUpModal}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
              >
                <svg
                  className="w-5 h-5"
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
            <div className="px-6 py-6 overflow-y-auto max-h-[80vh] space-y-6">
              {renderFollowUpCards(followUpModalData.questions)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
