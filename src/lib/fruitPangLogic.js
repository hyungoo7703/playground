export const ROWS = 8;
export const COLS = 7;
export const FRUITS = ["🍎", "🍊", "🍇", "🥝", "🍋"];
export const BOMB = "💣";
export const MUSHROOM = "🍄";

/**
 * Creates an initial grid with random fruits
 */
export function createGrid() {
    return Array.from({ length: ROWS }, () =>
        Array.from(
            { length: COLS },
            () => FRUITS[Math.floor(Math.random() * FRUITS.length)]
        )
    );
}

/**
 * Finds a connected group of identical cells
 */
export function getConnectedGroup(grid, r, c, target, visited = new Set()) {
    const key = `${r},${c}`;
    if (
        r < 0 ||
        r >= ROWS ||
        c < 0 ||
        c >= COLS ||
        visited.has(key) ||
        grid[r][c] !== target
    )
        return [];

    visited.add(key);
    let group = [{ r, c }];

    [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
    ].forEach(([dr, dc]) => {
        group = group.concat(getConnectedGroup(grid, r + dr, c + dc, target, visited));
    });

    return group;
}

/**
 * Applies gravity to the grid (moves items down to fill nulls)
 * Returns the modified grid
 */
export function applyGravity(grid) {
    // Deep clone or just modify in place? modifying in place is fine if we trigger update later
    // But strictly pure usage is safer. Let's modify the passed grid object directly 
    // since we will reassign it in Svelte.

    for (let c = 0; c < COLS; c++) {
        let emptyRow = ROWS - 1;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (grid[r][c] !== null) {
                const temp = grid[r][c];
                grid[r][c] = null;
                grid[emptyRow][c] = temp;
                emptyRow--;
            }
        }
    }
    return grid;
}

/**
 * Refills empty cells in the grid
 * Returns { grid, hasRefilled }
 */
export function fillEmptyCells(grid, isHardMode) {
    let hasRefilled = false;
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            if (grid[r][c] === null) {
                const rand = Math.random();
                if (isHardMode && rand < 0.07) {
                    grid[r][c] = MUSHROOM;
                } else {
                    grid[r][c] = FRUITS[Math.floor(Math.random() * FRUITS.length)];
                }
                hasRefilled = true;
            }
        }
    }
    return { grid, hasRefilled };
}

/**
 * Explodes a bomb at r, c
 * Returns { grid, scoreDelta }
 */
export function explodeBomb(grid, r, c) {
    let scoreDelta = 0;
    for (let i = r - 1; i <= r + 1; i++) {
        for (let j = c - 1; j <= c + 1; j++) {
            if (i >= 0 && i < ROWS && j >= 0 && j < COLS) {
                if (grid[i][j] !== null) {
                    grid[i][j] = null;
                    scoreDelta += 20;
                }
            }
        }
    }
    return { grid, scoreDelta };
}
