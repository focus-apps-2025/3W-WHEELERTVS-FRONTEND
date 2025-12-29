import React, { useState, useRef, ChangeEvent } from "react";
import {
  X,
  Upload,
  Users,
  Check,
  AlertCircle,
  Mail,
  FileText,
  Send,
} from "lucide-react";
import { apiClient } from "../api/client";
import { useNavigate } from "react-router-dom";

interface EmailInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  formId: string;
  formTitle: string;
  tenantId?: string;
}

interface EmailRecord {
  email: string;
  phone?: string;
  status: "valid" | "invalid" | "duplicate" | "existing";
  issues?: string[];
  existingStatus?: string;
}

interface PreviewData {
  totalRecords: number;
  valid: number;
  invalid: number;
  duplicateEmails: number;
  preview: Array<{
    email: string;
    phone: string;
    status: string; // Backend returns 'valid', not 'valid'
    existingStatus?: string;
    originalEmail?: string;
    issues?: string[];
  }>;
  sampleLink: string;
  form: {
    id: string;
    title: string;
    inviteOnlyTracking: boolean;
  };
}

const EmailInviteModal: React.FC<EmailInviteModalProps> = ({
  isOpen,
  onClose,
  formId,
  formTitle,
  tenantId,
}) => {
  const [step, setStep] = useState<
    "upload" | "preview" | "sending" | "complete"
  >("upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [sendResults, setSendResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];

    if (
      !validTypes.includes(file.type) &&
      !file.name.toLowerCase().endsWith(".xlsx")
    ) {
      setError("Please upload Excel (.xlsx) or CSV files only");
      return;
    }

    setUploadedFile(file);
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Upload to backend for parsing
      const response = await apiClient.uploadInvites(formId, formData);

      console.log("Backend response:", response); // Add this for debugging

      if (response.success) {
        setPreviewData(response.data);
        setStep("preview");

        // ✅ FIX: Match backend's status property name
        const validEmails = new Set(
          response.data.preview
            .filter((item: any) => item.status === "valid") // Backend uses 'valid'
            .map((item: any) => item.email)
        );
        setSelectedEmails(validEmails);
      } else {
        setError(response.message || "Failed to process file");
      }
    } catch (err: any) {
      console.error("Upload error:", err); // Add this for debugging
      setError(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendInvites = async () => {
    if (!previewData || selectedEmails.size === 0) return;

    setIsSending(true);
    setError(null);

    try {
      // Get selected email data
      const emailsToSend = previewData.preview
        .filter((item) => selectedEmails.has(item.email))
        .map((item) => ({
          email: item.email,
          phone: item.phone || "",
        }));

      const response = await apiClient.sendInvites(formId, {
        emails: emailsToSend,
      });

      if (response.success) {
        setSendResults(response.data);
        setStep("complete");
      } else {
        setError(response.message || "Failed to send invites");
      }
    } catch (err: any) {
      setError(err.message || "Sending failed");
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectAll = () => {
    if (!previewData) return;

    const allValidEmails = new Set(
      previewData.preview
        .filter((item) => item.status === "valid")
        .map((item) => item.email)
    );

    if (selectedEmails.size === allValidEmails.size) {
      setSelectedEmails(new Set()); // Deselect all
    } else {
      setSelectedEmails(allValidEmails); // Select all
    }
  };

  const toggleEmailSelection = (email: string) => {
    const newSelected = new Set(selectedEmails);
    if (newSelected.has(email)) {
      newSelected.delete(email);
    } else {
      newSelected.add(email);
    }
    setSelectedEmails(newSelected);
  };

  const resetModal = () => {
    setStep("upload");
    setUploadedFile(null);
    setPreviewData(null);
    setSelectedEmails(new Set());
    setSendResults(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Mail className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {step === "complete" ? "Invites Sent!" : "Send Email Invites"}
              </h2>
              <p className="text-sm text-gray-600">{formTitle}</p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/forms/${formId}/invites`)}
            className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            Sent Mail Status
          </button>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {step === "upload" && (
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                <Upload className="w-8 h-8 text-blue-600" />
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Upload Recipient List
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Upload an Excel or CSV file with Email and Phone columns. We'll
                send unique form links to each recipient.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="btn-primary px-8 py-3 text-lg font-medium"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mr-2" />
                    Choose Excel File
                  </>
                )}
              </button>

              <div className="mt-6 text-sm text-gray-500">
                <p className="mb-2">File should contain:</p>
                <ul className="space-y-1 text-left max-w-sm mx-auto">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Email column (required)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Phone column (optional)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Excel (.xlsx) or CSV format</span>
                  </li>
                </ul>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "preview" && previewData && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-700">
                    {previewData.valid}
                  </div>
                  <div className="text-sm text-green-600">Valid Emails</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-red-700">
                    {previewData.invalid}
                  </div>
                  <div className="text-sm text-red-600">Invalid</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-yellow-700">
                    {previewData.duplicateEmails}
                  </div>
                  <div className="text-sm text-yellow-600">Duplicates</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-700">
                    {previewData.totalRecords}
                  </div>
                  <div className="text-sm text-blue-600">Total Records</div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSelectAll}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    {selectedEmails.size === previewData.valid
                      ? "Deselect All"
                      : "Select All"}{" "}
                    Valid
                  </button>
                  <span className="text-sm text-gray-600">
                    {selectedEmails.size} of {previewData.valid} selected
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  Sample link:{" "}
                  <a
                    href={previewData.sampleLink}
                    className="text-blue-600 hover:underline"
                    target="_blank"
                  >
                    View Form
                  </a>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 grid grid-cols-12 gap-4 border-b border-gray-200">
                  <div className="col-span-1"></div>
                  <div className="col-span-5 text-sm font-medium text-gray-700">
                    Email
                  </div>
                  <div className="col-span-3 text-sm font-medium text-gray-700">
                    Phone
                  </div>
                  <div className="col-span-3 text-sm font-medium text-gray-700">
                    Status
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {previewData.preview.map((item, index) => (
                    <div
                      key={index}
                      className={`px-4 py-3 grid grid-cols-12 gap-4 border-b border-gray-100 hover:bg-gray-50 ${
                        item.status !== "valid" ? "opacity-50" : ""
                      }`}
                    >
                      <div className="col-span-1 flex items-center">
                        {item.status === "valid" && (
                          <input
                            type="checkbox"
                            checked={selectedEmails.has(item.email)}
                            onChange={() => toggleEmailSelection(item.email)}
                            className="h-4 w-4 text-blue-600 rounded"
                          />
                        )}
                      </div>
                      <div className="col-span-5 text-sm text-gray-800 truncate">
                        {item.email}
                      </div>
                      <div className="col-span-3 text-sm text-gray-600">
                        {item.phone || "-"}
                      </div>
                      <div className="col-span-3">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            item.status === "valid"
                              ? "bg-green-100 text-green-800"
                              : item.status === "existing"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {item.status === "valid" &&
                            !item.existingStatus &&
                            "New"}
                          {item.status === "valid" &&
                            item.existingStatus &&
                            `Already ${item.existingStatus}`}
                          {item.status === "invalid" && "Invalid"}
                          {item.status === "duplicate" && "Duplicate"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setStep("upload")}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
                  disabled={isSending}
                >
                  Back
                </button>
                <button
                  onClick={handleSendInvites}
                  disabled={selectedEmails.size === 0 || isSending}
                  className="btn-primary px-6 py-2 font-medium flex items-center gap-2"
                >
                  {isSending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send {selectedEmails.size} Invites
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === "complete" && sendResults && (
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <Check className="w-8 h-8 text-green-600" />
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Invites Sent Successfully!
              </h3>

              <div className="max-w-md mx-auto space-y-4 mb-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-700">
                      {sendResults.successful}
                    </div>
                    <div className="text-sm text-green-600">Sent</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-red-700">
                      {sendResults.failed}
                    </div>
                    <div className="text-sm text-red-600">Failed</div>
                  </div>
                </div>

                {sendResults.failures && sendResults.failures.length > 0 && (
                  <div className="text-left">
                    <h4 className="font-medium text-gray-700 mb-2">
                      Failed Invites:
                    </h4>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                      {sendResults.failures.map(
                        (failure: any, index: number) => (
                          <div
                            key={index}
                            className="text-sm text-red-600 mb-1"
                          >
                            {failure.email}: {failure.reason}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-center gap-3">
                <button
                  onClick={handleClose}
                  className="btn-primary px-6 py-2 font-medium"
                >
                  Done
                </button>
                <button
                  onClick={() => {
                    resetModal();
                    setStep("upload");
                  }}
                  className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg font-medium"
                >
                  Send More Invites
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailInviteModal;
