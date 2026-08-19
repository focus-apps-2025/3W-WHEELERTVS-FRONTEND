import type { Question, FollowUpQuestion } from "../types";
import * as XLSX from "xlsx-js-style";
import JSZip from "jszip";

const { utils, write } = XLSX;

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
    trimmed.includes("cdn.") ||
    trimmed.includes("cloudfront.net")
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

function collectNestedFollowUpQuestions(
  questions: FollowUpQuestion[],
  result: FollowUpQuestion[] = []
): FollowUpQuestion[] {
  if (!questions) return result;
  for (const q of questions) {
    if (q.followUpQuestions && q.followUpQuestions.length > 0) {
      q.followUpQuestions.forEach((fu) => {
        result.push(fu);
        if (fu.followUpQuestions && fu.followUpQuestions.length > 0) {
          collectNestedFollowUpQuestions(fu.followUpQuestions, result);
        }
      });
    }
  }
  return result;
}

function collectZoneQuestions(
  questions: FollowUpQuestion[],
  result: FollowUpQuestion[] = []
): FollowUpQuestion[] {
  if (!questions) return result;
  for (const q of questions) {
    if (q.type === "zone-in" || q.type === "zone-out") {
      result.push(q);
    }
    if (q.followUpQuestions && q.followUpQuestions.length > 0) {
      collectZoneQuestions(q.followUpQuestions, result);
    }
  }
  return result;
}

