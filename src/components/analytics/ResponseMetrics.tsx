import React from 'react';
import { Users, Clock, TrendingUp, CheckCircle } from 'lucide-react';
import type { Response } from '../../types';

interface ResponseMetricsProps {
  responses: Response[];
}

export default function ResponseMetrics({ responses }: ResponseMetricsProps) {
  const totalResponses = responses.length;
  const averageTimeToComplete = calculateAverageTime(responses);
  const completionRate = calculateCompletionRate(responses);
  const responseRate = calculateResponseTrend(responses);

  const metrics = [
    {
      label: 'Total Responses',
      value: totalResponses,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    },
    {
      label: 'Avg. Completion Time',
      value: averageTimeToComplete,
      icon: Clock,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
    },
    {
      label: 'Completion Rate',
      value: `${completionRate}%`,
      icon: CheckCircle,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20',
    },
    {
      label: 'Response Rate',
      value: `${responseRate}%`,
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
        >
          <div className="flex items-center">
            <div className={`${metric.bgColor} rounded-lg p-3`}>
              <metric.icon className={`w-6 h-6 ${metric.color}`} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {metric.label}
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {metric.value}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function calculateAverageTime(responses: Response[]): string {
  if (responses.length === 0) return '0m 0s';
  
  // Calculate average time between consecutive responses
  const sortedResponses = [...responses].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let totalTime = 0;
  for (let i = 1; i < sortedResponses.length; i++) {
    const timeDiff = new Date(sortedResponses[i].timestamp).getTime() - 
                     new Date(sortedResponses[i-1].timestamp).getTime();
    totalTime += timeDiff;
  }

  const averageMs = totalTime / (responses.length - 1) || 0;
  const minutes = Math.floor(averageMs / 60000);
  const seconds = Math.floor((averageMs % 60000) / 1000);

  return `${minutes}m ${seconds}s`;
}

function calculateCompletionRate(responses: Response[]): number {
  if (responses.length === 0) return 0;
  
  const completedResponses = responses.filter(response => {
    const answerCount = Object.keys(response.answers).length;
    return answerCount > 0;
  });

  return Math.round((completedResponses.length / responses.length) * 100);
}

function calculateResponseTrend(responses: Response[]): number {
  if (responses.length === 0) return 0;

  // Calculate trend based on response volume in recent period vs previous period
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const recentResponses = responses.filter(r => 
    new Date(r.timestamp) >= oneWeekAgo
  ).length;

  const previousResponses = responses.filter(r => 
    new Date(r.timestamp) >= twoWeeksAgo && 
    new Date(r.timestamp) < oneWeekAgo
  ).length;

  if (previousResponses === 0) return recentResponses > 0 ? 100 : 0;

  const trend = ((recentResponses - previousResponses) / previousResponses) * 100;
  return Math.round(Math.max(0, Math.min(100, trend + 50)));
}