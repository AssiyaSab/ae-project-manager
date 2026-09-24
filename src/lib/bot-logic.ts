import { prisma } from './db';
import { analyzeReport } from './gemini';
import { sendTelegramMessage, forwardTelegramMessage } from './telegram';

export interface BotResponse {
  replyText: string;
  keyboard?: any; // Telegram keyboard markup
  updatedTask?: any;
  createdAlert?: any;
  isUnregistered?: boolean;
}

/**
 * Sends notifications to GIP / Project Managers when a task blocker occurs
 */
async function notifyManagersAboutBlocker(
  project: { name: string; manager?: { telegramId: string | null } | null },
  task: { name: string },
  user: { name: string; role: string; telegramId?: string | null },
  reason: string
) {
  try {
    const recipients = new Set<string>();

    if (project.manager?.telegramId) {
      recipients.add(project.manager.telegramId);
    }

    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'GIP'] }, telegramId: { not: null }, isActive: true },
    });

    admins.forEach((admin) => {
      if (admin.telegramId) recipients.add(admin.telegramId);
    });

    if (user.telegramId) {
      recipients.delete(user.telegramId);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ae-project-manager-nu.vercel.app';
    const alertMessage =
      `🚨 *ВНИМАНИЕ, ГИП! ОБНАРУЖЕН БЛОКЕР*\n\n` +
      `• Объект: *${project.name}*\n` +
      `• Раздел / Задача: *${task.name}*\n` +
      `• Исполнитель: *${user.name}* (${user.role})\n` +
      `• Причина: _${reason}_\n\n` +
      `🔗 [Открыть панель управления](${appUrl})`;

    for (const chatId of recipients) {
      await sendTelegramMessage(chatId, alertMessage);
    }
  } catch (error) {
    console.error('Failed to notify project managers about blocker:', error);
  }
}

