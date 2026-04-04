import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Eye,
  Calendar,
  FileText,
  User,
  X,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  Trash2,
  Edit2,
  BarChart3,
  PieChart,
  Activity,
  Zap,
  Target,
  Award,
  Users,
  FileCheck,
  AlertTriangle,
  Save,
  ChevronDown,
  MapPin,
  ArrowLeft,
  TrendingUp,
} from "lucide-react";
import { Bar, Line, Pie, Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
  RadialLinearScale,
} from "chart.js";
import type { ActiveElement } from "chart.js";
import { apiClient } from "../api/client";
import { formatTimestamp } from "../utils/dateUtils";
import { useNotification } from "../context/NotificationContext";
import { useLogo } from "../context/LogoContext";
import { generateResponseExcelReport } from "../utils/responseExportUtils";
import { ProgressCallback, generateAndDownloadPDF, exportAllResponsesToZip } from "../utils/pdfExportUtils";
import FilePreview from "./FilePreview";
import ResponseEdit from "./ResponseEdit";
import DashboardSummaryCard from "./DashboardSummaryCard";
import { isImageUrl } from "../utils/answerTemplateUtils";
import ImageLink from "./ImageLink";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
  RadialLinearScale
);

function formatSectionLabel(label: string, maxLength = 20): string {
  if (!label) {
    return "";
  }
  const parts = label.match(/[A-Za-z0-9]+/g) || [];
  if (!parts.length) {
    return "";
  }
  const camel = parts
    .map((part, index) => {
      const lower = part.toLowerCase();
      if (index === 0) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
  if (!camel) {
    return "";
  }
  const formatted = camel.charAt(0).toUpperCase() + camel.slice(1);
  return formatted.length > maxLength
    ? `${formatted.slice(0, maxLength - 3)}...`
    : formatted;
}

const getRankStyle = (answer: any, darkMode: boolean = false) => {
  if (answer === null || answer === undefined) return "";
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

interface Form {
  _id: string;
  id?: string;
  title: string;
  description?: string;
  parentFormId?: string;
  sections?: any[];
  followUpQuestions?: any[];
}

interface LocationData {
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  isp?: string;
}

interface SubmissionMetadata {
  ipAddress?: string;
  userAgent?: string;
  browser?: string;
  device?: string;
  os?: string;
  location?: LocationData;
  submittedAt?: string;
}

interface Response {
  _id: string;
  id: string;
  questionId: string;
  formId?: string;
  parentResponseId?: string;
  answers: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  status?: string;
  yesNoScore?: {
    yes: number;
    total: number;
  };
  responseRanks?: Record<string, number>;
  submissionMetadata?: SubmissionMetadata;
  dealerName?: string;
}

type SectionStat = {
  id: string;
  title: string;
  yes: number;
  no: number;
  na: number;
  correct: number;
  wrong: number;
  total: number;
  answeredCount: number;
  weightage: number;
  hasYesNo: boolean;
};

export default function ResponseDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError, showConfirm } = useNotification();
  const { logo } = useLogo();

  const [response, setResponse] = useState<Response | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"dashboard" | "responses">(
    "dashboard"
  );
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [selectedPDFType, setSelectedPDFType] = useState<
    "no-only" | "yes-only" | "both" | "na-only" | "section" | "default" | "responses-view" | null
  >(null);
  const [editingResponse, setEditingResponse] = useState<Response | null>(null);
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editingFormLoading, setEditingFormLoading] = useState(false);
  const [expandResponseRateBreakdown, setExpandResponseRateBreakdown] =
    useState(false);
  const [showWeightageColumns, setShowWeightageColumns] = useState(false);
  const [addWeightMode, setAddWeightMode] = useState(false);
  const [showWeightageCheckbox, setShowWeightageCheckbox] = useState(true);
  const [editingAllWeightages, setEditingAllWeightages] = useState(false);
  const [weightageValues, setWeightageValues] = useState<Record<string, string>>({});
  const [showPDFTypeSelector, setShowPDFTypeSelector] = useState(false);
  const [savingWeightage, setSavingWeightage] = useState(false);
  const [redistributionMode, setRedistributionMode] = useState(false);
  const [tempWeightageValues, setTempWeightageValues] = useState<Record<string, string>>({});
  const [weightageBalance, setWeightageBalance] = useState(0);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isCancelledRef = useRef<boolean>(false);
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(null);
  const [sectionChartTypes, setSectionChartTypes] = useState<Record<string, "pie" | "bar">>({});
  const [showMainParamsImages, setShowMainParamsImages] = useState<Record<string, boolean>>({});
  const [showSectionsPDFModal, setShowSectionsPDFModal] = useState(false);
  const [downloadingSectionsPDF, setDownloadingSectionsPDF] = useState(false);
  const [autoOpenSectionId, setAutoOpenSectionId] = useState<string | null>(null);
 


  const [pdfProgress, setPdfProgress] = useState<{
  stage: 'uploading' | 'generating' | 'downloading' | 'complete' | 'error';
  percentage: number;
  message?: string;
} | null>(null);

const [pdfDownloadProgress, setPdfDownloadProgress] = useState<number | null>(null);

  useEffect(() => {
    fetchResponseDetails();
  }, [id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.pdf-type-selector')) {
        setShowPDFTypeSelector(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (location.state?.viewMode) {
      setViewMode(location.state.viewMode);
    }
  }, [location.state]);

  useEffect(() => {
    if (autoOpenSectionId) {
      const element = document.getElementById(`section-detail-${autoOpenSectionId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [autoOpenSectionId]);

  useEffect(() => {
    if (form?.sections) {
      const initialShowImages: Record<string, boolean> = {};
      form.sections.forEach((section: any) => {
        initialShowImages[section.id] = true;
      });
      setShowMainParamsImages(initialShowImages);
    }
  }, [form]);

  const complianceLabels = useMemo(() => {
    const defaultLabels = { yes: "Yes", no: "No", na: "N/A" };
    let labels = { ...defaultLabels };
    
    if (form?.sections) {
      // First pass: look for any question that has non-default labels
      for (const section of form.sections) {
        if (section.questions) {
          for (const q of section.questions) {
            // Check for yesNoNA type and at least 2 options
            if (q.type === "yesNoNA" && q.options && q.options.length >= 2) {
              const hasCustomLabels = 
                q.options[0] !== "Yes" || 
                q.options[1] !== "No" || 
                (q.options[2] && q.options[2] !== "N/A");
              
              if (hasCustomLabels) {
                return {
                  yes: q.options[0] || "Yes",
                  no: q.options[1] || "No",
                  na: q.options[2] || "N/A"
                };
              }
              
              // If we haven't found custom labels yet, store the first yesNoNA labels we find as fallback
              if (labels.yes === "Yes") {
                labels.yes = q.options[0] || "Yes";
                labels.no = q.options[1] || "No";
                labels.na = q.options[2] || "N/A";
              }
            }
          }
        }
      }
    }
    return labels;
  }, [form]);

  const fetchResponseDetails = async () => {
    try {
      setLoading(true);
      if (!id) {
        throw new Error("Response ID is required");
      }
      const responsesData = await apiClient.getResponses();
      const selectedResponse = responsesData.responses.find(
        (r: any) => r._id === id || r.id === id || String(r._id) === id || String(r.id) === id
      );

      if (!selectedResponse) {
        console.error("Response not found. Looking for ID:", id);
        console.error("Available response IDs:", responsesData.responses.map((r: any) => ({ _id: r._id, id: r.id })));
        throw new Error(`Response with ID "${id}" not found. Please check if the response exists.`);
      }

      const formIdentifier = selectedResponse.questionId || selectedResponse.formId;
      if (!formIdentifier) {
        throw new Error("Missing form identifier for response");
      }
      
      const formData = await apiClient.getForm(formIdentifier);
      const selectedForm = formData.form;

      if (selectedForm?.sections) {
        selectedForm.sections.forEach((section: any) => {
          if (section.questions) {
            section.questions.forEach((question: any) => {
              if (!Array.isArray(question.followUpQuestions)) {
                question.followUpQuestions = [];
              }
            });
          }
        });
      }

      if (!Array.isArray(selectedForm.followUpQuestions)) {
        selectedForm.followUpQuestions = [];
      }

      setResponse(selectedResponse);
      setForm(selectedForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load response");
      console.error("Error loading response details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!response) return;

    setUpdatingStatus(true);
    try {
      await apiClient.updateResponse(response._id, { status: newStatus });
      setResponse({ ...response, status: newStatus });
      setShowStatusUpdate(false);
      showSuccess(`Status updated to ${getStatusInfo(newStatus).label}`);
    } catch (err) {
      console.error("Failed to update status:", err);
      showError("Failed to update status. Please try again.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleEditResponse = async () => {
    if (!response) return;

    setEditingResponse(response);
    setEditingForm(null);
    setEditingFormLoading(true);
    try {
      const formIdentifier = response.questionId || response.formId;
      if (!formIdentifier) {
        throw new Error("Missing form identifier for response");
      }
      const formData = await apiClient.getForm(formIdentifier);
      const loadedForm = formData.form;

      if (loadedForm?.sections) {
        loadedForm.sections.forEach((section: any) => {
          if (section.questions) {
            section.questions.forEach((question: any) => {
              if (!Array.isArray(question.followUpQuestions)) {
                question.followUpQuestions = [];
              }
            });
          }
        });
      }

      if (!Array.isArray(loadedForm.followUpQuestions)) {
        loadedForm.followUpQuestions = [];
      }

      setEditingForm(loadedForm);
    } catch (err) {
      console.error("Failed to load form for editing:", err);
      showError("Failed to load form for editing. Please try again.");
      setEditingResponse(null);
    } finally {
      setEditingFormLoading(false);
    }
  };

  const handleCloseEdit = () => {
    setEditingResponse(null);
    setEditingForm(null);
    setSavingEdit(false);
    setEditingFormLoading(false);
  };

  const handleSaveEditedResponse = async (updated: any) => {
    if (savingEdit || !response) return;

    setSavingEdit(true);
    try {
      await apiClient.updateResponse(response._id, {
        answers: updated.answers,
      });
      setResponse(updated);
      handleCloseEdit();
      showSuccess("Response updated successfully.");
    } catch (err) {
      console.error("Failed to save response:", err);
      showError("Failed to save response. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleExportExcel = async (type?: 'yes-only' | 'no-only' | 'na-only' | 'both' | 'default') => {
    if (!response || !form) return;

    setExportingExcel(true);
    try {
      // If type is not provided, default to 'default' (full report)
      const exportType = type || 'default';
      
      const fileName = `${form.title}_${exportType !== 'default' ? exportType + '_' : ''}${formatTimestamp(
        response.createdAt
      )}.xlsx`;
      
      await generateResponseExcelReport([response], form, fileName, exportType);
      showSuccess("Excel file downloaded successfully.");
    } catch (err) {
      console.error("Failed to export Excel:", err);
      showError("Failed to export Excel. Please try again.");
    } finally {
      setExportingExcel(false);
    }
  };

  const handleDeleteResponse = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete this response? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      await apiClient.deleteResponse(id!);
      showSuccess("Response deleted successfully");
      navigate("/responses/all");
    } catch (err) {
      console.error("Failed to delete response:", err);
      showError("Failed to delete response");
    }
  };

  const handleDownloadPDF = async (type?: 'yes-only' | 'no-only' | 'na-only' | 'both' | 'section' | 'default' | 'responses-view') => {
    if (!response || !form) return;

    setShowPDFTypeSelector(false);
    
    if (type === 'section') {
      setShowSectionsPDFModal(true);
      return;
    }
    
    await handleDownloadPDFNow(type);
  };
 
  const handleDownloadSectionsPDF = async () => {
    if (!response || !form) return;

    setDownloadingSectionsPDF(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      await handleDownloadPDFNow('section');
      setShowSectionsPDFModal(false);
    } finally {
      setDownloadingSectionsPDF(false);
    }
  };

  const handleDownloadPDFNow = async (type?: 'yes-only' | 'no-only' | 'na-only' | 'both' | 'section' | 'default' | 'responses-view') => {
  if (!response || !form) return;

  setPdfDownloadProgress(0);
  setGeneratingPDF(true);
  
  try {
    const availableSections = form.sections || [];

    // Prepare section question stats
    const questionStats: Record<string, any[]> = {};
    availableSections.forEach((section: any) => {
      questionStats[section.id] = getSectionYesNoQuestionStats(section.id);
    });

    // Create PDF options
    const pdfOptions = {
      filename: `${form.title}_Report_${formatTimestamp(response.createdAt, 'file')}_${type || 'default'}.pdf`,
      formTitle: form.title,
      submittedDate: formatTimestamp(response.createdAt),
      sectionStats: sectionStats,
      sectionQuestionStats: questionStats,
      form: form,
      response: response,
      availableSections: availableSections,
      type: type // Add the type parameter
    };

    // Create progress callback
    const onProgress = (progress: {
      stage: 'uploading' | 'generating' | 'downloading' | 'complete';
      percentage: number;
      message?: string;
    }) => {
      console.log('📊 PDF Progress:', progress);
      setPdfDownloadProgress(Math.round(progress.percentage));
    };

    // Call generateAndDownloadPDF with progress callback ONCE
    await generateAndDownloadPDF(pdfOptions, type, onProgress);

    showSuccess("PDF downloaded successfully.");
  } catch (err: any) {
    console.error("Failed to generate PDF:", err);
    showError(err.message || "Failed to generate PDF. Please try again.");
  } finally {
    setGeneratingPDF(false);
    setPdfDownloadProgress(null);
  }
};

const handleBulkDownloadZip = async () => {
  if (!response || !form) return;

  try {
    setExportingZip(true);
    isCancelledRef.current = false;
    
    const formIdentifier = response.questionId || response.formId;
    if (!formIdentifier) {
      throw new Error("Form identifier not found for this response.");
    }

    // Fetch all responses for this form
    const responsesData = await apiClient.getResponses();
    const filteredResponses = responsesData.responses.filter(
      (r: Response) => {
        const rFormId = r.questionId || r.formId || (r as any).formIdentifier;
        return rFormId === formIdentifier || String(rFormId) === String(formIdentifier);
      }
    );

    if (filteredResponses.length === 0) {
      throw new Error("No responses found for this form.");
    }

    // Get the full form data to ensure we have everything needed
    const formData = await apiClient.getForm(formIdentifier);
    const fullForm = formData.form;

    await exportAllResponsesToZip(
      filteredResponses,
      fullForm,
      (progress) => {
        setPdfProgress({
          stage: 'generating',
          percentage: (progress.current / progress.total) * 100,
          message: progress.message
        });
      },
      () => isCancelledRef.current
    );

    if (isCancelledRef.current) {
      showSuccess("Bulk download cancelled.");
      setPdfProgress(null);
      return;
    }

    showSuccess(`Bulk download of ${filteredResponses.length} responses completed.`);
    setPdfProgress({
      stage: 'complete',
      percentage: 100,
      message: 'Download complete'
    });
    
    setTimeout(() => setPdfProgress(null), 3000);
    
  } catch (err: any) {
    console.error("Bulk download failed:", err);
    showError(err.message || "Bulk download failed.");
    setPdfProgress({
      stage: 'error',
      percentage: 0,
      message: err.message
    });
  } finally {
    setExportingZip(false);
  }
};

  const getStatusInfo = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return {
          color: "text-yellow-600",
          bgColor: "bg-yellow-50",
          icon: Clock,
          label: "Pending",
        };
      case "confirmed":
        return {
          color: "text-blue-600",
          bgColor: "bg-blue-50",
          icon: CheckCircle,
          label: "Confirmed",
        };
      case "verified":
        return {
          color: "text-green-600",
          bgColor: "bg-green-50",
          icon: CheckCircle,
          label: "Verified",
        };
      case "rejected":
        return {
          color: "text-red-600",
          bgColor: "bg-red-50",
          icon: XCircle,
          label: "Rejected",
        };
      default:
        return {
          color: "text-gray-600",
          bgColor: "bg-gray-50",
          icon: Clock,
          label: "Unknown",
        };
    }
  };

  const getAllQuestions = (form: Form) => {
    const questions: Record<string, any> = {};

    form.sections?.forEach((section) => {
      section.questions?.forEach((question: any) => {
        questions[question.id] = question;
        question.followUpQuestions?.forEach((followUp: any) => {
          questions[followUp.id] = followUp;
        });
      });
    });

    form.followUpQuestions?.forEach((question: any) => {
      questions[question.id] = question;
    });

    return questions;
  };

  function collectYesNoQuestionIds(form: Form): string[] {
    const ids = new Set<string>();

    const processQuestion = (question: any) => {
      if (!question) {
        return;
      }
      const supportedTypes = ["yesNoNA", "radio", "checkbox", "select", "search-select", "radio-image", "rating", "scale"];
      if (supportedTypes.includes(question.type) && question.id) {
        ids.add(question.id);
      }
      question.followUpQuestions?.forEach(processQuestion);
    };

    form.sections?.forEach((section) => {
      section.questions?.forEach(processQuestion);
    });

    form.followUpQuestions?.forEach(processQuestion);

    return Array.from(ids);
  }

  function extractYesNoValues(value: any): string[] {
    if (value === null || value === undefined) {
      return [];
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      return normalized ? [normalized] : [];
    }
    if (typeof value === "boolean") {
      return [value ? "yes" : "no"];
    }
    if (Array.isArray(value)) {
      return value.flatMap((item) => extractYesNoValues(item));
    }
    if (typeof value === "object") {
      return Object.values(value).flatMap((item) => extractYesNoValues(item));
    }
    return [];
  }

  const renderHighlightedAnswer = (value: any, question?: any, compact: boolean = false) => {
    const isArray = Array.isArray(value);
    
    // Helper to get string representation for comparison
    const getStringValue = (val: any): string => {
      if (Array.isArray(val)) return val.map(v => getStringValue(v)).join(", ");
      if (typeof val === 'object' && val !== null) {
        if (val.url) return val.url;
        if (val.answer !== undefined) return String(val.answer);
        return JSON.stringify(val);
      }
      return String(val || "");
    };

    const strValue = getStringValue(value);
    const normalized = strValue.trim().toLowerCase();
    
    let bgColor = "bg-white dark:bg-gray-700";
    let textColor = "text-gray-900 dark:text-gray-100";
    let borderColor = "border-gray-200 dark:border-gray-600";
    let Icon = null;
    
    let isYes = normalized === "yes";
    let isNo = normalized === "no";
    let isNA = normalized === "n/a" || normalized === "na" || normalized === "not applicable";
    
    // For yesNoNA type, we should use the option position if available
    if (question && question.type === "yesNoNA" && question.options && question.options.length >= 2) {
      isYes = normalized === String(question.options[0]).toLowerCase();
      isNo = normalized === String(question.options[1]).toLowerCase();
      if (question.options.length >= 3) {
        isNA = normalized === String(question.options[2]).toLowerCase();
      }
    }
    
    // Quiz logic
    const isQuiz = question && (question.correctAnswer || (question.correctAnswers && question.correctAnswers.length > 0));
    let isCorrect = false;
    
    if (isQuiz) {
      if (question.correctAnswers && question.correctAnswers.length > 0) {
        if (isArray) {
          isCorrect = value.length === question.correctAnswers.length && 
                      value.every((a: any) => question.correctAnswers!.some((ca: any) => String(ca).toLowerCase() === getStringValue(a).toLowerCase()));
        } else {
          isCorrect = question.correctAnswers.some((ca: any) => String(ca).toLowerCase() === normalized);
        }
      } else if (question.correctAnswer) {
        isCorrect = String(question.correctAnswer).toLowerCase() === normalized;
      }
    }

    if (isQuiz) {
      if (isCorrect) {
        bgColor = "bg-green-100 dark:bg-green-900/30";
        textColor = "text-green-800 dark:text-green-300";
        borderColor = "border-green-200 dark:border-green-800";
        Icon = CheckCircle;
      } else {
        bgColor = "bg-red-100 dark:bg-red-900/30";
        textColor = "text-red-800 dark:text-red-300";
        borderColor = "border-red-200 dark:border-red-800";
        Icon = XCircle;
      }
    } else if (isYes) {
      bgColor = "bg-green-100 dark:bg-green-900/30";
      textColor = "text-green-800 dark:text-green-300";
      borderColor = "border-green-200 dark:border-green-800";
      Icon = CheckCircle;
    } else if (isNo) {
      bgColor = "bg-red-100 dark:bg-red-900/30";
      textColor = "text-red-800 dark:text-red-300";
      borderColor = "border-red-200 dark:border-red-800";
      Icon = XCircle;
    } else if (isNA) {
      bgColor = "bg-yellow-100 dark:bg-yellow-900/30";
      textColor = "text-yellow-800 dark:text-yellow-300";
      borderColor = "border-yellow-200 dark:border-yellow-800";
      Icon = AlertTriangle;
    }

    const answerBox = (
      <div 
        className={`${compact ? 'w-full px-4 py-2' : 'flex-1 p-3'} ${bgColor} ${textColor} ${borderColor} rounded-lg border text-sm break-words font-medium flex items-center shadow-sm relative group/answer`}
        style={{
          boxShadow: isQuiz 
            ? (isCorrect ? '0 4px 12px rgba(34, 197, 94, 0.4)' : '0 4px 12px rgba(239, 68, 68, 0.4)')
            : (isYes ? '0 4px 12px rgba(34, 197, 94, 0.4)' : (isNo ? '0 4px 12px rgba(239, 68, 68, 0.4)' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)'))
        }}
      >
        <div className="w-full">
          {!compact && isQuiz && (
            <div className="text-[10px] font-bold opacity-70 uppercase tracking-wider mb-1">
              Customer Filled Answer
            </div>
          )}
          <div className={`flex items-center gap-2 ${compact ? 'justify-center' : ''}`}>
            {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
            <div className="flex-1">
              {(() => {
                const renderInnerValue = (val: any): React.ReactNode => {
                  if (val === null || val === undefined || val === "") return null;

                  if (Array.isArray(val)) {
                    return (
                      <div className="flex flex-col gap-1">
                        {val.map((item, i) => (
                          <div key={i}>{renderInnerValue(item)}</div>
                        ))}
                      </div>
                    );
                  }

                  if (typeof val === "object") {
                    if (val.url && isImageUrl(String(val.url))) {
                      return <ImageLink text={String(val.url)} />;
                    }
                    if (val.answer && isImageUrl(String(val.answer))) {
                      return <ImageLink text={String(val.answer)} />;
                    }
                    
                    const entries = Object.entries(val);
                    if (entries.length > 0) {
                      return (
                        <div className="flex flex-col gap-1">
                          {entries.map(([k, v], i) => (
                            <div key={i} className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-bold opacity-70 uppercase tracking-tighter text-indigo-800 dark:text-indigo-300">
                                {k}
                              </span>
                              {renderInnerValue(v)}
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return JSON.stringify(val);
                  }

                  const textVal = String(val);
                  if (isImageUrl(textVal)) {
                    return <ImageLink text={textVal} />;
                  }
                  return textVal;
                };
                return renderInnerValue(value);
              })()}
            </div>
            {/* Rank Tag Display */}
            {question?.id && response?.responseRanks && response.responseRanks[question.id] !== undefined && (
              <div 
                className={`flex-shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-tighter shadow-sm whitespace-nowrap ${
                  isCorrect || isYes
                    ? "bg-green-100/50 text-green-700 border-green-200" 
                    : isNo || (isQuiz && !isCorrect)
                    ? "bg-red-100/50 text-red-700 border-red-200"
                    : "bg-blue-100/50 text-blue-700 border-blue-200"
                }`}
              >
                Rank #{response.responseRanks[question.id]}{response.answers[question.id] && `: ${String(typeof response.answers[question.id] === 'object' ? (response.answers[question.id].chassisNumber || JSON.stringify(response.answers[question.id])) : response.answers[question.id])}`}
              </div>
            )}
          </div>
        </div>
      </div>
    );

    if (isQuiz && !compact) {
      const correctAnswerDisplay = question.correctAnswers && question.correctAnswers.length > 0
        ? question.correctAnswers.join(", ")
        : String(question.correctAnswer || "");

      return (
        <div className="flex flex-row gap-3 w-full">
          {/* Given Correct Answer - No color (Neutral) */}
          <div className="flex-1 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm">
            <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              Given Correct Answer
            </div>
            <div className="font-medium text-gray-700 dark:text-gray-300">
              {correctAnswerDisplay}
            </div>
          </div>

          {/* Customer Filled Answer - Colored based on correctness */}
          {answerBox}
        </div>
      );
    }

    return answerBox;
  };

  function getSectionYesNoStats(
    form: Form,
    answers: Record<string, any>
  ): SectionStat[] {
    const stats =
      form.sections?.map((section: any) => {
        const counts = { yes: 0, no: 0, na: 0, total: 0, correct: 0, wrong: 0, answeredCount: 0 };
        let hasYesNo = false;
        const weightageNumber = Number(section.weightage);
        const weightage = Number.isFinite(weightageNumber)
          ? weightageNumber
          : 0;

        const processQuestion = (question: any) => {
          if (!question) {
            return;
          }
          const supportedTypes = ["yesNoNA", "radio", "checkbox", "select", "search-select", "radio-image", "rating", "scale"];
          if (!supportedTypes.includes(question.type) || !question.id) {
            question.followUpQuestions?.forEach(processQuestion);
            return;
          }

          const isCompliance = question.type === "yesNoNA";
          const isAccuracy = !isCompliance;

          if (isCompliance) {
            hasYesNo = true;
          }

          const rawValue = answers?.[question.id];
          const normalizedValues = extractYesNoValues(rawValue);
          
          // Check if it has any value (not null/undefined/empty string/empty array)
          const hasValue = rawValue !== null && rawValue !== undefined && rawValue !== "" && 
                          (!Array.isArray(rawValue) || rawValue.length > 0) &&
                          (typeof rawValue !== 'object' || Object.keys(rawValue).length > 0);

          counts.total += 1;
          
          if (!hasValue) {
            if (question.required) {
              counts.answeredCount += 1;
              if (isCompliance) {
                counts.no += 1;
              } else {
                counts.wrong += 1;
              }
            }
            // For unanswered questions, we still check follow-ups 
            question.followUpQuestions?.forEach(processQuestion);
            return;
          }

          counts.answeredCount += 1;
          
          if (isAccuracy) {
            const isNA = normalizedValues.some(v => ["n/a", "na", "not applicable"].includes(v));
            if (isNA) {
              counts.na += 1;
            } else {
              let isCorrect = false;
              const isArray = Array.isArray(rawValue);
              const strValue = isArray ? rawValue.join(", ") : String(rawValue || "");
              const normalized = strValue.trim().toLowerCase();

              if (question.correctAnswers && question.correctAnswers.length > 0) {
                if (isArray) {
                  isCorrect = rawValue.length === question.correctAnswers.length && 
                              rawValue.every((a: any) => question.correctAnswers!.some((ca: any) => String(ca).toLowerCase() === String(a).toLowerCase()));
                } else {
                  isCorrect = question.correctAnswers.some((ca: any) => String(ca).toLowerCase() === normalized);
                }
              } else if (question.correctAnswer) {
                isCorrect = String(question.correctAnswer).toLowerCase() === normalized;
              } else {
                // Fallback for accuracy questions without explicit correct answers:
                // If it has a value and it's not "N/A", it's considered "Correct" (Answered)
                isCorrect = true;
              }

              if (isCorrect) {
                counts.correct += 1;
              } else {
                counts.wrong += 1;
              }
            }
          } else if (isCompliance) {
            const yesLabel = question.options?.[0]?.toLowerCase() || "yes";
            const noLabel = question.options?.[1]?.toLowerCase() || "no";
            const naLabel = question.options?.[2]?.toLowerCase() || "n/a";

            if (normalizedValues.includes(yesLabel)) {
              counts.yes += 1;
            } else if (normalizedValues.includes(noLabel)) {
              counts.no += 1;
            } else if (
              normalizedValues.includes(naLabel) ||
              normalizedValues.includes("n/a") ||
              normalizedValues.includes("na") ||
              normalizedValues.includes("not applicable")
            ) {
              counts.na += 1;
            } else {
              // Default to yes if it has value but not recognized as no/na
              counts.yes += 1;
            }
          }

          question.followUpQuestions?.forEach(processQuestion);
        };

        section.questions?.forEach(processQuestion);

        if (!counts.answeredCount && !section.weightage) {
          return null;
        }

        return {
          id: section.id,
          title: section.title || "Untitled Section",
          yes: counts.yes,
          no: counts.no,
          na: counts.na,
          correct: counts.correct,
          wrong: counts.wrong,
          total: counts.total,
          answeredCount: counts.answeredCount,
          weightage,
          hasYesNo,
        };
      }) ?? [];

    return stats.filter((stat): stat is SectionStat => Boolean(stat));
  }

  function getSectionYesNoQuestionStats(sectionId: string) {
    if (!form || !response) return [];

    const section = form.sections?.find((s: any) => s.id === sectionId);
    if (!section) return [];

    const questionStats: Array<{
      id: string;
      title: string;
      subParam1?: string;
      yes: number;
      no: number;
      na: number;
      correct: number;
      wrong: number;
      total: number;
      hasYesNo: boolean;
      isQuiz: boolean;
    }> = [];

    const processQuestion = (question: any) => {
      if (!question) return;

      const supportedTypes = ["yesNoNA", "radio", "checkbox", "select", "search-select", "radio-image", "rating", "scale"];
      if (supportedTypes.includes(question.type) && question.id) {
        const rawValue = response.answers?.[question.id];
        const normalizedValues = extractYesNoValues(rawValue);
        const counts = { yes: 0, no: 0, na: 0, total: 1, correct: 0, wrong: 0, answeredCount: 0 };
        const isCompliance = question.type === "yesNoNA";
        const isAccuracy = !isCompliance;

        const hasValue = rawValue !== null && rawValue !== undefined && rawValue !== "" && 
                        (!Array.isArray(rawValue) || rawValue.length > 0) &&
                        (typeof rawValue !== 'object' || Object.keys(rawValue).length > 0);

        if (!hasValue) {
          if (question.required) {
            counts.answeredCount = 1;
            if (isCompliance) {
              counts.no = 1;
            } else {
              counts.wrong = 1;
            }
          } else {
            // Optional unanswered questions are skipped from stats
            return;
          }
        } else {
          counts.answeredCount = 1;
          if (isAccuracy) {
            const isNA = normalizedValues.some(v => ["n/a", "na", "not applicable"].includes(v));
            if (isNA) {
              counts.na = 1;
            } else {
              let isCorrect = false;
              const isArray = Array.isArray(rawValue);
              const strValue = isArray ? rawValue.join(", ") : String(rawValue || "");
              const normalized = strValue.trim().toLowerCase();

              if (question.correctAnswers && question.correctAnswers.length > 0) {
                if (isArray) {
                  isCorrect = rawValue.length === question.correctAnswers.length && 
                              rawValue.every((a: any) => question.correctAnswers!.some((ca: any) => String(ca).toLowerCase() === String(a).toLowerCase()));
                } else {
                  isCorrect = question.correctAnswers.some((ca: any) => String(ca).toLowerCase() === normalized);
                }
              } else if (question.correctAnswer) {
                isCorrect = String(question.correctAnswer).toLowerCase() === normalized;
              } else {
                // Fallback for accuracy questions without explicit correct answers:
                // If it has a value and it's not "N/A", it's considered "Correct" (Answered)
                isCorrect = true;
              }

              if (isCorrect) {
                counts.correct = 1;
              } else {
                counts.wrong = 1;
              }
            }
          } else if (isCompliance) {
            const yesLabel = question.options?.[0]?.toLowerCase() || "yes";
            const noLabel = question.options?.[1]?.toLowerCase() || "no";
            const naLabel = question.options?.[2]?.toLowerCase() || "n/a";

            if (normalizedValues.includes(yesLabel)) {
              counts.yes = 1;
            } else if (normalizedValues.includes(noLabel)) {
              counts.no = 1;
            } else if (
              normalizedValues.includes(naLabel) ||
              normalizedValues.includes("n/a") ||
              normalizedValues.includes("na") ||
              normalizedValues.includes("not applicable")
            ) {
              counts.na = 1;
            } else {
              counts.yes = 1;
            }
          }
        }

        questionStats.push({
          id: question.id,
          title:
            question.title ||
            question.label ||
            question.text ||
            `Question ${question.id}`,
          subParam1: question.subParam1,
          hasYesNo: isCompliance,
          isQuiz: isAccuracy,
          ...counts,
        });
      }

      question.followUpQuestions?.forEach(processQuestion);
    };

    section.questions?.forEach(processQuestion);

    const groupedStats: Map<
      string,
      {
        id: string;
        title: string;
        subParam1?: string;
        yes: number;
        no: number;
        na: number;
        correct: number;
        wrong: number;
        total: number;
        hasYesNo: boolean;
        isQuiz: boolean;
      }
    > = new Map();

    questionStats.forEach((stat) => {
      const key = stat.subParam1 || "No parameter";
      if (groupedStats.has(key)) {
        const existing = groupedStats.get(key)!;
        existing.yes += stat.yes;
        existing.no += stat.no;
        existing.na += stat.na;
        existing.correct += stat.correct;
        existing.wrong += stat.wrong;
        existing.total += stat.total;
        if (stat.hasYesNo) existing.hasYesNo = true;
        if (stat.isQuiz) existing.isQuiz = true;
      } else {
        groupedStats.set(key, { ...stat });
      }
    });

    return Array.from(groupedStats.values());
  }

  const getSectionQuestionsWithFollowUps = (sectionId: string) => {
    if (!form || !response) return [];

    const section = form.sections?.find((s: any) => s.id === sectionId);
    if (!section) return [];

    const mainQuestionsWithFollowUps: any[] = [];
    const questionIds = collectYesNoQuestionIds({
      ...form,
      sections: [section],
    });

    const mainQuestions: any[] = [];
    const followUpMap = new Map<string, any[]>();

    section.questions?.forEach((question: any) => {
      if (question.showWhen && question.showWhen.questionId) {
        const parentId = question.showWhen.questionId;
        if (!followUpMap.has(parentId)) {
          followUpMap.set(parentId, []);
        }
        followUpMap.get(parentId)!.push(question);
      } else {
        mainQuestions.push(question);
      }
    });

    mainQuestions.forEach((question: any) => {
      // INCLUDE ALL MAIN QUESTIONS, not just those from collectYesNoQuestionIds
      // This ensures text-based main parameters (like in "Basic Information") are shown
      const answers = response.answers?.[question.id];
      const yesNoValues = extractYesNoValues(answers);

      const followUpQuestionsForThis = [
        ...(form.followUpQuestions?.filter(
          (fq: any) => fq.parentId === question.id
        ) || []),
        ...(question.followUpQuestions || []),
        ...(followUpMap.get(question.id) || []),
      ];

      // Show question if it has an answer OR has follow-ups
      if ((answers !== undefined && answers !== null && answers !== "") || followUpQuestionsForThis.length > 0) {
        const mainQuestion = {
          id: question.id,
          title: question.title || question.label || question.text,
          subParam1: question.subParam1,
          yesNoValues,
          followUpQuestions: followUpQuestionsForThis.map((fq: any) => ({
            id: fq.id || fq._id,
            title: fq.title || fq.label || fq.text,
            subParam1: fq.subParam1,
            answer: response.answers?.[fq.id || fq._id],
          })),
        };

        mainQuestionsWithFollowUps.push(mainQuestion);
      }
    });

    return mainQuestionsWithFollowUps;
  };

  const sectionStats = useMemo(() => {
    if (!form || !response) {
      return [] as SectionStat[];
    }
    return getSectionYesNoStats(form, response.answers);
  }, [form, response]);

  const filteredSectionStats = useMemo(
    () =>
      sectionStats.filter(
        (stat) =>
          stat.total > 0 ||
          stat.weightage > 0
      ),
    [sectionStats]
  );

  const sectionChartData = useMemo(() => {
    const calculatePercentage = (value: number, total: number) =>
      total ? parseFloat(((value / total) * 100).toFixed(1)) : 0;

    const datasets = [
      {
        label: "Correct",
        data: filteredSectionStats.map((stat) =>
          calculatePercentage(stat.correct, stat.total)
        ),
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.25)",
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: "#10b981",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        tension: 0.4,
      },
      {
        label: "Wrong",
        data: filteredSectionStats.map((stat) =>
          calculatePercentage(stat.wrong, stat.total)
        ),
        borderColor: "#ef4444",
        backgroundColor: "rgba(239, 68, 68, 0.25)",
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: "#ef4444",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        tension: 0.4,
      },
      {
        label: complianceLabels.yes,
        data: filteredSectionStats.map((stat) =>
          calculatePercentage(stat.yes, stat.total)
        ),
        borderColor: "#1d4ed8",
        backgroundColor: "rgba(29, 78, 216, 0.25)",
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: "#1d4ed8",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        tension: 0.4,
      },
      {
        label: complianceLabels.no,
        data: filteredSectionStats.map((stat) =>
          calculatePercentage(stat.no, stat.total)
        ),
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.25)",
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: "#3b82f6",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        tension: 0.4,
      },
    ];

    if (filteredSectionStats.some(stat => stat.na > 0)) {
      datasets.push({
        label: complianceLabels.na,
        data: filteredSectionStats.map((stat) =>
          calculatePercentage(stat.na, stat.total)
        ),
        borderColor: "#93c5fd",
        backgroundColor: "rgba(147, 197, 253, 0.25)",
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: "#93c5fd",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        tension: 0.4,
      });
    }

    return {
      labels: filteredSectionStats.map((stat) =>
        formatSectionLabel(stat.title)
      ),
      datasets,
    };
  }, [filteredSectionStats]);

  const sectionChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            title: (items: any[]) => {
              const index = items?.[0]?.dataIndex;
              if (index === undefined) {
                return "";
              }
              return filteredSectionStats[index]?.title || "";
            },
            label: (context: any) => {
              const value = context.parsed?.r ?? 0;
              return `${context.dataset.label}: ${value.toFixed(1)}%`;
            },
          },
        },
      },
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          pointLabels: {
            display: true,
            font: {
              size: 10,
              weight: 500,
            },
            color: document.documentElement.classList.contains("dark")
              ? "#d1d5db"
              : "#374151",
          },
          ticks: {
            callback: (value: any) => `${value}%`,
            color: document.documentElement.classList.contains("dark")
              ? "#d1d5db"
              : "#374151",
            font: {
              size: 11,
            },
          },
          grid: {
            color: document.documentElement.classList.contains("dark")
              ? "rgba(147, 197, 253, 0.3)"
              : "rgba(59, 130, 246, 0.3)",
            lineWidth: 1.5,
          },
          angleLines: {
            display: true,
            color: document.documentElement.classList.contains("dark")
              ? "rgba(147, 197, 253, 0.4)"
              : "rgba(59, 130, 246, 0.4)",
            lineWidth: 1.5,
          },
        },
      },
    }),
    [filteredSectionStats]
  );

  const sectionChartHeight = 450;

  const sectionSummaryRows = useMemo(
    () =>
      filteredSectionStats.map((stat) => {
        let weightage = stat.weightage;
        if (typeof weightage === "string") {
          weightage = parseFloat(weightage);
        }
        weightage = Number.isFinite(weightage) ? weightage : 0;
        if (weightage > 1) {
          weightage = weightage;
        } else if (weightage > 0) {
          weightage = weightage * 100;
        }

        const yesPercent = stat.total ? (stat.yes / stat.total) * 100 : 0;
        const noPercent = stat.total ? (stat.no / stat.total) * 100 : 0;
        const naPercent = stat.total ? (stat.na / stat.total) * 100 : 0;
        const correctPercent = stat.total ? (stat.correct / stat.total) * 100 : 0;
        const wrongPercent = stat.total ? (stat.wrong / stat.total) * 100 : 0;
        
        const yesWeighted = (yesPercent * weightage) / 100;
        const noWeighted = (noPercent * weightage) / 100;
        const naWeighted = (naPercent * weightage) / 100;

        return {
          id: stat.id,
          title: stat.title,
          total: stat.total,
          yes: stat.yes,
          no: stat.no,
          na: stat.na,
          correct: stat.correct,
          wrong: stat.wrong,
          weightage,
          yesPercent,
          yesWeighted,
          noPercent,
          noWeighted,
          naPercent,
          naWeighted,
          correctPercent,
          wrongPercent,
          hasYesNo: stat.hasYesNo,
          hasQuiz: stat.correct > 0 || stat.wrong > 0 || stat.total > 0 && !stat.hasYesNo, // If total > 0 and no yes/no, it might be quiz
        };
      }),
    [filteredSectionStats]
  );

  const calculateTotalWeightage = useMemo(() => {
    return sectionSummaryRows.reduce((total, row) => total + row.weightage, 0);
  }, [sectionSummaryRows]);

  const summaryTotals = useMemo(() => {
    return sectionSummaryRows.reduce(
      (acc, row) => ({
        total: acc.total + row.total,
        yes: acc.yes + (row.yes || 0),
        no: acc.no + (row.no || 0),
        na: acc.na + (row.na || 0),
        correct: acc.correct + (row.correct || 0),
        wrong: acc.wrong + (row.wrong || 0),
        weightage: acc.weightage + row.weightage,
        yesWeighted: acc.yesWeighted + row.yesWeighted,
        noWeighted: acc.noWeighted + row.noWeighted,
        naWeighted: acc.naWeighted + row.naWeighted,
        hasAnyYesNo: acc.hasAnyYesNo || row.hasYesNo,
        hasAnyQuiz: acc.hasAnyQuiz || row.hasQuiz || (row.correct + row.wrong > 0),
      }),
      { total: 0, yes: 0, no: 0, na: 0, correct: 0, wrong: 0, weightage: 0, yesWeighted: 0, noWeighted: 0, naWeighted: 0, hasAnyYesNo: false, hasAnyQuiz: false }
    );
  }, [sectionSummaryRows]);

  const weightedPercentageChartData = useMemo(() => {
    const datasets = [
      {
        label: complianceLabels.yes,
        data: sectionSummaryRows.map((row) =>
          parseFloat(row.yesWeighted.toFixed(1))
        ),
        borderColor: "#1d4ed8",
        backgroundColor: "rgba(29, 78, 216, 0.1)",
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#1d4ed8",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
      },
      {
        label: complianceLabels.no,
        data: sectionSummaryRows.map((row) =>
          parseFloat(row.noWeighted.toFixed(1))
        ),
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#3b82f6",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
      },
    ];

    if (sectionSummaryRows.some(row => row.na > 0)) {
      datasets.push({
        label: complianceLabels.na,
        data: sectionSummaryRows.map((row) =>
          parseFloat(row.naWeighted.toFixed(1))
        ),
        borderColor: "#93c5fd",
        backgroundColor: "rgba(147, 197, 253, 0.1)",
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#93c5fd",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
      });
    }

    return {
      labels: sectionSummaryRows.map((row) => formatSectionLabel(row.title)),
      datasets,
    };
  }, [sectionSummaryRows]);

  useEffect(() => {
    if (sectionSummaryRows.length > 0) {
      const hasWeightage = sectionSummaryRows.some(row => row.weightage > 0);
      if (hasWeightage) {
        setShowWeightageColumns(true);
        setShowWeightageCheckbox(false);
        setAddWeightMode(false);
      } else {
        setShowWeightageColumns(false);
        setShowWeightageCheckbox(true);
      }
    }
  }, [sectionSummaryRows]);

  const weightedPercentageChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 16, right: 32, bottom: 16, left: 8 },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const value = context.parsed?.y ?? 0;
              return `${context.dataset.label}: ${value.toFixed(1)}%`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value: any) => `${value}%`,
            color: "#374151",
          },
          title: {
            display: true,
            text: "Weighted Percentage",
            color: "#374151",
          },
          grid: {
            color: "#e5e7eb",
          },
        },
        x: {
          ticks: {
            autoSkip: false,
            color: "#374151",
          },
          title: {
            display: true,
            text: "Sections",
            color: "#374151",
          },
          grid: {
            color: "#e5e7eb",
          },
        },
      },
    }),
    []
  );

  const weightedChartHeight = Math.max(320, sectionSummaryRows.length * 32);

  const renderFormContent = () => {
    if (!response || !form) return null;

    const questions = getAllQuestions(form);
    return (
      <div className="space-y-4">
        {Object.entries(response.answers).map(([key, value]) => {
          const question = questions[key];
          return (
            <div
              key={key}
              className="border-b border-primary-100 dark:border-gray-700 pb-4 last:border-b-0"
            >
              <div className="font-semibold text-primary-900 dark:text-gray-100 mb-2">
                {question?.text || key}
              </div>
              {question?.description && (
                <p className="text-sm text-primary-600 dark:text-gray-400 mb-2">
                  {question.description}
                </p>
              )}
              <div className="bg-primary-50 dark:bg-gray-800 rounded-lg p-4">
                {Array.isArray(value) ? (
                  <div className="space-y-1">
                    {value.map((v, idx) => (
                      <div
                        key={idx}
                        className="text-primary-700 dark:text-gray-200"
                      >
                        {isImageUrl(typeof v === 'object' && v !== null && v.url ? String(v.url) : String(v)) ? (
                          <ImageLink text={typeof v === 'object' && v !== null && v.url ? String(v.url) : String(v)} />
                        ) : (
                          String(v)
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-primary-700 dark:text-gray-200">
                    {isImageUrl(typeof value === 'object' && value !== null && value.url ? String(value.url) : String(value)) ? (
                      <ImageLink text={typeof value === 'object' && value !== null && value.url ? String(value.url) : String(value)} />
                    ) : typeof value === "object" && value !== null ? (
                      <div className="flex flex-col gap-2">
                        {Object.entries(value).map(([k, v], i) => (
                          <div key={i} className="flex flex-col gap-0.5 border-l-2 border-primary-100 pl-2">
                            <span className="text-[10px] font-bold opacity-70 uppercase tracking-tighter text-primary-600 dark:text-primary-400">
                              {k}
                            </span>
                            {isImageUrl(typeof v === 'object' && v !== null && (v as any).url ? String((v as any).url) : String(v)) ? (
                              <ImageLink text={typeof v === 'object' && v !== null && (v as any).url ? String((v as any).url) : String(v)} />
                            ) : (
                              String(v)
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      String(value)
                    )}
                  </div>
                )}
              </div>

              {/* ADDITION: Render synthetic follow-ups for this question */}
              {(() => {
                const syntheticKey = `synthetic_${key}`;
                const syntheticData = response.answers[syntheticKey];
                if (syntheticData && typeof syntheticData === 'object') {
                  return Object.entries(syntheticData).map(([fuText, fuData]: [string, any], idx) => (
                    <div key={idx} className="mt-3 ml-6 border-l-2 border-red-200 pl-4 py-2 bg-red-50/30 dark:bg-red-900/10 rounded-r-lg">
                      <div className="text-xs font-bold text-red-600 dark:text-red-400 mb-1 flex items-center gap-1">
                        <span className="bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded text-[10px]">FU.S</span>
                        {fuText}
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        {isImageUrl(fuData.answer && typeof fuData.answer === 'object' && fuData.answer.url ? String(fuData.answer.url) : String(fuData.answer)) ? (
                          <ImageLink text={fuData.answer && typeof fuData.answer === 'object' && fuData.answer.url ? String(fuData.answer.url) : String(fuData.answer)} />
                        ) : (
                          String(fuData.answer)
                        )}
                      </div>
                    </div>
                  ));
                }
                return null;
              })()}
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4 text-lg">{error}</div>
          <button
            onClick={() => navigate("/responses/all")}
            className="btn-secondary flex items-center gap-2 mx-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Responses
          </button>
        </div>
      </div>
    );
  }

  if (!response || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600 mb-4">Response not found</div>
          <button
            onClick={() => navigate("/responses/all")}
            className="btn-secondary flex items-center gap-2 mx-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Responses
          </button>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(response.status || "pending");
  const StatusIcon = statusInfo.icon;
  const questions = getAllQuestions(form);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Main Content */}
      <div className="px-6 md:px-8 py-6">

        {/* View Mode Tabs & Back Button */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1 bg-white dark:bg-gray-700 rounded-lg p-1 w-fit border border-gray-200 dark:border-gray-600">
            <button
              onClick={() => setViewMode("dashboard")}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                viewMode === "dashboard"
                  ? "text-white"
                  : "text-gray-900 dark:text-gray-100 hover:text-black dark:hover:text-white"
              }`}
              style={{ backgroundColor: viewMode === "dashboard" ? "#1e3a8a" : "transparent" }}
            >
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </button>
            <button
              onClick={() => setViewMode("responses")}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                viewMode === "responses"
                  ? "text-white"
                  : "text-gray-900 dark:text-gray-100 hover:text-black dark:hover:text-white"
              }`}
              style={{ backgroundColor: viewMode === "responses" ? "#1e3a8a" : "transparent" }}
            >
              <FileText className="w-4 h-4" />
              Responses
            </button>
          </div>

          <div className="flex items-center gap-6 mx-4">
            <div className="text-center">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                {form.title}
              </h2>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Comprehensive analysis and insights
              </p>
            </div>
            <div className="h-8 w-px bg-gray-300 dark:bg-gray-600 hidden sm:block"></div>
            <div className="text-center hidden sm:block">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Submitted
              </p>
              <p className="text-xs font-semibold text-gray-900 dark:text-white">
                {formatTimestamp(response.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleEditResponse}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white rounded-lg transition-all duration-200 hover:opacity-90"
              style={{ backgroundColor: "#2563eb" }}
              title="Edit Response"
            >
              <Edit2 className="w-4 h-4" />
              <span className="hidden sm:inline">Edit</span>
            </button>

            <button
              onClick={handleDeleteResponse}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white rounded-lg transition-all duration-200 hover:opacity-90"
              style={{ backgroundColor: "#dc2626" }}
              title="Delete Response"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Delete</span>
            </button>

            {viewMode === "responses" && (
                <button
                onClick={() => handleExportExcel()}
                disabled={exportingExcel}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white rounded-lg transition-all duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#16a34a" }}
                title="Export to Excel"
              >
                {exportingExcel ? (
                  <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">
                  {exportingExcel ? "Exporting..." : "Excel"}
                </span>
                </button>
            )}

            {viewMode === "dashboard" && (
              <div className="relative pdf-type-selector">
                <button
    onClick={(e) => {
      e.stopPropagation();
      setShowPDFTypeSelector(!showPDFTypeSelector);
    }}
    disabled={generatingPDF}
    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white rounded-lg transition-all duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
    style={{ backgroundColor: "#0891b2" }}
    title="Download PDF"
  >
    {generatingPDF ? (
      <div className="flex items-center gap-2">
        <div className="relative w-5 h-5">
          {/* Spinner */}
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          
          {/* Progress text overlay */}
          {pdfDownloadProgress !== null && pdfDownloadProgress > 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              
            </div>
          )}
        </div>
        <span className="hidden sm:inline whitespace-nowrap">
          {pdfDownloadProgress !== null ? `Downloading..${pdfDownloadProgress}%` : 'Generating...'}
        </span>
      </div>
    ) : (
      <>
        <FileText className="w-4 h-4" />
        <span className="hidden sm:inline">PDF</span>
        {showPDFTypeSelector && (
          <ChevronDown className="w-4 h-4 ml-1 transition-transform" />
        )}
      </>
    )}
                </button>

  {showPDFTypeSelector && !generatingPDF && (
    <div className="absolute top-full mt-2 right-0 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="py-1">
        <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Response Types
        </div>
                <button
          onClick={(e) => {
            e.stopPropagation();
            setShowPDFTypeSelector(false);
            handleDownloadPDF('yes-only');
          }}
          className="flex items-center w-full px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors duration-150"
                >
          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mr-2 flex-shrink-0" />
          <span>Yes Responses (Type 1)</span>
                </button>
                <button
          onClick={(e) => {
            e.stopPropagation();
            setShowPDFTypeSelector(false);
            handleDownloadPDF('no-only');
          }}
          className="flex items-center w-full px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150"
                >
          <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 mr-2 flex-shrink-0" />
          <span>No Responses (Type 2)</span>
                </button>
                <button
          onClick={(e) => {
            e.stopPropagation();
            setShowPDFTypeSelector(false);
            handleDownloadPDF('na-only');
          }}
          className="flex items-center w-full px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors duration-150"
        >
          <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mr-2 flex-shrink-0" />
          <span>N/A Responses (Type 3)</span>
                </button>
        <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
            <button
          onClick={(e) => {
            e.stopPropagation();
            setShowPDFTypeSelector(false);
            handleDownloadPDF('both');
          }}
          className="flex items-center w-full px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors duration-150"
            >
          <FileCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0" />
          <span>All Response Types (Type 4)</span>
            </button>
        <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
            <button
          onClick={(e) => {
            e.stopPropagation();
            setShowPDFTypeSelector(false);
            handleDownloadPDF('section');
          }}
          className="flex items-center w-full px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors duration-150"
            >
          <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400 mr-2 flex-shrink-0" />
          <span>View Sections</span>
            </button>
        <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
            <button
          onClick={(e) => {
            e.stopPropagation();
            setShowPDFTypeSelector(false);
            handleDownloadPDF('responses-view');
          }}
          className="flex items-center w-full px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors duration-150"
            >
          <FileText className="w-4 h-4 text-cyan-600 dark:text-cyan-400 mr-2 flex-shrink-0" />
          <span>Responses Detail</span>
            </button>
        <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowPDFTypeSelector(false);
            handleBulkDownloadZip();
          }}
          disabled={exportingZip || generatingPDF}
          className="flex items-center w-full px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors duration-150"
        >
          <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mr-2 flex-shrink-0" />
          <span>Bulk Download (ZIP)</span>
        </button>
      </div>
    </div>
  )}
</div>  
            )}

            <div className="h-6 w-px bg-gray-300 dark:bg-gray-700 mx-1"></div>

            <button
              onClick={() => navigate("/responses/all")}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        {viewMode === "dashboard" ? (
          filteredSectionStats.length > 0 ? (
            <div className="space-y-5 flex flex-col" style={{ gap: "1.25rem" }}>
              {/* Two-Column Layout: Stats (25%) and Basic Information (75%) */}
              <div className="flex gap-5 items-stretch">
                {/* Stats Cards - 25% */}
                <div className="w-1/4 flex flex-col gap-2">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-2.5 rounded-lg border border-blue-200 dark:border-blue-700 transition-shadow duration-300">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-0.5">
                          {summaryTotals.correct + summaryTotals.wrong > 0 ? "Accuracy Score" : "Overall Score"}
                        </p>
                        <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                          {(() => {
                            const scoringTotal = summaryTotals.yes + summaryTotals.no + summaryTotals.correct + summaryTotals.wrong;
                            const totalSuccess = summaryTotals.yes + summaryTotals.correct;
                            
                            return scoringTotal > 0 ? ((totalSuccess / scoringTotal) * 100).toFixed(1) : "0.0";
                          })()}%
                        </p>
                      </div>
                      <div className="p-1 bg-blue-100 dark:bg-blue-900/40 rounded-full flex-shrink-0">
                        <Award className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2.5 rounded-lg border border-indigo-200 dark:border-indigo-700 transition-shadow duration-300 cursor-pointer" onClick={() => setViewMode("responses")}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-0.5">
                          Total Sections
                        </p>
                        <p className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
                          {filteredSectionStats.length}
                        </p>
                      </div>
                      <div className="p-1 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex-shrink-0">
                        <Target className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 dark:bg-green-900/20 p-2.5 rounded-lg border border-green-200 dark:border-green-700 transition-shadow duration-300 cursor-pointer" onClick={() => setExpandResponseRateBreakdown(!expandResponseRateBreakdown)}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-0.5">
                            Response Rate
                          </p>
                          <ChevronDown className={`w-3 h-3 text-green-700 dark:text-green-300 transition-transform duration-300 ${expandResponseRateBreakdown ? "rotate-180" : ""}`} />
                        </div>
                        <p className="text-lg font-bold text-green-900 dark:text-green-100">
                          {(() => {
                            const totalQuestions = filteredSectionStats.reduce((sum, stat) => sum + stat.total, 0);
                            const totalAnswered = filteredSectionStats.reduce((sum, stat) => sum + stat.answeredCount, 0);
                            return totalQuestions > 0 ? ((totalAnswered / totalQuestions) * 100).toFixed(1) : "0.0";
                          })()}%
                        </p>
                      </div>
                      <div className="p-1 bg-green-100 dark:bg-green-900/30 rounded-full flex-shrink-0">
                        <Activity className="w-3 h-3 text-green-600 dark:text-green-400" />
                      </div>
                    </div>

                    {expandResponseRateBreakdown && (
                      <div className="mt-2 pt-2 border-t border-green-300 dark:border-green-800">
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          {(() => {
                            const totalYes = filteredSectionStats.reduce((sum, stat) => sum + stat.yes, 0);
                            const totalNo = filteredSectionStats.reduce((sum, stat) => sum + stat.no, 0);
                            const totalNA = filteredSectionStats.reduce((sum, stat) => sum + stat.na, 0);
                            const totalCorrect = filteredSectionStats.reduce((sum, stat) => sum + stat.correct, 0);
                            const totalWrong = filteredSectionStats.reduce((sum, stat) => sum + stat.wrong, 0);
                            const totalAnswered = filteredSectionStats.reduce((sum, stat) => sum + stat.answeredCount, 0);
                            const yesPercent = totalAnswered > 0 ? ((totalYes / totalAnswered) * 100).toFixed(1) : "0.0";
                            const noPercent = totalAnswered > 0 ? ((totalNo / totalAnswered) * 100).toFixed(1) : "0.0";
                            const naPercent = totalAnswered > 0 ? ((totalNA / totalAnswered) * 100).toFixed(1) : "0.0";
                            const correctPercent = totalAnswered > 0 ? ((totalCorrect / totalAnswered) * 100).toFixed(1) : "0.0";
                            const wrongPercent = totalAnswered > 0 ? ((totalWrong / totalAnswered) * 100).toFixed(1) : "0.0";

                            return (
                              <>
                                {summaryTotals.hasAnyYesNo && (
                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="text-center p-1.5 bg-green-100/60 dark:bg-green-900/20 rounded-md">
                                      <p className="text-[10px] font-bold text-green-700 dark:text-green-400 uppercase tracking-tight">{complianceLabels.yes}</p>
                                      <p className="text-sm font-bold text-green-800 dark:text-green-300">{totalYes}</p>
                                      <p className="text-[10px] text-green-700 dark:text-green-400 font-medium">{yesPercent}%</p>
                                    </div>
                                    <div className="text-center p-1.5 bg-red-100/60 dark:bg-red-900/20 rounded-md">
                                      <p className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase tracking-tight">{complianceLabels.no}</p>
                                      <p className="text-sm font-bold text-red-800 dark:text-red-300">{totalNo}</p>
                                      <p className="text-[10px] text-red-700 dark:text-red-400 font-medium">{noPercent}%</p>
                                    </div>
                                    <div className="text-center p-1.5 bg-yellow-100/60 dark:bg-yellow-900/20 rounded-md">
                                      <p className="text-[10px] font-bold text-yellow-700 dark:text-yellow-400 uppercase tracking-tight">{complianceLabels.na}</p>
                                      <p className="text-sm font-bold text-yellow-800 dark:text-yellow-300">{totalNA}</p>
                                      <p className="text-[10px] text-yellow-700 dark:text-yellow-400 font-medium">{naPercent}%</p>
                                    </div>
                                  </div>
                                )}

                                {/* Accuracy Section */}
                                <div className="col-span-3 mt-1.5 pt-1.5 border-t border-green-200 dark:border-green-800/50">
                                  <p className="text-[10px] font-bold text-green-800 dark:text-green-300 uppercase mb-1 flex items-center gap-1">
                                    <Zap className="w-2.5 h-2.5" /> Accuracy Statistics
                                  </p>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="flex items-center justify-between p-1.5 bg-emerald-100/50 dark:bg-emerald-900/20 rounded border border-emerald-200 dark:border-emerald-800/40">
                                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">Correct</span>
                                      <div className="text-right">
                                        <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200 leading-none">{totalCorrect}</p>
                                        <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">{correctPercent}%</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between p-1.5 bg-rose-100/50 dark:bg-rose-900/20 rounded border border-rose-200 dark:border-rose-800/40">
                                      <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase">Wrong</span>
                                      <div className="text-right">
                                        <p className="text-xs font-bold text-rose-800 dark:text-rose-200 leading-none">{totalWrong}</p>
                                        <p className="text-[9px] text-rose-600 dark:text-rose-400 font-bold">{wrongPercent}%</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-900/20 p-2.5 rounded-lg border border-purple-200 dark:border-purple-700 transition-shadow duration-300">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-0.5">
                          Location
                        </p>
                        <p className="text-xs font-medium text-purple-900 dark:text-purple-100 truncate">
                          {response.submissionMetadata?.location
                            ? (() => {
                              const loc = response.submissionMetadata.location;
                              const parts = [];
                              if (loc.city) parts.push(loc.city);
                              if (loc.region) parts.push(loc.region);
                              if (loc.country) parts.push(loc.country);
                              return parts.length > 0 ? parts.join(", ") : "Unavailable";
                            })()
                            : "Disabled"
                          }
                        </p>
                      </div>
                      <div className="p-1 bg-purple-100 dark:bg-purple-900/30 rounded-full flex-shrink-0">
                        <MapPin className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Basic Information - 75% */}
                <div className="w-3/4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
                {form?.sections && form.sections.length > 0 ? (
                  (() => {
                    const section = form.sections[0];
                    return (
                      <div key={section.id || 0}>
                        <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                          <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 mb-1">
                            {section.title || "Section 1"}
                          </h4>
                        </div>
                        
                        {section.questions && section.questions.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {section.questions.map((question: any) => {
                              const answer = response.answers?.[question.id];
                              const isMainQuestion = question && !question.parentId && !question.showWhen?.questionId;
                              return (
                                <div 
                                  key={question.id} 
                                  className={`p-3 rounded-lg border transition-shadow ${
                                    isMainQuestion 
                                      ? "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-blue-200 dark:border-blue-700" 
                                      : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
                                  }`}
                                >
                                  <div className="flex flex-col gap-1 mb-1">
                                    {question.subParam1 && (
                                      <span className="inline-block bg-blue-100/60 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 px-2 py-0.5 rounded font-semibold text-xs w-fit">
                                        {question.subParam1}
                                      </span>
                                    )}
                                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                                      {question.text || question.label || question.id}
                                    </p>
                                  </div>
                                  <div className="mt-1 flex flex-col gap-1">
                                    {answer !== undefined && answer !== null && answer !== '' 
                                      ? (
                                        <>
                                          {renderHighlightedAnswer(answer, question)}
                                          {question.trackResponseRank && response.responseRanks?.[question.id] && (
                                             <div className="flex flex-col gap-1 mt-2">
                                              {question.trackResponseRankLabel && (
                                                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-tight leading-none">
                                                  {question.trackResponseRankLabel}
                                                </span>
                                              )}
                                              <span className={`text-[10px] font-bold min-w-[24px] h-6 px-1.5 rounded-full flex items-center justify-center border shadow-sm w-fit ${getRankStyle(answer, document.documentElement.classList.contains("dark"))}`}>
                                                #{response.responseRanks[question.id]}
                                              </span>
                                            </div>
                                          )}
                                        </>
                                      )
                                      : <span className="text-gray-400 italic text-xs">No answer</span>
                                    }
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-xs text-gray-500 dark:text-gray-400">
                            No questions in this section
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {response.dealerName && (
                      <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
                          Dealer Name
                        </p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white break-words">
                          {response.dealerName}
                        </p>
                      </div>
                    )}
                    {response.answers?.dealerCode && (
                      <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
                          Dealer Code
                        </p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white break-words">
                          {renderHighlightedAnswer(response.answers.dealerCode)}
                        </p>
                      </div>
                    )}
                    {response.answers?.location && (
                      <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
                          Location
                        </p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white break-words">
                          {renderHighlightedAnswer(response.answers.location)}
                        </p>
                      </div>
                    )}
                    {response.answers?.auditorDate && (
                      <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
                          Auditor Date
                        </p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white break-words">
                          {renderHighlightedAnswer(response.answers.auditorDate)}
                        </p>
                      </div>
                    )}
                    {response.answers?.auditorName && (
                      <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
                          Auditor Name
                        </p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white break-words">
                          {renderHighlightedAnswer(response.answers.auditorName)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                </div>
              </div>

              {/* Charts Section */}
              <div className="flex flex-col lg:flex-row gap-4 items-stretch">
                <div className="flex-shrink-0 lg:w-[70%]">

              {/* Section-wise Breakdown Table */}
              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="bg-primary-600 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-white flex items-center">
                        <BarChart3 className="w-7 h-7 mr-3" />
                        Section-wise Breakdown
                      </h3>
                      <p className="text-blue-100 mt-1">
                        Detailed performance analysis by section with {showWeightageColumns ? "weightage calculations" : "out weightage"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {showWeightageCheckbox && (
                        <div className="flex items-center gap-3 bg-white/20 backdrop-blur-sm rounded-lg p-3 border border-white/30">
                          <label className="flex items-center cursor-pointer">
                            <div className="relative">
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={addWeightMode}
                                onChange={(e) => {
                                  setAddWeightMode(e.target.checked);
                                  if (e.target.checked) {
                                    setShowWeightageColumns(true);
                                    setEditingAllWeightages(true);
                                    const initialValues: Record<string, string> = {};
                                    sectionSummaryRows.forEach(row => {
                                      initialValues[row.id] = row.weightage.toString();
                                    });
                                    setWeightageValues(initialValues);
                                  } else {
                                    setEditingAllWeightages(false);
                                    setWeightageValues({});
                                    setShowWeightageColumns(false);
                                  }
                                }}
                              />
                              <div className={`block w-12 h-6 rounded-full transition-colors duration-200 ${addWeightMode ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'}`}></div>
                              <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ${addWeightMode ? 'transform translate-x-6' : ''}`}></div>
                            </div>
                            <span className="ml-3 font-semibold text-white flex items-center gap-2">
                              <Target className="w-5 h-5" />
                              Add Weight
                            </span>
                          </label>
                          {addWeightMode && (
                            <div className="flex items-center gap-2">
                              <div className="text-xs text-white/80 bg-black/20 px-2 py-1 rounded">
                                Total must be 100%
                              </div>
                              <button
                                onClick={() => {
                                  setAddWeightMode(false);
                                  setEditingAllWeightages(false);
                                  setWeightageValues({});
                                  setShowWeightageColumns(false);
                                }}
                                className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {calculateTotalWeightage > 0 && (
                        <button
                          onClick={() => setShowWeightageColumns(!showWeightageColumns)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                            showWeightageColumns
                              ? 'bg-indigo-400 hover:bg-indigo-500 text-white'
                              : 'bg-gray-400 hover:bg-gray-500 text-white'
                          }`}
                          title={showWeightageColumns ? 'Hide weightage columns' : 'Show weightage columns'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-4.803m5.596-3.856a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0M15 12a3 3 0 11-6 0 3 3 0 016 0zm6 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm font-medium">
                            {showWeightageColumns ? 'Hide' : 'Show'} Weightage
                          </span>
                        </button>
                      )}

                      {showWeightageColumns && !redistributionMode && !editingAllWeightages && (
                        <button
                          onClick={() => {
                            setRedistributionMode(true);
                            const initialValues: Record<string, string> = {};
                            sectionSummaryRows.forEach(row => {
                              initialValues[row.id] = row.weightage.toString();
                            });
                            setTempWeightageValues(initialValues);
                            setWeightageBalance(0);
                          }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-700 hover:bg-primary-800 text-white transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit Weightage
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 sticky top-0">
                      <tr>
                        <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-48">
                          Section
                        </th>
                        <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-20">
                          Total
                        </th>
                        {summaryTotals.hasAnyQuiz && (
                          <>
                            <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-24 text-green-600 dark:text-green-400">
                              Correct
                            </th>
                            <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-24 text-red-600 dark:text-red-400">
                              Wrong
                            </th>
                          </>
                        )}
                        {summaryTotals.hasAnyYesNo && (
                          <>
                            <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-24">
                              {complianceLabels.yes}
                            </th>
                            <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-24">
                              {complianceLabels.no}
                            </th>
                            <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-24">
                              {complianceLabels.na}
                            </th>
                          </>
                        )}
                        {showWeightageColumns && (
                          <>
                            <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-20">
                              Weightage
                            </th>
                            <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-24">
                              {complianceLabels.yes} (%)
                            </th>
                            <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-24">
                              {complianceLabels.no} (%)
                            </th>
                            <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-24">
                              {complianceLabels.na} (%)
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                      {sectionSummaryRows.map((row) => (
                        <tr 
                          key={row.id} 
                          onClick={() => {
                            if (!redistributionMode) {
                              setAutoOpenSectionId(null);
                              setTimeout(() => setAutoOpenSectionId(row.id), 10);
                            }
                          }}
                          className="group hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-600 transition-all duration-300 bg-white dark:bg-gray-900 cursor-pointer"
                        >
                          <td className="px-6 py-5 font-bold text-gray-900 dark:text-gray-100 flex items-center">
                            <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                            <span className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors">
                              {row.title}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-gray-700 dark:text-gray-300 font-medium">
                            {row.total}
                          </td>
                          {summaryTotals.hasAnyQuiz && (
                            <>
                              <td className="px-6 py-5 text-green-600 dark:text-green-400 font-bold">
                                {row.hasQuiz ? `${row.correct} (${row.correctPercent.toFixed(1)}%)` : "-"}
                              </td>
                              <td className="px-6 py-5 text-red-600 dark:text-red-400 font-bold">
                                {row.hasQuiz ? `${row.wrong} (${row.wrongPercent.toFixed(1)}%)` : "-"}
                              </td>
                            </>
                          )}
                          {summaryTotals.hasAnyYesNo && (
                            <>
                              <td className="px-6 py-5 text-gray-700 dark:text-gray-300 font-medium">
                                {row.hasYesNo ? `${row.yes} (${row.yesPercent.toFixed(1)}%)` : "-"}
                              </td>
                              <td className="px-6 py-5 text-gray-700 dark:text-gray-300 font-medium">
                                {row.hasYesNo ? `${row.no} (${row.noPercent.toFixed(1)}%)` : "-"}
                              </td>
                              <td className="px-6 py-5 text-gray-700 dark:text-gray-300 font-medium">
                                {row.hasYesNo ? `${row.na} (${row.naPercent.toFixed(1)}%)` : "-"}
                              </td>
                            </>
                          )}
                          {showWeightageColumns && (
                            <>
                              <td className="px-6 py-5 text-gray-700 dark:text-gray-300 font-medium">
                                {redistributionMode ? (
                                  <div className="flex flex-col items-center">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.1"
                                      value={tempWeightageValues[row.id] !== undefined ? tempWeightageValues[row.id] : row.weightage.toString()}
                                      onChange={(e) => {
                                        const newValue = e.target.value;
                                        const updatedValues = {
                                          ...tempWeightageValues,
                                          [row.id]: newValue
                                        };
                                        setTempWeightageValues(updatedValues);
                                        
                                        const total = Object.values(updatedValues).reduce((sum, val) => {
                                          return sum + (parseFloat(val) || 0);
                                        }, 0);
                                        
                                        setWeightageBalance(100 - total);
                                      }}
                                      className="w-20 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 text-center"
                                    />
                                    <div className="text-xs mt-1">
                                      {(() => {
                                        const currentVal = parseFloat(tempWeightageValues[row.id] !== undefined ? tempWeightageValues[row.id] : row.weightage.toString()) || 0;
                                        const originalVal = row.weightage;
                                        const diff = currentVal - originalVal;

                                        if (diff > 0.1) {
                                          return <span className="text-green-600 font-medium">+{diff.toFixed(1)}</span>;
                                        } else if (diff < -0.1) {
                                          return <span className="text-red-600 font-medium">{diff.toFixed(1)}</span>;
                                        }
                                        return null;
                                      })()}
                                    </div>
                                  </div>
                                ) : editingAllWeightages ? (
                                  <div className="flex flex-col items-center">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.1"
                                      value={weightageValues[row.id] !== undefined ? weightageValues[row.id] : row.weightage.toString()}
                                      onChange={(e) => {
                                        const newValue = e.target.value;
                                        const updatedValues = {
                                          ...weightageValues,
                                          [row.id]: newValue
                                        };
                                        setWeightageValues(updatedValues);
                                      }}
                                      className="w-20 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 text-center"
                                    />
                                    <div className="text-xs mt-1">
                                      {(() => {
                                        const currentVal = parseFloat(weightageValues[row.id] !== undefined ? weightageValues[row.id] : row.weightage.toString()) || 0;
                                        const originalVal = row.weightage;
                                        const diff = currentVal - originalVal;

                                        if (diff > 0.1) {
                                          return <span className="text-green-600 font-medium">+{diff.toFixed(1)}</span>;
                                        } else if (diff < -0.1) {
                                          return <span className="text-red-600 font-medium">{diff.toFixed(1)}</span>;
                                        }
                                        return null;
                                      })()}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center">
                                    <span className="font-bold text-indigo-600 dark:text-indigo-400 text-lg">
                                      {Number.isFinite(row.weightage) ? row.weightage.toFixed(1) : "0.0"}%
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-5 text-gray-700 dark:text-gray-300 font-medium">
                                {row.yesWeighted.toFixed(1)}
                              </td>
                              <td className="px-6 py-5 text-gray-700 dark:text-gray-300 font-medium">
                                {row.noWeighted.toFixed(1)}
                              </td>
                              <td className="px-6 py-5 text-gray-700 dark:text-gray-300 font-medium">
                                {row.naWeighted.toFixed(1)}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}

                      {/* Total Row */}
                      <tr className="bg-gray-50 dark:bg-gray-800/50 font-bold border-t-2 border-gray-300 dark:border-gray-600">
                        <td className="px-6 py-5 text-gray-900 dark:text-gray-100 flex items-center">
                          <div className="w-3 h-3 bg-indigo-600 rounded-full mr-3"></div>
                          <span>TOTAL</span>
                        </td>
                        <td className="px-6 py-5 text-gray-900 dark:text-gray-100 font-bold">
                          {summaryTotals.total}
                        </td>
                        {summaryTotals.hasAnyQuiz && (
                          <>
                            <td className="px-6 py-5 text-green-600 dark:text-green-400 font-bold">
                              {summaryTotals.correct} ({summaryTotals.total > 0 ? ((summaryTotals.correct / summaryTotals.total) * 100).toFixed(1) : 0}%)
                            </td>
                            <td className="px-6 py-5 text-red-600 dark:text-red-400 font-bold">
                              {summaryTotals.wrong} ({summaryTotals.total > 0 ? ((summaryTotals.wrong / summaryTotals.total) * 100).toFixed(1) : 0}%)
                            </td>
                          </>
                        )}
                        {summaryTotals.hasAnyYesNo && (
                          <>
                            <td className="px-6 py-5 text-gray-900 dark:text-gray-100 font-bold">
                              {summaryTotals.yes} ({summaryTotals.total > 0 ? ((summaryTotals.yes / summaryTotals.total) * 100).toFixed(1) : 0}%)
                            </td>
                            <td className="px-6 py-5 text-gray-900 dark:text-gray-100 font-bold">
                              {summaryTotals.no} ({summaryTotals.total > 0 ? ((summaryTotals.no / summaryTotals.total) * 100).toFixed(1) : 0}%)
                            </td>
                            <td className="px-6 py-5 text-gray-900 dark:text-gray-100 font-bold">
                              {summaryTotals.na} ({summaryTotals.total > 0 ? ((summaryTotals.na / summaryTotals.total) * 100).toFixed(1) : 0}%)
                            </td>
                          </>
                        )}
                        {showWeightageColumns && (
                          <>
                            <td className="px-6 py-5 text-center font-bold">
                              <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full font-bold ${redistributionMode ?
                                (Math.abs(weightageBalance) < 0.1 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400') :
                                (Math.abs(summaryTotals.weightage - 100) < 0.1 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400')
                                }`}>
                                {redistributionMode ? `${weightageBalance.toFixed(1)}%` : `${summaryTotals.weightage.toFixed(1)}%`}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-gray-900 dark:text-gray-100 font-bold">
                              {summaryTotals.yesWeighted.toFixed(1)}
                            </td>
                            <td className="px-6 py-5 text-gray-900 dark:text-gray-100 font-bold">
                              {summaryTotals.noWeighted.toFixed(1)}
                            </td>
                            <td className="px-6 py-5 text-gray-900 dark:text-gray-100 font-bold">
                              {summaryTotals.naWeighted.toFixed(1)}
                            </td>
                          </>
                        )}
                      </tr>

                      {/* Consolidated Status Message and Action Buttons Row */}
                      {(redistributionMode || editingAllWeightages) && (
                        <tr className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                          <td colSpan={4 + (summaryTotals.hasAnyYesNo ? 3 : 0) + (showWeightageColumns ? 4 : 0)} className="px-6 py-4">
                            <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                              {/* Status Message */}
                              <div className="flex items-center gap-2">
                                {redistributionMode ? (
                                  <span className={`text-sm font-medium ${Math.abs(weightageBalance) < 0.1 ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"}`}>
                                    {Math.abs(weightageBalance) < 0.1 ?
                                      '✓ Ready to save' :
                                      `Adjust by ${Math.abs(weightageBalance).toFixed(1)}% to reach 100%`}
                                  </span>
                                ) : (
                                  <span className={`text-sm font-medium ${Math.abs(sectionSummaryRows.reduce((sum, row) => sum + (parseFloat(weightageValues[row.id] || row.weightage.toString()) || 0), 0) - 100) < 0.1 ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"}`}>
                                    {Math.abs(sectionSummaryRows.reduce((sum, row) => sum + (parseFloat(weightageValues[row.id] || row.weightage.toString()) || 0), 0) - 100) < 0.1 ?
                                      '✓ Total is 100%' :
                                      `Current Total: ${sectionSummaryRows.reduce((sum, row) => sum + (parseFloat(weightageValues[row.id] || row.weightage.toString()) || 0), 0).toFixed(1)}% (Must be 100%)`}
                                  </span>
                                )}
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-3">
                                {redistributionMode ? (
                                  <>
                                    <button
                                      onClick={() => {
                                        const resetValues: Record<string, string> = {};
                                        sectionSummaryRows.forEach(row => {
                                          resetValues[row.id] = row.weightage.toString();
                                        });
                                        setTempWeightageValues(resetValues);
                                        setWeightageBalance(0);
                                      }}
                                      className="px-3 py-1.5 text-xs bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-1"
                                      title="Reset to original values"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                      Reset
                                    </button>

                                    <button
                                      onClick={() => {
                                        setRedistributionMode(false);
                                        setTempWeightageValues({});
                                        setWeightageBalance(0);
                                      }}
                                      className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                    >
                                      Cancel
                                    </button>

                                    <button
                                      onClick={async () => {
                                        if (Math.abs(weightageBalance) >= 0.1) return;
                                        setSavingWeightage(true);
                                        try {
                                          const formId = form?._id || form?.id;
                                          if (!formId) throw new Error("Form ID not found");

                                          const updatedSections = form?.sections?.map((section: any) => {
                                            const row = sectionSummaryRows.find(r => r.id === section.id);
                                            if (row && tempWeightageValues[row.id] !== undefined) {
                                              return {
                                                ...section,
                                                weightage: parseFloat(tempWeightageValues[row.id]) || 0
                                              };
                                            }
                                            return section;
                                          }) || [];

                                          const formDataToUpdate = { ...form, sections: updatedSections };
                                          delete (formDataToUpdate as any)._id;
                                          delete (formDataToUpdate as any).__v;
                                          delete (formDataToUpdate as any).createdAt;
                                          delete (formDataToUpdate as any).updatedAt;

                                          await apiClient.updateForm(formId, formDataToUpdate);
                                          setForm({ ...form, sections: updatedSections } as Form);
                                          setRedistributionMode(false);
                                          setTempWeightageValues({});
                                          setWeightageBalance(0);
                                          showSuccess("Weightages redistributed successfully!");
                                        } catch (error) {
                                          console.error("Failed to save weightages:", error);
                                          showError("Failed to redistribute weightages");
                                        } finally {
                                          setSavingWeightage(false);
                                        }
                                      }}
                                      disabled={Math.abs(weightageBalance) >= 0.1 || savingWeightage}
                                      className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                                    >
                                      {savingWeightage ? "Saving..." : "Save Redistribution"}
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => {
                                        setEditingAllWeightages(false);
                                        setWeightageValues({});
                                        if (calculateTotalWeightage === 0) setAddWeightMode(false);
                                      }}
                                      className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                    >
                                      Cancel
                                    </button>

                                    <button
                                      onClick={async () => {
                                        const batchTotal = sectionSummaryRows.reduce((sum, row) => sum + (parseFloat(weightageValues[row.id] || row.weightage.toString()) || 0), 0);
                                        if (Math.abs(batchTotal - 100) > 0.1) return;

                                        setSavingWeightage(true);
                                        try {
                                          const formId = form?._id || form?.id;
                                          if (!formId) throw new Error("Form ID not found");

                                          const updatedSections = form?.sections?.map((section: any) => {
                                            const row = sectionSummaryRows.find(r => r.id === section.id);
                                            if (row && weightageValues[row.id] !== undefined) {
                                              return {
                                                ...section,
                                                weightage: parseFloat(weightageValues[row.id]) || 0
                                              };
                                            }
                                            return section;
                                          }) || [];

                                          const formDataToUpdate = { ...form, sections: updatedSections };
                                          delete (formDataToUpdate as any)._id;
                                          delete (formDataToUpdate as any).__v;
                                          await apiClient.updateForm(formId, formDataToUpdate);

                                          setForm({ ...form, sections: updatedSections } as Form);
                                          setEditingAllWeightages(false);
                                          setAddWeightMode(false);
                                          setWeightageValues({});
                                          showSuccess("All weightages saved successfully!");
                                        } catch (error) {
                                          showError("Failed to save weightages");
                                        } finally {
                                          setSavingWeightage(false);
                                        }
                                      }}
                                      disabled={savingWeightage || Math.abs(sectionSummaryRows.reduce((sum, row) => sum + (parseFloat(weightageValues[row.id] || row.weightage.toString()) || 0), 0) - 100) > 0.1}
                                      className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                                    >
                                      {savingWeightage ? "Saving..." : "Save All"}
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
                <div className="lg:w-[30%] flex flex-col gap-4">
                  {showWeightageColumns && (
                    <div className="bg-gradient-to-br from-white via-green-50/30 to-emerald-50/30 dark:from-gray-800 dark:via-green-900/10 dark:to-emerald-900/10 p-2 rounded-2xl border border-green-200/50 dark:border-green-700/50 transform hover:scale-[1.02] transition-all duration-500 backdrop-blur-sm w-full flex flex-col">
                      <div className="flex flex-col items-center justify-center mb-1 gap-1">
                        <h3 className="text-xs font-bold text-gray-900 dark:text-white flex flex-col items-center text-center">
                          <div className="p-1 bg-green-500/20 rounded-md mb-0.5">
                            <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />
                          </div>
                          <span>Weighted Trends</span>
                        </h3>
                        <div className="flex flex-row justify-center gap-1 bg-white/50 dark:bg-gray-700/50 rounded-md px-1 py-0.5">
                          <div className="flex items-center space-x-0.5">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                            <span className="text-[7px] font-medium text-gray-700 dark:text-gray-300">{complianceLabels.yes[0]}×W</span>
                          </div>
                          <div className="flex items-center space-x-0.5">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                            <span className="text-[7px] font-medium text-gray-700 dark:text-gray-300">{complianceLabels.no[0]}×W</span>
                          </div>
                          <div className="flex items-center space-x-0.5">
                            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                            <span className="text-[7px] font-medium text-gray-700 dark:text-gray-300">{complianceLabels.na[0] === "N" ? "NA" : complianceLabels.na[0]}×W</span>
                          </div>
                        </div>
                      </div>
                      <div className="w-full h-48 flex items-center justify-center">
                        <Line data={weightedPercentageChartData} options={weightedPercentageChartOptions} />
                      </div>
                    </div>
                  )}
                  <div className="bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/30 dark:from-gray-800 dark:via-blue-900/10 dark:to-indigo-900/10 p-2 rounded-2xl border border-blue-200/50 dark:border-blue-700/50 transform hover:scale-[1.02] transition-all duration-500 backdrop-blur-sm w-full flex flex-col">
                    <div className="flex flex-col items-center justify-center mb-1 gap-1">
                      <h3 className="text-xs font-bold text-gray-900 dark:text-white flex flex-col items-center text-center">
                        <span>Section Performance</span>
                      </h3>
                      <div className="flex gap-1 bg-white/50 dark:bg-gray-700/50 rounded-md px-1.5 py-1 flex-row">
                        <div className="flex items-center space-x-0.5">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                          <span className="text-[8px] font-medium text-gray-700 dark:text-gray-300">Correct</span>
                        </div>
                        <div className="flex items-center space-x-0.5">
                          <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                          <span className="text-[8px] font-medium text-gray-700 dark:text-gray-300">Wrong</span>
                        </div>
                        <div className="flex items-center space-x-0.5">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                          <span className="text-[8px] font-medium text-gray-700 dark:text-gray-300">{complianceLabels.yes}</span>
                        </div>
                        <div className="flex items-center space-x-0.5">
                          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                          <span className="text-[8px] font-medium text-gray-700 dark:text-gray-300">{complianceLabels.no}</span>
                        </div>
                        <div className="flex items-center space-x-0.5">
                          <div className="w-1.5 h-1.5 bg-blue-300 rounded-full"></div>
                          <span className="text-[8px] font-medium text-gray-700 dark:text-gray-300">{complianceLabels.na}</span>
                        </div>
                      </div>
                    </div>
                    <div id="section-performance-chart" className="w-full h-48 flex items-center justify-center">
                      <Radar data={sectionChartData} options={{...sectionChartOptions, maintainAspectRatio: false}} />
                    </div>
                  </div>
                </div>
          </div>







            


              {/* Section - Yes/No/N/A Analysis for ALL Sections */}
              {form?.sections?.map((section: any) => {
                if (!section) return null;

                const questionStats = getSectionYesNoQuestionStats(section.id);
                if (questionStats.length === 0) return null;

                const hasAnyYesNoInSection = questionStats.some(q => q.hasYesNo);
                const yesNoStats = questionStats.filter(q => q.hasYesNo && !q.isQuiz);
                const quizStats = questionStats.filter(q => q.isQuiz);
                // Also handle other types that might not be either but have stats
                const otherStats = questionStats.filter(q => !q.hasYesNo && !q.isQuiz);

                const sectionTotals = questionStats.reduce(
                  (totals, stat) => ({
                    yes: totals.yes + stat.yes,
                    no: totals.no + stat.no,
                    na: totals.na + stat.na,
                    correct: totals.correct + stat.correct,
                    wrong: totals.wrong + stat.wrong,
                    total: totals.total + stat.total,
                  }),
                  { yes: 0, no: 0, na: 0, total: 0, correct: 0, wrong: 0 }
                );

                const sectionPercentages = {
                  yes:
                    sectionTotals.total > 0
                      ? ((sectionTotals.yes / sectionTotals.total) * 100).toFixed(1)
                      : "0.0",
                  no:
                    sectionTotals.total > 0
                      ? ((sectionTotals.no / sectionTotals.total) * 100).toFixed(1)
                      : "0.0",
                  na:
                    sectionTotals.total > 0
                      ? ((sectionTotals.na / sectionTotals.total) * 100).toFixed(1)
                      : "0.0",
                  correct:
                    sectionTotals.total > 0
                      ? ((sectionTotals.correct / sectionTotals.total) * 100).toFixed(1)
                      : "0.0",
                  wrong:
                    sectionTotals.total > 0
                      ? ((sectionTotals.wrong / sectionTotals.total) * 100).toFixed(1)
                      : "0.0",
                };

                const hasYesNo = yesNoStats.length > 0;
                const hasQuiz = quizStats.length > 0;

                const labels: string[] = [];
                const data: number[] = [];
                const colors: string[] = [];

                if (hasYesNo && hasQuiz) {
                  labels.push("Correct", "Wrong", complianceLabels.yes, complianceLabels.no);
                  data.push(sectionTotals.correct, sectionTotals.wrong, sectionTotals.yes, sectionTotals.no);
                  colors.push("#10b981", "#ef4444", "#1e40af", "#3b82f6");
                  if (sectionTotals.na > 0) {
                    labels.push(complianceLabels.na);
                    data.push(sectionTotals.na);
                    colors.push("#93c5fd");
                  }
                } else if (hasYesNo) {
                  labels.push(complianceLabels.yes, complianceLabels.no);
                  data.push(sectionTotals.yes, sectionTotals.no);
                  colors.push("#1e40af", "#3b82f6");
                  if (sectionTotals.na > 0) {
                    labels.push(complianceLabels.na);
                    data.push(sectionTotals.na);
                    colors.push("#93c5fd");
                  }
                } else {
                  labels.push("Correct", "Wrong");
                  data.push(sectionTotals.correct, sectionTotals.wrong);
                  colors.push("#16a34a", "#dc2626");
                  if (sectionTotals.na > 0) {
                    labels.push(complianceLabels.na);
                    data.push(sectionTotals.na);
                    colors.push("#94a3b8");
                  }
                }

                const chartData = {
                  labels,
                  datasets: [
                    {
                      data,
                      backgroundColor: colors,
                      borderColor: colors,
                      borderWidth: 2,
                    },
                  ],
                };

                const chartOptions = {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "bottom" as const,
                      labels: {
                        color: document.documentElement.classList.contains("dark")
                          ? "#d1d5db"
                          : "#374151",
                        boxWidth: 10,
                        padding: 10,
                        font: { size: 10 }
                      },
                    },
                    tooltip: {
                      callbacks: {
                        label: (context: any) => {
                          const total = sectionTotals.total;
                          const value =
                            typeof context.parsed === "number"
                              ? context.parsed
                              : context.parsed?.y || 0;
                          const percentage =
                            total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                          return `${context.label}: ${value} (${percentage}%)`;
                        },
                      },
                    },
                  },
                };

                return (
                  <div key={section.id} id={`section-detail-${section.id}`} className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800">
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        {section.title || "Section"} - {(hasAnyYesNoInSection && quizStats.length > 0) ? "Compliance & Accuracy Analysis" : hasAnyYesNoInSection ? "Compliance Analysis" : "Accuracy Analysis"}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {(hasAnyYesNoInSection && quizStats.length > 0)
                          ? `Question-wise breakdown of compliance (${complianceLabels.yes}/${complianceLabels.no}) and accuracy (Correct/Wrong) with section summary`
                          : hasAnyYesNoInSection
                            ? `Question-wise breakdown of compliance (${complianceLabels.yes}/${complianceLabels.no}/${complianceLabels.na}) with overall section summary`
                            : "Question-wise breakdown of quiz accuracy with overall section summary"}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Chart */}
                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
                            <PieChart className="w-4 h-4 mr-2" />
                            Response Distribution
                          </h4>
                          <select
                            value={sectionChartTypes[section.id] || "pie"}
                            onChange={(e) =>
                              setSectionChartTypes((prev) => ({
                                ...prev,
                                [section.id]: e.target.value as "pie" | "bar",
                              }))
                            }
                            className="px-2.5 py-1 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="pie">Pie Chart</option>
                            <option value="bar">Bar Chart</option>
                          </select>
                        </div>
                        <div id={`section-chart-${section.id}`} className="w-full h-56">
                          {sectionChartTypes[section.id] === "bar" ? (
                            <Bar
                              data={{
                                labels: questionStats.map(
                                  (stat) => stat.subParam1 || "No parameter"
                                ),
                                datasets: [
                                  {
                                    label: "Correct",
                                    data: questionStats.map((stat) => stat.correct),
                                    backgroundColor: "#10b981",
                                    borderColor: "#10b981",
                                    borderWidth: 1,
                                    hidden: !hasQuiz,
                                  },
                                  {
                                    label: "Wrong",
                                    data: questionStats.map((stat) => stat.wrong),
                                    backgroundColor: "#ef4444",
                                    borderColor: "#ef4444",
                                    borderWidth: 1,
                                    hidden: !hasQuiz,
                                  },
                                  {
                                    label: complianceLabels.yes,
                                    data: questionStats.map((stat) => stat.yes),
                                    backgroundColor: "#1e40af",
                                    borderColor: "#1e40af",
                                    borderWidth: 1,
                                    hidden: !hasYesNo,
                                  },
                                  {
                                    label: complianceLabels.no,
                                    data: questionStats.map((stat) => stat.no),
                                    backgroundColor: "#3b82f6",
                                    borderColor: "#3b82f6",
                                    borderWidth: 1,
                                    hidden: !hasYesNo,
                                  },
                                  {
                                    label: complianceLabels.na,
                                    data: questionStats.map((stat) => stat.na),
                                    backgroundColor: "#93c5fd",
                                    borderColor: "#93c5fd",
                                    borderWidth: 1,
                                    hidden: !hasYesNo || sectionTotals.na === 0,
                                  },
                                ],
                              }}
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                  legend: {
                                    position: "top" as const,
                                    labels: {
                                      color: document.documentElement.classList.contains(
                                        "dark"
                                      )
                                        ? "#d1d5db"
                                        : "#374151",
                                    },
                                  },
                                },
                              }}
                            />
                          ) : (
                            <Pie data={chartData} options={chartOptions} />
                          )}
                        </div>
                      </div>

                      {/* Compliance Analysis Table (Yes/No/NA) */}
                      {hasAnyYesNoInSection && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden mb-4">
                          <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 border-b border-blue-100 dark:border-blue-800">
                            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 flex items-center">
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Compliance Analysis ({complianceLabels.yes}/{complianceLabels.no}/{complianceLabels.na})
                            </h4>
                          </div>
                          <div className="overflow-auto max-h-60">
                            <table className="w-full divide-y divide-gray-200 dark:divide-gray-800 text-xs">
                              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                                <tr>
                                  <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider w-[40%]">
                                    Parameter
                                  </th>
                                  <th className="px-3 py-2 text-center font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider w-[20%]">
                                    {complianceLabels.yes}
                                  </th>
                                  <th className="px-3 py-2 text-center font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wider w-[20%]">
                                    {complianceLabels.no}
                                  </th>
                                  <th className="px-3 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[20%]">
                                    {complianceLabels.na}
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
                                {questionStats.filter(q => q.hasYesNo).map((stat, index) => {
                                  const total = stat.yes + stat.no + stat.na;
                                  const yesPercent = total > 0 ? ((stat.yes / total) * 100).toFixed(1) : 0;
                                  const noPercent = total > 0 ? ((stat.no / total) * 100).toFixed(1) : 0;
                                  const naPercent = total > 0 ? ((stat.na / total) * 100).toFixed(1) : 0;
                                  return (
                                    <tr key={stat.id} className={index % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50/50 dark:bg-gray-800/30"}>
                                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                                        {stat.subParam1 || stat.title}
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        <div className="flex flex-col items-center">
                                          <span className={`font-bold ${stat.yes > 0 ? "text-blue-700 dark:text-blue-400" : "text-gray-400"}`}>{stat.yes}</span>
                                          {stat.yes > 0 && <span className="text-[10px] text-blue-600/70">{yesPercent}%</span>}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        <div className="flex flex-col items-center">
                                          <span className={`font-bold ${stat.no > 0 ? "text-blue-500 dark:text-blue-400" : "text-gray-400"}`}>{stat.no}</span>
                                          {stat.no > 0 && <span className="text-[10px] text-blue-500/70">{noPercent}%</span>}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        <div className="flex flex-col items-center">
                                          <span className={`font-bold ${stat.na > 0 ? "text-gray-600 dark:text-gray-400" : "text-gray-400"}`}>{stat.na}</span>
                                          {stat.na > 0 && <span className="text-[10px] text-gray-500/70">{naPercent}%</span>}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Accuracy Analysis Table (Correct/Wrong) */}
                      {questionStats.some(q => q.isQuiz) && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                          <div className="bg-green-50 dark:bg-green-900/20 px-4 py-2.5 border-b border-green-100 dark:border-green-800">
                            <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 flex items-center">
                              <Award className="w-4 h-4 mr-2" />
                              Accuracy Analysis (Correct/Wrong)
                            </h4>
                          </div>
                          <div className="overflow-auto max-h-60">
                            <table className="w-full divide-y divide-gray-200 dark:divide-gray-800 text-xs">
                              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                                <tr>
                                  <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider w-[40%]">
                                    Parameter
                                  </th>
                                  <th className="px-3 py-2 text-center font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider w-[30%]">
                                    Correct
                                  </th>
                                  <th className="px-3 py-2 text-center font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider w-[30%]">
                                    Wrong
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
                                {questionStats.filter(q => q.isQuiz).map((stat, index) => {
                                  const total = stat.correct + stat.wrong;
                                  const correctPercent = total > 0 ? ((stat.correct / total) * 100).toFixed(1) : 0;
                                  const wrongPercent = total > 0 ? ((stat.wrong / total) * 100).toFixed(1) : 0;
                                  return (
                                    <tr key={stat.id} className={index % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50/50 dark:bg-gray-800/30"}>
                                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                                        {stat.subParam1 || stat.title}
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        <div className="flex flex-col items-center">
                                          <span className={`font-bold ${stat.correct > 0 ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>{stat.correct}</span>
                                          {stat.correct > 0 && <span className="text-[10px] text-green-600/70">{correctPercent}%</span>}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        <div className="flex flex-col items-center">
                                          <span className={`font-bold ${stat.wrong > 0 ? "text-red-600 dark:text-red-400" : "text-gray-400"}`}>{stat.wrong}</span>
                                          {stat.wrong > 0 && <span className="text-[10px] text-red-600/70">{wrongPercent}%</span>}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Main Parameters Table */}
                    {(() => {
                    const allSectionQuestions = getSectionQuestionsWithFollowUps(section.id);
                    
                    // Filter: Only show main questions that have at least one answered follow-up question
                    // We check if any of the follow-ups for THIS main question have an actual answer
                    const sectionQuestions = allSectionQuestions.filter((q: any) => {
                      return q.followUpQuestions?.some((fq: any) => {
                        const checkIsImage = (val: any): boolean => {
                          if (!val) return false;
                          if (Array.isArray(val)) return val.some(v => checkIsImage(v));
                          if (typeof val === 'object') {
                            if (val.url && isImageUrl(String(val.url))) return true;
                            if (val.answer && isImageUrl(String(val.answer))) return true;
                            return Object.values(val).some(v => checkIsImage(v));
                          }
                          return isImageUrl(String(val));
                        };

                        const hasActualAnswer = fq.answer !== undefined && fq.answer !== null && fq.answer !== "" && 
                          fq.answer !== "N/A" && fq.answer !== "n/a" && 
                          String(fq.answer).toLowerCase() !== complianceLabels.na.toLowerCase();

                        return hasActualAnswer || checkIsImage(fq.answer);
                      });
                    });

                    if (sectionQuestions.length === 0) {
                      return null;
                    }

                    const allFollowUpIds = new Set<string>();
                    const followUpIdAnswerStatus = new Map<string, boolean>();

                    sectionQuestions.forEach((q: any) => {
                      q.followUpQuestions.forEach((fq: any) => {
                        allFollowUpIds.add(fq.id);
                        
                        // Check if it's an image (recursive check)
                        const checkIsImage = (val: any): boolean => {
                          if (!val) return false;
                          if (Array.isArray(val)) return val.some(v => checkIsImage(v));
                          if (typeof val === 'object') {
                            if (val.url && isImageUrl(String(val.url))) return true;
                            if (val.answer && isImageUrl(String(val.answer))) return true;
                            return Object.values(val).some(v => checkIsImage(v));
                          }
                          return isImageUrl(String(val));
                        };

                        const hasActualAnswer = fq.answer !== undefined && fq.answer !== null && fq.answer !== "" && 
                          fq.answer !== "N/A" && fq.answer !== "n/a" && 
                          String(fq.answer).toLowerCase() !== complianceLabels.na.toLowerCase();

                        if (hasActualAnswer || checkIsImage(fq.answer)) {
                          followUpIdAnswerStatus.set(fq.id, true);
                        }
                      });
                    });

                    const followUpIdsWithAnswers = Array.from(allFollowUpIds).filter(
                      (id) => followUpIdAnswerStatus.get(id) === true
                    );

                    const followUpsBySubParam: Map<
                      string,
                      Array<{ id: string; subParam1?: string; answer?: any }>
                    > = new Map();

                    followUpIdsWithAnswers.forEach((followUpId) => {
                      const followUpObj = sectionQuestions
                        .flatMap((q: any) => q.followUpQuestions)
                        .find((fq: any) => fq.id === followUpId);

                      const subParamKey = followUpObj?.subParam1 || followUpId;
                      if (!followUpsBySubParam.has(subParamKey)) {
                        followUpsBySubParam.set(subParamKey, []);
                      }
                      followUpsBySubParam.get(subParamKey)!.push({
                        id: followUpId,
                        subParam1: followUpObj?.subParam1,
                        answer: followUpObj?.answer,
                      });
                    });

                    const uniqueSubParams = Array.from(followUpsBySubParam.keys());

                    const hasImages = Array.from(followUpsBySubParam.values()).some(
                      (items) => items.some((item) => {
                        const checkValue = (val: any): boolean => {
                          if (!val) return false;
                          if (Array.isArray(val)) return val.some(v => checkValue(v));
                          if (typeof val === 'object') {
                            if (val.url && isImageUrl(String(val.url))) return true;
                            if (val.answer && isImageUrl(String(val.answer))) return true;
                            return Object.values(val).some(v => checkValue(v));
                          }
                          return isImageUrl(String(val));
                        };
                        return checkValue(item.answer);
                      })
                    );

                    return (
                      <div className="bg-gradient-to-br from-blue-50 to-blue-50 dark:from-blue-900/20 dark:to-blue-900/20 p-8 rounded-3xl border border-blue-200 dark:border-blue-800 mt-4">
                        <div className="mb-6 flex items-center justify-between">
                          <h3 className="text-2xl font-bold text-blue-900 dark:text-blue-100 flex items-center gap-3">
                            <div className="w-1 h-8 bg-blue-600 rounded-full"></div>
                            {section.title || "Section"} - Main Parameters
                          </h3>
                          {hasImages && (
                            <button
                              onClick={() =>
                                setShowMainParamsImages((prev) => ({
                                  ...prev,
                                  [section.id]: !prev[section.id],
                                }))
                              }
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                showMainParamsImages[section.id]
                                  ? "bg-blue-600 text-white hover:bg-blue-700"
                                  : "bg-gray-300 text-gray-700 hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200"
                              }`}
                            >
                              {showMainParamsImages[section.id] ? "Hide Images" : "View Images"}
                            </button>
                          )}
                        </div>

                        {allFollowUpIds.size === 0 && sectionQuestions.length > 0 && (
                          <div className="mt-3 p-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 rounded text-sm text-yellow-800 dark:text-yellow-200">
                            <strong>⚠️ No follow-up questions found</strong> for{" "}
                            {sectionQuestions.length} main question(s)
                          </div>
                        )}

                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-blue-200 dark:bg-blue-800/50">
                                <th className="px-6 py-3 text-left text-blue-900 dark:text-blue-100 font-semibold border border-blue-300 dark:border-blue-700 min-w-64">
                                  Main Parameters
                                </th>
                                {uniqueSubParams.map((subParam) => (
                                  <th
                                    key={subParam}
                                    className="px-4 py-3 text-left text-blue-900 dark:text-blue-100 font-semibold border border-blue-300 dark:border-blue-700 min-w-48 bg-blue-50 dark:bg-blue-900/30"
                                  >
                                    <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                                      {subParam}
                                    </span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sectionQuestions.map((mainQuestion, index) => (
                                <tr
                                  key={mainQuestion.id}
                                  className={`border-b border-blue-200 dark:border-blue-800 ${
                                    index % 2 === 0
                                      ? "bg-white dark:bg-gray-800/50"
                                      : "bg-blue-100/30 dark:bg-blue-900/10"
                                  }`}
                                >
                                  <td className="px-6 py-4 font-medium text-gray-800 dark:text-gray-200 border border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30">
                                    <div className="flex flex-col gap-3">
                                      {mainQuestion.subParam1 && (
                                        <span
                                          className="inline-block px-3 py-1 bg-blue-100/60 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 text-xs font-bold rounded-md w-fit"
                                          title={mainQuestion.subParam1}
                                        >
                                          {mainQuestion.subParam1}
                                        </span>
                                      )}
                                      <div
                                        className="text-xs text-gray-600 dark:text-gray-400"
                                        title={mainQuestion.title}
                                      >
                                        {mainQuestion.title}
                                      </div>
                                    </div>
                                  </td>
                                  {uniqueSubParams.map((subParam) => {
                                    const followUpsForParam =
                                      followUpsBySubParam.get(subParam) || [];
                                    const answerQuestionPairs = followUpsForParam
                                      .map((followUp) => {
                                        const followUpFromMain =
                                          mainQuestion.followUpQuestions.find(
                                            (fq: any) => fq.id === followUp.id
                                          );
                                        const answer = followUpFromMain?.answer;
                                        
                                        const isNotEmpty = answer !== undefined && answer !== null && answer !== "" && 
                                          (!Array.isArray(answer) || answer.length > 0) &&
                                          (typeof answer !== "object" || Object.keys(answer).length > 0);
                                        
                                        const isNA = typeof answer === "string" && (
                                          answer === "N/A" || 
                                          answer === "n/a" || 
                                          answer.toLowerCase() === complianceLabels.na.toLowerCase()
                                        );

                                        if (isNotEmpty && !isNA) {
                                          return {
                                            answer,
                                            question: followUpFromMain,
                                          };
                                        }
                                        return null;
                                      })
                                      .filter((item) => item !== null);

                                    return (
                                      <td
                                        key={subParam}
                                        className="px-4 py-4 border border-blue-200 dark:border-blue-800 text-sm text-gray-700 dark:text-gray-300 bg-blue-50/40 dark:bg-blue-900/20"
                                      >
                                        {answerQuestionPairs.length > 0 ? (
                                          <div className="flex flex-wrap gap-2">
                                            {answerQuestionPairs.map((item: any, idx) => {
                                              const renderValue = (val: any): React.ReactNode => {
                                                if (val === null || val === undefined || val === "") return null;

                                                if (Array.isArray(val)) {
                                                  return (
                                                    <div className="flex flex-col gap-1">
                                                      {val.map((v, i) => (
                                                        <div key={i}>{renderValue(v)}</div>
                                                      ))}
                                                    </div>
                                                  );
                                                }

                                                if (typeof val === 'object') {
                                                  if (val.url && isImageUrl(String(val.url))) {
                                                    return (
                                                      <ImageLink 
                                                        text={String(val.url)} 
                                                        showImage={showMainParamsImages[section.id] ?? false} 
                                                      />
                                                    );
                                                  }
                                                  if (val.answer && isImageUrl(String(val.answer))) {
                                                    return (
                                                      <ImageLink 
                                                        text={String(val.answer)} 
                                                        showImage={showMainParamsImages[section.id] ?? false} 
                                                      />
                                                    );
                                                  }
                                                  
                                                  const entries = Object.entries(val);
                                                  if (entries.length > 0) {
                                                    return (
                                                      <div className="flex flex-col gap-1">
                                                        {entries.map(([k, v], i) => (
                                                          <div key={i} className="flex flex-col gap-0.5">
                                                            <span className="text-[10px] font-bold opacity-70 uppercase tracking-tighter text-blue-800 dark:text-blue-300">
                                                              {k}
                                                            </span>
                                                            {renderValue(v)}
                                                          </div>
                                                        ))}
                                                      </div>
                                                    );
                                                  }
                                                  return JSON.stringify(val);
                                                }

                                                const textValue = String(val);
                                                if (isImageUrl(textValue)) {
                                                  return (
                                                    <ImageLink 
                                                      text={textValue} 
                                                      showImage={showMainParamsImages[section.id] ?? false} 
                                                    />
                                                  );
                                                }

                                                return textValue;
                                              };

                                              return (
                                                <div key={idx} className="w-full">
                                                  <div className="font-medium text-gray-800 dark:text-gray-200">
                                                    {renderValue(item.answer)}
                                                  </div>
                                                  {response?.responseRanks?.[item.question?.id] && (
                                                    <div className={`text-[10px] font-bold min-w-[24px] h-6 px-1.5 rounded-full flex items-center justify-center border shadow-sm w-fit mt-1 ${getRankStyle(item.answer, document.documentElement.classList.contains("dark"))}`}>
                                                      #{response.responseRanks[item.question.id]}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        ) : (
                                          <span className="text-gray-400 italic">
                                            {complianceLabels.na}
                                          </span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                  </div>
                );
              })}



              {/* Response Summary Card */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Response Summary
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg mt-1">
                      <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                        Form Name
                      </p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                        {form.title}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg mt-1">
                      <Calendar className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                        Submission Date
                      </p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                        {formatTimestamp(response.createdAt)}
                      </p>
                    </div>
                  </div>
                  {response.submissionMetadata?.location && (
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg mt-1">
                        <MapPin className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                          Location
                        </p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                          {response.submissionMetadata.location.city},{" "}
                          {response.submissionMetadata.location.country}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                No section data available for analysis
              </p>
            </div>
          )
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Form Responses
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => handleDownloadPDF('responses-view')}
                  disabled={generatingPDF || exportingZip}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#0891b2" }}
                >
                  {generatingPDF ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  <span>{generatingPDF ? "Generating PDF..." : "Download as PDF"}</span>
                </button>
                <button
                  onClick={handleBulkDownloadZip}
                  disabled={generatingPDF || exportingZip}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#0e7490" }}
                >
                  {exportingZip ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>{exportingZip ? "Preparing ZIP..." : "Bulk Download (ZIP)"}</span>
                </button>
              </div>
            </div>
            <div className="space-y-8">
              {form.sections?.map((section: any) => {
                const sectionAnswers = Object.entries(response.answers).filter(([key]) => {
                  const question = questions[key];
                  return section.questions?.some((q: any) => q.id === key || q.followUpQuestions?.some((fq: any) => fq.id === key));
                });

                if (sectionAnswers.length === 0) return null;

                return (
                  <div key={section.id} className="border-t border-gray-200 dark:border-gray-700 pt-6 first:border-t-0 first:pt-0">
                    <h4 className="text-lg font-bold text-blue-700 dark:text-blue-400 mb-4 pb-3 border-b-2 border-blue-300 dark:border-blue-600 flex items-center gap-2">
                      <div className="w-1 h-6 bg-blue-600 dark:bg-blue-400 rounded-full"></div>
                      {section.title}
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[40%]">
                              Question
                            </th>
                            <th scope="col" className="px-6 py-4 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[60%]">
                              Response
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                          {sectionAnswers.map(([key, value], idx) => {
                            const question = questions[key];
                            const isMainQuestion = question && !question.parentId && !question.showWhen?.questionId;
                            const hasCorrectAnswer = !!(question?.correctAnswer || (question?.correctAnswers && question?.correctAnswers.length > 0));

                            return (
                              <tr 
                                key={key} 
                                className={`${idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/30'} hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors`}
                              >
                                <td className="px-6 py-4">
                                  <div className="flex flex-col gap-1.5">
                                    {question?.subParam1 && (
                                      <span className="inline-block bg-blue-100/60 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 px-2 py-0.5 rounded font-semibold text-[10px] w-fit uppercase tracking-wider">
                                        {question.subParam1}
                                      </span>
                                    )}
                                    <div className="flex items-center gap-2">
                                      <div className="font-semibold text-gray-900 dark:text-white text-sm">
                                        {question?.text || key}
                                      </div>
                                      {question?.id && response?.responseRanks && response.responseRanks[question.id] !== undefined && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest bg-blue-100/50 text-blue-700 border border-blue-200 shadow-sm">
                                          Rank #{response.responseRanks[question.id]}{response.answers[question.id] && `: ${String(typeof response.answers[question.id] === 'object' ? (response.answers[question.id].chassisNumber || JSON.stringify(response.answers[question.id])) : response.answers[question.id])}`}
                                        </span>
                                      )}
                                    </div>
                                    {question?.description && (
                                      <div 
                                        className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2"
                                        dangerouslySetInnerHTML={{ __html: question.description }}
                                      />
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  {hasCorrectAnswer ? (
                                    <div className="flex items-center justify-center gap-4">
                                      <div className="flex-1 flex justify-center">
                                        <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm font-medium border border-green-100 dark:border-green-800/30">
                                          {question.correctAnswers && question.correctAnswers.length > 0
                                            ? question.correctAnswers.join(", ")
                                            : String(question.correctAnswer || "")}
                                        </div>
                                      </div>
                                      <div className="w-px h-8 bg-gray-200 dark:bg-gray-700"></div>
                                      <div className="flex-1 flex justify-center">
                                        {Array.isArray(value) ? (
                                          <div className="space-y-1">
                                            {value.map((v, i) => (
                                              <div key={i}>{renderHighlightedAnswer(v, question, true)}</div>
                                            ))}
                                          </div>
                                        ) : (
                                          renderHighlightedAnswer(value, question, true)
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex justify-center">
                                      {Array.isArray(value) ? (
                                        <div className="space-y-1">
                                          {value.map((v, i) => (
                                            <div key={i}>{renderHighlightedAnswer(v, question, true)}</div>
                                          ))}
                                        </div>
                                      ) : (
                                        renderHighlightedAnswer(value, question, true)
                                      )}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {editingResponse && editingFormLoading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl px-6 py-4 flex items-center gap-3 border border-gray-200 dark:border-gray-700">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
            <div className="text-primary-600 dark:text-primary-400 font-semibold">
              Loading form details...
            </div>
          </div>
        </div>
      )}

      {editingResponse && editingForm && !editingFormLoading && (
        <ResponseEdit
          response={editingResponse as any}
          question={editingForm as any}
          onSave={handleSaveEditedResponse}
          onCancel={handleCloseEdit}
        />
      )}

      {showSectionsPDFModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-auto border border-gray-200 dark:border-gray-700">
            <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                View Sections - PDF Preview
              </h2>
              <button
                onClick={() => setShowSectionsPDFModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {(() => {
                const totalYes = filteredSectionStats.reduce((sum, stat) => sum + stat.yes, 0);
                const totalNo = filteredSectionStats.reduce((sum, stat) => sum + stat.no, 0);
                const totalNA = filteredSectionStats.reduce((sum, stat) => sum + stat.na, 0);
                const totalCorrect = filteredSectionStats.reduce((sum, stat) => sum + stat.correct, 0);
                const totalWrong = filteredSectionStats.reduce((sum, stat) => sum + stat.wrong, 0);
                const totalQuestions = filteredSectionStats.reduce((sum, stat) => sum + stat.total, 0);

                const yesPercent = totalQuestions > 0 ? ((totalYes / totalQuestions) * 100).toFixed(1) : "0.0";
                const noPercent = totalQuestions > 0 ? ((totalNo / totalQuestions) * 100).toFixed(1) : "0.0";
                const naPercent = totalQuestions > 0 ? ((totalNA / totalQuestions) * 100).toFixed(1) : "0.0";
                const correctPercent = totalQuestions > 0 ? ((totalCorrect / totalQuestions) * 100).toFixed(1) : "0.0";
                const wrongPercent = totalQuestions > 0 ? ((totalWrong / totalQuestions) * 100).toFixed(1) : "0.0";

                const radarData = {
                  labels: filteredSectionStats.map((stat) => stat.title),
                  datasets: [
                    {
                      label: `Correct ${correctPercent}% (${totalCorrect})`,
                      data: filteredSectionStats.map((stat) =>
                        stat.total ? ((stat.correct / stat.total) * 100).toFixed(1) : 0
                      ),
                      borderColor: "#059669",
                      backgroundColor: "rgba(5, 150, 105, 0.15)",
                      borderWidth: 3,
                      pointBackgroundColor: "#059669",
                      pointBorderColor: "#fff",
                      pointHoverRadius: 6,
                    },
                    {
                      label: `Wrong ${wrongPercent}% (${totalWrong})`,
                      data: filteredSectionStats.map((stat) =>
                        stat.total ? ((stat.wrong / stat.total) * 100).toFixed(1) : 0
                      ),
                      borderColor: "#dc2626",
                      backgroundColor: "rgba(220, 38, 38, 0.15)",
                      borderWidth: 3,
                      pointBackgroundColor: "#dc2626",
                      pointBorderColor: "#fff",
                      pointHoverRadius: 6,
                    },
                    {
                      label: `${complianceLabels.yes} / Answered ${yesPercent}% (${totalYes})`,
                      data: filteredSectionStats.map((stat) =>
                        stat.total ? ((stat.yes / stat.total) * 100).toFixed(1) : 0
                      ),
                      borderColor: "#10b981",
                      backgroundColor: "rgba(16, 185, 129, 0.05)",
                      borderWidth: 2,
                      hidden: true,
                    },
                    {
                      label: `${complianceLabels.no} / Not Answered ${noPercent}% (${totalNo})`,
                      data: filteredSectionStats.map((stat) =>
                        stat.total ? ((stat.no / stat.total) * 100).toFixed(1) : 0
                      ),
                      borderColor: "#ef4444",
                      backgroundColor: "rgba(239, 68, 68, 0.05)",
                      borderWidth: 2,
                      hidden: true,
                    },
                    {
                      label: `${complianceLabels.na} ${naPercent}% (${totalNA})`,
                      data: filteredSectionStats.map((stat) =>
                        stat.total ? ((stat.na / stat.total) * 100).toFixed(1) : 0
                      ),
                      borderColor: "#f59e0b",
                      backgroundColor: "rgba(245, 158, 11, 0.05)",
                      borderWidth: 2,
                      hidden: true,
                    },
                  ],
                };

                const radarOptions = {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "top" as const,
                      labels: {
                        color: document.documentElement.classList.contains("dark")
                          ? "#d1d5db"
                          : "#374151",
                      },
                    },
                  },
                  scales: {
                    r: {
                      beginAtZero: true,
                      max: 100,
                      ticks: {
                        color: document.documentElement.classList.contains("dark")
                          ? "#d1d5db"
                          : "#6b7280",
                      },
                      grid: {
                        color: document.documentElement.classList.contains("dark")
                          ? "rgba(107, 114, 128, 0.2)"
                          : "rgba(107, 114, 128, 0.1)",
                      },
                    },
                  },
                };

                return (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-700">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                      Section Performance Overview
                    </h3>
                    <div id="section-performance-chart" className="w-full" style={{ height: "400px" }}>
                      <Radar data={radarData} options={radarOptions} />
                    </div>
                  </div>
                );
              })()}

              {filteredSectionStats.map((sectionStat) => {
                const section = form?.sections?.find((s: any) => s.id === sectionStat.id);
                if (!section) return null;

                const questionStats = getSectionYesNoQuestionStats(sectionStat.id);
                const hasAnyYesNoInSection = questionStats.some(q => q.hasYesNo);
                const sectionTotals = {
                  yes: questionStats.reduce((sum, q) => sum + q.yes, 0),
                  no: questionStats.reduce((sum, q) => sum + q.no, 0),
                  na: questionStats.reduce((sum, q) => sum + q.na, 0),
                  correct: questionStats.reduce((sum, q) => sum + q.correct, 0),
                  wrong: questionStats.reduce((sum, q) => sum + q.wrong, 0),
                  total: questionStats.reduce((sum, q) => sum + q.total, 0),
                };

                const chartData = {
                  labels: ["Correct", "Wrong", complianceLabels.yes, complianceLabels.no, complianceLabels.na],
                  datasets: [
                    {
                      data: [sectionTotals.correct, sectionTotals.wrong, sectionTotals.yes, sectionTotals.no, sectionTotals.na],
                      backgroundColor: ["#059669", "#dc2626", "#1e40af", "#3b82f6", "#93c5fd"],
                      borderColor: ["#059669", "#dc2626", "#1e40af", "#3b82f6", "#93c5fd"],
                      borderWidth: 1,
                    },
                  ],
                };

                const chartOptions = {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "bottom" as const,
                      labels: {
                        color: document.documentElement.classList.contains("dark")
                          ? "#d1d5db"
                          : "#374151",
                      },
                    },
                  },
                };

                return (
                  <div key={sectionStat.id} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                      {section.title || "Section"} - Response Analysis
                    </h3>
                    <div className="w-full h-64" id={`section-chart-${section.id}`}>
                      {sectionChartTypes[section.id] === "bar" ? (
                        <Bar
                          data={{
                            labels: questionStats.map(
                              (stat) => stat.subParam1 || "No parameter"
                            ),
                            datasets: [
                              {
                                label: "Correct",
                                data: questionStats.map((stat) => stat.correct),
                                backgroundColor: "#059669",
                                borderColor: "#059669",
                                borderWidth: 1,
                              },
                              {
                                label: "Wrong",
                                data: questionStats.map((stat) => stat.wrong),
                                backgroundColor: "#dc2626",
                                borderColor: "#dc2626",
                                borderWidth: 1,
                              },
                              {
                                label: `${complianceLabels.yes} / Answered`,
                                data: questionStats.map((stat) => stat.yes),
                                backgroundColor: "#1e40af",
                                borderColor: "#1e40af",
                                borderWidth: 1,
                              },
                              {
                                label: `${complianceLabels.no} / Not Answered`,
                                data: questionStats.map((stat) => stat.no),
                                backgroundColor: "#3b82f6",
                                borderColor: "#3b82f6",
                                borderWidth: 1,
                              },
                              {
                                label: complianceLabels.na,
                                data: questionStats.map((stat) => stat.na),
                                backgroundColor: "#93c5fd",
                                borderColor: "#93c5fd",
                                borderWidth: 1,
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                position: "top" as const,
                                labels: {
                                  color: document.documentElement.classList.contains(
                                    "dark"
                                  )
                                    ? "#d1d5db"
                                    : "#374151",
                                },
                              },
                            },
                          }}
                        />
                      ) : (
                        <Pie data={chartData} options={chartOptions} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
              <button
                onClick={() => setShowSectionsPDFModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDownloadSectionsPDF}
                disabled={downloadingSectionsPDF}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
              >
                {downloadingSectionsPDF ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Download PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {pdfProgress && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in duration-300">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {pdfProgress.stage === 'generating' ? 'Generating PDFs' : 
                 pdfProgress.stage === 'downloading' ? 'Downloading' :
                 pdfProgress.stage === 'complete' ? 'Complete!' :
                 pdfProgress.stage === 'error' ? 'Error' : 'Processing'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {pdfProgress.message || 'Please wait while we prepare your files...'}
              </p>
              
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 rounded-full ${
                    pdfProgress.stage === 'error' ? 'bg-red-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${pdfProgress.percentage}%` }}
                />
              </div>
              <div className="flex justify-between w-full text-xs font-semibold text-gray-500 dark:text-gray-400">
                <span>{Math.round(pdfProgress.percentage)}%</span>
                <span>{pdfProgress.stage === 'complete' ? 'Success' : 'In Progress'}</span>
              </div>

              {(pdfProgress.stage === 'generating' || pdfProgress.stage === 'downloading') && (
                <button
                  onClick={() => {
                    isCancelledRef.current = true;
                    setPdfProgress(null);
                  }}
                  className="mt-6 px-6 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold rounded-xl hover:bg-red-200 dark:hover:bg-red-800/40 transition-all"
                >
                  Cancel
                </button>
              )}

              {(pdfProgress.stage === 'complete' || pdfProgress.stage === 'error') && (
                <button
                  onClick={() => setPdfProgress(null)}
                  className="mt-6 px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
