import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { installDomStub } from '../helpers/dom-mock.js';

let isValidUrl;
let getRecurrenceText;

before(async () => {
  // settings.js does top-level `document.getElementById(...)`, so a DOM
  // stub must exist before it's imported.
  installDomStub();
  ({ isValidUrl, getRecurrenceText } = await import('../../src/settings/settings.js'));
});

describe('isValidUrl (regression: javascript: URI validation)', () => {
  test('accepts http and https URLs', () => {
    assert.equal(isValidUrl('https://example.com/timesheet'), true);
    assert.equal(isValidUrl('http://example.com'), true);
  });

  test('rejects a javascript: URI', () => {
    assert.equal(isValidUrl('javascript:alert(1)'), false);
  });

  test('rejects other non-http(s) schemes', () => {
    assert.equal(isValidUrl('data:text/html,<script>alert(1)</script>'), false);
    assert.equal(isValidUrl('file:///etc/passwd'), false);
  });

  test('rejects malformed strings', () => {
    assert.equal(isValidUrl('not a url'), false);
    assert.equal(isValidUrl(''), false);
  });
});

describe('getRecurrenceText', () => {
  test('formats a daily recurrence', () => {
    assert.equal(getRecurrenceText({ type: 'daily', hour: 9, minute: 5 }), 'Daily at 09:05');
  });

  test('formats a weekly recurrence with multiple days', () => {
    assert.equal(
      getRecurrenceText({ type: 'weekly', daysOfWeek: [1, 5], hour: 15, minute: 0 }),
      'Every Monday, Friday at 15:00'
    );
  });

  test('formats a monthly recurrence', () => {
    assert.equal(getRecurrenceText({ type: 'monthly', dayOfMonth: 1, hour: 8, minute: 30 }), 'Every month on day 1 at 08:30');
  });

  test('formats a minutely recurrence', () => {
    assert.equal(getRecurrenceText({ type: 'minutely', intervalMinutes: 5 }), 'Every 5 minutes');
    assert.equal(getRecurrenceText({ type: 'minutely', intervalMinutes: 1 }), 'Every 1 minute');
  });
});
