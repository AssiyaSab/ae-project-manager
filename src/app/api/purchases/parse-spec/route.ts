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
          maxOutputTokens: 65536,
          temperature: 0.1,
        },
      });
      const res = await model.generateContent(contents);
      return res.response.text();
    } catch (err: any) {
      console.warn(`[parse-spec] Model ${modelName} failed:`, err?.message || err);
      lastErr = err;
    }
  }
  throw lastErr || new Error('Все доступные модели Gemini временно недоступны.');
}

function parseJsonItemsSafely(responseText: string): any[] {
  let cleanText = responseText.trim();
  if (cleanText.startsWith('```json')) {
    cleanText = cleanText.replace(/^```json\s*/, '').replace(/```\s*$/, '');
  } else if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```\s*/, '').replace(/```\s*$/, '');
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(cleanText);
  } catch {
    // Попытка восстановить обрезанный JSON-массив, если документ был экстремально длинным
    const arrStart = cleanText.indexOf('[');
    const lastObjEnd = cleanText.lastIndexOf('}');
    if (arrStart !== -1 && lastObjEnd > arrStart) {
      try {
        const salvaged = cleanText.slice(arrStart, lastObjEnd + 1) + ']';
        parsed = JSON.parse(salvaged);
      } catch {
        throw new Error('ИИ вернул неструктурированный ответ. Попробуйте еще раз или проверьте четкость документа.');
      }
    } else {
      throw new Error('ИИ вернул неструктурированный ответ. Попробуйте еще раз или проверьте четкость документа.');
    }
  }

  const rawList = Array.isArray(parsed) ? parsed : (parsed.items || parsed.products || parsed.materials || parsed.data || []);
  return rawList
    .map((item: any) => {
      const rawQty = item.quantity ?? item.qty ?? item.count ?? 1;
      const numQty = typeof rawQty === 'number' ? rawQty : parseFloat(String(rawQty).replace(',', '.').replace(/\s+/g, '')) || 1;
      const rawPrice = item.price ?? item.cost ?? 0;
      const numPrice = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice).replace(',', '.').replace(/\s+/g, '')) || 0;
      return {
        name: String(item.name || item.title || item.description || '').trim(),
        quantity: numQty > 0 ? numQty : 1,
        unit: String(item.unit || item.uom || item.measure || 'шт').trim(),
        price: numPrice >= 0 ? numPrice : 0,
        total: (numPrice >= 0 ? numPrice : 0) * (numQty > 0 ? numQty : 1),
      };
    })
    .filter((item: any) => item.name.length > 0);
}

function extractGoogleDriveInfo(url: string): { type: 'spreadsheet' | 'document' | 'file'; id: string } | null {
  if (!url) return null;
  const cleanUrl = url.trim();

  const sheetMatch = cleanUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (sheetMatch && sheetMatch[1]) {
    return { type: 'spreadsheet', id: sheetMatch[1] };
  }

  const docMatch = cleanUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docMatch && docMatch[1]) {
    return { type: 'document', id: docMatch[1] };
  }

  const fileMatch = cleanUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch && fileMatch[1]) {
    return { type: 'file', id: fileMatch[1] };
  }

  const idMatch = cleanUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return { type: 'file', id: idMatch[1] };
  }

  const genericMatch = cleanUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (genericMatch && genericMatch[1]) {
    return { type: 'file', id: genericMatch[1] };
  }

  return null;
}

async function fetchGoogleDriveContent(info: { type: 'spreadsheet' | 'document' | 'file'; id: string }) {
  let downloadUrl = '';
  if (info.type === 'spreadsheet') {
    downloadUrl = `https://docs.google.com/spreadsheets/d/${info.id}/export?format=csv`;
  } else if (info.type === 'document') {
    downloadUrl = `https://docs.google.com/document/d/${info.id}/export?format=txt`;
  } else {
    downloadUrl = `https://drive.google.com/uc?export=download&id=${info.id}`;
  }

  const res = await fetch(downloadUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`Google Drive вернул ошибку HTTP ${res.status}: ${res.statusText}. Убедитесь, что ссылка открыта для просмотра.`);
  }

  const contentType = res.headers.get('content-type') || '';
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const previewText = buffer.slice(0, 1000).toString('utf-8');
  if (
    (contentType.includes('text/html') || previewText.includes('<!DOCTYPE html') || previewText.includes('<html')) &&
    (previewText.includes('ServiceLogin') || previewText.includes('accounts.google.com') || previewText.includes('Google Drive – Access Denied') || previewText.includes('AccessDenied'))
  ) {
    throw new Error('Файл на Google Диске защищен или закрыт для публичного доступа. Откройте общий доступ: «Все, у кого есть ссылка — Читатель», либо загрузите файл напрямую с компьютера.');
  }

  let mimeType = contentType.split(';')[0].trim();
  let filename = 'drive_file';

  if (info.type === 'spreadsheet') {
    mimeType = 'text/csv';
    filename = 'export.csv';
  } else if (info.type === 'document') {
    mimeType = 'text/plain';
    filename = 'document.txt';
  }

  return { buffer, mimeType, filename };
}

