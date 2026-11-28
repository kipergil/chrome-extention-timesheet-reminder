import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createChromeMock } from '../helpers/chrome-mock.js';
import {
  getReminders,
  setReminders,
  replaceAllReminders,
  addReminder,
  updateReminder,
  updateReminders,
  updateAllReminders,
  trySnoozeReminder,
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

  test('replaceAllReminders overwrites the whole list', async () => {
    await addReminder({ message: 'A', recurrence: { type: 'daily', hour: 9, minute: 0 } });
    await replaceAllReminders([]);
    assert.deepEqual(await getReminders(), []);
  });

  test('updateAllReminders applies a transform to every reminder and returns the updated list', async () => {
    await addReminder({ message: 'A', recurrence: { type: 'daily', hour: 9, minute: 0 }, enabled: true });
    await addReminder({ message: 'B', recurrence: { type: 'daily', hour: 10, minute: 0 }, enabled: true });

    const result = await updateAllReminders((reminder) => ({ ...reminder, snoozeCount: 0, snoozedUntil: null }));

    assert.equal(result.length, 2);
    result.forEach((r) => {
      assert.equal(r.snoozeCount, 0);
      assert.equal(r.snoozedUntil, null);
    });

    const stored = await getReminders();
    assert.deepEqual(stored, result);
  });

  test('addReminder calls do not lose each other even when fired concurrently (regression: lost-update race)', async () => {
    // Two addReminder() calls issued back-to-back both read the reminders
    // list before either has written it back; without serialization, the
    // second write would overwrite the first's addition entirely.
    await Promise.all([
      addReminder({ message: 'A', recurrence: { type: 'daily', hour: 9, minute: 0 } }),
      addReminder({ message: 'B', recurrence: { type: 'daily', hour: 10, minute: 0 } })
    ]);

    const reminders = await getReminders();
    assert.equal(reminders.length, 2);
    assert.deepEqual(reminders.map((r) => r.message).sort(), ['A', 'B']);
  });
});

describe('trySnoozeReminder', () => {
  test('succeeds and increments snoozeCount', async () => {
    const id = await addReminder({ message: 'A', recurrence: { type: 'daily', hour: 9, minute: 0 } });
    const before = Date.now();

    const result = await trySnoozeReminder(id, { snoozeDurationMinutes: 15, maxSnoozeCount: 3 });

    assert.equal(result.status, 'ok');
    assert.equal(result.currentSnoozeCount, 1);
    assert.equal(result.maxSnoozeCount, 3);

    const [reminder] = await getReminders();
    assert.equal(reminder.snoozeCount, 1);
    assert.ok(reminder.snoozedUntil - before >= 15 * 60 * 1000 - 1000);
  });

  test('reports limit_reached once the max snooze count is hit', async () => {
    const id = await addReminder({ message: 'A', recurrence: { type: 'daily', hour: 9, minute: 0 } });
    await updateReminder(id, { snoozeCount: 3 });

    const result = await trySnoozeReminder(id, { snoozeDurationMinutes: 15, maxSnoozeCount: 3 });

    assert.equal(result.status, 'limit_reached');
    assert.equal(result.currentSnoozeCount, 3);

    const [reminder] = await getReminders();
    assert.equal(reminder.snoozeCount, 3, 'snoozeCount must not change once the limit is hit');
  });

  test('reports not_found for an unknown reminder id', async () => {
    const result = await trySnoozeReminder('does-not-exist', { snoozeDurationMinutes: 15, maxSnoozeCount: 3 });
    assert.equal(result.status, 'not_found');
  });

  test('two concurrent snooze attempts for the same reminder both count (regression: lost-update race)', async () => {
    // Before the fix, both calls read the same pre-snooze snoozeCount and
    // each independently computed "+1", so the second write silently
    // clobbered the first instead of compounding - two snoozes from two
    // tabs at once would only ever count as one.
    const id = await addReminder({ message: 'A', recurrence: { type: 'daily', hour: 9, minute: 0 } });

    const [r1, r2] = await Promise.all([
      trySnoozeReminder(id, { snoozeDurationMinutes: 15, maxSnoozeCount: 3 }),
      trySnoozeReminder(id, { snoozeDurationMinutes: 15, maxSnoozeCount: 3 })
    ]);

    assert.equal(r1.status, 'ok');
    assert.equal(r2.status, 'ok');
    assert.deepEqual([r1.currentSnoozeCount, r2.currentSnoozeCount].sort(), [1, 2]);

    const [reminder] = await getReminders();
    assert.equal(reminder.snoozeCount, 2);
  });

  test('the snooze limit is still enforced exactly once under concurrent attempts', async () => {
    // With maxSnoozeCount 1, two concurrent attempts starting from count 0
    // must resolve to exactly one 'ok' and one 'limit_reached' - never both
    // succeeding (which would silently bypass the configured limit).
    const id = await addReminder({ message: 'A', recurrence: { type: 'daily', hour: 9, minute: 0 } });

    const [r1, r2] = await Promise.all([
      trySnoozeReminder(id, { snoozeDurationMinutes: 15, maxSnoozeCount: 1 }),
      trySnoozeReminder(id, { snoozeDurationMinutes: 15, maxSnoozeCount: 1 })
    ]);

    assert.deepEqual([r1.status, r2.status].sort(), ['limit_reached', 'ok']);

    const [reminder] = await getReminders();
    assert.equal(reminder.snoozeCount, 1);
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
