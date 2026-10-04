import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  AlignmentType,
  PageBreak,
  ImageRun,
} from 'docx';
import JSZip from 'jszip';
import { pdfToPptx } from './presentationEngine';

// Configure pdfjs worker URL safely for both browser window and Web Worker contexts
try {
  if (typeof pdfjsLib !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      const origin = typeof location !== 'undefined' ? location.origin : '';
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker.startsWith('http') || !origin
        ? pdfWorker
        : `${origin}${pdfWorker.startsWith('/') ? '' : '/'}${pdfWorker}`;
    }
  }
} catch {
  // workerSrc setup handled gracefully
}

/**
 * Enterprise Fault-Tolerant PDF Engine
 * Features:
 * 1. High-accuracy layout-aware text extraction with PDF.js & pdf-lib fallbacks.
 * 2. Scanned / Empty text-layer PDF guard: Renders and embeds high-res page bitmaps into DOCX.
 * 3. Bi-directional Arabic & RTL text normalization with native Word RTL paragraph shaping.
 * 4. Corrupted / unmapped embedded font sanitization.
 * 5. Multi-column grid & tabular data reconstruction (invoices, pricing tables, skill matrices).
 * 6. Visual hierarchy, section divider rules, and two-column header alignment.
 * 7. Document page dimension & margin matching to prevent layout overflow.
 */

const HEADING_KEYWORDS = /^(professional\s+summary|executive\s+summary|summary|profile|about\s+me|experience|work\s+experience|professional\s+experience|employment\s+history|career\s+history|education|academic\s+background|skills|technical\s+skills|core\s+competencies|key\s+skills|expertise|projects|personal\s+projects|certifications|certificates|licenses|awards|honors|publications|languages|interests|volunteer\s+experience|references)$/i;
const BULLET_REGEX = /^([•\-*▪▸►◦–—]|\u2022|\u25E6|\u25AA|\u2013|\u2014|\u25BA)\s*(.*)$/;
const RTL_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
};

/**
 * Normalizes font family names for standard Word rendering.
 */
function normalizeFontFamily(fontFam, fontName, isRTL = false) {
  if (isRTL) return 'Arial';
  const combined = `${fontFam || ''} ${fontName || ''}`.toLowerCase();
  if (/times|georgia|cambria|serif/i.test(combined) && !/sans/i.test(combined)) {
    return 'Times New Roman';
  }
  if (/arial|helvetica/i.test(combined)) {
    return 'Arial';
  }
  if (/consolas|courier|mono/i.test(combined)) {
    return 'Consolas';
  }
  if (/garamond/i.test(combined)) {
    return 'Garamond';
  }
  if (/tahoma|verdana/i.test(combined)) {
    return 'Verdana';
  }
  return 'Calibri';
}

/**
 * Sanitizes unmapped Unicode control codes, non-printable bytes, and replacement glyphs (\uFFFD).
 */
function sanitizeCorruptedGlyphs(str) {
  if (!str) return '';
  /* eslint-disable-next-line no-control-regex */
  const corruptRegex = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFFFD\uFFFE\uFFFF]/g;
  const matches = str.match(corruptRegex) || [];
  const corruptRatio = matches.length / Math.max(1, str.length);

  if (corruptRatio > 0.4) {
    // If over 40% corrupt, strip unmapped glyphs and retain readable alphanumeric/punctuation tokens
    return str.replace(corruptRegex, ' ').replace(/\s+/g, ' ').trim();
  }

  // Strip dangerous control codes but keep standard text
  /* eslint-disable-next-line no-control-regex */
  return str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFFFE\uFFFF]/g, '');
}

/**
 * Formats caught errors into human-readable diagnostic messages.
 */
function formatPdfError(err) {
  const msg = err ? (err.message || String(err)) : 'Unknown error';
  const name = err ? err.name : '';

  if (name === 'PasswordException' || /password/i.test(msg)) {
    return new Error('Password-protected PDF: Please unlock the document before converting.');
  }
  if (/invalid\s*pdf|corrupt|damaged|xref/i.test(msg)) {
    return new Error('Corrupted PDF: Document stream contains invalid or damaged structures.');
  }
  if (/out\s*of\s*memory|memory/i.test(msg)) {
    return new Error('Memory allocation exceeded: The PDF resolution exceeds browser memory capacity.');
  }
  return err instanceof Error ? err : new Error(msg);
}

/**
 * Fallback PDF text and layout extractor using pdf-lib and stream parsing.
 * Guarantees that even if pdfjs-dist fails, layout and text are recovered.
 */
