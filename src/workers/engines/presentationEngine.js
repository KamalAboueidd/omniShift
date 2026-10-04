import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  PageBreak,
  ImageRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from 'docx';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Configure pdfjs worker URL safely for Web Worker and Window contexts
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
 * Enterprise Zero-Server PowerPoint (.pptx) Conversion Engine
 * Converts PPTX presentations entirely in-memory client-side into:
 * 1. Word Document (.docx): Structured slide headings, bullet hierarchy, images, and speaker notes.
 * 2. PDF Document (.pdf): Sequential styled 16:9 landscape slide pages via pdf-lib.
 * 3. Extract Slide Images (.zip / single image): Extracts embedded media directly from ppt/media/.
 * 4. Plain Text (.txt): Clean slide-by-slide transcript.
 */

const BULLET_REGEX = /^([•\-*▪▸►◦–—]|\u2022|\u25E6|\u25AA|\u2013|\u2014|\u25BA)\s*(.*)$/;

/**
 * Detects legacy binary PowerPoint (.ppt) files using CFBF magic bytes or extension.
 */
export function isLegacyPpt(fileBuffer, fileName = '') {
  const lowerName = (fileName || '').toLowerCase();
  if (lowerName.endsWith('.ppt') && !lowerName.endsWith('.pptx')) {
    return true;
  }
  if (fileBuffer && fileBuffer.byteLength >= 8) {
    const u8 = new Uint8Array(fileBuffer, 0, 8);
    // Compound File Binary Format magic: 0xD0 0xCF 0x11 0xE0 0xA1 0xB1 0x1A 0xE1
    if (u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0) {
      return true;
    }
  }
  return false;
}

/**
 * Parses an XML string into a DOM Document across Worker and Window contexts.
 */
function parseXmlDocument(xmlStr) {
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'application/xml');
      const err = doc.querySelector('parsererror');
      if (!err) return doc;
    } catch {
      // Fallback
    }
  }
  return null;
}

/**
 * Namespace-agnostic element query helper for OpenXML DOM trees.
 */
function getElementsByLocalName(node, localName) {
  if (!node) return [];
  if (typeof node.getElementsByTagNameNS === 'function') {
    try {
      const list = node.getElementsByTagNameNS('*', localName);
      if (list && list.length > 0) return Array.from(list);
    } catch {
      // Ignore namespace query error
    }
  }
  if (typeof node.getElementsByTagName === 'function') {
    const listP = node.getElementsByTagName(`p:${localName}`);
    if (listP && listP.length > 0) return Array.from(listP);
    const listA = node.getElementsByTagName(`a:${localName}`);
    if (listA && listA.length > 0) return Array.from(listA);
    const listBare = node.getElementsByTagName(localName);
    if (listBare && listBare.length > 0) return Array.from(listBare);
  }
  return [];
}

/**
 * Extracts embedded media relationships from a slide's .rels XML.
 */
