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

/*export function generateAnswerTemplate(form: Question) {
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

    console.log(`\n   📁 Section ${sectionIndex + 1}: "${section.title}"`);
    
    // IMPORTANT: Check if section.questions exists
    if (!section.questions || !Array.isArray(section.questions)) {
      console.warn(`   ⚠️ Section has no questions array, skipping...`);
      return;
    }
    
    console.log(
      `      Total questions in section.questions: ${section.questions.length}`
    );

    // DEBUG: Log all questions in this section
    console.log(`      🔍 All questions in section:`);
    section.questions.forEach((q, idx) => {
      if (q) {
        console.log(`        ${idx + 1}. ID: ${q.id}, Text: "${q.text?.substring(0, 50)}..."`);
        console.log(`           Parent ID: ${q.parentId || 'none'}, ShowWhen: ${q.showWhen?.questionId || 'none'}`);
        console.log(`           Has nested follow-ups: ${q.followUpQuestions?.length || 0}`);
      }
    });

    // IMPORTANT FIX: Find main questions in a smarter way
    const mainQuestions: FollowUpQuestion[] = [];
    
    // Method 1: First check for questions without parentId or showWhen
    const questionsWithoutParent = section.questions.filter(
      (q) => q && !q.parentId && !q.showWhen?.questionId
    );
    
    console.log(`      Found ${questionsWithoutParent.length} questions without parent/showWhen`);
    
    // Method 2: Check for questions that are NOT referenced as follow-ups by any other question
    const allQuestionIds = new Set(section.questions.map(q => q?.id).filter(Boolean));
    const referencedAsFollowUp = new Set<string>();
    
    section.questions.forEach(q => {
      if (q?.showWhen?.questionId) {
        referencedAsFollowUp.add(q.showWhen.questionId);
      }
      if (q?.parentId) {
        referencedAsFollowUp.add(q.parentId);
      }
      // Also check nested follow-ups
      if (q?.followUpQuestions) {
        q.followUpQuestions.forEach(fq => {
          if (fq?.id) {
            referencedAsFollowUp.add(q.id); // Parent is referenced
          }
        });
      }
    });
    
    // Questions that are NOT referenced as follow-ups are likely main questions
    const notReferencedQuestions = section.questions.filter(
      q => q && !referencedAsFollowUp.has(q.id)
    );
    
    console.log(`      Found ${notReferencedQuestions.length} questions not referenced as follow-ups`);
    
    // COMBINE both methods to get main questions
    const combinedMainQuestions = [...new Set([
      ...questionsWithoutParent,
      ...notReferencedQuestions
    ].filter(Boolean))];
    
    // Remove duplicates by ID
    const uniqueMainQuestions = combinedMainQuestions.filter((q, index, self) =>
      index === self.findIndex((t) => t.id === q.id)
    );
    
    console.log(`      Combined main questions found: ${uniqueMainQuestions.length}`);
    
    // If no main questions found, use first question as main
    if (uniqueMainQuestions.length === 0 && section.questions.length > 0) {
      console.warn(`      ⚠️ No main questions identified, using first question as main`);
      uniqueMainQuestions.push(section.questions[0]);
    }

    const rowsForSection: PreparedRow[] = [];

    // Process each main question
    uniqueMainQuestions.forEach((mainQuestion, mainIndex) => {
      if (!mainQuestion) return;

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

      console.log(`\n     🔷 Main Question ${mainQuestionNumber}: "${mainLabel.substring(0, 50)}..."`);

      // FIXED: Collect ALL follow-ups including from imported forms
      const processedQuestionIds = new Set<string>();
      processedQuestionIds.add(mainQuestion.id);
      
      let fuCounter = 0;
      
      // Function to find ALL follow-ups of a question
      const findAllFollowUps = (parentQuestionId: string): FollowUpQuestion[] => {
        const followUps: FollowUpQuestion[] = [];
        
        // 1. Check for flat follow-ups (showWhen or parentId)
        const flatFollowUps = section.questions.filter(q => 
          q && (q.showWhen?.questionId === parentQuestionId || q.parentId === parentQuestionId)
        );
        
        // 2. Check for nested follow-ups in the parent question itself
        const parentQuestion = section.questions.find(q => q.id === parentQuestionId);
        const nestedFollowUps = parentQuestion?.followUpQuestions || [];
        
        // Combine and remove duplicates
        const allFoundFollowUps = [...flatFollowUps, ...nestedFollowUps];
        const uniqueFollowUps = allFoundFollowUps.filter((q, index, self) =>
          index === self.findIndex((t) => t?.id === q?.id)
        );
        
        return uniqueFollowUps.filter(Boolean);
      };
      
      // Recursive function to build follow-up tree
      const buildFollowUpTree = (
        parentQuestionId: string,
        parentNumber: string, // e.g., "Q1" or "FU1" or "FU1.1"
        depth: number,
        isFirstLevel: boolean = true
      ) => {
        const followUps = findAllFollowUps(parentQuestionId);
        
        // Filter out already processed questions
        const newFollowUps = followUps.filter(fq => !processedQuestionIds.has(fq.id));
        
        if (newFollowUps.length === 0) return;
        
        console.log(`       Depth ${depth}: Found ${newFollowUps.length} follow-ups for ${parentNumber}`);
        
        // Sort by order if available
        newFollowUps.sort((a, b) => (a.order || 0) - (b.order || 0));
        
        // Process each follow-up
        newFollowUps.forEach((followUp, index) => {
          if (processedQuestionIds.has(followUp.id)) return;
          
          processedQuestionIds.add(followUp.id);
          
          // Generate FU numbering
          let followUpQuestionNumber: string;
          
          if (isFirstLevel) {
            // First-level follow-ups: FU1, FU2, FU3, etc.
            fuCounter++;
            followUpQuestionNumber = `FU${fuCounter}`;
          } else if (parentNumber.startsWith('FU')) {
            // Nested follow-ups: FU1.1, FU1.2, FU1.1.1, etc.
            const parts = parentNumber.split('.');
            parts.push((index + 1).toString());
            followUpQuestionNumber = parts.join('.');
          } else {
            // Fallback
            fuCounter++;
            followUpQuestionNumber = `FU${fuCounter}`;
          }
          
          const followUpLabel = followUp.text || "Follow-up Question";
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

          console.log(`         ➕ ${followUpQuestionNumber}: "${followUpLabel.substring(0, 40)}..."`);

          // Recursively process this follow-up's own follow-ups
          buildFollowUpTree(followUp.id, followUpQuestionNumber, depth + 1, false);
        });
      };
      
      // Start building follow-up tree from main question
      buildFollowUpTree(mainQuestion.id, mainQuestionNumber, 1, true);
      
      // DEBUG: Show what was collected
      console.log(`     📊 Collected ${allQuestions.length} questions for ${mainQuestionNumber}:`);
      allQuestions.forEach((q, idx) => {
        const prefix = idx === 0 ? "Main" : `FU ${idx}`;
        console.log(`       ${prefix}. ${q.questionNumber}: "${q.label.substring(0, 40)}..." (Depth: ${q.depth})`);
      });

      rowsForSection.push({
        mainQuestionNumber,
        mainQuestion: mainQuestion,
        allQuestions,
      });
    });

    console.log(`      Total rows in section: ${rowsForSection.length}`);
    preparedSections.push({ title: sectionTitle, rows: rowsForSection });
  });

  // Calculate MAXIMUM number of follow-ups across ALL rows
  let maxFollowUpsPerRow = 0;
  preparedSections.forEach((section) => {
    section.rows.forEach((row) => {
      const totalFollowUps = row.allQuestions.length - 1;
      console.log(`   ${row.mainQuestionNumber}: ${totalFollowUps} follow-ups`);
      
      if (totalFollowUps > maxFollowUpsPerRow) {
        maxFollowUpsPerRow = totalFollowUps;
      }
    });
  });

  // FIX: Ensure we have enough columns for all follow-ups
  if (maxFollowUpsPerRow < 1) maxFollowUpsPerRow = 1;
  if (maxFollowUpsPerRow > 200) {
    console.warn(`⚠️  Very high follow-up count: ${maxFollowUpsPerRow}. Limiting to 200.`);
    maxFollowUpsPerRow = 200;
  }
  
  console.log(`\n📊 FINAL CALCULATION: Max ${maxFollowUpsPerRow} follow-ups per row`);

  // Build Excel data array with new structure
  const data: Array<Array<string | number>> = [];

  // HEADER ROW - SIMPLIFIED
  const headerRow: Array<string | number> = [
    "Section",
    "Question No.",
    "Question",
    "Type",
    "Options",
    "Trigger Option",
    "Answer",
  ];

  // Add headers for follow-ups
  for (let i = 0; i < maxFollowUpsPerRow; i++) {
    headerRow.push(`FU No.`);
    headerRow.push(`Follow-up Question`);
    headerRow.push(`Type`);
    headerRow.push(`Options`);
    headerRow.push(`Trigger`);
    headerRow.push(`Answer`);
  }

  data.push(headerRow);

  // BODY ROWS
  preparedSections.forEach((section) => {
    console.log(`\n📋 Processing section: "${section.title}"`);
    let firstRowInSection = true;

    section.rows.forEach((row, rowIndex) => {
      const totalFollowUps = row.allQuestions.length - 1;
      console.log(`   Row ${rowIndex + 1}: ${row.allQuestions.length} questions (1 main + ${totalFollowUps} follow-ups)`);

      // Create row with exact number of columns needed
      const excelRow: Array<string | number> = new Array(
        7 + maxFollowUpsPerRow * 6
      ).fill("");

      excelRow[0] = firstRowInSection ? section.title : "";
      firstRowInSection = false;

      // Main question data
      const mainQuestion = row.allQuestions[0];
      excelRow[1] = mainQuestion.questionNumber;
      excelRow[2] = mainQuestion.label;
      excelRow[3] = mainQuestion.type;
      excelRow[4] = mainQuestion.options;
      excelRow[5] = ""; // Trigger Option (empty for main question)
      excelRow[6] = ""; // Answer

      // Fill follow-up columns
      for (let i = 0; i < totalFollowUps; i++) {
        if (i >= maxFollowUpsPerRow) {
          console.warn(`⚠️  WARNING: Row has ${totalFollowUps} follow-ups, but only ${maxFollowUpsPerRow} will fit in Excel`);
          break;
        }
        
        const followUp = row.allQuestions[i + 1];
        const columnOffset = 7 + i * 6;

        excelRow[columnOffset] = followUp.questionNumber;
        
        // Add indentation
        const indent = "  ".repeat(followUp.depth - 1);
        excelRow[columnOffset + 1] = `${indent}${followUp.label}`;
        excelRow[columnOffset + 2] = followUp.type;
        excelRow[columnOffset + 3] = followUp.options;
        
        // Get trigger value from the follow-up question
        const triggerValue = followUp.question?.showWhen?.value || 
                            (followUp.question?.parentId ? "Yes" : "Yes");
        excelRow[columnOffset + 4] = triggerValue;
        
        excelRow[columnOffset + 5] = ""; // Answer

        console.log(`     Added ${followUp.questionNumber} at column ${columnOffset}`);
      }

      data.push(excelRow);
    });
  });

  console.log(`\n📋 Generated ${data.length - 1} data rows in Excel`);

  const worksheet = utils.aoa_to_sheet(data);

  // Apply styling to header row
  for (let colIndex = 0; colIndex < headerRow.length; colIndex++) {
    const cellAddress = utils.encode_cell({ r: 0, c: colIndex });
    if (!worksheet[cellAddress]) {
      worksheet[cellAddress] = { t: "s", v: headerRow[colIndex] || "" };
    }
    worksheet[cellAddress].s = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
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
        font: { bold: true, color: { rgb: "1E40AF" }, sz: 11 },
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
    for (let colIndex = 1; colIndex <= 5; colIndex++) { // Up to Trigger Option
      const cellAddress = utils.encode_cell({ r: rowIndex, c: colIndex });
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = { t: "s", v: row[colIndex] };
      }
      worksheet[cellAddress].s = {
        font: { bold: true, color: { rgb: "000000" }, sz: 10 },
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
      if (columnIndex >= row.length) return;
      
      const cellAddress = utils.encode_cell({ r: rowIndex, c: columnIndex });
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = { t: "s", v: row[columnIndex] || "" };
      }
      worksheet[cellAddress].s = {
        font: { color: { rgb: "000000" }, sz: 10 },
        fill: { fgColor: { rgb: "FEF3C7" } }, // Light yellow for answer cells
        alignment: { horizontal: "left", vertical: "center", wrapText: true },
        border: {
          top: { style: "medium", color: { rgb: "F59E0B" } },
          left: { style: "medium", color: { rgb: "F59E0B" } },
          bottom: { style: "medium", color: { rgb: "F59E0B" } },
          right: { style: "medium", color: { rgb: "F59E0B" } },
        },
      };
    };

    // Style main answer cell
    styleAnswerCell(6);

    // Style follow-up cells
    for (
      let followUpIndex = 0;
      followUpIndex < maxFollowUpsPerRow;
      followUpIndex++
    ) {
      const baseColumnOffset = 7 + followUpIndex * 6;

      if (row[baseColumnOffset]) {
        // Only style if there's data
        
        // Style FU number cell
        const fuNoCell = utils.encode_cell({ r: rowIndex, c: baseColumnOffset });
        if (!worksheet[fuNoCell]) {
          worksheet[fuNoCell] = { t: "s", v: row[baseColumnOffset] || "" };
        }

        const fuNoText = row[baseColumnOffset]?.toString() || "";
        const isNested = fuNoText.split(".").length > 1; // Check if it's like FU1.1

        worksheet[fuNoCell].s = {
          font: {
            color: { rgb: isNested ? "6B7280" : "FFFFFF" }, // Red for FU, gray for nested
            sz: isNested ? 9 : 10,
          },
          fill: { fgColor: { rgb: isNested ? "F9FAFB" : "2B2C5A" } },
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
        const indentLevel = (questionText.match(/^(\s+)/)?.[0]?.length || 0) / 2;

        worksheet[questionCell].s = {
          font: {
            color: { rgb: indentLevel > 0 ? "6B7280" : "374151" },
            sz: indentLevel > 0 ? 9 : 10,
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

        // Style trigger cell
        const triggerCell = utils.encode_cell({
          r: rowIndex,
          c: baseColumnOffset + 4,
        });
        if (!worksheet[triggerCell]) {
          worksheet[triggerCell] = {
            t: "s",
            v: row[baseColumnOffset + 4] || "",
          };
        }
        worksheet[triggerCell].s = {
          font: {
            color: { rgb: "DC2626" },
            sz: 9,
            italic: true,
          },
          fill: { fgColor: { rgb: "FEE2E2" } },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border: {
            top: { style: "thin", color: { rgb: "E5E7EB" } },
            left: { style: "thin", color: { rgb: "E5E7EB" } },
            bottom: { style: "thin", color: { rgb: "E5E7EB" } },
            right: { style: "thin", color: { rgb: "E5E7EB" } },
          },
        };

        // Style follow-up answer cell
        styleAnswerCell(baseColumnOffset + 5);
      }
    }
  }

  // Set column widths
  const columnWidths = [
    { wch: 25 }, // Section
    { wch: 12 }, // Question No. (main)
    { wch: 35 }, // Question (main)
    { wch: 10 }, // Type (main)
    { wch: 20 }, // Options (main)
    { wch: 12 }, // Trigger Option (main)
    { wch: 30 }, // Answer (main)
  ];

  for (let i = 0; i < maxFollowUpsPerRow; i++) {
    columnWidths.push({ wch: 12 }); // FU No.
    columnWidths.push({ wch: 30 }); // Follow-up Question
    columnWidths.push({ wch: 10 }); // Type
    columnWidths.push({ wch: 20 }); // Options
    columnWidths.push({ wch: 8 }); // Trigger
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
  console.log(`📊 Total rows in template: ${data.length - 1}`);
  console.log(`🎯 Numbering format: Q1, FU1, FU2, FU1.1, FU1.2, FU1.1.1, etc.`);
  console.log(`📈 Maximum follow-up columns: ${maxFollowUpsPerRow}`);
  console.log(`🔢 Trigger options shown for follow-ups`);
  console.log(`📋 NO Question ID columns (simplified template)`);

  return fileName;
}
*/

