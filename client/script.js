/**
 * Invisible Maze - Game Logic
 * 
 * Concepts:
 * - Grid: 2D array representing cells.
 * - Walls: Stored as edges between cells.
 * - Invisible until hit: Wall state 'hidden' -> 'revealed'.
 * - Mechanics: Move -> Check Wall -> (Collision ? Reset : Move).
 */

// --- Configuration & State ---
const CONFIG = {
  EASY: { size: 3, walls: 2, name: 'EASY' },
  MEDIUM: { size: 4, walls: 6, name: 'MEDIUM' },
  HARD: { size: 5, walls: 12, name: 'HARD' }
};

const STATE = {
  difficulty: 'EASY',
  mode: 'PRACTICE', // PRACTICE | CHALLENGE
  gridSize: 3,
  avatarPos: { x: 0, y: 0 },
  keyPos: { x: 0, y: 0 },
  doorPos: { x: 0, y: 0 },
  hasKey: false,
  attempts: 0,
  startTime: 0,
  timerInterval: null,
  walls: [], // Array of {x, y, dir}
  revealedWalls: [], // String keys "x,y,dir"
  currentLevel: 1,
  isPlaying: false
};

// --- DOM Elements ---
const els = {
  app: document.querySelector('.app-container'),
  gridContainer: document.getElementById('grid-container'),
  screens: {
    start: document.getElementById('start-screen'),
    game: document.getElementById('game-ui'),
    success: document.getElementById('success-screen'),
    instructions: document.getElementById('instructions-overlay')
  },
  stats: {
    level: document.getElementById('stat-level'),
    attempts: document.getElementById('stat-attempts'),
    time: document.getElementById('stat-time'),
    keyIcon: document.getElementById('stat-key-icon')
  },
  buttons: {
    start: document.getElementById('btn-start'),
    practice: document.getElementById('btn-mode-practice'),
    challenge: document.getElementById('btn-mode-challenge'),
    diffs: document.querySelectorAll('.diff-btn'),
    restart: document.getElementById('btn-restart'),
    nextLevel: document.getElementById('btn-next-level'),
    home: document.getElementById('btn-home'),
    gameHome: document.getElementById('btn-game-home')
  }
};

// --- Initialization ---
function init() {
  loadProgress();
  setupEventListeners();
  selectDifficulty('EASY');
}

function setupEventListeners() {
  // Difficulty Selection
  els.buttons.diffs.forEach(btn => {
    btn.addEventListener('click', () => selectDifficulty(btn.dataset.diff));
  });

  // Start Game
  els.buttons.start.addEventListener('click', () => startGame(true));
  
  // Mode Selection
  els.buttons.practice.addEventListener('click', () => setMode('PRACTICE'));
  els.buttons.challenge.addEventListener('click', () => setMode('CHALLENGE'));

  // In-Game Home Button
  els.buttons.gameHome.addEventListener('click', () => {
    STATE.isPlaying = false;
    if (STATE.timerInterval) clearInterval(STATE.timerInterval);
    showScreen('start');
  });

  // Success Screen Actions
  els.buttons.nextLevel.addEventListener('click', () => {
    hideScreen('success');
    STATE.currentLevel++;
    startGame(false); // false = don't reset level
  });

  els.buttons.restart.addEventListener('click', () => {
    hideScreen('success');
    startGame(false); // Replay same level (same logic, new gen)
  });
  
  els.buttons.home.addEventListener('click', () => {
    hideScreen('success');
    showScreen('start');
  });

  // Controls
  document.addEventListener('keydown', handleInput);
  
  // Mobile Controls
  document.querySelectorAll('.btn-control').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent double fire on some touch devices
      moveAvatar(btn.dataset.dir);
    });
    // Touch support for faster response
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      moveAvatar(btn.dataset.dir);
    });
  });
}

function selectDifficulty(diff) {
  STATE.difficulty = diff;
  STATE.gridSize = CONFIG[diff].size;
  
  els.buttons.diffs.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.diff === diff);
  });
}

function setMode(mode) {
  STATE.mode = mode;
  els.buttons.practice.classList.toggle('active', mode === 'PRACTICE');
  els.buttons.challenge.classList.toggle('active', mode === 'CHALLENGE');
}

