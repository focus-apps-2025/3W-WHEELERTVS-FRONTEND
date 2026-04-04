import React, { useState, useEffect, useMemo } from "react";
import { RefreshCw, CheckCircle2, AlertTriangle, FileText, Sparkles } from "lucide-react";
import type { FollowUpQuestion } from "../types";
import { useTheme } from "../context/ThemeContext";
import { questionTypes } from "../utils/questionTypes";
import DateTimeInput from "./QuestionTypes/DateTimeInput";
import FileInput from "./QuestionTypes/FileInput";
import GridQuestion from "./QuestionTypes/GridQuestion";
import RadioImageQuestion from "./QuestionTypes/RadioImageQuestion";
import RatingQuestion from "./QuestionTypes/RatingQuestion";
import RatingNumberQuestion from "./QuestionTypes/RatingNumberQuestion";
import SatisfactionRatingQuestion from "./QuestionTypes/SatisfactionRatingQuestion";
import ScaleQuestion from "./QuestionTypes/ScaleQuestion";
import SearchSelect from "./QuestionTypes/SearchSelect";
import ParagraphInput from "./QuestionTypes/ParagraphInput";
import SliderFeedback from "./QuestionTypes/SliderFeedback";
import EmojiStarFeedback from "./QuestionTypes/EmojiStarFeedback";
import EmojiReactionFeedback from "./QuestionTypes/EmojiReactionFeedback";
import ProductNPSBuckets from "./forms/ProductNPSBuckets";
import ChassisWithZone from "./forms/ChassisWithZone";
import ChassisWithoutZone from "./forms/ChassisWithoutZone";
import { apiClient } from "../api/client";

interface QuestionRendererProps {
  question: FollowUpQuestion;
  value: any;
  trackingValue?: any;
  onChange?: (value: any) => void;
  onTrackingChange?: (value: any) => void;
  readOnly?: boolean;
  isFollowUp?: boolean;
  error?: string;
  trackingError?: string;
  formId?: string;
  tenantSlug?: string;
  suggestedAnswers?: any[] | Record<string, any> | null;
  lastSuggestionSource?: string | null;
  onApplyFullSuggestion?: (specificAnswers?: Record<string, any>) => void;
  isFetchingSuggestions?: boolean;
  fetchingSuggestionsForId?: string | null;
}

const getRankStyle = (answer: any, darkMode: boolean = false) => {
  if (answer === null || answer === undefined) return "";
  // Ensure we stringify object/array answers for consistent hashing
  const str = typeof answer === 'object' ? JSON.stringify(answer) : String(answer).trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    { l: "bg-blue-50 text-blue-700 border-blue-200", d: "bg-blue-900/30 text-blue-300 border-blue-800" },
    { l: "bg-emerald-50 text-emerald-700 border-emerald-200", d: "bg-emerald-900/30 text-emerald-300 border-emerald-800" },
    { l: "bg-amber-50 text-amber-700 border-amber-200", d: "bg-amber-900/30 text-amber-300 border-amber-800" },
    { l: "bg-orange-50 text-orange-700 border-orange-200", d: "bg-orange-900/30 text-orange-300 border-orange-800" },
    { l: "bg-rose-50 text-rose-700 border-rose-200", d: "bg-rose-900/30 text-rose-300 border-rose-800" },
    { l: "bg-purple-50 text-purple-700 border-purple-200", d: "bg-purple-900/30 text-purple-300 border-purple-800" },
    { l: "bg-pink-50 text-pink-700 border-pink-200", d: "bg-pink-900/30 text-pink-300 border-pink-800" },
    { l: "bg-indigo-50 text-indigo-700 border-indigo-200", d: "bg-indigo-900/30 text-indigo-300 border-indigo-800" },
    { l: "bg-teal-50 text-teal-700 border-teal-200", d: "bg-teal-900/30 text-teal-300 border-teal-800" },
    { l: "bg-cyan-50 text-cyan-700 border-cyan-200", d: "bg-cyan-900/30 text-cyan-300 border-cyan-800" }
  ];
  const color = colors[Math.abs(hash) % colors.length];
  return darkMode ? color.d : color.l;
};

