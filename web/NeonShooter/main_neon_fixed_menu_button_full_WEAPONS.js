// ===== Neon Shooter - FULL MAIN (Weapons + FX Upgrade + Safe BGM) =====
// Nâng cấp: muzzle flash, engine trail, missile launch/explosion, laser impact,
// nổ theo kích cỡ (enemy nhỏ/vừa/to + boss + player), shake boss, BGM crossfade-safe,
// SFX purchase/decline (tận dụng âm cũ), fix double BGM ở gameover.
// Lưu/Load y nguyên (Points + Upgrades). Giữ nguyên API audio hiện có.

// ---------------------- Save / Load (points + upgrades) ----------------------
const SAVE_KEY = 'neon_shooter_weapons_v1';
function loadSave() {
  try { const raw = localStorage.getItem(SAVE_KEY); return sanitizeSave(raw?JSON.parse(raw):null); }
  catch { return sanitizeSave(null); }
}
function sanitizeSave(s) {
  const def = {
    totalPoints: 0,
    upgrades: {
      bullet: { fireRate: 0, damage: 0 },
      missile: { unlocked: false, fireRate: 0, speed: 0, homing: 0, blast: 0, damage: 0 },
      laser: { unlocked: false, fireRate: 0, duration: 0, tick: 0, pierce: false, damage: 0, size: 0 }
    }
  };
  if(!s||typeof s!=='object') return def;
  const out = { ...def, ...s, upgrades:{...def.upgrades, ...(s.upgrades||{})} };
  out.upgrades.bullet  ={...def.upgrades.bullet, ...(out.upgrades.bullet||{})};
  out.upgrades.missile ={...def.upgrades.missile, ...(out.upgrades.missile||{})};
  out.upgrades.laser   ={...def.upgrades.laser, ...(out.upgrades.laser||{})};
  if(typeof out.totalPoints!=='number'||!isFinite(out.totalPoints)) out.totalPoints=0;
  return out;
}
function saveSave(obj){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify({ totalPoints: obj.totalPoints|0, upgrades: obj.upgrades })); }catch{} }
let save = loadSave();

// ---------------------- Canvas / DOM ----------------------
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha:false });
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
addEventListener('resize', ()=>{ W=canvas.width=innerWidth; H=canvas.height=innerHeight; });

const UI = document.getElementById('ui');
const hudPlayers = document.getElementById('hud-players');
const credits = document.getElementById('credits');
const menu = document.getElementById('menu');
const totalPointsLabel = document.getElementById('totalPoints');
const notifyEl = document.getElementById('notify');

// ---------------------- Helpers ----------------------
const $  = s=>document.querySelector(s);
const $$ = s=>Array.from(document.querySelectorAll(s));
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rand  = (a,b)=>Math.random()*(b-a)+a;
const dist2 = (x1,y1,x2,y2)=>{const dx=x2-x1,dy=y2-y1;return dx*dx+dy*dy;};

// ---------------------- Game State ----------------------
let gameState='menu';       // 'menu' | 'playing' | 'gameover'
let gameMode='single';      // 'single' | 'coop'
let paused=false;
let lastTime=performance.now()/1000;
let difficulty=1;
let waveTime=0;
let spawnInterval=1.6;
let selectedMap=0;

// ---------------------- Input ----------------------
const keys={};
addEventListener('keydown', e=>{ keys[e.key.toLowerCase()]=true; if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())) e.preventDefault(); });
addEventListener('keyup', e=> keys[e.key.toLowerCase()]=false);
const mouse={x:W/2,y:H/2,left:false,right:false};
canvas.addEventListener('mousemove', e=>{ mouse.x=e.clientX; mouse.y=e.clientY; });
canvas.addEventListener('mousedown', e=>{ if(e.button===0) mouse.left=true; if(e.button===2) mouse.right=true; });
canvas.addEventListener('mouseup',   e=>{ if(e.button===0) mouse.left=false; if(e.button===2) mouse.right=false; });
canvas.addEventListener('contextmenu', e=>e.preventDefault());

// ---------------------- Audio (safe wrappers + BGM guard) ----------------------
let _bgmState = 'menu'; // 'menu' | 'game'
function _crossfadeTo(target /* 'menu'|'game' */){
  if(_bgmState===target) return;
  _bgmState = target;
  try{
    if(!window.audio) return;
    // Nếu AudioManager có fadeTo(trackName, sec) dùng crossfade; không thì dùng API cũ.
    if(typeof audio.fadeTo==='function'){
      const track = target==='menu' ? 'bgmMenu' : (Math.random()<0.5?'bgmGame1':'bgmGame2');
      audio.fadeTo(track, 1.25);
    } else {
      if(target==='menu') audio.toMenu(); else audio.toGame();
    }
  }catch{}
}
function sfxShot()        { try{ if(window.audio?.unlocked) audio.sfx('playerShot',{vol:0.55}); }catch{} }
function sfxEnemyShot()   { try{ if(window.audio?.unlocked) audio.sfx('enemyShot',{vol:0.5}); }catch{} }
function sfxExpl(size='small'){ try{ if(window.audio?.unlocked) audio.explosion(size); }catch{} }
function sfxUpgradeOK()   { try{ if(window.audio?.unlocked) audio.sfx('upgrade',{vol:0.7}); }catch{} }   // tái dụng
function sfxDecline()     { try{ if(window.audio?.unlocked) audio.sfx('decline',{vol:0.8}); }catch{} }    // tái dụng

