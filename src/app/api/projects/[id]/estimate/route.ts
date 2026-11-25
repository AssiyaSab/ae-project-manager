import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateAuth, createAuditLog } from '@/lib/auth';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import * as XLSX from 'xlsx';
import { reconcileEstimateItem, reconcileProjectEstimate } from '@/lib/estimateReconcile';

export const dynamic = 'force-dynamic';

const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  'gemini-3-flash-preview',
  'gemini-flash-latest',
];

async function generateEstimateJson(contents: string | (string | Part)[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Не задан GEMINI_API_KEY на сервере');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
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
      console.warn(`[estimate] Model ${modelName} failed:`, err?.message || err);
      lastErr = err;
    }
  }
  throw lastErr || new Error('Модели Gemini временно недоступны');
}

function parseEstimateItemsJson(responseText: string) {
  let clean = responseText.trim();
  if (clean.startsWith('```json')) {
    clean = clean.replace(/^```json\s*/, '').replace(/```\s*$/, '');
  } else if (clean.startsWith('```')) {
    clean = clean.replace(/^```\s*/, '').replace(/```\s*$/, '');
  }
  let parsed: any;
  try {
    parsed = JSON.parse(clean);
  } catch {
    const start = clean.indexOf('[');
    const end = clean.lastIndexOf('}');
    if (start !== -1 && end > start) {
      parsed = JSON.parse(clean.slice(start, end + 1) + ']');
    } else {
      throw new Error('ИИ вернул некорректный JSON');
    }
  }
  const list = Array.isArray(parsed) ? parsed : (parsed.items || parsed.data || []);
  return list
    .map((it: any) => {
      const qty = parseFloat(String(it.plannedQty ?? it.quantity ?? it.qty ?? 1).replace(',', '.').replace(/\s+/g, '')) || 1;
      const price = parseFloat(String(it.plannedPrice ?? it.price ?? 0).replace(',', '.').replace(/\s+/g, '')) || 0;
      const rawTotal = parseFloat(String(it.plannedTotal ?? it.total ?? 0).replace(',', '.').replace(/\s+/g, '')) || 0;
      const total = rawTotal > 0 ? rawTotal : qty * price;
      return {
        name: String(it.name || it.title || '').trim(),
        article: it.article ? String(it.article).trim() : null,
        unit: String(it.unit || 'шт').trim() || 'шт',
        plannedQty: qty > 0 ? qty : 1,
        plannedPrice: price >= 0 ? price : 0,
        plannedTotal: total >= 0 ? total : 0,
      };
    })
    .filter((it: any) => it.name.length > 0);
}

