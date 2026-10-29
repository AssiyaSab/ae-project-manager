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

  // 1.5 Handle File Upload (Document/Photo)
  if (fileContext && messageId && chatId) {
    // 1.5.1 Check if user has an active pending specification creation request (AWAITING_PURCHASE_SPEC)
    const pendingSpecLog = await prisma.auditLog.findFirst({
      where: {
        userId: user.id,
        action: 'AWAITING_PURCHASE_SPEC',
        createdAt: { gte: new Date(Date.now() - 20 * 60 * 1000) } // valid for 20 mins
      },
      orderBy: { createdAt: 'desc' }
    });

    if (pendingSpecLog && pendingSpecLog.details) {
      const projectId = Number(pendingSpecLog.details);
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (project) {
        const { getTelegramFileUrl } = await import('./telegram');
        const fileUrl = await getTelegramFileUrl(fileContext.fileId);
        
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

        // Clear pending log
        await prisma.auditLog.delete({ where: { id: pendingSpecLog.id } }).catch(() => {});

        // Notify GIP/Admin
        const admins = await prisma.user.findMany({
          where: { role: { in: ['ADMIN', 'MANAGER'] }, telegramId: { not: null } }
        });

        const notifyMsg = `🛒 *Новая заявка на закупку (со спецификацией)*\n\n` +
          `*Проект:* ${project.name}\n` +
          `*Инициатор:* ${user.name} (${user.role})\n` +
          `*Описание:* ${reqTitle}\n` +
          (fileUrl ? `📎 [Открыть спецификацию](${fileUrl})\n\n` : `\n`) +
          `👉 Разрешить закупку в снабжение?`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: '✅ Разрешить в снабжение', callback_data: `pur_approve_need_${purchase.id}` },
              { text: '❌ Отклонить', callback_data: `pur_reject_${purchase.id}` }
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
            `⏳ Заявка передана Директору на первичное согласование потребности.`
        };
      }
    }

    // 1.5.2 Check if this file is an invoice attached to a purchase request (e.g. caption has "#12" or "заявка 12")
    const purchaseMatch = cleanText.match(/(?:#|заявк[аи]\s*)(\d+)/i);
    if (purchaseMatch && fileContext.fileId) {
      const purId = Number(purchaseMatch[1]);
      const pur = await prisma.purchaseRequest.findUnique({
        where: { id: purId },
        include: { project: true }
      });
      if (pur) {
        const { getTelegramFileUrl } = await import('./telegram');
        const fileUrl = await getTelegramFileUrl(fileContext.fileId);
        if (fileUrl) {
          // Parse amount if specified in caption (e.g. 120 000 ₸ or 120000)
          const amountMatch = cleanText.match(/(\d[\d\s]{2,})\s*(?:₸|kzt|тенге|руб)?/i);
          const parsedAmount = amountMatch ? Number(amountMatch[1].replace(/\s/g, '')) : undefined;

          // Parse supplier name if entered after #id
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

          // Notify GIP/Admin with approval buttons
          const admins = await prisma.user.findMany({
            where: { role: { in: ['ADMIN', 'MANAGER'] }, telegramId: { not: null } }
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
                { text: '💳 Утвердить счет к оплате', callback_data: `pur_approve_inv_${pur.id}` },
                { text: '❌ Отклонить', callback_data: `pur_reject_${pur.id}` }
              ]
            ]
          };

          for (const admin of admins) {
            if (admin.telegramId) await sendTelegramMessage(admin.telegramId, alertMsg, { parse_mode: 'Markdown', reply_markup: keyboard });
          }

          return {
            replyText: `✅ Счет успешно прикреплен к заявке *#${pur.id}* и отправлен Директору на утверждение!`
          };
        }
      }
    }

    // Default: Notify all admins about the file
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
        replyText: `✅ Файл успешно получен и переслан руководству (Директор).`,
      };
    } else {
      return {
        replyText: `✅ Файл получен. (Обратите внимание: в системе сейчас нет активных администраторов с привязанным Telegram).`,
      };
    }
  }

  // 1.7 Handle /cancel command
  if (cleanText === '/cancel' || cleanText === 'pur_cancel') {
    await prisma.auditLog.deleteMany({
      where: { userId: user.id, action: { in: ['AWAITING_PURCHASE_SPEC', 'PENDING_PIN_APPROVAL'] } }
    }).catch(() => {});

    return {
      replyText: 'Операция отменена. Чем еще могу помочь?'
    };
  }

  // 1.7.5 Handle /purchase or "🛒 Заявка на закупку"
  if (
    cleanText === '/purchase' || 
    cleanText === '🛒 Заявка на закупку' || 
    cleanText.toLowerCase() === 'закупка' || 
    cleanText.toLowerCase() === 'заявка' ||
    cleanText === 'pur_new_request'
  ) {
    const activeProjects = await prisma.project.findMany({
      where: { status: { not: 'DONE' } },
      orderBy: { updatedAt: 'desc' },
      take: 12
    });

    if (activeProjects.length === 0) {
      return {
        replyText: 'В системе пока нет активных проектов для создания заявки на закупку.'
      };
    }

    const inline_keyboard = activeProjects.map(p => [
      { text: `📁 ${p.name}`, callback_data: `pur_select_proj_${p.id}` }
    ]);

    inline_keyboard.push([{ text: '❌ Отмена', callback_data: 'pur_cancel' }]);

    return {
      replyText: `🛒 *Создание заявки на закупку ТМЦ*\n\nВыберите проект, для которого требуются материалы или оборудование:`,
      keyboard: { inline_keyboard }
    };
  }

  // 1.7.6 Handle Project Selection for Purchase: pur_select_proj_(\d+)
  const purSelectProjMatch = cleanText.match(/^pur_select_proj_(\d+)$/);
  if (purSelectProjMatch) {
    const projectId = Number(purSelectProjMatch[1]);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return { replyText: '⚠️ Проект не найден.' };

    await prisma.auditLog.deleteMany({
      where: { userId: user.id, action: 'AWAITING_PURCHASE_SPEC' }
    }).catch(() => {});

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'AWAITING_PURCHASE_SPEC',
        details: String(project.id)
      }
    });

    return {
      replyText: `📁 Выбран проект: *${project.name}*\n\n` +
        `📎 Теперь *отправьте файл спецификации* (Excel, PDF, Word, фото перечня с цеха) или просто *напишите списком в сообщении*, что именно необходимо закупить:\n\n` +
        `_(Для отмены отправьте /cancel)_`
    };
  }

  // 1.7.7 Check if user is typing text specification for pending purchase request
  if (cleanText && cleanText !== '/cancel' && cleanText !== 'pur_cancel' && !cleanText.startsWith('/') && !/^\d{4}$/.test(cleanText)) {
    const pendingSpecLog = await prisma.auditLog.findFirst({
      where: {
        userId: user.id,
        action: 'AWAITING_PURCHASE_SPEC',
        createdAt: { gte: new Date(Date.now() - 20 * 60 * 1000) }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (pendingSpecLog && pendingSpecLog.details) {
      const projectId = Number(pendingSpecLog.details);
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (project) {
        const purchase = await prisma.purchaseRequest.create({
          data: {
            type: 'INVOICE',
            title: cleanText,
            projectId: project.id,
            requesterId: user.id,
            status: 'PENDING_APPROVAL',
            amount: 0
          },
          include: { project: true, requester: true }
        });

        await prisma.auditLog.delete({ where: { id: pendingSpecLog.id } }).catch(() => {});

        // Notify GIP/Admin
        const admins = await prisma.user.findMany({
          where: { role: { in: ['ADMIN', 'MANAGER'] }, telegramId: { not: null } }
        });

        const notifyMsg = `🛒 *Новая заявка на закупку*\n\n` +
          `*Проект:* ${project.name}\n` +
          `*Инициатор:* ${user.name} (${user.role})\n` +
          `*Потребность:* ${cleanText}\n\n` +
          `👉 Разрешить закупку в снабжение?`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: '✅ Разрешить в снабжение', callback_data: `pur_approve_need_${purchase.id}` },
              { text: '❌ Отклонить', callback_data: `pur_reject_${purchase.id}` }
            ]
          ]
        };

        for (const admin of admins) {
          if (admin.telegramId) await sendTelegramMessage(admin.telegramId, notifyMsg, { parse_mode: 'Markdown', reply_markup: keyboard });
        }

        return {
          replyText: `🎉 *Заявка на закупку #${purchase.id} успешно создана!*\n\n` +
            `*Проект:* ${project.name}\n` +
            `*Потребность:* ${cleanText}\n\n` +
            `⏳ Заявка передана Директору на первичное согласование потребности.`
        };
      }
    }
  }

  // 1.8 Handle 4-digit PIN verification for large invoice approvals (> 500 000 ₸)
  if (/^\d{4}$/.test(cleanText)) {
    const pendingLog = await prisma.auditLog.findFirst({
      where: {
        userId: user.id,
        action: 'PENDING_PIN_APPROVAL',
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } // valid for 15 mins
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
          // PIN verified! Approve invoice
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

          // Delete pending PIN log
          await prisma.auditLog.delete({ where: { id: pendingLog.id } }).catch(() => {});

          // Notify Accountants
          const accountants = await prisma.user.findMany({
            where: { role: { in: ['ACCOUNTANT', 'ADMIN'] }, telegramId: { not: null } }
          });
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

          for (const acc of accountants) {
            if (acc.telegramId) await sendTelegramMessage(acc.telegramId, accMsg, { parse_mode: 'Markdown', reply_markup: accKeyboard });
          }

          return {
            replyText: `✅ *Личный ПИН-код подтвержден!*\n\nСчет по заявке *#${pur.id}* на сумму *${pur.amount.toLocaleString('ru-RU')} ₸* успешно утвержден и передан в бухгалтерию на оплату.`
          };
        } else {
          return {
            replyText: `❌ *Неверный ПИН-код!*\nПожалуйста, введите правильный 4-значный ПИН-код из вашего профиля.`
          };
        }
      }
    }
  }

  // 1.9 Handle Procurement Callbacks
  const purApproveNeedMatch = cleanText.match(/^pur_approve_need_(\d+)$/);
  const purRejectMatch = cleanText.match(/^pur_reject_(\d+)$/);
  const purApproveInvMatch = cleanText.match(/^pur_approve_inv_(\d+)$/);
  const purPayInvMatch = cleanText.match(/^pur_pay_inv_(\d+)$/);
  const purDeliveredMatch = cleanText.match(/^pur_delivered_(\d+)$/);

  if (purApproveNeedMatch || purRejectMatch || purApproveInvMatch || purPayInvMatch || purDeliveredMatch) {
    // 1. APPROVE NEED
    if (purApproveNeedMatch) {
      if (!['ADMIN', 'MANAGER', 'GIP'].includes(user.role)) {
        return { replyText: '⚠️ У вас нет прав для согласования потребности.' };
      }
      const purId = Number(purApproveNeedMatch[1]);
      const pur = await prisma.purchaseRequest.update({
        where: { id: purId },
        data: { status: 'IN_PROCUREMENT' },
        include: { project: true, requester: true }
      });

      // Notify Supply
      const supplyUsers = await prisma.user.findMany({
        where: { role: 'SUPPLY', telegramId: { not: null } }
      });
      const sMsg = `📦 *Заявка #${pur.id} разрешена Директором в снабжение!*\n\n` +
        `*Проект:* ${pur.project.name}\n` +
        `*Потребность:* ${pur.title}\n` +
        `*Заявитель:* ${pur.requester?.name}\n\n` +
        `👉 Запросите счет у поставщика и перешлите его боту с подписью: *#${pur.id} [Поставщик] [Сумма]*`;
      for (const sUser of supplyUsers) {
        if (sUser.telegramId) await sendTelegramMessage(sUser.telegramId, sMsg, { parse_mode: 'Markdown' });
      }

      return {
        replyText: `✅ Заявка *#${pur.id}* одобрена и передана в отдел снабжения!`
      };
    }

    // 2. REJECT
    if (purRejectMatch) {
      if (!['ADMIN', 'MANAGER', 'GIP'].includes(user.role)) {
        return { replyText: '⚠️ У вас нет прав для отклонения заявок.' };
      }
      const purId = Number(purRejectMatch[1]);
      const pur = await prisma.purchaseRequest.update({
        where: { id: purId },
        data: { status: 'REJECTED' },
        include: { project: true, requester: true }
      });

      if (pur.requester?.telegramId) {
        await sendTelegramMessage(pur.requester.telegramId, `❌ Ваша заявка *#${pur.id}* (${pur.title}) по проекту *${pur.project.name}* была отклонена руководством.`);
      }

      return { replyText: `❌ Заявка *#${pur.id}* отклонена.` };
    }

    // 3. APPROVE INVOICE (with PIN check for >= 500k KZT!)
    if (purApproveInvMatch) {
      if (!['ADMIN', 'MANAGER', 'GIP'].includes(user.role)) {
        return { replyText: '⚠️ У вас нет прав для утверждения счетов к оплате.' };
      }
      const purId = Number(purApproveInvMatch[1]);
      const pur = await prisma.purchaseRequest.findUnique({
        where: { id: purId },
        include: { project: true }
      });
      if (!pur) return { replyText: '⚠️ Заявка не найдена.' };

      // Check PIN threshold: 500 000 KZT
      if (pur.amount >= 500000) {
        if (!user.pinCode) {
          return {
            replyText: `⚠️ *Сумма счета ${pur.amount.toLocaleString('ru-RU')} ₸ превышает 500 000 ₸!*\n\n` +
              `Для подтверждения требуется личный ПИН-код, но он еще не установлен в вашем профиле.\n` +
              `Пожалуйста, установите 4-значный ПИН-код в панели управления сотрудниками или согласуйте счет через веб-портал.`
          };
        }

        // Record pending PIN approval state
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

      // If under 500 000 KZT: approve immediately
      await prisma.purchaseRequest.update({
        where: { id: purId },
        data: { status: 'APPROVED_FOR_PAYMENT' }
      });

      // Notify accountants
      const accountants = await prisma.user.findMany({
        where: { role: { in: ['ACCOUNTANT', 'ADMIN'] }, telegramId: { not: null } }
      });
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
      for (const acc of accountants) {
        if (acc.telegramId) await sendTelegramMessage(acc.telegramId, accMsg, { parse_mode: 'Markdown', reply_markup: accKeyboard });
      }

      return {
        replyText: `✅ Счет по заявке *#${pur.id}* на сумму *${pur.amount.toLocaleString('ru-RU')} ₸* успешно утвержден и передан в бухгалтерию!`
      };
    }

    // 4. PAY INVOICE (Accountant)
    if (purPayInvMatch) {
      if (!['ACCOUNTANT', 'ADMIN'].includes(user.role)) {
        return { replyText: '⚠️ У вас нет прав бухгалтера для отметки оплаты.' };
      }
      const purId = Number(purPayInvMatch[1]);
      const pur = await prisma.purchaseRequest.update({
        where: { id: purId },
        data: { status: 'PAID_AND_ORDERED', paidAt: new Date() },
        include: { project: true, requester: true, supplyUser: true }
      });

      // Notify supply and requester
      const notifyRecipients = [pur.requester?.telegramId, pur.supplyUser?.telegramId].filter(Boolean);
      const paidMsg = `✅ *Счет оплачен*\n\n` +
        `*Проект:* ${pur.project.name}\n` +
        `*ТМЦ:* ${pur.title}\n` +
        `*Поставщик:* ${pur.supplierName || 'Поставщик'}\n` +
        `*Сумма:* ${pur.amount.toLocaleString('ru-RU')} ₸\n\n` +
        `🚚 Заказ запущен в доставку.`;
      
      const delivKeyboard = {
        inline_keyboard: [
          [{ text: '📦 Доставлено на склад', callback_data: `pur_delivered_${pur.id}` }]
        ]
      };

      for (const tgId of notifyRecipients) {
        if (tgId) await sendTelegramMessage(tgId, paidMsg, { parse_mode: 'Markdown', reply_markup: delivKeyboard });
      }

      return {
        replyText: `✅ Оплата счета по заявке *#${pur.id}* подтверждена!`
      };
    }

    // 5. DELIVERED
    if (purDeliveredMatch) {
      const purId = Number(purDeliveredMatch[1]);
      const pur = await prisma.purchaseRequest.update({
        where: { id: purId },
        data: { status: 'DELIVERED', deliveredAt: new Date(), receivedByUserId: user.id },
        include: { project: true, requester: true }
      });

      if (pur.requester?.telegramId) {
        await sendTelegramMessage(pur.requester.telegramId, `🎉 *Материалы поступили!*\n\nПо вашей заявке *#${pur.id}* (${pur.title}) для проекта *${pur.project.name}* заказ доставлен и готов к выдаче в производство / на объект.`);
      }

      return {
        replyText: `📦 Отметка доставки сохранена! Заявка *#${pur.id}* закрыта как доставленная.`
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
        `📌 *Быстрые действия:*\n` +
        `• Нажмите кнопку *«🛒 Заявка на закупку»*, чтобы выбрать проект и отправить спецификацию (Excel, PDF, фото);\n` +
        `• Нажмите *«📋 Мои задачи»* (\`/tasks\`), чтобы посмотреть текущие задачи;\n` +
        `• Или просто напишите текстовый отчет своими словами о статусе работ.`,
      keyboard: {
        keyboard: [
          [{ text: '🛒 Заявка на закупку' }, { text: '📋 Мои задачи' }]
        ],
        resize_keyboard: true,
      }
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

      replyText += `\n🚨 *Директор и руководство получили мгновенное уведомление в Telegram.*`;
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
