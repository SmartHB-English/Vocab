import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../fixtures/legacy/Code.gs', import.meta.url), 'utf8');
const now = '2026-10-07T12:00:00.000Z';
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return new Date(now).getTime(); }
  static [Symbol.hasInstance](value) { return value instanceof Date; }
}
function formatDate(date, zone, format) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(p => [p.type, p.value]));
  const {year: y, month: m, day: d, hour: h, minute: min} = parts;
  const formats = {
    'yyyy-MM-dd': `${y}-${m}-${d}`, 'yyyy-MM': `${y}-${m}`,
    'yyyy년 M월': `${y}년 ${Number(m)}월`, 'MM/dd HH:mm': `${m}/${d} ${h}:${min}`,
    'M/d|H|mm': `${Number(m)}/${Number(d)}|${Number(h)}|${min}`,
  };
  if (!(format in formats)) throw new Error(`Unimplemented fixture date format: ${format}`);
  return formats[format];
}
export const plain = value => JSON.parse(JSON.stringify(value));
export function legacy(tables = {}) {
  const ctx = vm.createContext({ Date: FixedDate,
    Session: { getScriptTimeZone: () => 'Asia/Seoul' }, Utilities: { formatDate },
  });
  vm.runInContext(source, ctx, { filename: 'legacy/Code.gs' });
  ctx.rows_ = name => structuredClone(tables[name] ?? []);
  ctx.단어장목록 = () => [{ 이름: '교재A', 색: 'orange' }, { 이름: '교재B', 색: 'blue' }];
  return ctx;
}
export function record({ name = '테스트학생', at = '2026-10-07T01:00:00Z', score = 80, kind = '', book = '교재A', range = '1~10' } = {}) {
  return [new Date(at), '', name, book, range, '스펠링', 10, score / 10, score, 0, 0, 30, 'O', '', kind, ''];
}
