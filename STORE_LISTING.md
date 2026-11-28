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

Generated and ready to upload, in `store-assets/`:

| File | Size | Use |
|---|---|---|
| `store-assets/screenshots/screenshot-1-reminder-popup.png` | 1280×800 | Hero shot — the reminder popup injected on a sample page |
| `store-assets/screenshots/screenshot-2-settings.png` | 1280×800 | Settings page with multiple reminders configured |
| `store-assets/screenshots/screenshot-3-add-reminder.png` | 1280×800 | Add/Edit Reminder modal, showing recurrence options |
| `store-assets/screenshots/screenshot-4-popup-dashboard.png` | 1280×800 | Toolbar popup dashboard, composited into a browser-chrome mockup |
| `store-assets/promo/promo-tile-440x280.png` | 440×280 | Optional small promo tile |

All screenshots use seeded sample data and a local mock "Internal Tools Portal" demo page (not a real company/site) — no real timesheet data or third-party branding is depicted. Upload up to 5 screenshots; the dashboard requires at least one. The marquee promo tile (1400×560) is optional and only used if your listing is ever featured — not generated here, since it's rarely needed for a first submission.

## Building the upload package

```
npm run package
```

This runs the test suite, validates `manifest.json` (every icon/script/resource path it references must exist on disk), copies only the runtime files the extension needs into `build/package/`, and zips it as `build/timesheet-reminder-v<version>.zip` with `manifest.json` at the zip root — exactly what the Developer Dashboard's upload expects. Pass `--skip-tests` to skip the test run, or `--out-dir=<dir>` to change where it writes. See `scripts/build-package.mjs`.

The script was also used to verify the packaged zip by unzipping it and loading *that* directory (not the source tree) as an unpacked extension — confirming the file list in the script's allow-list is complete and nothing extra is needed.

## Pre-submission checklist

- [x] Icons present at 16/32/48/128px as real PNGs (fixed — see `assets/`)
- [x] `manifest.json` validates and only requests permissions actually used
- [x] Screenshots and a promo tile generated (see above)
- [x] Build script produces a verified, store-ready zip (`npm run package`)
- [ ] Privacy policy (`PRIVACY_POLICY.md`) hosted at a public URL (e.g. GitHub Pages) and pasted into the dashboard's privacy policy field — a repo file path alone will not satisfy this requirement
- [ ] $5 one-time Chrome Web Store developer registration fee paid (if not already)
- [ ] Run `npm run package`, then actually submit `build/timesheet-reminder-v<version>.zip` on the Developer Dashboard
