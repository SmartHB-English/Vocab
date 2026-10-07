import { createSeoulDate } from './seoul-date.mjs';
const SeoulDate = createSeoulDate();
// A JSON cell payload avoids Firestore's nested-array restriction and preserves Date.
export function pack(value) {
  return JSON.stringify(value, function (key, item) {
    const original = this[key];
    if (original instanceof Date) return { $date: original.getTime() };
    return item;
  });
}
export function unpack(value) {
  return JSON.parse(value, (_, item) => item && typeof item === 'object' && Object.keys(item).length === 1 && '$date' in item ? new SeoulDate(item.$date) : item);
}
export function sheetId(name) {
  return encodeURIComponent(name).replaceAll('.', '%2E');
}
export function publicTable(table) {
  const output = unpack(pack(table));
  if (table.name === '학생') {
    for (const [key, cell] of Object.entries(output.cells)) {
      const [row, column] = key.split(':').map(Number);
      if (row > 1 && [3, 9].includes(column)) { cell.value = ''; cell.note = ''; }
    }
  }
  if (table.name === '설정') {
    for (let row = 2; row <= table.maxRows; row++) {
      const key = String(output.cells[`${row}:1`]?.value ?? '').trim();
      if (['선생님비밀번호', '푸시비밀키'].includes(key)) {
        if (output.cells[`${row}:2`]) { output.cells[`${row}:2`].value = ''; output.cells[`${row}:2`].note = ''; }
      }
    }
  }
  return output;
}
export function tableMetadata(table, position) {
  const cells = Object.entries(table.cells).filter(([, c]) => c.value !== '' && c.value != null);
  return { name: table.name, position, maxRows: table.maxRows, maxColumns: table.maxColumns, hidden: table.hidden,
    lastRow: Math.max(0, ...cells.map(([k]) => Number(k.split(':')[0]))),
    lastColumn: Math.max(0, ...cells.map(([k]) => Number(k.split(':')[1]))) };
}
