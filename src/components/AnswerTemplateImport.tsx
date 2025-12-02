import React, { useState, useRef, ChangeEvent } from "react";
import {
  Download,
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  FileText,
  Send,
  ArrowRight,
  Loader,
} from "lucide-react";
import { useForms } from "../hooks/useApi";
import { apiClient } from "../api/client";
import { useNotification } from "../context/NotificationContext";
import {
  generateAnswerTemplate,
  parseAnswerWorkbook,
  formatAnswersForSubmission,
  ParsedAnswers,
} from "../utils/answerTemplateUtils";
import type { Question } from "../types";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const forms = formsData?.forms || [];
  const parentForms = forms.filter((form: any) => !form.parentFormId);

  const handleFormSelect = (formId: string) => {
    setSelectedFormId(formId);
    const form = parentForms.find((f: any) => f.id === formId || f._id === formId);
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
    } catch (error: any) {
      showError(
        error?.message || "Failed to download template",
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
      setParsedAnswers(answers);
      showSuccess("Template imported successfully", "Import Complete");
    } catch (error: any) {
      showError(
        error?.message || "Failed to import template",
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

  const handleSubmit = async () => {
    if (!selectedForm || !parsedAnswers) {
      showError("Missing form or answers", "Error");
      return;
    }

    setIsSubmitting(true);

    try {
      const formattedData = formatAnswersForSubmission(
        selectedForm,
        parsedAnswers
      );
      const formId = selectedForm.id || selectedForm._id;

      const responsePayload = {
        questionId: formId,
        ...formattedData
      };

      await apiClient.createResponse(responsePayload);

      showSuccess(
        "Answers submitted successfully",
        "Submission Complete"
      );
      setParsedAnswers(null);
      setSelectedFormId("");
      setSelectedForm(null);

      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error: any) {
      showError(
        error?.message || "Failed to submit answers",
        "Submission Failed"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
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
            className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
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
              {parentForms.map((form: any) => (
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
                  Preview
                </h3>
                <div className="space-y-3">
                  {selectedForm.sections.map((section) =>
                    section.questions.map((question) => {
                      const answer = parsedAnswers[question.id];
                      return answer ? (
                        <div key={question.id} className="text-sm pb-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
                          <p className="text-gray-800 dark:text-gray-200 font-semibold truncate">
                            {question.text}
                          </p>
                          <p className="text-gray-600 dark:text-gray-400 mt-1 text-xs bg-white dark:bg-gray-900 px-2 py-1 rounded inline-block">
                            {String(answer).substring(0, 80)}
                            {String(answer).length > 80 ? "..." : ""}
                          </p>
                        </div>
                      ) : null;
                    })
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setParsedAnswers(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-semibold rounded-xl transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-xl transition-all transform hover:scale-105 flex items-center justify-center gap-2 shadow-md disabled:cursor-not-allowed disabled:scale-100"
                >
                  {isSubmitting ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Submit Answers
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {!selectedForm && (
            <div className="text-center py-12">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                <AlertCircle className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">
                Select a form to begin
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Choose from the available forms above
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
