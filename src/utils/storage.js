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
 * @param {Array} reminders - Array of reminder objects
 */
export function setReminders(reminders) {
  return setInStorage({ [REMINDERS_KEY]: reminders });
}

/**
 * Add a new reminder
 * @param {Object} reminder - Reminder object {message, recurrence, enabled}
 * @returns {string} ID of created reminder
 */
export function addReminder(reminder) {
  return getReminders().then((reminders) => {
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
  });
}

/**
 * Update an existing reminder
 * @param {string} reminderId - ID of reminder to update
 * @param {Object} updates - Object with fields to update
 */
export function updateReminder(reminderId, updates) {
  return getReminders().then((reminders) => {
    const index = reminders.findIndex(r => r.id === reminderId);
    
    if (index !== -1) {
      reminders[index] = { ...reminders[index], ...updates };
      return setReminders(reminders);
    }

    return Promise.resolve();
  });
}

/**
 * Update multiple reminders atomically in a single read-modify-write cycle.
 * Use this instead of calling updateReminder() concurrently for several
 * reminders - parallel get-then-set calls can race and silently drop updates.
 * @param {Object} updatesById - Map of reminderId -> updates object
 */
export function updateReminders(updatesById) {
  return getReminders().then((reminders) => {
    const updated = reminders.map((reminder) => {
      const updates = updatesById[reminder.id];
      return updates ? { ...reminder, ...updates } : reminder;
    });

    return setReminders(updated);
  });
}

/**
 * Delete a reminder
 * @param {string} reminderId - ID of reminder to delete
 */
export function deleteReminder(reminderId) {
  return getReminders().then((reminders) => {
    const filtered = reminders.filter(r => r.id !== reminderId);
    return setReminders(filtered);
  });
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
  return getUserPreferences().then((current) => {
    const updated = { ...current, ...preferences };
    return setInStorage({ [PREFERENCES_KEY]: updated });
  });
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
