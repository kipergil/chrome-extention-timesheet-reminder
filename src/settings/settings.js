/**
 * Settings page script
 * Handles reminder management UI
 */

import { 
  getReminders, 
  getUserPreferences, 
  setUserPreferences
} from '../utils/storage.js';
import {
  addReminderToStorage,
  updateReminderInStorage,
  deleteReminderFromStorage,
  clearAllReminders
} from './reminders-manager.js';
import { getNextTriggerTime } from '../utils/recurrence.js';

let currentEditingReminderId = null;
let reminderCountdownIntervalId = null;

// DOM Elements
const currentTimezoneDisplay = document.getElementById('currentTimezone');
const resetTimezoneBtn = document.getElementById('resetTimezoneBtn');
const snoozeDurationInput = document.getElementById('snoozeDuration');
const maxSnoozeCountSelect = document.getElementById('maxSnoozeCount');
const saveSnoozeConfigBtn = document.getElementById('saveSnoozeConfigBtn');
const snoozeSaveStatus = document.getElementById('snoozeSaveStatus');
const addReminderBtn = document.getElementById('addReminderBtn');
const remindersList = document.getElementById('remindersList');
const clearAllBtn = document.getElementById('clearAllRemindersBtn');

const reminderModal = document.getElementById('reminderModal');
const modalTitle = document.getElementById('modalTitle');
const reminderForm = document.getElementById('reminderForm');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const recurrenceType = document.getElementById('recurrenceType');
const minutelyOptions = document.getElementById('minutelyOptions');
const dailyOptions = document.getElementById('dailyOptions');
const weeklyOptions = document.getElementById('weeklyOptions');
const monthlyOptions = document.getElementById('monthlyOptions');

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  initializePage();
});

async function initializePage() {
  setupEventListeners();
  await loadTimezone();
  await loadSnoozeConfig();
  await loadReminders();
}

/**
 * Load and display current timezone
 */
async function loadTimezone() {
  const prefs = await getUserPreferences();
  currentTimezoneDisplay.textContent = prefs.timezone || 'Not set';
}

async function loadSnoozeConfig() {
  const prefs = await getUserPreferences();
  snoozeDurationInput.value = String(prefs.snoozeDuration ?? 15);
  maxSnoozeCountSelect.value = String(prefs.maxSnoozeCount ?? 3);
}

/**
 * Load and display all reminders
 */
async function loadReminders() {
  const [reminders, prefs] = await Promise.all([getReminders(), getUserPreferences()]);
  const maxSnoozeCount = prefs.maxSnoozeCount ?? 3;
  const timezone = prefs.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  if (reminders.length === 0) {
    remindersList.innerHTML = '<p class="no-reminders">No reminders configured yet</p>';
    stopReminderCountdownUpdates();
    return;
  }
  
  remindersList.innerHTML = reminders.map((reminder) => createReminderCard(reminder, maxSnoozeCount, timezone)).join('');
  
  // Add event listeners to delete buttons
  document.querySelectorAll('.reminder-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const reminderId = e.target.dataset.reminderId;
      if (confirm('Delete this reminder?')) {
        await deleteReminderFromStorage(reminderId);
        await loadReminders();
      }
    });
  });
  
  // Add event listeners to edit buttons
  document.querySelectorAll('.reminder-edit-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const reminderId = e.target.dataset.reminderId;
      await editReminder(reminderId);
    });
  });

  startReminderCountdownUpdates();
}

/**
 * Create HTML for a reminder card
 */
