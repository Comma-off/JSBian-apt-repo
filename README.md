# JSBian-apt-repo

The APT repository for [JSBian](https://github.com/Comma-off/JSBian) — a
persistent, Debian-compatible environment simulator running in Node.js.

Real Debian mirrors serve genuine `.deb`s: real ELF binaries JSBian can
unpack and inspect, but never execute (there's no Linux kernel underneath
it, just Node). This repo is the other half — packages that are actually
**runnable**, because they're plain JavaScript instead of native machine
code. `apt` on a JSBian install discovers packages here live, from a single
[`packages.json`](./packages.json) index — no build step, no GitHub API
rate limit, cheap enough that JSBian re-fetches it automatically on every
start. See [CONTRACT.md](./CONTRACT.md) for the full schema, the sandbox a
package runs in, and how to stand up your own repo with this same
structure.

## Adding a package

1. Add an entry to [`packages.json`](./packages.json) — `Package`,
   `Version`, `Description` are required; `Architecture`, `Maintainer`,
   `Depends` are optional. `Package` must match the `pool/<name>/`
   directory name you use in step 2.
2. `pool/<name>/<name>.js` — the entry point: `module.exports = async
   function run(ctx) { ... }`. See existing packages (`pool/fastfetch`,
   `pool/cowsay`, `pool/hello`) for examples, and CONTRACT.md for what
   `ctx` exposes.
3. Commit both and open a PR — that's it, no separate build/index step.
   Once merged, `apt update` on a JSBian install picks it up immediately.

## How to upload packages?

Currently, only through pull requests.
