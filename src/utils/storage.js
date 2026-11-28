/**
 * Storage utilities - wrapper for chrome.storage.local operations
 */

const REMINDERS_KEY = 'reminders';
const PREFERENCES_KEY = 'userPreferences';

function getFromStorage(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key]);
    });
  });
}

function setInStorage(values) {
  return new Promise((resolve) => {
    chrome.storage.local.set(values, resolve);
  });
}

/**
 * Serializes read-modify-write cycles against a single storage key so
 * concurrent callers (e.g. two tabs snoozing/acknowledging the same reminder
 * within the same moment, or a bulk "clear" action racing a single-reminder
 * update) can't read the same stale snapshot and silently clobber each
 * other's write. Each task only starts once the previous one's write has
 * committed, and a failed task doesn't stall the ones queued behind it.
 */
function createWriteQueue() {
  let queue = Promise.resolve();

  return function enqueue(task) {
    const result = queue.then(task, task);
    queue = result.then(() => undefined, () => undefined);
    return result;
  };
}

const enqueueRemindersWrite = createWriteQueue();
const enqueuePreferencesWrite = createWriteQueue();

/**
 * Get all reminders from storage
 * @returns {Array} Array of reminder objects
 */
export function getReminders() {
  return getFromStorage(REMINDERS_KEY).then((reminders) => {
    return Array.isArray(reminders) ? reminders : [];
  });
}

/**
 * Save reminders to storage
 *
 * This is a raw overwrite with no read-modify-write safety of its own. Call
 * it directly only when you already hold the write queue (as the functions
 * below do) or are intentionally replacing the whole list; for anything that
 * reads reminders before writing them back, go through one of the queued
 * functions below instead.
 * @param {Array} reminders - Array of reminder objects
 */
export function setReminders(reminders) {
  return setInStorage({ [REMINDERS_KEY]: reminders });
}

/**
 * Replace the entire reminders list (e.g. "clear all"), serialized against
 * any other in-flight reminder read-modify-write so it can't race them.
 * @param {Array} reminders - Array of reminder objects
 */
export function replaceAllReminders(reminders) {
  return enqueueRemindersWrite(() => setReminders(reminders));
}

/**
 * Add a new reminder
 * @param {Object} reminder - Reminder object {message, recurrence, enabled}
 * @returns {string} ID of created reminder
 */
export function addReminder(reminder) {
  return enqueueRemindersWrite(() => getReminders().then((reminders) => {
    const id = `reminder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newReminder = {
      id,
      message: reminder.message || 'Time to fill your timesheet!',
      actionButtonLabel: reminder.actionButtonLabel || '',
      actionUrl: reminder.actionUrl || '',
      recurrence: reminder.recurrence,
      lastShown: null,
      snoozedUntil: null,
      snoozeCount: 0,
      enabled: reminder.enabled !== false
    };

    reminders.push(newReminder);
    return setReminders(reminders).then(() => id);
  }));
}

/**
 * Update an existing reminder
 * @param {string} reminderId - ID of reminder to update
 * @param {Object} updates - Object with fields to update
 */
export function updateReminder(reminderId, updates) {
  return enqueueRemindersWrite(() => getReminders().then((reminders) => {
    const index = reminders.findIndex(r => r.id === reminderId);

    if (index !== -1) {
      reminders[index] = { ...reminders[index], ...updates };
      return setReminders(reminders);
    }

    return Promise.resolve();
  }));
}

/**
 * Attempt to snooze a reminder, enforcing the max-snooze-count limit against
 * whatever count is actually persisted at write time (not a value read
 * earlier by the caller). The read, limit check, and increment all happen
 * inside the same queued read-modify-write cycle, so two snooze attempts
 * for the same reminder arriving at nearly the same instant (e.g. the same
 * reminder popup open in two tabs) are resolved one after the other against
 * each other's committed result, instead of both reading the same stale
 * count and incrementing it to the same new value.
 * @param {string} reminderId
 * @param {{snoozeDurationMinutes: number, maxSnoozeCount: number}} options
 * @returns {{status: 'ok'|'limit_reached'|'not_found', currentSnoozeCount?: number, maxSnoozeCount?: number}}
 */
export function trySnoozeReminder(reminderId, { snoozeDurationMinutes, maxSnoozeCount }) {
  return enqueueRemindersWrite(() => getReminders().then((reminders) => {
    const index = reminders.findIndex((r) => r.id === reminderId);
    if (index === -1) {
      return { status: 'not_found' };
    }

    const currentSnoozeCount = reminders[index].snoozeCount || 0;
    if (currentSnoozeCount >= maxSnoozeCount) {
      return { status: 'limit_reached', currentSnoozeCount, maxSnoozeCount };
    }

    const updatedSnoozeCount = currentSnoozeCount + 1;
    reminders[index] = {
      ...reminders[index],
      snoozedUntil: Date.now() + (snoozeDurationMinutes * 60 * 1000),
      snoozeCount: updatedSnoozeCount
    };

    return setReminders(reminders).then(() => ({
      status: 'ok',
      currentSnoozeCount: updatedSnoozeCount,
      maxSnoozeCount
    }));
  }));
}

/**
 * Update multiple reminders atomically in a single read-modify-write cycle.
 * Use this instead of calling updateReminder() concurrently for several
 * reminders - parallel get-then-set calls can race and silently drop updates.
 * @param {Object} updatesById - Map of reminderId -> updates object
 */
export function updateReminders(updatesById) {
  return enqueueRemindersWrite(() => getReminders().then((reminders) => {
    const updated = reminders.map((reminder) => {
      const updates = updatesById[reminder.id];
      return updates ? { ...reminder, ...updates } : reminder;
    });

    return setReminders(updated);
  }));
}

/**
 * Apply the same transform to every reminder (e.g. clearing every snooze
 * count, or every acknowledgement) in a single read-modify-write cycle.
 * @param {(reminder: Object) => Object} transform
 * @returns {Array} The updated reminders array
 */
export function updateAllReminders(transform) {
  return enqueueRemindersWrite(() => getReminders().then((reminders) => {
    const updated = reminders.map(transform);
    return setReminders(updated).then(() => updated);
  }));
}

/**
 * Delete a reminder
 * @param {string} reminderId - ID of reminder to delete
 */
export function deleteReminder(reminderId) {
  return enqueueRemindersWrite(() => getReminders().then((reminders) => {
    const filtered = reminders.filter(r => r.id !== reminderId);
    return setReminders(filtered);
  }));
}

/**
 * Get user preferences
 * @returns {Object} User preferences object
 */
export function getUserPreferences() {
  return getFromStorage(PREFERENCES_KEY).then((prefs) => {
    return prefs ? { ...getDefaultPreferences(), ...prefs } : getDefaultPreferences();
  });
}

/**
 * Get default user preferences
 * @returns {Object} Default preferences
 */
function getDefaultPreferences() {
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    snoozeDuration: 15, // minutes
    maxSnoozeCount: 3
  };
}

/**
 * Save user preferences
 * @param {Object} preferences - Preferences object
 */
export function setUserPreferences(preferences) {
  return enqueuePreferencesWrite(() => getUserPreferences().then((current) => {
    const updated = { ...current, ...preferences };
    return setInStorage({ [PREFERENCES_KEY]: updated });
  }));
}

/**
 * Initialize default reminders on first load
 */
export function initializeDefaultReminders() {
  return getReminders().then((reminders) => {
    if (reminders.length === 0) {
      return addReminder({
        message: 'Time to fill your timesheet!',
        actionButtonLabel: 'Open Timesheet',
        actionUrl: '',
        recurrence: {
          type: 'weekly',
          dayOfWeek: 5,
          hour: 15,
          minute: 0
        },
        enabled: true
      });
    }

    return Promise.resolve();
  }).then(() => {
    return getUserPreferences();
  }).then((prefs) => {
    if (!prefs.timezone) {
      return setUserPreferences({
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
    }

    return Promise.resolve();
  });
}
