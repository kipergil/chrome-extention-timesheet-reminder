/**
 * Timezone utilities
 */

/**
 * Get user's current timezone using Intl API
 * @returns {string} Timezone identifier (e.g., 'America/New_York')
 */
export function getSystemTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Get current time in specified timezone
 * @param {string} timezone - Timezone identifier
 * @returns {Date} Current date in specified timezone (as local-equivalent Date object)
 */
export function getNowInTimezone(timezone) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const dateObj = {};
  
  parts.forEach(part => {
    dateObj[part.type] = part.value;
  });
  
  return new Date(
    dateObj.year,
    parseInt(dateObj.month) - 1,
    dateObj.day,
    dateObj.hour,
    dateObj.minute,
    dateObj.second
  );
}

/**
 * Get current hour and minute in specified timezone
 * @param {string} timezone - Timezone identifier
 * @returns {{hour: number, minute: number, dayOfWeek: number, dayOfMonth: number}} Current time in timezone
 */
export function getTimeInTimezone(timezone) {
  const date = getNowInTimezone(timezone);
  return {
    hour: date.getHours(),
    minute: date.getMinutes(),
    dayOfWeek: date.getDay(), // 0 = Sunday, 6 = Saturday
    dayOfMonth: date.getDate()
  };
}
