const XLSX_Style = require("xlsx-js-style");
const XLSX_Std = require("xlsx");
const fs = require('fs');
const JSZip = require('jszip');

const data = [
  ["Submitted Date *", "Selected Chassis", "Chassis Number"],
  ["submittedAt", "chassis_number", "chassis_id"]
];

function generate(XLSX, filename, useStyle) {
  const { utils } = XLSX;
  const worksheet = utils.aoa_to_sheet(data);
  
  if (useStyle) {
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "1D4ED8" } }
    };
    for (let c = 0; c < 3; c++) {
      const cellRef = utils.encode_cell({ r: 0, c });
      if (!worksheet[cellRef]) worksheet[cellRef] = { t: 's', v: '' };
      worksheet[cellRef].s = headerStyle;
    }
  }

  worksheet['A1'].c = [{ a: 'System', t: 'Comment Date' }];
  worksheet['B1'].c = [{ a: 'System', t: 'Comment Chassis' }];
  worksheet['C1'].c = [{ a: 'System', t: 'Comment ID' }];

  worksheet["!rows"] = [ { hpx: 40 }, { hpx: 0 } ];
  worksheet["!freeze"] = { xSplit: 0, ySplit: 2, topLeftCell: "A3", activePane: "bottomRight" };

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, filename);
}

generate(XLSX_Style, "with_style.xlsx", true);
generate(XLSX_Std, "without_style.xlsx", false);

async function inspect(filename) {
  const fileData = fs.readFileSync(filename);
  const zip = await JSZip.loadAsync(fileData);
  const commentsFile = Object.keys(zip.files).find(name => name.includes('comments'));
  const vmlFile = Object.keys(zip.files).find(name => name.includes('vmlDrawing'));
  
  console.log(`\n================ ${filename} ================`);
  if (commentsFile) {
    console.log(`Comments XML:`);
    console.log(await zip.files[commentsFile].async('string'));
  }
  if (vmlFile) {
    console.log(`VML XML:`);
    console.log(await zip.files[vmlFile].async('string'));
  }
}

async function run() {
  await inspect("with_style.xlsx");
  await inspect("without_style.xlsx");
}

run();
