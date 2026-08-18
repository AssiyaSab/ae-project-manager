import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { handleIncomingBotMessage } from '../src/lib/bot-logic';

const token = process.env.TELEGRAM_BOT_TOKEN || '';

if (!token) {
  console.log('⚠️ ВНИМАНИЕ: Переменная TELEGRAM_BOT_TOKEN не задана.');
  console.log('Реальный Telegram-бот отключен. Вы можете использовать встроенный симулятор телефона на веб-дашборде.');
  process.exit(0);
}

// Initialize Telegram Bot without auto polling first
const bot = new TelegramBot(token, { polling: false });

async function start() {
  try {
    // Delete any webhook that might be active so polling doesn't conflict
    await bot.deleteWebHook();
    await bot.startPolling();
    console.log('🤖 Telegram-бот успешно запущен в режиме Long Polling...');
  } catch (err) {
    console.error('Ошибка инициализации polling бота:', err);
  }
}

start();

// Handle text messages and shared contacts
bot.on('message', async (msg) => {
  const chatId = msg.chat.id.toString();
  const telegramId = msg.from?.id?.toString();
  const username = msg.from?.username;
  const text = msg.text || '';

  try {
    // 1. If user shared a contact
    if (msg.contact) {
      const phone = msg.contact.phone_number;
      console.log(`[BOT] Получен контакт от пользователя: ${msg.from?.first_name} (${phone})`);
      const response = await handleIncomingBotMessage({ phone, telegramId: chatId, username }, '/start');
      
      await bot.sendMessage(chatId, response.replyText, {
        parse_mode: 'Markdown',
        reply_markup: {
          remove_keyboard: true,
        },
      });
      return;
    }

    // 2. If it's a standard text message / command
    console.log(`[BOT] Получено сообщение от chat_id ${chatId}: "${text}"`);
    const response = await handleIncomingBotMessage({ telegramId: chatId, username }, text);

    // If user is not found, offer them to share contact
    if (response.isUnregistered) {
      await bot.sendMessage(chatId, response.replyText, {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            [{ text: '📱 Поделиться контактом для авторизации', request_contact: true }]
          ],
          one_time_keyboard: true,
          resize_keyboard: true
        }
      });
    } else {
      // Send regular message with keyboard if available
      const options: any = {
        parse_mode: 'Markdown',
      };
      
      if (response.keyboard) {
        options.reply_markup = response.keyboard;
      }

      await bot.sendMessage(chatId, response.replyText, options);
    }
  } catch (error) {
    console.error('[BOT] Ошибка обработки сообщения в Telegram-боте:', error);
    try {
      await bot.sendMessage(chatId, '🔴 Произошла внутренняя ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.');
    } catch (sendError) {
      console.error('[BOT] Не удалось отправить сообщение об ошибке:', sendError);
    }
  }
});

// Handle callback queries from inline buttons
bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  if (!message) return;

  const chatId = message.chat.id.toString();
  const telegramId = callbackQuery.from.id.toString();
  const username = callbackQuery.from.username;
  const data = callbackQuery.data || '';

  try {
    console.log(`Получен клик по кнопке от telegramId ${telegramId}: "${data}"`);
    const response = await handleIncomingBotMessage({ telegramId, username }, data);

    await bot.sendMessage(chatId, response.replyText, {
      parse_mode: 'Markdown',
    });

    // Acknowledge the callback query
    await bot.answerCallbackQuery(callbackQuery.id);
  } catch (error) {
    console.error('Ошибка обработки callback в Telegram-боте:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Ошибка при изменении статуса' });
  }
});
