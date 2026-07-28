import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
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
    });
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
    });
    return NextResponse.json(task);
  } catch (error) {
    console.error('PATCH /api/tasks error:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
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
