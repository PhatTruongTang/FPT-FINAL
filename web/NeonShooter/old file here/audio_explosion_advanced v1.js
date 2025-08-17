/* ===========================================================
   audio_explosion_advanced.js
   - AudioManager nâng cấp (multi-layer explosion, random pitch, preload cache)
   - Hiệu ứng Explosion nâng cấp (shockwave, glow, multi-color, performance-safe)
   =========================================================== */

/* =======================
   AudioManager Advanced
   ======================= */
   class AudioManager {
    constructor(basePath = "sounds/") {
      this.base = basePath.endsWith("/") ? basePath : basePath + "/";
  
      // Danh sách BGM & SFX
      // Bạn có thể đổi tên file cho khớp với thư mục /sounds của mình
      this.files = {
        // Shots
        playerShot: "player_shot.mp3",
        missileShot: "player_missile.mp3",
        laserShot: "lasershot.mp3",
        enemyShot: "enemy_single_shot.mp3",
  
        // Hits
        enemyHit: "enemy_hit.mp3",
        playerHit: "player_hit_bullet.mp3",
  
        // Explosions (nhiều biến thể để layer)
        explSmall_1: "expl_small_01.mp3",
        explSmall_2: "expl_small_02.mp3",
        explSmall_3: "expl_small_03.mp3",
  
        explMedium_1: "expl_medium_01.mp3",
        explMedium_2: "expl_medium_01.mp3",
        explMedium_3: "expl_medium_01.mp3",
  
        explBig_1: "expl_big_01.mp3",
        explBig_2: "expl_big_01.mp3",
        explBig_3: "expl_big_01.mp3",
  
        // BGM
        bgmMenu: "Anthem to the Stars Ambient.mp3",
        bgmGame1: "Horns of Despair.mp3",
        bgmGame2: "Anthem to the Stars.mp3"
      };
  
      // Gom nhóm cho explosion theo size để random dễ
      this.explBanks = {
        small: ["explSmall_1", "explSmall_2", "explSmall_3"],
        medium: ["explMedium_1", "explMedium_2", "explMedium_3"],
        big: ["explBig_1", "explBig_2", "explBig_3"]
      };
  
      // BGM channel
      this.bgm = new Audio();
      this.bgm.loop = true;
      this.bgm.volume = 0.9;
  
      // Cache phần tử Audio để clone phát nhanh • tạo pool nhỏ cho mỗi SFX
      this.pool = new Map(); // key -> array<Audio>
      this.poolSize = 6;     // mỗi sfx giữ pool max 6 node để hạn chế tạo mới liên tục
  
      // Trạng thái
      this.menuPlaying = false;
      this.gamePlaying = false;
      this.unlocked = false;
  
      // Giới hạn số tiếng nổ cùng lúc để tránh ồn/lag
      this.MAX_SIMULTANEOUS_EXPLOSIONS_SFX = 8;
      this._explPlaying = 0;
  
      // Preload tất cả SFX (trừ BGM) an toàn
      for (const key in this.files) {
        if (!key.startsWith("bgm")) {
          const url = this.base + this.files[key];
          this._ensurePool(key, url);
  
          // Thử HEAD để cảnh báo thiếu file (không block)
          try {
            fetch(url, { method: "HEAD" })
              .then(r => { if (!r.ok) console.warn("[AudioManager] ⚠ Missing audio:", url); })
              .catch(() => { /* offline or cors, ignore */ });
          } catch { /* ignore */ }
        }
      }
    }
  
    _ensurePool(key, url) {
      if (this.pool.has(key)) return;
      const arr = [];
      for (let i = 0; i < this.poolSize; i++) {
        const a = new Audio(url);
        a.preload = "auto";
        arr.push(a);
      }
      this.pool.set(key, arr);
    }
  
    async unlock() {
      if (this.unlocked) return true;
      try {
        // Nhiều trình duyệt yêu cầu kích hoạt qua user gesture
        await this.bgm.play().catch(() => {});
        this.bgm.pause();
        this.bgm.currentTime = 0;
        this.unlocked = true;
        console.log("[AudioManager] Unlocked");
        return true;
      } catch (e) {
        console.warn("[AudioManager] Unlock failed:", e);
        return false;
      }
    }
  
    playBGM(name) {
      if (!this.unlocked) return;
      if (!this.files[name]) {
        console.warn(`[AudioManager] BGM '${name}' not found`);
        return;
      }
      this.bgm.src = this.base + this.files[name];
      this.bgm.currentTime = 0;
      this.bgm.play().catch(e => console.warn("[AudioManager] Play BGM fail:", e));
    }
  
    fadeBGM(targetVolume, duration = 1000, callback) {
      const steps = Math.max(1, Math.floor(duration / 50));
      const start = this.bgm.volume;
      let i = 0;
      const it = setInterval(() => {
        i++;
        const t = i / steps;
        this.bgm.volume = start + (targetVolume - start) * t;
        if (i >= steps) {
          clearInterval(it);
          this.bgm.volume = targetVolume;
          callback && callback();
        }
      }, 50);
    }
  
    ensureMenu() {
      if (this.menuPlaying) return;
      this.playBGM("bgmMenu");
      this.menuPlaying = true;
      this.gamePlaying = false;
    }
  
    toGame() {
      if (this.gamePlaying) return;
      const pick = Math.random() < 0.5 ? "bgmGame1" : "bgmGame2";
      this.fadeBGM(0, 800, () => {
        this.playBGM(pick);
        this.fadeBGM(0.9, 800);
      });
      this.gamePlaying = true;
      this.menuPlaying = false;
    }
  
    toMenu() {
      if (this.menuPlaying) return;
      this.fadeBGM(0, 800, () => {
        this.playBGM("bgmMenu");
        this.fadeBGM(0.9, 800);
      });
      this.menuPlaying = true;
      this.gamePlaying = false;
    }
  
    // Lấy 1 audio node rảnh trong pool (clone nếu cần)
    _getNode(key) {
      if (!this.pool.has(key)) {
        // chưa preload -> tạo pool ngay
        const url = this.base + (this.files[key] || "");
        this._ensurePool(key, url);
      }
      const arr = this.pool.get(key);
      for (const a of arr) {
        // node chưa play hoặc đã kết thúc -> dùng
        if (a.paused || a.ended) return a;
      }
      // nếu tất cả đang phát, clone tạm 1 cái (nhưng không đưa vào pool để tránh phình)
      const url = this.base + (this.files[key] || "");
      const temp = new Audio(url);
      temp.preload = "auto";
      return temp;
    }
  
    // SFX đơn (có thể set volume và playbackRate để đổi pitch)
    sfx(name, { vol = 1, rate = 1 } = {}) {
      if (!this.unlocked) return;
      if (!this.files[name]) {
        console.warn(`[AudioManager] SFX '${name}' not found`);
        return;
      }
      const node = this._getNode(name);
      try {
        node.currentTime = 0;
      } catch { /* ignore for some codecs */ }
      node.volume = Math.max(0, Math.min(1, vol));
      // Một số trình duyệt không hỗ trợ rate cho MP3, nhưng set cũng không sao
      try { node.playbackRate = Math.max(0.5, Math.min(2, rate)); } catch { /* ignore */ }
      node.play().catch(() => {});
      return node;
    }
  
    // Phát tiếng nổ dạng multi-layer (2–3 lớp), random sample + pitch
    explosion(size = "small") {
      if (!this.unlocked) return;
      if (this._explPlaying >= this.MAX_SIMULTANEOUS_EXPLOSIONS_SFX) return;
  
      const bank = this.explBanks[size] || this.explBanks.small;
      // Lớp 1: sample ngẫu nhiên
      const s1 = bank[Math.floor(Math.random() * bank.length)];
      // Lớp 2: sample khác (nếu có)
      let s2 = bank[Math.floor(Math.random() * bank.length)];
      if (s2 === s1 && bank.length > 1) {
        s2 = bank[(bank.indexOf(s1) + 1) % bank.length];
      }
      // Lớp 3: 50% cơ hội thêm 1 lớp mỏng
      const addThird = Math.random() < 0.5;
      let s3 = addThird ? bank[Math.floor(Math.random() * bank.length)] : null;
  
      // Volume cơ bản theo size
      const base = size === "big" ? 1.0 : (size === "medium" ? 0.9 : 0.8);
  
      const vols = [base, base * 0.75, base * 0.55];
      const rates = [
        0.95 + Math.random() * 0.1,      // ~ 0.95 – 1.05
        0.85 + Math.random() * 0.12,     // ~ 0.85 – 0.97
        1.05 + Math.random() * 0.12      // ~ 1.05 – 1.17
      ];
  
      // Bắt đầu đếm đồng thời
      this._explPlaying++;
  
      // Phát các lớp (không blocking)
      const n1 = this.sfx(s1, { vol: vols[0], rate: rates[0] });
      const n2 = this.sfx(s2, { vol: vols[1], rate: rates[1] });
      if (s3) this.sfx(s3, { vol: vols[2], rate: rates[2] });
  
      // Khi một trong các node kết thúc, giảm đếm
      const onEnded = () => {
        this._explPlaying = Math.max(0, this._explPlaying - 1);
        n1 && (n1.onended = null);
        n2 && (n2.onended = null);
        if (n3) n3.onended = null;
      };
      const n3 = s3 ? this._getNode(s3) : null; // chỉ để attach end nếu cần
      if (n1) n1.onended = onEnded;
      if (n2) n2.onended = onEnded;
      if (n3) {
        try {
          n3.currentTime = 0;
          n3.volume = vols[2];
          n3.playbackRate = rates[2];
          n3.play().catch(() => {});
          n3.onended = onEnded;
        } catch { /* ignore */ }
      } else {
        // nếu chỉ có 2 lớp, gắn end cho 1 lớp là đủ
        if (n2) n2.onended = onEnded;
        else if (n1) n1.onended = onEnded;
      }
    }
  }
  
  window.audio = new AudioManager("sounds/");
  
  /* =======================
     Explosion Advanced
     ======================= */
  class Explosion {
    /**
     * @param {number} x
     * @param {number} y
     * @param {"small"|"medium"|"big"} size
     * @param {string|null} color - nếu null sẽ random từ bảng màu
     */
    constructor(x, y, size = "small", color = null) {
      this.x = x;
      this.y = y;
      this.size = size;
  
      // Phát âm thanh nổ (an toàn)
      if (window.audio && typeof audio.explosion === "function") {
        try { audio.explosion(size); } catch (err) { /* ignore */ }
      }
  
      // Tham số theo size
      const baseRadius = size === "big" ? 28 : (size === "medium" ? 20 : 12);
      const particleCount = size === "big" ? 60 : (size === "medium" ? 38 : 24);
  
      // Bảng màu hạt sáng neon
      this.palette = [
        "#ffb36c", // cam
        "#ff7a5c", // đỏ-cam
        "#ffd86b", // vàng
        "#fff2cc", // trắng ấm
        "#ffaaff"  // hồng nhạt glow
      ];
  
      this.coreColor = color || this.palette[Math.floor(Math.random() * this.palette.length)];
  
      // Hạt
      this.particles = [];
      for (let i = 0; i < particleCount; i++) {
        const ang = Math.random() * Math.PI * 2;
        // tốc độ dựa theo size
        const spd = (Math.random() * 1 + 0.7) * (baseRadius * 10);
        const r0 = Math.random() * (baseRadius * 0.25) + baseRadius * 0.18;
  
        this.particles.push({
          x: x,
          y: y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          r: r0,
          a: 1,
          col: this.palette[Math.floor(Math.random() * this.palette.length)]
        });
      }
  
      // Shockwave
      this.shock = {
        r: baseRadius * 0.6,
        a: 0.9,
        growth: baseRadius * 75, // px/s
        fade: 1.4                 // s
      };
  
      // Glow set
      this.glow = {
        a: 0.8,
        fade: 0.8
      };
  
      // Physics & lifetime
      this.gravity = 0.0;
      this.fadeTime = 1.9; // particle fade time (s)
      this.t = 0;
  
      // Performance guard (để global quản lý tối đa 50 explosion 1 lúc)
      if (!Explosion._instances) Explosion._instances = 0;
      Explosion._instances++;
      this._alive = true;
    }
  
    static canSpawn() {
      return (Explosion._instances || 0) < 50;
    }
  
    update(dt = 1 / 60) {
      if (!this._alive) return;
      this.t += dt;
  
      // Update particles
      for (let p of this.particles) {
        p.vy += this.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
  
        // fade
        p.a = Math.max(0, 1 - (this.t / this.fadeTime));
        // shrink
        p.r *= 0.984;
      }
      this.particles = this.particles.filter(p => p.a > 0.03 && p.r > 0.5);
  
      // Update shockwave
      const shockLife = Math.max(0, 1 - (this.t / this.shock.fade));
      this.shock.a = shockLife * 0.9;
      this.shock.r += this.shock.growth * dt;
  
      // Update glow
      this.glow.a = Math.max(0, this.glow.a - (dt / this.glow.fade) * 0.9);
  
      // destroy check
      if (this.particles.length === 0 && this.shock.a <= 0.02 && this.glow.a <= 0.02) {
        this._alive = false;
        Explosion._instances = Math.max(0, Explosion._instances - 1);
      }
    }
  
    draw(ctx) {
      if (!this._alive) return;
  
      ctx.save();
  
      // Shockwave (viền sáng rung nhẹ)
      if (this.shock.a > 0.02) {
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.globalAlpha = this.shock.a * 0.9;
        ctx.strokeStyle = "#ffffff";
        // Outer glow bằng shadow
        ctx.shadowColor = "#fff";
        ctx.shadowBlur = 18;
        ctx.arc(this.x, this.y, this.shock.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
  
      // Core glow
      if (this.glow.a > 0.02) {
        const grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 48);
        grd.addColorStop(0.0, this.coreColor + "ff".replace("#",""));
        grd.addColorStop(0.4, this.coreColor);
        grd.addColorStop(1.0, "rgba(255,255,255,0)");
        ctx.globalAlpha = this.glow.a * 0.6;
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 48, 0, Math.PI * 2);
        ctx.fill();
      }
  
      // Particles
      for (let p of this.particles) {
        ctx.globalAlpha = Math.max(0, p.a);
        ctx.fillStyle = p.col;
        // Glow mạnh cho hạt
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.col;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
  
      ctx.restore();
    }
  
    get alive() { return this._alive; }
  }
  
  window.Explosion = Explosion;
  // ===== TEST ÂM THANH =====
(async function testSounds() {
  console.log("[Audio Test] Bắt đầu kiểm tra file âm thanh...");
  for (const [key, file] of Object.entries(window.audio.files)) {
    const url = window.audio.base + file;
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) {
        console.log(`✅ ${key} : ${url}`);
      } else {
        console.warn(`❌ MISSING: ${key} : ${url}`);
      }
    } catch (err) {
      console.error(`⚠ LỖI: ${key} : ${url} =>`, err);
    }
  }
  console.log("[Audio Test] Hoàn tất kiểm tra.");
})();

  /* ====== Gợi ý tích hợp (đã tương thích với main hiện tại) ======
    - Ở nơi tạo explosion trong game logic:
        if (window.Explosion && Explosion.canSpawn()) {
          explosions.push(new Explosion(x, y, size)); // size: "small" | "medium" | "big"
        }
  
    - Đảm bảo gọi audio.unlock() khi người chơi nhấn Start (HTML đã có sẵn):
        document.getElementById('startBtn').addEventListener('click', async ()=>{
          if (window.audio?.unlock) await audio.unlock();
        });
  
    - Đảm bảo folder /sounds chứa các file mp3 đã khai báo ở trên.
      Nếu bạn chỉ có 1 file cho mỗi size, có thể map như:
        explSmall_1: "expl_small.mp3" (copy 3 lần tên giống nhau vẫn OK)
  */
  