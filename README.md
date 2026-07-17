# JSBian-apt-repo

The APT repository for [JSBian](https://github.com/Comma-off/JSBian) — a
persistent, Debian-compatible environment simulator running in Node.js.

Real Debian mirrors serve genuine `.deb`s: real ELF binaries JSBian can
unpack and inspect, but never execute (there's no Linux kernel underneath
it, just Node). This repo is the other half — packages that are actually
**runnable**, because they're plain JavaScript instead of native machine
code. `apt` on a JSBian install can point at both this repo and a real
Debian mirror side by side; see [CONTRACT.md](./CONTRACT.md) for the
package format and the sandbox a package runs in.

## Adding a package

1. `pool/<name>/manifest.json` — Debian-control-style metadata (`Package`,
   `Version`, `Description`, optionally `Depends`).
2. `pool/<name>/<name>.js` — the entry point: `module.exports = async
   function run(ctx) { ... }`. See existing packages (`pool/fastfetch`,
   `pool/cowsay`) for examples, and CONTRACT.md for what `ctx` exposes.
3. `node build.js` to regenerate the index, then commit everything
   (including the regenerated `dists/`) and open a PR.

## How to upload packages?

Currently, only through pull requests.