function parseSlideRelationships(relsXml) {
  const relsMap = new Map();
  if (!relsXml) return relsMap;

  const doc = parseXmlDocument(relsXml);
  if (doc) {
    const relNodes = getElementsByLocalName(doc, 'Relationship');
    for (const r of relNodes) {
      const id = r.getAttribute('Id') || '';
      const type = r.getAttribute('Type') || '';
      const target = r.getAttribute('Target') || '';
      if (id && target) {
        relsMap.set(id, { type, target });
      }
    }
    return relsMap;
  }

  // Regex fallback for relationships
  const relRegex = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Type="([^"]+)"[^>]*Target="([^"]+)"/g;
  let match;
  while ((match = relRegex.exec(relsXml)) !== null) {
    relsMap.set(match[1], { type: match[2], target: match[3] });
  }
  return relsMap;
}

/**
 * Unpacks and parses PPTX archive into structured slide representations.
 */
export async function parsePptx(fileBuffer, fileName = '') {
  if (isLegacyPpt(fileBuffer, fileName)) {
    throw new Error('Legacy .ppt binary format detected. Please save as modern .pptx to convert client-side.');
  }

  let zip;
  try {
    zip = await JSZip.loadAsync(fileBuffer);
  } catch (err) {
    if (isLegacyPpt(fileBuffer, fileName) || (fileName || '').toLowerCase().endsWith('.ppt')) {
      throw new Error('Legacy .ppt binary format detected. Please save as modern .pptx to convert client-side.', { cause: err });
    }
    throw new Error(`Corrupted PowerPoint archive: Unable to unpack .pptx file (${err.message}).`, { cause: err });
  }

  const presXmlFile = zip.file('ppt/presentation.xml');
  if (!presXmlFile) {
    throw new Error('Invalid PowerPoint archive: ppt/presentation.xml not found.');
  }

  // 1. Identify slide sequence from presentation.xml.rels or fallback natural ordering
  const slideOrder = [];
  const presRelsFile = zip.file('ppt/_rels/presentation.xml.rels');
  if (presRelsFile) {
    const presRelsXml = await presRelsFile.async('string');
    const relsMap = parseSlideRelationships(presRelsXml);
    const presXml = await presXmlFile.async('string');
    const sldIdRegex = /<p:sldId\b[^>]*r:id="([^"]+)"/g;
    let match;
    while ((match = sldIdRegex.exec(presXml)) !== null) {
      const rId = match[1];
      const relInfo = relsMap.get(rId);
      if (relInfo && relInfo.target) {
        const cleanPath = relInfo.target.startsWith('slides/')
          ? `ppt/${relInfo.target}`
          : `ppt/slides/${relInfo.target.replace(/^\.\.\/slides\//, '')}`;
        slideOrder.push(cleanPath);
      }
    }
  }

  // Fallback: enumerate and numerically sort ppt/slides/slide{N}.xml
  if (slideOrder.length === 0) {
    const slideFiles = [];
    zip.forEach((relativePath) => {
      if (/^ppt\/slides\/slide\d+\.xml$/i.test(relativePath)) {
        slideFiles.push(relativePath);
      }
    });
    slideFiles.sort((a, b) => {
      const numA = parseInt((a.match(/slide(\d+)\.xml/i) || [])[1] || '0', 10);
      const numB = parseInt((b.match(/slide(\d+)\.xml/i) || [])[1] || '0', 10);
      return numA - numB;
    });
    slideOrder.push(...slideFiles);
  }

  if (slideOrder.length === 0) {
    throw new Error('Presentation archive does not contain any slide descriptors.');
  }

  const slides = [];

  for (let sIdx = 0; sIdx < slideOrder.length; sIdx++) {
    const slidePath = slideOrder[sIdx];
    const slideFile = zip.file(slidePath);
    if (!slideFile) continue;

    const slideNum = sIdx + 1;
    const slideXml = await slideFile.async('string');

    // Parse slide relationships for media & notes
    const slideRelsPath = slidePath.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
    const slideRelsFile = zip.file(slideRelsPath);
    const relsMap = slideRelsFile ? parseSlideRelationships(await slideRelsFile.async('string')) : new Map();

    // 2. Extract speaker notes if available
    let speakerNotes = '';
    for (const [, rel] of relsMap.entries()) {
      if (rel.type && rel.type.includes('notesSlide')) {
        const notesPath = rel.target.startsWith('../')
          ? `ppt/${rel.target.replace(/^\.\.\//, '')}`
          : `ppt/notesSlides/${rel.target}`;
        const notesFile = zip.file(notesPath);
        if (notesFile) {
          const notesXml = await notesFile.async('string');
          const notesDoc = parseXmlDocument(notesXml);
          if (notesDoc) {
            const spList = getElementsByLocalName(notesDoc, 'sp');
            for (const sp of spList) {
              const phNodes = getElementsByLocalName(sp, 'ph');
              const phType = phNodes[0]?.getAttribute('type') || '';
              if (phType === 'sldNum' || phType === 'sldImg') continue;
              const textNodes = getElementsByLocalName(sp, 't');
              const spText = textNodes.map((t) => t.textContent || '').join(' ').trim();
              if (spText) speakerNotes += (speakerNotes ? '\n' : '') + spText;
            }
          } else {
            // Regex fallback for notes
            const tRegex = /<a:t\b[^>]*>([^<]+)<\/a:t>/g;
            let tm;
            const tokens = [];
            while ((tm = tRegex.exec(notesXml)) !== null) {
              if (tm[1].trim()) tokens.push(tm[1].trim());
            }
            speakerNotes = tokens.join(' ');
          }
        }
        break;
      }
    }

    // 3. Extract embedded pictures on this slide
    const slideImages = [];
    for (const [rId, rel] of relsMap.entries()) {
      if (rel.type && rel.type.includes('image')) {
        const mediaPath = rel.target.startsWith('../')
          ? `ppt/${rel.target.replace(/^\.\.\//, '')}`
          : `ppt/media/${rel.target}`;
        const mediaFile = zip.file(mediaPath);
        if (mediaFile) {
          try {
            const imgBuffer = await mediaFile.async('arraybuffer');
            const lowerMedia = mediaPath.toLowerCase();
            let mime = 'image/png';
            if (lowerMedia.endsWith('.jpg') || lowerMedia.endsWith('.jpeg')) mime = 'image/jpeg';
            else if (lowerMedia.endsWith('.webp')) mime = 'image/webp';
            else if (lowerMedia.endsWith('.gif')) mime = 'image/gif';
            else if (lowerMedia.endsWith('.svg')) mime = 'image/svg+xml';

            slideImages.push({
              rId,
              path: mediaPath,
              buffer: imgBuffer,
              mime,
              widthPt: 450,
              heightPt: 280,
            });
          } catch {
            // Ignore single image decompression error
          }
        }
      }
    }

    // 4. Parse shape tree and extract text containers with coordinates
    const slideDoc = parseXmlDocument(slideXml);
    const textContainers = [];

    if (slideDoc) {
      const spNodes = getElementsByLocalName(slideDoc, 'sp');
      for (const sp of spNodes) {
        // Coordinate extraction (y position in EMUs, 12700 EMUs = 1 pt)
        const offNodes = getElementsByLocalName(sp, 'off');
        const y = offNodes[0] ? parseInt(offNodes[0].getAttribute('y') || '0', 10) : 0;
        const x = offNodes[0] ? parseInt(offNodes[0].getAttribute('x') || '0', 10) : 0;

        // Placeholder classification
        const phNodes = getElementsByLocalName(sp, 'ph');
        const phType = phNodes[0]?.getAttribute('type') || '';
        const isTitlePlaceholder = phType === 'title' || phType === 'ctrTitle';
        const isSubtitlePlaceholder = phType === 'subTitle';
        const isBodyPlaceholder = phType === 'body';

        // Extract paragraphs inside txBody
        const txBodyNodes = getElementsByLocalName(sp, 'txBody');
        if (txBodyNodes.length === 0) continue;

        const pNodes = getElementsByLocalName(txBodyNodes[0], 'p');
        const containerParagraphs = [];

        for (const pNode of pNodes) {
          const pPrNodes = getElementsByLocalName(pNode, 'pPr');
          let level = 0;
          let isBullet = false;

          if (pPrNodes.length > 0) {
            level = parseInt(pPrNodes[0].getAttribute('lvl') || '0', 10);
            const hasBuChar = getElementsByLocalName(pPrNodes[0], 'buChar').length > 0;
            const hasBuAuto = getElementsByLocalName(pPrNodes[0], 'buAutoNum').length > 0;
            const hasBuNone = getElementsByLocalName(pPrNodes[0], 'buNone').length > 0;

            if (hasBuNone) {
              isBullet = false;
            } else if (hasBuChar || hasBuAuto || (isBodyPlaceholder && level >= 0)) {
              isBullet = true;
            }
          }

          const rNodes = getElementsByLocalName(pNode, 'r');
          const runs = [];
          for (const r of rNodes) {
            const tNode = getElementsByLocalName(r, 't')[0];
            const text = tNode ? tNode.textContent || '' : '';
            if (!text) continue;

            const rPr = getElementsByLocalName(r, 'rPr')[0];
            const isBold = rPr ? (rPr.getAttribute('b') === '1' || rPr.getAttribute('b') === 'true') : false;
            const isItalic = rPr ? (rPr.getAttribute('i') === '1' || rPr.getAttribute('i') === 'true') : false;
            const sz = rPr ? parseInt(rPr.getAttribute('sz') || '0', 10) : 0;

            runs.push({
              text,
              isBold,
              isItalic,
              fontSizePt: sz ? Math.round(sz / 100) : 12,
            });
          }

          const rawText = runs.map((r) => r.text).join('').trim();
          if (!rawText) continue;

          // Check for bullet character in text
          let cleanedText = rawText;
          const bulletMatch = rawText.match(BULLET_REGEX);
          if (bulletMatch) {
            isBullet = true;
            cleanedText = bulletMatch[2].trim();
            if (runs.length > 0 && runs[0].text.match(BULLET_REGEX)) {
              runs[0].text = runs[0].text.replace(BULLET_REGEX, '$2').trim();
            }
          }

          containerParagraphs.push({
            text: cleanedText,
            rawText,
            runs,
            isBullet,
            level,
          });
        }

        if (containerParagraphs.length > 0) {
          textContainers.push({
            y,
            x,
            isTitlePlaceholder,
            isSubtitlePlaceholder,
            isBodyPlaceholder,
            paragraphs: containerParagraphs,
          });
        }
      }

      // Also extract tables from graphicFrames if present
      const tableNodes = getElementsByLocalName(slideDoc, 'tbl');
      for (const tbl of tableNodes) {
        const rows = getElementsByLocalName(tbl, 'tr');
        for (const row of rows) {
          const cells = getElementsByLocalName(row, 'tc');
          const cellTexts = [];
          for (const cell of cells) {
            const tNodes = getElementsByLocalName(cell, 't');
            const cellText = tNodes.map((t) => t.textContent || '').join(' ').trim();
            if (cellText) cellTexts.push(cellText);
          }
          if (cellTexts.length > 0) {
            textContainers.push({
              y: 9999999, // Append tables toward the bottom
              x: 0,
              isTitlePlaceholder: false,
              isSubtitlePlaceholder: false,
              isBodyPlaceholder: true,
              paragraphs: [{
                text: cellTexts.join('  |  '),
                rawText: cellTexts.join('  |  '),
                runs: [{ text: cellTexts.join('  |  '), isBold: false, isItalic: false }],
                isBullet: false,
                level: 0,
              }],
            });
          }
        }
      }
    } else {
      // Regex fallback text extraction
      const tRegex = /<a:t\b[^>]*>([^<]+)<\/a:t>/g;
      const tokens = [];
      let tm;
      while ((tm = tRegex.exec(slideXml)) !== null) {
        if (tm[1].trim()) tokens.push(tm[1].trim());
      }
      if (tokens.length > 0) {
        textContainers.push({
          y: 0,
          x: 0,
          isTitlePlaceholder: true,
          isSubtitlePlaceholder: false,
          isBodyPlaceholder: false,
          paragraphs: [{
            text: tokens[0],
            rawText: tokens[0],
            runs: [{ text: tokens[0], isBold: true, isItalic: false }],
            isBullet: false,
            level: 0,
          }],
        });
        if (tokens.length > 1) {
          textContainers.push({
            y: 100,
            x: 0,
            isTitlePlaceholder: false,
            isSubtitlePlaceholder: false,
            isBodyPlaceholder: true,
            paragraphs: tokens.slice(1).map((tok) => ({
              text: tok,
              rawText: tok,
              runs: [{ text: tok, isBold: false, isItalic: false }],
              isBullet: true,
              level: 0,
            })),
          });
        }
      }
    }

    // 5. Coordinate & Hierarchy Sorting:
    // Sort text containers vertically by y offset so Slide Title appears first
    textContainers.sort((a, b) => {
      // Title placeholder always takes highest precedence
      if (a.isTitlePlaceholder && !b.isTitlePlaceholder) return -1;
      if (!a.isTitlePlaceholder && b.isTitlePlaceholder) return 1;
      return a.y - b.y;
    });

    let slideTitle = '';
    let slideSubtitle = '';
    const bodyParagraphs = [];

    for (let cIdx = 0; cIdx < textContainers.length; cIdx++) {
      const cont = textContainers[cIdx];
      if (cIdx === 0 && (cont.isTitlePlaceholder || !slideTitle)) {
        slideTitle = cont.paragraphs.map((p) => p.text).join(' ').trim();
        continue;
      }
      if (cont.isSubtitlePlaceholder && !slideSubtitle) {
        slideSubtitle = cont.paragraphs.map((p) => p.text).join(' ').trim();
        continue;
      }
      bodyParagraphs.push(...cont.paragraphs);
    }

    const hasReadableText = (slideTitle && slideTitle.length > 0) || bodyParagraphs.length > 0;
    const isMediaOnly = !hasReadableText && slideImages.length > 0;

    slides.push({
      slideNumber: slideNum,
      title: slideTitle || (isMediaOnly ? `Slide ${slideNum}` : `Slide ${slideNum}`),
      subtitle: slideSubtitle,
      paragraphs: bodyParagraphs,
      images: slideImages,
      notes: speakerNotes,
      isMediaOnly,
    });
  }

  return slides;
}

