import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

import { validateAuth, validateAdmin } from '@/lib/auth';

export async function GET(request: Request) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
  }
  try {
    const alerts = await prisma.alert.findMany({
      include: {
        task: {
          include: {
            project: true,
            assignees: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(alerts);
  } catch (error) {
    console.error('GET /api/alerts error:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { alertId, status } = body;
    if (!alertId || !status) {
      return NextResponse.json({ error: 'alertId and status are required' }, { status: 400 });
    }

    const alert = await prisma.alert.update({
      where: { id: Number(alertId) },
      data: { status },
      include: {
        task: true,
      },
    });

    // If the alert is resolved, and the task status was BLOCKED, move the task back to IN_PROGRESS
    if (status === 'RESOLVED' && alert.task.status === 'BLOCKED') {
      await prisma.task.update({
        where: { id: alert.taskId },
        data: { status: 'IN_PROGRESS' },
      });
    }

    return NextResponse.json(alert);
  } catch (error) {
    console.error('PATCH /api/alerts error:', error);
    return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 });
  }
}
