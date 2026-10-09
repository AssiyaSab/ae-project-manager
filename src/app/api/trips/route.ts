import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { formatDate } from '@/lib/formatters';

export const dynamic = 'force-dynamic';

import { validateAuth, validateApprover, createAuditLog } from '@/lib/auth';

export async function GET(request: Request) {
  const user = await validateAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const isManagement = ['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(user.role);

    const trips = await prisma.businessTrip.findMany({
      where: isManagement ? undefined : { employeeId: user.id },
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
  const user = await validateAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    let { employeeId, destination, purpose, startDate, endDate, budget, projectId } = body;
    
    const isManagement = ['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(user.role);
    if (!isManagement) {
      employeeId = user.id;
    }

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
        `*Даты:* с ${formatDate(trip.startDate)} по ${formatDate(trip.endDate)}\n` +
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

    await createAuditLog(user?.id || null, 'CREATE_TRIP', `Создана командировка: ${trip.destination}`); 
    return NextResponse.json(trip);
  } catch (error) {
    console.error('POST /api/trips error:', error);
    return NextResponse.json({ error: 'Failed to create trip request' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await validateAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { id, status, employeeId, destination, purpose, startDate, endDate, budget, projectId } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const data: any = {};
    if (status !== undefined) data.status = status;
    if (employeeId !== undefined) data.employeeId = Number(employeeId);
    if (destination !== undefined) data.destination = destination;
    if (purpose !== undefined) data.purpose = purpose;
    if (startDate !== undefined) data.startDate = new Date(startDate);
    if (endDate !== undefined) data.endDate = new Date(endDate);
    if (budget !== undefined) data.budget = Number(budget);
    if (projectId !== undefined) data.projectId = projectId ? Number(projectId) : null;

    const trip = await prisma.businessTrip.update({
      where: { id: Number(id) },
      data,
    });

    return NextResponse.json(trip);
  } catch (error) {
    console.error('PATCH /api/trips error:', error);
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

    await prisma.businessTrip.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/trips error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


