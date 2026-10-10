// functions/src/index.mjs
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { randomUUID } from "node:crypto";

// services/random-id.mjs
function randomId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = bytes[6] & 15 | 64;
  bytes[8] = bytes[8] & 63 | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// functions/src/admin-firestore.mjs
var wrap = (s) => ({ exists: () => s.exists, data: () => s.data() });
var doc = (db2, path) => db2.doc(path);
var getDoc = (ref) => ref.get().then(wrap);
var setDoc = (ref, data) => ref.set(data);
var runTransaction = (db2, body) => db2.runTransaction((t) => body({
  get: (ref) => t.get(ref).then(wrap),
  set: (ref, data) => {
    t.set(ref, data);
  },
  delete: (ref) => {
    t.delete(ref);
  }
}));

// services/seoul-date.mjs
var NativeDate = Date;
var OFFSET = 9 * 60 * 60 * 1e3;
function createSeoulDate(now = () => NativeDate.now()) {
  return class SeoulDate extends NativeDate {
    constructor(...args) {
      if (!args.length) super(now());
      else if (args.length >= 2) super(NativeDate.UTC(...args) - OFFSET);
      else if (typeof args[0] === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(args[0])) super(args[0] + "+09:00");
      else super(args[0]);
    }
    static now() {
      return now();
    }
    static [Symbol.hasInstance](value) {
      return value instanceof NativeDate;
    }
    local() {
      return new NativeDate(this.getTime() + OFFSET);
    }
    getFullYear() {
      return this.local().getUTCFullYear();
    }
    getMonth() {
      return this.local().getUTCMonth();
    }
    getDate() {
      return this.local().getUTCDate();
    }
    getDay() {
      return this.local().getUTCDay();
    }
    getHours() {
      return this.local().getUTCHours();
    }
    getMinutes() {
      return this.local().getUTCMinutes();
    }
    getSeconds() {
      return this.local().getUTCSeconds();
    }
    getMilliseconds() {
      return this.local().getUTCMilliseconds();
    }
    getTimezoneOffset() {
      return -540;
    }
    setDate(value) {
      const d = this.local();
      d.setUTCDate(value);
      return this.setTime(d.getTime() - OFFSET);
    }
    setMonth(...args) {
      const d = this.local();
      d.setUTCMonth(...args);
      return this.setTime(d.getTime() - OFFSET);
    }
    setFullYear(...args) {
      const d = this.local();
      d.setUTCFullYear(...args);
      return this.setTime(d.getTime() - OFFSET);
    }
    setHours(...args) {
      const d = this.local();
      d.setUTCHours(...args);
      return this.setTime(d.getTime() - OFFSET);
    }
    setMinutes(...args) {
      const d = this.local();
      d.setUTCMinutes(...args);
      return this.setTime(d.getTime() - OFFSET);
    }
    setSeconds(...args) {
      const d = this.local();
      d.setUTCSeconds(...args);
      return this.setTime(d.getTime() - OFFSET);
    }
    setMilliseconds(...args) {
      const d = this.local();
      d.setUTCMilliseconds(...args);
      return this.setTime(d.getTime() - OFFSET);
    }
  };
}
function formatDate(date, zone, format) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date).map((p) => [p.type, p.value]));
  const { year: y, month: m, day: d, hour: h, minute: min, second: sec } = parts;
  const formats = {
    "yyyy-MM-dd": `${y}-${m}-${d}`,
    "yyyy-MM": `${y}-${m}`,
    "yyyy\uB144 M\uC6D4": `${y}\uB144 ${Number(m)}\uC6D4`,
    "MM/dd HH:mm": `${m}/${d} ${h}:${min}`,
    "M/d HH:mm": `${Number(m)}/${Number(d)} ${h}:${min}`,
    "M/d|H|mm": `${Number(m)}/${Number(d)}|${Number(h)}|${min}`,
    "yyyyMMdd": `${y}${m}${d}`,
    "yyyy-MM-dd HH:mm:ss": `${y}-${m}-${d} ${h}:${min}:${sec}`
  };
  if (!(format in formats)) throw new Error(`Unsupported date format: ${format}`);
  return formats[format];
}

// services/table-store.mjs
var SeoulDate = createSeoulDate();
var copy = (value) => {
  if (value instanceof Date) return new SeoulDate(value.getTime());
  if (Array.isArray(value)) return value.map(copy);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, copy(v)]));
  return value;
};
var populated = (value) => value !== "" && value !== null && value !== void 0;
var integer = (value) => Number.isInteger(value) && value > 0;
function decodeCell(cell, DateClass = SeoulDate) {
  switch (cell.type) {
    case "blank":
      return "";
    case "string":
    case "number":
    case "boolean":
      return cell.value;
    case "datetime":
      return new DateClass(cell.value);
    case "date":
      return new DateClass(cell.value + "T00:00:00");
    case "time":
      return new DateClass("1899-12-30T" + cell.value);
    default:
      throw new Error(`Unsupported snapshot cell type: ${cell.type}`);
  }
}
var TableStore = class _TableStore {
  constructor(sheets = []) {
    this.sheets = sheets.map((data) => new Table(this, data));
    this.deleted = /* @__PURE__ */ new Set();
  }
  static fromSnapshot(snapshot) {
    return new _TableStore(snapshot.content.sheets.map((sheet) => {
      const cells = {};
      for (const c of sheet.cells) {
        if (c.excelType === "f") throw new Error("Formula evaluation requires explicit migration support");
        cells[`${c.row}:${c.column}`] = { value: decodeCell(c.value), note: c.note ?? "", format: c.format ?? "General" };
      }
      return { name: sheet.name, maxRows: Math.max(1e3, sheet.maxRow), maxColumns: Math.max(26, sheet.maxColumn), cells, hidden: sheet.state !== "visible" };
    }));
  }
  getSheetByName(name) {
    return this.sheets.find((s) => s.name === name) ?? null;
  }
  getSheets() {
    return [...this.sheets];
  }
  getNumSheets() {
    return this.sheets.length;
  }
  insertSheet(name) {
    if (this.getSheetByName(name)) throw new Error("Duplicate sheet name");
    const sheet = new Table(this, { name, cells: {}, maxRows: 1e3, maxColumns: 26 });
    sheet.dirty = true;
    this.sheets.push(sheet);
    return sheet;
  }
  deleteSheet(sheet) {
    if (!this.sheets.includes(sheet)) throw new Error("Unknown sheet");
    this.sheets.splice(this.sheets.indexOf(sheet), 1);
    this.deleted.add(sheet.name);
  }
  export() {
    return this.sheets.map((s) => s.export());
  }
  toast() {
    return this;
  }
  setActiveSheet(sheet) {
    return sheet;
  }
};
var Table = class {
  constructor(store, data) {
    this.store = store;
    this.name = data.name;
    this.cells = copy(data.cells ?? {});
    this.maxRows = data.maxRows || 1e3;
    this.maxColumns = data.maxColumns || 26;
    this.hidden = !!data.hidden;
    this.dirty = false;
    this.filter = null;
  }
  export() {
    return copy({ name: this.name, cells: this.cells, maxRows: this.maxRows, maxColumns: this.maxColumns, hidden: this.hidden });
  }
  getName() {
    return this.name;
  }
  setName(name) {
    if (this.store.getSheetByName(name) && name !== this.name) throw new Error("Duplicate sheet name");
    this.store.deleted.add(this.name);
    this.name = name;
    this.dirty = true;
    return this;
  }
  getLastRow() {
    return Math.max(0, ...Object.entries(this.cells).filter(([, c]) => populated(c.value)).map(([k]) => Number(k.split(":")[0])));
  }
  getLastColumn() {
    return Math.max(0, ...Object.entries(this.cells).filter(([, c]) => populated(c.value)).map(([k]) => Number(k.split(":")[1])));
  }
  getMaxRows() {
    return this.maxRows;
  }
  getMaxColumns() {
    return this.maxColumns;
  }
  getRange(row, column, height = 1, width = 1) {
    if (typeof row === "string") {
      const m = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(row);
      if (!m) throw new Error(`Unsupported A1 range: ${row}`);
      const col = (s) => [...s].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
      column = col(m[1]);
      row = Number(m[2]);
      width = m[3] ? col(m[3]) - column + 1 : 1;
      height = m[4] ? Number(m[4]) - row + 1 : 1;
    }
    if (![row, column, height, width].every(integer)) throw new Error("Invalid range");
    if (row + height - 1 > this.maxRows || column + width - 1 > this.maxColumns) throw new Error("Range exceeds sheet bounds");
    return new Range(this, row, column, height, width);
  }
  appendRow(values) {
    const row = this.getLastRow() + 1;
    this.maxRows = Math.max(this.maxRows, row);
    this.maxColumns = Math.max(this.maxColumns, values.length);
    this.getRange(row, 1, 1, values.length).setValues([values]);
    return this;
  }
  deleteRow(row) {
    return this.deleteRows(row, 1);
  }
  deleteRows(row, count) {
    if (![row, count].every(integer) || row + count - 1 > this.maxRows) throw new Error("Invalid row deletion");
    const cells = {};
    for (const [key, cell] of Object.entries(this.cells)) {
      const [r, c] = key.split(":").map(Number);
      if (r < row) cells[key] = cell;
      else if (r >= row + count) cells[`${r - count}:${c}`] = cell;
    }
    this.cells = cells;
    this.maxRows -= count;
    this.dirty = true;
    return this;
  }
  insertColumnsAfter(column, count) {
    if (![column, count].every(integer) || column > this.maxColumns) throw new Error("Invalid column insertion");
    this.cells = Object.fromEntries(Object.entries(this.cells).map(([key, cell]) => {
      const [r, c] = key.split(":").map(Number);
      return [`${r}:${c > column ? c + count : c}`, cell];
    }));
    this.maxColumns += count;
    this.dirty = true;
    return this;
  }
  clear() {
    this.cells = {};
    this.dirty = true;
    return this;
  }
  getFilter() {
    return this.filter;
  }
  hideSheet() {
    this.hidden = true;
    this.dirty = true;
    return this;
  }
  setFrozenRows() {
    return this;
  }
  setColumnWidth() {
    return this;
  }
  autoResizeColumns() {
    return this;
  }
  hideColumns() {
    return this;
  }
  clearConditionalFormatRules() {
    return this;
  }
};
var Range = class {
  constructor(sheet, row, column, height, width) {
    Object.assign(this, { sheet, row, column, height, width });
  }
  getRow() {
    return this.row;
  }
  getNumRows() {
    return this.height;
  }
  getValues() {
    return this.read("value", "");
  }
  getNotes() {
    return this.read("note", "");
  }
  getValue() {
    return this.getValues()[0][0];
  }
  getNote() {
    return this.getNotes()[0][0];
  }
  read(field, fallback) {
    return Array.from({ length: this.height }, (_, r) => Array.from({ length: this.width }, (_2, c) => copy(this.sheet.cells[`${this.row + r}:${this.column + c}`]?.[field] ?? fallback)));
  }
  write(field, matrix) {
    if (!Array.isArray(matrix) || matrix.length !== this.height || matrix.some((row) => !Array.isArray(row) || row.length !== this.width)) throw new Error("Range shape mismatch");
    for (let r = 0; r < this.height; r++) for (let c = 0; c < this.width; c++) {
      const key = `${this.row + r}:${this.column + c}`;
      const cell = this.sheet.cells[key] ?? { value: "", note: "", format: "General" };
      cell[field] = copy(matrix[r][c]);
      this.sheet.cells[key] = cell;
    }
    this.sheet.dirty = true;
    return this;
  }
  fill(field, value) {
    return this.write(field, Array.from({ length: this.height }, () => Array(this.width).fill(value)));
  }
  setValues(values) {
    return this.write("value", values);
  }
  setNotes(notes) {
    return this.write("note", notes);
  }
  setValue(value) {
    return this.fill("value", value);
  }
  setNote(note) {
    return this.fill("note", note);
  }
  setNumberFormat(format) {
    return this.fill("format", format);
  }
  setFormula() {
    throw new Error("Formula writes require explicit migration support");
  }
  clearContent() {
    return this.fill("value", "");
  }
  clear() {
    for (let r = 0; r < this.height; r++) for (let c = 0; c < this.width; c++) delete this.sheet.cells[`${this.row + r}:${this.column + c}`];
    this.sheet.dirty = true;
    return this;
  }
  createFilter() {
    if (this.sheet.filter) throw new Error("Filter already exists");
    this.sheet.filter = { remove: () => {
      this.sheet.filter = null;
    } };
    return this.sheet.filter;
  }
};
for (const name of ["setBackground", "setBackgrounds", "setBorder", "setFontColor", "setFontColors", "setFontWeight", "setFontWeights", "setVerticalAlignment", "setWrapStrategy", "setDataValidation", "clearDataValidations"]) {
  Range.prototype[name] = function() {
    return this;
  };
}

// services/legacy-engine.generated.mjs
function createLegacyEngine(dependencies) {
  const { SpreadsheetApp, Utilities, Session, LockService, CacheService, Date: Date2, PropertiesService, DriveApp, UrlFetchApp, ScriptApp, Logger, ContentService, HtmlService } = dependencies;
  var SHEET = {
    \uC124\uC815: "\uC124\uC815",
    \uD559\uC0DD: "\uD559\uC0DD",
    \uB2E8\uC5B4\uC7A5\uBAA9\uB85D: "\uB2E8\uC5B4\uC7A5\uBAA9\uB85D",
    \uC219\uC81C: "\uC219\uC81C",
    \uAE30\uB85D: "\uAE30\uB85D",
    \uAE30\uB85D\uBCF4\uAD00: "\uAE30\uB85D\uBCF4\uAD00",
    \uC810\uC218: "\uC810\uC218",
    \uBBF8\uC81C\uCD9C: "\uBBF8\uC81C\uCD9C",
    \uC2DC\uC0C1: "\uC2DC\uC0C1",
    \uAC8C\uC784: "\uAC8C\uC784",
    \uACF5\uC9C0: "\uACF5\uC9C0",
    \uD478\uC2DC: "\uD478\uC2DC"
  };
  var \uD2C0\uB9B0\uB2E8\uC5B4\uC5F4 = 14;
  var \uAD6C\uBD84\uC5F4 = 15;
  var \uC81C\uC678\uC5F4 = 16;
  var \uC7AC\uC2DC\uD5D8\uD45C\uC2DC = "\uC624\uB2F5 \uC7AC\uC2DC\uD5D8";
  var \uBCF4\uCDA9\uD45C\uC2DC = "\uBCF4\uCDA9";
  var \uC2DC\uD5D8\uD45C\uC2DC = "\uC2DC\uD5D8";
  var \uAE30\uBCF8\uB808\uC2A8 = 10;
  var \uAE30\uBCF8\uD569\uACA9\uC810 = 80;
  var \uAE30\uBCF8\uC678\uC6B0\uAE30\uBD84 = 5;
  var \uAE30\uBCF8\uC2DC\uD5D8\uBD84 = 20;
  var \uC624\uB2F5\uC694\uC57D\uAC1C\uC218 = 5;
  var HEADERS = {
    \uC124\uC815: ["\uD56D\uBAA9", "\uAC12"],
    \uD559\uC0DD: [
      "\uBC18",
      "\uC774\uB984",
      "\uBE44\uBC00\uBC88\uD638",
      "\uD559\uB144\uAD6C\uBD84",
      "\uBCFC \uC218 \uC788\uB294 \uB2E8\uC5B4\uC7A5",
      "\uD559\uB144",
      "\uD559\uAD50",
      "\uAD50\uC7AC",
      "\uD559\uBD80\uBAA8\uB9C1\uD06C",
      "\uD559\uBD80\uBAA8\uB9C8\uC9C0\uB9C9",
      "\uC120\uC0DD\uB2D8\uD55C\uB9C8\uB514"
    ],
    \uB2E8\uC5B4\uC7A5\uBAA9\uB85D: ["\uB2E8\uC5B4\uC7A5", "\uC885\uB958", "\uC2DC\uD2B8\uC774\uB984", "\uC0C9", "\uB808\uC2A8\uBB36\uC74C", "\uACFC"],
    \uC219\uC81C: [
      "\uBC18",
      "\uB2E8\uC5B4\uC7A5",
      "\uC2DC\uC791\uBC88\uD638",
      "\uB05D\uBC88\uD638",
      "\uC720\uD615",
      "\uB9C8\uAC10\uC77C",
      "\uB4F1\uB85D\uC2DC\uAC01",
      "\uD559\uC0DD",
      "\uC219\uC81C\uC885\uB958",
      "\uC218\uC5C5",
      "\uC21C\uC11C",
      "\uCE78",
      "\uC81C\uD55C\uC2DC\uAC04",
      "\uB2E8\uACC4",
      "\uD1B5\uACFC\uC810\uC218",
      "\uC7AC\uC751\uC2DC",
      "\uC678\uC6B0\uAE30\uBD84",
      "\uD559\uBD80\uBAA8\uC228\uAE40"
    ],
    \uAE30\uB85D: [
      "\uC2DC\uAC01",
      "\uBC18",
      "\uC774\uB984",
      "\uB2E8\uC5B4\uC7A5",
      "\uBC94\uC704",
      "\uC720\uD615",
      "\uBB38\uD56D\uC218",
      "\uC815\uB2F5\uC218",
      "\uC810\uC218",
      "\uAC8C\uC784\uC810\uC218",
      "\uCD5C\uACE0\uCF64\uBCF4",
      "\uC18C\uC694\uCD08",
      "\uC219\uC81C\uC5EC\uBD80",
      "\uD2C0\uB9B0\uB2E8\uC5B4",
      "\uAD6C\uBD84",
      "\uC9D1\uACC4\uC81C\uC678"
    ],
    \uAE30\uB85D\uBCF4\uAD00: [
      "\uC2DC\uAC01",
      "\uBC18",
      "\uC774\uB984",
      "\uB2E8\uC5B4\uC7A5",
      "\uBC94\uC704",
      "\uC720\uD615",
      "\uBB38\uD56D\uC218",
      "\uC815\uB2F5\uC218",
      "\uC810\uC218",
      "\uAC8C\uC784\uC810\uC218",
      "\uCD5C\uACE0\uCF64\uBCF4",
      "\uC18C\uC694\uCD08",
      "\uC219\uC81C\uC5EC\uBD80",
      "\uD2C0\uB9B0\uB2E8\uC5B4",
      "\uAD6C\uBD84",
      "\uC9D1\uACC4\uC81C\uC678"
    ],
    \uC810\uC218: ["\uB0A0\uC9DC", "\uBC18", "\uC774\uB984", "\uC2DC\uD5D8\uBA85", "\uC810\uC218"],
    \uBBF8\uC81C\uCD9C: [
      "\uC0C1\uD0DC",
      "\uBC18",
      "\uB2E8\uC5B4\uC7A5",
      "\uBC94\uC704",
      "\uC720\uD615",
      "\uC219\uC81C\uC885\uB958",
      "\uB9C8\uAC10\uC77C",
      "\uB300\uC0C1",
      "\uD55C \uBA85",
      "\uC548 \uD55C \uBA85",
      "\uC548 \uD55C \uD559\uC0DD"
    ],
    \uC2DC\uC0C1: ["\uB144\uC6D4", "\uC0C1", "\uD559\uC0DD", "\uBC18", "\uAE30\uB85D", "\uB3D9\uC810\uC790", "\uC9D1\uACC4\uD55C \uB54C"],
    \uAC8C\uC784: ["\uC2DC\uAC01", "\uBC18", "\uC774\uB984", "\uAC8C\uC784", "\uC810\uC218", "\uAE30\uB85D", "\uB2E8\uC5B4\uC7A5"],
    \uACF5\uC9C0: ["\uB9CC\uB4E0\uB54C", "\uBC18", "\uC81C\uBAA9", "\uB0B4\uC6A9", "\uB05D\uB098\uB294\uB0A0", "\uCF2C"],
    \uD478\uC2DC: ["\uCF20\uB54C", "\uBC18", "\uC774\uB984", "\uC8FC\uC18C", "p256dh", "auth", "\uAE30\uAE30"]
  };
  var \uC0C8\uC8FC\uC18C = "https://smarthb-english.github.io/Vocab/";
  function doGet(e) {
    var \uD398\uC774\uC9C0 = e && e.parameter && e.parameter.p || "";
    if (\uD398\uC774\uC9C0 === "guide") {
      return HtmlService.createHtmlOutputFromFile("guide").setTitle("\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8 \uC0AC\uC6A9\uBC95").addMetaTag("viewport", "width=device-width, initial-scale=1").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    var t = HtmlService.createTemplateFromFile("index");
    t.\uC0C8\uC8FC\uC18C = \uC0C8\uC8FC\uC18C;
    try {
      t.\uC571\uC8FC\uC18C = ScriptApp.getService().getUrl();
    } catch (err) {
      t.\uC571\uC8FC\uC18C = "";
    }
    return t.evaluate().setTitle("\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8").addMetaTag("viewport", "width=device-width, initial-scale=1").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  var \uC5F4\uB9B0\uAE30\uB2A5_ = {
    \uC2DC\uC791\uC815\uBCF4,
    \uB85C\uADF8\uC778,
    \uB2E8\uC5B4\uAC00\uC838\uC624\uAE30,
    \uC219\uC81C\uAC00\uC838\uC624\uAE30,
    \uACB0\uACFC\uC800\uC7A5,
    \uB0B4\uAE30\uB85D,
    \uC6D4\uAC04\uC21C\uC704,
    \uC5F0\uC18D\uAC00\uC838\uC624\uAE30,
    \uAC8C\uC784\uC800\uC7A5,
    \uAC8C\uC784\uC21C\uC704,
    \uACF5\uC9C0\uAC00\uC838\uC624\uAE30,
    \uD478\uC2DC\uACF5\uAC1C\uD0A4,
    \uAD6C\uB3C5\uB4F1\uB85D,
    \uAD6C\uB3C5\uD574\uC81C,
    \uC120\uC0DD\uB2D8\uB85C\uADF8\uC778,
    \uC120\uC0DD\uB2D8\uC694\uC57D,
    \uC120\uC0DD\uB2D8\uAE30\uBCF8,
    \uC120\uC0DD\uB2D8\uAE30\uB85D,
    \uAE30\uB85D\uBA54\uBAA8,
    \uD559\uBD80\uBAA8\uBCF4\uAE30,
    \uD559\uBD80\uBAA8\uB9C1\uD06C\uBC1C\uAE09,
    \uD559\uBD80\uBAA8\uD55C\uB9C8\uB514,
    \uD559\uBD80\uBAA8\uBBF8\uB9AC\uBCF4\uAE30,
    \uD2C0\uB9B0\uC804\uBB38,
    \uC219\uC81C\uB4F1\uB85D,
    \uC218\uC5C5\uAFB8\uB7EC\uBBF8\uBAA9\uB85D,
    \uC218\uC5C5\uB0B4\uC8FC\uAE30,
    \uC218\uC5C5\uD2C0\uBAA9\uB85D,
    \uACFC\uBAA9\uB85D,
    \uACFC\uB123\uAE30,
    \uC7AC\uC751\uC2DC\uB354\uC8FC\uAE30,
    \uC218\uC5C5\uD2C0\uC800\uC7A5,
    \uC218\uC5C5\uD2C0\uC0AD\uC81C,
    \uC218\uC5C5\uCD94\uCC9C,
    \uB0B4\uC624\uB2F5,
    \uC218\uC5C5\uC0AD\uC81C,
    \uC219\uC81C\uC218\uC815,
    \uC219\uC81C\uC0AD\uC81C,
    \uC219\uC81C\uC5EC\uB7EC\uAC1C\uC0AD\uC81C,
    \uC219\uC81C\uC228\uAE40\uBC14\uAFB8\uAE30,
    \uC9C0\uB09C\uC219\uC81C\uC815\uB9AC,
    \uBA85\uB2E8\uAC00\uC838\uC624\uAE30,
    \uD559\uC0DD\uC218\uC815,
    \uD559\uC0DD\uBD99\uC5EC\uB123\uAE30,
    \uBC30\uC815\uAC00\uC838\uC624\uAE30,
    \uBC30\uC815\uC800\uC7A5,
    \uAD50\uC7AC\uB300\uC0C1,
    \uAD50\uC7AC\uC77C\uAD04,
    \uB2E8\uC5B4\uBAA9\uB85D,
    \uB2E8\uC5B4\uCD94\uAC00,
    \uB2E8\uC5B4\uC218\uC815,
    \uB2E8\uC5B4\uC0AD\uC81C,
    \uB2E8\uC5B4\uBD99\uC5EC\uB123\uAE30,
    \uADF8\uB9BC\uC62C\uB9AC\uAE30,
    \uADF8\uB9BC\uC5EC\uB7EC\uAC1C,
    \uADF8\uB9BC\uC9C0\uC6B0\uAE30,
    \uB2E8\uC5B4\uC7A5\uC774\uB984\uBCC0\uACBD,
    \uB2E8\uC5B4\uC7A5\uC0C9\uBCC0\uACBD,
    \uB2E8\uC5B4\uC7A5\uC0AD\uC81C,
    \uB808\uC2A8\uD06C\uAE30\uC800\uC7A5,
    \uAE30\uB85D\uC815\uB9AC,
    \uAE30\uB85D\uC81C\uC678\uC124\uC815,
    \uBBF8\uC81C\uCD9C\uC2DC\uD2B8,
    \uC624\uB798\uB41C\uAE30\uB85D\uC815\uB9ACAPI,
    \uC2DC\uC0C1\uC9D1\uACC4,
    \uC2DC\uC0C1\uC800\uC7A5API,
    \uC2DC\uC0C1\uB2EC\uBAA9\uB85D,
    \uC2DC\uC0C1\uC2DC\uC791\uC77C\uC800\uC7A5,
    \uC2DC\uC0C1\uD56D\uBAA9\uC800\uC7A5,
    \uACF5\uC9C0\uBAA9\uB85D,
    \uACF5\uC9C0\uB4F1\uB85D,
    \uACF5\uC9C0\uB044\uAE30,
    \uACF5\uC9C0\uC0AD\uC81C,
    \uD569\uACA9\uC810\uC800\uC7A5,
    \uC124\uC815\uAC00\uC838\uC624\uAE30,
    \uC124\uC815\uC800\uC7A5,
    \uC5F0\uC18D\uC2DC\uC791\uC77C\uC800\uC7A5,
    \uD478\uC2DC\uC5F4\uC1E0,
    \uD478\uC2DC\uC5F4\uC1E0\uC800\uC7A5,
    \uAD6C\uB3C5\uBAA9\uB85D,
    \uAD6C\uB3C5\uD604\uD669,
    \uAD6C\uB3C5\uC9C0\uC6B0\uAE30,
    \uD478\uC2DC\uC804\uC1A1
  };
  function doPost(e) {
    var \uB2F5 = { ok: false, \uBA54\uC2DC\uC9C0: "\uC54C \uC218 \uC5C6\uB294 \uC694\uCCAD\uC785\uB2C8\uB2E4." };
    try {
      var \uAE00 = e && e.postData && e.postData.contents || "{}";
      var \uC628\uAC83 = JSON.parse(\uAE00);
      var \uBB34\uC5C7 = s_(\uC628\uAC83.fn);
      var \uC778\uC790 = \uC628\uAC83.args || [];
      \uC77D\uC740\uAC83_ = null;
      var f = \uC5F4\uB9B0\uAE30\uB2A5_[\uBB34\uC5C7];
      if (typeof f !== "function") throw new Error("\uC4F8 \uC218 \uC5C6\uB294 \uAE30\uB2A5\uC785\uB2C8\uB2E4: " + \uBB34\uC5C7);
      \uB2F5 = { ok: true, \uAC12: f.apply(null, \uC778\uC790) };
      \uB2F4\uC740\uAC83\uBC84\uB9AC\uAE30_(\uBB34\uC5C7);
    } catch (err) {
      \uB2F5 = { ok: false, \uBA54\uC2DC\uC9C0: String(err && err.message || err) };
    }
    return ContentService.createTextOutput(JSON.stringify(\uB2F5)).setMimeType(ContentService.MimeType.JSON);
  }
  function onOpen() {
    SpreadsheetApp.getUi().createMenu("\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8").addItem("\uCD08\uAE30\uC124\uC815 (\uCC98\uC74C \uD55C \uBC88)", "\uCD08\uAE30\uC124\uC815").addItem("\uC608\uC2DC \uB2E8\uC5B4 \uB123\uAE30", "\uC608\uC2DC\uB2E8\uC5B4\uB123\uAE30").addSeparator().addItem("\uC810\uC218 \uC785\uB825\uD45C \uB9CC\uB4E4\uAE30", "\uC810\uC218\uC785\uB825\uD45C").addItem("\uC219\uC81C \uC548 \uD55C \uD559\uC0DD \uC815\uB9AC", "\uBBF8\uC81C\uCD9C\uC815\uB9AC").addSeparator().addItem("\uC54C\uB9BC \uBCF4\uB0BC \uAD8C\uD55C \uD655\uC778", "\uC54C\uB9BC\uAD8C\uD55C\uD655\uC778").addItem("\uC0AC\uC9C4 \uC62C\uB9B4 \uAD8C\uD55C \uD655\uC778", "\uADF8\uB9BC\uAD8C\uD55C\uD655\uC778").addSeparator().addItem("\uC9C0\uB09C\uB2EC \uC2DC\uC0C1 \uC9D1\uACC4\uD558\uAE30", "\uC9C0\uB09C\uB2EC\uC2DC\uC0C1\uC9D1\uACC4").addItem("\uB9E4\uC6D4 1\uC77C \uC790\uB3D9 \uC9D1\uACC4 \uCF1C\uAE30", "\uC2DC\uC0C1\uC790\uB3D9\uCF1C\uAE30").addItem("\uB9E4\uC6D4 1\uC77C \uC790\uB3D9 \uC9D1\uACC4 \uB044\uAE30", "\uC2DC\uC0C1\uC790\uB3D9\uB044\uAE30").addSeparator().addItem("\uACE0\uB978 \uC904\uC744 \uBCF4\uAD00\uD568\uC73C\uB85C \uC62E\uAE30\uAE30", "\uC120\uD0DD\uAE30\uB85D\uC815\uB9AC").addItem("\uC624\uB798\uB41C \uAE30\uB85D\uC744 \uBCF4\uAD00\uD568\uC73C\uB85C \uC62E\uAE30\uAE30", "\uC624\uB798\uB41C\uAE30\uB85D\uC815\uB9AC").addItem("\uAE30\uB85D \uC2DC\uD2B8 \uBCF4\uAE30 \uC88B\uAC8C \uC815\uB9AC", "\uAE30\uB85D\uC11C\uC2DD\uC815\uB9AC").addItem("\uAE30\uB85D\uC744 \uB2E8\uC5B4\uC7A5\uBCC4\uB85C \uBB36\uAE30", "\uB2E8\uC5B4\uC7A5\uBCC4\uC815\uB82C").addItem("\uC870\uD68C \uC2DC\uD2B8 \uC0C8\uB85C \uB9CC\uB4E4\uAE30", "\uC870\uD68C\uB9CC\uB4E4\uAE30").addSeparator().addItem("\uBCF4\uAD00\uD568 \uC644\uC804\uD788 \uBE44\uC6B0\uAE30", "\uBCF4\uAD00\uD568\uBE44\uC6B0\uAE30").addToUi();
  }
  function \uCD08\uAE30\uC124\uC815() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    Object.keys(SHEET).forEach(function(k) {
      var name = SHEET[k];
      var sh = ss.getSheetByName(name);
      if (!sh) sh = ss.insertSheet(name);
      if (sh.getLastRow() === 0) {
        sh.getRange(1, 1, 1, HEADERS[k].length).setValues([HEADERS[k]]).setFontWeight("bold").setBackground("#EFF3F9");
        sh.setFrozenRows(1);
      }
    });
    \uAE30\uB85D\uCE78\uD655\uBCF4_(SHEET.\uAE30\uB85D);
    \uAE30\uB85D\uCE78\uD655\uBCF4_(SHEET.\uAE30\uB85D\uBCF4\uAD00);
    \uBAA9\uB85D\uCE78\uD655\uBCF4_();
    \uBA85\uB2E8\uCE78\uD655\uBCF4_();
    var \uC788\uB098 = false;
    rows_(SHEET.\uC124\uC815).forEach(function(r) {
      if (s_(r[0]) === "\uC5F0\uC18D\uC2DC\uC791\uC77C") \uC788\uB098 = true;
    });
    if (!\uC788\uB098) \uC124\uC815\uC4F0\uAE30_("\uC5F0\uC18D\uC2DC\uC791\uC77C", \uC5B4\uC81C_());
    var st = ss.getSheetByName(SHEET.\uC124\uC815);
    if (st.getLastRow() < 2) {
      st.getRange(2, 1, 9, 2).setValues([
        ["\uC120\uC0DD\uB2D8\uBE44\uBC00\uBC88\uD638", "1234"],
        ["\uD559\uC6D0\uC774\uB984", "\uD64D\uC81C\uC778\uC655\uC601\uC5B4"],
        ["\uAE30\uBCF8\uD14C\uB9C8", "\uC790\uB3D9"],
        ["\uC2DC\uC0C1\uC2DC\uC791\uC77C", ""],
        ["\uC2DC\uC0C1\uD56D\uBAA9", "\uC219\uC81C"],
        ["\uC219\uC81C\uD569\uACA9\uC810", \uAE30\uBCF8\uD569\uACA9\uC810],
        ["\uC678\uC6B0\uAE30\uC2DC\uAC04\uBD84", \uAE30\uBCF8\uC678\uC6B0\uAE30\uBD84],
        ["\uC2DC\uD5D8\uC2DC\uAC04\uBD84", \uAE30\uBCF8\uC2DC\uD5D8\uBD84],
        ["\uC5F0\uC18D\uC2DC\uC791\uC77C", \uC5B4\uC81C_()]
      ]);
    }
    var stu = ss.getSheetByName(SHEET.\uD559\uC0DD);
    if (stu.getLastRow() < 2) {
      stu.getRange(2, 1, 3, 8).setValues([
        ["\uC9112 A\uBC18", "\uD64D\uAE38\uB3D9", "1234", "\uCD08\uC911\uB4F1", "", "\uC9112", "\uC778\uC655\uC911", "\uC608\uC2DC \uB2E8\uC5B4\uC7A5"],
        ["\uC9112 A\uBC18", "\uAE40\uC601\uD76C", "1234", "\uCD08\uC911\uB4F1", "", "\uC9112", "\uC778\uC655\uC911", "\uC608\uC2DC \uB2E8\uC5B4\uC7A5"],
        ["\uACE03 B\uBC18", "\uC774\uCCA0\uC218", "1234", "\uACE0\uB4F1", "", "\uACE03", "\uD55C\uC131\uACE0", ""]
      ]);
    }
    var \uAE30\uBCF8\uC2DC\uD2B8 = ss.getSheetByName("\uC2DC\uD2B81") || ss.getSheetByName("Sheet1");
    if (\uAE30\uBCF8\uC2DC\uD2B8 && ss.getSheets().length > 1 && \uAE30\uBCF8\uC2DC\uD2B8.getLastRow() === 0) {
      ss.deleteSheet(\uAE30\uBCF8\uC2DC\uD2B8);
    }
    var \uC62E\uAE40 = \uB2E8\uC5B4\uC7A5\uBD84\uB9AC_();
    var \uD0C8 = [];
    [
      ["\uC608\uC2DC \uB2E8\uC5B4", \uC608\uC2DC\uB2E8\uC5B4\uB123\uAE30],
      ["\uC810\uC218 \uC2DC\uD2B8", \uC810\uC218\uC2DC\uD2B8_],
      ["\uBA38\uB9AC\uAE00 \uBCF4\uC815", \uD5E4\uB354\uBCF4\uC815_],
      ["\uC870\uD68C \uC2DC\uD2B8", \uC870\uD68C\uB9CC\uB4E4\uAE30],
      ["\uAE30\uB85D \uC11C\uC2DD", \uAE30\uB85D\uC11C\uC2DD\uC815\uB9AC]
    ].forEach(function(x) {
      try {
        x[1]();
      } catch (e) {
        \uD0C8.push(x[0] + " \u2014 " + String(e && e.message || e));
      }
    });
    SpreadsheetApp.getActiveSpreadsheet().toast(
      (\uD0C8.length ? "\uCD08\uAE30\uC124\uC815\uC744 \uB9C8\uCCE4\uC9C0\uB9CC " + \uD0C8.length + "\uAD70\uB370\uAC00 \uC548 \uB410\uC2B5\uB2C8\uB2E4." : "\uCD08\uAE30\uC124\uC815\uC774 \uB05D\uB0AC\uC2B5\uB2C8\uB2E4.") + (\uC62E\uAE40 ? " \uC608\uC804 \uB2E8\uC5B4\uC7A5 " + \uC62E\uAE40 + "\uAC1C\uB97C \uC2DC\uD2B8\uB85C \uB098\uB234\uC2B5\uB2C8\uB2E4." : ""),
      "\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8",
      8
    );
    if (\uD0C8.length) {
      Logger.log(\uD0C8.join("\n"));
      try {
        SpreadsheetApp.getUi().alert(
          "\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8 \xB7 \uCD08\uAE30\uC124\uC815",
          "\uC544\uB798\uB294 \uC548 \uB410\uC2B5\uB2C8\uB2E4. \uB098\uBA38\uC9C0\uB294 \uB05D\uB0AC\uC2B5\uB2C8\uB2E4.\n\n" + \uD0C8.join("\n"),
          SpreadsheetApp.getUi().ButtonSet.OK
        );
      } catch (e) {
      }
    }
  }
  function \uD5E4\uB354\uBCF4\uC815_() {
    Object.keys(SHEET).forEach(function(k) {
      var sh = ss_().getSheetByName(SHEET[k]);
      if (!sh || !HEADERS[k]) return;
      var \uD544\uC694 = HEADERS[k].length;
      if (sh.getMaxColumns() < \uD544\uC694) sh.insertColumnsAfter(sh.getMaxColumns(), \uD544\uC694 - sh.getMaxColumns());
      var \uD604\uC7AC = sh.getRange(1, 1, 1, \uD544\uC694).getValues()[0];
      var \uBC14\uAFC8 = false;
      for (var i = 0; i < \uD544\uC694; i++) {
        if (String(\uD604\uC7AC[i]).trim() === "") {
          \uD604\uC7AC[i] = HEADERS[k][i];
          \uBC14\uAFC8 = true;
        }
      }
      if (\uBC14\uAFC8) {
        sh.getRange(1, 1, 1, \uD544\uC694).setValues([\uD604\uC7AC]).setFontWeight("bold").setBackground("#EFF3F9");
      }
    });
  }
  var \uAE30\uB85D\uC0C9 = {
    "\uC219\uC81C": ["#FFFFFF", "#EEF4FD"],
    "\uC2DC\uD5D8": ["#DCE9FB", "#CFE0F8"],
    "\uBCF4\uCDA9": ["#F1F3F5", "#E6E9EC"],
    "\uC624\uB2F5\uB178\uD2B8": ["#FFF4E0", "#FDE9C8"],
    "\uC5F0\uC2B5": ["#FAFAFA", "#F0F1F3"]
  };
  var \uAE30\uB85D\uAE00\uC0C9 = {
    "\uC219\uC81C": "#111827",
    "\uC2DC\uD5D8": "#1D4ED8",
    "\uBCF4\uCDA9": "#6B7280",
    "\uC624\uB2F5\uB178\uD2B8": "#B45309",
    "\uC5F0\uC2B5": "#9AA0A6"
  };
  function \uAE30\uB85D\uC11C\uC2DD\uC815\uB9AC() {
    [SHEET.\uAE30\uB85D, SHEET.\uAE30\uB85D\uBCF4\uAD00].forEach(function(name) {
      var sh = ss_().getSheetByName(name);
      if (!sh) return;
      sh.setFrozenRows(1);
      sh.setColumnWidth(1, 135);
      sh.setColumnWidth(2, 90);
      sh.setColumnWidth(3, 75);
      sh.setColumnWidth(4, 130);
      sh.setColumnWidth(5, 70);
      sh.setColumnWidth(6, 75);
      for (var c = 7; c <= 13; c++) sh.setColumnWidth(c, 62);
      sh.setColumnWidth(\uD2C0\uB9B0\uB2E8\uC5B4\uC5F4, 330);
      sh.setColumnWidth(\uAD6C\uBD84\uC5F4, 90);
      var last = Math.max(sh.getLastRow(), 2);
      sh.getRange(1, 1, last, sh.getMaxColumns()).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP).setVerticalAlignment("middle");
      sh.getRange(2, 1, last - 1, 1).setNumberFormat("yyyy-MM-dd HH:mm");
      sh.getRange(1, \uAD6C\uBD84\uC5F4).setNote(
        "\uC904 \uC0C9 \uC548\uB0B4\n  \uD770\uC0C9 / \uC5F0\uD30C\uB791 \u2014 \uC219\uC81C (\uB0A0\uC9DC\uAC00 \uBC14\uB014 \uB54C\uB9C8\uB2E4 \uC0C9\uC774 \uBC88\uAC08\uC544 \uBC14\uB01D\uB2C8\uB2E4)\n  \uD30C\uB791 \u2014 \uC2DC\uD5D8\n  \uC8FC\uD669 \u2014 \uC624\uB2F5 \uC7AC\uC2DC\uD5D8 (\uC624\uB2F5\uB178\uD2B8)\n  \uD68C\uC0C9 \u2014 \uBCF4\uCDA9\n  \uC5F0\uD68C\uC0C9 \u2014 \uD63C\uC790 \uC5F0\uC2B5 (\uC9D1\uACC4\uC5D0 \uC548 \uB4E4\uC5B4\uAC11\uB2C8\uB2E4)\n\uB0A0\uC9DC\uAC00 \uBC14\uB00C\uB294 \uC904 \uC704\uC5D0\uB294 \uAD75\uC740 \uC904\uC774 \uADF8\uC5B4\uC9D1\uB2C8\uB2E4."
      );
      \uAE30\uB85D\uB0A0\uC9DC\uBB36\uAE30_(sh);
      \uAE30\uB85D\uD544\uD130_(sh);
    });
    ss_().toast("\uAE30\uB85D \uC2DC\uD2B8\uB97C \uB0A0\uC9DC\uBCC4\uB85C \uBB36\uACE0 \uC219\uC81C\xB7\uC624\uB2F5\uB178\uD2B8\uB97C \uC0C9\uC73C\uB85C \uB098\uB234\uC2B5\uB2C8\uB2E4.", "\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8", 8);
  }
  function \uAE30\uB85D\uB0A0\uC9DC\uBB36\uAE30_(sh) {
    var last = sh.getLastRow();
    if (last < 2) return;
    var cols = Math.max(sh.getLastColumn(), HEADERS.\uAE30\uB85D.length);
    var n = last - 1;
    var f = sh.getFilter();
    if (f) f.remove();
    if (n > 1) sh.getRange(2, 1, n, cols).sort([{ column: 1, ascending: false }]);
    var \uAC12 = sh.getRange(2, 1, n, cols).getValues();
    var \uBC30\uACBD = [], \uAE00\uC0C9 = [], \uAD75\uAE30 = [], \uB0A0\uBC14\uB01C = [];
    var \uC55E\uB0A0 = null, \uC9DD = 0;
    \uAC12.forEach(function(x, i) {
      var \uB0A0 = x[0] instanceof Date2 ? ymd_(x[0]) : s_(x[0]).slice(0, 10);
      var \uBC14\uB01C = \uB0A0 !== \uC55E\uB0A0;
      if (\uBC14\uB01C) {
        \uC55E\uB0A0 = \uB0A0;
        \uC9DD = 1 - \uC9DD;
        \uB0A0\uBC14\uB01C.push(i + 2);
      }
      var \uD56D\uBAA9 = \uAE30\uB85D\uD56D\uBAA9_(x[\uAD6C\uBD84\uC5F4 - 1], x[12]);
      var \uC0C9 = (\uAE30\uB85D\uC0C9[\uD56D\uBAA9] || \uAE30\uB85D\uC0C9["\uC219\uC81C"])[\uC9DD];
      var \uC904\uBC30\uACBD = [], \uC904\uAE00\uC0C9 = [];
      for (var c = 0; c < cols; c++) {
        \uC904\uBC30\uACBD.push(\uC0C9);
        \uC904\uAE00\uC0C9.push(\uAE30\uB85D\uAE00\uC0C9[\uD56D\uBAA9] || "#111827");
      }
      \uBC30\uACBD.push(\uC904\uBC30\uACBD);
      \uAE00\uC0C9.push(\uC904\uAE00\uC0C9);
      \uAD75\uAE30.push([\uBC14\uB01C ? "bold" : "normal"]);
    });
    var \uBC94\uC704 = sh.getRange(2, 1, n, cols);
    \uBC94\uC704.setBackgrounds(\uBC30\uACBD).setFontColors(\uAE00\uC0C9);
    \uBC94\uC704.setBorder(false, false, false, false, false, false);
    sh.getRange(2, 1, n, 1).setFontWeights(\uAD75\uAE30);
    if (\uB0A0\uBC14\uB01C.length <= 400) {
      \uB0A0\uBC14\uB01C.forEach(function(r) {
        if (r === 2) return;
        sh.getRange(r, 1, 1, cols).setBorder(true, null, null, null, null, null, "#9AA3AF", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
      });
    }
  }
  function \uAE30\uB85D\uD544\uD130_(sh) {
    try {
      var f = sh.getFilter();
      if (f) f.remove();
      var last = sh.getLastRow();
      if (last < 2) return;
      sh.getRange(1, 1, last, Math.max(sh.getLastColumn(), HEADERS.\uAE30\uB85D.length)).createFilter();
    } catch (e) {
    }
  }
  function \uB2E8\uC5B4\uC7A5\uBCC4\uC815\uB82C() {
    var sh = sheet_(SHEET.\uAE30\uB85D);
    var last = sh.getLastRow();
    if (last < 3) {
      ss_().toast("\uC815\uB9AC\uD560 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.", "\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8", 5);
      return;
    }
    var f = sh.getFilter();
    if (f) f.remove();
    var cols = Math.max(sh.getLastColumn(), HEADERS.\uAE30\uB85D.length);
    sh.getRange(2, 1, last - 1, cols).sort([{ column: 4, ascending: true }, { column: 1, ascending: false }]);
    var \uC0C9\uB9F5 = {};
    \uB2E8\uC5B4\uC7A5\uBAA9\uB85D().forEach(function(b) {
      if (b.\uC0C9) \uC0C9\uB9F5[b.\uC774\uB984] = \uC5F0\uD55C\uC0C9_(b.\uC0C9);
    });
    var \uC774\uB984\uB4E4 = sh.getRange(2, 4, last - 1, 1).getValues();
    var \uAE30\uBCF8 = ["#FFFFFF", "#F1F6FD"];
    var \uD604\uC7AC = null, \uD1A0\uAE00 = 0, bg = [];
    \uC774\uB984\uB4E4.forEach(function(r) {
      var n = String(r[0]);
      if (n !== \uD604\uC7AC) {
        \uD604\uC7AC = n;
        \uD1A0\uAE00 = 1 - \uD1A0\uAE00;
      }
      var c\uC0C9 = \uC0C9\uB9F5[n] || \uAE30\uBCF8[\uD1A0\uAE00];
      var row = [];
      for (var c = 0; c < cols; c++) row.push(c\uC0C9);
      bg.push(row);
    });
    var \uBC94\uC704 = sh.getRange(2, 1, bg.length, cols);
    \uBC94\uC704.setBackgrounds(bg).setFontColors("#111827");
    \uBC94\uC704.setBorder(false, false, false, false, false, false);
    sh.getRange(2, 1, bg.length, 1).setFontWeights("normal");
    \uAE30\uB85D\uD544\uD130_(sh);
    ss_().toast(
      "\uB2E8\uC5B4\uC7A5\uBCC4\uB85C \uBB36\uC5C8\uC2B5\uB2C8\uB2E4. \uB0A0\uC9DC\uBCC4\uB85C \uB418\uB3CC\uB9AC\uB824\uBA74 [\uAE30\uB85D \uC2DC\uD2B8 \uBCF4\uAE30 \uC88B\uAC8C \uC815\uB9AC] \uB97C \uB204\uB974\uC138\uC694.",
      "\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8",
      6
    );
  }
  function \uBCF4\uAD00\uC2DC\uD2B8_() {
    var ss = ss_();
    var sh = ss.getSheetByName(SHEET.\uAE30\uB85D\uBCF4\uAD00);
    if (!sh) {
      sh = ss.insertSheet(SHEET.\uAE30\uB85D\uBCF4\uAD00, ss.getNumSheets());
      sh.getRange(1, 1, 1, HEADERS.\uAE30\uB85D\uBCF4\uAD00.length).setValues([HEADERS.\uAE30\uB85D\uBCF4\uAD00]).setFontWeight("bold").setBackground("#EFF3F9");
      sh.setFrozenRows(1);
    }
    return sh;
  }
  function \uD589\uBCF4\uAD00_(\uD589\uBC88\uD638\uB4E4) {
    if (!\uD589\uBC88\uD638\uB4E4 || !\uD589\uBC88\uD638\uB4E4.length) return 0;
    var sh = sheet_(SHEET.\uAE30\uB85D);
    var cols = Math.max(sh.getLastColumn(), HEADERS.\uAE30\uB85D.length);
    var \uBCF4\uAD00 = \uBCF4\uAD00\uC2DC\uD2B8_();
    var \uAC12 = [], \uBA54\uBAA8 = [];
    \uD589\uBC88\uD638\uB4E4.forEach(function(r) {
      var rng = sh.getRange(r, 1, 1, cols);
      \uAC12.push(rng.getValues()[0]);
      \uBA54\uBAA8.push(rng.getNotes()[0]);
    });
    var start = \uBCF4\uAD00.getLastRow() + 1;
    \uBCF4\uAD00.getRange(start, 1, \uAC12.length, cols).setValues(\uAC12);
    \uBCF4\uAD00.getRange(start, 1, \uBA54\uBAA8.length, cols).setNotes(\uBA54\uBAA8);
    \uD589\uBC88\uD638\uB4E4.slice().sort(function(a, b) {
      return b - a;
    }).forEach(function(r) {
      sh.deleteRow(r);
    });
    return \uAC12.length;
  }
  function \uC120\uD0DD\uAE30\uB85D\uC815\uB9AC() {
    var ui = SpreadsheetApp.getUi();
    var sh = SpreadsheetApp.getActiveSheet();
    if (sh.getName() !== SHEET.\uAE30\uB85D) {
      ui.alert("\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8", '"\uAE30\uB85D" \uC2DC\uD2B8\uC5D0\uC11C \uC9C0\uC6B8 \uC904\uC744 \uACE0\uB978 \uB4A4 \uB2E4\uC2DC \uB20C\uB7EC \uC8FC\uC138\uC694.', ui.ButtonSet.OK);
      return;
    }
    var \uD589\uB4E4 = [];
    SpreadsheetApp.getActiveRangeList().getRanges().forEach(function(rg) {
      for (var r = rg.getRow(); r < rg.getRow() + rg.getNumRows(); r++) {
        if (r >= 2 && \uD589\uB4E4.indexOf(r) < 0) \uD589\uB4E4.push(r);
      }
    });
    if (!\uD589\uB4E4.length) {
      ui.alert("\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8", "\uC62E\uAE38 \uC904\uC744 \uBA3C\uC800 \uACE8\uB77C \uC8FC\uC138\uC694.", ui.ButtonSet.OK);
      return;
    }
    var res = ui.alert("\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8", \uD589\uB4E4.length + '\uAC1C \uC904\uC744 \uBCF4\uAD00\uD568\uC73C\uB85C \uC62E\uAE38\uAE4C\uC694?\n(\uAE30\uB85D \uC2DC\uD2B8\uC5D0\uC11C\uB294 \uC0AC\uB77C\uC9C0\uACE0 "\uAE30\uB85D\uBCF4\uAD00" \uC2DC\uD2B8\uC5D0 \uB0A8\uC2B5\uB2C8\uB2E4)', ui.ButtonSet.OK_CANCEL);
    if (res !== ui.Button.OK) return;
    var n = \uD589\uBCF4\uAD00_(\uD589\uB4E4);
    ss_().toast(n + "\uAC1C\uB97C \uBCF4\uAD00\uD568\uC73C\uB85C \uC62E\uACBC\uC2B5\uB2C8\uB2E4.", "\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8", 5);
  }
  function \uC624\uB798\uB41C\uAE30\uB85D\uC815\uB9AC() {
    var ui = SpreadsheetApp.getUi();
    var r = ui.prompt("\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8", "\uBA70\uCE60\uBCF4\uB2E4 \uC624\uB798\uB41C \uAE30\uB85D\uC744 \uBCF4\uAD00\uD568\uC73C\uB85C \uC62E\uAE38\uAE4C\uC694?\n\uC22B\uC790\uB9CC \uC801\uC5B4 \uC8FC\uC138\uC694. (\uC608: 30)", ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) return;
    var days = parseInt(r.getResponseText(), 10);
    if (!days || days < 1) {
      ui.alert("\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8", "\uC22B\uC790\uB97C \uC801\uC5B4 \uC8FC\uC138\uC694.", ui.ButtonSet.OK);
      return;
    }
    var n = \uC624\uB798\uB41C\uAE30\uB85D\uBCF4\uAD00_(days);
    ui.alert("\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8", n + "\uAC1C\uB97C \uBCF4\uAD00\uD568\uC73C\uB85C \uC62E\uACBC\uC2B5\uB2C8\uB2E4.", ui.ButtonSet.OK);
  }
  function \uC624\uB798\uB41C\uAE30\uB85D\uBCF4\uAD00_(days) {
    var \uAE30\uC900 = new Date2();
    \uAE30\uC900.setHours(0, 0, 0, 0);
    \uAE30\uC900.setDate(\uAE30\uC900.getDate() - days);
    var sh = sheet_(SHEET.\uAE30\uB85D);
    var last = sh.getLastRow();
    if (last < 2) return 0;
    var vals = sh.getRange(2, 1, last - 1, 1).getValues();
    var \uD589\uB4E4 = [];
    for (var i = 0; i < vals.length; i++) {
      var d = vals[i][0];
      if (d instanceof Date2 && d < \uAE30\uC900) \uD589\uB4E4.push(i + 2);
    }
    return \uD589\uBCF4\uAD00_(\uD589\uB4E4);
  }
  function \uBCF4\uAD00\uD568\uBE44\uC6B0\uAE30() {
    var ui = SpreadsheetApp.getUi();
    var sh = \uBCF4\uAD00\uC2DC\uD2B8_();
    var n = Math.max(0, sh.getLastRow() - 1);
    if (!n) {
      ui.alert("\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8", "\uBCF4\uAD00\uD568\uC774 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.", ui.ButtonSet.OK);
      return;
    }
    var res = ui.alert(
      "\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8",
      "\uBCF4\uAD00\uD568\uC758 " + n + "\uAC1C \uAE30\uB85D\uC744 \uC644\uC804\uD788 \uC9C0\uC6C1\uB2C8\uB2E4.\n\uB418\uB3CC\uB9B4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uACC4\uC18D\uD560\uAE4C\uC694?",
      ui.ButtonSet.OK_CANCEL
    );
    if (res !== ui.Button.OK) return;
    sh.deleteRows(2, n);
    ui.alert("\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8", "\uBCF4\uAD00\uD568\uC744 \uBE44\uC6E0\uC2B5\uB2C8\uB2E4.", ui.ButtonSet.OK);
  }
  function \uC608\uC2DC\uB2E8\uC5B4\uB123\uAE30() {
    if (\uB2E8\uC5B4\uC7A5\uBAA9\uB85D().length) return;
    var \uC608\uC2DC = [
      ["acquire", "\uC5BB\uB2E4, \uC2B5\uB4DD\uD558\uB2E4"],
      ["acknowledge", "\uC778\uC815\uD558\uB2E4"],
      ["adapt", "\uC801\uC751\uD558\uB2E4"],
      ["alter", "\uBCC0\uACBD\uD558\uB2E4"],
      ["analyze", "\uBD84\uC11D\uD558\uB2E4"],
      ["anticipate", "\uC608\uC0C1\uD558\uB2E4"],
      ["assess", "\uD3C9\uAC00\uD558\uB2E4"],
      ["assume", "\uAC00\uC815\uD558\uB2E4"],
      ["attribute", "~\uC758 \uD0D3\uC73C\uB85C \uB3CC\uB9AC\uB2E4"],
      ["compensate", "\uBCF4\uC0C1\uD558\uB2E4"],
      ["contribute", "\uAE30\uC5EC\uD558\uB2E4"],
      ["demonstrate", "\uC99D\uBA85\uD558\uB2E4"],
      ["distinguish", "\uAD6C\uBCC4\uD558\uB2E4"],
      ["enhance", "\uD5A5\uC0C1\uC2DC\uD0A4\uB2E4"],
      ["establish", "\uD655\uB9BD\uD558\uB2E4"],
      ["generate", "\uC0DD\uC131\uD558\uB2E4"],
      ["implement", "\uC2E4\uD589\uD558\uB2E4"],
      ["indicate", "\uB098\uD0C0\uB0B4\uB2E4"],
      ["modify", "\uC218\uC815\uD558\uB2E4"],
      ["perceive", "\uC778\uC2DD\uD558\uB2E4"],
      ["preserve", "\uBCF4\uC874\uD558\uB2E4"],
      ["restrict", "\uC81C\uD55C\uD558\uB2E4"],
      ["sustain", "\uC720\uC9C0\uD558\uB2E4"],
      ["transform", "\uBCC0\uD654\uC2DC\uD0A4\uB2E4"],
      ["vulnerable", "\uCDE8\uC57D\uD55C"]
    ];
    \uB2E8\uC5B4\uC2DC\uD2B8\uB9CC\uB4E4\uAE30_("\uC608\uC2DC \uB2E8\uC5B4\uC7A5", "");
    \uB2E8\uC5B4\uC4F0\uAE30_("\uC608\uC2DC \uB2E8\uC5B4\uC7A5", \uC608\uC2DC.map(function(p, i) {
      return [i + 1, p[0], p[1]];
    }));
  }
  function \uB2E8\uC5B4\uC7A5\uBD84\uB9AC_() {
    var ss = ss_();
    var old = ss.getSheetByName("\uB2E8\uC5B4\uC7A5");
    if (!old) return 0;
    var last = old.getLastRow();
    if (last < 2) return 0;
    var cols = Math.max(old.getLastColumn(), 5);
    var v = old.getRange(2, 1, last - 1, cols).getValues();
    var \uBB36\uC74C = {}, \uC21C\uC11C = [];
    v.forEach(function(x) {
      var n = s_(x[0]), en = s_(x[2]), ko = s_(x[3]);
      if (!n || !en || !ko) return;
      if (!\uBB36\uC74C[n]) {
        \uBB36\uC74C[n] = { \uC885\uB958: "", \uBAA9\uB85D: [] };
        \uC21C\uC11C.push(n);
      }
      if (!\uBB36\uC74C[n].\uC885\uB958 && s_(x[4])) \uBB36\uC74C[n].\uC885\uB958 = s_(x[4]);
      \uBB36\uC74C[n].\uBAA9\uB85D.push([Number(x[1]) || \uBB36\uC74C[n].\uBAA9\uB85D.length + 1, en, ko]);
    });
    var \uB9CC\uB4E0\uAC1C\uC218 = 0;
    \uC21C\uC11C.forEach(function(n) {
      if (\uB2E8\uC5B4\uC7A5\uCC3E\uAE30_(n)) return;
      \uB2E8\uC5B4\uC2DC\uD2B8\uB9CC\uB4E4\uAE30_(n, \uBB36\uC74C[n].\uC885\uB958);
      var \uAC12 = \uBB36\uC74C[n].\uBAA9\uB85D.sort(function(a, b) {
        return a[0] - b[0];
      }).map(function(r, i) {
        return [i + 1, r[1], r[2]];
      });
      \uB2E8\uC5B4\uC4F0\uAE30_(n, \uAC12);
      \uB9CC\uB4E0\uAC1C\uC218++;
    });
    if (\uB9CC\uB4E0\uAC1C\uC218) {
      try {
        old.setName("\uB2E8\uC5B4\uC7A5(\uC608\uC804)");
        old.hideSheet();
      } catch (e) {
      }
    }
    return \uB9CC\uB4E0\uAC1C\uC218;
  }
  function \uC870\uD68C\uB9CC\uB4E4\uAE30() {
    var ss = ss_();
    var sh = ss.getSheetByName("\uC870\uD68C");
    if (!sh) sh = ss.insertSheet("\uC870\uD68C", 0);
    sh.clear();
    sh.clearConditionalFormatRules();
    try {
      var f = sh.getFilter();
      if (f) f.remove();
    } catch (e) {
    }
    try {
      sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
    } catch (e) {
    }
    sh.getRange("A1:A3").setValues([["\uBB34\uC5C7\uC744 \uBCFC\uAE4C\uC694"], ["\uB2E8\uC5B4\uC7A5"], ["\uD559\uC0DD \uC774\uB984"]]).setFontWeight("bold").setBackground("#EFF3F9");
    sh.getRange("B1:B3").setValues([["\uAE30\uB85D"], ["\uC804\uCCB4"], ["\uC804\uCCB4"]]).setFontWeight("bold").setBackground("#FFFDF3");
    sh.setColumnWidth(1, 110);
    sh.setColumnWidth(2, 220);
    sh.getRange("C1").setValue("\u2190 \uB178\uB780 \uCE78\uC744 \uB20C\uB7EC \uACE8\uB77C \uBCF4\uC138\uC694. \uC544\uB798\uAC00 \uBC14\uB85C \uBC14\uB01D\uB2C8\uB2E4.").setFontColor("#8A8A8A");
    sh.getRange("Z1:Z3").setValues([["\uAE30\uB85D"], ["\uC219\uC81C"], ["\uC810\uC218"]]);
    sh.getRange("AA1").setValue("\uC804\uCCB4");
    sh.getRange("AA2").setFormula('=IFERROR(SORT(UNIQUE(FILTER(\uB2E8\uC5B4\uC7A5\uBAA9\uB85D!A2:A, \uB2E8\uC5B4\uC7A5\uBAA9\uB85D!A2:A<>""))),"")');
    sh.getRange("AB1").setValue("\uC804\uCCB4");
    sh.getRange("AB2").setFormula('=IFERROR(SORT(UNIQUE(FILTER(\uD559\uC0DD!B2:B, \uD559\uC0DD!B2:B<>""))),"")');
    sh.hideColumns(26, 3);
    function \uBAA9\uB85D\uAC80\uC0AC(\uBC94\uC704) {
      return SpreadsheetApp.newDataValidation().requireValueInRange(\uBC94\uC704, true).setAllowInvalid(false).build();
    }
    sh.getRange("B1").setDataValidation(\uBAA9\uB85D\uAC80\uC0AC(sh.getRange("Z1:Z3")));
    sh.getRange("B2").setDataValidation(\uBAA9\uB85D\uAC80\uC0AC(sh.getRange("AA1:AA200")));
    sh.getRange("B3").setDataValidation(\uBAA9\uB85D\uAC80\uC0AC(sh.getRange("AB1:AB200")));
    var \uAE30\uB85D\uC870\uAC74 = `"select * where Col1 is not null"&IF($B$2="\uC804\uCCB4",""," and Col4 = '"&$B$2&"'")&IF($B$3="\uC804\uCCB4",""," and Col3 = '"&$B$3&"'")&" order by Col1 desc"`;
    var \uC219\uC81C\uC870\uAC74 = `"select * where Col1 is not null"&IF($B$2="\uC804\uCCB4",""," and Col2 = '"&$B$2&"'")`;
    var \uC810\uC218\uC870\uAC74 = `"select * where Col1 is not null"&IF($B$3="\uC804\uCCB4",""," and Col3 = '"&$B$3&"'")&" order by Col1 desc"`;
    var \uC218\uC2DD = '=IFERROR(IFS($B$1="\uAE30\uB85D", QUERY({\uAE30\uB85D!A1:O}, ' + \uAE30\uB85D\uC870\uAC74 + ', 1),$B$1="\uC219\uC81C", QUERY({\uC219\uC81C!A1:H}, ' + \uC219\uC81C\uC870\uAC74 + ', 1),$B$1="\uC810\uC218", QUERY({\uC810\uC218!A1:E}, ' + \uC810\uC218\uC870\uAC74 + ', 1)), "\uC870\uAC74\uC5D0 \uB9DE\uB294 \uC790\uB8CC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.")';
    sh.getRange("A6").setFormula(\uC218\uC2DD);
    sh.setFrozenRows(6);
    ss.setActiveSheet(sh);
    ss.toast("\uC870\uD68C \uC2DC\uD2B8\uB97C \uB9CC\uB4E4\uC5C8\uC2B5\uB2C8\uB2E4. B1~B3\uC744 \uACE8\uB77C \uBCF4\uC138\uC694.", "\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8", 8);
  }
  function ss_() {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
  function sheet_(name) {
    var sh = ss_().getSheetByName(name);
    if (!sh) throw new Error('\uC2DC\uD2B8 "' + name + '"\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uBA54\uB274\uC5D0\uC11C [\uCD08\uAE30\uC124\uC815]\uC744 \uBA3C\uC800 \uC2E4\uD589\uD574 \uC8FC\uC138\uC694.');
    return sh;
  }
  function rows_(name) {
    var sh = sheet_(name);
    var last = sh.getLastRow();
    if (last < 2) return [];
    return sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  }
  var \uC77D\uC740\uAC83_ = null;
  function \uC77D\uAE30\uCE90\uC2DC_(\uC774\uB984) {
    if (!\uC77D\uC740\uAC83_) return rows_(\uC774\uB984);
    if (!Object.prototype.hasOwnProperty.call(\uC77D\uC740\uAC83_, \uC774\uB984)) \uC77D\uC740\uAC83_[\uC774\uB984] = rows_(\uC774\uB984);
    return \uC77D\uC740\uAC83_[\uC774\uB984];
  }
  function \uC77D\uAE30\uCE90\uC2DC\uBC84\uB9AC\uAE30_(\uC774\uB984) {
    if (\uC77D\uC740\uAC83_) delete \uC77D\uC740\uAC83_[\uC774\uB984];
  }
  function \uC77D\uB294\uB3D9\uC548_(f) {
    if (\uC77D\uC740\uAC83_) return f();
    \uC77D\uC740\uAC83_ = {};
    try {
      return f();
    } finally {
      \uC77D\uC740\uAC83_ = null;
    }
  }
  function setting_(key, def) {
    var r = rows_(SHEET.\uC124\uC815);
    for (var i = 0; i < r.length; i++) {
      if (String(r[i][0]).trim() === key) return String(r[i][1]).trim();
    }
    return def;
  }
  function s_(v) {
    return v === null || v === void 0 ? "" : String(v).trim();
  }
  var \uD569\uACA9\uC810\uCE90\uC2DC_ = null;
  function \uD569\uACA9\uC810_() {
    if (\uD569\uACA9\uC810\uCE90\uC2DC_ !== null) return \uD569\uACA9\uC810\uCE90\uC2DC_;
    var n = Number(setting_("\uC219\uC81C\uD569\uACA9\uC810", \uAE30\uBCF8\uD569\uACA9\uC810));
    \uD569\uACA9\uC810\uCE90\uC2DC_ = isFinite(n) && n >= 0 && n <= 100 ? n : \uAE30\uBCF8\uD569\uACA9\uC810;
    return \uD569\uACA9\uC810\uCE90\uC2DC_;
  }
  function \uD569\uACA9\uCEF7_(\uC885\uB958) {
    return \uD55C\uBC88\uB9CC_(\uC885\uB958) ? 0 : \uD569\uACA9\uC810_();
  }
  function \uC124\uC815\uAC00\uC838\uC624\uAE30(\uBE44\uBC88) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    return { ok: true, \uD569\uACA9\uC810: \uD569\uACA9\uC810_() };
  }
  function \uC124\uC815\uC800\uC7A5(\uBE44\uBC88, \uAC12) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    \uAC12 = \uAC12 || {};
    function \uC22B\uC790(v) {
      var n = Number(v);
      return isFinite(n) ? Math.round(n) : null;
    }
    if (\uAC12.\uD569\uACA9\uC810 !== void 0 && \uAC12.\uD569\uACA9\uC810 !== "") {
      var p = \uC22B\uC790(\uAC12.\uD569\uACA9\uC810);
      if (p === null || p < 0 || p > 100) return { ok: false, \uBA54\uC2DC\uC9C0: "\uD569\uACA9\uC810\uC740 0\uC5D0\uC11C 100 \uC0AC\uC774\uB85C \uB123\uC5B4 \uC8FC\uC138\uC694." };
      \uC124\uC815\uC4F0\uAE30_("\uC219\uC81C\uD569\uACA9\uC810", p);
    }
    return \uC124\uC815\uAC00\uC838\uC624\uAE30(\uBE44\uBC88);
  }
  function \uD569\uACA9\uC810\uC800\uC7A5(\uBE44\uBC88, \uC810\uC218) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    var n = Math.round(Number(\uC810\uC218));
    if (!isFinite(n) || n < 0 || n > 100) return { ok: false, \uBA54\uC2DC\uC9C0: "0\uC5D0\uC11C 100 \uC0AC\uC774\uB85C \uB123\uC5B4 \uC8FC\uC138\uC694." };
    \uC124\uC815\uC4F0\uAE30_("\uC219\uC81C\uD569\uACA9\uC810", n);
    return { ok: true, \uD569\uACA9\uC810: n };
  }
  function \uC5B4\uC81C_() {
    var d = new Date2();
    d.setDate(d.getDate() - 1);
    return ymd_(d);
  }
  function ymd_(d) {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  function \uC2DC\uC791\uC815\uBCF4() {
    var \uB2F4\uAE34 = \uCE90\uC2DC\uC77D\uAE30_("\uC2DC\uC791\uC815\uBCF4");
    if (\uB2F4\uAE34 && \uB2F4\uAE34.\uB2E8\uC5B4\uC7A5\uBAA9\uB85D) return \uB2F4\uAE34;
    var r = {
      \uD559\uC6D0\uC774\uB984: setting_("\uD559\uC6D0\uC774\uB984", "\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8"),
      \uD569\uACA9\uC810: \uD569\uACA9\uC810_(),
      \uB2E8\uC5B4\uC7A5\uBAA9\uB85D: \uB2E8\uC5B4\uC7A5\uBAA9\uB85D()
    };
    \uCE90\uC2DC\uB2F4\uAE30_("\uC2DC\uC791\uC815\uBCF4", r, \uAE30\uB85D\uCE90\uC2DC\uCD08_);
    return r;
  }
  function \uC2DC\uD2B8\uC774\uB984\uB9CC\uB4E4\uAE30_(\uB2E8\uC5B4\uC7A5) {
    var n = s_(\uB2E8\uC5B4\uC7A5).replace(/[\\\/\?\*\[\]:]/g, " ").replace(/\s+/g, " ").trim();
    if (!n) n = "\uB2E8\uC5B4\uC7A5";
    n = "\uB2E8\uC5B4_" + n;
    if (n.length > 95) n = n.slice(0, 95);
    var ss = ss_(), \uD6C4\uBCF4 = n, i = 2;
    while (ss.getSheetByName(\uD6C4\uBCF4)) {
      \uD6C4\uBCF4 = n + " (" + i + ")";
      i++;
    }
    return \uD6C4\uBCF4;
  }
  function \uBAA9\uB85D\uC2DC\uD2B8_() {
    var ss = ss_();
    var sh = ss.getSheetByName(SHEET.\uB2E8\uC5B4\uC7A5\uBAA9\uB85D);
    if (!sh) {
      sh = ss.insertSheet(SHEET.\uB2E8\uC5B4\uC7A5\uBAA9\uB85D, 2);
      sh.getRange(1, 1, 1, HEADERS.\uB2E8\uC5B4\uC7A5\uBAA9\uB85D.length).setValues([HEADERS.\uB2E8\uC5B4\uC7A5\uBAA9\uB85D]).setFontWeight("bold").setBackground("#EFF3F9");
      sh.setFrozenRows(1);
      sh.setColumnWidth(1, 200);
      sh.setColumnWidth(2, 90);
      sh.setColumnWidth(3, 200);
      sh.setColumnWidth(4, 80);
      sh.setColumnWidth(5, 90);
    }
    \uBAA9\uB85D\uCE78\uD655\uBCF4_(sh);
    return sh;
  }
  function \uBAA9\uB85D\uCE78\uD655\uBCF4_(sh) {
    sh = sh || ss_().getSheetByName(SHEET.\uB2E8\uC5B4\uC7A5\uBAA9\uB85D);
    if (!sh) return null;
    var \uD544\uC694 = HEADERS.\uB2E8\uC5B4\uC7A5\uBAA9\uB85D.length;
    if (sh.getMaxColumns() < \uD544\uC694) sh.insertColumnsAfter(sh.getMaxColumns(), \uD544\uC694 - sh.getMaxColumns());
    var \uBA38\uB9AC = sh.getRange(1, 1, 1, \uD544\uC694).getValues()[0];
    var \uACE0\uCE60\uAE4C = false;
    for (var i = 0; i < \uD544\uC694; i++) {
      if (s_(\uBA38\uB9AC[i]) !== HEADERS.\uB2E8\uC5B4\uC7A5\uBAA9\uB85D[i]) {
        \uBA38\uB9AC[i] = HEADERS.\uB2E8\uC5B4\uC7A5\uBAA9\uB85D[i];
        \uACE0\uCE60\uAE4C = true;
      }
    }
    if (\uACE0\uCE60\uAE4C) {
      sh.getRange(1, 1, 1, \uD544\uC694).setValues([\uBA38\uB9AC]).setFontWeight("bold").setBackground("#EFF3F9");
      sh.setColumnWidth(5, 90);
    }
    return sh;
  }
  function \uB808\uC2A8\uD06C\uAE30_(v) {
    var n = Number(v) || 0;
    if (!n || n < 1) return \uAE30\uBCF8\uB808\uC2A8;
    return Math.min(500, Math.round(n));
  }
  function \uB2E8\uC5B4\uC7A5\uBAA9\uB85D() {
    var r = rows_(SHEET.\uB2E8\uC5B4\uC7A5\uBAA9\uB85D);
    var out = [];
    r.forEach(function(x) {
      var \uC774\uB984 = s_(x[0]);
      if (!\uC774\uB984) return;
      var \uC2DC\uD2B8 = s_(x[2]);
      var sh = \uC2DC\uD2B8 ? ss_().getSheetByName(\uC2DC\uD2B8) : null;
      var \uAC1C\uC218 = sh ? Math.max(0, sh.getLastRow() - 1) : 0;
      var b = {
        \uC774\uB984,
        \uAC1C\uC218,
        \uC885\uB958: s_(x[1]),
        \uC2DC\uD2B8,
        \uC0C9: s_(x[3]),
        \uB808\uC2A8: \uB808\uC2A8\uD06C\uAE30_(x.length > 4 ? x[4] : ""),
        \uACFC\uCE78: x.length > 5 ? s_(x[5]) : ""
      };
      b.\uACFC = \uACFC\uC774\uB984_(b);
      b.\uC5B4\uB514 = \uACFC\uCABC\uAC1C\uAE30_(\uC774\uB984, b.\uC885\uB958).\uC5B4\uB514;
      if (\uACFC\uC7A5_(b.\uC885\uB958)) b.\uCE78\uC218 = \uACFC\uCE78\uC218_(\uC2DC\uD2B8);
      out.push(b);
    });
    return out;
  }
  function \uB2E8\uC5B4\uC7A5\uBAA9\uB85D\uCE78\uD655\uBCF4_(sh) {
    try {
      sh = sh || sheet_(SHEET.\uB2E8\uC5B4\uC7A5\uBAA9\uB85D);
    } catch (e) {
      return null;
    }
    if (!sh || typeof sh.getMaxColumns !== "function" || typeof sh.getRange !== "function") return sh;
    var \uD544\uC694 = HEADERS.\uB2E8\uC5B4\uC7A5\uBAA9\uB85D.length;
    if (sh.getMaxColumns() < \uD544\uC694 && typeof sh.insertColumnsAfter === "function") {
      sh.insertColumnsAfter(sh.getMaxColumns(), \uD544\uC694 - sh.getMaxColumns());
    }
    var \uBA38\uB9AC = sh.getRange(1, 1, 1, \uD544\uC694).getValues()[0];
    var \uACE0\uCE60\uAE4C = false;
    for (var i = 0; i < \uD544\uC694; i++) {
      if (!s_(\uBA38\uB9AC[i])) {
        \uBA38\uB9AC[i] = HEADERS.\uB2E8\uC5B4\uC7A5\uBAA9\uB85D[i];
        \uACE0\uCE60\uAE4C = true;
      }
    }
    if (\uACE0\uCE60\uAE4C) sh.getRange(1, 1, 1, \uD544\uC694).setValues([\uBA38\uB9AC]);
    return sh;
  }
  function \uACFC\uBAA9\uB85D() {
    \uB2E8\uC5B4\uC7A5\uBAA9\uB85D\uCE78\uD655\uBCF4_();
    return { ok: true, \uACFC: \uACFC\uBB36\uC74C_(\uB2E8\uC5B4\uC7A5\uBAA9\uB85D()) };
  }
  function \uB2E8\uC5B4\uC7A5\uCC3E\uAE30_(\uB2E8\uC5B4\uC7A5) {
    var \uC774\uB984 = s_(\uB2E8\uC5B4\uC7A5);
    var r = rows_(SHEET.\uB2E8\uC5B4\uC7A5\uBAA9\uB85D);
    for (var i = 0; i < r.length; i++) {
      if (s_(r[i][0]) === \uC774\uB984) {
        return {
          \uD589: i + 2,
          \uC774\uB984,
          \uC885\uB958: s_(r[i][1]),
          \uC2DC\uD2B8: s_(r[i][2]),
          \uC0C9: s_(r[i][3]),
          \uB808\uC2A8: \uB808\uC2A8\uD06C\uAE30_(r[i].length > 4 ? r[i][4] : "")
        };
      }
    }
    return null;
  }
  function \uB2E8\uC5B4\uC2DC\uD2B8_(\uB2E8\uC5B4\uC7A5) {
    var b = \uB2E8\uC5B4\uC7A5\uCC3E\uAE30_(\uB2E8\uC5B4\uC7A5);
    if (!b || !b.\uC2DC\uD2B8) return null;
    return ss_().getSheetByName(b.\uC2DC\uD2B8);
  }
  function \uB2E8\uC5B4\uC2DC\uD2B8\uB9CC\uB4E4\uAE30_(\uB2E8\uC5B4\uC7A5, \uC885\uB958) {
    var \uC788\uC74C = \uB2E8\uC5B4\uC7A5\uCC3E\uAE30_(\uB2E8\uC5B4\uC7A5);
    if (\uC788\uC74C && ss_().getSheetByName(\uC788\uC74C.\uC2DC\uD2B8)) return ss_().getSheetByName(\uC788\uC74C.\uC2DC\uD2B8);
    var ss = ss_();
    var \uC2DC\uD2B8\uC774\uB984 = \uC2DC\uD2B8\uC774\uB984\uB9CC\uB4E4\uAE30_(\uB2E8\uC5B4\uC7A5);
    var sh = ss.insertSheet(\uC2DC\uD2B8\uC774\uB984, ss.getNumSheets());
    var \uBB38\uC7A5 = \uBCF8\uBB38\uC7A5_(\uC885\uB958), \uBB38\uBC95 = \uBB38\uBC95\uC7A5_(\uC885\uB958);
    if (\uACFC\uC7A5_(\uC885\uB958)) {
      sh.getRange(1, 1, 1, 5).setValues([\uACFC\uBA38\uB9AC_]).setFontWeight("bold").setBackground("#EFF3F9");
      sh.setColumnWidth(1, 55);
      sh.setColumnWidth(2, 60);
      sh.setColumnWidth(3, 420);
      sh.setColumnWidth(4, 420);
      sh.setColumnWidth(5, 220);
    } else {
      sh.getRange(1, 1, 1, 4).setValues([\uBB38\uBC95 ? ["\uBC88\uD638", "\uBB38\uC81C \uBB38\uC7A5", "\uD574\uC11D", "\uD78C\uD2B8\xB7\uD574\uC124"] : \uBB38\uC7A5 ? ["\uBC88\uD638", "\uC601\uC5B4 \uBB38\uC7A5", "\uD574\uC11D", "\uBE44\uACE0"] : ["\uBC88\uD638", "\uC601\uC5B4", "\uB73B", "\uADF8\uB9BC"]]).setFontWeight("bold").setBackground("#EFF3F9");
      sh.setColumnWidth(1, 55);
      sh.setColumnWidth(2, \uBB38\uC7A5 ? 420 : 200);
      sh.setColumnWidth(3, \uBB38\uC7A5 ? 420 : 260);
      sh.setColumnWidth(4, \uBB38\uC7A5 ? 200 : 260);
    }
    sh.setFrozenRows(1);
    var \uBAA9\uB85D = \uBAA9\uB85D\uC2DC\uD2B8_();
    var \uC0C9 = \uB2E4\uC74C\uC0C9_();
    if (\uC788\uC74C) {
      \uBAA9\uB85D.getRange(\uC788\uC74C.\uD589, 1, 1, 5).setValues([[
        s_(\uB2E8\uC5B4\uC7A5),
        s_(\uC885\uB958),
        \uC2DC\uD2B8\uC774\uB984,
        \uC788\uC74C.\uC0C9 || \uC0C9,
        \uC788\uC74C.\uB808\uC2A8 || \uAE30\uBCF8\uB808\uC2A8
      ]]);
    } else {
      \uBAA9\uB85D.appendRow([s_(\uB2E8\uC5B4\uC7A5), s_(\uC885\uB958), \uC2DC\uD2B8\uC774\uB984, \uC0C9, \uAE30\uBCF8\uB808\uC2A8]);
    }
    \uBAA9\uB85D\uC2DC\uD2B8\uC0C9\uCE60_();
    return sh;
  }
  function \uB2E8\uC5B4\uC4F0\uAE30_(\uB2E8\uC5B4\uC7A5, \uAC12\uB4E4) {
    if (!\uAC12\uB4E4 || !\uAC12\uB4E4.length) return;
    var sh = \uB2E8\uC5B4\uC2DC\uD2B8_(\uB2E8\uC5B4\uC7A5);
    if (!sh) sh = \uB2E8\uC5B4\uC2DC\uD2B8\uB9CC\uB4E4\uAE30_(\uB2E8\uC5B4\uC7A5, "");
    sh.getRange(sh.getLastRow() + 1, 1, \uAC12\uB4E4.length, 3).setValues(\uAC12\uB4E4);
  }
  var \uC0C9\uD45C = [
    "#FF7A3D",
    "#3B82F6",
    "#16A34A",
    "#8B5CF6",
    "#EC4899",
    "#06B6D4",
    "#F59E0B",
    "#EF4444",
    "#84CC16",
    "#64748B"
  ];
  function \uB2E4\uC74C\uC0C9_() {
    var \uC4F4\uC0C9 = {};
    rows_(SHEET.\uB2E8\uC5B4\uC7A5\uBAA9\uB85D).forEach(function(x) {
      if (s_(x[3])) \uC4F4\uC0C9[s_(x[3]).toUpperCase()] = 1;
    });
    for (var i = 0; i < \uC0C9\uD45C.length; i++) {
      if (!\uC4F4\uC0C9[\uC0C9\uD45C[i].toUpperCase()]) return \uC0C9\uD45C[i];
    }
    return \uC0C9\uD45C[Math.floor(Math.random() * \uC0C9\uD45C.length)];
  }
  function \uC5F0\uD55C\uC0C9_(hex, \uC815\uB3C4) {
    var h = s_(hex).replace("#", "");
    if (h.length !== 6) return "#FFFFFF";
    \uC815\uB3C4 = \uC815\uB3C4 === void 0 ? 0.86 : \uC815\uB3C4;
    var out = "#";
    for (var i = 0; i < 3; i++) {
      var v = parseInt(h.substr(i * 2, 2), 16);
      var m = Math.round(v + (255 - v) * \uC815\uB3C4);
      out += ("0" + m.toString(16)).slice(-2);
    }
    return out.toUpperCase();
  }
  function \uBAA9\uB85D\uC2DC\uD2B8\uC0C9\uCE60_() {
    var sh = \uBAA9\uB85D\uC2DC\uD2B8_();
    var last = sh.getLastRow();
    if (last < 2) return;
    var v = sh.getRange(2, 4, last - 1, 1).getValues();
    var bg = v.map(function(r) {
      return [s_(r[0]) ? s_(r[0]) : "#FFFFFF"];
    });
    sh.getRange(2, 4, bg.length, 1).setBackgrounds(bg).setFontColor("#FFFFFF");
  }
  function \uB2E8\uC5B4\uC7A5\uC0C9\uBCC0\uACBD(\uBE44\uBC88, \uB2E8\uC5B4\uC7A5, \uC0C9) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var b = \uB2E8\uC5B4\uC7A5\uCC3E\uAE30_(\uB2E8\uC5B4\uC7A5);
    if (!b) return { ok: false, \uBA54\uC2DC\uC9C0: "\uB2E8\uC5B4\uC7A5\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." };
    \uBAA9\uB85D\uC2DC\uD2B8_().getRange(b.\uD589, 4).setValue(s_(\uC0C9));
    \uBAA9\uB85D\uC2DC\uD2B8\uC0C9\uCE60_();
    return { ok: true, \uB2E8\uC5B4\uC7A5\uBAA9\uB85D: \uB2E8\uC5B4\uC7A5\uBAA9\uB85D() };
  }
  function \uB808\uC2A8\uD06C\uAE30\uC800\uC7A5(\uBE44\uBC88, \uB2E8\uC5B4\uC7A5, \uD06C\uAE30) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var b = \uB2E8\uC5B4\uC7A5\uCC3E\uAE30_(\uB2E8\uC5B4\uC7A5);
    if (!b) return { ok: false, \uBA54\uC2DC\uC9C0: "\uB2E8\uC5B4\uC7A5\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." };
    var n = Number(\uD06C\uAE30) || 0;
    if (n < 1 || n > 500) return { ok: false, \uBA54\uC2DC\uC9C0: "\uB808\uC2A8\uC740 1~500 \uC0AC\uC774\uB85C \uC815\uD574 \uC8FC\uC138\uC694." };
    \uBAA9\uB85D\uCE78\uD655\uBCF4_().getRange(b.\uD589, 5).setValue(Math.round(n));
    return { ok: true, \uB2E8\uC5B4\uC7A5\uBAA9\uB85D: \uB2E8\uC5B4\uC7A5\uBAA9\uB85D() };
  }
  function \uC0C9\uD45C\uAC00\uC838\uC624\uAE30() {
    return \uC0C9\uD45C;
  }
  function \uB2E8\uC5B4\uAC00\uC838\uC624\uAE30(\uB2E8\uC5B4\uC7A5, \uCE78, \uC2DC\uC791, \uB05D) {
    var b = \uB2E8\uC5B4\uC7A5\uCC3E\uAE30_(\uB2E8\uC5B4\uC7A5);
    if (!b) return [];
    var sh = ss_().getSheetByName(b.\uC2DC\uD2B8);
    if (!sh) return [];
    var last = sh.getLastRow();
    if (last < 2) return [];
    if (\uACFC\uC7A5_(b.\uC885\uB958)) return \uBC94\uC704\uB2E8\uC5B4_(\uACFC\uC904\uB4E4_(sh, last), \uCE78, \uC2DC\uC791, \uB05D);
    var \uCE78\uC218 = Math.max(3, Math.min(4, sh.getLastColumn()));
    var v = sh.getRange(2, 1, last - 1, \uCE78\uC218).getValues();
    var out = [];
    v.forEach(function(x) {
      var en = s_(x[1]), ko = s_(x[2]);
      if (!en || !ko) return;
      var w = { no: Number(x[0]) || out.length + 1, en, ko, \uC885\uB958: b.\uC885\uB958 };
      var \uB137\uC9F8 = \uCE78\uC218 > 3 ? s_(x[3]) : "";
      if (\uB137\uC9F8) {
        if (\uBCF8\uBB38\uC7A5_(b.\uC885\uB958)) w.\uBE44\uACE0 = \uB137\uC9F8;
        else w.\uADF8\uB9BC = \uB137\uC9F8;
      }
      out.push(w);
    });
    out.sort(function(a, c) {
      return a.no - c.no;
    });
    out.forEach(function(w, i) {
      w.no = i + 1;
    });
    return \uBC94\uC704\uB2E8\uC5B4_(out, \uCE78, \uC2DC\uC791, \uB05D);
  }
  var \uACFC\uBA38\uB9AC_ = ["\uBC88\uD638", "\uAD6C\uBD84", "\uC601\uC5B4", "\uB73B\xB7\uD574\uC11D", "\uBE44\uACE0"];
  var \uACFC\uAD6C\uBD84\uB4E4_ = ["\uB2E8\uC5B4", "\uBCF8\uBB38", "\uBB38\uBC95", "3\uB2E8\uBCC0\uD654"];
  function \uACFC\uC7A5_(\uC885\uB958) {
    return s_(\uC885\uB958) === "\uACFC";
  }
  function \uAD6C\uBD84\uC815\uB9AC_(v) {
    var t = s_(v);
    return \uACFC\uAD6C\uBD84\uB4E4_.indexOf(t) > -1 ? t : "\uB2E8\uC5B4";
  }
  function \uAD6C\uBD84\uBB38\uC7A5_(\uCE78) {
    return \uCE78 === "\uBCF8\uBB38" || \uCE78 === "\uBB38\uBC95";
  }
  function \uACFC\uC904\uB4E4_(sh, last) {
    var \uCE78\uC218 = Math.max(4, Math.min(5, sh.getLastColumn()));
    var v = sh.getRange(2, 1, last - 1, \uCE78\uC218).getValues();
    var out = [];
    v.forEach(function(x, i) {
      var en = s_(x[2]), ko = s_(x[3]);
      if (!en || !ko) return;
      var \uCE78 = \uAD6C\uBD84\uC815\uB9AC_(x[1]);
      var w = { no: Number(x[0]) || i + 1, en, ko, \uC885\uB958: "\uACFC", \uCE78 };
      var \uB2E4\uC12F\uC9F8 = \uCE78\uC218 > 4 ? s_(x[4]) : "";
      if (\uB2E4\uC12F\uC9F8) {
        if (\uAD6C\uBD84\uBB38\uC7A5_(\uCE78)) w.\uBE44\uACE0 = \uB2E4\uC12F\uC9F8;
        else w.\uADF8\uB9BC = \uB2E4\uC12F\uC9F8;
      }
      out.push(w);
    });
    out.sort(function(a, c) {
      return \uACFC\uAD6C\uBD84\uB4E4_.indexOf(a.\uCE78) - \uACFC\uAD6C\uBD84\uB4E4_.indexOf(c.\uCE78) || a.no - c.no;
    });
    var \uC13C = {};
    out.forEach(function(w) {
      \uC13C[w.\uCE78] = (\uC13C[w.\uCE78] || 0) + 1;
      w.no = \uC13C[w.\uCE78];
    });
    return out;
  }
  function \uBC94\uC704\uB2E8\uC5B4_(\uB2E8\uC5B4\uB4E4, \uCE78, \uC2DC\uC791, \uB05D) {
    var \uAC83 = \uB2E8\uC5B4\uB4E4 || [];
    if (s_(\uCE78)) \uAC83 = \uAC83.filter(function(w) {
      return (w.\uCE78 || \uC5B4\uB514\uB85C_(w.\uC885\uB958)) === s_(\uCE78);
    });
    if (\uC2DC\uC791 === void 0 || \uC2DC\uC791 === null || \uC2DC\uC791 === "") return \uAC83;
    var a = Number(\uC2DC\uC791) || 1, b = Number(\uB05D) || \uAC83.length;
    return \uAC83.filter(function(w, i) {
      return i + 1 >= a && i + 1 <= b;
    });
  }
  function \uACFC\uCE78\uC218_(\uC2DC\uD2B8) {
    var sh = \uC2DC\uD2B8 ? ss_().getSheetByName(\uC2DC\uD2B8) : null;
    var \uC218 = {};
    if (!sh || sh.getLastRow() < 2) return \uC218;
    sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues().forEach(function(x) {
      var k = \uAD6C\uBD84\uC815\uB9AC_(x[0]);
      \uC218[k] = (\uC218[k] || 0) + 1;
    });
    return \uC218;
  }
  function \uACFC\uBA74\uB9C9\uAE30_(\uB2E8\uC5B4\uC7A5) {
    var b = \uB2E8\uC5B4\uC7A5\uCC3E\uAE30_(\uB2E8\uC5B4\uC7A5);
    if (b && \uACFC\uC7A5_(b.\uC885\uB958)) {
      return { ok: false, \uBA54\uC2DC\uC9C0: "\uACFC \uB2E8\uC5B4\uC7A5\uC740 \u300C\uACFC \uD55C\uAEBC\uBC88\uC5D0 \uB123\uAE30\u300D \uB85C \uACE0\uCE69\uB2C8\uB2E4 \u2014 \u300C\uACFC \uAF34\uB85C \uBF51\uAE30\u300D \uB85C \uBF51\uC544\uC11C \uACE0\uCE5C \uB4A4 \uB36E\uC5B4\uC4F0\uAE30\uB85C \uB123\uC5B4 \uC8FC\uC138\uC694." };
    }
    return null;
  }
  function \uACFC\uB123\uAE30(\uBE44\uBC88, c) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    c = c || {};
    var \uC774\uB984 = s_(c.\uC774\uB984), \uAC1C\uC218 = { \uB2E8\uC5B4: 0, \uBCF8\uBB38: 0, \uBB38\uBC95: 0 };
    function \uB2F5(\uACB0\uACFC, \uAE4C\uB2ED) {
      return {
        ok: \uACB0\uACFC !== "\uC2E4\uD328",
        \uC774\uB984,
        \uC885\uB958: "\uACFC",
        \uAC1C\uC218,
        \uACB0\uACFC,
        \uAE4C\uB2ED: \uAE4C\uB2ED || "",
        \uB2E8\uC5B4\uC7A5\uBAA9\uB85D: \uACB0\uACFC === "\uC2E4\uD328" ? void 0 : \uB2E8\uC5B4\uC7A5\uBAA9\uB85D()
      };
    }
    if (!\uC774\uB984) return \uB2F5("\uC2E4\uD328", "\uB2E8\uC5B4\uC7A5 \uC774\uB984\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uB9E8 \uC704\uC5D0 \u300C## \uC9112 5\uACFC\u300D \uCC98\uB7FC \uC801\uC5B4 \uC8FC\uC138\uC694.");
    var \uC904 = [];
    \uACFC\uAD6C\uBD84\uB4E4_.forEach(function(k) {
      var n = 0;
      ((c.\uAD6C\uBD84\uB4E4 || {})[k] || []).forEach(function(r) {
        var en = s_(r && (r.en !== void 0 ? r.en : r[0]));
        var ko = s_(r && (r.ko !== void 0 ? r.ko : r[1]));
        var \uBE44\uACE0 = s_(r && (r.\uBE44\uACE0 !== void 0 ? r.\uBE44\uACE0 : r[2]));
        if (!en || !ko) return;
        n++;
        \uC904.push([n, k, en, ko, \uBE44\uACE0]);
      });
      if (n) \uAC1C\uC218[k] = n;
    });
    if (!\uC904.length) return \uB2F5("\uC2E4\uD328", "\uB123\uC744 \uC904\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
    var \uC788\uC74C = \uB2E8\uC5B4\uC7A5\uCC3E\uAE30_(\uC774\uB984);
    var sh = \uC788\uC74C ? ss_().getSheetByName(\uC788\uC74C.\uC2DC\uD2B8) : null;
    if (\uC788\uC74C && sh && !c.\uB36E\uC5B4\uC4F0\uAE30) return \uB2F5("\uAC74\uB108\uB700", "\uAC19\uC740 \uC774\uB984\uC758 \uB2E8\uC5B4\uC7A5\uC774 \uC774\uBBF8 \uC788\uC5B4\uC11C \uAC74\uB108\uB6F0\uC5C8\uC2B5\uB2C8\uB2E4.");
    if (\uC788\uC74C && sh && !\uACFC\uC7A5_(\uC788\uC74C.\uC885\uB958)) return \uB2F5("\uC2E4\uD328", "\uAC19\uC740 \uC774\uB984\uC758 \u300C" + (\uC788\uC74C.\uC885\uB958 || "\uBCF4\uD1B5") + "\u300D \uB2E8\uC5B4\uC7A5\uC774 \uC788\uC2B5\uB2C8\uB2E4. \uC774\uB984\uC744 \uBC14\uAFD4 \uC8FC\uC138\uC694.");
    if (!sh) sh = \uB2E8\uC5B4\uC2DC\uD2B8\uB9CC\uB4E4\uAE30_(\uC774\uB984, "\uACFC");
    else if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(5, sh.getLastColumn())).clearContent();
    sh.getRange(2, 1, \uC904.length, 5).setValues(\uC904);
    \uB2E8\uC5B4\uC218\uB9F5_ = null;
    return \uB2F5(\uC788\uC74C ? "\uB36E\uC74C" : "\uB9CC\uB4E6");
  }
  function \uBC30\uC815\uD480\uAE30_(v) {
    var t = s_(v);
    if (!t) return null;
    var \uBAA9\uB85D = t.split(/\s*[,|]\s*/).map(s_).filter(String);
    return \uBAA9\uB85D.length ? \uBAA9\uB85D : null;
  }
  function \uD559\uB144\uAD6C\uBD84_(v) {
    var t = s_(v);
    return t === "\uACE0\uB4F1" || t === "\uC720\uCE58" ? t : "\uCD08\uC911\uB4F1";
  }
  function \uB0B4\uB2E8\uC5B4\uC7A5_(\uBC30\uC815) {
    var \uC804\uCCB4 = \uB2E8\uC5B4\uC7A5\uBAA9\uB85D();
    if (!\uBC30\uC815) return \uC804\uCCB4;
    return \uC804\uCCB4.filter(function(b) {
      return \uBC30\uC815.indexOf(b.\uC774\uB984) > -1;
    });
  }
  function \uB85C\uADF8\uC778(\uC774\uB984, \uBE44\uBC88) {
    var \uCC3E\uB294\uC774\uB984 = \uC774\uB984\uB9DE\uCD94\uAE30_(\uC774\uB984);
    if (!\uCC3E\uB294\uC774\uB984) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBA85\uB2E8\uC5D0 \uC5C6\uB294 \uC774\uB984\uC774\uC5D0\uC694. \uC120\uC0DD\uB2D8\uAED8 \uB9D0\uC500\uB4DC\uB9AC\uC138\uC694." };
    var r = rows_(SHEET.\uD559\uC0DD);
    for (var i = 0; i < r.length; i++) {
      if (s_(r[i][1]) !== \uCC3E\uB294\uC774\uB984) continue;
      if (s_(r[i][2]) !== s_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2EC\uB77C\uC694." };
      var \uAD50\uC7AC = \uC904\uAD50\uC7AC_(r[i]);
      return {
        ok: true,
        \uD559\uC0DD: {
          \uC774\uB984: \uCC3E\uB294\uC774\uB984,
          \uD559\uB144\uAD6C\uBD84: s_(r[i][3]) || "\uCD08\uC911\uB4F1"
        },
        \uB2E8\uC5B4\uC7A5\uBAA9\uB85D: \uB0B4\uB2E8\uC5B4\uC7A5_(\uAD50\uC7AC.length ? \uAD50\uC7AC : null)
      };
    }
    return { ok: false, \uBA54\uC2DC\uC9C0: "\uBA85\uB2E8\uC5D0 \uC5C6\uB294 \uC774\uB984\uC774\uC5D0\uC694. \uC120\uC0DD\uB2D8\uAED8 \uB9D0\uC500\uB4DC\uB9AC\uC138\uC694." };
  }
  function \uC774\uB984\uB9DE\uCD94\uAE30_(\uC801\uC740\uAC83) {
    var \uC628\uAC83 = s_(\uC801\uC740\uAC83);
    if (!\uC628\uAC83) return "";
    var \uB2E4\uB4EC = function(x) {
      return s_(x).replace(/\s+/g, "");
    };
    var \uCC3E\uC744\uAC83 = \uB2E4\uB4EC(\uC628\uAC83);
    if (!\uCC3E\uC744\uAC83) return "";
    var r = rows_(SHEET.\uD559\uC0DD), \uD6C4\uBCF4 = "";
    for (var i = 0; i < r.length; i++) {
      var \uC774\uB984 = s_(r[i][1]);
      if (!\uC774\uB984) continue;
      if (\uC774\uB984 === \uC628\uAC83) return \uC774\uB984;
      if (!\uD6C4\uBCF4 && \uB2E4\uB4EC(\uC774\uB984) === \uCC3E\uC744\uAC83) \uD6C4\uBCF4 = \uC774\uB984;
    }
    return \uD6C4\uBCF4;
  }
  function \uBA85\uB2E8\uCE78\uD655\uBCF4_() {
    var sh = sheet_(SHEET.\uD559\uC0DD);
    if (sh.getMaxColumns() < 8) sh.insertColumnsAfter(sh.getMaxColumns(), 8 - sh.getMaxColumns());
    ["\uBCFC \uC218 \uC788\uB294 \uB2E8\uC5B4\uC7A5", "\uD559\uB144", "\uD559\uAD50", "\uAD50\uC7AC"].forEach(function(\uC774\uB984, i) {
      var \uCE78 = sh.getRange(1, 5 + i);
      if (s_(\uCE78.getValue()) === "") \uCE78.setValue(\uC774\uB984).setFontWeight("bold").setBackground("#EFF3F9");
    });
    return sh;
  }
  function \uAD50\uC7AC\uD480\uAE30_(v) {
    if (Object.prototype.toString.call(v) === "[object Array]") {
      return v.map(s_).filter(String);
    }
    var t = s_(v);
    if (!t) return [];
    var \uBCF8\uAC83 = {}, out = [];
    t.split(/\s*[,|]\s*/).forEach(function(x) {
      var n = s_(x);
      if (n && !\uBCF8\uAC83[n]) {
        \uBCF8\uAC83[n] = 1;
        out.push(n);
      }
    });
    return out;
  }
  function \uAD50\uC7AC\uAE00_(\uBAA9\uB85D) {
    return \uAD50\uC7AC\uD480\uAE30_(\uBAA9\uB85D).join(" | ");
  }
  function \uC904\uAD50\uC7AC_(r) {
    return \uAD50\uC7AC\uD480\uAE30_(r.length > 7 ? r[7] : "");
  }
  function \uAD50\uC7AC\uB9F5_() {
    var m = {};
    \uC77D\uAE30\uCE90\uC2DC_(SHEET.\uD559\uC0DD).forEach(function(r) {
      var \uC774\uB984 = s_(r[1]);
      if (!\uC774\uB984) return;
      m[\uC774\uB984] = \uC904\uAD50\uC7AC_(r);
    });
    return m;
  }
  function \uBA85\uB2E8\uAC00\uC838\uC624\uAE30(\uBE44\uBC88) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    \uBA85\uB2E8\uCE78\uD655\uBCF4_();
    var out = [];
    rows_(SHEET.\uD559\uC0DD).forEach(function(r, i) {
      var \uBC18 = s_(r[0]), \uC774\uB984 = s_(r[1]);
      if (!\uC774\uB984) return;
      out.push({
        \uD589: i + 2,
        \uBC18,
        \uC774\uB984,
        \uBE44\uBC00\uBC88\uD638: s_(r[2]),
        \uD559\uB144\uAD6C\uBD84: s_(r[3]) || "\uCD08\uC911\uB4F1",
        \uD559\uB144: r.length > 5 ? s_(r[5]) : "",
        \uD559\uAD50: r.length > 6 ? s_(r[6]) : "",
        \uAD50\uC7AC: \uC904\uAD50\uC7AC_(r),
        \uD559\uBD80\uBAA8\uC8FC\uC18C: r.length > 8 && \uD1A0\uD070\uBAA8\uC591_(r[8]) ? \uD559\uBD80\uBAA8\uC8FC\uC18C_(s_(r[8])) : "",
        \uD559\uBD80\uBAA8\uB9C8\uC9C0\uB9C9: r.length > 9 && r[9] instanceof Date2 ? Utilities.formatDate(r[9], Session.getScriptTimeZone(), "M/d HH:mm") : "",
        \uD55C\uB9C8\uB514: r.length > 10 ? s_(r[10]) : ""
      });
    });
    return { ok: true, \uD559\uC0DD: out };
  }
  function \uAD50\uC7AC\uC77C\uAD04(\uBE44\uBC88, \uD589\uB4E4, \uAD50\uC7AC\uB4E4, \uBC29\uC2DD) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    var \uC904\uBC88\uD638 = (\uD589\uB4E4 || []).map(Number).filter(function(n) {
      return n >= 2;
    });
    if (!\uC904\uBC88\uD638.length) return { ok: false, \uBA54\uC2DC\uC9C0: "\uD559\uC0DD\uC744 \uACE8\uB77C \uC8FC\uC138\uC694." };
    var \uACE0\uB978 = \uAD50\uC7AC\uD480\uAE30_(\uAD50\uC7AC\uB4E4);
    var \uC5B4\uB5BB\uAC8C = s_(\uBC29\uC2DD) || "\uCD94\uAC00";
    if (\uC5B4\uB5BB\uAC8C !== "\uBE7C\uAE30" && \uC5B4\uB5BB\uAC8C !== "\uB36E\uC5B4\uC4F0\uAE30") \uC5B4\uB5BB\uAC8C = "\uCD94\uAC00";
    if (\uC5B4\uB5BB\uAC8C !== "\uB36E\uC5B4\uC4F0\uAE30" && !\uACE0\uB978.length) return { ok: false, \uBA54\uC2DC\uC9C0: "\uAD50\uC7AC\uB97C \uACE8\uB77C \uC8FC\uC138\uC694." };
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(1e4);
    } catch (e) {
      return { ok: false, \uBA54\uC2DC\uC9C0: "\uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694" };
    }
    var \uBC14\uB010 = 0;
    try {
      var sh = \uBA85\uB2E8\uCE78\uD655\uBCF4_();
      var \uB05D = sh.getLastRow();
      if (\uB05D < 2) return { ok: false, \uBA54\uC2DC\uC9C0: "\uD559\uC0DD\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." };
      var \uCE78 = sh.getRange(2, 8, \uB05D - 1, 1);
      var \uAC12 = \uCE78.getValues();
      \uC904\uBC88\uD638.forEach(function(n) {
        var i = n - 2;
        if (i < 0 || i >= \uAC12.length) return;
        var \uC9C0\uAE08 = \uAD50\uC7AC\uD480\uAE30_(\uAC12[i][0]);
        var \uC0C8\uAC83;
        if (\uC5B4\uB5BB\uAC8C === "\uB36E\uC5B4\uC4F0\uAE30") {
          \uC0C8\uAC83 = \uACE0\uB978.slice();
        } else if (\uC5B4\uB5BB\uAC8C === "\uBE7C\uAE30") {
          \uC0C8\uAC83 = \uC9C0\uAE08.filter(function(t) {
            return \uACE0\uB978.indexOf(t) < 0;
          });
        } else {
          \uC0C8\uAC83 = \uC9C0\uAE08.slice();
          \uACE0\uB978.forEach(function(t) {
            if (\uC0C8\uAC83.indexOf(t) < 0) \uC0C8\uAC83.push(t);
          });
        }
        var \uAE00 = \uAD50\uC7AC\uAE00_(\uC0C8\uAC83);
        if (\uAE00 !== \uAD50\uC7AC\uAE00_(\uC9C0\uAE08)) {
          \uAC12[i][0] = \uAE00;
          \uBC14\uB010++;
        }
      });
      if (\uBC14\uB010) \uCE78.setValues(\uAC12);
    } finally {
      lock.releaseLock();
    }
    return { ok: true, \uC778\uC6D0: \uBC14\uB010, \uBC29\uC2DD: \uC5B4\uB5BB\uAC8C, \uAD50\uC7AC: \uACE0\uB978, \uD559\uC0DD: \uBA85\uB2E8\uAC00\uC838\uC624\uAE30(\uBE44\uBC88).\uD559\uC0DD };
  }
  function \uD559\uC0DD\uC218\uC815(\uBE44\uBC88, \uD589, v) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    var sh = \uBA85\uB2E8\uCE78\uD655\uBCF4_();
    var n = Number(\uD589);
    if (!(n >= 2 && n <= sh.getLastRow())) return { ok: false, \uBA54\uC2DC\uC9C0: "\uC774\uBBF8 \uC9C0\uC6CC\uC9C4 \uD559\uC0DD\uC785\uB2C8\uB2E4." };
    var \uC61B = sh.getRange(n, 1, 1, 8).getValues()[0];
    var \uC61B\uC774\uB984 = s_(\uC61B[1]);
    var \uC0C8\uC774\uB984 = s_(v.\uC774\uB984) || \uC61B\uC774\uB984;
    if (!\uC0C8\uC774\uB984) return { ok: false, \uBA54\uC2DC\uC9C0: "\uC774\uB984\uC740 \uBE44\uC6B8 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." };
    var \uACB9\uCE68 = false;
    rows_(SHEET.\uD559\uC0DD).forEach(function(r, i) {
      if (i + 2 === n) return;
      if (s_(r[1]) === \uC0C8\uC774\uB984) \uACB9\uCE68 = true;
    });
    if (\uACB9\uCE68) return { ok: false, \uBA54\uC2DC\uC9C0: "\u201C" + \uC0C8\uC774\uB984 + "\u201D \uC740 \uC774\uBBF8 \uC788\uB294 \uC774\uB984\uC785\uB2C8\uB2E4. \uC774\uB984\uC73C\uB85C \uB85C\uADF8\uC778\uD558\uB2C8 \uACB9\uCE58\uBA74 \uC548 \uB429\uB2C8\uB2E4." };
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(1e4);
    } catch (e) {
      return { ok: false, \uBA54\uC2DC\uC9C0: "\uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694" };
    }
    var \uC62E\uAE34\uAE30\uB85D = 0;
    try {
      sh.getRange(n, 1, 1, 8).setValues([[
        s_(\uC61B[0]),
        \uC0C8\uC774\uB984,
        s_(v.\uBE44\uBC00\uBC88\uD638) || s_(\uC61B[2]) || "1234",
        \uD559\uB144\uAD6C\uBD84_(v.\uD559\uB144\uAD6C\uBD84),
        s_(\uC61B[4]),
        // 배정은 건드리지 않는다
        s_(v.\uD559\uB144),
        s_(v.\uD559\uAD50),
        v.\uAD50\uC7AC === void 0 ? s_(\uC61B[7]) : \uAD50\uC7AC\uAE00_(v.\uAD50\uC7AC)
      ]]);
      if (\uC0C8\uC774\uB984 !== \uC61B\uC774\uB984) {
        \uC62E\uAE34\uAE30\uB85D = \uD559\uC0DD\uC774\uB984\uBC14\uAFB8\uAE30_(\uC61B\uC774\uB984, \uC0C8\uC774\uB984);
      }
    } finally {
      lock.releaseLock();
    }
    return { ok: true, \uC62E\uAE34\uAE30\uB85D, \uD559\uC0DD: \uBA85\uB2E8\uAC00\uC838\uC624\uAE30(\uBE44\uBC88).\uD559\uC0DD };
  }
  function \uD559\uC0DD\uC774\uB984\uBC14\uAFB8\uAE30_(\uC61B\uC774\uB984, \uC0C8\uC774\uB984) {
    var \uBC14\uB01C = 0;
    [SHEET.\uAE30\uB85D, SHEET.\uAE30\uB85D\uBCF4\uAD00].forEach(function(name) {
      var sh = ss_().getSheetByName(name);
      if (!sh) return;
      var last = sh.getLastRow();
      if (last < 2) return;
      var rng = sh.getRange(2, 3, last - 1, 1);
      var v = rng.getValues();
      var \uC190\uB310 = false;
      for (var i = 0; i < v.length; i++) {
        if (s_(v[i][0]) === \uC61B\uC774\uB984) {
          v[i][0] = \uC0C8\uC774\uB984;
          \uC190\uB310 = true;
          \uBC14\uB01C++;
        }
      }
      if (\uC190\uB310) rng.setValues(v);
    });
    var ps = ss_().getSheetByName(SHEET.\uC810\uC218);
    if (ps && ps.getLastRow() >= 2) {
      var pr = ps.getRange(2, 3, ps.getLastRow() - 1, 1);
      var pv = pr.getValues();
      var p\uC190\uB310 = false;
      for (var j = 0; j < pv.length; j++) {
        if (s_(pv[j][0]) === \uC61B\uC774\uB984) {
          pv[j][0] = \uC0C8\uC774\uB984;
          p\uC190\uB310 = true;
          \uBC14\uB01C++;
        }
      }
      if (p\uC190\uB310) pr.setValues(pv);
    }
    var hs = ss_().getSheetByName(SHEET.\uC219\uC81C);
    if (hs && hs.getLastRow() >= 2) {
      var hr = hs.getRange(2, 8, hs.getLastRow() - 1, 1);
      var hv = hr.getValues();
      var h\uC190\uB310 = false;
      for (var k = 0; k < hv.length; k++) {
        var \uBAA9\uB85D = \uC774\uB984\uB4E4\uD480\uAE30_(hv[k][0]);
        if (\uBAA9\uB85D.indexOf(\uC61B\uC774\uB984) < 0) continue;
        hv[k][0] = \uBAA9\uB85D.map(function(n) {
          return n === \uC61B\uC774\uB984 ? \uC0C8\uC774\uB984 : n;
        }).join(", ");
        h\uC190\uB310 = true;
        \uBC14\uB01C++;
      }
      if (h\uC190\uB310) hr.setValues(hv);
    }
    [SHEET.\uAC8C\uC784, SHEET.\uD478\uC2DC].forEach(function(name) {
      var sh = ss_().getSheetByName(name);
      if (!sh || sh.getLastRow() < 2) return;
      var rng = sh.getRange(2, 3, sh.getLastRow() - 1, 1);
      var v = rng.getValues();
      var \uC190\uB310 = false;
      for (var i = 0; i < v.length; i++) {
        if (s_(v[i][0]) === \uC61B\uC774\uB984) {
          v[i][0] = \uC0C8\uC774\uB984;
          \uC190\uB310 = true;
          \uBC14\uB01C++;
        }
      }
      if (\uC190\uB310) rng.setValues(v);
    });
    return \uBC14\uB01C;
  }
  function \uC6D4_(d) {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM");
  }
  function \uC9C0\uB09C\uB2EC_(ym) {
    var p = String(ym).split("-");
    var y = Number(p[0]), m = Number(p[1]) - 1;
    if (m < 1) {
      m = 12;
      y--;
    }
    return y + "-" + (m < 10 ? "0" + m : m);
  }
  function \uC124\uC815\uC4F0\uAE30_(\uD56D\uBAA9, \uAC12) {
    \uD569\uACA9\uC810\uCE90\uC2DC_ = null;
    \uC61B\uC2DC\uD5D8\uC2DC\uAC04\uCE90\uC2DC_ = null;
    var sh = sheet_(SHEET.\uC124\uC815);
    var v = rows_(SHEET.\uC124\uC815);
    var \uC904 = 0;
    for (var i = 0; i < v.length; i++) {
      if (s_(v[i][0]) === \uD56D\uBAA9) {
        \uC904 = i + 2;
        break;
      }
    }
    if (!\uC904) {
      sh.appendRow([\uD56D\uBAA9, \uAC12]);
      \uC904 = sh.getLastRow();
    } else sh.getRange(\uC904, 2).setValue(\uAC12);
    sh.getRange(\uC904, 2).setNumberFormat("@");
    return \uC904;
  }
  var \uC2DC\uC0C1\uD56D\uBAA9\uC804\uCCB4 = ["\uC219\uC81C", "\uC2DC\uD5D8", "\uBCF4\uCDA9", "\uC624\uB2F5\uB178\uD2B8"];
  function \uC2DC\uC0C1\uD56D\uBAA9_() {
    var t = s_(setting_("\uC2DC\uC0C1\uD56D\uBAA9", ""));
    if (!t) return ["\uC219\uC81C"];
    var \uACE0\uB978 = t.split(",").map(function(x) {
      return s_(x);
    }).filter(function(x) {
      return \uC2DC\uC0C1\uD56D\uBAA9\uC804\uCCB4.indexOf(x) > -1;
    });
    return \uACE0\uB978.length ? \uACE0\uB978 : ["\uC219\uC81C"];
  }
  function \uC2DC\uC0C1\uD56D\uBAA9\uC800\uC7A5(\uBE44\uBC88, \uBAA9\uB85D) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    var \uACE0\uB978 = (\uBAA9\uB85D || []).map(function(x) {
      return s_(x);
    }).filter(function(x) {
      return \uC2DC\uC0C1\uD56D\uBAA9\uC804\uCCB4.indexOf(x) > -1;
    });
    if (!\uACE0\uB978.length) return { ok: false, \uBA54\uC2DC\uC9C0: "\uC801\uC5B4\uB3C4 \uD55C \uAC00\uC9C0\uB294 \uACE8\uB77C \uC8FC\uC138\uC694." };
    \uC124\uC815\uC4F0\uAE30_("\uC2DC\uC0C1\uD56D\uBAA9", \uACE0\uB978.join(","));
    return { ok: true, \uD56D\uBAA9: \uACE0\uB978 };
  }
  function \uAE30\uB85D\uD56D\uBAA9_(\uAD6C\uBD84, \uC219\uC81C\uC5EC\uBD80) {
    var g = s_(\uAD6C\uBD84);
    if (g === \uC7AC\uC2DC\uD5D8\uD45C\uC2DC) return "\uC624\uB2F5\uB178\uD2B8";
    if (g === \uC2DC\uD5D8\uD45C\uC2DC) return "\uC2DC\uD5D8";
    if (g === \uBCF4\uCDA9\uD45C\uC2DC) return "\uBCF4\uCDA9";
    return \uC219\uC81C\uC600\uB098_(\uC219\uC81C\uC5EC\uBD80) ? "\uC219\uC81C" : "\uC5F0\uC2B5";
  }
  function \uAE30\uB85D\uCE78\uD655\uBCF4_(name) {
    var sh = sheet_(name);
    if (sh.getMaxColumns() < \uC81C\uC678\uC5F4) {
      sh.insertColumnsAfter(sh.getMaxColumns(), \uC81C\uC678\uC5F4 - sh.getMaxColumns());
    }
    var \uCE78 = sh.getRange(1, \uC81C\uC678\uC5F4);
    if (s_(\uCE78.getValue()) === "") {
      \uCE78.setValue("\uC9D1\uACC4\uC81C\uC678").setFontWeight("bold").setBackground("#EFF3F9");
      sh.setColumnWidth(\uC81C\uC678\uC5F4, 80);
    }
    return sh;
  }
  function \uAE30\uB85D\uC81C\uC678\uC124\uC815(\uBE44\uBC88, \uD0A4\uB4E4, \uBE84\uAE4C) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    var set = {};
    (\uD0A4\uB4E4 || []).forEach(function(k) {
      set[Number(k)] = 1;
    });
    if (!Object.keys(set).length) return { ok: false, \uBA54\uC2DC\uC9C0: "\uACE0\uB978 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." };
    var \uAC12 = \uBE84\uAE4C ? "O" : "";
    var \uBC14\uAFBC\uC218 = 0;
    [SHEET.\uAE30\uB85D, SHEET.\uAE30\uB85D\uBCF4\uAD00].forEach(function(name) {
      var sh = \uAE30\uB85D\uCE78\uD655\uBCF4_(name);
      var last = sh.getLastRow();
      if (last < 2) return;
      var \uB0A0\uB4E4 = sh.getRange(2, 1, last - 1, 1).getValues();
      var \uC9C0\uAE08 = sh.getRange(2, \uC81C\uC678\uC5F4, last - 1, 1).getValues();
      var \uBC14\uB01C = false;
      for (var i = 0; i < \uB0A0\uB4E4.length; i++) {
        var d = \uB0A0\uB4E4[i][0];
        if (!(d instanceof Date2) || !set[d.getTime()]) continue;
        if (s_(\uC9C0\uAE08[i][0]) === \uAC12) continue;
        \uC9C0\uAE08[i][0] = \uAC12;
        \uBC14\uB01C = true;
        \uBC14\uAFBC\uC218++;
      }
      if (\uBC14\uB01C) sh.getRange(2, \uC81C\uC678\uC5F4, last - 1, 1).setValues(\uC9C0\uAE08);
    });
    return { ok: true, \uAC1C\uC218: \uBC14\uAFBC\uC218, \uBE90\uB098: !!\uBE84\uAE4C };
  }
  function \uC2DC\uC0C1\uC2DC\uC791\uC77C_() {
    var v = setting_("\uC2DC\uC0C1\uC2DC\uC791\uC77C", "");
    if (v instanceof Date2) return ymd_(v);
    var t = s_(v);
    return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : "";
  }
  function \uC219\uC81C\uC600\uB098_(v) {
    if (v === true || v === 1) return true;
    var t = s_(v).toUpperCase();
    if (!t) return false;
    if (t === "X" || t === "FALSE" || t === "\uC544\uB2C8\uC624" || t === "0") return false;
    return true;
  }
  function \uADF8\uB2EC\uAE30\uB85D_(ym) {
    var out = [];
    var \uC2DC\uC791 = \uC2DC\uC0C1\uC2DC\uC791\uC77C_();
    [SHEET.\uAE30\uB85D, SHEET.\uAE30\uB85D\uBCF4\uAD00].forEach(function(name) {
      rows_(name).forEach(function(x) {
        if (!(x[0] instanceof Date2)) return;
        if (\uC6D4_(x[0]) !== ym) return;
        if (\uC2DC\uC791 && ymd_(x[0]) < \uC2DC\uC791) return;
        var \uD56D\uBAA9 = \uAE30\uB85D\uD56D\uBAA9_(x[14], x[12]);
        if (\uD56D\uBAA9 === "\uC5F0\uC2B5") return;
        out.push({
          \uB0A0: ymd_(x[0]),
          \uBC18: s_(x[1]),
          \uC774\uB984: s_(x[2]),
          \uB2E8\uC5B4\uC7A5: s_(x[3]),
          \uBC94\uC704: s_(x[4]),
          \uD56D\uBAA9,
          \uC2DC\uD5D8: \uD56D\uBAA9 === "\uC2DC\uD5D8",
          // 시험은 평균을 따로 낸다
          \uBE8C: s_(x[\uC81C\uC678\uC5F4 - 1]) === "O",
          // 선생님이 하나씩 뺀 기록 — 평균에서만 빠진다
          \uC810\uC218: Number(x[8]) || 0
        });
      });
    });
    return out;
  }
  function \uB2EC\uC131\uC801_(ym, \uD56D\uBAA9\uB4E4) {
    var \uAE30\uB85D = \uADF8\uB2EC\uAE30\uB85D_(ym);
    var \uB123\uC744\uAC83 = {};
    (\uD56D\uBAA9\uB4E4 || \uC2DC\uC0C1\uD56D\uBAA9_()).forEach(function(k) {
      \uB123\uC744\uAC83[k] = 1;
    });
    var \uB9F5 = {};
    \uAE30\uB85D.forEach(function(r) {
      var \uC140\uAE4C = !!\uB123\uC744\uAC83[r.\uD56D\uBAA9] && !r.\uBE8C;
      var k = r.\uC774\uB984;
      if (!\uB9F5[k]) \uB9F5[k] = {
        \uC774\uB984: r.\uC774\uB984,
        \uAC74\uC218: 0,
        \uD569: 0,
        \uB9CC\uC810: 0,
        // 숙제로 본 시험
        \uC2DC\uD5D8\uAC74\uC218: 0,
        \uC2DC\uD5D8\uD569: 0,
        // 학원에서 본 시험
        \uB0B8\uAC83: {}
      };
      var m = \uB9F5[k];
      if (r.\uD56D\uBAA9 !== "\uC624\uB2F5\uB178\uD2B8") {
        var \uD0A4 = r.\uB2E8\uC5B4\uC7A5 + "|" + r.\uBC94\uC704;
        var \uCE78 = m.\uB0B8\uAC83[\uD0A4] = m.\uB0B8\uAC83[\uD0A4] || {};
        if (\uCE78[r.\uB0A0] === void 0 || r.\uC810\uC218 > \uCE78[r.\uB0A0]) \uCE78[r.\uB0A0] = r.\uC810\uC218;
      }
      if (r.\uC2DC\uD5D8 && !r.\uBE8C) {
        m.\uC2DC\uD5D8\uAC74\uC218++;
        m.\uC2DC\uD5D8\uD569 += r.\uC810\uC218;
      }
      if (!\uC140\uAE4C) return;
      m.\uAC74\uC218++;
      m.\uD569 += r.\uC810\uC218;
      if (r.\uC810\uC218 >= 100) m.\uB9CC\uC810++;
    });
    Object.keys(\uB9F5).forEach(function(k) {
      var m = \uB9F5[k];
      m.\uD3C9\uADE0 = m.\uAC74\uC218 ? Math.round(m.\uD569 / m.\uAC74\uC218) : 0;
      m.\uC2DC\uD5D8\uD3C9\uADE0 = m.\uC2DC\uD5D8\uAC74\uC218 ? Math.round(m.\uC2DC\uD5D8\uD569 / m.\uC2DC\uD5D8\uAC74\uC218) : null;
    });
    return \uB9F5;
  }
  function \uD3C9\uADE0\uB0B4\uAE30_(m, \uC548\uD55C\uC218) {
    var \uBD84\uBAA8 = (m.\uAC74\uC218 || 0) + (\uC548\uD55C\uC218 || 0);
    return \uBD84\uBAA8 ? Math.round((m.\uD569 || 0) / \uBD84\uBAA8) : null;
  }
  function \uADF8\uB2EC\uC219\uC81C_(ym) {
    var \uC2DC\uC791\uC77C = \uC2DC\uC0C1\uC2DC\uC791\uC77C_();
    var \uC219\uC81C = [];
    rows_(SHEET.\uC219\uC81C).forEach(function(x) {
      var \uB4F1\uB85D = x[6] instanceof Date2 ? x[6] : null;
      var \uB9C8\uAC10 = x[5] instanceof Date2 ? ymd_(x[5]) : s_(x[5]);
      var \uAE30\uC900\uB2EC = \uB9C8\uAC10 ? String(\uB9C8\uAC10).slice(0, 7) : \uB4F1\uB85D ? \uC6D4_(\uB4F1\uB85D) : "";
      if (\uAE30\uC900\uB2EC !== ym) return;
      if (\uC2DC\uC791\uC77C && \uB9C8\uAC10 && \uB9C8\uAC10 < \uC2DC\uC791\uC77C) return;
      if (\uC219\uC81C\uC885\uB958_(x[8]) === "\uBCF4\uCDA9" || \uC219\uC81C\uC885\uB958_(x[8]) === "\uC2DC\uD5D8") return;
      \uC219\uC81C.push({
        \uBC18: s_(x[0]),
        \uB2E8\uC5B4\uC7A5: s_(x[1]),
        \uBC94\uC704: (Number(x[2]) || 1) + "~" + (Number(x[3]) || 0),
        \uC2DC\uC791: Number(x[2]) || 1,
        \uB05D: Number(x[3]) || 0,
        \uCE78: s_(x.length > 11 ? x[11] : ""),
        // 과 숙제의 구분 — 기록 범위가 「본문 1~12」 꼴이다
        \uD559\uC0DD: s_(x[7]),
        \uC885\uB958: \uC219\uC81C\uC885\uB958_(x[8] || "\uAE30\uD55C"),
        \uB4F1\uB85D: \uB4F1\uB85D ? ymd_(\uB4F1\uB85D) : "",
        \uB9C8\uAC10
      });
    });
    return \uC219\uC81C;
  }
  function \uC81C\uCD9C\uD604\uD669_(\uC219\uC81C\uB4E4, \uC804\uCCB4, \uC131\uC801\uB9F5, \uAD50\uC7AC\uB9F5, \uBC18\uD559\uC0DD) {
    var out = {};
    \uC804\uCCB4.forEach(function(\uC774\uB984) {
      var \uB0B8\uAC83 = \uC131\uC801\uB9F5[\uC774\uB984] && \uC131\uC801\uB9F5[\uC774\uB984].\uB0B8\uAC83 || {};
      var \uB0B4\uC219\uC81C = \uC219\uC81C\uB4E4.filter(function(h) {
        return \uB0B4\uC219\uC81C\uC778\uAC00_(h, \uC774\uB984, \uAD50\uC7AC\uB9F5, \uBC18\uD559\uC0DD);
      });
      var \uB0B8\uC218 = 0, \uC548\uD55C\uC218 = 0;
      \uB0B4\uC219\uC81C.forEach(function(h) {
        var \uC774\uB984\uB4E4 = h.\uCE78 ? [h.\uCE78 + " " + h.\uC2DC\uC791 + "~" + h.\uB05D] : \uBC94\uC704\uC774\uB984\uB4E4_(h.\uB2E8\uC5B4\uC7A5, h.\uC2DC\uC791, h.\uB05D);
        var \uB0A0\uB4E4 = \uC774\uB984\uB4E4.reduce(function(\uCC3E\uC74C, \uBC94) {
          return \uCC3E\uC74C || \uB0B8\uAC83[h.\uB2E8\uC5B4\uC7A5 + "|" + \uBC94];
        }, null);
        var \uD310\uB2E8\uB0A0 = h.\uB9C8\uAC10 || h.\uB4F1\uB85D || "";
        if (\uB0B8\uAC83_(\uB0A0\uB4E4, h.\uC885\uB958, h.\uB4F1\uB85D, \uD310\uB2E8\uB0A0)) \uB0B8\uC218++;
        if (!\uD47C\uAC83_(\uB0A0\uB4E4, h.\uC885\uB958, h.\uB4F1\uB85D, \uD310\uB2E8\uB0A0, 0)) \uC548\uD55C\uC218++;
      });
      out[\uC774\uB984] = { \uC219\uC81C\uC218: \uB0B4\uC219\uC81C.length, \uB0B8\uC218, \uC548\uD55C\uC218 };
    });
    return out;
  }
  function \uC2DC\uC0C1\uC9D1\uACC4(\uBE44\uBC88, \uB144\uC6D4) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    var ym = s_(\uB144\uC6D4) || \uC6D4_(new Date2());
    var \uC804\uB2EC = \uC9C0\uB09C\uB2EC_(ym);
    var \uD56D\uBAA9 = \uC2DC\uC0C1\uD56D\uBAA9_();
    var \uC774\uBC88 = \uB2EC\uC131\uC801_(ym, \uD56D\uBAA9);
    var \uC9C0\uB09C = \uB2EC\uC131\uC801_(\uC804\uB2EC, \uD56D\uBAA9);
    var \uC804\uCCB4 = \uC804\uCCB4\uBA85\uB2E8_();
    var \uAD50\uC7AC\uB9F5 = \uAD50\uC7AC\uB9F5_();
    var \uBC18\uD559\uC0DD = \uBC18\uBCC4\uBA85\uB2E8_();
    var \uC2DC\uC791\uC77C = \uC2DC\uC0C1\uC2DC\uC791\uC77C_();
    var \uC219\uC81C = \uADF8\uB2EC\uC219\uC81C_(ym);
    var \uD604\uD669 = \uC81C\uCD9C\uD604\uD669_(\uC219\uC81C, \uC804\uCCB4, \uC774\uBC88, \uAD50\uC7AC\uB9F5, \uBC18\uD559\uC0DD);
    var \uC9C0\uB09C\uD604\uD669 = \uC81C\uCD9C\uD604\uD669_(\uADF8\uB2EC\uC219\uC81C_(\uC804\uB2EC), \uC804\uCCB4, \uC9C0\uB09C, \uAD50\uC7AC\uB9F5, \uBC18\uD559\uC0DD);
    var \uC904 = [];
    {
      \uC804\uCCB4.forEach(function(\uC774\uB984) {
        var k = \uC774\uB984;
        var m = \uC774\uBC88[k] || { \uAC74\uC218: 0, \uD569: 0, \uD3C9\uADE0: 0, \uB9CC\uC810: 0, \uC2DC\uD5D8\uAC74\uC218: 0, \uC2DC\uD5D8\uD3C9\uADE0: null, \uB0B8\uAC83: {} };
        var p = \uC9C0\uB09C[k];
        var c = \uD604\uD669[k] || { \uC219\uC81C\uC218: 0, \uB0B8\uC218: 0, \uC548\uD55C\uC218: 0 };
        var pc = \uC9C0\uB09C\uD604\uD669[k] || { \uC219\uC81C\uC218: 0, \uB0B8\uC218: 0, \uC548\uD55C\uC218: 0 };
        var \uD3C9\uADE0 = \uD3C9\uADE0\uB0B4\uAE30_(m, c.\uC548\uD55C\uC218);
        var \uC9C0\uB09C\uD3C9\uADE0 = p ? \uD3C9\uADE0\uB0B4\uAE30_(p, pc.\uC548\uD55C\uC218) : null;
        \uC904.push({
          \uC774\uB984,
          \uC219\uC81C\uC218: c.\uC219\uC81C\uC218,
          \uB0B8\uC218: c.\uB0B8\uC218,
          \uBABB\uB0B8: c.\uC548\uD55C\uC218,
          // 아예 안 낸 숙제 — 평균에 0점으로 들어간다
          \uC81C\uCD9C\uB960: c.\uC219\uC81C\uC218 ? Math.round(c.\uB0B8\uC218 / c.\uC219\uC81C\uC218 * 100) : null,
          \uAC74\uC218: m.\uAC74\uC218,
          \uD3C9\uADE0,
          \uC2DC\uD5D8\uAC74\uC218: m.\uC2DC\uD5D8\uAC74\uC218 || 0,
          \uC2DC\uD5D8\uD3C9\uADE0: m.\uC2DC\uD5D8\uAC74\uC218 ? m.\uC2DC\uD5D8\uD3C9\uADE0 : null,
          \uB9CC\uC810: m.\uB9CC\uC810,
          \uC9C0\uB09C\uD3C9\uADE0,
          \uD5A5\uC0C1: \uC9C0\uB09C\uD3C9\uADE0 !== null && \uD3C9\uADE0 !== null ? \uD3C9\uADE0 - \uC9C0\uB09C\uD3C9\uADE0 : null
        });
      });
    }
    function \uCD5C\uACE0(\uAC12\uBF51\uAE30, \uCD5C\uC18C, \uB3D9\uC810\uC815\uB9AC) {
      var \uD6C4\uBCF4 = \uC904.filter(function(r) {
        var v = \uAC12\uBF51\uAE30(r);
        return v !== null && v !== void 0 && v >= (\uCD5C\uC18C === void 0 ? 0 : \uCD5C\uC18C);
      });
      if (!\uD6C4\uBCF4.length) return null;
      var \uCD5C\uB300 = Math.max.apply(null, \uD6C4\uBCF4.map(\uAC12\uBF51\uAE30));
      var \uB3D9\uC810 = \uD6C4\uBCF4.filter(function(r) {
        return \uAC12\uBF51\uAE30(r) === \uCD5C\uB300;
      });
      if (\uB3D9\uC810\uC815\uB9AC) \uB3D9\uC810 = \uB3D9\uC810\uC815\uB9AC(\uB3D9\uC810);
      return {
        \uAC12: \uCD5C\uB300,
        \uC8FC\uC778\uACF5: \uB3D9\uC810[0],
        \uB3D9\uC810: \uB3D9\uC810.map(function(r) {
          return { \uC774\uB984: r.\uC774\uB984 };
        })
      };
    }
    var \uC0C1 = {
      \uCD5C\uC6B0\uC218: \uCD5C\uACE0(
        function(r) {
          return r.\uD3C9\uADE0;
        },
        1,
        function(\uB3D9\uC810) {
          \uB3D9\uC810.sort(function(a, b) {
            return b.\uAC74\uC218 - a.\uAC74\uC218;
          });
          return \uB3D9\uC810.filter(function(r) {
            return r.\uAC74\uC218 === \uB3D9\uC810[0].\uAC74\uC218;
          });
        }
      ),
      \uC131\uC2E4: \uCD5C\uACE0(
        function(r) {
          return r.\uC219\uC81C\uC218 > 0 ? r.\uC81C\uCD9C\uB960 : null;
        },
        1,
        function(\uB3D9\uC810) {
          \uB3D9\uC810.sort(function(a, b) {
            return b.\uB0B8\uC218 - a.\uB0B8\uC218;
          });
          return \uB3D9\uC810.filter(function(r) {
            return r.\uB0B8\uC218 === \uB3D9\uC810[0].\uB0B8\uC218;
          });
        }
      ),
      \uBC1C\uC804: \uCD5C\uACE0(function(r) {
        return r.\uD5A5\uC0C1;
      }, 1)
    };
    \uC904.sort(function(a, b) {
      return (b.\uD3C9\uADE0 || 0) - (a.\uD3C9\uADE0 || 0);
    });
    return {
      ok: true,
      \uB144\uC6D4: ym,
      \uC9C0\uB09C\uB2EC: \uC804\uB2EC,
      \uC0C1,
      \uC904,
      \uC219\uC81C\uC218: \uC219\uC81C.length,
      \uC2DC\uC791\uC77C,
      \uD56D\uBAA9,
      \uD56D\uBAA9\uC804\uCCB4: \uC2DC\uC0C1\uD56D\uBAA9\uC804\uCCB4
    };
  }
  var \uC0C1\uC774\uB984\uD45C = [
    { \uD0A4: "\uCD5C\uC6B0\uC218", \uC774\uB984: "\uCD5C\uC6B0\uC218\uC0C1" },
    { \uD0A4: "\uC131\uC2E4", \uC774\uB984: "\uC131\uC2E4\uC0C1" },
    { \uD0A4: "\uBC1C\uC804", \uC774\uB984: "\uBC1C\uC804\uC0C1" }
  ];
  function \uC0C1\uAE30\uB85D\uAE00_(\uD0A4, w) {
    var r = w.\uC8FC\uC778\uACF5;
    if (\uD0A4 === "\uCD5C\uC6B0\uC218") return w.\uAC12 + "\uC810 (\uC219\uC81C " + r.\uAC74\uC218 + "\uBC88)";
    if (\uD0A4 === "\uC131\uC2E4") return w.\uAC12 + "% (" + r.\uC219\uC81C\uC218 + "\uAC1C \uC911 " + r.\uB0B8\uC218 + "\uAC1C)";
    return "+" + w.\uAC12 + "\uC810 (" + r.\uC9C0\uB09C\uD3C9\uADE0 + " \u2192 " + r.\uD3C9\uADE0 + ")";
  }
  function \uC2DC\uC0C1\uC800\uC7A5(\uB144\uC6D4) {
    var ym = s_(\uB144\uC6D4) || \uC6D4_(new Date2());
    var r = \uC2DC\uC0C1\uC9D1\uACC4(setting_("\uC120\uC0DD\uB2D8\uBE44\uBC00\uBC88\uD638", "1234"), ym);
    if (!r.ok) return { ok: false, \uBA54\uC2DC\uC9C0: "\uC9D1\uACC4\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4." };
    var ss = ss_();
    var sh = ss.getSheetByName(SHEET.\uC2DC\uC0C1);
    if (!sh) {
      sh = ss.insertSheet(SHEET.\uC2DC\uC0C1);
      sh.getRange(1, 1, 1, HEADERS.\uC2DC\uC0C1.length).setValues([HEADERS.\uC2DC\uC0C1]).setFontWeight("bold").setBackground("#EFF3F9");
      sh.setFrozenRows(1);
    }
    if (s_(sh.getRange(1, 1).getValue()) === "") {
      sh.getRange(1, 1, 1, HEADERS.\uC2DC\uC0C1.length).setValues([HEADERS.\uC2DC\uC0C1]).setFontWeight("bold").setBackground("#EFF3F9");
      sh.setFrozenRows(1);
    }
    var last = sh.getLastRow();
    if (last >= 2) {
      var v = sh.getRange(2, 1, last - 1, 1).getValues();
      for (var i = v.length - 1; i >= 0; i--) {
        if (s_(v[i][0]) === ym) sh.deleteRow(i + 2);
      }
    }
    var \uC9C0\uAE08 = new Date2();
    var \uC904 = [];
    \uC0C1\uC774\uB984\uD45C.forEach(function(x) {
      var w = r.\uC0C1 ? r.\uC0C1[x.\uD0A4] : null;
      if (!w) {
        \uC904.push([ym, x.\uC774\uB984, "", "", "\uBC1B\uC744 \uD559\uC0DD \uC5C6\uC74C", "", \uC9C0\uAE08]);
        return;
      }
      var \uB3D9\uC810 = w.\uB3D9\uC810.length > 1 ? w.\uB3D9\uC810.map(function(t) {
        return t.\uC774\uB984;
      }).join(", ") : "";
      \uC904.push([ym, x.\uC774\uB984, w.\uC8FC\uC778\uACF5.\uC774\uB984, "", \uC0C1\uAE30\uB85D\uAE00_(x.\uD0A4, w), \uB3D9\uC810, \uC9C0\uAE08]);
    });
    sh.getRange(sh.getLastRow() + 1, 1, \uC904.length, HEADERS.\uC2DC\uC0C1.length).setValues(\uC904);
    sh.getRange(2, 7, sh.getLastRow() - 1, 1).setNumberFormat("yyyy-MM-dd HH:mm");
    sh.autoResizeColumns(1, HEADERS.\uC2DC\uC0C1.length);
    return { ok: true, \uB144\uC6D4: ym, \uAC1C\uC218: \uC904.length };
  }
  function \uB9E4\uC6D4\uC2DC\uC0C1() {
    var \uC9C0\uB09C = \uC9C0\uB09C\uB2EC_(\uC6D4_(new Date2()));
    return \uC2DC\uC0C1\uC800\uC7A5(\uC9C0\uB09C);
  }
  function \uC2DC\uC0C1\uC2DC\uC791\uC77C\uC800\uC7A5(\uBE44\uBC88, \uB0A0\uC9DC) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    var t = s_(\uB0A0\uC9DC);
    if (t && !/^\d{4}-\d{2}-\d{2}$/.test(t)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uB0A0\uC9DC \uBAA8\uC591\uC774 \uB9DE\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." };
    \uC124\uC815\uC4F0\uAE30_("\uC2DC\uC0C1\uC2DC\uC791\uC77C", t);
    return { ok: true, \uC2DC\uC791\uC77C: t };
  }
  function \uC2DC\uC0C1\uC800\uC7A5API(\uBE44\uBC88, \uB144\uC6D4) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    return \uC2DC\uC0C1\uC800\uC7A5(\uB144\uC6D4);
  }
  function \uC2DC\uC0C1\uAE30\uB85D(\uBE44\uBC88) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var out = [];
    rows_(SHEET.\uC2DC\uC0C1).forEach(function(x) {
      var ym = s_(x[0]);
      if (!ym) return;
      out.push({
        \uB144\uC6D4: ym,
        \uC0C1: s_(x[1]),
        \uD559\uC0DD: s_(x[2]),
        \uBC18: s_(x[3]),
        \uAE30\uB85D: s_(x[4]),
        \uB3D9\uC810: s_(x[5]),
        \uB54C: x[6] instanceof Date2 ? ymd_(x[6]) : s_(x[6])
      });
    });
    return { ok: true, \uBAA9\uB85D: out };
  }
  function \uC2DC\uC0C1\uC790\uB3D9_\uC788\uB098_() {
    var \uC788\uB2E4 = false;
    ScriptApp.getProjectTriggers().forEach(function(t) {
      if (t.getHandlerFunction() === "\uB9E4\uC6D4\uC2DC\uC0C1") \uC788\uB2E4 = true;
    });
    return \uC788\uB2E4;
  }
  function \uC2DC\uC0C1\uC790\uB3D9\uCF1C\uAE30() {
    var ui = SpreadsheetApp.getUi();
    if (\uC2DC\uC0C1\uC790\uB3D9_\uC788\uB098_()) {
      ui.alert("\uC774\uBBF8 \uCF1C\uC838 \uC788\uC2B5\uB2C8\uB2E4.\n\uB9E4\uC6D4 1\uC77C \uC544\uCE68\uC5D0 \uC9C0\uB09C\uB2EC \uC2DC\uC0C1\uC774 \uC790\uB3D9\uC73C\uB85C \uC9D1\uACC4\uB429\uB2C8\uB2E4.");
      return;
    }
    ScriptApp.newTrigger("\uB9E4\uC6D4\uC2DC\uC0C1").timeBased().onMonthDay(1).atHour(6).create();
    ui.alert("\uCF30\uC2B5\uB2C8\uB2E4.\n\n\uB9E4\uC6D4 1\uC77C \uC544\uCE68 6~7\uC2DC\uC5D0 \uC9C0\uB09C\uB2EC \uACB0\uACFC\uB97C \uC9D1\uACC4\uD574\uC11C\n<\uC2DC\uC0C1> \uC2DC\uD2B8\uC5D0 \uB0A8\uAE41\uB2C8\uB2E4.");
  }
  function \uC2DC\uC0C1\uC790\uB3D9\uB044\uAE30() {
    var ui = SpreadsheetApp.getUi();
    var \uC9C0\uC6C0 = 0;
    ScriptApp.getProjectTriggers().forEach(function(t) {
      if (t.getHandlerFunction() === "\uB9E4\uC6D4\uC2DC\uC0C1") {
        ScriptApp.deleteTrigger(t);
        \uC9C0\uC6C0++;
      }
    });
    ui.alert(\uC9C0\uC6C0 ? "\uAED0\uC2B5\uB2C8\uB2E4. \uC774\uC81C \uC790\uB3D9\uC73C\uB85C \uC9D1\uACC4\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." : "\uCF1C\uC838 \uC788\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
  }
  function \uC9C0\uB09C\uB2EC\uC2DC\uC0C1\uC9D1\uACC4() {
    var r = \uB9E4\uC6D4\uC2DC\uC0C1();
    var ui = SpreadsheetApp.getUi();
    if (r.ok) {
      ss_().setActiveSheet(ss_().getSheetByName(SHEET.\uC2DC\uC0C1));
      ui.alert(r.\uB144\uC6D4 + " \uC2DC\uC0C1\uC744 <\uC2DC\uC0C1> \uC2DC\uD2B8\uC5D0 \uB0A8\uACBC\uC2B5\uB2C8\uB2E4.");
    } else {
      ui.alert(r.\uBA54\uC2DC\uC9C0 || "\uC9D1\uACC4\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
    }
  }
  function \uC2DC\uC0C1\uB2EC\uBAA9\uB85D(\uBE44\uBC88) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var \uBCF8\uAC83 = {}, \uBAA9\uB85D = [];
    [SHEET.\uAE30\uB85D, SHEET.\uAE30\uB85D\uBCF4\uAD00].forEach(function(name) {
      rows_(name).forEach(function(x) {
        if (!(x[0] instanceof Date2)) return;
        var m = \uC6D4_(x[0]);
        if (!\uBCF8\uAC83[m]) {
          \uBCF8\uAC83[m] = 1;
          \uBAA9\uB85D.push(m);
        }
      });
    });
    var \uC774\uBC88 = \uC6D4_(new Date2());
    if (!\uBCF8\uAC83[\uC774\uBC88]) \uBAA9\uB85D.push(\uC774\uBC88);
    \uBAA9\uB85D.sort();
    \uBAA9\uB85D.reverse();
    return { ok: true, \uB2EC: \uBAA9\uB85D };
  }
  function \uBC30\uC815\uCE78\uD655\uBCF4_() {
    return \uBA85\uB2E8\uCE78\uD655\uBCF4_();
  }
  function \uBC30\uC815\uAC00\uC838\uC624\uAE30(\uBE44\uBC88) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    \uBC30\uC815\uCE78\uD655\uBCF4_();
    var \uD559\uC0DD = [];
    rows_(SHEET.\uD559\uC0DD).forEach(function(r, i) {
      var \uBC18 = s_(r[0]), \uC774\uB984 = s_(r[1]);
      if (!\uC774\uB984) return;
      var \uBC30\uC815 = \uBC30\uC815\uD480\uAE30_(r.length > 4 ? r[4] : "");
      \uD559\uC0DD.push({
        \uD589: i + 2,
        \uBC18,
        \uC774\uB984,
        \uD559\uB144\uAD6C\uBD84: s_(r[3]) || "\uCD08\uC911\uB4F1",
        \uC804\uBD80: !\uBC30\uC815,
        \uB2E8\uC5B4\uC7A5: \uBC30\uC815 || []
      });
    });
    return { ok: true, \uD559\uC0DD, \uB2E8\uC5B4\uC7A5\uBAA9\uB85D: \uB2E8\uC5B4\uC7A5\uBAA9\uB85D() };
  }
  function \uBC30\uC815\uC800\uC7A5(\uBE44\uBC88, \uBAA9\uB85D) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    var sh = \uBC30\uC815\uCE78\uD655\uBCF4_();
    var last = sh.getLastRow();
    var \uBC14\uB01C = 0;
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(1e4);
    } catch (e) {
      return { ok: false, \uBA54\uC2DC\uC9C0: "\uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694" };
    }
    try {
      (\uBAA9\uB85D || []).forEach(function(x) {
        var n = Number(x.\uD589);
        if (!(n >= 2 && n <= last)) return;
        var \uAC12 = x.\uC804\uBD80 ? "" : (x.\uB2E8\uC5B4\uC7A5 || []).map(s_).filter(String).join(", ");
        sh.getRange(n, 5).setValue(\uAC12);
        \uBC14\uB01C++;
      });
    } finally {
      lock.releaseLock();
    }
    return { ok: true, \uAC1C\uC218: \uBC14\uB01C };
  }
  function \uBC30\uC815\uC815\uB9AC_(\uC61B\uC774\uB984, \uC0C8\uC774\uB984) {
    var sh = \uBC30\uC815\uCE78\uD655\uBCF4_();
    var last = sh.getLastRow();
    if (last < 2) return;
    var rng = sh.getRange(2, 5, last - 1, 1);
    var v = rng.getValues();
    var \uBC14\uB01C = false;
    for (var i = 0; i < v.length; i++) {
      var \uBAA9\uB85D = \uBC30\uC815\uD480\uAE30_(v[i][0]);
      if (!\uBAA9\uB85D) continue;
      var \uC0C8\uBAA9\uB85D = [];
      \uBAA9\uB85D.forEach(function(n) {
        if (n !== \uC61B\uC774\uB984) {
          \uC0C8\uBAA9\uB85D.push(n);
          return;
        }
        \uBC14\uB01C = true;
        if (\uC0C8\uC774\uB984) \uC0C8\uBAA9\uB85D.push(\uC0C8\uC774\uB984);
      });
      v[i][0] = \uC0C8\uBAA9\uB85D.length ? \uC0C8\uBAA9\uB85D.join(", ") : \uBC14\uB01C ? "(\uC5C6\uC74C)" : v[i][0];
    }
    if (\uBC14\uB01C) rng.setValues(v);
  }
  function \uC219\uC81C\uAC00\uC838\uC624\uAE30(\uC774\uB984) {
    return \uC77D\uB294\uB3D9\uC548_(function() {
      return \uC219\uC81C\uAC00\uC838\uC624\uAE30_(\uC774\uB984);
    });
  }
  function \uC219\uC81C\uAC00\uC838\uC624\uAE30_(\uC774\uB984, \uBD80\uD130) {
    var r = rows_(SHEET.\uC219\uC81C);
    var \uB2E8\uACC4\uC788\uB2E4 = r.some(function(x) {
      return \uB2E8\uACC4\uC815\uB9AC_(x.length > 13 ? x[13] : "");
    });
    var \uC751\uC2DC = \uB2E8\uACC4\uC788\uB2E4 ? \uC751\uC2DC\uD45C_(\uC774\uB984) : {}, \uB354\uC900\uD45C = \uB2E8\uACC4\uC788\uB2E4 ? \uC7AC\uC751\uC2DC\uCD94\uAC00\uD45C_() : {};
    var today = ymd_(new Date2());
    var \uC0C9\uB9F5 = {};
    \uB2E8\uC5B4\uC7A5\uBAA9\uB85D().forEach(function(b) {
      \uC0C9\uB9F5[b.\uC774\uB984] = b.\uC0C9;
    });
    var \uAD50\uC7AC\uB9F5 = \uAD50\uC7AC\uB9F5_();
    var \uBC18\uD559\uC0DD = \uBC18\uBCC4\uBA85\uB2E8_();
    var \uB05D\uB0B8\uAC83 = \uC644\uB8CC\uC810\uC218\uB4E4_(\uC774\uB984);
    var out = [];
    r.forEach(function(x) {
      var \uC904 = { \uBC18: s_(x[0]), \uB2E8\uC5B4\uC7A5: s_(x[1]), \uD559\uC0DD: s_(x[7]) };
      if (!\uB0B4\uC219\uC81C\uC778\uAC00_(\uC904, \uC774\uB984, \uAD50\uC7AC\uB9F5, \uBC18\uD559\uC0DD)) return;
      var \uB300\uC0C1 = s_(x[7]);
      var \uB9C8\uAC10 = x[5] instanceof Date2 ? ymd_(x[5]) : s_(x[5]);
      if (\uB9C8\uAC10 && \uB9C8\uAC10 < (\uBD80\uD130 === void 0 ? today : \uBD80\uD130)) return;
      var \uB2E8\uC5B4\uC7A5 = s_(x[1]);
      var \uC2DC\uC791 = Number(x[2]) || 1, \uB05D = Number(x[3]) || 0;
      var \uC885\uB958 = s_(x[8]) ? \uC219\uC81C\uC885\uB958_(x[8]) : \uB9C8\uAC10 === today ? "\uB2F9\uC77C" : "\uAE30\uD55C";
      var \uB4F1\uB85D = x[6] instanceof Date2 ? ymd_(x[6]) : "";
      var \uCE78 = s_(x.length > 11 ? x[11] : "");
      var \uB0A0\uB4E4 = \uAE30\uB85D\uCC3E\uAE30_(\uB05D\uB0B8\uAC83, "", \uB2E8\uC5B4\uC7A5, \uC2DC\uC791, \uB05D, \uCE78);
      var \uD310\uB2E8\uB0A0 = \uB9C8\uAC10 || today;
      var \uAE30\uB85D = \uB0B8\uAC83_(\uB0A0\uB4E4, \uC885\uB958, \uB4F1\uB85D, \uD310\uB2E8\uB0A0);
      var \uC644\uB8CC = !!\uAE30\uB85D;
      var \uC2DC\uB3C4 = \uC644\uB8CC ? \uAE30\uB85D : \uD47C\uAC83_(\uB0A0\uB4E4, \uC885\uB958, \uB4F1\uB85D, \uD310\uB2E8\uB0A0, 0);
      var \uB2E8\uACC4 = \uB2E8\uACC4\uC815\uB9AC_(x.length > 13 ? x[13] : ""), \uB2E8\uC0C1 = null;
      if (\uB2E8\uACC4) {
        var \uB0B8\uB54C0 = x[6] instanceof Date2 ? x[6].getTime() : 0;
        \uB2E8\uC0C1 = \uB2E8\uACC4\uC0C1\uD0DC_(
          \uB2E8\uACC4,
          x.length > 14 ? x[14] : "",
          x.length > 15 ? x[15] : "",
          \uC751\uC2DC\uB4E4_(\uC751\uC2DC, \uC774\uB984, \uB2E8\uC5B4\uC7A5, \uC2DC\uC791, \uB05D, \uCE78, \uB0B8\uB54C0),
          \uB354\uC900\uD45C[s_(\uC774\uB984) + "|" + \uB0B8\uB54C0]
        );
        \uC644\uB8CC = \uB2E8\uC0C1.\uC644\uB8CC;
      }
      out.push({
        \uB2E8\uC5B4\uC7A5,
        \uC2DC\uC791,
        \uB05D,
        \uCE78,
        \uC81C\uD55C\uC2DC\uAC04: \uC219\uC81C\uC2DC\uAC04_(x, \uC885\uB958).\uC81C\uD55C\uC2DC\uAC04,
        // 분 — 0 이면 제한 없음 (옛 숙제)
        \uC678\uC6B0\uAE30\uBD84: \uC219\uC81C\uC2DC\uAC04_(x, \uC885\uB958).\uC678\uC6B0\uAE30\uBD84,
        // 시험 탭에서 먼저 외우는 시간 — 0 이면 건너뛴다
        \uC720\uD615: s_(x[4]) || "\uC2A4\uD3A0\uB9C1",
        \uB9C8\uAC10\uC77C: \uB9C8\uAC10,
        /* 이 숙제를 다른 숙제와 가려 주는 값. 지웠다 똑같이 다시 내면 이 값이 달라진다.
           유치부가 「어디까지 했나」 를 기기에 적어 둘 때 이것을 열쇠로 쓴다. */
        \uB0B8\uB54C: x[6] instanceof Date2 ? x[6].getTime() : 0,
        \uAC1C\uBCC4: !!\uB300\uC0C1,
        \uC0C9: \uC0C9\uB9F5[\uB2E8\uC5B4\uC7A5] || "",
        \uC885\uB958,
        \uC644\uB8CC,
        \uC810\uC218: \uC2DC\uB3C4 ? \uC2DC\uB3C4.\uC810\uC218 : null,
        \uBAA8\uC790\uB78C: !\uC644\uB8CC && !!\uC2DC\uB3C4,
        // 풀었지만 합격점을 못 넘겼다
        \uD569\uACA9\uC810: \uD569\uACA9\uCEF7_(\uC885\uB958),
        \uB0A8\uC740\uC77C\uC218: \uB0A8\uC740\uC77C\uC218_(\uB9C8\uAC10, today),
        \uB4F1\uB85D\uC77C: \uB4F1\uB85D,
        \uC218\uC5C5: s_(x.length > 9 ? x[9] : ""),
        \uC21C\uC11C: Number(x.length > 10 ? x[10] : 0) || 0,
        \uB2E8\uACC4,
        // 연습 · 시험 (빈칸 = 옛 숙제)
        \uD1B5\uACFC\uC810\uC218: \uB2E8\uC0C1 && \uB2E8\uC0C1.\uD1B5\uACFC\uC810\uC218 !== void 0 ? \uB2E8\uC0C1.\uD1B5\uACFC\uC810\uC218 : "",
        \uC751\uC2DC\uC218: \uB2E8\uC0C1 ? \uB2E8\uC0C1.\uC751\uC2DC\uC218 : 0,
        \uB0A8\uC740\uC751\uC2DC: \uB2E8\uC0C1 && \uB2E8\uC0C1.\uB0A8\uC740\uC751\uC2DC !== void 0 ? \uB2E8\uC0C1.\uB0A8\uC740\uC751\uC2DC : null,
        \uB9C8\uC9C0\uB9C9\uC810\uC218: \uB2E8\uC0C1 ? \uB2E8\uC0C1.\uB9C8\uC9C0\uB9C9\uC810\uC218 : null,
        \uB9C8\uC9C0\uB9C9\uD2C0\uB9B0: \uB2E8\uC0C1 && \uB2E8\uC0C1.\uB9C8\uC9C0\uB9C9\uD2C0\uB9B0 ? \uB2E8\uC0C1.\uB9C8\uC9C0\uB9C9\uD2C0\uB9B0 : [],
        \uB9C8\uC9C0\uB9C9\uD2C0\uB9B0\uB354: \uB2E8\uC0C1 ? \uB2E8\uC0C1.\uB9C8\uC9C0\uB9C9\uD2C0\uB9B0\uB354 || 0 : 0,
        \uB9C8\uC9C0\uB9C9\uC790\uB9AC: \uB2E8\uC0C1 ? \uB2E8\uC0C1.\uB9C8\uC9C0\uB9C9\uC790\uB9AC || null : null
      });
    });
    out.sort(function(a, b) {
      var \uC21C = { "\uB2F9\uC77C": 0, "\uBCF4\uCDA9": 1, "\uAE30\uD55C": 2 };
      if (a.\uC885\uB958 !== b.\uC885\uB958) return (\uC21C[a.\uC885\uB958] || 9) - (\uC21C[b.\uC885\uB958] || 9);
      return (a.\uB0A8\uC740\uC77C\uC218 === null ? 9999 : a.\uB0A8\uC740\uC77C\uC218) - (b.\uB0A8\uC740\uC77C\uC218 === null ? 9999 : b.\uB0A8\uC740\uC77C\uC218);
    });
    return out;
  }
  function \uB0A8\uC740\uC77C\uC218_(\uB9C8\uAC10, \uC624\uB298) {
    if (!\uB9C8\uAC10) return null;
    var a = new Date2(\uB9C8\uAC10 + "T00:00:00");
    var b = new Date2(\uC624\uB298 + "T00:00:00");
    if (isNaN(a.getTime())) return null;
    return Math.round((a - b) / 864e5);
  }
  function \uACB0\uACFC\uC800\uC7A5(p) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(15e3);
    } catch (e) {
      return { ok: false, \uBA54\uC2DC\uC9C0: "\uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694." };
    }
    try {
      if (s_(p.\uAD6C\uBD84) === \uC2DC\uD5D8\uD45C\uC2DC && \uC774\uBBF8\uBCF8\uC2DC\uD5D8_(s_(p.\uC774\uB984), s_(p.\uB2E8\uC5B4\uC7A5), s_(p.\uBC94\uC704))) {
        return { ok: false, \uC774\uBBF8\uBD04: true, \uBA54\uC2DC\uC9C0: "\uC774 \uC2DC\uD5D8\uC740 \uC774\uBBF8 \uBD24\uC2B5\uB2C8\uB2E4. \uC2DC\uD5D8\uC740 \uD55C \uBC88\uB9CC \uBCFC \uC218 \uC788\uC5B4\uC694." };
      }
      var sh = sheet_(SHEET.\uAE30\uB85D);
      if (!\uCE90\uC2DC\uC77D\uAE30_("\uAE30\uB85D\uCE78\uD655\uBCF4")) {
        try {
          \uAE30\uB85D\uCE78\uD655\uBCF4_(SHEET.\uAE30\uB85D);
          \uCE90\uC2DC\uB2F4\uAE30_("\uAE30\uB85D\uCE78\uD655\uBCF4", 1, 21600);
        } catch (e) {
        }
      }
      var \uC804\uCCB4\uC624\uB2F5 = s_(p.\uD2C0\uB9B0\uB2E8\uC5B4);
      var \uB2E8\uC5B4\uB4E4 = \uC804\uCCB4\uC624\uB2F5 ? \uC804\uCCB4\uC624\uB2F5.split(",").map(function(x) {
        return x.trim();
      }).filter(String) : [];
      var \uC694\uC57D = \uB2E8\uC5B4\uB4E4.length > \uC624\uB2F5\uC694\uC57D\uAC1C\uC218 ? \uB2E8\uC5B4\uB4E4.slice(0, \uC624\uB2F5\uC694\uC57D\uAC1C\uC218).join(", ") + "  \u2026\uC678 " + (\uB2E8\uC5B4\uB4E4.length - \uC624\uB2F5\uC694\uC57D\uAC1C\uC218) + "\uAC1C" : \uB2E8\uC5B4\uB4E4.join(", ");
      sh.appendRow([
        new Date2(),
        "",
        s_(p.\uC774\uB984),
        s_(p.\uB2E8\uC5B4\uC7A5),
        s_(p.\uBC94\uC704),
        s_(p.\uC720\uD615),
        Number(p.\uBB38\uD56D\uC218) || 0,
        Number(p.\uC815\uB2F5\uC218) || 0,
        Number(p.\uC810\uC218) || 0,
        Number(p.\uAC8C\uC784\uC810\uC218) || 0,
        Number(p.\uCD5C\uACE0\uCF64\uBCF4) || 0,
        Number(p.\uC18C\uC694\uCD08) || 0,
        p.\uC219\uC81C\uC5EC\uBD80 ? "O" : "",
        \uC694\uC57D,
        s_(p.\uAD6C\uBD84)
      ]);
      var row = sh.getLastRow();
      sh.getRange(row, 1, 1, HEADERS.\uAE30\uB85D.length).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP).setVerticalAlignment("middle");
      sh.getRange(row, 1).setNumberFormat("yyyy-MM-dd HH:mm");
      if (\uB2E8\uC5B4\uB4E4.length) {
        sh.getRange(row, \uD2C0\uB9B0\uB2E8\uC5B4\uC5F4).setNote(
          "\uD2C0\uB9B0 \uB2E8\uC5B4 " + \uB2E8\uC5B4\uB4E4.length + "\uAC1C\n\n" + \uB2E8\uC5B4\uB4E4.join("\n")
        );
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, \uBA54\uC2DC\uC9C0: String(e) };
    } finally {
      lock.releaseLock();
    }
  }
  function \uC774\uBBF8\uBCF8\uC2DC\uD5D8_(\uC774\uB984, \uB2E8\uC5B4\uC7A5, \uBC94\uC704) {
    var \uBD24\uB2E4 = false;
    [SHEET.\uAE30\uB85D, SHEET.\uAE30\uB85D\uBCF4\uAD00].forEach(function(name) {
      if (\uBD24\uB2E4) return;
      rows_(name).forEach(function(x) {
        if (\uBD24\uB2E4) return;
        if (s_(x[14]) !== \uC2DC\uD5D8\uD45C\uC2DC) return;
        if (s_(x[2]) !== \uC774\uB984) return;
        if (s_(x[3]) !== \uB2E8\uC5B4\uC7A5 || s_(x[4]) !== \uBC94\uC704) return;
        \uBD24\uB2E4 = true;
      });
    });
    return \uBD24\uB2E4;
  }
  function \uB0B4\uAE30\uB85D(\uC774\uB984) {
    var r = rows_(SHEET.\uAE30\uB85D);
    var out = [];
    for (var i = r.length - 1; i >= 0 && out.length < 20; i--) {
      if (s_(r[i][2]) !== s_(\uC774\uB984)) continue;
      out.push({
        \uC2DC\uAC01: r[i][0] instanceof Date2 ? Utilities.formatDate(r[i][0], Session.getScriptTimeZone(), "MM/dd HH:mm") : s_(r[i][0]),
        \uB2E8\uC5B4\uC7A5: s_(r[i][3]),
        \uBC94\uC704: s_(r[i][4]),
        \uC720\uD615: s_(r[i][5]),
        \uBB38\uD56D\uC218: Number(r[i][6]) || 0,
        \uC815\uB2F5\uC218: Number(r[i][7]) || 0,
        \uC810\uC218: Number(r[i][8]) || 0,
        \uAC8C\uC784\uC810\uC218: Number(r[i][9]) || 0
      });
    }
    return out;
  }
  function \uC6D4\uD0A4_(d) {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM");
  }
  function \uC6D4\uC774\uB984_(d) {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy\uB144 M\uC6D4");
  }
  function \uC810\uC218\uC2DC\uD2B8_() {
    var ss = ss_();
    var sh = ss.getSheetByName(SHEET.\uC810\uC218);
    if (!sh) {
      sh = ss.insertSheet(SHEET.\uC810\uC218);
      sh.getRange(1, 1, 1, HEADERS.\uC810\uC218.length).setValues([HEADERS.\uC810\uC218]).setFontWeight("bold").setBackground("#EFF3F9");
      sh.setFrozenRows(1);
      sh.setColumnWidth(1, 110);
      sh.setColumnWidth(2, 100);
      sh.setColumnWidth(3, 90);
      sh.setColumnWidth(4, 160);
      sh.setColumnWidth(5, 70);
    }
    return sh;
  }
  function \uC6D4\uAC04\uC21C\uC704(\uBC18) {
    var r = rows_(SHEET.\uC810\uC218);
    var \uC624\uB298 = new Date2();
    var \uC9C0\uB09C\uB0A0 = new Date2(\uC624\uB298.getFullYear(), \uC624\uB298.getMonth() - 1, 1);
    var \uC774\uBC88\uD0A4 = \uC6D4\uD0A4_(\uC624\uB298), \uC9C0\uB09C\uD0A4 = \uC6D4\uD0A4_(\uC9C0\uB09C\uB0A0);
    var m1 = {}, m2 = {};
    r.forEach(function(x) {
      if (s_(x[1]) !== s_(\uBC18)) return;
      var d = x[0];
      if (!(d instanceof Date2)) return;
      var \uC774\uB984 = s_(x[2]);
      if (!\uC774\uB984) return;
      if (s_(x[4]) === "") return;
      var \uC810 = Number(x[4]);
      if (isNaN(\uC810)) return;
      var k = \uC6D4\uD0A4_(d);
      var t = k === \uC774\uBC88\uD0A4 ? m1 : k === \uC9C0\uB09C\uD0A4 ? m2 : null;
      if (!t) return;
      if (!t[\uC774\uB984]) t[\uC774\uB984] = { \uC774\uB984, \uD569: 0, \uC218: 0 };
      t[\uC774\uB984].\uD569 += \uC810;
      t[\uC774\uB984].\uC218++;
    });
    function \uC815\uB9AC(m) {
      return Object.keys(m).map(function(n) {
        var v = m[n];
        return { \uC774\uB984: v.\uC774\uB984, \uC810\uC218: Math.round(v.\uD569 / v.\uC218 * 10) / 10 };
      }).sort(function(a, b) {
        return b.\uC810\uC218 - a.\uC810\uC218;
      });
    }
    return {
      \uC774\uBC88\uB2EC: \uC6D4\uC774\uB984_(\uC624\uB298),
      \uC21C\uC704: \uC815\uB9AC(m1),
      \uC9C0\uB09C\uB2EC: \uC6D4\uC774\uB984_(\uC9C0\uB09C\uB0A0),
      \uC2DC\uC0C1: \uC815\uB9AC(m2).slice(0, 3)
    };
  }
  function \uC810\uC218\uC785\uB825\uD45C() {
    var ui = SpreadsheetApp.getUi();
    var \uD559\uC0DD\uB4E4 = \uC804\uCCB4\uBA85\uB2E8_();
    if (!\uD559\uC0DD\uB4E4.length) {
      ui.alert("\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8", "\uD559\uC0DD \uBA85\uB2E8\uC774 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.", ui.ButtonSet.OK);
      return;
    }
    var r2 = ui.prompt("\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8", "\uC2DC\uD5D8 \uC774\uB984\uC744 \uC801\uC5B4 \uC8FC\uC138\uC694. (\uC608: 3\uACFC \uB2E8\uC5B4\uC2DC\uD5D8)", ui.ButtonSet.OK_CANCEL);
    if (r2.getSelectedButton() !== ui.Button.OK) return;
    var \uC2DC\uD5D8 = r2.getResponseText().trim();
    var sh = \uC810\uC218\uC2DC\uD2B8_();
    var \uC624\uB298 = new Date2();
    \uC624\uB298.setHours(0, 0, 0, 0);
    var \uAC12 = \uD559\uC0DD\uB4E4.map(function(n) {
      return [\uC624\uB298, "", n, \uC2DC\uD5D8, ""];
    });
    var start = sh.getLastRow() + 1;
    sh.getRange(start, 1, \uAC12.length, 5).setValues(\uAC12);
    sh.getRange(start, 1, \uAC12.length, 1).setNumberFormat("yyyy-MM-dd");
    ss_().setActiveSheet(sh);
    sh.setActiveRange(sh.getRange(start, 5, \uAC12.length, 1));
    ui.alert(
      "\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8",
      \uD559\uC0DD\uB4E4.length + "\uBA85\uC758 \uC904\uC744 \uB9CC\uB4E4\uC5C8\uC2B5\uB2C8\uB2E4.\n\uB9E8 \uC624\uB978\uCABD [\uC810\uC218] \uCE78\uC5D0 \uC22B\uC790\uB9CC \uB123\uC5B4 \uC8FC\uC138\uC694.\n\n\uC2DC\uD5D8\uC744 \uC548 \uBCF8 \uD559\uC0DD\uC740 \uC810\uC218 \uCE78\uC744 \uBE44\uC6CC \uB450\uBA74 \uC21C\uC704\uC5D0\uC11C \uBE60\uC9D1\uB2C8\uB2E4.",
      ui.ButtonSet.OK
    );
  }
  function \uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88) {
    return s_(\uBE44\uBC88) === setting_("\uC120\uC0DD\uB2D8\uBE44\uBC00\uBC88\uD638", "1234");
  }
  function \uC120\uC0DD\uB2D8\uB85C\uADF8\uC778(\uBE44\uBC88) {
    return { ok: \uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88) };
  }
  var \uAE30\uB85D\uCE90\uC2DC\uCD08_ = 90;
  var \uCE90\uC2DC\uD55C\uB3C4_ = 1e5;
  var \uCE90\uC2DC\uC870\uAC01\uCD5C\uB300_ = 20;
  var \uAE30\uB85D\uB369\uC774_ = 1e3;
  var \uAE30\uB85D\uCD5C\uB300_ = 5e3;
  function \uCE90\uC2DC_() {
    try {
      return CacheService.getScriptCache();
    } catch (e) {
      return null;
    }
  }
  function \uCE90\uC2DC\uC77D\uAE30_(\uC5F4\uC1E0) {
    var c = \uCE90\uC2DC_();
    if (!c) return null;
    try {
      var \uBA38\uB9AC = c.get(\uC5F4\uC1E0);
      if (!\uBA38\uB9AC) return null;
      if (\uBA38\uB9AC.charAt(0) !== "#") return JSON.parse(\uBA38\uB9AC);
      var n = Number(\uBA38\uB9AC.slice(1)), \uC5F4\uC1E0\uB4E4 = [];
      for (var i = 0; i < n; i++) \uC5F4\uC1E0\uB4E4.push(\uC5F4\uC1E0 + "#" + i);
      var \uBAA8\uC74C = typeof c.getAll === "function" ? c.getAll(\uC5F4\uC1E0\uB4E4) : null, \uAE00 = "";
      for (var j = 0; j < n; j++) {
        var g = \uBAA8\uC74C ? \uBAA8\uC74C[\uC5F4\uC1E0\uB4E4[j]] : c.get(\uC5F4\uC1E0\uB4E4[j]);
        if (g === null || g === void 0) return null;
        \uAE00 += g;
      }
      return JSON.parse(\uAE00);
    } catch (e) {
      return null;
    }
  }
  function \uAE00\uD06C\uAE30_(\uAE00) {
    try {
      return Utilities.newBlob(\uAE00).getBytes().length;
    } catch (e) {
      return \uAE00.length * 3;
    }
  }
  function \uCE90\uC2DC\uB2F4\uAE30_(\uC5F4\uC1E0, \uAC12, \uCD08) {
    var c = \uCE90\uC2DC_();
    if (!c) return false;
    try {
      var \uAE00 = JSON.stringify(\uAC12);
      if (\uAE00\uD06C\uAE30_(\uAE00) <= \uCE90\uC2DC\uD55C\uB3C4_) {
        c.put(\uC5F4\uC1E0, \uAE00, \uCD08);
        return true;
      }
      var \uC870\uAC01\uB4E4 = [], a = 0;
      while (a < \uAE00.length) {
        var b = Math.min(\uAE00.length, a + 3e4);
        var \uB05D\uAE00 = \uAE00.charCodeAt(b - 1);
        if (b < \uAE00.length && \uB05D\uAE00 >= 55296 && \uB05D\uAE00 <= 56319) b--;
        \uC870\uAC01\uB4E4.push(\uAE00.slice(a, b));
        a = b;
      }
      if (\uC870\uAC01\uB4E4.length > \uCE90\uC2DC\uC870\uAC01\uCD5C\uB300_) return false;
      var \uBB36\uC74C = {};
      \uC870\uAC01\uB4E4.forEach(function(g, i) {
        \uBB36\uC74C[\uC5F4\uC1E0 + "#" + i] = g;
      });
      if (typeof c.putAll === "function") c.putAll(\uBB36\uC74C, \uCD08);
      else for (var k in \uBB36\uC74C) c.put(k, \uBB36\uC74C[k], \uCD08);
      c.put(\uC5F4\uC1E0, "#" + \uC870\uAC01\uB4E4.length, \uCD08);
      return true;
    } catch (e) {
      return false;
    }
  }
  function \uAE30\uB85D\uCE90\uC2DC\uBC84\uB9AC\uAE30_() {
    var c = \uCE90\uC2DC_();
    if (!c) return;
    var \uC5F4\uC1E0\uB4E4 = [];
    for (var d = 1; d <= 62; d++) \uC5F4\uC1E0\uB4E4.push("\uC120\uC0DD\uB2D8\uAE30\uB85D|" + d);
    try {
      c.removeAll(\uC5F4\uC1E0\uB4E4);
    } catch (e) {
    }
  }
  function \uC2DC\uC791\uC815\uBCF4\uCE90\uC2DC\uBC84\uB9AC\uAE30_() {
    var c = \uCE90\uC2DC_();
    if (!c) return;
    try {
      c.remove("\uC2DC\uC791\uC815\uBCF4");
    } catch (e) {
    }
  }
  var \uAE30\uB85D\uBC14\uAFB8\uB294\uAE30\uB2A5_ = {
    \uACB0\uACFC\uC800\uC7A5: 1,
    \uC219\uC81C\uB4F1\uB85D: 1,
    \uC219\uC81C\uC218\uC815: 1,
    \uC219\uC81C\uC0AD\uC81C: 1,
    \uC219\uC81C\uC5EC\uB7EC\uAC1C\uC0AD\uC81C: 1,
    \uC219\uC81C\uC228\uAE40\uBC14\uAFB8\uAE30: 1,
    \uC218\uC5C5\uB0B4\uC8FC\uAE30: 1,
    \uC218\uC5C5\uC0AD\uC81C: 1,
    \uC9C0\uB09C\uC219\uC81C\uC815\uB9AC: 1,
    \uAE30\uB85D\uC815\uB9AC: 1,
    \uAE30\uB85D\uC81C\uC678\uC124\uC815: 1,
    \uC624\uB798\uB41C\uAE30\uB85D\uC815\uB9ACAPI: 1,
    \uC7AC\uC751\uC2DC\uB354\uC8FC\uAE30: 1,
    \uD559\uC0DD\uC218\uC815: 1,
    \uD559\uC0DD\uBD99\uC5EC\uB123\uAE30: 1,
    \uBC30\uC815\uC800\uC7A5: 1,
    \uAD50\uC7AC\uC77C\uAD04: 1,
    \uB2E8\uC5B4\uC7A5\uC774\uB984\uBCC0\uACBD: 1,
    \uB2E8\uC5B4\uC7A5\uC0AD\uC81C: 1,
    \uD569\uACA9\uC810\uC800\uC7A5: 1,
    \uC124\uC815\uC800\uC7A5: 1
  };
  var \uB2E8\uC5B4\uC7A5\uBC14\uAFB8\uB294\uAE30\uB2A5_ = {
    \uACFC\uB123\uAE30: 1,
    \uB2E8\uC5B4\uCD94\uAC00: 1,
    \uB2E8\uC5B4\uC218\uC815: 1,
    \uB2E8\uC5B4\uC0AD\uC81C: 1,
    \uB2E8\uC5B4\uBD99\uC5EC\uB123\uAE30: 1,
    \uADF8\uB9BC\uC62C\uB9AC\uAE30: 1,
    \uADF8\uB9BC\uC5EC\uB7EC\uAC1C: 1,
    \uADF8\uB9BC\uC9C0\uC6B0\uAE30: 1,
    \uB2E8\uC5B4\uC7A5\uC774\uB984\uBCC0\uACBD: 1,
    \uB2E8\uC5B4\uC7A5\uC0C9\uBCC0\uACBD: 1,
    \uB2E8\uC5B4\uC7A5\uC0AD\uC81C: 1,
    \uB808\uC2A8\uD06C\uAE30\uC800\uC7A5: 1,
    \uD569\uACA9\uC810\uC800\uC7A5: 1,
    \uC124\uC815\uC800\uC7A5: 1
  };
  function \uB2F4\uC740\uAC83\uBC84\uB9AC\uAE30_(\uBB34\uC5C7) {
    if (\uAE30\uB85D\uBC14\uAFB8\uB294\uAE30\uB2A5_[\uBB34\uC5C7]) \uAE30\uB85D\uCE90\uC2DC\uBC84\uB9AC\uAE30_();
    if (\uB2E8\uC5B4\uC7A5\uBC14\uAFB8\uB294\uAE30\uB2A5_[\uBB34\uC5C7]) \uC2DC\uC791\uC815\uBCF4\uCE90\uC2DC\uBC84\uB9AC\uAE30_();
  }
  function \uCD5C\uADFC\uAE30\uB85D\uC904_(sh, \uAE30\uC900) {
    var last = sh.getLastRow();
    if (last < 2) return [];
    var \uB113\uC774 = Math.max(1, sh.getLastColumn());
    var \uCC44\uC6B8 = Math.max(\uB113\uC774, HEADERS.\uAE30\uB85D.length);
    function \uCC44\uC6B0\uAE30(x) {
      x = x.slice();
      while (x.length < \uCC44\uC6B8) x.push("");
      return x;
    }
    function \uCCAB\uB0A0(v2) {
      for (var i = 0; i < v2.length; i++) if (v2[i][0] instanceof Date2) return v2[i][0];
      return null;
    }
    function \uB05D\uB0A0(v2) {
      for (var i = v2.length - 1; i >= 0; i--) if (v2[i][0] instanceof Date2) return v2[i][0];
      return null;
    }
    function \uB0A0\uC9DC\uC21C(v2) {
      var \uC55E = null;
      for (var i = 0; i < v2.length; i++) {
        var d = v2[i][0];
        if (!(d instanceof Date2)) continue;
        if (\uC55E && d < \uC55E) return false;
        \uC55E = d;
      }
      return true;
    }
    var \uB369\uC774\uB4E4 = [], \uB05D = last, \uC77D\uC740 = 0, \uB4A4\uCCAB\uB0A0 = null;
    while (\uB05D >= 2 && \uC77D\uC740 < \uAE30\uB85D\uCD5C\uB300_) {
      var n = Math.min(\uAE30\uB85D\uB369\uC774_, \uB05D - 1, \uAE30\uB85D\uCD5C\uB300_ - \uC77D\uC740);
      var \uC2DC\uC791 = \uB05D - n + 1;
      var v = sh.getRange(\uC2DC\uC791, 1, n, \uB113\uC774).getValues();
      var \uC774\uB05D = \uB05D\uB0A0(v);
      if (!\uB0A0\uC9DC\uC21C(v) || \uB4A4\uCCAB\uB0A0 && \uC774\uB05D && \uC774\uB05D > \uB4A4\uCCAB\uB0A0) {
        return sh.getRange(2, 1, last - 1, \uB113\uC774).getValues().map(function(x, i) {
          return { \uC904: i + 2, x: \uCC44\uC6B0\uAE30(x) };
        });
      }
      \uB369\uC774\uB4E4.unshift({ \uC2DC\uC791, \uAC12: v });
      \uC77D\uC740 += n;
      \uB05D = \uC2DC\uC791 - 1;
      var \uCCAB = \uCCAB\uB0A0(v);
      if (\uCCAB) \uB4A4\uCCAB\uB0A0 = \uCCAB;
      if (\uCCAB && \uCCAB < \uAE30\uC900) break;
    }
    var out = [];
    \uB369\uC774\uB4E4.forEach(function(d) {
      d.\uAC12.forEach(function(x, i) {
        out.push({ \uC904: d.\uC2DC\uC791 + i, x: \uCC44\uC6B0\uAE30(x) });
      });
    });
    return out;
  }
  function \uD2C0\uB9B0\uCE78\uB098\uB204\uAE30_(\uC140) {
    var t = s_(\uC140), m = t.match(/\s*…외\s*(\d+)개\s*$/);
    return { \uC55E: m ? t.slice(0, m.index) : t, \uB354: m ? Number(m[1]) : 0 };
  }
  function \uC120\uC0DD\uB2D8\uAE30\uBCF8(\uBE44\uBC88) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    return \uC77D\uB294\uB3D9\uC548_(function() {
      return {
        ok: true,
        \uC219\uC81C\uBAA9\uB85D: \uC804\uCCB4\uC219\uC81C(),
        \uD559\uC0DD\uBAA9\uB85D: \uC804\uCCB4\uBA85\uB2E8_(),
        \uB2E8\uC5B4\uC7A5\uBAA9\uB85D: \uB2E8\uC5B4\uC7A5\uBAA9\uB85D(),
        // 선생님은 담아 둔 것 말고 지금 것을 본다 (방금 붙여넣은 단어 수)
        \uC2DC\uC0C1\uD56D\uBAA9: \uC2DC\uC0C1\uD56D\uBAA9_(),
        \uD569\uACA9\uC810: \uD569\uACA9\uC810_()
      };
    });
  }
  function \uC120\uC0DD\uB2D8\uAE30\uB85D(\uBE44\uBC88, \uC77C\uC218) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var days = Number(\uC77C\uC218) || 7, \uC5F4\uC1E0 = "\uC120\uC0DD\uB2D8\uAE30\uB85D|" + days;
    var \uB2F4\uAE34 = \uCE90\uC2DC\uC77D\uAE30_(\uC5F4\uC1E0);
    if (\uB2F4\uAE34 && \uB2F4\uAE34.ok) return \uB2F4\uAE34;
    var r = \uC77D\uB294\uB3D9\uC548_(function() {
      return \uAE30\uB85D\uBD84\uC11D_(days, \uC804\uCCB4\uC219\uC81C());
    });
    \uCE90\uC2DC\uB2F4\uAE30_(\uC5F4\uC1E0, r, \uAE30\uB85D\uCE90\uC2DC\uCD08_);
    return r;
  }
  function \uC120\uC0DD\uB2D8\uC694\uC57D(\uBE44\uBC88, \uC77C\uC218) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var \uAE30\uBCF8 = \uC120\uC0DD\uB2D8\uAE30\uBCF8(\uBE44\uBC88);
    var \uAE30\uB85D = \uC77D\uB294\uB3D9\uC548_(function() {
      return \uAE30\uB85D\uBD84\uC11D_(Number(\uC77C\uC218) || 7, \uAE30\uBCF8.\uC219\uC81C\uBAA9\uB85D);
    });
    var \uAD50\uC7AC\uB9F5 = \uAE30\uB85D.\uAD50\uC7AC\uB9F5 || {};
    \uAE30\uB85D.\uC2DC\uD5D8\uBAA9\uB85D.forEach(function(t) {
      t.\uAD50\uC7AC = \uAD50\uC7AC\uB9F5[t.\uC774\uB984] || [];
    });
    \uAE30\uB85D.\uD559\uC0DD\uBCC4.forEach(function(v) {
      v.\uAD50\uC7AC = \uAD50\uC7AC\uB9F5[v.\uC774\uB984] || [];
    });
    return {
      ok: true,
      \uC2DC\uD5D8\uBAA9\uB85D: \uAE30\uB85D.\uC2DC\uD5D8\uBAA9\uB85D,
      \uD559\uC0DD\uBCC4: \uAE30\uB85D.\uD559\uC0DD\uBCC4,
      \uBBF8\uC751\uC2DC: \uAE30\uB85D.\uBBF8\uC751\uC2DC,
      \uC624\uB2F5: \uAE30\uB85D.\uC624\uB2F5,
      \uD559\uC0DD\uBAA9\uB85D: \uAE30\uBCF8.\uD559\uC0DD\uBAA9\uB85D,
      \uB2E8\uC5B4\uC7A5\uBAA9\uB85D: \uAE30\uBCF8.\uB2E8\uC5B4\uC7A5\uBAA9\uB85D,
      \uC2DC\uC0C1\uD56D\uBAA9: \uAE30\uBCF8.\uC2DC\uC0C1\uD56D\uBAA9,
      \uD569\uACA9\uC810: \uAE30\uBCF8.\uD569\uACA9\uC810,
      \uC219\uC81C\uBAA9\uB85D: \uAE30\uBCF8.\uC219\uC81C\uBAA9\uB85D
    };
  }
  function \uD2C0\uB9B0\uC804\uBB38(\uC774\uB984, \uC2DC\uD2B8, \uC904, \uD0A4) {
    var name = s_(\uC2DC\uD2B8) === SHEET.\uAE30\uB85D\uBCF4\uAD00 ? SHEET.\uAE30\uB85D\uBCF4\uAD00 : SHEET.\uAE30\uB85D;
    var sh = null;
    try {
      sh = sheet_(name);
    } catch (e) {
      return { ok: false };
    }
    var last = sh.getLastRow(), n = Number(\uC904), k = Number(\uD0A4) || 0;
    function \uB9DE\uB098(v) {
      return v instanceof Date2 && v.getTime() === k;
    }
    if (!(n >= 2 && n <= last && \uB9DE\uB098(sh.getRange(n, 1).getValue()))) {
      n = 0;
      if (k && last >= 2) {
        var \uB54C\uB4E4 = sh.getRange(2, 1, last - 1, 1).getValues();
        for (var i = \uB54C\uB4E4.length - 1; i >= 0; i--) if (\uB9DE\uB098(\uB54C\uB4E4[i][0])) {
          n = i + 2;
          break;
        }
      }
      if (!n) return { ok: false };
    }
    if (s_(sh.getRange(n, 3).getValue()) !== s_(\uC774\uB984)) return { ok: false };
    var \uB2E8\uC5B4\uB4E4 = \uC628\uC624\uB2F5_(sh.getRange(n, \uD2C0\uB9B0\uB2E8\uC5B4\uC5F4).getValue(), sh.getRange(n, \uD2C0\uB9B0\uB2E8\uC5B4\uC5F4).getNote());
    return { ok: true, \uD2C0\uB9B0: \uB2E8\uC5B4\uB4E4 };
  }
  function \uAE30\uB85D\uBA54\uBAA8(\uBE44\uBC88, \uC904, \uD0A4) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var sh = sheet_(SHEET.\uAE30\uB85D), last = sh.getLastRow(), n = Number(\uC904), k = Number(\uD0A4) || 0;
    function \uB9DE\uB098(v) {
      return !k || v instanceof Date2 && v.getTime() === k;
    }
    if (!(n >= 2 && n <= last && \uB9DE\uB098(sh.getRange(n, 1).getValue()))) {
      n = 0;
      if (k && last >= 2) {
        var \uB54C\uB4E4 = sh.getRange(2, 1, last - 1, 1).getValues();
        for (var i = \uB54C\uB4E4.length - 1; i >= 0; i--) if (\uB9DE\uB098(\uB54C\uB4E4[i][0])) {
          n = i + 2;
          break;
        }
      }
      if (!n) return { ok: false, \uBA54\uC2DC\uC9C0: "\uAE30\uB85D\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4 (\uC815\uB9AC\uD588\uAC70\uB098 \uC9C0\uC6CC\uC9C4 \uAE30\uB85D)" };
    }
    var \uC140 = s_(sh.getRange(n, \uD2C0\uB9B0\uB2E8\uC5B4\uC5F4).getValue());
    var \uBA54\uBAA8 = s_(sh.getRange(n, \uD2C0\uB9B0\uB2E8\uC5B4\uC5F4).getNote());
    var \uB2E8\uC5B4\uB4E4 = \uC628\uC624\uB2F5_(\uC140, \uBA54\uBAA8);
    return { ok: true, \uC904: n, \uD0A4: k, \uD2C0\uB9B0: \uB2E8\uC5B4\uB4E4, \uAC1C\uC218: \uB2E8\uC5B4\uB4E4.length };
  }
  function \uAE30\uB85D\uBD84\uC11D_(days, \uC219\uC81C\uBAA9\uB85D) {
    var \uAE30\uC900 = new Date2();
    \uAE30\uC900.setHours(0, 0, 0, 0);
    \uAE30\uC900.setDate(\uAE30\uC900.getDate() - (days - 1));
    var sh = sheet_(SHEET.\uAE30\uB85D);
    var \uC904\uB4E4 = \uCD5C\uADFC\uAE30\uB85D\uC904_(sh, \uAE30\uC900);
    var \uAD50\uC7AC\uB9F5 = \uAD50\uC7AC\uB9F5_();
    var \uC2DC\uD5D8\uBAA9\uB85D = [];
    var \uAE34\uC904 = [];
    for (var i = 0; i < \uC904\uB4E4.length; i++) {
      var x = \uC904\uB4E4[i].x;
      if (!(x[0] instanceof Date2) || x[0] < \uAE30\uC900) continue;
      var \uCE78 = \uD2C0\uB9B0\uCE78\uB098\uB204\uAE30_(x[13]);
      \uC2DC\uD5D8\uBAA9\uB85D.push({
        \uD0A4: x[0].getTime(),
        \uC904: \uC904\uB4E4[i].\uC904,
        \uAD6C\uBD84: s_(x[\uAD6C\uBD84\uC5F4 - 1]),
        \uC81C\uC678: s_(x[\uC81C\uC678\uC5F4 - 1]) === "O",
        \uC7AC\uC2DC\uD5D8: s_(x[\uAD6C\uBD84\uC5F4 - 1]) === \uC7AC\uC2DC\uD5D8\uD45C\uC2DC,
        \uC2DC\uAC01: Utilities.formatDate(x[0], Session.getScriptTimeZone(), "MM/dd HH:mm"),
        \uB0A0\uC9DC: ymd_(x[0]),
        \uC774\uB984: s_(x[2]),
        \uB2E8\uC5B4\uC7A5: s_(x[3]),
        \uBC94\uC704: s_(x[4]),
        \uC720\uD615: s_(x[5]),
        \uBB38\uD56D\uC218: Number(x[6]) || 0,
        \uC815\uB2F5\uC218: Number(x[7]) || 0,
        \uC810\uC218: Number(x[8]) || 0,
        \uAC8C\uC784\uC810\uC218: Number(x[9]) || 0,
        \uC18C\uC694\uCD08: Number(x[11]) || 0,
        \uC219\uC81C: \uC219\uC81C\uC600\uB098_(x[12]),
        \uD2C0\uB9B0\uB2E8\uC5B4: \uCE78.\uC55E,
        // 앞 다섯 개까지만 — 전문은 기록메모 로
        \uD2C0\uB9B0\uB354: \uCE78.\uB354
      });
      if (\uCE78.\uB354) \uAE34\uC904.push(\uC2DC\uD5D8\uBAA9\uB85D[\uC2DC\uD5D8\uBAA9\uB85D.length - 1]);
    }
    var \uC804\uBB38 = {};
    if (\uAE34\uC904.length) {
      var \uCC98\uC74C = \uAE34\uC904[0].\uC904, \uB9C8\uC9C0\uB9C9 = \uAE34\uC904[\uAE34\uC904.length - 1].\uC904;
      var \uBA54\uBAA8\uB4E4 = sh.getRange(\uCC98\uC74C, \uD2C0\uB9B0\uB2E8\uC5B4\uC5F4, \uB9C8\uC9C0\uB9C9 - \uCC98\uC74C + 1, 1).getNotes();
      \uAE34\uC904.forEach(function(t) {
        var \uBA54\uBAA8 = s_((\uBA54\uBAA8\uB4E4[t.\uC904 - \uCC98\uC74C] || [])[0]);
        if (\uBA54\uBAA8) \uC804\uBB38[t.\uD0A4 + "|" + t.\uC904] = \uBA54\uBAA8.split("\n").slice(2).filter(String).join(", ");
      });
    }
    \uC2DC\uD5D8\uBAA9\uB85D.reverse();
    var \uBCF8\uC2DC\uD5D8 = \uC2DC\uD5D8\uBAA9\uB85D.filter(function(t) {
      return t.\uC219\uC81C && !t.\uC81C\uC678 && t.\uAD6C\uBD84 !== \uBCF4\uCDA9\uD45C\uC2DC && t.\uAD6C\uBD84 !== \uC2DC\uD5D8\uD45C\uC2DC;
    });
    function \uBE48\uC904_(t) {
      return {
        \uC774\uB984: t.\uC774\uB984,
        \uD69F\uC218: 0,
        \uC810\uC218\uD569: 0,
        \uC624\uB2F5\uB178\uD2B8: 0,
        \uBCF4\uCDA9: 0,
        \uC2DC\uD5D8: 0,
        \uC2DC\uD5D8\uD569: 0,
        \uCD5C\uADFC: t.\uC2DC\uAC01
      };
    }
    var \uD559\uC0DD\uB9F5 = {};
    \uBCF8\uC2DC\uD5D8.forEach(function(t) {
      var key = t.\uC774\uB984;
      if (!\uD559\uC0DD\uB9F5[key]) \uD559\uC0DD\uB9F5[key] = \uBE48\uC904_(t);
      \uD559\uC0DD\uB9F5[key].\uD69F\uC218++;
      \uD559\uC0DD\uB9F5[key].\uC810\uC218\uD569 += t.\uC810\uC218;
    });
    \uC2DC\uD5D8\uBAA9\uB85D.forEach(function(t) {
      if (t.\uC81C\uC678) return;
      var \uC2DC\uD5D8 = t.\uAD6C\uBD84 === \uC2DC\uD5D8\uD45C\uC2DC;
      if (!t.\uC7AC\uC2DC\uD5D8 && t.\uAD6C\uBD84 !== \uBCF4\uCDA9\uD45C\uC2DC && !\uC2DC\uD5D8) return;
      var key = t.\uC774\uB984;
      if (!\uD559\uC0DD\uB9F5[key]) \uD559\uC0DD\uB9F5[key] = \uBE48\uC904_(t);
      if (t.\uC7AC\uC2DC\uD5D8) \uD559\uC0DD\uB9F5[key].\uC624\uB2F5\uB178\uD2B8++;
      else if (\uC2DC\uD5D8) {
        \uD559\uC0DD\uB9F5[key].\uC2DC\uD5D8++;
        \uD559\uC0DD\uB9F5[key].\uC2DC\uD5D8\uD569 += t.\uC810\uC218;
      } else \uD559\uC0DD\uB9F5[key].\uBCF4\uCDA9++;
    });
    \uC219\uC81C\uBAA9\uB85D = \uC219\uC81C\uBAA9\uB85D || \uC804\uCCB4\uC219\uC81C();
    var \uCC3D\uC2DC\uC791 = ymd_(\uAE30\uC900), \uC624\uB298\uB0A0 = ymd_(new Date2());
    var \uBE75\uC810 = {};
    \uC219\uC81C\uBAA9\uB85D.forEach(function(h) {
      if (h.\uC885\uB958 === \uBCF4\uCDA9\uD45C\uC2DC) return;
      if (\uC2DC\uD5D8\uC778\uAC00_(h)) return;
      var \uB0A0 = h.\uB9C8\uAC10\uC77C || "";
      if (!\uB0A0 || \uB0A0 < \uCC3D\uC2DC\uC791 || \uB0A0 >= \uC624\uB298\uB0A0) return;
      (h.\uC548\uD55C\uC0AC\uB78C || []).forEach(function(n) {
        if ((h.\uBAA8\uC790\uB780\uC0AC\uB78C || []).indexOf(n) > -1) return;
        \uBE75\uC810[n] = (\uBE75\uC810[n] || 0) + 1;
      });
    });
    var \uD559\uC0DD\uBCC4 = Object.keys(\uD559\uC0DD\uB9F5).map(function(k) {
      var v = \uD559\uC0DD\uB9F5[k];
      v.\uBABB\uB0B8 = \uBE75\uC810[k] || 0;
      var \uBD84\uBAA8 = v.\uD69F\uC218 + v.\uBABB\uB0B8;
      v.\uD3C9\uADE0 = \uBD84\uBAA8 ? Math.round(v.\uC810\uC218\uD569 / \uBD84\uBAA8) : null;
      v.\uC2DC\uD5D8\uD3C9\uADE0 = v.\uC2DC\uD5D8 ? Math.round(v.\uC2DC\uD5D8\uD569 / v.\uC2DC\uD5D8) : null;
      return v;
    });
    \uD559\uC0DD\uBCC4.sort(function(a, b) {
      if (a.\uD3C9\uADE0 === null || b.\uD3C9\uADE0 === null) return (a.\uD3C9\uADE0 === null ? 1 : 0) - (b.\uD3C9\uADE0 === null ? 1 : 0);
      return a.\uD3C9\uADE0 - b.\uD3C9\uADE0;
    });
    var \uD55C\uC0AC\uB78C = {};
    \uC2DC\uD5D8\uBAA9\uB85D.forEach(function(t) {
      \uD55C\uC0AC\uB78C[t.\uC774\uB984] = 1;
    });
    var \uBBF8\uC751\uC2DC = \uC77D\uAE30\uCE90\uC2DC_(SHEET.\uD559\uC0DD).filter(function(x2) {
      return s_(x2[1]) && !\uD55C\uC0AC\uB78C[s_(x2[1])];
    }).map(function(x2) {
      return { \uC774\uB984: s_(x2[1]), \uD559\uB144\uAD6C\uBD84: s_(x2[3]) || "\uCD08\uC911\uB4F1", \uAD50\uC7AC: \uC904\uAD50\uC7AC_(x2) };
    });
    var \uC624\uB2F5\uB9F5 = {};
    \uBCF8\uC2DC\uD5D8.forEach(function(t) {
      var \uAE00 = \uC804\uBB38[t.\uD0A4 + "|" + t.\uC904] !== void 0 ? \uC804\uBB38[t.\uD0A4 + "|" + t.\uC904] : t.\uD2C0\uB9B0\uB2E8\uC5B4;
      s_(\uAE00).split(",").forEach(function(w) {
        w = w.trim();
        if (w) \uC624\uB2F5\uB9F5[w] = (\uC624\uB2F5\uB9F5[w] || 0) + 1;
      });
    });
    var \uC624\uB2F5 = Object.keys(\uC624\uB2F5\uB9F5).map(function(w) {
      return { \uB2E8\uC5B4: w, \uD69F\uC218: \uC624\uB2F5\uB9F5[w] };
    });
    \uC624\uB2F5.sort(function(a, b) {
      return b.\uD69F\uC218 - a.\uD69F\uC218;
    });
    return {
      ok: true,
      \uC2DC\uD5D8\uBAA9\uB85D: \uC2DC\uD5D8\uBAA9\uB85D.slice(0, 200),
      \uD559\uC0DD\uBCC4,
      \uBBF8\uC751\uC2DC,
      \uC624\uB2F5: \uC624\uB2F5.slice(0, 30),
      \uAD50\uC7AC\uB9F5
    };
  }
  function \uC804\uCCB4\uBA85\uB2E8_() {
    var \uBCF8\uAC83 = {}, out = [];
    \uC77D\uAE30\uCE90\uC2DC_(SHEET.\uD559\uC0DD).forEach(function(x) {
      var \uC774\uB984 = s_(x[1]);
      if (!\uC774\uB984 || \uBCF8\uAC83[\uC774\uB984]) return;
      \uBCF8\uAC83[\uC774\uB984] = 1;
      out.push(\uC774\uB984);
    });
    return out;
  }
  function \uC219\uC81C\uB300\uC0C1_(h, \uC804\uCCB4, \uAD50\uC7AC\uB9F5, \uBC18\uD559\uC0DD) {
    var \uACE0\uB978 = \uC774\uB984\uB4E4\uD480\uAE30_(h && h.\uD559\uC0DD);
    if (\uACE0\uB978.length) return \uACE0\uB978.filter(function(n) {
      return \uC804\uCCB4.indexOf(n) > -1;
    });
    var \uBC18 = s_(h && h.\uBC18);
    if (\uBC18) return ((\uBC18\uD559\uC0DD || {})[\uBC18] || []).slice();
    var \uCC45 = s_(h && h.\uB2E8\uC5B4\uC7A5);
    if (!\uCC45) return \uC804\uCCB4.slice();
    var \uBC1B\uC740\uC0AC\uB78C = \uC804\uCCB4.filter(function(n) {
      return ((\uAD50\uC7AC\uB9F5 || {})[n] || []).indexOf(\uCC45) > -1;
    });
    return \uBC1B\uC740\uC0AC\uB78C;
  }
  function \uC774\uB984\uB4E4\uD480\uAE30_(v) {
    if (Object.prototype.toString.call(v) === "[object Array]") {
      return v.map(s_).filter(String);
    }
    var t = s_(v);
    if (!t) return [];
    var \uBCF8\uAC83 = {}, out = [];
    t.split(/\s*[,|]\s*/).forEach(function(x) {
      var n = s_(x);
      if (n && !\uBCF8\uAC83[n]) {
        \uBCF8\uAC83[n] = 1;
        out.push(n);
      }
    });
    return out;
  }
  function \uB0B4\uC219\uC81C\uC778\uAC00_(h, \uC774\uB984, \uAD50\uC7AC\uB9F5, \uBC18\uD559\uC0DD) {
    var \uACE0\uB978 = \uC774\uB984\uB4E4\uD480\uAE30_(h && h.\uD559\uC0DD);
    if (\uACE0\uB978.length) return \uACE0\uB978.indexOf(s_(\uC774\uB984)) > -1;
    var \uBC18 = s_(h && h.\uBC18);
    if (\uBC18) return ((\uBC18\uD559\uC0DD || {})[\uBC18] || []).indexOf(s_(\uC774\uB984)) > -1;
    var \uCC45 = s_(h && h.\uB2E8\uC5B4\uC7A5);
    if (!\uCC45) return true;
    return ((\uAD50\uC7AC\uB9F5 || {})[s_(\uC774\uB984)] || []).indexOf(\uCC45) > -1;
  }
  function \uBC18\uBCC4\uBA85\uB2E8_() {
    var \uBC18\uD559\uC0DD = {};
    \uC77D\uAE30\uCE90\uC2DC_(SHEET.\uD559\uC0DD).forEach(function(x) {
      var \uBC18 = s_(x[0]), \uC774\uB984 = s_(x[1]);
      if (!\uBC18 || !\uC774\uB984) return;
      if (!\uBC18\uD559\uC0DD[\uBC18]) \uBC18\uD559\uC0DD[\uBC18] = [];
      if (\uBC18\uD559\uC0DD[\uBC18].indexOf(\uC774\uB984) < 0) \uBC18\uD559\uC0DD[\uBC18].push(\uC774\uB984);
    });
    return \uBC18\uD559\uC0DD;
  }
  function \uC644\uB8CC\uC810\uC218\uB4E4_(\uC774\uB984, \uC900\uC904\uB4E4) {
    var m = {};
    var \uD55C\uC0AC\uB78C = \uC774\uB984 !== void 0 && \uC774\uB984 !== null;
    (\uC900\uC904\uB4E4 ? [null] : [SHEET.\uAE30\uB85D, SHEET.\uAE30\uB85D\uBCF4\uAD00]).forEach(function(name) {
      var \uC904\uB4E4 = [];
      if (\uC900\uC904\uB4E4) \uC904\uB4E4 = \uC900\uC904\uB4E4;
      else {
        try {
          \uC904\uB4E4 = \uC77D\uAE30\uCE90\uC2DC_(name);
        } catch (e) {
          return;
        }
      }
      \uC904\uB4E4.forEach(function(x) {
        if (s_(x[14]) === \uC7AC\uC2DC\uD5D8\uD45C\uC2DC) return;
        if (!(x[0] instanceof Date2)) return;
        if (\uD55C\uC0AC\uB78C && s_(x[2]) !== s_(\uC774\uB984)) return;
        var key = (\uD55C\uC0AC\uB78C ? "" : s_(x[2]) + "|") + s_(x[3]) + "|" + s_(x[4]);
        var \uB0A0 = ymd_(x[0]);
        var \uC810 = Number(x[8]) || 0;
        var \uCE78 = m[key] = m[key] || {};
        if (\uCE78[\uB0A0] === void 0 || \uC810 > \uCE78[\uB0A0]) \uCE78[\uB0A0] = \uC810;
      });
    });
    return m;
  }
  function \uD47C\uAC83_(\uB0A0\uB4E4, \uC885\uB958, \uB4F1\uB85D, \uD310\uB2E8\uB0A0, \uCEF7) {
    if (!\uB0A0\uB4E4) return null;
    \uCEF7 = Number(\uCEF7) || 0;
    if (\uB2F9\uC77C\uCE58\uAE30_(\uC885\uB958)) {
      var \uC810 = \uB0A0\uB4E4[\uD310\uB2E8\uB0A0];
      return \uC810 === void 0 || \uC810 < \uCEF7 ? null : { \uB0A0: \uD310\uB2E8\uB0A0, \uC810\uC218: \uC810 };
    }
    var \uB2A6\uC740 = "";
    for (var d in \uB0A0\uB4E4) {
      if (\uB4F1\uB85D && d < \uB4F1\uB85D) continue;
      if ((Number(\uB0A0\uB4E4[d]) || 0) < \uCEF7) continue;
      if (!\uB2A6\uC740 || d > \uB2A6\uC740) \uB2A6\uC740 = d;
    }
    return \uB2A6\uC740 ? { \uB0A0: \uB2A6\uC740, \uC810\uC218: \uB0A0\uB4E4[\uB2A6\uC740] } : null;
  }
  function \uB0B8\uAC83_(\uB0A0\uB4E4, \uC885\uB958, \uB4F1\uB85D, \uD310\uB2E8\uB0A0) {
    return \uD47C\uAC83_(\uB0A0\uB4E4, \uC885\uB958, \uB4F1\uB85D, \uD310\uB2E8\uB0A0, \uD569\uACA9\uCEF7_(\uC885\uB958));
  }
  function \uC5F0\uC18D\uC2DC\uC791\uC77C_() {
    var v = setting_("\uC5F0\uC18D\uC2DC\uC791\uC77C", "");
    if (v instanceof Date2) return ymd_(v);
    var t = s_(v);
    return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : "";
  }
  function \uC5F0\uC18D\uC2DC\uC791\uC77C\uC800\uC7A5(\uBE44\uBC88, \uB0A0\uC9DC) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    var t = s_(\uB0A0\uC9DC);
    if (t && !/^\d{4}-\d{2}-\d{2}$/.test(t)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uB0A0\uC9DC \uBAA8\uC591\uC774 \uB9DE\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." };
    \uC124\uC815\uC4F0\uAE30_("\uC5F0\uC18D\uC2DC\uC791\uC77C", t);
    return { ok: true, \uC2DC\uC791\uC77C: t };
  }
  function \uC644\uB8CC\uB0A0\uB4E4_() {
    return \uC644\uB8CC\uC810\uC218\uB4E4_();
  }
  function \uADF8\uB0A0\uB0C8\uB098_(\uB0A0\uB4E4, \uC885\uB958, \uB4F1\uB85D, \uB0A0) {
    if (!\uB0A0\uB4E4) return false;
    var \uCEF7 = \uD569\uACA9\uCEF7_(\uC885\uB958);
    if (\uB2F9\uC77C\uCE58\uAE30_(\uC885\uB958)) {
      return \uB0A0\uB4E4[\uB0A0] !== void 0 && (Number(\uB0A0\uB4E4[\uB0A0]) || 0) >= \uCEF7;
    }
    for (var d in \uB0A0\uB4E4) {
      if (\uB4F1\uB85D && d < \uB4F1\uB85D) continue;
      if ((Number(\uB0A0\uB4E4[d]) || 0) < \uCEF7) continue;
      if (d <= \uB0A0) return true;
    }
    return false;
  }
  function \uC5B8\uC81C\uB0C8\uB098_(\uB0A0\uB4E4, \uB4F1\uB85D, \uB05D, \uCEF7) {
    if (!\uB0A0\uB4E4) return "";
    \uCEF7 = Number(\uCEF7) || 0;
    var \uC774\uB978 = "";
    for (var d in \uB0A0\uB4E4) {
      if (\uB4F1\uB85D && d < \uB4F1\uB85D) continue;
      if (\uB05D && d > \uB05D) continue;
      if ((Number(\uB0A0\uB4E4[d]) || 0) < \uCEF7) continue;
      if (!\uC774\uB978 || d < \uC774\uB978) \uC774\uB978 = d;
    }
    return \uC774\uB978;
  }
  function \uC219\uC81C\uB0A0\uD45C_() {
    var \uC2DC\uC791 = \uC5F0\uC18D\uC2DC\uC791\uC77C_();
    var today = ymd_(new Date2());
    var \uC804\uCCB4 = \uC804\uCCB4\uBA85\uB2E8_();
    var \uAD50\uC7AC\uB9F5 = \uAD50\uC7AC\uB9F5_();
    var \uBC18\uD559\uC0DD = \uBC18\uBCC4\uBA85\uB2E8_();
    var \uC644\uB8CC = \uC644\uB8CC\uB0A0\uB4E4_();
    var \uD45C = {};
    rows_(SHEET.\uC219\uC81C).forEach(function(x) {
      var \uB2E8\uC5B4\uC7A5 = s_(x[1]);
      if (!\uB2E8\uC5B4\uC7A5) return;
      var \uBC94\uC704 = (Number(x[2]) || 1) + "~" + (Number(x[3]) || 0);
      var \uB9C8\uAC10 = x[5] instanceof Date2 ? ymd_(x[5]) : s_(x[5]);
      var \uB4F1\uB85D = x[6] instanceof Date2 ? ymd_(x[6]) : "";
      var \uC885\uB958 = s_(x[8]) ? \uC219\uC81C\uC885\uB958_(x[8]) : \uB9C8\uAC10 === today ? "\uB2F9\uC77C" : "\uAE30\uD55C";
      if (\uC885\uB958 === "\uC2DC\uD5D8") return;
      var \uB0A0 = \uB9C8\uAC10 || \uB4F1\uB85D;
      if (!\uB0A0) return;
      var \uB300\uC0C1\uB4E4 = \uC219\uC81C\uB300\uC0C1_(
        { \uBC18: s_(x[0]), \uB2E8\uC5B4\uC7A5, \uD559\uC0DD: s_(x[7]) },
        \uC804\uCCB4,
        \uAD50\uC7AC\uB9F5,
        \uBC18\uD559\uC0DD
      );
      var \uC544\uC9C1 = \uB0A0 > today;
      \uB300\uC0C1\uB4E4.forEach(function(\uC774\uB984) {
        var \uB0A0\uB4E4 = \uAE30\uB85D\uCC3E\uAE30_(\uC644\uB8CC, \uC774\uB984 + "|", \uB2E8\uC5B4\uC7A5, Number(x[2]) || 1, Number(x[3]) || 0, x.length > 11 ? x[11] : "");
        var key = \uC774\uB984;
        if (\uC544\uC9C1) {
          if (\uB2F9\uC77C\uCE58\uAE30_(\uC885\uB958)) return;
          var \uB0B8\uB0A0 = \uC5B8\uC81C\uB0C8\uB098_(\uB0A0\uB4E4, \uB4F1\uB85D, today, \uD569\uACA9\uCEF7_(\uC885\uB958));
          if (!\uB0B8\uB0A0) return;
          if (\uC2DC\uC791 && \uB0B8\uB0A0 < \uC2DC\uC791) return;
          var \uCE782 = \uD45C[key] = \uD45C[key] || {};
          var \uD558\uB8E82 = \uCE782[\uB0B8\uB0A0] = \uCE782[\uB0B8\uB0A0] || { \uCD1D: 0, \uB0B8: 0 };
          \uD558\uB8E82.\uCD1D++;
          \uD558\uB8E82.\uB0B8++;
          return;
        }
        if (\uC2DC\uC791 && \uB0A0 < \uC2DC\uC791) return;
        var \uCE78 = \uD45C[key] = \uD45C[key] || {};
        var \uD558\uB8E8 = \uCE78[\uB0A0] = \uCE78[\uB0A0] || { \uCD1D: 0, \uB0B8: 0 };
        \uD558\uB8E8.\uCD1D++;
        if (\uADF8\uB0A0\uB0C8\uB098_(\uB0A0\uB4E4, \uC885\uB958, \uB4F1\uB85D, \uB0A0)) \uD558\uB8E8.\uB0B8++;
      });
    });
    return \uD45C;
  }
  function \uC5F0\uC18D\uC138\uAE30_(\uCE78) {
    var today = ymd_(new Date2());
    var \uB0A0\uB4E4 = Object.keys(\uCE78 || {}).sort();
    var \uCD5C\uACE0 = 0, \uC774\uC5B4\uC9D0 = 0;
    \uB0A0\uB4E4.forEach(function(d2) {
      var v2 = \uCE78[d2];
      if (v2.\uB0B8 >= v2.\uCD1D) {
        \uC774\uC5B4\uC9D0++;
        \uCD5C\uACE0 = Math.max(\uCD5C\uACE0, \uC774\uC5B4\uC9D0);
      } else if (d2 === today) {
      } else \uC774\uC5B4\uC9D0 = 0;
    });
    var \uC9C0\uAE08 = 0, \uC624\uB298\uB0A8\uC74C = false;
    for (var i = \uB0A0\uB4E4.length - 1; i >= 0; i--) {
      var d = \uB0A0\uB4E4[i], v = \uCE78[d];
      if (v.\uB0B8 >= v.\uCD1D) {
        \uC9C0\uAE08++;
        continue;
      }
      if (d === today) {
        \uC624\uB298\uB0A8\uC74C = true;
        continue;
      }
      break;
    }
    return { \uC9C0\uAE08, \uCD5C\uACE0: Math.max(\uCD5C\uACE0, \uC9C0\uAE08), \uC624\uB298\uB0A8\uC74C, \uC219\uC81C\uB0A0\uC218: \uB0A0\uB4E4.length };
  }
  function \uC5F0\uC18D\uAC00\uC838\uC624\uAE30(\uC774\uB984) {
    var \uD45C = \uC219\uC81C\uB0A0\uD45C_();
    var \uB098\uD0A4 = s_(\uC774\uB984);
    var \uBAA8\uB450 = [];
    \uC804\uCCB4\uBA85\uB2E8_().forEach(function(n) {
      var v = \uC5F0\uC18D\uC138\uAE30_(\uD45C[n]);
      \uBAA8\uB450.push({ \uC774\uB984: n, \uC5F0\uC18D: v.\uC9C0\uAE08, \uCD5C\uACE0: v.\uCD5C\uACE0 });
    });
    function \uC904\uC138\uC6B0\uAE30(\uBAA9\uB85D) {
      \uBAA9\uB85D = \uBAA9\uB85D.slice().sort(function(a, b) {
        if (b.\uC5F0\uC18D !== a.\uC5F0\uC18D) return b.\uC5F0\uC18D - a.\uC5F0\uC18D;
        return a.\uC774\uB984 < b.\uC774\uB984 ? -1 : 1;
      });
      var \uB4F1\uC218 = 0, \uC55E\uAC12 = null;
      return \uBAA9\uB85D.map(function(x, i) {
        if (x.\uC5F0\uC18D !== \uC55E\uAC12) {
          \uB4F1\uC218 = i + 1;
          \uC55E\uAC12 = x.\uC5F0\uC18D;
        }
        return { \uC774\uB984: x.\uC774\uB984, \uC5F0\uC18D: x.\uC5F0\uC18D, \uB4F1\uC218, \uB098: x.\uC774\uB984 === s_(\uC774\uB984) };
      });
    }
    var \uB098 = \uC5F0\uC18D\uC138\uAE30_(\uD45C[\uB098\uD0A4]);
    return {
      ok: true,
      \uC5F0\uC18D: \uB098.\uC9C0\uAE08,
      \uCD5C\uACE0: \uB098.\uCD5C\uACE0,
      \uC624\uB298\uB0A8\uC74C: \uB098.\uC624\uB298\uB0A8\uC74C,
      \uC2DC\uC791\uC77C: \uC5F0\uC18D\uC2DC\uC791\uC77C_(),
      \uC804\uCCB4\uC21C\uC704: \uC904\uC138\uC6B0\uAE30(\uBAA8\uB450)
    };
  }
  function \uD478\uC2DC\uC2DC\uD2B8_() {
    var ss = ss_();
    var sh = ss.getSheetByName(SHEET.\uD478\uC2DC);
    if (!sh) {
      sh = ss.insertSheet(SHEET.\uD478\uC2DC);
      sh.getRange(1, 1, 1, HEADERS.\uD478\uC2DC.length).setValues([HEADERS.\uD478\uC2DC]).setFontWeight("bold").setBackground("#EFF3F9");
      sh.setFrozenRows(1);
      sh.setColumnWidth(1, 140);
      sh.setColumnWidth(2, 110);
      sh.setColumnWidth(3, 90);
      sh.setColumnWidth(4, 420);
      sh.setColumnWidth(7, 120);
    }
    return sh;
  }
  function \uD478\uC2DC\uACF5\uAC1C\uD0A4() {
    return s_(setting_("\uD478\uC2DC\uACF5\uAC1C\uD0A4", ""));
  }
  function \uD478\uC2DC\uC5F4\uC1E0(\uBE44\uBC88) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    return { ok: true, \uACF5\uAC1C\uD0A4: \uD478\uC2DC\uACF5\uAC1C\uD0A4(), \uBE44\uBC00\uD0A4: s_(setting_("\uD478\uC2DC\uBE44\uBC00\uD0A4", "")) };
  }
  function \uD478\uC2DC\uC5F4\uC1E0\uC800\uC7A5(\uBE44\uBC88, \uACF5\uAC1C\uD0A4, \uBE44\uBC00\uD0A4) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    if (!s_(\uACF5\uAC1C\uD0A4) || !s_(\uBE44\uBC00\uD0A4)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uC5F4\uC1E0\uAC00 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4." };
    \uC124\uC815\uC4F0\uAE30_("\uD478\uC2DC\uACF5\uAC1C\uD0A4", s_(\uACF5\uAC1C\uD0A4));
    \uC124\uC815\uC4F0\uAE30_("\uD478\uC2DC\uBE44\uBC00\uD0A4", s_(\uBE44\uBC00\uD0A4));
    \uD478\uC2DC\uC2DC\uD2B8_();
    return { ok: true };
  }
  function \uAD6C\uB3C5\uB4F1\uB85D(\uC774\uB984, \uAD6C\uB3C5, \uAE30\uAE30) {
    var \uC8FC\uC18C = s_(\uAD6C\uB3C5 && \uAD6C\uB3C5.\uC8FC\uC18C);
    if (!\uC8FC\uC18C) return { ok: false, \uBA54\uC2DC\uC9C0: "\uC8FC\uC18C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4." };
    var sh = \uD478\uC2DC\uC2DC\uD2B8_();
    var \uC904\uB4E4 = [];
    try {
      \uC904\uB4E4 = rows_(SHEET.\uD478\uC2DC);
    } catch (e) {
      \uC904\uB4E4 = [];
    }
    for (var i = 0; i < \uC904\uB4E4.length; i++) {
      if (s_(\uC904\uB4E4[i][3]) === \uC8FC\uC18C) {
        sh.getRange(i + 2, 1, 1, 7).setValues([[
          new Date2(),
          "",
          s_(\uC774\uB984),
          \uC8FC\uC18C,
          s_(\uAD6C\uB3C5.p256dh),
          s_(\uAD6C\uB3C5.auth),
          s_(\uAE30\uAE30)
        ]]);
        return { ok: true, \uC0C8\uAC83: false };
      }
    }
    sh.appendRow([new Date2(), "", s_(\uC774\uB984), \uC8FC\uC18C, s_(\uAD6C\uB3C5.p256dh), s_(\uAD6C\uB3C5.auth), s_(\uAE30\uAE30)]);
    sh.getRange(sh.getLastRow(), 1).setNumberFormat("yyyy-MM-dd HH:mm");
    return { ok: true, \uC0C8\uAC83: true };
  }
  function \uAD6C\uB3C5\uD574\uC81C(\uC8FC\uC18C) {
    var t = s_(\uC8FC\uC18C);
    if (!t) return { ok: false };
    var sh = \uD478\uC2DC\uC2DC\uD2B8_();
    var \uC904\uB4E4 = [];
    try {
      \uC904\uB4E4 = rows_(SHEET.\uD478\uC2DC);
    } catch (e) {
      return { ok: true, \uAC1C\uC218: 0 };
    }
    var \uC9C0\uC6C0 = 0;
    for (var i = \uC904\uB4E4.length - 1; i >= 0; i--) {
      if (s_(\uC904\uB4E4[i][3]) === t) {
        sh.deleteRow(i + 2);
        \uC9C0\uC6C0++;
      }
    }
    return { ok: true, \uAC1C\uC218: \uC9C0\uC6C0 };
  }
  function \uAD6C\uB3C5\uBAA9\uB85D(\uBE44\uBC88, \uC774\uB984\uB4E4) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    \uD478\uC2DC\uC2DC\uD2B8_();
    var \uC904\uB4E4 = [];
    try {
      \uC904\uB4E4 = rows_(SHEET.\uD478\uC2DC);
    } catch (e) {
      \uC904\uB4E4 = [];
    }
    var \uACE0\uB978 = \uC774\uB984\uB4E4\uD480\uAE30_(\uC774\uB984\uB4E4), \uAC78\uB7EC = {};
    \uACE0\uB978.forEach(function(n) {
      \uAC78\uB7EC[n] = 1;
    });
    var out = [];
    \uC904\uB4E4.forEach(function(x, i) {
      var \uC8FC\uC18C = s_(x[3]);
      if (!\uC8FC\uC18C) return;
      if (\uACE0\uB978.length && !\uAC78\uB7EC[s_(x[2])]) return;
      out.push({
        \uD589: i + 2,
        \uC774\uB984: s_(x[2]),
        \uC8FC\uC18C,
        p256dh: s_(x[4]),
        auth: s_(x[5]),
        \uAE30\uAE30: s_(x[6])
      });
    });
    return { ok: true, \uAD6C\uB3C5: out };
  }
  function \uAD6C\uB3C5\uD604\uD669(\uBE44\uBC88) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    var \uCF20\uC0AC\uB78C = {};
    try {
      rows_(SHEET.\uD478\uC2DC).forEach(function(x) {
        if (s_(x[3])) \uCF20\uC0AC\uB78C[s_(x[2])] = 1;
      });
    } catch (e) {
    }
    var \uB2E4 = \uC804\uCCB4\uBA85\uB2E8_(), \uCF20\uC218 = 0, \uC548\uCF20 = [];
    \uB2E4.forEach(function(\uC774\uB984) {
      if (\uCF20\uC0AC\uB78C[\uC774\uB984]) \uCF20\uC218++;
      else \uC548\uCF20.push({ \uC774\uB984 });
    });
    return {
      ok: true,
      \uC804\uCCB4: \uB2E4.length,
      \uCF2C: \uCF20\uC218,
      \uC548\uCF20,
      \uC5F4\uC1E0\uC788\uB098: !!\uD478\uC2DC\uACF5\uAC1C\uD0A4()
    };
  }
  function \uD478\uC2DC\uC804\uC1A1(\uBE44\uBC88, \uBCF4\uB0BC\uAC83) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    var \uBAA9\uB85D = \uBCF4\uB0BC\uAC83 || [];
    if (!\uBAA9\uB85D.length) return { ok: true, \uC904: [] };
    function \uC694\uCCAD\uB9CC\uB4E4\uAE30(x) {
      return {
        url: s_(x.\uC8FC\uC18C),
        method: "post",
        payload: "",
        headers: {
          "TTL": "86400",
          "Authorization": "vapid t=" + s_(x.\uD45C) + ", k=" + s_(x.\uACF5\uAC1C\uD0A4)
        },
        muteHttpExceptions: true
      };
    }
    var \uC694\uCCAD = \uBAA9\uB85D.map(\uC694\uCCAD\uB9CC\uB4E4\uAE30);
    var \uC904 = [];
    try {
      var \uB2F5\uB4E4 = UrlFetchApp.fetchAll(\uC694\uCCAD);
      \uB2F5\uB4E4.forEach(function(r, i) {
        var \uAE00 = "";
        try {
          \uAE00 = String(r.getContentText() || "").slice(0, 200);
        } catch (e) {
        }
        \uC904.push({ \uC8FC\uC18C: \uBAA9\uB85D[i].\uC8FC\uC18C, \uC0C1\uD0DC: r.getResponseCode(), \uAE00 });
      });
    } catch (e) {
      \uBAA9\uB85D.forEach(function(x, i) {
        try {
          var r = UrlFetchApp.fetch(\uC694\uCCAD[i].url, \uC694\uCCAD[i]);
          \uC904.push({
            \uC8FC\uC18C: x.\uC8FC\uC18C,
            \uC0C1\uD0DC: r.getResponseCode(),
            \uAE00: String(r.getContentText() || "").slice(0, 200)
          });
        } catch (err) {
          \uC904.push({ \uC8FC\uC18C: x.\uC8FC\uC18C, \uC0C1\uD0DC: 0, \uAE00: String(err && err.message || err).slice(0, 200) });
        }
      });
    }
    return { ok: true, \uC904 };
  }
  function \uC54C\uB9BC\uAD8C\uD55C\uD655\uC778() {
    var r = UrlFetchApp.fetch(
      "https://www.google.com/generate_204",
      { muteHttpExceptions: true }
    );
    var \uAE00 = "\uBC14\uAE65\uC73C\uB85C \uB098\uAC08 \uC218 \uC788\uC2B5\uB2C8\uB2E4. (\uC751\uB2F5 " + r.getResponseCode() + ")\n\n\uC774\uC81C \uBC30\uD3EC \u2192 \uBC30\uD3EC \uAD00\uB9AC \u2192 \uC218\uC815 \u2192 \uC0C8 \uBC84\uC804 \uC744 \uD55C \uB4A4\n\uC120\uC0DD\uB2D8 \uD654\uBA74\uC5D0\uC11C [\uC54C\uB9BC \uC2DC\uD5D8 \uBCF4\uB0B4\uAE30] \uB97C \uB20C\uB7EC \uBCF4\uC138\uC694.";
    Logger.log(\uAE00);
    try {
      SpreadsheetApp.getUi().alert(
        "\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8 \xB7 \uC54C\uB9BC \uAD8C\uD55C",
        \uAE00,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (e) {
    }
    return \uAE00;
  }
  function \uAD6C\uB3C5\uC9C0\uC6B0\uAE30(\uBE44\uBC88, \uC8FC\uC18C\uB4E4) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    var \uBE84\uAC83 = {};
    (\uC8FC\uC18C\uB4E4 || []).forEach(function(t) {
      if (s_(t)) \uBE84\uAC83[s_(t)] = 1;
    });
    if (!Object.keys(\uBE84\uAC83).length) return { ok: true, \uAC1C\uC218: 0 };
    var sh = \uD478\uC2DC\uC2DC\uD2B8_();
    var \uC904\uB4E4 = [];
    try {
      \uC904\uB4E4 = rows_(SHEET.\uD478\uC2DC);
    } catch (e) {
      return { ok: true, \uAC1C\uC218: 0 };
    }
    var \uC9C0\uC6C0 = 0;
    for (var i = \uC904\uB4E4.length - 1; i >= 0; i--) {
      if (\uBE84\uAC83[s_(\uC904\uB4E4[i][3])]) {
        sh.deleteRow(i + 2);
        \uC9C0\uC6C0++;
      }
    }
    return { ok: true, \uAC1C\uC218: \uC9C0\uC6C0 };
  }
  function \uACF5\uC9C0\uC2DC\uD2B8_() {
    var ss = ss_();
    var sh = ss.getSheetByName(SHEET.\uACF5\uC9C0);
    if (!sh) {
      sh = ss.insertSheet(SHEET.\uACF5\uC9C0);
      sh.getRange(1, 1, 1, HEADERS.\uACF5\uC9C0.length).setValues([HEADERS.\uACF5\uC9C0]).setFontWeight("bold").setBackground("#EFF3F9");
      sh.setFrozenRows(1);
      sh.setColumnWidth(1, 140);
      sh.setColumnWidth(2, 110);
      sh.setColumnWidth(3, 200);
      sh.setColumnWidth(4, 420);
      sh.setColumnWidth(5, 110);
      sh.setColumnWidth(6, 60);
    }
    return sh;
  }
  function \uACF5\uC9C0\uC904_(x, i) {
    var \uB54C = x[0] instanceof Date2 ? x[0] : null;
    return {
      \uD589: i + 2,
      \uD0A4: \uB54C ? String(\uB54C.getTime()) : "r" + (i + 2),
      \uBC18: s_(x[1]),
      \uC81C\uBAA9: s_(x[2]),
      \uB0B4\uC6A9: s_(x[3]),
      \uB05D\uB098\uB294\uB0A0: x[4] instanceof Date2 ? ymd_(x[4]) : s_(x[4]),
      \uCF2C: s_(x[5]) !== "X",
      \uB9CC\uB4E0\uB0A0: \uB54C ? ymd_(\uB54C) : ""
    };
  }
  function \uACF5\uC9C0\uAC00\uC838\uC624\uAE30() {
    var \uC624\uB298 = ymd_(new Date2());
    var \uC904\uB4E4 = [];
    try {
      \uC904\uB4E4 = rows_(SHEET.\uACF5\uC9C0);
    } catch (e) {
      return [];
    }
    var out = [];
    \uC904\uB4E4.forEach(function(x, i) {
      var n = \uACF5\uC9C0\uC904_(x, i);
      if (!n.\uCF2C) return;
      if (!n.\uC81C\uBAA9 && !n.\uB0B4\uC6A9) return;
      if (n.\uB05D\uB098\uB294\uB0A0 && n.\uB05D\uB098\uB294\uB0A0 < \uC624\uB298) return;
      out.push({ \uD0A4: n.\uD0A4, \uC81C\uBAA9: n.\uC81C\uBAA9, \uB0B4\uC6A9: n.\uB0B4\uC6A9, \uB9CC\uB4E0\uB0A0: n.\uB9CC\uB4E0\uB0A0 });
    });
    out.reverse();
    return out.slice(0, 5);
  }
  function \uACF5\uC9C0\uBAA9\uB85D(\uBE44\uBC88) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    \uACF5\uC9C0\uC2DC\uD2B8_();
    var \uC624\uB298 = ymd_(new Date2());
    var \uC904\uB4E4 = [];
    try {
      \uC904\uB4E4 = rows_(SHEET.\uACF5\uC9C0);
    } catch (e) {
      \uC904\uB4E4 = [];
    }
    var out = \uC904\uB4E4.map(\uACF5\uC9C0\uC904_).filter(function(n) {
      return n.\uC81C\uBAA9 || n.\uB0B4\uC6A9;
    });
    out.forEach(function(n) {
      n.\uC9C0\uB0A8 = !!(n.\uB05D\uB098\uB294\uB0A0 && n.\uB05D\uB098\uB294\uB0A0 < \uC624\uB298);
    });
    out.reverse();
    return { ok: true, \uACF5\uC9C0: out };
  }
  function \uACF5\uC9C0\uB4F1\uB85D(\uBE44\uBC88, v) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    var \uC81C\uBAA9 = s_(v && v.\uC81C\uBAA9), \uB0B4\uC6A9 = s_(v && v.\uB0B4\uC6A9);
    if (!\uC81C\uBAA9 && !\uB0B4\uC6A9) return { ok: false, \uBA54\uC2DC\uC9C0: "\uB0B4\uC6A9\uC744 \uC801\uC5B4 \uC8FC\uC138\uC694." };
    var \uB05D = s_(v && v.\uB05D\uB098\uB294\uB0A0);
    if (\uB05D && !/^\d{4}-\d{2}-\d{2}$/.test(\uB05D)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uB0A0\uC9DC \uBAA8\uC591\uC774 \uB9DE\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." };
    var sh = \uACF5\uC9C0\uC2DC\uD2B8_();
    sh.appendRow([new Date2(), "", \uC81C\uBAA9, \uB0B4\uC6A9, \uB05D, ""]);
    sh.getRange(sh.getLastRow(), 1).setNumberFormat("yyyy-MM-dd HH:mm");
    return { ok: true, \uACF5\uC9C0: \uACF5\uC9C0\uBAA9\uB85D(\uBE44\uBC88).\uACF5\uC9C0 };
  }
  function \uACF5\uC9C0\uB044\uAE30(\uBE44\uBC88, \uD589, \uCF24\uAE4C) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    var sh = \uACF5\uC9C0\uC2DC\uD2B8_();
    var n = Number(\uD589);
    if (!(n >= 2 && n <= sh.getLastRow())) return { ok: false, \uBA54\uC2DC\uC9C0: "\uC774\uBBF8 \uC9C0\uC6CC\uC9C4 \uACF5\uC9C0\uC785\uB2C8\uB2E4." };
    sh.getRange(n, 6).setValue(\uCF24\uAE4C ? "" : "X");
    return { ok: true, \uACF5\uC9C0: \uACF5\uC9C0\uBAA9\uB85D(\uBE44\uBC88).\uACF5\uC9C0 };
  }
  function \uACF5\uC9C0\uC0AD\uC81C(\uBE44\uBC88, \uD589) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    var sh = \uACF5\uC9C0\uC2DC\uD2B8_();
    var n = Number(\uD589);
    if (!(n >= 2 && n <= sh.getLastRow())) return { ok: false, \uBA54\uC2DC\uC9C0: "\uC774\uBBF8 \uC9C0\uC6CC\uC9C4 \uACF5\uC9C0\uC785\uB2C8\uB2E4." };
    sh.deleteRow(n);
    return { ok: true, \uACF5\uC9C0: \uACF5\uC9C0\uBAA9\uB85D(\uBE44\uBC88).\uACF5\uC9C0 };
  }
  var \uAC8C\uC784\uC774\uB984 = { \uC9DD: "\uC9DD \uB9DE\uCD94\uAE30", \uD37C\uC990: "\uAE00\uC790 \uD37C\uC990" };
  function \uAC8C\uC784\uC2DC\uD2B8_() {
    var ss = ss_();
    var sh = ss.getSheetByName(SHEET.\uAC8C\uC784);
    if (!sh) sh = ss.insertSheet(SHEET.\uAC8C\uC784);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, HEADERS.\uAC8C\uC784.length).setValues([HEADERS.\uAC8C\uC784]).setFontWeight("bold").setBackground("#EFF3F9");
      sh.setFrozenRows(1);
    }
    return sh;
  }
  function \uAC8C\uC784\uC800\uC7A5(p) {
    var \uC885 = s_(p.\uAC8C\uC784);
    if (!\uAC8C\uC784\uC774\uB984[\uC885]) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBAA8\uB974\uB294 \uAC8C\uC784\uC785\uB2C8\uB2E4." };
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(1e4);
    } catch (e) {
      return { ok: false, \uBA54\uC2DC\uC9C0: "\uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uD574 \uC8FC\uC138\uC694." };
    }
    try {
      var sh = \uAC8C\uC784\uC2DC\uD2B8_();
      sh.appendRow([
        new Date2(),
        "",
        s_(p.\uC774\uB984),
        \uC885,
        Number(p.\uC810\uC218) || 0,
        s_(p.\uAE30\uB85D),
        s_(p.\uB2E8\uC5B4\uC7A5)
      ]);
      sh.getRange(sh.getLastRow(), 1).setNumberFormat("yyyy-MM-dd HH:mm");
      return { ok: true };
    } catch (e) {
      return { ok: false, \uBA54\uC2DC\uC9C0: String(e) };
    } finally {
      lock.releaseLock();
    }
  }
  function \uAC8C\uC784\uC21C\uC704(\uC774\uB984) {
    var \uCD5C\uACE0 = {};
    var \uC624\uB298 = ymd_(new Date2());
    var \uC624\uB298\uD310 = 0;
    var \uC904\uB4E4 = [];
    try {
      \uC904\uB4E4 = rows_(SHEET.\uAC8C\uC784);
    } catch (e) {
      \uC904\uB4E4 = [];
    }
    \uC904\uB4E4.forEach(function(x) {
      var \uC885 = s_(x[3]);
      if (!\uAC8C\uC784\uC774\uB984[\uC885]) return;
      var n = s_(x[2]);
      if (!n) return;
      var \uC810 = Number(x[4]) || 0;
      var k = \uC885 + "|" + n;
      if (!\uCD5C\uACE0[k] || \uC810 > \uCD5C\uACE0[k].\uC810\uC218) \uCD5C\uACE0[k] = { \uAC8C\uC784: \uC885, \uC774\uB984: n, \uC810\uC218: \uC810, \uAE30\uB85D: s_(x[5]) };
      var \uB0A0 = x[0] instanceof Date2 ? ymd_(x[0]) : s_(x[0]).slice(0, 10);
      if (n === s_(\uC774\uB984) && \uB0A0 === \uC624\uB298) \uC624\uB298\uD310++;
    });
    function \uC904\uC138\uC6B0\uAE30(\uC885) {
      var \uBAA9\uB85D = Object.keys(\uCD5C\uACE0).map(function(k) {
        return \uCD5C\uACE0[k];
      }).filter(function(v) {
        return v.\uAC8C\uC784 === \uC885;
      }).sort(function(a, b) {
        if (b.\uC810\uC218 !== a.\uC810\uC218) return b.\uC810\uC218 - a.\uC810\uC218;
        return a.\uC774\uB984 < b.\uC774\uB984 ? -1 : 1;
      });
      var \uB4F1\uC218 = 0, \uC55E = null;
      return \uBAA9\uB85D.slice(0, 20).map(function(x, i) {
        if (x.\uC810\uC218 !== \uC55E) {
          \uB4F1\uC218 = i + 1;
          \uC55E = x.\uC810\uC218;
        }
        return {
          \uC774\uB984: x.\uC774\uB984,
          \uC810\uC218: x.\uC810\uC218,
          \uAE30\uB85D: x.\uAE30\uB85D,
          \uB4F1\uC218,
          \uB098: x.\uC774\uB984 === s_(\uC774\uB984)
        };
      });
    }
    var out = { ok: true, \uC624\uB298\uD310, \uAC8C\uC784: [] };
    Object.keys(\uAC8C\uC784\uC774\uB984).forEach(function(\uC885) {
      var \uB0B4\uAC83 = \uCD5C\uACE0[\uC885 + "|" + s_(\uC774\uB984)];
      out.\uAC8C\uC784.push({
        \uD0A4: \uC885,
        \uC774\uB984: \uAC8C\uC784\uC774\uB984[\uC885],
        \uB0B4\uCD5C\uACE0: \uB0B4\uAC83 ? \uB0B4\uAC83.\uC810\uC218 : 0,
        \uC804\uCCB4: \uC904\uC138\uC6B0\uAE30(\uC885)
      });
    });
    return out;
  }
  var \uB2E8\uC5B4\uC218\uB9F5_ = null;
  function \uB2E8\uC5B4\uC218_(\uB2E8\uC5B4\uC7A5) {
    if (!\uB2E8\uC5B4\uC218\uB9F5_) {
      \uB2E8\uC5B4\uC218\uB9F5_ = {};
      \uB2E8\uC5B4\uC7A5\uBAA9\uB85D().forEach(function(b) {
        \uB2E8\uC5B4\uC218\uB9F5_[b.\uC774\uB984] = b.\uAC1C\uC218;
      });
    }
    var n = \uB2E8\uC5B4\uC218\uB9F5_[s_(\uB2E8\uC5B4\uC7A5)];
    return n > 0 ? n : 0;
  }
  function \uBC94\uC704\uC774\uB984\uB4E4_(\uB2E8\uC5B4\uC7A5, \uC2DC\uC791, \uB05D) {
    \uC2DC\uC791 = Number(\uC2DC\uC791) || 1;
    \uB05D = Number(\uB05D) || 0;
    var \uBAA9\uB85D = [\uC2DC\uC791 + "~" + \uB05D];
    var n = \uB2E8\uC5B4\uC218_(\uB2E8\uC5B4\uC7A5);
    if (n) {
      var a = Math.max(1, \uC2DC\uC791), b = Math.min(n, \uB05D);
      if (a > b) {
        var t = a;
        a = b;
        b = t;
      }
      var \uC790\uB978 = a + "~" + b;
      if (\uBAA9\uB85D.indexOf(\uC790\uB978) < 0) \uBAA9\uB85D.push(\uC790\uB978);
    }
    return \uBAA9\uB85D;
  }
  var \uC7AC\uC751\uC2DC\uAE30\uBCF8 = 2;
  var \uC7AC\uC751\uC2DC\uC2DC\uD2B8\uC774\uB984 = "\uC7AC\uC751\uC2DC";
  function \uB2E8\uACC4\uC815\uB9AC_(v) {
    var t = s_(v);
    return t === "\uC5F0\uC2B5" || t === "\uC2DC\uD5D8" ? t : "";
  }
  function \uC751\uC2DC\uD45C_(\uC774\uB984) {
    var \uD45C = {};
    [SHEET.\uAE30\uB85D, SHEET.\uAE30\uB85D\uBCF4\uAD00].forEach(function(name) {
      var r = [];
      try {
        r = \uC77D\uAE30\uCE90\uC2DC_(name);
      } catch (e) {
        return;
      }
      r.forEach(function(x, i) {
        if (!(x[0] instanceof Date2)) return;
        if (s_(x[14]) === \uC7AC\uC2DC\uD5D8\uD45C\uC2DC) return;
        if (\uC774\uB984 !== void 0 && \uC774\uB984 !== null && s_(x[2]) !== s_(\uC774\uB984)) return;
        var k = s_(x[2]) + "|" + s_(x[3]) + "|" + s_(x[4]);
        (\uD45C[k] = \uD45C[k] || []).push({
          \uB54C: x[0].getTime(),
          \uC810\uC218: Number(x[8]) || 0,
          \uD2C0\uB9B0: \uD2C0\uB9B0\uCE78\uD480\uAE30_(x[13]),
          /* 더 — 전문이 필요하다: 다섯 개가 넘거나, 「be - was / were - been」 처럼 빗금 낀 낱말이 있으면
             (짧은 칸에서는 빗금에서 둘로 갈라져 다시 연습에서 빠진다) */
          \uB354: \uD2C0\uB9B0\uCE78\uB098\uB204\uAE30_(x[13]).\uB354 || (/\s\/\s/.test(s_(x[13])) ? 1 : 0),
          \uC2DC\uD2B8: name,
          \uC904: i + 2
        });
      });
    });
    Object.keys(\uD45C).forEach(function(k) {
      \uD45C[k].sort(function(a, b) {
        return a.\uB54C - b.\uB54C;
      });
    });
    return \uD45C;
  }
  function \uC751\uC2DC\uB4E4_(\uD45C, \uC774\uB984, \uB2E8\uC5B4\uC7A5, \uC2DC\uC791, \uB05D, \uCE78, \uB0B8\uB54C) {
    var \uC774\uB984\uB4E4 = s_(\uCE78) ? [s_(\uCE78) + " " + (Number(\uC2DC\uC791) || 1) + "~" + (Number(\uB05D) || 0)] : \uBC94\uC704\uC774\uB984\uB4E4_(\uB2E8\uC5B4\uC7A5, \uC2DC\uC791, \uB05D);
    var out = [];
    \uC774\uB984\uB4E4.forEach(function(n) {
      (\uD45C[s_(\uC774\uB984) + "|" + s_(\uB2E8\uC5B4\uC7A5) + "|" + n] || []).forEach(function(a) {
        if (!\uB0B8\uB54C || a.\uB54C >= \uB0B8\uB54C) out.push(a);
      });
    });
    out.sort(function(a, b) {
      return a.\uB54C - b.\uB54C;
    });
    return out;
  }
  function \uC7AC\uC751\uC2DC\uCD94\uAC00\uD45C_() {
    var \uD45C = {};
    var sh = null;
    try {
      sh = ss_().getSheetByName(\uC7AC\uC751\uC2DC\uC2DC\uD2B8\uC774\uB984);
    } catch (e) {
      sh = null;
    }
    if (!sh || sh.getLastRow() < 2) return \uD45C;
    sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().forEach(function(x) {
      var k = s_(x[1]) + "|" + (Number(x[3]) || 0);
      \uD45C[k] = (\uD45C[k] || 0) + (Number(x[4]) || 0);
    });
    return \uD45C;
  }
  function \uB2E8\uACC4\uC0C1\uD0DC_(\uB2E8\uACC4, \uD1B5\uACFC\uC810\uC218, \uC7AC\uC751\uC2DC, \uC751\uC2DC, \uB354\uC900) {
    var n = \uC751\uC2DC.length, \uB9C8\uC9C0\uB9C9 = n ? \uC751\uC2DC[n - 1] : null;
    if (\uB2E8\uACC4 === "\uC5F0\uC2B5") return { \uC644\uB8CC: n > 0, \uC751\uC2DC\uC218: n, \uB9C8\uC9C0\uB9C9\uC810\uC218: \uB9C8\uC9C0\uB9C9 ? \uB9C8\uC9C0\uB9C9.\uC810\uC218 : 0 };
    var \uCEF7 = s_(\uD1B5\uACFC\uC810\uC218) !== "" ? Number(\uD1B5\uACFC\uC810\uC218) || 0 : \uD569\uACA9\uC810_();
    var \uB2E4\uC2DC = s_(\uC7AC\uC751\uC2DC) !== "" ? Number(\uC7AC\uC751\uC2DC) || 0 : \uC7AC\uC751\uC2DC\uAE30\uBCF8;
    var \uD5C8\uC6A9 = 1 + \uB2E4\uC2DC + (Number(\uB354\uC900) || 0);
    return {
      \uC644\uB8CC: !!(\uB9C8\uC9C0\uB9C9 && \uB9C8\uC9C0\uB9C9.\uC810\uC218 >= \uCEF7),
      \uC751\uC2DC\uC218: n,
      \uB9C8\uC9C0\uB9C9\uC810\uC218: \uB9C8\uC9C0\uB9C9 ? \uB9C8\uC9C0\uB9C9.\uC810\uC218 : 0,
      \uB9C8\uC9C0\uB9C9\uD2C0\uB9B0: \uB9C8\uC9C0\uB9C9 ? \uB9C8\uC9C0\uB9C9.\uD2C0\uB9B0 : [],
      \uD1B5\uACFC\uC810\uC218: \uCEF7,
      \uB0A8\uC740\uC751\uC2DC: Math.max(0, \uD5C8\uC6A9 - n),
      /* 틀린 게 다섯 개 넘으면 짧은 칸엔 다섯 개뿐 — 다시 연습이 그 한 줄 메모(틀린전문)를 가져간다 */
      \uB9C8\uC9C0\uB9C9\uD2C0\uB9B0\uB354: \uB9C8\uC9C0\uB9C9 ? \uB9C8\uC9C0\uB9C9.\uB354 || 0 : 0,
      \uB9C8\uC9C0\uB9C9\uC790\uB9AC: \uB9C8\uC9C0\uB9C9 && \uB9C8\uC9C0\uB9C9.\uC904 ? { \uC2DC\uD2B8: \uB9C8\uC9C0\uB9C9.\uC2DC\uD2B8, \uC904: \uB9C8\uC9C0\uB9C9.\uC904, \uD0A4: \uB9C8\uC9C0\uB9C9.\uB54C } : null
    };
  }
  function \uC7AC\uC751\uC2DC\uB354\uC8FC\uAE30(\uBE44\uBC88, \uD589, \uC774\uB984, \uBA87) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var sh = sheet_(SHEET.\uC219\uC81C);
    var n = Number(\uD589);
    if (!(n >= 2 && n <= sh.getLastRow())) return { ok: false, \uBA54\uC2DC\uC9C0: "\uC774\uBBF8 \uC9C0\uC6CC\uC9C4 \uC219\uC81C\uC785\uB2C8\uB2E4" };
    var x = sh.getRange(n, 1, 1, 3).getValues()[0];
    var \uB4F1\uB85D = sh.getRange(n, 7).getValue();
    var \uB0B8\uB54C = \uB4F1\uB85D instanceof Date2 ? \uB4F1\uB85D.getTime() : 0;
    var ss = ss_();
    var \uC7AC = ss.getSheetByName(\uC7AC\uC751\uC2DC\uC2DC\uD2B8\uC774\uB984);
    if (!\uC7AC) {
      \uC7AC = ss.insertSheet(\uC7AC\uC751\uC2DC\uC2DC\uD2B8\uC774\uB984);
      \uC7AC.getRange(1, 1, 1, 5).setValues([["\uC900 \uB54C", "\uC774\uB984", "\uB2E8\uC5B4\uC7A5", "\uC219\uC81C \uB0B8 \uB54C", "\uB354 \uC900 \uC218"]]).setFontWeight("bold").setBackground("#EFF3F9");
      \uC7AC.setFrozenRows(1);
    }
    \uC7AC.getRange(\uC7AC.getLastRow() + 1, 1, 1, 5).setValues([[new Date2(), s_(\uC774\uB984), s_(x[1]), \uB0B8\uB54C, Number(\uBA87) || 1]]);
    return { ok: true, \uC219\uC81C\uBAA9\uB85D: \uC804\uCCB4\uC219\uC81C() };
  }
  function \uAE30\uB85D\uCC3E\uAE30_(\uB9F5, \uC774\uB984\uC55E, \uB2E8\uC5B4\uC7A5, \uC2DC\uC791, \uB05D, \uCE78) {
    var \uC774\uB984\uB4E4 = s_(\uCE78) ? [s_(\uCE78) + " " + (Number(\uC2DC\uC791) || 1) + "~" + (Number(\uB05D) || 0)] : \uBC94\uC704\uC774\uB984\uB4E4_(\uB2E8\uC5B4\uC7A5, \uC2DC\uC791, \uB05D);
    for (var i = 0; i < \uC774\uB984\uB4E4.length; i++) {
      var v = \uB9F5[\uC774\uB984\uC55E + \uB2E8\uC5B4\uC7A5 + "|" + \uC774\uB984\uB4E4[i]];
      if (v) return v;
    }
    return null;
  }
  function \uC219\uC81C\uC885\uB958_(v) {
    var t = s_(v);
    if (t === "\uBCF4\uCDA9") return "\uBCF4\uCDA9";
    if (t === "\uC2DC\uD5D8") return "\uC2DC\uD5D8";
    if (t === "\uAE30\uD55C") return "\uAE30\uD55C";
    return "\uB2F9\uC77C";
  }
  function \uB2F9\uC77C\uCE58\uAE30_(\uC885\uB958) {
    return \uC885\uB958 === "\uB2F9\uC77C" || \uC885\uB958 === "\uBCF4\uCDA9";
  }
  function \uD55C\uBC88\uB9CC_(\uC885\uB958) {
    return \uC885\uB958 === "\uC2DC\uD5D8";
  }
  function \uC2DC\uD5D8\uC778\uAC00_(h) {
    return !!h && \uC219\uC81C\uC885\uB958_(h.\uC885\uB958) === "\uC2DC\uD5D8";
  }
  function \uC219\uC81C\uC778\uAC00_(h) {
    return !\uC2DC\uD5D8\uC778\uAC00_(h);
  }
  var \uAD50\uC7AC\uB9F5\uC804\uCCB4_ = {};
  function \uC804\uCCB4\uC219\uC81C() {
    return \uC77D\uB294\uB3D9\uC548_(function() {
      var r = rows_(SHEET.\uC219\uC81C);
      var \uB2E8\uACC4\uC788\uB2E4 = r.some(function(x) {
        return \uB2E8\uACC4\uC815\uB9AC_(x.length > 13 ? x[13] : "");
      });
      var \uB9E5 = \uC219\uC81C\uB9E5\uB77D_({ \uC751\uC2DC: \uB2E8\uACC4\uC788\uB2E4 ? \uC751\uC2DC\uD45C_() : {}, \uB354\uC900\uD45C: \uB2E8\uACC4\uC788\uB2E4 ? \uC7AC\uC751\uC2DC\uCD94\uAC00\uD45C_() : {}, \uC644\uB8CC: \uC644\uB8CC\uC810\uC218\uB4E4_() });
      return r.map(function(x, i) {
        return \uC219\uC81C\uC904_(x, i + 2, \uB9E5);
      });
    });
  }
  function \uC219\uC81C\uB9E5\uB77D_(\uAE30\uB85D) {
    \uAD50\uC7AC\uB9F5\uC804\uCCB4_ = \uAD50\uC7AC\uB9F5_();
    var \uC0C9\uB9F5 = {};
    \uB2E8\uC5B4\uC7A5\uBAA9\uB85D().forEach(function(b) {
      \uC0C9\uB9F5[b.\uC774\uB984] = b.\uC0C9;
    });
    return {
      today: ymd_(new Date2()),
      \uC0C9\uB9F5,
      \uC804\uCCB4: \uC804\uCCB4\uBA85\uB2E8_(),
      \uBC18\uD559\uC0DD: \uBC18\uBCC4\uBA85\uB2E8_(),
      \uC751\uC2DC: \uAE30\uB85D.\uC751\uC2DC || {},
      \uB354\uC900\uD45C: \uAE30\uB85D.\uB354\uC900\uD45C || {},
      \uC644\uB8CC: \uAE30\uB85D.\uC644\uB8CC || {}
    };
  }
  function \uC219\uC81C\uC904_(x, \uD589, \uB9E5) {
    var today = \uB9E5.today, \uC0C9\uB9F5 = \uB9E5.\uC0C9\uB9F5, \uC804\uCCB4 = \uB9E5.\uC804\uCCB4, \uBC18\uD559\uC0DD = \uB9E5.\uBC18\uD559\uC0DD;
    var \uC751\uC2DC = \uB9E5.\uC751\uC2DC, \uB354\uC900\uD45C = \uB9E5.\uB354\uC900\uD45C, \uC644\uB8CC = \uB9E5.\uC644\uB8CC;
    var \uB9C8\uAC10 = x[5] instanceof Date2 ? ymd_(x[5]) : s_(x[5]);
    var \uBC18 = s_(x[0]), \uB2E8\uC5B4\uC7A5 = s_(x[1]);
    var \uC2DC\uC791 = Number(x[2]) || 1, \uB05D = Number(x[3]) || 0;
    var \uB300\uC0C1\uD559\uC0DD = s_(x[7]);
    var \uC885\uB958 = s_(x[8]) ? \uC219\uC81C\uC885\uB958_(x[8]) : \uB9C8\uAC10 === today ? "\uB2F9\uC77C" : "\uAE30\uD55C";
    var \uB4F1\uB85D = x[6] instanceof Date2 ? ymd_(x[6]) : "";
    var \uBC94\uC704 = \uC2DC\uC791 + "~" + \uB05D;
    var \uB300\uC0C1\uB4E4 = \uC219\uC81C\uB300\uC0C1_(
      { \uBC18, \uB2E8\uC5B4\uC7A5, \uD559\uC0DD: \uB300\uC0C1\uD559\uC0DD },
      \uC804\uCCB4,
      \uAD50\uC7AC\uB9F5\uC804\uCCB4_,
      \uBC18\uD559\uC0DD
    );
    var \uAD50\uC7AC\uB4E4 = {};
    \uB300\uC0C1\uB4E4.forEach(function(\uC774\uB984) {
      (\uAD50\uC7AC\uB9F5\uC804\uCCB4_[\uC774\uB984] || []).forEach(function(t) {
        if (t) \uAD50\uC7AC\uB4E4[t] = 1;
      });
    });
    var \uD310\uB2E8\uB0A0 = \uB9C8\uAC10 || \uB4F1\uB85D || today;
    var \uC548\uD55C\uC0AC\uB78C = [], \uD55C\uC0AC\uB78C = [], \uBAA8\uC790\uB780\uC0AC\uB78C = [], \uB9C9\uD78C\uC0AC\uB78C = [], \uC810\uC218\uB4E4 = [];
    var \uB2E8\uACC4 = \uB2E8\uACC4\uC815\uB9AC_(x.length > 13 ? x[13] : "");
    var \uB0B8\uB54C = x[6] instanceof Date2 ? x[6].getTime() : 0;
    \uB300\uC0C1\uB4E4.forEach(function(\uC774\uB984) {
      if (\uB2E8\uACC4) {
        var \uC0C1 = \uB2E8\uACC4\uC0C1\uD0DC_(
          \uB2E8\uACC4,
          x.length > 14 ? x[14] : "",
          x.length > 15 ? x[15] : "",
          \uC751\uC2DC\uB4E4_(\uC751\uC2DC, \uC774\uB984, \uB2E8\uC5B4\uC7A5, \uC2DC\uC791, \uB05D, x.length > 11 ? x[11] : "", \uB0B8\uB54C),
          \uB354\uC900\uD45C[\uC774\uB984 + "|" + \uB0B8\uB54C]
        );
        if (\uC0C1.\uC644\uB8CC) {
          \uD55C\uC0AC\uB78C.push(\uC774\uB984);
          return;
        }
        \uC548\uD55C\uC0AC\uB78C.push(\uC774\uB984);
        if (\uC0C1.\uC751\uC2DC\uC218) \uBAA8\uC790\uB780\uC0AC\uB78C.push(\uC774\uB984);
        if (\uB2E8\uACC4 === "\uC2DC\uD5D8" && \uC0C1.\uC751\uC2DC\uC218 && !\uC0C1.\uB0A8\uC740\uC751\uC2DC) \uB9C9\uD78C\uC0AC\uB78C.push(\uC774\uB984);
        return;
      }
      var \uB0A0\uB4E4 = \uAE30\uB85D\uCC3E\uAE30_(\uC644\uB8CC, \uC774\uB984 + "|", \uB2E8\uC5B4\uC7A5, \uC2DC\uC791, \uB05D, x.length > 11 ? x[11] : "");
      if (\uD55C\uBC88\uB9CC_(\uC885\uB958)) {
        var \uBCF8\uAC83 = \uD47C\uAC83_(\uB0A0\uB4E4, \uC885\uB958, \uB4F1\uB85D, \uD310\uB2E8\uB0A0, 0);
        if (\uBCF8\uAC83) \uC810\uC218\uB4E4.push(Number(\uBCF8\uAC83.\uC810\uC218) || 0);
      }
      if (\uB0B8\uAC83_(\uB0A0\uB4E4, \uC885\uB958, \uB4F1\uB85D, \uD310\uB2E8\uB0A0)) {
        \uD55C\uC0AC\uB78C.push(\uC774\uB984);
        return;
      }
      \uC548\uD55C\uC0AC\uB78C.push(\uC774\uB984);
      if (\uD47C\uAC83_(\uB0A0\uB4E4, \uC885\uB958, \uB4F1\uB85D, \uD310\uB2E8\uB0A0, 0)) \uBAA8\uC790\uB780\uC0AC\uB78C.push(\uC774\uB984);
    });
    var \uC904 = {
      \uD589,
      \uB2E8\uC5B4\uC7A5,
      \uC2DC\uC791,
      \uB05D,
      \uC720\uD615: s_(x[4]) || "\uC2A4\uD3A0\uB9C1",
      \uB9C8\uAC10\uC77C: \uB9C8\uAC10,
      \uD559\uC0DD: \uB300\uC0C1\uD559\uC0DD,
      \uC0C9: \uC0C9\uB9F5[\uB2E8\uC5B4\uC7A5] || "",
      \uC885\uB958,
      \uC9C0\uB0A8: !!(\uB9C8\uAC10 && \uB9C8\uAC10 < today),
      \uB300\uC0C1\uC218: \uB300\uC0C1\uB4E4.length,
      \uAD50\uC7AC\uB4E4: Object.keys(\uAD50\uC7AC\uB4E4),
      \uD55C\uC0AC\uB78C,
      \uC548\uD55C\uC0AC\uB78C,
      \uBAA8\uC790\uB780\uC0AC\uB78C,
      \uD569\uACA9\uC810: \uD569\uACA9\uCEF7_(\uC885\uB958),
      \uC218\uC5C5: s_(x.length > 9 ? x[9] : ""),
      \uC21C\uC11C: Number(x.length > 10 ? x[10] : 0) || 0,
      \uCE78: s_(x.length > 11 ? x[11] : ""),
      \uC81C\uD55C\uC2DC\uAC04: \uC219\uC81C\uC2DC\uAC04_(x, \uC885\uB958).\uC81C\uD55C\uC2DC\uAC04,
      \uC678\uC6B0\uAE30\uBD84: \uC219\uC81C\uC2DC\uAC04_(x, \uC885\uB958).\uC678\uC6B0\uAE30\uBD84,
      \uB0B8\uB54C: x[6] instanceof Date2 ? x[6].getTime() : 0,
      // 줄번호가 밀렸는지 숙제수정이 맞춰 본다
      \uB2E8\uACC4,
      \uD1B5\uACFC\uC810\uC218: s_(x.length > 14 ? x[14] : ""),
      \uC7AC\uC751\uC2DC: s_(x.length > 15 ? x[15] : ""),
      \uB9C9\uD78C\uC0AC\uB78C,
      \uD559\uBD80\uBAA8\uC228\uAE40: (x.length > 17 ? s_(x[17]) : "") === "1",
      \uB4F1\uB85D\uC77C: \uB4F1\uB85D
    };
    if (\uD55C\uBC88\uB9CC_(\uC885\uB958)) \uC904.\uD3C9\uADE0 = \uC810\uC218\uB4E4.length ? Math.round(\uC810\uC218\uB4E4.reduce(function(a, b) {
      return a + b;
    }, 0) / \uC810\uC218\uB4E4.length) : null;
    return \uC904;
  }
  function \uC0C8\uC219\uC81C\uC904_(x, \uD589) {
    return \uC77D\uB294\uB3D9\uC548_(function() {
      var \uB2E8\uACC4 = \uB2E8\uACC4\uC815\uB9AC_(x.length > 13 ? x[13] : "");
      var \uC644\uB8CC = \uB2E8\uACC4 ? {} : \uC644\uB8CC\uC810\uC218\uB4E4_(void 0, \uC624\uB298\uAE30\uB85D\uC904_());
      return \uC219\uC81C\uC904_(x, \uD589, \uC219\uC81C\uB9E5\uB77D_({ \uC644\uB8CC }));
    });
  }
  function \uC624\uB298\uAE30\uB85D\uC904_() {
    if (\uC77D\uC740\uAC83_ && \uC77D\uC740\uAC83_.\uC624\uB298\uAE30\uB85D) return \uC77D\uC740\uAC83_.\uC624\uB298\uAE30\uB85D;
    var \uC624\uB298 = new Date2();
    \uC624\uB298.setHours(0, 0, 0, 0);
    var \uC904\uB4E4 = [];
    try {
      \uC904\uB4E4 = \uCD5C\uADFC\uAE30\uB85D\uC904_(sheet_(SHEET.\uAE30\uB85D), \uC624\uB298).map(function(z) {
        return z.x;
      });
    } catch (e) {
      \uC904\uB4E4 = [];
    }
    if (\uC77D\uC740\uAC83_) \uC77D\uC740\uAC83_.\uC624\uB298\uAE30\uB85D = \uC904\uB4E4;
    return \uC904\uB4E4;
  }
  function \uBBF8\uC81C\uCD9C\uC2DC\uD2B8(\uBE44\uBC88) {
    if (\uBE44\uBC88 !== void 0 && !\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET.\uBBF8\uC81C\uCD9C);
    if (!sh) sh = ss.insertSheet(SHEET.\uBBF8\uC81C\uCD9C);
    sh.clear();
    var H = HEADERS.\uBBF8\uC81C\uCD9C;
    sh.getRange(1, 1, 1, H.length).setValues([H]).setFontWeight("bold").setBackground("#EFF3F9");
    sh.setFrozenRows(1);
    var \uC0C9\uB9F5 = {};
    \uB2E8\uC5B4\uC7A5\uBAA9\uB85D().forEach(function(b) {
      \uC0C9\uB9F5[b.\uC774\uB984] = b.\uC0C9;
    });
    var \uBAA9\uB85D = \uC804\uCCB4\uC219\uC81C().filter(function(h) {
      return \uC219\uC81C\uC778\uAC00_(h) && h.\uC548\uD55C\uC0AC\uB78C.length > 0;
    });
    \uBAA9\uB85D.sort(function(a, b) {
      if (a.\uC9C0\uB0A8 !== b.\uC9C0\uB0A8) return a.\uC9C0\uB0A8 ? 1 : -1;
      if (a.\uB2E8\uC5B4\uC7A5 !== b.\uB2E8\uC5B4\uC7A5) return a.\uB2E8\uC5B4\uC7A5 < b.\uB2E8\uC5B4\uC7A5 ? -1 : 1;
      return (a.\uB9C8\uAC10\uC77C || "") < (b.\uB9C8\uAC10\uC77C || "") ? -1 : 1;
    });
    if (!\uBAA9\uB85D.length) {
      sh.getRange(2, 1).setValue("\uC548 \uD55C \uD559\uC0DD\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uBAA8\uB450 \uC81C\uCD9C\uD588\uC5B4\uC694.");
      sh.autoResizeColumns(1, H.length);
      return { ok: true, \uAC74\uC218: 0 };
    }
    var \uAC12 = [], \uBC30\uACBD = [], \uBA54\uBAA8 = [];
    \uBAA9\uB85D.forEach(function(h) {
      var \uC774\uB984\uB4E4 = h.\uC548\uD55C\uC0AC\uB78C;
      var \uBCF4\uC774\uAE30 = \uC774\uB984\uB4E4.slice(0, 8).join(", ") + (\uC774\uB984\uB4E4.length > 8 ? " \u2026\uC678 " + (\uC774\uB984\uB4E4.length - 8) + "\uBA85" : "");
      \uAC12.push([
        h.\uC9C0\uB0A8 ? "\uB9C8\uAC10 \uC9C0\uB0A8" : \uB2F9\uC77C\uCE58\uAE30_(h.\uC885\uB958) ? "\uC624\uB298\uAE4C\uC9C0" : "\uC9C4\uD589 \uC911",
        h.\uBC18,
        h.\uB2E8\uC5B4\uC7A5,
        h.\uC2DC\uC791 + "~" + h.\uB05D + "\uBC88",
        h.\uC720\uD615,
        h.\uC885\uB958,
        h.\uB9C8\uAC10\uC77C || "",
        h.\uB300\uC0C1\uC218,
        h.\uD55C\uC0AC\uB78C.length,
        \uC774\uB984\uB4E4.length,
        \uBCF4\uC774\uAE30
      ]);
      var bg = h.\uC0C9 ? \uC5F0\uD55C\uC0C9_(h.\uC0C9, 0.86) : "#FFFFFF";
      \uBC30\uACBD.push(H.map(function() {
        return bg;
      }));
      var m = H.map(function() {
        return "";
      });
      m[10] = "\uC548 \uD55C \uD559\uC0DD " + \uC774\uB984\uB4E4.length + "\uBA85\n" + \uC774\uB984\uB4E4.join(", ");
      if (h.\uBAA8\uC790\uB780\uC0AC\uB78C && h.\uBAA8\uC790\uB780\uC0AC\uB78C.length) {
        m[10] += "\n\n\uD480\uC5C8\uC9C0\uB9CC " + h.\uD569\uACA9\uC810 + "\uC810\uC744 \uBABB \uB118\uAE34 \uD559\uC0DD " + h.\uBAA8\uC790\uB780\uC0AC\uB78C.length + "\uBA85\n" + h.\uBAA8\uC790\uB780\uC0AC\uB78C.join(", ");
      }
      if (h.\uD55C\uC0AC\uB78C.length) m[8] = "\uB0B8 \uD559\uC0DD\n" + h.\uD55C\uC0AC\uB78C.join(", ");
      \uBA54\uBAA8.push(m);
    });
    var rng = sh.getRange(2, 1, \uAC12.length, H.length);
    rng.setValues(\uAC12);
    rng.setBackgrounds(\uBC30\uACBD);
    rng.setNotes(\uBA54\uBAA8);
    rng.setVerticalAlignment("middle");
    sh.getRange(2, 11, \uAC12.length, 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
    sh.autoResizeColumns(1, H.length);
    sh.setColumnWidth(11, 320);
    if (!sh.getFilter()) sh.getRange(1, 1, \uAC12.length + 1, H.length).createFilter();
    var \uCD1D = 0;
    \uBAA9\uB85D.forEach(function(h) {
      \uCD1D += h.\uC548\uD55C\uC0AC\uB78C.length;
    });
    return { ok: true, \uAC74\uC218: \uBAA9\uB85D.length, \uC778\uC6D0: \uCD1D };
  }
  function \uBBF8\uC81C\uCD9C\uC815\uB9AC() {
    var r = \uBBF8\uC81C\uCD9C\uC2DC\uD2B8();
    var ui = SpreadsheetApp.getUi();
    SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.\uBBF8\uC81C\uCD9C)
    );
    ui.alert(r.\uAC74\uC218 ? "\uC219\uC81C " + r.\uAC74\uC218 + "\uAC74\uC5D0 \uC548 \uD55C \uD559\uC0DD\uC774 \uC788\uC2B5\uB2C8\uB2E4. (\uC5F0\uC778\uC6D0 " + r.\uC778\uC6D0 + "\uBA85)" : "\uC548 \uD55C \uD559\uC0DD\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uBAA8\uB450 \uC81C\uCD9C\uD588\uC5B4\uC694.");
  }
  function \uAD50\uC7AC\uD559\uC0DD_(\uAD50\uC7AC) {
    var t = s_(\uAD50\uC7AC);
    if (!t) return [];
    var out = [];
    \uC77D\uAE30\uCE90\uC2DC_(SHEET.\uD559\uC0DD).forEach(function(r) {
      var \uC774\uB984 = s_(r[1]);
      if (!\uC774\uB984) return;
      if (\uC904\uAD50\uC7AC_(r).indexOf(t) > -1) out.push(\uC774\uB984);
    });
    return out;
  }
  function \uAD50\uC7AC\uB300\uC0C1(\uBE44\uBC88, \uAD50\uC7AC) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    var \uD559\uC0DD = \uAD50\uC7AC\uD559\uC0DD_(\uAD50\uC7AC);
    return { ok: true, \uAD50\uC7AC: s_(\uAD50\uC7AC), \uC778\uC6D0: \uD559\uC0DD.length, \uD559\uC0DD };
  }
  function \uC219\uC81C\uB4F1\uB85D(\uBE44\uBC88, h) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    return \uC77D\uB294\uB3D9\uC548_(function() {
      return \uC219\uC81C\uB4F1\uB85D\uC548_(h);
    });
  }
  function \uC219\uC81C\uB4F1\uB85D\uC548_(h) {
    var \uC885\uB958 = \uC219\uC81C\uC885\uB958_(h.\uC885\uB958);
    var \uB9C8\uAC10 = \uC885\uB958 === "\uAE30\uD55C" || \uC885\uB958 === "\uC2DC\uD5D8" ? s_(h.\uB9C8\uAC10\uC77C) : ymd_(new Date2());
    var \uB2E8\uC5B4\uC7A5 = s_(h.\uB2E8\uC5B4\uC7A5) || s_(h.\uAD50\uC7AC);
    if (!\uB2E8\uC5B4\uC7A5) return { ok: false, \uBA54\uC2DC\uC9C0: "\uB2E8\uC5B4\uC7A5\uC744 \uACE8\uB77C \uC8FC\uC138\uC694." };
    var \uC804\uCCB4 = \uC804\uCCB4\uBA85\uB2E8_();
    var \uACE0\uB978 = \uC774\uB984\uB4E4\uD480\uAE30_(h.\uD559\uC0DD\uB4E4 && h.\uD559\uC0DD\uB4E4.length ? h.\uD559\uC0DD\uB4E4 : h.\uD559\uC0DD).filter(function(n) {
      return \uC804\uCCB4.indexOf(n) > -1;
    });
    if (!\uACE0\uB978.length && !\uAD50\uC7AC\uD559\uC0DD_(\uB2E8\uC5B4\uC7A5).length) {
      return { ok: false, \uBA54\uC2DC\uC9C0: "\u201C" + \uB2E8\uC5B4\uC7A5 + "\u201D \uC744(\uB97C) \uBC30\uC6B0\uB294 \uD559\uC0DD\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uD559\uC0DD \uBA85\uB2E8\uC5D0\uC11C \uAD50\uC7AC\uB97C \uBA3C\uC800 \uC8FC\uC2DC\uAC70\uB098, \uBC1B\uC744 \uD559\uC0DD\uC744 \uACE8\uB77C \uC8FC\uC138\uC694." };
    }
    var sh = sheet_(SHEET.\uC219\uC81C);
    var \uC904 = [[
      "",
      \uB2E8\uC5B4\uC7A5,
      Number(h.\uC2DC\uC791) || 1,
      Number(h.\uB05D) || 0,
      s_(h.\uC720\uD615) || "\uC2A4\uD3A0\uB9C1",
      \uB9C8\uAC10,
      new Date2(),
      \uACE0\uB978.join(", "),
      \uC885\uB958,
      s_(h.\uC218\uC5C5),
      Number(h.\uC21C\uC11C) || 0,
      s_(h.\uCE78),
      // 칸 — 과 단어장의 구분 (옛 단어장은 빈칸)
      Number(h.\uC81C\uD55C\uC2DC\uAC04) > 0 ? Math.round(Number(h.\uC81C\uD55C\uC2DC\uAC04)) : "",
      // 제한시간(분) — 비면 제한 없음
      \uB2E8\uACC4\uC815\uB9AC_(h.\uB2E8\uACC4),
      // 연습 · 시험 — 비면 옛 숙제 그대로
      \uB2E8\uACC4\uC815\uB9AC_(h.\uB2E8\uACC4) === "\uC2DC\uD5D8" && s_(h.\uD1B5\uACFC\uC810\uC218) !== "" ? Number(h.\uD1B5\uACFC\uC810\uC218) || 0 : "",
      \uB2E8\uACC4\uC815\uB9AC_(h.\uB2E8\uACC4) === "\uC2DC\uD5D8" && s_(h.\uC7AC\uC751\uC2DC) !== "" ? Number(h.\uC7AC\uC751\uC2DC) || 0 : "",
      Number(h.\uC678\uC6B0\uAE30\uBD84) > 0 ? Math.round(Number(h.\uC678\uC6B0\uAE30\uBD84)) : ""
      // 외우기분 — 비면 외우기 없이 바로 시험
    ]];
    \uC219\uC81C\uCE78\uD655\uBCF4_(sh);
    var lock = null;
    try {
      lock = LockService.getScriptLock();
      lock.waitLock(1e4);
    } catch (e) {
      lock = null;
    }
    var \uC0C8\uD589;
    try {
      \uC0C8\uD589 = sh.getLastRow() + 1;
      sh.getRange(\uC0C8\uD589, 1, 1, 17).setValues(\uC904);
    } finally {
      if (lock) try {
        lock.releaseLock();
      } catch (e) {
      }
    }
    var \uC801\uD78C = sh.getRange(\uC0C8\uD589, 1, 1, 17).getValues()[0];
    var \uB2F5 = { ok: true, \uAC1C\uC218: 1, \uB300\uC0C1: \uACE0\uB978.length || \uAD50\uC7AC\uD559\uC0DD_(\uB2E8\uC5B4\uC7A5).length, \uC219\uC81C: \uC0C8\uC219\uC81C\uC904_(\uC801\uD78C, \uC0C8\uD589) };
    if (!h.\uBC14\uB010\uC904\uB9CC) \uB2F5.\uC219\uC81C\uBAA9\uB85D = \uC804\uCCB4\uC219\uC81C();
    return \uB2F5;
  }
  var \uC61B\uC2DC\uD5D8\uC2DC\uAC04\uCE90\uC2DC_ = null;
  function \uC61B\uC2DC\uD5D8\uC2DC\uAC04_() {
    if (\uC61B\uC2DC\uD5D8\uC2DC\uAC04\uCE90\uC2DC_) return \uC61B\uC2DC\uD5D8\uC2DC\uAC04\uCE90\uC2DC_;
    function \uBD84(\uD0A4, \uAE30\uBCF8) {
      var n = Number(setting_(\uD0A4, \uAE30\uBCF8));
      return isFinite(n) && n >= 0 && n <= 180 ? Math.round(n) : \uAE30\uBCF8;
    }
    \uC61B\uC2DC\uD5D8\uC2DC\uAC04\uCE90\uC2DC_ = { \uC678\uC6B0\uAE30: \uBD84("\uC678\uC6B0\uAE30\uC2DC\uAC04\uBD84", \uAE30\uBCF8\uC678\uC6B0\uAE30\uBD84), \uC2DC\uD5D8: \uBD84("\uC2DC\uD5D8\uC2DC\uAC04\uBD84", \uAE30\uBCF8\uC2DC\uD5D8\uBD84) };
    return \uC61B\uC2DC\uD5D8\uC2DC\uAC04\uCE90\uC2DC_;
  }
  function \uC219\uC81C\uC2DC\uAC04_(x, \uC885\uB958) {
    var \uC81C\uD55C = Number(x.length > 12 ? x[12] : 0) || 0, \uC678 = Number(x.length > 16 ? x[16] : 0) || 0;
    if (\uC885\uB958 === "\uC2DC\uD5D8" && x.length <= 16) {
      var \uC61B = \uC61B\uC2DC\uD5D8\uC2DC\uAC04_();
      \uC678 = \uC61B.\uC678\uC6B0\uAE30;
      if (!\uC81C\uD55C) \uC81C\uD55C = \uC61B.\uC2DC\uD5D8;
    }
    return { \uC81C\uD55C\uC2DC\uAC04: \uC81C\uD55C, \uC678\uC6B0\uAE30\uBD84: \uC678 };
  }
  function \uC219\uC81C\uCE78\uD655\uBCF4_(sh) {
    sh = sh || sheet_(SHEET.\uC219\uC81C);
    if (!sh || typeof sh.getMaxColumns !== "function" || typeof sh.getRange !== "function") return sh;
    var \uD544\uC694 = HEADERS.\uC219\uC81C.length;
    if (sh.getMaxColumns() < \uD544\uC694) sh.insertColumnsAfter(sh.getMaxColumns(), \uD544\uC694 - sh.getMaxColumns());
    var \uBA38\uB9AC = sh.getRange(1, 1, 1, \uD544\uC694).getValues()[0];
    if (s_(\uBA38\uB9AC[16]) !== "\uC678\uC6B0\uAE30\uBD84" && sh.getLastRow() >= 2) {
      var n = sh.getLastRow() - 1, \uC61B = \uC61B\uC2DC\uD5D8\uC2DC\uAC04_();
      var \uC904\uB4E4 = sh.getRange(2, 1, n, 17).getValues(), \uBC14\uAFC8 = false;
      var \uC81C\uD55C\uCE78 = [], \uC678\uCE78 = [];
      \uC904\uB4E4.forEach(function(x) {
        var \uC2DC\uD5D8 = s_(x[8]) === "\uC2DC\uD5D8";
        var \uC81C = x[12], \uC678 = x[16];
        if (\uC2DC\uD5D8 && s_(\uC678) === "") {
          \uC678 = \uC61B.\uC678\uC6B0\uAE30 || "";
          \uBC14\uAFC8 = true;
        }
        if (\uC2DC\uD5D8 && s_(\uC81C) === "") {
          \uC81C = \uC61B.\uC2DC\uD5D8 || "";
          \uBC14\uAFC8 = true;
        }
        \uC81C\uD55C\uCE78.push([\uC81C]);
        \uC678\uCE78.push([\uC678]);
      });
      if (\uBC14\uAFC8) {
        sh.getRange(2, 13, n, 1).setValues(\uC81C\uD55C\uCE78);
        sh.getRange(2, 17, n, 1).setValues(\uC678\uCE78);
      }
    }
    var \uACE0\uCE60\uAE4C = false;
    for (var i = 0; i < \uD544\uC694; i++) {
      if (s_(\uBA38\uB9AC[i]) !== HEADERS.\uC219\uC81C[i]) {
        \uBA38\uB9AC[i] = HEADERS.\uC219\uC81C[i];
        \uACE0\uCE60\uAE4C = true;
      }
    }
    if (\uACE0\uCE60\uAE4C) {
      sh.getRange(1, 1, 1, \uD544\uC694).setValues([\uBA38\uB9AC]).setFontWeight("bold").setBackground("#EFF3F9");
    }
    return sh;
  }
  var \uCC98\uC74C\uC218\uC5C5\uD2C0_ = [
    {
      \uD0A4: "\uBCF8\uBB381",
      \uC774\uB984: "\uBCF8\uBB38 1\uD68C\uCC28",
      \uC124\uBA85: "\uB2E8\uC5B4 \uD655\uC778 \u2192 \uBCF8\uBB38 \uBE48\uCE78 \u2192 \uD574\uC11D \uBCF4\uACE0 \uC601\uC791",
      \uB2E8\uACC4: [
        { \uC885\uB958: "\uBCF4\uD1B5", \uC5B4\uB514: "\uB2E8\uC5B4", \uC720\uD615: "\uC2A4\uD3A0\uB9C1" },
        { \uC885\uB958: "\uBCF4\uD1B5", \uC5B4\uB514: "\uBCF8\uBB38", \uC720\uD615: "\uBE48\uCE78 \uCC44\uC6B0\uAE30" },
        { \uC885\uB958: "\uBCF4\uD1B5", \uC5B4\uB514: "\uBCF8\uBB38", \uC720\uD615: "\uC601\uC791" }
      ]
    },
    {
      \uD0A4: "\uBCF8\uBB38\uC815\uB9AC",
      \uC774\uB984: "\uBCF8\uBB38 \uCD1D\uC815\uB9AC",
      \uC124\uBA85: "\uBE48\uCE78 \u2192 \uC21C\uC11C \uB9DE\uCD94\uAE30 \u2192 \uC601\uC791 \u2192 \uB4E3\uACE0 \uC4F0\uAE30",
      \uB2E8\uACC4: [
        { \uC885\uB958: "\uBCF4\uD1B5", \uC5B4\uB514: "\uBCF8\uBB38", \uC720\uD615: "\uBE48\uCE78 \uCC44\uC6B0\uAE30" },
        { \uC885\uB958: "\uBCF4\uD1B5", \uC5B4\uB514: "\uBCF8\uBB38", \uC720\uD615: "\uC21C\uC11C \uB9DE\uCD94\uAE30" },
        { \uC885\uB958: "\uBCF4\uD1B5", \uC5B4\uB514: "\uBCF8\uBB38", \uC720\uD615: "\uC601\uC791" },
        { \uC885\uB958: "\uBCF4\uD1B5", \uC5B4\uB514: "\uBCF8\uBB38", \uC720\uD615: "\uB4E3\uACE0 \uC4F0\uAE30" }
      ]
    },
    {
      \uD0A4: "\uBB38\uBC95",
      \uC774\uB984: "\uBB38\uBC95 \uD655\uC778",
      \uC124\uBA85: "\uBB38\uBC95 \uBE48\uCE78 \u2192 \uBCF8\uBB38 \uBE48\uCE78 (\uC624\uB298 \uBC30\uC6B4 \uC5B4\uBC95 \uAD73\uD788\uAE30)",
      \uB2E8\uACC4: [
        { \uC885\uB958: "\uBCF4\uD1B5", \uC5B4\uB514: "\uBB38\uBC95", \uC720\uD615: "\uBE48\uCE78 \uCC44\uC6B0\uAE30" },
        { \uC885\uB958: "\uBCF4\uD1B5", \uC5B4\uB514: "\uBCF8\uBB38", \uC720\uD615: "\uBE48\uCE78 \uCC44\uC6B0\uAE30" }
      ]
    },
    {
      \uD0A4: "\uBCF8\uBB38\uBB38\uBC95",
      \uC774\uB984: "\uBCF8\uBB38 + \uBB38\uBC95 (\uD55C \uD68C\uCC28 \uC804\uCCB4)",
      \uC124\uBA85: "\uB2E8\uC5B4 \u2192 \uBCF8\uBB38 \uBE48\uCE78 \u2192 \uC601\uC791 \u2192 \uBB38\uBC95 \uBE48\uCE78",
      \uB2E8\uACC4: [
        { \uC885\uB958: "\uBCF4\uD1B5", \uC5B4\uB514: "\uB2E8\uC5B4", \uC720\uD615: "\uC2A4\uD3A0\uB9C1" },
        { \uC885\uB958: "\uBCF4\uD1B5", \uC5B4\uB514: "\uBCF8\uBB38", \uC720\uD615: "\uBE48\uCE78 \uCC44\uC6B0\uAE30" },
        { \uC885\uB958: "\uBCF4\uD1B5", \uC5B4\uB514: "\uBCF8\uBB38", \uC720\uD615: "\uC601\uC791" },
        { \uC885\uB958: "\uBCF4\uD1B5", \uC5B4\uB514: "\uBB38\uBC95", \uC720\uD615: "\uBE48\uCE78 \uCC44\uC6B0\uAE30" }
      ]
    },
    {
      \uD0A4: "\uB2E8\uC5B4\uC9D1\uC911",
      \uC774\uB984: "\uB2E8\uC5B4 \uC9D1\uC911",
      \uC124\uBA85: "4\uC9C0\uC120\uB2E4 \u2192 \uC2A4\uD3A0\uB9C1",
      \uB2E8\uACC4: [
        { \uC885\uB958: "\uBCF4\uD1B5", \uC5B4\uB514: "\uB2E8\uC5B4", \uC720\uD615: "4\uC9C0\uC120\uB2E4" },
        { \uC885\uB958: "\uBCF4\uD1B5", \uC5B4\uB514: "\uB2E8\uC5B4", \uC720\uD615: "\uC2A4\uD3A0\uB9C1" }
      ]
    },
    {
      \uD0A4: "\uC2DC\uD5D8\uB300\uBE44",
      \uC774\uB984: "\uC2DC\uD5D8 \uB300\uBE44",
      \uC124\uBA85: "\uB2E8\uC5B4 \uC2A4\uD3A0\uB9C1 \u2192 \uBCF8\uBB38 \uC601\uC791",
      \uB2E8\uACC4: [
        { \uC885\uB958: "\uBCF4\uD1B5", \uC5B4\uB514: "\uB2E8\uC5B4", \uC720\uD615: "\uC2A4\uD3A0\uB9C1" },
        { \uC885\uB958: "\uBCF4\uD1B5", \uC5B4\uB514: "\uBCF8\uBB38", \uC720\uD615: "\uC601\uC791" }
      ]
    }
  ];
  var \uC218\uC5C5\uCD08\uD45C_ = {
    "\uC2A4\uD3A0\uB9C1": 20,
    "\uCCAB \uAE00\uC790": 15,
    "\uB4E3\uACE0 \uC4F0\uAE30": 25,
    "4\uC9C0\uC120\uB2E4": 10,
    "\uB73B \uACE0\uB974\uAE30": 10,
    "\uD50C\uB798\uC2DC\uCE74\uB4DC": 8,
    "3\uB2E8\uBCC0\uD654": 30,
    "\uBCF8\uBB38|\uBE48\uCE78 \uCC44\uC6B0\uAE30": 40,
    "\uBCF8\uBB38|\uC601\uC791": 70,
    "\uBCF8\uBB38|\uC21C\uC11C \uB9DE\uCD94\uAE30": 50,
    "\uBCF8\uBB38|\uB4E3\uACE0 \uC4F0\uAE30": 60,
    "\uBB38\uBC95|\uBE48\uCE78 \uCC44\uC6B0\uAE30": 35
  };
  var \uCD94\uCC9C\uAE30\uB85D\uCD5C\uC18C_ = 5;
  var \uCD94\uCC9C\uC608\uC0B0\uAE30\uBCF8_ = 35;
  function \uC720\uD615\uC54C\uB9F9\uC774_(\uC720\uD615) {
    return String(\uC720\uD615 || "").replace(/\s*\(누적[^)]*\)\s*$/, "").trim();
  }
  function \uB204\uC801\uC778\uAC00_(\uC720\uD615) {
    return /\(누적/.test(String(\uC720\uD615 || ""));
  }
  function \uB204\uC801\uAC1C\uC218_(\uC720\uD615) {
    var m = String(\uC720\uD615 || "").match(/\(누적\s*(\d+)/);
    return m ? Number(m[1]) : 20;
  }
  function \uB204\uC801\uC720\uD615_(\uC720\uD615, \uAC1C\uC218, \uD568\uAED8) {
    return \uC720\uD615\uC54C\uB9F9\uC774_(\uC720\uD615) + " (\uB204\uC801 " + (Number(\uAC1C\uC218) || 20) + (\uD568\uAED8 ? " \uD568\uAED8" : "") + ")";
  }
  function \uD568\uAED8\uB204\uC801\uC778\uAC00_(\uC720\uD615) {
    return /\(누적[^)]*함께/.test(String(\uC720\uD615 || ""));
  }
  function \uD2C0\uB9B0\uCE78\uD480\uAE30_(\uAE00) {
    return String(\uAE00 || "").replace(/\s*…외\s*\d+개\s*$/, "").split(/\s*,\s*|\s+\/\s+/).map(function(w) {
      return w.replace(/…$/, "").trim();
    }).filter(String);
  }
  function \uD568\uAED8\uD2C0\uB9B0_(\uAE30\uB85D\uB4E4, \uD559\uC0DD\uC218) {
    var \uB204\uAC00 = {};
    (\uAE30\uB85D\uB4E4 || []).forEach(function(r) {
      \uD2C0\uB9B0\uCE78\uD480\uAE30_(r.\uD2C0\uB9B0).forEach(function(w) {
        var k = w.toLowerCase();
        (\uB204\uAC00[k] = \uB204\uAC00[k] || { \uAE00: w, \uC0AC\uB78C: {} }).\uC0AC\uB78C[r.\uC774\uB984] = 1;
      });
    });
    var \uAE30\uC900 = Math.max(2, Math.ceil((Number(\uD559\uC0DD\uC218) || 0) / 3));
    return Object.keys(\uB204\uAC00).map(function(k) {
      return { \uAE00: \uB204\uAC00[k].\uAE00, \uC218: Object.keys(\uB204\uAC00[k].\uC0AC\uB78C).length };
    }).filter(function(x) {
      return x.\uC218 >= \uAE30\uC900;
    }).sort(function(x, y) {
      return y.\uC218 - x.\uC218;
    });
  }
  function \uB2E8\uACC4\uCD08_(\uC720\uD615, \uCC45\uC885\uB958) {
    var \uC54C = \uC720\uD615\uC54C\uB9F9\uC774_(\uC720\uD615);
    return \uC218\uC5C5\uCD08\uD45C_[(\uCC45\uC885\uB958 || "") + "|" + \uC54C] || \uC218\uC5C5\uCD08\uD45C_[\uC54C] || 20;
  }
  function \uB2E8\uACC4\uBD84_(\uC720\uD615, \uAC1C\uC218, \uCC45\uC885\uB958) {
    return Math.max(1, Math.ceil((Number(\uAC1C\uC218) || 0) * \uB2E8\uACC4\uCD08_(\uC720\uD615, \uCC45\uC885\uB958) / 60));
  }
  function \uC218\uC5C5\uD68C\uCC28_(\uC219\uC81C\uB4E4, \uC624\uB298) {
    var \uB0A0\uB4E4 = [];
    (\uC219\uC81C\uB4E4 || []).forEach(function(h) {
      var d = String(h.\uB4F1\uB85D || "");
      if (d && d < \uC624\uB298 && \uB0A0\uB4E4.indexOf(d) < 0) \uB0A0\uB4E4.push(d);
    });
    \uB0A0\uB4E4.sort();
    \uB0A0\uB4E4.reverse();
    var \uD45C = {};
    \uB0A0\uB4E4.forEach(function(d, i) {
      \uD45C[d] = i + 1;
    });
    return \uD45C;
  }
  function \uBB36\uC74C\uD06C\uAE30_(\uCE78) {
    return \uCE78 === "\uBCF8\uBB38" || \uCE78 === "\uBB38\uBC95" ? 12 : 20;
  }
  function \uC774\uC5B4\uC11C\uBC94\uC704_(\uC219\uC81C\uB4E4, \uCD1D, \uBA87) {
    var \uB05D\uBCF8 = 0;
    (\uC219\uC81C\uB4E4 || []).forEach(function(h) {
      if (!\uB204\uC801\uC778\uAC00_(h.\uC720\uD615)) \uB05D\uBCF8 = Math.max(\uB05D\uBCF8, Number(h.\uB05D) || 0);
    });
    \uCD1D = Number(\uCD1D) || 0;
    var a = \uB05D\uBCF8 + 1;
    if (\uCD1D && a > \uCD1D) a = 1;
    var b = a + (Number(\uBA87) || 20) - 1;
    if (\uCD1D) b = Math.min(b, \uCD1D);
    return { \uC2DC\uC791: a, \uB05D: b };
  }
  function \uB204\uC801\uBC94\uC704_(\uC219\uC81C\uB4E4, \uAD50\uC7AC, \uC9C0\uB09C, \uC624\uB298, \uCE78) {
    var \uC774\uAC83 = (\uC219\uC81C\uB4E4 || []).filter(function(h) {
      return h.\uB2E8\uC5B4\uC7A5 === \uAD50\uC7AC;
    });
    var \uBC94\uC704\uAC83 = \uCE78 === void 0 ? \uC774\uAC83 : \uC774\uAC83.filter(function(h) {
      return (h.\uCE78 || "") === (\uCE78 || "");
    });
    var \uD68C\uCC28 = \uC218\uC5C5\uD68C\uCC28_(\uC774\uAC83, \uC624\uB298), a = 0, b = 0;
    \uBC94\uC704\uAC83.forEach(function(h) {
      var n = \uD68C\uCC28[String(h.\uB4F1\uB85D || "")];
      if (!n || n > (Number(\uC9C0\uB09C) || 0)) return;
      var s = Number(h.\uC2DC\uC791) || 1, e = Number(h.\uB05D) || s;
      if (!a || s < a) a = s;
      if (e > b) b = e;
    });
    return a ? { \uC2DC\uC791: a, \uB05D: b } : null;
  }
  function \uBD84\uCD08_(\uCD08) {
    \uCD08 = Math.round(Number(\uCD08) || 0);
    var m = Math.floor(\uCD08 / 60), s = \uCD08 % 60;
    return (m ? m + "\uBD84" : "") + (m && s ? " " : "") + (s || !m ? s + "\uCD08" : "");
  }
  function \uC678\uC6B0\uAE30\uAE30\uBCF8_(\uAC1C\uC218) {
    return Math.ceil((Number(\uAC1C\uC218) || 0) * 15 / 60) || "";
  }
  function \uC2DC\uD5D8\uC2DC\uAC04\uAE30\uBCF8_(\uC720\uD615, \uAC1C\uC218, \uCC45\uC885\uB958) {
    return Number(\uAC1C\uC218) > 0 ? Math.ceil(\uB2E8\uACC4\uBD84_(\uC720\uD615, \uAC1C\uC218, \uCC45\uC885\uB958) * 12 / 10) : "";
  }
  function \uC744\uB97C_(\uAE00) {
    var t = String(\uAE00 || ""), \uB05D = t.charAt(t.length - 1);
    if (/[0-9]/.test(\uB05D)) return "0136781".indexOf(\uB05D) > -1 ? "\uC744" : "\uB97C";
    var c = t.charCodeAt(t.length - 1);
    if (c >= 44032 && c <= 55203) return (c - 44032) % 28 ? "\uC744" : "\uB97C";
    return "\uC744";
  }
  function \uC218\uC5C5\uCD94\uCC9C\uC9DC\uAE30_(\uC7AC\uB8CC) {
    \uC7AC\uB8CC = \uC7AC\uB8CC || {};
    var \uAD50\uC7AC = String(\uC7AC\uB8CC.\uAD50\uC7AC || ""), \uC624\uB298 = String(\uC7AC\uB8CC.\uC624\uB298 || "");
    var \uC608\uC0B0 = Number(\uC7AC\uB8CC.\uC608\uC0B0) || \uCD94\uCC9C\uC608\uC0B0\uAE30\uBCF8_, \uB808\uC2A8 = Number(\uC7AC\uB8CC.\uB808\uC2A8) || 10;
    var \uACFC = \uC7AC\uB8CC.\uC885\uB958 === "\uACFC", \uCE78\uC218 = \uC7AC\uB8CC.\uCE78\uC218 || {};
    var \uCE78\uB4E4 = \uACFC ? \uC5B4\uB514\uCC28\uB840_.filter(function(k) {
      return Number(\uCE78\uC218[k]) > 0;
    }) : [\uC5B4\uB514\uB85C_(\uC7AC\uB8CC.\uC885\uB958)];
    if (!\uCE78\uB4E4.length) \uCE78\uB4E4 = ["\uB2E8\uC5B4"];
    function \uCD1D(k) {
      return \uACFC ? Number(\uCE78\uC218[k]) || 0 : Number(\uC7AC\uB8CC.\uCD1D) || 0;
    }
    function \uCE78of(x) {
      return \uACFC ? x.\uCE78 || "\uB2E8\uC5B4" : \uCE78\uB4E4[0];
    }
    function \uAE30\uBCF8\uC720\uD615(k) {
      return k === "3\uB2E8\uBCC0\uD654" ? "3\uB2E8\uBCC0\uD654" : k === "\uBCF8\uBB38" || k === "\uBB38\uBC95" ? "\uBE48\uCE78 \uCC44\uC6B0\uAE30" : "\uC2A4\uD3A0\uB9C1";
    }
    var \uC219\uC81C\uB4E4 = (\uC7AC\uB8CC.\uC219\uC81C\uB4E4 || []).filter(function(h) {
      return h.\uB2E8\uC5B4\uC7A5 === \uAD50\uC7AC && h.\uB4F1\uB85D;
    });
    var \uAE30\uB85D\uB4E4 = \uC7AC\uB8CC.\uAE30\uB85D\uB4E4 || [];
    var \uB2E8\uC5B4\uAE30\uB85D = \uAE30\uB85D\uB4E4.filter(function(r) {
      return \uCE78of(r) === "\uB2E8\uC5B4";
    });
    var \uB2E8\uC5B4\uC788\uB098 = \uCE78\uB4E4.indexOf("\uB2E8\uC5B4") > -1;
    var \uD68C\uCC28 = \uC218\uC5C5\uD68C\uCC28_(\uC219\uC81C\uB4E4, \uC624\uB298);
    var \uC9C4\uB2E8 = [], \uC55E = [], \uBCF5\uC2B5 = [], \uBB36\uC74C = [], \uC4F4\uBC94\uC704 = {};
    function \uBC94\uC704\uAE00(k, a2, b2) {
      if (\uACFC) return k + " " + a2 + "~" + b2;
      if ((a2 - 1) % \uB808\uC2A8 === 0 && (b2 % \uB808\uC2A8 === 0 || b2 === \uCD1D(k))) {
        var p = (a2 - 1) / \uB808\uC2A8 + 1, q = Math.ceil(b2 / \uB808\uC2A8);
        return p === q ? "\uB808\uC2A8 " + p : "\uB808\uC2A8 " + p + "~" + q;
      }
      return a2 + "~" + b2 + "\uBC88";
    }
    function \uB2E8\uACC4(k, \uC885\uB958, a2, b2, \uC720\uD615, \uC774\uC720, \uAC1C\uC218) {
      if (\uC885\uB958 === "\uB204\uC801" && k !== "\uB2E8\uC5B4") \uC885\uB958 = "\uBCF4\uD1B5";
      var n = \uC885\uB958 === "\uB204\uC801" ? \uAC1C\uC218 || b2 - a2 + 1 : b2 - a2 + 1;
      var s2 = {
        \uC885\uB958,
        \uB2E8\uC5B4\uC7A5: \uAD50\uC7AC,
        \uCE78: \uACFC ? k : "",
        \uC2DC\uC791: a2,
        \uB05D: b2,
        \uC720\uD615,
        \uC774\uC720,
        \uC774\uB984: (\uC885\uB958 === "\uB204\uC801" ? "\uB204\uC801 " : "") + \uBC94\uC704\uAE00(k, a2, b2) + " " + \uC720\uD615
      };
      if (\uC885\uB958 === "\uB204\uC801") s2.\uAC1C\uC218 = n;
      s2.\uBD84 = \uB2E8\uACC4\uBD84_(\uC720\uD615, n, k === "\uBCF8\uBB38" || k === "\uBB38\uBC95" ? k : "");
      return s2;
    }
    var \uAE30\uB85D\uC801\uC74C = \uAE30\uB85D\uB4E4.length < \uCD94\uCC9C\uAE30\uB85D\uCD5C\uC18C_;
    var \uC57D\uCCA0\uC790 = false;
    if (\uAE30\uB85D\uC801\uC74C) {
      \uC9C4\uB2E8.push("\uC544\uC9C1 \uAE30\uB85D\uC774 \uC801\uC5B4 \uC9C4\uB3C4\uB9CC \uBCF4\uACE0 \uC9F0\uC2B5\uB2C8\uB2E4");
    } else {
      \uC219\uC81C\uB4E4.filter(function(h) {
        var n = \uD68C\uCC28[h.\uB4F1\uB85D];
        return n && n <= 2 && (Number(h.\uC548\uB0B8\uC218) || 0) > 0;
      }).sort(function(x, y) {
        return \uD68C\uCC28[x.\uB4F1\uB85D] - \uD68C\uCC28[y.\uB4F1\uB85D] || \uCE78\uB4E4.indexOf(\uCE78of(x)) - \uCE78\uB4E4.indexOf(\uCE78of(y)) || x.\uC2DC\uC791 - y.\uC2DC\uC791;
      }).forEach(function(h) {
        var k = \uCE78of(h), \uC720\uD615 = \uC720\uD615\uC54C\uB9F9\uC774_(h.\uC720\uD615), \uC5F4\uC1E0 = k + "|" + h.\uC2DC\uC791 + "~" + h.\uB05D + "|" + \uC720\uD615;
        if (\uC4F4\uBC94\uC704[\uC5F4\uC1E0]) return;
        \uC4F4\uBC94\uC704[\uC5F4\uC1E0] = 1;
        \uC4F4\uBC94\uC704[k + "|" + h.\uC2DC\uC791 + "~" + h.\uB05D] = 1;
        \uC9C4\uB2E8.push(h.\uC548\uB0B8\uC218 + "\uBA85\uC774 " + \uBC94\uC704\uAE00(k, h.\uC2DC\uC791, h.\uB05D) + " " + \uC720\uD615 + \uC744\uB97C_(\uC720\uD615) + " \uBABB \uB0C8\uC2B5\uB2C8\uB2E4");
        var s2 = \uB204\uC801\uC778\uAC00_(h.\uC720\uD615) ? \uB2E8\uACC4(k, "\uB204\uC801", h.\uC2DC\uC791, h.\uB05D, \uC720\uD615, h.\uC548\uB0B8\uC218 + "\uBA85\uC774 \uBABB \uB0C8\uC2B5\uB2C8\uB2E4", \uB204\uC801\uAC1C\uC218_(h.\uC720\uD615)) : \uB2E8\uACC4(k, "\uBCF4\uD1B5", h.\uC2DC\uC791, h.\uB05D, \uC720\uD615, h.\uC548\uB0B8\uC218 + "\uBA85\uC774 \uBABB \uB0C8\uC2B5\uB2C8\uB2E4");
        if (\uD568\uAED8\uB204\uC801\uC778\uAC00_(h.\uC720\uD615)) s2.\uD568\uAED8 = true;
        \uC55E.push(s2);
      });
      var \uD3C9\uADE0 = function(\uB9DE\uB098) {
        var \uD5692 = 0, n = 0;
        \uB2E8\uC5B4\uAE30\uB85D.forEach(function(r) {
          if (\uB9DE\uB098(String(r.\uC720\uD615 || ""))) {
            \uD5692 += Number(r.\uC810\uC218) || 0;
            n++;
          }
        });
        return n ? Math.round(\uD5692 / n) : null;
      };
      var \uB73B\uC810 = \uD3C9\uADE0(function(t) {
        return /4지|뜻|첫/.test(t);
      });
      var \uCCA0\uC810 = \uD3C9\uADE0(function(t) {
        return /스펠|듣고/.test(t);
      });
      \uC57D\uCCA0\uC790 = \uB2E8\uC5B4\uC788\uB098 && \uB73B\uC810 !== null && \uCCA0\uC810 !== null && \uB73B\uC810 - \uCCA0\uC810 >= 12;
      if (\uC57D\uCCA0\uC790) \uC9C4\uB2E8.push("\uB73B \uACE0\uB974\uAE30 " + \uB73B\uC810 + "\uC810 / \uCCA0\uC790 \uC4F0\uAE30 " + \uCCA0\uC810 + "\uC810 \u2014 \uCCA0\uC790\uAC00 \uC57D\uD569\uB2C8\uB2E4");
      var \uB9C8\uC9C0\uB9C9 = {};
      \uC219\uC81C\uB4E4.forEach(function(h) {
        var n = \uD68C\uCC28[h.\uB4F1\uB85D];
        if (!n || \uB204\uC801\uC778\uAC00_(h.\uC720\uD615)) return;
        var k = \uCE78of(h), \uC5F4 = k + "|" + h.\uC2DC\uC791 + "~" + h.\uB05D;
        if (!\uB9C8\uC9C0\uB9C9[\uC5F4] || n < \uB9C8\uC9C0\uB9C9[\uC5F4].n) \uB9C8\uC9C0\uB9C9[\uC5F4] = { n, \uCE78: k, \uC2DC\uC791: h.\uC2DC\uC791, \uB05D: h.\uB05D, \uC720\uD615: \uC720\uD615\uC54C\uB9F9\uC774_(h.\uC720\uD615) };
      });
      Object.keys(\uB9C8\uC9C0\uB9C9).map(function(\uC5F4) {
        return \uB9C8\uC9C0\uB9C9[\uC5F4];
      }).filter(function(x) {
        return [2, 4, 8].indexOf(x.n) > -1 && !\uC4F4\uBC94\uC704[x.\uCE78 + "|" + x.\uC2DC\uC791 + "~" + x.\uB05D];
      }).sort(function(x, y) {
        return y.n - x.n || \uCE78\uB4E4.indexOf(x.\uCE78) - \uCE78\uB4E4.indexOf(y.\uCE78) || x.\uC2DC\uC791 - y.\uC2DC\uC791;
      }).forEach(function(x) {
        var \uAE00 = \uBC94\uC704\uAE00(x.\uCE78, x.\uC2DC\uC791, x.\uB05D);
        \uC9C4\uB2E8.push(\uAE00 + \uC744\uB97C_(\uAE00) + " \uBCF8 \uC9C0 " + x.n + "\uC218\uC5C5 \uB410\uC2B5\uB2C8\uB2E4");
        var s2 = x.\uCE78 === "\uB2E8\uC5B4" ? \uB2E8\uACC4("\uB2E8\uC5B4", "\uB204\uC801", x.\uC2DC\uC791, x.\uB05D, \uAE30\uBCF8\uC720\uD615("\uB2E8\uC5B4"), x.n + "\uC218\uC5C5 \uC804\uC5D0 \uBD24\uC2B5\uB2C8\uB2E4", Math.min(20, x.\uB05D - x.\uC2DC\uC791 + 1)) : \uB2E8\uACC4(x.\uCE78, "\uBCF4\uD1B5", x.\uC2DC\uC791, x.\uB05D, x.\uC720\uD615 || \uAE30\uBCF8\uC720\uD615(x.\uCE78), x.n + "\uC218\uC5C5 \uC804\uC5D0 \uBD24\uC2B5\uB2C8\uB2E4");
        s2.\uC9C0\uB09C = x.n;
        \uBCF5\uC2B5.push(s2);
      });
      var \uD568\uAED8 = \uB2E8\uC5B4\uC788\uB098 ? \uD568\uAED8\uD2C0\uB9B0_(\uB2E8\uC5B4\uAE30\uB85D, \uC7AC\uB8CC.\uD559\uC0DD\uC218) : [];
      if (\uD568\uAED8.length > 5) {
        var \uB2E8\uC5B4\uB4E4 = (\uC7AC\uB8CC.\uB2E8\uC5B4\uB4E4 || []).map(function(w) {
          return String(w).toLowerCase().trim();
        });
        var \uC790\uB9AC = [];
        \uD568\uAED8.forEach(function(x) {
          var i2 = \uB2E8\uC5B4\uB4E4.indexOf(x.\uAE00.toLowerCase());
          if (i2 > -1) \uC790\uB9AC.push(i2 + 1);
        });
        var \uBCF4\uAE30 = \uD568\uAED8.slice(0, 3).map(function(x) {
          return x.\uAE00;
        }).join(", ") + (\uD568\uAED8.length > 3 ? " \u2026" : "");
        \uC9C4\uB2E8.push("\uB2E4 \uAC19\uC774 \uD2C0\uB9B0 \uB2E8\uC5B4 " + \uD568\uAED8.length + "\uAC1C (" + \uBCF4\uAE30 + ")");
        if (\uC790\uB9AC.length) {
          var a = Math.min.apply(null, \uC790\uB9AC), b = Math.max.apply(null, \uC790\uB9AC);
          var s = \uB2E8\uACC4("\uB2E8\uC5B4", "\uB204\uC801", a, b, \uAE30\uBCF8\uC720\uD615("\uB2E8\uC5B4"), "\uB2E4 \uAC19\uC774 \uD2C0\uB9B0 \uB2E8\uC5B4 " + \uD568\uAED8.length + "\uAC1C", \uC790\uB9AC.length);
          s.\uC774\uB984 = "\uB2E4 \uAC19\uC774 \uD2C0\uB9B0 \uB2E8\uC5B4 " + \uC790\uB9AC.length + "\uAC1C";
          if (s.\uC885\uB958 === "\uB204\uC801") s.\uD568\uAED8 = true;
          \uBB36\uC74C.push(s);
        }
      }
    }
    if (!\uAE30\uB85D\uC801\uC74C) {
      var \uC81C\uD55C\uB4E4 = {};
      \uC219\uC81C\uB4E4.forEach(function(h) {
        var m = Number(h.\uC81C\uD55C\uC2DC\uAC04) || 0;
        if (m > 0) (\uC81C\uD55C\uB4E4[\uC720\uD615\uC54C\uB9F9\uC774_(h.\uC720\uD615)] = \uC81C\uD55C\uB4E4[\uC720\uD615\uC54C\uB9F9\uC774_(h.\uC720\uD615)] || []).push(m);
      });
      Object.keys(\uC81C\uD55C\uB4E4).forEach(function(t) {
        var \uCD08\uB4E4 = \uAE30\uB85D\uB4E4.filter(function(r) {
          return \uC720\uD615\uC54C\uB9F9\uC774_(r.\uC720\uD615) === t && Number(r.\uCD08) > 0;
        }).map(function(r) {
          return Number(r.\uCD08);
        });
        if (!\uCD08\uB4E4.length) return;
        var \uD3C9\uADE0\uCD08 = \uCD08\uB4E4.reduce(function(a2, b2) {
          return a2 + b2;
        }, 0) / \uCD08\uB4E4.length;
        var \uC81C\uD55C\uBD84 = \uC81C\uD55C\uB4E4[t].reduce(function(a2, b2) {
          return a2 + b2;
        }, 0) / \uC81C\uD55C\uB4E4[t].length;
        if (\uD3C9\uADE0\uCD08 > \uC81C\uD55C\uBD84 * 60 * 0.9) {
          \uC9C4\uB2E8.push(t + " \uD3C9\uADE0 " + \uBD84\uCD08_(\uD3C9\uADE0\uCD08) + " / \uC81C\uD55C " + Math.round(\uC81C\uD55C\uBD84) + "\uBD84 \u2014 \uC2DC\uAC04\uC774 \uBE60\uB4EF\uD569\uB2C8\uB2E4");
        }
      });
    }
    var \uB2E8\uC5B4\uC9C4\uB3C4 = [], \uB534\uC9C4\uB3C4 = [];
    \uCE78\uB4E4.forEach(function(k) {
      var \uAC83 = \uC219\uC81C\uB4E4.filter(function(h) {
        return \uCE78of(h) === k;
      });
      var r = \uC774\uC5B4\uC11C\uBC94\uC704_(\uAC83, \uCD1D(k), \uBB36\uC74C\uD06C\uAE30_(k));
      var \uB05D\uBCF8 = 0;
      \uAC83.forEach(function(h) {
        if (!\uB204\uC801\uC778\uAC00_(h.\uC720\uD615)) \uB05D\uBCF8 = Math.max(\uB05D\uBCF8, Number(h.\uB05D) || 0);
      });
      if (\uCD1D(k) && \uB05D\uBCF8 >= \uCD1D(k)) \uC9C4\uB2E8.push((\uACFC ? k + \uC744\uB97C_(k) + " " : "") + "\uB05D\uAE4C\uC9C0 \uB098\uAC00\uC11C \uCC98\uC74C\uBD80\uD130 \uB2E4\uC2DC \uB3D5\uB2C8\uB2E4");
      if (k === "\uB2E8\uC5B4" && \uC57D\uCCA0\uC790) {
        \uB2E8\uC5B4\uC9C4\uB3C4 = [
          \uB2E8\uACC4(k, "\uBCF4\uD1B5", r.\uC2DC\uC791, r.\uB05D, "\uB4E3\uACE0 \uC4F0\uAE30", "\uCCA0\uC790\uAC00 \uC57D\uD569\uB2C8\uB2E4"),
          \uB2E8\uACC4(k, "\uBCF4\uD1B5", r.\uC2DC\uC791, r.\uB05D, "\uCCAB \uAE00\uC790", "\uCCA0\uC790\uAC00 \uC57D\uD569\uB2C8\uB2E4")
        ];
      } else if (k === "\uB2E8\uC5B4") {
        \uB2E8\uC5B4\uC9C4\uB3C4 = [\uB2E8\uACC4(k, "\uBCF4\uD1B5", r.\uC2DC\uC791, r.\uB05D, \uAE30\uBCF8\uC720\uD615(k), "\uC9C4\uB3C4")];
      } else {
        \uB534\uC9C4\uB3C4.push(\uB2E8\uACC4(k, "\uBCF4\uD1B5", r.\uC2DC\uC791, r.\uB05D, \uAE30\uBCF8\uC720\uD615(k), "\uC9C4\uB3C4"));
      }
    });
    var \uBCF8\uB2E8\uACC4 = {};
    var \uC21C\uC11C = (\uAE30\uB85D\uC801\uC74C ? \uB2E8\uC5B4\uC9C4\uB3C4.concat(\uB534\uC9C4\uB3C4) : \uC55E.concat(\uC57D\uCCA0\uC790 ? \uB2E8\uC5B4\uC9C4\uB3C4 : [], \uBCF5\uC2B5, \uBB36\uC74C, \uC57D\uCCA0\uC790 ? [] : \uB2E8\uC5B4\uC9C4\uB3C4, \uB534\uC9C4\uB3C4)).filter(function(s2) {
      var k = s2.\uC885\uB958 + "|" + s2.\uCE78 + "|" + s2.\uC2DC\uC791 + "~" + s2.\uB05D + "|" + s2.\uC720\uD615;
      if (\uBCF8\uB2E8\uACC4[k]) return false;
      \uBCF8\uB2E8\uACC4[k] = 1;
      return true;
    });
    var \uB2E8\uACC4\uB4E4 = [], \uD569 = 0;
    for (var i = 0; i < \uC21C\uC11C.length; i++) {
      if (\uB2E8\uACC4\uB4E4.length && \uD569 + \uC21C\uC11C[i].\uBD84 > \uC608\uC0B0) break;
      \uB2E8\uACC4\uB4E4.push(\uC21C\uC11C[i]);
      \uD569 += \uC21C\uC11C[i].\uBD84;
    }
    if (\uC21C\uC11C.length > \uB2E8\uACC4\uB4E4.length) {
      \uC9C4\uB2E8.push("\uC2DC\uAC04 \uC608\uC0B0 " + \uC608\uC0B0 + "\uBD84\uC744 \uB118\uC5B4\uC11C \uB4A4\uC758 " + (\uC21C\uC11C.length - \uB2E8\uACC4\uB4E4.length) + "\uB2E8\uACC4\uB294 \uBE90\uC2B5\uB2C8\uB2E4");
    }
    return { \uAD50\uC7AC, \uC624\uB298, \uC608\uC0B0, \uC9C4\uB2E8, \uB2E8\uACC4: \uB2E8\uACC4\uB4E4, \uD569\uACC4\uBD84: \uD569, \uAE30\uB85D\uC801\uC74C };
  }
  var \uACFC\uAF2C\uB9AC\uB9D0_ = ["\uB2E8\uC5B4", "\uBCF8\uBB38", "\uBB38\uBC95", "3\uB2E8\uBCC0\uD654"];
  var \uC5B4\uB514\uCC28\uB840_ = ["\uB2E8\uC5B4", "\uBCF8\uBB38", "\uBB38\uBC95", "3\uB2E8\uBCC0\uD654"];
  function \uC5B4\uB514\uB85C_(\uC885\uB958) {
    var k = String(\uC885\uB958 || "").trim();
    return k === "\uBCF8\uBB38" || k === "\uBB38\uBC95" || k === "3\uB2E8\uBCC0\uD654" ? k : "\uB2E8\uC5B4";
  }
  function \uACFC\uCABC\uAC1C\uAE30_(\uC774\uB984, \uC885\uB958) {
    var t = String(\uC774\uB984 || "").trim(), \uACFC = "";
    var m = t.match(new RegExp("^(.+?)\\s+(" + \uACFC\uAF2C\uB9AC\uB9D0_.join("|") + ")\\d*$"));
    if (m) \uACFC = m[1].trim();
    return { \uACFC, \uC5B4\uB514: \uC5B4\uB514\uB85C_(\uC885\uB958) };
  }
  function \uACFC\uC774\uB984_(b) {
    var \uC190 = b && b.\uACFC\uCE78 !== void 0 && b.\uACFC\uCE78 !== null ? String(b.\uACFC\uCE78).trim() : "";
    if (!\uC190 && b && String(b.\uC885\uB958 || "").trim() === "\uACFC") return String(b.\uC774\uB984 || "").trim();
    return \uC190 || \uACFC\uCABC\uAC1C\uAE30_(b && b.\uC774\uB984, b && b.\uC885\uB958).\uACFC;
  }
  function \uACFC\uBB36\uC74C_(\uBAA9\uB85D) {
    var \uACFC\uB4E4 = [], \uCC3E\uAE30 = {};
    (\uBAA9\uB85D || []).forEach(function(b) {
      if (!b || !b.\uC774\uB984) return;
      var \uACFC = \uACFC\uC774\uB984_(b);
      if (!\uACFC) return;
      var g = \uCC3E\uAE30[\uACFC];
      if (!g) {
        g = \uCC3E\uAE30[\uACFC] = { \uACFC, \uCE78: {} };
        \uACFC\uB4E4.push(g);
      }
      var \uC5B4\uB514 = \uC5B4\uB514\uB85C_(b.\uC885\uB958);
      (g.\uCE78[\uC5B4\uB514] = g.\uCE78[\uC5B4\uB514] || []).push({ \uC774\uB984: b.\uC774\uB984, \uAC1C\uC218: Number(b.\uAC1C\uC218) || 0 });
    });
    return \uACFC\uB4E4;
  }
  function \uC218\uC5C5\uAFB8\uB7EC\uBBF8\uBAA9\uB85D() {
    return \uCC98\uC74C\uC218\uC5C5\uD2C0_.map(function(t) {
      return { \uD0A4: t.\uD0A4, \uC774\uB984: t.\uC774\uB984, \uC124\uBA85: t.\uC124\uBA85, \uB2E8\uACC4: t.\uB2E8\uACC4 };
    });
  }
  var \uC218\uC5C5\uD2C0\uC2DC\uD2B8\uC774\uB984 = "\uC218\uC5C5\uD2C0";
  function \uC218\uC5C5\uD2C0\uC2DC\uD2B8_() {
    var ss = ss_();
    var sh = ss.getSheetByName(\uC218\uC5C5\uD2C0\uC2DC\uD2B8\uC774\uB984);
    if (sh) return sh;
    sh = ss.insertSheet(\uC218\uC5C5\uD2C0\uC2DC\uD2B8\uC774\uB984);
    sh.getRange(1, 1, 1, 3).setValues([["\uD2C0\uC774\uB984", "\uB2E8\uACC4\uB4E4", "\uB9CC\uB4E0\uB54C"]]).setFontWeight("bold").setBackground("#EFF3F9");
    sh.setFrozenRows(1);
    var \uC904 = \uCC98\uC74C\uC218\uC5C5\uD2C0_.map(function(t) {
      return [t.\uC774\uB984, JSON.stringify(t.\uB2E8\uACC4), new Date2()];
    });
    sh.getRange(2, 1, \uC904.length, 3).setValues(\uC904);
    return sh;
  }
  function \uC218\uC5C5\uD2C0\uC77D\uAE30_() {
    var sh = \uC218\uC5C5\uD2C0\uC2DC\uD2B8_();
    var last = sh.getLastRow();
    if (last < 2) return [];
    return sh.getRange(2, 1, last - 1, 3).getValues().map(function(x, i) {
      var \uB2E8\uACC4 = [];
      try {
        \uB2E8\uACC4 = JSON.parse(s_(x[1]) || "[]");
      } catch (e) {
        \uB2E8\uACC4 = [];
      }
      return { \uD589: i + 2, \uC774\uB984: s_(x[0]), \uB2E8\uACC4 };
    }).filter(function(t) {
      return t.\uC774\uB984;
    });
  }
  function \uC218\uC5C5\uD2C0\uBAA9\uB85D(\uBE44\uBC88) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    return { ok: true, \uD2C0: \uC218\uC5C5\uD2C0\uC77D\uAE30_().map(function(t) {
      return { \uC774\uB984: t.\uC774\uB984, \uB2E8\uACC4: t.\uB2E8\uACC4 };
    }) };
  }
  function \uD2C0\uB2E8\uACC4\uC815\uB9AC_(\uB2E8\uACC4) {
    var \uCE78 = ["\uC885\uB958", "\uCE78", "\uC5B4\uB514", "\uC720\uD615", "\uBD84", "\uC81C\uD55C", "\uB2E8\uACC4", "\uD1B5\uACFC", "\uC7AC\uC751\uC2DC", "\uC9C0\uB09C", "\uAC1C\uC218"];
    return (\uB2E8\uACC4 || []).map(function(d) {
      var o = {};
      \uCE78.forEach(function(k) {
        if (d && d[k] !== void 0 && d[k] !== null && d[k] !== "") o[k] = d[k];
      });
      return o;
    }).filter(function(d) {
      return d.\uC720\uD615;
    });
  }
  function \uC218\uC5C5\uD2C0\uC800\uC7A5(\uBE44\uBC88, \uC774\uB984, \uB2E8\uACC4) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    \uC774\uB984 = s_(\uC774\uB984);
    if (!\uC774\uB984) return { ok: false, \uBA54\uC2DC\uC9C0: "\uD2C0 \uC774\uB984\uC744 \uC801\uC5B4 \uC8FC\uC138\uC694." };
    var \uC815\uB9AC = \uD2C0\uB2E8\uACC4\uC815\uB9AC_(\uB2E8\uACC4);
    if (!\uC815\uB9AC.length) return { ok: false, \uBA54\uC2DC\uC9C0: "\uB2E8\uACC4\uB97C \uD558\uB098 \uC774\uC0C1 \uB123\uC5B4 \uC8FC\uC138\uC694." };
    var sh = \uC218\uC5C5\uD2C0\uC2DC\uD2B8_();
    var \uC788\uB358 = null;
    \uC218\uC5C5\uD2C0\uC77D\uAE30_().forEach(function(t) {
      if (t.\uC774\uB984 === \uC774\uB984) \uC788\uB358 = t;
    });
    var \uC904 = [[\uC774\uB984, JSON.stringify(\uC815\uB9AC), new Date2()]];
    if (\uC788\uB358) sh.getRange(\uC788\uB358.\uD589, 1, 1, 3).setValues(\uC904);
    else sh.getRange(sh.getLastRow() + 1, 1, 1, 3).setValues(\uC904);
    return \uC218\uC5C5\uD2C0\uBAA9\uB85D(\uBE44\uBC88);
  }
  function \uC218\uC5C5\uD2C0\uC0AD\uC81C(\uBE44\uBC88, \uC774\uB984) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var sh = \uC218\uC5C5\uD2C0\uC2DC\uD2B8_();
    \uC218\uC5C5\uD2C0\uC77D\uAE30_().filter(function(t) {
      return t.\uC774\uB984 === s_(\uC774\uB984);
    }).reverse().forEach(function(t) {
      sh.deleteRow(t.\uD589);
    });
    return \uC218\uC5C5\uD2C0\uBAA9\uB85D(\uBE44\uBC88);
  }
  function \uAE30\uB85D\uBA54\uBAA8_(name) {
    try {
      var sh = sheet_(name), last = sh.getLastRow();
      if (last < 2) return [];
      return sh.getRange(2, \uD2C0\uB9B0\uB2E8\uC5B4\uC5F4, last - 1, 1).getNotes().map(function(r) {
        return s_(r[0]);
      });
    } catch (e) {
      return [];
    }
  }
  function \uC628\uC624\uB2F5_(\uC140, \uBA54\uBAA8) {
    \uBA54\uBAA8 = s_(\uBA54\uBAA8);
    if (/^틀린 단어 \d+개/.test(\uBA54\uBAA8)) return \uBA54\uBAA8.split("\n").slice(1).map(s_).filter(String);
    return \uD2C0\uB9B0\uCE78\uD480\uAE30_(\uC140);
  }
  function \uBC94\uC704\uCE78_(\uBC94\uC704) {
    var m = s_(\uBC94\uC704).match(/^(단어|본문|문법|3단변화)\s/);
    return m ? m[1] : "";
  }
  function \uCD5C\uADFC\uAE30\uB85D_(\uAD50\uC7AC) {
    var \uD55C\uB2EC\uC804 = new Date2();
    \uD55C\uB2EC\uC804.setDate(\uD55C\uB2EC\uC804.getDate() - 30);
    var \uBA54\uBAA8 = \uAE30\uB85D\uBA54\uBAA8_(SHEET.\uAE30\uB85D), out = [];
    rows_(SHEET.\uAE30\uB85D).forEach(function(x, i) {
      if (!(x[0] instanceof Date2) || x[0] < \uD55C\uB2EC\uC804) return;
      if (s_(x[3]) !== \uAD50\uC7AC) return;
      if (s_(x[14]) === \uC7AC\uC2DC\uD5D8\uD45C\uC2DC || s_(x[15]) === "O") return;
      out.push({
        \uC774\uB984: s_(x[2]),
        \uCE78: \uBC94\uC704\uCE78_(x[4]),
        \uC720\uD615: s_(x[5]),
        \uC810\uC218: Number(x[8]) || 0,
        \uCD08: Number(x[11]) || 0,
        \uD2C0\uB9B0: \uC628\uC624\uB2F5_(x[13], \uBA54\uBAA8[i]).join(", "),
        \uB0A0: ymd_(x[0])
      });
    });
    return out;
  }
  function \uC218\uC5C5\uC7AC\uB8CC_(\uAD50\uC7AC) {
    \uAD50\uC7AC = s_(\uAD50\uC7AC);
    var \uCC45 = null;
    \uB2E8\uC5B4\uC7A5\uBAA9\uB85D().forEach(function(b) {
      if (b.\uC774\uB984 === \uAD50\uC7AC) \uCC45 = b;
    });
    var \uC219\uC81C\uB4E4 = \uC804\uCCB4\uC219\uC81C().filter(function(h) {
      return h.\uB2E8\uC5B4\uC7A5 === \uAD50\uC7AC && \uC219\uC81C\uC778\uAC00_(h);
    }).map(function(h) {
      return {
        \uB2E8\uC5B4\uC7A5: h.\uB2E8\uC5B4\uC7A5,
        \uCE78: h.\uCE78 || "",
        \uC2DC\uC791: h.\uC2DC\uC791,
        \uB05D: h.\uB05D,
        \uC720\uD615: h.\uC720\uD615,
        \uB4F1\uB85D: h.\uB4F1\uB85D\uC77C || "",
        \uC81C\uD55C\uC2DC\uAC04: h.\uC81C\uD55C\uC2DC\uAC04 || 0,
        \uC548\uB0B8\uC218: (h.\uC548\uD55C\uC0AC\uB78C || []).length,
        \uB300\uC0C1\uC218: h.\uB300\uC0C1\uC218
      };
    });
    var \uAE30\uB85D\uB4E4 = \uCD5C\uADFC\uAE30\uB85D_(\uAD50\uC7AC);
    return {
      \uAD50\uC7AC,
      \uC885\uB958: \uCC45 ? \uCC45.\uC885\uB958 : "",
      \uC624\uB298: ymd_(new Date2()),
      \uB808\uC2A8: \uCC45 ? \uCC45.\uB808\uC2A8 : \uAE30\uBCF8\uB808\uC2A8,
      \uCD1D: \uCC45 ? \uCC45.\uAC1C\uC218 : 0,
      \uCE78\uC218: \uCC45 && \uCC45.\uCE78\uC218 || {},
      \uD559\uC0DD\uC218: \uAD50\uC7AC\uD559\uC0DD_(\uAD50\uC7AC).length,
      \uC219\uC81C\uB4E4,
      \uAE30\uB85D\uB4E4,
      /* 다 같이 틀린 단어의 자리를 찾는 데 쓴다 — 과 단어장은 단어 구분의 줄만 */
      \uB2E8\uC5B4\uB4E4: \uBC94\uC704\uB2E8\uC5B4_(\uB2E8\uC5B4\uAC00\uC838\uC624\uAE30(\uAD50\uC7AC) || [], \uCC45 && \uACFC\uC7A5_(\uCC45.\uC885\uB958) ? "\uB2E8\uC5B4" : "").map(function(w) {
        return w.en;
      })
    };
  }
  function \uC218\uC5C5\uCD94\uCC9C(\uBE44\uBC88, \uAD50\uC7AC, \uC608\uC0B0, \uC0C8\uB85C) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    if (!s_(\uAD50\uC7AC)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uAD50\uC7AC\uB97C \uACE8\uB77C \uC8FC\uC138\uC694." };
    var \uC5F4\uC1E0 = "\uC218\uC5C5\uC7AC\uB8CC|" + s_(\uAD50\uC7AC), \uC7AC\uB8CC = null, \uCE90\uC2DC = null;
    try {
      \uCE90\uC2DC = CacheService.getScriptCache();
    } catch (e) {
      \uCE90\uC2DC = null;
    }
    if (\uCE90\uC2DC && !\uC0C8\uB85C) {
      try {
        var \uAE00 = \uCE90\uC2DC.get(\uC5F4\uC1E0);
        if (\uAE00) \uC7AC\uB8CC = JSON.parse(\uAE00);
      } catch (e) {
        \uC7AC\uB8CC = null;
      }
    }
    if (!\uC7AC\uB8CC) {
      \uC7AC\uB8CC = \uC218\uC5C5\uC7AC\uB8CC_(\uAD50\uC7AC);
      if (\uCE90\uC2DC) {
        try {
          \uCE90\uC2DC.put(\uC5F4\uC1E0, JSON.stringify(\uC7AC\uB8CC), 300);
        } catch (e) {
        }
      }
    }
    \uC7AC\uB8CC.\uC608\uC0B0 = Number(\uC608\uC0B0) || \uCD94\uCC9C\uC608\uC0B0\uAE30\uBCF8_;
    return { ok: true, \uCD94\uCC9C: \uC218\uC5C5\uCD94\uCC9C\uC9DC\uAE30_(\uC7AC\uB8CC) };
  }
  var \uB0B4\uC624\uB2F5\uAE30\uB85D\uC218 = 10;
  function \uB0B4\uC624\uB2F5(\uC774\uB984, \uB2E8\uC5B4\uC7A5, \uD568\uAED8, \uCE78) {
    \uCE78 = s_(\uCE78);
    \uC774\uB984 = s_(\uC774\uB984);
    \uB2E8\uC5B4\uC7A5 = s_(\uB2E8\uC5B4\uC7A5);
    if (!\uC774\uB984 || !\uB2E8\uC5B4\uC7A5) return { ok: true, \uB2E8\uC5B4: [] };
    var \uC904\uB4E4 = [];
    [SHEET.\uAE30\uB85D, SHEET.\uAE30\uB85D\uBCF4\uAD00].forEach(function(name) {
      var r = [];
      try {
        r = rows_(name);
      } catch (e) {
        return;
      }
      var \uBA54\uBAA8 = \uAE30\uB85D\uBA54\uBAA8_(name);
      r.forEach(function(x, i) {
        if (!(x[0] instanceof Date2)) return;
        if (s_(x[2]) !== \uC774\uB984 || s_(x[3]) !== \uB2E8\uC5B4\uC7A5 || !s_(x[13])) return;
        if (\uCE78 && \uBC94\uC704\uCE78_(x[4]) !== \uCE78) return;
        \uC904\uB4E4.push({ \uB54C: x[0], \uD2C0\uB9B0: \uC628\uC624\uB2F5_(x[13], \uBA54\uBAA8[i]) });
      });
    });
    \uC904\uB4E4.sort(function(a, b) {
      return b.\uB54C - a.\uB54C;
    });
    var \uBCF8 = {}, \uB2E8\uC5B4 = [];
    function \uB123\uAE30(w) {
      var k = String(w || "").toLowerCase();
      if (!k || \uBCF8[k]) return;
      \uBCF8[k] = 1;
      \uB2E8\uC5B4.push(w);
    }
    if (\uD568\uAED8) \uD568\uAED8\uD2C0\uB9B0_(
      \uCD5C\uADFC\uAE30\uB85D_(\uB2E8\uC5B4\uC7A5).filter(function(r) {
        return !\uCE78 || r.\uCE78 === \uCE78;
      }),
      \uAD50\uC7AC\uD559\uC0DD_(\uB2E8\uC5B4\uC7A5).length
    ).forEach(function(x) {
      \uB123\uAE30(x.\uAE00);
    });
    \uC904\uB4E4.slice(0, \uB0B4\uC624\uB2F5\uAE30\uB85D\uC218).forEach(function(x) {
      x.\uD2C0\uB9B0.forEach(\uB123\uAE30);
    });
    return { ok: true, \uB2E8\uC5B4 };
  }
  function \uC218\uC5C5\uB0B4\uC8FC\uAE30(\uBE44\uBC88, c) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var \uC774\uB984 = s_(c && c.\uC774\uB984);
    if (!\uC774\uB984) return { ok: false, \uBA54\uC2DC\uC9C0: "\uC218\uC5C5 \uC774\uB984\uC744 \uC801\uC5B4 \uC8FC\uC138\uC694." };
    if (c.\uB2E8\uACC4 && c.\uB2E8\uACC4.length) return \uB2E8\uACC4\uB85C\uB0B4\uC8FC\uAE30_(\uBE44\uBC88, \uC774\uB984, c);
    var \uAFB8 = null;
    \uCC98\uC74C\uC218\uC5C5\uD2C0_.forEach(function(x) {
      if (x.\uD0A4 === s_(c.\uAFB8\uB7EC\uBBF8)) \uAFB8 = x;
    });
    if (!\uAFB8) return { ok: false, \uBA54\uC2DC\uC9C0: "\uAFB8\uB7EC\uBBF8\uB97C \uACE8\uB77C \uC8FC\uC138\uC694." };
    function \uC4F0\uB098(\uC5B4\uB514) {
      return \uAFB8.\uB2E8\uACC4.some(function(d) {
        return d.\uC5B4\uB514 === \uC5B4\uB514;
      });
    }
    if (\uC4F0\uB098("\uB2E8\uC5B4") && !s_(c.\uB2E8\uC5B4\uC7A5)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uB2E8\uC5B4 \uB2E8\uC5B4\uC7A5\uC744 \uACE8\uB77C \uC8FC\uC138\uC694." };
    if (\uC4F0\uB098("\uBCF8\uBB38") && !s_(c.\uBCF8\uBB38\uC7A5)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBCF8\uBB38 \uB2E8\uC5B4\uC7A5\uC744 \uACE8\uB77C \uC8FC\uC138\uC694." };
    if (\uC4F0\uB098("\uBB38\uBC95") && !s_(c.\uBB38\uBC95\uC7A5)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBB38\uBC95 \uB2E8\uC5B4\uC7A5\uC744 \uACE8\uB77C \uC8FC\uC138\uC694." };
    var \uB428 = 0, \uD0C8 = [], \uC0C8\uAC83\uB4E4 = [];
    \uAFB8.\uB2E8\uACC4.forEach(function(d, i) {
      var \uCC45 = d.\uC5B4\uB514 === "\uBCF8\uBB38" ? s_(c.\uBCF8\uBB38\uC7A5) : d.\uC5B4\uB514 === "\uBB38\uBC95" ? s_(c.\uBB38\uBC95\uC7A5) : s_(c.\uB2E8\uC5B4\uC7A5);
      var \uC2DC\uC791 = d.\uC5B4\uB514 === "\uBCF8\uBB38" ? c.\uBCF8\uBB38\uC2DC\uC791 : d.\uC5B4\uB514 === "\uBB38\uBC95" ? c.\uBB38\uBC95\uC2DC\uC791 : c.\uB2E8\uC5B4\uC2DC\uC791;
      var \uB05D = d.\uC5B4\uB514 === "\uBCF8\uBB38" ? c.\uBCF8\uBB38\uB05D : d.\uC5B4\uB514 === "\uBB38\uBC95" ? c.\uBB38\uBC95\uB05D : c.\uB2E8\uC5B4\uB05D;
      var r = \uC219\uC81C\uB4F1\uB85D(\uBE44\uBC88, {
        \uB2E8\uC5B4\uC7A5: \uCC45,
        \uC2DC\uC791,
        \uB05D,
        \uC720\uD615: d.\uC720\uD615,
        \uB9C8\uAC10\uC77C: c.\uB9C8\uAC10\uC77C,
        \uC885\uB958: c.\uC885\uB958,
        \uD559\uC0DD\uB4E4: c.\uD559\uC0DD\uB4E4,
        \uC218\uC5C5: \uC774\uB984,
        \uC21C\uC11C: i + 1,
        \uBC14\uB010\uC904\uB9CC: true
      });
      if (r && r.ok) {
        \uB428++;
        \uC0C8\uAC83\uB4E4.push(r.\uC219\uC81C);
      } else \uD0C8.push(d.\uC720\uD615 + " \u2014 " + (r && r.\uBA54\uC2DC\uC9C0 || "\uC2E4\uD328"));
    });
    if (!\uB428) return { ok: false, \uBA54\uC2DC\uC9C0: \uD0C8[0] || "\uC218\uC5C5\uC744 \uB0B4\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4." };
    var \uB2F5 = {
      ok: true,
      \uC774\uB984,
      \uB2E8\uACC4\uC218: \uB428,
      \uBA54\uC2DC\uC9C0: \uD0C8.length ? "\uC77C\uBD80\uB9CC \uB098\uAC14\uC2B5\uB2C8\uB2E4 \u2014 " + \uD0C8.join(" / ") : "",
      \uC219\uC81C\uB4E4: \uC0C8\uAC83\uB4E4
    };
    if (!c.\uBC14\uB010\uC904\uB9CC) \uB2F5.\uC219\uC81C\uBAA9\uB85D = \uC804\uCCB4\uC219\uC81C();
    return \uB2F5;
  }
  function \uB2E8\uACC4\uB85C\uB0B4\uC8FC\uAE30_(\uBE44\uBC88, \uC774\uB984, c) {
    return \uC77D\uB294\uB3D9\uC548_(function() {
      return \uB2E8\uACC4\uB85C\uB0B4\uC8FC\uAE30\uC548_(\uBE44\uBC88, \uC774\uB984, c);
    });
  }
  function \uB2E8\uACC4\uB85C\uB0B4\uC8FC\uAE30\uC548_(\uBE44\uBC88, \uC774\uB984, c) {
    var \uB428 = 0, \uD0C8 = [], \uCC45\uB4E4 = {}, \uC0C8\uAC83\uB4E4 = [];
    c.\uB2E8\uACC4.forEach(function(d, i) {
      var r = \uC219\uC81C\uB4F1\uB85D(\uBE44\uBC88, {
        \uB2E8\uC5B4\uC7A5: s_(d.\uB2E8\uC5B4\uC7A5),
        \uCE78: s_(d.\uCE78),
        \uC2DC\uC791: d.\uC2DC\uC791,
        \uB05D: d.\uB05D,
        \uC720\uD615: s_(d.\uC720\uD615),
        \uC81C\uD55C\uC2DC\uAC04: d.\uC81C\uD55C\uC2DC\uAC04,
        \uB2E8\uACC4: d.\uB2E8\uACC4,
        \uD1B5\uACFC\uC810\uC218: d.\uD1B5\uACFC\uC810\uC218,
        \uC7AC\uC751\uC2DC: d.\uC7AC\uC751\uC2DC,
        \uB9C8\uAC10\uC77C: c.\uB9C8\uAC10\uC77C,
        \uC885\uB958: c.\uC885\uB958,
        \uD559\uC0DD\uB4E4: c.\uD559\uC0DD\uB4E4,
        \uC218\uC5C5: \uC774\uB984,
        \uC21C\uC11C: i + 1,
        \uBC14\uB010\uC904\uB9CC: true
      });
      if (r && r.ok) {
        \uB428++;
        \uCC45\uB4E4[s_(d.\uB2E8\uC5B4\uC7A5)] = 1;
        \uC0C8\uAC83\uB4E4.push(r.\uC219\uC81C);
      } else \uD0C8.push(i + 1 + "\uB2E8\uACC4 " + s_(d.\uC720\uD615) + " \u2014 " + (r && r.\uBA54\uC2DC\uC9C0 || "\uC2E4\uD328"));
    });
    try {
      var \uCE90\uC2DC = CacheService.getScriptCache();
      Object.keys(\uCC45\uB4E4).forEach(function(b) {
        \uCE90\uC2DC.remove("\uC218\uC5C5\uC7AC\uB8CC|" + b);
      });
    } catch (e) {
    }
    if (!\uB428) return { ok: false, \uBA54\uC2DC\uC9C0: \uD0C8[0] || "\uC218\uC5C5\uC744 \uB0B4\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4." };
    var \uB2F5 = {
      ok: true,
      \uC774\uB984,
      \uB2E8\uACC4\uC218: \uB428,
      \uBA54\uC2DC\uC9C0: \uD0C8.length ? "\uC77C\uBD80\uB9CC \uB098\uAC14\uC2B5\uB2C8\uB2E4 \u2014 " + \uD0C8.join(" / ") : "",
      \uC219\uC81C\uB4E4: \uC0C8\uAC83\uB4E4
    };
    if (!c.\uBC14\uB010\uC904\uB9CC) \uB2F5.\uC219\uC81C\uBAA9\uB85D = \uC804\uCCB4\uC219\uC81C();
    return \uB2F5;
  }
  function \uC218\uC5C5\uC0AD\uC81C(\uBE44\uBC88, \uC774\uB984) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var \uCC3E\uC744\uAC83 = s_(\uC774\uB984);
    if (!\uCC3E\uC744\uAC83) return { ok: false };
    var sh = \uC219\uC81C\uCE78\uD655\uBCF4_();
    var r = rows_(SHEET.\uC219\uC81C);
    var \uC9C0\uC6B8\uC904 = [];
    r.forEach(function(x, i) {
      if (s_(x.length > 9 ? x[9] : "") === \uCC3E\uC744\uAC83) \uC9C0\uC6B8\uC904.push(i + 2);
    });
    \uC9C0\uC6B8\uC904.reverse().forEach(function(n) {
      sh.deleteRow(n);
    });
    return { ok: true, \uC9C0\uC6B4\uC218: \uC9C0\uC6B8\uC904.length, \uC219\uC81C\uBAA9\uB85D: \uC804\uCCB4\uC219\uC81C() };
  }
  function \uC219\uC81C\uC0AD\uC81C(\uBE44\uBC88, \uD589, \uBC14\uB010\uC904\uB9CC) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var r = \uC219\uC81C\uC5EC\uB7EC\uAC1C\uC0AD\uC81C(\uBE44\uBC88, [\uD589], \uBC14\uB010\uC904\uB9CC);
    if (!r.ok) return r;
    return { ok: true, \uC9C0\uC6B4\uD589: r.\uC9C0\uC6B4\uD589, \uC219\uC81C\uBAA9\uB85D: r.\uC219\uC81C\uBAA9\uB85D };
  }
  function \uC219\uC81C\uC5EC\uB7EC\uAC1C\uC0AD\uC81C(\uBE44\uBC88, \uD589\uB4E4, \uBC14\uB010\uC904\uB9CC) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var sh = sheet_(SHEET.\uC219\uC81C);
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(1e4);
    } catch (e) {
      return { ok: false, \uBA54\uC2DC\uC9C0: "\uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694" };
    }
    var \uC815\uB9AC = [];
    try {
      var \uBCF8\uAC83 = {};
      (\uD589\uB4E4 || []).forEach(function(r) {
        var n = r && typeof r === "object" ? \uC219\uC81C\uC904\uCC3E\uAE30_(sh, r.\uD589, r.\uB0B8\uB54C) : \uC219\uC81C\uC904\uCC3E\uAE30_(sh, r, 0);
        if (n && !\uBCF8\uAC83[n]) {
          \uBCF8\uAC83[n] = 1;
          \uC815\uB9AC.push(n);
        }
      });
      \uC815\uB9AC.sort(function(a, b) {
        return b - a;
      });
      \uBB36\uC74C\uC904\uB4E4_(\uC815\uB9AC).forEach(function(m) {
        sh.deleteRows(m.\uC2DC\uC791, m.\uAC1C\uC218);
      });
    } finally {
      lock.releaseLock();
    }
    \uC815\uB9AC.sort(function(a, b) {
      return a - b;
    });
    var \uB2F5 = { ok: true, \uAC1C\uC218: \uC815\uB9AC.length, \uC9C0\uC6B4\uD589: \uC815\uB9AC };
    if (!\uBC14\uB010\uC904\uB9CC) \uB2F5.\uC219\uC81C\uBAA9\uB85D = \uC804\uCCB4\uC219\uC81C();
    return \uB2F5;
  }
  function \uC219\uC81C\uC228\uAE40\uBC14\uAFB8\uAE30(\uBE44\uBC88, \uD589\uB4E4, \uC228\uAE38\uAE4C, \uBC14\uB010\uC904\uB9CC) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var sh = sheet_(SHEET.\uC219\uC81C);
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(1e4);
    } catch (e) {
      return { ok: false, \uBA54\uC2DC\uC9C0: "\uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694" };
    }
    var \uBC14\uAFBC = [];
    try {
      \uC219\uC81C\uCE78\uD655\uBCF4_(sh);
      var \uBCF8\uAC83 = {};
      (\uD589\uB4E4 || []).forEach(function(r) {
        var n = r && typeof r === "object" ? \uC219\uC81C\uC904\uCC3E\uAE30_(sh, r.\uD589, r.\uB0B8\uB54C) : \uC219\uC81C\uC904\uCC3E\uAE30_(sh, r, 0);
        if (n && !\uBCF8\uAC83[n]) {
          \uBCF8\uAC83[n] = 1;
          \uBC14\uAFBC.push(n);
        }
      });
      \uBC14\uAFBC.forEach(function(n) {
        sh.getRange(n, 18).setValue(\uC228\uAE38\uAE4C ? "1" : "");
      });
    } finally {
      lock.releaseLock();
    }
    \uBC14\uAFBC.sort(function(a, b) {
      return a - b;
    });
    var \uB2F5 = { ok: true, \uAC1C\uC218: \uBC14\uAFBC.length, \uBC14\uAFBC\uD589: \uBC14\uAFBC };
    if (!\uBC14\uB010\uC904\uB9CC) \uB2F5.\uC219\uC81C\uBAA9\uB85D = \uC804\uCCB4\uC219\uC81C();
    return \uB2F5;
  }
  function \uBB36\uC74C\uC904\uB4E4_(\uD070\uCC28\uB840) {
    var \uBB36\uC74C = [];
    \uD070\uCC28\uB840.forEach(function(n) {
      var m = \uBB36\uC74C[\uBB36\uC74C.length - 1];
      if (m && m.\uC2DC\uC791 - 1 === n) {
        m.\uC2DC\uC791 = n;
        m.\uAC1C\uC218++;
      } else \uBB36\uC74C.push({ \uC2DC\uC791: n, \uAC1C\uC218: 1 });
    });
    return \uBB36\uC74C;
  }
  function \uC219\uC81C\uC218\uC815(\uBE44\uBC88, \uD589, h) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    h = h || {};
    var sh = sheet_(SHEET.\uC219\uC81C);
    if (Array.isArray(\uD589)) {
      var \uB41C = 0, \uD0C8 = "", \uACE0\uCE5C\uD589\uB4E4 = [];
      \uD589.forEach(function(r2) {
        var \uB2F5 = \uC219\uC81C\uD55C\uC904\uACE0\uCE58\uAE30_(sh, r2 && r2.\uD589 !== void 0 ? r2.\uD589 : r2, h, r2 && r2.\uB0B8\uB54C);
        if (\uB2F5.ok) {
          \uB41C++;
          \uACE0\uCE5C\uD589\uB4E4.push(\uB2F5.\uD589);
        } else \uD0C8 = \uD0C8 || \uB2F5.\uBA54\uC2DC\uC9C0;
      });
      if (!\uB41C && \uD0C8) return { ok: false, \uBA54\uC2DC\uC9C0: \uD0C8 };
      if (!h.\uBC14\uB010\uC904\uB9CC) return { ok: true, \uAC1C\uC218: \uB41C, \uC219\uC81C\uBAA9\uB85D: \uC804\uCCB4\uC219\uC81C() };
      return { ok: true, \uAC1C\uC218: \uB41C, \uC219\uC81C\uB4E4: \uACE0\uCE5C\uD589\uB4E4.map(function(n) {
        return \uACE0\uCE5C\uC219\uC81C\uC904_(sh, n, false);
      }) };
    }
    var r = \uC219\uC81C\uD55C\uC904\uACE0\uCE58\uAE30_(sh, \uD589, h, h.\uB0B8\uB54C);
    if (!r.ok) return r;
    if (!h.\uBC14\uB010\uC904\uB9CC) return { ok: true, \uC219\uC81C\uBAA9\uB85D: \uC804\uCCB4\uC219\uC81C() };
    return { ok: true, \uC219\uC81C: \uACE0\uCE5C\uC219\uC81C\uC904_(sh, r.\uD589, \uC55E\uC744\uACE0\uCE68_(h)) };
  }
  function \uC55E\uC744\uACE0\uCE68_(h) {
    return ["\uB2E8\uC5B4\uC7A5", "\uC2DC\uC791", "\uB05D", "\uC720\uD615", "\uC885\uB958", "\uB9C8\uAC10\uC77C"].some(function(k) {
      return h[k] !== void 0;
    });
  }
  function \uACE0\uCE5C\uC219\uC81C\uC904_(sh, n, \uC804\uBD80) {
    var \uB113\uC774 = typeof sh.getLastColumn === "function" ? Math.max(17, sh.getLastColumn()) : 17;
    var x = sh.getRange(n, 1, 1, \uB113\uC774).getValues()[0];
    if (!\uC804\uBD80) {
      var \uC885\uB958 = \uC219\uC81C\uC885\uB958_(x[8]), \uC2DC\uAC04 = \uC219\uC81C\uC2DC\uAC04_(x, \uC885\uB958);
      return {
        \uD589: n,
        \uB0B8\uB54C: x[6] instanceof Date2 ? x[6].getTime() : 0,
        \uC81C\uD55C\uC2DC\uAC04: \uC2DC\uAC04.\uC81C\uD55C\uC2DC\uAC04,
        \uC678\uC6B0\uAE30\uBD84: \uC2DC\uAC04.\uC678\uC6B0\uAE30\uBD84,
        \uD1B5\uACFC\uC810\uC218: s_(x[14]),
        \uC7AC\uC751\uC2DC: s_(x[15])
      };
    }
    return \uC77D\uB294\uB3D9\uC548_(function() {
      var \uB2E8\uACC4\uC788\uB2E4 = !!\uB2E8\uACC4\uC815\uB9AC_(x[13]);
      return \uC219\uC81C\uC904_(x, n, \uC219\uC81C\uB9E5\uB77D_({
        \uC751\uC2DC: \uB2E8\uACC4\uC788\uB2E4 ? \uC751\uC2DC\uD45C_() : {},
        \uB354\uC900\uD45C: \uB2E8\uACC4\uC788\uB2E4 ? \uC7AC\uC751\uC2DC\uCD94\uAC00\uD45C_() : {},
        \uC644\uB8CC: \uB2E8\uACC4\uC788\uB2E4 ? {} : \uC644\uB8CC\uC810\uC218\uB4E4_()
      }));
    });
  }
  function \uC219\uC81C\uC904\uCC3E\uAE30_(sh, \uD589, \uB0B8\uB54C) {
    var n = Number(\uD589), \uB9C8\uC9C0\uB9C9 = sh.getLastRow();
    \uB0B8\uB54C = Number(\uB0B8\uB54C) || 0;
    if (!\uB0B8\uB54C) return n >= 2 && n <= \uB9C8\uC9C0\uB9C9 ? n : 0;
    function \uB9DE\uB098(v) {
      return v instanceof Date2 && v.getTime() === \uB0B8\uB54C;
    }
    if (n >= 2 && n <= \uB9C8\uC9C0\uB9C9 && \uB9DE\uB098(sh.getRange(n, 7).getValue())) return n;
    if (\uB9C8\uC9C0\uB9C9 < 2) return 0;
    var \uB54C\uB4E4 = sh.getRange(2, 7, \uB9C8\uC9C0\uB9C9 - 1, 1).getValues();
    for (var i = 0; i < \uB54C\uB4E4.length; i++) if (\uB9DE\uB098(\uB54C\uB4E4[i][0])) return i + 2;
    return 0;
  }
  function \uC219\uC81C\uD55C\uC904\uACE0\uCE58\uAE30_(sh, \uD589, h, \uB0B8\uB54C) {
    var n = \uC219\uC81C\uC904\uCC3E\uAE30_(sh, \uD589, \uB0B8\uB54C);
    if (!n) return { ok: false, \uBA54\uC2DC\uC9C0: "\uC774\uBBF8 \uC9C0\uC6CC\uC9C4 \uC219\uC81C\uC785\uB2C8\uB2E4" };
    var \uB4A4\uCE78 = { \uC81C\uD55C\uC2DC\uAC04: 13, \uD1B5\uACFC\uC810\uC218: 15, \uC7AC\uC751\uC2DC: 16, \uC678\uC6B0\uAE30\uBD84: 17 };
    var \uB05D\uAC12 = { \uC81C\uD55C\uC2DC\uAC04: 180, \uC678\uC6B0\uAE30\uBD84: 180, \uD1B5\uACFC\uC810\uC218: 100, \uC7AC\uC751\uC2DC: 20 };
    var \uB4A4 = [];
    for (var k in \uB4A4\uCE78) {
      if (h[k] === void 0) continue;
      var v = h[k] === "" || h[k] === null ? "" : Math.round(Number(h[k]));
      if (v !== "" && !(isFinite(v) && v >= 0 && v <= \uB05D\uAC12[k])) {
        return { ok: false, \uBA54\uC2DC\uC9C0: (k === "\uD1B5\uACFC\uC810\uC218" ? "\uD1B5\uACFC\uC810\uC218\uB294 0\uC5D0\uC11C 100" : k === "\uC7AC\uC751\uC2DC" ? "\uC7AC\uC751\uC2DC\uB294 0\uC5D0\uC11C 20\uBC88" : "\uC2DC\uAC04\uC740 0\uC5D0\uC11C 180\uBD84") + " \uC0AC\uC774\uB85C \uB123\uC5B4 \uC8FC\uC138\uC694." };
      }
      if (v === 0 && (k === "\uC81C\uD55C\uC2DC\uAC04" || k === "\uC678\uC6B0\uAE30\uBD84")) v = "";
      \uB4A4.push([\uB4A4\uCE78[k], v]);
    }
    var \uC55E\uC744 = ["\uB2E8\uC5B4\uC7A5", "\uC2DC\uC791", "\uB05D", "\uC720\uD615", "\uC885\uB958", "\uB9C8\uAC10\uC77C"].some(function(k2) {
      return h[k2] !== void 0;
    });
    if (\uC55E\uC744) {
      var \uB2F5 = \uC219\uC81C\uC55E\uCE78\uACE0\uCE58\uAE30_(sh, n, h);
      if (!\uB2F5.ok) return \uB2F5;
    }
    if (\uB4A4.length) {
      \uC219\uC81C\uCE78\uD655\uBCF4_(sh);
      \uB4A4.forEach(function(x) {
        sh.getRange(n, x[0]).setValue(x[1]);
      });
    }
    return { ok: true, \uD589: n };
  }
  function \uC219\uC81C\uC55E\uCE78\uACE0\uCE58\uAE30_(sh, n, h) {
    var \uAE30\uC874 = sh.getRange(n, 1, 1, 9).getValues()[0];
    var \uC885\uB958 = \uC219\uC81C\uC885\uB958_(h.\uC885\uB958);
    var \uB0A0\uC9DC\uACE0\uB984 = \uC885\uB958 === "\uAE30\uD55C" || \uC885\uB958 === "\uC2DC\uD5D8";
    var \uB9C8\uAC10 = \uB0A0\uC9DC\uACE0\uB984 ? s_(h.\uB9C8\uAC10\uC77C) : ymd_(new Date2());
    if (\uB0A0\uC9DC\uACE0\uB984 && !\uB9C8\uAC10) {
      return { ok: false, \uBA54\uC2DC\uC9C0: \uC885\uB958 === "\uC2DC\uD5D8" ? "\uC2DC\uD5D8 \uB0A0\uC9DC\uB97C \uACE8\uB77C \uC8FC\uC138\uC694" : "\uB9C8\uAC10\uC77C\uC744 \uACE8\uB77C \uC8FC\uC138\uC694" };
    }
    var \uC2DC\uC791 = Number(h.\uC2DC\uC791) || 1;
    var \uB05D = Number(h.\uB05D) || 0;
    if (\uB05D < \uC2DC\uC791) {
      var t = \uC2DC\uC791;
      \uC2DC\uC791 = \uB05D;
      \uB05D = t;
    }
    sh.getRange(n, 1, 1, 9).setValues([[
      "",
      // 반은 더 이상 쓰지 않는다
      s_(h.\uB2E8\uC5B4\uC7A5) || s_(\uAE30\uC874[1]),
      \uC2DC\uC791,
      \uB05D,
      s_(h.\uC720\uD615) || "\uC2A4\uD3A0\uB9C1",
      \uB9C8\uAC10,
      \uAE30\uC874[6] || new Date2(),
      // 등록시각 (그대로)
      s_(\uAE30\uC874[7]),
      // 대상 학생 (그대로)
      \uC885\uB958
    ]]);
    var \uC0C8\uCC45 = s_(h.\uB2E8\uC5B4\uC7A5) || s_(\uAE30\uC874[1]);
    if (h.\uCE78 !== void 0 || \uC0C8\uCC45 !== s_(\uAE30\uC874[1])) {
      var \uC0C8\uCE78 = h.\uCE78 !== void 0 ? s_(h.\uCE78) : "";
      var nb = \uB2E8\uC5B4\uC7A5\uCC3E\uAE30_(\uC0C8\uCC45);
      if (!(nb && \uACFC\uC7A5_(nb.\uC885\uB958))) \uC0C8\uCE78 = "";
      else if (!\uC0C8\uCE78) \uC0C8\uCE78 = "\uB2E8\uC5B4";
      \uC219\uC81C\uCE78\uD655\uBCF4_(sh);
      sh.getRange(n, 12).setValue(\uC0C8\uCE78);
    }
    return { ok: true };
  }
  function \uAE30\uB85D\uC815\uB9AC(\uBE44\uBC88, \uD0A4\uB4E4) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var sh = sheet_(SHEET.\uAE30\uB85D);
    var last = sh.getLastRow();
    if (last < 2) return { ok: true, \uAC1C\uC218: 0 };
    var vals = sh.getRange(2, 1, last - 1, 1).getValues();
    var set = {};
    (\uD0A4\uB4E4 || []).forEach(function(k) {
      set[Number(k)] = 1;
    });
    var \uD589\uB4E4 = [];
    for (var i = 0; i < vals.length; i++) {
      var d = vals[i][0];
      if (d instanceof Date2 && set[d.getTime()]) \uD589\uB4E4.push(i + 2);
    }
    return { ok: true, \uAC1C\uC218: \uD589\uBCF4\uAD00_(\uD589\uB4E4) };
  }
  function \uC9C0\uB09C\uC219\uC81C\uC815\uB9AC(\uBE44\uBC88, \uC77C\uC218) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    var days = Number(\uC77C\uC218) || 30;
    var \uAE30\uC900 = new Date2();
    \uAE30\uC900.setHours(0, 0, 0, 0);
    \uAE30\uC900.setDate(\uAE30\uC900.getDate() - days);
    var \uC790\uB978\uB0A0 = ymd_(\uAE30\uC900);
    var sh = sheet_(SHEET.\uC219\uC81C);
    var last = sh.getLastRow();
    if (last < 2) return { ok: true, \uAC1C\uC218: 0, \uC219\uC81C\uBAA9\uB85D: \uC804\uCCB4\uC219\uC81C() };
    var vals = sh.getRange(2, 1, last - 1, 9).getValues();
    var \uC9C0\uC6B8\uC904 = [];
    for (var i = 0; i < vals.length; i++) {
      var x = vals[i];
      var \uB9C8\uAC10 = x[5] instanceof Date2 ? ymd_(x[5]) : s_(x[5]);
      if (!\uB9C8\uAC10) continue;
      if (\uB9C8\uAC10 < \uC790\uB978\uB0A0) \uC9C0\uC6B8\uC904.push(i + 2);
    }
    if (!\uC9C0\uC6B8\uC904.length) return { ok: true, \uAC1C\uC218: 0, \uC219\uC81C\uBAA9\uB85D: \uC804\uCCB4\uC219\uC81C() };
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(1e4);
    } catch (e) {
      return { ok: false, \uBA54\uC2DC\uC9C0: "\uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uD574 \uC8FC\uC138\uC694" };
    }
    try {
      \uC9C0\uC6B8\uC904.sort(function(a, b) {
        return b - a;
      });
      \uC9C0\uC6B8\uC904.forEach(function(n) {
        sh.deleteRow(n);
      });
    } finally {
      lock.releaseLock();
    }
    return { ok: true, \uAC1C\uC218: \uC9C0\uC6B8\uC904.length, \uC790\uB978\uB0A0, \uC219\uC81C\uBAA9\uB85D: \uC804\uCCB4\uC219\uC81C() };
  }
  function \uC624\uB798\uB41C\uAE30\uB85D\uC815\uB9ACAPI(\uBE44\uBC88, \uC77C\uC218) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    return { ok: true, \uAC1C\uC218: \uC624\uB798\uB41C\uAE30\uB85D\uBCF4\uAD00_(Number(\uC77C\uC218) || 30) };
  }
  function \uBCF8\uBB38\uC7A5_(\uC885\uB958) {
    var t = s_(\uC885\uB958);
    return t === "\uBCF8\uBB38" || t === "\uBB38\uBC95";
  }
  function \uBB38\uBC95\uC7A5_(\uC885\uB958) {
    return s_(\uC885\uB958) === "\uBB38\uBC95";
  }
  function \uADF8\uB9BC\uAC19\uB098_(v) {
    var t = s_(v);
    if (!t) return false;
    return /^(https?:\/\/|data:image\/)/i.test(t) || /\.(png|jpe?g|gif|webp|svg)$/i.test(t);
  }
  function \uC904\uB098\uB204\uAE30_(line, \uC885\uB958) {
    var \uBB38\uC7A5 = \uBCF8\uBB38\uC7A5_(\uC885\uB958);
    var \uBC88\uD638\uB5BC\uAE30 = \uBB38\uC7A5 ? /^\s*\d+\s*[.)\]]\s+/ : /^\s*\d+\s*[.)\]]?\s+/;
    var t = String(line || "").replace(\uBC88\uD638\uB5BC\uAE30, "").trim();
    if (!t) return null;
    var \uAF2C\uB9AC = /[\-:=,;|\s]+$/, \uBA38\uB9AC = /^[\-:=;|\s]+/;
    var en = "", ko = "";
    if (t.indexOf("|") > -1) {
      var \uCABD = t.split("|");
      en = s_(\uCABD[0]).replace(\uAF2C\uB9AC, "").trim();
      ko = s_(\uCABD[1]).replace(\uBA38\uB9AC, "").trim();
      var \uB4A4 = \uCABD.slice(2).join("|").trim();
      if (en && ko) {
        if (\uBB38\uC7A5) return \uB4A4 ? [en, ko, \uB4A4] : [en, ko];
        return \uADF8\uB9BC\uAC19\uB098_(\uB4A4) ? [en, ko, \uB4A4] : [en, ko + (\uB4A4 ? " | " + \uB4A4 : "")];
      }
    }
    if (t.indexOf("	") > -1) {
      var \uCE78 = t.split("	");
      en = s_(\uCE78[0]).replace(\uAF2C\uB9AC, "").trim();
      ko = s_(\uCE78[1]).replace(\uBA38\uB9AC, "").trim();
      var \uC14B = s_(\uCE78[2]).trim();
      if (en && ko) {
        if (\uBB38\uC7A5) return \uC14B ? [en, ko, \uC14B] : [en, ko];
        return \uADF8\uB9BC\uAC19\uB098_(\uC14B) ? [en, ko, \uC14B] : [en, ko];
      }
    }
    if (\uBB38\uC7A5) return null;
    var m = t.match(/[가-힣]/);
    if (m && m.index > 0) {
      var idx = m.index;
      while (idx > 0 && /[~∼〜]/.test(t.charAt(idx - 1))) idx--;
      en = t.slice(0, idx).replace(\uAF2C\uB9AC, "").trim();
      ko = t.slice(idx).trim();
      if (en && ko && !/[가-힣]/.test(en)) return [en, ko];
    }
    var p2 = t.split(/\s{2,}/);
    if (p2.length >= 2) {
      en = p2[0].replace(\uAF2C\uB9AC, "").trim();
      ko = p2.slice(1).join(" ").replace(\uBA38\uB9AC, "").trim();
      if (en && ko) return [en, ko];
    }
    var k = t.indexOf(" ");
    if (k > 0) {
      en = t.slice(0, k).replace(\uAF2C\uB9AC, "").trim();
      ko = t.slice(k + 1).replace(\uBA38\uB9AC, "").trim();
      if (en && ko) return [en, ko];
    }
    return null;
  }
  function \uB2E8\uC5B4\uBD99\uC5EC\uB123\uAE30(\uBE44\uBC88, \uB2E8\uC5B4\uC7A5, \uBCF8\uBB38, \uB36E\uC5B4\uC4F0\uAE30, \uC885\uB958) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    if (\uACFC\uC7A5_(\uC885\uB958)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uACFC \uB2E8\uC5B4\uC7A5\uC740 \u300C\uACFC \uD55C\uAEBC\uBC88\uC5D0 \uB123\uAE30\u300D \uCE78\uC5D0 ## \uC774\uB984 / ### \uB2E8\uC5B4 \uAF34\uB85C \uBD99\uC5EC\uB123\uC5B4 \uC8FC\uC138\uC694." };
    var \uB9C9 = \uACFC\uBA74\uB9C9\uAE30_(\uB2E8\uC5B4\uC7A5);
    if (\uB9C9) return \uB9C9;
    var \uC774\uB984 = s_(\uB2E8\uC5B4\uC7A5);
    if (!\uC774\uB984) return { ok: false, \uBA54\uC2DC\uC9C0: "\uB2E8\uC5B4\uC7A5 \uC774\uB984\uC744 \uC801\uC5B4 \uC8FC\uC138\uC694." };
    var \uD56D\uBAA9 = [];
    String(\uBCF8\uBB38 || "").split("\n").forEach(function(line) {
      var p = \uC904\uB098\uB204\uAE30_(line, \uC885\uB958);
      if (p) \uD56D\uBAA9.push(p);
    });
    if (!\uD56D\uBAA9.length) return { ok: false, \uBA54\uC2DC\uC9C0: "\uC778\uC2DD\uB41C \uB2E8\uC5B4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4." };
    var b = \uB2E8\uC5B4\uC7A5\uCC3E\uAE30_(\uC774\uB984);
    var sh;
    if (!b) {
      sh = \uB2E8\uC5B4\uC2DC\uD2B8\uB9CC\uB4E4\uAE30_(\uC774\uB984, \uC885\uB958);
    } else {
      sh = ss_().getSheetByName(b.\uC2DC\uD2B8);
      if (!sh) sh = \uB2E8\uC5B4\uC2DC\uD2B8\uB9CC\uB4E4\uAE30_(\uC774\uB984, \uC885\uB958);
      if (\uB36E\uC5B4\uC4F0\uAE30 && sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
      if (s_(\uC885\uB958) !== b.\uC885\uB958) \uBAA9\uB85D\uC2DC\uD2B8_().getRange(b.\uD589, 2).setValue(s_(\uC885\uB958));
    }
    var \uC2DC\uC791\uBC88\uD638 = Math.max(0, sh.getLastRow() - 1);
    var \uADF8\uB9BC\uC218 = 0;
    \uD56D\uBAA9.forEach(function(p) {
      if (p[2]) \uADF8\uB9BC\uC218++;
    });
    var \uD3ED = \uADF8\uB9BC\uC218 ? 4 : 3;
    if (\uADF8\uB9BC\uC218) \uB137\uC9F8\uCE78\uD655\uBCF4_(sh, \uC885\uB958);
    var \uAC12 = \uD56D\uBAA9.map(function(p, i) {
      return \uADF8\uB9BC\uC218 ? [\uC2DC\uC791\uBC88\uD638 + i + 1, p[0], p[1], s_(p[2])] : [\uC2DC\uC791\uBC88\uD638 + i + 1, p[0], p[1]];
    });
    sh.getRange(sh.getLastRow() + 1, 1, \uAC12.length, \uD3ED).setValues(\uAC12);
    return { ok: true, \uAC1C\uC218: \uD56D\uBAA9.length, \uADF8\uB9BC\uC218, \uB2E8\uC5B4\uC7A5\uBAA9\uB85D: \uB2E8\uC5B4\uC7A5\uBAA9\uB85D() };
  }
  function \uB2E8\uC5B4\uBAA9\uB85D(\uBE44\uBC88, \uB2E8\uC5B4\uC7A5) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var sh = \uB2E8\uC5B4\uC2DC\uD2B8_(\uB2E8\uC5B4\uC7A5);
    if (!sh) return { ok: true, \uB2E8\uC5B4\uB4E4: [] };
    var last = sh.getLastRow();
    if (last < 2) return { ok: true, \uB2E8\uC5B4\uB4E4: [] };
    var b = \uB2E8\uC5B4\uC7A5\uCC3E\uAE30_(\uB2E8\uC5B4\uC7A5);
    if (b && \uACFC\uC7A5_(b.\uC885\uB958)) {
      return { ok: true, \uC885\uB958: "\uACFC", \uB2E8\uC5B4\uB4E4: \uACFC\uC904\uB4E4_(sh, last).map(function(w) {
        return { \uBC88\uD638: w.no, \uCE78: w.\uCE78, en: w.en, ko: w.ko, \uADF8\uB9BC: w.\uADF8\uB9BC || "", \uBE44\uACE0: w.\uBE44\uACE0 || "" };
      }) };
    }
    var \uBB38\uC7A5 = \uBCF8\uBB38\uC7A5_(b && b.\uC885\uB958);
    var \uCE78\uC218 = Math.max(3, Math.min(4, sh.getLastColumn()));
    var v = sh.getRange(2, 1, last - 1, \uCE78\uC218).getValues();
    var out = [];
    v.forEach(function(x, i) {
      var \uB137\uC9F8 = \uCE78\uC218 > 3 ? s_(x[3]) : "";
      out.push({
        \uD589: i + 2,
        \uBC88\uD638: Number(x[0]) || i + 1,
        en: s_(x[1]),
        ko: s_(x[2]),
        \uADF8\uB9BC: \uBB38\uC7A5 ? "" : \uB137\uC9F8,
        \uBE44\uACE0: \uBB38\uC7A5 ? \uB137\uC9F8 : ""
      });
    });
    out.sort(function(a, b2) {
      return a.\uBC88\uD638 - b2.\uBC88\uD638;
    });
    return { ok: true, \uB2E8\uC5B4\uB4E4: out, \uC885\uB958: \uBB38\uC7A5 ? "\uBCF8\uBB38" : b ? b.\uC885\uB958 : "" };
  }
  function \uB2E8\uC5B4\uC218\uC815(\uBE44\uBC88, \uB2E8\uC5B4\uC7A5, \uD589, en, ko) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var \uB9C9 = \uACFC\uBA74\uB9C9\uAE30_(\uB2E8\uC5B4\uC7A5);
    if (\uB9C9) return \uB9C9;
    if (!s_(en) || !s_(ko)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uC601\uC5B4\uC640 \uB73B\uC744 \uBAA8\uB450 \uC801\uC5B4 \uC8FC\uC138\uC694." };
    var sh = \uB2E8\uC5B4\uC2DC\uD2B8_(\uB2E8\uC5B4\uC7A5);
    if (!sh) return { ok: false, \uBA54\uC2DC\uC9C0: "\uB2E8\uC5B4\uC7A5\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." };
    var n = Number(\uD589);
    if (!(n >= 2 && n <= sh.getLastRow())) return { ok: false, \uBA54\uC2DC\uC9C0: "\uC5C6\uB294 \uC904\uC785\uB2C8\uB2E4. \uC0C8\uB85C\uACE0\uCE68 \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694." };
    sh.getRange(n, 2, 1, 2).setValues([[s_(en), s_(ko)]]);
    return { ok: true };
  }
  function \uB2E8\uC5B4\uC0AD\uC81C(\uBE44\uBC88, \uB2E8\uC5B4\uC7A5, \uD589\uB4E4) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var \uB9C9 = \uACFC\uBA74\uB9C9\uAE30_(\uB2E8\uC5B4\uC7A5);
    if (\uB9C9) return \uB9C9;
    var sh = \uB2E8\uC5B4\uC2DC\uD2B8_(\uB2E8\uC5B4\uC7A5);
    if (!sh) return { ok: false };
    var \uBAA9\uB85D = (\uD589\uB4E4 || []).map(Number).filter(function(n) {
      return n >= 2 && n <= sh.getLastRow();
    }).sort(function(a, b) {
      return b - a;
    });
    \uBAA9\uB85D.forEach(function(n) {
      sh.deleteRow(n);
    });
    \uBC88\uD638\uC7AC\uC815\uB82C_(\uB2E8\uC5B4\uC7A5);
    return { ok: true, \uAC1C\uC218: \uBAA9\uB85D.length };
  }
  function \uB2E8\uC5B4\uCD94\uAC00(\uBE44\uBC88, \uB2E8\uC5B4\uC7A5, en, ko) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var \uB9C9 = \uACFC\uBA74\uB9C9\uAE30_(\uB2E8\uC5B4\uC7A5);
    if (\uB9C9) return \uB9C9;
    if (!s_(en) || !s_(ko)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uC601\uC5B4\uC640 \uB73B\uC744 \uBAA8\uB450 \uC801\uC5B4 \uC8FC\uC138\uC694." };
    var sh = \uB2E8\uC5B4\uC2DC\uD2B8_(\uB2E8\uC5B4\uC7A5);
    if (!sh) return { ok: false, \uBA54\uC2DC\uC9C0: "\uB2E8\uC5B4\uC7A5\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." };
    sh.appendRow([Math.max(0, sh.getLastRow() - 1) + 1, s_(en), s_(ko)]);
    return { ok: true };
  }
  var \uADF8\uB9BC\uD3F4\uB354\uC774\uB984 = "\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8 \uADF8\uB9BC";
  var \uC61B\uADF8\uB9BC\uD3F4\uB354\uC774\uB984 = "\uD574\uBC95 \uC601\uB2E8\uC5B4 \uADF8\uB9BC";
  function \uADF8\uB9BC\uD3F4\uB354_() {
    var P = PropertiesService.getScriptProperties();
    var id = P.getProperty("\uADF8\uB9BC\uD3F4\uB354");
    if (id) {
      try {
        return DriveApp.getFolderById(id);
      } catch (e) {
      }
    }
    var it = DriveApp.getFoldersByName(\uADF8\uB9BC\uD3F4\uB354\uC774\uB984);
    if (!it.hasNext()) it = DriveApp.getFoldersByName(\uC61B\uADF8\uB9BC\uD3F4\uB354\uC774\uB984);
    var f = it.hasNext() ? it.next() : DriveApp.createFolder(\uADF8\uB9BC\uD3F4\uB354\uC774\uB984);
    try {
      f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {
    }
    P.setProperty("\uADF8\uB9BC\uD3F4\uB354", f.getId());
    return f;
  }
  function \uADF8\uB9BC\uC8FC\uC18C_(id) {
    return "https://drive.google.com/thumbnail?id=" + id + "&sz=w400";
  }
  function \uADF8\uB9BC\uCE78\uD655\uBCF4_(sh) {
    \uB137\uC9F8\uCE78\uD655\uBCF4_(sh, "");
  }
  function \uB137\uC9F8\uCE78\uD655\uBCF4_(sh, \uC885\uB958) {
    if (sh.getMaxColumns() < 4) sh.insertColumnsAfter(sh.getMaxColumns(), 4 - sh.getMaxColumns());
    if (!s_(sh.getRange(1, 4).getValue())) {
      sh.getRange(1, 4).setValue(\uBB38\uBC95\uC7A5_(\uC885\uB958) ? "\uD78C\uD2B8\xB7\uD574\uC124" : \uBCF8\uBB38\uC7A5_(\uC885\uB958) ? "\uBE44\uACE0" : "\uADF8\uB9BC").setFontWeight("bold").setBackground("#EFF3F9");
      sh.setColumnWidth(4, 260);
    }
  }
  function \uC5F4\uC1E0\uB9D0_(v) {
    return s_(v).toLowerCase().replace(/\.[^.]+$/, "").replace(/[\s_\-().0-9]/g, "");
  }
  var \uADF8\uB9BC\uAD8C\uD55C\uC548\uB0B4 = "\uC0AC\uC9C4\uC744 \uC62C\uB9B4 \uAD8C\uD55C\uC774 \uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4.\n\n\uC2A4\uD504\uB808\uB4DC\uC2DC\uD2B8 \uC0C1\uB2E8 \uBA54\uB274 [\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8] \u2192 [\uC0AC\uC9C4 \uC62C\uB9B4 \uAD8C\uD55C \uD655\uC778] \uC744 \uD55C \uBC88 \uB204\uB974\uACE0,\n\uAD6C\uAE00\uC774 \uBB3B\uB294 \uCC3D\uC5D0\uC11C [\uD5C8\uC6A9] \uC744 \uB20C\uB7EC \uC8FC\uC138\uC694.\n\uADF8\uB2E4\uC74C \uC571\uC2A4 \uC2A4\uD06C\uB9BD\uD2B8\uC5D0\uC11C \uBC30\uD3EC \u2192 \uBC30\uD3EC \uAD00\uB9AC \u2192 \uC0C8 \uBC84\uC804 \u2192 \uBC30\uD3EC \uB97C \uD558\uC2DC\uBA74 \uB429\uB2C8\uB2E4.";
  function \uAD8C\uD55C\uBB38\uC81C_(e) {
    var t = String(e && e.message || e || "");
    return /permission|Permission|권한|PERMISSION_DENIED|authoriz/.test(t);
  }
  function \uADF8\uB9BC\uAD8C\uD55C\uD655\uC778() {
    var \uAE00;
    try {
      var f = \uADF8\uB9BC\uD3F4\uB354_();
      var \uC218 = 0;
      var it = f.getFiles();
      while (it.hasNext() && \uC218 < 1e3) {
        it.next();
        \uC218++;
      }
      \uAE00 = "\uC0AC\uC9C4\uC744 \uC62C\uB9B4 \uC218 \uC788\uC2B5\uB2C8\uB2E4.\n\n\uADF8\uB9BC \uD3F4\uB354: " + f.getName() + "\n\uC9C0\uAE08 \uB4E4\uC5B4 \uC788\uB294 \uADF8\uB9BC: " + \uC218 + "\uC7A5\n\uD3F4\uB354 \uC8FC\uC18C: " + f.getUrl() + "\n\n\uC774\uC81C \uBC30\uD3EC \u2192 \uBC30\uD3EC \uAD00\uB9AC \u2192 \uC218\uC815 \u2192 \uC0C8 \uBC84\uC804 \uC744 \uD55C \uB4A4\n\uC120\uC0DD\uB2D8 \uD654\uBA74 [\uC790\uB8CC \u2192 \uB2E8\uC5B4\uC7A5] \uC5D0\uC11C \uADF8\uB9BC\uC744 \uC62C\uB824 \uBCF4\uC138\uC694.";
    } catch (e) {
      \uAE00 = \uAD8C\uD55C\uBB38\uC81C_(e) ? '\uC544\uC9C1 \uB4DC\uB77C\uC774\uBE0C \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.\n\n\uC67C\uCABD \u2699 \uD504\uB85C\uC81D\uD2B8 \uC124\uC815\uC5D0\uC11C\n[appsscript.json \uB9E4\uB2C8\uD398\uC2A4\uD2B8 \uD30C\uC77C\uC744 \uD3B8\uC9D1\uAE30\uC5D0 \uD45C\uC2DC] \uB97C \uCF1C\uACE0,\noauthScopes \uC5D0 \uC544\uB798 \uD55C \uC904\uC744 \uB123\uC5B4 \uC8FC\uC138\uC694.\n\n  "https://www.googleapis.com/auth/drive"\n\n\uB123\uC740 \uB4A4 \uC774 \uBA54\uB274\uB97C \uB2E4\uC2DC \uB204\uB974\uBA74 \uAD6C\uAE00\uC774 \uD5C8\uC6A9 \uCC3D\uC744 \uB744\uC6C1\uB2C8\uB2E4.\n\n(\uAD6C\uAE00\uC774 \uC900 \uB9D0: ' + String(e && e.message || e) + ")" : "\uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4: " + String(e && e.message || e);
    }
    Logger.log(\uAE00);
    try {
      SpreadsheetApp.getUi().alert(
        "\uC601\uB2E8\uC5B4\uD559\uC2B5\uD504\uB85C\uADF8\uB7A8 \xB7 \uC0AC\uC9C4 \uAD8C\uD55C",
        \uAE00,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (e2) {
    }
    return \uAE00;
  }
  function \uADF8\uB9BC\uC800\uC7A5_(\uB2E8\uC5B4\uC7A5, \uC774\uB984, \uC790\uB8CC, \uC885\uB958) {
    var b = String(\uC790\uB8CC || "");
    var \uC27C = b.indexOf(",");
    if (b.indexOf("data:") === 0 && \uC27C > -1) b = b.slice(\uC27C + 1);
    if (!b) throw new Error("\uADF8\uB9BC\uC774 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.");
    var \uD30C\uC77C\uC774\uB984 = s_(\uB2E8\uC5B4\uC7A5).replace(/[\\/:*?"<>|]/g, "") + "_" + s_(\uC774\uB984).replace(/[\\/:*?"<>|]/g, "");
    var blob = Utilities.newBlob(Utilities.base64Decode(b), s_(\uC885\uB958) || "image/png", \uD30C\uC77C\uC774\uB984);
    var f = \uADF8\uB9BC\uD3F4\uB354_().createFile(blob);
    try {
      f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {
    }
    return \uADF8\uB9BC\uC8FC\uC18C_(f.getId());
  }
  function \uADF8\uB9BC\uC62C\uB9AC\uAE30(\uBE44\uBC88, \uB2E8\uC5B4\uC7A5, \uD589, \uC774\uB984, \uC790\uB8CC, \uC885\uB958) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var \uB9C9 = \uACFC\uBA74\uB9C9\uAE30_(\uB2E8\uC5B4\uC7A5);
    if (\uB9C9) return \uB9C9;
    var sh = \uB2E8\uC5B4\uC2DC\uD2B8_(\uB2E8\uC5B4\uC7A5);
    if (!sh) return { ok: false, \uBA54\uC2DC\uC9C0: "\uB2E8\uC5B4\uC7A5\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." };
    var n = Number(\uD589);
    if (!(n >= 2 && n <= sh.getLastRow())) return { ok: false, \uBA54\uC2DC\uC9C0: "\uC5C6\uB294 \uC904\uC785\uB2C8\uB2E4. \uC0C8\uB85C\uACE0\uCE68 \uD6C4 \uB2E4\uC2DC \uD574 \uC8FC\uC138\uC694." };
    var \uC8FC\uC18C;
    try {
      \uC8FC\uC18C = \uADF8\uB9BC\uC800\uC7A5_(\uB2E8\uC5B4\uC7A5, \uC774\uB984, \uC790\uB8CC, \uC885\uB958);
    } catch (e) {
      return { ok: false, \uBA54\uC2DC\uC9C0: \uAD8C\uD55C\uBB38\uC81C_(e) ? \uADF8\uB9BC\uAD8C\uD55C\uC548\uB0B4 : String(e && e.message || e) };
    }
    \uADF8\uB9BC\uCE78\uD655\uBCF4_(sh);
    sh.getRange(n, 4).setValue(\uC8FC\uC18C);
    return { ok: true, \uC8FC\uC18C };
  }
  function \uADF8\uB9BC\uC9C0\uC6B0\uAE30(\uBE44\uBC88, \uB2E8\uC5B4\uC7A5, \uD589) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var \uB9C9 = \uACFC\uBA74\uB9C9\uAE30_(\uB2E8\uC5B4\uC7A5);
    if (\uB9C9) return \uB9C9;
    var sh = \uB2E8\uC5B4\uC2DC\uD2B8_(\uB2E8\uC5B4\uC7A5);
    if (!sh) return { ok: false, \uBA54\uC2DC\uC9C0: "\uB2E8\uC5B4\uC7A5\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." };
    var n = Number(\uD589);
    if (!(n >= 2 && n <= sh.getLastRow())) return { ok: false, \uBA54\uC2DC\uC9C0: "\uC5C6\uB294 \uC904\uC785\uB2C8\uB2E4." };
    if (sh.getMaxColumns() >= 4) sh.getRange(n, 4).setValue("");
    return { ok: true };
  }
  function \uADF8\uB9BC\uC5EC\uB7EC\uAC1C(\uBE44\uBC88, \uB2E8\uC5B4\uC7A5, \uADF8\uB9BC\uB4E4) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var \uB9C9 = \uACFC\uBA74\uB9C9\uAE30_(\uB2E8\uC5B4\uC7A5);
    if (\uB9C9) return \uB9C9;
    var sh = \uB2E8\uC5B4\uC2DC\uD2B8_(\uB2E8\uC5B4\uC7A5);
    if (!sh) return { ok: false, \uBA54\uC2DC\uC9C0: "\uB2E8\uC5B4\uC7A5\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." };
    var last = sh.getLastRow();
    if (last < 2) return { ok: false, \uBA54\uC2DC\uC9C0: "\uB2E8\uC5B4\uC7A5\uC5D0 \uB2E8\uC5B4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4." };
    \uADF8\uB9BC\uCE78\uD655\uBCF4_(sh);
    var \uC601\uC5B4 = sh.getRange(2, 2, last - 1, 1).getValues();
    var \uD45C = {};
    \uC601\uC5B4.forEach(function(r, i) {
      var k = \uC5F4\uC1E0\uB9D0_(r[0]);
      if (k && !\uD45C[k]) \uD45C[k] = i + 2;
    });
    var \uBD99\uC778 = 0, \uBABB\uCC3E\uC740 = [], \uD0C8 = null;
    (\uADF8\uB9BC\uB4E4 || []).forEach(function(g) {
      if (\uD0C8) return;
      var \uD589 = \uD45C[\uC5F4\uC1E0\uB9D0_(g && g.\uC774\uB984)];
      if (!\uD589) {
        \uBABB\uCC3E\uC740.push(s_(g && g.\uC774\uB984));
        return;
      }
      try {
        sh.getRange(\uD589, 4).setValue(\uADF8\uB9BC\uC800\uC7A5_(\uB2E8\uC5B4\uC7A5, g.\uC774\uB984, g.\uC790\uB8CC, g.\uC885\uB958));
        \uBD99\uC778++;
      } catch (e) {
        \uD0C8 = \uAD8C\uD55C\uBB38\uC81C_(e) ? \uADF8\uB9BC\uAD8C\uD55C\uC548\uB0B4 : String(e && e.message || e);
      }
    });
    if (\uD0C8) return { ok: false, \uBA54\uC2DC\uC9C0: \uD0C8, \uBD99\uC778\uC218: \uBD99\uC778 };
    return { ok: true, \uBD99\uC778\uC218: \uBD99\uC778, \uBABB\uCC3E\uC740 };
  }
  function \uB2E8\uC5B4\uC7A5\uC774\uB984\uBCC0\uACBD(\uBE44\uBC88, \uC61B\uC774\uB984, \uC0C8\uC774\uB984) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var \uC61B = s_(\uC61B\uC774\uB984), \uC0C8 = s_(\uC0C8\uC774\uB984);
    if (!\uC0C8) return { ok: false, \uBA54\uC2DC\uC9C0: "\uC0C8 \uC774\uB984\uC744 \uC801\uC5B4 \uC8FC\uC138\uC694." };
    if (\uC61B === \uC0C8) return { ok: true, \uB2E8\uC5B4\uC7A5\uBAA9\uB85D: \uB2E8\uC5B4\uC7A5\uBAA9\uB85D() };
    if (\uB2E8\uC5B4\uC7A5\uCC3E\uAE30_(\uC0C8)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uAC19\uC740 \uC774\uB984\uC758 \uB2E8\uC5B4\uC7A5\uC774 \uC774\uBBF8 \uC788\uC2B5\uB2C8\uB2E4." };
    var b = \uB2E8\uC5B4\uC7A5\uCC3E\uAE30_(\uC61B);
    if (!b) return { ok: false, \uBA54\uC2DC\uC9C0: "\uB2E8\uC5B4\uC7A5\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." };
    \uBAA9\uB85D\uC2DC\uD2B8_().getRange(b.\uD589, 1).setValue(\uC0C8);
    var sh = ss_().getSheetByName(b.\uC2DC\uD2B8);
    if (sh) {
      try {
        var \uC0C8\uC2DC\uD2B8 = \uC2DC\uD2B8\uC774\uB984\uB9CC\uB4E4\uAE30_(\uC0C8);
        sh.setName(\uC0C8\uC2DC\uD2B8);
        \uBAA9\uB85D\uC2DC\uD2B8_().getRange(b.\uD589, 3).setValue(\uC0C8\uC2DC\uD2B8);
      } catch (e) {
      }
    }
    var hs = sheet_(SHEET.\uC219\uC81C);
    var hl = hs.getLastRow();
    if (hl >= 2) {
      var hr = hs.getRange(2, 2, hl - 1, 1);
      var hv = hr.getValues();
      for (var j = 0; j < hv.length; j++) if (s_(hv[j][0]) === \uC61B) hv[j][0] = \uC0C8;
      hr.setValues(hv);
    }
    \uBC30\uC815\uC815\uB9AC_(\uC61B, \uC0C8);
    return { ok: true, \uB2E8\uC5B4\uC7A5\uBAA9\uB85D: \uB2E8\uC5B4\uC7A5\uBAA9\uB85D() };
  }
  function \uB2E8\uC5B4\uC7A5\uC0AD\uC81C(\uBE44\uBC88, \uB2E8\uC5B4\uC7A5) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var \uC774\uB984 = s_(\uB2E8\uC5B4\uC7A5);
    var b = \uB2E8\uC5B4\uC7A5\uCC3E\uAE30_(\uC774\uB984);
    if (!b) return { ok: false, \uBA54\uC2DC\uC9C0: "\uB2E8\uC5B4\uC7A5\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." };
    var \uC9C0\uC6B4\uB2E8\uC5B4 = 0;
    var sh = ss_().getSheetByName(b.\uC2DC\uD2B8);
    if (sh) {
      \uC9C0\uC6B4\uB2E8\uC5B4 = Math.max(0, sh.getLastRow() - 1);
      ss_().deleteSheet(sh);
    }
    \uBAA9\uB85D\uC2DC\uD2B8_().deleteRow(b.\uD589);
    var hs = sheet_(SHEET.\uC219\uC81C);
    var hall = rows_(SHEET.\uC219\uC81C);
    var \uC9C0\uC6B4\uC219\uC81C = 0;
    for (var j = hall.length - 1; j >= 0; j--) {
      if (s_(hall[j][1]) === \uC774\uB984) {
        hs.deleteRow(j + 2);
        \uC9C0\uC6B4\uC219\uC81C++;
      }
    }
    \uBC30\uC815\uC815\uB9AC_(\uC774\uB984, "");
    return { ok: true, \uB2E8\uC5B4: \uC9C0\uC6B4\uB2E8\uC5B4, \uC219\uC81C: \uC9C0\uC6B4\uC219\uC81C, \uB2E8\uC5B4\uC7A5\uBAA9\uB85D: \uB2E8\uC5B4\uC7A5\uBAA9\uB85D() };
  }
  function \uBC88\uD638\uC7AC\uC815\uB82C_(\uB2E8\uC5B4\uC7A5) {
    var sh = \uB2E8\uC5B4\uC2DC\uD2B8_(\uB2E8\uC5B4\uC7A5);
    if (!sh) return;
    var last = sh.getLastRow();
    if (last < 2) return;
    var n = [];
    for (var i = 0; i < last - 1; i++) n.push([i + 1]);
    sh.getRange(2, 1, n.length, 1).setValues(n);
  }
  function \uD559\uC0DD\uBD99\uC5EC\uB123\uAE30(\uBE44\uBC88, \uBCF8\uBB38, \uAE30\uBCF8\uBE44\uBC88, \uD559\uB144\uAD6C\uBD84, \uD559\uB144, \uD559\uAD50, \uAD50\uC7AC) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false };
    var \uC774\uB984\uB4E4 = String(\uBCF8\uBB38 || "").split(/[\n,]/).map(function(x) {
      return x.trim();
    }).filter(function(x) {
      return x;
    });
    if (!\uC774\uB984\uB4E4.length) return { ok: false, \uBA54\uC2DC\uC9C0: "\uC774\uB984\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." };
    var \uC788\uB294\uAC83 = {};
    \uC804\uCCB4\uBA85\uB2E8_().forEach(function(n) {
      \uC788\uB294\uAC83[n] = 1;
    });
    var \uACB9\uCE68 = [];
    var sh = sheet_(SHEET.\uD559\uC0DD);
    var \uAC12 = [];
    \uC774\uB984\uB4E4.forEach(function(n) {
      var p = n.split(/\s+/);
      var \uC774\uB984 = p[0];
      if (\uC788\uB294\uAC83[\uC774\uB984]) {
        \uACB9\uCE68.push(\uC774\uB984);
        return;
      }
      \uC788\uB294\uAC83[\uC774\uB984] = 1;
      var pw = p[1] || s_(\uAE30\uBCF8\uBE44\uBC88) || "1234";
      \uAC12.push(["", \uC774\uB984, pw, \uD559\uB144\uAD6C\uBD84_(\uD559\uB144\uAD6C\uBD84), "", s_(\uD559\uB144), s_(\uD559\uAD50), \uAD50\uC7AC\uAE00_(\uAD50\uC7AC)]);
    });
    if (!\uAC12.length) {
      return { ok: false, \uBA54\uC2DC\uC9C0: "\uC774\uBBF8 \uC788\uB294 \uC774\uB984\uBFD0\uC785\uB2C8\uB2E4: " + \uACB9\uCE68.join(", ") };
    }
    \uBA85\uB2E8\uCE78\uD655\uBCF4_();
    sh.getRange(sh.getLastRow() + 1, 1, \uAC12.length, 8).setValues(\uAC12);
    SpreadsheetApp.flush();
    return { ok: true, \uAC1C\uC218: \uAC12.length, \uACB9\uCE68, \uD559\uC0DD: \uBA85\uB2E8\uAC00\uC838\uC624\uAE30(\uBE44\uBC88).\uD559\uC0DD };
  }
  var \uD559\uBD80\uBAA8\uCE78_ = ["\uD559\uBD80\uBAA8\uB9C1\uD06C", "\uD559\uBD80\uBAA8\uB9C8\uC9C0\uB9C9", "\uC120\uC0DD\uB2D8\uD55C\uB9C8\uB514"];
  var \uD559\uBD80\uBAA8\uC8FC\uC18C\uAE30\uBCF8_ = "https://smarthb-english.github.io/Vocab/parent.html";
  var \uD559\uBD80\uBAA8\uD2C0\uB9BC_ = "\uB9C1\uD06C\uAC00 \uB9DE\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC120\uC0DD\uB2D8\uAED8 \uBB38\uC758\uD574 \uC8FC\uC138\uC694.";
  var \uD559\uBD80\uBAA8\uCE90\uC2DC\uCD08_ = 60;
  function \uD559\uBD80\uBAA8\uCE78\uD655\uBCF4_() {
    var sh = \uBA85\uB2E8\uCE78\uD655\uBCF4_();
    if (typeof sh.getMaxColumns === "function" && sh.getMaxColumns() < 11) {
      sh.insertColumnsAfter(sh.getMaxColumns(), 11 - sh.getMaxColumns());
    }
    \uD559\uBD80\uBAA8\uCE78_.forEach(function(\uC774\uB984, i) {
      var \uCE78 = sh.getRange(1, 9 + i);
      if (s_(\uCE78.getValue()) === "") \uCE78.setValue(\uC774\uB984).setFontWeight("bold").setBackground("#EFF3F9");
    });
    return sh;
  }
  function \uD559\uBD80\uBAA8\uD1A0\uD070\uC0C8\uB85C_() {
    var a = Utilities.getUuid().replace(/-/g, "").toLowerCase();
    var b = Utilities.getUuid().replace(/-/g, "").toLowerCase();
    var t = "";
    for (var i = 0; i < a.length; i++) t += a.charAt(i) + b.charAt(b.length - 1 - i);
    return t;
  }
  function \uD1A0\uD070\uBAA8\uC591_(t) {
    return /^[0-9a-f]{32,128}$/.test(s_(t));
  }
  function \uD559\uBD80\uBAA8\uC8FC\uC18C_(\uD1A0\uD070) {
    return s_(setting_("\uD559\uBD80\uBAA8\uC8FC\uC18C", \uD559\uBD80\uBAA8\uC8FC\uC18C\uAE30\uBCF8_)) + "#k=" + \uD1A0\uD070;
  }
  function \uD1A0\uD070\uD559\uC0DD_(\uD1A0\uD070) {
    \uD1A0\uD070 = s_(\uD1A0\uD070).toLowerCase();
    if (!\uD1A0\uD070\uBAA8\uC591_(\uD1A0\uD070)) return null;
    var \uC904\uB4E4 = rows_(SHEET.\uD559\uC0DD);
    for (var i = 0; i < \uC904\uB4E4.length; i++) {
      var x = \uC904\uB4E4[i];
      if (x.length > 8 && s_(x[8]).toLowerCase() === \uD1A0\uD070 && s_(x[1])) return { \uD589: i + 2, \uC774\uB984: s_(x[1]), x };
    }
    return null;
  }
  function \uD559\uBD80\uBAA8\uCE90\uC2DC\uBC84\uB9AC\uAE30_(\uD1A0\uD070) {
    var c = \uCE90\uC2DC_();
    if (!c || !s_(\uD1A0\uD070)) return;
    try {
      c.remove("\uD559\uBD80\uBAA8|" + s_(\uD1A0\uD070).toLowerCase());
    } catch (e) {
    }
  }
  function \uD559\uBD80\uBAA8\uBCF4\uAE30(\uD1A0\uD070, \uC54C\uB9BC\uB9CC) {
    var \uD2C0\uB9BC = { ok: false, \uBA54\uC2DC\uC9C0: \uD559\uBD80\uBAA8\uD2C0\uB9BC_ };
    \uD1A0\uD070 = s_(\uD1A0\uD070).toLowerCase();
    if (!\uD1A0\uD070\uBAA8\uC591_(\uD1A0\uD070)) return \uD2C0\uB9BC;
    var \uC5F4\uC1E0 = "\uD559\uBD80\uBAA8|" + \uD1A0\uD070;
    var r = \uCE90\uC2DC\uC77D\uAE30_(\uC5F4\uC1E0);
    if (!(r && r.ok)) {
      var \uCC3E\uC740 = \uD1A0\uD070\uD559\uC0DD_(\uD1A0\uD070);
      if (!\uCC3E\uC740) return \uD2C0\uB9BC;
      if (!\uC54C\uB9BC\uB9CC) {
        try {
          \uD559\uBD80\uBAA8\uCE78\uD655\uBCF4_().getRange(\uCC3E\uC740.\uD589, 10).setValue(new Date2());
        } catch (e) {
        }
      }
      r = \uD559\uBD80\uBAA8\uC790\uB8CC_(\uCC3E\uC740.\uC774\uB984, \uCC3E\uC740.x);
      \uCE90\uC2DC\uB2F4\uAE30_(\uC5F4\uC1E0, r, \uD559\uBD80\uBAA8\uCE90\uC2DC\uCD08_);
    }
    if (\uC54C\uB9BC\uB9CC) return { ok: true, \uC774\uB984: r.\uC774\uB984, \uC548\uB0B8\uC218: r.\uC548\uB0B8\uC218 };
    return r;
  }
  function \uD559\uBD80\uBAA8\uB9C1\uD06C\uBC1C\uAE09(\uBE44\uBC88, \uC774\uB984) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    \uC774\uB984 = s_(\uC774\uB984);
    var sh = \uD559\uBD80\uBAA8\uCE78\uD655\uBCF4_();
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(1e4);
    } catch (e) {
      return { ok: false, \uBA54\uC2DC\uC9C0: "\uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694" };
    }
    try {
      var \uC904\uB4E4 = rows_(SHEET.\uD559\uC0DD), n = 0, \uC61B = "";
      for (var i = 0; i < \uC904\uB4E4.length; i++) if (s_(\uC904\uB4E4[i][1]) === \uC774\uB984) {
        n = i + 2;
        \uC61B = \uC904\uB4E4[i].length > 8 ? s_(\uC904\uB4E4[i][8]) : "";
        break;
      }
      if (!n) return { ok: false, \uBA54\uC2DC\uC9C0: "\uD559\uC0DD\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4." };
      var \uC0C8 = \uD559\uBD80\uBAA8\uD1A0\uD070\uC0C8\uB85C_();
      sh.getRange(n, 9).setValue(\uC0C8);
      sh.getRange(n, 10).setValue("");
      \uD559\uBD80\uBAA8\uCE90\uC2DC\uBC84\uB9AC\uAE30_(\uC61B);
      return { ok: true, \uC774\uB984, \uC8FC\uC18C: \uD559\uBD80\uBAA8\uC8FC\uC18C_(\uC0C8) };
    } finally {
      lock.releaseLock();
    }
  }
  function \uD559\uBD80\uBAA8\uD55C\uB9C8\uB514(\uBE44\uBC88, \uC774\uB984, \uAE00) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    \uC774\uB984 = s_(\uC774\uB984);
    \uAE00 = s_(\uAE00);
    if (\uAE00.length > 200) return { ok: false, \uBA54\uC2DC\uC9C0: "\uD55C\uB9C8\uB514\uB294 200\uC790\uAE4C\uC9C0 \uC801\uC744 \uC218 \uC788\uC5B4\uC694. (\uC9C0\uAE08 " + \uAE00.length + "\uC790)" };
    var sh = \uD559\uBD80\uBAA8\uCE78\uD655\uBCF4_();
    var \uC904\uB4E4 = rows_(SHEET.\uD559\uC0DD);
    for (var i = 0; i < \uC904\uB4E4.length; i++) {
      if (s_(\uC904\uB4E4[i][1]) !== \uC774\uB984) continue;
      sh.getRange(i + 2, 11).setValue(\uAE00);
      \uD559\uBD80\uBAA8\uCE90\uC2DC\uBC84\uB9AC\uAE30_(\uC904\uB4E4[i].length > 8 ? \uC904\uB4E4[i][8] : "");
      return { ok: true, \uC774\uB984, \uD55C\uB9C8\uB514: \uAE00 };
    }
    return { ok: false, \uBA54\uC2DC\uC9C0: "\uD559\uC0DD\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4." };
  }
  function \uD559\uBD80\uBAA8\uBBF8\uB9AC\uBCF4\uAE30(\uBE44\uBC88, \uC774\uB984) {
    if (!\uC120\uC0DD\uB2D8\uD655\uC778_(\uBE44\uBC88)) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4." };
    \uC774\uB984 = s_(\uC774\uB984);
    var \uC904\uB4E4 = rows_(SHEET.\uD559\uC0DD);
    for (var i = 0; i < \uC904\uB4E4.length; i++) if (s_(\uC904\uB4E4[i][1]) === \uC774\uB984) return \uD559\uBD80\uBAA8\uC790\uB8CC_(\uC774\uB984, \uC904\uB4E4[i]);
    return { ok: false, \uBA54\uC2DC\uC9C0: "\uD559\uC0DD\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4." };
  }
  function \uD559\uBD80\uBAA8\uC790\uB8CC_(\uC774\uB984, x) {
    return \uC77D\uB294\uB3D9\uC548_(function() {
      var \uC9C0\uAE08 = new Date2(), \uC624\uB298 = ymd_(\uC9C0\uAE08);
      var \uC5B4\uC81C\uB0A0 = new Date2(\uC9C0\uAE08.getTime());
      \uC5B4\uC81C\uB0A0.setDate(\uC5B4\uC81C\uB0A0.getDate() - 1);
      var \uC5B4\uC81C = ymd_(\uC5B4\uC81C\uB0A0);
      var \uC6D4 = new Date2(\uC9C0\uAE08.getTime());
      \uC6D4.setHours(0, 0, 0, 0);
      \uC6D4.setDate(\uC6D4.getDate() - (\uC6D4.getDay() + 6) % 7);
      var \uC6D4\uC694\uC77C = ymd_(\uC6D4);
      var \uC9E7\uC740\uB0A0 = function(ymd) {
        var p = String(ymd).split("-");
        return Number(p[1]) + "/" + Number(p[2]);
      };
      var \uC804\uBD80 = \uC219\uC81C\uAC00\uC838\uC624\uAE30_(\uC774\uB984, "");
      var \uC228\uAE40 = {};
      \uC77D\uAE30\uCE90\uC2DC_(SHEET.\uC219\uC81C).forEach(function(x2) {
        if ((x2.length > 17 ? s_(x2[17]) : "") === "1" && x2[6] instanceof Date2) \uC228\uAE40[x2[6].getTime()] = 1;
      });
      var \uAC10\uCDA4 = function(h) {
        return !!(h.\uB0B8\uB54C && \uC228\uAE40[h.\uB0B8\uB54C]);
      };
      function \uC81C\uBAA9(h) {
        return h.\uB2E8\uC5B4\uC7A5 + (h.\uCE78 ? " " + h.\uCE78 : "") + " " + h.\uC2DC\uC791 + "~" + h.\uB05D;
      }
      var \uC8FC\uC804\uCCB4 = \uC804\uBD80.filter(function(h) {
        return \uC219\uC81C\uC778\uAC00_(h) && !\uAC10\uCDA4(h) && (h.\uB9C8\uAC10\uC77C || h.\uB4F1\uB85D\uC77C || "") >= \uC6D4\uC694\uC77C;
      });
      var \uC774\uBC88\uC8FC = \uC8FC\uC804\uCCB4.filter(function(h) {
        return !h.\uC644\uB8CC || (h.\uB9C8\uAC10\uC77C || h.\uB4F1\uB85D\uC77C || "") >= \uC5B4\uC81C;
      }).map(function(h) {
        var \uB2E4\uC2DC = !h.\uC644\uB8CC && (h.\uB2E8\uACC4 ? Number(h.\uC751\uC2DC\uC218) > 0 : !!h.\uBAA8\uC790\uB78C);
        return {
          \uC81C\uBAA9: \uC81C\uBAA9(h),
          \uC720\uD615: \uC720\uD615\uC54C\uB9F9\uC774_(h.\uC720\uD615),
          \uC885\uB958: h.\uC885\uB958,
          \uC644\uB8CC: !!h.\uC644\uB8CC,
          \uB2E4\uC2DC,
          \uB9C8\uAC10\uC77C: h.\uB9C8\uAC10\uC77C || "",
          \uB9C8\uAC10\uAE00: h.\uB9C8\uAC10\uC77C ? \uC9E7\uC740\uB0A0(h.\uB9C8\uAC10\uC77C) : "",
          \uC624\uB298\uAE4C\uC9C0: h.\uB9C8\uAC10\uC77C === \uC624\uB298,
          \uC9C0\uB0A8: !!(h.\uB9C8\uAC10\uC77C && h.\uB9C8\uAC10\uC77C < \uC624\uB298)
        };
      });
      var \uBCFC\uC2DC\uD5D8 = \uC804\uBD80.filter(function(h) {
        return \uC2DC\uD5D8\uC778\uAC00_(h) && !h.\uC644\uB8CC && !\uAC10\uCDA4(h) && (h.\uB9C8\uAC10\uC77C || "") >= \uC5B4\uC81C;
      }).map(function(h) {
        return {
          \uB0A0\uC9DC: h.\uB9C8\uAC10\uC77C ? \uC9E7\uC740\uB0A0(h.\uB9C8\uAC10\uC77C) : "",
          \uB2E8\uC5B4\uC7A5: h.\uB2E8\uC5B4\uC7A5 + (h.\uCE78 ? " " + h.\uCE78 : ""),
          \uBC94\uC704: h.\uC2DC\uC791 + "~" + h.\uB05D,
          \uC720\uD615: \uC720\uD615\uC54C\uB9F9\uC774_(h.\uC720\uD615),
          \uC810\uC218: null,
          \uBD24\uB098: false,
          \uC9C0\uB0A8: !!(h.\uB9C8\uAC10\uC77C && h.\uB9C8\uAC10\uC77C < \uC624\uB298)
        };
      });
      \uC774\uBC88\uC8FC.sort(function(a, b) {
        if (a.\uC644\uB8CC !== b.\uC644\uB8CC) return a.\uC644\uB8CC ? 1 : -1;
        return (a.\uB9C8\uAC10\uC77C || "9") < (b.\uB9C8\uAC10\uC77C || "9") ? -1 : (a.\uB9C8\uAC10\uC77C || "9") > (b.\uB9C8\uAC10\uC77C || "9") ? 1 : 0;
      });
      var \uB0B4\uAE30\uB85D2 = [];
      \uC77D\uAE30\uCE90\uC2DC_(SHEET.\uAE30\uB85D).forEach(function(r) {
        if (!(r[0] instanceof Date2) || s_(r[2]) !== \uC774\uB984 || s_(r[14]) === \uC7AC\uC2DC\uD5D8\uD45C\uC2DC) return;
        \uB0B4\uAE30\uB85D2.push(r);
      });
      \uB0B4\uAE30\uB85D2.sort(function(a, b) {
        return b[0].getTime() - a[0].getTime();
      });
      var \uBCF8\uC2DC\uD5D8 = \uB0B4\uAE30\uB85D2.filter(function(r) {
        return s_(r[14]) === \uC2DC\uD5D8\uD45C\uC2DC;
      }).slice(0, 8).map(function(r) {
        return { \uB0A0\uC9DC: \uC9E7\uC740\uB0A0(ymd_(r[0])), \uB2E8\uC5B4\uC7A5: s_(r[3]), \uBC94\uC704: s_(r[4]), \uC720\uD615: s_(r[5]), \uC810\uC218: Number(r[8]) || 0, \uBD24\uB098: true };
      });
      var \uAE30\uC900 = new Date2(\uC9C0\uAE08.getTime() - 30 * 864e5), \uC148 = {};
      \uB0B4\uAE30\uB85D2.forEach(function(r) {
        if (r[0] < \uAE30\uC900) return;
        \uD2C0\uB9B0\uCE78\uD480\uAE30_(r[13]).forEach(function(w) {
          var k = w.toLowerCase();
          (\uC148[k] = \uC148[k] || { \uB2E8\uC5B4: w, \uBC88: 0 }).\uBC88++;
        });
      });
      var \uC790\uC8FC\uD2C0\uB9B0 = Object.keys(\uC148).map(function(k) {
        return \uC148[k];
      }).filter(function(w) {
        return w.\uBC88 >= 2;
      }).sort(function(a, b) {
        return b.\uBC88 - a.\uBC88;
      }).slice(0, 10);
      var \uCC45\uB4E4 = {};
      \uB2E8\uC5B4\uC7A5\uBAA9\uB85D().forEach(function(b) {
        \uCC45\uB4E4[b.\uC774\uB984] = b;
      });
      var \uC9C4 = {};
      \uC804\uBD80.forEach(function(h) {
        if (\uB204\uC801\uC778\uAC00_(h.\uC720\uD615) || \uC2DC\uD5D8\uC778\uAC00_(h)) return;
        var k = h.\uB2E8\uC5B4\uC7A5 + "|" + (h.\uCE78 || "");
        var v = \uC9C4[k] = \uC9C4[k] || { \uB2E8\uC5B4\uC7A5: h.\uB2E8\uC5B4\uC7A5, \uCE78: h.\uCE78 || "", \uB05D: 0, \uB4F1\uB85D: "" };
        if ((Number(h.\uB05D) || 0) > v.\uB05D) v.\uB05D = Number(h.\uB05D) || 0;
        if ((h.\uB4F1\uB85D\uC77C || "") > v.\uB4F1\uB85D) v.\uB4F1\uB85D = h.\uB4F1\uB85D\uC77C || "";
      });
      var \uC9C4\uB3C4 = Object.keys(\uC9C4).map(function(k) {
        return \uC9C4[k];
      }).sort(function(a, b) {
        return a.\uB4F1\uB85D < b.\uB4F1\uB85D ? 1 : a.\uB4F1\uB85D > b.\uB4F1\uB85D ? -1 : 0;
      }).slice(0, 3).map(function(v) {
        var b = \uCC45\uB4E4[v.\uB2E8\uC5B4\uC7A5] || {};
        var \uCD1D = v.\uCE78 && b.\uCE78\uC218 ? Number(b.\uCE78\uC218[v.\uCE78]) || 0 : Number(b.\uAC1C\uC218) || 0;
        return { \uB2E8\uC5B4\uC7A5: v.\uB2E8\uC5B4\uC7A5, \uCE78: v.\uCE78, \uB05D: \uCD1D ? Math.min(v.\uB05D, \uCD1D) : v.\uB05D, \uCD1D };
      });
      return {
        ok: true,
        \uC774\uB984,
        \uC624\uB298: \uC9E7\uC740\uB0A0(\uC624\uB298),
        \uD55C\uB9C8\uB514: x && x.length > 10 ? s_(x[10]) : "",
        \uC774\uBC88\uC8FC\uC219\uC81C: \uC774\uBC88\uC8FC,
        \uB0B8\uC218: \uC8FC\uC804\uCCB4.filter(function(h) {
          return h.\uC644\uB8CC;
        }).length,
        // 숙제만 센다 — 시험은 안 섞는다. 목록에서 치운 것도 센다
        \uC548\uB0B8\uC218: \uC8FC\uC804\uCCB4.filter(function(h) {
          return !h.\uC644\uB8CC;
        }).length,
        \uC2DC\uD5D8: \uBCFC\uC2DC\uD5D8.concat(\uBCF8\uC2DC\uD5D8),
        // 앞으로 볼 것 → 본 것(최근부터)
        \uC790\uC8FC\uD2C0\uB9B0,
        \uC9C4\uB3C4,
        \uD559\uC6D0: { \uC774\uB984: s_(setting_("\uD559\uC6D0\uC774\uB984", "\uD64D\uC81C\uC778\uC655\uC601\uC5B4")), \uC804\uD654: s_(setting_("\uD559\uC6D0\uC804\uD654", "")) }
      };
    });
  }
  if (dependencies.saveImage) \uADF8\uB9BC\uC800\uC7A5_ = dependencies.saveImage;
  return {
    call(name, args = []) {
      if (!Object.prototype.hasOwnProperty.call(\uC5F4\uB9B0\uAE30\uB2A5_, name)) throw new Error("\uC4F8 \uC218 \uC5C6\uB294 \uAE30\uB2A5\uC785\uB2C8\uB2E4: " + name);
      \uC77D\uC740\uAC83_ = null;
      const result = \uC5F4\uB9B0\uAE30\uB2A5_[name].apply(null, args);
      \uB2F4\uC740\uAC83\uBC84\uB9AC\uAE30_(name);
      return result;
    },
    monthly() {
      return \uB9E4\uC6D4\uC2DC\uC0C1();
    },
    names: Object.keys(\uC5F4\uB9B0\uAE30\uB2A5_)
  };
}

// services/legacy-runtime.mjs
function createRuntime(store, { now = () => Date.now(), uuid = () => randomId(), effects = {} } = {}) {
  const cache = /* @__PURE__ */ new Map();
  const noEffect = (name) => () => {
    throw new Error(`External capability is not configured: ${name}`);
  };
  const cacheService = {
    get: (key) => cache.get(key) ?? null,
    getAll: (keys) => Object.fromEntries(keys.filter((k) => cache.has(k)).map((k) => [k, cache.get(k)])),
    put: (key, value) => cache.set(key, value),
    putAll: (values) => Object.entries(values).forEach(([k, v]) => cache.set(k, v)),
    remove: (key) => cache.delete(key),
    removeAll: (keys) => keys.forEach((key) => cache.delete(key))
  };
  return createLegacyEngine({
    Date: createSeoulDate(now),
    saveImage: effects.saveImage,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => store,
      flush() {
      },
      WrapStrategy: { WRAP: "WRAP", CLIP: "CLIP" },
      getUi: noEffect("spreadsheet UI"),
      newDataValidation() {
        return { requireValueInRange() {
          return this;
        }, setAllowInvalid() {
          return this;
        }, build() {
          return {};
        } };
      }
    },
    Utilities: { formatDate, getUuid: uuid, ...effects.Utilities },
    Session: { getScriptTimeZone: () => "Asia/Seoul" },
    // All edits stay inside an isolated store. The repository must commit atomically.
    LockService: { getScriptLock: () => ({ waitLock() {
    }, releaseLock() {
    } }) },
    CacheService: { getScriptCache: () => effects.cache ?? cacheService },
    Logger: { log() {
    } },
    PropertiesService: effects.PropertiesService,
    DriveApp: effects.DriveApp,
    UrlFetchApp: effects.UrlFetchApp,
    ScriptApp: effects.ScriptApp,
    ContentService: effects.ContentService,
    HtmlService: effects.HtmlService
  });
}

// services/store-codec.mjs
var SeoulDate2 = createSeoulDate();
function pack(value) {
  return JSON.stringify(value, function(key, item) {
    const original = this[key];
    if (original instanceof Date) return { $date: original.getTime() };
    return item;
  });
}
function unpack(value) {
  return JSON.parse(value, (_, item) => item && typeof item === "object" && Object.keys(item).length === 1 && "$date" in item ? new SeoulDate2(item.$date) : item);
}
function sheetId(name) {
  return encodeURIComponent(name).replaceAll(".", "%2E");
}
function publicTable(table) {
  const output = unpack(pack(table));
  if (table.name === "\uD559\uC0DD") {
    for (const [key, cell] of Object.entries(output.cells)) {
      const [row, column] = key.split(":").map(Number);
      if (row > 1 && [3, 9].includes(column)) {
        cell.value = "";
        cell.note = "";
      }
    }
  }
  if (table.name === "\uC124\uC815") {
    for (let row = 2; row <= table.maxRows; row++) {
      const key = String(output.cells[`${row}:1`]?.value ?? "").trim();
      if (["\uC120\uC0DD\uB2D8\uBE44\uBC00\uBC88\uD638", "\uD478\uC2DC\uBE44\uBC00\uD0A4"].includes(key)) {
        if (output.cells[`${row}:2`]) {
          output.cells[`${row}:2`].value = "";
          output.cells[`${row}:2`].note = "";
        }
      }
    }
  }
  return output;
}
function tableMetadata(table, position) {
  const cells = Object.entries(table.cells).filter(([, c]) => c.value !== "" && c.value != null);
  return {
    name: table.name,
    position,
    maxRows: table.maxRows,
    maxColumns: table.maxColumns,
    hidden: table.hidden,
    lastRow: Math.max(0, ...cells.map(([k]) => Number(k.split(":")[0]))),
    lastColumn: Math.max(0, ...cells.map(([k]) => Number(k.split(":")[1])))
  };
}

// services/dataset-model.mjs
async function createDatasetDocuments(store, { digest: digest2, previousIdentities = [], newId = () => randomId() } = {}) {
  const documents = /* @__PURE__ */ new Map(), tables = [];
  for (const [position, table] of store.getSheets().entries()) {
    const full = table.export(), visible = publicTable(full), payload = pack(visible), version = await digest2(payload);
    const meta = { ...tableMetadata(full, position), version };
    documents.set(`tables/${sheetId(full.name)}`, { payload, version, name: full.name, public: ["\uD559\uC0DD", "\uC124\uC815", "\uB2E8\uC5B4\uC7A5\uBAA9\uB85D", "\uACF5\uC9C0"].includes(full.name) || full.name.startsWith("\uB2E8\uC5B4_") });
    if (["\uD559\uC0DD", "\uC124\uC815"].includes(full.name)) {
      const secret = { name: full.name, cells: Object.fromEntries(Object.entries(full.cells).filter(([k, c]) => pack(c) !== pack(visible.cells[k]))) };
      const payload2 = pack(secret), version2 = await digest2(payload2);
      documents.set(`secrets/${sheetId(full.name)}`, { payload: payload2, version: version2 });
      meta.secretVersion = version2;
    }
    tables.push(meta);
  }
  const students = store.getSheetByName("\uD559\uC0DD");
  const identities = [];
  for (let row = 2; row <= students.getLastRow(); row++) {
    const r = students.getRange(row, 1, 1, Math.max(11, students.getLastColumn())).getValues()[0];
    const name = String(r[1] ?? "").trim();
    if (!name) continue;
    const id = previousIdentities.find((i) => i.row === row)?.id ?? "student-" + newId();
    identities.push({ id, name, row });
    documents.set(`credentials/${id}`, { role: "student", name, row, pinHash: await digest2(String(r[2] ?? "").trim()) });
    const token = String(r[8] ?? "").trim().toLowerCase();
    if (/^[0-9a-f]{32,128}$/.test(token)) {
      const credentialId = "parent-" + id;
      documents.set(`credentials/${credentialId}`, { role: "parent", name, row, pinHash: await digest2(token) });
      documents.set(`links/${token}`, { credentialId, name, row });
    }
  }
  const settings = store.getSheetByName("\uC124\uC815");
  const rows = settings.getRange(2, 1, Math.max(1, settings.getLastRow() - 1), 2).getValues();
  const pin = String(rows.find((r) => String(r[0]).trim() === "\uC120\uC0DD\uB2D8\uBE44\uBC00\uBC88\uD638")?.[1] ?? "1234").trim();
  documents.set("credentials/teacher", { role: "teacher", pinHash: await digest2(pin) });
  documents.set("meta/catalog", { tables, identities, revision: "initial" });
  return { documents, tables, identities };
}

// services/firestore-repository.mjs
var digest = async (text) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))), (b) => b.toString(16).padStart(2, "0")).join("");
var jsonResult = (result) => result === void 0 ? void 0 : JSON.parse(JSON.stringify(result));
var auxUrl = "https://asia-northeast3-smarthb-vocab-20261007.cloudfunctions.net/aux";
async function auxiliary(user, fn, args) {
  const response = await fetch(auxUrl, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + await user.getIdToken() }, body: JSON.stringify({ fn, args }) });
  const reply = await response.json().catch(() => null);
  if (!reply?.ok) throw new Error(reply?.\uBA54\uC2DC\uC9C0 || "\uC11C\uBC84\uAC00 \uB2F5\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4");
  return reply.\uAC12;
}
var privileged = (role) => role === "teacher" || role === "bridge";
var FirestoreRepository = class {
  constructor(db2, dataset, identity) {
    this.db = db2;
    this.dataset = dataset;
    this.identity = identity;
    this.cache = /* @__PURE__ */ new Map();
    this.parentCache = null;
    this.auxiliary = (fn, args) => auxiliary(this.identity.user, fn, args);
  }
  ref(path) {
    return doc(this.db, `vocabDatasets/${this.dataset}/${path}`);
  }
  async catalog(reader = (ref) => getDoc(ref)) {
    const d = await reader(this.ref("meta/catalog"));
    if (!d.exists()) throw new Error("\uC790\uB8CC \uC774\uAD00 \uC900\uBE44\uAC00 \uB05D\uB098\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
    return d.data();
  }
  async load(catalog, reader, { publicOnly = false, fresh = false } = {}) {
    const role = this.identity.role;
    const tables = await Promise.all(catalog.tables.map(async (meta) => {
      const isPublic = ["\uD559\uC0DD", "\uC124\uC815", "\uB2E8\uC5B4\uC7A5\uBAA9\uB85D", "\uACF5\uC9C0"].includes(meta.name) || meta.name.startsWith("\uB2E8\uC5B4_");
      if (publicOnly && !isPublic) return null;
      const id = sheetId(meta.name), version = meta.version;
      const fetchPayload = async (section, expected) => {
        const key = section + "/" + id;
        const cached = this.cache.get(key);
        if (!fresh && cached?.version === expected) return unpack(cached.payload);
        const d = await reader(this.ref(key));
        if (!d.exists()) throw new Error("\uC790\uB8CC \uC77C\uBD80\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC0C8\uB85C\uACE0\uCE68 \uD6C4 \uB2E4\uC2DC \uD574 \uC8FC\uC138\uC694.");
        const data = d.data();
        if (!fresh) this.cache.set(key, data);
        return unpack(data.payload);
      };
      const table = await fetchPayload("tables", version);
      if (privileged(role) && ["\uD559\uC0DD", "\uC124\uC815"].includes(meta.name)) {
        const secret = await fetchPayload("secrets", meta.secretVersion);
        Object.assign(table.cells, secret.cells);
      }
      return table;
    }));
    const store = new TableStore(tables.filter(Boolean));
    if (this.identity.role === "student" && this.identity.pin !== void 0) {
      const s = store.getSheetByName("\uD559\uC0DD");
      if (s) s.cells[`${this.identity.row}:3`] = { value: this.identity.pin, note: "", format: "General" };
    }
    if (this.identity.role === "parent") {
      const s = store.getSheetByName("\uD559\uC0DD");
      if (s) s.cells[`${this.identity.row}:9`] = { value: this.identity.token, note: "", format: "General" };
    }
    return store;
  }
  async grant(credentialId, proof) {
    const user = this.identity.user;
    await setDoc(doc(this.db, `sessions/${user.uid}`), { dataset: this.dataset, credentialId, proof });
  }
  async studentLogin(name, pin) {
    const catalog = await this.catalog();
    const identities = catalog.identities;
    const exact = String(name ?? "").trim();
    const match = identities.find((i) => i.name === exact) ?? identities.find((i) => i.name.replace(/\s/g, "") === exact.replace(/\s/g, ""));
    if (!match) return { ok: false, \uBA54\uC2DC\uC9C0: "\uBA85\uB2E8\uC5D0 \uC5C6\uB294 \uC774\uB984\uC774\uC5D0\uC694. \uC120\uC0DD\uB2D8\uAED8 \uB9D0\uC500\uB4DC\uB9AC\uC138\uC694." };
    const cleanPin = String(pin ?? "").trim();
    try {
      await this.grant(match.id, await digest(cleanPin));
    } catch (e) {
      if (e.code === "permission-denied") return { ok: false, \uBA54\uC2DC\uC9C0: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB2EC\uB77C\uC694." };
      throw e;
    }
    Object.assign(this.identity, { role: "student", credentialId: match.id, row: match.row, name: match.name, pin: cleanPin });
    const store = await this.load(catalog, (ref) => getDoc(ref), { publicOnly: true });
    return jsonResult(createRuntime(store).call("\uB85C\uADF8\uC778", [name, pin]));
  }
  async teacherLogin(pin) {
    try {
      await this.grant("teacher", await digest(String(pin ?? "").trim()));
    } catch (e) {
      if (e.code === "permission-denied") return { ok: false };
      throw e;
    }
    Object.assign(this.identity, { role: "teacher", pin: String(pin ?? "").trim() });
    return { ok: true };
  }
  async parentLogin(token) {
    const clean = String(token ?? "").trim().toLowerCase();
    if (!/^[0-9a-f]{32,128}$/.test(clean)) return false;
    const link = await getDoc(this.ref(`links/${clean}`));
    if (!link.exists()) return false;
    const data = link.data();
    await this.grant(data.credentialId, await digest(clean));
    Object.assign(this.identity, { role: "parent", token: clean, row: data.row, name: data.name, credentialId: data.credentialId });
    return true;
  }
  async call(fn, args) {
    if (fn === "\uB85C\uADF8\uC778") return this.studentLogin(...args);
    if (fn === "\uC120\uC0DD\uB2D8\uB85C\uADF8\uC778") return this.teacherLogin(...args);
    if (fn === "\uD559\uBD80\uBAA8\uBCF4\uAE30") {
      if (!await this.parentLogin(args[0])) return { ok: false, \uBA54\uC2DC\uC9C0: "\uB9C1\uD06C\uAC00 \uB9DE\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC120\uC0DD\uB2D8\uAED8 \uBB38\uC758\uD574 \uC8FC\uC138\uC694." };
    }
    const publicOnly = ["\uC2DC\uC791\uC815\uBCF4", "\uD478\uC2DC\uACF5\uAC1C\uD0A4", "\uACF5\uC9C0\uAC00\uC838\uC624\uAE30"].includes(fn) && !this.identity.role;
    const catalog = await this.catalog();
    if (fn === "\uD559\uBD80\uBAA8\uBCF4\uAE30" && this.parentCache?.token === this.identity.token && this.parentCache.revision === catalog.revision && this.parentCache.until > Date.now()) {
      const value = this.parentCache.value;
      return args[1] ? { ok: true, \uC774\uB984: value.\uC774\uB984, \uC548\uB0B8\uC218: value.\uC548\uB0B8\uC218 } : jsonResult(value);
    }
    if (fn === "\uD478\uC2DC\uC804\uC1A1") return this.auxiliary(fn, args);
    const store = await this.load(catalog, (ref) => getDoc(ref), { publicOnly });
    const started = Date.now();
    const ids = [];
    const imageOperation = ["\uADF8\uB9BC\uC62C\uB9AC\uAE30", "\uADF8\uB9BC\uC5EC\uB7EC\uAC1C"].includes(fn);
    let planningImages = imageOperation;
    const images = /* @__PURE__ */ new Map();
    const saveImage2 = (...job) => {
      const key = JSON.stringify(job);
      if (planningImages) {
        if (!images.has(key)) images.set(key, { job });
        return "image-upload-planned:" + images.size;
      }
      const cached = images.get(key);
      if (!cached) throw new Error("\uC790\uB8CC\uAC00 \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
      if (cached.error) throw cached.error;
      return cached.url;
    };
    const execute = (current) => {
      let index = 0;
      const engine = createRuntime(current, { effects: { saveImage: imageOperation ? saveImage2 : void 0 }, now: () => started, uuid: () => {
        const i = index++;
        return ids[i] ?? (ids[i] = randomId());
      } });
      return fn === "__\uC6D4\uC2DC\uC0C1" ? engine.monthly() : engine.call(fn, args);
    };
    const result = execute(store);
    if (imageOperation) {
      planningImages = false;
      for (const cached of images.values()) {
        try {
          cached.url = await this.auxiliary("__\uADF8\uB9BC\uD30C\uC77C", [args[0], ...cached.job]);
        } catch (error) {
          cached.error = error;
        }
      }
    }
    if (!store.deleted.size && !store.getSheets().some((s) => s.dirty)) return jsonResult(result);
    const requestId = this.identity.user.uid + "_" + randomId();
    return runTransaction(this.db, async (transaction) => {
      const oldReceipt = await transaction.get(this.ref(`journal/${requestId}`));
      if (oldReceipt.exists()) return unpack(oldReceipt.data().result);
      const currentCatalog = await this.catalog((ref) => transaction.get(ref));
      const current = await this.load(currentCatalog, (ref) => transaction.get(ref), { fresh: true });
      const originalTables = current.export();
      const answer = jsonResult(execute(current));
      const compiled = current.getSheetByName("\uD559\uC0DD")?.dirty || current.getSheetByName("\uC124\uC815")?.dirty ? await createDatasetDocuments(current, { digest, previousIdentities: currentCatalog.identities }) : null;
      const before = new Map(currentCatalog.tables.map((t) => [t.name, t]));
      const changes = [];
      const tables = current.getSheets();
      const nextMetadata = [];
      for (let position = 0; position < tables.length; position++) {
        const table = tables[position];
        if (!table.dirty) {
          nextMetadata.push(before.get(table.name));
          continue;
        }
        const full = table.export(), visible = publicTable(full), payload = pack(visible);
        if (new TextEncoder().encode(payload).length > 85e4) throw new Error("\uC790\uB8CC\uAC00 \uCEE4\uC11C \uB098\uB204\uC5B4 \uC800\uC7A5\uD574\uC57C \uD569\uB2C8\uB2E4.");
        const version = await digest(payload), meta = { ...tableMetadata(full, position), version };
        transaction.set(this.ref(`tables/${sheetId(full.name)}`), { payload, version, name: full.name, public: ["\uD559\uC0DD", "\uC124\uC815", "\uB2E8\uC5B4\uC7A5\uBAA9\uB85D", "\uACF5\uC9C0"].includes(full.name) || full.name.startsWith("\uB2E8\uC5B4_") });
        if (["\uD559\uC0DD", "\uC124\uC815"].includes(full.name) && privileged(this.identity.role)) {
          const secret = { name: full.name, cells: Object.fromEntries(Object.entries(full.cells).filter(([key, c]) => pack(c) !== pack(visible.cells[key]))) };
          const secretPayload = pack(secret), secretVersion = await digest(secretPayload);
          transaction.set(this.ref(`secrets/${sheetId(full.name)}`), { payload: secretPayload, version: secretVersion });
          meta.secretVersion = secretVersion;
        } else if (before.get(full.name)?.secretVersion) meta.secretVersion = before.get(full.name).secretVersion;
        nextMetadata.push(meta);
        changes.push(full.name);
        transaction.set(this.ref(`journal/${requestId}/tables/${sheetId(full.name)}`), { payload: pack(full) });
      }
      for (const name of current.deleted) if (!tables.some((t) => t.name === name)) {
        transaction.delete(this.ref(`tables/${sheetId(name)}`));
        changes.push(name);
      }
      transaction.set(this.ref("meta/catalog"), { ...currentCatalog, tables: nextMetadata, revision: fn === "\uD559\uBD80\uBAA8\uBCF4\uAE30" ? currentCatalog.revision : requestId, identities: compiled?.identities ?? currentCatalog.identities });
      if (compiled && privileged(this.identity.role)) {
        for (const [path, data] of compiled.documents) if (path.startsWith("credentials/") || path.startsWith("links/")) transaction.set(this.ref(path), data);
        const nextPaths = new Set(compiled.documents.keys());
        for (const identity of currentCatalog.identities) {
          if (!nextPaths.has("credentials/" + identity.id)) transaction.delete(this.ref("credentials/" + identity.id));
          if (!nextPaths.has("credentials/parent-" + identity.id)) transaction.delete(this.ref("credentials/parent-" + identity.id));
        }
        const students = originalTables.find((t) => t.name === "\uD559\uC0DD");
        for (const [key, cell] of Object.entries(students?.cells ?? {})) {
          if (!key.endsWith(":9")) continue;
          const token = String(cell.value ?? "").trim().toLowerCase();
          if (/^[0-9a-f]{32,128}$/.test(token) && !nextPaths.has("links/" + token)) transaction.delete(this.ref("links/" + token));
        }
      }
      transaction.set(this.ref(`journal/${requestId}`), { actor: this.identity.user.uid, fn, result: pack(answer), changes, at: started });
      this.cache.clear();
      if (fn === "\uD559\uBD80\uBAA8\uBCF4\uAE30" && !args[1] && answer?.ok) this.parentCache = { token: this.identity.token, revision: currentCatalog.revision, until: started + 6e4, value: answer };
      return answer;
    });
  }
};

// functions/src/index.mjs
initializeApp();
var db = getFirestore();
var adminDb = () => db;
var region = "asia-northeast3";
async function teacherOk(uid) {
  const config = (await db.doc("runtime/config").get()).data();
  const session = (await db.doc(`sessions/${uid}`).get()).data();
  if (!config || config.state !== "active" || !session || session.dataset !== config.dataset) return false;
  const credential = (await db.doc(`vocabDatasets/${config.dataset}/credentials/${session.credentialId}`).get()).data();
  return !!credential && ["teacher", "bridge"].includes(credential.role) && credential.pinHash === session.proof;
}
var pushHosts = ["fcm.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"];
function pushAddressOk(address) {
  try {
    const u = new URL(address);
    return u.protocol === "https:" && pushHosts.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
  } catch {
    return false;
  }
}
async function sendPush(list, messaging = getMessaging()) {
  const \uC904 = await Promise.all((list || []).map(async (x) => {
    const \uC8FC\uC18C = String(x?.\uC8FC\uC18C ?? "");
    if (\uC8FC\uC18C.startsWith("fcm:")) {
      const token = \uC8FC\uC18C.slice(4);
      if (!/^[A-Za-z0-9_:\-]{20,4096}$/.test(token)) return { \uC8FC\uC18C, \uC0C1\uD0DC: 400, \uAE00: "FCM \uD1A0\uD070\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." };
      try {
        await messaging.send({ token, notification: { title: "\uC778\uC655\uBCF4\uCE74", body: "\uC0C8 \uD559\uC6D0 \uC54C\uB9BC\uC774 \uC788\uC5B4\uC694. \uC571\uC5D0\uC11C \uD655\uC778\uD574 \uC8FC\uC138\uC694." }, data: { route: "notices" }, android: { priority: "high", notification: { channelId: "academy", icon: "ic_stat_bell" } } });
        return { \uC8FC\uC18C, \uC0C1\uD0DC: 200, \uAE00: "" };
      } catch (e) {
        const dead = ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(e.code);
        return { \uC8FC\uC18C, \uC0C1\uD0DC: dead ? 410 : 0, \uAE00: String(e.code || "FCM \uC804\uC1A1 \uC2E4\uD328") };
      }
    }
    if (!pushAddressOk(\uC8FC\uC18C)) return { \uC8FC\uC18C, \uC0C1\uD0DC: 0, \uAE00: "\uC54C\uB9BC \uC11C\uBC84 \uC8FC\uC18C\uAC00 \uC544\uB2D9\uB2C8\uB2E4." };
    try {
      const r = await fetch(\uC8FC\uC18C, { method: "POST", body: "", headers: { TTL: "86400", Authorization: `vapid t=${x.\uD45C}, k=${x.\uACF5\uAC1C\uD0A4}` } });
      return { \uC8FC\uC18C, \uC0C1\uD0DC: r.status, \uAE00: (await r.text()).slice(0, 200) };
    } catch (e) {
      return { \uC8FC\uC18C, \uC0C1\uD0DC: 0, \uAE00: String(e?.message ?? e).slice(0, 200) };
    }
  }));
  return { ok: true, \uC904 };
}
var \uC774\uB984\uB2E4\uB4EC\uAE30 = (v) => String(v ?? "").replace(/[\\/:*?"<>|]/g, "");
async function saveImage(\uB2E8\uC5B4\uC7A5, \uC774\uB984, \uC790\uB8CC, \uC885\uB958) {
  const raw = String(\uC790\uB8CC ?? ""), comma = raw.indexOf(",");
  const data = Buffer.from(raw.startsWith("data:") && comma > -1 ? raw.slice(comma + 1) : raw, "base64");
  if (!data.length) throw new Error("\uADF8\uB9BC\uC774 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.");
  const type = String(\uC885\uB958 || "image/png");
  if (!type.startsWith("image/")) throw new Error("\uADF8\uB9BC \uD30C\uC77C\uB9CC \uC62C\uB9B4 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
  const bucket = getStorage().bucket(), token = randomUUID();
  const path = `\uADF8\uB9BC/${\uC774\uB984\uB2E4\uB4EC\uAE30(\uB2E8\uC5B4\uC7A5)}_${\uC774\uB984\uB2E4\uB4EC\uAE30(\uC774\uB984)}_${token.slice(0, 8)}`;
  await bucket.file(path).save(data, { contentType: type, metadata: { metadata: { firebaseStorageDownloadTokens: token } } });
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}
var aux = onRequest({ region, cors: true, memory: "512MiB" }, async (req, res) => {
  try {
    if (req.method !== "POST") return void res.status(405).json({ ok: false, \uBA54\uC2DC\uC9C0: "POST\uB9CC \uBC1B\uC2B5\uB2C8\uB2E4." });
    const token = String(req.get("Authorization") ?? "").replace(/^Bearer /, "");
    const uid = token ? (await getAuth().verifyIdToken(token).catch(() => null))?.uid : null;
    if (!uid || !await teacherOk(uid)) return void res.status(403).json({ ok: false, \uBA54\uC2DC\uC9C0: "\uC120\uC0DD\uB2D8\uC73C\uB85C \uB4E4\uC5B4\uC640\uC57C \uD569\uB2C8\uB2E4." });
    const { fn, args = [] } = req.body ?? {};
    if (fn === "\uD478\uC2DC\uC804\uC1A1") return void res.json({ ok: true, \uAC12: await sendPush(args[1]) });
    if (fn === "__\uADF8\uB9BC\uD30C\uC77C") return void res.json({ ok: true, \uAC12: await saveImage(args[1], args[2], args[3], args[4]) });
    res.status(400).json({ ok: false, \uBA54\uC2DC\uC9C0: "\uC4F8 \uC218 \uC5C6\uB294 \uAE30\uB2A5\uC785\uB2C8\uB2E4: " + fn });
  } catch (e) {
    res.status(500).json({ ok: false, \uBA54\uC2DC\uC9C0: String(e?.message ?? e) });
  }
});
async function runMonthlyAward() {
  const { dataset, state } = (await db.doc("runtime/config").get()).data() ?? {};
  if (state !== "active") throw new Error("runtime/config\uAC00 active\uAC00 \uC544\uB2D9\uB2C8\uB2E4.");
  return new FirestoreRepository(db, dataset, { role: "bridge", user: { uid: "monthly-award" } }).call("__\uC6D4\uC2DC\uC0C1", []);
}
var monthlyAward = onSchedule({ region, schedule: "0 6 1 * *", timeZone: "Asia/Seoul" }, async () => {
  console.log(JSON.stringify(await runMonthlyAward()));
});
export {
  adminDb,
  aux,
  monthlyAward,
  pushAddressOk,
  runMonthlyAward,
  sendPush,
  teacherOk
};
