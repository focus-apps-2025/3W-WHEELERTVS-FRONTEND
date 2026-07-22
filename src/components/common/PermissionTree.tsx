import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Minus } from "lucide-react";
import {
  PermissionNode,
  getAllLeafIds,
  getNodeLeafIds,
} from "../../config/permissionTree";

interface PermissionTreeProps {
  nodes: PermissionNode[];
  /** Currently selected LEAF ids only. */
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  /** Default expand/collapse state for branches. Default: true (expanded). */
  defaultExpanded?: boolean;
  /** Hide the top "Select All / Clear All" bar. */
  hideGlobalSelectAll?: boolean;
  className?: string;
}

/** Tri-state checkbox that supports the native `indeterminate` DOM property. */
function TriStateCheckbox({
  checked,
  indeterminate,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={ariaLabel}
      className="w-5 h-5 rounded border-gray-300 dark:border-gray-500 text-blue-600 dark:text-blue-500 focus:ring-2 focus:ring-blue-500 cursor-pointer shrink-0"
      checked={checked}
      onChange={onChange}
    />
  );
}

function TreeNode({
  node,
  depth,
  selected,
  toggleLeaves,
  expanded,
  toggleExpanded,
}: {
  node: PermissionNode;
  depth: number;
  selected: Set<string>;
  toggleLeaves: (ids: string[], nextChecked: boolean) => void;
  expanded: Set<string>;
  toggleExpanded: (id: string) => void;
}) {
  const hasChildren = !!node.children && node.children.length > 0;
  const leafIds = useMemo(() => getNodeLeafIds(node), [node]);
  const checkedCount = leafIds.filter((id) => selected.has(id)).length;
  const checked = checkedCount > 0 && checkedCount === leafIds.length;
  const indeterminate = checkedCount > 0 && checkedCount < leafIds.length;
  const isExpanded = expanded.has(node.id);

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/60 transition"
        style={{ paddingLeft: depth * 20 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => toggleExpanded(node.id)}
            className="p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        <label className="flex items-center gap-2 cursor-pointer select-none flex-1">
          <TriStateCheckbox
            checked={checked}
            indeterminate={indeterminate}
            ariaLabel={node.label}
            onChange={() => toggleLeaves(leafIds, !checked)}
          />
          <span
            className={
              hasChildren
                ? "text-sm font-semibold text-gray-800 dark:text-gray-100"
                : "text-sm font-medium text-gray-700 dark:text-gray-200"
            }
          >
            {node.label}
          </span>
        </label>

        {hasChildren && (
          <span className="text-xs text-gray-400 dark:text-gray-500 mr-1">
            {checkedCount}/{leafIds.length}
          </span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selected={selected}
              toggleLeaves={toggleLeaves}
              expanded={expanded}
              toggleExpanded={toggleExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PermissionTree({
  nodes,
  selected,
  onChange,
  defaultExpanded = true,
  hideGlobalSelectAll = false,
  className = "",
}: PermissionTreeProps) {
  const allLeafIds = useMemo(() => getAllLeafIds(nodes), [nodes]);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (!defaultExpanded) return new Set();
    const collectIds = (list: PermissionNode[]): string[] =>
      list.flatMap((n) => [
        ...(n.children ? [n.id] : []),
        ...(n.children ? collectIds(n.children) : []),
      ]);
    return new Set(collectIds(nodes));
  });

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleLeaves = useCallback(
    (ids: string[], nextChecked: boolean) => {
      const next = new Set(selected);
      ids.forEach((id) => {
        if (nextChecked) next.add(id);
        else next.delete(id);
      });
      onChange(next);
    },
    [selected, onChange],
  );

  const allChecked =
    allLeafIds.length > 0 && allLeafIds.every((id) => selected.has(id));
  const someChecked = allLeafIds.some((id) => selected.has(id));

  return (
    <div
      className={`rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 ${className}`}
    >
      {!hideGlobalSelectAll && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-600">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <TriStateCheckbox
              checked={allChecked}
              indeterminate={someChecked && !allChecked}
              ariaLabel="Select all modules"
              onChange={() => toggleLeaves(allLeafIds, !allChecked)}
            />
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              Select All
            </span>
          </label>
          <button
            type="button"
            onClick={() => onChange(new Set())}
            disabled={!someChecked}
            className="text-xs font-medium text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            <Minus className="w-3.5 h-3.5" />
            Clear all
          </button>
        </div>
      )}

      <div className="max-h-80 overflow-y-auto px-2 py-1">
        {nodes.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
            selected={selected}
            toggleLeaves={toggleLeaves}
            expanded={expanded}
            toggleExpanded={toggleExpanded}
          />
        ))}
      </div>
    </div>
  );
}
