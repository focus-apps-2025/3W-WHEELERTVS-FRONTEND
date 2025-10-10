import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { Question, Response } from '../../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface GridResponseChartProps {
  question: Question;
  responses: Response[];
  isDarkMode?: boolean;
}

export default function GridResponseChart({ question, responses, isDarkMode = false }: GridResponseChartProps) {
  // Get all questions that have grid options
  const gridQuestions = question.followUpQuestions.filter(
    q => q.type === 'radio-grid' || q.type === 'checkbox-grid'
  );

  if (gridQuestions.length === 0) return null;

  const chartColors = [
    'rgba(59, 130, 246, 0.8)',   // blue-500
    'rgba(16, 185, 129, 0.8)',   // green-500
    'rgba(239, 68, 68, 0.8)',    // red-500
    'rgba(217, 119, 6, 0.8)',    // yellow-600
    'rgba(147, 51, 234, 0.8)',   // purple-600
  ];

  return (
    <div className="space-y-8">
      {gridQuestions.map(gridQuestion => {
        if (!gridQuestion.gridOptions) return null;
        const { rows, columns } = gridQuestion.gridOptions;

        // Create a separate chart for each column
        return (
          <div key={gridQuestion.id} className="border-b dark:border-gray-700 pb-8 last:border-0">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
              {gridQuestion.text}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {columns.map((column, columnIndex) => {
                // Count responses for each row for this column
                const rowData = rows.map(row => {
                  const count = responses.filter(response => {
                    const answer = response.answers[gridQuestion.id];
                    if (!answer || typeof answer !== 'object') return false;
                    return answer[row] === column;
                  }).length;
                  return count;
                });

                const chartData = {
                  labels: rows,
                  datasets: [
                    {
                      label: column,
                      data: rowData,
                      backgroundColor: chartColors[columnIndex % chartColors.length],
                      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      borderWidth: 1,
                    },
                  ],
                };

                const options = {
                  responsive: true,
                  maintainAspectRatio: false,
                  indexAxis: 'y' as const,
                  plugins: {
                    title: {
                      display: true,
                      text: column,
                      color: isDarkMode ? '#e5e7eb' : '#374151',
                      font: {
                        size: 14,
                        weight: 'bold' as const,
                      },
                      padding: 20,
                    },
                    legend: {
                      display: false,
                    },
                    tooltip: {
                      backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                      titleColor: isDarkMode ? '#e5e7eb' : '#111827',
                      bodyColor: isDarkMode ? '#e5e7eb' : '#374151',
                      borderColor: isDarkMode ? '#4b5563' : '#e5e7eb',
                      borderWidth: 1,
                      padding: 12,
                      callbacks: {
                        label: (context: any) => {
                          const value = context.raw;
                          const total = responses.length;
                          const percentage = ((value / total) * 100).toFixed(1);
                          return `${value} responses (${percentage}%)`;
                        },
                      },
                    },
                  },
                  scales: {
                    x: {
                      beginAtZero: true,
                      grid: {
                        color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      },
                      ticks: {
                        color: isDarkMode ? '#e5e7eb' : '#374151',
                        font: {
                          size: 12,
                        },
                      },
                    },
                    y: {
                      grid: {
                        display: false,
                      },
                      ticks: {
                        color: isDarkMode ? '#e5e7eb' : '#374151',
                        font: {
                          size: 12,
                        },
                      },
                    },
                  },
                };

                return (
                  <div key={column} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                    <div className="h-[300px]">
                      <Bar data={chartData} options={options} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}