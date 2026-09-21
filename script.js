/**
 * e-caR: Neon Highway Arcade Engine
 * Pure HTML5 Canvas & DOM 2D Racer with Web Audio & Touch Controls
 */

(function () {
  'use strict';

  // DOM Elements
  const currentScoreEl = document.getElementById('currentScore');
  const highScoreEl = document.getElementById('highScore');
  const speedMeterEl = document.getElementById('speedMeter');
  const soundToggleBtn = document.getElementById('soundToggle');
  const soundIcon = document.getElementById('soundIcon');
  
  const roadTrack = document.getElementById('roadTrack');
  const lanesContainer = document.getElementById('lanesContainer');
  const trafficContainer = document.getElementById('trafficContainer');
  const particlesLayer = document.getElementById('particlesLayer');
  
  const startScreen = document.getElementById('startScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const menuBtn = document.getElementById('menuBtn');
  const finalScoreEl = document.getElementById('finalScore');
  const finalHighScoreEl = document.getElementById('finalHighScore');
  const newRecordNotice = document.getElementById('newRecordNotice');
  const modeButtons = document.querySelectorAll('.mode-btn');

  // Touch buttons
  const touchButtons = document.querySelectorAll('.touch-btn');

  // Sound & Audio Setup (Audio Pool + Web Audio API Synth)
  let soundEnabled = localStorage.getItem('ecar_sound') !== 'false';
  let crashAudio = null;
  try {
    crashAudio = new Audio('audio/dtp1.mp3');
    crashAudio.preload = 'auto';
  } catch (e) {
    console.warn('HTML5 Audio not allowed yet:', e);
  }

  // Web Audio Context for synthesized sound FX
  let audioCtx = null;
  function initAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playSynthTone(freq, type, duration, gainVal = 0.15) {
    if (!soundEnabled || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio fallback
    }
  }

  function playNearMissSound() {
    if (!soundEnabled) return;
    playSynthTone(587.33, 'sine', 0.15, 0.18); // D5
    setTimeout(() => playSynthTone(880, 'sine', 0.2, 0.2), 60); // A5
  }

  function playCrashSound() {
    if (!soundEnabled) return;
    if (crashAudio) {
      crashAudio.currentTime = 0;
      crashAudio.play().catch(() => {
        playSynthTone(120, 'sawtooth', 0.5, 0.3);
      });
    } else {
      playSynthTone(120, 'sawtooth', 0.5, 0.3);
    }
  }

  // Update Sound Icon UI
  function updateSoundUI() {
    if (soundEnabled) {
      soundIcon.innerHTML = `
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
      `;
      soundToggleBtn.style.color = 'var(--neon-cyan)';
    } else {
      soundIcon.innerHTML = `
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <line x1="23" y1="9" x2="17" y2="15"></line>
        <line x1="17" y1="9" x2="23" y2="15"></line>
      `;
      soundToggleBtn.style.color = 'var(--text-dim)';
    }
    localStorage.setItem('ecar_sound', soundEnabled);
  }

  soundToggleBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    initAudioContext();
    updateSoundUI();
  });
  updateSoundUI();

  // High Score Persistence
  let highScore = parseInt(localStorage.getItem('ecar_highscore') || '0', 10);
  highScoreEl.textContent = highScore.toLocaleString();

  // Game Settings & State
  let difficulty = 'normal'; // 'normal' or 'turbo'
  const state = {
    active: false,
    score: 0,
    baseSpeed: 7.5,
    currentSpeed: 7.5,
    topSpeed: 22,
    x: 0,
    y: 0,
    playerWidth: 46,
    playerHeight: 94,
    lastFrameTime: 0,
    nearMissCooldown: false,
    combo: 0,
    straddleTime: 0
  };

  const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
  };

  // Keyboard Mapping (Arrows + WASD)
  const keyMap = {
    ArrowUp: 'ArrowUp',
    KeyW: 'ArrowUp',
    w: 'ArrowUp',
    W: 'ArrowUp',
    ArrowDown: 'ArrowDown',
    KeyS: 'ArrowDown',
    s: 'ArrowDown',
    S: 'ArrowDown',
    ArrowLeft: 'ArrowLeft',
    KeyA: 'ArrowLeft',
    a: 'ArrowLeft',
    A: 'ArrowLeft',
    ArrowRight: 'ArrowRight',
    KeyD: 'ArrowRight',
    d: 'ArrowRight',
    D: 'ArrowRight'
  };

  window.addEventListener('keydown', (e) => {
    const action = keyMap[e.code] || keyMap[e.key];
    if (action) {
      keys[action] = true;
      e.preventDefault();
    }
    if (e.code === 'Space' && !state.active) {
      startGame();
    }
  });

  window.addEventListener('keyup', (e) => {
    const action = keyMap[e.code] || keyMap[e.key];
    if (action) {
      keys[action] = false;
      e.preventDefault();
    }
  });

  // Mobile Virtual Touch Handlers
  touchButtons.forEach(btn => {
    const mappedKey = btn.getAttribute('data-key');
    
    const press = (e) => {
      e.preventDefault();
      initAudioContext();
      keys[mappedKey] = true;
      btn.classList.add('active');
      if (navigator.vibrate) {
        try { navigator.vibrate(10); } catch (err) {}
      }
    };

    const release = (e) => {
      e.preventDefault();
      keys[mappedKey] = false;
      btn.classList.remove('active');
    };

    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('touchstart', press, { passive: false });
    btn.addEventListener('touchend', release, { passive: false });
    btn.addEventListener('touchcancel', release, { passive: false });
  });

  // Difficulty selection synchronized across startScreen and gameOverScreen
  function updateDifficulty(newDiff) {
    difficulty = newDiff;
    document.querySelectorAll('.mode-btn').forEach(btn => {
      if (btn.getAttribute('data-difficulty') === newDiff) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const diff = btn.getAttribute('data-difficulty');
      if (diff) {
        updateDifficulty(diff);
      }
    });
  });

  // Player Car Element
  const playerCar = document.createElement('div');
  playerCar.className = 'car';

  // Enemy Sprites
  const enemySprites = [
    "url('./img/enemy1.png') center / contain no-repeat",
    "url('./img/enemy2.png') center / contain no-repeat",
    "url('./img/enemy3.png') center / contain no-repeat"
  ];

  let roadDividers = [];
  let enemyCars = [];

  const LANES_COUNT = 3;

  function getLaneX(laneIndex, trackWidth) {
    const laneWidth = trackWidth / LANES_COUNT;
    return Math.floor(laneIndex * laneWidth + (laneWidth - state.playerWidth) / 2);
  }

  // Anti-overlap safe spawn algorithm: guarantees cars never spawn inside each other
  function getSafeEnemySpawn(existingEnemies, trackWidth) {
    let minY = -150;
    if (existingEnemies.length > 0) {
      minY = Math.min(...existingEnemies.map(e => e.y));
    }

    const minSpacing = difficulty === 'turbo' ? 220 : 260;
    const targetY = Math.min(-180, minY - (minSpacing + Math.random() * 90));

    // Check which lanes are clear near targetY (within 200px)
    const laneDistances = [0, 1, 2].map(lane => {
      let minDist = Infinity;
      for (const other of existingEnemies) {
        if (other.lane === lane) {
          const dist = Math.abs(other.y - targetY);
          if (dist < minDist) minDist = dist;
        }
      }
      return { lane, minDist };
    });

    const validLanes = laneDistances.filter(l => l.minDist >= 190);

    let chosenLane;
    if (validLanes.length > 0) {
      chosenLane = validLanes[Math.floor(Math.random() * validLanes.length)].lane;
    } else {
      laneDistances.sort((a, b) => b.minDist - a.minDist);
      chosenLane = laneDistances[0].lane;
    }

    return {
      lane: chosenLane,
      x: getLaneX(chosenLane, trackWidth),
      y: targetY
    };
  }

  function initEnemyProperties(enemy, trackWidth, otherEnemies) {
    const spawn = getSafeEnemySpawn(otherEnemies, trackWidth);
    enemy.lane = spawn.lane;
    // Lateral offset within the lane (-13px to +13px) to break rigid grid
    enemy.laneOffset = (Math.random() - 0.5) * 26;
    enemy.wobblePhase = Math.random() * Math.PI * 2;
    enemy.wobbleSpeed = 0.002 + Math.random() * 0.003;
    enemy.wobbleAmount = 5 + Math.random() * 8; // 5 to 13px dynamic sway

    enemy.x = spawn.x + enemy.laneOffset;
    enemy.y = spawn.y;
    enemy.targetX = enemy.x;
    enemy.targetLane = spawn.lane;
    enemy.baseTargetX = enemy.x;

    enemy.style.left = `${enemy.x}px`;
    enemy.style.top = `${enemy.y}px`;

    // 3 distinct car types with varied speed profiles and AI:
    // Type 0: Heavy/Slow (cyan/silver), speedFactor 0.38 - 0.45, stays in lane
    // Type 1: Cruiser (grey/red), speedFactor 0.50 - 0.58, occasional lane changes
    // Type 2: Sports Coupé (fast), speedFactor 0.62 - 0.72, active lane changer!
    const typeIdx = Math.floor(Math.random() * enemySprites.length);
    enemy.typeIdx = typeIdx;
    enemy.style.background = enemySprites[typeIdx];

    if (typeIdx === 0) {
      enemy.speedFactor = 0.40 + Math.random() * 0.05;
      enemy.canChangeLane = false;
    } else if (typeIdx === 1) {
      enemy.speedFactor = 0.52 + Math.random() * 0.06;
      enemy.canChangeLane = Math.random() < 0.45;
    } else {
      enemy.speedFactor = 0.64 + Math.random() * 0.08;
      enemy.canChangeLane = true;
    }

    enemy.laneChangeState = 'idle'; // 'idle' | 'signaling' | 'moving'
    enemy.laneChangeTimer = 0;
    enemy.classList.remove('signaling-left', 'signaling-right');
  }

  function createEnemyElement() {
    const enemy = document.createElement('div');
    enemy.className = 'enemy';
    return enemy;
  }

  function initRoadTrack() {
    lanesContainer.innerHTML = '';
    roadDividers = [];

    const trackHeight = roadTrack.offsetHeight || 600;
    const dividerSpacing = 70;
    const count = Math.ceil(trackHeight / dividerSpacing) + 2;

    const trackWidth = roadTrack.offsetWidth || 340;
    const laneWidth = trackWidth / 3;

    for (let i = 0; i < count; i++) {
      const d1 = document.createElement('div');
      d1.className = 'road-divider';
      d1.style.left = `${laneWidth - 3}px`;
      d1.y = i * dividerSpacing;
      d1.style.top = `${d1.y}px`;
      lanesContainer.appendChild(d1);
      roadDividers.push(d1);

      const d2 = document.createElement('div');
      d2.className = 'road-divider';
      d2.style.left = `${laneWidth * 2 - 3}px`;
      d2.y = i * dividerSpacing;
      d2.style.top = `${d2.y}px`;
      lanesContainer.appendChild(d2);
      roadDividers.push(d2);
    }
  }

  function spawnEnemies() {
    trafficContainer.innerHTML = '';
    enemyCars = [];

    const trackWidth = roadTrack.offsetWidth || 340;
    const initialCount = difficulty === 'turbo' ? 4 : 3;

    for (let i = 0; i < initialCount; i++) {
      const enemy = createEnemyElement();
      initEnemyProperties(enemy, trackWidth, enemyCars);
      trafficContainer.appendChild(enemy);
      enemyCars.push(enemy);
    }
  }

  function startGame() {
    initAudioContext();
    startScreen.classList.add('hide');
    gameOverScreen.classList.add('hide');
    newRecordNotice.classList.add('hide');

    state.active = true;
    state.score = 0;
    state.combo = 0;

    // Significantly increased speed scaling:
    // Normal: base 7.5 (~105 km/h), topSpeed 21 (~294 km/h, with nitro ~396 km/h)
    // Turbo: base 10.5 (~147 km/h), topSpeed 26 (~364 km/h, with nitro ~491 km/h)
    state.baseSpeed = difficulty === 'turbo' ? 10.5 : 7.5;
    state.topSpeed = difficulty === 'turbo' ? 26 : 21;
    state.currentSpeed = state.baseSpeed;
    state.nearMissCooldown = false;

    currentScoreEl.textContent = '0';

    initRoadTrack();
    spawnEnemies();

    // Place Player Car
    const trackWidth = roadTrack.offsetWidth || 340;
    const trackHeight = roadTrack.offsetHeight || 600;
    state.x = (trackWidth - state.playerWidth) / 2;
    state.y = trackHeight - state.playerHeight - 30;

    playerCar.style.left = `${state.x}px`;
    playerCar.style.top = `${state.y}px`;
    roadTrack.appendChild(playerCar);

    state.lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);
  }

  function triggerNearMiss(x, y) {
    if (state.nearMissCooldown) return;
    state.nearMissCooldown = true;
    setTimeout(() => { state.nearMissCooldown = false; }, 350);

    state.combo = (state.combo || 0) + 1;
    const multiplier = Math.min(4, state.combo);
    const bonus = 250 * multiplier;
    state.score += bonus;
    playNearMissSound();

    const popup = document.createElement('div');
    popup.className = 'combo-popup';
    popup.textContent = state.combo > 1 ? `+${bonus} NEAR MISS x${state.combo}!` : `+${bonus} NEAR MISS!`;
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
    roadTrack.appendChild(popup);

    setTimeout(() => {
      if (popup.parentNode) popup.parentNode.removeChild(popup);
    }, 700);
  }

  function spawnSparks(x, y) {
    for (let i = 0; i < 16; i++) {
      const p = document.createElement('div');
      p.className = 'spark-particle';
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 50;
      p.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
      p.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
      
      particlesLayer.appendChild(p);
      setTimeout(() => {
        if (p.parentNode) p.parentNode.removeChild(p);
      }, 450);
    }
  }

  function endGame() {
    state.active = false;
    state.combo = 0;
    playCrashSound();
    spawnSparks(state.x + state.playerWidth / 2, state.y + state.playerHeight / 2);

    const finalScore = Math.floor(state.score);
    finalScoreEl.textContent = finalScore.toLocaleString();
    
    const previousHighScore = parseInt(localStorage.getItem('ecar_highscore') || '0', 10);
    let isNewRecord = false;
    if (finalScore > previousHighScore && finalScore > 0) {
      highScore = finalScore;
      localStorage.setItem('ecar_highscore', highScore);
      highScoreEl.textContent = highScore.toLocaleString();
      isNewRecord = true;
    }
    finalHighScoreEl.textContent = highScore.toLocaleString();

    if (isNewRecord) {
      newRecordNotice.classList.remove('hide');
    } else {
      newRecordNotice.classList.add('hide');
    }

    setTimeout(() => {
      gameOverScreen.classList.remove('hide');
    }, 350);
  }

  function gameLoop(timestamp) {
    if (!state.active) return;

    const now = timestamp || performance.now();
    const deltaMs = state.lastFrameTime ? (now - state.lastFrameTime) : 16.667;
    state.lastFrameTime = now;
    // Normalize to 60 FPS baseline (16.667ms per frame). Clamp between 0.2 and 2.5
    const dt = Math.min(2.5, Math.max(0.2, deltaMs / 16.667));

    // Progressive speed scaling based on score
    const accelDivisor = difficulty === 'turbo' ? 420 : 580;
    state.currentSpeed = Math.min(state.topSpeed, state.baseSpeed + state.score / accelDivisor);

    // Dynamic Minimum Speed Floor that RISES with score!
    // As score increases, the player CANNOT brake to a crawl:
    // In Turbo: floor starts at 11 (154 km/h), rises up to 23 (322 km/h) at high scores
    // In Normal: floor starts at 7.5 (105 km/h), rises up to 17 (238 km/h) at high scores
    const maxFloorBonus = difficulty === 'turbo' ? 12 : 9.5;
    const minFloorProgress = Math.min(maxFloorBonus, (state.score / accelDivisor) * 0.75);
    const currentMinFloor = state.baseSpeed + minFloorProgress;

    // Nitro Boost when pressing UP, Braking when pressing DOWN
    let effectiveSpeed = state.currentSpeed;
    if (keys.ArrowUp) {
      effectiveSpeed *= 1.35;
      playerCar.style.filter = 'drop-shadow(0 0 18px rgba(236, 72, 153, 0.95))';
    } else if (keys.ArrowDown) {
      // Brake slows down only up to 16%, but CANNOT go below the rising speed floor!
      effectiveSpeed = Math.max(currentMinFloor, state.currentSpeed * 0.84);
      playerCar.style.filter = 'drop-shadow(0 0 12px rgba(245, 158, 11, 0.7))';
      state.combo = 1; // Braking resets combo streak
    } else {
      playerCar.style.filter = 'drop-shadow(0 0 12px rgba(6, 182, 212, 0.7))';
    }

    // Steering Physics with dt
    const steerSpeed = (7.2 + effectiveSpeed * 0.05) * dt;
    let tilt = 0;
    if (keys.ArrowLeft) {
      state.x -= steerSpeed;
      tilt = -6;
    }
    if (keys.ArrowRight) {
      state.x += steerSpeed;
      tilt = 6;
    }

    // Road Track Bounds
    const trackWidth = roadTrack.offsetWidth || 350;
    const trackHeight = roadTrack.offsetHeight || 600;
    const curbMargin = 10;

    if (state.x < curbMargin) state.x = curbMargin;
    if (state.x > trackWidth - state.playerWidth - curbMargin) {
      state.x = trackWidth - state.playerWidth - curbMargin;
    }

    // Lane Straddling Detection & Road Marker Rumble
    const laneW = trackWidth / LANES_COUNT;
    const pCenter = state.x + state.playerWidth / 2;
    const onLine1 = Math.abs(pCenter - laneW) < 18;
    const onLine2 = Math.abs(pCenter - laneW * 2) < 18;

    if (onLine1 || onLine2) {
      state.straddleTime += deltaMs;
      // Rumble vibration when balancing on dashed lines for more than 0.35s
      if (state.straddleTime > 350) {
        const shakeX = (Math.random() - 0.5) * 5;
        tilt += shakeX * 1.5;
        // Natural tire slip off raised cat's eyes
        state.x += (Math.random() - 0.5) * 2.0 * dt;
      }
    } else {
      state.straddleTime = Math.max(0, state.straddleTime - deltaMs * 2);
    }

    // Vertical Movement with dt
    if (keys.ArrowUp && state.y > 40) {
      state.y -= 2.5 * dt;
    }
    if (keys.ArrowDown && state.y < trackHeight - state.playerHeight - 20) {
      state.y += 3.5 * dt;
    }

    playerCar.style.transform = `rotate(${tilt}deg)`;
    playerCar.style.left = `${state.x}px`;
    playerCar.style.top = `${state.y}px`;

    // Move Road Dividers with dt
    const dividerSpacing = 70;
    roadDividers.forEach(div => {
      div.y += effectiveSpeed * dt;
      if (div.y >= trackHeight) {
        div.y -= (roadDividers.length / 2) * dividerSpacing;
      }
      div.style.top = `${div.y}px`;
    });

    // Dynamic Traffic Density: spawn extra car at high score milestones
    const maxCars = difficulty === 'turbo' ? 5 : 4;
    const scoreThreshold = difficulty === 'turbo' ? 5000 : 4000;
    if (state.score > scoreThreshold && enemyCars.length < maxCars) {
      const extraEnemy = createEnemyElement();
      initEnemyProperties(extraEnemy, trackWidth, enemyCars);
      trafficContainer.appendChild(extraEnemy);
      enemyCars.push(extraEnemy);
    }

    // Move & Collide Enemy Cars with dt
    const pBox = {
      left: state.x + 4,
      right: state.x + state.playerWidth - 4,
      top: state.y + 6,
      bottom: state.y + state.playerHeight - 6
    };

    for (let i = 0; i < enemyCars.length; i++) {
      const enemy = enemyCars[i];

      // Anti-tailgating AI: slow down if catching up to a car ahead in the same lane
      let effectiveEnemySpeedFactor = enemy.speedFactor;
      for (let j = 0; j < enemyCars.length; j++) {
        if (i === j) continue;
        const other = enemyCars[j];
        if (other.lane === enemy.lane && other.y > enemy.y && (other.y - enemy.y) < 170) {
          effectiveEnemySpeedFactor = Math.min(effectiveEnemySpeedFactor, other.speedFactor * 0.92);
        }
      }

      // Natural lane wobble / breathing sway
      const wobble = Math.sin(now * enemy.wobbleSpeed + enemy.wobblePhase) * enemy.wobbleAmount;

      // Dynamic Lane Changing AI with turn signals
      if (enemy.canChangeLane && enemy.y > -60 && enemy.y < trackHeight - 130) {
        if (enemy.laneChangeState === 'idle') {
          // Dynamic shift probability increases with game intensity
          const shiftChance = (0.012 + (state.score / 25000) * 0.01) * dt;
          if (Math.random() < shiftChance) {
            const possibleLanes = [];
            if (enemy.lane > 0) possibleLanes.push(enemy.lane - 1);
            if (enemy.lane < 2) possibleLanes.push(enemy.lane + 1);
            const candidateLane = possibleLanes[Math.floor(Math.random() * possibleLanes.length)];

            const laneClear = enemyCars.every(c => c === enemy || c.lane !== candidateLane || Math.abs(c.y - enemy.y) > 190);
            if (laneClear) {
              enemy.targetLane = candidateLane;
              enemy.laneChangeState = 'signaling';
              enemy.laneChangeTimer = 22; // ~0.35s warning blinker
              if (candidateLane < enemy.lane) {
                enemy.classList.add('signaling-left');
              } else {
                enemy.classList.add('signaling-right');
              }
            }
          }
        } else if (enemy.laneChangeState === 'signaling') {
          enemy.laneChangeTimer -= dt;
          if (enemy.laneChangeTimer <= 0) {
            enemy.laneChangeState = 'moving';
            enemy.classList.remove('signaling-left', 'signaling-right');
            enemy.lane = enemy.targetLane;
            enemy.baseTargetX = getLaneX(enemy.lane, trackWidth) + enemy.laneOffset;
          }
        } else if (enemy.laneChangeState === 'moving') {
          const dx = enemy.baseTargetX - enemy.x;
          if (Math.abs(dx) < 2) {
            enemy.x = enemy.baseTargetX;
            enemy.laneChangeState = 'idle';
          } else {
            enemy.x += Math.sign(dx) * Math.min(Math.abs(dx), 4.2 * dt);
          }
        }
      }

      // Visual X position (incorporates base position + lane offset + live wobble)
      const currentVisualX = (enemy.laneChangeState === 'moving') 
        ? enemy.x 
        : (getLaneX(enemy.lane, trackWidth) + enemy.laneOffset + wobble);
      
      enemy.style.left = `${currentVisualX}px`;

      // Downward movement
      enemy.y += effectiveSpeed * effectiveEnemySpeedFactor * dt;
      enemy.style.top = `${enemy.y}px`;

      const eBox = {
        left: currentVisualX + 4,
        right: currentVisualX + state.playerWidth - 4,
        top: enemy.y + 6,
        bottom: enemy.y + state.playerHeight - 6
      };

      // Collision Check
      if (
        pBox.left < eBox.right &&
        pBox.right > eBox.left &&
        pBox.top < eBox.bottom &&
        pBox.bottom > eBox.top
      ) {
        endGame();
        return;
      }

      // Near-Miss Bonus Check (narrow margin)
      const isNear = 
        Math.abs((pBox.left + pBox.right) / 2 - (eBox.left + eBox.right) / 2) < state.playerWidth + 18 &&
        Math.abs((pBox.top + pBox.bottom) / 2 - (eBox.top + eBox.bottom) / 2) < state.playerHeight * 0.75;
      
      if (isNear) {
        triggerNearMiss(state.x, state.y);
      }

      // Recycle Enemy Car to Top safely without overlap
      if (enemy.y > trackHeight + 50) {
        const others = enemyCars.filter(c => c !== enemy);
        initEnemyProperties(enemy, trackWidth, others);
      }
    }

    // Score & HUD Update with dt
    state.score += effectiveSpeed * 0.9 * dt;
    currentScoreEl.textContent = Math.floor(state.score).toLocaleString();
    speedMeterEl.innerHTML = `${Math.floor(effectiveSpeed * 14)} <small>км/ч</small>`;

    requestAnimationFrame(gameLoop);
  }

  // Event Listeners
  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', startGame);
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      gameOverScreen.classList.add('hide');
      startScreen.classList.remove('hide');
    });
  }

  // Responsive track resize
  window.addEventListener('resize', () => {
    if (state.active) {
      initRoadTrack();
    }
  });

})();
