export const DEFAULT_DAILY_ALLOWANCE_KZ = 10000; // 10 000 ₸ / сутки (по РК)
export const DEFAULT_DAILY_ALLOWANCE_ABROAD = 35000; // 35 000 ₸ / сутки (за рубеж)

export type TripType = 'KZ' | 'ABROAD';

export interface TripRates {
  kzRate: number;
  abroadRate: number;
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
  tripType?: string;
  kzRate?: number;
  abroadRate?: number;
  transportCost?: number | string;
  accommodationCost?: number | string;
}) {
  const daysCount = calculateTripDays(params.startDate, params.endDate);
  const type: TripType = params.tripType === 'ABROAD' ? 'ABROAD' : 'KZ';
  const kzRate = Number(params.kzRate) > 0 ? Number(params.kzRate) : DEFAULT_DAILY_ALLOWANCE_KZ;
  const abroadRate = Number(params.abroadRate) > 0 ? Number(params.abroadRate) : DEFAULT_DAILY_ALLOWANCE_ABROAD;

  const dailyAllowanceRate = type === 'ABROAD' ? abroadRate : kzRate;
  const dailyAllowanceTotal = daysCount * dailyAllowanceRate;
  const transportCost = Math.max(0, Number(params.transportCost) || 0);
  const accommodationCost = Math.max(0, Number(params.accommodationCost) || 0);
  const totalBudget = dailyAllowanceTotal + transportCost + accommodationCost;

  return {
    tripType: type,
    daysCount,
    dailyAllowanceRate,
    dailyAllowanceTotal,
    transportCost,
    accommodationCost,
    totalBudget,
  };
}
