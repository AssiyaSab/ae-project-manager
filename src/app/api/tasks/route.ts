import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateAuth, validateManager, createAuditLog } from '@/lib/auth';
import { sendTelegramMessage } from '@/lib/telegram';

export async function GET(request: Request) {
  const authUser = await validateAuth(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');
    const projectId = searchParams.get('projectId');
    const assigneeId = searchParams.get('assigneeId');

    const where: any = {};
    if (projectId) where.projectId = Number(projectId);
    if (assigneeId) where.assignees = { some: { id: Number(assigneeId) } };

    if (department === 'accounting') {
      where.OR = [
        { assignees: { some: { role: { in: ['ACCOUNTANT', 'CHIEF_ACCOUNTANT'] } } } },
        { name: { contains: 'Бухгалтер', mode: 'insensitive' } },
        { name: { contains: 'Оплата', mode: 'insensitive' } },
        { name: { contains: 'Доверенност', mode: 'insensitive' } },
        { description: { contains: 'Бухгалтер', mode: 'insensitive' } },
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignees: true,
        project: {
          select: { id: true, name: true, status: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error('GET /api/tasks error:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authUser = await validateManager(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { projectId, name, description, status, assigneeIds, cost } = body;
    if (!projectId || !name) {
      return NextResponse.json({ error: 'projectId and name are required' }, { status: 400 });
    }
    const task = await prisma.task.create({
      data: {
        projectId: Number(projectId),
        name,
        description,
        status: status || 'PENDING',
        cost: cost ? parseFloat(cost) : null,
        ...(assigneeIds && { assignees: { connect: assigneeIds.map((id: number) => ({ id: Number(id) })) } }),
      },
      include: {
        assignees: true,
        project: true,
      },
    });

    // Notify assignees in Telegram if they have telegramId
    if (task.assignees && task.assignees.length > 0) {
      const creatorName = (authUser as any).name || (authUser.role === 'CHIEF_ACCOUNTANT' ? 'Главный бухгалтер' : 'Руководитель');
      const creatorRole = authUser.role === 'CHIEF_ACCOUNTANT' ? 'Главный бухгалтер' : authUser.role;

      for (const assignee of task.assignees) {
        if (assignee.telegramId && assignee.id !== authUser.id) {
          const msg =
            `📋 *Вам назначена новая задача!*\n\n` +
            `• *Задача:* ${task.name}\n` +
            `• *Проект:* ${task.project.name}\n` +
            (task.description ? `• *Детали:* _${task.description}_\n` : '') +
            `• *Назначил:* ${creatorName} (${creatorRole})\n\n` +
            `👉 Используйте кнопку меню «📋 Мои задачи» для работы.`;
          await sendTelegramMessage(assignee.telegramId, msg);
        }
      }
    }

    await createAuditLog(
      authUser.id,
      'CREATE_TASK',
      `Создана задача "${name}" для проекта #${projectId} (Исполнители: ${task.assignees.map((a) => a.name).join(', ') || 'не назначены'})`
    );

    return NextResponse.json(task);
  } catch (error) {
    console.error('POST /api/tasks error:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { taskId, name, description, status, assigneeIds, cost } = body;
    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    const isOnlyStatusUpdate = status !== undefined && name === undefined && description === undefined && assigneeIds === undefined && cost === undefined;
    if (!isOnlyStatusUpdate && !(await validateManager(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // If status is updated to DONE or IN_PROGRESS, also resolve any active alerts associated with this task
    if (status === 'DONE' || status === 'IN_PROGRESS') {
      await prisma.alert.updateMany({
        where: { taskId: Number(taskId), status: 'ACTIVE' },
        data: { status: 'RESOLVED' },
      });
    }

    const task = await prisma.task.update({
      where: { id: Number(taskId) },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(cost !== undefined && { cost: cost ? parseFloat(cost) : null }),
        ...(assigneeIds !== undefined && { assignees: { set: assigneeIds.map((id: number) => ({ id: Number(id) })) } }),
      },
      include: {
        assignees: true,
        project: true,
      },
    });
    return NextResponse.json(task);
  } catch (error) {
    console.error('PATCH /api/tasks error:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await validateManager(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }
    await prisma.task.delete({
      where: { id: Number(taskId) },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/tasks error:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