function createReminderCard(reminder, maxSnoozeCount, timezone) {
  const recurrenceText = getRecurrenceText(reminder.recurrence);
  const enabledStatus = reminder.enabled ? '✓ Enabled' : '✗ Disabled';
  const actionButtonLabel = (reminder.actionButtonLabel || '').trim();
  const actionUrl = (reminder.actionUrl || '').trim();
  const actionStatusText = actionUrl
    ? `${actionButtonLabel || 'Open Link'} -> ${actionUrl}`
    : 'No action button';
  const lastAcknowledged = reminder.lastShown
    ? formatDateTime(reminder.lastShown)
    : 'Not acknowledged yet';
  const snoozeCount = reminder.snoozeCount || 0;
  const snoozedUntil = reminder.snoozedUntil
    ? formatDateTime(reminder.snoozedUntil)
    : 'Not snoozed';
  const snoozeLimitReached = maxSnoozeCount >= 0 && snoozeCount >= maxSnoozeCount;
  const snoozeStatusText = maxSnoozeCount <= 0
    ? 'Snooze disabled'
    : `${snoozeCount}/${maxSnoozeCount}${snoozeLimitReached ? ' (limit reached)' : ''}`;
  const nextCheckTimestamp = getReminderNextCheckTimestamp(reminder, timezone);
  const nextCheckData = typeof nextCheckTimestamp === 'number' ? String(nextCheckTimestamp) : '';
  const nextCheckText = getNextCheckDisplayText(nextCheckTimestamp, reminder.enabled);
  
  return `
    <div class="reminder-card ${!reminder.enabled ? 'disabled' : ''}">
      <div class="reminder-header">
        <h3>${escapeHtml(reminder.message)}</h3>
        <span class="reminder-status">${enabledStatus}</span>
      </div>
      <p class="reminder-schedule">${recurrenceText}</p>
      <div class="reminder-state-lines">
        <p class="reminder-state-line"><strong>Acknowledged:</strong> ${escapeHtml(lastAcknowledged)}</p>
        <p class="reminder-state-line"><strong>Action:</strong> ${escapeHtml(actionStatusText)}</p>
        <p class="reminder-state-line"><strong>Snooze Used:</strong> ${escapeHtml(snoozeStatusText)}</p>
        <p class="reminder-state-line"><strong>Snoozed Until:</strong> ${escapeHtml(snoozedUntil)}</p>
        <p class="reminder-state-line"><strong>Next Check:</strong> <span class="reminder-next-check" data-next-check-ts="${nextCheckData}" data-enabled="${reminder.enabled ? '1' : '0'}">${escapeHtml(nextCheckText)}</span></p>
      </div>
      <div class="reminder-actions">
        <button class="reminder-edit-btn btn btn-secondary" data-reminder-id="${reminder.id}">Edit</button>
        <button class="reminder-delete-btn btn btn-danger" data-reminder-id="${reminder.id}">Delete</button>
      </div>
    </div>
  `;
}

