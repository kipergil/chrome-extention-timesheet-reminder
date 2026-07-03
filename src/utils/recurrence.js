/**
 * Recurrence utilities - calculate next reminder trigger time
 */

import { getNowInTimezone } from './timezone.js';

/**
 * Calculate next trigger time for a reminder based on recurrence pattern
 * @param {Object} recurrence - Recurrence object {type: 'daily'|'weekly'|'monthly', dayOfWeek?: number, dayOfMonth?: number, hour: number, minute: number}
 * @param {string} timezone - Timezone identifier
 * @returns {Date} Next trigger time in user's local time
 */
export function getNextTriggerTime(recurrence, timezone) {
  const now = getNowInTimezone(timezone);
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentDayOfWeek = now.getDay();
  const currentDayOfMonth = now.getDate();

  if (recurrence.type === 'minutely') {
    const intervalMinutes = Math.max(1, recurrence.intervalMinutes || 1);
    const minutesSinceMidnight = (currentHour * 60) + currentMinute;
    const nextBucket = Math.ceil((minutesSinceMidnight + 1) / intervalMinutes) * intervalMinutes;
    const nextTrigger = new Date(now);
    nextTrigger.setHours(0, 0, 0, 0);
    nextTrigger.setMinutes(nextBucket);
    return nextTrigger;
  }
  
  const reminderHour = recurrence.hour;
  const reminderMinute = recurrence.minute;
  
  // Create a date for today at reminder time
  let nextTrigger = new Date(now);
  nextTrigger.setHours(reminderHour, reminderMinute, 0, 0);
  
  if (recurrence.type === 'daily') {
    // If reminder time has passed today, schedule for tomorrow
    if (nextTrigger <= now) {
      nextTrigger.setDate(nextTrigger.getDate() + 1);
    }
  } else if (recurrence.type === 'weekly') {
    const targetDays = getWeeklyTargetDays(recurrence);
    let bestDaysUntilTarget = 7;

    targetDays.forEach((targetDayOfWeek) => {
      let daysUntilTarget = (targetDayOfWeek - currentDayOfWeek + 7) % 7;
      if (daysUntilTarget === 0 && nextTrigger <= now) {
        daysUntilTarget = 7;
      }
      if (daysUntilTarget < bestDaysUntilTarget) {
        bestDaysUntilTarget = daysUntilTarget;
      }
    });

    nextTrigger.setDate(nextTrigger.getDate() + bestDaysUntilTarget);
  } else if (recurrence.type === 'monthly') {
    const targetDayOfMonth = recurrence.dayOfMonth; // 1-28
    
    // Set to target day of current month
    nextTrigger.setDate(targetDayOfMonth);
    
    // If we've passed that day this month, move to next month
    if (nextTrigger <= now) {
      nextTrigger.setMonth(nextTrigger.getMonth() + 1);
      nextTrigger.setDate(targetDayOfMonth);
    }
  }
  
  return nextTrigger;
}

/**
 * Check if a reminder should trigger at current time in timezone
 * @param {Object} recurrence - Recurrence object
 * @param {string} timezone - Timezone identifier
 * @param {number} lastShownTimestamp - Last time reminder was shown (milliseconds)
 * @returns {boolean} True if reminder should trigger
 */
export function shouldTriggerReminder(recurrence, timezone, lastShownTimestamp, nowOverride = null) {
  const now = nowOverride || getNowInTimezone(timezone);
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentDayOfWeek = now.getDay();
  const currentDayOfMonth = now.getDate();

  if (recurrence.type === 'minutely') {
    const intervalMinutes = Math.max(1, recurrence.intervalMinutes || 1);
    const minutesSinceMidnight = (currentHour * 60) + currentMinute;
    const isOnIntervalBoundary = minutesSinceMidnight % intervalMinutes === 0;
    if (!isOnIntervalBoundary) {
      return false;
    }

    return !isAcknowledgedInCurrentInterval(recurrence, timezone, now, lastShownTimestamp);
  }
  
  const reminderHour = recurrence.hour;
  const reminderMinute = recurrence.minute;
  
  // Check if current time matches reminder time (within same minute)
  const timeMatches = currentHour === reminderHour && currentMinute === reminderMinute;
  
  if (!timeMatches) {
    return false;
  }

  // Once acknowledged, it should stay acknowledged only for the current recurrence interval.
  if (isAcknowledgedInCurrentInterval(recurrence, timezone, now, lastShownTimestamp)) {
    return false;
  }
  
  // Check recurrence pattern
  if (recurrence.type === 'daily') {
    return true;
  } else if (recurrence.type === 'weekly') {
    return getWeeklyTargetDays(recurrence).includes(currentDayOfWeek);
  } else if (recurrence.type === 'monthly') {
    return currentDayOfMonth === recurrence.dayOfMonth;
  }
  
  return false;
}

function isAcknowledgedInCurrentInterval(recurrence, timezone, nowInTz, lastShownTimestamp) {
  if (!lastShownTimestamp) {
    return false;
  }

  const lastShownDate = new Date(lastShownTimestamp);
  const lastShownInTz = new Date(lastShownDate.toLocaleString('en-US', { timeZone: timezone }));

  const currentIntervalKey = getIntervalKey(recurrence, nowInTz);
  const lastShownIntervalKey = getIntervalKey(recurrence, lastShownInTz);

  return currentIntervalKey === lastShownIntervalKey;
}

function getIntervalKey(recurrence, dateInTz) {
  const year = dateInTz.getFullYear();
  const month = dateInTz.getMonth() + 1;
  const day = dateInTz.getDate();
  const hour = dateInTz.getHours();
  const minute = dateInTz.getMinutes();

  if (recurrence.type === 'minutely') {
    const intervalMinutes = Math.max(1, recurrence.intervalMinutes || 1);
    const minutesSinceMidnight = (hour * 60) + minute;
    const bucket = Math.floor(minutesSinceMidnight / intervalMinutes);
    return `minutely:${year}-${month}-${day}:${bucket}`;
  }

  if (recurrence.type === 'daily') {
    return `daily:${year}-${month}-${day}`;
  }

  if (recurrence.type === 'weekly') {
    return `weekly:${year}-${month}-${day}`;
  }

  if (recurrence.type === 'monthly') {
    return `monthly:${year}-${month}`;
  }

  return `default:${year}-${month}-${day}:${hour}:${minute}`;
}

function getWeeklyTargetDays(recurrence) {
  if (Array.isArray(recurrence.daysOfWeek) && recurrence.daysOfWeek.length > 0) {
    return recurrence.daysOfWeek;
  }

  if (typeof recurrence.dayOfWeek === 'number') {
    return [recurrence.dayOfWeek];
  }

  return [5];
}
