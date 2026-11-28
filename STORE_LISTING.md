# Chrome Web Store listing — draft copy

Reference material for the Chrome Web Store Developer Dashboard submission. Not used by the extension itself; paste the relevant pieces into the dashboard fields when submitting.

## Category

**Productivity**

## Short description (max 132 characters)

```
Get a friendly on-page popup reminder to fill your timesheet, on whatever schedule you set — daily, weekly, or monthly.
```
(120 characters)

## Detailed description

```
Timesheet Reminder shows a friendly popup reminder — right on whatever page you're browsing — so you never forget to fill in your timesheet again.

FEATURES
• Set as many reminders as you like, each with its own schedule
• Daily, weekly (pick any day(s)), monthly (day 1–28), or every-N-minutes recurrence
• Optional action button on each reminder that opens your own timesheet URL in a new tab
• Snooze a reminder for a configurable number of minutes, with a configurable snooze limit
• Automatic timezone detection, with manual override
• Catches up on reminders that were due while your browser was closed — no OS notifications required

PRIVACY
Timesheet Reminder has no server and makes no network requests. Everything you configure — reminders, schedules, preferences — is stored locally in your browser via chrome.storage.local and never leaves your device. See the full privacy policy: <INSERT HOSTED PRIVACY POLICY URL HERE>

This extension is free and open source. Source code: https://github.com/kipergil/chrome-extention-timesheet-reminder
```

## Privacy practices tab

**Single purpose description:**
```
Shows the user a configurable, recurring on-page popup reminder (e.g. to fill in a timesheet) at times they set, with snooze/acknowledge controls and an optional link to their own timesheet URL.
```

**Permission justifications:**

| Permission | Justification |
|---|---|
| `storage` | Saves the user's reminders and preferences locally so they persist across browser restarts. |
| `alarms` | Wakes the background service worker at the scheduled time to check whether a reminder is due, without polling constantly. |
| Host permission: all sites (`<all_urls>`) | The reminder is shown as a popup injected into the page the user currently has open, so it can appear no matter which site they're browsing when a reminder is due. The content script does not read or transmit page content — it only displays the reminder UI and relays the user's acknowledge/snooze/open-link actions back to the extension's own background worker. |

**Remote code:** This extension does not execute any remote code. All JavaScript ships inside the extension package.

**Data usage:** This extension does not collect or transmit any user data. (Select "I do not collect or use user data" and leave every data-type category unchecked.)

**Privacy policy URL:** Host `PRIVACY_POLICY.md` somewhere publicly reachable (e.g. GitHub Pages, or the raw GitHub file URL) and paste that URL here. A repo file path alone will not satisfy the Store's requirement — it must be a live URL.

## Screenshots / promotional images

Not included here — these need actual screenshots of the extension running (the toolbar popup, the settings page, and a reminder popup on a sample page). Capture them locally (1280×800 or 640×400 px, PNG/JPEG) before submitting; the dashboard requires at least one.

## Pre-submission checklist

- [ ] Icons present at 16/32/48/128px as real PNGs (fixed — see `assets/`)
- [ ] `manifest.json` validates and only requests permissions actually used
- [ ] Privacy policy written (`PRIVACY_POLICY.md`) and hosted at a public URL
- [ ] At least one real screenshot of the extension in use
- [ ] Zip the repo contents (not the repo folder itself) for upload, excluding `.git/`, `test/`, `node_modules/`, and the `*.md` docs if you'd rather keep the package lean
- [ ] $5 one-time Chrome Web Store developer registration fee paid (if not already)
- [ ] Test the packed `.zip` by loading it unpacked one more time before upload
