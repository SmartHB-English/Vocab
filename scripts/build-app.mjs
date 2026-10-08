// www/ (Capacitor 웹 번들)과 app-update/ (OTA용 zip + version.json)을 만든다.
// app-update/ 를 GitHub Pages(smarthb-english.github.io/Vocab/app-update/)에 올리면 앱이 다음 실행 때 받아간다.
// 버전 = 앱버전 + 파일 내용 해시. 앱버전을 안 올려도 웹이 바뀌면 새 버전으로 잡힌다.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const PAGES = 'https://smarthb-english.github.io/Vocab/app-update/';
const FILES = ['index.html', 'parent.html', 'sw.js', 'parent-sw.js', 'manifest.json', 'parent-manifest.json',
  'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'services/firestore.bundle.js', 'app/app-boot.js', 'app/app.css'];

const hash = createHash('sha256');
for (const f of FILES) hash.update(f).update(readFileSync(f));
const appVersion = /var 앱버전 = '([^']+)'/.exec(readFileSync('index.html', 'utf8'))?.[1];
if (!appVersion) throw new Error('index.html에서 앱버전을 못 찾음');
const version = `${appVersion}-${hash.digest('hex').slice(0, 8)}`;

rmSync('www', { recursive: true, force: true });
for (const f of FILES) cpSync(f, `www/${f.replace(/^app\//, '')}`);
writeFileSync('www/app-boot.js', readFileSync('www/app-boot.js', 'utf8').replace('__BUNDLE_VERSION__', version));
const html = readFileSync('www/index.html', 'utf8');
const viewport = '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">';
if (!html.includes(viewport)) throw new Error('index.html viewport 메타가 바뀜 — viewport-fit=cover 주입 위치 확인');
writeFileSync('www/index.html', html
  .replace(viewport, viewport.replace('user-scalable=no', 'user-scalable=no, viewport-fit=cover'))
  .replace('</head>', '<link rel="stylesheet" href="app.css">\n</head>')
  .replace('</body>', '<script src="app-boot.js"></script>\n</body>'));

rmSync('app-update', { recursive: true, force: true });
mkdirSync('app-update');
const zip = `bundle-${version}.zip`;
// 내용이 같으면 zip도 바이트까지 같아야 체크섬이 안 바뀐다: 파일 순서·시각 고정, 디렉터리 항목 제외
const entries = readdirSync('www', { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile()).map((e) => `${e.parentPath}/${e.name}`.slice('www/'.length)).sort();
for (const f of entries) utimesSync(`www/${f}`, 315532800, 315532800);
execFileSync('zip', ['-qXD', `../app-update/${zip}`, ...entries], { cwd: 'www', env: { ...process.env, TZ: 'UTC' } });
// capgo v8은 sha256 체크섬이 없으면 다운로드를 거부한다
const checksum = createHash('sha256').update(readFileSync(`app-update/${zip}`)).digest('hex');
writeFileSync('app-update/version.json', JSON.stringify({ version, url: PAGES + zip, checksum }, null, 2) + '\n');
console.log(`www/ + app-update/${zip}`);
