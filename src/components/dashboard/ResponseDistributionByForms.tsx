import React from 'react';
import { Bar } from 'react-chartjs-2';
import type { Question, Response } from '../../types';

interface ResponseDistributionByFormsProps {
  questions: Question[];
  responses: Response[];
}

export default function ResponseDistributionByForms({ questions, responses }: ResponseDistributionByFormsProps) {
  // Get response counts for each form
  const responseCounts = questions.map(question => ({
    title: question.title,
    count: responses.filter(r => r.questionId === question.id).length
  }));

  // Sort by response count in descending order
  responseCounts.sort((a, b) => b.count - a.count);

  const data = {
    labels: responseCounts.map(item => item.title),
    datasets: [{
      label: 'Number of Responses',
      data: responseCounts.map(item => item.count),
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
            const total = responses.length;
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