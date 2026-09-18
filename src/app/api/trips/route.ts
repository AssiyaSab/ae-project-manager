import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

import { validateAuth, validateAdmin, createAuditLog } from '@/lib/auth';

export async function GET(request: Request) {
  if (!(await validateAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const trips = await prisma.businessTrip.findMany({
      include: {
        employee: true,
        project: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(trips);
  } catch (error) {
    console.error('GET /api/trips error:', error);
    return NextResponse.json({ error: 'Failed to fetch trips' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await validateAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { employeeId, destination, purpose, startDate, endDate, budget, projectId } = body;
    
    if (!employeeId || !destination || !purpose || !startDate || !endDate || budget == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const trip = await prisma.businessTrip.create({
      data: {
        employeeId: Number(employeeId),
        destination,
        purpose,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        budget: Number(budget),
        projectId: projectId ? Number(projectId) : null,
      },
      include: { employee: true, project: true }
    });

    try {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', telegramId: { not: null } }
      });
      const { sendTelegramMessage } = await import('@/lib/telegram');
      
      const message = `✈️ *Оформлена новая командировка*\n\n` +
        `*Сотрудник:* ${trip.employee?.name || 'Система'}\n` +
        `*Пункт назначения:* ${trip.destination}\n` +
        `*Цель:* ${trip.purpose}\n` +
        `*Даты:* с ${new Date(trip.startDate).toLocaleDateString('ru-RU')} по ${new Date(trip.endDate).toLocaleDateString('ru-RU')}\n` +
        `*Бюджет:* ${trip.budget.toLocaleString('ru-RU')} ₸\n\n` +
        `Зайдите в панель управления для согласования.`;

      for (const admin of admins) {
        if (admin.telegramId) {
          await sendTelegramMessage(admin.telegramId, message, { parse_mode: 'Markdown' });
        }
      }
    } catch (tgError) {
      console.error('Error sending TG notification for trip:', tgError);
    }

    const user = await validateAuth(request); 
    await createAuditLog(user?.id || null, 'CREATE_TRIP', `Создана командировка: ${trip.destination}`); 
    return NextResponse.json(trip);
  } catch (error) {
    console.error('POST /api/trips error:', error);
    return NextResponse.json({ error: 'Failed to create trip request' }, { status: 500 });
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

    const trip = await prisma.businessTrip.update({
      where: { id: Number(id) },
      data: { status },
    });

    return NextResponse.json(trip);
  } catch (error) {
    console.error('PATCH /api/trips error:', error);
    return NextResponse.json({ error: 'Failed to update trip status' }, { status: 500 });
  }
}
