import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const isAll = searchParams.get('all') === 'true';
    const limitParam = searchParams.get('limit');
    const take = isAll ? undefined : (limitParam ? parseInt(limitParam, 10) : 100);

    const logs = await prisma.auditLog.findMany({
      include: {
        user: true
      },
      orderBy: { createdAt: 'desc' },
      take: take
    });
    return NextResponse.json(logs);
  } catch (error) {
    console.error('GET /api/audit error:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
