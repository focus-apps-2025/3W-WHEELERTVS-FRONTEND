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
  console.log("🔄 Generating answer template WITH QUESTION IDs...");

  if (!form.sections || form.sections.length === 0) {
    throw new Error("Form has no sections");
  }

  // Function to detect if a question is a follow-up
  const isFollowUpQuestion = (question: FollowUpQuestion): boolean => {
    return !!(question.parentId || question.showWhen?.questionId);
  };

  // Function to group main questions with their follow-ups
  const groupQuestionsWithFollowUps = (
    questions: FollowUpQuestion[]
  ): Array<{
    main: FollowUpQuestion;
    followUps: FollowUpQuestion[];
  }> => {
    const groups: Array<{
      main: FollowUpQuestion;
      followUps: FollowUpQuestion[];
    }> = [];
    const followUpsList: FollowUpQuestion[] = [];

    // First pass: Separate main questions and follow-ups
    questions.forEach((q) => {
      if (isFollowUpQuestion(q)) {
        followUpsList.push(q);
      } else {
        groups.push({ main: q, followUps: [] });
      }
    });

    // Second pass: Attach follow-ups to their parent questions
    followUpsList.forEach((followUp) => {
      const parentId = followUp.parentId || followUp.showWhen?.questionId;
      if (parentId) {
        const parentGroup = groups.find((g) => g.main.id === parentId);
        if (parentGroup) {
          parentGroup.followUps.push(followUp);
        } else {
          groups.push({ main: followUp, followUps: [] });
        }
      } else {
        groups.push({ main: followUp, followUps: [] });
      }
    });

    return groups;
  };

  // Prepare all sections with grouped questions
  type PreparedRow = {
    questionNumber: string;
    mainQuestion: FollowUpQuestion;
    followUps: FollowUpQuestion[];
    allQuestions: Array<{
      label: string;
      questionNumber: string;
      question: FollowUpQuestion;
      type: string;
      options: string;
      id: string;
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

    // Group questions in this section
    const groups = groupQuestionsWithFollowUps(section.questions);
    console.log(`   📁 Section ${sectionIndex + 1}: "${section.title}"`);
    console.log(`      Total questions: ${section.questions.length}`);
    console.log(`      Main question groups: ${groups.length}`);

    const rowsForSection: PreparedRow[] = groups.map((group, groupIndex) => {
      // Create labels and question numbers for all questions (main + follow-ups)
      const allQuestions: Array<{
        label: string;
        questionNumber: string;
        question: FollowUpQuestion;
        type: string;
        options: string;
        id: string;
      }> = [];

      // Main question
      const mainQuestionNumber = `Q${groupIndex + 1}`;
      const mainLabel = group.main.text || "Untitled Question";
      const mainType = group.main.type || "text";
      const mainOptions = group.main.options
        ? group.main.options.join("|")
        : "";

      allQuestions.push({
        label: mainLabel,
        questionNumber: mainQuestionNumber,
        question: group.main,
        type: mainType,
        options: mainOptions,
        id: group.main.id,
      });

      // Follow-up questions
      group.followUps.forEach((followUp, followUpIndex) => {
        const followUpQuestionNumber = `${mainQuestionNumber}.${
          followUpIndex + 1
        }`;
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
        });
      });

      return {
        questionNumber: mainQuestionNumber,
        mainQuestion: group.main,
        followUps: group.followUps,
        allQuestions,
      };
    });

    preparedSections.push({ title: sectionTitle, rows: rowsForSection });
  });

  // Calculate MAXIMUM number of follow-ups across ALL rows
  let maxFollowUpsPerRow = 0;
  preparedSections.forEach((section) => {
    section.rows.forEach((row) => {
      const totalFollowUps = row.followUps.length;
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
    "Main Question",
    "Question ID",
    "Type",
    "Options",
    "Answer",
  ];

  for (let i = 0; i < maxFollowUpsPerRow; i++) {
    headerRow.push(`Follow-up ${i + 1}`);
    headerRow.push(`Question ID`);
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
        } questions (1 main + ${row.followUps.length} follow-ups)`
      );

      const excelRow: Array<string | number> = new Array(
        7 + maxFollowUpsPerRow * 5
      ).fill("");

      excelRow[0] = firstRowInSection ? section.title : "";
      firstRowInSection = false;

      const mainQuestion = row.allQuestions[0];
      excelRow[1] = mainQuestion.questionNumber;
      excelRow[2] = mainQuestion.label;
      excelRow[3] = mainQuestion.id;
      excelRow[4] = mainQuestion.type;
      excelRow[5] = mainQuestion.options;
      excelRow[6] = "";

      console.log(
        `     Main Question: ${mainQuestion.questionNumber} "${mainQuestion.label}" (ID: ${mainQuestion.id})`
      );

      for (let i = 0; i < row.followUps.length; i++) {
        const followUp = row.allQuestions[i + 1];
        const columnOffset = 7 + i * 5;

        excelRow[columnOffset] = followUp.label;
        excelRow[columnOffset + 1] = followUp.id;
        excelRow[columnOffset + 2] = followUp.type;
        excelRow[columnOffset + 3] = followUp.options;
        excelRow[columnOffset + 4] = "";

        console.log(
          `     Follow-up ${i + 1}: ${followUp.questionNumber} "${
            followUp.label
          }" (ID: ${followUp.id})`
        );
      }

      data.push(excelRow);
    });
  });

  console.log(`📋 Generated ${data.length} rows of data`);

  const worksheet = utils.aoa_to_sheet(data);

  // Apply styling
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

    // REMOVED: Styling for the gray background on Question ID columns is no longer needed.

    // Style Answer cells
    const mainAnswerCell = utils.encode_cell({ r: rowIndex, c: 6 });
    if (!worksheet[mainAnswerCell]) {
      worksheet[mainAnswerCell] = { t: "s", v: row[6] || "" };
    }
    worksheet[mainAnswerCell].s = {
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

    for (
      let followUpIndex = 0;
      followUpIndex < maxFollowUpsPerRow;
      followUpIndex++
    ) {
      const answerColumnOffset = 7 + followUpIndex * 5 + 4;

      const followUpAnswerCell = utils.encode_cell({
        r: rowIndex,
        c: answerColumnOffset,
      });
      if (!worksheet[followUpAnswerCell]) {
        worksheet[followUpAnswerCell] = {
          t: "s",
          v: row[answerColumnOffset] || "",
        };
      }
      worksheet[followUpAnswerCell].s = {
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
    }
  }

  // Set column widths and hide Question ID columns
  const columnWidths = [
    { wch: 25 }, // Section
    { wch: 12 }, // Question No.
    { wch: 35 }, // Main Question
    { hidden: true }, // MODIFIED: Question ID is now hidden
    { wch: 10 }, // Type
    { wch: 15 }, // Options
    { wch: 30 }, // Answer for main question
  ];

  for (let i = 0; i < maxFollowUpsPerRow; i++) {
    columnWidths.push({ wch: 30 }); // Follow-up question
    columnWidths.push({ hidden: true }); // MODIFIED: Question ID is now hidden
    columnWidths.push({ wch: 10 }); // Type
    columnWidths.push({ wch: 15 }); // Options
    columnWidths.push({ wch: 30 }); // Answer
  }

  worksheet["!cols"] = columnWidths;

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Answer Template");

  const fileName = `${(form.title || "form")
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()}-answer-template.xlsx`;

  writeFile(workbook, fileName);

  console.log(`✅ Template saved as: ${fileName}`);
  console.log(
    ` IMPORTANT: Question IDs are included but hidden for mapping. DO NOT edit.`
  );
  console.log(
    ` Users should only fill in the "Answer" columns (highlighted with blue borders).`
  );

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