export async function generateFollowUpAnswerTemplate(
  form: Question,
  inspectors?: any[]
) {
  console.log("🔄 Generating follow-up only answer template...");

  const inspectorNames = inspectors
    ? inspectors.map((i) =>
      `${i.firstName || ""} ${i.lastName || ""}`.trim() || i.username || i.email
    )
    : [];

  if (!form.sections || form.sections.length === 0) {
    throw new Error("Form has no sections or questions");
  }

  // Collect ALL questions from sections
  const allQuestions: FollowUpQuestion[] = [];
  form.sections.forEach((section) => {
    if (section.questions) {
      allQuestions.push(...section.questions);
    }
  });

  console.log(`📋 Total questions found: ${allQuestions.length}`);
  console.log("📋 All questions:", allQuestions.map(q => ({
    id: q.id,
    text: q.text,
    type: q.type,
    parentQuestionId: q.parentQuestionId,
    isFollowUp: q.isFollowUp
  })));

  // STRATEGY 1: Look for nested follow-ups (in followUpQuestions arrays)
  const nestedFollowUps: FollowUpQuestion[] = [];
  allQuestions.forEach((q) => {
    if (q.followUpQuestions && q.followUpQuestions.length > 0) {
      nestedFollowUps.push(...q.followUpQuestions);
    }
  });

  console.log(`📋 Found ${nestedFollowUps.length} nested follow-up questions`);

  // STRATEGY 2: Look for questions with parentQuestionId
  const questionsWithParent = allQuestions.filter((q) => {
    return q.parentQuestionId &&
      q.parentQuestionId !== "" &&
      q.parentQuestionId !== null &&
      q.parentQuestionId !== "null" &&
      q.parentQuestionId !== "undefined";
  });

  console.log(`📋 Found ${questionsWithParent.length} questions with parentQuestionId`);

  // STRATEGY 3: Look for Zone In/Out questions
  const zoneQuestions = allQuestions.filter((q) =>
    q.type === "zone-in" || q.type === "zone-out"
  );

  console.log(`📋 Found ${zoneQuestions.length} Zone In/Out questions`);

  // STRATEGY 4: Look for questions with "follow-up" in the text (your case)
  const textBasedFollowUps = allQuestions.filter((q) => {
    if (!q.text) return false;
    const text = q.text.toLowerCase();
    return text.includes("follow-up") ||
      text.includes("follow up") ||
      text.includes("conditional") ||
      text.includes("if you answered") ||
      text.includes("depends on");
  });

  console.log(`📋 Found ${textBasedFollowUps.length} questions with follow-up in text`);

  // Combine all follow-up questions from all strategies
  const followUpMap = new Map<string, FollowUpQuestion>();

  // Add nested follow-ups
  nestedFollowUps.forEach((q) => {
    followUpMap.set(q.id, q);
  });

  // Add questions with parentQuestionId
  questionsWithParent.forEach((q) => {
    followUpMap.set(q.id, q);
  });

  // Add zone questions
  zoneQuestions.forEach((q) => {
    followUpMap.set(q.id, q);
  });

  // Add text-based follow-ups
  textBasedFollowUps.forEach((q) => {
    followUpMap.set(q.id, q);
  });

  const followUpQuestions = Array.from(followUpMap.values());

  console.log(
    `📋 Total follow-up questions found: ${followUpQuestions.length}`
  );

  // If still no follow-ups, try using the question type pattern
  if (followUpQuestions.length === 0) {
    // Check if there are questions that are NOT the main question
    // This is a last resort - assume the first question is main, rest are follow-ups
    if (allQuestions.length > 1) {
      console.warn("⚠️ No follow-up flags found. Assuming first question is main, rest are follow-ups.");
      // Skip the first question, take all others as follow-ups
      const assumedFollowUps = allQuestions.slice(1);
      assumedFollowUps.forEach((q) => {
        followUpMap.set(q.id, q);
      });
    }
  }

  const finalFollowUpQuestions = Array.from(followUpMap.values());

  if (finalFollowUpQuestions.length === 0) {
    // If still no follow-ups, show detailed error
    console.error("❌ No follow-up questions found. Available questions:",
      allQuestions.map(q => ({
        id: q.id,
        text: q.text,
        type: q.type,
        parentQuestionId: q.parentQuestionId,
        isFollowUp: q.isFollowUp,
        hasFollowUps: q.followUpQuestions?.length || 0
      }))
    );

    throw new Error(
      "No follow-up questions found in this form.\n" +
      "Available questions: " + allQuestions.map(q => `"${q.text}"`).join(", ")
    );
  }

  // Build columns (rest of the function remains the same)
  const columns: {
    label: string;
    id: string;
    type?: string;
    options?: string[];
    required?: boolean;
  }[] = [];

  columns.push({
    label: "Submitted Date *",
    id: "submittedAt",
    type: "date",
    required: true,
  });

  columns.push({
    label: "Users",
    id: "submitterName",
    type: "select",
    options: inspectorNames,
    required: false,
  });

  if (form.chassisNumbers && form.chassisNumbers.length > 0) {
    const chassisOptions = form.chassisNumbers.map((cn: any) =>
      typeof cn === "string" ? cn : cn.chassisNumber
    );
    columns.push({
      label: "Selected Chassis",
      id: "chassis_number",
      type: "select",
      options: chassisOptions,
      required: false,
    });
  }

  finalFollowUpQuestions.forEach((q) => {
    let headerText = q.text || `Untitled Question (ID: ${q.id})`;

    columns.push({
      label: headerText,
      id: q.id,
      type: q.type,
      options: q.options,
      required: q.required,
    });

    if (q.type === "zone-in" || q.type === "zone-out") {
      columns.push({
        label: `${headerText} - Remark`,
        id: `${q.id}__remark`,
        type: "paragraph",
        required: false,
      });
      columns.push({
        label: `${headerText} - Evidence Photo`,
        id: `${q.id}__evidence`,
        type: "image",
        required: q.required,
      });
    }
  });

  const visibleHeader = columns.map((col) => col.label);
  const idHeader = columns.map((col) => col.id);
  const data: (string | number)[][] = [visibleHeader, idHeader];

  const numExampleRows = 3;
  for (let i = 0; i < numExampleRows; i++) {
    data.push(new Array(visibleHeader.length).fill(""));
  }

  const worksheet = utils.aoa_to_sheet(data);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Follow-up Responses");

  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
    fill: { fgColor: { rgb: "1D4ED8" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    },
  };

  const idHeaderStyle = {
    font: { color: { rgb: "EBF1FC" } },
    fill: { fgColor: { rgb: "EBF1FC" } },
  };

  visibleHeader.forEach((_, c) => {
    const cellRef = utils.encode_cell({ r: 0, c });
    if (!worksheet[cellRef]) worksheet[cellRef] = { t: "s", v: "" };
    worksheet[cellRef].s = headerStyle;
  });

  idHeader.forEach((_, c) => {
    const cellRef = utils.encode_cell({ r: 1, c });
    if (!worksheet[cellRef]) worksheet[cellRef] = { t: "s", v: "" };
    worksheet[cellRef].s = idHeaderStyle;
  });

  columns.forEach((col, index) => {
    const cellRef = utils.encode_cell({ r: 0, c: index });
    const commentLines: string[] = [];
    if (col.id === "submitterName") {
      commentLines.push("Type: select");
      if (col.options && col.options.length > 0) {
        commentLines.push("Available Inspectors (Copy name exactly):");
        col.options.forEach((name) => {
          commentLines.push(`- ${name}`);
        });
      } else {
        commentLines.push("No inspectors registered yet.");
      }
    } else {
      if (col.type) {
        commentLines.push(`Type: ${col.type}`);
      }
      if (col.options && col.options.length > 0) {
        commentLines.push(`Options: ${col.options.join(", ")}`);
      }
    }
    if (col.required) {
      commentLines.push("Required: YES");
    }

    if (worksheet[cellRef] && commentLines.length > 0) {
      worksheet[cellRef].c = [{ a: "System", t: commentLines.join("\n") }];
    }
  });

  for (let r = 2; r < data.length; r++) {
    const isEven = r % 2 === 0;
    const rowStyle = {
      fill: { fgColor: { rgb: isEven ? "FFFFFF" : "F3F4F6" } },
      border: {
        top: { style: "thin", color: { rgb: "E5E7EB" } },
        bottom: { style: "thin", color: { rgb: "E5E7EB" } },
        left: { style: "thin", color: { rgb: "E5E7EB" } },
        right: { style: "thin", color: { rgb: "E5E7EB" } },
      },
    };
    for (let c = 0; c < visibleHeader.length; c++) {
      const cellRef = utils.encode_cell({ r, c });
      if (!worksheet[cellRef]) worksheet[cellRef] = { t: "s", v: "" };
      worksheet[cellRef].s = rowStyle;
    }
  }

  const colWidths = visibleHeader.map((header) => ({
    wch: header.length > 20 ? 30 : 20,
  }));
  worksheet["!cols"] = colWidths;
  worksheet["!rows"] = [
    { hpx: 40 },
    { hpx: 0 },
  ];

  worksheet["!freeze"] = {
    xSplit: 0,
    ySplit: 2,
    topLeftCell: "A3",
    activePane: "bottomRight",
  };

  const fileName = `${(form.title || "form")
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()
    }-followup-template.xlsx`;

  const excelBuffer = write(workbook, { bookType: "xlsx", type: "array" });

  try {
    const zip = await JSZip.loadAsync(excelBuffer);
    const vmlFileKey = Object.keys(zip.files).find((name) =>
      name.includes("vmlDrawing")
    );
    if (vmlFileKey) {
      let vmlContent = await zip.file(vmlFileKey)!.async("string");

      vmlContent = vmlContent.replace(
        /<x:Anchor>(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)<\/x:Anchor>/g,
        (match, col1, o1, r1, o2, col2, o3, r2, o4) => {
          const c1 = parseInt(col1, 10);
          const c2 = parseInt(col2, 10);
          return `<x:Anchor>${c1 - 1},${o1},${r1},${o2},${c2 - 1},${o3},${r2},${o4}</x:Anchor>`;
        }
      );

      zip.file(vmlFileKey, vmlContent);
    }

    const finalBlob = await zip.generateAsync({ type: "blob" });

    const url = window.URL.createObjectURL(finalBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    console.log(`✅ Follow-up template saved as: ${fileName}`);
  } catch (err) {
    console.error(
      "Error post-processing VML comments, falling back to standard write:",
      err
    );
    XLSX.writeFile(workbook, fileName);
  }
  return fileName;
}
export async function generateAnswerTemplate(form: Question, inspectors?: any[]) {
  console.log("🔄 Generating new row-based answer template...");

  const inspectorNames = inspectors
    ? inspectors.map((i) =>
      `${i.firstName || ""} ${i.lastName || ""}`.trim() || i.username || i.email
    )
    : [];

  if (!form.sections || form.sections.length === 0) {
    throw new Error("Form has no sections or questions");
  }

  // DEBUG: Log all questions to see their structure
  console.log("🔍 All questions in form:");
  form.sections.forEach((section) => {
    if (section.questions) {
      section.questions.forEach((q) => {
        console.log(`  - "${q.text}" (ID: ${q.id})`, {
          parentQuestionId: q.parentQuestionId,
          isFollowUp: q.isFollowUp,
          type: q.type,
          condition: q.condition // If there's a condition field
        });
      });
    }
  });

  // 1. Collect ONLY top-level questions (exclude those with parentQuestionId)
  const allQuestions: FollowUpQuestion[] = [];

  form.sections.forEach((section) => {
    if (section.questions) {
      // Filter out questions that have a parentQuestionId (these are follow-ups)
      const topLevelQuestions = section.questions.filter((q) => {
        // Check if this question has a parent (meaning it's a follow-up)
        const hasParent = q.parentQuestionId &&
          q.parentQuestionId !== "" &&
          q.parentQuestionId !== null &&
          q.parentQuestionId !== "null" &&
          q.parentQuestionId !== "undefined";

        const isMarkedFollowUp = q.isFollowUp === true;

        // Also check if the question text indicates it's a conditional follow-up
        const textIndicatesFollowUp = q.text &&
          (q.text.toLowerCase().includes("follow-up") ||
            q.text.toLowerCase().includes("follow up") ||
            q.text.toLowerCase().includes("conditional") ||
            q.text.toLowerCase().includes("if you answered"));

        // If it has a parent OR is marked as follow-up OR text indicates follow-up, exclude it
        return !hasParent && !isMarkedFollowUp && !textIndicatesFollowUp;
      });

      allQuestions.push(...topLevelQuestions);
    }
  });

  console.log(`📋 Found ${allQuestions.length} main questions (excluding follow-ups).`);
  console.log("📋 Main questions:", allQuestions.map(q => q.text));

  // If no main questions found, fallback to using questions without parentQuestionId
  if (allQuestions.length === 0) {
    console.warn("⚠️ No main questions found. Falling back to questions without parentQuestionId.");
    form.sections.forEach((section) => {
      if (section.questions) {
        const fallbackQuestions = section.questions.filter((q) => {
          return !q.parentQuestionId ||
            q.parentQuestionId === "" ||
            q.parentQuestionId === null;
        });
        allQuestions.push(...fallbackQuestions);
      }
    });
  }

  // If STILL no questions found, use all questions as last resort
  if (allQuestions.length === 0) {
    console.warn("⚠️ Still no main questions. Using all questions as fallback.");
    form.sections.forEach((section) => {
      if (section.questions) {
        allQuestions.push(...section.questions);
      }
    });
  }

  // 2. Create Header Rows dynamically
  const columns: {
    label: string;
    id: string;
    type?: string;
    options?: string[];
    required?: boolean;
  }[] = [];

  // Add mandatory Submitted Date column
  columns.push({
    label: "Submitted Date *",
    id: "submittedAt",
    type: "date",
    required: true,
  });

  // Add Users column next to Submitted Date
  columns.push({
    label: "Users",
    id: "submitterName",
    type: "select",
    options: inspectorNames,
    required: false,
  });

  // Add Selected Chassis column if form has chassis numbers configured
  if (form.chassisNumbers && form.chassisNumbers.length > 0) {
    const chassisOptions = form.chassisNumbers.map((cn: any) =>
      typeof cn === "string" ? cn : cn.chassisNumber
    );
    columns.push({
      label: "Selected Chassis",
      id: "chassis_number",
      type: "select",
      options: chassisOptions,
      required: false,
    });
  }

  const headerCounts: { [key: string]: number } = {};

  allQuestions.forEach((q) => {
    let headerText = q.text || `Untitled Question (ID: ${q.id})`;

    if (headerCounts[headerText]) {
      headerCounts[headerText]++;
      headerText = `${headerText} (${headerCounts[headerText]})`;
    } else {
      headerCounts[headerText] = 1;
    }

    columns.push({
      label: headerText,
      id: q.id,
      type: q.type,
      options: q.options,
      required: q.required,
    });

    if (q.type === "zone-in" || q.type === "zone-out") {
      columns.push({
        label: `${headerText} - Remark`,
        id: `${q.id}__remark`,
        type: "paragraph",
        required: false,
      });
      columns.push({
        label: `${headerText} - Evidence Photo`,
        id: `${q.id}__evidence`,
        type: "image",
        required: q.required,
      });
    }
  });

  const visibleHeader = columns.map((col) => col.label);
  const idHeader = columns.map((col) => col.id);
  const data: (string | number)[][] = [visibleHeader, idHeader];

  // Add a few example rows
  const numExampleRows = 3;
  for (let i = 0; i < numExampleRows; i++) {
    data.push(new Array(visibleHeader.length).fill(""));
  }

  // 3. Create worksheet and workbook
  const worksheet = utils.aoa_to_sheet(data);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Bulk Responses");

  // 4. Style the worksheet and add comments
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
    fill: { fgColor: { rgb: "1D4ED8" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    },
  };

  const idHeaderStyle = {
    font: { color: { rgb: "EBF1FC" } },
    fill: { fgColor: { rgb: "EBF1FC" } },
  };

  // Apply styles to header rows
  visibleHeader.forEach((_, c) => {
    const cellRef = utils.encode_cell({ r: 0, c });
    if (!worksheet[cellRef]) worksheet[cellRef] = { t: 's', v: '' };
    worksheet[cellRef].s = headerStyle;
  });

  idHeader.forEach((_, c) => {
    const cellRef = utils.encode_cell({ r: 1, c });
    if (!worksheet[cellRef]) worksheet[cellRef] = { t: 's', v: '' };
    worksheet[cellRef].s = idHeaderStyle;
  });

  // Add comments to headers
  columns.forEach((col, index) => {
    const cellRef = utils.encode_cell({ r: 0, c: index });
    const commentLines: string[] = [];
    if (col.id === "submitterName") {
      commentLines.push("Type: select");
      if (col.options && col.options.length > 0) {
        commentLines.push("Available Inspectors (Copy name exactly):");
        col.options.forEach((name) => {
          commentLines.push(`- ${name}`);
        });
      } else {
        commentLines.push("No inspectors registered yet.");
      }
    } else {
      if (col.type) {
        commentLines.push(`Type: ${col.type}`);
      }
      if (col.options && col.options.length > 0) {
        commentLines.push(`Options: ${col.options.join(", ")}`);
      }
    }
    if (col.required) {
      commentLines.push("Required: YES");
    }

    if (worksheet[cellRef] && commentLines.length > 0) {
      worksheet[cellRef].c = [{ a: 'System', t: commentLines.join("\n") }];
    }
  });

  // Style data rows with alternating colors
  for (let r = 2; r < data.length; r++) {
    const isEven = r % 2 === 0;
    const rowStyle = {
      fill: { fgColor: { rgb: isEven ? "FFFFFF" : "F3F4F6" } },
      border: {
        top: { style: "thin", color: { rgb: "E5E7EB" } },
        bottom: { style: "thin", color: { rgb: "E5E7EB" } },
        left: { style: "thin", color: { rgb: "E5E7EB" } },
        right: { style: "thin", color: { rgb: "E5E7EB" } },
      }
    };
    for (let c = 0; c < visibleHeader.length; c++) {
      const cellRef = utils.encode_cell({ r, c });
      if (!worksheet[cellRef]) worksheet[cellRef] = { t: 's', v: '' };
      worksheet[cellRef].s = rowStyle;
    }
  }

  // 5. Set column widths and row heights
  const colWidths = visibleHeader.map(header => ({
    wch: header.length > 20 ? 30 : 20
  }));
  worksheet["!cols"] = colWidths;
  worksheet["!rows"] = [
    { hpx: 40 },
    { hpx: 0 },
  ];

  // Freeze the top row
  worksheet["!freeze"] = { xSplit: 0, ySplit: 2, topLeftCell: "A3", activePane: "bottomRight" };

  // 6. Write and download the file
  const fileName = `${(form.title || "form")
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()}-bulk-response-template.xlsx`;

  // Post-process the generated Excel file
  const excelBuffer = write(workbook, { bookType: "xlsx", type: "array" });

  try {
    const zip = await JSZip.loadAsync(excelBuffer);
    const vmlFileKey = Object.keys(zip.files).find(name => name.includes('vmlDrawing'));
    if (vmlFileKey) {
      let vmlContent = await zip.file(vmlFileKey)!.async("string");

      vmlContent = vmlContent.replace(
        /<x:Anchor>(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)<\/x:Anchor>/g,
        (match, col1, o1, r1, o2, col2, o3, r2, o4) => {
          const c1 = parseInt(col1, 10);
          const c2 = parseInt(col2, 10);
          return `<x:Anchor>${c1 - 1},${o1},${r1},${o2},${c2 - 1},${o3},${r2},${o4}</x:Anchor>`;
        }
      );

      zip.file(vmlFileKey, vmlContent);
    }

    const finalBlob = await zip.generateAsync({ type: "blob" });

    const url = window.URL.createObjectURL(finalBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    console.log(`✅ New template saved as: ${fileName}`);
  } catch (err) {
    console.error("Error post-processing VML comments, falling back to standard write:", err);
    XLSX.writeFile(workbook, fileName);
  }
  return fileName;
}

function parseExcelDate(value: any): Date | null {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // 1. Try standard Javascript date parsing (handles YYYY-MM-DD, MM/DD/YYYY)
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    // 2. Fallback to DD/MM/YYYY or DD-MM-YYYY formats (standard in UK/India)
    const match = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // Months are 0-indexed
      let year = parseInt(match[3], 10);
      if (year < 100) {
        year += year < 50 ? 2000 : 1900; // handle 2-digit years
      }
      const customDate = new Date(year, month, day);
      if (!isNaN(customDate.getTime())) {
        return customDate;
      }
    }
  }
  return null;
}

