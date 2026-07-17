/**
 * A real full-screen nano-style editor: title bar, scrolling edit area,
 * status line, and a two-row shortcut bar, driven by raw keypresses via
 * ctx.term. Not every real-nano feature is here (no justify, spell-check,
 * multi-buffer, undo/redo, syntax highlighting, mouse) — but movement,
 * insert/delete, save, exit, cut/paste, search, and help are real and
 * keyboard-driven, not a menu of typed commands.
 *
 * Falls back to a simple line editor (see runLineEditor below) when stdin
 * isn't a real TTY — a full-screen UI needs a real terminal to draw into.
 */

const CTRL = { G: 'g', O: 'o', X: 'x', K: 'k', U: 'u', W: 'w', C: 'c' };

function esc(s) { return `\x1b[${s}`; }
function moveTo(row, col) { return esc(`${row};${col}H`); }
function clearLine() { return esc('2K'); }
const REVERSE_ON = '\x1b[7m';
const RESET = '\x1b[0m';

function padCols(text, cols) {
  return text.length >= cols ? text.slice(0, cols) : text + ' '.repeat(cols - text.length);
}

function formatShortcuts(entries, cols) {
  const colWidth = 13;
  let out = '';
  for (const [key, label] of entries) {
    out += padCols(`${key} ${label}`, colWidth);
  }
  return padCols(out, cols);
}

const SHORTCUTS_ROW1 = [['^G', 'Help'], ['^O', 'Write Out'], ['^W', 'Where Is'], ['^K', 'Cut Line'], ['^C', 'Cur Pos']];
const SHORTCUTS_ROW2 = [['^X', 'Exit'], ['^U', 'Paste'], ['Arrows', 'Move'], ['PgUp/Dn', 'Scroll']];

function editHeightOf(term) {
  return Math.max(1, term.rows - 4);
}

function clampCol(state) {
  const len = state.lines[state.cursorRow].length;
  if (state.cursorCol > len) state.cursorCol = len;
  if (state.cursorCol < 0) state.cursorCol = 0;
}

function insertText(state, text) {
  const line = state.lines[state.cursorRow];
  state.lines[state.cursorRow] = line.slice(0, state.cursorCol) + text + line.slice(state.cursorCol);
  state.cursorCol += text.length;
  state.modified = true;
}

function render(ctx, state) {
  const { rows, cols } = ctx.term;
  const editHeight = editHeightOf(ctx.term);

  if (state.cursorRow < state.topRow) state.topRow = state.cursorRow;
  if (state.cursorRow >= state.topRow + editHeight) state.topRow = state.cursorRow - editHeight + 1;

  let out = '';
  const title = ` JSBian nano-lite 1.0    ${state.filename}${state.modified ? ' (modified)' : ''}`;
  out += moveTo(1, 1) + REVERSE_ON + padCols(title, cols) + RESET;

  for (let i = 0; i < editHeight; i++) {
    const idx = state.topRow + i;
    const text = idx < state.lines.length ? state.lines[idx] : '~';
    out += moveTo(2 + i, 1) + clearLine() + text.slice(0, cols);
  }

  out += moveTo(rows - 2, 1) + clearLine() + (state.message || '').slice(0, cols);
  out += moveTo(rows - 1, 1) + REVERSE_ON + formatShortcuts(SHORTCUTS_ROW1, cols) + RESET;
  out += moveTo(rows, 1) + REVERSE_ON + formatShortcuts(SHORTCUTS_ROW2, cols) + RESET;

  const screenRow = 2 + (state.cursorRow - state.topRow);
  const screenCol = 1 + state.cursorCol;
  out += moveTo(screenRow, screenCol);

  ctx.term.write(out);
}

