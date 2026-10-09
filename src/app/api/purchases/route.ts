import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

import { validateAuth, validateApprover, createAuditLog } from '@/lib/auth';

export async function GET(request: Request) {
  const user = await validateAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const isManagement = ['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(user.role);
    
    const purchases = await prisma.purchaseRequest.findMany({
      where: isManagement ? undefined : { requesterId: user.id },
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
  const user = await validateAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    let { title, amount, projectId, fileUrl, requesterId } = body;
    
    const isManagement = ['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(user.role);
    if (!isManagement) {
      requesterId = user.id;
    }

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

      await createAuditLog(user?.id || null, 'CREATE_PURCHASE', `Создана заявка на закупку: ${purchase.title} (${purchase.amount} ₸)`);

    return NextResponse.json(purchase);
  } catch (error) {
    console.error('POST /api/purchases error:', error);
    return NextResponse.json({ error: 'Failed to create purchase request' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await validateAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { id, status, title, amount, projectId, fileUrl } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const data: any = {};
    if (status !== undefined) data.status = status;
    if (title !== undefined) data.title = title;
    if (amount !== undefined) data.amount = Number(amount);
    if (projectId !== undefined) data.projectId = projectId ? Number(projectId) : null;
    if (fileUrl !== undefined) data.fileUrl = fileUrl;

    const purchase = await prisma.purchaseRequest.update({
      where: { id: Number(id) },
      data,
      include: { project: true }
    });

    return NextResponse.json(purchase);
  } catch (error) {
    console.error('PATCH /api/purchases error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await validateAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/purchases error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
