// Utility functions for weekly report date handling

/**
 * Get the most recent Sunday (or today if today is Sunday)
 */
export function getMostRecentSunday(): Date {
  const today = new Date();
  const day = today.getDay(); // 0 = Sunday, 6 = Saturday
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - day);
  sunday.setHours(0, 0, 0, 0);
  return sunday;
}

/**
 * Get all Sundays in the past N weeks, including this week
 */
export function getPastSundays(weeksBack: number = 12): Date[] {
  const sundays: Date[] = [];
  const mostRecentSunday = getMostRecentSunday();
  
  for (let i = 0; i < weeksBack; i++) {
    const sunday = new Date(mostRecentSunday);
    sunday.setDate(mostRecentSunday.getDate() - (i * 7));
    sundays.push(sunday);
  }
  
  return sundays;
}

/**
 * Get all Sundays between two dates
 */
export function getSundaysBetween(startDate: Date, endDate: Date): Date[] {
  const sundays: Date[] = [];
  const current = new Date(startDate);
  
  // Move to the first Sunday on or after startDate
  const dayOfWeek = current.getDay();
  if (dayOfWeek !== 0) {
    current.setDate(current.getDate() + (7 - dayOfWeek));
  }
  current.setHours(0, 0, 0, 0);
  
  while (current <= endDate) {
    sundays.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }
  
  return sundays;
}

/**
 * Format a date as YYYY-MM-DD
 */
export function toIsoDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format a date as "Sep 8, 2026"
 */
export function toWeekLabel(date: Date): string {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

/**
 * Check if a date is a Sunday
 */
export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

/**
 * Get the Sunday for a given week (returns the Sunday on or before the date)
 */
export function getSundayOfWeek(date: Date): Date {
  const sunday = new Date(date);
  const day = date.getDay();
  sunday.setDate(date.getDate() - day);
  sunday.setHours(0, 0, 0, 0);
  return sunday;
}
