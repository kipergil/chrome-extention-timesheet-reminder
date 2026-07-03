/**
 * Reminders manager - helper functions for reminder CRUD operations
 */

import { 
  addReminder, 
  updateReminder, 
  deleteReminder, 
  setReminders
} from '../utils/storage.js';

/**
 * Add a reminder to storage
 */
export function addReminderToStorage(reminder) {
  return addReminder(reminder);
}

/**
 * Update a reminder in storage
 */
export function updateReminderInStorage(reminderId, updates) {
  return updateReminder(reminderId, updates);
}

/**
 * Delete a reminder from storage
 */
export function deleteReminderFromStorage(reminderId) {
  return deleteReminder(reminderId);
}

/**
 * Clear all reminders
 */
export function clearAllReminders() {
  return setReminders([]);
}
