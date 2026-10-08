// www/ (Capacitor 웹 번들)과 app-update/ (OTA용 zip + version.json)을 만든다.
// app-update/ 는 GitHub Pages(smarthb-english.github.io/Vocab/app-update/)에 올리면 앱이 다음 실행 때 받아간다.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const PAGES = 'https://smarthb-english.github.io/Vocab/app-update/';
const FILES = ['index.html', 'parent.html', 'sw.js', 'parent-sw.js', 'manifest.json', 'parent-manifest.json',
  'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'services/firestore.bundle.js'];

rmSync('www', { recursive: true, force: true });
for (const f of FILES) cpSync(f, `www/${f}`);
cpSync('app/app-boot.js', 'www/app-boot.js');

const html = readFileSync('www/index.html', 'utf8');
const version = /var 앱버전 = '([^']+)'/.exec(html)?.[1];
if (!version) throw new Error('index.html에서 앱버전을 못 찾음');
writeFileSync('www/index.html', html.replace('</body>', '<script src="app-boot.js"></script>\n</body>'));

rmSync('app-update', { recursive: true, force: true });
mkdirSync('app-update');
const zip = `bundle-${version}.zip`;
execFileSync('zip', ['-qr', `../app-update/${zip}`, '.'], { cwd: 'www' });
writeFileSync('app-update/version.json', JSON.stringify({ version, url: PAGES + zip }, null, 2) + '\n');
console.log(`www/ + app-update/${zip} (version ${version})`);
