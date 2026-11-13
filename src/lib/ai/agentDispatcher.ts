import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { prisma } from '@/lib/db';
import { User } from '@prisma/client';
import {
  aiToolsDeclarations,
  executeCreateFieldAlert,
  executeCreateQuickPurchase,
  executeParseReceiptOrInvoice,
} from './tools';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const SYSTEM_INSTRUCTION = `Ты — операционный ИИ-диспетчер ТОО "АзияЭнергоАвтоматика". Твоя задача — помогать инженерам, снабженцам и сборщикам компании.
Анализируй текст сообщений:
- Если инженер жалуется на остановку работ, задержку, нехватку оборудования или форс-мажор — определи проект и вызови инструмент createFieldAlert.
- Если сотрудник просит заказать или купить материалы — сформируй вызов createQuickPurchase.
- Если прислано фото документа — распознай реквизиты через parseReceiptOrInvoice.
- Всегда отвечай вежливо, кратко, по существу, на русском или казахском языке в зависимости от языка пользователя. Не обещай того, что не подтверждено системой.`;

/**
 * Downloads image from URL and converts to inline base64 part for Gemini Vision
 */
async function fetchImagePart(url: string): Promise<Part | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return {
      inlineData: {
        data: Buffer.from(arrayBuffer).toString('base64'),
        mimeType: contentType.split(';')[0].trim(),
      },
    };
  } catch (err) {
    console.error('Failed to download image for Gemini Vision:', err);
    return null;
  }
}

export interface ProcessAiMessageParams {
  text?: string;
  photoUrl?: string | null;
  user: User;
  activeProjectId?: number;
}

export interface ProcessAiMessageResult {
  replyText: string;
  actionTaken?: string;
  toolResults?: any[];
}

/**
 * Returns a generative model, trying gemini-2.5-flash first with automatic fallback
 */
function getGenerativeModel(modelName: string) {
  if (!genAI) throw new Error('GEMINI_API_KEY is not configured');
  return genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_INSTRUCTION,
    tools: [{ functionDeclarations: aiToolsDeclarations }],
  });
}

/**
 * Main dispatcher function to process free-form user messages and photos
 */
export async function processAiMessage(
  params: ProcessAiMessageParams
): Promise<ProcessAiMessageResult> {
  const { text = '', photoUrl, user, activeProjectId } = params;
  const cleanText = text.trim();

  // If no Gemini API key configured, return friendly notification
  if (!genAI) {
    return {
      replyText:
        '⚠️ Сервис ИИ-диспетчера временно недоступен: не настроен ключ GEMINI_API_KEY. Пожалуйста, обратитесь к администратору или воспользуйтесь кнопочным меню.',
    };
  }

  // Fetch available projects to enrich context
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, status: true },
    take: 20,
    orderBy: { id: 'asc' },
  });

  const projectListStr = projects.map((p) => `#${p.id} "${p.name}" (${p.status})`).join(', ');

  const contextPrompt =
    `Контекст текущего пользователя:\n` +
    `• Имя: ${user.name}\n` +
    `• Роль: ${user.role} (${user.title || 'Сотрудник'})\n` +
    (activeProjectId ? `• Активный проект ID: ${activeProjectId}\n` : '') +
    `• Список доступных проектов в компании: ${projectListStr || 'Нет проектов'}\n\n` +
    (cleanText ? `Сообщение от пользователя:\n"${cleanText}"` : 'Пользователь прикрепил документ / фотографию.');

  // Try candidate models starting with gemini-3.5-flash
  const candidateModels = [
    process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    'gemini-3-flash-preview',
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest',
  ];

  let lastError: any = null;

  for (const modelName of candidateModels) {
    try {
      const model = getGenerativeModel(modelName);
      const chat = model.startChat();

      const userParts: (string | Part)[] = [contextPrompt];

      if (photoUrl) {
        const imagePart = await fetchImagePart(photoUrl);
        if (imagePart) {
          userParts.push(imagePart);
        }
      }

      // Step 1: Initial call to model
      const result = await chat.sendMessage(userParts);
      const calls = result.response.functionCalls();

      const executedCalls: any[] = [];
      let finalReplyText = '';

      if (calls && calls.length > 0) {
        // Step 2: Execute each tool call
        for (const call of calls) {
          const fnName = call.name;
          const fnArgs = call.args as any;
          let executionResult: any = null;

          if (fnName === 'createFieldAlert') {
            executionResult = await executeCreateFieldAlert(
              {
                projectId: Number(fnArgs.projectId) || activeProjectId || projects[0]?.id || 1,
                description: String(fnArgs.description || cleanText),
                severity: fnArgs.severity,
              },
              { user, photoUrl, activeProjectId }
            );
          } else if (fnName === 'createQuickPurchase') {
            executionResult = await executeCreateQuickPurchase(
              {
                title: String(fnArgs.title || cleanText),
                estimatedAmount: Number(fnArgs.estimatedAmount) || undefined,
                projectId: Number(fnArgs.projectId) || activeProjectId || projects[0]?.id || 1,
              },
              { user, photoUrl, activeProjectId }
            );
          } else if (fnName === 'parseReceiptOrInvoice') {
            executionResult = await executeParseReceiptOrInvoice(
              {
                supplierName: fnArgs.supplierName,
                invoiceNumber: fnArgs.invoiceNumber,
                amount: Number(fnArgs.amount) || 0,
                items: fnArgs.items,
                bin: fnArgs.bin,
              },
              { user, photoUrl, activeProjectId }
            );
          }

          executedCalls.push({
            name: fnName,
            args: fnArgs,
            result: executionResult,
          });

          // Send function result back to Gemini so it forms a friendly conversational confirmation
          const secondTurnResult = await chat.sendMessage([
            {
              functionResponse: {
                name: fnName,
                response: executionResult || { success: true },
              },
            },
          ]);

          finalReplyText += secondTurnResult.response.text();
        }
      } else {
        // No function called, return text response
        finalReplyText = result.response.text();
      }

      // Step 3: Record invocation in AuditLog
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'AI_AGENT_INVOKED',
          details: JSON.stringify({
            model: modelName,
            userText: cleanText || '(фото)',
            hasPhoto: !!photoUrl,
            executedTools: executedCalls.map((c) => c.name),
            replyPreview: finalReplyText.substring(0, 200),
          }),
        },
      });

      return {
        replyText: finalReplyText.trim(),
        actionTaken: executedCalls.length > 0 ? executedCalls[0].name : undefined,
        toolResults: executedCalls,
      };
    } catch (err: any) {
      console.warn(`Model ${modelName} failed, evaluating fallback:`, err.message || err);
      lastError = err;
      // If error is 404 (model deprecated / unavailable), continue to next fallback model
      const msg = String(err.message || '');
      if (msg.includes('404') || msg.includes('not found') || msg.includes('503')) {
        continue;
      }
      break;
    }
  }

  console.error('All AI Agent Dispatcher models failed:', lastError);

  // Fallback: If AI fails, return polite fallback message
  return {
    replyText:
      `🤖 *ИИ-Диспетчер (АзияЭнергоАвтоматика):*\n\n` +
      `Ваше сообщение получено. Система обрабатывает запрос. Если вам требуется срочно создать заявку или зафиксировать блокер, пожалуйста, используйте пункты главного меню ниже.`,
  };
}
