#!/usr/bin/env node
'use strict';
/**
 * Scans pool/<name>/manifest.json for every package and regenerates the
 * Debian-compatible index at dists/jsbian/main/binary-amd64/Packages(.gz).
 * Run this after adding or editing a package, then commit the result —
 * raw.githubusercontent.com serves committed files directly, no CI needed.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = __dirname;
const POOL_DIR = path.join(ROOT, 'pool');
const DIST_DIR = path.join(ROOT, 'dists', 'jsbian', 'main', 'binary-amd64');

const REQUIRED_FIELDS = ['Package', 'Version', 'Description'];
const FIELD_ORDER = ['Package', 'Version', 'Architecture', 'Depends', 'Description'];

function loadPackages() {
  if (!fs.existsSync(POOL_DIR)) return [];
  const names = fs.readdirSync(POOL_DIR).filter((n) => fs.statSync(path.join(POOL_DIR, n)).isDirectory());
  return names.map((name) => {
    const manifestPath = path.join(POOL_DIR, name, 'manifest.json');
    const entryPath = path.join(POOL_DIR, name, `${name}.js`);
    if (!fs.existsSync(manifestPath)) throw new Error(`${name}: missing manifest.json`);
    if (!fs.existsSync(entryPath)) throw new Error(`${name}: missing ${name}.js entry point`);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const field of REQUIRED_FIELDS) {
      if (!manifest[field]) throw new Error(`${name}: manifest.json missing required field '${field}'`);
    }
    if (manifest.Package !== name) throw new Error(`${name}: manifest Package field ('${manifest.Package}') must match the pool/ directory name`);

    return { ...manifest, Filename: `pool/${name}/${name}.js` };
  });
}

function renderStanza(pkg) {
  const lines = [];
  for (const field of FIELD_ORDER) {
    if (pkg[field]) lines.push(`${field}: ${pkg[field]}`);
  }
  for (const [key, value] of Object.entries(pkg)) {
    if (!FIELD_ORDER.includes(key) && key !== 'Filename' && value) lines.push(`${key}: ${value}`);
  }
  lines.push(`Filename: ${pkg.Filename}`);
  return lines.join('\n');
}

function main() {
  const packages = loadPackages();
  const text = packages.map(renderStanza).join('\n\n') + (packages.length ? '\n' : '');

  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.writeFileSync(path.join(DIST_DIR, 'Packages'), text, 'utf8');
  fs.writeFileSync(path.join(DIST_DIR, 'Packages.gz'), zlib.gzipSync(Buffer.from(text, 'utf8')));

  console.log(`Built index for ${packages.length} package(s): ${packages.map((p) => p.Package).join(', ')}`);
  console.log(`-> ${path.relative(ROOT, path.join(DIST_DIR, 'Packages.gz'))}`);
}

main();
