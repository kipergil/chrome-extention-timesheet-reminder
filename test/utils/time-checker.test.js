import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createChromeMock } from '../helpers/chrome-mock.js';
import { withFixedNow } from '../helpers/fake-time.js';
import {
  getReminderNextCheckTimestamp,
  getEarliestNextReminderTimestamp,
  getRemindersThatShouldTrigger,
  getMissedReminders,
  markReminderAsShown,
  snoozeReminder
} from '../../src/utils/time-checker.js';

beforeEach(() => {
  globalThis.chrome = createChromeMock();
});

describe('getReminderNextCheckTimestamp', () => {
  test('returns null for a disabled reminder', () => {
    const reminder = { enabled: false, recurrence: { type: 'daily', hour: 9, minute: 0 } };
    assert.equal(getReminderNextCheckTimestamp(reminder, 'UTC', Date.now()), null);
  });

  test('returns the snoozedUntil timestamp while still in the future', () => {
    const nowMs = Date.UTC(2026, 6, 24, 10, 0, 0);
    const snoozedUntil = nowMs + 60000;
    const reminder = { enabled: true, snoozedUntil, recurrence: { type: 'daily', hour: 9, minute: 0 } };
    assert.equal(getReminderNextCheckTimestamp(reminder, 'UTC', nowMs), snoozedUntil);
  });

  test('returns "now" once a snooze has expired', () => {
    const nowMs = Date.UTC(2026, 6, 24, 10, 0, 0);
    const reminder = { enabled: true, snoozedUntil: nowMs - 1000, recurrence: { type: 'daily', hour: 9, minute: 0 } };
    assert.equal(getReminderNextCheckTimestamp(reminder, 'UTC', nowMs), nowMs);
  });

  test('falls back to the next scheduled trigger time when not snoozed', async () => {
    await withFixedNow([2026, 6, 24, 8, 0, 0], () => {
      const nowMs = Date.now();
      const reminder = { enabled: true, snoozedUntil: null, recurrence: { type: 'daily', hour: 9, minute: 0 } };
      const result = getReminderNextCheckTimestamp(reminder, 'UTC', nowMs);
      assert.equal(result, Date.UTC(2026, 6, 24, 9, 0, 0));
    });
  });
});

describe('getEarliestNextReminderTimestamp', () => {
  test('picks the soonest timestamp among several reminders', async () => {
    // Note: for non-snoozed reminders the "next check" is computed from the
    // real clock (getNextTriggerTime doesn't take a now override), so the
    // clock must be frozen for this to be deterministic.
    await withFixedNow([2026, 6, 24, 8, 0, 0], () => {
      const nowMs = Date.now();
      const reminders = [
        { enabled: true, recurrence: { type: 'daily', hour: 20, minute: 0 } },
        { enabled: true, recurrence: { type: 'daily', hour: 9, minute: 0 } },
        { enabled: false, recurrence: { type: 'daily', hour: 8, minute: 30 } }
      ];
      const earliest = getEarliestNextReminderTimestamp(reminders, 'UTC', nowMs);
      assert.equal(earliest, Date.UTC(2026, 6, 24, 9, 0, 0));
    });
  });

  test('returns null when there are no schedulable reminders', () => {
    assert.equal(getEarliestNextReminderTimestamp([], 'UTC', Date.now()), null);
  });
});

describe('getRemindersThatShouldTrigger', () => {
  test('excludes disabled reminders', async () => {
    await chrome.storage.local.set({
      reminders: [
        { id: 'a', enabled: false, recurrence: { type: 'daily', hour: 9, minute: 0 } }
      ],
      userPreferences: { timezone: 'UTC' }
    });
    const result = await getRemindersThatShouldTrigger();
    assert.deepEqual(result, []);
  });

  test('excludes reminders that are still snoozed', async () => {
    const future = Date.now() + 100000;
    await chrome.storage.local.set({
      reminders: [
        { id: 'a', enabled: true, snoozedUntil: future, recurrence: { type: 'daily', hour: 0, minute: 0 } }
      ],
      userPreferences: { timezone: 'UTC' }
    });
    const result = await getRemindersThatShouldTrigger();
    assert.deepEqual(result, []);
  });

  test('includes reminders whose snooze has expired', async () => {
    const past = Date.now() - 1000;
    await chrome.storage.local.set({
      reminders: [
        { id: 'a', enabled: true, snoozedUntil: past, recurrence: { type: 'daily', hour: 0, minute: 0 } }
      ],
      userPreferences: { timezone: 'UTC' }
    });
    const result = await getRemindersThatShouldTrigger();
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'a');
  });
});

describe('getMissedReminders', () => {
  test('returns enabled reminders that have never been shown', async () => {
    await chrome.storage.local.set({
      reminders: [
        { id: 'a', enabled: true, lastShown: null },
        { id: 'b', enabled: true, lastShown: Date.now() },
        { id: 'c', enabled: false, lastShown: null }
      ]
    });
    const result = await getMissedReminders();
    assert.deepEqual(result.map((r) => r.id), ['a']);
  });
});

describe('markReminderAsShown / snoozeReminder', () => {
  test('markReminderAsShown sets lastShown and clears snoozedUntil', async () => {
    await chrome.storage.local.set({
      reminders: [{ id: 'a', enabled: true, lastShown: null, snoozedUntil: 12345 }]
    });
    await markReminderAsShown('a');
    const { reminders } = chrome._test.store;
    assert.ok(reminders[0].lastShown > 0);
    assert.equal(reminders[0].snoozedUntil, null);
  });

  test('snoozeReminder sets snoozedUntil roughly 15 minutes out', async () => {
    await chrome.storage.local.set({
      reminders: [{ id: 'a', enabled: true, snoozedUntil: null }]
    });
    const before = Date.now();
    await snoozeReminder('a');
    const { reminders } = chrome._test.store;
    const delta = reminders[0].snoozedUntil - before;
    assert.ok(delta > 14 * 60 * 1000 && delta <= 15 * 60 * 1000 + 1000);
  });
});
