import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createChromeMock } from '../helpers/chrome-mock.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_SCRIPT_PATH = path.resolve(__dirname, '../../src/content/content-script.js');

let isSafeHttpUrl;

before(() => {
  // content-script.js is intentionally a classic (non-module) script - Chrome
  // Manifest V3 content_scripts entries don't support "type": "module", so it
  // can't use `export`/`import`. To unit test its internal isSafeHttpUrl
  // helper without changing that (production-required) constraint, load the
  // real file text into a sandboxed vm context and pull the function out,
  // rather than modifying the shipped file to make it importable.
  const code = fs.readFileSync(CONTENT_SCRIPT_PATH, 'utf8');
  const sandbox = { chrome: createChromeMock(), console, URL };
  vm.createContext(sandbox);
  vm.runInContext(`${code}\nthis.__isSafeHttpUrl = isSafeHttpUrl;`, sandbox, {
    filename: CONTENT_SCRIPT_PATH
  });
  isSafeHttpUrl = sandbox.__isSafeHttpUrl;
});

describe('isSafeHttpUrl (regression: javascript: URI opened via window.open)', () => {
  test('accepts http and https URLs', () => {
    assert.equal(isSafeHttpUrl('https://example.com/timesheet'), true);
    assert.equal(isSafeHttpUrl('http://example.com'), true);
  });

  test('rejects a javascript: URI', () => {
    assert.equal(isSafeHttpUrl('javascript:alert(document.cookie)'), false);
  });

  test('rejects other non-http(s) schemes and malformed input', () => {
    assert.equal(isSafeHttpUrl('data:text/html,<script>alert(1)</script>'), false);
    assert.equal(isSafeHttpUrl('not a url'), false);
    assert.equal(isSafeHttpUrl(''), false);
  });
});
