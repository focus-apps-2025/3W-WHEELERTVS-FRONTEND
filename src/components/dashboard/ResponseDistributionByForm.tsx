import React from 'react';
import { Bar } from 'react-chartjs-2';
import type { Question, Response } from '../../types';

interface ResponseDistributionByFormProps {
  question: Question;
  responses: Response[];
}

export default function ResponseDistributionByForm({ question, responses }: ResponseDistributionByFormProps) {
  // Get all questions from sections or fallback to followUpQuestions
  const allQuestions = question.sections.length > 0
    ? question.sections.flatMap(section => section.questions)
    : question.followUpQuestions;

  const questionResponses = responses.filter(r => r.questionId === question.id);

  const data = {
    labels: allQuestions.map(q => q.text),
    datasets: [{
      label: 'Number of Responses',
      data: allQuestions.map(q => {
        return questionResponses.filter(r => r.answers[q.id]).length;
      }),
      backgroundColor: 'rgba(59, 130, 246, 0.5)',
      borderColor: 'rgb(59, 130, 246)',
      borderWidth: 1
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.raw;
            const total = questionResponses.length;
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            return `${value} responses (${percentage}%)`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    }
  };

  return (
    <div className="h-[300px]">
      <Bar data={data} options={options} />
    </div>
  );
}