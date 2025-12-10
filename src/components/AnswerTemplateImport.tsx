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
  const [progressStatus, setProgressStatus] = useState<"idle" | "processing" | "converting" | "uploading" | "complete" | "error">("idle");
  const [progressMessage, setProgressMessage] = useState("");
  const [currentImage, setCurrentImage] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [progressError, setProgressError] = useState<string>();
  const [submissionId, setSubmissionId] = useState<string>();
  const [convertedAnswers, setConvertedAnswers] = useState<ParsedAnswers | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<any>(null);

  const forms = formsData?.forms || [];
  const parentForms = forms.filter((form) => !form.parentFormId);

  useEffect(() => {
    const getSocketUrl = () => {
      const apiBase = import.meta.env.VITE_API_BASE_URL;
      if (apiBase) {
        return apiBase.replace("/api", "");
      }
      
      const hostname = window.location.hostname;
      const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
      return isLocal ? "http://localhost:5000" : window.location.origin;
    };

    const socketUrl = getSocketUrl();
    console.log("🔌 Connecting to socket at:", socketUrl);
    
    const socket = io(socketUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Connected to socket server");
    });

    socket.on("connect_error", (error: any) => {
      console.error("❌ Socket connection error:", error);
    });

    socket.on("image-progress", (data: any) => {
      console.log("📊 Progress update:", data);
      if (data.submissionId === submissionId) {
        setCurrentImage(data.status.currentImage || 0);
        setTotalImages(data.status.totalImages || 0);
        setProgressMessage(data.status.message);
        setProgressStatus(data.status.status);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (submissionId && socketRef.current) {
      console.log("📤 Joining submission room:", submissionId);
      socketRef.current.emit("join-submission", submissionId);
      return () => {
        if (socketRef.current) {
          socketRef.current.emit("leave-submission", submissionId);
        }
      };
    }
  }, [submissionId]);

  const handleFormSelect = (formId: string) => {
    setSelectedFormId(formId);
    const form = parentForms.find((f) => (f.id || f._id) === formId);
    setSelectedForm(form || null);
    setParsedAnswers(null);
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
      showError(
        message || "Failed to download template",
        "Download Failed"
      );
    }
  };

  const handleFileInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!selectedForm) {
      showError("Please select a form first", "Error");
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

    try {
      const answers = await parseAnswerWorkbook(file, selectedForm);
      
      try {
        const processedAnswers = await apiClient.processImages(answers);
        setParsedAnswers(processedAnswers);
        showSuccess("Template imported successfully with images converted to Cloudinary!", "Import Complete");
      } catch (imageError) {
        console.warn('Image processing failed, using original answers:', imageError);
        setParsedAnswers(answers);
        showSuccess("Template imported but image conversion skipped", "Import Complete");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to import template";
      showError(
        message || "Failed to import template",
        "Import Failed"
      );
      setParsedAnswers(null);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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

    const flattenQuestions = (questions: QuestionWithFollowUps[]): QuestionWithFollowUps[] => {
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
            isConverted: isCloudinaryUrl(urlStr),
          });
        }
      });
    });

    return imageAnswers;
  };

  const convertedImages = parsedAnswers ? getImageAnswers().filter(img => img.isConverted) : [];
  const unconvertedImages = parsedAnswers ? getImageAnswers().filter(img => !img.isConverted) : [];

  const handleStartConversion = async () => {
    if (!selectedForm || !parsedAnswers) {
      showError("Missing form or answers", "Error");
      return;
    }

    const newSubmissionId = `submission-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    setSubmissionId(newSubmissionId);
    setIsConverting(true);
    setProgressStatus("converting");
    setProgressMessage("Starting image conversion...");
    setProgressError(undefined);
    
    const preventUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return false;
    };
    
    window.addEventListener('beforeunload', preventUnload);

    try {
      const imageAnswers = getImageAnswers();
      const unconvertedCount = imageAnswers.filter(img => !img.isConverted).length;
      
      if (unconvertedCount > 0) {
        setTotalImages(unconvertedCount);
      } else {
        setProgressStatus("complete");
        setProgressMessage("✓ All images already converted!");
        setConvertedAnswers(parsedAnswers);
        setIsConverting(false);
        window.removeEventListener('beforeunload', preventUnload);
        return;
      }

      const data = await apiClient.processImages(parsedAnswers);
      
      setConvertedAnswers(data);
      setProgressStatus("complete");
      setProgressMessage("✓ All images successfully converted!");
      
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to convert images";
      setProgressStatus("error");
      setProgressError(message);
      showError(message, "Conversion Failed");
      if (socketRef.current) {
        socketRef.current.emit("leave-submission", newSubmissionId);
      }
    } finally {
      setIsConverting(false);
      window.removeEventListener('beforeunload', preventUnload);
    }
  };

  const handleFinalSubmit = async () => {
    if (!selectedForm || !convertedAnswers) {
      showError("Missing form or converted answers", "Error");
      return;
    }

    setIsSubmitting(true);
    
    const preventUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return false;
    };
    
    window.addEventListener('beforeunload', preventUnload);

    try {
      const formattedData = formatAnswersForSubmission(
        selectedForm,
        convertedAnswers
      );
      const formId = selectedForm.id || selectedForm._id;

      const responsePayload = {
        questionId: formId,
        responses: [{
          answers: formattedData.answers,
          submittedBy: formattedData.submittedBy || "Excel Import",
          submitterContact: formattedData.submitterContact,
          parentResponseId: formattedData.parentResponseId
        }]
      };

      const data = await apiClient.batchImportResponses(responsePayload);

      showSuccess(
        `✓ ${data.imported} response(s) successfully saved with converted images!`,
        "Submission Complete"
      );
      
      setParsedAnswers(null);
      setConvertedAnswers(null);
      setSelectedFormId("");
      setSelectedForm(null);
      setProgressStatus("idle");
      setSubmissionId(undefined);

      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        window.removeEventListener('beforeunload', preventUnload);
        onClose();
      }, 1500);
    } catch (error) {
      window.removeEventListener('beforeunload', preventUnload);
      const message = error instanceof Error ? error.message : "Failed to submit answers";
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
              <h2 className="text-2xl font-bold text-white">Import Answers</h2>
              <p className="text-blue-100 text-sm">Fill and submit your form responses</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
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

          {selectedForm && !parsedAnswers && (
            <div className="space-y-4">
              <div className="flex items-start gap-4 bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700 rounded-xl p-5">
                <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-800">
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-200">1</span>
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">Download Template</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Get the answer template for <strong>{selectedForm.title}</strong>
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
                <span className="px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Next</span>
                <div className="flex-1 h-0.5 bg-gray-300 dark:bg-gray-600"></div>
              </div>

              <div className="flex items-start gap-4 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-5">
                <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-lg bg-gray-200 dark:bg-gray-700">
                  <span className="text-lg font-bold text-gray-600 dark:text-gray-300">2</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Fill & Upload</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Complete the answer column in Excel and upload the file
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
                </div>
              </div>
            </div>
          )}

          {parsedAnswers && selectedForm && (
            <div className="space-y-5">
              <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-900/30 border-2 border-emerald-200 dark:border-emerald-700 rounded-xl p-4">
                <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                    Template Ready to Submit
                  </p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                    ✓ {Object.keys(parsedAnswers).length} answer(s) loaded successfully
                  </p>
                </div>
              </div>

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
                          <div key={`${sectionIndex}-${question.id}`} className="text-sm pb-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
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

              {convertedImages.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700 rounded-xl p-4">
                    <CheckCircle className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-blue-900 dark:text-blue-100">
                        Images Extracted & Saved to Cloudinary
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        ✓ {convertedImages.length} image(s) converted from Google Drive and uploaded to Cloudinary
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
                      🖼️ Image Preview ({convertedImages.length})
                    </h3>
                    <ImagePreviewGrid images={convertedImages} />
                  </div>
                </div>
              )}

              {unconvertedImages.length > 0 && !convertedAnswers && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-200 dark:border-amber-700 rounded-xl p-4">
                    <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-900 dark:text-amber-100">
                        Google Drive Images (Ready to Convert)
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        ⏳ {unconvertedImages.length} image(s) from Google Drive - Click "Start Converting Images" to begin
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
                      🖼️ Google Drive Images ({unconvertedImages.length})
                    </h3>
                    <ImagePreviewGrid images={unconvertedImages} />
                  </div>
                </div>
              )}

              {convertedAnswers && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-900/30 border-2 border-emerald-200 dark:border-emerald-700 rounded-xl p-4">
                    <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                        ✓ Images Successfully Converted!
                      </p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                        All Google Drive images have been converted to Cloudinary. Review below and click "Submit & Save" to complete.
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
                      ✓ Converted Images ({unconvertedImages.length})
                    </h3>
                    <ImagePreviewGrid 
                      images={unconvertedImages.map((image) => ({
                        questionId: image.questionId,
                        questionText: image.questionText,
                        url: String(convertedAnswers[image.questionId] || image.url),
                        isConverted: true,
                      }))} 
                    />       </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setParsedAnswers(null);
                    setConvertedAnswers(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  disabled={isSubmitting || isConverting}
                  className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-gray-800 dark:text-white font-semibold rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ← Back
                </button>
                {!convertedAnswers ? (
                  <button
                    onClick={handleStartConversion}
                    disabled={isConverting}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-xl transition-all transform hover:scale-105 flex items-center justify-center gap-2 shadow-md disabled:cursor-not-allowed disabled:scale-100"
                  >
                    {isConverting ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Converting Images...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Start Converting Images
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleFinalSubmit}
                    disabled={isSubmitting}
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
                )}
              
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
