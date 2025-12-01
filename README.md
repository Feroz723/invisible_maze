# Invisible Maze

A browser-based perceptual ability game inspired by Accenture's "Invisible Maze" assessment.

## Project Structure

This project uses a vanilla JavaScript approach within a Vite environment.

- `client/index.html`: Main entry point and UI structure.
- `client/style.css`: Styling, animations, and responsive design variables.
- `client/script.js`: Game logic, state management, and maze generation.

## Game Mechanics

1. **Objective**: Navigate the avatar (Blue Circle) to the Key (Yellow), then to the Door (Green).
2. **Invisible Walls**: Walls are not visible initially.
3. **Collision**: If you hit a wall:
   - The wall flashes and becomes permanently visible (Dark Red).
   - The avatar resets to the start position.
   - "Attempts" counter increases.
4. **Success**: Reaching the door with the key completes the level.

## Configuration & Level Structure

The game difficulty levels are configured in `client/script.js` within the `CONFIG` object:

```javascript
const CONFIG = {
  EASY: { size: 3, walls: 2, name: 'EASY' },
  MEDIUM: { size: 4, walls: 6, name: 'MEDIUM' },
  HARD: { size: 5, walls: 12, name: 'HARD' }
};
```

- **size**: The grid dimension (e.g., 3 means a 3x3 grid).
- **walls**: The target number of invisible walls to generate.

### How to Add New Levels

To add a new difficulty level (e.g., "INSANE"):

1. Open `client/script.js`.
2. Add a new entry to `CONFIG`:
   ```javascript
   INSANE: { size: 6, walls: 20, name: 'INSANE' }
   ```
3. Open `client/index.html`.
4. Add a button to the difficulty selector:
   ```html
   <button class="diff-btn" data-diff="INSANE">INSANE (6x6)</button>
   ```
5. The game logic automatically handles grid rendering and wall generation based on these parameters.

## Modes

- **Practice Mode**: Unlimited attempts.
- **Challenge Mode**: One mistake resets the run (Game Over).

## Local Storage

Scores are saved to the browser's `localStorage` under the key `maze_scores`.
