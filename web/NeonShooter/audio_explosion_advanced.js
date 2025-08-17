/* ===========================================================
   audio_explosion_advanced.js - FULL HYBRID + DEBUG COLOR
   =========================================================== */

   class AudioManager {
    constructor(basePath = "sounds/") {
      this.base = basePath.endsWith("/") ? basePath : basePath + "/";
  
      // Danh sách file giữ nguyên + thêm mới
      this.files = {
        playerShot: "player_shot.mp3",
        missileShot: "player_missile.mp3",
        laserShot: "lasershot.mp3",
        laserHit: "laser_hit.mp3",
  
        enemyShot: "enemy_single_shot.mp3",
        enemyHit: "enemy_hit.mp3",
  
        explSmall_1: "expl_small_01.mp3",
        explSmall_2: "expl_small_02.mp3",
        explSmall_3: "expl_small_03.mp3",
  
        explMedium_1: "expl_medium_01.mp3",
        explMedium_2: "expl_medium_01.mp3",
        explMedium_3: "expl_medium_01.mp3",
  
        explBig_1: "expl_big_01.mp3",
        explBig_2: "expl_big_01.mp3",
        explBig_3: "expl_big_01.mp3",
  
        explBoss: "expl_boss.mp3",
        playerDeath: "expl_medium_01.mp3",
  
        upgrade: "weapon_upgrade.mp3",
        decline: "upgrade_fail.mp3",
  
        bgmMenu: "Anthem to the Stars Ambient.mp3",
        bgmGame1: "Horns of Despair.mp3",
        bgmGame2: "Anthem to the Stars.mp3"
      };
  
      // Nhóm explosion
      this.explBanks = {
        small: ["explSmall_1", "explSmall_2", "explSmall_3"],
        medium: ["explMedium_1", "explMedium_2", "explMedium_3"],
        big: ["explBig_1", "explBig_2", "explBig_3"],
        boss: ["explBoss"]
      };
  
      // BGM chính
      this.bgm = new Audio();
      this.bgm.loop = true;
      this.bgm.volume = 0.9;
  
      // Pool SFX
      this.pool = new Map();
      this.poolSize = 6;
  
      this.unlocked = false;
      this.menuPlaying = false;
      this.gamePlaying = false;
  
      // Preload SFX
      for (const key in this.files) {
        if (!key.startsWith("bgm")) {
          this._ensurePool(key, this.base + this.files[key]);
        }
      }
  
      // Autoplay hybrid khi load
      window.addEventListener("load", () => {
        console.log("%c[AudioManager] 🔄 Thử autoplay khi load...", "color:purple");
        this.tryAutoplayMenu();
      });
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
        await this.bgm.play().catch(() => {});
        this.bgm.pause();
        this.bgm.currentTime = 0;
        this.unlocked = true;
        console.log("%c[AudioManager] ✅ Unlocked", "color:purple");
        return true;
      } catch (e) {
        console.warn("%c[AudioManager] ❌ Unlock fail:", "color:red", e);
        return false;
      }
    }
  
    tryAutoplayMenu() {
      this.unlocked = true; // trick autoplay hybrid
      this.toMenu(true);
      this.unlocked = false;
    }
  
    fadeBGM(targetVol, duration = 1000) {
      return new Promise(res => {
        const startVol = this.bgm.volume;
        const step = (targetVol - startVol) / (duration / 50);
        let vol = startVol;
        const intv = setInterval(() => {
          vol += step;
          if ((step > 0 && vol >= targetVol) || (step < 0 && vol <= targetVol)) {
            vol = targetVol;
            clearInterval(intv);
            res();
          }
          this.bgm.volume = Math.max(0, Math.min(1, vol));
        }, 50);
      });
    }
  
    playBGM(name) {
      if (!this.unlocked) {
        console.warn("%c[AudioManager] ⚠ Chưa unlock audio, không phát BGM", "color:red");
        return;
      }
      if (!this.files[name]) return;
      this.bgm.src = this.base + this.files[name];
      this.bgm.currentTime = 0;
      this.bgm.play().catch(e => console.warn("[AudioManager] Play BGM fail:", e));
    }
  
    async toMenu(skipFade = false) {
      console.log("%c[AudioManager] 🔄 Chuyển sang BGM Menu", "color:green");
      if (!skipFade) await this.fadeBGM(0, 800);
      this.playBGM("bgmMenu");
      if (!skipFade) await this.fadeBGM(0.9, 800);
      this.menuPlaying = true;
      this.gamePlaying = false;
    }
  
    async toGame() {
      const pick = Math.random() < 0.5 ? "bgmGame1" : "bgmGame2";
      console.log("%c[AudioManager] 🎵 Chuyển sang BGM Game:", "color:green", pick);
      await this.fadeBGM(0, 800);
      this.playBGM(pick);
      await this.fadeBGM(0.9, 800);
      this.gamePlaying = true;
      this.menuPlaying = false;
    }
  
    _getNode(key) {
      const arr = this.pool.get(key);
      for (const a of arr) {
        if (a.paused || a.ended) return a;
      }
      const temp = new Audio(this.base + this.files[key]);
      temp.preload = "auto";
      return temp;
    }
  
    sfx(name, { vol = 1, rate = 1 } = {}) {
      if (!this.unlocked) {
        console.warn("%c[AudioManager] ⚠ Chưa unlock audio, không phát SFX", "color:red");
        return;
      }
      if (!this.files[name]) return;
      const node = this._getNode(name);
      node.volume = vol;
      node.playbackRate = rate;
      node.currentTime = 0;
      node.play().catch(() => {});
      console.log("%c[AudioManager] 🔊 SFX:", "color:orange", name);
    }
  
    explosion(size = "small") {
      if (!this.unlocked) {
        console.warn("%c[AudioManager] ⚠ Chưa unlock audio, không phát Explosion", "color:red");
        return;
      }
      const bank = this.explBanks[size] || this.explBanks.small;
      const name = bank[Math.floor(Math.random() * bank.length)];
      this.sfx(name);
    }
  }
  
  window.audio = new AudioManager();
  