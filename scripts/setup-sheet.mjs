// One-off: add a header row + format column G (Phone) as text and widen it.
// Run: node --env-file=.env scripts/setup-sheet.mjs
import { JWT } from 'google-auth-library';

const SHEET_ID = process.env.SHEET_ID;
const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const HEADER = ['Timestamp', 'Language', 'Driver Name', 'Age', 'Experience',
  'Parent Name', 'Phone', 'Email', 'Goals', 'Program'];

async function api(path, method, body) {
  const { access_token } = await auth.authorize();
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${path}`, {
    method,
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

// 1) Find the first sheet's numeric id
const meta = await api(`${SHEET_ID}?fields=sheets.properties`, 'GET');
const sheetId = meta.sheets[0].properties.sheetId;
const title = meta.sheets[0].properties.title;
console.log('Sheet tab:', title, '(id', sheetId + ')');

// 2) Insert a blank row at the very top (keeps any existing rows below)
await api(`${SHEET_ID}:batchUpdate`, 'POST', {
  requests: [{
    insertDimension: {
      range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
      inheritFromBefore: false,
    },
  }],
});

// 3) Write the header into row 1
await api(`${SHEET_ID}/values/A1:J1?valueInputOption=RAW`, 'PUT', { values: [HEADER] });

// 4) Format column G (Phone) as plain text, bold header row, widen column G
await api(`${SHEET_ID}:batchUpdate`, 'POST', {
  requests: [
    { // whole column G -> plain text so phone keeps leading zeros / no 9E+08
      repeatCell: {
        range: { sheetId, startColumnIndex: 6, endColumnIndex: 7 },
        cell: { userEnteredFormat: { numberFormat: { type: 'TEXT' } } },
        fields: 'userEnteredFormat.numberFormat',
      },
    },
    { // widen column G so phone shows fully
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 6, endIndex: 7 },
        properties: { pixelSize: 150 },
        fields: 'pixelSize',
      },
    },
    { // bold + freeze header row
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true } } },
        fields: 'userEnteredFormat.textFormat.bold',
      },
    },
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    },
  ],
});

console.log('Done: header row added, column G formatted as text (150px), header bold + frozen.');
