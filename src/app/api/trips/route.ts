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
        status: 'PENDING_BUDGET',
      },
      include: { employee: true, project: true }
    });

    try {
      const recipients = await prisma.user.findMany({
        where: { role: { in: ['CHIEF_ACCOUNTANT', 'ACCOUNTANT', 'ADMIN'] }, telegramId: { not: null } }
      });
      const { sendTelegramMessage } = await import('@/lib/telegram');
      
      const message = `✈️ *Новая заявка на командировку #${trip.id} (Проверка бюджета)*\n\n` +
        `*Сотрудник:* ${trip.employee?.name || 'Система'}\n` +
        `*Пункт назначения:* ${trip.destination}\n` +
        `*Цель:* ${trip.purpose}\n` +
        `*Даты:* с ${formatDate(trip.startDate)} по ${formatDate(trip.endDate)} (${calc.daysCount} дн.)\n` +
        `*Суточные:* ${calc.dailyAllowanceTotal.toLocaleString('ru-RU')} ₸ (${calc.daysCount} дн. × ${calc.dailyAllowanceRate.toLocaleString('ru-RU')} ₸)\n` +
        (calc.transportCost > 0 ? `*Проезд / билеты:* ${calc.transportCost.toLocaleString('ru-RU')} ₸\n` : '') +
        (calc.accommodationCost > 0 ? `*Проживание:* ${calc.accommodationCost.toLocaleString('ru-RU')} ₸\n` : '') +
        `*Итого к выдаче:* *${calc.totalBudget.toLocaleString('ru-RU')} ₸*\n\n` +
        `⏳ Ожидает проверки бюджета бухгалтерией перед передачей на подпись Директору.`;

      for (const r of recipients) {
        if (r.telegramId) {
          await sendTelegramMessage(r.telegramId, message, { parse_mode: 'Markdown' });
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

    // Бухгалтерия (ACCOUNTANT / CHIEF_ACCOUNTANT) и ADMIN могут скорректировать итоговую сумму
    const isAccountingOrAdmin = ['ADMIN', 'CHIEF_ACCOUNTANT', 'ACCOUNTANT'].includes(user.role);
    const explicitBudget = totalBudget !== undefined ? Number(totalBudget) : (budget !== undefined ? Number(budget) : undefined);
    if (explicitBudget !== undefined && !isNaN(explicitBudget) && isAccountingOrAdmin) {
      data.totalBudget = explicitBudget;
      data.budget = explicitBudget;
    }

    if (status === 'PAID' && !isAccountingOrAdmin) {
      return NextResponse.json({ error: 'Только бухгалтерия может подтверждать оплату командировочных' }, { status: 403 });
    }
    if (status === 'DOCS_SUBMITTED' && !isAccountingOrAdmin) {
      return NextResponse.json({ error: 'Только бухгалтерия может закрывать авансовый отчет' }, { status: 403 });
    }

    const trip = await prisma.businessTrip.update({
      where: { id: Number(id) },
      data,
      include: { employee: true, project: true },
    });

    // Обработка переходов статусов командировки: задачи и Telegram-уведомления
    try {
      const { sendTelegramMessage } = await import('@/lib/telegram');

      if (status && status !== existing.status) {
        if (status === 'PENDING_APPROVAL') {
          const directors = await prisma.user.findMany({
            where: { role: { in: ['ADMIN', 'MANAGER'] }, telegramId: { not: null } }
          });
          const msg = `✈️ *Командировка #${trip.id} передана на согласование*\n\n` +
            `*Сотрудник:* ${trip.employee?.name}\n` +
            `*Маршрут:* ${trip.destination}\n` +
            `*Даты:* с ${formatDate(trip.startDate)} по ${formatDate(trip.endDate)}\n` +
            `*Итого к выдаче:* *${(trip.totalBudget || trip.budget).toLocaleString('ru-RU')} ₸*`;
          const keyboard = {
            inline_keyboard: [[
              { text: 'Одобрить ✅', callback_data: `trip_approve_${trip.id}` },
              { text: 'Отклонить ❌', callback_data: `trip_reject_${trip.id}` }
            ]]
          };
          for (const d of directors) {
            if (d.telegramId) await sendTelegramMessage(d.telegramId, msg, { parse_mode: 'Markdown', reply_markup: keyboard });
          }
        }

        if (status === 'APPROVED_FOR_PAYMENT' || status === 'APPROVED') {
          // Создаем задачу Главному бухгалтеру «Оплатить командировочные»
          const chiefAccs = await prisma.user.findMany({
            where: {
              OR: [
                { role: 'CHIEF_ACCOUNTANT' },
                { role: 'ACCOUNTANT', title: { contains: 'главн', mode: 'insensitive' } }
              ]
            }
          });
          let targetProjectId = trip.projectId;
          if (!targetProjectId) {
            const firstProj = await prisma.project.findFirst({ select: { id: true } });
            targetProjectId = firstProj?.id || null;
          }
          if (targetProjectId && chiefAccs.length > 0 && !existing.paymentTaskId) {
            const createdTask = await prisma.task.create({
              data: {
                projectId: targetProjectId,
                name: `💳 Оплатить командировочные: ${trip.employee?.name || ''} (${trip.destination})`,
                description: `Командировка #${trip.id}: с ${formatDate(trip.startDate)} по ${formatDate(trip.endDate)}. Сумма к выплате: ${(trip.totalBudget || trip.budget).toLocaleString('ru-RU')} ₸.`,
                status: 'IN_PROGRESS',
                assignees: { connect: chiefAccs.map((c) => ({ id: c.id })) }
              }
            });
            await prisma.businessTrip.update({
              where: { id: trip.id },
              data: { paymentTaskId: createdTask.id }
            });
          }
          for (const ca of chiefAccs) {
            if (ca.telegramId) {
              await sendTelegramMessage(
                ca.telegramId,
                `💳 *Оплатить командировочные (#${trip.id})*\n\n` +
                `*Сотрудник:* ${trip.employee?.name}\n` +
                `*Маршрут:* ${trip.destination}\n` +
                `*Сумма к выплате:* *${(trip.totalBudget || trip.budget).toLocaleString('ru-RU')} ₸*`,
                { parse_mode: 'Markdown' }
              );
            }
          }
        }

        if (status === 'PAID') {
          if (existing.paymentTaskId) {
            await prisma.task.update({
              where: { id: existing.paymentTaskId },
              data: { status: 'DONE' }
            }).catch(() => {});
          }
          if (trip.employee?.telegramId) {
            await sendTelegramMessage(
              trip.employee.telegramId,
              `✅ *Командировочные по заявке #${trip.id} оплачены!*\n\n` +
              `*Маршрут:* ${trip.destination}\n` +
              `*Сумма:* *${(trip.totalBudget || trip.budget).toLocaleString('ru-RU')} ₸*\n\n` +
              `После возвращения не забудьте сдать отчётные документы в бухгалтерию.`,
              { parse_mode: 'Markdown' }
            );
          }
        }
      }
    } catch (tgErr) {
      console.error('Trip PATCH notification error:', tgErr);
    }

    await createAuditLog(user.id || null, 'UPDATE_TRIP', `Обновлена командировка #${id} (Статус: ${status || existing.status})`);
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


