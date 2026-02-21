export class InputManager {
    constructor() {
        this.keys = {};
        this.touchStart = null;
        this.joystickVector = { x: 0, y: 0 };

        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);

        // Touch events would be bound here or passed from Svelte
    }

    mount() {
        window.addEventListener("keydown", this.handleKeyDown);
        window.addEventListener("keyup", this.handleKeyUp);
    }

    destroy() {
        window.removeEventListener("keydown", this.handleKeyDown);
        window.removeEventListener("keyup", this.handleKeyUp);
    }

    handleKeyDown(e) {
        this.keys[e.key] = true;
    }

    handleKeyUp(e) {
        this.keys[e.key] = false;
    }

    getMovementVector() {
        let dx = 0;
        let dy = 0;

        if (this.keys["ArrowUp"] || this.keys["w"]) dy = -1;
        if (this.keys["ArrowDown"] || this.keys["s"]) dy = 1;
        if (this.keys["ArrowLeft"] || this.keys["a"]) dx = -1;
        if (this.keys["ArrowRight"] || this.keys["d"]) dx = 1;

        if (this.joystickVector.x !== 0 || this.joystickVector.y !== 0) {
            dx = this.joystickVector.x;
            dy = this.joystickVector.y;
        }

        return { dx, dy };
    }

    setJoystick(x, y) {
        this.joystickVector = { x, y };
    }

    // Touch handlers called from Svelte component
    handleTouchStart(e, joystickCenter) {
        this.touchStart = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
        };
        // Reset joystick center if needed, or handle dynamic joystick
    }

    handleTouchMove(e, joystickCenter) {
        if (!this.touchStart) return;

        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;

        const deltaX = touchX - this.touchStart.x;
        const deltaY = touchY - this.touchStart.y;
        const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const maxDist = 50; // joystick radius

        const clampedDist = Math.min(dist, maxDist);
        const angle = Math.atan2(deltaY, deltaX);

        this.joystickVector = {
            x: Math.cos(angle) * (clampedDist / maxDist),
            y: Math.sin(angle) * (clampedDist / maxDist),
        };
    }

    handleTouchEnd() {
        this.touchStart = null;
        this.joystickVector = { x: 0, y: 0 };
    }
}
