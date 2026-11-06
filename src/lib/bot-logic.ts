import { prisma } from './db';
import { analyzeReport } from './gemini';
import { sendTelegramMessage, forwardTelegramMessage, editTelegramMessageText } from './telegram';
import { formatDate } from './formatters';
import { createOrUpdateSupplyTask, completeSupplyTask, cancelSupplyTask, createOrUpdatePaymentTask, completePaymentTask } from './supply-tasks';
import { isChiefAccountantUser } from './auth';

export interface BotResponse {
  replyText: string;
  keyboard?: any; // Telegram keyboard markup
  updatedTask?: any;
  createdAlert?: any;
  isUnregistered?: boolean;
}

export const defaultUserKeyboard = {
  keyboard: [
    [{ text: '📝 Подать заявку на закупку' }, { text: '✈️ Заявка на командировку' }],
    [{ text: '📋 Мои задачи' }, { text: '🛠 Мой инструмент' }],
    [{ text: '🔄 Главное меню (/start)' }]
  ],
  resize_keyboard: true,
  is_persistent: true,
};

export const FSM_ACTIONS = [
  'PENDING_PIN_APPROVAL',
  'APPROVE_PURCHASE_PIN',
  'PUR_WIZ_NAME',
  'PUR_WIZ_AMOUNT',
  'PUR_WIZ_PHOTO',
  'SUPPLY_WIZ_AMOUNT',
  'SUPPLY_WIZ_FILE',
  'ACC_WIZ_POA_INFO',
  'ACC_WIZ_POA_FILE',
  'TRIP_WIZ_DEST',
  'TRIP_WIZ_DATES',
  'TRIP_WIZ_BUDGET',
  'AWAITING_PURCHASE_SPEC',
];

