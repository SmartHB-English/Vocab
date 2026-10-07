import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const source = readFileSync(new URL('tests/fixtures/legacy/Code.gs', root), 'utf8');
const output = `// Generated from the verified production Apps Script v80. Do not edit here.\nexport function createLegacyEngine(dependencies) {\n  const { SpreadsheetApp, Utilities, Session, LockService, CacheService, Date, PropertiesService, DriveApp, UrlFetchApp, ScriptApp, Logger, ContentService, HtmlService } = dependencies;\n${source}\n  if (dependencies.saveImage) 그림저장_ = dependencies.saveImage;\n  return {\n    call(name, args = []) {\n      if (!Object.prototype.hasOwnProperty.call(열린기능_, name)) throw new Error('쓸 수 없는 기능입니다: ' + name);\n      읽은것_ = null;\n      const result = 열린기능_[name].apply(null, args);\n      담은것버리기_(name);\n      return result;\n    },\n    monthly() { return 매월시상(); },\n    names: Object.keys(열린기능_)\n  };\n}\n`;
const file = new URL('services/legacy-engine.generated.mjs', root);
if (process.argv.includes('--check')) {
  if (readFileSync(file, 'utf8') !== output) throw new Error('Legacy engine is stale; run node scripts/build-legacy.mjs');
} else writeFileSync(file, output);
