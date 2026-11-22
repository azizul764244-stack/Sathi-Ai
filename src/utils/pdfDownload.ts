/**
 * Generates a crisp multi-page A4 PDF supporting full Bengali Unicode characters
 * by rendering wrapped text cleanly onto high-DPI HTML Canvas pages and packing
 * JPEG image streams into a standard PDF 1.4 binary (no window.open / popup needed).
 */

function stripMarkdownSymbols(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function wrapLineToWidth(
  ctx: CanvasRenderingContext2D,
  line: string,
  maxWidth: number
): string[] {
  if (!line.trim()) return [''];
  const words = line.split(/\s+/);
  const out: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) out.push(current);
      if (ctx.measureText(word).width <= maxWidth) {
        current = word;
      } else {
        // Hard-break unusually long word
        let chunk = '';
        for (const ch of word) {
          if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
            out.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        current = chunk;
      }
    }
  }
  if (current) out.push(current);
  return out;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function buildPdfFromJpegPages(pages: { bytes: Uint8Array; width: number; height: number }[]): Blob {
  const encoder = new TextEncoder();
  const str = (s: string) => encoder.encode(s);

  // PDF points for A4: 595 x 842
  const pagePtWidth = 595;
  const pagePtHeight = 842;

  const pageObjIds = pages.map((_, i) => 3 + i * 3);
  const offsets: number[] = [];

  const header = str('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');
  const fileChunks: Uint8Array[] = [header];
  let cursor = header.length;

  const bodyChunks: Uint8Array[] = [];
  const totalObjects = 2 + pages.length * 3;
  // Reset and track exact byte offset per object id 1..totalObjects
  const objBytesMap = new Map<number, Uint8Array>();

  const makeObjBytes = (id: number, parts: Uint8Array[]) =>
    concatUint8Arrays([str(`${id} 0 obj\n`), ...parts, str('\nendobj\n')]);

  objBytesMap.set(1, makeObjBytes(1, [str('<< /Type /Catalog /Pages 2 0 R >>')]));
  objBytesMap.set(
    2,
    makeObjBytes(2, [
      str(
        `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] >>`
      ),
    ])
  );

  pages.forEach((pg, idx) => {
    const pageId = 3 + idx * 3;
    const contentId = 4 + idx * 3;
    const imageId = 5 + idx * 3;
    const imgName = `/Im${idx}`;

    objBytesMap.set(
      pageId,
      makeObjBytes(pageId, [
        str(
          `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pagePtWidth} ${pagePtHeight}] /Resources << /XObject << ${imgName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`
        ),
      ])
    );

    const streamCmd = `q\n${pagePtWidth} 0 0 ${pagePtHeight} 0 0 cm\n${imgName} Do\nQ\n`;
    const streamBytes = str(streamCmd);
    objBytesMap.set(
      contentId,
      makeObjBytes(contentId, [
        str(`<< /Length ${streamBytes.length} >>\nstream\n`),
        streamBytes,
        str('endstream'),
      ])
    );

    objBytesMap.set(
      imageId,
      makeObjBytes(imageId, [
        str(
          `<< /Type /XObject /Subtype /Image /Width ${pg.width} /Height ${pg.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.bytes.length} >>\nstream\n`
        ),
        pg.bytes,
        str('\nendstream'),
      ])
    );
  });

  for (let id = 1; id <= totalObjects; id += 1) {
    offsets.push(cursor);
    const bytes = objBytesMap.get(id)!;
    bodyChunks.push(bytes);
    cursor += bytes.length;
  }

  const xrefOffset = cursor;
  const xrefLines = [
    `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`,
    ...offsets.map((off) => `${String(off).padStart(10, '0')} 00000 n \n`),
    `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  ];

  fileChunks.push(...bodyChunks, str(xrefLines.join('')));
  const fullPdfBytes = concatUint8Arrays(fileChunks);
  return new Blob([fullPdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

export async function downloadStudyNotePdf(params: {
  title: string;
  bodyText: string;
  fileName?: string;
}): Promise<void> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // continue
    }
  }

  const canvasWidth = 1190;
  const canvasHeight = 1684;
  const paddingX = 90;
  const topHeaderHeight = 150;
  const bottomMargin = 95;
  const maxTextWidth = canvasWidth - paddingX * 2;
  const lineHeight = 36;

  const measureCanvas = document.createElement('canvas');
  measureCanvas.width = canvasWidth;
  measureCanvas.height = canvasHeight;
  const mCtx = measureCanvas.getContext('2d');
  if (!mCtx) {
    throw new Error('PDF তৈরি করা সম্ভব হয়নি।');
  }

  mCtx.font = '24px "Hind Siliguri", "Noto Sans Bengali", Arial, sans-serif';
  const cleanBody = stripMarkdownSymbols(params.bodyText);
  const rawParagraphs = cleanBody.split('\n');
  const wrappedLines: string[] = [];

  for (const para of rawParagraphs) {
    const lines = wrapLineToWidth(mCtx, para, maxTextWidth);
    wrappedLines.push(...lines);
  }

  if (wrappedLines.length === 0) {
    wrappedLines.push('কোনো নোট লেখা হয়নি।');
  }

  const linesPerFirstPage = Math.floor((canvasHeight - (topHeaderHeight + 45) - bottomMargin) / lineHeight);
  const linesPerNextPage = Math.floor((canvasHeight - 120 - bottomMargin) / lineHeight);

  const pageLineChunks: string[][] = [];
  let cursor = 0;
  pageLineChunks.push(wrappedLines.slice(0, linesPerFirstPage));
  cursor += linesPerFirstPage;
  while (cursor < wrappedLines.length) {
    pageLineChunks.push(wrappedLines.slice(cursor, cursor + linesPerNextPage));
    cursor += linesPerNextPage;
  }

  const jpegPages: { bytes: Uint8Array; width: number; height: number }[] = [];

  pageLineChunks.forEach((lines, pageIndex) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d')!;

    // White sheet background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    let y = 70;
    if (pageIndex === 0) {
      // Clean blue accent bar + Header
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(paddingX, 55, maxTextWidth, 6);

      ctx.fillStyle = '#1e3a8a';
      ctx.font = 'bold 34px "Hind Siliguri", "Noto Sans Bengali", Arial, sans-serif';
      const titleLines = wrapLineToWidth(ctx, params.title || 'Sathi AI BD — সহজ বাংলা নোট', maxTextWidth);
      for (const tl of titleLines.slice(0, 2)) {
        y += 38;
        ctx.fillText(tl, paddingX, y);
      }

      ctx.fillStyle = '#64748b';
      ctx.font = '18px "Hind Siliguri", "Noto Sans Bengali", Arial, sans-serif';
      y += 32;
      ctx.fillText(
        `Sathi AI BD · পড়াশোনা টুলস নোট · তারিখ: ${new Date().toLocaleDateString('bn-BD')}`,
        paddingX,
        y
      );

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(paddingX, y + 18);
      ctx.lineTo(canvasWidth - paddingX, y + 18);
      ctx.stroke();

      y += 58;
    } else {
      y = 95;
    }

    ctx.fillStyle = '#0f172a';
    ctx.font = '24px "Hind Siliguri", "Noto Sans Bengali", Arial, sans-serif';
    for (const line of lines) {
      if (line) {
        ctx.fillText(line, paddingX, y);
      }
      y += lineHeight;
    }

    // Footer page number
    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px "Hind Siliguri", "Noto Sans Bengali", Arial, sans-serif';
    ctx.fillText(
      `Sathi AI BD · পৃষ্ঠা ${pageIndex + 1} / ${pageLineChunks.length}`,
      paddingX,
      canvasHeight - 40
    );

    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const base64 = jpegDataUrl.split(',')[1];
    jpegPages.push({
      bytes: base64ToUint8Array(base64),
      width: canvasWidth,
      height: canvasHeight,
    });
  });

  const pdfBlob = buildPdfFromJpegPages(jpegPages);
  const blobUrl = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  const safeSlug =
    (params.fileName || params.title || 'sathi-study-note')
      .replace(/[^\w\u0980-\u09FF-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'sathi-study-note';
  link.href = blobUrl;
  link.download = `${safeSlug}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
}
