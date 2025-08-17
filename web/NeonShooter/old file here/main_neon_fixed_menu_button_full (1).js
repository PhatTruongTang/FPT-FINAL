
// ===== Neon Shooter (Rebuilt Main) - Missile + Rainbow Laser + Granular Upgrades =====
// Controls (P1):
//   - Move: WASD / Arrow keys (optional simple drift AI if no input)
//   - Fire bullets + missiles: Left Mouse / Space
//   - Fire laser: Right Mouse / N
// Controls (P2 optional demo):
//   - Fire bullets + missiles: M
//   - Fire laser: N
//
// This file is self-contained and designed to work with NeonShooter.html from your project.
// It integrates with DOM elements: #c (canvas), #menu, #totalPoints, #shop, #startBtn, #tutorialBtn,
// #gameOverScreen, and will dynamically build upgrade buttons under #shop.
//
// The design is data-driven for upgrades so you can extend easily.
//
// -------------------------------------------------------------------------------------

(function(){
'use strict';

/* ================= Canvas & Context ================= */
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha:false });
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
addEventListener('resize', ()=>{ W=canvas.width=innerWidth; H=canvas.height=innerHeight; });

/* ================= Game State ================= */
let gameState = 'menu'; // 'menu' | 'playing' | 'gameover'
let time = 0;
let dt = 0;
let last = performance.now();
let paused = false;

/* ================= Save / Load ================= */
const SAVE_KEY = 'neon_save_v2';
const defaultSave = {
  totalPoints: 0,
  upgrades: {
    // legacy basic
    fireRateLevel: 0,
    damageLevel: 0,

    // missile
    missileUnlocked: false,
    missileFireRateLevel: 0,
    missileExplosionRadiusLevel: 0,
    missileSpeedLevel: 0,
    missileHomingStrengthLevel: 0,
    missileDamageLevel: 0,

    // laser
    laserUnlocked: false,
    laserFireRateLevel: 0,
    laserDurationLevel: 0,
    laserTickRateLevel: 0,
    laserPierceUnlocked: false,
    laserDamageLevel: 0,
    laserSizeLevel: 0
  }
};
function loadSave(){
  try{
    return Object.assign({}, defaultSave, JSON.parse(localStorage.getItem(SAVE_KEY)||'{}'));
  }catch(e){ return JSON.parse(JSON.stringify(defaultSave)); }
}
function saveSave(){ localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }
let save = loadSave();

