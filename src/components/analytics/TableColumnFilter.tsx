import React, { useState, useRef, useEffect } from "react";
import { Filter, Search } from "lucide-react";

interface TableColumnFilterProps {
  columnId: string;
  title: string;
  options: string[];
  selectedValues: string[];
  onFilterChange: (columnId: string, values: string[] | null) => void;
}

export default function TableColumnFilter({
  columnId,
  title,
  options,
  selectedValues,
  onFilterChange,
}: TableColumnFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.right + window.scrollX - 256
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
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

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // If selectedValues is null, it means "All Selected" (no filter)
  // We convert it to a Set for easier checking, or treat as all options
  const effectiveSelectedValues = selectedValues === null ? options : selectedValues;

  const toggleOption = (option: string) => {
    let newValues: string[];
    
    if (selectedValues === null) {
        // If currently "All", and we toggle one, we are deselecting it
        // So new state is ALL options except this one
        newValues = options.filter(o => o !== option);
    } else {
        if (selectedValues.includes(option)) {
            newValues = selectedValues.filter((v) => v !== option);
        } else {
            newValues = [...selectedValues, option];
        }
    }
    
    // If we end up selecting everything, revert to null (no filter)
    if (newValues.length === options.length && options.length > 0) {
        onFilterChange(columnId, null);
    } else {
        onFilterChange(columnId, newValues);
    }
  };

  const handleSelectAll = () => {
    if (effectiveSelectedValues.length === filteredOptions.length && searchTerm === "") {
        // If showing all and everything selected, deselect all
        // OR if filter is active, and we have selected everything visible
        onFilterChange(columnId, []);
    } else {
        // If search is active, we might want to just add visible ones?
        // Simple behavior: Select All means reset to No Filter (null) if no search
        if (searchTerm === "") {
             onFilterChange(columnId, null);
        } else {
             // If search active, add all filtered options to selection
             const newValues = Array.from(new Set([...(selectedValues || []), ...filteredOptions]));
             onFilterChange(columnId, newValues);
        }
    }
  };
  
  // Specific handler for the "Select All" checkbox
  const toggleSelectAll = () => {
      if (filteredOptions.every(opt => effectiveSelectedValues.includes(opt))) {
          // Deselect all visible
          if (selectedValues === null) {
               // We were selecting all, now we want to deselect visible
               const visibleSet = new Set(filteredOptions);
               const newValues = options.filter(o => !visibleSet.has(o));
               onFilterChange(columnId, newValues);
          } else {
               const newValues = selectedValues.filter(v => !filteredOptions.includes(v));
               onFilterChange(columnId, newValues);
          }
      } else {
          // Select all visible
          if (selectedValues === null) {
              // Already all selected
          } else {
               const newValues = Array.from(new Set([...selectedValues, ...filteredOptions]));
               // If we selected everything, set to null
               if (newValues.length === options.length) {
                   onFilterChange(columnId, null);
               } else {
                   onFilterChange(columnId, newValues);
               }
          }
      }
  }

  const isFiltered = selectedValues !== null;

  return (
    <div className="inline-block ml-2">
      <button
        ref={buttonRef}
        onClick={(e) => {
             e.stopPropagation();
             setIsOpen(!isOpen);
        }}
        className={`p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
          isFiltered ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30" : "text-gray-400 dark:text-gray-500"
        }`}
        title={`Filter ${title}`}
      >
        <Filter className="w-3 h-3" />
      </button>

      {isOpen && (
        <div 
          ref={dropdownRef}
          className="fixed w-64 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-[9999]"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`
          }}
        >
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                autoFocus
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto p-2">
             <div className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md cursor-pointer mb-1"
                onClick={toggleSelectAll}
             >
                <input
                    type="checkbox"
                    checked={filteredOptions.length > 0 && filteredOptions.every(opt => effectiveSelectedValues.includes(opt))}
                    readOnly
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 pointer-events-none"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-200 font-medium">
                    (Select All)
                </span>
             </div>

            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option}
                  className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md cursor-pointer"
                  onClick={() => toggleOption(option)}
                >
                  <input
                    type="checkbox"
                    checked={effectiveSelectedValues.includes(option)}
                    onChange={() => {}} 
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 pointer-events-none"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 truncate" title={option}>
                    {option === "" ? "(Blanks)" : option}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-2 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                No matches found
              </div>
            )}
          </div>

          <div className="p-2 border-t border-gray-200 dark:border-gray-700 flex justify-between">
            <button
                onClick={() => onFilterChange(columnId, null)}
                disabled={!isFiltered}
                className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Clear Filter
            </button>
            <button
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
                Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
