import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function validateAuth(request: Request) {
  const authPassword = request.headers.get('x-admin-password') || request.headers.get('x-auth-password');
  const expectedAdmin = process.env.ADMIN_PASSWORD || 'AE_ADMIN_2026';
  const expectedMember = process.env.MEMBER_PASSWORD || 'AE_EMPLOYEE_2026';
  return authPassword === expectedAdmin || authPassword === expectedMember;
}

function validateAdmin(request: Request) {
  const authPassword = request.headers.get('x-admin-password') || request.headers.get('x-auth-password');
  const expectedAdmin = process.env.ADMIN_PASSWORD || 'AE_ADMIN_2026';
  return authPassword === expectedAdmin;
}

export async function GET(request: Request) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  if (!validateAdmin(request)) {
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
