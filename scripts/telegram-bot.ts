import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { handleIncomingBotMessage } from '../src/lib/bot-logic';

const token = process.env.TELEGRAM_BOT_TOKEN || '';

if (!token) {
  console.log('⚠️ ВНИМАНИЕ: Переменная TELEGRAM_BOT_TOKEN не задана.');
  console.log('Реальный Telegram-бот отключен. Вы можете использовать встроенный симулятор телефона на веб-дашборде.');
  process.exit(0);
}

// Initialize Telegram Bot with polling
const bot = new TelegramBot(token, { polling: true });

console.log('🤖 Telegram-бот успешно запущен в режиме Long Polling...');

// Handle text messages and shared contacts
bot.on('message', async (msg) => {
  const chatId = msg.chat.id.toString();
  const text = msg.text || '';

  try {
    // 1. If user shared a contact
    if (msg.contact) {
      const phone = msg.contact.phone_number;
      console.log(`[BOT] Получен контакт от пользователя: ${msg.from?.first_name} (${phone})`);
      console.log(`[BOT] Запрос к базе данных для авторизации по контакту ${phone}...`);
      const response = await handleIncomingBotMessage({ phone, telegramId: chatId }, '/start');
      console.log(`[BOT] Ответ из базы данных по контакту получен. Текст ответа: "${response.replyText.substring(0, 50)}..."`);
      
      console.log(`[BOT] Отправляем приветствие после авторизации на chat_id ${chatId}...`);
      await bot.sendMessage(chatId, response.replyText, {
        parse_mode: 'Markdown',
        reply_markup: {
          remove_keyboard: true,
        },
      });
      console.log(`[BOT] Приветствие успешно отправлено на chat_id ${chatId}`);
      return;
    }

    // 2. If it's a standard text message / command
    console.log(`[BOT] Получено сообщение от chat_id ${chatId}: "${text}"`);
    
    console.log(`[BOT] Запрос к базе данных для telegramId ${chatId}...`);
    const response = await handleIncomingBotMessage({ telegramId: chatId }, text);
    console.log(`[BOT] Ответ из базы данных получен. Текст ответа: "${response.replyText.substring(0, 50)}..."`);

    // If user is not found, offer them to share contact
    if (response.isUnregistered) {
      console.log(`[BOT] Пользователь не найден. Отправляем запрос контакта на chat_id ${chatId}...`);
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
      console.log(`[BOT] Запрос контакта успешно отправлен на chat_id ${chatId}`);
    } else {
      // Send regular message with keyboard if available
      const options: any = {
        parse_mode: 'Markdown',
      };
      
      if (response.keyboard) {
        options.reply_markup = response.keyboard;
      }

      console.log(`[BOT] Отправляем обычный ответ на chat_id ${chatId}...`);
      await bot.sendMessage(chatId, response.replyText, options);
      console.log(`[BOT] Ответ успешно отправлен на chat_id ${chatId}`);
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
  const data = callbackQuery.data || '';

  try {
    console.log(`Получен клик по кнопке от telegramId ${telegramId}: "${data}"`);
    const response = await handleIncomingBotMessage({ telegramId }, data);

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
