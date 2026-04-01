import React, { useState, useEffect } from "react";
import {
  getLevel1Options,
  getLevel2Options,
  getLevel3Options,
  getLevel4Options,
  getLevel5Options,
  getLevel6Options,
} from "../../config/npsHierarchy";
import SearchSelect from "../QuestionTypes/SearchSelect";
import { Layers, ChevronRight, HelpCircle, CheckCircle2 } from "lucide-react";

interface ProductNPSBucketsProps {
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
  isApplied?: boolean;
}

const ProductNPSBuckets: React.FC<ProductNPSBucketsProps> = ({
  value,
  onChange,
  disabled,
  isApplied = false,
}) => {
  const [selections, setSelections] = useState({
    level1: value?.level1 || "",
    level2: value?.level2 || "",
    level3: value?.level3 || "",
    level4: value?.level4 || "",
    level5: value?.level5 || "",
    level6: value?.level6 || "",
  });

  useEffect(() => {
    if (value) {
      setSelections({
        level1: value.level1 || "",
        level2: value.level2 || "",
        level3: value.level3 || "",
        level4: value.level4 || "",
        level5: value.level5 || "",
        level6: value.level6 || "",
      });
    }
  }, [value]);

  const handleLevelChange = (level: string, newValue: string | string[]) => {
    const val = Array.isArray(newValue) ? newValue[0] : newValue;
    const newSelections = { ...selections, [level]: val };

    // Reset subsequent levels
    if (level === "level1") {
      newSelections.level2 = "";
      newSelections.level3 = "";
      newSelections.level4 = "";
      newSelections.level5 = "";
      newSelections.level6 = "";
    } else if (level === "level2") {
      newSelections.level3 = "";
      newSelections.level4 = "";
      newSelections.level5 = "";
      newSelections.level6 = "";
    } else if (level === "level3") {
      newSelections.level4 = "";
      newSelections.level5 = "";
      newSelections.level6 = "";
    } else if (level === "level4") {
      newSelections.level5 = "";
      newSelections.level6 = "";
    } else if (level === "level5") {
      newSelections.level6 = "";
    }

    setSelections(newSelections);
    onChange(newSelections);
  };

  const mapToOptions = (opts: string[]) => opts.map(opt => ({ value: opt, label: opt }));

  const level1Options = mapToOptions(getLevel1Options());
  const level2Options = selections.level1 ? mapToOptions(getLevel2Options(selections.level1)) : [];
  const level3Options =
    selections.level1 && selections.level2
      ? mapToOptions(getLevel3Options(selections.level1, selections.level2))
      : [];
  const level4Options =
    selections.level1 && selections.level2 && selections.level3
      ? mapToOptions(getLevel4Options(selections.level1, selections.level2, selections.level3))
      : [];
  const level5Options =
    selections.level1 &&
    selections.level2 &&
    selections.level3 &&
    selections.level4
      ? mapToOptions(getLevel5Options(
          selections.level1,
          selections.level2,
          selections.level3,
          selections.level4
        ))
      : [];
  const level6Options =
    selections.level1 &&
    selections.level2 &&
    selections.level3 &&
    selections.level4 &&
    selections.level5
      ? mapToOptions(getLevel6Options(
          selections.level1,
          selections.level2,
          selections.level3,
          selections.level4,
          selections.level5
        ))
      : [];

  const renderLevel = (
    num: number,
    label: string,
    options: { value: string; label: string }[],
    currentValue: string,
    levelKey: string,
    isVisible: boolean,
    placeholder: string
  ) => {
    if (!isVisible) return null;
    
    const isSelected = !!currentValue;
    const hasOptions = options.length > 0;

    return (
      <div 
        className="relative pl-7 pb-3 last:pb-0"
        style={{ zIndex: 70 - num * 10 }}
      >
        {/* Connection Line */}
        <div className="absolute left-[9px] top-5 bottom-0 w-0.5 bg-gray-100 dark:bg-gray-800 last:hidden" />
        
        {/* Level Indicator Dot */}
        <div className={`absolute left-0 top-0 w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10 ${
          isSelected 
            ? isApplied
              ? "bg-emerald-600 border-emerald-50 text-white shadow-sm"
              : "bg-primary-600 border-primary-50 text-white shadow-sm" 
            : "bg-white dark:bg-gray-800 border-gray-50 dark:border-gray-700 text-gray-400"
        }`}>
          {isSelected ? (
            <span className="text-[9px] font-bold">✓</span>
          ) : (
            <span className="text-[9px] font-bold">{num}</span>
          )}
        </div>

        <div className="transition-all duration-300">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <label className={`text-[9px] font-bold uppercase tracking-tight ${isSelected && isApplied ? 'text-emerald-500' : 'text-gray-400'}`}>
                L{num}: {label}
              </label>
            </div>

            <div className="max-w-md">
              <SearchSelect
                options={options}
                value={currentValue}
                onChange={(val) => handleLevelChange(levelKey, val)}
                placeholder={placeholder}
                readOnly={disabled}
                size="sm"
                isApplied={isApplied && isSelected}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`bg-white dark:bg-gray-950 rounded-xl border overflow-visible shadow-sm transition-all duration-300 ${
      isApplied ? 'border-emerald-500/30 ring-4 ring-emerald-500/5' : 'border-gray-200 dark:border-gray-800'
    }`}>
      {/* Header */}
      <div className={`px-4 py-2 border-b transition-colors duration-300 ${
        isApplied 
          ? 'bg-emerald-50/50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' 
          : 'bg-gray-50/50 dark:bg-gray-900 border-gray-200 dark:border-gray-800'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded ${isApplied ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-primary-50 dark:bg-primary-900/30'}`}>
            <Layers className={`w-3.5 h-3.5 ${isApplied ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary-600 dark:text-primary-400'}`} />
          </div>
          <h3 className={`text-xs font-bold leading-none ${isApplied ? 'text-emerald-900 dark:text-emerald-100' : 'text-gray-900 dark:text-white'}`}>
            Product Hierarchy
          </h3>
          {isApplied && (
            <span className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <CheckCircle2 className="h-2 w-2" /> Filled
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4">
        <div className="space-y-1">
          {renderLevel(1, "Complaint Groups", level1Options, selections.level1, "level1", true, "Search Primary Group...")}
          {renderLevel(2, "Sub-complaints", level2Options, selections.level2, "level2", !!selections.level1 && level2Options.length > 0, "Define Sub-complaint...")}
          {renderLevel(3, "Probing Questions", level3Options, selections.level3, "level3", !!selections.level2 && level3Options.length > 0, "Select Probing Question...")}
          {renderLevel(4, "Initial Answers", level4Options, selections.level4, "level4", !!selections.level3 && level4Options.length > 0, "Provide Initial Answer...")}
          {renderLevel(5, "Secondary Details", level5Options, selections.level5, "level5", !!selections.level4 && level5Options.length > 0, "Add Secondary Detail...")}
          {renderLevel(6, "Final Options", level6Options, selections.level6, "level6", !!selections.level5 && level6Options.length > 0, "Choose Final Selection...")}
        </div>
      </div>
    </div>
  );
};

export default ProductNPSBuckets;