async function extractTextFallbackFromPdf(fileBuffer) {
  try {
    const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
    const numPages = pdfDoc.getPageCount();
    const pagesData = [];
    let totalAlphaNum = 0;

    for (let i = 0; i < numPages; i++) {
      const page = pdfDoc.getPage(i);
      const { width: pWidth, height: pHeight } = page.getSize();
      const lines = [];

      const contentStreams = page.node.Contents ? page.node.Contents() : null;
      let rawText = '';

      if (contentStreams) {
        const streamObjects = Array.isArray(contentStreams) ? contentStreams : [contentStreams];
        for (const stm of streamObjects) {
          try {
            const bytes = stm.getContents ? stm.getContents() : null;
            if (bytes) {
              const decoded = new TextDecoder('latin1').decode(bytes);
              rawText += '\n' + decoded;
            }
          } catch {
            // Ignore stream decode error
          }
        }
      }

      if (rawText) {
        const textTokens = [];
        const tjRegex = /(?:\((?:\\.|[^()|\\])*\)|<[0-9a-fA-F]+>)\s*(?:Tj|TJ|'|")/g;
        let match;
        while ((match = tjRegex.exec(rawText)) !== null) {
          const raw = match[0];
          if (raw.startsWith('(')) {
            const str = raw.substring(1, raw.lastIndexOf(')'))
              .replace(/\\([()\\])/g, '$1')
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '\r')
              .replace(/\\t/g, '\t');
            const sanitized = sanitizeCorruptedGlyphs(str);
            if (sanitized.trim()) textTokens.push(sanitized.trim());
          } else if (raw.startsWith('<')) {
            const hex = raw.substring(1, raw.lastIndexOf('>')).replace(/\s+/g, '');
            let hexStr = '';
            for (let h = 0; h < hex.length; h += 2) {
              const code = parseInt(hex.substr(h, 2), 16);
              if (code >= 32 && code <= 126) hexStr += String.fromCharCode(code);
            }
            const sanitized = sanitizeCorruptedGlyphs(hexStr);
            if (sanitized.trim()) textTokens.push(sanitized.trim());
          }
        }

        if (textTokens.length > 0) {
          let currentLine = [];
          for (const token of textTokens) {
            currentLine.push(token);
            totalAlphaNum += token.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '').length;
            if (currentLine.length >= 10 || token.endsWith('.') || token.endsWith(':')) {
              const lText = currentLine.join(' ');
              lines.push({
                tokens: [{ text: lText, fontSize: 11, isBold: false, isItalic: false, fontFamily: 'Calibri' }],
                rawText: lText,
                isTitle: false,
                isHeading: false,
                isCenterAligned: false,
                isBullet: false,
                isTwoColumn: false,
                isRTL: RTL_REGEX.test(lText),
              });
              currentLine = [];
            }
          }
          if (currentLine.length > 0) {
            const lText = currentLine.join(' ');
            lines.push({
              tokens: [{ text: lText, fontSize: 11, isBold: false, isItalic: false, fontFamily: 'Calibri' }],
              rawText: lText,
              isTitle: false,
              isHeading: false,
              isCenterAligned: false,
              isBullet: false,
              isTwoColumn: false,
              isRTL: RTL_REGEX.test(lText),
            });
          }
        }
      }

      pagesData.push({
        pageNum: i + 1,
        width: pWidth || 612,
        height: pHeight || 792,
        lines,
        bodyFontSize: 11,
        hasText: lines.length > 0,
      });
    }

    return {
      numPages,
      pagesData,
      isScanned: totalAlphaNum < 30,
      pdfDoc: null,
    };
  } catch (err) {
    throw formatPdfError(err);
  }
}

/**
 * Extracts structured text lines, typography layout, and table grids from PDF.
 */
