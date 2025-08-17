class Explosion {
    constructor(x, y, size = "small", color = "#ffb36c") {
        this.x = x;
        this.y = y;
        this.size = size;

        // Phát âm thanh nổ ngay khi tạo
        if (window.audio && audio.explosion) {
            try {
                audio.explosion(size);
            } catch (err) {
                console.warn("[Explosion] Cannot play sound:", err);
            }
        }

        // Cấu hình số hạt dựa theo size
        const base = size === "big" ? 26 : size === "medium" ? 18 : 12;
        const count = size === "big" ? 42 : size === "medium" ? 28 : 18;
        this.particles = [];

        for (let i = 0; i < count; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = (Math.random() * 1 + 0.5) * (base * 12);
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd,
                r: Math.random() * (base * 0.25) + base * 0.15,
                a: 1,
                col: color
            });
        }

        this.gravity = 0.0;  // Không rơi xuống
        this.fade = 1.8;     // Thời gian tan biến
        this.t = 0;
    }

    update(dt = 1 / 60) {
        this.t += dt;
        for (let p of this.particles) {
            p.vy += this.gravity * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.a = Math.max(0, 1 - (this.t / this.fade));
            p.r *= 0.985;
        }
        this.particles = this.particles.filter(p => p.a > 0.02 && p.r > 0.6);
    }

    draw(ctx) {
        if (!this.particles || !this.particles.length) return;
        ctx.save();
        for (let p of this.particles) {
            ctx.globalAlpha = Math.max(0, p.a);
            ctx.fillStyle = p.col;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

// Đảm bảo main.js có thể gọi được
window.Explosion = Explosion;
