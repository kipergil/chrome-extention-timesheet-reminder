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
   - Timesheet Reminder icon should appear in toolbar
   - Check extension is enabled (toggle switch is ON)

## First Run

1. **Initial Setup**
   - Default reminder is created: **Friday at 3:00 PM**
   - Your system timezone is auto-detected
   - All settings saved to browser localStorage

2. **Access Settings**
   - Click the Timesheet Reminder icon in toolbar
   - Or right-click extension → Options (if available)
   - Settings page opens in new tab

## Quick Test

### Test 1: See Current Settings
1. Open settings page (click extension icon)
2. View current timezone
3. See the default Friday 3 PM reminder listed

### Test 2: Add Timesheet URL
1. Scroll to "Timesheet URL" section
2. Enter example: `https://www.google.com`
3. Click "Save Timesheet URL"
4. Should see "Saved!" message

### Test 3: Create Test Reminder
1. Click "+ Add Reminder" button
2. Enter message: "Test reminder"
3. Select "Daily"
4. Set time to 1 minute from now (e.g., if it's 14:30, set 14:31)
5. Click "Save Reminder"
6. Reminder should appear in list

### Test 4: Trigger Reminder
1. Open any webpage (e.g., google.com)
2. Wait for reminder time to arrive
3. Should see popup modal appear with:
   - Your reminder message
   - "Acknowledge" button
   - "Snooze (15 min)" button
   - "Open Timesheet" button (if URL was set)
4. Click each button to test:
   - **Acknowledge** — Popup closes, reminder won't show again today
   - **Snooze** — Popup closes, reminder snoozed for 15 minutes
   - **Open Timesheet** — Opens your configured URL in new tab

### Test 5: Settings Persistence
1. Close browser completely
2. Reopen Chrome
3. Check extension settings — all reminders and URL should still be there

## Troubleshooting During Testing

### Reminder Not Showing
- Check if extension is enabled (green toggle)
- Verify the time you set has passed
- Open browser Developer Tools (F12) → Console to see any errors
- Check that you have a webpage open when reminder should trigger

### Can't see popup
- Try different website (some block popups)
- Check browser popup blocker settings
- Check browser notifications settings

### Settings not saving
- Ensure you click "Save" buttons
- Check browser allows localStorage (Privacy settings)
- Try clearing browsing data and reinstalling

### Icon not visible
- Icon is SVG format, should show as clock
- Reload extension (turn off/on toggle)
- If still not visible, that's fine - functionality works

## Extension Commands

### Settings
- Click extension icon → Opens settings page

### Manual Refresh
1. Go to `chrome://extensions/`
2. Click reload icon on Timesheet Reminder card
3. Extension reloads with latest code

### View Logs
1. Go to `chrome://extensions/`
2. Find Timesheet Reminder
3. Click "Service worker" link
4. Developer Tools opens showing background worker logs

## Files to Know About

```
For Developers:
- manifest.json          → Extension config, permissions
- src/background/       → Background worker (reminder checking)
- src/content/          → Content script (popup injection)
- src/settings/         → Settings page UI & logic
- src/utils/            → Timezone, recurrence, storage helpers
- src/styles/           → CSS styling
```

## Next Steps

1. ✅ Extension installed and working
2. ✅ Settings configured
3. ✅ Test reminders created
4. 📝 Customize reminders for your actual needs
5. 📝 Add your real timesheet URL
6. 📝 Disable default Friday reminder if not needed

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Manifest parsing error" | Reload extension, check manifest.json syntax |
| Reminders not triggering | Verify time is in future, check browser time is correct |
| Popup doesn't appear | Website might block injected content, try different site |
| Settings lost after restart | Browser cache cleared, reinstall and reconfigure |
| Can't open timesheet URL | Verify URL is valid and accessible |

## Tips

- 💡 Use "Snooze" if you need more time before accessing timesheet
- 💡 Set multiple reminders for different days/times
- 💡 Test with a reminder 1-2 minutes away first
- 💡 Browser must be running for reminders to trigger
- 💡 Reload extension in Settings → Developer mode if code updated
- 💡 Check Console tab (F12) for any error messages

---

**Happy timesheet tracking! ⏰**
