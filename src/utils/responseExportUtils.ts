import * as XLSX from "xlsx-js-style";

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
    showWhen?: {
      questionId: string;
      value: any;
    };
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

// FIXED buildNestedForm function for FLAT structure
function buildNestedForm(form: FormData): FormData {
  //console.log("🔄 Building nested form structure from FLAT data...");

  const nestedSections = form.sections?.map((section) => {
    if (!section.questions || !Array.isArray(section.questions)) {
      return section;
    }

    //console.log(`📋 Processing section: "${section.title}"`);
    //console.log(`   - Original questions: ${section.questions.length}`);

    // Create a map of all questions by ID with proper typing
    const questionMap = new Map<string, any>();
    section.questions.forEach((q: any) => {
      questionMap.set(q.id, { ...q, followUpQuestions: [] });
    });

    // Properly type the arrays
    const mainQuestions: any[] = [];
    const followUpQuestions: any[] = [];

    section.questions.forEach((q: any) => {
      // Use type assertion to access showWhen
      const questionWithShowWhen = q as any;
      if (
        q.parentId ||
        (questionWithShowWhen.showWhen &&
          questionWithShowWhen.showWhen.questionId)
      ) {
        followUpQuestions.push(q);
      } else {
        mainQuestions.push(q);
      }
    });

    //console.log(`   - Main questions: ${mainQuestions.length}`);
    //console.log(`   - Follow-up questions: ${followUpQuestions.length}`);

    // Attach follow-ups to their parent questions
    followUpQuestions.forEach((followUp: any) => {
      const followUpWithShowWhen = followUp as any;
      const parentId =
        followUp.parentId || followUpWithShowWhen.showWhen?.questionId;

      if (parentId && questionMap.has(parentId)) {
        const parentQuestion = questionMap.get(parentId);
        parentQuestion.followUpQuestions.push({
          ...followUp,
          parentId: parentId, // Ensure parentId is set
        });
        //console.log(`   ✅ Attached follow-up: "${followUp.text}" → parent: "${parentQuestion.text}"`);
      } else {
        //console.log(`   ❌ Could not find parent for follow-up: "${followUp.text}" (parentId: ${parentId})`);
        // Keep as main question if parent not found
        mainQuestions.push(followUp);
      }
    });

    // Update section with nested structure
    const updatedSection = {
      ...section,
      questions: mainQuestions.map((q: any) => questionMap.get(q.id)),
    };

    console.log(
      `   - Final nested questions: ${updatedSection.questions.length}`
    );
    updatedSection.questions.forEach((q: any, index: number) => {
      console.log(
        `   - Q${index + 1}: "${q.text}" (${
          q.followUpQuestions.length
        } follow-ups)`
      );
      q.followUpQuestions.forEach((fu: any, fuIndex: number) => {
        console.log(`     ↳ FU${fuIndex + 1}: "${fu.text}"`);
      });
    });

    return updatedSection;
  });

  const result = { ...form, sections: nestedSections };
  console.log("✅ Nested form structure completed");
  return result;
}