function formatDateTime(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function getReminderNextCheckTimestamp(reminder, timezone, nowMs = Date.now()) {
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
  const timestamp = nextTrigger.getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getNextCheckDisplayText(timestamp, isEnabled) {
  if (!isEnabled) {
    return 'Disabled';
  }

  if (typeof timestamp !== 'number') {
    return 'Not scheduled';
  }

  return `${formatDateTime(timestamp)} (${formatCountdown(timestamp)})`;
}

function formatCountdown(targetTimestamp) {
  const deltaMs = targetTimestamp - Date.now();
  if (deltaMs <= 0) {
    return 'due now';
  }

  const totalSeconds = Math.floor(deltaMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0 || days > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || hours > 0 || days > 0) {
    parts.push(`${minutes}m`);
  }
  parts.push(`${seconds}s`);

  return `in ${parts.join(' ')}`;
}

function startReminderCountdownUpdates() {
  stopReminderCountdownUpdates();
  updateReminderCountdowns();
  reminderCountdownIntervalId = setInterval(updateReminderCountdowns, 1000);
}

function stopReminderCountdownUpdates() {
  if (!reminderCountdownIntervalId) {
    return;
  }

  clearInterval(reminderCountdownIntervalId);
  reminderCountdownIntervalId = null;
}

function updateReminderCountdowns() {
  document.querySelectorAll('.reminder-next-check').forEach((element) => {
    const isEnabled = element.dataset.enabled === '1';
    const timestamp = Number(element.dataset.nextCheckTs);

    if (!isEnabled) {
      element.textContent = 'Disabled';
      return;
    }

    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      element.textContent = 'Not scheduled';
      return;
    }

    element.textContent = `${formatDateTime(timestamp)} (${formatCountdown(timestamp)})`;
  });
}

/**
 * Get human-readable recurrence text
 */
function getRecurrenceText(recurrence) {
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const timeStr = `${String(recurrence.hour).padStart(2, '0')}:${String(recurrence.minute).padStart(2, '0')}`;

  if (recurrence.type === 'minutely') {
    const interval = recurrence.intervalMinutes || 1;
    return `Every ${interval} minute${interval === 1 ? '' : 's'}`;
  }
  
  if (recurrence.type === 'daily') {
    return `Daily at ${timeStr}`;
  } else if (recurrence.type === 'weekly') {
    const selectedDays = getWeeklyDaysFromRecurrence(recurrence)
      .map((day) => daysOfWeek[day])
      .join(', ');
    return `Every ${selectedDays} at ${timeStr}`;
  } else if (recurrence.type === 'monthly') {
    return `Every month on day ${recurrence.dayOfMonth} at ${timeStr}`;
  }
  
  return 'Unknown recurrence';
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Timezone
  resetTimezoneBtn.addEventListener('click', () => {
    resetTimezone();
  });

  saveSnoozeConfigBtn.addEventListener('click', () => {
    saveSnoozeConfig();
  });
  
  // Add reminder
  addReminderBtn.addEventListener('click', openAddReminderModal);
  
  // Modal controls
  closeModalBtn.addEventListener('click', closeModal);
  cancelModalBtn.addEventListener('click', closeModal);
  reminderForm.addEventListener('submit', (e) => {
    handleReminderFormSubmit(e);
  });
  
  // Recurrence type change
  recurrenceType.addEventListener('change', updateRecurrenceOptions);
  
  // Clear all
  clearAllBtn.addEventListener('click', () => {
    handleClearAll();
  });
}

/**
 * Validate URL format - restricted to http(s) so a saved action URL can never
 * be a javascript: (or other) URI that executes code when opened.
 */
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

/**
 * Reset timezone to system timezone
 */
async function resetTimezone() {
  const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  await setUserPreferences({ timezone: systemTimezone });
  await loadTimezone();
}

async function saveSnoozeConfig() {
  const snoozeDuration = Math.max(1, parseInt(snoozeDurationInput.value, 10)) || 15;
  const maxSnoozeCount = parseInt(maxSnoozeCountSelect.value, 10);
  await setUserPreferences({ snoozeDuration, maxSnoozeCount });

  snoozeSaveStatus.textContent = 'Saved!';
  snoozeSaveStatus.classList.add('show');
  setTimeout(() => {
    snoozeSaveStatus.textContent = '';
    snoozeSaveStatus.classList.remove('show');
  }, 2000);
}

/**
 * Open add reminder modal
 */
function openAddReminderModal() {
  currentEditingReminderId = null;
  modalTitle.textContent = 'Add New Reminder';
  reminderForm.reset();
  document.getElementById('reminderMessage').value = 'Time to fill your timesheet!';
  document.getElementById('reminderActionLabel').value = 'Open Timesheet';
  document.getElementById('reminderActionUrl').value = '';
  document.getElementById('recurrenceType').value = 'weekly';
  document.querySelectorAll('.weekly-day-checkbox').forEach((checkbox) => {
    checkbox.checked = checkbox.value === '5';
  });
  document.getElementById('weeklyHour').value = '15'; // 3 PM
  document.getElementById('weeklyMinute').value = '0';
  document.getElementById('reminderEnabled').checked = true;
  updateRecurrenceOptions();
  openModal();
}

/**
 * Edit existing reminder
 */
async function editReminder(reminderId) {
  const reminders = await getReminders();
  const reminder = reminders.find(r => r.id === reminderId);
  
  if (!reminder) return;
  
  currentEditingReminderId = reminderId;
  modalTitle.textContent = 'Edit Reminder';
  
  document.getElementById('reminderMessage').value = reminder.message;
  document.getElementById('reminderActionLabel').value = reminder.actionButtonLabel || (reminder.actionUrl ? 'Open Timesheet' : '');
  document.getElementById('reminderActionUrl').value = reminder.actionUrl || '';
  document.getElementById('recurrenceType').value = reminder.recurrence.type;
  document.getElementById('reminderEnabled').checked = reminder.enabled;
  
  if (reminder.recurrence.type === 'daily') {
    document.getElementById('dailyHour').value = reminder.recurrence.hour;
    document.getElementById('dailyMinute').value = reminder.recurrence.minute;
  } else if (reminder.recurrence.type === 'minutely') {
    document.getElementById('intervalMinutes').value = reminder.recurrence.intervalMinutes || 5;
  } else if (reminder.recurrence.type === 'weekly') {
    const selectedDays = getWeeklyDaysFromRecurrence(reminder.recurrence);
    document.querySelectorAll('.weekly-day-checkbox').forEach((checkbox) => {
      checkbox.checked = selectedDays.includes(parseInt(checkbox.value, 10));
    });
    document.getElementById('weeklyHour').value = reminder.recurrence.hour;
    document.getElementById('weeklyMinute').value = reminder.recurrence.minute;
  } else if (reminder.recurrence.type === 'monthly') {
    document.getElementById('monthlyDay').value = reminder.recurrence.dayOfMonth;
    document.getElementById('monthlyHour').value = reminder.recurrence.hour;
    document.getElementById('monthlyMinute').value = reminder.recurrence.minute;
  }
  
  updateRecurrenceOptions();
  openModal();
}

/**
 * Open modal
 */
function openModal() {
  reminderModal.classList.remove('hidden');
}

/**
 * Close modal
 */
function closeModal() {
  reminderModal.classList.add('hidden');
  currentEditingReminderId = null;
  broadcastCloseAllModals();
}

/**
 * Broadcast close modal message to all tabs
 */
function broadcastCloseAllModals() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      try {
        chrome.tabs.sendMessage(tab.id, {
          type: 'CLOSE_ALL_MODALS'
        }).catch(err => {
          // Tab might not have content script loaded, that's ok
        });
      } catch (err) {
        // Error sending to tab, continue
      }
    });
  });
}


