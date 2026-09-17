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
  if (!validateAdmin(request)) {
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

    return NextResponse.json(tool);
  } catch (error) {
    console.error('POST /api/tools error:', error);
    return NextResponse.json({ error: 'Failed to add tool' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!validateAdmin(request)) {
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
