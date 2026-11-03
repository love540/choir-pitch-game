/* 합창단 청음 연습
 * 1) 기준음 청음: 기준음 도(C4)를 들려준 뒤 문제 음을 들려주고, 건반으로 맞힌다.
 * 4) 화음 청음: 3화음의 장·단(감·증)을 구별하고, 화음 속 베이스·소프라노·가운데 음을 찾는다.
 * 3) 박자 따라 하기: 들려준 리듬을 메트로놈에 맞춰 버튼으로 따라 친다. 이어폰 지연을 재서 보정한다.
 * 6) 첫 음 잡기: 기준음만 듣고 목표 음을 부르면 마이크로 음정을 잰다(녹음은 저장하지 않음).
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
  const noteName = (m) => (m >= 72 ? '높은 ' : m < 60 ? '낮은 ' : '') + NAMES[m % 12];
  const noteLetter = (m) => LETTERS[m % 12] + (Math.floor(m / 12) - 1);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ---------- 화음 ----------
  const CHORDS = {
    maj: { iv: [0, 4, 7], name: '장3화음', feel: '밝은 소리' },
    min: { iv: [0, 3, 7], name: '단3화음', feel: '어두운 소리' },
    dim: { iv: [0, 3, 6], name: '감3화음', feel: '긴장된 소리' },
    aug: { iv: [0, 4, 8], name: '증3화음', feel: '붕 뜬 소리' },
  };
  const VOICES = {
    bass: { label: '가장 낮은 음(베이스)', pickIdx: 0 },
    top: { label: '가장 높은 음(소프라노)', pickIdx: 2 },
    mid: { label: '가운데 음(알토)', pickIdx: 1 },
  };

  // ---------- 게임과 단계 ----------
  // kind: seq(음 순서 맞히기) | quality(화음 종류 고르기) | voice(화음 속 한 음 찾기)
  const GAMES = [
    {
      id: 'pitch', title: '기준음 청음', desc: '기준음 도를 듣고, 이어서 들리는 음을 건반에서 맞혀요.',
      stages: [
        { id: 1, kind: 'seq', title: '한 음 · 흰 건반', desc: '도~높은 도 사이 흰 건반 한 음', count: 1, black: false },
        { id: 2, kind: 'seq', title: '한 음 · 반음 포함', desc: '검은 건반(♯)까지 포함한 한 음', count: 1, black: true },
        { id: 3, kind: 'seq', title: '두 음 · 흰 건반', desc: '흰 건반 두 음을 순서대로', count: 2, black: false },
        { id: 4, kind: 'seq', title: '두 음 · 반음 포함', desc: '반음 포함 두 음을 순서대로', count: 2, black: true },
        { id: 5, kind: 'seq', title: '세 음 · 반음 포함', desc: '반음 포함 세 음을 순서대로', count: 3, black: true },
        { id: 6, kind: 'seq', title: '네 음 · 반음 포함', desc: '반음 포함 네 음을 순서대로', count: 4, black: true },
      ],
    },
    {
      id: 'chord', title: '화음 청음', desc: '세 음이 함께 울리는 화음을 듣고 밝기를 구별하거나, 화음 속 한 음을 찾아요.',
      stages: [
        { id: 1, kind: 'quality', title: '장조·단조 · 펼친 화음', desc: '한 음씩 들려준 뒤 함께 울려요', types: ['maj', 'min'], arpeggio: true, ref: false },
        { id: 2, kind: 'quality', title: '장조·단조', desc: '함께 울리는 화음만 듣고 구별', types: ['maj', 'min'], ref: false },
        { id: 3, kind: 'quality', title: '장·단·감·증', desc: '감3화음, 증3화음까지 구별', types: ['maj', 'min', 'dim', 'aug'], ref: false },
        { id: 4, kind: 'voice', voice: 'bass', title: '베이스 음 찾기', desc: '기준음 도를 듣고, 화음의 가장 낮은 음', types: ['maj', 'min'] },
        { id: 5, kind: 'voice', voice: 'top', title: '소프라노 음 찾기', desc: '기준음 도를 듣고, 화음의 가장 높은 음', types: ['maj', 'min'] },
        { id: 6, kind: 'voice', voice: 'mid', title: '가운데 음 찾기', desc: '기준음 도를 듣고, 알토처럼 가운데 있는 음', types: ['maj', 'min'] },
      ],
    },
  ];
  // 리듬 조각: len=박 수, on=16분음표 단위 위치
  const CELLS = {
    q: { len: 1, on: [0] },            // ♩
    h: { len: 2, on: [0] },            // 𝅗𝅥
    r: { len: 1, on: [] },             // 4분쉼표
    ee: { len: 1, on: [0, 2] },        // ♪♪
    re: { len: 1, on: [2] },           // 8분쉼표 + ♪
    dq: { len: 2, on: [0, 6] },        // 점4분 + 8분
    s4: { len: 1, on: [0, 1, 2, 3] },  // 16분 넷
    s3a: { len: 1, on: [0, 2, 3] },    // 8분 + 16분 둘
    s3b: { len: 1, on: [0, 1, 2] },    // 16분 둘 + 8분
    syn: { len: 2, on: [0, 2, 6] },    // ♪♩♪ 당김음
  };
  GAMES.push({
    id: 'rhythm', title: '박자 따라 하기', desc: '예비박 뒤에 들려주는 리듬을 듣고, 이어지는 메트로놈에 맞춰 버튼으로 똑같이 쳐요.',
    stages: [
      { id: 1, kind: 'rhythm', title: '4분음표', desc: '♩와 2분음표 · 한 마디', cells: ['q', 'h'], bpm: 80, bars: 1 },
      { id: 2, kind: 'rhythm', title: '8분음표', desc: '♪♪가 들어간 한 마디', cells: ['q', 'h', 'ee'], focus: ['ee'], bpm: 80, bars: 1 },
      { id: 3, kind: 'rhythm', title: '쉼표', desc: '4분쉼표, 8분쉼표가 들어간 한 마디', cells: ['q', 'ee', 'r', 're'], focus: ['r', 're'], bpm: 80, bars: 1 },
      { id: 4, kind: 'rhythm', title: '점음표', desc: '점4분음표 + 8분음표', cells: ['q', 'ee', 'dq', 'r'], focus: ['dq'], bpm: 76, bars: 1 },
      { id: 5, kind: 'rhythm', title: '16분음표', desc: '빠르게 쪼개지는 박', cells: ['q', 'ee', 's4', 's3a', 's3b'], focus: ['s4', 's3a', 's3b'], bpm: 70, bars: 1 },
      { id: 6, kind: 'rhythm', title: '당김음 · 두 마디', desc: '박 사이에서 시작하는 리듬, 두 마디', cells: ['q', 'ee', 'syn', 're', 'dq'], focus: ['syn'], bpm: 80, bars: 2 },
    ],
  });
  GAMES[1].stages.forEach((s) => { s.count = 1; s.black = true; });
  GAMES[2].stages.forEach((s) => { s.count = 0; s.black = false; s.ref = false; });
  const SING_REFS = [57, 59, 60, 62, 64, 65, 67]; // 라3 ~ 솔4
  const SING_IVS = [-7, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 7];
  GAMES.push({
    id: 'firstnote', title: '첫 음 잡기', desc: '기준음 하나만 듣고 목표 음을 바로 불러요. 마이크로 음정을 재요(녹음은 저장하지 않아요).',
    stages: [
      { id: 1, kind: 'sing', title: '같은 음 내기', desc: '기준음 도를 듣고 같은 음 · ±50센트', refs: [60], iv: [0], tol: 50 },
      { id: 2, kind: 'sing', title: '도·미·솔', desc: '기준음 도 → 도, 미, 솔 · ±50센트', refs: [60], iv: [0, 4, 7], tol: 50 },
      { id: 3, kind: 'sing', title: '흰 건반', desc: '기준음 도 → 레~시 · ±50센트', refs: [60], iv: [2, 4, 5, 7, 9, 11], tol: 50 },
      { id: 4, kind: 'sing', title: '반음 포함', desc: '기준음 도 → 도♯~시 · ±50센트', refs: [60], iv: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], tol: 50 },
      { id: 5, kind: 'sing', title: '기준음이 바뀌어요', desc: '여러 기준음에서 위아래 음 · ±50센트', refs: SING_REFS, iv: SING_IVS, tol: 50 },
      { id: 6, kind: 'sing', title: '정확하게 · 잠깐 쉬고', desc: '기준음 뒤 2초 쉬고 부르기 · ±30센트', refs: SING_REFS, iv: SING_IVS, tol: 30, delay: 2 },
    ],
  });
  GAMES[3].stages.forEach((s) => { s.count = 0; s.black = false; });
  const GAME_ICONS = { pitch: '🎯', chord: '🎶', rhythm: '🥁', firstnote: '🎤' };
  const ROUND_LEN = 10;
  const PASS = 8;

  // ---------- 진행 상황 저장 (브라우저에만 저장) ----------
  const STORE_KEY = 'choir-pitch-game:v1';
  const freshGames = () => Object.fromEntries(GAMES.map((g) => [g.id, { unlocked: 1, best: {} }]));
  function loadProgress() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      const games = freshGames();
      if (d.games) {
        for (const id of Object.keys(games)) if (d.games[id]) games[id] = { unlocked: d.games[id].unlocked || 1, best: d.games[id].best || {} };
      } else if (d.unlocked) {
        games.pitch = { unlocked: d.unlocked, best: d.best || {} }; // 예전 기록(기준음 청음만 있던 때) 옮기기
      }
      return { games, sfx: d.sfx !== false, latency: typeof d.latency === 'number' ? d.latency : null };
    } catch (e) {
      return { games: freshGames(), sfx: true, latency: null };
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

  function tone(midi, t, dur, vol = 0.45) {
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
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(vol * 0.27, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35);
    o.connect(lp); lp.connect(g); g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.4);
  }

  // 여러 음을 함께 울릴 때는 한 음씩 작게
  function chordTone(notes, t, dur) {
    const vol = 0.5 / Math.sqrt(notes.length);
    notes.forEach((m) => tone(m, t, dur, vol));
  }

  // 지금 울리는 음 (그림에서 반짝이게 하려고 기록)
  let timeline = [];
  let busyTimer = null;

  function playQuestion() {
    if (q.kind === 'rhythm') return playRhythm();
    if (q.kind === 'sing') { if (mic) beginSing(); return; } // 마이크 허용 전에는 시작 버튼을 기다림
    ensureAudio();
    let t = ctx.currentTime + 0.08;
    timeline = [];
    if (stage.ref !== false) {
      tone(REF, t, 1.0);
      timeline.push({ start: t, end: t + 1.0, kind: 'ref' });
      t += 1.7;
    }
    if (q.kind === 'seq') {
      q.notes.forEach((m, i) => {
        tone(m, t, 0.75);
        timeline.push({ start: t, end: t + 0.75, kind: 'q', idx: i });
        t += 0.95;
      });
    } else {
      if (stage.arpeggio) { // 펼친 화음: 아래에서부터 한 음씩
        q.chord.forEach((m) => {
          tone(m, t, 0.5);
          timeline.push({ start: t, end: t + 0.5, kind: 'chord' });
          t += 0.5;
        });
        t += 0.3;
      }
      chordTone(q.chord, t, 1.6);
      timeline.push({ start: t, end: t + 1.6, kind: 'chord' });
      t += 1.8;
    }
    setBusy(t - ctx.currentTime);
  }

  function playRef() {
    ensureAudio();
    const t = ctx.currentTime + 0.05;
    tone(q.kind === 'sing' ? q.ref : REF, t, 1.0);
    timeline = [{ start: t, end: t + 1.0, kind: 'ref' }];
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
    $('#btn-ref').disabled = true;
    $('#btn-replay').disabled = true;
    clearTimeout(busyTimer);
    busyTimer = setTimeout(() => {
      $('#btn-ref').disabled = false;
      $('#btn-replay').disabled = false;
    }, sec * 1000);
  }

  // ---------- 게임 상태 ----------
  let game = GAMES[0];
  let stage = game.stages[0];
  let q = { kind: 'seq', notes: [] }; // 현재 문제
  let answer = [];             // 사용자가 고른 답 (음 번호, 또는 화음 종류)
  let graded = false;          // 채점이 끝났는지
  let qIndex = 0, score = 0;
  let lastKey = '';
  const gp = () => progress.games[game.id];

  function makeSeqQuestion() {
    const pool = [];
    for (let m = LOW; m <= HIGH; m++) if (stage.black || !isBlack(m)) pool.push(m);
    let notes, key;
    do {
      notes = [];
      while (notes.length < stage.count) {
        const m = pick(pool);
        if (notes.length && m === notes[notes.length - 1]) continue; // 같은 음 연속 금지
        if (stage.count === 1 && m === REF && Math.random() < 0.7) continue; // 기준음과 같은 답은 드물게
        notes.push(m);
      }
      key = notes.join(',');
    } while (key === lastKey);
    lastKey = key;
    return { kind: 'seq', notes };
  }

  // 3화음 하나를 도~높은 도 안에 들어오게 만든다. 화음 속 음 찾기 단계는 자리바꿈도 섞는다.
  function makeChordQuestion() {
    let chord, type, key;
    do {
      type = pick(stage.types);
      const inv = stage.kind === 'voice' ? Math.floor(Math.random() * 3) : 0;
      do {
        const root = 53 + Math.floor(Math.random() * 19);
        chord = CHORDS[type].iv.map((i) => root + i);
        for (let k = 0; k < inv; k++) chord.push(chord.shift() + 12);
      } while (chord[0] < LOW || chord[2] > HIGH);
      key = type + chord.join(',');
    } while (key === lastKey);
    lastKey = key;
    if (stage.kind === 'quality') return { kind: 'quality', chord, quality: type, notes: [] };
    const target = chord[VOICES[stage.voice].pickIdx];
    return { kind: 'voice', chord, quality: type, target, notes: [target] };
  }

  // 리듬: 마디 안에 리듬 조각을 채운다. 새로 배우는 조각(focus)이 꼭 하나는 들어가게.
  function makeRhythmQuestion() {
    const total = 4 * stage.bars;
    let onsets, key;
    for (;;) {
      onsets = [];
      const used = [];
      let beat = 0;
      while (beat < total) {
        const left = 4 - (beat % 4); // 마디선을 넘지 않게
        const fits = stage.cells.filter((c) => CELLS[c].len <= left);
        const c = pick(fits);
        if (beat === 0 && CELLS[c].on[0] !== 0 && stage.id <= 2) continue;
        CELLS[c].on.forEach((o) => onsets.push(beat * 4 + o));
        used.push(c);
        beat += CELLS[c].len;
      }
      if (onsets.length < (stage.id === 1 ? 2 : 3)) continue;
      if (stage.focus && !used.some((c) => stage.focus.includes(c))) continue;
      if (used.every((c) => c === 'r')) continue;
      key = onsets.join(',');
      if (key !== lastKey) break;
    }
    lastKey = key;
    return { kind: 'rhythm', onsets, total16: total * 4, bpm: stage.bpm, taps: [], result: null };
  }

  const makeQuestion = () => (stage.kind === 'seq' ? makeSeqQuestion()
    : stage.kind === 'rhythm' ? makeRhythmQuestion()
    : stage.kind === 'sing' ? makeSingQuestion() : makeChordQuestion());

  // ---------- 첫 음 잡기 (마이크로 음정 재기) ----------
  // 녹음은 저장하지 않는다. 마이크 소리에서 그때그때 음 높이만 재고 버린다.
  const LISTEN_SEC = 6;        // 부르기를 기다리는 최대 시간
  const STABLE_SEC = 0.4;      // 이만큼 음이 흔들리지 않으면 '첫 음'으로 본다
  const FRAME_MS = 40;
  const INTERVALS = ['같은 음', '단2도', '장2도', '단3도', '장3도', '완전4도', '증4도', '완전5도', '단6도', '장6도', '단7도', '장7도', '옥타브'];
  let mic = null;
  let listenTimer = null;
  let singTimers = [];

  const midiFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const centsOf = (f, ref) => 1200 * Math.log2(f / ref);
  const fold = (c) => ((((c + 600) % 1200) + 1200) % 1200) - 600; // 옥타브와 상관없이 -600~+600센트로
  function intervalText(ref, target) {
    const d = target - ref;
    if (d === 0) return '같은 음';
    return `${INTERVALS[Math.abs(d)]} ${d > 0 ? '위' : '아래'}`;
  }

  // YIN 방식 음 높이 찾기. 목소리 범위(약 70~1100Hz)만 본다.
  function detectPitch(buf, sr) {
    const n = buf.length, W = Math.floor(n / 2);
    let rms = 0;
    for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / n);
    if (rms < 0.01) return null; // 너무 조용함
    const tauMin = Math.floor(sr / 1100), tauMax = Math.min(W - 1, Math.floor(sr / 70));
    const d = new Float32Array(tauMax + 1);
    for (let tau = 1; tau <= tauMax; tau++) {
      let s = 0;
      for (let i = 0; i < W; i++) { const x = buf[i] - buf[i + tau]; s += x * x; }
      d[tau] = s;
    }
    // 누적 평균으로 나눈 차이 함수
    let run = 0;
    d[0] = 1;
    for (let tau = 1; tau <= tauMax; tau++) { run += d[tau]; d[tau] = run ? d[tau] * tau / run : 1; }
    let tau = -1;
    for (let t = tauMin; t <= tauMax; t++) {
      if (d[t] < 0.15) { while (t + 1 <= tauMax && d[t + 1] < d[t]) t++; tau = t; break; }
    }
    if (tau < 0) return null; // 음 높이가 분명하지 않음 (숨소리, 잡음)
    let better = tau; // 포물선 보간으로 더 정확하게
    if (tau > 1 && tau < tauMax) {
      const a = d[tau - 1], b = d[tau], c = d[tau + 1];
      const den = a + c - 2 * b;
      if (den) better = tau + (a - c) / (2 * den);
    }
    return { freq: sr / better, clarity: 1 - d[tau], rms };
  }
  window.ChoirPitch = { detect: detectPitch }; // 테스트용

  function makeSingQuestion() {
    let ref, target, key;
    do {
      ref = pick(stage.refs);
      target = ref + pick(stage.iv);
      key = `${ref},${target}`;
    } while (key === lastKey && stage.refs.length * stage.iv.length > 1);
    lastKey = key;
    return { kind: 'sing', ref, target, notes: [target], frames: [], sung: null, state: 'idle' };
  }

  async function ensureMic() {
    if (mic) return mic;
    ensureAudio();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('이 브라우저는 마이크를 쓸 수 없어요.');
    try { if (navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch (e) { /* 무시 */ }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, // 노래 소리를 깎지 않게
    });
    if (ctx.state !== 'running') await ctx.resume();
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 2048;
    src.connect(an); // 스피커로는 내보내지 않음
    mic = { stream, src, an, buf: new Float32Array(an.fftSize) };
    return mic;
  }

  function stopMic() {
    stopSing();
    if (!mic) return;
    mic.stream.getTracks().forEach((t) => t.stop());
    try { mic.src.disconnect(); } catch (e) { /* 무시 */ }
    mic = null;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* 무시 */ }
  }

  function stopSing() {
    clearInterval(listenTimer);
    listenTimer = null;
    singTimers.forEach(clearTimeout);
    singTimers = [];
  }

  function singStatus(text, cls = '') {
    const el = $('#sing-status');
    el.textContent = text;
    el.className = 'sing-status ' + cls;
  }

  function renderSingTarget() {
    $('#sing-ref').textContent = `기준음 ${noteName(q.ref)}`;
    $('#sing-note').textContent = NAMES[q.target % 12];
    $('#sing-interval').textContent = intervalText(q.ref, q.target);
  }

  async function beginSing() {
    if (q.kind !== 'sing' || graded || q.state === 'busy') return;
    const btn = $('#btn-sing');
    btn.disabled = true;
    q.state = 'busy';
    try {
      await ensureMic();
    } catch (e) {
      q.state = 'idle';
      btn.disabled = false;
      singStatus('마이크를 쓸 수 없어요. 아이폰은 설정 → Safari → 마이크에서 "허용"으로 바꾼 뒤 다시 눌러 주세요.', 'bad');
      return;
    }
    stopSing();
    q.frames = [];
    q.sung = null;
    singStatus('👂 기준음을 들어 보세요');
    const t = ctx.currentTime + 0.1;
    tone(q.ref, t, 1.2);
    timeline = [{ start: t, end: t + 1.2, kind: 'ref' }];
    const wait = (t - ctx.currentTime) + 1.2 + 0.55 + (stage.delay || 0); // 기준음 여운이 마이크에 섞이지 않게 조금 쉬고
    if (stage.delay) singTimers.push(setTimeout(() => singStatus(`🤫 ${stage.delay}초 동안 속으로 음을 떠올려 보세요`), (wait - stage.delay) * 1000));
    singTimers.push(setTimeout(startListening, wait * 1000));
  }

  function startListening() {
    singStatus(`🎤 지금 "${NAMES[q.target % 12]}"를 불러 보세요 (아— 하고 길게)`, 'live');
    q.listenStart = ctx.currentTime;
    q.state = 'listening';
    const per = Math.round(STABLE_SEC * 1000 / FRAME_MS);
    listenTimer = setInterval(() => {
      mic.an.getFloatTimeDomainData(mic.buf);
      const r = detectPitch(mic.buf, ctx.sampleRate);
      const tt = ctx.currentTime - q.listenStart;
      q.frames.push({ t: tt, f: r ? r.freq : null });
      // 최근 STABLE_SEC 동안 음이 모두 잡혔고, 서로 ±35센트 안이면 '첫 음'
      const last = q.frames.slice(-per);
      if (last.length === per && last.every((x) => x.f)) {
        const fs = last.map((x) => x.f).sort((a, b) => a - b);
        const med = fs[Math.floor(fs.length / 2)];
        if (last.every((x) => Math.abs(centsOf(x.f, med)) <= 35)) {
          q.stable = { from: last[0].t, to: tt, f: med };
          return gradeSing(med);
        }
      }
      if (tt > LISTEN_SEC) {
        stopSing();
        q.state = 'idle';
        $('#btn-sing').disabled = false;
        $('#btn-sing').textContent = '🎤 다시 시도';
        singStatus('소리가 잘 안 잡혔어요. 조금 더 크게, 한 음을 길게 불러 주세요. (이 문제는 점수에 들어가지 않았어요)', 'bad');
      }
    }, FRAME_MS);
  }

  function gradeSing(f) {
    stopSing();
    q.state = 'done';
    q.sung = f;
    const c = Math.round(fold(centsOf(f, midiFreq(q.target))));
    q.cents = c;
    const ok = Math.abs(c) <= stage.tol;
    graded = true;
    if (ok) score++;
    sfx(ok);
    $('#progress').textContent = `${qIndex} / ${ROUND_LEN} · 맞힘 ${score}`;
    const sungMidi = Math.round(69 + 12 * Math.log2(f / 440));
    const sign = c > 0 ? '+' : '';
    const fb = $('#feedback');
    fb.className = 'feedback ' + (ok ? 'good' : 'bad');
    const when = ` · 첫 음까지 ${q.stable.from.toFixed(1)}초`;
    if (ok) fb.textContent = `정답이에요! ${NAMES[q.target % 12]}에서 ${sign}${c}센트${when}`;
    else if (Math.abs(c) < 100) fb.textContent = `아깝네요. ${sign}${c}센트, 조금 ${c > 0 ? '높아요' : '낮아요'} (±${stage.tol}센트 안이면 정답)${when}`;
    else fb.textContent = `"${NAMES[sungMidi % 12]}"에 가까웠어요. 목표보다 ${sign}${c}센트 ${c > 0 ? '높아요' : '낮아요'}${when}`;
    singStatus('🎹 "정답 음 듣기"로 기준음과 목표 음을 이어서 들어 볼 수 있어요.');
    $('#btn-sing').hidden = true;
    $('#btn-replay').hidden = false;
    $('#btn-next').hidden = false;
    $('#btn-next').textContent = qIndex >= ROUND_LEN ? '결과 보기' : '다음 문제';
    $('#btn-next').focus();
  }

  // 채점 후: 기준음 → 목표 음
  function playSingAnswer() {
    ensureAudio();
    const t = ctx.currentTime + 0.05;
    tone(q.ref, t, 0.9);
    tone(q.target, t + 1.1, 1.2);
    timeline = [{ start: t, end: t + 0.9, kind: 'ref' }];
    setBusy(2.4);
  }

  // 음정 그림: 가운데 줄이 목표 음, 위아래로 반음(100센트)마다 줄
  function drawSing(p, colors) {
    const W = p.width, H = p.height;
    const left = 52, right = 12, top = 14, bottom = 28;
    const RANGE = 450;
    const mid = top + (H - top - bottom) / 2;
    const yOf = (c) => mid - (c / RANGE) * ((H - top - bottom) / 2);
    const xOf = (t) => left + (W - left - right) * Math.min(1, t / LISTEN_SEC);
    p.background(colors.bg);

    // 정답 범위
    p.noStroke();
    const band = p.color(colors.good); band.setAlpha(40);
    p.fill(band);
    p.rect(left, yOf(stage.tol), W - left - right, yOf(-stage.tol) - yOf(stage.tol));

    // 반음 줄 + 음 이름
    p.textSize(11);
    p.textAlign(p.RIGHT, p.CENTER);
    for (let k = -4; k <= 4; k++) {
      const y = yOf(k * 100);
      p.stroke(k === 0 ? colors.good : colors.line);
      p.strokeWeight(k === 0 ? 1.5 : 1);
      if (k !== 0) p.drawingContext.setLineDash([3, 4]);
      p.line(left, y, W - right, y);
      p.drawingContext.setLineDash([]);
      p.noStroke();
      p.fill(k === 0 ? colors.ink : colors.muted);
      p.text(NAMES[(((q.target + k) % 12) + 12) % 12], left - 6, y);
    }
    p.textAlign(p.CENTER, p.CENTER);
    p.fill(colors.muted);
    p.text('시간 →', W / 2, H - 10);

    // 부른 음 (옥타브는 접어서)
    const ft = midiFreq(q.target);
    const s = q.stable;
    q.frames.forEach((fr) => {
      if (!fr.f) return;
      const c = fold(centsOf(fr.f, ft));
      const inStable = graded && s && fr.t >= s.from - 1e-6 && fr.t <= s.to + 1e-6;
      const col = inStable ? (Math.abs(q.cents) <= stage.tol ? colors.good : colors.bad) : colors.accent;
      p.noStroke();
      p.fill(col);
      const y = yOf(Math.max(-RANGE, Math.min(RANGE, c)));
      p.circle(xOf(fr.t), y, inStable ? 7 : 5);
    });
    if (graded && s) {
      const y = yOf(Math.max(-RANGE, Math.min(RANGE, q.cents)));
      p.stroke(Math.abs(q.cents) <= stage.tol ? colors.good : colors.bad);
      p.strokeWeight(2);
      p.line(xOf(s.from), y, xOf(s.to), y);
    }
    if (q.state === 'listening') { // 지금 시각
      const x = xOf(ctx.currentTime - q.listenStart);
      p.stroke(colors.accent);
      p.strokeWeight(1);
      p.line(x, top, x, H - bottom);
    }
  }

  // ---------- 박자 따라 하기 ----------
  // 흐름: 예비박 4번 → 리듬 듣기(메트로놈 작게) → 같은 길이만큼 메트로놈에 맞춰 따라 치기 → 자동 채점
  let rhythmTimers = [];
  let rhythmNodes = [];
  let calib = null;

  function stopRhythm() {
    rhythmTimers.forEach(clearTimeout);
    rhythmTimers = [];
    rhythmNodes.forEach((n) => { try { n.stop(); } catch (e) { /* 이미 끝남 */ } });
    rhythmNodes = [];
  }
  const later = (sec, fn) => rhythmTimers.push(setTimeout(fn, Math.max(0, sec * 1000)));

  // 메트로놈 딸깍 (마디 첫 박은 조금 높게)
  function click(t, accent, vol) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = accent ? 1760 : 1320;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.06);
    rhythmNodes.push(o);
  }

  // 리듬 소리: 나무토막처럼 짧고 또렷하게
  function wood(t) {
    [[700, 0.4], [1400, 0.12]].forEach(([f, v]) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.85, t + 0.08);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.14);
      rhythmNodes.push(o);
    });
  }

  // 소리가 귀에 닿기까지 걸리는 시간(초). 지연 맞추기를 안 했으면 브라우저가 알려 주는 값.
  function latency() {
    if (progress.latency != null) return progress.latency;
    return ctx ? (ctx.outputLatency || 0) + (ctx.baseLatency || 0) : 0;
  }

  function padState(state) {
    const pad = $('#tap-pad');
    pad.classList.remove('listen', 'play', 'done');
    pad.classList.add(state);
    pad.textContent = {
      listen: '👂 듣는 중… 다 들은 뒤에 따라 치세요',
      play: '👏 지금 따라 치세요!',
      done: '채점 끝! 아래 "다음 문제"를 눌러 주세요',
    }[state];
  }

  function playRhythm() {
    ensureAudio();
    stopRhythm();
    const spb = 60 / q.bpm, s16 = spb / 4, len = q.total16 * s16, beats = q.total16 / 4;
    const t0 = ctx.currentTime + 0.15;
    const listen = t0 + 4 * spb, play = listen + len, end = play + len;
    const replayOnly = graded; // 채점 후에는 듣기만 다시
    q.time = { t0, listen, play, end, spb, s16, len, replayOnly };
    for (let i = 0; i < 4; i++) click(t0 + i * spb, i === 0, 0.35);         // 예비박
    for (let b = 0; b < beats; b++) click(listen + b * spb, b % 4 === 0, 0.1); // 듣기: 메트로놈 작게
    q.onsets.forEach((o) => wood(listen + o * s16));
    const now = ctx.currentTime;
    if (replayOnly) {
      setBusy(play - now);
      return;
    }
    q.taps = [];
    q.result = null;
    for (let b = 0; b < beats; b++) click(play + b * spb, b % 4 === 0, 0.3);  // 따라 치기: 메트로놈만
    padState('listen');
    setBusy(end - now + 0.3);
    later(play - now - 0.03, () => padState('play'));
    later(end - now + 0.4 + latency(), gradeRhythm);
  }

  function onTap() {
    if (q.kind !== 'rhythm' || graded || !q.time) return;
    q.taps.push(ctx.currentTime);
    flashPad($('#tap-pad'));
  }

  function flashPad(el) {
    el.classList.add('hit');
    setTimeout(() => el.classList.remove('hit'), 90);
  }

  function gradeRhythm() {
    if (graded) return;
    const { play, s16, len } = q.time;
    const lat = latency();
    const exp = q.onsets.map((o) => play + o * s16);
    let minGap = 4;
    for (let i = 1; i < q.onsets.length; i++) minGap = Math.min(minGap, q.onsets[i] - q.onsets[i - 1]);
    const win = Math.min(0.15, minGap * s16 * 0.5); // 이웃한 음과 헷갈리지 않는 범위에서 최대 0.15초
    const taps = q.taps.map((t) => t - lat).filter((t) => t >= play - win && t <= play + len + win);
    const used = new Set();
    const notes = exp.map((e) => {
      let best = -1, bestD = Infinity;
      taps.forEach((t, i) => {
        const d = Math.abs(t - e);
        if (!used.has(i) && d <= win && d < bestD) { best = i; bestD = d; }
      });
      if (best < 0) return { e, tap: null, d: null };
      used.add(best);
      return { e, tap: taps[best], d: taps[best] - e };
    });
    const extras = taps.filter((t, i) => !used.has(i));
    const hit = notes.filter((n) => n.tap != null);
    const missed = notes.length - hit.length;
    const ok = missed === 0 && extras.length === 0;
    q.result = { notes, extras, win, lat };

    graded = true;
    if (ok) score++;
    sfx(ok);
    $('#progress').textContent = `${qIndex} / ${ROUND_LEN} · 맞힘 ${score}`;
    const meanD = hit.length ? hit.reduce((a, n) => a + n.d, 0) / hit.length : 0;
    const meanAbs = hit.length ? hit.reduce((a, n) => a + Math.abs(n.d), 0) / hit.length : 0;
    const tend = Math.abs(meanD) < 0.03 ? '' : meanD < 0 ? ' · 조금 서두르는 편이에요' : ' · 조금 늦는 편이에요';
    const fb = $('#feedback');
    fb.className = 'feedback ' + (ok ? 'good' : 'bad');
    if (!q.taps.length) fb.textContent = '버튼을 누르지 않았어요. 메트로놈이 다시 시작될 때 따라 쳐 보세요.';
    else if (ok) fb.textContent = `정답이에요! 평균 ${Math.round(meanAbs * 1000)}ms 차이${tend}`;
    else fb.textContent = [missed ? `놓친 박 ${missed}개` : '', extras.length ? `남는 탭 ${extras.length}개` : ''].filter(Boolean).join(', ') + tend;
    padState('done');
    $('#btn-next').hidden = false;
    $('#btn-next').textContent = qIndex >= ROUND_LEN ? '결과 보기' : '다음 문제';
    $('#key-hint').textContent = '위 그림에서 초록 동그라미는 맞게 친 박, 빨강은 놓치거나 남은 탭이에요. "처음부터 다시"로 리듬을 다시 들을 수 있어요.';
    $('#btn-next').focus();
  }

  // 박자 그림: 위 줄은 들려준 리듬, 아래 줄은 내가 친 탭
  function drawRhythm(p, colors) {
    const W = p.width, H = p.height;
    const left = 52, right = 14;
    const rows = [{ y: 62, label: '듣기' }, { y: 132, label: '따라' }];
    const total = q.total16;
    const xOf = (u) => left + (W - left - right) * (u / total);
    const now = ctx ? ctx.currentTime : 0;
    const T = q.time;
    p.background(colors.bg);

    // 박 번호
    p.noStroke();
    p.fill(colors.muted);
    p.textSize(11);
    p.textAlign(p.CENTER, p.CENTER);
    for (let u = 0; u < total; u += 4) p.text(String((u / 4) % 4 + 1), xOf(u), 26);

    rows.forEach((r) => {
      p.noStroke();
      p.fill(colors.ink);
      p.textAlign(p.LEFT, p.CENTER);
      p.textSize(12);
      p.text(r.label, 10, r.y);
      for (let u = 0; u <= total; u += 2) {
        const strong = u % 16 === 0, beat = u % 4 === 0;
        p.stroke(colors.line);
        p.strokeWeight(strong ? 2 : beat ? 1 : 0.5);
        if (!beat) p.drawingContext.setLineDash([2, 4]);
        p.line(xOf(u), r.y - 20, xOf(u), r.y + 20);
        p.drawingContext.setLineDash([]);
      }
      p.stroke(colors.line);
      p.strokeWeight(1);
      p.line(xOf(0), r.y, xOf(total), r.y);
    });

    if (!T) return;
    const uAt = (t, start) => (t - start) / T.s16;

    // 예비박 숫자
    if (now >= T.t0 && now < T.listen) {
      const n = Math.floor((now - T.t0) / T.spb) + 1;
      p.noStroke();
      p.fill(colors.accent);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(15);
      p.text(`예비박 ${n}`, W / 2, H - 16);
    }

    // 재생 위치
    const head = (start, y) => {
      if (now < start || now > start + T.len) return;
      const x = xOf(uAt(now, start));
      p.stroke(colors.accent);
      p.strokeWeight(2);
      p.line(x, y - 24, x, y + 24);
    };
    head(T.listen, rows[0].y);
    if (!T.replayOnly || !graded) head(T.play, rows[1].y);

    // 위 줄: 채점 전에는 소리 날 때만 잠깐 반짝, 채점 후에는 리듬 전체 표시
    q.onsets.forEach((o, i) => {
      const x = xOf(o);
      const age = now - (T.listen + o * T.s16);
      if (graded) {
        const nextU = i + 1 < q.onsets.length ? q.onsets[i + 1] : total;
        p.noStroke();
        const c = p.color(colors.accent); c.setAlpha(50);
        p.fill(c);
        p.rect(x, rows[0].y - 6, Math.max(0, xOf(Math.min(nextU, o + 4)) - x - 3), 12, 6);
        p.fill(colors.accent);
        p.circle(x, rows[0].y, 14);
      } else if (age >= 0 && age < 0.18) {
        p.noStroke();
        p.fill(colors.accent);
        p.circle(x, rows[0].y, 18 - age * 40);
      }
    });

    // 아래 줄: 내 탭
    const lat = latency();
    if (!graded) {
      q.taps.forEach((t) => {
        const u = uAt(t - lat, T.play);
        if (u < -1 || u > total + 1) return;
        p.noStroke();
        p.fill(colors.accent);
        p.circle(xOf(u), rows[1].y, 12);
      });
      return;
    }
    const R = q.result;
    if (!R) return;
    R.notes.forEach((n) => {
      const xe = xOf(uAt(n.e, T.play));
      p.noFill();
      p.strokeWeight(2);
      p.stroke(n.tap != null ? colors.good : colors.bad);
      p.circle(xe, rows[1].y, 18);
      if (n.tap != null) {
        const xt = xOf(uAt(n.tap, T.play));
        p.noStroke();
        p.fill(Math.abs(n.d) <= 0.06 ? colors.good : colors.accent);
        p.circle(xt, rows[1].y, 10);
      }
    });
    R.extras.forEach((t) => {
      p.noStroke();
      p.fill(colors.bad);
      p.circle(xOf(uAt(t, T.play)), rows[1].y, 10);
    });
  }

  // ---------- 이어폰 지연 맞추기 ----------
  function openCalib() {
    ensureAudio();
    stopRhythm();
    calib = null;
    $('#calib-result').textContent = progress.latency == null ? '' : `지금 보정값: ${Math.round(progress.latency * 1000)}ms`;
    $('#calib-pad').textContent = '시작을 누르면 딸깍 소리가 12번 나요';
    $('#calib-pad').className = 'tap-pad';
    $('#calib-start').disabled = false;
    show('#screen-calib');
  }

  function startCalib() {
    ensureAudio();
    stopRhythm();
    const spb = 0.6, n = 12;
    const t0 = ctx.currentTime + 0.6;
    calib = { clicks: [], taps: [] };
    for (let i = 0; i < n; i++) {
      click(t0 + i * spb, i % 4 === 0, 0.4);
      calib.clicks.push(t0 + i * spb);
    }
    $('#calib-start').disabled = true;
    $('#calib-result').textContent = '';
    const pad = $('#calib-pad');
    pad.className = 'tap-pad play';
    pad.textContent = '👏 딸깍 소리에 맞춰 누르세요';
    later(t0 + n * spb - ctx.currentTime + 0.5, finishCalib);
  }

  function onCalibTap() {
    if (!calib) return;
    calib.taps.push(ctx.currentTime);
    flashPad($('#calib-pad'));
  }

  function finishCalib() {
    const offs = [];
    calib.taps.forEach((t) => {
      let best = null;
      calib.clicks.forEach((c, i) => { if (i >= 2 && (best == null || Math.abs(t - c) < Math.abs(best))) best = t - c; }); // 처음 두 번은 박 찾는 중이라 뺌
      if (best != null && Math.abs(best) < 0.3) offs.push(best);
    });
    calib = null;
    $('#calib-start').disabled = false;
    $('#calib-pad').className = 'tap-pad';
    $('#calib-pad').textContent = '다시 하려면 시작을 누르세요';
    if (offs.length < 5) {
      $('#calib-result').textContent = '누른 횟수가 부족해요. 딸깍 소리에 맞춰 계속 눌러 주세요. 다시 해 볼까요?';
      return;
    }
    offs.sort((a, b) => a - b);
    const med = offs[Math.floor(offs.length / 2)];
    const spread = offs.map((d) => Math.abs(d - med)).sort((a, b) => a - b)[Math.floor(offs.length / 2)];
    progress.latency = Math.max(-0.05, Math.min(0.5, med));
    saveProgress();
    let msg = `지연을 ${Math.round(progress.latency * 1000)}ms로 맞췄어요. 박자 따라 하기에 이 값이 적용돼요.`;
    if (spread > 0.05) msg += ' 누른 박자가 조금 고르지 않았어요. 한 번 더 하면 더 정확해져요.';
    $('#calib-result').textContent = msg;
  }

  function setupRhythm() {
    const pad = $('#tap-pad');
    pad.addEventListener('pointerdown', (e) => { e.preventDefault(); onTap(); });
    const cp = $('#calib-pad');
    cp.addEventListener('pointerdown', (e) => { e.preventDefault(); onCalibTap(); });
    $('#calib-start').addEventListener('click', startCalib);
    $('#calib-back').addEventListener('click', () => { stopRhythm(); calib = null; renderMenu(); show('#screen-menu'); });
  }

  // ---------- 화면 ----------
  const $ = (s) => document.querySelector(s);

  function show(id) {
    for (const s of ['#screen-menu', '#screen-game', '#screen-summary', '#screen-calib']) $(s).hidden = s !== id;
    window.scrollTo(0, 0);
    if (viz) viz.resize();
  }

  function renderMenu() {
    const box = $('#game-list');
    box.innerHTML = '';
    GAMES.forEach((g, gi) => {
      const sec = document.createElement('section');
      sec.className = 'game-block';
      sec.innerHTML = `<h2>${GAME_ICONS[g.id]} ${g.title}</h2><p class="muted small">${g.desc}</p>`;
      if (g.id === 'rhythm') {
        const cb = document.createElement('button');
        cb.className = 'stage-btn calib-btn';
        const lat = progress.latency;
        cb.innerHTML = '<span class="stage-num">⏱</span><span class="stage-text"><span class="stage-title">이어폰 지연 맞추기</span>' +
          `<span class="stage-meta">${lat == null ? '처음 한 번, 이어폰을 바꾸면 다시 해 주세요' : `지금 보정값 ${(lat).toFixed(2)}초 · 이어폰을 바꾸면 다시`}</span></span>`;
        cb.addEventListener('click', openCalib);
        sec.appendChild(cb);
      }
      const ul = document.createElement('ul');
      ul.className = 'stages';
      const pg = progress.games[g.id];
      g.stages.forEach((s) => {
        const locked = s.id > pg.unlocked;
        const best = pg.best[s.id];
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.className = 'stage-btn' + (locked ? ' locked' : '');
        b.disabled = locked;
        b.innerHTML =
          `<span class="stage-num">${locked ? '🔒' : s.id}</span>` +
          `<span class="stage-text"><span class="stage-title">${s.title}</span>` +
          `<span class="stage-meta">${s.desc}${best != null ? ` · 최고 ${best}/${ROUND_LEN}` : ''}</span></span>`;
        b.addEventListener('click', () => startStage(g, s));
        li.appendChild(b);
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      box.appendChild(sec);
    });
  }

  function startStage(g, s) {
    ensureAudio(); // 사용자 터치 안에서 오디오를 깨워야 아이폰에서 소리가 난다
    game = g;
    stage = s;
    qIndex = 0;
    score = 0;
    lastKey = '';
    $('#game-name').textContent = game.title;
    $('#stage-title').textContent = `${s.id}단계 · ${s.title}`;
    const isQuality = s.kind === 'quality', isRhythm = s.kind === 'rhythm', isSing = s.kind === 'sing';
    $('#keyboard').hidden = isQuality || isRhythm || isSing;
    $('#slots').hidden = isQuality || isRhythm || isSing;
    $('#choices').hidden = !isQuality;
    $('#tap-pad').hidden = !isRhythm;
    $('#sing-box').hidden = !isSing;
    $('#btn-ref').hidden = s.ref === false;
    $('#btn-ref').textContent = isSing ? '🔔 기준음 듣기' : '🔔 기준음 도';
    $('#btn-replay').textContent = isRhythm ? '🔁 처음부터 다시' : isSing ? '🎹 정답 음 듣기' : '🔁 다시 듣기';
    buildKeyboard();
    show('#screen-game');
    nextQuestion();
  }

  function questionHint() {
    if (q.kind === 'sing') return '🎧 이어폰을 권해요. 기준음이 끝나면 목표 음을 "아—" 하고 길게 불러 주세요. 편한 옥타브로 불러도 돼요(남성 파트는 한 옥타브 낮게).';
    if (q.kind === 'rhythm') return `♩=${stage.bpm} · 예비박 4번 → 리듬 듣기 → 이어지는 메트로놈에 맞춰 버튼으로 따라 치기`;
    if (q.kind === 'quality') return '화음이 어떤 소리로 들리나요? 확인 전까지는 다른 보기를 눌러 바꿀 수 있어요.';
    if (q.kind === 'voice') return `화음 속 ${VOICES[stage.voice].label}을 건반에서 고르세요. 확인 전까지는 바꿀 수 있어요.`;
    return stage.count > 1
      ? `들은 순서대로 ${stage.count}개 음을 누르세요. 다 고른 뒤 다른 건반을 누르면 마지막 음이 바뀌어요.`
      : '들은 음을 누르세요. 확인 전까지는 다른 건반을 눌러 바꿀 수 있어요.';
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
    const auto = q.kind === 'rhythm' || q.kind === 'sing'; // 박자·부르기는 끝나면 자동 채점
    $('#btn-check').hidden = auto;
    $('#btn-undo').hidden = auto || q.kind === 'quality';
    $('#btn-replay').hidden = q.kind === 'sing';
    $('#key-hint').textContent = questionHint();
    if (q.kind === 'sing') {
      renderSingTarget();
      const sb = $('#btn-sing');
      sb.hidden = false;
      sb.disabled = false;
      sb.textContent = mic ? '🎤 다시 시작' : '🎤 시작 (마이크 켜기)';
      singStatus(mic ? '' : '시작을 누르면 마이크를 켜고 기준음을 들려줘요. 처음 한 번 마이크 "허용"을 눌러 주세요.');
    }
    renderAnswer();
    playQuestion();
  }

  function renderAnswer() {
    if (q.kind === 'rhythm' || q.kind === 'sing') return;
    if (q.kind === 'quality') renderChoices();
    else renderSlots();
    $('#btn-check').disabled = answer.length < stage.count;
    $('#btn-undo').disabled = answer.length === 0;
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
    renderKeyMarks();
  }

  // 화음 종류 보기 버튼
  function renderChoices() {
    const box = $('#choices');
    box.innerHTML = '';
    stage.types.forEach((t) => {
      const b = document.createElement('button');
      b.className = 'choice';
      b.innerHTML = `<span class="choice-name">${CHORDS[t].name}</span><span class="choice-feel">${CHORDS[t].feel}</span>`;
      if (!graded && answer[0] === t) b.classList.add('selected');
      if (graded) {
        if (t === q.quality) b.classList.add('good');
        else if (answer[0] === t) b.classList.add('bad');
      }
      b.addEventListener('click', () => onChoice(t));
      box.appendChild(b);
    });
  }

  function onChoice(t) {
    if (graded) { // 채점 후에는 같은 바닥음으로 그 화음을 들려줘서 비교
      ensureAudio();
      const root = q.chord[0];
      chordTone(CHORDS[t].iv.map((i) => root + i), ctx.currentTime + 0.02, 1.2);
      return;
    }
    answer = [t];
    renderAnswer();
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
    renderAnswer();
  }

  function undo() {
    if (graded) return;
    answer.pop();
    renderAnswer();
  }

  function check() {
    if (q.kind === 'rhythm' || q.kind === 'sing' || graded || answer.length < stage.count) return;
    graded = true;
    const ok = q.kind === 'quality' ? answer[0] === q.quality : q.notes.every((m, i) => answer[i] === m);
    if (ok) score++;
    sfx(ok);
    $('#progress').textContent = `${qIndex} / ${ROUND_LEN} · 맞힘 ${score}`;
    const fb = $('#feedback');
    fb.className = 'feedback ' + (ok ? 'good' : 'bad');
    if (q.kind === 'quality') {
      const c = CHORDS[q.quality];
      fb.textContent = ok ? `정답이에요! ${c.name} (${c.feel})` : `정답: ${c.name} (${c.feel})`;
    } else if (q.kind === 'voice') {
      const chordText = `${q.chord.map(noteName).join('·')} ${CHORDS[q.quality].name}`;
      fb.textContent = ok ? `정답이에요! (${chordText})` : `정답: ${noteName(q.target)} (${chordText})`;
    } else {
      fb.textContent = ok ? '정답이에요!' : `정답: ${q.notes.map(noteName).join(' – ')}`;
    }
    $('#btn-check').hidden = true;
    $('#btn-undo').hidden = true;
    $('#btn-next').hidden = false;
    $('#btn-next').textContent = qIndex >= ROUND_LEN ? '결과 보기' : '다음 문제';
    $('#key-hint').textContent = q.kind === 'quality'
      ? '보기를 누르면 같은 바닥음으로 그 화음을 들려줘요. 비교해 보세요.'
      : '이제 건반을 눌러 소리를 비교해 볼 수 있어요.';
    renderAnswer();
    $('#btn-next').focus();
  }

  function finishRound() {
    const passed = score >= PASS;
    const pg = gp();
    pg.best[stage.id] = Math.max(pg.best[stage.id] || 0, score);
    const last = game.stages.length;
    let unlockedNow = false;
    if (passed && stage.id === pg.unlocked && stage.id < last) {
      pg.unlocked = stage.id + 1;
      unlockedNow = true;
    }
    saveProgress();

    $('#sum-stage').textContent = `${game.title} ${stage.id}단계 · ${stage.title}`;
    $('#sum-score').textContent = `${score} / ${ROUND_LEN}`;
    let msg;
    if (passed && stage.id === last) msg = '마지막 단계까지 통과했어요! 대단해요.';
    else if (passed) msg = unlockedNow ? `통과! ${stage.id + 1}단계가 열렸어요.` : '통과했어요!';
    else msg = `${PASS}개 이상 맞히면 다음 단계가 열려요. 다시 도전해 보세요.`;
    $('#sum-msg').textContent = msg;
    const next = game.stages[stage.id];
    $('#sum-next').hidden = !(next && next.id <= pg.unlocked);
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

    const hOf = () => (stage.kind === 'rhythm' ? 190 : stage.kind === 'sing' ? 240 : stage.black ? 260 : 210); // 반음 단계는 줄이 많아서 더 높게
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
        if (q.kind === 'rhythm') return drawRhythm(p, colors);
        if (q.kind === 'sing') return drawSing(p, colors);
        const W = p.width, H = p.height;
        const left = 44, right = 12, top = 16, bottom = 36;
        const rows = HIGH - LOW;
        const rowH = (H - top - bottom) / rows;
        const yOf = (m) => top + (HIGH - m) * rowH;
        const hasRef = stage.ref !== false;
        const off = hasRef ? 1 : 0;
        const nQ = q.kind === 'seq' ? stage.count : 1;
        const colW = (W - left - right) / (nQ + off);
        const xOf = (c) => left + colW * (c + 0.5);
        const now = ctx ? ctx.currentTime : 0;
        const isOn = (kind, idx) => timeline.some((e) => e.kind === kind && (idx == null || e.idx === idx) && now >= e.start && now <= e.end);

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
        if (hasRef) p.text('기준', xOf(0), H - 12);
        if (q.kind === 'seq') for (let i = 0; i < stage.count; i++) p.text(String(i + 1), xOf(i + 1), H - 12);
        else p.text('화음', xOf(off), H - 12);

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
        const mystery = (x, on) => { // 정답은 숨긴 채 "?" 표시, 울리는 동안 반짝임
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
        };

        if (hasRef) block(xOf(0), yOf(REF), colors.accent, isOn('ref'));

        if (q.kind === 'seq') {
          // 정답 공개 후: 음의 흐름을 선으로 이음
          if (graded) {
            p.stroke(colors.good);
            p.strokeWeight(1.5);
            p.drawingContext.setLineDash([4, 4]);
            let px = xOf(0), py = yOf(REF);
            q.notes.forEach((m, i) => { p.line(px, py, xOf(i + 1), yOf(m)); px = xOf(i + 1); py = yOf(m); });
            p.drawingContext.setLineDash([]);
          }
          q.notes.forEach((m, i) => {
            const x = xOf(i + 1);
            const a = answer[i];
            if (graded) {
              if (a != null && a !== m) ring(x, yOf(a), colors.bad);
              block(x, yOf(m), colors.good, isOn('q', i));
            } else {
              if (a != null) ring(x, yOf(a), colors.accent);
              mystery(x, isOn('q', i));
            }
          });
          return;
        }

        // 화음: 채점 후 세 음을 쌓아서 보여 줌
        const x = xOf(off);
        if (!graded) {
          if (q.kind === 'voice' && answer[0] != null) ring(x, yOf(answer[0]), colors.accent);
          mystery(x, isOn('chord'));
          return;
        }
        const on = isOn('chord');
        q.chord.forEach((m) => {
          const isTarget = q.kind === 'voice' && m === q.target;
          block(x, yOf(m), isTarget ? colors.good : colors.accent, on);
        });
        if (q.kind === 'voice' && answer[0] !== q.target) ring(x, yOf(answer[0]), colors.bad);
        // 화음 이름
        p.noStroke();
        p.fill(colors.ink);
        p.textAlign(p.LEFT, p.CENTER);
        p.textSize(13);
        const lx = x + bw / 2 + 10;
        p.text(CHORDS[q.quality].name, lx, yOf(q.chord[1]));
        p.textSize(11);
      };
    });
  }

  // ---------- 연결 ----------
  function init() {
    renderMenu();
    $('#btn-ref').addEventListener('click', playRef);
    $('#btn-replay').addEventListener('click', () => (q.kind === 'sing' ? playSingAnswer() : playQuestion()));
    $('#btn-undo').addEventListener('click', undo);
    $('#btn-check').addEventListener('click', check);
    $('#btn-next').addEventListener('click', () => { ensureAudio(); nextQuestion(); });
    $('#btn-menu').addEventListener('click', () => { stopRhythm(); stopMic(); renderMenu(); show('#screen-menu'); });
    $('#btn-sing').addEventListener('click', beginSing);
    renderSfxButton();
    $('#btn-sfx').addEventListener('click', () => {
      progress.sfx = !progress.sfx;
      saveProgress();
      renderSfxButton();
      if (progress.sfx) sfx(true); // 켜면 미리 들려줌
    });
    $('#sum-retry').addEventListener('click', () => startStage(game, stage));
    $('#sum-next').addEventListener('click', () => startStage(game, game.stages[stage.id]));
    $('#sum-menu').addEventListener('click', () => { stopMic(); show('#screen-menu'); });
    $('#btn-reset').addEventListener('click', () => {
      if (!confirm('모든 게임의 단계 진행 기록을 지울까요?')) return;
      progress = { games: freshGames(), sfx: progress.sfx, latency: progress.latency };
      saveProgress();
      renderMenu();
    });

    // 컴퓨터 키보드: Enter=확인/다음, Backspace=지우기, R=다시 듣기
    document.addEventListener('keydown', (e) => {
      if ($('#screen-game').hidden) return;
      if (e.target && e.target.classList && (e.target.classList.contains('key') || e.target.classList.contains('choice'))) return;
      if (e.key === 'Enter') { e.preventDefault(); graded ? $('#btn-next').click() : check(); }
      else if (e.key === 'Backspace') { e.preventDefault(); undo(); }
      else if (e.key === 'r' || e.key === 'R') { if (!$('#btn-replay').disabled && !$('#btn-replay').hidden) $('#btn-replay').click(); }
      else if (e.key === ' ' && q.kind === 'rhythm') { e.preventDefault(); onTap(); }
    });

    setupRhythm();
    startViz();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