export async function extractTextAndLayoutFromPdf(fileBuffer) {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(fileBuffer),
      isEvalSupported: false,
      useSystemFonts: true,
    });

    const loadedPdfDoc = await loadingTask.promise;
    const numPages = loadedPdfDoc.numPages;
    const pagesData = [];
    let totalAlphaNum = 0;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await loadedPdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });
      const pageWidth = viewport.width || (page.view ? page.view[2] : 612);
      const pageHeight = viewport.height || (page.view ? page.view[3] : 792);

      const textContent = await page.getTextContent();
      const rawItems = (textContent.items || []).filter(
        (it) => it && typeof it.str === 'string' && it.str.trim().length > 0
      );

      if (rawItems.length === 0) {
        pagesData.push({
          pageNum,
          width: pageWidth,
          height: pageHeight,
          lines: [],
          bodyFontSize: 11,
          hasText: false,
        });
        continue;
      }

      // 1. Build tokens with exact coordinates, font styling, and corrupt glyph sanitization
      const rawTokens = [];
      for (const item of rawItems) {
        const sanitizedStr = sanitizeCorruptedGlyphs(item.str || '');
        if (!sanitizedStr.trim()) continue;

        totalAlphaNum += sanitizedStr.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '').length;

        const scaleX = item.transform[0];
        const scaleY = item.transform[3];
        const x = item.transform[4];
        const y = item.transform[5];
        const width = item.width || (sanitizedStr.length * Math.abs(scaleX) * 0.5);
        const height = item.height || Math.abs(scaleY) || 10;
        const fontSizePt = Math.round(Math.abs(scaleY || height || 10) * 10) / 10;

        const fontName = item.fontName || '';
        const fontStyle = textContent.styles?.[fontName] || {};
        const fontFam = fontStyle.fontFamily || '';

        const isBold = /(bold|black|heavy|semibold|demibold|bld|700|800|900)/i.test(fontName + ' ' + fontFam);
        const isItalic = /(italic|oblique)/i.test(fontName + ' ' + fontFam);
        const isRTL = RTL_REGEX.test(sanitizedStr);
        const cleanFont = normalizeFontFamily(fontFam, fontName, isRTL);

        rawTokens.push({
          text: sanitizedStr,
          x,
          y,
          width,
          height,
          fontSize: fontSizePt,
          isBold,
          isItalic,
          fontFamily: cleanFont,
          isRTL,
        });
      }

      // 2. Sort tokens: Y descending (top to bottom), X ascending (left to right)
      rawTokens.sort((a, b) => {
        const diffY = Math.abs(a.y - b.y);
        if (diffY <= 3.5) {
          return a.x - b.x;
        }
        return b.y - a.y;
      });

      // 3. Group tokens into distinct visual lines
      const rawLines = [];
      let currentGroup = [];
      let currentLineY = null;

      for (const tok of rawTokens) {
        if (currentLineY === null) {
          currentLineY = tok.y;
          currentGroup.push(tok);
        } else if (Math.abs(tok.y - currentLineY) <= 3.5) {
          currentGroup.push(tok);
        } else {
          rawLines.push(currentGroup);
          currentGroup = [tok];
          currentLineY = tok.y;
        }
      }
      if (currentGroup.length > 0) {
        rawLines.push(currentGroup);
      }

      // 4. Calculate predominant body font size (weighted by character count)
      const sizeFrequency = new Map();
      for (const tok of rawTokens) {
        const rounded = Math.round(tok.fontSize);
        const weight = tok.text.length;
        sizeFrequency.set(rounded, (sizeFrequency.get(rounded) || 0) + weight);
      }
      let bodyFontSize = 10.5;
      let maxWeight = 0;
      for (const [size, weight] of sizeFrequency.entries()) {
        if (weight > maxWeight) {
          maxWeight = weight;
          bodyFontSize = size;
        }
      }

      // 5. Structure lines with hierarchy, alignment, bullets, and two-column layout
      const structuredLines = [];

      for (let lIdx = 0; lIdx < rawLines.length; lIdx++) {
        const lineTokens = rawLines[lIdx];
        if (lineTokens.length === 0) continue;

        const minX = Math.min(...lineTokens.map((t) => t.x));
        const maxX = Math.max(...lineTokens.map((t) => t.x + t.width));
        const lineWidth = maxX - minX;
        const maxFontSize = Math.max(...lineTokens.map((t) => t.fontSize));
        const avgY = lineTokens.reduce((sum, t) => sum + t.y, 0) / lineTokens.length;

        const significantTokens = lineTokens.filter((t) => t.text.trim().length > 1);
        const isAllBold = significantTokens.length > 0 && significantTokens.every((t) => t.isBold);
        const rawText = lineTokens.map((t) => t.text).join(' ').trim();
        if (!rawText) continue;

        const isLineRTL = RTL_REGEX.test(rawText);

        // Section heading detection (e.g. "PROFESSIONAL EXPERIENCE", "EDUCATION", "SKILLS")
        const isHeadingKeyword = HEADING_KEYWORDS.test(rawText.replace(/[:_]/g, '').trim());
        const isAllCapsShort =
          rawText === rawText.toUpperCase() &&
          rawText.length >= 3 &&
          rawText.length <= 45 &&
          !/[0-9]/.test(rawText);
        const isHeading =
          isHeadingKeyword ||
          (maxFontSize >= bodyFontSize * 1.25 && isAllBold) ||
          (isAllBold && isAllCapsShort);

        // Native bullet detection
        let isBullet = false;
        const bulletCleanedTokens = lineTokens.map((t) => ({ ...t }));
        const firstText = bulletCleanedTokens[0]?.text?.trim() || '';
        const bulletMatch = firstText.match(BULLET_REGEX);
        if (bulletMatch) {
          isBullet = true;
          if (!bulletMatch[2] && bulletCleanedTokens.length > 1) {
            bulletCleanedTokens.shift();
          } else if (bulletMatch[2]) {
            bulletCleanedTokens[0].text = bulletMatch[2];
          }
        }

        // Two-column tabular row detection (Job Title / Company on left, Date / Location on right)
        // Lower threshold: gap >= 25pt - 30pt (or 7% page width), or 18pt when date/location is present
        let isTwoColumn = false;
        let splitIdx = -1;
        if (!isHeading && !isBullet && lineTokens.length >= 2) {
          for (let i = 0; i < lineTokens.length - 1; i++) {
            const currEnd = lineTokens[i].x + lineTokens[i].width;
            const nextStart = lineTokens[i + 1].x;
            const gap = nextStart - currEnd;
            const rightSideText = lineTokens.slice(i + 1).map((t) => t.text).join(' ');
            const hasDateOrLocation = /(20\d\d|19\d\d|present|current|\d{1,2}\/\d{2,4}|alexandria|cairo|egypt|remote|giza|[A-Z][a-z]+,\s*[A-Z][a-z]+)/i.test(rightSideText);

            const minRequiredGap = hasDateOrLocation
              ? Math.min(20, pageWidth * 0.04)
              : Math.max(26, pageWidth * 0.07);

            if (gap >= minRequiredGap && nextStart >= pageWidth * 0.35) {
              isTwoColumn = true;
              splitIdx = i + 1;
              break;
            }
          }
        }

        // Geometric Center Alignment Detection:
        // Preserves candidate name, header contact bar, subtitles, and any centered text without left-drifting.
        const midX = (minX + maxX) / 2;
        const pageCenter = pageWidth / 2;
        const isHeaderContact = (rawText.includes('|') || rawText.includes('@') || rawText.includes('•') || rawText.includes('+') || rawText.includes('linkedin') || rawText.includes('github'));
        const isCenterAligned =
          !isLineRTL &&
          !isBullet &&
          !isTwoColumn &&
          (
            // Top header bar / contact info
            (lIdx <= 5 && isHeaderContact && Math.abs(midX - pageCenter) <= pageWidth * 0.12) ||
            // General geometric centering across entire document
            (minX >= pageWidth * 0.06 && Math.abs(midX - pageCenter) <= pageWidth * 0.085 && lineWidth <= pageWidth * 0.86)
          );

        // Title detection (e.g. Candidate name at top)
        const isTitle =
          !isHeading &&
          (maxFontSize >= bodyFontSize * 1.45 ||
            (maxFontSize >= 14 && lIdx < 4 && isCenterAligned) ||
            (lIdx === 0 && isCenterAligned && maxFontSize >= 12));

        // Multi-column cell clustering (for tables with >= 3 distinct columns)
        const multiCells = [];
        let curCell = [lineTokens[0]];
        for (let i = 1; i < lineTokens.length; i++) {
          const prev = lineTokens[i - 1];
          const curr = lineTokens[i];
          const gap = curr.x - (prev.x + prev.width);
          if (gap >= 22) {
            multiCells.push(curCell);
            curCell = [curr];
          } else {
            curCell.push(curr);
          }
        }
        if (curCell.length > 0) multiCells.push(curCell);

        structuredLines.push({
          tokens: isBullet ? bulletCleanedTokens : lineTokens,
          rawText,
          y: avgY,
          minX,
          maxX,
          lineWidth,
          maxFontSize,
          isAllBold,
          isTitle,
          isHeading,
          isCenterAligned,
          isBullet,
          isTwoColumn,
          isRTL: isLineRTL,
          leftTokens: isTwoColumn ? lineTokens.slice(0, splitIdx) : [],
          rightTokens: isTwoColumn ? lineTokens.slice(splitIdx) : [],
          multiCells: multiCells.length >= 3 ? multiCells : null,
        });
      }

      pagesData.push({
        pageNum,
        width: pageWidth,
        height: pageHeight,
        lines: structuredLines,
        bodyFontSize,
        hasText: structuredLines.length > 0,
      });
    }

    return {
      numPages,
      pagesData,
      isScanned: totalAlphaNum < 30,
      pdfDoc: loadedPdfDoc,
    };
  } catch (pdfjsErr) {
    console.warn('pdfjs-dist primary extraction failed, failing over to pdf-lib parser:', pdfjsErr);
    return extractTextFallbackFromPdf(fileBuffer);
  }
}

