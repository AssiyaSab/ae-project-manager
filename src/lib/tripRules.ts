export const DEFAULT_RATE_TIER_3MRP = 12975; // 3 МРП: Быкаев Канат, Быкаев Жанат, Канабеков Ерлик
export const DEFAULT_RATE_TIER_SENIOR = 10000; // 10 000 ₸: Ражапов Мырзабек, Ан Александр
export const DEFAULT_RATE_TIER_STANDARD = 8400; // 8 400 ₸: Остальные сотрудники

export interface TripRates {
  tier3MrpRate: number;
  tierSeniorRate: number;
  standardRate: number;
}

export const DEFAULT_TRIP_RATES: TripRates = {
  tier3MrpRate: DEFAULT_RATE_TIER_3MRP,
  tierSeniorRate: DEFAULT_RATE_TIER_SENIOR,
  standardRate: DEFAULT_RATE_TIER_STANDARD,
};

function normalizeName(name?: string | null): string {
  return (name || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getEmployeeDailyAllowanceRate(
  employeeName?: string | null,
  rates?: Partial<TripRates>
): number {
  const tier3MrpRate =
    Number(rates?.tier3MrpRate) > 0 ? Number(rates?.tier3MrpRate) : DEFAULT_RATE_TIER_3MRP;
  const tierSeniorRate =
    Number(rates?.tierSeniorRate) > 0 ? Number(rates?.tierSeniorRate) : DEFAULT_RATE_TIER_SENIOR;
  const standardRate =
    Number(rates?.standardRate) > 0 ? Number(rates?.standardRate) : DEFAULT_RATE_TIER_STANDARD;

  const n = normalizeName(employeeName);
  if (!n) return standardRate;

  // Группа 1: 3 МРП (12 975 ₸) — Быкаев Канат, Быкаев Жанат, Канабеков Ерлик
  const isBykaevKanat =
    n.includes('быкаев') && (n.includes('канат') || /\bк\.(\s*ж\.?)?/.test(n));
  const isBykaevZhanat =
    n.includes('быкаев') && (n.includes('жанат') || /\bж\./.test(n));
  const isKanabekovErlik =
    n.includes('канабеков') && (n.includes('ерлик') || /\bе\./.test(n));

  if (isBykaevKanat || isBykaevZhanat || isKanabekovErlik) {
    return tier3MrpRate;
  }

  // Группа 2: 10 000 ₸ — Ражапов Мырзабек, Ан Александр
  const isRazhapovMyrzabek =
    n.includes('ражапов') && (n.includes('мырзабек') || /\bм\./.test(n));
  const words = n.split(/[\s.,]+/).filter(Boolean);
  const hasSurnameAn = words.includes('ан');
  const isAnAlexander =
    hasSurnameAn && (n.includes('александр') || words.includes('а'));

  if (isRazhapovMyrzabek || isAnAlexander) {
    return tierSeniorRate;
  }

  // Группа 3: Остальные — 8 400 ₸
  return standardRate;
}

export function calculateTripDays(startDate: Date | string, endDate: Date | string): number {
  if (!startDate || !endDate) return 1;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diffTime = Math.abs(endDay.getTime() - startDay.getTime());
  return Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);
}

export function calculateTripBudget(params: {
  startDate: Date | string;
  endDate: Date | string;
  employeeName?: string | null;
  rates?: Partial<TripRates>;
  transportCost?: number | string;
  accommodationCost?: number | string;
}) {
  const daysCount = calculateTripDays(params.startDate, params.endDate);
  const dailyAllowanceRate = getEmployeeDailyAllowanceRate(params.employeeName, params.rates);
  const dailyAllowanceTotal = daysCount * dailyAllowanceRate;
  const transportCost = Math.max(0, Number(params.transportCost) || 0);
  const accommodationCost = Math.max(0, Number(params.accommodationCost) || 0);
  const totalBudget = dailyAllowanceTotal + transportCost + accommodationCost;

  return {
    tripType: 'KZ',
    daysCount,
    dailyAllowanceRate,
    dailyAllowanceTotal,
    transportCost,
    accommodationCost,
    totalBudget,
  };
}
