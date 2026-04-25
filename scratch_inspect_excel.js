const path = require('path');
const xlsxPath = path.join(__dirname, 'frontend', 'node_modules', 'xlsx');
const XLSX = require(xlsxPath);

const filePath = path.join(__dirname, 'customer_Data (1) 1.xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('Headers found in row 0:', jsonData[0]);
console.log('Row 1 data:', jsonData[1]);
console.log('Row 2 data:', jsonData[2]);
console.log('Row 3 data:', jsonData[3]);
