# Privacy Policy — Timesheet Reminder

_Last updated: 2026-11-28_

Timesheet Reminder is a Chrome extension that shows you a reminder popup at times you configure, so you don't forget to fill in your timesheet.

## Summary

**This extension does not collect, transmit, sell, or share any of your data with anyone, including its developer.** It has no server, no analytics, and no third-party integrations. Everything it stores stays on your own device.

## What the extension stores, and where

The extension uses the browser's built-in `chrome.storage.local` API to save, only on your own device:

- **Reminders you create** — message text, schedule (day/time/recurrence), and an optional action button label/URL you choose to add (e.g. a link to your own timesheet system)
- **Your preferences** — timezone, snooze duration, and max snooze count
- **Reminder state** — whether a reminder is currently snoozed, when it was last shown/acknowledged, and how many times it's been snoozed

None of this is sent to any server. It is not synced to a Google account, not visible to other websites, and not accessible to the developer. Uninstalling the extension (or clearing its storage from `chrome://extensions/`) permanently deletes it.

## Why the extension requests the permissions it does

- **`storage`** — To save your reminders and preferences locally, as described above.
- **`alarms`** — To wake the extension's background service worker at the right time to check whether a reminder is due, without needing to run constantly.
- **Host permission `<all_urls>`** (to run the content script on all websites) — The reminder popup is shown by injecting a small modal into the page you currently have open, so that it works no matter which website you're on at the time a reminder is due. The content script only reads messages from the extension's own background worker and injects the reminder modal; it does not read, modify, or transmit the content of the pages you visit.

## Third parties

The extension makes no network requests to any server, first-party or third-party, and includes no analytics, advertising, or tracking code of any kind.

The settings page includes an optional, user-initiated link to the developer's Ko-fi page for those who'd like to support development. Clicking it opens Ko-fi (a third-party site) in a new tab; Ko-fi's own privacy policy applies to that site, not to this extension. The extension itself never contacts Ko-fi or any other service on its own.

## Changes to this policy

If this policy changes, the updated version will be published at this same location with a new "Last updated" date.

## Contact

Questions about this extension or this policy can be raised via an issue on the project's GitHub repository.