/**
 * Converts parsed PPTX slides into a structured Word Document (.docx).
 */
export async function pptxToDocx(slides) {
  const docElements = [];

  for (let sIdx = 0; sIdx < slides.length; sIdx++) {
    const slide = slides[sIdx];

    // Page break between slides
    if (sIdx > 0) {
      docElements.push(new Paragraph({ children: [new PageBreak()] }));
    }

    // Header Slide Number Tag
    docElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `SLIDE ${slide.slideNumber} OF ${slides.length}`,
            size: 18, // 9pt
            color: 'FF5A1F',
            bold: true,
            font: 'Arial',
          }),
        ],
        spacing: { line: 240, before: 0, after: 60 },
      })
    );

    // Slide Title
    const titleText = slide.title || `Slide ${slide.slideNumber}`;
    docElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: titleText,
            size: 32, // 16pt
            bold: true,
            color: '1E293B',
            font: 'Arial',
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        border: {
          bottom: {
            color: 'E2E8F0',
            space: 4,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
        spacing: { line: 260, before: 40, after: 120 },
      })
    );

    // Subtitle if available
    if (slide.subtitle) {
      docElements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: slide.subtitle,
              size: 22, // 11pt
              italics: true,
              color: '64748B',
              font: 'Arial',
            }),
          ],
          spacing: { line: 240, before: 0, after: 100 },
        })
      );
    }

    // Slide Embedded Media
    if (slide.images && slide.images.length > 0) {
      for (const img of slide.images) {
        if (img.buffer) {
          try {
            const maxW = 500;
            const maxH = 320;
            const w = img.widthPt || 420;
            const h = img.heightPt || 260;
            const scale = Math.min(maxW / w, maxH / h, 1.0);
            const finalW = Math.round(w * scale);
            const finalH = Math.round(h * scale);

            docElements.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    data: new Uint8Array(img.buffer),
                    transformation: {
                      width: finalW,
                      height: finalH,
                    },
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { line: 240, before: 80, after: 80 },
              })
            );
          } catch (imgErr) {
            console.warn('Word slide image embedding warning:', imgErr);
          }
        }
      }
    }

    // Slide Bullets and Paragraphs
    if (slide.paragraphs && slide.paragraphs.length > 0) {
      for (const p of slide.paragraphs) {
        const runs = (p.runs && p.runs.length > 0)
          ? p.runs.map((r) => new TextRun({
              text: r.text,
              bold: r.isBold,
              italics: r.isItalic,
              size: 22, // 11pt
              color: '334155',
              font: 'Calibri',
            }))
          : [new TextRun({ text: p.text, size: 22, color: '334155', font: 'Calibri' })];

        if (p.isBullet) {
          docElements.push(
            new Paragraph({
              children: runs,
              bullet: { level: Math.min(p.level || 0, 3) },
              indent: { left: 360 + (p.level || 0) * 240, hanging: 180 },
              spacing: { line: 240, before: 40, after: 40 },
            })
          );
        } else {
          docElements.push(
            new Paragraph({
              children: runs,
              spacing: { line: 240, before: 40, after: 60 },
            })
          );
        }
      }
    } else if (slide.isMediaOnly) {
      docElements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '[Visual Slide: Media Only]',
              italics: true,
              color: '94A3B8',
              size: 20,
              font: 'Calibri',
            }),
          ],
          spacing: { line: 240, before: 40, after: 40 },
        })
      );
    }

    // Speaker Notes
    if (slide.notes && slide.notes.trim()) {
      docElements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Speaker Notes:',
              bold: true,
              size: 18,
              color: '64748B',
              font: 'Arial',
            }),
          ],
          spacing: { line: 240, before: 160, after: 30 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: slide.notes.trim(),
              italics: true,
              size: 19,
              color: '475569',
              font: 'Calibri',
            }),
          ],
          indent: { left: 240 },
          spacing: { line: 220, before: 0, after: 80 },
        })
      );
    }
  }

  if (docElements.length === 0) {
    docElements.push(
      new Paragraph({
        children: [new TextRun({ text: 'Converted from PowerPoint presentation.', size: 20, font: 'Calibri' })],
        spacing: { line: 240, before: 0, after: 30 },
      })
    );
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },
          paragraph: { spacing: { line: 240, before: 0, after: 40 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
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
      slides: slides.length,
      format: 'Word (.docx)',
    },
  };
}

