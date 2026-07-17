#!/usr/bin/env node
'use strict';
/**
 * Regenerates packages.json (a plain array of package names) from pool/,
 * validating each package's manifest.json and entry-point JS syntax along
 * the way. Run by .github/workflows/update-index.yml on every push
 * touching pool/ — nobody should need to run this by hand, or remember to.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const POOL_DIR = path.join(ROOT, 'pool');
const REQUIRED_FIELDS = ['Package', 'Version', 'Description'];

function fail(msg) {
  console.error(`::error::${msg}`);
  process.exitCode = 1;
}

function main() {
  if (!fs.existsSync(POOL_DIR)) {
    fs.writeFileSync(path.join(ROOT, 'packages.json'), '[]\n');
    console.log('No pool/ directory — wrote an empty packages.json');
    return;
  }

  const names = fs.readdirSync(POOL_DIR).filter((n) => fs.statSync(path.join(POOL_DIR, n)).isDirectory()).sort();
  const valid = [];

  for (const name of names) {
    const manifestPath = path.join(POOL_DIR, name, 'manifest.json');
    const entryPath = path.join(POOL_DIR, name, `${name}.js`);

    if (!fs.existsSync(manifestPath)) { fail(`${name}: missing manifest.json`); continue; }
    if (!fs.existsSync(entryPath)) { fail(`${name}: missing ${name}.js entry point`); continue; }

    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (e) {
      fail(`${name}: manifest.json is not valid JSON (${e.message})`);
      continue;
    }

    const missing = REQUIRED_FIELDS.filter((f) => !manifest[f]);
    if (missing.length) { fail(`${name}: manifest.json missing required field(s): ${missing.join(', ')}`); continue; }
    if (manifest.Package !== name) { fail(`${name}: manifest Package ('${manifest.Package}') must match its pool/ directory name`); continue; }

    try {
      new Function(fs.readFileSync(entryPath, 'utf8')); // eslint-disable-line no-new-func -- syntax-only check, never executed
    } catch (e) {
      fail(`${name}: ${name}.js has invalid JavaScript syntax (${e.message})`);
      continue;
    }

    valid.push(name);
  }

  if (process.exitCode === 1) {
    console.error('Refusing to update packages.json while the above package(s) fail validation.');
    return;
  }

  fs.writeFileSync(path.join(ROOT, 'packages.json'), JSON.stringify(valid, null, 2) + '\n');
  console.log(`Wrote packages.json with ${valid.length} package(s): ${valid.join(', ')}`);
}

main();
