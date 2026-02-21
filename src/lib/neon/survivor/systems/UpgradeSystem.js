import { SHOP_ITEMS, WEAPONS } from "../config/constants.js";

export class UpgradeSystem {
    constructor() {
        this.data = this.loadData();
    }

    loadData() {
        const defaultData = {
            coins: 0,
            highLevel: 1,
            upgrades: {},
            unlockedWeapons: ["blaster_blue"],
            equippedWeapon: "blaster_blue",
            freeDraws: 5 // New User Bonus
        };

        const currentData = JSON.parse(localStorage.getItem("neon_survivors_data") || "null");

        if (currentData) {
            // Merge defaults to add new fields (like freeDraws) to old saves
            return { ...defaultData, ...currentData, freeDraws: currentData.freeDraws !== undefined ? currentData.freeDraws : 5 };
        }
        return defaultData;
    }

    saveData() {
        localStorage.setItem("neon_survivors_data", JSON.stringify(this.data));
    }

    // --- Shop Logic ---
    buyUpgrade(itemId) {
        // ... (existing buy logic, update to match class structure if needed)
        // Re-implementing simplified version that matches previous code structure inside Svelte
        // But here we are cleaner.
        const item = SHOP_ITEMS.find(i => i.id === itemId);
        if (!item) return false;

        const level = this.data.upgrades[itemId] || 0;
        // Import getUpgradeCost dynamically or duplicate logic to avoid circular deps if constants uses store
        // We'll just hardcode the inflation math here for simplicity or assume getUpgradeCost is available
        const currentCost = Math.floor(item.cost * Math.pow(1.2, level));

        if (this.data.coins >= currentCost) {
            this.data.coins -= currentCost;
            this.data.upgrades[itemId] = (this.data.upgrades[itemId] || 0) + 1;
            this.saveData();
            return true;
        }
        return false;
    }

    // --- Gacha Logic ---
    gachaWeapon() {
        const COST = 1000;

        // Lazy migration for active session
        if (this.data.freeDraws === undefined) {
            this.data.freeDraws = 5;
            this.saveData();
        }

        let isFree = (this.data.freeDraws || 0) > 0;

        if (!isFree && this.data.coins < COST) return { success: false, reason: "not_enough_coins" };

        if (isFree) {
            this.data.freeDraws--;
        } else {
            this.data.coins -= COST;
        }

        // Weighted Random
        const totalWeight = WEAPONS.reduce((sum, w) => sum + w.weight, 0);
        let random = Math.random() * totalWeight;
        let selected = WEAPONS[0];

        for (const w of WEAPONS) {
            random -= w.weight;
            if (random <= 0) {
                selected = w;
                break;
            }
        }

        // Check duplicate
        let isDuplicate = this.data.unlockedWeapons.includes(selected.id);
        let result = { success: true, weapon: selected, checkDuplicate: isDuplicate, isFree };

        if (!isDuplicate) {
            this.data.unlockedWeapons.push(selected.id);
        } else {
            if (isFree) {
                // No Refund for free draw
                result.refund = 0;
            } else {
                // Refund 50%
                this.data.coins += COST / 2;
                result.refund = COST / 2;
            }
        }

        this.saveData();
        return result;
    }

    equipWeapon(weaponId) {
        if (this.data.unlockedWeapons.includes(weaponId)) {
            this.data.equippedWeapon = weaponId;
            this.saveData();
            return true;
        }
        return false;
    }

    getEquippedWeaponData() {
        return WEAPONS.find(w => w.id === this.data.equippedWeapon) || WEAPONS[0];
    }

    // ... Helpers
    getCoins() { return this.data.coins; }
    getUpgradeLevel(id) { return this.data.upgrades[id] || 0; }
    addCoins(amount) {
        this.data.coins += amount;
        this.saveData();
    }

    refund() {
        this.data.upgrades = {};
        this.saveData();
    }
}
