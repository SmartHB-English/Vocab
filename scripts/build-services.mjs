import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const code = readFileSync(new URL('services/api-client.js', root), 'utf8').trimEnd();
const start = '/* BEGIN GENERATED services/api-client.js */';
const end = '/* END GENERATED services/api-client.js */';
const bundle = `${start}\n${code}\n${end}`;
const check = process.argv.includes('--check');
let stale = false;
for (const file of ['index.html', 'parent.html', 'sw.js', 'parent-sw.js']) {
  const path = new URL(file, root);
  const source = readFileSync(path, 'utf8');
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  if (from < 0 || to < from) throw new Error(`Missing generated markers: ${file}`);
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const next = source.slice(0, from) + bundle.replaceAll('\n', newline) + source.slice(to + end.length);
  if (source !== next) {
    if (check) { console.error(`Stale service bundle: ${file}`); stale = true; }
    else writeFileSync(path, next);
  }
}
if (stale) process.exitCode = 1;
