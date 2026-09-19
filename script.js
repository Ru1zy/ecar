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
    baseSpeed: 6,
    currentSpeed: 6,
    topSpeed: 16,
    x: 0,
    y: 0,
    playerWidth: 50,
    playerHeight: 96,
    lastFrameTime: 0,
    nearMissCooldown: false
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
      if (navigator.vibrate) navigator.vibrate(12);
    };

    const release = (e) => {
      e.preventDefault();
      keys[mappedKey] = false;
      btn.classList.remove('active');
    };

    btn.addEventListener('touchstart', press, { passive: false });
    btn.addEventListener('touchend', release, { passive: false });
    btn.addEventListener('touchcancel', release, { passive: false });
    btn.addEventListener('mousedown', press);
    btn.addEventListener('mouseup', release);
    btn.addEventListener('mouseleave', release);
  });

  // Difficulty selection
  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      difficulty = btn.getAttribute('data-difficulty');
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

  function initRoadTrack() {
    lanesContainer.innerHTML = '';
    roadDividers = [];

    const trackHeight = roadTrack.offsetHeight || 600;
    const dividerSpacing = 70;
    const count = Math.ceil(trackHeight / dividerSpacing) + 2;

    // 2 Divider lines for a 3-lane road
    const trackWidth = roadTrack.offsetWidth || 340;
    const laneWidth = trackWidth / 3;

    for (let i = 0; i < count; i++) {
      // Line 1
      const d1 = document.createElement('div');
      d1.className = 'road-divider';
      d1.style.left = `${laneWidth - 3}px`;
      d1.y = i * dividerSpacing;
      d1.style.top = `${d1.y}px`;
      lanesContainer.appendChild(d1);
      roadDividers.push(d1);

      // Line 2
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
    const count = difficulty === 'turbo' ? 4 : 3;
    const spacing = 280;

    for (let i = 0; i < count; i++) {
      const enemy = document.createElement('div');
      enemy.className = 'enemy';
      enemy.style.background = enemySprites[i % enemySprites.length];
      
      enemy.y = -spacing * (i + 1);
      enemy.x = getRandomLaneX(trackWidth);
      
      enemy.style.top = `${enemy.y}px`;
      enemy.style.left = `${enemy.x}px`;
      
      trafficContainer.appendChild(enemy);
      enemyCars.push(enemy);
    }
  }

  function getRandomLaneX(trackWidth) {
    const lanes = 3;
    const laneWidth = trackWidth / lanes;
    const randomLane = Math.floor(Math.random() * lanes);
    return Math.floor(randomLane * laneWidth + (laneWidth - state.playerWidth) / 2);
  }

  function startGame() {
    initAudioContext();
    startScreen.classList.add('hide');
    gameOverScreen.classList.add('hide');
    newRecordNotice.classList.add('hide');

    state.active = true;
    state.score = 0;
    state.baseSpeed = difficulty === 'turbo' ? 8 : 5.5;
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
    setTimeout(() => { state.nearMissCooldown = false; }, 400);

    state.score += 250;
    playNearMissSound();

    const popup = document.createElement('div');
    popup.className = 'combo-popup';
    popup.textContent = '+250 NEAR MISS!';
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
    playCrashSound();
    spawnSparks(state.x + state.playerWidth / 2, state.y + state.playerHeight / 2);

    finalScoreEl.textContent = Math.floor(state.score).toLocaleString();
    
    let isNewRecord = false;
    if (state.score > highScore) {
      highScore = Math.floor(state.score);
      localStorage.setItem('ecar_highscore', highScore);
      highScoreEl.textContent = highScore.toLocaleString();
      isNewRecord = true;
    }
    finalHighScoreEl.textContent = highScore.toLocaleString();

    if (isNewRecord) {
      newRecordNotice.classList.remove('hide');
    }

    setTimeout(() => {
      gameOverScreen.classList.remove('hide');
    }, 350);
  }

  function gameLoop(timestamp) {
    if (!state.active) return;

    // Progressive speed scaling
    state.currentSpeed = Math.min(state.topSpeed, state.baseSpeed + state.score / 1500);
    
    // Nitro Boost when pressing UP, Braking when pressing DOWN
    let effectiveSpeed = state.currentSpeed;
    if (keys.ArrowUp) {
      effectiveSpeed *= 1.35;
      playerCar.style.filter = 'drop-shadow(0 0 16px rgba(236, 72, 153, 0.9))';
    } else if (keys.ArrowDown) {
      effectiveSpeed *= 0.65;
      playerCar.style.filter = 'drop-shadow(0 0 12px rgba(245, 158, 11, 0.7))';
    } else {
      playerCar.style.filter = 'drop-shadow(0 0 12px rgba(6, 182, 212, 0.7))';
    }

    // Steering Physics
    const steerSpeed = 6.5;
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
    const trackWidth = roadTrack.offsetWidth || 340;
    const trackHeight = roadTrack.offsetHeight || 600;
    const curbMargin = 10;

    if (state.x < curbMargin) state.x = curbMargin;
    if (state.x > trackWidth - state.playerWidth - curbMargin) {
      state.x = trackWidth - state.playerWidth - curbMargin;
    }

    // Vertical Movement
    if (keys.ArrowUp && state.y > 40) {
      state.y -= 2.5;
    }
    if (keys.ArrowDown && state.y < trackHeight - state.playerHeight - 20) {
      state.y += 3.5;
    }

    playerCar.style.transform = `rotate(${tilt}deg)`;
    playerCar.style.left = `${state.x}px`;
    playerCar.style.top = `${state.y}px`;

    // Move Road Dividers
    const dividerSpacing = 70;
    roadDividers.forEach(div => {
      div.y += effectiveSpeed;
      if (div.y >= trackHeight) {
        div.y -= (roadDividers.length / 2) * dividerSpacing;
      }
      div.style.top = `${div.y}px`;
    });

    // Move & Collide Enemy Cars
    const pBox = {
      left: state.x + 4,
      right: state.x + state.playerWidth - 4,
      top: state.y + 4,
      bottom: state.y + state.playerHeight - 4
    };

    for (let i = 0; i < enemyCars.length; i++) {
      const enemy = enemyCars[i];
      enemy.y += effectiveSpeed * 0.55;
      enemy.style.top = `${enemy.y}px`;

      const eBox = {
        left: enemy.x + 4,
        right: enemy.x + state.playerWidth - 4,
        top: enemy.y + 4,
        bottom: enemy.y + state.playerHeight - 4
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

      // Recycle Enemy Car to Top
      if (enemy.y > trackHeight + 40) {
        enemy.y = -220 - Math.random() * 120;
        enemy.x = getRandomLaneX(trackWidth);
        enemy.style.left = `${enemy.x}px`;
      }
    }

    // Score & HUD Update
    state.score += Math.floor(effectiveSpeed * 0.8);
    currentScoreEl.textContent = state.score.toLocaleString();
    speedMeterEl.innerHTML = `${Math.floor(effectiveSpeed * 14)} <small>км/ч</small>`;

    requestAnimationFrame(gameLoop);
  }

  // Event Listeners
  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', startGame);

  // Responsive track resize
  window.addEventListener('resize', () => {
    if (state.active) {
      initRoadTrack();
    }
  });

})();
