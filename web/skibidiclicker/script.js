// script.js (toàn bộ) - 1 sound (click2.mp3) + auto unlimited + ẩn nút Mua Auto sau khi mua
// Lưu ý: file click2.mp3 phải nằm cùng thư mục với toilet.html (hoặc sửa đường dẫn)

// ===== State & cấu hình =====
let money = parseInt(localStorage.getItem('money')) || 0;
let power = parseInt(localStorage.getItem('power')) || 1;
let autoClick = parseInt(localStorage.getItem('autoClick')) || 0;      // số auto units đã mua
let autoPower = parseInt(localStorage.getItem('autoPower')) || 1;      // số click mỗi unit
let clickPrice = parseInt(localStorage.getItem('clickPrice')) || 50;
let autoPrice = parseInt(localStorage.getItem('autoPrice')) || 200;
let autoPowerPrice = parseInt(localStorage.getItem('autoPowerPrice')) || 300;
let boostActive = false;

// trạng thái ON/OFF cho auto click
let autoEnabled = (localStorage.getItem('autoEnabled') === null) ? true : (localStorage.getItem('autoEnabled') === 'true');

// cấu hình
const AUTO_MAX_SOUNDS = 1; // âm tối đa phát cho mỗi batch auto
const SAVE_INTERVAL_MS = 2000; // lưu định kỳ

// RAF auto-loop vars
let autoAccumulator = 0;
let lastAutoTime = performance.now();
let rafId = null;
let lastSaveTime = 0;

// ===== Skins (giữ nguyên) =====
const skins = [
  { name: "Normal Skibidi", img: "images/NormalSkibidi.png", price: 0, owned: true },
  { name: "Big Skibidi", img: "images/Bigskibidi.png", price: 500, owned: false },
  { name: "GMAN Toilet", img: "images/Gmantoilet.png", price: 1000, owned: false },
  { name: "Soldier Skibidi", img: "images/SoldierSkibidi.png", price: 1500, owned: false }
];

// ===== DOM references =====
const moneyEl = document.getElementById('money');
const powerEl = document.getElementById('power');
const autoEl = document.getElementById('auto');
const toilet = document.getElementById('toilet');
const clickPriceEl = document.getElementById('clickPrice');
const autoPriceEl = document.getElementById('autoPrice');
const autoPowerPriceEl = document.getElementById('autoPowerPrice');
const skinList = document.getElementById('skinList');
const boostStatus = document.getElementById('boost-status');
const upgradeAutoPowerBtn = document.getElementById('upgradeAutoPower');
const toggleAutoBtn = document.getElementById('toggleAuto');
const buyAutoBtn = document.getElementById('buyAuto'); // <-- nút Mua Auto
// resetData button assumed present in HTML (id="resetData")
const resetBtn = document.getElementById('resetData');

