/**
 * Freezes both `Date.now()` and `new Date()` (no-arg form) to a fixed
 * instant for the duration of an (async) callback. The codebase mixes both
 * `Date.now()` and `new Date()` to read "the current time", so mocking only
 * one of them leaves the other reading the real wall clock.
 */
export async function withFixedNow(utcParts, fn) {
  const fixedMs = Date.UTC(...utcParts);
  const OriginalDate = globalThis.Date;

  class FakeDate extends OriginalDate {
    constructor(...args) {
      if (args.length === 0) {
        super(fixedMs);
      } else {
        super(...args);
      }
    }

    static now() {
      return fixedMs;
    }
  }

  globalThis.Date = FakeDate;
  try {
    return await fn();
  } finally {
    globalThis.Date = OriginalDate;
  }
}
