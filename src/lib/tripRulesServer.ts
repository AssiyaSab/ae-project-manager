import { prisma } from './db';
import {
  DEFAULT_RATE_TIER_3MRP,
  DEFAULT_RATE_TIER_SENIOR,
  DEFAULT_RATE_TIER_STANDARD,
  TripRates,
} from './tripRules';

export async function getTripRatesFromDb(): Promise<TripRates> {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: ['TRIP_RATE_TIER_3MRP', 'TRIP_RATE_TIER_SENIOR', 'TRIP_RATE_STANDARD'],
        },
      },
    });
    const map = new Map(settings.map((s) => [s.key, Number(s.value)]));
    const tier3MrpRate = map.get('TRIP_RATE_TIER_3MRP');
    const tierSeniorRate = map.get('TRIP_RATE_TIER_SENIOR');
    const standardRate = map.get('TRIP_RATE_STANDARD');

    return {
      tier3MrpRate: tier3MrpRate && tier3MrpRate > 0 ? tier3MrpRate : DEFAULT_RATE_TIER_3MRP,
      tierSeniorRate: tierSeniorRate && tierSeniorRate > 0 ? tierSeniorRate : DEFAULT_RATE_TIER_SENIOR,
      standardRate: standardRate && standardRate > 0 ? standardRate : DEFAULT_RATE_TIER_STANDARD,
    };
  } catch (err) {
    console.warn('getTripRatesFromDb fallback to defaults:', err);
    return {
      tier3MrpRate: DEFAULT_RATE_TIER_3MRP,
      tierSeniorRate: DEFAULT_RATE_TIER_SENIOR,
      standardRate: DEFAULT_RATE_TIER_STANDARD,
    };
  }
}