const getGoogleDriveDirectLink = (url: string) => {
  if (!url) return url;
  
  // Handle Google Drive view links (the format you have)
  if (url.includes('drive.google.com/file/d/') && url.includes('/view')) {
    const fileId = url.split('/d/')[1]?.split('/')[0];
    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
  }
  
  // Handle standard Google Drive sharing links
  if (url.includes('drive.google.com/file/d/')) {
    const fileId = url.split('/d/')[1]?.split('/')[0];
    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
  }
  
  // Handle Google Drive open links
  if (url.includes('drive.google.com/open?id=')) {
    const fileId = url.split('id=')[1]?.split('&')[0];
    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
  }

  // Handle uc?id= style
  if (url.includes('drive.google.com/uc?id=')) {
    const fileId = url.split('id=')[1]?.split('&')[0];
    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
  }

  // Handle direct download links
  if (url.includes('export=download')) {
    const fileId = url.match(/id=([^&]+)/)?.[1];
    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
  }

  return url;
};

const isImageUrl = (fileUrl: string) => {
  if (!fileUrl) {
    return false;
  }
  try {
    const parsed = JSON.parse(fileUrl);
    if (parsed.url) {
      return isImageUrl(parsed.url);
    }
  } catch {
    // Not JSON, continue with regular check
  }
  if (fileUrl.startsWith("data:")) {
    return fileUrl.startsWith("data:image");
  }
  
  // Check for Google Drive image URLs
  if (fileUrl.includes('lh3.googleusercontent.com/d/')) {
    return true;
  }
  
  if (fileUrl.includes('drive.google.com/thumbnail')) {
    return true;
  }
  
  return /\.(png|jpg|jpeg|gif|bmp|webp|svg)$/i.test(fileUrl);
};

