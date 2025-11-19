import * as XLSX from "xlsx";

interface SectionSummaryRow {
  id: string;
  title: string;
  weightage: number;
  yesPercent: number;
  yesWeighted: number;
  noPercent: number;
  noWeighted: number;
  naPercent: number;
  naWeighted: number;
}

interface FormSection {
  id: string;
  title: string;
  description?: string;
  questions?: Array<{
    id: string;
    text: string;
    type: string;
    parentId?: string;
    followUpQuestions?: any[];
  }>;
}

interface FormData {
  _id: string;
  title: string;
  sections?: FormSection[];
  followUpQuestions?: any[];
}

interface ResponseData {
  _id: string;
  formTitle: string;
  createdAt: string;
  answers: Record<string, any>;
  yesNoScore?: {
    yes: number;
    total: number;
  };
}

const { utils, writeFile } = XLSX;

function formatPercentageValue(value: number): string {
  return `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;
}

type FormQuestion = {
  id?: string;
  text?: string;
  type?: string;
  fileName?: string;
  name?: string;
  followUpQuestions?: any[];
};

type FormattedAnswer = {
  display: string;
  hyperlink?: string;
};

type HyperlinkEntry = {
  rowIndex: number;
  columnIndex: number;
  target: string;
  display: string;
};

function resolveFileLink(
  value: any,
  question?: FormQuestion
): { link: string; label: string } | null {
  const fallbackLabel = "View file";

  const extract = (candidate: any): { link: string; label: string } | null => {
    if (!candidate) {
      return null;
    }
    if (typeof candidate === "string") {
      if (candidate.startsWith("data:") || candidate.startsWith("http")) {
        const isImage =
          candidate.startsWith("data:image/") ||
          candidate.includes(".jpg") ||
          candidate.includes(".png") ||
          candidate.includes(".jpeg") ||
          candidate.includes(".gif");
        const label = isImage ? "Image uploaded" : "File uploaded";
        return { link: candidate, label };
      }
      return null;
    }
    if (typeof candidate === "object") {
      const dataValue =
        candidate.data ??
        candidate.url ??
        candidate.value ??
        candidate.file ??
        candidate.base64;
      if (
        typeof dataValue === "string" &&
        (dataValue.startsWith("data:") || dataValue.startsWith("http"))
      ) {
        const isImage =
          dataValue.startsWith("data:image/") ||
          dataValue.includes(".jpg") ||
          dataValue.includes(".png");
        const label = isImage ? "Image uploaded" : "File uploaded";
        return { link: dataValue, label };
      }
    }
    return null;
  };

  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = extract(item);
      if (resolved) {
        return resolved;
      }
    }
    return null;
  }

  return extract(value);
}

function formatAnswerForExport(
  value: any,
  question?: FormQuestion
): FormattedAnswer {
  if (value === null || value === undefined) {
    return { display: "No response" };
  }

  const fileLink = resolveFileLink(value, question);
  if (fileLink) {
    const isImage =
      fileLink.link.startsWith("data:image/") ||
      fileLink.link.includes(".jpg") ||
      fileLink.link.includes(".png") ||
      fileLink.link.includes(".jpeg") ||
      fileLink.link.includes(".gif") ||
      fileLink.link.includes(".webp");

    const displayText = isImage ? "Image uploaded" : "File uploaded";
    return { display: displayText, hyperlink: fileLink.link };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.length) {
      return { display: "No response" };
    }
    return { display: trimmed };
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return { display: String(value) };
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => {
        if (item === null || item === undefined) {
          return "";
        }
        if (typeof item === "string") {
          return item;
        }
        if (typeof item === "number" || typeof item === "boolean") {
          return String(item);
        }
        if (typeof item === "object") {
          const nestedFile = resolveFileLink(item, question);
          if (nestedFile) {
            const isImage =
              nestedFile.link.startsWith("data:image/") ||
              nestedFile.link.includes(".jpg") ||
              nestedFile.link.includes(".png");
            return isImage ? "Image uploaded" : "File uploaded";
          }
          return JSON.stringify(item);
        }
        return "";
      })
      .map((text) => text.trim())
      .filter((text) => text.length);

    if (!parts.length) {
      return { display: "No response" };
    }

    return { display: parts.join(", ") };
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (!keys.length) {
      return { display: "No response" };
    }
    return { display: JSON.stringify(value) };
  }

  return { display: String(value) };
}

// Build nested form structure (handle parentId relationships)
function buildNestedForm(form: FormData): FormData {
  const nestedSections = form.sections?.map((section) => {
    const idToQuestion: Record<string, any> = {};

    // Clone questions into a map
    (section.questions || []).forEach((q) => {
      idToQuestion[q.id] = { ...q, followUpQuestions: [] };
    });

    // Link child questions under their parent
    (section.questions || []).forEach((q) => {
      if (q.parentId && idToQuestion[q.parentId]) {
        idToQuestion[q.parentId].followUpQuestions.push(idToQuestion[q.id]);
      }
    });

    // Keep only top-level questions
    const nestedQuestions = Object.values(idToQuestion).filter(
      (q) => !q.parentId
    );

    return { ...section, questions: nestedQuestions };
  });

  return { ...form, sections: nestedSections };
}

function buildResponsesSheetContent(
  response: ResponseData,
  form: FormData
): { data: any[][]; links: HyperlinkEntry[] } {
  const rows: any[][] = [];
  const links: HyperlinkEntry[] = [];

  const addLink = (r: number, c: number, target: string, display: string) => {
    links.push({ rowIndex: r, columnIndex: c, target, display });
  };

  // Gather main question & all its follow-ups as pairs
  const gatherPairs = (q: any, base: string) => {
    const pairs: Array<{ label: string; ans: FormattedAnswer }> = [];

    // Main question
    const mainLabel = `${base}. ${q?.text || "Untitled Question"}`;
    const mainAns = formatAnswerForExport(response.answers?.[q.id], q);
    pairs.push({ label: mainLabel, ans: mainAns });

    // Recursively walk through follow-ups
    const walk = (nodes?: any[], path: number[] = []) => {
      (nodes || []).forEach((fu, idx) => {
        const lbl = `${base}.${[...path, idx + 1].join(".")}. ${
          fu?.text || "Follow-up"
        }`;
        const ans = formatAnswerForExport(response.answers?.[fu.id], fu);
        pairs.push({ label: lbl, ans });
        if (fu?.followUpQuestions?.length) {
          walk(fu.followUpQuestions, [...path, idx + 1]);
        }
      });
    };
    walk(q?.followUpQuestions);
    return pairs;
  };

  // Prepare all sections with their question pairs
  type PreparedRow = { pairs: Array<{ label: string; ans: FormattedAnswer }> };
  type PreparedSection = { title: string; rows: PreparedRow[] };
  const preparedSections: PreparedSection[] = [];

  (form.sections || []).forEach((section: any, si: number) => {
    const title = `Section ${si + 1}: ${section?.title || "Untitled Section"}`;
    const rowsForSection = (section?.questions || []).map(
      (q: any, qi: number) => ({
        pairs: gatherPairs(q, `Q${qi + 1}`),
      })
    );
    preparedSections.push({ title, rows: rowsForSection });
  });

  if (form.followUpQuestions?.length) {
    const fqTitle = "Form Follow-up Questions";
    const rowsForFQ = (form.followUpQuestions || []).map(
      (fq: any, i: number) => ({
        pairs: gatherPairs(fq, `FQ${i + 1}`),
      })
    );
    preparedSections.push({ title: fqTitle, rows: rowsForFQ });
  }

  // Calculate max number of Q&A pairs needed
  const maxPairs = preparedSections.reduce(
    (m, s) => Math.max(m, ...s.rows.map((r) => r.pairs.length)),
    0
  );

  // Extract header labels from the first row that has pairs
  const headerLabels: string[] = [];
  for (let i = 0; i < maxPairs; i++) {
    headerLabels.push("");
  }
  
  for (const section of preparedSections) {
    for (const r of section.rows) {
      r.pairs.forEach((p, idx) => {
        if (idx < maxPairs && !headerLabels[idx]) {
          const match = p.label.match(/^(.+?)\.\s/);
          headerLabels[idx] = match ? match[1] : p.label;
        }
      });
      if (headerLabels.every(l => l)) break;
    }
    if (headerLabels.every(l => l)) break;
  }

  // Build header row
  const headerRow: any[] = ["Section"];
  for (let i = 0; i < maxPairs; i++) {
    headerRow.push(headerLabels[i] || (i === 0 ? "Main Question" : "Follow-Up Question"));
    headerRow.push("Answer");
  }
  rows.push(headerRow);

  // Build data rows
  preparedSections.forEach((section) => {
    let firstRowIn = true;
    section.rows.forEach((r) => {
      const row: any[] = new Array(1 + maxPairs * 2).fill("");
      row[0] = firstRowIn ? section.title : "";
      firstRowIn = false;

      let col = 1;
      r.pairs.forEach((p) => {
        row[col] = p.label;
        row[col + 1] = p.ans.display;

        const rIdx = rows.length;
        if (p.ans.hyperlink) {
          addLink(rIdx, col + 1, p.ans.hyperlink, p.ans.display);
        }
        col += 2;
      });

      rows.push(row);
    });
  });

  return { data: rows, links };
}

function applyHyperlinks(sheet: XLSX.WorkSheet, links: HyperlinkEntry[]): void {
  links.forEach(({ rowIndex, columnIndex, target, display }) => {
    const cellAddress = utils.encode_cell({ r: rowIndex, c: columnIndex });
    const existingCell = sheet[cellAddress] as XLSX.CellObject | undefined;
    const cellObject: XLSX.CellObject = existingCell ?? { t: "s", v: display };
    cellObject.v = display;
    cellObject.t = "s";
    cellObject.l = { Target: target, Tooltip: display };
    sheet[cellAddress] = cellObject;
  });
}

export function generateResponseExcelReport(
  response: ResponseData,
  form: FormData,
  sectionSummaryRows: SectionSummaryRow[]
): void {
  const workbook = utils.book_new();

  // Dashboard Sheet
  const dashboardData: any[] = [];
  dashboardData.push(["Dashboard Report"]);
  dashboardData.push([]);
  dashboardData.push(["Form", response.formTitle]);
  dashboardData.push([
    "Submitted",
    new Date(response.createdAt).toLocaleString(),
  ]);
  if (response.yesNoScore) {
    dashboardData.push([
      "Overall Score",
      `${response.yesNoScore.yes}/${response.yesNoScore.total}`,
    ]);
  }
  dashboardData.push([]);
  dashboardData.push([
    "Section",
    "Yes %",
    "No %",
    "N/A %",
    "Weightage",
    "Yes % × Weightage",
    "No % × Weightage",
    "N/A % × Weightage",
  ]);

  sectionSummaryRows.forEach((row) => {
    dashboardData.push([
      row.title,
      formatPercentageValue(row.yesPercent),
      formatPercentageValue(row.noPercent),
      formatPercentageValue(row.naPercent),
      formatPercentageValue(row.weightage),
      formatPercentageValue(row.yesWeighted),
      formatPercentageValue(row.noWeighted),
      formatPercentageValue(row.naWeighted),
    ]);
  });

  const dashboardSheet = utils.aoa_to_sheet(dashboardData);
  dashboardSheet["!cols"] = [
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
  ];

  utils.book_append_sheet(workbook, dashboardSheet, "Dashboard");

  // Responses Sheet - with nested structure
  const nestedForm = buildNestedForm(form);
  const { data: responsesData, links: responsesLinks } =
    buildResponsesSheetContent(response, nestedForm);

  const responsesSheet = utils.aoa_to_sheet(responsesData);
  responsesSheet["!cols"] = Array(50).fill({ wch: 25 }); // More columns for horizontal layout
  applyHyperlinks(responsesSheet, responsesLinks);

  utils.book_append_sheet(workbook, responsesSheet, "Responses");

  const fileName = `${response.formTitle.replace(/\s+/g, "_")}_${
    new Date().toISOString().split("T")[0]
  }.xlsx`;
  writeFile(workbook, fileName);
}

function createExcelWorkbook(
  response: ResponseData,
  form: FormData,
  sectionSummaryRows: SectionSummaryRow[]
): Blob {
  const workbook = XLSX.utils.book_new();

  const dashboardData: any[] = [];
  dashboardData.push(["Dashboard Report"]);
  dashboardData.push([]);
  dashboardData.push(["Form", response.formTitle]);
  dashboardData.push([
    "Submitted",
    new Date(response.createdAt).toLocaleString(),
  ]);
  if (response.yesNoScore) {
    dashboardData.push([
      "Overall Score",
      `${response.yesNoScore.yes}/${response.yesNoScore.total}`,
    ]);
  }
  dashboardData.push([]);
  dashboardData.push([
    "Section",
    "Yes %",
    "No %",
    "N/A %",
    "Weightage",
    "Yes % × Weightage",
    "No % × Weightage",
    "N/A % × Weightage",
  ]);

  sectionSummaryRows.forEach((row) => {
    dashboardData.push([
      row.title,
      formatPercentageValue(row.yesPercent),
      formatPercentageValue(row.noPercent),
      formatPercentageValue(row.naPercent),
      formatPercentageValue(row.weightage),
      formatPercentageValue(row.yesWeighted),
      formatPercentageValue(row.noWeighted),
      formatPercentageValue(row.naWeighted),
    ]);
  });

  const dashboardSheet = XLSX.utils.aoa_to_sheet(dashboardData);
  dashboardSheet["!cols"] = [
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
  ];

  XLSX.utils.book_append_sheet(workbook, dashboardSheet, "Dashboard");

  const nestedForm = buildNestedForm(form);
  const { data: responsesData, links: responsesLinks } =
    buildResponsesSheetContent(response, nestedForm);

  const responsesSheet = XLSX.utils.aoa_to_sheet(responsesData);
  responsesSheet["!cols"] = Array(50).fill({ wch: 25 });
  applyHyperlinks(responsesSheet, responsesLinks);

  XLSX.utils.book_append_sheet(workbook, responsesSheet, "Responses");

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export async function sendResponseExcelViaEmail(
  response: ResponseData,
  form: FormData,
  sectionSummaryRows: SectionSummaryRow[],
  recipientEmail: string
): Promise<{ success: boolean; blob: Blob; fallback?: boolean }> {
  try {
    const blob = createExcelWorkbook(response, form, sectionSummaryRows);
    const fileName = `${response.formTitle.replace(/\s+/g, "_")}_Report.xlsx`;

    const formData = new FormData();
    formData.append("email", recipientEmail);
    formData.append("subject", `Response Report: ${response.formTitle}`);
    formData.append("file", blob, fileName);
    formData.append("responseId", response._id);

    const token = localStorage.getItem("auth_token");

    console.log("📨 Sending email report to:", recipientEmail);
    console.log("📄 File size:", blob.size, "bytes");

    const API_BASE_URL = "http://localhost:5000/api";
    const response_obj = await fetch(
      `${API_BASE_URL}/mail/send-response-report`,
      {
        method: "POST",
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    );

    console.log("📤 Response status:", response_obj.status);

    if (!response_obj.ok) {
      const errorData = await response_obj.json().catch(() => ({}));
      console.error("❌ Server error response:", errorData);
      throw new Error(
        `Server error: ${response_obj.status} - ${
          errorData.message || "Unknown error"
        }`
      );
    }

    const result = await response_obj.json();
    console.log("✅ Email sent successfully:", result);
    return { success: true, blob };
  } catch (error) {
    console.error("❌ Email send error:", error);
    return { success: false, blob: new Blob(), fallback: true };
  }
}