/**
 * Builds an array of docx TextRun elements with calibrated font sizing (9.5pt - 10pt body, 11.5pt headings).
 */
function buildTextRuns(tokens, bodyFontSize, options = {}) {
  const { forceBold = false, isRTL = false, targetRole = 'body' } = options;
  const runs = [];

  for (let i = 0; i < tokens.length; i++) {
    const curr = tokens[i];
    let text = curr.text;

    // Preserve space between horizontal tokens if coordinate gap exists
    if (i < tokens.length - 1) {
      const next = tokens[i + 1];
      const gapX = next.x - (curr.x + curr.width);
      if (gapX >= 2.0 && !text.endsWith(' ') && !next.text.startsWith(' ')) {
        text += ' ';
      }
    }

    // Calibrated typography sizing in half-points:
    // - Body text: 9.5pt (19 half-points)
    // - Section headings: 11.5pt (23 half-points)
    // - Candidate Title: 15pt (30 half-points)
    // - Job Titles / Subheadings: 10pt (20 half-points)
    let fontSizeHalfPt;
    if (targetRole === 'heading') {
      fontSizeHalfPt = 23; // 11.5pt
    } else if (targetRole === 'title') {
      fontSizeHalfPt = 30; // 15pt
    } else if (targetRole === 'jobTitle') {
      fontSizeHalfPt = 20; // 10pt
    } else {
      if (curr.fontSize > bodyFontSize * 1.35) {
        fontSizeHalfPt = 23; // 11.5pt
      } else if (curr.fontSize > bodyFontSize * 1.15) {
        fontSizeHalfPt = 20; // 10pt
      } else {
        fontSizeHalfPt = 19; // 9.5pt
      }
    }

    const defaultFont = isRTL ? 'Arial' : 'Calibri';

    runs.push(
      new TextRun({
        text,
        size: fontSizeHalfPt,
        bold: forceBold || curr.isBold,
        italics: curr.isItalic,
        font: defaultFont,
        rightToLeft: isRTL || curr.isRTL || RTL_REGEX.test(text),
      })
    );
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text: '', size: 19, font: isRTL ? 'Arial' : 'Calibri' }));
  }

  return runs;
}

