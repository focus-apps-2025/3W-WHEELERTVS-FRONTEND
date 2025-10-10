import React from "react";
import type { Response } from "../../types";

interface ResponseTimelineProps {
  responses: Response[];
}

export default function ResponseTimeline({ responses }: ResponseTimelineProps) {
  const timelineData = getTimelineData(responses);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Response Timeline
      </h4>
      <div className="h-64">
        <div className="flex h-full items-end space-x-2">
          {timelineData.map(({ date, count, percentage }) => (
            <div key={date} className="flex-1 flex flex-col items-center">
              <div
                className="w-full bg-blue-100 dark:bg-blue-900/50 rounded-t transition-all duration-300"
                style={{ height: `${percentage}%` }}
              >
                <div className="text-xs text-blue-600 dark:text-blue-400 text-center mt-1">
                  {count}
                </div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {formatDate(date)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getTimelineData(responses: Response[]) {
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split("T")[0];
  }).reverse();

  const countsByDate = responses.reduce((acc, response) => {
    const dateObj = new Date(response.timestamp);
    if (isNaN(dateObj.getTime())) {
      console.warn(
        "Invalid timestamp for response:",
        response.id,
        response.timestamp
      );
      return acc;
    }
    const date = dateObj.toISOString().split("T")[0];
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const maxCount = Math.max(...Object.values(countsByDate), 1);

  return last7Days.map((date) => ({
    date,
    count: countsByDate[date] || 0,
    percentage: ((countsByDate[date] || 0) / maxCount) * 100,
  }));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short" });
}
