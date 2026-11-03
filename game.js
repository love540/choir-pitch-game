/* 합창단 청음 연습
 * 1) 기준음 청음: 기준음 도(C4)를 들려준 뒤 문제 음을 들려주고, 건반으로 맞힌다.
 * 4) 화음 청음: 3화음의 장·단(감·증)을 구별하고, 화음 속 베이스·소프라노·가운데 음을 찾는다.
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
  GAMES[1].stages.forEach((s) => { s.count = 1; s.black = true; });
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
      return { games, sfx: d.sfx !== false };
    } catch (e) {
      return { games: freshGames(), sfx: true };
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
    tone(REF, t, 1.0);
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

  const makeQuestion = () => (stage.kind === 'seq' ? makeSeqQuestion() : makeChordQuestion());

  // ---------- 화면 ----------
  const $ = (s) => document.querySelector(s);

  function show(id) {
    for (const s of ['#screen-menu', '#screen-game', '#screen-summary']) $(s).hidden = s !== id;
    window.scrollTo(0, 0);
    if (viz) viz.resize();
  }

  function renderMenu() {
    const box = $('#game-list');
    box.innerHTML = '';
    GAMES.forEach((g, gi) => {
      const sec = document.createElement('section');
      sec.className = 'game-block';
      sec.innerHTML = `<h2>${gi === 0 ? '🎯' : '🎶'} ${g.title}</h2><p class="muted small">${g.desc}</p>`;
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
    const isQuality = s.kind === 'quality';
    $('#keyboard').hidden = isQuality;
    $('#slots').hidden = isQuality;
    $('#choices').hidden = !isQuality;
    $('#btn-ref').hidden = s.ref === false;
    buildKeyboard();
    show('#screen-game');
    nextQuestion();
  }

  function questionHint() {
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
    $('#btn-check').hidden = false;
    $('#btn-undo').hidden = q.kind === 'quality';
    $('#key-hint').textContent = questionHint();
    renderAnswer();
    playQuestion();
  }

  function renderAnswer() {
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
    if (graded || answer.length < stage.count) return;
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
    $('#btn-replay').addEventListener('click', playQuestion);
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
    $('#sum-retry').addEventListener('click', () => startStage(game, stage));
    $('#sum-next').addEventListener('click', () => startStage(game, game.stages[stage.id]));
    $('#sum-menu').addEventListener('click', () => show('#screen-menu'));
    $('#btn-reset').addEventListener('click', () => {
      if (!confirm('모든 게임의 단계 진행 기록을 지울까요?')) return;
      progress = { games: freshGames(), sfx: progress.sfx };
      saveProgress();
      renderMenu();
    });

    // 컴퓨터 키보드: Enter=확인/다음, Backspace=지우기, R=다시 듣기
    document.addEventListener('keydown', (e) => {
      if ($('#screen-game').hidden) return;
      if (e.target && e.target.classList && (e.target.classList.contains('key') || e.target.classList.contains('choice'))) return;
      if (e.key === 'Enter') { e.preventDefault(); graded ? $('#btn-next').click() : check(); }
      else if (e.key === 'Backspace') { e.preventDefault(); undo(); }
      else if (e.key === 'r' || e.key === 'R') { if (!$('#btn-replay').disabled) playQuestion(); }
    });

    startViz();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