/** A single-line prompt on the status line, reusing the already-open key reader. Returns the typed string, or null if cancelled (Ctrl+C/Escape). */
async function promptLine(ctx, keys, promptText, initial = '') {
  const { rows, cols } = ctx.term;
  let buf = initial;
  while (true) {
    ctx.term.write(moveTo(rows - 2, 1) + clearLine() + (promptText + buf).slice(0, cols));
    ctx.term.write(moveTo(rows - 2, Math.min(cols, promptText.length + buf.length + 1)));

    const key = await keys.next();
    if (key.name === 'close') return null;
    if (key.ctrl && key.name === 'c') return null;
    if (key.name === 'escape') return null;
    if (key.name === 'return' || key.name === 'enter') return buf;
    if (key.name === 'backspace') { buf = buf.slice(0, -1); continue; }
    if (!key.ctrl && !key.meta && key.sequence && key.sequence.length >= 1 && key.sequence.charCodeAt(0) >= 32) buf += key.sequence;
  }
}

/** Y/N/^C prompt in the classic nano style. Returns true/false, or null if cancelled. */
async function promptYesNo(ctx, keys, promptText) {
  const { rows, cols } = ctx.term;
  ctx.term.write(moveTo(rows - 2, 1) + clearLine() + `${promptText} Y Yes   N No   ^C Cancel`.slice(0, cols));
  while (true) {
    const key = await keys.next();
    if (key.name === 'close') return null;
    if (key.ctrl && key.name === 'c') return null;
    const ch = (key.sequence || '').toLowerCase();
    if (ch === 'y') return true;
    if (ch === 'n') return false;
  }
}

async function doSave(ctx, keys, state) {
  const name = await promptLine(ctx, keys, 'File Name to Write: ', state.filename);
  if (name === null) { state.message = 'Cancelled'; return false; }
  const finalName = name || state.filename;
  ctx.writeFile(finalName, state.lines.join('\n') + '\n');
  state.filename = finalName;
  state.modified = false;
  state.message = `Wrote ${state.lines.length} line(s) to ${finalName}`;
  return true;
}

async function showHelp(ctx, keys) {
  const { rows, cols } = ctx.term;
  const helpLines = [
    ' JSBian nano-lite — Help',
    '',
    '   ^G  Help              ^O  Write Out (save)     ^X  Exit',
    '   ^K  Cut line           ^U  Paste cut line(s)     ^W  Search',
    '   ^C  Show cursor pos    Arrows  Move              Home/End  Line start/end',
    '   PgUp/PgDn  Scroll      Backspace/Delete  Delete  Enter  New line',
    '',
    ' Not implemented (unlike real nano): justify, spell-check, multiple',
    ' buffers, undo/redo, syntax highlighting, mouse support.',
    '',
    ' Press any key to return to the editor.',
  ];
  let out = esc('2J') + moveTo(1, 1);
  helpLines.forEach((line, i) => { out += moveTo(i + 1, 1) + line.slice(0, cols); });
  ctx.term.write(out);
  await keys.next();
}

function searchForward(state, term) {
  if (!term) return false;
  const n = state.lines.length;
  for (let step = 1; step <= n; step++) {
    const row = (state.cursorRow + step) % n;
    const from = row === state.cursorRow ? state.cursorCol + 1 : 0;
    const idx = state.lines[row].indexOf(term, from);
    if (idx !== -1) { state.cursorRow = row; state.cursorCol = idx; return true; }
  }
  return false;
}

