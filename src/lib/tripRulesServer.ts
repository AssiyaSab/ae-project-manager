import { prisma } from './db';
import {
  DEFAULT_DAILY_ALLOWANCE_KZ,
  DEFAULT_DAILY_ALLOWANCE_ABROAD,
  TripRates,
} from './tripRules';

export async function getTripRatesFromDb(): Promise<TripRates> {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: ['TRIP_RATE_KZ', 'TRIP_RATE_ABROAD'] } },
    });
    const map = new Map(settings.map((s) => [s.key, Number(s.value)]));
    const kzRate = map.get('TRIP_RATE_KZ');
    const abroadRate = map.get('TRIP_RATE_ABROAD');

    return {
      kzRate: kzRate && kzRate > 0 ? kzRate : DEFAULT_DAILY_ALLOWANCE_KZ,
      abroadRate: abroadRate && abroadRate > 0 ? abroadRate : DEFAULT_DAILY_ALLOWANCE_ABROAD,
    };
  } catch (err) {
    console.warn('getTripRatesFromDb fallback to defaults:', err);
    return {
      kzRate: DEFAULT_DAILY_ALLOWANCE_KZ,
      abroadRate: DEFAULT_DAILY_ALLOWANCE_ABROAD,
    };
  }
}
