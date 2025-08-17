// main_fixed_final.js
// Neon Shooter - full file (based on your original main.js) with a small safety guard

if (window.__NeonShooterInitialized) {
  console.warn('Neon Shooter already initialized - skipping duplicate load.');
} else {
  window.__NeonShooterInitialized = true;

  (function () {
    // ---------- Helpers ----------
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const rand = (a, b) => Math.random() * (b - a) + a;
    const randInt = (a, b) => Math.floor(rand(a, b + 1));
    const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
    const lerp = (a, b, t) => a + (b - a) * t;

    function onReady(fn) {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
      else fn();
    }

    onReady(init);

    // ---------- main ----------
    function init() {
      /* ---------- Setup canvas & simple UI helpers ---------- */
      const canvas = document.getElementById('c');
      if (!canvas) {
        console.error('[NeonShooter] #c (canvas) not found');
        return;
      }
      const ctx = canvas.getContext('2d', { alpha: false });
      let W = (canvas.width = innerWidth), H = (canvas.height = innerHeight);
      window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

      // Optional UI elements (may be null depending on your HTML)
      const UI = document.getElementById('ui');
      const hudPlayers = document.getElementById('hud-players');
      const hudScore = document.getElementById('hud-score');
      const menuEl = document.getElementById('menu');
      const overlayEl = document.getElementById('overlay');
      const startBtn = document.getElementById('startBtn');
      const restartBtn = document.getElementById('restartBtn');
      const tutorialBtn = document.getElementById('tutorialBtn');
      const btnFireRate = document.getElementById('upgradeFireRate');
      const btnDamage = document.getElementById('upgradeDamage');
      const btnUnlockMissile = document.getElementById('unlockMissile');
      const btnUpgradeMissile = document.getElementById('upgradeMissile');
      const btnUnlockLaser = document.getElementById('unlockLaser');
      const btnUpgradeLaser = document.getElementById('upgradeLaser');
      const modeRadios = Array.from(document.querySelectorAll('input[name="mode"]'));
      const skinSwatches = Array.from(document.querySelectorAll('.skin-swatch'));
      const mapThumbs = Array.from(document.querySelectorAll('.map-thumb'));

      // Helpers ẩn/hiện menu
      const HIDE = el => { if (el) el.classList.add('hidden'); };
      const SHOW = el => { if (el) el.classList.remove('hidden'); };

      // ---------- Game state & save ----------
      const STATE = { MENU: 'MENU', PLAYING: 'PLAYING', PAUSED: 'PAUSED', GAMEOVER: 'GAMEOVER' };
      let gameState = STATE.MENU;

      const SAVE_KEY = 'neon_shooter_save_v3';
      const defaultSave = {
        totalPoints: 0,
        upgrades: {
          fireRateLevel: 0,
          bulletDamageLevel: 0,
          missileUnlocked: false,
          missileLevel: 0,
          laserUnlocked: false,
          laserLevel: 0
        },
        lastSkin: 0, lastMap: 0, lastMode: 'single'
      };
      let save = loadSave();
      function loadSave() {
        try {
          const raw = localStorage.getItem(SAVE_KEY);
          if (!raw) return structuredClone(defaultSave);
          const data = JSON.parse(raw);
          return Object.assign(structuredClone(defaultSave), data);
        } catch (e) { return structuredClone(defaultSave); }
      }
      function saveSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }

      // ---------- Input ----------
      const keys = {};
      const mouse = { x: W / 2, y: H / 2, down: false, rightDown: false };
      window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
      window.addEventListener('mousedown', e => { if (e.button === 0) mouse.down = true; if (e.button === 2) mouse.rightDown = true; });
      window.addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; if (e.button === 2) mouse.rightDown = false; });
      window.addEventListener('contextmenu', e => { e.preventDefault(); }); // allow right click usage
      window.addEventListener('keydown', e => {
        const k = e.key.toLowerCase(); keys[k] = true;
        if (k === 'p') gameState = (gameState === STATE.PLAYING) ? STATE.PAUSED : (gameState === STATE.PAUSED) ? STATE.PLAYING : gameState;
        if (k === 'r' && gameState !== STATE.MENU) restartRun();
        if (k === 'e') players.forEach(p => p.tryFireMissile && p.tryFireMissile());
      });
      window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
      window.addEventListener('blur', () => { mouse.down = false; mouse.rightDown = false; });

      // ---------- Visual helpers ----------
      function neon(ctx, color, blur = 20) { ctx.shadowBlur = blur; ctx.shadowColor = color; }
      function resetNeon(ctx) { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }

      // ---------- audio-safe wrappers ----------
      function sfx(name, opts) { try { if (window.audio && audio.sfx) audio.sfx(name, opts); } catch (e) { } }
      function explosionSfx(sz) { try { if (window.audio && audio.explosion) audio.explosion(sz); } catch (e) { } }
      function toGameMusic() { try { if (window.audio && audio.toGame) audio.toGame(); } catch (e) { } }
      function toMenuMusic() { try { if (window.audio && audio.toMenu) audio.toMenu(); } catch (e) { } }

      // ---------- Collections ----------
      let players = [], bullets = [], missiles = [], enemies = [], explosions = [];
      let enemySpawnT = 0, score = 0;

      // ---------- Explosion ----------
      class Explosion {
        constructor(x, y, size = 'small', baseColor = '#ffb36c') {
          this.x = x; this.y = y; this.size = size; this.base = baseColor;
          const base = size === 'big' ? 28 : size === 'medium' ? 18 : 10;
          const count = size === 'big' ? 52 : size === 'medium' ? 30 : 16;
          this.particles = [];
          for (let i = 0; i < count; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = rand(0.2, 1.0) * base * rand(8, 16);
            this.particles.push({
              x: x, y: y,
              vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
              r: Math.random() * (base * 0.14) + base * 0.08,
              a: 1, col: ['#ffd27a', '#ff8c8c', '#88e1ff', '#ffd6ff'][Math.floor(Math.random() * 4)]
            });
          }
          this.t = 0;
          this.fade = size === 'big' ? 2.2 : size === 'medium' ? 1.5 : 1.0;
          this.shock = { r: 6, a: 0.8 };
        }
        update(dt = 1 / 60) {
          this.t += dt;
          for (let p of this.particles) {
            p.vy += 10 * dt;
            p.x += p.vx * dt; p.y += p.vy * dt;
            p.a = Math.max(0, 1 - (this.t / this.fade));
            p.r *= 0.99;
          }
          this.particles = this.particles.filter(p => p.a > 0.03 && p.r > 0.4);
          this.shock.r += 220 * dt;
          this.shock.a = Math.max(0, 0.8 - (this.t / this.fade));
        }
        draw(ctx) {
          if (!this.particles.length && this.shock.a <= 0) return;
          ctx.save();
          if (this.shock.a > 0) {
            ctx.globalAlpha = this.shock.a * 0.6;
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.lineWidth = 10;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.shock.r, 0, Math.PI * 2); ctx.stroke();
          }
          for (let p of this.particles) {
            ctx.globalAlpha = Math.max(0, p.a);
            neon(ctx, p.col, 16);
            ctx.fillStyle = p.col;
            ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, p.r), 0, Math.PI * 2); ctx.fill();
            resetNeon(ctx);
          }
          ctx.restore();
        }
      }

      // ---------- Starfield ----------
      class Starfield {
        constructor() { this.layers = []; this.reset(0); }
        reset(mapIdx = 0) {
          this.layers = [];
          for (let l = 0; l < 3; l++) {
            const arr = [];
            const count = ((mapIdx === 2) ? 140 : mapIdx === 1 ? 120 : 100) * (l + 1);
            for (let i = 0; i < count; i++) arr.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * (l + 1) * 0.7 + 0.3, v: (l + 1) * (mapIdx === 2 ? 0.7 : 0.5) });
            this.layers.push(arr);
          }
        }
        update(dt, active) {
          const drift = active ? 1 : 0.2;
          for (let l = 0; l < this.layers.length; l++) {
            for (let st of this.layers[l]) {
              st.y += st.v * 60 * dt * drift;
              if (st.y > H) { st.y = 0; st.x = Math.random() * W; }
            }
          }
        }
        draw(ctx, mapIdx = 0) {
          if (mapIdx === 0) ctx.fillStyle = '#070012';
          else if (mapIdx === 1) ctx.fillStyle = '#0a0010';
          else ctx.fillStyle = '#00111f';
          ctx.fillRect(0, 0, W, H);
          ctx.save();
          ctx.fillStyle = '#ffffff';
          for (let l = 0; l < this.layers.length; l++) {
            for (let st of this.layers[l]) {
              ctx.globalAlpha = clamp(0.25 + st.s * 0.25, 0.15, 0.9);
              ctx.fillRect(st.x, st.y, st.s, st.s);
            }
          }
          ctx.restore();
        }
      }
      const starfield = new Starfield();

      // ---------- Bullet ----------
      class Bullet {
        constructor(x, y, vx, vy, dmg = 10, owner = 'player') {
          this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.dmg = dmg; this.owner = owner;
          this.r = 3; this.alive = true; this.trail = [];
        }
        update(dt) {
          this.x += this.vx * dt; this.y += this.vy * dt;
          this.trail.push({ x: this.x, y: this.y, a: 1 });
          if (this.trail.length > 12) this.trail.shift();
          for (let t of this.trail) t.a -= dt * 6;
          if (this.x < -40 || this.x > W + 40 || this.y < -40 || this.y > H + 40) this.alive = false;
        }
        draw(ctx) {
          ctx.save();
          // trail
          for (let i = 0; i < this.trail.length; i++) {
            const t = this.trail[i];
            ctx.globalAlpha = clamp(t.a, 0, 1) * 0.7;
            neon(ctx, '#9fe6ff', 16);
            ctx.beginPath(); ctx.arc(t.x, t.y, (this.r * 1.8) * (i / this.trail.length + 0.1), 0, Math.PI * 2);
            ctx.fillStyle = '#9fe6ff'; ctx.fill();
            resetNeon(ctx);
          }
          // head
          neon(ctx, '#e6ffff', 20);
          ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fillStyle = '#bff'; ctx.fill();
          resetNeon(ctx);
          ctx.restore();
        }
      }

      // ---------- Missile ----------
      class Missile {
        constructor(x, y, angle, speed = 360, dmg = 64, radius = 74) {
          this.x = x; this.y = y; this.angle = angle; this.speed = speed; this.dmg = dmg; this.radius = radius;
          this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
          this.turnRate = 3.0; this.target = null; this.trail = []; this.alive = true;
          this.t = 0;
        }
        findTarget(enemies) {
          if (!enemies.length) return null;
          let best = null, bestD = 1e9;
          for (let e of enemies) { if (!e.alive) continue; const d = dist(this.x, this.y, e.x, e.y); if (d < bestD) { best = e; bestD = d; } }
          this.target = best;
        }
        update(dt, enemies) {
          this.t += dt;
          if (!this.target || !this.target.alive) this.findTarget(enemies);
          if (this.target) {
            const desired = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            let diff = desired - this.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.angle += clamp(diff, -this.turnRate * dt, this.turnRate * dt);
            const spd = this.speed;
            this.vx = Math.cos(this.angle) * spd; this.vy = Math.sin(this.angle) * spd;
          }
          this.x += this.vx * dt; this.y += this.vy * dt;

          // trail
          this.trail.push({ x: this.x, y: this.y, a: 1, r: rand(2.0, 4.5), t: this.t });
          if (this.trail.length > 28) this.trail.shift();
          for (let t of this.trail) t.a -= dt * 1.4;

          // proximity detonate
          for (let e of enemies) {
            if (!e.alive) continue;
            if (dist(this.x, this.y, e.x, e.y) <= Math.max(20, e.r + 6)) {
              this.explode(enemies);
              return;
            }
          }
          if (this.x < -80 || this.x > W + 80 || this.y < -80 || this.y > H + 80) this.alive = false;
        }
        explode(enemies) {
          this.alive = false;
          explosions.push(new Explosion(this.x, this.y, 'medium', '#ffd88c'));
          explosionSfx('medium');
          for (let e of enemies) {
            if (!e.alive) continue;
            const d = dist(this.x, this.y, e.x, e.y);
            if (d <= this.radius) e.hit(this.dmg * (1 - d / this.radius));
          }
        }
        draw(ctx) {
          ctx.save();
          // trail smoke
          for (let i = 0; i < this.trail.length; i++) {
            const t = this.trail[i];
            ctx.globalAlpha = clamp(t.a, 0, 1) * 0.5;
            neon(ctx, 'rgba(255,150,70,0.9)', 12);
            ctx.beginPath(); ctx.arc(t.x, t.y, t.r + i * 0.08, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,160,80,0.9)'; ctx.fill();
            resetNeon(ctx);
          }
          // missile body
          ctx.translate(this.x, this.y);
          ctx.rotate(this.angle);
          neon(ctx, 'rgba(255,210,140,0.95)', 18);
          ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-8, -4); ctx.lineTo(-8, 4); ctx.closePath();
          ctx.fillStyle = '#ffd6a8'; ctx.fill();
          resetNeon(ctx);
          ctx.restore();
        }
      }

      // ---------- LaserBeam ----------
      class LaserBeam {
        constructor(owner, width, duration, tickInterval, dps) {
          this.owner = owner; this.width = width; this.duration = duration; this.timer = 0;
          this.tickInterval = tickInterval; this.tickTimer = 0; this.dps = dps; this.active = true;
        }
        update(dt, enemies) {
          this.timer += dt; this.tickTimer += dt;
          if (this.timer >= this.duration) { this.active = false; return; }
          if (this.tickTimer >= this.tickInterval) {
            this.tickTimer = 0;
            const x = this.owner.x;
            for (let e of enemies) {
              if (!e.alive) continue;
              if (Math.abs(e.x - x) <= this.width / 2 + e.r && e.y < this.owner.y) {
                e.hit(this.dps * this.tickInterval);
                explosions.push(new Explosion(e.x, e.y, 'small', '#88e1ff'));
              }
            }
            sfx('laserShot', { vol: 0.6 });
          }
        }
        draw(ctx) {
          const x = this.owner.x;
          ctx.save();
          const grad = ctx.createLinearGradient(x, 0, x, H);
          grad.addColorStop(0, 'rgba(150,220,255,0.0)');
          grad.addColorStop(0.2, 'rgba(150,220,255,0.12)');
          grad.addColorStop(0.6, 'rgba(150,220,255,0.22)');
          grad.addColorStop(1, 'rgba(150,220,255,0.0)');
          ctx.fillStyle = grad;
          ctx.fillRect(x - this.width / 2, 0, this.width, this.owner.y);
          ctx.strokeStyle = 'rgba(180,255,255,0.7)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x - this.width / 2, 0); ctx.lineTo(x - this.width / 2, this.owner.y);
          ctx.moveTo(x + this.width / 2, 0); ctx.lineTo(x + this.width / 2, this.owner.y);
          ctx.stroke();
          ctx.restore();
        }
      }

      // ---------- Enemy ----------
      class Enemy {
        constructor(x, y, type = 'wander') {
          this.x = x; this.y = y; this.type = type;
          this.r = type === 'chaser' ? 16 : type === 'wave' ? 14 : 12;
          this.alive = true; this.hp = type === 'chaser' ? 90 : type === 'wave' ? 56 : 34;
          this.speed = type === 'chaser' ? rand(84, 120) : rand(40, 90);
          const ang = rand(0, Math.PI * 2);
          this.vx = Math.cos(ang) * this.speed * rand(0.4, 1.0); this.vy = Math.sin(ang) * this.speed * rand(0.1, 0.6);
          this.timer = rand(0, 10); this.phase = rand(0, Math.PI * 2);
          this.color = type === 'chaser' ? '#ff9a9a' : type === 'wave' ? '#9fe6ff' : '#b8ffb8';
        }
        hit(dmg) {
          this.hp -= dmg; sfx('enemyHit', { vol: 0.6 });
          if (this.hp <= 0) {
            this.alive = false; explosions.push(new Explosion(this.x, this.y, 'small', '#ff8c8c')); explosionSfx('small'); addPoints(25);
          } else {
            explosions.push(new Explosion(this.x + rand(-4, 4), this.y + rand(-4, 4), 'small', '#ffe8e8'));
          }
        }
        update(dt) {
          this.timer += dt;
          if (this.type === 'wander') {
            if (Math.random() < 0.008) { this.vx += rand(-1, 1) * 40; this.vy += rand(-1, 1) * 40; }
            const sp = Math.hypot(this.vx, this.vy) || 1; this.vx = this.vx / sp * this.speed; this.vy = this.vy / sp * this.speed;
          } else if (this.type === 'wave') {
            this.vx = Math.cos(this.timer * 1.6 + this.phase) * 40;
            this.vy = this.speed * 0.6 + Math.sin(this.timer * 0.8 + this.phase) * 20;
          } else if (this.type === 'chaser') {
            let best = null, bd = 1e9;
            for (let p of players) { if (!p.alive) continue; const d = dist(this.x, this.y, p.x, p.y); if (d < bd) { bd = d; best = p; } }
            if (best) {
              const ang = Math.atan2(best.y - this.y, best.x - this.x);
              this.vx = Math.cos(ang) * this.speed; this.vy = Math.sin(ang) * this.speed;
            }
          }
          this.x += this.vx * dt; this.y += this.vy * dt;
          if (this.x < 18) { this.x = 18; this.vx *= -0.8; this.vy += rand(-40, 40); }
          if (this.x > W - 18) { this.x = W - 18; this.vx *= -0.8; this.vy += rand(-40, 40); }
          if (this.y < 18) { this.y = 18; this.vy *= -0.8; this.vx += rand(-40, 40); }
          if (this.y > H + 60) this.alive = false;
        }
        draw(ctx) {
          ctx.save();
          ctx.translate(this.x, this.y);
          neon(ctx, this.type === 'chaser' ? 'rgba(255,140,140,0.95)' : this.type === 'wave' ? 'rgba(150,230,255,0.9)' : 'rgba(150,255,180,0.9)', 12);
          ctx.beginPath(); ctx.arc(0, 0, this.r, 0, Math.PI * 2); ctx.fillStyle = this.color; ctx.fill();
          resetNeon(ctx);
          ctx.restore();
        }
      }

      // ---------- Player ----------
      class Player {
        constructor(id = 1, skin = 0, isCoop = false) {
          this.id = id; this.skin = skin; this.isCoop = isCoop;
          this.x = W / 2 + (id === 2 ? 80 : -80); this.y = H - 130;
          this.vx = 0; this.vy = 0; this.speed = 480;
          this.angle = 0;

          this.bulletBaseCD = 0.12; this.bulletCD = 0; this.bulletSpeed = 920;
          this.bulletDamage = 10 + (save.upgrades.bulletDamageLevel || 0) * 6;
          const frLv = save.upgrades.fireRateLevel || 0;
          this.bulletCDbase = Math.max(0.05, this.bulletBaseCD - frLv * 0.02);

          this.missileUnlocked = !!save.upgrades.missileUnlocked;
          const mLv = save.upgrades.missileLevel || 0;
          this.missileCDbase = Math.max(0.4, 1.6 - mLv * 0.15);
          this.missileSpeed = 320 + mLv * 30;
          this.missileRadius = 70 + mLv * 8;
          this.missileDmg = 28 + mLv * 10;
          this.missileCD = 0;

          this.laserUnlocked = !!save.upgrades.laserUnlocked;
          const lLv = save.upgrades.laserLevel || 0;
          this.laserCDbase = Math.max(0.7, 5.0 - lLv * 0.5);
          this.laserWidth = 36 + lLv * 8;
          this.laserDuration = 0.9 + lLv * 0.25;
          this.laserTick = 0.1;
          this.laserDPS = 140 + lLv * 30;
          this.laserCD = 0; this.activeLaser = null;

          this.hp = 120; this.alive = true; this.invul = 0;
          this.trail = [];
        }

        tryFireMissile() {
          if (!this.missileUnlocked) return;
          if (this.missileCD <= 0) {
            this.missileCD = this.missileCDbase;
            const ang = Math.atan2(mouse.y - this.y, mouse.x - this.x);
            missiles.push(new Missile(this.x + Math.cos(ang) * 18, this.y + Math.sin(ang) * 18, ang, this.missileSpeed, this.missileDmg, this.missileRadius));
            sfx('missileShot', { vol: 0.9 });
          }
        }

        hit(dmg) {
          if (this.invul > 0) return;
          this.hp -= dmg; this.invul = 0.5;
          sfx('playerHit', { vol: 0.85 });
          explosions.push(new Explosion(this.x, this.y, 'small', '#9fe6ff'));
          if (this.hp <= 0) this.alive = false;
        }

        update(dt, bulletsList, missilesList, enemiesList) {
          if (!this.alive) return;
          // smooth follow cursor
          const tx = mouse.x, ty = mouse.y;
          const ax = tx - this.x, ay = ty - this.y;
          const d = Math.hypot(ax, ay) || 1;
          const desiredVx = (ax / d) * this.speed;
          const desiredVy = (ay / d) * this.speed;
          this.vx = lerp(this.vx, desiredVx, clamp(dt * 6, 0, 1));
          this.vy = lerp(this.vy, desiredVy, clamp(dt * 6, 0, 1));
          this.x += this.vx * dt; this.y += this.vy * dt;
          this.x = clamp(this.x, 24, W - 24); this.y = clamp(this.y, 64, H - 24);
          this.angle = Math.atan2(ty - this.y, tx - this.x);

          // engine trail
          this.trail.push({ x: this.x - Math.cos(this.angle) * 12 + rand(-4, 4), y: this.y - Math.sin(this.angle) * 12 + rand(-4, 4), a: 1, r: rand(3, 7) });
          if (this.trail.length > 28) this.trail.shift();
          for (let t of this.trail) t.a -= dt * 1.6;

          // timers
          this.bulletCD -= dt; this.missileCD -= dt; this.laserCD -= dt; if (this.invul > 0) this.invul -= dt;

          // fire bullets (hold)
          if ((mouse.down || keys[' ']) && this.bulletCD <= 0) {
            this.bulletCD = this.bulletCDbase;
            const ang = Math.atan2(mouse.y - this.y, mouse.x - this.x);
            const vx = Math.cos(ang) * this.bulletSpeed;
            const vy = Math.sin(ang) * this.bulletSpeed;
            bullets.push(new Bullet(this.x + Math.cos(ang) * 18, this.y + Math.sin(ang) * 18, vx, vy, this.bulletDamage, 'player'));
            sfx('playerShot', { vol: 0.9 });
            explosions.push(new MuzzleFlash(this.x + Math.cos(ang) * 18, this.y + Math.sin(ang) * 18));
          }

          // right-click firing (missile)
          if (mouse.rightDown && this.missileCD <= 0 && this.missileUnlocked) {
            this.missileCD = this.missileCDbase;
            const ang = Math.atan2(mouse.y - this.y, mouse.x - this.x);
            missiles.push(new Missile(this.x + Math.cos(ang) * 18, this.y + Math.sin(ang) * 18, ang, this.missileSpeed, this.missileDmg, this.missileRadius));
            sfx('missileShot', { vol: 0.9 });
          }

          // laser
          if (this.laserUnlocked && (keys['q']) && this.laserCD <= 0 && !this.activeLaser) {
            this.laserCD = this.laserCDbase;
            this.activeLaser = new LaserBeam(this, this.laserWidth, this.laserDuration, this.laserTick, this.laserDPS);
          }
          if (this.activeLaser) {
            this.activeLaser.update(dt, enemiesList);
            if (!this.activeLaser.active) this.activeLaser = null;
          }
        }

        draw(ctx) {
          // engine trail
          ctx.save();
          for (let t of this.trail) {
            if (t.a <= 0) continue;
            ctx.globalAlpha = t.a * 0.8;
            neon(ctx, 'rgba(64,220,255,0.9)', 20);
            ctx.beginPath(); ctx.arc(t.x, t.y, t.r * (0.8 + t.a * 0.6), 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(20,200,255,0.9)'; ctx.fill();
            resetNeon(ctx);
          }
          ctx.restore();

          // ship
          ctx.save();
          ctx.translate(this.x, this.y);
          ctx.rotate(this.angle);
          neon(ctx, 'rgba(120,220,255,0.95)', 22);
          // body
          ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -10); ctx.lineTo(-6, 0); ctx.lineTo(-10, 10); ctx.closePath();
          ctx.fillStyle = 'rgba(160,240,255,0.96)'; ctx.fill();
          // cockpit
          ctx.beginPath(); ctx.arc(-2, 0, 4, 0, Math.PI * 2); ctx.fillStyle = 'rgba(30,40,160,0.9)'; ctx.fill();
          resetNeon(ctx);
          ctx.restore();

          if (this.activeLaser) this.activeLaser.draw(ctx);
        }
      }

      // muzzle flash
      class MuzzleFlash {
        constructor(x, y) { this.x = x; this.y = y; this.t = 0; this.life = 0.06; }
        update(dt) { this.t += dt; }
        draw(ctx) {
          const a = Math.max(0, 1 - this.t / this.life);
          if (a <= 0) return;
          ctx.save();
          neon(ctx, 'rgba(255,220,140,1)', 20);
          ctx.globalAlpha = a;
          ctx.beginPath(); ctx.arc(this.x, this.y, 6 + (1 - a) * 10, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,210,130,1)'; ctx.fill();
          resetNeon(ctx);
          ctx.restore();
        }
      }

      // ---------- Points & shop helpers ----------
      function addPoints(n) { score += n; save.totalPoints += n; saveSave(); updateShopButtons(); }
      const canSpend = c => save.totalPoints >= c;
      function spend(c) { if (!canSpend(c)) return false; save.totalPoints -= c; saveSave(); updateShopButtons(); return true; }

      function updateShopButtons() {
        const u = save.upgrades || (save.upgrades = structuredClone(defaultSave.upgrades));
        if (btnFireRate) btnFireRate.textContent = `Fire Rate + (500) — Lv ${u.fireRateLevel}`;
        if (btnDamage) btnDamage.textContent = `Bullet Damage + (1000) — Lv ${u.bulletDamageLevel}`;
        if (btnUnlockMissile) btnUnlockMissile.textContent = `Unlock Missile (2000) ${u.missileUnlocked ? '✓' : ''}`;
        if (btnUpgradeMissile) btnUpgradeMissile.textContent = `Upgrade Missile (1500) — Lv ${u.missileLevel}`;
        if (btnUnlockLaser) btnUnlockLaser.textContent = `Unlock Laser (5000) ${u.laserUnlocked ? '✓' : ''}`;
        if (btnUpgradeLaser) btnUpgradeLaser.textContent = `Upgrade Laser (3000) — Lv ${u.laserLevel}`;
        if (btnFireRate) btnFireRate.disabled = !canSpend(500);
        if (btnDamage) btnDamage.disabled = !canSpend(1000);
        if (btnUnlockMissile) btnUnlockMissile.disabled = u.missileUnlocked || !canSpend(2000);
        if (btnUpgradeMissile) btnUpgradeMissile.disabled = !u.missileUnlocked || !canSpend(1500);
        if (btnUnlockLaser) btnUnlockLaser.disabled = u.laserUnlocked || !canSpend(5000);
        if (btnUpgradeLaser) btnUpgradeLaser.disabled = !u.laserUnlocked || !canSpend(3000);
        const credits = document.getElementById('credits');
        if (credits) credits.textContent = `Neon Shooter • Points: ${save.totalPoints} • P pause • R restart`;
      }

      // ---------- selections UI ----------
      let selectedSkin = save.lastSkin || 0;
      let selectedMap = save.lastMap || 0;
      let selectedMode = save.lastMode || 'single';

      // safe toggles only if elements exist
      skinSwatches.forEach(s => s.classList.toggle('sel', (parseInt(s.dataset.skin || '0', 10) === selectedSkin)));
      mapThumbs.forEach(m => m.classList.toggle('sel', (parseInt(m.dataset.map || '0', 10) === selectedMap)));
      modeRadios.forEach(r => r.checked = (r.value === selectedMode));
      modeRadios.forEach(r => r.addEventListener('change', () => { if (r.checked) { selectedMode = r.value; save.lastMode = selectedMode; saveSave(); } }));
      skinSwatches.forEach(sw => sw.addEventListener('click', () => { skinSwatches.forEach(s => s.classList.remove('sel')); sw.classList.add('sel'); selectedSkin = parseInt(sw.dataset.skin || '0', 10); save.lastSkin = selectedSkin; saveSave(); }));
      mapThumbs.forEach(m => m.addEventListener('click', () => { mapThumbs.forEach(s => s.classList.remove('sel')); m.classList.add('sel'); selectedMap = parseInt(m.dataset.map || '0', 10); save.lastMap = selectedMap; saveSave(); starfield.reset(selectedMap); }));

      // shop events
      btnFireRate && btnFireRate.addEventListener('click', () => { if (spend(500)) { save.upgrades.fireRateLevel++; saveSave(); updateShopButtons(); } });
      btnDamage && btnDamage.addEventListener('click', () => { if (spend(1000)) { save.upgrades.bulletDamageLevel++; saveSave(); updateShopButtons(); } });
      btnUnlockMissile && btnUnlockMissile.addEventListener('click', () => { if (!save.upgrades.missileUnlocked && spend(2000)) { save.upgrades.missileUnlocked = true; saveSave(); updateShopButtons(); } });
      btnUpgradeMissile && btnUpgradeMissile.addEventListener('click', () => { if (save.upgrades.missileUnlocked && spend(1500)) { save.upgrades.missileLevel++; saveSave(); updateShopButtons(); } });
      btnUnlockLaser && btnUnlockLaser.addEventListener('click', () => { if (!save.upgrades.laserUnlocked && spend(5000)) { save.upgrades.laserUnlocked = true; saveSave(); updateShopButtons(); } });
      btnUpgradeLaser && btnUpgradeLaser.addEventListener('click', () => { if (save.upgrades.laserUnlocked && spend(3000)) { save.upgrades.laserLevel++; saveSave(); updateShopButtons(); } });

      // start/restart UI
      startBtn && startBtn.addEventListener('click', async () => {
        if (window.audio && audio.unlock) { try { await audio.unlock(); audio.ensureMenu && audio.ensureMenu(); audio.toGame && audio.toGame(); } catch (e) { } }
        startRun();
      });
      restartBtn && restartBtn.addEventListener('click', () => {
        if (gameState === STATE.MENU) starfield.reset(selectedMap); else restartRun();
      });
      tutorialBtn && tutorialBtn.addEventListener('click', () => {
        alert(`Controls\nMove: mouse (smooth)\nHold left-mouse to shoot, right-mouse or E to fire missile, Q to laser.\nP pause • R restart\nShop uses Points.`);
      });

      // spawn from edges
      function spawnEnemyFromEdge() {
        const side = randInt(0, 3);
        let x, y;
        if (side === 0) { x = rand(30, W - 30); y = -40; }
        else if (side === 1) { x = W + 40; y = rand(40, H - 120); }
        else if (side === 2) { x = rand(30, W - 30); y = H + 40; }
        else { x = -40; y = rand(40, H - 120); }
        const t = Math.random();
        const type = t < 0.55 ? 'wander' : (t < 0.85 ? 'wave' : 'chaser');
        enemies.push(new Enemy(x, y, type));
      }

      // collisions
      function handleCollisions() {
        // bullets -> enemies
        for (let b of bullets) {
          if (!b.alive || b.owner !== 'player') continue;
          for (let e of enemies) {
            if (!e.alive) continue;
            if (dist(b.x, b.y, e.x, e.y) <= e.r + b.r) {
              e.hit(b.dmg);
              b.alive = false;
              explosions.push(new Explosion(b.x, b.y, 'small', '#ffd8ff'));
              sfx('explSmall', { vol: 0.7 });
              break;
            }
          }
        }
        // enemy collide player
        for (let e of enemies) {
          if (!e.alive) continue;
          for (let p of players) {
            if (!p.alive) continue;
            if (dist(e.x, e.y, p.x, p.y) <= e.r + 14) {
              p.hit(22);
              e.alive = false;
              explosions.push(new Explosion(e.x, e.y, 'small', '#ff8c8c'));
              explosionSfx('small');
            }
          }
        }
      }

      // HUD
      function drawHUD(ctx) {
        ctx.save();
        ctx.font = '13px monospace'; ctx.fillStyle = '#cfe'; ctx.textAlign = 'left';
        let y = 20;
        ctx.fillText(`Score: ${score}`, 12, y); y += 18;
        ctx.fillText(`Points: ${save.totalPoints}`, 12, y); y += 18;
        let i = 1;
        for (let p of players) { ctx.fillText(`P${i} HP: ${Math.max(0, Math.round(p.hp || 0))}`, 12, y); y += 18; i++; }
        ctx.textAlign = 'right'; ctx.fillText(`Map: ${selectedMap} • Mode: ${String(selectedMode || 'single').toUpperCase()}`, W - 12, 20);
        ctx.restore();
      }

      // start / restart
      function startRun() {
        players = [new Player(1, selectedSkin, selectedMode === 'coop')];
        if (selectedMode === 'coop') players.push(new Player(2, selectedSkin, true));
        bullets.length = missiles.length = enemies.length = explosions.length = 0;
        enemySpawnT = 0.6; score = 0;
        starfield.reset(selectedMap);
        gameState = STATE.PLAYING;
        HIDE(menuEl);
        toGameMusic();
      }
      try { window.startRun = startRun; } catch (e) { }

      function restartRun() {
        gameState = STATE.MENU;
        SHOW(menuEl);
        players.length = bullets.length = missiles.length = enemies.length = explosions.length = 0;
        enemySpawnT = 0; score = 0;
        starfield.reset(selectedMap);
        toMenuMusic();
        updateShopButtons();
      }

      // main loop
      let last = performance.now();
      function loop(now) {
        const dt = Math.min(0.033, (now - last) / 1000);
        last = now;

        starfield.update(dt, gameState === STATE.PLAYING);
        ctx.clearRect(0, 0, W, H);
        starfield.draw(ctx, selectedMap);

        if (gameState === STATE.PLAYING) {
          // spawn
          enemySpawnT -= dt;
          if (enemySpawnT <= 0) { enemySpawnT = rand(0.5, 1.1); spawnEnemyFromEdge(); }

          // update
          for (let p of players) p.update(dt, bullets, missiles, enemies);
          for (let b of bullets) b.update(dt);
          for (let m of missiles) m.update(dt, enemies);
          for (let e of enemies) e.update(dt);
          for (let ex of explosions) ex.update(dt);

          // collisions & cleanup
          handleCollisions();
          bullets = bullets.filter(b => b.alive);
          missiles = missiles.filter(m => m.alive);
          enemies = enemies.filter(e => e.alive);
          explosions = explosions.filter(ex => ex.particles?.length > 0 || ex.shock?.a > 0);

          // draw order
          for (let e of enemies) e.draw(ctx);
          for (let b of bullets) b.draw(ctx);
          for (let m of missiles) m.draw(ctx);
          for (let p of players) p.draw(ctx);
          for (let ex of explosions) ex.draw(ctx);

          // HUD and game over
          drawHUD(ctx);
          if (!players.some(p => p.alive)) {
            addPoints(Math.floor(score * 0.1));
            gameState = STATE.GAMEOVER;
            setTimeout(() => restartRun(), 1000);
          }
        } else {
          // menu overlay
          ctx.save();
          ctx.globalAlpha = 0.14;
          ctx.fillStyle = '#9ff';
          ctx.font = 'bold 48px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('NEON SHOOTER', W / 2, H * 0.42);
          ctx.restore();
        }

        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);

      // init UI
      (function initUI() {
        updateShopButtons();
        document.addEventListener('click', async function once() {
          document.removeEventListener('click', once, true);
          if (window.audio && audio.unlock) { try { await audio.unlock(); audio.ensureMenu && audio.ensureMenu(); } catch (e) { } }
        }, true);
        SHOW(menuEl); // show menu on load if exists
        gameState = STATE.MENU;
        starfield.reset(selectedMap);
      })();
    } // end init()

  })(); // end IIFE
} // end guard
