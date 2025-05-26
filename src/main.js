class PauseableTimer {
  constructor(callback, delay) {
    this.callback = callback;
    this.delay = delay;
    this.remaining = delay;
    this.timerId = null;
    this.start = null;
    this.paused = false;

    this.resume();
  }

  pause() {
    if (!this.paused) {
      clearTimeout(this.timerId);
      this.remaining -= Date.now() - this.start;
      this.paused = true;
    }
  }

  resume() {
    if (this.paused || this.start === null) {
      this.start = Date.now();
      this.timerId = setTimeout(this.callback, this.remaining);
      this.paused = false;
    }
  }

  cancel() {
    clearTimeout(this.timerId);
    this.paused = true;
  }
}

class AimTrainer {
  constructor() {
    this.score = 0;
    this.hits = 0;
    this.misses = 0;
    this.gameTime = 60;
    this.timeLeft = this.gameTime;
    this.isGameActive = false;
    this.isPaused = false;
    this.targets = [];
    this.gameTimer = null;
    this.spawnTimer = null;
    this.targetsPerSecond = 3;
    this.fadeSpeed = 2;

    this.gameArea = document.getElementById('gameArea');
    this.startScreen = document.getElementById('startScreen');
    this.gameOverScreen = document.getElementById('gameOverScreen');
    this.pauseScreen = document.getElementById('pauseScreen');

    this.initEventListeners();
    this.disableContextMenu();
  }

