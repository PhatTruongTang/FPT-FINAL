class AudioManager {
    constructor(basePath = "sounds/") {
        this.base = basePath.endsWith("/") ? basePath : basePath + "/";

        // Đồng bộ tên file audio
        this.files = {
            playerShot: "player_shot.mp3",
            missileShot: "player_missile.mp3",
            laserShot: "lasershot.mp3",
            enemyShot: "enemy_single_shot.mp3",
            enemyHit: "enemy_hit.mp3",
            playerHit: "player_hit_bullet.mp3",
            explSmall: "expl_small.mp3",
            explMedium: "expl_medium.mp3",
            explBig: "expl_big.mp3",
            bgmMenu: "Anthem to the Stars Ambient.mp3",
            bgmGame1: "Horns of Despair.mp3",
            bgmGame2: "Anthem to the Stars.mp3"
        };

        this.bgm = new Audio();
        this.bgm.loop = true;
        this.bgm.volume = 0.9;

        this.sfxCache = new Map();
        for (let key in this.files) {
            if (!key.startsWith("bgm")) {
                const audioPath = this.base + this.files[key];
                const audio = new Audio(audioPath);
                audio.preload = "auto";
                this.sfxCache.set(key, audio);

                // Kiểm tra file tồn tại
                fetch(audioPath, { method: "HEAD" }).then(res => {
                    if (!res.ok) {
                        console.warn(`[AudioManager] ⚠ Missing audio file: ${audioPath}`);
                    }
                }).catch(() => {
                    console.warn(`[AudioManager] ⚠ Cannot load audio file: ${audioPath}`);
                });
            }
        }

        this.menuPlaying = false;
        this.gamePlaying = false;
        this.unlocked = false;
    }

    async unlock() {
        if (this.unlocked) return true;
        try {
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
        let step = (targetVolume - this.bgm.volume) / (duration / 50);
        let fadeInterval = setInterval(() => {
            this.bgm.volume = Math.max(0, Math.min(1, this.bgm.volume + step));
            if ((step > 0 && this.bgm.volume >= targetVolume) ||
                (step < 0 && this.bgm.volume <= targetVolume)) {
                clearInterval(fadeInterval);
                if (callback) callback();
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

    sfx(name, { vol = 1 } = {}) {
        if (!this.unlocked) return;
        if (!this.files[name]) {
            console.warn(`[AudioManager] SFX '${name}' not found`);
            return;
        }
        let sound;
        if (this.sfxCache.has(name)) {
            sound = this.sfxCache.get(name).cloneNode();
        } else {
            sound = new Audio(this.base + this.files[name]);
        }
        sound.volume = vol;
        sound.play().catch(() => {});
    }

    explosion(size = "small") {
        const map = { small: "explSmall", medium: "explMedium", big: "explBig" };
        const pick = map[size] || "explSmall";
        const vol = size === "big" ? 1.0 : size === "medium" ? 0.9 : 0.8;
        this.sfx(pick, { vol });
    }
}

window.audio = new AudioManager("sounds/");