// --- Game Logic ---

function startGame(resetLevel = true) {
  STATE.isPlaying = true;
  STATE.attempts = 0;
  STATE.hasKey = false;
  STATE.revealedWalls = [];
  STATE.startTime = Date.now();
  
  if (resetLevel) {
    STATE.currentLevel = 1;
  }
  
  // Generate Level
  generateLevel();
  
  // Render
  renderGrid();
  updateStats();
  
  // Timer
  if (STATE.timerInterval) clearInterval(STATE.timerInterval);
  STATE.timerInterval = setInterval(updateTimer, 1000);
  
  // UI
  hideScreen('start');
  hideScreen('success');
  els.stats.keyIcon.style.opacity = '0.3';
}

function generateLevel() {
  const size = STATE.gridSize;
  
  // Positions
  STATE.avatarPos = { x: 0, y: size - 1 }; // Start Bottom Left
  STATE.doorPos = { x: size - 1, y: 0 };   // Door Top Right
  
  // Key Position (Random, not on Start or Door)
  do {
    STATE.keyPos = {
      x: Math.floor(Math.random() * size),
      y: Math.floor(Math.random() * size)
    };
  } while (
    (STATE.keyPos.x === STATE.avatarPos.x && STATE.keyPos.y === STATE.avatarPos.y) ||
    (STATE.keyPos.x === STATE.doorPos.x && STATE.keyPos.y === STATE.doorPos.y)
  );

  // Generate Walls
  // We need to ensure the path is solvable.
  // Strategy: Start with full connectivity, add random walls, check solvability.
  // Actually, simpler: List all possible internal walls. Shuffle. Add one by one if path still exists.
  
  STATE.walls = [];
  const possibleWalls = [];
  
  // Horizontal walls (between rows)
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size; x++) {
      possibleWalls.push({ x, y, dir: 'bottom' }); // Wall below cell x,y (same as top of x,y+1)
    }
  }
  
  // Vertical walls (between cols)
  for (let x = 0; x < size - 1; x++) {
    for (let y = 0; y < size; y++) {
      possibleWalls.push({ x, y, dir: 'right' }); // Wall right of cell x,y
    }
  }
  
  // Shuffle walls
  possibleWalls.sort(() => Math.random() - 0.5);
  
  // Try adding walls up to limit
  const targetWalls = CONFIG[STATE.difficulty].walls;
  let addedWalls = 0;
  
  for (const wall of possibleWalls) {
    if (addedWalls >= targetWalls) break;
    
    STATE.walls.push(wall);
    
    // Check if solvable (Start -> Key AND Key -> Door)
    if (!isSolvable()) {
      STATE.walls.pop(); // Remove if it blocks path
    } else {
      addedWalls++;
    }
  }
}

function isSolvable() {
  // Check connectivity using BFS/Flood Fill
  const canReachKey = hasPath(STATE.avatarPos, STATE.keyPos);
  if (!canReachKey) return false;
  
  const canReachDoor = hasPath(STATE.keyPos, STATE.doorPos);
  return canReachDoor;
}

function hasPath(start, end) {
  const queue = [start];
  const visited = new Set([`${start.x},${start.y}`]);
  
  const dirs = [
    { dx: 0, dy: -1, dir: 'top' },    // Up
    { dx: 0, dy: 1, dir: 'bottom' },  // Down
    { dx: -1, dy: 0, dir: 'left' },   // Left
    { dx: 1, dy: 0, dir: 'right' }    // Right
  ];

  while (queue.length > 0) {
    const curr = queue.shift();
    
    if (curr.x === end.x && curr.y === end.y) return true;
    
    for (const d of dirs) {
      const nx = curr.x + d.dx;
      const ny = curr.y + d.dy;
      
      // Check bounds
      if (nx >= 0 && nx < STATE.gridSize && ny >= 0 && ny < STATE.gridSize) {
        // Check walls
        if (!hasWall(curr.x, curr.y, d.dir)) {
          const key = `${nx},${ny}`;
          if (!visited.has(key)) {
            visited.add(key);
            queue.push({ x: nx, y: ny });
          }
        }
      }
    }
  }
  return false;
}

