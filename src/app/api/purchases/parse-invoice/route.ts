import { NextResponse } from 'next/server';
import { validateAuth } from '@/lib/auth';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

export const dynamic = 'force-dynamic';

const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];

async function generateWithFallback(genAI: GoogleGenerativeAI, contents: string | (string | Part)[]): Promise<string> {
  let lastErr: any = null;
  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });
      const res = await model.generateContent(contents);
      return res.response.text();
    } catch (err: any) {
      console.warn(`[parse-invoice] Model ${modelName} failed:`, err?.message || err);
      lastErr = err;
    }
  }
  throw lastErr || new Error('Все доступные модели Gemini временно недоступны.');
}

function extractGoogleDriveInfo(url: string): { type: 'spreadsheet' | 'document' | 'file'; id: string } | null {
  if (!url) return null;
  const cleanUrl = url.trim();

  const sheetMatch = cleanUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (sheetMatch && sheetMatch[1]) return { type: 'spreadsheet', id: sheetMatch[1] };

  const docMatch = cleanUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docMatch && docMatch[1]) return { type: 'document', id: docMatch[1] };

  const fileMatch = cleanUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch && fileMatch[1]) return { type: 'file', id: fileMatch[1] };

  const idMatch = cleanUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) return { type: 'file', id: idMatch[1] };

  const genericMatch = cleanUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (genericMatch && genericMatch[1]) return { type: 'file', id: genericMatch[1] };

  return null;
}

async function fetchGoogleDriveContent(info: { type: 'spreadsheet' | 'document' | 'file'; id: string }) {
  const downloadUrl =
    info.type === 'spreadsheet'
      ? `https://docs.google.com/spreadsheets/d/${info.id}/export?format=csv`
      : info.type === 'document'
      ? `https://docs.google.com/document/d/${info.id}/export?format=txt`
      : `https://drive.google.com/uc?export=download&id=${info.id}`;

  const res = await fetch(downloadUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`Google Drive вернул ошибку HTTP ${res.status}. Убедитесь, что доступ к файлу открыт по ссылке.`);
  }

  const contentType = res.headers.get('content-type') || '';
  const buffer = Buffer.from(await res.arrayBuffer());
  const preview = buffer.slice(0, 1000).toString('utf-8');
  if (
    (contentType.includes('text/html') || preview.includes('<!DOCTYPE html')) &&
    (preview.includes('ServiceLogin') || preview.includes('accounts.google.com'))
  ) {
    throw new Error('Файл на Google Диске закрыт для публичного доступа. Откройте доступ по ссылке или загрузите файл с компьютера.');
  }

  let mimeType = contentType.split(';')[0].trim();
  let filename = 'drive_invoice';
  if (info.type === 'spreadsheet') {
    mimeType = 'text/csv';
    filename = 'invoice.csv';
  } else if (info.type === 'document') {
    mimeType = 'text/plain';
    filename = 'invoice.txt';
  }

  return { buffer, mimeType, filename };
}