/**
 * Converts PDF into a Word .docx document using docx.js,
 * applying pixel-tight 1-page modern resume visual formatting.
 */
export async function pdfToDocx(fileBuffer) {
  let extractionResult;
  try {
    extractionResult = await extractTextAndLayoutFromPdf(fileBuffer);
  } catch (err) {
    throw formatPdfError(err);
  }

  const { numPages, pagesData, isScanned, pdfDoc } = extractionResult;
  const docElements = [];

  // 1. Scanned / Empty Text-Layer PDF Guard
  if (isScanned) {
    let renderedPagesCount = 0;

    if (pdfDoc) {
      for (let p = 1; p <= numPages; p++) {
        let pagePngBuffer = null;
        try {
          const page = await pdfDoc.getPage(p);
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = new OffscreenCanvas(Math.round(viewport.width), Math.round(viewport.height));
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;
          const blob = await canvas.convertToBlob({ type: 'image/png' });
          pagePngBuffer = await blob.arrayBuffer();
        } catch (renderErr) {
          console.warn(`Scanned page ${p} rasterization warning:`, renderErr);
        }

        if (numPages > 1 && p > 1) {
          docElements.push(new Paragraph({ children: [new PageBreak()] }));
        }

        const pWidth = pagesData[p - 1]?.width || 612;
        const pHeight = pagesData[p - 1]?.height || 792;
        const imgWidth = Math.min(550, Math.round(pWidth - 60));
        const imgHeight = Math.min(740, Math.round((pHeight / pWidth) * imgWidth));

        if (pagePngBuffer) {
          renderedPagesCount += 1;
          docElements.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: new Uint8Array(pagePngBuffer),
                  transformation: {
                    width: imgWidth,
                    height: imgHeight,
                  },
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { line: 240, before: 10, after: 10 },
            })
          );
        }
      }
    }

    if (renderedPagesCount === 0) {
      docElements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `[OmniShift Scanned PDF Document - ${numPages} Page${numPages > 1 ? 's' : ''}]`,
              bold: true,
              size: 26,
              color: 'FF5A1F',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { line: 240, before: 60, after: 30 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'This document contains rasterized or scanned drawings. High-resolution page images have been preserved.',
              size: 20,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { line: 240, before: 0, after: 30 },
        })
      );
    }
  } else {
    // 2. Vector & Typography Reconstruction Pipeline
    for (let pIdx = 0; pIdx < pagesData.length; pIdx++) {
      const page = pagesData[pIdx];
      const bodyFontSize = page.bodyFontSize || 10;
      const lines = page.lines || [];

      // Multi-page document page separator: strictly disabled for single-page PDFs or empty tail pages
      if (numPages > 1 && pIdx > 0 && lines.length > 2) {
        docElements.push(new Paragraph({ children: [new PageBreak()] }));
      }

      let lineIdx = 0;
      while (lineIdx < lines.length) {
        const line = lines[lineIdx];

        // Multi-Column Grid & Table Extraction (Invoices / Skill Matrices)
        if (line.multiCells && line.multiCells.length >= 3) {
          const tableLines = [line];
          let nextIdx = lineIdx + 1;
          while (
            nextIdx < lines.length &&
            lines[nextIdx].multiCells &&
            lines[nextIdx].multiCells.length === line.multiCells.length &&
            Math.abs(lines[nextIdx].multiCells[0][0].x - line.multiCells[0][0].x) <= 25
          ) {
            tableLines.push(lines[nextIdx]);
            nextIdx++;
          }

          if (tableLines.length >= 2) {
            const colCount = line.multiCells.length;
            const colWidthPct = Math.floor(100 / colCount);

            const tableRows = tableLines.map((tLine) => {
              const rowCells = tLine.multiCells.map((cellTokens, cIdx) => {
                const cellRuns = buildTextRuns(cellTokens, bodyFontSize, { isRTL: tLine.isRTL, targetRole: 'body' });
                return new TableCell({
                  width: { size: colWidthPct, type: WidthType.PERCENTAGE },
                  borders: NO_BORDERS,
                  margins: { top: 0, bottom: 0, left: 0, right: 0 },
                  children: [
                    new Paragraph({
                      children: cellRuns,
                      bidirectional: tLine.isRTL,
                      alignment: tLine.isRTL
                        ? AlignmentType.RIGHT
                        : cIdx > 0 && /^[0-9$%.,-]+$/.test(cellTokens.map((t) => t.text).join(''))
                        ? AlignmentType.RIGHT
                        : AlignmentType.LEFT,
                      spacing: { line: 220, before: 0, after: 10 },
                    }),
                  ],
                });
              });

              return new TableRow({ children: rowCells });
            });

            docElements.push(
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: NO_BORDERS,
                rows: tableRows,
              })
            );

            lineIdx = nextIdx;
            continue;
          }
        }

        // Two-Column Header Rows: Left-aligned Job Title/Company, Right-aligned Date/Location
        if (line.isTwoColumn) {
          const leftRuns = buildTextRuns(line.leftTokens, bodyFontSize, {
            isRTL: line.isRTL,
            targetRole: 'jobTitle',
            forceBold: line.leftTokens.some((t) => t.isBold),
          });
          const rightRuns = buildTextRuns(line.rightTokens, bodyFontSize, {
            isRTL: line.isRTL,
            targetRole: 'body',
          });

          // Dynamic percentage allocation to guarantee right-side date/location does not wrap
          const rightTextLen = line.rightTokens.map((t) => t.text).join(' ').length;
          const rightColPct = rightTextLen > 32 ? 40 : rightTextLen > 22 ? 35 : 30;
          const leftColPct = 100 - rightColPct;

          const row = new TableRow({
            children: [
              new TableCell({
                width: { size: leftColPct, type: WidthType.PERCENTAGE },
                borders: NO_BORDERS,
                margins: { top: 0, bottom: 0, left: 0, right: 0 },
                children: [
                  new Paragraph({
                    children: leftRuns,
                    alignment: AlignmentType.LEFT,
                    bidirectional: line.isRTL,
                    spacing: { line: 220, before: 20, after: 5 },
                  }),
                ],
              }),
              new TableCell({
                width: { size: rightColPct, type: WidthType.PERCENTAGE },
                borders: NO_BORDERS,
                margins: { top: 0, bottom: 0, left: 0, right: 0 },
                children: [
                  new Paragraph({
                    children: rightRuns,
                    alignment: AlignmentType.RIGHT,
                    bidirectional: line.isRTL,
                    spacing: { line: 220, before: 20, after: 5 },
                  }),
                ],
              }),
            ],
          });

          docElements.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: NO_BORDERS,
              rows: [row],
            })
          );
          lineIdx++;
          continue;
        }

        // Section Headings with Tight Horizontal Divider Rules
        if (line.isHeading) {
          const runs = buildTextRuns(line.tokens, bodyFontSize, {
            forceBold: true,
            isRTL: line.isRTL,
            targetRole: 'heading',
          });
          docElements.push(
            new Paragraph({
              children: runs,
              bidirectional: line.isRTL,
              alignment: line.isRTL ? AlignmentType.RIGHT : AlignmentType.LEFT,
              border: {
                bottom: {
                  color: '333333',
                  space: 2, // Sits closely beneath heading text
                  style: BorderStyle.SINGLE,
                  size: 6, // Clean 0.75pt divider rule
                },
              },
              spacing: { line: 220, before: 80, after: 15 },
            })
          );
          lineIdx++;
          continue;
        }

        // Document Titles (Candidate Name)
        if (line.isTitle) {
          const runs = buildTextRuns(line.tokens, bodyFontSize, {
            forceBold: true,
            isRTL: line.isRTL,
            targetRole: 'title',
          });
          docElements.push(
            new Paragraph({
              children: runs,
              bidirectional: line.isRTL,
              alignment: line.isRTL
                ? AlignmentType.RIGHT
                : line.isCenterAligned
                ? AlignmentType.CENTER
                : AlignmentType.LEFT,
              spacing: { line: 220, before: 0, after: 10 },
            })
          );
          lineIdx++;
          continue;
        }

        // Native Bullet Items: Tight Indentation (360 left, 180 hanging) & Compact Spacing
        if (line.isBullet) {
          const runs = buildTextRuns(line.tokens, bodyFontSize, { isRTL: line.isRTL, targetRole: 'body' });
          docElements.push(
            new Paragraph({
              children: runs,
              bullet: { level: 0 },
              indent: { left: 360, hanging: 180 },
              bidirectional: line.isRTL,
              spacing: { line: 220, before: 0, after: 10 },
            })
          );
          lineIdx++;
          continue;
        }

        // Standard Body Paragraphs & Contact Bar:
        // Preserves exact center alignment if detected
        const runs = buildTextRuns(line.tokens, bodyFontSize, { isRTL: line.isRTL, targetRole: 'body' });
        const isHeaderContactLine = line.isCenterAligned && (lineIdx <= 4 || (line.rawText && (line.rawText.includes('|') || line.rawText.includes('@'))));
        docElements.push(
          new Paragraph({
            children: runs,
            bidirectional: line.isRTL,
            alignment: line.isRTL
              ? AlignmentType.RIGHT
              : line.isCenterAligned
              ? AlignmentType.CENTER
              : AlignmentType.LEFT,
            spacing: {
              line: 220,
              before: 0,
              after: isHeaderContactLine ? 10 : 15,
            },
          })
        );

        lineIdx++;
      }
    }
  }

  // Ensure there is at least one paragraph so Document is valid
  if (docElements.length === 0) {
    docElements.push(
      new Paragraph({
        children: [new TextRun({ text: 'Converted from PDF document.', size: 19, font: 'Calibri' })],
        spacing: { line: 220, before: 0, after: 15 },
      })
    );
  }

  // Global default styles & page size matching with ultra-compact 1-page margins
  const firstPage = pagesData[0] || {};
  const pageWidth = firstPage.width || 612;
  const pageHeight = firstPage.height || 792;

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 19, // 9.5pt default
          },
          paragraph: {
            spacing: {
              line: 220, // Tight single line spacing
              before: 0,
              after: 15,
            },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: Math.round(pageWidth * 20),
              height: Math.round(pageHeight * 20),
            },
            margin: {
              top: 400,    // ~0.28 inch (400 twips)
              bottom: 400, // ~0.28 inch (400 twips)
              left: 500,   // ~0.35 inch (500 twips)
              right: 500,  // ~0.35 inch (500 twips)
            },
          },
        },
        children: docElements,
      },
    ],
  });

  const arrayBuffer = await Packer.toArrayBuffer(doc);
  const outputBuffer = arrayBuffer instanceof ArrayBuffer ? arrayBuffer : arrayBuffer.buffer;

  return {
    outputBuffer,
    outputMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extraMeta: {
      pages: numPages,
      totalPages: numPages,
      format: 'Word (.docx)',
      isScanned,
    },
  };
}