/**
 * Wraps text tokens to fit within a given PDF point width.
 */
function wrapPdfText(text, font, fontSize, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Converts parsed PPTX slides into a clean 16:9 landscape PDF document using pdf-lib.
 */
export async function pptxToPdf(slides) {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // 16:9 Landscape Slide Dimensions: 720 x 405 pt
  const slideW = 720;
  const slideH = 405;

  for (let sIdx = 0; sIdx < slides.length; sIdx++) {
    const slide = slides[sIdx];
    const page = pdfDoc.addPage([slideW, slideH]);

    // Background fill
    page.drawRectangle({
      x: 0,
      y: 0,
      width: slideW,
      height: slideH,
      color: rgb(0.985, 0.988, 0.992),
    });

    // Top brand accent line
    page.drawRectangle({
      x: 0,
      y: slideH - 3,
      width: slideW,
      height: 3,
      color: rgb(1.0, 0.35, 0.12), // #FF5A1F
    });

    // Header badge
    page.drawText(`SLIDE ${slide.slideNumber} / ${slides.length}`, {
      x: 40,
      y: slideH - 28,
      size: 9,
      font: fontBold,
      color: rgb(0.55, 0.6, 0.68),
    });

    let curY = slideH - 56;

    // Slide Title
    const title = slide.title || `Slide ${slide.slideNumber}`;
    const cleanTitle = title.length > 75 ? title.substring(0, 72) + '...' : title;
    page.drawText(cleanTitle, {
      x: 40,
      y: curY,
      size: 19,
      font: fontBold,
      color: rgb(0.12, 0.16, 0.23),
    });

    curY -= 22;

    // Title divider line
    page.drawLine({
      start: { x: 40, y: curY },
      end: { x: slideW - 40, y: curY },
      thickness: 1,
      color: rgb(0.88, 0.91, 0.94),
    });

    curY -= 18;

    // Subtitle
    if (slide.subtitle) {
      const cleanSub = slide.subtitle.length > 90 ? slide.subtitle.substring(0, 87) + '...' : slide.subtitle;
      page.drawText(cleanSub, {
        x: 40,
        y: curY,
        size: 11,
        font: fontItalic,
        color: rgb(0.4, 0.45, 0.55),
      });
      curY -= 18;
    }

    // Embed slide image if available
    let hasDrawnImage = false;
    if (slide.images && slide.images.length > 0) {
      const firstImg = slide.images[0];
      if (firstImg.buffer) {
        try {
          const mime = firstImg.mime || '';
          let embedded = null;
          if (mime.includes('png')) {
            embedded = await pdfDoc.embedPng(firstImg.buffer);
          } else if (mime.includes('jpg') || mime.includes('jpeg')) {
            embedded = await pdfDoc.embedJpg(firstImg.buffer);
          }
          if (embedded) {
            const maxImgW = 280;
            const maxImgH = 220;
            const imgAspect = embedded.width / embedded.height;
            let drawW = Math.min(maxImgW, embedded.width);
            let drawH = drawW / imgAspect;
            if (drawH > maxImgH) {
              drawH = maxImgH;
              drawW = drawH * imgAspect;
            }
            page.drawImage(embedded, {
              x: slideW - 40 - drawW,
              y: Math.max(40, curY - drawH),
              width: drawW,
              height: drawH,
            });
            hasDrawnImage = true;
          }
        } catch (e) {
          console.warn('PDF image embedding warning:', e);
        }
      }
    }

    // Body Bullets / Paragraphs
    const maxTextWidth = hasDrawnImage ? slideW - 360 : slideW - 80;
    if (slide.paragraphs && slide.paragraphs.length > 0) {
      for (const p of slide.paragraphs) {
        if (curY < 55) break;
        const bulletPrefix = p.isBullet ? '• ' : '';
        const fullText = bulletPrefix + p.text;
        const lines = wrapPdfText(fullText, fontRegular, 11, maxTextWidth);

        for (const line of lines) {
          if (curY < 55) break;
          page.drawText(line, {
            x: 40 + (p.level || 0) * 15,
            y: curY,
            size: 11,
            font: p.runs?.[0]?.isBold ? fontBold : fontRegular,
            color: rgb(0.2, 0.25, 0.33),
          });
          curY -= 16;
        }
        curY -= 4;
      }
    } else if (slide.isMediaOnly && !hasDrawnImage) {
      page.drawText('[Visual Slide: Media Only]', {
        x: 40,
        y: curY,
        size: 11,
        font: fontItalic,
        color: rgb(0.55, 0.6, 0.68),
      });
    }

    // Speaker notes footer
    if (slide.notes && slide.notes.trim()) {
      const cleanNotes = slide.notes.trim().replace(/\s+/g, ' ');
      const notePreview = cleanNotes.length > 120 ? cleanNotes.substring(0, 117) + '...' : cleanNotes;
      page.drawText(`Notes: ${notePreview}`, {
        x: 40,
        y: 18,
        size: 8.5,
        font: fontItalic,
        color: rgb(0.45, 0.5, 0.58),
      });
    }
  }

  const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
  const outputBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  );

  return {
    outputBuffer,
    outputMimeType: 'application/pdf',
    extraMeta: {
      slides: slides.length,
      format: 'PDF Document',
    },
  };
}