export async function POST(request: Request) {
  const user = await validateAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY не настроен на сервере.' }, { status: 500 });
  }

  try {
    let buffer: Buffer | null = null;
    let mimeType = '';
    let filename = '';
    let googleDriveUrl = '';

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const urlField = formData.get('googleDriveUrl') as string | null;

      if (file && typeof file === 'object' && 'arrayBuffer' in file) {
        filename = file.name || 'invoice';
        mimeType = file.type || '';
        buffer = Buffer.from(await file.arrayBuffer());
      } else if (urlField) {
        googleDriveUrl = urlField.trim();
      }
    } else {
      const body = await request.json().catch(() => ({}));
      if (body.googleDriveUrl) googleDriveUrl = String(body.googleDriveUrl).trim();
    }

    if (!buffer && googleDriveUrl) {
      const gInfo = extractGoogleDriveInfo(googleDriveUrl);
      if (!gInfo) {
        return NextResponse.json({ error: 'Некорректная ссылка на Google Диск.' }, { status: 400 });
      }
      const fetched = await fetchGoogleDriveContent(gInfo);
      buffer = fetched.buffer;
      mimeType = fetched.mimeType;
      filename = fetched.filename;
    }

    if (!buffer || buffer.length === 0) {
      return NextResponse.json({ error: 'Файл счета или ссылка не предоставлены.' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const invoicePrompt = `Извлеки реквизиты из счета на оплату (инвойса / накладной) от поставщика.
Верни строгий JSON-объект со следующими полями:
- "supplierName": название компании-поставщика/продавца (ТОО / ИП, например: ТОО "ЭлектроСпецСнаб"). Не путай с покупателем ТОО "АзияЭнергоАвтоматика"!
- "invoiceNumber": номер счета на оплату (без слова "№", например: "142/АЭА" или "45").
- "invoiceDate": дата счета строго в формате "YYYY-MM-DD" (например: "2026-11-16", если дата не найдена — пустая строка "").
- "amount": итоговая сумма к оплате (число с точкой без пробелов и валюты, например: 150000.5; если не найдена — 0).
- "comment": краткое содержание счета (1 короткая строка: основные товары/услуги и условия оплаты, если указаны).`;

    let responseText = '';
    const lower = filename.toLowerCase();

    if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv') || mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let text = '';
      for (const name of workbook.SheetNames) {
        text += XLSX.utils.sheet_to_csv(workbook.Sheets[name]) + '\n';
      }
      responseText = await generateWithFallback(genAI, `${invoicePrompt}\n\nСодержимое счета:\n${text.slice(0, 40000)}`);
    } else if (lower.endsWith('.docx') || lower.endsWith('.doc') || mimeType.includes('word')) {
      const res = await mammoth.extractRawText({ buffer });
      responseText = await generateWithFallback(genAI, `${invoicePrompt}\n\nСодержимое счета:\n${(res.value || '').slice(0, 40000)}`);
    } else if (mimeType === 'text/plain') {
      responseText = await generateWithFallback(genAI, `${invoicePrompt}\n\nСодержимое счета:\n${buffer.toString('utf-8').slice(0, 40000)}`);
    } else {
      let detectedMime = mimeType;
      if (lower.endsWith('.pdf') || mimeType.includes('pdf')) detectedMime = 'application/pdf';
      else if (lower.endsWith('.png')) detectedMime = 'image/png';
      else if (lower.endsWith('.webp')) detectedMime = 'image/webp';
      else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || !detectedMime) detectedMime = 'image/jpeg';

      const filePart: Part = {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType: detectedMime,
        },
      };
      responseText = await generateWithFallback(genAI, [filePart, invoicePrompt]);
    }

    let clean = responseText.trim();
    if (clean.startsWith('```json')) clean = clean.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    else if (clean.startsWith('```')) clean = clean.replace(/^```\s*/, '').replace(/```\s*$/, '');

    const parsed = JSON.parse(clean);
    const data = Array.isArray(parsed) ? (parsed[0] || {}) : parsed;

    const rawAmt = data.amount ?? 0;
    const numAmt = typeof rawAmt === 'number' ? rawAmt : parseFloat(String(rawAmt).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;

    return NextResponse.json({
      success: true,
      data: {
        supplierName: String(data.supplierName || '').trim(),
        invoiceNumber: String(data.invoiceNumber || '').trim(),
        invoiceDate: /^\d{4}-\d{2}-\d{2}$/.test(String(data.invoiceDate || '').trim()) ? String(data.invoiceDate).trim() : '',
        amount: numAmt > 0 ? numAmt : 0,
        comment: String(data.comment || '').trim(),
      },
    });
  } catch (error: any) {
    console.error('Error in /api/purchases/parse-invoice:', error);
    return NextResponse.json(
      { error: error?.message || 'Не удалось распознать реквизиты счета' },
      { status: 500 }
    );
  }
}
