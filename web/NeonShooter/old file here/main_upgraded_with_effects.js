// ====== Neon Shooter - main_upgraded.js ======
// Optimized structure based on main_fixed_final.js but without auto-created menu
// Uses HTML menu from galaxyshooter.html

if (!window.__GalaxyShooterInitialized) {
    window.__GalaxyShooterInitialized = true;
    (function() {
        'use strict';

  // thêm vào đầu file trước bất kỳ đoạn code nào dùng tới save:
  const SAVE_KEY = 'neon_shooter_save_v3';
  function loadSave(){
    try{
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : { totalPoints:0 };
    }catch(e){ return { totalPoints:0 }; }
  }
  let save = loadSave();

// ----- Helpers -----
const clamp = (v,a,b)=> Math.max(a,Math.min(b,v));
const rand = (a,b)=> Math.random()*(b-a)+a;
const rnd  = (a,b)=> a + Math.random()*((b===undefined?0:b-a));
const dist = (x1,y1,x2,y2)=> Math.hypot(x2-x1,y2-y1);

/* ---------- Setup canvas ---------- */
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d',{ alpha: false });
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
window.addEventListener('resize', ()=>{ W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const UI = document.getElementById('ui');
const hudPlayers = document.getElementById('hud-players');
const menu = document.getElementById('menu');

let keys = {};
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

let mouse = { x: W/2, y: H/2, down:false };
canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', e => mouse.down = true);
canvas.addEventListener('mouseup', e => mouse.down = false);
canvas.addEventListener('contextmenu', e=>e.preventDefault());

/* Particles */
class Particle {
  constructor(x,y,vx,vy,size,life,clr,fade=true){ this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.size=size; this.life=life; this.max=life; this.clr=clr; this.fade=fade; }
  update(dt){ this.x += this.vx*dt; this.y += this.vy*dt; this.vx *= 0.998; this.vy += 0.002*dt; this.life -= dt; }
  draw(ctx){ const a = this.fade ? clamp(this.life/this.max,0,1) : 1; ctx.globalAlpha = a; ctx.fillStyle = this.clr; ctx.beginPath(); ctx.arc(this.x,this.y, this.size*a, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1; }
}
let particles = [];
function spawnParticles(x,y,color,count=12,spread=Math.PI, speed=0.8, size=3, life=0.8){
  for(let i=0;i<count;i++){ const a = rnd(-spread/2, spread/2) + rnd(0,Math.PI*2); const s = rnd(speed*0.2, speed); particles.push(new Particle(x,y, Math.cos(a)*s, Math.sin(a)*s, rnd(size*0.4,size), life, color)); }
}

/* Background layers per map */
const maps = [
  { name:'Neon City', bgHue: 190, grid:'#77f' },
  { name:'Crimson Rift', bgHue: 330, grid:'#f76' },
  { name:'Deep Ocean', bgHue: 210, grid:'#3cf' }
];
let selectedMap = 0;

const bgLayers = [];
function initBg(){
  bgLayers.length = 0;
  for(let i=0;i<4;i++){
    const layer = { stars: [], speed: 0.02 + i*0.02, blur:1 + i, hue: maps[selectedMap].bgHue - i*18 };
    for(let j=0;j<100 + i*50;j++){
      layer.stars.push({
        x: Math.random()*W*1.5 - W*0.25,
        y: Math.random()*H*1.2 - H*0.1,
        r: rnd(0.6, 2.8 - i*0.4),
        a: rnd(0.06, 0.35)
      });
    }
    bgLayers.push(layer);
  }
}
initBg();

/* Player structure - two players */
const players = [
  { id:0, x: W*0.5, y: H*0.7, vx:0, vy:0, speed: 420, size: 18, hp:120, maxHp:120, reload:0, fireRate:0.09, score:0, alive:true, skin:0, colorHue:190 },
  { id:1, x: W*0.4, y: H*0.8, vx:0, vy:0, speed: 380, size: 18, hp:120, maxHp:120, reload:0, fireRate:0.18, score:0, alive:true, skin:1, colorHue:320, aimDir:{x:1,y:0} }
];

let bullets = [];
let enemies = [];
let bosses = [];
let waveTime = 0;
let spawnInterval = 1.6;
let difficulty = 1;
let shake = 0;

/* Enemy */
class Enemy {
  constructor(x,y,type=0){
    this.x=x; this.y=y; this.vx=0; this.vy = 0.02 + Math.random()*0.1;
    this.size = 14 + Math.random()*12; this.hp = Math.round(8 + this.size); this.type = type; this.angle = 0; this.shootTimer = rnd(1.6,3.2); this.speedMultiplier = 1 + Math.random()*0.6; this.hue = maps[selectedMap].bgHue + 80 - Math.random()*160;
  }
  update(dt){
    this.angle += dt*0.2;
    this.y += (0.02 + Math.sin(this.angle*2+this.x*0.01)*0.02) * 200 * dt * this.speedMultiplier;
    this.x += Math.sin(this.y*0.01 + this.angle)*30*dt;
    this.shootTimer -= dt;
    if(this.shootTimer <= 0){
      this.shootTimer = rnd(2.0,4.0) / difficulty;
      const target = players[Math.random() < 0.5 ? 0 : 1];
      const dx = target.x - this.x, dy = target.y - this.y;
      const mag = Math.hypot(dx,dy) || 1;
      bullets.push({ x:this.x, y:this.y, vx: dx/mag*260, vy: dy/mag*260, size:6, hostile:true, hue: this.hue, owner:'enemy' });
    }
  }
  draw(ctx){
    const g = ctx.createLinearGradient(this.x - this.size, this.y - this.size, this.x + this.size, this.y + this.size);
    g.addColorStop(0, `hsla(${this.hue},80%,60%,0.95)`);
    g.addColorStop(1, `hsla(${this.hue+40},90%,45%,0.75)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, this.size*1.2, this.size, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,0.85)`;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y - this.size*0.1, this.size*0.5, this.size*0.35, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = `hsl(${this.hue},80%,55%)`;
    ctx.beginPath(); ctx.arc(this.x,this.y,this.size*2.2,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/* Boss with phases */
class Boss {
  constructor(x,y){
    this.x = x; this.y = y; this.size = 64; this.maxHp = 220 + Math.round(difficulty*80); this.hp = this.maxHp;
    this.phase = 1; this.timer = 0; this.hue = maps[selectedMap].bgHue + 40; this.angle = 0; this.shootTimer = 0;
  }
  update(dt){
    this.timer += dt;
    this.angle += dt*0.6;
    // Move in slow pattern
    this.x = W/2 + Math.sin(this.timer*0.5)*Math.min(220, 120 + difficulty*40);
    this.y = 120 + Math.cos(this.timer*0.25)*24;
    // phase transitions
    if(this.hp < this.maxHp*0.65 && this.phase === 1){ this.phase = 2; this.shootTimer = 0; addShake(1.2); spawnParticles(this.x,this.y,'rgba(255,200,120,0.9)', 30, Math.PI*2, 6, 1.2); }
    if(this.hp < this.maxHp*0.35 && this.phase === 2){ this.phase = 3; this.shootTimer = 0; addShake(1.8); spawnParticles(this.x,this.y,'rgba(255,80,120,0.95)', 48, Math.PI*2, 8, 1.6); }
    // shooting logic by phase
    this.shootTimer -= dt;
    if(this.shootTimer <= 0){
      if(this.phase === 1){
        this.shootTimer = 1.2 - Math.min(0.7, difficulty*0.02);
        // 8 radial bullets
        for(let i=0;i<8;i++){
          const a = i*Math.PI*2/8 + rnd(-0.08,0.08);
          bullets.push({ x:this.x + Math.cos(a)*this.size*0.8, y:this.y + Math.sin(a)*this.size*0.8, vx: Math.cos(a)*240, vy: Math.sin(a)*240, size:8, hostile:true, hue:this.hue, owner:'boss' });
        }
      } else if(this.phase === 2){
        this.shootTimer = 0.9 - Math.min(0.4, difficulty*0.02);
        // targeted spread to both players
        for(const p of players){
          const dx = p.x - this.x, dy = p.y - this.y; const mag = Math.hypot(dx,dy)||1;
          for(let s=-1;s<=1;s++){
            const ang = Math.atan2(dy,dx) + s*0.18;
            bullets.push({ x:this.x + Math.cos(ang)*this.size*0.8, y:this.y + Math.sin(ang)*this.size*0.8, vx: Math.cos(ang)*320, vy: Math.sin(ang)*320, size:9, hostile:true, hue:this.hue, owner:'boss' });
          }
        }
      } else {
        this.shootTimer = 0.65 - Math.min(0.3, difficulty*0.02);
        // laser burst + radial
        for(let i=0;i<12;i++){
          const a = i*Math.PI*2/12 + rnd(-0.1,0.1);
          bullets.push({ x:this.x + Math.cos(a)*this.size*1.1, y:this.y + Math.sin(a)*this.size*1.1, vx: Math.cos(a)*360, vy: Math.sin(a)*360, size:10, hostile:true, hue:this.hue, owner:'boss' });
        }
        // homing bullets (simple towards nearest player)
        for(let h=0; h<4; h++){
          const target = players.reduce((a,b)=> (a && dist(a.x,a.y,this.x,this.y) < dist(b.x,b.y,this.x,this.y)) ? a : b );
          const dx = target.x - this.x, dy = target.y - this.y; const mag = Math.hypot(dx,dy)||1;
          bullets.push({ x:this.x, y:this.y, vx: dx/mag*220, vy: dy/mag*220, size:12, hostile:true, hue:this.hue, owner:'boss', homing:true });
        }
      }
    }
  }
  draw(ctx){
    // big neon mech
    ctx.save();
    ctx.translate(this.x,this.y);
    ctx.rotate(Math.sin(this.timer*0.6)*0.06);
    const s = this.size;
    const g = ctx.createLinearGradient(-s,-s,s,s);
    g.addColorStop(0, `hsla(${this.hue},90%,60%,1)`);
    g.addColorStop(1, `hsla(${this.hue+60},80%,40%,0.85)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0,0,s*1.6,s,0,0,Math.PI*2); ctx.fill();
    // core
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(-s*0.2, 0, s*0.5,0,Math.PI*2); ctx.fill();
    // turret
    ctx.fillStyle = `hsla(${this.hue+30},90%,55%,0.95)`; ctx.beginPath(); ctx.rect(s*0.6,-s*0.18,s*0.9,s*0.36); ctx.fill();
    ctx.restore();
    // HP bar
    const hbX = W/2 - 240, hbY = 18, hbW = 480, hbH = 14;
    ctx.fillStyle = '#111'; ctx.fillRect(hbX,hbY,hbW,hbH);
    const pct = clamp(this.hp / this.maxHp, 0, 1);
    const grd = ctx.createLinearGradient(hbX,0,hbX+hbW,0);
    grd.addColorStop(0,'#ff6b6b'); grd.addColorStop(0.6,'#ffdd66'); grd.addColorStop(1,'#6bffea');
    ctx.fillStyle = grd; ctx.fillRect(hbX,hbY,hbW*pct,hbH);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.strokeRect(hbX,hbY,hbW,hbH);
  }
}

/* simple glow text */
function glowText(ctx, text, x, y, size=20, hue=180){
  ctx.save();
  ctx.font = `700 ${size}px Inter, Arial`;
  ctx.textAlign = 'left';
  ctx.shadowColor = `hsla(${hue},100%,60%,0.6)`;
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#bff';
  ctx.fillText(text, x, y);
  ctx.restore();
}

/* shake */
function addShake(s){ shake = Math.max(shake, s); }

/* spawn a wave */
function spawnWave(){
  const count = Math.min(14, Math.round(3 + difficulty*2 + Math.random()*5));
  for(let i=0;i<count;i++){
    const x = rnd(-W*0.15, W*1.15);
    const y = rnd(-H*0.4, -20);
    enemies.push(new Enemy(x,y));
  }
  waveTime = 0;
  spawnInterval = clamp(1.6 - difficulty*0.08, 0.5, 2.2);
}

/* update loop */
let last = performance.now()/1000;
let paused = false;
function update(){
  const now = performance.now()/1000;
  let dt = Math.min(0.033, now - last); last = now;
  if(paused){ requestAnimationFrame(loop); return; }

  // controls player 1 (WASD + mouse)
  const left1 = keys['a'], right1 = keys['d'], up1 = keys['w'], down1 = keys['s'];
  let mx1=0,my1=0;
  if(left1) mx1-=1; if(right1) mx1+=1; if(up1) my1-=1; if(down1) my1+=1;
  const mag1 = Math.hypot(mx1,my1);
  if(mag1>0){ mx1/=mag1; my1/=mag1; players[0].vx += mx1 * players[0].speed * dt * 3; players[0].vy += my1 * players[0].speed * dt * 3; }

  // controls player 2 (arrows) and aim with IJKL and shoot M
  const left2 = keys['arrowleft'], right2 = keys['arrowright'], up2 = keys['arrowup'], down2 = keys['arrowdown'];
  let mx2=0,my2=0;
  if(left2) mx2-=1; if(right2) mx2+=1; if(up2) my2-=1; if(down2) my2+=1;
  const mag2 = Math.hypot(mx2,my2);
  if(mag2>0){ mx2/=mag2; my2/=mag2; players[1].vx += mx2 * players[1].speed * dt * 3; players[1].vy += my2 * players[1].speed * dt * 3; }

  // player2 aiming with IJKL
  const aimUp = keys['i'], aimDown = keys['k'], aimLeft = keys['j'], aimRight = keys['l'];
  let adx=0,ady=0;
  if(aimLeft) adx -= 1; if(aimRight) adx += 1; if(aimUp) ady -= 1; if(aimDown) ady += 1;
  if(adx!==0 || ady!==0){ const m = Math.hypot(adx,ady)||1; players[1].aimDir.x = adx/m; players[1].aimDir.y = ady/m; }

  // damping & movement
  for(const p of players){
    p.vx *= 0.86; p.vy *= 0.86;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.x = clamp(p.x, 40, W-40); p.y = clamp(p.y, 60, H-40);
  }

  // Player firing
  players[0].reload -= dt;
  const aimDx = mouse.x - players[0].x, aimDy = mouse.y - players[0].y;
  const aimAng = Math.atan2(aimDy, aimDx);
  if((mouse.down || keys[' ']) && players[0].reload <= 0 && players[0].alive){
    players[0].reload = players[0].fireRate;
    for(let s=-1;s<=1;s++){
      const ang = aimAng + s*0.06;
      bullets.push({ x: players[0].x + Math.cos(ang)*20, y: players[0].y + Math.sin(ang)*20, vx: Math.cos(ang)*760, vy: Math.sin(ang)*760, size: 5, hue: players[0].colorHue, owner: 'p0' });
    }
    spawnParticles(players[0].x + Math.cos(aimAng)*16, players[0].y + Math.sin(aimAng)*16, 'rgba(180,255,255,0.9)', 8, Math.PI*1.4, 1.8, 0.35);
  }

  // player2 fire with 'm'
  players[1].reload -= dt;
  if(keys['m'] && players[1].reload <= 0 && players[1].alive){
    players[1].reload = players[1].fireRate;
    const ang2 = Math.atan2(players[1].aimDir.y, players[1].aimDir.x);
    for(let s=-1;s<=1;s++){
      const a = ang2 + s*0.08;
      bullets.push({ x: players[1].x + Math.cos(a)*20, y: players[1].y + Math.sin(a)*20, vx: Math.cos(a)*640, vy: Math.sin(a)*640, size: 6, hue: players[1].colorHue, owner: 'p1' });
    }
    spawnParticles(players[1].x + players[1].aimDir.x*16, players[1].y + players[1].aimDir.y*16, 'rgba(255,210,200,0.9)', 6, Math.PI*1.2, 1.8, 0.32);
  }

  // bullets update (with simple homing)
  for(let i=bullets.length-1;i>=0;i--){
    const b = bullets[i];
    if(b.homing){
      // find nearest player
      const target = players.reduce((a,bp)=> (a && dist(a.x,a.y,b.x,b.y) < dist(bp.x,bp.y,b.x,b.y)) ? a : bp );
      const dx = target.x - b.x, dy = target.y - b.y, m = Math.hypot(dx,dy)||1;
      // steer slightly
      b.vx += (dx/m*60 - b.vx) * 0.06;
      b.vy += (dy/m*60 - b.vy) * 0.06;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vx *= 0.999; b.vy *= 0.999;
    if(b.x < -80 || b.x > W+80 || b.y < -80 || b.y > H+80) bullets.splice(i,1);
  }

  // enemies update & collisions
  for(let i=enemies.length-1;i>=0;i--){
    const e = enemies[i];
    e.update(dt);
    if(e.y > H + 120) { enemies.splice(i,1); players.forEach(p=>p.score = Math.max(0, p.score - 6)); continue; }
    for(let j=bullets.length-1;j>=0;j--){
      const b = bullets[j];
      if(b.owner === 'enemy' || b.hostile) continue;
      if(dist(b.x,b.y,e.x,e.y) < e.size + b.size){
        e.hp -= 8;
        spawnParticles(b.x,b.y, `hsla(${e.hue},80%,65%,1)`, 8, Math.PI*1.8, 2, 0.45);
        bullets.splice(j,1);
        addShake(0.6);
        if(e.hp <= 0){ spawnParticles(e.x,e.y, `hsla(${e.hue},90%,60%,1)`, 24, Math.PI*2, 3.2, 0.9); players[0].score += Math.round(6 + e.size); players[1].score += Math.round(4 + e.size*0.5); enemies.splice(i,1); break; }
      }
    }
    // collide with players (ram)
    for(const p of players){
      if(dist(e.x,e.y,p.x,p.y) < e.size + p.size){
        p.hp -= 12;
        spawnParticles((e.x+p.x)/2,(e.y+p.y)/2,'rgba(255,120,120,0.95)',18,Math.PI*2,3.5,0.8);
        addShake(1.0);
        enemies.splice(i,1);
        break;
      }
    }
  }

  // bullets hostile hitting players
  for(let i=bullets.length-1;i>=0;i--){
    const b = bullets[i];
    if(!b.hostile) continue;
    for(const p of players){
      if(dist(b.x,b.y,p.x,p.y) < p.size + b.size){
        bullets.splice(i,1);
        p.hp -= (b.owner === 'boss') ? 16 : 8;
        spawnParticles(p.x,p.y,'rgba(255,200,120,0.95)',12,Math.PI*2,3.2,0.6);
        addShake(0.9);
        break;
      }
    }
  }

  // update boss(es)
  for(let i=bosses.length-1;i>=0;i--){
    const B = bosses[i];
    B.update(dt);
    // boss collides with player bullets
    for(let j=bullets.length-1;j>=0;j--){
      const b = bullets[j];
      if(b.hostile) continue;
      if(dist(b.x,b.y,B.x,B.y) < B.size + b.size){
        B.hp -= 8;
        spawnParticles(b.x,b.y, `hsla(${B.hue},90%,60%,1)`, 8, Math.PI*1.8, 3.2, 0.45);
        bullets.splice(j,1);
        addShake(1.1);
        if(B.hp <= 0){
          spawnParticles(B.x,B.y, `hsla(${B.hue},90%,60%,1)`, 80, Math.PI*2, 8, 1.8);
          players[0].score += 200; players[1].score += 160;
          bosses.splice(i,1);
          difficulty = Math.max(1, difficulty - 0.6);
          break;
        }
      }
    }
  }

  // particles
  for(let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.update(dt); if(p.life <= 0) particles.splice(i,1); }

  // spawn waves
  waveTime += dt;
  if(waveTime > spawnInterval){ spawnWave(); difficulty += 0.02; }

  // sometimes spawn boss when difficulty enough or score milestone
  if(Math.random() < 0.0009 * difficulty && bosses.length === 0 && (players[0].score + players[1].score) > 120 + difficulty*50){
    bosses.push(new Boss(W/2, -120)); addShake(2); spawnParticles(W/2, 60, 'rgba(255,120,200,0.9)', 60, Math.PI*2, 8, 1.4);
  }

  // player death
  for(const p of players){ if(p.hp <= 0 && p.alive){ p.alive = false; addShake(8); } }

  // screen shake decay
  if(shake > 0) shake = Math.max(0, shake - dt*6);

  // UI
  updateUI();

  requestAnimationFrame(loop);
}

/* Rendering */
function drawBackground(ctx){
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0, '#05010a');
  g.addColorStop(1, '#090010');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);

  for(let i=0;i<bgLayers.length;i++){
    const layer = bgLayers[i];
    ctx.save();
    const ox = (players[0].x - W/2) * layer.speed * 0.02;
    const oy = (players[0].y - H/2) * layer.speed * 0.02;
    for(const s of layer.stars){
      const x = (s.x + ox) % (W*1.2);
      const y = (s.y + oy) % (H*1.2);
      ctx.globalAlpha = s.a * 0.9;
      ctx.beginPath();
      ctx.fillStyle = `hsl(${layer.hue}, 80%, 65%)`;
      ctx.arc(x, y, s.r, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  // grid lines in chosen map color
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = maps[selectedMap].grid;
  ctx.lineWidth = 1;
  const spacing = 120;
  for(let x = -spacing*2; x < W + spacing*2; x += spacing){
    ctx.beginPath();
    ctx.moveTo(x + ((players[0].x*0.02)%spacing), 0);
    ctx.lineTo(x + ((players[0].x*0.02)%spacing), H);
    ctx.stroke();
  }
  ctx.restore();
}

/* draw ship (skin) */
function drawShip(ctx, p){
  const px = p.x, py = p.y;
  // choose style by skin
  let colors;
  switch(p.skin){
    case 1: colors = ['#ff7b7b','#ffdd66']; break;
    case 2: colors = ['#a7f','#4ff']; break;
    case 3: colors = ['#7fffcf','#5fc']; break;
    default: colors = ['#1ef','#8af'];
  }
  const ang = p === players[0] ? Math.atan2(mouse.y-py, mouse.x-px) : Math.atan2(p.aimDir.y, p.aimDir.x);
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = `rgba(140,230,255,0.9)`;
  ctx.beginPath(); ctx.arc(px,py, p.size*2.8, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(px,py);
  ctx.rotate(ang);
  const g = ctx.createLinearGradient(-p.size, -p.size, p.size, p.size);
  g.addColorStop(0, colors[0]);
  g.addColorStop(1, colors[1]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-p.size, -p.size*0.6);
  ctx.lineTo(p.size*1.1, 0);
  ctx.lineTo(-p.size, p.size*0.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.ellipse(-p.size*0.35, 0, p.size*0.45, p.size*0.35, 0, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#7af';
  ctx.beginPath(); ctx.ellipse(-p.size*0.9, 0, p.size*0.4, p.size*0.25, 0, 0, Math.PI*2); ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* render */
function render(){
  const sx = (Math.random()*2-1)*shake*2;
  const sy = (Math.random()*2-1)*shake*2;
  ctx.setTransform(1,0,0,1,sx,sy);
  drawBackground(ctx);

  // bullets hostile first
  for(const b of bullets){
    if(b.hostile){
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.fillStyle = `hsl(${b.hue || 10},90%,60%)`;
      ctx.arc(b.x,b.y,b.size,0,Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.arc(b.x - b.vx*0.01, b.y - b.vy*0.01, Math.max(1.2,b.size*0.6),0,Math.PI*2);
      ctx.fill();
    }
  }

  // enemies
  for(const e of enemies) e.draw(ctx);

  // bullets friendly
  for(const b of bullets){
    if(!b.hostile){
      ctx.beginPath();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = `hsla(190, 95%, 60%, 0.9)`;
      ctx.arc(b.x, b.y, b.size*1.8, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.fillStyle = 'white';
      ctx.arc(b.x, b.y, b.size*0.9, 0, Math.PI*2);
      ctx.fill();
    }
  }

  // particles
  for(const p of particles) p.draw(ctx);

  // players
  for(const p of players){
    if(p.alive) drawShip(ctx,p); else {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = 'rgba(4,0,6,0.6)';
      ctx.beginPath(); ctx.arc(p.x,p.y, 80,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  // bosses
  for(const B of bosses) B.draw(ctx);

  // HUD
  ctx.setTransform(1,0,0,1,0,0);
  ctx.save();
  ctx.font = '600 18px Inter, Arial'; ctx.fillStyle = '#bff';
  ctx.fillText('Score P1: ' + players[0].score, 18, 28);
  ctx.fillStyle = '#9ff'; ctx.font = '14px Inter, Arial'; ctx.fillText('Enemies: ' + enemies.length, 18, 48);
  // health P1
  const hbX = 18, hbY = 60, hbW = 220, hbH = 12;
  ctx.fillStyle = '#222'; ctx.fillRect(hbX, hbY, hbW, hbH);
  const pct = clamp(players[0].hp / players[0].maxHp, 0, 1);
  const grd = ctx.createLinearGradient(hbX, 0, hbX+hbW, 0); grd.addColorStop(0, '#ff6b6b'); grd.addColorStop(0.6, '#ffdd66'); grd.addColorStop(1, '#6bffea');
  ctx.fillStyle = grd; ctx.fillRect(hbX, hbY, hbW*pct, hbH); ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.strokeRect(hbX,hbY,hbW,hbH);
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '12px Inter, Arial'; ctx.fillText(Math.round(players[0].hp) + ' / ' + players[0].maxHp, hbX + hbW + 8, hbY + hbH - 1);

  // P2 HUD (right side)
  const hbX2 = W - 18 - hbW, hbY2 = 60;
  ctx.fillStyle = '#222'; ctx.fillRect(hbX2, hbY2, hbW, hbH);
  const pct2 = clamp(players[1].hp / players[1].maxHp, 0, 1);
  ctx.fillStyle = grd; ctx.fillRect(hbX2, hbY2, hbW*pct2, hbH); ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.strokeRect(hbX2,hbY2,hbW,hbH);
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '12px Inter, Arial'; ctx.fillText(Math.round(players[1].hp) + ' / ' + players[1].maxHp, hbX2 - 90, hbY2 + hbH - 1);
  ctx.restore();

  // center crosshair for P1
  ctx.save();
  ctx.globalAlpha = 0.8; ctx.fillStyle = '#9ff'; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 7,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 18,0,Math.PI*2); ctx.stroke(); ctx.restore();

  // small P2 aim indicator
  ctx.save();
  const p2aimX = players[1].x + players[1].aimDir.x*28; const p2aimY = players[1].y + players[1].aimDir.y*28;
  ctx.globalAlpha = 0.85; ctx.fillStyle = '#ffd'; ctx.beginPath(); ctx.arc(p2aimX,p2aimY,6,0,Math.PI*2); ctx.fill(); ctx.restore();

  // game over big
  if(!players[0].alive && !players[1].alive){
    ctx.save();
    ctx.fillStyle = 'rgba(4,0,6,0.6)'; ctx.fillRect(0,0,W,H);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '800 44px Inter, Arial'; ctx.shadowColor = '#ff6b9b'; ctx.shadowBlur = 24;
    ctx.fillText('ALL PLAYERS DOWN', W/2, H/2 - 24);
    ctx.shadowBlur = 0;
    ctx.font = '600 18px Inter, Arial'; ctx.fillStyle = '#bfe';
    ctx.fillText('Final Scores — P1: ' + players[0].score + ' • P2: ' + players[1].score + ' • Press R to restart', W/2, H/2 + 18);
    ctx.restore();
  }
}

/* UI DOM update */
function updateUI(){
  if (UI) UI.innerHTML = `Neon Shooter<br><small>Wave difficulty: ${difficulty.toFixed(2)}</small>`;
  if (hudPlayers) hudPlayers.innerHTML = `<div style="color:#bff">P1 skin: ${players[0].skin} • P2 skin: ${players[1].skin} • Map: ${maps[selectedMap].name}</div>`;
  
  // cập nhật point nếu có ở menu
  const t = document.getElementById("totalPoints");
  if (t) t.textContent = "Points: " + (save?.totalPoints ?? 0);
}


/* main loop */
function loop(){ update(); render(); }
last = performance.now()/1000;
requestAnimationFrame(function init(){ last = performance.now()/1000; loop(); });

/* Key actions */
window.addEventListener('keydown', e=>{
  if(e.key.toLowerCase()==='p'){ paused = !paused; if(paused) UI.innerHTML += '<div style="color:#fdd"> • PAUSED</div>'; }
  if(e.key.toLowerCase()==='r'){ restart(); }
});

/* restart */
function restart(){
  bullets = []; enemies = []; particles = []; bosses = []; players.forEach((p,i)=>{ p.x = W*(0.5 - i*0.1); p.y = H*(0.7 + i*0.05); p.vx=0; p.vy=0; p.hp = p.maxHp; p.alive = true; p.score = 0; });
  difficulty = 1; waveTime = 0; spawnInterval = 1.6;
}

/* Menu interactions (skins & maps) */
document.querySelectorAll('.skin-swatch').forEach(el=>{
  el.addEventListener('click', ()=> {
    document.querySelectorAll('.skin-swatch').forEach(x=>x.classList.remove('sel'));
    el.classList.add('sel');
    const s = Number(el.dataset.skin);
    // set p1 and p2 different by offset
    players[0].skin = s;
    players[0].colorHue = [190,10,270,160][s] || 190;
    players[1].skin = (s+1)%4;
    players[1].colorHue = [190,10,270,160][players[1].skin] || 320;
    updateUI();
  });
});
document.querySelectorAll('.map-thumb').forEach((el, idx)=>{
  el.addEventListener('click', ()=> {
    document.querySelectorAll('.map-thumb').forEach(x=>x.classList.remove('sel'));
    el.classList.add('sel');
    selectedMap = Number(el.dataset.map);
    initBg();
    updateUI();
  });
});

/* Attach thumbnails (no external images; set gradients inline) */
document.querySelector('[data-map="0"]').style.background = 'linear-gradient(180deg,#05010a,#090010)';
document.querySelector('[data-map="1"]').style.background = 'linear-gradient(180deg,#20000a,#4a0018)';
document.querySelector('[data-map="2"]').style.background = 'linear-gradient(180deg,#001a2e,#002b46)';

document.getElementById('startBtn').addEventListener('click', ()=> { menu.style.display = 'none'; restart(); });
document.getElementById('restartBtn').addEventListener('click', ()=> { restart(); });
document.getElementById('tutorialBtn').addEventListener('click', ()=> {
  alert('P1: WASD + Mouse + Click/Space to shoot\nP2: Arrow keys to move, I J K L to aim, M to shoot\nPause: P • Restart: R');
});

/* pause when tab hidden */
document.addEventListener('visibilitychange', ()=>{ if(document.hidden) paused = true; });

/* Prevent focus scroll on arrow keys */
window.addEventListener("keydown", function(e) {
  if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].indexOf(e.key) > -1) { e.preventDefault(); }
}, false);



    })();
} else {
    console.warn("Galaxy Shooter already initialized - skipping duplicate load.");
}




// === Visual Upgrades ===
// Player tilt + engine flame
Player.prototype.draw = (function(original){
  return function(ctx){
    ctx.save();
    // Tilt effect based on horizontal velocity
    let tilt = this.vx * 0.05;
    ctx.translate(this.x, this.y);
    ctx.rotate(tilt);
    // Engine flame
    let flameLen = 10 + Math.random() * 6;
    ctx.fillStyle = 'rgba(0,255,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(-this.width/4, this.height/2);
    ctx.lineTo(0, this.height/2 + flameLen);
    ctx.lineTo(this.width/4, this.height/2);
    ctx.fill();
    ctx.rotate(-tilt);
    ctx.translate(-this.x, -this.y);
    ctx.restore();
    // Call original draw
    original.call(this, ctx);
  };
})(Player.prototype.draw);

// Bullet neon glow + trail
Bullet.prototype.draw = (function(original){
  return function(ctx){
    // Trail
    let grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 8);
    grd.addColorStop(0, 'rgba(0,255,255,0.8)');
    grd.addColorStop(1, 'rgba(0,255,255,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 8, 0, Math.PI*2);
    ctx.fill();
    // Call original draw
    original.call(this, ctx);
  };
})(Bullet.prototype.draw);
