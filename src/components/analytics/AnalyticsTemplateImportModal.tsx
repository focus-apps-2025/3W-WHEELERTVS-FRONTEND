import React, { useState, useRef, ChangeEvent } from "react";
import {
  Download,
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  Eye,
  Send,
} from "lucide-react";
import { apiClient } from "../../api/client";
import { useNotification } from "../../context/NotificationContext";
import {
  generateAnalyticsTemplate,
  parseAnalyticsWorkbook,
  validateImportedAnswers,
  formatImportedAnswersForResponse,
  ImportedAnswerRow,
  ValidationResult,
} from "../../utils/analyticsTemplateUtils";

interface Form {
  _id?: string;
  id?: string;
  title: string;
  sections: Array<{
    id: string;
    title: string;
    questions: Array<{
      id: string;
      text: string;
      type: string;
      options?: string[];
      required?: boolean;
      followUpQuestions?: Array<{
        id: string;
        text: string;
        type: string;
        options?: string[];
        required?: boolean;
        followUpQuestions?: unknown[];
      }>;
    }>;
  }>;
}

interface AnalyticsTemplateImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: Form;
  formId: string;
  onSuccess?: () => void;
}

export default function AnalyticsTemplateImportModal({
  isOpen,
  onClose,
  form,
  formId,
  onSuccess,
}: AnalyticsTemplateImportModalProps) {
  const { showSuccess, showError } = useNotification();
  const [importedRows, setImportedRows] = useState<ImportedAnswerRow[]>([]);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    if (!form) {
      showError("Form data not available", "Error");
      return;
    }

    try {
      generateAnalyticsTemplate(form);
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
      const rows = await parseAnalyticsWorkbook(file, form);
      
      try {
        console.log('Processing images from Excel rows...');
        const processedRows = [];
        
        for (const row of rows) {
          try {
            const processedAnswers = await apiClient.processImages(row.answer);
            processedRows.push({
              ...row,
              answer: processedAnswers
            });
          } catch (err) {
            console.warn('Failed to process image for row:', row.rowIndex, err);
            processedRows.push(row);
          }
        }
        
        setImportedRows(processedRows);
        const validation = validateImportedAnswers(processedRows, form);
        setValidationResult(validation);

        if (validation.isValid) {
          showSuccess(
            `Template imported: ${validation.validRows.length} valid answers found (images converted)`,
            "Import Complete"
          );
        } else {
          showError(
            `${validation.rowsWithErrors.length} rows have validation errors. Please review before submitting.`,
            "Import Complete with Errors"
          );
        }
      } catch (imageError) {
        console.warn('Image processing failed, using original answers:', imageError);
        setImportedRows(rows);
        const validation = validateImportedAnswers(rows, form);
        setValidationResult(validation);

        if (validation.isValid) {
          showSuccess(
            `Template imported: ${validation.validRows.length} valid answers found`,
            "Import Complete"
          );
        }
      }
    } catch (error: any) {
      showError(
        error?.message || "Failed to import template",
        "Import Failed"
      );
      setImportedRows([]);
      setValidationResult(null);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleImportClick = () => {
    if (isImporting) {
      return;
    }
    fileInputRef.current?.click();
  };

  const handleSubmit = async () => {
    if (!validationResult || !validationResult.isValid) {
      showError("Please fix validation errors before submitting", "Error");
      return;
    }

    setIsSubmitting(true);

    try {
      const responsePayload = {
        questionId: formId,
        responses: validationResult.validRows.map(row => {
          const answers = formatImportedAnswersForResponse([row], form);
          return {
            answers,
            submittedBy: row.submittedBy || "Excel Import",
            submitterContact: row.submitterContact,
            parentResponseId: row.parentResponseId
          };
        })
      };

      const data = await apiClient.batchImportResponses(responsePayload);

      showSuccess(
        `${data.imported} response(s) imported successfully with automatic image processing!`,
        "Submission Complete"
      );

      setImportedRows([]);
      setValidationResult(null);
      setShowPreview(false);

      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error: any) {
      showError(
        error?.message || "Failed to submit responses",
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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-primary-800 dark:text-primary-100">
              Import Answers for Analytics
            </h2>
            <p className="text-sm text-primary-600 dark:text-primary-400">
              {form?.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!validationResult && (
            <div className="space-y-3">
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Step 1:</strong> Download the answer template
                </p>
              </div>

              <button
                onClick={handleDownloadTemplate}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <Download className="w-4 h-4" />
                Download Template
              </button>

              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  <strong>Step 2:</strong> Fill in the Answer column with your
                  data and save the file
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
                  className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <Upload className="w-4 h-4" />
                  {isImporting ? "Importing..." : "Import Filled Template"}
                </button>
              </div>
            </div>
          )}

          {validationResult && (
            <div className="space-y-4">
              {validationResult.isValid ? (
                <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      All answers validated successfully
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      {validationResult.validRows.length} valid answers ready to
                      import
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      {validationResult.rowsWithErrors.length} rows have errors
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                      {validationResult.validRows.length} valid answers will be
                      imported
                    </p>
                  </div>
                </div>
              )}

              {validationResult.rowsWithErrors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-3">
                    Validation Errors:
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {validationResult.rowsWithErrors.map((row) => (
                      <div
                        key={row.rowIndex}
                        className="text-xs bg-white dark:bg-gray-800 p-2 rounded border border-red-200 dark:border-red-700"
                      >
                        <p className="text-red-700 dark:text-red-300 font-medium">
                          Row {row.rowIndex}: {row.questionText}
                        </p>
                        <ul className="text-red-600 dark:text-red-400 ml-3 mt-1">
                          {row.errors.map((error, idx) => (
                            <li key={idx}>• {error}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowPreview(!showPreview)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <Eye className="w-4 h-4" />
                {showPreview ? "Hide Preview" : "Show Preview"}
              </button>

              {showPreview && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-primary-700 dark:text-primary-300 mb-3">
                    Valid Answers Preview:
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {validationResult.validRows.length > 0 ? (
                      validationResult.validRows.map((row) => (
                        <div
                          key={row.rowIndex}
                          className="text-xs bg-white dark:bg-gray-700 p-2 rounded"
                        >
                          <p className="text-gray-700 dark:text-gray-300 font-medium">
                            {row.questionText}
                          </p>
                          <p className="text-gray-600 dark:text-gray-400 ml-2">
                            → {String(row.answer).substring(0, 100)}
                            {String(row.answer).length > 100 ? "..." : ""}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-center">
                        No valid answers to display
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setImportedRows([]);
                    setValidationResult(null);
                    setShowPreview(false);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                >
                  Import Different File
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || validationResult.validRows.length === 0}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? "Submitting..." : "Create Response"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