const ESTIMATE_PROMPT =
  `Ты инженер-сметчик. Извлеки из документа ВСЕ позиции оборудования и материалов сметы проекта. ` +
  `Верни ТОЛЬКО JSON-массив объектов со следующими полями:\n` +
  `- "name": string (наименование оборудования/материала)\n` +
  `- "article": string | null (артикул, код, модель, бренд вроде ONKA, WEG, Schneider и т.п.)\n` +
  `- "unit": string (единица измерения, по умолчанию "шт")\n` +
  `- "plannedQty": number (количество по смете)\n` +
  `- "plannedPrice": number (плановая цена за 1 ед. в KZT, 0 если не указана)\n` +
  `- "plannedTotal": number (плановая сумма по строке в KZT, 0 если не указана)\n` +
  `Пропусти итоговые строки ("Итого", "Всего", "НДС") и пустые строки.`;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await validateAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const projectId = Number(id);
  if (!projectId) return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });

  try {
    const [estimateItems, unlinkedPurchaseItems] = await Promise.all([
      prisma.projectEstimateItem.findMany({
        where: { projectId },
        include: {
          purchaseItems: {
            include: {
              purchase: { select: { id: true, title: true, status: true, supplierName: true } },
              invoice: { select: { id: true, invoiceNumber: true, supplierName: true, status: true } },
            },
          },
        },
        orderBy: { id: 'asc' },
      }),
      prisma.purchaseItem.findMany({
        where: {
          estimateItemId: null,
          purchase: { projectId },
        },
        include: {
          purchase: { select: { id: true, title: true, status: true, supplierName: true } },
          invoice: { select: { id: true, invoiceNumber: true, supplierName: true, status: true } },
        },
        orderBy: { id: 'desc' },
      }),
    ]);

    return NextResponse.json({ estimateItems, unlinkedPurchaseItems });
  } catch (error) {
    console.error('GET /api/projects/[id]/estimate error:', error);
    return NextResponse.json({ error: 'Failed to fetch estimate' }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await validateAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const projectId = Number(id);
  if (!projectId) return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });

  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await request.json();

      if (body.action === 'RECONCILE') {
        await reconcileProjectEstimate(projectId);
        return NextResponse.json({ success: true });
      }

      if (body.action === 'ADD_ITEM') {
        const qty = Number(body.plannedQty) || 1;
        const price = Number(body.plannedPrice) || 0;
        const total = Number(body.plannedTotal) > 0 ? Number(body.plannedTotal) : qty * price;
        const created = await prisma.projectEstimateItem.create({
          data: {
            projectId,
            name: String(body.name || '').trim(),
            article: body.article ? String(body.article).trim() : null,
            unit: String(body.unit || 'шт').trim() || 'шт',
            plannedQty: qty,
            plannedPrice: price,
            plannedTotal: total,
          },
        });
        await reconcileProjectEstimate(projectId);
        return NextResponse.json({ created });
      }

      if (body.googleDriveUrl) {
        const match = String(body.googleDriveUrl).match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
        if (!match) {
          return NextResponse.json({ error: 'Укажите корректную ссылку на Google Таблицу' }, { status: 400 });
        }
        const csvUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
        const resp = await fetch(csvUrl);
        if (!resp.ok) {
          return NextResponse.json({ error: 'Не удалось скачать Google Таблицу (проверьте доступ по ссылке)' }, { status: 400 });
        }
        const csvText = await resp.text();
        const rawJson = await generateEstimateJson(`${ESTIMATE_PROMPT}\n\nТаблица CSV:\n${csvText.slice(0, 60000)}`);
        const items = parseEstimateItemsJson(rawJson);
        if (items.length === 0) {
          return NextResponse.json({ error: 'Позиции сметы не распознаны' }, { status: 400 });
        }
        await prisma.projectEstimateItem.createMany({
          data: items.map((it: any) => ({ projectId, ...it })),
        });
        await reconcileProjectEstimate(projectId);
        await createAuditLog(user.id || null, 'IMPORT_ESTIMATE', `Импортирована смета (${items.length} поз.) в проект #${projectId}`);
        return NextResponse.json({ importedCount: items.length });
      }

      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    // multipart/form-data (.xlsx, .xls, .csv, .pdf)
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Файл не передан' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const lowerName = file.name.toLowerCase();
    let parsedItems: any[] = [];

    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const chunks: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
        if (csv.trim()) chunks.push(`Лист "${sheetName}":\n${csv}`);
      }
      const fullCsv = chunks.join('\n\n').slice(0, 80000);
      const rawJson = await generateEstimateJson(`${ESTIMATE_PROMPT}\n\nСодержимое таблицы:\n${fullCsv}`);
      parsedItems = parseEstimateItemsJson(rawJson);
    } else if (lowerName.endsWith('.pdf') || file.type === 'application/pdf') {
      const part: Part = {
        inlineData: {
          mimeType: 'application/pdf',
          data: buffer.toString('base64'),
        },
      };
      const rawJson = await generateEstimateJson([ESTIMATE_PROMPT, part]);
      parsedItems = parseEstimateItemsJson(rawJson);
    } else {
      return NextResponse.json({ error: 'Поддерживаются только .xlsx, .xls, .csv и .pdf' }, { status: 400 });
    }

    if (parsedItems.length === 0) {
      return NextResponse.json({ error: 'ИИ не обнаружил позиций в файле сметы' }, { status: 400 });
    }

    await prisma.projectEstimateItem.createMany({
      data: parsedItems.map((it: any) => ({ projectId, ...it })),
    });
    await reconcileProjectEstimate(projectId);
    await createAuditLog(user.id || null, 'IMPORT_ESTIMATE', `Импортирована смета из файла ${file.name} (${parsedItems.length} поз.) в проект #${projectId}`);
    return NextResponse.json({ importedCount: parsedItems.length });
  } catch (error: any) {
    console.error('POST /api/projects/[id]/estimate error:', error);
    return NextResponse.json({ error: error?.message || 'Ошибка импорта сметы' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await validateAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const projectId = Number(id);
  if (!projectId) return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });

  try {
    const body = await request.json();

    if (body.action === 'LINK_OR_REPLACE') {
      const { estimateItemId, purchaseItemId, isReplacement, replacementNote } = body;
      if (!estimateItemId) {
        return NextResponse.json({ error: 'estimateItemId is required' }, { status: 400 });
      }
      if (purchaseItemId) {
        await prisma.purchaseItem.update({
          where: { id: Number(purchaseItemId) },
          data: {
            estimateItemId: Number(estimateItemId),
            isReplacement: Boolean(isReplacement),
          },
        });
      }
      if (replacementNote !== undefined || isReplacement) {
        await prisma.projectEstimateItem.update({
          where: { id: Number(estimateItemId) },
          data: {
            ...(replacementNote !== undefined ? { replacementNote: String(replacementNote) } : {}),
            ...(isReplacement ? { status: 'REPLACED' } : {}),
          },
        });
      }
      const updated = await reconcileEstimateItem(Number(estimateItemId));
      return NextResponse.json(updated);
    }

    const { itemId, name, article, unit, plannedQty, plannedPrice, plannedTotal, status, actualQty, actualTotal, replacementNote } = body;
    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    }
    const qty = plannedQty !== undefined ? Number(plannedQty) : undefined;
    const price = plannedPrice !== undefined ? Number(plannedPrice) : undefined;
    const computedTotal =
      plannedTotal !== undefined
        ? Number(plannedTotal)
        : qty !== undefined && price !== undefined
          ? qty * price
          : undefined;

    const updated = await prisma.projectEstimateItem.update({
      where: { id: Number(itemId) },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(article !== undefined ? { article: article ? String(article).trim() : null } : {}),
        ...(unit !== undefined ? { unit: String(unit).trim() } : {}),
        ...(qty !== undefined ? { plannedQty: qty } : {}),
        ...(price !== undefined ? { plannedPrice: price } : {}),
        ...(computedTotal !== undefined ? { plannedTotal: computedTotal } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(actualQty !== undefined ? { actualQty: Number(actualQty) } : {}),
        ...(actualTotal !== undefined ? { actualTotal: Number(actualTotal) } : {}),
        ...(replacementNote !== undefined ? { replacementNote: replacementNote || null } : {}),
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/projects/[id]/estimate error:', error);
    return NextResponse.json({ error: 'Failed to update estimate item' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await validateAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await context.params;
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get('itemId');
  if (!itemId) return NextResponse.json({ error: 'itemId is required' }, { status: 400 });

  try {
    await prisma.projectEstimateItem.delete({ where: { id: Number(itemId) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/projects/[id]/estimate error:', error);
    return NextResponse.json({ error: 'Failed to delete estimate item' }, { status: 500 });
  }
}
