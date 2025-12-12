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
    "🔄 Generating answer template with Question Number column..."
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
    questionNumber: string;
    mainQuestion: FollowUpQuestion;
    followUps: FollowUpQuestion[];
    allQuestions: Array<{
      label: string;
      questionNumber: string;
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
      // Create labels and question numbers for all questions (main + follow-ups)
      const allQuestions: Array<{
        label: string;
        questionNumber: string;
        question: FollowUpQuestion;
        type: string;
        options: string;
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
      });

      // Follow-up questions
      group.followUps.forEach((followUp, followUpIndex) => {
        const followUpQuestionNumber = `${mainQuestionNumber}.${followUpIndex + 1}`;
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
        });
      });

      console.log(
        `      ${mainQuestionNumber}: "${group.main.text}" (${
          group.followUps.length
        } follow-ups)`
      );
      if (group.followUps.length > 0) {
        group.followUps.forEach((fu, idx) => {
          console.log(
            `        ↳ ${mainQuestionNumber}.${idx + 1}: "${fu.text}" (Type: ${fu.type})`
          );
        });
      }

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
  console.log(
    `📊 Columns needed: ${
      5 + maxFollowUpsPerRow * 3
    } (Section + Question No. + Main Question + Type + Options + Answer + ${maxFollowUpsPerRow} x [Follow-up + Type + Options + Answer])`
  );

  // Build Excel data array with new structure
  const data: Array<Array<string | number>> = [];

  // HEADER ROW - DYNAMIC based on max follow-ups
  const headerRow: Array<string | number> = [
    "Section", 
    "Question No.", 
    "Main Question", 
    "Type", 
    "Options", 
    "Answer"
  ];
  
  // Add headers for follow-ups
  for (let i = 0; i < maxFollowUpsPerRow; i++) {
    headerRow.push(`Follow-up ${i + 1}`);
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
        `   Row ${rowIndex + 1}: ${row.allQuestions.length} questions (1 main + ${row.followUps.length} follow-ups)`
      );

      // Create row with all columns
      const excelRow: Array<string | number> = new Array(5 + maxFollowUpsPerRow * 4).fill("");

      // Section title (only on first row of section)
      excelRow[0] = firstRowInSection ? section.title : "";
      firstRowInSection = false;

      // Main question information (first set of columns)
      const mainQuestion = row.allQuestions[0];
      excelRow[1] = mainQuestion.questionNumber; // Question No.
      excelRow[2] = mainQuestion.label; // Main Question
      excelRow[3] = mainQuestion.type; // Type
      excelRow[4] = mainQuestion.options; // Options
      excelRow[5] = ""; // Answer for main question (empty)

      console.log(`     Main Question: ${mainQuestion.questionNumber} "${mainQuestion.label}"`);

      // Fill follow-up questions in subsequent columns
      for (let i = 0; i < row.followUps.length; i++) {
        const followUp = row.allQuestions[i + 1]; // +1 to skip main question
        const columnOffset = 6 + (i * 4); // Start after the main question columns
        
        excelRow[columnOffset] = followUp.label; // Follow-up text
        excelRow[columnOffset + 1] = followUp.type; // Follow-up type
        excelRow[columnOffset + 2] = followUp.options; // Follow-up options
        excelRow[columnOffset + 3] = ""; // Answer for follow-up (empty)

        console.log(`     Follow-up ${i + 1}: ${followUp.questionNumber} "${followUp.label}"`);
      }

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

  // Apply styling
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

    // Style Question No. cell (Column B)
    const questionNoCell = utils.encode_cell({ r: rowIndex, c: 1 });
    if (!worksheet[questionNoCell]) {
      worksheet[questionNoCell] = { t: "s", v: row[1] || "" };
    }
    worksheet[questionNoCell].s = {
      font: {
        bold: true,
        color: { rgb: "0F172A" },
        sz: 11,
      },
      fill: {
        fgColor: { rgb: "F0F9FF" },
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

    // Style Main Question cell (Column C)
    const mainQuestionCell = utils.encode_cell({ r: rowIndex, c: 2 });
    if (!worksheet[mainQuestionCell]) {
      worksheet[mainQuestionCell] = { t: "s", v: row[2] || "" };
    }
    worksheet[mainQuestionCell].s = {
      font: {
        bold: true,
        color: { rgb: "0F172A" },
        sz: 11,
      },
      fill: {
        fgColor: { rgb: "E0F2FE" },
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

    // Style Type cell for main question (Column D)
    const mainTypeCell = utils.encode_cell({ r: rowIndex, c: 3 });
    if (!worksheet[mainTypeCell]) {
      worksheet[mainTypeCell] = { t: "s", v: row[3] || "" };
    }
    worksheet[mainTypeCell].s = {
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
      },
      border: {
        top: { style: "thin", color: { rgb: "E2E8F0" } },
        left: { style: "thin", color: { rgb: "E2E8F0" } },
        bottom: { style: "thin", color: { rgb: "E2E8F0" } },
        right: { style: "thin", color: { rgb: "E2E8F0" } },
      },
    };

    // Style Options cell for main question (Column E)
    const mainOptionsCell = utils.encode_cell({ r: rowIndex, c: 4 });
    if (!worksheet[mainOptionsCell]) {
      worksheet[mainOptionsCell] = { t: "s", v: row[4] || "" };
    }
    worksheet[mainOptionsCell].s = {
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

    // Style Answer cell for main question (Column F)
    const mainAnswerCell = utils.encode_cell({ r: rowIndex, c: 5 });
    if (!worksheet[mainAnswerCell]) {
      worksheet[mainAnswerCell] = { t: "s", v: row[5] || "" };
    }
    worksheet[mainAnswerCell].s = {
      font: {
        italic: true,
        color: { rgb: "475569" },
        sz: 10,
      },
      fill: {
        fgColor: { rgb: "F8FAFC" },
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

    // Style follow-up columns
    for (let followUpIndex = 0; followUpIndex < maxFollowUpsPerRow; followUpIndex++) {
      const columnOffset = 6 + (followUpIndex * 4);
      
      // Follow-up question text
      const followUpTextCell = utils.encode_cell({ r: rowIndex, c: columnOffset });
      if (!worksheet[followUpTextCell]) {
        worksheet[followUpTextCell] = { t: "s", v: row[columnOffset] || "" };
      }
      worksheet[followUpTextCell].s = {
        font: {
          color: { rgb: "334155" },
          sz: 10,
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
          top: { style: "thin", color: { rgb: "E2E8F0" } },
          left: { style: "thin", color: { rgb: "E2E8F0" } },
          bottom: { style: "thin", color: { rgb: "E2E8F0" } },
          right: { style: "thin", color: { rgb: "E2E8F0" } },
        },
      };

      // Follow-up type
      const followUpTypeCell = utils.encode_cell({ r: rowIndex, c: columnOffset + 1 });
      if (!worksheet[followUpTypeCell]) {
        worksheet[followUpTypeCell] = { t: "s", v: row[columnOffset + 1] || "" };
      }
      worksheet[followUpTypeCell].s = {
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
        },
        border: {
          top: { style: "thin", color: { rgb: "E2E8F0" } },
          left: { style: "thin", color: { rgb: "E2E8F0" } },
          bottom: { style: "thin", color: { rgb: "E2E8F0" } },
          right: { style: "thin", color: { rgb: "E2E8F0" } },
        },
      };

      // Follow-up options
      const followUpOptionsCell = utils.encode_cell({ r: rowIndex, c: columnOffset + 2 });
      if (!worksheet[followUpOptionsCell]) {
        worksheet[followUpOptionsCell] = { t: "s", v: row[columnOffset + 2] || "" };
      }
      worksheet[followUpOptionsCell].s = {
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

      // Follow-up answer
      const followUpAnswerCell = utils.encode_cell({ r: rowIndex, c: columnOffset + 3 });
      if (!worksheet[followUpAnswerCell]) {
        worksheet[followUpAnswerCell] = { t: "s", v: row[columnOffset + 3] || "" };
      }
      worksheet[followUpAnswerCell].s = {
        font: {
          color: { rgb: "64748B" },
          sz: 10,
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
          top: { style: "thin", color: { rgb: "E2E8F0" } },
          left: { style: "thin", color: { rgb: "E2E8F0" } },
          bottom: { style: "thin", color: { rgb: "E2E8F0" } },
          right: { style: "thin", color: { rgb: "E2E8F0" } },
        },
      };
    }
  }

  // Set column widths
  const columnWidths = [
    { wch: 25 }, // Section
    { wch: 12 }, // Question No.
    { wch: 35 }, // Main Question
    { wch: 10 }, // Type
    { wch: 15 }, // Options
    { wch: 20 }, // Answer for main question
  ];

  // Add widths for follow-up columns
  for (let i = 0; i < maxFollowUpsPerRow; i++) {
    columnWidths.push({ wch: 30 }); // Follow-up question
    columnWidths.push({ wch: 10 }); // Type
    columnWidths.push({ wch: 15 }); // Options
    columnWidths.push({ wch: 20 }); // Answer
  }

  worksheet["!cols"] = columnWidths;

  // Create workbook and save
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Answer Template");

  const fileName = `${(form.title || "form")
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()}-answer-template.xlsx`;

  writeFile(workbook, fileName);

  console.log(`✅ Template saved as: ${fileName}`);
  console.log(`✅ Format: Section | Question No. | Main Question | Type | Options | Answer | Follow-ups...`);
}


// Also update parseAnswerWorkbook to handle the new format
export async function parseAnswerWorkbook(
  file: File,
  form: Question,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<ParsedAnswers> {
  console.log("🔄 Parsing answer workbook in WIDE format with follow-ups in columns...");

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

  console.log(`📋 Found ${rawData.length} rows in the file`);

  if (rawData.length < 2) {
    throw new Error("No answer data found in the file");
  }

  // Skip header row
  const answerRows = rawData.slice(1);
  const answers: ParsedAnswers = {};
  
  onProgress?.(0, answerRows.length, "Starting to parse answers...");

  // Build a map of question text to question ID
  const questionMap = new Map<string, string>();

  console.log("📋 Building question map from form structure...");

  // First, let's create the same grouping logic as in generateAnswerTemplate
  const isFollowUpQuestion = (question: FollowUpQuestion): boolean => {
    return !!(question.parentId || question.showWhen?.questionId);
  };

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

  // Build question map for all sections
  form.sections.forEach((section: Section, sectionIndex) => {
    const groups = groupQuestionsWithFollowUps(section.questions);
    
    groups.forEach((group, groupIndex) => {
      const mainQuestionNumber = `Q${groupIndex + 1}`;
      const mainLabel = group.main.text || "Untitled Question";
      
      // Map main question
      const mainKey = `${mainQuestionNumber}. ${mainLabel}`.toLowerCase().trim();
      questionMap.set(mainKey, group.main.id);
      console.log(`   📝 Mapped: "${mainKey}" → ${group.main.id}`);
      
      // Map follow-up questions
      group.followUps.forEach((followUp, followUpIndex) => {
        const followUpQuestionNumber = `${mainQuestionNumber}.${followUpIndex + 1}`;
        const followUpLabel = followUp.text || "Follow-up";
        const followUpKey = `${followUpQuestionNumber}. ${followUpLabel}`.toLowerCase().trim();
        questionMap.set(followUpKey, followUp.id);
        console.log(`   📝 Mapped follow-up: "${followUpKey}" → ${followUp.id}`);
      });
    });
  });

  console.log(`📋 Question map has ${questionMap.size} entries`);

  // Parse answers from Excel - WIDE FORMAT with follow-ups in columns
  console.log("📋 Parsing answers from Excel (WIDE format with follow-up columns)...");

  let parsedCount = 0;
  
  onProgress?.(1, answerRows.length, "Building question map...");
  
  const updateInterval = Math.max(1, Math.ceil(answerRows.length / 50));
  
  answerRows.forEach((row, rowIndex) => {
    if (rowIndex === 0 || rowIndex % updateInterval === 0 || rowIndex === answerRows.length - 1) {
      onProgress?.(rowIndex + 1, answerRows.length, `Parsing row ${rowIndex + 1}/${answerRows.length}...`);
    }
    if (!Array.isArray(row)) {
      console.log(`⚠️ Skipping row ${rowIndex + 1}: not an array`);
      return;
    }

    console.log(`\n📝 Processing row ${rowIndex + 2}:`);
    
    // Column A: Section (skipping, just for display)
    const sectionTitle = row[0]?.toString().trim();
    
    // Column B: Question No. for main question
    const mainQuestionNumber = row[1]?.toString().trim();
    
    // Column C: Main Question text
    const mainQuestionText = row[2]?.toString().trim();
    
    // Column D: Type (skipping)
    // Column E: Options (skipping)
    
    // Column F: Answer for main question
    const mainAnswerValue = row[5]?.toString().trim();
    
    if (mainQuestionNumber && mainQuestionText && mainAnswerValue) {
      const mainKey = `${mainQuestionNumber}. ${mainQuestionText}`.toLowerCase().trim();
      const mainQuestionId = questionMap.get(mainKey);
      
      if (mainQuestionId) {
        answers[mainQuestionId] = mainAnswerValue;
        parsedCount++;
        console.log(`   ✅ Main question: "${mainKey}" → ${mainQuestionId} = "${mainAnswerValue}"`);
      } else {
        console.log(`   ❌ Could not find main question: "${mainKey}"`);
      }
    }

    // Now parse follow-up questions from subsequent columns
    // Follow-ups are in groups of 4 columns: Follow-up text, Type, Options, Answer
    let followUpIndex = 0;
    let columnIndex = 6; // Start after main question columns (0-5)
    
    while (columnIndex + 3 < row.length) {
      const followUpText = row[columnIndex]?.toString().trim();
      const followUpType = row[columnIndex + 1]?.toString().trim();
      const followUpOptions = row[columnIndex + 2]?.toString().trim();
      const followUpAnswerValue = row[columnIndex + 3]?.toString().trim();
      
      // Only process if there's a follow-up question and an answer
      if (followUpText && followUpAnswerValue) {
        // Construct the follow-up question key
        // We need to find which main question this follow-up belongs to
        // The follow-up number would be like "Q1.1" if it's the first follow-up of Q1
        const followUpNumber = mainQuestionNumber ? `${mainQuestionNumber}.${followUpIndex + 1}` : `F${followUpIndex + 1}`;
        const followUpKey = `${followUpNumber}. ${followUpText}`.toLowerCase().trim();
        
        const followUpQuestionId = questionMap.get(followUpKey);
        
        if (followUpQuestionId) {
          answers[followUpQuestionId] = followUpAnswerValue;
          parsedCount++;
          console.log(`   ✅ Follow-up ${followUpIndex + 1}: "${followUpKey}" → ${followUpQuestionId} = "${followUpAnswerValue}"`);
        } else {
          // Try alternative matching
          console.log(`   ⚠️ Could not find exact match for follow-up: "${followUpKey}"`);
          
          // Try to find by just the text
          for (const [key, id] of questionMap.entries()) {
            if (key.includes(followUpText.toLowerCase().trim())) {
              answers[id] = followUpAnswerValue;
              parsedCount++;
              console.log(`   ✅ Found by text match: "${key}" → ${id} = "${followUpAnswerValue}"`);
              break;
            }
          }
        }
      }
      
      followUpIndex++;
      columnIndex += 4; // Move to next follow-up group
    }
  });

  console.log(`\n✅ Parsed ${parsedCount} answers out of ${answerRows.length} rows`);
  onProgress?.(answerRows.length, answerRows.length, "Parsing complete!");
  
  // Debug: Show all parsed answers
  if (parsedCount > 0) {
    console.log("\n📋 Parsed answers summary:");
    Object.entries(answers).forEach(([questionId, answer]) => {
      // Find the question text for display
      let questionText = "Unknown question";
      let questionType = "unknown";
      
      form.sections.forEach(section => {
        section.questions.forEach(q => {
          if (q.id === questionId) {
            questionText = q.text;
            questionType = q.type || "unknown";
          }
        });
      });
      
      console.log(`   ${questionId} (${questionType}): "${questionText}" = "${answer}"`);
    });
  } else {
    console.log("⚠️ No answers were parsed! Check the Excel format.");
    console.log("Expected format: Section | Question No. | Main Question | Type | Options | Answer | Follow-up 1 | Type | Options | Answer | ...");
  }

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