// ===== Audio: chỉ 1 file click2.mp3 (WebAudio + fallback HTMLAudio) =====
let audioCtx = null;
const audioBuffers = {};
const audioFiles = { click: 'click2.mp3' };
const fallbackAudio = {};
for (const k of Object.keys(audioFiles)) {
  try { const a = new Audio(audioFiles[k]); a.preload = 'auto'; fallbackAudio[k] = a; } catch (e) { console.warn('Fallback audio tạo lỗi', e); }
}
async function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const key = 'click';
    const resp = await fetch(audioFiles[key], { cache: "reload" });
    if (!resp.ok) throw new Error('Fetch failed: ' + resp.status);
    const ab = await resp.arrayBuffer();
    audioBuffers[key] = await new Promise((resolve, reject) => audioCtx.decodeAudioData(ab, resolve, reject));
  } catch (err) {
    console.warn('WebAudio lỗi hoặc file không tìm thấy — fallback HTMLAudio', err);
    audioCtx = null;
  }
}
function ensureAudioReady() {
  if (!audioCtx) initAudio().catch(()=>{});
  else if (audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
}
document.addEventListener('click', () => ensureAudioReady(), { once: true });

function playClickSound(volume = 0.5) {
  const key = 'click';
  if (audioCtx && audioBuffers[key]) {
    try {
      const src = audioCtx.createBufferSource();
      src.buffer = audioBuffers[key];
      const gain = audioCtx.createGain();
      gain.gain.value = volume;
      src.connect(gain); gain.connect(audioCtx.destination);
      src.start(0);
    } catch (e) {
      const fa = fallbackAudio[key];
      if (fa) { try { const clone = fa.cloneNode(true); clone.volume = volume; clone.play().catch(()=>{}); } catch{} }
    }
  } else {
    const fa = fallbackAudio[key];
    if (fa) { try { const clone = fa.cloneNode(true); clone.volume = volume; clone.play().catch(()=>{}); } catch{} }
  }
}

// ===== Load saved skins safely =====
if (localStorage.getItem('skins')) {
  try {
    const saved = JSON.parse(localStorage.getItem('skins'));
    if (Array.isArray(saved) && saved.length === skins.length) skins.forEach((s,i)=> skins[i].owned = !!saved[i].owned);
  } catch (e) { console.warn('skins load error', e); }
}

// ===== Visual + sound effect for click =====
function triggerClickEffect(x, y, earn, volume = 0.5, playSound = true) {
  createParticle(x, y, earn);
  if (toilet) {
    toilet.classList.remove('toilet-zoom'); void toilet.offsetWidth;
    toilet.classList.add('toilet-zoom');
    setTimeout(()=> toilet.classList.remove('toilet-zoom'), 150);
  }
  if (playSound) playClickSound(volume);
}

// click tay
if (toilet) {
  toilet.addEventListener('click', (e) => {
    let earn = power; if (boostActive) earn *= 2;
    money += earn;
    triggerClickEffect(e.clientX, e.clientY, earn, 0.5, true);
    document.body.classList.add('shake'); setTimeout(()=>document.body.classList.remove('shake'),100);
    updateUI(); saveGame();
  });
}

function createParticle(x,y,text) {
  const particle = document.createElement('div');
  particle.classList.add('particle');
  particle.textContent = `+${text}`;
  particle.style.left = x + 'px';
  particle.style.top = y + 'px';
  document.body.appendChild(particle);
  particle.addEventListener('animationend', ()=> particle.remove());
}

// ===== Skins render =====
function renderSkins() {
  if (!skinList) return;
  skinList.innerHTML = "";
  skins.forEach((skin) => {
    const btn = document.createElement('button');
    btn.classList.add('skin-btn');
    btn.textContent = skin.owned ? `${skin.name} (OWNED)` : `${skin.name} (${skin.price}💰)`;
    btn.addEventListener('click', () => {
      if (!skin.owned) {
        if (money >= skin.price) { money -= skin.price; skin.owned = true; renderSkins(); updateUI(); saveGame(); }
        else { btn.classList.add('shake'); setTimeout(()=>btn.classList.remove('shake'),200); }
      } else { if (toilet) toilet.src = skin.img; }
    });
    skinList.appendChild(btn);
  });
}

// ===== Upgrade click (hand click) =====
const upgradeClickBtn = document.getElementById('upgradeClick');
if (upgradeClickBtn) upgradeClickBtn.addEventListener('click', ()=> {
  if (money >= clickPrice) { money -= clickPrice; power++; clickPrice = Math.floor(clickPrice * 1.5); updateUI(); saveGame(); }
  else { upgradeClickBtn.classList.add('shake'); setTimeout(()=>upgradeClickBtn.classList.remove('shake'),200); }
});

// ===== Buy Auto (mua 1 hay nhiều unit) =====
if (buyAutoBtn) {
  buyAutoBtn.addEventListener('click', ()=> {
    if (money >= autoPrice) {
      money -= autoPrice;
      autoClick++;
      autoPrice = Math.floor(autoPrice * 1.5);

      // Ẩn nút Mua Auto ngay sau khi mua (theo yêu cầu)
      buyAutoBtn.style.display = 'none';

      // Hiện nút Nâng cấp Auto (updateUI sẽ làm)
      if (autoEnabled) startAutoLoop();
      updateUI();
      saveGame();
    } else {
      buyAutoBtn.classList.add('shake');
      setTimeout(()=>buyAutoBtn.classList.remove('shake'), 200);
    }
  });
}

// ===== Upgrade Auto Power: tăng +1 cho mỗi lần nâng cấp (rõ rệt) =====
if (upgradeAutoPowerBtn) upgradeAutoPowerBtn.addEventListener('click', ()=> {
  if (money >= autoPowerPrice && autoClick > 0) {
    money -= autoPowerPrice;
    autoPower = autoPower + 1; // tăng +1 mỗi lần
    autoPowerPrice = Math.floor(autoPowerPrice * 1.6);
    if (autoEnabled) startAutoLoop();
    updateUI(); saveGame();
  } else {
    upgradeAutoPowerBtn.classList.add('shake'); setTimeout(()=>upgradeAutoPowerBtn.classList.remove('shake'),200);
  }
});

// ===== Boost =====
const boostBtn = document.getElementById('boost');
if (boostBtn) boostBtn.addEventListener('click', ()=> {
  if (!boostActive && money >= 1000) {
    money -= 1000; boostActive = true; updateUI(); saveGame();
    setTimeout(()=>{ boostActive = false; updateUI(); saveGame(); }, 30000);
  } else { boostBtn.classList.add('shake'); setTimeout(()=>boostBtn.classList.remove('shake'),200); }
});

// ===== Toggle Auto ON/OFF =====
if (toggleAutoBtn) {
  toggleAutoBtn.textContent = autoEnabled ? 'Tắt Auto' : 'Bật Auto';
  toggleAutoBtn.addEventListener('click', ()=> {
    autoEnabled = !autoEnabled;
    localStorage.setItem('autoEnabled', autoEnabled ? 'true' : 'false');
    if (autoEnabled) {
      // nếu đã mua auto, bật loop
      if (autoClick > 0) startAutoLoop();
    } else {
      stopAutoLoop();
    }
    updateUI(); saveGame();
  });
}

// ===== Auto RAF loop (accumulator) =====
function startAutoLoop() {
  if (rafId) return;
  lastAutoTime = performance.now();
  lastSaveTime = lastAutoTime;
  rafId = requestAnimationFrame(autoLoop);
}
function stopAutoLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  autoAccumulator = 0;
}
function autoLoop(now) {
  rafId = null;
  const dt = Math.max(0, now - lastAutoTime);
  lastAutoTime = now;

  const boostMul = boostActive ? 2 : 1;
  const rate = autoClick * autoPower * boostMul; // clicks per second

  if (autoEnabled && rate > 0) {
    autoAccumulator += rate * (dt / 1000);
    if (autoAccumulator >= 1) {
      const clicks = Math.floor(autoAccumulator);
      autoAccumulator -= clicks;
      money += clicks;

      const rect = toilet ? toilet.getBoundingClientRect() : { left: window.innerWidth/2, top: window.innerHeight/2, width: 0, height: 0 };
      const px = rect.left + rect.width / 2;
      const py = rect.top + rect.height / 2;

      // âm: giới hạn số âm mỗi batch
      const soundsToPlay = Math.min(clicks, AUTO_MAX_SOUNDS);
      if (soundsToPlay <= 1) {
        playClickSound(0.35);
      } else {
        if (audioCtx && audioBuffers['click']) {
          for (let i=0;i<soundsToPlay;i++){
            try {
              const src = audioCtx.createBufferSource(); src.buffer = audioBuffers['click'];
              const gain = audioCtx.createGain(); gain.gain.value = 0.25;
              src.connect(gain); gain.connect(audioCtx.destination);
              src.start(audioCtx.currentTime + i * 0.03);
            } catch (e) { setTimeout(()=>playClickSound(0.25), i*30); }
          }
        } else {
          for (let i=0;i<soundsToPlay;i++) setTimeout(()=>playClickSound(0.25), i*30);
        }
      }

      // particle 1 lần cho tổng clicks (tắt âm thanh ở đây)
      triggerClickEffect(px, py, clicks, 0.35, false);
      updateUI();
      if (now - lastSaveTime >= SAVE_INTERVAL_MS) { saveGame(); lastSaveTime = now; }
    }
  }

  if (autoEnabled && rate > 0) rafId = requestAnimationFrame(autoLoop);
  else rafId = null;
}

