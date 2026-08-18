/**
 * Serverless Telegram Bot API Helper for Next.js on Vercel.
 * Uses native fetch to avoid long-lived connection overhead in serverless environments.
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options?: {
    parse_mode?: 'Markdown' | 'HTML';
    reply_markup?: any;
  }
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN is not set. Cannot send message to Telegram.');
    return null;
  }

  try {
    const payload: any = {
      chat_id: chatId,
      text: text,
      parse_mode: options?.parse_mode ?? 'Markdown',
    };

    if (options?.reply_markup) {
      payload.reply_markup = options.reply_markup;
    }

    const response = await fetch(`${TELEGRAM_API_BASE}${token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!result.ok) {
      // Fallback: If Markdown parsing failed, try sending as plain text
      if (result.description && result.description.includes("can't parse entities")) {
        console.warn('⚠️ Telegram Markdown parse error, retrying as plain text...');
        const plainResponse = await fetch(`${TELEGRAM_API_BASE}${token}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: text,
            reply_markup: options?.reply_markup,
          }),
        });
        return await plainResponse.json();
      }
      console.error('❌ Telegram API error:', result);
    }
    return result;
  } catch (error) {
    console.error('❌ Failed to call Telegram sendMessage:', error);
    return null;
  }
}

export async function answerTelegramCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert: boolean = false
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;

  try {
    const response = await fetch(`${TELEGRAM_API_BASE}${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text,
        show_alert: showAlert,
      }),
    });
    return await response.json();
  } catch (error) {
    console.error('❌ Failed to call Telegram answerCallbackQuery:', error);
    return null;
  }
}

export async function setTelegramWebhook(webhookUrl: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not defined');

  const response = await fetch(`${TELEGRAM_API_BASE}${token}/setWebhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: webhookUrl,
      drop_pending_updates: true,
      allowed_updates: ['message', 'callback_query'],
    }),
  });

  return await response.json();
}

export async function getTelegramWebhookInfo() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not defined');

  const response = await fetch(`${TELEGRAM_API_BASE}${token}/getWebhookInfo`);
  return await response.json();
}
