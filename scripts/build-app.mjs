// www/ (Capacitor 웹 번들)과 app-update/ (OTA용 zip + version.json)을 만든다.
// app-update/ 를 GitHub Pages(smarthb-english.github.io/Vocab/app-update/)에 올리면 앱이 다음 실행 때 받아간다.
// 버전 = 앱버전 + 파일 내용 해시. 앱버전을 안 올려도 웹이 바뀌면 새 버전으로 잡힌다.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const PAGES = 'https://smarthb-english.github.io/Vocab/app-update/';
const FILES = ['index.html', 'parent.html', 'sw.js', 'parent-sw.js', 'manifest.json', 'parent-manifest.json',
  'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'services/firestore.bundle.js', 'app/app-boot.js'];

const hash = createHash('sha256');
for (const f of FILES) hash.update(f).update(readFileSync(f));
const appVersion = /var 앱버전 = '([^']+)'/.exec(readFileSync('index.html', 'utf8'))?.[1];
if (!appVersion) throw new Error('index.html에서 앱버전을 못 찾음');
const version = `${appVersion}-${hash.digest('hex').slice(0, 8)}`;

rmSync('www', { recursive: true, force: true });
for (const f of FILES) cpSync(f, `www/${f === 'app/app-boot.js' ? 'app-boot.js' : f}`);
writeFileSync('www/app-boot.js', readFileSync('www/app-boot.js', 'utf8').replace('__BUNDLE_VERSION__', version));
const html = readFileSync('www/index.html', 'utf8');
writeFileSync('www/index.html', html.replace('</body>', '<script src="app-boot.js"></script>\n</body>'));

rmSync('app-update', { recursive: true, force: true });
mkdirSync('app-update');
const zip = `bundle-${version}.zip`;
execFileSync('zip', ['-qrX', `../app-update/${zip}`, '.'], { cwd: 'www' });
writeFileSync('app-update/version.json', JSON.stringify({ version, url: PAGES + zip }, null, 2) + '\n');
console.log(`www/ + app-update/${zip}`);
