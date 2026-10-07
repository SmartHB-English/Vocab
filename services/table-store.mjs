import { createSeoulDate } from './seoul-date.mjs';
const SeoulDate = createSeoulDate();
const copy = value => {
  if (value instanceof Date) return new SeoulDate(value.getTime());
  if (Array.isArray(value)) return value.map(copy);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, copy(v)]));
  return value;
};
const populated = value => value !== '' && value !== null && value !== undefined;
const integer = value => Number.isInteger(value) && value > 0;

export function decodeCell(cell, DateClass = SeoulDate) {
  switch (cell.type) {
    case 'blank': return '';
    case 'string': case 'number': case 'boolean': return cell.value;
    case 'datetime': return new DateClass(cell.value);
    case 'date': return new DateClass(cell.value + 'T00:00:00');
    case 'time': return new DateClass('1899-12-30T' + cell.value);
    default: throw new Error(`Unsupported snapshot cell type: ${cell.type}`);
  }
}

export class TableStore {
  constructor(sheets = []) {
    this.sheets = sheets.map(data => new Table(this, data));
    this.deleted = new Set();
  }
  static fromSnapshot(snapshot) {
    return new TableStore(snapshot.content.sheets.map(sheet => {
      const cells = {};
      for (const c of sheet.cells) {
        if (c.excelType === 'f') throw new Error('Formula evaluation requires explicit migration support');
        cells[`${c.row}:${c.column}`] = { value: decodeCell(c.value), note: c.note ?? '', format: c.format ?? 'General' };
      }
      return { name: sheet.name, maxRows: Math.max(1000, sheet.maxRow), maxColumns: Math.max(26, sheet.maxColumn), cells, hidden: sheet.state !== 'visible' };
    }));
  }
  getSheetByName(name) { return this.sheets.find(s => s.name === name) ?? null; }
  getSheets() { return [...this.sheets]; }
  getNumSheets() { return this.sheets.length; }
  insertSheet(name) {
    if (this.getSheetByName(name)) throw new Error('Duplicate sheet name');
    const sheet = new Table(this, { name, cells: {}, maxRows: 1000, maxColumns: 26 });
    sheet.dirty = true;
    this.sheets.push(sheet);
    return sheet;
  }
  deleteSheet(sheet) {
    if (!this.sheets.includes(sheet)) throw new Error('Unknown sheet');
    this.sheets.splice(this.sheets.indexOf(sheet), 1);
    this.deleted.add(sheet.name);
  }
  export() { return this.sheets.map(s => s.export()); }
  toast() { return this; }
  setActiveSheet(sheet) { return sheet; }
}

