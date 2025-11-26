import React, { useState } from "react";
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

  // Get all questions from sections or fallback to followUpQuestions
  const allQuestions =
    question.sections && question.sections.length > 0
      ? question.sections.flatMap((section) => section.questions)
      : question.followUpQuestions;

  const getQuestionResponses = (questionId: string) => {
    return responses
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

    responses.forEach((response) => {
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

  const chartColors = [
    "rgba(59, 130, 246, 0.8)", // blue-500
    "rgba(16, 185, 129, 0.8)", // green-500
    "rgba(239, 68, 68, 0.8)", // red-500
    "rgba(217, 119, 6, 0.8)", // yellow-600
    "rgba(147, 51, 234, 0.8)", // purple-600
  ];

  const renderQuestionChart = (q: Question["followUpQuestions"][0]) => {
    if (!q.options) return null;

    const distribution = getResponseDistribution(q.id);
    const validOptions = q.options.filter(
      (option) =>
        option &&
        typeof option === "string" &&
        option.trim() !== "" &&
        option.toLowerCase() !== "undefined"
    );
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
              const percentage = ((value / total) * 100).toFixed(1);
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
                formatter: (value, ctx) => {
                  const total = ctx.chart.data.datasets[0].data.reduce(
                    (a, b) => a + b,
                    0
                  );
                  const percentage = ((value / total) * 100).toFixed(1);
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
                formatter: (value, ctx) => {
                  const total = ctx.chart.data.datasets[0].data.reduce(
                    (a, b) => a + b,
                    0
                  );
                  const percentage = ((value / total) * 100).toFixed(1);
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

  const handleChartTypeChange = (questionId: string, type: ChartType) => {
    setChartPreferences((prev) => ({
      ...prev,
      [questionId]: type,
    }));
  };

  const renderTextQuestionSummary = (q: Question["followUpQuestions"][0]) => {
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

  const overallStats = getOverallStats();

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
      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Response Distribution by Question,
      </h4>

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

      <div className="space-y-8">
        {allQuestions.map((q) => {
          const isTextQuestion = q.type === "text" || q.type === "paragraph";
          const responses = getQuestionResponses(q.id);
          const responseCount = responses.length;
          const stats = getCorrectWrongStats(q);

          return (
            <div
              key={q.id}
              className="border-b dark:border-gray-700 pb-8 last:border-0"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h5 className="text-lg font-medium text-gray-900 dark:text-white">
                    {q.text}
                  </h5>
                  {q.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {q.description}
                    </p>
                  )}

                  {/* Display correct answer(s) */}
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

                  {/* Display correct/wrong statistics */}
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
                          {((stats.correctCount / stats.total) * 100).toFixed(
                            1
                          )}
                          % accuracy)
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-4 ml-4">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {responseCount} responses
                  </span>
                  {!isTextQuestion && q.options && (
                    <ChartTypeSelector
                      value={chartPreferences[q.id] || "bar"}
                      onChange={(type) => handleChartTypeChange(q.id, type)}
                    />
                  )}
                </div>
              </div>

              {isTextQuestion ? (
                renderTextQuestionSummary(q)
              ) : (
                renderQuestionChart(q)
              )}
            </div>
          );
        })}

        {allQuestions.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-4">
            No questions available for analysis
          </p>
        )}
      </div>
    </div>
  );
}