/* ================= Player, Enemies, Projectiles ================= */
const rand = (a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const TAU = Math.PI*2;

const players = [createPlayer(W*0.5, H*0.65)];
function createPlayer(x,y){
  return {
    x, y, vx:0, vy:0, r:14,
    hp: 3, alive:true,
    shootCooldown: 0,
    missileCooldown: 0,
    laserCooldown: 0,
    // Laser active state
    laserActive: false,
    laserTime: 0,
    // Scalers (base values, will be modified by applyBuffs)
    bulletDamage: 8,
    bulletFireInterval: 0.20, // seconds between normal shots
    missileInterval: 1.50,    // seconds
    missileDamage: 40,
    missileSpeed: 300,
    missileHoming: 2.0,       // rad/sec steering
    missileExplRadius: 80,
    laserInterval: 5.0,       // seconds (cooldown)
    laserDuration: 1.20,      // seconds laser on
    laserTick: 0.08,          // seconds per damage tick
    laserDamage: 12,          // per tick
    laserWidth: 6,            // px
    // inputs
    inputFire: false,
    inputLaser: false,
  };
}

const bullets = []; // {x,y,vx,vy,damage,life}
const missiles = []; // {x,y,vx,vy,damage,expl,homing}
const enemies = []; // {x,y,vx,vy,r,hp,score}
const particles = []; // {x,y,vx,vy,life,col,size}
const beams = []; // transient visuals for laser impact

/* ================= Inputs ================= */
const keys = {};
addEventListener('keydown', e=>{ keys[e.code]=true; if(e.code==='Space') players[0].inputFire=true; if(e.code==='KeyN') players[0].inputLaser=true; });
addEventListener('keyup', e=>{ keys[e.code]=false; if(e.code==='Space') players[0].inputFire=false; if(e.code==='KeyN') players[0].inputLaser=false; });
let mouseX=W/2, mouseY=H/3, mouseDown=false, mouseRight=false;
canvas.addEventListener('mousemove', e=>{ mouseX=e.clientX; mouseY=e.clientY; });
canvas.addEventListener('mousedown', e=>{
  if(e.button===0){ mouseDown=true; players[0].inputFire=true; }
  if(e.button===2){ mouseRight=true; players[0].inputLaser=true; }
});
addEventListener('mouseup', e=>{
  if(e.button===0){ mouseDown=false; players[0].inputFire=false; }
  if(e.button===2){ mouseRight=false; players[0].inputLaser=false; }
});
canvas.addEventListener('contextmenu', e=>e.preventDefault());

/* ================= UI Elements ================= */
const elMenu = document.getElementById('menu');
const elTotal = document.getElementById('totalPoints');
const elShop = document.getElementById('shop') || createShopContainer();
const elStart = document.getElementById('startBtn');
const elTutorial = document.getElementById('tutorialBtn');
const elGameOver = document.getElementById('gameOverScreen');
const elNotify = document.getElementById('notify');

function createShopContainer(){
  const div = document.createElement('div');
  div.id='shop';
  const wrapper = document.querySelector('#menu .wrapper');
  if(wrapper) wrapper.appendChild(div);
  else document.body.appendChild(div);
  return div;
}
function notify(msg){
  if(!elNotify) return;
  const d=document.createElement('div');
  d.className='toast';
  d.textContent=msg;
  elNotify.appendChild(d);
  setTimeout(()=>d.remove(), 1800);
}
function updateUI(){
  if(elTotal) elTotal.textContent = 'Points: ' + Math.floor(save.totalPoints||0);
}

/* ================= Upgrade System (Data-Driven) ================= */
// Cost curve helper
function cost(base, level){ return Math.floor(base * Math.pow(1.6, level)); }

const upgradeDefs = [
  // Basic
  { key:'fireRateLevel', label:'Fire Rate +', desc:'Bắn nhanh hơn', baseCost:400, max:20,
    onApply(p,lv){ p.bulletFireInterval = clamp(0.20 * (1 - lv*0.04), 0.05, 0.20); } },
  { key:'damageLevel', label:'Bullet Damage +', desc:'Đạn thường mạnh hơn', baseCost:800, max:30,
    onApply(p,lv){ p.bulletDamage = 8 + lv*2; } },

  // Missile
  { key:'missileUnlocked', label:'Unlock Missile', unlock:true, baseCost:2000 },
  { key:'missileFireRateLevel', label:'Missile Fire Rate +', req:'missileUnlocked', baseCost:900, max:15,
    onApply(p,lv){ p.missileInterval = clamp(1.50 * Math.pow(0.92, lv), 0.25, 1.50); } },
  { key:'missileExplosionRadiusLevel', label:'Missile Explosion Radius +', req:'missileUnlocked', baseCost:800, max:15,
    onApply(p,lv){ p.missileExplRadius = 80 + lv*8; } },
  { key:'missileSpeedLevel', label:'Missile Speed +', req:'missileUnlocked', baseCost:800, max:20,
    onApply(p,lv){ p.missileSpeed = 300 + lv*18; } },
  { key:'missileHomingStrengthLevel', label:'Missile Homing +', req:'missileUnlocked', baseCost:800, max:20,
    onApply(p,lv){ p.missileHoming = 2.0 + lv*0.15; } },
  { key:'missileDamageLevel', label:'Missile Damage +', req:'missileUnlocked', baseCost:1000, max:25,
    onApply(p,lv){ p.missileDamage = 40 + lv*6; } },

  // Laser
  { key:'laserUnlocked', label:'Unlock Laser', unlock:true, baseCost:5000 },
  { key:'laserFireRateLevel', label:'Laser Fire Rate +', req:'laserUnlocked', baseCost:1200, max:15,
    onApply(p,lv){ p.laserInterval = clamp(5.0 * Math.pow(0.90, lv), 0.8, 5.0); } },
  { key:'laserDurationLevel', label:'Laser Duration +', req:'laserUnlocked', baseCost:1200, max:15,
    onApply(p,lv){ p.laserDuration = 1.2 + lv*0.08; } },
  { key:'laserTickRateLevel', label:'Laser Tick Rate +', req:'laserUnlocked', baseCost:1200, max:15,
    onApply(p,lv){ p.laserTick = clamp(0.08 * Math.pow(0.93, lv), 0.016, 0.08); } },
  { key:'laserPierceUnlocked', label:'Laser Pierce (Unlock)', req:'laserUnlocked', unlock:true, baseCost:3000 },
  { key:'laserDamageLevel', label:'Laser Damage +', req:'laserUnlocked', baseCost:1400, max:25,
    onApply(p,lv){ p.laserDamage = 12 + lv*2.5; } },
  { key:'laserSizeLevel', label:'Laser Size +', req:'laserUnlocked', baseCost:1200, max:15,
    onApply(p,lv){ p.laserWidth = 6 + lv*0.6; } },
];

function applyBuffs(){
  const up = save.upgrades || {};
  players.forEach(p=>{
    // reset to base then apply
    p.bulletDamage = 8;
    p.bulletFireInterval = 0.20;
    p.missileInterval = 1.50;
    p.missileDamage = 40;
    p.missileSpeed = 300;
    p.missileHoming = 2.0;
    p.missileExplRadius = 80;
    p.laserInterval = 5.0;
    p.laserDuration = 1.2;
    p.laserTick = 0.08;
    p.laserDamage = 12;
    p.laserWidth = 6;
    // apply defs
    upgradeDefs.forEach(def=>{
      const lv = !!def.unlock ? (up[def.key] ? 1 : 0) : (up[def.key]||0);
      if(def.onApply) def.onApply(p, lv);
    });
  });
}
applyBuffs();

function buildShop(){
  if(!elShop) return;
  elShop.innerHTML = '';
  upgradeDefs.forEach(def=>{
    // visibility condition
    if(def.req && !save.upgrades[def.req]) return;

    const wrap = document.createElement('div');
    wrap.className = 'shop-item';

    const btn = document.createElement('button');
    let label = def.label;
    let lvlStr = '';
    let isUnlocked = !!save.upgrades[def.key];
    if(def.unlock){
      label = isUnlocked ? (def.label + ' ✓') : def.label;
    }else{
      const lv = save.upgrades[def.key]||0;
      lvlStr = ` (Lv ${lv})`;
    }
    btn.textContent = label + lvlStr + ' (' + cost(def.baseCost, (save.upgrades[def.key]||0)) + ')';
    btn.addEventListener('click', ()=>{
      buyUpgrade(def);
    });
    wrap.appendChild(btn);

    if(def.desc){
      const small = document.createElement('div');
      small.className='desc';
      small.textContent = def.desc;
      wrap.appendChild(small);
    }
    elShop.appendChild(wrap);
  });
}
function buyUpgrade(def){
  // check prereq
  if(def.req && !save.upgrades[def.req]){ notify('Need to unlock first'); return; }
  if(def.unlock && save.upgrades[def.key]){ notify('Already unlocked'); return; }
  const current = save.upgrades[def.key]||0;
  if(!def.unlock && def.max!=null && current>=def.max){ notify('Max level'); return; }
  const c = cost(def.baseCost, current);
  if((save.totalPoints||0) < c){ notify('Not enough points'); return; }
  save.totalPoints -= c;
  if(def.unlock){ save.upgrades[def.key]=true; } else { save.upgrades[def.key]=(current+1); }
  saveSave();
  applyBuffs();
  updateUI();
  buildShop();
  notify('Purchased!');
}

/* ================= Menu / Start / Game Over ================= */
if(elStart){
  elStart.addEventListener('click', ()=>{
    gameStart();
  });
}
if(elTutorial){
  elTutorial.addEventListener('click', ()=>{
    notify('Move with WASD / arrows. Left click or Space to shoot. Right click or N for Laser.');
  });
}
function gameStart(){
  gameState='playing';
  elMenu && (elMenu.style.display='none');
  elGameOver && (elGameOver.style.display='none');
  resetGame();
}
function gameOver(){
  gameState='gameover';
  elGameOver && (elGameOver.style.display='flex');
}
function resetGame(){
  enemies.length=0; bullets.length=0; missiles.length=0; particles.length=0; beams.length=0;
  players.forEach(p=>{
    p.x=W*0.5; p.y=H*0.7; p.vx=0; p.vy=0; p.hp=3; p.alive=true;
    p.shootCooldown=0; p.missileCooldown=0; p.laserCooldown=0; p.laserActive=false; p.laserTime=0;
  });
  waveTime=0; score=0;
}

/* ================= Enemy Spawning ================= */
let waveTime = 0;
let score = 0;
function spawnEnemy(){
  const side = Math.random()<0.5?'top':'side';
  let x,y;
  if(side==='top'){ x = rand(40,W-40); y=-20; }
  else{ x = Math.random()<0.5?-20:W+20; y = rand(40,H*0.6); }
  const r = rand(10,22);
  const hp = 20 + r*3 + score*0.02;
  const sp = rand(30,80);
  const ang = Math.atan2(players[0].y - y, players[0].x - x);
  enemies.push({x,y,vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, r, hp, score: Math.floor(r*2)});
}

/* ================= Combat ================= */
function fireBullet(p){
  const ang = Math.atan2(mouseY - p.y, mouseX - p.x);
  const spd = 620;
  bullets.push({x:p.x, y:p.y, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd, damage:p.bulletDamage, life:1.8});
  // small muzzle flash
  for(let i=0;i<4;i++){
    particles.push({x:p.x,y:p.y,vx:rand(-60,60),vy:rand(-60,60),life:0.2,col:'rgba(180,255,255,0.8)',size:2});
  }
}
function fireMissile(p){
  // Requires unlock
  if(!save.upgrades.missileUnlocked) return;
  const target = nearestEnemy(p.x, p.y);
  const ang = target ? Math.atan2(target.y-p.y, target.x-p.x) : Math.atan2(mouseY-p.y, mouseX-p.x);
  const spd = p.missileSpeed;
  missiles.push({x:p.x, y:p.y, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd, damage:p.missileDamage, expl:p.missileExplRadius, homing:p.missileHoming, life:6});
  // flame
  for(let i=0;i<8;i++){
    const a = rand(0,TAU);
    particles.push({x:p.x-Math.cos(ang)*8, y:p.y-Math.sin(ang)*8, vx:Math.cos(a)*40, vy:Math.sin(a)*40, life:0.4, col:'rgba(255,200,50,0.9)', size:2});
  }
}
function nearestEnemy(x,y){
  let best=null, bd=1e9;
  for(const e of enemies){
    const d2=(e.x-x)*(e.x-x)+(e.y-y)*(e.y-y);
    if(d2<bd){ bd=d2; best=e; }
  }
  return best;
}
function explode(x,y,r,damage){
  for(let i=0;i<30;i++){
    const a = rand(0,TAU), sp=rand(40,240);
    const col = i%2?'rgba(120,255,255,0.9)':'rgba(255,80,180,0.9)';
    particles.push({x,y,vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:rand(0.3,0.9), col, size:rand(1,3)});
  }
  // damage enemies in radius
  for(const e of enemies){
    const dx=e.x-x, dy=e.y-y;
    const d = Math.hypot(dx,dy);
    if(d<=r){
      e.hp -= damage * (1 - d/r*0.5); // falloff
    }
  }
}

function fireLaser(p){
  if(!save.upgrades.laserUnlocked) return;
  if(p.laserActive) return;
  if(p.laserCooldown>0) return;
  p.laserActive = true;
  p.laserTime = 0;
  p.laserCooldown = p.laserInterval;
}

// Laser color helper
function rainbow(t){
  // t in seconds → hue 0..360
  const hue = (t*360)%360;
  return `hsl(${hue}, 90%, 60%)`;
}

/* ================= Update Loop ================= */
function updatePlayer(p, dt){
  // simple mouse-seeking drift to feel dynamic
  const ax = (mouseX - p.x)*0.001;
  const ay = (mouseY - p.y)*0.001;
  p.vx += ax*dt*1000; p.vy += ay*dt*1000;
  p.vx *= 0.95; p.vy *= 0.95;
  p.x += p.vx*dt; p.y += p.vy*dt;
  p.x = clamp(p.x, 20, W-20); p.y = clamp(p.y, 20, H-20);

  // cooldowns
  if(p.shootCooldown>0) p.shootCooldown-=dt;
  if(p.missileCooldown>0) p.missileCooldown-=dt;
  if(p.laserCooldown>0) p.laserCooldown-=dt;

  // fire bullets (and missile) with left click / Space
  if(p.alive && (players[0]===p) && (mouseDown || keys['Space'])){
    if(p.shootCooldown<=0){
      fireBullet(p);
      p.shootCooldown = p.bulletFireInterval;
      // also missile if ready
      if(save.upgrades.missileUnlocked && p.missileCooldown<=0){
        fireMissile(p);
        p.missileCooldown = p.missileInterval;
      }
    }
  }

  // fire laser with right click / N
  if(p.alive && (players[0]===p) && (mouseRight || keys['KeyN'])){
    fireLaser(p);
  }

  // active laser ticks
  if(p.laserActive){
    p.laserTime += dt;
    // damage ticks
    const tickInt = p.laserTick;
    if(!p._laserTickAcc) p._laserTickAcc = 0;
    p._laserTickAcc += dt;
    while(p._laserTickAcc >= tickInt){
      p._laserTickAcc -= tickInt;
      // apply damage along beam line
      const ang = Math.atan2(mouseY - p.y, mouseX - p.x);
      const maxLen = Math.hypot(W,H);
      const endX = p.x + Math.cos(ang)*maxLen;
      const endY = p.y + Math.sin(ang)*maxLen;
      laserDamageSweep(p, p.laserDamage, p.laserWidth, ang, save.upgrades.laserPierceUnlocked, endX, endY);
    }
    if(p.laserTime >= p.laserDuration){
      p.laserActive = false;
      p.laserCooldown = p.laserInterval;
      p._laserTickAcc = 0;
    }
  }
}
function laserDamageSweep(p, damage, width, ang, pierce, endX, endY){
  // line collision: distance from enemy to line segment
  const sx=p.x, sy=p.y;
  for(const e of enemies){
    // project point on ray
    const px=e.x-sx, py=e.y-sy;
    const proj = px*Math.cos(ang) + py*Math.sin(ang);
    if(proj < -e.r) continue;
    const closestX = sx + Math.cos(ang)*proj;
    const closestY = sy + Math.sin(ang)*proj;
    const d = Math.hypot(e.x-closestX, e.y-closestY);
    if(d <= e.r + width*0.6){
      e.hp -= damage;
      beams.push({x:e.x,y:e.y,life:0.12});
      if(!pierce){
        // if not pierce, only damage first hit (approx: stop further checks)
        break;
      }
    }
  }
  // rainbow spark particles along line
  for(let i=0;i<3;i++){
    const t = Math.random()*0.3;
    const lx = sx + Math.cos(ang)*rand(40, 220);
    const ly = sy + Math.sin(ang)*rand(40, 220);
    particles.push({x:lx,y:ly,vx:rand(-30,30),vy:rand(-30,30),life:0.25,col:rainbow(time*0.001+Math.random()),size:1.6});
  }
}

function updateBullets(dt){
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    b.x += b.vx*dt; b.y += b.vy*dt;
    b.life -= dt;
    // collide
    for(const e of enemies){
      const d = Math.hypot(e.x-b.x, e.y-b.y);
      if(d < e.r+3){
        e.hp -= b.damage;
        bullets.splice(i,1);
        particles.push({x:b.x,y:b.y,vx:0,vy:0,life:0.15,col:'rgba(200,255,255,0.9)',size:2});
        break;
      }
    }
    if(b.life<=0 || b.x<-20||b.x>W+20||b.y<-20||b.y>H+20) bullets.splice(i,1);
  }
}
function updateMissiles(dt){
  for(let i=missiles.length-1;i>=0;i--){
    const m=missiles[i];
    const t = nearestEnemy(m.x, m.y);
    if(t){
      const ang = Math.atan2(t.y-m.x? (t.y-m.y):0, t.x-m.x); // safe
      const desAng = Math.atan2(t.y-m.y, t.x-m.x);
      const velAng = Math.atan2(m.vy, m.vx);
      let diff = desAng - velAng;
      while(diff>Math.PI) diff-=TAU;
      while(diff<-Math.PI) diff+=TAU;
      const turn = clamp(diff, -m.homing*dt, m.homing*dt);
      const spd = Math.hypot(m.vx,m.vy);
      const newAng = velAng + turn;
      m.vx = Math.cos(newAng)*spd;
      m.vy = Math.sin(newAng)*spd;
    }
    m.x += m.vx*dt; m.y += m.vy*dt;
    m.life -= dt;

    // collision
    let hit=false;
    for(const e of enemies){
      const d = Math.hypot(e.x-m.x, e.y-m.y);
      if(d < e.r+6){ hit=true; break; }
    }
    if(hit || m.life<=0 || m.x<-40||m.x>W+40||m.y<-40||m.y>H+40){
      explode(m.x,m.y,m.expl,m.damage);
      missiles.splice(i,1);
    }else{
      // exhaust
      particles.push({x:m.x - m.vx*0.02, y:m.y - m.vy*0.02, vx:rand(-20,20), vy:rand(-20,20), life:0.2, col:'rgba(255,180,60,0.8)', size:1.5});
    }
  }
}
function updateEnemies(dt){
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];
    e.x += e.vx*dt; e.y += e.vy*dt;
    // wrap or bounce
    if(e.x<-60||e.x>W+60||e.y<-80||e.y>H+40){ enemies.splice(i,1); continue; }
    if(e.hp<=0){
      save.totalPoints += e.score||5;
      score += e.score||5;
      saveSave(); updateUI();
      explode(e.x,e.y, e.r*1.2, 0);
      enemies.splice(i,1);
    }
  }
}

