// Apps Script's local Date operations used Asia/Seoul. Preserve them on any device.
const NativeDate = Date;
const OFFSET = 9 * 60 * 60 * 1000;
export function createSeoulDate(now = () => NativeDate.now()) {
  return class SeoulDate extends NativeDate {
    constructor(...args) {
      if (!args.length) super(now());
      else if (args.length >= 2) super(NativeDate.UTC(...args) - OFFSET);
      else if (typeof args[0] === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(args[0])) super(args[0] + '+09:00');
      else super(args[0]);
    }
    static now() { return now(); }
    static [Symbol.hasInstance](value) { return value instanceof NativeDate; }
    local() { return new NativeDate(this.getTime() + OFFSET); }
    getFullYear() { return this.local().getUTCFullYear(); }
    getMonth() { return this.local().getUTCMonth(); }
    getDate() { return this.local().getUTCDate(); }
    getDay() { return this.local().getUTCDay(); }
    getHours() { return this.local().getUTCHours(); }
    getMinutes() { return this.local().getUTCMinutes(); }
    getSeconds() { return this.local().getUTCSeconds(); }
    getMilliseconds() { return this.local().getUTCMilliseconds(); }
    getTimezoneOffset() { return -540; }
    setDate(value) { const d = this.local(); d.setUTCDate(value); return this.setTime(d.getTime() - OFFSET); }
    setMonth(...args) { const d = this.local(); d.setUTCMonth(...args); return this.setTime(d.getTime() - OFFSET); }
    setFullYear(...args) { const d = this.local(); d.setUTCFullYear(...args); return this.setTime(d.getTime() - OFFSET); }
    setHours(...args) { const d = this.local(); d.setUTCHours(...args); return this.setTime(d.getTime() - OFFSET); }
    setMinutes(...args) { const d = this.local(); d.setUTCMinutes(...args); return this.setTime(d.getTime() - OFFSET); }
    setSeconds(...args) { const d = this.local(); d.setUTCSeconds(...args); return this.setTime(d.getTime() - OFFSET); }
    setMilliseconds(...args) { const d = this.local(); d.setUTCMilliseconds(...args); return this.setTime(d.getTime() - OFFSET); }
  };
}

export function formatDate(date, zone, format) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(p => [p.type, p.value]));
  const { year: y, month: m, day: d, hour: h, minute: min, second: sec } = parts;
  const formats = {
    'yyyy-MM-dd': `${y}-${m}-${d}`, 'yyyy-MM': `${y}-${m}`,
    'yyyy년 M월': `${y}년 ${Number(m)}월`, 'MM/dd HH:mm': `${m}/${d} ${h}:${min}`,
    'M/d HH:mm': `${Number(m)}/${Number(d)} ${h}:${min}`,
    'M/d|H|mm': `${Number(m)}/${Number(d)}|${Number(h)}|${min}`,
    'yyyyMMdd': `${y}${m}${d}`, 'yyyy-MM-dd HH:mm:ss': `${y}-${m}-${d} ${h}:${min}:${sec}`,
  };
  if (!(format in formats)) throw new Error(`Unsupported date format: ${format}`);
  return formats[format];
}
