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
  const isAdmin = validateAdmin(request);

  try {
    const projects = await prisma.project.findMany({
      include: {
        manager: true,
        tasks: {
          include: {
            assignees: true,
            alerts: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!isAdmin) {
      const filteredProjects = projects.map(p => ({
        ...p,
        budget: null, // Скрываем бюджет от сотрудников
        tasks: p.tasks.map(t => ({
          ...t,
          cost: null // Скрываем стоимость задач от сотрудников
        }))
      }));
      return NextResponse.json(filteredProjects);
    }

    return NextResponse.json(projects);
  } catch (error) {
    console.error('GET /api/projects error:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!validateAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { name, description, status, budget, managerId } = body;
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const project = await prisma.project.create({
      data: {
        name,
        description,
        status: status || 'DESIGN',
        budget: budget ? parseFloat(budget) : null,
        managerId: managerId ? Number(managerId) : null,
      },
    });
    return NextResponse.json(project);
  } catch (error) {
    console.error('POST /api/projects error:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!validateAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { projectId, name, description, status, budget, managerId } = body;
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    const project = await prisma.project.update({
      where: { id: Number(projectId) },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(budget !== undefined && { budget: budget ? parseFloat(budget) : null }),
        ...(managerId !== undefined && { managerId: managerId ? Number(managerId) : null }),
      },
    });
    return NextResponse.json(project);
  } catch (error) {
    console.error('PATCH /api/projects error:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!validateAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    await prisma.project.delete({
      where: { id: Number(projectId) },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/projects error:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
