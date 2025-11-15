import React from 'react';
import { Download, TrendingUp, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface SectionStat {
  id: string;
  title: string;
  yes: number;
  no: number;
  na: number;
  total: number;
  weightage: number;
}

interface DashboardSummaryCardProps {
  sectionStats: SectionStat[];
  formTitle: string;
  submittedDate: string;
  onDownloadPDF: () => void;
  isGeneratingPDF: boolean;
}

const DashboardSummaryCard: React.FC<DashboardSummaryCardProps> = ({
  sectionStats,
  formTitle,
  submittedDate,
  onDownloadPDF,
  isGeneratingPDF,
}) => {
  const totalQuestions = sectionStats.reduce((sum, stat) => sum + stat.total, 0);
  const totalYes = sectionStats.reduce((sum, stat) => sum + stat.yes, 0);
  const totalNo = sectionStats.reduce((sum, stat) => sum + stat.no, 0);
  const totalNA = sectionStats.reduce((sum, stat) => sum + stat.na, 0);

  const overallScore = totalQuestions > 0 ? (totalYes / totalQuestions) * 100 : 0;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900 p-6 rounded-2xl shadow-2xl border border-blue-200 dark:border-gray-700 transform hover:scale-[1.02] transition-all duration-300">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {formTitle}
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Submitted on {submittedDate}
          </p>
        </div>
        <button
          onClick={onDownloadPDF}
          disabled={isGeneratingPDF}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50"
        >
          {isGeneratingPDF ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {isGeneratingPDF ? 'Generating...' : 'Download PDF'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600 transform hover:scale-105 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Overall Score</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {overallScore.toFixed(1)}%
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600 transform hover:scale-105 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Yes Answers</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {totalYes}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600 transform hover:scale-105 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No Answers</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {totalNo}
              </p>
            </div>
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600 transform hover:scale-105 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">N/A Answers</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {totalNA}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Response Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {totalQuestions}
            </div>
            <div className="text-gray-600 dark:text-gray-400">Total Questions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {sectionStats.length}
            </div>
            <div className="text-gray-600 dark:text-gray-400">Sections</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {((totalYes + totalNo + totalNA) / Math.max(totalQuestions, 1) * 100).toFixed(1)}%
            </div>
            <div className="text-gray-600 dark:text-gray-400">Response Rate</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardSummaryCard;