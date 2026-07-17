# JSBian-apt-repo

The APT repository for [JSBian](https://github.com/Comma-off/JSBian) — a
persistent, Debian-compatible environment simulator running in Node.js.

Real Debian mirrors serve genuine `.deb`s: real ELF binaries JSBian can
unpack and inspect, but never execute (there's no Linux kernel underneath
it, just Node). This repo is the other half — packages that are actually
**runnable**, because they're plain JavaScript instead of native machine
code. See [CONTRACT.md](./CONTRACT.md) for the full package format, the
sandbox a package runs in, and how to stand up your own repo with this
same structure.

## Adding a package

1. `pool/<name>/manifest.json` — metadata (`Package`, `Version`,
   `Description` required; `Architecture`, `Maintainer`, `Depends`
   optional). `Package` must match the `pool/<name>/` directory name.
2. `pool/<name>/<name>.js` — the entry point: `module.exports = async
   function run(ctx) { ... }`. See existing packages (`pool/fastfetch`,
   `pool/cowsay`, `pool/hello`) for examples, and CONTRACT.md for what
   `ctx` exposes.
3. Commit both and open a PR. **Don't touch `packages.json`** — once your
   PR merges to `main`, [CI](./.github/workflows/update-index.yml)
   validates your package and regenerates it automatically.

## How to upload packages?

Currently, only through pull requests.