function isExcelOrCsv(mimeType: string, filename: string): boolean {
  const lowerName = (filename || '').toLowerCase();
  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) {
    return true;
  }
  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType.includes('csv') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'text/csv'
  ) {
    return true;
  }
  return false;
}

function isWordDocument(mimeType: string, filename: string): boolean {
  const lower = (filename || '').toLowerCase();
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) {
    return true;
  }
  if (
    mimeType.includes('wordprocessingml') ||
    mimeType.includes('msword') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    return true;
  }
  return false;
}

function isImageFile(mimeType: string, filename: string): boolean {
  const lower = (filename || '').toLowerCase();
  if (
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.bmp') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.heic')
  ) {
    return true;
  }
  if (mimeType.startsWith('image/')) {
    return true;
  }
  return false;
}

/**
 * Splits text lines into chunks of maxChars / maxLines so no items are skipped by the LLM.
 */
function chunkTextLines(text: string, maxLines = 40, maxChars = 12000): string[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentLen = 0;

  for (const line of lines) {
    if (
      currentChunk.length > 0 &&
      (currentChunk.length >= maxLines || currentLen + line.length > maxChars)
    ) {
      chunks.push(currentChunk.join('\n'));
      currentChunk = [];
      currentLen = 0;
    }
    currentChunk.push(line);
    currentLen += line.length + 1;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'));
  }

  return chunks;
}

