class AudioManager {
    constructor() {
        this.sounds = {};
        this.pools = {};
        this.muted = false;
    }

    /**
     * Preload a sound file and create a pool of Audio objects
     * @param {string} name - Identifier for the sound
     * @param {string} path - Path to the sound file
     * @param {number} size - Number of Audio objects to create in the pool
     */
    load(name, path, size = 5) {
        if (this.sounds[name]) return;

        this.sounds[name] = {
            path,
            poolSize: size,
            index: 0
        };

        this.pools[name] = [];
        for (let i = 0; i < size; i++) {
            const audio = new Audio(path);
            // Pre-load metadata/data if possible, though browsers might lazy load
            audio.load();
            this.pools[name].push(audio);
        }
    }

    /**
   * Play a sound from the pool
   * @param {string} name - Identifier of the sound to play
   * @param {number} volume - Volume (0.0 to 1.0)
   * @param {number} duration - Optional duration in ms. If set, stops playback after this time.
   */
    play(name, volume = 1.0, duration = 0) {
        if (this.muted || !this.sounds[name]) return;

        const soundData = this.sounds[name];
        const pool = this.pools[name];

        // Round-robin selection from pool
        const audio = pool[soundData.index];

        // Clear any existing timeout for this audio instance
        if (audio._stopTimeout) {
            clearTimeout(audio._stopTimeout);
            audio._stopTimeout = null;
        }

        // Reset and play
        audio.currentTime = 0;
        audio.volume = volume;
        audio.play().catch(e => console.debug("Audio play failed:", e));

        // Handle duration if specified
        if (duration > 0) {
            audio._stopTimeout = setTimeout(() => {
                audio.pause();
                audio.currentTime = 0;
            }, duration);
        }

        // Update index for next call
        soundData.index = (soundData.index + 1) % soundData.poolSize;
    }

    setMute(mute) {
        this.muted = mute;
    }
}

export const audioManager = new AudioManager();
