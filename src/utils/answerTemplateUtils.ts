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
  console.log("🔄 Generating answer template...");

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

    console.log(`   📁 Section ${sectionIndex + 1}: "${section.title}"`);
    console.log(
      `      Total questions in section.questions: ${section.questions.length}`
    );

    // First, identify all questions in this section
    const allQuestionsInSection = section.questions;

    // Find main questions (those without parentId or showWhen)
    const mainQuestions = allQuestionsInSection.filter(
      (q) => !q.parentId && !q.showWhen?.questionId
    );

    console.log(`      Main questions found: ${mainQuestions.length}`);
    console.log(
      `      Follow-up questions: ${
        allQuestionsInSection.length - mainQuestions.length
      }`
    );

    const rowsForSection: PreparedRow[] = [];

    // Process each main question
    mainQuestions.forEach((mainQuestion, mainIndex) => {
      const mainQuestionNumber = `Q${mainIndex + 1}`;

      // Create labels and question numbers for all questions (main + follow-ups)
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
      const mainOptions = mainQuestion.options
        ? mainQuestion.options.join("|")
        : "";

      allQuestions.push({
        label: mainLabel,
        questionNumber: mainQuestionNumber,
        question: mainQuestion,
        type: mainType,
        options: mainOptions,
        id: mainQuestion.id,
        depth: 0,
      });

      console.log(`     Main Question ${mainQuestionNumber}: "${mainLabel}"`);

      // Recursive function to find and organize follow-ups
      const findAndOrganizeFollowUps = (
        parentQuestionId: string,
        prefix: string,
        depth: number
      ): number => {
        // Find direct follow-ups of this parent
        const directFollowUps = allQuestionsInSection.filter((q) => {
          const parentId = q.parentId || q.showWhen?.questionId;
          return parentId === parentQuestionId;
        });

        console.log(
          `       Found ${directFollowUps.length} direct follow-ups for ${parentQuestionId}`
        );

        let childIndex = 1;

        directFollowUps.forEach((followUp) => {
          const followUpQuestionNumber = `${prefix}.${childIndex}`;
          const followUpLabel = followUp.text || "Follow-up";
          const followUpType = followUp.type || "text";
          const followUpOptions = followUp.options
            ? followUp.options.join("|")
            : "";

          allQuestions.push({
            label: followUpLabel,
            questionNumber: followUpQuestionNumber,
            question: followUp,
            type: followUpType,
            options: followUpOptions,
            id: followUp.id,
            depth: depth,
          });

          console.log(
            `         Added follow-up ${followUpQuestionNumber}: "${followUpLabel}"`
          );

          childIndex++;

          // Recursively find nested follow-ups
          findAndOrganizeFollowUps(
            followUp.id,
            followUpQuestionNumber,
            depth + 1
          );
        });

        return childIndex - 1; // Return count of children
      };

      // Find and organize all follow-ups for this main question
      console.log(
        `     Finding follow-ups for ${mainQuestionNumber} (ID: ${mainQuestion.id})...`
      );
      findAndOrganizeFollowUps(mainQuestion.id, mainQuestionNumber, 1);

      rowsForSection.push({
        mainQuestionNumber,
        mainQuestion: mainQuestion,
        allQuestions,
      });

      console.log(
        `     Total questions for ${mainQuestionNumber}: ${allQuestions.length}`
      );
    });

    console.log(`      Total rows in section: ${rowsForSection.length}`);

    preparedSections.push({ title: sectionTitle, rows: rowsForSection });
  });

  // Calculate MAXIMUM number of follow-ups across ALL rows (including nested)
  let maxFollowUpsPerRow = 0;
  preparedSections.forEach((section) => {
    section.rows.forEach((row) => {
      const totalFollowUps = row.allQuestions.length - 1; // Subtract 1 for main question
      if (totalFollowUps > maxFollowUpsPerRow) {
        maxFollowUpsPerRow = totalFollowUps;
      }
    });
  });

  console.log(`📊 Layout: Max ${maxFollowUpsPerRow} follow-ups per row`);

  // Build Excel data array with new structure
  const data: Array<Array<string | number>> = [];

  // HEADER ROW
  const headerRow: Array<string | number> = [
    "Section",
    "Question No.",
    "Question",
    "Type",
    "Options",
    "Answer",
  ];

  // Add headers for follow-ups (each with its own Question No. column)
  for (let i = 0; i < maxFollowUpsPerRow; i++) {
    headerRow.push(`Q No.`);
    headerRow.push(`Follow-up Question`);
    headerRow.push(`Type`);
    headerRow.push(`Options`);
    headerRow.push(`Answer`);
  }

  data.push(headerRow);
  console.log(`📋 Header row (${headerRow.length} columns):`, headerRow);

  // BODY ROWS
  preparedSections.forEach((section) => {
    console.log(`📋 Processing section: "${section.title}"`);
    let firstRowInSection = true;

    section.rows.forEach((row, rowIndex) => {
      console.log(
        `   Row ${rowIndex + 1}: ${
          row.allQuestions.length
        } questions (1 main + ${row.allQuestions.length - 1} follow-ups)`
      );

      const excelRow: Array<string | number> = new Array(
        6 + maxFollowUpsPerRow * 5
      ).fill("");

      excelRow[0] = firstRowInSection ? section.title : "";
      firstRowInSection = false;

      // Main question data
      const mainQuestion = row.allQuestions[0];
      excelRow[1] = mainQuestion.questionNumber; // Question No.
      excelRow[2] = mainQuestion.label; // Question
      excelRow[3] = mainQuestion.type; // Type
      excelRow[4] = mainQuestion.options; // Options
      excelRow[5] = ""; // Answer

      console.log(
        `     Main Question: ${mainQuestion.questionNumber} "${mainQuestion.label}"`
      );

      // Fill follow-up columns
      for (let i = 0; i < row.allQuestions.length - 1; i++) {
        const followUp = row.allQuestions[i + 1];
        const columnOffset = 6 + i * 5; // Starting column for follow-up groups

        // Add question number for follow-up
        excelRow[columnOffset] = followUp.questionNumber; // Q No.

        // Add indentation based on depth for better readability
        const indent = "  ".repeat(followUp.depth);
        excelRow[columnOffset + 1] = `${indent}${followUp.label}`; // Follow-up Question
        excelRow[columnOffset + 2] = followUp.type; // Type
        excelRow[columnOffset + 3] = followUp.options; // Options
        excelRow[columnOffset + 4] = ""; // Answer

        console.log(
          `     Follow-up ${i + 1}: ${followUp.questionNumber} "${
            followUp.label
          }" (Depth ${followUp.depth})`
        );
      }

      data.push(excelRow);
    });
  });

  console.log(`📋 Generated ${data.length} rows of data`);

  const worksheet = utils.aoa_to_sheet(data);

  // Apply styling to header row
  for (let colIndex = 0; colIndex < headerRow.length; colIndex++) {
    const cellAddress = utils.encode_cell({ r: 0, c: colIndex });
    if (!worksheet[cellAddress]) {
      worksheet[cellAddress] = { t: "s", v: headerRow[colIndex] || "" };
    }
    worksheet[cellAddress].s = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
      fill: { fgColor: { rgb: "1D4ED8" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      },
    };
  }

  // Style data rows
  for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];

    // Section header style
    if (row[0]) {
      const cellAddress = utils.encode_cell({ r: rowIndex, c: 0 });
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = { t: "s", v: row[0] };
      }
      worksheet[cellAddress].s = {
        font: { bold: true, color: { rgb: "1E40AF" }, sz: 12 },
        fill: { fgColor: { rgb: "DBEAFE" } },
        alignment: { horizontal: "left", vertical: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "93C5FD" } },
          left: { style: "thin", color: { rgb: "93C5FD" } },
          bottom: { style: "thin", color: { rgb: "93C5FD" } },
          right: { style: "thin", color: { rgb: "93C5FD" } },
        },
      };
    }

    // Style main question cells
    for (let colIndex = 1; colIndex <= 4; colIndex++) {
      const cellAddress = utils.encode_cell({ r: rowIndex, c: colIndex });
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = { t: "s", v: row[colIndex] };
      }
      worksheet[cellAddress].s = {
        font: { bold: true, color: { rgb: "000000" }, sz: 11 },
        fill: { fgColor: { rgb: "FFFFFF" } },
        alignment: { horizontal: "left", vertical: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "E2E8F0" } },
          left: { style: "thin", color: { rgb: "E2E8F0" } },
          bottom: { style: "thin", color: { rgb: "E2E8F0" } },
          right: { style: "thin", color: { rgb: "E2E8F0" } },
        },
      };
    }

    // Style Answer cells function
    const styleAnswerCell = (columnIndex: number) => {
      const cellAddress = utils.encode_cell({ r: rowIndex, c: columnIndex });
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = { t: "s", v: row[columnIndex] || "" };
      }
      worksheet[cellAddress].s = {
        font: { color: { rgb: "000000" }, sz: 11 },
        fill: { fgColor: { rgb: "FFFFFF" } },
        alignment: { horizontal: "left", vertical: "center", wrapText: true },
        border: {
          top: { style: "medium", color: { rgb: "3B82F6" } },
          left: { style: "medium", color: { rgb: "3B82F6" } },
          bottom: { style: "medium", color: { rgb: "3B82F6" } },
          right: { style: "medium", color: { rgb: "3B82F6" } },
        },
      };
    };

    // Style main answer cell
    styleAnswerCell(5);

    // Style follow-up cells
    for (
      let followUpIndex = 0;
      followUpIndex < maxFollowUpsPerRow;
      followUpIndex++
    ) {
      const baseColumnOffset = 6 + followUpIndex * 5;

      if (row[baseColumnOffset]) {
        // Only style if there's data
        // Style follow-up question number cell
        const qNoCell = utils.encode_cell({ r: rowIndex, c: baseColumnOffset });
        if (!worksheet[qNoCell]) {
          worksheet[qNoCell] = { t: "s", v: row[baseColumnOffset] || "" };
        }

        const qNoText = row[baseColumnOffset]?.toString() || "";
        const isNested = qNoText.split(".").length > 2; // Check if it's like Q1.1.1

        worksheet[qNoCell].s = {
          font: {
            color: { rgb: isNested ? "6B7280" : "4B5563" },
            sz: isNested ? 10 : 11,
          },
          fill: { fgColor: { rgb: isNested ? "F9FAFB" : "FFFFFF" } },
          alignment: { horizontal: "left", vertical: "center", wrapText: true },
          border: {
            top: { style: "thin", color: { rgb: "E5E7EB" } },
            left: { style: "thin", color: { rgb: "E5E7EB" } },
            bottom: { style: "thin", color: { rgb: "E5E7EB" } },
            right: { style: "thin", color: { rgb: "E5E7EB" } },
          },
        };

        // Style follow-up question text cell (with indentation)
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
            sz: indentLevel > 0 ? 10 : 11,
            italic: indentLevel > 0,
          },
          fill: { fgColor: { rgb: indentLevel > 0 ? "F9FAFB" : "FFFFFF" } },
          alignment: { horizontal: "left", vertical: "center", wrapText: true },
          border: {
            top: { style: "thin", color: { rgb: "E5E7EB" } },
            left: { style: "thin", color: { rgb: "E5E7EB" } },
            bottom: { style: "thin", color: { rgb: "E5E7EB" } },
            right: { style: "thin", color: { rgb: "E5E7EB" } },
          },
        };

        // Style follow-up answer cell
        styleAnswerCell(baseColumnOffset + 4);
      }
    }
  }

  // Set column widths
  const columnWidths = [
    { wch: 25 }, // Section
    { wch: 12 }, // Question No. (main)
    { wch: 35 }, // Question (main)
    { wch: 10 }, // Type (main)
    { wch: 15 }, // Options (main)
    { wch: 30 }, // Answer (main)
  ];

  for (let i = 0; i < maxFollowUpsPerRow; i++) {
    columnWidths.push({ wch: 12 }); // Q No. (follow-up)
    columnWidths.push({ wch: 30 }); // Follow-up Question
    columnWidths.push({ wch: 10 }); // Type (follow-up)
    columnWidths.push({ wch: 15 }); // Options (follow-up)
    columnWidths.push({ wch: 30 }); // Answer (follow-up)
  }

  worksheet["!cols"] = columnWidths;

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Answer Template");

  const fileName = `${(form.title || "form")
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()}-answer-template.xlsx`;

  writeFile(workbook, fileName);

  console.log(`✅ Template saved as: ${fileName}`);
  console.log(`📊 Total questions in template: ${data.length - 1}`);
  console.log(`🎯 Each follow-up has its own Question Number column`);
  console.log(
    `🔢 Question numbering format: Q1, Q1.1, Q1.1.1, Q1.1.2, Q1.2, etc.`
  );
  console.log(`💡 Nested questions are properly numbered and indented`);

  return fileName;
}