export async function POST(request: Request) {
  const user = await validateAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Ключ GEMINI_API_KEY не задан в переменных окружения (.env). Обратитесь к администратору.' },
      { status: 500 }
    );
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
        filename = file.name || 'uploaded_file';
        mimeType = file.type || '';
        const bytes = await file.arrayBuffer();
        buffer = Buffer.from(bytes);
      } else if (urlField) {
        googleDriveUrl = urlField.trim();
      }
    } else {
      const body = await request.json().catch(() => ({}));
      if (body.googleDriveUrl) {
        googleDriveUrl = String(body.googleDriveUrl).trim();
      }
    }

    if (!buffer && googleDriveUrl) {
      const gInfo = extractGoogleDriveInfo(googleDriveUrl);
      if (!gInfo) {
        return NextResponse.json(
          { error: 'Неверный формат ссылки на Google Диск / Документ / Таблицу. Поддерживаются ссылки вида drive.google.com/file/d/..., docs.google.com/spreadsheets/d/... и docs.google.com/document/d/...' },
          { status: 400 }
        );
      }
      const fetched = await fetchGoogleDriveContent(gInfo);
      buffer = fetched.buffer;
      mimeType = fetched.mimeType;
      filename = fetched.filename;
    }

    if (!buffer || buffer.length === 0) {
      return NextResponse.json(
        { error: 'Файл или ссылка на документ не предоставлены, либо файл пуст.' },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const systemPrompt =
      'Извлеки из документа/фотографии АБСОЛЮТНО ВСЕ строки закупаемых товаров, оборудования и материалов (без исключения, не сокращай и не пропускай позиции, включая все листы и страницы). ' +
      'Если артикул, марка, модель или ГОСТ указаны в отдельной колонке — объединяй их с названием в поле name. ' +
      'Верни строгий JSON-массив объектов с полями: name (полное наименование и характеристики), quantity (число, если не указано — 1), unit (единица измерения: шт, м, компл и т.д.). ' +
      'Игнорируй только шапки таблиц, итоги, реквизиты, подписи и пустые строки.';

    let allItems: any[] = [];
    const isSpreadsheet = isExcelOrCsv(mimeType, filename);
    const isWord = isWordDocument(mimeType, filename);
    const isImage = isImageFile(mimeType, filename);

    if (isSpreadsheet) {
      // --- EXCEL / CSV: очищаем пустые колонки/строки и обрабатываем чанками по 35 строк ---
      const sheetBlocks: { sheetName: string; header: string; rows: string[] }[] = [];
      try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
          const cleanLines: string[] = [];
          for (const row of rawRows) {
            if (!Array.isArray(row)) continue;
            // Убираем пустые ячейки с конца и чистим переносы внутри ячеек
            const formattedCells = row.map((c) => String(c ?? '').replace(/\s+/g, ' ').trim());
            while (formattedCells.length > 0 && formattedCells[formattedCells.length - 1] === '') {
              formattedCells.pop();
            }
            if (formattedCells.some((c) => c !== '')) {
              cleanLines.push(formattedCells.join(' | '));
            }
          }
          if (cleanLines.length > 0) {
            // Первые 2 строки берем как возможную шапку, чтобы прикладывать к каждому чанку
            const header = cleanLines.slice(0, Math.min(2, cleanLines.length)).join('\n');
            const bodyRows = cleanLines.length > 2 ? cleanLines.slice(2) : cleanLines;
            sheetBlocks.push({ sheetName, header, rows: bodyRows });
          }
        }
      } catch (xlsxErr) {
        console.warn('XLSX parsing failed, fallback to raw text/utf8:', xlsxErr);
        const fallbackText = buffer.slice(0, 150000).toString('utf-8');
        const chunks = chunkTextLines(fallbackText, 35, 12000);
        for (const chunk of chunks) {
          const responseText = await generateWithFallback(
            genAI,
            `${systemPrompt}\n\nЧасть таблицы:\n${chunk}`
          );
          allItems.push(...parseJsonItemsSafely(responseText));
        }
      }

      if (sheetBlocks.length === 0 && allItems.length === 0) {
        return NextResponse.json({ error: 'Не удалось прочитать содержимое таблицы. Файл пуст.' }, { status: 400 });
      }

      const CHUNK_SIZE = 35;
      for (const block of sheetBlocks) {
        if (block.rows.length <= CHUNK_SIZE) {
          const content = `--- Лист: ${block.sheetName} ---\n${block.header}\n${block.rows.join('\n')}`;
          const responseText = await generateWithFallback(
            genAI,
            `${systemPrompt}\n\nСодержимое документа спецификации (Excel/CSV):\n${content}`
          );
          allItems.push(...parseJsonItemsSafely(responseText));
        } else {
          // Разбиваем длинную таблицу на порции по 35 строк с сохранением шапки
          for (let i = 0; i < block.rows.length; i += CHUNK_SIZE) {
            const slice = block.rows.slice(i, i + CHUNK_SIZE);
            const content = `--- Лист: ${block.sheetName} (строки ${i + 1}-${i + slice.length}) ---\nШапка таблицы:\n${block.header}\n\nСтроки данных:\n${slice.join('\n')}`;
            const responseText = await generateWithFallback(
              genAI,
              `${systemPrompt}\n\n${content}`
            );
            allItems.push(...parseJsonItemsSafely(responseText));
          }
        }
      }
    } else if (isWord) {
      // --- WORD (.docx / .doc) ---
      let docText = '';
      try {
        const result = await mammoth.extractRawText({ buffer });
        docText = result.value || '';
      } catch (docErr) {
        console.warn('Mammoth extraction failed, fallback to raw string extraction:', docErr);
        docText = buffer.toString('utf-8');
      }

      if (!docText.trim()) {
        return NextResponse.json({ error: 'Не удалось извлечь текст из Word-документа. Файл пуст или защищен.' }, { status: 400 });
      }

      const chunks = chunkTextLines(docText, 60, 12000);
      for (const chunk of chunks) {
        const responseText = await generateWithFallback(
          genAI,
          `${systemPrompt}\n\nСодержимое документа спецификации (Word):\n${chunk}`
        );
        allItems.push(...parseJsonItemsSafely(responseText));
      }
    } else if (mimeType === 'text/plain') {
      // --- PLAIN TEXT (Google Docs export) ---
      const plainText = buffer.toString('utf-8');
      const chunks = chunkTextLines(plainText, 60, 12000);
      for (const chunk of chunks) {
        const responseText = await generateWithFallback(
          genAI,
          `${systemPrompt}\n\nСодержимое документа:\n${chunk}`
        );
        allItems.push(...parseJsonItemsSafely(responseText));
      }
    } else {
      // --- PDF OR PHOTO / IMAGE ---
      let detectedMime = mimeType;
      const lower = filename.toLowerCase();
      if (lower.endsWith('.pdf') || mimeType.includes('pdf')) {
        detectedMime = 'application/pdf';
      } else if (lower.endsWith('.png')) {
        detectedMime = 'image/png';
      } else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
        detectedMime = 'image/jpeg';
      } else if (lower.endsWith('.webp')) {
        detectedMime = 'image/webp';
      } else if (lower.endsWith('.bmp')) {
        detectedMime = 'image/bmp';
      } else if (lower.endsWith('.heic')) {
        detectedMime = 'image/heic';
      } else if (!detectedMime) {
        detectedMime = isImage ? 'image/jpeg' : 'application/pdf';
      }

      const filePart: Part = {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType: detectedMime,
        },
      };

      const visionPrompt = isImage
        ? 'Извлеки из этого фото/скана (чек, счет, накладная, шильдик, список от руки или распечатка) АБСОЛЮТНО ВСЕ строки товаров/материалов без пропусков. Верни строгий JSON-массив объектов с полями: name (наименование и характеристики), quantity (число, если не указано — 1), unit (единица измерения: шт, м, компл, кг и т.д.). Игнорируй шапки таблиц, реквизиты, подписи и пустые строки.'
        : systemPrompt;

      const responseText = await generateWithFallback(genAI, [filePart, visionPrompt]);
      allItems.push(...parseJsonItemsSafely(responseText));
    }

    return NextResponse.json({
      success: true,
      count: allItems.length,
      items: allItems,
    });
  } catch (error: any) {
    console.error('Error in /api/purchases/parse-spec:', error);
    return NextResponse.json(
      { error: error?.message || 'Не удалось распознать спецификацию из документа' },
      { status: 500 }
    );
  }
}
