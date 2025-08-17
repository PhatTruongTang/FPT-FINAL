/* ===========================================================
   Neon Shooter - Main
   Filename: main_neon_fixed_menu_button.js
   - Đồng bộ với: audio_explosion_advanced.js + HTML/CSS bạn gửi
   - Fix triệt để:
      • Single thật sự: không spawn P2 khi mode=single
      • Khi người chơi chết: không thể di chuyển/bắn
      • Khi Game Over: dừng enemy bắn, clear đạn, hiện nút Menu (không chỉ "press R")
      • Có nút "Menu" trên Game Over để quay lại nâng cấp & start lại
      • Hiệu ứng bắn rõ ràng + hiệu ứng bay nhẹ cho tàu
   =========================================================== */

(() => {
  'use strict';

  /* --------------------- Canvas & Context --------------------- */
  const cvs = document.getElementById('c');
  const ctx = cvs.getContext('2d', { alpha: true });
  let W = 0, H = 0, DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const resize = () => {
    W = window.innerWidth;
    H = window.innerHeight;
    cvs.width = Math.floor(W * DPR);
    cvs.height = Math.floor(H * DPR);
    cvs.style.width = W + 'px';
    cvs.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  };
  window.addEventListener('resize', resize);
  resize();

  /* --------------------- DOM & UI --------------------- */
  const ui = document.getElementById('ui');
  const hudPlayers = document.getElementById('hud-players');
  const credits = document.getElementById('credits');
  const menu = document.getElementById('menu');
  const totalPointsEl = document.getElementById('totalPoints');
  const notifyEl = document.getElementById('notify');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const tutorialBtn = document.getElementById('tutorialBtn');
  const menuBtn = document.getElementById('menuBtn');

  /* --------------------- Helpers --------------------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const nowMs = () => performance.now();

  const notify = (msg, ms = 1200) => {
    if (!notifyEl) return;
    notifyEl.textContent = msg;
    notifyEl.classList.add('show');
    setTimeout(() => notifyEl.classList.remove('show'), ms);
  };

  /* --------------------- Persistent Meta (points & upgrades) --------------------- */
  const meta = {
    points: 0,
    fireRateLevel: 0,
    bulletDamageLevel: 0,
    missileUnlocked: false,
    missileLevel: 0,
    laserUnlocked: false,
    laserLevel: 0,
    skin: 0,
    map: 0,
  };

  // Try read from localStorage
  try {
    const saved = JSON.parse(localStorage.getItem('neon_meta_v2') || 'null');
    if (saved && typeof saved === 'object') {
      Object.assign(meta, saved);
    }
  } catch { /* ignore */ }

  const saveMeta = () => {
    try { localStorage.setItem('neon_meta_v2', JSON.stringify(meta)); } catch {}
    if (totalPointsEl) totalPointsEl.textContent = `Points: ${meta.points}`;
  };
  saveMeta();

  /* --------------------- Shop wiring --------------------- */
  const btnFR = document.getElementById('upgradeFireRate');
  const btnBD = document.getElementById('upgradeDamage');
  const btnUM = document.getElementById('unlockMissile');
  const btnXM = document.getElementById('upgradeMissile');
  const btnUL = document.getElementById('unlockLaser');
  const btnXL = document.getElementById('upgradeLaser');

  const cost = {
    fireRate: () => 500 + meta.fireRateLevel * 250,
    damage: () => 1000 + meta.bulletDamageLevel * 400,
    unlockMissile: () => 2000,
    upgradeMissile: () => 1500 + meta.missileLevel * 800,
    unlockLaser: () => 5000,
    upgradeLaser: () => 3000 + meta.laserLevel * 1200,
  };

  function tryBuy(price, onOk, msgOk) {
    if (meta.points < price) { notify('Không đủ Points'); return; }
    meta.points -= price;
    onOk();
    notify(msgOk || 'Đã mua!');
    saveMeta();
    refreshShopLabels();
  }

  function refreshShopLabels() {
    if (btnFR) btnFR.textContent = `Fire Rate + (${cost.fireRate()})`;
    if (btnBD) btnBD.textContent = `Bullet Damage + (${cost.damage()})`;
    if (btnUM) btnUM.textContent = meta.missileUnlocked ? 'Missile: Unlocked' : `Unlock Missile (${cost.unlockMissile()})`;
    if (btnXM) btnXM.textContent = `Upgrade Missile (${cost.upgradeMissile()})` + (meta.missileUnlocked ? '' : ' [Lock]');
    if (btnUL) btnUL.textContent = meta.laserUnlocked ? 'Laser: Unlocked' : `Unlock Laser (${cost.unlockLaser()})`;
    if (btnXL) btnXL.textContent = `Upgrade Laser (${cost.upgradeLaser()})` + (meta.laserUnlocked ? '' : ' [Lock]');
    saveMeta();
  }
  refreshShopLabels();

  btnFR && btnFR.addEventListener('click', () => {
    tryBuy(cost.fireRate(), () => meta.fireRateLevel++, `Fire Rate +1 (Lv.${meta.fireRateLevel})`);
  });
  btnBD && btnBD.addEventListener('click', () => {
    tryBuy(cost.damage(), () => meta.bulletDamageLevel++, `Bullet Damage +1 (Lv.${meta.bulletDamageLevel})`);
  });
  btnUM && btnUM.addEventListener('click', () => {
    if (meta.missileUnlocked) { notify('Đã unlock rồi'); return; }
    tryBuy(cost.unlockMissile(), () => meta.missileUnlocked = true, 'Unlock Missile');
  });
  btnXM && btnXM.addEventListener('click', () => {
    if (!meta.missileUnlocked) { notify('Chưa unlock Missile'); return; }
    tryBuy(cost.upgradeMissile(), () => meta.missileLevel++, `Missile +1 (Lv.${meta.missileLevel})`);
  });
  btnUL && btnUL.addEventListener('click', () => {
    if (meta.laserUnlocked) { notify('Đã unlock rồi'); return; }
    tryBuy(cost.unlockLaser(), () => meta.laserUnlocked = true, 'Unlock Laser');
  });
  btnXL && btnXL.addEventListener('click', () => {
    if (!meta.laserUnlocked) { notify('Chưa unlock Laser'); return; }
    tryBuy(cost.upgradeLaser(), () => meta.laserLevel++, `Laser +1 (Lv.${meta.laserLevel})`);
  });

  /* --------------------- Skin & Map selectors --------------------- */
  const skinEls = document.querySelectorAll('.skin-swatch');
  skinEls.forEach(el => {
    el.addEventListener('click', () => {
      skinEls.forEach(e => e.classList.remove('sel'));
      el.classList.add('sel');
      meta.skin = parseInt(el.getAttribute('data-skin') || '0', 10);
      saveMeta();
    });
  });

  const mapEls = document.querySelectorAll('.map-chooser .map-thumb');
  mapEls.forEach(el => {
    el.addEventListener('click', () => {
      mapEls.forEach(e => e.classList.remove('sel'));
      el.classList.add('sel');
      meta.map = parseInt(el.getAttribute('data-map') || '0', 10);
      saveMeta();
    });
  });

  /* --------------------- Controls --------------------- */
  const keys = {};
  window.addEventListener('keydown', e => { keys[e.code] = true; if (state === 'playing') e.preventDefault(); });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  /* --------------------- Entities --------------------- */
  class Bullet {
    constructor(x, y, vx, vy, r, dmg, friendly, type='bullet') {
      this.x = x; this.y = y;
      this.vx = vx; this.vy = vy;
      this.r = r; this.dmg = dmg; this.friendly = friendly;
      this.type = type; // 'bullet' | 'missile' | 'laser-beam'
      this.alive = true;
    }
    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y < -50 || this.y > H + 50 || this.x < -50 || this.x > W + 50) this.alive = false;
    }
    draw(ctx) {
      if (this.type === 'missile') {
        // missile trail
        ctx.save();
        ctx.globalAlpha = 0.85;
        const grad = ctx.createLinearGradient(this.x, this.y+18, this.x, this.y-10);
        grad.addColorStop(0, 'rgba(255,180,80,0.0)');
        grad.addColorStop(1, 'rgba(255,220,120,0.9)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y+14, 3, 16, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1;
        // head
        ctx.fillStyle = '#ffd36b';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4.5, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      } else if (this.type === 'laser-beam') {
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = '#aef';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#aef';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x, this.y - 18);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
      } else {
        ctx.save();
        const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r*2);
        g.addColorStop(0, '#fff');
        g.addColorStop(1, '#6ff');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  class Enemy {
    constructor(x, y, spd=50, hp=20, type='grunt') {
      this.x = x; this.y = y;
      this.w = 28; this.h = 22;
      this.vx = 0; this.vy = spd;
      this.hp = hp; this.type = type;
      this.cool = rand(0.6, 1.3);
      this.alive = true;
      this.t = 0;
    }
    get rect() { return { x: this.x - this.w/2, y: this.y - this.h/2, w: this.w, h: this.h }; }
    update(dt) {
      this.t += dt;
      this.y += this.vy * dt;
      // Simple horizontal sway
      this.x += Math.sin(this.t * 2) * 30 * dt;
      this.cool -= dt;
      if (this.cool <= 0 && state === 'playing') {
        this.shoot();
        this.cool = rand(1.2, 2.2);
      }
      if (this.y > H + 40) this.alive = false;
    }
    shoot() {
      if (gameOver) return;
      bullets.push(new Bullet(this.x, this.y+12, 0, 270, 4, 7, false, 'bullet'));
      if (window.audio && audio.sfx) audio.sfx('enemyShot', { vol: 0.6 });
    }
    hit(dmg) {
      this.hp -= dmg;
      if (window.audio && audio.sfx) audio.sfx('enemyHit', { vol: 0.6 });
      if (this.hp <= 0) {
        this.die();
      }
    }
    die() {
      this.alive = false;
      addPoints(30);
      spawnExplosion(this.x, this.y, 'small');
    }
    draw(ctx) {
      ctx.save();
      // neon enemy
      ctx.translate(this.x, this.y);
      ctx.fillStyle = '#f77';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#f77';
      ctx.beginPath();
      ctx.moveTo(-this.w/2, -this.h/2);
      ctx.lineTo(this.w/2, -this.h/2);
      ctx.lineTo(0, this.h/2);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  class Player {
    constructor(id=1, x=W/2, y=H-80, controls='wasd') {
      this.id = id;
      this.x = x; this.y = y;
      this.w = 30; this.h = 28;
      this.speed = 280;
      this.vx = 0; this.vy = 0;
      this.hpMax = 100; this.hp = this.hpMax;
      this.alive = true;
      this.cool = 0;
      this.missileCool = 0;
      this.laserCool = 0;
      this.skin = meta.skin|0;
      this.trail = []; // flying effect
      this.controls = controls;
    }
    get rect() { return { x: this.x - this.w/2, y: this.y - this.h/2, w: this.w, h: this.h }; }
    shootPrimary() {
      const fireDelay = 0.25 * (1 - Math.min(0.7, meta.fireRateLevel * 0.08));
      if (this.cool > 0) return;
      this.cool = fireDelay;
      const dmg = 12 + meta.bulletDamageLevel * 3;
      bullets.push(new Bullet(this.x, this.y-16, 0, -600, 4.5, dmg, true, 'bullet'));
      // little muzzle flash particles? we keep simple
      if (window.audio && audio.sfx) audio.sfx('playerShot', { vol: 0.9 });
    }
    shootMissile() {
      if (!meta.missileUnlocked) return;
      const delay = Math.max(0.6, 1.35 - meta.missileLevel * 0.12);
      if (this.missileCool > 0) return;
      this.missileCool = delay;
      const dmg = 28 + meta.missileLevel * 10;
      bullets.push(new Bullet(this.x, this.y-18, 0, -400, 5.2, dmg, true, 'missile'));
      if (window.audio && audio.sfx) audio.sfx('missileShot', { vol: 1.0 });
    }
    shootLaser() {
      if (!meta.laserUnlocked) return;
      const delay = Math.max(0.5, 1.2 - meta.laserLevel * 0.1);
      if (this.laserCool > 0) return;
      this.laserCool = delay;
      const dmg = 22 + meta.laserLevel * 7;
      bullets.push(new Bullet(this.x, this.y-18, 0, -820, 2.5, dmg, true, 'laser-beam'));
      if (window.audio && audio.sfx) audio.sfx('laserShot', { vol: 0.9 });
    }
    damage(amount) {
      if (!this.alive) return;
      this.hp -= amount;
      if (window.audio && audio.sfx) audio.sfx('playerHit', { vol: 0.8 });
      if (this.hp <= 0) {
        this.hp = 0;
        this.alive = false;
        spawnExplosion(this.x, this.y, 'medium');
      }
    }
    update(dt) {
      // cooldowns
      this.cool -= dt; if (this.cool < 0) this.cool = 0;
      this.missileCool -= dt; if (this.missileCool < 0) this.missileCool = 0;
      this.laserCool -= dt; if (this.laserCool < 0) this.laserCool = 0;

      if (!this.alive || state !== 'playing') return;

      // control map
      let up=false, dn=false, lf=false, rt=false, fire=false, miss=false, las=false;
      if (this.controls === 'wasd') {
        up = keys['KeyW'] || keys['ArrowUp'];
        dn = keys['KeyS'] || keys['ArrowDown'];
        lf = keys['KeyA'] || keys['ArrowLeft'];
        rt = keys['KeyD'] || keys['ArrowRight'];
        fire = keys['Space'];
        miss = keys['ShiftLeft'] || keys['KeyX'];
        las = keys['KeyZ'] || keys['KeyC'];
      } else if (this.controls === 'arrows') {
        up = keys['ArrowUp'];
        dn = keys['ArrowDown'];
        lf = keys['ArrowLeft'];
        rt = keys['ArrowRight'];
        fire = keys['Numpad0'] || keys['Slash'] || keys['ControlRight'];
        miss = keys['Numpad1'] || keys['Period'];
        las = keys['Numpad2'] || keys['Quote'];
      }

      const sp = this.speed;
      this.vx = (rt?1:0) - (lf?1:0);
      this.vy = (dn?1:0) - (up?1:0);
      const l = Math.hypot(this.vx, this.vy);
      if (l > 0) {
        this.vx = this.vx / l * sp;
        this.vy = this.vy / l * sp;
      }

      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.x = clamp(this.x, 20, W-20);
      this.y = clamp(this.y, 40, H-40);

      // flying trail (store last positions)
      if ((this.vx !== 0 || this.vy !== 0) && (tNow % 2 < 1)) {
        this.trail.push({ x: this.x, y: this.y + 16, a: 0.6, r: 4 + Math.random()*2 });
        if (this.trail.length > 24) this.trail.shift();
      }
      for (const p of this.trail) p.a -= dt * 0.9;
      this.trail = this.trail.filter(p => p.a > 0.05);

      // fire controls
      if (fire) this.shootPrimary();
      if (miss) this.shootMissile();
      if (las) this.shootLaser();
    }
    draw(ctx) {
      // trail
      ctx.save();
      for (const p of this.trail) {
        ctx.globalAlpha = clamp(p.a, 0, 1);
        ctx.fillStyle = 'rgba(160,245,255,0.85)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();

      // ship
      ctx.save();
      ctx.translate(this.x, this.y);
      const skinColors = [
        ['#3ef', '#0ff'],
        ['#ff8a8a', '#ffd76a'],
        ['#a87aff', '#5ff'],
      ];
      const col = skinColors[this.skin % skinColors.length];
      ctx.fillStyle = col[0];
      ctx.shadowBlur = 12;
      ctx.shadowColor = col[1];
      ctx.beginPath();
      ctx.moveTo(0, -this.h/2);
      ctx.lineTo(this.w/2, this.h/2);
      ctx.lineTo(0, this.h/4);
      ctx.lineTo(-this.w/2, this.h/2);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // cockpit glow
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, -4, 4, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // HP bar
      ctx.translate(-this.w/2, -this.h/2 - 12);
      const hpw = this.w;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(0, 0, hpw, 4);
      ctx.fillStyle = '#6f8';
      ctx.fillRect(0, 0, hpw * (this.hp/this.hpMax), 4);
      ctx.restore();
    }
  }

  /* --------------------- Game State --------------------- */
  let state = 'menu'; // 'menu' | 'playing' | 'gameover'
  let gameOver = false;
  let tPrev = 0, tNow = 0;
  let players = [];
  let enemies = [];
  let bullets = [];
  let explosions = [];
  let spawnTimer = 0;
  let level = 1;
  let score = 0;

  function addPoints(n) {
    score += n;
    meta.points += Math.floor(n/2);
    saveMeta();
  }

  function spawnExplosion(x, y, size='small') {
    if (window.Explosion && Explosion.canSpawn && Explosion.canSpawn()) {
      explosions.push(new Explosion(x, y, size));
    }
    if (window.audio && audio.explosion) {
      try { audio.explosion(size); } catch {}
    }
  }

  /* --------------------- Spawner --------------------- */
  function spawnWave() {
    const n = 3 + level;
    for (let i=0; i<n; i++) {
      const x = 60 + (i/(n-1 || 1)) * (W-120);
      const y = -rand(40, 160) - i*6;
      const spd = 60 + level*6 + Math.random()*30;
      const hp = 16 + level*4;
      enemies.push(new Enemy(x, y, spd, hp));
    }
    level++;
  }

  /* --------------------- Collision --------------------- */
  function rectCircleCollide(rect, cx, cy, cr) {
    // clamp point to rect
    const rx = clamp(cx, rect.x, rect.x + rect.w);
    const ry = clamp(cy, rect.y, rect.y + rect.h);
    const dx = cx - rx, dy = cy - ry;
    return (dx*dx + dy*dy) <= cr*cr;
  }

  /* --------------------- Drawing BG --------------------- */
  const stars = [];
  for (let i=0; i<160; i++) {
    stars.push({ x: Math.random()*W, y: Math.random()*H, sp: rand(10, 60), r: Math.random()*1.8 + 0.4 });
  }
  function drawBG(dt) {
    ctx.clearRect(0, 0, W, H);
    // space gradient according to map
    const maps = [
      ['#06041a', '#010104'],
      ['#051018', '#00001a'],
      ['#130018', '#070010'],
    ];
    const m = maps[meta.map % maps.length];
    const grd = ctx.createLinearGradient(0,0,0,H);
    grd.addColorStop(0, m[0]);
    grd.addColorStop(1, m[1]);
    ctx.fillStyle = grd;
    ctx.fillRect(0,0,W,H);

    // starfield
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (const s of stars) {
      s.y += s.sp * dt * 0.5;
      if (s.y > H) { s.y = -8; s.x = Math.random()*W; s.sp = rand(10,60); }
      ctx.globalAlpha = 0.5 + 0.5*Math.random();
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* --------------------- UI Update --------------------- */
  function updateHUD() {
    if (ui) {
      ui.innerHTML = `Score: ${score} &nbsp;|&nbsp; Level: ${level} &nbsp;|&nbsp; Enemies: ${enemies.length}`;
    }
    if (hudPlayers) {
      hudPlayers.innerHTML = players.map(p => {
        const tag = (p.id === 1 ? 'P1' : 'P2');
        const st = p.alive ? `HP ${Math.ceil(p.hp)}/${p.hpMax}` : `<span style="color:#f77">DOWN</span>`;
        return `<div>${tag}: ${st}</div>`;
      }).join('');
    }
    if (credits && credits.childElementCount === 0) {
      credits.innerHTML = `Neon Shooter &middot; Build ${new Date().toLocaleDateString()}<br/>LMB: none &nbsp; Space: Fire &nbsp; Z/C: Laser &nbsp; Shift/X: Missile`;
    }
  }

  /* --------------------- Game Control --------------------- */
  function startGame() {
    // read mode
    const mode = (document.querySelector('input[name="mode"]:checked')?.value) || 'single';
    const coop = mode === 'coop';

    // reset
    gameOver = false;
    state = 'playing';
    level = 1;
    score = 0;
    players = [];
    enemies = [];
    bullets = [];
    explosions = [];
    spawnTimer = 0;

    // spawn players
    players.push(new Player(1, W*0.5, H-90, 'wasd'));
    if (coop) {
      players.push(new Player(2, W*0.5 + 60, H-90, 'arrows'));
    }

    // hide overlays
    if (menu) menu.style.display = 'none';
    if (gameOverScreen) gameOverScreen.style.display = 'none';
    document.body.classList.add('playing');

    // audio
    if (window.audio && audio.toGame) audio.toGame();
  }

  function setGameOver() {
    if (gameOver) return;
    gameOver = true;
    state = 'gameover';

    // Stop all enemy fire: clear bullets & enemies cooldowns
    bullets.length = 0;
    // Optional: stop spawning new enemies by resetting timer high
    spawnTimer = 9999;

    // Show Game Over overlay with Menu button
    if (gameOverScreen) gameOverScreen.style.display = 'flex';
    if (window.audio && audio.toMenu) audio.toMenu();
  }

  function returnToMenu() {
    // Cleanup all
    state = 'menu';
    gameOver = false;
    players = [];
    enemies = [];
    bullets = [];
    explosions = [];
    spawnTimer = 0;
    document.body.classList.remove('playing');
    if (menu) menu.style.display = 'flex';
    if (gameOverScreen) gameOverScreen.style.display = 'none';
    if (window.audio && audio.ensureMenu) audio.ensureMenu();
  }
  // Export for HTML button
  window.returnToMenu = returnToMenu;

  /* --------------------- Main Loop --------------------- */
  function update(dt) {
    if (state === 'playing') {
      // Spawner
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnWave();
        spawnTimer = Math.max(4.5 - level*0.15, 2.2);
      }

      // Update players
      for (const p of players) p.update(dt);

      // Update enemies
      for (const e of enemies) e.update(dt);

      // Update bullets
      for (const b of bullets) b.update(dt);

      // Collisions: player bullets -> enemies
      for (const b of bullets) {
        if (!b.alive || !b.friendly) continue;
        for (const e of enemies) {
          if (!e.alive) continue;
          if (rectCircleCollide(e.rect, b.x, b.y, b.r)) {
            e.hit(b.dmg);
            b.alive = false;
            break;
          }
        }
      }

      // Collisions: enemy bullets -> players
      for (const b of bullets) {
        if (!b.alive || b.friendly) continue;
        for (const p of players) {
          if (!p.alive) continue;
          if (rectCircleCollide(p.rect, b.x, b.y, b.r)) {
            p.damage(b.dmg);
            b.alive = false;
            break;
          }
        }
      }

      // Enemy body collide with players (ram)
      for (const e of enemies) {
        if (!e.alive) continue;
        for (const p of players) {
          if (!p.alive) continue;
          const r = p.rect;
          const er = e.rect;
          const hit = !(er.x+er.w<r.x || er.x>r.x+r.w || er.y+er.h<r.y || er.y>r.y+r.h);
          if (hit) {
            p.damage(35);
            e.die();
          }
        }
      }

      // Cleanup dead bullets/enemies
      bullets = bullets.filter(b => b.alive);
      enemies = enemies.filter(e => e.alive);

      // Update explosions
      for (const ex of explosions) ex.update(dt);
      explosions = explosions.filter(ex => ex.alive);

      // Check game over (all players down)
      if (players.length && players.every(p => !p.alive)) {
        setGameOver();
      }
    } else {
      // menu or gameover -> only update some background/explosions
      for (const ex of explosions) ex.update(dt);
      explosions = explosions.filter(ex => ex.alive);
    }

    updateHUD();
  }

  function draw() {
    const dt = delta;
    drawBG(dt);

    // Draw entities
    if (state !== 'menu') {
      // enemies
      for (const e of enemies) e.draw(ctx);
      // bullets
      for (const b of bullets) b.draw(ctx);
      // players
      for (const p of players) p.draw(ctx);
      // explosions
      for (const ex of explosions) ex.draw(ctx);
    }
  }

  let delta = 0;
  function loop(ts) {
    if (!tPrev) tPrev = ts;
    tNow = ts/16.666; // used for occasional timings
    delta = Math.min(0.05, (ts - tPrev) / 1000); // cap dt to 50ms
    tPrev = ts;

    update(delta);
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* --------------------- Wire up Buttons --------------------- */
  startBtn && startBtn.addEventListener('click', () => {
    startGame();
  });
  restartBtn && restartBtn.addEventListener('click', () => {
    startGame();
  });
  menuBtn && menuBtn.addEventListener('click', () => {
    returnToMenu();
  });
  tutorialBtn && tutorialBtn.addEventListener('click', () => {
    notify('Di chuyển: WASD/Phím mũi tên • Bắn: Space • Missile: Shift/X • Laser: Z/C');
  });

  /* --------------------- Keyboard Shortcuts --------------------- */
  window.addEventListener('keydown', (e) => {
    if (state === 'gameover' && e.code === 'KeyM') {
      returnToMenu();
    } else if (state === 'gameover' && e.code === 'KeyR') {
      startGame();
    }
  });

  // Ensure menu BGM at first
  if (window.audio && audio.ensureMenu) audio.ensureMenu();

  // Update points text once on load
  saveMeta();
})();
