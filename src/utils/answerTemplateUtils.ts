import type { Question, FollowUpQuestion } from "../types";
import * as XLSX from "xlsx-js-style";

const { utils, writeFile } = XLSX;

// Define Section locally since it's not exported
type Section = {
  id: string;
  title: string;
  description?: string;
  questions: FollowUpQuestion[];
};

export interface ParsedAnswers {
  [questionId: string]: unknown;
}

export function convertGoogleDriveLink(url: string): string {
  if (!url || typeof url !== "string") {
    return url;
  }

  const trimmed = url.trim();

  const fileIdMatch = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (fileIdMatch && fileIdMatch[1]) {
    const fileId = fileIdMatch[1];
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  return trimmed;
}

export function isImageUrl(url: string): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }

  const trimmed = url.trim().toLowerCase();

  const imageExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".svg",
  ];
  if (imageExtensions.some((ext) => trimmed.endsWith(ext))) {
    return true;
  }

  if (trimmed.includes("drive.google.com")) {
    return true;
  }

  if (
    trimmed.includes("imgur.com") ||
    trimmed.includes("cloudinary.com") ||
    trimmed.includes("s3.amazonaws.com") ||
    trimmed.includes("cdn.")
  ) {
    return true;
  }

  return false;
}

export function isGoogleDriveUrl(url: string): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }
  return url.trim().toLowerCase().includes("drive.google.com");
}

export function isCloudinaryUrl(url: string): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }
  return (
    url.trim().toLowerCase().includes("cloudinary.com") ||
    url.trim().toLowerCase().includes("res.cloudinary.com")
  );
}

function parseNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "number") {
    return Number.isNaN(value) ? undefined : value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const normalized = trimmed.endsWith("%")
      ? trimmed.slice(0, -1).trim()
      : trimmed;
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function generateAnswerTemplate(form: Question) {
  console.log("🔄 Generating answer template with Question IDs...");

  if (!form.sections || form.sections.length === 0) {
    throw new Error("Form has no sections");
  }

  // Prepare all sections with grouped questions
  type PreparedRow = {
    mainQuestionNumber: string;
    mainQuestion: FollowUpQuestion;
    allQuestions: Array<{
      label: string;
      questionNumber: string;
      question: FollowUpQuestion;
      type: string;
      options: string;
      id: string;
      depth: number;
    }>;
  };
  type PreparedSection = { title: string; rows: PreparedRow[] };

  const preparedSections: PreparedSection[] = [];

  console.log(`📋 Processing ${form.sections.length} sections...`);

  // Process ALL sections
  form.sections.forEach((section: Section, sectionIndex: number) => {
    const sectionTitle = `Section ${sectionIndex + 1}: ${
      section.title || "Untitled Section"
    }`;

    console.log(`\n   📁 Section ${sectionIndex + 1}: "${section.title}"`);

    if (!section.questions || !Array.isArray(section.questions)) {
      console.warn(`   ⚠️ Section has no questions array, skipping...`);
      return;
    }

    // Find main questions (questions without parentId or showWhen)
    const mainQuestions: FollowUpQuestion[] = [];

    section.questions.forEach((q) => {
      if (!q.parentId && !q.showWhen?.questionId) {
        mainQuestions.push(q);
      }
    });

    // If no main questions found by criteria, use all top-level questions
    if (mainQuestions.length === 0) {
      mainQuestions.push(...section.questions);
    }

    const rowsForSection: PreparedRow[] = [];

    // Process each main question
    mainQuestions.forEach((mainQuestion, mainIndex) => {
      if (!mainQuestion) return;

      const mainQuestionNumber = `Q${mainIndex + 1}`;

      // Create array for all questions (main + follow-ups)
      const allQuestions: Array<{
        label: string;
        questionNumber: string;
        question: FollowUpQuestion;
        type: string;
        options: string;
        id: string;
        depth: number;
      }> = [];

      // Add main question
      const mainLabel = mainQuestion.text || "Untitled Question";
      const mainType = mainQuestion.type || "text";
      let mainOptions = mainQuestion.options
        ? mainQuestion.options.join("|")
        : "";

      // Provide format hint for special types
      if (mainType === "chassis-with-zone") {
        mainOptions = "Format: Chassis: [ID]; Status: [Accepted/Rework/Rejected]; Zones: [Zone A, Zone B]; Category: [Cat]; Defects: [Defect (Remark) {URL}]; Evidence: {URL}";
      } else if (mainType === "chassis-without-zone") {
        mainOptions = "Format: Chassis: [ID]; Status: [Accepted/Rework/Rejected]; Category: [Cat]; Defects: [Defect (Remark) {URL}]; Evidence: {URL}";
      }

      allQuestions.push({
        label: mainLabel,
        questionNumber: mainQuestionNumber,
        question: mainQuestion,
        type: mainType,
        options: mainOptions,
        id: mainQuestion.id,
        depth: 0,
      });

      // Collect ALL follow-up questions for this main question
      const processedIds = new Set<string>();
      processedIds.add(mainQuestion.id);

      // Function to collect follow-ups recursively
      const collectFollowUps = (
        parentQuestion: FollowUpQuestion,
        parentQuestionNumber: string,
        depth: number,
      ) => {
        const followUps: FollowUpQuestion[] = [];

        // Check for flat follow-ups (by showWhen)
        section.questions.forEach((q) => {
          if (
            q.showWhen?.questionId === parentQuestion.id &&
            !processedIds.has(q.id)
          ) {
            followUps.push(q);
            processedIds.add(q.id);
          }
        });

        // Check for nested follow-ups in parent question
        if (parentQuestion.followUpQuestions) {
          parentQuestion.followUpQuestions.forEach((fq) => {
            if (!processedIds.has(fq.id)) {
              followUps.push(fq);
              processedIds.add(fq.id);
            }
          });
        }

        // Process each follow-up
        followUps.forEach((followUp, index) => {
          // Generate follow-up number
          let followUpNumber: string;

          if (parentQuestionNumber.startsWith("Q")) {
            // First-level follow-ups: FU1, FU2, etc.
            followUpNumber = `FU${index + 1}`;
          } else {
            // Nested follow-ups: FU1.1, FU1.2, etc.
            followUpNumber = `${parentQuestionNumber}.${index + 1}`;
          }

          const followUpLabel = followUp.text || "Follow-up Question";
          const followUpType = followUp.type || "text";
          let followUpOptions = followUp.options
            ? followUp.options.join("|")
            : "";

          // Provide format hint for special types
          if (followUpType === "chassis-with-zone") {
            followUpOptions = "Format: Chassis: [ID]; Status: [Accepted/Rework/Rejected]; Zones: [Zone A, Zone B]; Category: [Cat]; Defects: [Defect (Remark) {URL}]; Evidence: {URL}";
          } else if (followUpType === "chassis-without-zone") {
            followUpOptions = "Format: Chassis: [ID]; Status: [Accepted/Rework/Rejected]; Category: [Cat]; Defects: [Defect (Remark) {URL}]; Evidence: {URL}";
          }

          allQuestions.push({
            label: followUpLabel,
            questionNumber: followUpNumber,
            question: followUp,
            type: followUpType,
            options: followUpOptions,
            id: followUp.id,
            depth: depth,
          });

          // Recursively collect this follow-up's follow-ups
          collectFollowUps(followUp, followUpNumber, depth + 1);
        });
      };

      // Start collecting follow-ups
      collectFollowUps(mainQuestion, mainQuestionNumber, 1);

      rowsForSection.push({
        mainQuestionNumber,
        mainQuestion: mainQuestion,
        allQuestions,
      });
    });

    preparedSections.push({ title: sectionTitle, rows: rowsForSection });
  });

  // Calculate MAXIMUM number of follow-ups across ALL rows (to determine column count)
  let maxFollowUpsPerRow = 0;
  preparedSections.forEach((section) => {
    section.rows.forEach((row) => {
      const totalFollowUps = row.allQuestions.length - 1;
      if (totalFollowUps > maxFollowUpsPerRow) {
        maxFollowUpsPerRow = totalFollowUps;
      }
    });
  });

  console.log(`\n📊 Maximum follow-ups in any row: ${maxFollowUpsPerRow}`);

  // Build Excel data with Question ID columns
  const data: Array<Array<string | number>> = [];

  // HEADER ROW - WITH HIDDEN QUESTION ID COLUMNS
  const headerRow: Array<string | number> = [
    "Section",
    "Question No.",
    "Question",
    "Question ID", // HIDDEN - for mapping
    "Type",
    "Options",
    "Image/File URL",
    "Answer",
  ];

  // Add headers for follow-ups (7 columns per follow-up - including hidden ID)
  for (let i = 0; i < maxFollowUpsPerRow; i++) {
    headerRow.push(`FU No.`);
    headerRow.push(`Follow-up Question`);
    headerRow.push(`Question ID`); // HIDDEN - for mapping
    headerRow.push(`Type`);
    headerRow.push(`Options`);
    headerRow.push(`Image/File URL`);
    headerRow.push(`Answer`);
  }

  data.push(headerRow);

  // BODY ROWS with Question IDs
  preparedSections.forEach((section) => {
    let firstRowInSection = true;

    section.rows.forEach((row) => {
      const totalFollowUps = row.allQuestions.length - 1;

      // Create row with Question ID columns
      const excelRow: Array<string | number> = new Array(
        8 + maxFollowUpsPerRow * 7, // 8 main columns + (follow-ups * 7 columns each)
      ).fill("");

      excelRow[0] = firstRowInSection ? section.title : "";
      firstRowInSection = false;

      // Main question data
      const mainQuestion = row.allQuestions[0];
      excelRow[1] = mainQuestion.questionNumber;
      excelRow[2] = mainQuestion.label;
      excelRow[3] = mainQuestion.id; // Question ID (hidden)
      excelRow[4] = mainQuestion.type;
      excelRow[5] = mainQuestion.options;
      excelRow[6] = (mainQuestion.question as any).imageUrl || ""; // Image URL
      excelRow[7] = ""; // Answer column

      // Fill follow-up columns with Question IDs
      for (let i = 0; i < totalFollowUps; i++) {
        const followUp = row.allQuestions[i + 1];
        const columnOffset = 8 + i * 7; // 7 columns per follow-up

        // Column 1: FU No.
        excelRow[columnOffset] = followUp.questionNumber;

        // Column 2: Follow-up Question (with indentation for nested)
        const indent = "  ".repeat(followUp.depth - 1);
        excelRow[columnOffset + 1] = `${indent}${followUp.label}`;

        // Column 3: Question ID (hidden)
        excelRow[columnOffset + 2] = followUp.id;

        // Column 4: Type
        excelRow[columnOffset + 3] = followUp.type;

        // Column 5: Options
        excelRow[columnOffset + 4] = followUp.options;

        // Column 6: Image URL
        excelRow[columnOffset + 5] = (followUp.question as any).imageUrl || "";

        // Column 7: Answer
        excelRow[columnOffset + 6] = "";
      }

      data.push(excelRow);
    });
  });

  console.log(`\n📋 Generated ${data.length - 1} data rows with Question IDs`);

  // Create worksheet
  const worksheet = utils.aoa_to_sheet(data);

  // Apply COMPACT styling to header row
  for (let colIndex = 0; colIndex < headerRow.length; colIndex++) {
    const cellAddress = utils.encode_cell({ r: 0, c: colIndex });
    if (!worksheet[cellAddress]) {
      worksheet[cellAddress] = { t: "s", v: headerRow[colIndex] || "" };
    }

    // Hide Question ID columns by making font color same as background
    const isQuestionIdColumn = headerRow[colIndex] === "Question ID";

    worksheet[cellAddress].s = {
      font: {
        bold: true,
        color: { rgb: isQuestionIdColumn ? "1D4ED8" : "FFFFFF" }, // Hide Question ID text
        sz: 10, // Reduced from 11 to 10 for compactness
      },
      fill: { fgColor: { rgb: "1D4ED8" } },
      alignment: {
        horizontal: "center",
        vertical: "center",
        wrapText: false, // Disable wrap text for compactness
      },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      },
    };
  }

  // Set ROW HEIGHTS for compact appearance
  const rowHeights: Array<{ hpx: number }> = [];

  // Header row height
  rowHeights.push({ hpx: 25 }); // Compact height for header

  // Data rows height
  for (let i = 1; i < data.length; i++) {
    rowHeights.push({ hpx: 20 }); // Compact height for data rows
  }

  worksheet["!rows"] = rowHeights;

  // Style data rows with COMPACT dimensions
  for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];

    // Section header style (compact)
    if (row[0]) {
      const cellAddress = utils.encode_cell({ r: rowIndex, c: 0 });
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = { t: "s", v: row[0] };
      }
      worksheet[cellAddress].s = {
        font: { bold: true, color: { rgb: "1E40AF" }, sz: 10 }, // Smaller font
        fill: { fgColor: { rgb: "DBEAFE" } },
        alignment: {
          horizontal: "left",
          vertical: "center",
          wrapText: false, // No wrap text for compactness
        },
        border: {
          top: { style: "thin", color: { rgb: "93C5FD" } },
          left: { style: "thin", color: { rgb: "93C5FD" } },
          bottom: { style: "thin", color: { rgb: "93C5FD" } },
          right: { style: "thin", color: { rgb: "93C5FD" } },
        },
      };
    }

    // Style main question cells (skip Question ID column)
    for (let colIndex = 1; colIndex <= 6; colIndex++) {
      const cellAddress = utils.encode_cell({ r: rowIndex, c: colIndex });
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = { t: "s", v: row[colIndex] };
      }

      // Hide Question ID column (column index 3)
      const isQuestionIdColumn = colIndex === 3;

      worksheet[cellAddress].s = {
        font: {
          bold: colIndex !== 3, // Don't bold Question ID
          color: { rgb: isQuestionIdColumn ? "FFFFFF" : "000000" }, // Hide Question ID text
          sz: 9, // Smaller font for compactness
        },
        fill: { fgColor: { rgb: "FFFFFF" } },
        alignment: {
          horizontal: "left",
          vertical: "center",
          wrapText: false, // No wrap text
        },
        border: {
          top: { style: "thin", color: { rgb: "E2E8F0" } },
          left: { style: "thin", color: { rgb: "E2E8F0" } },
          bottom: { style: "thin", color: { rgb: "E2E8F0" } },
          right: { style: "thin", color: { rgb: "E2E8F0" } },
        },
      };
    }

    // Style Answer cells function (compact)
    const styleAnswerCell = (columnIndex: number) => {
      if (columnIndex >= row.length) return;

      const cellAddress = utils.encode_cell({ r: rowIndex, c: columnIndex });
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = { t: "s", v: row[columnIndex] || "" };
      }
      worksheet[cellAddress].s = {
        font: { color: { rgb: "000000" }, sz: 9 }, // Smaller font
        fill: { fgColor: { rgb: "FEF3C7" } },
        alignment: {
          horizontal: "left",
          vertical: "center",
          wrapText: false, // No wrap text
        },
        border: {
          top: { style: "medium", color: { rgb: "F59E0B" } },
          left: { style: "medium", color: { rgb: "F59E0B" } },
          bottom: { style: "medium", color: { rgb: "F59E0B" } },
          right: { style: "medium", color: { rgb: "F59E0B" } },
        },
      };
    };

    // Style main answer cell
    styleAnswerCell(7);

    // Style follow-up cells (compact)
    for (
      let followUpIndex = 0;
      followUpIndex < maxFollowUpsPerRow;
      followUpIndex++
    ) {
      const baseColumnOffset = 8 + followUpIndex * 7;

      if (row[baseColumnOffset]) {
        // Style FU No. cell (compact)
        const fuNoCell = utils.encode_cell({
          r: rowIndex,
          c: baseColumnOffset,
        });
        if (!worksheet[fuNoCell]) {
          worksheet[fuNoCell] = { t: "s", v: row[baseColumnOffset] || "" };
        }

        const fuNoText = row[baseColumnOffset]?.toString() || "";
        const isNested = fuNoText.split(".").length > 1;

        worksheet[fuNoCell].s = {
          font: {
            color: { rgb: isNested ? "6B7280" : "DC2626" },
            sz: isNested ? 8 : 9, // Smaller font for nested
          },
          fill: { fgColor: { rgb: isNested ? "F9FAFB" : "FEE2E2" } },
          alignment: {
            horizontal: "left",
            vertical: "center",
            wrapText: false, // No wrap text
          },
          border: {
            top: { style: "thin", color: { rgb: "E5E7EB" } },
            left: { style: "thin", color: { rgb: "E5E7EB" } },
            bottom: { style: "thin", color: { rgb: "E5E7EB" } },
            right: { style: "thin", color: { rgb: "E5E7EB" } },
          },
        };

        // Style Question ID cell for follow-up (hidden and compact)
        const questionIdCell = utils.encode_cell({
          r: rowIndex,
          c: baseColumnOffset + 2,
        });
        if (!worksheet[questionIdCell]) {
          worksheet[questionIdCell] = {
            t: "s",
            v: row[baseColumnOffset + 2] || "",
          };
        }
        worksheet[questionIdCell].s = {
          font: { color: { rgb: "FFFFFF" }, sz: 1 }, // Hidden - tiny font
          fill: { fgColor: { rgb: "FFFFFF" } },
          alignment: { horizontal: "left", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "FFFFFF" } },
            left: { style: "thin", color: { rgb: "FFFFFF" } },
            bottom: { style: "thin", color: { rgb: "FFFFFF" } },
            right: { style: "thin", color: { rgb: "FFFFFF" } },
          },
        };

        // Style follow-up question text cell (compact)
        const questionCell = utils.encode_cell({
          r: rowIndex,
          c: baseColumnOffset + 1,
        });
        if (!worksheet[questionCell]) {
          worksheet[questionCell] = {
            t: "s",
            v: row[baseColumnOffset + 1] || "",
          };
        }

        const questionText = row[baseColumnOffset + 1]?.toString() || "";
        const indentLevel =
          (questionText.match(/^(\s+)/)?.[0]?.length || 0) / 2;

        worksheet[questionCell].s = {
          font: {
            color: { rgb: indentLevel > 0 ? "6B7280" : "374151" },
            sz: indentLevel > 0 ? 8 : 9, // Smaller font
          },
          fill: { fgColor: { rgb: indentLevel > 0 ? "F9FAFB" : "FFFFFF" } },
          alignment: {
            horizontal: "left",
            vertical: "center",
            wrapText: false, // No wrap text
          },
          border: {
            top: { style: "thin", color: { rgb: "E5E7EB" } },
            left: { style: "thin", color: { rgb: "E5E7EB" } },
            bottom: { style: "thin", color: { rgb: "E5E7EB" } },
            right: { style: "thin", color: { rgb: "E5E7EB" } },
          },
        };

        // Style Type, Options, and Image cells (compact)
        for (let offset = 3; offset <= 5; offset++) {
          const typeCell = utils.encode_cell({
            r: rowIndex,
            c: baseColumnOffset + offset,
          });
          if (!worksheet[typeCell]) {
            worksheet[typeCell] = {
              t: "s",
              v: row[baseColumnOffset + offset] || "",
            };
          }
          worksheet[typeCell].s = {
            font: { color: { rgb: "000000" }, sz: 9 },
            fill: { fgColor: { rgb: "FFFFFF" } },
            alignment: {
              horizontal: "left",
              vertical: "center",
              wrapText: false,
            },
            border: {
              top: { style: "thin", color: { rgb: "E5E7EB" } },
              left: { style: "thin", color: { rgb: "E5E7EB" } },
              bottom: { style: "thin", color: { rgb: "E5E7EB" } },
              right: { style: "thin", color: { rgb: "E5E7EB" } },
            },
          };
        }

        // Style follow-up answer cell
        styleAnswerCell(baseColumnOffset + 6);
      }
    }
  }

  // Set COMPACT column widths
  const columnWidths = [
    { wch: 15 }, // Section - Reduced from 25
    { wch: 8 }, // Question No. - Reduced from 12
    { wch: 25 }, // Question - Reduced from 35
    { wch: 0 }, // Question ID - HIDDEN (width 0)
    { wch: 8 }, // Type - Reduced from 10
    { wch: 15 }, // Options - Reduced from 20
    { wch: 25 }, // Image/File URL - Added
    { wch: 20 }, // Answer - Reduced from 30
  ];

  // COMPACT widths for follow-up columns (7 columns per follow-up)
  for (let i = 0; i < maxFollowUpsPerRow; i++) {
    columnWidths.push({ wch: 8 }); // FU No. - Reduced from 12
    columnWidths.push({ wch: 25 }); // Follow-up Question - Reduced from 30
    columnWidths.push({ wch: 0 }); // Question ID - HIDDEN (width 0)
    columnWidths.push({ wch: 8 }); // Type - Reduced from 10
    columnWidths.push({ wch: 15 }); // Options - Reduced from 20
    columnWidths.push({ wch: 25 }); // Image/File URL - Added
    columnWidths.push({ wch: 20 }); // Answer - Reduced from 30
  }

  worksheet["!cols"] = columnWidths;

  // Hide Question ID columns completely
  const hiddenColumns: number[] = [3]; // Hide main Question ID column (column D)

  // Calculate and hide all follow-up Question ID columns
  for (let i = 0; i < maxFollowUpsPerRow; i++) {
    hiddenColumns.push(8 + i * 7 + 2); // Add follow-up Question ID columns
  }
  worksheet["!hiddenCols"] = hiddenColumns;

  // Freeze header row and first 3 columns for better navigation
  worksheet["!freeze"] = {
    xSplit: 3, // Freeze first 3 columns
    ySplit: 1, // Freeze header row
    topLeftCell: "D2",
    activePane: "bottomRight",
  };

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Answer Template");

  const fileName = `${(form.title || "form")
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()}-answer-template.xlsx`;

  writeFile(workbook, fileName);

  console.log(`\n✅ Template saved as: ${fileName}`);
  console.log(`📊 Total rows: ${data.length - 1}`);
  console.log(`📏 Compact dimensions: Header height 25px, Data rows 20px`);
  console.log(
    `📐 Column widths optimized for readability without excessive space`,
  );

  return fileName;
}
// Updated parser for the new format
export async function parseAnswerWorkbook(
  file: File,
  form: Question,
  onProgress?: (current: number, total: number, message: string) => void,
): Promise<ParsedAnswers> {
  console.log("🔄 Parsing answer workbook using Question IDs...");

  const { read } = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer, { type: "array" });

  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) {
    throw new Error("Workbook has no sheets");
  }

  // Read as array to preserve column structure
  const rawData = utils.sheet_to_json<Array<unknown>>(worksheet, {
    defval: "",
    header: 1,
  });

  console.log(`📋 Found ${rawData.length} rows in the file`);

  if (rawData.length < 2) {
    throw new Error("No answer data found in the file");
  }

  const headerRow = rawData[0];
  console.log("📋 Header row:", headerRow);

  // Find Question ID column indices
  const findColumnIndex = (searchText: string): number => {
    return headerRow.findIndex(
      (header: any) => header?.toString().trim() === searchText,
    );
  };

  const mainQuestionIdCol = findColumnIndex("Question ID");
  const mainQuestionCol = findColumnIndex("Question");
  const mainAnswerCol = findColumnIndex("Answer");

  console.log(`🔍 Column indices: 
    Main Question ID: ${mainQuestionIdCol}
    Main Question: ${mainQuestionCol}
    Main Answer: ${mainAnswerCol}`);

  // Skip header row
  const answerRows = rawData.slice(1);
  const answers: ParsedAnswers = {};

  onProgress?.(0, answerRows.length, "Starting to parse answers...");

  console.log("📋 Parsing answers using Question IDs...");

  let parsedCount = 0;
  let matchedCount = 0;
  let unmatchedCount = 0;

  answerRows.forEach((row, rowIndex) => {
    if (!Array.isArray(row)) {
      console.log(`⚠️ Skipping row ${rowIndex + 1}: not an array`);
      return;
    }

    console.log(`\n🔍 Row ${rowIndex + 2}:`);

    // Process MAIN question using Question ID
    const mainQuestionId = row[mainQuestionIdCol]?.toString().trim() || "";
    const mainAnswerValue = row[mainAnswerCol]?.toString().trim() || "";

    if (mainQuestionId && mainAnswerValue) {
      // Direct match using Question ID
      let matchedQuestion: FollowUpQuestion | undefined;

      // Search through all sections and questions
      form.sections.forEach((section) => {
        section.questions.forEach((q) => {
          if (q.id === mainQuestionId) {
            matchedQuestion = q;
          }

          // Also check nested follow-ups
          if (q.followUpQuestions) {
            q.followUpQuestions.forEach((fq) => {
              if (fq.id === mainQuestionId) {
                matchedQuestion = fq;
              }
            });
          }
        });
      });

      if (matchedQuestion) {
        answers[matchedQuestion.id] = mainAnswerValue;
        parsedCount++;
        matchedCount++;
        console.log(`   ✅ Main (ID: ${mainQuestionId}): "${mainAnswerValue}"`);
      } else {
        unmatchedCount++;
        console.log(
          `   ❓ No match found for Question ID: "${mainQuestionId}"`,
        );

        // Fallback: Try to match by question text
        const mainQuestionText = row[mainQuestionCol]?.toString().trim() || "";
        if (mainQuestionText) {
          form.sections.forEach((section) => {
            section.questions.forEach((q) => {
              if (q.text === mainQuestionText && !q.showWhen?.questionId) {
                answers[q.id] = mainAnswerValue;
                parsedCount++;
                console.log(
                  `   ✅ Fallback match by text: "${mainQuestionText}"`,
                );
              }
            });
          });
        }
      }
    }

    // Process FOLLOW-UP questions
    // Find all follow-up Question ID columns
    for (let colIndex = 0; colIndex < headerRow.length; colIndex++) {
      const header = headerRow[colIndex]?.toString().trim();
      if (header === "Question ID" && colIndex > mainQuestionIdCol) {
        // This is a follow-up Question ID column
        const questionId = row[colIndex]?.toString().trim() || "";
        const answerColIndex = colIndex + 4; // Answer is 4 columns after Question ID (Question ID, Type, Options, Image/File URL, Answer)
        const answerValue = row[answerColIndex]?.toString().trim() || "";

        if (questionId && answerValue) {
          // Direct match using Question ID
          let matchedFollowUp: FollowUpQuestion | undefined;

          form.sections.forEach((section) => {
            section.questions.forEach((q) => {
              if (q.id === questionId) {
                matchedFollowUp = q;
              }

              // Also check nested follow-ups
              if (q.followUpQuestions) {
                q.followUpQuestions.forEach((fq) => {
                  if (fq.id === questionId) {
                    matchedFollowUp = fq;
                  }
                });
              }
            });
          });

          if (matchedFollowUp) {
            answers[matchedFollowUp.id] = answerValue;
            parsedCount++;
            matchedCount++;
            console.log(
              `     ✅ Follow-up (ID: ${questionId}): "${answerValue}"`,
            );
          } else {
            unmatchedCount++;
            console.log(`     ❓ No match for Question ID: "${questionId}"`);
          }
        }
      }
    }

    onProgress?.(
      rowIndex + 1,
      answerRows.length,
      `Processing row ${rowIndex + 1}/${answerRows.length}`,
    );
  });

  console.log(`\n📊 PARSING COMPLETE using Question IDs:`);
  console.log(`   ✅ Successfully parsed: ${parsedCount} answers`);
  console.log(`   ✓ Question ID matches: ${matchedCount}`);
  console.log(`   ✗ Unmatched Question IDs: ${unmatchedCount}`);
  console.log(`   📋 Total answers ready: ${Object.keys(answers).length}`);

  onProgress?.(
    answerRows.length,
    answerRows.length,
    `Parsed ${parsedCount} answers using Question IDs`,
  );

  return answers;
}

