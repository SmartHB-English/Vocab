import { randomId } from './random-id.mjs';
import { createLegacyEngine } from './legacy-engine.generated.mjs';
import { createSeoulDate, formatDate } from './seoul-date.mjs';

export function createRuntime(store, { now = () => Date.now(), uuid = () => randomId(), effects = {} } = {}) {
  const cache = new Map();
  const noEffect = name => () => { throw new Error(`External capability is not configured: ${name}`); };
  const cacheService = {
    get: key => cache.get(key) ?? null,
    getAll: keys => Object.fromEntries(keys.filter(k => cache.has(k)).map(k => [k, cache.get(k)])),
    put: (key, value) => cache.set(key, value),
    putAll: values => Object.entries(values).forEach(([k, v]) => cache.set(k, v)),
    remove: key => cache.delete(key),
    removeAll: keys => keys.forEach(key => cache.delete(key)),
  };
  return createLegacyEngine({
    Date: createSeoulDate(now),
    saveImage: effects.saveImage,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => store,
      flush() {},
      WrapStrategy: { WRAP: 'WRAP', CLIP: 'CLIP' },
      getUi: noEffect('spreadsheet UI'),
      newDataValidation() { return { requireValueInRange() { return this; }, setAllowInvalid() { return this; }, build() { return {}; } }; },
    },
    Utilities: { formatDate, getUuid: uuid, ...effects.Utilities },
    Session: { getScriptTimeZone: () => 'Asia/Seoul' },
    // All edits stay inside an isolated store. The repository must commit atomically.
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => effects.cache ?? cacheService },
    Logger: { log() {} },
    PropertiesService: effects.PropertiesService,
    DriveApp: effects.DriveApp,
    UrlFetchApp: effects.UrlFetchApp,
    ScriptApp: effects.ScriptApp,
    ContentService: effects.ContentService,
    HtmlService: effects.HtmlService,
  });
}
