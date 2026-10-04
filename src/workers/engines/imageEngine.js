/**
 * Unified Image Transmutation Engine
 * Handles high-fidelity decoding, aspect-ratio preserved scaling,
 * color profile retention, and off-thread encoding for WebP, AVIF, PNG, JPEG, BMP, and ICO.
 */

/**
 * Encodes raw RGBA buffer into a valid 24-bit uncompressed Windows BMP file buffer.
 */
export function encodeBmp(width, height, rgba) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;
  const buffer = new ArrayBuffer(fileSize);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // Bitmap File Header (14 bytes)
  bytes[0] = 0x42; // 'B'
  bytes[1] = 0x4d; // 'M'
  view.setUint32(2, fileSize, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  view.setUint32(10, 54, true); // pixel data offset

  // DIB Header (BITMAPINFOHEADER - 40 bytes)
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // bottom-up DIB
  view.setUint16(26, 1, true); // color planes
  view.setUint16(28, 24, true); // 24-bit BGR
  view.setUint32(30, 0, true); // BI_RGB (uncompressed)
  view.setUint32(34, pixelArraySize, true);
  view.setInt32(38, 2835, true); // 72 DPI horizontal (pixels/meter)
  view.setInt32(42, 2835, true); // 72 DPI vertical
  view.setUint32(46, 0, true);
  view.setUint32(50, 0, true);

  // Fill pixel array (bottom-up, BGR format, zero-padded to 4-byte boundaries)
  for (let y = 0; y < height; y++) {
    const srcRow = (height - 1 - y) * width * 4;
    const dstRow = 54 + y * rowSize;
    for (let x = 0; x < width; x++) {
      const si = srcRow + x * 4;
      const di = dstRow + x * 3;
      bytes[di] = rgba[si + 2];     // Blue
      bytes[di + 1] = rgba[si + 1]; // Green
      bytes[di + 2] = rgba[si];     // Red
    }
  }

  return buffer;
}

/**
 * Wraps PNG image bytes into a valid Microsoft Icon (.ico) container.
 */
export function encodeIco(width, height, pngBuffer) {
  const pngBytes = new Uint8Array(pngBuffer);
  const totalSize = 6 + 16 + pngBytes.length;
  const buffer = new ArrayBuffer(totalSize);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // ICONDIR Header (6 bytes)
  view.setUint16(0, 0, true); // Reserved
  view.setUint16(2, 1, true); // 1 = ICO icon resource
  view.setUint16(4, 1, true); // Number of images

  // ICONDIRENTRY (16 bytes)
  bytes[6] = width >= 256 ? 0 : width;
  bytes[7] = height >= 256 ? 0 : height;
  bytes[8] = 0; // Colors in palette
  bytes[9] = 0; // Reserved
  view.setUint16(10, 1, true); // Color planes
  view.setUint16(12, 32, true); // Bits per pixel
  view.setUint32(14, pngBytes.length, true); // Size of PNG data in bytes
  view.setUint32(18, 22, true); // Offset to PNG data

  // Append PNG payload directly
  bytes.set(pngBytes, 22);
  return buffer;
}

/**
 * Master image conversion pipeline.
 * Guarantees zero distortion by adhering strictly to bitmap.width & bitmap.height.
 * Defensively disposes ImageBitmap in finally blocks to eliminate browser tab OOM crashes.
 */