/**
 * Extracts all embedded slide media from ppt/media/ into a ZIP archive or single image.
 */
export async function pptxExtractImages(fileBuffer) {
  const zip = await JSZip.loadAsync(fileBuffer);
  const mediaEntries = [];

  zip.forEach((relPath, entry) => {
    if (relPath.startsWith('ppt/media/') && !entry.dir) {
      mediaEntries.push(entry);
    }
  });

  if (mediaEntries.length === 0) {
    throw new Error('No embedded media found in this PowerPoint presentation.');
  }

  // Single media file: return directly
  if (mediaEntries.length === 1) {
    const entry = mediaEntries[0];
    const buffer = await entry.async('arraybuffer');
    const lowerName = entry.name.toLowerCase();
    let mime = 'image/png';
    if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) mime = 'image/jpeg';
    else if (lowerName.endsWith('.webp')) mime = 'image/webp';
    else if (lowerName.endsWith('.gif')) mime = 'image/gif';
    else if (lowerName.endsWith('.svg')) mime = 'image/svg+xml';

    return {
      outputBuffer: buffer,
      outputMimeType: mime,
      extraMeta: {
        imageCount: 1,
        format: 'Extracted Image',
      },
    };
  }

  // Multiple media files: package into ZIP
  const outZip = new JSZip();
  for (const entry of mediaEntries) {
    const buffer = await entry.async('arraybuffer');
    const fileName = entry.name.replace(/^ppt\/media\//, '');
    outZip.file(fileName, buffer);
  }

  const zipBuffer = await outZip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
  });

  return {
    outputBuffer: zipBuffer,
    outputMimeType: 'application/zip',
    extraMeta: {
      imageCount: mediaEntries.length,
      format: 'Slide Images (.zip)',
    },
  };
}

