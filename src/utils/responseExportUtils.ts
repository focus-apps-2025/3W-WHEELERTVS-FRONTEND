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
  console.log("🔄 Building nested form structure from FLAT data...");

  const processSection = (section: any) => {
    if (!section.questions || !Array.isArray(section.questions)) {
      return section;
    }

    console.log(`📋 Processing section: "${section.title}"`);
    console.log(`   - Original questions: ${section.questions.length}`);

    // Create a map of all questions by ID
    const questionMap = new Map<string, any>();
    section.questions.forEach((q: any) => {
      questionMap.set(q.id, { ...q, followUpQuestions: [] });
    });

    // First pass: Create array of main questions and follow-ups
    const mainQuestions: any[] = [];
    const allQuestions = Array.from(questionMap.values());

    allQuestions.forEach((q: any) => {
      const parentId = q.parentId || q.showWhen?.questionId;
      if (!parentId) {
        mainQuestions.push(q);
      }
    });

    // Second pass: Build nested structure recursively
    const buildNestedStructure = (questions: any[]) => {
      const nestedQuestions: any[] = [];

      questions.forEach((q: any) => {
        // Find all direct children of this question
        const children = allQuestions.filter((child: any) => {
          const childParentId = child.parentId || child.showWhen?.questionId;
          return childParentId === q.id;
        });

        // Recursively build nested structure for children
        if (children.length > 0) {
          q.followUpQuestions = buildNestedStructure(children);
        }

        nestedQuestions.push(q);
      });

      return nestedQuestions;
    };

    // Build nested structure starting from main questions
    const nestedMainQuestions = buildNestedStructure(mainQuestions);

    console.log(
      `   - Main questions after nesting: ${nestedMainQuestions.length}`
    );

    // Log the structure for debugging
    const logQuestionStructure = (q: any, prefix: string = "") => {
      console.log(`${prefix}${q.text} (ID: ${q.id})`);
      if (q.followUpQuestions && q.followUpQuestions.length > 0) {
        q.followUpQuestions.forEach((child: any, index: number) => {
          logQuestionStructure(child, prefix + "  ↳ ");
        });
      }
    };

    nestedMainQuestions.forEach((q, index) => {
      console.log(`   - Q${index + 1} structure:`);
      logQuestionStructure(q, "     ");
    });

    return {
      ...section,
      questions: nestedMainQuestions,
    };
  };

  const nestedSections = form.sections?.map(processSection);
  const result = { ...form, sections: nestedSections };

  console.log("✅ Nested form structure completed");
  return result;
}

interface SheetContent {
  data: any[][];
  links: HyperlinkEntry[];
  headerStyle: Record<string, any>;
  cellStyles: Record<string, any>;
  columnWidths: { wch: number }[];
}

