/**
 * Background Service Worker
 * Manages reminder scheduling and triggering
 */

import { initializeDefaultReminders, getReminders, getUserPreferences, updateReminder } from '../utils/storage.js';
import { getEarliestNextReminderTimestamp, getRemindersThatShouldTrigger } from '../utils/time-checker.js';

const NEXT_REMINDER_ALARM = 'nextReminderCheck';

// Initialize on extension load
chrome.runtime.onInstalled.addListener(() => {
  console.log('Timesheet Reminder extension installed');
  initializeDefaultReminders().then(() => {
    startReminderCheck();
  });
});

// Start checking for reminders
chrome.runtime.onStartup.addListener(() => {
  console.log('Browser started - checking for missed reminders');
  initializeDefaultReminders().then(() => {
    startReminderCheck();
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === NEXT_REMINDER_ALARM) {
    checkForReminders().catch((error) => {
      console.error('Failed to check reminders:', error);
    });
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') {
    return;
  }

  if (changes.reminders || changes.userPreferences) {
    scheduleNextReminderCheck().catch((error) => {
      console.error('Failed to reschedule reminder check:', error);
    });
  }
});

/**
 * Start the reminder checking routine
 */
function startReminderCheck() {
  // Initial check
  checkForReminders().catch((error) => {
    console.error('Initial reminder check failed:', error);
  });
}

function scheduleNextReminderCheck() {
  return Promise.all([getReminders(), getUserPreferences()]).then(([reminders, prefs]) => {
    const nextTimestamp = getEarliestNextReminderTimestamp(reminders, prefs.timezone, Date.now());

    return new Promise((resolve) => {
      chrome.alarms.clear(NEXT_REMINDER_ALARM, () => {
        if (typeof nextTimestamp === 'number') {
          chrome.alarms.create(NEXT_REMINDER_ALARM, {
            when: Math.max(Date.now(), nextTimestamp)
          });
        }

        resolve();
      });
    });
  });
}

/**
 * Check if any reminders should trigger now
 */
function checkForReminders() {
  return getRemindersThatShouldTrigger().then((reminders) => {
    if (reminders.length === 0) {
      return scheduleNextReminderCheck();
    }

    console.log(`Triggering ${reminders.length} reminder(s)`);
    const triggeredAt = Date.now();

    return Promise.all(reminders.map((reminder) => {
      const updates = {
        lastTriggeredAt: triggeredAt
      };

      if (!reminder.snoozedUntil) {
        updates.snoozeCount = 0;
        reminder.snoozeCount = 0;
      } else {
        updates.snoozedUntil = null;
        reminder.snoozedUntil = null;
      }

      reminder.lastTriggeredAt = triggeredAt;
      return updateReminder(reminder.id, updates);
    })).then(() => {
      reminders.forEach((reminder) => {
        triggerReminder(reminder);
      });

      return scheduleNextReminderCheck();
    });
  });
}

/**
 * Trigger a single reminder
 */
function triggerReminder(reminder) {
  console.log('Triggering reminder:', reminder.id, reminder.message);
  getUserPreferences().then((prefs) => {
    const reminderPayload = {
      ...reminder,
      snoozeCount: reminder.snoozeCount || 0,
      maxSnoozeCount: prefs.maxSnoozeCount ?? 3,
      snoozeDurationMinutes: prefs.snoozeDuration || 15
    };

    // Send message to all content scripts to show popup
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        try {
          chrome.tabs.sendMessage(tab.id, {
            type: 'SHOW_REMINDER_POPUP',
            reminder: reminderPayload
          }).catch(err => {
            // Tab might not have content script loaded, that's ok
            console.log('Could not send message to tab:', err.message);
          });
        } catch (err) {
          console.log('Error sending message to tab:', err);
        }
      });
    });
  });
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'REMINDER_ACKNOWLEDGED') {
    console.log('Reminder acknowledged:', message.reminderId);
    updateReminder(message.reminderId, {
      lastShown: Date.now(),
      snoozedUntil: null,
      snoozeCount: 0
    }).then(() => {
      sendResponse({ status: 'ok' });
    });
    return true;
  } else if (message.type === 'REMINDER_SNOOZED') {
    console.log('Reminder snoozed:', message.reminderId);
    Promise.all([getReminders(), getUserPreferences()]).then(([reminders, prefs]) => {
      const reminder = reminders.find((r) => r.id === message.reminderId);
      if (!reminder) {
        sendResponse({ status: 'not_found' });
        return;
      }

      const maxSnoozeCount = prefs.maxSnoozeCount ?? 3;
      const currentSnoozeCount = reminder.snoozeCount || 0;
      if (currentSnoozeCount >= maxSnoozeCount) {
        sendResponse({
          status: 'limit_reached',
          maxSnoozeCount,
          currentSnoozeCount
        });
        return;
      }

      const snoozeDurationMinutes = prefs.snoozeDuration || 15;
      updateReminder(message.reminderId, {
        snoozedUntil: Date.now() + (snoozeDurationMinutes * 60 * 1000),
        snoozeCount: currentSnoozeCount + 1
      }).then(() => {
        sendResponse({
          status: 'ok',
          currentSnoozeCount: currentSnoozeCount + 1,
          maxSnoozeCount
        });
      });
    });
    return true;
  } else if (message.type === 'OPEN_TIMESHEET') {
    console.log('Opening timesheet URL:', message.url);
    sendResponse({ status: 'ok' });
  } else if (message.type === 'TRIGGER_TEST_REMINDER') {
    const reminder = message.reminder || {
      id: `test-${Date.now()}`,
      message: 'This is a test reminder popup.'
    };
    triggerReminder(reminder);
    sendResponse({ status: 'ok' });
  } else if (message.type === 'OPEN_SETTINGS_PAGE') {
    chrome.tabs.create({ url: 'src/settings/settings.html' }, () => {
      sendResponse({ status: 'ok' });
    });
    return true;
  } else if (message.type === 'CLEAR_ACKNOWLEDGEMENTS') {
    getReminders().then((reminders) => {
      const updatedReminders = reminders.map((reminder) => ({
        ...reminder,
        lastShown: null
      }));

      chrome.storage.local.set({ reminders: updatedReminders }, () => {
        const now = Date.now();
        const activeSnoozedCount = updatedReminders.filter(
          (r) => r.snoozedUntil && r.snoozedUntil > now
        ).length;
        sendResponse({
          status: 'ok',
          summary: {
            total: updatedReminders.length,
            acknowledged: 0,
            activeSnoozed: activeSnoozedCount
          }
        });
      });
    });
    return true;
  } else if (message.type === 'CLEAR_SNOOZE_COUNT') {
    getReminders().then((reminders) => {
      const updatedReminders = reminders.map((reminder) => ({
        ...reminder,
        snoozeCount: 0,
        snoozedUntil: null
      }));

      chrome.storage.local.set({ reminders: updatedReminders }, () => {
        const acknowledgedCount = updatedReminders.filter((r) => !!r.lastShown).length;
        sendResponse({
          status: 'ok',
          summary: {
            total: updatedReminders.length,
            acknowledged: acknowledgedCount,
            activeSnoozed: 0
          }
        });
      });
    });
    return true;
  } else if (message.type === 'CLOSE_ALL_MODALS') {
    console.log('Broadcasting close all modals to all tabs');
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
    sendResponse({ status: 'ok' });
  }
});