// ---------------------- Maps / Background ----------------------
const maps=[
  { name:'Neon City',   bgHue:190, grid:'#77f' },
  { name:'Crimson Rift',bgHue:330, grid:'#f76' },
  { name:'Deep Ocean',  bgHue:210, grid:'#3cf' }
];
const bgLayers=[];
function initBg(){
  bgLayers.length=0;
  for(let i=0;i<4;i++){
    const layer={stars:[],speed:0.02+i*0.02,hue:maps[selectedMap].bgHue - i*18};
    for(let j=0;j<90+i*40;j++){
      layer.stars.push({x:Math.random()*W*1.4-W*0.2,y:Math.random()*H*1.2-H*0.1,r:rand(0.6,2.6-i*0.4),a:rand(0.06,0.35)});
    }
    bgLayers.push(layer);
  }
}
initBg();
function drawBackground(){
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#05010a'); g.addColorStop(1,'#090010');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  for(const layer of bgLayers){
    const ox=(mouse.x-W/2)*layer.speed*0.02;
    const oy=(mouse.y-H/2)*layer.speed*0.02;
    for(const s of layer.stars){
      const x=s.x+ox, y=s.y+oy;
      ctx.globalAlpha=s.a; ctx.fillStyle=`hsl(${layer.hue},80%,65%)`;
      ctx.beginPath(); ctx.arc(x,y,s.r,0,Math.PI*2); ctx.fill();
    }
  }
  ctx.globalAlpha=0.06; ctx.strokeStyle=maps[selectedMap].grid; ctx.lineWidth=1;
  const spacing=120, shift=(mouse.x*0.02)%spacing;
  for(let x=-spacing*2;x<W+spacing*2;x+=spacing){ ctx.beginPath(); ctx.moveTo(x+shift,0); ctx.lineTo(x+shift,H); ctx.stroke(); }
  ctx.globalAlpha=1;
}

