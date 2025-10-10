import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import type { FollowUpQuestion } from '../../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

interface QuestionChartProps {
  question: FollowUpQuestion;
  responses: any[];
  isDarkMode?: boolean;
}

export default function QuestionChart({ question, responses, isDarkMode = false }: QuestionChartProps) {
  if (!question.options) return null;

  const data = question.options.map(option => {
    return responses.filter(r => 
      Array.isArray(r) ? r.includes(option) : r === option
    ).length;
  });

  const chartColors = [
    'rgba(59, 130, 246, 0.8)',   // blue-500
    'rgba(16, 185, 129, 0.8)',   // green-500
    'rgba(239, 68, 68, 0.8)',    // red-500
    'rgba(217, 119, 6, 0.8)',    // yellow-600
    'rgba(147, 51, 234, 0.8)',   // purple-600
    'rgba(14, 165, 233, 0.8)',   // sky-500
  ];

  const chartData = {
    labels: question.options,
    datasets: [
      {
        data,
        backgroundColor: chartColors,
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: isDarkMode ? '#e5e7eb' : '#374151',
          padding: 20,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: isDarkMode ? '#374151' : '#ffffff',
        titleColor: isDarkMode ? '#e5e7eb' : '#111827',
        bodyColor: isDarkMode ? '#e5e7eb' : '#374151',
        borderColor: isDarkMode ? '#4b5563' : '#e5e7eb',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        callbacks: {
          label: (context: any) => {
            const value = context.raw;
            const total = data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${value} responses (${percentage}%)`;
          },
        },
      },
    },
    scales: question.type === 'radio' || question.type === 'checkbox' ? {
      y: {
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
      x: {
        grid: {
          color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          color: isDarkMode ? '#e5e7eb' : '#374151',
          font: {
            size: 12,
          },
          maxRotation: 45,
          minRotation: 45,
        },
      },
    } : undefined,
  };

  const ChartComponent = question.type === 'radio' ? Pie : Bar;

  return (
    <div className="mt-6">
      <div className="h-[300px]">
        <ChartComponent data={chartData} options={options} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        {question.options.map((option, index) => {
          const count = data[index];
          const total = data.reduce((a, b) => a + b, 0);
          const percentage = ((count / total) * 100).toFixed(1);
          
          return (
            <div 
              key={option}
              className="flex items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
            >
              <div 
                className="w-4 h-4 rounded-full mr-3"
                style={{ backgroundColor: chartColors[index % chartColors.length] }}
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {option}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {count} responses ({percentage}%)
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}