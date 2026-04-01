import React, { useState } from "react";
import { AlertCircle, CheckCircle, RotateCcw, XCircle, Search, MessageSquare, Upload, Loader2, X } from "lucide-react";
import SearchSelect from "../QuestionTypes/SearchSelect";
import { apiClient } from "../../api/client";

interface ChassisWithoutZoneProps {
  value: any;
  onChange: (value: any) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
  isApplied?: boolean;
}

const DEFECT_DATA: Record<string, string[]> = {
  "Painting defects": [
    "Paint uncover", "Low DFT", "Colour missmatch", "Cissing mark", 
    "Paint rundown", "Orange peel", "Dry spray", "Rough finish", 
    "High DFT", "Dirt inclusion", "Blisters", "Bubbling"
  ],
  "Welding defects": [
    "Porosity", "Pin hole", "Spatters", "Burnthrough", "crack", 
    "Unfill", "Undercut", "Excess weld", "Chipping mark", "Sharp edge", 
    "Spot missing", "Spot welding shift", "Edge spot", "Edge spot burr", 
    "Weld shift", "No nugget formation", "Welding stick", 
    "Plug welding missing", "Plug welding burn through", "Spot failure"
  ],
  "Fitment defects": [
    "Hole misalignment", "Bracket misalignment", "Gap issue", "Interference", 
    "Bolt not assembling", "Part not assembly", "Thread damage", 
    "Mouting point shift", "Weld bead interference", "Clearance issue", 
    "Nut missing", "Nut offset", "Bolt missing", "Bolt lossen", 
    "Assembly not seating", "Bracket tilt"
  ],
  "sealant defects": [
    "Sealant missing", "Incomplete sealant", "Uneven bead", "Excess sealant", 
    "Selant overflow", "Sealant lifting", "Sealant gap", 
    "Discontinuous sealant", "Sealant crack", "Water leakage", "Sealant peeling"
  ],
  "Handling defects": [
    "Dent", "Bend", "Paint damage", "Scratch", "Rust due to storage", 
    "Packing damage", "Transit damage", "Part rubbing damage"
  ]
};

