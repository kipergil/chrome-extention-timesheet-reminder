import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createChromeMock, flushAsync } from '../helpers/chrome-mock.js';
import { withFixedNow } from '../helpers/fake-time.js';
import { getReminders, setReminders, setUserPreferences } from '../../src/utils/storage.js';

const NEXT_REMINDER_ALARM = 'nextReminderCheck';

let chrome;

// background-worker.js registers its listeners as a side effect of being
// imported, so the mock must be installed globally before the dynamic
// import runs. It's imported once and reused (with its data reset) across
// all tests in this file so the registered listeners stay valid.
before(async () => {
  chrome = createChromeMock();
  globalThis.chrome = chrome;
  await import('../../src/background/background-worker.js');
});

beforeEach(() => {
  Object.keys(chrome._test.store).forEach((key) => delete chrome._test.store[key]);
  chrome._test.alarms.clear();
  chrome._test.sentTabMessages.length = 0;
  chrome._test.createdTabs.length = 0;
});

describe('alarm-driven reminder triggering', () => {
  test('a due reminder is shown in every tab and reschedules the next check', async () => {
    await setReminders([
      {
        id: 'r1',
        message: 'Fill your timesheet',
        enabled: true,
        recurrence: { type: 'daily', hour: 9, minute: 0 },
        lastTriggeredAt: null,
        snoozedUntil: null,
        snoozeCount: 0
      }
    ]);
    await setUserPreferences({ timezone: 'UTC' });

    await withFixedNow([2026, 6, 24, 9, 0, 0], async () => {
      chrome._test.fireAlarm(NEXT_REMINDER_ALARM);
      await flushAsync();

      const shown = chrome._test.sentTabMessages.filter((m) => m.message.type === 'SHOW_REMINDER_POPUP');
      assert.equal(shown.length, 1);
      assert.equal(shown[0].message.reminder.id, 'r1');

      const [reminder] = await getReminders();
      assert.equal(reminder.lastTriggeredAt, Date.now());
      assert.equal(reminder.snoozeCount, 0);

      const alarm = chrome._test.getAlarm(NEXT_REMINDER_ALARM);
      assert.ok(alarm, 'expected the next check alarm to be scheduled');
      assert.equal(alarm.when, Date.UTC(2026, 6, 25, 9, 0, 0));
    });
  });

  test('a reminder that is not yet due does not trigger', async () => {
    await setReminders([
      {
        id: 'r1',
        message: 'Fill your timesheet',
        enabled: true,
        recurrence: { type: 'daily', hour: 9, minute: 0 },
        lastTriggeredAt: null,
        snoozedUntil: null,
        snoozeCount: 0
      }
    ]);
    await setUserPreferences({ timezone: 'UTC' });

    await withFixedNow([2026, 6, 24, 8, 0, 0], async () => {
      chrome._test.fireAlarm(NEXT_REMINDER_ALARM);
      await flushAsync();

      assert.equal(chrome._test.sentTabMessages.length, 0);
      const [reminder] = await getReminders();
      assert.equal(reminder.lastTriggeredAt, null);
    });
  });

  test('two reminders due at the same time both persist their triggered state (regression: storage race)', async () => {
    await setReminders([
      {
        id: 'a',
        message: 'Reminder A',
        enabled: true,
        recurrence: { type: 'daily', hour: 9, minute: 0 },
        lastTriggeredAt: null,
        snoozedUntil: null,
        snoozeCount: 0
      },
      {
        id: 'b',
        message: 'Reminder B',
        enabled: true,
        recurrence: { type: 'daily', hour: 9, minute: 0 },
        lastTriggeredAt: null,
        snoozedUntil: null,
        snoozeCount: 0
      }
    ]);
    await setUserPreferences({ timezone: 'UTC' });

    await withFixedNow([2026, 6, 24, 9, 0, 0], async () => {
      chrome._test.fireAlarm(NEXT_REMINDER_ALARM);
      await flushAsync();

      const reminders = await getReminders();
      reminders.forEach((reminder) => {
        assert.equal(reminder.lastTriggeredAt, Date.now(), `expected ${reminder.id} to record its trigger time`);
      });

      const shownIds = chrome._test.sentTabMessages
        .filter((m) => m.message.type === 'SHOW_REMINDER_POPUP')
        .map((m) => m.message.reminder.id);
      assert.deepEqual(new Set(shownIds), new Set(['a', 'b']));
    });
  });
});

describe('REMINDER_ACKNOWLEDGED message', () => {
  test('marks the reminder as shown and clears snooze state', async () => {
    await setReminders([
      { id: 'r1', message: 'Hi', enabled: true, recurrence: { type: 'daily', hour: 9, minute: 0 }, snoozedUntil: 999, snoozeCount: 2 }
    ]);

    const response = await chrome._test.sendMessage({ type: 'REMINDER_ACKNOWLEDGED', reminderId: 'r1' });
    assert.equal(response.status, 'ok');

    const [reminder] = await getReminders();
    assert.ok(reminder.lastShown > 0);
    assert.equal(reminder.snoozedUntil, null);
    assert.equal(reminder.snoozeCount, 0);
  });
});

