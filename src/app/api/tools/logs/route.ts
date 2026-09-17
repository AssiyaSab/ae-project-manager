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

// Issue a tool
export async function POST(request: Request) {
  if (!validateAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { toolId, employeeId, projectId, plannedReturnDate } = body;
    
    if (!toolId || !employeeId) {
      return NextResponse.json({ error: 'Tool and Employee are required' }, { status: 400 });
    }

    // 1. Create Log
    const log = await prisma.toolLog.create({
      data: {
        toolId: Number(toolId),
        employeeId: Number(employeeId),
        projectId: projectId ? Number(projectId) : null,
        plannedReturnDate: plannedReturnDate ? new Date(plannedReturnDate) : null,
      },
    });

    // 2. Update Tool status
    await prisma.tool.update({
      where: { id: Number(toolId) },
      data: {
        status: 'IN_USE',
        holderId: Number(employeeId)
      }
    });

    return NextResponse.json(log);
  } catch (error) {
    console.error('POST /api/tools/logs error:', error);
    return NextResponse.json({ error: 'Failed to issue tool' }, { status: 500 });
  }
}

// Return a tool
export async function PATCH(request: Request) {
  if (!validateAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { logId, toolId, condition, newStatus } = body; // newStatus can be 'AVAILABLE' or 'REPAIR' or 'WRITTEN_OFF'
    
    if (!logId || !toolId) {
      return NextResponse.json({ error: 'logId and toolId are required' }, { status: 400 });
    }

    // 1. Close Log
    const log = await prisma.toolLog.update({
      where: { id: Number(logId) },
      data: {
        actualReturnDate: new Date(),
        condition
      },
    });

    // 2. Update Tool status and clear holder
    await prisma.tool.update({
      where: { id: Number(toolId) },
      data: {
        status: newStatus || 'AVAILABLE',
        holderId: null
      }
    });

    return NextResponse.json(log);
  } catch (error) {
    console.error('PATCH /api/tools/logs error:', error);
    return NextResponse.json({ error: 'Failed to return tool' }, { status: 500 });
  }
}
