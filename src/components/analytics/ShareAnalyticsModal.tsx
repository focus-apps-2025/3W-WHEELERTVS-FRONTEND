import React, { useState, useRef } from "react";
import { 
  X, 
  Upload, 
  Mail, 
  MessageSquare, 
  CheckCircle, 
  AlertCircle, 
  FileText,
  Send,
  Loader2,
  Trash2,
  Download,
  Plus
} from "lucide-react";
import { apiClient } from "../../api/client";
import { useNotification } from "../../context/NotificationContext";
import * as XLSX from "xlsx-js-style";

interface ShareAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  formId: string;
  formTitle: string;
}

interface PreviewRecord {
  email: string;
  phone?: string;
  status?: string;
}

export default function ShareAnalyticsModal({ 
  isOpen, 
  onClose, 
  formId, 
  formTitle 
}: ShareAnalyticsModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewRecord[]>([]);
  const [manualRecords, setManualRecords] = useState<PreviewRecord[]>([{ email: "", phone: "" }]);
  const [validCount, setValidCount] = useState(0);
  const [invalidCount, setInvalidCount] = useState(0);
  const [channels, setChannels] = useState<string[]>(["email"]);
  const [customMessage, setCustomMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [step, setStep] = useState<1 | 2>(1); // 1: Upload/Entry, 2: Preview & Send
  const [entryMode, setEntryMode] = useState<"manual" | "bulk">("manual");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useNotification();

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const wsData = [
      ["Email", "Phone"],
      ["example@email.com", "919876543210"],
      ["user2@company.com", "918877665544"]
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Style header
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "4F46E5" } }, // indigo-600
      alignment: { horizontal: "center" }
    };

    ["A1", "B1"].forEach(cell => {
      if (ws[cell]) ws[cell].s = headerStyle;
    });

    ws["!cols"] = [{ wch: 30 }, { wch: 20 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Analytics Invites");
    XLSX.writeFile(wb, `analytics_share_template.xlsx`);
  };

  const handleManualAddRow = () => {
    if (manualRecords.length >= 5) {
      showError("Maximum 5 manual entries allowed. Use bulk import for more.");
      return;
    }
    setManualRecords([...manualRecords, { email: "", phone: "" }]);
  };

  const handleManualRemoveRow = (index: number) => {
    if (manualRecords.length === 1) return;
    setManualRecords(manualRecords.filter((_, i) => i !== index));
  };

  const handleManualChange = (index: number, field: keyof PreviewRecord, value: string) => {
    const newRecords = [...manualRecords];
    newRecords[index] = { ...newRecords[index], [field]: value };
    setManualRecords(newRecords);
  };

  const handleProceedToStep2 = () => {
    if (entryMode === "manual") {
      const validRecords = manualRecords.filter(r => r.email.trim() !== "");
      if (validRecords.length === 0) {
        showError("Please enter at least one email address");
        return;
      }
      setPreviewData(validRecords);
      setValidCount(validRecords.length);
      setStep(2);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    await uploadAndPreview(selectedFile);
  };

  const uploadAndPreview = async (selectedFile: File) => {
    setIsUploading(true);
    try {
      const response = await apiClient.uploadAnalyticsInvites(formId, selectedFile);
      setPreviewData(response.preview || []);
      setValidCount(response.valid || 0);
      setInvalidCount(response.invalid || 0);
      setIsPreviewing(true);
      setStep(2);
    } catch (error: any) {
      showError(error.message || "Failed to process file");
      setFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleChannel = (channel: string) => {
    setChannels(prev => 
      prev.includes(channel) 
        ? prev.filter(c => c !== channel) 
        : [...prev, channel]
    );
  };

  const handleSend = async () => {
    if (channels.length === 0) {
      showError("Please select at least one notification channel");
      return;
    }

    setIsSending(true);
    try {
      const response = await apiClient.sendAnalyticsInvites(formId, previewData, channels, customMessage);
      
      if (response.allSuccessful) {
        showSuccess(`Successfully sent analytics invites to ${response.sent} recipients`);
      } else if (response.sent > 0) {
        // Partial success
        const failedEmails = response.details.filter(d => d.deliveryReport.email === 'failed').length;
        const failedWA = response.details.filter(d => d.deliveryReport.whatsapp === 'failed').length;
        
        let msg = `Sent ${response.sent} invites, but some failed: `;
        if (failedEmails > 0) msg += `${failedEmails} emails failed. `;
        if (failedWA > 0) msg += `${failedWA} WhatsApp failed. `;
        
        showError(msg);
      } else {
        showError("Failed to send any invites. Please check your service configuration (SMTP/Twilio).");
      }
      
      onClose();
    } catch (error: any) {
      showError(error.message || "Failed to send invites");
    } finally {
      setIsSending(false);
    }
  };

  const resetModal = () => {
    setFile(null);
    setIsPreviewing(false);
    setPreviewData([]);
    setStep(1);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900 sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Share Analytics
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {formTitle}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 ? (
            <div className="space-y-6">
              {/* Entry Mode Toggle */}
              <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
                <button
                  onClick={() => setEntryMode("manual")}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${entryMode === "manual" ? "bg-white dark:bg-gray-700 shadow-sm text-primary-600" : "text-gray-500 hover:text-gray-700"}`}
                >
                  Quick Add (1-5)
                </button>
                <button
                  onClick={() => setEntryMode("bulk")}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${entryMode === "bulk" ? "bg-white dark:bg-gray-700 shadow-sm text-primary-600" : "text-gray-500 hover:text-gray-700"}`}
                >
                  Bulk Import
                </button>
              </div>

              {entryMode === "bulk" ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3 flex-1">
                      <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-800 dark:text-blue-300">
                        <p className="font-semibold">Bulk Upload Instructions:</p>
                        <p className="opacity-90 mt-1">Upload an Excel/CSV file with "Email" and "Phone" columns.</p>
                      </div>
                    </div>
                    <button
                      onClick={handleDownloadTemplate}
                      className="ml-4 flex flex-col items-center gap-1 p-3 text-primary-600 hover:bg-primary-50 rounded-xl transition-colors border border-primary-100"
                    >
                      <Download className="w-5 h-5" />
                      <span className="text-[10px] font-black uppercase tracking-tight">Template</span>
                    </button>
                  </div>

                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                      border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all
                      ${isUploading ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200' : 'hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 border-gray-300 dark:border-gray-700'}
                    `}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      className="hidden" 
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileChange}
                    />
                    
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
                        <p className="text-gray-600 dark:text-gray-400 font-medium">Processing file...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                          <Upload className="w-8 h-8 text-primary-600" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">Click to upload Excel</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">or drag and drop your file here</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {manualRecords.map((record, index) => (
                      <div key={index} className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-200">
                        <div className="flex-1">
                          <input
                            type="email"
                            placeholder="Email Address"
                            value={record.email}
                            onChange={(e) => handleManualChange(index, "email", e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-600 dark:text-white text-sm"
                          />
                        </div>
                        <div className="w-40">
                          <input
                            type="tel"
                            placeholder="Phone (Optional)"
                            value={record.phone}
                            onChange={(e) => handleManualChange(index, "phone", e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-600 dark:text-white text-sm"
                          />
                        </div>
                        <button
                          onClick={() => handleManualRemoveRow(index)}
                          disabled={manualRecords.length === 1}
                          className="p-3 text-gray-400 hover:text-red-600 disabled:opacity-0 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {manualRecords.length < 5 && (
                    <button
                      onClick={handleManualAddRow}
                      className="flex items-center gap-2 px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors font-bold text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Add Another Recipient
                    </button>
                  )}

                  <div className="pt-4">
                    <button
                      onClick={handleProceedToStep2}
                      className="w-full py-4 px-6 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-primary-600/25 flex items-center justify-center gap-2"
                    >
                      Next: Configure Invitations
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stats & File Info */}
              <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <FileText className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{file?.name}</p>
                    <p className="text-xs text-gray-500">{validCount} valid records found</p>
                  </div>
                </div>
                <button 
                  onClick={resetModal}
                  className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Channels selection */}
              <div className="space-y-3">
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Select Notification Channels</p>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleToggleChannel("email")}
                    className={`
                      flex items-center gap-3 p-4 rounded-xl border transition-all
                      ${channels.includes("email") 
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400' 
                        : 'border-gray-200 dark:border-gray-700 text-gray-500'}
                    `}
                  >
                    <Mail className="w-5 h-5" />
                    <span className="font-semibold">Email</span>
                  </button>
                  <button
                    onClick={() => handleToggleChannel("whatsapp")}
                    className={`
                      flex items-center gap-3 p-4 rounded-xl border transition-all
                      ${channels.includes("whatsapp") 
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' 
                        : 'border-gray-200 dark:border-gray-700 text-gray-500'}
                    `}
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span className="font-semibold">WhatsApp</span>
                  </button>
                </div>
              </div>

              {/* Custom Message */}
              <div className="space-y-3">
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Custom Message (Optional)</p>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Add a personalized message to the invite..."
                  className="w-full p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-600 dark:text-white transition-all text-sm resize-none h-24"
                />
              </div>

              {/* Preview Table */}
              <div className="space-y-3">
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Preview (First 5 records)</p>
                <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 font-medium">
                      <tr>
                        <th className="px-4 py-2">Email</th>
                        <th className="px-4 py-2">Phone</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {previewData.slice(0, 5).map((record, i) => (
                        <tr key={i} className="dark:text-gray-300">
                          <td className="px-4 py-3 truncate max-w-[200px]">{record.email}</td>
                          <td className="px-4 py-3">{record.phone || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3 bg-gray-50 dark:bg-gray-900/50">
          <button 
            onClick={onClose}
            className="px-6 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          {step === 2 && (
            <button 
              onClick={handleSend}
              disabled={isSending || channels.length === 0}
              className="flex items-center gap-2 px-8 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary-500/25"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Invites
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