function buildResponsesSheetContent(
  response: ResponseData,
  form: FormData
): {
  data: any[][];
  links: HyperlinkEntry[];
  headerStyle: Record<string, any>;
  cellStyles: Record<string, any>;
} {
  console.log("🔄 Building responses sheet content...");
  console.log("📦 Response answers in DB:", Object.keys(response.answers));

  const rows: any[][] = [];
  const links: HyperlinkEntry[] = [];
  const headerStyle: Record<string, any> = {};
  const cellStyles: Record<string, any> = {};

  const addLink = (r: number, c: number, target: string, display: string) => {
    links.push({ rowIndex: r, columnIndex: c, target, display });
  };

  // Gather main & follow‑ups horizontally
  const gatherPairs = (q: any, base: string) => {
    const pairs: Array<{ label: string; ans: FormattedAnswer }> = [];

    const mainLabel = `${base}. ${q?.text || "Untitled Question"}`;
    const mainAns = formatAnswerForExport(response.answers?.[q.id], q);

    console.log(`❓ Main Question: ${mainLabel}`);
    console.log(`   - Question ID: ${q.id}`);
    console.log(`   - Answer in DB:`, response.answers?.[q.id]);
    console.log(`   - Formatted as: ${mainAns.display}`);

    pairs.push({ label: mainLabel, ans: mainAns });

    const walk = (nodes?: any[], path: number[] = []) => {
      (nodes || []).forEach((fu, idx) => {
        const lbl = `${base}.${[...path, idx + 1].join(".")}. ${
          fu?.text || "Follow-up"
        }`;
        const ans = formatAnswerForExport(response.answers?.[fu.id], fu);

        console.log(`   ↳ Follow-up: ${lbl}`);
        console.log(`     - Question ID: ${fu.id}`);
        console.log(`     - Answer in DB:`, response.answers?.[fu.id]);
        console.log(`     - Formatted as: ${ans.display}`);

        pairs.push({ label: lbl, ans });
        if (fu?.followUpQuestions?.length) {
          walk(fu.followUpQuestions, [...path, idx + 1]);
        }
      });
    };

    walk(q?.followUpQuestions);

    console.log(`   📊 Total pairs for this question: ${pairs.length}`);
    return pairs;
  };

  // Prepare all sections with their question pairs
  type PreparedRow = { pairs: Array<{ label: string; ans: FormattedAnswer }> };
  type PreparedSection = { title: string; rows: PreparedRow[] };
  const preparedSections: PreparedSection[] = [];

  console.log("📋 Processing form sections...");
  (form.sections || []).forEach((section: any, si: number) => {
    const title = `Section ${si + 1}: ${section?.title || "Untitled Section"}`;
    console.log(`\n📁 ${title}`);

    const rowsForSection = (section?.questions || []).map(
      (q: any, qi: number) => ({
        pairs: gatherPairs(q, `Q${qi + 1}`), // Back to original
      })
    );

    preparedSections.push({ title, rows: rowsForSection });
    console.log(`   - Questions in section: ${rowsForSection.length}`);
  });

  if (form.followUpQuestions?.length) {
    console.log(
      `\n📋 Processing form-level follow-up questions: ${form.followUpQuestions.length}`
    );
    const fqTitle = "Form Follow-up Questions";
    const rowsForFQ = (form.followUpQuestions || []).map(
      (fq: any, i: number) => ({
        pairs: gatherPairs(fq, `FQ${i + 1}`),
      })
    );
    preparedSections.push({ title: fqTitle, rows: rowsForFQ });
  }

  const maxPairs = preparedSections.reduce(
    (m, s) => Math.max(m, ...s.rows.map((r) => r.pairs.length)),
    0
  );

  console.log(`\n📊 Layout Summary:`);
  console.log(`   - Total sections: ${preparedSections.length}`);
  console.log(`   - Maximum question pairs per row: ${maxPairs}`);
  console.log(`   - Total columns needed: ${1 + maxPairs * 2}`);

  // ---------- HEADER ----------------
  const headerRow: any[] = ["Section"];
  for (let i = 0; i < maxPairs; i++) {
    headerRow.push(i === 0 ? "Main Question" : "Follow‑Up Question");
    headerRow.push("Answer");
  }
  rows.push(headerRow);

  console.log(`\n📋 Header row structure:`, headerRow);

  // Apply header styles with blue background and bold text
  headerRow.forEach((_, c) => {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    headerStyle[addr] = {
      font: {
        bold: true,
        color: { rgb: "FFFFFF" },
        sz: 12,
      },
      fill: {
        fgColor: { rgb: "1D4ED8" }, // blue background
      },
      alignment: {
        horizontal: "center",
        vertical: "center",
        wrapText: true,
      },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      },
    };
  });

  // ---------- BODY -------------------
  console.log(`\n📋 Building data rows...`);
  let totalRows = 0;

  preparedSections.forEach((section, sectionIndex) => {
    console.log(`\n📁 Processing section: ${section.title}`);
    let firstRowIn = true;
    let sectionRowCount = 0;

    section.rows.forEach((r, rowIndex) => {
      const row: any[] = new Array(1 + maxPairs * 2).fill("");
      row[0] = firstRowIn ? section.title : "";
      firstRowIn = false;

      console.log(
        `   📝 Row ${totalRows + 1}: ${r.pairs.length} question-answer pairs`
      );

      let col = 1;
      r.pairs.forEach((p, idx) => {
        row[col] = p.label;
        row[col + 1] = p.ans.display;

        const rIdx = rows.length;
        const qAddr = XLSX.utils.encode_cell({ r: rIdx, c: col });
        const aAddr = XLSX.utils.encode_cell({ r: rIdx, c: col + 1 });

        // Apply comprehensive styling (your existing styling code)
        if (idx === 0) {
          // Main Question - Bold with light blue background
          cellStyles[qAddr] = {
            font: {
              bold: true,
              color: { rgb: "0F172A" },
              sz: 11,
            },
            fill: {
              fgColor: { rgb: "E0F2FE" }, // Light blue background
            },
            alignment: {
              horizontal: "left",
              vertical: "center",
              wrapText: true,
            },
            border: {
              top: { style: "thin", color: { rgb: "CBD5E1" } },
              left: { style: "thin", color: { rgb: "CBD5E1" } },
              bottom: { style: "thin", color: { rgb: "CBD5E1" } },
              right: { style: "thin", color: { rgb: "CBD5E1" } },
            },
          };

          // Main Answer - Italic with gray background
          cellStyles[aAddr] = {
            font: {
              italic: true,
              color: { rgb: "475569" },
              sz: 10,
            },
            fill: {
              fgColor: { rgb: "F8FAFC" }, // Very light gray background
            },
            alignment: {
              horizontal: "left",
              vertical: "center",
              wrapText: true,
            },
            border: {
              top: { style: "thin", color: { rgb: "CBD5E1" } },
              left: { style: "thin", color: { rgb: "CBD5E1" } },
              bottom: { style: "thin", color: { rgb: "CBD5E1" } },
              right: { style: "thin", color: { rgb: "CBD5E1" } },
            },
          };
        } else {
          // Follow‑Up Questions - Normal text with white background
          cellStyles[qAddr] = {
            font: {
              bold: false,
              italic: false,
              color: { rgb: "334155" },
              sz: 10,
            },
            fill: {
              fgColor: { rgb: "FFFFFF" }, // White background
            },
            alignment: {
              horizontal: "left",
              vertical: "center",
              wrapText: true,
            },
            border: {
              top: { style: "thin", color: { rgb: "E2E8F0" } },
              left: { style: "thin", color: { rgb: "E2E8F0" } },
              bottom: { style: "thin", color: { rgb: "E2E8F0" } },
              right: { style: "thin", color: { rgb: "E2E8F0" } },
            },
          };

          // Follow‑Up Answers - Normal text with white background
          cellStyles[aAddr] = {
            font: {
              italic: false,
              color: { rgb: "64748B" },
              sz: 10,
            },
            fill: {
              fgColor: { rgb: "FFFFFF" }, // White background
            },
            alignment: {
              horizontal: "left",
              vertical: "center",
              wrapText: true,
            },
            border: {
              top: { style: "thin", color: { rgb: "E2E8F0" } },
              left: { style: "thin", color: { rgb: "E2E8F0" } },
              bottom: { style: "thin", color: { rgb: "E2E8F0" } },
              right: { style: "thin", color: { rgb: "E2E8F0" } },
            },
          };
        }

        if (p.ans.hyperlink) {
          addLink(rIdx, col + 1, p.ans.hyperlink, p.ans.display);
          console.log(
            `     🔗 Hyperlink at row ${rIdx}, col ${col + 1}: ${p.ans.display}`
          );
        }
        col += 2;
      });

      // Style the section title cell in the first column
      if (row[0]) {
        const sectionAddr = XLSX.utils.encode_cell({ r: rows.length, c: 0 });
        cellStyles[sectionAddr] = {
          font: {
            bold: true,
            color: { rgb: "1E40AF" },
            sz: 12,
          },
          fill: {
            fgColor: { rgb: "DBEAFE" }, // Light blue background
          },
          alignment: {
            horizontal: "left",
            vertical: "center",
            wrapText: true,
          },
          border: {
            top: { style: "thin", color: { rgb: "93C5FD" } },
            left: { style: "thin", color: { rgb: "93C5FD" } },
            bottom: { style: "thin", color: { rgb: "93C5FD" } },
            right: { style: "thin", color: { rgb: "93C5FD" } },
          },
        };
      }

      rows.push(row);
      totalRows++;
      sectionRowCount++;
    });

    console.log(
      `   ✅ Section "${section.title}" completed: ${sectionRowCount} rows`
    );
  });

  console.log(`\n🎯 FINAL SUMMARY:`);
  console.log(`   - Total data rows: ${totalRows}`);
  console.log(`   - Total hyperlinks: ${links.length}`);
  console.log(`   - Header styles: ${Object.keys(headerStyle).length} cells`);
  console.log(`   - Cell styles: ${Object.keys(cellStyles).length} cells`);
  console.log(
    `   - Data structure: ${rows.length} rows x ${rows[0]?.length || 0} columns`
  );

  return { data: rows, links, headerStyle, cellStyles };
}

