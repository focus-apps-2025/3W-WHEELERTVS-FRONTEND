import React, { useState } from "react";
import { 
  CheckCircle, 
  RotateCcw, 
  XCircle, 
  Camera, 
  Upload, 
  Loader2, 
  X, 
  MessageSquare 
} from "lucide-react";
import { apiClient } from "../../api/client";
import CameraCapture from "./CameraCapture";
import { createPortal } from "react-dom";

interface ZoneOutProps {
  value: any;
  onChange: (value: any) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
  isApplied?: boolean;
  hideChassisNumber?: boolean;
  suggestions?: any[];
}

const ZoneOut: React.FC<ZoneOutProps> = ({
  value,
  onChange,
  onFocus,
  onBlur,
  disabled,
  isApplied = false,
  hideChassisNumber = false,
  suggestions = [],
}) => {
  const chassisValue = value?.chassisNumber || "";
  const statusValue = value?.status || "";
  const remarkValue = value?.remark || "";
  const evidenceUrl = value?.evidenceUrl || "";
  
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const updateValue = (updates: any) => {
    onChange({
      chassisNumber: chassisValue,
      status: statusValue,
      remark: remarkValue,
      evidenceUrl: evidenceUrl,
      ...updates
    });
  };

  const handleChassisChange = (val: string) => updateValue({ chassisNumber: val });

  const handleStatusChange = (val: string) => {
    updateValue({ status: val });
  };

  const handleEvidenceUpload = async (file: File) => {
    if (!file) return;
    try {
      setUploading(true);
      const result = await apiClient.uploadFile(file, "form");
      const uploadedUrl = apiClient.resolveUploadedFileUrl(result);
      if (uploadedUrl) {
        updateValue({ evidenceUrl: uploadedUrl });
      }
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleCameraCapture = async (file: File, remark?: string) => {
    await handleEvidenceUpload(file);
    if (remark) {
      updateValue({ remark });
    }
    setShowCamera(false);
  };

  const hasChassis = hideChassisNumber || chassisValue.trim().length > 0;
  
  const reworkCount = suggestions?.filter(s => {
    const status = s.answers?.status || (s.value && typeof s.value === 'object' ? s.value.status : null);
    return status === 'Rework';
  }).length || 0;

  return (
    <div 
      className="space-y-6 bg-gray-50/50 dark:bg-gray-900/20 p-4 rounded-xl border border-gray-100 dark:border-gray-800"
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {/* Step 1: Chassis Number */}
      {!hideChassisNumber && (
        <div className="space-y-2">
          <div className="relative">
            <input
              type="text"
              value={chassisValue}
              onChange={(e) => handleChassisChange(e.target.value)}
              onFocus={onFocus}
              onBlur={onBlur}
              disabled={disabled}
              placeholder="Enter Chassis Number..."
              className={`w-full px-4 py-2.5 border-2 rounded-xl focus:outline-none focus:ring-4 transition-all pr-10 ${
                isApplied
                  ? "border-emerald-500 bg-emerald-50/30 ring-emerald-500/10"
                  : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 focus:border-primary-500 focus:ring-primary-500/10"
              }`}
            />
            {hasChassis && chassisValue && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
                <CheckCircle className="w-5 h-5" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Status Selection */}
      {hasChassis && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">
              Inspection Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'Accepted', icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50', darkBg: 'dark:bg-emerald-900/20', border: 'border-emerald-200' },
                { id: 'Rework', icon: RotateCcw, color: 'text-amber-500', bg: 'bg-amber-50', darkBg: 'dark:bg-amber-900/20', border: 'border-amber-200' },
                { id: 'Rejected', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', darkBg: 'dark:bg-red-900/20', border: 'border-red-200' }
              ].map((status) => (
                <button
                  key={status.id}
                  type="button"
                  onClick={() => !disabled && handleStatusChange(status.id)}
                  disabled={disabled}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200 ${
                    statusValue === status.id
                      ? `${status.bg} ${status.darkBg} ${status.border} ${status.color} shadow-sm ring-4 ring-${status.id === 'Accepted' ? 'emerald' : (status.id === 'Rejected' ? 'red' : 'amber')}-500/10`
                      : "border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-400 hover:border-gray-200"
                  }`}
                >
                  <status.icon className={`w-5 h-5 mb-1.5 ${statusValue === status.id ? status.color : 'text-gray-300'}`} />
                  <span className="text-[11px] font-bold uppercase tracking-tight text-center leading-tight">
                    {status.id === 'Accepted' 
                      ? (reworkCount > 0 ? 'REWORK COMPLETED' : 'Accepted')
                      : (status.id === 'Rework' && reworkCount > 0)
                        ? `RE-REWORK (${reworkCount})`
                        : status.id
                    }
                  </span>
                </button>
              ))}
            </div>
          </div>

          {statusValue && (
            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Remark Input */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                    <MessageSquare className="w-3 h-3" /> Remark
                  </label>
                  <textarea
                    value={remarkValue}
                    onChange={(e) => updateValue({ remark: e.target.value })}
                    disabled={disabled}
                    placeholder="Enter remark..."
                    className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 min-h-[80px] resize-none"
                  />
                </div>
                
                {/* Evidence Upload */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                    <Upload className="w-3 h-3" /> Evidence Photo
                  </label>
                  <div className="h-[80px]">
                    {evidenceUrl ? (
                      <div className="flex-1 h-full flex items-center justify-between px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-lg">
                        <div className="flex items-center gap-3 min-w-0">
                          <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">Uploaded</p>
                            <p className="text-[9px] text-emerald-600/70 dark:text-emerald-500/50 truncate">photo.jpg</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateValue({ evidenceUrl: "" })}
                          className="p-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-800/50 rounded-full transition-colors"
                        >
                          <X className="w-4 h-4 text-emerald-600" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex h-full gap-2">
                        <label className="flex-1 cursor-pointer group">
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleEvidenceUpload(file);
                            }}
                            disabled={disabled || uploading}
                            accept="image/*"
                          />
                          <div className={`h-full flex flex-col items-center justify-center gap-1 px-3 border-2 border-dashed rounded-lg transition-all ${
                            uploading
                              ? "bg-gray-50 border-gray-200"
                              : "border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10"
                          }`}>
                            {uploading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                <span className="text-[10px] font-medium text-gray-500">Uploading...</span>
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                                <span className="text-[10px] font-medium text-gray-400 group-hover:text-blue-500">Upload</span>
                              </>
                            )}
                          </div>
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowCamera(true)}
                          disabled={disabled || uploading}
                          className="flex-1 flex flex-col items-center justify-center gap-1 px-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-all"
                        >
                          <Camera className="w-4 h-4 text-gray-400 group-hover:text-purple-500" />
                          <span className="text-[10px] font-medium text-gray-400 group-hover:text-purple-500">Camera</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showCamera && createPortal(
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
          disabled={disabled || uploading}
        />,
        document.body
      )}
    </div>
  );
};

export default ZoneOut;