/* ================= Rendering ================= */
function clear(){
  ctx.fillStyle = '#020006';
  ctx.fillRect(0,0,W,H);
}
function drawGrid(){
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = '#66e6ff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const s=40;
  for(let x=0;x<=W;x+=s){ ctx.moveTo(x,0); ctx.lineTo(x,H); }
  for(let y=0;y<=H;y+=s){ ctx.moveTo(0,y); ctx.lineTo(W,y); }
  ctx.stroke();
  ctx.restore();
}
function drawPlayer(p){
  ctx.save();
  ctx.translate(p.x,p.y);
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#0ff';
  ctx.beginPath();
  ctx.arc(0,0,p.r,0,TAU);
  ctx.fill();
  ctx.restore();

  // if laser active, draw beam
  if(p.laserActive){
    const ang = Math.atan2(mouseY - p.y, mouseX - p.x);
    const len = Math.hypot(W,H);
    const ex = p.x + Math.cos(ang)*len;
    const ey = p.y + Math.sin(ang)*len;
    // glow
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    const g = ctx.createLinearGradient(p.x,p.y,ex,ey);
    const t = time*0.001;
    g.addColorStop(0, rainbow(t));
    g.addColorStop(0.5, rainbow(t+0.33));
    g.addColorStop(1, rainbow(t+0.66));
    ctx.strokeStyle = g;
    ctx.lineWidth = p.laserWidth*1.6;
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(ex,ey); ctx.stroke();
    // core
    ctx.globalAlpha = 1;
    ctx.lineWidth = p.laserWidth;
    ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(ex,ey); ctx.stroke();
    // tips
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.laserWidth*0.6,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(ex,ey,p.laserWidth*0.4,0,TAU); ctx.fill();
    ctx.restore();
  }
}
function drawBullets(){
  ctx.save();
  ctx.fillStyle='#bff';
  for(const b of bullets){
    ctx.beginPath(); ctx.arc(b.x,b.y,2.4,0,TAU); ctx.fill();
  }
  ctx.restore();
}
function drawMissiles(){
  ctx.save();
  ctx.fillStyle='#ffd166';
  ctx.strokeStyle='#ff6b9b';
  for(const m of missiles){
    ctx.beginPath(); ctx.arc(m.x,m.y,4.5,0,TAU); ctx.fill();
  }
  ctx.restore();
}
function drawEnemies(){
  ctx.save();
  for(const e of enemies){
    ctx.shadowColor = '#f0f';
    ctx.shadowBlur = 10;
    ctx.fillStyle='#ff66cc';
    ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,TAU); ctx.fill();
  }
  ctx.restore();
}
function drawParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.x += p.vx*dt; p.y += p.vy*dt;
    p.life -= dt;
    if(p.life<=0){ particles.splice(i,1); continue; }
    ctx.save();
    ctx.globalAlpha = clamp(p.life*2,0,1);
    ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.size||2,0,TAU); ctx.fill();
    ctx.restore();
  }
  // beams (laser impact sparks)
  for(let i=beams.length-1;i>=0;i--){
    const b=beams[i];
    b.life -= dt;
    if(b.life<=0){ beams.splice(i,1); continue; }
    ctx.save();
    ctx.globalAlpha = b.life*2;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(b.x,b.y,4*(b.life+0.2),0,TAU); ctx.fill();
    ctx.restore();
  }
}
function drawHUD(){
  ctx.save();
  ctx.textAlign='left';
  ctx.fillStyle='#bfe';
  ctx.font='600 14px Inter, Arial';
  ctx.fillText('Score: '+Math.floor(score), 16, 22);
  ctx.fillText('Points: '+Math.floor(save.totalPoints||0), 16, 40);
  ctx.restore();
}

