#!/usr/bin/env node
/**
 * Builds a Chrome Web Store-ready .zip of this extension.
 *
 * - Runs the test suite first (skip with --skip-tests)
 * - Validates manifest.json and that every file it references actually exists
 * - Copies only the runtime files the extension needs (manifest.json, the
 *   generated PNG icons, and src/**) into a clean staging directory - no
 *   test/, docs, icon source SVG, or dev tooling ships in the package
 * - Zips the staging directory's *contents* (not the directory itself), so
 *   manifest.json sits at the zip root, exactly as the Chrome Web Store
 *   Developer Dashboard expects on upload
 *
 * Usage:
 *   node scripts/build-package.mjs [--skip-tests] [--out-dir=build]
 */

import { existsSync, mkdirSync, rmSync, readFileSync, cpSync, statSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const skipTests = args.includes('--skip-tests');
const outDirArg = args.find((a) => a.startsWith('--out-dir='));
const OUT_DIR = path.resolve(ROOT, outDirArg ? outDirArg.slice('--out-dir='.length) : 'build');
const STAGING_DIR = path.join(OUT_DIR, 'package');

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function step(message) {
  console.log(`\n▶ ${message}`);
}

function runTests() {
  if (skipTests) {
    step('Skipping test suite (--skip-tests passed)');
    return;
  }

  step('Running test suite (npm test) - pass --skip-tests to bypass');
  const result = spawnSync(process.execPath, ['--test'], { cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) {
    fail('Tests failed. Fix them before packaging, or pass --skip-tests to override.');
  }
}

function loadManifest() {
  step('Validating manifest.json');
  const manifestPath = path.join(ROOT, 'manifest.json');
  if (!existsSync(manifestPath)) {
    fail('manifest.json not found at repo root.');
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    fail(`manifest.json is not valid JSON: ${err.message}`);
  }

  if (manifest.manifest_version !== 3) {
    fail(`Expected manifest_version 3, found ${manifest.manifest_version}.`);
  }

  if (!/^\d+(\.\d+){0,3}$/.test(String(manifest.version || ''))) {
    fail(`manifest.json "version" (${manifest.version}) is not a valid Chrome Web Store version string (1-4 dot-separated integers).`);
  }

  const referencedFiles = [];

  const collectIconPaths = (iconsObj) => {
    if (!iconsObj) return;
    Object.values(iconsObj).forEach((p) => referencedFiles.push(p));
  };
  collectIconPaths(manifest.icons);
  collectIconPaths(manifest.action?.default_icon);

  if (manifest.background?.service_worker) {
    referencedFiles.push(manifest.background.service_worker);
  }

  (manifest.content_scripts || []).forEach((cs) => {
    (cs.js || []).forEach((p) => referencedFiles.push(p));
    (cs.css || []).forEach((p) => referencedFiles.push(p));
  });

  if (manifest.action?.default_popup) {
    referencedFiles.push(manifest.action.default_popup);
  }

  (manifest.web_accessible_resources || []).forEach((war) => {
    (war.resources || []).forEach((p) => referencedFiles.push(p));
  });

  const missing = referencedFiles.filter((p) => !existsSync(path.join(ROOT, p)));
  if (missing.length > 0) {
    fail(`manifest.json references files that don't exist on disk:\n  ${missing.join('\n  ')}`);
  }

  console.log(`  manifest.json OK (version ${manifest.version}, ${referencedFiles.length} referenced files all present)`);
  return manifest;
}

function buildStagingDir() {
  step(`Building staging directory at ${path.relative(ROOT, STAGING_DIR)}`);
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(STAGING_DIR, { recursive: true });

  // Explicit allow-list: only what the extension needs at runtime. No test/,
  // docs, the icon.svg source, or dev tooling (package.json, scripts/, etc.)
  // ends up in the Store package.
  const includes = [
    'manifest.json',
    'assets/icon-16.png',
    'assets/icon-32.png',
    'assets/icon-48.png',
    'assets/icon-128.png',
    'src'
  ];

  for (const relPath of includes) {
    const src = path.join(ROOT, relPath);
    if (!existsSync(src)) {
      fail(`Expected file/directory missing: ${relPath}`);
    }
    const dest = path.join(STAGING_DIR, relPath);
    mkdirSync(path.dirname(dest), { recursive: true });
    cpSync(src, dest, { recursive: true });
  }

  console.log('  Staged files:');
  listFilesRecursive(STAGING_DIR).forEach((f) => {
    console.log(`    ${path.relative(STAGING_DIR, f)}`);
  });
}

function listFilesRecursive(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function zipStagingDir(version) {
  const zipName = `timesheet-reminder-v${version}.zip`;
  const zipPath = path.join(OUT_DIR, zipName);

  step(`Zipping package as ${zipName}`);
  if (existsSync(zipPath)) rmSync(zipPath);

  const zipBin = spawnSync('zip', ['-v']).error ? null : 'zip';
  if (!zipBin) {
    fail('The `zip` command-line tool is required but was not found on PATH.');
  }

  const result = spawnSync('zip', ['-r', '-X', path.relative(STAGING_DIR, zipPath), '.', '-x', '.*'], {
    cwd: STAGING_DIR,
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    fail('zip command failed.');
  }

  return zipPath;
}

function verifyZip(zipPath) {
  step('Verifying zip contents (manifest.json must be at the zip root)');
  const result = spawnSync('unzip', ['-l', zipPath], { encoding: 'utf8' });
  if (result.status !== 0) {
    fail(`Could not list zip contents: ${result.stderr}`);
  }

  const lines = result.stdout.split('\n').map((l) => l.trim());
  const hasRootManifest = lines.some((l) => l.endsWith(' manifest.json'));
  if (!hasRootManifest) {
    fail('manifest.json is not at the root of the zip - the Chrome Web Store will reject this package.');
  }

  const sizeBytes = statSync(zipPath).size;
  const sizeKb = (sizeBytes / 1024).toFixed(1);
  console.log(`  OK - manifest.json found at zip root. Package size: ${sizeKb} KB`);

  if (sizeBytes > 50 * 1024 * 1024) {
    console.warn('  ⚠ Package is unusually large for this extension (>50MB) - double-check what got included.');
  }
}

function main() {
  runTests();
  const manifest = loadManifest();
  buildStagingDir();
  const zipPath = zipStagingDir(manifest.version);
  verifyZip(zipPath);

  console.log(`\n✔ Done. Upload this file to the Chrome Web Store Developer Dashboard:\n  ${zipPath}\n`);
}

main();
