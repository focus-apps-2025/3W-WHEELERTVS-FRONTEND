import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useForms, useResponses } from "../hooks/useApi";
import { FileText, ChevronLeft, ChevronRight, Smile, Frown, Meh, Search } from "lucide-react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { LAYOUT_CONFIG } from "../config/layoutConfig";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function DashboardNew() {
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const { data: formsData, loading: formsLoading } = useForms();
  const { data: responsesData, loading: responsesLoading } = useResponses();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredForms = formsData?.forms?.filter((form: any) =>
    form.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (form.description && form.description.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  const customerPortalUrl = tenant
    ? `https://forms.focusengineeringapp.com/${tenant.slug}`
    : null;

  const getFormResponseStats = (formId: string) => {
    let yesCount = 0;
    let noCount = 0;
    let naCount = 0;

    if (responsesData?.responses) {
      responsesData.responses.forEach((response: any) => {
        if (response.questionId === formId && response.answers) {
          Object.values(response.answers).forEach((answer: any) => {
            const answerStr = String(answer).toLowerCase();
            if (answerStr === "yes") {
              yesCount++;
            } else if (answerStr === "no") {
              noCount++;
            } else if (answerStr === "n/a" || answerStr === "na") {
              naCount++;
            }
          });
        }
      });
    }

    return { yesCount, noCount, naCount, total: yesCount + noCount + naCount };
  };

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 320;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6 md:p-8">
      {/* Tenant Info Banner */}
      {tenant && (
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Your Tenant Information
              </h3>
              <div className="flex items-center space-x-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Business Name:
                  </span>{" "}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {tenant.businessName}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Tenant ID:
                  </span>{" "}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {tenant.slug}
                  </span>
                </div>
              </div>
            </div>
            {customerPortalUrl && (
              <div className="text-right">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Customer Portal URL:
                </p>
                <a
                  href={customerPortalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 hover:underline"
                >
                  {customerPortalUrl}
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Forms List - Carousel */}
      <div className="bg-white dark:bg-gray-700 rounded-2xl border border-gray-100 dark:border-gray-600 p-6">
        <div className="mb-6">
          <div className="relative w-96 mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search forms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-sm"
            />
          </div>
        </div>

        {formsLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              Loading forms...
            </p>
          </div>
        ) : !formsData?.forms || formsData.forms.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No forms available
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Create your first form to get started
            </p>
          </div>
        ) : filteredForms.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No forms found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Try adjusting your search criteria
            </p>
          </div>
        ) : (
          <div className="relative -mx-6 px-6">
            <div
              ref={scrollContainerRef}
              className="flex gap-6 overflow-x-auto pb-4 scroll-smooth"
              style={{ scrollBehavior: "smooth", scrollPaddingLeft: "2rem", scrollPaddingRight: "2rem" }}
            >
              {filteredForms.map((form: any) => {
                const stats = getFormResponseStats(form.id);
                return (
                  <div
                    key={form._id}
                    className="flex-shrink-0 w-72 h-[36rem] bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-600 dark:to-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 p-6 hover:shadow-lg transition-all duration-300 cursor-pointer group flex flex-col overflow-hidden"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:scale-110 transition-transform">
                        <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          form.isVisible
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                            : "bg-gray-200 dark:bg-gray-500 text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {form.isVisible ? "Published" : "Draft"}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1 line-clamp-1 truncate">
                      {form.title}
                    </h3>

                    <p className="text-gray-600 dark:text-gray-400 text-xs mb-2 line-clamp-1">
                      {form.description || "No description provided"}
                    </p>

                    <div className="flex items-center justify-between py-2 border-b border-gray-300 dark:border-gray-500">
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 text-xs">
                          Total Responses
                        </p>
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400 truncate">
                          {form.responseCount || 0}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-600 dark:text-gray-400 text-xs">
                          Promoters
                        </p>
                        <p className="text-lg font-bold" style={{ color: "#1e3a8a" }}>
                          {getFormResponseStats(form.id).total > 0 ? ((getFormResponseStats(form.id).yesCount / getFormResponseStats(form.id).total) * 100).toFixed(1) : 0}%
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 flex-1 flex flex-col items-center justify-center min-h-0">
                      {stats.total > 0 ? (
                        <>
                          <div className="w-full h-full flex items-center justify-center py-2" style={{ maxHeight: "160px" }}>
                            <Doughnut
                              data={{
                                labels: ["Promoters", "Detractors", "Neutral"],
                                datasets: [
                                  {
                                    data: [stats.yesCount, stats.noCount, stats.naCount],
                                    backgroundColor: [
                                      "rgba(30, 58, 138, 1)",
                                      "rgba(147, 197, 253, 1)",
                                      "rgba(37, 99, 235, 1)",
                                    ],
                                    borderColor: [
                                      "rgba(30, 58, 138, 1)",
                                      "rgba(147, 197, 253, 1)",
                                      "rgba(37, 99, 235, 1)",
                                    ],
                                    borderWidth: 2,
                                  },
                                ],
                              }}
                              options={{
                                responsive: true,
                                maintainAspectRatio: true,
                                cutout: "75%",
                                plugins: {
                                  legend: {
                                    display: false,
                                  },
                                  tooltip: {
                                    enabled: false,
                                  },
                                  datalabels: {
                                    display: false,
                                  },
                                },
                              } as any}
                            />
                          </div>
                          <div className="mt-2 flex justify-center gap-4">
                            <div className="flex flex-col items-center">
                              <p className="text-xs font-bold text-gray-900 dark:text-white">{stats.yesCount}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Promoters</p>
                              <Smile className="w-4 h-4 mt-0.5" style={{ color: "#1e3a8a" }} />
                              <p className="text-xs font-semibold mt-0.5" style={{ color: "#1e3a8a" }}>{stats.total > 0 ? ((stats.yesCount / stats.total) * 100).toFixed(1) : 0}%</p>
                            </div>
                            <div className="flex flex-col items-center">
                              <p className="text-xs font-bold text-gray-900 dark:text-white">{stats.noCount}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Detractors</p>
                              <Frown className="w-4 h-4 mt-0.5" style={{ color: "#93c5fd" }} />
                              <p className="text-xs font-semibold mt-0.5" style={{ color: "#93c5fd" }}>{stats.total > 0 ? ((stats.noCount / stats.total) * 100).toFixed(1) : 0}%</p>
                            </div>
                            <div className="flex flex-col items-center">
                              <p className="text-xs font-bold text-gray-900 dark:text-white">{stats.naCount}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Neutral</p>
                              <Meh className="w-4 h-4 mt-0.5" style={{ color: "#2563eb" }} />
                              <p className="text-xs font-semibold mt-0.5" style={{ color: "#2563eb" }}>{stats.total > 0 ? ((stats.naCount / stats.total) * 100).toFixed(1) : 0}%</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-2">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            No responses
                          </p>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => navigate(`/forms/${form.id}/analytics`)}
                      className="mt-2 w-full text-white py-2 px-3 rounded-lg font-medium text-xs transition-colors"
                      style={{ backgroundColor: "#1e3a8a" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#1e3a8a")}
                    >
                      View More Analytics
                    </button>
                  </div>
                );
              })}
            </div>

            {filteredForms.length > 3 && (
              <>
                <button
                  onClick={() => scroll("left")}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 shadow-lg transition-all z-10"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={() => scroll("right")}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 shadow-lg transition-all z-10"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
