// ===== Neon Shooter - FIXED CLEAN MAIN =====
// This build focuses on correctness & stability:
// - Proper game states: 'menu' | 'playing' | 'gameover'
// - True single-player: P2 is fully disabled (no draw, no input, never targeted)
// - Dead players: no input, no targeting, no collisions
// - Menu: no gameplay is running under the overlay
// - Game over: enemies drift around calmly, stop shooting; press START to reset
// - Shop hooks: unified upgrades for both players, with localStorage points
// - Subtle engine trail + clearer muzzle flashes

(function(){
'use strict';

/* =================== Save / Points =================== */
const SAVE_KEY = 'neon_shooter_save_v4';
function loadSave(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : { totalPoints: 0, upgrades:{} };
  }catch(e){ return { totalPoints: 0, upgrades:{} }; }
}
function saveSave(obj){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(obj)); }catch(e){} }
let save = loadSave();

/* =================== Canvas / Basic =================== */
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha:false });
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
addEventListener('resize', ()=>{
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
});

const UI = document.getElementById('ui');
const hudPlayers = document.getElementById('hud-players');
const credits = document.getElementById('credits');
const menu = document.getElementById('menu');
const totalPointsLabel = document.getElementById('totalPoints');
const notifyEl = document.getElementById('notify');

const $ = (sel)=>document.querySelector(sel);
const $$ = (sel)=>Array.from(document.querySelectorAll(sel));

// small helper
const clamp = (v,a,b)=> Math.max(a, Math.min(b,v));
const dist  = (x1,y1,x2,y2)=> Math.hypot(x2-x1, y2-y1);
const rand  = (a,b)=> Math.random()*(b-a)+a;

/* =================== Game State =================== */
let gameState = 'menu';     // 'menu' | 'playing' | 'gameover'
let gameMode  = 'single';   // 'single' | 'coop'
let paused = false;
let lastTime = performance.now()/1000;
let difficulty = 1;
let waveTime = 0;
let spawnInterval = 1.6;
let selectedMap = 0;

/* =================== Input =================== */
const keys = {};
addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) e.preventDefault(); });
addEventListener('keyup',   e => keys[e.key.toLowerCase()] = false);