// Also update parseAnswerWorkbook to handle the new format
export async function parseAnswerWorkbook(
  file: File,
  form: Question,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<ParsedAnswers> {
  console.log("🔄 Parsing answer workbook USING QUESTION IDs...");

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

  // Validate this is our new format with Question IDs
  if (
    !headerRow ||
    !Array.isArray(headerRow) ||
    headerRow[3] !== "Question ID"
  ) {
    throw new Error(
      "Invalid Excel format. Please use the latest template with Question IDs."
    );
  }

  // Skip header row
  const answerRows = rawData.slice(1);
  const answers: ParsedAnswers = {};

  onProgress?.(0, answerRows.length, "Starting to parse answers...");

  console.log("📋 Parsing answers using Question IDs (perfect mapping)...");

  let parsedCount = 0;
  let emptyAnswerCount = 0;

  // Column indices for NEW format:
  // 0: Section
  // 1: Question No.
  // 2: Main Question
  // 3: Question ID (MAIN)
  // 4: Type
  // 5: Options
  // 6: Answer (MAIN)
  // 7+: Follow-up groups (5 columns each)

  answerRows.forEach((row, rowIndex) => {
    if (!Array.isArray(row)) {
      console.log(`⚠️ Skipping row ${rowIndex + 1}: not an array`);
      return;
    }

    // DEBUG: Show row data
    console.log(`\n🔍 Row ${rowIndex + 2}:`);
    console.log(`   Main Question ID: "${row[3]}"`);
    console.log(`   Main Answer: "${row[6]}"`);

    // Process MAIN question
    const mainQuestionId = row[3]?.toString().trim() || "";
    const mainAnswerValue = row[6]?.toString().trim() || "";

    // ONLY process if we have BOTH a valid question ID AND a non-empty answer
    if (mainQuestionId && mainAnswerValue) {
      // Validate the question ID exists in the form
      let questionExists = false;
      form.sections.forEach((section) => {
        section.questions.forEach((q) => {
          if (q.id === mainQuestionId) {
            questionExists = true;
          }
        });
      });

      if (questionExists) {
        answers[mainQuestionId] = mainAnswerValue;
        parsedCount++;
        console.log(`   ✅ Main: ID ${mainQuestionId} = "${mainAnswerValue}"`);
      } else {
        console.log(`   ❌ Invalid Question ID: ${mainQuestionId}`);
      }
    } else if (mainQuestionId && !mainAnswerValue) {
      emptyAnswerCount++;
      console.log(`   ⏭️  Main: ID ${mainQuestionId} - Skipped (empty answer)`);
    }

    // Process FOLLOW-UP questions
    let followUpIndex = 0;
    let columnIndex = 7; // Start of first follow-up group

    // Each follow-up group has 5 columns:
    // 0: Follow-up text
    // 1: Question ID (FOLLOW-UP)
    // 2: Type
    // 3: Options
    // 4: Answer

    while (columnIndex + 4 < row.length) {
      const followUpId = row[columnIndex + 1]?.toString().trim() || "";
      const followUpAnswer = row[columnIndex + 4]?.toString().trim() || "";

      console.log(
        `   Follow-up ${
          followUpIndex + 1
        }: ID "${followUpId}", Answer "${followUpAnswer}"`
      );

      // ONLY process if we have BOTH a valid question ID AND a non-empty answer
      if (followUpId && followUpAnswer) {
        // Validate the question ID exists in the form
        let followUpExists = false;
        form.sections.forEach((section) => {
          section.questions.forEach((q) => {
            if (q.id === followUpId) {
              followUpExists = true;
            }
          });
        });

        if (followUpExists) {
          answers[followUpId] = followUpAnswer;
          parsedCount++;
          console.log(
            `     ✅ Follow-up: ID ${followUpId} = "${followUpAnswer}"`
          );
        } else {
          console.log(`     ❌ Invalid Follow-up ID: ${followUpId}`);
        }
      } else if (followUpId && !followUpAnswer) {
        emptyAnswerCount++;
        console.log(
          `     ⏭️  Follow-up: ID ${followUpId} - Skipped (empty answer)`
        );
      }

      followUpIndex++;
      columnIndex += 5; // Move to next follow-up group
    }
  });

  console.log(`\n📊 PARSING COMPLETE:`);
  console.log(`   ✅ Successfully parsed: ${parsedCount} answers`);
  console.log(`   ⏭️  Skipped (empty): ${emptyAnswerCount} questions`);
  console.log(
    `   📋 Total answers ready for submission: ${Object.keys(answers).length}`
  );

  // Show what was actually parsed
  console.log("\n🔍 ANSWERS TO BE SUBMITTED:");
  Object.entries(answers).forEach(([questionId, answer], index) => {
    // Find question text for display
    let questionText = "Unknown";
    form.sections.forEach((section) => {
      section.questions.forEach((q) => {
        if (q.id === questionId) {
          questionText = q.text || "Unknown";
        }
      });
    });
    console.log(
      `   ${index + 1}. ${questionId}: "${questionText.substring(
        0,
        50
      )}..." = "${answer}"`
    );
  });

  onProgress?.(
    answerRows.length,
    answerRows.length,
    `Parsed ${parsedCount} answers`
  );

  return answers;
}

export function formatAnswersForSubmission(
  form: Question,
  parsedAnswers: ParsedAnswers
) {
  const answers: Record<string, unknown> = {};

  const flattenQuestions = (
    questions: FollowUpQuestion[]
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

  return { answers };
}