function applyHyperlinks(sheet: XLSX.WorkSheet, links: HyperlinkEntry[]): void {
  links.forEach(({ rowIndex, columnIndex, target, display }) => {
    const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
    const existingCell = sheet[cellAddress] as XLSX.CellObject | undefined;
    const cellObject: XLSX.CellObject = existingCell ?? { t: "s", v: display };
    cellObject.v = display;
    cellObject.t = "s";
    cellObject.l = { Target: target, Tooltip: display };

    // Preserve existing styles when adding hyperlinks
    if (existingCell && existingCell.s) {
      cellObject.s = existingCell.s;
    }

    sheet[cellAddress] = cellObject;
  });
}

// ▼▼▼ MAIN EXPORT FUNCTION - RESPONSES ONLY ▼▼▼
export function generateResponseExcelReport(
  response: ResponseData,
  form: FormData
): void {
  const workbook = utils.book_new();

  // Build nested form structure and create responses sheet
  const nestedForm = buildNestedForm(form);
  const {
    data: responsesData,
    links: responsesLinks,
    headerStyle,
    cellStyles,
  } = buildResponsesSheetContent(response, nestedForm);

  const responsesSheet = XLSX.utils.aoa_to_sheet(responsesData);

  // Apply styles
  Object.keys(headerStyle).forEach((address) => {
    if (!responsesSheet[address]) responsesSheet[address] = { t: "s", v: "" };
    responsesSheet[address].s = headerStyle[address];
  });

  Object.keys(cellStyles).forEach((address) => {
    if (!responsesSheet[address]) {
      const coord = XLSX.utils.decode_cell(address);
      if (
        coord.r < responsesData.length &&
        coord.c < responsesData[coord.r].length
      ) {
        responsesSheet[address] = {
          t: "s",
          v: responsesData[coord.r][coord.c] || "",
        };
      } else {
        responsesSheet[address] = { t: "s", v: "" };
      }
    }
    responsesSheet[address].s = cellStyles[address];
  });

  responsesSheet["!cols"] = Array(20).fill({ wch: 25 });
  applyHyperlinks(responsesSheet, responsesLinks);
  utils.book_append_sheet(workbook, responsesSheet, "Responses");

  // Save file
  const fileName = `${response.formTitle.replace(/\s+/g, "_")}_${
    new Date().toISOString().split("T")[0]
  }.xlsx`;

  writeFile(workbook, fileName);

  console.log("✅ Excel file generated with styled responses");
}

