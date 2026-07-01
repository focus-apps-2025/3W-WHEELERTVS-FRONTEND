import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";

interface MultiSelectDropdownProps {
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  label?: string;
}

export default function MultiSelectDropdown({
  options,
  selectedValues,
  onChange,
  placeholder = "Select options...",
  label,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (option: string) => {
    const newValues = selectedValues.includes(option)
      ? selectedValues.filter((v) => v !== option)
      : [...selectedValues, option];
    onChange(newValues);
  };

  const handleRemove = (option: string) => {
    onChange(selectedValues.filter((v) => v !== option));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label}
        </label>
      )}
      
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-2 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center justify-between"
        >
          <div className="flex items-center gap-2 flex-1">
            {selectedValues.length === 0 ? (
              <span className="text-gray-500 dark:text-gray-400">
                {placeholder}
              </span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {selectedValues.slice(0, 2).map((value) => (
                  <span
                    key={value}
                    className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-200 text-xs rounded"
                  >
                    {value}
                  </span>
                ))}
                {selectedValues.length > 2 && (
                  <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded">
                    +{selectedValues.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${
              isOpen ? "transform rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div className="max-h-60 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                  No options found
                </div>
              ) : (
                <div className="py-2">
                  {filteredOptions.map((option) => (
                    <label
                      key={option}
                      className="flex items-center px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedValues.includes(option)}
                        onChange={() => handleSelect(option)}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="ml-3 text-sm text-gray-900 dark:text-white">
                        {option}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {selectedValues.length > 0 && (
              <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => onChange([])}
                  className="w-full text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium py-1"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedValues.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedValues.map((value) => (
            <div
              key={value}
              className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-200 rounded-full text-sm flex items-center gap-2"
            >
              {value}
              <button
                onClick={() => handleRemove(value)}
                className="hover:text-indigo-700 dark:hover:text-indigo-100"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
