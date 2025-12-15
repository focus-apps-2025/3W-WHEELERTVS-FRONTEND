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
  formatAnswersForSubmission,
  ParsedAnswers,
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
  const [parsedAnswers, setParsedAnswers] = useState<ParsedAnswers | null>(
    null
  );
  const [isImporting, setIsImporting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [progressStatus, setProgressStatus] = useState<
    "idle" | "processing" | "converting" | "uploading" | "complete" | "error"
  >("idle");
  const [progressMessage, setProgressMessage] = useState("");
  const [currentImage, setCurrentImage] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [progressError, setProgressError] = useState<string>();
  const [submissionId, setSubmissionId] = useState<string>();
  const [finalAnswers, setFinalAnswers] = useState<ParsedAnswers | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<any>(null);
  const [batchId, setBatchId] = useState<string>();
  const [batchStatus, setBatchStatus] = useState<any>();
  const [isImageConversionDone, setIsImageConversionDone] = useState(false);
  const [imageConversionStats, setImageConversionStats] = useState<{
    total: number;
    converted: number;
    status: string;
    batchId?: string;
  } | null>(null);

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
    const getSocketUrl = () => {
      const apiBase = import.meta.env.VITE_API_BASE_URL;
      if (apiBase) {
        const url = apiBase.replace("/api", "");
        console.log("📌 Using API base URL for socket:", url);
        return url;
      }

      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const port = window.location.port;

      if (hostname === "localhost" || hostname === "127.0.0.1") {
        return "http://localhost:5000";
      }

      return `${protocol}//${hostname}${port ? ":" + port : ""}`;
    };

    const socketUrl = getSocketUrl();
    console.log("🔌 Connecting to socket at:", socketUrl);

    const socket = io(socketUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      transports: ["websocket", "polling"],
      withCredentials: true,
      autoConnect: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Connected to socket server:", socket.id);
    });

    socket.on("connect_error", (error: any) => {
      console.error("❌ Socket connection error:", error);
    });

    socket.on("disconnect", (reason: string) => {
      console.log("⚠️ Socket disconnected:", reason);
    });

    socket.on("image-progress", (data: any) => {
      console.log("📊 Progress update:", data);

      if (data.submissionId === submissionId || data.batchId === batchId) {
        const current = data.currentImage || data.processed || 0;
        const total = data.totalImages || data.total || 0;
        const status = data.status || data.batchStatus || "processing";

        setCurrentImage(current);
        setTotalImages(total);
        setProgressStatus(status);

        let message = data.message || "Processing...";

        if (current > 0 && total > 0) {
          const remaining = total - current;
          const avgPerImage =
            current > 0
              ? (Date.now() - (window as any).conversionStartTime) /
                current /
                1000
              : 0;
          const estimatedSecondsRemaining = Math.ceil(remaining * avgPerImage);
          const estimatedTime =
            estimatedSecondsRemaining > 60
              ? `${Math.ceil(estimatedSecondsRemaining / 60)}m remaining`
              : `${estimatedSecondsRemaining}s remaining`;
          message = `${message} (${estimatedTime})`;
        }

        setProgressMessage(message);

        if (data.batchId === batchId) {
          setBatchStatus(data);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleFormSelect = (formId: string) => {
    setSelectedFormId(formId);
    const form = parentForms.find((f) => (f.id || f._id) === formId);
    setSelectedForm(form || null);
    setParsedAnswers(null);
    setFinalAnswers(null);
    setIsImageConversionDone(false);
    setImageConversionStats(null);
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
      const message =
        error instanceof Error ? error.message : "Failed to download template";
      showError(message || "Failed to download template", "Download Failed");
    }
  };

  const clearImportState = () => {
    setParsedAnswers(null);
    setFinalAnswers(null);
    setIsImageConversionDone(false);
    setImageConversionStats(null);
    setBatchId(undefined);
    setBatchStatus(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileInputChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !selectedForm) {
      return;
    }

    const isValidType =
      file.type ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.name.toLowerCase().endsWith(".xlsx");

    if (!isValidType) {
      showError("Please select a valid .xlsx file", "Invalid File");
      return;
    }

    setIsImporting(true);
    setProgressStatus("processing");
    setProgressMessage("Parsing Excel file...");
    clearImportState();

    try {
      // Step 1: Parse Excel file
      const answers = await parseAnswerWorkbook(
        file,
        selectedForm,
        (current, total, message) => {
          setCurrentImage(current);
          setTotalImages(total);
          setProgressMessage(message);
        }
      );

      // Store parsed answers immediately
      setParsedAnswers(answers);

      // Step 2: Check for Google Drive URLs (just for UI display)
      const googleDriveUrls = Object.entries(answers).filter(
        ([_, val]) => typeof val === "string" && isGoogleDriveUrl(String(val))
      );

      const totalImages = googleDriveUrls.length;

      if (totalImages === 0) {
        // No images to convert
        setFinalAnswers(answers);
        setIsImageConversionDone(true);
        setImageConversionStats({
          total: 0,
          converted: 0,
          status: "not_required",
        });
        setProgressStatus("complete");
        setProgressMessage("✓ Template imported successfully!");
        showSuccess("Template imported successfully!", "Import Complete");
        setIsImporting(false);
        return;
      }

      // Step 3: Show converting status (but conversion happens in backend automatically)
      setProgressStatus("converting");
      setProgressMessage(`Converting ${totalImages} images...`);
      setTotalImages(totalImages);
      setCurrentImage(0);
      setProgressError(undefined);

      // Generate batch ID
      const newBatchId = `batch-${Date.now()}`;
      setBatchId(newBatchId);

      // Join WebSocket room for this batch
      if (socketRef.current) {
        socketRef.current.emit("join-submission", newBatchId);
      }

      // Step 4: Format for submission - Backend will handle conversion
      const formattedData = formatAnswersForSubmission(selectedForm, answers);

      const formId = selectedForm.id || selectedForm._id;
      const responsePayload = {
        questionId: formId,
        batchId: newBatchId,
        responses: [
          {
            answers: formattedData.answers,
            submittedBy: formattedData.submittedBy || "Excel Import",
            submitterContact: formattedData.submitterContact,
            parentResponseId: formattedData.parentResponseId,
          },
        ],
      };

      // Step 5: Submit to backend - conversion happens automatically
      setProgressStatus("uploading");
      setProgressMessage("Uploading and converting images...");

      const data = await apiClient.batchImportResponses(responsePayload);

      // Step 6: Check backend conversion results
      if (data.data?.imageConversion) {
        const {
          total,
          converted,
          status,
          batchId: responseBatchId,
        } = data.data.imageConversion;

        setImageConversionStats({
          total,
          converted,
          status,
          batchId: responseBatchId,
        });

        if (status === "completed") {
          setIsImageConversionDone(true);
          setFinalAnswers(answers); // Use original answers - backend already converted them

          setProgressStatus("complete");
          setProgressMessage(`✓ ${converted} images converted successfully!`);

          if (converted > 0) {
            showSuccess(
              `Template imported with ${converted} images converted!`,
              "Import Complete"
            );
          } else {
            showSuccess("Template imported successfully!", "Import Complete");
          }
        }
      } else {
        // If backend doesn't return conversion stats, assume conversion happened
        setIsImageConversionDone(true);
        setFinalAnswers(answers);
        setProgressStatus("complete");
        setProgressMessage("✓ Template imported successfully!");
        showSuccess("Template imported successfully!", "Import Complete");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to import template";
      setProgressStatus("error");
      setProgressError(message);
      showError(message || "Failed to import template", "Import Failed");
      clearImportState();
    } finally {
      setIsImporting(false);
      setTimeout(() => {
        if (progressStatus !== "converting" && progressStatus !== "uploading") {
          setProgressStatus("idle");
        }
        setProgressMessage("");
        setCurrentImage(0);
        setTotalImages(0);
        setProgressError(undefined);
      }, 1500);
    }
  };

  const handleImportClick = () => {
    if (isImporting || !selectedForm) {
      return;
    }
    fileInputRef.current?.click();
  };

  const getImageAnswers = () => {
    if (!selectedForm || !parsedAnswers) {
      return [];
    }

    const imageAnswers: Array<{
      questionId: string;
      questionText: string;
      url: string;
      isConverted: boolean;
    }> = [];

    interface QuestionWithFollowUps {
      id: string;
      text?: string;
      type?: string;
      followUpQuestions?: QuestionWithFollowUps[];
    }

    const flattenQuestions = (
      questions: QuestionWithFollowUps[]
    ): QuestionWithFollowUps[] => {
      const flattened: QuestionWithFollowUps[] = [];
      questions.forEach((q) => {
        flattened.push(q);
        if (q.followUpQuestions && q.followUpQuestions.length > 0) {
          flattened.push(...flattenQuestions(q.followUpQuestions));
        }
      });
      return flattened;
    };

    selectedForm.sections.forEach((section) => {
      const allQuestions = flattenQuestions(section.questions);
      allQuestions.forEach((question) => {
        const answer = parsedAnswers[question.id];
        if (answer && isImageUrl(String(answer))) {
          const urlStr = String(answer);
          imageAnswers.push({
            questionId: question.id,
            questionText: question.text || "Image Question",
            url: urlStr,
            isConverted: isImageConversionDone || isCloudinaryUrl(urlStr),
          });
        }
      });
    });

    return imageAnswers;
  };

  const handleFinalSubmit = async () => {
    if (!selectedForm || !finalAnswers) {
      showError("Missing form or answers", "Error");
      return;
    }

    setIsSubmitting(true);
    setProgressStatus("uploading");
    setProgressMessage("Submitting answers to backend...");

    try {
      const formattedData = formatAnswersForSubmission(
        selectedForm,
        finalAnswers
      );

      const formId = selectedForm.id || selectedForm._id;

      const responsePayload = {
        questionId: formId,
        responses: [
          {
            answers: formattedData.answers,
            submittedBy: formattedData.submittedBy || "Excel Import",
            submitterContact: formattedData.submitterContact,
            parentResponseId: formattedData.parentResponseId,
          },
        ],
      };

      // IMPORTANT: Use batchImportResponses which already includes image conversion

      setProgressStatus("complete");
      setProgressMessage("✓ Answers submitted successfully!");

      showSuccess("Submission Complete");

      // Clean up and close
      setTimeout(() => {
        onSuccess?.();
        onClose();
        clearImportState();
      }, 1000);
    } catch (error: any) {
      const message = error.message || "Failed to submit answers";
      setProgressStatus("error");
      setProgressError(message);
      showError(message, "Submission Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPreviewImages = () => {
    if (!selectedForm || !parsedAnswers) return [];
    return getImageAnswers();
  };

  const getUnconvertedImageCount = () => {
    if (!parsedAnswers) return 0;

    // Count Google Drive URLs only if conversion is NOT done
    if (!isImageConversionDone) {
      return Object.values(parsedAnswers).filter(
        (val) => typeof val === "string" && isGoogleDriveUrl(String(val))
      ).length;
    }
    return 0; // All converted
  };

  const getConvertedImageCount = () => {
    if (!imageConversionStats) return 0;
    return imageConversionStats.converted;
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <SubmissionProgressModal
        isOpen={progressStatus !== "idle"}
        status={progressStatus}
        currentImage={currentImage}
        totalImages={totalImages}
        currentMessage={progressMessage}
        errorMessage={progressError}
      />
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 px-8 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Import Answers
                </h2>
                <p className="text-blue-100 text-sm">
                  Fill and submit your form responses
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting || isConverting}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-6">
            {/* Form Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                📋 Select a Form
              </label>
              <select
                value={selectedFormId}
                onChange={(e) => handleFormSelect(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-800 font-medium"
              >
                <option value="">-- Choose a form --</option>
                {parentForms.map((form) => (
                  <option key={form.id || form._id} value={form.id || form._id}>
                    {form.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Upload Flow */}
            {selectedForm && !parsedAnswers && (
              <div className="space-y-4">
                <div className="flex items-start gap-4 bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700 rounded-xl p-5">
                  <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-800">
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-200">
                      1
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                      Download Template
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Get the answer template for{" "}
                      <strong>{selectedForm.title}</strong>
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleDownloadTemplate}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl transition-all transform hover:scale-105 flex items-center justify-center gap-2 shadow-md"
                >
                  <Download className="w-5 h-5" />
                  Download Template (Excel)
                </button>

                <div className="flex items-center justify-center py-4">
                  <div className="flex-1 h-0.5 bg-gray-300 dark:bg-gray-600"></div>
                  <span className="px-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                    Next
                  </span>
                  <div className="flex-1 h-0.5 bg-gray-300 dark:bg-gray-600"></div>
                </div>

                <div className="flex items-start gap-4 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-5">
                  <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-lg bg-gray-200 dark:bg-gray-700">
                    <span className="text-lg font-bold text-gray-600 dark:text-gray-300">
                      2
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      Fill & Upload
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Complete the answer column in Excel and upload the file.
                      <span className="text-blue-600 dark:text-blue-400 font-medium">
                        {" "}
                        Images will be converted automatically.
                      </span>
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className="hidden"
                      onChange={handleFileInputChange}
                    />
                    <button
                      onClick={handleImportClick}
                      disabled={isImporting}
                      className="mt-3 w-full px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-xl transition-all transform hover:scale-105 flex items-center justify-center gap-2 shadow-md disabled:cursor-not-allowed disabled:scale-100"
                    >
                      {isImporting ? (
                        <>
                          <Loader className="w-5 h-5 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5" />
                          Upload Filled Template
                        </>
                      )}
                    </button>

                    {isImporting &&
                      (progressStatus === "processing" || totalImages > 0) && (
                        <div className="mt-4 space-y-2">
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                progressStatus === "complete"
                                  ? "bg-green-500"
                                  : progressStatus === "error"
                                  ? "bg-red-500"
                                  : "bg-gradient-to-r from-primary-500 to-primary-600"
                              }`}
                              style={{
                                width: `${
                                  totalImages > 0
                                    ? (currentImage / totalImages) * 100
                                    : progressStatus === "complete"
                                    ? 100
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                            <span>{progressMessage || "Processing..."}</span>
                            <span className="font-semibold">
                              {totalImages > 0
                                ? `${currentImage} of ${totalImages} images`
                                : progressStatus === "complete"
                                ? "Complete"
                                : "Processing..."}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
                            {totalImages > 0
                              ? Math.round((currentImage / totalImages) * 100)
                              : progressStatus === "complete"
                              ? 100
                              : 0}
                            % Complete
                          </p>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            )}

            {/* Preview Section */}
            {parsedAnswers && selectedForm && (
              <div className="space-y-5">
                {/* Status Banner */}
                <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-900/30 border-2 border-emerald-200 dark:border-emerald-700 rounded-xl p-4">
                  <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                      Template Ready to Submit
                    </p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                      ✓ {Object.keys(parsedAnswers).length} answer(s) loaded
                      successfully
                    </p>

                    {/* Show conversion status */}
                    {imageConversionStats &&
                      imageConversionStats.status === "completed" && (
                        <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                          ✅ {imageConversionStats.converted} image(s) converted
                          to Cloudinary
                        </p>
                      )}

                    {imageConversionStats &&
                      imageConversionStats.status === "not_required" && (
                        <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                          ✓ No images required conversion
                        </p>
                      )}

                    {/* Show warning only if conversion hasn't happened yet */}
                    {!isImageConversionDone &&
                      getUnconvertedImageCount() > 0 && (
                        <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                          ⏳ Processing {getUnconvertedImageCount()} image(s)...
                        </p>
                      )}
                  </div>
                </div>

                {/* Text Answers Preview */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Text Answers Preview
                  </h3>
                  <div className="space-y-3">
                    {selectedForm.sections.map((section, sectionIndex) =>
                      section.questions.map((question) => {
                        const answer = parsedAnswers[question.id];
                        if (answer && !isImageUrl(String(answer))) {
                          return (
                            <div
                              key={`${sectionIndex}-${question.id}`}
                              className="text-sm pb-3 border-b border-gray-200 dark:border-gray-700 last:border-0"
                            >
                              <p className="text-gray-800 dark:text-gray-200 font-semibold truncate">
                                {question.text}
                              </p>
                              <p className="text-gray-600 dark:text-gray-400 mt-1 text-xs bg-white dark:bg-gray-900 px-2 py-1 rounded inline-block">
                                {String(answer).substring(0, 80)}
                                {String(answer).length > 80 ? "..." : ""}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      })
                    )}
                  </div>
                </div>

                {/* Image Preview - Only show if there are images */}
                {getPreviewImages().length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
                      🖼️ Image Preview ({getPreviewImages().length})
                    </h3>
                    <div className="mb-3">
                      <div className="flex gap-2 mb-2">
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs rounded">
                          ✓ Cloudinary: {getConvertedImageCount()}
                        </span>
                        {!isImageConversionDone &&
                          getUnconvertedImageCount() > 0 && (
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded">
                              ⏳ Processing: {getUnconvertedImageCount()}
                            </span>
                          )}
                      </div>
                    </div>
                    <ImagePreviewGrid images={getPreviewImages()} />
                  </div>
                )}

                {/* Action Buttons - SIMPLIFIED: Only Back and Submit buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={clearImportState}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-gray-800 dark:text-white font-semibold rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ← Back
                  </button>

                  {/* ONLY SHOW SUBMIT BUTTON - No Convert button */}
                  <button
                    onClick={handleFinalSubmit}
                    disabled={isSubmitting || !isImageConversionDone}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-xl transition-all transform hover:scale-105 flex items-center justify-center gap-2 shadow-md disabled:cursor-not-allowed disabled:scale-100"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Submit & Save
                      </>
                    )}
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
