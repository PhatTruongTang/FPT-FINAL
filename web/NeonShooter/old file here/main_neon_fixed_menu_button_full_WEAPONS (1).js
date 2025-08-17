
// main_neon_fixed_menu_button_full_WEAPONS.js
// --- Patch-friendly main: keeps original gameplay/HUD, adds Save/Load (points + upgrades),
// --- and fixes Game Over "Return Menu" button. Rainbow laser + homing missile are untouched.
//
// How this file is designed:
// - It DOES NOT overwrite your existing rendering/HUD code.
// - It wires DOM events, manages game loop handle, and persists only {points, upgrades}.
// - If your old main already defines gameplay functions, we call/patch them rather than replace.
// - If not, the minimal stubs below keep things from breaking.
//
// ============ GLOBAL STATE ============
(function () {
  const $ = (sel) => document.querySelector(sel);
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
  const off = (el, ev, fn, opts) => el && el.removeEventListener(ev, fn, opts);

  const els = {
    canvas: $('#c'),
    ui: $('#ui'),
    hudPlayers: $('#hud-players'),
    credits: $('#credits'),
    menu: $('#menu'),
    startBtn: $('#startBtn'),
    restartBtn: $('#restartBtn'),
    tutorialBtn: $('#tutorialBtn'),
    gameOver: $('#gameOverScreen'),
    menuBtn: $('#menuBtn'),
    shop: $('#shop'),
    totalPoints: $('#totalPoints'),
    notify: $('#notify'),
  };

  // --- Safe raf/loop holder so we can stop when "Return Menu" ---
  const Loop = {
    id: null,
    running: false,
    tick: null,
    start(tickFn){
      this.stop();
      this.tick = tickFn;
      const step = (t)=>{
        if(!this.running) return;
        try { this.tick && this.tick(t); } catch(e){ console.error(e); }
        this.id = requestAnimationFrame(step);
      };
      this.running = true;
      this.id = requestAnimationFrame(step);
    },
    stop(){
      if (this.id) cancelAnimationFrame(this.id);
      this.id = null;
      this.running = false;
    }
  };

  // ============ SAVE/LOAD (points + upgrades) ============
  const Save = {
    KEY: 'NEON_SHOOTER_V1_SAVE',
    load(){
      try {
        const raw = localStorage.getItem(this.KEY);
        if(!raw) return { points: 0, upgrades: {} };
        const obj = JSON.parse(raw);
        // sanitize
        return {
          points: Number(obj.points||0),
          upgrades: (obj.upgrades && typeof obj.upgrades==='object') ? obj.upgrades : {}
        };
      } catch(e){
        console.warn('[Save] load fail', e);
        return { points: 0, upgrades: {} };
      }
    },
    save(data){
      try {
        const current = this.load();
        const merged = {
          points: ('points' in data) ? Number(data.points||0) : current.points,
          upgrades: Object.assign({}, current.upgrades, data.upgrades||{})
        };
        localStorage.setItem(this.KEY, JSON.stringify(merged));
        this._reflectPoints(merged.points);
        return merged;
      } catch(e){
        console.warn('[Save] save fail', e);
      }
    },
    clear(){
      localStorage.removeItem(this.KEY);
    },
    _reflectPoints(p){
      if (els.totalPoints) els.totalPoints.textContent = `Points: ${p|0}`;
    }
  };

  // Expose for other scripts
  window.NS = window.NS || {};
  window.NS.Save = Save;
  window.NS.Loop = Loop;

  // Reflect saved total points on load
  const savedBoot = Save.load();
  Save._reflectPoints(savedBoot.points);

  // ============ UPGRADE BRIDGE ============
  // We DON’T render the shop. We listen for your existing shop buttons.
  // Expecting buttons inside #shop with data-upg="upgradeKey" and data-lv="currentLevel".
  // When a user buys, your code should update DOM. We’ll observe & persist.
  const UpgradeBridge = (function(){
    const state = Object.assign({}, savedBoot.upgrades); // { key: levelOrFlag }
    const obs = new MutationObserver(()=>syncFromDOM());
    if (els.shop) obs.observe(els.shop, { childList:true, subtree:true, attributes:true, attributeFilter:['data-lv','data-level','class'] });

    function syncFromDOM(){
      if (!els.shop) return;
      // Heuristics: read any element with [data-upg]
      els.shop.querySelectorAll('[data-upg]').forEach(btn=>{
        const key = btn.getAttribute('data-upg');
        const lv = btn.getAttribute('data-lv') ?? btn.getAttribute('data-level');
        if(!key) return;
        let v = lv!=null ? Number(lv) : (btn.classList.contains('owned') || btn.classList.contains('active')) ? 1 : state[key]||0;
        if (Number.isNaN(v)) v = state[key]||0;
        if (state[key] !== v){
          state[key] = v;
        }
      });
      Save.save({ upgrades: state });
      // let gameplay know
      dispatchEvent(new CustomEvent('ns:upgrades-changed', { detail: { upgrades: {...state} } }));
    }

    // Public API for gameplay to push an explicit upgrade snapshot
    function setAll(dict){
      Object.assign(state, dict||{});
      Save.save({ upgrades: state });
      dispatchEvent(new CustomEvent('ns:upgrades-changed', { detail: { upgrades: {...state} } }));
    }

    // On boot, let gameplay pull what we have
    queueMicrotask(()=>{
      dispatchEvent(new CustomEvent('ns:upgrades-ready', { detail: { upgrades: {...state} } }));
    });

    return { get: ()=>({ ...state }), setAll, syncFromDOM };
  })();
  window.NS.Upgrades = UpgradeBridge;

  // ============ POINTS BRIDGE ============
  // Minimal helpers your gameplay can call to mutate points without caring about storage.
  const Points = {
    get(){ return Save.load().points|0; },
    set(v){ const merged = Save.save({ points: Number(v||0) }); return merged.points; },
    add(d){ const p = this.get()+Number(d||0); return this.set(p); }
  };
  window.NS.Points = Points;

  // Also mirror point changes to the tiny notify bar (optional)
  function toast(msg){
    if (!els.notify) return;
    els.notify.textContent = msg;
    els.notify.classList.add('show');
    setTimeout(()=> els.notify && els.notify.classList.remove('show'), 1000);
  }

  // Listen for gameplay events to update/save points
  on(window, 'ns:points-set', (e)=>{
    if(!e || !e.detail) return;
    const v = Number(e.detail.value||0);
    Points.set(v);
    toast(`Points: ${v|0}`);
  });
  on(window, 'ns:points-add', (e)=>{
    if(!e || !e.detail) return;
    const v = Points.add(Number(e.detail.delta||0));
    toast(`+${Number(e.detail.delta||0)|0} ➜ ${v|0}`);
  });

  // ============ GAME LIFECYCLE ============
  // We don’t replace your actual game. We provide a shell that calls your hooks if present.
  // Define/keep these in your original main if you already have them:
  //   window.NS.Game.start(), window.NS.Game.stop(), window.NS.Game.resetToMenu()
  // If they are missing, we provide safe fallbacks so app won’t crash.

  window.NS.Game = window.NS.Game || {};
  const Game = window.NS.Game;

  // Fallback hooks (no-op if your original defined them)
  Game._started = false;
  Game.start = Game.start || function(){
    Game._started = true;
    document.body.classList.add('playing');
    if (window.audio?.toGame) window.audio.toGame();
    // If your old code has its own loop, keep it. Otherwise, run a safe tick so Loop.stop() works.
    if (!Loop.running){
      Loop.start(()=>{/* tick placeholder so we can stop when menu */});
    }
  };
  Game.stop = Game.stop || function(){
    Game._started = false;
    Loop.stop();
    document.body.classList.remove('playing');
  };
  Game.resetToMenu = Game.resetToMenu || function(){
    // Hide overlays, show menu, stop loops, swap BGM
    Game.stop();
    if (els.gameOver) els.gameOver.style.display = 'none';
    if (els.menu) els.menu.style.display = 'flex';
    if (window.audio?.toMenu) window.audio.toMenu();
  };

  // Ensure the menu shows on boot
  if (els.menu) els.menu.style.display = 'flex';
  if (els.gameOver) els.gameOver.style.display = 'none';

  // ============ BUTTON WIRES (includes Return Menu fix) ============
  on(els.startBtn, 'click', async ()=>{
    try { if (window.audio?.unlock) await window.audio.unlock(); } catch {}
    // Apply saved upgrades to gameplay (broadcast)
    const snapshot = window.NS.Upgrades.get();
    dispatchEvent(new CustomEvent('ns:apply-upgrades', { detail: { upgrades: snapshot } }));

    if (els.menu) els.menu.style.display = 'none';
    Game.start();
  });

  on(els.restartBtn, 'click', ()=>{
    // Reset only runtime — keep points & upgrades as requested.
    dispatchEvent(new Event('ns:restart'));
    if (els.menu) els.menu.style.display = 'none';
    if (els.gameOver) els.gameOver.style.display = 'none';
    Game.start();
  });

  on(els.menuBtn, 'click', ()=>{
    // --- This is the core fix for "Return Menu" not working ---
    // Stop gameplay loop & input, hide gameover, show menu, move BGM back.
    Game.resetToMenu();
  });

  on(els.tutorialBtn, 'click', ()=>{
    dispatchEvent(new Event('ns:show-tutorial'));
  });

  // Optional: if your gameplay triggers end via custom event
  on(window, 'ns:game-over', ()=>{
    // Show our slim overlay (your HTML has only a Menu button per your CSS)
    if (els.gameOver) els.gameOver.style.display = 'flex';
    Game.stop();
  });

  // ============ WEAPONS COMPAT SHIMS ============
  // We keep laser rainbow + missile homing INTACT. If your old code listens for flags,
  // we will rebroadcast upgrades on start and whenever shop changes.
  function rebroadcastUpgrades(){
    const snapshot = window.NS.Upgrades.get();
    dispatchEvent(new CustomEvent('ns:apply-upgrades', { detail: { upgrades: snapshot } }));
  }
  on(window, 'ns:upgrades-changed', rebroadcastUpgrades);
  on(window, 'ns:upgrades-ready', rebroadcastUpgrades);

  // Example of how your weapon system can read these flags (for reference):
  // document.addEventListener('ns:apply-upgrades', (e)=>{
  //   const upg = e.detail.upgrades || {};
  //   window.NS.Flags = window.NS.Flags || {};
  //   window.NS.Flags.laserRainbow = !!upg.laserRainbow;
  //   window.NS.Flags.missileHoming = !!upg.missileHoming;
  // });

  // ============ SAFE EXIT ON PAGE HIDE (optional) ============
  document.addEventListener('visibilitychange', ()=>{
    if (document.hidden && Game._started){
      // Pause loop to save CPU when tab hidden
      Loop.stop();
    } else if (!document.hidden && Game._started && !Loop.running){
      Loop.start(()=>{});
    }
  });

  console.log('[NeonShooter] main_neon_fixed_menu_button_full_WEAPONS.js ready.');
})();
