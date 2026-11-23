import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { formatDate } from '@/lib/formatters';

export const dynamic = 'force-dynamic';

import { validateAuth, validateApprover, createAuditLog, isChiefAccountantUser } from '@/lib/auth';
import { calculateTripBudget } from '@/lib/tripRules';
import { getTripRatesFromDb } from '@/lib/tripRulesServer';

export async function GET(request: Request) {
  const user = await validateAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const isManagement = ['ADMIN', 'MANAGER', 'CHIEF_ACCOUNTANT', 'ACCOUNTANT'].includes(user.role);

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
    const {
      destination,
      purpose,
      startDate,
      endDate,
      transportCost,
      accommodationCost,
      projectId,
    } = body;
    let { employeeId } = body;
    
    const isManagement = ['ADMIN', 'MANAGER', 'CHIEF_ACCOUNTANT', 'ACCOUNTANT'].includes(user.role);
    if (!isManagement) {
      employeeId = user.id;
    } else if (!employeeId && user.id && user.id > 0 && user.id !== 999) {
      employeeId = user.id;
    }

    if (!employeeId || !destination || !purpose || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const targetEmployee = await prisma.user.findUnique({
      where: { id: Number(employeeId) },
      select: { id: true, name: true },
    });

    const rates = await getTripRatesFromDb();
    const calc = calculateTripBudget({
      startDate,
      endDate,
      employeeName: targetEmployee?.name,
      rates,
      transportCost,
      accommodationCost,
    });

    const trip = await prisma.businessTrip.create({
      data: {
        employeeId: Number(employeeId),
        destination,
        purpose,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        tripType: calc.tripType,
        daysCount: calc.daysCount,
        dailyAllowanceRate: calc.dailyAllowanceRate,
        dailyAllowanceTotal: calc.dailyAllowanceTotal,
        transportCost: calc.transportCost,
        accommodationCost: calc.accommodationCost,
        totalBudget: calc.totalBudget,
        budget: calc.totalBudget,
        projectId: projectId ? Number(projectId) : null,
      },
      include: { employee: true, project: true }
    });

    try {
      const approvers = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'MANAGER'] }, telegramId: { not: null } }
      });
      const { sendTelegramMessage } = await import('@/lib/telegram');
      
      const message = `✈️ *Оформлена новая командировка*\n\n` +
        `*Сотрудник:* ${trip.employee?.name || 'Система'}\n` +
        `*Пункт назначения:* ${trip.destination}\n` +
        `*Цель:* ${trip.purpose}\n` +
        `*Даты:* с ${formatDate(trip.startDate)} по ${formatDate(trip.endDate)} (${calc.daysCount} дн.)\n` +
        `*Суточные:* ${calc.dailyAllowanceTotal.toLocaleString('ru-RU')} ₸ (${calc.daysCount} дн. × ${calc.dailyAllowanceRate.toLocaleString('ru-RU')} ₸)\n` +
        (calc.transportCost > 0 ? `*Проезд / билеты:* ${calc.transportCost.toLocaleString('ru-RU')} ₸\n` : '') +
        (calc.accommodationCost > 0 ? `*Проживание:* ${calc.accommodationCost.toLocaleString('ru-RU')} ₸\n` : '') +
        `*Итого к выдаче:* *${calc.totalBudget.toLocaleString('ru-RU')} ₸*\n\n` +
        `👉 Согласовать командировку?`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: 'Одобрить ✅', callback_data: `trip_approve_${trip.id}` },
            { text: 'Отклонить ❌', callback_data: `trip_reject_${trip.id}` }
          ]
        ]
      };

      for (const approver of approvers) {
        if (approver.telegramId) {
          await sendTelegramMessage(approver.telegramId, message, { parse_mode: 'Markdown', reply_markup: keyboard });
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
  const user = await validateAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const {
      id,
      status,
      employeeId,
      destination,
      purpose,
      startDate,
      endDate,
      transportCost,
      accommodationCost,
      totalBudget,
      budget,
      projectId,
    } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const existing = await prisma.businessTrip.findUnique({ where: { id: Number(id) } });
    if (!existing) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const data: any = {};
    if (status !== undefined) data.status = status;
    if (employeeId !== undefined) data.employeeId = Number(employeeId);
    if (destination !== undefined) data.destination = destination;
    if (purpose !== undefined) data.purpose = purpose;
    if (startDate !== undefined) data.startDate = new Date(startDate);
    if (endDate !== undefined) data.endDate = new Date(endDate);
    if (projectId !== undefined) data.projectId = projectId ? Number(projectId) : null;

    if (
      employeeId !== undefined ||
      startDate !== undefined ||
      endDate !== undefined ||
      transportCost !== undefined ||
      accommodationCost !== undefined
    ) {
      const targetEmployeeId = employeeId !== undefined ? Number(employeeId) : existing.employeeId;
      const targetEmployee = await prisma.user.findUnique({
        where: { id: targetEmployeeId },
        select: { name: true },
      });
      const rates = await getTripRatesFromDb();
      const calc = calculateTripBudget({
        startDate: startDate ?? existing.startDate,
        endDate: endDate ?? existing.endDate,
        employeeName: targetEmployee?.name,
        rates,
        transportCost: transportCost !== undefined ? transportCost : existing.transportCost,
        accommodationCost: accommodationCost !== undefined ? accommodationCost : existing.accommodationCost,
      });
      data.tripType = calc.tripType;
      data.daysCount = calc.daysCount;
      data.dailyAllowanceRate = calc.dailyAllowanceRate;
      data.dailyAllowanceTotal = calc.dailyAllowanceTotal;
      data.transportCost = calc.transportCost;
      data.accommodationCost = calc.accommodationCost;
      data.totalBudget = calc.totalBudget;
      data.budget = calc.totalBudget;
    }

    // ADMIN и Главный бухгалтер могут скорректировать итоговую сумму при нестандартных условиях
    const explicitBudget = totalBudget !== undefined ? Number(totalBudget) : (budget !== undefined ? Number(budget) : undefined);
    if (explicitBudget !== undefined && !isNaN(explicitBudget) && isChiefAccountantUser(user)) {
      data.totalBudget = explicitBudget;
      data.budget = explicitBudget;
    }

    const trip = await prisma.businessTrip.update({
      where: { id: Number(id) },
      data,
      include: { employee: true, project: true },
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


