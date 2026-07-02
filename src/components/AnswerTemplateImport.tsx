import React, { useState, useRef, ChangeEvent, useEffect } from "react";
import {
  Download,
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  FileText,
  Send,
  Loader,
  AlertTriangle,
  Image as ImageIcon,
} from "lucide-react";
import { useForms } from "../hooks/useApi";
import { apiClient } from "../api/client";
import { useNotification } from "../context/NotificationContext";
import {
  generateAnswerTemplate,
  parseAnswerWorkbook,
  isImageUrl,
  isGoogleDriveUrl,
  isCloudinaryUrl,
} from "../utils/answerTemplateUtils";
import type { Question } from "../types";
import ImagePreviewGrid from "./ImagePreviewGrid";
import SubmissionProgressModal from "./SubmissionProgressModal";
import { io } from "socket.io-client";

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

  const forms = formsData?.forms || [];
  const parentForms = Array.from(
    new Map(
      forms
        .filter((form) => !form.parentFormId)
        .map((form) => [form.id || form._id, form])
    ).values()
  ).sort((a, b) => (a.title || "").localeCompare(b.title || ""));

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

  const handleFormSelect = (formId: string) => {
    setSelectedFormId(formId);
    const form = parentForms.find((f) => (f.id || f._id) === formId);
    setSelectedForm(form || null);
    clearImportState();
  };

  const handleDownloadTemplate = () => {
    if (!selectedForm) {
      showError("Please select a form first", "Error");
      return;
    }
    try {
      generateAnswerTemplate(selectedForm);
      showSuccess("Template downloaded successfully", "Success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to download template";
      showError(message, "Download Failed");
    }
  };

  const clearImportState = () => {
    setParsedResponses(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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

  const handleImportClick = () => {
    if (isImporting || !selectedForm) return;
    fileInputRef.current?.click();
  };

  const getTotalImageCount = () => {
    if (!parsedResponses) return 0;
    return parsedResponses.reduce((acc, response) => {
      return acc + Object.values(response.answers).filter(val => typeof val === 'string' && isImageUrl(val)).length;
    }, 0);
  };

  const handleFinalSubmit = async () => {
    if (!selectedForm || !parsedResponses) {
      showError("Missing form or parsed responses", "Error");
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
      const responsePayload = {
        questionId: selectedForm.id || selectedForm._id,
        batchId: newBatchId,
        responses: parsedResponses,
      };

      await apiClient.batchImportResponses(responsePayload);

      setProgressStatus("complete");
      setProgressMessage("✓ All responses submitted successfully!");
      showSuccess("Import Completed Successfully", "Success");

      setTimeout(() => {
        onSuccess?.();
        onClose();
        clearImportState();
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
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                1. Select Form
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
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                    2. Download & Fill Template
                  </label>
                  <button onClick={handleDownloadTemplate} className="w-full btn-secondary flex items-center justify-center gap-2">
                    <Download className="w-5 h-5" />
                    Download Template for "{selectedForm.title}"
                  </button>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                    3. Upload Filled Template
                  </label>
                  <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileInputChange} />
                  <button onClick={handleImportClick} disabled={isImporting} className="w-full btn-primary flex items-center justify-center gap-2">
                    {isImporting ? <Loader className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    {isImporting ? 'Parsing File...' : 'Upload File'}
                  </button>
                </div>
              </>
            )}

            {parsedResponses && (
              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-900/30 border-2 border-emerald-200 dark:border-emerald-700 rounded-xl p-4">
                  <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">File Parsed Successfully</h3>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                      Found <strong>{parsedResponses.length}</strong> responses to import.
                    </p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                      Found <strong>{getTotalImageCount()}</strong> total images.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button onClick={clearImportState} disabled={isSubmitting} className="btn-secondary w-1/2">
                    Back
                  </button>
                  <button onClick={handleFinalSubmit} disabled={isSubmitting} className="btn-primary w-1/2 flex items-center justify-center gap-2">
                    {isSubmitting ? <Loader className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    {isSubmitting ? 'Submitting...' : `Submit ${parsedResponses.length} Responses`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