export function generateAnswerTemplate(form: Question) {
  console.log("🔄 Generating answer template...");

  // DEEP DEBUG: Log the entire form structure
  console.log("🔍 DEEP DEBUG: Full form structure");
  console.log("====================================");
  
  form.sections?.forEach((section: Section, sectionIndex: number) => {
    console.log(`\n📁 Section ${sectionIndex + 1}: "${section.title}"`);
    console.log(`   Section ID: ${section.id}`);
    console.log(`   Total questions: ${section.questions?.length || 0}`);
    
    if (!section.questions || !Array.isArray(section.questions)) {
      console.log("   ⚠️ No questions array in this section!");
      return;
    }
    
    // Log each question in detail
    section.questions.forEach((question: FollowUpQuestion, qIndex: number) => {
      console.log(`\n   Q${qIndex + 1}:`);
      console.log(`     ID: ${question.id}`);
      console.log(`     Text: "${question.text?.substring(0, 50)}..."`);
      console.log(`     Type: ${question.type}`);
      console.log(`     Has followUpQuestions array: ${Array.isArray(question.followUpQuestions)}`);
      console.log(`     followUpQuestions count: ${question.followUpQuestions?.length || 0}`);
      console.log(`     parentId: ${question.parentId || 'none'}`);
      console.log(`     showWhen: ${question.showWhen ? JSON.stringify(question.showWhen) : 'none'}`);
      console.log(`     order: ${question.order || 'none'}`);
      
      // Log nested follow-ups if they exist
      if (question.followUpQuestions && question.followUpQuestions.length > 0) {
        console.log(`     Nested follow-ups:`);
        question.followUpQuestions.forEach((fq, fqIndex) => {
          console.log(`       FU${fqIndex + 1}: ID=${fq.id}, Text="${fq.text?.substring(0, 30)}..."`);
          console.log(`           showWhen: ${fq.showWhen ? JSON.stringify(fq.showWhen) : 'none'}`);
        });
      }
    });
  });
  console.log("====================================\n");

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
      source: string; // For debugging: 'main', 'flat', 'nested'
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
    
    console.log(
      `      Total raw questions in section: ${section.questions.length}`
    );

    // FLATTEN ALL questions (including nested ones)
    // FIXED: Better flattening with debug info
const flattenedQuestions: FollowUpQuestion[] = [];
const processedIds = new Set<string>();

const flattenQuestion = (q: FollowUpQuestion, parentId?: string, level: number = 0) => {
  if (!q || !q.id || processedIds.has(q.id)) return;
  
  processedIds.add(q.id);
  
  // Create a copy with parent info
  const questionCopy = {
    ...q,
    parentId: parentId || q.parentId,
    _level: level // For debugging
  };
  
  flattenedQuestions.push(questionCopy);
  
  console.log(`        Flattened L${level}: ${q.id} - "${q.text?.substring(0, 30)}..."`);
  
  // Recursively flatten nested follow-ups
  if (q.followUpQuestions && q.followUpQuestions.length > 0) {
    console.log(`          Has ${q.followUpQuestions.length} nested follow-ups`);
    q.followUpQuestions.forEach((fq, fqIndex) => {
      flattenQuestion(fq, q.id, level + 1);
    });
  }
};

// Flatten all questions
console.log(`      🔍 Flattening all questions:`);
section.questions.forEach((q, idx) => {
  console.log(`        Root Q${idx + 1}: ${q.id} - "${q.text?.substring(0, 30)}..."`);
  flattenQuestion(q, undefined, 0);
});

console.log(`      Total flattened questions: ${flattenedQuestions.length}`);
    
    // Create a map of all questions by ID for easy lookup
    const questionsById = new Map<string, FollowUpQuestion>();
    flattenedQuestions.forEach(q => {
      if (q.id) {
        questionsById.set(q.id, q);
      }
    });
    
    // DEBUG: Show all flattened questions
    console.log(`      🔍 Flattened questions:`);
    flattenedQuestions.forEach((q, idx) => {
      const parentInfo = q.parentId ? `(Parent: ${q.parentId})` : 
                        q.showWhen?.questionId ? `(ShowWhen: ${q.showWhen.questionId})` : '';
      console.log(`        ${idx + 1}. ${q.id}: "${q.text?.substring(0, 30)}..." ${parentInfo}`);
    });

    // FIND MAIN QUESTIONS
    // Strategy: Questions that are NOT children of any other question
    const childQuestionIds = new Set<string>();
    
    flattenedQuestions.forEach(q => {
      if (q.parentId) {
        childQuestionIds.add(q.id);
      }
      if (q.showWhen?.questionId) {
        childQuestionIds.add(q.id);
      }
    });
    
    // Main questions are those NOT in childQuestionIds
    const mainQuestions = flattenedQuestions.filter(q => !childQuestionIds.has(q.id));
    
    console.log(`\n      🔍 Main questions identified: ${mainQuestions.length}`);
    mainQuestions.forEach((q, idx) => {
      console.log(`        Main ${idx + 1}: ${q.id} - "${q.text?.substring(0, 40)}..."`);
    });
    
    // If no main questions found, use the first question
    if (mainQuestions.length === 0 && flattenedQuestions.length > 0) {
      console.warn(`      ⚠️ No main questions identified, using first question as main`);
      mainQuestions.push(flattenedQuestions[0]);
    }

    const rowsForSection: PreparedRow[] = [];

    // Process each main question
    // Process each main question
// Process each main question
// Process each main question
mainQuestions.forEach((mainQuestion, mainIndex) => {
  if (!mainQuestion) return;

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
    source: string;
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
    source: 'main'
  });

  console.log(`\n     🔷 Processing Main Question ${mainQuestionNumber}: "${mainLabel.substring(0, 50)}..."`);

  // Track ALL processed question IDs to avoid duplicates
  const processedQuestionIds = new Set<string>();
  processedQuestionIds.add(mainQuestion.id);
  
  // Map to store question numbers for quick lookup
  const questionNumberMap = new Map<string, string>();
  questionNumberMap.set(mainQuestion.id, mainQuestionNumber);
  
  // Global counters for each level
  const levelCounters: Map<number, number> = new Map();
  
  // Recursive function to build proper hierarchy
  const buildHierarchy = (
    parentQuestion: FollowUpQuestion,
    parentQuestionNumber: string,
    currentDepth: number,
    isFirstLevel: boolean = true
  ) => {
    if (!parentQuestion) return;
    
    // Get or initialize counter for this depth
    if (!levelCounters.has(currentDepth)) {
      levelCounters.set(currentDepth, 0);
    }
    
    // Find ALL children of this parent
    const children: FollowUpQuestion[] = [];
    const childIds = new Set<string>();
    
    // Method 1: Find by showWhen.questionId
    flattenedQuestions.forEach(q => {
      if (q.showWhen?.questionId === parentQuestion.id && 
          !processedQuestionIds.has(q.id) && 
          !childIds.has(q.id)) {
        
        // For option-based follow-ups, check trigger value matches parent's selection
        if (parentQuestion.options && q.showWhen?.value) {
          // Only include if the parent has this option
          if (parentQuestion.options.includes(q.showWhen.value)) {
            children.push(q);
            childIds.add(q.id);
          }
        } else {
          children.push(q);
          childIds.add(q.id);
        }
      }
    });
    
    // Method 2: Find by parentId
    flattenedQuestions.forEach(q => {
      if (q.parentId === parentQuestion.id && 
          !processedQuestionIds.has(q.id) && 
          !childIds.has(q.id)) {
        children.push(q);
        childIds.add(q.id);
      }
    });
    
    // Method 3: Check nested followUpQuestions array
    if (parentQuestion.followUpQuestions) {
      parentQuestion.followUpQuestions.forEach(fq => {
        if (!processedQuestionIds.has(fq.id) && !childIds.has(fq.id)) {
          children.push(fq);
          childIds.add(fq.id);
        }
      });
    }
    
    if (children.length === 0) return;
    
    console.log(`       Depth ${currentDepth}: Found ${children.length} children for ${parentQuestionNumber}`);
    
    // Sort children
    children.sort((a, b) => {
      // First try by order
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      
      // For option-based follow-ups, maintain option order
      if (parentQuestion.options && a.showWhen?.value && b.showWhen?.value) {
        const indexA = parentQuestion.options.indexOf(a.showWhen.value);
        const indexB = parentQuestion.options.indexOf(b.showWhen.value);
        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }
      }
      
      return 0;
    });
    
    // Process children
    children.forEach((child, childIndex) => {
      if (processedQuestionIds.has(child.id)) {
        console.warn(`       ⚠️ Skipping duplicate: ${child.id}`);
        return;
      }
      
      processedQuestionIds.add(child.id);
      
      // Generate question number
      let questionNumber: string;
      
      if (isFirstLevel) {
        // First-level follow-ups: FU1, FU2, FU3, etc.
        const counter = (levelCounters.get(currentDepth) || 0) + 1;
        levelCounters.set(currentDepth, counter);
        questionNumber = `FU${counter}`;
      } else {
        // Nested follow-ups: FU1.1, FU1.2, FU1.1.1, etc.
        const counter = (levelCounters.get(currentDepth) || 0) + 1;
        levelCounters.set(currentDepth, counter);
        questionNumber = `${parentQuestionNumber}.${counter}`;
      }
      
      questionNumberMap.set(child.id, questionNumber);
      
      allQuestions.push({
        label: child.text || "Follow-up Question",
        questionNumber: questionNumber,
        question: child,
        type: child.type || "text",
        options: child.options ? child.options.join("|") : "",
        id: child.id,
        depth: currentDepth,
        source: child.id.includes('_synth_') ? 'synthetic' : 'existing'
      });
      
      console.log(`         ${questionNumber}: "${child.text?.substring(0, 40)}..." (trigger: ${child.showWhen?.value || 'none'})`);
      
      // Recursively process this child's children
      buildHierarchy(child, questionNumber, currentDepth + 1, false);
    });
  };
  
  // SPECIAL CASE: If main question has options but no follow-ups found, create synthetic ones
  if (mainQuestion.options && mainQuestion.options.length > 0) {
    // First, try to build normal hierarchy
    buildHierarchy(mainQuestion, mainQuestionNumber, 1, true);
    
    // Check if we got follow-ups for all options
    const optionsWithFollowUps = new Set<string>();
    
    allQuestions.slice(1).forEach(q => {
      if (q.question.showWhen?.value) {
        optionsWithFollowUps.add(q.question.showWhen.value);
      }
    });
    
    // Create synthetic follow-ups for missing options
    if (optionsWithFollowUps.size < mainQuestion.options.length) {
      console.log(`     Creating synthetic follow-ups for missing options...`);
      
      let syntheticCounter = allQuestions.length - 1; // Start after existing follow-ups
      
      mainQuestion.options.forEach((option, optionIndex) => {
        if (!optionsWithFollowUps.has(option)) {
          syntheticCounter++;
          const questionNumber = `FU${syntheticCounter}`;
          const cleanOption = option.replace(/\r\n/g, ' ').trim();
          
          const syntheticFollowUp: FollowUpQuestion = {
            id: `${mainQuestion.id}_synth_${optionIndex}`,
            text: `${cleanOption} details`,
            type: "text",
            showWhen: {
              questionId: mainQuestion.id,
              value: option
            }
          };
          
          allQuestions.push({
            label: syntheticFollowUp.text || `${cleanOption} details`,
            questionNumber: questionNumber,
            question: syntheticFollowUp,
            type: syntheticFollowUp.type || "text",
            options: "",
            id: syntheticFollowUp.id,
            depth: 1,
            source: 'synthetic'
          });
          
          console.log(`       ${questionNumber}: Synthetic for "${cleanOption}"`);
        }
      });
    }
  } else {
    // Normal case: Build hierarchy
    buildHierarchy(mainQuestion, mainQuestionNumber, 1, true);
  }
  
  // DEBUG: Show final structure
  console.log(`\n     📊 FINAL STRUCTURE for ${mainQuestionNumber}:`);
  console.log(`       Total questions: ${allQuestions.length}`);
  
  allQuestions.forEach((q, idx) => {
    const indent = "  ".repeat(q.depth);
    console.log(`       ${indent}${q.questionNumber}: "${q.label.substring(0, 40)}..."`);
  });
  
  // Verify no duplicates
  const uniqueIds = new Set(allQuestions.map(q => q.id));
  if (uniqueIds.size !== allQuestions.length) {
    console.error(`       ❌ DUPLICATES FOUND: ${allQuestions.length - uniqueIds.size} duplicates`);
    
    const idCounts: Map<string, number> = new Map();
    allQuestions.forEach(q => {
      idCounts.set(q.id, (idCounts.get(q.id) || 0) + 1);
    });
    
    idCounts.forEach((count, id) => {
      if (count > 1) {
        console.error(`         ID ${id}: appears ${count} times`);
      }
    });
  }

  rowsForSection.push({
    mainQuestionNumber,
    mainQuestion: mainQuestion,
    allQuestions,
  });
});


    console.log(`      Total rows in section: ${rowsForSection.length}`);
    preparedSections.push({ title: sectionTitle, rows: rowsForSection });
  });

  // Calculate MAXIMUM number of follow-ups across ALL rows
  let maxFollowUpsPerRow = 0;
  preparedSections.forEach((section) => {
    section.rows.forEach((row) => {
      const totalFollowUps = row.allQuestions.length - 1;
      console.log(`   ${row.mainQuestionNumber}: ${totalFollowUps} follow-ups`);
      
      if (totalFollowUps > maxFollowUpsPerRow) {
        maxFollowUpsPerRow = totalFollowUps;
      }
    });
  });

  // Ensure reasonable limits
  if (maxFollowUpsPerRow < 1) maxFollowUpsPerRow = 1;
  if (maxFollowUpsPerRow > 200) {
    console.warn(`⚠️  Very high follow-up count: ${maxFollowUpsPerRow}. Limiting to 200.`);
    maxFollowUpsPerRow = 200;
  }
  
  console.log(`\n📊 FINAL: Max ${maxFollowUpsPerRow} follow-ups per row`);

  // Build Excel data
  const data: Array<Array<string | number>> = [];

  // HEADER ROW
  const headerRow: Array<string | number> = [
    "Section",
    "Question No.",
    "Question",
    "Type",
    "Options",
    "Trigger Option",
    "Answer",
  ];

  for (let i = 0; i < maxFollowUpsPerRow; i++) {
    headerRow.push(`FU No.`);
    headerRow.push(`Follow-up Question`);
    headerRow.push(`Type`);
    headerRow.push(`Options`);
    headerRow.push(`Trigger`);
    headerRow.push(`Answer`);
  }

  data.push(headerRow);

  // BODY ROWS
  preparedSections.forEach((section) => {
    console.log(`\n📋 Processing section: "${section.title}"`);
    let firstRowInSection = true;

    section.rows.forEach((row, rowIndex) => {
      const totalFollowUps = row.allQuestions.length - 1;
      console.log(`   Row ${rowIndex + 1}: ${row.allQuestions.length} questions (1 main + ${totalFollowUps} follow-ups)`);

      const excelRow: Array<string | number> = new Array(
        7 + maxFollowUpsPerRow * 6
      ).fill("");

      excelRow[0] = firstRowInSection ? section.title : "";
      firstRowInSection = false;

      // Main question
      const mainQuestion = row.allQuestions[0];
      excelRow[1] = mainQuestion.questionNumber;
      excelRow[2] = mainQuestion.label;
      excelRow[3] = mainQuestion.type;
      excelRow[4] = mainQuestion.options;
      excelRow[5] = "";
      excelRow[6] = "";

      // Follow-ups
      for (let i = 0; i < totalFollowUps; i++) {
        if (i >= maxFollowUpsPerRow) {
          console.warn(`⚠️  Row has ${totalFollowUps} follow-ups, but only ${maxFollowUpsPerRow} will fit`);
          break;
        }
        
        const followUp = row.allQuestions[i + 1];
        const columnOffset = 7 + i * 6;

        excelRow[columnOffset] = followUp.questionNumber;
        
        // Add indentation
        const indent = "  ".repeat(followUp.depth - 1);
        excelRow[columnOffset + 1] = `${indent}${followUp.label}`;
        excelRow[columnOffset + 2] = followUp.type;
        excelRow[columnOffset + 3] = followUp.options;
        
        // Get trigger value
        const triggerValue = followUp.question?.showWhen?.value || 
                           (followUp.question?.parentId ? "Yes" : "Yes");
        excelRow[columnOffset + 4] = triggerValue;
        
        excelRow[columnOffset + 5] = "";

        console.log(`     Added ${followUp.questionNumber} (source: ${followUp.source})`);
      }

      data.push(excelRow);
    });
  });

  console.log(`\n📋 Generated ${data.length - 1} data rows`);

  // Create worksheet
  const worksheet = utils.aoa_to_sheet(data);

  // Apply styling (same as before)
  for (let colIndex = 0; colIndex < headerRow.length; colIndex++) {
    const cellAddress = utils.encode_cell({ r: 0, c: colIndex });
    if (!worksheet[cellAddress]) {
      worksheet[cellAddress] = { t: "s", v: headerRow[colIndex] || "" };
    }
    worksheet[cellAddress].s = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
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

  // Style data rows (same as before, but simplified)
  for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];

    // Section header
    if (row[0]) {
      const cellAddress = utils.encode_cell({ r: rowIndex, c: 0 });
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = { t: "s", v: row[0] };
      }
      worksheet[cellAddress].s = {
        font: { bold: true, color: { rgb: "1E40AF" }, sz: 11 },
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

    // Main question cells
    for (let colIndex = 1; colIndex <= 5; colIndex++) {
      const cellAddress = utils.encode_cell({ r: rowIndex, c: colIndex });
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = { t: "s", v: row[colIndex] };
      }
      worksheet[cellAddress].s = {
        font: { bold: true, color: { rgb: "000000" }, sz: 10 },
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

    // Style Answer cells
    const styleAnswerCell = (columnIndex: number) => {
      if (columnIndex >= row.length) return;
      
      const cellAddress = utils.encode_cell({ r: rowIndex, c: columnIndex });
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = { t: "s", v: row[columnIndex] || "" };
      }
      worksheet[cellAddress].s = {
        font: { color: { rgb: "000000" }, sz: 10 },
        fill: { fgColor: { rgb: "FEF3C7" } },
        alignment: { horizontal: "left", vertical: "center", wrapText: true },
        border: {
          top: { style: "medium", color: { rgb: "F59E0B" } },
          left: { style: "medium", color: { rgb: "F59E0B" } },
          bottom: { style: "medium", color: { rgb: "F59E0B" } },
          right: { style: "medium", color: { rgb: "F59E0B" } },
        },
      };
    };

    // Style main answer cell
    styleAnswerCell(6);

    // Style follow-up cells
    for (let followUpIndex = 0; followUpIndex < maxFollowUpsPerRow; followUpIndex++) {
      const baseColumnOffset = 7 + followUpIndex * 6;

      if (row[baseColumnOffset]) {
        // Style FU number
        const fuNoCell = utils.encode_cell({ r: rowIndex, c: baseColumnOffset });
        if (!worksheet[fuNoCell]) {
          worksheet[fuNoCell] = { t: "s", v: row[baseColumnOffset] || "" };
        }

        const fuNoText = row[baseColumnOffset]?.toString() || "";
        const isNested = fuNoText.split(".").length > 1;

        worksheet[fuNoCell].s = {
          font: {
            color: { rgb: isNested ? "6B7280" : "DC2626" },
            sz: isNested ? 9 : 10,
          },
          fill: { fgColor: { rgb: isNested ? "F9FAFB" : "FEE2E2" } },
          alignment: { horizontal: "left", vertical: "center", wrapText: true },
          border: {
            top: { style: "thin", color: { rgb: "E5E7EB" } },
            left: { style: "thin", color: { rgb: "E5E7EB" } },
            bottom: { style: "thin", color: { rgb: "E5E7EB" } },
            right: { style: "thin", color: { rgb: "E5E7EB" } },
          },
        };

        // Style trigger cell
        const triggerCell = utils.encode_cell({ r: rowIndex, c: baseColumnOffset + 4 });
        if (!worksheet[triggerCell]) {
          worksheet[triggerCell] = { t: "s", v: row[baseColumnOffset + 4] || "" };
        }
        worksheet[triggerCell].s = {
          font: { color: { rgb: "DC2626" }, sz: 9, italic: true },
          fill: { fgColor: { rgb: "FEE2E2" } },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border: {
            top: { style: "thin", color: { rgb: "E5E7EB" } },
            left: { style: "thin", color: { rgb: "E5E7EB" } },
            bottom: { style: "thin", color: { rgb: "E5E7EB" } },
            right: { style: "thin", color: { rgb: "E5E7EB" } },
          },
        };

        // Style follow-up answer cell
        styleAnswerCell(baseColumnOffset + 5);
      }
    }
  }

  // Set column widths
  const columnWidths = [
    { wch: 25 }, // Section
    { wch: 12 }, // Question No.
    { wch: 35 }, // Question
    { wch: 10 }, // Type
    { wch: 20 }, // Options
    { wch: 12 }, // Trigger Option
    { wch: 30 }, // Answer
  ];

  for (let i = 0; i < maxFollowUpsPerRow; i++) {
    columnWidths.push({ wch: 12 }); // FU No.
    columnWidths.push({ wch: 30 }); // Follow-up Question
    columnWidths.push({ wch: 10 }); // Type
    columnWidths.push({ wch: 20 }); // Options
    columnWidths.push({ wch: 8 }); // Trigger
    columnWidths.push({ wch: 30 }); // Answer
  }

  worksheet["!cols"] = columnWidths;

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Answer Template");

  const fileName = `${(form.title || "form")
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()}-answer-template.xlsx`;

  writeFile(workbook, fileName);

  console.log(`\n✅ Template saved as: ${fileName}`);
  console.log(`📊 Total rows: ${data.length - 1}`);
  console.log(`🎯 Numbering: Q1, FU1, FU2, FU1.1, FU1.2, etc.`);
  console.log(`📈 Max follow-ups per row: ${maxFollowUpsPerRow}`);

  return fileName;
}
// Updated parser for the new format
export async function parseAnswerWorkbook(
  file: File,
  form: Question,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<ParsedAnswers> {
  console.log("🔄 Parsing answer workbook...");

  const { read } = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer, { type: "array" });

  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) {
    throw new Error("Workbook has no sheets");
  }

  const rawData = utils.sheet_to_json<Array<unknown>>(worksheet, {
    defval: "",
    header: 1,
  });

  console.log(`📋 Found ${rawData.length} rows in the file`);

  if (rawData.length < 2) {
    throw new Error("No answer data found in the file");
  }

  const answerRows = rawData.slice(1);
  const answers: ParsedAnswers = {};

  onProgress?.(0, answerRows.length, "Starting to parse answers...");

  console.log("📋 Parsing answers...");

  let parsedCount = 0;
  let matchedCount = 0;
  let unmatchedCount = 0;

  // Create a map of question text to ID for main questions
  const mainQuestionTextToId = new Map<string, string>();
  form.sections.forEach(section => {
    section.questions.forEach(q => {
      // Only main questions (no parent)
      if (!q.parentId && !q.showWhen?.questionId) {
        mainQuestionTextToId.set(q.text, q.id);
      }
    });
  });

  // Track which main questions have already had synthetic answers added
  const syntheticAnswersAdded = new Set<string>();

  answerRows.forEach((row, rowIndex) => {
    if (!Array.isArray(row)) {
      return;
    }

    console.log(`\n🔍 Row ${rowIndex + 2}:`);

    // Process MAIN question
    const mainQuestionText = row[2]?.toString().trim() || "";
    const mainAnswerValue = row[6]?.toString().trim() || "";

    if (mainQuestionText && mainAnswerValue) {
      const matchedId = mainQuestionTextToId.get(mainQuestionText);
      
      if (matchedId) {
        answers[matchedId] = mainAnswerValue;
        parsedCount++;
        matchedCount++;
        console.log(`   ✅ Main: "${mainQuestionText}" = "${mainAnswerValue}" (ID: ${matchedId})`);
      } else {
        unmatchedCount++;
        console.log(`   ❓ No match found for main: "${mainQuestionText}"`);
      }
    }

    // Process FOLLOW-UP questions - HANDLE SYNTHETIC FOLLOW-UPS
    let columnIndex = 7;
    let followUpIndex = 0;

    while (columnIndex + 5 < row.length) {
      const fuNumber = row[columnIndex]?.toString().trim() || "";
      const followUpText = row[columnIndex + 1]?.toString().trim() || "";
      const triggerValue = row[columnIndex + 4]?.toString().trim() || "";
      const followUpAnswer = row[columnIndex + 5]?.toString().trim() || "";

      if (fuNumber && followUpText && followUpAnswer) {
        // Remove indentation
        const cleanFollowUpText = followUpText.replace(/^\s+/, '');
        
        console.log(`     🔍 Looking for follow-up ${fuNumber}: "${cleanFollowUpText}"`);
        
        // Get the parent question ID
        const rowMainQuestionText = row[2]?.toString().trim() || "";
        const parentQuestionId = mainQuestionTextToId.get(rowMainQuestionText);
        
        if (parentQuestionId) {
          // Check if this is a synthetic follow-up
          const isSynthetic = 
            cleanFollowUpText.includes("Photograph for") ||
            cleanFollowUpText.includes("Remarks") ||
            cleanFollowUpText.includes("Action Inititated") ||
            cleanFollowUpText.includes("Reason fo Not OK") ||
            cleanFollowUpText.includes("Responsible person");
          
          if (isSynthetic) {
            console.log(`     ⚠️  Found synthetic follow-up: "${cleanFollowUpText}"`);
            
            // Create a unique key for this synthetic answer
            const syntheticKey = `${parentQuestionId}|${cleanFollowUpText}|${triggerValue}`;
            
            // Only add each synthetic answer once per parent
            if (!syntheticAnswersAdded.has(syntheticKey)) {
              syntheticAnswersAdded.add(syntheticKey);
              
              // Create a special answer format that your preview can understand
              // You can store these in a special field or handle them differently
              if (!answers[`synthetic_${parentQuestionId}`]) {
                answers[`synthetic_${parentQuestionId}`] = {};
              }
              
              // Store the synthetic answer with its context
              (answers[`synthetic_${parentQuestionId}`] as any)[cleanFollowUpText] = {
                answer: followUpAnswer,
                trigger: triggerValue
              };
              
              console.log(`     ✅ Stored synthetic answer for ${parentQuestionId}: ${cleanFollowUpText}`);
              parsedCount++;
            } else {
              console.log(`     ⏭️  Duplicate synthetic answer, skipping`);
            }
          }
        } else {
          unmatchedCount++;
          console.log(`     ❌ No parent found for follow-up: "${cleanFollowUpText}"`);
        }
      }

      followUpIndex++;
      columnIndex += 6;
      
      if (followUpIndex > 200) break;
    }
  });

  console.log(`\n📊 PARSING COMPLETE:`);
  console.log(`   ✅ Successfully parsed: ${parsedCount} answers`);
  console.log(`   ✓ Text matches: ${matchedCount}`);
  console.log(`   ✗ Unmatched questions: ${unmatchedCount}`);
  console.log(`   📋 Total answers ready for submission: ${Object.keys(answers).length}`);
  console.log(`   🧪 Synthetic answers stored: ${syntheticAnswersAdded.size}`);

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

  // ===== CRITICAL: Keep EVERY single key from parsedAnswers =====
  // This ensures NO DATA IS LOST
  Object.entries(parsedAnswers).forEach(([key, value]) => {
    answers[key] = value;
  });

  // Handle regular form questions (convert types as needed)
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

  console.log("📤 FINAL formatted answers:", {
    totalKeys: Object.keys(answers).length,
    syntheticKeys: Object.keys(answers).filter(k => k.startsWith('synthetic_')).length,
    photoKeys: Object.keys(answers).filter(k => k.includes('_photo_')).length,
    regularKeys: Object.keys(answers).filter(k => 
      !k.startsWith('synthetic_') && !k.includes('_photo_') && 
      k.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    ).length
  });

  return { answers };
}