// start loop on load if enabled & bought
if (autoEnabled && autoClick > 0) startAutoLoop();

// ===== Save / Reset logic =====
function saveGame() {
  try {
    localStorage.setItem('money', money);
    localStorage.setItem('power', power);
    localStorage.setItem('autoClick', autoClick);
    localStorage.setItem('autoPower', autoPower);
    localStorage.setItem('clickPrice', clickPrice);
    localStorage.setItem('autoPrice', autoPrice);
    localStorage.setItem('autoPowerPrice', autoPowerPrice);
    localStorage.setItem('skins', JSON.stringify(skins));
    localStorage.setItem('autoEnabled', autoEnabled ? 'true' : 'false');
  } catch (e) { console.warn('save error', e); }
}

// Reset Data button handler (nút bạn đã thêm)
if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    const ok = confirm('Bạn có chắc muốn XÓA toàn bộ dữ liệu game? (Không thể hoàn tác)');
    if (!ok) return;

    // Dừng loop
    try { stopAutoLoop(); } catch {}
    try { if (typeof autoClickTimer !== 'undefined' && autoClickTimer) { clearInterval(autoClickTimer); autoClickTimer = null; } } catch {}

    // Xóa các khóa game
    const keysToRemove = ['money','power','autoClick','autoPower','autoInterval','clickPrice','autoPrice','autoPowerPrice','skins','autoEnabled'];
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // Reset biến
    money = 0; power = 1; autoClick = 0; autoPower = 1;
    clickPrice = 50; autoPrice = 200; autoPowerPrice = 300; boostActive = false; autoEnabled = true;
    autoAccumulator = 0;

    // Hiện lại nút Mua Auto (nếu bị ẩn)
    if (buyAutoBtn) buyAutoBtn.style.display = 'inline-block';

    saveGame(); renderSkins(); updateUI();
    alert('Dữ liệu game đã được reset về mặc định.');
  });
}

