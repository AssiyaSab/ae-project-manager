import { PDFDocument } from 'pdf-lib';

export interface StampData {
  approvedBy: string;
  date?: string;
}

function createStampCanvas(stamp: StampData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 156;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Background
  ctx.fillStyle = 'rgba(236, 253, 245, 0.96)';
  ctx.strokeStyle = '#047857';
  ctx.lineWidth = 6;

  const r = 16;
  const w = canvas.width - 12;
  const h = canvas.height - 12;
  const x = 6;
  const y = 6;

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#047857';
  ctx.textAlign = 'center';

  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.fillText('ОДОБРЕНО ДИРЕКТОРОМ', canvas.width / 2, 52);

  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.fillText(stamp.approvedBy, canvas.width / 2, 94);

  if (stamp.date) {
    ctx.font = '21px Arial, sans-serif';
    ctx.fillText(`Дата: ${stamp.date}`, canvas.width / 2, 130);
  }

  return canvas;
}

export async function stampPdfBytes(pdfBytes: ArrayBuffer, stamp: StampData): Promise<Blob> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const stampCanvas = createStampCanvas(stamp);
  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    stampCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))), 'image/png');
  });
  const pngBytes = await pngBlob.arrayBuffer();
  const pngImage = await pdfDoc.embedPng(pngBytes);

  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];
  const { width } = lastPage.getSize();
  const drawWidth = Math.min(180, width * 0.35);
  const drawHeight = (drawWidth * 156) / 480;

  lastPage.drawImage(pngImage, {
    x: Math.max(20, width - drawWidth - 24),
    y: 20,
    width: drawWidth,
    height: drawHeight,
  });

  const saved = await pdfDoc.save();
  return new Blob([new Uint8Array(saved)], { type: 'application/pdf' });
}

export async function stampImageBlob(imageBlob: Blob, stamp: StampData): Promise<Blob> {
  const imgUrl = URL.createObjectURL(imageBlob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = imgUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return imageBlob;

    ctx.drawImage(img, 0, 0);
    const stampCanvas = createStampCanvas(stamp);
    const drawWidth = Math.max(220, Math.min(420, canvas.width * 0.34));
    const drawHeight = (drawWidth * 156) / 480;
    ctx.drawImage(
      stampCanvas,
      Math.max(12, canvas.width - drawWidth - 24),
      Math.max(12, canvas.height - drawHeight - 24),
      drawWidth,
      drawHeight
    );

    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b || imageBlob), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(imgUrl);
  }
}