function parseChassisAnswer(value: string, type: string) {
  if (!value || typeof value !== "string") return value;

  const result: any = {
    chassisNumber: "",
    status: "",
    defectCategory: [],
    defects: [],
  };

  if (type === "chassis-with-zone") {
    result.zone = [];
  }

  // Split by semicolon
  const parts = value.split(";").map((p) => p.trim());

  parts.forEach((part) => {
    const lowerPart = part.toLowerCase();
    if (lowerPart.startsWith("chassis:")) {
      result.chassisNumber = part.split(":")[1]?.trim() || "";
    } else if (lowerPart.startsWith("status:")) {
      result.status = part.split(":")[1]?.trim() || "";
    } else if (lowerPart.startsWith("zones:") && type === "chassis-with-zone") {
      const zonesStr = part.split(":")[1]?.trim() || "";
      result.zone = zonesStr
        .split(",")
        .map((z) => z.trim())
        .filter(Boolean);
    } else if (lowerPart.startsWith("category:")) {
      const catStr = part.split(":")[1]?.trim() || "";
      result.defectCategory = catStr
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
    } else if (lowerPart.startsWith("defects:")) {
      const defectsStr = part.split(":")[1]?.trim() || "";
      // Split defects by comma, but be careful of commas inside remarks/brackets
      // Simple split for now, assuming defects are comma separated
      const defectItems = defectsStr.split(",").map((d) => d.trim()).filter(Boolean);
      
      result.defects = defectItems.map(item => {
        // Look for remark in () and URL in {}
        const remarkMatch = item.match(/\((.*?)\)/);
        const urlMatch = item.match(/\{(.*?)\}/);
        
        let name = item;
        if (remarkMatch) name = name.replace(remarkMatch[0], "");
        if (urlMatch) name = name.replace(urlMatch[0], "");
        
        return {
          name: name.trim(),
          remark: remarkMatch ? remarkMatch[1] : "",
          fileUrl: urlMatch ? urlMatch[1] : ""
        };
      });
    } else if (lowerPart.startsWith("evidence:")) {
      const evidenceStr = part.split(":")[1]?.trim() || "";
      const urlMatch = evidenceStr.match(/\{(.*?)\}/);
      result.evidenceUrl = urlMatch ? urlMatch[1] : (evidenceStr || "");
    }
  });

  // Fallback for simple status-only input
  if (!result.status && (value === "Accepted" || value === "Rejected" || value === "Rework")) {
    result.status = value;
  }

  return result;
}

