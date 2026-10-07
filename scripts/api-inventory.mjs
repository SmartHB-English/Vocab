import { readFileSync } from 'node:fs';

// Static literal candidates only; dynamic calls and server implementation need review.
const root = new URL('../', import.meta.url);
const files = ['index.html', 'parent.html', 'sw.js', 'parent-sw.js'];
const endpoints = new Map();
for (const file of files) {
  const source = readFileSync(new URL(file, root), 'utf8');
  const pattern = /\bapi\(\s*['"]([^'"]+)['"]|\bVocabApi\.post\([^,]+,\s*['"]([^'"]+)['"]|\bfn\s*:\s*['"]([^'"]+)['"]/gu;
  for (const match of source.matchAll(pattern)) {
    const name = match[1] ?? match[2] ?? match[3];
    const line = source.slice(0, match.index).split('\n').length;
    if (!endpoints.has(name)) endpoints.set(name, []);
    endpoints.get(name).push(`${file}:${line}`);
  }
}
console.log('# 기존 웹 API 호출 후보 목록\n');
console.log('생성: `node scripts/api-inventory.mjs`\n');
console.log('정적 리터럴 후보만 수집한다. 동적 호출·주석과 서버의 전체 디스패처는 수동 대조가 필요하다. 실제 사용자 데이터나 서버 응답은 수집하지 않는다.\n');
console.log(`호출 주체: ${files.join(', ')}. 고유 후보: ${endpoints.size}개.\n`);
console.log('| 함수 | 호출 위치 |');
console.log('|---|---|');
for (const [name, sites] of [...endpoints].sort(([a], [b]) => a.localeCompare(b, 'ko'))) {
  console.log(`| ${name} | ${sites.join(', ')} |`);
}
