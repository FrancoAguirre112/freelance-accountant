// Pure helpers for the lifecycle of a recurring service.
//
// A service has a `startDate` (when the recurrence begins) and an optional
// `endDate` (when it ends — null = ongoing). A service is *active in a date
// range* if its lifecycle intersects [from, to]. A service is *active in a
// month* (YYYY-MM) if any day of that month falls inside the lifecycle.

export interface LifecycleService {
  startDate: Date;
  endDate?: Date | null;
}

/**
 * True iff the service is active for at least one day in [from, to].
 */
export function isServiceActiveInRange(
  service: LifecycleService,
  from: Date,
  to: Date,
): boolean {
  const startsBeforeRangeEnds = service.startDate.getTime() <= to.getTime();
  const endsAfterRangeStarts =
    service.endDate == null || service.endDate.getTime() >= from.getTime();
  return startsBeforeRangeEnds && endsAfterRangeStarts;
}

/**
 * True iff the service is active for at least one day in the given month
 * (YYYY-MM, UTC).
 */
export function isServiceActiveInMonth(
  service: LifecycleService,
  monthKey: string,
): boolean {
  const [y, m] = monthKey.split("-").map(Number);
  const monthStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return isServiceActiveInRange(service, monthStart, monthEnd);
}
