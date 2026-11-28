# Timesheet Reminder Chrome Extension

A Chrome extension that sends friendly reminders to fill your timesheet at configured times. Set multiple reminders with daily, weekly, monthly, or minutely recurrence, each with its own optional action button/link.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/kipergil)

## Features

✅ **Customizable Reminders** — Add multiple reminders with different schedules and messages
✅ **Flexible Recurrence** — Daily, weekly (one or more days), monthly (day 1–28), or every N minutes
✅ **Per-Reminder Action Button** — Optionally attach a label + URL (e.g. your timesheet link) that opens in a new tab when clicked
✅ **Timezone Support** — Auto-detects your system timezone, with a manual override
✅ **Friendly Popup** — Centered modal shown on top of whatever webpage you're on
✅ **Snooze** — Snooze a reminder for a configurable number of minutes, with a configurable max snooze count before you must acknowledge it
✅ **Persistent Storage** — Reminders and settings are saved via `chrome.storage.local` and survive browser restarts
✅ **Catches Up on Missed Checks** — If the browser was closed or asleep at the scheduled time, the reminder still fires once it's reopened, instead of silently skipping that day/week/month
✅ **Toolbar Dashboard + Settings Page** — A quick-glance popup from the toolbar icon, and a full settings page for managing reminders

## Default Behavior

When you first install the extension:
- A default reminder is created for **Friday at 3:00 PM** (weekly) with the message "Time to fill your timesheet!"
- Your system timezone is automatically detected and used
- Reminders and preferences are stored locally in your browser (nothing is sent anywhere)

## Installation

### Method 1: Manual Installation (Development)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select the `chrome-extension-timesheet-reminder` folder
6. The extension should now appear in your extensions list

### Method 2: Chrome Web Store

*(Coming soon)*

## Testing

The reminder scheduling, storage, and background worker logic have a unit test suite (Node's built-in test runner, no dependencies to install):

```
npm test
```

This covers recurrence/trigger calculation, snooze/acknowledge state, storage CRUD, and the background worker's alarm and message handling, using an in-memory mock of the `chrome.*` APIs. Run it after any change to `src/utils/`, `src/background/background-worker.js`, or the URL/recurrence validation in `src/settings/settings.js`, to catch regressions before loading the extension in Chrome.

## Usage

### The Toolbar Popup

Click the extension icon in your Chrome toolbar to open a quick-glance dashboard: your configured reminders with their next scheduled time (live countdown), plus buttons to jump to the full Settings page, clear all acknowledgements, or clear all snooze counts.

### Open the Settings Page

Click **Open Settings** in the toolbar popup (or `chrome.runtime` → open `src/settings/settings.html` directly while developing) to manage reminders, timezone, and snooze behavior.

### Add a New Reminder

1. In Settings, click **+ Add Reminder**
2. Enter your reminder message
3. Optionally set an **Action Button Name** and **Action URL** (e.g. your timesheet link) — if both are set, the reminder popup shows a button that opens that URL in a new tab
4. Select a recurrence type:
   - **Minutely** — Repeats every N minutes (1–120), aligned to the hour (e.g. every 5 minutes means `:00, :05, :10, ...`)
   - **Daily** — Repeats every day at a specified time
   - **Weekly** — Repeats on one or more selected days of the week
   - **Monthly** — Repeats on a specific day of the month (1–28)
5. Set the time (and day(s), where applicable)
6. Click **Save Reminder**

### Acknowledge or Snooze a Reminder

When a reminder popup appears on a webpage:
- **Acknowledge** — Dismiss the reminder; it won't show again until its next scheduled occurrence
- **Snooze** — Postpone for the configured snooze duration (default 15 minutes), up to the configured max snooze count
- The optional action button — Opens the reminder's configured URL in a new tab (only shown if one is set)

### Edit or Delete Reminders

1. Go to the Settings page
2. Find the reminder in your reminders list
3. Click **Edit** to modify it or **Delete** to remove it

### Snooze Settings

In Settings, under **Timezone** you can also configure:
- **Snooze Interval** — How many minutes a snooze lasts
- **Max Snooze Count Per Reminder** — How many times a given reminder can be snoozed before it must be acknowledged

### Reset Settings

- Click **Reset to System Timezone** to restore your system's auto-detected timezone
- Click **Clear All Reminders** to delete all reminders (cannot be undone)

## Storage

All data is stored locally via `chrome.storage.local` — nothing leaves your browser:

```js
chrome.storage.local.get(['reminders', 'userPreferences'])
// reminders: [
//   {
//     id: 'reminder-xxx',
//     message: 'Time to fill your timesheet!',
//     actionButtonLabel: 'Open Timesheet',
//     actionUrl: '',
//     recurrence: { type: 'weekly', daysOfWeek: [5], hour: 15, minute: 0 },
//     enabled: true,
//     lastShown: null,
//     lastTriggeredAt: null,
//     snoozedUntil: null,
//     snoozeCount: 0
//   }
// ]
//
// userPreferences: {
//   timezone: 'America/New_York',
//   snoozeDuration: 15,
//   maxSnoozeCount: 3
// }
```

## Project Structure

```
chrome-extension-timesheet-reminder/
├── manifest.json                    # Extension configuration
├── package.json                     # `npm test` entry point (no runtime deps)
├── README.md                        # This file
├── src/
│   ├── background/
│   │   └── background-worker.js     # Service worker (scheduling logic)
│   ├── content/
│   │   ├── content-script.js        # Content script (popup injection)
│   │   └── popup-template.html      # Markup for the injected reminder modal
│   ├── popup/
│   │   ├── popup.html               # Toolbar dashboard UI
│   │   ├── popup.js                 # Toolbar dashboard logic
│   │   └── popup.css                # Toolbar dashboard styles
│   ├── settings/
│   │   ├── settings.html            # Settings page UI
│   │   ├── settings.js              # Settings page logic
│   │   └── reminders-manager.js     # CRUD helpers
│   ├── styles/
│   │   ├── settings.css             # Settings page styles
│   │   └── popup-modal.css          # Injected reminder modal styles
│   └── utils/
│       ├── timezone.js              # Timezone utilities
│       ├── recurrence.js            # Recurrence calculation
│       ├── storage.js               # chrome.storage.local wrapper
│       └── time-checker.js          # Reminder trigger logic
├── test/                            # Unit tests (node --test), see "Testing"
└── assets/
    ├── icon.svg                      # Icon source
    └── icon-{16,32,48,128}.png       # Generated extension icons
```

## How It Works

### 1. Background Service Worker
- Runs in the background; a `chrome.alarms` alarm wakes it at the earliest upcoming reminder time (not a fixed every-minute poll)
- When a reminder is due, it sends a message to every open tab's content script to show the popup
- Re-checks for due/missed reminders on browser startup and whenever reminders/preferences change, so a reminder whose time passed while the browser was closed or asleep still fires once it's reopened, instead of being silently skipped

### 2. Content Script
- Runs on every page (`<all_urls>`), listening for messages from the background worker
- Injects a styled modal popup into the current webpage when a reminder is due
- Handles user interactions:
  - **Acknowledge** — Marks the reminder as shown
  - **Snooze** — Postpones the reminder for the configured snooze duration
  - **Action button** (optional, per-reminder) — Opens the configured URL in a new tab

### 3. Toolbar Popup & Settings Page
- The toolbar popup (`src/popup`) is a quick dashboard: reminders, their next-check countdown, and bulk actions
- The settings page (`src/settings`, opened from the popup) manages timezone, snooze configuration, and full reminder CRUD

## Supported Recurrence Patterns

### Minutely
- Triggers every N minutes (1–120), aligned to the hour
- Example: every 5 minutes → 00, 05, 10, 15, ...

### Daily
- Triggers at the same time every day
- Example: 9:30 AM every day

### Weekly
- Triggers on one or more selected days of the week
- Example: Monday, Wednesday, and Friday at 3:00 PM

### Monthly
- Triggers on a specific day of the month (1–28)
- Limited to days 1–28 so it works consistently every month, including February

## Timezone Handling

- **Auto-detection** — The extension detects your system timezone automatically on first install
- **Manual Override** — You can change the stored timezone in Settings
- **Calculation** — All reminder times are calculated against the configured timezone, not necessarily your browser's live current timezone if you've travelled and not reset it

## Limitations & Known Issues

- If the browser is completely closed when a reminder's time arrives, it fires as soon as the browser (and this extension's service worker) is next running — there is no OS-level notification while Chrome itself isn't running
- Monthly reminders are limited to days 1–28 (so they work consistently every month, including February)
- There is no `chrome.notifications` fallback — reminders only show as an in-page popup, so they won't appear if you have no browser tabs open at all when the alarm fires (they'll still catch up once a tab exists)

