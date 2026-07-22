
export interface PermissionNode {
  id: string;
  label: string;
  children?: PermissionNode[];
}

/** Fixed sub-tabs shown for every individual form under Service Analytics */
const ANALYTICS_FORM_SUBTABS: Array<{ suffix: string; label: string }> = [
  { suffix: "response", label: "Response" },
  { suffix: "dashboard", label: "Dashboard" },
  { suffix: "overall", label: "Overall" },
  { suffix: "questions", label: "Questions" },
  { suffix: "sections", label: "Sections" },
];

/** Global Service Analytics actions (not form-specific) */
const ANALYTICS_GLOBAL_ACTIONS: Array<{ id: string; label: string }> = [
  { id: "analytics:downloadTemplate", label: "Download Follow-up Only Template" },
  { id: "analytics:importExcel", label: "Import Form (Excel)" },
  { id: "analytics:createService", label: "Create New Service Form" },
];

export interface FormLike {
  _id: string;
  title: string;
}


export function buildServiceAnalyticsNode(forms: FormLike[]): PermissionNode {
  return {
    id: "analytics",
    label: "Service Analytics",
    children: [
      // Global actions (not form-specific)
      ...ANALYTICS_GLOBAL_ACTIONS.map((action) => ({
        id: action.id,
        label: action.label,
      })),
      // Form-specific nodes
      ...forms.map((form) => ({
        id: `analytics:form:${form._id}`,
        label: form.title,
        children: ANALYTICS_FORM_SUBTABS.map((tab) => ({
          id: `analytics:form:${form._id}:${tab.suffix}`,
          label: tab.label,
        })),
      })),
    ],
  };
}

/**
 * Full static tree. Pass the result of `buildServiceAnalyticsNode(forms)` in
 * to fill the dynamic Service Analytics branch — see `buildPermissionTree`.
 */
export function buildPermissionTree(forms: FormLike[]): PermissionNode[] {
  return [
    {
      id: "dashboard:view",
      label: "Dashboard",
    },
    {
      id: "Overall:view",
      label: "Overall",
    },
    buildServiceAnalyticsNode(forms),
    {
      id: "requests",
      label: "Customer Requests",
      children: [
        { id: "requests:dashboard", label: "Dashboard" },
        { id: "requests:response", label: "Response" },
      ],
    },
    {
      id: "hr",
      label: "HR",
      children: [
        { id: "hr:leaves", label: "Leaves" },
        { id: "hr:permission", label: "Permission" },
        { id: "hr:shifts", label: "Shifts" },
        { id: "hr:reports", label: "HR Reports" },
      ],
    },
    {
      id: "admin:manage",
      label: "Admin Management",
    },
    {
      id: "attendance",
      label: "Attendance",
      children: [
        {
          id: "attendance:record",
          label: "Attendance Record",
          children: [
            { id: "attendance:record:report", label: "Attendance Report" },
            { id: "attendance:record:response", label: "Response Attendance" },
            { id: "attendance:record:calendar", label: "Calendar Attendance" },
            { id: "attendance:record:summary", label: "Summary" },
          ],
        },
        { id: "attendance:activityLogs", label: "Activity Logs" },
      ],
    },
    {
      id: "chat",
      label: "Chat System",
    },
  ];
}

/** Recursively collects every leaf id under a node (a leaf's own id counts as itself). */
export function getNodeLeafIds(node: PermissionNode): string[] {
  if (!node.children || node.children.length === 0) return [node.id];
  return node.children.flatMap(getNodeLeafIds);
}

/** Collects every leaf id across an entire tree (used for the global "Select All"). */
export function getAllLeafIds(nodes: PermissionNode[]): string[] {
  return nodes.flatMap(getNodeLeafIds);
}

/** Find a node by ID in the tree */
export function findNodeById(nodes: PermissionNode[], id: string): PermissionNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/** Check if a node is a leaf */
export function isLeafNode(node: PermissionNode): boolean {
  return !node.children || node.children.length === 0;
}

/** Get all leaf IDs under a specific node (useful for checking if all are selected) */
export function getLeafIdsForNode(node: PermissionNode): string[] {
  return getNodeLeafIds(node);
}