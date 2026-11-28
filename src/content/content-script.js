/**
 * Content Script
 * Injects reminder popups into web pages
 */

let popupTemplateCache = null;

// Listen for messages from background worker and settings page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SHOW_REMINDER_POPUP') {
    showReminderPopup(message.reminder);
    sendResponse({ status: 'popup_shown' });
  } else if (message.type === 'CLOSE_ALL_MODALS') {
    removeReminderPopup();
    sendResponse({ status: 'modal_closed' });
  }
});

/**
 * Show reminder popup modal
 */
function showReminderPopup(reminder) {
  ensurePopupStyles();

  if (document.getElementById('timesheet-reminder-modal')) {
    removeReminderPopup();
  }

  getPopupTemplate().then((templateHtml) => {
    const parser = new DOMParser();
    const templateDoc = parser.parseFromString(templateHtml, 'text/html');
    const modal = templateDoc.body.firstElementChild;

    if (!modal) {
      return;
    }

    const messageElement = modal.querySelector('#timesheetReminderMessage');
    const acknowledgeBtn = modal.querySelector('#timesheetAcknowledgeBtn');
    const snoozeBtn = modal.querySelector('#timesheetSnoozeBtn');
    const openTimesheetBtn = modal.querySelector('#timesheetOpenBtn');

    if (messageElement) {
      messageElement.textContent = reminder.message || 'Time to fill your timesheet!';
    }

    const snoozeCount = reminder.snoozeCount || 0;
    const maxSnoozeCount = Number.isInteger(reminder.maxSnoozeCount)
      ? reminder.maxSnoozeCount
      : 3;
    const snoozeDurationMinutes = Number.isInteger(reminder.snoozeDurationMinutes)
      ? reminder.snoozeDurationMinutes
      : 15;

    if (snoozeBtn) {
      if (maxSnoozeCount <= 0) {
        snoozeBtn.disabled = true;
        snoozeBtn.textContent = `Snooze Disabled (${snoozeDurationMinutes} min)`;
      } else if (snoozeCount >= maxSnoozeCount) {
        snoozeBtn.disabled = true;
        snoozeBtn.textContent = `Snooze Limit Reached (${maxSnoozeCount}/${maxSnoozeCount}, ${snoozeDurationMinutes} min)`;
      } else {
        snoozeBtn.textContent = `Snooze ${snoozeDurationMinutes} min (${snoozeCount}/${maxSnoozeCount})`;
      }
    }

    if (acknowledgeBtn) {
      acknowledgeBtn.addEventListener('click', () => {
        acknowledgeReminder(reminder.id);
        removeReminderPopup();
        broadcastCloseAllModals();
      });
    }

    if (snoozeBtn) {
      snoozeBtn.addEventListener('click', () => {
        // Only close the modal (locally and across tabs) once the snooze is
        // confirmed - closing unconditionally here would race ahead of the
        // background worker's response and dismiss the popup even when the
        // snooze limit was hit, hiding the "limit reached" notice before it
        // could ever be shown.
        snoozeReminder(reminder.id);
      });
    }

    if (openTimesheetBtn) {
      const actionUrl = (reminder.actionUrl || '').trim();
      const actionButtonLabel = (reminder.actionButtonLabel || '').trim();

      if (actionUrl && isSafeHttpUrl(actionUrl)) {
        openTimesheetBtn.style.display = 'block';
        openTimesheetBtn.textContent = actionButtonLabel || 'Open Link';
        openTimesheetBtn.addEventListener('click', () => {
          acknowledgeReminder(reminder.id);
          removeReminderPopup();
          broadcastCloseAllModals();
          chrome.runtime.sendMessage({ type: 'OPEN_TIMESHEET', url: actionUrl });
          window.open(actionUrl, '_blank');
        });
      } else {
        openTimesheetBtn.style.display = 'none';
      }
    }

    document.body.appendChild(modal);
    setTimeout(() => {
      modal.classList.add('show');
    }, 10);
  });
}

function getPopupTemplate() {
  if (popupTemplateCache) {
    return Promise.resolve(popupTemplateCache);
  }

  const templateUrl = chrome.runtime.getURL('src/content/popup-template.html');
  return fetch(templateUrl)
    .then((response) => response.text())
    .then((html) => {
      popupTemplateCache = html;
      return html;
    });
}

/**
 * Remove reminder popup
 */
function removeReminderPopup() {
  const modal = document.getElementById('timesheet-reminder-modal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => {
      modal.remove();
    }, 300);
  }
}

/**
 * Acknowledge reminder
 */
function acknowledgeReminder(reminderId) {
  // Send message to background worker to mark as shown
  chrome.runtime.sendMessage({
    type: 'REMINDER_ACKNOWLEDGED',
    reminderId: reminderId
  }, (response) => {
    console.log('Reminder acknowledged response:', response);
  });
}

/**
 * Snooze reminder
 */
function snoozeReminder(reminderId) {
  // Send message to background worker to snooze
  chrome.runtime.sendMessage({
    type: 'REMINDER_SNOOZED',
    reminderId: reminderId
  }, (response) => {
    if (response?.status === 'ok') {
      removeReminderPopup();
      broadcastCloseAllModals();
      return;
    }

    if (response?.status === 'limit_reached') {
      // Shown inline rather than via alert() - a native alert from a content
      // script is attributed to the current webpage ("example.com says..."),
      // which is confusing and looks like the site itself is prompting.
      showReminderNotice(`Snooze limit reached (${response.currentSnoozeCount}/${response.maxSnoozeCount}). Please acknowledge this reminder.`);
      const snoozeBtn = document.getElementById('timesheetSnoozeBtn');
      if (snoozeBtn) {
        snoozeBtn.disabled = true;
        snoozeBtn.textContent = `Snooze Limit Reached (${response.maxSnoozeCount}/${response.maxSnoozeCount})`;
      }
      return;
    }

    console.log('Reminder snoozed response:', response);
  });
}

function showReminderNotice(message) {
  const notice = document.getElementById('timesheetReminderNotice');
  if (!notice) {
    return;
  }

  notice.textContent = message;
  notice.classList.add('show');
}

/**
 * Only http(s) URLs are allowed to be opened - guards against a stored
 * actionUrl (e.g. from before URL validation was added) containing a
 * javascript: or other URI that would execute code when opened.
 */
function isSafeHttpUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

function ensurePopupStyles() {
  const styleId = 'timesheet-reminder-styles';
  if (document.getElementById(styleId)) {
    return;
  }

  const link = document.createElement('link');
  link.id = styleId;
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = chrome.runtime.getURL('src/styles/popup-modal.css');
  document.head.appendChild(link);
}

/**
 * Broadcast close all modals to background worker
 */
function broadcastCloseAllModals() {
  chrome.runtime.sendMessage({
    type: 'CLOSE_ALL_MODALS'
  }).catch(err => {
    // Background worker may not respond, that's ok
  });
}
