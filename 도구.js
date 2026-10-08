/* 시험들이 같이 쓰는 도우미 — 지금 화면(index.html 맨 끝 「HB 레이어」) 하나만 상대한다.
   · 아래 탭은 넷: 숙제(hw) · 외우기(mem) · 시험(test) · 게임(game).
     외우기와 시험은 같은 s-study 화면이라 data-tab2 로는 못 가른다 — 그래서 data-hbt 로 누른다.
   · 순위 탭은 없다. 게임 화면의 「순위」 타일(#btnGmRank)로 들어간다.
   · 단어장·범위 칸은 바텀시트(#hbSheet) 안에 있어서 #hbBook 을 눌러야 보인다.
   · 타일을 누르면 바로 시작한다. 3단변화만 형태를 고른 뒤 「시작」(#btnStartMode)을 누른다.
   · 타임어택은 연습 타일이 아니라 게임 화면의 #hbTime 이다. */
const fs = require('fs');

/* 클라우드 작업 칸에는 크로미움이 따로 깔려 있고, 이 컴퓨터에선 플레이라이트가 받은 것을 쓴다 */
const 띄우기설정 = fs.existsSync('/opt/pw-browsers/chromium')
  ? { executablePath: '/opt/pw-browsers/chromium' } : {};

/* 임시 파일 자리 — 클라우드는 /tmp, 윈도는 사용자 임시 폴더 */
const 임시 = n => require('path').join(require('os').tmpdir(), n);

/* PDF 쪽수 — pdfinfo 가 있으면 그걸 쓰고, 없으면(윈도) 파일 속 쪽 표시를 센다.
   크로미움이 뽑는 PDF 는 쪽마다 「/Type /Page」 가 하나씩 그대로 적혀 있다. */
function 쪽수세기(파일) {
  try {
    const t = require('child_process').execSync('pdfinfo "' + 파일 + '"', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    return Number((t.match(/Pages:\s+(\d+)/) || [])[1] || 0);
  } catch (e) {
    const 글 = fs.readFileSync(파일).toString('latin1');
    return (글.match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
  }
}

const 외우기칸 = ['flash', 'book', 'verb', 'cloze', 'order'];
const 시험칸   = ['spell', 'choice', 'hint', 'write', 'dict'];

/* 이름: hw / mem / test / game */
async function 탭(p, 이름) {
  await p.click('[data-hbt="' + 이름 + '"]');
  await p.waitForTimeout(700);
}

async function 순위가기(p) {
  await 탭(p, 'game');
  await p.click('#btnGmRank');
  await p.waitForTimeout(700);
}

async function 방법(p, m, 기다림) {
  await 칸닫기(p);
  if (m === 'time') {
    await 탭(p, 'game');
    await p.click('#hbTime');
  } else {
    const 갈곳 = 시험칸.indexOf(m) > -1 ? 'test' : 'mem';
    const 지금 = await p.evaluate(() => (document.querySelector('.screen.on') || {}).id + '|' + window.HB_view);
    if (지금 !== 's-study|' + 갈곳) await 탭(p, 갈곳);
    await p.waitForFunction(() => (window.S && S.단어 && S.단어.length > 0), null, { timeout: 8000 })
      .catch(() => {});
    await p.click('#s-study .mtile[data-mode="' + m + '"]');
    if (m === 'verb') await p.click('#btnStartMode');
  }
  await p.waitForTimeout(기다림 === undefined ? 900 : 기다림);
}

async function 칸열기(p) {
  const 열림 = await p.evaluate(() => document.getElementById('hbSheet').classList.contains('on'));
  if (!열림) {
    await p.click('#hbBook');
    await p.waitForTimeout(550);  /* 올라오는 움직임(.5초)이 끝나야 칸을 누를 수 있다 */
  }
}
async function 칸닫기(p) {
  const 열림 = await p.evaluate(() => {
    const s = document.getElementById('hbSheet'); return !!(s && s.classList.contains('on'));
  });
  if (열림) {
    await p.click('#hbSheet .hbdone');
    await p.waitForTimeout(550);
  }
}
/* 게임 화면에는 단어장 칸이 따로 있다 (#hbGSheet, 여는 단추 #hbGBook) */
async function 게임칸열기(p) {
  const 열림 = await p.evaluate(() => document.getElementById('hbGSheet').classList.contains('on'));
  if (!열림) {
    await p.click('#hbGBook');
    await p.waitForTimeout(550);
  }
}
async function 게임칸닫기(p) {
  const 열림 = await p.evaluate(() => {
    const s = document.getElementById('hbGSheet'); return !!(s && s.classList.contains('on'));
  });
  if (열림) {
    await p.click('#hbGSheet .hbdone');
    await p.waitForTimeout(550);
  }
}
async function 책고르기(p, 이름) {
  await 칸열기(p);
  await p.click('[data-bk="' + 이름 + '"]');
  await p.waitForTimeout(900);
  await 칸닫기(p);
}
async function 범위정하기(p, a, b) {
  await 칸열기(p);
  await p.fill('#inFrom', String(a));
  await p.fill('#inTo', String(b));
  await p.waitForTimeout(250);
  await 칸닫기(p);
}

module.exports = { 띄우기설정, 임시, 쪽수세기, 탭, 순위가기, 방법, 칸열기, 칸닫기, 게임칸열기, 게임칸닫기, 책고르기, 범위정하기, 외우기칸, 시험칸 };
