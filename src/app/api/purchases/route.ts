import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

import { validateAuth, createAuditLog } from '@/lib/auth';
import { sendTelegramMessage } from '@/lib/telegram';

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
        `⏳ Требуется первичное согласование потребности ГИПом/Руководителем.`;

      for (const admin of admins) {
        if (admin.telegramId) {
          await sendTelegramMessage(admin.telegramId, message, { parse_mode: 'Markdown' });
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
      paymentReceiptUrl
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
        // 1. ГИП одобрил потребность -> Уведомляем Снабжение
        if (status === 'IN_PROCUREMENT' || (currentPurchase.status === 'PENDING_APPROVAL' && status === 'APPROVED')) {
          const supplyUsers = await prisma.user.findMany({
            where: { role: 'SUPPLY', telegramId: { not: null } }
          });
          const msg = `📦 *Заявка передана в снабжение*\n\n` +
            `*Проект:* ${updated.project?.name}\n` +
            `*Потребность:* ${updated.title}\n` +
            `*Заявитель:* ${updated.requester?.name}\n\n` +
            `👉 Требуется найти поставщика, запросить счет и внести коммерческие условия.`;
          for (const sUser of supplyUsers) {
            if (sUser.telegramId) await sendTelegramMessage(sUser.telegramId, msg, { parse_mode: 'Markdown' });
          }
        }

        // 2. Снабженец нашел поставщика и выставил счет -> Уведомляем ГИПа/Админа на утверждение счета
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
            `\n👉 Подтвердите оплату счета для передачи в бухгалтерию.`;
          for (const admin of admins) {
            if (admin.telegramId) await sendTelegramMessage(admin.telegramId, msg, { parse_mode: 'Markdown' });
          }
        }

        // 3. ГИП утвердил счет -> Уведомляем Бухгалтерию
        if (status === 'APPROVED_FOR_PAYMENT') {
          const accountants = await prisma.user.findMany({
            where: { role: { in: ['ACCOUNTANT', 'ADMIN'] }, telegramId: { not: null } }
          });
          const msg = `💳 *Счет согласован к оплате*\n\n` +
            `*Проект:* ${updated.project?.name}\n` +
            `*Поставщик:* ${updated.supplierName || 'Не указан'}\n` +
            `*Счет:* №${updated.invoiceNumber || 'б/н'}\n` +
            `*К оплате:* ${updated.amount.toLocaleString('ru-RU')} ₸\n\n` +
            `👉 Произведите оплату и прикрепите платежное поручение.`;
          for (const acc of accountants) {
            if (acc.telegramId) await sendTelegramMessage(acc.telegramId, msg, { parse_mode: 'Markdown' });
          }
        }

        // 4. Оплачено -> Уведомляем Снабженца и Инженера
        if (status === 'PAID_AND_ORDERED' || status === 'PAID' || status === 'PAID_EXPENSE') {
          const notifyRecipients = [updated.requester?.telegramId, updated.supplyUser?.telegramId].filter(Boolean);
          const msg = `✅ *Счет оплачен*\n\n` +
            `*Проект:* ${updated.project?.name}\n` +
            `*ТМЦ:* ${updated.title}\n` +
            `*Поставщик:* ${updated.supplierName || 'Поставщик'}\n` +
            `*Сумма:* ${updated.amount.toLocaleString('ru-RU')} ₸\n\n` +
            `🚚 Заказ запущен в доставку.`;
          for (const tgId of notifyRecipients) {
            if (tgId) await sendTelegramMessage(tgId, msg, { parse_mode: 'Markdown' });
          }
        }

        // 5. Доставлено -> Уведомляем заявителя
        if (status === 'DELIVERED') {
          if (updated.requester?.telegramId) {
            const msg = `🎉 *Материалы поступили!*\n\n` +
              `*Проект:* ${updated.project?.name}\n` +
              `*ТМЦ:* ${updated.title}\n\n` +
              `📦 Заказ доставлен и готов к выдаче в производство / на объект.`;
            await sendTelegramMessage(updated.requester.telegramId, msg, { parse_mode: 'Markdown' });
          }
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