describe('REMINDER_SNOOZED message', () => {
  test('snoozes the reminder and increments the snooze count', async () => {
    await setReminders([
      { id: 'r1', message: 'Hi', enabled: true, recurrence: { type: 'daily', hour: 9, minute: 0 }, snoozedUntil: null, snoozeCount: 0 }
    ]);
    await setUserPreferences({ snoozeDuration: 10, maxSnoozeCount: 3 });

    const before = Date.now();
    const response = await chrome._test.sendMessage({ type: 'REMINDER_SNOOZED', reminderId: 'r1' });

    assert.equal(response.status, 'ok');
    assert.equal(response.currentSnoozeCount, 1);
    assert.equal(response.maxSnoozeCount, 3);

    const [reminder] = await getReminders();
    assert.equal(reminder.snoozeCount, 1);
    assert.ok(reminder.snoozedUntil - before >= 10 * 60 * 1000 - 1000);
  });

  test('refuses to snooze once the limit is reached', async () => {
    await setReminders([
      { id: 'r1', message: 'Hi', enabled: true, recurrence: { type: 'daily', hour: 9, minute: 0 }, snoozedUntil: null, snoozeCount: 3 }
    ]);
    await setUserPreferences({ maxSnoozeCount: 3 });

    const response = await chrome._test.sendMessage({ type: 'REMINDER_SNOOZED', reminderId: 'r1' });
    assert.equal(response.status, 'limit_reached');
    assert.equal(response.currentSnoozeCount, 3);

    const [reminder] = await getReminders();
    assert.equal(reminder.snoozeCount, 3);
    assert.equal(reminder.snoozedUntil, null);
  });

  test('reports not_found for an unknown reminder id', async () => {
    await setReminders([]);
    const response = await chrome._test.sendMessage({ type: 'REMINDER_SNOOZED', reminderId: 'missing' });
    assert.equal(response.status, 'not_found');
  });
});

describe('bulk actions', () => {
  test('CLEAR_ACKNOWLEDGEMENTS resets lastShown on every reminder', async () => {
    const future = Date.now() + 60000;
    await setReminders([
      { id: 'a', lastShown: 111, snoozedUntil: future, enabled: true },
      { id: 'b', lastShown: 222, snoozedUntil: null, enabled: true }
    ]);

    const response = await chrome._test.sendMessage({ type: 'CLEAR_ACKNOWLEDGEMENTS' });
    assert.equal(response.status, 'ok');
    assert.equal(response.summary.total, 2);
    assert.equal(response.summary.activeSnoozed, 1);

    const reminders = await getReminders();
    reminders.forEach((r) => assert.equal(r.lastShown, null));
  });

  test('CLEAR_SNOOZE_COUNT resets snoozeCount and snoozedUntil on every reminder', async () => {
    await setReminders([
      { id: 'a', lastShown: 111, snoozedUntil: Date.now() + 1000, snoozeCount: 2, enabled: true },
      { id: 'b', lastShown: null, snoozedUntil: null, snoozeCount: 1, enabled: true }
    ]);

    const response = await chrome._test.sendMessage({ type: 'CLEAR_SNOOZE_COUNT' });
    assert.equal(response.status, 'ok');
    assert.equal(response.summary.acknowledged, 1);
    assert.equal(response.summary.activeSnoozed, 0);

    const reminders = await getReminders();
    reminders.forEach((r) => {
      assert.equal(r.snoozeCount, 0);
      assert.equal(r.snoozedUntil, null);
    });
  });
});

describe('other message types', () => {
  test('OPEN_SETTINGS_PAGE opens the settings page in a new tab', async () => {
    const response = await chrome._test.sendMessage({ type: 'OPEN_SETTINGS_PAGE' });
    assert.equal(response.status, 'ok');
    assert.equal(chrome._test.createdTabs.length, 1);
    assert.equal(chrome._test.createdTabs[0].url, 'src/settings/settings.html');
  });

  test('CLOSE_ALL_MODALS broadcasts to every open tab', async () => {
    const response = await chrome._test.sendMessage({ type: 'CLOSE_ALL_MODALS' });
    assert.equal(response.status, 'ok');
    const closeMessages = chrome._test.sentTabMessages.filter((m) => m.message.type === 'CLOSE_ALL_MODALS');
    assert.equal(closeMessages.length, 1);
  });

  test('TRIGGER_TEST_REMINDER shows the given reminder immediately', async () => {
    const response = await chrome._test.sendMessage({
      type: 'TRIGGER_TEST_REMINDER',
      reminder: { id: 'preview', message: 'Preview message' }
    });
    assert.equal(response.status, 'ok');
    await flushAsync();

    const shown = chrome._test.sentTabMessages.find((m) => m.message.type === 'SHOW_REMINDER_POPUP');
    assert.ok(shown);
    assert.equal(shown.message.reminder.id, 'preview');
  });
});

describe('storage change reacts by rescheduling the next check', () => {
  test('saving a new reminder schedules an alarm for its next trigger time', async () => {
    await withFixedNow([2026, 6, 24, 8, 0, 0], async () => {
      await setUserPreferences({ timezone: 'UTC' });
      await setReminders([
        { id: 'r1', enabled: true, recurrence: { type: 'daily', hour: 9, minute: 0 }, snoozedUntil: null }
      ]);
      await flushAsync();

      const alarm = chrome._test.getAlarm(NEXT_REMINDER_ALARM);
      assert.ok(alarm);
      assert.equal(alarm.when, Date.UTC(2026, 6, 24, 9, 0, 0));
    });
  });
});
