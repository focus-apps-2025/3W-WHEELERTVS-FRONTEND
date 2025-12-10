import type { Question, FollowUpQuestion } from "../types";
import * as XLSX from "xlsx-js-style"; // Use styled version

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
  if (!url || typeof url !== 'string') {
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
  if (!url || typeof url !== 'string') {
    return false;
  }

  const trimmed = url.trim().toLowerCase();
  
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  if (imageExtensions.some(ext => trimmed.endsWith(ext))) {
    return true;
  }
  
  if (trimmed.includes('drive.google.com')) {
    return true;
  }
  
  if (trimmed.includes('imgur.com') || trimmed.includes('cloudinary.com') || 
      trimmed.includes('s3.amazonaws.com') || trimmed.includes('cdn.')) {
    return true;
  }
  
  return false;
}

export function isGoogleDriveUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  return url.trim().toLowerCase().includes('drive.google.com');
}

export function isCloudinaryUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  return url.trim().toLowerCase().includes('cloudinary.com') || 
         url.trim().toLowerCase().includes('res.cloudinary.com');
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
  console.log(
    "🔄 Generating answer template in WIDE format with Question Type..."
  );

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
    followUps: FollowUpQuestion[]; // FIXED: lowercase 's'
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
          parentGroup.followUps.push(followUp); // FIXED: lowercase 's'
        } else {
          // If parent not found, treat as main question
          groups.push({ main: followUp, followUps: [] });
        }
      } else {
        // No parent ID, treat as main question
        groups.push({ main: followUp, followUps: [] });
      }
    });

    return groups;
  };

  // Prepare all sections with grouped questions
  type PreparedRow = {
    mainQuestion: FollowUpQuestion;
    followUps: FollowUpQuestion[];
    allQuestions: Array<{
      label: string;
      question: FollowUpQuestion;
      type: string;
      options: string;
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
      // Create labels for all questions (main + follow-ups)
      const allQuestions: Array<{
        label: string;
        question: FollowUpQuestion;
        type: string;
        options: string;
      }> = [];

      // Main question
      const mainLabel = `Q${groupIndex + 1}. ${
        group.main.text || "Untitled Question"
      }`;
      const mainType = group.main.type || "text";
      const mainOptions = group.main.options
        ? group.main.options.join("|")
        : "";
      allQuestions.push({
        label: mainLabel,
        question: group.main,
        type: mainType,
        options: mainOptions,
      });

      // Follow-up questions
      group.followUps.forEach((followUp, followUpIndex) => {
        const followUpLabel = `Q${groupIndex + 1}.${followUpIndex + 1}. ${
          followUp.text || "Follow-up"
        }`;
        const followUpType = followUp.type || "text";
        const followUpOptions = followUp.options
          ? followUp.options.join("|")
          : "";
        allQuestions.push({
          label: followUpLabel,
          question: followUp,
          type: followUpType,
          options: followUpOptions,
        });
      });

      console.log(
        `      Q${groupIndex + 1}: "${group.main.text}" (${
          group.followUps.length
        } follow-ups)`
      );
      if (group.followUps.length > 0) {
        group.followUps.forEach((fu, idx) => {
          console.log(
            `        ↳ Follow-up ${idx + 1}: "${fu.text}" (Type: ${fu.type})`
          );
        });
      }

      return {
        mainQuestion: group.main,
        followUps: group.followUps,
        allQuestions,
      };
    });

    preparedSections.push({ title: sectionTitle, rows: rowsForSection });
  });

  // Calculate MAXIMUM number of questions (main + follow-ups) across ALL rows
  let maxQuestionsPerRow = 0;
  preparedSections.forEach((section) => {
    section.rows.forEach((row) => {
      const totalQuestions = row.allQuestions.length;
      if (totalQuestions > maxQuestionsPerRow) {
        maxQuestionsPerRow = totalQuestions;
      }
    });
  });

  console.log(`📊 Layout: Max ${maxQuestionsPerRow} questions per row`);
  console.log(
    `📊 Columns needed: ${
      1 + maxQuestionsPerRow * 4
    } (Section + ${maxQuestionsPerRow} x [Question + Type + Options + Answer])`
  );

  // Build Excel data array WITH QUESTION TYPE COLUMN
  const data: Array<Array<string | number>> = [];

  // HEADER ROW - DYNAMIC based on max questions
  const headerRow: Array<string | number> = ["Section"];
  for (let i = 0; i < maxQuestionsPerRow; i++) {
    headerRow.push(i === 0 ? "Main Question" : "Follow‑Up Question");
    headerRow.push("Question Type");
    headerRow.push("Options");
    headerRow.push("Answer");
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

      const excelRow: Array<string | number> = new Array(1 + maxQuestionsPerRow * 4).fill("");

      // First column: Section title (only on first row of section)
      excelRow[0] = firstRowInSection ? section.title : "";
      firstRowInSection = false;

      // Fill question-type-options-answer quadruples
      let columnIndex = 1;
      row.allQuestions.forEach((q) => {
        excelRow[columnIndex] = q.label; // Question text
        excelRow[columnIndex + 1] = q.type; // Question Type
        excelRow[columnIndex + 2] = q.options; // Options
        excelRow[columnIndex + 3] = ""; // Empty cell for answer
        console.log(`     Column ${columnIndex}: "${q.label}"`);
        console.log(`     Column ${columnIndex + 1}: "${q.type}"`);
        console.log(`     Column ${columnIndex + 2}: "${q.options}"`);
        console.log(`     Column ${columnIndex + 3}: [Answer cell]`);
        columnIndex += 4;
      });

      data.push(excelRow);
    });
  });

  console.log(`📋 Generated ${data.length} rows of data`);
  console.log(`✅ Sample structure with ${data[0]?.length || 0} columns:`);
  if (data[0]) console.log(`   Row 1: ${data[0].join(" | ")}`);
  if (data[1])
    console.log(
      `   Row 2: ${data[1].map((cell) => cell || "[empty]").join(" | ")}`
    );

  // Create worksheet
  const worksheet = utils.aoa_to_sheet(data);

  // Apply COMPLETE styling - matching response export
  // HEADER styling - Blue background
  for (let colIndex = 0; colIndex < headerRow.length; colIndex++) {
    const cellAddress = utils.encode_cell({ r: 0, c: colIndex });
    if (!worksheet[cellAddress]) {
      worksheet[cellAddress] = { t: "s", v: headerRow[colIndex] || "" };
    }

    worksheet[cellAddress].s = {
      font: {
        bold: true,
        color: { rgb: "FFFFFF" },
        sz: 12,
      },
      fill: {
        fgColor: { rgb: "1D4ED8" }, // Blue background
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
  }

  // Apply cell styling for all data rows
  for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];

    // Style section title cell (Column A)
    if (row[0]) {
      const cellAddress = utils.encode_cell({ r: rowIndex, c: 0 });
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = { t: "s", v: row[0] };
      }

      worksheet[cellAddress].s = {
        font: {
          bold: true,
          color: { rgb: "1E40AF" }, // Dark blue text
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

    // Style question, type, options, and answer cells
    let columnIndex = 1;
    let questionIndex = 0;

    while (columnIndex < row.length) {
      const questionCell = utils.encode_cell({ r: rowIndex, c: columnIndex });
      const typeCell = utils.encode_cell({ r: rowIndex, c: columnIndex + 1 });
      const optionsCell = utils.encode_cell({
        r: rowIndex,
        c: columnIndex + 2,
      });
      const answerCell = utils.encode_cell({ r: rowIndex, c: columnIndex + 3 });

      // QUESTION cell styling
      if (row[columnIndex]) {
        if (!worksheet[questionCell]) {
          worksheet[questionCell] = { t: "s", v: row[columnIndex] };
        }

        worksheet[questionCell].s = {
          font: {
            bold: questionIndex === 0,
            color: { rgb: questionIndex === 0 ? "0F172A" : "334155" },
            sz: questionIndex === 0 ? 11 : 10,
          },
          fill: {
            fgColor: { rgb: questionIndex === 0 ? "E0F2FE" : "FFFFFF" },
          },
          alignment: {
            horizontal: "left",
            vertical: "center",
            wrapText: true,
          },
          border: {
            top: {
              style: "thin",
              color: { rgb: questionIndex === 0 ? "CBD5E1" : "E2E8F0" },
            },
            left: {
              style: "thin",
              color: { rgb: questionIndex === 0 ? "CBD5E1" : "E2E8F0" },
            },
            bottom: {
              style: "thin",
              color: { rgb: questionIndex === 0 ? "CBD5E1" : "E2E8F0" },
            },
            right: {
              style: "thin",
              color: { rgb: questionIndex === 0 ? "CBD5E1" : "E2E8F0" },
            },
          },
        };
      }

      // TYPE cell styling
      if (!worksheet[typeCell]) {
        worksheet[typeCell] = { t: "s", v: row[columnIndex + 1] || "" };
      }

      worksheet[typeCell].s = {
        font: {
          color: { rgb: "6B7280" },
          sz: 9,
        },
        fill: {
          fgColor: { rgb: "F9FAFB" },
        },
        alignment: {
          horizontal: "center",
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

      // OPTIONS cell styling
      if (!worksheet[optionsCell]) {
        worksheet[optionsCell] = { t: "s", v: row[columnIndex + 2] || "" };
      }

      worksheet[optionsCell].s = {
        font: {
          color: { rgb: "475569" },
          sz: 9,
          italic: true,
        },
        fill: {
          fgColor: { rgb: "F1F5F9" },
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

      // ANSWER cell styling
      if (!worksheet[answerCell]) {
        worksheet[answerCell] = { t: "s", v: row[columnIndex + 3] || "" };
      }

      worksheet[answerCell].s = {
        font: {
          italic: questionIndex === 0,
          color: { rgb: questionIndex === 0 ? "475569" : "64748B" },
          sz: 10,
        },
        fill: {
          fgColor: { rgb: questionIndex === 0 ? "F8FAFC" : "FFFFFF" },
        },
        alignment: {
          horizontal: "left",
          vertical: "center",
          wrapText: true,
        },
        border: {
          top: {
            style: "thin",
            color: { rgb: questionIndex === 0 ? "CBD5E1" : "E2E8F0" },
          },
          left: {
            style: "thin",
            color: { rgb: questionIndex === 0 ? "CBD5E1" : "E2E8F0" },
          },
          bottom: {
            style: "thin",
            color: { rgb: questionIndex === 0 ? "CBD5E1" : "E2E8F0" },
          },
          right: {
            style: "thin",
            color: { rgb: questionIndex === 0 ? "CBD5E1" : "E2E8F0" },
          },
        },
      };

      columnIndex += 4;
      questionIndex++;
    }
  }

  // Set column widths
  const columnWidths = [];
  columnWidths.push({ wch: 30 }); // Section column

  for (let i = 0; i < maxQuestionsPerRow; i++) {
    columnWidths.push({ wch: 40 }); // Question column
    columnWidths.push({ wch: 15 }); // Type column
    columnWidths.push({ wch: 20 }); // Options column
    columnWidths.push({ wch: 25 }); // Answer column
  }

  worksheet["!cols"] = columnWidths;

  // Create workbook and save
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Answer Template");

  const fileName = `${(form.title || "form")
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()}-answer-template.xlsx`;

  writeFile(workbook, fileName);

  // console.log(`✅ Template saved as: ${fileName}`);
  //console.log(`✅ Format: ${data[0]?.length || 0} columns wide (Section + ${maxQuestionsPerRow} x [Question + Type + Options + Answer])`);
}

// Also update parseAnswerWorkbook to handle the new format
export async function parseAnswerWorkbook(
  file: File,
  form: Question
): Promise<ParsedAnswers> {
  //console.log("🔄 Parsing answer workbook in NEW format with Question Type...");

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
    header: 1, // Get as array of arrays
  });

  // console.log(`📋 Found ${rawData.length} rows in the file`);

  if (rawData.length < 2) {
    throw new Error("No answer data found in the file");
  }

  // Skip header row
  const answerRows = rawData.slice(1);
  const answers: ParsedAnswers = {};

  // Build a map of question text to question ID
  const questionMap = new Map<string, string>();

  const gatherAllQuestions = (
    questions: FollowUpQuestion[],
    sectionIndex: number
  ): void => {
    // Separate main questions from follow-ups
    const mainQuestions = questions.filter(q => !q.parentId && !q.showWhen?.questionId);
    const followUps = questions.filter(q => q.parentId || q.showWhen?.questionId);

    // Keep track of global question counter for this section
    let globalQuestionCounter = sectionIndex * 1000; // Start counting from section offset

    // Map main questions with incrementing numbers (Q1, Q2, Q3, ...)
    mainQuestions.forEach((question, mainIndex) => {
      const questionNumber = mainIndex + 1;
      const base = `Q${questionNumber}`;
      const label = `${base}. ${question.text}`;
      questionMap.set(label.toLowerCase().trim(), question.id);
      //console.log(`   📝 Mapped MAIN: "${label}" → ${question.id}`);

      // Add this question's follow-ups with proper numbering
      if (question.followUpQuestions && question.followUpQuestions.length > 0) {
        const gatherFollowUps = (
          fuQuestions: FollowUpQuestion[],
          path: number[] = []
        ) => {
          fuQuestions.forEach((fu, fuIndex) => {
            const fuLabel = `${base}.${[...path, fuIndex + 1].join(".")}. ${
              fu.text
            }`;
            questionMap.set(fuLabel.toLowerCase().trim(), fu.id);
            // console.log(`   📝 Mapped FOLLOWUP: "${fuLabel}" → ${fu.id}`);

            if (fu.followUpQuestions && fu.followUpQuestions.length > 0) {
              gatherFollowUps(fu.followUpQuestions, [...path, fuIndex + 1]);
            }
          });
        };

        gatherFollowUps(question.followUpQuestions);
      }
    });

    // Also map standalone follow-ups (shouldn't happen, but just in case)
    followUps.forEach((fu) => {
      const label = `Q${sectionIndex + 1}. ${fu.text}`;
      questionMap.set(label.toLowerCase().trim(), fu.id);
    });
  };

  //console.log("📋 Building question map...");

  // Map all questions from the form
  form.sections.forEach((section: Section, sectionIndex) => {
    gatherAllQuestions(section.questions, sectionIndex);
  });

  // Parse answers from Excel - Handle BOTH formats:
  // Format 1 (WIDE): [Section | Q1 | Type | Options | Answer | Q2 | Type | Options | Answer | ...]
  // Format 2 (VERTICAL): Each row has [Section | Question | Type | Options | Answer]
  //console.log("📋 Parsing answers from Excel...");

  // First, detect format by checking if multiple questions exist in first data row
  const isWideFormat = answerRows.length > 0 && 
    Array.isArray(answerRows[0]) && 
    answerRows[0].length > 5 && 
    answerRows[0][5] !== undefined && 
    answerRows[0][5] !== '';

  if (isWideFormat) {
    // WIDE FORMAT: All questions in one row, side-by-side
    answerRows.forEach((row) => {
      if (!Array.isArray(row)) return;

      let columnIndex = 1; // Skip section column
      while (columnIndex < row.length) {
        const questionText = row[columnIndex]?.toString().trim();
        const answerValue = row[columnIndex + 3]?.toString().trim();

        if (questionText && answerValue !== undefined && answerValue !== "") {
          const questionId = questionMap.get(questionText.toLowerCase().trim());
          if (questionId) {
            answers[questionId] = answerValue;
          }
        }
        columnIndex += 4;
      }
    });
  } else {
    // VERTICAL FORMAT: Each question is in its own row
    answerRows.forEach((row) => {
      if (!Array.isArray(row) || row.length < 5) {
        return;
      }

      const questionText = row[1]?.toString().trim(); // Column B: Question
      const answerValue = row[4]?.toString().trim();  // Column E: Answer

      if (questionText && answerValue !== undefined && answerValue !== "") {
        const questionId = questionMap.get(questionText.toLowerCase().trim());
        if (questionId) {
          answers[questionId] = answerValue;
        }
      }
    });
  }

  //console.log(`✅ Parsed ${Object.keys(answers).length} answers`);
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
