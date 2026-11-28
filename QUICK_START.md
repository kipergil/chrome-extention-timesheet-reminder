# Quick Start Guide

## Installation for Development

1. **Open Chrome Extensions Page**
   - Go to `chrome://extensions/`
   - Or use menu: ⋮ → More tools → Extensions

2. **Enable Developer Mode**
   - Toggle "Developer mode" in top-right corner

3. **Load Extension**
   - Click "Load unpacked"
   - Navigate to the `chrome-extension-timesheet-reminder` folder
   - Click "Select Folder"

4. **Verify Installation**
   - Extension should appear in your extensions list
   - Timesheet Reminder clock icon should appear in the toolbar
   - Check extension is enabled (toggle switch is ON)

## First Run

1. **Initial Setup**
   - A default reminder is created: **Friday at 3:00 PM** (weekly)
   - Your system timezone is auto-detected
   - All settings are saved via `chrome.storage.local` (local to your browser, not synced or sent anywhere)

2. **Open the Popup / Settings**
   - Click the Timesheet Reminder icon in the toolbar to open the quick-glance popup (lists your reminders and their next trigger time)
   - Click **Open Settings** inside that popup to manage reminders, timezone, and snooze behavior

## Quick Test

### Test 1: See Current Settings
1. Click the extension icon, then **Open Settings**
2. View the current timezone
3. See the default Friday 3 PM reminder listed

### Test 2: Create a Test Reminder with an Action Button
1. Click "+ Add Reminder"
2. Enter message: "Test reminder"
3. Enter an Action Button Name, e.g. `Open Timesheet`
4. Enter an Action URL, e.g. `https://www.google.com`
5. Select "Daily"
6. Set the time to 1–2 minutes from now (e.g., if it's 14:30, set 14:32)
7. Click "Save Reminder" — it should appear in the list with a live countdown to its next check

### Test 3: Trigger the Reminder
1. Open any ordinary webpage (e.g., google.com)
2. Wait for the reminder time to arrive
3. You should see a popup modal appear with:
   - Your reminder message
   - "Acknowledge" button
   - "Snooze N min (0/3)" button (N = your configured snooze duration, default 15)
   - Your action button, labeled with what you set (only shown if both label and URL were set)
4. Click each button to test:
   - **Acknowledge** — Popup closes; the reminder won't fire again until its next scheduled occurrence
   - **Snooze** — Popup closes; reminder re-fires after the snooze duration, up to the configured max snooze count
   - **Action button** — Opens your configured URL in a new tab

### Test 4: Settings Persistence
1. Close the browser completely
2. Reopen Chrome
3. Check the extension's settings — all reminders should still be there, and anything due while the browser was closed should fire once it reopens

## Troubleshooting During Testing

### Reminder Not Showing
- Check if the extension is enabled (toggle is on) in `chrome://extensions/`
- Verify the time you set has passed, in the timezone shown in Settings
- Open the service worker's console (see "View Logs" below) for errors
- Make sure you have at least one ordinary webpage tab open — reminders are shown as an in-page popup, not a system notification

### Can't see the popup
- Try a different website — a page open before the extension was loaded/reloaded won't have the content script injected until it's refreshed
- `chrome://` pages and the Chrome Web Store don't allow content script injection at all

### Settings not saving
- Make sure you click the relevant "Save" button
- Check `chrome://extensions/` → the extension's "Errors" button for any storage errors
- Try reloading the extension from `chrome://extensions/`

## Extension Commands

### Open the Popup / Settings
- Click the toolbar icon → opens the quick-glance popup → click "Open Settings" for the full settings page

### Manual Refresh
1. Go to `chrome://extensions/`
2. Click the reload icon on the Timesheet Reminder card
3. Extension reloads with the latest code

### View Logs
1. Go to `chrome://extensions/`
2. Find Timesheet Reminder
3. Click the "service worker" link
4. DevTools opens, showing the background worker's console logs

## Files to Know About

```
For Developers:
- manifest.json          → Extension config, permissions
- src/background/       → Background worker (reminder scheduling/triggering)
- src/content/           → Content script (popup injection into webpages)
- src/popup/             → Toolbar popup dashboard
- src/settings/          → Settings page UI & logic (reminder CRUD, timezone, snooze)
- src/utils/              → Timezone, recurrence, storage helpers
- src/styles/             → CSS styling
- test/                   → Unit tests (`npm test`)
```

## Next Steps

1. ✅ Extension installed and working
2. ✅ Settings configured
3. ✅ Test reminders created
4. 📝 Customize reminders for your actual needs
5. 📝 Add your real timesheet URL as an action button on the reminders that need it
6. 📝 Disable or edit the default Friday reminder if it doesn't fit your schedule

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Manifest parsing error" | Reload the extension; check `manifest.json` syntax |
| Reminders not triggering | Verify the time is in the future, in your configured timezone |
| Popup doesn't appear | Refresh the page so the content script loads, or try a different ordinary webpage |
| Settings lost | Check whether the extension was removed/reinstalled — storage is scoped to the extension, not cleared by a website's own data |
| Action button not opening | Verify the Action URL is a valid `http://`/`https://` URL |

## Tips

- 💡 Use "Snooze" if you need more time before accessing your timesheet
- 💡 Set multiple reminders for different days/times, each with its own optional action link
- 💡 Test with a reminder 1–2 minutes away first
- 💡 The browser (and this extension's background service worker) must run at least once after the scheduled time for a reminder to fire — it catches up on the next startup if it missed the exact moment
- 💡 Reload the extension from `chrome://extensions/` after code changes
- 💡 Check the service worker's console (see "View Logs") for background errors, and a page's own DevTools console (F12) for content-script errors

---

**Happy timesheet tracking! ⏰**
