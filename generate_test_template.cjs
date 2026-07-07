const XLSX = require("xlsx-js-style");
const { utils } = XLSX;
const fs = require('fs');
const JSZip = require('jszip');

// Simple mock form
const form = {
  title: "Chassis N603",
  chassisNumbers: ["iuoiuoeiouiou"],
  sections: [
    {
      title: "Basic Info",
      questions: [
        { id: "chassis_id", text: "Chassis Number", type: "text", required: true },
        { id: "rust_id", text: "Rust", type: "zone-out", required: true },
        { id: "burr_id", text: "Burr / Sharp edges", type: "zone-out", required: true }
      ]
    }
  ]
};

// 1. Flatten all questions
const allQuestions = [];
form.sections.forEach((section) => {
  section.questions.forEach((q) => {
    allQuestions.push(q);
  });
});

// 2. Create Header Rows dynamically
const columns = [];

// Add mandatory Submitted Date column
columns.push({
  label: "Submitted Date *",
  id: "submittedAt",
  type: "date",
  required: true,
});

// Add Selected Chassis column if form has chassis numbers configured
if (form.chassisNumbers && form.chassisNumbers.length > 0) {
  const chassisOptions = form.chassisNumbers.map((cn) =>
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

const headerCounts = {};
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
const data = [visibleHeader, idHeader];

// 3. Create worksheet and workbook
const worksheet = utils.aoa_to_sheet(data);
const workbook = utils.book_new();
utils.book_append_sheet(workbook, worksheet, "Bulk Responses");

// 4. Add comments directly to their correct cells
columns.forEach((col, index) => {
  const cellRef = utils.encode_cell({ r: 0, c: index });
  const commentLines = [];
  if (col.type) {
    commentLines.push(`Type: ${col.type}`);
  }
  if (col.options && col.options.length > 0) {
    commentLines.push(`Options: ${col.options.join(", ")}`);
  }
  if (col.required) {
    commentLines.push("Required: YES");
  }
  
  if (worksheet[cellRef] && commentLines.length > 0) {
    worksheet[cellRef].c = [{ a: 'System', t: commentLines.join("\n") }];
  }
});

async function processWorkbook() {
  // Write to array buffer
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  
  // Load using JSZip
  const zip = await JSZip.loadAsync(excelBuffer);
  
  // Find VML drawing
  const vmlFileKey = Object.keys(zip.files).find(name => name.includes('vmlDrawing'));
  if (!vmlFileKey) {
    console.log('No VML file found!');
    return;
  }
  
  let vmlContent = await zip.file(vmlFileKey).async("string");
  console.log('--- Original VML Anchor tags ---');
  const anchorsBefore = vmlContent.match(/<x:Anchor>.*?<\/x:Anchor>/g);
  console.log(anchorsBefore);
  
  // Shift Anchor col1 and col2 left by 1
  vmlContent = vmlContent.replace(/<x:Anchor>(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)<\/x:Anchor>/g, (match, col1, o1, r1, o2, col2, o3, r2, o4) => {
    const c1 = parseInt(col1, 10);
    const c2 = parseInt(col2, 10);
    return `<x:Anchor>${c1 - 1},${o1},${r1},${o2},${c2 - 1},${o3},${r2},${o4}</x:Anchor>`;
  });
  
  console.log('\n--- Modified VML Anchor tags ---');
  const anchorsAfter = vmlContent.match(/<x:Anchor>.*?<\/x:Anchor>/g);
  console.log(anchorsAfter);
  
  // Save back to zip and write file
  zip.file(vmlFileKey, vmlContent);
  const finalBuffer = await zip.generateAsync({ type: "nodebuffer" });
  fs.writeFileSync("test_template.xlsx", finalBuffer);
  console.log('\nModified workbook written to test_template.xlsx');
}

processWorkbook();
