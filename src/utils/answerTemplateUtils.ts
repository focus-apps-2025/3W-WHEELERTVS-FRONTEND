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

  // Collect all top-level questions to build parent labels
  const topLevelQuestions: FollowUpQuestion[] = [];
  const collectTopLevel = (questions: FollowUpQuestion[]) => {
    if (!questions) return;
    for (const q of questions) {
      topLevelQuestions.push(q);
      if (q.followUpQuestions && q.followUpQuestions.length > 0) {
        collectTopLevel(q.followUpQuestions);
      }
    }
  };
  form.sections.forEach((section) => {
    if (section.questions) {
      collectTopLevel(section.questions);
    }
  });

  // Collect ONLY nested follow-up questions (not top-level)
  const nestedQuestions = collectNestedFollowUpQuestions(topLevelQuestions);

  // Also treat Zone In / Zone Out questions as follow-up questions for Template 2
  const zoneQuestions = collectZoneQuestions(topLevelQuestions);

  // Merge nested follow-ups and zone questions, deduplicated by id
  const followUpMap = new Map<string, FollowUpQuestion>();
  [...nestedQuestions, ...zoneQuestions].forEach((q) => {
    followUpMap.set(q.id, q);
  });
  const followUpQuestions = Array.from(followUpMap.values());

  console.log(
    `📋 Found ${topLevelQuestions.length} main questions, ${nestedQuestions.length} nested follow-up questions, and ${zoneQuestions.length} Zone In/Out questions.`
  );

  if (followUpQuestions.length === 0) {
    throw new Error(
      "No follow-up questions found in this form. Template 2 requires at least one main question with nested follow-up questions."
    );
  }

  // Build columns
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

  followUpQuestions.forEach((q) => {
    let headerText = q.text || `Untitled Question (ID: ${q.id})`;

    columns.push({
      label: headerText,
      id: q.id,
      type: q.type,
      options: q.options,
      required: q.required,
    });

    // For Zone In / Zone Out questions, also emit their follow-up fields
    // (Remark and Evidence Photo) as separate columns, exactly like the
    // form UI shows them when a status is selected.
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

  const fileName = `${
    (form.title || "form")
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

  // 1. Flatten all questions from all sections into a single list
  const allQuestions: FollowUpQuestion[] = [];
  const collectAllQuestions = (questions: FollowUpQuestion[]) => {
    if (!questions) return;
    for (const q of questions) {
      allQuestions.push(q);
      if (q.followUpQuestions && q.followUpQuestions.length > 0) {
        collectAllQuestions(q.followUpQuestions);
      }
    }
  };

  form.sections.forEach((section) => {
    if (section.questions) {
      collectAllQuestions(section.questions);
    }
  });

  console.log(`📋 Found ${allQuestions.length} questions to create as columns.`);

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
      font: { color: { rgb: "EBF1FC" } }, // Hide the text by matching background
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
    { hpx: 40 }, // Visible header height
    { hpx: 0 },   // Hidden ID row
  ];
  
  // Freeze the top row
  worksheet["!freeze"] = { xSplit: 0, ySplit: 2, topLeftCell: "A3", activePane: "bottomRight" }; // Adjusted xSplit to 0


  // 6. Write and download the file
  const fileName = `${(form.title || "form")
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()}-bulk-response-template.xlsx`;

  // Post-process the generated Excel file to fix SheetJS's hardcoded comment anchor shift
  const excelBuffer = write(workbook, { bookType: "xlsx", type: "array" });
  
  try {
    const zip = await JSZip.loadAsync(excelBuffer);
    const vmlFileKey = Object.keys(zip.files).find(name => name.includes('vmlDrawing'));
    if (vmlFileKey) {
      let vmlContent = await zip.file(vmlFileKey)!.async("string");
      
      // Shift Anchor col1 and col2 left by 1 to align comment box visually with its host cell
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
    
    // Trigger download in browser
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
export async function parseAnswerWorkbook(
  file: File,
  form: Question, // Keep form for potential future validation
  onProgress?: (current: number, total: number, message: string) => void,
): Promise<any[]> {
  console.log("🔄 Parsing new row-based answer workbook...");

  const { read, utils } = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer, { type: "array" });

  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) {
    throw new Error("Workbook has no sheets");
  }

  // Convert sheet to JSON array of arrays, starting from the top
  const rawData = utils.sheet_to_json<Array<string>>(worksheet, {
    header: 1,
    defval: "",
  });

  if (rawData.length < 3) {
    throw new Error("Template is invalid or has no data rows.");
  }

  const idHeader = rawData[1]; // The second row contains the IDs
  const dataRows = rawData.slice(2); // Actual data starts from the third row

  console.log(`📋 ID Header:`, idHeader);
  console.log(`📊 Found ${dataRows.length} data rows to process.`);

  const responses: any[] = [];
  const totalRows = dataRows.length;

  dataRows.forEach((row, rowIndex) => {
    onProgress?.(rowIndex, totalRows, `Processing row ${rowIndex + 1}/${totalRows}`);

    // Skip empty rows
    if (row.every(cell => cell === "")) {
      console.log(`Skipping empty row ${rowIndex + 2}`);
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
      const id = idHeader[colIndex];
      if (!id) return; // Skip if there's no ID for this column

      if (id === "submitterName") {
        singleResponse.submittedBy = cellValue || "Excel Import";
      } else if (id === "submitterEmail") {
        singleResponse.submitterContact.email = cellValue;
      } else if (id === "submittedAt") {
        singleResponse.submittedAt = cellValue;
      } else {
        // It's a question ID or chassis_number
        if (cellValue !== "" && cellValue !== null && cellValue !== undefined) {
             singleResponse.answers[id] = cellValue;
        }
      }
    });

    // Validate submittedAt is present and valid
    if (!singleResponse.submittedAt) {
      throw new Error(`Row ${rowIndex + 3}: Submitted Date is mandatory.`);
    }
    const parsedDate = parseExcelDate(singleResponse.submittedAt);
    if (!parsedDate) {
      throw new Error(`Row ${rowIndex + 3}: Invalid Submitted Date format.`);
    }
    singleResponse.submittedAt = parsedDate.toISOString();


    // Default to the first chassis option if not specified and options are available
    if (form.chassisNumbers && form.chassisNumbers.length > 0) {
      const firstChassis = form.chassisNumbers[0];
      const defaultChassis = typeof firstChassis === "string" ? firstChassis : firstChassis?.chassisNumber;
      if (!singleResponse.answers["chassis_number"] && defaultChassis) {
        singleResponse.answers["chassis_number"] = defaultChassis;
      }
    }

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
