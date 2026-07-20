import React, { useState, useRef, ChangeEvent, useEffect } from "react";
import {
  Download,
  Upload,
  X,
  CheckCircle,
  FileText,
  Send,
  Loader,
  AlertTriangle,
  Link2,
} from "lucide-react";
import { useForms } from "../hooks/useApi";
import { apiClient } from "../api/client";
import { useNotification } from "../context/NotificationContext";
import {
  generateAnswerTemplate,
  generateFollowUpAnswerTemplate,
  parseAnswerWorkbook,
  isImageUrl,
} from "../utils/answerTemplateUtils";
import type { Question } from "../types";
import SubmissionProgressModal from "./SubmissionProgressModal";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";

interface AnswerTemplateImportProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}


export default function AnswerTemplateImport({
  isOpen,
  onClose,
  onSuccess,
}: AnswerTemplateImportProps) {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const { data: formsData } = useForms();
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const [selectedForm, setSelectedForm] = useState<Question | null>(null);
  const [parsedResponses, setParsedResponses] = useState<any[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressStatus, setProgressStatus] = useState<
    "idle" | "processing" | "converting" | "uploading" | "complete" | "error"
  >("idle");
  const [progressMessage, setProgressMessage] = useState("");
  const [currentImage, setCurrentImage] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [progressError, setProgressError] = useState<string>();
  const [submissionId, setSubmissionId] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<any>(null);
  const [batchId, setBatchId] = useState<string>();
  const [allInspectors, setAllInspectors] = useState<any[]>([]);

  // ── Template 2 form state ─────────────────────────────────────────────────
  const [selectedForm2Id, setSelectedForm2Id] = useState<string>("");
  const [selectedForm2, setSelectedForm2] = useState<Question | null>(null);
  const [parsedResponses2, setParsedResponses2] = useState<any[] | null>(null);
  const [isImporting2, setIsImporting2] = useState(false);
  const fileInputRef2 = useRef<HTMLInputElement | null>(null);

  // ── Follow-up form state ──────────────────────────────────────────────────
  // Map: childFormId → { parsedResponses, isImporting, fileInputRef }
  const [followUpStates, setFollowUpStates] = useState<
    Record<string, { parsedResponses: any[] | null; isImporting: boolean }>
  >({});
  // We keep one ref-map outside state to avoid re-render issues
  const followUpFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!isOpen) return;
    const fetchInspectors = async () => {
      try {
        const res = await apiClient.getUsersHierarchy({ role: "Inspector" });
        if (res && res.users) {
          setAllInspectors(res.users);
        }
      } catch (err) {
        console.error("Error fetching inspectors in import modal:", err);
      }
    };
    fetchInspectors();
  }, [isOpen]);

  const forms = formsData?.forms || [];
  const parentForms = Array.from(
    new Map(
      forms
        .filter((form) => !form.parentFormId)
        .map((form) => [form.id || form._id, form])
    ).values()
  ).sort((a, b) => (a.title || "").localeCompare(b.title || ""));

  // Derive child/follow-up forms for the selected parent
  const childForms: Question[] = selectedForm
    ? (forms.filter(
        (f) =>
          f.parentFormId &&
          (f.parentFormId === (selectedForm.id || (selectedForm as any)._id))
      ) as unknown as Question[])
    : [];

  // Socket connection logic
  useEffect(() => {
    if (!isOpen) return;
    const getSocketUrl = () => {
      const apiBase = import.meta.env.VITE_API_BASE_URL;
      if (apiBase) {
        const url = apiBase.replace("/api", "");
        return url;
      }
      return window.location.origin.replace(/:[0-9]+$/, ":5000");
    };

    const socketUrl = getSocketUrl();
    const socket = io(socketUrl, {
      reconnection: true,
      transports: ["websocket", "polling"],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => console.log("✅ Connected to socket server"));
    socket.on("connect_error", (error: any) => console.error("❌ Socket connection error:", error));
    socket.on("disconnect", (reason: string) => console.log("⚠️ Socket disconnected:", reason));

    socket.on("image-progress", (data: any) => {
      if (data.submissionId === submissionId || data.batchId === batchId) {
        setProgressMessage(data.message || "Processing...");
        setCurrentImage(data.currentImage || data.processed || 0);
        setTotalImages(data.totalImages || data.total || 0);
        setProgressStatus(data.status || "processing");
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [isOpen, submissionId, batchId]);

  const clearImportState = () => {
    setParsedResponses(null);
    setParsedResponses2(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (fileInputRef2.current) {
      fileInputRef2.current.value = "";
    }
  };

  const handleFormSelect = (formId: string) => {
    setSelectedFormId(formId);
    const form = parentForms.find((f) => (f.id || f._id) === formId);
    setSelectedForm(form || null);
    // Template 2 (Follow-up) always uses the same form as the Main form,
    // so both templates are shown for a single form selection.
    setSelectedForm2Id(formId);
    setSelectedForm2(form || null);
    clearImportState();
    setFollowUpStates({});
    followUpFileInputRefs.current = {};
  };

  const handleDownloadTemplate = async () => {
    if (!selectedForm) {
      showError("Please select a form first", "Error");
      return;
    }
    try {
      await generateAnswerTemplate(selectedForm, allInspectors);
      showSuccess("Template downloaded successfully", "Success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to download template";
      showError(message, "Download Failed");
    }
  };

  const handleDownloadFollowUpTemplate = async (childForm: Question) => {
    try {
      await generateAnswerTemplate(childForm, allInspectors);
      showSuccess(`Follow-up template for "${childForm.title}" downloaded`, "Success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to download follow-up template";
      showError(message, "Download Failed");
    }
  };

  const handleFileInputChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !selectedForm) return;

    setIsImporting(true);
    setProgressStatus("processing");
    setProgressMessage("Parsing Excel file...");
    clearImportState();

    try {
      const responses = await parseAnswerWorkbook(file, selectedForm, (current, total, message) => {
        setCurrentImage(current);
        setTotalImages(total);
        setProgressMessage(message);
      });
      setParsedResponses(responses);

      setProgressStatus("complete");
      setProgressMessage(`✓ ${responses.length} response(s) loaded successfully!`);
      showSuccess("Template parsed successfully!", "Parse Complete");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to import template";
      setProgressStatus("error");
      setProgressError(message);
      showError(message, "Import Failed");
      clearImportState();
    } finally {
      setIsImporting(false);
    }
  };

  // ── Follow-up file handler ─────────────────────────────────────────────────
  const handleFollowUpFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
    childForm: Question
  ) => {
    const file = event.target.files?.[0];
    const childId = childForm.id || (childForm as any)._id;
    if (!file || !childForm) return;

    setFollowUpStates((prev) => ({
      ...prev,
      [childId]: { ...(prev[childId] || {}), parsedResponses: null, isImporting: true },
    }));

    try {
      const responses = await parseAnswerWorkbook(file, childForm);
      setFollowUpStates((prev) => ({
        ...prev,
        [childId]: { parsedResponses: responses, isImporting: false },
      }));
      showSuccess(`Follow-up template parsed: ${responses.length} response(s) loaded`, "Parse Complete");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to parse follow-up template";
      setFollowUpStates((prev) => ({
        ...prev,
        [childId]: { parsedResponses: null, isImporting: false },
      }));
      showError(message, "Follow-up Import Failed");
    } finally {
      // Clear the file input so the same file can be re-selected
      const el = followUpFileInputRefs.current[childId];
      if (el) el.value = "";
    }
  };

  const handleImportClick = () => {
    if (isImporting || !selectedForm) return;
    fileInputRef.current?.click();
  };

  // ── Template 2 handlers ───────────────────────────────────────────────────
  const handleDownloadTemplate2 = async () => {
    if (!selectedForm2) {
      showError("Please select a form first", "Error");
      return;
    }
    try {
      await generateFollowUpAnswerTemplate(selectedForm2, allInspectors);
      showSuccess("Follow-up Template 2 downloaded successfully", "Success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to download template";
      showError(message, "Download Failed");
    }
  };

  const clearImportState2 = () => {
    setParsedResponses2(null);
    if (fileInputRef2.current) {
      fileInputRef2.current.value = "";
    }
  };

  const handleFileInputChange2 = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedForm2) return;

    setIsImporting2(true);
    try {
      const responses = await parseAnswerWorkbook(file, selectedForm2);
      setParsedResponses2(responses);
      showSuccess("Template 2 parsed successfully!", "Parse Complete");
    } catch (error: any) {
      const message = error instanceof Error ? error.message : "Failed to import template";
      showError(message, "Import Failed");
      clearImportState2();
    } finally {
      setIsImporting2(false);
    }
  };

  const handleImportClick2 = () => {
    if (isImporting2 || !selectedForm2) return;
    fileInputRef2.current?.click();
  };

  const getTotalImageCount2 = () => {
    if (!parsedResponses2) return 0;
    return parsedResponses2.reduce((acc, response) => {
      return acc + Object.values(response.answers).filter(val => typeof val === 'string' && isImageUrl(val)).length;
    }, 0);
  };

  // ── Template 2 handlers end ───────────────────────────────────────────────

  const getTotalImageCount = () => {
    if (!parsedResponses) return 0;
    return parsedResponses.reduce((acc, response) => {
      return acc + Object.values(response.answers).filter(val => typeof val === 'string' && isImageUrl(val)).length;
    }, 0);
  };

  // Check if all child forms with required follow-up data are ready
  const allRequiredFollowUpsUploaded = childForms.every((cf) => {
    const childId = cf.id || (cf as any)._id;
    // If no follow-up was uploaded for this child, it's still OK (not enforced per-row)
    // But warn: at least must have parsed responses if child form exists
    return true; // Not blocking submission; users may skip a specific child form upload
  });

  const handleFinalSubmit = async () => {
    if (!selectedForm || (!parsedResponses && !parsedResponses2)) {
      showError("Please upload at least one template (Main or Template 2)", "Error");
      return;
    }

    setIsSubmitting(true);
    setProgressStatus("uploading");
    setProgressMessage("Submitting responses to backend...");

    const newBatchId = `batch-${Date.now()}`;
    setBatchId(newBatchId);

    if (socketRef.current) {
      socketRef.current.emit("join-submission", newBatchId);
    }
    
    try {
      const submitResults: any[] = [];

      // 1. Submit main form responses (only if there is data)
      if (parsedResponses && parsedResponses.length > 0 && selectedForm) {
        const responsePayload = {
          questionId: selectedForm.id || (selectedForm as any)._id,
          batchId: newBatchId,
          responses: parsedResponses,
        };
        submitResults.push(await apiClient.batchImportResponses(responsePayload));
      }

      // 2. Submit Template 2 responses (if any)
      if (parsedResponses2 && parsedResponses2.length > 0 && selectedForm2) {
        const t2Payload = {
          questionId: selectedForm2.id || (selectedForm2 as any)._id,
          batchId: `${newBatchId}-t2`,
          responses: parsedResponses2,
        };
        submitResults.push(await apiClient.batchImportResponses(t2Payload));
      }

      // 3. Submit each follow-up form's responses (if uploaded)
      const followUpSubmissions: Promise<any>[] = [];
      for (const childForm of childForms) {
        const childId = childForm.id || (childForm as any)._id;
        const childState = followUpStates[childId];
        if (childState?.parsedResponses && childState.parsedResponses.length > 0) {
          const childBatchId = `${newBatchId}-fu-${childId}`;
          const childPayload = {
            questionId: childId,
            batchId: childBatchId,
            responses: childState.parsedResponses,
          };
          followUpSubmissions.push(apiClient.batchImportResponses(childPayload));
        }
      }

      if (followUpSubmissions.length > 0) {
        submitResults.push(...(await Promise.all(followUpSubmissions)));
      }

      // Surface any per-row failures returned by the backend
      const failedRows = submitResults.reduce(
        (acc, r) => acc + (r?.failed ?? 0),
        0
      );
      const backendErrors = submitResults
        .flatMap((r) => (Array.isArray(r?.errors) ? r.errors : []))
        .filter(Boolean);

      if (failedRows > 0) {
        const detail =
          backendErrors.length > 0
            ? `: ${backendErrors
                .slice(0, 3)
                .map((e: any) => (typeof e === "string" ? e : e.error))
                .join(" | ")}`
            : "";
        throw new Error(
          `${failedRows} row(s) failed to import${detail}`
        );
      }

      setProgressStatus("complete");
      setProgressMessage("✓ All responses submitted successfully!");
      showSuccess("Import Completed Successfully", "Success");

      setTimeout(() => {
        onSuccess?.();
        onClose();
        clearImportState();
        setFollowUpStates({});
        if (selectedFormId) {
          navigate(`/forms/${selectedFormId}/analytics`);
        }
      }, 1500);

    } catch (error: any) {
      const message = error.response?.data?.message || error.message || "Failed to submit answers";
      setProgressStatus("error");
      setProgressError(message);
      showError(message, "Submission Failed");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!isOpen) {
    return null;
  }

  return (
    <>
      <SubmissionProgressModal
        isOpen={progressStatus !== "idle" && progressStatus !== 'complete' && progressStatus !== 'error'}
        status={progressStatus}
        currentImage={currentImage}
        totalImages={totalImages}
        currentMessage={progressMessage}
        errorMessage={progressError}
      />
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 px-8 py-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Bulk Response Import</h2>
            <button onClick={onClose} disabled={isSubmitting} className="p-2 hover:bg-white/20 rounded-lg text-white disabled:opacity-50">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-6">
            {/* ── Step 1: Select Form ── */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                1. Select Main Form
              </label>
              <select
                value={selectedFormId}
                onChange={(e) => handleFormSelect(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Choose a form --</option>
                {parentForms.map((form) => (
                  <option key={form.id || form._id} value={form.id || form._id}>
                    {form.title}
                  </option>
                ))}
              </select>
            </div>

            {selectedForm && (
              <>
                {/* ── Step 2: Main Form Template ── */}
                <div className="rounded-xl border-2 border-blue-100 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 p-5 space-y-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                          {selectedForm?.title} — Main Form
                        </span>
                        <span className="ml-auto text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                          Primary
                        </span>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                          Download &amp; Fill Template
                        </label>
                        <button onClick={handleDownloadTemplate} className="w-full btn-secondary flex items-center justify-center gap-2">
                          <Download className="w-5 h-5" />
                          {selectedForm && `Download Template for "${selectedForm.title}"`}
                        </button>
                      </div>
                     
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                          Upload Filled Template
                        </label>
                    <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileInputChange} />
                    <button onClick={handleImportClick} disabled={isImporting} className="w-full btn-primary flex items-center justify-center gap-2">
                      {isImporting ? <Loader className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                      {isImporting ? 'Parsing File...' : 'Upload File'}
                    </button>
                  </div>

                  {parsedResponses && (
                    <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-900/30 border-2 border-emerald-200 dark:border-emerald-700 rounded-xl p-4">
                      <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                          Main form: {parsedResponses.length} response(s) ready
                        </p>
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                          {getTotalImageCount()} image(s) detected
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Template 2 (Optional Secondary Form) ── */}
                <div className="rounded-xl border-2 border-purple-100 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/30 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    {selectedForm2 && (selectedForm2.id || (selectedForm2 as any)._id) === selectedFormId ? (
                      <span className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                        Template 2 — Follow-up Questions
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                        Template 2 — Secondary Form (Optional)
                      </span>
                    )}
                  </div>

                  {selectedForm2 && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                          {(selectedForm2.id || (selectedForm2 as any)._id) === selectedFormId
                            ? "Download & Fill Follow-up Template"
                            : "Download & Fill Template 2"}
                        </label>
                        <button onClick={handleDownloadTemplate2} className="w-full btn-secondary flex items-center justify-center gap-2">
                          <Download className="w-5 h-5" />
                          {(selectedForm2.id || (selectedForm2 as any)._id) === selectedFormId
                            ? `Download Follow-up Template for "${selectedForm2.title}"`
                            : `Download Template for "${selectedForm2.title}"`}
                        </button>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                          Upload Filled Template
                        </label>
                        <input ref={fileInputRef2} type="file" accept=".xlsx" className="hidden" onChange={handleFileInputChange2} />
                        <button onClick={handleImportClick2} disabled={isImporting2} className="w-full btn-primary flex items-center justify-center gap-2">
                          {isImporting2 ? <Loader className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                          {isImporting2 ? 'Parsing File...' : 'Upload File'}
                        </button>
                      </div>

                      {parsedResponses2 && (
                        <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-900/30 border-2 border-emerald-200 dark:border-emerald-700 rounded-xl p-4">
                          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                              {(selectedForm2.id || (selectedForm2 as any)._id) === selectedFormId
                                ? "Follow-up:"
                                : "Template 2:"} {parsedResponses2.length} response(s) ready
                            </p>
                            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                              {getTotalImageCount2()} image(s) detected
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* ── Follow-up Templates (mandatory if child forms exist) ── */}
                {childForms.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                        Follow-up Questions Detected
                      </span>
                      <span className="ml-auto text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full">
                        {childForms.length} required
                      </span>
                    </div>

                    {childForms.map((childForm, idx) => {
                      const childId = childForm.id || (childForm as any)._id;
                      const childState = followUpStates[childId] || { parsedResponses: null, isImporting: false };

                      return (
                        <div
                          key={childId}
                          className="rounded-xl border-2 border-amber-100 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/30 p-5 space-y-4"
                        >
                          <div className="flex items-center gap-2">
                            <Link2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                              {childForm.title}
                            </span>
                            <span className="ml-auto text-xs bg-amber-600 text-white px-2 py-0.5 rounded-full">
                              Mandatory
                            </span>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                              Form: <span className="text-amber-700 dark:text-amber-300">{childForm.title}</span>
                            </label>
                            <button
                              onClick={() => handleDownloadFollowUpTemplate(childForm)}
                              className="w-full btn-secondary flex items-center justify-center gap-2 text-sm"
                            >
                              <Download className="w-4 h-4" />
                              Download Follow-up Template for "{childForm.title}"
                            </button>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                              Upload filled follow-up template
                            </label>
                            {/* Hidden file input per child form */}
                            <input
                              ref={(el) => { followUpFileInputRefs.current[childId] = el; }}
                              type="file"
                              accept=".xlsx"
                              className="hidden"
                              onChange={(e) => handleFollowUpFileChange(e, childForm)}
                            />
                            <button
                              onClick={() => followUpFileInputRefs.current[childId]?.click()}
                              disabled={childState.isImporting}
                              className="w-full btn-primary flex items-center justify-center gap-2 text-sm"
                            >
                              {childState.isImporting
                                ? <Loader className="w-4 h-4 animate-spin" />
                                : <Upload className="w-4 h-4" />}
                              {childState.isImporting ? 'Parsing...' : 'Upload Follow-up File'}
                            </button>
                          </div>

                          {childState.parsedResponses && (
                            <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-900/30 border-2 border-emerald-200 dark:border-emerald-700 rounded-xl p-3">
                              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                                {childState.parsedResponses.length} follow-up response(s) ready
                              </p>
                            </div>
                          )}

                          {!childState.parsedResponses && !childState.isImporting && (
                            <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
                              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-amber-700 dark:text-amber-300">
                                This follow-up form has no data uploaded yet. Please download, fill, and upload the template above.
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Submit / Back section ── */}
                {(parsedResponses || parsedResponses2) && (
                  <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    {/* Summary card */}
                    <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-900/30 border-2 border-emerald-200 dark:border-emerald-700 rounded-xl p-4">
                      <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">Ready to Submit</h3>
                        <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                          Main: <strong>{parsedResponses?.length ?? 0}</strong> response(s)
                          {" · "}Template 2:{" "}
                          <strong>
                            {selectedForm2 ? (parsedResponses2?.length ?? 0) : 0}
                          </strong> response(s)
                          {childForms.length > 0 && (
                            <>
                              {" · "}Follow-ups:{" "}
                              {childForms.map((cf, i) => {
                                const childId = cf.id || (cf as any)._id;
                                const count = followUpStates[childId]?.parsedResponses?.length ?? 0;
                                return (
                                  <strong key={childId}>
                                    {i > 0 ? ", " : ""}
                                    {cf.title}: {count}
                                  </strong>
                                );
                              })}
                            </>
                          )}
                        </p>
                        <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                          Total images: <strong>{getTotalImageCount() + getTotalImageCount2()}</strong>
                        </p>
                      </div>
                    </div>

                    {/* Warning if any child form has no data */}
                    {childForms.some((cf) => {
                      const childId = cf.id || (cf as any)._id;
                      return !followUpStates[childId]?.parsedResponses;
                    }) && (
                      <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          Some follow-up templates have not been uploaded. You can still submit, but those follow-up responses will be skipped.
                        </p>
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <button onClick={clearImportState} disabled={isSubmitting} className="btn-secondary w-1/2">
                        Back
                      </button>
                      <button onClick={handleFinalSubmit} disabled={isSubmitting} className="btn-primary w-1/2 flex items-center justify-center gap-2">
                        {isSubmitting ? <Loader className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        {isSubmitting ? 'Submitting...' : 'Submit All Responses'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
