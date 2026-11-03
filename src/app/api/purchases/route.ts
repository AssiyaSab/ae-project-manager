import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

import { validateAuth, createAuditLog, isChiefAccountantUser } from '@/lib/auth';
import { sendTelegramMessage } from '@/lib/telegram';
import { createOrUpdateSupplyTask, completeSupplyTask, cancelSupplyTask, createOrUpdatePaymentTask, completePaymentTask } from '@/lib/supply-tasks';

export async function GET(request: Request) {
  const user = await validateAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const isManagement = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'SUPPLY'].includes(user.role);
    
    const purchases = await prisma.purchaseRequest.findMany({
      where: isManagement ? undefined : { requesterId: user.id },
      include: {
        project: true,
        requester: true,
        supplyUser: true,
        receivedByUser: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(purchases);
  } catch (error) {
    console.error('GET /api/purchases error:', error);
    return NextResponse.json({ error: 'Failed to fetch purchases' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await validateAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    let { type, title, amount, projectId, fileUrl, requesterId } = body;
    
    const isManagement = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'SUPPLY'].includes(user.role);
    if (!isManagement) {
      requesterId = user.id;
    }

    if (!title || !projectId) {
      return NextResponse.json({ error: 'Missing required fields: title, projectId' }, { status: 400 });
    }

    const requestType = type === 'EXPENSE' ? 'EXPENSE' : 'INVOICE';
    const numAmount = amount ? Number(amount) : 0;
    
    // Начальный статус
    const initialStatus = requestType === 'EXPENSE' ? 'PENDING_EXPENSE' : 'PENDING_APPROVAL';

    const purchase = await prisma.purchaseRequest.create({
      data: {
        type: requestType,
        title,
        amount: numAmount,
        projectId: Number(projectId),
        fileUrl: fileUrl || null,
        status: initialStatus,
        requesterId: requesterId ? Number(requesterId) : user.id,
      },
      include: { project: true, requester: true, supplyUser: true }
    });

    // Telegram уведомление
    try {
      const admins = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'MANAGER'] }, telegramId: { not: null } }
      });
      
      const typeLabel = requestType === 'EXPENSE' ? '🧾 Срочный подотчет / чек' : '🏢 Заявка на закупку (Счет на ТОО)';
      const message = `🛒 *Новая заявка в снабжение*\n\n` +
        `*Тип:* ${typeLabel}\n` +
        `*Наименование:* ${purchase.title}\n` +
        (numAmount > 0 ? `*Ориентировочная сумма:* ${numAmount.toLocaleString('ru-RU')} ₸\n` : '') +
        `*Проект:* ${purchase.project?.name || 'Не указан'}\n` +
        `*Инициатор:* ${purchase.requester?.name || (user as any).name || 'Сотрудник'}\n\n` +
        `⏳ Требуется первичное согласование потребности Директором/Руководителем.`;

      const initialKeyboard = {
        inline_keyboard: [
          [
            { text: '✅ Разрешить в снабжение', callback_data: `pur_approve_need_${purchase.id}` },
            { text: '❌ Отклонить', callback_data: `pur_reject_${purchase.id}` }
          ]
        ]
      };

      for (const admin of admins) {
        if (admin.telegramId) {
          await sendTelegramMessage(admin.telegramId, message, { parse_mode: 'Markdown', reply_markup: initialKeyboard });
        }
      }
    } catch (tgError) {
      console.error('Error sending TG notification for purchase:', tgError);
    }

    await createAuditLog(user.id || null, 'CREATE_PURCHASE', `Создана заявка [${requestType}]: ${purchase.title}`);

    return NextResponse.json(purchase);
  } catch (error) {
    console.error('POST /api/purchases error:', error);
    return NextResponse.json({ error: 'Failed to create purchase request' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await validateAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { 
      id, 
      status, 
      title, 
      amount, 
      projectId, 
      fileUrl,
      supplierName,
      invoiceNumber,
      invoiceDate,
      plannedDeliveryDate,
      supplyComment,
      invoiceFileUrl,
      paymentReceiptUrl,
      poaNumber,
      poaDate,
      poaFileUrl,
      poaIssuedTo
    } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const currentPurchase = await prisma.purchaseRequest.findUnique({
      where: { id: Number(id) },
      include: { project: true, requester: true, supplyUser: true }
    });

    if (!currentPurchase) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    // Security check: Personal PIN code required for invoices >= 500 000 KZT
    if (status === 'APPROVED_FOR_PAYMENT' && (currentPurchase.amount >= 500000 || (amount && Number(amount) >= 500000))) {
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (dbUser && dbUser.pinCode) {
        if (!body.pinCode || body.pinCode !== dbUser.pinCode) {
          return NextResponse.json({ error: 'Неверный персональный ПИН-код для подтверждения крупного платежа (> 500 000 ₸)' }, { status: 403 });
        }
      }
    }

    // Security check: Only Chief Accountant or Admin can confirm payment
    if ((status === 'PAID_AND_ORDERED' || status === 'PAID' || status === 'PAID_EXPENSE') && status !== currentPurchase.status) {
      if (!isChiefAccountantUser(user)) {
        return NextResponse.json({ error: 'Только Главный бухгалтер или Директор имеет право подтверждать оплату счетов' }, { status: 403 });
      }
    }

    const data: any = {};
    if (status !== undefined) data.status = status;
    if (title !== undefined) data.title = title;
    if (amount !== undefined) data.amount = Number(amount);
    if (projectId !== undefined) data.projectId = projectId ? Number(projectId) : null;
    if (fileUrl !== undefined) data.fileUrl = fileUrl;

    if (supplierName !== undefined) data.supplierName = supplierName;
    if (invoiceNumber !== undefined) data.invoiceNumber = invoiceNumber;
    if (invoiceDate !== undefined) data.invoiceDate = invoiceDate ? new Date(invoiceDate) : null;
    if (plannedDeliveryDate !== undefined) data.plannedDeliveryDate = plannedDeliveryDate ? new Date(plannedDeliveryDate) : null;
    if (supplyComment !== undefined) data.supplyComment = supplyComment;
    if (invoiceFileUrl !== undefined) data.invoiceFileUrl = invoiceFileUrl;
    if (paymentReceiptUrl !== undefined) data.paymentReceiptUrl = paymentReceiptUrl;

    if (poaNumber !== undefined) data.poaNumber = poaNumber;
    if (poaDate !== undefined) data.poaDate = poaDate ? new Date(poaDate) : null;
    if (poaFileUrl !== undefined) data.poaFileUrl = poaFileUrl;
    if (poaIssuedTo !== undefined) data.poaIssuedTo = poaIssuedTo;

    // Автоматическая фиксация ответственных при смене статусов
    if (status === 'IN_PROCUREMENT') {
      data.supplyUserId = user.id || currentPurchase.supplyUserId;
    }
    if (status === 'APPROVED_FOR_PAYMENT') {
      // Сумма счета утверждена
    }
    if (status === 'PAID_AND_ORDERED' || status === 'PAID' || status === 'PAID_EXPENSE') {
      data.paidAt = new Date();
    }
    if (status === 'IN_TRANSIT') {
      data.inTransitAt = new Date();
    }
    if (status === 'DELIVERED') {
      data.deliveredAt = new Date();
      data.receivedByUserId = user.id;
    }

    const updated = await prisma.purchaseRequest.update({
      where: { id: Number(id) },
      data,
      include: { project: true, requester: true, supplyUser: true, receivedByUser: true }
    });

    // Telegram-уведомления по цепочке жизненного цикла
    try {
      if (status && status !== currentPurchase.status) {
        // 1. ГИП / Директор одобрил потребность -> Уведомляем Снабжение
        if (status === 'IN_PROCUREMENT' || (currentPurchase.status === 'PENDING_APPROVAL' && status === 'APPROVED')) {
          // Создаем или обновляем производственную задачу снабженцу в проекте
          await createOrUpdateSupplyTask(updated.id);

          const supplyUsers = await prisma.user.findMany({
            where: { role: { in: ['SUPPLY', 'ADMIN'] }, telegramId: { not: null } }
          });
          const msg = `📦 *Заявка #${updated.id} передана в снабжение*\n\n` +
            `*Проект:* ${updated.project?.name}\n` +
            `*Потребность:* ${updated.title}\n` +
            `*Заявитель:* ${updated.requester?.name || 'Сотрудник'}\n\n` +
            `👉 Запросите счет у поставщика и прикрепите его:`;
          
          const keyboard = {
            inline_keyboard: [
              [
                { text: '📎 Прикрепить счет поставщика', callback_data: `attach_invoice_${updated.id}` }
              ]
            ]
          };

          for (const sUser of supplyUsers) {
            if (sUser.telegramId) await sendTelegramMessage(sUser.telegramId, msg, { parse_mode: 'Markdown', reply_markup: keyboard });
          }
        }

        // 2. Снабженец нашел поставщика и выставил счет -> Уведомляем Директора на утверждение счета
        if (status === 'PENDING_PAYMENT_APPROVAL') {
          const admins = await prisma.user.findMany({
            where: { role: { in: ['ADMIN', 'MANAGER'] }, telegramId: { not: null } }
          });
          const msg = `📑 *Счет готов к согласованию*\n\n` +
            `*Проект:* ${updated.project?.name}\n` +
            `*ТМЦ:* ${updated.title}\n` +
            `*Поставщик:* ${updated.supplierName || 'Не указан'}\n` +
            `*Номер счета:* ${updated.invoiceNumber || 'б/н'}\n` +
            `*Сумма:* ${updated.amount.toLocaleString('ru-RU')} ₸\n` +
            (updated.plannedDeliveryDate ? `*Срок поставки:* ${updated.plannedDeliveryDate.toLocaleDateString('ru-RU')}\n` : '') +
            (updated.invoiceFileUrl ? `📎 [Открыть счет](${updated.invoiceFileUrl})\n` : '') +
            `\n👉 Подтвердите оплату счета для передачи в бухгалтерию:`;
          
          const invoiceKeyboard = {
            inline_keyboard: [
              [
                { text: '💳 Утвердить счет к оплате', callback_data: `pur_approve_inv_${updated.id}` },
                { text: '❌ Отклонить', callback_data: `pur_reject_${updated.id}` }
              ]
            ]
          };

          for (const admin of admins) {
            if (admin.telegramId) await sendTelegramMessage(admin.telegramId, msg, { parse_mode: 'Markdown', reply_markup: invoiceKeyboard });
          }
        }

        // 3. Директор утвердил счет -> Создаем задачу Главному бухгалтеру и уведомляем
        if (status === 'APPROVED_FOR_PAYMENT') {
          // Создаем персональную задачу на оплату для Главного бухгалтера
          await createOrUpdatePaymentTask(updated.id);

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

          // Если отдельный Главный бухгалтер не назначен, уведомляем всех бухгалтеров
          const notifyAccountants = chiefAccountants.length > 0 
            ? chiefAccountants 
            : await prisma.user.findMany({ where: { role: { in: ['ACCOUNTANT', 'ADMIN'] }, telegramId: { not: null } } });

          const msg = `💳 *Счет согласован Директором к оплате!*\n\n` +
            `*Проект:* ${updated.project?.name}\n` +
            `*Поставщик:* ${updated.supplierName || 'Не указан'}\n` +
            `*Счет:* №${updated.invoiceNumber || 'б/н'}\n` +
            `*К оплате:* ${updated.amount.toLocaleString('ru-RU')} ₸\n` +
            (updated.invoiceFileUrl ? `📎 [Скачать счет поставщика](${updated.invoiceFileUrl})\n` : '') +
            `\n👉 Произведите оплату в клиент-банке и подтвердите в боте:`;
          
          const paymentKeyboard = {
            inline_keyboard: [
              [
                { text: '💳 Подтвердить: Оплачено', callback_data: `pur_pay_inv_${updated.id}` }
              ]
            ]
          };

          for (const acc of notifyAccountants) {
            if (acc.telegramId) await sendTelegramMessage(acc.telegramId, msg, { parse_mode: 'Markdown', reply_markup: paymentKeyboard });
          }
        }

        // 4. Оплачено -> Завершаем задачу на оплату, уведомляем Бухгалтерию (доверенность) и Снабженца
        if (status === 'PAID_AND_ORDERED' || status === 'PAID' || status === 'PAID_EXPENSE') {
          // Завершаем задачу на оплату счета (DONE)
          await completePaymentTask(updated.id);
          if (status === 'PAID_AND_ORDERED' || status === 'PAID') {
            const accountants = await prisma.user.findMany({
              where: { role: { in: ['ACCOUNTANT', 'ADMIN'] }, telegramId: { not: null } }
            });
            const accMsg = `✅ *Счет по заявке #${updated.id} оплачен!*\n\n` +
              `*Проект:* ${updated.project?.name}\n` +
              `*ТМЦ:* ${updated.title}\n` +
              `*Поставщик:* ${updated.supplierName || 'Поставщик'}\n` +
              `*Сумма:* ${updated.amount.toLocaleString('ru-RU')} ₸\n\n` +
              `👉 Оформите и прикрепите скан доверенности формы Д-1:`;
            
            const accKeyboard = {
              inline_keyboard: [
                [
                  { text: '📜 Прикрепить доверенность', callback_data: `attach_poa_${updated.id}` }
                ]
              ]
            };

            for (const acc of accountants) {
              if (acc.telegramId) await sendTelegramMessage(acc.telegramId, accMsg, { parse_mode: 'Markdown', reply_markup: accKeyboard });
            }
          }

          const notifyRecipients = [updated.requester?.telegramId, updated.supplyUser?.telegramId].filter(Boolean);
          const msg = `✅ *Счет оплачен*\n\n` +
            `*Проект:* ${updated.project?.name}\n` +
            `*ТМЦ:* ${updated.title}\n` +
            `*Поставщик:* ${updated.supplierName || 'Поставщик'}\n` +
            `*Сумма:* ${updated.amount.toLocaleString('ru-RU')} ₸\n\n` +
            `⏳ Ожидается оформление доверенности формы Д-1 бухгалтерией.`;
          
          for (const tgId of notifyRecipients) {
            if (tgId) await sendTelegramMessage(tgId, msg, { parse_mode: 'Markdown' });
          }
        }

        // 4.5 Доверенность выдана (POA_ISSUED) -> Уведомляем Снабженца
        if (status === 'POA_ISSUED') {
          const supplyUsers = await prisma.user.findMany({
            where: { role: { in: ['SUPPLY', 'ADMIN'] }, telegramId: { not: null } }
          });
          const poaDateStr = updated.poaDate ? new Date(updated.poaDate).toLocaleDateString('ru-RU') : '';
          const msg = `📜 *Выдана доверенность на получение ТМЦ!*\n\n` +
            `*Проект:* ${updated.project?.name}\n` +
            `*Поставщик:* ${updated.supplierName || 'Поставщик'}\n` +
            `*ТМЦ:* ${updated.title}\n` +
            `*Доверенность:* №${updated.poaNumber || 'б/н'} ${poaDateStr ? `от ${poaDateStr}` : ''}\n` +
            `*Выдана на:* ${updated.poaIssuedTo || 'Сотрудника'}\n` +
            (updated.poaFileUrl ? `📎 [Скан доверенности Д-1](${updated.poaFileUrl})\n\n` : '\n') +
            `👉 Заберите товар у поставщика и подтвердите статус доставки:`;

          const keyboard = {
            inline_keyboard: [
              [
                { text: '🚚 Товар получен / Везем на склад', callback_data: `pur_intransit_${updated.id}` }
              ]
            ]
          };

          for (const sUser of supplyUsers) {
            if (sUser.telegramId) {
              await sendTelegramMessage(sUser.telegramId, msg, { parse_mode: 'Markdown', reply_markup: keyboard });
            }
          }
        }

        // 4.6 Груз в пути (IN_TRANSIT) -> Уведомляем Склад
        if (status === 'IN_TRANSIT') {
          const warehouseUsers = await prisma.user.findMany({
            where: { role: { in: ['WAREHOUSE', 'ADMIN'] }, telegramId: { not: null } }
          });
          const msg = `🚚 *Груз получен у поставщика и направляется на склад!*\n\n` +
            `*Проект:* ${updated.project?.name}\n` +
            `*ТМЦ:* ${updated.title}\n` +
            `*Поставщик:* ${updated.supplierName || 'Поставщик'}\n` +
            (updated.poaNumber ? `*По доверенности:* №${updated.poaNumber} (${updated.poaIssuedTo || ''})\n` : '') +
            `\n👉 Кладовщику: после проверки и выгрузки нажмите:`;

          const keyboard = {
            inline_keyboard: [
              [
                { text: '📦 Принять на склад', callback_data: `pur_delivered_${updated.id}` }
              ]
            ]
          };

          for (const wh of warehouseUsers) {
            if (wh.telegramId) {
              await sendTelegramMessage(wh.telegramId, msg, { parse_mode: 'Markdown', reply_markup: keyboard });
            }
          }
        }

        // 5. Доставлено -> Уведомляем заявителя и завершаем задачу снабжения
        if (status === 'DELIVERED') {
          await completeSupplyTask(updated.id);

          if (updated.requester?.telegramId) {
            const msg = `🎉 *Материалы поступили!*\n\n` +
              `*Проект:* ${updated.project?.name}\n` +
              `*ТМЦ:* ${updated.title}\n\n` +
              `📦 Заказ доставлен и готов к выдаче в производство / на объект.`;
            await sendTelegramMessage(updated.requester.telegramId, msg, { parse_mode: 'Markdown' });
          }
        }

        // 6. Отклонено -> отменяем задачу снабжения
        if (status === 'REJECTED') {
          await cancelSupplyTask(updated.id);
        }
      }
    } catch (tgError) {
      console.error('Error in status change Telegram alerts:', tgError);
    }

    await createAuditLog(user.id || null, 'UPDATE_PURCHASE', `Обновлена заявка #${id} (Статус: ${status || currentPurchase.status})`);

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/purchases error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await validateAuth(request);
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized: Admin only' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await prisma.purchaseRequest.delete({
      where: { id: Number(id) },
    });

    await createAuditLog(user.id || null, 'DELETE_PURCHASE', `Удалена заявка #${id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/purchases error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
