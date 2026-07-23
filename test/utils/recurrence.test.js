import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getNextTriggerTime, shouldTriggerReminder } from '../../src/utils/recurrence.js';
import { withFixedNow } from '../helpers/fake-time.js';

describe('getNextTriggerTime', () => {
  test('daily: schedules today when the time has not yet passed', async () => {
    await withFixedNow([2026, 6, 24, 10, 0, 0], () => {
      const next = getNextTriggerTime({ type: 'daily', hour: 15, minute: 0 }, 'UTC');
      assert.equal(next.getDate(), 24);
      assert.equal(next.getHours(), 15);
      assert.equal(next.getMinutes(), 0);
    });
  });

  test('daily: rolls over to tomorrow once the time has passed', async () => {
    await withFixedNow([2026, 6, 24, 16, 0, 0], () => {
      const next = getNextTriggerTime({ type: 'daily', hour: 15, minute: 0 }, 'UTC');
      assert.equal(next.getDate(), 25);
      assert.equal(next.getHours(), 15);
    });
  });

  test('weekly: picks the soonest of multiple selected days', async () => {
    // 2026-07-24 is a Friday (dayOfWeek 5); selecting Sun(0) and Wed(3), Sunday
    // 2026-07-26 is only 2 days away versus 5 for Wednesday, so it wins.
    await withFixedNow([2026, 6, 24, 10, 0, 0], () => {
      const next = getNextTriggerTime(
        { type: 'weekly', daysOfWeek: [0, 3], hour: 9, minute: 0 },
        'UTC'
      );
      assert.equal(next.getDay(), 0);
      assert.equal(next.getDate(), 26);
    });
  });

  test('weekly: same day but time already passed rolls to next week', async () => {
    await withFixedNow([2026, 6, 24, 16, 0, 0], () => { // Friday, past 15:00
      const next = getNextTriggerTime(
        { type: 'weekly', daysOfWeek: [5], hour: 15, minute: 0 },
        'UTC'
      );
      assert.equal(next.getDay(), 5);
      assert.equal(next.getDate(), 31); // following Friday
    });
  });

  test('monthly: schedules this month when the day has not passed', async () => {
    await withFixedNow([2026, 6, 5, 10, 0, 0], () => {
      const next = getNextTriggerTime({ type: 'monthly', dayOfMonth: 15, hour: 9, minute: 0 }, 'UTC');
      assert.equal(next.getMonth(), 6);
      assert.equal(next.getDate(), 15);
    });
  });

  test('monthly: rolls to next month once the day has passed', async () => {
    await withFixedNow([2026, 6, 20, 10, 0, 0], () => {
      const next = getNextTriggerTime({ type: 'monthly', dayOfMonth: 15, hour: 9, minute: 0 }, 'UTC');
      assert.equal(next.getMonth(), 7);
      assert.equal(next.getDate(), 15);
    });
  });

  test('minutely: rounds up to the next interval boundary', async () => {
    await withFixedNow([2026, 6, 24, 10, 3, 0], () => {
      const next = getNextTriggerTime({ type: 'minutely', intervalMinutes: 5 }, 'UTC');
      assert.equal(next.getHours(), 10);
      assert.equal(next.getMinutes(), 5);
    });
  });
});

describe('shouldTriggerReminder - daily', () => {
  const recurrence = { type: 'daily', hour: 15, minute: 0 };

  test('does not trigger before the scheduled time', () => {
    const now = new Date(2026, 6, 24, 14, 59, 0);
    assert.equal(shouldTriggerReminder(recurrence, 'UTC', null, now), false);
  });

  test('triggers exactly at the scheduled time', () => {
    const now = new Date(2026, 6, 24, 15, 0, 0);
    assert.equal(shouldTriggerReminder(recurrence, 'UTC', null, now), true);
  });

  test('still triggers when the check runs late (regression: missed-alarm bug)', () => {
    // An alarm that fires a few minutes late (system sleep, throttling, etc.)
    // must still trigger instead of silently skipping the day.
    const now = new Date(2026, 6, 24, 15, 7, 0);
    assert.equal(shouldTriggerReminder(recurrence, 'UTC', null, now), true);
  });

  test('does not re-trigger after being acknowledged the same day', () => {
    const ackTimestamp = Date.UTC(2026, 6, 24, 15, 1, 0);
    const now = new Date(2026, 6, 24, 15, 30, 0);
    assert.equal(shouldTriggerReminder(recurrence, 'UTC', ackTimestamp, now), false);
  });

  test('triggers again the following day after being acknowledged', () => {
    const ackTimestamp = Date.UTC(2026, 6, 24, 15, 1, 0);
    const now = new Date(2026, 6, 25, 15, 2, 0);
    assert.equal(shouldTriggerReminder(recurrence, 'UTC', ackTimestamp, now), true);
  });
});

