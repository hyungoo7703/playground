export class Projectile {
    constructor(x, y, vx, vy, properties = {}) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;

        this.life = properties.life || 1500;
        this.pierce = properties.pierce || 0;
        this.damage = properties.damage || 10;
        this.isEnemy = properties.isEnemy || false;
        this.isBlade = properties.isBlade || false;
        this.rotation = 0;
        this.props = properties; // Added this line to store properties for draw method

        this.hitIds = new Set();
    }

    update(dt) {
        // ... movement handled by Engine for better control or here? 
        // Engine handles movement for now based on previous code.
        // Actually Engine updates x/y directly using vx/vy. 
        // This class is mostly data + draw.
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        ctx.shadowBlur = 10;
        ctx.shadowColor = this.props.color || (this.isEnemy ? "#f00" : "#0ff");
        ctx.fillStyle = this.props.color || (this.isEnemy ? "red" : "cyan");

        const shape = this.props.shape || "circle";
        const baseSize = this.isEnemy ? 8 : 5;
        const size = baseSize * (this.props.size || 1);

        if (shape === "circle") {
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();
        } else if (shape === "rect") {
            ctx.fillRect(-size, -size / 2, size * 2, size); // Long laser like
        } else if (shape === "star") {
            // Shuriken
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                ctx.lineTo(Math.cos(i * Math.PI / 2) * size * 1.5, Math.sin(i * Math.PI / 2) * size * 1.5);
                ctx.lineTo(Math.cos(i * Math.PI / 2 + Math.PI / 4) * size * 0.5, Math.sin(i * Math.PI / 2 + Math.PI / 4) * size * 0.5);
            }
            ctx.closePath();
            ctx.fill();
        } else if (shape === "moon") {
            ctx.beginPath();
            ctx.arc(0, 0, size * 1.5, 0.5 * Math.PI, 2.5 * Math.PI); // Outer
            ctx.arc(size * 0.5, 0, size * 1.2, 2.5 * Math.PI, 0.5 * Math.PI, true); // Inner cutout
            ctx.fill();
        } else if (shape === "fireball") {
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();
            // Trail effect handled by particles in Engine, but we can add a simple core here
            ctx.fillStyle = "white";
            ctx.beginPath();
            ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
            ctx.fill();
        } else if (shape === "void") {
            ctx.strokeStyle = this.props.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = "black";
            ctx.fill();
        } else if (shape === "nova") {
            // Mythic Nova Shape
            const gradient = ctx.createRadialGradient(0, 0, size * 0.2, 0, 0, size);
            gradient.addColorStop(0, "white");
            gradient.addColorStop(0.5, this.props.color);
            gradient.addColorStop(1, "transparent");
            ctx.fillStyle = gradient;

            ctx.beginPath();
            const spikes = 8;
            for (let i = 0; i < spikes * 2; i++) {
                const r = (i % 2 === 0) ? size : size * 0.4;
                const a = (Math.PI * i) / spikes + this.rotation * 5; // Spin fast
                ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            ctx.closePath();
            ctx.fill();

            // Extra glow ring
            ctx.strokeStyle = "white";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, 0, size * 0.8, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }
}
