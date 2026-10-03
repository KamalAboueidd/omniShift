import JSZip from 'jszip';

/**
 * Structured Data Engine (JSON <-> CSV <-> XLSX)
 * Executes entirely client-side inside Web Worker with zero network calls.
 */

/**
 * Flattens nested JSON objects into dot-notated paths.
 */
function flattenObject(obj, prefix = '') {
  return Object.keys(obj || {}).reduce((acc, k) => {
    const pre = prefix.length ? `${prefix}.` : '';
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      Object.assign(acc, flattenObject(obj[k], pre + k));
    } else {
      acc[pre + k] = Array.isArray(obj[k]) ? JSON.stringify(obj[k]) : obj[k];
    }
    return acc;
  }, {});
}

/**
 * Automatically detects CSV delimiter (comma, semicolon, tab, pipe).
 */
function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const pipeCount = (firstLine.match(/\|/g) || []).length;

  const max = Math.max(commaCount, semiCount, tabCount, pipeCount);
  if (max === 0) return ',';
  if (max === semiCount) return ';';
  if (max === tabCount) return '\t';
  if (max === pipeCount) return '|';
  return ',';
}

/**
 * Parses CSV text into array of objects.
 */
export function csvToJson(csvText) {
  const delimiter = detectDelimiter(csvText);
  const lines = csvText.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  // Parse header
  const parseRow = (line) => {
    const pattern = new RegExp(
      `(${delimiter}|\\r?\\n|\\r|^)(?:"([^"]*(?:""[^"]*)*)"|([^"${delimiter}\\r\\n]*))`,
      'gi'
    );
    const result = [];
    let match;
    while ((match = pattern.exec(line))) {
      const matchedDelimiter = match[1];
      if (matchedDelimiter.length && matchedDelimiter !== delimiter) {
        // Line boundary
      }
      let val;
      if (match[2] !== undefined) {
        val = match[2].replace(/""/g, '"');
      } else {
        val = match[3];
      }
      result.push(val !== undefined ? val.trim() : '');
    }
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h || `column_${idx + 1}`] = values[idx] !== undefined ? values[idx] : '';
    });
    rows.push(obj);
  }

  return rows;
}

/**
 * Converts JSON array or object to clean CSV.
 */
export function jsonToCsv(jsonData, delimiter = ',') {
  let arr = jsonData;
  if (typeof jsonData === 'string') {
    arr = JSON.parse(jsonData);
  }
  if (!Array.isArray(arr)) {
    arr = [arr];
  }

  const flattened = arr.map((item) => (typeof item === 'object' && item !== null ? flattenObject(item) : { value: item }));
  const headers = Array.from(new Set(flattened.flatMap((item) => Object.keys(item))));

  const escapeVal = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = headers.map(escapeVal).join(delimiter);
  const bodyRows = flattened.map((row) => headers.map((h) => escapeVal(row[h])).join(delimiter));

  return [headerRow, ...bodyRows].join('\r\n');
}

/**
 * Builds valid Office Open XML (.xlsx) workbook directly using JSZip in memory.
 */
export async function dataToXlsx(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Cannot export empty data set to XLSX.');
  }

  const zip = new JSZip();
  const headers = Object.keys(rows[0] || {});

  // Escape XML characters
  const escapeXml = (str) =>
    String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  // Generate sheet rows XML
  let sheetData = '';
  // Header row
  sheetData += `<row r="1">`;
  headers.forEach((h, colIdx) => {
    const colLetter = String.fromCharCode(65 + (colIdx % 26));
    sheetData += `<c r="${colLetter}1" t="inlineStr"><is><t>${escapeXml(h)}</t></is></c>`;
  });
  sheetData += `</row>`;

  // Data rows
  rows.forEach((row, rowIdx) => {
    const rNum = rowIdx + 2;
    sheetData += `<row r="${rNum}">`;
    headers.forEach((h, colIdx) => {
      const colLetter = String.fromCharCode(65 + (colIdx % 26));
      const val = row[h];
      const isNum = typeof val === 'number' || (!isNaN(val) && val !== '' && val !== null);
      if (isNum && typeof val !== 'boolean') {
        sheetData += `<c r="${colLetter}${rNum}"><v>${val}</v></c>`;
      } else {
        sheetData += `<c r="${colLetter}${rNum}" t="inlineStr"><is><t>${escapeXml(val ?? '')}</t></is></c>`;
      }
    });
    sheetData += `</row>`;
  });

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetData}</sheetData>
</worksheet>`;

  // OpenXML Packaging Boilerplate
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`);

  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);

  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`);

  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`);

  zip.file('xl/worksheets/sheet1.xml', sheetXml);

  return zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
  });
}

/**
 * Main Structured Data Transmute Pipeline
 */
export async function executeDataTransmute(buffer, sourceFormat, targetFormat) {
  const decoder = new TextDecoder('utf-8');
  const textContent = decoder.decode(buffer);

  let parsedRows;
  if (sourceFormat === 'JSON' || textContent.trim().startsWith('{') || textContent.trim().startsWith('[')) {
    const parsed = JSON.parse(textContent);
    parsedRows = Array.isArray(parsed) ? parsed : [parsed];
  } else {
    // CSV / TSV
    parsedRows = csvToJson(textContent);
  }

  const rowCount = parsedRows.length;

  if (targetFormat === 'CSV') {
    const csvOutput = jsonToCsv(parsedRows);
    const encoder = new TextEncoder();
    const outputBuffer = encoder.encode(csvOutput).buffer;
    return {
      outputBuffer,
      outputMimeType: 'text/csv',
      extraMeta: { rowCount, format: 'CSV' },
    };
  }

  if (targetFormat === 'JSON') {
    const jsonOutput = JSON.stringify(parsedRows, null, 2);
    const encoder = new TextEncoder();
    const outputBuffer = encoder.encode(jsonOutput).buffer;
    return {
      outputBuffer,
      outputMimeType: 'application/json',
      extraMeta: { rowCount, format: 'JSON' },
    };
  }

  if (targetFormat === 'XLSX') {
    const outputBuffer = await dataToXlsx(parsedRows);
    return {
      outputBuffer,
      outputMimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extraMeta: { rowCount, format: 'XLSX (Excel Workbook)' },
    };
  }

  throw new Error(`Unsupported data target format: ${targetFormat}`);
}
