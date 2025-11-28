import React, { useMemo, useState, useRef, useEffect } from "react";
import { BarChart3, TrendingUp, Target, Activity, Zap, ChevronDown } from "lucide-react";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Radar } from "react-chartjs-2";
import type { Question, Response } from "../../types";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface SectionAnalyticsProps {
  question: Question;
  responses: Response[];
}

interface Section {
  id: string;
  title: string;
  description?: string;
  questions: any[];
}

export default function SectionAnalytics({
  question,
  responses,
}: SectionAnalyticsProps) {
  const sections: Section[] = question.sections || [];

  const getSectionStats = (section: Section) => {
    const mainQuestionsOnly = section.questions.filter(
      (q: any) => !q.parentId && !q.showWhen?.questionId
    );
    const mainQuestionCount = mainQuestionsOnly.length;
    let totalFollowUpCount = 0;
    let answeredMainQuestions = 0;
    let answeredFollowUpQuestions = 0;
    let mainQuestionResponses = 0;
    let followUpResponses = 0;

    const followUpQuestionsInSection = section.questions.filter(
      (q: any) => q.parentId || q.showWhen?.questionId
    );
    totalFollowUpCount = followUpQuestionsInSection.length;

    followUpQuestionsInSection.forEach((followUp: any) => {
      const followUpResponders = responses.filter(
        (r) => r.answers && r.answers[followUp.id]
      ).length;
      if (followUpResponders > 0) {
        answeredFollowUpQuestions++;
        followUpResponses += followUpResponders;
      }
    });

    mainQuestionsOnly.forEach((q: any) => {
      let followUpCount = 0;
      if (q.followUpQuestions && Array.isArray(q.followUpQuestions)) {
        followUpCount = q.followUpQuestions.length;
      }
      
      const mainQuestionResponders = responses.filter(
        (r) => r.answers && r.answers[q.id]
      ).length;
      if (mainQuestionResponders > 0) {
        answeredMainQuestions++;
        mainQuestionResponses += mainQuestionResponders;
      }
    });

    const totalAnswered = answeredMainQuestions + answeredFollowUpQuestions;
    const totalQuestions = mainQuestionCount + totalFollowUpCount;
    const totalResponses = mainQuestionResponses + followUpResponses;

    const completionRate = totalQuestions > 0
      ? ((totalAnswered / totalQuestions) * 100).toFixed(1)
      : 0;

    const avgResponsesPerQuestion = totalQuestions > 0
      ? (totalResponses / totalQuestions).toFixed(1)
      : 0;

    return {
      mainQuestionCount,
      totalFollowUpCount,
      answeredMainQuestions,
      answeredFollowUpQuestions,
      totalAnswered,
      totalResponses,
      completionRate,
      avgResponsesPerQuestion,
      questionsDetail: mainQuestionsOnly.map((q: any) => {
        const relatedFollowUps = section.questions.filter(
          (fq: any) => fq.parentId === q.id || fq.showWhen?.questionId === q.id
        );
        return {
          id: q.id,
          text: q.text,
          followUpCount: relatedFollowUps.length,
          responses: responses.filter((r) => r.answers && r.answers[q.id]).length,
          followUpDetails: relatedFollowUps.map((fq: any) => ({
            id: fq.id,
            text: fq.text,
            responses: responses.filter((r) => r.answers && r.answers[fq.id]).length,
          })),
        };
      }),
    };
  };

  const sectionsStats = useMemo(() => {
    return sections.map((section) => ({
      section,
      stats: getSectionStats(section),
    }));
  }, [sections, responses]);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleSelectSection = (sectionId: string) => {
    setSelectedSectionIds((prev) => {
      if (prev.includes(sectionId)) {
        return prev.filter((id) => id !== sectionId);
      } else {
        return [...prev, sectionId];
      }
    });
  };

  const handleClearAll = () => {
    setSelectedSectionIds([]);
  };

  const filteredSectionOptions = sections.filter((section) =>
    section.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displaySections = selectedSectionIds.length === 0 
    ? sectionsStats 
    : sectionsStats.filter((item) => selectedSectionIds.includes(item.section.id));

  if (!sections || sections.length === 0) {
    return (
      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg p-8 text-center border border-gray-100 dark:border-gray-700">
        <BarChart3 className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-gray-600 dark:text-gray-400 font-medium">No sections available</p>
      </div>
    );
  }

  const totalMetrics = useMemo(() => {
    let totalMainQuestions = 0;
    let totalFollowUpQuestions = 0;
    let totalQuestionsAnswered = 0;
    let totalCompletionRate = 0;

    displaySections.forEach(({ stats }) => {
      totalMainQuestions += stats.mainQuestionCount;
      totalFollowUpQuestions += stats.totalFollowUpCount;
      totalQuestionsAnswered += stats.totalAnswered;
      totalCompletionRate += parseFloat(stats.completionRate as any);
    });

    const avgCompletionRate = displaySections.length > 0 ? (totalCompletionRate / displaySections.length).toFixed(1) : 0;

    return {
      totalMainQuestions,
      totalFollowUpQuestions,
      totalQuestionsAnswered,
      avgCompletionRate,
      sections: displaySections.length,
    };
  }, [displaySections]);

  return (
    <div className="w-full space-y-6">
      {/* <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-3xl font-bold flex items-center">
              <BarChart3 className="w-8 h-8 mr-3" />
              Section-Based Analytics
            </h3>
            <p className="text-blue-100 text-sm mt-2">Comprehensive overview of questions, follow-ups, and engagement by section</p>
          </div>
        </div>
      </div> */}

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-left flex items-center justify-between hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-gray-900 dark:text-white font-medium">
              {selectedSectionIds.length === 0
                ? "Select Sections (All)"
                : `${selectedSectionIds.length} section${selectedSectionIds.length > 1 ? "s" : ""} selected`}
            </span>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform ${
              isDropdownOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isDropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl z-10">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <input
                type="text"
                placeholder="Search sections..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="max-h-64 overflow-y-auto">
              {filteredSectionOptions.map((section) => (
                <label
                  key={section.id}
                  className="flex items-center px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedSectionIds.includes(section.id)}
                    onChange={() => handleSelectSection(section.id)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="ml-3 text-gray-900 dark:text-white font-medium text-sm">
                    {section.title}
                  </span>
                </label>
              ))}
            </div>

            {selectedSectionIds.length > 0 && (
              <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                <button
                  onClick={handleClearAll}
                  className="flex-1 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl p-6 border border-blue-200 dark:border-blue-700/50 shadow-lg hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">Sections</span>
            <Target className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-blue-900 dark:text-blue-200">{totalMetrics.sections}</div>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Total sections</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-xl p-6 border border-green-200 dark:border-green-700/50 shadow-lg hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-green-600 dark:text-green-400">Main Questions</span>
            <Activity className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-green-900 dark:text-green-200">{totalMetrics.totalMainQuestions}</div>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">Primary questions</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-xl p-6 border border-purple-200 dark:border-purple-700/50 shadow-lg hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">Follow-ups</span>
            <Zap className="w-5 h-5 text-purple-500" />
          </div>
          <div className="text-3xl font-bold text-purple-900 dark:text-purple-200">{totalMetrics.totalFollowUpQuestions}</div>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Follow-up questions</p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 rounded-xl p-6 border border-orange-200 dark:border-orange-700/50 shadow-lg hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">Answered</span>
            <TrendingUp className="w-5 h-5 text-orange-500" />
          </div>
          <div className="text-3xl font-bold text-orange-900 dark:text-orange-200">{totalMetrics.totalQuestionsAnswered}</div>
          <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Total answered</p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 rounded-xl p-6 border border-red-200 dark:border-red-700/50 shadow-lg hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-red-600 dark:text-red-400">Avg Rate</span>
            <BarChart3 className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-3xl font-bold text-red-900 dark:text-red-200">{totalMetrics.avgCompletionRate}%</div>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">Completion rate</p>
        </div>
      </div>

      {displaySections.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center border border-gray-100 dark:border-gray-700">
          <Target className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">No sections selected</p>
          <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">Select at least one section to view analytics</p>
        </div>
      ) : (
        <div className="space-y-6">
          {displaySections.map(({ section, stats }, sectionIdx) => {
          const isExpanded = expandedSections[section.id] !== false;

          const radarMetrics = {
            mainQuestionsRate: stats.mainQuestionCount > 0 ? (stats.answeredMainQuestions / stats.mainQuestionCount) * 100 : 0,
            followUpRate: stats.totalFollowUpCount > 0 ? (stats.answeredFollowUpQuestions / stats.totalFollowUpCount) * 100 : 0,
            completionRate: parseFloat(stats.completionRate as any),
            engagementRate: stats.totalResponses > 0 ? Math.min((stats.totalResponses / responses.length) * 100, 100) : 0,
            responseAverage: Math.min(parseFloat(stats.avgResponsesPerQuestion as any) * 20, 100),
          };

          return (
            <div
              key={section.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-all"
            >
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-left hover:from-blue-600 hover:to-blue-700 transition-all flex items-center justify-between group shadow-md hover:shadow-lg"
              >
                <div>
                  <h4 className="text-xl font-bold text-white flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-8 h-8 bg-white/20 rounded-lg text-sm">
                      {sectionIdx + 1}
                    </span>
                    {section.title}
                  </h4>
                  {section.description && (
                    <p className="text-blue-100 text-sm mt-1">{section.description}</p>
                  )}
                </div>
                <ChevronDown
                  className={`w-6 h-6 text-white transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isExpanded && (
                <div className="p-8">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg p-4 border border-blue-200 dark:border-blue-700/50">
                          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">Main Q</p>
                          <p className="text-2xl font-bold text-blue-900 dark:text-blue-200 mt-2">{stats.mainQuestionCount}</p>
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Questions</p>
                        </div>

                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-lg p-4 border border-purple-200 dark:border-purple-700/50">
                          <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase">Follow-ups</p>
                          <p className="text-2xl font-bold text-purple-900 dark:text-purple-200 mt-2">{stats.totalFollowUpCount}</p>
                          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Questions</p>
                        </div>

                        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-lg p-4 border border-green-200 dark:border-green-700/50">
                          <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase">Answered</p>
                          <p className="text-2xl font-bold text-green-900 dark:text-green-200 mt-2">{stats.totalAnswered}</p>
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            {stats.answeredMainQuestions}M + {stats.answeredFollowUpQuestions}F
                          </p>
                        </div>

                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg p-4 border border-blue-200 dark:border-blue-700/50">
                          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">Completion</p>
                          <p className="text-2xl font-bold text-blue-900 dark:text-blue-200 mt-2">{stats.completionRate}%</p>
                          <div className="mt-2 bg-blue-200 dark:bg-blue-700/30 rounded-full h-1.5">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-blue-600 h-1.5 rounded-full transition-all"
                              style={{ width: `${stats.completionRate}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg p-4 border border-blue-200 dark:border-blue-700/50">
                          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">Avg Response</p>
                          <p className="text-2xl font-bold text-blue-900 dark:text-blue-200 mt-2">{stats.avgResponsesPerQuestion}</p>
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Per question</p>
                        </div>

                        <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/30 dark:to-cyan-800/30 rounded-lg p-4 border border-cyan-200 dark:border-cyan-700/50">
                          <p className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 uppercase">Total Responses</p>
                          <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-200 mt-2">{stats.totalResponses}</p>
                          <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">All questions</p>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                        <h5 className="text-md font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                          <Activity className="w-5 h-5 mr-2 text-blue-600" />
                          Question Details
                        </h5>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {stats.questionsDetail.map((q: any, idx: number) => (
                            <div key={q.id}>
                              <div className="flex items-start justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border-l-4 border-blue-500 hover:shadow-md transition-all">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded">
                                      {idx + 1}
                                    </span>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                      {q.text.length > 70 ? q.text.substring(0, 70) + "..." : q.text}
                                    </p>
                                  </div>
                                  {q.followUpCount > 0 && (
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 ml-8">
                                      {q.followUpCount} follow-up{q.followUpCount > 1 ? "s" : ""}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right ml-4 flex-shrink-0">
                                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{q.responses}</div>
                                  <div className="text-xs text-gray-600 dark:text-gray-400">responses</div>
                                </div>
                              </div>

                              {q.followUpDetails && q.followUpDetails.length > 0 && (
                                <div className="ml-6 mt-2 space-y-2">
                                  {q.followUpDetails.map((fq: any, fIdx: number) => (
                                    <div
                                      key={fq.id}
                                      className="flex items-start justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded border-l-2 border-blue-400 text-sm"
                                    >
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="inline-flex items-center justify-center w-4 h-4 bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-sm">
                                            •
                                          </span>
                                          <p className="text-xs font-medium text-gray-900 dark:text-white">
                                            {fq.text.length > 65 ? fq.text.substring(0, 65) + "..." : fq.text}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="text-right ml-4 flex-shrink-0">
                                        <div className="text-sm font-bold text-blue-600 dark:text-blue-400">{fq.responses}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                      <div style={{ width: "100%", height: "300px" }}>
                        <Radar
                          data={{
                            labels: [
                              "Main Q Rate",
                              "Follow-up Rate",
                              "Completion",
                              "Engagement",
                              "Avg Response",
                            ],
                            datasets: [
                              {
                                label: section.title,
                                data: [
                                  radarMetrics.mainQuestionsRate,
                                  radarMetrics.followUpRate,
                                  radarMetrics.completionRate,
                                  radarMetrics.engagementRate,
                                  radarMetrics.responseAverage,
                                ],
                                borderColor: "rgb(59, 130, 246)",
                                backgroundColor: "rgba(59, 130, 246, 0.15)",
                                pointBackgroundColor: "rgb(59, 130, 246)",
                                pointBorderColor: "#fff",
                                pointHoverBackgroundColor: "#fff",
                                pointHoverBorderColor: "rgb(59, 130, 246)",
                                pointRadius: 4,
                                pointHoverRadius: 6,
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                display: true,
                                position: "bottom",
                                labels: {
                                  color: document.documentElement.classList.contains("dark")
                                    ? "#e5e7eb"
                                    : "#374151",
                                  font: {
                                    size: 12,
                                    weight: "600",
                                  },
                                },
                              },
                              tooltip: {
                                backgroundColor: "rgba(0, 0, 0, 0.8)",
                                padding: 12,
                                titleFont: { size: 13, weight: "bold" },
                                bodyFont: { size: 12 },
                                borderColor: "rgba(59, 130, 246, 0.5)",
                                borderWidth: 1,
                                callbacks: {
                                  label: function (context: any) {
                                    return `${context.label}: ${context.parsed.r.toFixed(1)}%`;
                                  },
                                },
                              },
                            },
                            scales: {
                              r: {
                                beginAtZero: true,
                                max: 100,
                                ticks: {
                                  stepSize: 20,
                                  color: document.documentElement.classList.contains("dark")
                                    ? "#9ca3af"
                                    : "#9ca3af",
                                  font: {
                                    size: 11,
                                  },
                                },
                                grid: {
                                  color: document.documentElement.classList.contains("dark")
                                    ? "rgba(107, 114, 128, 0.2)"
                                    : "rgba(209, 213, 219, 0.5)",
                                },
                                pointLabels: {
                                  color: document.documentElement.classList.contains("dark")
                                    ? "#e5e7eb"
                                    : "#1f2937",
                                  font: {
                                    size: 11,
                                    weight: "600",
                                  },
                                },
                              },
                            },
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}
