(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var dev = $('dev'), timer = $('timer'), stage = $('stage'), stageIn = $('stage-in');
  if (!dev || !timer) return;

  var KO = document.documentElement.lang === 'ko';
  var T = KO ? {
    lab: { idle: '\uc2a4\ud398\uc774\uc2a4 \ub204\ub974\uae30', hold: '\ub204\ub974\ub294 \uc911\u2026', ready: '\uc900\ube44 \uc644\ub8cc', running: '', stopped: '\uc644\ub8cc' },
    hint: { idle: 'Space \ub97c \uae38\uac8c \ub204\ub974\uc138\uc694', hold: '\uacc4\uc18d \ub204\ub974\uc138\uc694\u2026', ready: '\ucd08\ub85d\uc0c9 \u2013 \ub5bc\uba74 \uc2dc\uc791', running: 'Space \ub97c \ub20c\ub7ec \uc815\uc9c0', stopped: '\uae30\ub85d \uc800\uc7a5\ub428' },
    none: '\uc544\uc9c1 \uae30\ub85d\uc774 \uc5c6\uc2b5\ub2c8\ub2e4', on: '\ud6a8\uacfc\uc74c \ucf1c\uc9d0', off: '\ud6a8\uacfc\uc74c \uaebc\uc9d0'
  } : {
    lab: { idle: 'HOLD SPACE', hold: 'HOLD\u2026', ready: 'READY', running: '', stopped: 'DONE' },
    hint: { idle: 'Hold Space', hold: 'Keep holding\u2026', ready: 'Green \u2013 release to start', running: 'Press Space to stop', stopped: 'Solve saved' },
    none: 'No solves yet', on: 'Sound on', off: 'Sound off'
  };

  var AD_AFTER = 5;          // 앱 설치 안내를 보여줄 풀이 횟수(페이지 방문당 1회)
  var READY_DELAY = 300;     // 앱 기본 준비 지연(0.3초)

  /* ---------- 효과음(앱과 같은 wav) ---------- */
  var actx = null, bufs = {}, sndOn = true;
  function audioInit() {
    try {
      if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
      actx = new (window.AudioContext || window.webkitAudioContext)();
      ['press', 'ready', 'start', 'stop', 'best'].forEach(function (n) {
        fetch('/cubetimer/audio/' + n + '.wav').then(function (r) { return r.arrayBuffer(); })
          .then(function (b) { return actx.decodeAudioData(b); })
          .then(function (d) { bufs[n] = d; }).catch(function () {});
      });
    } catch (e) { actx = null; }
  }
  function sfx(n) {
    if (!sndOn || !actx || !bufs[n]) return;
    try { var src = actx.createBufferSource(); src.buffer = bufs[n]; src.connect(actx.destination); src.start(0); } catch (e) {}
  }
  window.__cubeAudio = function () { return { state: actx && actx.state, loaded: Object.keys(bufs) }; };

  function ev(name, params) { try { if (window.gtag) window.gtag('event', name, params || {}); } catch (e) {} }

  /* ---------- 화면 맞춤 ---------- */
  function fit() {
    var k = Math.min(1, (window.innerWidth - 32) / 780, (window.innerHeight - 70) / 780);
    k = Math.max(k, 0.5);
    stage.style.height = Math.round(780 * k) + 'px';
    stageIn.style.transform = 'scale(' + k + ')';
  }
  window.addEventListener('resize', fit); fit();

  /* ---------- 스크램블(3x3, 무작위 이동 20수) ---------- */
  var FACES = ['U', 'D', 'L', 'R', 'F', 'B'], AXIS = { U: 0, D: 0, L: 1, R: 1, F: 2, B: 2 };
  function scramble() {
    var out = [], last = '', prev = '';
    while (out.length < 20) {
      var f = FACES[Math.floor(Math.random() * 6)];
      if (f === last) continue;
      if (prev && AXIS[f] === AXIS[last] && AXIS[f] === AXIS[prev]) continue;
      prev = last; last = f;
      out.push(f + ['', "'", '2'][Math.floor(Math.random() * 3)]);
    }
    return out.join(' ');
  }

  /* ---------- 기록·통계 ---------- */
  var solves = [];
  function fmt(ms) {
    var cs = Math.floor(ms / 10), s = Math.floor(cs / 100), c = cs % 100;
    var cc = (c < 10 ? '0' : '') + c;
    if (s >= 60) { var m = Math.floor(s / 60), ss = s % 60; return m + ':' + (ss < 10 ? '0' : '') + ss + '.' + cc; }
    return s + '.' + cc;
  }
  function ao(n) {
    if (solves.length < n) return null;
    var a = solves.slice(-n).slice().sort(function (x, y) { return x - y; });
    var t = Math.ceil(n * 0.05), sum = 0, i;
    a = a.slice(t, a.length - t);
    for (i = 0; i < a.length; i++) sum += a[i];
    return sum / a.length;
  }
  function setT(id, v) { $(id).textContent = v == null ? '–' : fmt(v); }
  function renderStats() {
    var n = solves.length, sum = 0, best = null, i;
    for (i = 0; i < n; i++) { sum += solves[i]; if (best === null || solves[i] < best) best = solves[i]; }
    setT('sBest', best); setT('sMean', n ? sum / n : null);
    $('sN').textContent = n; setT('sA5', ao(5)); setT('sA12', ao(12)); setT('sA100', ao(100));
    $('solveno').textContent = '#' + (n + 1);
    var ol = $('recentlist'), h = '';
    if (!n) h = '<li class="empty">' + T.none + '</li>';
    for (i = n - 1; i >= 0 && i >= n - 8; i--) h += '<li><small>#' + (i + 1) + '</small>' + fmt(solves[i]) + '</li>';
    ol.innerHTML = h;
  }

  /* ---------- 타이머 상태기계 ---------- */
  var view = 'home';         // home | rotating | timer
  var state = 'idle';        // idle | hold | ready | running | stopped
  var holdTimer = 0, t0 = 0, raf = 0, swallowUp = false, adShown = false, adPending = false;
  var LAB = T.lab, HINT = T.hint;

  function setState(s) {
    state = s; timer.setAttribute('data-state', s);
    var labs = timer.querySelectorAll('.plab'), i;
    for (i = 0; i < labs.length; i++) labs[i].textContent = LAB[s];
    $('hint').textContent = HINT[s];
  }
  function showTime(txt) {
    var el = $('time'); el.textContent = txt; el.className = txt.length > 6 ? 'long' : '';
  }
  function newScramble() { $('scramble').textContent = scramble(); }
  function tick() {
    if (state !== 'running') return;
    showTime(fmt(performance.now() - t0));
    raf = requestAnimationFrame(tick);
  }
  function adOpen() { return !$('adwrap').hidden; }

  function down() {
    if (view !== 'timer' || adOpen()) return;
    if (state === 'idle' || state === 'stopped') {
      if (state === 'stopped') return;   // 손을 뗀 뒤 다음 풀이
      sfx('press'); setState('hold'); showTime('0.00');
      holdTimer = setTimeout(function () { if (state === 'hold') { setState('ready'); sfx('ready'); } }, READY_DELAY);
    } else if (state === 'running') {
      var ms = performance.now() - t0;
      cancelAnimationFrame(raf);
      var prevBest = solves.length ? Math.min.apply(null, solves) : null;
      solves.push(ms); swallowUp = true;
      sfx(prevBest !== null && ms < prevBest ? 'best' : 'stop');
      showTime(fmt(ms)); setState('stopped'); renderStats(); newScramble();
      ev('cube_demo_solve', { solve_count: solves.length });
      if (solves.length === AD_AFTER && !adShown) adPending = true;
    }
  }
  function up() {
    if (view !== 'timer') return;
    if (swallowUp) { swallowUp = false; setState('idle'); maybeAd(); return; }
    if (state === 'hold') { clearTimeout(holdTimer); setState('idle'); }
    else if (state === 'ready') { sfx('start'); t0 = performance.now(); setState('running'); raf = requestAnimationFrame(tick); }
  }

  document.addEventListener('keydown', function (e) {
    if (e.code !== 'Space' && e.key !== ' ') return;
    if (view !== 'timer' || adOpen()) return;
    e.preventDefault(); audioInit();
    if (!e.repeat) down();
  });
  document.addEventListener('keyup', function (e) {
    if (e.code !== 'Space' && e.key !== ' ') return;
    if (view !== 'timer' || adOpen()) return;
    e.preventDefault(); up();
  });
  window.addEventListener('blur', function () {
    if (state === 'hold' || state === 'ready') { clearTimeout(holdTimer); setState('idle'); }
  });

  /* ---------- 가로 회전 ---------- */
  var busy = false;
  function openTimer() {
    if (busy || view !== 'home') return; busy = true; view = 'rotating';
    ev('cube_demo_open'); audioInit();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    try { stage.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { }
    dev.classList.add('rot');
    setTimeout(function () {
      dev.classList.add('notrans');
      dev.classList.remove('rot', 'portrait'); dev.classList.add('landscape');
      timer.classList.add('show');
      newScramble(); setState('idle'); showTime('0.00'); renderStats();
      void dev.offsetWidth; dev.classList.remove('notrans');
      view = 'timer'; busy = false;
    }, 1000);
  }
  function closeTimer() {
    if (busy || view !== 'timer' || state === 'running') return; busy = true; view = 'rotating';
    clearTimeout(holdTimer);
    dev.classList.add('notrans');
    timer.classList.remove('show');
    dev.classList.remove('landscape'); dev.classList.add('portrait', 'rot');
    void dev.offsetWidth; dev.classList.remove('notrans');
    requestAnimationFrame(function () { dev.classList.remove('rot'); });
    setTimeout(function () { view = 'home'; busy = false; }, 1000);
  }
  $('start').addEventListener('click', openTimer);
  $('back').addEventListener('click', function () { this.blur(); closeTimer(); });
  $('sndbtn').addEventListener('click', function () {
    this.blur(); sndOn = !sndOn; this.classList.toggle('off', !sndOn);
    this.setAttribute('aria-pressed', sndOn); this.setAttribute('aria-label', sndOn ? T.on : T.off);
    if (sndOn) { audioInit(); sfx('ready'); }
  });
  $('resetbtn').addEventListener('click', function () {
    this.blur(); if (state === 'running') return;
    solves = []; renderStats(); showTime('0.00'); newScramble(); setState('idle');
  });

  /* ---------- 앱 설치 안내(풀이 사이, 닫기 가능) ---------- */
  function maybeAd() {
    if (!adPending || adShown) return;
    if (view === 'timer' && state === 'idle') {
      setTimeout(function () {
        if (state !== 'idle' || adShown) { maybeAd(); return; }
        adShown = true; adPending = false;
        $('adwrap').hidden = false; $('adx').focus();
        ev('cube_demo_ad_shown');
      }, 700);
    } else { setTimeout(maybeAd, 500); }
  }
  function closeAd() {
    if (!adOpen()) return;
    $('adwrap').hidden = true; ev('cube_demo_ad_close');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  $('adx').addEventListener('click', closeAd);
  $('adlater').addEventListener('click', closeAd);
  $('adwrap').addEventListener('click', function (e) { if (e.target === this) closeAd(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAd(); });

  /* ---------- 플레이 버튼 위치별 측정 ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[data-place]') : null;
    if (a) ev('cube_demo_play_click', { place: a.getAttribute('data-place') });
  });

  renderStats();
})();