// ▼▼▼ EMAIL VERSION (returns Blob) ▼▼▼
export function createExcelWorkbook(
  response: ResponseData,
  form: FormData
): Blob {
  const workbook = utils.book_new();

  // Build nested form structure and create responses sheet
  const nestedForm = buildNestedForm(form);
  const {
    data: responsesData,
    links: responsesLinks,
    headerStyle,
    cellStyles,
  } = buildResponsesSheetContent(response, nestedForm);

  const responsesSheet = XLSX.utils.aoa_to_sheet(responsesData);

  Object.keys(headerStyle).forEach((address) => {
    if (!responsesSheet[address]) responsesSheet[address] = { t: "s", v: "" };
    responsesSheet[address].s = headerStyle[address];
  });

  Object.keys(cellStyles).forEach((address) => {
    if (!responsesSheet[address]) {
      const coord = XLSX.utils.decode_cell(address);
      if (
        coord.r < responsesData.length &&
        coord.c < responsesData[coord.r].length
      ) {
        responsesSheet[address] = {
          t: "s",
          v: responsesData[coord.r][coord.c] || "",
        };
      } else {
        responsesSheet[address] = { t: "s", v: "" };
      }
    }
    responsesSheet[address].s = cellStyles[address];
  });

  responsesSheet["!cols"] = Array(20).fill({ wch: 25 });
  applyHyperlinks(responsesSheet, responsesLinks);
  XLSX.utils.book_append_sheet(workbook, responsesSheet, "Responses");

  // Export to Blob
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export async function sendResponseExcelViaEmail(
  response: ResponseData,
  form: FormData,
  recipientEmail: string
): Promise<{ success: boolean; blob: Blob; fallback?: boolean }> {
  try {
    const blob = createExcelWorkbook(response, form);
    const fileName = `${response.formTitle.replace(/\s+/g, "_")}_Report.xlsx`;

    const formData = new FormData();
    formData.append("email", recipientEmail);
    formData.append("subject", `Response Report: ${response.formTitle}`);
    formData.append("file", blob, fileName);
    formData.append("responseId", response._id);

    const token = localStorage.getItem("auth_token");

    console.log("📨 Sending email report to:", recipientEmail);

    const API_BASE_URL = "http://localhost:5000/api";
    const response_obj = await fetch(
      `${API_BASE_URL}/mail/send-response-report`,
      {
        method: "POST",
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    );

    if (!response_obj.ok) {
      const errorData = await response_obj.json().catch(() => ({}));
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
