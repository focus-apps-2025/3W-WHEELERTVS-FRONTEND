import React, { useState, useEffect } from "react";
import { Download } from "lucide-react";

interface DashboardSummaryCardProps {
  sectionStats: Array<{
    id: string;
    title: string;
    yes: number;
    no: number;
    na: number;
    total: number;
    weightage: number;
  }>;
  formTitle: string;
  submittedDate: string;
  onDownloadPDF: () => void;
  isGeneratingPDF?: boolean;
}

const Gauge = ({ value, label, color }: { value: number; label: string; color: string }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayValue((prev) => {
        if (prev < value) {
          return Math.min(prev + value / 20, value);
        }
        return prev;
      });
    }, 30);
    return () => clearInterval(interval);
  }, [value]);

  const rotation = (displayValue / 100) * 180 - 90;
  const colorMap = {
    green: "#10b981",
    red: "#ef4444",
    gray: "#9ca3af",
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-16">
        <svg viewBox="0 0 200 120" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            stroke="#d1d5db"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            className="dark:stroke-gray-600"
          />

          <path
            d={`M 20 100 A 80 80 0 0 1 ${20 + (160 * displayValue / 100)} 100`}
            stroke={colorMap[color] || color}
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
          />

          <line x1="100" y1="100" x2="100" y2="30" stroke="#374151" strokeWidth="2" strokeLinecap="round" className="dark:stroke-gray-400" />
          <circle cx="100" cy="100" r="4" fill="#374151" className="dark:fill-gray-400" />

          <g transform={`rotate(${rotation} 100 100)`}>
            <line x1="100" y1="100" x2="100" y2="30" stroke={colorMap[color] || color} strokeWidth="3" strokeLinecap="round" />
            <circle cx="100" cy="100" r="3" fill={colorMap[color] || color} />
          </g>

          <text x="20" y="115" textAnchor="middle" fontSize="10" fill="#6b7280" fontWeight="500" className="dark:fill-gray-400">
            0
          </text>
          <text x="100" y="115" textAnchor="middle" fontSize="10" fill="#6b7280" fontWeight="500" className="dark:fill-gray-400">
            50
          </text>
          <text x="180" y="115" textAnchor="middle" fontSize="10" fill="#6b7280" fontWeight="500" className="dark:fill-gray-400">
            100
          </text>
        </svg>
      </div>

      <div className="mt-2 text-center">
        <div className="text-2xl font-bold" style={{ color: colorMap[color] || color }}>
          {Math.round(displayValue)}%
        </div>
        <div className="text-sm font-medium text-slate-600 dark:text-gray-300">{label}</div>
      </div>
    </div>
  );
};

export default function DashboardSummaryCard({
  sectionStats,
  formTitle,
  submittedDate,
  onDownloadPDF,
  isGeneratingPDF = false,
}: DashboardSummaryCardProps) {
  const totalYes = sectionStats.reduce((sum, stat) => sum + stat.yes, 0);
  const totalNo = sectionStats.reduce((sum, stat) => sum + stat.no, 0);
  const totalNA = sectionStats.reduce((sum, stat) => sum + stat.na, 0);
  const totalQuestions = sectionStats.reduce((sum, stat) => sum + stat.total, 0);

  const yesPercentage = totalQuestions > 0 ? (totalYes / totalQuestions) * 100 : 0;
  const noPercentage = totalQuestions > 0 ? (totalNo / totalQuestions) * 100 : 0;
  const naPercentage = totalQuestions > 0 ? (totalNA / totalQuestions) * 100 : 0;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 mb-6 shadow-lg">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{formTitle}</h2>
        <p className="text-gray-600 dark:text-gray-400">Submitted on {submittedDate}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        <Gauge value={yesPercentage} label="Yes" color="green" />
        <Gauge value={noPercentage} label="No" color="red" />
        <Gauge value={naPercentage} label="N/A" color="gray" />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{totalYes}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Yes Responses</div>
        </div>
        <div className="text-center border-l border-r border-gray-200 dark:border-gray-600">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{totalNo}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">No Responses</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{totalNA}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">N/A Responses</div>
        </div>
      </div>

      <button
        onClick={onDownloadPDF}
        disabled={isGeneratingPDF}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all disabled:opacity-60 font-semibold shadow-lg"
      >
        {isGeneratingPDF ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Generating PDF...
          </>
        ) : (
          <>
            <Download className="w-5 h-5" />
            Download PDF Report
          </>
        )}
      </button>
    </div>
  );
}
