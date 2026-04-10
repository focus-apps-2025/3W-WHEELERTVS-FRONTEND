import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  AlertCircle, 
  CheckCircle, 
  Camera, 
  RotateCcw, 
  XCircle, 
  ChevronRight, 
  Layers, 
  MessageSquare, 
  Upload, 
  Loader2, 
  X, 
  ChevronDown, 
  FolderOpen, 
  Tag 
} from "lucide-react";
import { apiClient } from "../../api/client";
import CameraCapture from "./CameraCapture";

interface ChassisWithZoneProps {
  value: any;
  onChange: (value: any) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
  isApplied?: boolean;
  hideChassisNumber?: boolean;
  suggestions?: any[];
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
  "Sealant defects": [
    "Sealant missing", "Incomplete sealant", "Uneven bead", "Excess sealant", 
    "Selant overflow", "Sealant lifting", "Sealant gap", 
    "Discontinuous sealant", "Sealant crack", "Water leakage", "Sealant peeling"
  ],
  "Handling defects": [
    "Dent", "Bend", "Paint damage", "Scratch", "Rust due to storage", 
    "Packing damage", "Transit damage", "Part rubbing damage"
  ]
};

const ZONES = ["Zone A+", "Zone A", "Zone B", "Zone C"];

// Hierarchical Data Structure
interface DefectDetail {
  remark: string;
  fileUrl: string;
}

interface SpecificDefect {
  name: string;
  details: DefectDetail;
}

interface DefectCategory {
  name: string;
  defects: SpecificDefect[];
}

interface ZoneData {
  categories: DefectCategory[];
}

