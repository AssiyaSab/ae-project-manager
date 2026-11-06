import { NextRequest, NextResponse } from 'next/server';
import {
  handleIncomingBotMessage,
  hasActiveFsmState,
  isFsmCommandOrMenuButton,
  defaultUserKeyboard,
} from '@/lib/bot-logic';
import { sendTelegramMessage, answerTelegramCallbackQuery, getTelegramFileUrl } from '@/lib/telegram';
import { processAiMessage } from '@/lib/ai/agentDispatcher';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();

    // 1. Handle incoming direct message or contact
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat?.id?.toString();
      const telegramId = msg.from?.id?.toString();
      const username = msg.from?.username;
      const phone = msg.contact?.phone_number;
      const text = msg.text || msg.caption || (phone ? '/start' : '');

      let fileContext: { type: string; fileId: string; fileName?: string } | null = null;
      if (msg.document) {
        fileContext = { type: 'document', fileId: msg.document.file_id, fileName: msg.document.file_name };
      } else if (msg.photo && msg.photo.length > 0) {
        // Photos are sent as an array of sizes, last one is the largest
        fileContext = { type: 'photo', fileId: msg.photo[msg.photo.length - 1].file_id };
      }

      if (!chatId) {
        return NextResponse.json({ ok: true, note: 'No chatId found' });
      }

      // Check if user is known / registered
      let user = telegramId ? await prisma.user.findUnique({ where: { telegramId } }) : null;
      if (!user && phone) {
        const cleanDigits = phone.replace(/\D/g, '');
        if (cleanDigits.length >= 10) {
          user = await prisma.user.findFirst({
            where: { phone: { contains: cleanDigits.substring(cleanDigits.length - 10) } },
          });
        }
      }

      // If user is not yet authorized or sharing contact -> route to registration flow in FSM
      if (!user || phone) {
        const response = await handleIncomingBotMessage(
          { phone, telegramId, username },
          text,
          fileContext,
          msg.message_id,
          chatId
        );

        const options: any = { parse_mode: 'Markdown' };
        if (response.keyboard) options.reply_markup = response.keyboard;
        await sendTelegramMessage(chatId, response.replyText, options);
        return NextResponse.json({ ok: true });
      }

      // Check if user has an active FSM state or sent a menu/command button
      const inFsm = await hasActiveFsmState(user.id);
      const isCommandOrMenu = isFsmCommandOrMenuButton(text);

      if (inFsm || isCommandOrMenu) {
        // Strict FSM state controller
        const response = await handleIncomingBotMessage(
          { phone, telegramId, username },
          text,
          fileContext,
          msg.message_id,
          chatId
        );

        const options: any = { parse_mode: 'Markdown' };
        if (response.keyboard) options.reply_markup = response.keyboard;
        await sendTelegramMessage(chatId, response.replyText, options);
        return NextResponse.json({ ok: true });
      }

      // No active FSM state: Free text or photo/document intercepted by AI Agent Dispatcher
      let photoUrl: string | null = null;
      if (fileContext?.fileId) {
        photoUrl = await getTelegramFileUrl(fileContext.fileId);
      }

      const activeTask = await prisma.task.findFirst({
        where: {
          assignees: { some: { id: user.id } },
          status: { not: 'DONE' },
        },
        select: { projectId: true },
      });

      const aiResponse = await processAiMessage({
        text,
        photoUrl,
        user,
        activeProjectId: activeTask?.projectId,
      });

      await sendTelegramMessage(chatId, aiResponse.replyText, {
        parse_mode: 'Markdown',
        reply_markup: defaultUserKeyboard,
      });

      return NextResponse.json({ ok: true });
    }

    // 2. Handle callback queries from inline buttons
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat?.id?.toString();
      const messageId = cq.message?.message_id?.toString();
      const telegramId = cq.from?.id?.toString();
      const username = cq.from?.username;
      const data = cq.data || '';

      if (chatId) {
        const response = await handleIncomingBotMessage(
          { telegramId, username },
          data,
          null,
          messageId || null,
          chatId
        );

        if (response.replyText) {
          await sendTelegramMessage(chatId, response.replyText, {
            parse_mode: 'Markdown',
            reply_markup: response.keyboard,
          });
        }
      }

      if (cq.id) {
        await answerTelegramCallbackQuery(cq.id);
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true, note: 'Unhandled update type' });
  } catch (error) {
    console.error('Telegram Webhook error:', error);
    // Always return 200 to Telegram to prevent retry storm on unexpected exceptions
    return NextResponse.json({ ok: false, error: String(error) });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    service: 'AE Project Manager Telegram Webhook with Gemini AI Agent Dispatcher',
    timestamp: new Date().toISOString(),
  });
}
