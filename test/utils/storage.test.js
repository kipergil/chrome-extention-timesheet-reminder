import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createChromeMock } from '../helpers/chrome-mock.js';
import {
  getReminders,
  setReminders,
  addReminder,
  updateReminder,
  updateReminders,
  deleteReminder,
  getUserPreferences,
  setUserPreferences,
  initializeDefaultReminders
} from '../../src/utils/storage.js';

beforeEach(() => {
  globalThis.chrome = createChromeMock();
});

describe('reminders CRUD', () => {
  test('getReminders returns an empty array when nothing is stored', async () => {
    assert.deepEqual(await getReminders(), []);
  });

  test('addReminder assigns an id and fills in defaults', async () => {
    const id = await addReminder({ recurrence: { type: 'daily', hour: 9, minute: 0 } });
    const reminders = await getReminders();
    assert.equal(reminders.length, 1);
    assert.equal(reminders[0].id, id);
    assert.equal(reminders[0].message, 'Time to fill your timesheet!');
    assert.equal(reminders[0].enabled, true);
    assert.equal(reminders[0].snoozeCount, 0);
    assert.equal(reminders[0].snoozedUntil, null);
  });

  test('addReminder respects enabled: false and custom fields', async () => {
    await addReminder({
      message: 'Custom message',
      actionButtonLabel: 'Go',
      actionUrl: 'https://example.com',
      recurrence: { type: 'daily', hour: 9, minute: 0 },
      enabled: false
    });
    const [reminder] = await getReminders();
    assert.equal(reminder.message, 'Custom message');
    assert.equal(reminder.actionButtonLabel, 'Go');
    assert.equal(reminder.actionUrl, 'https://example.com');
    assert.equal(reminder.enabled, false);
  });

  test('updateReminder merges fields into the matching reminder only', async () => {
    const idA = await addReminder({ message: 'A', recurrence: { type: 'daily', hour: 9, minute: 0 } });
    const idB = await addReminder({ message: 'B', recurrence: { type: 'daily', hour: 10, minute: 0 } });

    await updateReminder(idA, { message: 'A updated' });

    const reminders = await getReminders();
    const a = reminders.find((r) => r.id === idA);
    const b = reminders.find((r) => r.id === idB);
    assert.equal(a.message, 'A updated');
    assert.equal(b.message, 'B');
  });

  test('updateReminder is a no-op for an unknown id', async () => {
    await addReminder({ message: 'A', recurrence: { type: 'daily', hour: 9, minute: 0 } });
    await updateReminder('does-not-exist', { message: 'nope' });
    const reminders = await getReminders();
    assert.equal(reminders.length, 1);
    assert.equal(reminders[0].message, 'A');
  });

  test('updateReminders applies a batch of updates in a single write', async () => {
    const idA = await addReminder({ message: 'A', recurrence: { type: 'daily', hour: 9, minute: 0 } });
    const idB = await addReminder({ message: 'B', recurrence: { type: 'daily', hour: 10, minute: 0 } });
    const idC = await addReminder({ message: 'C', recurrence: { type: 'daily', hour: 11, minute: 0 } });

    await updateReminders({
      [idA]: { lastTriggeredAt: 111 },
      [idC]: { lastTriggeredAt: 333 }
    });

    const reminders = await getReminders();
    const byId = Object.fromEntries(reminders.map((r) => [r.id, r]));
    assert.equal(byId[idA].lastTriggeredAt, 111);
    assert.equal(byId[idC].lastTriggeredAt, 333);
    assert.equal(byId[idB].lastTriggeredAt, undefined);
  });

  test('updateReminders does not lose updates when reminders "trigger" concurrently (regression: race condition)', async () => {
    // Simulates the background worker's old bug: firing several independent
    // get-then-set updateReminder() calls concurrently could clobber each
    // other's writes. updateReminders() must apply all changes atomically.
    const idA = await addReminder({ message: 'A', recurrence: { type: 'daily', hour: 9, minute: 0 } });
    const idB = await addReminder({ message: 'B', recurrence: { type: 'daily', hour: 9, minute: 0 } });

    await updateReminders({
      [idA]: { lastTriggeredAt: 1000, snoozeCount: 0 },
      [idB]: { lastTriggeredAt: 1000, snoozeCount: 0 }
    });

    const reminders = await getReminders();
    reminders.forEach((r) => {
      assert.equal(r.lastTriggeredAt, 1000);
      assert.equal(r.snoozeCount, 0);
    });
  });

  test('deleteReminder removes only the targeted reminder', async () => {
    const idA = await addReminder({ message: 'A', recurrence: { type: 'daily', hour: 9, minute: 0 } });
    const idB = await addReminder({ message: 'B', recurrence: { type: 'daily', hour: 10, minute: 0 } });

    await deleteReminder(idA);

    const reminders = await getReminders();
    assert.equal(reminders.length, 1);
    assert.equal(reminders[0].id, idB);
  });

  test('setReminders overwrites the whole list', async () => {
    await addReminder({ message: 'A', recurrence: { type: 'daily', hour: 9, minute: 0 } });
    await setReminders([]);
    assert.deepEqual(await getReminders(), []);
  });
});

describe('user preferences', () => {
  test('getUserPreferences returns defaults when nothing is stored', async () => {
    const prefs = await getUserPreferences();
    assert.equal(prefs.snoozeDuration, 15);
    assert.equal(prefs.maxSnoozeCount, 3);
    assert.equal(typeof prefs.timezone, 'string');
  });

  test('setUserPreferences merges with existing preferences instead of replacing them', async () => {
    await setUserPreferences({ snoozeDuration: 30 });
    await setUserPreferences({ maxSnoozeCount: 5 });

    const prefs = await getUserPreferences();
    assert.equal(prefs.snoozeDuration, 30);
    assert.equal(prefs.maxSnoozeCount, 5);
  });
});

describe('initializeDefaultReminders', () => {
  test('seeds a default weekly reminder when none exist', async () => {
    await initializeDefaultReminders();
    const reminders = await getReminders();
    assert.equal(reminders.length, 1);
    assert.equal(reminders[0].recurrence.type, 'weekly');
    assert.equal(reminders[0].enabled, true);
  });

  test('does not add a second reminder if one already exists', async () => {
    await addReminder({ message: 'Existing', recurrence: { type: 'daily', hour: 9, minute: 0 } });
    await initializeDefaultReminders();
    const reminders = await getReminders();
    assert.equal(reminders.length, 1);
    assert.equal(reminders[0].message, 'Existing');
  });

  test('sets a timezone preference if one is not already set', async () => {
    await initializeDefaultReminders();
    const prefs = await getUserPreferences();
    assert.ok(prefs.timezone);
  });
});
