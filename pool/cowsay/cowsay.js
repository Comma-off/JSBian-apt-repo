/** JSBian-native cowsay — demonstrates ctx.args in a real running package. */

function bubble(text) {
  const width = Math.min(40, Math.max(text.length, 4));
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > width) { lines.push(line.trim()); line = ''; }
    line += ' ' + w;
  }
  if (line.trim()) lines.push(line.trim());
  if (!lines.length) lines.push('');

  const w = Math.max(...lines.map((l) => l.length));
  const top = ' ' + '_'.repeat(w + 2);
  const bottom = ' ' + '-'.repeat(w + 2);
  const body = lines.map((l, i) => {
    const pad = l.padEnd(w);
    const border = lines.length === 1 ? ['<', '>'] : i === 0 ? ['/', '\\'] : i === lines.length - 1 ? ['\\', '/'] : ['|', '|'];
    return `${border[0]} ${pad} ${border[1]}`;
  });
  return [top, ...body, bottom];
}

const COW = [
  '        \\   ^__^',
  '         \\  (oo)\\_______',
  '            (__)\\       )\\/\\',
  '                ||----w |',
  '                ||     ||',
];

module.exports = async function run(ctx) {
  const message = ctx.args.length ? ctx.args.join(' ') : 'Moo! Try: cowsay "your message here"';
  for (const line of bubble(message)) ctx.print(line);
  for (const line of COW) ctx.print(line);
};
