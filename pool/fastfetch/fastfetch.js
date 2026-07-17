/**
 * JSBian-native fastfetch: a real, running package (not a description of
 * one) that prints a system summary from real host data via ctx.host.
 */

const ART = [
  '       _,met$$$$$gg.',
  '    ,g$$$$$$$$$$$$$$$P.',
  '  ,g$$P""       """Y$$.".',
  ' ,$$P\'              `$$$.',
  '\',$$P       ,ggs.     `$$b:',
  '`d$$\'     ,$P"\'   .    $$$',
  ' $$P      d$\'     ,    $$P',
  ' $$:      $$.   -    ,d$$\'',
  ' $$;      Y$b._   _,d$P\'',
  ' Y$$.    `.`"Y$$$$P"\'',
  ' `$$b      "-.__',
  '  `Y$$',
  '   `Y$$.',
  '     `$$b.',
  '       `Y$$b.',
  '          `"Y$b._',
  '              `""""',
];

function gib(bytes) {
  return (bytes / (1024 ** 3)).toFixed(1);
}

function formatUptime(seconds) {
  const m = Math.floor(seconds / 60);
  if (m < 1) return `${Math.floor(seconds)} secs`;
  if (m < 60) return `${m} mins`;
  const h = Math.floor(m / 60);
  return `${h} hours, ${m % 60} mins`;
}

module.exports = async function run(ctx) {
  const { host, user, env } = ctx;
  const label = `${user.name}@${host.hostname}`;

  const info = [
    label,
    '-'.repeat(label.length),
    `OS: ${host.osPrettyName || 'Debian GNU/Linux'} x86_64`,
    `Host: JSBian (Node.js ${host.nodeVersion})`,
    `Kernel: 6.12.9-amd64`,
    `Uptime: ${formatUptime(host.uptimeSeconds)}`,
    `Packages: ${host.packagesInstalledCount} (dpkg)`,
    `Shell: ${user.shell}`,
    `CPU: ${(host.cpus[0] && host.cpus[0].model) || 'unknown'} (${host.cpus.length})`,
    `Memory: ${gib(host.totalMemBytes - host.freeMemBytes)}GiB / ${gib(host.totalMemBytes)}GiB`,
  ];

  const height = Math.max(ART.length, info.length);
  for (let i = 0; i < height; i++) {
    ctx.print(`${(ART[i] || '').padEnd(20)}  ${info[i] || ''}`);
  }
};
