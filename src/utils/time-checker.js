/**
 * Time checker utilities - determine which reminders should trigger
 */

import { getNextTriggerTime, shouldTriggerReminder } from './recurrence.js';
import { getReminders, getUserPreferences } from './storage.js';

export function getReminderNextCheckTimestamp(reminder, timezone, nowMs = Date.now()) {
  if (!reminder?.enabled) {
    return null;
  }

  if (reminder.snoozedUntil && reminder.snoozedUntil > nowMs) {
    return reminder.snoozedUntil;
  }

  if (reminder.snoozedUntil && reminder.snoozedUntil <= nowMs) {
    return nowMs;
  }

  const nextTrigger = getNextTriggerTime(reminder.recurrence, timezone);
  const nextTimestamp = nextTrigger.getTime();
  return Number.isFinite(nextTimestamp) ? nextTimestamp : null;
}

export function getEarliestNextReminderTimestamp(reminders, timezone, nowMs = Date.now()) {
  let earliestTimestamp = null;

  reminders.forEach((reminder) => {
    const reminderTimestamp = getReminderNextCheckTimestamp(reminder, timezone, nowMs);
    if (typeof reminderTimestamp !== 'number') {
      return;
    }

    if (earliestTimestamp === null || reminderTimestamp < earliestTimestamp) {
      earliestTimestamp = reminderTimestamp;
    }
  });

  return earliestTimestamp;
}

/**
 * Get all reminders that should trigger now
 * @returns {Array} Array of reminders that should trigger
 */
export function getRemindersThatShouldTrigger() {
  return Promise.all([getReminders(), getUserPreferences()]).then(([reminders, prefs]) => {
    const timezone = prefs.timezone;
    const nowMs = Date.now();

    return reminders.filter((reminder) => {
      if (!reminder.enabled) {
        return false;
      }

      if (reminder.snoozedUntil && nowMs < reminder.snoozedUntil) {
        return false;
      }

      if (reminder.snoozedUntil && nowMs >= reminder.snoozedUntil) {
        return true;
      }

      return shouldTriggerReminder(
        reminder.recurrence,
        timezone,
        reminder.lastTriggeredAt || reminder.lastShown
      );
    });
  });
}

/**
 * Get all reminders that were missed (should have triggered but weren't shown)
 * @returns {Array} Array of missed reminders
 */
export function getMissedReminders() {
  return getReminders().then((reminders) => {
    return reminders.filter((reminder) => {
      if (!reminder.enabled) {
        return false;
      }

      return !reminder.lastShown;
    });
  });
}

/**
 * Mark a reminder as shown at current time
 * @param {string} reminderId - ID of reminder
 */
export function markReminderAsShown(reminderId) {
  return getReminders().then((reminders) => {
    const reminder = reminders.find(r => r.id === reminderId);
    
    if (reminder) {
      reminder.lastShown = Date.now();
      reminder.snoozedUntil = null;
      return chrome.storage.local.set({ reminders });
    }

    return Promise.resolve();
  });
}

/**
 * Mark a reminder as snoozed (will re-trigger in snoozeDuration minutes)
 * @param {string} reminderId - ID of reminder
 */
export function snoozeReminder(reminderId) {
  return getReminders().then((reminders) => {
    const reminder = reminders.find(r => r.id === reminderId);
    
    if (reminder) {
      reminder.snoozedUntil = Date.now() + (15 * 60 * 1000);
      return chrome.storage.local.set({ reminders });
    }

    return Promise.resolve();
  });
}
