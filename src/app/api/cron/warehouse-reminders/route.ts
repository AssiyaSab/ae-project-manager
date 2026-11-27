import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendTelegramMessage } from '@/lib/telegram';
import { formatDate } from '@/lib/formatters';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const dueDeliveries = await prisma.purchaseRequest.findMany({
      where: {
        status: { in: ['IN_TRANSIT', 'PARTIALLY_DELIVERED'] },
        expectedDeliveryDate: { lte: endOfToday },
      },
      include: {
        project: { select: { id: true, name: true } },
        items: true,
      },
      orderBy: { expectedDeliveryDate: 'asc' },
    });

    if (dueDeliveries.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, message: 'No due deliveries today' });
    }

    const warehouseUsers = await prisma.user.findMany({
      where: { role: { in: ['WAREHOUSE', 'ADMIN'] }, telegramId: { not: null } },
    });

    const grouped = new Map<string, typeof dueDeliveries>();
    for (const p of dueDeliveries) {
      const key = p.project?.name || 'Без привязки к проекту / Складской запас';
      const arr = grouped.get(key) || [];
      arr.push(p);
      grouped.set(key, arr);
    }

    let msg = `📦 *Утреннее напоминание о поставках на склад (${formatDate(new Date())})*\n\n`;
    for (const [projName, list] of grouped.entries()) {
      msg += `📁 *${projName}*\n`;
      for (const p of list) {
        const dt = p.expectedDeliveryDate ? formatDate(p.expectedDeliveryDate) : 'Сегодня';
        msg += `  • Заявка #${p.id}: ${p.title} (ожидалась: ${dt})\n`;
      }
      msg += '\n';
    }
    msg += `👉 Откройте «Закупки ТМЦ» → «🚚 Ожидаются к приемке» и оформите приемку накладной.`;

    let sentCount = 0;
    for (const u of warehouseUsers) {
      if (u.telegramId) {
        await sendTelegramMessage(u.telegramId, msg, { parse_mode: 'Markdown' }).catch(() => {});
        sentCount++;
      }
    }

    return NextResponse.json({ ok: true, dueCount: dueDeliveries.length, sent: sentCount });
  } catch (error) {
    console.error('GET /api/cron/warehouse-reminders error:', error);
    return NextResponse.json({ error: 'Failed to send warehouse reminders' }, { status: 500 });
  }
}
