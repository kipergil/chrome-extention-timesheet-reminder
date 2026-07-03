import { getReminderNextCheckTimestamp } from '../utils/time-checker.js';

const openSettingsBtn = document.getElementById('openSettingsBtn');
const clearAckBtn = document.getElementById('clearAckBtn');
const clearSnoozeBtn = document.getElementById('clearSnoozeBtn');
const statusText = document.getElementById('statusText');
const reminderMessagesList = document.getElementById('reminderMessagesList');

let reminderCountdownIntervalId = null;
let cachedReminders = [];
let cachedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
let cachedMaxSnoozeCount = 3;

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.style.color = isError ? '#c53030' : '#2f855a';
}

function sendAction(type, successMessage) {
  chrome.runtime.sendMessage({ type }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus(chrome.runtime.lastError.message, true);
      return;
    }

    if (response?.status === 'ok') {
      setStatus(successMessage);
      refreshSummary();
      return;
    }

    setStatus('Action failed.', true);
  });
}

function refreshSummary() {
  chrome.storage.local.get(['reminders', 'userPreferences'], (data) => {
    const reminders = Array.isArray(data.reminders) ? data.reminders : [];
    const prefs = data.userPreferences || {};
    cachedReminders = reminders;
    cachedTimezone = prefs.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    cachedMaxSnoozeCount = Number.isInteger(prefs.maxSnoozeCount) ? prefs.maxSnoozeCount : 3;

    renderReminderMessages(cachedReminders, cachedTimezone, Date.now(), cachedMaxSnoozeCount);
    startReminderCountdownUpdates();
  });
}

function startReminderCountdownUpdates() {
  stopReminderCountdownUpdates();
  reminderCountdownIntervalId = setInterval(() => {
    renderReminderMessages(cachedReminders, cachedTimezone, Date.now(), cachedMaxSnoozeCount);
  }, 1000);
}

function stopReminderCountdownUpdates() {
  if (!reminderCountdownIntervalId) {
    return;
  }

  clearInterval(reminderCountdownIntervalId);
  reminderCountdownIntervalId = null;
}

function renderReminderMessages(reminders, timezone, nowMs = Date.now(), maxSnoozeCount = 3) {
  if (!reminderMessagesList) {
    return;
  }

  reminderMessagesList.textContent = '';

  if (reminders.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'reminder-list-empty';
    emptyItem.textContent = 'No reminders configured.';
    reminderMessagesList.appendChild(emptyItem);
    return;
  }

  const sortedReminders = [...reminders].sort((left, right) => {
    const leftTimestamp = getReminderNextCheckTimestamp(left, timezone, nowMs);
    const rightTimestamp = getReminderNextCheckTimestamp(right, timezone, nowMs);

    if (typeof leftTimestamp !== 'number' && typeof rightTimestamp !== 'number') {
      return 0;
    }

    if (typeof leftTimestamp !== 'number') {
      return 1;
    }

    if (typeof rightTimestamp !== 'number') {
      return -1;
    }

    return leftTimestamp - rightTimestamp;
  });

  sortedReminders.forEach((reminder) => {
    const item = document.createElement('li');
    item.className = `reminder-list-item${reminder.enabled ? '' : ' disabled'}`;

    const message = document.createElement('p');
    message.className = 'reminder-message-text';
    message.textContent = reminder.message || 'Untitled reminder';

    const meta = document.createElement('p');
    meta.className = 'reminder-message-meta';
    meta.textContent = getReminderDisplayMeta(reminder, timezone, nowMs);

    const details = document.createElement('div');
    details.className = 'reminder-message-details';

    const reminderCounter = document.createElement('p');
    reminderCounter.className = 'reminder-detail-line';
    reminderCounter.textContent = `Total reminders: ${reminders.length}`;

    const acknowledgedLine = document.createElement('p');
    acknowledgedLine.className = 'reminder-detail-line';
    acknowledgedLine.textContent = `Acknowledged: ${reminder.lastShown ? '1' : '0'}`;

    const activeSnoozedLine = document.createElement('p');
    activeSnoozedLine.className = 'reminder-detail-line';
    activeSnoozedLine.textContent = `Active snoozed: ${(reminder.snoozedUntil && reminder.snoozedUntil > nowMs) ? '1' : '0'}`;

    const maxSnoozeLine = document.createElement('p');
    maxSnoozeLine.className = 'reminder-detail-line';
    maxSnoozeLine.textContent = `Max snooze setting: ${maxSnoozeCount}`;

    const nextCheckLine = document.createElement('p');
    nextCheckLine.className = 'reminder-detail-line';
    nextCheckLine.textContent = `Next check: ${getReminderNextCheckDisplay(reminder, timezone, nowMs)}`;

    details.append(reminderCounter, acknowledgedLine, activeSnoozedLine, maxSnoozeLine, nextCheckLine);

    item.append(message, meta, details);
    reminderMessagesList.appendChild(item);
  });
}

function getReminderDisplayMeta(reminder, timezone, nowMs = Date.now()) {
  if (!reminder.enabled) {
    return 'Disabled';
  }

  if (reminder.snoozedUntil && reminder.snoozedUntil > nowMs) {
    return `Snoozed until ${new Date(reminder.snoozedUntil).toLocaleString()}`;
  }

  const nextCheckTs = getReminderNextCheckTimestamp(reminder, timezone, nowMs);
  if (typeof nextCheckTs !== 'number') {
    return 'Not scheduled';
  }

  return `Next: ${new Date(nextCheckTs).toLocaleString()}`;
}

function getReminderNextCheckDisplay(reminder, timezone, nowMs = Date.now()) {
  const nextCheckTs = getReminderNextCheckTimestamp(reminder, timezone, nowMs);
  if (typeof nextCheckTs !== 'number') {
    return 'Not scheduled';
  }

  return `${new Date(nextCheckTs).toLocaleString()} (${formatCountdown(nextCheckTs)})`;
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

openSettingsBtn.addEventListener('click', () => {
  sendAction('OPEN_SETTINGS_PAGE', 'Opened settings page.');
});

clearAckBtn.addEventListener('click', () => {
  sendAction('CLEAR_ACKNOWLEDGEMENTS', 'Acknowledgements cleared.');
});

clearSnoozeBtn.addEventListener('click', () => {
  sendAction('CLEAR_SNOOZE_COUNT', 'Snooze counts cleared.');
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') {
    return;
  }

  if (changes.reminders || changes.userPreferences) {
    refreshSummary();
  }
});

window.addEventListener('unload', () => {
  stopReminderCountdownUpdates();
});

refreshSummary();