const ChassisWithoutZone: React.FC<ChassisWithoutZoneProps> = ({
  value,
  onChange,
  onFocus,
  onBlur,
  disabled,
  isApplied = false,
}) => {
  const chassisValue = value?.chassisNumber || "";
  const statusValue = value?.status || "";
  const categoryValue = value?.defectCategory || "";
  const specificDefects = value?.defects || []; // array of objects { name, remark, fileUrl }
  const evidenceUrl = value?.evidenceUrl || "";
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const updateValue = (updates: any) => {
    onChange({
      chassisNumber: chassisValue,
      status: statusValue,
      defectCategory: categoryValue,
      defects: specificDefects,
      evidenceUrl: evidenceUrl,
      ...updates
    });
  };

  const handleChassisChange = (val: string) => updateValue({ chassisNumber: val });
  const handleStatusChange = (val: string) => {
    if (val === 'Accepted') {
      updateValue({ status: val, defectCategory: "", defects: [] });
    } else {
      updateValue({ status: val });
    }
  };

  const handleEvidenceUpload = async (file: File) => {
    if (!file) return;
    try {
      setUploading(prev => ({ ...prev, evidence: true }));
      const result = await apiClient.uploadFile(file, "form");
      const uploadedUrl = apiClient.resolveUploadedFileUrl(result);
      if (uploadedUrl) {
        updateValue({ evidenceUrl: uploadedUrl });
      }
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to upload file");
    } finally {
      setUploading(prev => ({ ...prev, evidence: false }));
    }
  };
  const handleCategoryChange = (val: string | string[]) => {
    const cat = Array.isArray(val) ? val[0] : val;
    updateValue({ defectCategory: cat, defects: [] });
  };
  
  const handleDefectToggle = (defectName: string) => {
    if (disabled) return;
    const existing = specificDefects.find((d: any) => (typeof d === 'string' ? d === defectName : d.name === defectName));
    
    let next;
    if (existing) {
      next = specificDefects.filter((d: any) => (typeof d === 'string' ? d !== defectName : d.name !== defectName));
    } else {
      next = [...specificDefects, { name: defectName, remark: "", fileUrl: "" }];
    }
    updateValue({ defects: next });
  };

  const handleDefectUpdate = (defectName: string, updates: any) => {
    const next = specificDefects.map((d: any) => {
      const name = typeof d === 'string' ? d : d.name;
      if (name === defectName) {
        const base = typeof d === 'string' ? { name: d } : d;
        return { ...base, ...updates };
      }
      return d;
    });
    updateValue({ defects: next });
  };

  const handleFileUpload = async (defectName: string, file: File) => {
    if (!file) return;
    
    try {
      setUploading(prev => ({ ...prev, [defectName]: true }));
      const result = await apiClient.uploadFile(file, "form");
      const uploadedUrl = apiClient.resolveUploadedFileUrl(result);
      
      if (uploadedUrl) {
        handleDefectUpdate(defectName, { fileUrl: uploadedUrl });
      }
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to upload file");
    } finally {
      setUploading(prev => ({ ...prev, [defectName]: false }));
    }
  };

  const hasChassis = chassisValue.trim().length > 0;
  const isRejectedOrRework = statusValue === 'Rejected' || statusValue === 'Rework';

  return (
    <div 
      className="space-y-6 bg-gray-50/50 dark:bg-gray-900/20 p-4 rounded-xl border border-gray-100 dark:border-gray-800"
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {/* Step 1: Chassis Number */}
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
          {hasChassis && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
              <CheckCircle className="w-5 h-5" />
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Status Selection */}
      {hasChassis && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-2">
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">
            Inspection Status
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'Accepted', icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50', darkBg: 'dark:bg-emerald-900/20', border: 'border-emerald-200' },
              { id: 'Rejected', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', darkBg: 'dark:bg-red-900/20', border: 'border-red-200' },
              { id: 'Rework', icon: RotateCcw, color: 'text-amber-500', bg: 'bg-amber-50', darkBg: 'dark:bg-amber-900/20', border: 'border-amber-200' }
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
                <span className="text-[11px] font-bold uppercase tracking-tight">{status.id}</span>
              </button>
            ))}
          </div>

          {/* Evidence Upload for Accepted Status */}
          {statusValue === 'Accepted' && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-2">
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-tight ml-1">
                  <Upload className="w-3 h-3" /> Evidence Photo
                </label>
                <div className="h-[80px]">
                  {evidenceUrl ? (
                    <div className="flex-1 h-full flex items-center justify-between px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-lg">
                      <div className="flex items-center gap-3 min-w-0">
                        <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">Uploaded</p>
                          <p className="text-[9px] text-emerald-600/70 dark:text-emerald-500/50 truncate">inspection_photo.jpg</p>
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
                    <label className="flex-1 h-full cursor-pointer group">
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleEvidenceUpload(file);
                        }}
                        disabled={disabled || uploading.evidence}
                      />
                      <div className={`h-full flex flex-col items-center justify-center gap-1 px-3 border-2 border-dashed rounded-lg transition-all ${
                        uploading.evidence
                          ? "bg-gray-50 border-gray-200"
                          : "border-gray-200 dark:border-gray-800 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10"
                      }`}>
                        {uploading.evidence ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                            <span className="text-[10px] font-medium text-gray-500">Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                            <span className="text-[10px] font-medium text-gray-400 group-hover:text-blue-500">
                              Upload photo
                            </span>
                          </>
                        )}
                      </div>
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hierarchical Defects (No Zone Step) */}
      {hasChassis && isRejectedOrRework && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          {/* Step 3: Defect Category */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">
              Defect Category
            </label>
            <SearchSelect
              options={Object.keys(DEFECT_DATA).map(cat => ({ value: cat, label: cat }))}
              value={categoryValue}
              onChange={handleCategoryChange}
              placeholder="Select Category..."
              readOnly={disabled}
              className="bg-white dark:bg-gray-950"
            />
          </div>

          {/* Step 4: Specific Defects */}
          {categoryValue && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
              <div className="space-y-3">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">
                  Select Specific Defects
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DEFECT_DATA[categoryValue].map((defect) => {
                    const defectObj = specificDefects.find((d: any) => (typeof d === 'string' ? d === defect : d.name === defect));
                    const isSelected = !!defectObj;
                    
                    return (
                      <button
                        key={defect}
                        type="button"
                        onClick={() => !disabled && handleDefectToggle(defect)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] font-medium transition-all ${
                          isSelected
                            ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/10"
                            : "bg-white dark:bg-gray-950 border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-200"
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-all ${
                          isSelected ? "bg-blue-500 border-blue-500" : "border-gray-300"
                        }`}>
                          {isSelected && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                        </div>
                        {defect}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Detailed Remarks and Evidence Section */}
              {specificDefects.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-4 duration-500">
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">
                    Defect Details & Evidence
                  </label>
                  <div className="space-y-6">
                    {specificDefects.map((defectObj: any) => {
                      const defectName = typeof defectObj === 'string' ? defectObj : defectObj.name;
                      return (
                        <div key={defectName} className="p-4 rounded-xl bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 space-y-4 shadow-sm">
                          <div className="flex items-center gap-2 pb-2 border-b border-gray-50 dark:border-gray-900">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="text-[12px] font-bold text-gray-700 dark:text-gray-200">
                              {defectName}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Remark Input */}
                            <div className="space-y-1.5">
                              <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                                <MessageSquare className="w-3 h-3" /> Remark
                              </label>
                              <textarea
                                value={typeof defectObj === 'string' ? "" : defectObj.remark || ""}
                                onChange={(e) => handleDefectUpdate(defectName, { remark: e.target.value })}
                                disabled={disabled}
                                placeholder="Add details about this defect..."
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 min-h-[80px] resize-none"
                              />
                            </div>

                            {/* File Upload */}
                            <div className="space-y-1.5">
                              <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                                <Upload className="w-3 h-3" /> Evidence
                              </label>
                              <div className="flex items-center gap-2 h-[80px]">
                                {defectObj.fileUrl ? (
                                  <div className="flex-1 h-full flex items-center justify-between px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-lg">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                      <div className="min-w-0">
                                        <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">Uploaded</p>
                                        <p className="text-[9px] text-emerald-600/70 dark:text-emerald-500/50 truncate">evidence_photo.jpg</p>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleDefectUpdate(defectName, { fileUrl: "" })}
                                      className="p-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-800/50 rounded-full transition-colors"
                                    >
                                      <X className="w-4 h-4 text-emerald-600" />
                                    </button>
                                  </div>
                                ) : (
                                  <label className="flex-1 h-full cursor-pointer group">
                                    <input
                                      type="file"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFileUpload(defectName, file);
                                      }}
                                      disabled={disabled || uploading[defectName]}
                                    />
                                    <div className={`h-full flex flex-col items-center justify-center gap-1 px-3 border-2 border-dashed rounded-lg transition-all ${
                                      uploading[defectName]
                                        ? "bg-gray-50 border-gray-200"
                                        : "border-gray-200 dark:border-gray-800 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10"
                                    }`}>
                                      {uploading[defectName] ? (
                                        <>
                                          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                          <span className="text-[10px] font-medium text-gray-500">Uploading...</span>
                                        </>
                                      ) : (
                                        <>
                                          <Upload className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                                          <span className="text-[10px] font-medium text-gray-400 group-hover:text-blue-500">
                                            Upload photo
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </label>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Validation Message */}
      {hasChassis && statusValue && !isApplied && (
        <div className="pt-2">
          {isRejectedOrRework ? (
            (!categoryValue || specificDefects.length === 0) && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/50">
                <AlertCircle className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-tight">
                  {!categoryValue ? 'Select a category' : 'Select at least one defect'}
                </span>
              </div>
            )
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-gray-800">
              <CheckCircle className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-tight">Accepted - Ready to proceed</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChassisWithoutZone;
