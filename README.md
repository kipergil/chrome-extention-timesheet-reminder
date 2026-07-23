# Timesheet Reminder Chrome Extension

A Chrome extension that sends friendly reminders to fill your timesheet at configured times. Set multiple reminders for any day and time with support for daily, weekly, and monthly recurrence.

## Features

✅ **Customizable Reminders** — Add multiple reminders with different schedules
✅ **Multiple Recurrence Types** — Daily, weekly (specific day), or monthly
✅ **Timezone Support** — Auto-detects your timezone, with option to override
✅ **Friendly Popup** — Centered modal notification on any webpage
✅ **Snooze Option** — Snooze for 15 minutes if you need more time
✅ **Timesheet URL** — Quickly access your timesheet with a dedicated button
✅ **Browser Notifications** — Fallback notifications if no tab is active
✅ **Persistent Storage** — Reminders and settings survive browser restarts
✅ **Easy Management** — Dedicated settings page for managing all reminders

## Default Behavior

When you first install the extension:
- A default reminder is created for **Friday at 3:00 PM** (15:00)
- Your system timezone is automatically detected
- Reminders are stored locally in your browser

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

### Open Settings

Click the extension icon in your Chrome toolbar to open the settings page.

### Add a New Reminder

1. Click the "Add Reminder" button
2. Enter your reminder message
3. Select recurrence type:
   - **Daily** — Repeats every day at specified time
   - **Weekly** — Repeats on a specific day each week
   - **Monthly** — Repeats on a specific day each month (1-28)
4. Set the time (hour and minute)
5. Click "Save Reminder"

### Configure Timesheet URL

1. In the settings page, scroll to "Timesheet URL" section
2. Enter your timesheet application URL (e.g., `https://example.com/timesheet`)
3. Click "Save Timesheet URL"
4. When a reminder popup appears, you'll see an "Open Timesheet" button

### Acknowledge or Snooze a Reminder

When a reminder popup appears:
- **Acknowledge** — Dismiss the reminder (won't show again today)
- **Snooze** — Dismiss for 15 minutes
- **Open Timesheet** — Open your timesheet URL in a new tab

### Edit or Delete Reminders

1. Go to settings page
2. Find the reminder in your reminders list
3. Click "Edit" to modify or "Delete" to remove

### Reset Settings

- Click "Reset to System Timezone" to restore auto-detected timezone
- Click "Clear All Reminders" to delete all reminders (cannot be undone)

## Storage

All data is stored locally in your browser using localStorage:

```
localStorage['reminders'] = [
  {
    id: 'reminder-xxx',
    message: 'Time to fill your timesheet!',
    recurrence: {type: 'weekly', dayOfWeek: 5, hour: 15, minute: 0},
    lastShown: timestamp,
    enabled: true
  }
]

localStorage['userPreferences'] = {
  timezone: 'America/New_York',
  notificationsEnabled: true,
  snoozeDuration: 15,
  timesheetUrl: 'https://...'
}
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
│   │   └── content-script.js        # Content script (popup injection)
│   ├── settings/
│   │   ├── settings.html            # Settings page UI
│   │   ├── settings.js              # Settings page logic
│   │   └── reminders-manager.js     # CRUD helpers
│   ├── styles/
│   │   ├── settings.css             # Settings page styles
│   │   └── popup-modal.css          # (Injected inline in content-script)
│   └── utils/
│       ├── timezone.js              # Timezone utilities
│       ├── recurrence.js            # Recurrence calculation
│       ├── storage.js               # Storage wrapper
│       └── time-checker.js          # Reminder trigger logic
├── test/                            # Unit tests (node --test), see "Testing"
└── assets/
    └── icon-128.png                 # Extension icon
```

## How It Works

### 1. Background Service Worker
- Runs in the background and checks every minute if any reminder should trigger
- When a reminder is due:
  - Sends message to all content scripts to show popup
  - Sends browser notification as fallback
- Checks for missed reminders on browser startup

### 2. Content Script
- Listens for messages from background worker
- Injects styled modal popup into current webpage
- Handles user interactions:
  - **Acknowledge** — Marks reminder as shown
  - **Snooze** — Postpones reminder for 15 minutes
  - **Open Timesheet** — Opens configured URL in new tab

### 3. Settings Page
- Accessible via extension icon click
- Manage timesheet URL
- Add/edit/delete reminders
- View all configured reminders
- Clear all data if needed

## Supported Recurrence Patterns

### Daily
- Triggers at same time every day
- Example: 9:30 AM every day

### Weekly
- Triggers on specific day of week
- Example: Friday at 3:00 PM

### Monthly
- Triggers on specific day of month (1-28)
- Limited to days 1-28 to work consistently every month
- Example: 1st of every month at 9:00 AM

## Timezone Handling

- **Auto-detection** — Extension detects your system timezone automatically
- **Manual Override** — You can change timezone in settings
- **Calculation** — All reminder times are calculated in your configured timezone

## Browser Notifications

The extension sends browser notifications as a fallback when:
- No tab is currently visible/focused
- No content script response within 2 seconds

You can disable notifications in the settings page (future enhancement).

## Limitations & Known Issues

- Reminders won't trigger if browser is completely closed (will trigger on next browser startup)
- Monthly reminders limited to days 1-28 (February edge case)
- Snooze duration is fixed at 15 minutes (configurable in preferences)
- Extension works on Chrome 127+ (Manifest v3 requirement)
- Timezone detection uses Intl API (should work on all modern browsers)

## Troubleshooting

### Reminder not triggering
1. Check if extension is enabled in `chrome://extensions/`
2. Verify reminder time and recurrence pattern in settings
3. Check if browser notifications are blocked in Chrome settings
4. Ensure reminder is enabled (not disabled toggle in settings)

### Can't see popup on some websites
- Some websites with strict CSP policies might block injection
- Try accessing a different website to test
- Browser notifications should still work as fallback

### Lost reminders after browser restart
- All reminders are stored in localStorage
- Only lost if you clear browser data/cache
- Check Settings > Privacy > Clear browsing data

### Timesheet URL not opening
1. Verify URL is valid and starts with `http://` or `https://`
2. Check browser popup blocker settings
3. Ensure URL is accessible in your browser

## Future Enhancements

- [ ] Sound alerts for reminders
- [ ] Custom snooze duration
- [ ] Reminder history/logs
- [ ] Cloud sync across devices
- [ ] Firefox support
- [ ] Recurring reminder templates
- [ ] Reminder categories
- [ ] Time zone conversion display

## Permissions

This extension requires:
- `storage` — Save reminders and settings
- `alarms` — Schedule reminder checks
- `<all_urls>` (host permission) — Inject reminder popups on any website

## License

MIT License - Feel free to modify and use

## Support

For issues, feature requests, or questions:
1. Check the Troubleshooting section above
2. Review the project structure and code
3. Open an issue on GitHub

---

**Enjoy your timesheet reminders! 🎯**