export async function hasActiveFsmState(userId: number): Promise<boolean> {
  const activeLog = await prisma.auditLog.findFirst({
    where: {
      userId,
      action: { in: FSM_ACTIONS },
      createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
  });
  return !!activeLog;
}

export function isFsmCommandOrMenuButton(text: string): boolean {
  if (!text) return false;
  const clean = text.trim();
  if (clean.startsWith('/')) return true;
  const menuButtons = [
    '📝 Подать заявку на закупку',
    '✈️ Заявка на командировку',
    '📋 Мои задачи',
    '🛠 Мой инструмент',
    '🔄 Главное меню (/start)',
  ];
  return menuButtons.includes(clean);
}

function parseDateRange(dateStr: string) {
  const currentYear = new Date().getFullYear();
  const parts = dateStr.split(/(?:-|—|по|\.\.\.)/).map(s => s.trim());
  let start = new Date();
  let end = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

  const parseSingleDate = (dStr: string) => {
    const match = dStr.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      let yr = match[3] ? parseInt(match[3], 10) : currentYear;
      if (yr < 100) yr += 2000;
      return new Date(yr, month, day);
    }
    return null;
  };

  if (parts.length >= 2) {
    const parsedStart = parseSingleDate(parts[0]);
    const parsedEnd = parseSingleDate(parts[1]);
    if (parsedStart && !isNaN(parsedStart.getTime())) start = parsedStart;
    if (parsedEnd && !isNaN(parsedEnd.getTime())) end = parsedEnd;
  } else if (parts.length === 1) {
    const parsedStart = parseSingleDate(parts[0]);
    if (parsedStart && !isNaN(parsedStart.getTime())) {
      start = parsedStart;
      end = new Date(start.getTime() + 3 * 24 * 60 * 60 * 1000);
    }
  }

  if (end < start) end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
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
      where: { role: { in: ['ADMIN', 'MANAGER'] }, telegramId: { not: null }, isActive: true },
    });

    admins.forEach((admin) => {
      if (admin.telegramId) recipients.add(admin.telegramId);
    });

    if (user.telegramId) {
      recipients.delete(user.telegramId);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ae-project-manager-nu.vercel.app';
    const alertMessage =
      `🚨 *ВНИМАНИЕ, ДИРЕКТОР! ОБНАРУЖЕН БЛОКЕР*\n\n` +
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

  // =========================================================================
  // 1.5 Handle File Upload (Document / Photo)
  // =========================================================================
  if (fileContext && messageId && chatId) {
    const { getTelegramFileUrl } = await import('./telegram');
    const fileUrl = await getTelegramFileUrl(fileContext.fileId);

    // 1.5.0 Check if user is in step 3 of Purchase Wizard (PUR_WIZ_PHOTO)
    const wizPhotoLog = await prisma.auditLog.findFirst({
      where: {
        userId: user.id,
        action: 'PUR_WIZ_PHOTO',
        createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (wizPhotoLog && wizPhotoLog.details) {
      try {
        const wizardData = JSON.parse(wizPhotoLog.details);
        const project = await prisma.project.findUnique({ where: { id: Number(wizardData.projectId) } });

        if (project) {
          const reqType = (wizardData.amount > 0 && cleanText.toLowerCase().includes('чек')) ? 'EXPENSE' : 'INVOICE';
          const purchase = await prisma.purchaseRequest.create({
            data: {
              type: reqType,
              title: wizardData.title,
              amount: Number(wizardData.amount) || 0,
              projectId: project.id,
              requesterId: user.id,
              fileUrl: fileUrl || null,
              status: reqType === 'EXPENSE' ? 'PENDING_EXPENSE' : 'PENDING_APPROVAL',
            },
            include: { project: true, requester: true }
          });

          await prisma.auditLog.delete({ where: { id: wizPhotoLog.id } }).catch(() => {});

          // Notify Admins with Direct Approval Inline Buttons
          const admins = await prisma.user.findMany({
            where: { role: 'ADMIN', telegramId: { not: null } }
          });

          const notifyMsg = `🛒 *Новая заявка на закупку ТМЦ #${purchase.id}*\n\n` +
            `• *Проект:* ${project.name}\n` +
            `• *Инициатор:* ${user.name} (${user.role})\n` +
            `• *ТМЦ:* ${purchase.title}\n` +
            (purchase.amount > 0 ? `• *Ориент. сумма:* ${purchase.amount.toLocaleString('ru-RU')} ₸\n` : '') +
            (fileUrl ? `📎 [Скан / Фото документа](${fileUrl})\n\n` : '\n') +
            `👉 Выберите действие для согласования:`;

          const keyboard = {
            inline_keyboard: [
              [
                { text: 'Одобрить ✅', callback_data: `pur_approve_need_${purchase.id}` },
                { text: 'Отклонить ❌', callback_data: `pur_reject_${purchase.id}` }
              ]
            ]
          };

          for (const admin of admins) {
            if (admin.telegramId) {
              await sendTelegramMessage(admin.telegramId, notifyMsg, { parse_mode: 'Markdown', reply_markup: keyboard });
            }
          }

          return {
            replyText: `🎉 *Заявка на закупку #${purchase.id} успешно создана!*\n\n` +
              `• *Проект:* ${project.name}\n` +
              `• *ТМЦ:* ${purchase.title}\n` +
              (purchase.amount > 0 ? `• *Сумма:* ${purchase.amount.toLocaleString('ru-RU')} ₸\n` : '') +
              `• *Файл:* Прикреплен 📎\n\n` +
              `⏳ Заявка передана Директору на согласование потребности.`,
            keyboard: defaultUserKeyboard,
          };
        }
      } catch (err) {
        console.error('Error parsing PUR_WIZ_PHOTO:', err);
      }
    }

    // 1.5.0.1 Supply Invoice File Upload (SUPPLY_WIZ_FILE)
    const supplyWizFileLog = await prisma.auditLog.findFirst({
      where: {
        userId: user.id,
        action: 'SUPPLY_WIZ_FILE',
        createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (supplyWizFileLog && supplyWizFileLog.details) {
      try {
        const data = JSON.parse(supplyWizFileLog.details);
        const updated = await prisma.purchaseRequest.update({
          where: { id: Number(data.purchaseId) },
          data: {
            amount: Number(data.amount) || 0,
            invoiceFileUrl: fileUrl,
            status: 'PENDING_PAYMENT_APPROVAL',
            supplyUserId: user.id
          },
          include: { project: true, requester: true, supplyUser: true }
        });

        await prisma.auditLog.delete({ where: { id: supplyWizFileLog.id } }).catch(() => {});

        // Notify Directors (ADMIN / MANAGER)
        const admins = await prisma.user.findMany({
          where: { role: { in: ['ADMIN', 'MANAGER'] }, telegramId: { not: null } }
        });

        const dirMsg = `📑 *Счет поставщика прикреплен и ожидает согласования*\n\n` +
          `• *Заявка:* #${updated.id}\n` +
          `• *Проект:* ${updated.project.name}\n` +
          `• *ТМЦ:* ${updated.title}\n` +
          `• *Снабженец:* ${user.name}\n` +
          `• *Итоговая сумма:* ${updated.amount.toLocaleString('ru-RU')} ₸\n\n` +
          (fileUrl ? `📎 [Открыть прикрепленный счет поставщика](${fileUrl})\n\n` : '') +
          `👉 Выберите действие для согласования счета:`;

        const dirKeyboard = {
          inline_keyboard: [
            [
              { text: 'Одобрить к оплате ✅', callback_data: `pur_approve_inv_${updated.id}` },
              { text: 'Вернуть на пересогласование 🔄', callback_data: `pur_renegotiate_${updated.id}` }
            ]
          ]
        };

        for (const admin of admins) {
          if (admin.telegramId) {
            await sendTelegramMessage(admin.telegramId, dirMsg, { parse_mode: 'Markdown', reply_markup: dirKeyboard });
          }
        }

        return {
          replyText: `✅ *Счет по заявке #${updated.id} успешно прикреплен!*\n\n` +
            `• *Сумма:* ${updated.amount.toLocaleString('ru-RU')} ₸\n` +
            `• *Документ:* [Открыть счет](${fileUrl})\n` +
            `• *Статус:* Передано Директору на утверждение к оплате\n\n` +
            `⏳ Руководству направлено сообщение с кнопками [ Одобрить к оплате ✅ ] и [ Вернуть на пересогласование 🔄 ].`,
          keyboard: defaultUserKeyboard,
        };
      } catch (err) {
        console.error('Error handling SUPPLY_WIZ_FILE:', err);
      }
    }

    // 1.5.0.2 Accountant POA File Upload (ACC_WIZ_POA_FILE)
    const accWizPoaFileLog = await prisma.auditLog.findFirst({
      where: {
        userId: user.id,
        action: 'ACC_WIZ_POA_FILE',
        createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (accWizPoaFileLog && accWizPoaFileLog.details) {
      try {
        const data = JSON.parse(accWizPoaFileLog.details);
        const updated = await prisma.purchaseRequest.update({
          where: { id: Number(data.purchaseId) },
          data: {
            poaNumber: data.poaNumber || 'б/н',
            poaDate: data.poaDate ? new Date(data.poaDate) : new Date(),
            poaIssuedTo: data.poaIssuedTo || 'Сотрудник',
            poaFileUrl: fileUrl,
            status: 'POA_ISSUED'
          },
          include: { project: true, requester: true, supplyUser: true }
        });

        await prisma.auditLog.delete({ where: { id: accWizPoaFileLog.id } }).catch(() => {});

        // Notify Supply users
        const supplyUsers = await prisma.user.findMany({
          where: { role: { in: ['SUPPLY', 'ADMIN'] }, telegramId: { not: null } }
        });

        const poaDateStr = updated.poaDate ? formatDate(updated.poaDate) : '';
        const sMsg = `📜 *Готова доверенность на получение ТМЦ!*\n\n` +
          `• *Заявка:* #${updated.id}\n` +
          `• *Проект:* ${updated.project.name}\n` +
          `• *ТМЦ:* ${updated.title}\n` +
          `• *Поставщик:* ${updated.supplierName || 'Поставщик'}\n` +
          `• *Доверенность:* №${updated.poaNumber} ${poaDateStr ? `от ${poaDateStr}` : ''}\n` +
          `• *Выдана на:* ${updated.poaIssuedTo}\n\n` +
          (fileUrl ? `📎 [Скачать скан доверенности Д-1](${fileUrl})\n\n` : '') +
          `👉 Заберите товар у поставщика по доверенности и подтвердите:`;

        const sKeyboard = {
          inline_keyboard: [
            [{ text: '🚚 Товар получен / Везем на склад', callback_data: `pur_intransit_${updated.id}` }]
          ]
        };

        for (const sUser of supplyUsers) {
          if (sUser.telegramId) {
            await sendTelegramMessage(sUser.telegramId, sMsg, { parse_mode: 'Markdown', reply_markup: sKeyboard });
          }
        }

        if (updated.requester?.telegramId) {
          await sendTelegramMessage(
            updated.requester.telegramId,
            `📜 По вашей заявке *#${updated.id}* (${updated.title}) бухгалтерия оформила доверенность Д-1 №${updated.poaNumber}.`
          );
        }

        return {
          replyText: `✅ *Доверенность по заявке #${updated.id} успешно сохранена!*\n\n` +
            `• *Номер:* №${updated.poaNumber}\n` +
            `• *Выдана на:* ${updated.poaIssuedTo}\n` +
            `• *Скан:* [Открыть документ](${fileUrl})\n` +
            `• *Статус:* ДОВЕРЕННОСТЬ Д-1 ВЫДАНА\n\n` +
            `Снабженцу отправлено уведомление со ссылкой на скачивание скана доверенности.`,
          keyboard: defaultUserKeyboard,
        };
      } catch (err) {
        console.error('Error handling ACC_WIZ_POA_FILE:', err);
      }
    }

    // 1.5.1 Check if user has an active pending specification creation request (AWAITING_PURCHASE_SPEC)
    const pendingSpecLog = await prisma.auditLog.findFirst({
      where: {
        userId: user.id,
        action: 'AWAITING_PURCHASE_SPEC',
        createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (pendingSpecLog && pendingSpecLog.details) {
      const projectId = Number(pendingSpecLog.details);
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (project) {
        const reqTitle = cleanText || fileContext.fileName || 'Спецификация комплектующих и материалов';
        
        const purchase = await prisma.purchaseRequest.create({
          data: {
            type: 'INVOICE',
            title: reqTitle,
            projectId: project.id,
            requesterId: user.id,
            fileUrl: fileUrl || null,
            status: 'PENDING_APPROVAL',
            amount: 0
          },
          include: { project: true, requester: true }
        });

        await prisma.auditLog.delete({ where: { id: pendingSpecLog.id } }).catch(() => {});

        const admins = await prisma.user.findMany({
          where: { role: 'ADMIN', telegramId: { not: null } }
        });

        const notifyMsg = `🛒 *Новая заявка на закупку #${purchase.id}*\n\n` +
          `• *Проект:* ${project.name}\n` +
          `• *Инициатор:* ${user.name} (${user.role})\n` +
          `• *Описание:* ${reqTitle}\n` +
          (fileUrl ? `📎 [Открыть спецификацию](${fileUrl})\n\n` : `\n`) +
          `👉 Выберите действие для согласования:`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: 'Одобрить ✅', callback_data: `pur_approve_need_${purchase.id}` },
              { text: 'Отклонить ❌', callback_data: `pur_reject_${purchase.id}` }
            ]
          ]
        };

        for (const admin of admins) {
          if (admin.telegramId) await sendTelegramMessage(admin.telegramId, notifyMsg, { parse_mode: 'Markdown', reply_markup: keyboard });
        }

        return {
          replyText: `🎉 *Заявка на закупку #${purchase.id} успешно создана!*\n\n` +
            `*Проект:* ${project.name}\n` +
            `*Файл:* ${fileContext.fileName || 'Спецификация'}\n\n` +
            `⏳ Заявка передана Директору на первичное согласование потребности.`,
          keyboard: defaultUserKeyboard,
        };
      }
    }

    // 1.5.2 Check if file is an invoice attached to a purchase request (caption has "#12" or "заявка 12")
    const purchaseMatch = cleanText.match(/(?:#|заявк[аи]\s*)(\d+)/i);
    if (purchaseMatch && fileContext.fileId) {
      const purId = Number(purchaseMatch[1]);
      const pur = await prisma.purchaseRequest.findUnique({
        where: { id: purId },
        include: { project: true }
      });
      if (pur && fileUrl) {
        const amountMatch = cleanText.match(/(\d[\d\s]{2,})\s*(?:₸|kzt|тенге|руб)?/i);
        const parsedAmount = amountMatch ? Number(amountMatch[1].replace(/\s/g, '')) : undefined;

        let supplierName = pur.supplierName;
        const cleanWithoutPur = cleanText.replace(purchaseMatch[0], '').trim();
        if (cleanWithoutPur.length > 2) {
          supplierName = cleanWithoutPur;
        }

        await prisma.purchaseRequest.update({
          where: { id: purId },
          data: {
            invoiceFileUrl: fileUrl,
            status: 'PENDING_PAYMENT_APPROVAL',
            ...(parsedAmount ? { amount: parsedAmount } : {}),
            ...(supplierName ? { supplierName } : {}),
            supplyUserId: user.id
          }
        });

        const admins = await prisma.user.findMany({
          where: { role: 'ADMIN', telegramId: { not: null } }
        });
        const alertMsg = `📑 *Счет прикреплен к заявке #${pur.id}*\n\n` +
          `*Проект:* ${pur.project.name}\n` +
          `*ТМЦ:* ${pur.title}\n` +
          `*Поставщик:* ${supplierName || 'Поставщик'}\n` +
          `*Сумма:* ${(parsedAmount || pur.amount).toLocaleString('ru-RU')} ₸\n` +
          `📎 [Скачать прикрепленный счет](${fileUrl})\n\n` +
          `👉 Подтвердите оплату счета:`;
        
        const keyboard = {
          inline_keyboard: [
            [
              { text: 'Одобрить счет ✅', callback_data: `pur_approve_inv_${pur.id}` },
              { text: 'Отклонить ❌', callback_data: `pur_reject_${pur.id}` }
            ]
          ]
        };

        for (const admin of admins) {
          if (admin.telegramId) await sendTelegramMessage(admin.telegramId, alertMsg, { parse_mode: 'Markdown', reply_markup: keyboard });
        }

        return {
          replyText: `✅ Счет успешно прикреплен к заявке *#${pur.id}* и отправлен Директору на утверждение!`,
          keyboard: defaultUserKeyboard,
        };
      }
    }

    // Default file forward
    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'MANAGER'] }, telegramId: { not: null }, isActive: true },
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

    return {
      replyText: forwardedCount > 0 ? `✅ Файл успешно получен и переслан руководству.` : `✅ Файл получен.`,
      keyboard: defaultUserKeyboard,
    };
  }

  // =========================================================================
  // 1.7 Global /cancel Command
  // =========================================================================
  if (cleanText === '/cancel' || cleanText === 'pur_cancel' || cleanText.toLowerCase() === 'отмена') {
    await prisma.auditLog.deleteMany({
      where: { 
        userId: user.id, 
        action: { 
          in: [
            'AWAITING_PURCHASE_SPEC', 
            'PENDING_PIN_APPROVAL', 
            'PUR_WIZ_NAME', 
            'PUR_WIZ_AMOUNT', 
            'PUR_WIZ_PHOTO',
            'SUPPLY_WIZ_AMOUNT',
            'SUPPLY_WIZ_FILE',
            'ACC_WIZ_POA_INFO',
            'ACC_WIZ_POA_FILE',
            'TRIP_WIZ_DEST',
            'TRIP_WIZ_DATES',
            'TRIP_WIZ_BUDGET'
          ] 
        } 
      }
    }).catch(() => {});

    return {
      replyText: 'Операция отменена. Чем еще могу помочь?',
      keyboard: defaultUserKeyboard,
    };
  }

  // =========================================================================
  // 1.8 4-Digit PIN Code Check for Large Invoices (>= 500k KZT)
  // =========================================================================
  if (/^\d{4}$/.test(cleanText)) {
    const pendingLog = await prisma.auditLog.findFirst({
      where: {
        userId: user.id,
        action: 'PENDING_PIN_APPROVAL',
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (pendingLog && pendingLog.details) {
      const purId = Number(pendingLog.details);
      const pur = await prisma.purchaseRequest.findUnique({
        where: { id: purId },
        include: { project: true, supplyUser: true }
      });

      if (pur) {
        if (user.pinCode && cleanText === user.pinCode) {
          await prisma.purchaseRequest.update({
            where: { id: purId },
            data: { status: 'APPROVED_FOR_PAYMENT' }
          });

          await prisma.auditLog.create({
            data: {
              userId: user.id,
              action: 'APPROVE_PURCHASE_PIN',
              details: `Утвержден крупный счет #${pur.id} (${pur.amount.toLocaleString('ru-RU')} ₸) с вводом личного ПИН-кода`
            }
          });

          await prisma.auditLog.delete({ where: { id: pendingLog.id } }).catch(() => {});

          // Создаем задачу на оплату для Главного бухгалтера
          await createOrUpdatePaymentTask(pur.id);

          const chiefAccountants = await prisma.user.findMany({
            where: {
              OR: [
                { role: 'CHIEF_ACCOUNTANT' },
                { role: 'ACCOUNTANT', title: { contains: 'главн', mode: 'insensitive' } },
                { role: 'ADMIN' }
              ],
              telegramId: { not: null }
            }
          });
          const targetAccountants = chiefAccountants.length > 0 
            ? chiefAccountants 
            : await prisma.user.findMany({ where: { role: { in: ['ACCOUNTANT', 'ADMIN'] }, telegramId: { not: null } } });

          const accMsg = `💳 *Крупный счет утвержден к оплате!*\n\n` +
            `*Проект:* ${pur.project.name}\n` +
            `*ТМЦ:* ${pur.title}\n` +
            `*Поставщик:* ${pur.supplierName || 'Поставщик'}\n` +
            `*Сумма:* ${pur.amount.toLocaleString('ru-RU')} ₸\n` +
            `*Утвердил:* ${user.name} (с подтверждением личного ПИН-кода)\n\n` +
            (pur.invoiceFileUrl ? `📎 [Скачать счет](${pur.invoiceFileUrl})\n\n` : '') +
            `👉 Произведите оплату в клиент-банке:`;
          
          const accKeyboard = {
            inline_keyboard: [
              [{ text: '💳 Подтвердить: Оплачено', callback_data: `pur_pay_inv_${pur.id}` }]
            ]
          };

          for (const acc of targetAccountants) {
            if (acc.telegramId) await sendTelegramMessage(acc.telegramId, accMsg, { parse_mode: 'Markdown', reply_markup: accKeyboard });
          }

          return {
            replyText: `✅ *Личный ПИН-код подтвержден!*\n\nСчет по заявке *#${pur.id}* на сумму *${pur.amount.toLocaleString('ru-RU')} ₸* успешно утвержден и передан в бухгалтерию на оплату.`,
            keyboard: defaultUserKeyboard,
          };
        } else {
          return {
            replyText: `❌ *Неверный ПИН-код!*\nПожалуйста, введите правильный 4-значный ПИН-код из вашего профиля.`
          };
        }
      }
    }
  }

  // =========================================================================
  // 1.9 Purchase Wizard (Пошаговый диалог заявки на закупку)
  // =========================================================================
  if (
    cleanText === '/purchase' || 
    cleanText === '📝 Подать заявку на закупку' || 
    cleanText === '📝 Заявка на закупку' || 
    cleanText === '🛒 Заявка на закупку' || 
    cleanText.toLowerCase() === 'закупка' || 
    cleanText === 'pur_new_request'
  ) {
    const activeProjects = await prisma.project.findMany({
      where: { status: { not: 'DONE' } },
      orderBy: { updatedAt: 'desc' },
      take: 12
    });

    if (activeProjects.length === 0) {
      return {
        replyText: 'В системе пока нет активных проектов для создания заявки на закупку.',
        keyboard: defaultUserKeyboard,
      };
    }

    const inline_keyboard = activeProjects.map(p => [
      { text: `📁 ${p.name}`, callback_data: `pur_wiz_proj_${p.id}` }
    ]);
    inline_keyboard.push([{ text: '❌ Отмена', callback_data: 'pur_cancel' }]);

    return {
      replyText: `🛒 *Создание заявки на закупку ТМЦ*\n\nШаг 1 из 3: Выберите проект, для которого требуются материалы или оборудование:`,
      keyboard: { inline_keyboard }
    };
  }

  // Handle Project Selection for Wizard: pur_wiz_proj_(\d+)
  const purWizProjMatch = cleanText.match(/^pur_wiz_proj_(\d+)$/);
  if (purWizProjMatch) {
    const projectId = Number(purWizProjMatch[1]);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return { replyText: '⚠️ Проект не найден.' };

    await prisma.auditLog.deleteMany({
      where: { userId: user.id, action: { in: ['PUR_WIZ_NAME', 'PUR_WIZ_AMOUNT', 'PUR_WIZ_PHOTO'] } }
    }).catch(() => {});

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'PUR_WIZ_NAME',
        details: JSON.stringify({ projectId: project.id, projectName: project.name })
      }
    });

    return {
      replyText: `📁 Выбран проект: *${project.name}*\n\n` +
        `Шаг 2 из 3: Напишите *наименование ТМЦ* или перечень материалов (например: _Автоматы ABB 16A 3шт, клеммы ONKA, кабель ВВГнг 3х2.5_):\n\n` +
        `_(Для отмены отправьте /cancel)_`
    };
  }

  // Handle Step 2 Text (Item Name): PUR_WIZ_NAME
  const purNameLog = await prisma.auditLog.findFirst({
    where: {
      userId: user.id,
      action: 'PUR_WIZ_NAME',
      createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (purNameLog && purNameLog.details && !cleanText.startsWith('/') && !cleanText.startsWith('pur_') && !cleanText.startsWith('trip_')) {
    try {
      const data = JSON.parse(purNameLog.details);
      data.title = cleanText;

      await prisma.auditLog.delete({ where: { id: purNameLog.id } }).catch(() => {});

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'PUR_WIZ_AMOUNT',
          details: JSON.stringify(data)
        }
      });

      return {
        replyText: `📦 Наименование: *${cleanText}*\n\n` +
          `Шаг 3 из 3: Введите *ориентировочную сумму* в тенге цифрами (или нажмите кнопку «Пропустить сумму»):`,
        keyboard: {
          inline_keyboard: [
            [{ text: '➡️ Пропустить сумму (определит снабженец)', callback_data: 'pur_wiz_skip_amt' }],
            [{ text: '❌ Отмена', callback_data: 'pur_cancel' }]
          ]
        }
      };
    } catch (e) {
      console.error(e);
    }
  }

  // Handle Amount Skip or Text: PUR_WIZ_AMOUNT
  const isSkipAmt = cleanText === 'pur_wiz_skip_amt';
  const purAmtLog = await prisma.auditLog.findFirst({
    where: {
      userId: user.id,
      action: 'PUR_WIZ_AMOUNT',
      createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (purAmtLog && purAmtLog.details && (isSkipAmt || !cleanText.startsWith('/'))) {
    try {
      const data = JSON.parse(purAmtLog.details);
      let parsedAmount = 0;
      if (!isSkipAmt) {
        const numMatch = cleanText.replace(/\s/g, '').match(/\d+/);
        if (numMatch) parsedAmount = Number(numMatch[0]);
      }
      data.amount = parsedAmount;

      await prisma.auditLog.delete({ where: { id: purAmtLog.id } }).catch(() => {});

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'PUR_WIZ_PHOTO',
          details: JSON.stringify(data)
        }
      });

      return {
        replyText: `💰 Сумма: *${parsedAmount > 0 ? parsedAmount.toLocaleString('ru-RU') + ' ₸' : 'Определит снабженец'}*\n\n` +
          `📎 Теперь *отправьте фото счета, чека или файл спецификации*.\n\n` +
          `Если файла нет, нажмите кнопку *«Завершить без файла»*:`,
        keyboard: {
          inline_keyboard: [
            [{ text: '🚀 Завершить без файла', callback_data: 'pur_wiz_nofile' }],
            [{ text: '❌ Отмена', callback_data: 'pur_cancel' }]
          ]
        }
      };
    } catch (e) {
      console.error(e);
    }
  }

  // Handle "Finish without file": pur_wiz_nofile
  if (cleanText === 'pur_wiz_nofile') {
    const wizPhotoLog = await prisma.auditLog.findFirst({
      where: {
        userId: user.id,
        action: 'PUR_WIZ_PHOTO',
        createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (wizPhotoLog && wizPhotoLog.details) {
      const data = JSON.parse(wizPhotoLog.details);
      const project = await prisma.project.findUnique({ where: { id: Number(data.projectId) } });

      if (project) {
        const purchase = await prisma.purchaseRequest.create({
          data: {
            type: 'INVOICE',
            title: data.title,
            amount: Number(data.amount) || 0,
            projectId: project.id,
            requesterId: user.id,
            status: 'PENDING_APPROVAL',
          },
          include: { project: true, requester: true }
        });

        await prisma.auditLog.delete({ where: { id: wizPhotoLog.id } }).catch(() => {});

        // Notify Admins
        const admins = await prisma.user.findMany({
          where: { role: 'ADMIN', telegramId: { not: null } }
        });

        const notifyMsg = `🛒 *Новая заявка на закупку ТМЦ #${purchase.id}*\n\n` +
          `• *Проект:* ${project.name}\n` +
          `• *Инициатор:* ${user.name} (${user.role})\n` +
          `• *ТМЦ:* ${purchase.title}\n` +
          (purchase.amount > 0 ? `• *Ориент. сумма:* ${purchase.amount.toLocaleString('ru-RU')} ₸\n\n` : '\n') +
          `👉 Выберите действие для согласования:`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: 'Одобрить ✅', callback_data: `pur_approve_need_${purchase.id}` },
              { text: 'Отклонить ❌', callback_data: `pur_reject_${purchase.id}` }
            ]
          ]
        };

        for (const admin of admins) {
          if (admin.telegramId) await sendTelegramMessage(admin.telegramId, notifyMsg, { parse_mode: 'Markdown', reply_markup: keyboard });
        }

        return {
          replyText: `🎉 *Заявка на закупку #${purchase.id} успешно создана!*\n\n` +
            `• *Проект:* ${project.name}\n` +
            `• *ТМЦ:* ${purchase.title}\n` +
            (purchase.amount > 0 ? `• *Сумма:* ${purchase.amount.toLocaleString('ru-RU')} ₸\n\n` : '\n') +
            `⏳ Заявка передана Директору на согласование потребности.`,
          keyboard: defaultUserKeyboard,
        };
      }
    }
  }

  // =========================================================================
  // 1.9.5 Supply Invoice Wizard - Step 1: Amount input
  // =========================================================================
  const supplyWizAmtLog = await prisma.auditLog.findFirst({
    where: {
      userId: user.id,
      action: 'SUPPLY_WIZ_AMOUNT',
      createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (supplyWizAmtLog && supplyWizAmtLog.details && !cleanText.startsWith('/') && !cleanText.startsWith('pur_') && !cleanText.startsWith('attach_') && !cleanText.startsWith('trip_')) {
    try {
      const data = JSON.parse(supplyWizAmtLog.details);
      const numMatch = cleanText.replace(/\s/g, '').match(/\d+/);
      const amount = numMatch ? Number(numMatch[0]) : 0;

      if (amount <= 0) {
        return {
          replyText: `⚠️ Пожалуйста, введите корректную сумму по счету числом (например: \`185000\`):\n\n_(Для отмены отправьте /cancel)_`
        };
      }

      await prisma.auditLog.delete({ where: { id: supplyWizAmtLog.id } }).catch(() => {});

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'SUPPLY_WIZ_FILE',
          details: JSON.stringify({ purchaseId: data.purchaseId, amount })
        }
      });

      return {
        replyText: `💰 Сумма счета зафиксирована: *${amount.toLocaleString('ru-RU')} ₸*\n\n` +
          `👉 *Шаг 2 из 2:* Теперь отправьте *файл документа (PDF) или четкое фото счета* поставщика в этот чат:\n\n` +
          `_(Для отмены отправьте /cancel)_`
      };
    } catch (e) {
      console.error(e);
    }
  }

  // =========================================================================
  // 1.9.6 Accountant POA Wizard - Step 1: POA Details input
  // =========================================================================
  const accWizPoaLog = await prisma.auditLog.findFirst({
    where: {
      userId: user.id,
      action: 'ACC_WIZ_POA_INFO',
      createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (accWizPoaLog && accWizPoaLog.details && !cleanText.startsWith('/') && !cleanText.startsWith('pur_') && !cleanText.startsWith('attach_') && !cleanText.startsWith('trip_')) {
    try {
      const data = JSON.parse(accWizPoaLog.details);

      // Extract number: e.g. № 14, №14/2, 14
      const numMatch = cleanText.match(/(?:№|номер)?\s*([0-9А-Яа-яA-Za-z\/-]+)/i);
      const poaNumber = numMatch ? numMatch[1].replace(/№/g, '').trim() : cleanText.substring(0, 20).trim();

      // Extract date (e.g. 02.11.2026 or 02/11/2026)
      const dateMatch = cleanText.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
      let poaDateIso = new Date().toISOString();
      if (dateMatch) {
        const day = parseInt(dateMatch[1], 10);
        const month = parseInt(dateMatch[2], 10) - 1;
        let yr = dateMatch[3] ? parseInt(dateMatch[3], 10) : new Date().getFullYear();
        if (yr < 100) yr += 2000;
        const parsed = new Date(yr, month, day);
        if (!isNaN(parsed.getTime())) poaDateIso = parsed.toISOString();
      }

      // Extract name if provided
      let poaIssuedTo = '';
      if (cleanText.includes(',')) {
        poaIssuedTo = cleanText.split(',').slice(1).join(',').trim();
      } else if (/на\s+([А-Яа-яЁё\s]+)/i.test(cleanText)) {
        const nameMatch = cleanText.match(/на\s+([А-Яа-яЁё\s]+)/i);
        if (nameMatch) poaIssuedTo = nameMatch[1].trim();
      }
      if (!poaIssuedTo) poaIssuedTo = 'Сотрудник снабжения';

      await prisma.auditLog.delete({ where: { id: accWizPoaLog.id } }).catch(() => {});

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'ACC_WIZ_POA_FILE',
          details: JSON.stringify({
            purchaseId: data.purchaseId,
            poaNumber,
            poaDate: poaDateIso,
            poaIssuedTo
          })
        }
      });

      return {
        replyText: `📜 Реквизиты доверенности приняты:\n` +
          `• *Номер:* №${poaNumber}\n` +
          `• *Дата:* ${formatDate(poaDateIso)}\n` +
          `• *Выдана на:* ${poaIssuedTo}\n\n` +
          `👉 *Шаг 2 из 2:* Теперь отправьте *скан или фото доверенности формы Д-1* (PDF или фото) в этот чат:\n\n` +
          `_(Для отмены отправьте /cancel)_`
      };
    } catch (e) {
      console.error(e);
    }
  }

  // =========================================================================
  // 1.10 Business Trip Wizard (Пошаговый диалог заявки на командировку)
  // =========================================================================
  if (
    cleanText === '/trip' || 
    cleanText === '✈️ Заявка на командировку' || 
    cleanText === '✈️ Командировка' || 
    cleanText.toLowerCase() === 'командировка' ||
    cleanText === 'trip_new_request'
  ) {
    const activeProjects = await prisma.project.findMany({
      where: { status: { not: 'DONE' } },
      orderBy: { updatedAt: 'desc' },
      take: 10
    });

    const inline_keyboard: any[] = activeProjects.map(p => [
      { text: `📁 ${p.name}`, callback_data: `trip_wiz_proj_${p.id}` }
    ]);
    inline_keyboard.push([{ text: '🌐 Общие работы / Вне проекта', callback_data: 'trip_wiz_proj_0' }]);
    inline_keyboard.push([{ text: '❌ Отмена', callback_data: 'pur_cancel' }]);

    return {
      replyText: `✈️ *Оформление заявки на командировку*\n\nШаг 1 из 4: Выберите проект (или общие работы):`,
      keyboard: { inline_keyboard }
    };
  }

  // Handle Project Selection for Trip: trip_wiz_proj_(\d+)
  const tripWizProjMatch = cleanText.match(/^trip_wiz_proj_(\d+)$/);
  if (tripWizProjMatch) {
    const projectId = Number(tripWizProjMatch[1]);
    let projectName = 'Вне проекта';
    if (projectId > 0) {
      const p = await prisma.project.findUnique({ where: { id: projectId } });
      if (p) projectName = p.name;
    }

    await prisma.auditLog.deleteMany({
      where: { userId: user.id, action: { in: ['TRIP_WIZ_DEST', 'TRIP_WIZ_DATES', 'TRIP_WIZ_BUDGET'] } }
    }).catch(() => {});

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'TRIP_WIZ_DEST',
        details: JSON.stringify({ projectId, projectName })
      }
    });

    return {
      replyText: `📁 Проект: *${projectName}*\n\n` +
        `Шаг 2 из 4: Введите *город назначения* или объект (например: _Астана, ТЭЦ-3_ или _Атырау, м. Тенгиз_):\n\n` +
        `_(Для отмены отправьте /cancel)_`
    };
  }

  // Handle Trip Destination: TRIP_WIZ_DEST
  const tripDestLog = await prisma.auditLog.findFirst({
    where: {
      userId: user.id,
      action: 'TRIP_WIZ_DEST',
      createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (tripDestLog && tripDestLog.details && !cleanText.startsWith('/') && !cleanText.startsWith('trip_') && !cleanText.startsWith('pur_')) {
    try {
      const data = JSON.parse(tripDestLog.details);
      data.destination = cleanText;

      await prisma.auditLog.delete({ where: { id: tripDestLog.id } }).catch(() => {});

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'TRIP_WIZ_DATES',
          details: JSON.stringify(data)
        }
      });

      return {
        replyText: `📍 Город: *${cleanText}*\n\n` +
          `Шаг 3 из 4: Введите *даты поездки* (например: _10.11.2026 - 15.11.2026_ или _10.11 - 15.11_):`
      };
    } catch (e) {
      console.error(e);
    }
  }

  // Handle Trip Dates: TRIP_WIZ_DATES
  const tripDatesLog = await prisma.auditLog.findFirst({
    where: {
      userId: user.id,
      action: 'TRIP_WIZ_DATES',
      createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (tripDatesLog && tripDatesLog.details && !cleanText.startsWith('/') && !cleanText.startsWith('trip_') && !cleanText.startsWith('pur_')) {
    try {
      const data = JSON.parse(tripDatesLog.details);
      data.datesText = cleanText;

      await prisma.auditLog.delete({ where: { id: tripDatesLog.id } }).catch(() => {});

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'TRIP_WIZ_BUDGET',
          details: JSON.stringify(data)
        }
      });

      return {
        replyText: `📅 Даты: *${cleanText}*\n\n` +
          `Шаг 4 из 4: Введите *ориентировочный бюджет* в тенге (проезд, суточные, проживание):`
      };
    } catch (e) {
      console.error(e);
    }
  }

  // Handle Trip Budget: TRIP_WIZ_BUDGET
  const tripBudgetLog = await prisma.auditLog.findFirst({
    where: {
      userId: user.id,
      action: 'TRIP_WIZ_BUDGET',
      createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (tripBudgetLog && tripBudgetLog.details && !cleanText.startsWith('/') && !cleanText.startsWith('trip_') && !cleanText.startsWith('pur_')) {
    try {
      const data = JSON.parse(tripBudgetLog.details);
      const numMatch = cleanText.replace(/\s/g, '').match(/\d+/);
      const budget = numMatch ? Number(numMatch[0]) : 50000;

      const { start, end } = parseDateRange(data.datesText || '');

      const trip = await prisma.businessTrip.create({
        data: {
          employeeId: user.id,
          destination: data.destination,
          purpose: `Выездные работы по проекту ${data.projectName || ''}`.trim(),
          startDate: start,
          endDate: end,
          budget: budget,
          projectId: data.projectId > 0 ? Number(data.projectId) : null,
          status: 'PENDING',
        },
        include: { employee: true, project: true }
      });

      await prisma.auditLog.delete({ where: { id: tripBudgetLog.id } }).catch(() => {});

      // Notify Admins with Direct Approval Inline Buttons
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', telegramId: { not: null } }
      });

      const notifyMsg = `✈️ *Новая заявка на командировку #${trip.id}*\n\n` +
        `• *Сотрудник:* ${user.name} (${user.role})\n` +
        `• *Пункт назначения:* ${trip.destination}\n` +
        `• *Объект / Проект:* ${trip.project?.name || 'Вне проекта'}\n` +
        `• *Даты:* с ${formatDate(trip.startDate)} по ${formatDate(trip.endDate)}\n` +
        `• *Бюджет:* ${trip.budget.toLocaleString('ru-RU')} ₸\n\n` +
        `👉 Согласовать командировку?`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: 'Одобрить ✅', callback_data: `trip_approve_${trip.id}` },
            { text: 'Отклонить ❌', callback_data: `trip_reject_${trip.id}` }
          ]
        ]
      };

      for (const admin of admins) {
        if (admin.telegramId) {
          await sendTelegramMessage(admin.telegramId, notifyMsg, { parse_mode: 'Markdown', reply_markup: keyboard });
        }
      }

      return {
        replyText: `🎉 *Заявка на командировку #${trip.id} успешно создана!*\n\n` +
          `• *Город:* ${trip.destination}\n` +
          `• *Даты:* с ${formatDate(trip.startDate)} по ${formatDate(trip.endDate)}\n` +
          `• *Бюджет:* ${trip.budget.toLocaleString('ru-RU')} ₸\n\n` +
          `⏳ Заявка направлена Директору на согласование.`,
        keyboard: defaultUserKeyboard,
      };
    } catch (e) {
      console.error(e);
    }
  }

  // =========================================================================
  // 1.11 Director Trip Approvals / Rejections (trip_approve_ / trip_reject_)
  // =========================================================================
  const tripApproveMatch = cleanText.match(/^trip_approve_(\d+)$/);
  const tripRejectMatch = cleanText.match(/^trip_reject_(\d+)$/);

  if (tripApproveMatch || tripRejectMatch) {
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      return { replyText: '⚠️ У вас нет прав для согласования командировок.' };
    }

    const tripId = Number((tripApproveMatch || tripRejectMatch)![1]);
    const isApprove = Boolean(tripApproveMatch);

    const trip = await prisma.businessTrip.update({
      where: { id: tripId },
      data: { status: isApprove ? 'APPROVED' : 'REJECTED' },
      include: { employee: true, project: true }
    });

    if (messageId && chatId) {
      const statusText = isApprove ? 'ОДОБРЕНА ✅' : 'ОТКЛОНЕНА ❌';
      await editTelegramMessageText(
        chatId,
        messageId,
        `✈️ *Командировка #${trip.id} ${statusText}*\n\n` +
        `• *Сотрудник:* ${trip.employee.name}\n` +
        `• *Город:* ${trip.destination}\n` +
        `• *Даты:* с ${formatDate(trip.startDate)} по ${formatDate(trip.endDate)}\n` +
        `• *Бюджет:* ${trip.budget.toLocaleString('ru-RU')} ₸`
      );
    }

    // Notify Employee
    if (trip.employee.telegramId) {
      const empMsg = isApprove
        ? `🎉 *Ваша командировка в г. ${trip.destination} одобрена Директором!*\n\n• Даты: с ${formatDate(trip.startDate)} по ${formatDate(trip.endDate)}\n• Бюджет: ${trip.budget.toLocaleString('ru-RU')} ₸\n\nПриказ о командировании формируется в бухгалтерии.`
        : `❌ *Ваша заявка на командировку в г. ${trip.destination} была отклонена руководством.*`;
      await sendTelegramMessage(trip.employee.telegramId, empMsg, { parse_mode: 'Markdown' });
    }

    return {
      replyText: isApprove
        ? `✅ Командировка *#${trip.id}* (${trip.employee.name}, ${trip.destination}) успешно одобрена!`
        : `❌ Командировка *#${trip.id}* отклонена.`,
      keyboard: defaultUserKeyboard,
    };
  }

  // =========================================================================
  // 1.12 Tool Handover Acceptance / Rejection (tool_accept_ / tool_reject_)
  // =========================================================================
  const toolAcceptMatch = cleanText.match(/^tool_accept_(\d+)$/);
  const toolRejectMatch = cleanText.match(/^tool_reject_(\d+)$/);

  if (toolAcceptMatch || toolRejectMatch) {
    const logId = Number((toolAcceptMatch || toolRejectMatch)![1]);
    const isAccept = Boolean(toolAcceptMatch);

    const toolLog = await prisma.toolLog.findUnique({
      where: { id: logId },
      include: { tool: true, employee: true, project: true }
    });

    if (!toolLog) {
      return { replyText: '⚠️ Запись о выдаче инструмента не найдена.' };
    }

    if (isAccept) {
      // 1. Employee confirmed receipt
      await prisma.toolLog.update({
        where: { id: logId },
        data: {
          status: 'IN_USE',
          acceptedAt: new Date()
        }
      });

      await prisma.tool.update({
        where: { id: toolLog.toolId },
        data: { status: 'IN_USE', holderId: toolLog.employeeId }
      });

      if (messageId && chatId) {
        await editTelegramMessageText(
          chatId,
          messageId,
          `✅ *Вы подтвердили прием инструмента!*\n\n` +
          `• Инструмент: *${toolLog.tool.name}* (Инв. № ${toolLog.tool.serialNumber || 'б/н'})\n` +
          `• Проект: ${toolLog.project?.name || 'Основной'}\n` +
          `• Время подтверждения: ${new Date().toLocaleTimeString('ru-RU')}`
        );
      }

      // Notify Warehouse
      const warehouseUsers = await prisma.user.findMany({
        where: { role: { in: ['WAREHOUSE', 'ADMIN'] }, telegramId: { not: null } }
      });
      const whMsg = `👤 *Сотрудник подтвердил получение инструмента!*\n\n` +
        `• Сотрудник: *${toolLog.employee.name}*\n` +
        `• Инструмент: *${toolLog.tool.name}* (Инв. № ${toolLog.tool.serialNumber || 'б/н'})\n` +
        `• Проект: ${toolLog.project?.name || 'Цех/Склад'}\n` +
        `• Статус инструмента: *На руках (IN_USE)*`;

      for (const wh of warehouseUsers) {
        if (wh.telegramId) await sendTelegramMessage(wh.telegramId, whMsg, { parse_mode: 'Markdown' });
      }

      return {
        replyText: `✅ Прием инструмента *${toolLog.tool.name}* зафиксирован. Не забывайте о технике безопасности!`,
        keyboard: defaultUserKeyboard,
      };
    } else {
      // 2. Employee rejected receipt
      await prisma.toolLog.update({
        where: { id: logId },
        data: {
          status: 'REJECTED',
          actualReturnDate: new Date(),
          condition: 'Отклонено сотрудником в Telegram'
        }
      });

      await prisma.tool.update({
        where: { id: toolLog.toolId },
        data: { status: 'AVAILABLE', holderId: null }
      });

      if (messageId && chatId) {
        await editTelegramMessageText(
          chatId,
          messageId,
          `❌ *Вы отклонили получение инструмента:*\n\n` +
          `• Инструмент: *${toolLog.tool.name}*\n` +
          `Запись аннулирована, инструмент возвращен в статус «На складе».`
        );
      }

      // Notify Warehouse
      const warehouseUsers = await prisma.user.findMany({
        where: { role: { in: ['WAREHOUSE', 'ADMIN'] }, telegramId: { not: null } }
      });
      const whMsg = `⚠️ *Внимание! Отклонение выдачи инструмента*\n\n` +
        `• Сотрудник: *${toolLog.employee.name}* нажал *«Не брал»*\n` +
        `• Инструмент: *${toolLog.tool.name}* (Инв. № ${toolLog.tool.serialNumber || 'б/н'})\n` +
        `• Инструмент автоматически возвращен в статус *На складе (AVAILABLE)*. Проверьте журнал!`;

      for (const wh of warehouseUsers) {
        if (wh.telegramId) await sendTelegramMessage(wh.telegramId, whMsg, { parse_mode: 'Markdown' });
      }

      return {
        replyText: `❌ Вы отклонили получение инструмента *${toolLog.tool.name}*. Кладовщик уведомлен.`,
        keyboard: defaultUserKeyboard,
      };
    }
  }

  // =========================================================================
  // 1.13 Procurement & Logistics Callbacks (pur_approve_need_, pur_reject_, pur_intransit_, pur_delivered_, attach_invoice_, attach_poa_, pur_renegotiate_)
  // =========================================================================
  const purApproveNeedMatch = cleanText.match(/^pur_approve_need_(\d+)$/);
  const purRejectMatch = cleanText.match(/^pur_reject_(\d+)$/);
  const purApproveInvMatch = cleanText.match(/^pur_approve_inv_(\d+)$/);
  const purPayInvMatch = cleanText.match(/^pur_pay_inv_(\d+)$/);
  const purInTransitMatch = cleanText.match(/^pur_intransit_(\d+)$/);
  const purDeliveredMatch = cleanText.match(/^pur_delivered_(\d+)$/);
  const attachInvoiceMatch = cleanText.match(/^attach_invoice_(\d+)$/);
  const purRenegotiateMatch = cleanText.match(/^pur_renegotiate_(\d+)$/);
  const attachPoaMatch = cleanText.match(/^attach_poa_(\d+)$/);

  if (
    purApproveNeedMatch || 
    purRejectMatch || 
    purApproveInvMatch || 
    purPayInvMatch || 
    purInTransitMatch || 
    purDeliveredMatch ||
    attachInvoiceMatch ||
    purRenegotiateMatch ||
    attachPoaMatch
  ) {
    // 0.1 ATTACH INVOICE (Supply starts invoice upload dialog)
    if (attachInvoiceMatch) {
      const purId = Number(attachInvoiceMatch[1]);
      const pur = await prisma.purchaseRequest.findUnique({
        where: { id: purId },
        include: { project: true }
      });
      if (!pur) return { replyText: '⚠️ Заявка не найдена.' };

      await prisma.auditLog.deleteMany({
        where: { userId: user.id, action: { in: ['SUPPLY_WIZ_AMOUNT', 'SUPPLY_WIZ_FILE', 'ACC_WIZ_POA_INFO', 'ACC_WIZ_POA_FILE'] } }
      }).catch(() => {});

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'SUPPLY_WIZ_AMOUNT',
          details: JSON.stringify({ purchaseId: pur.id, purchaseTitle: pur.title, projectName: pur.project.name })
        }
      });

      return {
        replyText: `📝 *Внесение счета поставщика по заявке #${pur.id}*\n\n` +
          `• *Проект:* ${pur.project.name}\n` +
          `• *ТМЦ:* ${pur.title}\n\n` +
          `👉 *Шаг 1 из 2:* Введите итоговую сумму по выставленному счету в тенге (числом, например: \`185000\`):\n\n` +
          `_(Для отмены отправьте /cancel)_`
      };
    }

    // 0.2 DIRECTOR RENEGOTIATE (Returns invoice to Supply)
    if (purRenegotiateMatch) {
      if (!['ADMIN', 'MANAGER'].includes(user.role)) {
        return { replyText: '⚠️ У вас нет прав для возврата заявок.' };
      }
      const purId = Number(purRenegotiateMatch[1]);
      const pur = await prisma.purchaseRequest.update({
        where: { id: purId },
        data: { status: 'IN_PROCUREMENT' },
        include: { project: true, requester: true, supplyUser: true }
      });

      // Обновляем задачу снабжения в проекте
      await createOrUpdateSupplyTask(pur.id);

      if (messageId && chatId) {
        await editTelegramMessageText(
          chatId,
          messageId,
          `🔄 *Счет по заявке #${pur.id} возвращен на пересогласование*\n\n` +
          `• Проект: ${pur.project.name}\n` +
          `• ТМЦ: ${pur.title}\n` +
          `• Сумма: ${pur.amount.toLocaleString('ru-RU')} ₸`
        );
      }

      // Notify Supply
      const supplyRecipients = [
        pur.supplyUser?.telegramId,
        ...(await prisma.user.findMany({ where: { role: 'SUPPLY', telegramId: { not: null } } })).map(u => u.telegramId)
      ].filter((v, i, a) => v && a.indexOf(v) === i);

      const reMsg = `🔄 *Счет по заявке #${pur.id} возвращен Директором на пересогласование!*\n\n` +
        `*Проект:* ${pur.project.name}\n` +
        `*ТМЦ:* ${pur.title}\n` +
        `*Предыдущая сумма:* ${pur.amount.toLocaleString('ru-RU')} ₸\n\n` +
        `👉 Запросите лучшие условия / скидку у поставщика и прикрепите новый счет:`;

      const reKeyboard = {
        inline_keyboard: [
          [{ text: '📎 Прикрепить новый счет', callback_data: `attach_invoice_${pur.id}` }]
        ]
      };

      for (const sTgId of supplyRecipients) {
        if (sTgId) await sendTelegramMessage(sTgId, reMsg, { parse_mode: 'Markdown', reply_markup: reKeyboard });
      }

      return {
        replyText: `🔄 Счет по заявке *#${pur.id}* возвращен в снабжение на пересогласование цены.`,
        keyboard: defaultUserKeyboard,
      };
    }

    // 0.3 ATTACH POA (Accountant starts POA upload dialog)
    if (attachPoaMatch) {
      const purId = Number(attachPoaMatch[1]);
      const pur = await prisma.purchaseRequest.findUnique({
        where: { id: purId },
        include: { project: true }
      });
      if (!pur) return { replyText: '⚠️ Заявка не найдена.' };

      await prisma.auditLog.deleteMany({
        where: { userId: user.id, action: { in: ['SUPPLY_WIZ_AMOUNT', 'SUPPLY_WIZ_FILE', 'ACC_WIZ_POA_INFO', 'ACC_WIZ_POA_FILE'] } }
      }).catch(() => {});

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'ACC_WIZ_POA_INFO',
          details: JSON.stringify({ purchaseId: pur.id, purchaseTitle: pur.title, projectName: pur.project.name })
        }
      });

      return {
        replyText: `📜 *Оформление доверенности формы Д-1 по заявке #${pur.id}*\n\n` +
          `• *Проект:* ${pur.project.name}\n` +
          `• *ТМЦ:* ${pur.title}\n\n` +
          `👉 *Шаг 1 из 2:* Введите номер и дату доверенности, а также ФИО сотрудника (кому выдана).\n\n` +
          `_Пример:_ \`№ 14 от 02.11.2026, Иванов А.С.\` или \`14, 02.11.2026\`:\n\n` +
          `_(Для отмены отправьте /cancel)_`
      };
    }

    // 1. APPROVE NEED (Director / Admin)
    if (purApproveNeedMatch) {
      if (!['ADMIN', 'MANAGER'].includes(user.role)) {
        return { replyText: '⚠️ У вас нет прав для согласования потребности.' };
      }
      const purId = Number(purApproveNeedMatch[1]);
      const pur = await prisma.purchaseRequest.update({
        where: { id: purId },
        data: { status: 'IN_PROCUREMENT' },
        include: { project: true, requester: true }
      });

      // Автоматически создаем производственную задачу снабженцу в проекте
      await createOrUpdateSupplyTask(pur.id);

      if (messageId && chatId) {
        await editTelegramMessageText(
          chatId,
          messageId,
          `✅ *Заявка #${pur.id} ОДОБРЕНА в снабжение*\n\n` +
          `• Проект: ${pur.project.name}\n` +
          `• ТМЦ: ${pur.title}\n` +
          `• Заявитель: ${pur.requester?.name}`
        );
      }

      const supplyUsers = await prisma.user.findMany({
        where: { role: 'SUPPLY', telegramId: { not: null } }
      });
      const sMsg = `📦 *Заявка #${pur.id} разрешена Директором в снабжение!*\n\n` +
        `*Проект:* ${pur.project.name}\n` +
        `*Потребность:* ${pur.title}\n` +
        `*Заявитель:* ${pur.requester?.name}\n\n` +
        `👉 Запросите счет у поставщика и прикрепите его:`;
      const sKeyboard = {
        inline_keyboard: [
          [{ text: '📎 Прикрепить счет поставщика', callback_data: `attach_invoice_${pur.id}` }]
        ]
      };
      for (const sUser of supplyUsers) {
        if (sUser.telegramId) await sendTelegramMessage(sUser.telegramId, sMsg, { parse_mode: 'Markdown', reply_markup: sKeyboard });
      }

      return {
        replyText: `✅ Заявка *#${pur.id}* одобрена и передана в отдел снабжения!`,
        keyboard: defaultUserKeyboard,
      };
    }

    // 2. REJECT (Director / Admin)
    if (purRejectMatch) {
      if (!['ADMIN', 'MANAGER'].includes(user.role)) {
        return { replyText: '⚠️ У вас нет прав для отклонения заявок.' };
      }
      const purId = Number(purRejectMatch[1]);
      const pur = await prisma.purchaseRequest.update({
        where: { id: purId },
        data: { status: 'REJECTED' },
        include: { project: true, requester: true }
      });

      // Отменяем/удаляем связанную задачу снабжения
      await cancelSupplyTask(pur.id);

      if (messageId && chatId) {
        await editTelegramMessageText(
          chatId,
          messageId,
          `❌ *Заявка #${pur.id} ОТКЛОНЕНА*\n\n• ТМЦ: ${pur.title}\n• Проект: ${pur.project.name}`
        );
      }

      if (pur.requester?.telegramId) {
        await sendTelegramMessage(pur.requester.telegramId, `❌ Ваша заявка *#${pur.id}* (${pur.title}) по проекту *${pur.project.name}* была отклонена руководством.`);
      }

      return { replyText: `❌ Заявка *#${pur.id}* отклонена.`, keyboard: defaultUserKeyboard };
    }

    // 3. APPROVE INVOICE (with PIN check for >= 500k KZT!)
    if (purApproveInvMatch) {
      if (!['ADMIN', 'MANAGER'].includes(user.role)) {
        return { replyText: '⚠️ У вас нет прав для утверждения счетов к оплате.' };
      }
      const purId = Number(purApproveInvMatch[1]);
      const pur = await prisma.purchaseRequest.findUnique({
        where: { id: purId },
        include: { project: true }
      });
      if (!pur) return { replyText: '⚠️ Заявка не найдена.' };

      if (pur.amount >= 500000) {
        if (!user.pinCode) {
          return {
            replyText: `⚠️ *Сумма счета ${pur.amount.toLocaleString('ru-RU')} ₸ превышает 500 000 ₸!*\n\n` +
              `Для подтверждения требуется личный ПИН-код, но он еще не установлен в вашем профиле.`
          };
        }

        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'PENDING_PIN_APPROVAL',
            details: String(pur.id)
          }
        });

        return {
          replyText: `🔒 *Подтверждение крупного платежа: ${pur.amount.toLocaleString('ru-RU')} ₸*\n\n` +
            `*Поставщик:* ${pur.supplierName || 'Поставщик'}\n` +
            `*Проект:* ${pur.project.name}\n` +
            `*ТМЦ:* ${pur.title}\n\n` +
            `👉 Введите ваш персональный 4-значный ПИН-код для подтверждения оплаты:`
        };
      }

      await prisma.purchaseRequest.update({
        where: { id: purId },
        data: { status: 'APPROVED_FOR_PAYMENT' }
      });

      // Создаем персональную задачу на оплату для Главного бухгалтера
      await createOrUpdatePaymentTask(purId);

      if (messageId && chatId) {
        await editTelegramMessageText(
          chatId,
          messageId,
          `💳 *Счет по заявке #${pur.id} согласован к оплате!*\n\n` +
          `• Поставщик: ${pur.supplierName || 'Поставщик'}\n` +
          `• Сумма: ${pur.amount.toLocaleString('ru-RU')} ₸`
        );
      }

      const chiefAccountants = await prisma.user.findMany({
        where: {
          OR: [
            { role: 'CHIEF_ACCOUNTANT' },
            { role: 'ACCOUNTANT', title: { contains: 'главн', mode: 'insensitive' } },
            { role: 'ADMIN' }
          ],
          telegramId: { not: null }
        }
      });
      const targetAccountants = chiefAccountants.length > 0 
        ? chiefAccountants 
        : await prisma.user.findMany({ where: { role: { in: ['ACCOUNTANT', 'ADMIN'] }, telegramId: { not: null } } });

      const accMsg = `💳 *Счет утвержден к оплате!*\n\n` +
        `*Проект:* ${pur.project.name}\n` +
        `*ТМЦ:* ${pur.title}\n` +
        `*Поставщик:* ${pur.supplierName || 'Не указан'}\n` +
        `*Сумма:* ${pur.amount.toLocaleString('ru-RU')} ₸\n\n` +
        (pur.invoiceFileUrl ? `📎 [Скачать счет](${pur.invoiceFileUrl})\n\n` : '') +
        `👉 Произведите оплату в клиент-банке:`;
      const accKeyboard = {
        inline_keyboard: [
          [{ text: '💳 Подтвердить: Оплачено', callback_data: `pur_pay_inv_${pur.id}` }]
        ]
      };
      for (const acc of targetAccountants) {
        if (acc.telegramId) await sendTelegramMessage(acc.telegramId, accMsg, { parse_mode: 'Markdown', reply_markup: accKeyboard });
      }

      return {
        replyText: `✅ Счет по заявке *#${pur.id}* на сумму *${pur.amount.toLocaleString('ru-RU')} ₸* успешно утвержден и передан в бухгалтерию!`,
        keyboard: defaultUserKeyboard,
      };
    }

    // 4. PAY INVOICE (Chief Accountant)
    if (purPayInvMatch) {
      if (!isChiefAccountantUser(user)) {
        return { replyText: '⚠️ У вас нет полномочий Главного бухгалтера для подтверждения оплаты счетов. Право проведения платежей закреплено за Главным бухгалтером и Директором.' };
      }
      const purId = Number(purPayInvMatch[1]);
      const pur = await prisma.purchaseRequest.update({
        where: { id: purId },
        data: { status: 'PAID_AND_ORDERED', paidAt: new Date() },
        include: { project: true, requester: true, supplyUser: true }
      });

      // Завершаем персональную задачу на оплату счета (DONE)
      await completePaymentTask(pur.id);

      if (messageId && chatId) {
        await editTelegramMessageText(
          chatId,
          messageId,
          `✅ *Счет по заявке #${pur.id} ОПЛАЧЕН*\n\n` +
          `• Поставщик: ${pur.supplierName}\n` +
          `• Сумма: ${pur.amount.toLocaleString('ru-RU')} ₸\n` +
          `• Ожидается оформление доверенности формы Д-1`
        );
      }

      const notifyRecipients = [pur.requester?.telegramId, pur.supplyUser?.telegramId].filter(Boolean);
      const paidMsg = `✅ *Счет оплачен*\n\n` +
        `*Проект:* ${pur.project.name}\n` +
        `*ТМЦ:* ${pur.title}\n` +
        `*Поставщик:* ${pur.supplierName || 'Поставщик'}\n` +
        `*Сумма:* ${pur.amount.toLocaleString('ru-RU')} ₸\n\n` +
        `⏳ Бухгалтерия оформляет доверенность формы Д-1 на получение ТМЦ.`;

      for (const tgId of notifyRecipients) {
        if (tgId) await sendTelegramMessage(tgId, paidMsg, { parse_mode: 'Markdown' });
      }

      return {
        replyText: `✅ Оплата счета по заявке *#${pur.id}* подтверждена!\n\nНажмите кнопку ниже, чтобы прикрепить скан доверенности формы Д-1:`,
        keyboard: {
          inline_keyboard: [
            [{ text: '📜 Прикрепить доверенность', callback_data: `attach_poa_${pur.id}` }]
          ]
        },
      };
    }

    // 4.5 IN_TRANSIT (Снабженец забрал товар по доверенности / Везем на склад)
    if (purInTransitMatch) {
      const purId = Number(purInTransitMatch[1]);
      const pur = await prisma.purchaseRequest.update({
        where: { id: purId },
        data: { status: 'IN_TRANSIT', inTransitAt: new Date() },
        include: { project: true, requester: true, supplyUser: true }
      });

      if (messageId && chatId) {
        await editTelegramMessageText(
          chatId,
          messageId,
          `🚚 *Груз по заявке #${pur.id} получен и направляется на склад!*\n\n` +
          `• Поставщик: ${pur.supplierName}\n` +
          `• ТМЦ: ${pur.title}`
        );
      }

      // Notify Warehouse
      const warehouseUsers = await prisma.user.findMany({
        where: { role: { in: ['WAREHOUSE', 'ADMIN'] }, telegramId: { not: null } }
      });
      const whMsg = `🚚 *Груз получен у поставщика и направляется на склад!*\n\n` +
        `*Проект:* ${pur.project.name}\n` +
        `*ТМЦ:* ${pur.title}\n` +
        `*Поставщик:* ${pur.supplierName || 'Поставщик'}\n` +
        (pur.poaNumber ? `*Доверенность:* №${pur.poaNumber} (${pur.poaIssuedTo || ''})\n` : '') +
        `\n👉 Кладовщику: после проверки и выгрузки нажмите:`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '📦 Принять на склад', callback_data: `pur_delivered_${pur.id}` }
          ]
        ]
      };

      for (const wh of warehouseUsers) {
        if (wh.telegramId) await sendTelegramMessage(wh.telegramId, whMsg, { parse_mode: 'Markdown', reply_markup: keyboard });
      }

      return {
        replyText: `🚚 Отметка доставки сохранена! Статус заявки *#${pur.id}* изменен на *«В пути на склад»*.`,
        keyboard: defaultUserKeyboard,
      };
    }

    // 5. DELIVERED (Кладовщик принял на склад)
    if (purDeliveredMatch) {
      const purId = Number(purDeliveredMatch[1]);
      const pur = await prisma.purchaseRequest.update({
        where: { id: purId },
        data: { status: 'DELIVERED', deliveredAt: new Date(), receivedByUserId: user.id },
        include: { project: true, requester: true, supplyUser: true }
      });

      // Автоматически закрываем задачу снабжения как выполненную (DONE)
      await completeSupplyTask(pur.id);

      if (messageId && chatId) {
        await editTelegramMessageText(
          chatId,
          messageId,
          `📦 *Заявка #${pur.id} ПРИНЯТА НА СКЛАД*\n\n` +
          `• Проект: ${pur.project.name}\n` +
          `• ТМЦ: ${pur.title}\n` +
          `• Принял: ${user.name}`
        );
      }

      if (pur.requester?.telegramId) {
        await sendTelegramMessage(pur.requester.telegramId, `🎉 *Материалы поступили!*\n\nПо вашей заявке *#${pur.id}* (${pur.title}) для проекта *${pur.project.name}* заказ доставлен и принят на склад кладовщиком.`);
      }
      if (pur.supplyUser?.telegramId && pur.supplyUser.telegramId !== user.telegramId) {
        await sendTelegramMessage(pur.supplyUser.telegramId, `📦 ТМЦ по заявке *#${pur.id}* (${pur.title}) успешно приняты на склад.`);
      }

      return {
        replyText: `📦 Приемка зафиксирована! Заявка *#${pur.id}* успешно закрыта как доставленная на склад.`,
        keyboard: defaultUserKeyboard,
      };
    }
  }

  // =========================================================================
  // 2. Task Status Transitions (task_inprogress_, task_otk_, task_blocked_, task_done_)
  // =========================================================================
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
    const isPrivileged = user.role === 'ADMIN' || user.role === 'MANAGER';

    if (!task || (!isAssigned && !isPrivileged)) {
      return {
        replyText: '⚠️ Ошибка: Задача не найдена или назначена другому исполнителю.',
      };
    }

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
      await notifyManagersAboutBlocker(task.project, task, user, alertText);
    } else if (newStatus === 'DONE' || newStatus === 'IN_PROGRESS') {
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
      keyboard: defaultUserKeyboard,
    };
  }

  // =========================================================================
  // 3. User Tools View: "🛠 Мой инструмент" or /tools
  // =========================================================================
  if (cleanText === '/tools' || cleanText === '🛠 Мой инструмент' || cleanText.toLowerCase() === 'инструмент') {
    const userTools = await prisma.tool.findMany({
      where: {
        holderId: user.id,
        isArchived: false,
      },
      include: {
        logs: {
          where: { employeeId: user.id },
          orderBy: { issueDate: 'desc' },
          take: 1,
          include: { project: true }
        }
      }
    });

    if (userTools.length === 0) {
      return {
        replyText: 'На вас в данный момент не числится выданного инструмента со склада.',
        keyboard: defaultUserKeyboard,
      };
    }

    let msg = '🛠 *Инструмент, закрепленный за вами:*\n\n';
    userTools.forEach((tool, idx) => {
      const lastLog = tool.logs[0];
      const statusIcon = tool.status === 'PENDING_ACCEPTANCE' ? '⏳ Ожидает вашего подтверждения' : '✅ На руках';
      msg += `${idx + 1}. *${tool.name}* (Инв. № ${tool.serialNumber || 'б/н'})\n`;
      msg += `   • Категория: ${tool.category}\n`;
      msg += `   • Статус: *${statusIcon}*\n`;
      if (lastLog?.project?.name) {
        msg += `   • Проект: _${lastLog.project.name}_\n`;
      }
      msg += '\n';
    });

    return {
      replyText: msg,
      keyboard: defaultUserKeyboard,
    };
  }

  // =========================================================================
  // 4. Command "/start", "Привет", "/help"
  // =========================================================================
  if (
    cleanText === '/start' || 
    cleanText === '🔄 Главное меню (/start)' || 
    cleanText === '🔄 Главное меню' || 
    cleanText === 'Главное меню' || 
    cleanText.toLowerCase() === 'меню' || 
    cleanText.toLowerCase() === 'привет' || 
    cleanText === '/help'
  ) {
    return {
      replyText:
        `👋 Здравствуйте, *${user.name}*!\n\n` +
        `Вы авторизованы в системе как *${user.role}* (${user.title || 'Сотрудник'}).\n\n` +
        `📌 *Доступные действия:*\n` +
        `• *«📝 Подать заявку на закупку»* — пошаговый мастер заказа ТМЦ с фото или спецификацией;\n` +
        `• *«✈️ Заявка на командировку»* — оформление служебной поездки на объект;\n` +
        `• *«📋 Мои задачи»* — просмотр и отметка статусов назначенных работ;\n` +
        `• *«🛠 Мой инструмент»* — список выданного оборудования со склада.\n\n` +
        `Или просто напишите текстовый отчет о проделанной работе своими словами.`,
      keyboard: defaultUserKeyboard,
    };
  }

  // =========================================================================
  // 5. Tasks List: /tasks or "📋 Мои задачи"
  // =========================================================================
  if (cleanText === '/tasks' || cleanText === '📋 Мои задачи' || cleanText.toLowerCase() === 'задачи') {
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
        keyboard: defaultUserKeyboard,
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

  // =========================================================================
  // 6. Free Text / AI Agent Dispatcher Layer (Gemini Function Calling)
  // =========================================================================
  const { processAiMessage } = await import('@/lib/ai/agentDispatcher');
  const activeTask = await prisma.task.findFirst({
    where: {
      assignees: { some: { id: user.id } },
      status: { not: 'DONE' },
    },
    include: { project: true },
  });

  const aiResult = await processAiMessage({
    text: cleanText,
    user,
    activeProjectId: activeTask?.projectId,
  });

  return {
    replyText: aiResult.replyText,
    keyboard: defaultUserKeyboard,
  };
}