function buildResponsesSheetContent(
  response: ResponseData,
  form: FormData,
  type?: "yes-only" | "no-only" | "na-only" | "both" | "default"
): SheetContent {
  console.log("🔄 Building responses sheet content...");

  const rows: any[][] = [];
  const links: HyperlinkEntry[] = [];
  const headerStyle: Record<string, any> = {};
  const cellStyles: Record<string, any> = {};

  const addLink = (r: number, c: number, target: string, display: string) => {
    links.push({ rowIndex: r, columnIndex: c, target, display });
  };

  // New: Gather questions with proper hierarchical numbering
  const gatherQuestionPairs = (
    question: any,
    prefix: string,
    depth: number = 0
  ) => {
    const pairs: Array<{
      label: string;
      ans: FormattedAnswer;
      depth: number;
      questionNumber: string;
      type?: string;
    }> = [];

    // Process a question and all its nested follow-ups
    const processQuestion = (q: any, qNumber: string, qDepth: number) => {
      // Get answer and type for current question
      const answer = formatAnswerForExport(response.answers?.[q.id], q);
      const questionType = q?.type || "text";

      console.log(`   ${qNumber}: "${q?.text || "Untitled"}"`);
      console.log(`     - Depth: ${qDepth}`);
      console.log(`     - Answer: ${answer.display}`);
      console.log(
        `     - Has follow-ups: ${q?.followUpQuestions?.length || 0}`
      );

      // Add current question to pairs
      pairs.push({
        label: q?.text || "Untitled Question",
        ans: answer,
        depth: qDepth,
        questionNumber: qNumber,
        type: questionType,
      });

      // Process follow-ups recursively
      if (q?.followUpQuestions && q.followUpQuestions.length > 0) {
        q.followUpQuestions.forEach((followUp: any, index: number) => {
          // Create hierarchical number for follow-up
          const followUpNumber = `${qNumber}.${index + 1}`;
          processQuestion(followUp, followUpNumber, qDepth + 1);
        });
      }
    };

    // Start processing with the main question
    processQuestion(question, prefix, depth);

    console.log(`   📊 Total pairs for ${prefix}: ${pairs.length}`);
    return pairs;
  };

  // Prepare all sections
  type PreparedRow = {
    pairs: Array<{
      label: string;
      ans: FormattedAnswer;
      depth: number;
      questionNumber: string;
      type?: string;
    }>;
  };
  type PreparedSection = { title: string; rows: PreparedRow[] };
  const preparedSections: PreparedSection[] = [];

  console.log("📋 Processing form sections...");
  (form.sections || []).forEach((section: any, sectionIndex: number) => {
    const title = `Section ${sectionIndex + 1}: ${
      section?.title || "Untitled Section"
    }`;
    console.log(`\n📁 ${title}`);

    const rowsForSection: PreparedRow[] = [];
    let mainQuestionIndex = 0;

    // Process each main question in section
    section?.questions?.forEach((question: any) => {
      // Check if it's a main question (no parentId or showWhen)
      const isMainQuestion =
        !question.parentId && !question.showWhen?.questionId;

      if (isMainQuestion) {
        mainQuestionIndex++;
        const questionNumber = `Q${mainQuestionIndex}`;
        const pairs = gatherQuestionPairs(question, questionNumber);

        // Apply filtering based on type
        const shouldInclude = (() => {
          if (!type || type === "default") return true;

          const mainAns = pairs[0]?.ans?.display;
          if (!mainAns) return false;

          if (type === "yes-only") return mainAns === "Yes";
          if (type === "no-only") return mainAns === "No";
          if (type === "na-only") return mainAns === "N/A";
          if (type === "both") return ["Yes", "No", "N/A"].includes(mainAns);

          return true;
        })();

        if (shouldInclude) {
          rowsForSection.push({ pairs });
        }
      }
    });

    preparedSections.push({ title, rows: rowsForSection });
  });

  // Process form-level follow-up questions
  if (form.followUpQuestions?.length) {
    console.log(
      `\n📋 Processing form-level follow-up questions: ${form.followUpQuestions.length}`
    );
    const fqTitle = "Form Follow-up Questions";

    // Filter to find main questions at form level
    const mainFormQuestions = form.followUpQuestions.filter(
      (q: any) => !q.parentId && !q.showWhen?.questionId
    );

    const rowsForFQ = mainFormQuestions
      .map((question: any, index: number) => ({
        pairs: gatherQuestionPairs(question, `FQ${index + 1}`),
      }))
      .filter((row) => {
        if (!type || type === "default") return true;

        const mainAns = row.pairs[0]?.ans?.display;
        if (!mainAns) return false;

        if (type === "yes-only") return mainAns === "Yes";
        if (type === "no-only") return mainAns === "No";
        if (type === "na-only") return mainAns === "N/A";
        if (type === "both") return ["Yes", "No", "N/A"].includes(mainAns);

        return true;
      });

    preparedSections.push({ title: fqTitle, rows: rowsForFQ });
  }

  // Calculate max columns needed
  const maxPairs = preparedSections.reduce(
    (m, s) => Math.max(m, ...s.rows.map((r) => r.pairs.length)),
    0
  );

  console.log(`\n📊 Layout Summary:`);
  console.log(`   - Maximum question pairs per row: ${maxPairs}`);
  console.log(`   - Total columns needed: ${1 + maxPairs * 4}`);

  // ---------- HEADER ----------------
  const headerRow: any[] = ["Section"];
  for (let i = 0; i < maxPairs; i++) {
    headerRow.push("Question No.");
    headerRow.push("Question");
    headerRow.push("Type");
    headerRow.push("Answer");
  }
  rows.push(headerRow);

  // Apply header styles
  headerRow.forEach((_, c) => {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    headerStyle[addr] = {
      font: {
        bold: true,
        color: { rgb: "FFFFFF" },
        sz: 12,
      },
      fill: {
        fgColor: { rgb: "1D4ED8" },
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

  preparedSections.forEach((section) => {
    console.log(`\n📁 Processing section: ${section.title}`);
    let firstRowInSection = true;
    let sectionRowCount = 0;

    section.rows.forEach((rowData) => {
      const row: any[] = new Array(1 + maxPairs * 4).fill("");
      row[0] = firstRowInSection ? section.title : "";
      firstRowInSection = false;

      let col = 1;
      rowData.pairs.forEach((pair, pairIndex) => {
        // Question Number
        row[col] = pair.questionNumber;
        // Question Text with indentation
        const indent = "  ".repeat(pair.depth);
        row[col + 1] = `${indent}${pair.label}`;
        // Question Type
        row[col + 2] = pair.type || "text";
        // Answer
        row[col + 3] = pair.ans.display;

        const rowIdx = rows.length;
        const qNoAddr = XLSX.utils.encode_cell({ r: rowIdx, c: col });
        const qTextAddr = XLSX.utils.encode_cell({ r: rowIdx, c: col + 1 });
        const qTypeAddr = XLSX.utils.encode_cell({ r: rowIdx, c: col + 2 });
        const ansAddr = XLSX.utils.encode_cell({ r: rowIdx, c: col + 3 });

        // Apply styling based on depth
        const bgColor =
          pair.depth === 0 ? "E0F2FE" : pair.depth === 1 ? "F0F9FF" : "F8FAFC";

        const textColor =
          pair.depth === 0 ? "0F172A" : pair.depth === 1 ? "334155" : "64748B";

        const fontSize = pair.depth === 0 ? 11 : pair.depth === 1 ? 10 : 9;

        const isBold = pair.depth === 0;
        const isItalic = pair.depth > 0;

        // Question Number cell style
        cellStyles[qNoAddr] = {
          font: {
            bold: isBold,
            color: { rgb: textColor },
            sz: fontSize,
          },
          fill: {
            fgColor: { rgb: bgColor },
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

        // Question Text cell style
        cellStyles[qTextAddr] = {
          font: {
            bold: isBold,
            italic: isItalic,
            color: { rgb: textColor },
            sz: fontSize,
          },
          fill: {
            fgColor: { rgb: bgColor },
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

        // Question Type cell style
        cellStyles[qTypeAddr] = {
          font: {
            bold: false,
            color: { rgb: textColor },
            sz: fontSize - 1,
          },
          fill: {
            fgColor: { rgb: bgColor },
          },
          alignment: {
            horizontal: "center",
            vertical: "center",
          },
          border: {
            top: { style: "thin", color: { rgb: "CBD5E1" } },
            left: { style: "thin", color: { rgb: "CBD5E1" } },
            bottom: { style: "thin", color: { rgb: "CBD5E1" } },
            right: { style: "thin", color: { rgb: "CBD5E1" } },
          },
        };

        // Answer cell style
        cellStyles[ansAddr] = {
          font: {
            italic: true,
            color: { rgb: "475569" },
            sz: fontSize,
          },
          fill: {
            fgColor: { rgb: "FFFFFF" },
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

        if (pair.ans.hyperlink) {
          addLink(rowIdx, col + 3, pair.ans.hyperlink, pair.ans.display);
        }

        col += 4;
      });

      // Style the section title cell
      if (row[0]) {
        const sectionAddr = XLSX.utils.encode_cell({ r: rows.length, c: 0 });
        cellStyles[sectionAddr] = {
          font: {
            bold: true,
            color: { rgb: "1E40AF" },
            sz: 12,
          },
          fill: {
            fgColor: { rgb: "DBEAFE" },
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
  });

  // Calculate column widths
  const columnWidths = [
    { wch: 25 }, // Section
  ];

  // For each question pair block, add 4 columns
  for (let i = 0; i < maxPairs; i++) {
    columnWidths.push({ wch: 12 }); // Question No.
    columnWidths.push({ wch: 35 }); // Question
    columnWidths.push({ wch: 10 }); // Type
    columnWidths.push({ wch: 30 }); // Answer
  }

  console.log(`\n✅ FINAL SUMMARY:`);
  console.log(`   - Total data rows: ${totalRows}`);
  console.log(`   - Total columns: ${1 + maxPairs * 4}`);

  return {
    data: rows,
    links,
    headerStyle,
    cellStyles,
    columnWidths,
  };
}

function applyHyperlinks(sheet: XLSX.WorkSheet, links: HyperlinkEntry[]): void {
  links.forEach(({ rowIndex, columnIndex, target, display }) => {
    const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
    const existingCell = sheet[cellAddress] as XLSX.CellObject | undefined;
    const cellObject: XLSX.CellObject = existingCell ?? { t: "s", v: display };
    cellObject.v = display;
    cellObject.t = "s";
    cellObject.l = { Target: target, Tooltip: display };

    if (existingCell && existingCell.s) {
      cellObject.s = existingCell.s;
    }

    sheet[cellAddress] = cellObject;
  });
}

// Update the main export function
export function generateResponseExcelReport(
  responses: ResponseData | ResponseData[],
  form: FormData,
  fileName?: string,
  type?: "yes-only" | "no-only" | "na-only" | "both" | "default"
): void {
  const workbook = utils.book_new();

  const responsesArray = Array.isArray(responses) ? responses : [responses];

  if (responsesArray.length === 0) {
    console.error("No responses to export");
    return;
  }

  const nestedForm = buildNestedForm(form);

  responsesArray.forEach((response, index) => {
    const {
      data: responsesData,
      links: responsesLinks,
      headerStyle,
      cellStyles,
      columnWidths,
    } = buildResponsesSheetContent(response, nestedForm, type);

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

    // Apply column widths
    responsesSheet["!cols"] = columnWidths;

    applyHyperlinks(responsesSheet, responsesLinks);

    const sheetName =
      responsesArray.length > 1 ? `Response ${index + 1}` : "Responses";

    utils.book_append_sheet(workbook, responsesSheet, sheetName);
  });

  const finalFileName =
    fileName ||
    `${form.title.replace(/\s+/g, "_")}_${
      new Date().toISOString().split("T")[0]
    }.xlsx`;

  writeFile(workbook, finalFileName);

  console.log("✅ Excel file generated with hierarchical question structure");
}

export function generateResponseExcelBlob(
  responses: ResponseData | ResponseData[],
  form: FormData,
  type?: "yes-only" | "no-only" | "na-only" | "both" | "default"
): Blob {
  const workbook = utils.book_new();
  const responsesArray = Array.isArray(responses) ? responses : [responses];
  const nestedForm = buildNestedForm(form);

  responsesArray.forEach((response, index) => {
    const {
      data: responsesData,
      links: responsesLinks,
      headerStyle,
      cellStyles,
      columnWidths,
    } = buildResponsesSheetContent(response, nestedForm, type);

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

    responsesSheet["!cols"] = columnWidths;
    applyHyperlinks(responsesSheet, responsesLinks);

    const sheetName =
      responsesArray.length > 1 ? `Response ${index + 1}` : "Responses";
    utils.book_append_sheet(workbook, responsesSheet, sheetName);
  });

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

// ▼▼▼ EMAIL VERSION (returns Blob) ▼▼▼
export function createExcelWorkbook(
  response: ResponseData,
  form: FormData,
  type?: "yes-only" | "no-only" | "na-only" | "both" | "default"
): Blob {
  const workbook = utils.book_new();

  // Build nested form structure and create responses sheet
  const nestedForm = buildNestedForm(form);
  const {
    data: responsesData,
    links: responsesLinks,
    headerStyle,
    cellStyles,
    columnWidths,
  } = buildResponsesSheetContent(response, nestedForm, type);

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

  responsesSheet["!cols"] = columnWidths;
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
