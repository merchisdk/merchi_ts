import * as moment from 'moment-timezone';

export const DEFAULT_TURNAROUND_TIMEZONE = 'Australia/Melbourne';

export function calculateDeadline(
  deliveryDays: number,
  considerBusinessHours = true,
  now: Date = new Date(),
  timezone = DEFAULT_TURNAROUND_TIMEZONE,
): Date | null {
  if (!Number.isFinite(deliveryDays) || deliveryDays < 0) return null;

  const start = moment.tz(now, timezone);

  if (!considerBusinessHours) {
    return start.add(deliveryDays, 'days').endOf('day').toDate();
  }

  const isWeekend = start.day() === 0 || start.day() === 6;
  const isAfterHours = start.hour() >= 17;
  let days = isWeekend || isAfterHours ? deliveryDays + 1 : deliveryDays;

  const current = start;
  while (days > 0) {
    current.add(1, 'day');
    if (current.day() !== 0 && current.day() !== 6) days -= 1;
  }
  return current.endOf('day').toDate();
}
