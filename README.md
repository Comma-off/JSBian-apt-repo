# JSBian-apt-repo

The APT repository for [JSBian](https://github.com/Comma-off/JSBian) — a
persistent, Debian-compatible environment simulator running in Node.js.

Real Debian mirrors serve genuine `.deb`s: real ELF binaries JSBian can
unpack and inspect, but never execute (there's no Linux kernel underneath
it, just Node). This repo is the other half — packages that are actually
**runnable**, because they're plain JavaScript instead of native machine
code. `apt` on a JSBian install discovers packages here live, by listing
`pool/` through the GitHub API — see [CONTRACT.md](./CONTRACT.md) for the
package format and the sandbox a package runs in.

## Adding a package

1. `pool/<name>/manifest.json` — Debian-control-style metadata (`Package`,
   `Version`, `Description`, optionally `Depends`). `Package` must match
   the `pool/<name>/` directory name.
2. `pool/<name>/<name>.js` — the entry point: `module.exports = async
   function run(ctx) { ... }`. See existing packages (`pool/fastfetch`,
   `pool/cowsay`, `pool/hello`) for examples, and CONTRACT.md for what
   `ctx` exposes.
3. Commit and open a PR — that's it, no build/index step. Once merged,
   `apt update` on a JSBian install picks it up immediately.

## How to upload packages?

Currently, only through pull requests.