export async function handleIncomingBotMessage(
  identifier: { phone?: string; telegramId?: string; username?: string },
  text: string,
  fileContext: any = null,
  messageId: string | null = null,
  chatId: string | null = null
): Promise<BotResponse> {
  const { phone, telegramId, username } = identifier;
  const cleanText = text.trim();

  // 1. Find or bind user
  let user = null;
  if (telegramId) {
    user = await prisma.user.findUnique({ where: { telegramId } });
  }

  let candidatePhone = phone;
  if (!candidatePhone) {
    const phoneMatch = cleanText.match(/(?:\+?7|8)?[\s\-(\.]*(\d{3})[\s\-)\.]*(\d{3})[\s\-.]*(\d{2})[\s\-.]*(\d{2})/);
    if (phoneMatch) candidatePhone = cleanText.replace(/[\s\-\(\)\.]/g, '');
  }

  if (!user && candidatePhone) {
    const cleanPhoneDigits = candidatePhone.replace(/\D/g, '');
    if (cleanPhoneDigits.length >= 10) {
      const last10 = cleanPhoneDigits.substring(cleanPhoneDigits.length - 10);
      user = await prisma.user.findFirst({ where: { phone: { contains: last10 } } });
      if (user && telegramId && !user.telegramId) {
        user = await prisma.user.update({ where: { id: user.id }, data: { telegramId } });
      }
    }
  }

  if (!user && username) {
    const cleanUsername = username.replace('@', '').toLowerCase();
    const candidates = await prisma.user.findMany({ where: { telegramId: null } });
    const matchedCandidate = candidates.find((c) => c.name.toLowerCase().includes(cleanUsername));
    if (matchedCandidate && telegramId) {
      user = await prisma.user.update({ where: { id: matchedCandidate.id }, data: { telegramId } });
    }
  }

  if (!user) {
    return {
      replyText:
        `👋 Здравствуйте!\n\nВы еще не авторизованы в системе *AE Project Manager*.\n\n` +
        `📱 Чтобы привязать свой аккаунт, нажмите кнопку *«Поделиться контактом»* ниже или просто отправьте свой номер телефона в чат.\n\n` +
        `_Ваш Telegram ID: \`${telegramId || 'Неизвестен'}\`_`,
      isUnregistered: true,
      keyboard: {
        keyboard: [[{ text: '📱 Поделиться контактом для авторизации', request_contact: true }]],
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    };
  }

  // 1.5 Handle File Upload (Document/Photo)
  if (fileContext && messageId && chatId) {
    // Notify all admins about the file
    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'GIP'] }, telegramId: { not: null }, isActive: true },
    });
    
    let forwardedCount = 0;
    for (const admin of admins) {
      if (admin.telegramId && admin.telegramId !== telegramId) {
        await sendTelegramMessage(
          admin.telegramId, 
          `📎 *Новый файл от сотрудника: ${user.name}* (${user.role})\n` +
          `${cleanText ? `Комментарий: _${cleanText}_\n` : ''}` +
          `Пересылаю сам файл:`
        );
        await forwardTelegramMessage(admin.telegramId, chatId, messageId);
        forwardedCount++;
      }
    }

    if (forwardedCount > 0) {
      return {
        replyText: `✅ Файл успешно получен и переслан руководству (ГИП).`,
      };
    } else {
      return {
        replyText: `✅ Файл получен. (Обратите внимание: в системе сейчас нет активных администраторов с привязанным Telegram).`,
      };
    }
  }

  // 2. Handle button callbacks (Inline Queries / Text Commands)
  const taskInProgressMatch = cleanText.match(/^task_inprogress_(\d+)$/);
  const taskOtkMatch = cleanText.match(/^task_otk_(\d+)$/);
  const taskBlockedMatch = cleanText.match(/^task_blocked_(\d+)$/);
  const taskDoneMatch = cleanText.match(/^task_done_(\d+)$/);

  if (taskInProgressMatch || taskOtkMatch || taskBlockedMatch || taskDoneMatch) {
    let taskId = 0;
    let newStatus = '';
    let alertText = '';

    if (taskInProgressMatch) {
      taskId = Number(taskInProgressMatch[1]);
      newStatus = 'IN_PROGRESS';
    } else if (taskOtkMatch) {
      taskId = Number(taskOtkMatch[1]);
      newStatus = 'OTK';
    } else if (taskBlockedMatch) {
      taskId = Number(taskBlockedMatch[1]);
      newStatus = 'BLOCKED';
      alertText = 'Ручная блокировка через Telegram-бот';
    } else if (taskDoneMatch) {
      taskId = Number(taskDoneMatch[1]);
      newStatus = 'DONE';
    }

    // Verify task belongs to or is assigned to this user (or user is admin/GIP)
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: { manager: true },
        },
        assignees: true,
      },
    });

    const isAssigned = task?.assignees.some((a: any) => a.id === user.id);
    const isPrivileged = user.role === 'ADMIN' || user.role === 'GIP';

    if (!task || (!isAssigned && !isPrivileged)) {
      return {
        replyText: '⚠️ Ошибка: Задача не найдена или назначена другому исполнителю.',
      };
    }

    // Update status
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { status: newStatus },
    });

    let createdAlert = null;
    if (newStatus === 'BLOCKED') {
      createdAlert = await prisma.alert.create({
        data: {
          taskId,
          text: alertText,
          status: 'ACTIVE',
        },
      });

      // Notify GIP about the manual block
      await notifyManagersAboutBlocker(task.project, task, user, alertText);
    } else if (newStatus === 'DONE' || newStatus === 'IN_PROGRESS') {
      // Resolve any active alerts
      await prisma.alert.updateMany({
        where: { taskId, status: 'ACTIVE' },
        data: { status: 'RESOLVED' },
      });
    }

    const statusLabels: Record<string, string> = {
      IN_PROGRESS: '▶️ В работе',
      OTK: '🔍 На проверке (ОТК)',
      BLOCKED: '⚠️ Заблокировано (БЛОК)',
      DONE: '✅ Завершено',
    };

    return {
      replyText: `Статус задачи *«${task.name}»* изменен на:\n*${statusLabels[newStatus] || newStatus}*`,
      updatedTask,
      createdAlert,
    };
  }

  // 3. Command "/start", "Привет", "/tasks", "/help"
  if (cleanText === '/start' || cleanText.toLowerCase() === 'привет' || cleanText === '/help') {
    return {
      replyText:
        `👋 Здравствуйте, *${user.name}*!\n\n` +
        `Вы авторизованы в системе как *${user.role}* (${user.title || 'Специалист'}).\n\n` +
        `📌 *Команды бота:*\n` +
        `• \`/tasks\` — список ваших активных задач с кнопками переключения статусов\n` +
        `• *Текстовый отчет* — просто напишите своими словами, что сделано или что мешает работе (ИИ сам обновит статус и при необходимости уведомит ГИПа).`,
    };
  }

  if (cleanText === '/tasks' || cleanText.toLowerCase() === 'задачи') {
    const activeTasks = await prisma.task.findMany({
      where: {
        assignees: {
          some: { id: user.id },
        },
        status: { not: 'DONE' },
      },
      include: { project: true },
    });

    if (activeTasks.length === 0) {
      return {
        replyText: 'У вас нет активных (незавершенных) задач на данный момент. Все разделы закрыты! 🎉',
      };
    }

    let replyText = '📋 *Ваши активные задачи и разделы:*\n\n';
    const inlineKeyboard: any[] = [];

    activeTasks.forEach((task, idx) => {
      const statusIcons: Record<string, string> = {
        PENDING: '⏳ Ожидает',
        IN_PROGRESS: '▶️ В работе',
        OTK: '🔍 ОТК',
        BLOCKED: '⚠️ БЛОКЕР',
      };

      replyText += `${idx + 1}. *${task.name}* (Объект: _${task.project.name}_)\n`;
      replyText += `   Статус: *${statusIcons[task.status] || task.status}*\n`;
      if (task.description) replyText += `   Инфо: ${task.description}\n`;
      replyText += '\n';

      // Quick action buttons for this task
      const buttonsRow = [];
      if (task.status !== 'IN_PROGRESS') {
        buttonsRow.push({ text: '▶️ В работу', callback_data: `task_inprogress_${task.id}` });
      }
      if (task.status !== 'OTK') {
        buttonsRow.push({ text: '🔍 В ОТК', callback_data: `task_otk_${task.id}` });
      }
      if (task.status !== 'BLOCKED') {
        buttonsRow.push({ text: '⚠️ Блок', callback_data: `task_blocked_${task.id}` });
      }
      if (task.status !== 'DONE') {
        buttonsRow.push({ text: '✅ Готово', callback_data: `task_done_${task.id}` });
      }
      inlineKeyboard.push(buttonsRow);
    });

    return {
      replyText,
      keyboard: { inline_keyboard: inlineKeyboard },
    };
  }

  // 4. Free text report analysis with Gemini AI
  const activeTasks = await prisma.task.findMany({
    where: {
      assignees: {
        some: { id: user.id },
      },
      status: { not: 'DONE' },
    },
    include: {
      project: {
        include: { manager: true },
      },
    },
  });

  if (activeTasks.length === 0) {
    return {
      replyText: 'Вы отправили текстовое сообщение, но у вас нет активных задач в системе, к которым можно привязать отчет.',
    };
  }

  const targetTask = activeTasks.find((t) => t.status === 'IN_PROGRESS') || activeTasks[0];

  const aiResult = await analyzeReport(cleanText);
  let replyText = `🤖 *ИИ-Анализ отчета (AE Automation):*\n\n`;
  replyText += `• Задача: *${targetTask.name}* (_${targetTask.project.name}_)\n`;
  replyText += `• Блокер / проблема: *${aiResult.isBlock ? 'Да ⚠️' : 'Нет'}*\n`;
  if (aiResult.isBlock && aiResult.summary) {
    replyText += `• Суть проблемы: _${aiResult.summary}_\n`;
  }
  if (aiResult.status) {
    replyText += `• Рекомендуемый статус: *${aiResult.status}*\n`;
  }
  replyText += `• Анализ: _${aiResult.explanation}_\n\n`;

  let updatedTask = null;
  let createdAlert = null;

  const updates: any = {};
  if (aiResult.isBlock) {
    updates.status = 'BLOCKED';
  } else if (aiResult.status) {
    updates.status = aiResult.status;
  }

  if (Object.keys(updates).length > 0) {
    updatedTask = await prisma.task.update({
      where: { id: targetTask.id },
      data: updates,
    });
    replyText += `✅ Статус задачи обновлен на *${updates.status}* в веб-панели.`;

    if (aiResult.isBlock) {
      const alertReason = aiResult.summary || cleanText;
      createdAlert = await prisma.alert.create({
        data: {
          taskId: targetTask.id,
          text: alertReason,
          status: 'ACTIVE',
        },
      });

      // Send Instant Push Alert to GIP / Managers
      await notifyManagersAboutBlocker(targetTask.project, targetTask, user, alertReason);

      replyText += `\n🚨 *ГИП и руководство получили мгновенное уведомление в Telegram.*`;
    } else {
      // Resolve any active alerts
      await prisma.alert.updateMany({
        where: { taskId: targetTask.id, status: 'ACTIVE' },
        data: { status: 'RESOLVED' },
      });
    }
  } else {
    replyText += `Статус задачи не изменился. Отчет зафиксирован.`;
  }

  return {
    replyText,
    updatedTask,
    createdAlert,
  };
}
