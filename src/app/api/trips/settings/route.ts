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
    const kzRate = Number(body.kzRate);
    const abroadRate = Number(body.abroadRate);

    if (!kzRate || kzRate <= 0 || !abroadRate || abroadRate <= 0) {
      return NextResponse.json({ error: 'Ставки суточных должны быть положительными числами' }, { status: 400 });
    }

    await prisma.systemSetting.upsert({
      where: { key: 'TRIP_RATE_KZ' },
      update: { value: String(kzRate) },
      create: { key: 'TRIP_RATE_KZ', value: String(kzRate) },
    });

    await prisma.systemSetting.upsert({
      where: { key: 'TRIP_RATE_ABROAD' },
      update: { value: String(abroadRate) },
      create: { key: 'TRIP_RATE_ABROAD', value: String(abroadRate) },
    });

    await createAuditLog(
      user.id,
      'UPDATE_TRIP_RATES',
      `Обновлены нормы суточных: по РК = ${kzRate} ₸/сут, за рубеж = ${abroadRate} ₸/сут`
    );

    return NextResponse.json({ kzRate, abroadRate });
  } catch (error) {
    console.error('PATCH /api/trips/settings error:', error);
    return NextResponse.json({ error: 'Failed to update trip rates' }, { status: 500 });
  }
}
