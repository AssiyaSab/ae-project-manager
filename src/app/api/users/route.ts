import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error('GET /api/users error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone, role, title } = body;
    if (!name || !role) {
      return NextResponse.json({ error: 'Name and role are required' }, { status: 400 });
    }
    const user = await prisma.user.create({
      data: {
        name,
        phone: phone || null,
        role,
        title: title || null,
      },
    });
    return NextResponse.json(user);
  } catch (error) {
    console.error('POST /api/users error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { userId, name, phone, role, title, isActive } = body;
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    const user = await prisma.user.update({
      where: { id: Number(userId) },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(role !== undefined && { role }),
        ...(title !== undefined && { title: title || null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });
    return NextResponse.json(user);
  } catch (error) {
    console.error('PATCH /api/users error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    const uId = Number(userId);
    // Disconnect user from any projects they manage to avoid FK errors
    await prisma.project.updateMany({
      where: { managerId: uId },
      data: { managerId: null }
    });
    await prisma.user.delete({
      where: { id: uId },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/users error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
