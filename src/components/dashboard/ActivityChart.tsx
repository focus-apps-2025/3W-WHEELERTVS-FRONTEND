import React from 'react';
import type { Response } from '../../types';

interface ActivityChartProps {
  responses: Response[];
}

export default function ActivityChart({ responses }: ActivityChartProps) {
  // Group responses by date
  const responsesByDate = responses.reduce((acc, response) => {
    const date = new Date(response.timestamp).toLocaleDateString();
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toLocaleDateString();
  }).reverse();

  // Calculate max value for scaling
  const maxResponses = Math.max(...Object.values(responsesByDate), 1);

  return (
    <div className="h-64">
      <div className="flex h-full items-end space-x-2">
        {last7Days.map((date) => {
          const count = responsesByDate[date] || 0;
          const height = `${(count / maxResponses) * 100}%`;
          
          return (
            <div
              key={date}
              className="flex-1 flex flex-col items-center"
            >
              <div className="w-full bg-blue-100 dark:bg-blue-900/20 rounded-t" style={{ height }}>
                <div className="text-xs text-blue-600 dark:text-blue-400 text-center mt-1">
                  {count}
                </div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}