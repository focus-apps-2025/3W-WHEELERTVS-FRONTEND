import React, { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, X } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface SearchSelectProps {
  options: Option[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  placeholder?: string;
  multiple?: boolean;
  required?: boolean;
  readOnly?: boolean;
  size?: "sm" | "md";
  isApplied?: boolean;
}

export default function SearchSelect({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  multiple = false,
  required = false,
  readOnly = false,
  size = "md",
  isApplied = false,
}: SearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [openUpward, setOpenUpward] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isSmall = size === "sm";

  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const dropdownHeight = isSmall ? 300 : 450; // Estimated height
      const spaceBelow = windowHeight - rect.bottom;
      
      if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }
  }, [isOpen, isSmall]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (option: Option) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      const newValues = currentValues.includes(option.value)
        ? currentValues.filter((v) => v !== option.value)
        : [...currentValues, option.value];
      onChange(newValues);
    } else {
      onChange(option.value);
      setIsOpen(false);
    }
    setSearchTerm("");
  };

  const handleRemoveValue = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      onChange(currentValues.filter((v) => v !== optionValue));
    } else {
      onChange("");
    }
  };

  const getSelectedLabels = () => {
    if (multiple && Array.isArray(value)) {
      return value.map(
        (v) => options.find((opt) => opt.value === v)?.label || v
      );
    }
    return options.find((opt) => opt.value === value)?.label || "";
  };

  return (
    <div className="relative group/select" ref={dropdownRef}>
      <div
        className={`flex items-center justify-between transition-all duration-300 shadow-sm ${
          isSmall ? "px-3 py-2 border rounded-xl" : "px-5 py-4 border-2 rounded-2xl"
        } ${
          isApplied
            ? "border-emerald-500 bg-emerald-50/30 ring-4 ring-emerald-500/10"
            : readOnly
            ? "cursor-not-allowed bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800"
            : "cursor-pointer bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md"
        } ${isOpen ? (isSmall ? "ring-2 ring-primary-50 border-primary-500 shadow-md" : "ring-4 ring-primary-50 dark:ring-primary-900/20 border-primary-500 dark:border-primary-500 shadow-lg") : ""}`}
        onClick={() => !readOnly && setIsOpen(!isOpen)}
      >
        <div className="flex-1 flex flex-wrap gap-2 mr-2">
          {multiple ? (
            Array.isArray(value) && value.length > 0 ? (
              value.map((v) => (
                <span
                  key={v}
                  className={`inline-flex items-center rounded-xl bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-bold border border-primary-100 dark:border-primary-800 animate-in fade-in zoom-in duration-200 ${
                    isSmall ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
                  }`}
                >
                  {options.find((opt) => opt.value === v)?.label || v}
                  {!readOnly && (
                    <button
                      onClick={(e) => handleRemoveValue(v, e)}
                      className="ml-2 p-0.5 hover:bg-primary-200 dark:hover:bg-primary-800 rounded-full transition-colors"
                    >
                      <X className={isSmall ? "w-2.5 h-2.5" : "w-3 h-3"} />
                    </button>
                  )}
                </span>
              ))
            ) : (
              <span className={`text-gray-400 dark:text-gray-500 font-medium italic ${isSmall ? "text-xs" : ""}`}>{placeholder}</span>
            )
          ) : (
            <span className={`tracking-tight transition-colors duration-200 ${
              isSmall ? "text-sm font-semibold" : "text-base font-bold"
            } ${value ? "text-primary-950 dark:text-white" : "text-gray-400 dark:text-gray-500 italic"}`}>
              {getSelectedLabels() || placeholder}
            </span>
          )}
        </div>
        <div className={`transition-all duration-300 ${
          isSmall ? "p-1 rounded-lg" : "p-2 rounded-xl"
        } ${isOpen ? "bg-primary-500 text-white rotate-180" : "bg-gray-50 dark:bg-gray-800 text-gray-400 group-hover/select:text-primary-500"}`}>
          <ChevronDown className={isSmall ? "w-4 h-4" : "w-5 h-5"} />
        </div>
      </div>

      {isOpen && (
        <div className={`absolute z-[100] w-full bg-white dark:bg-gray-900 border border-primary-100 dark:border-primary-900 shadow-2xl overflow-hidden animate-in fade-in duration-200 ${
          openUpward 
            ? `bottom-full slide-in-from-bottom-2 ${isSmall ? "rounded-xl mb-1" : "rounded-3xl mb-3 border-2"}` 
            : `top-full slide-in-from-top-2 ${isSmall ? "rounded-xl mt-1" : "rounded-3xl mt-3 border-2"}`
        }`}>
          <div className={`${isSmall ? "p-2" : "p-4"} bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800`}>
            <div className="relative">
              <Search className={`absolute transform -translate-y-1/2 text-primary-500 ${
                isSmall ? "left-3 w-4 h-4" : "left-4 w-5 h-5"
              } top-1/2`} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Type to filter..."
                className={`w-full bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 focus:border-primary-500 focus:ring-0 text-primary-950 dark:text-white transition-all ${
                  isSmall ? "pl-9 pr-3 py-2 rounded-lg text-xs font-semibold" : "pl-12 pr-4 py-3.5 rounded-2xl text-sm font-bold border-2"
                }`}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            </div>
          </div>
          
          <div className={`${isSmall ? "max-h-48" : "max-h-72"} overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-primary-200 dark:scrollbar-thumb-primary-800`}>
            {filteredOptions.length > 0 ? (
              <div className="grid grid-cols-1 gap-0.5">
                {filteredOptions.map((option) => {
                  const isSelected = multiple 
                    ? Array.isArray(value) && value.includes(option.value)
                    : value === option.value;
                  
                  return (
                    <div
                      key={option.value}
                      className={`cursor-pointer transition-all duration-200 flex items-center justify-between group/opt ${
                        isSmall ? "px-3 py-2 rounded-lg" : "px-5 py-4 rounded-2xl"
                      } ${
                        isSelected
                          ? "bg-primary-600 text-white shadow-lg shadow-primary-200 dark:shadow-none"
                          : "text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-300"
                      }`}
                      onClick={() => handleSelect(option)}
                    >
                      <span className={`tracking-tight ${isSmall ? "text-xs font-semibold" : "text-sm font-bold"}`}>{option.label}</span>
                      {isSelected && (
                        <div className={`${isSmall ? "w-4 h-4" : "w-6 h-6"} bg-white/20 rounded-full flex items-center justify-center`}>
                          <span className={isSmall ? "text-[8px] font-black" : "text-xs font-black"}>✓</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={`${isSmall ? "py-6" : "py-12"} flex flex-col items-center justify-center text-gray-400 dark:text-gray-600`}>
                <Search className={`${isSmall ? "w-8 h-8 mb-2" : "w-12 h-12 mb-3"} opacity-20`} />
                <p className={`${isSmall ? "text-xs" : "text-sm"} font-bold`}>No results</p>
              </div>
            )}
          </div>
        </div>
      )}

      {required && (
        <input
          type="text"
          tabIndex={-1}
          className="sr-only"
          required={
            required && (!value || (Array.isArray(value) && value.length === 0))
          }
          value={value ? "valid" : ""}
          onChange={() => {}}
        />
      )}
    </div>
  );
}