export function formatAnswersForSubmission(
  form: Question,
  parsedAnswers: ParsedAnswers,
) {
  const answers: Record<string, unknown> = {};

  // ===== CRITICAL: Keep EVERY single key from parsedAnswers =====
  // This ensures NO DATA IS LOST
  Object.entries(parsedAnswers).forEach(([key, value]) => {
    answers[key] = value;
  });

  // Handle regular form questions (convert types as needed)
  const flattenQuestions = (
    questions: FollowUpQuestion[],
  ): FollowUpQuestion[] => {
    const flattened: FollowUpQuestion[] = [];
    questions.forEach((q) => {
      flattened.push(q);
      if (q.followUpQuestions && q.followUpQuestions.length > 0) {
        flattened.push(...flattenQuestions(q.followUpQuestions));
      }
    });
    return flattened;
  };

  form.sections.forEach((section: Section) => {
    const allQuestions = flattenQuestions(section.questions);
    allQuestions.forEach((question) => {
      const answerValue = parsedAnswers[question.id];
      if (answerValue !== undefined) {
        if (question.type === "checkboxes" && typeof answerValue === "string") {
          answers[question.id] = answerValue
            .split("|")
            .map((a) => a.trim())
            .filter(Boolean);
        } else if (
          (question.type === "chassis-with-zone" ||
            question.type === "chassis-without-zone") &&
          typeof answerValue === "string"
        ) {
          answers[question.id] = parseChassisAnswer(answerValue, question.type);
        } else if (question.type === "multipleChoice") {
          answers[question.id] = answerValue;
        } else if (question.type === "number" || question.type === "rating") {
          answers[question.id] = parseNumber(answerValue) || answerValue;
        } else if (question.type === "fileInput" || question.type === "image") {
          const imageUrl = String(answerValue).trim();
          answers[question.id] = isImageUrl(imageUrl)
            ? convertGoogleDriveLink(imageUrl)
            : imageUrl;
        } else {
          answers[question.id] = answerValue;
        }
      }
    });
  });

  console.log("📤 FINAL formatted answers:", {
    totalKeys: Object.keys(answers).length,
    syntheticKeys: Object.keys(answers).filter((k) =>
      k.startsWith("synthetic_"),
    ).length,
    photoKeys: Object.keys(answers).filter((k) => k.includes("_photo_")).length,
    regularKeys: Object.keys(answers).filter(
      (k) =>
        !k.startsWith("synthetic_") &&
        !k.includes("_photo_") &&
        k.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        ),
    ).length,
  });

  return { answers };
}