// Parses the new row-based answer workbook
function mapHeadersToQuestionIds(
  headers: string[],
  form: Question
): Record<number, string> {
  const colMap: Record<number, string> = {};

  const allQs: any[] = [];
  const collectQs = (questions: any[]) => {
    if (!Array.isArray(questions)) return;
    questions.forEach((q) => {
      allQs.push(q);
      if (Array.isArray(q.followUpQuestions)) {
        collectQs(q.followUpQuestions);
      }
    });
  };

  if (form.sections) {
    form.sections.forEach((s: any) => {
      if (s.questions) collectQs(s.questions);
    });
  }
  if (form.followUpQuestions) {
    collectQs(form.followUpQuestions);
  }

  const normalize = (str: string) =>
    String(str || "")
      .toLowerCase()
      .replace(/^q\d+(\.\d+)*:\s*/i, "")
      .replace(/^fq\d+:\s*/i, "")
      .replace(/\s*\*$/, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();

  headers.forEach((h, colIndex) => {
    if (!h) return;
    const cleanH = String(h).trim();
    const lowerH = cleanH.toLowerCase();

    if (
      lowerH === "submittedat" ||
      lowerH.includes("timestamp") ||
      lowerH.includes("submitted date") ||
      lowerH === "date"
    ) {
      colMap[colIndex] = "submittedAt";
      return;
    }
    if (
      lowerH === "submittername" ||
      lowerH.includes("submitted by") ||
      lowerH.includes("inspector")
    ) {
      colMap[colIndex] = "submitterName";
      return;
    }
    if (lowerH === "submitteremail" || lowerH.includes("email")) {
      colMap[colIndex] = "submitterEmail";
      return;
    }
    if (
      lowerH === "chassis_number" ||
      lowerH === "chassis number" ||
      lowerH.includes("chassis")
    ) {
      colMap[colIndex] = "chassis_number";
      return;
    }

    const exactQ = allQs.find(
      (q) => q.id === cleanH || (q as any)._id === cleanH
    );
    if (exactQ) {
      colMap[colIndex] = exactQ.id || (exactQ as any)._id;
      return;
    }

    const normH = normalize(cleanH);
    if (normH) {
      const matchQ = allQs.find((q) => {
        const qId = q.id || (q as any)._id;
        const qText = q.text || q.label || "";
        return (
          normalize(qId) === normH ||
          normalize(qText) === normH ||
          normH.includes(normalize(qText)) ||
          (normalize(qText).length > 3 && normH.startsWith(normalize(qText)))
        );
      });
      if (matchQ) {
        colMap[colIndex] = matchQ.id || (matchQ as any)._id;
        return;
      }
    }

    colMap[colIndex] = cleanH;
  });

  return colMap;
}

// Parses the new row-based answer workbook (supports both import templates & exported response excel files)
export async function parseAnswerWorkbook(
  file: File,
  form: Question, // Keep form for potential future validation
  onProgress?: (current: number, total: number, message: string) => void,
): Promise<any[]> {
  console.log("🔄 Parsing row-based answer workbook (supporting both import templates and exported files)...");

  const { read, utils } = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer, { type: "array" });

  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) {
    throw new Error("Workbook has no sheets");
  }

  // Convert sheet to JSON array of arrays, starting from the top
  const rawData = utils.sheet_to_json<Array<any>>(worksheet, {
    header: 1,
    defval: "",
  });

  if (!rawData || rawData.length < 2) {
    throw new Error("Template is invalid or has no data rows.");
  }

  const row0 = (rawData[0] || []).map(String);
  const row1 = (rawData[1] || []).map(String);

  // Check if Row 1 contains system IDs / question IDs (standard 2-row header template format)
  const isTemplateFormat =
    rawData.length >= 3 &&
    row1.some(
      (cell) =>
        cell === "submittedAt" ||
        cell === "submitterName" ||
        cell === "chassis_number" ||
        form.sections?.some((s) => s.questions?.some((q) => (q.id || (q as any)._id) === cell)) ||
        form.followUpQuestions?.some((q) => (q.id || (q as any)._id) === cell)
    );

  let colMap: Record<number, string>;
  let dataRows: any[][];

  if (isTemplateFormat) {
    colMap = {};
    row1.forEach((id, colIdx) => {
      if (id) colMap[colIdx] = String(id).trim();
    });
    dataRows = rawData.slice(2);
  } else {
    colMap = mapHeadersToQuestionIds(row0, form);
    dataRows = rawData.slice(1);
  }

  console.log(`📋 Column Mapping:`, colMap);
  console.log(`📊 Found ${dataRows.length} data rows to process.`);

  const responses: any[] = [];
  const totalRows = dataRows.length;

  dataRows.forEach((row, rowIndex) => {
    onProgress?.(rowIndex, totalRows, `Processing row ${rowIndex + 1}/${totalRows}`);

    // Skip empty rows
    if (!row || row.every((cell) => cell === "" || cell === null || cell === undefined)) {
      return;
    }

    const singleResponse: {
      answers: { [key: string]: any };
      submittedBy: string;
      submitterContact: { email: string };
      submittedAt?: string;
    } = {
      answers: {},
      submittedBy: "Excel Import",
      submitterContact: { email: "" },
    };

    row.forEach((cellValue, colIndex) => {
      const id = colMap[colIndex];
      if (!id) return;

      if (id === "submitterName") {
        singleResponse.submittedBy = cellValue ? String(cellValue).trim() : "Excel Import";
      } else if (id === "submitterEmail") {
        singleResponse.submitterContact.email = cellValue ? String(cellValue).trim() : "";
      } else if (id === "submittedAt") {
        singleResponse.submittedAt = String(cellValue).trim();
      } else {
        if (cellValue !== "" && cellValue !== null && cellValue !== undefined) {
          singleResponse.answers[id] = cellValue;
        }
      }
    });

    // Parse submittedAt date or fallback to current date
    if (singleResponse.submittedAt) {
      const parsedDate = parseExcelDate(singleResponse.submittedAt);
      if (parsedDate) {
        singleResponse.submittedAt = parsedDate.toISOString();
      } else {
        singleResponse.submittedAt = new Date().toISOString();
      }
    } else {
      singleResponse.submittedAt = new Date().toISOString();
    }

    // Default to the first chassis option if not specified and options are available
    if (form.chassisNumbers && form.chassisNumbers.length > 0) {
      const firstChassis = form.chassisNumbers[0];
      const defaultChassis = typeof firstChassis === "string" ? firstChassis : firstChassis?.chassisNumber;
      if (!singleResponse.answers["chassis_number"] && defaultChassis) {
        singleResponse.answers["chassis_number"] = defaultChassis;
      }
    }

    // Format answers using the standard form formatter
    const formatted = formatAnswersForSubmission(form, singleResponse.answers);
    singleResponse.answers = formatted.answers;

    responses.push(singleResponse);
  });

  console.log(`✅ Parsed ${responses.length} responses successfully.`);
  onProgress?.(totalRows, totalRows, `Successfully parsed ${responses.length} responses.`);

  return responses;
}