  disableContextMenu() {
    // Disable right-click context menu on game area
    this.gameArea.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });

    // Disable context menu on targets
    document.addEventListener('contextmenu', (e) => {
      if (e.target.classList.contains('target')) {
        e.preventDefault();
        return false;
      }
    });
  }

  initEventListeners() {
    document.getElementById('startBtn').addEventListener('click', () => this.startGame());
    document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
    document.getElementById('resumeBtn').addEventListener('click', () => this.resumeGame());
    document.getElementById('quitBtn').addEventListener('click', () => this.quitToMenu());

    const cursorSelect = document.getElementById('legacyCursor');
    this.handleLegacyCursor(cursorSelect.value); // init
    cursorSelect.addEventListener('change', (event) => this.handleLegacyCursor(event.target.value)) // event

    window.addEventListener('blur', () => {
      if (this.isGameActive && !this.isPaused) {
        this.pauseGame();
      }
    });

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.isGameActive && !this.isPaused) {
          this.pauseGame();
        } else if (this.isPaused) {
          this.resumeGame();
        }
      }
    });

    // Handle clicks on game area for misses
    this.gameArea.addEventListener('mousedown', (e) => {
      if ((e.button === 0 || e.button === 2) && this.isGameActive && !this.isPaused && e.target === this.gameArea) {
        this.registerMiss(e);
      }
    });
  }

  handleLegacyCursor(bool) {
    if (bool == "true") {
      document.querySelector('body').style.cursor = 'url("/aimboosted/public/cursor-min.png"), auto';
    } else if (bool == "false") {
      document.querySelector('body').style.cursor = 'auto';
    }
  }

  startGame() {
    // Get settings from UI with validation
    this.targetsPerSecond = Math.max(0.1, Math.min(4, parseFloat(document.getElementById('targetsPerSecond').value) || 1));
    this.gameTime = Math.max(10, Math.min(300, parseInt(document.getElementById('gameDuration').value) || 60));
    this.fadeSpeed = Math.max(0.1, Math.min(2, parseFloat(document.getElementById('fadeSpeed').value) || 0.8));

    this.startScreen.style.display = 'none';
    this.isGameActive = true;
    this.isPaused = false;
    this.resetStats();
    this.startTimer();
    this.startSpawning();
  }

  quitToMenu() {
    this.isGameActive = false;
    this.isPaused = false;

    if (this.gameTimer) {
      clearInterval(this.gameTimer);
    }

    if (this.spawnTimer) {
      clearTimeout(this.spawnTimer);
    }

    // Clear all targets
    this.targets.forEach(target => {
      if (target.parentNode) {
        target.parentNode.removeChild(target);
      }
    });
    this.targets = [];

    // Hide pause screen and show start screen
    this.pauseScreen.style.display = 'none';
    this.startScreen.style.display = 'flex';
  }

  pauseGame() {
    this.isPaused = true;
    this.pauseScreen.style.display = 'flex';

    // Pause all timers
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
    }
    if (this.spawnTimer) {
      clearTimeout(this.spawnTimer);
    }

    this.targets.forEach(target => {
      if (target.lifetimeTimer) target.lifetimeTimer.pause();
    });

    document.getAnimations().forEach(animation => {
      animation.pause();
    });
  }

  resumeGame() {
    this.isPaused = false;
    this.pauseScreen.style.display = 'none';

    // Resume timers
    this.startTimer();
    this.startSpawning();

    this.targets.forEach(target => {
      if (target.lifetimeTimer) target.lifetimeTimer.resume();
    });

    document.getAnimations().forEach(animation => {
      const target = animation.effect?.target;

      if (target.classList.contains('hit')) return;

      animation.play();
    });
  }

  resetStats() {
    this.score = 0;
    this.hits = 0;
    this.misses = 0;
    this.timeLeft = this.gameTime;
    this.updateHUD();
  }

  startTimer() {
    this.gameTimer = setInterval(() => {
      this.timeLeft--;
      this.updateHUD();

      if (this.timeLeft <= 0) {
        this.endGame();
      }
    }, 1000);
  }

  startSpawning() {
    const spawnTarget = () => {
      if (this.isGameActive && !this.isPaused) {
        this.createTarget();

        // Calculate spawn delay based on targets per second setting
        const baseDelay = 1000 / this.targetsPerSecond;
        this.spawnTimer = setTimeout(spawnTarget, baseDelay);
      }
    };

    // Initial spawn
    if (!this.isPaused) {
      setTimeout(spawnTarget, 500);
    }
  }

  createTarget() {
    const target = document.createElement('div');
    target.classList.add('target', 'active')

    // Position target randomly, avoiding edges
    const gameRect = this.gameArea.getBoundingClientRect();
    const targetSize = 80;
    const margin = targetSize / 2 + 20;

    const x = margin + Math.random() * (gameRect.width - margin * 2);
    const y = margin + Math.random() * (gameRect.height - margin * 2);

    target.style.left = x + 'px';
    target.style.top = y + 'px';

    const animation = target.animate([
      { transform: 'scale(0)' },
      { transform: 'scale(1)' }
    ], {
      duration: this.fadeSpeed * 1000,
      fill: 'forwards'
    });

    let shrinkAnim;
    animation.onfinish = () => {
      shrinkAnim = target.animate([
        { transform: 'scale(1)' },
        { transform: 'scale(0)' }
      ], {
        duration: this.fadeSpeed * 1500,
        fill: 'forwards'
      });
    };

    animation.pause();
    animation.currentTime = 0;

    target.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // Left mouse button
        e.preventDefault();
        this.hitTarget(e, target, [animation, shrinkAnim]);
      }
      if (e.button === 2) { // Right mouse button
        e.preventDefault();
        this.hitTarget(e, target, [animation, shrinkAnim]);
      }
    });

    this.gameArea.appendChild(target);
    this.targets.push(target);

    animation.play();

    // Auto-remove target after lifespan
    target.lifetimeTimer = new PauseableTimer(() => {
      if (target.parentNode && !target.classList.contains('hit')) {
        this.missTarget(target);
      }
    }, this.fadeSpeed * 1000 + this.fadeSpeed * 1500);
  }

  hitTarget(event, target, animations) {
    event.stopPropagation();

    if (target.classList.contains('hit') || !this.isGameActive || this.isPaused) return;

    for (const animation of animations) {
      if (animation) animation.pause();
    }

    target.classList.add('hit');

    this.hits++;
    const points = 5;
    this.score += points;

    target.classList.remove("active");

    target.animate([
      { opacity: 1, offset: 0.8 },
      { opacity: 0, offset: 1 }
    ], {
      duration: 1000,
      fill: 'forwards'
    });

    // Remove target
    target.lifetimeTimer = new PauseableTimer(() => {
      if (target.parentNode) {
        target.parentNode.removeChild(target);
      }
    }, this.fadeSpeed * 500);

    this.updateHUD();
  }

  missTarget(target) {
    if (target.classList.contains('hit')) return;

    this.misses++;

    if (target.parentNode) {
      target.parentNode.removeChild(target);
    }

    this.updateHUD();
  }

  registerMiss(event) {
    if (this.isPaused) return;

    this.misses++;
    this.showHitIndicator(event.clientX, event.clientY, 'MISS', '#ff4757');
    this.updateHUD();
  }

  showHitIndicator(x, y, text, color = '#64ffda') {
    const indicator = document.createElement('div');
    indicator.className = 'hit-indicator';
    indicator.textContent = text;
    indicator.style.color = color;
    indicator.style.left = (x - 20) + 'px';
    indicator.style.top = (y - 10) + 'px';

    document.body.appendChild(indicator);

    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    }, 1000);
  }

  updateHUD() {
    document.getElementById('score').textContent = this.score;
    document.getElementById('hits').textContent = this.hits;
    document.getElementById('misses').textContent = this.misses;
    document.getElementById('timer').textContent = this.timeLeft;

    const totalShots = this.hits + this.misses;
    const accuracy = totalShots > 0 ? Math.round((this.hits / totalShots) * 100) : 0;
    document.getElementById('accuracy').textContent = accuracy + '%';
  }

  endGame() {
    this.isGameActive = false;
    this.isPaused = false;

    if (this.gameTimer) {
      clearInterval(this.gameTimer);
    }

    if (this.spawnTimer) {
      clearTimeout(this.spawnTimer);
    }

    // Hide pause screen if visible
    this.pauseScreen.style.display = 'none';

    // Clear remaining targets
    this.targets.forEach(target => {
      if (target.parentNode) {
        target.parentNode.removeChild(target);
      }
    });
    this.targets = [];

    // Show final stats
    this.showGameOverScreen();
  }

  showGameOverScreen() {
    const totalShots = this.hits + this.misses;
    const accuracy = totalShots > 0 ? Math.round((this.hits / totalShots) * 100) : 0;
    const targetRate = (this.hits / this.gameTime).toFixed(1);

    document.getElementById('finalScore').textContent = this.score;
    document.getElementById('finalHits').textContent = this.hits;
    document.getElementById('finalMisses').textContent = this.misses;
    document.getElementById('finalAccuracy').textContent = accuracy + '%';
    document.getElementById('targetRate').textContent = targetRate;

    this.gameOverScreen.style.display = 'flex';
  }

  restartGame() {
    this.gameOverScreen.style.display = 'none';
    this.startScreen.style.display = 'flex';
  }
}

// Initialize game when page loads
window.addEventListener('load', () => {
  new AimTrainer();
});