describe('shouldTriggerReminder - weekly', () => {
  const recurrence = { type: 'weekly', daysOfWeek: [5], hour: 15, minute: 0 }; // Friday

  test('does not trigger on the wrong day even after the scheduled time', () => {
    const now = new Date(2026, 6, 23, 15, 5, 0); // Thursday
    assert.equal(shouldTriggerReminder(recurrence, 'UTC', null, now), false);
  });

  test('triggers on the correct day, even when the check runs late', () => {
    const now = new Date(2026, 6, 24, 15, 4, 0); // Friday, 4 minutes late
    assert.equal(shouldTriggerReminder(recurrence, 'UTC', null, now), true);
  });

  test('does not re-trigger later the same day once acknowledged', () => {
    const ackTimestamp = Date.UTC(2026, 6, 24, 15, 2, 0);
    const now = new Date(2026, 6, 24, 15, 45, 0);
    assert.equal(shouldTriggerReminder(recurrence, 'UTC', ackTimestamp, now), false);
  });

  test('triggers again the following week after being acknowledged', () => {
    const ackTimestamp = Date.UTC(2026, 6, 24, 15, 2, 0);
    const now = new Date(2026, 6, 31, 15, 1, 0); // next Friday
    assert.equal(shouldTriggerReminder(recurrence, 'UTC', ackTimestamp, now), true);
  });

  test('supports multiple selected days of week', () => {
    const multiDay = { type: 'weekly', daysOfWeek: [1, 3, 5], hour: 9, minute: 0 };
    const monday = new Date(2026, 6, 20, 9, 0, 0);
    const tuesday = new Date(2026, 6, 21, 9, 0, 0);
    assert.equal(shouldTriggerReminder(multiDay, 'UTC', null, monday), true);
    assert.equal(shouldTriggerReminder(multiDay, 'UTC', null, tuesday), false);
  });
});

describe('shouldTriggerReminder - monthly', () => {
  const recurrence = { type: 'monthly', dayOfMonth: 15, hour: 12, minute: 0 };

  test('does not trigger on the wrong day of month', () => {
    const now = new Date(2026, 6, 16, 12, 5, 0);
    assert.equal(shouldTriggerReminder(recurrence, 'UTC', null, now), false);
  });

  test('triggers on the correct day, even when the check runs late', () => {
    const now = new Date(2026, 6, 15, 12, 10, 0);
    assert.equal(shouldTriggerReminder(recurrence, 'UTC', null, now), true);
  });

  test('does not re-trigger later the same month once acknowledged', () => {
    const ackTimestamp = Date.UTC(2026, 6, 15, 12, 1, 0);
    const now = new Date(2026, 6, 15, 20, 0, 0);
    assert.equal(shouldTriggerReminder(recurrence, 'UTC', ackTimestamp, now), false);
  });

  test('triggers again next month after being acknowledged', () => {
    const ackTimestamp = Date.UTC(2026, 6, 15, 12, 1, 0);
    const now = new Date(2026, 7, 15, 12, 1, 0);
    assert.equal(shouldTriggerReminder(recurrence, 'UTC', ackTimestamp, now), true);
  });
});

describe('shouldTriggerReminder - minutely', () => {
  const recurrence = { type: 'minutely', intervalMinutes: 5 };

  test('triggers mid-bucket without requiring an exact boundary (regression: missed-alarm bug)', () => {
    const now = new Date(2026, 6, 24, 10, 3, 0);
    assert.equal(shouldTriggerReminder(recurrence, 'UTC', null, now), true);
  });

  test('does not re-trigger again within the same bucket once acknowledged', () => {
    const ackTimestamp = Date.UTC(2026, 6, 24, 10, 1, 0);
    const now = new Date(2026, 6, 24, 10, 4, 0);
    assert.equal(shouldTriggerReminder(recurrence, 'UTC', ackTimestamp, now), false);
  });

  test('triggers again once a new bucket starts', () => {
    const ackTimestamp = Date.UTC(2026, 6, 24, 10, 1, 0);
    const now = new Date(2026, 6, 24, 10, 6, 0);
    assert.equal(shouldTriggerReminder(recurrence, 'UTC', ackTimestamp, now), true);
  });
});