/**
 * Generates a clean slide-by-slide plain text transcript.
 */
export function pptxToText(slides) {
  let transcript = '';

  for (const slide of slides) {
    transcript += `================================================================================\n`;
    transcript += `SLIDE ${slide.slideNumber}: ${(slide.title || 'Untitled Slide').toUpperCase()}\n`;
    if (slide.subtitle) {
      transcript += `Subtitle: ${slide.subtitle}\n`;
    }
    transcript += `================================================================================\n\n`;

    if (slide.paragraphs && slide.paragraphs.length > 0) {
      for (const p of slide.paragraphs) {
        const indent = '  '.repeat(p.level || 0);
        const bullet = p.isBullet ? '• ' : '';
        transcript += `${indent}${bullet}${p.text}\n`;
      }
      transcript += '\n';
    } else if (slide.isMediaOnly) {
      transcript += `[Visual Slide: Media Only]\n\n`;
    }

    if (slide.notes && slide.notes.trim()) {
      transcript += `[Speaker Notes]:\n${slide.notes.trim()}\n\n`;
    }

    transcript += '\n';
  }

  const encoder = new TextEncoder();
  const outputBuffer = encoder.encode(transcript.trim() + '\n').buffer;

  return {
    outputBuffer,
    outputMimeType: 'text/plain',
    extraMeta: {
      slides: slides.length,
      format: 'Plain Text (.txt)',
    },
  };
}

