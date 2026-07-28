import { prisma } from './db';
import { analyzeReport } from './gemini';

export interface BotResponse {
  replyText: string;
  keyboard?: any; // Telegram keyboard markup
  updatedTask?: any;
  createdAlert?: any;
}

export async function handleIncomingBotMessage(
  identifier: { phone?: string; telegramId?: string; username?: string },
  text: string
): Promise<BotResponse> {
  const { phone, telegramId } = identifier;

  // 1. Find the user
  let user = null;
  if (telegramId) {
    user = await prisma.user.findUnique({ where: { telegramId } });
  }
  if (!user && phone) {
    // Normalise phone by stripping space, dash, parenthesis and matching last 10 digits
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    user = await prisma.user.findFirst({
      where: {
        phone: {
          contains: cleanPhone.substring(cleanPhone.length - 10),
        },
      },
    });
    
    // Link telegramId if found and not linked yet
    if (user && telegramId && !user.telegramId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { telegramId },
      });
    }
  }

  if (!user) {
    return {
      replyText: `Привет! Вы не зарегистрированы в системе AE Project Manager. Пожалуйста, отправьте свой контакт ГИПу для добавления в базу данных.\nВаш Telegram ID: ${telegramId || 'Неизвестен'}`,
    };
  }

  // 2. Handle button callbacks (Inline Queries / Text Commands)
  const taskInProgressMatch = text.match(/^task_inprogress_(\d+)$/);
  const taskOtkMatch = text.match(/^task_otk_(\d+)$/);
  const taskBlockedMatch = text.match(/^task_blocked_(\d+)$/);
  const taskDoneMatch = text.match(/^task_done_(\d+)$/);

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

    // Verify task belongs to or is assigned to this user
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true, assignees: true },
    });

    const isAssigned = task?.assignees.some((a: any) => a.id === user.id);

    if (!task || !isAssigned) {
      return {
        replyText: 'Ошибка: Задача не найдена или назначена другому исполнителю.',
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
    } else if (newStatus === 'DONE' || newStatus === 'IN_PROGRESS') {
      // Resolve any active alerts
      await prisma.alert.updateMany({
        where: { taskId, status: 'ACTIVE' },
        data: { status: 'RESOLVED' },
      });
    }

    return {
      replyText: `Статус задачи "${task.name}" успешно изменен на: *${newStatus}*!`,
      updatedTask,
      createdAlert,
    };
  }

  // 3. Command "/start" or "Привет" or "/tasks"
  const cleanText = text.trim();
  if (cleanText === '/start' || cleanText.toLowerCase() === 'привет') {
    return {
      replyText: `Здравствуйте, *${user.name}*!\n\nВы авторизованы как *${user.role}*.\n\nИспользуйте команду /tasks, чтобы посмотреть свои активные задачи, или просто пишите отчеты свободным текстом (наш ИИ автоматически распознает проблемы и обновит статусы).`,
    };
  }

  if (cleanText === '/tasks' || cleanText.toLowerCase() === 'задачи') {
    const activeTasks = await prisma.task.findMany({
      where: {
        assignees: {
          some: { id: user.id }
        },
        status: { not: 'DONE' },
      },
      include: { project: true },
    });

    if (activeTasks.length === 0) {
      return {
        replyText: 'У вас нет активных (незавершенных) задач на данный момент. Отличная работа! 🎉',
      };
    }

    let replyText = '📋 *Ваши активные задачи:*\n\n';
    const inlineKeyboard: any[] = [];

    activeTasks.forEach((task, idx) => {
      replyText += `${idx + 1}. *${task.name}* (Проект: ${task.project.name})\n`;
      replyText += `   Статус: ${task.status}\n`;
      if (task.description) replyText += `   Описание: ${task.description}\n`;
      replyText += '\n';

      // Buttons for each task
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
        some: { id: user.id }
      },
      status: { not: 'DONE' },
    },
    include: { project: true },
  });

  if (activeTasks.length === 0) {
    return {
      replyText: 'Вы отправили текстовый отчет, но у вас нет активных задач в системе, к которым можно его привязать.',
    };
  }

  const targetTask = activeTasks.find(t => t.status === 'IN_PROGRESS') || activeTasks[0];

  const aiResult = await analyzeReport(cleanText);
  let replyText = `🤖 *ИИ-Ассистент AE-Automation проанализировал ваш отчет:*\n\n`;
  replyText += `• Задача: *${targetTask.name}*\n`;
  replyText += `• Обнаружена проблема/блок: *${aiResult.isBlock ? 'Да ⚠️' : 'Нет'}*\n`;
  if (aiResult.isBlock && aiResult.summary) {
    replyText += `• Суть проблемы: _${aiResult.summary}_\n`;
  }
  if (aiResult.status) {
    replyText += `• Предложено сменить статус на: *${aiResult.status}*\n`;
  }
  replyText += `• Пояснение ИИ: _${aiResult.explanation}_\n\n`;

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
    replyText += `✅ Статус задачи автоматически обновлен на *${updates.status}* в веб-панели.`;
    
    if (aiResult.isBlock) {
      createdAlert = await prisma.alert.create({
        data: {
          taskId: targetTask.id,
          text: aiResult.summary || cleanText,
          status: 'ACTIVE',
        },
      });
      replyText += ` ГИП получил уведомление о блокировке.`;
    } else {
      // Resolve any active alerts
      await prisma.alert.updateMany({
        where: { taskId: targetTask.id, status: 'ACTIVE' },
        data: { status: 'RESOLVED' },
      });
    }
  } else {
    replyText += `Статус задачи не изменился. Отчет сохранен в логах.`;
  }

  return {
    replyText,
    updatedTask,
    createdAlert,
  };
}