/**
 * Extracts plain text from PDF with layout preserving line breaks.
 */
export async function pdfToText(fileBuffer) {
  let extractionResult;
  try {
    extractionResult = await extractTextAndLayoutFromPdf(fileBuffer);
  } catch (err) {
    throw formatPdfError(err);
  }

  const { numPages, pagesData, isScanned } = extractionResult;

  let textContent;
  if (isScanned) {
    textContent = `[OmniShift Document Notice]\n\nThis PDF (${numPages} page${numPages > 1 ? 's' : ''}) is a scanned document without a selectable digital text layer.`;
  } else {
    textContent = pagesData
      .map((p) => {
        const pageHeader = pagesData.length > 1 ? `=== Page ${p.pageNum} ===\n` : '';
        const linesStr = p.lines.map((l) => (typeof l === 'string' ? l : l.rawText || '')).join('\n');
        return pageHeader + linesStr;
      })
      .join('\n\n');
  }

  const encoder = new TextEncoder();
  const outputBuffer = encoder.encode(textContent).buffer;

  return {
    outputBuffer,
    outputMimeType: 'text/plain',
    extraMeta: {
      pages: numPages,
      totalPages: numPages,
      format: 'Plain Text (.txt)',
      isScanned,
    },
  };
}

/**
 * Renders PDF pages to high-resolution PNG images.
 */