/**
 * Master PowerPoint transmutation dispatcher.
 */
export async function executePresentationTransmute(fileBuffer, targetMimeType, fileName = '') {
  if (isLegacyPpt(fileBuffer, fileName)) {
    throw new Error('Legacy .ppt binary format detected. Please save as modern .pptx to convert client-side.');
  }

  const slides = await parsePptx(fileBuffer, fileName);
  if (!slides || slides.length === 0) {
    throw new Error('No slides could be extracted from this presentation.');
  }

  if (
    targetMimeType.includes('word') ||
    targetMimeType.includes('docx') ||
    targetMimeType === 'DOCX'
  ) {
    return await pptxToDocx(slides);
  }

  if (
    targetMimeType.includes('pdf') ||
    targetMimeType === 'PDF' ||
    targetMimeType === 'application/pdf'
  ) {
    return await pptxToPdf(slides);
  }

  if (
    targetMimeType.includes('zip') ||
    targetMimeType.includes('image') ||
    targetMimeType === 'ZIP' ||
    targetMimeType === 'EXTRACT_IMAGES'
  ) {
    return await pptxExtractImages(fileBuffer);
  }

  if (
    targetMimeType.includes('plain') ||
    targetMimeType.includes('txt') ||
    targetMimeType === 'TXT'
  ) {
    return pptxToText(slides);
  }

  // Default to DOCX
  return await pptxToDocx(slides);
}

/**
 * Converts a PDF document into a high-fidelity PowerPoint (.pptx) presentation.
 * Renders each PDF page at high resolution into slide media and reconstructs
 * native OpenXML slide layout structures with exact coordinate matching.
 */
