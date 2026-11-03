/* 기준음 청음 게임 (시범 1번)
 * - 기준음 도(C4)를 들려준 뒤 문제 음을 들려주고, 건반으로 맞힌다.
 * - 소리는 Web Audio로 직접 합성한다(음원 파일 없음).
 * - 음 계단 그림은 p5(instance mode)로 그린다.
 */
(() => {
  'use strict';

  // ---------- 음 이름 ----------
  const REF = 60; // C4 = 도
  const LOW = 60, HIGH = 72; // 도 ~ 높은 도
  const NAMES = ['도', '도♯', '레', '레♯', '미', '파', '파♯', '솔', '솔♯', '라', '라♯', '시'];
  const LETTERS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const isBlack = (m) => [1, 3, 6, 8, 10].includes(m % 12);
  const noteName = (m) => (m >= 72 ? '높은 ' : '') + NAMES[m % 12];
  const noteLetter = (m) => LETTERS[m % 12] + (Math.floor(m / 12) - 1);

  // ---------- 단계 ----------
  const STAGES = [
    { id: 1, title: '한 음 · 흰 건반', desc: '도~높은 도 사이 흰 건반 한 음', count: 1, black: false },
    { id: 2, title: '한 음 · 반음 포함', desc: '검은 건반(♯)까지 포함한 한 음', count: 1, black: true },
    { id: 3, title: '두 음 · 흰 건반', desc: '흰 건반 두 음을 순서대로', count: 2, black: false },
    { id: 4, title: '두 음 · 반음 포함', desc: '반음 포함 두 음을 순서대로', count: 2, black: true },
    { id: 5, title: '세 음 · 반음 포함', desc: '반음 포함 세 음을 순서대로', count: 3, black: true },
    { id: 6, title: '네 음 · 반음 포함', desc: '반음 포함 네 음을 순서대로', count: 4, black: true },
  ];
  const ROUND_LEN = 10;
  const PASS = 8;

  // ---------- 진행 상황 저장 (브라우저에만 저장) ----------
  const STORE_KEY = 'choir-pitch-game:v1';
  function loadProgress() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      return { unlocked: d.unlocked || 1, best: d.best || {}, sfx: d.sfx !== false };
    } catch (e) {
      return { unlocked: 1, best: {}, sfx: true };
    }
  }
  function saveProgress() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (e) { /* 저장 못 해도 게임은 진행 */ }
  }
  let progress = loadProgress();

  // ---------- 소리 ----------
  let ctx = null, master = null, wave = null;

  function ensureAudio() {
    if (!ctx) {
      // 아이폰: 무음 스위치가 켜져 있어도 소리가 나도록 (Safari 16.4+)
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* 무시 */ }
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(comp);
      comp.connect(ctx.destination);
      // 피아노에 가까운 배음 구성
      const harmonics = [0, 1, 0.55, 0.32, 0.2, 0.13, 0.08, 0.05, 0.03];
      wave = ctx.createPeriodicWave(new Float32Array(harmonics.length), new Float32Array(harmonics));
    }
    if (ctx.state !== 'running') ctx.resume();
  }

  function tone(midi, t, dur) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const o = ctx.createOscillator();
    o.setPeriodicWave(wave);
    o.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 10, t);
    lp.frequency.exponentialRampToValueAtTime(f * 3, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.45, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.12, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35);
    o.connect(lp); lp.connect(g); g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.4);
  }

  // 지금 울리는 음 (그림에서 반짝이게 하려고 기록)
  let timeline = [];
  let busyUntil = 0;
  let busyTimer = null;

  function playSequence(withRef) {
    ensureAudio();
    const t0 = ctx.currentTime + 0.08;
    let t = t0;
    timeline = [];
    if (withRef) {
      tone(REF, t, 1.0);
      timeline.push({ midi: REF, start: t, end: t + 1.0, kind: 'ref' });
      t += 1.7;
    }
    q.notes.forEach((m, i) => {
      tone(m, t, 0.75);
      timeline.push({ midi: m, start: t, end: t + 0.75, kind: 'q', idx: i });
      t += 0.95;
    });
    setBusy(t - ctx.currentTime);
  }

  function playRef() {
    ensureAudio();
    const t = ctx.currentTime + 0.05;
    tone(REF, t, 1.0);
    timeline = [{ midi: REF, start: t, end: t + 1.0, kind: 'ref' }];
    setBusy(1.1);
  }

  // 효과음: 문제 음역(도~높은 도)과 겹치지 않게, 짧고 작게
  function blip(freq, t, dur, type, peak, lpHz) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = lpHz;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function sfx(ok) {
    if (!progress.sfx) return;
    ensureAudio();
    const t = ctx.currentTime + 0.02;
    if (ok) {
      // 정답: 맑게 올라가는 두 음 (높은 솔 → 높은 도, 두 옥타브 위 음역)
      blip(1568, t, 0.18, 'sine', 0.22, 8000);
      blip(1568 * 2, t, 0.12, 'sine', 0.04, 8000);       // 반짝이는 배음
      blip(2093, t + 0.09, 0.4, 'sine', 0.25, 8000);
      blip(2093 * 2, t + 0.09, 0.25, 'sine', 0.05, 8000);
    } else {
      // 오답: 낮고 둔하게 내려가는 두 음
      blip(196, t, 0.16, 'square', 0.12, 700);
      blip(165, t + 0.15, 0.3, 'square', 0.12, 600);
    }
  }

  function renderSfxButton() {
    const b = $('#btn-sfx');
    b.textContent = progress.sfx ? '🔔 효과음 켬' : '🔕 효과음 끔';
    b.setAttribute('aria-pressed', String(progress.sfx));
  }

  function playKey(m) {
    ensureAudio();
    tone(m, ctx.currentTime + 0.01, 0.6);
  }

  function setBusy(sec) {
    busyUntil = performance.now() + sec * 1000;
    $('#btn-ref').disabled = true;
    $('#btn-replay').disabled = true;
    clearTimeout(busyTimer);
    busyTimer = setTimeout(() => {
      $('#btn-ref').disabled = false;
      $('#btn-replay').disabled = false;
    }, sec * 1000);
  }

  // ---------- 게임 상태 ----------
  let stage = STAGES[0];
  let q = { notes: [] };       // 현재 문제
  let answer = [];             // 사용자가 누른 음
  let graded = false;          // 채점이 끝났는지
  let qIndex = 0, score = 0;
  let lastKey = '';

  function makeQuestion() {
    const pool = [];
    for (let m = LOW; m <= HIGH; m++) if (stage.black || !isBlack(m)) pool.push(m);
    let notes, key;
    do {
      notes = [];
      while (notes.length < stage.count) {
        const m = pool[Math.floor(Math.random() * pool.length)];
        if (notes.length && m === notes[notes.length - 1]) continue; // 같은 음 연속 금지
        if (stage.count === 1 && m === REF && Math.random() < 0.7) continue; // 기준음과 같은 답은 드물게
        notes.push(m);
      }
      key = notes.join(',');
    } while (key === lastKey);
    lastKey = key;
    return { notes };
  }

  // ---------- 화면 ----------
  const $ = (s) => document.querySelector(s);

  function show(id) {
    for (const s of ['#screen-menu', '#screen-game', '#screen-summary']) $(s).hidden = s !== id;
    window.scrollTo(0, 0);
    if (viz) viz.resize();
  }

  function renderMenu() {
    const ul = $('#stage-list');
    ul.innerHTML = '';
    STAGES.forEach((s) => {
      const locked = s.id > progress.unlocked;
      const best = progress.best[s.id];
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.className = 'stage-btn' + (locked ? ' locked' : '');
      b.disabled = locked;
      b.innerHTML =
        `<span class="stage-num">${locked ? '🔒' : s.id}</span>` +
        `<span class="stage-text"><span class="stage-title">${s.title}</span>` +
        `<span class="stage-meta">${s.desc}${best != null ? ` · 최고 ${best}/${ROUND_LEN}` : ''}</span></span>`;
      b.addEventListener('click', () => startStage(s));
      li.appendChild(b);
      ul.appendChild(li);
    });
  }

  function startStage(s) {
    ensureAudio(); // 사용자 터치 안에서 오디오를 깨워야 아이폰에서 소리가 난다
    stage = s;
    qIndex = 0;
    score = 0;
    lastKey = '';
    $('#stage-title').textContent = `${s.id}단계 · ${s.title}`;
    buildKeyboard();
    show('#screen-game');
    nextQuestion();
  }

  function nextQuestion() {
    if (qIndex >= ROUND_LEN) return finishRound();
    q = makeQuestion();
    answer = [];
    graded = false;
    qIndex++;
    $('#progress').textContent = `${qIndex} / ${ROUND_LEN} · 맞힘 ${score}`;
    $('#feedback').textContent = '';
    $('#feedback').className = 'feedback';
    $('#btn-next').hidden = true;
    $('#btn-check').hidden = false;
    $('#btn-undo').hidden = false;
    $('#key-hint').textContent = stage.count > 1
      ? `들은 순서대로 ${stage.count}개 음을 누르세요. 다 고른 뒤 다른 건반을 누르면 마지막 음이 바뀌어요.`
      : '들은 음을 누르세요. 확인 전까지는 다른 건반을 눌러 바꿀 수 있어요.';
    renderSlots();
    playSequence(true);
  }

  function renderSlots() {
    const box = $('#slots');
    box.innerHTML = '';
    for (let i = 0; i < stage.count; i++) {
      const d = document.createElement('div');
      d.className = 'slot';
      const a = answer[i];
      if (a != null) {
        d.classList.add('filled');
        d.textContent = noteName(a);
      } else if (i === answer.length && !graded) {
        d.classList.add('current');
      }
      if (graded) {
        const ok = a === q.notes[i];
        d.classList.add(ok ? 'good' : 'bad');
        if (!ok) {
          d.innerHTML = `<span>${a != null ? noteName(a) : '–'}<span class="fix">→ ${noteName(q.notes[i])}</span></span>`;
        }
      }
      box.appendChild(d);
    }
    $('#btn-check').disabled = answer.length < stage.count;
    $('#btn-undo').disabled = answer.length === 0;
    renderKeyMarks();
  }

  function onKey(m) {
    if (graded) { // 채점 후에는 자유롭게 눌러서 소리 비교
      playKey(m);
      flashKey(m);
      return;
    }
    if (answer.length >= stage.count) answer[answer.length - 1] = m; // 다 고른 뒤에는 마지막 음을 바꿈
    else answer.push(m);
    flashKey(m);
    renderSlots();
  }

  function undo() {
    if (graded) return;
    answer.pop();
    renderSlots();
  }

  function check() {
    if (graded || answer.length < stage.count) return;
    graded = true;
    const ok = q.notes.every((m, i) => answer[i] === m);
    if (ok) score++;
    sfx(ok);
    $('#progress').textContent = `${qIndex} / ${ROUND_LEN} · 맞힘 ${score}`;
    const fb = $('#feedback');
    fb.className = 'feedback ' + (ok ? 'good' : 'bad');
    fb.textContent = ok ? '정답이에요!' : `정답: ${q.notes.map(noteName).join(' – ')}`;
    $('#btn-check').hidden = true;
    $('#btn-undo').hidden = true;
    $('#btn-next').hidden = false;
    $('#btn-next').textContent = qIndex >= ROUND_LEN ? '결과 보기' : '다음 문제';
    $('#key-hint').textContent = '이제 건반을 눌러 소리를 비교해 볼 수 있어요.';
    renderSlots();
    $('#btn-next').focus();
  }

  function finishRound() {
    const passed = score >= PASS;
    const prevBest = progress.best[stage.id];
    progress.best[stage.id] = Math.max(prevBest || 0, score);
    let unlockedNow = false;
    if (passed && stage.id === progress.unlocked && stage.id < STAGES.length) {
      progress.unlocked = stage.id + 1;
      unlockedNow = true;
    }
    saveProgress();

    $('#sum-stage').textContent = `${stage.id}단계 · ${stage.title}`;
    $('#sum-score').textContent = `${score} / ${ROUND_LEN}`;
    let msg;
    if (passed && stage.id === STAGES.length) msg = '마지막 단계까지 통과했어요! 대단해요.';
    else if (passed) msg = unlockedNow ? `통과! ${stage.id + 1}단계가 열렸어요.` : '통과했어요!';
    else msg = `${PASS}개 이상 맞히면 다음 단계가 열려요. 다시 도전해 보세요.`;
    $('#sum-msg').textContent = msg;
    const nextBtn = $('#sum-next');
    const next = STAGES[stage.id];
    nextBtn.hidden = !(next && next.id <= progress.unlocked);
    show('#screen-summary');
    renderMenu();
  }

  // ---------- 건반 ----------
  const WHITE = [60, 62, 64, 65, 67, 69, 71, 72];
  const BLACK = [[61, 0], [63, 1], [66, 3], [68, 4], [70, 5]]; // [음, 왼쪽 흰 건반 번호]
  const keyMap = new Map();
  const keyEl = (m) => keyMap.get(m);

  function buildKeyboard() {
    const kb = $('#keyboard');
    kb.innerHTML = '';
    keyMap.clear();
    WHITE.forEach((m) => {
      const b = document.createElement('button');
      b.className = 'key white';
      b.textContent = noteName(m).replace('높은 ', '');
      b.setAttribute('aria-label', `${noteName(m)} (${noteLetter(m)})`);
      kb.appendChild(b);
      keyMap.set(m, b);
    });
    const w = 100 / WHITE.length;
    BLACK.forEach(([m, i]) => {
      const b = document.createElement('button');
      b.className = 'key black';
      b.innerHTML = NAMES[m % 12].replace('♯', '<br>♯');
      b.setAttribute('aria-label', `${noteName(m)} (${noteLetter(m)})`);
      b.style.left = `calc(${(i + 1) * w}% - 3.875%)`;
      b.disabled = !stage.black;
      kb.appendChild(b);
      keyMap.set(m, b);
    });
    keyMap.forEach((b, m) => {
      b.addEventListener('pointerdown', (e) => {
        if (b.disabled) return;
        e.preventDefault(); // 더블탭 확대 방지, 빠른 반응
        onKey(m);
      });
      b.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onKey(m); }
      });
    });
  }

  function flashKey(m) {
    const b = keyEl(m);
    if (!b) return;
    b.classList.add('pressed');
    setTimeout(() => b.classList.remove('pressed'), 180);
  }

  // 건반 아래 색 막대: 고른 음 파랑, 채점 후 정답 녹색, 틀리게 고른 음 빨강
  function renderKeyMarks() {
    keyMap.forEach((b) => b.classList.remove('selected', 'answer', 'wrong'));
    const mark = (m, cls) => keyEl(m) && keyEl(m).classList.add(cls);
    if (!graded) {
      answer.forEach((m) => mark(m, 'selected'));
      return;
    }
    answer.forEach((m, i) => { if (m !== q.notes[i]) mark(m, 'wrong'); });
    q.notes.forEach((m) => { keyEl(m) && keyEl(m).classList.remove('wrong'); mark(m, 'answer'); });
  }

  // ---------- 음 계단 그림 (p5) ----------
  let viz = null;

  function startViz() {
    if (typeof window.p5 !== 'function') {
      $('#viz').hidden = true; // p5를 못 불러와도 게임은 진행
      return;
    }
    const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    let colors = {};
    const readColors = () => {
      colors = {
        bg: css('--viz-bg'), ink: css('--ink'), muted: css('--muted'), line: css('--line'),
        accent: css('--accent'), good: css('--good'), bad: css('--bad'),
      };
    };
    readColors();
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      (mq.addEventListener ? mq.addEventListener('change', readColors) : mq.addListener(readColors));
    }

    const hOf = () => (stage.black ? 260 : 210); // 반음 단계는 줄이 많아서 더 높게
    new window.p5((p) => {
      const el = $('#viz');
      const width = () => Math.max(200, el.clientWidth);

      p.setup = () => {
        p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
        p.createCanvas(width(), hOf()).parent(el);
        p.frameRate(30);
        p.textFont('-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif');
      };

      viz = { resize: () => { if (el.clientWidth) p.resizeCanvas(width(), hOf()); } };
      p.windowResized = () => viz.resize();

      p.draw = () => {
        if (el.offsetParent === null) return; // 화면에 안 보이면 그리지 않음
        const W = p.width, H = p.height;
        const left = 44, right = 12, top = 16, bottom = 36;
        const rows = HIGH - LOW;
        const rowH = (H - top - bottom) / rows;
        const yOf = (m) => top + (HIGH - m) * rowH;
        const cols = stage.count + 1;
        const colW = (W - left - right) / cols;
        const xOf = (c) => left + colW * (c + 0.5);
        const now = ctx ? ctx.currentTime : 0;
        const isOn = (kind, idx) => timeline.some((e) => e.kind === kind && (kind === 'ref' || e.idx === idx) && now >= e.start && now <= e.end);

        p.background(colors.bg);

        // 가로줄 + 음 이름
        p.textSize(11);
        p.textAlign(p.RIGHT, p.CENTER);
        for (let m = LOW; m <= HIGH; m++) {
          const y = yOf(m);
          p.stroke(colors.line);
          p.strokeWeight(isBlack(m) ? 0.5 : 1);
          if (isBlack(m)) p.drawingContext.setLineDash([3, 4]);
          p.line(left, y, W - right, y);
          p.drawingContext.setLineDash([]);
          if (!isBlack(m) || stage.black) {
            p.noStroke();
            p.fill(isBlack(m) ? colors.muted : colors.ink);
            p.text(m === HIGH ? '높은도' : NAMES[m % 12], left - 6, y);
          }
        }

        // 아래 칸 이름
        p.noStroke();
        p.fill(colors.muted);
        p.textAlign(p.CENTER, p.CENTER);
        p.text('기준', xOf(0), H - 12);
        for (let i = 0; i < stage.count; i++) p.text(String(i + 1), xOf(i + 1), H - 12);

        const bw = Math.min(46, colW * 0.55), bh = Math.max(8, rowH - 2);
        const block = (x, y, col, glow) => {
          if (glow) {
            p.noStroke();
            const c = p.color(col); c.setAlpha(70);
            p.fill(c);
            p.rect(x - bw / 2 - 5, y - bh / 2 - 5, bw + 10, bh + 10, 8);
          }
          p.noStroke();
          p.fill(col);
          p.rect(x - bw / 2, y - bh / 2, bw, bh, 5);
        };
        const ring = (x, y, col) => {
          p.noFill();
          p.stroke(col);
          p.strokeWeight(2);
          p.rect(x - bw / 2, y - bh / 2, bw, bh, 5);
        };

        // 정답 공개 후: 음의 흐름을 선으로 이음
        if (graded) {
          p.stroke(colors.good);
          p.strokeWeight(1.5);
          p.drawingContext.setLineDash([4, 4]);
          let px = xOf(0), py = yOf(REF);
          q.notes.forEach((m, i) => { p.line(px, py, xOf(i + 1), yOf(m)); px = xOf(i + 1); py = yOf(m); });
          p.drawingContext.setLineDash([]);
        }

        // 기준음
        block(xOf(0), yOf(REF), colors.accent, isOn('ref'));

        // 문제 음
        q.notes.forEach((m, i) => {
          const x = xOf(i + 1);
          const a = answer[i];
          if (graded) {
            if (a != null && a !== m) ring(x, yOf(a), colors.bad);
            block(x, yOf(m), colors.good, isOn('q', i));
          } else {
            if (a != null) ring(x, yOf(a), colors.accent);
            // 정답은 숨긴 채 "?" 표시, 울리는 동안 반짝임
            const on = isOn('q', i);
            const cy = top + (H - top - bottom) / 2;
            p.noStroke();
            const c = p.color(on ? colors.accent : colors.muted);
            c.setAlpha(on ? 200 : 60);
            p.fill(c);
            p.circle(x, cy, on ? 30 : 24);
            p.fill(on ? colors.bg : colors.ink);
            p.textSize(14);
            p.text('?', x, cy + 1);
            p.textSize(11);
          }
        });
      };
    });
  }

  // ---------- 연결 ----------
  function init() {
    renderMenu();
    $('#btn-ref').addEventListener('click', playRef);
    $('#btn-replay').addEventListener('click', () => playSequence(true));
    $('#btn-undo').addEventListener('click', undo);
    $('#btn-check').addEventListener('click', check);
    $('#btn-next').addEventListener('click', () => { ensureAudio(); nextQuestion(); });
    $('#btn-menu').addEventListener('click', () => { renderMenu(); show('#screen-menu'); });
    renderSfxButton();
    $('#btn-sfx').addEventListener('click', () => {
      progress.sfx = !progress.sfx;
      saveProgress();
      renderSfxButton();
      if (progress.sfx) sfx(true); // 켜면 미리 들려줌
    });
    $('#sum-retry').addEventListener('click', () => startStage(stage));
    $('#sum-next').addEventListener('click', () => startStage(STAGES[stage.id]));
    $('#sum-menu').addEventListener('click', () => show('#screen-menu'));
    $('#btn-reset').addEventListener('click', () => {
      if (!confirm('단계 진행 기록을 모두 지울까요?')) return;
      progress = { unlocked: 1, best: {}, sfx: progress.sfx };
      saveProgress();
      renderMenu();
    });

    // 컴퓨터 키보드: Enter=확인/다음, Backspace=지우기, R=다시 듣기
    document.addEventListener('keydown', (e) => {
      if ($('#screen-game').hidden) return;
      if (e.target && e.target.classList && e.target.classList.contains('key')) return;
      if (e.key === 'Enter') { e.preventDefault(); graded ? $('#btn-next').click() : check(); }
      else if (e.key === 'Backspace') { e.preventDefault(); undo(); }
      else if (e.key === 'r' || e.key === 'R') { if (!$('#btn-replay').disabled) playSequence(true); }
    });

    startViz();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
