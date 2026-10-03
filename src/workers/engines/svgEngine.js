/**
 * Vector & SVG Optimization Engine
 * Strips editor garbage, minifies XML, and executes vector-to-raster transmutation off-thread.
 */

/**
 * Minifies raw SVG XML string.
 */
export function minifySvg(svgString) {
  let cleaned = svgString;

  // Remove XML declaration and DOCTYPE
  cleaned = cleaned.replace(/<\?xml[\s\S]*?\?>/gi, '');
  cleaned = cleaned.replace(/<!DOCTYPE[\s\S]*?>/gi, '');

  // Remove comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // Remove editor-specific tags and namespaces (Inkscape, Illustrator, Figma, Sketch)
  cleaned = cleaned.replace(/<metadata[\s\S]*?<\/metadata>/gi, '');
  cleaned = cleaned.replace(/<desc[\s\S]*?<\/desc>/gi, '');
  cleaned = cleaned.replace(/<sodipodi:[\s\S]*?\/>/gi, '');
  cleaned = cleaned.replace(/xmlns:(inkscape|sodipodi|sketch|i|adobe)=".+?"/gi, '');
  cleaned = cleaned.replace(/(inkscape|sodipodi):[a-z0-9-]+=".+?"/gi, '');

  // Collapse multiple whitespaces and trim tags
  cleaned = cleaned.replace(/>\s+</g, '><');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');

  // Trim numbers precision to 3 decimals inside path data
  cleaned = cleaned.replace(/(\d+\.\d{3})\d+/g, '$1');

  return cleaned.trim();
}

/**
 * Renders SVG to high-resolution PNG using OffscreenCanvas in the worker.
 */
export async function svgToPng(svgBuffer, scale = 2) {
  const blob = new Blob([svgBuffer], { type: 'image/svg+xml' });
  const imageBitmap = await createImageBitmap(blob);

  const width = Math.max(1, Math.round(imageBitmap.width * scale));
  const height = Math.max(1, Math.round(imageBitmap.height * scale));

  const offscreen = new OffscreenCanvas(width, height);
  const ctx = offscreen.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to acquire OffscreenCanvas context for SVG rasterization.');
  }

  ctx.drawImage(imageBitmap, 0, 0, width, height);
  imageBitmap.close();

  const pngBlob = await offscreen.convertToBlob({ type: 'image/png' });
  const outputBuffer = await pngBlob.arrayBuffer();

  return {
    outputBuffer,
    outputMimeType: 'image/png',
    extraMeta: {
      width,
      height,
      renderScale: `${scale}x`,
      format: 'PNG (Rasterized Vector)',
    },
  };
}

/**
 * Main SVG Transmute Pipeline
 */
export async function executeSvgTransmute(buffer, targetFormat = 'SVG') {
  if (targetFormat === 'PNG') {
    return svgToPng(buffer, 2);
  }

  // Minified SVG
  const decoder = new TextDecoder('utf-8');
  const svgText = decoder.decode(buffer);
  const minified = minifySvg(svgText);

  const encoder = new TextEncoder();
  const outputBuffer = encoder.encode(minified).buffer;

  return {
    outputBuffer,
    outputMimeType: 'image/svg+xml',
    extraMeta: {
      format: 'Minified SVG',
      originalLength: svgText.length,
      optimizedLength: minified.length,
    },
  };
}
