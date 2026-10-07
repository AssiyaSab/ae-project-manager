import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

import { validateAuth, validateAdmin, validateWarehouse, createAuditLog } from '@/lib/auth';

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
  const user = await validateWarehouse(request);
  if (!user) {
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

    await createAuditLog(user?.id || null, 'CREATE_TOOL', `Добавлен инструмент: ${tool.name}`); 
    return NextResponse.json(tool);
  } catch (error) {
    console.error('POST /api/tools error:', error);
    return NextResponse.json({ error: 'Failed to add tool' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await validateWarehouse(request);
  if (!user) {
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

export async function DELETE(request: Request) {
  const user = await validateWarehouse(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await prisma.tool.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/tools error:', error);
    return NextResponse.json({ error: 'Failed to delete tool' }, { status: 500 });
  }
}
