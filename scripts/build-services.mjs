import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
/* 원본 하나를 여러 대상의 표시 사이에 박아 넣는다. 짝을 늘리려면 여기에 한 줄 더한다 */
const pairs = [
  { source: 'services/api-client.js', targets: ['index.html', 'parent.html', 'sw.js', 'parent-sw.js', 'teacher.html'] },
  { source: 'services/shared-ui.js', targets: ['index.html', 'teacher.html'] },
];
const check = process.argv.includes('--check');
let stale = false;
for (const { source: name, targets } of pairs) {
  const code = readFileSync(new URL(name, root), 'utf8').replace(/\r\n/g, '\n').trimEnd();   // CRLF 로 받아도 \r\r\n 이 되지 않게
  const start = `/* BEGIN GENERATED ${name} */`;
  const end = `/* END GENERATED ${name} */`;
  const bundle = `${start}\n${code}\n${end}`;
  for (const file of targets) {
    const path = new URL(file, root);
    const source = readFileSync(path, 'utf8');
    const from = source.indexOf(start);
    const to = source.indexOf(end, from);
    if (from < 0 || to < from) throw new Error(`Missing generated markers: ${file} (${name})`);
    const newline = source.includes('\r\n') ? '\r\n' : '\n';
    const next = source.slice(0, from) + bundle.replaceAll('\n', newline) + source.slice(to + end.length);
    if (source !== next) {
      if (check) { console.error(`Stale service bundle: ${file} (${name})`); stale = true; }
      else writeFileSync(path, next);
    }
  }
}
if (stale) process.exitCode = 1;