const mouse = { x: W/2, y: H/2, down:false };
canvas.addEventListener('mousemove', e=>{ mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', ()=> mouse.down = true);
canvas.addEventListener('mouseup',   ()=> mouse.down = false);
canvas.addEventListener('contextmenu', e=>e.preventDefault());

/* =================== Audio (safe) =================== */
function sfx(name, vol=1){
  if(!window.audio || !audio.unlocked) return;
  try{
    if(name==='playerShot') audio.sfx('playerShot', {vol});
    else if(name==='enemyShot') audio.sfx('enemyShot', {vol});
    else if(name==='hit') audio.sfx('enemyHit', {vol});
  }catch(e){}
}
function toMenuBGM(){ if(window.audio){ try{ audio.toMenu(); }catch(e){} } }
function toGameBGM(){ if(window.audio){ try{ audio.toGame(); }catch(e){} } }

/* =================== Background =================== */
const maps = [
  { name:'Neon City',  bgHue:190, grid:'#77f' },
  { name:'Crimson Rift', bgHue:330, grid:'#f76' },
  { name:'Deep Ocean', bgHue:210, grid:'#3cf' }
];
const bgLayers = [];
function initBg(){
  bgLayers.length = 0;
  for(let i=0;i<4;i++){
    const layer = { stars:[], speed:0.02 + i*0.02, hue: maps[selectedMap].bgHue - i*18 };
    for(let j=0;j<90 + i*40;j++){
      layer.stars.push({ x: Math.random()*W*1.4 - W*0.2, y: Math.random()*H*1.2 - H*0.1, r: rand(0.6, 2.6 - i*0.4), a: rand(0.06,0.35) });
    }
    bgLayers.push(layer);
  }
}
initBg();

function drawBackground(){
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0, '#05010a');
  g.addColorStop(1, '#090010');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);

  // faint star drift even in menu
  for(const layer of bgLayers){
    ctx.save();
    const ox = (mouse.x - W/2) * layer.speed * 0.02; // mild parallax by mouse
    const oy = (mouse.y - H/2) * layer.speed * 0.02;
    for(const s of layer.stars){
      const x = (s.x + ox) % (W*1.2);
      const y = (s.y + oy) % (H*1.2);
      ctx.globalAlpha = s.a;
      ctx.fillStyle = `hsl(${layer.hue}, 80%, 65%)`;
      ctx.beginPath(); ctx.arc(x,y,s.r,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  // soft grid
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = maps[selectedMap].grid;
  ctx.lineWidth = 1;
  const spacing = 120;
  const shift = (mouse.x*0.02)%spacing;
  for(let x = -spacing*2; x < W + spacing*2; x += spacing){
    ctx.beginPath();
    ctx.moveTo(x + shift, 0);
    ctx.lineTo(x + shift, H);
    ctx.stroke();
  }
  ctx.restore();
}

/* =================== Particles =================== */
class Particle {
  constructor(x,y,vx,vy,size,life,clr,fade=true){
    this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.size=size; this.life=life; this.max=life; this.clr=clr; this.fade=fade;
  }
  update(dt){ this.x += this.vx*dt; this.y += this.vy*dt; this.vx *= 0.995; this.vy += 0.002*dt; this.life -= dt; }
  draw(ctx){
    const a = this.fade ? clamp(this.life/this.max,0,1) : 1;
    ctx.globalAlpha = a;
    ctx.fillStyle = this.clr;
    ctx.beginPath(); ctx.arc(this.x,this.y, this.size*a, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}
let particles = [];
function spawnParticles(x,y,color,count=10,spread=Math.PI, speed=0.9, size=3, life=0.8){
  for(let i=0;i<count;i++){
    const a = Math.random()*Math.PI*2;
    const s = rand(speed*0.2, speed);
    particles.push(new Particle(x,y, Math.cos(a)*s*120, Math.sin(a)*s*120, rand(size*0.4,size), life, color));
  }
}

/* =================== Entities =================== */
function makePlayer(id,x,y,skin,hue){
  return {
    id, x, y, vx:0, vy:0, size:18, speed: id===0? 440:380,
    hp:120, maxHp:120, alive:true, active:true,
    reload:0, fireRate: id===0? 0.09:0.16, // faster for P1
    skin, colorHue:hue, aimDir:{x:1,y:0}, engine:0,
    damage:8
  };
}
const players = [
  makePlayer(0, W*0.5, H*0.7, 0, 190),
  makePlayer(1, W*0.4, H*0.8, 1, 320)
];
function setSingleMode(){
  gameMode = 'single';
  players[0].active = true;
  players[1].active = false;        // fully disabled
}
function setCoopMode(){
  gameMode = 'coop';
  players[0].active = true;
  players[1].active = true;
}

let bullets = [];   // {x,y,vx,vy,size,hostile?,owner,hue,homing?}
let enemies = [];
let bosses  = [];

/* =================== Enemies / Boss =================== */
class Enemy{
  constructor(x,y){
    this.x=x; this.y=y; this.size= rand(14,26);
    this.hp = Math.round(8 + this.size);
    this.angle = rand(0,Math.PI*2);
    this.hue = maps[selectedMap].bgHue + rand(-70,70);
    this.shootTimer = rand(1.6,3.2);
    this.speedMul = rand(1.0,1.6);
  }
  update(dt){
    this.angle += dt*0.6;
    this.y += (40 + Math.sin(this.angle*2+this.x*0.01)*18) * dt * this.speedMul;
    this.x += Math.sin(this.y*0.01 + this.angle)*30*dt;
    // shooting only in playing state
    if(gameState==='playing'){
      this.shootTimer -= dt;
      if(this.shootTimer<=0){
        this.shootTimer = rand(2.0,4.0)/Math.max(1,difficulty);
        const target = pickAlivePlayer();
        if(target){
          const dx = target.x - this.x, dy = target.y - this.y;
          const m = Math.hypot(dx,dy)||1;
          bullets.push({ x:this.x, y:this.y, vx: dx/m*260, vy: dy/m*260, size:6, hostile:true, hue:this.hue, owner:'enemy' });
          sfx('enemyShot', 0.5);
        }
      }
    }
  }
  draw(ctx){
    const g = ctx.createLinearGradient(this.x-this.size, this.y-this.size, this.x+this.size, this.y+this.size);
    g.addColorStop(0, `hsla(${this.hue},80%,60%,0.95)`);
    g.addColorStop(1, `hsla(${this.hue+40},90%,45%,0.75)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(this.x, this.y, this.size*1.2, this.size, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,0.85)`;
    ctx.beginPath(); ctx.ellipse(this.x, this.y - this.size*0.1, this.size*0.5, this.size*0.35, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 0.18; ctx.fillStyle = `hsl(${this.hue},80%,55%)`; ctx.beginPath(); ctx.arc(this.x,this.y,this.size*2.2,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
  }
}

class Boss{
  constructor(){
    this.x = W/2; this.y = 120; this.size = 64;
    this.maxHp = 260 + Math.round(difficulty*80); this.hp = this.maxHp;
    this.hue = maps[selectedMap].bgHue + 40;
    this.timer = 0; this.phase = 1; this.shootTimer = 1.2;
  }
  update(dt){
    this.timer += dt;
    this.x = W/2 + Math.sin(this.timer*0.5)*Math.min(220, 120 + difficulty*40);
    this.y = 120 + Math.cos(this.timer*0.25)*24;
    if(this.hp < this.maxHp*0.65 && this.phase===1){ this.phase=2; }
    if(this.hp < this.maxHp*0.35 && this.phase===2){ this.phase=3; }
    if(gameState!=='playing') return; // no shooting in menu/gameover
    this.shootTimer -= dt;
    if(this.shootTimer<=0){
      if(this.phase===1){ this.shootTimer = 1.2;
        for(let i=0;i<8;i++){
          const a = i*Math.PI*2/8;
          bullets.push({ x:this.x+Math.cos(a)*this.size*0.8, y:this.y+Math.sin(a)*this.size*0.8, vx:Math.cos(a)*240, vy:Math.sin(a)*240, size:8, hostile:true, hue:this.hue, owner:'boss' });
        }
      }else if(this.phase===2){ this.shootTimer = 0.9;
        const t = pickAlivePlayer(); if(t){
          const base = Math.atan2(t.y-this.y, t.x-this.x);
          for(let s=-1;s<=1;s++){
            const a = base + s*0.18;
            bullets.push({ x:this.x+Math.cos(a)*this.size*0.8, y:this.y+Math.sin(a)*this.size*0.8, vx:Math.cos(a)*320, vy:Math.sin(a)*320, size:9, hostile:true, hue:this.hue, owner:'boss' });
          }
        }
      }else{ this.shootTimer = 0.7;
        for(let i=0;i<12;i++){
          const a = i*Math.PI*2/12;
          bullets.push({ x:this.x+Math.cos(a)*this.size*1.1, y:this.y+Math.sin(a)*this.size*1.1, vx:Math.cos(a)*360, vy:Math.sin(a)*360, size:10, hostile:true, hue:this.hue, owner:'boss' });
        }
      }
    }
  }
  draw(ctx){
    ctx.save();
    const s=this.size;
    const g = ctx.createLinearGradient(this.x-s, this.y-s, this.x+s, this.y+s);
    g.addColorStop(0, `hsla(${this.hue},90%,60%,1)`);
    g.addColorStop(1, `hsla(${this.hue+60},80%,40%,0.85)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(this.x, this.y, s*1.6, s, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(this.x - s*0.2, this.y, s*0.5,0,Math.PI*2); ctx.fill();
    ctx.restore();
    // HP bar
    const hbX = W/2 - 240, hbY = 18, hbW = 480, hbH = 14;
    ctx.fillStyle = '#111'; ctx.fillRect(hbX,hbY,hbW,hbH);
    const pct = clamp(this.hp/this.maxHp,0,1);
    const grd = ctx.createLinearGradient(hbX,0,hbX+hbW,0);
    grd.addColorStop(0,'#ff6b6b'); grd.addColorStop(0.6,'#ffdd66'); grd.addColorStop(1,'#6bffea');
    ctx.fillStyle = grd; ctx.fillRect(hbX,hbY,hbW*pct,hbH); ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.strokeRect(hbX,hbY,hbW,hbH);
  }
}

/* =================== Helpers =================== */
function pickAlivePlayer(){
  const alive = players.filter(p=>p.active && p.alive);
  if(alive.length===0) return null;
  // pick nearest to center or random
  return alive[Math.floor(Math.random()*alive.length)];
}

function addScoreAll(n){ players.forEach(p=> p.score = (p.score||0) + n); }

/* =================== Drawing =================== */
function drawShip(p){
  const ang = (p.id===0) ? Math.atan2(mouse.y-p.y, mouse.x-p.x) : Math.atan2(p.aimDir.y, p.aimDir.x);

  // soft aura
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = 'rgba(140,230,255,0.9)';
  ctx.beginPath(); ctx.arc(p.x,p.y, p.size*2.8, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;

  // ship body
  ctx.save();
  ctx.translate(p.x,p.y); ctx.rotate(ang);
  const colors = p.skin===1? ['#ff7b7b','#ffdd66'] : p.skin===2? ['#a7f','#4ff'] : ['#1ef','#8af'];
  const g = ctx.createLinearGradient(-p.size, -p.size, p.size, p.size);
  g.addColorStop(0, colors[0]); g.addColorStop(1, colors[1]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-p.size, -p.size*0.6);
  ctx.lineTo(p.size*1.1, 0);
  ctx.lineTo(-p.size, p.size*0.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.ellipse(-p.size*0.35, 0, p.size*0.45, p.size*0.35, 0,0,Math.PI*2); ctx.fill();

  // engine trail
  p.engine += 1;
  const pulse = 1 + Math.sin(p.engine*0.25)*0.25;
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = 'rgba(80,240,255,0.85)';
  ctx.beginPath(); ctx.ellipse(-p.size*0.95, 0, p.size*0.5*pulse, p.size*0.28*pulse, 0,0,Math.PI*2); ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawHUD(){
  ctx.save();
  ctx.font = '600 18px Inter, Arial'; ctx.fillStyle = '#bff';
  ctx.fillText('Score P1: ' + (players[0].score||0), 18, 28);
  ctx.fillStyle = '#9ff'; ctx.font = '14px Inter, Arial'; ctx.fillText('Enemies: ' + enemies.length, 18, 48);
  // health P1
  const hbX = 18, hbY = 60, hbW = 220, hbH = 12;
  ctx.fillStyle = '#222'; ctx.fillRect(hbX, hbY, hbW, hbH);
  const pct = clamp(players[0].hp / players[0].maxHp, 0, 1);
  const grd = ctx.createLinearGradient(hbX, 0, hbX+hbW, 0); grd.addColorStop(0, '#ff6b6b'); grd.addColorStop(0.6, '#ffdd66'); grd.addColorStop(1, '#6bffea');
  ctx.fillStyle = grd; ctx.fillRect(hbX, hbY, hbW*pct, hbH); ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.strokeRect(hbX,hbY,hbW,hbH);
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '12px Inter, Arial'; ctx.fillText(Math.round(players[0].hp) + ' / ' + players[0].maxHp, hbX + hbW + 8, hbY + hbH - 1);

  // P2 HUD only if active
  if(players[1].active){
    const hbX2 = W - 18 - hbW, hbY2 = 60;
    ctx.fillStyle = '#222'; ctx.fillRect(hbX2, hbY2, hbW, hbH);
    const pct2 = clamp(players[1].hp / players[1].maxHp, 0, 1);
    ctx.fillStyle = grd; ctx.fillRect(hbX2, hbY2, hbW*pct2, hbH); ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.strokeRect(hbX2,hbY2,hbW,hbH);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '12px Inter, Arial'; ctx.fillText(Math.round(players[1].hp) + ' / ' + players[1].maxHp, hbX2 - 90, hbY2 + hbH - 1);
  }
  ctx.restore();

  // crosshair for P1
  ctx.save();
  ctx.globalAlpha = 0.8; ctx.fillStyle = '#9ff'; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 7,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 18,0,Math.PI*2); ctx.stroke(); ctx.restore();

  // P2 aim indicator
  if(players[1].active && players[1].alive){
    const p2aimX = players[1].x + players[1].aimDir.x*28; const p2aimY = players[1].y + players[1].aimDir.y*28;
    ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = '#ffd'; ctx.beginPath(); ctx.arc(p2aimX,p2aimY,6,0,Math.PI*2); ctx.fill(); ctx.restore();
  }
}

/* =================== UI text =================== */
function updateUI(){
  if(UI) UI.innerHTML = `Neon Shooter<br><small>Wave difficulty: ${difficulty.toFixed(2)}</small>`;
  if(hudPlayers) hudPlayers.innerHTML = `<div style="color:#bff">Mode: ${gameMode.toUpperCase()} • Map: ${maps[selectedMap].name}</div>`;
  if(credits) credits.textContent = '© Neon Shooter';
  if(totalPointsLabel) totalPointsLabel.textContent = 'Points: ' + (save?.totalPoints ?? 0);
}
function notify(msg){ if(!notifyEl) return; notifyEl.textContent = msg; notifyEl.classList.add('show'); setTimeout(()=>notifyEl.classList.remove('show'), 1000); }

/* =================== Spawning =================== */
function spawnWave(){
  const count = Math.min(14, Math.round(3 + difficulty*2 + Math.random()*5));
  for(let i=0;i<count;i++){
    const x = rand(-W*0.15, W*1.15);
    const y = rand(-H*0.4, -20);
    enemies.push(new Enemy(x,y));
  }
  waveTime = 0;
  spawnInterval = clamp(1.6 - difficulty*0.08, 0.6, 2.2);
}

/* =================== Update =================== */
let shake = 0;
function addShake(s){ shake = Math.max(shake, s); }

function update(dt){
  // In menu: only update particles for subtle effect
  if(gameState==='menu'){
    particles.forEach(p=>p.update(dt));
    particles = particles.filter(p=>p.life>0);
    return;
  }

  if(paused) return;

  // Controls only when playing and player alive/active
  if(gameState==='playing'){
    // P1 move (WASD)
    const p1 = players[0];
    if(p1.active && p1.alive){
      let mx=0,my=0;
      if(keys['a']) mx-=1; if(keys['d']) mx+=1; if(keys['w']) my-=1; if(keys['s']) my+=1;
      const m = Math.hypot(mx,my)||1; mx/=m; my/=m;
      p1.vx += mx * p1.speed * dt * 3; p1.vy += my * p1.speed * dt * 3;
      p1.reload -= dt;
      const aimDx = mouse.x - p1.x, aimDy = mouse.y - p1.y;
      const aimAng = Math.atan2(aimDy, aimDx);
      if((mouse.down || keys[' ']) && p1.reload<=0){
        p1.reload = p1.fireRate;
        for(let s=-1;s<=1;s++){
          const a = aimAng + s*0.06;
          bullets.push({ x:p1.x + Math.cos(a)*20, y:p1.y + Math.sin(a)*20, vx:Math.cos(a)*760, vy:Math.sin(a)*760, size:5, hue:p1.colorHue, owner:'p0' });
        }
        spawnParticles(p1.x + Math.cos(aimAng)*16, p1.y + Math.sin(aimAng)*16, 'rgba(180,255,255,0.9)', 10, Math.PI*1.6, 2.0, 0.35);
        sfx('playerShot', 0.5);
      }
    }

    // P2 move (arrows), aim IJKL, shoot M
    const p2 = players[1];
    if(p2.active && p2.alive){
      let mx2=0,my2=0;
      if(keys['arrowleft']) mx2-=1; if(keys['arrowright']) mx2+=1; if(keys['arrowup']) my2-=1; if(keys['arrowdown']) my2+=1;
      const m2 = Math.hypot(mx2,my2)||1; mx2/=m2; my2/=m2;
      p2.vx += mx2 * p2.speed * dt * 3; p2.vy += my2 * p2.speed * dt * 3;
      const aimUp = keys['i'], aimDown = keys['k'], aimLeft = keys['j'], aimRight = keys['l'];
      let adx=0,ady=0; if(aimLeft) adx-=1; if(aimRight) adx+=1; if(aimUp) ady-=1; if(aimDown) ady+=1;
      if(adx||ady){ const m=Math.hypot(adx,ady)||1; p2.aimDir.x = adx/m; p2.aimDir.y = ady/m; }
      p2.reload -= dt;
      if(keys['m'] && p2.reload<=0){
        p2.reload = p2.fireRate;
        const ang2 = Math.atan2(p2.aimDir.y, p2.aimDir.x);
        for(let s=-1;s<=1;s++){
          const a = ang2 + s*0.08;
          bullets.push({ x:p2.x + Math.cos(a)*20, y:p2.y + Math.sin(a)*20, vx:Math.cos(a)*640, vy:Math.sin(a)*640, size:6, hue:p2.colorHue, owner:'p1' });
        }
        spawnParticles(p2.x + p2.aimDir.x*16, p2.y + p2.aimDir.y*16, 'rgba(255,210,200,0.9)', 8, Math.PI*1.4, 1.8, 0.32);
        sfx('playerShot', 0.45);
      }
    }
  }

  // movement damping and bounds for all players (even if not playing, stop any drift)
  for(const p of players){
    if(!p.active) continue;
    p.vx *= 0.86; p.vy *= 0.86;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.x = clamp(p.x, 40, W-40); p.y = clamp(p.y, 60, H-40);
  }

  // update bullets
  for(let i=bullets.length-1;i>=0;i--){
    const b = bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.vx *= 0.999; b.vy *= 0.999;
    if(b.x<-80 || b.x>W+80 || b.y<-80 || b.y>H+80) bullets.splice(i,1);
  }

  // enemies update
  for(let i=enemies.length-1;i>=0;i--){
    const e = enemies[i];
    e.update(dt);
    if(e.y>H+160){ enemies.splice(i,1); continue; }

    // collides with friendly bullets only during playing
    if(gameState==='playing'){
      for(let j=bullets.length-1;j>=0;j--){
        const b = bullets[j];
        if(b.hostile) continue;
        if(dist(b.x,b.y,e.x,e.y) < e.size + b.size){
          e.hp -= players[0].damage;
          spawnParticles(b.x,b.y, `hsla(${e.hue},80%,65%,1)`, 8, Math.PI*1.8, 2, 0.45);
          bullets.splice(j,1); addShake(0.5);
          if(e.hp<=0){
            spawnParticles(e.x,e.y, `hsla(${e.hue},90%,60%,1)`, 22, Math.PI*2, 3.0, 0.9);
            players.forEach(p=>{ if(p.active) p.score = (p.score||0) + Math.round(6+e.size); });
            enemies.splice(i,1); break;
          }
        }
      }
      // ram players
      for(const p of players){
        if(!(p.active && p.alive)) continue;
        if(dist(e.x,e.y,p.x,p.y) < e.size + p.size){
          p.hp -= 12;
          spawnParticles((e.x+p.x)/2,(e.y+p.y)/2,'rgba(255,120,120,0.95)',18,Math.PI*2,3.5,0.8);
          addShake(0.9);
          enemies.splice(i,1); break;
        }
      }
    }
  }

  // hostile bullets hit players only in playing state
  if(gameState==='playing'){
    for(let i=bullets.length-1;i>=0;i--){
      const b = bullets[i]; if(!b.hostile) continue;
      let hit = false;
      for(const p of players){
        if(!(p.active && p.alive)) continue;
        if(dist(b.x,b.y,p.x,p.y) < p.size + b.size){
          p.hp -= (b.owner==='boss')? 16 : 8;
          spawnParticles(p.x,p.y,'rgba(255,200,120,0.95)',12,Math.PI*2,3.2,0.6);
          addShake(0.8); bullets.splice(i,1); hit=true; break;
        }
      }
      if(hit) continue;
    }
  }

  // bosses
  for(let i=bosses.length-1;i>=0;i--){
    const B = bosses[i];
    B.update(dt);
    if(gameState==='playing'){
      for(let j=bullets.length-1;j>=0;j--){
        const b = bullets[j]; if(b.hostile) continue;
        if(dist(b.x,b.y,B.x,B.y) < B.size + b.size){
          B.hp -= players[0].damage;
          spawnParticles(b.x,b.y, `hsla(${B.hue},90%,60%,1)`, 8, Math.PI*1.8, 3.2, 0.45);
          bullets.splice(j,1); addShake(1.0);
          if(B.hp<=0){
            spawnParticles(B.x,B.y, `hsla(${B.hue},90%,60%,1)`, 72, Math.PI*2, 7, 1.6);
            addScoreAll(220);
            bosses.splice(i,1);
            difficulty = Math.max(1, difficulty-0.6);
            break;
          }
        }
      }
    }
  }

  // particles
  for(let i=particles.length-1;i>=0;i--){ particles[i].update(dt); if(particles[i].life<=0) particles.splice(i,1); }

  // spawning only in playing state
  if(gameState==='playing'){
    waveTime += dt;
    if(waveTime > spawnInterval){ spawnWave(); difficulty += 0.02; }
    // rare boss
    if(Math.random() < 0.0008 * difficulty && bosses.length===0 && totalScore() > 120 + difficulty*50){
      bosses.push(new Boss()); addShake(1.6);
    }
  }

  // deaths & gameover
  for(const p of players){
    if(p.alive && p.hp<=0){ p.alive=false; p.vx=0; p.vy=0; }
  }
  if(gameState==='playing'){
    const anyAlive = players.some(p=>p.active && p.alive);
    if(!anyAlive){
      gameState='gameover';
  {const __go=document.getElementById('gameOverScreen'); if(__go){ __go.style.display='flex'; }}
      // award points (sum of both)
      const gain = Math.round(totalScore()*0.5);
      save.totalPoints = (save.totalPoints||0) + gain; saveSave(save); updateUI();
      toMenuBGM();
    }
  }

  // shake decay
  if(shake>0) shake = Math.max(0, shake - dt*6);
}

function totalScore(){ return (players[0].score||0) + (players[1].score||0); }

/* =================== Render =================== */
function render(){
  const sx = (Math.random()*2-1)*shake*2;
  const sy = (Math.random()*2-1)*shake*2;
  ctx.setTransform(1,0,0,1,sx,sy);

  drawBackground();

  // bullets hostile
  for(const b of bullets){
    if(!b.hostile) continue;
    ctx.globalAlpha = 0.95;
    ctx.beginPath(); ctx.fillStyle = `hsl(${b.hue||10},90%,60%)`; ctx.arc(b.x,b.y,b.size,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1; ctx.beginPath(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.arc(b.x - b.vx*0.01, b.y - b.vy*0.01, Math.max(1.2,b.size*0.6),0,Math.PI*2); ctx.fill();
  }

  // enemies
  for(const e of enemies) e.draw(ctx);

  // bullets friendly
  for(const b of bullets){
    if(b.hostile) continue;
    ctx.beginPath(); ctx.globalAlpha = 0.6; ctx.fillStyle = `hsla(190,95%,60%,0.9)`; ctx.arc(b.x,b.y,b.size*1.8,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1; ctx.beginPath(); ctx.fillStyle = 'white'; ctx.arc(b.x,b.y,b.size*0.9,0,Math.PI*2); ctx.fill();
  }

  // particles
  for(const p of particles) p.draw(ctx);

  // players
  for(const pl of players){
    if(!pl.active) continue;
    if(pl.alive) drawShip(pl);
    else { // faint circle where dead
      ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = 'rgba(10,0,16,0.5)'; ctx.beginPath(); ctx.arc(pl.x,pl.y, 70,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
  }

  // bosses
  for(const B of bosses) B.draw(ctx);

  // HUD only when playing
  if(gameState!=='menu') drawHUD();

  // Game over overlay
  if(gameState==='gameover'){
    ctx.setTransform(1,0,0,1,0,0);
    ctx.save();
    ctx.fillStyle = 'rgba(4,0,6,0.55)'; ctx.fillRect(0,0,W,H);
    ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.font='800 44px Inter, Arial'; ctx.shadowColor='#ff6b9b'; ctx.shadowBlur=24;
    ctx.fillText('ALL PLAYERS DOWN', W/2, H/2 - 24);
    ctx.shadowBlur=0; ctx.font='600 18px Inter, Arial'; ctx.fillStyle='#bfe';
    ctx.fillText('Final Score: '+ totalScore() +'  •  Press START in menu to play again', W/2, H/2 + 18);
    ctx.restore();
  }

  // reset transform
  ctx.setTransform(1,0,0,1,0,0);
}

/* =================== Loop =================== */
function loop(){
  const now = performance.now()/1000;
  const dt = Math.min(0.033, now - lastTime);
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* =================== Controls & Menu =================== */
addEventListener('keydown', e=>{
  const k = e.key.toLowerCase();
  if(k==='p'){ paused = !paused; }
  if(k==='r' && gameState!=='menu'){ restart(false); }
});

function resetPlayersPositions(){
  players[0] = Object.assign(players[0], makePlayer(0, W*0.5, H*0.7, players[0].skin, players[0].colorHue));
  players[1] = Object.assign(players[1], makePlayer(1, W*0.4, H*0.8, players[1].skin, players[1].colorHue));
  if(gameMode==='single') setSingleMode(); else setCoopMode();
}

function restart(fromMenuStart=true){
  const __go=document.getElementById('gameOverScreen'); if(__go){ __go.style.display='none'; }

  bullets = []; enemies = []; bosses = []; particles = [];
  difficulty = 1; waveTime = 0; spawnInterval = 1.6;
  players[0].score = 0; players[1].score = 0;
  resetPlayersPositions();
  if(fromMenuStart){ gameState='playing'; toGameBGM(); } else { gameState='playing'; }
}

/* Skin & Map pickers */
$$('.skin-swatch').forEach(el=>{
  el.addEventListener('click', ()=>{
    $$('.skin-swatch').forEach(x=>x.classList.remove('sel'));
    el.classList.add('sel');
    const s = Number(el.dataset.skin);
    players[0].skin = s; players[0].colorHue = [190,10,270][s] ?? 190;
    players[1].skin = (s+1)%3; players[1].colorHue = [190,10,270][players[1].skin] ?? 320;
    updateUI();
  });
});
$$('.map-thumb').forEach(el=>{
  el.addEventListener('click', ()=>{
    $$('.map-thumb').forEach(x=>x.classList.remove('sel'));
    el.classList.add('sel');
    selectedMap = Number(el.dataset.map);
    initBg(); updateUI();
  });
});

// Mode radios
const modeRadios = $$('input[name="mode"]');
if(modeRadios.length){
  modeRadios.forEach(r => r.addEventListener('change', ()=>{
    gameMode = document.querySelector('input[name="mode"]:checked')?.value || 'single';
    if(gameMode==='single') setSingleMode(); else setCoopMode();
    updateUI();
  }));
  // init
  gameMode = document.querySelector('input[name="mode"]:checked')?.value || 'single';
  if(gameMode==='single') setSingleMode(); else setCoopMode();
}

// Start / Restart / Tutorial
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const tutorialBtn = document.getElementById('tutorialBtn');
if(startBtn){
  startBtn.addEventListener('click', ()=>{
    if(menu) menu.style.display='none';
    restart(true);
  });
}
if(restartBtn){ restartBtn.addEventListener('click', ()=> restart(false)); }
if(tutorialBtn){
  tutorialBtn.addEventListener('click', ()=>{
    alert('P1: WASD + Mouse + Click/Space to shoot\nP2: Arrow keys to move, I J K L to aim, M to shoot\nPause: P • Restart: R');
  });
}

// When overlay (menu) is visible, make sure state is menu
if(menu){ 
  // initial state
  gameState='menu'; toMenuBGM(); updateUI();
}

// Visibility pause
document.addEventListener('visibilitychange', ()=>{ if(document.hidden) paused = true; });

/* =================== Shop (applies to both players) =================== */
function trySpend(cost){
  if((save.totalPoints||0) < cost){ notify('Not enough points'); return false; }
  save.totalPoints -= cost; saveSave(save); updateUI(); notify('Purchased!'); return true;
}
function applyBuffs(){
  // Example: reflect basic upgrades from save.upgrades
  const up = save.upgrades || {};
  const fireMul = 1 - (up.fireRateLevel||0)*0.04; // faster
  const dmgAdd  = (up.damageLevel||0)*2;
  players.forEach(p=>{
    p.fireRate = clamp(p.fireRate * fireMul, 0.04, 0.3);
    p.damage = 8 + dmgAdd;
  });
}
function inc(obj, key){ obj[key] = (obj[key]||0) + 1; }

const btnFire = document.getElementById('upgradeFireRate');
const btnDmg  = document.getElementById('upgradeDamage');
if(btnFire) btnFire.addEventListener('click', ()=>{ if(trySpend(500)){ save.upgrades=save.upgrades||{}; inc(save.upgrades,'fireRateLevel'); saveSave(save); applyBuffs(); } });
if(btnDmg)  btnDmg.addEventListener('click',  ()=>{ if(trySpend(1000)){ save.upgrades=save.upgrades||{}; inc(save.upgrades,'damageLevel'); saveSave(save); applyBuffs(); } });

applyBuffs();
updateUI();

})();

// Added Menu Button on Game Over (fallback)
function addMenuButtonOnGameOver(){
  const menuBtn = document.createElement('button');
  menuBtn.textContent = 'Menu';
  menuBtn.style.marginTop = '10px';
  menuBtn.addEventListener('click', () => {
      if (typeof window.returnToMenu === 'function') {
          window.returnToMenu();
      }
      document.getElementById('menu').style.display = 'flex';
  });
  const notifyEl = document.getElementById('notify');
  if (notifyEl) notifyEl.appendChild(menuBtn);
}


/* ===== Ensure Game Over overlay integration & returnToMenu ===== */
(function(){
  function showGameOverOverlay() {
    const go = document.getElementById('gameOverScreen');
    if (go) go.style.display = 'flex';
  }
  function hideGameOverOverlay() {
    const go = document.getElementById('gameOverScreen');
    if (go) go.style.display = 'none';
  }
  // Expose helper to other code if needed
  window.__showGameOverOverlay = showGameOverOverlay;
  window.__hideGameOverOverlay = hideGameOverOverlay;

  // Provide returnToMenu if page doesn't define (HTML already defines it; this is fallback)
  if (!window.returnToMenu) {
    window.returnToMenu = function(){
      hideGameOverOverlay();
      const menu = document.getElementById('menu');
      if (menu) menu.style.display = 'flex';
      try { if (window.audio && typeof audio.toMenu === 'function') audio.toMenu(); } catch(e){}
      try { gameState = 'menu'; updateUI && updateUI(); } catch(e){}
    };
  }
})();
