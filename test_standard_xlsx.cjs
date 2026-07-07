const XLSX = require("xlsx");
const { utils } = XLSX;
const fs = require('fs');
const JSZip = require('jszip');

const data = [
  ["Col A", "Col B", "Col C"],
  ["idA", "idB", "idC"]
];

const worksheet = utils.aoa_to_sheet(data);
worksheet['A1'].c = [{ a: 'System', t: 'Comment A' }];
worksheet['B1'].c = [{ a: 'System', t: 'Comment B' }];

const workbook = utils.book_new();
utils.book_append_sheet(workbook, worksheet, "Sheet1");

XLSX.writeFile(workbook, "test_std.xlsx");

async function checkVml() {
  const fileData = fs.readFileSync('test_std.xlsx');
  const zip = await JSZip.loadAsync(fileData);
  const vmlFile = Object.keys(zip.files).find(name => name.includes('vmlDrawing'));
  if (vmlFile) {
    console.log('Standard XLSX VML Content:');
    console.log(await zip.files[vmlFile].async('string'));
  }
}

checkVml();
