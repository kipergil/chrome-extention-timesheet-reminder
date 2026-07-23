import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createChromeMock } from '../helpers/chrome-mock.js';
import {
  addReminderToStorage,
  updateReminderInStorage,
  deleteReminderFromStorage,
  clearAllReminders
} from '../../src/settings/reminders-manager.js';
import { getReminders } from '../../src/utils/storage.js';

beforeEach(() => {
  globalThis.chrome = createChromeMock();
});

test('addReminderToStorage persists a new reminder and returns its id', async () => {
  const id = await addReminderToStorage({ message: 'Hi', recurrence: { type: 'daily', hour: 9, minute: 0 } });
  const reminders = await getReminders();
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].id, id);
});

test('updateReminderInStorage updates the matching reminder', async () => {
  const id = await addReminderToStorage({ message: 'Hi', recurrence: { type: 'daily', hour: 9, minute: 0 } });
  await updateReminderInStorage(id, { message: 'Updated' });
  const [reminder] = await getReminders();
  assert.equal(reminder.message, 'Updated');
});

test('deleteReminderFromStorage removes the reminder', async () => {
  const id = await addReminderToStorage({ message: 'Hi', recurrence: { type: 'daily', hour: 9, minute: 0 } });
  await deleteReminderFromStorage(id);
  assert.deepEqual(await getReminders(), []);
});

describe('clearAllReminders', () => {
  test('empties the reminders list', async () => {
    await addReminderToStorage({ message: 'A', recurrence: { type: 'daily', hour: 9, minute: 0 } });
    await addReminderToStorage({ message: 'B', recurrence: { type: 'daily', hour: 10, minute: 0 } });
    await clearAllReminders();
    assert.deepEqual(await getReminders(), []);
  });
});