function parseChassisAnswer(value: string, type: string) {
  if (!value || typeof value !== "string") return value;

  const result: any = {
    chassisNumber: "",
    status: "",
    defectCategory: [],
    defects: [],
    zonesData: {}
  };

  if (type === "chassis-with-zone") {
    result.zone = [];
  }

  // Define valid zones for normalization to match ChassisWithZone.tsx
  const VALID_ZONES = ["Zone A+", "Zone A", "Zone B", "Zone C"];

  // Split by semicolon
  const parts = value.split(";").map((p) => p.trim());

  parts.forEach((part) => {
    const lowerPart = part.toLowerCase();
    if (lowerPart.startsWith("chassis:")) {
      result.chassisNumber = part.split(":")[1]?.trim() || "";
    } else if (lowerPart.startsWith("status:")) {
      result.status = part.split(":")[1]?.trim() || "";
    } else if ((lowerPart.startsWith("zones:") || lowerPart.startsWith("zone:")) && type === "chassis-with-zone") {
      const zonesStr = part.split(":")[1]?.trim() || "";
      const rawZones = zonesStr
        .split(",")
        .map((z) => z.trim())
        .filter(Boolean);

      // Normalize zone names to match ZONES constant in ChassisWithZone.tsx
      result.zone = rawZones.map(rz => {
        const found = VALID_ZONES.find(vz => vz.toLowerCase() === rz.toLowerCase());
        return found || rz;
      });
    } else if (lowerPart.startsWith("category:")) {
      const catStr = part.split(":")[1]?.trim() || "";
      result.defectCategory = catStr
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
    } else if (lowerPart.startsWith("defects:")) {
      const defectsStr = part.split(":")[1]?.trim() || "";
      // Split defects by comma, but be careful of commas inside remarks/brackets
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

  // Populate zonesData for hierarchical UI compatibility
  if (type === "chassis-with-zone" && result.zone && result.zone.length > 0) {
    result.zone.forEach((z: string) => {
      if (!result.zonesData[z]) {
        result.zonesData[z] = { categories: [] };
      }

      if (result.defectCategory.length > 0) {
        result.defectCategory.forEach((catName: string) => {
          result.zonesData[z].categories.push({
            name: catName,
            defects: result.defects.map((d: any) => ({
              name: d.name,
              details: {
                remark: d.remark,
                fileUrl: d.fileUrl
              }
            }))
          });
        });
      }
    });
  }

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
        } else if (
          question.type === "zone-in" ||
          question.type === "zone-out"
        ) {
          const qId = question.id;
          const statusVal = parsedAnswers[qId] !== undefined ? String(parsedAnswers[qId]).trim() : "";
          const remarkVal = parsedAnswers[`${qId}__remark`] !== undefined ? String(parsedAnswers[`${qId}__remark`]).trim() : "";
          const evidenceVal = parsedAnswers[`${qId}__evidence`] !== undefined ? String(parsedAnswers[`${qId}__evidence`]).trim() : "";

          if (statusVal || remarkVal || evidenceVal) {
            const chassisVal = parsedAnswers["chassis_number"] || "";
            answers[qId] = {
              chassisNumber: chassisVal,
              status: statusVal,
              remark: remarkVal,
              evidenceUrl: isImageUrl(evidenceVal) ? convertGoogleDriveLink(evidenceVal) : evidenceVal,
            };
          }
          // Clean up the temporary __remark and __evidence keys to avoid polluting
          delete answers[`${qId}__remark`];
          delete answers[`${qId}__evidence`];
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