/**
 * Update visible recurrence options based on selected type
 */
function updateRecurrenceOptions() {
  const type = recurrenceType.value;
  
  minutelyOptions.classList.add('hidden');
  dailyOptions.classList.add('hidden');
  weeklyOptions.classList.add('hidden');
  monthlyOptions.classList.add('hidden');
  
  if (type === 'minutely') {
    minutelyOptions.classList.remove('hidden');
  } else if (type === 'daily') {
    dailyOptions.classList.remove('hidden');
  } else if (type === 'weekly') {
    weeklyOptions.classList.remove('hidden');
  } else if (type === 'monthly') {
    monthlyOptions.classList.remove('hidden');
  }
}

/**
 * Handle reminder form submission
 */
async function handleReminderFormSubmit(e) {
  e.preventDefault();
  
  const message = document.getElementById('reminderMessage').value.trim();
  const actionButtonLabel = document.getElementById('reminderActionLabel').value.trim();
  const actionUrl = document.getElementById('reminderActionUrl').value.trim();
  const type = recurrenceType.value;
  const enabled = document.getElementById('reminderEnabled').checked;
  
  let recurrence = {
    type,
    hour: 0,
    minute: 0
  };
  
  if (type === 'minutely') {
    recurrence.intervalMinutes = parseInt(document.getElementById('intervalMinutes').value, 10);
  } else if (type === 'daily') {
    recurrence.hour = parseInt(document.getElementById('dailyHour').value);
    recurrence.minute = parseInt(document.getElementById('dailyMinute').value);
  } else if (type === 'weekly') {
    recurrence.daysOfWeek = Array.from(document.querySelectorAll('.weekly-day-checkbox:checked'))
      .map((checkbox) => parseInt(checkbox.value, 10));
    recurrence.hour = parseInt(document.getElementById('weeklyHour').value);
    recurrence.minute = parseInt(document.getElementById('weeklyMinute').value);
  } else if (type === 'monthly') {
    recurrence.dayOfMonth = parseInt(document.getElementById('monthlyDay').value);
    recurrence.hour = parseInt(document.getElementById('monthlyHour').value);
    recurrence.minute = parseInt(document.getElementById('monthlyMinute').value);
  }
  
  // Validate
  if (!message) {
    alert('Please enter a reminder message');
    return;
  }

  if (actionUrl && !isValidUrl(actionUrl)) {
    alert('Please enter a valid action URL');
    return;
  }
  
  if (type !== 'minutely' && (!Number.isInteger(recurrence.hour) || recurrence.hour < 0 || recurrence.hour > 23 || !Number.isInteger(recurrence.minute) || recurrence.minute < 0 || recurrence.minute > 59)) {
    alert('Please enter valid time values');
    return;
  }

  if (type === 'minutely' && (!Number.isInteger(recurrence.intervalMinutes) || recurrence.intervalMinutes < 1 || recurrence.intervalMinutes > 120)) {
    alert('Please enter a valid minute interval between 1 and 120');
    return;
  }

  if (type === 'weekly' && (!recurrence.daysOfWeek || recurrence.daysOfWeek.length === 0)) {
    alert('Please select at least one day of week');
    return;
  }

  if (type === 'monthly' && (!Number.isInteger(recurrence.dayOfMonth) || recurrence.dayOfMonth < 1 || recurrence.dayOfMonth > 28)) {
    alert('Please enter a day between 1 and 28');
    return;
  }
  
  // Save
  const reminderPayload = {
    message,
    recurrence,
    enabled,
    actionButtonLabel,
    actionUrl
  };

  if (currentEditingReminderId) {
    await updateReminderInStorage(currentEditingReminderId, reminderPayload);
  } else {
    await addReminderToStorage(reminderPayload);
  }
  
  closeModal();
  await loadReminders();
}

/**
 * Handle clear all reminders
 */
async function handleClearAll() {
  if (confirm('Are you sure you want to delete ALL reminders? This cannot be undone.')) {
    await clearAllReminders();
    await loadReminders();
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function getWeeklyDaysFromRecurrence(recurrence) {
  if (Array.isArray(recurrence.daysOfWeek) && recurrence.daysOfWeek.length > 0) {
    return recurrence.daysOfWeek;
  }

  if (typeof recurrence.dayOfWeek === 'number') {
    return [recurrence.dayOfWeek];
  }

  return [5];
}