function renderGameOverDim(){
  ctx.save();
  ctx.fillStyle='rgba(4,0,6,0.55)';
  ctx.fillRect(0,0,W,H);
  ctx.restore();
}

/* ================= Main Loop ================= */
function tick(now){
  dt = (now-last)/1000; if(dt>0.05) dt=0.05; last=now; time += dt*1000;

  clear();
  drawGrid();

  if(gameState==='playing'){
    // spawn
    waveTime += dt;
    if(waveTime>0.6){
      waveTime=0;
      if(Math.random()<0.9) spawnEnemy();
    }

    // update
    updateEnemies(dt);
    updateBullets(dt);
    updateMissiles(dt);
    players.forEach(p=>updatePlayer(p,dt));

    // check player death (touch enemy)
    for(const p of players){
      if(!p.alive) continue;
      for(const e of enemies){
        const d = Math.hypot(e.x-p.x, e.y-p.y);
        if(d < e.r + p.r){
          p.hp--; explode(p.x,p.y, 60, 0);
          if(p.hp<=0){ p.alive=false; gameOver(); }
          break;
        }
      }
    }

    // render
    drawEnemies();
    drawMissiles();
    drawBullets();
    players.forEach(p=>drawPlayer(p));
    drawParticles(dt);
    drawHUD();

  }else if(gameState==='menu'){
    // subtle background anim
    drawEnemies(); drawMissiles(); drawBullets(); drawParticles(dt);
    ctx.save();
    ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.font='800 44px Inter, Arial';
    ctx.shadowColor='#ff6b9b'; ctx.shadowBlur=24;
    ctx.fillText('NEON SHOOTER', W/2, H*0.35);
    ctx.restore();
    // Build shop each frame once
  }else if(gameState==='gameover'){
    drawEnemies(); drawMissiles(); drawBullets(); drawParticles(dt);
    renderGameOverDim();
    ctx.save();
    ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.font='800 44px Inter, Arial';
    ctx.shadowColor='#ff6b9b'; ctx.shadowBlur=24;
    ctx.fillText('ALL PLAYERS DOWN', W/2, H/2 - 24);
    ctx.shadowBlur=0; ctx.font='600 18px Inter, Arial'; ctx.fillStyle='#bfe';
    ctx.fillText('Final Score: '+Math.floor(score)+'  •  Press Menu to return', W/2, H/2 + 18);
    ctx.restore();
  }

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* ================= Initial UI Setup ================= */
updateUI();
buildShop();

// Menu visible by default
if(elMenu){ gameState='menu'; elMenu.style.display='flex'; }
// Game Over overlay Menu button handled in HTML

// Expose returnToMenu for HTML button
window.returnToMenu = function(){
  gameState='menu';
  elMenu && (elMenu.style.display='flex');
  elGameOver && (elGameOver.style.display='none');
  updateUI(); buildShop();
};

// Start when called by HTML
window.gameStart = gameStart;

// Add a safe hook so the Menu button from Game Over always works
(function ensureGameOverMenuBtnHook(){
  const gos = document.getElementById('gameOverScreen');
  if(!gos) return;
  const btn = gos.querySelector('#menuBtn');
  if(btn){
    btn.onclick = ()=> window.returnToMenu();
  }
})();

})(); // IIFE