// ===== UI cập nhật =====
function updateUI() {
  if (moneyEl) moneyEl.textContent = money;
  if (powerEl) powerEl.textContent = power;
  if (autoEl) {
    const rate = autoClick * autoPower * (boostActive ? 2 : 1);
    autoEl.textContent = `${autoClick} × ${autoPower} (${rate} clicks/s) ${autoEnabled ? '' : '(Tắt)'}`;
  }
  if (clickPriceEl) clickPriceEl.textContent = clickPrice;
  if (autoPriceEl) autoPriceEl.textContent = autoPrice;
  if (autoPowerPriceEl) autoPowerPriceEl.textContent = autoPowerPrice;
  if (boostStatus) boostStatus.textContent = boostActive ? "Bật" : "Tắt";

  // Hiển thị/ẩn nút Nâng cấp Auto nếu đã mua auto
  if (upgradeAutoPowerBtn) upgradeAutoPowerBtn.style.display = (autoClick > 0) ? 'inline-block' : 'none';

  // Ẩn nút Mua Auto nếu đã mua (theo yêu cầu)
  if (buyAutoBtn) buyAutoBtn.style.display = (autoClick > 0) ? 'none' : 'inline-block';

  if (toggleAutoBtn) toggleAutoBtn.textContent = autoEnabled ? 'Tắt Auto' : 'Bật Auto';
}

// ===== Khởi tạo giao diện ban đầu =====
renderSkins();
updateUI();