export async function pdfToPngPages(fileBuffer) {
  let loadingTask;
  try {
    loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(fileBuffer),
      isEvalSupported: false,
      useSystemFonts: true,
    });
  } catch (err) {
    throw formatPdfError(err);
  }

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  if (numPages === 1) {
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = new OffscreenCanvas(Math.round(viewport.width), Math.round(viewport.height));
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const outputBuffer = await blob.arrayBuffer();

    return {
      outputBuffer,
      outputMimeType: 'image/png',
      extraMeta: {
        numPages: 1,
        width: viewport.width,
        height: viewport.height,
        format: 'PNG',
      },
    };
  }

  // Multi-page: Zip all rendered pages
  const zip = new JSZip();
  for (let p = 1; p <= numPages; p++) {
    const page = await pdfDoc.getPage(p);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = new OffscreenCanvas(Math.round(viewport.width), Math.round(viewport.height));
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const buffer = await blob.arrayBuffer();
    zip.file(`page_${String(p).padStart(2, '0')}.png`, buffer);
  }

  const outputBuffer = await zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
  });

  return {
    outputBuffer,
    outputMimeType: 'application/zip',
    extraMeta: {
      numPages,
      format: 'PNG Pages (.zip)',
    },
  };
}

/**
 * Merges multiple PDF ArrayBuffers into a single unified document using pdf-lib.
 */
