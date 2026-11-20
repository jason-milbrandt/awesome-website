/* Hail Defense – an original fixed-shooter about hail.
 * Vanilla JavaScript, no libraries, no network requests, no modules (the site opens from file://).
 * Logical resolution 800 x 600, scaled to fit the page with devicePixelRatio handling.
 * index.html?demo runs an attract mode that plays itself from a fixed seed.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- constants
  var W = 800, H = 600;
  var TAU = Math.PI * 2;
  var GROUND_Y = 560;               // road surface, truck wheels sit here
  var RIDGE_Y = 500;                // ridge the houses stand on
  var CELL = 3, HOUSE_COLS = 24, HOUSE_ROWS = 17;
  var HOUSE_W = HOUSE_COLS * CELL, HOUSE_H = HOUSE_ROWS * CELL;
  var HOUSE_TOP = RIDGE_Y - HOUSE_H;
  var HOUSE_XS = [150, 316, 484, 650];
  var COLS = 10, ROWS = 5, SX = 54, SY = 40, STEP_DOWN = 18, EDGE = 18;
  var PLAYER_SPEED = 270, PULSE_SPEED = 580, FIRE_COOLDOWN = 0.28;
  var MUZZLE_Y = GROUND_Y - 47;
  var PLANE_Y = 64, PLANE_SCALE = 0.8;
  var START_LIVES = 3;
  var TYPES = [
    { key: 'large', name: 'Large hail', points: 40, r: 15, color: '#d8e9fa' },
    { key: 'small', name: 'Small hail', points: 30, r: 11, color: '#bfe0ff' },
    { key: 'graupel', name: 'Graupel', points: 20, r: 12, color: '#e9eef3' },
    { key: 'snow', name: 'Snowflake', points: 10, r: 14, color: '#f2f8ff' }
  ];
  var ROW_TYPES = [0, 1, 2, 3, 3];
  var BONUS_VALUES = [50, 100, 150, 200, 250, 300];
  var HS_KEY = 'hailDefense.highScore';
  var FONT = '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Arial, sans-serif';

  // ---------------------------------------------------------------- page elements
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var statusEl = document.getElementById('game-status');
  var soundBtn = document.getElementById('btn-sound');
  var pauseBtn = document.getElementById('btn-pause');
  var touchPad = document.getElementById('touch-pad');
  var DEMO = /(^\?|&)demo(=|&|$)/.test(window.location.search || '');
  var TOUCH = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) ||
    (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  if (TOUCH) document.documentElement.classList.add('has-touch');

  var errorCount = 0, lastError = '';
  function recordError(msg) {
    errorCount++;
    lastError = String(msg).slice(0, 160);
    if (window.console && console.error) console.error('Hail Defense: ' + lastError);
  }
  window.addEventListener('error', function (e) { recordError(e.message || 'error'); });

  // ---------------------------------------------------------------- random numbers
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rng = mulberry32(DEMO ? 20261120 : ((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0));
  var vrng = mulberry32(DEMO ? 7 : ((Date.now() * 31) >>> 0));   // visual-only randomness
  function rand(a, b) { return a + (b - a) * rng(); }
  function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  // ---------------------------------------------------------------- high score
  function loadHigh() {
    try {
      var v = parseInt(window.localStorage.getItem(HS_KEY), 10);
      return isFinite(v) && v > 0 ? v : 0;
    } catch (e) { return 0; }
  }
  function saveHigh(v) {
    if (DEMO) return;
    try { window.localStorage.setItem(HS_KEY, String(v)); } catch (e) { /* storage unavailable */ }
  }

  // ---------------------------------------------------------------- sound (Web Audio, synthesised)
  var audio = { ctx: null, master: null, noise: null, hum: null, muted: true };
  function ensureAudio() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended' && audio.ctx.resume) audio.ctx.resume();
      return true;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { audio.ctx = new AC(); } catch (e) { return false; }
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.45;
    audio.master.connect(audio.ctx.destination);
    var len = Math.floor(audio.ctx.sampleRate * 0.8);
    var buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    audio.noise = buf;
    return true;
  }
  function canPlay() { return !audio.muted && audio.ctx && audio.ctx.state === 'running'; }
  function tone(type, f0, f1, dur, vol, delay) {
    if (!canPlay()) return;
    var c = audio.ctx, t = c.currentTime + (delay || 0);
    var o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(audio.master);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function noiseBurst(freq, q, dur, vol, type, f1) {
    if (!canPlay()) return;
    var c = audio.ctx, t = c.currentTime;
    var s = c.createBufferSource(); s.buffer = audio.noise;
    var f = c.createBiquadFilter(); f.type = type || 'bandpass';
    f.frequency.setValueAtTime(freq, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = q;
    var g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(audio.master);
    s.start(t); s.stop(t + dur + 0.03);
  }
  var sfx = {
    shoot: function () { tone('sine', 1500, 2900, 0.07, 0.10); },
    hit: function (type) {
      var f = [1300, 1900, 2500, 4200][type];
      noiseBurst(f, 3, 0.14, 0.55);
      tone('triangle', f * 0.5, f * 0.25, 0.08, 0.05);
    },
    house: function () { noiseBurst(600, 1, 0.07, 0.18, 'lowpass'); },
    cancel: function () { noiseBurst(5000, 4, 0.05, 0.2); },
    step: function () { tone('sine', 120, 85, 0.09, 0.10); },
    playerHit: function () { noiseBurst(1400, 0.8, 0.75, 0.6, 'lowpass', 90); tone('sawtooth', 220, 40, 0.6, 0.10); },
    bonus: function () {
      tone('sine', 660, 660, 0.10, 0.11); tone('sine', 880, 880, 0.10, 0.11, 0.09); tone('sine', 1320, 1320, 0.2, 0.11, 0.18);
    },
    wave: function () { [523, 659, 784].forEach(function (f, i) { tone('triangle', f, f, 0.25, 0.09, i * 0.12); }); },
    over: function () { tone('triangle', 392, 196, 0.8, 0.11); }
  };
  function humStart() {
    if (!canPlay() || audio.hum) return;
    var c = audio.ctx;
    var g = c.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.05, c.currentTime, 0.3);
    var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
    var o1 = c.createOscillator(), o2 = c.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'sawtooth';
    o1.frequency.value = 84; o2.frequency.value = 87.5;
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(audio.master);
    o1.start(); o2.start();
    audio.hum = { g: g, o: [o1, o2] };
  }
  function humStop() {
    if (!audio.hum) return;
    var c = audio.ctx, h = audio.hum;
    audio.hum = null;
    h.g.gain.setTargetAtTime(0, c.currentTime, 0.08);
    h.o.forEach(function (o) { o.stop(c.currentTime + 0.5); });
  }
  function setMuted(m) {
    audio.muted = m;
    if (!m) {
      ensureAudio();
      if (game.plane) setTimeout(humStart, 50);
      setTimeout(function () { tone('sine', 880, 880, 0.08, 0.08); }, 30);
    } else {
      humStop();
    }
    soundBtn.textContent = 'Sound: ' + (m ? 'off' : 'on') + ' (M)';
    soundBtn.setAttribute('aria-pressed', m ? 'false' : 'true');
  }

  // ---------------------------------------------------------------- game state
  var game = {
    state: 'title', score: 0, high: loadHigh(), newHigh: false, lives: START_LIVES, wave: 1,
    enemies: [], formation: null, player: { x: W / 2, dead: false, deadTimer: 0, inv: 0, cool: 0 },
    pulse: null, bombs: [], houses: [], particles: [], texts: [], plane: null,
    planeTimer: 0, fireTimer: 0, hold: 0, clearing: 0, overTimer: 0, overReason: '',
    banner: null, time: 0
  };
  var input = { left: false, right: false, fire: false };
  var held = { left: false, right: false, fire: false };
  var touchHeld = { left: false, right: false, fire: false };
  var rain = [];
  var stats = { games: 0, wavesCleared: 0, maxWave: 1, gameOvers: [] };

  // ---------------------------------------------------------------- houses (pixel-erodible)
  function houseCellType(r, c) {
    var cx = c + 0.5 - HOUSE_COLS / 2;
    if (r <= 8) {
      if (Math.abs(cx) <= 2 + r * 1.25) return 1;           // roof
      if (r >= 1 && c >= 17 && c <= 18) return 2;            // chimney
      return 0;
    }
    if (c < 2 || c > 21) return 0;
    if (r >= 11 && r <= 13 && ((c >= 4 && c <= 7) || (c >= 16 && c <= 19))) return 4; // windows
    if (r >= 12 && c >= 10 && c <= 13) return 5;           // door
    return 3;                                              // wall
  }
  function houseCellColor(type, r, c, hr) {
    var j = hr() * 6 - 3;
    switch (type) {
      case 1: return 'hsl(8,42%,' + (((r % 2) ? 27 : 32) + j).toFixed(1) + '%)';
      case 2: return 'hsl(14,32%,' + (36 + j).toFixed(1) + '%)';
      case 4: return (c === 5 || c === 6 || c === 17 || c === 18) && r === 12 ? '#e2b85e' : '#f4d47c';
      case 5: return 'hsl(24,38%,' + (26 + j * 0.5).toFixed(1) + '%)';
      default: return 'hsl(36,26%,' + (60 + j).toFixed(1) + '%)';
    }
  }
  function buildHouses() {
    var hr = mulberry32(99);
    game.houses = HOUSE_XS.map(function (cx) {
      var n = HOUSE_COLS * HOUSE_ROWS;
      var h = { x: Math.round(cx - HOUSE_W / 2), y: HOUSE_TOP, cells: new Uint8Array(n), colors: new Array(n) };
      for (var r = 0; r < HOUSE_ROWS; r++) {
        for (var c = 0; c < HOUSE_COLS; c++) {
          var i = r * HOUSE_COLS + c, t = houseCellType(r, c);
          h.cells[i] = t;
          h.colors[i] = t ? houseCellColor(t, r, c, hr) : null;
        }
      }
      return h;
    });
  }
  // First solid cell overlapping the rectangle; scans from the side the projectile comes from.
  function houseHit(x0, y0, w, h, fromBelow) {
    for (var k = 0; k < game.houses.length; k++) {
      var hs = game.houses[k];
      if (x0 + w < hs.x || x0 > hs.x + HOUSE_W || y0 + h < hs.y || y0 > hs.y + HOUSE_H) continue;
      var c0 = clamp(Math.floor((x0 - hs.x) / CELL), 0, HOUSE_COLS - 1);
      var c1 = clamp(Math.floor((x0 + w - hs.x) / CELL), 0, HOUSE_COLS - 1);
      var r0 = clamp(Math.floor((y0 - hs.y) / CELL), 0, HOUSE_ROWS - 1);
      var r1 = clamp(Math.floor((y0 + h - hs.y) / CELL), 0, HOUSE_ROWS - 1);
      for (var s = 0; s <= r1 - r0; s++) {
        var r = fromBelow ? r1 - s : r0 + s;
        for (var c = c0; c <= c1; c++) {
          if (hs.cells[r * HOUSE_COLS + c]) {
            return { house: hs, x: hs.x + (c + 0.5) * CELL, y: hs.y + (r + 0.5) * CELL };
          }
        }
      }
    }
    return null;
  }
  function erodeHouse(hs, px, py, radius, dirY) {
    var cc = (px - hs.x) / CELL, cr = (py - hs.y) / CELL;
    var reach = Math.ceil(radius + 2);
    for (var r = Math.floor(cr) - reach; r <= Math.floor(cr) + reach; r++) {
      if (r < 0 || r >= HOUSE_ROWS) continue;
      for (var c = Math.floor(cc) - reach; c <= Math.floor(cc) + reach; c++) {
        if (c < 0 || c >= HOUSE_COLS) continue;
        var dx = c + 0.5 - cc, dy = r + 0.5 - cr;
        // Elongate the crater in the direction of travel.
        if (dy * dirY > 0) dy *= 0.6;
        if (dx * dx + dy * dy <= radius * radius * (0.55 + 0.9 * rng())) hs.cells[r * HOUSE_COLS + c] = 0;
      }
    }
  }

  // ---------------------------------------------------------------- formation
  function makeShape(type) {
    var s = { bumps: [], dots: [], outline: [] };
    var i;
    if (type === 2) {
      for (i = 0; i < 10; i++) s.bumps.push({ a: i / 10 * TAU + rand(-0.2, 0.2), s: rand(0.22, 0.34) });
      for (i = 0; i < 7; i++) {
        var a = rng() * TAU, d = Math.sqrt(rng()) * 0.7;
        s.dots.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, s: rand(0.6, 1.2) });
      }
    }
    if (type === 0) {
      var k = 3 + Math.floor(rng() * 3), ph = rng() * TAU;
      var lobes = [rng() * TAU, rng() * TAU, rng() * TAU];
      for (i = 0; i < 36; i++) {
        var t = i / 36 * TAU, rr = 1 + 0.06 * Math.sin(k * t + ph);
        for (var j = 0; j < lobes.length; j++) {
          var dd = Math.atan2(Math.sin(t - lobes[j]), Math.cos(t - lobes[j]));
          rr += 0.16 * Math.exp(-dd * dd / 0.025);
        }
        s.outline.push(Math.cos(t) * rr, Math.sin(t) * rr);
      }
    }
    return s;
  }
  function buildFormation() {
    game.enemies = [];
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var t = ROW_TYPES[r];
        game.enemies.push({
          row: r, col: c, type: t, alive: true,
          phase: rng() * TAU, rot: rng() * TAU, spin: rand(0.25, 0.7) * (rng() < 0.5 ? -1 : 1),
          shape: makeShape(t)
        });
      }
    }
    game.formation = { x: (W - (COLS - 1) * SX) / 2, y: 110 + Math.min(game.wave - 1, 5) * 14, dir: 1 };
  }
  function enemyX(e) { return game.formation.x + e.col * SX; }
  function enemyY(e) { return game.formation.y + e.row * SY + Math.sin(game.time * 2.2 + e.phase) * 1.5; }
  function aliveCount() {
    var n = 0;
    for (var i = 0; i < game.enemies.length; i++) if (game.enemies[i].alive) n++;
    return n;
  }
  function formationSpeed(alive) {
    var frac = 1 - alive / (ROWS * COLS);
    var base = 30 + 7 * (game.wave - 1);
    var s = base * (1 + 2.6 * frac * frac + (alive <= 3 ? 1.2 : 0) + (alive === 1 ? 1.5 : 0));
    return Math.min(s, 330);
  }
  function columnBottoms() {
    var out = [];
    for (var c = 0; c < COLS; c++) {
      var best = null;
      for (var i = 0; i < game.enemies.length; i++) {
        var e = game.enemies[i];
        if (e.alive && e.col === c && (!best || e.row > best.row)) best = e;
      }
      if (best) out.push(best);
    }
    return out;
  }

  // ---------------------------------------------------------------- flow
  function newGame() {
    stats.games++;
    game.score = 0; game.lives = START_LIVES; game.wave = 1; game.newHigh = false;
    game.particles = []; game.texts = [];
    game.player.x = W / 2; game.player.dead = false; game.player.inv = 0; game.player.cool = 0.2;
    startWave();
    game.state = 'playing';
  }
  function startWave() {
    buildHouses();
    buildFormation();
    game.bombs = []; game.pulse = null; game.plane = null; humStop();
    game.planeTimer = rand(10, 18);
    game.fireTimer = rand(1.2, 2.0);
    game.hold = 1.0; game.clearing = 0;
    game.banner = { text: 'Wave ' + game.wave, sub: game.wave === 1 ? 'Protect the houses' : 'The formation is faster', t: 1.6 };
  }
  function gameOver(reason) {
    game.state = 'gameover';
    game.overReason = reason;
    stats.gameOvers.push(reason.charAt(4) === 'h' ? 'reached' : 'lives');
    game.overTimer = 0;
    game.plane = null; humStop();
    game.pulse = null;
    sfx.over();
    if (game.score >= game.high && game.score > 0) saveHigh(game.high);
  }
  function addScore(n) {
    game.score += n;
    if (game.score > game.high) {
      game.high = game.score;
      game.newHigh = true;
      saveHigh(game.high);
    }
  }
  function startAction() {
    if (game.state === 'title') { newGame(); return; }
    if (game.state === 'gameover' && game.overTimer > 0.8) newGame();
  }
  function togglePause() {
    if (DEMO) return;
    if (game.state === 'playing') { game.state = 'paused'; humStop(); }
    else if (game.state === 'paused') { game.state = 'playing'; if (game.plane) humStart(); }
    pauseBtn.textContent = game.state === 'paused' ? 'Resume (P)' : 'Pause (P)';
  }

  // ---------------------------------------------------------------- effects
  function burst(x, y, color, n, speed, life, size) {
    for (var i = 0; i < n; i++) {
      var a = vrng() * TAU, sp = speed * (0.35 + 0.65 * vrng());
      game.particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - speed * 0.25,
        life: life * (0.6 + 0.4 * vrng()), max: life, size: size * (0.6 + 0.6 * vrng()), color: color, g: 320, smoke: false
      });
    }
  }
  function smoke(x, y, n) {
    for (var i = 0; i < n; i++) {
      game.particles.push({
        x: x + (vrng() - 0.5) * 30, y: y - vrng() * 20, vx: (vrng() - 0.5) * 30, vy: -20 - vrng() * 30,
        life: 1.2 + vrng() * 0.6, max: 1.8, size: 6 + vrng() * 8, color: 'rgba(90,96,108,', g: -5, smoke: true
      });
    }
  }
  function floatText(x, y, text, color) { game.texts.push({ x: x, y: y, text: text, color: color, life: 1.3 }); }

  // ---------------------------------------------------------------- update
  function updateRain(dt) {
    if (!rain.length) {
      for (var i = 0; i < 70; i++) rain.push({ x: vrng() * (W + 100), y: vrng() * H, len: 8 + vrng() * 14, sp: 260 + vrng() * 200 });
    }
    for (var k = 0; k < rain.length; k++) {
      var d = rain[k];
      d.y += d.sp * dt; d.x -= d.sp * 0.18 * dt;
      if (d.y > GROUND_Y) { d.y = -d.len - vrng() * 60; d.x = vrng() * (W + 100); }
    }
  }
  function updateParticles(dt) {
    var i;
    for (i = game.particles.length - 1; i >= 0; i--) {
      var p = game.particles[i];
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (!p.smoke && p.y > GROUND_Y) { p.y = GROUND_Y; p.vy *= -0.3; p.vx *= 0.6; }
      if (p.life <= 0) game.particles.splice(i, 1);
    }
    for (i = game.texts.length - 1; i >= 0; i--) {
      var t = game.texts[i];
      t.y -= 28 * dt; t.life -= dt;
      if (t.life <= 0) game.texts.splice(i, 1);
    }
    if (game.banner) { game.banner.t -= dt; if (game.banner.t <= 0) game.banner = null; }
  }

  function update(dt) {
    game.time += dt;
    updateRain(dt);
    if (game.state === 'paused') return;
    updateParticles(dt);
    if (game.state === 'playing') updatePlaying(dt);
    else if (game.state === 'gameover') {
      game.overTimer += dt;
      if (DEMO && game.overTimer > 3) newGame();
    }
  }

  function updatePlaying(dt) {
    if (DEMO) demoAI();
    else {
      input.left = held.left || touchHeld.left;
      input.right = held.right || touchHeld.right;
      input.fire = held.fire || touchHeld.fire;
    }
    updatePlayer(dt);
    updatePulse(dt);
    updateBombs(dt);
    if (game.state !== 'playing') return;
    updatePlane(dt);

    if (game.clearing > 0) {
      game.clearing -= dt;
      if (game.clearing <= 0) { game.wave++; stats.wavesCleared++; stats.maxWave = Math.max(stats.maxWave, game.wave); startWave(); }
      return;
    }
    if (game.hold > 0) { game.hold -= dt; return; }
    updateFormation(dt);
    if (game.state !== 'playing') return;
    updateEnemyFire(dt);
  }

  function updatePlayer(dt) {
    var p = game.player;
    if (p.dead) {
      p.deadTimer -= dt;
      if (p.deadTimer <= 0) {
        if (game.lives > 0) {
          p.dead = false; p.inv = 1.6; p.x = W / 2; p.cool = 0.3;
          game.bombs = [];
        } else {
          gameOver('All radar trucks were lost.');
        }
      }
      return;
    }
    var dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    p.x = clamp(p.x + dir * PLAYER_SPEED * dt, 30, W - 38);
    if (p.inv > 0) p.inv -= dt;
    p.cool -= dt;
    if (input.fire && !game.pulse && p.cool <= 0 && game.clearing <= 0) {
      game.pulse = { x: p.x, y: MUZZLE_Y };
      p.cool = FIRE_COOLDOWN;
      sfx.shoot();
    }
  }

  function killEnemy(e, x, y) {
    e.alive = false;
    addScore(TYPES[e.type].points);
    burst(x, y, TYPES[e.type].color, 12, 150, 0.7, 3);
    sfx.hit(e.type);
    if (aliveCount() === 0) {
      game.clearing = 2.2;
      game.banner = { text: 'Wave ' + game.wave + ' cleared', sub: 'Next wave: ' + (game.wave + 1), t: 2.1 };
      sfx.wave();
    }
  }

  function updatePulse(dt) {
    var pu = game.pulse;
    if (!pu) return;
    pu.y -= PULSE_SPEED * dt;
    if (pu.y < 30) { game.pulse = null; return; }
    var i;
    for (i = 0; i < game.bombs.length; i++) {
      var b = game.bombs[i];
      if (Math.abs(b.x - pu.x) < 9 && Math.abs(b.y - (pu.y + 3)) < 10) {
        game.bombs.splice(i, 1); game.pulse = null;
        burst(b.x, b.y, '#cfeaff', 6, 90, 0.4, 2); sfx.cancel();
        return;
      }
    }
    var hit = houseHit(pu.x - 3, pu.y, 6, 8, true);
    if (hit) {
      erodeHouse(hit.house, hit.x, hit.y, 1.8, -1);
      burst(hit.x, hit.y, '#9b6b55', 5, 70, 0.4, 2); sfx.house();
      game.pulse = null; return;
    }
    for (i = 0; i < game.enemies.length; i++) {
      var e = game.enemies[i];
      if (!e.alive) continue;
      var ex = enemyX(e), ey = enemyY(e), r = TYPES[e.type].r + 4;
      if (Math.abs(ex - pu.x) < r && Math.abs(ey - (pu.y + 4)) < r) {
        game.pulse = null;
        killEnemy(e, ex, ey);
        return;
      }
    }
    var pl = game.plane;
    if (pl && Math.abs(pl.x - pu.x) < 30 && Math.abs(PLANE_Y - pu.y) < 20) {
      game.pulse = null;
      addScore(pl.value);
      floatText(pl.x, PLANE_Y, '+' + pl.value, '#ffe07a');
      burst(pl.x, PLANE_Y, '#ffd27a', 18, 170, 0.9, 3);
      burst(pl.x, PLANE_Y, '#c9d0da', 14, 120, 1.0, 3);
      game.plane = null; humStop(); sfx.bonus();
      game.planeTimer = rand(16, 26);
    }
  }

  function updateBombs(dt) {
    var p = game.player;
    for (var i = game.bombs.length - 1; i >= 0; i--) {
      var b = game.bombs[i];
      b.t += dt;
      b.y += b.vy * dt;
      if (b.kind === 'pellet') b.x = b.x0 + Math.sin(b.t * 12) * 2.2;
      var hit = houseHit(b.x - 3, b.y - 4, 6, 9, false);
      if (hit) {
        erodeHouse(hit.house, hit.x, hit.y, 2.1, 1);
        burst(hit.x, hit.y, b.kind === 'drop' ? '#9fd6ff' : '#e6f0fa', 5, 60, 0.35, 2);
        sfx.house();
        game.bombs.splice(i, 1);
        continue;
      }
      if (!p.dead && p.inv <= 0) {
        var dx = b.x - p.x, top = b.y + 5;
        var inDome = top > GROUND_Y - 47 && top < GROUND_Y - 25 && Math.abs(dx) < 11;
        var inBody = top > GROUND_Y - 31 && b.y - 5 < GROUND_Y && dx > -25 && dx < 33;
        if (inDome || inBody) {
          game.bombs.splice(i, 1);
          hitPlayer();
          continue;
        }
      }
      if (b.y > GROUND_Y + 2) {
        burst(b.x, GROUND_Y - 1, b.kind === 'drop' ? '#8ccfff' : '#e6f0fa', 4, 50, 0.3, 1.6);
        game.bombs.splice(i, 1);
      }
    }
  }

  function hitPlayer() {
    var p = game.player;
    game.lives--;
    p.dead = true; p.deadTimer = 1.7;
    game.pulse = null;
    burst(p.x, GROUND_Y - 22, '#ffb347', 22, 220, 0.9, 3.5);
    burst(p.x, GROUND_Y - 22, '#ffffff', 10, 160, 0.6, 2.5);
    smoke(p.x, GROUND_Y - 15, 10);
    sfx.playerHit();
  }

  function updatePlane(dt) {
    var pl = game.plane;
    if (pl) {
      pl.x += pl.vx * dt;
      if ((pl.vx > 0 && pl.x > W + 70) || (pl.vx < 0 && pl.x < -70)) {
        game.plane = null; humStop(); game.planeTimer = rand(16, 26);
      }
      return;
    }
    if (game.clearing > 0 || game.hold > 0) return;
    game.planeTimer -= dt;
    if (game.planeTimer <= 0) {
      if (aliveCount() < 6) { game.planeTimer = 5; return; }
      var dir = rng() < 0.5 ? 1 : -1;
      game.plane = { x: dir > 0 ? -70 : W + 70, vx: dir * 115, value: pick(BONUS_VALUES) };
      humStart();
    }
  }

  function updateFormation(dt) {
    var f = game.formation, alive = aliveCount();
    if (!alive) return;
    var minC = COLS, maxC = -1, maxR = -1;
    for (var i = 0; i < game.enemies.length; i++) {
      var e = game.enemies[i];
      if (!e.alive) continue;
      if (e.col < minC) minC = e.col;
      if (e.col > maxC) maxC = e.col;
      if (e.row > maxR) maxR = e.row;
    }
    f.x += formationSpeed(alive) * f.dir * dt;
    var left = f.x + minC * SX - 16, right = f.x + maxC * SX + 16;
    if (f.dir > 0 && right > W - EDGE) { f.x -= right - (W - EDGE); f.dir = -1; f.y += STEP_DOWN; sfx.step(); }
    else if (f.dir < 0 && left < EDGE) { f.x += EDGE - left; f.dir = 1; f.y += STEP_DOWN; sfx.step(); }
    if (f.y + maxR * SY + 15 >= HOUSE_TOP) gameOver('The hail reached the houses.');
  }

  function updateEnemyFire(dt) {
    game.fireTimer -= dt;
    if (game.fireTimer > 0 || game.player.dead) return;
    game.fireTimer = rand(0.5, 1.3) / (1 + 0.15 * (game.wave - 1));
    var maxBombs = Math.min(2 + game.wave, 7);
    if (game.bombs.length >= maxBombs) return;
    var bottoms = columnBottoms();
    if (!bottoms.length) return;
    var shooter;
    if (rng() < 0.4) {
      shooter = bottoms[0];
      for (var i = 1; i < bottoms.length; i++) {
        if (Math.abs(enemyX(bottoms[i]) - game.player.x) < Math.abs(enemyX(shooter) - game.player.x)) shooter = bottoms[i];
      }
    } else {
      shooter = pick(bottoms);
    }
    var x = enemyX(shooter), y = enemyY(shooter) + TYPES[shooter.type].r;
    var drop = rng() < 0.55, k = 1 + 0.05 * (game.wave - 1);
    game.bombs.push({ x: x, x0: x, y: y, t: 0, kind: drop ? 'drop' : 'pellet', vy: (drop ? rand(165, 195) : rand(215, 245)) * k });
  }

  // ---------------------------------------------------------------- demo AI
  function demoAI() {
    var p = game.player;
    input.left = input.right = input.fire = false;
    if (p.dead) return;
    var threat = null, best = 1e9, i;
    for (i = 0; i < game.bombs.length; i++) {
      var b = game.bombs[i];
      if (b.y > GROUND_Y - 240 && b.y < GROUND_Y && b.x > p.x - 34 && b.x < p.x + 42) {
        var d = GROUND_Y - b.y;
        if (d < best) { best = d; threat = b; }
      }
    }
    var target = null;
    if (threat) {
      target = threat.x < p.x ? threat.x + 64 : threat.x - 56;
      if (target > W - 40) target = threat.x - 56;
      if (target < 40) target = threat.x + 64;
    } else if (game.plane && game.clearing <= 0) {
      var tt = (MUZZLE_Y - PLANE_Y) / PULSE_SPEED;
      var px = game.plane.x + game.plane.vx * tt;
      if (px > 40 && px < W - 40) target = px;
    }
    if (target === null && game.clearing <= 0) {
      var bottoms = columnBottoms(), alive = aliveCount();
      var vx = formationSpeed(alive) * game.formation.dir;
      for (i = 0; i < bottoms.length; i++) {
        var e = bottoms[i];
        var lead = enemyX(e) + vx * ((MUZZLE_Y - enemyY(e)) / PULSE_SPEED);
        if (target === null || Math.abs(lead - p.x) < Math.abs(target - p.x)) target = lead;
      }
    }
    if (target === null) return;
    var dx = target - p.x;
    if (dx > 3) input.right = true;
    else if (dx < -3) input.left = true;
    if (!threat && Math.abs(dx) < 10) input.fire = true;
  }

  // ---------------------------------------------------------------- view and scaling
  var view = { sx: 1, sy: 1, dpr: 0, cssW: 0 };
  var bgCanvas = document.createElement('canvas');
  function resize() {
    var wrap = canvas.parentElement;
    var availW = wrap.clientWidth || W;
    var padH = (TOUCH && touchPad) ? touchPad.offsetHeight + 12 : 0;
    var top = canvas.getBoundingClientRect().top + (window.pageYOffset || 0);
    var vh = window.innerHeight || H;
    var availH = vh - top - padH - 12;
    if (availH < vh * 0.55) availH = vh - padH - 16;
    var s = Math.max(0.25, Math.min(availW / W, availH / H));
    var cssW = Math.floor(W * s), cssH = Math.round(cssW * H / W);
    var dpr0 = window.devicePixelRatio || 1;
    if (cssW === view.cssW && dpr0 === view.dpr) return;
    view.cssW = cssW;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    var dpr = window.devicePixelRatio || 1;
    var bw = Math.max(1, Math.round(cssW * dpr)), bh = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    view.sx = bw / W; view.sy = bh / H; view.dpr = dpr;
    buildBackground(bw, bh);
  }

  function buildBackground(bw, bh) {
    bgCanvas.width = bw; bgCanvas.height = bh;
    var b = bgCanvas.getContext('2d');
    b.setTransform(view.sx, 0, 0, view.sy, 0, 0);
    var g = b.createLinearGradient(0, 0, 0, RIDGE_Y);
    g.addColorStop(0, '#060a14');
    g.addColorStop(0.45, '#151d2e');
    g.addColorStop(0.8, '#26303f');
    g.addColorStop(1, '#2e3746');
    b.fillStyle = g; b.fillRect(0, 0, W, H);
    // cloud masses
    var cr = mulberry32(3);
    for (var i = 0; i < 26; i++) {
      var x = cr() * W, y = 10 + cr() * 220, rx = 60 + cr() * 120, ry = 22 + cr() * 40;
      var cg = b.createRadialGradient(x, y, 0, x, y, rx);
      var shade = Math.floor(48 + cr() * 30);
      cg.addColorStop(0, 'rgba(' + shade + ',' + (shade + 8) + ',' + (shade + 22) + ',0.30)');
      cg.addColorStop(1, 'rgba(' + shade + ',' + (shade + 8) + ',' + (shade + 22) + ',0)');
      b.save(); b.translate(x, y); b.scale(1, ry / rx); b.translate(-x, -y);
      b.fillStyle = cg; b.beginPath(); b.arc(x, y, rx, 0, TAU); b.fill(); b.restore();
    }
    // precipitation shafts
    for (i = 0; i < 4; i++) {
      var sx = 80 + cr() * (W - 160), sw = 60 + cr() * 90;
      var sg = b.createLinearGradient(0, 160, 0, RIDGE_Y);
      sg.addColorStop(0, 'rgba(120,135,160,0.07)');
      sg.addColorStop(1, 'rgba(120,135,160,0)');
      b.fillStyle = sg;
      b.beginPath(); b.moveTo(sx, 160); b.lineTo(sx + sw, 160); b.lineTo(sx + sw - 40, RIDGE_Y); b.lineTo(sx - 40, RIDGE_Y); b.closePath(); b.fill();
    }
    // distant hills
    b.fillStyle = '#1b2331';
    b.beginPath(); b.moveTo(0, RIDGE_Y);
    for (x = 0; x <= W; x += 10) b.lineTo(x, 474 + 9 * Math.sin(x / 90 + 1) + 6 * Math.sin(x / 37));
    b.lineTo(W, RIDGE_Y); b.closePath(); b.fill();
    // ridge the houses stand on
    b.fillStyle = '#141a21'; b.fillRect(0, RIDGE_Y, W, GROUND_Y - RIDGE_Y);
    b.fillStyle = '#2b3a30'; b.fillRect(0, RIDGE_Y, W, 2);
    // road
    b.fillStyle = '#0e1115'; b.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    b.fillStyle = '#3a434e'; b.fillRect(0, GROUND_Y, W, 1.5);
  }

  // ---------------------------------------------------------------- drawing helpers
  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }

  function drawSnowflake(r, rot) {
    ctx.rotate(rot);
    ctx.lineCap = 'round';
    function arms(branches) {
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        ctx.save(); ctx.rotate(i * Math.PI / 3);
        ctx.moveTo(0, 0); ctx.lineTo(r, 0);
        if (branches) {
          ctx.moveTo(r * 0.5, 0); ctx.lineTo(r * 0.76, r * 0.26);
          ctx.moveTo(r * 0.5, 0); ctx.lineTo(r * 0.76, -r * 0.26);
          ctx.moveTo(r * 0.24, 0); ctx.lineTo(r * 0.38, r * 0.15);
          ctx.moveTo(r * 0.24, 0); ctx.lineTo(r * 0.38, -r * 0.15);
        }
        ctx.restore();
      }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(150,195,255,0.28)'; ctx.lineWidth = 5; arms(false);
    ctx.strokeStyle = '#eef6ff'; ctx.lineWidth = 1.8; arms(true);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3 + Math.PI / 6;
      ctx.lineTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2);
    }
    ctx.closePath(); ctx.fill();
  }

  function drawGraupel(r, shape, rot) {
    ctx.rotate(rot);
    var g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.15);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#9fadbd');
    ctx.fillStyle = g;
    ctx.beginPath();
    for (var i = 0; i < shape.bumps.length; i++) {
      var bmp = shape.bumps[i], bx = Math.cos(bmp.a) * r * 0.78, by = Math.sin(bmp.a) * r * 0.78;
      ctx.moveTo(bx + bmp.s * r, by); ctx.arc(bx, by, bmp.s * r, 0, TAU);
    }
    ctx.moveTo(r * 0.82, 0); ctx.arc(0, 0, r * 0.82, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(110,130,158,0.55)';
    for (i = 0; i < shape.dots.length; i++) {
      var d = shape.dots[i];
      circle(d.x * r, d.y * r, d.s); ctx.fill();
    }
  }

  function drawSmallHail(r) {
    circle(0, 0, r);
    ctx.fillStyle = 'rgba(140,195,245,0.45)'; ctx.fill();
    ctx.strokeStyle = 'rgba(220,240,255,0.95)'; ctx.lineWidth = 1.5; ctx.stroke();
    circle(r * 0.1, r * 0.12, r * 0.5);
    ctx.fillStyle = 'rgba(242,247,252,0.95)'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(-r * 0.42, -r * 0.45, r * 0.28, r * 0.15, -0.6, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
  }

  function drawLargeHail(r, shape, rot) {
    ctx.rotate(rot);
    var o = shape.outline;
    ctx.beginPath();
    for (var i = 0; i < o.length; i += 2) ctx.lineTo(o[i] * r, o[i + 1] * r);
    ctx.closePath();
    ctx.fillStyle = 'rgba(130,185,235,0.55)'; ctx.fill();
    ctx.strokeStyle = 'rgba(225,240,255,0.95)'; ctx.lineWidth = 1.5; ctx.stroke();
    circle(0, 0, r * 0.74); ctx.fillStyle = 'rgba(230,239,250,0.88)'; ctx.fill();
    circle(0, 0, r * 0.56); ctx.fillStyle = 'rgba(120,172,228,0.8)'; ctx.fill();
    circle(0, 0, r * 0.36); ctx.fillStyle = '#f5f8fc'; ctx.fill();
    ctx.rotate(-rot);
    ctx.beginPath(); ctx.ellipse(-r * 0.45, -r * 0.5, r * 0.25, r * 0.12, -0.7, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
  }

  function drawParticleType(type, r, shape, rot) {
    if (type === 0) drawLargeHail(r, shape, rot);
    else if (type === 1) drawSmallHail(r);
    else if (type === 2) drawGraupel(r, shape, rot);
    else drawSnowflake(r, rot);
  }

  function drawTruck(x, y, scale) {
    ctx.save(); ctx.translate(x, y); if (scale) ctx.scale(scale, scale);
    // wheels
    ctx.fillStyle = '#07090b'; circle(-12, -6.5, 6.5); ctx.fill(); circle(20, -6.5, 6.5); ctx.fill();
    ctx.fillStyle = '#8a939e'; circle(-12, -6.5, 2.4); ctx.fill(); circle(20, -6.5, 2.4); ctx.fill();
    // bed and chassis
    ctx.fillStyle = '#c9d1db'; ctx.fillRect(-25, -20, 40, 11);
    ctx.fillStyle = '#9aa4b1'; ctx.fillRect(-25, -10, 58, 3);
    // cab
    ctx.fillStyle = '#e4e9ef';
    ctx.beginPath(); ctx.moveTo(14, -9); ctx.lineTo(14, -31); ctx.lineTo(25, -31); ctx.lineTo(31.5, -20); ctx.lineTo(33, -9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5f8fc4';
    ctx.beginPath(); ctx.moveTo(17, -28); ctx.lineTo(24, -28); ctx.lineTo(28.5, -20.5); ctx.lineTo(17, -20.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd36b'; ctx.fillRect(31, -14, 2, 3);
    // stripe
    ctx.fillStyle = '#2f6fb3'; ctx.fillRect(-25, -15, 58, 2.5);
    // radar pedestal and radome
    ctx.fillStyle = '#8d97a4'; ctx.fillRect(-4, -28, 8, 8);
    ctx.fillStyle = '#6f7986'; ctx.fillRect(-9, -28, 18, 2);
    var g = ctx.createRadialGradient(-4, -41, 1, 0, -36, 12);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#b8c2ce');
    ctx.fillStyle = g; circle(0, -36, 11); ctx.fill();
    ctx.strokeStyle = '#76808d'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = 'rgba(118,128,141,0.6)';
    ctx.beginPath(); ctx.moveTo(-11, -36); ctx.lineTo(11, -36); ctx.stroke();
    ctx.restore();
  }

  function drawPlane(x, y, dir, t, scale) {
    ctx.save(); ctx.translate(x, y); ctx.scale(dir * (scale || 1), scale || 1);
    var body = '#c7ced8', edge = '#7f8a98';
    ctx.lineWidth = 1; ctx.strokeStyle = edge;
    // main wing, straight with a slight taper
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(9, -4); ctx.lineTo(5, -33); ctx.lineTo(-2, -33); ctx.lineTo(-5, -4);
    ctx.lineTo(-5, 4); ctx.lineTo(-2, 33); ctx.lineTo(5, 33); ctx.lineTo(9, 4); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // tailplane
    ctx.beginPath();
    ctx.moveTo(-28, -2); ctx.lineTo(-31, -13); ctx.lineTo(-36, -13); ctx.lineTo(-36, 13); ctx.lineTo(-31, 13); ctx.lineTo(-28, 2); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // fuselage
    ctx.beginPath();
    ctx.moveTo(-38, -2); ctx.lineTo(-20, -4.5); ctx.lineTo(26, -4.5);
    ctx.quadraticCurveTo(36, -4, 37, 0); ctx.quadraticCurveTo(36, 4, 26, 4.5);
    ctx.lineTo(-20, 4.5); ctx.lineTo(-38, 2); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9ea9b7'; ctx.fillRect(-38, -1, 12, 2);   // fin seen from below
    ctx.fillStyle = '#3b4a5e';
    ctx.beginPath(); ctx.moveTo(29, -3); ctx.quadraticCurveTo(34, -2.5, 34.5, 0); ctx.quadraticCurveTo(34, 2.5, 29, 3); ctx.closePath(); ctx.fill();
    // engine nacelles
    for (var s = -1; s <= 1; s += 2) {
      var ny = s * 14;
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.moveTo(-9, ny - 2.5); ctx.lineTo(14, ny - 3.2); ctx.quadraticCurveTo(17, ny, 14, ny + 3.2); ctx.lineTo(-9, ny + 2.5); ctx.closePath();
      ctx.fill(); ctx.stroke();
      // propeller disc and blades
      ctx.fillStyle = 'rgba(215,225,238,0.22)';
      ctx.beginPath(); ctx.ellipse(17.5, ny, 1.6, 10, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(40,46,56,0.85)'; ctx.lineWidth = 1.4;
      for (var k = 0; k < 2; k++) {
        var a = t * 37 + k * Math.PI / 2 + s;
        var len = 10 * Math.cos(a);
        ctx.beginPath(); ctx.moveTo(17.5, ny - len); ctx.lineTo(17.5, ny + len); ctx.stroke();
      }
      ctx.strokeStyle = edge; ctx.lineWidth = 1;
      // cloud probe canister under the outer wing
      ctx.fillStyle = '#8e99a8';
      ctx.fillRect(-3, s * 27 - 1.6, 15, 3.2);
      ctx.fillStyle = '#5b6573'; ctx.fillRect(11, s * 27 - 1.2, 2.5, 2.4);
    }
    ctx.restore();
  }

  function drawDrop(b) {
    ctx.save(); ctx.translate(b.x, b.y);
    ctx.strokeStyle = 'rgba(105,190,247,0.3)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, -18); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.bezierCurveTo(1.5, -4, 4.5, -1, 4.5, 2);
    ctx.arc(0, 2, 4.5, 0, Math.PI);
    ctx.bezierCurveTo(-4.5, -1, -1.5, -4, 0, -8);
    ctx.closePath();
    ctx.fillStyle = '#62b9f4'; ctx.fill();
    ctx.strokeStyle = '#d4eeff'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; circle(-1.6, 1.5, 1.2); ctx.fill();
    ctx.restore();
  }
  function drawPellet(b) {
    circle(b.x, b.y, 3.6);
    ctx.fillStyle = 'rgba(226,238,250,0.92)'; ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(150,180,210,0.9)'; circle(b.x + 0.8, b.y + 0.8, 1.2); ctx.fill();
  }

  function drawPulse(pu) {
    for (var i = 0; i < 3; i++) {
      ctx.strokeStyle = 'rgba(120,255,190,' + [1, 0.55, 0.25][i] + ')';
      ctx.lineWidth = 2.6 - i * 0.6;
      ctx.beginPath(); ctx.arc(pu.x, pu.y + 10 + i * 7, 9 + i * 2, Math.PI * 1.22, Math.PI * 1.78); ctx.stroke();
    }
  }

  function drawHouses() {
    for (var k = 0; k < game.houses.length; k++) {
      var hs = game.houses[k];
      for (var r = 0; r < HOUSE_ROWS; r++) {
        for (var c = 0; c < HOUSE_COLS; c++) {
          var i = r * HOUSE_COLS + c;
          if (!hs.cells[i]) continue;
          ctx.fillStyle = hs.colors[i];
          ctx.fillRect(hs.x + c * CELL, hs.y + r * CELL, CELL + 0.3, CELL + 0.3);
        }
      }
    }
  }

  function drawRain() {
    ctx.strokeStyle = 'rgba(165,185,215,0.13)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 0; i < rain.length; i++) {
      var d = rain[i];
      ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.len * 0.18, d.y + d.len);
    }
    ctx.stroke();
  }

  function drawEnemies() {
    for (var i = 0; i < game.enemies.length; i++) {
      var e = game.enemies[i];
      if (!e.alive) continue;
      ctx.save();
      ctx.translate(enemyX(e), enemyY(e));
      drawParticleType(e.type, TYPES[e.type].r, e.shape, e.rot + game.time * e.spin);
      ctx.restore();
    }
  }

  function drawParticles() {
    for (var i = 0; i < game.particles.length; i++) {
      var p = game.particles[i], a = clamp(p.life / p.max, 0, 1);
      if (p.smoke) {
        ctx.fillStyle = p.color + (0.35 * a).toFixed(3) + ')';
        circle(p.x, p.y, p.size * (1.6 - a * 0.6)); ctx.fill();
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.globalAlpha = 1;
      }
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 18px ' + FONT;
    for (i = 0; i < game.texts.length; i++) {
      var t = game.texts[i];
      ctx.globalAlpha = clamp(t.life, 0, 1);
      ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
      ctx.globalAlpha = 1;
    }
  }

  function pad(n) { var s = String(n); return s.length >= 5 ? s : ('00000' + s).slice(-5); }

  function text(str, x, y, size, color, align, weight) {
    ctx.font = (weight || 'bold') + ' ' + size + 'px ' + FONT;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function drawHUD() {
    ctx.fillStyle = 'rgba(5,8,15,0.45)'; ctx.fillRect(0, 0, W, 38);
    text('SCORE ' + pad(game.score), 16, 20, 18, '#dce8f7', 'left');
    text('HIGH ' + pad(game.high), W / 2, 20, 18, '#9fb4cf', 'center');
    text('WAVE ' + game.wave, W - 16, 20, 18, '#dce8f7', 'right');
    text('LIVES', 16, 581, 13, '#8f9db0', 'left');
    var shown = game.player.dead ? game.lives : game.lives - 1;   // spare trucks
    for (var i = 0; i < shown; i++) drawTruck(78 + i * 40, 592, 0.5);
    if (DEMO) text('DEMO MODE', W / 2, 581, 13, '#f0c75e', 'center');
    text(audio.muted ? 'Sound off (M)' : 'Sound on (M)', W - 16, 581, 13, '#8f9db0', 'right');
  }

  function dim(alpha) { ctx.fillStyle = 'rgba(4,7,14,' + alpha + ')'; ctx.fillRect(0, 0, W, H); }

  function drawTitle() {
    drawHouses();
    drawTruck(W / 2, GROUND_Y);
    dim(0.35);
    ctx.save();
    ctx.shadowColor = 'rgba(120,180,255,0.55)'; ctx.shadowBlur = 18;
    text('HAIL DEFENSE', W / 2, 78, 60, '#eef5ff');
    ctx.restore();
    text('Stop the hailstorm before it reaches the houses.', W / 2, 122, 18, '#b5c3d6', 'center', 'normal');

    var rows = [
      { type: 0, label: 'Large hail', pts: '40 points' },
      { type: 1, label: 'Small hail', pts: '30 points' },
      { type: 2, label: 'Graupel', pts: '20 points' },
      { type: 3, label: 'Snowflake', pts: '10 points' }
    ];
    var y0 = 166;
    for (var i = 0; i < rows.length; i++) {
      var yy = y0 + i * 38;
      ctx.save(); ctx.translate(250, yy);
      drawParticleType(rows[i].type, TYPES[rows[i].type].r, titleShapes[rows[i].type], game.time * 0.5);
      ctx.restore();
      text(rows[i].label, 292, yy, 18, '#dce8f7', 'left', 'normal');
      text(rows[i].pts, 560, yy, 18, '#f0c75e', 'right');
    }
    var py = y0 + 4 * 38 + 6;
    drawPlane(250, py, 1, game.time, 0.55);
    text('Research aircraft', 292, py, 18, '#dce8f7', 'left', 'normal');
    text('50–300 points', 560, py, 18, '#f0c75e', 'right');

    text('Move: Left / Right arrows or A / D     Fire: Space', W / 2, 360, 16, '#c3d0e0', 'center', 'normal');
    text('Pause: P or Escape     Sound: M (off at start)', W / 2, 385, 16, '#c3d0e0', 'center', 'normal');
    if (Math.floor(game.time * 1.6) % 2 === 0) {
      text(TOUCH ? 'Tap Fire or the screen to start' : 'Press Space or Enter to start', W / 2, 422, 22, '#8ff0c0');
    }
    text('High score ' + pad(game.high), W / 2, 588, 14, '#8f9db0', 'center', 'normal');
  }

  function drawBanner() {
    var b = game.banner;
    if (!b) return;
    var a = clamp(b.t * 2, 0, 1);
    ctx.globalAlpha = a;
    text(b.text, W / 2, 300, 40, '#eef5ff');
    text(b.sub, W / 2, 340, 18, '#b5c3d6', 'center', 'normal');
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.setTransform(view.sx, 0, 0, view.sy, 0, 0);
    ctx.drawImage(bgCanvas, 0, 0, W, H);
    drawRain();
    if (game.state === 'title') { drawTitle(); return; }

    drawHouses();
    if (game.plane) drawPlane(game.plane.x, PLANE_Y, game.plane.vx > 0 ? 1 : -1, game.time, PLANE_SCALE);
    drawEnemies();
    for (var i = 0; i < game.bombs.length; i++) {
      if (game.bombs[i].kind === 'drop') drawDrop(game.bombs[i]); else drawPellet(game.bombs[i]);
    }
    if (game.pulse) drawPulse(game.pulse);
    var p = game.player;
    if (!p.dead && !(p.inv > 0 && Math.floor(p.inv * 10) % 2 === 1)) drawTruck(p.x, GROUND_Y);
    drawParticles();
    drawHUD();
    if (game.state === 'playing') drawBanner();

    if (game.state === 'paused') {
      dim(0.55);
      text('PAUSED', W / 2, 270, 48, '#eef5ff');
      text('Press P or Escape to resume', W / 2, 320, 18, '#b5c3d6', 'center', 'normal');
    } else if (game.state === 'gameover') {
      dim(0.6);
      text('GAME OVER', W / 2, 220, 56, '#ffd0c0');
      text(game.overReason, W / 2, 272, 20, '#d5dfeb', 'center', 'normal');
      text('Score ' + pad(game.score) + '     High score ' + pad(game.high), W / 2, 315, 20, '#dce8f7');
      if (game.newHigh && !DEMO) text('New high score', W / 2, 348, 18, '#f0c75e');
      if (game.overTimer > 0.8) {
        var msg = DEMO ? 'The demo restarts shortly' :
          (TOUCH ? 'Tap Fire or the screen to play again' : 'Press Space, Enter or R to play again');
        text(msg, W / 2, 395, 20, '#8ff0c0');
      }
    }
  }

  var titleShapes = [makeShape(0), makeShape(1), makeShape(2), makeShape(3)];

  // ---------------------------------------------------------------- input
  function keyAction(e) {
    var k = (e.key || '').toLowerCase();
    if (k === 'arrowleft' || k === 'left' || k === 'a') return 'left';
    if (k === 'arrowright' || k === 'right' || k === 'd') return 'right';
    if (k === ' ' || k === 'spacebar' || e.code === 'Space') return 'fire';
    if (k === 'p' || k === 'escape' || k === 'esc') return 'pause';
    if (k === 'm') return 'mute';
    if (k === 'enter') return 'start';
    if (k === 'r') return 'restart';
    return null;
  }
  window.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var act = keyAction(e);
    if (!act) return;
    e.preventDefault();
    if (act === 'mute') { if (!e.repeat) setMuted(!audio.muted); return; }
    if (DEMO) return;
    if (act === 'left' || act === 'right' || act === 'fire') held[act] = true;
    if (e.repeat) return;
    if (act === 'pause') togglePause();
    else if (act === 'fire' || act === 'start') startAction();
    else if (act === 'restart' && game.state === 'gameover') startAction();
  });
  window.addEventListener('keyup', function (e) {
    var act = keyAction(e);
    if (act === 'left' || act === 'right' || act === 'fire') { held[act] = false; e.preventDefault(); }
  });
  function releaseAll() {
    held.left = held.right = held.fire = false;
    touchHeld.left = touchHeld.right = touchHeld.fire = false;
    var btns = document.querySelectorAll('.touch-btn.active');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
  }
  window.addEventListener('blur', function () {
    releaseAll();
    if (game.state === 'playing' && !DEMO) togglePause();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { releaseAll(); if (game.state === 'playing' && !DEMO) togglePause(); }
  });

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    canvas.focus();
    if (!DEMO) startAction();
  });

  var touchBtns = document.querySelectorAll('.touch-btn');
  Array.prototype.forEach.call(touchBtns, function (btn) {
    var act = btn.getAttribute('data-act');
    function down(e) {
      e.preventDefault();
      if (btn.setPointerCapture && e.pointerId !== undefined) { try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
      touchHeld[act] = true; btn.classList.add('active');
      if (act === 'fire' && !DEMO) startAction();
    }
    function up() { touchHeld[act] = false; btn.classList.remove('active'); }
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('lostpointercapture', up);
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  });
  soundBtn.addEventListener('click', function () { setMuted(!audio.muted); soundBtn.blur(); });
  pauseBtn.addEventListener('click', function () { togglePause(); pauseBtn.blur(); });

  // ---------------------------------------------------------------- main loop
  var lastNow = 0, acc = 0, frames = 0, STEP = 1 / 120;
  function writeStatus() {
    if (!statusEl) return;
    statusEl.textContent = 'Demo status: frame ' + frames + ', game time ' + game.time.toFixed(1) + ' s, state ' + game.state +
      ', score ' + game.score + ', wave ' + game.wave + ', enemies left ' + aliveCount() + ', lives ' + game.lives +
      ', games ' + stats.games + ', waves cleared ' + stats.wavesCleared + ', max wave ' + stats.maxWave +
      ', endings [' + stats.gameOvers.join(' ') + ']' +
      ', canvas ' + canvas.width + 'x' + canvas.height + ', errors ' + errorCount + (lastError ? ' (' + lastError + ')' : '');
  }
  // Demo mode runs on a timer: headless browsers with virtual time advance timers but may
  // never issue animation frames, and the demo advances a fixed 1/60 s per tick anyway.
  // A requestAnimationFrame callback also redraws in demo mode, so any frame the browser does
  // produce (for example the one a headless screenshot captures) shows the current state.
  function schedule() {
    if (DEMO) setTimeout(function () { frame(0); }, 1000 / 60);
    else window.requestAnimationFrame(frame);
  }
  function demoPaint() {
    window.requestAnimationFrame(demoPaint);
    try { render(); } catch (err) { recordError(err && err.message ? err.message : err); }
  }
  function frame(now) {
    schedule();
    try {
      var dt = DEMO ? 1 / 60 : (lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0);
      lastNow = now;
      acc += dt;
      var n = 0;
      while (acc >= STEP - 1e-9 && n < 24) { update(STEP); acc -= STEP; n++; }
      if (n >= 24) acc = 0;
      render();
      frames++;
      if (DEMO && frames % 15 === 0) writeStatus();
    } catch (err) {
      recordError(err && err.message ? err.message : err);
      if (DEMO) writeStatus();
    }
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas.parentElement);
  buildHouses();
  resize();
  if (DEMO) {
    statusEl.hidden = false;
    newGame();
    writeStatus();
    window.requestAnimationFrame(demoPaint);
  }
  schedule();
})();
