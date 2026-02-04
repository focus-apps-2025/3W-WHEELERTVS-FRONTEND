import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  TrendingUp,
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
  List,
  RefreshCw,
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
import { generateResponseExcelReport, generateResponseExcelBlob } from "../utils/responseExportUtils";
import { generateAndDownloadPDF } from "../utils/pdfExportUtils";
import JSZip from "jszip";
import FilePreview from "./FilePreview";
import ResponseEdit from "./ResponseEdit";
import DashboardSummaryCard from "./DashboardSummaryCard";
import { isImageUrl } from "../utils/answerTemplateUtils";
import ImageLink from "./ImageLink";
//import LocationHeatmap from "./analytics/LocationHeatmap";

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
  source?: string;
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
  submissionMetadata?: SubmissionMetadata;
  dealerName?: string;
}

interface GroupedResponses {
  [date: string]: (Response & { formTitle: string; dealerName?: string })[];
}

type SectionStat = {
  id: string;
  title: string;
  yes: number;
  no: number;
  na: number;
  total: number;
  weightage: number;
};

export default function AllResponses() {
  const navigate = useNavigate();
  const { showSuccess, showError, showConfirm } = useNotification();
  const { logo } = useLogo();
  const [responses, setResponses] = useState<
    (Response & { formTitle: string; dealerName?: string })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<
    (Response & { formTitle: string }) | null
  >(null);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);
  const [viewMode, setViewMode] = useState<"dashboard" | "responses">(
    "dashboard"
  );
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>([]);
  const [showFormFilter, setShowFormFilter] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const [exportingExcel, setExportingExcel] = useState(false);
  const [deletingResponseId, setDeletingResponseId] = useState<string | null>(
    null
  );
  const [editingResponse, setEditingResponse] = useState<
    (Response & { formTitle: string }) | null
  >(null);
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editingFormLoading, setEditingFormLoading] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
 // Add this line
  const [selectedPDFType, setSelectedPDFType] = useState<'no-only' | 'yes-only' | 'both' | 'na-only' | 'section' | 'default' | 'responses-view' | null>(null);

  const [editingWeightage, setEditingWeightage] = useState<string | null>(null);
  const [weightageValue, setWeightageValue] = useState<string>("");
  const [savingWeightage, setSavingWeightage] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null
  );
  const [sectionResponsesMap, setSectionResponsesMap] = useState<
    Record<string, (Response & { formTitle: string })[]>
  >({});
  const [sectionChartTypes, setSectionChartTypes] = useState<
    Record<string, "pie" | "bar">
  >({});
  const [expandResponseRateBreakdown, setExpandResponseRateBreakdown] =
    useState(false);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [showWeightageColumns, setShowWeightageColumns] = useState(false);
  const [addWeightMode, setAddWeightMode] = useState(false);
  const [showWeightageCheckbox, setShowWeightageCheckbox] = useState(true);

  
  const [editingAllWeightages, setEditingAllWeightages] = useState(false);
  const [weightageValues, setWeightageValues] = useState<Record<string, string>>({});

  const [redistributionMode, setRedistributionMode] = useState(false);
  const [tempWeightageValues, setTempWeightageValues] = useState<Record<string, string>>({});
  const [weightageBalance, setWeightageBalance] = useState(0);

  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [showResponseDropdown, setShowResponseDropdown] = useState(false);
  // const [showExcelDownloadOptions, setShowExcelDownloadOptions] = useState(false);
  // const [showExcelResponseDropdown, setShowExcelResponseDropdown] = useState(false);
  // const [openViewDropdown, setOpenViewDropdown] = useState<string | null>(null);

  const handlePDFTypeSelect = (type: 'no-only' | 'yes-only' | 'both' | 'na-only' | 'section' | 'default' | 'responses-view') => {
  setSelectedPDFType(type);
  
  handleDownloadPDF(type);
};


  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (viewMode !== "responses" || !pendingSectionId) {
      return;
    }
    const target = sectionRefs.current[pendingSectionId];
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setPendingSectionId(null);
    }
  }, [viewMode, pendingSectionId]);

  const handleViewDetails = (
    response: Response & { formTitle: string }
  ) => {
    const responseId = response._id || response.id;
    navigate(`/responses/${responseId}`);
  };

  const handleOpenModal = async (
    response: Response & { formTitle: string }
  ) => {
    setSelectedResponse(response);
    try {
      const formIdentifier = response.questionId || response.formId;
      if (!formIdentifier) {
        throw new Error("Missing form identifier for response");
      }
      const formData = await apiClient.getForm(formIdentifier);
      const form = formData.form;
      setSelectedForm(form);
    } catch (err) {
      console.error("Failed to load form for modal:", err);
      showError("Failed to load form. Please try again.");
      setSelectedResponse(null);
    }
  };

  const handleStatusUpdate = async (responseId: string, newStatus: string) => {
    setUpdatingStatus(true);
    try {
      await apiClient.updateResponse(responseId, { status: newStatus });
      setResponses((prev) =>
        prev.map((r) =>
          r._id === responseId ? { ...r, status: newStatus } : r
        )
      );
      if (selectedResponse && selectedResponse._id === responseId) {
        setSelectedResponse({ ...selectedResponse, status: newStatus });
        setShowStatusUpdate(false);
      }
      showSuccess(`Status updated to ${getStatusInfo(newStatus).label}`);
    } catch (err) {
      console.error("Failed to update status:", err);
      showError("Failed to update status. Please try again.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeleteResponse = (response: Response & { formTitle: string }) => {
    showConfirm(
      "Are you sure you want to delete this request? This action cannot be undone.",
      async () => {
        setDeletingResponseId(response.id);
        try {
          await apiClient.deleteResponse(response.id);
          setResponses((prev) => prev.filter((r) => r.id !== response.id));
          if (selectedResponse && selectedResponse.id === response.id) {
            setSelectedResponse(null);
            setSelectedForm(null);
          }
          showSuccess("Request deleted successfully.");
        } catch (err) {
          console.error("Failed to delete response:", err);
          showError("Failed to delete request. Please try again.");
        } finally {
          setDeletingResponseId(null);
        }
      },
      "Delete Request",
      "Delete",
      "Cancel"
    );
  };

  const handleEditResponse = async (
    response: Response & { formTitle: string }
  ) => {
    setEditingResponse(response);
    setEditingForm(null);
    setEditingFormLoading(true);
    try {
      const formIdentifier = response.questionId || response.formId;
      if (!formIdentifier) {
        throw new Error("Missing form identifier for response");
      }
      const formData = await apiClient.getForm(formIdentifier);
      const form = formData.form;

      // Ensure nested followUpQuestions are properly populated
      if (form?.sections) {
        form.sections.forEach((section: any) => {
          if (section.questions) {
            section.questions.forEach((question: any) => {
              // Ensure followUpQuestions is an array
              if (!Array.isArray(question.followUpQuestions)) {
                question.followUpQuestions = [];
              }
            });
          }
        });
      }

      // Ensure followUpQuestions array exists at form level
      if (!Array.isArray(form.followUpQuestions)) {
        form.followUpQuestions = [];
      }

      setEditingForm(form);
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
    if (savingEdit) {
      return;
    }
    const responseId = updated?.id;
    if (!responseId) {
      showError("Missing response identifier. Please try again.");
      return;
    }
    setSavingEdit(true);
    const updatedTimestamp = updated.timestamp || new Date().toISOString();
    const updatedScore = editingForm
      ? computeYesNoScore(updated.answers, editingForm)
      : undefined;

    // Extract dealer name from updated response
    const extractDealerNameFromUpdated = () => {
      if (!editingForm || !updated.answers) return null;

      if (editingForm.sections && editingForm.sections.length > 0) {
        const firstSection = editingForm.sections[0];
        if (firstSection.questions && firstSection.questions.length > 0) {
          for (const question of firstSection.questions) {
            const answer = updated.answers[question.id];
            if (answer && hasAnswerValue(answer)) {
              return renderAnswerDisplay(answer, question) as string;
            }
          }
        }
      }
      return null;
    };

    const updatedDealerName = extractDealerNameFromUpdated();

    try {
      await apiClient.updateResponse(responseId, {
        answers: updated.answers,
        status: updated.status,
        notes: updated.notes,
      });

      setResponses((prev) =>
        prev.map((r) =>
          r.id === responseId
            ? {
              ...r,
              answers: updated.answers,
              updatedAt: updatedTimestamp,
              yesNoScore: updatedScore !== undefined ? updatedScore : r.yesNoScore,
              dealerName: updatedDealerName || r.dealerName, // Update dealer name
            }
            : r
        )
      );

      if (selectedResponse && selectedResponse.id === responseId) {
        const nextSelected = {
          ...selectedResponse,
          answers: updated.answers,
          updatedAt: updatedTimestamp,
          dealerName: updatedDealerName || selectedResponse.dealerName,
        };
        if (updatedScore !== undefined) {
          nextSelected.yesNoScore = updatedScore;
        }
        setSelectedResponse(nextSelected);
      }

      setEditingResponse(null);
      setEditingForm(null);
      showSuccess("Request updated successfully.");
    } catch (err) {
      console.error("Failed to update response:", err);
      showError("Failed to update request. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleExportExcel = (type?: 'yes-only' | 'no-only' | 'na-only' | 'both' | 'default' | React.MouseEvent) => {
    if (exportingExcel) {
      return;
    }

    // If type is not a string (e.g. event object) or undefined, use default type
    if (!type || typeof type !== 'string') {
      type = 'both';
    }

    if (!selectedResponse || !selectedForm) {
      showError("Missing required data for export.");
      return;
    }

    setExportingExcel(true);
    try {
      // Generate filename
      const fileName = `${selectedForm.title}_${formatTimestamp(selectedResponse.createdAt)}_${type}.xlsx`;
      
      generateResponseExcelReport(
        selectedResponse,
        selectedForm,
        fileName,
        type
      );
      showSuccess("Excel exported successfully.");
      // setShowExcelDownloadOptions(false);
      // setShowExcelResponseDropdown(false);
    } catch (error) {
      console.error("Failed to export Excel:", error);
      showError("Failed to export Excel. Please try again.");
    } finally {
      setExportingExcel(false);
    }
  };

  const handleBulkDownloadZip = async () => {
    if (exportingZip) return;

    const formsToDownload = selectedFormIds.length === 0 
      ? uniqueForms 
      : uniqueForms.filter(f => selectedFormIds.includes(f.id));

    if (formsToDownload.length === 0) {
      showError("No forms selected for download.");
      return;
    }

    setExportingZip(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder(`Bulk_Responses_${new Date().toISOString().split('T')[0]}`);
      
      showSuccess(`Preparing ${formsToDownload.length} files...`);

      for (const formItem of formsToDownload) {
        try {
          const formData = await apiClient.getForm(formItem.id);
          const fullForm = formData.form;
          const formResponses = responses.filter(r => (r.questionId || r.formId) === formItem.id);
          
          if (formResponses.length > 0) {
            const excelBlob = generateResponseExcelBlob(formResponses, fullForm, 'both');
            const safeFileName = `${formItem.title.replace(/[/\\?%*:|"<>]/g, '-')}_${formItem.id.slice(-6)}.xlsx`;
            folder?.file(safeFileName, excelBlob);
          }
        } catch (err) {
          console.error(`Failed to process form ${formItem.title}:`, err);
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `Bulk_Responses_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showSuccess("ZIP file downloaded successfully.");
    } catch (error) {
      console.error("Failed to generate ZIP:", error);
      showError("Failed to generate ZIP. Please try again.");
    } finally {
      setExportingZip(false);
    }
  };

 const handleDownloadPDF = async (type?: 'no-only' | 'yes-only' | 'both' | 'na-only' | 'section' | 'default' | 'responses-view') => {
  if (generatingPDF || !selectedResponse || !selectedForm) {
    return;
  }

  setGeneratingPDF(true);
  
  // If type is not provided, show the modal
  if (!type) {
    setShowDownloadOptions(true);
    setGeneratingPDF(false);
    return;
  }

  try {
    // For 'section' type, we need section data
    let sectionQuestionStats: Record<string, any[]> = {};
    let sectionMainParameters: Record<string, any[]> = {};

    if (selectedForm.sections && (type === 'both' || type === 'default' || type === 'section')) {
      selectedForm.sections.forEach((section: any) => {
        // Get the actual question stats for the current response
        sectionQuestionStats[section.id] = getSectionYesNoQuestionStats(section.id);

        const sectionQuestions = getSectionQuestionsWithFollowUps(section.id);
        const mainParamsData: any[] = [];

        // Process each main question in the section
        sectionQuestions.forEach((mainQuestion: any) => {
          // Find follow-ups with actual data for this main question
          const followUpsWithData = mainQuestion.followUpQuestions?.filter((fq: any) => {
            const answer = selectedResponse.answers?.[fq.id];
            return answer && typeof answer === 'object' && (
              answer.remarks ||
              answer.actionInitiated ||
              answer.reasonForNotOK ||
              answer.responsiblePerson ||
              answer.review ||
              answer.files
            );
          });

          // If we have follow-ups with data, create parameter entries
          if (followUpsWithData && followUpsWithData.length > 0) {
            followUpsWithData.forEach((followUp: any) => {
              const answer = selectedResponse.answers?.[followUp.id] || {};

              mainParamsData.push({
                subParam1: mainQuestion.subParam1 || "No parameter set",
                remarks: answer.remarks || '',
                actionInitiated: answer.actionInitiated || '',
                reasonForNotOK: answer.reasonForNotOK || '',
                responsiblePerson: answer.responsiblePerson || '',
                review: answer.review || '',
                files: answer.files || []
              });
            });
          } else {
            // Add entry even if no follow-up data, but mark as empty
            mainParamsData.push({
              subParam1: mainQuestion.subParam1 || "No parameter set",
              remarks: '',
              actionInitiated: '',
              reasonForNotOK: '',
              responsiblePerson: '',
              review: '',
              files: []
            });
          }
        });

        sectionMainParameters[section.id] = mainParamsData;
      });
    }

    // Add chart element IDs for capturing
    const chartElementIds = [
      'section-performance-chart',
      ...availableSections.map(section => `section-chart-${section.id}`)
    ];

    // Use the current filtered section stats from the dashboard
    const currentSectionStats = filteredSectionStats;

    // Prepare section summary rows for PDF
    const pdfSectionSummaryRows = currentSectionStats.map((stat) => {
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
      const yesWeighted = (yesPercent * weightage) / 100;
      const noWeighted = (noPercent * weightage) / 100;
      const naWeighted = (naPercent * weightage) / 100;

      return {
        id: stat.id,
        title: stat.title,
        weightage,
        yesPercent,
        yesWeighted,
        noPercent,
        noWeighted,
        naPercent,
        naWeighted,
      };
    });

    // Add the type parameter to the PDF options
    await generateAndDownloadPDF({
      filename: `${selectedForm.title}_Report_${formatTimestamp(selectedResponse.createdAt, 'file')}_${type}.pdf`,
      formTitle: selectedForm.title,
      submittedDate: formatTimestamp(selectedResponse.createdAt),
      sectionStats: currentSectionStats,
      sectionSummaryRows: pdfSectionSummaryRows,
      form: selectedForm,
      response: selectedResponse,
      sectionQuestionStats: sectionQuestionStats,
      sectionMainParameters: sectionMainParameters,
      availableSections: availableSections,
      chartElementIds: chartElementIds,
      type: type // Add the type parameter
    });

    showSuccess(`PDF with ${getPDFTypeLabel(type)} downloaded successfully.`);
    setSelectedPDFType(null);
    setShowDownloadOptions(false);
    
  } catch (error) {
    console.error("Failed to generate PDF:", error);
    showError("Failed to generate PDF. Please try again.");
    setSelectedPDFType(null);
    setShowDownloadOptions(false);
  } finally {
    setGeneratingPDF(false);
  }
};

// Helper function to get PDF type label
// Helper function to get PDF type label
const getPDFTypeLabel = (type: 'no-only' | 'yes-only' | 'both' | 'na-only' | 'section' | 'default' | 'responses-view') => {
  switch (type) {
    case 'no-only':
      return 'NO Response Analysis';
    case 'yes-only':
      return 'YES Response Analysis';
    case 'na-only':
      return 'N/A Response Analysis';
    case 'both':
      return 'BOTH YES, NO & N/A Response Analysis';
    case 'section':
      return 'Section Analysis';
    case 'responses-view':
      return 'Form Responses Detail';
    case 'default':
      return 'Full Analysis';
    default:
      return 'Full Analysis';
  }
};

const handleDropdownClick = (type: 'yes-only' | 'no-only' | 'na-only' | 'both' | 'section' | 'responses-view', e: React.MouseEvent) => {
  e.stopPropagation();
  setShowDownloadOptions(false);
  setShowResponseDropdown(false);
  
  // Handle all PDF types
  handleDownloadPDF(type);
};

useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.closest('.download-container') && !target.closest('.responses-dropdown')) {
      setShowDownloadOptions(false);
      setShowResponseDropdown(false);
    }
    // if (!target.closest('.download-excel-container') && !target.closest('.excel-responses-dropdown')) {
    //   setShowExcelDownloadOptions(false);
    //   setShowExcelResponseDropdown(false);
    // }
  };

  document.addEventListener('click', handleClickOutside);
  return () => {
    document.removeEventListener('click', handleClickOutside);
  };
}, []);

  
  // Weightage Edit Functions
const handleEditWeightage = (sectionId: string, currentWeightage: number) => {
  setEditingWeightage(sectionId);
  setWeightageValue(currentWeightage.toString());
};

const handleSaveWeightage = async (sectionId: string) => {
  if (savingWeightage || !selectedForm || !weightageValue.trim()) {
    return;
  }

  const numericValue = parseFloat(weightageValue);
  if (isNaN(numericValue) || numericValue < 0 || numericValue > 100) {
    showError("Please enter a valid weightage between 0 and 100");
    return;
  }

  // Calculate current total weightage of all sections
  const currentTotal = sectionSummaryRows.reduce((sum, r) => sum + r.weightage, 0);
  
  // Calculate what the new total would be
  const sectionOldWeightage = sectionSummaryRows.find(r => r.id === sectionId)?.weightage || 0;
  const newTotal = currentTotal - sectionOldWeightage + numericValue;
  
  // Validate total in addWeightMode
  if (addWeightMode && newTotal > 100) {
    showError(`Cannot save: Total weightage would be ${newTotal.toFixed(1)}%, must not exceed 100%`);
    return;
  }

  setSavingWeightage(true);
  try {
    // Get the form ID
    const formId = selectedForm._id || selectedForm.id;
    if (!formId) {
      throw new Error("Form ID not found");
    }

    // Create updated sections with new weightage
    const updatedSections = selectedForm.sections?.map((section: any) =>
      section.id === sectionId
        ? { ...section, weightage: numericValue }
        : section
    ) || [];

    // Prepare the form data to update
    const formDataToUpdate = {
      ...selectedForm,
      sections: updatedSections,
    };

    // Remove MongoDB-specific fields if they exist
    delete formDataToUpdate._id;
    delete formDataToUpdate.__v;
    delete formDataToUpdate.createdAt;
    delete formDataToUpdate.updatedAt;

    console.log("Updating form with ID:", formId);
    console.log("Updated sections:", updatedSections);

    // Call the updateForm API
    const response = await apiClient.updateForm(formId, formDataToUpdate);
    
    // Update local state with the response
    if (response.form) {
      setSelectedForm(response.form);
    } else {
      // Fallback to local update if response doesn't have form
      setSelectedForm({
        ...selectedForm,
        sections: updatedSections,
      });
    }

    // Also update the editing form if it's the same form
    if (editingForm && (editingForm._id === formId || editingForm.id === formId)) {
      setEditingForm({
        ...editingForm,
        sections: updatedSections,
      });
    }

    showSuccess(`Weightage updated to ${numericValue}%`);
    
    // Check if we should exit addWeightMode (when total reaches 100%)
    if (addWeightMode) {
      const updatedTotal = sectionSummaryRows.reduce((sum, r) => 
        sum + (r.id === sectionId ? numericValue : r.weightage), 0
      );
      
      if (Math.abs(updatedTotal - 100) < 0.1) { // Allow small floating point differences
        setAddWeightMode(false);
        showSuccess("Weightage distribution complete! Total: 100%");
      }
    }
    
    setEditingWeightage(null);
    setWeightageValue("");
    
  } catch (error) {
    console.error("Failed to update weightage:", error);
    showError(
      error instanceof Error 
        ? error.message 
        : "Failed to update weightage. Please try again."
    );
  } finally {
    setSavingWeightage(false);
  }
};



const handleCancelWeightageEdit = () => {
  setEditingWeightage(null);
  setWeightageValue("");
};

  const fetchData = async () => {
    try {
      setLoading(true);
      const [responsesData, formsData] = await Promise.all([
        apiClient.getResponses(),
        apiClient.getForms(),
      ]);

      const formsMap = formsData.forms.reduce(
        (map: Record<string, Form>, form: any) => {
          if (form?._id) map[form._id] = form as Form;
          if (form?.id) map[form.id] = form as Form;
          return map;
        },
        {}
      );

      // Pre-calculate dealer question IDs for each form
      const dealerQuestionMap = new Map<string, string>();
      
      Object.values(formsMap).forEach((form: Form) => {
        const formId = form._id || form.id;
        if (!formId) return;

        if (form.sections && form.sections.length > 0) {
          const firstSection = form.sections[0];
          if (firstSection.questions && firstSection.questions.length > 0) {
            for (const question of firstSection.questions) {
              const questionText = (question.text || question.label || '').toLowerCase();
              const isDealerField = questionText.includes('dealer') ||
                questionText.includes('distributor') ||
                questionText.includes('agent') ||
                questionText.includes('store') ||
                questionText.includes('business');

              if (isDealerField) {
                dealerQuestionMap.set(formId, question.id);
                break; // Found the dealer question for this form
              }
            }
          }
        }
      });

      // Helper function to extract dealer name from answers using form structure
      const extractDealerName = (response: Response, form: Form | undefined): string | null => {
        if (!form || !response.answers) return null;
        
        const formId = form._id || form.id;
        if (!formId) return null;

        // Try to get from pre-calculated map first
        const dealerQuestionId = dealerQuestionMap.get(formId);
        if (dealerQuestionId) {
          const answer = response.answers[dealerQuestionId];
          if (answer && hasAnswerValue(answer)) {
            const q = form.sections.flatMap(s => s.questions || []).find(q => q.id === dealerQuestionId);
            return renderAnswerDisplay(answer, q) as string;
          }
        }

        // Fallback: if no specific dealer field found or no answer, check first section's first answer
        // This mimics the original behavior's fallback
        if (form.sections && form.sections.length > 0) {
           const firstSection = form.sections[0];
           if (firstSection.questions && firstSection.questions.length > 0) {
             for (const question of firstSection.questions) {
               const answer = response.answers[question.id];
               if (answer && hasAnswerValue(answer)) {
                 return renderAnswerDisplay(answer, question) as string;
               }
             }
           }
        }

        return null;
      };

      const responsesWithTitles = responsesData.responses.map(
        (response: Response) => {
          const form = formsMap[response.questionId];
          const dealerName = extractDealerName(response, form);

          return {
            ...response,
            formTitle: form?.title || "Unknown Form",
            yesNoScore: form
              ? computeYesNoScore(response.answers, form)
              : undefined,
            dealerName: dealerName || "Unknown", // Add dealer name here
          };
        }
      );

      setResponses(responsesWithTitles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load responses");
    } finally {
      setLoading(false);
    }
  };

  const groupResponsesByDate = (
    responses: (Response & { formTitle: string })[]
  ): GroupedResponses => {
    return responses.reduce((groups, response) => {
      const date = new Date(response.createdAt).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(response);
      return groups;
    }, {} as GroupedResponses);
  };

  // Get unique forms from responses
  const uniqueForms = useMemo(() => {
    const formMap = new Map<string, { id: string; title: string }>();
    responses.forEach(response => {
      const key = response.questionId || response.formId || '';
      if (key && !formMap.has(key)) {
        formMap.set(key, {
          id: key,
          title: response.formTitle
        });
      }
    });
    return Array.from(formMap.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [responses]);

  // Initialize selectedFormIds with all forms on first load only - REMOVED to allow auto-update
  // Defaulting to empty array [] means "All Forms" and will automatically include new forms


  // Filter responses based on search and selected forms
  const filteredResponses = useMemo(() => {
    return responses.filter(response => {
      const matchesSearch = response.formTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (typeof response.dealerName === 'string' ? response.dealerName.toLowerCase().includes(searchQuery.toLowerCase()) : false);
      const matchesForm = selectedFormIds.length === 0 || 
                         selectedFormIds.includes(response.questionId || response.formId || '');
      return matchesSearch && matchesForm;
    });
  }, [responses, searchQuery, selectedFormIds]);

  const groupedResponses = groupResponsesByDate(filteredResponses);

  const groupResponsesBySection = useMemo(() => {
    if (!selectedForm?.sections) return {};

    const map: Record<string, (Response & { formTitle: string })[]> = {};
    const questionToSectionMap = new Map<string, string>();

    // Pre-calculate question -> section mapping
    selectedForm.sections.forEach((section: any) => {
      map[section.id] = [];
      section.questions?.forEach((q: any) => {
        if (q.id) {
          questionToSectionMap.set(q.id, section.id);
        }
      });
    });

    responses.forEach((response) => {
      const answerKeys = Object.keys(response.answers || {});
      // Track which sections we've already added this response to
      const addedToSections = new Set<string>();

      answerKeys.forEach((key) => {
        const sectionId = questionToSectionMap.get(key);
        if (sectionId && !addedToSections.has(sectionId)) {
          map[sectionId].push(response);
          addedToSections.add(sectionId);
        }
      });
    });

    return map;
  }, [responses, selectedForm]);

  const availableSections = selectedForm?.sections || [];

  useEffect(() => {
    if (availableSections.length > 0 && !selectedSectionId) {
      setSelectedSectionId(availableSections[0].id);
    }
  }, [availableSections, selectedSectionId]);

  const sectionStats = useMemo(() => {
    if (!selectedForm || !selectedResponse) {
      return [] as SectionStat[];
    }
    return getSectionYesNoStats(selectedForm, selectedResponse.answers);
  }, [selectedForm, selectedResponse]);

  const filteredSectionStats = useMemo(
    () =>
      sectionStats.filter(
        (stat) =>
          stat.yes > 0 || stat.no > 0 || stat.na > 0 || stat.weightage > 0
      ),
    [sectionStats]
  );

  const sectionChartData = useMemo(() => {
    const calculatePercentage = (value: number, total: number) =>
      total ? parseFloat(((value / total) * 100).toFixed(1)) : 0;

    return {
      labels: filteredSectionStats.map((stat) =>
        formatSectionLabel(stat.title)
      ),
      datasets: [
        {
          label: "Yes",
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
          label: "No",
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
        {
          label: "N/A",
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
        },
      ],
    };
  }, [filteredSectionStats]);

  const sectionChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#374151",
            generateLabels: (chart: any) => {
              const labels =
                ChartJS.defaults.plugins.legend.labels.generateLabels(chart);
              labels.forEach((label: any) => {
                label.color = document.documentElement.classList.contains(
                  "dark"
                )
                  ? "#d1d5db"
                  : "#374151";
              });
              return labels;
            },
          },
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

  const formatPercentageValue = (value: number) =>
    `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;

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
          weightage,
          yesPercent,
          yesWeighted,
          noPercent,
          noWeighted,
          naPercent,
          naWeighted,
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
        weightage: acc.weightage + row.weightage,
        yesWeighted: acc.yesWeighted + row.yesWeighted,
        noWeighted: acc.noWeighted + row.noWeighted,
        naWeighted: acc.naWeighted + row.naWeighted,
      }),
      { total: 0, yes: 0, no: 0, na: 0, weightage: 0, yesWeighted: 0, noWeighted: 0, naWeighted: 0 }
    );
  }, [sectionSummaryRows]);

  const weightedPercentageChartData = useMemo(() => {
    return {
      labels: sectionSummaryRows.map((row) => formatSectionLabel(row.title)),
      datasets: [
        {
          label: "Yes % × Weightage",
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
          label: "No % × Weightage",
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
        {
          label: "N/A % × Weightage",
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
        },
      ],
    };
  }, [sectionSummaryRows]);

  useEffect(() => {
  if (sectionSummaryRows.length > 0) {
    // Check if ALL sections have weightage = 0
    const allZero = sectionSummaryRows.every(row => row.weightage === 0);
    
    // Check if ANY section has weightage > 0
    const hasWeightage = sectionSummaryRows.some(row => row.weightage > 0);
    
    // Auto-detect whether to show weightage columns
    if (hasWeightage) {
      setShowWeightageColumns(true);
      setShowWeightageCheckbox(false); // Hide checkbox when weightage exists
      setAddWeightMode(false); // Exit add weight mode
    } else {
      setShowWeightageColumns(false);
      setShowWeightageCheckbox(true); // Show checkbox when no weightage
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
          position: "bottom",
          labels: {
            color: "#374151",
            generateLabels: (chart: any) => {
              const labels =
                ChartJS.defaults.plugins.legend.labels.generateLabels(chart);
              labels.forEach((label: any) => {
                label.color = document.documentElement.classList.contains(
                  "dark"
                )
                  ? "#d1d5db"
                  : "#374151";
              });
              return labels;
            },
          },
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

  const getSectionQuestionsWithFollowUps = (sectionId: string) => {
    if (!selectedForm || !selectedResponse) return [];

    const section = selectedForm.sections?.find((s: any) => s.id === sectionId);
    if (!section) return [];

    const mainQuestionsWithFollowUps: any[] = [];
    const questionIds = collectYesNoQuestionIds({
      ...selectedForm,
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
      if (questionIds.includes(question.id)) {
        const answers = selectedResponse.answers?.[question.id];
        const yesNoValues = extractYesNoValues(answers);

        const followUpQuestionsForThis = [
          ...(selectedForm.followUpQuestions?.filter(
            (fq: any) => fq.parentId === question.id
          ) || []),
          ...(question.followUpQuestions || []),
          ...(followUpMap.get(question.id) || []),
        ];

        if (yesNoValues.length > 0 || followUpQuestionsForThis.length > 0) {
          const mainQuestion = {
            id: question.id,
            title: question.title || question.label,
            subParam1: question.subParam1,
            yesNoValues,
            followUpQuestions: followUpQuestionsForThis.map((fq: any) => ({
              id: fq.id || fq._id,
              title: fq.title || fq.label || fq.text,
              subParam1: fq.subParam1,
              answer: selectedResponse.answers?.[fq.id || fq._id],
            })),
          };

          mainQuestionsWithFollowUps.push(mainQuestion);
        }
      }
    });

    return mainQuestionsWithFollowUps;
  };

  function collectYesNoQuestionIds(form: Form): string[] {
    const ids = new Set<string>();

    const processQuestion = (question: any) => {
      if (!question) {
        return;
      }
      if (question.type === "yesNoNA" && question.id) {
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

  function computeYesNoScore(
    answers: Record<string, any>,
    form: Form
  ): { yes: number; total: number } | undefined {
    const questionIds = collectYesNoQuestionIds(form);
    if (!questionIds.length) {
      return undefined;
    }

    let yesCount = 0;

    questionIds.forEach((questionId) => {
      const normalizedValues = extractYesNoValues(answers?.[questionId]);
      if (normalizedValues.includes("yes")) {
        yesCount += 1;
      }
    });

    return {
      yes: yesCount,
      total: questionIds.length,
    };
  }

  function getSectionYesNoStats(
    form: Form,
    answers: Record<string, any>
  ): SectionStat[] {
    const stats =
      form.sections?.map((section: any) => {
        const counts = { yes: 0, no: 0, na: 0, total: 0 };
        const weightageNumber = Number(section.weightage);
        const weightage = Number.isFinite(weightageNumber)
          ? weightageNumber
          : 0;

        const processQuestion = (question: any) => {
          if (!question) {
            return;
          }
          if (question.type !== "yesNoNA" || !question.id) {
            question.followUpQuestions?.forEach(processQuestion);
            return;
          }

          const normalizedValues = extractYesNoValues(answers?.[question.id]);
          const hasRecognizedValue = normalizedValues.some((value) =>
            ["yes", "no", "n/a", "na", "not applicable"].includes(value)
          );
          if (!hasRecognizedValue) {
            question.followUpQuestions?.forEach(processQuestion);
            return;
          }

          counts.total += 1;
          if (normalizedValues.includes("yes")) {
            counts.yes += 1;
          }
          if (normalizedValues.includes("no")) {
            counts.no += 1;
          }
          if (
            normalizedValues.includes("n/a") ||
            normalizedValues.includes("na") ||
            normalizedValues.includes("not applicable")
          ) {
            counts.na += 1;
          }

          question.followUpQuestions?.forEach(processQuestion);
        };

        section.questions?.forEach(processQuestion);

        if (!counts.total) {
          return null;
        }

        return {
          id: section.id,
          title: section.title || "Untitled Section",
          yes: counts.yes,
          no: counts.no,
          na: counts.na,
          total: counts.total,
          weightage,
        };
      }) ?? [];

    return stats.filter((stat): stat is SectionStat => Boolean(stat));
  }

  const hasAnswerValue = (value: any) => {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === "string") {
      return value.trim() !== "";
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === "object") {
      return Object.keys(value).length > 0;
    }
    return true;
  };

  const renderAnswerDisplay = (value: any, question?: any): React.ReactNode => {
    const renderHighlightedAnswer = (val: any) => {
      const isArray = Array.isArray(val);
      const strValue = isArray ? val.join(", ") : String(val || "");
      const normalized = strValue.trim().toLowerCase();
      
      let bgColor = "";
      let textColor = "";
      let borderColor = "";
      let Icon = null;
      
      let isYes = normalized === "yes";
      let isNo = normalized === "no";
      let isNA = normalized === "n/a" || normalized === "na" || normalized === "not applicable";

      // For yesNoNA type, we should use the option position if available
      if (question && question.type === "yesNoNA" && question.options && question.options.length >= 2) {
        isYes = normalized === String(question.options[0]).toLowerCase().trim();
        isNo = normalized === String(question.options[1]).toLowerCase().trim();
        if (question.options.length >= 3) {
          isNA = normalized === String(question.options[2]).toLowerCase().trim();
        }
      }
      
      // Quiz logic
      const isQuiz = question && (question.correctAnswer || (question.correctAnswers && question.correctAnswers.length > 0));
      let isCorrect = false;
      
      if (isQuiz) {
        if (question.correctAnswers && question.correctAnswers.length > 0) {
          if (isArray) {
            isCorrect = val.length === question.correctAnswers.length && 
                        val.every((a: any) => question.correctAnswers!.some((ca: any) => String(ca).toLowerCase() === String(a).toLowerCase()));
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

      if (!isQuiz && !isYes && !isNo && !isNA) {
        if (isImageUrl(strValue)) {
          return <ImageLink text={strValue} />;
        }
        return strValue;
      }

      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${bgColor} ${textColor} ${borderColor}`}>
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {isImageUrl(strValue) ? <ImageLink text={strValue} /> : strValue}
        </span>
      );
    };

    const ensureAbsoluteFileSource = (input: string) => {
      if (!input) {
        return "";
      }
      if (input.startsWith("data:")) {
        return input;
      }
      if (input.startsWith("http://") || input.startsWith("https://")) {
        return input;
      }
      if (input.startsWith("//")) {
        if (typeof window !== "undefined" && window.location) {
          return `${window.location.protocol}${input}`;
        }
        return `https:${input}`;
      }
      const normalized = input.startsWith("/") ? input : `/${input}`;
      if (typeof window !== "undefined" && window.location) {
        return `${window.location.origin}${normalized}`;
      }
      return normalized;
    };

    const extractFileName = (input: string | undefined) => {
      if (!input) {
        return undefined;
      }
      try {
        const sanitized = input.split("?")[0];
        const parts = sanitized.split("/");
        const name = parts[parts.length - 1] || undefined;
        return name ? decodeURIComponent(name) : undefined;
      } catch {
        return undefined;
      }
    };

    const resolveFileData = (input: any) => {
      if (!input) {
        return null;
      }
      const candidate =
        Array.isArray(input) && input.length === 1 ? input[0] : input;
      if (typeof candidate === "string") {
        if (candidate.startsWith("data:")) {
          return {
            data: candidate,
            fileName: question?.fileName || question?.name,
          };
        }
        if (
          candidate.startsWith("http") ||
          candidate.startsWith("//") ||
          candidate.startsWith("/") ||
          candidate.startsWith("uploads/")
        ) {
          const absolute = ensureAbsoluteFileSource(candidate);
          return {
            url: absolute,
            fileName:
              question?.fileName ||
              question?.name ||
              extractFileName(candidate),
          };
        }
        return null;
      }
      if (typeof candidate === "object") {
        const dataValue =
          candidate.data ||
          candidate.value ||
          candidate.file ||
          candidate.base64 ||
          candidate.url ||
          candidate.path;
        const nameValue =
          candidate.fileName ||
          candidate.filename ||
          candidate.name ||
          question?.fileName ||
          question?.name;
        if (typeof dataValue === "string" && dataValue.startsWith("data:")) {
          return { data: dataValue, fileName: nameValue };
        }
        if (typeof dataValue === "string") {
          const absolute = ensureAbsoluteFileSource(dataValue);
          return {
            url: absolute,
            fileName: nameValue || extractFileName(dataValue),
          };
        }
        if (typeof candidate.url === "string") {
          const absolute = ensureAbsoluteFileSource(candidate.url);
          return {
            url: absolute,
            fileName: nameValue || extractFileName(candidate.url),
          };
        }
      }
      return null;
    };

    if (question?.type === "file" || question?.type === "radio-image") {
      const fileData = resolveFileData(value);
      if (fileData?.data) {
        return (
          <FilePreview data={fileData.data} fileName={fileData.fileName} />
        );
      }
      if (fileData?.url) {
        return <FilePreview url={fileData.url} fileName={fileData.fileName} />;
      }
    }

    if (value === null || value === undefined) {
      return <span className="text-primary-400">No response</span>;
    }

    if (typeof value === "string") {
      if (value.startsWith("data:")) {
        return (
          <FilePreview
            data={value}
            fileName={question?.fileName || question?.name}
          />
        );
      }
      if (question?.type === "file" || question?.type === "radio-image") {
        if (
          value.startsWith("http") ||
          value.startsWith("//") ||
          value.startsWith("/") ||
          value.startsWith("uploads/")
        ) {
          const absolute = ensureAbsoluteFileSource(value);
          return (
            <FilePreview
              url={absolute}
              fileName={
                question?.fileName || question?.name || extractFileName(value)
              }
            />
          );
        }
      }
      if (value.startsWith("http://") || value.startsWith("https://")) {
        if (isImageUrl(value)) {
          return <ImageLink text={value} />;
        }
        return (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800"
          >
            {value}
          </a>
        );
      }
      const trimmed = value.trim();
      return trimmed ? (
        renderHighlightedAnswer(trimmed)
      ) : (
        <span className="text-primary-400">No response</span>
      );
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-primary-400">No response</span>;
      }
      if (question?.type === "file" || question?.type === "radio-image") {
        const previews = value
          .map((entry: any, index: number) => {
            const fileData = resolveFileData(entry);
            if (!fileData) {
              return null;
            }
            return (
              <FilePreview
                key={`${question?.id ?? "file-array"}-${index}`}
                data={fileData.data}
                url={fileData.url}
                fileName={fileData.fileName}
              />
            );
          })
          .filter(Boolean);
        if (previews.length) {
          return <div className="space-y-3">{previews}</div>;
        }
      }
      return (
        <div className="flex flex-wrap gap-2">
          {value.map((item: any, index: number) => {
            return <div key={index}>{renderHighlightedAnswer(item)}</div>;
          })}
        </div>
      );
    }

    if (typeof value === "object") {
      const fileData = resolveFileData(value);
      if (fileData?.data) {
        return (
          <FilePreview data={fileData.data} fileName={fileData.fileName} />
        );
      }
      if (fileData?.url) {
        return <FilePreview url={fileData.url} fileName={fileData.fileName} />;
      }
      if (!Object.keys(value).length) {
        return <span className="text-primary-400">No response</span>;
      }
      return (
        <pre className="whitespace-pre-wrap text-primary-600 text-sm">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }

    return renderHighlightedAnswer(value);
  };

  const renderSectionTabs = (): React.ReactNode => {
    if (!availableSections.length || !selectedForm) return null;

    return (
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-primary-200 shadow-sm mb-6">
        <div className="flex items-center gap-2 overflow-x-auto p-4">
          {availableSections.map((section: any) => {
            const sectionResponseCount =
              groupResponsesBySection[section.id]?.length || 0;
            const isSelected = selectedSectionId === section.id;

            return (
              <button
                key={section.id}
                onClick={() => setSelectedSectionId(section.id)}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-2 ${isSelected
                  ? "bg-blue-500 text-white shadow-lg"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
              >
                <span className="truncate">
                  {formatSectionLabel(
                    section.name || section.label || `Section ${section.id}`
                  )}
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${isSelected
                    ? "bg-blue-600 text-white"
                    : "bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200"
                    }`}
                >
                  {sectionResponseCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const getSectionYesNoQuestionStats = (sectionId: string) => {
    if (!selectedForm || !selectedResponse) return [];

    const section = selectedForm.sections?.find((s: any) => s.id === sectionId);
    if (!section) return [];

    const questionStats: Array<{
      id: string;
      title: string;
      subParam1?: string;
      yes: number;
      no: number;
      na: number;
      total: number;
    }> = [];

    const processQuestion = (question: any) => {
      if (!question) return;

      if (question.type === "yesNoNA" && question.id) {
        const normalizedValues = extractYesNoValues(
          selectedResponse.answers?.[question.id]
        );
        const counts = { yes: 0, no: 0, na: 0, total: 0 };

        if (normalizedValues.length > 0) {
          counts.total = 1; // Each question counts as 1 response
          if (normalizedValues.includes("yes")) counts.yes = 1;
          if (normalizedValues.includes("no")) counts.no = 1;
          if (
            normalizedValues.includes("n/a") ||
            normalizedValues.includes("na") ||
            normalizedValues.includes("not applicable")
          )
            counts.na = 1;
        }

        questionStats.push({
          id: question.id,
          title:
            question.title ||
            question.label ||
            question.text ||
            `Question ${question.id}`,
          subParam1: question.subParam1,
          ...counts,
        });
      }

      // Process follow-up questions if they are yesNoNA type
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
        total: number;
      }
    > = new Map();

    questionStats.forEach((stat) => {
      const key = stat.subParam1 || "No parameter";
      if (groupedStats.has(key)) {
        const existing = groupedStats.get(key)!;
        existing.yes += stat.yes;
        existing.no += stat.no;
        existing.na += stat.na;
        existing.total += stat.total;
      } else {
        groupedStats.set(key, { ...stat });
      }
    });

    return Array.from(groupedStats.values());
  };

  const renderSectionYesNoTable = (sectionId: string): React.ReactNode => {
    const questionStats = getSectionYesNoQuestionStats(sectionId);
    const section = selectedForm?.sections?.find(
      (s: any) => s.id === sectionId
    );

    if (questionStats.length === 0) {
      return null;
    }

    // Calculate totals for the section
    const sectionTotals = questionStats.reduce(
      (totals, stat) => ({
        yes: totals.yes + stat.yes,
        no: totals.no + stat.no,
        na: totals.na + stat.na,
        total: totals.total + stat.total,
      }),
      { yes: 0, no: 0, na: 0, total: 0 }
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
    };

    // Chart data for the section
    const chartData = {
      labels: ["Yes", "No", "N/A"],
      datasets: [
        {
          data: [sectionTotals.yes, sectionTotals.no, sectionTotals.na],
          backgroundColor: ["#1d4ed8", "#3b82f6", "#93c5fd"],
          borderColor: ["#1e40af", "#2563eb", "#60a5fa"],
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
          },
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const total =
                sectionTotals.yes + sectionTotals.no + sectionTotals.na;
              const value =
                typeof context.parsed === "number"
                  ? context.parsed
                  : context.parsed?.r || 0;
              const percentage =
                total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${context.label}: ${value} (${percentage}%)`;
            },
          },
        },
        datalabels: {
          color: document.documentElement.classList.contains("dark")
            ? "#f3f4f6"
            : "#0f172a",
          font: {
            weight: "600",
          },
          formatter: (value: number, context: any) => {
            const dataset = context.chart?.data?.datasets?.[0];
            const data = Array.isArray(dataset?.data) ? dataset.data : [];
            const total = data.reduce(
              (sum: number, current: any) =>
                typeof current === "number" ? sum + current : sum,
              0
            );
            const numericValue =
              typeof value === "number" ? value : Number(value) || 0;
            const percentage =
              total > 0 ? ((numericValue / total) * 100).toFixed(1) : 0;
            return `${percentage}% (${numericValue})`;
          },
        },
      },
    };

    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-8 rounded-3xl shadow-xl border border-blue-200 dark:border-blue-800 mt-8">
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-blue-900 dark:text-blue-100 flex items-center gap-3">
            <div className="w-1 h-8 bg-blue-600 rounded-full"></div>
            {section?.name || section?.label || `Section`} - Yes/No/N/A Analysis
          </h3>
          <p className="text-blue-700 dark:text-blue-300 mt-2">
            Question-wise breakdown of yes/no/n/a responses with overall section
            summary
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Chart */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-blue-200 dark:border-blue-700">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 flex items-center">
                <PieChart className="w-5 h-5 mr-2" />
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
                className="px-3 py-1.5 text-sm bg-blue-50 dark:bg-gray-700 border border-blue-200 dark:border-blue-600 rounded-lg text-blue-900 dark:text-blue-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pie">Pie Chart</option>
                <option value="bar">Bar Chart</option>
              </select>
            </div>
            <div className="w-full h-64" id={`section-chart-${section.id}`}>
              {sectionChartTypes[section.id] === "bar" ? (
                <Bar
                  data={{
                    labels: questionStats.map(
                      (stat) => stat.subParam1 || "No parameter"
                    ),
                    datasets: [
                      {
                        label: "Yes",
                        data: questionStats.map((stat) => stat.yes),
                        backgroundColor: "#10b981",
                        borderColor: "#059669",
                        borderWidth: 1,
                      },
                      {
                        label: "No",
                        data: questionStats.map((stat) => stat.no),
                        backgroundColor: "#ef4444",
                        borderColor: "#dc2626",
                        borderWidth: 1,
                      },
                      {
                        label: "N/A",
                        data: questionStats.map((stat) => stat.na),
                        backgroundColor: "#f59e0b",
                        borderColor: "#d97706",
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
                      tooltip: {
                        callbacks: {
                          label: (context: any) => {
                            const dataIndex = context.dataIndex;
                            const datasets = context.chart?.data?.datasets || [];
                            const total = datasets.reduce(
                              (sum: number, dataset: any) => {
                                const value = Array.isArray(dataset.data)
                                  ? dataset.data[dataIndex]
                                  : 0;
                                const numericValue =
                                  typeof value === "number"
                                    ? value
                                    : Number(value) || 0;
                                return sum + numericValue;
                              },
                              0
                            );
                            const barValue =
                              typeof context.raw === "number"
                                ? context.raw
                                : typeof context.parsed?.y === "number"
                                  ? context.parsed.y
                                  : 0;
                            const percentage =
                              total > 0 ? ((barValue / total) * 100).toFixed(1) : 0;
                            return `${context.dataset.label}: ${barValue} (${percentage}%)`;
                          },
                        },
                      },
                      datalabels: {
                        anchor: "end",
                        align: "start",
                        offset: -6,
                        color: document.documentElement.classList.contains(
                          "dark"
                        )
                          ? "#f3f4f6"
                          : "#0f172a",
                        font: {
                          size: 10,
                          weight: "600",
                        },
                        formatter: (value: number, context: any) => {
                          const dataIndex = context.dataIndex;
                          const datasets = context.chart?.data?.datasets || [];
                          const total = datasets.reduce(
                            (sum: number, dataset: any) => {
                              const datasetValue = Array.isArray(dataset.data)
                                ? dataset.data[dataIndex]
                                : 0;
                              const numericValue =
                                typeof datasetValue === "number"
                                  ? datasetValue
                                  : Number(datasetValue) || 0;
                              return sum + numericValue;
                            },
                            0
                          );
                          const numericValue =
                            typeof value === "number" ? value : Number(value) || 0;
                          if (total === 0) {
                            return "0";
                          }
                          const percentage = ((numericValue / total) * 100).toFixed(1);
                          return `${numericValue} (${percentage}%)`;
                        },
                      },
                    },
                    scales: {
                      x: {
                        stacked: false,
                        ticks: {
                          color: document.documentElement.classList.contains(
                            "dark"
                          )
                            ? "#d1d5db"
                            : "#374151",
                          font: { size: 12 },
                        },
                        grid: {
                          color: document.documentElement.classList.contains(
                            "dark"
                          )
                            ? "#374151"
                            : "#e5e7eb",
                        },
                      },
                      y: {
                        stacked: false,
                        ticks: {
                          color: document.documentElement.classList.contains(
                            "dark"
                          )
                            ? "#d1d5db"
                            : "#374151",
                          beginAtZero: true,
                        },
                        grid: {
                          color: document.documentElement.classList.contains(
                            "dark"
                          )
                            ? "#374151"
                            : "#e5e7eb",
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

          {/* Table */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-blue-200 dark:border-blue-700 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4">
              <h4 className="text-lg font-bold text-white flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Question Breakdown
              </h4>
            </div>
            <div className="overflow-x-auto max-h-64">
              <table className="w-full divide-y divide-blue-200 dark:divide-blue-700 text-sm">
                <thead className="bg-blue-50 dark:bg-blue-900/50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-blue-900 dark:text-blue-100 uppercase tracking-wider w-[60%]">
                      Question & Parameters
                    </th>
                    <th className="px-4 py-3 text-center font-bold text-blue-900 dark:text-blue-100 uppercase tracking-wider w-[10%]">
                      Yes
                    </th>
                    <th className="px-4 py-3 text-center font-bold text-blue-900 dark:text-blue-100 uppercase tracking-wider w-[10%]">
                      No
                    </th>
                    <th className="px-4 py-3 text-center font-bold text-blue-900 dark:text-blue-100 uppercase tracking-wider w-[10%]">
                      N/A
                    </th>
                    <th className="px-4 py-3 text-center font-bold text-blue-900 dark:text-blue-100 uppercase tracking-wider w-[10%]">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-200 dark:divide-blue-700 bg-white dark:bg-gray-900">
                  {questionStats.map((stat, index) => {
                    const total = stat.yes + stat.no + stat.na;
                    const yesPercent =
                      total > 0 ? ((stat.yes / total) * 100).toFixed(1) : 0;
                    const noPercent =
                      total > 0 ? ((stat.no / total) * 100).toFixed(1) : 0;
                    const naPercent =
                      total > 0 ? ((stat.na / total) * 100).toFixed(1) : 0;
                    return (
                      <tr
                        key={stat.id}
                        className={`group hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 ${index % 2 === 0
                            ? "bg-white dark:bg-gray-900"
                            : "bg-blue-25 dark:bg-blue-900/5"
                          }`}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                          <div className="flex flex-col gap-1.5">
                            {stat.subParam1 && (
                              <span className="inline-block bg-blue-100/60 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 px-2 py-0.5 rounded font-semibold text-xs w-fit">
                                {stat.subParam1}
                              </span>
                            )}
                            <span
                              className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed"
                              title={stat.title}
                            >
                              {stat.title}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300 font-medium">
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${stat.yes > 0
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500"
                                }`}
                            >
                              {stat.yes}
                            </span>
                            <span className="text-xs font-semibold text-green-700 dark:text-green-300">
                              {yesPercent}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300 font-medium">
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${stat.no > 0
                                  ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                  : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500"
                                }`}
                            >
                              {stat.no}
                            </span>
                            <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                              {noPercent}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300 font-medium">
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${stat.na > 0
                                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                  : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500"
                                }`}
                            >
                              {stat.na}
                            </span>
                            <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">
                              {naPercent}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300 font-bold">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            {total}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Section Totals Row */}
                  <tr className="bg-blue-100 dark:bg-blue-900/50 border-t-2 border-blue-300 dark:border-blue-600">
                    <td className="px-4 py-3 font-bold text-blue-900 dark:text-blue-100 uppercase tracking-wider">
                      Section Total
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-base font-bold text-green-900 dark:text-green-200">
                          {sectionTotals.yes}
                        </span>
                        <span className="text-xs font-semibold text-green-700 dark:text-green-300">
                          {sectionPercentages.yes}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-base font-bold text-red-900 dark:text-red-200">
                          {sectionTotals.no}
                        </span>
                        <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                          {sectionPercentages.no}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-base font-bold text-yellow-900 dark:text-yellow-200">
                          {sectionTotals.na}
                        </span>
                        <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">
                          {sectionPercentages.na}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-blue-900 dark:text-blue-100">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-100">
                        {sectionTotals.total}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSectionWiseMainParameters = (): React.ReactNode => {
    if (!selectedForm || !selectedResponse || !availableSections.length) {
      return (
        <div className="text-center py-8 text-gray-500">
          No sections available
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {availableSections.map((section: any) => {
          const sectionQuestions = getSectionQuestionsWithFollowUps(section.id);

          if (sectionQuestions.length === 0) {
            return null;
          }

          const allFollowUpIds = new Set<string>();
          const followUpIdAnswerStatus = new Map<string, boolean>();

          sectionQuestions.forEach((q: any) => {
            q.followUpQuestions.forEach((fq: any) => {
              allFollowUpIds.add(fq.id);
              if (fq.answer && fq.answer !== "N/A" && fq.answer !== "n/a") {
                followUpIdAnswerStatus.set(fq.id, true);
              }
            });
          });

          const followUpIdsWithAnswers = Array.from(allFollowUpIds).filter(
            (id) => followUpIdAnswerStatus.get(id) === true
          );

          // Group follow-ups by their subParam1 values to avoid duplicate headers
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

          return (
            <div key={section.id}>
              {/* Yes/No/N/A Table and Chart */}
              {renderSectionYesNoTable(section.id)}

              {/* Main Parameters Table */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-8 rounded-3xl shadow-xl border border-emerald-200 dark:border-emerald-800">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 flex items-center gap-3">
                    <div className="w-1 h-8 bg-emerald-600 rounded-full"></div>
                    {section.name || section.label || `Section`} - Main
                    Parameters
                  </h3>
                  {/* <p className="text-emerald-700 dark:text-emerald-300 mt-2">
                    Main questions with their follow-up answers organized by subparameters
                  </p> */}
                  {/* {allFollowUpIds.size > 0 && (
                    <div className="mt-3 p-3 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 rounded text-sm text-blue-800 dark:text-blue-200">
                      <strong>Found {allFollowUpIds.size} follow-up question(s)</strong> • {Array.from(allFollowUpIds).join(', ')}
                    </div>
                  )} */}
                  {allFollowUpIds.size === 0 && sectionQuestions.length > 0 && (
                    <div className="mt-3 p-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 rounded text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>⚠️ No follow-up questions found</strong> for{" "}
                      {sectionQuestions.length} main question(s)
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-emerald-200 dark:bg-emerald-800/50">
                        <th className="px-6 py-3 text-left text-emerald-900 dark:text-emerald-100 font-semibold border border-emerald-300 dark:border-emerald-700 min-w-64">
                          Main Parameters
                        </th>
                        {uniqueSubParams.map((subParam) => (
                          <th
                            key={subParam}
                            className="px-4 py-3 text-left text-emerald-900 dark:text-emerald-100 font-semibold border border-emerald-300 dark:border-emerald-700 min-w-48 bg-emerald-50 dark:bg-emerald-900/30"
                          >
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
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
                          className={`border-b border-emerald-200 dark:border-emerald-800 ${index % 2 === 0
                            ? "bg-white dark:bg-gray-800/50"
                            : "bg-emerald-100/30 dark:bg-emerald-900/10"
                            }`}
                        >
                          <td className="px-6 py-4 font-medium text-gray-800 dark:text-gray-200 border border-emerald-200 dark:border-emerald-800">
                            <div className="flex flex-col gap-2">
                              {mainQuestion.subParam1 && (
                                <span className="inline-block bg-blue-100/60 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 px-2 py-0.5 rounded font-semibold text-xs w-fit">
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
                            const answersForParam = followUpsForParam
                              .map((followUp) => {
                                const followUpFromMain =
                                  mainQuestion.followUpQuestions.find(
                                    (fq: any) => fq.id === followUp.id
                                  );
                                return followUpFromMain?.answer;
                              })
                              .filter(
                                (answer) =>
                                  answer !== undefined &&
                                  answer !== null &&
                                  answer !== ""
                              );

                            return (
                              <td
                                key={subParam}
                                className="px-4 py-4 border border-emerald-200 dark:border-emerald-800 text-sm text-gray-700 dark:text-gray-300 bg-emerald-50/40 dark:bg-emerald-900/20"
                              >
                                {answersForParam.length > 0 ? (
                                  <div className="space-y-1">
                                    {answersForParam.map((answer, idx) => (
                                      <p key={idx} className="font-medium">
                                        {answer}
                                      </p>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 italic">
                                    N/A
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
            </div>
          );
        })}
      </div>
    );
  };

  const renderFormContent = (): React.ReactNode => {
    if (!selectedResponse) {
      return null;
    }

    const answeredKeys = new Set<string>();
    const content: React.ReactNode[] = [];

    if (!selectedForm) {
      return (
        <div className="space-y-4">
          {Object.entries(selectedResponse.answers).map(([key, value]) => (
            <div key={key} className="border-b border-primary-100 pb-2">
              <div className="font-medium text-primary-700">{key}</div>
              <div className="text-primary-600 mt-1">
                {renderAnswerDisplay(value)}
              </div>
            </div>
          ))}
        </div>
      );
    }

    selectedForm.sections?.forEach((section) => {
      const sectionQuestions = section.questions || [];
      if (!sectionQuestions.length) {
        return;
      }
      const sectionTitle = section.title || "Untitled Section";
      const formattedSectionTitle =
        formatSectionLabel(sectionTitle) || sectionTitle;

      content.push(
        <div
          key={section.id}
          ref={(element) => {
            sectionRefs.current[section.id] = element;
          }}
          className="border border-primary-100 rounded-lg overflow-hidden"
        >
          <div className="px-4 py-3 bg-primary-50">
            <div
              className="text-base font-semibold text-primary-700"
              title={sectionTitle}
            >
              {formattedSectionTitle}
            </div>
            {section.description ? (
              <div className="text-sm text-primary-500 mt-1">
                {section.description}
              </div>
            ) : null}
          </div>
          <div className="divide-y divide-primary-100">
            {sectionQuestions.map((question: any) => {
              answeredKeys.add(question.id);
              const answer = selectedResponse.answers[question.id];

              return (
                <div
                  key={question.id}
                  className="p-6 bg-white dark:bg-gray-800 rounded-xl border-2 border-slate-200 dark:border-slate-600 shadow-lg"
                >
                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center text-lg">
                    <span className="w-3 h-3 bg-slate-600 rounded-full mr-4 flex-shrink-0"></span>
                    {question.text || question.id}
                  </div>
                  {question.subParam1 && (
                    <div className="mt-2 ml-7 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-700 font-medium">
                      <span className="font-semibold">Main Parameter:</span>{" "}
                      {question.subParam1}
                    </div>
                  )}
                  <div className="mt-3 text-slate-700 dark:text-slate-300 ml-7 text-base">
                    {renderAnswerDisplay(answer, question)}
                  </div>
                  {question.followUpQuestions?.map((followUp: any) => {
                    const followAnswer = selectedResponse.answers[followUp.id];
                    const hasAnswer = hasAnswerValue(followAnswer);
                    if (hasAnswer) {
                      answeredKeys.add(followUp.id);
                    }
                    return (
                      <div
                        key={followUp.id}
                        className={`mt-4 ml-12 p-4 border-l-4 rounded-r-xl shadow-sm ${hasAnswer
                          ? "bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-500"
                          : "bg-gray-50 dark:bg-gray-900/30 border-gray-400 dark:border-gray-500"
                          }`}
                      >
                        <div
                          className={`font-medium ${hasAnswer
                            ? "text-blue-800 dark:text-blue-200"
                            : "text-gray-700 dark:text-gray-300"
                            } flex items-center`}
                        >
                          <span
                            className={`mr-3 text-lg ${hasAnswer ? "text-blue-600" : "text-gray-500"
                              }`}
                          >
                            ↳
                          </span>
                          {followUp.text || followUp.id}
                        </div>
                        {followUp.subParam1 && (
                          <div className="mt-2 ml-6 text-xs bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-700 font-medium w-fit">
                            <span className="font-semibold">
                              Follow-up Parameter:
                            </span>{" "}
                            {followUp.subParam1}
                          </div>
                        )}
                        <div
                          className={`mt-2 ml-6 ${hasAnswer
                            ? "text-blue-700 dark:text-blue-300"
                            : "text-gray-600 dark:text-gray-400"
                            }`}
                        >
                          {hasAnswer ? (
                            renderAnswerDisplay(followAnswer, followUp)
                          ) : (
                            <span className="italic font-light">
                              Not answered
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      );
    });

    if (selectedForm.followUpQuestions?.length) {
      content.push(
        <div
          key="form-follow-ups"
          className="border-2 border-blue-200 dark:border-blue-700 rounded-xl overflow-hidden shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20"
        >
          <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600">
            <div className="text-lg font-bold text-white flex items-center">
              <div className="w-3 h-3 bg-white rounded-full mr-3 animate-pulse"></div>
              Form Follow-up Questions
            </div>
          </div>
          <div className="divide-y divide-blue-200 dark:divide-blue-700">
            {selectedForm.followUpQuestions.map((followUp: any) => {
              const answer = selectedResponse.answers[followUp.id];
              const hasAnswer = hasAnswerValue(answer);
              if (hasAnswer) {
                answeredKeys.add(followUp.id);
              }

              return (
                <div
                  key={followUp.id}
                  className={`p-6 ml-12 border-l-4 rounded-r-xl shadow-sm hover:transition-colors duration-200 ${hasAnswer
                    ? "bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                    : "bg-gray-50 dark:bg-gray-900/30 border-gray-400 dark:border-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900/40"
                    }`}
                >
                  <div
                    className={`font-medium flex items-center text-lg ${hasAnswer
                      ? "text-blue-800 dark:text-blue-200"
                      : "text-gray-700 dark:text-gray-300"
                      }`}
                  >
                    <span
                      className={`mr-4 text-xl ${hasAnswer ? "text-blue-600" : "text-gray-500"
                        }`}
                    >
                      ↳
                    </span>
                    {followUp.text || followUp.id}
                  </div>
                  {followUp.subParam1 && (
                    <div className="mt-2 ml-8 text-xs bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-700 font-medium w-fit">
                      <span className="font-semibold">
                        Follow-up Parameter:
                      </span>{" "}
                      {followUp.subParam1}
                    </div>
                  )}
                  <div
                    className={`mt-3 ml-8 ${hasAnswer
                      ? "text-blue-700 dark:text-blue-300"
                      : "text-gray-600 dark:text-gray-400"
                      } text-base`}
                  >
                    {hasAnswer ? (
                      renderAnswerDisplay(answer, followUp)
                    ) : (
                      <span className="italic font-light">Not answered</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    const extraEntries = Object.entries(selectedResponse.answers).filter(
      ([key]) => !answeredKeys.has(key)
    );

    if (extraEntries.length) {
      content.push(
        <div
          key="additional-answers"
          className="border border-primary-100 rounded-lg overflow-hidden"
        >
          <div className="px-4 py-3 bg-primary-50">
            <div className="text-base font-semibold text-primary-700">
              Additional Responses
            </div>
          </div>
          <div className="divide-y divide-primary-100">
            {extraEntries.map(([key, value]) => (
              <div key={key} className="p-4">
                <div className="font-medium text-primary-700">{key}</div>
                <div className="mt-1 text-primary-600">
                  {renderAnswerDisplay(value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (!content.length) {
      return (
        <div className="space-y-6">
          {Object.entries(selectedResponse.answers).map(([key, value]) => (
            <div key={key} className="border-b border-primary-100 pb-2">
              <div className="font-medium text-primary-700">{key}</div>
              <div className="text-primary-600 mt-1">
                {renderAnswerDisplay(value)}
              </div>
            </div>
          ))}
        </div>
      );
    }

    return <div className="space-y-6">{content}</div>;
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
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

  const editingResponsePayload = editingResponse
    ? {
      id: editingResponse.id,
      questionId: editingResponse.questionId || editingResponse.formId || "",
      answers: editingResponse.answers,
      timestamp:
        editingResponse.updatedAt ||
        editingResponse.createdAt ||
        new Date().toISOString(),
      parentResponseId: editingResponse.parentResponseId,
      assignedTo: editingResponse.assignedTo,
      status: editingResponse.status,
    }
    : null;

  const editingQuestionPayload = editingForm
    ? {
      id:
        editingForm._id ||
        editingForm.id ||
        editingResponse?.questionId ||
        editingResponse?.formId ||
        "",
      title: editingForm.title,
      description: editingForm.description || "",
      sections: editingForm.sections || [],
      followUpQuestions: editingForm.followUpQuestions || [],
      parentFormId: editingForm.parentFormId,
    }
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="text-red-600 mb-2">Error loading responses</div>
        <div className="text-primary-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-blue-100/50 dark:from-gray-900 dark:to-gray-800 p-6 md:p-8">
      {/* Page Header */}
      <div className="mb-8 flex items-center justify-between gap-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-900/10 dark:to-indigo-900/10 p-4 rounded-xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white whitespace-nowrap">
              Customer Requests
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap">
              View all requests and responses
            </p>
          </div>
        </div>
        
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-blue-200 dark:border-blue-700 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-gray-900 dark:text-white placeholder-blue-400 dark:placeholder-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm text-sm"
            />
          </div>
        </div>
        
        <div className="flex-shrink-0 relative flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            title="Refresh responses"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <div className="relative">
          <button
            onClick={() => setShowFormFilter(!showFormFilter)}
            style={{ backgroundColor: "#1e3a8a" }}
            className={`px-4 py-2.5 text-white rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 whitespace-nowrap hover:opacity-90 shadow-md hover:shadow-lg text-sm ${showFormFilter ? 'ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-gray-700' : ''}`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
            Forms ({selectedFormIds.length === 0 ? uniqueForms.length : (selectedFormIds.includes('NONE_SELECTED') ? 0 : selectedFormIds.length)}/{uniqueForms.length})
          </button>

          <button
            type="button"
            onClick={handleBulkDownloadZip}
            disabled={exportingZip}
            className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 whitespace-nowrap shadow-md hover:shadow-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exportingZip ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
            Bulk Download (ZIP)
          </button>

          {showFormFilter && (
              <div className="absolute top-full right-0 mt-2 p-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 min-w-80 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" style={{ color: "#1e3a8a" }}>
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                      Select Forms
                    </h4>
                    <button
                      onClick={() => setShowFormFilter(false)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedFormIds([])}
                      className="flex-1 px-3 py-1.5 text-xs font-semibold text-white rounded transition-colors hover:opacity-90"
                      style={{ backgroundColor: "#1e3a8a" }}
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setSelectedFormIds(['NONE_SELECTED'])}
                      className="flex-1 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                
                <div className="p-4 max-h-96 overflow-y-auto space-y-2">
                  {uniqueForms.length > 0 ? (
                    uniqueForms.map(form => (
                      <label key={form.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer transition-colors group">
                        <div className="relative flex items-center flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={selectedFormIds.length === 0 || (selectedFormIds.includes(form.id) && !selectedFormIds.includes('NONE_SELECTED'))}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              if (selectedFormIds.length === 0) {
                                // Currently "All" (effectively all checked)
                                if (!isChecked) {
                                  // User unchecked one, so we select all OTHERS
                                  const allIds = uniqueForms.map(f => f.id);
                                  setSelectedFormIds(allIds.filter(id => id !== form.id));
                                }
                              } else if (selectedFormIds.includes('NONE_SELECTED')) {
                                // Currently "None"
                                if (isChecked) {
                                  setSelectedFormIds([form.id]);
                                }
                              } else {
                                // Currently specific selection
                                if (isChecked) {
                                  const newIds = [...selectedFormIds, form.id];
                                  // If now all are selected, switch back to "All" (empty)
                                  if (newIds.length === uniqueForms.length) {
                                    setSelectedFormIds([]);
                                  } else {
                                    setSelectedFormIds(newIds);
                                  }
                                } else {
                                  const newIds = selectedFormIds.filter(id => id !== form.id);
                                  if (newIds.length === 0) {
                                    setSelectedFormIds(['NONE_SELECTED']);
                                  } else {
                                    setSelectedFormIds(newIds);
                                  }
                                }
                              }
                            }}
                            className="w-5 h-5 border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                            style={{ accentColor: "#1e3a8a" }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-200 block truncate">{form.title}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {responses.filter(r => (r.questionId || r.formId) === form.id).length} responses
                          </span>
                        </div>
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                      </label>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No forms available</p>
                  )}
                </div>
                
                <div className="sticky bottom-0 px-4 py-3 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                    {selectedFormIds.length === 0 ? uniqueForms.length : (selectedFormIds.includes('NONE_SELECTED') ? 0 : selectedFormIds.length)} of {uniqueForms.length} forms selected
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Responses by Date */}
      <div className="space-y-6">
        {Object.keys(groupedResponses)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
          .map((date) => (
            <div key={date} className="bg-gradient-to-br from-white to-blue-50/50 dark:from-gray-700 dark:to-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800/30 p-6 shadow-sm hover:shadow-lg transition-all duration-300">
              {/* Date Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-blue-200 dark:border-blue-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{date}</h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {groupedResponses[date].length} request{groupedResponses[date].length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Responses List */}
              <div className="space-y-3">
                {groupedResponses[date].map((response, idx) => {
                  const isFollowUp = !!response.parentResponseId;
                  const dealerName = response.dealerName;

                  return (
                    <div
                      key={response._id}
                      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 rounded-xl border transition-all duration-200 ${isFollowUp
                          ? "ml-0 sm:ml-8 bg-gradient-to-r from-blue-100/60 to-indigo-100/60 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-300 dark:border-blue-800/50 hover:shadow-md"
                          : "bg-gradient-to-br from-blue-50/70 to-indigo-50/50 dark:from-blue-900/15 dark:to-indigo-900/10 border-blue-100 dark:border-blue-800/30 hover:shadow-md"
                        }`}
                    >
                      <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
                        <div className="p-2.5 rounded-lg flex-shrink-0 bg-blue-50 dark:bg-blue-900/20">
                          {isFollowUp ? (
                            <div className="w-5 h-5 flex items-center justify-center">
                              <span className="text-blue-600 dark:text-blue-400 text-xs font-bold">
                                ↳
                              </span>
                            </div>
                          ) : (
                            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h4
                              className="font-semibold truncate text-gray-900 dark:text-white text-sm"
                              title={response.formTitle}
                            >
                              {response.formTitle}
                            </h4>
                            {isFollowUp && (
                              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                Follow-up
                              </span>
                            )}
                            {response.submissionMetadata?.source === 'internal' && (
                              <span className="text-xs font-semibold px-2 py-1 rounded-md bg-purple-200 dark:bg-purple-900/40 text-purple-900 dark:text-purple-300">
                                Internal Submission
                              </span>
                            )}
                          </div>

                          {/* Dealer Name, Location and Submission Time */}
                          <div className="flex flex-col sm:flex-row sm:items-center text-xs gap-2 sm:gap-3">
                            {dealerName && dealerName !== "Unknown" && (
                              <div className="inline-flex items-center text-gray-600 dark:text-gray-400">
                                <User className="w-4 h-4 mr-1.5 flex-shrink-0" />
                                <span className="font-medium truncate" title={dealerName}>
                                  {dealerName}
                                </span>
                              </div>
                            )}

                            {response.submissionMetadata?.location && (
                              <div className="inline-flex items-center text-gray-600 dark:text-gray-400">
                                <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0" />
                                <span className="truncate" title={`${response.submissionMetadata.location.city}, ${response.submissionMetadata.location.region}, ${response.submissionMetadata.location.country}`}>
                                  {[response.submissionMetadata.location.city, response.submissionMetadata.location.region, response.submissionMetadata.location.country]
                                    .filter(Boolean)
                                    .join(', ')}
                                </span>
                              </div>
                            )}

                            <div className="inline-flex items-center text-gray-600 dark:text-gray-400">
                              <Calendar className="w-4 h-4 mr-1.5 flex-shrink-0" />
                              <span>
                                {formatTimestamp(response.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 mt-4 sm:mt-0 sm:ml-4">
                        <button
                          onClick={() => handleViewDetails(response)}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
                          title="View details"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        {/* Commented out modal view dropdown
                        <div className="relative">
                          <button
                            onClick={() => setOpenViewDropdown(openViewDropdown === response.id ? null : response.id)}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
                            title="View options"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          {openViewDropdown === response.id && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                              <button
                                onClick={() => {
                                  handleOpenModal(response);
                                  setOpenViewDropdown(null);
                                }}
                                className="flex items-center w-full px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors duration-150 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                              >
                                <Eye className="w-4 h-4 mr-3 flex-shrink-0" style={{ color: "#1e3a8a" }} />
                                <span>View Details (Modal)</span>
                              </button>
                              <button
                                onClick={() => {
                                  handleViewDetails(response);
                                  setOpenViewDropdown(null);
                                }}
                                className="flex items-center w-full px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors duration-150"
                              >
                                <FileText className="w-4 h-4 mr-3 flex-shrink-0" style={{ color: "#2563eb" }} />
                                <span>View as Page</span>
                              </button>
                            </div>
                          )}
                        </div>
                        */}
                        <button
                          onClick={() => handleEditResponse(response)}
                          disabled={
                            !!editingResponse &&
                            editingResponse.id === response.id &&
                            (editingFormLoading || savingEdit)
                          }
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Edit response"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteResponse(response)}
                          disabled={deletingResponseId === response.id}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete response"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

        {groupedResponses && Object.keys(groupedResponses).length === 0 && (
          <div className="text-center py-16 bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-2xl border border-blue-100 dark:border-blue-800/30">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full mx-auto mb-4 flex items-center justify-center">
              <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Customer Requests
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              {selectedFormIds.length === 0 
                ? "There are currently no customer service requests. Requests will appear here once customers submit forms."
                : "No requests match your current filters. Try adjusting your search or form selection."}
            </p>
          </div>
        )}
      </div>
      {/* Response Preview Modal */}
      {selectedResponse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] overflow-y-auto p-2 animate-in fade-in duration-300">
          <div className="bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-800 dark:to-blue-900/10 rounded-2xl shadow-2xl max-w-7xl w-full my-auto max-h-[95vh] flex flex-col border border-blue-200 dark:border-blue-800/50 animate-in slide-in-from-bottom duration-300">
            <div className="sticky top-0 z-50 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 px-6 py-3 border-b border-blue-200 dark:border-blue-700/50 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {selectedResponse.formTitle}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    Submitted on {formatTimestamp(selectedResponse.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Edit Button */}
                <button
                  onClick={() => {
                    if (selectedResponse) {
                      handleEditResponse(selectedResponse);
                    }
                  }}
                  disabled={
                    !!editingResponse &&
                    editingResponse.id === selectedResponse?.id &&
                    (editingFormLoading || savingEdit)
                  }
                  className="flex items-center px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                  style={{ backgroundColor: "#2563eb" }}
                  title="Edit response"
                >
                  <Edit2 className="w-3 h-3 mr-1.5" />
                  Edit
                </button>

                {/* Delete Button */}
                <button
                  onClick={() => {
                    if (selectedResponse) {
                      handleDeleteResponse(selectedResponse);
                    }
                  }}
                  disabled={deletingResponseId === selectedResponse?.id}
                  className="flex items-center px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                  style={{ backgroundColor: "#dc2626" }}
                  title="Delete response"
                >
                  <Trash2 className="w-3 h-3 mr-1.5" />
                  {deletingResponseId === selectedResponse?.id ? "..." : "Delete"}
                </button>

                {viewMode === "dashboard" ? (
                 <div className="flex items-center download-container">
  {showDownloadOptions && (
    <div className="flex items-center gap-1.5 animate-in slide-in-from-right-2 duration-300 mr-2">
      {/* Type 1 - Yes */}
      <button
        onClick={(e) => handleDropdownClick('yes-only', e)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-all duration-200"
        title="Yes Responses Only"
      >
        <CheckCircle className="w-3 h-3" />
        <span>YES</span>
      </button>

      {/* Type 2 - No */}
      <button
        onClick={(e) => handleDropdownClick('no-only', e)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-all duration-200"
        title="No Responses Only"
      >
        <XCircle className="w-3 h-3" />
        <span>NO</span>
      </button>

      {/* Type 3 - N/A */}
      <button
        onClick={(e) => handleDropdownClick('na-only', e)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-all duration-200"
        title="N/A Responses Only"
      >
        <AlertTriangle className="w-3 h-3" />
        <span>N/A</span>
      </button>

      {/* Type 4 - All */}
      <button
        onClick={(e) => handleDropdownClick('both', e)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all duration-200"
        title="All Responses"
      >
        <FileText className="w-3 h-3" />
        <span>ALL</span>
      </button>
      
      {/* Sections Button */}
      <button
        onClick={() => handleDownloadPDF('section')}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-all duration-200"
        title="Section Analysis"
      >
        <span>SECTIONS</span>
      </button>

      {/* Responses Button */}
      <button
        onClick={(e) => handleDropdownClick('responses-view', e)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-lg hover:bg-cyan-100 transition-all duration-200"
        title="Form Responses Detail"
      >
        <FileText className="w-3 h-3" />
        <span>RESPONSES</span>
      </button>
    </div>
  )}
  
  {/* Main Download PDF Button */}
  <div className="relative">
    <button
      onClick={(e) => {
        e.stopPropagation();
        setShowDownloadOptions(!showDownloadOptions);
      }}
      disabled={generatingPDF}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-90 ${showDownloadOptions ? 'bg-gray-600' : 'bg-[#16a34a]'}`}
    >
      {generatingPDF ? (
        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          <Download className="w-3 h-3" />
          <span>{showDownloadOptions ? 'Close' : 'Download PDF'}</span>
        </>
      )}
    </button>
  </div>
</div>
                ) : (
                  <button
                    onClick={handleExportExcel}
                    disabled={exportingExcel}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ backgroundColor: "#16a34a" }}
                    title="Export Excel"
                  >
                    {exportingExcel ? (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                    Export Excel
                  </button>
                )}

                <button
                  onClick={() => {
                    setSelectedResponse(null);
                    setSelectedForm(null);
                    setViewMode("dashboard");
                    setPendingSectionId(null);
                    sectionRefs.current = {};
                  }}
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg transition-all duration-200"
                  title="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 bg-gradient-to-b from-blue-50/30 to-white dark:from-blue-900/10 dark:to-gray-800">
              <div className="p-4">
                {formLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 flex items-center gap-2 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-xl p-1.5 mb-4 shadow-md border border-blue-100 dark:border-blue-900/30">
                      <button
                        onClick={() => setViewMode("dashboard")}
                        className={`flex-1 px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${viewMode === "dashboard"
                          ? "text-white shadow-lg"
                          : "text-gray-900 dark:text-gray-100 hover:text-black dark:hover:text-white hover:bg-white/60 dark:hover:bg-gray-700/60"
                          }`}
                        style={{ backgroundColor: viewMode === "dashboard" ? "#1e3a8a" : "transparent" }}
                      >
                        <BarChart3 className="w-3 h-3" />
                        Dashboard
                      </button>
                      <button
                        onClick={() => setViewMode("responses")}
                        className={`flex-1 px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${viewMode === "responses"
                          ? "text-white shadow-lg"
                          : "text-gray-900 dark:text-gray-100 hover:text-black dark:hover:text-white hover:bg-white/60 dark:hover:bg-gray-700/60"
                          }`}
                        style={{ backgroundColor: viewMode === "responses" ? "#1e3a8a" : "transparent" }}
                      >
                        <FileText className="w-3 h-3" />
                        Responses
                      </button>
                    </div>

                    {viewMode === "dashboard" &&
                      filteredSectionStats.length > 0 && (
                        <div className="space-y-4">
                          {/* Dashboard Header with Logo */}
                          <div className="bg-gradient-to-br from-white via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20 p-4 rounded-2xl shadow-lg border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                {logo && (
                                  <div className="w-12 h-10 rounded-lg overflow-hidden shadow-lg border-2 border-white dark:border-gray-700">
                                    <img
                                      src={logo}
                                      alt="Company Logo"
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                      }}
                                    />
                                  </div>
                                )}
                                <div>
                                  <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                                    {selectedForm?.title ||
                                      "Response Dashboard"}
                                  </h1>
                                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                                    Comprehensive analysis and insights
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="text-right">
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Submitted
                                  </p>
                                  <p className="text-xs font-semibold text-gray-900 dark:text-white">
                                    {formatTimestamp(
                                      selectedResponse?.createdAt || ""
                                    )}
                                  </p>
                                </div>
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                                  <FileCheck className="w-4 h-4 text-white" />
                                </div>
                              </div>
                            </div>

                            {/* Two-Column Layout: Stats (25%) and Basic Info (75%) */}
                            <div className="flex gap-4 items-stretch">
                              <div className="w-1/4 flex flex-col gap-3">
                              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 backdrop-blur-sm p-3 rounded-xl border border-yellow-200/50 dark:border-yellow-700/50 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 mb-1">
                                      Overall Score
                                    </p>
                                    <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                                      {(() => {
                                        const totalQuestions =
                                          filteredSectionStats.reduce(
                                            (sum, stat) => sum + stat.total,
                                            0
                                          );
                                        const totalYes =
                                          filteredSectionStats.reduce(
                                            (sum, stat) => sum + stat.yes,
                                            0
                                          );
                                        return totalQuestions > 0
                                          ? (
                                            (totalYes / totalQuestions) *
                                            100
                                          ).toFixed(1)
                                          : "0.0";
                                      })()}
                                      %
                                    </p>
                                  </div>
                                  <div className="p-2 bg-yellow-500/20 rounded-full">
                                    <Award className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                                  </div>
                                </div>
                              </div>

                              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 backdrop-blur-sm p-3 rounded-xl border border-blue-200/50 dark:border-blue-700/50 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">
                                      Total Sections
                                    </p>
                                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                                      {filteredSectionStats.length}
                                    </p>
                                  </div>
                                  <div className="p-2 bg-blue-500/20 rounded-full">
                                    <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                  </div>
                                </div>
                              </div>

                              <div
                                className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 backdrop-blur-sm p-3 rounded-xl border border-green-200/50 dark:border-green-700/50 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer"
                                onClick={() =>
                                  setExpandResponseRateBreakdown(
                                    !expandResponseRateBreakdown
                                  )
                                }
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="flex items-center gap-1">
                                      <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">
                                        Response Rate
                                      </p>
                                      <ChevronDown
                                        className={`w-4 h-4 text-green-700 dark:text-green-300 transition-transform duration-300 ${expandResponseRateBreakdown
                                          ? "rotate-180"
                                          : ""
                                          }`}
                                      />
                                    </div>
                                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                                      {(() => {
                                        const totalQuestions =
                                          filteredSectionStats.reduce(
                                            (sum, stat) => sum + stat.total,
                                            0
                                          );
                                        const totalAnswered =
                                          filteredSectionStats.reduce(
                                            (sum, stat) =>
                                              sum +
                                              stat.yes +
                                              stat.no +
                                              stat.na,
                                            0
                                          );
                                        return totalQuestions > 0
                                          ? (
                                            (totalAnswered / totalQuestions) *
                                            100
                                          ).toFixed(1)
                                          : "0.0";
                                      })()}
                                      %
                                    </p>
                                  </div>
                                  <div className="p-2 bg-green-500/20 rounded-full">
                                    <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
                                  </div>
                                </div>

                                {expandResponseRateBreakdown && (
                                  <div className="mt-3 pt-3 border-t border-green-300/50 dark:border-green-600/50">
                                    <div className="grid grid-cols-3 gap-2">
                                      {(() => {
                                        const totalYes =
                                          filteredSectionStats.reduce(
                                            (sum, stat) => sum + stat.yes,
                                            0
                                          );
                                        const totalNo =
                                          filteredSectionStats.reduce(
                                            (sum, stat) => sum + stat.no,
                                            0
                                          );
                                        const totalNA =
                                          filteredSectionStats.reduce(
                                            (sum, stat) => sum + stat.na,
                                            0
                                          );
                                        const totalAnswered =
                                          totalYes + totalNo + totalNA;

                                        const yesPercent =
                                          totalAnswered > 0
                                            ? (
                                              (totalYes / totalAnswered) *
                                              100
                                            ).toFixed(1)
                                            : "0.0";
                                        const noPercent =
                                          totalAnswered > 0
                                            ? (
                                              (totalNo / totalAnswered) *
                                              100
                                            ).toFixed(1)
                                            : "0.0";
                                        const naPercent =
                                          totalAnswered > 0
                                            ? (
                                              (totalNA / totalAnswered) *
                                              100
                                            ).toFixed(1)
                                            : "0.0";

                                        return (
                                          <>
                                            <div className="text-center p-2 bg-white/50 dark:bg-green-900/20 rounded-lg">
                                              <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-0.5 uppercase">
                                                Yes
                                              </p>
                                              <p className="text-xl font-bold text-green-700 dark:text-green-300">
                                                {yesPercent}%
                                              </p>
                                            </div>
                                            <div className="text-center p-2 bg-white/50 dark:bg-red-900/20 rounded-lg">
                                              <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-0.5 uppercase">
                                                No
                                              </p>
                                              <p className="text-xl font-bold text-red-700 dark:text-red-300">
                                                {noPercent}%
                                              </p>
                                            </div>
                                            <div className="text-center p-2 bg-white/50 dark:bg-yellow-900/20 rounded-lg">
                                              <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 mb-0.5 uppercase">
                                                N/A
                                              </p>
                                              <p className="text-xl font-bold text-yellow-700 dark:text-yellow-300">
                                                {naPercent}%
                                              </p>
                                            </div>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Location Card */}
                              <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 backdrop-blur-sm p-3 rounded-xl border border-purple-200/50 dark:border-purple-700/50 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1">
                                      Location
                                    </p>
                                    <p className="text-sm font-bold text-purple-900 dark:text-purple-100">
                                      {selectedForm?.locationEnabled !== false
                                        ? (() => {
                                          const capturedLoc =
                                            selectedResponse?.submissionMetadata?.capturedLocation;
                                          const ipLoc =
                                            selectedResponse?.submissionMetadata?.location;

                                          let locationToUse = null;

                                          if (capturedLoc?.city || capturedLoc?.region || capturedLoc?.country) {
                                            locationToUse = capturedLoc;
                                          } else if (ipLoc?.city || ipLoc?.region || ipLoc?.country) {
                                            locationToUse = ipLoc;
                                          }

                                          if (locationToUse) {
                                            const parts = [];
                                            if (locationToUse.city)
                                              parts.push(locationToUse.city);
                                            if (locationToUse.region)
                                              parts.push(locationToUse.region);
                                            if (locationToUse.country)
                                              parts.push(locationToUse.country);
                                            return parts.length > 0
                                              ? parts.join(", ")
                                              : "Location data unavailable";
                                          }
                                          return "Location data unavailable";
                                        })()
                                        : "Location disabled"}
                                    </p>
                                  </div>
                                  <div className="p-2 bg-purple-500/20 rounded-full">
                                    <MapPin className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                  </div>
                                </div>
                              </div>
                            </div>

                              {/* Basic Information - 75% */}
                              <div className="w-3/4">
                                {selectedForm?.sections?.[0] && (
                                  <div className="border border-primary-100 rounded-lg overflow-hidden">
                                    <div className="px-4 py-3 bg-primary-50">
                                      <div className="text-base font-semibold text-primary-700">
                                        {selectedForm.sections[0].title || "First Section"}
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-primary-100">
                                      {selectedForm.sections[0].questions?.map((question: any, index: number) => {
                                        const answer = selectedResponse?.answers[question.id];
                                        return (
                                          <div key={question.id} className="p-4">
                                            <div className="font-medium text-primary-700 mb-1">
                                              {question.text || question.id}
                                            </div>
                                            <div className="text-primary-600 mb-3">
                                              {renderAnswerDisplay(answer, question)}
                                            </div>
                                            {question.followUpQuestions?.map((followUp: any) => {
                                              const followAnswer = selectedResponse?.answers[followUp.id];
                                              if (!hasAnswerValue(followAnswer)) return null;
                                              return (
                                                <div
                                                  key={followUp.id}
                                                  className="mt-3 pl-4 border-l border-primary-100 text-sm"
                                                >
                                                  <div className="font-medium text-primary-600 mb-1">
                                                    {followUp.text || followUp.id}
                                                  </div>
                                                  <div className="text-primary-600">
                                                    {renderAnswerDisplay(followAnswer, followUp)}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Location Heatmap Section */}
                          {/*responses && responses.length > 0 && (
                            <LocationHeatmap responses={responses} />
                          )*/}



                          {/* Charts Section */}
                          <div className={`grid gap-8 ${showWeightageColumns ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                            <div className={`bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/30 dark:from-gray-800 dark:via-blue-900/10 dark:to-indigo-900/10 p-8 rounded-3xl shadow-2xl border border-blue-200/50 dark:border-blue-700/50 transform hover:scale-[1.02] transition-all duration-500 hover:shadow-3xl backdrop-blur-sm ${!showWeightageColumns ? 'lg:max-w-3xl mx-auto w-full' : ''}`}>
                              <div className="flex items-center justify-between mb-8">
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                                  <div className="p-2 bg-blue-500/20 rounded-lg mr-4">
                                    <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                  </div>
                                  Section Performance
                                </h3>
                                <div className="flex items-center space-x-3 bg-white/50 dark:bg-gray-700/50 rounded-full px-4 py-2">
                                  <div className="flex items-center space-x-1">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      Yes
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      No
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <div className="w-3 h-3 bg-blue-300 rounded-full"></div>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      N/A
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div
                                className="w-full flex items-center justify-center"
                                style={{ height: sectionChartHeight, minHeight: "400px" }}
                                id="section-performance-chart"
                              >
                                <Radar
                                  data={sectionChartData}
                                  options={{
                                    ...sectionChartOptions,
                                    plugins: {
                                      ...sectionChartOptions.plugins,
                                      legend: {
                                        ...sectionChartOptions.plugins.legend,
                                        labels: {
                                          ...sectionChartOptions.plugins.legend
                                            .labels,
                                          font: {
                                            size: 12,
                                            weight: "bold",
                                          },
                                        },
                                      },
                                    },
                                  }}
                                />
                              </div>
                            </div>

                            {showWeightageColumns && (
                            <div className="bg-gradient-to-br from-white via-green-50/30 to-emerald-50/30 dark:from-gray-800 dark:via-green-900/10 dark:to-emerald-900/10 p-8 rounded-3xl shadow-2xl border border-green-200/50 dark:border-green-700/50 transform hover:scale-[1.02] transition-all duration-500 hover:shadow-3xl backdrop-blur-sm">
                              <div className="flex items-center justify-between mb-8">
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                                  <div className="p-2 bg-green-500/20 rounded-lg mr-4">
                                    <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                                  </div>
                                  Weighted Trends
                                </h3>
                                <div className="flex items-center space-x-3 bg-white/50 dark:bg-gray-700/50 rounded-full px-4 py-2">
                                  <div className="flex items-center space-x-1">
                                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      Yes × Weight
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      No × Weight
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      N/A × Weight
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div
                                className="w-full"
                                style={{ height: weightedChartHeight }}
                              >
                                <Line
                                  data={weightedPercentageChartData}
                                  options={{
                                    ...weightedPercentageChartOptions,
                                    plugins: {
                                      ...weightedPercentageChartOptions.plugins,
                                      legend: {
                                        ...weightedPercentageChartOptions
                                          .plugins.legend,
                                        labels: {
                                          ...weightedPercentageChartOptions
                                            .plugins.legend,
                                          font: {
                                            size: 12,
                                            weight: "bold",
                                          },
                                        },
                                      },
                                    },
                                  }}
                                />
                              </div>
                            </div>
                            )}
                          </div>

                          {/* Section-wise Breakdown Table */}
                          {/* Section-wise Breakdown Table */}
<div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden transform hover:scale-[1.01] transition-all duration-500 hover:shadow-3xl">
  <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-6">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-2xl font-bold text-white flex items-center">
          <BarChart3 className="w-7 h-7 mr-3" />
          Section-wise Breakdown
        </h3>
        <p className="text-blue-100 mt-1">
          Detailed performance analysis by section with
          {showWeightageColumns ? " weightage calculations" : "out weightage"}
        </p>
      </div>
      
      {/* Add Weight Checkbox - Only show when all weightages are 0 */}
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
                  setEditingAllWeightages(true); // Enter edit mode for all rows
                  
                  // Initialize weightage values for all rows
                  const initialValues: Record<string, string> = {};
                  sectionSummaryRows.forEach(row => {
                    initialValues[row.id] = row.weightage.toString();
                  });
                  setWeightageValues(initialValues);
                } else {
                  setEditingAllWeightages(false);
                  setWeightageValues({});
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
          <div className="ml-3 text-xs text-white/80 bg-black/20 px-2 py-1 rounded">
            Total must be 100%
          </div>
        )}
      </div>
    )}
    
    {/* Toggle Weightage Visibility Button */}
    {sectionSummaryRows.reduce((sum, r) => sum + r.weightage, 0) > 0 && (
      <button
        onClick={() => setShowWeightageColumns(!showWeightageColumns)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ml-3 ${
          showWeightageColumns
            ? 'bg-indigo-400 hover:bg-indigo-500 text-white'
            : 'bg-gray-400 hover:bg-gray-500 text-white'
        }`}
        title={showWeightageColumns ? 'Hide weightage columns' : 'Show weightage columns'}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {showWeightageColumns ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-4.803m5.596-3.856a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0M15 12a3 3 0 11-6 0 3 3 0 016 0zm6 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-4.803m5.596-3.856a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0M15 12a3 3 0 11-6 0 3 3 0 016 0zm6 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          )}
        </svg>
        <span className="text-sm font-medium">
          {showWeightageColumns ? 'Hide' : 'Show'} Weightage
        </span>
      </button>
    )}

    {/* Edit Weightage Button - Show when weightage columns are visible */}
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
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors ml-3"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Edit Weightage
      </button>
    )}
    </div>
  </div>
  
  <div className="overflow-x-auto">
    <table className="w-full divide-y divide-blue-200 dark:divide-blue-800/50 text-sm">
      <thead className="bg-gradient-to-r from-blue-100/70 to-indigo-100/70 dark:from-blue-900/30 dark:to-indigo-900/20 sticky top-0">
        <tr>
          <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-48">
            Section
          </th>
          <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-20">
            Yes %
          </th>
          <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-20">
            No %
          </th>
          <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-20">
            N/A %
          </th>
          
          {/* Conditionally show weightage columns */}
          {showWeightageColumns && (
            <>
              <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-20">
                Weightage
              </th>
              <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-24">
                Yes % × Weightage
              </th>
              <th className="px6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-24">
                No % × Weightage
              </th>
              <th className="px-6 py-5 text-left font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider min-w-24">
                N/A % × Weightage
              </th>
            </>
          )}
        </tr>
      </thead>
      
    <tbody className="divide-y divide-blue-100 dark:divide-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10">
  {(() => {
    const totalWeightage = sectionSummaryRows.reduce((sum, r) => sum + r.weightage, 0);
    
    return (
      <>
        {sectionSummaryRows.map((row) => (
          <tr
            key={row.id}
            className="group hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-600 transition-all duration-300 bg-white dark:bg-gray-900"
          >
            <td className="px-6 py-5 font-bold text-gray-900 dark:text-gray-100 flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
              {row.title}
            </td>
            <td className="px-6 py-5 text-gray-700 dark:text-gray-300 font-medium">
              {row.yesPercent.toFixed(1)}%
            </td>
            <td className="px-6 py-5 text-gray-700 dark:text-gray-300 font-medium">
              {row.noPercent.toFixed(1)}%
            </td>
            <td className="px-6 py-5 text-gray-700 dark:text-gray-300 font-medium">
              {row.naPercent.toFixed(1)}%
            </td>
            
            {/* Conditionally render weightage columns */}
            {showWeightageColumns && (
              <>{/* Weightage Column */}
<td className="px-6 py-5 text-gray-700 dark:text-gray-300 font-medium">
  {redistributionMode ? (
    // Redistribution mode - editable input
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
      {/* Show difference indicator */}
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
    // Batch edit mode (when Add Weight is checked)
    <div className="flex flex-col items-center">
      <input
        type="number"
        min="0"
        max="100"
        step="0.1"
        value={weightageValues[row.id] !== undefined ? weightageValues[row.id] : row.weightage.toString()}
        onChange={(e) => {
          const newValue = e.target.value;
          const oldValue = parseFloat(weightageValues[row.id] !== undefined ? weightageValues[row.id] : row.weightage.toString()) || 0;
          const newNumericValue = parseFloat(newValue) || 0;

          // Update weightage values
          const updatedValues = {
            ...weightageValues,
            [row.id]: newValue
          };
          setWeightageValues(updatedValues);

          // Calculate total
          const total = Object.values(updatedValues).reduce((sum, val) => {
            return sum + (parseFloat(val) || 0);
          }, 0);

          // Show helpful message
          const difference = newNumericValue - oldValue;
          if (difference > 0) {
            console.log(`Increased by ${difference.toFixed(1)}%, new total: ${total.toFixed(1)}%`);
          } else if (difference < 0) {
            console.log(`Decreased by ${Math.abs(difference).toFixed(1)}%, new total: ${total.toFixed(1)}%`);
          }
        }}
        className="w-20 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 text-center"
      />
      {/* Show difference indicator */}
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
    // Display mode - just show the value
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
        <tr className="bg-gray-50 dark:bg-gray-800/50 font-bold border-t-2 border-blue-200 dark:border-blue-700">
          <td className="px-6 py-5 text-gray-900 dark:text-gray-100 flex items-center">
            <div className="w-3 h-3 bg-blue-600 rounded-full mr-3"></div>
            <span>TOTAL</span>
          </td>
          <td className="px-6 py-5 text-gray-900 dark:text-gray-100 font-bold">
            {summaryTotals.total > 0 ? ((summaryTotals.yes / summaryTotals.total) * 100).toFixed(1) : 0}%
          </td>
          <td className="px-6 py-5 text-gray-900 dark:text-gray-100 font-bold">
            {summaryTotals.total > 0 ? ((summaryTotals.no / summaryTotals.total) * 100).toFixed(1) : 0}%
          </td>
          <td className="px-6 py-5 text-gray-900 dark:text-gray-100 font-bold">
            {summaryTotals.total > 0 ? ((summaryTotals.na / summaryTotals.total) * 100).toFixed(1) : 0}%
          </td>
          {showWeightageColumns && (
            <>
              <td className="px-6 py-5 text-center">
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

        {/* Batch Edit Controls */}
       {editingAllWeightages && (
  <div className="flex items-center gap-2 ml-4">
    <button
      onClick={async () => {
        // Save all batch weightages
        setSavingWeightage(true);
        try {
          const formId = selectedForm._id || selectedForm.id;
          if (!formId) throw new Error("Form ID not found");
          
          // Calculate total from batch values
          const batchTotal = sectionSummaryRows.reduce((sum, row) => {
            const val = parseFloat(weightageValues[row.id] || row.weightage.toString()) || 0;
            return sum + val;
          }, 0);
          
          // Validate total is exactly 100%
          if (Math.abs(batchTotal - 100) > 0.1) {
            throw new Error(`Total weightage must be exactly 100%. Current: ${batchTotal.toFixed(1)}%`);
          }
          
          // Update all sections
          const updatedSections = selectedForm.sections?.map((section: any) => {
            const row = sectionSummaryRows.find(r => r.id === section.id);
            if (row && weightageValues[row.id] !== undefined) {
              return { 
                ...section, 
                weightage: parseFloat(weightageValues[row.id]) || 0 
              };
            }
            return section;
          }) || [];
          
          const formDataToUpdate = { ...selectedForm, sections: updatedSections };
          delete formDataToUpdate._id;
          delete formDataToUpdate.__v;
          delete formDataToUpdate.createdAt;
          delete formDataToUpdate.updatedAt;
          
          await apiClient.updateForm(formId, formDataToUpdate);
          
          // Update local state
          setSelectedForm({ ...selectedForm, sections: updatedSections });
          setEditingAllWeightages(false);
          setAddWeightMode(false);
          setWeightageValues({});
          
          showSuccess("All weightages saved successfully!");
        } catch (error) {
          console.error("Failed to save weightages:", error);
          showError(error instanceof Error ? error.message : "Failed to save weightages");
        } finally {
          setSavingWeightage(false);
        }
      }}
      disabled={savingWeightage}
      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-1"
    >
      {savingWeightage ? (
        <>
          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Saving...
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Save All
        </>
      )}
    </button>
    
    <button
      onClick={() => {
        setEditingAllWeightages(false);
        setWeightageValues({});
        // Check if we should also disable Add Weight mode
        if (calculateTotalWeightage === 0) {
          setAddWeightMode(false);
        }
      }}
      className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
    >
      Cancel
    </button>
  </div>
)}
        
        {/* Status Message Row - Only show when weightage columns are visible and in redistribution mode */}
        {showWeightageColumns && redistributionMode && (
          <tr className="bg-white dark:bg-gray-900">
            <td colSpan={9} className="px-6 py-4">
              <div className="flex items-center justify-center">
                <span className={Math.abs(weightageBalance) < 0.1 ? "text-green-600 dark:text-green-400 font-medium" : "text-yellow-600 dark:text-yellow-400 font-medium"}>
                  {Math.abs(weightageBalance) < 0.1 ?
                    '✓ Ready to save' :
                    `Adjust by ${Math.abs(weightageBalance).toFixed(1)}% to reach 100%`}
                </span>

                <div className="flex items-center gap-2 ml-4">
                  {/* Reset Button */}
                  <button
                    onClick={() => {
                      const resetValues: Record<string, string> = {};
                      sectionSummaryRows.forEach(row => {
                        resetValues[row.id] = row.weightage.toString();
                      });
                      setTempWeightageValues(resetValues);
                      const total = sectionSummaryRows.reduce((sum, row) => sum + row.weightage, 0);
                      setWeightageBalance(100 - total);
                    }}
                    className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-1"
                    title="Reset to original values"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reset
                  </button>

                  {/* Cancel Button */}
                  <button
                    onClick={() => {
                      setRedistributionMode(false);
                      const originalValues: Record<string, string> = {};
                      sectionSummaryRows.forEach(row => {
                        originalValues[row.id] = row.weightage.toString();
                      });
                      setTempWeightageValues(originalValues);
                      setWeightageBalance(0);
                    }}
                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    title="Cancel redistribution"
                  >
                    Cancel
                  </button>

                  {/* Save Changes Button */}
                  <button
                    onClick={async () => {
                      if (Math.abs(weightageBalance) >= 0.1) {
                        showError(`Cannot save: Balance must be 0%. Current: ${weightageBalance.toFixed(1)}%`);
                        return;
                      }

                      setSavingWeightage(true);
                      try {
                        // Save all weightages
                        const formId = selectedForm?._id || selectedForm?.id;
                        if (!formId) throw new Error("Form ID not found");

                        // Create updated sections with new weightages
                        const updatedSections = selectedForm?.sections?.map((section: any) => {
                          const row = sectionSummaryRows.find(r => r.id === section.id);
                          if (row && tempWeightageValues[row.id] !== undefined) {
                            return {
                              ...section,
                              weightage: parseFloat(tempWeightageValues[row.id]) || 0
                            };
                          }
                          return section;
                        }) || [];

                        const formDataToUpdate = { ...selectedForm, sections: updatedSections };
                        delete formDataToUpdate._id;
                        delete formDataToUpdate.__v;
                        delete formDataToUpdate.createdAt;
                        delete formDataToUpdate.updatedAt;

                        await apiClient.updateForm(formId, formDataToUpdate);

                        // Update local state
                        setSelectedForm({ ...selectedForm, sections: updatedSections });
                        setRedistributionMode(false);
                        setTempWeightageValues({});
                        setWeightageBalance(0);

                        showSuccess("Weightages redistributed successfully!");
                      } catch (error) {
                        console.error("Failed to save weightages:", error);
                        showError("Failed to save weightages. Please try again.");
                      } finally {
                        setSavingWeightage(false);
                      }
                    }}
                    disabled={Math.abs(weightageBalance) >= 0.1 || savingWeightage}
                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    title="Save all weightage changes"
                  >
                    {savingWeightage ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Save
                      </>
                    )}
                  </button>
                </div>
              </div>
            </td>
          </tr>
        )}
      </>
    );
  })()}
</tbody>
    </table>
  </div>
</div>

                          {/* Main Parameters and Subparameters - Section Wise */}
                          <div className="space-y-0">
                            {renderSectionWiseMainParameters()}
                          </div>

                          {/* Quick Actions */}
                          <div className="bg-gradient-to-br from-blue-50 via-white to-indigo-50/50 dark:from-blue-900/20 dark:via-gray-800 dark:to-indigo-900/15 p-6 rounded-2xl shadow-2xl border border-blue-200 dark:border-blue-800/50">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                              <Zap className="w-6 h-6 mr-3 text-yellow-500" />
                              Quick Actions
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <button
                                onClick={handleExportExcel}
                                disabled={exportingExcel}
                                className="flex items-center justify-center p-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50"
                              >
                                {exportingExcel ? (
                                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3" />
                                ) : (
                                  <Download className="w-5 h-5 mr-3" />
                                )}
                                {exportingExcel
                                  ? "Exporting..."
                                  : "Export Excel"}
                              </button>

                              <button
                                onClick={() => {
                                  setViewMode("responses");
                                }}
                                className="flex items-center justify-center p-4 text-white rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:opacity-90"
                                style={{ backgroundColor: "#1e3a8a" }}
                              >
                                <Eye className="w-5 h-5 mr-3" />
                                View Details
                              </button>

                              <button
                                onClick={handleDownloadPDF}
                                disabled={generatingPDF}
                                className="flex items-center justify-center p-4 text-white rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed group hover:opacity-90"
                                style={{ backgroundColor: "#0891b2" }}
                              >
                                {generatingPDF ? (
                                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3" />
                                ) : (
                                  <FileText className="w-5 h-5 mr-3 group-hover:animate-pulse" />
                                )}
                                {generatingPDF
                                  ? "Generating PDF..."
                                  : "Download PDF"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                    {viewMode === "responses" && renderFormContent()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {editingResponse && editingFormLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50/60 dark:from-blue-900/30 dark:to-indigo-900/20 rounded-lg shadow-xl px-6 py-4 flex items-center gap-3 border border-blue-200 dark:border-blue-800">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <div className="text-blue-600 dark:text-blue-400 font-medium">
              Loading form details...
            </div>
          </div>
        </div>
      )}

      {editingResponse &&
        editingResponsePayload &&
        editingQuestionPayload &&
        !editingFormLoading && (
          <ResponseEdit
            response={editingResponsePayload as any}
            question={editingQuestionPayload as any}
            onSave={handleSaveEditedResponse}
            onCancel={handleCloseEdit}
          />
        )}
       
    </div>
  );
}