export async function pdfToPptx(fileBuffer) {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(fileBuffer),
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  const zip = new JSZip();

  // Root relations
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
    '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>\n' +
    '</Relationships>'
  );

  // Theme
  zip.file(
    'ppt/theme/theme1.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">\n' +
    '  <a:themeElements>\n' +
    '    <a:clrScheme name="Office">\n' +
    '      <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>\n' +
    '      <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>\n' +
    '      <a:dk2><a:srgbClr val="1F497D"/></a:dk2>\n' +
    '      <a:lt2><a:srgbClr val="EEECE1"/></a:lt2>\n' +
    '      <a:accent1><a:srgbClr val="FF5A1F"/></a:accent1>\n' +
    '      <a:accent2><a:srgbClr val="4F81BD"/></a:accent2>\n' +
    '      <a:accent3><a:srgbClr val="9BBB59"/></a:accent3>\n' +
    '      <a:accent4><a:srgbClr val="8064A2"/></a:accent4>\n' +
    '      <a:accent5><a:srgbClr val="4BACC6"/></a:accent5>\n' +
    '      <a:accent6><a:srgbClr val="F79646"/></a:accent6>\n' +
    '      <a:hlink><a:srgbClr val="0000FF"/></a:hlink>\n' +
    '      <a:folHlink><a:srgbClr val="800080"/></a:folHlink>\n' +
    '    </a:clrScheme>\n' +
    '    <a:fontScheme name="Office">\n' +
    '      <a:majorFont><a:latin typeface="Calibri"/></a:majorFont>\n' +
    '      <a:minorFont><a:latin typeface="Calibri"/></a:minorFont>\n' +
    '    </a:fontScheme>\n' +
    '    <a:fmtScheme name="Office">\n' +
    '      <a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>\n' +
    '      <a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>\n' +
    '      <a:effectStyleLst><a:effectLst/></a:effectStyleLst>\n' +
    '      <a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>\n' +
    '    </a:fmtScheme>\n' +
    '  </a:themeElements>\n' +
    '</a:theme>'
  );

  // Slide Layout
  zip.file(
    'ppt/slideLayouts/slideLayout1.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" type="blank">\n' +
    '  <p:cSld name="Blank">\n' +
    '    <p:spTree>\n' +
    '      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>\n' +
    '      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>\n' +
    '    </p:spTree>\n' +
    '  </p:cSld>\n' +
    '</p:sldLayout>'
  );

  zip.file(
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
    '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>\n' +
    '</Relationships>'
  );

  // Slide Master
  zip.file(
    'ppt/slideMasters/slideMaster1.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">\n' +
    '  <p:cSld>\n' +
    '    <p:spTree>\n' +
    '      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>\n' +
    '      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>\n' +
    '    </p:spTree>\n' +
    '  </p:cSld>\n' +
    '  <p:sldLayoutIdLst>\n' +
    '    <p:sldLayoutId id="2147483649" r:id="rId1"/>\n' +
    '  </p:sldLayoutIdLst>\n' +
    '</p:sldMaster>'
  );

  zip.file(
    'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
    '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>\n' +
    '  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>\n' +
    '</Relationships>'
  );

  // Calculate slide dimensions from first page (1pt = 12700 EMUs)
  const firstPage = await pdfDoc.getPage(1);
  const firstViewport = firstPage.getViewport({ scale: 1.0 });
  const baseWidth = firstViewport.width || 612;
  const baseHeight = firstViewport.height || 792;
  const slideCx = Math.round(baseWidth * 12700);
  const slideCy = Math.round(baseHeight * 12700);

  const presRels = [
    '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>',
  ];
  const sldIdLst = [];
  const contentTypesOverrides = [
    '  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>',
    '  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>',
    '  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>',
    '  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>',
  ];

  for (let p = 1; p <= numPages; p++) {
    const page = await pdfDoc.getPage(p);
    const renderScale = 2.0;
    const vp = page.getViewport({ scale: renderScale });

    const canvas = new OffscreenCanvas(Math.round(vp.width), Math.round(vp.height));
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport: vp }).promise;

    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const pngBuffer = await blob.arrayBuffer();

    const imgPartName = `ppt/media/image${p}.png`;
    zip.file(imgPartName, pngBuffer);

    // Slide relationship
    const slideRId = `rId${p + 1}`;
    presRels.push(
      `  <Relationship Id="${slideRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${p}.xml"/>`
    );
    sldIdLst.push(`    <p:sldId id="${255 + p}" r:id="${slideRId}"/>`);
    contentTypesOverrides.push(
      `  <Override PartName="/ppt/slides/slide${p}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
    );

    // Slide XML
    const slideXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">\n' +
      '  <p:cSld>\n' +
      '    <p:spTree>\n' +
      '      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>\n' +
      '      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>\n' +
      '      <p:pic>\n' +
      '        <p:nvPicPr>\n' +
      `          <p:cNvPr id="2" name="SlideImage${p}"/>\n` +
      '          <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>\n' +
      '          <p:nvPr/>\n' +
      '        </p:nvPicPr>\n' +
      '        <p:blipFill>\n' +
      '          <a:blip r:embed="rId2"/>\n' +
      '          <a:stretch><a:fillRect/></a:stretch>\n' +
      '        </p:blipFill>\n' +
      '        <p:spPr>\n' +
      '          <a:xfrm>\n' +
      '            <a:off x="0" y="0"/>\n' +
      `            <a:ext cx="${slideCx}" cy="${slideCy}"/>\n` +
      '          </a:xfrm>\n' +
      '          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>\n' +
      '        </p:spPr>\n' +
      '      </p:pic>\n' +
      '    </p:spTree>\n' +
      '  </p:cSld>\n' +
      '</p:sld>';
    zip.file(`ppt/slides/slide${p}.xml`, slideXml);

    // Slide rels
    const slideRelsXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
      '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>\n' +
      `  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${p}.png"/>\n` +
      '</Relationships>';
    zip.file(`ppt/slides/_rels/slide${p}.xml.rels`, slideRelsXml);
  }

  // presentation.xml
  const presXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">\n' +
    '  <p:sldMasterIdLst>\n' +
    '    <p:sldMasterId id="2147483648" r:id="rId1"/>\n' +
    '  </p:sldMasterIdLst>\n' +
    '  <p:sldIdLst>\n' +
    sldIdLst.join('\n') + '\n' +
    '  </p:sldIdLst>\n' +
    `  <p:sldSz cx="${slideCx}" cy="${slideCy}"/>\n` +
    '</p:presentation>';
  zip.file('ppt/presentation.xml', presXml);

  // ppt/_rels/presentation.xml.rels
  const presRelsXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
    presRels.join('\n') + '\n' +
    '</Relationships>';
  zip.file('ppt/_rels/presentation.xml.rels', presRelsXml);

  // [Content_Types].xml
  const contentTypesXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
    '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n' +
    '  <Default Extension="xml" ContentType="application/xml"/>\n' +
    '  <Default Extension="png" ContentType="image/png"/>\n' +
    '  <Default Extension="jpeg" ContentType="image/jpeg"/>\n' +
    contentTypesOverrides.join('\n') + '\n' +
    '</Types>';
  zip.file('[Content_Types].xml', contentTypesXml);

  const outputBuffer = await zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
  });

  return {
    outputBuffer,
    outputMimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extraMeta: {
      pages: numPages,
      slides: numPages,
      format: 'PowerPoint (.pptx)',
    },
  };
}