export default function QuestionRenderer({
  question,
  value,
  trackingValue,
  onChange,
  onTrackingChange,
  readOnly = false,
  isFollowUp = false,
  formId,
  tenantSlug,
  suggestedAnswers,
  lastSuggestionSource,
  onApplyFullSuggestion,
  isFetchingSuggestions = false,
  fetchingSuggestionsForId = null,
  error,
  trackingError,
}: QuestionRendererProps) {
  const { darkMode } = useTheme();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [loadingRank, setLoadingRank] = useState(false);
  const [previousAnswers, setPreviousAnswers] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const imageUrl = getGoogleDriveDirectLink(question.imageUrl || "");
  const isImage = isImageUrl(imageUrl);

  const isRankTrackingEnabled =
    question.trackResponseRank === true ||
    String(question.trackResponseRank) === "true";

  const isQuestionTrackingEnabled =
    question.trackResponseQuestion === true ||
    String(question.trackResponseQuestion) === "true";

  const isTrackingEnabled = isRankTrackingEnabled || isQuestionTrackingEnabled;

  const trackingInputType = question.trackResponseQuestionType || "text";
  const trackingInputLabel = question.trackResponseQuestionLabel || "Tracking Question";

  // Determine which value to use for fetching rank
  const effectiveTrackingValue = useMemo(() => {
    const val = (isQuestionTrackingEnabled && trackingValue) ? trackingValue : value;
    if (typeof val === 'object' && val !== null) {
      return (val as any).chassisNumber || "";
    }
    return val || "";
  }, [isQuestionTrackingEnabled, trackingValue, value]);

  useEffect(() => {
    const fetchRank = async () => {
      if (
        isRankTrackingEnabled &&
        effectiveTrackingValue !== undefined &&
        effectiveTrackingValue !== null &&
        effectiveTrackingValue !== "" &&
        formId
      ) {
        try {
          setLoadingRank(true);
          const response = await apiClient.getResponseRank(
            formId,
            question.id || (question as any)._id,
            effectiveTrackingValue,
            tenantSlug,
          );
          if (response && typeof response.rank === "number") {
            setRank(response.rank);
          }
        } catch (err) {
          console.error("Failed to fetch rank:", err);
        } finally {
          setLoadingRank(false);
        }
      } else {
        setRank(null);
      }
    };

    fetchRank();
  }, [
    isRankTrackingEnabled,
    effectiveTrackingValue,
    question.id,
    (question as any)._id,
    formId,
    tenantSlug,
  ]);

  useEffect(() => {
    const fetchPreviousAnswers = async () => {
      if ((isRankTrackingEnabled || isQuestionTrackingEnabled) && formId) {
        try {
          setLoadingSuggestions(true);
          const response = await apiClient.getQuestionPreviousAnswers(
            formId,
            question.id || (question as any)._id,
            tenantSlug,
          );
          if (response && Array.isArray(response.answers)) {
            // Filter out empty or null answers
            const filteredAnswers = response.answers.filter(
              (a) => a && typeof a === "string" && a.trim() !== "",
            );
            setPreviousAnswers(filteredAnswers);
          }
        } catch (err) {
          console.error("Failed to fetch previous answers:", err);
        } finally {
          setLoadingSuggestions(false);
        }
      }
    };

    fetchPreviousAnswers();
  }, [
    isRankTrackingEnabled,
    isQuestionTrackingEnabled,
    question.id,
    (question as any)._id,
    formId,
    tenantSlug,
  ]);

  const getSuggestedValue = (qId: string) => {
    if (!suggestedAnswers || suggestedAnswers._no_match) return null;
    
    // If suggestedAnswers is an array of records (new behavior)
    if (Array.isArray(suggestedAnswers)) {
      if (suggestedAnswers.length === 0) return null;
      // For inline matches, we check if ANY of the top suggestions has this value
      // but to be consistent with "Match" badge, we'll use the FIRST (highest rank) record
      const firstRecordAnswers = suggestedAnswers[0].answers;
      
      const normalize = (s: string) => 
        s.toLowerCase().replace(/_tracking$/, "").replace(/^_/, "").trim();

      const normalizedTarget = normalize(qId);
      if (firstRecordAnswers[qId] !== undefined) return firstRecordAnswers[qId];

      const matchKey = Object.keys(firstRecordAnswers).find((key) => {
        if (key.startsWith("_") && !key.includes("tracking")) return false;
        return normalize(key) === normalizedTarget;
      });

      return matchKey ? firstRecordAnswers[matchKey] : null;
    }
    
    // Legacy behavior (if suggestedAnswers is a flat object)
    const normalize = (s: string) => 
      s.toLowerCase().replace(/_tracking$/, "").replace(/^_/, "").trim();

    const normalizedTarget = normalize(qId);

    // Try exact match first
    if (suggestedAnswers[qId] !== undefined) return suggestedAnswers[qId];

    // Fuzzy matching
    const matchKey = Object.keys(suggestedAnswers).find((key) => {
      if (key.startsWith("_") && !key.includes("tracking")) return false;
      return normalize(key) === normalizedTarget;
    });

    return matchKey ? suggestedAnswers[matchKey] : null;
  };

  const [isFocused, setIsFocused] = useState(false);

  const qId = question.id || (question as any)._id;
  const suggestedValue = getSuggestedValue(qId);
  
  // Only show match/suggestions if the user has interacted with this field 
  // or if it's the one that explicitly triggered the current fetch
  const isSearchSource = lastSuggestionSource?.startsWith(`${qId}:`);
  const shouldShowMatchInfo = isFocused || (value && String(value).trim() !== "") || isSearchSource;

  const hasMatch = shouldShowMatchInfo && suggestedValue !== undefined && suggestedValue !== null && String(suggestedValue).trim() !== "";
  
  const isApplied = hasMatch && (() => {
    if (typeof suggestedValue === 'object') {
      return JSON.stringify(value) === JSON.stringify(suggestedValue);
    }
    const normalize = (s: any) => String(s || "").trim().toLowerCase();
    return normalize(value) === normalize(suggestedValue);
  })();

  const renderSuggestions = () => {
    if (readOnly) return null;

    const rankedSuggestions = Array.isArray(suggestedAnswers) 
      ? suggestedAnswers.map(s => {
          const normalize = (str: string) => 
            String(str || "").toLowerCase().replace(/_tracking$/, "").replace(/^_/, "").trim();
          const target = normalize(qId);
          const matchKey = Object.keys(s.answers).find(k => normalize(k) === target);
          const val = matchKey ? s.answers[matchKey] : null;
          return { rank: s.rank, value: val };
        }).filter(s => s.value !== null && s.value !== undefined && String(s.value).trim() !== "")
      : [];

    const hasRanked = false; // Hidden as per user request
    const hasPrevious = false; // Hidden as per user request

    if (!hasRanked && !hasPrevious) return null;

    return (
      <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
        {hasRanked && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <div className="flex items-center gap-1.5 mr-1 opacity-60">
              <Sparkles className="h-2.5 w-2.5 text-emerald-500" />
              <span className="text-[8px] font-black uppercase tracking-widest">Ranked Records</span>
            </div>
            {rankedSuggestions.map((s, idx) => {
              const isSelected = value === s.value;
              return (
                <button
                  key={`rank-${idx}`}
                  type="button"
                  title={String(s.value)}
                  onClick={() => onChange && onChange(s.value)}
                  className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-bold border transition-all ${
                    isSelected
                      ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                      : darkMode
                        ? "bg-emerald-900/20 border-emerald-800 text-emerald-300 hover:border-emerald-700 hover:bg-emerald-900/30"
                        : "bg-emerald-50 border-emerald-100 text-emerald-600 hover:border-emerald-200 hover:bg-white hover:shadow-sm"
                  }`}
                >
                  <span className="text-[9px] opacity-70">#{s.rank}</span>
                  <span className="max-w-[100px] truncate">{String(s.value)}</span>
                </button>
              );
            })}
          </div>
        )}

        {hasPrevious && (
          <div className="flex flex-wrap gap-1.5 items-center pt-1 border-t border-slate-100/50 dark:border-slate-800/50">
            <div className="flex items-center gap-1.5 mr-1 opacity-60">
              <FileText className="h-2.5 w-2.5 text-blue-500" />
              <span className="text-[8px] font-black uppercase tracking-widest">Global History</span>
            </div>
            {previousAnswers.map((ans, idx) => {
              const isSelected = value === ans;
              // Don't repeat if already in ranked
              if (rankedSuggestions.some(rs => String(rs.value) === String(ans))) return null;

              return (
                <button
                  key={`prev-${idx}`}
                  type="button"
                  onClick={() => onChange && onChange(ans)}
                  className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                    isSelected
                      ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                      : darkMode
                        ? "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600 hover:bg-slate-700"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-white hover:shadow-sm"
                  }`}
                >
                  {String(ans)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderLoadingIndicator = () => {
    return null; // Hidden as per user request to only show in sidebar
  };

  const renderNoMatchIndicator = () => {
    return null; // Hidden as per user request to only show in sidebar
  };

  const getBorderClass = (isTrackingField: boolean = false) => {
    if (isApplied) return darkMode ? "border-emerald-500/50 bg-emerald-500/5 ring-4 ring-emerald-500/10" : "border-emerald-500 bg-emerald-50/30 ring-4 ring-emerald-500/10";
    if (isTrackingField) return darkMode ? "bg-blue-900/10 border-blue-800 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10" : "bg-blue-50/50 border-blue-200 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10";
    return darkMode ? "bg-slate-900/50 border-slate-800 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10" : "bg-white/50 border-slate-200 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10";
  };

  const renderFullSuggestionPrompt = () => {
    return null; // Hidden as per user request to only show in sidebar or as inline badge
  };

  const renderInput = () => {
    const effectiveType = question.type;

    const renderInputWrapper = (children: React.ReactNode) => {
      return (
        <div className="relative group/input">
          {children}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
            {hasMatch && !isApplied && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 animate-in fade-in zoom-in-95">
                <Sparkles className="h-2.5 w-2.5" />
                <span className="text-[8px] font-black uppercase">Match</span>
              </div>
            )}
            {isApplied && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 animate-in fade-in zoom-in-95">
                <CheckCircle2 className="h-2.5 w-2.5" />
                <span className="text-[8px] font-black uppercase">Filled</span>
              </div>
            )}
          </div>
        </div>
      );
    };

    switch (effectiveType) {
      case "paragraph":
      case "textarea":
        return renderInputWrapper(
          <div className="space-y-1">
            <ParagraphInput
              question={question}
              value={value}
              onChange={onChange || (() => {})}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              readOnly={readOnly}
              error={!!error}
              className={getBorderClass()}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>
        );

      case "search-select":
        return renderInputWrapper(
          <div className="space-y-1">
            <SearchSelect
              options={
                question.options?.map((opt) => ({ value: opt, label: opt })) || []
              }
              value={value || ""}
              onChange={onChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Select an option..."
              required={question.required}
              readOnly={readOnly}
              error={!!error}
              className={getBorderClass()}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>
        );

      case "select":
        return renderInputWrapper(
          <div className="space-y-1">
            <select
              value={value || ""}
              onChange={(e) => !readOnly && onChange && onChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              required={question.required}
              disabled={readOnly}
              className={`w-full px-3 py-1.5 border rounded-xl text-[11px] font-medium transition-all duration-300 ${getBorderClass()} ${readOnly ? "opacity-50 cursor-not-allowed" : ""} ${
                error ? "border-red-500 ring-4 ring-red-500/10" : ""
              }`}
            >
              <option value="">Select an option</option>
              {question.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>
        );

      case "yesNoNA":
      case "radio":
      case "checkbox": {
        const options =
          question.options && question.options.length > 0
            ? question.options
            : question.type === "yesNoNA"
            ? ["Yes", "No", "N/A"]
            : [];
        const inputType = question.type === "checkbox" ? "checkbox" : "radio";
        return renderInputWrapper(
          <div className="space-y-1">
            <div className="grid gap-2">
              {options.map((option) => {
                const isSelected =
                  question.type === "checkbox"
                    ? Array.isArray(value) && value.includes(option)
                    : value === option;
                return (
                  <label
                    key={option}
                    className={`flex items-center space-x-3 cursor-pointer p-2 rounded-lg border transition-all duration-200 ${
                      isSelected
                        ? isApplied
                          ? "border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/10 ring-4 ring-emerald-500/5"
                          : "border-blue-500/50 bg-blue-500/5 dark:bg-blue-500/10"
                        : error
                        ? "border-red-500 bg-red-50/50 dark:bg-red-500/5"
                        : "border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="relative flex items-center">
                      <input
                        type={inputType}
                        name={question.id}
                        value={option}
                        checked={isSelected}
                        onChange={(e) => {
                          if (readOnly) return;
                          if (question.type === "checkbox") {
                            const newValue = Array.isArray(value) ? [...value] : [];
                            if (e.target.checked) {
                              newValue.push(option);
                            } else {
                              const index = newValue.indexOf(option);
                              if (index > -1) {
                                newValue.splice(index, 1);
                              }
                            }
                            onChange && onChange(newValue);
                          } else {
                            onChange && onChange(option);
                          }
                        }}
                        required={question.required && !value}
                        disabled={readOnly}
                        className={`h-3.5 w-3.5 ${
                          isApplied ? "text-emerald-600 focus:ring-emerald-500/20" : "text-blue-600 focus:ring-blue-500/20"
                        } border-slate-300 dark:border-slate-700 dark:bg-slate-900 ${
                          readOnly ? "cursor-not-allowed" : ""
                        } ${question.type === "radio" ? "rounded-full" : "rounded"}`}
                      />
                    </div>
                    <span
                      className={`text-[11px] font-bold ${
                        isApplied && isSelected
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-slate-700 dark:text-slate-300"
                      } transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400`}
                    >
                      {option}
                    </span>
                  </label>
                );
              })}
            </div>
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>
        );
      }

      case "chassisNumber":
        return (
          <GridQuestion
            question={{
              ...question,
              gridOptions: {
                rows: question.options || [],
                columns: ["Yes", "No", "N/A"],
              },
            } as any}
            value={value || {}}
            onChange={onChange}
            type="radio"
            readOnly={readOnly}
          />
        );
      case "radio-grid":
      case "checkbox-grid":
        return renderInputWrapper(
          <div className="space-y-1">
            <GridQuestion
              question={question}
              value={value || {}}
              onChange={onChange || (() => {})}
              type={question.type === "radio-grid" ? "radio" : "checkbox"}
              readOnly={readOnly}
              error={!!error}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>
        );

      case "radio-image":
        return renderInputWrapper(
          <div className="space-y-1">
            <RadioImageQuestion
              question={question}
              value={value}
              onChange={onChange || (() => {})}
              error={!!error}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>
        );

      case "rating":
        return renderInputWrapper(
          <div className="space-y-1">
            <RatingQuestion
              question={question}
              value={value}
              onChange={onChange || (() => {})}
              readOnly={readOnly}
              error={!!error}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>
        );
      case "rating-number":
        return renderInputWrapper(
          <div className="space-y-1">
            <RatingNumberQuestion
              question={question}
              value={value}
              onChange={onChange || (() => {})}
              readOnly={readOnly}
              error={!!error}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>
        );

      case "satisfaction-rating":
        return renderInputWrapper(
          <div className="space-y-1">
            <SatisfactionRatingQuestion
              question={question}
              value={value}
              onChange={onChange || (() => {})}
              readOnly={readOnly}
              error={!!error}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>
        );

      case "scale":
        return renderInputWrapper(
          <div className="space-y-1">
            <ScaleQuestion
              question={question}
              value={value}
              onChange={onChange || (() => {})}
              readOnly={readOnly}
              error={!!error}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>
        );

      case "slider-feedback":
        return renderInputWrapper(
          <div className="space-y-1">
            <SliderFeedback
              question={question}
              value={value}
              onChange={onChange || (() => {})}
              readOnly={readOnly}
              error={!!error}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>
        );

      case "emoji-star-feedback":
        return renderInputWrapper(
          <div className="space-y-1">
            <EmojiStarFeedback
              question={question}
              value={value}
              onChange={onChange || (() => {})}
              readOnly={readOnly}
              error={!!error}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>
        );

      case "emoji-reaction-feedback":
        return renderInputWrapper(
          <div className="space-y-1">
            <EmojiReactionFeedback
              question={question}
              value={value}
              onChange={onChange || (() => {})}
              readOnly={readOnly}
              error={!!error}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>
        );

      case "productNPSTGWBuckets":
        return renderInputWrapper(
          <div className="space-y-1">
            <ProductNPSBuckets
              value={value}
              onChange={onChange || (() => {})}
              disabled={readOnly}
              error={!!error}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>
        );

      case "chassis-with-zone":
        return renderInputWrapper(
          <div className="space-y-1">
            <ChassisWithZone
              value={value}
              onChange={(val) => {
                if (onChange) onChange(val);
                if (isQuestionTrackingEnabled && onTrackingChange && val?.chassisNumber !== trackingValue) {
                  onTrackingChange(val?.chassisNumber || "");
                }
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={readOnly}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>
        );

      case "chassis-without-zone":
        return renderInputWrapper(
          <div className="space-y-1">
            <ChassisWithoutZone
              value={value}
              onChange={(val) => {
                if (onChange) onChange(val);
                if (isQuestionTrackingEnabled && onTrackingChange && val?.chassisNumber !== trackingValue) {
                  onTrackingChange(val?.chassisNumber || "");
                }
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={readOnly}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>
        );

      case "file":
        return renderInputWrapper(
          <div className="space-y-1">
            <FileInput
              question={question}
              value={value}
              onChange={onChange || (() => {})}
              readOnly={readOnly}
              isValidationError={!!error}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>
        );

      case "date":
      case "time":
        return renderInputWrapper(
          <div className="space-y-1">
            <DateTimeInput
              question={question}
              value={value}
              onChange={onChange || (() => {})}
              readOnly={readOnly}
              error={!!error}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>
        );

      default:
        return renderInputWrapper(
          <div className="space-y-1">
            <input
              type={effectiveType}
              value={value || ""}
              onChange={(e) => !readOnly && onChange && onChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              required={question.required}
              disabled={readOnly}
              className={`w-full px-3 py-1.5 border rounded-xl text-[11px] font-medium transition-all duration-300 ${getBorderClass()} ${readOnly ? "opacity-50 cursor-not-allowed" : ""} ${
                error ? "border-red-500 ring-4 ring-red-500/10" : ""
              }`}
              placeholder={`Enter ${effectiveType === 'email' ? 'email' : (effectiveType === 'number' ? 'number' : 'response')}...`}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>
        );
    }
  };

  const renderTrackingInput = () => {
    if (!isQuestionTrackingEnabled) return null;

    if (question.type?.startsWith("chassis-")) {
      return (
        <div className="mt-4 mb-2 space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
          <label className={`block font-bold text-[11px] tracking-tight ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
            {trackingInputLabel}
            <span className="text-red-500 ml-1.5">*</span>
          </label>
        </div>
      );
    }

    return (
      <div className="mt-4 space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
        <label className={`block font-bold text-[11px] tracking-tight ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
          {trackingInputLabel}
          <span className="text-red-500 ml-1.5">*</span>
        </label>
        <div className="space-y-1">
          <input
            type={trackingInputType}
            value={trackingValue || ""}
            onChange={(e) => !readOnly && onTrackingChange && onTrackingChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            required
            disabled={readOnly}
            className={`w-full px-3 py-1.5 border rounded-xl text-[11px] font-medium transition-all duration-300 ${getBorderClass(true)} ${readOnly ? "opacity-50 cursor-not-allowed" : ""} ${
              trackingError ? "border-red-500 ring-4 ring-red-500/10" : ""
            }`}
            placeholder={`Enter ${trackingInputType === 'email' ? 'email' : (trackingInputType === 'number' ? 'number' : 'tracking response')}...`}
          />
          {trackingError && (
            <p className="text-[9px] font-bold text-red-500 mt-1">{trackingError}</p>
          )}
        </div>
      </div>
    );
  };

  const questionText = question.text?.trim() || "";
  const showLabel = questionText.length > 0;

  const activeError = error || validationError;

  return (
    <div className="space-y-3" data-error={!!activeError}>
 {imageUrl ? (
  <div className="relative inline-flex mb-2">
    {isImage ? (
      <img
        src={imageUrl}
        alt={questionText || "Question image"}
        className="max-h-48 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 object-contain shadow-sm"
        onError={(e) => {
          // If image fails to load (e.g., due to permissions), show download option
          e.currentTarget.style.display = 'none';
          const parent = e.currentTarget.parentElement;
          if (parent) {
            // Extract file ID for download link
            const fileId = imageUrl.match(/id=([^&]+)/)?.[1];
            const downloadUrl = fileId 
              ? `https://drive.google.com/uc?export=download&id=${fileId}`
              : imageUrl;
            
            const downloadDiv = document.createElement('div');
            downloadDiv.className = 'flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm';
            downloadDiv.innerHTML = `
              <div class="p-2 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
              </div>
              <div class="flex flex-col">
                <span class="text-[11px] font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                  Google Drive File (Preview Not Available)
                </span>
                <a href="${downloadUrl}" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   class="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold">
                  Download File
                </a>
              </div>
            `;
            parent.appendChild(downloadDiv);
          }
        }}
      />
    ) : (
      // File download UI for non-images
      <div className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="p-2 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
          <FileText className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
            {imageUrl.split('/').pop() || "Question File"}
          </span>
          <a 
            href={imageUrl.includes('thumbnail') 
              ? imageUrl.replace('thumbnail', 'uc?export=download')
              : imageUrl}
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold"
          >
            Download File
          </a>
        </div>
      </div>
    )}
    {question.required && !showLabel ? (
      <span className="absolute top-1.5 right-1.5 text-base font-bold text-red-500">*</span>
    ) : null}
  </div>
) : null}
      {showLabel ? (
        <label className={`block font-bold text-[13px] tracking-tight ${darkMode ? 'text-white/90' : 'text-slate-900'}`}>
          <div className="flex items-center gap-2">
            {questionText}
            {question.required && <span className="text-red-500">*</span>}
            {hasMatch && !isApplied && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-500 border border-blue-500/20 animate-pulse">
                <Sparkles className="h-2 w-2" /> Match Available
              </span>
            )}
            {isApplied && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <CheckCircle2 className="h-2 w-2" /> Auto-Filled
              </span>
            )}
          </div>
          {loadingRank && (
            <span className="ml-2 inline-flex items-center">
              <span className="animate-spin h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full"></span>
            </span>
          )}
          {rank !== null && !loadingRank && (
            <div className="flex flex-col gap-1 ml-2">
              {(question.trackResponseRankLabel || question.trackResponseQuestionLabel) && (
                <span className={`text-[9px] font-bold uppercase tracking-wider ${isApplied ? (darkMode ? 'text-emerald-400' : 'text-emerald-600') : (darkMode ? 'text-blue-400' : 'text-blue-600')}`}>
                  {question.trackResponseRankLabel || question.trackResponseQuestionLabel}
                </span>
              )}
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center px-1.5 min-w-[22px] h-5 rounded-full border text-[10px] justify-center font-bold ${isApplied ? (darkMode ? 'bg-emerald-900/30 text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200') : getRankStyle(effectiveTrackingValue, darkMode)}`}>
                  #{rank}
                </span>
                {rank > 1 && (
                  <span className={`text-[10px] font-bold ${isApplied ? (darkMode ? 'text-emerald-400' : 'text-emerald-600') : (darkMode ? 'text-blue-400' : 'text-blue-600')} animate-in fade-in duration-300`}>
                    {isApplied ? '(Applied)' : '(Match Found)'}
                  </span>
                )}
              </div>
            </div>
          )}
        </label>
      ) : null}
      {question.description ? (
        <p className={`text-[10px] font-medium leading-relaxed mb-3 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>{question.description}</p>
      ) : null}
      {(question.subParam1 || question.subParam2) && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {question.subParam1 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-[0.15em] bg-blue-500/10 text-blue-500 border border-blue-500/20">
              {question.subParam1}
            </span>
          )}
          {question.subParam2 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-[0.15em] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              {question.subParam2}
            </span>
          )}
        </div>
      )}
      <div className="mt-2">
        {renderTrackingInput()}
        <div className="mt-4">
          {renderInput()}
        </div>
        {renderFullSuggestionPrompt()}
      </div>
      {activeError && (
        <p className="text-[10px] font-bold text-red-500 mt-1 animate-in fade-in slide-in-from-top-1">
          {activeError}
        </p>
      )}
    </div>
  );
}