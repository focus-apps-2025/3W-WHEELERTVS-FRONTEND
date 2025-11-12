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
}

export default function SearchSelect({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  multiple = false,
  required = false,
  readOnly = false,
}: SearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    <div className="relative" ref={dropdownRef}>
      <div
        className={`flex items-center justify-between px-4 py-2 border border-gray-300 rounded-lg ${
          readOnly
            ? "cursor-not-allowed bg-gray-100"
            : "cursor-pointer bg-white"
        } ${isOpen ? "ring-2 ring-blue-500" : ""}`}
        onClick={() => !readOnly && setIsOpen(!isOpen)}
      >
        <div className="flex-1 flex flex-wrap gap-2">
          {multiple ? (
            Array.isArray(value) && value.length > 0 ? (
              value.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                >
                  {options.find((opt) => opt.value === v)?.label || v}
                  {!readOnly && (
                    <button
                      onClick={(e) => handleRemoveValue(v, e)}
                      className="ml-1 hover:text-blue-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))
            ) : (
              <span className="text-gray-500 dark:text-gray-500">{placeholder}</span>
            )
          ) : (
            <span className={value ? "text-gray-900" : "text-gray-500"}>
              {getSelectedLabels() || placeholder}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isOpen ? "transform rotate-180" : ""
          }`}
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg">
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${
                    multiple
                      ? Array.isArray(value) && value.includes(option.value)
                        ? "bg-blue-50"
                        : ""
                      : value === option.value
                      ? "bg-blue-50"
                      : ""
                  }`}
                  onClick={() => handleSelect(option)}
                >
                  {option.label}
                </div>
              ))
            ) : (
              <div className="px-4 py-2 text-gray-500 dark:text-gray-500">No options found</div>
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