// Multi-Select Dropdown Component with Portal
interface MultiSelectDropdownProps {
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  disabled?: boolean;
  label?: string;
  showCount?: boolean;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  options,
  selectedValues,
  onChange,
  placeholder,
  disabled,
  label,
  showCount = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    const updatePosition = () => {
      if (buttonRef.current && isOpen) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', updatePosition);
    window.addEventListener('resize', updatePosition);
    
    if (isOpen) {
      updatePosition();
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  const toggleOption = (option: string) => {
    if (selectedValues.includes(option)) {
      onChange(selectedValues.filter(v => v !== option));
    } else {
      onChange([...selectedValues, option]);
    }
  };

  const toggleAll = () => {
    if (selectedValues.length === options.length) {
      onChange([]);
    } else {
      onChange([...options]);
    }
  };

  const getDisplayText = () => {
    if (selectedValues.length === 0) return placeholder;
    if (showCount) {
      return `${selectedValues.length} defect${selectedValues.length !== 1 ? 's' : ''} selected`;
    }
    if (selectedValues.length <= 2) {
      return selectedValues.join(', ');
    }
    return `${selectedValues.slice(0, 2).join(', ')} +${selectedValues.length - 2} more`;
  };

  return (
    <div className="relative">
      {label && (
        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1 mb-2">
          {label}
        </label>
      )}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-lg text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 flex items-center justify-between"
      >
        <span className="truncate">
          {getDisplayText()}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && !disabled && createPortal(
        <div 
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            zIndex: 99999,
          }}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto"
        >
          <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 p-2 z-10">
            <button
              type="button"
              onClick={toggleAll}
              className="text-[10px] font-medium text-blue-600 hover:text-blue-700"
            >
              {selectedValues.length === options.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          {options.map(option => (
            <label
              key={option}
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedValues.includes(option)}
                onChange={() => toggleOption(option)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
                {option}
              </span>
            </label>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

// Component for Defect Details (Remarks & Evidence) with Camera Support
interface DefectDetailsProps {
  zone: string;
  category: string;
  defectName: string;
  details: DefectDetail;
  onUpdate: (updates: Partial<DefectDetail>) => void;
  onFileUpload: (file: File) => Promise<void>;
  disabled?: boolean;
  uploading?: boolean;
}

const DefectDetails: React.FC<DefectDetailsProps> = ({
  zone,
  category,
  defectName,
  details,
  onUpdate,
  onFileUpload,
  disabled,
  uploading
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [localUploading, setLocalUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLocalUploading(true);
      try {
        await onFileUpload(file);
      } finally {
        setLocalUploading(false);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCameraCapture = async (file: File, remark?: string) => {
    setLocalUploading(true);
    try {
      await onFileUpload(file);
      // If remark is provided from camera, update it
      if (remark) {
        onUpdate({ remark });
      }
      setShowCamera(false);
    } finally {
      setLocalUploading(false);
    }
  };

  const isUploading_ = uploading || localUploading;

  return (
    <>
      <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
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
              value={details.remark || ""}
              onChange={(e) => onUpdate({ remark: e.target.value })}
              disabled={disabled || isUploading_}
              placeholder={`Add details about this defect in ${zone} > ${category}...`}
              className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 min-h-[80px] resize-none"
            />
          </div>
          
          {/* File Upload with Camera Option */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
              <Upload className="w-3 h-3" /> Evidence
            </label>
            <div className="flex items-center gap-2 h-[80px]">
              {details.fileUrl && details.fileUrl !== "uploading" ? (
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
                    onClick={() => onUpdate({ fileUrl: "" })}
                    className="p-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-800/50 rounded-full transition-colors"
                    disabled={isUploading_}
                  >
                    <X className="w-4 h-4 text-emerald-600" />
                  </button>
                </div>
              ) : (
                <div className="flex-1 h-full flex gap-2">
                  {/* File Upload Button */}
                  <label className="flex-1 cursor-pointer group">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={disabled || isUploading_}
                      accept="image/*"
                      capture="environment"
                    />
                    <div className={`h-full flex flex-col items-center justify-center gap-1 px-3 border-2 border-dashed rounded-lg transition-all ${
                      isUploading_
                        ? "bg-gray-50 border-gray-200"
                        : "border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10"
                    }`}>
                      {isUploading_ ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                          <span className="text-[10px] font-medium text-gray-500">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                          <span className="text-[10px] font-medium text-gray-400 group-hover:text-blue-500">
                            Upload
                          </span>
                        </>
                      )}
                    </div>
                  </label>

                  {/* Camera Button */}
                  <button
                    type="button"
                    onClick={() => setShowCamera(true)}
                    disabled={disabled || isUploading_}
                    className="flex-1 flex flex-col items-center justify-center gap-1 px-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-all disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4 text-gray-400 group-hover:text-purple-500" />
                    <span className="text-[10px] font-medium text-gray-400 group-hover:text-purple-500">
                      Camera
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Camera Modal */}
      {showCamera && createPortal(
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
          disabled={disabled || isUploading_}
        />,
        document.body
      )}
    </>
  );
};

const ChassisWithZone: React.FC<ChassisWithZoneProps> = ({
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
  const zoneValue = value?.zone || [];
  
  // Hierarchical data structure
  const zonesData = value?.zonesData || {};
  
  const evidenceUrl = value?.evidenceUrl || "";
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [expandedZone, setExpandedZone] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<Record<string, boolean>>({});
  const [showMainCamera, setShowMainCamera] = useState(false);

  // Auto-expand first zone when zones are selected
  useEffect(() => {
    if (zoneValue.length > 0 && !expandedZone) {
      setExpandedZone(zoneValue[0]);
    }
  }, [zoneValue]);

  const updateValue = (updates: any) => {
    onChange({
      chassisNumber: chassisValue,
      status: statusValue,
      zone: zoneValue,
      zonesData: zonesData,
      evidenceUrl: evidenceUrl,
      ...updates
    });
  };

  const handleChassisChange = (val: string) => updateValue({ chassisNumber: val });

  const handleStatusChange = (val: string) => {
    if (val === 'Accepted') {
      updateValue({ status: val, zone: [], zonesData: {} });
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

  const handleMainCameraCapture = async (file: File, remark?: string) => {
    await handleEvidenceUpload(file);
    setShowMainCamera(false);
  };

  const handleZoneToggle = (zone: string) => {
    if (disabled) return;
    
    let nextZones: string[];
    let nextZonesData = { ...zonesData };
    
    if (zoneValue.includes(zone)) {
      nextZones = zoneValue.filter((z: string) => z !== zone);
      delete nextZonesData[zone];
    } else {
      nextZones = [...zoneValue, zone];
      if (!nextZonesData[zone]) {
        nextZonesData[zone] = { categories: [] };
      }
    }
    
    updateValue({ zone: nextZones, zonesData: nextZonesData });
  };

  // Handle category selection via dropdown
  const handleCategoriesChange = (zone: string, selectedCategories: string[]) => {
    const zoneData = zonesData[zone] || { categories: [] };
    
    // Find categories to add and remove
    const existingCategories = zoneData.categories.map((cat: DefectCategory) => cat.name);
    const categoriesToAdd = selectedCategories.filter(cat => !existingCategories.includes(cat));
    const categoriesToRemove = existingCategories.filter(cat => !selectedCategories.includes(cat));
    
    let updatedCategories = [...zoneData.categories];
    
    // Add new categories
    categoriesToAdd.forEach(category => {
      updatedCategories.push({ name: category, defects: [] });
      // Auto-expand newly added category
      setExpandedCategory(prev => ({ ...prev, [`${zone}-${category}`]: true }));
    });
    
    // Remove categories
    categoriesToRemove.forEach(category => {
      updatedCategories = updatedCategories.filter((cat: DefectCategory) => cat.name !== category);
    });
    
    const updatedZonesData = {
      ...zonesData,
      [zone]: {
        categories: updatedCategories
      }
    };
    
    updateValue({ zonesData: updatedZonesData });
  };

  // Get selected categories for a zone
  const getSelectedCategoriesForZone = (zone: string): string[] => {
    const zoneData = zonesData[zone];
    if (!zoneData) return [];
    return zoneData.categories.map((cat: DefectCategory) => cat.name);
  };

  // Handle defect selection via dropdown for a category
  const handleDefectsChange = (zone: string, categoryName: string, selectedDefects: string[]) => {
    const zoneData = zonesData[zone];
    if (!zoneData) return;
    
    const categoryIndex = zoneData.categories.findIndex((cat: DefectCategory) => cat.name === categoryName);
    if (categoryIndex === -1) return;
    
    // Find defects to add and remove
    const existingDefects = zoneData.categories[categoryIndex].defects.map((def: SpecificDefect) => def.name);
    const defectsToAdd = selectedDefects.filter(def => !existingDefects.includes(def));
    const defectsToRemove = existingDefects.filter(def => !selectedDefects.includes(def));
    
    let updatedDefects = [...zoneData.categories[categoryIndex].defects];
    
    // Add new defects
    defectsToAdd.forEach(defect => {
      updatedDefects.push({ name: defect, details: { remark: "", fileUrl: "" } });
    });
    
    // Remove defects
    defectsToRemove.forEach(defect => {
      updatedDefects = updatedDefects.filter((def: SpecificDefect) => def.name !== defect);
    });
    
    const updatedCategories = [...zoneData.categories];
    updatedCategories[categoryIndex] = {
      ...updatedCategories[categoryIndex],
      defects: updatedDefects
    };
    
    const updatedZonesData = {
      ...zonesData,
      [zone]: {
        categories: updatedCategories
      }
    };
    
    updateValue({ zonesData: updatedZonesData });
  };

  // Get selected defects for a category
  const getSelectedDefectsForCategory = (zone: string, categoryName: string): string[] => {
    const zoneData = zonesData[zone];
    if (!zoneData) return [];
    
    const category = zoneData.categories.find((cat: DefectCategory) => cat.name === categoryName);
    if (!category) return [];
    
    return category.defects.map((def: SpecificDefect) => def.name);
  };

  // Update defect details
  const updateDefectDetails = async (
    zone: string, 
    categoryName: string, 
    defectName: string, 
    updates: Partial<DefectDetail>
  ) => {
    const zoneData = zonesData[zone];
    if (!zoneData) return;
    
    const categoryIndex = zoneData.categories.findIndex((cat: DefectCategory) => cat.name === categoryName);
    if (categoryIndex === -1) return;
    
    const defectIndex = zoneData.categories[categoryIndex].defects.findIndex(
      (def: SpecificDefect) => def.name === defectName
    );
    if (defectIndex === -1) return;
    
    const updatedCategories = [...zoneData.categories];
    updatedCategories[categoryIndex] = {
      ...updatedCategories[categoryIndex],
      defects: updatedCategories[categoryIndex].defects.map((def, idx) => 
        idx === defectIndex 
          ? { ...def, details: { ...def.details, ...updates } }
          : def
      )
    };
    
    const updatedZonesData = {
      ...zonesData,
      [zone]: {
        categories: updatedCategories
      }
    };
    
    updateValue({ zonesData: updatedZonesData });
  };

  // Handle file upload for a defect
  const handleDefectFileUpload = async (
    zone: string, 
    categoryName: string, 
    defectName: string, 
    file: File
  ) => {
    const uploadKey = `${zone}-${categoryName}-${defectName}`;
    
    try {
      setUploading(prev => ({ ...prev, [uploadKey]: true }));
      const result = await apiClient.uploadFile(file, "form");
      const uploadedUrl = apiClient.resolveUploadedFileUrl(result);
      
      if (uploadedUrl) {
        await updateDefectDetails(zone, categoryName, defectName, { fileUrl: uploadedUrl });
      }
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to upload file");
    } finally {
      setUploading(prev => ({ ...prev, [uploadKey]: false }));
    }
  };

  const hasChassis = hideChassisNumber || chassisValue.trim().length > 0;
  const isRejectedOrRework = statusValue === 'Rejected' || statusValue === 'Rework';

  const reworkCount = suggestions?.filter(s => {
    const status = s.answers?.status || (s.value && typeof s.value === 'object' ? s.value.status : null);
    return status === 'Rework';
  }).length || 0;

  const getAllDefectsForCategory = (categoryName: string): string[] => {
    return DEFECT_DATA[categoryName] || [];
  };

  const renderFieldSuggestions = (field: string, currentVal: any, onSelect: (val: any) => void) => {
    if (!suggestions || suggestions.length === 0) return null;

    const matches = suggestions
      .map((s) => ({
        rank: s.rank,
        value: s.answers?.[field],
      }))
      .filter(
        (m) =>
          m.value !== undefined &&
          m.value !== null &&
          String(m.value).trim() !== "" &&
          JSON.stringify(m.value) !== JSON.stringify(currentVal)
      );

    if (matches.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1.5 mt-1.5 items-center">
      </div>
    );
  };

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
        <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-2">
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
          {renderFieldSuggestions('status', statusValue, handleStatusChange)}
          
          {/* Evidence Upload for Accepted Status with Camera Option */}
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
                    <div className="flex h-full gap-2">
                      {/* File Upload Button */}
                      <label className="flex-1 cursor-pointer group">
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleEvidenceUpload(file);
                          }}
                          disabled={disabled || uploading.evidence}
                          accept="image/*"
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
                                Upload
                              </span>
                            </>
                          )}
                        </div>
                      </label>

                      {/* Camera Button */}
                      <button
                        type="button"
                        onClick={() => setShowMainCamera(true)}
                        disabled={disabled || uploading.evidence}
                        className="flex-1 flex flex-col items-center justify-center gap-1 px-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-all disabled:opacity-50"
                      >
                        <Camera className="w-4 h-4 text-gray-400 group-hover:text-purple-500" />
                        <span className="text-[10px] font-medium text-gray-400 group-hover:text-purple-500">
                          Camera
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Camera Modal */}
      {showMainCamera && createPortal(
        <CameraCapture
          onCapture={handleMainCameraCapture}
          onClose={() => setShowMainCamera(false)}
          disabled={disabled || uploading.evidence}
        />,
        document.body
      )}

      {/* Step 3: Zone Clarification with Hierarchical Structure */}
      {hasChassis && isRejectedOrRework && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">
              <Layers className="w-3.5 h-3.5" /> Zone Clarification
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ZONES.map((zone) => (
                <button
                  key={zone}
                  type="button"
                  onClick={() => handleZoneToggle(zone)}
                  disabled={disabled}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] font-medium transition-all ${
                    zoneValue.includes(zone)
                      ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 shadow-sm"
                      : "bg-white dark:bg-gray-950 border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-200"
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-all ${
                    zoneValue.includes(zone) ? "bg-blue-500 border-blue-500" : "border-gray-300"
                  }`}>
                    {zoneValue.includes(zone) && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                  </div>
                  {zone}
                </button>
              ))}
            </div>
            {renderFieldSuggestions('zone', zoneValue, (val) => updateValue({ zone: val }))}
          </div>

          {/* Zones Container with Hierarchical Selection */}
          {zoneValue.length > 0 && (
            <div className="space-y-4 mt-6">
              {zoneValue.map((zone: string) => {
                const isZoneExpanded = expandedZone === zone;
                const zoneData = zonesData[zone] || { categories: [] };
                const selectedCategories = getSelectedCategoriesForZone(zone);
                
                return (
                  <div 
                    key={zone}
                    className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-gray-950 shadow-sm"
                  >
                    {/* Zone Header */}
                    <button
                      type="button"
                      onClick={() => setExpandedZone(isZoneExpanded ? null : zone)}
                      className={`w-full flex items-center justify-between p-3 transition-colors ${
                        isZoneExpanded ? "bg-blue-50/50 dark:bg-blue-900/10" : "hover:bg-gray-50 dark:hover:bg-gray-900/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isZoneExpanded ? 'rotate-90' : ''}`} />
                        <Layers className="w-4 h-4 text-blue-500" />
                        <span className="text-[13px] font-bold text-gray-700 dark:text-gray-200">
                          {zone}
                        </span>
                        {zoneData.categories.length > 0 && (
                          <span className="text-[10px] font-medium text-blue-600 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full">
                            {zoneData.categories.length} categories
                          </span>
                        )}
                      </div>
                    </button>
                    
                    {/* Zone Content */}
                    {isZoneExpanded && (
                      <div className="p-4 space-y-4 border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-2">
                        {/* Defect Categories - Multi-Select Dropdown */}
                        <div className="overflow-visible">
                          <MultiSelectDropdown
                            options={Object.keys(DEFECT_DATA)}
                            selectedValues={selectedCategories}
                            onChange={(selected) => handleCategoriesChange(zone, selected)}
                            placeholder="Select defect categories..."
                            disabled={disabled}
                            label="Defect Categories"
                          />
                        </div>
                        
                        {/* Categories Section with Defects Dropdowns */}
                        {zoneData.categories.length > 0 && (
                          <div className="space-y-4 mt-4">
                            {zoneData.categories.map((category: DefectCategory) => {
                              const catKey = `${zone}-${category.name}`;
                              const isCategoryExpanded = expandedCategory[catKey];
                              const allDefects = getAllDefectsForCategory(category.name);
                              const selectedDefects = getSelectedDefectsForCategory(zone, category.name);
                              
                              return (
                                <div 
                                  key={category.name}
                                  className="ml-4 border-l-2 border-gray-200 dark:border-gray-700 pl-4 space-y-3"
                                >
                                  {/* Category Header */}
                                  <div className="flex items-center justify-between">
                                    <button
                                      type="button"
                                      onClick={() => setExpandedCategory(prev => ({ 
                                        ...prev, 
                                        [catKey]: !prev[catKey] 
                                      }))}
                                      className="flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 px-2 py-1 rounded-lg transition-colors"
                                    >
                                      <ChevronRight className={`w-3 h-3 text-gray-500 transition-transform ${isCategoryExpanded ? 'rotate-90' : ''}`} />
                                      <FolderOpen className="w-3.5 h-3.5 text-purple-500" />
                                      <span className="text-[12px] font-semibold text-gray-700 dark:text-gray-300">
                                        {category.name}
                                      </span>
                                      {category.defects.length > 0 && (
                                        <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50 px-2 py-0.5 rounded-full">
                                          {category.defects.length} defects
                                        </span>
                                      )}
                                    </button>
                                  </div>
                                  
                                  {/* Category Content */}
                                  {isCategoryExpanded && (
                                    <div className="ml-6 space-y-4">
                                      {/* Specific Defects - Multi-Select Dropdown */}
                                      <div className="overflow-visible">
                                        <MultiSelectDropdown
                                          options={allDefects}
                                          selectedValues={selectedDefects}
                                          onChange={(selected) => handleDefectsChange(zone, category.name, selected)}
                                          placeholder="Select specific defects..."
                                          disabled={disabled}
                                          label="Specific Defects"
                                          showCount={true}
                                        />
                                      </div>
                                      
                                      {/* Defects Details Section */}
                                      {category.defects.length > 0 && (
                                        <div className="space-y-4 pt-2">
                                          {category.defects.map((defect: SpecificDefect) => {
                                            const uploadKey = `${zone}-${category.name}-${defect.name}`;
                                            
                                            return (
                                              <DefectDetails
                                                key={defect.name}
                                                zone={zone}
                                                category={category.name}
                                                defectName={defect.name}
                                                details={defect.details}
                                                onUpdate={(updates) => updateDefectDetails(zone, category.name, defect.name, updates)}
                                                onFileUpload={(file) => handleDefectFileUpload(zone, category.name, defect.name, file)}
                                                disabled={disabled}
                                                uploading={uploading[uploadKey]}
                                              />
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChassisWithZone;
