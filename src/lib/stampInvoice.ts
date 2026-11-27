import { PDFDocument } from 'pdf-lib';

export interface StampData {
  approvedBy: string;
  date?: string;
  projectName?: string;
}

function createStampCanvas(stamp: StampData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 540;
  canvas.height = stamp.projectName ? 196 : 156;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

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

  ctx.font = 'bold 25px Arial, sans-serif';
  ctx.fillText('ОДОБРЕНО ДИРЕКТОРОМ', canvas.width / 2, 48);

  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.fillText(stamp.approvedBy, canvas.width / 2, 86);

  let nextY = 122;
  if (stamp.projectName) {
    const cleanProj = stamp.projectName.length > 36
      ? stamp.projectName.slice(0, 35) + '…'
      : stamp.projectName;
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.fillText(`Объект: ${cleanProj}`, canvas.width / 2, nextY);
    nextY += 34;
  }

  if (stamp.date) {
    ctx.font = '20px Arial, sans-serif';
    ctx.fillText(`Дата: ${stamp.date}`, canvas.width / 2, nextY);
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
  const drawWidth = Math.min(210, width * 0.4);
  const drawHeight = (drawWidth * stampCanvas.height) / stampCanvas.width;

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
    const drawWidth = Math.max(240, Math.min(460, canvas.width * 0.38));
    const drawHeight = (drawWidth * stampCanvas.height) / stampCanvas.width;
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
