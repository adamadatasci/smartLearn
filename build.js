/*
 * build.js — copies the web app into ./www so Capacitor can bundle it into the iOS app.
 * Run with: npm run build
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const out = path.join(root, 'www');

// Folders to copy wholesale.
const DIRS = ['js', 'icons'];
// Top-level files to copy (everything the app needs at runtime).
const FILE_EXT = ['.html', '.css'];
const EXTRA_FILES = ['manifest.json', 'sw.js'];

function rimraf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function main() {
  rimraf(out);
  fs.mkdirSync(out, { recursive: true });

  // Copy matching top-level files.
  for (const name of fs.readdirSync(root)) {
    const full = path.join(root, name);
    if (!fs.statSync(full).isFile()) continue;
    const ok = FILE_EXT.includes(path.extname(name)) || EXTRA_FILES.includes(name);
    if (ok) fs.copyFileSync(full, path.join(out, name));
  }

  // Copy asset folders.
  for (const dir of DIRS) {
    const src = path.join(root, dir);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(out, dir), { recursive: true });
  }

  console.log('Web assets copied to', out);
}

main();
