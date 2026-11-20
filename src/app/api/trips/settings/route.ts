import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateAuth, isChiefAccountantUser, createAuditLog } from '@/lib/auth';
import { getTripRatesFromDb } from '@/lib/tripRulesServer';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await validateAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const rates = await getTripRatesFromDb();
  return NextResponse.json(rates);
}

export async function PATCH(request: Request) {
  const user = await validateAuth(request);
  if (!user || !isChiefAccountantUser(user)) {
    return NextResponse.json(
      { error: 'Только Директор или Главный бухгалтер могут изменять нормы суточных' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const tier3MrpRate = Number(body.tier3MrpRate);
    const tierSeniorRate = Number(body.tierSeniorRate);
    const standardRate = Number(body.standardRate);

    if (
      !tier3MrpRate ||
      tier3MrpRate <= 0 ||
      !tierSeniorRate ||
      tierSeniorRate <= 0 ||
      !standardRate ||
      standardRate <= 0
    ) {
      return NextResponse.json(
        { error: 'Все ставки суточных должны быть положительными числами' },
        { status: 400 }
      );
    }

    await Promise.all([
      prisma.systemSetting.upsert({
        where: { key: 'TRIP_RATE_TIER_3MRP' },
        update: { value: String(tier3MrpRate) },
        create: { key: 'TRIP_RATE_TIER_3MRP', value: String(tier3MrpRate) },
      }),
      prisma.systemSetting.upsert({
        where: { key: 'TRIP_RATE_TIER_SENIOR' },
        update: { value: String(tierSeniorRate) },
        create: { key: 'TRIP_RATE_TIER_SENIOR', value: String(tierSeniorRate) },
      }),
      prisma.systemSetting.upsert({
        where: { key: 'TRIP_RATE_STANDARD' },
        update: { value: String(standardRate) },
        create: { key: 'TRIP_RATE_STANDARD', value: String(standardRate) },
      }),
    ]);

    await createAuditLog(
      user.id,
      'UPDATE_TRIP_RATES',
      `Обновлены нормы суточных: 3 МРП = ${tier3MrpRate} ₸, спец. ставка = ${tierSeniorRate} ₸, остальные = ${standardRate} ₸`
    );

    return NextResponse.json({ tier3MrpRate, tierSeniorRate, standardRate });
  } catch (error) {
    console.error('PATCH /api/trips/settings error:', error);
    return NextResponse.json({ error: 'Failed to update trip rates' }, { status: 500 });
  }
}
