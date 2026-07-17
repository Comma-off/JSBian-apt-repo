# JSBian package contract

A JSBian-native package is a plain `.js` file JSBian's shell can actually
execute (via a sandboxed `vm` context) — unlike real Debian `.deb`s, whose
ELF binaries JSBian can only report on, never run.

## Layout

```
pool/<name>/manifest.json   Debian-control-style metadata for this package
pool/<name>/<name>.js       the entry point
```

That's it — **no build step**. `apt update` on the JSBian side discovers
packages by listing this repo's `pool/` directory through the GitHub
Contents API and reading each `pool/<name>/manifest.json` directly, so a
package is installable the moment it's pushed to `main`. (There's no
committed `dists/.../Packages` index to forget to regenerate — that was
JSBian's first design here, and it silently went stale the first time
someone added a package without re-running a build script. Don't reintroduce
one.)

`manifest.Package` must exactly match its `pool/<name>/` directory name.

## manifest.json

```json
{
  "Package": "fastfetch",
  "Version": "1.0.0-jsbian1",
  "Architecture": "all",
  "Depends": "",
  "Description": "neofetch-like tool for fetching system information (JSBian-native, actually runs)"
}
```

## Entry point

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
