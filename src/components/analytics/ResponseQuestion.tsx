import React, { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import type { Question, Response } from '../../types';
import ChartTypeSelector, { ChartType } from './ChartTypeSelector';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface ResponseQuestionProps {
  question: Question;
  responses: Response[];
}

export default function ResponseQuestion({ question, responses }: ResponseQuestionProps) {
  const [chartPreferences, setChartPreferences] = useState<Record<string, ChartType>>({});

  // Get all questions from sections or fallback to followUpQuestions
  const allQuestions = question.sections.length > 0
    ? question.sections.flatMap(section => section.questions)
    : question.followUpQuestions;

  const getQuestionResponses = (questionId: string) => {
    return responses.map(response => response.answers[questionId]).filter(Boolean);
  };

  const getResponseDistribution = (questionId: string) => {
    const questionResponses = getQuestionResponses(questionId);
    const distribution: Record<string, number> = {};

    questionResponses.forEach(response => {
      if (Array.isArray(response)) {
        response.forEach(value => {
          distribution[value] = (distribution[value] || 0) + 1;
        });
      } else {
        distribution[response] = (distribution[response] || 0) + 1;
      }
    });

    return distribution;
  };

  const chartColors = [
    'rgba(59, 130, 246, 0.8)',   // blue-500
    'rgba(16, 185, 129, 0.8)',   // green-500
    'rgba(239, 68, 68, 0.8)',    // red-500
    'rgba(217, 119, 6, 0.8)',    // yellow-600
    'rgba(147, 51, 234, 0.8)',   // purple-600
  ];

  const renderQuestionChart = (q: Question['followUpQuestions'][0]) => {
    if (!q.options) return null;

    const distribution = getResponseDistribution(q.id);
    const data = {
      labels: q.options,
      datasets: [
        {
          data: q.options.map(option => distribution[option] || 0),
          backgroundColor: chartColors,
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
        },
      ],
    };

    const options = {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: {
            padding: 20,
            font: {
              size: 12,
            },
            color: 'rgb(107, 114, 128)',
          },
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const value = context.raw;
              const total = Object.values(distribution).reduce((a: number, b: number) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${value} responses (${percentage}%)`;
            },
          },
        },
      },
    };

    const chartType = chartPreferences[q.id] || (q.type === 'radio' ? 'pie' : 'bar');

    return (
      <div className="h-[300px]">
        {chartType === 'pie' ? (
          <Pie data={data} options={options} />
        ) : (
          <Bar 
            data={data} 
            options={{
              ...options,
              indexAxis: 'y' as const,
              scales: {
                x: {
                  beginAtZero: true,
                  grid: {
                    color: 'rgba(107, 114, 128, 0.1)',
                  },
                  ticks: {
                    color: 'rgb(107, 114, 128)',
                  },
                },
                y: {
                  grid: {
                    display: false,
                  },
                  ticks: {
                    color: 'rgb(107, 114, 128)',
                  },
                },
              },
            }} 
          />
        )}
      </div>
    );
  };

  const handleChartTypeChange = (questionId: string, type: ChartType) => {
    setChartPreferences(prev => ({
      ...prev,
      [questionId]: type
    }));
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Response Distribution by Question
      </h4>
      <div className="space-y-8">
        {allQuestions.map((q) => {
          if (!q.options) return null;
          const responses = getQuestionResponses(q.id);
          const responseCount = responses.length;
          
          return (
            <div key={q.id} className="border-b dark:border-gray-700 pb-8 last:border-0">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h5 className="text-lg font-medium text-gray-900 dark:text-white">
                    {q.text}
                  </h5>
                  {q.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {q.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {responseCount} responses
                  </span>
                  <ChartTypeSelector
                    value={chartPreferences[q.id] || (q.type === 'radio' ? 'pie' : 'bar')}
                    onChange={(type) => handleChartTypeChange(q.id, type)}
                  />
                </div>
              </div>
              {renderQuestionChart(q)}
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