function hasWall(x, y, moveDir) {
  // Convert moveDir to canonical wall storage (right or bottom)
  // walls stored as {x, y, dir: 'right'|'bottom'}
  
  // Moving Right from x,y -> check wall at x,y type 'right'
  if (moveDir === 'right') {
    return STATE.walls.some(w => w.x === x && w.y === y && w.dir === 'right');
  }
  // Moving Left from x,y -> check wall at x-1,y type 'right'
  if (moveDir === 'left') {
    return STATE.walls.some(w => w.x === x - 1 && w.y === y && w.dir === 'right');
  }
  // Moving Down from x,y -> check wall at x,y type 'bottom'
  if (moveDir === 'bottom') {
    return STATE.walls.some(w => w.x === x && w.y === y && w.dir === 'bottom');
  }
  // Moving Up from x,y -> check wall at x,y-1 type 'bottom'
  if (moveDir === 'top') {
    return STATE.walls.some(w => w.x === x && w.y === y - 1 && w.dir === 'bottom');
  }
  return false;
}

// --- Rendering ---

function renderGrid() {
  const container = els.gridContainer;
  container.innerHTML = '';
  
  const size = STATE.gridSize;
  container.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  
  // Create Cells
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.x = x;
      cell.dataset.y = y;
      
      // Add Avatar
      if (x === STATE.avatarPos.x && y === STATE.avatarPos.y) {
        const avatar = document.createElement('div');
        avatar.className = 'entity avatar';
        // Use SVG or just a circle
        avatar.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="8" r="5"/><path d="M20 21v-2a7 7 0 0 0-14 0v2"/></svg>`;
        cell.appendChild(avatar);
      }
      
      // Add Key
      if (!STATE.hasKey && x === STATE.keyPos.x && y === STATE.keyPos.y) {
        const key = document.createElement('div');
        key.className = 'entity key-item';
        key.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>`;
        cell.appendChild(key);
      }
      
      // Add Door
      if (x === STATE.doorPos.x && y === STATE.doorPos.y) {
        const door = document.createElement('div');
        door.className = `entity door ${STATE.hasKey ? 'open' : ''}`;
        door.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 21v-4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><circle cx="10" cy="14" r="1"/><rect x="4" y="7" width="16" height="14" rx="2"/></svg>`;
        cell.appendChild(door);
      }
      
      // Add Revealed Walls relative to this cell
      // Right Wall
      const wallRightKey = `${x},${y},right`;
      if (STATE.revealedWalls.includes(wallRightKey)) {
        const wall = document.createElement('div');
        wall.className = 'wall wall-v wall-right revealed';
        cell.appendChild(wall);
      }
      
      // Bottom Wall
      const wallBottomKey = `${x},${y},bottom`;
      if (STATE.revealedWalls.includes(wallBottomKey)) {
        const wall = document.createElement('div');
        wall.className = 'wall wall-h wall-bottom revealed';
        cell.appendChild(wall);
      }
      
      container.appendChild(cell);
    }
  }
}

function updateStats() {
  els.stats.level.textContent = STATE.currentLevel;
  els.stats.attempts.textContent = STATE.attempts;
  els.stats.keyIcon.style.opacity = STATE.hasKey ? '1' : '0.3';
  els.stats.keyIcon.style.color = STATE.hasKey ? 'var(--accent-key)' : 'var(--text-secondary)';
}

function updateTimer() {
  const elapsed = Math.floor((Date.now() - STATE.startTime) / 1000);
  const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const secs = (elapsed % 60).toString().padStart(2, '0');
  els.stats.time.textContent = `${mins}:${secs}`;
}

// --- Interaction ---

function handleInput(e) {
  if (!STATE.isPlaying) return;
  
  let dir = null;
  switch(e.key) {
    case 'ArrowUp':
    case 'w':
      dir = 'top'; break;
    case 'ArrowDown':
    case 's':
      dir = 'bottom'; break;
    case 'ArrowLeft':
    case 'a':
      dir = 'left'; break;
    case 'ArrowRight':
    case 'd':
      dir = 'right'; break;
  }
  
  if (dir) moveAvatar(dir);
}

function moveAvatar(dir) {
  const { x, y } = STATE.avatarPos;
  let nx = x, ny = y;
  
  if (dir === 'top') ny--;
  if (dir === 'bottom') ny++;
  if (dir === 'left') nx--;
  if (dir === 'right') nx++;
  
  // Check Bounds
  if (nx < 0 || nx >= STATE.gridSize || ny < 0 || ny >= STATE.gridSize) {
    return; // Cannot move outside
  }
  
  // Check Wall Collision
  if (hasWall(x, y, dir)) {
    handleCollision(x, y, dir);
    return;
  }
  
  // Move Success
  STATE.avatarPos = { x: nx, y: ny };
  checkEntityCollision();
  renderGrid();
}

function handleCollision(fromX, fromY, dir) {
  STATE.attempts++;
  updateStats();
  
  // Reveal Wall logic
  let wallKey = '';
  if (dir === 'right') wallKey = `${fromX},${fromY},right`;
  else if (dir === 'bottom') wallKey = `${fromX},${fromY},bottom`;
  else if (dir === 'left') wallKey = `${fromX - 1},${fromY},right`; // Wall is to the right of the left neighbor
  else if (dir === 'top') wallKey = `${fromX},${fromY - 1},bottom`; // Wall is to the bottom of the top neighbor
  
  if (!STATE.revealedWalls.includes(wallKey)) {
    STATE.revealedWalls.push(wallKey);
  }
  
  // Visual Feedback: Flash Red & Reset
  // Ideally, we animate the "Hit" then reset.
  
  // For now: Find the specific wall element if we can, or just re-render with it revealed + class 'hit'
  renderGrid();
  
  // Add 'hit' class to the just revealed wall for animation
  // This is a bit tricky since we just re-rendered. 
  // Simplification: Flash screen or reset immediately.
  
  document.body.style.backgroundColor = '#451a1a'; // Flash red bg
  setTimeout(() => {
    document.body.style.backgroundColor = 'var(--bg-color)';
  }, 100);
  
  // Reset Position
  STATE.avatarPos = { x: 0, y: STATE.gridSize - 1 }; // Back to start
  
  if (STATE.mode === 'CHALLENGE') {
    // Hard mode punishment? 
    // "1 attempt per level" in challenge mode might mean Game Over?
    // Or just reset. Prompt says "Challenge Mode (timed, 1 attempt per level)".
    // "1 attempt" usually means if you hit a wall, you fail the level.
    // Let's interpret it as "Game Over" on hit.
    endGame(false);
  } else {
    renderGrid();
  }
}

function checkEntityCollision() {
  const { x, y } = STATE.avatarPos;
  
  // Key
  if (!STATE.hasKey && x === STATE.keyPos.x && y === STATE.keyPos.y) {
    STATE.hasKey = true;
    updateStats();
    // Sound effect or visual cue could go here
  }
  
  // Door
  if (x === STATE.doorPos.x && y === STATE.doorPos.y) {
    if (STATE.hasKey) {
      endGame(true);
    } else {
      // Maybe shake door or message "Locked"
      // For now, nothing happens, you just stand on the locked door
    }
  }
}

function endGame(success) {
  STATE.isPlaying = false;
  clearInterval(STATE.timerInterval);
  
  if (success) {
    document.getElementById('final-time').textContent = els.stats.time.textContent;
    document.getElementById('final-attempts').textContent = STATE.attempts;
    
    // Score calc
    const timeSec = Math.floor((Date.now() - STATE.startTime) / 1000);
    const score = Math.max(0, 1000 - (timeSec * 5) - (STATE.attempts * 50));
    document.getElementById('final-score').textContent = score;
    
    saveScore(score);
    showScreen('success');
  } else {
    // Challenge Mode Failure
    alert('Game Over! In Challenge Mode, one mistake ends the run.');
    showScreen('start');
  }
}

// --- Storage ---
function saveScore(score) {
  const scores = JSON.parse(localStorage.getItem('maze_scores') || '[]');
  scores.push({
    date: new Date().toISOString(),
    score,
    diff: STATE.difficulty,
    mode: STATE.mode
  });
  localStorage.setItem('maze_scores', JSON.stringify(scores));
}

function loadProgress() {
  // Could load best scores to display
}

// --- UI Helpers ---
function showScreen(id) {
  els.screens[id].classList.remove('hidden');
}

function hideScreen(id) {
  els.screens[id].classList.add('hidden');
}

// Start
init();
