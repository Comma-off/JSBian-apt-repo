# JSBian package contract

A JSBian-native package is a plain `.js` file JSBian's shell can actually
execute (via a sandboxed `vm` context) — unlike real Debian `.deb`s, whose
ELF binaries JSBian can only report on, never run.

## Repo structure

```
packages.json                the whole index: one JSON array, one file
pool/<name>/<name>.js        each package's entry point
```

That's the entire structure. There's no build step and no per-package
manifest — `apt update` on the JSBian side fetches `packages.json` with a
single plain HTTP request (not the GitHub API, so there's no rate limit to
worry about), which is also what makes it cheap enough for JSBian to
auto-refresh on every start.

## packages.json

A JSON array, one object per package:

```json
[
  {
    "Package": "cowsay",
    "Version": "1.0.0-jsbian1",
    "Architecture": "all",
    "Maintainer": "Comma",
    "Depends": "",
    "Description": "configurable talking cow (JSBian-native, actually runs)"
  }
]
```

| Field | Required | Notes |
|---|---|---|
| `Package` | yes | must match the `pool/<name>/` directory name |
| `Version` | yes | freeform, Debian-style versions are conventional (`1.0.0-jsbian1`) |
| `Architecture` | no | conventionally `all` — packages are plain JS, not compiled |
| `Maintainer` | no | who to credit/blame; shown in `apt show` |
| `Depends` | no | comma-separated package names; alternatives (`a \| b`) and version constraints (`(>= 1.0)`) are accepted but only the first alternative is ever resolved |
| `Description` | yes | one line is enough; shown in `apt search`/`apt show`/`dpkg -l` |

`Filename` is **not** part of the schema — it's always derived as
`pool/<Package>/<Package>.js`, so there's one less thing that can drift out
of sync with reality.

## Entry point

`pool/<name>/<name>.js`:

```js
module.exports = async function run(ctx) {
  ctx.print(`Hello from ${ctx.args[0] || 'the world'}`);
};
```

### The `ctx` object

Packages run inside a locked-down `vm` context — no `require`, `process`,
`fs`, or network access. Everything a package can do goes through `ctx`:

| Member | Type | Notes |
|---|---|---|
| `ctx.print(line)` | fn | write a line to the terminal |
| `ctx.args` | string[] | argv, command name excluded |
| `ctx.env` | object | read-only snapshot of shell env vars |
| `ctx.cwd` | string | current working directory |
| `ctx.user` | `{name, uid, gid, home}` | current user snapshot |
| `ctx.readFile(path)` | fn → string | read a VFS file (permission-checked like `cat`); throws if missing/denied |
| `ctx.exists(path)` | fn → boolean | check a VFS path |
| `ctx.host` | object | `{hostname, cpus, totalMemBytes, freeMemBytes, uptimeSeconds, nodeVersion, packagesInstalledCount}` — real host data, read-only |
| `ctx.sleep(ms)` | fn → Promise | cooperative delay, capped at 3000ms |

No VFS **write** access, no way to spawn processes, no way to reach the
network. A package that wants to misbehave is limited to printing garbage
or hanging (execution is time-boxed by the host regardless).

This is sandboxing appropriate for a simulated learning project, not a
hardened security boundary — don't run untrusted third-party packages
through this and assume it's bulletproof.

## Setting up your own repo

This structure isn't special to `Comma-off/JSBian-apt-repo` — anyone can
host one. Fork this repo, or start a fresh one with just `packages.json`
and a `pool/` directory in the layout above, push it to GitHub, and point a
JSBian install at it by adding a line to `/etc/apt/sources.list`:

```
deb-github <owner>/<repo> <branch>
```

For example, this repo's own line (JSBian's default) is:

```
deb-github Comma-off/JSBian-apt-repo main
```

Multiple `deb-github` (and real `deb`) lines can coexist — `apt update`
fetches all configured sources and merges them. Where a package name
exists in more than one source, whichever was fetched last wins, so list
order in `sources.list` matters if you want one source to take priority.
