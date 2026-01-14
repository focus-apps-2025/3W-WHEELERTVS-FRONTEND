import React, { useState, useRef, ChangeEvent } from "react";
import {
  X,
  Upload,
  Users,
  Check,
  AlertCircle,
  MessageCircle,
  FileText,
  Send,
  Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import { apiClient } from "../api/client";
import { useNavigate } from "react-router-dom";

interface WhatsAppInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  formId: string;
  formTitle: string;
  tenantId?: string;
}

interface PhoneRecord {
  phone: string;
  email?: string;
  status: "valid" | "invalid" | "duplicate" | "existing";
  issues?: string[];
  existingStatus?: string;
}

interface PreviewData {
  totalRecords: number;
  valid: number;
  invalid: number;
  duplicatePhones: number;
  preview: Array<{
    phone: string;
    email: string;
    status: string;
    existingStatus?: string;
    originalPhone?: string;
    issues?: string[];
  }>;
  sampleLink: string;
  form: {
    id: string;
    title: string;
    inviteOnlyTracking: boolean;
  };
}

const WhatsAppInviteModal: React.FC<WhatsAppInviteModalProps> = ({
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
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [sendResults, setSendResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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

      const response = await apiClient.uploadWhatsAppInvites(formId, formData);

      if (response.success) {
        setPreviewData(response.data);
        setStep("preview");

        const validPhones = new Set(
          response.data.preview
            .filter((item: any) => item.status === "valid")
            .map((item: any) => item.phone)
        );
        setSelectedPhones(validPhones);
      } else {
        setError(response.message || "Failed to process file");
      }
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendInvites = async () => {
    if (!previewData || selectedPhones.size === 0) return;

    setIsSending(true);
    setStep("sending");
    setError(null);

    try {
      const phonesToSend = previewData.preview
        .filter((item) => selectedPhones.has(item.phone))
        .map((item) => ({
          phone: item.phone,
          email: item.email || "",
        }));

      const response = await apiClient.sendWhatsAppInvites(formId, {
        phones: phonesToSend,
      });

      if (response.success) {
        setSendResults(response.data);
        setStep("complete");
      } else {
        setError(response.message || "Failed to send invites");
        setStep("preview");
      }
    } catch (err: any) {
      setError(err.message || "Sending failed");
      setStep("preview");
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectAll = () => {
    if (!previewData) return;

    const allValidPhones = new Set(
      previewData.preview
        .filter((item) => item.status === "valid")
        .map((item) => item.phone)
    );

    if (selectedPhones.size === allValidPhones.size) {
      setSelectedPhones(new Set());
    } else {
      setSelectedPhones(allValidPhones);
    }
  };

  const togglePhoneSelection = (phone: string) => {
    const newSelected = new Set(selectedPhones);
    if (newSelected.has(phone)) {
      newSelected.delete(phone);
    } else {
      newSelected.add(phone);
    }
    setSelectedPhones(newSelected);
  };

  const resetModal = () => {
    setStep("upload");
    setUploadedFile(null);
    setPreviewData(null);
    setSelectedPhones(new Set());
    setSendResults(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        Phone: "+1234567890",
        Email: "example@email.com",
      },
      {
        Phone: "+1987654321",
        Email: "another@email.com",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    worksheet["!cols"] = [{ wch: 20 }, { wch: 30 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Recipients");

    const fileName = `WhatsApp_Invites_Template_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <MessageCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {step === "complete"
                  ? "WhatsApp Invites Sent!"
                  : "Send WhatsApp Invites"}
              </h2>
              <p className="text-sm text-gray-600">{formTitle}</p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/forms/${formId}/invites`)}
            className="px-4 py-2 text-sm font-medium text-green-600 hover:bg-green-50 rounded-lg border border-green-200 flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            WhatsApp Status
          </button>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {step === "upload" && (
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <Upload className="w-8 h-8 text-green-600" />
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Upload Recipient List
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Upload an Excel or CSV file with Phone and Email columns. We'll
                send unique WhatsApp form links to each recipient.
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
                <ul className="space-y-1 text-left max-w-sm mx-auto mb-4">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Phone column (required, with country code)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Email column (optional)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Excel (.xlsx) or CSV format</span>
                  </li>
                </ul>
                <button
                  onClick={downloadTemplate}
                  className="text-green-600 hover:text-green-700 font-medium flex items-center gap-2 justify-center mx-auto"
                >
                  <Download className="w-4 h-4" />
                  Download Template
                </button>
              </div>
            </div>
          )}

          {step === "preview" && previewData && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-700">
                    {previewData.valid}
                  </div>
                  <div className="text-sm text-green-600">Valid Phones</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-red-700">
                    {previewData.invalid}
                  </div>
                  <div className="text-sm text-red-600">Invalid</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-yellow-700">
                    {previewData.duplicatePhones}
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
                    className="text-sm font-medium text-green-600 hover:text-green-700"
                  >
                    {selectedPhones.size === previewData.valid
                      ? "Deselect All"
                      : "Select All"}{" "}
                    Valid
                  </button>
                  <span className="text-sm text-gray-600">
                    {selectedPhones.size} of {previewData.valid} selected
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  Sample link:{" "}
                  <a
                    href={previewData.sampleLink}
                    className="text-green-600 hover:underline"
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
                    Phone
                  </div>
                  <div className="col-span-3 text-sm font-medium text-gray-700">
                    Email
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
                            checked={selectedPhones.has(item.phone)}
                            onChange={() => togglePhoneSelection(item.phone)}
                            className="h-4 w-4 text-green-600 rounded"
                          />
                        )}
                      </div>
                      <div className="col-span-5 text-sm text-gray-800 truncate">
                        {item.phone}
                      </div>
                      <div className="col-span-3 text-sm text-gray-600">
                        {item.email || "-"}
                      </div>
                      <div className="col-span-3">
                        {item.status === "valid" && (
                          <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded">
                            Valid
                          </span>
                        )}
                        {item.status === "invalid" && (
                          <span className="px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded">
                            Invalid
                          </span>
                        )}
                        {item.status === "duplicate" && (
                          <span className="px-2 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded">
                            Duplicate
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === "sending" && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-6"></div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Sending WhatsApp Invites...
              </h3>
              <p className="text-gray-600">
                Please wait while we send invites to {selectedPhones.size} recipients
              </p>
            </div>
          )}

          {step === "complete" && sendResults && (
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <Check className="w-8 h-8 text-green-600" />
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {sendResults.failed === 0
                  ? "WhatsApp Invites Sent Successfully!"
                  : "WhatsApp Invites Processed"}
              </h3>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-700">
                    {sendResults.sent || 0}
                  </div>
                  <div className="text-sm text-green-600">Sent</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-red-700">
                    {sendResults.failed || 0}
                  </div>
                  <div className="text-sm text-red-600">Failed</div>
                </div>
              </div>

              {sendResults.failures && sendResults.failures.length > 0 && (
                <div className="mb-6 text-left border border-red-100 rounded-lg overflow-hidden">
                  <div className="bg-red-50 px-4 py-2 border-b border-red-100 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-semibold text-red-800">
                      Failure Details
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto bg-white">
                    {sendResults.failures.map((failure: any, index: number) => (
                      <div
                        key={index}
                        className="px-4 py-3 border-b border-gray-50 last:border-0 flex flex-col gap-1"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">
                            {failure.phone}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                            Failed
                          </span>
                        </div>
                        <p className="text-xs text-red-600 bg-red-50/50 p-2 rounded border border-red-100/50">
                          {failure.reason || "Unknown error occurred"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => navigate(`/forms/${formId}/invites`)}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  View Status
                </button>
                <button
                  onClick={handleClose}
                  className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {step === "preview" && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex justify-between">
            <button
              onClick={() => setStep("upload")}
              className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
            >
              Back
            </button>
            <button
              onClick={handleSendInvites}
              disabled={selectedPhones.size === 0 || isSending}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {isSending
                ? "Sending..."
                : `Send to ${selectedPhones.size} Recipient${selectedPhones.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppInviteModal;