class Table {
  constructor(store, data) {
    this.store = store;
    this.name = data.name;
    this.cells = copy(data.cells ?? {});
    this.maxRows = data.maxRows || 1000;
    this.maxColumns = data.maxColumns || 26;
    this.hidden = !!data.hidden;
    this.dirty = false;
    this.filter = null;
  }
  export() { return copy({ name: this.name, cells: this.cells, maxRows: this.maxRows, maxColumns: this.maxColumns, hidden: this.hidden }); }
  getName() { return this.name; }
  setName(name) {
    if (this.store.getSheetByName(name) && name !== this.name) throw new Error('Duplicate sheet name');
    this.store.deleted.add(this.name); this.name = name; this.dirty = true; return this;
  }
  getLastRow() { return Math.max(0, ...Object.entries(this.cells).filter(([, c]) => populated(c.value)).map(([k]) => Number(k.split(':')[0]))); }
  getLastColumn() { return Math.max(0, ...Object.entries(this.cells).filter(([, c]) => populated(c.value)).map(([k]) => Number(k.split(':')[1]))); }
  getMaxRows() { return this.maxRows; }
  getMaxColumns() { return this.maxColumns; }
  getRange(row, column, height = 1, width = 1) {
    if (typeof row === 'string') {
      const m = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(row);
      if (!m) throw new Error(`Unsupported A1 range: ${row}`);
      const col = s => [...s].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
      column = col(m[1]); row = Number(m[2]);
      width = m[3] ? col(m[3]) - column + 1 : 1;
      height = m[4] ? Number(m[4]) - row + 1 : 1;
    }
    if (![row, column, height, width].every(integer)) throw new Error('Invalid range');
    if (row + height - 1 > this.maxRows || column + width - 1 > this.maxColumns) throw new Error('Range exceeds sheet bounds');
    return new Range(this, row, column, height, width);
  }
  appendRow(values) {
    const row = this.getLastRow() + 1;
    this.maxRows = Math.max(this.maxRows, row);
    this.maxColumns = Math.max(this.maxColumns, values.length);
    this.getRange(row, 1, 1, values.length).setValues([values]);
    return this;
  }
  deleteRow(row) { return this.deleteRows(row, 1); }
  deleteRows(row, count) {
    if (![row, count].every(integer) || row + count - 1 > this.maxRows) throw new Error('Invalid row deletion');
    const cells = {};
    for (const [key, cell] of Object.entries(this.cells)) {
      const [r, c] = key.split(':').map(Number);
      if (r < row) cells[key] = cell;
      else if (r >= row + count) cells[`${r - count}:${c}`] = cell;
    }
    this.cells = cells; this.maxRows -= count; this.dirty = true; return this;
  }
  insertColumnsAfter(column, count) {
    if (![column, count].every(integer) || column > this.maxColumns) throw new Error('Invalid column insertion');
    this.cells = Object.fromEntries(Object.entries(this.cells).map(([key, cell]) => {
      const [r, c] = key.split(':').map(Number); return [`${r}:${c > column ? c + count : c}`, cell];
    }));
    this.maxColumns += count; this.dirty = true; return this;
  }
  clear() { this.cells = {}; this.dirty = true; return this; }
  getFilter() { return this.filter; }
  hideSheet() { this.hidden = true; this.dirty = true; return this; }
  setFrozenRows() { return this; }
  setColumnWidth() { return this; }
  autoResizeColumns() { return this; }
  hideColumns() { return this; }
  clearConditionalFormatRules() { return this; }
}

class Range {
  constructor(sheet, row, column, height, width) { Object.assign(this, { sheet, row, column, height, width }); }
  getRow() { return this.row; }
  getNumRows() { return this.height; }
  getValues() { return this.read('value', ''); }
  getNotes() { return this.read('note', ''); }
  getValue() { return this.getValues()[0][0]; }
  getNote() { return this.getNotes()[0][0]; }
  read(field, fallback) {
    return Array.from({ length: this.height }, (_, r) => Array.from({ length: this.width }, (_, c) =>
      copy(this.sheet.cells[`${this.row + r}:${this.column + c}`]?.[field] ?? fallback)));
  }
  write(field, matrix) {
    if (!Array.isArray(matrix) || matrix.length !== this.height || matrix.some(row => !Array.isArray(row) || row.length !== this.width)) throw new Error('Range shape mismatch');
    for (let r = 0; r < this.height; r++) for (let c = 0; c < this.width; c++) {
      const key = `${this.row + r}:${this.column + c}`;
      const cell = this.sheet.cells[key] ?? { value: '', note: '', format: 'General' };
      cell[field] = copy(matrix[r][c]); this.sheet.cells[key] = cell;
    }
    this.sheet.dirty = true; return this;
  }
  fill(field, value) { return this.write(field, Array.from({ length: this.height }, () => Array(this.width).fill(value))); }
  setValues(values) { return this.write('value', values); }
  setNotes(notes) { return this.write('note', notes); }
  setValue(value) { return this.fill('value', value); }
  setNote(note) { return this.fill('note', note); }
  setNumberFormat(format) { return this.fill('format', format); }
  setFormula() { throw new Error('Formula writes require explicit migration support'); }
  clearContent() { return this.fill('value', ''); }
  clear() {
    for (let r = 0; r < this.height; r++) for (let c = 0; c < this.width; c++) delete this.sheet.cells[`${this.row + r}:${this.column + c}`];
    this.sheet.dirty = true; return this;
  }
  createFilter() { if (this.sheet.filter) throw new Error('Filter already exists'); this.sheet.filter = { remove: () => { this.sheet.filter = null; } }; return this.sheet.filter; }
}
// Spreadsheet presentation is intentionally not part of the data model.
for (const name of ['setBackground','setBackgrounds','setBorder','setFontColor','setFontColors','setFontWeight','setFontWeights','setVerticalAlignment','setWrapStrategy','setDataValidation','clearDataValidations']) {
  Range.prototype[name] = function () { return this; };
}
