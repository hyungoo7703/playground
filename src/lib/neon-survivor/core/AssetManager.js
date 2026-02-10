import { IMAGES, SOUNDS } from "../config/constants.js";

export class AssetManager {
    constructor() {
        this.images = {};
        this.sounds = {}; // { key: { pool: [], index: 0 } }
        this.loadProgress = 0;
        this.bgmAudio = null;
    }

    async loadAll(onProgress) {
        const imageKeys = Object.entries(IMAGES);
        const soundKeys = Object.entries(SOUNDS);
        const total = imageKeys.length + soundKeys.length;
        let loaded = 0;

        const update = () => {
            loaded++;
            this.loadProgress = (loaded / total) * 100;
            if (onProgress) onProgress(this.loadProgress);
        };

        try {
            // Load Images
            const imagePromises = imageKeys.map(([key, src]) => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        update();
                        resolve([key, img]);
                    };
                    img.onerror = (e) => {
                        console.error(`Failed to load ${key}: ${src}`, e);
                        update();
                        resolve([key, null]);
                    };
                    img.src = src;
                });
            });

            // Load Sounds & Create Pools
            const soundPromises = soundKeys.map(([key, src]) => {
                return new Promise((resolve) => {
                    // Create a pool of 5 audios per sound
                    const pool = [];
                    const poolSize = (key === 'zap' || key === 'coin') ? 10 : 5;
                    let loadedCount = 0;

                    const checkDone = () => {
                        loadedCount++;
                        if (loadedCount === poolSize) {
                            update();
                            resolve([key, pool]);
                        }
                    };

                    // We only need one to trigger the "loaded" state for the game, 
                    // but we create the whole pool now.
                    // To be safe, we just wait for the first one or just resolve immediately if we trust browser caching

                    for (let i = 0; i < poolSize; i++) {
                        const audio = new Audio();
                        audio.src = src;
                        audio.load(); // Hint to browser
                        pool.push(audio);
                    }

                    // Simple timeout resolve to prevent hanging, 
                    // real preloading is tricky without more complex logic
                    setTimeout(() => {
                        update();
                        resolve([key, pool]);
                    }, 100);
                });
            });

            const loadedImages = await Promise.all(imagePromises);
            loadedImages.forEach(([key, img]) => {
                if (img) this.images[key] = img;
            });

            const loadedSounds = await Promise.all(soundPromises);
            loadedSounds.forEach(([key, pool]) => {
                this.sounds[key] = {
                    pool: pool,
                    index: 0
                };
            });

            return true;
        } catch (err) {
            console.error("Asset load error", err);
            return false;
        }
    }

    playSound(name, vol = 1.0) {
        if (!this.sounds[name]) return;

        const soundData = this.sounds[name];
        const audio = soundData.pool[soundData.index];

        if (audio) {
            audio.currentTime = 0;
            audio.volume = vol;
            audio.play().catch(e => { /* Ignore autoplay errors if any */ });

            soundData.index = (soundData.index + 1) % soundData.pool.length;
        }
    }

    playBGM() {
        if (!this.sounds.bgm) return;

        // Use the first one in the pool as dedicated BGM
        this.bgmAudio = this.sounds.bgm.pool[0];
        this.bgmAudio.loop = true;
        this.bgmAudio.volume = 0.5;
        this.bgmAudio.play().catch(() => { });
    }

    stopBGM() {
        if (this.bgmAudio) {
            this.bgmAudio.pause();
            this.bgmAudio.currentTime = 0;
        }
    }

    getImage(name) {
        return this.images[name];
    }
}