// ---------------------- Particles / FX ----------------------
class Particle{
  constructor(x,y,vx,vy,size,life,clr,fade=true,glow=0){
    this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.size=size; this.life=life; this.max=life; this.clr=clr; this.fade=fade; this.glow=glow;
  }
  update(dt){ this.x+=this.vx*dt; this.y+=this.vy*dt; this.vx*=0.995; this.vy+=60*dt; this.life-=dt; }
  draw(ctx){
    const a = this.fade? clamp(this.life/this.max,0,1):1;
    ctx.globalAlpha=a;
    if(this.glow>0){
      ctx.shadowBlur=this.glow; ctx.shadowColor=this.clr;
    }
    ctx.fillStyle=this.clr; ctx.beginPath(); ctx.arc(this.x,this.y,this.size*a,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1; ctx.shadowBlur=0;
  }
}
let particles=[]; 
function puff(x,y,color,count=12,spd=2.4,life=0.6,size=3,glow=0){
  for(let i=0;i<count;i++){
    const a=Math.random()*Math.PI*2, s=rand(spd*0.35,spd);
    particles.push(new Particle(x,y,Math.cos(a)*120*s,Math.sin(a)*120*s, rand(size*0.5,size), life, color, true, glow));
  }
}
function muzzleFlash(x,y,ang,hue=190){
  const c=`hsla(${hue},95%,70%,1)`;
  puff(x+Math.cos(ang)*16, y+Math.sin(ang)*16, c, 10, 2.4, 0.25, 2.6, 10);
}
function engineTrail(x,y,hue=190){
  const c=`hsla(${hue+20},95%,70%,0.9)`;
  particles.push(new Particle(x+rand(-2,2), y+rand(8,12), rand(-30,30), rand(80,120), rand(2,3), 0.35, c, true, 8));
}
function laserSparks(x,y,hue=190){
  const c=`hsla(${hue},100%,75%,1)`;
  puff(x,y,c, 12, 2.0, 0.18, 1.8, 8);
}

// ---------------------- Entities ----------------------
function makePlayer(id,x,y,skin,hue){
  return {
    id,x,y,vx:0,vy:0,size:18,speed:id===0?460:380,
    hp:120,maxHp:120,alive:true,active:true,
    reload:0,fireRate:0.12,
    skin,colorHue:hue,aimDir:{x:1,y:0},engine:0,
    bulletDmg:8,
    missileUnlocked:false, missileRate:0.8, missileReload:0, missileSpeed:230, missileHoming:1.0, missileBlast:40, missileDamage:6,
    laserUnlocked:false, laserRate:0.6, laserCooldown:0, laserDuration:0.6, laserTick:0.1, laserDamage:12, laserSize:8, laserPierce:false,
    score:0, thrusterT:0
  };
}
const players=[ makePlayer(0,W*0.5,H*0.7,0,190), makePlayer(1,W*0.4,H*0.8,1,320) ];
function setSingleMode(){ gameMode='single'; players[0].active=true; players[1].active=false; }
function setCoopMode(){ gameMode='coop'; players[0].active=true; players[1].active=true; }

// Bullets / Missiles / Lasers / Enemies / Bosses
let bullets=[];     // {x,y,vx,vy,size,hostile?,hue,owner?}
let missiles=[];    // {x,y,vx,vy,age,owner,smokeT}
let lasers=[];      // {x,y,tx,ty,age,duration}
let enemies=[]; let bosses=[];

// ---------------------- Enemies ----------------------
class Enemy{
  constructor(x,y){
    this.x=x; this.y=y; this.rad=rand(14,26);
    this.hp=Math.round(8+this.rad);
    this.angle=rand(0,Math.PI*2); this.hue=maps[selectedMap].bgHue+rand(-70,70);
    this.shootTimer=rand(1.6,3.2); this.speedMul=rand(1.0,1.6);
  }
  update(dt){
    this.angle+=dt*0.6;
    this.y+=(40+Math.sin(this.angle*2+this.x*0.01)*18)*dt*this.speedMul;
    this.x+=Math.sin(this.y*0.01+this.angle)*30*dt;
    if(gameState==='playing'){
      this.shootTimer-=dt;
      if(this.shootTimer<=0){
        this.shootTimer=rand(2.0,4.0)/Math.max(1,difficulty);
        const t=pickAlivePlayer();
        if(t){
          const dx=t.x-this.x, dy=t.y-this.y, m=Math.hypot(dx,dy)||1;
          bullets.push({x:this.x,y:this.y,vx:dx/m*260,vy:dy/m*260,size:6,hostile:true,hue:this.hue,owner:'enemy'});
          sfxEnemyShot();
        }
      }
    }
  }
  draw(ctx){
    const s=this.rad;
    const g=ctx.createLinearGradient(this.x-s,this.y-s,this.x+s,this.y+s);
    g.addColorStop(0,`hsla(${this.hue},80%,60%,0.95)`); g.addColorStop(1,`hsla(${this.hue+40},90%,45%,0.75)`);
    ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(this.x,this.y,s*1.2,s,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(this.x,this.y-s*0.1,s*0.5,s*0.35,0,0,Math.PI*2); ctx.fill();
  }
}
class Boss{
  constructor(){
    this.x=W/2; this.y=120; this.rad=60;
    this.maxHp=260+Math.round(difficulty*80); this.hp=this.maxHp;
    this.hue=maps[selectedMap].bgHue+40; this.t=0; this.phase=1; this.shoot=1.2;
  }
  update(dt){
    this.t+=dt; this.x=W/2+Math.sin(this.t*0.5)*Math.min(220,120+difficulty*40);
    if(this.hp<this.maxHp*0.65&&this.phase===1) this.phase=2;
    if(this.hp<this.maxHp*0.35&&this.phase===2) this.phase=3;
    if(gameState!=='playing') return;
    this.shoot-=dt;
    if(this.shoot<=0){
      const R=(n,spd,sz)=>{ for(let i=0;i<n;i++){ const a=i*Math.PI*2/n; bullets.push({x:this.x+Math.cos(a)*this.rad*0.8,y:this.y+Math.sin(a)*this.rad*0.8,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,size:sz,hostile:true,hue:this.hue,owner:'boss'});} };
      if(this.phase===1){ this.shoot=1.2; R(8,240,8); }
      else if(this.phase===2){ this.shoot=0.9; const t=pickAlivePlayer(); if(t){ const b=Math.atan2(t.y-this.y,t.x-this.x); for(let s=-1;s<=1;s++){ const a=b+s*0.18; bullets.push({x:this.x+Math.cos(a)*this.rad*0.8,y:this.y+Math.sin(a)*this.rad*0.8,vx:Math.cos(a)*320,vy:Math.sin(a)*320,size:9,hostile:true,hue:this.hue,owner:'boss'});} } }
      else { this.shoot=0.7; R(12,360,10); }
    }
  }
  draw(ctx){
    const s=this.rad;
    const g=ctx.createLinearGradient(this.x-s,this.y-s,this.x+s,this.y+s);
    g.addColorStop(0,`hsla(${this.hue},90%,60%,1)`); g.addColorStop(1,`hsla(${this.hue+60},80%,40%,0.85)`);
    ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(this.x,this.y,s*1.6,s,0,0,Math.PI*2); ctx.fill();
    // HP bar
    const hbX=W/2-240,hbY=18,hbW=480,hbH=14,pct=clamp(this.hp/this.maxHp,0,1);
    ctx.fillStyle='#111'; ctx.fillRect(hbX,hbY,hbW,hbH);
    const grd=ctx.createLinearGradient(hbX,0,hbX+hbW,0);
    grd.addColorStop(0,'#ff6b6b'); grd.addColorStop(0.6,'#ffdd66'); grd.addColorStop(1,'#6bffea');
    ctx.fillStyle=grd; ctx.fillRect(hbX,hbY,hbW*pct,hbH); ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.strokeRect(hbX,hbY,hbW,hbH);
  }
}

// ---------------------- UI / Notify ----------------------
function updateUI(){
  if(UI) UI.innerHTML=`Neon Shooter<br><small>Difficulty: ${difficulty.toFixed(2)}</small>`;
  if(hudPlayers) hudPlayers.innerHTML=`<div style="color:#bff">Mode: ${gameMode.toUpperCase()} • Map: ${maps[selectedMap].name}</div>`;
  if(credits) credits.textContent='© Neon Shooter';
  if(totalPointsLabel) totalPointsLabel.textContent='Points: '+(save?.totalPoints??0);
}
function notify(msg){
  if(!notifyEl) return;
  notifyEl.textContent=msg;
  notifyEl.classList.add('show');
  setTimeout(()=>notifyEl.classList.remove('show'), 900);
}

// ---------------------- Spawner ----------------------
function spawnWave(){
  const count=Math.min(14, Math.round(3 + difficulty*2 + Math.random()*5));
  for(let i=0;i<count;i++){
    const x=rand(-W*0.15, W*1.15);
    const y=rand(-H*0.4, -20);
    enemies.push(new Enemy(x,y));
  }
  waveTime=0; spawnInterval=clamp(1.6 - difficulty*0.08, 0.6, 2.2);
}

// ---------------------- Weapons helpers ----------------------
function shootBullets(p, ang){
  for(let s=-1;s<=1;s++){
    const a=ang+s*0.06;
    bullets.push({x:p.x+Math.cos(a)*20,y:p.y+Math.sin(a)*20,vx:Math.cos(a)*780,vy:Math.sin(a)*780,size:5,hue:p.colorHue,hostile:false,owner:'p'+p.id});
  }
  muzzleFlash(p.x,p.y,ang,p.colorHue);
  sfxShot();
}
function fireMissileIfReady(p, dt){
  if(!p.missileUnlocked) return;
  p.missileReload-=dt;
  if(p.missileReload<=0){
    p.missileReload = 1/Math.max(0.1,p.missileRate);
    const ang=Math.atan2(mouse.y-p.y, mouse.x-p.x);
    const sp=p.missileSpeed;
    missiles.push({ x:p.x, y:p.y, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, age:0, owner:p.id, smokeT:0 });
    // flare khi phóng
    puff(p.x+Math.cos(ang)*12, p.y+Math.sin(ang)*12, 'rgba(255,230,150,0.95)', 14, 3.1, 0.35, 2.2, 10);
  }
}

// ---------------------- Update ----------------------
let shake=0; const addShake=s=>{ shake=Math.max(shake,s); };
function pickAlivePlayer(){ const alive=players.filter(p=>p.active&&p.alive); return alive.length? alive[(Math.random()*alive.length)|0] : null; }
function totalScore(){ return (players[0].score|0)+(players[1].score|0); }

function update(dt){
  if(gameState==='menu'){
    // FX nền menu chậm
    particles.forEach(p=>p.update(dt));
    particles=particles.filter(p=>p.life>0);
    return;
  }
  if(paused) return;

  // Controls — P1
  const p1=players[0];
  if(gameState==='playing' && p1.active && p1.alive){
    let mx=0,my=0;
    if(keys['a']) mx-=1; if(keys['d']) mx+=1; if(keys['w']) my-=1; if(keys['s']) my+=1;
    const m=Math.hypot(mx,my)||1; mx/=m; my/=m;
    p1.vx+=mx*p1.speed*dt*3; p1.vy+=my*p1.speed*dt*3;
    p1.reload-=dt;
    const aimAng=Math.atan2(mouse.y-p1.y, mouse.x-p1.x);
    if((mouse.left||keys[' ']) && p1.reload<=0){ p1.reload=p1.fireRate; shootBullets(p1, aimAng); }
    fireMissileIfReady(p1, dt);
    p1.laserCooldown-=dt;
    if(mouse.right && p1.laserUnlocked && p1.laserCooldown<=0){
      lasers.push({ x:p1.x,y:p1.y,tx:mouse.x,ty:mouse.y,age:0,duration:p1.laserDuration });
      p1.laserCooldown = 1/Math.max(0.1,p1.laserRate);
    }
    // engine trail
    p1.thrusterT+=dt*60;
    if(p1.thrusterT>2){ p1.thrusterT=0; engineTrail(p1.x-14,p1.y+2,p1.colorHue); }
  }

  // P2 (coop)
  const p2=players[1];
  if(gameMode==='coop' && p2.active && p2.alive && gameState==='playing'){
    let mx2=0,my2=0;
    if(keys['arrowleft']) mx2-=1; if(keys['arrowright']) mx2+=1; if(keys['arrowup']) my2-=1; if(keys['arrowdown']) my2+=1;
    const m2=Math.hypot(mx2,my2)||1; mx2/=m2; my2/=m2;
    p2.vx+=mx2*p2.speed*dt*3; p2.vy+=my2*p2.speed*dt*3;
    let ax=0,ay=0; if(keys['j']) ax-=1; if(keys['l']) ax+=1; if(keys['i']) ay-=1; if(keys['k']) ay+=1;
    if(ax||ay){ const mm=Math.hypot(ax,ay)||1; p2.aimDir.x=ax/mm; p2.aimDir.y=ay/mm; }
    p2.reload-=dt;
    if(keys['m'] && p2.reload<=0){ p2.reload=p2.fireRate; const ang2=Math.atan2(p2.aimDir.y,p2.aimDir.x); shootBullets(p2, ang2); }
    fireMissileIfReady(p2, dt);
    // engine trail
    p2.thrusterT+=dt*60; if(p2.thrusterT>2){ p2.thrusterT=0; engineTrail(p2.x-14,p2.y+2,p2.colorHue); }
  }

  // move players
  for(const p of players){
    if(!p.active) continue;
    p.vx*=0.86; p.vy*=0.86; p.x+=p.vx*dt; p.y+=p.vy*dt;
    p.x=clamp(p.x,40,W-40); p.y=clamp(p.y,60,H-40);
  }

  // bullets
  for(let i=bullets.length;i--;){
    const b=bullets[i]; b.x+=b.vx*dt; b.y+=b.vy*dt;
    if(b.x<-80||b.x>W+80||b.y<-80||b.y>H+80) bullets.splice(i,1);
  }

  // missiles
  for(let i=missiles.length;i--;){
    const m=missiles[i];
    // khói đuôi
    m.smokeT+=dt;
    if(m.smokeT>0.035){ m.smokeT=0; puff(m.x, m.y, 'rgba(180,220,255,0.7)', 2, 0.8, 0.25, 2.2, 6); }
    // homing
    let target=null,td=1e12;
    for(const e of enemies){ const d=dist2(e.x,e.y,m.x,m.y); if(d<td){ td=d; target=e; } }
    if(target){
      const ang=Math.atan2(target.y-m.y, target.x-m.x);
      const sp=Math.hypot(m.vx,m.vy)|| (players[m.owner]?.missileSpeed||260);
      const tx=Math.cos(ang)*sp, ty=Math.sin(ang)*sp;
      const hom=(players[m.owner]?.missileHoming||1.0);
      m.vx+=(tx-m.vx)*0.02*hom; m.vy+=(ty-m.vy)*0.02*hom;
    }
    m.x+=m.vx*dt; m.y+=m.vy*dt; m.age+=dt;

    let hit=-1;
    for(let j=enemies.length;j--;){
      const e=enemies[j]; const dx=e.x-m.x, dy=e.y-m.y, rr=e.rad+6;
      if(dx*dx+dy*dy<rr*rr){ hit=j; break; }
    }
    if(hit>=0 || m.age>6){
      const P = players[m.owner]||players[0];
      const R = (P?.missileBlast||48); const DMG=(P?.missileDamage||8);
      // splash
      for(let j=enemies.length;j--;){
        const e=enemies[j]; const dx=e.x-m.x, dy=e.y-m.y;
        if(dx*dx+dy*dy<=R*R){ e.hp-=DMG; if(e.hp<=0){ enemies.splice(j,1); (P.score=(P.score||0)+1); save.totalPoints+=2; } }
      }
      // FX nổ vừa
      puff(m.x,m.y,'rgba(255,210,150,0.95)',26,3.6,0.9,1.6,14);
      sfxExpl('medium');
      missiles.splice(i,1);
      addShake(1.1);
    }
  }

  // lasers
  for(let i=lasers.length;i--;){
    const L=lasers[i]; L.age+=dt;
    const mx=L.tx-L.x, my=L.ty-L.y, a=Math.atan2(my,mx);
    const lx=Math.cos(a), ly=Math.sin(a), maxLen=2000;
    for(let j=enemies.length;j--;){
      const e=enemies[j]; const ex=e.x-L.x, ey=e.y-L.y;
      const t = Math.max(0, Math.min(maxLen, ex*lx+ey*ly));
      const px=L.x+lx*t, py=L.y+ly*t;
      const d2e=dist2(e.x,e.y,px,py);
      const P=players[0];
      const r=(P.laserSize||8)+e.rad;
      if(d2e<r*r){
        e._laserdmg = (e._laserdmg||0)+dt;
        // tia va chạm: tia lửa
        if(Math.random()<0.22) laserSparks(px,py, P.colorHue);
        if(e._laserdmg >= (P.laserTick||0.1)){
          e._laserdmg=0; e.hp-=(P.laserDamage||12);
          if(e.hp<=0){
            // nổ theo kích cỡ
            const size = e.rad<18? 'small' : e.rad<24? 'medium' : 'big';
            enemies.splice(j,1);
            puff(e.x,e.y,`hsla(${e.hue},95%,60%,1)`, size==='small'?18:size==='medium'?28:40, 3.0, 0.9, size==='big'?1.6:1.2, 12);
            sfxExpl(size);
            P.score=(P.score||0)+1; save.totalPoints+=1;
          }
        }
      }
    }
    if(L.age>=L.duration) lasers.splice(i,1);
  }

  // enemies update + collisions
  for(let i=enemies.length;i--;){
    const e=enemies[i]; e.update(dt);
    if(e.y>H+160){ enemies.splice(i,1); continue; }
    // bullets vs enemy
    if(gameState==='playing'){
      for(let j=bullets.length;j--;){
        const b=bullets[j]; if(b.hostile) continue;
        const rr=(e.rad+b.size), d2b=dist2(b.x,b.y,e.x,e.y);
        if(d2b<rr*rr){
          const ownerId=(b.owner==='p1')?1:0; const P=players[ownerId]||players[0];
          e.hp-=(P.bulletDmg||8);
          puff(b.x,b.y,`hsla(${e.hue},90%,60%,1)`,8,2.2,0.45,0.9,6);
          bullets.splice(j,1); addShake(0.4);
          if(e.hp<=0){
            const size = e.rad<18? 'small' : e.rad<24? 'medium' : 'big';
            puff(e.x,e.y,`hsla(${e.hue},95%,60%,1)`, size==='small'?18:size==='medium'?28:40, 3.0, 0.9, size==='big'?1.6:1.2, 12);
            sfxExpl(size);
            players.forEach(p=>{ if(p.active) p.score=(p.score||0)+Math.round(6+e.rad); });
            enemies.splice(i,1); break;
          }
        }
      }
      // ram players
      for(const p of players){
        if(!(p.active&&p.alive)) continue;
        const rr=(e.rad+p.size), d2p=dist2(e.x,e.y,p.x,p.y);
        if(d2p<rr*rr){
          p.hp-=12;
          puff((e.x+p.x)/2,(e.y+p.y)/2,'rgba(255,120,120,0.95)',18,3.5,0.8,1.0,10);
          addShake(0.8); enemies.splice(i,1); break;
        }
      }
    }
  }

  // hostile bullets hit players
  if(gameState==='playing'){
    for(let i=bullets.length;i--;){
      const b=bullets[i]; if(!b.hostile) continue;
      for(const p of players){
        if(!(p.active&&p.alive)) continue;
        const rr=(p.size+b.size), d2p=dist2(b.x,b.y,p.x,p.y);
        if(d2p<rr*rr){
          p.hp -= (b.owner==='boss')?16:8;
          puff(p.x,p.y,'rgba(255,200,120,0.95)',12,3.2,0.6,0.9,8);
          bullets.splice(i,1); addShake(0.8); break;
        }
      }
    }
  }

  // bosses
  for(let i=bosses.length;i--;){
    const B=bosses[i]; B.update(dt);
    if(gameState==='playing'){
      for(let j=bullets.length;j--;){
        const b=bullets[j]; if(b.hostile) continue;
        const rr=(B.rad+b.size), d2b=dist2(b.x,b.y,B.x,B.y);
        if(d2b<rr*rr){
          B.hp -= (players[0].bulletDmg||8);
          puff(b.x,b.y,`hsla(${B.hue},90%,60%,1)`,8,3.2,0.45,0.9,8);
          bullets.splice(j,1); addShake(1.0);
          if(B.hp<=0){
            // Boss nổ to + shake mạnh
            puff(B.x,B.y,`hsla(${B.hue},90%,60%,1)`, 120, 7.2, 1.6, 2.2, 18);
            sfxExpl('big'); addShake(3.2);
            players.forEach(p=>p.score=(p.score||0)+220);
            bosses.splice(i,1);
            difficulty=Math.max(1, difficulty-0.6);
            break;
          }
        }
      }
    }
  }

  // particles
  for(let i=particles.length;i--;) if((particles[i].life)<=0) particles.splice(i,1); else particles[i].update(dt);

  // spawn control
  if(gameState==='playing'){
    waveTime+=dt;
    if(waveTime>spawnInterval){ spawnWave(); difficulty+=0.02; }
    if(Math.random()<0.0008*difficulty && bosses.length===0 && totalScore()>120+difficulty*50){
      bosses.push(new Boss()); addShake(1.6);
    }
  }

  // deaths / gameover
  for(const p of players){
    if(p.alive && p.hp<=0){
      p.alive=false; p.vx=0; p.vy=0;
      // nổ thuyền mình
      puff(p.x,p.y,'rgba(180,220,255,1)', 36, 3.8, 1.0, 1.6, 12);
      sfxExpl('medium'); addShake(1.4);
    }
  }
  if(gameState==='playing'){
    const anyAlive=players.some(p=>p.active&&p.alive);
    if(!anyAlive){
      gameState='gameover';
      const gain=Math.round(totalScore()*0.5);
      save.totalPoints=(save.totalPoints||0)+gain; saveSave(save); updateUI();
      _crossfadeTo('menu'); // chỉ một lệnh, tránh double
      const go=document.getElementById('gameOverScreen'); if(go) go.style.display='flex';
    }
  }

  if(shake>0) shake=Math.max(0, shake - dt*6);
}

// ---------------------- Render ----------------------
function drawShip(p){
  const ang = (p.id===0)? Math.atan2(mouse.y-p.y, mouse.x-p.x) : Math.atan2(p.aimDir.y,p.aimDir.x);
  // aura
  ctx.globalAlpha=0.12; ctx.fillStyle='rgba(140,230,255,0.9)';
  ctx.beginPath(); ctx.arc(p.x,p.y,p.size*2.8,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
  // body
  ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(ang);
  const colors = p.skin===1? ['#ff7b7b','#ffdd66'] : p.skin===2? ['#a7f','#4ff'] : ['#1ef','#8af'];
  const g=ctx.createLinearGradient(-p.size,-p.size,p.size,p.size);
  g.addColorStop(0,colors[0]); g.addColorStop(1,colors[1]);
  ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(-p.size,-p.size*0.6); ctx.lineTo(p.size*1.1,0); ctx.lineTo(-p.size,p.size*0.6); ctx.closePath(); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(-p.size*0.35,0,p.size*0.45,p.size*0.35,0,0,Math.PI*2); ctx.fill();
  // engine pulse
  p.engine++; const pulse=1+Math.sin(p.engine*0.25)*0.25;
  ctx.globalAlpha=0.9; ctx.fillStyle='rgba(80,240,255,0.85)';
  ctx.beginPath(); ctx.ellipse(-p.size*0.95,0,p.size*0.5*pulse,p.size*0.28*pulse,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
}
function drawHUD(){
  ctx.save();
  ctx.font='600 18px Inter, Arial'; ctx.fillStyle='#bff';
  ctx.fillText('Score P1: '+(players[0].score|0), 18, 28);
  ctx.fillStyle='#9ff'; ctx.font='14px Inter, Arial'; ctx.fillText('Enemies: '+enemies.length, 18, 48);
  // hp bar P1
  const hbX=18,hbY=60,hbW=220,hbH=12;
  ctx.fillStyle='#222'; ctx.fillRect(hbX,hbY,hbW,hbH);
  const pct=clamp(players[0].hp/players[0].maxHp,0,1);
  const grd=ctx.createLinearGradient(hbX,0,hbX+hbW,0);
  grd.addColorStop(0,'#ff6b6b'); grd.addColorStop(0.6,'#ffdd66'); grd.addColorStop(1,'#6bffea');
  ctx.fillStyle=grd; ctx.fillRect(hbX,hbY,hbW*pct,hbH); ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.strokeRect(hbX,hbY,hbW,hbH);
  ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.font='12px Inter, Arial'; ctx.fillText(Math.round(players[0].hp)+' / '+players[0].maxHp, hbX+hbW+8, hbY+hbH-1);
  ctx.restore();

  // crosshair
  ctx.save(); ctx.globalAlpha=0.8; ctx.fillStyle='#9ff';
  ctx.beginPath(); ctx.arc(mouse.x,mouse.y,7,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(mouse.x,mouse.y,18,0,Math.PI*2); ctx.stroke(); ctx.restore();
}
function render(){
  const sx=(Math.random()*2-1)*shake*2, sy=(Math.random()*2-1)*shake*2;
  ctx.setTransform(1,0,0,1,sx,sy);

  drawBackground();

  // hostile bullets
  for(const b of bullets){ if(!b.hostile) continue;
    ctx.globalAlpha=0.95; ctx.fillStyle=`hsl(${b.hue||10},90%,60%)`;
    ctx.beginPath(); ctx.arc(b.x,b.y,b.size,0,Math.PI*2); ctx.fill();
  }
  // enemies
  for(const e of enemies) e.draw(ctx);
  // friendly bullets
  for(const b of bullets){ if(b.hostile) continue;
    ctx.globalAlpha=0.6; ctx.fillStyle='hsla(190,95%,60%,0.9)';
    ctx.beginPath(); ctx.arc(b.x,b.y,b.size*1.8,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1; ctx.fillStyle='white'; ctx.beginPath(); ctx.arc(b.x,b.y,b.size*0.9,0,Math.PI*2); ctx.fill();
  }
  // missiles
  ctx.fillStyle='#fff';
  for(const m of missiles){ ctx.beginPath(); ctx.arc(m.x,m.y,4,0,Math.PI*2); ctx.fill(); }
  // lasers
  ctx.save();
  for(const L of lasers){
    const a=Math.atan2(L.ty-L.y,L.tx-L.x), lx=Math.cos(a), ly=Math.sin(a), len=1600;
    ctx.globalAlpha=0.6; ctx.strokeStyle='#aff'; ctx.lineWidth=players[0].laserSize||8;
    ctx.beginPath(); ctx.moveTo(L.x,L.y); ctx.lineTo(L.x+lx*len, L.y+ly*len); ctx.stroke();
    ctx.globalAlpha=1;
  }
  ctx.restore();

  // players
  for(const p of players){
    if(!p.active) continue;
    if(p.alive) drawShip(p);
    else { ctx.save(); ctx.globalAlpha=0.5; ctx.fillStyle='rgba(10,0,16,0.5)'; ctx.beginPath(); ctx.arc(p.x,p.y,70,0,Math.PI*2); ctx.fill(); ctx.restore(); }
  }
  // bosses
  for(const B of bosses) B.draw(ctx);
  // particles
  for(const P of particles) P.draw(ctx);
  // HUD
  if(gameState!=='menu') drawHUD();

  if(gameState==='gameover'){
    ctx.setTransform(1,0,0,1,0,0);
    ctx.save();
    ctx.fillStyle='rgba(4,0,6,0.55)'; ctx.fillRect(0,0,W,H);
    ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.font='800 44px Inter, Arial';
    ctx.fillText('ALL PLAYERS DOWN', W/2, H/2-24);
    ctx.font='600 18px Inter, Arial'; ctx.fillStyle='#bfe';
    ctx.fillText('Final Score: '+ totalScore() +'  •  Press START in menu to play again', W/2, H/2+18);
    ctx.restore();
  }

  ctx.setTransform(1,0,0,1,0,0);
}

// ---------------------- Loop ----------------------
function loop(){
  const now=performance.now()/1000;
  const dt=Math.min(0.033, now-lastTime);
  lastTime=now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------------------- Controls & Menu ----------------------
addEventListener('keydown', e=>{
  const k=e.key.toLowerCase();
  if(k==='p') paused=!paused;
  if(k==='r' && gameState!=='menu') restart(false);
});
function resetPlayersPositions(){
  players[0]=Object.assign(players[0], makePlayer(0, W*0.5, H*0.7, players[0].skin, players[0].colorHue));
  players[1]=Object.assign(players[1], makePlayer(1, W*0.4, H*0.8, players[1].skin, players[1].colorHue));
  if(gameMode==='single') setSingleMode(); else setCoopMode();
  applyBuffs();
}
function restart(fromMenuStart=true){
  const go=document.getElementById('gameOverScreen'); if(go) go.style.display='none';
  bullets=[]; missiles=[]; lasers=[]; enemies=[]; bosses=[]; particles=[];
  difficulty=1; waveTime=0; spawnInterval=1.6;
  players[0].score=0; players[1].score=0;
  resetPlayersPositions();
  gameState='playing';
  _crossfadeTo('game'); // BGM game (random track nếu có fadeTo)
}
const startBtn=$('#startBtn'), restartBtn=$('#restartBtn'), tutorialBtn=$('#tutorialBtn');
if(startBtn){ startBtn.addEventListener('click', ()=>{ if(menu) menu.style.display='none'; restart(true); }); }
if(restartBtn){ restartBtn.addEventListener('click', ()=> restart(false)); }
if(tutorialBtn){ tutorialBtn.addEventListener('click', ()=> alert('P1: WASD + Mouse + Click/Space\nMissile tự bắn khi unlock\nLaser: chuột phải\nPause: P • Restart: R')); }

// Map & Skin
$$('.skin-swatch').forEach(el=>{
  el.addEventListener('click', ()=>{
    $$('.skin-swatch').forEach(x=>x.classList.remove('sel')); el.classList.add('sel');
    const s=Number(el.dataset.skin);
    players[0].skin=s; players[0].colorHue=[190,10,270][s]??190;
    players[1].skin=(s+1)%3; players[1].colorHue=[190,10,270][players[1].skin]??320;
  });
});
$$('.map-thumb').forEach(el=>{
  el.addEventListener('click', ()=>{
    $$('.map-thumb').forEach(x=>x.classList.remove('sel')); el.classList.add('sel');
    selectedMap=Number(el.dataset.map); initBg();
  });
});
$$('input[name="mode"]').forEach(r=>r.addEventListener('change', ()=>{
  gameMode=document.querySelector('input[name="mode"]:checked')?.value || 'single';
  if(gameMode==='single') setSingleMode(); else setCoopMode();
}));

// Initial state
gameState='menu'; _crossfadeTo('menu'); updateUI();

// Pause on tab hide
document.addEventListener('visibilitychange', ()=>{ if(document.hidden) paused=true; });

// ---------------------- SHOP (Upgrades) ----------------------
function buildShopUI(){
  const el=document.getElementById('shop'); if(!el) return;
  el.innerHTML='';
  const addBtn=(label,cost,fn,disabled=false)=>{
    const b=document.createElement('button');
    b.textContent = cost ? `${label} (${cost})` : label;
    if(disabled) b.disabled=true;
    b.addEventListener('click', ()=>{
      if(cost && !trySpend(cost)) return;
      fn&&fn();
      applyBuffs(); saveSave(save); updateUI(); buildShopUI();
      sfxUpgradeOK(); // âm xác nhận mua
    });
    el.appendChild(b);
  };

  // Bullet
  addBtn('Fire Rate +', 500, ()=>save.upgrades.bullet.fireRate++);
  addBtn('Bullet Damage +', 1000, ()=>save.upgrades.bullet.damage++);

  // Missile
  if(!save.upgrades.missile.unlocked){
    addBtn('Unlock Missile', 2000, ()=>save.upgrades.missile.unlocked=true);
  }else{
    addBtn('Missile Fire Rate +', 1200, ()=>save.upgrades.missile.fireRate++);
    addBtn('Missile Speed +',      900, ()=>save.upgrades.missile.speed++);
    addBtn('Missile Homing +',     900, ()=>save.upgrades.missile.homing++);
    addBtn('Missile Blast +',     1200, ()=>save.upgrades.missile.blast++);
    addBtn('Missile Damage +',    1500, ()=>save.upgrades.missile.damage++);
  }

  // Laser
  if(!save.upgrades.laser.unlocked){
    addBtn('Unlock Laser', 5000, ()=>save.upgrades.laser.unlocked=true);
  }else{
    addBtn('Laser Fire Rate +', 2000, ()=>save.upgrades.laser.fireRate++);
    addBtn('Laser Duration +',  1500, ()=>save.upgrades.laser.duration++);
    addBtn('Laser Tick Faster', 1600, ()=>save.upgrades.laser.tick++);
    addBtn('Laser Damage +',    2200, ()=>save.upgrades.laser.damage++);
    addBtn('Laser Size +',      1600, ()=>save.upgrades.laser.size++);
    addBtn(save.upgrades.laser.pierce?'Laser Pierce ✓':'Unlock Laser Pierce', 4000, ()=>save.upgrades.laser.pierce=true, save.upgrades.laser.pierce);
  }
}
function trySpend(cost){
  if((save.totalPoints|0) < cost){ notify('Not enough points'); sfxDecline(); return false; }
  save.totalPoints -= cost; saveSave(save); updateUI(); notify('Purchased!');
  return true;
}
function applyBuffs(){
  const up=save.upgrades;
  // Bullet
  players.forEach(p=>{
    p.fireRate = clamp(0.12*Math.pow(0.96, up.bullet.fireRate|0), 0.04, 0.3);
    p.bulletDmg = 8 + (up.bullet.damage|0)*2;
  });
  // Missile
  players.forEach(p=>{
    p.missileUnlocked=!!up.missile.unlocked;
    p.missileRate = 0.8 + (up.missile.fireRate|0)*0.08;
    p.missileReload=0;
    p.missileSpeed=230 + (up.missile.speed|0)*30;
    p.missileHoming=1.0 + (up.missile.homing|0)*0.35;
    p.missileBlast = 40 + (up.missile.blast|0)*10;
    p.missileDamage= 6 + (up.missile.damage|0)*3;
  });
  // Laser
  players.forEach(p=>{
    p.laserUnlocked=!!up.laser.unlocked;
    p.laserRate = 0.6 + (up.laser.fireRate|0)*0.05;
    p.laserCooldown=0;
    p.laserDuration=0.6 + (up.laser.duration|0)*0.1;
    p.laserTick=Math.max(0.03, 0.12 - (up.laser.tick|0)*0.01);
    p.laserDamage=12 + (up.laser.damage|0)*4;
    p.laserSize=8 + (up.laser.size|0)*2;
    p.laserPierce=!!up.laser.pierce;
  });
}
buildShopUI();
applyBuffs();
updateUI();

// ---------------------- Return-to-menu fallback ----------------------
(function(){
  function showGO(){ const go=document.getElementById('gameOverScreen'); if(go) go.style.display='flex'; }
  function hideGO(){ const go=document.getElementById('gameOverScreen'); if(go) go.style.display='none'; }
  window.__showGameOverOverlay=showGO;
  window.__hideGameOverOverlay=hideGO;
  if(!window.returnToMenu){
    window.returnToMenu=function(){
      hideGO();
      const m=document.getElementById('menu'); if(m) m.style.display='flex';
      try{ gameState='menu'; _crossfadeTo('menu'); updateUI(); }catch{}
    };
  }
})();