## Troubleshooting

### Reminder not triggering
1. Check that the extension is enabled in `chrome://extensions/`
2. Verify the reminder's time and recurrence pattern in Settings
3. Make sure the reminder itself is enabled (not toggled off)
4. Make sure you have at least one regular webpage tab open — the popup is injected into tabs, not shown as a system notification

### Can't see the popup on some websites
- The content script runs on all pages, but a small number of special pages (e.g. the Chrome Web Store, `chrome://` pages, or a page you had open before installing/reloading the extension) won't have it injected
- Try a different, ordinary webpage to confirm reminders are working

### Lost reminders after reinstalling or clearing data
- Reminders are stored in `chrome.storage.local`, scoped to the extension
- They're lost only if you remove/reinstall the extension or explicitly clear its storage — not by clearing a website's cookies/localStorage

### Action button/link not opening
1. Verify the Action URL is a valid `http://` or `https://` URL (other schemes, like `javascript:`, are rejected)
2. Check your browser's popup-blocker settings
3. Make sure the URL is reachable from your browser

## Future Enhancements

- [ ] `chrome.notifications` fallback for when no tab is open
- [ ] Reminder history/logs
- [ ] Cloud sync across devices
- [ ] Firefox support
- [ ] Recurring reminder templates
- [ ] Reminder categories

## Permissions

This extension requires:
- `storage` — Save reminders and settings locally
- `alarms` — Schedule reminder checks
- `<all_urls>` (host permission) — Inject reminder popups on any website

No data is collected, transmitted, or sent to any server — everything stays in `chrome.storage.local` on your own machine.

## License

MIT License - Feel free to modify and use

## Support

For issues, feature requests, or questions:
1. Check the Troubleshooting section above
2. Review the project structure and code
3. Open an issue on GitHub

If this extension has saved you from a missed timesheet, you can [support development on Ko-fi](https://ko-fi.com/kipergil) — entirely optional, the extension is free and fully functional without it.

---

**Enjoy your timesheet reminders! 🎯**
