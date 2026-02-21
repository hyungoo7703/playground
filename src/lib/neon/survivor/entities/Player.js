export class Player {
    constructor(canvasWidth, canvasHeight, savedData) {
        this.x = 0;
        this.y = 0;

        // Upgrades from saved data
        const speedUpgrade = savedData.upgrades?.speed || 0;
        const hpUpgrade = savedData.upgrades?.hp || 0;
        const magnetUpgrade = savedData.upgrades?.magnet || 0;
        const damageUpgrade = savedData.upgrades?.damage || 0;

        this.speed = 3 + speedUpgrade * 0.2;
        this.level = 1;
        this.exp = 0;
        this.maxExp = 10;
        this.hp = 100 + hpUpgrade * 20;
        this.maxHp = this.hp;
        this.coins = 0;

        // Weapon stats
        this.weaponLevel = 1;
        this.fireRate = 800;
        this.lastShot = 0;
        this.damageBonus = damageUpgrade * 2;
        this.projectileSize = 0;
        this.piercing = 2;

        this.magnetRadius = 100 + magnetUpgrade * 20;

        // Visual state
        this.visual = {
            facing: 1, // 1: Right, -1: Left
            tilt: 0,
            bobTimer: 0,
            bobOffset: 0
        };
    }

    update(dt, inputVector) {
        if (inputVector.dx !== 0 || inputVector.dy !== 0) {
            const length = Math.sqrt(inputVector.dx * inputVector.dx + inputVector.dy * inputVector.dy);
            this.x += (inputVector.dx / length) * this.speed;
            this.y += (inputVector.dy / length) * this.speed;

            // Visual updates
            if (inputVector.dx !== 0) {
                this.visual.facing = inputVector.dx > 0 ? 1 : -1;
            }

            const targetTilt = (inputVector.dx / length) * 0.15;
            this.visual.tilt += (targetTilt - this.visual.tilt) * 0.2;

            this.visual.bobTimer += dt * 0.015;
            this.visual.bobOffset = Math.sin(this.visual.bobTimer) * 5;
        } else {
            this.visual.tilt *= 0.8;
            this.visual.bobOffset *= 0.8;
            this.visual.bobTimer = 0;
        }
    }

    gainExp(amount) {
        this.exp += amount;
        if (this.exp >= this.maxExp) {
            this.exp -= this.maxExp;
            this.level++;
            this.maxExp = Math.floor(this.maxExp * 1.5);
            return true; // Leveled up
        }
        return false;
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    takeDamage(amount) {
        this.hp = Math.max(0, this.hp - amount);
        return this.hp <= 0;
    }
}
