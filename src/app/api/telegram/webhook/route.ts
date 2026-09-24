import { NextRequest, NextResponse } from 'next/server';
import { handleIncomingBotMessage } from '@/lib/bot-logic';
import { sendTelegramMessage, answerTelegramCallbackQuery } from '@/lib/telegram';

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

      let fileContext = null;
      if (msg.document) {
        fileContext = { type: 'document', fileId: msg.document.file_id, fileName: msg.document.file_name };
      } else if (msg.photo && msg.photo.length > 0) {
        // Photos are sent as an array of sizes, last one is the largest
        fileContext = { type: 'photo', fileId: msg.photo[msg.photo.length - 1].file_id };
      }

      if (!chatId) {
        return NextResponse.json({ ok: true, note: 'No chatId found' });
      }

      const response = await handleIncomingBotMessage(
        { phone, telegramId, username },
        text,
        fileContext,
        msg.message_id,
        chatId
      );

      const options: any = {
        parse_mode: 'Markdown',
      };

      if (response.keyboard) {
        options.reply_markup = response.keyboard;
      }

      await sendTelegramMessage(chatId, response.replyText, options);

      return NextResponse.json({ ok: true });
    }

    // 2. Handle callback queries from inline buttons
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat?.id?.toString();
      const telegramId = cq.from?.id?.toString();
      const username = cq.from?.username;
      const data = cq.data || '';

      if (chatId) {
        const response = await handleIncomingBotMessage(
          { telegramId, username },
          data
        );

        await sendTelegramMessage(chatId, response.replyText, {
          parse_mode: 'Markdown',
        });
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
    service: 'AE Project Manager Telegram Webhook',
    timestamp: new Date().toISOString(),
  });
}
