/* 합창단 청음 연습
 * 1) 기준음 청음: 기준음 도(C4)를 들려준 뒤 문제 음을 들려주고, 건반으로 맞힌다.
 * 4) 화음 청음: 3화음의 장·단(감·증)을 구별하고, 화음 속 베이스·소프라노·가운데 음을 찾는다.
 * 3) 박자 따라 하기: 들려준 리듬을 메트로놈에 맞춰 버튼으로 따라 친다. 이어폰 지연을 재서 보정한다.
 * 6) 첫 음 잡기: 기준음만 듣고 목표 음을 부르면 마이크로 음정을 잰다(녹음은 저장하지 않음).
 * - 피아노 소리는 그랜드 피아노 녹음(Salamander Grand Piano V3, CC BY 3.0)을 쓰고, 준비되기 전에는 합성음으로 낸다.
 *   효과음·메트로놈은 Web Audio로 직접 합성한다.
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
      id: 'chord', title: '화음 청음', desc: '세 음이 함께 울리는 화음을 듣고 밝기를 구별하거나, 화음 속 한 음을 찾고 불러 봐요.',
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
  // 리듬 조각: len=박 수, on=16분음표 단위 소리 위치, ev=악보용 [길이(16분음표 단위), 쉼표면 'r']
  const CELLS = {
    q: { len: 1, on: [0] , ev: [[4]] },            // ♩
    h: { len: 2, on: [0] , ev: [[8]] },            // 𝅗𝅥
    r: { len: 1, on: [] , ev: [[4, 'r']] },             // 4분쉼표
    ee: { len: 1, on: [0, 2] , ev: [[2], [2]] },        // ♪♪
    re: { len: 1, on: [2] , ev: [[2, 'r'], [2]] },           // 8분쉼표 + ♪
    dq: { len: 2, on: [0, 6] , ev: [[6], [2]] },        // 점4분 + 8분
    s4: { len: 1, on: [0, 1, 2, 3] , ev: [[1], [1], [1], [1]] },  // 16분 넷
    s3a: { len: 1, on: [0, 2, 3] , ev: [[2], [1], [1]] },    // 8분 + 16분 둘
    s3b: { len: 1, on: [0, 1, 2] , ev: [[1], [1], [2]] },    // 16분 둘 + 8분
    syn: { len: 2, on: [0, 2, 6] , ev: [[2], [4], [2]] },    // ♪♩♪ 당김음
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
  // 화음 속 한 음 부르기 (마이크): 화음만 듣고, 고른 성부의 음을 불러요
  GAMES[1].stages.push(
    { id: 7, kind: 'sing', chordSing: true, voice: 'bass', title: '🎤 베이스 음 부르기', desc: '화음만 듣고 가장 낮은 음을 불러요 · ±50센트', types: ['maj', 'min'], inv: false, tol: 50, count: 0, black: false },
    { id: 8, kind: 'sing', chordSing: true, voice: 'top', title: '🎤 소프라노 음 부르기', desc: '화음만 듣고 가장 높은 음을 불러요 · ±50센트', types: ['maj', 'min'], inv: false, tol: 50, count: 0, black: false },
    { id: 9, kind: 'sing', chordSing: true, voice: 'mid', title: '🎤 가운데 음 부르기', desc: '자리바꿈 화음에서 알토처럼 가운데 음 · ±50센트', types: ['maj', 'min'], inv: true, tol: 50, count: 0, black: false },
  );
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
      wave = makeWave(ctx);
      loadPiano();
    }
    if (ctx.state !== 'running') ctx.resume();
  }

  // 피아노 녹음을 못 불러왔을 때 쓰는 합성음: 피아노에 가까운 배음 구성
  const HARMONICS = [0, 1, 0.55, 0.32, 0.2, 0.13, 0.08, 0.05, 0.03];
  const makeWave = (ac) => ac.createPeriodicWave(new Float32Array(HARMONICS.length), new Float32Array(HARMONICS));

  // ---------- 그랜드 피아노 소리 ----------
  // audio/piano-data.js 에 3반음 간격으로 녹음 10개(낮은 도~높은 레♯)가 들어 있다.
  // 사이 음은 가장 가까운 녹음을 조금 빠르게/느리게 재생해서 낸다(최대 ±1반음).
  let piano = null; // Map: 녹음된 음 번호 → { buf, start, gain }
  function loadPiano() {
    const src = window.PIANO_SAMPLES;
    if (!src || piano) return;
    piano = new Map(); // 하나씩 준비되는 대로 씀
    Object.entries(src).forEach(([m, b64]) => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      // 옛 사파리는 decodeAudioData가 Promise를 돌려주지 않아 콜백 방식으로
      ctx.decodeAudioData(bytes.buffer, (buf) => {
        const d = buf.getChannelData(0);
        let peak = 0;
        for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
        let first = 0; // mp3 앞의 짧은 무음 건너뛰기
        while (first < d.length && Math.abs(d[first]) < peak * 0.05) first++;
        // 실제 녹음은 건반마다 조율이 조금씩 다름(높은 음은 조금 높게 조율됨) → 음높이를 재서 재생 속도로 바로잡음.
        // 높은 음은 소리가 빨리 줄어 늦게 재면 안 잡히므로, 시작 직후 여러 구간에서 재서 가운데 값을 씀.
        const want = 440 * Math.pow(2, (Number(m) - 69) / 12);
        const cs = [];
        [0.06, 0.09, 0.12, 0.15, 0.2, 0.25, 0.3].forEach((sec) => {
          const at = first + Math.floor(buf.sampleRate * sec);
          if (at + 2048 > d.length) return;
          const r = detectPitch(d.subarray(at, at + 2048), buf.sampleRate);
          if (r) cs.push(1200 * Math.log2(r.freq / want));
        });
        cs.sort((a, b) => a - b);
        const c = cs.length ? cs[Math.floor(cs.length / 2)] : 0;
        const tune = Math.abs(c) < 40 ? Math.pow(2, -c / 1200) : 1; // 엉뚱하게 재졌으면 보정하지 않음
        piano.set(Number(m), { buf, start: Math.max(0, first - 32) / buf.sampleRate, gain: 0.9 / (peak || 1), tune, cents: c });
      }, () => { /* 실패하면 합성음 */ });
    });
  }
  function pianoSample(midi) {
    if (!piano || !piano.size) return null;
    let best = null, dist = 99;
    piano.forEach((v, m) => { const d = Math.abs(m - midi); if (d < dist) { dist = d; best = [m, v]; } });
    return dist <= 4 ? best : null;
  }

  function tone(midi, t, dur, vol = 0.45) {
    const smp = pianoSample(midi);
    if (smp) { // 그랜드 피아노 녹음
      const [m, p] = smp;
      const src = ctx.createBufferSource();
      src.buffer = p.buf;
      src.playbackRate.value = Math.pow(2, (midi - m) / 12) * p.tune;
      const g = ctx.createGain();
      const level = vol * p.gain;
      g.gain.setValueAtTime(level, t);
      g.gain.setValueAtTime(level, t + dur);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35); // 건반에서 손을 떼면 줄어듦
      src.connect(g); g.connect(master);
      src.start(t, p.start);
      src.stop(t + dur + 0.4);
      return;
    }
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
    if (q.chordSing) chordTone(q.chord, t, 1.0); else tone(q.kind === 'sing' ? q.ref : REF, t, 1.0);
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
      const inv = stage.kind === 'voice' || stage.inv ? Math.floor(Math.random() * 3) : 0;
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
    if (stage.chordSing) return { kind: 'sing', chordSing: true, chord, quality: type, target, notes: [target], frames: [], sung: null, state: 'idle' };
    return { kind: 'voice', chord, quality: type, target, notes: [target] };
  }

  // 리듬: 마디 안에 리듬 조각을 채운다. 새로 배우는 조각(focus)이 꼭 하나는 들어가게.
  function makeRhythmQuestion() {
    const total = 4 * stage.bars;
    let onsets, events, key;
    for (;;) {
      onsets = [];
      events = [];
      const used = [];
      let beat = 0;
      while (beat < total) {
        const left = 4 - (beat % 4); // 마디선을 넘지 않게
        const fits = stage.cells.filter((c) => CELLS[c].len <= left);
        const c = pick(fits);
        if (beat === 0 && CELLS[c].on[0] !== 0 && stage.id <= 2) continue;
        CELLS[c].on.forEach((o) => onsets.push(beat * 4 + o));
        let pos = beat * 4;
        CELLS[c].ev.forEach(([dur, r]) => { events.push({ pos, dur, rest: r === 'r' }); pos += dur; });
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
    return { kind: 'rhythm', onsets, events, total16: total * 4, bpm: stage.bpm, taps: [], result: null };
  }

  const makeQuestion = () => (stage.kind === 'seq' ? makeSeqQuestion()
    : stage.kind === 'rhythm' ? makeRhythmQuestion()
    : stage.kind === 'sing' && !stage.chordSing ? makeSingQuestion() : makeChordQuestion());

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
  window.ChoirPitch = { detect: detectPitch, question: () => q }; // 테스트용
  // 테스트·미리 듣기용: 피아노(또는 합성음)로 낸 소리를 파일로 만들 때 씀
  window.ChoirAudio = {
    pianoReady: () => (piano ? piano.size : 0),
    pianoTuning: () => (piano ? [...piano].map(([m, p]) => [m, Math.round(p.cents * 10) / 10]) : []),
    tone: (...a) => tone(...a),
    chord: (...a) => chordTone(...a),
    async render(seconds, play, { synth = false } = {}) {
      const off = new OfflineAudioContext(2, Math.ceil(44100 * seconds), 44100);
      const comp = off.createDynamicsCompressor(), m = off.createGain();
      m.gain.value = 0.8; m.connect(comp); comp.connect(off.destination);
      const saved = [ctx, master, wave, piano];
      ctx = off; master = m; wave = makeWave(off); if (synth) piano = null;
      try { play(0.05); } finally { [ctx, master, wave, piano] = saved; }
      return off.startRendering();
    },
  };

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
    if (q.chordSing) {
      $('#sing-ref').textContent = '화음 속에서';
      $('#sing-note').textContent = { bass: '베이스', top: '소프라노', mid: '가운데 음' }[stage.voice];
      $('#sing-interval').textContent = graded ? `${q.chord.map(noteName).join('·')} ${CHORDS[q.quality].name} → ${NAMES[q.target % 12]}` : VOICES[stage.voice].label;
      return;
    }
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
    const t = ctx.currentTime + 0.1;
    let dur = 1.2;
    if (q.chordSing) { // 화음: 2초 동안 울림
      singStatus(`👂 화음을 들어 보세요. ${VOICES[stage.voice].label}을 찾아요`);
      dur = 2.0;
      chordTone(q.chord, t, dur);
    } else {
      singStatus('👂 기준음을 들어 보세요');
      tone(q.ref, t, dur);
    }
    timeline = [{ start: t, end: t + dur, kind: 'ref' }];
    const wait = (t - ctx.currentTime) + dur + 0.55 + (stage.delay || 0); // 소리 여운이 마이크에 섞이지 않게 조금 쉬고
    if (stage.delay) singTimers.push(setTimeout(() => singStatus(`🤫 ${stage.delay}초 동안 속으로 음을 떠올려 보세요`), (wait - stage.delay) * 1000));
    singTimers.push(setTimeout(startListening, wait * 1000));
  }

  function startListening() {
    singStatus(q.chordSing ? `🎤 지금 ${VOICES[stage.voice].label}을 불러 보세요 (아— 하고 길게)` : `🎤 지금 "${NAMES[q.target % 12]}"를 불러 보세요 (아— 하고 길게)`, 'live');
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
    else {
      // 화음의 다른 음을 불렀으면 알려 줌
      const other = q.chordSing && q.chord.find((m) => m !== q.target && Math.abs(fold(centsOf(f, midiFreq(m)))) <= 50);
      const voiceOf = (m) => ['가장 낮은 음', '가운데 음', '가장 높은 음'][q.chord.indexOf(m)];
      fb.textContent = other
        ? `화음의 ${voiceOf(other)}(${NAMES[other % 12]})을 불렀어요. 찾을 음은 ${NAMES[q.target % 12]}${when}`
        : `"${NAMES[sungMidi % 12]}"에 가까웠어요. 목표보다 ${sign}${c}센트 ${c > 0 ? '높아요' : '낮아요'}${when}`;
    }
    if (q.chordSing) renderSingTarget(); // 채점 후 화음과 정답 음 공개
    singStatus(q.chordSing ? '🎹 "정답 음 듣기"로 화음과 찾을 음을 이어서 들어 볼 수 있어요.' : '🎹 "정답 음 듣기"로 기준음과 목표 음을 이어서 들어 볼 수 있어요.');
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
    if (q.chordSing) chordTone(q.chord, t, 0.9); else tone(q.ref, t, 0.9);
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
      p.text(q.chordSing && !graded ? (k === 0 ? '목표' : '') : NAMES[(((q.target + k) % 12) + 12) % 12], left - 6, y);
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
    cancelAnimationFrame(padRaf);
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

  // 큰 버튼 = 박자 안내판: 지금 단계(예비박/듣기/따라 치기)와 박 번호 1·2·3·4를 메트로놈에 맞춰 보여 줌
  function padState(state, opts = {}) {
    const pad = $('#tap-pad');
    pad.classList.remove('idle', 'count', 'listen', 'play', 'done');
    pad.classList.add(state);
    const phase = { idle: '▶ 위의 "시작하기"를 누르세요', count: '예비박', listen: '👂 듣기 · 아직 누르지 마세요', play: '👆 지금 이 버튼을 누르세요!', done: '채점 끝' }[state];
    const sub = opts.sub || { idle: '예비박 4번 → 리듬 듣기 → 이 버튼으로 같은 리듬 치기', count: '곧 리듬이 나와요', listen: '리듬을 기억하세요. 끝나면 이 버튼을 누를 차례예요', play: '들은 리듬을 메트로놈에 맞춰 손가락으로 톡톡', done: '"다시 해 보기"로 연습하거나 "다음 문제"로 넘어가요' }[state];
    // 안의 요소를 새로 만들지 않고 글자와 표시만 바꾼다.
    // (박에 맞춰 누르는 순간 요소를 다시 만들면 아이폰 사파리에서 그 누름이 버튼에 전달되지 않음)
    if (!pad.querySelector('.pad-beats')) {
      pad.innerHTML = '<span class="pad-phase"></span><span class="pad-beats"><i>1</i><i>2</i><i>3</i><i>4</i></span><span class="pad-sub"></span>';
    }
    pad.querySelector('.pad-phase').textContent = phase;
    pad.querySelector('.pad-sub').textContent = sub;
    pad.querySelectorAll('.pad-beats i').forEach((el, i) => el.classList.toggle('on', i === opts.beat));
  }

  let padRaf = 0, padKey = '';
  function padLoop() {
    cancelAnimationFrame(padRaf);
    padKey = '';
    const step = () => {
      if (q.kind !== 'rhythm' || !q.time) return;
      const T = q.time, now = ctx.currentTime - latency(); // 귀에 들리는 순간에 맞춤
      const two = q.total16 > 16;
      let st, beat = -1, sub;
      if (now < T.listen) { st = 'count'; beat = now < T.t0 ? -1 : Math.floor((now - T.t0) / T.spb); }
      else if (now < T.play) {
        st = 'listen';
        const b = Math.floor((now - T.listen) / T.spb);
        beat = b % 4;
        if (two) sub = `${Math.floor(b / 4) + 1}마디째 듣는 중`;
      } else if (now < T.end) {
        st = 'play';
        const b = Math.floor((now - T.play) / T.spb);
        beat = b % 4;
        const n = q.taps.filter((t) => t >= T.play - 0.2).length;
        sub = (two ? `${Math.floor(b / 4) + 1}마디째 · ` : '') + (n ? `👍 ${n}번 눌렀어요` : '들은 리듬을 메트로놈에 맞춰 손가락으로 톡톡');
      } else {
        return; // 따라 치기가 끝나면 채점이 상태를 바꿈
      }
      if (st === 'listen' && q.taps.some((t) => t >= T.listen && t < T.play)) sub = '아직이에요! 듣기가 끝나면 눌러요';
      const key = st + beat + (sub || '');
      if (key !== padKey) { padKey = key; padState(st, { beat, sub }); }
      padRaf = requestAnimationFrame(step);
    };
    padRaf = requestAnimationFrame(step);
  }

  function playRhythm() {
    ensureAudio();
    stopRhythm();
    const spb = 60 / q.bpm, s16 = spb / 4, len = q.total16 * s16, beats = q.total16 / 4;
    const t0 = ctx.currentTime + 0.15;
    const listen = t0 + 4 * spb, play = listen + len, end = play + len;
    if (graded) { q.practice = true; graded = false; $('#feedback').textContent = ''; updateReplayButton(); } // 채점 후 다시: 연습(점수는 첫 시도만)
    q.time = { t0, listen, play, end, spb, s16, len };
    for (let i = 0; i < 4; i++) click(t0 + i * spb, i === 0, 0.35);         // 예비박
    for (let b = 0; b < beats; b++) click(listen + b * spb, b % 4 === 0, 0.1); // 듣기: 메트로놈 작게
    q.onsets.forEach((o) => wood(listen + o * s16));
    const now = ctx.currentTime;
    q.taps = [];
    q.result = null;
    padLoop();
    for (let b = 0; b < beats; b++) click(play + b * spb, b % 4 === 0, 0.3);  // 따라 치기: 메트로놈만
    setBusy(end - now + 0.3);
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
    if (ok && !q.practice) score++;
    sfx(ok);
    updateReplayButton();
    $('#progress').textContent = `${qIndex} / ${ROUND_LEN} · 맞힘 ${score}`;
    const meanD = hit.length ? hit.reduce((a, n) => a + n.d, 0) / hit.length : 0;
    const meanAbs = hit.length ? hit.reduce((a, n) => a + Math.abs(n.d), 0) / hit.length : 0;
    const tend = Math.abs(meanD) < 0.03 ? '' : meanD < 0 ? ' · 조금 서두르는 편이에요' : ' · 조금 늦는 편이에요';
    const fb = $('#feedback');
    fb.className = 'feedback ' + (ok ? 'good' : 'bad');
    const pre = q.practice ? '연습 · ' : '';
    if (!q.taps.length) fb.textContent = `${pre}누른 기록이 없어요. "따라 치기" 차례에 아래 큰 버튼을 눌러 주세요.`;
    else if (ok) fb.textContent = `${pre}정답이에요! 평균 ${Math.round(meanAbs * 1000)}ms 차이${tend}`;
    else fb.textContent = pre + [missed ? `놓친 박 ${missed}개` : '', extras.length ? `남는 탭 ${extras.length}개` : ''].filter(Boolean).join(', ') + tend;
    padState('done');
    $('#btn-next').hidden = false;
    $('#btn-next').textContent = qIndex >= ROUND_LEN ? '결과 보기' : '다음 문제';
    $('#key-hint').textContent = '위 그림: 정답 리듬(음표)과 바로 아래 내가 친 위치. "처음부터 다시"로 리듬을 다시 들을 수 있어요.';
    $('#btn-next').focus();
  }

  // 박자 그림: 처음부터 끝까지 같은 틀(박 번호 · "정답" 줄 · "나" 줄)을 쓴다.
  // 치는 동안: "정답" 줄은 비워 두고(귀로 듣는 연습) 재생 위치만, "나" 줄에는 누른 곳이 바로 찍힘
  // 채점 후: "정답" 줄에 음표가 나타나고, "나" 줄의 점이 정확/어긋남/놓침 색으로 바뀜
  function drawRhythm(p, colors) {
    const W = p.width, H = p.height;
    p.background(colors.bg);

    const T = q.time, total = q.total16;
    const left = 40, right = 16;
    const GAP = total > 16 ? 18 : 0; // 두 마디면 마디선 자리 여백
    const unit = (W - left - right - 26 - GAP) / total; // 끝 마디선 앞에 꼬리 자리를 남김
    const xOf = (u) => left + 8 + u * unit + (u >= 16 ? GAP : 0);
    const numY = 16, staffY = 82, tapY = 134;
    const now = ctx ? ctx.currentTime - latency() : 0;

    // 박 번호와 박 세로선
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(11);
    for (let u = 0; u < total; u += 4) {
      p.noStroke();
      p.fill(colors.muted);
      p.text(String((u / 4) % 4 + 1), xOf(u), numY);
      p.stroke(colors.line);
      p.strokeWeight(1);
      p.drawingContext.setLineDash([2, 4]);
      p.line(xOf(u), numY + 10, xOf(u), tapY + 16);
      p.drawingContext.setLineDash([]);
    }
    // 줄과 마디선
    p.stroke(colors.muted);
    p.strokeWeight(1);
    p.line(xOf(0) - 8, staffY, xOf(total) + 14, staffY);
    const barX = (u) => (u === total ? xOf(u) + 14 : xOf(u) - GAP / 2 - unit / 2);
    for (let u = 16; u <= total; u += 16) { p.strokeWeight(u === total ? 2.5 : 1.5); p.line(barX(u), staffY - 16, barX(u), staffY + 16); }
    p.noStroke();
    p.fill(colors.muted);
    p.textAlign(p.LEFT, p.CENTER);
    p.textSize(11);
    p.text('정답', 4, staffY);
    p.text('나', 4, tapY);

    if (graded) drawNotation(p, colors.ink, xOf, staffY);
    else { // 아직 정답은 숨김
      p.noStroke();
      p.textAlign(p.CENTER, p.BOTTOM);
      const counting = T && now >= T.t0 && now < T.listen;
      p.fill(counting ? colors.accent : colors.muted);
      p.textSize(counting ? 15 : 11);
      const mid = (xOf(0) + xOf(total)) / 2;
      p.text(counting ? `예비박 ${Math.floor((now - T.t0) / T.spb) + 1}` : '귀로 듣고 기억하기 · 음표는 채점 뒤에 보여 줘요', mid, staffY - 12);
    }

    // 치는 동안: 재생 위치와 누른 곳
    if (T && !graded) {
      const head = (start, y) => {
        if (now < start || now > start + T.len) return;
        const x = xOf((now - start) / T.s16);
        p.stroke(colors.accent);
        p.strokeWeight(2.5);
        p.line(x, y - 22, x, y + 22);
      };
      head(T.listen, staffY);
      head(T.play, tapY);
      const lat = latency();
      q.taps.forEach((t) => {
        const u = (t - lat - T.play) / T.s16;
        if (u < -1 || u > total + 1) return;
        p.noStroke();
        p.fill(colors.accent);
        p.circle(xOf(u), tapY, 12);
      });
    }

    // 채점 후: 내가 친 위치
    const R = graded ? q.result : null;
    if (R) {
      const uOf = (t) => (t - T.play) / T.s16;
      R.notes.forEach((n, i) => {
        const xe = xOf(q.onsets[i]);
        if (n.tap == null) { // 놓침: ✕
          p.stroke(colors.bad);
          p.strokeWeight(2.5);
          p.line(xe - 6, tapY - 6, xe + 6, tapY + 6);
          p.line(xe - 6, tapY + 6, xe + 6, tapY - 6);
          return;
        }
        const exact = Math.abs(n.d) <= 0.06;
        const xt = xOf(uOf(n.tap));
        p.noStroke();
        p.fill(exact ? colors.good : colors.warn);
        p.circle(xt, tapY, 14);
        if (!exact) {
          p.textAlign(p.CENTER, p.TOP);
          p.textSize(10);
          p.text(n.d < 0 ? '빠름' : '늦음', xt, tapY + 10);
        }
      });
      R.extras.forEach((t) => {
        p.noStroke();
        p.fill(colors.bad);
        p.circle(xOf(uOf(t)), tapY, 10);
      });
    }

    // 아래: 치기 전에는 진행 안내, 채점 후에는 범례
    if (!graded) {
      const phase = !T ? '▶ 시작하기를 누르면 시작해요'
        : now < T.listen ? '예비박 4번 → 듣기 → 따라 치기'
        : now < T.play ? '👂 듣기: 위 줄 · 아직 누르지 마세요'
        : now < T.end ? '👆 따라 치기: 아래 줄 · 큰 버튼을 누르세요' : '채점 중…';
      p.noStroke();
      p.fill(T && now >= T.play && now < T.end ? colors.accent : colors.muted);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(12);
      p.text(`♩=${q.bpm} · ${phase}`, W / 2, H - 12);
      return;
    }
    const items = [['●', colors.good, '정확'], ['●', colors.warn, '조금 어긋남'], ['✕', colors.bad, '놓침'], ['●', colors.bad, '남는 탭']];
    p.textSize(11);
    p.textAlign(p.LEFT, p.CENTER);
    let lx = left - 30;
    items.forEach(([sym, col, label]) => {
      p.noStroke();
      p.fill(col);
      p.text(sym, lx, H - 12);
      lx += 13;
      p.fill(colors.muted);
      p.text(label, lx, H - 12);
      lx += p.textWidth(label) + 14;
    });
  }

  // 리듬을 음표로 그리기 (머리, 기둥, 꼬리/빔, 점, 쉼표)
  function drawNotation(p, ink, xOf, sy) {
    const ev = q.events;
    const stemH = 30, hx = (e) => xOf(e.pos);
    const isShort = (e) => !e.rest && e.dur < 4;
    // 같은 박 안에서 이어지는 짧은 음끼리 빔으로 묶기
    const groups = [];
    ev.forEach((e, i) => {
      const g = groups[groups.length - 1];
      const prev = ev[i - 1];
      if (isShort(e) && g && prev && isShort(prev) && g.includes(prev) && Math.floor(prev.pos / 4) === Math.floor(e.pos / 4)) g.push(e);
      else if (isShort(e)) groups.push([e]);
    });
    p.stroke(ink);
    p.fill(ink);
    ev.forEach((e) => {
      const x = hx(e);
      if (e.rest) return drawRest(p, ink, x, sy, e.dur);
      // 머리
      p.push();
      p.translate(x, sy);
      p.rotate(-0.35);
      p.strokeWeight(1.5);
      if (e.dur >= 8) { p.noFill(); p.stroke(ink); } else { p.fill(ink); p.noStroke(); }
      p.ellipse(0, 0, 12, 8.5);
      p.pop();
      // 기둥
      p.stroke(ink);
      p.strokeWeight(1.4);
      p.line(x + 5.4, sy - 1.5, x + 5.4, sy - stemH);
      if (e.dur === 6) { p.noStroke(); p.fill(ink); p.circle(x + 11, sy - 2, 3.4); }
    });
    groups.forEach((g) => {
      const top = sy - stemH;
      if (g.length === 1) { // 꼬리
        const e = g[0], x = hx(e) + 5.4;
        p.noFill();
        p.stroke(ink);
        p.strokeWeight(1.8);
        const flags = e.dur === 1 ? 2 : 1;
        for (let k = 0; k < flags; k++) p.bezier(x, top + k * 6, x + 2, top + 8 + k * 6, x + 9, top + 10 + k * 6, x + 6, top + 18 + k * 6);
        return;
      }
      p.noStroke();
      p.fill(ink);
      const x0 = hx(g[0]) + 5.4, x1 = hx(g[g.length - 1]) + 5.4;
      p.rect(x0 - 0.7, top, x1 - x0 + 1.4, 4); // 첫째 빔
      for (let i = 0; i < g.length - 1; i++) { // 16분음표끼리 둘째 빔
        if (g[i].dur === 1 && g[i + 1].dur === 1) {
          const a = hx(g[i]) + 5.4, b = hx(g[i + 1]) + 5.4;
          p.rect(a - 0.7, top + 6, b - a + 1.4, 4);
        }
      }
    });
  }

  function drawRest(p, ink, x, sy, dur) {
    p.stroke(ink);
    p.strokeWeight(2);
    p.noFill();
    if (dur >= 4) { // 4분쉼표: 번개 모양
      p.beginShape();
      p.vertex(x - 2, sy - 13); p.vertex(x + 4, sy - 6); p.vertex(x - 1, sy); p.vertex(x + 4, sy + 6);
      p.endShape();
      p.bezier(x + 4, sy + 6, x - 4, sy + 3, x - 3, sy + 10, x + 1, sy + 13);
    } else { // 8분쉼표: 왼쪽 위 점에서 오른쪽으로 감아 올라갔다가 비스듬히 내려옴
      p.noStroke();
      p.fill(ink);
      p.circle(x, sy - 5, 5.5);
      p.noFill();
      p.stroke(ink);
      p.strokeWeight(1.7);
      p.bezier(x, sy - 2.5, x + 3, sy - 1.5, x + 5.5, sy - 4, x + 6.5, sy - 7);
      p.line(x + 6.5, sy - 7, x + 2, sy + 9);
    }
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
    $('#pad-calib').addEventListener('click', () => { stopRhythm(); openCalib(); });
    $('#calib-back').addEventListener('click', () => { stopRhythm(); calib = null; renderMenu(); show('#screen-menu'); });
  }

  // ---------- 화면 ----------
  const $ = (s) => document.querySelector(s);

  // 단계 목록을 떠날 때 보던 위치를 기억했다가, 돌아오면 그 자리로
  let currentScreen = '#screen-menu';
  let menuScrollY = 0;
  // 단계에 처음 들어오면 바로 소리 내지 않고 '시작하기'를 기다림. 누르면 '다시 듣기'(박자는 '처음부터 다시')로 바뀜
  let roundStarted = false;
  function updateReplayButton() {
    const b = $('#btn-replay');
    b.classList.toggle('primary', !roundStarted);
    b.textContent = !roundStarted ? '▶ 시작하기'
      : stage.kind === 'rhythm' ? (graded ? '🔁 다시 해 보기 (연습)' : '🔁 처음부터 다시')
      : stage.kind === 'sing' ? '🎹 정답 음 듣기' : '🔁 다시 듣기';
  }

  function show(id) {
    if (currentScreen === '#screen-menu' && id !== '#screen-menu') menuScrollY = window.scrollY;
    for (const s of ['#screen-menu', '#screen-game', '#screen-summary', '#screen-calib']) $(s).hidden = s !== id;
    currentScreen = id;
    if (viz) viz.resize();
    window.scrollTo(0, id === '#screen-menu' ? menuScrollY : 0);
  }

  function renderMenu() {
    const box = $('#game-list');
    box.innerHTML = '';
    GAMES.forEach((g, gi) => {
      const sec = document.createElement('section');
      sec.className = 'game-block';
      // 게임 제목+설명은 스크롤할 때 화면 위에 붙어 있다가 다음 게임 제목이 밀어 올림 (sticky header)
      sec.innerHTML = `<div class="game-head"><h2>${GAME_ICONS[g.id]} ${g.title}</h2><p class="muted small">${g.desc}</p></div>`;
      if (g.id === 'rhythm') {
        // 단계가 아니라 시작 전 '사전 설정'이라서 모양을 다르게
        const cb = document.createElement('button');
        const lat = progress.latency;
        cb.className = 'setup-row calib-btn' + (lat == null ? ' needed' : '');
        cb.innerHTML = '<span class="setup-tag">⚙️ 사전 설정</span>' +
          '<span class="setup-main"><span class="setup-title">이어폰 지연 맞추기</span>' +
          `<span class="setup-meta">${lat == null ? '시작 전에 한 번 해 주세요' : '이어폰을 바꾸면 다시 해 주세요'}</span></span>` +
          `<span class="setup-val">${lat == null ? '안 함' : `${Math.round(lat * 1000)}ms`} ›</span>`;
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
    roundStarted = s.kind === 'sing'; // 첫 음 잡기는 자체 시작 버튼이 있음
    lastKey = '';
    $('#game-name').textContent = game.title;
    $('#stage-title').textContent = `${s.id}단계 · ${s.title}`;
    const isQuality = s.kind === 'quality', isRhythm = s.kind === 'rhythm', isSing = s.kind === 'sing';
    $('#keyboard').hidden = isQuality || isRhythm || isSing;
    $('#slots').hidden = isQuality || isRhythm || isSing;
    $('#choices').hidden = !isQuality;
    $('#tap-pad').hidden = !isRhythm;
    $('#pad-calib').hidden = !(isRhythm && progress.latency == null);
    $('#sing-box').hidden = !isSing;
    $('#btn-ref').hidden = s.ref === false;
    $('#btn-ref').textContent = s.chordSing ? '🎶 화음 듣기' : isSing ? '🔔 기준음 듣기' : '🔔 기준음 도';
    updateReplayButton();
    buildKeyboard();
    show('#screen-game');
    nextQuestion();
  }

  function questionHint() {
    if (q.chordSing) return '🎧 이어폰을 권해요. 화음이 끝나면 찾은 음을 "아—" 하고 길게 불러 주세요. 편한 옥타브로 불러도 돼요.';
    if (q.kind === 'sing') return '🎧 이어폰을 권해요. 기준음이 끝나면 목표 음을 "아—" 하고 길게 불러 주세요. 편한 옥타브로 불러도 돼요(남성 파트는 한 옥타브 낮게).';
    if (q.kind === 'rhythm') return `♩=${stage.bpm} · 예비박 4번 → 리듬 듣기 → "👆 지금 이 버튼을 누르세요!"가 나오면 아래 큰 버튼을 리듬대로 누르기` + (progress.latency == null ? ' · 블루투스 이어폰이면 단계 목록의 ⚙️ 이어폰 지연 맞추기를 먼저 해 주세요' : '');
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
    if (roundStarted) updateReplayButton();
    if (q.kind === 'sing') {
      renderSingTarget();
      const sb = $('#btn-sing');
      sb.hidden = false;
      sb.disabled = false;
      sb.textContent = mic ? '🎤 다시 시작' : '🎤 시작 (마이크 켜기)';
      singStatus(mic ? '' : '시작을 누르면 마이크를 켜고 기준음을 들려줘요. 처음 한 번 마이크 "허용"을 눌러 주세요.');
    }
    renderAnswer();
    if (roundStarted) playQuestion();
    else if (q.kind === 'rhythm') padState('idle');
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
        accent: css('--accent'), good: css('--good'), bad: css('--bad'), warn: css('--warn'),
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

  // ---------- 새 버전 자동 반영 ----------
  // 주소는 항상 https://love540.github.io/choir-pitch-game 하나. 배포할 때 APP_VERSION, version.json,
  // html의 ?v= 숫자를 함께 올리면, 열려 있던 페이지도 다음에 열거나 돌아올 때 스스로 새 버전으로 바뀐다.
  const APP_VERSION = 16;
  async function checkForUpdate() {
    if (location.protocol === 'file:') return; // 로컬 버전은 확인하지 않음
    try {
      const r = await fetch('version.json', { cache: 'no-store' });
      const { version } = await r.json();
      if (!(version > APP_VERSION)) return;
      const key = 'choir-pitch-game:reloaded';
      if (sessionStorage.getItem(key) === String(version)) return; // 같은 버전으로 두 번 새로고침하지 않음
      sessionStorage.setItem(key, String(version));
      await fetch(location.pathname, { cache: 'reload' }); // 사파리가 붙잡고 있는 예전 페이지를 새것으로 바꿔 둠
      location.reload();
    } catch (e) { /* 인터넷이 없거나 실패하면 그냥 지금 버전으로 */ }
  }
  function cleanUrl() { // 예전에 받은 ?v=7 같은 링크는 원래 주소로 정리
    try { if (/[?&]v=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* 무시 */ }
  }

  // ---------- 연결 ----------
  function init() {
    cleanUrl();
    checkForUpdate();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForUpdate(); });
    renderMenu();
    $('#btn-ref').addEventListener('click', playRef);
    $('#btn-replay').addEventListener('click', () => {
      if (!roundStarted) { roundStarted = true; updateReplayButton(); }
      if (q.kind === 'sing') playSingAnswer(); else playQuestion();
    });
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
