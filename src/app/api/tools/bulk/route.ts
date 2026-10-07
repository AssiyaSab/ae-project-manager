import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateAuth, validateWarehouse, createAuditLog } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await validateWarehouse(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { tools } = body;
    
    if (!tools || !Array.isArray(tools)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    const createdTools = await prisma.$transaction(
      tools.map((tool: any) => 
        prisma.tool.create({
          data: {
            name: tool.name,
            serialNumber: tool.serialNumber || null,
            category: tool.category || 'Общее',
            status: 'AVAILABLE'
          }
        })
      )
    );

    await createAuditLog(user?.id || null, 'IMPORT_TOOLS', `Массовый импорт инструментов (${createdTools.length} шт.) из Excel/CSV`);

    return NextResponse.json({ success: true, count: createdTools.length });
  } catch (error) {
    console.error('POST /api/tools/bulk error:', error);
    return NextResponse.json({ error: 'Failed to bulk import tools' }, { status: 500 });
  }
}