/** Returns true when the editor should quit. */
async function handleKey(ctx, keys, state, key) {
  const editHeight = editHeightOf(ctx.term);
  const wasCut = state.lastActionCut;
  state.lastActionCut = false;
  state.message = '';

  if (key.name === 'close') return true; // reader was closed out from under us — bail cleanly

  if (key.ctrl && key.name === CTRL.X) {
    if (state.modified) {
      const save = await promptYesNo(ctx, keys, 'Save modified buffer?');
      if (save === null) { state.message = 'Cancelled'; return false; }
      if (save && !(await doSave(ctx, keys, state))) return false;
    }
    return true;
  }
  if (key.ctrl && key.name === CTRL.O) { await doSave(ctx, keys, state); return false; }
  if (key.ctrl && key.name === CTRL.G) { await showHelp(ctx, keys); return false; }
  if (key.ctrl && key.name === CTRL.W) {
    const term = await promptLine(ctx, keys, 'Search: ');
    if (term) state.message = searchForward(state, term) ? '' : `"${term}" not found`;
    return false;
  }
  if (key.ctrl && key.name === CTRL.C) {
    state.message = `line ${state.cursorRow + 1}/${state.lines.length}, col ${state.cursorCol + 1}`;
    return false;
  }
  if (key.ctrl && key.name === CTRL.K) {
    const cut = state.lines.splice(state.cursorRow, 1);
    if (!state.lines.length) state.lines = [''];
    state.clipboard = wasCut ? (state.clipboard || []).concat(cut) : cut;
    state.lastActionCut = true;
    if (state.cursorRow >= state.lines.length) state.cursorRow = state.lines.length - 1;
    state.cursorCol = 0;
    state.modified = true;
    return false;
  }
  if (key.ctrl && key.name === CTRL.U) {
    if (state.clipboard && state.clipboard.length) {
      state.lines.splice(state.cursorRow, 0, ...state.clipboard);
      state.cursorRow += state.clipboard.length;
      state.modified = true;
    }
    return false;
  }

  if (key.name === 'up') { if (state.cursorRow > 0) { state.cursorRow--; clampCol(state); } return false; }
  if (key.name === 'down') { if (state.cursorRow < state.lines.length - 1) { state.cursorRow++; clampCol(state); } return false; }
  if (key.name === 'left') {
    if (state.cursorCol > 0) state.cursorCol--;
    else if (state.cursorRow > 0) { state.cursorRow--; state.cursorCol = state.lines[state.cursorRow].length; }
    return false;
  }
  if (key.name === 'right') {
    const line = state.lines[state.cursorRow];
    if (state.cursorCol < line.length) state.cursorCol++;
    else if (state.cursorRow < state.lines.length - 1) { state.cursorRow++; state.cursorCol = 0; }
    return false;
  }
  if (key.name === 'home') { state.cursorCol = 0; return false; }
  if (key.name === 'end') { state.cursorCol = state.lines[state.cursorRow].length; return false; }
  if (key.name === 'pageup') { state.cursorRow = Math.max(0, state.cursorRow - editHeight); clampCol(state); return false; }
  if (key.name === 'pagedown') { state.cursorRow = Math.min(state.lines.length - 1, state.cursorRow + editHeight); clampCol(state); return false; }

  if (key.name === 'backspace') {
    if (state.cursorCol > 0) {
      const line = state.lines[state.cursorRow];
      state.lines[state.cursorRow] = line.slice(0, state.cursorCol - 1) + line.slice(state.cursorCol);
      state.cursorCol--;
      state.modified = true;
    } else if (state.cursorRow > 0) {
      const prevLen = state.lines[state.cursorRow - 1].length;
      state.lines[state.cursorRow - 1] += state.lines[state.cursorRow];
      state.lines.splice(state.cursorRow, 1);
      state.cursorRow--;
      state.cursorCol = prevLen;
      state.modified = true;
    }
    return false;
  }
  if (key.name === 'delete') {
    const line = state.lines[state.cursorRow];
    if (state.cursorCol < line.length) {
      state.lines[state.cursorRow] = line.slice(0, state.cursorCol) + line.slice(state.cursorCol + 1);
      state.modified = true;
    } else if (state.cursorRow < state.lines.length - 1) {
      state.lines[state.cursorRow] += state.lines[state.cursorRow + 1];
      state.lines.splice(state.cursorRow + 1, 1);
      state.modified = true;
    }
    return false;
  }
  if (key.name === 'return' || key.name === 'enter') {
    const line = state.lines[state.cursorRow];
    const before = line.slice(0, state.cursorCol);
    const after = line.slice(state.cursorCol);
    state.lines.splice(state.cursorRow, 1, before, after);
    state.cursorRow++;
    state.cursorCol = 0;
    state.modified = true;
    return false;
  }
  if (key.name === 'tab') { insertText(state, '\t'); return false; }

  if (!key.ctrl && !key.meta && key.sequence && key.sequence.length >= 1 && key.sequence.charCodeAt(0) >= 32) {
    insertText(state, key.sequence);
  }
  return false;
}

