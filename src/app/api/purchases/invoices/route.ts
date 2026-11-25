import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateAuth, createAuditLog, isChiefAccountantUser } from '@/lib/auth';
import { sendTelegramMessage } from '@/lib/telegram';
import { createOrUpdatePaymentTask } from '@/lib/supply-tasks';
import { reconcileProjectEstimate } from '@/lib/estimateReconcile';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await validateAuth(request);
  if (!user || !['SUPPLY', 'ADMIN', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'Недостаточно прав для добавления счета' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { purchaseId, supplierName, invoiceNumber, amount, fileUrl, itemIds } = body;

    if (!purchaseId || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Укажите заявку и положительную сумму счета' }, { status: 400 });
    }

    const purchase = await prisma.purchaseRequest.findUnique({
      where: { id: Number(purchaseId) },
      include: { project: true },
    });
    if (!purchase) {
      return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
    }

    const invoice = await prisma.purchaseInvoice.create({
      data: {
        purchaseId: Number(purchaseId),
        supplierName: supplierName || null,
        invoiceNumber: invoiceNumber || null,
        amount: Number(amount),
        fileUrl: fileUrl || null,
        status: 'PENDING_APPROVAL',
      },
    });

    if (Array.isArray(itemIds) && itemIds.length > 0) {
      await prisma.purchaseItem.updateMany({
        where: {
          id: { in: itemIds.map((id: any) => Number(id)) },
          purchaseId: Number(purchaseId),
        },
        data: {
          sourceType: 'INVOICE',
          invoiceId: invoice.id,
          isPaid: false,
        },
      });
    }

    // Уведомляем Директора в Telegram о новом счете по заявке
    try {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', telegramId: { not: null } },
      });
      const msg =
        `📑 *Добавлен счет по заявке #${purchase.id}*\n\n` +
        `*Проект:* ${purchase.project?.name || 'Не указан'}\n` +
        `*Поставщик:* ${supplierName || 'Не указан'}\n` +
        `*Счет №:* ${invoiceNumber || 'б/н'}\n` +
        `*Сумма:* ${Number(amount).toLocaleString('ru-RU')} ₸\n` +
        `*Позиций в счете:* ${Array.isArray(itemIds) ? itemIds.length : 0}`;
      for (const admin of admins) {
        if (admin.telegramId) {
          await sendTelegramMessage(admin.telegramId, msg, { parse_mode: 'Markdown' });
        }
      }
    } catch (tgErr) {
      console.error('TG notify PurchaseInvoice POST error:', tgErr);
    }

    await createAuditLog(
      user.id || null,
      'CREATE_PURCHASE_INVOICE',
      `Добавлен счет #${invoice.id} (${Number(amount).toLocaleString('ru-RU')} ₸) к заявке #${purchaseId}`
    );

    const createdWithItems = await prisma.purchaseInvoice.findUnique({
      where: { id: invoice.id },
      include: { items: true },
    });
    return NextResponse.json(createdWithItems);
  } catch (error) {
    console.error('POST /api/purchases/invoices error:', error);
    return NextResponse.json({ error: 'Failed to create purchase invoice' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await validateAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { invoiceId, action, pinCode } = body;

    if (!invoiceId || !action) {
      return NextResponse.json({ error: 'invoiceId and action are required' }, { status: 400 });
    }

    const invoice = await prisma.purchaseInvoice.findUnique({
      where: { id: Number(invoiceId) },
      include: {
        purchase: { include: { project: true, supplyUser: true } },
        items: true,
      },
    });
    if (!invoice) {
      return NextResponse.json({ error: 'Счет не найден' }, { status: 404 });
    }

    if (action === 'APPROVE') {
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Только Директор может утверждать счет к оплате' }, { status: 403 });
      }
      if (invoice.amount >= 500000) {
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        if (dbUser && dbUser.pinCode && pinCode !== dbUser.pinCode) {
          return NextResponse.json(
            { error: 'Неверный персональный ПИН-код для суммы >= 500 000 ₸' },
            { status: 403 }
          );
        }
      }

      const updated = await prisma.purchaseInvoice.update({
        where: { id: invoice.id },
        data: { status: 'APPROVED_FOR_PAYMENT' },
        include: { items: true },
      });

      await createOrUpdatePaymentTask(invoice.purchaseId);

      try {
        const chiefAccountants = await prisma.user.findMany({
          where: {
            OR: [
              { role: 'CHIEF_ACCOUNTANT' },
              { role: 'ACCOUNTANT', title: { contains: 'главн', mode: 'insensitive' } },
            ],
            telegramId: { not: null },
          },
        });
        const msg =
          `💳 *Счет #${invoice.id} по заявке #${invoice.purchaseId} утвержден к оплате*\n\n` +
          `*Поставщик:* ${invoice.supplierName || 'Не указан'}\n` +
          `*Сумма:* ${invoice.amount.toLocaleString('ru-RU')} ₸`;
        for (const ca of chiefAccountants) {
          if (ca.telegramId) {
            await sendTelegramMessage(ca.telegramId, msg, { parse_mode: 'Markdown' });
          }
        }
      } catch (tgErr) {
        console.error('TG notify PurchaseInvoice APPROVE error:', tgErr);
      }

      await createAuditLog(user.id || null, 'APPROVE_PURCHASE_INVOICE', `Утвержден счет #${invoice.id} по заявке #${invoice.purchaseId}`);
      return NextResponse.json(updated);
    }

    if (action === 'PAY') {
      if (!isChiefAccountantUser(user)) {
        return NextResponse.json(
          { error: 'Только Главный бухгалтер или Директор может подтверждать оплату счета' },
          { status: 403 }
        );
      }

      const updated = await prisma.purchaseInvoice.update({
        where: { id: invoice.id },
        data: { status: 'PAID', paidAt: new Date() },
        include: { items: true },
      });

      await prisma.purchaseItem.updateMany({
        where: { invoiceId: invoice.id },
        data: { isPaid: true },
      });

      await reconcileProjectEstimate(invoice.purchase.projectId);

      await createAuditLog(user.id || null, 'PAY_PURCHASE_INVOICE', `Оплачен счет #${invoice.id} по заявке #${invoice.purchaseId}`);
      return NextResponse.json(updated);
    }

    if (action === 'REJECT') {
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Только Директор может отклонять счет' }, { status: 403 });
      }
      const updated = await prisma.purchaseInvoice.update({
        where: { id: invoice.id },
        data: { status: 'REJECTED' },
        include: { items: true },
      });
      await prisma.purchaseItem.updateMany({
        where: { invoiceId: invoice.id },
        data: { sourceType: 'PENDING', invoiceId: null, isPaid: false },
      });
      await createAuditLog(user.id || null, 'REJECT_PURCHASE_INVOICE', `Отклонен счет #${invoice.id} по заявке #${invoice.purchaseId}`);
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('PATCH /api/purchases/invoices error:', error);
    return NextResponse.json({ error: 'Failed to update purchase invoice' }, { status: 500 });
  }
}
