export class Enemy {
    constructor(x, y, type, properties = {}) {
        this.x = x;
        this.y = y;
        this.type = type; // 0, 1, 2, 3(special), 4(special)
        this.isSpecial = properties.isSpecial || false;
        this.isBoss = properties.isBoss || false;
        this.bossType = properties.bossType || 0;

        this.hp = properties.hp || 30;
        this.maxHp = this.hp;
        this.speed = properties.speed || 1.5;
        this.radius = properties.radius || 15;
    }

    update(dt, playerX, playerY) {
        const angle = Math.atan2(playerY - this.y, playerX - this.x);
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;
    }

    takeDamage(amount) {
        this.hp -= amount;
        return this.hp <= 0;
    }
}