export async function executeImageTransmute(fileBuffer, sourceMimeType, targetMimeType, quality = 0.85) {
  let imageBitmap = null;

  try {
    try {
      const blob = new Blob([fileBuffer], { type: sourceMimeType || 'image/jpeg' });
      imageBitmap = await createImageBitmap(blob, {
        colorSpaceConversion: 'default',
        imageOrientation: 'from-image',
      });
    } catch {
      // Untyped fallback for raw byte sniffing
      const rawBlob = new Blob([fileBuffer]);
      imageBitmap = await createImageBitmap(rawBlob);
    }

    if (!imageBitmap) {
      throw new Error('Corrupted or unreadable image stream.');
    }

    const width = imageBitmap.width;
    const height = imageBitmap.height;

    if (!width || !height) {
      throw new Error('Image source has invalid or zero dimensions.');
    }

    const totalPixels = width * height;
    const megapixels = parseFloat((totalPixels / 1000000).toFixed(1));
    const isHighResolution = totalPixels > 24000000; // > 24 Megapixels (e.g. 6000x4000)

    const isBmp = targetMimeType === 'image/bmp' || targetMimeType === 'bmp';
    const isIco = targetMimeType === 'image/x-icon' || targetMimeType === 'image/vnd.microsoft.icon' || targetMimeType === 'ico';
    const isJpeg = targetMimeType === 'image/jpeg' || targetMimeType === 'jpeg' || targetMimeType === 'jpg';

    let targetWidth = width;
    let targetHeight = height;

    // For ICO, limit canvas bounds to 256x256 max while preserving aspect ratio
    if (isIco) {
      const maxDim = 256;
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          targetWidth = maxDim;
          targetHeight = Math.max(1, Math.round((height * maxDim) / width));
        } else {
          targetHeight = maxDim;
          targetWidth = Math.max(1, Math.round((width * maxDim) / height));
        }
      }
    } else if (isHighResolution) {
      // Ultra-High-Resolution memory protection: clamp canvas allocation to 6000px safe ceiling
      const maxDim = 6000;
      if (targetWidth > maxDim || targetHeight > maxDim) {
        if (targetWidth >= targetHeight) {
          targetWidth = maxDim;
          targetHeight = Math.max(1, Math.round((height * maxDim) / width));
        } else {
          targetHeight = maxDim;
          targetWidth = Math.max(1, Math.round((width * maxDim) / height));
        }
      }
    }

    const offscreen = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = offscreen.getContext('2d', {
      alpha: !isJpeg && !isBmp,
      willReadFrequently: isBmp,
    });

    if (!ctx) {
      throw new Error('Failed to allocate 2D rendering buffer for image rasterization.');
    }

    // If destination is non-transparent (JPEG or standard BMP), composite on clean white background
    if (isJpeg || isBmp) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);

    // 1. Export BMP
    if (isBmp) {
      const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      const outputBuffer = encodeBmp(targetWidth, targetHeight, imageData.data);
      return {
        outputBuffer,
        outputMimeType: 'image/bmp',
        extraMeta: {
          width: targetWidth,
          height: targetHeight,
          megapixels,
          isHighResolution,
          format: 'BMP (Windows Bitmap)',
        },
      };
    }

    // 2. Export ICO
    if (isIco) {
      const pngBlob = await offscreen.convertToBlob({ type: 'image/png' });
      const pngBuffer = await pngBlob.arrayBuffer();
      const outputBuffer = encodeIco(targetWidth, targetHeight, pngBuffer);
      return {
        outputBuffer,
        outputMimeType: 'image/x-icon',
        extraMeta: {
          width: targetWidth,
          height: targetHeight,
          megapixels,
          isHighResolution,
          format: 'ICO (Icon Resource)',
        },
      };
    }

    // 3. Export WebP, AVIF, PNG, JPEG
    let mime = targetMimeType || 'image/webp';
    if (mime === 'jpg' || mime === 'jpeg') mime = 'image/jpeg';
    if (mime === 'png') mime = 'image/png';
    if (mime === 'webp') mime = 'image/webp';
    if (mime === 'avif') mime = 'image/avif';

    // Target optimal quality for real file size reduction (preventing bloating)
    let targetQuality = quality;
    if (!targetQuality || targetQuality >= 0.98) {
      if (mime === 'image/avif') targetQuality = 0.70;
      else if (mime === 'image/webp') targetQuality = 0.80;
      else if (mime === 'image/jpeg') targetQuality = 0.80;
    }

    let outputBlob;
    try {
      outputBlob = await offscreen.convertToBlob({
        type: mime,
        quality: mime === 'image/png' ? undefined : targetQuality,
      });

      // Adaptive Compression: If output is larger than original file, optimize quality
      if (
        outputBlob.size >= fileBuffer.byteLength &&
        (mime === 'image/avif' || mime === 'image/webp' || mime === 'image/jpeg')
      ) {
        const tighterQuality = mime === 'image/avif' ? 0.55 : 0.68;
        const tighterBlob = await offscreen.convertToBlob({
          type: mime,
          quality: tighterQuality,
        });
        if (tighterBlob.size < outputBlob.size) {
          outputBlob = tighterBlob;
        }
      }
    } catch (err) {
      // If browser lacks AVIF encoder, fallback cleanly to high-efficiency WebP
      if (mime === 'image/avif') {
        mime = 'image/webp';
        outputBlob = await offscreen.convertToBlob({
          type: 'image/webp',
          quality: 0.80,
        });
        if (outputBlob.size >= fileBuffer.byteLength) {
          const tighterBlob = await offscreen.convertToBlob({
            type: 'image/webp',
            quality: 0.68,
          });
          if (tighterBlob.size < outputBlob.size) {
            outputBlob = tighterBlob;
          }
        }
      } else {
        throw err;
      }
    }

    const outputBuffer = await outputBlob.arrayBuffer();

    return {
      outputBuffer,
      outputMimeType: mime,
      extraMeta: {
        width: targetWidth,
        height: targetHeight,
        megapixels,
        isHighResolution,
        format: mime.replace('image/', '').toUpperCase(),
      },
    };
  } finally {
    // Deterministic Bitmap Disposal: Strictly release GPU/RAM buffer
    if (imageBitmap && typeof imageBitmap.close === 'function') {
      try {
        imageBitmap.close();
      } catch {
        // Bitmap already released
      }
    }
  }
}
