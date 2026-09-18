import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

import { validateAuth, validateAdmin, createAuditLog } from '@/lib/auth';

export async function GET(request: Request) {
  if (!(await validateAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const tools = await prisma.tool.findMany({
      include: {
        holder: true,
        logs: {
          orderBy: { issueDate: 'desc' },
          take: 5,
          include: { employee: true, project: true }
        }
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(tools);
  } catch (error) {
    console.error('GET /api/tools error:', error);
    return NextResponse.json({ error: 'Failed to fetch tools' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { name, serialNumber, category } = body;
    
    if (!name || !category) {
      return NextResponse.json({ error: 'Name and category are required' }, { status: 400 });
    }

    const tool = await prisma.tool.create({
      data: {
        name,
        serialNumber,
        category,
        status: 'AVAILABLE'
      },
    });

    const user = await validateAuth(request); 
    await createAuditLog(user?.id || null, 'CREATE_TOOL', `Добавлен инструмент: ${tool.name}`); 
    return NextResponse.json(tool);
  } catch (error) {
    console.error('POST /api/tools error:', error);
    return NextResponse.json({ error: 'Failed to add tool' }, { status: 500 });
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

    const tool = await prisma.tool.update({
      where: { id: Number(id) },
      data: { status },
    });

    return NextResponse.json(tool);
  } catch (error) {
    console.error('PATCH /api/tools error:', error);
    return NextResponse.json({ error: 'Failed to update tool' }, { status: 500 });
  }
}
