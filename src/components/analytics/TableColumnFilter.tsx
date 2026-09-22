import React, { useState, useRef, useEffect, useMemo } from "react";
import { Filter, Search, ArrowUp, ArrowDown, ArrowUpDown, X, Check } from "lucide-react";

interface TableColumnFilterProps {
  columnId: string;
  title: string;
  options: string[];
  selectedValues: string[] | null;
  onFilterChange: (columnId: string, values: string[] | null) => void;
  sortDirection?: "asc" | "desc" | null;
  onSortChange?: (columnId: string, direction: "asc" | "desc" | null) => void;
}

export default function TableColumnFilter({
  columnId,
  title,
  options,
  selectedValues,
  onFilterChange,
  sortDirection = null,
  onSortChange,
}: TableColumnFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const idealLeft = rect.right + window.scrollX - 270;
      const safeLeft = Math.max(16, Math.min(idealLeft, window.innerWidth - 290));
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: safeLeft,
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

  // Orderly natural sort of options (numeric-aware: 1031 < 1032 < 1103)
  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) => {
      const strA = String(a ?? "");
      const strB = String(b ?? "");
      if (strA === "") return 1;
      if (strB === "") return -1;
      return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [options]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return sortedOptions;
    const term = searchTerm.trim().toLowerCase();
    return sortedOptions.filter((option) =>
      String(option ?? "").toLowerCase().includes(term)
    );
  }, [sortedOptions, searchTerm]);

  const DISPLAY_LIMIT = 100;
  const displayedOptions = filteredOptions.slice(0, DISPLAY_LIMIT);

  const effectiveSelectedValues = selectedValues === null ? options : selectedValues;
  const effectiveSelectedSet = useMemo(() => new Set(effectiveSelectedValues), [effectiveSelectedValues]);

  const isOptionSelected = (option: string) => {
    if (selectedValues === null) return true;
    return effectiveSelectedSet.has(option);
  };

  const handleSelectOnly = (option: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onFilterChange(columnId, [option]);
  };

  const handleSelectOnlySearchResults = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (filteredOptions.length === 0) return;
    if (filteredOptions.length === options.length) {
      onFilterChange(columnId, null);
    } else {
      onFilterChange(columnId, filteredOptions);
    }
  };

  const toggleOption = (option: string) => {
    let newValues: string[];
    if (selectedValues === null) {
      if (searchTerm.trim()) {
        newValues = [option];
      } else {
        newValues = options.filter((o) => o !== option);
      }
    } else {
      if (selectedValues.includes(option)) {
        newValues = selectedValues.filter((v) => v !== option);
      } else {
        newValues = [...selectedValues, option];
      }
    }
    if (newValues.length === options.length && options.length > 0) {
      onFilterChange(columnId, null);
    } else {
      onFilterChange(columnId, newValues);
    }
  };

  const isAllFilteredSelected = useMemo(() => {
    if (filteredOptions.length === 0) return false;
    return filteredOptions.every((opt) => isOptionSelected(opt));
  }, [filteredOptions, selectedValues, effectiveSelectedSet]);

  const isSomeFilteredSelected = useMemo(() => {
    if (filteredOptions.length === 0) return false;
    return filteredOptions.some((opt) => isOptionSelected(opt)) && !isAllFilteredSelected;
  }, [filteredOptions, selectedValues, effectiveSelectedSet, isAllFilteredSelected]);

  const toggleSelectAll = () => {
    if (searchTerm.trim()) {
      if (isAllFilteredSelected) {
        if (selectedValues === null) {
          const matchingSet = new Set(filteredOptions);
          const newValues = options.filter((o) => !matchingSet.has(o));
          onFilterChange(columnId, newValues);
        } else {
          const matchingSet = new Set(filteredOptions);
          const newValues = selectedValues.filter((v) => !matchingSet.has(v));
          onFilterChange(columnId, newValues);
        }
      } else {
        if (selectedValues === null) {
          onFilterChange(columnId, filteredOptions);
        } else {
          const combined = Array.from(new Set([...selectedValues, ...filteredOptions]));
          if (combined.length === options.length) {
            onFilterChange(columnId, null);
          } else {
            onFilterChange(columnId, combined);
          }
        }
      }
    } else {
      if (selectedValues === null || selectedValues.length === options.length) {
        onFilterChange(columnId, []);
      } else {
        onFilterChange(columnId, null);
      }
    }
  };

  const handleApplyDone = () => {
    if (searchTerm.trim() && selectedValues === null && filteredOptions.length > 0) {
      onFilterChange(columnId, filteredOptions);
    }
    setIsOpen(false);
  };

  const isFiltered = selectedValues !== null;
  const isSorted = sortDirection !== null;
  const selectedCount = selectedValues === null ? options.length : selectedValues.length;

  return (
    <div className="inline-flex items-center gap-0.5 ml-1.5">
      {onSortChange && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!sortDirection) {
              onSortChange(columnId, "asc");
            } else if (sortDirection === "asc") {
              onSortChange(columnId, "desc");
            } else {
              onSortChange(columnId, null);
            }
          }}
          className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
            isSorted
              ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30"
              : "text-gray-400 hover:text-gray-600 dark:text-gray-500"
          }`}
          title={`Sort ${title}`}
        >
          {sortDirection === "asc" ? (
            <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
          ) : sortDirection === "desc" ? (
            <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
          ) : (
            <ArrowUpDown className="w-3 h-3" />
          )}
        </button>
      )}
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors relative ${
          isFiltered
            ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 font-bold"
            : "text-gray-400 dark:text-gray-500"
        }`}
        title={`Filter ${title}`}
      >
        <Filter className="w-3 h-3" />
        {isFiltered && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-600 rounded-full ring-2 ring-white dark:ring-gray-900" />
        )}
      </button>
      {isOpen && (
        <div
          ref={dropdownRef}
          className="fixed w-72 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-2.5 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate" title={title}>
              FILTER: {title.toUpperCase()}
            </span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
              {isFiltered ? `${selectedCount} OF ${options.length}` : "All selected"}
            </span>
          </div>
          {/* Search Box */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <input
                type="text"
                placeholder={`Search ${title.toLowerCase()}... (Press Enter)`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (filteredOptions.length > 0) {
                      onFilterChange(columnId, filteredOptions);
                    }
                    setIsOpen(false);
                  }
                }}
                className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                autoFocus
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {/* Quick action buttons when searching */}
            {searchTerm.trim() && (
              <div className="flex items-center justify-between gap-1 mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700/60">
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                  {filteredOptions.length} match{filteredOptions.length === 1 ? "" : "es"}
                </span>
                {filteredOptions.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectOnlySearchResults}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 px-2 py-0.5 rounded transition-colors"
                  >
                    Select Only Results ({filteredOptions.length})
                  </button>
                )}
              </div>
            )}
          </div>
          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1.5 scrollbar-thin">
            <div
              className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700/60 rounded-md cursor-pointer mb-1 border-b border-gray-100 dark:border-gray-700/50"
              onClick={toggleSelectAll}
            >
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={isAllFilteredSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = isSomeFilteredSelected;
                  }}
                  readOnly
                  className="w-3.5 h-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 pointer-events-none"
                />
                <span className="ml-2 text-xs text-gray-700 dark:text-gray-200 font-bold">
                  {searchTerm.trim() ? "(SELECT ALL RESULTS)" : "(SELECT ALL)"}
                </span>
              </div>
              <span className="text-[10px] text-gray-400 font-medium">
                {filteredOptions.length}
              </span>
            </div>
            {filteredOptions.length > 0 ? (
              <>
                {displayedOptions.map((option) => {
                  const selected = isOptionSelected(option);
                  return (
                    <div
                      key={option}
                      className={`group flex items-center justify-between px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700/60 rounded cursor-pointer transition-colors ${
                        selected ? "bg-indigo-50/40 dark:bg-indigo-950/20" : ""
                      }`}
                      onClick={() => toggleOption(option)}
                    >
                      <div className="flex items-center min-w-0 flex-1 mr-2">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 pointer-events-none shrink-0"
                        />
                        <span
                          className={`ml-2 text-xs truncate ${
                            selected
                              ? "text-gray-900 dark:text-white font-semibold"
                              : "text-gray-600 dark:text-gray-400"
                          }`}
                          title={option}
                        >
                          {option === "" ? "(Blanks)" : option}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleSelectOnly(option, e)}
                        className="opacity-0 group-hover:opacity-100 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-1 py-0.5 rounded transition-opacity shrink-0"
                        title={`Select only "${option}"`}
                      >
                        Only
                      </button>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="px-2 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
                No matching options found
              </div>
            )}
          </div>
          {/* Actions */}
          <div className="p-2 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <button
              onClick={() => {
                onFilterChange(columnId, null);
                setSearchTerm("");
              }}
              disabled={!isFiltered}
              className="px-2.5 py-1 text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Clear Filter
            </button>
            <button
              onClick={handleApplyDone}
              className="px-3 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
