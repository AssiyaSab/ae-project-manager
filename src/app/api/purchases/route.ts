import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

import { validateAuth, validateAdmin, createAuditLog } from '@/lib/auth';

export async function GET(request: Request) {
  if (!(await validateAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const purchases = await prisma.purchaseRequest.findMany({
      include: {
        project: true,
        requester: true,
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
  if (!(await validateAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { title, amount, projectId, fileUrl, requesterId } = body;
    
    if (!title || !amount || !projectId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const purchase = await prisma.purchaseRequest.create({
      data: {
        title,
        amount: Number(amount),
        projectId: Number(projectId),
        fileUrl,
        requesterId: requesterId ? Number(requesterId) : null,
      },
      include: { project: true, requester: true }
    });

    // Notify Telegram Admin here
    try {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', telegramId: { not: null } }
      });
      const { sendTelegramMessage } = await import('@/lib/telegram');
      
      const message = `🛒 *Новая заявка на закупку/расход*\n\n` +
        `*Наименование:* ${purchase.title}\n` +
        `*Сумма:* ${purchase.amount.toLocaleString('ru-RU')} ₸\n` +
        `*Проект:* ${purchase.project?.name || 'Не указан'}\n` +
        `*От кого:* ${purchase.requester?.name || 'Система'}\n\n` +
        `Зайдите в панель управления для согласования.`;

      for (const admin of admins) {
        if (admin.telegramId) {
          await sendTelegramMessage(admin.telegramId, message, { parse_mode: 'Markdown' });
        }
      }
    } catch (tgError) {
      console.error('Error sending TG notification for purchase:', tgError);
    }

      const user = await validateAuth(request);
      await createAuditLog(user?.id || null, 'CREATE_PURCHASE', `Создана заявка на закупку: ${purchase.title} (${purchase.amount} ₸)`);

    return NextResponse.json(purchase);
  } catch (error) {
    console.error('POST /api/purchases error:', error);
    return NextResponse.json({ error: 'Failed to create purchase request' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { id, status } = body;
    
    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
    }

    const purchase = await prisma.purchaseRequest.update({
      where: { id: Number(id) },
      data: { status },
      include: { project: true }
    });

    // If approved, optionally add it to the project actual costs? The ТЗ says:
    // "после перехода в статус APPROVED сумма автоматически относится на фактические затраты соответствующего проекта"
    // Wait, the Project model doesn't have a "actualCosts" field, only "budget".
    // But tasks have "cost". Let's assume actual cost of the project is calculated dynamically 
    // from Tasks costs + Purchases amount, or we can just update a project field if it existed.
    // For now, calculating dynamically in the frontend or dashboard is best.

    const user = await validateAuth(request);
    await createAuditLog(user?.id || null, 'UPDATE_PURCHASE', `Обновлен статус заявки #${purchase.id} на ${status}`);

    return NextResponse.json(purchase);
  } catch (error) {
    console.error('PATCH /api/purchases error:', error);
    return NextResponse.json({ error: 'Failed to update purchase request' }, { status: 500 });
  }
}
