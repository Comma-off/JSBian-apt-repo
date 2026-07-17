/**
 * A line-oriented text editor in the spirit of nano — not a full-screen
 * clone. JSBian's package sandbox has no raw-keypress/cursor-positioning
 * API (yet), only line-based ctx.readLine, so this works like a small `ed`:
 * a command prompt over a line-numbered buffer, not arrow-key navigation.
 */

function printBuffer(ctx, lines) {
  if (!lines.length) { ctx.print('(empty file)'); return; }
  lines.forEach((line, i) => ctx.print(`${String(i + 1).padStart(4)}  ${line}`));
}

function printHelp(ctx) {
  ctx.print('Commands:');
  ctx.print('  p                 print the buffer with line numbers');
  ctx.print('  a <text>          append a line at the end');
  ctx.print('  i <n> <text>      insert a line before line n');
  ctx.print('  r <n> <text>      replace line n');
  ctx.print('  d <n>             delete line n');
  ctx.print('  w                 write (save) the file');
  ctx.print('  wq                write and quit');
  ctx.print('  q                 quit (asks to save if modified)');
  ctx.print('  help              show this list');
}

module.exports = async function run(ctx) {
  const filename = ctx.args[0];
  if (!filename) {
    ctx.print('Usage: nano <file>');
    return;
  }

  let lines = [];
  if (ctx.exists(filename)) {
    const content = ctx.readFile(filename);
    lines = content.split('\n');
    if (lines.length && lines[lines.length - 1] === '') lines.pop(); // drop the trailing blank from a final newline
  }
  let modified = false;

  const save = () => {
    ctx.writeFile(filename, lines.length ? lines.join('\n') + '\n' : '');
    modified = false;
    ctx.print(`Wrote ${lines.length} line(s) to ${filename}`);
  };

  ctx.print(`JSBian nano-lite — editing ${filename} (${lines.length} line(s)). Type 'help' for commands.`);
  printBuffer(ctx, lines);

  while (true) {
    const raw = (await ctx.readLine('nano> ')).trim();
    if (!raw) continue;

    const spaceIdx = raw.indexOf(' ');
    const op = spaceIdx === -1 ? raw : raw.slice(0, spaceIdx);
    const rest = spaceIdx === -1 ? '' : raw.slice(spaceIdx + 1);

    if (op === 'help' || op === '?') {
      printHelp(ctx);
    } else if (op === 'p') {
      printBuffer(ctx, lines);
    } else if (op === 'a') {
      lines.push(rest);
      modified = true;
    } else if (op === 'i' || op === 'r') {
      const m = /^(\d+)\s?(.*)$/.exec(rest);
      const n = m ? parseInt(m[1], 10) : NaN;
      if (!m || n < 1 || (op === 'r' && n > lines.length) || (op === 'i' && n > lines.length + 1)) {
        ctx.print(`usage: ${op} <line#> <text>`);
        continue;
      }
      if (op === 'i') lines.splice(n - 1, 0, m[2]);
      else lines[n - 1] = m[2];
      modified = true;
    } else if (op === 'd') {
      const n = parseInt(rest, 10);
      if (!Number.isInteger(n) || n < 1 || n > lines.length) { ctx.print('usage: d <line#>'); continue; }
      lines.splice(n - 1, 1);
      modified = true;
    } else if (op === 'w') {
      save();
    } else if (op === 'wq') {
      save();
      break;
    } else if (op === 'q') {
      if (modified) {
        const answer = (await ctx.readLine('Save modified buffer? (y/n) ')).trim().toLowerCase();
        if (answer === 'y' || answer === 'yes') save();
      }
      break;
    } else {
      ctx.print(`Unknown command '${op}'. Type 'help' for commands.`);
    }
  }
};
