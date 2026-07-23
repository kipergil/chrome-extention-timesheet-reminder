import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSystemTimezone, getNowInTimezone, getTimeInTimezone } from '../../src/utils/timezone.js';
import { withFixedNow } from '../helpers/fake-time.js';

test('getSystemTimezone returns a non-empty IANA-style string', () => {
  const tz = getSystemTimezone();
  assert.equal(typeof tz, 'string');
  assert.ok(tz.length > 0);
});

test('getNowInTimezone returns the correct wall-clock time for a fixed instant in UTC', async () => {
  await withFixedNow([2026, 6, 23, 15, 30, 45], () => {
    const result = getNowInTimezone('UTC');
    assert.equal(result.getFullYear(), 2026);
    assert.equal(result.getMonth(), 6);
    assert.equal(result.getDate(), 23);
    assert.equal(result.getHours(), 15);
    assert.equal(result.getMinutes(), 30);
    assert.equal(result.getSeconds(), 45);
  });
});

test('getNowInTimezone converts a fixed UTC instant into a different timezone (New York, UTC-4 in July)', async () => {
  await withFixedNow([2026, 6, 23, 15, 30, 0], () => {
    const result = getNowInTimezone('America/New_York');
    assert.equal(result.getHours(), 11); // 15:30 UTC - 4h (EDT)
    assert.equal(result.getMinutes(), 30);
  });
});

test('getTimeInTimezone reports hour, minute, dayOfWeek and dayOfMonth consistently', async () => {
  // 2026-07-24 is a Friday
  await withFixedNow([2026, 6, 24, 9, 5, 0], () => {
    const result = getTimeInTimezone('UTC');
    assert.deepEqual(result, {
      hour: 9,
      minute: 5,
      dayOfWeek: 5,
      dayOfMonth: 24
    });
  });
});
