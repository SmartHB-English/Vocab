/* ===== 마스코트 모듈 =====
   사용법: const m = createMascot(요소, {sleepAfter: 12000, onState: fn});
           m.play('correct' | 'wrong' | 'combo' | 'celebrate' | 'sleep' | 'idle' | 'poke');
   한 번짜리 동작(정답·오답·연속·축하·톡)은 끝나면 자동으로 대기로 돌아감. */
function createMascot(container, opts = {}) {
  const NS = 'http://www.w3.org/2000/svg';
  const sleepAfter = opts.sleepAfter ?? 12000;
  const LINE = '#5b3f38';

  // 손그림 느낌 외곽선 (고정 시드라 매번 같은 모양)
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  function bodyPath() {
    const cx = 518, cy = 532, rx = 350, ry = 312, N = 17, pts = [];
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + i * 2 * Math.PI / N + (rnd() - .5) * .07;
      const k = 1 + (rnd() - .5) * .035;
      const s = Math.sin(a);
      pts.push([cx + Math.cos(a) * rx * k, cy + s * ry * k * (s > 0 ? .97 : 1)]);
    }
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < N; i++) {
      const p = pts[i], q = pts[(i + 1) % N];
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      const f = 1.085 + (rnd() - .5) * .03;
      d += ` Q${(cx + (mx - cx) * f).toFixed(1)} ${(cy + (my - cy) * f).toFixed(1)} ${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
    }
    return d + 'Z';
  }

  const BODY = bodyPath();
  container.innerHTML = `
  <svg xmlns="${NS}" viewBox="60 40 920 920" aria-label="마스코트">
    <defs>
      <linearGradient id="mFill" gradientUnits="userSpaceOnUse" x1="0" y1="220" x2="0" y2="875">
        <stop offset="0" stop-color="#fffdf7"/><stop offset="1" stop-color="#f8eedb"/>
      </linearGradient>
    </defs>
    <ellipse id="mShadow" cx="518" cy="872" rx="270" ry="22" fill="#3b2c28" opacity=".08"/>
    <g id="mFxBack"></g>
    <g id="mRoot">
      <!-- 몸통+다리 한 덩어리 외곽선: 굵은 선을 먼저 깔고 그 위에 면을 덮어서 겹친 안쪽 선을 지움 -->
      <g fill="none" stroke="${LINE}" stroke-width="18" stroke-linejoin="round">
        <path d="${BODY}"/>
        <ellipse cx="374" cy="830" rx="40" ry="32"/>
        <ellipse cx="582" cy="840" rx="42" ry="32"/>
      </g>
      <g fill="url(#mFill)">
        <ellipse cx="374" cy="830" rx="40" ry="32"/>
        <ellipse cx="582" cy="840" rx="42" ry="32"/>
        <path d="${BODY}"/>
      </g>
      <g id="mEarL">
        <path d="M318 330 C282 342 258 306 280 286 C292 276 308 280 314 292" fill="#fffdf7" stroke="${LINE}" stroke-width="9" stroke-linecap="round"/>
        <ellipse cx="296" cy="314" rx="15" ry="11" fill="#d6eef2"/>
      </g>
      <g id="mEarR">
        <ellipse cx="666" cy="356" rx="19" ry="13" fill="#d6eef2"/>
        <path d="M658 322 C700 312 716 352 682 372" fill="none" stroke="${LINE}" stroke-width="9" stroke-linecap="round"/>
      </g>
      <g id="mFace">
        <ellipse cx="356" cy="418" rx="28" ry="24" fill="#f7d6c8" opacity=".75"/>
        <ellipse cx="562" cy="432" rx="28" ry="24" fill="#f7d6c8" opacity=".75"/>
        <g id="eNormal" fill="#3a2622">
          <ellipse id="eL" cx="390" cy="405" rx="11" ry="14"/>
          <ellipse id="eR" cx="533" cy="413" rx="11" ry="14"/>
        </g>
        <g id="eHappy" fill="none" stroke="#3a2622" stroke-width="8" stroke-linecap="round">
          <path d="M374 412 Q390 390 406 412"/><path d="M517 420 Q533 398 549 420"/>
        </g>
        <g id="eClosed" fill="none" stroke="#3a2622" stroke-width="7" stroke-linecap="round">
          <path d="M375 406 Q390 418 405 406"/><path d="M518 414 Q533 426 548 414"/>
        </g>
        <g id="eSad">
          <g fill="#3a2622"><ellipse cx="390" cy="410" rx="10" ry="12"/><ellipse cx="533" cy="418" rx="10" ry="12"/></g>
          <g fill="none" stroke="#3a2622" stroke-width="6" stroke-linecap="round">
            <path d="M370 384 L404 372"/><path d="M518 380 L552 392"/>
          </g>
        </g>
        <path id="mNormal" d="M428 428 q8 9 16 0 q8 9 16 0" fill="none" stroke="#3a2622" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        <path id="mOpen" d="M428 424 Q445 456 464 424 Z" fill="#8a4038" stroke="#3a2622" stroke-width="6" stroke-linejoin="round"/>
        <path id="mSad" d="M430 442 Q446 428 462 442" fill="none" stroke="#3a2622" stroke-width="6" stroke-linecap="round"/>
        <ellipse id="mSleep" cx="446" cy="436" rx="6" ry="8" fill="none" stroke="#3a2622" stroke-width="5"/>
        <path id="mDrop" d="M622 300 C610 322 604 334 612 344 C620 352 636 348 638 336 C640 326 632 314 622 300 Z" fill="#dff1fa" stroke="${LINE}" stroke-width="5" stroke-linejoin="round"/>
      </g>
      <g id="mHandL">
        <path d="M296 512 C325 498 350 525 334 548" fill="none" stroke="${LINE}" stroke-width="9" stroke-linecap="round"/>
        <ellipse cx="316" cy="542" rx="12" ry="9" fill="#ebe5f5"/>
      </g>
      <g id="mHandR">
        <path d="M540 562 C538 532 568 515 590 536" fill="none" stroke="${LINE}" stroke-width="9" stroke-linecap="round"/>
        <ellipse cx="556" cy="568" rx="12" ry="9" fill="#ebe5f5"/>
      </g>
    </g>
    <g id="mFx"></g>
  </svg>`;

  const svg = container.querySelector('svg');
  const $ = id => svg.querySelector('#' + id);
  const el = {
    root: $('mRoot'), fxBack: $('mFxBack'), shadow: $('mShadow'), face: $('mFace'), fx: $('mFx'),
    earL: $('mEarL'), earR: $('mEarR'), handL: $('mHandL'), handR: $('mHandR'),
    eL: $('eL'), eR: $('eR'), drop: $('mDrop'),
    eyes: { normal: $('eNormal'), happy: $('eHappy'), closed: $('eClosed'), sad: $('eSad') },
    mouth: { normal: $('mNormal'), open: $('mOpen'), sad: $('mSad'), sleep: $('mSleep') },
  };

  // ---- 유틸 ----
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = u => u * u * (3 - 2 * u);
  function kf(t, keys) { // [[시간, 값], ...] 부드럽게 보간
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
        return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
      }
    }
    return keys[keys.length - 1][1];
  }
  const hop = (u, h) => -h * 4 * u * (1 - u); // 0~1 사이 포물선 점프

  // ---- 이펙트 ----
  // 캐릭터랑 같은 그림체로: 갈색 외곽선 + 파스텔 면, 둥근 끝, 튀어나왔다 사라지는 탄성
  const parts = [];
  const PASTEL = ['#ffe9a8', '#cdeec4', '#cfe7f7', '#fbd3dc', '#e3d8f6'];
  const SHAPES = {
    star: 'M0 -20 Q5 -5 20 0 Q5 5 0 20 Q-5 5 -20 0 Q-5 -5 0 -20Z',
    heart: 'M0 14 C-18 2 -20 -12 -10 -15 C-4 -17 0 -12 0 -8 C0 -12 4 -17 10 -15 C20 -12 18 2 0 14Z',
    dot: 'M0 -11 A11 11 0 1 1 0 11 A11 11 0 1 1 0 -11Z',
    z: 'M-22 -22 L22 -22 L-22 22 L22 22',
  };
  const pick = a => a[(Math.random() * a.length) | 0];
  function mk(d, fill, stroke, w, back) {
    const n = document.createElementNS(NS, 'path');
    n.setAttribute('d', d);
    n.setAttribute('fill', fill);
    n.setAttribute('stroke', stroke);
    n.setAttribute('stroke-width', w);
    n.setAttribute('stroke-linejoin', 'round');
    n.setAttribute('stroke-linecap', 'round');
    (back ? el.fxBack : el.fx).appendChild(n);
    return n;
  }
  // 튀어나왔다(오버슈트) 줄어드는 크기 곡선
  const popScale = u => u < .25 ? 1.25 * Math.sin(u / .25 * Math.PI / 2) : u < .4 ? 1.25 - (u - .25) / .15 * .25 : u > .75 ? (1 - u) / .25 : 1;

  function spawn(type, x, y, n) {
    for (let i = 0; i < n; i++) {
      const p = { type, x, y, life: 0, vx: 0, vy: 0, r: 0, vr: 0, s: 1 };
      if (type === 'sparkle') {        // 반짝이: 머리 주변에 띄엄띄엄 톡톡
        const a = -Math.PI / 2 + (Math.random() - .5) * 2.4;
        const d = 150 + Math.random() * 110;
        p.x = x + Math.cos(a) * d; p.y = y + Math.sin(a) * d * .7;
        p.vy = -20; p.s = .7 + Math.random() * .6;
        p.delay = i * .07; p.max = .75;
        p.node = mk(SHAPES.star, '#fff1b8', LINE, 5);
      } else if (type === 'lines') {   // 만화식 강조선: 몸 둘레에서 바깥으로 쭉
        p.a = (i / n) * Math.PI * 2 + .2; p.max = .45; p.delay = 0;
        p.node = mk('', 'none', LINE, 7);
      } else if (type === 'bits') {    // 색종이 대신 하트·별·동글이가 퐁 솟았다 살랑살랑 떨어짐
        const a = -Math.PI / 2 + (Math.random() - .5) * 2.9;
        const sp = 520 + Math.random() * 420;
        p.x = x + (Math.random() - .5) * 160;
        p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
        p.vr = (Math.random() - .5) * 200; p.r = (Math.random() - .5) * 40;
        p.s = 1.1 + Math.random() * .6; p.sway = Math.random() * 6;
        p.delay = Math.random() * .12; p.max = 2.1 + Math.random() * .5;
        const shape = pick(['star', 'heart', 'heart', 'dot']);
        p.node = mk(SHAPES[shape], pick(PASTEL), LINE, 4.5, true);
      } else if (type === 'z') {       // 손글씨 Z
        p.vx = 30; p.vy = -60; p.max = 2.6; p.delay = 0;
        p.node = mk(SHAPES.z, 'none', '#7d6b98', 8);
      }
      p.node.setAttribute('opacity', 0);
      parts.push(p);
    }
  }

  function updateParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      const lt = p.life - (p.delay || 0);
      if (lt < 0) continue;
      if (lt >= p.max) { p.node.remove(); parts.splice(i, 1); continue; }
      const u = lt / p.max;
      let s = p.s, op = 1, rot = p.r, x = p.x, y = p.y;

      if (p.type === 'sparkle') {
        p.y += p.vy * dt; y = p.y;
        s *= popScale(u); rot = u * 40;
      } else if (p.type === 'lines') {
        const r0 = 385 + u * 70, len = 55 * (1 - u) + 6;
        p.node.setAttribute('d', `M${r0} 0 L${r0 + len} 0`);
        p.node.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${(p.a * 180 / Math.PI).toFixed(1)})`);
        p.node.setAttribute('opacity', (u < .15 ? u / .15 : 1 - (u - .15) / .85).toFixed(2));
        continue;
      } else if (p.type === 'bits') {
        // 처음엔 퐁, 그 다음엔 공기저항 세게 받아서 천천히 살랑
        p.vx *= Math.pow(.3, dt); p.vy = p.vy * Math.pow(.3, dt) + 330 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
        x = p.x + Math.sin(p.life * 4 + p.sway) * 14; y = p.y;
        rot = p.r + Math.sin(p.life * 4 + p.sway) * 18;
        s *= u < .12 ? popScale(u / .12 * .4) : 1;
        op = u > .7 ? (1 - u) / .3 : 1;
      } else if (p.type === 'z') {
        p.x += p.vx * dt; p.y += p.vy * dt;
        x = p.x + Math.sin(p.life * 2.5) * 10; y = p.y;
        s = .7 + u * .6; rot = -10 + Math.sin(p.life * 2) * 8;
        op = u < .2 ? u / .2 : 1 - (u - .2) / .8;
      }
      p.node.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)}) scale(${Math.max(0, s).toFixed(3)})`);
      p.node.setAttribute('opacity', op.toFixed(2));
    }
  }

  // ---- 상태 정의 ----
  // 각 상태: dur(초, 없으면 계속), fn(경과시간, 포즈객체, 상태메모)
  const STATES = {
    idle: { label: '대기', fn() {} },

    correct: { label: '정답', dur: 1.15, fn(e, p, m) {
      p.y = e > .12 && e < .6 ? hop((e - .12) / .48, 170) : 0;
      p.sy = kf(e, [[0, 1], [.12, .85], [.22, 1.1], [.5, 1.02], [.62, .87], [.78, 1.04], [.95, 1]]);
      p.eyes = 'happy'; p.mouth = 'open';
      p.handL = kf(e, [[0, 0], [.2, -55], [.85, -55], [1.1, 0]]);
      p.handR = kf(e, [[0, 0], [.2, 55], [.85, 55], [1.1, 0]]);
      p.earL = kf(e, [[0, 0], [.25, -12], [.9, -12], [1.1, 0]]); p.earR = -p.earL;
      if (e > .3 && !m.s) { m.s = 1; spawn('lines', 518, 420, 10); spawn('sparkle', 518, 200, 4); }
    }},

    wrong: { label: '오답', dur: 1.5, fn(e, p) {
      p.sy = kf(e, [[0, 1], [.14, .84], [.3, .9], [1.2, .9], [1.5, 1]]);
      p.x = e < .7 ? Math.sin(e * 32) * 12 * (1 - e / .7) : 0;
      p.faceY = kf(e, [[0, 0], [.2, 12], [1.2, 12], [1.5, 0]]);
      p.eyes = 'sad'; p.mouth = 'sad'; p.drop = e > .15 && e < 1.3;
      p.dropY = (e - .15) * 30;
      p.earL = kf(e, [[0, 0], [.2, -22], [1.2, -22], [1.5, 0]]); p.earR = -p.earL * .8;
      p.handL = kf(e, [[0, 0], [.2, 18], [1.2, 18], [1.5, 0]]); p.handR = -p.handL;
    }},

    combo: { label: '연속 정답', dur: 2.0, fn(e, p, m) {
      if (e < 1.5) {
        const u = (e % .5) / .5;
        p.y = hop(u, 80);
        p.sy = u < .1 || u > .9 ? .9 : 1.05;
      } else p.sy = kf(e, [[1.5, .9], [1.7, 1.03], [2, 1]]);
      p.eyes = 'happy'; p.mouth = 'open';
      const w = Math.sin(e * 15) * 28 * (e < 1.7 ? 1 : 0);
      p.handL = -35 + w; p.handR = 35 - w;
      p.rot = Math.sin(e * 7.5) * 4;
      const k = Math.floor(e / .5);
      if (k !== m.k && e < 1.5) { m.k = k; spawn('sparkle', 518, 240, 2); }
    }},

    celebrate: { label: '결과 축하', dur: 2.8, fn(e, p, m) {
      p.y = e > .2 && e < .95 ? hop((e - .2) / .75, 200) : (e > 1.15 && e < 1.55 ? hop((e - 1.15) / .4, 60) : 0);
      p.sy = kf(e, [[0, 1], [.2, .8], [.3, 1.14], [.85, 1.03], [.97, .84], [1.12, 1.04], [1.15, .95], [1.25, 1.03], [1.55, .93], [1.7, 1]]);
      p.rot = e > .25 && e < .95 ? Math.sin((e - .25) / .7 * Math.PI * 2) * 10 : 0;
      p.eyes = 'happy'; p.mouth = 'open';
      p.handL = -65 + Math.sin(e * 12) * 12; p.handR = 65 - Math.sin(e * 12) * 12;
      p.earL = -14; p.earR = 14;
      if (e > .35 && !m.c) { m.c = 1; spawn('lines', 518, 380, 12); spawn('bits', 518, 330, 22); spawn('sparkle', 518, 180, 5); }
      if (e > 1.2 && !m.c2) { m.c2 = 1; spawn('bits', 518, 360, 10); }
      if (e > 2.4) { p.handL *= (2.8 - e) / .4; p.handR *= (2.8 - e) / .4; }
    }},

    sleep: { label: '졸기', fn(e, p, m, t) {
      const b = Math.sin(t * 1.3);
      p.sy = 1 + .035 * b; p.breath = false;
      p.rot = 3 + Math.sin(t * .65) * 1.5;
      p.faceY = 8; p.eyes = 'closed'; p.mouth = 'sleep';
      p.earL = -8; p.earR = 8; p.handL = 10; p.handR = -10;
      if (!m.z || t - m.z > 1.5) { m.z = t; spawn('z', 700, 300, 1); }
    }},

    poke: { label: '톡', dur: .6, fn(e, p) {
      p.sy = kf(e, [[0, 1], [.08, .88], [.22, 1.08], [.36, .96], [.5, 1.01], [.6, 1]]);
      p.eyes = e < .3 ? 'closed' : 'normal';
      p.earL = kf(e, [[0, 0], [.15, -18], [.45, 0]]); p.earR = -p.earL;
    }},
  };

  let cur = { name: 'idle', t0: 0, memo: {} };
  let lastInput = performance.now();
  let nextBlink = 1.5, blinkAt = -1;

  function play(name) {
    if (!STATES[name]) return;
    lastInput = performance.now();
    cur = { name, t0: performance.now() / 1000, memo: {} };
    opts.onState && opts.onState(name, STATES[name].label);
  }

  svg.addEventListener('pointerdown', () => play('poke'));

  // ---- 메인 루프 ----
  let last = performance.now() / 1000;
  function frame(nowMs) {
    const t = nowMs / 1000, dt = Math.min(.05, t - last); last = t;
    const st = STATES[cur.name], e = t - cur.t0;

    if (st.dur && e >= st.dur) play('idle');
    if (cur.name === 'idle' && nowMs - lastInput > sleepAfter) play('sleep');

    const p = { x: 0, y: 0, sx: null, sy: 1, rot: 0, faceY: 0, handL: 0, handR: 0, earL: 0, earR: 0,
                eyes: 'normal', mouth: 'normal', drop: false, dropY: 0, breath: true };
    STATES[cur.name].fn(e, p, cur.memo, t);

    // 숨쉬기·흔들림은 항상 살짝 깔아둠
    if (p.breath) {
      const b = Math.sin(t * 2.2);
      p.sy *= 1 + .018 * b;
      p.handL += Math.sin(t * 1.7) * 3; p.handR -= Math.sin(t * 1.7 + 1) * 3;
      p.earL += Math.sin(t * 1.3) * 2;  p.earR -= Math.sin(t * 1.3 + .5) * 2;
    }
    if (p.sx === null) p.sx = 1 + (1 - p.sy) * .75; // 부피 유지

    // 눈 깜빡임 (보통 눈일 때만)
    if (t > nextBlink) { blinkAt = t; nextBlink = t + 2.5 + Math.random() * 3; }
    const bu = (t - blinkAt) / .14;
    const lid = bu >= 0 && bu <= 1 ? 1 - Math.sin(bu * Math.PI) * .9 : 1;
    el.eL.setAttribute('ry', (14 * lid).toFixed(2));
    el.eR.setAttribute('ry', (14 * lid).toFixed(2));

    // 적용
    el.root.setAttribute('transform',
      `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) translate(518 850) rotate(${p.rot.toFixed(2)}) scale(${p.sx.toFixed(4)} ${p.sy.toFixed(4)}) translate(-518 -850)`);
    const lift = clamp(-p.y / 300, 0, 1);
    el.shadow.setAttribute('transform', `translate(518 872) scale(${(p.sx * (1 - lift * .45)).toFixed(3)} 1) translate(-518 -872)`);
    el.shadow.setAttribute('opacity', (.08 * (1 - lift * .6)).toFixed(3));
    el.face.setAttribute('transform', `translate(0 ${p.faceY.toFixed(1)})`);
    el.handL.setAttribute('transform', `rotate(${p.handL.toFixed(1)} 330 548)`);
    el.handR.setAttribute('transform', `rotate(${p.handR.toFixed(1)} 548 562)`);
    el.earL.setAttribute('transform', `rotate(${p.earL.toFixed(1)} 318 330)`);
    el.earR.setAttribute('transform', `rotate(${p.earR.toFixed(1)} 662 345)`);
    for (const k in el.eyes) el.eyes[k].style.display = k === p.eyes ? '' : 'none';
    for (const k in el.mouth) el.mouth[k].style.display = k === p.mouth ? '' : 'none';
    el.drop.style.display = p.drop ? '' : 'none';
    el.drop.setAttribute('transform', `translate(0 ${p.dropY.toFixed(1)})`);

    updateParts(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return { play, get state() { return cur.name; } };
}

window.createMascot = createMascot;