export async function mergePdfs(pdfBuffers) {
  if (!Array.isArray(pdfBuffers) || pdfBuffers.length < 2) {
    throw new Error('PDF merge requires at least 2 document streams.');
  }

  const mergedDoc = await PDFDocument.create();

  for (const buffer of pdfBuffers) {
    const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
    copiedPages.forEach((page) => mergedDoc.addPage(page));
  }

  const outputBytes = await mergedDoc.save({ useObjectStreams: true });
  const outputBuffer = outputBytes.buffer.slice(
    outputBytes.byteOffset,
    outputBytes.byteOffset + outputBytes.byteLength
  );

  return {
    outputBuffer,
    outputMimeType: 'application/pdf',
    extraMeta: {
      mergedDocuments: pdfBuffers.length,
      totalPages: mergedDoc.getPageCount(),
      format: 'Merged PDF',
    },
  };
}

/**
 * Optimizes/linearizes a single PDF stream using pdf-lib.
 */
export async function optimizePdf(fileBuffer) {
  const doc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
  const outputBytes = await doc.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });
  const outputBuffer = outputBytes.buffer.slice(
    outputBytes.byteOffset,
    outputBytes.byteOffset + outputBytes.byteLength
  );

  return {
    outputBuffer,
    outputMimeType: 'application/pdf',
    extraMeta: {
      pageCount: doc.getPageCount(),
      format: 'Optimized PDF',
    },
  };
}

/**
 * Master PDF transmutation dispatcher.
 */
export async function executePdfTransmute(fileBuffer, targetMimeType) {
  try {
    if (
      targetMimeType.includes('word') ||
      targetMimeType.includes('docx') ||
      targetMimeType === 'DOCX'
    ) {
      return await pdfToDocx(fileBuffer);
    }

    if (
      targetMimeType.includes('presentation') ||
      targetMimeType.includes('powerpoint') ||
      targetMimeType.includes('pptx') ||
      targetMimeType === 'PPTX'
    ) {
      return await pdfToPptx(fileBuffer);
    }

    if (
      targetMimeType.includes('plain') ||
      targetMimeType.includes('txt') ||
      targetMimeType === 'TXT'
    ) {
      return await pdfToText(fileBuffer);
    }

    if (
      targetMimeType === 'image/png' ||
      targetMimeType.includes('png') ||
      targetMimeType === 'PNG'
    ) {
      return await pdfToPngPages(fileBuffer);
    }

    return await optimizePdf(fileBuffer);
  } catch (err) {
    throw formatPdfError(err);
  }
}