async function runFullScreenEditor(ctx, filename) {
  let lines = [''];
  if (ctx.exists(filename)) {
    lines = ctx.readFile(filename).split('\n');
    if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
    if (!lines.length) lines = [''];
  }

  const state = {
    lines, cursorRow: 0, cursorCol: 0, topRow: 0, modified: false,
    message: ctx.exists(filename) ? '' : 'New File', filename, clipboard: null, lastActionCut: false,
  };

  ctx.term.write('\x1b[?1049h'); // enter alternate screen (restores the real screen exactly, on exit)
  const keys = ctx.term.openKeyReader();
  try {
    render(ctx, state);
    while (true) {
      const key = await keys.next();
      const quit = await handleKey(ctx, keys, state, key);
      if (quit) break;
      render(ctx, state);
    }
  } finally {
    keys.close();
    ctx.term.write('\x1b[?1049l'); // exit alternate screen — Shell also does this as a safety net regardless
  }
}

/** Simple line editor (p/a/i/r/d/w/wq/q over a numbered buffer) — used when there's no real TTY to draw a full-screen UI into. */
async function runLineEditor(ctx, filename) {
  let lines = [];
  if (ctx.exists(filename)) {
    lines = ctx.readFile(filename).split('\n');
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
  }
  let modified = false;

  const printBuffer = () => {
    if (!lines.length) { ctx.print('(empty file)'); return; }
    lines.forEach((line, i) => ctx.print(`${String(i + 1).padStart(4)}  ${line}`));
  };
  const save = () => {
    ctx.writeFile(filename, lines.length ? lines.join('\n') + '\n' : '');
    modified = false;
    ctx.print(`Wrote ${lines.length} line(s) to ${filename}`);
  };

  ctx.print(`JSBian nano-lite (no TTY — line-editor mode) — editing ${filename} (${lines.length} line(s)). Type 'help' for commands.`);
  printBuffer();

  while (true) {
    const raw = (await ctx.readLine('nano> ')).trim();
    if (!raw) continue;
    const spaceIdx = raw.indexOf(' ');
    const op = spaceIdx === -1 ? raw : raw.slice(0, spaceIdx);
    const rest = spaceIdx === -1 ? '' : raw.slice(spaceIdx + 1);

    if (op === 'help' || op === '?') {
      ctx.print('Commands: p, a <text>, i <n> <text>, r <n> <text>, d <n>, w, wq, q');
    } else if (op === 'p') {
      printBuffer();
    } else if (op === 'a') {
      lines.push(rest); modified = true;
    } else if (op === 'i' || op === 'r') {
      const m = /^(\d+)\s?(.*)$/.exec(rest);
      const n = m ? parseInt(m[1], 10) : NaN;
      if (!m || n < 1 || (op === 'r' && n > lines.length) || (op === 'i' && n > lines.length + 1)) { ctx.print(`usage: ${op} <line#> <text>`); continue; }
      if (op === 'i') lines.splice(n - 1, 0, m[2]); else lines[n - 1] = m[2];
      modified = true;
    } else if (op === 'd') {
      const n = parseInt(rest, 10);
      if (!Number.isInteger(n) || n < 1 || n > lines.length) { ctx.print('usage: d <line#>'); continue; }
      lines.splice(n - 1, 1); modified = true;
    } else if (op === 'w') {
      save();
    } else if (op === 'wq') {
      save(); break;
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
}

module.exports = async function run(ctx) {
  const filename = ctx.args[0];
  if (!filename) { ctx.print('Usage: nano <file>'); return; }

  if (ctx.term && ctx.term.isTTY) await runFullScreenEditor(ctx, filename);
  else await runLineEditor(ctx, filename);
};
