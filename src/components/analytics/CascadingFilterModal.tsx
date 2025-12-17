import React, { useState, useMemo } from "react";
import { ChevronDown, X, Search } from "lucide-react";

interface FilterState {
  [questionId: string]: string[];
}

interface Question {
  id: string;
  text: string;
}

interface Response {
  answers: Record<string, any>;
  submissionMetadata?: {
    location?: {
      city?: string;
      country?: string;
    };
  };
  timestamp?: string;
  createdAt?: string;
  [key: string]: any;
}

interface CascadingFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: Question[];
  responses: Response[];
  onApplyFilters: (filters: FilterState & { dates?: { startDate: string; endDate: string }; locations?: string[] }) => void;
}

export default function CascadingFilterModal({
  isOpen,
  onClose,
  questions,
  responses,
  onApplyFilters,
}: CascadingFilterModalProps) {
  const [filters, setFilters] = useState<FilterState>({});
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const [dateRange, setDateRange] = useState({ startDate: "", endDate: "" });
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [expandedDateRange, setExpandedDateRange] = useState(false);
  const [expandedLocation, setExpandedLocation] = useState(false);
  const [locationSearchTerm, setLocationSearchTerm] = useState("");
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const availableLocations = useMemo(() => {
    const locations = new Set<string>();
    responses.forEach((r) => {
      const meta = r.submissionMetadata?.location;
      if (meta) {
        const city = meta.city || "";
        const country = meta.country || "";
        const locationStr =
          city && country ? `${city}, ${country}` : country || "Unknown";
        if (locationStr !== "Unknown") {
          locations.add(locationStr);
        }
      }
    });
    return Array.from(locations).sort();
  }, [responses]);

  const filteredLocations = availableLocations.filter((loc) =>
    loc.toLowerCase().includes(locationSearchTerm.toLowerCase())
  );

  const getAvailableAnswersForQuestion = (questionId: string): string[] => {
    const activeFilters = Object.entries(filters).filter(
      ([qId, answers]) => answers.length > 0 && qId !== questionId
    );

    let filteredResponses = responses;

    if (activeFilters.length > 0) {
      filteredResponses = responses.filter((response) =>
        activeFilters.every(([qId, selectedAnswers]) => {
          const answer = response.answers?.[qId];
          if (!answer) return false;

          if (Array.isArray(answer)) {
            return answer.some((item) =>
              selectedAnswers.some(
                (sel) =>
                  String(item).toLowerCase() === String(sel).toLowerCase()
              )
            );
          }
          return selectedAnswers.some(
            (sel) =>
              String(answer).toLowerCase() === String(sel).toLowerCase()
          );
        })
      );
    }

    if (selectedLocations.length > 0) {
      filteredResponses = filteredResponses.filter((response) => {
        const meta = response.submissionMetadata?.location;
        if (!meta) return false;
        const city = meta.city || "";
        const country = meta.country || "";
        const locationStr =
          city && country ? `${city}, ${country}` : country || "Unknown";
        return selectedLocations.includes(locationStr);
      });
    }

    const answers = new Set<string>();
    filteredResponses.forEach((response) => {
      const answer = response.answers?.[questionId];
      if (answer !== null && answer !== undefined && answer !== "") {
        if (Array.isArray(answer)) {
          answer.forEach((a) => answers.add(String(a).trim()));
        } else {
          answers.add(String(answer).trim());
        }
      }
    });

    return Array.from(answers).sort();
  };

  const getAnswerCount = (
    questionId: string,
    answerValue: string
  ): number => {
    const activeFilters = Object.entries(filters).filter(
      ([qId, answers]) => answers.length > 0 && qId !== questionId
    );

    let filteredResponses = responses;

    if (activeFilters.length > 0) {
      filteredResponses = responses.filter((response) =>
        activeFilters.every(([qId, selectedAnswers]) => {
          const answer = response.answers?.[qId];
          if (!answer) return false;

          if (Array.isArray(answer)) {
            return answer.some((item) =>
              selectedAnswers.some(
                (sel) =>
                  String(item).toLowerCase() === String(sel).toLowerCase()
              )
            );
          }
          return selectedAnswers.some(
            (sel) =>
              String(answer).toLowerCase() === String(sel).toLowerCase()
          );
        })
      );
    }

    if (selectedLocations.length > 0) {
      filteredResponses = filteredResponses.filter((response) => {
        const meta = response.submissionMetadata?.location;
        if (!meta) return false;
        const city = meta.city || "";
        const country = meta.country || "";
        const locationStr =
          city && country ? `${city}, ${country}` : country || "Unknown";
        return selectedLocations.includes(locationStr);
      });
    }

    return filteredResponses.filter((response) => {
      const answer = response.answers?.[questionId];
      if (!answer) return false;

      if (Array.isArray(answer)) {
        return answer.some(
          (item) =>
            String(item).toLowerCase() === answerValue.toLowerCase()
        );
      }
      return String(answer).toLowerCase() === answerValue.toLowerCase();
    }).length;
  };

  const handleAnswerToggle = (questionId: string, answer: string) => {
    setFilters((prev) => {
      const currentAnswers = prev[questionId] || [];
      const updated = currentAnswers.includes(answer)
        ? currentAnswers.filter((a) => a !== answer)
        : [...currentAnswers, answer];

      return {
        ...prev,
        [questionId]: updated,
      };
    });
  };

  const handleLocationToggle = (location: string) => {
    setSelectedLocations((prev) =>
      prev.includes(location)
        ? prev.filter((l) => l !== location)
        : [...prev, location]
    );
  };

  const handleApply = () => {
    onApplyFilters({
      ...filters,
      dates: dateRange,
      locations: selectedLocations,
    });
    onClose();
  };

  const handleClearAll = () => {
    setFilters({});
    setSearchTerms({});
    setDateRange({ startDate: "", endDate: "" });
    setSelectedLocations([]);
    setLocationSearchTerm("");
  };

  const appliedFiltersCount =
    Object.values(filters).reduce((sum, answers) => sum + answers.length, 0) +
    (dateRange.startDate || dateRange.endDate ? 1 : 0) +
    (selectedLocations.length > 0 ? 1 : 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col relative">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-300 flex items-center justify-between relative z-40">
          <h2 className="text-lg font-bold text-gray-900">
            Question Filters{" "}
            {appliedFiltersCount > 0 && `(${appliedFiltersCount} selected)`}
          </h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-900">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col relative z-20">
          {/* Date Range & Location - Side by Side */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Date Range Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setExpandedDateRange(!expandedDateRange);
                  setExpandedLocation(false);
                  setExpandedQuestion(null);
                }}
                className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg flex items-center justify-between transition-colors"
              >
                <div className="flex-1 text-left flex items-center gap-2">
                  <p className="font-semibold text-gray-900 text-sm">Date Range</p>
                  {(dateRange.startDate || dateRange.endDate) && (
                    <span className="inline-flex items-center justify-center w-5 h-5 bg-indigo-600 text-white text-xs font-medium rounded-full">
                      1
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-gray-600 transition-transform flex-shrink-0 ${
                    expandedDateRange ? "transform rotate-180" : ""
                  }`}
                />
              </button>

              {expandedDateRange && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg p-4 z-50 shadow-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={dateRange.startDate}
                        onChange={(e) =>
                          setDateRange({ ...dateRange, startDate: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={dateRange.endDate}
                        onChange={(e) =>
                          setDateRange({ ...dateRange, endDate: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Location Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setExpandedLocation(!expandedLocation);
                  setExpandedDateRange(false);
                  setExpandedQuestion(null);
                }}
                className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg flex items-center justify-between transition-colors"
              >
                <div className="flex-1 text-left flex items-center gap-2">
                  <p className="font-semibold text-gray-900 text-sm">Locations</p>
                  {selectedLocations.length > 0 && (
                    <span className="inline-flex items-center justify-center w-5 h-5 bg-indigo-600 text-white text-xs font-medium rounded-full">
                      {selectedLocations.length}
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-gray-600 transition-transform flex-shrink-0 ${
                    expandedLocation ? "transform rotate-180" : ""
                  }`}
                />
              </button>

              {expandedLocation && (
                <div className="absolute top-full right-0 mt-2 bg-white border border-gray-300 rounded-lg p-4 z-50 shadow-lg w-full">
                  {/* Search */}
                  <div className="mb-3 relative">
                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search locations..."
                      value={locationSearchTerm}
                      onChange={(e) => setLocationSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  {/* Location Checkboxes */}
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {filteredLocations.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-3">
                        No locations found
                      </p>
                    ) : (
                      filteredLocations.map((location) => (
                        <label
                          key={location}
                          className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedLocations.includes(location)}
                            onChange={() => handleLocationToggle(location)}
                            className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                          />
                          <span className="text-sm text-gray-900 truncate">
                            {location}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Questions Grid - 4 columns */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className="font-semibold text-gray-900">Questions</h3>
              {Object.values(filters).reduce((sum, answers) => sum + answers.length, 0) > 0 && (
                <span className="text-xs text-indigo-600 font-medium">
                  {Object.values(filters).reduce((sum, answers) => sum + answers.length, 0)} selected
                </span>
              )}
            </div>
            <div className="flex-1 pr-2 relative" style={{ overflowY: "auto" }} onScroll={() => setExpandedQuestion(null)}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative" style={{ overflow: "visible" }}>
                {questions.length === 0 ? (
                <div className="col-span-full text-center py-8 text-gray-500">
                  No questions available
                </div>
              ) : (
                questions.map((question) => {
                  const isExpanded = expandedQuestion === question.id;
                  const selectedAnswers = filters[question.id] || [];

                  return (
                    <div
                      key={question.id}
                      className="relative"
                    >
                      {/* Question Header */}
                      <button
                        onClick={(e) => {
                          if (expandedQuestion === question.id) {
                            setExpandedQuestion(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setDropdownRect({
                              top: rect.bottom,
                              left: rect.left,
                              width: rect.width
                            });
                            setExpandedQuestion(question.id);
                            setExpandedDateRange(false);
                            setExpandedLocation(false);
                          }
                        }}
                        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg flex items-center justify-between transition-colors"
                      >
                        <div className="flex-1 text-left min-w-0 flex items-center gap-2">
                          <p className="font-semibold text-gray-900 text-xs line-clamp-2 flex-1">
                            {question.text || "Unnamed Question"}
                          </p>
                          {selectedAnswers.length > 0 && (
                            <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 bg-indigo-600 text-white text-xs font-medium rounded-full">
                              {selectedAnswers.length}
                            </span>
                          )}
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-gray-600 transition-transform flex-shrink-0 ml-2 ${
                            isExpanded ? "transform rotate-180" : ""
                          }`}
                        />
                      </button>
                    </div>
                  );
                })
              )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-100 px-6 py-4 border-t border-gray-300 flex items-center justify-between gap-3 relative z-30">
          <button
            onClick={handleClearAll}
            className="px-4 py-2 text-gray-900 bg-white border border-gray-400 hover:bg-gray-50 text-sm font-medium rounded transition-colors"
          >
            Clear All
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-900 bg-white border border-gray-400 hover:bg-gray-50 text-sm font-medium rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-medium rounded transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>

        {/* Fixed Dropdown for Questions */}
        {expandedQuestion && dropdownRect && (() => {
          const question = questions.find(q => q.id === expandedQuestion);
          if (!question) return null;
          
          const selectedAnswers = filters[question.id] || [];
          const searchTerm = searchTerms[question.id] || "";
          const availableAnswers = getAvailableAnswersForQuestion(question.id);
          const filteredAnswers = availableAnswers.filter((answer) =>
            answer.toLowerCase().includes(searchTerm.toLowerCase())
          );

          return (
            <>
              <div className="fixed inset-0 z-[55]" onClick={() => setExpandedQuestion(null)} />
              <div 
                className="fixed bg-white border border-gray-300 rounded-lg p-3 z-[60] shadow-xl flex flex-col"
                style={{
                  top: dropdownRect.top + 4,
                  left: dropdownRect.left,
                  width: dropdownRect.width,
                  maxHeight: '300px'
                }}
              >
                {/* Search Input */}
                <div className="mb-3 relative flex-shrink-0">
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) =>
                      setSearchTerms({
                        ...searchTerms,
                        [question.id]: e.target.value,
                      })
                    }
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    autoFocus
                  />
                </div>

                {/* Select All / Clear All Buttons */}
                <div className="flex gap-2 mb-3 flex-shrink-0">
                  <button
                    onClick={() => {
                      setFilters((prev) => ({
                        ...prev,
                        [question.id]: availableAnswers,
                      }));
                    }}
                    className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => {
                      setFilters((prev) => ({
                        ...prev,
                        [question.id]: [],
                      }));
                    }}
                    className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-900 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
                  >
                    Clear All
                  </button>
                </div>

                {/* Answers List */}
                <div className="space-y-2 overflow-y-auto flex-1">
                  {filteredAnswers.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-2">
                      No answers
                    </p>
                  ) : (
                    filteredAnswers.map((answer) => {
                      const count = getAnswerCount(
                        question.id,
                        answer
                      );
                      const isSelected = selectedAnswers.includes(
                        answer
                      );

                      return (
                        <label
                          key={answer}
                          className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() =>
                              handleAnswerToggle(question.id, answer)
                            }
                            className="w-3 h-3 rounded border-gray-300 text-indigo-600 cursor-pointer flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-900 truncate">
                              {answer}
                            </p>
                          </div>
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            ({count})
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
